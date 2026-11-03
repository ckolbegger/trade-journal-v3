// I6.3: the complete lifecycle of the reference Trade T-A, Planned through Closed (AC-LIFE-001,
// AC-POS-001, AC-RESP-001): stored and expected lifecycle agree at each revision, index membership moves
// in the same commit as each change, every result equals the stored Trade, and nothing about matching
// is stored (P23).
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { Rational } from '../../../src/domain/values/index.ts';
import { countRequests } from '../../support/request-counter.ts';
import {
  closeReasonId, closeReviewDisposition, complete, confirmReference, dec, device, dumpAll, onboarded, PC1, PC2, readIndex, recordExit, record, restart, TUESDAY_1400, TUESDAY_1700, workspaceStores, X1, X2A, X2B,
  type Device, type StoredTradeDoc,
} from './support.ts';

// What the stores hold for the Trade at one revision: its stored lifecycle and its place in each index.
async function stored(d: Device, tradeId: string) {
  const dump = await dumpAll(d.factory);
  const database = Object.keys(dump).find((n) => n.startsWith('tj-ws-'))!;
  const trade = (workspaceStores(dump)['trades'] as StoredTradeDoc[]).find((t) => t.tradeId === tradeId)!;
  const membership = async (index: string) => ((await readIndex(d.factory, database, 'trades', index)) as StoredTradeDoc[]).filter((t) => t.tradeId === tradeId).map((t) => t.lifecycle);
  return { trade, byLifecycle: await membership('byLifecycle'), byLifecycleActivity: await membership('byLifecycleActivity'), byLifecycleTerminal: await membership('byLifecycleTerminal') };
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
    expect(planned.trade.lifecycle).toBe('Planned');
    expect(planned.byLifecycle).toEqual(['Planned']);
    expect(planned.byLifecycleTerminal).toEqual([]);
    expect((await detailOf(app, tradeId)).lifecycle).toEqual({ stored: 'Planned', agreement: { kind: 'Agrees' } });

    // PC1, PC2 and X1: each result equals the Detail read now, and the Trade stays in the Open index.
    const results = [await record(app, tradeId, PC1, await complete(app)), await record(app, tradeId, PC2, await complete(app)), await recordExit(app, tradeId, [X1])];
    const lifecycles = ['Open', 'Open', 'Open'];
    // The Execution identities, in the order the receipts created them: the Position Change first, then its members.
    const executions = results.map((r) => r.receipt.createdFactIds.slice(1));
    const [ex1, ex2, exX1] = [executions[0]![0]!, executions[1]![0]!, executions[2]![0]!];
    const afterX1 = await stored(d, tradeId);
    expect(afterX1.trade.lifecycle).toBe('Open');
    expect(afterX1.byLifecycleActivity).toEqual(['Open']);
    expect(afterX1.byLifecycleTerminal).toEqual([]);
    for (const [i, result] of results.entries()) {
      expect(result.postCommit.trade.storedLifecycle).toBe(lifecycles[i]);
      expect(result.postCommit.derivation.expectedLifecycle).toBe(lifecycles[i]);
    }
    // X1's result equals the Detail of the stored Trade (AC-RESP-001).
    const partial = results[2]!;
    const openDetail = await detailOf(app, tradeId);
    expect(openDetail.lifecycle).toEqual({ stored: 'Open', agreement: { kind: 'Agrees' } });
    expect(partial.postCommit.trade.positionChanges).toEqual('positionChanges' in openDetail ? openDetail.positionChanges : undefined);
    expect('lotMatches' in openDetail && openDetail.lotMatches.map(({ openingExecutionId, disposingExecutionId, quantity }) => ({ openingExecutionId, disposingExecutionId, quantity }))).toEqual(
      partial.postCommit.derivation.lotMatches.map(({ openingExecutionId, disposingExecutionId, quantity }) => ({ openingExecutionId, disposingExecutionId, quantity })),
    );
    expect('realizedToDate' in openDetail && openDetail.realizedToDate).toEqual(partial.postCommit.derivation.realizedToDate);
    expect(partial.postCommit.derivation.realizedToDate).toEqual(dec('55.90'));

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
    expect(closed.trade.lifecycle).toBe('Closed');
    expect(closed.byLifecycle).toEqual(['Closed']);
    expect(closed.byLifecycleActivity).toEqual(['Closed']);
    expect(closed.byLifecycleTerminal).toEqual(['Closed']);
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
