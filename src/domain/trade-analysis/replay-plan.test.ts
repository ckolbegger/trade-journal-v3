import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/index.ts';
import { Rational } from '../values/index.ts';
import { BREN_CALL, DALE_PUT, K_SALE, os2Record, OS2_S1, R_BREN_U, R_DALE_D, R_DALE_U } from './option-trade.ts';
import { R_AXIO_D, R_AXIO_U, REPLAY_SESSION_DATES, type ReplayTestSeries } from './reference-trade.ts';
import { replay, type ReplayMarkerFill, type ReplayPlan, type ReplayResult, type ReplaySessionInput } from './replay-series.ts';

const frac = (r: Rational) => `${r.numerator}/${r.denominator}`;
const q = (n: bigint, d = 1n) => frac(Rational.of(n, d));

function planOf(result: ReplayResult): ReplayPlan {
  if (result.kind !== 'Replayed' || !result.plan) throw new Error(`expected a Replayed result with a Plan, got ${JSON.stringify(result)}`);
  return result.plan;
}

// The Plan's terms do not depend on any session, so the Plan column is read with none.
const planOfSeries = (record: Parameters<typeof replay>[0]['record']): ReplayPlan => planOf(replay({ record, sessions: [] satisfies readonly ReplaySessionInput[] }));

describe("replay: the Plan's terms (A269)", () => {
  it("should give each Plan's legs, Stops and Targets as confirmed: R-BREN-U long 4 of the $100 Call at $1.61, Stop the call at $0.80, Target the call at $4.00; R-DALE-D short 6 at $0.94, Stop DALE at $54.00, Target the put at $0.20", () => {
    const bren = planOfSeries(R_BREN_U.record).terms;
    expect(bren?.legs.map((l) => ({ instrument: l.instrument, side: l.side, quantity: frac(l.quantity), entryPrice: frac(l.entryPrice) }))).toEqual([
      { instrument: BREN_CALL, side: 'Long', quantity: q(4n), entryPrice: q(161n, 100n) },
    ]);
    expect(bren?.conditions.map((c) => ({ role: c.role, priceOf: c.priceOf, price: frac(c.price) }))).toEqual([
      { role: 'Stop', priceOf: 'Option', price: q(80n, 100n) },
      { role: 'Target', priceOf: 'Option', price: q(4n) },
    ]);
    const dale = planOfSeries(R_DALE_D.record).terms;
    expect(dale?.legs.map((l) => ({ instrument: l.instrument, side: l.side, quantity: frac(l.quantity), entryPrice: frac(l.entryPrice) }))).toEqual([
      { instrument: DALE_PUT, side: 'Short', quantity: q(6n), entryPrice: q(94n, 100n) },
    ]);
    expect(dale?.conditions.map((c) => ({ role: c.role, priceOf: c.priceOf, price: frac(c.price) }))).toEqual([
      { role: 'Stop', priceOf: 'Underlying', price: q(54n) },
      { role: 'Target', priceOf: 'Option', price: q(20n, 100n) },
    ]);
  });

  it("should give the Plan's odds beside its ratio: R-BREN-U 324/1,280, 25 and 75", () => {
    const odds = planOfSeries(R_BREN_U.record).odds;
    expect(odds && [frac(odds.targetFirst), frac(odds.stopFirst), frac(odds.percent.targetFirst), frac(odds.percent.stopFirst)]).toEqual([
      q(324n, 1280n),
      q(956n, 1280n),
      '25/1',
      '75/1',
    ]);
  });

  it("should list every Stop and Target of a Plan that has two of a role, each with its own planned result: O-S2's Stop on MNO at $41.00 (-$560.00) and on the option at $3.60 (-$480.00), its Target on MNO at $44.50 (+$140.00) and on the option at $0.30 (+$180.00)", () => {
    const terms = planOfSeries(os2Record([OS2_S1])).terms;
    expect(terms?.conditions.map((c) => ({ role: c.role, priceOf: c.priceOf, price: frac(c.price), pnlIfHit: frac(c.pnlIfHit) }))).toEqual([
      { role: 'Stop', priceOf: 'Underlying', price: q(41n), pnlIfHit: q(-560n) },
      { role: 'Stop', priceOf: 'Option', price: q(360n, 100n), pnlIfHit: q(-480n) },
      { role: 'Target', priceOf: 'Underlying', price: q(89n, 2n), pnlIfHit: q(140n) },
      { role: 'Target', priceOf: 'Option', price: q(30n, 100n), pnlIfHit: q(180n) },
    ]);
  });
});

// D9's test Trades: every session of the series, closing 16:00 New York (EST), with each session's Marks (null: no Mark).
const sessionsOf = (series: ReplayTestSeries): readonly ReplaySessionInput[] =>
  REPLAY_SESSION_DATES.map((date, i) => {
    const closeInstant = `${date}T21:00:00Z`;
    const frame = (instrument: Instrument, price: string | null | undefined): ReplaySessionInput['frames'][number] => ({
      instrument,
      tradingDate: date,
      closeInstant,
      resolution: price === null || price === undefined ? { kind: 'Missing' } : { kind: 'Available', mark: { revisionId: `rev-${date}`, revisionNumber: 1, price } },
    });
    return {
      tradingDate: date,
      closeInstant,
      frames: [frame({ kind: 'Stock', symbol: series.record.plan.underlying }, series.underlying[i]), frame(series.record.plan.legs[0]!.instrument, series.held[i])],
    };
  });

// Every fill of the series' markers, in fact order, as the Plan measures it.
const fillsOf = (series: ReplayTestSeries): readonly ReplayMarkerFill[] => {
  const result = replay({ record: series.record, sessions: sessionsOf(series) });
  if (result.kind !== 'Replayed') throw new Error('expected Replayed');
  return result.sessions.flatMap((s) => (s.markers ?? []).flatMap((m) => m.fills));
};
const againstOf = (fill: ReplayMarkerFill | undefined) => fill?.againstPlan && { line: fill.againstPlan.line, side: fill.againstPlan.side, distance: frac(fill.againstPlan.distance) };

describe('replay: each fill against the Plan (A270)', () => {
  it("should measure an opening fill against the Plan's entry (R-BREN-U's Buy of 4 at $1.61 is At it), and give a fill with no price nothing (R-DALE-U's Expiration)", () => {
    expect(againstOf(fillsOf(R_BREN_U)[0])).toEqual({ line: 'Entry', side: 'At', distance: q(0n) });
    const expiration = fillsOf(R_DALE_U).find((f) => f.action === 'Expire');
    expect(expiration).toBeDefined();
    expect(expiration?.againstPlan).toBeUndefined();
  });

  it("should measure an added lot against the Plan's entry: R-AXIO-U's Buy of 100 at $51.40 is Above it by $1.40", () => {
    expect(againstOf(fillsOf(R_AXIO_U)[1])).toEqual({ line: 'Entry', side: 'Above', distance: q(140n, 100n) });
  });

  it("should measure a sale at or beyond the Stop against the Stop: R-AXIO-D's Sell of 100 at $45.60 is Below the Stop by $1.40", () => {
    expect(againstOf(fillsOf(R_AXIO_D)[1])).toEqual({ line: 'Stop', side: 'Below', distance: q(140n, 100n) });
  });

  it("should measure any other reducing fill against the Target: R-BREN-U's Sell of 2 at $4.00 is At the Target, and K-sale's Sell of 2 at $4.91 is Above it by $0.91", () => {
    expect(againstOf(fillsOf(R_BREN_U)[1])).toEqual({ line: 'Target', side: 'At', distance: q(0n) });
    expect(againstOf(fillsOf(K_SALE)[2])).toEqual({ line: 'Target', side: 'Above', distance: q(91n, 100n) });
  });

  it("should measure a buyback on the option's own price and pass over a Stop that is a price of the Underlying: R-DALE-D's Buy of 3 at $2.59 is Above the Target by $2.39", () => {
    expect(againstOf(fillsOf(R_DALE_D)[1])).toEqual({ line: 'Target', side: 'Above', distance: q(239n, 100n) });
  });
});
