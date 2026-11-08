// I7.13: rebuilding private state gives equal lists, Details, payoff views and Review, and identical byLifecycleTerminal,
// byLifecycleActivity and journalObligations, in a Workspace holding the states I7.3 (O-C closed by sale and Expiration),
// I7.4 (O-S closed by buybacks, by an earlier-dated buyback, and by Expiration) and I7.7 (the Settlement Review fixture
// with T-1 expired and its Close Review deferred) leave behind (AC-REBUILD-001).
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { rebuildPrivateState } from '../../../src/persistence/index.ts';
import {
  closeReasonId, closeReviewDisposition, confirmOption, currentDatabase, detailOf, device, dumpAll, FRIDAY_1600, FRIDAY_1700, FRIDAY_DATE, listed, OC_PC1, OC_PC2, OC_X1, onboarded, OS_B1, OS_S1,
  outstandingDebts, readIndex, recordExpiration, recordOption, restart, reviewAt, saveAction, saveMark, settlementTrades, WEDNESDAY_10, workspaceStores, type Fill,
} from './support.ts';

const B2: Fill = { quantity: '1', price: '0.40', economicTime: WEDNESDAY_10, fee: '0.65' };
const B0: Fill = { quantity: '1', price: '0.55', economicTime: '2026-10-12T14:30:00Z', fee: '0.65' };

// Raw damage with no application open: removes terminalTime, terminalDesc and activityDesc from every Trade and
// clears journalObligations (the same damage D6's I6.14 writes).
async function damagePrivateState(factory: IDBFactory, databaseName: string): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = factory.open(databaseName);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('open failed'));
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['trades', 'journalObligations'], 'readwrite');
    tx.objectStore('journalObligations').clear();
    const cursor = tx.objectStore('trades').openCursor();
    cursor.onsuccess = () => {
      const at = cursor.result;
      if (!at) return;
      const trade = { ...(at.value as Record<string, unknown>) };
      delete trade['terminalTime'];
      delete trade['terminalDesc'];
      delete trade['activityDesc'];
      at.update(trade);
      at.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('damage failed'));
  });
  db.close();
}

// The three lists, every listed Trade's Detail, the Friday Review without its binding, and the Outstanding Debts.
async function views(app: Application) {
  const lists: Record<string, unknown> = {};
  const details: unknown[] = [];
  for (const lifecycle of ['Planned', 'Open', 'Closed'] as const) {
    const items = await listed(app, lifecycle);
    lists[lifecycle] = items;
    for (const { tradeId } of items) details.push(await detailOf(app, tradeId));
  }
  const review = { ...(await reviewAt(app, FRIDAY_1700)), binding: undefined };
  return { lists, details, review, debts: await outstandingDebts(app) };
}

describe('I7.13 Rebuild equivalence', () => {
  it('should give equal lists, Details with payoff views and Review after rebuildPrivateState, with byLifecycleTerminal, byLifecycleActivity and journalObligations rebuilt identical', async () => {
    const d = await device(undefined, FRIDAY_1700);
    let app = await onboarded(d);
    const reason = await closeReasonId(app, 'Target Reached');

    // I7.3: O-C closed by the sale X1 and the Expiration E1.
    const oc = (await confirmOption(app, 'O-C')).receipt.tradeId;
    await recordOption(app, oc, 'Buy', OC_PC1);
    await recordOption(app, oc, 'Buy', OC_PC2);
    await recordOption(app, oc, 'Sell', OC_X1);
    await recordExpiration(app, oc, '1', FRIDAY_1600, { closeReview: await closeReviewDisposition(app, 'Complete') });

    // I7.4: O-S closed by B1 and B2 (A), by an earlier-dated buyback (B), and by Expiration (C).
    const a = (await confirmOption(app, 'O-S')).receipt.tradeId;
    await recordOption(app, a, 'Sell', OS_S1);
    await recordOption(app, a, 'Buy', OS_B1);
    await recordOption(app, a, 'Buy', B2, { closeReasonId: reason, closeReview: await closeReviewDisposition(app, 'Complete') });
    const b = (await confirmOption(app, 'O-S')).receipt.tradeId;
    await recordOption(app, b, 'Sell', OS_S1);
    await recordOption(app, b, 'Buy', OS_B1);
    await recordOption(app, b, 'Buy', B0, { closeReasonId: reason, closeReview: await closeReviewDisposition(app, 'Defer') });
    const c = (await confirmOption(app, 'O-S')).receipt.tradeId;
    await recordOption(app, c, 'Sell', OS_S1);
    await recordExpiration(app, c, '2', FRIDAY_1600, { closeReview: await closeReviewDisposition(app, 'Defer') });

    // I7.7: the Settlement Review fixture, XYZ's Mark, E1 for T-1 with its Close Review deferred, and the Actions.
    const { t1, t2, t3, t4, t5 } = await settlementTrades(app, true);
    await saveMark(app, 'XYZ', FRIDAY_DATE, '52.00');
    await recordExpiration(app, t1, '1', FRIDAY_1600, { closeReview: await closeReviewDisposition(app, 'Defer') });
    for (const tradeId of [t2, t3, t4, t5]) await saveAction(app, d, tradeId);

    const databaseName = await currentDatabase(d.factory);
    const indexes = async () => ({
      byLifecycleTerminal: await readIndex(d.factory, databaseName, 'trades', 'byLifecycleTerminal'),
      byLifecycleActivity: await readIndex(d.factory, databaseName, 'trades', 'byLifecycleActivity'),
      journalObligations: workspaceStores(await dumpAll(d.factory))['journalObligations'],
    });
    const before = await views(app);
    const indexesBefore = await indexes();
    // The Workspace holds Open and Closed option and stock Trades, a Settlement Due item, and enough private state to compare.
    expect((before.lists['Open'] as unknown[]).length).toBe(4);
    expect((before.lists['Closed'] as unknown[]).length).toBe(5);
    expect(indexesBefore.byLifecycleTerminal).toHaveLength(5);
    expect((indexesBefore.journalObligations as unknown[]).length).toBeGreaterThan(5);
    expect(before.review.kind).toBe('Ready');
    expect(before.details.filter((view) => (view as { payoff?: { current: { kind: string } } }).payoff?.current.kind === 'Value')).not.toHaveLength(0);

    app.persistence.close();
    // Damage the private state first: drop every Trade's private sort keys (emptying both indexes) and clear the obligation
    // store, so a rebuild that does nothing cannot pass.
    await damagePrivateState(d.factory, databaseName);
    expect(await indexes()).toEqual({ byLifecycleTerminal: [], byLifecycleActivity: [], journalObligations: [] });
    await rebuildPrivateState(d.factory, databaseName);
    app = await restart(app, d);

    expect(await views(app)).toEqual(before);
    expect(await indexes()).toEqual(indexesBefore);
  }, 120_000);
});
