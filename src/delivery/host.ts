// The browser-host capabilities Runtime Readiness checks, injected so that unit tests use
// doubles and the faults build (T1.27) can fail a check at this boundary.
export interface HostPort {
  readonly indexedDB: IDBFactory;
  readonly caches: CacheStorage;
  // Absent when the host offers no StorageManager.estimate.
  readonly estimate: (() => Promise<StorageEstimate>) | undefined;
  // Absent when the host offers no StorageManager.persisted.
  readonly persisted: (() => Promise<boolean>) | undefined;
  // Absent when the host offers no StorageManager.persist.
  readonly persist: (() => Promise<boolean>) | undefined;
  // The release identity reported by the controlling service worker, after waiting for the
  // first claim; null when the page has no controller.
  readonly controllerRelease: () => Promise<string | null>;
}
