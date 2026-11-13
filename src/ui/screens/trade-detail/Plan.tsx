import type { OpenTradeDetail, PlannedTradeDetail, TradeDetailView } from '../../../app/types.ts';
import { WithSecondLine } from '../../SecondLine.tsx';
import { calculation } from '../../figures.ts';
import { instrumentLabel } from '../../calculation-words.ts';
import { decimalMoney as price, localTime, money, quantity, ratio, rMultiple } from '../../format.ts';
import { exerciseIntentText } from '../option-words.ts';
import { ConditionLines, Figure } from './figure.tsx';
import { legText } from './words.ts';

// The frozen Plan: its Leg, Stop, Target, time and Account.
export function PlanSection({ view, timeZone }: { readonly view: TradeDetailView; readonly timeZone: string }) {
  const leg = view.plan.legs[0];
  return (
    <section className="card" aria-labelledby="plan-heading">
      <h2 id="plan-heading">Plan</h2>
      <dl className="figure-grid">
        {leg?.instrument.kind === 'Option' && <Figure term="Contract" plain>{instrumentLabel(leg.instrument)}</Figure>}
        <Figure term="Leg" plain>{leg ? legText(leg) : ''}</Figure>
        {view.plan.exerciseIntent && <Figure term="Exercise Intent" plain>{exerciseIntentText(view.plan.exerciseIntent)}</Figure>}
        <Figure term="Intended entry">{leg ? price(leg.intendedEntry) : ''}</Figure>
        <Figure term="Stop"><ConditionLines role="Stop" conditions={view.plan.stops} leg={leg} symbol={view.plan.underlying} /></Figure>
        <Figure term="Target"><ConditionLines role="Target" conditions={view.plan.targets} leg={leg} symbol={view.plan.underlying} /></Figure>
        <Figure term="Plan time" plain>{localTime(view.plan.planTime, timeZone)}</Figure>
        <Figure term="Account" plain>{`${view.labels.institution} — ${view.labels.account}`}</Figure>
      </dl>
    </section>
  );
}

// The Plan's 1R, original reward and their ratio, frozen at confirmation.
export function BaselineSection({ baseline }: { readonly baseline: PlannedTradeDetail['baseline'] }) {
  return (
    <section className="card" aria-labelledby="baseline-heading">
      <h2 id="baseline-heading">Plan Baseline</h2>
      <dl className="figure-grid">
        <Figure term="1R (original risk)">{money(baseline.oneR)}</Figure>
        <Figure term="Original reward">{money(baseline.originalPlannedReward)}</Figure>
        <Figure term="Reward : risk">{ratio(baseline.rewardRiskRatio)}</Figure>
      </dl>
    </section>
  );
}

// Entry Quality once the Entry Resolution Point is reached, and progress toward it before (A24).
export function EntryQualitySection({ view, timeZone }: { readonly view: OpenTradeDetail; readonly timeZone: string }) {
  const quality = view.entryQuality;
  const resolution = view.entryResolution;
  const entered = view.heldQuantity;
  const planned = view.plan.legs[0]?.quantity ?? '';
  const resolvedAt = resolution.kind === 'Resolved' ? view.positionChanges.find((c) => c.factId === resolution.positionChangeId) : undefined;
  return (
    <section className="card" aria-labelledby="entry-quality-heading">
      <h2 id="entry-quality-heading">Entry Quality</h2>
      {quality.kind === 'Value' ? (
        <dl className="figure-grid">
          <Figure term="Resolved at" plain>
            {resolvedAt ? `Position Change at ${localTime(resolvedAt.economicTime, timeZone)}` : ''}
          </Figure>
          <Figure term="Average entry">{calculation(quality.value.averageEntry, money)}</Figure>
          <Figure term="Actual initial risk"><WithSecondLine amount={calculation(quality.value.actualInitialRisk, money)} second={calculation(quality.value.riskInPlanR, rMultiple)} /></Figure>
          <Figure term="Actual initial reward">{calculation(quality.value.actualInitialReward, money)}</Figure>
          <Figure term="Reward : risk"><WithSecondLine amount={calculation(quality.value.actualRewardRisk, ratio)} second={`planned ${calculation(quality.value.plannedRewardRisk, ratio)}`} /></Figure>
          <Figure term="Slippage">{calculation(quality.value.slippage, money)}</Figure>
          <Figure term="Size">{`${calculation(quality.value.sizeRatio, ratio)}× planned quantity`}</Figure>
        </dl>
      ) : (
        <p>{`Entry not yet resolved: ${quantity(entered)} of ${planned} entered`}</p>
      )}
    </section>
  );
}
