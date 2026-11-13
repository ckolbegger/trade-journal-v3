import { useState, type KeyboardEvent, type ReactNode } from 'react';
import type { UiFacade } from '../../../app/compose.ts';
import type { TradeDetailView } from '../../../app/types.ts';
import { ConditionsCard } from '../../cockpit/rail/conditions.tsx';
import { IdentityCard } from '../../cockpit/rail/identity.tsx';
import { NeedsYou } from '../../cockpit/rail/needs-you.tsx';
import { PnlCard } from '../../cockpit/rail/pnl.tsx';
import { DetailFooter } from '../../cockpit/footer.tsx';
import { JournalDrawer } from '../../cockpit/drawers/journal.tsx';
import { JournalCards } from '../../cockpit/journal-cards.tsx';
import { PayoffDrawer } from '../../cockpit/drawers/payoff.tsx';
import { PlanRiskDrawer } from '../../cockpit/drawers/plan-risk.tsx';
import { PositionDrawer } from '../../cockpit/drawers/position.tsx';
import { PriceHistory } from '../../cockpit/drawers/price-history.tsx';
import { TodayDrawer } from '../../cockpit/drawers/today.tsx';
import { ReflectRequestContext } from '../OwedDebtItem.tsx';
import { IncoherentPanel, IntegrityPanel } from './Banner.tsx';
import { RiskRewardSection } from './RiskReward.tsx';
import { SummaryCard } from './Summary.tsx';
import { ValuationSection } from './Valuation.tsx';

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
  readonly timeZone: string;
  readonly onDirtyChange?: (dirty: boolean) => void;
}

export function Cockpit({ facade, view, timeZone, onDirtyChange }: CockpitProps) {
  const { shown, initial } = drawersOf(view);
  const [selected, setSelected] = useState<Drawer | undefined>(undefined);
  const current = selected && shown.includes(selected) ? selected : initial;
  const hasToday = shown.includes('Today');
  const open = 'positionChanges' in view && !('terminalDisposition' in view) ? view : undefined;
  const shell = { view, timeZone };

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

  // The legacy blocks (plan section 4.2): the Valuation and Risk and reward sections show in Today, and in the default drawer when a state
  // has no Today, so no figure disappears. T8P.22 retires them.
  const legacyValuation = open && <ValuationSection tradeId={open.tradeId} current={open.current} timeZone={timeZone} />;
  const legacyRiskReward = open && (
    <RiskRewardSection evaluation={open.current.evaluation} baseline={open.baseline} option={open.plan.legs[0]?.instrument.kind === 'Option'} symbol={open.plan.underlying} />
  );

  // "Reflect now" in Needs you (A217): select the Journal drawer and hand the Debt's id down. Every drawer stays mounted, and that Debt's own
  // item opens its form under the one-form-at-a-time rule, then clears the request so the same Debt can be requested again.
  const [reflecting, setReflecting] = useState<string>();
  const reflectNow = (debtId: string) => {
    setSelected('Journal');
    setReflecting(debtId);
  };
  const request = { ...(reflecting !== undefined && { debtId: reflecting }), handled: () => setReflecting(undefined) };

  const panelOf =(drawer: Drawer): ReactNode => {
    switch (drawer) {
      case 'Today':
        return (
          <>
            {legacyValuation}
            <TodayDrawer {...shell} />
            {legacyRiskReward}
          </>
        );
      case 'Position':
        return (
          <>
            {!hasToday && legacyValuation}
            {!hasToday && open && <TodayDrawer {...shell} />}
            {!hasToday && legacyRiskReward}
            <PositionDrawer {...shell} />
          </>
        );
      case 'Plan and Risk':
        return <PlanRiskDrawer {...shell} />;
      case 'Price History':
        return <PriceHistory {...shell} />;
      case 'Journal':
        return (
          <>
            <JournalCards {...shell} />
            <JournalDrawer facade={facade} {...shell} {...(onDirtyChange && { onDirtyChange })} />
          </>
        );
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
        {!('recordedPositionChanges' in view) && <SummaryCard view={view} timeZone={timeZone} />}
        <NeedsYou {...shell} onReflectNow={reflectNow} />
        <PnlCard {...shell} />
        <ConditionsCard {...shell} />
      </section>
      <div className="cockpit-drawers">
        <div role="tablist" aria-label="Detail" className="tabs" onKeyDown={move}>
          {shown.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`drawer-tab-${tabId(name)}`}
              aria-selected={name === current}
              aria-controls={`drawer-panel-${tabId(name)}`}
              tabIndex={name === current ? 0 : -1}
              onClick={() => setSelected(name)}
            >
              {name}
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

const tabId = (name: Drawer) => name.toLowerCase().replaceAll(' ', '-');
