import { Temporal } from 'temporal-polyfill';
import { headlineBasisOf, measurementOf } from '../../domain/trade-analysis/index.ts';
import type { CalculationResult, DerivedTradeState, IntegrityFinding, NotApplicableReason, TradeEvaluation, UnavailableReason } from '../../domain/trade-analysis/index.ts';
import { multiplierOf, type OptionInstrument } from '../../domain/instrument/index.ts';
import { parseDecimal, Rational } from '../../domain/values/index.ts';
// The attention bands, highest first (Daily Review, "Date, eligibility, and ordering"): factual or management blocker,
// an Exit not carried out, settlement due, Stop reached, Target reached, evidence limited, quantified pressure, routine.
export type AttentionBand = 'Blocker' | 'ExitNotCarriedOut' | 'SettlementDue' | 'StopReached' | 'TargetReached' | 'EvidenceLimited' | 'QuantifiedPressure' | 'Routine';

// Why a Trade is in its band; figures are in the basis. A Trade limited by evidence, or blocked because its
// facts cannot be replayed, carries its evaluation's own Unavailable reason, unchanged (P67).
export type AttentionReason =
  | { readonly code: 'IntegrityDisagreement'; readonly findings: readonly IntegrityFinding[] }
  | ({ readonly code: 'Unavailable' } & UnavailableReason)
  | { readonly code: 'StopBreached' | 'TargetReached'; readonly conditionId: string; readonly overrun?: Rational }
  | { readonly code: 'PressureTowardStop' | 'PressureTowardTarget' }
  // The Trade's most recent Action before the Review Date is Exit and the Trade is still held (A313).
  | { readonly code: 'ExitNotCarriedOut' }
  // An option contract held at or past its expiration date with no settlement fact (A112); a blocker.
  | { readonly code: 'SettlementDue'; readonly instrument: OptionInstrument; readonly quantity: Rational; readonly expiration: string }
  | { readonly code: 'NoPressure' };

// The pressure a Trade is ranked by: the share of its planned range travelled since entry, with the
// risk (toward the Stop) or reward (toward the Target) at entry and now.
export type Pressure =
  | {
      readonly side: 'Losing' | 'Winning';
      readonly share: Rational;
      readonly atEntry: Rational;
      readonly now: Rational;
    }
  // Marked at its average open cost: no distance travelled toward either boundary (pressure 0).
  | { readonly side: 'None'; readonly share: Rational };

// Pressure is NotApplicable when the risk (Losing) or reward (Winning) at entry was not positive on the side the Trade moved toward.
// A Trade stored Open whose facts hold no position (a lifecycle disagreement) has no figure to measure: the evaluation's NoRemainingPosition, unchanged.
export type PressureResult = CalculationResult<Pressure, UnavailableReason, Extract<NotApplicableReason, { reason: 'NonPositiveAtEntry' | 'NoRemainingPosition' }>>;

// The groups of Mark-dependent calculations an unavailable Mark leaves without a Value.
export type CalculationFamily = 'Valuation' | 'Risk' | 'Reward' | 'ConditionStatus';

// What orders Trades that tie on band and pressure.
interface TieBreak {
  readonly lastActivity: string;
  readonly tradeId: string;
}

export interface Attention {
  readonly band: AttentionBand;
  readonly reasons: readonly AttentionReason[];
  readonly basis: PressureResult;
  // How far past its Stop the Trade is, in Plan R (the deepest of its Stop conditions); present only in the StopReached band.
  readonly stopOverrunR?: Rational;
}

const ZERO = Rational.of(0n);
const sum = (values: readonly Rational[]) => values.reduce((a, b) => a.add(b), ZERO);

function decimal(text: string): Rational {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`Invalid stored decimal: ${text}`);
  return parsed.value;
}

// The risk (toward the Stop) and reward (toward the Target) at the Review-date Mark and at entry: the
// figures the pressure uses. The at-entry figures use each open Lot's
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
type RiskReward = Extract<CalculationResult<RiskRewardFigures, UnavailableReason, Extract<NotApplicableReason, { reason: 'NoRemainingPosition' }>>, { kind: 'Value' | 'Unavailable' | 'NotApplicable' }>;

function riskRewardOf(state: DerivedTradeState, evaluation: TradeEvaluation): RiskReward {
  const risk = evaluation.ongoingRiskToStop;
  const reward = evaluation.incrementalRewardToTarget;
  if (risk.kind !== 'Value') return risk as RiskReward;
  if (reward.kind !== 'Value') return reward as RiskReward;
  if (risk.kind !== 'Value' || reward.kind !== 'Value' || evaluation.observation.mark === null) throw new Error('A pressure input is neither a Value nor Unavailable');
  const lots = state.positions.flatMap((p) => p.openLots);
  // Each role's headline condition (A197), the one `evaluate`'s own headline measures.
  const stop = measurementOf(headlineBasisOf(state.baseline.stopBasis));
  const target = measurementOf(headlineBasisOf(state.baseline.targetBasis));
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
  if (result.kind !== 'Value') return result;
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

// `lastAction` is the Trade's most recent Daily Trade Review Action before the Review Date, when the caller read it.
export function attentionOf(state: DerivedTradeState, evaluation: TradeEvaluation, findings: readonly IntegrityFinding[], lastAction?: { readonly action: string }): Attention {
  const figures = riskRewardOf(state, evaluation);
  const basis = pressureOf(figures);
  // A due settlement outranks the figures, whatever they are (A112); it is its own band, behind the factual blockers.
  const due = evaluation.settlement.filter((s) => s.status === 'Due').map((s): AttentionReason => ({ code: 'SettlementDue', instrument: s.instrument, quantity: s.quantity, expiration: s.expiration }));
  if (findings.length > 0) return { band: 'Blocker', reasons: [{ code: 'IntegrityDisagreement', findings }, ...due], basis };
  // A line the Underlying's Mark alone shows crossed counts too, while the contract's Mark is unavailable (A110); it has no dollar figure to carry.
  const crossed = evaluation.conditions.flatMap((c) => {
    const code = c.role === 'Stop' ? ('StopBreached' as const) : ('TargetReached' as const);
    if (c.result.kind === 'Value') return c.result.value.status !== 'Active' && c.result.value.overrun ? [{ code, conditionId: c.id, overrun: c.result.value.overrun.dollars }] : [];
    return c.underlyingReading && c.underlyingReading.status !== 'Active' ? [{ code, conditionId: c.id }] : [];
  });
  // The lines the Trade is at or past stay in the reasons, so its label says so as it does on any other day.
  if (lastAction?.action === 'Exit') return { band: 'ExitNotCarriedOut', reasons: [{ code: 'ExitNotCarriedOut' }, ...crossed, ...due], basis };
  if (due.length > 0) return { band: 'SettlementDue', reasons: due, basis };
  if (crossed.length > 0) {
    // The deepest Stop passed, in Plan R, orders the Trades of the StopReached band.
    const stopOverrunsR = evaluation.conditions.flatMap((c) => (c.role === 'Stop' && c.result.kind === 'Value' && c.result.value.status !== 'Active' && c.result.value.overrun ? [c.result.value.overrun.planR] : []));
    if (!crossed.some((reason) => reason.code === 'StopBreached')) return { band: 'TargetReached', reasons: crossed, basis };
    if (stopOverrunsR.length === 0) return { band: 'StopReached', reasons: crossed, basis };
    return { band: 'StopReached', reasons: crossed, basis, stopOverrunR: stopOverrunsR.reduce((a, b) => (b.compare(a) > 0 ? b : a)) };
  }
  const unavailable = evaluation.ongoingRiskToStop;
  if (unavailable.kind === 'Unavailable') {
    return { band: 'EvidenceLimited', reasons: [unavailableReason(unavailable)], basis };
  }
  if (basis.kind === 'Value' && basis.value.side !== 'None') {
    return { band: 'QuantifiedPressure', reasons: [{ code: basis.value.side === 'Losing' ? 'PressureTowardStop' : 'PressureTowardTarget' }], basis };
  }
  return { band: 'Routine', reasons: [{ code: 'NoPressure' }], basis };
}

const BAND_RANK: Record<AttentionBand, number> = { Blocker: 0, ExitNotCarriedOut: 1, SettlementDue: 2, StopReached: 3, TargetReached: 4, EvidenceLimited: 5, QuantifiedPressure: 6, Routine: 7 };

// Band first. Within a band, comparable pressure sorts descending, a losing side before a winning one,
// then Last Activity descending, then Trade identity; a pressure that is not a Value follows the Values.
export function byAttention(a: Attention & TieBreak, b: Attention & TieBreak): number {
  if (a.band !== b.band) return BAND_RANK[a.band] - BAND_RANK[b.band];
  if (a.stopOverrunR && b.stopOverrunR) {
    const byOverrun = b.stopOverrunR.compare(a.stopOverrunR);
    if (byOverrun !== 0) return byOverrun;
  }
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
