// Runs in the browser under `measure:capacity`: confirms deterministic Plans through the
// production application facade on the engine's real IndexedDB and reports the storage growth.
// Readiness inputs come from NodeTestHost (no service worker here); storage is the real engine's.
import { createApplication } from '../../src/app/compose.ts';
import { randomIds } from '../../src/app/system.ts';
import { fixedClock } from '../../src/domain/time/index.ts';
import { nodeTestHost } from '../../tests/support/node-test-host.ts';

// NodeTestHost reports 10 GB of quota; the measurement does not depend on this requirement.
const READINESS_CAPACITY = { projectedWorkspaceBytes: 1, requiredQuotaBytes: 3 };

const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO', 'COST', 'NFLX'];

async function storeJsonBytes(name: string, store: string): Promise<{ bytes: number; count: number }> {
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
  const encoder = new TextEncoder();
  return { bytes: records.reduce<number>((sum, r) => sum + encoder.encode(JSON.stringify(r)).length, 0), count: records.length };
}

const usage = async () => (await navigator.storage.estimate()).usage ?? 0;

async function measure(plans: number) {
  const testHost = await nodeTestHost(indexedDB);
  const app = await createApplication({
    indexedDB,
    host: testHost.host,
    clock: fixedClock('2026-10-12T21:00:00Z'),
    ids: randomIds,
    releaseId: testHost.releaseId,
    capacityRequirement: READINESS_CAPACITY,
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

  const before = await usage();
  const tradesBefore = await storeJsonBytes(workspace, 'trades');
  const entriesBefore = await storeJsonBytes(workspace, 'journalEntries');
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
  }
  // Let the engine settle its files before the second estimate.
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  const after = await usage();
  const trades = await storeJsonBytes(workspace, 'trades');
  const entries = await storeJsonBytes(workspace, 'journalEntries');
  const catalog = await storeJsonBytes(workspace, 'catalog');

  const bytesPerTradeWithReflection = (after - before) / plans;
  const jsonBytesPerTradeWithReflection = (trades.bytes - tradesBefore.bytes + entries.bytes - entriesBefore.bytes) / plans;
  return {
    plans,
    usageBefore: before,
    usageAfter: after,
    bytesPerTradeWithReflection,
    jsonBytesPerTradeWithReflection,
    overheadRatio: bytesPerTradeWithReflection / jsonBytesPerTradeWithReflection,
    jsonBytesPerCatalogRecord: catalog.bytes / catalog.count,
  };
}

declare global {
  interface Window {
    measureCapacity?: typeof measure;
  }
}
window.measureCapacity = measure;
