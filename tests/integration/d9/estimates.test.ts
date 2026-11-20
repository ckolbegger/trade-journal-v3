// I9.8 Estimates explain and never value, I9.9 The exact figures don't read the estimates (AC-CALC-005): R-BREN-U, R-CORV-D, R-DALE-D
// and R-AXIO-U through the facade, each replayed session's estimates read from the view.
// The pricing module may be read only by replay-estimates.ts (the estimates lint rule), so the price-back check prices with its own
// small Black-Scholes below, from the estimate's own rate and days, and does not import the production formula.
import { describe, expect, it } from 'vitest';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { BREN_CALL, R_BREN_U, R_CORV_D, R_DALE_D } from '../../../src/domain/trade-analysis/option-trade.ts';
import { R_AXIO_U, type ReplayTestSeries } from '../../../src/domain/trade-analysis/reference-trade.ts';
import { dollars as q, figure, MON_1116_1700, overrunOf, readyReplay, row, seriesApp } from './support.ts';

type View = Awaited<ReturnType<typeof readyReplay>>;
type Session = View['sessions'][number];
const session = (view: View, date: string): Session => {
  const found = view.sessions.find((s) => s.date === date);
  if (!found) throw new Error(`no session ${date}`);
  return found;
};
const estimatesOf = (s: Session) => {
  if (!s.estimates) throw new Error(`no estimates on ${s.date}`);
  return s.estimates;
};

const WED_1111_1700 = '2026-11-11T22:00:00Z';
const FRI_1113_1700 = '2026-11-13T22:00:00Z';
const THU_1106_1700 = '2026-11-06T22:00:00Z';
const REASONS = ['MarkMissing', 'ExpirationSession', 'AtOrBelowExerciseValue', 'NoVolatilityFits', 'InsensitiveToVolatility', 'NoEarlierFigure'];

// The price of a European option without dividends (Black-Scholes), written out here so the test stands apart from the module it checks.
const normalCdf = (x: number): number => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const tail = (Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI)) * poly;
  return x >= 0 ? 1 - tail : tail;
};
const priceOf = (right: string, underlying: number, strike: number, days: number, volatility: number, rate: number): number => {
  const t = days / 365;
  const sd = volatility * Math.sqrt(t);
  const d1 = (Math.log(underlying / strike) + (rate + (volatility * volatility) / 2) * t) / sd;
  const d2 = d1 - sd;
  const discounted = strike * Math.exp(-rate * t);
  return right === 'Call' ? underlying * normalCdf(d1) - discounted * normalCdf(d2) : discounted * normalCdf(-d2) - underlying * normalCdf(-d1);
};

// A session's option and Underlying Marks as numbers, with the option's terms; null where either Mark is missing.
function inputsOf(s: Session) {
  const priceOfMark = (kind: 'Stock' | 'Option') => {
    const mark = s.marks.find((m) => m.instrument.kind === kind);
    return mark?.resolution.kind === 'Available' ? { price: Number(mark.resolution.mark.price), instrument: mark.instrument } : null;
  };
  const option = priceOfMark('Option');
  const stock = priceOfMark('Stock');
  if (!option || !stock || option.instrument.kind !== 'Option') return null;
  return { mark: option.price, underlying: stock.price, strike: Number(option.instrument.strike), right: option.instrument.right };
}

const optionChange = (s: Session): number => {
  const change = s.marks.find((m) => m.instrument.kind === 'Option')?.change;
  if (!change) throw new Error(`no Mark change on ${s.date}`);
  return Number(change.dollars.numerator) / Number(change.dollars.denominator);
};

const OPTION_TRADES: readonly (readonly [ReplayTestSeries, string, string, number])[] = [
  [R_BREN_U, 'strategy.long-call', MON_1116_1700, 10],
  [R_CORV_D, 'strategy.long-put', WED_1111_1700, 7],
  [R_DALE_D, 'strategy.cash-secured-put', FRI_1113_1700, 9],
];

const UNPRICED: Record<string, string[]> = { 'R-BREN-U': [], 'R-CORV-D': ['2026-11-10'], 'R-DALE-D': [] };
const NOT_SPLIT: Record<string, [string, string][]> = {
  'R-BREN-U': [['2026-11-02', 'NoEarlierFigure']],
  'R-CORV-D': [['2026-11-02', 'NoEarlierFigure'], ['2026-11-10', 'MarkMissing'], ['2026-11-11', 'MarkMissing']],
  'R-DALE-D': [['2026-11-02', 'NoEarlierFigure']],
};

describe('I9.8 Estimates explain and never value (AC-CALC-005)', () => {
  it('I9.8 should price each session implied volatility back to its Mark within half a cent, with the estimate rate and days', { timeout: 120_000 }, async () => {
    for (const [series, strategy, now, marksThrough] of OPTION_TRADES) {
      const { app, tradeId } = await seriesApp(series, strategy, now, { marksThrough });

      const view = await readyReplay(app, tradeId);

      const unpriced: string[] = [];
      for (const s of view.sessions) {
        const volatility = estimatesOf(s).impliedVolatility;
        const inputs = inputsOf(s);
        if (!inputs) {
          unpriced.push(s.date);
          continue;
        }
        if (volatility.kind !== 'Estimate') throw new Error(`${series.id} ${s.date}: ${JSON.stringify(volatility)}`);
        const { rate, days } = estimatesOf(s);
        expect(rate).toBe(0.04);
        expect(days).toBeGreaterThan(0);
        expect(Math.abs(priceOf(inputs.right, inputs.underlying, inputs.strike, days!, volatility.value, rate!) - inputs.mark), `${series.id} ${s.date}`).toBeLessThanOrEqual(0.005);
      }
      // Only R-CORV-D Tue 11-10 lacks a Mark; any other missing input fails here instead of passing silently.
      expect(unpriced, series.id).toEqual(UNPRICED[series.id]);
    }
  });

  it('I9.8 should add the split parts up to the change in the Mark', { timeout: 120_000 }, async () => {
    for (const [series, strategy, now, marksThrough] of OPTION_TRADES) {
      const { app, tradeId } = await seriesApp(series, strategy, now, { marksThrough });

      const view = await readyReplay(app, tradeId);

      const notSplit: [string, string][] = [];
      for (const s of view.sessions) {
        const found = estimatesOf(s).split;
        if (found.kind !== 'Split') {
          notSplit.push([s.date, found.kind === 'Unavailable' ? found.reason : found.kind]);
          continue;
        }
        const parts = 'time' in found ? found.underlying + found.time + found.volatility + found.remainder : found.underlying + found.timeAndVolatility + found.remainder;
        expect(parts, `${series.id} ${s.date}`).toBeCloseTo(optionChange(s), 9);
      }
      // Every session is split except these: the first (nothing earlier) and R-CORV-D's two sessions around its missing Mark.
      expect(notSplit, series.id).toEqual(NOT_SPLIT[series.id]);
    }
  });

  it('I9.8 should give R-CORV-D Tue 11-10 estimates that are Unavailable for the missing Mark, and the next session no split from it', { timeout: 120_000 }, async () => {
    const { app, tradeId } = await seriesApp(R_CORV_D, 'strategy.long-put', WED_1111_1700, { marksThrough: 7 });

    const view = await readyReplay(app, tradeId);

    const tuesday = estimatesOf(session(view, '2026-11-10'));
    expect(tuesday.impliedVolatility).toEqual({ kind: 'Unavailable', reason: 'MarkMissing' });
    expect(tuesday.shareEquivalent).toEqual({ kind: 'Unavailable', reason: 'MarkMissing' });
    expect(tuesday.split).toEqual({ kind: 'Unavailable', reason: 'MarkMissing', session: '2026-11-10' });
    // Wednesday has its own volatility; its split is measured from the last Mark (Mon 11-09) and cannot be worked out.
    const wednesday = estimatesOf(session(view, '2026-11-11'));
    expect(wednesday.impliedVolatility.kind).toBe('Estimate');
    expect(wednesday.split).toMatchObject({ kind: 'Unavailable', reason: 'MarkMissing', session: '2026-11-10', since: '2026-11-09' });
  });

  it('I9.8 should give only stable reason codes where an estimate is Unavailable', { timeout: 120_000 }, async () => {
    const reasons: string[] = [];
    for (const [series, strategy, now, marksThrough] of OPTION_TRADES) {
      const { app, tradeId } = await seriesApp(series, strategy, now, { marksThrough });
      const view = await readyReplay(app, tradeId);
      for (const s of view.sessions) {
        const e = estimatesOf(s);
        for (const found of [e.impliedVolatility, e.shareEquivalent, e.split]) if (found.kind === 'Unavailable') reasons.push(found.reason);
      }
    }

    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) expect(REASONS).toContain(reason);
    // The first session has no earlier session to split from.
    expect(reasons).toContain('NoEarlierFigure');
    expect(reasons).toContain('MarkMissing');
  });

  it('I9.8 should give a stock Trade estimates that are Not applicable or exact', { timeout: 120_000 }, async () => {
    const { app, tradeId } = await seriesApp(R_AXIO_U, 'strategy.long-stock', THU_1106_1700, { marksThrough: 4 });

    const view = await readyReplay(app, tradeId);

    expect(view.sessions.length).toBe(5);
    for (const s of view.sessions) {
      const e = estimatesOf(s);
      expect(e.impliedVolatility).toEqual({ kind: 'NotApplicable' });
      expect(e.split).toEqual({ kind: 'NotApplicable' });
      expect(e.shareEquivalent).toEqual({ kind: 'Estimate', value: Number(s.heldQuantity.numerator) / Number(s.heldQuantity.denominator), exact: true });
      expect([e.rate, e.days]).toEqual([null, null]);
    }
    expect(estimatesOf(session(view, '2026-11-02')).shareEquivalent).toMatchObject({ value: 100 });
    expect(estimatesOf(session(view, '2026-11-06')).shareEquivalent).toMatchObject({ value: 200 });
  });
});

describe('I9.9 The exact figures do not read the estimates (AC-CALC-005, AC-CALC-004)', () => {
  it('I9.9 should give no implied volatility and every exact figure a Value while the Mark is at its exercise value, then section 5 figures and the estimates once corrected to 4.16', { timeout: 120_000 }, async () => {
    const { app, tradeId } = await seriesApp(R_BREN_U, 'strategy.long-call', MON_1116_1700, { marksThrough: 10, skipHeldOn: ['2026-11-16'] });
    const saved = await app.MarketData.save({ intention: 'RecordInitialManualMark', instrumentKey: instrumentKey(BREN_CALL), tradingDate: '2026-11-16', price: '4.00', expectedResolutionRevision: 'None' });
    if (saved.kind !== 'Saved') throw new Error(`save: ${JSON.stringify(saved)}`);

    const atExercise = session(await readyReplay(app, tradeId), '2026-11-16');

    expect(estimatesOf(atExercise).impliedVolatility).toEqual({ kind: 'Unavailable', reason: 'AtOrBelowExerciseValue' });
    expect(estimatesOf(atExercise).shareEquivalent.kind).toBe('Unavailable');
    const callMark = atExercise.marks.find((m) => m.instrument.kind === 'Option')?.resolution;
    if (callMark?.kind !== 'Available') throw new Error('expected the saved call Mark');
    const f = atExercise.figures!;
    for (const exact of [atExercise.tradePnl, f.ongoingRiskToStop, f.incrementalRewardToTarget, f.outcomes!.atStop, f.outcomes!.atTarget]) expect(exact.kind).toBe('Value');
    expect(f.conditions.every((c) => c.result.kind === 'Value')).toBe(true);

    const corrected = await app.MarketData.save({ intention: 'CorrectMark', instrumentKey: instrumentKey(BREN_CALL), tradingDate: '2026-11-16', price: '4.16', reason: 'Typo.', expectedResolutionRevision: callMark.mark.revisionNumber });
    if (corrected.kind !== 'Saved') throw new Error(`CorrectMark: ${JSON.stringify(corrected)}`);

    const monday = session(await readyReplay(app, tradeId), '2026-11-16');

    expect(estimatesOf(monday).impliedVolatility.kind).toBe('Estimate');
    expect(estimatesOf(monday).shareEquivalent.kind).toBe('Estimate');
    expect(estimatesOf(monday).split.kind).toBe('Split');
    expect(row(monday)).toEqual({
      date: '2026-11-16', held: q(2n), tradePnl: q(988n), banked: q(478n), risk: q(672n), reward: q(0n), atStop: q(316n), atTarget: q(956n),
      conditions: [['Stop', 'Active'], ['Target', 'Reached']],
    });
    expect(overrunOf(monday, 'Target')).toBe(q(32n));
    // The $510 open profit inside the Risk to stop is the Trade P&L less what is banked.
    expect(figure(monday.tradePnl)).toBe(q(988n));
    expect(q(988n - 478n)).toBe(q(510n));
  });
});
