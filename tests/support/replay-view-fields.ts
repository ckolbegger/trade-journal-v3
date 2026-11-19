// Builders for the replay view's D9A-R fields (A267 to A271): the estimated odds, the extremes' weight, the Plan column's
// terms, a fill's `againstPlan` and a session's crossings. Each takes the plain numbers a test cares about and returns the
// view's own shape, so integration and screen tests can lay them over a replay session or the Plan column.
import type { Instrument } from '../../src/domain/instrument/index.ts';
import type { ReplayCrossings, ReplayFigures, ReplayPlanColumn } from '../../src/coordinators/trade-views/replay-view.ts';
import { oddsOf as domainOddsOf } from '../../src/domain/trade-analysis/evaluate.ts';
import { Rational } from '../../src/domain/values/index.ts';

const r = (n: number, d = 1) => Rational.of(BigInt(n), BigInt(d));

type Odds = NonNullable<ReplayPlanColumn['odds']>;
type Terms = NonNullable<ReplayPlanColumn['terms']>;
type Crossing = { readonly date: string; readonly afterGap?: boolean };
type Dates = { readonly first?: Crossing; readonly since?: Crossing };

// The odds of `targetPercent` whole percent for the Target first (the Stop's is the rest to 100).
export function oddsOf(targetPercent: number): Odds {
  return {
    targetFirst: r(targetPercent, 100),
    stopFirst: r(100 - targetPercent, 100),
    percent: { targetFirst: r(targetPercent), stopFirst: r(100 - targetPercent) },
  };
}

// A session's figures carrying the odds and the extremes' weight.
export function figuresWithOdds(targetPercent: number, extremes: 'Main' | 'Remote'): Pick<ReplayFigures, 'rewardRiskOdds' | 'extremes'> {
  return { rewardRiskOdds: { kind: 'Value', value: oddsOf(targetPercent) }, extremes };
}

// A Plan column with its terms: one Long leg and a Stop and a Target, priced on the Underlying.
export function planColumnWithTerms(instrument: Instrument, entry: number, stop: number, target: number, quantity = 1): ReplayPlanColumn {
  const terms: Terms = {
    legs: [{ instrument, side: 'Long', quantity: r(quantity), entryPrice: r(entry) }],
    conditions: [
      { role: 'Stop', priceOf: 'Underlying', price: r(stop), pnlIfHit: r((stop - entry) * quantity) },
      { role: 'Target', priceOf: 'Underlying', price: r(target), pnlIfHit: r((target - entry) * quantity) },
    ],
  };
  return { atStop: r((stop - entry) * quantity), atTarget: r((target - entry) * quantity), rewardRisk: r(target - entry, entry - stop), odds: domainOddsOf(r(entry - stop), r(target - entry)), terms };
}

// A fill's `againstPlan`: the line, where the price lies against it, and the distance in price.
export function againstPlanOf(line: 'Entry' | 'Stop' | 'Target', side: 'At' | 'Above' | 'Below', distance: number) {
  return { line, side, distance: r(distance) } as const;
}

const dates = ({ first, since }: Dates) => ({
  ...(first && { first: { date: first.date, afterGap: first.afterGap ?? false } }),
  ...(since && { since: { date: since.date, afterGap: since.afterGap ?? false } }),
});

// A session's crossings: each role's dates, with no per-condition entries unless given.
export function crossingsOf(stop: Dates = {}, target: Dates = {}): ReplayCrossings {
  return { stop: { ...dates(stop), conditions: [] }, target: { ...dates(target), conditions: [] } };
}
