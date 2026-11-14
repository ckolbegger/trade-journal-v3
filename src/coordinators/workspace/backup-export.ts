// The export pipeline and its in-process port (D8 A128, section 6.0). The browser worker (T8.11)
// runs `runExport` against its own IndexedDB connection; Node runs it in process against the
// Persistence's snapshot read. Nothing here touches the root, the write gate, or any store.
import { ArtifactWriter } from '../../backup/format/index.ts';
import { exportSnapshot as exportCatalog, exportWorkspaceSection } from '../../modules/reference-catalog/index.ts';
import { exportSnapshot as exportJournal } from '../../modules/journal/index.ts';
import { exportSnapshot as exportMarketData } from '../../modules/market-data/index.ts';
import { exportSnapshot as exportTrades } from '../../modules/trade-record/index.ts';
import type { ExportBatch, ExportLayout, ExportReadResult, Persistence, WorkspaceSnapshotBinding } from '../../persistence/index.ts';
import type { FailureDetail, ProgressCallback } from './backup-types.ts';

export const BACKUP_FORMAT_VERSION = 1;

export type ExportKind = 'Normal' | 'BlockedDatabase';

// What one export needs. Plain data, so a worker can receive it.
export interface ExportJob {
  readonly databaseName: string;
  readonly layout: ExportLayout;
  readonly exportKind: ExportKind;
  readonly createdAt: string;
  readonly releaseId: string;
  // The seed manifests the exported schema was seeded with; `meta` does not store them.
  readonly seedManifestVersions: { readonly catalog: number; readonly journal: number };
  // When supplied and different from the binding the snapshot reads, the export is a Conflict.
  readonly expectedBinding?: WorkspaceSnapshotBinding;
  readonly onProgress?: ProgressCallback;
}

export type ExportRun =
  | {
      readonly kind: 'Built';
      readonly blob: Blob;
      readonly sourceBinding: WorkspaceSnapshotBinding;
      readonly fullDigest: string;
      readonly manifestDigest: string;
      readonly counts: Readonly<Record<string, number>>;
      readonly timeZone: string;
    }
  | { readonly kind: 'Conflict'; readonly currentBinding: WorkspaceSnapshotBinding }
  // The snapshot could not be read, or the stored schema version is not the layout's.
  // `detail` is plain data, so a worker can post it: the caught error, or the read result's failing store.
  | { readonly kind: 'Failed'; readonly reason: 'ReadFailed'; readonly detail: FailureDetail };

// The detail of a caught error: its own name, message and stack, never a record body.
export function describeError(stage: string, error: unknown, context?: FailureDetail['context']): FailureDetail {
  const base = error instanceof Error ? { name: error.name, message: error.message, ...(error.stack === undefined ? {} : { stack: error.stack }) } : { name: 'NonError', message: String(error) };
  return { stage, ...base, ...(context ? { context } : {}) };
}

// The seam the coordinator runs an export through: a worker in the browser, `runExport` in Node.
export interface ExportPort {
  run(job: ExportJob): Promise<ExportRun>;
}

type ReadSnapshot = (database: string, layout: ExportLayout, onBatch: (batch: ExportBatch) => void) => Promise<ExportReadResult>;

interface SectionBatch {
  readonly section: string;
  readonly store: string;
  readonly records: readonly Record<string, unknown>[];
  readonly footprint: readonly string[];
}

// What a manifest's `exclusions` names as never in an artifact (A125, Q3).
const EXCLUSIONS = [
  'root',
  'journalObligations',
  'indexes',
  'trades.exposureStart',
  'trades.terminalTime',
  'trades.activityDesc',
  'trades.terminalDesc',
  'contentRevision',
  'record.revision',
  'credentials',
  'unsavedForms',
  'rawProviderPayloads',
  'diagnostics',
  'reports',
  'replayProjections',
  'cursors',
];

const SECTION_OF_STORE: Readonly<Record<string, string>> = {
  catalog: 'catalog',
  observations: 'marketData',
  trades: 'trades',
  journalTypes: 'journal',
  journalDefinitions: 'journal',
  journalEntries: 'journal',
  journalDeclines: 'journal',
  journalDebts: 'journal',
};

function project(batch: ExportBatch): SectionBatch | undefined {
  return exportCatalog(batch) ?? exportMarketData(batch) ?? exportTrades(batch) ?? exportJournal(batch);
}

// Reads one snapshot and builds the artifact from it. The records of a snapshot are held until
// the read ends, because the header needs counts that arrive with the first batch's transaction.
export async function runExport(read: ReadSnapshot, job: ExportJob): Promise<ExportRun> {
  const batches: SectionBatch[] = [];
  let rejection: FailureDetail | undefined;
  const result = await read(job.databaseName, job.layout, (batch) => {
    const projected = project(batch);
    if (projected) batches.push(projected);
  }).catch((error: unknown): ExportReadResult => {
    rejection = describeError('Read', error);
    return { kind: 'ReadFailed', store: 'meta' };
  });
  if (result.kind !== 'Read') {
    const detail = rejection ?? {
      stage: 'Read',
      name: result.kind,
      message: result.kind === 'ReadFailed' ? `Reading the ${result.store} store failed` : `The snapshot could not be read (${result.kind})`,
      ...(result.kind === 'ReadFailed' ? { context: { store: result.store } } : {}),
    };
    return { kind: 'Failed', reason: 'ReadFailed', detail };
  }
  const expected = job.expectedBinding;
  if (expected && (expected.databaseName !== result.binding.databaseName || expected.contentRevision !== result.binding.contentRevision)) {
    return { kind: 'Conflict', currentBinding: result.binding };
  }
  // A snapshot that was read but cannot be written into an artifact is a failed read, not a rejection.
  try {
    return buildArtifact(result, batches, job);
  } catch (error) {
    return { kind: 'Failed', reason: 'ReadFailed', detail: describeError('Build', error) };
  }
}

function buildArtifact(result: Extract<ExportReadResult, { kind: 'Read' }>, batches: readonly SectionBatch[], job: ExportJob): ExportRun {
  const workspace = exportWorkspaceSection(result.meta, job.seedManifestVersions);
  const sections = ['workspace', ...new Set(job.layout.stores.map((store) => SECTION_OF_STORE[store]!))];
  const all: SectionBatch[] = [workspace, ...batches];
  const total = Object.values(result.counts).reduce((sum, count) => sum + count, 0);
  let done = 0;

  const writer = new ArtifactWriter();
  writer.writeHeader({
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: result.schemaVersion,
    exportKind: job.exportKind,
    createdAt: job.createdAt,
    sourceBinding: result.binding,
    releaseId: job.releaseId,
    sections,
    counts: result.counts,
  });
  const footprint = new Set<string>();
  for (const section of sections) {
    const written: Record<string, number> = {};
    for (const batch of all) {
      if (batch.section !== section) continue;
      for (const record of batch.records) writer.writeRecord(section, batch.store, record);
      written[batch.store] = (written[batch.store] ?? 0) + batch.records.length;
      for (const identifier of batch.footprint) footprint.add(identifier);
      if (section !== 'workspace') {
        done += batch.records.length;
        job.onProgress?.({ done, total });
      }
    }
    writer.writeSectionEnd(section, written);
  }
  const output = writer.finish({
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: result.schemaVersion,
    exportKind: job.exportKind,
    footprint: [...footprint].sort(),
    counts: result.counts,
    exclusions: EXCLUSIONS,
  });
  const timeZone = result.meta.find((record) => record['key'] === 'settings')?.['timeZone'];
  if (typeof timeZone !== 'string') throw new Error('The Workspace has no settings time zone');
  return {
    kind: 'Built',
    blob: new Blob(output.parts as BlobPart[], { type: 'application/octet-stream' }),
    sourceBinding: result.binding,
    fullDigest: output.fullDigest,
    manifestDigest: output.manifestDigest,
    counts: result.counts,
    timeZone,
  };
}

// The Node port: the same pipeline, in process, against the Persistence's own snapshot read.
export function createInProcessExportPort(persistence: Pick<Persistence, 'readExportSnapshot'>): ExportPort {
  return { run: (job) => runExport((database, layout, onBatch) => persistence.readExportSnapshot(database, layout, onBatch), job) };
}
