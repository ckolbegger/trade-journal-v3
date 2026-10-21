import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { workspaceFixture } from '../fixtures';
import { TradeViewsAndReporting } from '../../src/application/trade-views-and-reporting';
describe('coherent Planned Trade reads', () => {
  it('should expose retained baseline, readiness and exact reflection once with a coherent binding', async () => {
    const f = await workspaceFixture();
    const saved = await f.workflows.confirmPlan(f.command);
    if (saved.status !== 'Confirmed') throw new Error('Confirmation failed');
    const views = new TradeViewsAndReporting(f.store);
    expect(await views.browseTrades()).toMatchObject({ status: 'Ready', items: [{ trade: saved.trade, entryReadiness: 'Unfilled' }], totalInPage: 1, binding: { workspaceRevision: saved.workspaceRevision } });
    expect(await views.getTradeDetail(saved.trade.tradeId)).toMatchObject({ status: 'Ready', trade: saved.trade, entries: [saved.entry], history: [saved.trade], entryReadiness: 'Unfilled', labels: { account: 'Trading', institution: 'Broker', strategy: 'Long Stock' } });
    f.store.close();
  });
});
it('should distinguish successful Empty from query failure and allow safe retry', async () => {
  const f = await workspaceFixture();
  const views = new TradeViewsAndReporting(f.store);
  expect(await views.browseTrades()).toMatchObject({ status: 'Empty', items: [] });
  const { vi } = await import('vitest');
  const failure = vi.spyOn(f.store.roots, 'get').mockRejectedValue(new Error('Storage read failed'));
  expect(await views.browseTrades()).toMatchObject({ status: 'Error', reason: 'StorageReadFailed' });
  failure.mockRestore();
  expect(await views.browseTrades()).toMatchObject({ status: 'Empty' });
  f.store.close();
});
it('should page a snapshot-bound Planned index in stable economic and sequence order', async () => {
  const f = await workspaceFixture();
  for (let i = 0; i < 53; i++) await f.workflows.confirmPlan(f.command);
  const views = new TradeViewsAndReporting(f.store);
  const first = await views.browseTrades();
  if (first.status !== 'Ready') throw new Error('Page required');
  expect(first.items).toHaveLength(50);
  expect(first.items[0]?.trade.sequence).toBe(53);
  expect(first.nextCursor).toEqual(expect.any(String));
  const second = await views.browseTrades({ cursor: first.nextCursor });
  if (second.status !== 'Ready') throw new Error('Page required');
  expect(second.items.map(item => item.trade.sequence)).toEqual([3, 2, 1]);
  await f.workflows.confirmPlan(f.command);
  expect(await views.browseTrades({ cursor: first.nextCursor })).toMatchObject({ status: 'ChangedDuringAssembly' });
  f.store.close();
});
it('should surface lifecycle disagreement without repairing authoritative records', async () => {
  const f = await workspaceFixture();
  const saved = await f.workflows.confirmPlan(f.command);
  if (saved.status !== 'Confirmed') throw new Error('Confirmation failed');
  const key = `${f.command.generation}:${saved.trade.tradeId}`;
  // Controlled integrity fixture: change only the authoritative lifecycle agreement.
  await f.store.lifecycle.update(key, { lifecycle: 'Open' });
  const before = await f.store.lifecycle.get(key);
  expect(await new TradeViewsAndReporting(f.store).getTradeDetail(saved.trade.tradeId)).toMatchObject({ status: 'IntegrityBlocked', findings: ['LifecycleDisagreement'] });
  expect(await f.store.lifecycle.get(key)).toEqual(before);
  f.store.close();
});
it('should batch-resolve retained Trade anchors without redirecting unknown identities', async () => {
  const { TradeRecord } = await import('../../src/domain/trade-record');
  const f = await workspaceFixture();
  const saved = await f.workflows.confirmPlan(f.command);
  if (saved.status !== 'Confirmed') throw new Error('Confirmation required');
  const resolved = await new TradeRecord(f.store).resolveAnchors([{ kind: 'Trade', tradeId: saved.trade.tradeId }, { kind: 'Trade', tradeId: 'unknown' }]);
  expect(resolved).toMatchObject({ resolutions: [{ anchor: { kind: 'Trade', tradeId: saved.trade.tradeId }, status: 'Effective', owningTradeId: saved.trade.tradeId }, { anchor: { kind: 'Trade', tradeId: 'unknown' }, status: 'Unknown' }], workspaceRevision: saved.workspaceRevision });
  f.store.close();
});
it('should sort equivalent-offset and submillisecond Economic Times by instant then Recorded Sequence', async () => {
  const f = await workspaceFixture();
  for (const economicTime of ['2026-10-17T20:00:00Z', '2026-10-17T16:00:00-04:00', '2026-10-17T20:00:00.000000001Z']) expect((await f.workflows.confirmPlan({ ...f.command, economicTime })).status).toBe('Confirmed');
  const page = await new TradeViewsAndReporting(f.store).browseTrades();
  if (page.status !== 'Ready') throw new Error('List required');
  expect(page.items.map(item => item.trade.sequence)).toEqual([3, 2, 1]);
  expect(page.items[1]?.trade.economicTime).toBe('2026-10-17T16:00:00-04:00');
  f.store.close();
});
