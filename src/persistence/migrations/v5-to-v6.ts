import type { StoreRecord } from '../persistence.ts';
import { withoutPrivateFields } from './private-fields.ts';

// Schema 5 to 6 (D7 A118, amended by decision 84). Schema 6 adds option Instruments, but a stored
// Stock Instrument stays `{ kind: 'Stock', symbol }` with no multiplier, so no authoritative
// record changes. As in v2 to v3, the transform reads only authoritative fields: private fields
// are dropped and produced by the private rebuild after the chain (D8 A139).
export function v5ToV6(record: StoreRecord): StoreRecord {
  return withoutPrivateFields(record);
}
