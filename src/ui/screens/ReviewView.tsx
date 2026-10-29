import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { UiFacade } from '../../app/compose.ts';
import { Link, useSearchParams } from 'react-router';
import type { DailyTradeReview, IncompleteReason, MarkResolution, MarkRow, OpenDailyReviewResult, ReviewFamily, ReviewCompletion } from '../../app/types.ts';
import { Badge } from '../Badge.tsx';
import { PageTitle } from '../PageTitle.tsx';
import { shortDate } from '../format.ts';
import type { SavedAction } from './ActionForm.tsx';
import { MarkEntry, type MarkEntryProps } from './MarkEntry.tsx';
import { BAND_TEXT, reasonText } from './review-attention.ts';
import { ReviewTrade } from './ReviewTrade.tsx';

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
function ReviewMarkEntry({ facade, instrumentKey, tradingDate, resolution, resolutionRevision, withdraw, onEntryDirty }: Omit<MarkEntryProps, 'onDirtyChange'> & { readonly onEntryDirty: EntryDirty }) {
  const id = `${instrumentKey}:${tradingDate}`;
  const report = useCallback((dirty: boolean) => onEntryDirty(id, dirty), [id, onEntryDirty]);
  return <MarkEntry facade={facade} instrumentKey={instrumentKey} tradingDate={tradingDate} resolution={resolution} resolutionRevision={resolutionRevision} withdraw={withdraw} onDirtyChange={report} />;
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
// A gap row has no effective Mark; one constant keeps the prop stable across renders.
const MISSING: MarkResolution = { kind: 'Missing' };
// The resolution an earlier-session row starts from: acknowledged when its date holds an acknowledgment.
function resolutionOf(group: GapGroup, date: string): MarkResolution {
  const acknowledgment = group.acknowledgments[date];
  return acknowledgment ? { kind: 'AcknowledgedUnavailable', acknowledgment } : MISSING;
}
const EARLIER_HEADING = 'Earlier sessions without Marks — optional';
type GapGroup = Extract<ReviewFamily, { family: 'Marks' }>['earlier'][number];

// One Instrument's earlier sessions without an effective Mark, newest first, a page at a time.
function GapList({ facade, group, focus, onEntryDirty: reportDirty }: { readonly facade: UiFacade; readonly group: GapGroup; readonly focus: boolean; readonly onEntryDirty: EntryDirty }) {
  const [page, setPage] = useState(0);
  // Paging would unmount the rows and drop what was typed, so it waits while any row holds a value.
  const [dirtyIds, setDirtyIds] = useState<ReadonlySet<string>>(new Set());
  const onEntryDirty = useCallback<EntryDirty>(
    (id, dirty) => {
      setDirtyIds((prev) => {
        if (prev.has(id) === dirty) return prev;
        const next = new Set(prev);
        if (dirty) next.add(id);
        else next.delete(id);
        return next;
      });
      reportDirty(id, dirty);
    },
    [reportDirty],
  );
  const blocked = dirtyIds.size > 0;
  const holdId = useId();
  const sessions = [...group.missing, ...group.acknowledged].sort((a, b) => (a < b ? 1 : -1));
  const first = page * GAPS_PER_PAGE;
  const shown = sessions.slice(first, first + GAPS_PER_PAGE);
  return (
    <section aria-label={`${group.instrumentKey} earlier sessions`}>
      <InstrumentHeading name={group.instrumentKey} focus={focus} />
      <ul className="review-rows">
        {shown.map((date) => (
          <li key={date}>
            <p>{shortDate(date)}</p>
            <ReviewMarkEntry
              facade={facade}
              instrumentKey={group.instrumentKey}
              tradingDate={date}
              resolution={resolutionOf(group, date)}
              resolutionRevision={group.revisions[date] ?? 'None'}
              withdraw={false}
              onEntryDirty={onEntryDirty}
            />
          </li>
        ))}
      </ul>
      {sessions.length > GAPS_PER_PAGE && (
        <p>
          Sessions {first + 1} to {first + shown.length} of {sessions.length}
          {blocked && <span id={holdId}> Save or clear the value you entered on this page to change pages.</span>}
          {page > 0 && (
            <button type="button" className="pill secondary" disabled={blocked} aria-describedby={blocked ? holdId : undefined} onClick={() => setPage(page - 1)}>
              Previous page
            </button>
          )}
          {first + GAPS_PER_PAGE < sessions.length && (
            <button type="button" className="pill secondary" disabled={blocked} aria-describedby={blocked ? holdId : undefined} onClick={() => setPage(page + 1)}>
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

const AFTER_SAVE = {
  Done: 'Every Trade has an Action.',
  Mark: 'A Mark is needed before the next Trade. It is listed under Marks.',
  Assembly: 'The Action is saved. Continue to Trades to refresh the Review.',
} as const;

// The Trade the walk has open, or what happened when it was asked for.
type Selected = { readonly tradeId: string; readonly state: 'Loading' | 'Unavailable' | { readonly trade: DailyTradeReview } };

// The Trade walk in the order the Review returned, each with its band and reasons; any Trade opens below.
function TradeWalk({ facade, review, selected, afterSave, onSelect, onSaved, onRefresh, onEntryDirty }: { readonly facade: UiFacade; readonly review: Ready; readonly selected: Selected | undefined; readonly afterSave: string | undefined; readonly onSelect: (tradeId: string) => void; readonly onSaved: (saved: SavedAction) => void; readonly onRefresh: (tradeId: string) => Promise<boolean>; readonly onEntryDirty: EntryDirty }) {
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
            <button type="button" className="pill secondary" onClick={() => onSelect(trade.tradeId)}>
              Review {trade.underlying}
            </button>
          </li>
        ))}
      </ol>
      {afterSave && <p role="status">{afterSave}</p>}
      {selected?.state === 'Loading' && <p role="status">Loading the Trade…</p>}
      {selected?.state === 'Unavailable' && (
        <div role="alert" className="banner warning">
          <p>We couldn’t load this Trade. Nothing was changed.</p>
        </div>
      )}
      {typeof selected?.state === 'object' && <ReviewTrade key={selected.tradeId} facade={facade} trade={selected.state.trade} onSaved={onSaved} onRefresh={() => onRefresh(selected.tradeId)} onEntryDirty={onEntryDirty} />}
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
  const [selected, setSelected] = useState<Selected>();
  // What follows a save when no Trade is next.
  const [afterSave, setAfterSave] = useState<string>();
  // The save's result is the Review from here on: its completion and binding replace the overview's, and its next step is the Trade shown.
  const saved = ({ review: post }: SavedAction) => {
    if (post.kind !== 'Ready') {
      setSelected(undefined);
      setAfterSave(AFTER_SAVE.Assembly);
      return;
    }
    setReview((current) => ({ ...current, completion: post.completion, binding: post.binding }));
    const next = post.nextStep;
    setSelected(next.kind === 'Trade' ? { tradeId: next.trade.tradeId, state: { trade: next.trade } } : undefined);
    setAfterSave(next.kind === 'Done' ? AFTER_SAVE.Done : next.kind === 'Mark' ? AFTER_SAVE.Mark : undefined);
  };
  const select = async (tradeId: string) => {
    setAfterSave(undefined);
    setSelected({ tradeId, state: 'Loading' });
    const result = await facade.DailyReview.getTrade({ reviewDate: review.reviewDate, tradeId, binding: review.binding }).catch(() => undefined);
    setSelected({ tradeId, state: result?.kind === 'Ready' ? { trade: result.trade } : 'Unavailable' });
  };
  // The last Continue could not produce a Review: nothing changed, and the trader may press it again.
  const [failed, setFailed] = useState(false);
  // A refresh is in flight: Continue is disabled, so overlapping opens cannot race.
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  // Asks for the Review again, one at a time; undefined when it could not be produced.
  const reopen = async (): Promise<Ready | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setRefreshing(true);
    const result = await facade.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: now() }).catch(() => undefined);
    inFlight.current = false;
    setRefreshing(false);
    return result?.kind === 'Ready' ? result : undefined;
  };
  const proceed = async () => {
    if (inFlight.current) return;
    const result = await reopen();
    setFailed(result === undefined);
    if (result) {
      setReview(result);
      setWalk(true);
    }
  };
  // The Review and one Trade again, under the new binding. The Trade replaces the shown one without a loading state, so the form keeps its values.
  const refreshTrade = async (tradeId: string): Promise<boolean> => {
    const result = await reopen();
    if (!result) return false;
    setReview(result);
    const trade = await facade.DailyReview.getTrade({ reviewDate: result.reviewDate, tradeId, binding: result.binding }).catch(() => undefined);
    if (trade?.kind !== 'Ready') return false;
    setSelected({ tradeId, state: { trade: trade.trade } });
    return true;
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
      {walk && <TradeWalk facade={facade} review={review} selected={selected} afterSave={afterSave} onSelect={(tradeId) => void select(tradeId)} onSaved={saved} onRefresh={refreshTrade} onEntryDirty={onEntryDirty} />}
      <button type="button" className="pill primary" onClick={() => void proceed()} disabled={refreshing}>
        Continue to Trades
      </button>
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
