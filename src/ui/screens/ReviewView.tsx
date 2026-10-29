import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { UiFacade } from '../../app/compose.ts';
import { Link, useSearchParams } from 'react-router';
import type { IncompleteReason, MarkRow, OpenDailyReviewResult, ReviewFamily, ReviewTradeItem, ReviewCompletion } from '../../app/types.ts';
import { Rational, formatDecimal } from '../../domain/values/index.ts';
import { Badge } from '../Badge.tsx';
import { PageTitle } from '../PageTitle.tsx';
import { shortDate } from '../format.ts';
import { MarkEntry, type MarkEntryProps } from './MarkEntry.tsx';

export interface ReviewViewProps {
  readonly facade: UiFacade;
  readonly now: () => string;
  // Reports whether a Mark value has been entered anywhere on the page (update deferral, D1 A5).
  readonly onDirtyChange: (dirty: boolean) => void;
}

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;

const COMPLETION_TEXT = { Incomplete: 'Incomplete', Complete: 'Complete', CompleteWithUnavailableMarks: 'Complete with Unavailable Marks' } as const;

type CalculationFamily = Extract<ReviewCompletion, { kind: 'CompleteWithUnavailableMarks' }>['families'][number];
const FAMILY_TEXT: Record<CalculationFamily, string> = { Valuation: 'Valuation', Risk: 'Risk', Reward: 'Reward', ConditionStatus: 'Condition status' };

// The Trade a blocker names, by its Underlying.
function blockerText(reason: IncompleteReason, underlying: (tradeId: string) => string): string {
  switch (reason.code) {
    case 'MarkMissing':
      return `Mark missing for ${reason.instrumentKey} on ${shortDate(reason.tradingDate)}`;
    case 'ActionMissing':
      return `Action missing for ${underlying(reason.tradeId)}`;
    case 'IntegrityDisagreement':
      return `${underlying(reason.tradeId)}: recorded facts disagree`;
    case 'IncoherentFacts':
      return `${underlying(reason.tradeId)}: recorded facts cannot be replayed`;
  }
}

function ReviewDate({ date }: { readonly date: string }) {
  return (
    <p>
      Review Date <time dateTime={date}>{shortDate(date)}</time>
    </p>
  );
}

function Status({ review, completion }: { readonly review: Ready; readonly completion: ReviewCompletion }) {
  const trades = review.families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));
  const underlying = (tradeId: string) => trades.find((t) => t.tradeId === tradeId)?.underlying ?? tradeId;
  return (
    <section className="card" aria-label="Review status">
      <ReviewDate date={review.reviewDate} />
      <p>
        <strong>{COMPLETION_TEXT[completion.kind]}</strong>
      </p>
      {completion.kind === 'CompleteWithUnavailableMarks' && (
        <div role="group" aria-label="Unavailable Marks">
          <p>Instruments: {completion.instruments.join(', ')}</p>
          <p>Trades: {completion.trades.map(underlying).join(', ')}</p>
          <p>Not calculated: {completion.families.map((family) => FAMILY_TEXT[family]).join(', ')}</p>
        </div>
      )}
      {completion.kind === 'Incomplete' && (
        <ul aria-label="Blockers">
          {completion.reasons.map((reason, i) => (
            <li key={i}>{blockerText(reason, underlying)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}


type EntryDirty = (id: string, dirty: boolean) => void;

// A Mark entry that reports whether it holds a value under its own id.
function ReviewMarkEntry({ facade, instrumentKey, tradingDate, resolution, resolutionRevision, onEntryDirty }: Omit<MarkEntryProps, 'onDirtyChange'> & { readonly onEntryDirty: EntryDirty }) {
  const id = `${instrumentKey}:${tradingDate}`;
  const report = useCallback((dirty: boolean) => onEntryDirty(id, dirty), [id, onEntryDirty]);
  return <MarkEntry facade={facade} instrumentKey={instrumentKey} tradingDate={tradingDate} resolution={resolution} resolutionRevision={resolutionRevision} onDirtyChange={report} />;
}

// An Instrument's name over its rows; it takes focus when the Review was opened from a link to it.
function InstrumentHeading({ name, focus }: { readonly name: string; readonly focus: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <h4 ref={ref} tabIndex={-1}>
      {name}
    </h4>
  );
}

// Today's Mark tasks: one row per Instrument with the eligible Trades that hold it.
function TodayRow({ facade, row, underlying, focus, onEntryDirty }: { readonly facade: UiFacade; readonly row: MarkRow; readonly underlying: (tradeId: string) => string; readonly focus: boolean; readonly onEntryDirty: EntryDirty }) {
  return (
    <li>
      <InstrumentHeading name={row.instrumentKey} focus={focus} />
      <p>
        Trades:{' '}
        {row.trades.map((tradeId, i) => (
          <span key={tradeId}>
            {i > 0 && ', '}
            <Link to={`/trades/${tradeId}`}>{underlying(tradeId)}</Link>
          </span>
        ))}
      </p>
      <ReviewMarkEntry facade={facade} instrumentKey={row.instrumentKey} tradingDate={row.tradingDate} resolution={row.resolution} resolutionRevision={row.resolutionRevision} onEntryDirty={onEntryDirty} />
    </li>
  );
}

const GAPS_PER_PAGE = 20;
const EARLIER_HEADING = 'Earlier sessions without Marks — optional';
type GapGroup = Extract<ReviewFamily, { family: 'Marks' }>['earlier'][number];

// One Instrument's earlier sessions without an effective Mark, newest first, a page at a time.
function GapList({ facade, group, focus, onEntryDirty }: { readonly facade: UiFacade; readonly group: GapGroup; readonly focus: boolean; readonly onEntryDirty: EntryDirty }) {
  const [page, setPage] = useState(0);
  const sessions = [...group.missing.map((date) => ({ date, acknowledged: false })), ...group.acknowledged.map((date) => ({ date, acknowledged: true }))].sort((a, b) => (a.date < b.date ? 1 : -1));
  const first = page * GAPS_PER_PAGE;
  const shown = sessions.slice(first, first + GAPS_PER_PAGE);
  return (
    <section aria-label={`${group.instrumentKey} earlier sessions`}>
      <InstrumentHeading name={group.instrumentKey} focus={focus} />
      <ul className="review-rows">
        {shown.map(({ date, acknowledged }) => (
          <li key={date}>
            <p>{shortDate(date)}</p>
            {acknowledged ? (
              <p>
                <strong>Acknowledged unavailable</strong>
              </p>
            ) : (
              <ReviewMarkEntry facade={facade} instrumentKey={group.instrumentKey} tradingDate={date} resolution={{ kind: 'Missing' }} resolutionRevision={group.revisions[date] ?? 'None'} onEntryDirty={onEntryDirty} />
            )}
          </li>
        ))}
      </ul>
      {sessions.length > GAPS_PER_PAGE && (
        <p>
          Sessions {first + 1} to {first + shown.length} of {sessions.length}
          {page > 0 && (
            <button type="button" className="pill secondary" onClick={() => setPage(page - 1)}>
              Previous page
            </button>
          )}
          {first + GAPS_PER_PAGE < sessions.length && (
            <button type="button" className="pill secondary" onClick={() => setPage(page + 1)}>
              Next page
            </button>
          )}
        </p>
      )}
    </section>
  );
}

function MarksFamily({ facade, review, onEntryDirty }: { readonly facade: UiFacade; readonly review: Ready; readonly onEntryDirty: EntryDirty }) {
  const trades = review.families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));
  const underlying = (tradeId: string) => trades.find((t) => t.tradeId === tradeId)?.underlying ?? tradeId;
  const uid = useId();
  // Open and Trade Detail link here with the Instrument they mean (A60).
  const linked = useSearchParams()[0].get('instrument');
  const family = review.families.find((f) => f.family === 'Marks');
  if (family?.family !== 'Marks') return null;
  return (
    <section aria-label="Marks">
      <h2>Marks</h2>
      <h3>Today's Marks</h3>
      <ul aria-label="Today's Marks" className="review-rows">
        {family.today.map((row) => (
          <TodayRow key={`${row.instrumentKey}:${row.tradingDate}`} facade={facade} row={row} underlying={underlying} focus={row.instrumentKey === linked} onEntryDirty={onEntryDirty} />
        ))}
      </ul>
      {family.earlier.length > 0 && (
        <div role="group" aria-labelledby={`${uid}-earlier`}>
          <h3 id={`${uid}-earlier`}>{EARLIER_HEADING}</h3>
          <p>These sessions do not block the Review.</p>
          {family.earlier.map((group) => (
            <GapList key={group.instrumentKey} facade={facade} group={group} onEntryDirty={onEntryDirty} focus={group.instrumentKey === linked && !family.today.some((row) => row.instrumentKey === linked)} />
          ))}
        </div>
      )}
    </section>
  );
}

type ViewState =
  | { readonly kind: 'Loading' }
  | { readonly kind: 'Ready'; readonly review: Ready }
  | { readonly kind: 'Empty'; readonly reviewDate: string }
  | { readonly kind: 'Error' };

const BAND_TEXT: Record<ReviewTradeItem['band'], string> = {
  Blocker: 'Blocker',
  BoundaryReached: 'Boundary reached',
  EvidenceLimited: 'Evidence limited',
  QuantifiedPressure: 'Quantified pressure',
  Routine: 'Routine',
};

// The share of the planned range travelled, as a whole percent.
const percent = (share: Rational): string => formatDecimal(Rational.of(share.numerator * 100n, share.denominator), 0);

// Why a Trade is in its band, in words.
function reasonText(reason: ReviewTradeItem['reasons'][number], basis: ReviewTradeItem['basis']): string {
  switch (reason.code) {
    case 'IntegrityDisagreement':
      return 'Recorded facts disagree';
    case 'IncoherentFacts':
      return 'Recorded facts cannot be replayed';
    case 'StopBreached':
      return 'Stop breached';
    case 'TargetReached':
      return 'Target reached';
    case 'MarkMissing':
      return `Mark missing for ${reason.instrumentKey} on ${shortDate(reason.date)}`;
    case 'AcknowledgedUnavailable':
      return `Mark acknowledged unavailable for ${reason.instrumentKey} on ${shortDate(reason.date)}`;
    case 'AwaitingClose':
      return `Awaiting the next close after ${shortDate(reason.after)}`;
    case 'PressureTowardStop':
    case 'PressureTowardTarget': {
      const boundary = reason.code === 'PressureTowardStop' ? 'Stop' : 'Target';
      return basis.kind === 'Comparable' && basis.side !== 'None' ? `${percent(basis.share)}% of the way from entry to the ${boundary}` : `Pressure toward the ${boundary}`;
    }
    case 'NoPressure':
      return 'No pressure toward the Stop or the Target';
  }
}

// The Trade walk in the order the Review returned, each with its band and reasons.
function TradeWalk({ review }: { readonly review: Ready }) {
  const trades = review.families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));
  const missing = new Set(review.completion.kind === 'Incomplete' ? review.completion.reasons.flatMap((r) => (r.code === 'ActionMissing' ? [r.tradeId] : [])) : []);
  return (
    <section aria-label="Trades">
      <h2>Trades</h2>
      <ol className="review-rows">
        {trades.map((trade) => (
          <li key={trade.tradeId}>
            <Link to={`/trades/${trade.tradeId}`}>{trade.underlying}</Link> <Badge tone="neutral">{BAND_TEXT[trade.band]}</Badge>
            {trade.reasons.map((reason, i) => (
              <p key={i}>{reasonText(reason, trade.basis)}</p>
            ))}
            <p>{missing.has(trade.tradeId) ? 'Action missing' : 'Action saved'}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// A Ready Review: its status and Marks family, and after Continue to Trades the walk. Continuing asks
// for the Review again, so figures the Mark saves changed are fresh (A48).
function ReadyReview({ facade, now, initial, onDirtyChange }: { readonly facade: UiFacade; readonly now: () => string; readonly initial: Ready; readonly onDirtyChange: (dirty: boolean) => void }) {
  const [review, setReview] = useState(initial);
  // The entries holding a value; the page is unsaved while any does.
  const dirty = useRef(new Set<string>());
  const onEntryDirty = useCallback<EntryDirty>(
    (id, isDirty) => {
      if (isDirty) dirty.current.add(id);
      else dirty.current.delete(id);
      onDirtyChange(dirty.current.size > 0);
    },
    [onDirtyChange],
  );
  const [walk, setWalk] = useState(false);
  // The last Continue could not produce a Review: nothing changed, and the trader may press it again.
  const [failed, setFailed] = useState(false);
  const proceed = async () => {
    const result = await facade.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: now() }).catch(() => undefined);
    setFailed(result?.kind !== 'Ready');
    if (result?.kind === 'Ready') {
      setReview(result);
      setWalk(true);
    }
  };
  return (
    <>
      <Status review={review} completion={review.completion} />
      <MarksFamily facade={facade} review={review} onEntryDirty={onEntryDirty} />
      {failed && (
        <div role="alert" className="banner warning">
          <p>We couldn’t refresh the Review. Nothing was changed.</p>
        </div>
      )}
      {walk ? (
        <TradeWalk review={review} />
      ) : (
        <button type="button" className="pill primary" onClick={() => void proceed()}>
          Continue to Trades
        </button>
      )}
    </>
  );
}

// The Daily Review of the latest completed session: its status, then the Marks family. Loading,
// Ready, Empty, and Error stay distinct, so a failure or a wait is never shown as an empty Review.
export function ReviewView({ facade, now, onDirtyChange }: ReviewViewProps) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ readonly attempt: number; readonly state: ViewState }>();
  useEffect(() => {
    let current = true;
    const settle = (state: ViewState) => {
      if (current) setSettled({ attempt, state });
    };
    facade.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: now() }).then(
      (result) => settle(result.kind === 'Ready' ? { kind: 'Ready', review: result } : result.kind === 'Empty' ? { kind: 'Empty', reviewDate: result.reviewDate } : { kind: 'Error' }),
      () => settle({ kind: 'Error' }),
    );
    return () => {
      current = false;
    };
  }, [facade, now, attempt]);
  const state: ViewState = settled?.attempt === attempt ? settled.state : { kind: 'Loading' };

  return (
    <section>
      <PageTitle>Review</PageTitle>
      {state.kind === 'Loading' && <p role="status">Loading the Review…</p>}
      {state.kind === 'Error' && (
        <section className="card">
          <p>We couldn’t load the Review. Nothing was changed.</p>
          <button type="button" className="pill secondary" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </section>
      )}
      {state.kind === 'Empty' && (
        <section className="card empty">
          <ReviewDate date={state.reviewDate} />
          <p>No Trades were open at this session's close</p>
        </section>
      )}
      {state.kind === 'Ready' && <ReadyReview facade={facade} now={now} initial={state.review} onDirtyChange={onDirtyChange} />}
    </section>
  );
}
