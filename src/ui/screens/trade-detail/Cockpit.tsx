import { useState, type KeyboardEvent, type ReactNode } from 'react';
import type { UiFacade } from '../../../app/compose.ts';
import type { TradeDetailView, TradeReplayView } from '../../../app/types.ts';
import { ConditionsCard } from '../../cockpit/rail/conditions.tsx';
import { IdentityCard } from '../../cockpit/rail/identity.tsx';
import { NeedsYou } from '../../cockpit/rail/needs-you.tsx';
import { PnlCard } from '../../cockpit/rail/pnl.tsx';
import { DetailFooter } from '../../cockpit/footer.tsx';
import { JournalDrawer } from '../../cockpit/drawers/journal.tsx';
import { JournalCards, journalTabCount } from '../../cockpit/journal-cards.tsx';
import { PayoffDrawer } from '../../cockpit/drawers/payoff.tsx';
import { PlanRiskDrawer } from '../../cockpit/drawers/plan-risk.tsx';
import { PositionDrawer } from '../../cockpit/drawers/position.tsx';
import { priceHistoryTabCount } from '../../cockpit/drawers/price-history.props.ts';
import { PriceHistory } from '../../cockpit/drawers/price-history.tsx';
import { CurrentMarksOnly, TodayDrawer } from '../../cockpit/drawers/today.tsx';
import { ReflectRequestContext } from '../OwedDebtItem.tsx';
import { IncoherentPanel, IntegrityPanel } from './Banner.tsx';

// The cockpit shell (D08P T8P.5, A217, W1): the full-width banner, the rail beside the drawers, and the footer. A wave-1 lane replaces the
// content behind a `src/ui/cockpit/` path and never edits this file. The selected drawer is component state, not the URL.
const DRAWERS = ['Today', 'Position', 'Plan and Risk', 'Price History', 'Journal', 'Payoff'] as const;
type Drawer = (typeof DRAWERS)[number];

// The drawers a state shows, and the one it selects by default (A217).
function drawersOf(view: TradeDetailView): { readonly shown: readonly Drawer[]; readonly initial: Drawer } {
  if ('recordedPositionChanges' in view) return { shown: ['Position', 'Plan and Risk', 'Journal'], initial: 'Position' };
  if (!('positionChanges' in view)) return { shown: ['Plan and Risk', 'Journal', 'Payoff'], initial: 'Plan and Risk' };
  if ('terminalDisposition' in view || view.settlement.length > 0) return { shown: ['Position', 'Plan and Risk', 'Price History', 'Journal', 'Payoff'], initial: 'Position' };
  return { shown: DRAWERS, initial: 'Today' };
}

export interface CockpitProps {
  readonly facade: UiFacade;
  readonly view: TradeDetailView;
  readonly replay: ReplayRead;
  readonly timeZone: string;
  readonly onDirtyChange?: (dirty: boolean) => void;
}

// What the screen holds of the replay: none (a Planned or incoherent Detail, or a replay that could not be read, so the cockpit shows what the
// Detail alone holds), pending (W20), or read.
export type ReplayRead = { readonly kind: 'None' } | { readonly kind: 'Pending' } | { readonly kind: 'Ready'; readonly replay: TradeReplayView };

// The words a drawer shows while its content is still being read (W20): the Detail's own.
const Loading = () => <p role="status">Loading the Trade…</p>;

export function Cockpit({ facade, view, replay: read, timeZone, onDirtyChange }: CockpitProps) {
  const replay = read.kind === 'Ready' ? read.replay : undefined;
  const pending = read.kind === 'Pending';
  // What the Journal's session cards take as their replay: the replay itself, or 'Incoherent' for a Detail whose facts cannot be replayed.
  const cardsReplay = replay ?? ('recordedPositionChanges' in view ? ('Incoherent' as const) : undefined);
  const { shown, initial } = drawersOf(view);
  const [selected, setSelected] = useState<Drawer | undefined>(undefined);
  const current = selected && shown.includes(selected) ? selected : initial;
  const hasToday = shown.includes('Today');
  const open = 'positionChanges' in view && !('terminalDisposition' in view) ? view : undefined;
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
        // A state with no Today tab shows Valuation's content, the current Marks card, in its default drawer (revision 96).
        return (
          <>
            {!hasToday && open && <CurrentMarksOnly {...replayed} />}
            <PositionDrawer {...shell} />
          </>
        );
      case 'Plan and Risk':
        return <PlanRiskDrawer {...shell} />;
      case 'Price History':
        return pending ? <Loading /> : <PriceHistory {...replayed} />;
      case 'Journal':
        if (pending) return <Loading />;
        // Once a replay is passed the session cards stand in for the old Journal list. An incoherent Detail has no replay to pass, so its
        // entries are one card (W13).
        if (cardsReplay) return <JournalCards {...shell} replay={cardsReplay} facade={facade} {...(onDirtyChange && { onDirtyChange })} />;
        return <JournalDrawer facade={facade} {...shell} {...(onDirtyChange && { onDirtyChange })} />;
      case 'Payoff':
        return <PayoffDrawer {...shell} />;
    }
  };

  return (
    <ReflectRequestContext.Provider value={request}>
      {'positionChanges' in view && view.findings.length > 0 && <IntegrityPanel view={view} timeZone={timeZone} />}
      {'recordedPositionChanges' in view && <IncoherentPanel view={view} timeZone={timeZone} />}
      <section className="cockpit-rail" aria-label="State of play">
        <IdentityCard {...shell} />
        <PnlCard {...replayed} />
        <ConditionsCard {...shell} />
        <NeedsYou view={owedView} timeZone={timeZone} onReflectNow={reflectNow} />
      </section>
      <div className="cockpit-drawers">
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
        {/* Every shown drawer stays mounted and the others carry `hidden`, so an unsaved reflection and a saved one survive a change of drawer. */}
        {shown.map((name) => (
          <div key={name} role="tabpanel" id={`drawer-panel-${tabId(name)}`} aria-labelledby={`drawer-tab-${tabId(name)}`} hidden={name !== current} tabIndex={0}>
            {panelOf(name)}
          </div>
        ))}
        <DetailFooter {...shell} />
      </div>
    </ReflectRequestContext.Provider>
  );
}

// The Detail without the Debts already answered or declined on their cards.
function withoutDebts(view: TradeDetailView, settled: ReadonlySet<string>): TradeDetailView {
  if (settled.size === 0) return view;
  return { ...view, journal: view.journal.filter((item) => !('kind' in item && item.kind === 'Debt' && settled.has(item.id))) } as TradeDetailView;
}

const tabId =(name: Drawer) => name.toLowerCase().replaceAll(' ', '-');
