// I9.1 The replay's figures, end to end (AC-CALC-003, per session): R-BREN-U entered through the facade, Marks to Mon 11-16,
// read with replayTrade, then again after a restart. Section 5's figures on each named session.
import { describe, expect, it } from 'vitest';
import { R_BREN_U } from '../../../src/domain/trade-analysis/option-trade.ts';
import { REPLAY_SESSION_DATES } from '../../../src/domain/trade-analysis/reference-trade.ts';
import { restart } from '../d7s/support.ts';
import { dollars as q, MON_1116_1700, overrunOf, readyReplay, row, seriesApp } from './support.ts';

const named = (view: Awaited<ReturnType<typeof readyReplay>>, date: string) => {
  const found = view.sessions.find((s) => s.date === date);
  if (!found) throw new Error(`no session ${date}`);
  return found;
};

describe('I9.1 The replay figures, end to end', () => {
  it('I9.1 should give section 5 figures on each named session of R-BREN-U, equal after a restart', { timeout: 120_000 }, async () => {
    const { d, app, tradeId } = await seriesApp(R_BREN_U, 'strategy.long-call', MON_1116_1700, { marksThrough: 10 });

    const view = await readyReplay(app, tradeId);

    expect(view.sessions.map((s) => s.date)).toEqual(REPLAY_SESSION_DATES.slice(0, 11));
    const active = [['Stop', 'Active'], ['Target', 'Active']];
    const reached = [['Stop', 'Active'], ['Target', 'Reached']];
    expect(row(named(view, '2026-11-02'))).toEqual({ date: '2026-11-02', held: q(4n), tradePnl: q(28n), banked: q(0n), risk: q(352n), reward: q(928n), atStop: q(-324n), atTarget: q(956n), conditions: active });
    expect(row(named(view, '2026-11-11'))).toEqual({ date: '2026-11-11', held: q(4n), tradePnl: q(520n), banked: q(0n), risk: q(844n), reward: q(436n), atStop: q(-324n), atTarget: q(956n), conditions: active });
    // Thu 11-12: 2 sold at $4.00 banks +$478 and the result at the Stop steps to +$316; the Target is reached, $26 past it.
    const thursday = named(view, '2026-11-12');
    expect(row(thursday)).toEqual({ date: '2026-11-12', held: q(2n), tradePnl: q(982n), banked: q(478n), risk: q(666n), reward: q(0n), atStop: q(316n), atTarget: q(956n), conditions: reached });
    expect(overrunOf(thursday, 'Target')).toBe(q(26n));
    expect(row(named(view, '2026-11-13'))).toEqual({ date: '2026-11-13', held: q(2n), tradePnl: q(1138n), banked: q(478n), risk: q(822n), reward: q(0n), atStop: q(316n), atTarget: q(956n), conditions: reached });
    const monday = named(view, '2026-11-16');
    expect(row(monday)).toEqual({ date: '2026-11-16', held: q(2n), tradePnl: q(988n), banked: q(478n), risk: q(672n), reward: q(0n), atStop: q(316n), atTarget: q(956n), conditions: reached });
    expect(overrunOf(monday, 'Target')).toBe(q(32n));

    // After a restart the same Workspace gives the same replay.
    const again = await readyReplay(await restart(app, d), tradeId);
    expect(again).toEqual(view);
  });
});
