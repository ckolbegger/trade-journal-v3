// I9.5 How a replay ends: K-sale ends final, Sold; R-DALE-U ends at its Expiration session with nothing final while Settlement Due and
// final, Expired once the Expiration is recorded; a Planned Trade has no replay. All through the facade.
import { describe, expect, it } from 'vitest';
import { DALE_PUT, K_SALE, R_DALE_U } from '../../../src/domain/trade-analysis/option-trade.ts';
import { REPLAY_SESSION_DATES } from '../../../src/domain/trade-analysis/reference-trade.ts';
import { closeReviewDisposition, device, onboarded, planStock, recordExpiration, restart } from '../d7s/support.ts';
import { dollars as q, figure, MON_1116_1700, MON_1123_1800, readyReplay, replayView, seriesApp } from './support.ts';

const EXPIRATION_TIME = '2026-11-20T21:00:00Z';

describe('I9.5 How a replay ends', () => {
  it('I9.5 should end K-sale at Friday 11-13 final, Sold, with the Trade P&L the realized result', { timeout: 120_000 }, async () => {
    const { app, tradeId } = await seriesApp(K_SALE, 'strategy.long-call', MON_1116_1700, { marksThrough: 10, closes: true });

    const view = await readyReplay(app, tradeId);

    expect(view.sessions.map((s) => s.date)).toEqual(REPLAY_SESSION_DATES.slice(0, 10));
    const last = view.sessions.at(-1)!;
    expect(last.final).toEqual({ kind: 'Sold' });
    expect(view.sessions.slice(0, -1).every((s) => s.final === undefined)).toBe(true);
    expect(figure(last.tradePnl)).toBe(q(1138n));
    expect(last.realizedPnl).toEqual(last.tradePnl.kind === 'Value' ? last.tradePnl.value : undefined);
    expect(view.pending).toBeNull();
  });

  it('I9.5 should end R-DALE-U at Fri 11-20 with nothing final while Settlement Due, then final, Expired once the Expiration is recorded', { timeout: 120_000 }, async () => {
    // Marks to Thu 11-19, and Fri 11-20's Marks for DALE and the put; the Expiration is not recorded yet.
    const marks = [{ instrument: { kind: 'Stock', symbol: 'DALE' } as const, date: '2026-11-20', price: '61.90' }, { instrument: DALE_PUT, date: '2026-11-20', price: '0.00' }];
    const { d, app, tradeId } = await seriesApp(R_DALE_U, 'strategy.cash-secured-put', MON_1123_1800, { marksThrough: 13, without: (id) => id === 'pc-dale-e', extraMarks: marks });

    const due = await readyReplay(app, tradeId);

    expect(due.sessions.map((s) => s.date)).toEqual(REPLAY_SESSION_DATES);
    expect(due.sessions.every((s) => s.final === undefined)).toBe(true);
    expect(due.pending).toBeNull();
    expect(due.sessions.at(-1)!.heldQuantity).toEqual(due.sessions.at(-2)!.heldQuantity);
    expect(figure(due.sessions.at(-1)!.tradePnl)).toBe(q(564n));

    // The Expiration is recorded with its Close Review.
    const fresh = await restart(app, d);
    await recordExpiration(fresh, tradeId, '6', EXPIRATION_TIME, { closeReview: await closeReviewDisposition(fresh, 'Complete') });

    const expired = await readyReplay(await restart(fresh, d), tradeId);

    expect(expired.sessions.map((s) => s.date)).toEqual(REPLAY_SESSION_DATES);
    const last = expired.sessions.at(-1)!;
    expect(last.final).toEqual({ kind: 'Expired', contract: DALE_PUT });
    expect(expired.sessions.slice(0, -1).every((s) => s.final === undefined)).toBe(true);
    expect(figure(last.tradePnl)).toBe(q(564n));
    expect(last.heldQuantity.numerator).toBe(0n);
    expect(expired.pending).toBeNull();
  });

  it('I9.5 should report R-DALE-U as Settlement Due with exposure outstanding before its Expiration is recorded', { timeout: 120_000 }, async () => {
    const marks = [{ instrument: { kind: 'Stock', symbol: 'DALE' } as const, date: '2026-11-20', price: '61.90' }, { instrument: DALE_PUT, date: '2026-11-20', price: '0.00' }];
    const { app, tradeId } = await seriesApp(R_DALE_U, 'strategy.cash-secured-put', MON_1123_1800, { marksThrough: 13, without: (id) => id === 'pc-dale-e', extraMarks: marks });

    const { detail, result } = await replayView(app, tradeId);

    // The Detail reports the Settlement Due: the put's Expiration Fri 11-20 is past and unrecorded, still Open.
    const view = detail.view;
    if (!('current' in view)) throw new Error('expected an Open Detail');
    expect(view.settlement).toEqual([expect.objectContaining({ expiration: '2026-11-20' })]);
    expect(view.lifecycle).toEqual({ stored: 'Open', agreement: { kind: 'Agrees' } });
    // The replay ends at Fri 11-20 with the exposure still held.
    if (result.kind !== 'Ready' || !('sessions' in result.view)) throw new Error(`replayTrade: ${result.kind}`);
    const last = result.view.sessions.at(-1)!;
    expect(last.date).toBe('2026-11-20');
    expect(last.final).toBeUndefined();
    expect(last.heldQuantity.numerator).not.toBe(0n);
  });

  it('I9.5 should give a Planned Trade no replay: Not applicable', { timeout: 120_000 }, async () => {
    const d = await device(undefined, MON_1116_1700);
    const app = await onboarded(d);
    const tradeId = await planStock(app, 'XYZ', '50.00', '47.50', '56.00');

    const { result } = await replayView(app, tradeId);

    expect(result).toEqual({ kind: 'NotApplicable', reason: 'NeverExposed' });
  });
});
