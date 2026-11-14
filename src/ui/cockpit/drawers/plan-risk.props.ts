// The Plan and Risk drawer's adapter (A216): a Trade Detail's view to the drawer's finished display values. The only file of the drawer that
// reads `app/types`. The words are the moved sections' own (P96).
import type { TradeDetailView } from '../../../app/types.ts';
import { Rational } from '../../../domain/values/index.ts';
import { calculation } from '../../figures.ts';
import { decimalMoney as price, decimalUnderlyingPrice, localTime, money, quantity, ratio, rMultiple, tradeSummary } from '../../format.ts';
import { instrumentLabel } from '../../calculation-words.ts';
import { conditionDirection, exerciseIntentText } from '../../screens/option-words.ts';
import { legText, measureText } from '../../screens/trade-detail/words.ts';
import type { PlanRiskDrawerProps, PlanRiskGroup, PlanRiskRow } from './plan-risk.types.ts';

// What the shell hands the drawer: the Detail's view and the Workspace zone.
export interface PlanRiskSource {
  readonly view: TradeDetailView;
  readonly timeZone: string;
}

type Condition = TradeDetailView['plan']['stops'][number];
type Leg = TradeDetailView['plan']['legs'][number];

// A Plan's Stops or Targets, one line per condition in Plan order (W6): a stock's is its price in dollars; an option's reads "MNO at or below
// 41.00" for an Underlying price (C3) and "Option at or above $3.60" for an option price.
function conditionLines(role: 'Stop' | 'Target', conditions: readonly Condition[], leg: Leg | undefined, symbol: string): readonly string[] {
  const option = leg?.instrument.kind === 'Option' ? { right: leg.instrument.right, side: leg.side } : undefined;
  return conditions.map((condition) => {
    if (!option) return price(condition.price);
    const direction = conditionDirection(role, condition.kind, option);
    return condition.kind === 'StructureValue' ? `Option at or ${direction} ${price(condition.price)}` : `${symbol} at or ${direction} ${decimalUnderlyingPrice(condition.price)}`;
  });
}

function planGroup(view: TradeDetailView, timeZone: string): PlanRiskGroup {
  const leg = view.plan.legs[0];
  const rows: PlanRiskRow[] = [];
  if (leg?.instrument.kind === 'Option') rows.push({ label: 'Contract', value: instrumentLabel(leg.instrument), plain: true });
  rows.push({ label: 'Leg', value: leg ? legText(leg) : '', plain: true });
  if (view.plan.exerciseIntent) rows.push({ label: 'Exercise Intent', value: exerciseIntentText(view.plan.exerciseIntent), plain: true });
  rows.push(
    { label: 'Intended entry', value: leg ? price(leg.intendedEntry) : '' },
    { label: 'Stop', value: conditionLines('Stop', view.plan.stops, leg, view.plan.underlying) },
    { label: 'Target', value: conditionLines('Target', view.plan.targets, leg, view.plan.underlying) },
    { label: 'Plan time', value: localTime(view.plan.planTime, timeZone), plain: true },
    { label: 'Account', value: `${view.labels.institution} — ${view.labels.account}`, plain: true },
  );
  return { id: 'plan', heading: 'Plan', rows };
}

// Each condition's Risk to stop or Reward to target, one line per condition in Plan order (the Risk and reward section's Distance column).
// The rail's card keeps only the nearest (A207). A condition with no reading shows "—", as the table did.
function conditionFiguresGroup(view: TradeDetailView): PlanRiskGroup | undefined {
  if (!('current' in view) || 'terminalDisposition' in view) return undefined;
  const { conditions } = view.current.evaluation;
  const linesOf = (role: 'Stop' | 'Target') => conditions.filter((c) => c.role === role).map((c) => (c.result.kind === 'Value' ? measureText(c.result.value.distance) : '—'));
  const rows = [
    { label: 'Risk to stop', value: linesOf('Stop') },
    { label: 'Reward to target', value: linesOf('Target') },
  ].filter((row) => row.value.length > 0);
  return rows.length > 0 ? { id: 'condition-figures', rows } : undefined;
}

function baselineGroup(baseline: { readonly oneR: Rational; readonly originalPlannedReward: Rational; readonly rewardRiskRatio: Rational }): PlanRiskGroup {
  return {
    id: 'baseline',
    heading: 'Plan Baseline',
    rows: [
      { label: '1R (original risk)', value: money(baseline.oneR) },
      { label: 'Original reward', value: money(baseline.originalPlannedReward) },
      { label: 'Reward : risk', value: ratio(baseline.rewardRiskRatio) },
    ],
  };
}

// Entry Quality once the Entry Resolution Point is reached, and progress toward it before (A24). A Planned Detail has entered nothing.
function entryQualityGroup(view: TradeDetailView, timeZone: string): PlanRiskGroup {
  const base = { id: 'entry-quality', heading: 'Entry Quality' };
  const planned = view.plan.legs[0]?.quantity ?? '';
  if (!('positionChanges' in view)) return { ...base, rows: [], note: `Entry not yet resolved: ${quantity(Rational.of(0n))} of ${planned} entered` };
  const quality = view.entryQuality;
  // The Summary card's Entry status, "Entering" or "Resolved" (revision 96).
  const entry: PlanRiskRow = { label: 'Entry', value: view.entryStatus, plain: true };
  if (quality.kind !== 'Value') return { ...base, rows: [entry], note: `Entry not yet resolved: ${quantity(view.heldQuantity)} of ${planned} entered` };
  const resolution = view.entryResolution;
  const resolvedAt = resolution.kind === 'Resolved' ? view.positionChanges.find((c) => c.factId === resolution.positionChangeId) : undefined;
  const value = quality.value;
  return {
    ...base,
    rows: [
      entry,
      { label: 'Resolved at', value: resolvedAt ? `Position Change at ${localTime(resolvedAt.economicTime, timeZone)}` : '', plain: true },
      { label: 'Average entry', value: calculation(value.averageEntry, money) },
      { label: 'Actual initial risk', value: calculation(value.actualInitialRisk, money), second: calculation(value.riskInPlanR, rMultiple) },
      { label: 'Actual initial reward', value: calculation(value.actualInitialReward, money) },
      { label: 'Reward : risk', value: calculation(value.actualRewardRisk, ratio), second: `planned ${calculation(value.plannedRewardRisk, ratio)}` },
      { label: 'Slippage', value: calculation(value.slippage, money) },
      { label: 'Size', value: `${calculation(value.sizeRatio, ratio)}× planned quantity` },
    ],
  };
}

export function planRiskProps({ view, timeZone }: PlanRiskSource): PlanRiskDrawerProps {
  const figures = conditionFiguresGroup(view);
  return {
    // Only a Planned Detail: the others have it in Position.
    ...(!('positionChanges' in view) && 'summary' in view && view.summary && { tradeSummary: tradeSummary(view.summary, timeZone) }),
    groups: [
      planGroup(view, timeZone),
      ...(figures ? [figures] : []),
      ...('baseline' in view ? [baselineGroup(view.baseline)] : []),
      // An incoherent Detail has no derived figures, so no Entry Quality.
      ...('baseline' in view ? [entryQualityGroup(view, timeZone)] : []),
    ],
  };
}
