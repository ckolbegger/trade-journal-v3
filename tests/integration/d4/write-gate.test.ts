// I4.9: the write gate refuses Mark and Review saves and a direct commit while the inventory check
// fails, and the Review, Open list and Detail stay readable (AC-DEL-004, AC-DEL-006).
import { describe, expect, it } from 'vitest';
import { detail, dumpAll, MONDAY, openItem, openReview, referenceTrade, restart, saveMark, value } from './support.ts';

describe('I4.9 write gate', () => {
  it('should return RuntimeNotWritable from MarketData.save, DailyReview.save and a direct Persistence.commit with every store unchanged, and keep the Review, Open list and Detail readable', async () => {
    const { d, app, tradeId } = await referenceTrade();
    await saveMark(app, 'XYZ', MONDAY, '52.00');
    // The Action form as the Review rendered it, before the host fails.
    const opened = await openReview(app, d);
    const form = await app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
    if (form.kind !== 'Ready') throw new Error(`getTrade: ${form.kind}`);

    d.testHost.fail(['inventory']);
    const recovery = await restart(app, d);
    const before = await dumpAll(d.factory);

    const notWritable = expect.objectContaining({
      kind: 'RuntimeNotWritable',
      failedChecks: expect.arrayContaining([expect.objectContaining({ check: 'inventory' })]) as unknown,
    }) as unknown;
    expect(
      await recovery.MarketData.save({ intention: 'RecordInitialManualMark', instrumentKey: 'ABC', tradingDate: MONDAY, price: '10.00', expectedResolutionRevision: 'None' }),
    ).toEqual(notWritable);
    expect(await recovery.DailyReview.save({ kind: 'SaveTradeAction', binding: form.trade.saveBinding, action: 'Hold' })).toEqual(notWritable);
    expect(await recovery.persistence.commit({ checks: [], writes: [{ op: 'put', store: 'observations', value: { tradingDate: MONDAY, instrumentKey: 'DIRECT' } }] })).toEqual(
      notWritable,
    );
    expect(await dumpAll(d.factory)).toEqual(before);

    expect((await recovery.Workspace.getStatus()).kind).toBe('RecoveryOnly');
    const review = await recovery.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: d.now });
    expect(review.kind).toBe('Ready');
    expect((await openItem(recovery, tradeId)).current.currentMarkedPnl).toEqual(value('180'));
    expect((await detail(recovery, tradeId)).current.evaluation).toEqual(expect.objectContaining({ currentMarkedPnl: value('180') }));
  });
});
