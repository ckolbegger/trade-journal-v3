import { assessPlan } from '../domain/assess-plan'
import { confirmPlan, type ConfirmPlanCommand, type ConfirmPlanResult } from '../domain/confirm-plan'
import { assessOptionPlan } from '../domain/option-plan'
import { parseOptionContract } from '../domain/option-contract'
import { confirmOptionPlan } from './option-controller'
import { openDb, repo, transaction } from '../persistence/db'
import type { Account, Institution } from '../domain/types'
import { plannedResultFrom, readPlannedTrades } from './trade-read'
import { messageFor } from './error-meaning'

export type PlanDraft = {
  accountId: string
  underlying: string
  quantity: string
  entry: string
  stop: string
  target: string
  thesis: string
  invalidation: string
  strategyId?: string
  optionKind?: 'Call' | 'Put'
  strike?: string
  expiration?: string
  multiplier?: string
}

export type PlanState = {
  screen: 'form' | 'list' | 'detail'
  error: string
  confirmed: ConfirmPlanResult['value'][]
  selected: ConfirmPlanResult['value'] | null
}

export const initialPlanState: PlanState = { screen: 'form', error: '', confirmed: [], selected: null }

export function previewPlan(draft: PlanDraft): { oneR: string; baseline: string; error: string } {
  // The live preview reflects only the Plan numbers; it is not a command and
  // must not require the reflection or a committed account.
  const optionId = draft.strategyId && draft.strategyId !== 'seed-long-stock' ? draft.strategyId : undefined
  if (optionId) {
    const parsed = parseOptionContract({
      underlying: draft.underlying, kind: draft.optionKind ?? '',
      strike: draft.strike ?? '', expiration: draft.expiration ?? '', multiplier: draft.multiplier ?? '',
    })
    if (!parsed.ok) return { oneR: '', baseline: '', error: '' }
    const assessed = assessOptionPlan({
      strategyId: optionId, contract: parsed.value, quantity: Number(draft.quantity),
      entry: draft.entry, stop: draft.stop, target: draft.target,
    })
    if (!assessed.ok) return { oneR: '', baseline: '', error: '' }
    return { oneR: assessed.value.oneR, baseline: assessed.value.baseline, error: '' }
  }
  const assessment = assessPlan({
    strategyId: 'seed-long-stock',
    underlying: draft.underlying,
    quantity: Number(draft.quantity),
    entry: draft.entry,
    stop: draft.stop,
    target: draft.target,
  })
  if (!assessment.ok) return { oneR: '', baseline: '', error: '' }
  return { oneR: assessment.value.oneR, baseline: assessment.value.baseline, error: '' }
}

function buildCommand(
  draft: PlanDraft,
  definitionRevision: string,
  economicTime: string,
  institutions: Institution[],
  strategy: { id: string; label: string; active: boolean; revision: string },
  account?: Account,
): ConfirmPlanCommand {
  const acct = account ?? { id: draft.accountId || 'acct-1', institutionId: 'inst-1', label: 'Main', active: true, revision: '1', history: [] }
  return {
    account: acct,
    strategy,
    plan: {
      strategyId: 'seed-long-stock',
      underlying: draft.underlying,
      quantity: Number(draft.quantity),
      entry: draft.entry,
      stop: draft.stop,
      target: draft.target,
    },
    reflection: { thesis: draft.thesis, invalidation: draft.invalidation },
    definitionRevision,
    economicTime,
  }
}

export async function confirmPlanFromDraft(
  draft: PlanDraft,
  accounts: Account[],
  institutions: Institution[],
): Promise<{ result?: ConfirmPlanResult['value']; error: string }> {
  const account = accounts.find(a => a.id === draft.accountId) ?? accounts[0]
  if (!account) return { error: 'Create an institution and account first.' }
  if (draft.strategyId && draft.strategyId !== 'seed-long-stock') {
    const parsed = parseOptionContract({
      underlying: draft.underlying, kind: draft.optionKind ?? '',
      strike: draft.strike ?? '', expiration: draft.expiration ?? '', multiplier: draft.multiplier ?? '',
    })
    if (!parsed.ok) return { error: messageFor(parsed.error) }
    const result = await confirmOptionPlan({
      account, definitionRevision: 'D1', strategyId: draft.strategyId, contract: parsed.value,
      quantity: Number(draft.quantity), entry: draft.entry, stop: draft.stop, target: draft.target,
      reflection: { thesis: draft.thesis, invalidation: draft.invalidation },
      economicTime: '2026-11-24T20:00:00Z', readiness: { outcome: 'Writable', passed: true, failedChecks: [], protection: { kind: 'BestEffort', reason: 'ui' } },
    })
    if (!result.ok) return { error: messageFor(result.error) }
    return { result: plannedResultFrom(result.value.trade, result.value.entry), error: '' }
  }
  const strategy = { id: 'seed-long-stock', label: 'Long Stock', active: true, revision: '1' }
  const result = confirmPlan(buildCommand(draft, 'D1', '2026-11-24T20:00:00Z', institutions, strategy, account))
  if (!result.ok) return { error: messageFor(result.error) }

  const db = await openDb()
  await transaction(db, ['trade', 'journal'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'trade', { id: result.value.trade.id, ...result.value.trade })
    await repo.putInTx(tx, 'journal', { id: `entry-${result.value.trade.id}`, ...result.value.entry })
  })
  return { result: result.value, error: '' }
}

export async function loadPlannedTrades(): Promise<ConfirmPlanResult['value'][]> {
  // Lifecycle membership and journal linkage are resolved by the canonical
  // Trade read, not by this controller.
  return readPlannedTrades(await openDb())
}
