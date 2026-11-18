// I9.3 Buying more, selling part, and a sale below the Stop: R-AXIO-U (buys 100, then 100 more) and R-AXIO-D (buys 200, sells 100
// at $45.60 below the $47.00 Stop) through the facade. The two results step on the sessions of the second Buy and the sale.
import { describe, expect, it } from 'vitest';
import { R_AXIO_D, R_AXIO_U } from '../../../src/domain/trade-analysis/reference-trade.ts';
import { dollars as q, overrunOf, readyReplay, row, seriesApp } from './support.ts';

type View = Awaited<ReturnType<typeof readyReplay>>;
const session = (view: View, date: string) => {
  const found = view.sessions.find((s) => s.date === date);
  if (!found) throw new Error(`no session ${date}`);
  return found;
};
const effects = (view: View) => view.sessions.flatMap((s) => (s.markers ?? []).map((m) => [s.date, m.kind, m.effect] as const));

describe('I9.3 Buying more, selling part, and a sale below the Stop', () => {
  it('I9.3 should step the two results on Fri 11-06 for R-AXIO-U and mark Opened then Added', { timeout: 120_000 }, async () => {
    const { app, tradeId } = await seriesApp(R_AXIO_U, 'strategy.long-stock', '2026-11-17T22:00:00Z', { marksThrough: 11 });

    const view = await readyReplay(app, tradeId);

    const active = [['Stop', 'Active'], ['Target', 'Active']];
    expect(row(session(view, '2026-11-02'))).toMatchObject({ held: q(100n), tradePnl: q(40n), risk: q(340n), reward: q(560n), atStop: q(-300n), atTarget: q(600n), conditions: active });
    expect(row(session(view, '2026-11-05'))).toMatchObject({ atStop: q(-300n), atTarget: q(600n) });
    expect(row(session(view, '2026-11-06'))).toMatchObject({ held: q(200n), tradePnl: q(220n), risk: q(960n), reward: q(840n), atStop: q(-740n), atTarget: q(1060n), conditions: active });
    const tuesday = session(view, '2026-11-17');
    expect(row(tuesday)).toMatchObject({ held: q(200n), tradePnl: q(1120n), risk: q(1860n), reward: q(0n), atStop: q(-740n), atTarget: q(1060n) });
    expect(overrunOf(tuesday, 'Target')).toBe(q(60n));
    expect(effects(view)).toEqual([['2026-11-02', 'Execution', 'Opened'], ['2026-11-06', 'Execution', 'Added']]);
  });

  it('I9.3 should bank minus 440 and show a 180 dollar Overrun for R-AXIO-D, with the results stepping on Mon 11-09 and the markers Opened then Reduced', { timeout: 120_000 }, async () => {
    const { app, tradeId } = await seriesApp(R_AXIO_D, 'strategy.long-stock', '2026-11-09T22:00:00Z', { marksThrough: 5 });

    const view = await readyReplay(app, tradeId);

    expect(row(session(view, '2026-11-06'))).toMatchObject({ held: q(200n), tradePnl: q(-380n), banked: q(0n), risk: q(220n), reward: q(1580n), atStop: q(-600n), atTarget: q(1200n) });
    const monday = session(view, '2026-11-09');
    expect(row(monday)).toMatchObject({ held: q(100n), tradePnl: q(-920n), banked: q(-440n), risk: q(0n), reward: q(1080n), atStop: q(-740n), atTarget: q(160n), conditions: [['Stop', 'Breached'], ['Target', 'Active']] });
    expect(overrunOf(monday, 'Stop')).toBe(q(180n));
    expect(effects(view)).toEqual([['2026-11-02', 'Execution', 'Opened'], ['2026-11-09', 'Execution', 'Reduced']]);
  });
});
