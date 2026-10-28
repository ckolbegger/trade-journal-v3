import type { StoreRecord } from '../persistence.ts';

// Schema 2 to 3 (D4 A38). The v3 changes are the new `observations` store, the `meta` records
// `sessionPolicy` and `marketDataRevision` (both created with the candidate, so no stored record
// is touched), the private `byInstrumentDate` index, and the private `exposureStart` field. No
// authoritative record changes shape. The transform reads only authoritative fields, so any
// `exposureStart` is dropped and produced by the private rebuild after the chain (D8 A139).
export function v2ToV3({ store, value }: StoreRecord): StoreRecord {
  const copy = { ...value };
  if (store === 'trades') delete copy['exposureStart'];
  return { store, value: copy };
}
