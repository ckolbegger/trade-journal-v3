import type { PersistenceSeam, StoreName, StoreSchemaMap } from '../../src/persistence/idb';

const STORE_EXHAUSTIVENESS_GUARD: Record<StoreName, true> = {
  workspace_meta: true,
  catalog_meta: true,
  catalog_institutions: true,
  catalog_accounts: true,
  catalog_strategies: true,
  catalog_close_reasons: true,
  trades: true,
  trade_facts: true,
  position_changes: true,
  executions: true,
  lot_matches: true,
  deviations: true,
  journal_meta: true,
  journal_definitions: true,
  journal_entries: true,
  journal_debt: true,
  journal_declines: true,
  proj_trade_analysis_input: true,
  market_meta: true,
  market_marks: true,
  market_acknowledgments: true,
};

export const ALL_WORKSPACE_STORES = Object.keys(
  STORE_EXHAUSTIVENESS_GUARD,
) as readonly StoreName[];

export type WorkspaceStoreSnapshot = {
  readonly [K in StoreName]: readonly StoreSchemaMap[K][];
};

function recordSortKey(rec: unknown): string {
  if (typeof rec === 'object' && rec !== null) {
    const obj = rec as Record<string, unknown>;
    if (typeof obj.id === 'string') return obj.id;
    if (typeof obj.key === 'string') return obj.key;
    if (typeof obj.tradeId === 'string') return obj.tradeId;
  }
  return JSON.stringify(rec);
}

/**
 * Reads and deterministically sorts every authoritative and projection store in the active
 * workspace generation so read-only / zero-write / rollback tests assert global non-mutation.
 */
export async function snapshotAllStores(
  persistence: PersistenceSeam,
): Promise<WorkspaceStoreSnapshot> {
  return persistence.runReadTransaction(ALL_WORKSPACE_STORES, async (tx) => {
    const pairs = await Promise.all(
      ALL_WORKSPACE_STORES.map(async (storeName) => {
        const rows = await tx.getAll(storeName);
        const sorted = [...rows].sort((a, b) => recordSortKey(a).localeCompare(recordSortKey(b)));
        return [storeName, sorted] as const;
      }),
    );
    return Object.fromEntries(pairs) as unknown as WorkspaceStoreSnapshot;
  });
}
