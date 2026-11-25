import Decimal from 'decimal.js'
import { canonicalInstrument, type OptionContract } from './option-contract'
import type { Result } from './types'

export const OPTION_DEVIATION_CATEGORIES = {
  PlannedLegTerms: 'PlannedLegTerms',
  EntrySize: 'EntrySize',
  UnplannedExposure: 'UnplannedExposure',
  StopDiscipline: 'StopDiscipline',
} as const

export type OptionFulfillment =
  | 'Unfilled' | 'PartiallyFilled' | 'FilledAsPlanned' | 'FilledWithDeviation' | 'NotEntered' | 'NotVerifiable'

export type OptionExecution = {
  id: string
  contract: OptionContract
  action: 'Buy' | 'Sell'
  opening: boolean
  quantity: string
  price: string
  fee: string
  economicTime: string
  recordedSequence: number
  plannedLegId?: string
  explicitlyUnplanned?: boolean
}

export type OptionPositionInput = {
  tradeId: string
  plannedLeg: { contract: OptionContract; quantity: number; openingAction: 'Buy' | 'Sell' }
  executions: OptionExecution[]
  closed?: boolean
  evidenceMissing?: boolean
}

export type OptionLot = {
  id: string
  executionId: string
  instrument: string
  quantity: string
  price: string
  basis: string
  allocatedOpeningFee: string
  economicTime: string
  recordedSequence: number
}

export type OptionDeviation = {
  fingerprint: string
  category: keyof typeof OPTION_DEVIATION_CATEGORIES
  fields: string[]
}

export type OptionPosition = {
  positions: { instrument: string; netQuantity: string; lotCount: number }[]
  lots: OptionLot[]
  lotMatches: {
    id: string; executionId: string; lotId: string; matchingMethod: 'FIFO'; quantity: string
    allocatedOpeningFee: string; allocatedDisposalFee: string
  }[]
  realizedToDate: string
  expectedLifecycle: 'Planned' | 'Open' | 'Closed'
  fulfillment: OptionFulfillment
  deviations: OptionDeviation[]
  deviationCategories: typeof OPTION_DEVIATION_CATEGORIES
}

const fixed = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)

function mismatchFields(planned: OptionContract, actual: OptionContract): string[] {
  const fields: string[] = []
  for (const key of ['underlying', 'kind', 'strike', 'expiration', 'multiplier'] as const) {
    if (String(planned[key]) !== String(actual[key])) fields.push(key)
  }
  return fields
}

export function deriveOptionPosition(
  input: OptionPositionInput,
): Result<OptionPosition, { issues: string[] }> {
  const instrument = canonicalInstrument(input.plannedLeg.contract)
  const signedOpening = input.plannedLeg.openingAction === 'Buy' ? 1 : -1
  const lots: OptionLot[] = []
  const matches: OptionPosition['lotMatches'] = []
  let net = new Decimal(0)
  let realized = new Decimal(0)
  const deviations: OptionDeviation[] = []
  let openingQuantity = new Decimal(0)
  let mismatched: string[] = []
  let unplanned = false
  let legId = 'leg-1'
  let hasClosing = false

  const ordered = [...input.executions].sort(
    (a, b) => a.economicTime.localeCompare(b.economicTime) || a.recordedSequence - b.recordedSequence,
  )
  for (const e of ordered) {
    try {
      const q = new Decimal(e.quantity)
      const p = new Decimal(e.price)
      const f = new Decimal(e.fee)
      if (q.lte(0) || p.lte(0) || f.lt(0)) throw new Error('invalid')
      const units = q.times(e.contract.multiplier)
      const direction = e.opening ? signedOpening : -signedOpening
      net = net.plus(q.times(direction))
      if (e.opening) {
        if (e.plannedLegId) legId = e.plannedLegId
        openingQuantity = openingQuantity.plus(q)
        const fields = mismatchFields(input.plannedLeg.contract, e.contract)
        if (fields.length) mismatched = [...new Set([...mismatched, ...fields])]
        if (e.explicitlyUnplanned) unplanned = true
        const basis = direction > 0 ? units.times(p).plus(f) : units.times(p).minus(f)
        lots.push({
          id: `lot-${e.id}`, executionId: e.id, instrument: canonicalInstrument(e.contract),
          quantity: e.quantity, price: e.price, basis: fixed(basis), allocatedOpeningFee: fixed(f),
          economicTime: e.economicTime, recordedSequence: e.recordedSequence,
        })
      } else {
        hasClosing = true
        let remaining = q
        for (const lot of lots) {
          if (remaining.lte(0)) break
          const lotQty = new Decimal(lot.quantity)
          if (lotQty.lte(0)) continue
          const take = Decimal.min(lotQty, remaining)
          const gross = take.times(e.contract.multiplier).times(p.minus(new Decimal(lot.price)))
          const openingFeePart = new Decimal(lot.allocatedOpeningFee).times(take).div(lotQty)
          const closingFeePart = f.times(take).div(q)
          const pnl = signedOpening > 0
            ? gross.minus(openingFeePart).minus(closingFeePart)
            : gross.negated().minus(openingFeePart).minus(closingFeePart)
          realized = realized.plus(pnl)
          remaining = remaining.minus(take)
          matches.push({
            id: `match-${e.id}-${lot.id}`, executionId: e.id, lotId: lot.id,
            matchingMethod: 'FIFO', quantity: take.toString(),
            allocatedOpeningFee: fixed(openingFeePart),
            allocatedDisposalFee: fixed(closingFeePart),
          })
        }
      }
    } catch {
      return { ok: false, error: { issues: ['InvalidExecution'] } }
    }
  }

  if (mismatched.length) {
    deviations.push({
      fingerprint: `${input.tradeId}:planned-leg-terms:${legId}`,
      category: 'PlannedLegTerms', fields: mismatched,
    })
  }
  if (unplanned) {
    deviations.push({
      fingerprint: `${input.tradeId}:unplanned-exposure:${legId}`,
      category: 'UnplannedExposure', fields: [],
    })
  }

  const planned = new Decimal(input.plannedLeg.quantity)
  let fulfillment: OptionFulfillment
  if (input.evidenceMissing) fulfillment = 'NotVerifiable'
  else if (input.closed && openingQuantity.eq(0)) fulfillment = 'NotEntered'
  else if (openingQuantity.eq(0)) fulfillment = 'Unfilled'
  else if (openingQuantity.lt(planned)) fulfillment = 'PartiallyFilled'
  else if (mismatched.length) fulfillment = 'FilledWithDeviation'
  else fulfillment = 'FilledAsPlanned'

  const expectedLifecycle = (input.closed || (hasClosing && net.eq(0))) ? 'Closed' as const
    : openingQuantity.eq(0) ? 'Planned' as const : 'Open' as const
  return {
    ok: true,
    value: {
      positions: [{ instrument, netQuantity: net.toString(), lotCount: lots.length }],
      lots,
      lotMatches: matches,
      realizedToDate: fixed(realized),
      expectedLifecycle,
      fulfillment,
      deviations,
      deviationCategories: OPTION_DEVIATION_CATEGORIES,
    },
  }
}
