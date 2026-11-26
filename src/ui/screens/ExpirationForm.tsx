import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { EntryDefinitionRecord, PositionChangeResult, TradeDetailView } from '../../app/types.ts';
import { toWorkspaceLocal } from '../../domain/time/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { instrumentLabel } from '../calculation-words.ts';
import { plural, quantity, shortDate } from '../format.ts';
import { PageTitle } from '../PageTitle.tsx';
import { CardTitle } from './CardTitle.tsx';
import type { CardSale } from './PositionChangeFormBody.tsx';
import { useRuntime } from '../runtime.tsx';
import { ExpirationReceipt } from './ExpirationReceipt.tsx';
import { describeExpirationIssues } from './expiration-issues.ts';
import { fieldIssues, IssueSummary } from './form-issues.tsx';
import type { FieldIssue } from './plan-issues.ts';
import { ReflectionPrompts, type Answers } from './ReflectionPrompts.tsx';

export interface ExpirationFormProps {
  readonly facade: UiFacade;
  readonly tradeId: string;
  readonly timeZone: string;
  // Leaves the form without recording anything (a Review card's placement, T95.52, uses it).
  readonly onDone: () => void;
  // The words of the link back to the Trade.
  readonly backLabel: string;
  // Opened from the Review, so the receipt offers the way back (conflict K14).
  readonly fromReview: boolean;
  // Present when a Review card places the form: what it reports to the card instead of the route's history and links.
  readonly card?: CardSale;
  // The card already knows the contract finished in the money, so the reason is asked at once; elsewhere it is asked when the workflow requires it.
  readonly askWhy?: boolean;
  // The save button's words; the route's own are "Save expiration".
  readonly submitLabel?: string;
  // Reports whether any value differs from its initial value (update deferral, D1 A5).
  readonly onDirtyChange: (dirty: boolean) => void;
}

const unsigned = (amount: Rational): Rational => (amount.compare(Rational.of(0n)) < 0 ? amount.mul(Rational.of(-1n)) : amount);

// The contract's signed open quantity in words (C2): "Long 1 contract", "Short 2 contracts".
const heldWords = (held: Rational): string => `${held.compare(Rational.of(0n)) < 0 ? 'Short' : 'Long'} ${plural(Number(unsigned(held).numerator), 'contract', 'contracts')}`;

// The settlement time in the Workspace zone (C4): "Fri Nov 20, 16:00".
const settlementWords = (instant: string, timeZone: string): string => {
  const [date = '', clock = ''] = toWorkspaceLocal(instant, timeZone).split('T');
  return `${shortDate(date)}, ${clock}`;
};

// Records the Expiration of the one contract a Trade holds at or past its expiration date (D7 A113): the
// quantity and the settlement time come from the Settlement Due item, never from entry (P26). A component
// any screen can place, taking the Trade, what to do on leaving and the words of the way back.
export function ExpirationForm({ facade, tradeId, timeZone, onDirtyChange, onDone, backLabel, fromReview, card, askWhy = false, submitLabel = 'Save expiration' }: ExpirationFormProps) {
  const { writable, report } = useRuntime();
  const Title = card ? CardTitle : PageTitle;
  const [view, setView] = useState<TradeDetailView | undefined>();
  const [definition, setDefinition] = useState<EntryDefinitionRecord | undefined>();
  const [answers, setAnswers] = useState<Answers>({});
  const [issues, setIssues] = useState<readonly FieldIssue[]>([]);
  // The Trade changed after the form loaded: nothing was saved, and the choices stay for review.
  const [conflict, setConflict] = useState(false);
  const conflictRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (conflict) conflictRef.current?.focus();
  }, [conflict]);
  const [recorded, setRecorded] = useState<Extract<PositionChangeResult, { kind: 'Recorded' }> | undefined>();
  const [failed, setFailed] = useState(false);
  // The reason is asked once the card says so, or once the workflow has required it.
  const [reasonRequired, setReasonRequired] = useState(false);
  // The route keeps this form mounted across Trades, so another Trade starts from a clean load and clean values.
  const [loadingFor, setLoadingFor] = useState({ facade, tradeId });
  if (loadingFor.facade !== facade || loadingFor.tradeId !== tradeId) {
    if (loadingFor.tradeId !== tradeId) {
      setAnswers({});
      setReasonRequired(false);
      setIssues([]);
      setConflict(false);
      setRecorded(undefined);
    }
    setLoadingFor({ facade, tradeId });
    setView(undefined);
    setDefinition(undefined);
    setFailed(false);
  }
  // The card's own save (W128): the latest render's attempt, and the form to put focus back in.
  const latestSave = useRef<() => Promise<boolean>>(() => Promise.resolve(false));
  const formRef = useRef<HTMLFormElement>(null);
  const onForm = card?.onForm;
  useEffect(() => {
    onForm?.({
      save: () => (writable ? latestSave.current() : Promise.resolve(false)),
      focus: () => formRef.current?.querySelector<HTMLElement>('input, textarea')?.focus(),
    });
    return () => onForm?.(undefined);
  }, [onForm, writable]);
  const dirty = !recorded && Object.keys(answers).length > 0;
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
    return () => {
      superseded = true;
    };
  }, [facade, tradeId]);

  // One save: the values of this render. The card's handle reaches it through a ref the latest render keeps (W128).
  const attempt = async (): Promise<boolean> => {
    const item = view && 'settlement' in view ? view.settlement[0] : undefined;
    if (!view || !definition || !item || item.settlementTime.kind !== 'Value') return false;
    const settlementInstant = item.settlementTime.value;
    const result = await facade.TradeWorkflows.recordPositionChange({
      originTradeId: tradeId,
      trades: [{ tradeId, expectedFactRevision: view.factRevision }],
      // The quantity and the settlement time are the item's, never entered (P26).
      members: [{ kind: 'Expiration', tradeId, instrument: item.instrument, quantity: quantity(unsigned(item.quantity)), economicTime: settlementInstant }],
      // An expiration accepts only a completed reflection, whose one question is the Expiration Reason (A312, A322).
      reflection: { kind: 'Complete', form: { definitionId: definition.id, answers } },
      // A single-leg Expiration is always terminal (A113): its Close Review is put off, with no Close Reason (A311).
      closeReview: { kind: 'Defer' },
    });
    report(result);
    setConflict(result.kind === 'Conflict');
    setIssues(result.kind === 'Rejected' ? describeExpirationIssues(result.issues, definition) : []);
    // The workflow decides whether the contract finished in the money: its refusal is what asks for the reason.
    if (result.kind === 'Rejected' && result.issues.some((issue) => issue.code === 'ExpirationReasonRequired')) setReasonRequired(true);
    if (result.kind === 'Recorded') {
      setRecorded(result);
      card?.onRecorded(result);
    }
    return result.kind === 'Recorded';
  };
  useEffect(() => {
    latestSave.current = attempt;
  });
  const { promptErrors } = fieldIssues(issues);
  if (recorded) return <ExpirationReceipt result={recorded} timeZone={timeZone} fromReview={fromReview} {...(card && { onDismiss: card.onDismiss })} />;
  if (failed) return <p role="alert">We couldn’t load this expiration form. Nothing was changed.</p>;
  if (!view || !definition) return <p role="status">Loading the expiration form…</p>;
  const item = 'settlement' in view ? view.settlement[0] : undefined;
  // A contract whose expiration date is outside the market calendar has no settlement time to record at (D7 Q1).
  if (!item || item.settlementTime.kind !== 'Value') return <p>This Trade has no contract due for settlement.</p>;
  const settlementInstant = item.settlementTime.value;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void attempt();
  };

  return (
    <form ref={formRef} className="plan-form" noValidate onSubmit={submit}>
      {card ? (
        <button type="button" className="pill secondary" onClick={onDone}>
          {backLabel}
        </button>
      ) : (
        <Link to={`/trades/${tradeId}`}>{backLabel}</Link>
      )}
      {conflict && (
        <section ref={conflictRef} tabIndex={-1} className="banner warning" aria-labelledby="expiration-conflict-heading">
          <h2 id="expiration-conflict-heading">This Trade changed after you opened this form</h2>
          <p>Nothing was saved. The Trade changed after this expiration was offered, so review the Trade before recording it. Your choices are kept below.</p>
        </section>
      )}
      <IssueSummary id="expiration-issues-heading" heading="This expiration can’t be saved yet" issues={issues} />
      <section className="card" aria-labelledby="expiration-heading">
        <Title id="expiration-heading">Expiration</Title>
        <dl>
          <dt>Contract</dt>
          <dd>{instrumentLabel(item.instrument, timeZone)}</dd>
          <dt>Quantity</dt>
          <dd>{heldWords(item.quantity)}</dd>
          <dt>Settlement time</dt>
          <dd>{settlementWords(settlementInstant, timeZone)}</dd>
        </dl>
        <p className="hint">The close of the expiration session.</p>
      </section>
      <section className="card" aria-labelledby="reflection-heading">
        <h2 id="reflection-heading">Reflection on this expiration</h2>
        {/* The reflection is always completed (A312): its prompts are all optional, and the Expiration Reason is placed here once it is asked (A322). */}
        <ReflectionPrompts definition={definition} roles={askWhy || reasonRequired ? ['ExpirationReason'] : []} requiredRoles={['ExpirationReason']} answers={answers} onChange={setAnswers} errors={promptErrors(definition)} />
      </section>
      <button type="submit" className="pill primary" disabled={!writable}>
        {submitLabel}
      </button>
    </form>
  );
}

// The route screen: the Trade comes from the path.
export function ExpirationFormRoute(props: Pick<ExpirationFormProps, 'facade' | 'timeZone' | 'onDirtyChange'>) {
  const { tradeId = '' } = useParams();
  const navigate = useNavigate();
  return <ExpirationForm {...props} tradeId={tradeId} onDone={() => void navigate(`/trades/${tradeId}`)} backLabel="Back to the Trade" fromReview={false} />;
}
