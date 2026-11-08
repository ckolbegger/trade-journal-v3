import { Temporal } from 'temporal-polyfill';
import type { CalculationResult, DerivedTradeState, IntegrityFinding, TradeEvaluation, UnavailableReason } from '../../domain/trade-analysis/index.ts';
import { multiplierOf } from '../../domain/instrument/index.ts';
import { parseDecimal, Rational } from '../../domain/values/index.ts';
import type { AttentionBand, AttentionReason, CalculationFamily, PressureResult, RangePositionResult } from './types.ts';

// What orders Trades that tie on band and pressure.
interface TieBreak {
  readonly lastActivity: string;
  readonly tradeId: string;
}

export interface Attention {
  readonly band: AttentionBand;
  readonly reasons: readonly AttentionReason[];
  readonly basis: PressureResult;
  readonly rangePosition: RangePositionResult;
}

const ZERO = Rational.of(0n);
const sum = (values: readonly Rational[]) => values.reduce((a, b) => a.add(b), ZERO);

function decimal(text: string): Rational {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`Invalid stored decimal: ${text}`);
  return parsed.value;
}

// The risk (toward the Stop) and reward (toward the Target) at the Review-date Mark and at entry: the
// figures both the pressure and the range position use. The at-entry figures use each open Lot's
// open cost, without fees, in place of the Mark; "now" is the evaluation's Value. Both are measured the
// way `evaluate` measures its own: signed quantity x multiplier x price against the condition's
// measurement value, which for an option is the contract's value at expiration at its trigger (P24).
interface RiskRewardFigures {
  readonly riskNow: Rational;
  readonly rewardNow: Rational;
  readonly riskAtEntry: Rational;
  readonly rewardAtEntry: Rational;
  // The sign of signed quantity x (Mark - average cost): which way the Position's value has moved.
  readonly move: number;
}

// Value, or the evaluation's own Unavailable, unchanged (P66): the figures have no other reason to be absent.
type RiskReward = Extract<CalculationResult<RiskRewardFigures, UnavailableReason, never>, { kind: 'Value' | 'Unavailable' }>;

function riskRewardOf(state: DerivedTradeState, evaluation: TradeEvaluation): RiskReward {
  const risk = evaluation.ongoingRiskToStop;
  const reward = evaluation.incrementalRewardToTarget;
  if (risk.kind === 'Unavailable') return risk;
  if (reward.kind === 'Unavailable') return reward;
  if (risk.kind !== 'Value' || reward.kind !== 'Value' || evaluation.observation.mark === null) throw new Error('A pressure input is neither a Value nor Unavailable');
  const lots = state.positions.flatMap((p) => p.openLots);
  const [stopBasis, targetBasis] = [state.baseline.stopBasis[0]!, state.baseline.targetBasis[0]!];
  const stop = stopBasis.valueAtExpiration ?? decimal(stopBasis.condition.price);
  const target = targetBasis.valueAtExpiration ?? decimal(targetBasis.condition.price);
  const multiplier = Rational.of(BigInt(multiplierOf(state.positions[0]!.instrument)));
  const quantity = sum(lots.map((l) => l.quantity));
  const averageCost = sum(lots.map((l) => l.quantity.mul(l.price))).div(quantity);
  return {
    kind: 'Value',
    value: {
      riskNow: risk.value,
      rewardNow: reward.value,
      riskAtEntry: sum(lots.map((l) => l.quantity.mul(multiplier).mul(l.price.sub(stop)))),
      rewardAtEntry: sum(lots.map((l) => l.quantity.mul(multiplier).mul(target.sub(l.price)))),
      move: quantity.mul(decimal(evaluation.observation.mark.price).sub(averageCost)).compare(ZERO),
    },
  };
}

// The share of the planned range travelled since entry (P14): the larger consumed share that is positive.
function pressureOf(result: RiskReward): PressureResult {
  if (result.kind === 'Unavailable') return result;
  const { riskNow, rewardNow, riskAtEntry, rewardAtEntry, move } = result.value;
  const losing = { side: 'Losing' as const, atEntry: riskAtEntry, now: riskNow };
  const winning = { side: 'Winning' as const, atEntry: rewardAtEntry, now: rewardNow };
  const shares = [losing, winning].flatMap((s) => (s.atEntry.compare(ZERO) > 0 ? [{ ...s, share: s.atEntry.sub(s.now).div(s.atEntry) }] : []));
  const positive = shares.filter((s) => s.share.compare(ZERO) > 0).sort((a, b) => b.share.compare(a.share));
  if (positive.length > 0) return { kind: 'Value', value: positive[0]! };
  // No share is positive: a move toward a side with no positive at-entry figure cannot be measured.
  const toward = move < 0 ? losing : winning;
  if (move !== 0 && toward.atEntry.compare(ZERO) <= 0) return { kind: 'NotApplicable', reason: 'NonPositiveAtEntry', side: toward.side };
  return { kind: 'Value', value: { side: 'None', share: ZERO } };
}

// Risk ÷ (risk + reward) (P39).
const shareOf = (risk: Rational, reward: Rational) => risk.div(risk.add(reward));

function rangePositionOf(result: RiskReward): RangePositionResult {
  if (result.kind === 'Unavailable') return result;
  const { riskNow, rewardNow, riskAtEntry, rewardAtEntry } = result.value;
  const atEntry = shareOf(riskAtEntry, rewardAtEntry);
  if (riskNow.compare(ZERO) <= 0) return { kind: 'Value', value: { now: ZERO, atEntry, pinned: 'Stop' } };
  if (rewardNow.compare(ZERO) <= 0) return { kind: 'Value', value: { now: Rational.of(1n), atEntry, pinned: 'Target' } };
  return { kind: 'Value', value: { now: shareOf(riskNow, rewardNow), atEntry } };
}

// The evaluation's Unavailable reason, unchanged, as an attention reason (P67).
function unavailableReason(unavailable: Extract<TradeEvaluation['ongoingRiskToStop'], { kind: 'Unavailable' }>): AttentionReason {
  switch (unavailable.reason) {
    case 'AwaitingClose':
      return { code: 'Unavailable', reason: unavailable.reason, after: unavailable.after };
    case 'FactsIncoherent':
      return { code: 'Unavailable', reason: unavailable.reason, findings: unavailable.findings };
    case 'SettlementDue':
      return { code: 'Unavailable', reason: unavailable.reason, instrument: unavailable.instrument, expiration: unavailable.expiration };
    case 'MarkMissing':
    case 'AcknowledgedUnavailable':
    case 'SessionPolicyNotCovered':
      return { code: 'Unavailable', reason: unavailable.reason, instrument: unavailable.instrument, date: unavailable.date };
  }
}

export function attentionOf(state: DerivedTradeState, evaluation: TradeEvaluation, findings: readonly IntegrityFinding[]): Attention {
  const figures = riskRewardOf(state, evaluation);
  const basis = pressureOf(figures);
  const rangePosition = rangePositionOf(figures);
  // A due settlement is a factual blocker, whatever the figures (A112).
  const due = evaluation.settlement.filter((s) => s.status === 'Due').map((s): AttentionReason => ({ code: 'SettlementDue', instrument: s.instrument, quantity: s.quantity, expiration: s.expiration }));
  const blockers: AttentionReason[] = [...(findings.length > 0 ? [{ code: 'IntegrityDisagreement' as const, findings }] : []), ...due];
  if (blockers.length > 0) return { band: 'Blocker', reasons: blockers, basis, rangePosition };
  const crossed = evaluation.conditions.flatMap((c) =>
    c.result.kind === 'Value' && c.result.value.status !== 'Active' && c.result.value.overrun
      ? [{ code: c.role === 'Stop' ? ('StopBreached' as const) : ('TargetReached' as const), conditionId: c.id, overrun: c.result.value.overrun.dollars }]
      : [],
  );
  if (crossed.length > 0) return { band: 'BoundaryReached', reasons: crossed, basis, rangePosition };
  const unavailable = evaluation.ongoingRiskToStop;
  if (unavailable.kind === 'Unavailable') {
    return { band: 'EvidenceLimited', reasons: [unavailableReason(unavailable)], basis, rangePosition };
  }
  if (basis.kind === 'Value' && basis.value.side !== 'None') {
    return { band: 'QuantifiedPressure', reasons: [{ code: basis.value.side === 'Losing' ? 'PressureTowardStop' : 'PressureTowardTarget' }], basis, rangePosition };
  }
  return { band: 'Routine', reasons: [{ code: 'NoPressure' }], basis, rangePosition };
}

const BAND_RANK: Record<AttentionBand, number> = { Blocker: 0, BoundaryReached: 1, EvidenceLimited: 2, QuantifiedPressure: 3, Routine: 4 };

// Band first. Within a band, comparable pressure sorts descending, a losing side before a winning one,
// then Last Activity descending, then Trade identity; a pressure that is not a Value follows the Values.
export function byAttention(a: Attention & TieBreak, b: Attention & TieBreak): number {
  if (a.band !== b.band) return BAND_RANK[a.band] - BAND_RANK[b.band];
  if (a.basis.kind === 'Value' && b.basis.kind === 'Value') {
    const [pa, pb] = [a.basis.value, b.basis.value];
    const byPressure = pb.share.compare(pa.share) || Number(pb.side === 'Losing') - Number(pa.side === 'Losing');
    if (byPressure !== 0) return byPressure;
  } else if ((a.basis.kind === 'Value') !== (b.basis.kind === 'Value')) {
    return Number(a.basis.kind !== 'Value') - Number(b.basis.kind !== 'Value');
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
