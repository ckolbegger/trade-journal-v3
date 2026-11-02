import type { StoreRecord } from '../persistence.ts';
import { withoutPrivateFields } from './private-fields.ts';

// Schema 4 to 5 (D6 A87). Each Trade document gains an empty list of Close Reason facts (no v4
// Trade has an exit); T6.6 defines their shape. `terminalTime` and `terminalDesc` are private
// fields, so they are removed here and produced by the private rebuild after the chain (D8 A139).
// No Lot-Match record exists to copy (P23).
export function v4ToV5(record: StoreRecord): StoreRecord {
  const { store, value } = withoutPrivateFields(record);
  return { store, value: store === 'trades' ? { ...value, closeReasonFacts: [] } : value };
}
