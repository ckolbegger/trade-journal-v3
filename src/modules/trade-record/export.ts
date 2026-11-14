import type { ExportBatch } from '../../persistence/export-snapshot.ts';

// One batch of the `trades` section, ready for the artifact (D8 A125).
export interface TradeSectionBatch {
  readonly section: 'trades';
  readonly store: 'trades';
  readonly records: readonly Record<string, unknown>[];
  // The capability identifiers (A126) the records carry; Workspace unions them across batches.
  readonly footprint: readonly string[];
}

// Left out of every Trade: the per-record write stamp (Q3) and the four private index fields the
// rebuild derives (A125).
const NOT_EXPORTED = new Set(['revision', 'exposureStart', 'terminalTime', 'activityDesc', 'terminalDesc']);

interface StoredVersions {
  readonly kind?: string;
  readonly versions?: readonly { readonly value?: { readonly instrument?: { readonly kind?: string }; readonly kind?: string; readonly exerciseIntent?: string } }[];
}

interface StoredDeviation {
  readonly versions?: readonly { readonly type?: string }[];
}

// The identifiers (A126) one Trade's records carry. Every fact and version is visited, so a Trade
// with any number of legs, fills or settlements reports what it holds.
function footprintOf(record: Record<string, unknown>, into: Set<string>): void {
  for (const fact of (record['facts'] as readonly StoredVersions[] | undefined) ?? []) {
    if (fact.kind === 'Execution') into.add('positionChange.execution');
    if (fact.kind === 'Expiration') into.add('positionChange.expiration');
    for (const { value } of fact.versions ?? []) {
      if (value?.instrument?.kind === 'Stock') into.add('instrument.stock');
      if (value?.instrument?.kind === 'Option') into.add('instrument.option');
      if (fact.kind === 'Plan' && value?.exerciseIntent !== undefined) into.add('plan.exerciseIntent');
      if ((fact.kind === 'Stop' || fact.kind === 'Target') && value?.kind === 'StructureValue') into.add('condition.structureValue');
    }
  }
  if (((record['closeReasonFacts'] as readonly unknown[] | undefined) ?? []).length > 0) into.add('trade.closeReason');
  for (const deviation of (record['deviations'] as readonly StoredDeviation[] | undefined) ?? []) {
    if (deviation.versions?.some((version) => version.type === 'EntrySize')) into.add('trade.deviation.entrySize');
  }
}

// Projects one batch of `trades` records, kept in the order given, as stored: each Trade is one
// document whose facts, Close Reasons and Deviations are carried whole, whatever their number.
export function exportSnapshot(batch: ExportBatch): TradeSectionBatch | undefined {
  if (batch.store !== 'trades') return undefined;
  const footprint = new Set<string>();
  for (const record of batch.records) footprintOf(record, footprint);
  const records = batch.records.map((record) => Object.fromEntries(Object.entries(record).filter(([name]) => !NOT_EXPORTED.has(name))));
  return { section: 'trades', store: 'trades', records, footprint: [...footprint].sort() };
}
