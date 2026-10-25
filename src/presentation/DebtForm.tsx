import type { FormEvent } from 'react';
import type { JournalObligation, PositionReflectionAnswers } from '../domain/journal/position-change-types';
import { ReflectionFields } from './OpeningForm';
import styles from './App.module.css';
export interface DebtDraft { issues?: string[]; obligation: JournalObligation; generation: string; workspaceRevision: string; answers: PositionReflectionAnswers; disposition: 'Complete' | 'Decline'; reason: string }
export function DebtForm({ draft, onChange, onSubmit, onCancel, disabled, busy = false, issues }: { draft: DebtDraft; onChange: (draft: DebtDraft) => void; onSubmit: (event: FormEvent) => void; onCancel: () => void; disabled: boolean; busy?: boolean; issues: string[] }) {
  return <form className={styles.card} noValidate onSubmit={onSubmit}><h2>{draft.obligation.definition.label}</h2><p>Answer the original trigger-time form. This writing belongs to Trade {draft.obligation.anchor.tradeId}, Position Change {draft.obligation.origin.factId}.</p><p>Source: {draft.obligation.source.label} · Moment: {draft.obligation.momentTime} · Due: {draft.obligation.dueTime}</p>
    <fieldset disabled={busy} className={styles.formFields}><legend>Owed reflection</legend><fieldset><legend>Debt outcome</legend><label><input type="radio" name="debt-outcome" checked={draft.disposition === 'Complete'} onChange={() => onChange({ ...draft, disposition: 'Complete' })} />Answer reflection</label><label><input type="radio" name="debt-outcome" checked={draft.disposition === 'Decline'} onChange={() => onChange({ ...draft, disposition: 'Decline' })} />Decline owed reflection</label></fieldset>
    {draft.disposition === 'Complete' ? <ReflectionFields definition={draft.obligation.definition} answers={draft.answers} issues={issues} onChange={answers => onChange({ ...draft, answers })} /> : <label>Decline reason (optional)<textarea value={draft.reason} onChange={event => onChange({ ...draft, reason: event.target.value })} /></label>}
    </fieldset><div className={styles.actions}><button type="submit" disabled={disabled}>{busy ? 'Saving…' : 'Save Debt outcome'}</button><button disabled={busy} type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}
