import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type {
  EntryDefinitionRecord,
  PositionChangeMember,
  PositionChangeResult,
  TradeDetailView,
} from '../../app/types.ts';
import { fromWorkspaceLocal, toWorkspaceLocal } from '../../domain/time/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { PageTitle } from '../PageTitle.tsx';
import { Badge } from '../Badge.tsx';
import { instrumentLabel } from '../calculation-words.ts';
import { money, quantity } from '../format.ts';
import { plural } from './ReviewCard.tsx';
import { useRuntime } from '../runtime.tsx';
import { answerChanged, fieldIssues, IssueSummary, nonNegativeDecimal, positiveDecimal } from './form-issues.tsx';
import type { FieldIssue } from './plan-issues.ts';
import { describePositionChangeIssues, rowField } from './position-change-issues.ts';
import { PositionChangeReceipt } from './PositionChangeReceipt.tsx';
import { ClosingTheTrade, type CloseReasonOption } from './ClosingTheTrade.tsx';
import { ExitReceipt } from './ExitReceipt.tsx';
import { ReflectionPrompts, type Answers } from './ReflectionPrompts.tsx';
import { ChoiceGroup, dispositionOf, type Choice } from './reflection-choice.tsx';
import { LOCAL_TIME_CODES, minuteOf } from './local-time.ts';
import { EXIT_ACTION, INCOHERENT_ENTRY_NOTE } from './trade-detail/words.ts';

export interface PositionChangeFormProps {
  readonly facade: UiFacade;
  readonly timeZone: string;
  // The current instant, injectable so tests use a fixed clock.
  readonly now: () => string;
  // Reports whether any value differs from its initial value (update deferral, D1 A5).
  readonly onDirtyChange: (dirty: boolean) => void;
}

interface Row {
  // A key that survives removing an earlier row.
  readonly key: number;
  readonly quantity: string;
  readonly price: string;
  readonly fee: string;
  readonly time: string;
  // The instant `time` was defaulted from, until the trader edits it: that exact instant is what
  // is submitted, since the wall time may occur twice at a fall-back.
  readonly defaultInstant?: string | undefined;
}

type EditableField = 'quantity' | 'price' | 'fee' | 'time';

// At most 20 Executions per Position Change (D2 A18).
const MAX_ROWS = 20;

export { EXIT_ACTION };

// One Position Change on the Trade's single Planned Leg: Buy rows of the Plan's Stock (D2 A18, A33),
// or, opened with `?action=Sell`, Sell rows that exit it (D6 A93).
export function PositionChangeForm({ facade, timeZone, now, onDirtyChange }: PositionChangeFormProps) {
  const { tradeId = '' } = useParams();
  const exit = useSearchParams()[0].get('action') === EXIT_ACTION;
  const title = exit ? 'Record exit' : 'Record entry';
  const { writable, report } = useRuntime();
  const navigate = useNavigate();
  const [view, setView] = useState<TradeDetailView | undefined>();
  const [definition, setDefinition] = useState<EntryDefinitionRecord | undefined>();
  // A load that settled without a form to show; an unknown Trade outranks a failed definition load.
  const [failure, setFailure] = useState<'NotFound' | 'Error' | undefined>();
  // Retry counts attempts; each one reloads both the Trade and the definition in place.
  const [attempt, setAttempt] = useState(0);
  // The route keeps this form mounted across Trades, so another Trade starts from a clean load.
  const [loadingFor, setLoadingFor] = useState({ facade, tradeId });
  // Retry and another Trade both show Loading until their own loads finish.
  const clearLoad = () => {
    setView(undefined);
    setDefinition(undefined);
    setCloseDefinition(undefined);
    setCloseReasons(undefined);
    setFailure(undefined);
  };
  const [answers, setAnswers] = useState<Answers>({});
  // Declining is the trader's explicit alternative to completing the reflection; answers already
  // given stay on screen in case they complete it after all.
  const [choice, setChoice] = useState<Choice>('now');
  const [reason, setReason] = useState('');
  // The exit form's Closing the Trade inputs (P21): what its section loads, and what the trader chose.
  const [closeDefinition, setCloseDefinition] = useState<EntryDefinitionRecord | undefined>();
  const [closeReasons, setCloseReasons] = useState<readonly CloseReasonOption[] | undefined>();
  const [closeReasonId, setCloseReasonId] = useState('');
  const [closeChoice, setCloseChoice] = useState<Choice>('now');
  const [closeAnswers, setCloseAnswers] = useState<Answers>({});
  const [closeDeclineReason, setCloseDeclineReason] = useState('');
  const nextKey = useRef(1);
  const blankRow = (): Row => {
    const defaultInstant = minuteOf(now());
    return { key: nextKey.current++, quantity: '', price: '', fee: '', time: toWorkspaceLocal(defaultInstant, timeZone), defaultInstant };
  };
  const [rows, setRows] = useState<readonly Row[]>(() => [blankRow()]);
  // The row as first shown; the form is unsaved while anything differs from it.
  const [initialRow, setInitialRow] = useState(() => rows[0]!);
  const [issues, setIssues] = useState<readonly FieldIssue[]>([]);
  // The values the issues were reported against, to tell which the trader has since corrected.
  const [reported, setReported] = useState<
    | {
        readonly rows: readonly Row[];
        readonly answers: Answers;
        readonly closeReasonId: string;
        readonly closeChoice: Choice;
        readonly closeAnswers: Answers;
      }
    | undefined
  >();
  // The workflow found the exit terminal at this entered total, so the section shows whatever the
  // open quantity suggests (A93); another total is a different exit, which the workflow has not judged.
  const [closingRequiredAt, setClosingRequiredAt] = useState<Rational | undefined>();
  const [recorded, setRecorded] = useState<Extract<PositionChangeResult, { kind: 'Recorded' }> | undefined>();
  // The Trade changed after the form loaded: nothing was saved, and the values stay for review.
  const [conflict, setConflict] = useState(false);
  // The Trade was read again after a Conflict; its current state shows above the kept values.
  const [reloaded, setReloaded] = useState(false);
  const [reloadFailed, setReloadFailed] = useState(false);
  if (loadingFor.facade !== facade || loadingFor.tradeId !== tradeId) {
    // Values entered for one Trade are never carried to another.
    if (loadingFor.tradeId !== tradeId) {
      const row = blankRow();
      setRows([row]);
      setInitialRow(row);
      setAnswers({});
      setChoice('now');
      setReason('');
      setCloseReasonId('');
      setCloseChoice('now');
      setCloseAnswers({});
      setCloseDeclineReason('');
      setIssues([]);
      setReported(undefined);
      setClosingRequiredAt(undefined);
      setConflict(false);
      setReloaded(false);
      setReloadFailed(false);
      setRecorded(undefined);
    }
    setLoadingFor({ facade, tradeId });
    clearLoad();
  }
  const values = (r: Row) => [r.quantity, r.price, r.fee, r.time].join('\u0000');
  const dirty =
    !recorded &&
    (rows.length !== 1 ||
      values(rows[0]!) !== values(initialRow) ||
      Object.keys(answers).length > 0 ||
      choice !== 'now' ||
      reason !== '' ||
      closeReasonId !== '' ||
      closeChoice !== 'now' ||
      Object.keys(closeAnswers).length > 0 ||
      closeDeclineReason !== '');
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  // Leaving the form abandons it, so it no longer holds an update back.
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  // Bumped whenever the load effect restarts and by each reload and each save, so a reload started
  // for an earlier Trade or attempt, or superseded by a newer reload or a save, settles unseen.
  const loadEpoch = useRef(0);
  // Conflict recovery reads the Trade again in place: the form and its values stay on screen.
  const reloadTrade = () => {
    const epoch = ++loadEpoch.current;
    setReloadFailed(false);
    void facade.TradeViewsAndReporting.getTradeDetail({ tradeId }).then(
      (result) => {
        if (epoch !== loadEpoch.current) return;
        if (result.kind !== 'Ready') return setReloadFailed(true);
        setView(result.view);
        setConflict(false);
        setReloaded(true);
      },
      () => {
        if (epoch === loadEpoch.current) setReloadFailed(true);
      },
    );
  };
  const conflictRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (conflict) conflictRef.current?.focus();
  }, [conflict]);

  // Each load that ends in a form (needs the Trade and the definition) or the incoherent note (needs
  // only the Trade) moves focus to the view's heading; a reload in place after a Conflict keeps the
  // form shown, so it never does.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const loaded = definition !== undefined && (!exit || (closeDefinition !== undefined && closeReasons !== undefined));
  const shown = view !== undefined && ('recordedPositionChanges' in view || loaded);
  useEffect(() => {
    if (shown) headingRef.current?.focus();
  }, [shown]);

  useEffect(() => {
    // A superseded attempt (after Retry, or another Trade) settles without touching the form.
    let superseded = false;
    const live =
      <T,>(settle: (value: T) => void) =>
      (value: T) => {
        if (!superseded) settle(value);
      };
    void facade.TradeViewsAndReporting.getTradeDetail({ tradeId }).then(
      live((result) => {
        if (result.kind === 'Ready') setView(result.view);
        else setFailure(result.kind === 'NotFound' ? 'NotFound' : 'Error');
      }),
      live(() => setFailure('Error')),
    );
    void facade.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' }).then(
      live((result) => {
        if (result.kind === 'Found') setDefinition(result.definition);
        else setFailure((current) => current ?? 'Error');
      }),
      live(() => setFailure((current) => current ?? 'Error')),
    );
    if (exit) {
      // Closing the Trade needs the Close Review definition and the selectable Close Reasons (A93).
      void facade.Journal.getDefinitions({ latestFor: 'entry-type.close-review' }).then(
        live((result) => {
          if (result.kind === 'Found') setCloseDefinition(result.definition);
          else setFailure((current) => current ?? 'Error');
        }),
        live(() => setFailure((current) => current ?? 'Error')),
      );
      void facade.ReferenceCatalog.query({ family: 'CloseReason', pageSize: 500 }).then(
        live((page) => {
          if (page.kind === 'Page') setCloseReasons(page.items.map(({ id, label }) => ({ id, label })));
          else setFailure((current) => current ?? 'Error');
        }),
        live(() => setFailure((current) => current ?? 'Error')),
      );
    }
    return () => {
      superseded = true;
      loadEpoch.current += 1;
    };
  }, [facade, tradeId, attempt, exit]);

  if (recorded) {
    return exit ? (
      <ExitReceipt result={recorded} timeZone={timeZone} closeReasons={closeReasons ?? []} />
    ) : (
      <PositionChangeReceipt result={recorded} timeZone={timeZone} />
    );
  }
  // A Trade whose facts cannot be replayed would refuse the save, so no form is offered.
  if (view && 'recordedPositionChanges' in view) {
    return (
      <section className="card">
        <PageTitle ref={headingRef} tabIndex={-1}>
          {title}
        </PageTitle>
        <p>{INCOHERENT_ENTRY_NOTE}</p>
        <Link to={`/trades/${tradeId}`}>Back to the Trade</Link>
      </section>
    );
  }
  if (failure === 'NotFound') {
    return (
      <section className="card">
        <PageTitle>Trade not found</PageTitle>
        <p>No Trade with this identity exists in this journal.</p>
        <Link to="/">Back to Trades</Link>
      </section>
    );
  }
  if (failure === 'Error') {
    return (
      <section className="card">
        <PageTitle>{title}</PageTitle>
        <p>{`We couldn’t load this ${exit ? 'exit' : 'entry'} form. Nothing was changed.`}</p>
        <button
          type="button"
          className="pill secondary"
          onClick={() => {
            clearLoad();
            setAttempt((n) => n + 1);
          }}
        >
          Retry
        </button>
      </section>
    );
  }
  if (!view || !definition || (exit && (!closeDefinition || !closeReasons))) return <p role="status">{`Loading the ${exit ? 'exit' : 'entry'} form…`}</p>;

  const leg = view.plan.legs[0]!;
  // An option leg names the action by its side, never by the Strategy: a Long leg buys to open and
  // sells to close, a Short leg the reverse. A Stock leg keeps Buy and Sell.
  const option = leg.instrument.kind === 'Option' ? leg.instrument : undefined;
  const side = leg.side;
  const action = exit === (side === 'Long') ? 'Sell' : 'Buy';
  const actionWords = option ? `${action} to ${exit ? 'close' : 'open'}` : action;
  const unsigned = (amount: Rational) => (amount.compare(Rational.of(0n)) < 0 ? amount.mul(Rational.of(-1n)) : amount);
  // The quantity open on Detail, and whether the entered quantities total it: a presentation hint
  // for showing Closing the Trade; the workflow decides whether the change is terminal (A93).
  const sum = (amounts: readonly Rational[]) => amounts.reduce((total, amount) => total.add(amount), Rational.of(0n));
  const openQuantity = 'positions' in view ? sum(view.positions.map((p) => unsigned(p.quantity))) : Rational.of(0n);
  const entered = sum(rows.flatMap((r) => positiveDecimal(r.quantity) ?? []));
  const hasPosition = openQuantity.compare(Rational.of(0n)) > 0;
  const showClosing = exit && (closingRequiredAt?.equals(entered) === true || (hasPosition && entered.equals(openQuantity)));
  // Detail offers the exit only while a Position is open; the route can still be opened by hand.
  if (exit && !hasPosition) {
    return (
      <section className="card">
        <PageTitle ref={headingRef} tabIndex={-1}>
          {title}
        </PageTitle>
        <p>This Trade has no open Position to exit.</p>
        <Link to={`/trades/${tradeId}`}>Back to the Trade</Link>
      </section>
    );
  }
  const setRow = (key: number, name: EditableField, value: string) =>
    setRows((current) =>
      current.map((r) => {
        if (r.key !== key) return r;
        // Editing the time leaves the instant it was defaulted from behind.
        return name === 'time' ? { ...r, time: value, defaultInstant: undefined } : { ...r, [name]: value };
      }),
    );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const rowKeys = rows.map((r) => r.key);
    const times = rows.map((row) =>
      row.defaultInstant !== undefined ? ({ ok: true, instant: row.defaultInstant } as const) : fromWorkspaceLocal(row.time, timeZone),
    );
    // A time that is not a Workspace-local date and time cannot be submitted at all.
    const timeIssues = times.flatMap((time, member) =>
      time.ok ? [] : [{ source: 'TradeWorkflows', member, field: 'economicTime', code: time.reason }],
    );
    const instants = times.flatMap((time) => (time.ok ? [time.instant] : []));
    if (timeIssues.length > 0) {
      setIssues(describePositionChangeIssues(timeIssues, rowKeys, definition, closeDefinition, option));
      setReported({ rows, answers, closeReasonId, closeChoice, closeAnswers });
      return;
    }
    const members = rows.map(
      (row, index): PositionChangeMember => ({
        kind: 'Execution',
        tradeId,
        action,
        instrument: option ?? { kind: 'Stock', symbol: leg.instrument.symbol },
        intent: { kind: 'ServesPlannedLeg', plannedLegId: leg.factId },
        quantity: row.quantity.trim(),
        price: row.price.trim(),
        fee: row.fee.trim(),
        economicTime: instants[index]!,
      }),
    );
    // Hidden answers and reason are never submitted; only the chosen disposition is.
    const reflection = dispositionOf(choice, definition, answers, reason);
    loadEpoch.current += 1;
    const result = await facade.TradeWorkflows.recordPositionChange({
      originTradeId: tradeId,
      trades: [{ tradeId, expectedFactRevision: view.factRevision }],
      members,
      reflection,
      // The Close Reason and Close Review go only with the section that asks for them.
      ...(showClosing && {
        ...(closeReasonId !== '' && { closeReasonId }),
        closeReview: dispositionOf(closeChoice, closeDefinition!, closeAnswers, closeDeclineReason),
      }),
    });
    // A refusal to write switches the whole shell to read only; the form keeps its values.
    report(result);
    setConflict(result.kind === 'Conflict');
    setReloaded(false);
    setReloadFailed(false);
    setIssues(result.kind === 'Rejected' ? describePositionChangeIssues(result.issues, rowKeys, definition, closeDefinition, option) : []);
    setReported({ rows, answers, closeReasonId, closeChoice, closeAnswers });
    if (result.kind === 'Rejected') {
      // The workflow decides whether the exit is terminal: what it requires shows the section, and
      // what it finds not applicable takes the section away again.
      const codes = result.issues.map((issue) => issue.code);
      if (codes.some((code) => code === 'CloseReasonRequired' || code === 'CloseReviewDispositionRequired')) setClosingRequiredAt(entered);
      else if (codes.some((code) => code === 'CloseReasonNotApplicable' || code === 'CloseReviewNotApplicable')) setClosingRequiredAt(undefined);
    }
    if (result.kind === 'Recorded') {
      setRecorded(result);
      // The saved form's history entry becomes the Trade's, so reload, or Back then Forward, shows
      // the Trade rather than a blank form. The router does not observe replaceState, so the
      // receipt stays on screen in place; the router's state object is kept as it is.
      window.history.replaceState(window.history.state, '', `/trades/${tradeId}`);
    }
  };

  // Only what the form can judge from the values themselves clears on edit; the server's other
  // issues (an Economic Time before the Plan time, the reason's length) stay until the next save.
  const corrected = (issue: FieldIssue) => {
    if (!reported) return false;
    const row = rows.find((r) => issue.field.startsWith(`row-${r.key}-`));
    // A removed row's issue can never be fixed, so it counts as corrected.
    if (!row && issue.field.startsWith('row-')) return true;
    if (row) {
      const name = issue.field.slice(`row-${row.key}-`.length);
      const before = reported.rows.find((r) => r.key === row.key);
      if (!before) return false;
      if (name === 'economicTime') return LOCAL_TIME_CODES.has(issue.code ?? '') && row.time !== before.time && fromWorkspaceLocal(row.time, timeZone).ok;
      if (name === 'quantity' || name === 'price') return row[name] !== before[name] && positiveDecimal(row[name]) !== undefined;
      if (name === 'fee') return row.fee !== before.fee && nonNegativeDecimal(row.fee) !== undefined;
      return false;
    }
    if (issue.field === 'closeReasonId') return closeReasonId !== '' && closeReasonId !== reported.closeReasonId;
    if (issue.field === 'closeReview') return closeChoice !== reported.closeChoice;
    if (closeDefinition?.prompts.some((p) => p.id === issue.field)) return answerChanged(reported.closeAnswers, closeAnswers, issue.field);
    return definition.prompts.some((p) => p.id === issue.field) && answerChanged(reported.answers, answers, issue.field);
  };
  const { fieldError, describedBy, promptErrors } = fieldIssues(issues.filter((issue) => !corrected(issue)));

  return (
    <form className="plan-form" noValidate onSubmit={(event) => void submit(event)}>
      {/* Leaving records nothing; entered values are never saved as a draft. */}
      <Link to={`/trades/${tradeId}`}>Back to the Trade</Link>
      <PageTitle ref={headingRef} tabIndex={-1}>
        {title}
      </PageTitle>
      <section className="card" aria-label="Trade">
        <p>
          <strong>{view.plan.underlying}</strong> · <span>{view.labels.strategy}</span> · <Badge tone="info">{view.lifecycle.stored}</Badge>
        </p>
        {'positions' in view && (
          <p className="number">
            {option
              ? `${quantity(openQuantity)} of ${leg.quantity.replace('-', '')} contracts entered`
              : `${quantity(view.positions.reduce((total, p) => total.add(p.quantity), Rational.of(0n)))} of ${leg.quantity} shares entered`}
          </p>
        )}
      </section>
      {conflict && (
        <section ref={conflictRef} tabIndex={-1} className="banner warning" aria-labelledby="entry-conflict-heading">
          <h2 id="entry-conflict-heading">This Trade changed after you opened this form</h2>
          <p>
            Nothing was saved. Another entry was recorded for this Trade, so review the Trade before recording this one. Your values are kept below.
          </p>
          <button type="button" className="pill secondary" onClick={reloadTrade}>
            Load the latest Trade
          </button>
          {reloadFailed && <p role="alert">We couldn’t load the latest Trade. Your values are kept; try again.</p>}
        </section>
      )}
      {reloaded && (
        <section className="banner" aria-labelledby="entry-latest-heading">
          <h2 id="entry-latest-heading">Latest Trade</h2>
          <p>The latest Trade is loaded. Your values are kept below; review them against it before saving again.</p>
          <dl>
            <dt>Position</dt>
            <dd className="number">
              {'positions' in view
                ? view.positions
                    .map((p) =>
                      p.instrument.kind === 'Option'
                        ? `${p.quantity.compare(Rational.of(0n)) < 0 ? 'Short' : 'Long'} ${plural(Number(unsigned(p.quantity).numerator), 'contract', 'contracts')} of ${instrumentLabel(p.instrument)}`
                        : `${quantity(p.quantity)} shares of ${p.instrument.symbol}`,
                    )
                    .join(', ')
                : 'No Position yet'}
            </dd>
          </dl>
        </section>
      )}
      {/* A rejected entry moves focus to the summary of every issue. */}
      <IssueSummary id="entry-issues-heading" heading={`This ${exit ? 'exit' : 'entry'} can’t be saved yet`} issues={issues} corrected={corrected} />
      <section className="card" aria-labelledby="entry-terms-heading">
        <h2 id="entry-terms-heading">{exit ? 'Exit' : 'Entry'}</h2>
        <dl>
          <dt>{option ? 'Contract' : 'Symbol'}</dt>
          <dd>{option ? instrumentLabel(option) : leg.instrument.symbol}</dd>
          <dt>Action</dt>
          <dd>{actionWords}</dd>
          <dt>Planned Leg</dt>
          <dd>
            {option
              ? `${leg.side} ${plural(Number(leg.quantity.replace('-', '')), 'contract', 'contracts')} of ${instrumentLabel(option)}`
              : `${leg.side} ${leg.quantity} shares of ${leg.instrument.symbol}`}
          </dd>
        </dl>
      </section>
      {rows.map((row, index) => {
        const n = index + 1;
        // An option row's cash amount: contracts x 100 x price, a credit for any sale (C8).
        const contracts = positiveDecimal(row.quantity);
        const premium = positiveDecimal(row.price);
        const cash =
          option && contracts && premium && contracts.denominator === 1n
            ? `= ${money(contracts.mul(premium).mul(Rational.of(100n)))}${action === 'Sell' ? ' credit' : ''} for ${plural(Number(contracts.numerator), 'contract', 'contracts')}`
            : undefined;
        const input =(name: EditableField, label: string, type?: 'datetime-local', field: string = name, wide = false) => (
          <div className={wide ? 'field field-wide' : 'field'}>
            <label>
              {label}
              <input
                type={type}
                inputMode={type ? undefined : 'decimal'}
                value={row[name]}
                onChange={(e) => setRow(row.key, name, e.target.value)}
                {...describedBy(rowField(row.key, field))}
              />
            </label>
            {fieldError(rowField(row.key, field))}
          </div>
        );
        return (
          <fieldset key={row.key} aria-labelledby={`execution-${row.key}-legend`} className="execution-row">
            <legend id={`execution-${row.key}-legend`}>{`Execution ${n}`}</legend>
            {input('quantity', option ? 'Contracts' : 'Quantity')}
            {input('price', option ? 'Price (per share)' : 'Price')}
            {input('fee', 'Fee')}
            {input('time', 'Economic Time', 'datetime-local', 'economicTime', true)}
            {cash && <p className="hint">{cash}</p>}
            {rows.length > 1 && (
              <button type="button" className="pill secondary" onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}>
                {`Remove Execution ${n}`}
              </button>
            )}
          </fieldset>
        );
      })}
      <button
        type="button"
        className="pill secondary"
        disabled={rows.length >= MAX_ROWS}
        onClick={() => setRows((current) => [...current, blankRow()])}
      >
        Add Execution
      </button>
      <section className="card" aria-labelledby="reflection-heading">
        <h2 id="reflection-heading">{exit ? 'Reflection on this exit' : 'Position Change Reflection'}</h2>
        <ChoiceGroup legend="Reflection" name="disposition" value={choice} onChange={setChoice} />
        {choice === 'decline' && (
          <div className="field">
            <label>
              Reason for declining (optional)
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} {...describedBy('reason')} />
            </label>
            {fieldError('reason')}
          </div>
        )}
        {choice === 'now' && (
          <ReflectionPrompts definition={definition} answers={answers} onChange={setAnswers} errors={promptErrors(definition)} />
        )}
      </section>
      {showClosing && (
        <ClosingTheTrade
          reasons={closeReasons}
          reasonId={closeReasonId}
          onReason={setCloseReasonId}
          definition={closeDefinition!}
          choice={closeChoice}
          onChoice={setCloseChoice}
          declineReason={closeDeclineReason}
          onDeclineReason={setCloseDeclineReason}
          answers={closeAnswers}
          onAnswers={setCloseAnswers}
          fieldError={fieldError}
          describedBy={describedBy}
          promptErrors={promptErrors(closeDefinition!)}
        />
      )}
      <button type="submit" className="pill primary" disabled={!writable}>
        {exit ? 'Save exit' : 'Save entry'}
      </button>
      {/* Leaving records nothing: entered values are never saved as a draft. */}
      <button type="button" className="pill secondary" onClick={() => void navigate(`/trades/${tradeId}`)}>
        Cancel
      </button>
    </form>
  );
}
