import type { StoreRecord } from '../persistence.ts';
import { withoutPrivateFields } from './private-fields.ts';

// Schema 2 to 3 (D4 A38). The v3 changes are the new `observations` store, the `meta` record
// `sessionPolicy` (created with the candidate, so no stored record is touched), the private
// `byInstrumentDate` index, and the private `exposureStart` field. No
// authoritative record changes shape. The transform reads only authoritative fields, so any
// `exposureStart` is dropped and produced by the private rebuild after the chain (D8 A139).
export function v2ToV3(record: StoreRecord): StoreRecord {
  return withoutPrivateFields(record);
}
