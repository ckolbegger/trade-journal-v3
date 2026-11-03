// T6.25 query-count proof (AC-PERF-001, D6 A87, A88, A95): a Closed page issues one bounded getAll on the trades
// store's byLifecycleTerminal index; a Review `open` adds exactly one getAll on byLifecycleTerminal (the Trades
// closed after the cutoff) to D5's counts, plus one `get` per Trade in the owed-reflection group; and neither count
// moves with the number of Closed Trades in history. Counted as D5's T5.22 does, with the real facade on
// fake-indexeddb wrapped in the disclosed request counter (D2 section 6.0). The history is built cheaply: the
// Closed-Trade Review scenario is recorded through the facade once, and its Closed Trade is copied into the
// stored Workspace before any application opens it (raw fixture writes, as the integrity cases do), dated before
// every real Trade so the copies never join the Review's walk or owed group.
import { describe, expect, it } from 'vitest';
import { createApplication, type Application } from '../../../src/app/compose.ts';
import { fixedClock } from '../../../src/domain/time/index.ts';
import { activityDescOf } from '../../../src/persistence/index.ts';
import { dumpDatabases, loadDump, type WorkspaceDump } from '../../../tools/fixtures/workspace-fixture.ts';
import { countRequests, type CountedRequest } from '../../support/request-counter.ts';
import { TEST_CAPACITY } from '../../support/stack.ts';
import { closedScenario, device, TUESDAY_1700 } from './support.ts';

interface TradeRecord {
  tradeId: string;
  lifecycle: string;
  terminalTime?: string;
  terminalDesc?: string;
  lastActivity?: string;
  activityDesc?: string;
}

// The scenario's Workspace with `closed` Closed Trades in all: the scenario's own, plus copies of its first
// Closed Trade dated one second apart in 2020, an earlier terminal time than any real Trade's.
async function withClosedTrades(closed: number) {
  const { d, app } = await closedScenario();
  app.persistence.close();
  const databases = await dumpDatabases(d.factory);
  const name = Object.keys(databases).find((n) => n.startsWith('tj-ws-'))!;
  const records = databases[name]!.stores['trades']!.records as TradeRecord[];
  const template = records.find((r) => r.lifecycle === 'Closed')!;
  const copies: TradeRecord[] = [];
  const first = Date.UTC(2020, 0, 1);
  for (let n = records.filter((r) => r.lifecycle === 'Closed').length; n < closed; n++) {
    const time = new Date(first + n * 1000).toISOString().replace('.000Z', 'Z');
    copies.push({ ...structuredClone(template), tradeId: `copy-${n}`, terminalTime: time, terminalDesc: activityDescOf(time), lastActivity: time, activityDesc: activityDescOf(time) });
  }
  const dump = { schemaVersion: 0, generatorVersion: 0, asOf: TUESDAY_1700, databases } as unknown as WorkspaceDump;
  (databases[name]!.stores['trades']!.records as unknown as TradeRecord[]).push(...copies);
  const loaded = await device(await loadDump(dump), TUESDAY_1700, 'qc');
  const opened = await createApplication({
    indexedDB: loaded.factory,
    host: loaded.testHost.host,
    clock: fixedClock(TUESDAY_1700),
    ids: loaded.ids,
    releaseId: loaded.testHost.releaseId,
    capacityRequirement: TEST_CAPACITY,
    locks: loaded.locks,
  });
  return opened;
}

const on = (requests: readonly CountedRequest[], ...stores: string[]) => requests.filter((r) => stores.includes(r.store));
const TERMINAL = (count?: number) => ({ on: 'index', store: 'trades', index: 'byLifecycleTerminal', method: 'getAll', ...(count !== undefined && { count }) });

async function measure(closed: number) {
  const app: Application = await withClosedTrades(closed);
  const page = await countRequests(() => app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Closed' }));
  if (page.result.kind !== 'Ready') throw new Error(`browseTrades: ${page.result.kind}`);
  const review = await countRequests(() => app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 }));
  if (review.result.kind !== 'Ready') throw new Error(`open: ${review.result.kind}`);
  return { page, review };
}

describe('T6.25 query count: the Closed page and the Review open', () => {
  it('should issue one getAll on byLifecycleTerminal for a Closed page', { timeout: 600_000 }, async () => {
    const { page } = await measure(1_000);
    console.log(`query-count: Closed page ${JSON.stringify(page.requests)}`);
    expect(on(page.requests, 'trades')).toEqual([TERMINAL(51)]);
    expect(page.result.kind === 'Ready' && page.result.view.items.length).toBe(50);
  });

  it('should add exactly one getAll on byLifecycleTerminal and one get per owed Trade to D5 counts for a Review open', { timeout: 600_000 }, async () => {
    const { review } = await measure(1_000);
    console.log(`query-count: Review open ${JSON.stringify(review.requests)}`);
    const owed = review.result.kind === 'Ready' ? review.result.owed.length : 0;
    expect(owed).toBeGreaterThan(0);
    expect(on(review.requests, 'trades')).toEqual([
      { on: 'index', store: 'trades', index: 'byLifecycleActivity', method: 'getAll', count: 201 },
      TERMINAL(),
      ...Array.from({ length: owed }, () => ({ on: 'store', store: 'trades', method: 'get' })),
    ]);
  });

  it('should issue the same requests whether history holds 1,000 or 24,700 Closed Trades', { timeout: 1_800_000 }, async () => {
    const small = await measure(1_000);
    const large = await measure(24_700);
    expect(large.page.requests).toEqual(small.page.requests);
    expect(large.review.requests).toEqual(small.review.requests);
  });
});
