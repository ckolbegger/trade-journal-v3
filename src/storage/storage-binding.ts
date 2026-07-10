// Narrow keyed-record primitives under each Book — the injection point of the
// testing strategy (in-memory for units, Dexie for integration/production).
// Internal seam: only Books (and Workspace, later) construct or hold one.
//
// Every record is keyed by a string `id`. `where` filters by an indexed field.

export interface StorageBinding {
  get<T>(store: string, key: string): Promise<T | undefined>
  put<T extends { id: string }>(store: string, record: T): Promise<void>
  delete(store: string, key: string): Promise<void>
  list<T>(store: string): Promise<T[]>
  where<T>(store: string, index: string, value: unknown): Promise<T[]>
  transaction<R>(stores: string[], fn: () => Promise<R>): Promise<R>
}
