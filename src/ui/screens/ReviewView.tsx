import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { MarketDataPrepareEntry, OpenDailyReviewResult, OwedReflectionsTrade, PostSaveReview, SaveReviewMarksResult, WalkedTrade } from '../../app/types.ts';
import { PageTitle } from '../PageTitle.tsx';
import { useRuntime } from '../runtime.tsx';
import { shortDate, tradeName, tradeSummary } from '../format.ts';
import { discardDraftsSetAside } from './action-draft.ts';
import type { SavedAction } from './ActionForm.tsx';
import { DayCard, type OpenCard } from './DayCard.tsx';
import { fold, instrumentOf, nextCard, type Held, type HeldResult } from './held-review.ts';
import { MarksStep, type EntryDirty, type MarksGo } from './MarksStep.tsx';
import type { Draft } from './review-drafts.ts';
import { NO_GO, PANELS, ReviewCard, type CardDetail, type Go, type PanelName } from './ReviewCard.tsx';
import { OwedCard, type OwedDetail } from './ReviewOwedCard.tsx';
import { useMarkDrafts } from './useMarkDrafts.ts';

export interface ReviewViewProps {
  readonly facade: UiFacade;
  readonly now: () => string;
  // Reports whether a Mark value has been entered anywhere on the page (update deferral, D1 A5).
  readonly onDirtyChange: (dirty: boolean) => void;
  // Reports whether the Review holds a Mark draft: the only unsaved work that holds leaving the page (P156).
  readonly onMarkDraftsChange?: (held: boolean) => void;
}

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;

function ReviewDate({ date }: { readonly date: string }) {
  return (
    <p>
      Review Date <time dateTime={date}>{shortDate(date)}</time>
    </p>
  );
}

const walkedTrades = (review: Ready) => review.families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));

// How the Review names a Trade it holds, from one lookup over its walked Trades: `name` in a sentence (A150, "XYZ (Long 100
// shares @ $50.18)"), and `line` for "also held by", the summary line alone (decision 67). The Trade id stands for one it does not hold.
function tradeLabels(trades: readonly WalkedTrade[], owed: readonly OwedReflectionsTrade[]) {
  const find = (tradeId: string) => trades.find((t) => t.tradeId === tradeId);
  return {
    // A Trade of the owed group has no summary line to read, so its Underlying names it.
    name: (tradeId: string) => {
      const found = find(tradeId);
      return found ? tradeName(found) : (owed.find((t) => t.tradeId === tradeId)?.underlying ?? tradeId);
    },
    line: (tradeId: string) => {
      const found = find(tradeId);
      return found?.summary ? tradeSummary(found.summary) : (found?.underlying ?? tradeId);
    },
  };
}

// The card that is open, with the count of the opening it was shown at, and what it shows.
interface Shown {
  readonly tradeId: string;
  readonly opening: number;
  readonly detail: CardDetail | OwedDetail;
}

// A walked card's detail; an owed card's is its own (the two sets of Trades never overlap).
const walkedDetail = (detail: Shown['detail'] | undefined): CardDetail | undefined => (typeof detail === 'object' && 'card' in detail ? undefined : detail);
const owedDetail = (detail: Shown['detail'] | undefined): OwedDetail | undefined => (typeof detail === 'object' && 'trade' in detail ? undefined : detail);

const AFTER_SAVE = {
  Mark: 'A Mark is needed before the next Trade.',
  Assembly: 'The Action is saved. Reload the Review to refresh it.',
} as const;

// The card a link into the Review names, and where in it.
interface LinkedCard {
  // A link into the Marks step names no card: the step's cell for the Instrument, or the step alone.
  readonly marks?: { readonly instrument?: string };
  readonly tradeId?: string;
  readonly panel?: PanelName;
  // The Replay session its slider opens on (A257).
  readonly session?: string;
}

// The card a link's search params name, if the Review holds it (A161): ?trade= picks the card and ?panel= its panel; ?instrument=, or
// ?panel=Marks, goes to the Marks step, to the Instrument's cell when the Review lists it.
function linkedCard(held: Held, params: URLSearchParams): LinkedCard | undefined {
  const review = held.review;
  const instrument = params.get('instrument');
  const wanted = params.get('trade');
  const listed = instrument !== null && instrumentOf(held, instrument) !== undefined;
  // An owed Trade has a Reflections panel alone, which is the one panel that opens.
  if (wanted !== null && review.owed.some((t) => t.tradeId === wanted)) return { tradeId: wanted, panel: 'Reflections' };
  if (listed || (wanted !== null && params.get('panel') === 'Marks')) return { marks: { ...(listed && { instrument }) } };
  if (wanted !== null && walkedTrades(review).some((t) => t.tradeId === wanted)) {
    // An unknown panel name is ignored: the first panel not done opens.
    const panel = PANELS.find((name) => name === params.get('panel'));
    const session = params.get('session');
    return { tradeId: wanted, ...(panel !== undefined && { panel }), ...(session !== null && { session }) };
  }
  return undefined;
}

type MarksSaved = Extract<SaveReviewMarksResult, { kind: 'MarksSaved' }>;
type OpenEmpty = Extract<OpenDailyReviewResult, { kind: 'Empty' }>;

type ViewState =
  | { readonly kind: 'Loading' }
  | { readonly kind: 'Ready'; readonly review: Ready }
  | { readonly kind: 'Empty'; readonly review: Extract<OpenDailyReviewResult, { kind: 'Empty' }> }
  | { readonly kind: 'Error' };

function EmptyReview({ date }: { readonly date: string }) {
  return (
    <section className="card empty">
      <ReviewDate date={date} />
      <p>No Trades were open at this session's close</p>
    </section>
  );
}

// An Empty Review as the screen holds it: nothing walked and nothing to complete, with the group of Trades whose reflections are owed (A90).
const heldEmpty = ({ reviewDate, cutoff, owed, binding }: Extract<OpenDailyReviewResult, { kind: 'Empty' }>): Ready => ({ kind: 'Ready', reviewDate, cutoff, families: [], owed, completion: { kind: 'Complete' }, binding });

// A Ready Review: its status, then one card per walked Trade in the overview's attention order (A150), then the owed-reflection
// group (P20). An Empty Review shows its message in place of the status and the walk.
function ReadyReview({ facade, now, initial, empty: initiallyEmpty = false, onDirtyChange, onMarkDraftsChange }: { readonly facade: UiFacade; readonly now: () => string; readonly initial: Ready; readonly empty?: boolean; readonly onDirtyChange: (dirty: boolean) => void; readonly onMarkDraftsChange?: (held: boolean) => void }) {
  // The held Review (A171): each result is folded into it; the ref holds the latest, so a read never uses an older binding.
  const [heldReview, setHeldReview] = useState<Held>({ review: initial, standings: {} });
  // Whether the Review held is an Empty one: a Review read again can be either.
  const [empty, setEmpty] = useState(initiallyEmpty);
  const review = heldReview.review;
  const latest = useRef(heldReview);
  const apply = (result: HeldResult) => {
    latest.current = fold(latest.current, result);
    setHeldReview(latest.current);
  };
  // The Mark drafts belong to the Review, not to a card (P156); one Save Marks sends them all (P157).
  const markDrafts = useMarkDrafts({ latest: () => latest.current, onResult: apply, onSave: (entries, newest) => saveMarks(entries, newest) });
  // The cards follow the newest Review the screen holds (A150, decision 64): a refreshed Review re-sorts them.
  const trades = walkedTrades(review);
  const { name, line: tradeLine } = tradeLabels(trades, review.owed);
  // A link into the Review names the card that opens on load (A161): ?trade=, or the Marks step's cell for ?instrument=. Otherwise the
  // first card that is not Done opens (A151).
  const [params] = useSearchParams();
  const [link] = useState(() => linkedCard(heldReview, params));
  // Only the way back from Price History (it reopens the overlay) gives a started Action back to its card (C9AR.5).
  const [openedOnWayBack] = useState(() => params.get('replay') === 'open');
  useEffect(() => {
    if (!openedOnWayBack) discardDraftsSetAside();
  }, [openedOnWayBack]);
  // The first card not done, in walk order and then group order (A90), opens when nothing else is named.
  const [firstId] = useState(() => link?.tradeId ?? [...walkedTrades(initial), ...initial.owed].find((t) => !t.progress.done)?.tradeId);
  // The link the open card is to answer, and the card it is for.
  const [go, setGo] = useState<{ readonly tradeId: string | undefined; readonly go: Go }>({ tradeId: link?.tradeId, go: link?.tradeId ? { panel: link.panel, session: link.session, count: 1 } : NO_GO });
  // The Marks step answers a link, or a day line, by choosing its cell, or by adding the skipped sessions' columns.
  const [marksGo, setMarksGo] = useState<MarksGo>(link?.marks ? { count: 1, ...link.marks } : { count: 0 });
  const openMarks = (instrument?: string) => {
    setAfterSave(undefined);
    setMarksGo((current) => ({ count: current.count + 1, ...(instrument !== undefined && { instrument }) }));
  };
  const openSkipped = () => setMarksGo((current) => ({ count: current.count + 1, skipped: true }));
  const [shown, setShown] = useState<Shown | undefined>(firstId === undefined ? undefined : { tradeId: firstId, opening: 0, detail: 'Loading' });
  // A count of the changes to what is open; each opening carries the count it was shown at, so a result for an earlier opening is not applied.
  const selection = useRef(0);
  const show = (tradeId: string, detail: Shown['detail']): number => {
    selection.current += 1;
    setShown({ tradeId, opening: selection.current, detail });
    return selection.current;
  };
  // The card the trader pressed, and how many times a card has been asked for: it scrolls into view and takes focus.
  const [reveal, setReveal] = useState({ tradeId: link?.tradeId ?? '', count: link ? 1 : 0 });
  // The card whose Marks were saved but whose figures could not be read under them (ChangedDuringAssembly).
  const [stale, setStale] = useState(false);
  // What follows a save when no Trade is next, and a refresh that could not be made.
  const [afterSave, setAfterSave] = useState<string>();
  const [failed, setFailed] = useState(false);
  // A refresh of the open card in flight: a card opened meanwhile waits for it, so it is read under the new binding.
  const refreshing = useRef<Promise<unknown> | undefined>(undefined);
  // The Review asked for again and applied (set below, where it is made): the stable `read` calls it through this.
  const reopenApplied = useRef<() => Promise<Ready | OpenEmpty | undefined>>(undefined);
  // Reads the Trade for an opening, once any refresh in flight has settled; a result for an earlier opening is dropped.
  const read = useCallback(
    async (tradeId: string, request: number, keepShown = false) => {
      await refreshing.current;
      const readUnder = (from: Ready) => facade.DailyReview.getTrade({ reviewDate: from.reviewDate, tradeId, binding: from.binding }).catch(() => undefined);
      let result = await readUnder(latest.current.review);
      // Another tab's save leaves the held binding behind, and every card read under it is refused: the Review is read again, and the card with it.
      if (result?.kind === 'ReviewChanged' && (await reopenApplied.current?.())) result = await readUnder(latest.current.review);
      const detail = result?.kind === 'Ready' ? { trade: result.trade } : result?.kind === 'ReflectionsOwed' ? { card: result.card } : 'Unavailable';
      // `keepShown`: a card already open stays as it is when it cannot be read again, as a refresh leaves it.
      if (keepShown && detail === 'Unavailable') return;
      if (selection.current === request) setShown({ tradeId, opening: request, detail });
    },
    [facade],
  );
  // `keepNotice`: Retry opens the card again without clearing the notice that said what the refresh did not keep.
  const select = async (tradeId: string, pressed = false, keepNotice = false) => {
    if (!keepNotice) {
      setAfterSave(undefined);
      setNotKeptNotice(undefined);
    }
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
  // A Ready or an Empty Review is a Review: the screen holds either, as it does when it first opens. Any other result is a failure.
  const inFlight = useRef<Promise<Ready | OpenEmpty | undefined>>(undefined);
  const reopen = (): Promise<Ready | OpenEmpty | undefined> => {
    if (inFlight.current) return inFlight.current;
    const asking = facade.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: now() })
      .catch(() => undefined)
      .then((result) => {
        inFlight.current = undefined;
        return result?.kind === 'Ready' || result?.kind === 'Empty' ? result : undefined;
      });
    inFlight.current = asking;
    return asking;
  };
  // The drafts a Review read again no longer lists are dropped, and the notice names the Trade each was typed in (A150). A Trade the Review
  // no longer holds says so, in the approved words; one it still holds says its draft's key left.
  const [notKeptNotice, setNotKeptNotice] = useState<string>();
  const notKept = (dropped: readonly Draft[]) => {
    if (dropped.length === 0) return;
    const held = latest.current.review;
    const stillHeld = (tradeId: string) => walkedTrades(held).some((t) => t.tradeId === tradeId) || held.owed.some((t) => t.tradeId === tradeId);
    setNotKeptNotice([...new Set(dropped.map((draft) => draft.tradeId))].map((tradeId) => (stillHeld(tradeId) ? `What you entered for ${name(tradeId)} was not kept, because the Review no longer lists it.` : `${name(tradeId)} is no longer in this Review, so what you entered for it was not kept.`)).join(' '));
  };
  // The Review asked for and applied. A card opened while it is pending waits for it, so it is read under the binding it returns.
  const reopenAndApply = async (): Promise<Ready | OpenEmpty | undefined> => {
    const asking = reopen().then((next) => {
      if (next) {
        apply({ kind: 'Opened', review: next.kind === 'Ready' ? next : heldEmpty(next) });
        setEmpty(next.kind === 'Empty');
        notKept(markDrafts.reconcile(latest.current));
      }
      return next;
    });
    refreshing.current = asking;
    const result = await asking;
    if (refreshing.current === asking) refreshing.current = undefined;
    return result;
  };
  useEffect(() => {
    reopenApplied.current = reopenAndApply;
  });
  // The Review and one Trade again, under the new binding. The Trade replaces the shown one without a loading state, so the form keeps its values.
  // The opening the refresh belongs to: the one the save was entered under, or the one shown when it is asked for.
  // Every valid result is followed as the first opening follows it: an Empty or a different Review replaces the held one, and a Trade
  // the new Review holds shows as the card it now is (walked or owed). A Trade it no longer holds closes its card. Only a Review or a
  // Trade that cannot be read is a failure.
  const refreshTrade = async (tradeId: string, request = selection.current, savedDrafts: readonly string[] = []): Promise<boolean> => {
    // What the card holds is read before the new Review is applied, since a card that is removed drops its entries as it goes.
    // The caller names the drafts it has just saved: they are not lost, though their entries have not reported themselves clean yet.
    const label = name(tradeId);
    const drafted = [...dirty.current].some((id) => !savedDrafts.includes(id));
    const wasOwed = latest.current.review.owed.some((t) => t.tradeId === tradeId);
    const result = await reopenAndApply();
    if (!result) return false;
    const held = latest.current.review;
    if (!walkedTrades(held).some((t) => t.tradeId === tradeId) && !held.owed.some((t) => t.tradeId === tradeId)) {
      setStale(false);
      if (selection.current === request) {
        collapse();
        // Any message about this card (an Action saved, a draft to save or discard) has no card to act on now.
        setAfterSave(drafted ? `${label} is no longer in this Review, so what you entered for it was not kept.` : undefined);
      }
      return true;
    }
    const trade = await facade.DailyReview.getTrade({ reviewDate: result.reviewDate, tradeId, binding: result.binding }).catch(() => undefined);
    // The Trade has moved from the walk to the owed group: its owed card replaces the walked one, with none of its drafts.
    if (selection.current === request && !wasOwed && latest.current.review.owed.some((t) => t.tradeId === tradeId)) {
      setAfterSave(drafted ? `${label} is now in Trades with owed reflections, so what you entered for it was not kept.` : undefined);
      // The owed card has no body to show without the Trade, so it says so and offers Retry. The button that was pressed went with the
      // walked card, so the focus goes to the owed card here.
      if (trade?.kind !== 'Ready' && trade?.kind !== 'ReflectionsOwed') {
        setShown({ tradeId, opening: request, detail: 'Unavailable' });
        setReveal((current) => ({ tradeId, count: current.count + 1 }));
      }
    }
    if (trade?.kind !== 'Ready' && trade?.kind !== 'ReflectionsOwed') return false;
    setStale(false);
    if (selection.current !== request) return true;
    if (trade.kind === 'ReflectionsOwed') {
      setShown({ tradeId, opening: request, detail: { card: trade.card } });
      return true;
    }
    // An Action belongs to one Review Date: the form is keyed by it, so the old date's draft is dropped, and the trader is told.
    // The date the shown form was opened under, not the overview's: a failed read can leave the two apart.
    const shownDate = typeof shown?.detail === 'object' && 'trade' in shown.detail ? shown.detail.trade.saveBinding.reviewDate : undefined;
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
      apply({ kind: 'ActionSaved', review: post });
      setAfterSave(`The Action is saved. Save or discard what you entered for ${name(openId)} to go on.`);
      void refreshTrade(openId, opening, [`action:${openId}`]).then((ok) => setFailed(!ok));
      return;
    }
    if (post.kind !== 'Ready') {
      if (open) {
        collapse();
        setAfterSave(AFTER_SAVE.Assembly);
      }
      return;
    }
    apply({ kind: 'ActionSaved', review: post });
    if (!open) return;
    const next = nextCard(latest.current, post.nextStep);
    setGo({ tradeId: undefined, go: NO_GO });
    // A Mark is the next step: the Marks step's cell for it takes focus, as a day line's link does.
    if (next.kind === 'Mark') {
      collapse();
      openMarks(next.instrumentKey);
      return;
    }
    if (next.kind === 'Trade') {
      setReveal((current) => ({ tradeId: next.trade.tradeId, count: current.count + 1 }));
      show(next.trade.tradeId, { trade: next.trade });
    } else if (next.kind === 'OwedTrade') {
      // The first owed card not done follows the walk (A90): it opens from the step's card, as the next walked Trade does.
      setReveal((current) => ({ tradeId: next.card.tradeId, count: current.count + 1 }));
      show(next.card.tradeId, { card: next.card });
    } else collapse();
    setAfterSave(next.kind === 'MarkNotHeld' ? AFTER_SAVE.Mark : undefined);
  };
  // A resolved reflection leaves the card open to show it resolved, so only the overview's completion and binding follow the result.
  const reflectionResolved = (post: PostSaveReview) => apply({ kind: 'DebtResolved', review: post });
  // The entries holding a value (a Correct, Action, Debt and reflection forms) hold the open card (A156); the page is unsaved while
  // any does, or while any Mark draft exists (P156).
  const dirty = useRef(new Set<string>());
  // The corrections in progress in the Marks step: they hold the page, not a card.
  const markEdits = useRef(new Set<string>());
  const [held, setHeld] = useState(false);
  const { writable } = useRuntime();
  // A read-only shell shows no draft fields and no Discard, so its drafts hold nothing: they stay unsaved in state.
  const draftsHeld = writable && markDrafts.count > 0;
  const draftsReported = useRef(draftsHeld);
  const reportDirty = useRef(onDirtyChange);
  useEffect(() => {
    reportDirty.current = onDirtyChange;
  }, [onDirtyChange]);
  useEffect(() => {
    if (draftsReported.current === draftsHeld) return;
    draftsReported.current = draftsHeld;
    reportDirty.current(dirty.current.size > 0 || markEdits.current.size > 0 || draftsHeld);
  }, [draftsHeld]);
  const reportMarks = useRef(onMarkDraftsChange);
  useEffect(() => {
    reportMarks.current = onMarkDraftsChange;
  }, [onMarkDraftsChange]);
  useEffect(() => {
    reportMarks.current?.(draftsHeld);
  }, [draftsHeld]);
  // The page is no longer unsaved once the Review is gone.
  useEffect(
    () => () => {
      if (draftsReported.current) reportDirty.current(false);
      reportMarks.current?.(false);
    },
    [],
  );
  // The trader asked to leave while something was held: the card says why it stays.
  const [refused, setRefused] = useState(false);
  const onEntryDirty = useCallback<EntryDirty>(
    (id, isDirty) => {
      if (isDirty) dirty.current.add(id);
      else dirty.current.delete(id);
      const any = dirty.current.size > 0;
      setHeld(any);
      if (!any) setRefused(false);
      onDirtyChange(any || markEdits.current.size > 0 || draftsReported.current);
    },
    [onDirtyChange],
  );
  const onMarksEntryDirty = useCallback<EntryDirty>(
    (id, isDirty) => {
      if (isDirty) markEdits.current.add(id);
      else markEdits.current.delete(id);
      onDirtyChange(dirty.current.size > 0 || markEdits.current.size > 0 || draftsReported.current);
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
  // A day line's link opens the card and panel that resolve it (A161). Another panel of the open card is no departure, so it is allowed while the card holds drafts.
  const openCard: OpenCard = (tradeId, panel) => {
    if (tradeId !== openId) {
      if (held) {
        setRefused(true);
        return;
      }
      void select(tradeId, true);
    }
    setGo((current) => ({ tradeId, go: { panel, count: current.go.count + 1 } }));
  };
  // A change of the search params while the Review is mounted (a navigate, browser history) opens the card they name, as a link
  // does; it only acts on a changed search string, not on an unrelated render.
  // The overlay's `replay` and its `session` come and go with the card's own Replay button, so they are no link (A274).
  const searchOf = (p: URLSearchParams) => {
    const link = new URLSearchParams(p);
    link.delete('replay');
    link.delete('session');
    return link.toString();
  };
  const appliedSearch = useRef(searchOf(params));
  useEffect(() => {
    const search = searchOf(params);
    // The overlay opening or closing changes only `replay` and `session`, which `searchOf` leaves out: that is no link.
    if (search === appliedSearch.current) return;
    appliedSearch.current = search;
    const next = linkedCard(latest.current, params);
    if (next?.marks) openMarks(next.marks.instrument);
    else if (next?.tradeId) openCard(next.tradeId, next.panel);
  });
  // A saved Mark changes what the card's figures and the Action's binding are read at: the Review and the card are read again.
  const [rereading, setRereading] = useState(false);
  const markSaved = (draftId: string) => {
    setRereading(true);
    const finished = (ok: boolean) => {
      setFailed(!ok);
      setRereading(false);
    };
    // With no card open, the Review alone is read again.
    if (openId === undefined || shown === undefined) {
      void reopenAndApply().then((next) => {
        // A Review that read cleanly makes the figures current again, so an earlier out-of-date notice goes.
        if (next !== undefined) setStale(false);
        finished(next !== undefined);
      });
      return;
    }
    // The opening is this render's: a Mark saved here finishes after another card opened, and must not replace it.
    void refreshTrade(openId, shown.opening, [draftId]).then(finished);
  };
  // Save Marks (P37): one command for the open card, under the newest binding the screen holds.
  // The saved Marks and the Review under them are the screen's from here on, with no read (P38, A157): the Trades re-sort,
  // and the open card shows its refreshed Trade in place, keeping what was entered in it. The open card stays open even when it is no longer first.
  const marksSaved = ({ marks, review: post }: MarksSaved, opening: number, tradeId: string) => {
    apply({ kind: 'MarksSaved', marks, review: post });
    if (post.kind !== 'Ready') {
      // The Marks are saved, but the Review under them could not be read: the card says so until Refresh.
      setStale(true);
      return;
    }
    // A Review that read cleanly makes the figures current again, so an earlier out-of-date notice goes.
    setStale(false);
    if (selection.current !== opening) return;
    // The returned card is the first Trade's, which is not always the one open: the open card stays open and is read under the new binding.
    if (post.trade.tradeId === tradeId) setShown({ tradeId, opening, detail: { trade: post.trade } });
    else void read(tradeId, opening, true);
  };
  // Its Trade chooses the card the saved Review refreshes: the open walked card's, or, with none open or an owed card open (which the Marks
  // save cannot read), the Trade the newest draft was typed in.
  const saveMarks = async (entries: readonly MarketDataPrepareEntry[], newest: string | undefined): Promise<SaveReviewMarksResult> => {
    const from = latest.current.review;
    const walkedOpen = openId !== undefined && walkedTrades(from).some((t) => t.tradeId === openId);
    // The card shown is replaced by the refreshed one only when it is the Trade saved from.
    const opening = walkedOpen ? (shown?.opening ?? -1) : -1;
    const tradeId = (walkedOpen ? openId : newest) ?? openId ?? '';
    const result = await facade.DailyReview.save({ kind: 'SaveReviewMarks', reviewDate: from.reviewDate, binding: from.binding, entries });
    if (result.kind === 'MarksSaved') marksSaved(result, opening, tradeId);
    return result;
  };
  // Refresh from the header: the open (owed) card's refresh, else the Review alone.
  // How many times the page was read again from Refresh: the Marks step takes its skipped sessions afresh each time.
  const [reads, setReads] = useState(0);
  const refreshHeld = async (): Promise<boolean> => {
    if (openId !== undefined) {
      const refreshed = await refreshTrade(openId);
      if (refreshed) setReads((n) => n + 1);
      return refreshed;
    }
    const next = await reopenAndApply();
    if (next === undefined) return false;
    setStale(false);
    setReads((n) => n + 1);
    return true;
  };
  // Only the card open on load is read here; later presses call select themselves.
  useEffect(() => {
    if (firstId !== undefined) void read(firstId, 0);
  }, [firstId, read]);
  return (
    <>
      {empty ? <EmptyReview date={review.reviewDate} /> : <DayCard review={review} name={name} openCard={openCard} openMarks={openMarks} openSkipped={openSkipped} />}
      {failed && (
        <div role="alert" className="banner warning">
          <p>We couldn’t refresh the Review. Nothing was changed.</p>
        </div>
      )}
      {!empty && (
        <MarksStep facade={facade} held={heldReview} onResult={apply} tradeLine={tradeLine} onEntryDirty={onMarksEntryDirty} onMarkSaved={markSaved} markDrafts={markDrafts} outOfDate={stale} reads={reads} onRefresh={refreshHeld} go={marksGo} onFolded={() => trades[0] && setReveal((current) => ({ tradeId: trades[0]!.tradeId, count: current.count + 1 }))} />
      )}
      {!empty && (
        <>
          <h2>Trades · most pressing first</h2>
          <ol aria-label="Positions" className="review-cards">
            {trades.map((trade) => (
              <ReviewCard
                key={trade.tradeId}
                facade={facade}
                trade={trade}
                line={review.day?.lines.find((line) => line.tradeId === trade.tradeId)}
                expanded={trade.tradeId === openId}
                detail={trade.tradeId === openId ? walkedDetail(shown?.detail) : undefined}
                reveal={reveal.tradeId === trade.tradeId ? reveal.count : 0}
                go={go.tradeId === trade.tradeId ? go.go : NO_GO}
                onToggle={() => toggle(trade.tradeId)}
                onSaved={(result) => saved(result, shown?.opening ?? -1)}
                onReflectionResolved={reflectionResolved}
                onRefresh={() => refreshTrade(trade.tradeId)}
                holdMessage={refused && trade.tradeId === openId}
                pending={rereading}
                onEntryDirty={onEntryDirty}
              />
            ))}
          </ol>
        </>
      )}
      {review.owed.length > 0 && (
        <section aria-labelledby="owed-group-heading">
          <h2 id="owed-group-heading">Trades with owed reflections</h2>
          <ol aria-labelledby="owed-group-heading" className="review-cards">
            {review.owed.map((trade) => (
              <OwedCard
                key={trade.tradeId}
                facade={facade}
                trade={trade}
                reviewDate={review.reviewDate}
                expanded={trade.tradeId === openId}
                detail={trade.tradeId === openId ? owedDetail(shown?.detail) : undefined}
                reveal={reveal.tradeId === trade.tradeId ? reveal.count : 0}
                go={go.tradeId === trade.tradeId ? go.go : NO_GO}
                holdMessage={refused && trade.tradeId === openId}
                onToggle={() => toggle(trade.tradeId)}
                onRetry={() => void select(trade.tradeId, true, true)}
                onReflectionResolved={reflectionResolved}
                onEntryDirty={onEntryDirty}
              />
            ))}
          </ol>
        </section>
      )}
      {afterSave && <p role="status">{afterSave}</p>}
      {notKeptNotice && <p role="status">{notKeptNotice}</p>}
    </>
  );
}

// The Daily Review of the latest completed session: its status, then the position cards. Loading,
// Ready, Empty, and Error stay distinct, so a failure or a wait is never shown as an empty Review.
export function ReviewView({ facade, now, onDirtyChange, onMarkDraftsChange }: ReviewViewProps) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ readonly attempt: number; readonly state: ViewState }>();
  useEffect(() => {
    let current = true;
    const settle = (state: ViewState) => {
      if (current) setSettled({ attempt, state });
    };
    facade.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: now() }).then(
      (result) => settle(result.kind === 'Ready' ? { kind: 'Ready', review: result } : result.kind === 'Empty' ? { kind: 'Empty', review: result } : { kind: 'Error' }),
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
      {state.kind === 'Empty' && (state.review.owed.length === 0 ? <EmptyReview date={state.review.reviewDate} /> : <ReadyReview facade={facade} now={now} initial={heldEmpty(state.review)} empty onDirtyChange={onDirtyChange} onMarkDraftsChange={onMarkDraftsChange} />)}
      {state.kind === 'Ready' && <ReadyReview facade={facade} now={now} initial={state.review} onDirtyChange={onDirtyChange} onMarkDraftsChange={onMarkDraftsChange} />}
    </section>
  );
}
