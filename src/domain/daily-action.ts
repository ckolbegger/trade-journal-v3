import type { Result } from './types'

// Journal's initial Daily Trade Review Action definition. Runtime revisioning
// belongs to D12b; this fixed definition is owned by D5.
export type Prompt = {
  id: string
  role: string
  kind: string
  required?: boolean
  options?: string[]
  requiredWhen?: string[]
}

export const DAILY_ACTION_DEFINITION = {
  type: 'Daily Trade Review',
  revision: 'D1',
  prompts: [
    { id: 'action', role: 'Action', kind: 'WorkflowCriticalSingleSelect', required: true, options: ['Hold', 'Exit', 'Roll', 'Adjust'] },
    { id: 'intent', role: 'Intent', kind: 'Text', requiredWhen: ['Exit', 'Roll', 'Adjust'] },
    { id: 'convictionNow', role: 'ConvictionNow', kind: 'Scale' },
    { id: 'consideredAlternative', role: 'ConsideredAlternative', kind: 'Text' },
    { id: 'note', role: 'Note', kind: 'Text' },
  ] satisfies Prompt[],
}

export type DailyActionForm = {
  action: 'Hold' | 'Exit' | 'Roll' | 'Adjust'
  intent?: string
  convictionNow?: number
  consideredAlternative?: string
  note?: string
}

export type PreparedAction = {
  kind: 'Entry'
  obligationKey: string
  snapshot: {
    definitionRevision: string
    answers: Record<string, string | number>
    source: string
    origin: { kind: 'DailyReview'; tradeId: string; reviewDate: string }
    moment: string
    authoredAt: string
  }
}

export type ActionOutcome = {
  id: string
  revision: string
  obligationKey: string
  snapshot: PreparedAction['snapshot']
  status: 'Saved'
}

export function unsavedActionView(): DailyActionForm {
  return { action: 'Hold' }
}

export function dailyActionKey(tradeId: string, reviewDate: string): string {
  return `DailyReview:${tradeId}:${reviewDate}`
}

export function prepareAction(
  form: DailyActionForm,
  definitionRevision: string,
  obligationKey = 'DailyReview:pending',
  tradeId = '',
  reviewDate = '',
  moment = '',
  authoredAt = '',
): Result<PreparedAction, { issues: string[] }> {
  const issues: string[] = []
  const options = DAILY_ACTION_DEFINITION.prompts[0].options ?? []
  if (!options.includes(form.action)) issues.push('Action')
  if (form.action !== 'Hold' && !form.intent?.trim()) issues.push('Intent')
  if (issues.length) return { ok: false, error: { issues } }

  return {
    ok: true,
    value: {
      kind: 'Entry',
      obligationKey,
      snapshot: {
        definitionRevision,
        answers: {
          Action: form.action,
          ...(form.intent ? { Intent: form.intent } : {}),
          ...(form.convictionNow !== undefined ? { ConvictionNow: form.convictionNow } : {}),
          ...(form.consideredAlternative ? { ConsideredAlternative: form.consideredAlternative } : {}),
          ...(form.note ? { Note: form.note } : {}),
        },
        source: 'Daily Review',
        origin: { kind: 'DailyReview', tradeId, reviewDate },
        moment,
        authoredAt,
      },
    },
  }
}

export function applyActionOutcome(
  current: ActionOutcome | undefined,
  prepared: PreparedAction,
  id: string,
  expectedRevision: string | undefined,
): Result<{ entry: ActionOutcome; revision: string }, { issue: 'DuplicateOutcome' | 'StaleRevision' }> {
  if (current) {
    if (expectedRevision !== current.revision) return { ok: false, error: { issue: 'StaleRevision' } }
    return { ok: false, error: { issue: 'DuplicateOutcome' } }
  }
  const entry: ActionOutcome = {
    id, revision: '1', obligationKey: prepared.obligationKey,
    snapshot: prepared.snapshot, status: 'Saved',
  }
  return { ok: true, value: { entry, revision: '1' } }
}
