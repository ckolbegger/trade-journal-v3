import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { UiFacade } from '../../app/compose.ts';
import type { IncompleteReason, OpenDailyReviewResult, PostSaveReview, ReviewCompletion } from '../../app/types.ts';
import { PageTitle } from '../PageTitle.tsx';
import { shortDate } from '../format.ts';
import type { SavedAction } from './ActionForm.tsx';
import type { CardMarkRows, EntryDirty } from './CardMarks.tsx';
import { ReviewCard, type CardDetail, type Remaining } from './ReviewCard.tsx';

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
function blockerText(reason: IncompleteReason, underlying: (tradeId: string) => string, openTrade: (tradeId: string) => void): ReactNode {
  switch (reason.code) {
    case 'MarkMissing':
      return `Mark missing for ${reason.instrumentKey} on ${shortDate(reason.tradingDate)}`;
    case 'ActionMissing':
      return `Action missing for ${underlying(reason.tradeId)}`;
    // The Trade links to its card, where the reflections are resolved (A71).
    case 'ReflectionDue':
      return (
        <>
          {reason.debtIds.length === 1 ? 'Reflection' : `${reason.debtIds.length} reflections`} due for{' '}
          <a
            href={`/review?trade=${reason.tradeId}`}
            onClick={(event) => {
              event.preventDefault();
              openTrade(reason.tradeId);
            }}
          >
            {underlying(reason.tradeId)}
          </a>
        </>
      );
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

const walkedTrades = (review: Ready) => review.families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));

function Status({ review, completion, openTrade }: { readonly review: Ready; readonly completion: ReviewCompletion; readonly openTrade: (tradeId: string) => void }) {
  const trades = walkedTrades(review);
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
            <li key={i}>{blockerText(reason, underlying, openTrade)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

// What a Trade still owes, read from the Review's completion: it follows every save's result.
function remainingOf(tradeId: string, completion: ReviewCompletion): Remaining {
  const reasons = completion.kind === 'Incomplete' ? completion.reasons : [];
  return {
    marks: reasons.filter((r) => r.code === 'MarkMissing' && r.trades.includes(tradeId)).length,
    reflections: reasons.flatMap((r) => (r.code === 'ReflectionDue' && r.tradeId === tradeId ? [r.debtIds.length] : [])).reduce((a, b) => a + b, 0),
    action: reasons.some((r) => r.code === 'ActionMissing' && r.tradeId === tradeId),
  };
}

// The card that is open, with the count of the opening it was shown at, and what it shows.
interface Shown {
  readonly tradeId: string;
  readonly opening: number;
  readonly detail: CardDetail;
}

const AFTER_SAVE = {
  Done: 'Every Trade has an Action.',
  Mark: 'A Mark is needed before the next Trade. It is listed in its card.',
  Assembly: 'The Action is saved. Reload the Review to refresh it.',
} as const;

// A card is Done when it owes nothing (A150).
const isOwing = (remaining: Remaining): boolean => remaining.marks > 0 || remaining.reflections > 0 || remaining.action;

// The Marks a card owns: the Review-date rows that name its Trade, and the earlier sessions from the date it is relevant (A153).
function marksOf(review: Ready, tradeId: string): CardMarkRows {
  const family = review.families.find((f) => f.family === 'Marks');
  if (family?.family !== 'Marks') return { today: [], earlier: [] };
  const earlier = family.earlier.flatMap((group) => {
    const from = group.trades.find((t) => t.tradeId === tradeId)?.from;
    if (from === undefined) return [];
    const missing = group.missing.filter((date) => date >= from);
    const acknowledged = group.acknowledged.filter((date) => date >= from);
    return missing.length + acknowledged.length > 0 ? [{ ...group, missing, acknowledged }] : [];
  });
  return { today: family.today.filter((row) => row.trades.includes(tradeId)), earlier };
}

type ViewState =
  | { readonly kind: 'Loading' }
  | { readonly kind: 'Ready'; readonly review: Ready }
  | { readonly kind: 'Empty'; readonly reviewDate: string }
  | { readonly kind: 'Error' };

// A Ready Review: its status, then one card per walked Trade in the overview's attention order (A150).
function ReadyReview({ facade, now, initial, onDirtyChange }: { readonly facade: UiFacade; readonly now: () => string; readonly initial: Ready; readonly onDirtyChange: (dirty: boolean) => void }) {
  // The save's result is the Review from here on; the ref holds the latest, so a read never uses an older binding.
  const [review, setReview] = useState(initial);
  const latest = useRef(initial);
  const apply = (update: (current: Ready) => Ready) => {
    latest.current = update(latest.current);
    setReview(latest.current);
  };
  const trades = walkedTrades(review);
  const underlying = (tradeId: string) => trades.find((t) => t.tradeId === tradeId)?.underlying ?? tradeId;
  // The card that is open: the first card that is not Done opens when the Review loads (A151).
  const [firstId] = useState(() => walkedTrades(initial).find((t) => isOwing(remainingOf(t.tradeId, initial.completion)))?.tradeId);
  const [shown, setShown] = useState<Shown | undefined>(firstId === undefined ? undefined : { tradeId: firstId, opening: 0, detail: 'Loading' });
  // A count of the changes to what is open; each opening carries the count it was shown at, so a result for an earlier opening is not applied.
  const selection = useRef(0);
  const show = (tradeId: string, detail: CardDetail): number => {
    selection.current += 1;
    setShown({ tradeId, opening: selection.current, detail });
    return selection.current;
  };
  // The card the trader pressed, and how many times a card has been asked for: it scrolls into view and takes focus.
  const [reveal, setReveal] = useState({ tradeId: '', count: 0 });
  // What follows a save when no Trade is next, and a refresh that could not be made.
  const [afterSave, setAfterSave] = useState<string>();
  const [failed, setFailed] = useState(false);
  // A refresh of the open card in flight: a card opened meanwhile waits for it, so it is read under the new binding.
  const refreshing = useRef<Promise<unknown> | undefined>(undefined);
  // Reads the Trade for an opening, once any refresh in flight has settled; a result for an earlier opening is dropped.
  const read = useCallback(
    async (tradeId: string, request: number) => {
      await refreshing.current;
      const from = latest.current;
      const result = await facade.DailyReview.getTrade({ reviewDate: from.reviewDate, tradeId, binding: from.binding }).catch(() => undefined);
      if (selection.current === request) setShown({ tradeId, opening: request, detail: result?.kind === 'Ready' ? { trade: result.trade } : 'Unavailable' });
    },
    [facade],
  );
  const select = async (tradeId: string, pressed = false) => {
    setAfterSave(undefined);
    if (pressed) setReveal((current) => ({ tradeId, count: current.count + 1 }));
    await read(tradeId, show(tradeId, 'Loading'));
  };
  // Pressing the open card's header closes it; a read still in flight for it is dropped.
  const collapse = () => {
    selection.current += 1;
    setShown(undefined);
  };
  const openId = shown?.tradeId;
  // The Review asked for again, one at a time; undefined when it could not be produced.
  const inFlight = useRef(false);
  const reopen = async (): Promise<Ready | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    const result = await facade.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: now() }).catch(() => undefined);
    inFlight.current = false;
    return result?.kind === 'Ready' ? result : undefined;
  };
  // The Review and one Trade again, under the new binding. The Trade replaces the shown one without a loading state, so the form keeps its values.
  const refreshTrade = async (tradeId: string): Promise<boolean> => {
    const request = selection.current;
    // A card opened while the Review is being asked for waits for it, so it is read under the binding it returns.
    const asking = reopen().then((next) => {
      if (next) apply(() => next);
      return next;
    });
    refreshing.current = asking;
    const result = await asking;
    if (refreshing.current === asking) refreshing.current = undefined;
    if (!result) return false;
    const trade = await facade.DailyReview.getTrade({ reviewDate: result.reviewDate, tradeId, binding: result.binding }).catch(() => undefined);
    if (trade?.kind !== 'Ready') return false;
    if (selection.current !== request) return true;
    // An Action belongs to one Review Date: the form is keyed by it, so the old date's draft is dropped, and the trader is told.
    // The date the shown form was opened under, not the overview's: a failed read can leave the two apart.
    const shownDate = typeof shown?.detail === 'object' ? shown.detail.trade.saveBinding.reviewDate : undefined;
    if (shownDate !== undefined && trade.trade.saveBinding.reviewDate !== shownDate) setAfterSave(`The Review moved to ${shortDate(result.reviewDate)}. This Trade’s form starts afresh for that date.`);
    setShown({ tradeId, opening: request, detail: { trade: trade.trade } });
    return true;
  };
  // The save's result is the Review from here on: its completion and binding replace the overview's, and its next step is the Trade shown.
  // Only a save for the opening still shown moves the card; the Review it returned applies whatever is open.
  const saved = ({ review: post }: SavedAction, opening: number) => {
    const open = selection.current === opening;
    if (post.kind !== 'Ready') {
      if (open) {
        collapse();
        setAfterSave(AFTER_SAVE.Assembly);
      }
      return;
    }
    apply((current) => ({ ...current, completion: post.completion, binding: post.binding }));
    if (!open) return;
    const next = post.nextStep;
    if (next.kind === 'Trade') {
      setReveal((current) => ({ tradeId: next.trade.tradeId, count: current.count + 1 }));
      show(next.trade.tradeId, { trade: next.trade });
    } else collapse();
    setAfterSave(next.kind === 'Done' ? AFTER_SAVE.Done : next.kind === 'Mark' ? AFTER_SAVE.Mark : undefined);
  };
  // A resolved reflection leaves the card open to show it resolved, so only the overview's completion and binding follow the result.
  const reflectionResolved = (post: PostSaveReview) => {
    if (post.kind === 'Ready') apply((current) => ({ ...current, completion: post.completion, binding: post.binding }));
  };
  // The entries holding a value (Mark drafts, Action and reflection forms); the page is unsaved while any does (A156).
  const dirty = useRef(new Set<string>());
  const [held, setHeld] = useState(false);
  // The trader asked to leave while something was held: the card says why it stays.
  const [refused, setRefused] = useState(false);
  const onEntryDirty = useCallback<EntryDirty>(
    (id, isDirty) => {
      if (isDirty) dirty.current.add(id);
      else dirty.current.delete(id);
      const any = dirty.current.size > 0;
      setHeld(any);
      if (!any) setRefused(false);
      onDirtyChange(any);
    },
    [onDirtyChange],
  );
  const toggle = (tradeId: string) => {
    if (held) setRefused(true);
    else if (tradeId === openId) collapse();
    else void select(tradeId, true);
  };
  // A blocker's link opens the Trade's card.
  const openCard = (tradeId: string) => {
    if (held) setRefused(true);
    else if (tradeId !== openId) void select(tradeId, true);
  };
  // A saved Mark changes what the card's figures and the Action's binding are read at: the Review and the card are read again.
  const [rereading, setRereading] = useState(false);
  const markSaved = () => {
    if (openId === undefined) return;
    setRereading(true);
    void refreshTrade(openId).then((ok) => {
      setFailed(!ok);
      setRereading(false);
    });
  };
  // Only the card open on load is read here; later presses call select themselves.
  useEffect(() => {
    if (firstId !== undefined) void read(firstId, 0);
  }, [firstId, read]);
  return (
    <>
      <Status review={review} completion={review.completion} openTrade={openCard} />
      {failed && (
        <div role="alert" className="banner warning">
          <p>We couldn’t refresh the Review. Nothing was changed.</p>
        </div>
      )}
      <p>Stop ◂ ▸ Target</p>
      <ol aria-label="Positions" className="review-cards">
        {trades.map((trade) => (
          <ReviewCard
            key={trade.tradeId}
            facade={facade}
            trade={trade}
            remaining={remainingOf(trade.tradeId, review.completion)}
            expanded={trade.tradeId === openId}
            detail={trade.tradeId === openId ? shown?.detail : undefined}
            reveal={reveal.tradeId === trade.tradeId ? reveal.count : 0}
            marks={marksOf(review, trade.tradeId)}
            underlying={underlying}
            onToggle={() => toggle(trade.tradeId)}
            onSaved={(result) => saved(result, shown?.opening ?? -1)}
            onReflectionResolved={reflectionResolved}
            onRefresh={() => refreshTrade(trade.tradeId)}
            onMarkSaved={markSaved}
            holdMessage={refused && trade.tradeId === openId}
            pending={rereading}
            onEntryDirty={onEntryDirty}
          />
        ))}
      </ol>
      {afterSave && <p role="status">{afterSave}</p>}
    </>
  );
}

// The Daily Review of the latest completed session: its status, then the position cards. Loading,
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
