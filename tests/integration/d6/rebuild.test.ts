// I6.14: rebuilding private state gives equal Open, Planned and Closed lists, Details and Review, and identical
// byLifecycleTerminal, byLifecycleActivity and journalObligations, in a Workspace holding the states I6.3 (T-A
// closed by X2), I6.4 (the three Close Review dispositions) and I6.10 (the Closed-Trade Review fixture) leave
// behind (AC-REBUILD-001).
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { rebuildPrivateState } from '../../../src/persistence/index.ts';
import {
  closeReasonId, closedScenario, closeReviewDisposition, currentDatabase, dumpAll, outstandingDebts, PC1_TIME, planStock, readIndex, record, recordExit, restart, reviewAt, TUESDAY_1400, TUESDAY_1700, workspaceStores,
  X2A, X2B, type CloseReviewKind,
} from './support.ts';

type Lifecycle = 'Planned' | 'Open' | 'Closed';

// The three lists, every listed Trade's Detail, the Tuesday Review without its binding, and the Outstanding Debts.
async function views(app: Application) {
  const lists: Record<string, unknown> = {};
  const details: unknown[] = [];
  for (const lifecycle of ['Planned', 'Open', 'Closed'] as const satisfies readonly Lifecycle[]) {
    const page = await app.TradeViewsAndReporting.browseTrades({ lifecycle });
    if (page.kind !== 'Ready') throw new Error(`browseTrades ${lifecycle}: ${page.kind}`);
    lists[lifecycle] = page.view;
    for (const { tradeId } of page.view.items) {
      const result = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
      if (result.kind !== 'Ready') throw new Error(`getTradeDetail: ${result.kind}`);
      details.push(result.view);
    }
  }
  const review = { ...(await reviewAt(app, TUESDAY_1700)), binding: undefined };
  return { lists, details, review, debts: await outstandingDebts(app) };
}

describe('I6.14 Rebuild equivalence', () => {
  it('should give equal Open, Planned and Closed lists, Details and Review after rebuildPrivateState, with byLifecycleTerminal, byLifecycleActivity and journalObligations rebuilt identical', async () => {
    // I6.10: the Closed-Trade Review fixture.
    const { d, app: scenario, trades } = await closedScenario();
    let app = scenario;
    const reason = await closeReasonId(app, 'Target Reached');
    // I6.3: T-A closed by X2 (70 shares in two Executions) with a completed Close Review.
    await recordExit(app, trades.A, [X2A, X2B], { closeReasonId: reason, closeReview: await closeReviewDisposition(app, 'Complete') });
    // I6.4: one Trade closed under each Close Review disposition, and one still Planned.
    const dispositions: { kind: CloseReviewKind; symbol: string }[] = [{ kind: 'Complete', symbol: 'RST' }, { kind: 'Decline', symbol: 'UVW' }, { kind: 'Defer', symbol: 'XWV' }];
    for (const { kind, symbol } of dispositions) {
      const tradeId = await planStock(app, symbol, '50.00', '47.50', '56.00');
      await record(app, tradeId, { quantity: '100', price: '50.00', economicTime: PC1_TIME });
      await recordExit(app, tradeId, [{ quantity: '100', price: '52.00', economicTime: TUESDAY_1400, fee: '0.60' }], { closeReasonId: reason, closeReview: await closeReviewDisposition(app, kind) });
    }
    await planStock(app, 'PLN', '12.00', '11.00', '15.00');

    const databaseName = await currentDatabase(d.factory);
    const indexes = async () => ({
      byLifecycleTerminal: await readIndex(d.factory, databaseName, 'trades', 'byLifecycleTerminal'),
      byLifecycleActivity: await readIndex(d.factory, databaseName, 'trades', 'byLifecycleActivity'),
      journalObligations: workspaceStores(await dumpAll(d.factory))['journalObligations'],
    });
    const before = await views(app);
    const indexesBefore = await indexes();
    // The Workspace holds all three kinds of list and enough private state to make the comparison meaningful.
    expect((before.lists['Planned'] as { items: unknown[] }).items).toHaveLength(1);
    // Open: T-Q. Closed: T-A, T-K, T-L, T-M, T-N, T-P and the three Trades closed under each disposition.
    expect((before.lists['Open'] as { items: unknown[] }).items).toHaveLength(1);
    expect((before.lists['Closed'] as { items: unknown[] }).items).toHaveLength(9);
    expect(indexesBefore.byLifecycleTerminal).toHaveLength(9);
    expect((indexesBefore.journalObligations as unknown[]).length).toBeGreaterThan(9);

    app.persistence.close();
    await rebuildPrivateState(d.factory, databaseName);
    app = await restart(app, d);

    expect(await views(app)).toEqual(before);
    expect(await indexes()).toEqual(indexesBefore);
  }, 120_000);
});
