import type { WorkspaceStore } from './schema.ts';

// One stored record as a section validator reads it: untrusted until validated.
export type SectionRecord = Readonly<Record<string, unknown>>;

// A section's authoritative records, store by store, in bounded batches (D8 A140). Migration reads
// a candidate database through it and Restore a backup artifact, so a validator keeps only identity
// sets between batches and validates a mature Workspace in bounded memory. Each call starts a fresh
// pass over the store.
export interface RecordSource {
  batches(store: WorkspaceStore): AsyncIterable<readonly SectionRecord[]>;
}
