// D9's Node suite fixtures: section 5's test Trades built through the real facade (tests/support/replay-series-app.ts) and a plain-value
// projection of a replayed session, so a figure reads as section 5's dollars.
import type { CalculationResult } from '../../../src/domain/trade-analysis/index.ts';
import type { ReplaySession } from '../../../src/coordinators/trade-views/index.ts';
import { Rational } from '../../../src/domain/values/index.ts';

export { readyReplay, replayView, seriesApp } from '../../support/replay-series-app.ts';

export const MON_1116_1700 = '2026-11-16T22:00:00Z';
export const MON_1123_1800 = '2026-11-23T23:00:00Z';

export const frac = (r: Rational): string => `${r.numerator}/${r.denominator}`;
// Whole dollars (or a fraction of them) as a plain string, so two figures compare by value.
export const dollars = (n: bigint, d = 1n): string => frac(Rational.of(n, d));

// A Calculation Result as its dollars, or its kind and reason when it has none.
export const figure = (r: CalculationResult<Rational>): string => (r.kind === 'Value' ? frac(r.value) : `${r.kind}:${'reason' in r ? String(r.reason) : ''}`);

// One session as section 5 tables it.
export function row(s: ReplaySession) {
  const f = s.figures;
  if (!f) throw new Error(`no figures on ${s.date}`);
  const outcomes = f.outcomes;
  if (!outcomes) throw new Error(`no outcomes on ${s.date}`);
  return {
    date: s.date,
    held: frac(s.heldQuantity),
    tradePnl: figure(s.tradePnl),
    banked: frac(s.realizedPnl),
    risk: figure(f.ongoingRiskToStop),
    reward: figure(f.incrementalRewardToTarget),
    atStop: figure(outcomes.atStop),
    atTarget: figure(outcomes.atTarget),
    conditions: f.conditions.map((c) => [c.role, c.result.kind === 'Value' ? c.result.value.status : c.result.kind] as const),
  };
}

// The Overrun of a session's condition, as dollars, or null when it is not crossed.
export function overrunOf(s: ReplaySession, role: 'Stop' | 'Target'): string | null {
  const condition = s.figures?.conditions.find((c) => c.role === role);
  if (condition?.result.kind !== 'Value') throw new Error(`no ${role} reading on ${s.date}`);
  return condition.result.value.overrun && frac(condition.result.value.overrun.dollars);
}
