import Decimal from 'decimal.js'
import type { Result } from './types'

// TradeAnalysis.derive — pure, deterministic opening-subset derivation.
// D3 owns this operation; later deliverables reuse it unchanged.
export type ExecutionFact = {
  id: string
  tradeId?: string
  positionChangeId?: string
  instrument: string
  action: 'Buy' | 'Sell'
  quantity: string
  price: string
  fee: string
  economicTime: string
  recordedSequence: number
  plannedLegId?: string
}

export type TradeDerivationInput = {
  tradeId: string
  storedLifecycle: string
  plan: {
    underlying: string
    quantity: number
    entry: string
    stop: string
    target: string
    oneR: string
    baseline: string
  }
  executions: ExecutionFact[]
  storedLots?: { executionId: string; quantity: string }[]
  storedMatches?: { executionId: string; lotId: string; quantity: string }[]
}

export type OpenLot = {
  id: string
  executionId: string
  instrument: string
  quantity: string
  basis: string
  allocatedOpeningFee: string
  economicTime: string
  recordedSequence: number
}

// A Lot Match is a link plus matched quantity and fee allocation only. Price,
// basis and P&L are never copied onto it; they remain derivable from the facts.
export type ClosingLotMatch = {
  id: string
  executionId: string
  lotId: string
  matchingMethod: 'FIFO'
  quantity: string
  allocatedOpeningFee: string
  allocatedDisposalFee: string
}

export type DerivedTradeState = {
  tradeId: string
  effectiveFacts: ExecutionFact[]
  positions: { instrument: string; netQuantity: string; lotCount: number }[]
  lots: OpenLot[]
  closingLotMatches: ClosingLotMatch[]
  realizedToDate: string
  expectedLifecycle: 'Planned' | 'Open' | 'Closed'
  agreement: { lifecycle: boolean; lots: boolean; findings: string[] }
}

export type DerivationIssue = 'InvalidExecution' | 'IncoherentEconomicFacts'

const fixed = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)

export function derive(input: TradeDerivationInput): Result<DerivedTradeState, { issues: DerivationIssue[] }> {
  const issues: DerivationIssue[] = []
  for (const e of input.executions) {
    if (!e.instrument || (e.action !== 'Buy' && e.action !== 'Sell')) issues.push('InvalidExecution')
    try {
      const q = new Decimal(e.quantity)
      const p = new Decimal(e.price)
      const f = new Decimal(e.fee)
      if (!q.isFinite() || q.lte(0) || !p.isFinite() || p.lte(0) || !f.isFinite() || f.lt(0)) issues.push('InvalidExecution')
    } catch {
      issues.push('InvalidExecution')
    }
  }
  if (issues.length) return { ok: false, error: { issues: [...new Set(issues)] } }

  // FactOrder = EconomicTime then RecordedSequence. Never wall-clock arrival.
  const effectiveFacts = [...input.executions].sort(
    (a, b) => a.economicTime.localeCompare(b.economicTime) || a.recordedSequence - b.recordedSequence,
  )

  type TrackedLot = {
    lot: OpenLot
    originalFee: Decimal
    originalQuantity: Decimal
    remainingQuantity: Decimal
    allocatedOpeningTotal: Decimal
    unitCost: Decimal
    touched: boolean
  }
  const tracked: TrackedLot[] = []
  const matches: ClosingLotMatch[] = []
  const netByInstrument = new Map<string, Decimal>()
  let realized = new Decimal(0)

  for (const e of effectiveFacts) {
    const q = new Decimal(e.quantity)
    const price = new Decimal(e.price)
    const fee = new Decimal(e.fee)
    const signed = e.action === 'Buy' ? q : q.negated()
    netByInstrument.set(e.instrument, (netByInstrument.get(e.instrument) ?? new Decimal(0)).plus(signed))

    if (e.action === 'Buy') {
      const lot: OpenLot = {
        id: `lot-${e.id}`,
        executionId: e.id,
        instrument: e.instrument,
        quantity: q.toString(),
        basis: fixed(q.times(price).plus(fee)),
        allocatedOpeningFee: fixed(fee),
        economicTime: e.economicTime,
        recordedSequence: e.recordedSequence,
      }
      tracked.push({
        lot, originalFee: fee, originalQuantity: q, remainingQuantity: q,
        allocatedOpeningTotal: new Decimal(0), unitCost: price, touched: false,
      })
      continue
    }

    // FIFO: consume the oldest still-open Lots first. Disposal fee is split
    // across this Execution's Lot Matches in proportion to matched quantity.
    let remaining = q
    for (const t of tracked) {
      if (remaining.lte(0)) break
      if (t.remainingQuantity.lte(0)) continue
      const take = Decimal.min(t.remainingQuantity, remaining)
      // Each Lot's opening fee is proportional to its original quantity; the
      // unconsumed portion stays with the Lot across any number of matches.
      const allocatedOpening = t.originalFee.times(take).div(t.originalQuantity)
      const allocatedDisposal = fee.times(take).div(q)
      realized = realized.plus(price.minus(t.unitCost).times(take).minus(allocatedOpening).minus(allocatedDisposal))
      t.remainingQuantity = t.remainingQuantity.minus(take)
      t.allocatedOpeningTotal = t.allocatedOpeningTotal.plus(allocatedOpening)
      t.touched = true
      remaining = remaining.minus(take)
      matches.push({
        id: `match-${e.id}-${t.lot.id}`,
        executionId: e.id,
        lotId: t.lot.id,
        matchingMethod: 'FIFO',
        quantity: take.toString(),
        allocatedOpeningFee: fixed(allocatedOpening),
        allocatedDisposalFee: fixed(allocatedDisposal),
      })
    }
    if (remaining.gt(0)) issues.push('IncoherentEconomicFacts')
  }
  if (issues.length) return { ok: false, error: { issues: [...new Set(issues)] } }

  const lots = tracked
    .filter(t => t.remainingQuantity.gt(0))
    .map(t => {
      if (!t.touched) return t.lot
      return {
        ...t.lot,
        quantity: t.remainingQuantity.toString(),
        basis: fixed(t.unitCost.times(t.remainingQuantity).plus(t.originalFee.minus(t.allocatedOpeningTotal))),
        allocatedOpeningFee: fixed(t.originalFee.minus(t.allocatedOpeningTotal)),
      }
    })

  const positions = [...netByInstrument.entries()].map(([instrument, net]) => ({
    instrument,
    netQuantity: net.toString(),
    lotCount: lots.filter(l => l.instrument === instrument).length,
  }))

  const hasDisposal = effectiveFacts.some(f => f.action === 'Sell')
  const flat = [...netByInstrument.values()].every(net => net.eq(0))
  const expectedLifecycle = effectiveFacts.length === 0
    ? 'Planned' as const
    : hasDisposal && flat ? 'Closed' as const : 'Open' as const

  const findings: string[] = []
  if (input.storedLifecycle !== expectedLifecycle) findings.push('StoredLifecycleDisagreement')
  const lotsAgree = input.storedLots === undefined || (
    input.storedLots.length === lots.length &&
    input.storedLots.every((s, i) => s.executionId === lots[i].executionId && new Decimal(s.quantity).eq(lots[i].quantity))
  )
  if (!lotsAgree) findings.push('StoredLotDisagreement')
  if (input.storedMatches !== undefined) {
    const matchesAgree = input.storedMatches.length === matches.length &&
      input.storedMatches.every((s, i) =>
        s.executionId === matches[i].executionId &&
        s.lotId === matches[i].lotId &&
        new Decimal(s.quantity).eq(matches[i].quantity))
    if (!matchesAgree) findings.push('StoredLotMatchDisagreement')
  }

  return {
    ok: true,
    value: {
      tradeId: input.tradeId,
      effectiveFacts,
      positions,
      lots,
      closingLotMatches: matches,
      realizedToDate: fixed(realized),
      expectedLifecycle,
      agreement: { lifecycle: !findings.includes('StoredLifecycleDisagreement'), lots: lotsAgree, findings },
    },
  }
}
