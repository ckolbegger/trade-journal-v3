// I2.10: the write gate refuses recordPositionChange at the facade and at Persistence.commit while
// the inventory check fails, and the Open list and Detail stay readable (AC-DEL-004, AC-DEL-006).
import { describe, expect, it } from 'vitest';
import { buy, complete, confirmReference, device, dumpAll, onboarded, PC1, PC2, positionChange, record, restart } from './support.ts';

describe('I2.10 write gate', () => {
  it('should return RuntimeNotWritable from recordPositionChange and from a direct Persistence.commit with every store unchanged, and keep the Open list and Detail readable', async () => {
    const d = await device();
    const app = await onboarded(d);
    const tradeId = await confirmReference(app);
    await record(app, tradeId, PC1, await complete(app));
    const command = await positionChange(app, tradeId, [await buy(app, tradeId, PC2)], await complete(app));
    d.testHost.fail(['inventory']);
    const recovery = await restart(app, d);
    const before = await dumpAll(d.factory);

    const notWritable = expect.objectContaining({
      kind: 'RuntimeNotWritable',
      failedChecks: expect.arrayContaining([expect.objectContaining({ check: 'inventory' })]) as unknown,
    }) as unknown;
    expect(await recovery.TradeWorkflows.recordPositionChange(command)).toEqual(notWritable);
    expect(await recovery.persistence.commit({ checks: [], writes: [{ op: 'put', store: 'trades', value: { tradeId: 'direct' } }] })).toEqual(
      notWritable,
    );
    expect(await dumpAll(d.factory)).toEqual(before);

    expect((await recovery.Workspace.getStatus()).kind).toBe('RecoveryOnly');
    const open = await recovery.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
    expect(open.kind === 'Ready' && open.view.items.map((i) => i.tradeId)).toEqual([tradeId]);
    const detail = await recovery.TradeViewsAndReporting.getTradeDetail({ tradeId });
    expect(detail.kind === 'Ready' && 'positionChanges' in detail.view && detail.view.positionChanges).toHaveLength(1);
  });
});
