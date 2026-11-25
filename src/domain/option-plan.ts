import Decimal from 'decimal.js'
import { canonicalInstrument, type OptionContract } from './option-contract'
import { resolveStrategyShape } from './strategy-shapes'
import type { Result } from './types'

export type OptionPlanInput = {
  strategyId: string
  contract: OptionContract
  quantity: number
  entry: string
  stop: string
  target: string
}

export type OptionPlanAssessment = {
  oneR: string
  originalPlannedRisk: string
  originalPlannedReward: string
  baseline: string
  contractInstrument: string
  plannedLeg: { contract: OptionContract; quantity: number; openingAction: 'Buy' | 'Sell' }
  management: { stop: string; target: string }
  evidenceRequirements: string[]
}

export type OptionPlanIssue =
  | 'StrategyShape' | 'IncompleteLeg' | 'InvalidNumber' | 'NonPositiveRisk' | 'NonPositiveBaseline'

const fixed = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)

// TradeAnalysis.assessPlan for one exact option leg. Management boundaries are
// option premiums, so one R is the monetary boundary times the exact contract
// multiplier and contract quantity. No theoretical option price is produced.
export function assessOptionPlan(input: OptionPlanInput): Result<OptionPlanAssessment, { issues: OptionPlanIssue[] }> {
  const issues: OptionPlanIssue[] = []
  const shape = resolveStrategyShape(input.strategyId)
  if (!shape.ok || shape.value.expectedKind !== input.contract.kind) issues.push('StrategyShape')
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) issues.push('IncompleteLeg')

  let entry: Decimal, stop: Decimal, target: Decimal
  try {
    entry = new Decimal(input.entry)
    stop = new Decimal(input.stop)
    target = new Decimal(input.target)
    if (!entry.isFinite() || !stop.isFinite() || !target.isFinite()) throw new Error('non-finite')
  } catch {
    issues.push('InvalidNumber')
    return { ok: false, error: { issues } }
  }

  const multiplier = new Decimal(input.contract.multiplier)
  const contracts = new Decimal(input.quantity)
  const risk = entry.minus(stop).abs().times(multiplier).times(contracts)
  const reward = target.minus(entry).abs().times(multiplier).times(contracts)
  if (input.quantity > 0) {
    if (risk.lte(0)) issues.push('NonPositiveRisk')
    if (reward.lte(0)) issues.push('NonPositiveBaseline')
  }
  if (issues.length) return { ok: false, error: { issues: [...new Set(issues)] } }

  return {
    ok: true,
    value: {
      oneR: fixed(risk),
      originalPlannedRisk: fixed(risk),
      originalPlannedReward: fixed(reward),
      baseline: reward.div(risk).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
      contractInstrument: canonicalInstrument(input.contract),
      plannedLeg: {
        contract: input.contract,
        quantity: input.quantity,
        ...(shape.ok ? { openingAction: shape.value.openingAction } : { openingAction: 'Buy' as const }),
      },
      management: { stop: fixed(stop), target: fixed(target) },
      evidenceRequirements: ['executions'],
    },
  }
}
