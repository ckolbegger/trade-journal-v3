// The bench build's generator entry point (D2 T2.20). Only `vite build --mode bench` reaches this
// module; the production bundle never imports it (`verify:no-fault-hooks` searches dist/ for the
// marker and `__tjBench`). It creates the plan's section 1.3 dataset through the production
// application facade on the real browser host, with seeded identities and a clock that starts at
// 2021-10-11 and moves forward with the generated Economic Times. While it runs, and only then,
// mutations skip the per-mutation readiness recheck (D1 A4, D2 section 6.0).
import { CAPACITY_REQUIREMENT } from '../delivery/capacity.ts';
import { browserHost } from '../delivery/browser-host.ts';
import { RELEASE_ID } from '../delivery/release-identity.ts';
import type { Clock } from '../domain/time/index.ts';
import { createWebLocksLifecycleLock, type IdGenerator } from '../persistence/index.ts';
import { BENCH_CLOCK_START, BENCH_GENERATOR_MARKER, BENCH_GENERATOR_VERSION, BENCH_PROFILE, BENCH_SEED, BENCH_TIME_ZONE, type BenchCounts } from './bench.ts';
import { createApplication } from './compose.ts';

// mulberry32: a small seeded generator, so every run produces the same identities.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// Version-4-shaped identities from the seeded generator.
function seededIds(seed: number): IdGenerator {
  const random = seededRandom(seed);
  const hex = (n: number) =>
    Array.from({ length: n }, () =>
      Math.floor(random() * 16)
        .toString(16)
        .toLowerCase(),
    ).join('');
  return { next: () => `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(random() * 4)]}${hex(3)}-${hex(12)}` };
}

const MINUTE = 60_000;
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z');

// Weekday sessions from the clock start: about five years of 252 sessions.
function sessionDays(count: number): number[] {
  const days: number[] = [];
  for (let day = Date.parse(BENCH_CLOCK_START.slice(0, 10)); days.length < count; day += DAY) {
    const weekday = new Date(day).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(day);
  }
  return days;
}

const SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO', 'COST', 'NFLX', 'CSCO', 'KO', 'PFE', 'JPM', 'V', 'MA', 'UNH', 'HD',
  'PG', 'XOM', 'CVX', 'LLY', 'ABBV', 'MRK', 'PEP', 'ADBE', 'CRM', 'ORCL', 'AMD', 'INTC', 'QCOM', 'TXN', 'WMT', 'DIS', 'NKE', 'MCD',
  'BA', 'CAT', 'DE', 'GS',
];
const PLAN_EMOTIONS = ['calm', 'eager', 'anxious', 'fomo', 'relieved'];
const DECISION_MODES = ['as-planned', 'deliberate-adjustment', 'reactive'];
const PC_EMOTIONS = ['calm', 'eager', 'anxious', 'relieved'];
// Each Open Trade has 1–3 Position Changes and each has 1–3 Executions: two of each on average.
const PATTERN = [1, 2, 3, 2] as const;
// The Open Trades' total entered quantity as tenths of the planned quantity: some still
// entering, most resolved at plan, some above plan (an Entry Size Excess).
const FILL_TENTHS = [10, 6, 10, 12, 10] as const;
// Every 125th Trade (from the 62nd) is opened, so Open Trades span the five years.
const OPEN_EVERY = BENCH_PROFILE.trades / BENCH_PROFILE.openTrades;
const OPEN_OFFSET = Math.floor(OPEN_EVERY / 2);

const cents = (value: number) => `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;

interface PlanEvent {
  readonly kind: 'Plan';
  readonly time: number;
  readonly index: number;
}
interface ChangeEvent {
  readonly kind: 'PositionChange';
  readonly time: number;
  readonly index: number;
  readonly sequence: number;
  readonly quantities: readonly number[];
}

// The whole dataset as a time-ordered list of Plan confirmations and Position Changes.
function schedule(): (PlanEvent | ChangeEvent)[] {
  const days = sessionDays(BENCH_PROFILE.sessions);
  const events: (PlanEvent | ChangeEvent)[] = [];
  let sequence = 0;
  let session = -1;
  let slot = 0;
  for (let index = 0; index < BENCH_PROFILE.trades; index++) {
    const s = Math.floor((index * BENCH_PROFILE.sessions) / BENCH_PROFILE.trades);
    slot = s === session ? slot + 1 : 0;
    session = s;
    events.push({ kind: 'Plan', time: days[s]! + 13 * 60 * MINUTE + 45 * MINUTE + slot * 15 * MINUTE, index });
    if (index % OPEN_EVERY !== OPEN_OFFSET) continue;
    const open = (index - OPEN_OFFSET) / OPEN_EVERY;
    const changes = PATTERN[open % PATTERN.length]!;
    const fills = Array.from({ length: changes }, (_, k) => PATTERN[(sequence + k) % PATTERN.length]!);
    const total = fills.reduce((a, b) => a + b, 0);
    const target = (plannedQuantity(index) * FILL_TENTHS[open % FILL_TENTHS.length]!) / 10;
    const base = Math.floor(target / total);
    let remainder = target - base * total;
    for (let k = 0; k < changes; k++) {
      const quantities = Array.from({ length: fills[k]! }, () => base + (remainder-- > 0 ? 1 : 0));
      events.push({ kind: 'PositionChange', time: days[s + 1 + k]! + 19 * 60 * MINUTE + 30 * MINUTE, index, sequence: sequence++, quantities });
    }
  }
  return events.sort((a, b) => a.time - b.time);
}

function plannedQuantity(index: number): number {
  return 10 * (5 + (index % 15));
}
function intendedEntryCents(index: number): number {
  return 2_000 + ((index * 7_919) % 38_000);
}

// Counts the stored Workspace's records directly, as provenance for `bench/dataset.json`.
async function countStored(): Promise<BenchCounts> {
  const open = (name: string) =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error(`open ${name} failed`));
    });
  const all = (db: IDBDatabase, store: string) =>
    new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const request = db.transaction(store).objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result as Record<string, unknown>[]);
      request.onerror = () => reject(request.error ?? new Error(`read ${store} failed`));
    });
  const root = await open('tj-root');
  const pointer = (await all(root, 'pointer')).find((r) => r.key === 'current') as { databaseName: string };
  root.close();
  const db = await open(pointer.databaseName);
  const trades = (await all(db, 'trades')) as { lifecycle: string; facts: { kind: string }[] }[];
  const entries = (await all(db, 'journalEntries')) as { entryTypeKey: string }[];
  const declines = await all(db, 'journalDeclines');
  const catalog = (await all(db, 'catalog')) as { kind: string }[];
  db.close();
  const facts = (kind: string) => trades.reduce((sum, t) => sum + t.facts.filter((f) => f.kind === kind).length, 0);
  const entriesOf = (key: string) => entries.filter((e) => e.entryTypeKey === key).length;
  const catalogOf = (kind: string) => catalog.filter((r) => r.kind === kind).length;
  return {
    trades: trades.length,
    openTrades: trades.filter((t) => t.lifecycle === 'Open').length,
    plannedTrades: trades.filter((t) => t.lifecycle === 'Planned').length,
    positionChanges: facts('PositionChange'),
    executions: facts('Execution'),
    planReflectionEntries: entriesOf('entry-type.plan-reflection'),
    positionChangeReflectionEntries: entriesOf('entry-type.position-change-reflection'),
    positionChangeReflectionDeclines: declines.length,
    institutions: catalogOf('Institution'),
    accounts: catalogOf('Account'),
    strategies: catalogOf('Strategy'),
  };
}

async function generate() {
  let now = BENCH_CLOCK_START;
  const clock: Clock = { now: () => now };
  let generating = true;
  const app = await createApplication({
    indexedDB: window.indexedDB,
    host: browserHost(),
    clock,
    ids: seededIds(BENCH_SEED),
    releaseId: RELEASE_ID,
    capacityRequirement: CAPACITY_REQUIREMENT,
    locks: createWebLocksLifecycleLock(navigator.locks),
    skipMutationRecheck: () => generating,
  });
  try {
    const initialized = await app.Workspace.initialize({ timeZone: BENCH_TIME_ZONE });
    if (initialized.kind !== 'Opened') throw new Error(`initialize: ${initialized.kind}`);

    const accounts: { id: string; recordRevision: number }[] = [];
    for (const [institutionLabel, accountLabels] of [
      ['Fidelity', ['Individual Brokerage', 'Roth IRA']],
      ['Charles Schwab', ['Joint Brokerage', 'Traditional IRA']],
      ['Interactive Brokers', ['Margin', 'Cash']],
    ] as const) {
      const institution = await app.ReferenceCatalog.save({ kind: 'CreateInstitution', label: institutionLabel });
      if (institution.kind !== 'Saved') throw new Error(`institution: ${institution.kind}`);
      for (const label of accountLabels) {
        const account = await app.ReferenceCatalog.save({ kind: 'CreateAccount', institutionId: institution.record.id, label });
        if (account.kind !== 'Saved') throw new Error(`account: ${account.kind}`);
        accounts.push(account.record);
      }
    }
    const strategies = await app.ReferenceCatalog.query({ family: 'Strategy' });
    const planDefinition = await app.Journal.getDefinitions({ latestFor: 'entry-type.plan-reflection' });
    const changeDefinition = await app.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
    if (strategies.kind !== 'Page' || planDefinition.kind !== 'Found' || changeDefinition.kind !== 'Found') throw new Error('seed missing');
    const strategy = strategies.items[0]!;

    const tradeIds: string[] = [];
    for (const event of schedule()) {
      // Authored five minutes after the event's Economic Time, so nothing is in the future.
      now = iso(event.time + 5 * MINUTE);
      const i = event.index;
      const symbol = SYMBOLS[i % SYMBOLS.length]!;
      const entry = intendedEntryCents(i);
      if (event.kind === 'Plan') {
        const account = accounts[i % accounts.length]!;
        const result = await app.TradeWorkflows.confirmPlan({
          accountId: account.id,
          accountRevision: account.recordRevision,
          strategyId: strategy.id,
          strategyRevision: strategy.recordRevision,
          economicTime: iso(event.time),
          plan: {
            underlying: symbol,
            legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol }, quantity: String(plannedQuantity(i)), intendedEntry: cents(entry) }],
            stops: [{ kind: 'UnderlyingPrice', price: cents(entry - Math.round(entry * 0.05)) }],
            targets: [{ kind: 'UnderlyingPrice', price: cents(entry + Math.round(entry * 0.12)) }],
          },
          reflection: {
            definitionId: planDefinition.definition.id,
            answers: {
              'prompt.plan-reflection.thesis': { kind: 'Text', text: `${symbol} reclaimed its 50-day average on rising volume after a tight base; plan ${i}.` },
              'prompt.plan-reflection.invalidation': { kind: 'Text', text: `A daily close back inside the base, below ${cents(entry - Math.round(entry * 0.05))}.` },
              'prompt.plan-reflection.conviction': { kind: 'Scale', value: 1 + (i % 5) },
              'prompt.plan-reflection.primary-emotion': { kind: 'Option', optionId: `option.plan-reflection.primary-emotion.${PLAN_EMOTIONS[i % PLAN_EMOTIONS.length]}` },
            },
          },
        });
        if (result.kind !== 'Confirmed') throw new Error(`plan ${i}: ${result.kind}`);
        tradeIds[i] = result.receipt.tradeId;
        if ((i + 1) % 2_500 === 0) console.log(`bench: ${i + 1} plans`);
        continue;
      }
      const tradeId = tradeIds[i]!;
      const n = event.sequence;
      const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
      if (detail.kind !== 'Ready') throw new Error(`trade ${i}: ${detail.kind}`);
      const members = event.quantities.map((quantity, j) => ({
        kind: 'Execution' as const,
        tradeId,
        action: 'Buy' as const,
        instrument: { kind: 'Stock' as const, symbol },
        intent: { kind: 'ServesPlannedLeg' as const, plannedLegId: detail.view.plan.legs[0]!.factId },
        quantity: String(quantity),
        price: cents(entry + ((n + j) % 21) - 10),
        fee: (n + j) % 3 === 0 ? '0' : '0.65',
        economicTime: iso(event.time + j * MINUTE),
      }));
      const definitionId = changeDefinition.definition.id;
      const reflection =
        n % 5 === 4
          ? { kind: 'Decline' as const, definitionId, ...(n % 2 === 0 && { reason: 'Filled during a fast open; no time to reflect.' }) }
          : {
              kind: 'Complete' as const,
              form: {
                definitionId,
                answers: {
                  'prompt.position-change-reflection.decision-mode': {
                    kind: 'Option' as const,
                    optionId: `option.position-change-reflection.decision-mode.${DECISION_MODES[n % DECISION_MODES.length]}`,
                  },
                  'prompt.position-change-reflection.primary-emotion': {
                    kind: 'Option' as const,
                    optionId: `option.position-change-reflection.primary-emotion.${PC_EMOTIONS[n % PC_EMOTIONS.length]}`,
                  },
                  'prompt.position-change-reflection.decision-confidence': { kind: 'Scale' as const, value: 1 + (n % 5) },
                  ...(n % 2 === 0 && {
                    'prompt.position-change-reflection.note': { kind: 'Text' as const, text: `Scaled in near the planned level on ${symbol}; entry ${n}.` },
                  }),
                },
              },
            };
      const recorded = await app.TradeWorkflows.recordPositionChange({
        originTradeId: tradeId,
        trades: [{ tradeId, expectedFactRevision: detail.view.factRevision }],
        members,
        reflection,
      });
      if (recorded.kind !== 'Recorded') throw new Error(`trade ${i} change ${n}: ${recorded.kind}`);
    }
  } finally {
    generating = false;
  }
  const open = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
  if (open.kind !== 'Ready') throw new Error(`browse Open: ${open.kind}`);
  return { generatorVersion: BENCH_GENERATOR_VERSION, counts: await countStored(), openItems: open.view.items };
}

declare global {
  interface Window {
    __tjBench?: {
      readonly marker: string;
      generate: typeof generate;
      count: typeof countStored;
    };
  }
}

export function installBenchGenerator(): void {
  window.__tjBench = { marker: BENCH_GENERATOR_MARKER, generate, count: countStored };
}
