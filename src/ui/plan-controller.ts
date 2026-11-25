import { assessPlan } from '../domain/assess-plan'
import { confirmPlan, type ConfirmPlanCommand, type ConfirmPlanResult } from '../domain/confirm-plan'
import { assessOptionPlan } from '../domain/option-plan'
import { parseOptionContract } from '../domain/option-contract'
import { confirmOptionPlan } from './option-controller'
import { openDb, repo, transaction } from '../persistence/db'
import type { Account, Institution } from '../domain/types'

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
    if (!parsed.ok) return { error: parsed.error.issues.join(', ') }
    const result = await confirmOptionPlan({
      account, definitionRevision: 'D1', strategyId: draft.strategyId, contract: parsed.value,
      quantity: Number(draft.quantity), entry: draft.entry, stop: draft.stop, target: draft.target,
      reflection: { thesis: draft.thesis, invalidation: draft.invalidation },
      economicTime: '2026-11-24T20:00:00Z', readiness: { outcome: 'Writable', passed: true, failedChecks: [], protection: { kind: 'BestEffort', reason: 'ui' } },
    })
    if (!result.ok) return { error: result.error.kind === 'Validation' ? result.error.issues.join(', ') : 'Writes are disabled.' }
    return {
      result: {
        trade: {
          id: result.value.trade.id, lifecycle: 'Planned',
          plan: result.value.trade.plan as ConfirmPlanResult['value']['trade']['plan'],
          economicTime: result.value.trade.economicTime,
        },
        entry: result.value.entry,
        revisions: { trade: '1', entry: '1', catalog: '1' },
        postCommit: { trade: result.value.trade, entry: result.value.entry },
        affectedScopes: [],
      },
      error: '',
    }
  }
  const strategy = { id: 'seed-long-stock', label: 'Long Stock', active: true, revision: '1' }
  const result = confirmPlan(buildCommand(draft, 'D1', '2026-11-24T20:00:00Z', institutions, strategy, account))
  if (!result.ok) return { error: result.error.issues.join(', ') }

  const db = await openDb()
  await transaction(db, ['trade', 'journal'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'trade', { id: result.value.trade.id, ...result.value.trade })
    await repo.putInTx(tx, 'journal', { id: `entry-${result.value.trade.id}`, ...result.value.entry })
  })
  return { result: result.value, error: '' }
}

export async function loadPlannedTrades(): Promise<ConfirmPlanResult['value'][]> {
  const db = await openDb()
  // The trade store holds the flattened Trade projection (id + trade fields),
  // written atomically with the Entry in the journal store.
  const rows = await repo.all<Record<string, unknown> & { id: string }>(db, 'trade')
  const result: ConfirmPlanResult['value'][] = []
  for (const r of rows) {
    if (!r.plan || r.lifecycle !== 'Planned') continue
    const entry = (await repo.get<ConfirmPlanResult['value']['entry']>(db, 'journal', `entry-${r.id}`)) ?? { snapshot: {} }
    result.push({
      trade: {
        id: r.id,
        lifecycle: (r.lifecycle ?? 'Planned') as 'Planned',
        plan: r.plan as ConfirmPlanResult['value']['trade']['plan'],
        economicTime: String(r.economicTime ?? ''),
      },
      entry,
      revisions: { trade: '1', entry: '1', catalog: '1' },
      postCommit: { trade: r, entry: {} },
      affectedScopes: [],
    })
  }
  return result
}
