import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { CardProgress, DailyTradeReview, PanelProgress, PostSaveReview, WalkedTrade } from '../../app/types.ts';
import { Badge } from '../Badge.tsx';
import { plural, tradeName, tradeSummary } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import type { UiFacade } from '../../app/compose.ts';
import { ActionForm, type SavedAction } from './ActionForm.tsx';
import { ReplayDrawer } from '../cockpit/drawers/replay.tsx';
import { overlayWordsOf } from '../cockpit/replay/overlay.props.ts';
import { ReplayOverlay } from '../cockpit/replay/overlay.tsx';
import { CardFigures } from './CardFigures.tsx';
import type { EntryDirty } from './MarksStep.tsx';
import { ReviewReflections } from './ReviewReflections.tsx';
import { SettlementPanel, settlementSummary } from './ReviewSettlement.tsx';
import { describedLabelsOf, reasonText } from './review-attention.ts';
import { PlanBox } from './PlanBox.tsx';
import { todoText, type DayLine } from './todo-text.ts';
import { signed, pnlText } from '../figures.ts';
import { money } from '../format.ts';
import { Meter } from '../cockpit/meter/meter.tsx';
import { meterProps } from '../cockpit/meter/meter.props.ts';

export { plural };

// A card's panel progress by name: the record has all three on a walked card (A164).
export function panelOf<P extends PanelProgress['panel']>(progress: CardProgress, panel: P): Extract<PanelProgress, { panel: P }> {
  return progress.panels.find((p): p is Extract<PanelProgress, { panel: P }> => p.panel === panel)!;
}

// The Settlement panel, present only while a contract's settlement is due (decision 81).
const settlementOf = (progress: CardProgress) => progress.panels.find((p): p is Extract<PanelProgress, { panel: 'Settlement' }> => p.panel === 'Settlement');

export const PANELS = ['Reflections', 'Settlement', 'Action'] as const;
export type PanelName = (typeof PANELS)[number];

// Where a link into the Review sends this card (A161): a panel to open. The count grows with each link, so a card that is already open
// answers the next one too.
export interface Go {
  readonly panel?: PanelName;
  // The Replay session the card's overlay opens on, from a way back from Trade Detail (A257, A274).
  readonly session?: string;
  readonly count: number;
}
export const NO_GO: Go = { count: 0 };

// "To do: 2 Marks, Reflection, Action", or "Done · Hold" once the card is done (W101): what the card's progress record still owes, in the day card's words.
// The Action is the one the day summary's line for this Trade says was saved for the Review Date.
function remainsText(progress: CardProgress, action: string | undefined, closeReview: boolean): string {
  const { needed } = panelOf(progress, 'Marks');
  const { dueNow } = panelOf(progress, 'Reflections');
  const { owed } = panelOf(progress, 'Action');
  const needs: DayLine['needs'][number][] = [...(needed > 0 ? ['Marks' as const] : []), ...(dueNow > 0 ? ['Reflection' as const] : []), ...(settlementOf(progress)?.done === false ? ['Settlement' as const] : []), ...(owed ? ['Action' as const] : [])];
  return todoText({ tradeId: '', marks: needed, closeReview, needs, ...(action !== undefined && { action }) });
}

// What the open card shows while its Trade is read, or when it could not be.
export type CardDetail = 'Loading' | 'Unavailable' | { readonly trade: DailyTradeReview };

export interface ReviewCardProps {
  readonly facade: UiFacade;
  readonly trade: WalkedTrade;
  // The Trade's line of the day summary: what it still needs, or the Action it is done with (W101).
  readonly line?: DayLine;
  readonly expanded: boolean;
  readonly detail: CardDetail | undefined;
  // A count that grows each time the trader asks for this card: it scrolls into view and takes focus on its header.
  readonly reveal: number;
  readonly go: Go;
  readonly onToggle: () => void;
  readonly onSaved: (saved: SavedAction) => void;
  readonly onReflectionResolved: (review: PostSaveReview) => void;
  readonly onRefresh: () => Promise<boolean>;
  // The trader tried to leave while the card holds an entered value (A156).
  readonly holdMessage: boolean;
  // The Review is being read again after a Mark save, so the Action cannot be saved yet.
  readonly pending: boolean;
  readonly onEntryDirty: EntryDirty;
}

// One position of the Review: a collapsed header (Underlying, what remains, band, meter) over its content.
export function ReviewCard({ facade, trade, line, expanded, detail, reveal, go, onToggle, onSaved, onReflectionResolved, onRefresh, holdMessage, pending, onEntryDirty }: ReviewCardProps) {
  const item = useRef<HTMLLIElement>(null);
  const header = useRef<HTMLButtonElement>(null);
  const { timeZone } = useRuntime();
  // A Trade whose facts cannot be replayed has no reading, so its header draws no meter.
  const meter = trade.meter && meterProps(trade.meter, 'card', timeZone);
  const labels = describedLabelsOf(trade, timeZone ?? 'UTC');
  const reasonId = useId();
  const reasonIds = labels.flatMap(({ reason }, i) => (reason ? [`${reasonId}-${i}`] : []));
  useEffect(() => {
    if (reveal === 0) return;
    item.current?.scrollIntoView?.({ block: 'start' });
    header.current?.focus({ preventScroll: true });
  }, [reveal]);
  // The press scrolled while the body was still loading and the page short, so the browser clamped the position: once the body
  // is there, the card is brought to the top again, so its header and first input are in view.
  const bodyShown = expanded && typeof detail === 'object';
  const scrolledFor = useRef(0);
  useEffect(() => {
    if (reveal === 0 || !bodyShown || scrolledFor.current === reveal) return;
    scrolledFor.current = reveal;
    // A landing in the body has already focused its control (child effects run first): that focus scroll stays.
    const focused = document.activeElement;
    if (focused && focused !== header.current && item.current?.contains(focused)) return;
    item.current?.scrollIntoView?.({ block: 'start' });
  }, [reveal, bodyShown]);
  return (
    <li className="review-card" ref={item} data-trade-id={trade.tradeId}>
      <div className="review-card-head" data-open={expanded || undefined}>
        <h3>
          <button type="button" ref={header} aria-expanded={expanded} aria-describedby={reasonIds.join(' ') || undefined} onClick={onToggle}>
            <span className="visually-hidden">Review</span> <span className="review-card-name">{trade.underlying}</span>{' '}
            {trade.summary && (
              <>
                <span className="review-card-summary">{tradeSummary(trade.summary)}</span>{' '}
              </>
            )}
            <span className="review-card-remains">{remainsText(trade.progress, line?.action, line?.closeReview ?? false)}</span>{' '}
            {labels.map(({ label }) => (
              <Badge key={label} tone="neutral">
                {label}
              </Badge>
            ))}
            {trade.pnl?.dollars.kind === 'Value' && (
              <>
                {' '}
                <span className="review-card-pnl number">{pnlText(trade.pnl.dollars, trade.pnl.planR, timeZone)}</span>
                {trade.pnl.change.kind === 'Value' && (
                  <>
                    {' '}
                    <span className="review-card-change number">{signed(money)(trade.pnl.change.dollars)} today</span>
                  </>
                )}
              </>
            )}
          </button>
          {/* Each label's own reason, the button's description (not part of its name, which stays short). */}
          {labels.map(({ label, reason }, i) => reason && <span key={label} id={`${reasonId}-${i}`} className="visually-hidden">{reason}</span>)}
        </h3>
        {/* The open card's meter is the "Now" box's (U3): the header draws one only while the card is collapsed. */}
        {meter && !expanded && <Meter {...meter} />}
      </div>
      {expanded && holdMessage && <p role="status">Save or discard what you entered for {tradeName(trade)} to leave it.</p>}
      {expanded && detail === 'Loading' && <p role="status">Loading the Trade…</p>}
      {expanded && detail === 'Unavailable' && (
        <div role="alert" className="banner warning">
          <p>We couldn’t load this Trade. Nothing was changed.</p>
        </div>
      )}
      {expanded && typeof detail === 'object' && (
        <CardBody
          key={`${detail.trade.tradeId}:${detail.trade.saveBinding.reviewDate}`}
          facade={facade}
          trade={detail.trade}
          progress={trade.progress}
          name={tradeName(trade)}
          go={go}
          onSaved={onSaved}
          onReflectionResolved={onReflectionResolved}
          onRefresh={onRefresh}
          pending={pending}
          onEntryDirty={onEntryDirty}
        />
      )}
    </li>
  );
}

interface CardBodyProps {
  readonly facade: UiFacade;
  readonly trade: DailyTradeReview;
  // The newest progress the screen holds for this Trade (A165): the panels word it.
  readonly progress: CardProgress;
  // The Trade's name (A150): it labels the region, so a screen reader hears which Trade it is.
  readonly name: string;
  readonly go: Go;
  readonly onSaved: (saved: SavedAction) => void;
  readonly onReflectionResolved: (review: PostSaveReview) => void;
  readonly onRefresh: () => Promise<boolean>;
  readonly pending: boolean;
  readonly onEntryDirty: EntryDirty;
}

// What a panel's header says: a one-line summary and a status.
interface PanelHeader {
  readonly summary: string;
  readonly status: string;
  readonly done: boolean;
}

// Owed counts the reflections still outstanding, so one answered or declined in this view is no longer owed (P46).
export function reflectionsStatus(due: number, owed: number): string {
  if (due > 0) return `${due} due`;
  if (owed > 0) return 'Not due';
  return 'None';
}

function panelHeaders(trade: DailyTradeReview, progress: CardProgress): Record<PanelName, PanelHeader> {
  const { dueNow: due, later } = panelOf(progress, 'Reflections');
  const owed = due + later;
  const form = trade.form;
  const settlement = settlementOf(progress);
  return {
    Reflections: {
      summary: owed > 0 ? `${owed} owed, ${due} due now` : 'None owed',
      status: reflectionsStatus(due, owed),
      done: panelOf(progress, 'Reflections').done,
    },
    // Rows 24.1 and 24.2; a card with no due settlement has no such panel, so this header is never shown.
    Settlement: {
      summary: settlementSummary(trade.settlement),
      status: settlement?.needed === false ? 'Recorded' : 'Needed',
      done: settlement?.done ?? true,
    },
    Action: {
      summary: form.kind === 'Saved' ? form.action.action : 'Hold, Exit, Roll or Adjust',
      status: panelOf(progress, 'Action').owed ? 'Needed' : 'Saved',
      done: panelOf(progress, 'Action').done,
    },
  };
}

// The open card: its figures, then the three panels in the spec's work order (P36, A152), one open at a time.
function CardBody({ facade, trade, progress, name, go, onSaved, onReflectionResolved, onRefresh, pending, onEntryDirty }: CardBodyProps) {
  const uid = useId();
  const headers = panelHeaders(trade, progress);
  // The card's panels in work order: the Settlement panel is there only while a contract's settlement is due (decision 81).
  const panels = PANELS.filter((name) => name !== 'Settlement' || settlementOf(progress) !== undefined);
  // The next panel that is not done after this one, wrapping to the ones before it; none when every other panel is done.
  const nextAfter = (from: PanelName): PanelName | undefined => {
    const start = panels.indexOf(from);
    return [...panels.slice(start + 1), ...panels.slice(0, start)].find((name) => !headers[name].done);
  };
  // The card opens on the panel a link names, or else on its first panel that is not done.
  const [open, setOpen] = useState<PanelName>(() => (go.panel && panels.includes(go.panel) ? go.panel : (panels.find((name) => !headers[name].done) ?? 'Action')));
  // A274: the overlay is open while the address holds `replay=open`. Opening pushes one history entry, so Back closes it; Close and Escape go
  // back that entry when this visit pushed it, and otherwise (a reload, a link straight in) replace the address without `replay`.
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const replayOpen = params.get('replay') === 'open';
  // It stays set when the browser's Back closes the overlay: the entry is still in history, and Forward brings the overlay back on it.
  const pushed = useRef(false);
  // The slider's session, from a link's `session` until the slider moves: opening writes it to the address, so the overlay rests there again.
  const sliderAt = useRef(go.session);
  const onSliderMove = useCallback((date: string) => {
    sliderAt.current = date;
  }, []);
  const openReplay = () => {
    pushed.current = true;
    // A card opened by its header writes no address, so an entry that names another card, panel or Instrument would be a link when the overlay
    // closes back to it: it is first replaced by this card's own address, then the overlay's entry is pushed over it.
    const card = new URLSearchParams(params);
    card.set('trade', trade.tradeId);
    card.set('panel', 'Action');
    card.delete('instrument');
    card.delete('replay');
    card.delete('session');
    const named = new URLSearchParams(params);
    named.delete('replay');
    named.delete('session');
    const overlay = new URLSearchParams(card);
    overlay.set('replay', 'open');
    if (sliderAt.current !== undefined) overlay.set('session', sliderAt.current);
    if (named.size > 0 && named.toString() !== card.toString()) void navigate({ search: card.toString() }, { replace: true });
    void navigate({ search: overlay.toString() });
  };
  const closeReplay = () => {
    if (pushed.current) {
      // It stays set: the entry is still in history after this Back, and Forward brings the overlay back on it.
      void navigate(-1);
      return;
    }
    setParams(
      (now) => {
        const next = new URLSearchParams(now);
        next.delete('replay');
        return next;
      },
      { replace: true },
    );
  };
  // When the overlay closes, focus is on the Replay button, also for an overlay opened from the address (its opener was the body).
  const replayButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !replayOpen) replayButton.current?.focus();
    wasOpen.current = replayOpen;
  }, [replayOpen]);
  const panelButtons = useRef<Partial<Record<PanelName, HTMLButtonElement | null>>>({});
  const [focusPanel, setFocusPanel] = useState<{ readonly panel: PanelName }>();
  useEffect(() => {
    if (focusPanel) panelButtons.current[focusPanel.panel]?.focus();
  }, [focusPanel]);
  // A link to a card that is already open moves it to the panel named (A161).
  const [handledGo, setHandledGo] = useState(go.count);
  if (go.count !== handledGo) {
    setHandledGo(go.count);
    if (go.panel && panels.includes(go.panel)) {
      setOpen(go.panel);
      // The Replay button's own address (trade and panel) asks for this card again while its overlay is open: focus stays in the overlay.
      if (!replayOpen) setFocusPanel({ panel: go.panel });
    }
  }
  // A panel's work is finished: the next panel that is not done after that one opens and takes focus. A trader who has
  // since opened another panel that still has work stays on it.
  const moveOn = (from: PanelName) => {
    const next = nextAfter(from);
    if (next && (open === from || headers[open].done)) {
      setOpen(next);
      setFocusPanel({ panel: next });
    }
  };
  const [finished, setFinished] = useState(0);
  const finishPanel = useCallback(() => setFinished((count) => count + 1), []);
  const [handledReflections, setHandledReflections] = useState(finished);
  if (finished !== handledReflections) {
    setHandledReflections(finished);
    moveOn('Reflections');
  }
  const { timeZone } = useRuntime();
  // The Action form reports under its Trade, so the Review's unsaved state counts it with the Mark entries.
  const tradeId = trade.tradeId;
  const report = useCallback((dirty: boolean) => onEntryDirty(`action:${tradeId}`, dirty), [tradeId, onEntryDirty]);
  // The Plan box's Risk and Reward are the At entry group's two figures: with the box shown, the group is left out (U2).
  const planBoxCarriesAtEntry = trade.replay?.planColumn !== undefined && trade.evaluation?.atEntry != null;
  return (
    <section aria-label={`${name} review`}>
      <p>
        {trade.labels.strategy} · {trade.labels.account} · {trade.labels.institution}
      </p>
      {/* A Trade closed after the cutoff is evaluated at the cutoff but is no longer Open (A91). */}
      {trade.lifecycle === 'Closed' && (
        <p>
          <span>Closed after this session&apos;s close</span> · <span className="review-card-lifecycle">{trade.lifecycle}</span>
        </p>
      )}
      {trade.attention.reasons.map((reason, i) => (
        <p key={i}>{reasonText(reason, trade.attention.basis, timeZone ?? 'UTC')}</p>
      ))}
      <PlanBox plan={trade.plan} replay={trade.replay} />
      <CardFigures trade={planBoxCarriesAtEntry ? { ...trade, evaluation: { ...trade.evaluation, atEntry: null } } : trade} />
      {/* Every panel stays mounted, so a panel left open keeps its drafts; only the open one is shown. */}
      {panels.map((name) => (
        <div key={name} className="review-panel">
          <h4>
            <button
              type="button"
              ref={(button) => {
                panelButtons.current[name] = button;
              }}
              aria-expanded={open === name} aria-controls={`${uid}-${name}`} onClick={() => setOpen(name)}>
              <span className="review-panel-name">{name}</span> <span className="review-panel-summary">{headers[name].summary}</span> <Badge tone="neutral">{headers[name].status}</Badge>
            </button>
          </h4>
          <div id={`${uid}-${name}`} hidden={open !== name}>
            {name === 'Reflections' && <ReviewReflections facade={facade} reviewDate={trade.saveBinding.reviewDate} reflections={trade.reflections} onReview={onReflectionResolved} onNoneRemaining={finishPanel} onEntryDirty={onEntryDirty} />}
            {name === 'Settlement' && <SettlementPanel tradeId={trade.tradeId} items={trade.settlement} timeZone={timeZone ?? 'UTC'} />}
            {name === 'Action' && trade.replay && (
              <button ref={replayButton} type="button" className="pill secondary review-card-replay" onClick={openReplay}>
                Replay
              </button>
            )}
            {name === 'Action' && <ActionForm facade={facade} form={trade.form} binding={trade.saveBinding} onSaved={onSaved} onRefresh={onRefresh} onDirtyChange={report} pending={pending} />}
          </div>
        </div>
      ))}
      {trade.replay && replayOpen && (
        <ReplayOverlay {...overlayWordsOf(trade.underlying, trade.replay)} onClose={closeReplay}>
          {/* P129: the one link out; the address carries the drawer, the session and the way back. */}
          <ReplayDrawer replay={trade.replay} {...(params.get('session') !== null && { initialSession: params.get('session')! })} onSessionChange={onSliderMove} links={({ date }) => <p className="replay-links"><Link className="pill secondary" to={`/trades/${trade.tradeId}?drawer=price-history&session=${date}&from=review`}>Price History</Link></p>} />
        </ReplayOverlay>
      )}
    </section>
  );
}