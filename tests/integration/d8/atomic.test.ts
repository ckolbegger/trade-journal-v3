// I8.9 Atomicity (AC-REST-003): a candidate that changed after preparation is never applied and is deleted; a good Restore
// switches everything at once, and a second application reads only the new Workspace.
import { describe, expect, it } from 'vitest';
import { artifactOf, CONFIRM, deleteRecord, dumpAll, launch, liveOf, pointerOf, prepared, receiptOf, wtDevice } from './support.ts';

describe('I8.9 Atomicity', () => {
  it('should return CandidateChanged for journalEntries and keep W-t and the pointer when a Journal Entry was removed from the candidate, delete the candidate, then restore on a new preparation with status and landing in the one result, read only through the new binding by a second application, the old database deleted', async () => {
    const { d, app } = await wtDevice();
    const receipt = await receiptOf(app, d);
    const first = await prepared(app, artifactOf('backup-v7'));
    const live = liveOf(await dumpAll(d.factory));

    // The candidate editor: one Journal Entry removed from the candidate between preparation and apply.
    const entries = (await dumpAll(d.factory))[first.token.candidateId]!['journalEntries'] as { id: string }[];
    await deleteRecord(d.factory, first.token.candidateId, 'journalEntries', entries[0]!.id);
    const before = await dumpAll(d.factory);

    const changed = await app.Workspace.applyPreparedRestore({ token: first.token, confirmation: CONFIRM, safety: { kind: 'Receipt', receipt } });

    expect(changed).toEqual({ kind: 'CandidateChanged', store: 'journalEntries', liveBinding: first.token.targetBinding });
    const after = await dumpAll(d.factory);
    expect(after[live]).toEqual(before[live]);
    expect(pointerOf(after).filter((record) => (record as { key: string }).key === 'current')).toEqual(pointerOf(before).filter((record) => (record as { key: string }).key === 'current'));
    // The candidate is gone: no database of it, and none listed.
    expect(Object.keys(after).sort()).toEqual(['tj-root', live].sort());
    expect(pointerOf(after)).toEqual(expect.arrayContaining([{ key: 'candidates', databaseNames: [] }]));

    // Prepare again and apply: the receipt still names W-t as it stands.
    const second = await prepared(app, artifactOf('backup-v7'));
    const restored = await app.Workspace.applyPreparedRestore({ token: second.token, confirmation: CONFIRM, safety: { kind: 'Receipt', receipt } });
    if (restored.kind !== 'Restored') throw new Error(`applyPreparedRestore: ${JSON.stringify(restored)}`);
    expect(restored.status.kind).toBe('Ready');
    expect(restored.landing).toEqual({ kind: 'RestoreComplete', next: 'Trades' });

    // A second application on the same factory reads only the new binding, and the old database is deleted.
    const other = await launch(d);
    const status = await other.Workspace.getStatus();
    expect(status.kind === 'Ready' && status.binding.databaseName).toBe(restored.receipt.newBinding.databaseName);
    const open = await other.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
    expect(open.kind === 'Ready' && open.view.items).toHaveLength(second.preview.counts.tradesByLifecycle.Open);
    const final = await dumpAll(d.factory);
    expect(Object.keys(final).sort()).toEqual(['tj-root', second.token.candidateId].sort());
    expect(liveOf(final)).toBe(second.token.candidateId);
    expect(final[live]).toBeUndefined();
  }, 120_000);
});
