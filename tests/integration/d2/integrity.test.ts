// I2.8 (a) and (b): stored state that disagrees with coherent facts (AC-LIFE-003, P7). The
// integrity fixture writer edits raw stored records while no application is open; reads surface
// the findings without writing, and the next Position Change repairs and discloses them.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import {
  complete,
  confirmReference,
  contentRevision,
  currentDatabase,
  decline,
  device,
  dumpAll,
  launch,
  onboarded,
  PC1,
  PC2,
  PC3,
  rawUpdate,
  record,
  restart,
  type Device,
} from './support.ts';

// Closes the application, edits the Trade's stored document, and launches a new application.
async function edited(app: Application, d: Device, tradeId: string, edit: (trade: Record<string, unknown>) => Record<string, unknown>) {
  app.persistence.close();
  await rawUpdate(d.factory, await currentDatabase(d.factory), 'trades', tradeId, edit);
  return launch(d);
}

async function openDetail(app: Application, tradeId: string) {
  const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
  if (detail.kind !== 'Ready' || !('positionChanges' in detail.view)) throw new Error(`expected the Open form of Detail: ${detail.kind}`);
  return detail.view;
}

describe('I2.8 integrity disagreement (AC-LIFE-003)', () => {
  it('a: should read a stored Planned lifecycle with the finding and no write, then commit the next Position Change and list the lifecycle repair', async () => {
    const d = await device();
    let app = await onboarded(d);
    const tradeId = await confirmReference(app);
    await record(app, tradeId, PC1, await complete(app));
    // The index entry moves with the stored lifecycle, since byLifecycleActivity keys on it.
    app = await edited(app, d, tradeId, (trade) => ({ ...trade, lifecycle: 'Planned' }));
    const before = contentRevision(await dumpAll(d.factory));

    expect((await app.Workspace.getStatus()).kind).toBe('Ready');
    const view = await openDetail(app, tradeId);
    expect(view.findings).toEqual([{ kind: 'LifecycleDisagreement', stored: 'Planned', expected: 'Open' }]);
    expect(view.lifecycle).toEqual({ stored: 'Planned', agreement: { kind: 'LifecycleDisagreement', stored: 'Planned', expected: 'Open' } });
    const planned = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Planned' });
    expect(planned.kind === 'Ready' && planned.view.items.map((i) => i.tradeId)).toEqual([tradeId]);
    expect(contentRevision(await dumpAll(d.factory))).toBe(before);

    const repaired = await record(app, tradeId, PC2, await complete(app));
    expect(repaired.receipt.repairs).toEqual([{ kind: 'LifecycleDisagreement', stored: 'Planned', expected: 'Open' }]);
    const again = await restart(app, d);
    const after = await openDetail(again, tradeId);
    expect([after.lifecycle.stored, after.findings]).toEqual(['Open', []]);
    const open = await again.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
    expect(open.kind === 'Ready' && open.view.items.map((i) => [i.tradeId, i.integrity])).toEqual([[tradeId, 'Agrees']]);
  });

  it('b: should read a deleted Entry Size occurrence as missing with no write, then commit the next Position Change and list the occurrence repair', async () => {
    const d = await device();
    let app = await onboarded(d);
    const tradeId = await confirmReference(app);
    await record(app, tradeId, PC1, await complete(app));
    await record(app, tradeId, PC2, await complete(app));
    const third = await record(app, tradeId, PC3, await decline(app));
    const pc3 = third.postCommit.trade.positionChanges.at(-1)!.factId;
    app = await edited(app, d, tradeId, (trade) => ({ ...trade, deviations: [] }));
    const before = contentRevision(await dumpAll(d.factory));

    expect((await app.Workspace.getStatus()).kind).toBe('Ready');
    const view = await openDetail(app, tradeId);
    const missing = expect.objectContaining({
      kind: 'DeviationMissing',
      fingerprint: expect.objectContaining({ positionChangeId: pc3 }) as unknown,
    }) as unknown;
    expect(view.findings).toEqual([missing]);
    expect(view.deviations).toEqual([]);
    const open = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
    expect(open.kind === 'Ready' && open.view.items.map((i) => [i.tradeId, i.integrity])).toEqual([[tradeId, 'Disagrees']]);
    expect(contentRevision(await dumpAll(d.factory))).toBe(before);

    const repaired = await record(app, tradeId, { quantity: '10', price: '51.20', economicTime: '2026-10-12T19:00:00Z' }, await complete(app));
    expect(repaired.receipt.repairs).toEqual([missing]);
    const again = await restart(app, d);
    const after = await openDetail(again, tradeId);
    expect(after.findings).toEqual([]);
    expect(after.deviations.map((o) => [o.versions.at(-1)!.causingPositionChangeId, o.versions.at(-1)!.quantityAbovePlan])).toEqual(
      expect.arrayContaining([[pc3, '20']]),
    );
  });
});
