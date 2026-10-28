import type { DerivedTradeState, TradeEvaluation } from '../../domain/trade-analysis/index.ts';
import { parseDecimal, Rational } from '../../domain/values/index.ts';
import type { AttentionBand, AttentionReason, CalculationFamily, PressureBasis } from './types.ts';

// What orders Trades that tie on band and pressure.
interface TieBreak {
  readonly lastActivity: string;
  readonly tradeId: string;
}

export interface Attention {
  readonly band: AttentionBand;
  readonly reasons: readonly AttentionReason[];
  readonly basis: PressureBasis;
}

const ZERO = Rational.of(0n);
const sum = (values: readonly Rational[]) => values.reduce((a, b) => a.add(b), ZERO);

function decimal(text: string): Rational {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`Invalid stored decimal: ${text}`);
  return parsed.value;
}

// The share of the planned range travelled since entry (P14). The at-entry figures use each open
// Lot's open cost, without fees, in place of the Mark; "now" is the evaluation's Value.
function pressureOf(state: DerivedTradeState, evaluation: TradeEvaluation): PressureBasis {
  const risk = evaluation.ongoingRiskToStop;
  const reward = evaluation.incrementalRewardToTarget;
  if (risk.kind !== 'Value' || reward.kind !== 'Value' || evaluation.observation.mark === null) {
    const missing = risk.kind === 'Unavailable' ? risk : reward;
    if (missing.kind !== 'Unavailable') throw new Error('A pressure input is neither a Value nor Unavailable');
    return 'instrument' in missing.detail
      ? { kind: 'NotComparable', reason: 'MissingInput', instrumentKey: missing.detail.instrument.symbol, date: missing.detail.date }
      : { kind: 'NotComparable', reason: 'AwaitingClose', after: missing.detail.after };
  }
  const lots = state.positions.flatMap((p) => p.openLots);
  const stop = decimal(evaluation.conditions.find((c) => c.role === 'Stop')!.boundary);
  const target = decimal(evaluation.conditions.find((c) => c.role === 'Target')!.boundary);
  const quantity = sum(lots.map((l) => l.quantity));
  const averageCost = sum(lots.map((l) => l.quantity.mul(l.price))).div(quantity);
  const riskAtEntry = sum(lots.map((l) => l.quantity.mul(l.price.sub(stop))));
  const rewardAtEntry = sum(lots.map((l) => l.quantity.mul(target.sub(l.price))));
  const mark = decimal(evaluation.observation.mark.price);
  if (mark.equals(averageCost)) return { kind: 'Comparable', side: 'None', share: ZERO };
  if (mark.compare(averageCost) < 0) {
    if (riskAtEntry.compare(ZERO) <= 0) return { kind: 'NotComparable', reason: 'NonPositiveAtEntry', side: 'Losing' };
    return { kind: 'Comparable', side: 'Losing', share: riskAtEntry.sub(risk.value).div(riskAtEntry), atEntry: riskAtEntry, now: risk.value };
  }
  if (rewardAtEntry.compare(ZERO) <= 0) return { kind: 'NotComparable', reason: 'NonPositiveAtEntry', side: 'Winning' };
  return { kind: 'Comparable', side: 'Winning', share: rewardAtEntry.sub(reward.value).div(rewardAtEntry), atEntry: rewardAtEntry, now: reward.value };
}

export function attentionOf(state: DerivedTradeState, evaluation: TradeEvaluation): Attention {
  const basis = pressureOf(state, evaluation);
  if (state.findings.length > 0) return { band: 'Blocker', reasons: [{ code: 'IntegrityDisagreement', findings: state.findings }], basis };
  const crossed = evaluation.conditions.flatMap((c) =>
    c.result.kind === 'Value' && c.result.value.status !== 'Active' && c.result.value.overrun
      ? [{ code: c.role === 'Stop' ? ('StopBreached' as const) : ('TargetReached' as const), conditionId: c.id, overrun: c.result.value.overrun.dollars }]
      : [],
  );
  if (crossed.length > 0) return { band: 'BoundaryReached', reasons: crossed, basis };
  const unavailable = evaluation.ongoingRiskToStop;
  if (unavailable.kind === 'Unavailable') {
    const reason: AttentionReason =
      'instrument' in unavailable.detail
        ? {
            code: unavailable.reason === 'MarkMissing' ? 'MarkMissing' : 'AcknowledgedUnavailable',
            instrumentKey: unavailable.detail.instrument.symbol,
            date: unavailable.detail.date,
          }
        : { code: 'AwaitingClose', after: unavailable.detail.after };
    return { band: 'EvidenceLimited', reasons: [reason], basis };
  }
  if (basis.kind === 'Comparable' && basis.side !== 'None') {
    return { band: 'QuantifiedPressure', reasons: [{ code: basis.side === 'Losing' ? 'PressureTowardStop' : 'PressureTowardTarget' }], basis };
  }
  return { band: 'Routine', reasons: [{ code: 'NoPressure' }], basis };
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
  if (a.lastActivity !== b.lastActivity) return a.lastActivity < b.lastActivity ? 1 : -1;
  return a.tradeId < b.tradeId ? -1 : a.tradeId > b.tradeId ? 1 : 0;
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
