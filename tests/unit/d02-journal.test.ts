import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { Journal } from '../../src/domain/journal';
import { positionChangeDefinition } from '../../src/domain/journal/position-change-types';
import { Store, Runtime, addedRecords, type Root } from '../../src/infrastructure/storage';
const answers = { 'decision-mode': 'as-planned', emotion: 'calm', confidence: '4' };
describe('Position Change reflection outcomes', () => {
  it('validates all required responses and stable options', () => {
    const journal = new Journal(new Store(crypto.randomUUID()));
    for (const invalid of [{ ...answers, 'decision-mode': '' }, { ...answers, emotion: 'unknown' }, { ...answers, confidence: '6' }, { ...answers, confidence: '' }]) {
      expect(journal.prepareEffects({ kind: 'PositionChange', definition: positionChangeDefinition, disposition: { kind: 'Complete', answers: invalid } }).status).toBe('Rejected');
    }
    expect(journal.prepareEffects({ kind: 'PositionChange', definition: positionChangeDefinition, disposition: { kind: 'Complete', answers } }).status).toBe('Prepared');
  });
});

const root: Root = { key: 'active', generation: 'g', revision: 'r', schema: 2, timeZone: 'America/New_York', catalogRevision: 'c', definitionRevision: 'plan-reflection-v1', commitOrdinal: 1, recordedSequence: 0, recordCounts: { versions: 0, lifecycle: 0 } };
const trigger = { tradeId: 't', positionChangeId: 'pc', economicTime: '2026-10-21T12:00:00Z', saveTime: '2026-10-21T13:00:00Z', sequence: 1 };
it('prepares Defer inertly then commits one original-snapshot Debt without Entry', async () => {
  const store = new Store(crypto.randomUUID()); const journal = new Journal(store);
  const prepared = journal.prepareEffects({ kind: 'PositionChange', definition: positionChangeDefinition, disposition: { kind: 'Defer' } });
  expect(JSON.stringify(prepared)).not.toContain('debtId');
  if (prepared.status !== 'Prepared') throw new Error('Preparation failed');
  const result = await store.transaction('rw', store.versions, () => journal.applyPreparedEffects(prepared, trigger, root));
  expect(result.obligation).toMatchObject({ status: 'Outstanding', dueTime: trigger.economicTime, definition: positionChangeDefinition });
  expect(result.entry).toBeUndefined(); expect(result.addedRecords).toBe(1);
});
it('records Decline distinctly from optional unanswered Note and Debt', async () => {
  const store = new Store(crypto.randomUUID()); const journal = new Journal(store);
  for (const disposition of [{ kind: 'Decline' as const, reason: 'No reflection' }, { kind: 'Complete' as const, answers }]) {
    const prepared = journal.prepareEffects({ kind: 'PositionChange', definition: positionChangeDefinition, disposition });
    if (prepared.status !== 'Prepared') throw new Error('Preparation failed');
    const result = await store.transaction('rw', store.versions, () => journal.applyPreparedEffects(prepared, { ...trigger, positionChangeId: disposition.kind }, root));
    expect(result.obligation.status).toBe(disposition.kind === 'Decline' ? 'Declined' : 'Completed');
    expect(result.obligation.debtId).toBeUndefined();
    if (disposition.kind === 'Complete') expect(result.entry?.responses.note).toEqual({ kind: 'Unanswered' });
    else { expect(result.decline?.reason).toBe('No reflection'); expect(result.entry).toBeUndefined(); }
    expect(result.addedRecords).toBe(2);
  }
});

async function debtFixture() {
  const store = new Store(crypto.randomUUID());
  const runtime = new Runtime(store, { check: () => Promise.resolve({ transaction: true, capacity: true, control: true, inventory: true, protection: 'BestEffort' }), requestDurability: () => Promise.resolve('BestEffort') });
  const journal = new Journal(store, runtime);
  await store.roots.add(root);
  const prepared = journal.prepareEffects({ kind: 'PositionChange', definition: positionChangeDefinition, disposition: { kind: 'Defer' } });
  if (prepared.status !== 'Prepared') throw new Error('Preparation failed');
  const result = await store.transaction('rw', store.versions, store.roots, async () => {
    const applied = await journal.applyPreparedEffects(prepared, trigger, root);
    await store.roots.put({ ...root, commitOrdinal: 2, recordCounts: addedRecords(root, applied.addedRecords) });
    return applied;
  });
  return { store, journal, obligation: result.obligation };
}
it('settles original-form Debt atomically with Entry or explicit decline and returns projections', async () => {
  for (const disposition of [{ kind: 'Complete' as const, answers }, { kind: 'Decline' as const }]) {
    const { journal, obligation } = await debtFixture();
    const result = await journal.save({ kind: 'ResolveDebt', generation: 'g', expectedWorkspaceRevision: 'r', obligationId: obligation.id, expectedRevision: obligation.revision, disposition });
    expect(result.status).toBe('Saved');
    if (result.status !== 'Saved') throw new Error('Save failed');
    expect(result.obligation.debtId).toBe(obligation.debtId);
    expect(result.obligation.definition).toEqual(obligation.definition);
    const query = await journal.query({ scope: 'History' });
    expect(query.obligationHistory).toHaveLength(2); expect(query.obligations[0]?.status).toBe(disposition.kind === 'Complete' ? 'Completed' : 'Declined');
    expect(query.entries).toHaveLength(disposition.kind === 'Complete' ? 1 : 0);
    expect(query.declines).toHaveLength(disposition.kind === 'Decline' ? 1 : 0);
  }
});
it('rejects stale and competing completions without duplicating outcomes', async () => {
  const { journal, obligation } = await debtFixture();
  const command = { kind: 'ResolveDebt' as const, generation: 'g', expectedWorkspaceRevision: 'r', obligationId: obligation.id, expectedRevision: obligation.revision, disposition: { kind: 'Complete' as const, answers } };
  expect((await journal.save({ ...command, expectedRevision: 'stale' })).status).toBe('Conflict');
  const results = await Promise.all([journal.save(command), journal.save(command)]);
  expect(results.map(result => result.status).sort()).toEqual(['Conflict', 'Saved']);
  const query = await journal.query({}); expect(query.entries).toHaveLength(1); expect(query.obligationHistory).toHaveLength(2);
});
it('returns the exact stored TradeWorkflow route for workflow-only Debt', async () => {
  const { store, journal, obligation } = await debtFixture();
  // Explicit future-compatible infrastructure fixture, never produced by D2 UI.
  const route = { kind: 'TradeWorkflow' as const, tradeId: 'original-trade', operation: 'ManagementRevision' };
  await store.versions.where('[generation+id]').equals(['g', obligation.id]).modify(row => { row.value = { ...obligation, route }; });
  const result = await journal.save({ kind: 'ResolveDebt', generation: 'g', expectedWorkspaceRevision: 'r', obligationId: obligation.id, expectedRevision: obligation.revision, disposition: { kind: 'Complete', answers } });
  expect(result).toEqual({ status: 'NeedsTradeWorkflow', route });
  const query = await journal.query({ scope: 'Outstanding' }); expect(query.obligations).toHaveLength(1); expect(query.entries).toHaveLength(0);
});
it('keeps trigger-time wording, source, origin and owed prompt identities after settlement', async () => {
  const { store, journal, obligation } = await debtFixture();
  const definition = structuredClone(obligation.definition);
  definition.label = 'Original trigger form';
  definition.prompts[0].wording = 'Original decision wording';
  await store.versions.where('[generation+id]').equals(['g', obligation.id]).modify(row => { row.value = { ...obligation, definition }; });
  const result = await journal.save({ kind: 'ResolveDebt', generation: 'g', expectedWorkspaceRevision: 'r', obligationId: obligation.id, expectedRevision: obligation.revision, disposition: { kind: 'Complete', answers } });
  expect(result.status).toBe('Saved');
  if (result.status !== 'Saved') throw new Error('Save failed');
  expect(result.entry?.definition).toEqual(definition);
  expect(result.entry?.source).toEqual({ id: 'position-change', label: 'Position Change' });
  expect(result.entry?.origin).toEqual({ kind: 'PositionChange', factId: 'pc' });
  expect(result.entry?.momentTime).toBe(trigger.economicTime);
  expect(result.entry?.settledDebtId).toBe(obligation.debtId);
});
it('rejects invalid answers and stale Workspace/generation without changing Debt', async () => {
  const { journal, obligation } = await debtFixture();
  const command = { kind: 'ResolveDebt' as const, generation: 'g', expectedWorkspaceRevision: 'r', obligationId: obligation.id, expectedRevision: obligation.revision, disposition: { kind: 'Complete' as const, answers } };
  expect((await journal.save({ ...command, generation: 'old' })).status).toBe('Conflict');
  expect((await journal.save({ ...command, expectedWorkspaceRevision: 'old' })).status).toBe('Conflict');
  expect((await journal.save({ ...command, disposition: { kind: 'Complete', answers: { ...answers, confidence: '0' } } })).status).toBe('Rejected');
  const query = await journal.query({}); expect(query.obligationHistory).toEqual([obligation]); expect(query.entries).toEqual([]);
});
it('returns all readiness failures and leaves outstanding Debt unchanged', async () => {
  const { store, obligation } = await debtFixture();
  const runtime = new Runtime(store, { check: () => Promise.resolve({ transaction: false, capacity: false, control: false, inventory: false, protection: 'BestEffort' }), requestDurability: () => Promise.resolve('BestEffort') });
  const journal = new Journal(store, runtime);
  const result = await journal.save({ kind: 'ResolveDebt', generation: 'g', expectedWorkspaceRevision: 'r', obligationId: obligation.id, expectedRevision: obligation.revision, disposition: { kind: 'Complete', answers } });
  expect(result).toMatchObject({ status: 'RuntimeNotWritable', failedChecks: ['transaction', 'capacity', 'control', 'inventory'] });
  expect((await journal.query({})).obligationHistory).toEqual([obligation]);
});
it('rolls back Entry and settlement when durable writes abort', async () => {
  const { store, journal, obligation } = await debtFixture();
  const fail = (_key: unknown, row: { kind: string }) => { if (row.kind === 'JournalObligation') throw new Error('Injected storage abort'); };
  store.versions.hook('creating', fail);
  const result = await journal.save({ kind: 'ResolveDebt', generation: 'g', expectedWorkspaceRevision: 'r', obligationId: obligation.id, expectedRevision: obligation.revision, disposition: { kind: 'Complete', answers } });
  store.versions.hook('creating').unsubscribe(fail);
  expect(result.status).toBe('StorageFailure');
  const query = await journal.query({}); expect(query.obligationHistory).toEqual([obligation]); expect(query.entries).toEqual([]); expect(query.workspaceRevision).toBe('r');
});
