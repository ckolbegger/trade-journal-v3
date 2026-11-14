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

// The file a backup export offers the trader as an ordinary download (D8 A128).
export interface OfferedFile {
  readonly blob: Blob;
  readonly fileName: string;
  readonly type: string;
}

// The download port: hands one file to the host as an ordinary download. The host cannot say
// whether or where the trader saved it, so Offered is not a completed backup (D8 A141).
export interface DownloadPort {
  offer(file: OfferedFile): Promise<{ readonly kind: 'Offered' } | { readonly kind: 'Failed'; readonly reason: string }>;
}

// The file-selection port: asks the trader to choose one file, through the host's ordinary file selection.
export interface FileSelectionPort {
  choose(): Promise<{ readonly kind: 'Chosen'; readonly file: File } | { readonly kind: 'Cancelled' }>;
}
