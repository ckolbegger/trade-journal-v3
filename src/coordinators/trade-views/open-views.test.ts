import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { derive, type TradeAnalysisRecord } from '../../domain/trade-analysis/index.ts';
import { Rational } from '../../domain/values/index.ts';
import type { ReflectionDisposition } from '../../modules/journal/index.ts';
import { onboardedStack } from '../../../tests/support/onboarded.ts';
import { dumpAll } from '../../../tests/support/stack.ts';
import type { PositionChangeMember } from '../trade-workflows/index.ts';
import { createTradeViews } from './index.ts';

// D2's reference Trade (breakdown, section 4): 100 shares, intended entry 50, Stop 47.50, Target 56,
// confirmed 2026-10-12 09:00 America/New_York; PC1 10:00, PC2 11:00, PC3 14:00. The clock reads
// 17:00 that day.
const NOW = '2026-10-12T21:00:00Z';
const PLAN_TIME = '2026-10-12T13:00:00Z';
const PC1 = '2026-10-12T14:00:00Z';
const PC2 = '2026-10-12T15:00:00Z';
const PC3 = '2026-10-12T18:00:00Z';

// derive is the real one, spied on so a read's derivations can be counted.
vi.mock('../../domain/trade-analysis/index.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../domain/trade-analysis/index.ts')>();
  return { ...original, derive: vi.fn(original.derive) };
});

async function openStack() {
  const stack = await onboardedStack(new IDBFactory(), NOW);
  const views = createTradeViews(stack);
  const pcDefinition = await stack.journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  if (pcDefinition.kind !== 'Found') throw new Error('no Position Change Reflection definition');
  const reflectionDefinitionId = pcDefinition.definition.id;

  const confirm = async (symbol = 'XYZ'): Promise<TradeAnalysisRecord> => {
    const confirmed = await stack.tradeWorkflows.confirmPlan({
      accountId: stack.account.id,
      accountRevision: stack.account.recordRevision,
      strategyId: stack.strategy.id,
      strategyRevision: stack.strategy.recordRevision,
      economicTime: PLAN_TIME,
      plan: {
        underlying: symbol,
        legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol }, quantity: '100', intendedEntry: '50.00' }],
        stops: [{ kind: 'UnderlyingPrice', price: '47.50' }],
        targets: [{ kind: 'UnderlyingPrice', price: '56.00' }],
      },
      reflection: {
        definitionId: stack.definition.id,
        answers: {
          'prompt.plan-reflection.thesis': { kind: 'Text', text: 'Breakout above the 50-day on volume.' },
          'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close back below 48.' },
        },
      },
    });
    if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${confirmed.kind}`);
    return confirmed.postCommit.trade;
  };

  const complete: ReflectionDisposition = {
    kind: 'Complete',
    form: {
      definitionId: reflectionDefinitionId,
      answers: {
        'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
        'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
        'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
      },
    },
  };
  const decline = (reason: string): ReflectionDisposition => ({ kind: 'Decline', definitionId: reflectionDefinitionId, reason });

  // Records one single-Execution Position Change, reading the Trade's current FactRevision first.
  const enter = async (
    trade: TradeAnalysisRecord,
    economicTime: string,
    quantity: string,
    price: string,
    reflection: ReflectionDisposition = complete,
  ): Promise<string> => {
    const current = await stack.tradeRecord.getRecord({ tradeId: trade.tradeId, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error('no Trade');
    const member: PositionChangeMember = {
      kind: 'Execution',
      tradeId: trade.tradeId,
      action: 'Buy',
      instrument: { kind: 'Stock', symbol: trade.plan.underlying },
      intent: { kind: 'ServesPlannedLeg', plannedLegId: trade.plan.legs[0]!.factId },
      quantity,
      price,
      fee: '1.00',
      economicTime,
    };
    const result = await stack.tradeWorkflows.recordPositionChange({
      originTradeId: trade.tradeId,
      trades: [{ tradeId: trade.tradeId, expectedFactRevision: current.factRevision }],
      members: [member],
      reflection,
    });
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${result.kind}`);
    return result.receipt.createdFactIds[0]!;
  };

  return { ...stack, views, confirm, enter, decline };
}

describe('browseTrades: Open', () => {
  it('should return a Ready page with, per Trade, underlying, Strategy, Account and Institution labels, open quantity of planned quantity, average open cost, incurred fees, entry status Entering or Resolved, Deviation count, integrity indicator, and Last Activity, ordered by Last Activity descending', async () => {
    const stack = await openStack();
    const entering = await stack.confirm('XYZ');
    const resolved = await stack.confirm('ABC');
    await stack.confirm('QRS');
    await stack.enter(entering, PC1, '60', '50.10');
    await stack.enter(resolved, PC1, '60', '50.10');
    await stack.enter(resolved, PC3, '60', '50.40');

    const result = await stack.views.browseTrades({ lifecycle: 'Open' });
    if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
    expect(result.view.items.map((i) => i.tradeId)).toEqual([resolved.tradeId, entering.tradeId]);
    const [first, second] = result.view.items;
    if (!(first && 'openQuantity' in first && second && 'openQuantity' in second)) throw new Error('expected derived Open items');
    expect(second).toEqual({
      tradeId: entering.tradeId,
      underlying: 'XYZ',
      strategy: 'Long Stock',
      account: 'Roth IRA',
      institution: 'Fidelity',
      openQuantity: expect.any(Rational) as unknown,
      plannedQuantity: expect.any(Rational) as unknown,
      averageOpenCost: { kind: 'Value', value: expect.any(Rational) as unknown },
      summary: { kind: 'Stock', direction: 'Long', quantity: expect.any(Rational) as unknown, price: expect.any(Rational) as unknown },
      netCost: { kind: 'Value', value: expect.any(Rational) as unknown },
      incurredFees: expect.any(Rational) as unknown,
      entryStatus: 'Entering',
      deviationCount: 0,
      integrity: 'Agrees',
      lastActivity: PC1,
      current: expect.any(Object) as unknown,
    });
    expect(second?.openQuantity.equals(Rational.of(60n))).toBe(true);
    expect(second?.plannedQuantity.equals(Rational.of(100n))).toBe(true);
    expect(second?.averageOpenCost.kind === 'Value' && second.averageOpenCost.value.equals(Rational.of(501n, 10n))).toBe(true);
    expect(second?.incurredFees.equals(Rational.of(1n))).toBe(true);
    // 60 @ 50.10 and 60 @ 50.40: 120 of 100, averaging 50.25, with 20 shares above plan.
    expect(first).toEqual(expect.objectContaining({ underlying: 'ABC', entryStatus: 'Resolved', deviationCount: 1, integrity: 'Agrees', lastActivity: PC3 }));
    expect(first?.openQuantity.equals(Rational.of(120n))).toBe(true);
    expect(first?.averageOpenCost.kind === 'Value' && first.averageOpenCost.value.equals(Rational.of(201n, 4n))).toBe(true);
    expect(first?.incurredFees.equals(Rational.of(2n))).toBe(true);
  });

  it('should return an empty Ready page when no Trade is Open', async () => {
    const stack = await openStack();
    await stack.confirm('XYZ');
    const result = await stack.views.browseTrades({ lifecycle: 'Open' });
    expect(result.kind).toBe('Ready');
    expect(result.kind === 'Ready' && result.view).toEqual({ items: [] });
  });

  it('should derive each Trade once and bind the Trade, Journal, and Catalog revisions from one snapshot', async () => {
    const stack = await openStack();
    const first = await stack.confirm('XYZ');
    const second = await stack.confirm('ABC');
    await stack.enter(first, PC1, '60', '50.10');
    await stack.enter(second, PC2, '40', '50.30');
    let recordLoads = 0;
    const views = createTradeViews({
      ...stack,
      tradeRecord: {
        ...stack.tradeRecord,
        getRecord: (request) => {
          recordLoads++;
          return stack.tradeRecord.getRecord(request);
        },
      },
    });
    vi.mocked(derive).mockClear();
    const result = await views.browseTrades({ lifecycle: 'Open' });
    if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
    // One derivation per listed Trade, from the page's own batch: no per-Trade record loads.
    expect(vi.mocked(derive).mock.calls.map(([input]) => input.record.tradeId).sort()).toEqual([first.tradeId, second.tradeId].sort());
    expect(recordLoads).toBe(0);
    const current = await stack.persistence.readSnapshot(['meta'], async (tx) => ({
      catalog: await tx.get('meta', 'catalog'),
      journal: await tx.get('meta', 'journal'),
    }));
    expect(result.binding).toEqual({
      workspace: current.binding,
      catalogRevision: (current.value.catalog as { catalogRevision: number }).catalogRevision,
      journalRevision: (current.value.journal as { journalRevision: number }).journalRevision,
      marketDataSnapshotId: expect.any(String) as unknown,
    });
  });

  it('should list the Open book in pages of up to 200, the benchmarked maximum', async () => {
    const stack = await openStack();
    for (let i = 0; i < 201; i++) await stack.enter(await stack.confirm(`S${i}`), PC1, '10', '50.00');
    const first = await stack.views.browseTrades({ lifecycle: 'Open' });
    if (first.kind !== 'Ready' || !first.view.nextCursor) throw new Error('expected a next page');
    expect(first.view.items).toHaveLength(200);
    const second = await stack.views.browseTrades({ lifecycle: 'Open', cursor: first.view.nextCursor });
    expect(second.kind === 'Ready' && second.view.items).toHaveLength(1);
  }, 30_000);
});

describe('getTradeDetail: Open', () => {
  it('should return the Plan, stored lifecycle Open with agreement, Position, Open Lots, Position Changes with their Executions in Fact Order, Entry status, Entry Quality, Planned-Leg Fulfillment, recorded Deviations, and the Journal narrative including declines', async () => {
    const stack = await openStack();
    const trade = await stack.confirm('XYZ');
    // PC2 is recorded last but dated between PC1 and PC3, so Fact Order differs from recording order.
    const pc1 = await stack.enter(trade, PC1, '60', '50.10');
    const pc3 = await stack.enter(trade, PC3, '20', '51.00');
    const pc2 = await stack.enter(trade, PC2, '40', '50.30', stack.decline('Missed the moment.'));

    const result = await stack.views.getTradeDetail({ tradeId: trade.tradeId });
    if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
    const view = result.view;
    if (!('positionChanges' in view)) throw new Error('expected the Open form of Detail');
    expect(view.plan).toEqual(expect.objectContaining({ underlying: 'XYZ', planTime: PLAN_TIME, thesis: 'Breakout above the 50-day on volume.' }));
    expect(view.lifecycle).toEqual({ stored: 'Open', agreement: { kind: 'Agrees' } });
    expect(view.labels).toEqual({ strategy: 'Long Stock', account: 'Roth IRA', institution: 'Fidelity' });
    // Position and Open Lots.
    expect(view.positions).toHaveLength(1);
    expect(view.positions[0]!.quantity.equals(Rational.of(120n))).toBe(true);
    const lots = view.positions[0]!.openLots;
    expect(lots).toHaveLength(3);
    [
      [Rational.of(60n), Rational.of(501n, 10n)],
      [Rational.of(40n), Rational.of(503n, 10n)],
      [Rational.of(20n), Rational.of(51n)],
    ].forEach(([quantity, price], i) => {
      expect(lots[i]!.quantity.equals(quantity!) && lots[i]!.price.equals(price!)).toBe(true);
    });
    expect(view.fees.incurredOpening.equals(Rational.of(3n))).toBe(true);
    // Position Changes and their Executions in Fact Order.
    expect(view.positionChanges.map((pc) => [pc.factId, pc.economicTime, pc.executions.map((e) => [e.quantity, e.price])])).toEqual([
      [pc1, PC1, [['60', '50.10']]],
      [pc2, PC2, [['40', '50.30']]],
      [pc3, PC3, [['20', '51.00']]],
    ]);
    // Entry status and Entry Quality: resolved at PC2, averaging 50.18 over the window's 100 shares.
    expect(view.entryStatus).toBe('Resolved');
    expect(view.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: pc2 });
    if (view.entryQuality.kind !== 'Value') throw new Error('expected Entry Quality');
    const { averageEntry } = view.entryQuality.value;
    expect(averageEntry.kind === 'Value' && averageEntry.value.equals(Rational.of(2509n, 50n))).toBe(true);
    expect(view.legFulfillment).toEqual([{ plannedLegId: trade.plan.legs[0]!.factId, fulfillment: 'FilledWithDeviation' }]);
    // The recorded Entry Size occurrence: 20 above plan, caused by PC3.
    expect(view.deviations).toEqual([
      expect.objectContaining({
        versions: [expect.objectContaining({ type: 'EntrySize', form: 'Excess', quantityAbovePlan: '20', causingPositionChangeId: pc3, status: 'Active' })],
      }),
    ]);
    expect(view.findings).toEqual([]);
    // The narrative with the decline in moment order.
    expect(view.journal.map((item) => [item.kind, item.entryType, item.momentTime])).toEqual([
      ['Entry', 'Plan Reflection', PLAN_TIME],
      ['Entry', 'Position Change Reflection', PC1],
      ['Decline', 'Position Change Reflection', PC2],
      ['Entry', 'Position Change Reflection', PC3],
    ]);
    expect(view.journal[2]).toEqual(expect.objectContaining({ kind: 'Decline', reason: 'Missed the moment.' }));
  });

  it('should carry the positionChangeId of its Position Change on a reflection Entry and a Decline, and none on other items', async () => {
    const stack = await openStack();
    const trade = await stack.confirm('XYZ');
    const pc1 = await stack.enter(trade, PC1, '60', '50.10');
    const pc2 = await stack.enter(trade, PC2, '40', '50.30', stack.decline('Missed the moment.'));

    const result = await stack.views.getTradeDetail({ tradeId: trade.tradeId });
    if (result.kind !== 'Ready' || !('positionChanges' in result.view)) throw new Error('expected the Open form of Detail');
    expect(result.view.journal.map((item) => [item.kind, 'positionChangeId' in item ? item.positionChangeId : undefined])).toEqual([
      ['Entry', undefined],
      ['Entry', pc1],
      ['Decline', pc2],
    ]);
  });

  it('should give the Open Detail the same Last Activity as its Open list item', async () => {
    const stack = await openStack();
    const trade = await stack.confirm('XYZ');
    await stack.enter(trade, PC1, '60', '50.10');
    await stack.enter(trade, PC2, '40', '50.30');

    const detail = await stack.views.getTradeDetail({ tradeId: trade.tradeId });
    const list = await stack.views.browseTrades({ lifecycle: 'Open' });
    if (detail.kind !== 'Ready' || !('positionChanges' in detail.view)) throw new Error('expected the Open form of Detail');
    if (list.kind !== 'Ready') throw new Error(`expected Ready, got ${list.kind}`);
    expect(list.view.items[0]).toEqual(expect.objectContaining({ lastActivity: PC2 }));
    expect(detail.view.lastActivity).toBe(PC2);
  });

  it('should return the Planned form of Detail unchanged for a Planned Trade', async () => {
    const stack = await openStack();
    const trade = await stack.confirm('XYZ');
    const result = await stack.views.getTradeDetail({ tradeId: trade.tradeId });
    if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
    // D1's Detail plus the Trade Summary (T2.58): no Open fields, and narrative Entries without the item kind.
    expect(Object.keys(result.view).sort()).toEqual(['baseline', 'factRevision', 'journal', 'labels', 'lifecycle', 'plan', 'summary', 'tradeId']);
    expect(result.view.lifecycle).toEqual({ stored: 'Planned', agreement: { kind: 'Agrees' } });
    expect(result.view.journal).toHaveLength(1);
    expect(Object.keys(result.view.journal[0]!).sort()).toEqual(['anchor', 'authoredTime', 'entryType', 'id', 'momentTime', 'responses', 'source']);
  });
});

// The integrity fixture writer: rewrites one stored Trade document with the raw IndexedDB API, as a
// defect or a hand edit would, bypassing every module.
async function rewriteTrade(factory: IDBFactory, tradeId: string, change: (document: Record<string, unknown>) => Record<string, unknown>) {
  const dump = await dumpAll(factory);
  const name = Object.keys(dump).find((n) => n.startsWith('tj-ws-'))!;
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = factory.open(name);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('open failed'));
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('trades', 'readwrite');
    const store = tx.objectStore('trades');
    const read = store.get(tradeId);
    read.onsuccess = () => store.put(change(read.result as Record<string, unknown>));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('write failed'));
  });
  db.close();
}

// Two Trades whose stored records disagree with their facts: the reference Trade's recorded Entry
// Size occurrence is gone, and a second Open Trade's stored lifecycle says Planned.
async function disagreeingStack() {
  const stack = await openStack();
  const missing = await stack.confirm('XYZ');
  await stack.enter(missing, PC1, '60', '50.10');
  await stack.enter(missing, PC2, '40', '50.30');
  const pc3 = await stack.enter(missing, PC3, '20', '51.00');
  const planned = await stack.confirm('ABC');
  await stack.enter(planned, PC1, '60', '50.10');
  await rewriteTrade(stack.factory, missing.tradeId, (document) => ({ ...document, deviations: [] }));
  await rewriteTrade(stack.factory, planned.tradeId, (document) => ({ ...document, lifecycle: 'Planned' }));
  return { ...stack, missing, planned, pc3 };
}

describe('integrity is surfaced, never repaired AC-LIFE-003', () => {
  it('should return Ready with each agreement finding, and the list items integrity indicator, when stored and expected records disagree', async () => {
    const stack = await disagreeingStack();
    const list = await stack.views.browseTrades({ lifecycle: 'Open' });
    if (list.kind !== 'Ready') throw new Error(`expected Ready, got ${list.kind}`);
    expect(list.view.items.map((i) => [i.tradeId, i.integrity, i.deviationCount])).toEqual([[stack.missing.tradeId, 'Disagrees', 0]]);

    const missing = await stack.views.getTradeDetail({ tradeId: stack.missing.tradeId });
    if (missing.kind !== 'Ready' || !('findings' in missing.view)) throw new Error('expected a Ready Open Detail');
    expect(missing.view.lifecycle).toEqual({ stored: 'Open', agreement: { kind: 'Agrees' } });
    expect(missing.view.deviations).toEqual([]);
    expect(missing.view.findings).toEqual([
      expect.objectContaining({
        kind: 'DeviationMissing',
        fingerprint: { tradeId: stack.missing.tradeId, plannedLegId: stack.missing.plan.legs[0]!.factId, positionChangeId: stack.pc3 },
      }),
    ]);

    const planned = await stack.views.getTradeDetail({ tradeId: stack.planned.tradeId });
    if (planned.kind !== 'Ready' || !('findings' in planned.view)) throw new Error('expected a Ready Open Detail');
    const disagreement = { kind: 'LifecycleDisagreement', stored: 'Planned', expected: 'Open' };
    expect(planned.view.lifecycle).toEqual({ stored: 'Planned', agreement: disagreement });
    expect(planned.view.findings).toEqual([disagreement]);
  });

  it('should surface the disagreement on the Planned list item of an Open Trade stored as Planned, leaving an agreeing Planned item unchanged', async () => {
    const stack = await disagreeingStack();
    const agreeing = await stack.confirm('DEF');
    const list = await stack.views.browseTrades({ lifecycle: 'Planned' });
    if (list.kind !== 'Ready') throw new Error(`expected Ready, got ${list.kind}`);
    const byId = new Map(list.view.items.map((i) => [i.tradeId, i]));
    expect(byId.get(stack.planned.tradeId)).toEqual(expect.objectContaining({ integrity: 'Disagrees' }));
    expect(byId.get(agreeing.tradeId)).not.toHaveProperty('integrity');
  });

  it('should leave every content revision unchanged after reading a Trade with a disagreement', async () => {
    const stack = await disagreeingStack();
    const before = await dumpAll(stack.factory);
    expect((await stack.views.browseTrades({ lifecycle: 'Open' })).kind).toBe('Ready');
    expect((await stack.views.getTradeDetail({ tradeId: stack.missing.tradeId })).kind).toBe('Ready');
    expect((await stack.views.getTradeDetail({ tradeId: stack.planned.tradeId })).kind).toBe('Ready');
    // No read records a Deviation, moves a lifecycle, or advances any revision.
    expect(await dumpAll(stack.factory)).toEqual(before);
  });
});

