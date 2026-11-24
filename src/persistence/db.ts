import type { Account, Institution } from '../domain/types'

// The single IndexedDB database. One atomic transaction per semantic command.
const DB_NAME = 'tjv3'
const DB_VERSION = 2
export const STORES = ['workspace', 'institutions', 'accounts', 'catalog', 'journal', 'market', 'trade'] as const

export type Db = IDBDatabase

export function openDb(factory: IDBFactory = indexedDB): Promise<Db> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function transaction<T>(
  db: Db,
  stores: string[],
  mode: IDBTransactionMode,
  run: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode)
    let result: T
    let settled = false
    tx.oncomplete = () => { if (!settled) { settled = true; resolve(result) } }
    tx.onerror = () => { if (!settled) { settled = true; reject(tx.error) } }
    tx.onabort = () => { if (!settled) { settled = true; reject(tx.error ?? new Error('aborted')) } }
    void run(tx).then(r => { result = r }, e => { settled = true; try { tx.abort() } catch { /* already done */ } reject(e) })
  })
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const repo = {
  async get<T>(db: Db, store: string, id: string): Promise<T | undefined> {
    return request(db.transaction(store, 'readonly').objectStore(store).get(id) as IDBRequest<T>)
  },
  async all<T>(db: Db, store: string): Promise<T[]> {
    return request(db.transaction(store, 'readonly').objectStore(store).getAll() as IDBRequest<T[]>)
  },
  put(db: Db, store: string, value: { id: string }): Promise<void> {
    return request(db.transaction(store, 'readwrite').objectStore(store).put(value))
  },
  putInTx(tx: IDBTransaction, store: string, value: { id: string }): Promise<void> {
    return request(tx.objectStore(store).put(value))
  },
  getInTx<T>(tx: IDBTransaction, store: string, id: string): Promise<T | undefined> {
    return request(tx.objectStore(store).get(id) as IDBRequest<T>)
  },
  allInTx<T>(tx: IDBTransaction, store: string): Promise<T[]> {
    return request(tx.objectStore(store).getAll() as IDBRequest<T[]>)
  },
}

export type { Account, Institution }
