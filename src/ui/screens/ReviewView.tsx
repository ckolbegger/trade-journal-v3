import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { IncompleteReason, MarketDataPrepareEntry, OpenDailyReviewResult, PostSaveReview, ReviewCompletion, SavedMark, SaveReviewMarksResult } from '../../app/types.ts';
import { PageTitle } from '../PageTitle.tsx';
import { shortDate } from '../format.ts';
import type { SavedAction } from './ActionForm.tsx';
import type { CardMarkRows, EntryDirty } from './CardMarks.tsx';
import { NO_GO, PANELS, ReviewCard, type CardDetail, type Go, type PanelName, type Remaining } from './ReviewCard.tsx';

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

// Opens a card, on a panel and an Instrument's row when they are named (A161).
type OpenCard = (tradeId: string, panel?: PanelName, instrument?: string) => void;

// The first card, in attention order, holding the Instrument: its Review-date row or an earlier session names the Trade.
function holderOf(review: Ready, instrumentKey: string): string | undefined {
  const family = review.families.find((f) => f.family === 'Marks');
  if (family?.family !== 'Marks') return undefined;
  const holding = new Set([...family.today.filter((row) => row.instrumentKey === instrumentKey).flatMap((row) => row.trades), ...family.earlier.filter((group) => group.instrumentKey === instrumentKey).flatMap((group) => group.trades.map((t) => t.tradeId))]);
  return walkedTrades(review).find((t) => holding.has(t.tradeId))?.tradeId;
}

// A link that opens the card; it stays a real link, so it can be opened in a new tab.
function CardLink({ tradeId, open, panel, instrument, children }: { readonly tradeId: string; readonly open: OpenCard; readonly panel?: PanelName; readonly instrument?: string; readonly children: ReactNode }) {
  let href = `/review?trade=${tradeId}`;
  if (instrument !== undefined) href += `&instrument=${encodeURIComponent(instrument)}`;
  else if (panel !== undefined) href += `&panel=${panel}`;
  return (
    <a
      href={href}
      onClick={(event) => {
        // A new-tab or new-window click is the browser's: the href names the same card, panel and row.
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        open(tradeId, panel, instrument);
      }}
    >
      {children}
    </a>
  );
}

// The Trade a blocker names, by its Underlying; each opens the card and panel that resolve it (A161).
function blockerText(reason: IncompleteReason, review: Ready, underlying: (tradeId: string) => string, open: OpenCard): ReactNode {
  switch (reason.code) {
    case 'MarkMissing': {
      const tradeId = walkedTrades(review).find((t) => reason.trades.includes(t.tradeId))?.tradeId;
      const date = shortDate(reason.tradingDate);
      if (tradeId === undefined) return `Mark missing for ${reason.instrumentKey} on ${date}`;
      return (
        <>
          Mark missing for{' '}
          <CardLink tradeId={tradeId} open={open} panel="Marks" instrument={reason.instrumentKey}>
            {reason.instrumentKey}
          </CardLink>{' '}
          on {date}
        </>
      );
    }
    case 'ActionMissing':
      return (
        <>
          Action missing for{' '}
          <CardLink tradeId={reason.tradeId} open={open} panel="Action">
            {underlying(reason.tradeId)}
          </CardLink>
        </>
      );
    // The Trade links to its card, where the reflections are resolved (A71).
    case 'ReflectionDue':
      return (
        <>
          {reason.debtIds.length === 1 ? 'Reflection' : `${reason.debtIds.length} reflections`} due for{' '}
          <CardLink tradeId={reason.tradeId} open={open} panel="Reflections">
            {underlying(reason.tradeId)}
          </CardLink>
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

// The blockers with Missing Marks first (P36), the rest in the order the Review gave them.
const marksFirst = (reasons: readonly IncompleteReason[]): IncompleteReason[] => [...reasons.filter((r) => r.code === 'MarkMissing'), ...reasons.filter((r) => r.code !== 'MarkMissing')];

function Status({ review, completion, openCard }: { readonly review: Ready; readonly completion: ReviewCompletion; readonly openCard: OpenCard }) {
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
          {marksFirst(completion.reasons).map((reason, i) => (
            <li key={i}>{blockerText(reason, review, underlying, openCard)}</li>
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

// The card a link into the Review names, and where in it.
interface LinkedCard {
  readonly tradeId: string;
  readonly panel?: PanelName;
  readonly instrument?: string;
}

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

type MarksSaved = Extract<SaveReviewMarksResult, { kind: 'MarksSaved' }>;

// The Review's Marks family after a Marks save: each saved key's resolution and revision on its Review-date row, and a
// saved earlier session out of its Instrument's gap list (an acknowledged one stays, listed as acknowledged). The gap groups
// are rebuilt at the next `open` (P38); until then no card holding the key shows it as it was.
function withSavedMarks(review: Ready, saved: readonly SavedMark[]): Ready {
  const savedFor = (instrumentKey: string, tradingDate: string) => saved.find((m) => m.key.instrumentKey === instrumentKey && m.key.tradingDate === tradingDate);
  return {
    ...review,
    families: review.families.map((family) => {
      if (family.family !== 'Marks') return family;
      const today = family.today.map((row) => {
        const mark = savedFor(row.instrumentKey, row.tradingDate);
        return mark ? { ...row, resolution: mark.resolution, resolutionRevision: mark.resolutionRevision, task: mark.resolution.kind === 'Missing' ? ('Manual' as const) : null } : row;
      });
      const earlier = family.earlier.map((group) => {
        const marked = [...group.missing, ...group.acknowledged].flatMap((date) => {
          const mark = savedFor(group.instrumentKey, date);
          return mark ? [{ date, mark }] : [];
        });
        if (marked.length === 0) return group;
        const dates = new Set(marked.map((m) => m.date));
        const acknowledgments = { ...group.acknowledgments };
        const revisions = { ...group.revisions };
        const acknowledged = group.acknowledged.filter((date) => !dates.has(date));
        for (const { date, mark } of marked) {
          revisions[date] = mark.resolutionRevision;
          if (mark.resolution.kind === 'AcknowledgedUnavailable') {
            acknowledgments[date] = mark.resolution.acknowledgment;
            acknowledged.push(date);
          }
        }
        return { ...group, missing: group.missing.filter((date) => !dates.has(date)), acknowledged, revisions, acknowledgments };
      });
      return { ...family, today, earlier };
    }),
  };
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
  // The cards follow the newest Review the screen holds (A150, decision 64): a refreshed Review re-sorts them.
  const trades = walkedTrades(review);
  const underlying = (tradeId: string) => trades.find((t) => t.tradeId === tradeId)?.underlying ?? tradeId;
  // A link into the Review names the card that opens on load (A161): the first holding ?instrument=, on its Marks panel with
  // focus on the row, or ?trade=. Otherwise the first card that is not Done opens (A151).
  const [params] = useSearchParams();
  const [link] = useState((): LinkedCard | undefined => {
    const instrument = params.get('instrument');
    const wanted = params.get('trade');
    // The Trade picks the card and the Instrument its row, when that card holds the Instrument.
    if (wanted !== null && walkedTrades(initial).some((t) => t.tradeId === wanted)) {
      const marks = marksOf(initial, wanted);
      const holds = instrument !== null && (marks.today.some((row) => row.instrumentKey === instrument) || marks.earlier.some((group) => group.instrumentKey === instrument));
      if (holds) return { tradeId: wanted, panel: 'Marks', instrument };
      // An unknown panel name is ignored: the first panel not done opens.
      const panel = PANELS.find((name) => name === params.get('panel'));
      return panel === undefined ? { tradeId: wanted } : { tradeId: wanted, panel };
    }
    const holder = instrument === null ? undefined : holderOf(initial, instrument);
    return instrument !== null && holder !== undefined ? { tradeId: holder, panel: 'Marks', instrument } : undefined;
  });
  const [firstId] = useState(() => link?.tradeId ?? walkedTrades(initial).find((t) => isOwing(remainingOf(t.tradeId, initial.completion)))?.tradeId);
  // The link the open card is to answer, and the card it is for.
  const [go, setGo] = useState<{ readonly tradeId: string | undefined; readonly go: Go }>({ tradeId: link?.tradeId, go: link ? { panel: link.panel, instrument: link.instrument, count: 1 } : NO_GO });
  const [shown, setShown] = useState<Shown | undefined>(firstId === undefined ? undefined : { tradeId: firstId, opening: 0, detail: 'Loading' });
  // A count of the changes to what is open; each opening carries the count it was shown at, so a result for an earlier opening is not applied.
  const selection = useRef(0);
  const show = (tradeId: string, detail: CardDetail): number => {
    selection.current += 1;
    setShown({ tradeId, opening: selection.current, detail });
    return selection.current;
  };
  // The card the trader pressed, and how many times a card has been asked for: it scrolls into view and takes focus.
  const [reveal, setReveal] = useState({ tradeId: link?.tradeId ?? '', count: link ? 1 : 0 });
  // The card whose Marks were saved but whose figures could not be read under them (ChangedDuringAssembly).
  const [stale, setStale] = useState<string>();
  // How many times Save Marks has finished on a card: it moves on to its next panel that is not done (A157).
  const [advance, setAdvance] = useState({ tradeId: '', count: 0 });
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
  // The Review asked for again, one at a time: a request made while one is in flight shares its answer, so two quick saves
  // are both refreshed. Undefined when it could not be produced.
  const inFlight = useRef<Promise<Ready | undefined>>(undefined);
  const reopen = (): Promise<Ready | undefined> => {
    if (inFlight.current) return inFlight.current;
    const asking = facade.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: now() })
      .catch(() => undefined)
      .then((result) => {
        inFlight.current = undefined;
        return result?.kind === 'Ready' ? result : undefined;
      });
    inFlight.current = asking;
    return asking;
  };
  // The Review and one Trade again, under the new binding. The Trade replaces the shown one without a loading state, so the form keeps its values.
  // The opening the refresh belongs to: the one the save was entered under, or the one shown when it is asked for.
  const refreshTrade = async (tradeId: string, request = selection.current): Promise<boolean> => {
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
    setStale(undefined);
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
    // The card holds other entered values (a Mark draft, a reflection draft): going on would lose them (A156). The card stays,
    // read again so its Action shows as saved, and says why.
    if (open &&openId !== undefined && [...dirty.current].some((id) => id !== `action:${openId}`)) {
      if (post.kind === 'Ready') apply((current) => ({ ...current, completion: post.completion, binding: post.binding }));
      setAfterSave(`The Action is saved. Save or discard what you entered for ${underlying(openId)} to go on.`);
      void refreshTrade(openId, opening).then((ok) => setFailed(!ok));
      return;
    }
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
    setGo({ tradeId: undefined, go: NO_GO });
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
    else {
      // A card opened by its header answers no earlier link.
      setGo({ tradeId: undefined, go: NO_GO });
      if (tradeId === openId) collapse();
      else void select(tradeId, true);
    }
  };
  // A blocker's link opens the card and panel that resolve it (A161). Another panel of the open card is no departure, so it is allowed while the card holds drafts.
  const openCard: OpenCard = (tradeId, panel, instrument) => {
    if (tradeId !== openId) {
      if (held) {
        setRefused(true);
        return;
      }
      void select(tradeId, true);
    }
    setGo((current) => ({ tradeId, go: { panel, instrument, count: current.go.count + 1 } }));
  };
  // A saved Mark changes what the card's figures and the Action's binding are read at: the Review and the card are read again.
  const [rereading, setRereading] = useState(false);
  const markSaved = () => {
    if (openId === undefined || shown === undefined) return;
    setRereading(true);
    // The opening is this render's: a Mark saved here finishes after another card opened, and must not replace it.
    void refreshTrade(openId, shown.opening).then((ok) => {
      setFailed(!ok);
      setRereading(false);
    });
  };
  // Save Marks (P37): one command for the open card, under the newest binding the screen holds.
  // The saved Marks and the Review under them are the screen's from here on, with no read (P38, A157): the Trades re-sort,
  // and the open card shows its refreshed Trade in place, keeping what was entered in it.
  const marksSaved = ({ marks, review: post }: MarksSaved, opening: number, tradeId: string) => {
    apply((current) => withSavedMarks(current, marks));
    if (post.kind !== 'Ready') {
      // The Marks are saved, but the Review under them could not be read: the card says so until Refresh.
      setStale(tradeId);
      return;
    }
    // A Review that read cleanly makes the figures current again, so an earlier out-of-date notice goes.
    setStale(undefined);
    apply((current) => ({ ...current, completion: post.completion, binding: post.binding, families: current.families.map((f) => (f.family === 'Trades' ? { ...f, trades: post.trades } : f)) }));
    if (selection.current !== opening) return;
    setShown({ tradeId: post.trade.tradeId, opening, detail: { trade: post.trade } });
    setAdvance((current) => ({ tradeId: post.trade.tradeId, count: current.count + 1 }));
  };
  const saveMarks = async (entries: readonly MarketDataPrepareEntry[]): Promise<SaveReviewMarksResult> => {
    const from = latest.current;
    const opening = shown?.opening ?? -1;
    const result = await facade.DailyReview.save({ kind: 'SaveReviewMarks', reviewDate: from.reviewDate, tradeId: openId ?? '', binding: from.binding, entries });
    if (result.kind === 'MarksSaved') marksSaved(result, opening, openId ?? '');
    return result;
  };
  // Only the card open on load is read here; later presses call select themselves.
  useEffect(() => {
    if (firstId !== undefined) void read(firstId, 0);
  }, [firstId, read]);
  return (
    <>
      <Status review={review} completion={review.completion} openCard={openCard} />
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
            advance={advance.tradeId === trade.tradeId ? advance.count : 0}
            go={go.tradeId === trade.tradeId ? go.go : NO_GO}
            marks={marksOf(review, trade.tradeId)}
            underlying={underlying}
            onToggle={() => toggle(trade.tradeId)}
            onSaved={(result) => saved(result, shown?.opening ?? -1)}
            onReflectionResolved={reflectionResolved}
            onRefresh={() => refreshTrade(trade.tradeId)}
            onMarkSaved={markSaved}
            onSaveMarks={saveMarks}
            outOfDate={stale === trade.tradeId}
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
