import type { StoreRecord } from '../persistence.ts';
import { withoutPrivateFields } from './private-fields.ts';

// Schema 3 to 4 (D5 A62). The v4 change is the new `journalDebts` store, created empty with the
// candidate, and its private fields `outstandingDue` and `anchorTradeId`. No authoritative record
// changes shape (Entries and declines gain only an optional `settledDebtId`). The transform reads
// only authoritative fields; every private field is produced by the private rebuild after the chain
// (D8 A139).
export function v3ToV4(record: StoreRecord): StoreRecord {
  return withoutPrivateFields(record);
}
