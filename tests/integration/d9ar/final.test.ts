// I9AR.5 A finished Trade (AC-CALC-003, cumulative): K-sale and R-DALE-U with its Expiration recorded. The final session has no odds and
// nothing at stake; K-sale's last sale is Above the Target by $0.91; the Expiration's fill has nothing to measure; the Plan's terms and
// odds are as they were before the end.
import { describe, expect, it } from 'vitest';
import { DALE_PUT, K_SALE, R_BREN_U, R_DALE_U } from '../../../src/domain/trade-analysis/option-trade.ts';
import { closeReviewDisposition, recordExpiration, restart } from '../d7s/support.ts';
import { dollars as q, figure, fillsOf, frac, MON_1116_1700, MON_1123_1800, oddsText, readyReplay, seriesApp, sessionOf } from './support.ts';

const EXPIRATION_TIME = '2026-11-20T21:00:00Z';
const NOTHING = 'NotApplicable:NoRemainingPosition';

// The Plan column's odds as text; throws when the Plan has none.
const planOddsOf = (view: Awaited<ReturnType<typeof readyReplay>>) => {
  const o = view.planColumn?.odds;
  if (!o) throw new Error('no Plan odds');
  return `${frac(o.targetFirst)} ${frac(o.stopFirst)} ${frac(o.percent.targetFirst)}:${frac(o.percent.stopFirst)}`;
};

describe('I9AR.5 A finished Trade', () => {
  it('I9AR.5 should give K-sale a final session with no odds and nothing at stake, its last sale Above the Target by $0.91 and the Plan as before', { timeout: 300_000 }, async () => {
    const sale = await seriesApp(K_SALE, 'strategy.long-call', MON_1116_1700, { marksThrough: 10, closes: true });
    const open = await seriesApp(R_BREN_U, 'strategy.long-call', MON_1116_1700, { marksThrough: 10 });

    const view = await readyReplay(sale.app, sale.tradeId);

    const last = view.sessions.at(-1)!;
    expect(last.final).toEqual({ kind: 'Sold' });
    expect(oddsText(last.figures!.rewardRiskOdds)).toBe(NOTHING);
    expect(figure(last.figures!.ongoingRiskToStop)).toBe(NOTHING);
    expect(figure(last.figures!.incrementalRewardToTarget)).toBe(NOTHING);
    expect(figure(last.figures!.outcomes!.atStop)).toBe(NOTHING);
    expect(figure(last.figures!.outcomes!.atTarget)).toBe(NOTHING);
    expect(fillsOf(last)).toEqual([{ action: 'Sell', quantity: q(2n), price: '4.91', against: { line: 'Target', side: 'Above', distance: '0.91' } }]);
    // The Plan's terms and odds are those of the same Plan before the end.
    expect(view.planColumn).toEqual((await readyReplay(open.app, open.tradeId)).planColumn);
    expect(view.planColumn?.odds?.percent).toBeDefined();
  });

  it('I9AR.5 should give R-DALE-U Expiration fill nothing to measure, no odds on the final session and the Plan as before the end', { timeout: 300_000 }, async () => {
    const marks = [{ instrument: { kind: 'Stock', symbol: 'DALE' } as const, date: '2026-11-20', price: '61.90' }, { instrument: DALE_PUT, date: '2026-11-20', price: '0.00' }];
    const { d, app, tradeId } = await seriesApp(R_DALE_U, 'strategy.cash-secured-put', MON_1123_1800, { marksThrough: 13, without: (id) => id === 'pc-dale-e', extraMarks: marks });
    const due = await readyReplay(app, tradeId);
    const fresh = await restart(app, d);
    await recordExpiration(fresh, tradeId, '6', EXPIRATION_TIME, { closeReview: await closeReviewDisposition(fresh, 'Complete') });

    const expired = await readyReplay(await restart(fresh, d), tradeId);

    const last = expired.sessions.at(-1)!;
    expect(last.final).toEqual({ kind: 'Expired', contract: DALE_PUT });
    expect(fillsOf(last)).toEqual([{ action: 'Expire', quantity: q(6n), price: null, against: null }]);
    expect(oddsText(last.figures!.rewardRiskOdds)).toBe(NOTHING);
    expect(figure(last.figures!.ongoingRiskToStop)).toBe(NOTHING);
    expect(figure(last.figures!.incrementalRewardToTarget)).toBe(NOTHING);
    expect(figure(last.figures!.outcomes!.atStop)).toBe(NOTHING);
    expect(figure(last.figures!.outcomes!.atTarget)).toBe(NOTHING);
    expect(sessionOf(expired, '2026-11-19').crossings).toEqual(sessionOf(due, '2026-11-19').crossings);
    // The Plan's terms and odds are as before the Expiration was recorded.
    expect(due.planColumn?.odds?.percent).toBeDefined();
    expect(expired.planColumn?.odds?.percent).toBeDefined();
    expect(planOddsOf(expired)).toBe(planOddsOf(due));
    expect(expired.planColumn).toEqual(due.planColumn);
    expect(expired.planColumn?.terms?.legs).toHaveLength(1);
  });
});
