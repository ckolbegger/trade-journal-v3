import { useContext, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, UNSAFE_NavigationContext } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import { DAILY_TRADE_REVIEW_PROMPTS } from '../../domain/daily-trade-review-prompts.ts';
import { reasonOwed } from '../../domain/reason-rule.ts';
import { shortDate } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { draftKey, draftSetAside, dropDraftSetAside, holdDraft, isWayBack, setDraftAsideOnTrip } from './action-draft.ts';
import { actionMeaning, planCallLine } from './action-words.ts';
import { fieldIssues } from './form-issues.tsx';
import type { FieldIssue } from './plan-issues.ts';
import type { ActionChoice, ActionForm as ActionFormState, DailyTradeReview, SaveDailyReviewResult, TradeSaveBinding } from '../../app/types.ts';

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
  // The Review is being read again under a changed Mark: Save waits, so it never presents the old binding.
  readonly pending?: boolean;
  // How many of the Trade's Marks for the Review Date are still to enter: while any are, no Action is offered (A304).
  readonly marksToGo?: number;
  // What the Plan says on the Review Date's Marks (A306), and the replay that holds the Plan's own words for the condition behind it.
  readonly planCall?: DailyTradeReview['planCall'];
  readonly replay?: DailyTradeReview['replay'];
  // The session whose figures the card shows when the Review Date has no price (the Now box's dated close); absent when it has one.
  readonly decidingOn?: string;
}

// "No Action until today's Marks are in. Enter them" (W95), the link going to the Marks step.
function MarksFirst({ tradeId, toGo }: { readonly tradeId: string; readonly toGo: number }) {
  return (
    <p className="marks-first">
      No Action until today&apos;s {toGo === 1 ? 'Mark is' : 'Marks are'} in. <Link to={`/review?trade=${tradeId}&panel=Marks`}>{toGo === 1 ? 'Enter it' : 'Enter them'}</Link>
    </p>
  );
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

const INTENT_REQUIRED = (field: string, code: string): FieldIssue => ({ field, message: 'Say why.', code });
// Any other rejection (the definition or the Trade is no longer what the form was rendered from) is about the Action as a whole.
const COULD_NOT_SAVE = 'This Action could not be saved. Reopen the Trade and try again.';

// The definition's wording for its optional questions; a saved Action's responses are told apart by it.
const { intent: INTENT, earlierIntent: EARLIER_INTENT, conviction: CONVICTION, considered: CONSIDERED, note: NOTE } = DAILY_TRADE_REVIEW_PROMPTS;
const SCALE = [1, 2, 3, 4, 5] as const;

// '' is nothing chosen: the view selects Hold only when the Plan call is Hold (A307).
type Chosen = ActionChoice | '';

interface Values {
  readonly action: Chosen;
  readonly intent: string;
  // The Conviction select's value: '' is unanswered.
  readonly conviction: string;
  readonly considered: string;
  readonly note: string;
}

// What the form was returned with: the saved Action and its answers, or Hold with none.
function returnedValues(form: ActionFormState): Values {
  if (form.kind === 'New') return { action: form.viewState.selectedAction ?? '', intent: '', conviction: '', considered: '', note: '' };
  const { responses } = form.action;
  const text = (prompt: string) => {
    const answer = responses.find((r) => r.prompt === prompt)?.answer;
    return answer?.kind === 'Text' ? answer.text : '';
  };
  const conviction = responses.find((r) => r.prompt === CONVICTION)?.answer;
  return {
    action: form.action.action as ActionChoice,
    // An Action saved under manifests 3 to 5 carries the reason under that form's wording.
    intent: text(INTENT) || text(EARLIER_INTENT),
    conviction: conviction?.kind === 'Scale' ? String(conviction.value) : '',
    considered: text(CONSIDERED),
    note: text(NOTE),
  };
}

// The Action for one Trade on the Review Date. Hold is preselected as view state only; nothing is recorded until Save.
export function ActionForm({ facade, form, binding, onSaved, onRefresh, onDirtyChange, pending = false, marksToGo = 0, planCall, replay, decidingOn }: ActionFormProps) {
  const { writable, report } = useRuntime();
  const returned = returnedValues(form);
  // A form opened on the way back from Price History starts from the Action the trader had started there (C9AR.5).
  const key = draftKey(binding.reviewDate, binding.tradeId);
  // The address now, read from the router's history: a form going away sees the page it is leaving for, which no render has yet.
  const history = useContext(UNSAFE_NavigationContext).navigator as { location?: { search: string } };
  const [started] = useState(() => (isWayBack(history.location?.search ?? '') ? draftSetAside(key) : undefined));
  useEffect(() => dropDraftSetAside(key), [key]);
  // Leaving for Price History (by the link, or the browser's Forward) sets the draft aside; this cleanup runs before the one below clears it.
  useEffect(() => () => setDraftAsideOnTrip(key, history.location?.search ?? ''), [key, history]);
  const [action, setAction] = useState((started?.action as Chosen | undefined) ?? returned.action);
  // The view's preselection can arrive after the form opened (the Marks come in and the Plan call is Hold): the form follows it until the trader chooses.
  const [preselected, setPreselected] = useState(returned.action);
  // Any explicit choice, even one that matches the preselection, ends the following.
  const [chose, setChose] = useState(started !== undefined);
  if (preselected !== returned.action) {
    setPreselected(returned.action);
    if (!chose) setAction(returned.action);
  }
  // A saved Action is shown as it is until the trader chooses to change it.
  const [changing, setChanging] = useState(false);
  // One save at a time: a second would carry the same binding.
  const [intent, setIntent] = useState(started?.intent ?? returned.intent);
  const [conviction, setConviction] = useState(started?.conviction ?? returned.conviction);
  const [considered, setConsidered] = useState(started?.considered ?? returned.considered);
  const [note, setNote] = useState(started?.note ?? returned.note);
  // The fold stays shut until the trader opens it, and stays open while it holds a value.
  const [more, setMore] = useState(false);
  const [issues, setIssues] = useState<readonly FieldIssue[]>([]);
  const uid = useId();
  const intentField = `${uid}-intent`;
  const convictionLabel = `${uid}-conviction`;
  const wholeField = `${uid}-form`;
  const wholeIssue = issues.find((i) => i.field === wholeField);
  const { fieldError, describedBy } = fieldIssues(issues);
  // A rejected submission takes focus to the first issue's field.
  useEffect(() => {
    const first = issues[0];
    if (first) document.getElementById(first.field)?.focus();
  }, [issues]);
  const dirty = action !== returned.action || intent !== returned.intent || conviction !== returned.conviction || considered !== returned.considered || note !== returned.note;
  // Once the shell is read only the values can no longer be saved, so they hold nothing back: the trader can leave the Trade.
  useEffect(() => onDirtyChange(dirty && writable), [dirty, writable, onDirtyChange]);
  // What the form holds is kept for a trip to Price History, which the Review's Price History link starts.
  useEffect(() => {
    holdDraft(key, dirty ? { action, intent, conviction, considered, note } : undefined);
    return () => holdDraft(key, undefined);
  }, [key, dirty, action, intent, conviction, considered, note]);
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
  // A save refused for want of Marks (A304): the form's words are the card's own until the Review is read again under a new binding.
  const [unresolved, setUnresolved] = useState<{ readonly binding: TradeSaveBinding; readonly count: number }>();
  const required = action !== '' && reasonOwed(action, planCall?.call);
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = intent.trim();
    const consideredText = considered.trim();
    const noteText = note.trim();
    // A blank reason is no reason where the rule owes one, and nothing is sent.
    const missing = required && text === '';
    // Nothing chosen is refused first; its words go where the whole form's refusals do.
    if (action === '') {
      setIssues([{ field: wholeField, message: 'Choose an Action.', code: 'ActionMissing' }]);
      return;
    }
    setIssues(missing ? [INTENT_REQUIRED(intentField, 'RequiredAnswerMissing')] : []);
    if (missing) return;
    setSaving(true);
    let result;
    try {
      result = await facade.DailyReview.save({
        kind: 'SaveTradeAction',
        binding,
        action,
        ...(text === '' ? {} : { intent: text }),
        ...(conviction === '' ? {} : { conviction: Number(conviction) }),
        ...(consideredText === '' ? {} : { considered: consideredText }),
        ...(noteText === '' ? {} : { note: noteText }),
      });
    } finally {
      setSaving(false);
    }
    // A refusal to write switches the whole shell to read only; the form keeps its values.
    report(result);
    setNotice(result.kind === 'ReviewChanged' || result.kind === 'ChangedDuringAssembly' || result.kind === 'Conflict' || result.kind === 'StorageFailure' ? result.kind : undefined);
    const marks = result.kind === 'Rejected' ? result.issues.find((issue) => issue.code === 'ReviewMarksUnresolved') : undefined;
    setUnresolved(marks && 'instruments' in marks ? { binding, count: marks.instruments.length } : undefined);
    setIssues(result.kind === 'Rejected' && !marks ? result.issues.map((issue) => (issue.code === 'RequiredAnswerMissing' || issue.code === 'IntentRequired' ? INTENT_REQUIRED(intentField, issue.code) : { field: wholeField, message: COULD_NOT_SAVE, code: issue.code })) : []);
    if (result.kind === 'Saved') onSaved(result);
  };
  // Discard empties the form: the choice goes back to what the view preselected, and every answer to blank.
  const discard = () => {
    setAction(returned.action);
    setChose(false);
    setIntent(returned.intent);
    setConviction(returned.conviction);
    setConsidered(returned.considered);
    setNote(returned.note);
    setIssues([]);
  };
  // A form opened read only has no entry controls. One that held values when the shell turned read only stays, disabled, so the values are visibly kept.
  const readOnlyEmpty = !writable && !dirty;
  const callLine = planCallLine(planCall, replay);
  const toGo = unresolved?.binding === binding ? unresolved.count : marksToGo;
  if (readOnlyEmpty && form.kind === 'New') return <p>No Action saved.</p>;
  if (toGo > 0) return <MarksFirst tradeId={binding.tradeId} toGo={toGo} />;
  // Values held over a Conflict refresh differ from the saved Action it now shows: they stay open, as if Change were pressed.
  const savedLines = form.kind === 'Saved' && (
    <>
      <p>{`${shortDate(binding.reviewDate)}: ${form.action.action}${returned.intent === '' ? '' : ` · “${returned.intent}”`}`}</p>
      {form.action.action === 'Exit' && <p>Not done until it is recorded. Tomorrow&apos;s Review will ask.</p>}
      {returned.conviction !== '' && <p>{CONVICTION}: {returned.conviction}</p>}
      {returned.considered !== '' && <p>{CONSIDERED} {returned.considered}</p>}
      {returned.note !== '' && <p>{NOTE}: {returned.note}</p>}
    </>
  );
  if (form.kind === 'Saved' && (readOnlyEmpty || (writable && !changing && !dirty))) {
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
      {decidingOn && <p className="action-dated">No price today: deciding on the {shortDate(decidingOn)} figures.</p>}
      {callLine && <p className="action-call">{callLine}</p>}
      {action === '' && <p className="action-nothing">Nothing is chosen for you here.</p>}
      <fieldset className="choices">
        <legend>Action</legend>
        {CHOICES.map((choice) => (
          <label key={choice} className="chip">
            <input type="radio" name="action" value={choice} checked={action === choice} disabled={saving || !writable} onClick={() => setChose(true)} onChange={() => { setAction(choice); setChose(true); }} />
            {choice}
          </label>
        ))}
      </fieldset>
      {action !== '' && <p className="action-meaning">{actionMeaning(action, planCall, replay)}</p>}
      <div className="field">
        <label>
          {required ? `${INTENT} (required)` : `${INTENT} (optional)`}
          <textarea id={intentField} value={intent} disabled={saving || !writable} onChange={(e) => setIntent(e.target.value)} {...describedBy(intentField)} />
        </label>
        {fieldError(intentField)}
      </div>
      <div className="field" role="group" aria-labelledby={convictionLabel}>
        <span id={convictionLabel}>{CONVICTION} (optional)</span>
        <div className="conviction-buttons">
          {SCALE.map((n) => (
            <button key={n} type="button" className="pill secondary" aria-pressed={conviction === String(n)} disabled={saving || !writable} onClick={() => setConviction(conviction === String(n) ? '' : String(n))}>
              {n}
            </button>
          ))}
        </div>
        <span className="field-hint">1 low · 5 high</span>
      </div>
      <details open={more || considered !== '' || note !== ''} onToggle={(e) => setMore(e.currentTarget.open)}>
        <summary>Add more: what you decided against, a note</summary>
        <div className="field">
          <label>
            {CONSIDERED}
            <textarea value={considered} disabled={saving || !writable} onChange={(e) => setConsidered(e.target.value)} />
          </label>
        </div>
        <div className="field">
          <label>
            {NOTE}
            <textarea value={note} disabled={saving || !writable} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
      </details>
      <button type="button" className="pill secondary" disabled={!dirty || saving || !writable} onClick={discard}>
        Discard
      </button>
      <button type="submit" className="pill primary" disabled={saving || refreshing || pending || !writable}>
        {action === '' ? 'Save' : `Save ${action}`}
      </button>
    </form>
  );
}
