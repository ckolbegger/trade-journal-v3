import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Link, useSearchParams } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { IncompleteReason, MarketDataPrepareEntry, OpenDailyReviewResult, OwedReflectionsTrade, PostSaveReview, ReviewCompletion, SaveReviewMarksResult, WalkedTrade } from '../../app/types.ts';
import { instrumentKey } from '../../domain/instrument/index.ts';
import { instrumentLabel, isMarkMissingBlocker, isSettlementDueBlocker, text, unavailableWords } from '../calculation-words.ts';
import { PageTitle } from '../PageTitle.tsx';
import { useRuntime } from '../runtime.tsx';
import { shortDate, tradeName, tradeSummary } from '../format.ts';
import type { SavedAction } from './ActionForm.tsx';
import type { EntryDirty } from './CardMarks.tsx';
import { fold, marksOf, nextCard, type Held, type HeldResult } from './held-review.ts';
import { NO_GO, PANELS, ReviewCard, type CardDetail, type Go, type PanelName } from './ReviewCard.tsx';
import { OwedCard, type OwedDetail } from './ReviewOwedCard.tsx';

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

// The Trade a blocker names, by its name (A150); each opens the card and panel that resolve it (A161).
function blockerText(reason: IncompleteReason, review: Ready, name: (tradeId: string) => string, open: OpenCard, timeZone: string): ReactNode {
  if (isMarkMissingBlocker(reason)) {
    const tradeId = walkedTrades(review).find((t) => reason.trades.includes(t.tradeId))?.tradeId;
    // The sentence is the module's; its Instrument part is the card link.
    const parts = unavailableWords({ reason: 'MarkMissing', instrument: reason.instrument, date: reason.tradingDate }, 'sentence', timeZone);
    return parts.map((part, i) =>
      part.kind === 'instrument' && tradeId !== undefined ? (
        <CardLink key={i} tradeId={tradeId} open={open} panel="Marks" instrument={instrumentKey(part.instrument)}>
          {text([part])}
        </CardLink>
      ) : (
        <Fragment key={i}>{text([part])}</Fragment>
      ),
    );
  }
  // The settlement's sentence is the module's too; its contract is the link to the card's Settlement panel (row 24.5).
  if (isSettlementDueBlocker(reason)) {
    const parts = unavailableWords({ reason: 'SettlementDue', instrument: reason.instrument, expiration: reason.expiration }, 'sentence', timeZone);
    return parts.map((part, i) =>
      part.kind === 'instrument' ? (
        <CardLink key={i} tradeId={reason.tradeId} open={open} panel="Settlement">
          {text([part])}
        </CardLink>
      ) : (
        <Fragment key={i}>{text([part])}</Fragment>
      ),
    );
  }
  switch (reason.code) {
    case 'ActionMissing':
      return (
        <>
          Action missing for{' '}
          <CardLink tradeId={reason.tradeId} open={open} panel="Action">
            {name(reason.tradeId)}
          </CardLink>
        </>
      );
    // The Trade links to its card, where the reflections are resolved (A71).
    case 'ReflectionDue':
      return (
        <>
          {reason.debtIds.length === 1 ? 'Reflection' : `${reason.debtIds.length} reflections`} due for{' '}
          <CardLink tradeId={reason.tradeId} open={open} panel="Reflections">
            {name(reason.tradeId)}
          </CardLink>
        </>
      );
    case 'IntegrityDisagreement':
      return `${name(reason.tradeId)}: recorded facts disagree`;
    case 'IncoherentFacts':
      // The Trade links to its Detail, where each finding is listed; the sentence is the module's.
      return (
        <>
          <Link to={`/trades/${reason.tradeId}`}>{name(reason.tradeId)}</Link>: {text(unavailableWords({ reason: 'FactsIncoherent', findings: reason.findings }, 'sentence', timeZone))}
        </>
      );
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
const marksFirst = (reasons: readonly IncompleteReason[]): IncompleteReason[] => [...reasons.filter(isMarkMissingBlocker), ...reasons.filter((r) => !isMarkMissingBlocker(r))];

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

function Status({ review, completion, name, openCard }: { readonly review: Ready; readonly completion: ReviewCompletion; readonly name: (tradeId: string) => string; readonly openCard: OpenCard }) {
  const { timeZone } = useRuntime();
  return (
    <section className="card" aria-label="Review status">
      <ReviewDate date={review.reviewDate} />
      <p>
        <strong>{COMPLETION_TEXT[completion.kind]}</strong>
      </p>
      {completion.kind === 'CompleteWithUnavailableMarks' && (
        <div role="group" aria-label="Unavailable Marks">
          <p>Instruments: {completion.instruments.map(instrumentLabel).join(', ')}</p>
          <p>Trades: {completion.trades.map(name).join(', ')}</p>
          <p>Not calculated: {completion.families.map((family) => FAMILY_TEXT[family]).join(', ')}</p>
        </div>
      )}
      {completion.kind === 'Incomplete' && (
        <ul aria-label="Blockers">
          {marksFirst(completion.reasons).map((reason, i) => (
            <li key={i}>{blockerText(reason, review, name, openCard, timeZone ?? 'UTC')}</li>
          ))}
        </ul>
      )}
    </section>
  );
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

// The card a link's search params name, if the Review holds it (A161): ?trade= picks the card, ?instrument= its Marks row when
// that card holds the Instrument, else ?panel=; ?instrument= alone picks the first card holding it.
function linkedCard(held: Held, params: URLSearchParams): LinkedCard | undefined {
  const review = held.review;
  const instrument = params.get('instrument');
  const wanted = params.get('trade');
  // An owed Trade has a Reflections panel alone, which is the one panel that opens.
  if (wanted !== null && review.owed.some((t) => t.tradeId === wanted)) return { tradeId: wanted, panel: 'Reflections' };
  if (wanted !== null && walkedTrades(review).some((t) => t.tradeId === wanted)) {
    const marks = marksOf(held, wanted);
    const holds = instrument !== null && (marks.today.some((row) => row.instrumentKey === instrument) || marks.earlier.some((group) => group.instrumentKey === instrument));
    if (holds) return { tradeId: wanted, panel: 'Marks', instrument };
    // An unknown panel name is ignored: the first panel not done opens.
    const panel = PANELS.find((name) => name === params.get('panel'));
    return panel === undefined ? { tradeId: wanted } : { tradeId: wanted, panel };
  }
  const holder = instrument === null ? undefined : holderOf(review, instrument);
  return instrument !== null && holder !== undefined ? { tradeId: holder, panel: 'Marks', instrument } : undefined;
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
function ReadyReview({ facade, now, initial, empty: initiallyEmpty = false, onDirtyChange }: { readonly facade: UiFacade; readonly now: () => string; readonly initial: Ready; readonly empty?: boolean; readonly onDirtyChange: (dirty: boolean) => void }) {
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
  // The cards follow the newest Review the screen holds (A150, decision 64): a refreshed Review re-sorts them.
  const trades = walkedTrades(review);
  const { name, line: tradeLine } = tradeLabels(trades, review.owed);
  // A link into the Review names the card that opens on load (A161): the first holding ?instrument=, on its Marks panel with
  // focus on the row, or ?trade=. Otherwise the first card that is not Done opens (A151).
  const [params] = useSearchParams();
  const [link] = useState(() => linkedCard(heldReview, params));
  // The first card not done, in walk order and then group order (A90), opens when nothing else is named.
  const [firstId] = useState(() => link?.tradeId ?? [...walkedTrades(initial), ...initial.owed].find((t) => !t.progress.done)?.tradeId);
  // The link the open card is to answer, and the card it is for.
  const [go, setGo] = useState<{ readonly tradeId: string | undefined; readonly go: Go }>({ tradeId: link?.tradeId, go: link ? { panel: link.panel, instrument: link.instrument, count: 1 } : NO_GO });
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
      const from = latest.current.review;
      const result = await facade.DailyReview.getTrade({ reviewDate: from.reviewDate, tradeId, binding: from.binding }).catch(() => undefined);
      const detail = result?.kind === 'Ready' ? { trade: result.trade } : result?.kind === 'ReflectionsOwed' ? { card: result.card } : 'Unavailable';
      if (selection.current === request) setShown({ tradeId, opening: request, detail });
    },
    [facade],
  );
  // `keepNotice`: Retry opens the card again without clearing the notice that said what the refresh did not keep.
  const select = async (tradeId: string, pressed = false, keepNotice = false) => {
    if (!keepNotice) setAfterSave(undefined);
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
    // A card opened while the Review is being asked for waits for it, so it is read under the binding it returns.
    const asking = reopen().then((next) => {
      if (next) {
        apply({ kind: 'Opened', review: next.kind === 'Ready' ? next : heldEmpty(next) });
        setEmpty(next.kind === 'Empty');
      }
      return next;
    });
    refreshing.current = asking;
    const result = await asking;
    if (refreshing.current === asking) refreshing.current = undefined;
    if (!result) return false;
    const held = latest.current.review;
    if (!walkedTrades(held).some((t) => t.tradeId === tradeId) && !held.owed.some((t) => t.tradeId === tradeId)) {
      setStale(undefined);
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
    setStale(undefined);
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
    // A Mark is the next step: the first card holding it opens on its Marks panel with focus in the row, as a Mark blocker's link does.
    if (next.kind === 'Mark') {
      // The card is shown before it is read: the read's result would otherwise batch into the same render, and the card's header,
      // revealed after its body mounts, would take the focus from the row.
      let request = 0;
      flushSync(() => {
        setAfterSave(undefined);
        setReveal((current) => ({ tradeId: next.tradeId, count: current.count + 1 }));
        setGo((current) => ({ tradeId: next.tradeId, go: { panel: 'Marks', instrument: next.instrumentKey, count: current.go.count + 1 } }));
        request = show(next.tradeId, 'Loading');
      });
      void read(next.tradeId, request);
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
    setAfterSave(next.kind === 'Done' ? AFTER_SAVE.Done : next.kind === 'MarkNotHeld' ? AFTER_SAVE.Mark : undefined);
  };
  // A resolved reflection leaves the card open to show it resolved, so only the overview's completion and binding follow the result.
  const reflectionResolved = (post: PostSaveReview) => apply({ kind: 'DebtResolved', review: post });
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
  // A change of the search params while the Review is mounted (a navigate, browser history) opens the card they name, as a link
  // does; it only acts on a changed search string, not on an unrelated render.
  const appliedSearch = useRef(params.toString());
  useEffect(() => {
    const search = params.toString();
    if (search === appliedSearch.current) return;
    appliedSearch.current = search;
    const next = linkedCard(latest.current, params);
    if (next !== undefined) openCard(next.tradeId, next.panel, next.instrument);
  });
  // A saved Mark changes what the card's figures and the Action's binding are read at: the Review and the card are read again.
  const [rereading, setRereading] = useState(false);
  const markSaved = (draftId: string) => {
    if (openId === undefined || shown === undefined) return;
    setRereading(true);
    // The opening is this render's: a Mark saved here finishes after another card opened, and must not replace it.
    void refreshTrade(openId, shown.opening, [draftId]).then((ok) => {
      setFailed(!ok);
      setRereading(false);
    });
  };
  // Save Marks (P37): one command for the open card, under the newest binding the screen holds.
  // The saved Marks and the Review under them are the screen's from here on, with no read (P38, A157): the Trades re-sort,
  // and the open card shows its refreshed Trade in place, keeping what was entered in it.
  const marksSaved = ({ marks, review: post }: MarksSaved, opening: number, tradeId: string) => {
    apply({ kind: 'MarksSaved', marks, review: post });
    if (post.kind !== 'Ready') {
      // The Marks are saved, but the Review under them could not be read: the card says so until Refresh.
      setStale(tradeId);
      return;
    }
    // A Review that read cleanly makes the figures current again, so an earlier out-of-date notice goes.
    setStale(undefined);
    if (selection.current !== opening) return;
    setShown({ tradeId: post.trade.tradeId, opening, detail: { trade: post.trade } });
    setAdvance((current) => ({ tradeId: post.trade.tradeId, count: current.count + 1 }));
  };
  const saveMarks = async (entries: readonly MarketDataPrepareEntry[]): Promise<SaveReviewMarksResult> => {
    const from = latest.current.review;
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
      {empty ? <EmptyReview date={review.reviewDate} /> : <Status review={review} completion={review.completion} name={name} openCard={openCard} />}
      {failed && (
        <div role="alert" className="banner warning">
          <p>We couldn’t refresh the Review. Nothing was changed.</p>
        </div>
      )}
      {!empty && (
        <>
          <p>Stop ◂ ▸ Target</p>
          <ol aria-label="Positions" className="review-cards">
            {trades.map((trade) => (
              <ReviewCard
                key={trade.tradeId}
                facade={facade}
                trade={trade}
                expanded={trade.tradeId === openId}
                detail={trade.tradeId === openId ? walkedDetail(shown?.detail) : undefined}
                reveal={reveal.tradeId === trade.tradeId ? reveal.count : 0}
                advance={advance.tradeId === trade.tradeId ? advance.count : 0}
                go={go.tradeId === trade.tradeId ? go.go : NO_GO}
                marks={marksOf(heldReview, trade.tradeId)}
                held={heldReview}
                onResult={apply}
                tradeLine={tradeLine}
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
      {state.kind === 'Empty' && (state.review.owed.length === 0 ? <EmptyReview date={state.review.reviewDate} /> : <ReadyReview facade={facade} now={now} initial={heldEmpty(state.review)} empty onDirtyChange={onDirtyChange} />)}
      {state.kind === 'Ready' && <ReadyReview facade={facade} now={now} initial={state.review} onDirtyChange={onDirtyChange} />}
    </section>
  );
}
