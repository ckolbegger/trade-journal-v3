import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { UiFacade } from '../../app/compose.ts';
import { useRuntime } from '../runtime.tsx';
import { fieldIssues } from './form-issues.tsx';
import type { FieldIssue } from './plan-issues.ts';
import type { ActionChoice, ActionForm as ActionFormState, SaveDailyReviewResult, TradeSaveBinding } from '../../app/types.ts';

const CHOICES: readonly ActionChoice[] = ['Hold', 'Exit', 'Roll', 'Adjust'];

export type SavedAction = Extract<SaveDailyReviewResult, { kind: 'Saved' }>;

export interface ActionFormProps {
  readonly facade: UiFacade;
  readonly form: ActionFormState;
  readonly binding: TradeSaveBinding;
  // The coordinator's accepted result; the Review continues from it.
  readonly onSaved: (saved: SavedAction) => void;
  // Asks for the Review and this Trade again; true once the Trade carries a fresh binding.
  readonly onRefresh: () => Promise<boolean>;
  // Reports whether a value differs from the returned state (update deferral, D1 A5).
  readonly onDirtyChange: (dirty: boolean) => void;
}

const NOTICE = {
  ReviewChanged: (
    <>
      <strong>The Review changed after you opened this Trade.</strong> Nothing was saved. Your values are kept below. Refresh to see the current Review.
    </>
  ),
  ChangedDuringAssembly: (
    <>
      <strong>The Review kept changing while this Action was checked.</strong> Nothing was saved. Your values are kept below. Refresh to see the current Review.
    </>
  ),
  Conflict: (
    <>
      <strong>This Action changed after you opened it.</strong> Nothing was saved. Your values are kept below. Refresh to see the current Action.
    </>
  ),
  StorageFailure: (
    <>
      <strong>This Action could not be saved.</strong> Nothing was saved. Your values are kept, so you can try again.
    </>
  ),
} as const;

const INTENT_REQUIRED = (field: string, code: string): FieldIssue => ({ field, message: 'Enter your Intent for this Action.', code });
// Any other rejection (the definition or the Trade is no longer what the form was rendered from) is about the Action as a whole.
const COULD_NOT_SAVE = 'This Action could not be saved. Reopen the Trade and try again.';

// What the form was returned with: the saved Action and its Intent, or Hold with none.
function returnedValues(form: ActionFormState): { readonly action: ActionChoice; readonly intent: string } {
  if (form.kind === 'New') return { action: form.viewState.selectedAction, intent: '' };
  const intent = form.action.responses.find((r) => r.answer.kind === 'Text')?.answer;
  return { action: form.action.action as ActionChoice, intent: intent?.kind === 'Text' ? intent.text : '' };
}

// The Action for one Trade on the Review Date. Hold is preselected as view state only; nothing is recorded until Save.
export function ActionForm({ facade, form, binding, onSaved, onRefresh, onDirtyChange }: ActionFormProps) {
  const { writable, report } = useRuntime();
  const returned = returnedValues(form);
  const [action, setAction] = useState(returned.action);
  // A saved Action is shown as it is until the trader chooses to change it.
  const [changing, setChanging] = useState(false);
  // One save at a time: a second would carry the same binding.
  const [intent, setIntent] = useState(returned.intent);
  const [issues, setIssues] = useState<readonly FieldIssue[]>([]);
  const uid = useId();
  const intentField = `${uid}-intent`;
  const wholeField = `${uid}-form`;
  const wholeIssue = issues.find((i) => i.field === wholeField);
  const { fieldError, describedBy } = fieldIssues(issues);
  // A rejected submission takes focus to the first issue's field.
  useEffect(() => {
    const first = issues[0];
    if (first) document.getElementById(first.field)?.focus();
  }, [issues]);
  const dirty = action !== returned.action || intent !== returned.intent;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  // Leaving abandons the values, so the form no longer holds an update back.
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  // The save wrote nothing and the values stay: the Review or the Action changed since the form was opened, or storage failed.
  const [notice, setNotice] = useState<'ReviewChanged' | 'ChangedDuringAssembly' | 'Conflict' | 'StorageFailure' | undefined>();
  const noticeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);
  // The form's binding is about to change, so a save waits for the Refresh.
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      if (await onRefresh()) setNotice(undefined);
    } finally {
      setRefreshing(false);
    }
  };
  const required = action !== 'Hold';
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = intent.trim();
    // Exit, Roll, and Adjust need Intent; a blank one is no Intent, and nothing is sent.
    const missing = required && text === '';
    setIssues(missing ? [INTENT_REQUIRED(intentField, 'RequiredAnswerMissing')] : []);
    if (missing) return;
    setSaving(true);
    let result;
    try {
      result = await facade.DailyReview.save({ kind: 'SaveTradeAction', binding, action, ...(text === '' ? {} : { intent: text }) });
    } finally {
      setSaving(false);
    }
    // A refusal to write switches the whole shell to read only; the form keeps its values.
    report(result);
    setNotice(result.kind === 'ReviewChanged' || result.kind === 'ChangedDuringAssembly' || result.kind === 'Conflict' || result.kind === 'StorageFailure' ? result.kind : undefined);
    setIssues(result.kind === 'Rejected' ? result.issues.map((issue) => (issue.code === 'RequiredAnswerMissing' ? INTENT_REQUIRED(intentField, issue.code) : { field: wholeField, message: COULD_NOT_SAVE, code: issue.code })) : []);
    if (result.kind === 'Saved') onSaved(result);
  };
  if (!writable && form.kind === 'New') return <p>No Action saved.</p>;
  // Values held over a Conflict refresh differ from the saved Action it now shows: they stay open, as if Change were pressed.
  const savedLines = form.kind === 'Saved' && (
    <>
      <p>Saved Action: {form.action.action}</p>
      {returned.intent !== '' && <p>Intent: {returned.intent}</p>}
    </>
  );
  if (form.kind === 'Saved' && (!writable || (!changing && !dirty))) {
    return (
      <section aria-label="Saved Action">
        {savedLines}
        {writable && (
          <button type="button" className="pill secondary" onClick={() => setChanging(true)}>
            Change
          </button>
        )}
      </section>
    );
  }
  return (
    <form aria-label="Action" noValidate onSubmit={(event) => void submit(event)}>
      {!changing && savedLines}
      {notice && (
        <div ref={noticeRef} role="alert" tabIndex={-1} className="banner warning">
          <p>{NOTICE[notice]}</p>
          {notice !== 'StorageFailure' && (
            <button type="button" className="pill secondary" disabled={saving || refreshing} onClick={() => void refresh()}>
              Refresh
            </button>
          )}
        </div>
      )}
      {wholeIssue && (
        <p id={wholeIssue.field} tabIndex={-1} className="field-error">
          {wholeIssue.message}
        </p>
      )}
      <fieldset>
        <legend>Action</legend>
        {CHOICES.map((choice) => (
          <label key={choice}>
            <input type="radio" name="action" value={choice} checked={action === choice} disabled={saving} onChange={() => setAction(choice)} />
            {choice}
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label>
          {required ? 'Intent (required)' : 'Intent (optional)'}
          <textarea id={intentField} value={intent} disabled={saving} onChange={(e) => setIntent(e.target.value)} {...describedBy(intentField)} />
        </label>
        {fieldError(intentField)}
      </div>
      <button type="submit" className="pill primary" disabled={saving || refreshing}>
        Save
      </button>
    </form>
  );
}
