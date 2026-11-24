import type { Result } from './types'

// Journal.prepareEffects for the one Position Change Reflection obligation.
export type Prompt = { id: string; role: string; required: boolean; kind: string; options?: string[] }

export const POSITION_CHANGE_REFLECTION_DEFINITION = {
  type: 'Position Change Reflection',
  revision: 'D1',
  prompts: [
    { id: 'decisionMode', role: 'DecisionMode', required: true, kind: 'SingleSelect',
      options: ['As Planned', 'Deliberate Adjustment', 'Reactive', 'Externally Imposed'] },
    { id: 'primaryEmotion', role: 'PrimaryEmotion', required: true, kind: 'SingleSelect',
      options: ['Calm', 'Eager', 'Anxious', 'FOMO', 'Revenge', 'Relieved', 'Frustrated', 'Other'] },
    { id: 'decisionConfidence', role: 'DecisionConfidence', required: true, kind: 'Scale' },
    { id: 'note', role: 'Note', required: false, kind: 'Text' },
  ] satisfies Prompt[],
}

export type ReflectionForm = { decisionMode: string; primaryEmotion: string; decisionConfidence: number; note?: string }
export type ReflectionDisposition =
  | { kind: 'Complete'; form: ReflectionForm }
  | { kind: 'Decline'; reason?: string }
  | { kind: 'Defer' }

export type ReflectionCommand = {
  positionChangeId: string
  tradeId: string
  definitionRevision: string
  disposition: ReflectionDisposition
}

export type DebtSnapshot = { definitionRevision: string; prompts: Prompt[]; definitionType?: string }
type Anchor = { kind: 'Trade'; tradeId: string }
type Origin = { kind: 'PositionChange'; id: string }

export type ReflectionOutcome =
  | {
      kind: 'Entry'
      obligationKey: string
      snapshot: {
        definitionRevision: string
        answers: Record<string, string | number>
        source: string
        anchor: Anchor
        origin: Origin
      }
      settledDebtId?: string
      debtSnapshot?: DebtSnapshot
    }
  | { kind: 'Decline'; obligationKey: string; reason?: string; origin: Origin }
  | {
      kind: 'Debt'
      obligationKey: string
      snapshot: DebtSnapshot
      anchor: Anchor
      origin: Origin
      dueSemantics: string
      settlementRoute: string
    }

export function positionChangeObligationKey(positionChangeId: string): string {
  return `PositionChange:${positionChangeId}`
}

export function preparePositionChangeReflection(
  command: ReflectionCommand,
): Result<ReflectionOutcome, { issues: string[] }> {
  const obligationKey = positionChangeObligationKey(command.positionChangeId)
  const origin: Origin = { kind: 'PositionChange', id: command.positionChangeId }
  const anchor: Anchor = { kind: 'Trade', tradeId: command.tradeId }
  const disposition = command.disposition

  if (disposition.kind === 'Decline') {
    return { ok: true, value: { kind: 'Decline', obligationKey, reason: disposition.reason, origin } }
  }

  if (disposition.kind === 'Defer') {
    return {
      ok: true,
      value: {
        kind: 'Debt',
        obligationKey,
        snapshot: {
          definitionRevision: command.definitionRevision,
          definitionType: POSITION_CHANGE_REFLECTION_DEFINITION.type,
          prompts: POSITION_CHANGE_REFLECTION_DEFINITION.prompts,
        },
        anchor,
        origin,
        dueSemantics: 'DueAtDailyReview',
        settlementRoute: 'Journal.save(ResolveDebt)',
      },
    }
  }

  const issues: string[] = []
  const form = disposition.form
  const options = (id: string) => POSITION_CHANGE_REFLECTION_DEFINITION.prompts.find(p => p.id === id)?.options ?? []
  if (!options('decisionMode').includes(form.decisionMode)) issues.push('DecisionMode')
  if (!options('primaryEmotion').includes(form.primaryEmotion)) issues.push('PrimaryEmotion')
  if (!Number.isInteger(form.decisionConfidence) || form.decisionConfidence < 1 || form.decisionConfidence > 5) {
    issues.push('DecisionConfidence')
  }
  if (issues.length) return { ok: false, error: { issues } }

  return {
    ok: true,
    value: {
      kind: 'Entry',
      obligationKey,
      snapshot: {
        definitionRevision: command.definitionRevision,
        answers: {
          DecisionMode: form.decisionMode,
          PrimaryEmotion: form.primaryEmotion,
          DecisionConfidence: form.decisionConfidence,
          ...(form.note ? { Note: form.note } : {}),
        },
        source: 'Position Change',
        anchor,
        origin,
      },
    },
  }
}

export function applyReflectionOutcome(
  current: ReflectionOutcome | undefined,
  prepared: ReflectionOutcome,
  attemptId: string,
): Result<{ outcome: ReflectionOutcome; revision: string; attemptId: string }, { issue: 'ObligationAlreadySettled' }> {
  if (current) return { ok: false, error: { issue: 'ObligationAlreadySettled' } }
  return { ok: true, value: { outcome: prepared, revision: '1', attemptId } }
}

export function reopenDebtOnVoid(outcome: ReflectionOutcome, voidedEntryId: string): ReflectionOutcome {
  if (outcome.kind !== 'Entry' || outcome.settledDebtId !== voidedEntryId || !outcome.debtSnapshot) return outcome
  return {
    kind: 'Debt',
    obligationKey: outcome.obligationKey,
    snapshot: outcome.debtSnapshot,
    anchor: outcome.snapshot.anchor,
    origin: outcome.snapshot.origin,
    dueSemantics: 'DueAtDailyReview',
    settlementRoute: 'Journal.save(ResolveDebt)',
  }
}
