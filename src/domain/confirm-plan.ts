import { assessPlan, type PlanInput } from './assess-plan'
import { preparePlanReflection } from './plan-reflection'
import type { Result } from './types'

type Account = { id: string; institutionId: string; label: string; active: boolean; revision: string; history: unknown[] }
type Strategy = { id: string; label: string; active: boolean; revision: string }

export type ConfirmPlanCommand = {
  account: Account
  strategy: Strategy
  plan: PlanInput
  reflection: { thesis: string; invalidation: string; conviction?: number; emotion?: string }
  definitionRevision: string
  economicTime: string
  accountRevision?: string
}

export type ConfirmPlanResult = {
  trade: {
    id: string
    lifecycle: 'Planned'
    plan: { oneR: string; baseline: string; underlying: string; quantity: number; entry: string; stop: string; target: string }
    economicTime: string
  }
  entry: { snapshot: Record<string, unknown> }
  revisions: { trade: string; entry: string; catalog: string }
  postCommit: { trade: unknown; entry: unknown }
  affectedScopes: string[]
}

export function confirmPlan(command: ConfirmPlanCommand): Result<ConfirmPlanResult, { issues: string[] }> {
  const issues: string[] = []

  const expectedAccountRevision = command.accountRevision ?? command.account.revision
  if (command.account.revision !== expectedAccountRevision) issues.push('StaleAccount')
  if (!command.account.active) issues.push('InactiveAccount')
  if (!command.strategy.active || command.strategy.id !== 'seed-long-stock') issues.push('InactiveStrategy')

  const assessment = assessPlan(command.plan)
  if (!assessment.ok) issues.push(...assessment.error.issues)

  const reflection = preparePlanReflection(command.reflection, command.definitionRevision)
  if (!reflection.ok) issues.push(...reflection.error.issues)

  if (issues.length) return { ok: false, error: { issues } }

  const id = `trade-${command.plan.underlying.toLowerCase()}-${command.economicTime.slice(0, 10)}`
  const trade = {
    id,
    lifecycle: 'Planned' as const,
    plan: {
      oneR: assessment.value.oneR,
      baseline: assessment.value.baseline,
      underlying: command.plan.underlying,
      quantity: command.plan.quantity,
      entry: command.plan.entry,
      stop: command.plan.stop,
      target: command.plan.target,
    },
    economicTime: command.economicTime,
  }
  const entry = reflection.value

  return {
    ok: true,
    value: {
      trade,
      entry,
      revisions: { trade: '1', entry: '1', catalog: command.account.revision },
      postCommit: { trade, entry },
      affectedScopes: ['trade-list', `trade:${id}`, 'journal-timeline'],
    },
  }
}
