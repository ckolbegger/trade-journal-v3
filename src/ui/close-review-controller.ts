import { openDb, repo, transaction, type Db } from '../persistence/db'
import { guardWrite } from '../domain/write-gate'
import {
  answerCloseReviewDebt, applyCloseReviewOutcome, closeReviewObligationKey,
  prepareCloseReview, type CloseReviewDisposition, type CloseReviewForm, type CloseReviewOutcome,
} from '../domain/close-review'
import type { ReadinessEvidence, Result, RuntimeNotWritable } from '../domain/types'
import { readObligation } from './obligation-read'

export type SaveCloseReviewRequest = {
  tradeId: string
  definitionRevision: string
  economicTime: string
  authoredAt?: string
  disposition: CloseReviewDisposition
  readiness: ReadinessEvidence
  expectedObligationRevision?: string
}

export type SaveCloseReviewError =
  | { kind: 'RuntimeNotWritable'; runtimeNotWritable: RuntimeNotWritable }
  | { kind: 'Validation'; issues: string[] }
  | { kind: 'Conflict'; issue: string }

export type SaveCloseReviewResult = {
  outcome: CloseReviewOutcome
  revisions: { journal: string }
  postCommit: { outcome: CloseReviewOutcome }
}

async function commit(handle: Db, outcome: CloseReviewOutcome): Promise<void> {
  await transaction(handle, ['journal'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'journal', { id: outcome.id, ...outcome })
    if (outcome.kind === 'Entry' && outcome.settlesDebtId) {
      const debt = await repo.getInTx<Record<string, unknown> & { id: string }>(tx, 'journal', outcome.settlesDebtId)
      if (debt) await repo.putInTx(tx, 'journal', { ...debt, status: 'Settled' })
    }
  })
}

export async function saveCloseReview(
  request: SaveCloseReviewRequest,
  db?: Db,
): Promise<Result<SaveCloseReviewResult, SaveCloseReviewError>> {
  const gate = guardWrite(request.readiness, 'Journal.save(CloseReview)')
  if (!gate.ok) {
    return { ok: false, error: { kind: 'RuntimeNotWritable', runtimeNotWritable: gate.error.runtimeNotWritable } }
  }
  const handle = db ?? await openDb()
  const obligationKey = closeReviewObligationKey(request.tradeId)
  const prepared = prepareCloseReview({
    tradeId: request.tradeId,
    definitionRevision: request.definitionRevision,
    economicTime: request.economicTime,
    authoredAt: request.authoredAt,
    disposition: request.disposition,
  })
  if (!prepared.ok) return { ok: false, error: { kind: 'Validation', issues: prepared.error.issues } }

  const current = (await readObligation(handle, obligationKey)).effective
  const applied = applyCloseReviewOutcome(current, prepared.value, prepared.value.id, request.expectedObligationRevision)
  if (!applied.ok) return { ok: false, error: { kind: 'Conflict', issue: applied.error.issue } }

  await commit(handle, applied.value.outcome)
  return {
    ok: true,
    value: {
      outcome: applied.value.outcome,
      revisions: { journal: applied.value.revision },
      postCommit: { outcome: applied.value.outcome },
    },
  }
}

export type AnswerDeferredCloseReviewRequest = {
  obligationKey: string
  form: CloseReviewForm
  definitionRevision: string
  authoredAt: string
  readiness: ReadinessEvidence
}

export async function answerDeferredCloseReview(
  request: AnswerDeferredCloseReviewRequest,
  db?: Db,
): Promise<Result<SaveCloseReviewResult, SaveCloseReviewError>> {
  const gate = guardWrite(request.readiness, 'Journal.save(CloseReview)')
  if (!gate.ok) {
    return { ok: false, error: { kind: 'RuntimeNotWritable', runtimeNotWritable: gate.error.runtimeNotWritable } }
  }
  const handle = db ?? await openDb()
  const obligation = await readObligation(handle, request.obligationKey)
  const debt = obligation.debt
  if (!debt || debt.kind !== 'Debt') {
    return { ok: false, error: { kind: 'Validation', issues: ['NotFound'] } }
  }
  const prepared = answerCloseReviewDebt(debt, request.form, request.authoredAt)
  if (!prepared.ok) return { ok: false, error: { kind: 'Validation', issues: prepared.error.issues } }

  // An answered Debt is itself the current outcome; only an existing Entry or
  // decline would make this a duplicate.
  if (obligation.effective && obligation.effective.kind !== 'Debt') {
    return { ok: false, error: { kind: 'Conflict', issue: 'ObligationAlreadySettled' } }
  }
  await commit(handle, prepared.value)
  return {
    ok: true,
    value: {
      outcome: prepared.value,
      revisions: { journal: '1' },
      postCommit: { outcome: prepared.value },
    },
  }
}
