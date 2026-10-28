import type { StoreRecord } from '../persistence.ts';

// The private Trade fields: derived by the private rebuild, never read or emitted by a migration
// transform (D8 A139). A later schema that adds a private Trade field lists it here.
const PRIVATE_TRADE_FIELDS = ['activityDesc', 'exposureStart'] as const;

// A copy of the record with every private Trade field removed.
export function withoutPrivateFields({ store, value }: StoreRecord): StoreRecord {
  const copy = { ...value };
  if (store === 'trades') for (const field of PRIVATE_TRADE_FIELDS) delete copy[field];
  return { store, value: copy };
}
