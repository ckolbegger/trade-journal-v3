// Workspace Restore: preparation of a candidate and its atomic apply (D8 A132-A138). T8.23
// freezes the signatures; the Restore tasks build the bodies.
import { z } from 'zod';
import { ArtifactReadError, canonicalJson, readArtifact, SECTION_OF_STORE } from '../../backup/format/index.ts';
import basis from '../../delivery/capacity-basis.json' with { type: 'json' };
import { toRuntimeNotWritable } from '../../delivery/write-gate.ts';
import { toWorkspaceLocal } from '../../domain/time/index.ts';
import type { IntegrityFinding } from '../../domain/trade-analysis/index.ts';
import { plannedTradeSummary } from '../../domain/trade-summary.ts';
import { formatDecimal, type Rational } from '../../domain/values/index.ts';
import {
  D6_JOURNAL_MANIFEST,
  applyPreparedRestore as applyJournal,
  exportSnapshot as exportJournal,
  measureCandidateSection as measureJournal,
  prepareJournalSeed,
  prepareRestore as prepareJournalRestore,
  type CandidateSectionMeta,
  type EntryDefinitionRecord,
  type JournalTypeRecord,
} from '../../modules/journal/index.ts';
import { applyPreparedRestore as applyMarketData, exportSnapshot as exportMarketData, measureCandidateSection as measureMarketData, prepareRestore as prepareMarketDataRestore, type MarketDataDeps } from '../../modules/market-data/index.ts';
import {
  applyPreparedRestore as applyCatalog,
  D7_CATALOG_MANIFEST,
  exportSnapshot as exportCatalog,
  measureCandidateSection as measureCatalog,
  prepareRestore as prepareCatalogRestore,
  prepareSeed,
  type CatalogRecord,
} from '../../modules/reference-catalog/index.ts';
import {
  analysisInputOf,
  applyPreparedRestore as applyTrades,
  exportSnapshot as exportTrades,
  measureCandidateSection as measureTrades,
  prepareRestore as prepareTradeRestore,
  repairedDocument,
  type TradeDocument,
} from '../../modules/trade-record/index.ts';
import { migrationChain, SCHEMA_VERSION, type LifecycleLock, type RecordSource, type StoreRecord, type WorkspaceStore } from '../../persistence/index.ts';
import type {
  ApplyPreparedRestoreRequest,
  ApplyRestoreOutcome,
  FailureDetail,
  PrepareRestoreRequest,
  PrepareRestoreResult,
  RestoreCounts,
  RestoreIssue,
  RestoreMigrations,
  RestoreRepair,
  RestoreWarning,
  TargetBinding,
  WorkspaceReplaced,
} from './backup-types.ts';
import { keyOf } from '../../persistence/schema.ts';
import { describeError, KNOWN_SECTIONS } from './backup-export.ts';

import type { BackupDeps, BackupOperations } from './backup.ts';

// What Restore needs: the backup dependencies, the lifecycle lock, the release's session policy for
// the Market Data validator, and a way to read the fresh status that the Restored result carries
// (S is the WorkspaceStatus; Workspace passes its own getStatus).
export interface RestoreDeps<S> extends BackupDeps {
  readonly locks: LifecycleLock;
  readonly sessionPolicy: MarketDataDeps['sessionPolicy'];
  readonly status: () => Promise<S>;
  readonly restoreHooks?: RestoreStageHooks;
}

// Called at Restore stage boundaries. Production passes none; T8.15's faults build hooks here.
export interface RestoreStageHooks {
  // Preparation has staged the records into the candidate; resolving lets it go on.
  readonly staged?: () => Promise<void>;
  // Given the stores of the module being rechecked, names one the recheck reports as changed.
  readonly recheck?: (stores: readonly string[]) => string | undefined;
  // Runs inside the root activation transaction after its writes; a throw aborts it.
  readonly activating?: () => void;
  // The pointer has switched; resolving lets apply go on to the readiness rerun.
  readonly activated?: () => Promise<void>;
}

export interface RestoreOperations<S> {
  prepareRestore(request: PrepareRestoreRequest): Promise<PrepareRestoreResult>;
  applyPreparedRestore(request: ApplyPreparedRestoreRequest): Promise<ApplyRestoreOutcome<S>>;
}

// Records per batch parsed and written to the candidate (A132 step 5).
const BATCH_SIZE = 500;

const countsShape = z.record(z.string(), z.number());
const headerShape = z.object({
  formatVersion: z.number(),
  schemaVersion: z.number(),
  exportKind: z.enum(['Normal', 'BlockedDatabase']),
  createdAt: z.string(),
  releaseId: z.string(),
  counts: countsShape,
});
const sectionEndShape = z.object({ section: z.string(), counts: countsShape, digest: z.string() });
const manifestShape = z.object({ footprint: z.array(z.string()), counts: countsShape, sectionDigests: z.record(z.string(), z.string()), fullDigest: z.string() });

// The one artifact line layout this release reads (A123).
const FORMAT_VERSION = 1;
// The issues a rejection lists (A134).
const MAX_ISSUES = 200;

// The most any measured engine stored per record, from the capacity basis (A138). A Trade is measured
// with its reflection, which the Journal stores count again, so the projection errs on the high side.
const peak = (field: string): number => Math.max(...(basis.engines as unknown as Record<string, number>[]).map((engine) => engine[field] ?? 0));
const catalogBytes = peak('jsonBytesPerCatalogRecord') * peak('overheadRatio');
const BYTES_PER_RECORD: Readonly<Record<string, number>> = {
  catalog: catalogBytes,
  journalTypes: catalogBytes,
  journalDefinitions: catalogBytes,
  observations: peak('bytesPerMark'),
  trades: peak('bytesPerTradeWithReflection'),
  journalEntries: peak('bytesPerReflectionCompletedAtCapture'),
  journalDeclines: peak('bytesPerReflectionDeclinedAtCapture'),
  journalDebts: peak('bytesPerDebtAnswered'),
};

// The rejection of an artifact, its log detail naming the first issue by code, section, line and path, never a record value.
function rejected(issues: readonly RestoreIssue[], liveBinding: TargetBinding): PrepareRestoreResult {
  const first = issues[0];
  const detail: FailureDetail | undefined = first && {
    stage: 'Prepare',
    name: first.code,
    message: `The backup was rejected with ${issues.length} issue${issues.length === 1 ? '' : 's'}`,
    context: {
      code: first.code,
      totalIssues: issues.length,
      ...(first.section !== undefined && { section: first.section }),
      ...(first.line !== undefined && { line: first.line }),
      ...(first.path !== undefined && { path: first.path }),
    },
  };
  return { kind: 'Rejected', issues: issues.slice(0, MAX_ISSUES), totalIssues: issues.length, liveBinding, ...(detail && { detail }) };
}

// Text that is not UTF-8 is not a backup at all, so its format is unsupported; an artifact the reader
// could not read to its end is incomplete. Any other error is not the file's.
function readFailure(error: unknown): RestoreIssue {
  if (!(error instanceof ArtifactReadError)) throw error;
  return { code: error.reason === 'NotUtf8' ? 'UnsupportedFormat' : 'IncompleteArtifact' };
}

function sameCounts(a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>): boolean {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].every((key) => (a[key] ?? 0) === (b[key] ?? 0));
}

type JournalStore = 'journalTypes' | 'journalDefinitions' | 'journalEntries' | 'journalDeclines' | 'journalDebts';

async function collect(source: RecordSource, store: WorkspaceStore): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = [];
  for await (const batch of source.batches(store)) records.push(...batch);
  return records;
}

// A quantity as decimal text without trailing zeros: 20 as "20".
const decimalText = (value: Rational): string => formatDecimal(value, 6).replace(/\.?0+$/, '');

// One integrity finding as a repair line: the stored and the expected value (decision 23).
function repairText(finding: IntegrityFinding): Pick<RestoreRepair, 'kind' | 'stored' | 'expected'> {
  if (finding.kind === 'LifecycleDisagreement') return { kind: 'Lifecycle', stored: finding.stored, expected: finding.expected };
  if (finding.kind === 'DeviationMissing') return { kind: 'EntrySizeDeviation', stored: 'None', expected: decimalText(finding.expected.quantityAbovePlan ?? finding.expected.quantityBelowPlan) };
  if (finding.kind === 'DeviationQuantityDisagreement') return { kind: 'EntrySizeDeviation', stored: decimalText(finding.recorded), expected: decimalText(finding.expected) };
  return { kind: 'EntrySizeDeviation', stored: 'Recorded', expected: 'None' };
}

// Journal Entries, declines and Debts originate in a fact of a Trade (a Plan or a Position Change; a Daily
// Review's origin is the Trade itself, closed by its Anchor); one whose fact is in no Trade is a
// reference the Trade section does not close. The fact must be one of the record's own anchor Trade and
// of the kind the origin declares.
async function danglingOrigins(source: RecordSource): Promise<RestoreIssue[]> {
  // Each Trade's fact kinds by fact identity.
  const factKinds = new Map<string, Map<string, string>>();
  for await (const batch of source.batches('trades')) {
    for (const trade of batch as unknown as readonly { tradeId: string; facts: { factId: string; kind: string }[]; closeReasonFacts?: { factId: string; kind: string }[] }[]) {
      factKinds.set(trade.tradeId, new Map([...trade.facts, ...(trade.closeReasonFacts ?? [])].map((fact) => [fact.factId, fact.kind])));
    }
  }
  const dangling: RestoreIssue[] = [];
  for (const store of ['journalEntries', 'journalDeclines', 'journalDebts'] as const) {
    for await (const batch of source.batches(store)) {
      for (const record of batch as unknown as readonly { anchor: { tradeId: string }; origin: { kind: string; factId: string } }[]) {
        if (record.origin.kind !== 'DailyReview' && factKinds.get(record.anchor.tradeId)?.get(record.origin.factId) !== record.origin.kind) dangling.push({ code: 'CrossSectionReference', kind: record.origin.kind, identity: record.origin.factId });
      }
    }
  }
  return dangling;
}

// A Trade naming a Strategy the Catalog section lacks is a cross-section reference the Trade section does not
// report. The Strategy is per Trade, whatever its number of legs.
async function danglingStrategies(source: RecordSource, strategyIds: ReadonlySet<string>): Promise<RestoreIssue[]> {
  const dangling: RestoreIssue[] = [];
  for await (const batch of source.batches('trades')) {
    for (const trade of batch as unknown as readonly { strategyId: string }[]) {
      if (!strategyIds.has(trade.strategyId)) dangling.push({ code: 'CrossSectionReference', kind: 'Strategy', identity: trade.strategyId });
    }
  }
  return dangling;
}

interface StoredVersions {
  readonly versions: readonly { readonly status?: string }[];
}

const bump = (counts: Record<string, number>, key: string): void => {
  counts[key] = (counts[key] ?? 0) + 1;
};

// What preparation measured and reported (A132 step 11), held in memory by candidate until apply rechecks the candidate against it.
interface PreparedRecord {
  readonly sections: Record<'catalog' | 'marketData' | 'trades' | 'journal', CandidateSectionMeta>;
  readonly counts: RestoreCounts;
  readonly migrations: RestoreMigrations;
  readonly repairs: readonly RestoreRepair[];
  // The Workspace section: every other `meta` record (time-zone settings, session policy, revisions), as canonical text.
  readonly workspaceDigest: string;
}

// What the candidate's Workspace section holds now, so that apply can tell a change since preparation.
async function workspaceDigestOf(source: RecordSource): Promise<string> {
  const records = await collect(source, 'meta');
  return canonicalJson(records.sort((a, b) => String(a['key']).localeCompare(String(b['key']))));
}

// Tells every other tab of this app that a Restore replaced the journal (A136) over the channel the update notice shares (D1 A5).
function announceReplaced(databaseName: string): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel('tj-updates');
  channel.postMessage({ kind: 'WorkspaceReplaced', databaseName } satisfies WorkspaceReplaced);
  channel.close();
}

const sameBinding =(a: { databaseName: string; contentRevision: number }, b: { databaseName: string; contentRevision: number }): boolean =>
  a.databaseName === b.databaseName && a.contentRevision === b.contentRevision;

// The preview's counts of a database's records, and whether it holds user data (A137), read store
// by store in batches.
async function countsOf(source: RecordSource): Promise<{ readonly counts: RestoreCounts; readonly hasUserData: boolean }> {
  const tradesByLifecycle: Record<'Planned' | 'Open' | 'Closed', number> = { Planned: 0, Open: 0, Closed: 0 };
  let trades = 0;
  let positionChanges = 0;
  let executions = 0;
  let expirations = 0;
  let deviationOccurrences = 0;
  let tradeVersions = 0;
  for await (const batch of source.batches('trades')) {
    for (const trade of batch as unknown as readonly { lifecycle: 'Planned' | 'Open' | 'Closed'; facts: (StoredVersions & { kind: string })[]; closeReasonFacts?: StoredVersions[]; deviations?: unknown[] }[]) {
      trades += 1;
      tradesByLifecycle[trade.lifecycle] += 1;
      deviationOccurrences += trade.deviations?.length ?? 0;
      for (const fact of trade.facts) {
        if (fact.kind === 'PositionChange') positionChanges += 1;
        if (fact.kind === 'Execution') executions += 1;
        if (fact.kind === 'Expiration') expirations += 1;
        tradeVersions += fact.versions.length;
      }
      for (const fact of trade.closeReasonFacts ?? []) tradeVersions += fact.versions.length;
    }
  }
  const entriesByType: Record<string, number> = {};
  let entries = 0;
  let entryVersions = 0;
  for await (const batch of source.batches('journalEntries')) {
    for (const entry of batch as unknown as readonly (StoredVersions & { entryTypeKey: string })[]) {
      entries += 1;
      entryVersions += entry.versions.length;
      bump(entriesByType, entry.entryTypeKey);
    }
  }
  let declines = 0;
  for await (const batch of source.batches('journalDeclines')) declines += batch.length;
  const debtsByStatus: Record<string, number> = {};
  let debts = 0;
  let debtVersions = 0;
  for await (const batch of source.batches('journalDebts')) {
    for (const debt of batch as unknown as readonly StoredVersions[]) {
      debts += 1;
      debtVersions += debt.versions.length;
      bump(debtsByStatus, debt.versions.at(-1)!.status as string);
    }
  }
  let observations = 0;
  let marks = 0;
  let acknowledgments = 0;
  for await (const batch of source.batches('observations')) {
    for (const observation of batch as unknown as readonly { marks: unknown[]; acknowledgments: unknown[] }[]) {
      observations += 1;
      marks += observation.marks.length;
      acknowledgments += observation.acknowledgments.length;
    }
  }
  const catalog: Record<string, number> = {};
  for await (const batch of source.batches('catalog')) for (const record of batch) bump(catalog, record['kind'] as string);
  let entryDefinitionRevisions = 0;
  for await (const batch of source.batches('journalDefinitions')) entryDefinitionRevisions += batch.length;
  const counts: RestoreCounts = {
    tradesByLifecycle,
    positionChanges,
    executions,
    expirations,
    deviationOccurrences,
    entriesByType,
    declines,
    debtsByStatus,
    marks,
    acknowledgments,
    institutions: catalog['Institution'] ?? 0,
    accounts: catalog['Account'] ?? 0,
    strategies: catalog['Strategy'] ?? 0,
    closeReasons: catalog['CloseReason'] ?? 0,
    entryDefinitionRevisions,
    versions: { trades: tradeVersions, entries: entryVersions, debts: debtVersions },
  };
  return { counts, hasUserData: trades + entries + declines + debts + observations + counts.institutions + counts.accounts > 0 };
}

// The backup operations are passed in for their receipt registry (A131).
export function createRestoreOperations<S>(deps: RestoreDeps<S>, backup: BackupOperations): RestoreOperations<S> {
  const { persistence } = deps;
  // The results of each preparation this instance made, by candidate. A candidate never survives a restart, so nothing is persisted.
  const held = new Map<string, PreparedRecord>();
  const catalogRestore = prepareCatalogRestore({ manifest: D7_CATALOG_MANIFEST });
  const marketDataRestore = prepareMarketDataRestore({ policy: deps.sessionPolicy });
  const journalRestore = prepareJournalRestore();
  // Parsing reads no references, so the Trade preparation used for it holds none.
  const tradeRestore = prepareTradeRestore({ references: { accountIds: new Set(), anchorTradeIds: new Set(), closeReasonIds: new Set(), strategyShapes: new Map() } });

  const dropCandidate = async (candidate: string): Promise<void> => {
    held.delete(candidate);
    await persistence.discardCandidate(candidate);
  };

  // The live Workspace's binding, or NoWorkspace when none exists.
  async function liveBinding(): Promise<TargetBinding> {
    const inspection = await persistence.lookupRoot();
    if (inspection.kind !== 'KnownWorkspace') return 'NoWorkspace';
    const described = await persistence.describeDatabase(inspection.databaseName);
    return { databaseName: described.databaseName, contentRevision: described.contentRevision };
  }

  async function prepare(request: PrepareRestoreRequest, made: { candidate?: string }): Promise<PrepareRestoreResult> {
    // Preparation writes a database, so it needs Writable readiness, rechecked now (A132 step 1, P30).
    const refusal = toRuntimeNotWritable(await deps.session.recheck());
    if (refusal) return refusal;
    const live = await liveBinding();
    // Cancel before anything starts: nothing was created (A138).
    if (request.signal?.aborted) return { kind: 'Cancelled', liveBinding: live };

    const lines = readArtifact(request.file);
    try {
      return await prepareFrom(request, made, live, lines);
    } finally {
      // Every way out releases the file: the reader's own cleanup runs only when the generator is closed.
      await lines.return(undefined);
    }
  }

  async function prepareFrom(
    request: PrepareRestoreRequest,
    made: { candidate?: string },
    live: TargetBinding,
    lines: ReturnType<typeof readArtifact>,
  ): Promise<PrepareRestoreResult> {
    // A Cancel that lands during the header read or the estimate wins over any rejection found there (A138).
    const rejectUnlessCancelled = (issues: RestoreIssue[]): PrepareRestoreResult =>
      request.signal?.aborted ? { kind: 'Cancelled', liveBinding: live } : rejected(issues, live);
    let first: Awaited<ReturnType<typeof lines.next>>;
    try {
      first = await lines.next();
    } catch (error) {
      return rejectUnlessCancelled([readFailure(error)]);
    }
    if (first.done || first.value.kind !== 'header') throw new Error('The backup has no header');
    const parsedHeader = headerShape.safeParse(first.value.value);
    if (!parsedHeader.success || parsedHeader.data.formatVersion !== FORMAT_VERSION) return rejectUnlessCancelled([{ code: 'UnsupportedFormat' }]);
    const header = parsedHeader.data;
    if (header.schemaVersion > SCHEMA_VERSION) return rejectUnlessCancelled([{ code: 'UnsupportedNewerSchema' }]);

    // The candidate's projected size against the free quota (A138).
    const estimate = await deps.host.estimate?.();
    if (estimate) {
      const availableBytes = (estimate.quota ?? 0) - (estimate.usage ?? 0);
      const requiredBytes = Math.ceil(Object.entries(header.counts).reduce((total, [store, count]) => total + count * (BYTES_PER_RECORD[store] ?? 0), 0));
      if (requiredBytes > availableBytes) return rejectUnlessCancelled([{ code: 'InsufficientCapacity', availableBytes, requiredBytes }]);
    }

    if (request.signal?.aborted) {
      await lines.return(undefined);
      return { kind: 'Cancelled', liveBinding: live };
    }

    const created = await persistence.createRestoreCandidate();
    if (created.kind !== 'Created') throw new Error(`The candidate was not created: ${created.kind}`);
    const candidate = created.databaseName;
    made.candidate = candidate;

    const transform = migrationChain(header.schemaVersion);
    const issues: RestoreIssue[] = [];
    // A check that fails once names one issue, however many lines it fails on.
    const noted = new Set<string>();
    const note = (issue: RestoreIssue) => {
      const key = `${issue.code}:${issue.section ?? ''}`;
      if (noted.has(key)) return;
      noted.add(key);
      issues.push(issue);
    };
    const footprint = new Set<string>();
    // Records seen per section and store, as the artifact states them.
    const seen = new Map<string, Record<string, number>>();
    let malformed = false;
    const unreadable = (line: number, path?: string) => {
      malformed = true;
      issues.push({ code: 'MalformedRecord', line, ...(path ? { path } : {}) });
    };
    // The primary keys staged so far per store: put would silently overwrite a repeat (A134).
    const keysSeen = new Map<string, Set<string>>();
    let workspaceRecord: Record<string, unknown> | undefined;
    let pending: { readonly section: string; readonly store: string; readonly lines: { line: number; record: unknown }[] } | undefined;
    // Record lines read so far, rejected or unparsable ones included, of the header's counted total (A148, Q19).
    // The Workspace section's records are not in the header counts, so they are not in this tally.
    let readCount = 0;
    let reportedCount = -1;
    const totalRecords = Object.values(header.counts).reduce((sum, count) => sum + count, 0);
    const flush = async () => {
      await stageBatch();
      if (readCount === reportedCount) return;
      reportedCount = readCount;
      request.onProgress?.({ done: readCount, total: totalRecords });
    };
    const stageBatch = async () => {
      if (!pending) return;
      const { section, store, lines: batch } = pending;
      pending = undefined;
      if (section === 'workspace') {
        const parsed = catalogRestore.parse('meta', batch);
        if (parsed.kind === 'Parsed') workspaceRecord = parsed.records[0];
        else for (const issue of parsed.issues) unreadable(issue.line, issue.path);
        return;
      }
      const moved: { line: number; record: unknown }[] = [];
      for (const { line, record } of batch) {
        try {
          moved.push({ line, record: transform({ store: store as WorkspaceStore, value: record as Record<string, unknown> }).value });
        } catch {
          unreadable(line);
        }
      }
      const parsed =
        store === 'catalog'
          ? catalogRestore.parse('catalog', moved)
          : store === 'observations'
            ? marketDataRestore.parse('observations', moved)
            : store === 'trades'
              ? tradeRestore.parse('trades', moved)
              : journalRestore.parse(store as JournalStore, moved);
      if (parsed.kind === 'Rejected') {
        for (const issue of parsed.issues) unreadable(issue.line, issue.path);
        return;
      }
      // Only records that parsed reach a footprint projector, which trusts their shape.
      for (const project of [exportCatalog, exportMarketData, exportTrades, exportJournal]) {
        for (const identifier of project({ store: store as WorkspaceStore, records: parsed.records })?.footprint ?? []) footprint.add(identifier);
      }
      const keys = keysSeen.get(store) ?? new Set<string>();
      keysSeen.set(store, keys);
      const fresh = parsed.records.filter((value, i) => {
        const stored = keyOf(store as WorkspaceStore, value);
        const key = typeof stored === 'string' ? stored : JSON.stringify(stored);
        if (!keys.has(key)) {
          keys.add(key);
          return true;
        }
        malformed = true;
        issues.push({ code: 'DuplicateIdentity', kind: store, identity: key, line: moved[i]!.line });
        return false;
      });
      await persistence.putCandidateRecords(candidate, fresh.map((value): StoreRecord => ({ store: store as WorkspaceStore, value: { ...value } })));
    };
    let fullDigest = '';
    try {
      for await (const line of lines) {
        // Leaving the loop closes the line reader; the candidate goes below.
        if (request.signal?.aborted) break;
        if (line.kind === 'record') {
          readCount += 1;
          let envelope: { s: string; t: string; r: unknown };
          try {
            const shape = JSON.parse(line.text) as Record<string, unknown> | null;
            // An object whose section owns its store; anything else is that line's own issue (A134).
            if (typeof shape !== 'object' || shape === null || typeof shape['s'] !== 'string' || typeof shape['t'] !== 'string') {
              unreadable(line.lineNumber, typeof shape === 'object' && shape !== null ? (typeof shape['s'] !== 'string' ? 's' : 't') : undefined);
              continue;
            }
            if (SECTION_OF_STORE[shape['t']] !== shape['s']) {
              unreadable(line.lineNumber, 't');
              continue;
            }
            envelope = shape as typeof envelope;
          } catch {
            unreadable(line.lineNumber);
            continue;
          }
          if (pending && (pending.store !== envelope.t || pending.lines.length >= BATCH_SIZE)) await flush();
          if (envelope.s === 'workspace') readCount -= 1;
          pending ??= { section: envelope.s, store: envelope.t, lines: [] };
          pending.lines.push({ line: line.lineNumber, record: envelope.r });
          const stores = seen.get(envelope.s) ?? {};
          bump(stores, envelope.t);
          seen.set(envelope.s, stores);
        } else if (line.kind === 'sectionEnd') {
          await flush();
          const end = sectionEndShape.safeParse(line.value);
          const named = KNOWN_SECTIONS.has(String(line.value['section'])) ? { section: String(line.value['section']) } : {};
          if (!end.success || end.data.digest !== line.computedSectionDigest) note({ code: 'DigestMismatch', ...named });
          else if (!malformed && !sameCounts(end.data.counts, seen.get(end.data.section) ?? {})) note({ code: 'ManifestMismatch' });
        } else if (line.kind === 'manifest') {
          await flush();
          fullDigest = line.computedFullDigest;
          const manifest = manifestShape.safeParse(line.value);
          if (!manifest.success) {
            note({ code: 'ManifestMismatch' });
            continue;
          }
          const stored = manifest.data;
          // Both directions: a section with no end line has no computed digest, and one the manifest omits has no stored one.
          const names = new Set([...Object.keys(line.computedSectionDigests), ...Object.keys(stored.sectionDigests)]);
          const changed = [...names].filter((name) => stored.sectionDigests[name] !== line.computedSectionDigests[name]);
          for (const name of changed) note({ code: 'DigestMismatch', ...(KNOWN_SECTIONS.has(name) ? { section: name } : {}) });
          if (changed.length === 0 && stored.fullDigest !== line.computedFullDigest) note({ code: 'DigestMismatch' });
          // The counts of the authoritative stores, and the capability footprint, as the records carry them.
          const authoritative: Record<string, number> = {};
          for (const [section, stores] of seen) if (section !== 'workspace') for (const [store, n] of Object.entries(stores)) authoritative[store] = (authoritative[store] ?? 0) + n;
          const footprintMatches = stored.footprint.length === footprint.size && stored.footprint.every((identifier) => footprint.has(identifier));
          if (!malformed && (!sameCounts(stored.counts, header.counts) || !sameCounts(header.counts, authoritative) || !footprintMatches)) note({ code: 'ManifestMismatch' });
        }
      }
    } catch (error) {
      issues.push(readFailure(error));
    }
    // Cancel wins over whatever the lines so far said: the candidate is deleted (A138).
    if (request.signal?.aborted) {
      await persistence.discardCandidate(candidate);
      return { kind: 'Cancelled', liveBinding: live };
    }
    if (issues.length > 0) {
      await persistence.discardCandidate(candidate);
      return rejected(issues, live);
    }

    // Cancel during any later phase also deletes the candidate (A138).
    const cancelIfAborted = async (): Promise<PrepareRestoreResult | undefined> => {
      if (!request.signal?.aborted) return undefined;
      await persistence.discardCandidate(candidate);
      return { kind: 'Cancelled', liveBinding: live };
    };

    await deps.restoreHooks?.staged?.();

    // Seed: genuinely missing defaults join the candidate without overwriting customization (A132 step 7).
    const staged = persistence.candidateSource(candidate);
    const catalogSeed = prepareSeed((await collect(staged, 'catalog')) as unknown as CatalogRecord[], D7_CATALOG_MANIFEST, deps.ids);
    const definitions = (await collect(staged, 'journalDefinitions')) as unknown as EntryDefinitionRecord[];
    const journalSeed = prepareJournalSeed((await collect(staged, 'journalTypes')) as unknown as JournalTypeRecord[], definitions, D6_JOURNAL_MANIFEST, deps.ids);
    if (catalogSeed.kind !== 'Additions' || journalSeed.kind !== 'Additions') throw new Error('Seed manifests conflict with stored defaults');
    await persistence.putCandidateRecords(candidate, [
      ...catalogSeed.records.map((r): StoreRecord => ({ store: 'catalog', value: { ...r } })),
      ...journalSeed.types.map((t): StoreRecord => ({ store: 'journalTypes', value: { ...t } })),
      ...journalSeed.definitions.map((d): StoreRecord => ({ store: 'journalDefinitions', value: { ...d } })),
    ]);
    const seedAdditions = [...catalogSeed.records.map((r) => r.label), ...journalSeed.types.map((t) => t.label)];
    const cancelledAfterSeed = await cancelIfAborted();
    if (cancelledAfterSeed) return cancelledAfterSeed;

    // Each module judges its own section; the Trade section is closed against the others' identities (A132 step 8).
    const catalog = await catalogRestore.validate(staged);
    const journal = await journalRestore.validate(staged);
    const marketData = await marketDataRestore.validate(staged);
    const trades = await prepareTradeRestore({ references: { ...catalog.references, anchorTradeIds: journal.references.anchorTradeIds } }).validate(staged);
    const found: RestoreIssue[] = [
      ...catalog.issues.map(({ code }): RestoreIssue => ({ code, section: 'catalog' })),
      ...marketData.issues.map(({ code }): RestoreIssue => ({ code, section: 'marketData' })),
      ...trades.issues.map((issue): RestoreIssue => {
        if (issue.code === 'UnknownAccount') return { code: 'CrossSectionReference', kind: 'Account', identity: issue.accountId };
        if (issue.code === 'UnknownCloseReason') return { code: 'CrossSectionReference', kind: 'CloseReason', identity: issue.closeReasonId };
        if (issue.code === 'UnknownAnchorTrade') return { code: 'CrossSectionReference', kind: 'Trade', identity: issue.tradeId };
        return { code: issue.code, section: 'trades' };
      }),
      ...journal.issues.map(({ code }): RestoreIssue => ({ code, section: 'journal' })),
      ...(await danglingOrigins(staged)),
      ...(await danglingStrategies(staged, new Set(catalog.references.strategyShapes.keys()))),
    ];
    const cancelledAfterValidation = await cancelIfAborted();
    if (cancelledAfterValidation) return cancelledAfterValidation;
    if (found.length > 0) {
      await persistence.discardCandidate(candidate);
      return rejected(found, live);
    }

    // Repair: coherent disagreements are written as the facts imply and disclosed (decision 23, A132 step 9).
    const repairs = new Map(trades.repairs.map((repair) => [repair.tradeId, repair]));
    const repairLines: RestoreRepair[] = [];
    if (repairs.size > 0) {
      const repaired: StoreRecord[] = [];
      for await (const batch of staged.batches('trades')) {
        for (const document of batch as unknown as readonly TradeDocument[]) {
          const repair = repairs.get(document.tradeId);
          if (!repair) continue;
          repaired.push({ store: 'trades', value: { ...repairedDocument(document, repair, deps.ids) } });
          const tradeSummary = { underlying: document.underlying, summary: plannedTradeSummary(analysisInputOf(document).plan.legs) };
          for (const finding of repair.findings) repairLines.push({ tradeId: document.tradeId, tradeSummary, ...repairText(finding) });
        }
      }
      await persistence.putCandidateRecords(candidate, repaired);
    }
    const cancelledAfterRepair = await cancelIfAborted();
    if (cancelledAfterRepair) return cancelledAfterRepair;
    // The private state follows from the finished authoritative records (A132 step 10).
    await persistence.rebuildCandidate(candidate);
    const cancelledAfterRebuild = await cancelIfAborted();
    if (cancelledAfterRebuild) return cancelledAfterRebuild;

    const zone =(workspaceRecord as { timeZone: string }).timeZone;
    await persistence.putCandidateRecords(candidate, [
      { store: 'meta', value: { key: 'settings', timeZone: zone, settingsRevision: (workspaceRecord as { settingsRevision: number }).settingsRevision } },
      { store: 'meta', value: { key: 'sessionPolicy', policy: (workspaceRecord as { sessionPolicy: unknown }).sessionPolicy } },
      { store: 'meta', value: { key: 'catalog', catalogRevision: 1 } },
      { store: 'meta', value: { key: 'journal', journalRevision: 1 } },
    ]);

    const source = persistence.candidateSource(candidate);
    const sections = {
      catalog: await measureCatalog(source),
      marketData: await measureMarketData(source),
      trades: await measureTrades(source),
      journal: await measureJournal(source),
    };
    const restored = await countsOf(source);
    const steps = Array.from({ length: SCHEMA_VERSION - header.schemaVersion }, (_, i) => ({ from: header.schemaVersion + i, to: header.schemaVersion + i + 1 }));
    // What apply rechecks (the sections) and what its receipt reports (counts, migrations, repairs).
    const prepared: PreparedRecord = { sections, counts: restored.counts, migrations: { steps, seedAdditions }, repairs: repairLines, workspaceDigest: await workspaceDigestOf(source) };
    let currentTimeZone: string | null = null;
    let target: { counts: RestoreCounts; hasUserData: boolean } | null = null;
    if (live !== 'NoWorkspace') {
      const liveSource = persistence.candidateSource(live.databaseName);
      target = await countsOf(liveSource);
      currentTimeZone = ((await collect(liveSource, 'meta')).find((record) => record['key'] === 'settings') as { timeZone: string }).timeZone;
    }
    const warnings: RestoreWarning[] = [];
    if (currentTimeZone !== null && currentTimeZone !== zone) warnings.push('TimeZoneDiffers');
    if (header.schemaVersion < SCHEMA_VERSION) warnings.push('OlderSchema');
    const cancelledAfterPreview = await cancelIfAborted();
    if (cancelledAfterPreview) return cancelledAfterPreview;
    held.set(candidate, prepared);
    return {
      kind: 'Prepared',
      token: { candidateId: candidate, fullDigest, targetBinding: live, releaseId: deps.releaseId },
      preview: {
        source: { createdAt: toWorkspaceLocal(header.createdAt, zone), releaseId: header.releaseId, schemaVersion: header.schemaVersion, exportKind: header.exportKind },
        counts: restored.counts,
        migrations: { steps, seedAdditions },
        repairs: repairLines,
        providerNeedsSetup: [],
        target: { hasUserData: target?.hasUserData ?? false, counts: target?.counts ?? null, currentTimeZone, restoredTimeZone: zone },
        warnings,
        safetyChoiceRequired: target?.hasUserData ?? false,
      },
    };
  }

  return {
    prepareRestore: (request) =>
      deps.locks.run(async () => {
        const made: { candidate?: string } = {};
        try {
          return await prepare(request, made);
        } catch (error) {
          // An unexpected failure is a rejection with no issues and the error for the log; its candidate goes.
          if (made.candidate !== undefined) await persistence.discardCandidate(made.candidate).catch(() => undefined);
          const live = await liveBinding().catch((): TargetBinding => 'NoWorkspace');
          return { kind: 'Rejected', issues: [], totalIssues: 0, liveBinding: live, detail: describeError('Prepare', error) };
        }
      }),
    async applyPreparedRestore(request) {
      // The mutation guard: outside Writable nothing is applied (A135 step 1).
      const refusal = toRuntimeNotWritable(await deps.session.recheck());
      if (refusal) return refusal;
      return deps.locks.run(async (): Promise<ApplyRestoreOutcome<S>> => {
        const live = await liveBinding();
        const { token } = request;
        if (request.confirmation?.kind !== 'ReplaceEntireWorkspace') return { kind: 'ConfirmationRequired', liveBinding: live };
        // A candidate this Restore already activated is the live database, not a preparation.
        const activated = live !== 'NoWorkspace' && live.databaseName === token.candidateId;
        const listed = !activated && (await deps.host.indexedDB.databases()).some(({ name }) => name === token.candidateId);
        // Only the instance that prepared the candidate holds what it measured.
        const prepared = held.get(token.candidateId);
        if (!listed || !prepared) return { kind: 'PreparationNotFound', liveBinding: live };
        const unchanged = live === 'NoWorkspace' || token.targetBinding === 'NoWorkspace' ? live === token.targetBinding : sameBinding(live, token.targetBinding);
        if (!unchanged) {
          await dropCandidate(token.candidateId);
          return { kind: 'Conflict', reason: 'TargetChanged', liveBinding: live };
        }
        if (live !== 'NoWorkspace' && (await countsOf(persistence.candidateSource(live.databaseName))).hasUserData) {
          const safety = request.safety;
          if (safety === undefined) return { kind: 'SafetyBackupRequired', liveBinding: live };
          if (safety.kind === 'Receipt') {
            if (!backup.recognizesReceipt(safety.receipt.receiptId)) return { kind: 'SafetyBackupNotRecognized', liveBinding: live };
            if (!sameBinding(safety.receipt.sourceBinding, live)) return { kind: 'SafetyBackupStale', liveBinding: live };
          }
        }

        // Each module's recheck of its candidate section against what preparation recorded (A135 step 4).
        const candidateSource = persistence.candidateSource(token.candidateId);
        // The faults build's recheck hook may name one of a module's stores as changed.
        const checked = async (stores: readonly string[], recheck: () => Promise<{ readonly kind: string; readonly store?: string }>) => {
          const store = deps.restoreHooks?.recheck?.(stores);
          return store === undefined ? recheck() : { kind: 'CandidateChanged', store };
        };
        const rechecks = [
          { section: 'catalog', run: () => checked(['catalog'], () => applyCatalog(candidateSource, prepared.sections.catalog)) },
          { section: 'marketData', run: () => checked(['observations'], () => applyMarketData(candidateSource, prepared.sections.marketData)) },
          { section: 'trades', run: () => checked(['trades'], () => applyTrades(candidateSource, prepared.sections.trades)) },
          { section: 'journal', run: () => checked(['journalTypes', 'journalDefinitions', 'journalEntries', 'journalDeclines', 'journalDebts'], () => applyJournal(candidateSource, prepared.sections.journal)) },
        ];
        // A recheck that cannot read the candidate (a value it cannot digest) means the candidate changed too, in that section.
        let changedStore: string | undefined;
        for (const { section, run } of rechecks) {
          try {
            const rechecked = await run();
            if (rechecked.kind === 'CandidateChanged') {
              changedStore = rechecked.store;
              break;
            }
          } catch {
            changedStore = section;
            break;
          }
        }
        // The Workspace section is not a fact module's; its records are compared with what the preview was built from.
        if (changedStore === undefined) {
          try {
            if ((await workspaceDigestOf(candidateSource)) !== prepared.workspaceDigest) changedStore = 'meta';
          } catch {
            changedStore = 'meta';
          }
        }
        if (changedStore !== undefined) {
          await dropCandidate(token.candidateId);
          return { kind: 'CandidateChanged', store: changedStore, liveBinding: live };
        }

        // One root transaction switches the pointer (A135 step 5); with no Workspace it adds the pointer instead.
        if (live === 'NoWorkspace') {
          let activation: Awaited<ReturnType<typeof persistence.activateFirstCandidate>>;
          try {
            activation = await persistence.activateFirstCandidate(token.candidateId, deps.restoreHooks?.activating);
          } catch (error) {
            // Nothing was activated, so the candidate and its preparation go; the failure itself still reaches the caller.
            await dropCandidate(token.candidateId).catch(() => undefined);
            throw error;
          }
          if (activation.kind === 'RuntimeNotWritable') {
            // The pointer was not added, so the candidate goes and the refusal itself reaches the caller (A135).
            await dropCandidate(token.candidateId);
            return activation;
          }
          if (activation.kind === 'AlreadyInitialized') {
            // Persistence deleted the losing candidate, so only the held preparation is left to drop.
            held.delete(token.candidateId);
            return { kind: 'AlreadyInitialized', databaseName: activation.databaseName, liveBinding: await liveBinding() };
          }
        } else {
          const activation = await persistence.activateCandidate(token.candidateId, live.databaseName, deps.restoreHooks?.activating);
          if (activation.kind === 'RuntimeNotWritable') {
            // The pointer did not switch, so the candidate goes and the refusal itself reaches the caller (A135).
            await dropCandidate(token.candidateId);
            return activation;
          }
          if (activation.kind === 'Aborted') {
            await dropCandidate(token.candidateId);
            throw new Error('The root transaction that switches the Workspace was aborted');
          }
        }
        held.delete(token.candidateId);
        // The Workspace is already replaced, so a failure here must not hide the Restored result (A136).
        try {
          announceReplaced(token.candidateId);
        } catch {
          // Other tabs also learn of the replacement through the versionchange fallback.
        }
        await deps.restoreHooks?.activated?.();
        const readiness = await deps.session.recheck();
        const newBinding = await persistence.describeDatabase(token.candidateId);
        return {
          kind: 'Restored',
          receipt: {
            artifactDigest: token.fullDigest,
            replacedBinding: live,
            newBinding: { databaseName: newBinding.databaseName, contentRevision: newBinding.contentRevision },
            counts: prepared.counts,
            migrations: prepared.migrations,
            repairs: prepared.repairs,
            readiness,
          },
          status: await deps.status(),
          landing: { kind: 'RestoreComplete', next: prepared.counts.accounts > 0 ? 'Trades' : 'InstitutionAndAccountOnboarding' },
        };
      });
    },
  };
}
