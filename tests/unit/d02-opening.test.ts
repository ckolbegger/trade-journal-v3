import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openingFixture } from '../d02-fixtures';
describe('atomic complete initial Stock entry', () => {
  it('commits the 40/60 opening and returns authoritative Open facts and reflection after commit', async () => {
    const f = await openingFixture();
    const result = await f.workflows.recordPositionChange(f.command);
    expect(result).toMatchObject({ status: 'Recorded', trade: { lifecycle: 'Open', opening: { executions: [{ quantity: '40' }, { quantity: '60' }] } }, derivation: { quantity: '100', grossBasis: '5020', openingFees: '3' }, journalOutcome: { obligation: { status: 'Completed' } } });
    f.store.close();
  });
});
it('reopens the complete committed opening with the same stable membership, versions and agreement', async () => {
  const f = await openingFixture();
  const result = await f.workflows.recordPositionChange(f.command);
  if (result.status !== 'Recorded') throw new Error(result.status);
  const { Store } = await import('../../src/infrastructure/storage');
  const { TradeRecord } = await import('../../src/domain/trade-record');
  const name = f.store.name; f.store.close(); const reopened = new Store(name);
  expect(await new TradeRecord(reopened).getRecord(result.trade.tradeId)).toEqual(result.trade);
  reopened.close();
});
it('allows exactly one competing initial save and returns a typed no-write conflict for the other', async () => {
  const f = await openingFixture();
  const results = await Promise.all([f.workflows.recordPositionChange(f.command), f.workflows.recordPositionChange(f.command)]);
  expect(results.map(result => result.status).sort()).toEqual(['Conflict', 'Recorded']);
  const { Journal } = await import('../../src/domain/journal');
  expect((await new Journal(f.store).query({ tradeId: f.command.tradeId })).obligations).toHaveLength(1);
  const before = await f.store.versions.toArray(); const root = await f.store.roots.get('active');
  expect(await f.workflows.recordPositionChange(f.command)).toMatchObject({ status: 'Conflict' });
  expect(await f.workflows.recordPositionChange({ ...f.command, executions: f.command.executions.map(execution => ({ ...execution, instrument: { ...execution.instrument, symbol: 'OTHER' } })), expectedWorkspaceRevision: root?.revision ?? '' })).toMatchObject({ status: 'Conflict' });
  expect(await f.store.versions.toArray()).toEqual(before);
  f.store.close();
});
it('captures Defer and Decline while preserving unrelated outstanding Debt unchanged', async () => {
  const f = await openingFixture();
  const first = await f.workflows.recordPositionChange({ ...f.command, reflection: { kind: 'Defer' } });
  if (first.status !== 'Recorded') throw new Error(first.status);
  const { Journal } = await import('../../src/domain/journal');
  const owed = (await new Journal(f.store).query({ scope: 'Outstanding' })).obligations;
  const secondPlan = await f.workflows.confirmPlan(f.planCommand);
  if (secondPlan.status !== 'Confirmed') throw new Error(secondPlan.status);
  const root = await f.store.roots.get('active');
  const second = await f.workflows.recordPositionChange({ ...f.command, expectedWorkspaceRevision: root?.revision ?? '', tradeId: secondPlan.trade.tradeId, expectedTradeRevision: secondPlan.trade.revision, plannedLegId: secondPlan.trade.plannedLegId, executions: f.command.executions.map(execution => ({ ...execution, plannedLegId: secondPlan.trade.plannedLegId })), reflection: { kind: 'Decline', reason: 'No reflection now' } });
  expect(second).toMatchObject({ status: 'Recorded', journalOutcome: { obligation: { status: 'Declined' }, decline: { reason: 'No reflection now' } } });
  expect((await new Journal(f.store).query({ scope: 'Outstanding' })).obligations).toEqual(owed);
  expect((await new Journal(f.store).query(first.trade.tradeId))).toHaveLength(1);
  expect(owed).toHaveLength(1);
  f.store.close();
});

it('rolls back every opening participant and sequence after Journal staging aborts', async () => {
  const f = await openingFixture();
  const before = { root: await f.store.roots.get('active'), versions: await f.store.versions.toArray(), lifecycle: await f.store.lifecycle.toArray() };
  const abort = (_key: unknown, row: { kind: string }) => { if (row.kind === 'JournalObligation') throw new Error('Injected Journal storage abort'); };
  f.store.versions.hook('creating', abort);
  expect(await f.workflows.recordPositionChange(f.command)).toMatchObject({ status: 'StorageFailure' });
  f.store.versions.hook('creating').unsubscribe(abort);
  expect({ root: await f.store.roots.get('active'), versions: await f.store.versions.toArray(), lifecycle: await f.store.lifecycle.toArray() }).toEqual(before);
  const { Store } = await import('../../src/infrastructure/storage');
  const name = f.store.name; f.store.close(); const reopened = new Store(name);
  expect({ root: await reopened.roots.get('active'), versions: await reopened.versions.toArray(), lifecycle: await reopened.lifecycle.toArray() }).toEqual(before);
  reopened.close();
});
it('reports all failed readiness checks before apply and records no opening or Journal outcome', async () => {
  const f = await openingFixture(); const before = await f.store.versions.toArray(); const root = await f.store.roots.get('active');
  const { vi } = await import('vitest');
  vi.spyOn(f.runtime.host, 'check').mockResolvedValue({ transaction: false, capacity: false, control: false, inventory: false, protection: 'Unavailable' });
  expect(await f.workflows.recordPositionChange(f.command)).toMatchObject({ status: 'RuntimeNotWritable', failedChecks: ['transaction', 'capacity', 'control', 'inventory'], workspaceStatus: 'RecoveryOnly' });
  expect(await f.store.versions.toArray()).toEqual(before); expect(await f.store.roots.get('active')).toEqual(root);
  f.store.close();
});
