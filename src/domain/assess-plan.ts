import Decimal from 'decimal.js'
import type { Result } from './types'

export type PlanInput = {
  strategyId: string
  underlying: string
  quantity: number
  entry: string
  stop: string
  target: string
}

export type PlanAssessment = {
  oneR: string
  originalPlannedRisk: string
  originalPlannedReward: string
  baseline: string
  evidenceRequirements: string[]
}

export type PlanIssue = 'StrategyShape' | 'NonPositiveRisk' | 'InvalidNumber' | 'IncompleteLeg'

export function assessPlan(input: PlanInput): Result<PlanAssessment, { issues: PlanIssue[] }> {
  const issues: PlanIssue[] = []
  if (input.strategyId !== 'seed-long-stock') issues.push('StrategyShape')
  if (!input.underlying || !Number.isInteger(input.quantity) || input.quantity <= 0) issues.push('IncompleteLeg')

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

  const risk = entry.minus(stop).times(input.quantity)
  const reward = target.minus(entry).times(input.quantity)
  if (risk.lte(0) || !risk.isFinite()) issues.push('NonPositiveRisk')

  if (issues.length) return { ok: false, error: { issues } }

  const fixed = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
  return {
    ok: true,
    value: {
      oneR: fixed(risk),
      originalPlannedRisk: fixed(risk),
      originalPlannedReward: fixed(reward),
      baseline: reward.div(risk).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
      evidenceRequirements: ['executions'],
    },
  }
}
