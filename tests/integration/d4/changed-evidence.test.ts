// I4.15: changed evidence between getTrade and save (AC-REV-005 partial).
import { describe, expect, it } from 'vitest';
import { bindingFor, detail, device, dumpAll, fourTrades, MONDAY, MONDAY_1700, onboarded, openReview, PC3, record, saveMark, workspaceStores } from './support.ts';

describe('I4.15 changed evidence', () => {
  it('should return ReviewChanged with refreshed evidence for a corrected Mark, an acknowledgment and its withdrawal, and a Trade fact, and Conflict for another Action, writing nothing', async () => {
    const d = await device(undefined, MONDAY_1700);
    const app = await onboarded(d);
    const { a } = await fourTrades(app);
    await saveMark(app, 'XYZ', MONDAY, '52.00');
    const save = (binding: Awaited<ReturnType<typeof bindingFor>>['binding']) => app.DailyReview.save({ kind: 'SaveTradeAction', binding, action: 'Hold' });
    const snapshot = async () => await dumpAll(d.factory);

    // (a) correct XYZ after the form was rendered.
    const a1 = await bindingFor(app, d, a);
    const corrected = await app.MarketData.save({ intention: 'CorrectMark', instrumentKey: 'XYZ', tradingDate: MONDAY, price: '51.50', reason: 'Mistyped.', expectedResolutionRevision: a1.opened.families[0]!.family === 'Marks' ? a1.opened.families[0]!.today.find((r) => r.instrumentKey === 'XYZ')!.resolutionRevision : 'None' });
    expect(corrected.kind).toBe('Saved');
    let dump = await snapshot();
    const changedA = await save(a1.binding);
    expect(changedA.kind).toBe('ReviewChanged');
    if (changedA.kind !== 'ReviewChanged') throw new Error('unreachable');
    expect(changedA.evidence.marketDataSnapshotId).not.toBe(a1.binding.marketDataSnapshotId);
    const xyz = changedA.evidence.frames.find((f) => f.instrumentKey === 'XYZ');
    expect(xyz?.resolution.kind === 'Available' && xyz.resolution.mark.price).toBe('51.5');
    expect(changedA.evidence.factRevision).toBe(a1.binding.factRevision);
    expect(await snapshot()).toEqual(dump);

    // (b) acknowledge DEF's Mark as unavailable after the form was rendered, then withdraw it likewise.
    const b1 = await bindingFor(app, d, a);
    const acknowledged = await app.MarketData.save({ intention: 'AssertUnavailable', instrumentKey: 'DEF', tradingDate: MONDAY, reason: 'No quote.', expectedResolutionRevision: 'None' });
    if (acknowledged.kind !== 'Saved') throw new Error('acknowledge');
    dump = await snapshot();
    const changedB = await save(b1.binding);
    expect(changedB.kind).toBe('ReviewChanged');
    expect(changedB.kind === 'ReviewChanged' && changedB.evidence.frames.find((f) => f.instrumentKey === 'DEF')?.resolution.kind).toBe('AcknowledgedUnavailable');
    expect(await snapshot()).toEqual(dump);

    const b2 = await bindingFor(app, d, a);
    const row = b2.opened.families[0]!.family === 'Marks' ? b2.opened.families[0]!.today.find((r) => r.instrumentKey === 'DEF') : undefined;
    const withdrawn = await app.MarketData.save({ intention: 'WithdrawAcknowledgment', instrumentKey: 'DEF', tradingDate: MONDAY, expectedResolutionRevision: row!.resolutionRevision });
    expect(withdrawn.kind).toBe('Saved');
    dump = await snapshot();
    const changedW = await save(b2.binding);
    expect(changedW.kind).toBe('ReviewChanged');
    expect(changedW.kind === 'ReviewChanged' && changedW.evidence.frames.find((f) => f.instrumentKey === 'DEF')?.resolution.kind).toBe('Missing');
    expect(await snapshot()).toEqual(dump);

    // (c) record PC3 for T-A after the form was rendered.
    const c1 = await bindingFor(app, d, a);
    await record(app, a, PC3);
    dump = await snapshot();
    const changedC = await save(c1.binding);
    expect(changedC.kind).toBe('ReviewChanged');
    expect(changedC.kind === 'ReviewChanged' && changedC.evidence.factRevision).toBe((await detail(app, a)).factRevision);
    expect(changedC.kind === 'ReviewChanged' && changedC.evidence.factRevision).not.toBe(c1.binding.factRevision);
    expect(await snapshot()).toEqual(dump);

    // (d) another Action for T-A is saved from a second binding; the first binding then conflicts.
    const d1 = await bindingFor(app, d, a);
    const d2 = await bindingFor(app, d, a);
    expect((await save(d2.binding)).kind).toBe('Saved');
    dump = await snapshot();
    expect(await save(d1.binding)).toEqual({ kind: 'Conflict' });
    expect(await snapshot()).toEqual(dump);
    const actions = (workspaceStores(dump)['journalEntries'] as { entryTypeKey: string }[]).filter((e) => e.entryTypeKey === 'entry-type.daily-trade-review');
    expect(actions).toHaveLength(1);
    expect((await openReview(app, d)).completion.kind).toBe('Incomplete');
  }, 60_000);
});
