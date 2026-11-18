// I9.4 The Review's replay: R-BREN-U with Marks through Thu 11-12. The Review for Thu 11-12, opened as of Fri 11-13 13:00 before Friday's
// Marks and again after them, returns a replay that ends at Thursday both times and equals replayTrade's through Thursday. The card
// places no Journal items (T9.7-F2), so replayTrade's side is compared with its Journal items left out.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { BREN_CALL, R_BREN_U } from '../../../src/domain/trade-analysis/option-trade.ts';
import { REPLAY_SESSION_DATES } from '../../../src/domain/trade-analysis/reference-trade.ts';
import { restart, saveMark } from '../d7s/support.ts';
import { readyReplay, seriesApp } from './support.ts';

const FRI_1113_1300 = '2026-11-13T18:00:00Z';
const FRI_1113_1700 = '2026-11-13T22:00:00Z';
const THURSDAY = '2026-11-12';

// The Review as of Friday 13:00, then the card of the Trade, as the screen reads them.
async function reviewCard(app: Application, tradeId: string) {
  const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: FRI_1113_1300 });
  if (opened.kind !== 'Ready') throw new Error(`DailyReview.open: ${opened.kind}`);
  const card = await app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (card.kind !== 'Ready') throw new Error(`DailyReview.getTrade: ${card.kind}`);
  if (!card.trade.replay) throw new Error('no replay on the card');
  return { reviewDate: opened.reviewDate, replay: card.trade.replay };
}

// replayTrade's view cut off after Thursday, with its Journal items left out as the card has none.
async function replayThroughThursday(app: Application, tradeId: string) {
  const view = await readyReplay(app, tradeId);
  const sessions = view.sessions.filter((s) => s.date <= THURSDAY).map((s) => ({ ...s, journal: [] }));
  return { instruments: view.instruments, sessions, planColumn: view.planColumn };
}

describe('I9.4 The Review replay', () => {
  it('I9.4 should end the card replay at Thursday before and after Friday Marks, equal to replayTrade through Thursday', { timeout: 120_000 }, async () => {
    const { d, app, tradeId } = await seriesApp(R_BREN_U, 'strategy.long-call', FRI_1113_1700, { marksThrough: 8 });

    const before = await reviewCard(app, tradeId);

    expect(before.reviewDate).toBe(THURSDAY);
    expect(before.replay.sessions.map((s) => s.date)).toEqual(REPLAY_SESSION_DATES.slice(0, 9));
    const through = await replayThroughThursday(app, tradeId);
    expect(before.replay.sessions).toEqual(through.sessions);
    expect(before.replay.instruments).toEqual(through.instruments);
    expect(before.replay.planColumn).toEqual(through.planColumn);

    // Friday's Marks are saved, and the Review as of Friday 13:00 is read again.
    await saveMark(app, 'BREN', '2026-11-13', '104.60');
    await saveMark(app, instrumentKey(BREN_CALL), '2026-11-13', '4.91');
    const fresh = await restart(app, d);

    const after = await reviewCard(fresh, tradeId);

    expect(after.reviewDate).toBe(THURSDAY);
    expect(after.replay.sessions.map((s) => s.date)).toEqual(REPLAY_SESSION_DATES.slice(0, 9));
    const throughAfter = await replayThroughThursday(fresh, tradeId);
    expect(after.replay.sessions).toEqual(throughAfter.sessions);
    expect(after.replay.sessions).toEqual(before.replay.sessions);
    // replayTrade itself now runs to Friday.
    expect((await readyReplay(fresh, tradeId)).sessions.at(-1)!.date).toBe('2026-11-13');
  });
});
