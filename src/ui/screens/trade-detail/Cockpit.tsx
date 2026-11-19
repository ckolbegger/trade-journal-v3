import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { UiFacade } from '../../../app/compose.ts';
import type { TradeDetailView, TradeReplayView } from '../../../app/types.ts';
import { ConditionsCard } from '../../cockpit/rail/conditions.tsx';
import { IdentityCard } from '../../cockpit/rail/identity.tsx';
import { NeedsYou } from '../../cockpit/rail/needs-you.tsx';
import { PnlCard } from '../../cockpit/rail/pnl.tsx';
import { JournalDrawer } from '../../cockpit/drawers/journal.tsx';
import { JournalCards, journalTabCount } from '../../cockpit/journal-cards.tsx';
import { PayoffDrawer } from '../../cockpit/drawers/payoff.tsx';
import { PlanRiskDrawer } from '../../cockpit/drawers/plan-risk.tsx';
import { PositionDrawer } from '../../cockpit/drawers/position.tsx';
import { priceHistoryTabCount } from '../../cockpit/drawers/price-history.props.ts';
import { PriceHistory } from '../../cockpit/drawers/price-history.tsx';
import { ReplayDrawer, type SessionLinks } from '../../cockpit/drawers/replay.tsx';
import { TodayDrawer } from '../../cockpit/drawers/today.tsx';
import { overlayWordsOf } from '../../cockpit/replay/overlay.props.ts';
import { ReplayOverlay } from '../../cockpit/replay/overlay.tsx';
import { ReflectRequestContext } from '../OwedDebtItem.tsx';
import { IncoherentPanel, IntegrityPanel } from './Banner.tsx';
import { DRAWERS, DrawerFocusContext, DrawerRequestContext, useDrawerRequest, type Drawer, type DrawerFocus, type DrawerRequest } from './drawer-request.ts';

// The cockpit shell (D08P T8P.5, A217, W1): the full-width banner, the rail beside the drawers, and the footer. A wave-1 lane replaces the
// content behind a `src/ui/cockpit/` path and never edits this file. The selected drawer is component state, not the URL.
// The drawer names live in `drawer-request.ts`, which the Journal cards import without a cycle.
export type { Drawer };
export { useDrawerRequest };

// The drawers a state shows, and the one it selects by default (A217).
function drawersOf(view: TradeDetailView): { readonly shown: readonly Drawer[]; readonly initial: Drawer } {
  if ('recordedPositionChanges' in view) return { shown: ['Position', 'Plan and Risk', 'Journal'], initial: 'Position' };
  if (!('positionChanges' in view)) return { shown: ['Plan and Risk', 'Journal', 'Payoff'], initial: 'Plan and Risk' };
  return { shown: DRAWERS, initial: 'Today' };
}

export interface CockpitProps {
  readonly facade: UiFacade;
  readonly view: TradeDetailView;
  readonly replay: ReplayRead;
  readonly timeZone: string;
  readonly onDirtyChange?: (dirty: boolean) => void;
  // The drawer and the Replay session the address named on load (A257); a drawer this Detail does not show leaves its default.
  readonly initialDrawer?: Drawer;
  readonly initialSession?: string;
  // Called when the Replay slider moves to another session.
  readonly onSessionChange?: (date: string) => void;
  // A274: whether the address holds `replay=open`, and the calls that open and close the overlay by changing it.
  readonly replayOpen?: boolean;
  readonly onReplayOpen?: () => void;
  readonly onReplayClose?: () => void;
  // Content placed inside the drawer request's reach, for a test's probe.
  readonly children?: ReactNode;
}

// What the screen holds of the replay: none (a Planned or incoherent Detail, or a replay that could not be read, so the cockpit shows what the
// Detail alone holds), pending (W20), or read.
export type ReplayRead = { readonly kind: 'None' } | { readonly kind: 'Pending' } | { readonly kind: 'Ready'; readonly replay: TradeReplayView };

// The words a drawer shows while its content is still being read (W20): the Detail's own.
const Loading = () => <p role="status">Loading the Trade…</p>;

export function Cockpit({ facade, view, replay: read, timeZone, onDirtyChange, initialDrawer, initialSession, onSessionChange, replayOpen, onReplayOpen, onReplayClose, children }: CockpitProps) {
  const replay = read.kind === 'Ready' ? read.replay : undefined;
  const pending = read.kind === 'Pending';
  // What the Journal's session cards take as their replay: the replay itself, 'Incoherent' for a Detail whose facts cannot be replayed, or
  // 'Planned' for a Detail that has no Position to replay.
  const cardsReplay = replay ?? cardsReplayOf(view);
  const { shown, initial } = drawersOf(view);
  // Only an Open, Settlement Due or Closed Detail has a history to replay.
  const replayable = 'positionChanges' in view;
  const [selected, setSelected] = useState<Drawer | undefined>(initialDrawer);
  const current = selected && shown.includes(selected) ? selected : initial;
  const shell = { view, timeZone };
  // Wherever a card or drawer takes the replay, it takes the view beside it.
  const replayed = { ...shell, ...(replay && { replay }) };

  // The WAI-ARIA tabs pattern with automatic activation: the arrows, Home and End select the next tab and move focus to it.
  const move = (event: KeyboardEvent) => {
    const at = shown.indexOf(current);
    const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: shown.length - 1 }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    const next = shown[(to + shown.length) % shown.length]!;
    setSelected(next);
    document.getElementById(`drawer-tab-${tabId(next)}`)?.focus();
  };

  // "Reflect now" in Needs you (A217): select the Journal drawer and hand the Debt's id down. Every drawer stays mounted, and that Debt's own
  // item opens its form under the one-form-at-a-time rule, then clears the request so the same Debt can be requested again.
  // A drawer request (A240): the drawer is selected now, and once its panel is shown the heading takes focus. A heading is not focusable by
  // itself, so it is made a programmatic tab stop. Each request is a new object, so the same request can be made again.
  const [focusing, setFocusing] = useState<DrawerFocus>();
  // An arrival from the address (below) is pending until the first request: any explicit drawer request has the last word over it.
  // A page that loads with the overlay already open does not arrive: the overlay's own links and Close answer instead (A273).
  const arrival = useRef({ wanted: initialDrawer === 'Price History' && !replayOpen ? initialSession : undefined });
  const requestDrawer: DrawerRequest = (drawer, target) => {
    arrival.current.wanted = undefined;
    setSelected(drawer);
    setFocusing({ drawer, target });
  };
  // A link inside the overlay (W46) closes it, then the drawer takes focus: the page is inert until the overlay is gone, and the overlay's
  // own close returns focus to the Replay button first, so the request is answered once it is closed, and once.
  const requestFromOverlay: DrawerRequest = (drawer, target) => {
    onReplayClose?.();
    requestDrawer(drawer, target);
  };
  // A273: when the overlay closes, focus is on the Replay button, also for an overlay opened from the address (its opener was the body). This
  // runs before the request below is answered, so a drawer request still has the last word.
  const replayButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !replayOpen) replayButton.current?.focus();
    wasOpen.current = replayOpen === true;
  }, [replayOpen]);
  // An address that names Price History and a session (the Review's link, a reload, a pasted address) arrives the way Replay's own link does:
  // once the replay is read and the history is drawn, that session's column header takes focus and scrolls into view.
  useEffect(() => {
    const date = arrival.current.wanted;
    if (!date || !replay || replayOpen || !shown.includes('Price History')) return;
    arrival.current.wanted = undefined;
    requestDrawer('Price History', { selector: `th[data-session="${date}"]` });
  });
  const answered = useRef<DrawerFocus | undefined>(undefined);
  useEffect(() => {
    if (!focusing || replayOpen || answered.current === focusing) return;
    answered.current = focusing;
    const panel = document.getElementById(`drawer-panel-${tabId(focusing.drawer)}`);
    const { target: wanted } = focusing;
    const target =
      typeof wanted === 'string'
        ? [...(panel?.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6') ?? [])].find((h) => h.textContent?.trim() === wanted)
        : panel?.querySelector<HTMLElement>(wanted.selector);
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus();
    // A focus alone leaves a column that is beyond a sticky row-label column out of view on arrival; jsdom has no scrollIntoView.
    if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [focusing, replayOpen]);
  const [reflecting, setReflecting] = useState<string>();
  const reflectNow = (debtId: string) => {
    setSelected('Journal');
    setReflecting(debtId);
  };
  // A Debt answered or declined on its card is no longer owed: Needs you and the Journal tab's count follow the card's own save result, so the
  // page reads nothing again (revision 95). The cards keep the Detail's view, since they relabel the item themselves.
  const [settledDebts, setSettledDebts] = useState<ReadonlySet<string>>(new Set());
  const request = {
    ...(reflecting !== undefined && { debtId: reflecting }),
    handled: () => setReflecting(undefined),
    settled: (debtId: string) => setSettledDebts((settled) => new Set(settled).add(debtId)),
  };
  const owedView = withoutDebts(view, settledDebts);
  // W1's counts: Price History the sessions without Marks, and Journal the reflections owed; each only when there is one.
  const countOf = (name: Drawer): string | undefined => {
    if (name === 'Journal') return journalTabCount(owedView);
    const missing = name === 'Price History' && replay ? priceHistoryTabCount(replay) : 0;
    return missing > 0 ? String(missing) : undefined;
  };

  const panelOf =(drawer: Drawer): ReactNode => {
    switch (drawer) {
      case 'Today':
        return <TodayDrawer {...replayed} />;
      case 'Position':
        return <PositionDrawer {...shell} />;
      case 'Plan and Risk':
        return <PlanRiskDrawer {...shell} />;
      case 'Price History':
        return pending ? <Loading /> : <PriceHistory {...replayed} />;
      case 'Journal':
        if (pending) return <Loading />;
        // Once a replay is passed the session cards stand in for the old Journal list. An incoherent Detail has no replay to pass, so its
        // entries are one card (W13), and a Planned one's are the Plan card (W11).
        if (cardsReplay) return <JournalCards {...shell} replay={cardsReplay} facade={facade} {...(onDirtyChange && { onDirtyChange })} />;
        return <JournalDrawer facade={facade} {...shell} {...(onDirtyChange && { onDirtyChange })} />;
      case 'Payoff':
        return <PayoffDrawer {...shell} />;
    }
  };

  let overlayBody: ReactNode;
  if (pending) {
    overlayBody = <Loading />;
  } else if (replay) {
    overlayBody = (
      <ReplayDrawer replay={replay} links={(at) => <ReplayLinks at={at} request={requestFromOverlay} />} {...(initialSession !== undefined && { initialSession })} {...(onSessionChange && { onSessionChange })} />
    );
  } else {
    overlayBody = <p>No replay.</p>;
  }

  return (
    <ReflectRequestContext.Provider value={request}>
      <DrawerRequestContext.Provider value={requestDrawer}>
      <DrawerFocusContext.Provider value={focusing}>
      {children}
      {'positionChanges' in view && view.findings.length > 0 && <IntegrityPanel view={view} timeZone={timeZone} />}
      {'recordedPositionChanges' in view && <IncoherentPanel view={view} timeZone={timeZone} />}
      <section className="cockpit-rail" aria-label="State of play">
        <IdentityCard {...shell} />
        <PnlCard {...replayed} />
        <ConditionsCard {...shell} />
        <NeedsYou view={owedView} timeZone={timeZone} onReflectNow={reflectNow} />
      </section>
      <div className="cockpit-drawers">
        <div className="cockpit-tab-row">
        <div role="tablist" aria-label="Detail" className="tabs" onKeyDown={move}>
          {shown.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`drawer-tab-${tabId(name)}`}
              // The tab's name stays its W1 name; a count is its description.
              aria-label={name}
              {...(countOf(name) !== undefined && { 'aria-describedby': `drawer-tab-count-${tabId(name)}` })}
              aria-selected={name === current}
              aria-controls={`drawer-panel-${tabId(name)}`}
              tabIndex={name === current ? 0 : -1}
              onClick={() => setSelected(name)}
            >
              {name}
              {countOf(name) !== undefined && (
                <>
                  {' '}
                  <span className="tab-count" id={`drawer-tab-count-${tabId(name)}`}>
                    {countOf(name)}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
        {/* P143: Replay opens an overlay, so it is a button after the tabs and not one of them. */}
        {replayable && (
          <button ref={replayButton} type="button" className="pill secondary cockpit-replay-button" onClick={onReplayOpen}>
            Replay
          </button>
        )}
        </div>
        {/* Every shown drawer stays mounted and the others carry `hidden`, so an unsaved reflection and a saved one survive a change of drawer. */}
        {shown.map((name) => (
          <div key={name} role="tabpanel" id={`drawer-panel-${tabId(name)}`} aria-labelledby={`drawer-tab-${tabId(name)}`} hidden={name !== current} tabIndex={0}>
            {panelOf(name)}
          </div>
        ))}
      </div>
      {replayable && replayOpen && (
        <ReplayOverlay {...overlayWordsOf(view.plan.underlying, replay)} onClose={onReplayClose ?? (() => undefined)}>
          {overlayBody}
        </ReplayOverlay>
      )}
      </DrawerFocusContext.Provider>
      </DrawerRequestContext.Provider>
    </ReflectRequestContext.Provider>
  );
}

// W46: the links from the Replay drawer's session to the drawers that hold its facts, each moving focus to that session's place in them.
function ReplayLinks({ at, request }: { readonly at: SessionLinks; readonly request: DrawerRequest }) {
  return (
    <p className="replay-links">
      <button type="button" className="pill secondary" onClick={() => request('Price History', { selector: `th[data-session="${at.date}"]` })}>
        Price History
      </button>
      {at.changeId !== undefined && (
        <button type="button" className="pill secondary" onClick={() => request('Position', { selector: `[data-change="${at.changeId}"] button` })}>
          Position
        </button>
      )}
      {at.hasJournal && (
        <button type="button" className="pill secondary" onClick={() => request('Journal', { selector: `[data-sessions~="${at.date}"]`, card: at.date })}>
          Journal
        </button>
      )}
    </p>
  );
}

// The replay a Detail stands in for when it has none to read.
function cardsReplayOf(view: TradeDetailView): 'Incoherent' | 'Planned' | undefined {
  if ('recordedPositionChanges' in view) return 'Incoherent';
  return 'positionChanges' in view ? undefined : 'Planned';
}

// The Detail without the Debts already answered or declined on their cards.
function withoutDebts(view: TradeDetailView, settled: ReadonlySet<string>): TradeDetailView {
  if (settled.size === 0) return view;
  return { ...view, journal: view.journal.filter((item) => !('kind' in item && item.kind === 'Debt' && settled.has(item.id))) } as TradeDetailView;
}

const tabId =(name: Drawer) => name.toLowerCase().replaceAll(' ', '-');
