import { openDb, repo, transaction, type Db } from '../persistence/db'
import { guardWrite } from '../domain/write-gate'
import { resolveExpectedMarkDate } from '../domain/calendar'
import { queryOpenTrades, type StoredOpenTrade } from '../domain/open-views'
import { evaluateOpenTrade } from './market-controller'
import { resolveFrames } from '../domain/market-frames'
import { replay, type ReplayResult } from '../domain/replay'
import type { Frame } from '../domain/market-frames'
import type { TradeEvaluation } from '../domain/evaluate'
import type { ObservationRecord } from '../domain/market-data'
import {
  applyActionOutcome, dailyActionKey, prepareAction, unsavedActionView,
  type ActionOutcome, type DailyActionForm,
} from '../domain/daily-action'
import {
  deriveCompletion, rankTrades, type AttentionResult, type CompletionResult,
} from '../domain/review-completion'
import { orderTaskFamilies, type TaskFamily } from '../domain/review-order'
import type { CloseReviewForm } from '../domain/close-review'
import { answerDeferredCloseReview } from './close-review-controller'
import type { ReadinessEvidence, Result, RuntimeNotWritable } from '../domain/types'

// Due means Outstanding with a next-Review date at or before the cutoff. Older
// Debts without a due date stay due for backward compatibility.
export function isDebtDueAt(row: Record<string, unknown>, reviewDate: string): boolean {
  if (row.kind !== 'Debt' || row.status === 'Settled') return false
  const dueAt = typeof row.dueAt === 'string' ? row.dueAt : undefined
  return !dueAt || dueAt <= reviewDate
}

export type ReviewItem = {
  trade: StoredOpenTrade
  evaluation: TradeEvaluation
  frame: Frame
  replay: ReplayResult
  action?: ActionOutcome
  attention: AttentionResult
}

export type ReviewView = {
  reviewDate: string
  tasks: TaskFamily[]
  items: ReviewItem[]
  completion: CompletionResult
  snapshot: { digest: string; revision: string }
  missingMarks: string[]
  dueDebt: { id: string; obligationKey: string; route?: string }[]
  settlementDue: { instrument: string; tradeId: string }[]
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `fnv1a-${hash.toString(16).padStart(8, '0')}`
}

function numeric(result: TradeEvaluation['ongoingRiskToStop']): number | 'Unbounded' | undefined {
  if (result.kind === 'Value') return Number(result.value)
  if (result.kind === 'Unbounded') return 'Unbounded'
  return undefined
}

export async function openReview(now: Date, db?: Db): Promise<ReviewView> {
  const handle = db ?? await openDb()
  const reviewDate = resolveExpectedMarkDate(now)
  const trades = await queryOpenTrades(handle)
  const records = await repo.all<ObservationRecord>(handle, 'market')
  const journal = await repo.all<Record<string, unknown> & { id: string }>(handle, 'journal')
  const from = new Date(`${reviewDate}T12:00:00Z`)
  from.setUTCDate(from.getUTCDate() - 5)

  const items: ReviewItem[] = []
  const missingMarks: string[] = []
  const dueDebt: ReviewView['dueDebt'] = []
  for (const row of journal) {
    if (isDebtDueAt(row, reviewDate)) dueDebt.push({
      id: row.id, obligationKey: String(row.obligationKey ?? ''), route: row.settlementRoute ? String(row.settlementRoute) : undefined,
    })
  }

  for (const trade of trades) {
    const evaluated = await evaluateOpenTrade(trade, handle, now)
    const frames = resolveFrames({
      instrument: trade.plan.underlying,
      fromDate: from.toISOString().slice(0, 10), toDate: reviewDate, now, records,
    }).frames
    const episodes = replay({ tradeId: trade.id, stop: trade.plan.stop, frames })
    const action = await repo.get<ActionOutcome>(handle, 'journal', dailyActionKey(trade.id, reviewDate))
    const risk = numeric(evaluated.evaluation.ongoingRiskToStop)
    const reward = numeric(evaluated.evaluation.incrementalReward)
    const attention = rankTrades([{
      tradeId: trade.id,
      markStatus: evaluated.frame.status,
      stopCrossed: evaluated.evaluation.conditions.some(c => c.id === 'stop-underlying' && c.status === 'Crossed'),
      risk, reward,
      lastActivity: trade.economicTime,
    }])[0]
    if (evaluated.frame.status === 'Missing') missingMarks.push(trade.plan.underlying)
    items.push({ trade, evaluation: evaluated.evaluation, frame: evaluated.frame, replay: episodes, action, attention })
  }

  // Stock-only D5 has no settlement facts; options arrive with D8/D10.
  const settlementDue: ReviewView['settlementDue'] = []
  const completion = deriveCompletion({
    missingMarks, dueDebt: dueDebt.map(d => d.id), settlementDue,
    unreconciledEpisodes: items.flatMap(i => i.replay.episodes.map(e => e.fingerprint)),
    integrityBlocked: false,
    trades: items.map(i => ({
      tradeId: i.trade.id, actionSaved: !!i.action, markStatus: i.frame.status, instrument: i.trade.plan.underlying,
    })),
  })
  const tasks = orderTaskFamilies({
    missingMarks, dueDebt: dueDebt.map(d => d.id),
    settlementDue: settlementDue.map(s => s.instrument), trades: items.map(i => i.trade.id),
  })
  const digest = fnv1a(JSON.stringify({
    reviewDate,
    items: items.map(i => [i.trade.id, i.trade.revision, i.frame.status, i.frame.price ?? null, i.action?.revision ?? null]),
    debt: dueDebt.map(d => d.id),
  }))
  return {
    reviewDate, tasks, items, completion,
    snapshot: { digest, revision: '1' },
    missingMarks, dueDebt, settlementDue,
  }
}

export type SaveError =
  | { kind: 'RuntimeNotWritable'; runtimeNotWritable: RuntimeNotWritable }
  | { kind: 'ReviewChanged'; refreshed: ReviewView }
  | { kind: 'MarkMissing' }
  | { kind: 'Validation'; issues: string[] }
  | { kind: 'Conflict'; issue: string }

export type SaveTradeActionRequest = {
  tradeId: string
  reviewDate: string
  definitionRevision: string
  form: DailyActionForm
  expectedDigest: string
  expectedTradeRevision: string
  expectedEntryRevision?: string
  readiness: ReadinessEvidence
  now?: Date
}

export type SaveResult = {
  action: ActionOutcome
  occurrences: { fingerprint: string; kind: string; start: string; end?: string }[]
  completion: CompletionResult
  nextStep: string
}

export async function saveTradeAction(
  request: SaveTradeActionRequest,
  db?: Db,
): Promise<Result<SaveResult, SaveError>> {
  const gate = guardWrite(request.readiness, 'DailyReview.save')
  if (!gate.ok) return { ok: false, error: { kind: 'RuntimeNotWritable', runtimeNotWritable: gate.error.runtimeNotWritable } }

  const handle = db ?? await openDb()
  const now = request.now ?? new Date(`${request.reviewDate}T17:00:00Z`)
  const view = await openReview(now, handle)
  if (view.snapshot.digest !== request.expectedDigest) return { ok: false, error: { kind: 'ReviewChanged', refreshed: view } }

  const item = view.items.find(i => i.trade.id === request.tradeId)
  if (!item) return { ok: false, error: { kind: 'Validation', issues: ['NotEligible'] } }
  if (item.frame.status === 'Missing') return { ok: false, error: { kind: 'MarkMissing' } }

  const key = dailyActionKey(request.tradeId, request.reviewDate)
  const prepared = prepareAction(
    request.form, request.definitionRevision, key, request.tradeId,
    request.reviewDate, `${request.reviewDate}T20:00:00Z`, new Date().toISOString(),
  )
  if (!prepared.ok) return { ok: false, error: { kind: 'Validation', issues: prepared.error.issues } }
  const applied = applyActionOutcome(item.action, prepared.value, key, request.expectedEntryRevision)
  if (!applied.ok) return { ok: false, error: { kind: 'Conflict', issue: applied.error.issue } }

  const recorded = (item.trade.deviations ?? []) as { fingerprint: string }[]
  const occurrences = item.replay.episodes
    .filter(e => !recorded.some(d => d.fingerprint === e.fingerprint))
    .map(e => ({ fingerprint: e.fingerprint, kind: 'StopDiscipline', start: e.start, ...(e.end ? { end: e.end } : {}) }))

  await transaction(handle, ['journal', 'trade'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'journal', { id: key, ...applied.value.entry })
    if (occurrences.length) {
      await repo.putInTx(tx, 'trade', {
        id: item.trade.id,
        ...item.trade,
        revision: String(Number(item.trade.revision) + 1),
        deviations: [...recorded, ...occurrences],
      })
    }
  })

  const completion = deriveCompletion({
    missingMarks: view.missingMarks.filter(m => m !== item.trade.plan.underlying),
    dueDebt: view.dueDebt.map(d => d.id), settlementDue: view.settlementDue,
    unreconciledEpisodes: [], integrityBlocked: false,
    trades: view.items.map(i => ({
      tradeId: i.trade.id, actionSaved: i.trade.id === request.tradeId || !!i.action,
      markStatus: i.frame.status, instrument: i.trade.plan.underlying,
    })),
  })
  return {
    ok: true,
    value: {
      action: applied.value.entry,
      occurrences,
      completion,
      nextStep: completion.state === 'Complete' ? 'Review complete' : 'Continue the Trade walk',
    },
  }
}

export type ResolveDebtRequest = {
  debtId: string
  form: { text?: string; answers?: CloseReviewForm }
  definitionRevision?: string
  authoredAt?: string
  readiness: ReadinessEvidence
}

export async function resolveReviewDebt(
  request: ResolveDebtRequest,
  db?: Db,
): Promise<Result<{ entryId: string; debtId: string }, { kind: 'RuntimeNotWritable' | 'NeedsTradeWorkflow' | 'NotFound' | 'Validation' | 'Conflict' }>> {
  const gate = guardWrite(request.readiness, 'DailyReview.save')
  if (!gate.ok) return { ok: false, error: { kind: 'RuntimeNotWritable' } }
  const handle = db ?? await openDb()
  const debt = await repo.get<Record<string, unknown> & { id: string }>(handle, 'journal', request.debtId)
  if (!debt) return { ok: false, error: { kind: 'NotFound' } }
  if (String(debt.settlementRoute ?? '').includes('TradeWorkflows') ||
      String(debt.obligationKey ?? '').startsWith('ManagementRevision:')) {
    return { ok: false, error: { kind: 'NeedsTradeWorkflow' } }
  }
  if (String(debt.obligationKey ?? '').startsWith('CloseReview:')) {
    if (!request.form.answers) return { ok: false, error: { kind: 'Validation' } }
    const answered = await answerDeferredCloseReview({
      obligationKey: String(debt.obligationKey),
      form: request.form.answers,
      definitionRevision: request.definitionRevision ?? String((debt.snapshot as { definitionRevision?: string } | undefined)?.definitionRevision ?? 'D1'),
      authoredAt: request.authoredAt ?? new Date().toISOString(),
      readiness: request.readiness,
    }, handle)
    if (!answered.ok) return { ok: false, error: { kind: answered.error.kind === 'Conflict' ? 'Conflict' : 'Validation' } }
    return { ok: true, value: { entryId: answered.value.outcome.id, debtId: request.debtId } }
  }
  if (!request.form.text?.trim()) return { ok: false, error: { kind: 'Validation' } }
  const entryId = `entry-${request.debtId}`
  await transaction(handle, ['journal'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'journal', {
      id: entryId, kind: 'Entry', source: 'Journal', obligationKey: debt.obligationKey,
      snapshot: { answers: { text: request.form.text } }, settlesDebt: request.debtId,
    })
    await repo.putInTx(tx, 'journal', { ...debt, status: 'Settled' })
  })
  return { ok: true, value: { entryId, debtId: request.debtId } }
}

export function newActionForm(): DailyActionForm {
  return unsavedActionView()
}
