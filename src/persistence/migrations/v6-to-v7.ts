import type { StoreRecord } from '../persistence.ts';
import { withoutPrivateFields } from './private-fields.ts';

// Schema 6 to 7 (D7S A199). Schema 7 admits the `StructureValue` condition kind, but every stored
// condition already carries `kind`, so no authoritative record changes. As in v5 to v6 (decision
// 84), the transform only drops private fields; the private rebuild after the chain produces
// them (D8 A139).
export function v6ToV7(record: StoreRecord): StoreRecord {
  return withoutPrivateFields(record);
}
