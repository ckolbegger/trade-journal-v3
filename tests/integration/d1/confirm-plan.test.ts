import { describe, expect, it, vi } from 'vitest';
import { IDBDatabase as FakeIDBDatabase } from 'fake-indexeddb';
import { Rational } from '../../../src/domain/values/index.ts';
import { contentRevision, device, dumpAll, onboarded, planCommand, readIndex, restart, workspaceStores } from './support.ts';

describe('I1.3 confirm a Plan', () => {
  it('should return the Trade, derivation, and Entry equal to the Detail read after restart, with one durable Trade, Planned index entry, and Entry in one commit', async () => {
    const d = await device();
    const { app } = await onboarded(d);
    const before = contentRevision(await dumpAll(d.factory));
    const result = await app.TradeWorkflows.confirmPlan(await planCommand(app));
    if (result.kind !== 'Confirmed') throw new Error(`confirmPlan: ${result.kind}`);
    const { receipt, postCommit } = result;
    expect(postCommit.derivation.baseline.oneR.equals(Rational.of(250n))).toBe(true);

    const again = await restart(app, d);
    const detail = await again.TradeViewsAndReporting.getTradeDetail({ tradeId: receipt.tradeId });
    if (detail.kind !== 'Ready') throw new Error(`detail: ${detail.kind}`);
    // A Planned Trade's Detail keeps D1's form (D2 T2.7).
    if ('positionChanges' in detail.view) throw new Error('expected the Planned form of Detail');
    const view = detail.view;
    expect(view.tradeId).toBe(postCommit.trade.tradeId);
    expect(view.factRevision).toBe(postCommit.trade.factRevision);
    expect(view.plan).toEqual({
      underlying: postCommit.trade.plan.underlying,
      planTime: postCommit.trade.plan.economicTime,
      thesis: postCommit.trade.plan.thesis,
      invalidation: postCommit.trade.plan.invalidation,
      legs: postCommit.trade.plan.legs,
      stops: postCommit.trade.plan.stops,
      targets: postCommit.trade.plan.targets,
    });
    expect(view.lifecycle).toEqual({ stored: postCommit.trade.storedLifecycle, agreement: postCommit.derivation.agreement });
    expect(view.baseline).toEqual(postCommit.derivation.baseline);
    expect(view.journal.map((e) => [e.id, e.anchor, e.momentTime, e.authoredTime])).toEqual([
      [postCommit.entry.id, postCommit.entry.anchor, postCommit.entry.momentTime, postCommit.entry.authoredTime],
    ]);
    expect(view.journal[0]!.responses).toHaveLength(postCommit.entry.responses.length);

    const browse = await again.TradeViewsAndReporting.browseTrades({ lifecycle: 'Planned' });
    expect(browse.kind === 'Ready' && browse.view.items.map((i) => i.tradeId)).toEqual([receipt.tradeId]);

    const dump = await dumpAll(d.factory);
    const stores = workspaceStores(dump);
    const trades = stores['trades'] as { tradeId: string; facts: { factId: string; versions: unknown[] }[] }[];
    expect(trades).toHaveLength(1);
    expect(trades[0]!.facts.map((f) => f.factId).sort()).toEqual([...receipt.createdFactIds].sort());
    expect(trades[0]!.facts.every((f) => f.versions.length === 1)).toBe(true);
    const databaseName = Object.keys(dump).find((n) => n.startsWith('tj-ws-'))!;
    expect((await readIndex(d.factory, databaseName, 'trades', 'byLifecycle')).map((t) => (t as { tradeId: string }).tradeId)).toEqual([receipt.tradeId]);
    const entries = stores['journalEntries'] as { id: string; versions: { definitionId: string }[] }[];
    const definitions = stores['journalDefinitions'] as { id: string; revisionNumber: number }[];
    expect(entries.map((e) => e.id)).toEqual([receipt.entryId]);
    expect(definitions.find((def) => def.id === entries[0]!.versions[0]!.definitionId)?.revisionNumber).toBe(1);
    expect(contentRevision(dump)).toBe(before + 1);
  });
});

describe('I1.5 atomic commit', () => {
  it('should change no store when the last write of a set spanning trades, journalEntries, and meta fails with a real ConstraintError', async () => {
    const d = await device();
    const { app } = await onboarded(d);
    const before = await dumpAll(d.factory);
    const result = await app.persistence.commit({
      checks: [],
      writes: [
        { op: 'add', store: 'trades', value: { tradeId: 'trade-atomic', lifecycle: 'Planned', planTime: '2026-10-12T13:30:00Z' } },
        { op: 'add', store: 'journalEntries', value: { id: 'entry-atomic', obligationKey: 'plan:trade-atomic', anchorTradeId: 'trade-atomic' } },
        // The schema record already exists, so this add fails with ConstraintError.
        { op: 'add', store: 'meta', value: { key: 'schema', schemaVersion: 1 } },
      ],
    });
    expect(result).toEqual({ kind: 'ConstraintViolation', store: 'meta' });
    expect(await dumpAll(d.factory)).toEqual(before);
  });

  it('should commit confirmPlan\'s trades, journalEntries, and meta writes in one readwrite transaction', async () => {
    const d = await device();
    const { app } = await onboarded(d);
    const command = await planCommand(app);
    const transactions = vi.spyOn(FakeIDBDatabase.prototype, 'transaction');
    const result = await app.TradeWorkflows.confirmPlan(command);
    expect(result.kind).toBe('Confirmed');
    const workspaceWrites = transactions.mock.calls.filter(
      ([, mode], i) => mode === 'readwrite' && (transactions.mock.contexts[i] as IDBDatabase).name.startsWith('tj-ws-'),
    );
    transactions.mockRestore();
    expect(workspaceWrites).toHaveLength(1);
    expect([...(workspaceWrites[0]![0] as string[])].sort()).toEqual(expect.arrayContaining(['journalEntries', 'meta', 'trades']));
  });
});
