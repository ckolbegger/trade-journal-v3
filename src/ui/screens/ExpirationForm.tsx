import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { EntryDefinitionRecord, PositionChangeResult, TradeDetailView } from '../../app/types.ts';
import { toWorkspaceLocal } from '../../domain/time/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { instrumentLabel } from '../calculation-words.ts';
import { quantity, shortDate } from '../format.ts';
import { PageTitle } from '../PageTitle.tsx';
import { useRuntime } from '../runtime.tsx';
import { ClosingTheTrade } from './ClosingTheTrade.tsx';
import { ExpirationReceipt } from './ExpirationReceipt.tsx';
import { describeExpirationIssues } from './expiration-issues.ts';
import { fieldIssues, IssueSummary } from './form-issues.tsx';
import type { FieldIssue } from './plan-issues.ts';
import { ChoiceGroup, dispositionOf, type Choice } from './reflection-choice.tsx';
import { ReflectionPrompts, type Answers } from './ReflectionPrompts.tsx';
import { plural } from './ReviewCard.tsx';

export interface ExpirationFormProps {
  readonly facade: UiFacade;
  readonly timeZone: string;
  // Reports whether any value differs from its initial value (update deferral, D1 A5).
  readonly onDirtyChange: (dirty: boolean) => void;
}

const NO_CLOSE_REASON = 'No Close Reason is needed, because the contract expired rather than being closed by your decision.';

const unsigned = (amount: Rational): Rational => (amount.compare(Rational.of(0n)) < 0 ? amount.mul(Rational.of(-1n)) : amount);

// The contract's signed open quantity in words (C2): "Long 1 contract", "Short 2 contracts".
const heldWords = (held: Rational): string => `${held.compare(Rational.of(0n)) < 0 ? 'Short' : 'Long'} ${plural(Number(unsigned(held).numerator), 'contract', 'contracts')}`;

// The settlement time in the Workspace zone (C4): "Fri Nov 20, 16:00".
const settlementWords = (instant: string, timeZone: string): string => {
  const [date = '', clock = ''] = toWorkspaceLocal(instant, timeZone).split('T');
  return `${shortDate(date)}, ${clock}`;
};

// Records the Expiration of the one contract a Trade holds at or past its expiration date (D7 A113): the
// quantity and the settlement time come from the Settlement Due item, never from entry (P26).
export function ExpirationForm({ facade, timeZone, onDirtyChange }: ExpirationFormProps) {
  const { tradeId = '' } = useParams();
  // Opened from the Review by `?from=review`; the receipt then offers the way back (conflict K14).
  const fromReview = useSearchParams()[0].get('from') === 'review';
  const { writable, report } = useRuntime();
  const [view, setView] = useState<TradeDetailView | undefined>();
  const [definition, setDefinition] = useState<EntryDefinitionRecord | undefined>();
  const [closeDefinition, setCloseDefinition] = useState<EntryDefinitionRecord | undefined>();
  const [answers, setAnswers] = useState<Answers>({});
  const [choice, setChoice] = useState<Choice>('now');
  const [reason, setReason] = useState('');
  const [closeAnswers, setCloseAnswers] = useState<Answers>({});
  const [closeChoice, setCloseChoice] = useState<Choice>('now');
  const [closeReason, setCloseReason] = useState('');
  const [issues, setIssues] = useState<readonly FieldIssue[]>([]);
  // The Trade changed after the form loaded: nothing was saved, and the choices stay for review.
  const [conflict, setConflict] = useState(false);
  const conflictRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (conflict) conflictRef.current?.focus();
  }, [conflict]);
  const [recorded, setRecorded] = useState<Extract<PositionChangeResult, { kind: 'Recorded' }> | undefined>();
  const [failed, setFailed] = useState(false);
  // The route keeps this form mounted across Trades, so another Trade starts from a clean load and clean values.
  const [loadingFor, setLoadingFor] = useState({ facade, tradeId });
  if (loadingFor.facade !== facade || loadingFor.tradeId !== tradeId) {
    if (loadingFor.tradeId !== tradeId) {
      setAnswers({});
      setChoice('now');
      setReason('');
      setCloseAnswers({});
      setCloseChoice('now');
      setCloseReason('');
      setIssues([]);
      setConflict(false);
      setRecorded(undefined);
    }
    setLoadingFor({ facade, tradeId });
    setView(undefined);
    setDefinition(undefined);
    setCloseDefinition(undefined);
    setFailed(false);
  }
  const dirty = !recorded && (choice !== 'now' || closeChoice !== 'now' || Object.keys(answers).length + Object.keys(closeAnswers).length > 0 || reason !== '' || closeReason !== '');
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  useEffect(() => {
    let superseded = false;
    // A read that fails or settles without its value leaves nothing to show but the failure.
    const fail = () => {
      if (!superseded) setFailed(true);
    };
    void facade.TradeViewsAndReporting.getTradeDetail({ tradeId }).then((result) => {
      if (superseded) return;
      if (result.kind === 'Ready') setView(result.view);
      else setFailed(true);
    }, fail);
    void facade.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' }).then((result) => {
      if (superseded) return;
      if (result.kind === 'Found') setDefinition(result.definition);
      else setFailed(true);
    }, fail);
    void facade.Journal.getDefinitions({ latestFor: 'entry-type.close-review' }).then((result) => {
      if (superseded) return;
      if (result.kind === 'Found') setCloseDefinition(result.definition);
      else setFailed(true);
    }, fail);
    return () => {
      superseded = true;
    };
  }, [facade, tradeId]);

  const { fieldError, describedBy, promptErrors } = fieldIssues(issues);
  if (recorded) return <ExpirationReceipt result={recorded} timeZone={timeZone} fromReview={fromReview} />;
  if (failed) return <p role="alert">We couldn’t load this expiration form. Nothing was changed.</p>;
  if (!view || !definition || !closeDefinition) return <p role="status">Loading the expiration form…</p>;
  const item = 'settlement' in view ? view.settlement[0] : undefined;
  if (!item) return <p>This Trade has no contract due for settlement.</p>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await facade.TradeWorkflows.recordPositionChange({
      originTradeId: tradeId,
      trades: [{ tradeId, expectedFactRevision: view.factRevision }],
      // The quantity and the settlement time are the item's, never entered (P26).
      members: [{ kind: 'Expiration', tradeId, instrument: item.instrument, quantity: quantity(unsigned(item.quantity)), economicTime: item.settlementTime }],
      reflection: dispositionOf(choice, definition, answers, reason),
      // A single-leg Expiration is always terminal (A113): a Close Review and no Close Reason.
      closeReview: dispositionOf(closeChoice, closeDefinition, closeAnswers, closeReason),
    });
    report(result);
    setConflict(result.kind === 'Conflict');
    setIssues(result.kind === 'Rejected' ? describeExpirationIssues(result.issues, definition, closeDefinition) : []);
    if (result.kind === 'Recorded') setRecorded(result);
  };

  return (
    <form className="plan-form" noValidate onSubmit={(event) => void submit(event)}>
      <Link to={`/trades/${tradeId}`}>Back to the Trade</Link>
      {conflict && (
        <section ref={conflictRef} tabIndex={-1} className="banner warning" aria-labelledby="expiration-conflict-heading">
          <h2 id="expiration-conflict-heading">This Trade changed after you opened this form</h2>
          <p>Nothing was saved. The Trade changed after this expiration was offered, so review the Trade before recording it. Your choices are kept below.</p>
        </section>
      )}
      <IssueSummary id="expiration-issues-heading" heading="This expiration can’t be saved yet" issues={issues} />
      <section className="card" aria-labelledby="expiration-heading">
        <PageTitle id="expiration-heading">Expiration</PageTitle>
        <dl>
          <dt>Contract</dt>
          <dd>{instrumentLabel(item.instrument)}</dd>
          <dt>Quantity</dt>
          <dd>{heldWords(item.quantity)}</dd>
          <dt>Settlement time</dt>
          <dd>{settlementWords(item.settlementTime, timeZone)}</dd>
        </dl>
        <p className="hint">The close of the expiration session.</p>
      </section>
      <section className="card" aria-labelledby="reflection-heading">
        <h2 id="reflection-heading">Reflection on this expiration</h2>
        <ChoiceGroup legend="Reflection" name="disposition" value={choice} onChange={setChoice} />
        {choice === 'decline' && (
          <div className="field">
            <label>
              Reason for declining (optional)
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
          </div>
        )}
        {choice === 'now' && <ReflectionPrompts definition={definition} answers={answers} onChange={setAnswers} errors={promptErrors(definition)} />}
      </section>
      <ClosingTheTrade
        noReasonNote={NO_CLOSE_REASON}
        definition={closeDefinition}
        choice={closeChoice}
        onChoice={setCloseChoice}
        declineReason={closeReason}
        onDeclineReason={setCloseReason}
        answers={closeAnswers}
        onAnswers={setCloseAnswers}
        fieldError={fieldError}
        describedBy={describedBy}
        promptErrors={promptErrors(closeDefinition)}
      />
      <button type="submit" className="pill primary" disabled={!writable}>
        Save expiration
      </button>
    </form>
  );
}
