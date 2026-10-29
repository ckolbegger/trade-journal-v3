// I4.16: Action retry and edit (AC-JOUR-005 partial).
import { describe, expect, it } from 'vitest';
import { bindingFor, dumpAll, device, fourTrades, MONDAY, MONDAY_1700, onboarded, restart, workspaceStores } from './support.ts';

interface StoredEntry {
  readonly id: string;
  readonly entryTypeKey: string;
  readonly obligationKey?: unknown;
  readonly versions: { readonly versionNumber: number; readonly definitionId: string }[];
}

describe('I4.16 Action retry and edit', () => {
  it('should append an edit version to the one Entry sharing its definition snapshot, and return Conflict for a save with the old revision', async () => {
    const d = await device(undefined, MONDAY_1700);
    const app = await onboarded(d);
    const { a } = await fourTrades(app);

    const fresh = await bindingFor(app, d, a);
    expect(fresh.form.form).toEqual({ kind: 'New', viewState: { selectedAction: 'Hold' } });
    const hold = await app.DailyReview.save({ kind: 'SaveTradeAction', binding: fresh.binding, action: 'Hold' });
    if (hold.kind !== 'Saved') throw new Error(`hold: ${hold.kind}`);
    expect(hold.action).toMatchObject({ action: 'Hold', entryRevision: 1 });

    // The form rendered again names the returned Entry revision; the edit appends a version.
    const edit = await bindingFor(app, d, a);
    expect(edit.binding.expectedEntryRevision).toBe(hold.action.entryRevision);
    const exit = await app.DailyReview.save({ kind: 'SaveTradeAction', binding: edit.binding, action: 'Exit', intent: 'Taking the loss.' });
    if (exit.kind !== 'Saved') throw new Error(`exit: ${exit.kind}`);
    expect(exit.action).toMatchObject({ id: hold.action.id, action: 'Exit', entryRevision: 2, edited: true });

    // A save with the old revision conflicts and writes nothing.
    const before = await dumpAll(d.factory);
    expect(await app.DailyReview.save({ kind: 'SaveTradeAction', binding: edit.binding, action: 'Hold' })).toEqual({ kind: 'Conflict' });
    expect(await app.DailyReview.save({ kind: 'SaveTradeAction', binding: fresh.binding, action: 'Hold' })).toEqual({ kind: 'Conflict' });
    expect(await dumpAll(d.factory)).toEqual(before);

    // One Entry identity under its obligation key, with two versions sharing the original definition; the same after restart.
    const again = await restart(app, d);
    const entries = (workspaceStores(await dumpAll(d.factory))['journalEntries'] as StoredEntry[]).filter((e) => e.entryTypeKey === 'entry-type.daily-trade-review');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: hold.action.id, obligationKey: ['DailyTradeReview', MONDAY, a] });
    expect(entries[0]!.versions.map((v) => v.versionNumber)).toEqual([1, 2]);
    expect(entries[0]!.versions[1]!.definitionId).toBe(entries[0]!.versions[0]!.definitionId);
    expect((await bindingFor(again, d, a)).form.form).toMatchObject({ kind: 'Saved', action: { id: hold.action.id, entryRevision: 2 } });
  }, 30_000);
});
