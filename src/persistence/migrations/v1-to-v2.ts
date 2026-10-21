import type { StoreRecord } from '../persistence.ts';

// Schema 1 to 2 (D2 A28). The v2 changes are new stores (journalDeclines, the private
// journalObligations) and the private `activityDesc` field: no authoritative record changes shape,
// and D1 Planned Trades need no added fields. The transform reads only authoritative fields, so any
// private field is dropped and produced by the private rebuild after the chain (D8 A139).
export function v1ToV2({ store, value }: StoreRecord): StoreRecord {
  const copy = { ...value };
  if (store === 'trades') delete copy['activityDesc'];
  return { store, value: copy };
}
