import type { ExportBatch } from '../../persistence/export-snapshot.ts';

// One batch of the `marketData` section, ready for the artifact (D8 A125).
export interface MarketDataSectionBatch {
  readonly section: 'marketData';
  readonly store: 'observations';
  readonly records: readonly Record<string, unknown>[];
  // The capability identifiers (A126) the records carry; Workspace unions them across batches.
  readonly footprint: readonly string[];
}

// Projects one batch of `observations`, in the order given, as stored: each record keeps its whole
// Mark and acknowledgment chains, effective heads and `resolutionRevision`. Only the per-record
// `revision` write stamp is left out (Q3).
export function exportSnapshot(batch: ExportBatch): MarketDataSectionBatch | undefined {
  if (batch.store !== 'observations') return undefined;
  const footprint = new Set<string>();
  for (const record of batch.records) {
    if (nonEmpty(record['marks'])) footprint.add('marketData.mark');
    if (nonEmpty(record['acknowledgments'])) footprint.add('marketData.acknowledgment');
  }
  const records = batch.records.map((record) => Object.fromEntries(Object.entries(record).filter(([name]) => name !== 'revision')));
  return { section: 'marketData', store: 'observations', records, footprint: [...footprint].sort() };
}

function nonEmpty(chain: unknown): boolean {
  return Array.isArray(chain) && chain.length > 0;
}
