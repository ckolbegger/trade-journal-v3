import type { Transaction } from 'dexie';
import type { Envelope } from '../../src/infrastructure/storage';
import { describe, it, expect } from 'vitest';
import { workspaceFixture, economicTime, saveTime } from '../fixtures';
import { TradeViewsAndReporting } from '../../src/application/trade-views-and-reporting';
import { Store } from '../../src/infrastructure/storage';
import { TradeRecord } from '../../src/domain/trade-record';
import { Journal } from '../../src/domain/journal';
// Infrastructure replacements: fake-indexeddb only, explicit clock, and host capability evidence.
// No application dependency is mocked or replaced.
describe('D1 real-stack integration', () => {
  it('D1-I01 creates, returns and durably reopens a complete Plan and Reflection', async () => {
    const f = await workspaceFixture();
    const saved = await f.workflows.confirmPlan(f.command);
    if (saved.status !== 'Confirmed') throw new Error('Confirmation failed');
    const name = f.store.name; f.store.close();
    const reopened = new Store(name);
    expect(await new TradeRecord(reopened).getRecord(saved.trade.tradeId)).toEqual(saved.trade);
    expect(await new Journal(reopened).query(saved.trade.tradeId)).toEqual([saved.entry]);
    const view = await new TradeViewsAndReporting(reopened).getTradeDetail(saved.trade.tradeId);
    expect(view).toMatchObject({ status: 'Ready', trade: saved.trade, entries: [saved.entry] });
    reopened.close();
  });
  it('D1-I02 rejects invalid commands and rolls back a native storage abort after Plan staging', async () => {
    const f = await workspaceFixture();
    const before = { root: await f.store.roots.toArray(), versions: await f.store.versions.toArray(), lifecycle: await f.store.lifecycle.toArray() };
    for (const command of [
      { ...f.command, reflection: { thesis: '', invalidation: '' } },
      { ...f.command, plan: { ...f.command.plan, stop: '50' } },
      { ...f.command, plan: { ...f.command.plan, instrument: undefined } },
      { ...f.command, expectedCatalogRevision: 'stale', definitionRevision: 'stale' },
      { ...f.command, reflection: { ...f.command.reflection, conviction: '6', emotion: 'unknown' } },
    ]) expect((await f.workflows.confirmPlan(command)).status).not.toBe('Confirmed');
    // Storage-boundary fault: an IndexedDB unique-key violation aborts the actual transaction.
    const fault = (_key: unknown, row: Envelope, tx: Transaction) => { if (row.kind === 'JournalEntry') tx.abort(); };
    f.store.versions.hook('creating', fault);
    expect((await f.workflows.confirmPlan(f.command)).status).toBe('StorageFailure');
    f.store.versions.hook('creating').unsubscribe(fault);
    expect({ root: await f.store.roots.toArray(), versions: await f.store.versions.toArray(), lifecycle: await f.store.lifecycle.toArray() }).toEqual(before);
    const name = f.store.name; f.store.close(); const reopened = new Store(name);
    expect({ root: await reopened.roots.toArray(), versions: await reopened.versions.toArray(), lifecycle: await reopened.lifecycle.toArray() }).toEqual(before);
    reopened.close();
  });
  it('D1-I06 retains economic/save time, sequence and complete Journal provenance', async () => {
    const f = await workspaceFixture();
    const first = await f.workflows.confirmPlan({ ...f.command, reflection: { ...f.command.reflection, conviction: '3', emotion: 'calm' } });
    const second = await f.workflows.confirmPlan(f.command);
    if (first.status !== 'Confirmed' || second.status !== 'Confirmed') throw new Error('Confirmation failed');
    expect(first.trade).toMatchObject({ economicTime, saveTime, sequence: 1 });
    expect(second.trade).toMatchObject({ economicTime, saveTime, sequence: 2 });
    expect(first.trade.planFactId).not.toEqual(first.trade.planVersionId);
    expect(first.entry).toMatchObject({ anchor: { kind: 'Trade', tradeId: first.trade.tradeId }, origin: { kind: 'Plan', factId: first.trade.planFactId }, momentTime: economicTime, firstAuthoredTime: saveTime, definition: { revision: 'plan-reflection-v1' }, responses: { conviction: { kind: 'Scale', value: '3' }, emotion: { kind: 'SingleSelect', value: 'calm' } } });
    expect(second.entry.responses.conviction).toEqual({ kind: 'Unanswered' });
    const name = f.store.name; f.store.close(); const reopened = new Store(name);
    expect(await new TradeRecord(reopened).history(first.trade.tradeId)).toEqual([first.trade]);
    expect(await new Journal(reopened).query(first.trade.tradeId)).toEqual([first.entry]);
    reopened.close();
  });
});
