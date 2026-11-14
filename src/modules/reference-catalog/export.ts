import type { ExportBatch } from '../../persistence/export-snapshot.ts';

// One batch of the `catalog` section, ready for the artifact (D8 A125).
export interface CatalogSectionBatch {
  readonly section: 'catalog';
  readonly store: 'catalog';
  readonly records: readonly Record<string, unknown>[];
  // The capability identifiers (A126) the records carry; Workspace unions them across batches.
  readonly footprint: readonly string[];
}

// The `workspace` section: one record.
export interface WorkspaceSectionBatch {
  readonly section: 'workspace';
  readonly store: 'meta';
  readonly records: readonly Record<string, unknown>[];
  readonly footprint: readonly string[];
}

const FOOTPRINT_BY_KIND: Readonly<Record<string, string>> = {
  Institution: 'catalog.institution',
  Account: 'catalog.account',
  Strategy: 'catalog.strategy',
  CloseReason: 'catalog.closeReason',
};

// Projects one batch of `catalog` records, in the order given, as stored: every kind with its
// origin, label, availability and record revisions, shape and seed key. Only the per-record
// `revision` write stamp is left out (Q3).
export function exportSnapshot(batch: ExportBatch): CatalogSectionBatch | undefined {
  if (batch.store !== 'catalog') return undefined;
  const footprint = new Set<string>();
  for (const record of batch.records) {
    const identifier = FOOTPRINT_BY_KIND[record['kind'] as string];
    if (identifier !== undefined) footprint.add(identifier);
  }
  const records = batch.records.map((record) => Object.fromEntries(Object.entries(record).filter(([name]) => name !== 'revision')));
  return { section: 'catalog', store: 'catalog', records, footprint: [...footprint].sort() };
}

// The Workspace section's one record, picked from the `meta` records: the time zone and its
// settings revision, the session-policy identity, and the seed-manifest versions this release
// seeds (supplied by Workspace, which owns both manifests; `meta` does not store them). The content
// revision counters (`content`, `catalog`, `journal`, `tradeRecord`) are not carried.
export function exportWorkspaceSection(
  meta: readonly Record<string, unknown>[],
  seedManifestVersions: { readonly catalog: number; readonly journal: number },
): WorkspaceSectionBatch {
  const settings = meta.find((record) => record['key'] === 'settings');
  const sessionPolicy = meta.find((record) => record['key'] === 'sessionPolicy');
  const record = {
    key: 'workspace',
    timeZone: settings?.['timeZone'],
    settingsRevision: settings?.['settingsRevision'],
    seedManifestVersions: { catalog: seedManifestVersions.catalog, journal: seedManifestVersions.journal },
    sessionPolicy: sessionPolicy?.['policy'],
  };
  return { section: 'workspace', store: 'meta', records: [record], footprint: [] };
}
