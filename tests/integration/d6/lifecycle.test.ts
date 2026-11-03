// I6.3: the complete lifecycle of the reference Trade T-A, Planned through Closed (AC-LIFE-001,
// AC-POS-001, AC-RESP-001): stored and expected lifecycle agree at each revision, index membership moves
// in the same commit as each change, every result equals the stored Trade, and nothing about matching
// is stored (P23).
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { Rational } from '../../../src/domain/values/index.ts';
import { activityDescOf } from '../../../src/persistence/index.ts';
import { countRequests } from '../../support/request-counter.ts';
import {
  closeReasonId, closeReviewDisposition, complete, confirmReference, dec, device, dumpAll, onboarded, PC1, PC2, recordExit, record, restart, TUESDAY_1400, TUESDAY_1700, workspaceStores, X1, X2A, X2B,
  type Device, type StoredTradeDoc,
} from './support.ts';

type IndexedTradeDoc = StoredTradeDoc & { readonly planTime: string; readonly lastActivity: string };

// The keys the Trade sits under in one index, read with a key cursor (the last key part is the Trade id).
async function indexKeys(d: Device, database: string, index: string, tradeId: string): Promise<unknown[][]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = d.factory.open(database);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('open failed'));
  });
  const keys = await new Promise<unknown[][]>((resolve, reject) => {
    const found: unknown[][] = [];
    const request = db.transaction('trades').objectStore('trades').index(index).openKeyCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve(found);
      const key = cursor.key as unknown[];
      if (key.at(-1) === tradeId) found.push(key);
      cursor.continue();
    };
    request.onerror = () => reject(request.error ?? new Error('cursor failed'));
  });
  db.close();
  return keys;
}

// What the stores hold for the Trade at one revision: its stored document and the index keys it sits under.
async function stored(d: Device, tradeId: string) {
  const dump = await dumpAll(d.factory);
  const database = Object.keys(dump).find((n) => n.startsWith('tj-ws-'))!;
  const trade = (workspaceStores(dump)['trades'] as IndexedTradeDoc[]).find((t) => t.tradeId === tradeId)!;
  return {
    trade,
    byLifecycle: await indexKeys(d, database, 'byLifecycle', tradeId),
    byLifecycleActivity: await indexKeys(d, database, 'byLifecycleActivity', tradeId),
    byLifecycleTerminal: await indexKeys(d, database, 'byLifecycleTerminal', tradeId),
  };
}

// The Trade sits under exactly one key of byLifecycle, in the range of its lifecycle; the activity index lists only
// started Trades and the terminal index only Closed ones.
function expectIndexed(s: Awaited<ReturnType<typeof stored>>, lifecycle: string) {
  expect(s.trade.lifecycle).toBe(lifecycle);
  expect(s.byLifecycle).toEqual([[lifecycle, s.trade.planTime, s.trade.tradeId]]);
  expect(s.byLifecycleActivity).toEqual(lifecycle === 'Planned' ? [] : [[lifecycle, activityDescOf(s.trade.lastActivity), s.trade.tradeId]]);
  expect(s.byLifecycleTerminal).toEqual(lifecycle === 'Closed' ? [['Closed', activityDescOf(s.trade.terminalTime!), s.trade.tradeId]] : []);
}

async function detailOf(app: Application, tradeId: string) {
  const result = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
  if (result.kind !== 'Ready') throw new Error(`getTradeDetail: ${result.kind}`);
  return result.view;
}

describe('I6.3 complete lifecycle', () => {
  it('should step Planned, Open, Open, Open, Closed with stored and expected lifecycle agreeing and the index moving in each commit, give every result equal to the stored Trade, store no Lot Match, and show T-A with four derived Lot Matches, 248.00 realized, and its Close Review in Closed only', async () => {
    const d = await device(undefined, TUESDAY_1700);
    const app = await onboarded(d);
    const tradeId = await confirmReference(app);

    // Planned.
    const planned = await stored(d, tradeId);
    expectIndexed(planned, 'Planned');
    expect((await detailOf(app, tradeId)).lifecycle).toEqual({ stored: 'Planned', agreement: { kind: 'Agrees' } });

    // PC1, PC2 and X1: each result equals the Detail read right after it (AC-RESP-001), and the Trade stays in the
    // Open index. The stored document and its index keys are read after every change, in the commit that made it.
    const results = [];
    for (const step of [async () => record(app, tradeId, PC1, await complete(app)), async () => record(app, tradeId, PC2, await complete(app)), () => recordExit(app, tradeId, [X1])]) {
      const result = await step();
      results.push(result);
      expectIndexed(await stored(d, tradeId), 'Open');
      const openDetail = await detailOf(app, tradeId);
      expect(openDetail.lifecycle).toEqual({ stored: 'Open', agreement: { kind: 'Agrees' } });
      expect(result.postCommit.trade.positionChanges).toEqual('positionChanges' in openDetail ? openDetail.positionChanges : undefined);
      expect('lotMatches' in openDetail && openDetail.lotMatches.map(({ openingExecutionId, disposingExecutionId, quantity }) => ({ openingExecutionId, disposingExecutionId, quantity }))).toEqual(
        result.postCommit.derivation.lotMatches.map(({ openingExecutionId, disposingExecutionId, quantity }) => ({ openingExecutionId, disposingExecutionId, quantity })),
      );
      expect('realizedToDate' in openDetail && openDetail.realizedToDate).toEqual(result.postCommit.derivation.realizedToDate);
    }
    const lifecycles = ['Open', 'Open', 'Open'];
    // The Execution identities, in the order the receipts created them: the Position Change first, then its members.
    const executions = results.map((r) => r.receipt.createdFactIds.slice(1));
    const [ex1, ex2, exX1] = [executions[0]![0]!, executions[1]![0]!, executions[2]![0]!];
    for (const [i, result] of results.entries()) {
      expect(result.postCommit.trade.storedLifecycle).toBe(lifecycles[i]);
      expect(result.postCommit.derivation.expectedLifecycle).toBe(lifecycles[i]);
    }
    expect(results[2]!.postCommit.derivation.realizedToDate).toEqual(dec('55.90'));

    // X2 closes the Trade with a Close Reason and a completed Close Review, both reflections completed.
    const targetReached = await closeReasonId(app, 'Target Reached');
    const closing = await recordExit(app, tradeId, [X2A, X2B], { closeReasonId: targetReached, closeReview: await closeReviewDisposition(app, 'Complete') });
    expect(closing.receipt.lifecycleTransitions).toEqual([{ tradeId, from: 'Open', to: 'Closed' }]);
    expect(closing.postCommit.trade.storedLifecycle).toBe('Closed');
    expect(closing.postCommit.derivation.expectedLifecycle).toBe('Closed');
    expect(closing.postCommit.derivation.agreement).toEqual({ kind: 'Agrees' });
    expect(closing.postCommit.closeReview?.kind).toBe('Entry');

    // The same commit moved the Trade from the Open index to the Closed one.
    const closed = await stored(d, tradeId);
    expectIndexed(closed, 'Closed');
    expect(closed.trade.terminalTime).toBe(TUESDAY_1400);

    // Dump: every Execution owned by T-A, a Close Reason fact naming X2, and no Lot-Match record anywhere (P23).
    const x2 = closing.receipt.createdFactIds;
    const [x2PositionChange, ex2a, ex2b] = x2;
    const dump = await dumpAll(d.factory);
    const stores = workspaceStores(dump);
    const trades = stores['trades'] as StoredTradeDoc[];
    expect(trades).toHaveLength(1);
    expect(trades[0]!.facts.filter((f) => f.kind === 'Execution').map((f) => f.factId).sort()).toEqual([ex1, ex2, exX1, ex2a!, ex2b!].sort());
    expect(trades[0]!.closeReasonFacts).toEqual([
      expect.objectContaining({ kind: 'CloseReason', versions: [expect.objectContaining({ value: { closeReasonId: targetReached, terminalPositionChangeId: x2PositionChange } })] }),
    ]);
    expect(Object.keys(stores).filter((name) => /lot|match/i.test(name))).toEqual([]);
    expect(JSON.stringify(dump)).not.toMatch(/lotMatch|LotMatch/);

    // The result equals the stored Trade: restart, then read.
    const again = await restart(app, d);
    const detail = await detailOf(again, tradeId);
    if (!('terminalDisposition' in detail)) throw new Error('expected the Closed form of Detail');
    expect(detail.lifecycle).toEqual({ stored: 'Closed', agreement: { kind: 'Agrees' } });
    expect(closing.postCommit.trade.positionChanges).toEqual(detail.positionChanges);
    expect(closing.postCommit.derivation.lotMatches).toEqual(detail.lotMatches.map(({ openingExecutionId, disposingExecutionId, quantity, policy }) => ({ openingExecutionId, disposingExecutionId, quantity, policy })));
    expect(closing.postCommit.derivation.realizedToDate).toEqual(detail.realizedToDate);
    expect(closing.postCommit.derivation.terminalDisposition).toEqual(detail.terminalDisposition);
    expect(closing.postCommit.derivation.realizedR).toEqual(detail.realizedR);

    // Detail: the four derived Lot Matches with the section 4 quantities, realized and allocated fees.
    const value = (text: string) => ({ kind: 'Value', value: dec(text) });
    expect(detail.lotMatches.map((m) => [m.openingExecutionId, m.disposingExecutionId, m.quantity, m.allocatedOpeningFee, m.allocatedDisposalFee, m.realized])).toEqual([
      [ex1, exX1, dec('30'), value('0.50'), value('0.60'), value('55.90')],
      [ex1, ex2a!, dec('30'), value('0.50'), value('0.60'), value('85.90')],
      [ex2, ex2a!, dec('20'), value('0.50'), value('0.40'), value('53.10')],
      [ex2, ex2b!, dec('20'), value('0.50'), value('0.40'), value('53.10')],
    ]);
    expect(detail.realizedToDate).toEqual(dec('248.00'));
    expect(detail.feeReconciliation).toEqual({
      incurred: dec('4.00'),
      incurredOpening: dec('2.00'),
      incurredDisposal: dec('2.00'),
      allocatedOpening: dec('2.00'),
      allocatedDisposal: dec('2.00'),
      unconsumedOpening: dec('0'),
    });
    expect(detail.realizedR).toEqual({ kind: 'Value', value: Rational.of(124n, 125n) });
    // How the exposure ended (100 shares sold) apart from why the trader closed (Target Reached).
    expect(detail.terminalDisposition).toEqual({ kind: 'Value', value: [{ mechanism: 'Executions', quantity: dec('100') }] });
    expect(detail.closeReason).toEqual({ id: targetReached, label: 'Target Reached' });
    expect(detail.terminalTime).toBe(TUESDAY_1400);
    expect(detail.journal).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'Entry', entryTypeKey: 'entry-type.close-review' })]));

    // The Closed Detail reads no Mark: no observation request is issued, and the Workspace holds none.
    const read = await countRequests(() => again.TradeViewsAndReporting.getTradeDetail({ tradeId }));
    expect(read.requests.filter((r) => r.store === 'observations')).toEqual([]);
    expect(stores['observations']).toEqual([]);

    // T-A appears only in Closed.
    const listed = async (app: Application, lifecycle: 'Planned' | 'Open' | 'Closed') => {
      const page = await app.TradeViewsAndReporting.browseTrades({ lifecycle });
      if (page.kind !== 'Ready') throw new Error(`browseTrades ${lifecycle}: ${page.kind}`);
      return page.view.items.map((i) => i.tradeId);
    };
    expect(await listed(again, 'Planned')).toEqual([]);
    expect(await listed(again, 'Open')).toEqual([]);
    expect(await listed(again, 'Closed')).toEqual([tradeId]);
  }, 60_000);
});
