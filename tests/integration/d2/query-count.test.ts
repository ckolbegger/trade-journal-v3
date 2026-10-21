// T2.21 query-count proof (AC-PERF-001): the Open list reads one bounded batch of Trades, however
// many Planned Trades the Workspace holds. The real facade from createApplication on
// fake-indexeddb and NodeTestHost, with fake-indexeddb wrapped in the disclosed request counter
// (D2 section 6.0), which logs requests and changes no behavior.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { device, onboarded, planCommand } from '../d1/support.ts';
import { countRequests } from '../../support/request-counter.ts';

const OPEN_TRADES = 3;

async function confirmPlans(app: Application, count: number, prefix: string): Promise<string[]> {
  const command = await planCommand(app);
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const underlying = `${prefix}${i}`;
    const result = await app.TradeWorkflows.confirmPlan({
      ...command,
      plan: { ...command.plan, underlying, legs: [{ ...command.plan.legs[0]!, instrument: { kind: 'Stock', symbol: underlying } }] },
    });
    if (result.kind !== 'Confirmed') throw new Error(`plan ${underlying}: ${result.kind}`);
    ids.push(result.receipt.tradeId);
  }
  return ids;
}

// Opens a Planned Trade with one Execution of 60 against its 100-share plan, declining to reflect.
async function open(app: Application, tradeId: string) {
  const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
  const definition = await app.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  if (detail.kind !== 'Ready' || definition.kind !== 'Found') throw new Error('detail or definition missing');
  const leg = detail.view.plan.legs[0]!;
  const recorded = await app.TradeWorkflows.recordPositionChange({
    originTradeId: tradeId,
    trades: [{ tradeId, expectedFactRevision: detail.view.factRevision }],
    members: [
      {
        kind: 'Execution',
        tradeId,
        action: 'Buy',
        instrument: leg.instrument,
        intent: { kind: 'ServesPlannedLeg', plannedLegId: leg.factId },
        quantity: '60',
        price: '50.10',
        fee: '0.65',
        economicTime: '2026-10-12T13:45:00Z',
      },
    ],
    reflection: { kind: 'Decline', definitionId: definition.definition.id },
  });
  if (recorded.kind !== 'Recorded') throw new Error(`open ${tradeId}: ${JSON.stringify(recorded)}`);
}

async function openPage(app: Application) {
  return countRequests(() => app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' }));
}

describe('T2.21 query count: the Open list', () => {
  it('reads one page with one getAll on trades of count 201, and the same requests with 1,000 or 2,000 Planned Trades', { timeout: 600_000 }, async () => {
    const { app } = await onboarded(await device());
    for (const tradeId of await confirmPlans(app, OPEN_TRADES, 'OPEN')) await open(app, tradeId);
    await confirmPlans(app, 1_000, 'A');

    const atThousand = await openPage(app);
    if (atThousand.result.kind !== 'Ready') throw new Error(atThousand.result.kind);
    expect(atThousand.result.view.items).toHaveLength(OPEN_TRADES);
    const tradeReads = atThousand.requests.filter((r) => r.store === 'trades');
    expect(tradeReads).toEqual([{ on: 'index', store: 'trades', index: 'byLifecycleActivity', method: 'getAll', count: 201 }]);

    await confirmPlans(app, 1_000, 'B');

    const atTwoThousand = await openPage(app);
    if (atTwoThousand.result.kind !== 'Ready') throw new Error(atTwoThousand.result.kind);
    expect(atTwoThousand.result.view.items).toHaveLength(OPEN_TRADES);
    expect(atTwoThousand.requests).toEqual(atThousand.requests);

    console.log(`query-count: Open page requests ${JSON.stringify(atThousand.requests)}`);
  });
});
