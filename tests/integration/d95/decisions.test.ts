// I95.5 The card's last decisions over six sessions (A305, P168), through the real facade on fake-indexeddb.
// XYZ bought Mon 10-05 at 50.00 (Stop 47.50, Target 56.00), reviewed Mon 10-12; Holds saved on earlier Review Dates on the clock of each date.
import { describe, expect, it } from 'vitest';
import { decisionsOf, heldTrade, MARKS } from './support.ts';

// A Trade P&L as plain dollars, or its kind when it has none.
const pnl = (r: { kind: string; value?: { numerator: bigint; denominator: bigint } } | undefined) => (r?.kind === 'Value' ? `${r.value!.numerator}/${r.value!.denominator}` : r?.kind);

const FIVE = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];

describe('I95.5 The last decisions over six sessions (A305)', () => {
  it('should list the last four decisions with each day Trade P&L, the earlier count and the Holds past the Stop', { timeout: 120_000 }, async () => {
    const { app, tradeId } = await heldTrade(MARKS, FIVE);

    const decisions = await decisionsOf(app, tradeId);

    // Newest first, each with that session's Trade P&L (the 1.00 fee included): 100 shares bought at 50.00.
    expect(decisions.recent.map((r) => [r.date, r.action, r.reason, pnl(r.tradePnl as never)])).toEqual([
      ['2026-10-09', 'Hold', 'Held on 2026-10-09.', '-351/1'],
      ['2026-10-08', 'Hold', 'Held on 2026-10-08.', '-301/1'],
      ['2026-10-07', 'Hold', 'Held on 2026-10-07.', '-401/1'],
      ['2026-10-06', 'Hold', 'Held on 2026-10-06.', '-301/1'],
    ]);
    // The fifth Action is the one earlier decision; 10-05 was inside the Stop, so the run past it is the four after.
    expect(decisions.earlier).toBe(1);
    expect(decisions.heldPast).toEqual({ line: 'Stop', sessions: 4 });
    expect(decisions.sessionsWithoutReview).toEqual([]);
  });

  it('should name the sessions with no Review since the last decision and end the Hold count there', { timeout: 120_000 }, async () => {
    const { app, tradeId } = await heldTrade(MARKS, FIVE.slice(0, 3));

    const decisions = await decisionsOf(app, tradeId);

    // Catches a session counted as reviewed, or counted once the Review ended: Thursday and Friday had no Review.
    expect(decisions.sessionsWithoutReview).toEqual(['2026-10-08', '2026-10-09']);
    expect(decisions.recent.map((r) => r.date)).toEqual(['2026-10-07', '2026-10-06', '2026-10-05']);
    expect(decisions.earlier).toBe(0);
    expect(decisions.heldPast).toBeUndefined();
  });
});
