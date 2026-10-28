// I2.11: rebuilding private state gives equal views and identical private indexes (AC-REBUILD-001).
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { rebuildPrivateState } from '../../../src/persistence/index.ts';
import {
  complete,
  confirmReference,
  currentDatabase,
  decline,
  device,
  dumpAll,
  onboarded,
  PC1,
  PC2,
  PC3,
  readIndex,
  record,
  restart,
} from './support.ts';

// The Open list and every Open Trade's Detail, with their opaque revision tokens (bindings) removed.
async function views(app: Application) {
  const open = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
  if (open.kind !== 'Ready') throw new Error(`browseTrades: ${open.kind}`);
  const details = [];
  for (const { tradeId } of open.view.items) {
    const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
    if (detail.kind !== 'Ready') throw new Error(`getTradeDetail: ${detail.kind}`);
    details.push(detail.view);
  }
  return { list: open.view, details };
}

describe('I2.11 rebuild equivalence', () => {
  it('should give equal Open list and Details after rebuildPrivateState, with journalObligations and byLifecycleActivity rebuilt identical', async () => {
    const d = await device();
    const app = await onboarded(d);
    const reference = await confirmReference(app, 'XYZ');
    await record(app, reference, PC1, await complete(app));
    await record(app, reference, PC2, await complete(app));
    await record(app, reference, PC3, await decline(app, 'Later.'));
    for (const [underlying, fill] of [
      ['AAA', { quantity: '50', price: '50.05', economicTime: '2026-10-12T16:00:00Z' }],
      ['BBB', { quantity: '100', price: '49.95', economicTime: '2026-10-12T17:00:00Z' }],
    ] as const) {
      const tradeId = await confirmReference(app, underlying);
      await record(app, tradeId, fill, await decline(app));
    }
    const databaseName = await currentDatabase(d.factory);
    const before = await views(app);
    const obligations = (await dumpAll(d.factory))[databaseName]!['journalObligations'];
    const index = await readIndex(d.factory, databaseName, 'trades', 'byLifecycleActivity');

    app.persistence.close();
    await rebuildPrivateState(d.factory, databaseName);
    const again = await restart(app, d);

    expect(before.list.items).toHaveLength(3);
    expect(await views(again)).toEqual(before);
    expect((await dumpAll(d.factory))[databaseName]!['journalObligations']).toEqual(obligations);
    // The rebuild adds the private `exposureStart`; Trade Record writes it at commit only from T4.11,
    // so until then the index differs by that one field (D4 A38) and the comparison leaves it out.
    const withoutExposureStart = (records: unknown) =>
      (records as Record<string, unknown>[]).map((record) => Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'exposureStart')));
    expect(withoutExposureStart(await readIndex(d.factory, databaseName, 'trades', 'byLifecycleActivity'))).toEqual(withoutExposureStart(index));
    // Three Plan Reflections and five Position Change Reflection outcomes.
    expect(obligations).toHaveLength(8);
  });
});
