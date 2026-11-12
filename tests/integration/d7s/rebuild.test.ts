// I7S.10: rebuilding private state gives equal lists, Detail and Review, and identical private indexes, in the
// Workspace I7S.4's Thursday leaves behind: O-S2 Open with S-o Breached and T-u Reached (AC-REBUILD-001).
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { rebuildPrivateState } from '../../../src/persistence/index.ts';
import { currentDatabase, detailOf, dumpAll, listed, onboardedAt, openOs2, readIndex, restart, reviewAt, saveSession, THURSDAY, THURSDAY_1700_NY, TUESDAY, TUESDAY_1700_NY, WEDNESDAY, WEDNESDAY_1700_NY, workspaceStores } from './support.ts';

// Raw damage with no application open: removes the private sort keys and exposureStart from every Trade and clears
// journalObligations, so a rebuild that does nothing cannot pass (as D7's I7.13 does).
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
      delete trade['exposureStart'];
      at.update(trade);
      at.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('damage failed'));
  });
  db.close();
}

// The three lists, every listed Trade's Detail and the Thursday Review without its binding.
async function views(app: Application) {
  const lists: Record<string, unknown> = {};
  const details: unknown[] = [];
  for (const lifecycle of ['Planned', 'Open', 'Closed'] as const) {
    const items = await listed(app, lifecycle);
    lists[lifecycle] = items;
    for (const { tradeId } of items) details.push(await detailOf(app, tradeId));
  }
  return { lists, details, review: { ...(await reviewAt(app, THURSDAY_1700_NY)), binding: undefined } };
}

describe('I7S.10 Rebuild equivalence', () => {
  it('should give equal lists, Detail and Review after rebuildPrivateState on I7S.4s Thursday Workspace, with the private indexes identical', async () => {
    const { d, app: first } = await onboardedAt(TUESDAY_1700_NY);
    let app = first;
    const tradeId = await openOs2(app);
    await saveSession(app, TUESDAY, { mno: '44.00', put: '1.80' });
    app = await restart(app, { ...d, now: WEDNESDAY_1700_NY });
    await saveSession(app, WEDNESDAY, { mno: '43.20', put: '3.70' });
    app = await restart(app, { ...d, now: THURSDAY_1700_NY });
    await saveSession(app, THURSDAY, { mno: '44.60', put: '3.65' });

    const databaseName = await currentDatabase(d.factory);
    const indexes = async () => {
      const stores = workspaceStores(await dumpAll(d.factory));
      return {
        byLifecycleTerminal: await readIndex(d.factory, databaseName, 'trades', 'byLifecycleTerminal'),
        byLifecycleActivity: await readIndex(d.factory, databaseName, 'trades', 'byLifecycleActivity'),
        journalObligations: stores['journalObligations'],
        trades: stores['trades'],
      };
    };
    const before = await views(app);
    const indexesBefore = await indexes();
    // The Workspace holds the Open O-S2 with its crossed Stop and reached Target, and private state to compare.
    const current = (await detailOf(app, tradeId) as unknown as { current: { evaluation: { conditions: { result: { value: { status: string } } }[] } } }).current.evaluation;
    expect(current.conditions.map((c) => c.result.value.status)).toEqual(['Active', 'Breached', 'Reached', 'Active']);
    expect((before.lists['Open'] as unknown[]).length).toBe(1);
    expect(indexesBefore.byLifecycleActivity).toHaveLength(1);
    expect((indexesBefore.journalObligations as unknown[]).length).toBeGreaterThan(0);
    expect(before.review.kind).toBe('Ready');

    app.persistence.close();
    await damagePrivateState(d.factory, databaseName);
    const damaged = await indexes();
    expect(damaged).toEqual(expect.objectContaining({ byLifecycleActivity: [], journalObligations: [] }));
    await rebuildPrivateState(d.factory, databaseName);
    app = await restart(app, { ...d, now: THURSDAY_1700_NY });

    expect(await views(app)).toEqual(before);
    expect(await indexes()).toEqual(indexesBefore);
  }, 120_000);
});
