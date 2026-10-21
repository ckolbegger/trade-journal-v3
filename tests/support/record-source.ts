import type { RecordSource, SectionRecord, WorkspaceStore } from '../../src/persistence/index.ts';

// An in-memory batched record source for section-validator tests. The small default batch size
// puts related records in different batches, so cross-batch checks are exercised.
export function recordSourceOf(stores: Partial<Record<WorkspaceStore, readonly object[]>>, batchSize = 2): RecordSource {
  return {
    async *batches(store) {
      const records = (stores[store] ?? []) as readonly SectionRecord[];
      for (let i = 0; i < records.length; i += batchSize) yield await Promise.resolve(records.slice(i, i + batchSize));
    },
  };
}
