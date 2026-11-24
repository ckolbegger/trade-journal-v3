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

export type DerivedTradeState = {
  tradeId: string
  effectiveFacts: ExecutionFact[]
  positions: { instrument: string; netQuantity: string; lotCount: number }[]
  lots: OpenLot[]
  closingLotMatches: []
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

  const lots: OpenLot[] = []
  const netByInstrument = new Map<string, Decimal>()
  for (const e of effectiveFacts) {
    const q = new Decimal(e.quantity)
    const signed = e.action === 'Buy' ? q : q.negated()
    netByInstrument.set(e.instrument, (netByInstrument.get(e.instrument) ?? new Decimal(0)).plus(signed))

    // Opening facts create Lots. Disposal matching belongs to D6, not D3.
    if (e.action === 'Buy') {
      const basis = q.times(e.price).plus(e.fee)
      lots.push({
        id: `lot-${e.id}`,
        executionId: e.id,
        instrument: e.instrument,
        quantity: q.toString(),
        basis: fixed(basis),
        allocatedOpeningFee: fixed(new Decimal(e.fee)),
        economicTime: e.economicTime,
        recordedSequence: e.recordedSequence,
      })
    }
  }

  const positions = [...netByInstrument.entries()].map(([instrument, net]) => ({
    instrument,
    netQuantity: net.toString(),
    lotCount: lots.filter(l => l.instrument === instrument).length,
  }))

  const expectedLifecycle = effectiveFacts.length === 0 ? 'Planned' as const : 'Open' as const
  const findings: string[] = []
  if (input.storedLifecycle !== expectedLifecycle) findings.push('StoredLifecycleDisagreement')
  const lotsAgree = input.storedLots === undefined || (
    input.storedLots.length === lots.length &&
    input.storedLots.every((s, i) => s.executionId === lots[i].executionId && new Decimal(s.quantity).eq(lots[i].quantity))
  )
  if (!lotsAgree) findings.push('StoredLotDisagreement')

  return {
    ok: true,
    value: {
      tradeId: input.tradeId,
      effectiveFacts,
      positions,
      lots,
      closingLotMatches: [],
      realizedToDate: '0.00',
      expectedLifecycle,
      agreement: { lifecycle: !findings.includes('StoredLifecycleDisagreement'), lots: lotsAgree, findings },
    },
  }
}
