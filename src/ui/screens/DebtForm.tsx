import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type {
  AnswerInput,
  DebtProjection,
  DeclineProjection,
  EntryDefinitionRecord,
  EntryProjection,
  ObligationOutcome,
  ReflectionSaveBinding,
} from '../../app/types.ts';
import { useRuntime } from '../runtime.tsx';
import { fieldIssues } from './form-issues.tsx';
import { describeJournalIssue, type FieldIssue } from './plan-issues.ts';
import { REASON_TOO_LONG } from './position-change-issues.ts';
import { ReflectionPrompts, type Answers } from './ReflectionPrompts.tsx';

// How the trader resolves a reflection owed: an Answer to the snapshot definition's prompts, or a Decline.
export type DebtResolutionInput =
  | { readonly kind: 'Answer'; readonly answers: Readonly<Record<string, AnswerInput>> }
  | { readonly kind: 'Decline'; readonly reason?: string };

export interface DebtResolved {
  readonly kind: 'Resolved';
  readonly entry?: EntryProjection;
  readonly decline?: DeclineProjection;
  readonly debt: DebtProjection;
}

// What a host's call returns, normalized for the form: Daily Review's and Journal's results both map onto it.
export type DebtSubmitResult =
  | DebtResolved
  | { readonly kind: 'Rejected'; readonly issues: readonly { readonly promptId?: string; readonly code: string }[] }
  | { readonly kind: 'Conflict'; readonly currentOutcome?: ObligationOutcome }
  | { readonly kind: 'NotFound' }
  | { readonly kind: 'RuntimeNotWritable' };

export interface DebtFormProps {
  // The Debt's snapshot definition revision, which may differ from the current revision.
  readonly definition: EntryDefinitionRecord;
  readonly binding: ReflectionSaveBinding;
  // The host's call: turns the resolution into its own request and returns the normalized result.
  readonly submit: (request: { readonly binding: ReflectionSaveBinding; readonly resolution: DebtResolutionInput }) => Promise<DebtSubmitResult>;
  // The accepted result, for the host to continue from (the form already shows the saved outcome).
  readonly onResolved?: (resolved: DebtResolved) => void;
  // Leaving records nothing; the host closes the form.
  readonly onCancel?: () => void;
  // Reports whether a value was entered (update deferral, D1 A5).
  readonly onDirtyChange?: (dirty: boolean) => void;
}

const OUTCOME: Record<ObligationOutcome['kind'], string> = { Entry: 'answered', Decline: 'declined', Debt: 'still owed' };

// A saved Entry's responses in the snapshot's prompt order, with option and scale values as the trader saw them.
function SavedEntry({ definition, entry }: { readonly definition: EntryDefinitionRecord; readonly entry: EntryProjection }) {
  return (
    <dl>
      {definition.prompts.map((prompt) => {
        const value = entry.responses.find((r) => r.promptId === prompt.id)?.value;
        const text =
          value?.kind === 'Text'
            ? value.text
            : value?.kind === 'Scale'
              ? String(value.value)
              : value?.kind === 'Option' && prompt.kind === 'SingleSelect'
                ? (prompt.options.find((o) => o.id === value.optionId)?.label ?? value.optionId)
                : 'Not answered';
        return (
          <div key={prompt.id}>
            <dt>{prompt.text}</dt>
            <dd>{text}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export function DebtForm({ definition, binding, submit, onResolved, onCancel, onDirtyChange }: DebtFormProps) {
  const [answers, setAnswers] = useState<Answers>({});
  const [resolved, setResolved] = useState<DebtResolved | undefined>();
  const [reason, setReason] = useState('');
  // The Debt was resolved or changed elsewhere since the form was opened: nothing was saved, and the values stay.
  const [conflict, setConflict] = useState<Extract<DebtSubmitResult, { kind: 'Conflict' }> | undefined>();
  const conflictRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (conflict) conflictRef.current?.focus();
  }, [conflict]);
  const { writable } = useRuntime();
  // Once the shell is read only the values can no longer be saved, so they hold nothing back.
  const dirty = !resolved && (Object.keys(answers).length > 0 || reason !== '');
  useEffect(() => onDirtyChange?.(dirty && writable), [dirty, writable, onDirtyChange]);
  // Leaving abandons the values, so the form no longer holds an update back.
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  const [issues, setIssues] = useState<readonly FieldIssue[]>([]);
  const reasonField = `${useId()}-reason`;
  const formRef = useRef<HTMLFormElement>(null);
  // A rejected submission takes focus to the first field, in the form's order, that has an issue.
  useEffect(() => {
    const first = definition.prompts.find((p) => issues.some((i) => i.field === p.id));
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first.id}"]`)?.focus();
  }, [issues, definition]);
  // A submission is in flight: Answer and Decline are disabled, so only one call goes out at a time.
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const send = async (resolution: DebtResolutionInput) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    const result = await submit({ binding, resolution }).finally(() => {
      inFlight.current = false;
      setPending(false);
    });
    setIssues(
      result.kind === 'Rejected'
        ? result.issues.map((i): FieldIssue =>
            i.code === 'ReasonTooLong'
              ? { field: reasonField, message: REASON_TOO_LONG }
              : describeJournalIssue({ source: 'Journal', field: i.promptId, code: i.code }, definition),
          )
        : [],
    );
    setConflict(result.kind === 'Conflict' ? result : undefined);
    if (result.kind === 'Resolved') {
      setResolved(result);
      onResolved?.(result);
    }
  };
  const { promptErrors, fieldError, describedBy } = fieldIssues(issues);
  if (resolved) {
    return (
      <section aria-label="Saved reflection">
        {resolved.entry ? (
          <SavedEntry definition={definition} entry={resolved.entry} />
        ) : (
          <p>Declined to reflect.{resolved.decline?.reason ? ` Reason: ${resolved.decline.reason}` : ''}</p>
        )}
      </section>
    );
  }
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send({ kind: 'Answer', answers });
  };
  return (
    <form ref={formRef} aria-label="Reflection" noValidate onSubmit={onSubmit}>
      {conflict && (
        <div ref={conflictRef} role="alert" tabIndex={-1} className="banner warning">
          <p>
            <strong>This reflection changed after you opened it.</strong> Nothing was saved. Your values are kept below.
          </p>
          {conflict.currentOutcome && <p>Current outcome: {OUTCOME[conflict.currentOutcome.kind]}</p>}
        </div>
      )}
      <ReflectionPrompts definition={definition} answers={answers} onChange={setAnswers} errors={promptErrors(definition)} disabled={!writable} />
      <div className="field">
        <label>
          Reason for declining (optional)
          <textarea id={reasonField} value={reason} disabled={!writable} onChange={(e) => setReason(e.target.value)} {...describedBy(reasonField)} />
        </label>
        {fieldError(reasonField)}
      </div>
      {writable && (
        <>
          <button type="submit" className="pill primary" disabled={pending}>
            Answer
          </button>
          <button type="button" className="pill secondary" disabled={pending} onClick={() => void send({ kind: 'Decline', ...(reason.trim() !== '' && { reason }) })}>
            Decline
          </button>
        </>
      )}
      {/* Leaving records nothing: entered values are never saved as a draft. */}
      {onCancel && (
        <button type="button" className="pill secondary" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}
