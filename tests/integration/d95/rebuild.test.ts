// I95.12 Rebuild equivalence for the redesigned Review: after the private indexes are dropped and rebuilt from the stored facts, the Review returns
// the same order, Plan Calls, last Actions, last decisions and completion (AC-REBUILD-001), through the real facade on fake-indexeddb.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { rebuildPrivateState } from '../../../src/persistence/index.ts';
import { currentDatabase, restart } from '../d7/support.ts';
import { decisionsOf, heldTrade, MARKS, MON_1700, openOn, saveActionOn, sixTradeBook, walkOf } from './support.ts';

// The Review of Monday without its bindings: the order with each Trade's band, last Action and Plan Call, the day and the completion,
// then each card's Plan Call, last decisions and Plan Exit facts.
async function reviewOf(app: Application) {
  const opened = await openOn(app, MON_1700);
  const review = { ...opened, binding: undefined };
  const cards = [];
  for (const trade of walkOf(opened)) {
    const card = await app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId: trade.tradeId, binding: opened.binding });
    if (card.kind !== 'Ready') throw new Error(`getTrade: ${card.kind}`);
    cards.push({ ...card.trade, saveBinding: undefined });
  }
  return { review, cards };
}

async function rebuilt(app: Application, factory: IDBFactory) {
  const databaseName = await currentDatabase(factory);
  app.persistence.close();
  await rebuildPrivateState(factory, databaseName);
}

describe('I95.12 Rebuild equivalence of the Review (AC-REBUILD-001)', () => {
  it('should return the same order, bands, last Actions, Plan Calls and completion after the private state is rebuilt', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook();
    await saveActionOn(book.app, MON_1700, book.ids.shallow, 'Hold', 'The gap will fill.');
    const before = await reviewOf(book.app);
    // Catches a fixture that leaves nothing for the rebuild to carry: Friday's Exit is the last Action, Monday's Hold is on the day, a reflection is due.
    expect(before.review.completion.kind).toBe('Incomplete');
    expect(walkOf(await openOn(book.app, MON_1700)).map((t) => t.lastAction?.action).filter(Boolean)).toEqual(['Exit']);
    expect(before.review.day?.lines.find((l) => l.tradeId === book.ids.shallow)?.action).toBe('Hold');

    await rebuilt(book.app, book.d.factory);
    const after = await reviewOf(await restart(book.app, book.d));

    expect(after).toEqual(before);
  });

  it('should return the same last decisions and held-past count after the private state is rebuilt', { timeout: 120_000 }, async () => {
    const { app, d, tradeId } = await heldTrade(MARKS, ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
    const before = await decisionsOf(app, tradeId);
    expect(before.recent).toHaveLength(4);
    expect(before.heldPast).toEqual({ line: 'Stop', sessions: 4 });

    await rebuilt(app, d.factory);

    expect(await decisionsOf(await restart(app, d), tradeId)).toEqual(before);
  });

  it('should keep the Hold saved for a Trade and the reflection still due on it after the private state is rebuilt', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook();
    await saveActionOn(book.app, MON_1700, book.ids.inside, 'Hold', 'Staying in.');
    await rebuilt(book.app, book.d.factory);

    const opened = await openOn(await restart(book.app, book.d), MON_1700);

    expect(opened.completion.kind === 'Incomplete' && opened.completion.reasons.filter((r) => r.code === 'ActionMissing').map((r) => r.tradeId)).not.toContain(book.ids.inside);
    expect(opened.day?.lines.find((l) => l.tradeId === book.ids.inside)).toMatchObject({ action: 'Hold', needs: ['Reflection'] });
    expect(opened.completion.kind === 'Incomplete' && opened.completion.reasons.filter((r) => r.code === 'ReflectionDue').map((r) => r.tradeId)).toEqual([book.ids.inside]);
  });
});
