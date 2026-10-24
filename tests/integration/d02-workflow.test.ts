import { describe, expect, it } from 'vitest';
import type { Transaction } from 'dexie';
import { openingFixture } from '../d02-fixtures';
import { Store, type Envelope } from '../../src/infrastructure/storage';
import { TradeRecord } from '../../src/domain/trade-record';
import { Journal } from '../../src/domain/journal';
import { TradeViewsAndReporting } from '../../src/application/trade-views-and-reporting';
// Production modules/transactions; fake-indexeddb and explicit host/clock inputs only.
async function authority(store: Store) { return { roots: await store.roots.toArray(), versions: await store.versions.toArray(), lifecycle: await store.lifecycle.toArray() }; }
describe('D2 production-stack integration', () => {
  it('D2-I01 durably returns one owned decision and Complete, Defer or Decline with exact facts', async () => {
    for (const kind of ['Complete', 'Defer', 'Decline'] as const) {
      const f = await openingFixture();
      const result = await f.workflows.recordPositionChange({ ...f.command, reflection: kind === 'Complete' ? f.command.reflection : { kind } });
      if (result.status !== 'Recorded') throw new Error(result.status);
      expect(result.receipt).toMatchObject({ factRevision: result.trade.revision, positionChangeId: result.trade.opening?.positionChange.id, executionIds: result.trade.opening?.executions.map(execution => execution.id), workspaceRevision: result.workspaceRevision });
      const name = f.store.name; f.store.close(); const store = new Store(name);
      const records = new TradeRecord(store); const journal = new Journal(store); const views = new TradeViewsAndReporting(store);
      expect(await records.getRecord(result.trade.tradeId)).toEqual(result.trade);
      expect(await records.history(result.trade.tradeId)).toEqual([f.confirmed.trade, result.trade]);
      const narrative = await journal.query({ tradeId: result.trade.tradeId, scope: 'History' });
      expect(narrative.obligations).toEqual([result.journalOutcome.obligation]);
      expect(narrative.entries).toHaveLength(kind === 'Complete' ? 2 : 1);
      expect(narrative.declines).toEqual(result.journalOutcome.decline ? [result.journalOutcome.decline] : []);
      const detail = await views.getTradeDetail(result.trade.tradeId);
      expect(detail).toMatchObject({ status: 'Ready', quantity: '100', grossBasis: '5020', openingFees: '3', entryQuality: { risk: '523', reward: '977', comparison: 'BelowPlan' } });
      expect(await views.browseTrades({ lifecycle: 'Planned' })).toMatchObject({ status: 'Empty' });
      expect(await views.browseTrades({ lifecycle: 'Open' })).toMatchObject({ status: 'Ready', items: [{ trade: result.trade }] });
      store.close();
    }
  });
  it('D2-I02 serializes competing saves and recovers wholly before an aborted Journal participant', async () => {
    const f = await openingFixture(); const before = await authority(f.store);
    const abort = (_key: unknown, row: Envelope, tx: Transaction) => { if (row.kind === 'JournalObligation') tx.abort(); };
    f.store.versions.hook('creating', abort);
    expect(await f.workflows.recordPositionChange(f.command)).toMatchObject({ status: 'StorageFailure' });
    f.store.versions.hook('creating').unsubscribe(abort);
    expect(await authority(f.store)).toEqual(before);
    const results = await Promise.all([f.workflows.recordPositionChange(f.command), f.workflows.recordPositionChange(f.command)]);
    expect(results.map(result => result.status).sort()).toEqual(['Conflict', 'Recorded']);
    const saved = results.find(result => result.status === 'Recorded');
    if (!saved || saved.status !== 'Recorded') throw new Error('Winner required');
    const after = await authority(f.store); const name = f.store.name; f.store.close(); const reopened = new Store(name);
    expect(await authority(reopened)).toEqual(after);
    expect(await new TradeRecord(reopened).getRecord(saved.trade.tradeId)).toEqual(saved.trade);
    reopened.close();
  });
  it('D2-I03 reconstructs Open membership, exact fees and Debt after all documented private state is discarded', async () => {
    const f = await openingFixture(); const saved = await f.workflows.recordPositionChange({ ...f.command, reflection: { kind: 'Defer' } });
    if (saved.status !== 'Recorded') throw new Error(saved.status);
    const views = new TradeViewsAndReporting(f.store); const journal = new Journal(f.store);
    const before = { detail: await views.getTradeDetail(saved.trade.tradeId), open: await views.browseTrades({ lifecycle: 'Open' }), journal: await journal.query({ tradeId: saved.trade.tradeId }) };
    const facts = await authority(f.store); await f.store.projections.clear();
    expect({ detail: await views.getTradeDetail(saved.trade.tradeId), open: await views.browseTrades({ lifecycle: 'Open' }), journal: await journal.query({ tradeId: saved.trade.tradeId }) }).toEqual(before);
    expect(await authority(f.store)).toEqual(facts);
    expect(await f.workspace.getStatus()).toMatchObject({ status: 'Writable' });
    f.store.close();
  });
  it('D2-I04 atomically answers or declines original Debt, rejects stale retry and retains full history after restart', async () => {
    for (const kind of ['Complete', 'Decline'] as const) {
      const f = await openingFixture(); const opening = await f.workflows.recordPositionChange({ ...f.command, reflection: { kind: 'Defer' } });
      if (opening.status !== 'Recorded') throw new Error(opening.status);
      const journal = new Journal(f.store, f.runtime);
      const command = { kind: 'ResolveDebt' as const, generation: f.command.generation, expectedWorkspaceRevision: opening.workspaceRevision, obligationId: opening.journalOutcome.obligation.id, expectedRevision: opening.journalOutcome.obligation.revision, disposition: kind === 'Complete' ? { kind, answers: { 'decision-mode': 'as-planned', emotion: 'calm', confidence: '5' } } : { kind } };
      const result = await journal.save(command);
      if (result.status !== 'Saved') throw new Error(result.status);
      expect(result.obligation).toMatchObject({ definition: opening.journalOutcome.obligation.definition, origin: opening.journalOutcome.obligation.origin, source: opening.journalOutcome.obligation.source, momentTime: f.command.economicTime, dueTime: f.command.economicTime, debtId: opening.journalOutcome.obligation.debtId });
      const before = await authority(f.store); expect(await journal.save(command)).toMatchObject({ status: 'Conflict' }); expect(await authority(f.store)).toEqual(before);
      const name = f.store.name; f.store.close(); const reopened = new Store(name);
      const read = await new Journal(reopened).query({ tradeId: f.command.tradeId, scope: 'History' });
      expect(read.obligations).toEqual([result.obligation]); expect(read.obligationHistory).toEqual([opening.journalOutcome.obligation, result.obligation]);
      expect(read.entries).toEqual(result.entry ? [f.confirmed.entry, result.entry] : [f.confirmed.entry]);
      expect(read.declines).toEqual(result.decline ? [result.decline] : []);
      reopened.close();
    }
  });
});
