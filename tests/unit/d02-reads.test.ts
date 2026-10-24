import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { openingFixture } from '../d02-fixtures';
import { TradeViewsAndReporting } from '../../src/application/trade-views-and-reporting';
it('returns coherent Open Lots, Entry Quality and Journal outcomes without installed valuation', async () => {
  const f = await openingFixture(); const saved = await f.workflows.recordPositionChange(f.command);
  if (saved.status !== 'Recorded') throw new Error(saved.status);
  const detail = await new TradeViewsAndReporting(f.store).getTradeDetail(saved.trade.tradeId);
  expect(detail).toMatchObject({ status: 'Ready', trade: saved.trade, quantity: '100', grossBasis: '5020', openingFees: '3', entryQuality: { comparison: 'BelowPlan', risk: '523', reward: '977' }, journal: { obligations: [{ status: 'Completed' }] } });
  expect(detail).not.toHaveProperty('valuation');
  f.store.close();
});
it('selects only authoritative Open membership and resolves original Execution Anchors to their Trade', async () => {
  const f = await openingFixture(); const saved = await f.workflows.recordPositionChange(f.command);
  if (saved.status !== 'Recorded') throw new Error(saved.status);
  const views = new TradeViewsAndReporting(f.store);
  expect(await views.browseTrades({ lifecycle: 'Open' })).toMatchObject({ status: 'Ready', items: [{ trade: { tradeId: saved.trade.tradeId, lifecycle: 'Open' }, quantity: '100' }] });
  expect(await views.browseTrades({ lifecycle: 'Planned' })).toMatchObject({ status: 'Empty' });
  const { TradeRecord } = await import('../../src/domain/trade-record');
  const records = new TradeRecord(f.store);
  expect(await records.resolveAnchors( saved.trade.opening?.executions.map(execution => ({ kind: 'Execution', executionId: execution.id })) ?? [])).toMatchObject({ status: 'Ready', resolutions: [{ status: 'Effective', owningTradeId: saved.trade.tradeId }, { status: 'Effective', owningTradeId: saved.trade.tradeId }] });
  f.store.close();
});
it('blocks lifecycle, lot and deviation disagreement without repairing any authority on read', async () => {
  const f = await openingFixture(); const saved = await f.workflows.recordPositionChange(f.command);
  if (saved.status !== 'Recorded') throw new Error(saved.status);
  const views = new TradeViewsAndReporting(f.store);
  const key = `${f.command.generation}:${saved.trade.tradeId}`;
  await f.store.lifecycle.update(key, { lifecycle: 'Planned' });
  const before = await f.store.lifecycle.toArray();
  expect(await views.browseTrades({ lifecycle: 'Planned' })).toMatchObject({ status: 'IntegrityBlocked', findings: ['LifecycleDisagreement'] });
  expect(await f.store.lifecycle.toArray()).toEqual(before);
  await f.store.lifecycle.update(key, { lifecycle: 'Open' });
  const agreement = (await f.store.versions.where('[generation+tradeId]').equals([f.command.generation, saved.trade.tradeId]).filter(row => row.kind === 'Agreement').toArray())[0];
  if (!agreement) throw new Error('Agreement fixture');
  for (const value of [{ ...saved.trade.opening?.recordedAgreement, lotMatches: [{ openingId: 'bad', disposingId: 'bad', quantity: '1' }] }, { ...saved.trade.opening?.recordedAgreement, deviations: [{ kind: 'PlannedLegTerms', plannedLegId: 'bad', mismatches: ['symbol'] }] }]) {
    await f.store.versions.update(agreement.version, { value });
    const bad = await f.store.versions.toArray();
    expect(await views.getTradeDetail(saved.trade.tradeId)).toMatchObject({ status: 'IntegrityBlocked', findings: ['OpeningAgreementDisagreement'] });
    expect(await f.store.versions.toArray()).toEqual(bad);
  }
  f.store.close();
});
it('returns ChangedDuringAssembly for a detail binding invalidated by a Debt answer', async () => {
  const f = await openingFixture(); const saved = await f.workflows.recordPositionChange({ ...f.command, reflection: { kind: 'Defer' } });
  if (saved.status !== 'Recorded') throw new Error(saved.status);
  const { Journal } = await import('../../src/domain/journal');
  const settled = await new Journal(f.store, f.runtime).save({ kind: 'ResolveDebt', generation: f.command.generation, expectedWorkspaceRevision: saved.workspaceRevision, obligationId: saved.journalOutcome.obligation.id, expectedRevision: saved.journalOutcome.obligation.revision, disposition: { kind: 'Complete', answers: { 'decision-mode': 'as-planned', emotion: 'calm', confidence: '5' } } });
  expect(settled).toMatchObject({ status: 'Saved' });
  const views = new TradeViewsAndReporting(f.store);
  expect(await views.getTradeDetail(saved.trade.tradeId, saved.workspaceRevision)).toMatchObject({ status: 'ChangedDuringAssembly' });
  expect(await views.getTradeDetail(saved.trade.tradeId)).toMatchObject({ status: 'Ready', journal: { obligations: [{ status: 'Completed' }] } });
  f.store.close();
});
it('rejects a stale authoritative lifecycle FactRevision consistently in detail and opening preparation', async () => {
  const f = await openingFixture(); const saved = await f.workflows.recordPositionChange(f.command);
  if (saved.status !== 'Recorded') throw new Error(saved.status);
  await f.store.lifecycle.update(`${f.command.generation}:${saved.trade.tradeId}`, { revision: 'stale-fact-revision' });
  const before = await f.store.lifecycle.toArray();
  expect(await new TradeViewsAndReporting(f.store).getTradeDetail(saved.trade.tradeId)).toMatchObject({ status: 'IntegrityBlocked', findings: ['FactRevisionDisagreement'] });
  expect(await f.workflows.recordPositionChange(f.command)).toMatchObject({ status: 'IntegrityBlocked', findings: ['FactRevisionDisagreement'] });
  expect(await f.store.lifecycle.toArray()).toEqual(before);
  f.store.close();
});
