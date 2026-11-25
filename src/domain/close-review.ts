import { resolveExpectedMarkDate } from './calendar'
import type { Result } from './types'

// Journal.getDefinitions(Close Review) — exact frozen initial definition.
export type Prompt = { id: string; role: string; required: boolean; kind: string; options?: string[] }

export const CLOSE_REVIEW_DEFINITION = {
  type: 'Close Review',
  revision: 'D1',
  prompts: [
    { id: 'takeAgain', role: 'TakeAgain', required: true, kind: 'SingleSelect',
      options: ['Yes, as planned', 'Yes, with changes', 'No', 'Unsure'] },
    { id: 'workedAndDidNot', role: 'WorkedAndDidNot', required: false, kind: 'Text' },
    { id: 'keyLesson', role: 'KeyLesson', required: false, kind: 'Text' },
  ] satisfies Prompt[],
}

export type CloseReviewForm = { takeAgain: string; workedAndDidNot?: string; keyLesson?: string }
export type CloseReviewDisposition =
  | { kind: 'Complete'; form: CloseReviewForm }
  | { kind: 'Decline'; reason?: string }
  | { kind: 'Defer' }

export type CloseReviewCommand = {
  tradeId: string
  definitionRevision: string
  economicTime: string
  authoredAt?: string
  disposition: CloseReviewDisposition
}

type Anchor = { kind: 'Trade'; tradeId: string }
type Origin = { kind: 'TradeClose'; tradeId: string }
export type CloseReviewSnapshot = {
  definitionRevision: string
  definitionType?: string
  prompts: Prompt[]
  answers?: Record<string, string>
  source?: string
  anchor?: Anchor
  origin?: Origin
  moment?: string
  authoredAt?: string
  dueAt?: string
}

export type CloseReviewOutcome =
  | {
      kind: 'Entry'; id: string; obligationKey: string; revision: string; status: 'Saved'
      source: string; definitionRevision: string
      snapshot: CloseReviewSnapshot; settlesDebtId?: string; debtSnapshot?: CloseReviewSnapshot
    }
  | { kind: 'JournalDecline'; id: string; obligationKey: string; reason?: string; origin: Origin; status: 'Declined' }
  | {
      kind: 'Debt'; id: string; obligationKey: string; status: 'Outstanding'
      snapshot: CloseReviewSnapshot; anchor: Anchor; origin: Origin
      dueSemantics: 'DueAtNextDailyReview'; dueAt: string; settlementRoute: string
    }

export function closeReviewObligationKey(tradeId: string): string {
  return `CloseReview:${tradeId}`
}

// The next Review after a close reviews the session the close belongs to.
export function nextReviewDate(economicTime: string): string {
  return resolveExpectedMarkDate(new Date(economicTime))
}

function answersFor(form: CloseReviewForm, prompts: Prompt[]): Record<string, string> {
  const answers: Record<string, string> = {}
  for (const prompt of prompts) {
    const value = form[prompt.id as keyof CloseReviewForm]
    if (typeof value === 'string' && value.trim()) answers[prompt.role] = value
  }
  return answers
}

function validateComplete(form: CloseReviewForm, prompts: Prompt[], definitionRevision: string): string[] {
  const issues: string[] = []
  if (definitionRevision !== CLOSE_REVIEW_DEFINITION.revision) issues.push('DefinitionRevision')
  for (const prompt of prompts.filter(p => p.required)) {
    const value = form[prompt.id as keyof CloseReviewForm]
    if (typeof value !== 'string' || !value.trim()) issues.push(prompt.role)
    else if (prompt.options && !prompt.options.includes(value)) issues.push(prompt.role)
  }
  return issues
}

export function prepareCloseReview(
  command: CloseReviewCommand,
): Result<CloseReviewOutcome, { issues: string[] }> {
  const obligationKey = closeReviewObligationKey(command.tradeId)
  const anchor: Anchor = { kind: 'Trade', tradeId: command.tradeId }
  const origin: Origin = { kind: 'TradeClose', tradeId: command.tradeId }

  if (command.disposition.kind === 'Decline') {
    return {
      ok: true,
      value: {
        kind: 'JournalDecline', id: `decline-${obligationKey}`, obligationKey,
        reason: command.disposition.reason, origin, status: 'Declined',
      },
    }
  }

  if (command.disposition.kind === 'Defer') {
    if (command.definitionRevision !== CLOSE_REVIEW_DEFINITION.revision) {
      return { ok: false, error: { issues: ['DefinitionRevision'] } }
    }
    return {
      ok: true,
      value: {
        kind: 'Debt', id: `debt-${obligationKey}`, obligationKey, status: 'Outstanding',
        snapshot: {
          definitionRevision: command.definitionRevision,
          definitionType: CLOSE_REVIEW_DEFINITION.type,
          prompts: CLOSE_REVIEW_DEFINITION.prompts,
          dueAt: nextReviewDate(command.economicTime),
        },
        anchor, origin,
        dueSemantics: 'DueAtNextDailyReview',
        dueAt: nextReviewDate(command.economicTime),
        settlementRoute: 'Journal.save(ResolveDebt)',
      },
    }
  }

  const issues = validateComplete(command.disposition.form, CLOSE_REVIEW_DEFINITION.prompts, command.definitionRevision)
  if (issues.length) return { ok: false, error: { issues } }

  return {
    ok: true,
    value: {
      kind: 'Entry', id: `entry-${obligationKey}`, obligationKey, revision: '1', status: 'Saved',
      source: 'Trade Close', definitionRevision: command.definitionRevision,
      snapshot: {
        definitionRevision: command.definitionRevision,
        definitionType: CLOSE_REVIEW_DEFINITION.type,
        prompts: CLOSE_REVIEW_DEFINITION.prompts,
        answers: answersFor(command.disposition.form, CLOSE_REVIEW_DEFINITION.prompts),
        source: 'Trade Close', anchor, origin,
        moment: command.economicTime,
        authoredAt: command.authoredAt ?? new Date().toISOString(),
      },
    },
  }
}

export function applyCloseReviewOutcome(
  current: CloseReviewOutcome | undefined,
  prepared: CloseReviewOutcome,
  attemptId: string,
  expectedRevision?: string,
): Result<{ outcome: CloseReviewOutcome; revision: string; attemptId: string }, { issue: 'ObligationAlreadySettled' | 'StaleRevision' }> {
  if (current && expectedRevision !== undefined && current.kind === 'Entry' && current.revision !== expectedRevision) {
    return { ok: false, error: { issue: 'StaleRevision' } }
  }
  if (current) return { ok: false, error: { issue: 'ObligationAlreadySettled' } }
  return { ok: true, value: { outcome: prepared, revision: '1', attemptId } }
}

// Answer a deferred Debt against the snapshot it carried when created, never
// against a later definition revision (AC-JOUR-004).
export function answerCloseReviewDebt(
  debt: Extract<CloseReviewOutcome, { kind: 'Debt' }>,
  form: CloseReviewForm,
  authoredAt: string,
): Result<CloseReviewOutcome, { issues: string[] }> {
  const issues = validateComplete(form, debt.snapshot.prompts, debt.snapshot.definitionRevision)
  if (issues.length) return { ok: false, error: { issues } }
  return {
    ok: true,
    value: {
      kind: 'Entry', id: `entry-${debt.obligationKey}`, obligationKey: debt.obligationKey,
      revision: '1', status: 'Saved', source: 'Trade Close',
      definitionRevision: debt.snapshot.definitionRevision,
      snapshot: {
        definitionRevision: debt.snapshot.definitionRevision,
        definitionType: debt.snapshot.definitionType,
        prompts: debt.snapshot.prompts,
        answers: answersFor(form, debt.snapshot.prompts),
        source: 'Trade Close', anchor: debt.anchor, origin: debt.origin,
        moment: debt.dueAt, authoredAt,
      },
      settlesDebtId: debt.id,
      debtSnapshot: debt.snapshot,
    },
  }
}

// Voiding the sole Entry that settled a Debt reopens that same Debt.
export function reopenCloseReviewDebt(
  outcome: CloseReviewOutcome,
  voidedEntryId: string,
): CloseReviewOutcome {
  if (outcome.kind !== 'Entry' || outcome.settlesDebtId !== voidedEntryId || !outcome.debtSnapshot) return outcome
  const snapshot = outcome.debtSnapshot
  return {
    kind: 'Debt',
    id: outcome.settlesDebtId,
    obligationKey: outcome.obligationKey,
    status: 'Outstanding',
    snapshot,
    anchor: snapshot.anchor ?? { kind: 'Trade', tradeId: outcome.obligationKey.slice('CloseReview:'.length) },
    origin: snapshot.origin ?? { kind: 'TradeClose', tradeId: outcome.obligationKey.slice('CloseReview:'.length) },
    dueSemantics: 'DueAtNextDailyReview',
    dueAt: snapshot.dueAt ?? '',
    settlementRoute: 'Journal.save(ResolveDebt)',
  }
}
