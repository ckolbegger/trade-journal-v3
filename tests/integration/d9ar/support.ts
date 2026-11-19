// D9A-R's Node suite helpers: D9's facade-built test Trades, and plain-value projections of the new replay fields (A267 to A271).
import type { ReplaySession } from '../../../src/coordinators/trade-views/index.ts';
import type { CalculationResult } from '../../../src/domain/trade-analysis/index.ts';
import type { Rational } from '../../../src/domain/values/index.ts';
import { frac, type readyReplay } from '../d9/support.ts';

export { dollars, figure, frac, MON_1116_1700, MON_1123_1800, readyReplay, replayView, seriesApp } from '../d9/support.ts';

export const WED_1111_1700 = '2026-11-11T22:00:00Z';

export type View = Awaited<ReturnType<typeof readyReplay>>;

export function sessionOf(view: View, date: string): ReplaySession {
  const found = view.sessions.find((s) => s.date === date);
  if (!found) throw new Error(`no session ${date}`);
  return found;
}

type Odds = Extract<NonNullable<NonNullable<ReplaySession['figures']>['rewardRiskOdds']>, { kind: 'Value' }>['value'];

// An odds result as plain text: the two chances and their whole percents, or its kind and reason.
export const oddsText = (r: CalculationResult<Odds> | undefined): string => {
  if (!r) throw new Error('no odds');
  if (r.kind === 'Value') return `${frac(r.value.targetFirst)} ${frac(r.value.stopFirst)} ${frac(r.value.percent.targetFirst)}:${frac(r.value.percent.stopFirst)}`;
  return `${r.kind}:${'reason' in r ? String(r.reason) : ''}`;
};

// A price or a distance with two decimals, as a plain string.
export const price = (r: Rational): string => {
  const cents = (r.numerator * 100n) / r.denominator;
  if (cents * r.denominator !== r.numerator * 100n) throw new Error(`not a cent amount: ${frac(r)}`);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
};

// A session's fills, each as its action, quantity, price and what it is measured against.
export function fillsOf(s: ReplaySession) {
  return (s.markers ?? []).flatMap((m) =>
    m.fills.map((f) => ({
      action: f.action,
      quantity: frac(f.quantity),
      price: f.price ? price(f.price) : null,
      against: f.againstPlan ? { line: f.againstPlan.line, side: f.againstPlan.side, distance: price(f.againstPlan.distance) } : null,
    })),
  );
}

// A session's role crossings as dates (and whether each was first seen after a gap).
export function crossingsOf(s: ReplaySession, role: 'stop' | 'target') {
  const part = s.crossings?.[role];
  if (!part) throw new Error(`no crossings on ${s.date}`);
  const d = (c?: { date: string; afterGap: boolean }) => (c ? { date: c.date, afterGap: c.afterGap } : null);
  return { first: d(part.first), since: d(part.since) };
}
