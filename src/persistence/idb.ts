import { wrap, type IDBPDatabase } from 'idb';

// Opens a database on an injected factory (idb's openDB always uses the global one).
export function openDatabase(
  factory: IDBFactory,
  name: string,
  version: number | undefined,
  upgrade?: (db: IDBDatabase, oldVersion: number, transaction: IDBTransaction) => void,
): Promise<IDBPDatabase> {
  const request = version === undefined ? factory.open(name) : factory.open(name, version);
  if (upgrade) {
    request.onupgradeneeded = (event) => {
      if (request.transaction) upgrade(request.result, event.oldVersion, request.transaction);
    };
  }
  return wrap(request) as Promise<IDBPDatabase>;
}

export function deleteDatabase(factory: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`could not delete ${name}`));
  });
}
