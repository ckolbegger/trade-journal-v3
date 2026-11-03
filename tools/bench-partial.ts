// npm run bench:partial -- <dir>: prepares a PARTIAL benchmark dataset (D6 T6.25-P1), a generation stopped before its last
// session, for `bench:run -- --partial <dir>`. <dir> holds the untouched snapshot in `profile/`. This tool never writes to
// it. It copies the snapshot to `<dir>/run-profile/` (replacing any earlier copy), reads the stored records raw (the same way
// bench:run reads the Closed page), derives the dataset's expectations from them (tools/bench/partial.ts) and writes
// `<dir>/dataset.json`, marked `partial: true`. The copy has its service-worker registration and Cache Storage removed
// (a finished generation does this last), because the snapshot was taken mid-run.
import { cp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { BENCH_GENERATOR_VERSION, BENCH_TIME_ZONE } from '../src/app/bench.ts';
import { SCHEMA_VERSION } from '../src/persistence/schema.ts';
import { BENCH_PORT } from './bench/profile.ts';
import { countStored, lastSessionOf, reviewMembersOf, schemaMismatch, type StoredRows } from './bench/partial.ts';

const dir = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('usage: npm run bench:partial -- <dir>   (the directory holding profile/)');
const snapshot = path.join(dir, 'profile');
const runProfile = path.join(dir, 'run-profile');
await rm(runProfile, { recursive: true, force: true });
await cp(snapshot, runProfile, { recursive: true });

const origin = `http://localhost:${BENCH_PORT}`;
const blank = (context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>) =>
  context.route(`${origin}/**`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>partial</title>' }));

// Service workers are blocked in both contexts, so the snapshot's worker cannot answer the navigation (`context.route`
// does not see a worker's responses); the unregister and verify steps below still run.
const context = await chromium.launchPersistentContext(runProfile, { headless: true, serviceWorkers: 'block' });
let rows: StoredRows;
let storedSchema: unknown;
let underlyingOf: Record<string, string>;
let engine: string;
try {
  engine = `chromium ${context.browser()?.version() ?? ''}`.trim();
  await blank(context);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`${origin}/bench-partial`);
  const read = await page.evaluate(async () => {
    const asPromise = <T,>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => ((r.onsuccess = () => resolve(r.result)), (r.onerror = () => reject(r.error ?? new Error('request failed')))));
    const names = (await indexedDB.databases()).map((d) => d.name).filter((n): n is string => n?.startsWith('tj-ws-') === true);
    if (names.length !== 1) throw new Error(`expected one Workspace database, found ${names.length}`);
    const db = await asPromise(indexedDB.open(names[0]!));
    try {
      // Only the fields read below are typed; each store is projected to the rows of tools/bench/partial.ts in the page.
      const all = <T,>(store: string) => asPromise(db.transaction(store).objectStore(store).getAll() as IDBRequest<T[]>);
      const trades = (
        await all<{ tradeId: string; underlying: string; lifecycle: string; exposureStart?: string; terminalTime?: string; facts: { kind: string }[]; closeReasonFacts?: unknown[] }>('trades')
      ).map((t) => ({
        tradeId: t.tradeId,
        underlying: t.underlying,
        lifecycle: t.lifecycle,
        exposureStart: t.exposureStart,
        terminalTime: t.terminalTime,
        positionChanges: t.facts.filter((f) => f.kind === 'PositionChange').length,
        executions: t.facts.filter((f) => f.kind === 'Execution').length,
        closeReason: (t.closeReasonFacts?.length ?? 0) > 0,
      }));
      const entries = (
        await all<{ entryTypeKey: string; sourceKey: string; anchorTradeId: string; momentTime: string; authoredTime: string; versions?: unknown[]; origin?: { reviewDate?: string } }>('journalEntries')
      ).map((e) => ({
        entryTypeKey: e.entryTypeKey,
        sourceKey: e.sourceKey,
        anchorTradeId: e.anchorTradeId,
        momentTime: e.momentTime,
        authoredTime: e.authoredTime,
        versions: (e.versions ?? [null]).length,
        reviewDate: e.origin?.reviewDate,
      }));
      const declines = (await all<{ entryTypeKey: string }>('journalDeclines')).map((d) => ({ entryTypeKey: d.entryTypeKey }));
      const debts = (await all<{ anchorTradeId: string; entryTypeKey: string; versions: { status: string }[] }>('journalDebts')).map((d) => ({
        anchorTradeId: d.anchorTradeId,
        entryTypeKey: d.entryTypeKey,
        status: d.versions.at(-1)!.status,
      }));
      const observations = (await all<{ instrumentKey: string; tradingDate: string; marks: { intention: string }[] }>('observations')).map((o) => ({
        instrumentKey: o.instrumentKey,
        tradingDate: o.tradingDate,
        marks: o.marks.length,
        corrections: o.marks.filter((m) => m.intention !== 'InitialManual').length,
      }));
      // The schema record the app keeps in the Workspace's meta store (persistence.ts).
      const schema = await asPromise(db.transaction('meta').objectStore('meta').get('schema') as IDBRequest<{ schemaVersion?: unknown } | undefined>);
      return { trades, entries, declines, debts, observations, schemaVersion: schema?.schemaVersion };
    } finally {
      db.close();
    }
  });
  storedSchema = read.schemaVersion;
  const mismatch = schemaMismatch(storedSchema, SCHEMA_VERSION);
  if (mismatch) throw new Error(`bench:partial refuses the snapshot: ${mismatch}`);
  rows = read;
  underlyingOf = Object.fromEntries(read.trades.map((t) => [t.tradeId, t.underlying]));

  // Leave only data: no service-worker registration and no Cache Storage (a bench build's worker would otherwise
  // answer for the production build the harness serves on this origin).
  await page.evaluate(async () => {
    for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
    for (const key of await caches.keys()) await caches.delete(key);
  });
} finally {
  await context.close();
}
const check = await chromium.launchPersistentContext(runProfile, { headless: true, serviceWorkers: 'block' });
try {
  await blank(check);
  const page = check.pages()[0] ?? (await check.newPage());
  await page.goto(`${origin}/bench-partial`);
  const left = await page.evaluate(async () => ({ registrations: (await navigator.serviceWorker.getRegistrations()).length, caches: (await caches.keys()).length }));
  if (left.registrations !== 0 || left.caches !== 0) throw new Error(`the run profile still holds ${left.registrations} registrations and ${left.caches} caches`);
} finally {
  await check.close();
}

const counts = countStored(rows);
const last = lastSessionOf(rows);
const members = reviewMembersOf(rows, last);
const identity = (id: string) => `${id} ${underlyingOf[id]}`;
const outstandingUnderlyings = [...new Set(rows.debts.filter((d) => d.status === 'Outstanding').map((d) => underlyingOf[d.anchorTradeId]!))].sort();
if (counts.openTrades === 0) throw new Error('the snapshot holds no Open Trade');

const dataset = {
  partial: true,
  sessions: counts.sessions,
  generatorVersion: BENCH_GENERATOR_VERSION,
  // Read from the snapshot's stored schema record (equal to SCHEMA_VERSION, or the tool refused above).
  schemaVersion: storedSchema,
  timeZone: BENCH_TIME_ZONE,
  origin,
  asOf: last.asOf,
  reviewDate: last.reviewDate,
  cutoff: last.cutoff,
  missingInstruments: members.missingInstruments,
  counts,
  // Membership only: the walk is attention-ranked, so the order is the first rendered Review's (bench:run records it).
  walkIdentities: members.walk.map(identity).sort(),
  owedIdentities: members.owed.map(identity).sort(),
  openUnderlyings: members.openUnderlyings,
  // The walked Trades whose Action for the Review Date is already saved (the Review stopped part-way), so their cards can be
  // edited as a full dataset's can; and the Underlyings of every Outstanding Debt's Trade.
  actionedTradeIds: members.actionedWalk,
  outstandingUnderlyings,
  snapshotDir: path.relative(process.cwd(), snapshot),
  runProfileDir: path.relative(process.cwd(), runProfile),
  derivedAt: new Date().toISOString(),
  engine,
  host: { platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model ?? 'unknown', cores: os.cpus().length },
};
await writeFile(path.join(dir, 'dataset.json'), `${JSON.stringify(dataset, null, 2)}\n`);
console.log(`bench:partial OK: ${counts.sessions} sessions to ${last.reviewDate} (as-of ${last.asOf}); ${counts.trades} Trades (${counts.openTrades} Open, ${counts.closedTrades} Closed, ${counts.plannedTrades} Planned); walk ${members.walk.length}, owed ${members.owed.length}, ${members.actionedWalk.length} Actions on the Review Date; wrote ${path.join(dir, 'dataset.json')}`);
