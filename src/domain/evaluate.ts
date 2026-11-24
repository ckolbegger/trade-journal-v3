import Decimal from 'decimal.js'
import { type CalculationResult, unavailable, value } from './calculation'
import type { Frame } from './market-frames'

// TradeAnalysis.evaluate — pure, deterministic interpretation of one derived
// Trade against one explicit exact-date observation frame.
export type TradeEvaluationInput = {
  tradeId: string
  plan: {
    underlying: string
    quantity: number
    entry: string
    stop: string
    target: string
    oneR: string
    baseline: string
  }
  positions: { instrument: string; netQuantity: string }[]
  lots: { instrument: string; quantity: string; basis: string }[]
  realizedToDate: string
  frame: Frame
}

export type TradeCondition = {
  id: string
  kind: 'Stop' | 'Target'
  status: 'Unbreached' | 'Crossed' | 'Unreached' | 'Reached' | 'NotVerifiable'
  detail: string
}

export type TradeEvaluation = {
  tradeId: string
  realizedToDate: CalculationResult<string>
  markedPnl: CalculationResult<string>
  ongoingRiskToStop: CalculationResult<string>
  worstCaseOngoingRisk: CalculationResult<string>
  incrementalReward: CalculationResult<string>
  maxIncrementalReward: CalculationResult<string>
  planR: { risk: CalculationResult<string>; reward: CalculationResult<string> }
  planBaseline: CalculationResult<string>
  oneR: CalculationResult<string>
  conditions: TradeCondition[]
  overrun: CalculationResult<string>
  coverage: { instrument: string; date: string; status: Frame['status'] }
}

const fixed = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)

export function evaluate(input: TradeEvaluationInput): TradeEvaluation {
  const { frame, plan } = input
  const instrument = frame.instrument
  const date = frame.date
  const base = {
    tradeId: input.tradeId,
    realizedToDate: value(input.realizedToDate),
    planBaseline: value(plan.baseline),
    oneR: value(plan.oneR),
    maxIncrementalReward: { kind: 'Unbounded' as const, direction: 'Above' as const, explanation: 'Long stock upside is unbounded.' },
    coverage: { instrument, date, status: frame.status },
  }

  if (frame.status !== 'Available' || frame.price === undefined) {
    const reason = frame.status === 'AcknowledgedUnavailable' ? 'ExpectedMarkAcknowledgedUnavailable' : 'ExpectedMarkMissing'
    return {
      ...base,
      markedPnl: unavailable(reason, instrument, date),
      ongoingRiskToStop: unavailable(reason, instrument, date),
      worstCaseOngoingRisk: unavailable(reason, instrument, date),
      incrementalReward: unavailable(reason, instrument, date),
      planR: { risk: unavailable(reason, instrument, date), reward: unavailable(reason, instrument, date) },
      overrun: unavailable(reason, instrument, date),
      conditions: [
        { id: 'stop-underlying', kind: 'Stop', status: 'NotVerifiable', detail: `No exact Mark for ${instrument} on ${date}.` },
        { id: 'target-underlying', kind: 'Target', status: 'NotVerifiable', detail: `No exact Mark for ${instrument} on ${date}.` },
      ],
    }
  }

  const mark = new Decimal(frame.price)
  const quantity = input.positions
    .filter(p => p.instrument === instrument)
    .reduce((sum, p) => sum.plus(p.netQuantity), new Decimal(0))
  const basis = input.lots
    .filter(l => l.instrument === instrument)
    .reduce((sum, l) => sum.plus(l.basis), new Decimal(0))
  const marked = quantity.times(mark).minus(basis)
  const stop = new Decimal(plan.stop)
  const target = new Decimal(plan.target)
  const oneR = new Decimal(plan.oneR)

  const risk = mark.gt(stop) ? quantity.times(mark.minus(stop)) : new Decimal(0)
  const overrun = mark.lt(stop) ? quantity.times(stop.minus(mark)) : new Decimal(0)
  const reward = mark.lt(target) ? quantity.times(target.minus(mark)) : new Decimal(0)
  const worstCase = quantity.times(mark)
  const planR = (d: Decimal) => oneR.gt(0) ? value(fixed(d.div(oneR))) : unavailable('NoPlanBaseline', instrument, date)

  return {
    ...base,
    markedPnl: value(fixed(marked)),
    ongoingRiskToStop: value(fixed(risk)),
    worstCaseOngoingRisk: value(fixed(worstCase)),
    incrementalReward: value(fixed(reward)),
    planR: { risk: planR(risk), reward: planR(reward) },
    overrun: value(fixed(overrun)),
    conditions: [
      {
        id: 'stop-underlying', kind: 'Stop',
        status: mark.lt(stop) ? 'Crossed' : 'Unbreached',
        detail: mark.lt(stop)
          ? `Stop ${fixed(stop)} is above the Mark ${fixed(mark)}.`
          : `Stop ${fixed(stop)} is below the Mark ${fixed(mark)}.`,
      },
      {
        id: 'target-underlying', kind: 'Target',
        status: mark.gte(target) ? 'Reached' : 'Unreached',
        detail: mark.gte(target)
          ? `Target ${fixed(target)} is at or below the Mark ${fixed(mark)}.`
          : `Target ${fixed(target)} is above the Mark ${fixed(mark)}.`,
      },
    ],
  }
}
