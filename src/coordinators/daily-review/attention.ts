import { Temporal } from 'temporal-polyfill';
import type { DerivedTradeState, IntegrityFinding, TradeEvaluation } from '../../domain/trade-analysis/index.ts';
import { parseDecimal, Rational } from '../../domain/values/index.ts';
import type { AttentionBand, AttentionReason, CalculationFamily, PressureBasis, RangePosition } from './types.ts';

// What orders Trades that tie on band and pressure.
interface TieBreak {
  readonly lastActivity: string;
  readonly tradeId: string;
}

export interface Attention {
  readonly band: AttentionBand;
  readonly reasons: readonly AttentionReason[];
  readonly basis: PressureBasis;
  readonly rangePosition: RangePosition;
}

const ZERO = Rational.of(0n);
const sum = (values: readonly Rational[]) => values.reduce((a, b) => a.add(b), ZERO);

function decimal(text: string): Rational {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`Invalid stored decimal: ${text}`);
  return parsed.value;
}

// The risk (toward the Stop) and reward (toward the Target) at the Review-date Mark and at entry: the
// figures both the pressure basis and the range position use. The at-entry figures use each open Lot's
// open cost, without fees, in place of the Mark; "now" is the evaluation's Value.
type RiskReward =
  | { readonly kind: 'Figures'; readonly riskNow: Rational; readonly rewardNow: Rational; readonly riskAtEntry: Rational; readonly rewardAtEntry: Rational; readonly mark: Rational; readonly averageCost: Rational }
  | { readonly kind: 'Missing'; readonly acknowledged: boolean; readonly detail: { readonly reason: 'MissingInput'; readonly instrumentKey: string; readonly date: string } | { readonly reason: 'AwaitingClose'; readonly after: string } };

// evaluate never returns FactsIncoherent (the Review lists such Trades by their facts); T7P.5 reshapes this.
function awaitingAfter(u: Exclude<Extract<TradeEvaluation['ongoingRiskToStop'], { kind: 'Unavailable' }>, { instrument: unknown }>): string {
  if (u.reason !== 'AwaitingClose') throw new Error(`An evaluation cannot be Unavailable for ${u.reason}`);
  return u.after;
}

function riskRewardOf(state: DerivedTradeState, evaluation: TradeEvaluation): RiskReward {
  const risk = evaluation.ongoingRiskToStop;
  const reward = evaluation.incrementalRewardToTarget;
  if (risk.kind !== 'Value' || reward.kind !== 'Value' || evaluation.observation.mark === null) {
    const missing = risk.kind === 'Unavailable' ? risk : reward;
    if (missing.kind !== 'Unavailable') throw new Error('A pressure input is neither a Value nor Unavailable');
    return {
      kind: 'Missing',
      acknowledged: missing.reason === 'AcknowledgedUnavailable',
      detail:
        'instrument' in missing
          ? { reason: 'MissingInput', instrumentKey: missing.instrument.symbol, date: missing.date }
          : { reason: 'AwaitingClose', after: awaitingAfter(missing) },
    };
  }
  const lots = state.positions.flatMap((p) => p.openLots);
  const stop = decimal(evaluation.conditions.find((c) => c.role === 'Stop')!.boundary);
  const target = decimal(evaluation.conditions.find((c) => c.role === 'Target')!.boundary);
  const quantity = sum(lots.map((l) => l.quantity));
  return {
    kind: 'Figures',
    riskNow: risk.value,
    rewardNow: reward.value,
    riskAtEntry: sum(lots.map((l) => l.quantity.mul(l.price.sub(stop)))),
    rewardAtEntry: sum(lots.map((l) => l.quantity.mul(target.sub(l.price)))),
    mark: decimal(evaluation.observation.mark.price),
    averageCost: sum(lots.map((l) => l.quantity.mul(l.price))).div(quantity),
  };
}

// The share of the planned range travelled since entry (P14).
function pressureOf(figures: RiskReward): PressureBasis {
  if (figures.kind === 'Missing') return { kind: 'NotComparable', ...figures.detail };
  const { riskNow, rewardNow, riskAtEntry, rewardAtEntry, mark, averageCost } = figures;
  if (mark.equals(averageCost)) return { kind: 'Comparable', side: 'None', share: ZERO };
  if (mark.compare(averageCost) < 0) {
    if (riskAtEntry.compare(ZERO) <= 0) return { kind: 'NotComparable', reason: 'NonPositiveAtEntry', side: 'Losing' };
    return { kind: 'Comparable', side: 'Losing', share: riskAtEntry.sub(riskNow).div(riskAtEntry), atEntry: riskAtEntry, now: riskNow };
  }
  if (rewardAtEntry.compare(ZERO) <= 0) return { kind: 'NotComparable', reason: 'NonPositiveAtEntry', side: 'Winning' };
  return { kind: 'Comparable', side: 'Winning', share: rewardAtEntry.sub(rewardNow).div(rewardAtEntry), atEntry: rewardAtEntry, now: rewardNow };
}

// Risk ÷ (risk + reward) (P39).
const shareOf = (risk: Rational, reward: Rational) => risk.div(risk.add(reward));

function rangePositionOf(figures: RiskReward): RangePosition {
  if (figures.kind === 'Missing') {
    const { detail } = figures;
    if (detail.reason === 'MissingInput' && figures.acknowledged) return { kind: 'NotPlaced', ...detail, reason: 'AcknowledgedUnavailable' };
    return { kind: 'NotPlaced', ...detail };
  }
  const atEntry = shareOf(figures.riskAtEntry, figures.rewardAtEntry);
  if (figures.riskNow.compare(ZERO) <= 0) return { kind: 'Placed', now: ZERO, atEntry, pinned: 'Stop' };
  if (figures.rewardNow.compare(ZERO) <= 0) return { kind: 'Placed', now: Rational.of(1n), atEntry, pinned: 'Target' };
  return { kind: 'Placed', now: shareOf(figures.riskNow, figures.rewardNow), atEntry };
}

export function attentionOf(state: DerivedTradeState, evaluation: TradeEvaluation, findings: readonly IntegrityFinding[]): Attention {
  const figures = riskRewardOf(state, evaluation);
  const basis = pressureOf(figures);
  const rangePosition = rangePositionOf(figures);
  if (findings.length > 0) return { band: 'Blocker', reasons: [{ code: 'IntegrityDisagreement', findings }], basis, rangePosition };
  const crossed = evaluation.conditions.flatMap((c) =>
    c.result.kind === 'Value' && c.result.value.status !== 'Active' && c.result.value.overrun
      ? [{ code: c.role === 'Stop' ? ('StopBreached' as const) : ('TargetReached' as const), conditionId: c.id, overrun: c.result.value.overrun.dollars }]
      : [],
  );
  if (crossed.length > 0) return { band: 'BoundaryReached', reasons: crossed, basis, rangePosition };
  const unavailable = evaluation.ongoingRiskToStop;
  if (unavailable.kind === 'Unavailable') {
    const reason: AttentionReason =
      'instrument' in unavailable
        ? {
            code: unavailable.reason === 'MarkMissing' ? 'MarkMissing' : 'AcknowledgedUnavailable',
            instrumentKey: unavailable.instrument.symbol,
            date: unavailable.date,
          }
        : { code: 'AwaitingClose', after: awaitingAfter(unavailable) };
    return { band: 'EvidenceLimited', reasons: [reason], basis, rangePosition };
  }
  if (basis.kind === 'Comparable' && basis.side !== 'None') {
    return { band: 'QuantifiedPressure', reasons: [{ code: basis.side === 'Losing' ? 'PressureTowardStop' : 'PressureTowardTarget' }], basis, rangePosition };
  }
  return { band: 'Routine', reasons: [{ code: 'NoPressure' }], basis, rangePosition };
}

const BAND_RANK: Record<AttentionBand, number> = { Blocker: 0, BoundaryReached: 1, EvidenceLimited: 2, QuantifiedPressure: 3, Routine: 4 };

// Band first. Within a band, comparable pressure sorts descending, a losing side before a winning one,
// then Last Activity descending, then Trade identity; Not Comparable Trades follow the comparable ones.
export function byAttention(a: Attention & TieBreak, b: Attention & TieBreak): number {
  if (a.band !== b.band) return BAND_RANK[a.band] - BAND_RANK[b.band];
  if (a.basis.kind === 'Comparable' && b.basis.kind === 'Comparable') {
    const byPressure = b.basis.share.compare(a.basis.share) || Number(b.basis.side === 'Losing') - Number(a.basis.side === 'Losing');
    if (byPressure !== 0) return byPressure;
  } else if (a.basis.kind !== b.basis.kind) {
    return Number(a.basis.kind === 'NotComparable') - Number(b.basis.kind === 'NotComparable');
  }
  const byActivity = Temporal.Instant.compare(b.lastActivity, a.lastActivity);
  if (byActivity !== 0) return byActivity;
  if (a.tradeId === b.tradeId) return 0;
  return a.tradeId < b.tradeId ? -1 : 1;
}

const FAMILIES: readonly CalculationFamily[] = ['Valuation', 'Risk', 'Reward', 'ConditionStatus'];

// The calculation groups that these evaluations leave Unavailable, in a fixed order.
export function unavailableFamilies(evaluations: readonly TradeEvaluation[]): CalculationFamily[] {
  const results = (family: CalculationFamily, e: TradeEvaluation): readonly { kind: string }[] => {
    switch (family) {
      case 'Valuation':
        return [e.marketValue, e.remainingOpenPnl, e.currentMarkedPnl];
      case 'Risk':
        return [e.ongoingRiskToStop, e.worstCaseOngoingRisk];
      case 'Reward':
        return [e.incrementalRewardToTarget];
      case 'ConditionStatus':
        return e.conditions.map((c) => c.result);
    }
  };
  return FAMILIES.filter((family) => evaluations.some((e) => results(family, e).some((r) => r.kind === 'Unavailable')));
}
