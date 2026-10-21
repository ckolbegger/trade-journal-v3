// Runs in the browser under `measure:capacity`: confirms deterministic Plans, then opens some of
// them with Position Changes (D2 plan, section 1.3), through the production application facade
// on the engine's real IndexedDB, and reports the storage growth of each phase.
// Readiness inputs come from NodeTestHost (no service worker here); storage is the real engine's.
import { createApplication } from '../../src/app/compose.ts';
import { createWebLocksLifecycleLock } from '../../src/persistence/index.ts';
import { randomIds } from '../../src/app/system.ts';
import { fixedClock } from '../../src/domain/time/index.ts';
import { nodeTestHost } from '../../tests/support/node-test-host.ts';

// NodeTestHost reports 10 GB of quota; the measurement does not depend on this requirement.
const READINESS_CAPACITY = { projectedWorkspaceBytes: 1, requiredQuotaBytes: 3 };

const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO', 'COST', 'NFLX'];

async function storeRecords(name: string, store: string): Promise<unknown[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(name);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('open failed'));
  });
  const records = await new Promise<unknown[]>((resolve) => {
    const request = db.transaction(store).objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
  });
  db.close();
  return records;
}

const encoder = new TextEncoder();
const jsonBytes = (records: readonly unknown[]) => records.reduce<number>((sum, r) => sum + encoder.encode(JSON.stringify(r)).length, 0);

async function storeJsonBytes(name: string, store: string): Promise<{ bytes: number; count: number }> {
  const records = await storeRecords(name, store);
  return { bytes: jsonBytes(records), count: records.length };
}

// Stores a reflection outcome writes: its Entry or decline and its obligation record (Plan
// Reflections have obligation records too since D2).
const REFLECTION_STORES = ['journalEntries', 'journalDeclines', 'journalObligations'] as const;
async function reflectionJsonBytes(name: string): Promise<number> {
  let sum = 0;
  for (const store of REFLECTION_STORES) sum += (await storeJsonBytes(name, store)).bytes;
  return sum;
}

// Executions live inside the Trade document as facts; their share of it is their own JSON.
async function executionJsonBytes(name: string): Promise<{ bytes: number; count: number }> {
  const trades = (await storeRecords(name, 'trades')) as { facts: { kind: string }[] }[];
  const executions = trades.flatMap((t) => t.facts.filter((f) => f.kind === 'Execution'));
  return { bytes: jsonBytes(executions), count: executions.length };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 2_000));

// Section 1.3 at D2: each Open Trade has 1–3 Position Changes, each with 1–3 Executions (about two
// of each on average), and about 80% of the reflections are Entries and 20% declines.
const PATTERN = [1, 2, 3, 2] as const;

const usage = async () => (await navigator.storage.estimate()).usage ?? 0;

async function measure(plans: number, openTrades: number) {
  const testHost = await nodeTestHost(indexedDB);
  const app = await createApplication({
    indexedDB,
    host: testHost.host,
    clock: fixedClock('2026-10-12T21:00:00Z'),
    ids: randomIds,
    releaseId: testHost.releaseId,
    capacityRequirement: READINESS_CAPACITY,
    locks: createWebLocksLifecycleLock(navigator.locks),
  });
  await app.Workspace.initialize({ timeZone: 'America/New_York' });
  const institution = await app.ReferenceCatalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
  if (institution.kind !== 'Saved') throw new Error('institution not saved');
  const account = await app.ReferenceCatalog.save({ kind: 'CreateAccount', institutionId: institution.record.id, label: 'Individual Brokerage' });
  if (account.kind !== 'Saved') throw new Error('account not saved');
  const strategies = await app.ReferenceCatalog.query({ family: 'Strategy' });
  const definition = await app.Journal.getDefinitions({ latestFor: 'entry-type.plan-reflection' });
  if (strategies.kind !== 'Page' || definition.kind !== 'Found') throw new Error('seed missing');
  const strategy = strategies.items[0]!;
  const workspace = (await indexedDB.databases()).find((d) => d.name?.startsWith('tj-ws-'))!.name!;

  const pcDefinition = await app.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  if (pcDefinition.kind !== 'Found') throw new Error('Position Change Reflection definition missing');
  const tradeIds: string[] = [];

  const before = await usage();
  const tradesBefore = await storeJsonBytes(workspace, 'trades');
  const journalBefore = await reflectionJsonBytes(workspace);
  for (let i = 0; i < plans; i++) {
    const symbol = SYMBOLS[i % SYMBOLS.length]!;
    const entry = 40 + (i % 160);
    const result = await app.TradeWorkflows.confirmPlan({
      accountId: account.record.id,
      accountRevision: account.record.recordRevision,
      strategyId: strategy.id,
      strategyRevision: strategy.recordRevision,
      economicTime: new Date(Date.UTC(2026, 0, 2) + i * 3_600_000).toISOString().replace('.000Z', 'Z'),
      plan: {
        underlying: symbol,
        legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol }, quantity: String(10 + (i % 90)), intendedEntry: `${entry}.25` }],
        stops: [{ kind: 'UnderlyingPrice', price: `${entry - 3}.10` }],
        targets: [{ kind: 'UnderlyingPrice', price: `${entry + 6}.80` }],
      },
      reflection: {
        definitionId: definition.definition.id,
        answers: {
          'prompt.plan-reflection.thesis': { kind: 'Text', text: `${symbol} reclaimed its 50-day average on rising volume after a tight two-week base; plan ${i}.` },
          'prompt.plan-reflection.invalidation': { kind: 'Text', text: `A daily close back inside the base, below ${entry - 3}.10.` },
          'prompt.plan-reflection.conviction': { kind: 'Scale', value: 1 + (i % 5) },
          'prompt.plan-reflection.primary-emotion': { kind: 'Option', optionId: 'option.plan-reflection.primary-emotion.calm' },
        },
      },
    });
    if (result.kind !== 'Confirmed') throw new Error(`plan ${i}: ${result.kind}`);
    tradeIds.push(result.receipt.tradeId);
  }
  // Let the engine settle its files before the second estimate.
  await settle();
  const after = await usage();
  const trades = await storeJsonBytes(workspace, 'trades');
  const journal = await reflectionJsonBytes(workspace);
  const catalog = await storeJsonBytes(workspace, 'catalog');

  const bytesPerTradeWithReflection = (after - before) / plans;
  const jsonBytesPerTradeWithReflection = (trades.bytes - tradesBefore.bytes + journal - journalBefore) / plans;

  // Second phase: open the first `openTrades` Plans with Position Changes and their reflections.
  const executionsBefore = await executionJsonBytes(workspace);
  let positionChanges = 0;
  let declines = 0;
  for (let i = 0; i < openTrades; i++) {
    const tradeId = tradeIds[i]!;
    const symbol = SYMBOLS[i % SYMBOLS.length]!;
    const planTime = Date.UTC(2026, 0, 2) + i * 3_600_000;
    for (let k = 0; k < PATTERN[i % PATTERN.length]!; k++) {
      const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
      if (detail.kind !== 'Ready') throw new Error(`trade ${i}: ${detail.kind}`);
      const n = positionChanges++;
      const fills = PATTERN[n % PATTERN.length]!;
      const members = Array.from({ length: fills }, (_, j) => ({
        kind: 'Execution' as const,
        tradeId,
        action: 'Buy' as const,
        instrument: { kind: 'Stock' as const, symbol },
        intent: { kind: 'ServesPlannedLeg' as const, plannedLegId: detail.view.plan.legs[0]!.factId },
        quantity: '1',
        price: `${40 + (i % 160)}.${String(10 + ((n + j) % 90)).padStart(2, '0')}`,
        fee: '0.65',
        economicTime: new Date(planTime + (k + 1) * 86_400_000 + j * 60_000).toISOString().replace('.000Z', 'Z'),
      }));
      const decline = n % 5 === 4;
      if (decline) declines++;
      const reflection = decline
        ? {
            kind: 'Decline' as const,
            definitionId: pcDefinition.definition.id,
            ...(n % 2 === 0 && { reason: 'Filled during a fast open; no time to reflect.' }),
          }
        : {
            kind: 'Complete' as const,
            form: {
              definitionId: pcDefinition.definition.id,
              answers: {
                'prompt.position-change-reflection.decision-mode': {
                  kind: 'Option' as const,
                  optionId: 'option.position-change-reflection.decision-mode.as-planned',
                },
                'prompt.position-change-reflection.primary-emotion': {
                  kind: 'Option' as const,
                  optionId: 'option.position-change-reflection.primary-emotion.calm',
                },
                'prompt.position-change-reflection.decision-confidence': { kind: 'Scale' as const, value: 1 + (n % 5) },
                ...(n % 2 === 0 && {
                  'prompt.position-change-reflection.note': {
                    kind: 'Text' as const,
                    text: `Scaled in at the planned level on ${symbol}; entry ${n}.`,
                  },
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
      if (recorded.kind !== 'Recorded') throw new Error(`trade ${i} change ${k}: ${recorded.kind}`);
    }
  }
  await settle();
  const afterOpen = await usage();
  const tradesOpen = await storeJsonBytes(workspace, 'trades');
  const executions = await executionJsonBytes(workspace);
  const reflectionAfter = await reflectionJsonBytes(workspace);

  // The phase's on-disk bytes per JSON byte, as D1 measured the Plan phase; each kind's share of
  // the phase is its own JSON. The Trade document's growth beyond its Executions (the Position
  // Change fact, Last Activity, counters, any recorded Deviations) is the Position Change's.
  const jsonBytesPerExecution = (executions.bytes - executionsBefore.bytes) / (executions.count - executionsBefore.count);
  const jsonBytesPerPositionChange = (tradesOpen.bytes - trades.bytes - (executions.bytes - executionsBefore.bytes)) / positionChanges;
  const jsonBytesPerPositionChangeReflection = (reflectionAfter - journal) / positionChanges;
  const positionChangeOverheadRatio = (afterOpen - after) / (tradesOpen.bytes - trades.bytes + reflectionAfter - journal);
  return {
    plans,
    usageBefore: before,
    usageAfter: after,
    bytesPerTradeWithReflection,
    jsonBytesPerTradeWithReflection,
    overheadRatio: bytesPerTradeWithReflection / jsonBytesPerTradeWithReflection,
    jsonBytesPerCatalogRecord: catalog.bytes / catalog.count,
    openTrades,
    positionChanges,
    executions: executions.count - executionsBefore.count,
    reflectionEntries: positionChanges - declines,
    reflectionDeclines: declines,
    usageAfterOpen: afterOpen,
    positionChangeOverheadRatio,
    jsonBytesPerPositionChange,
    jsonBytesPerExecution,
    jsonBytesPerPositionChangeReflection,
    bytesPerPositionChange: jsonBytesPerPositionChange * positionChangeOverheadRatio,
    bytesPerExecution: jsonBytesPerExecution * positionChangeOverheadRatio,
    bytesPerPositionChangeReflection: jsonBytesPerPositionChangeReflection * positionChangeOverheadRatio,
  };
}

declare global {
  interface Window {
    measureCapacity?: typeof measure;
  }
}
window.measureCapacity = measure;
