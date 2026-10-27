export const DB_NAME_DEFAULT = 'trade-journal-v3';
export const SCHEMA_VERSION_V1 = 1 as const;

export const STORE_WORKSPACE_META = 'workspace_meta' as const;
export const STORE_REFERENCE_CATALOG = 'reference_catalog' as const;
export const STORE_DIAGNOSTIC_PROBE = '_diagnostic_probe' as const;

export type AuthoritativeStoreName =
  | typeof STORE_WORKSPACE_META
  | typeof STORE_REFERENCE_CATALOG;

export interface WorkspaceInitializationReceiptRecord {
  readonly receiptId: string;
  readonly openedAt: string;
  readonly isFreshInitialization: boolean;
  readonly fromSchemaVersion: number | null;
  readonly toSchemaVersion: 1;
  readonly migrationsApplied: readonly string[];
  readonly catalogSeedVersion: number;
  readonly journalSeedVersion: number;
  readonly privateStateRebuilt: boolean;
  readonly incompleteTransactionRecovered: boolean;
}

export interface WorkspaceMetaRecord {
  readonly key: 'root';
  readonly workspaceId: string;
  readonly schemaVersion: 1;
  readonly snapshotBinding: string;
  readonly timeZone: string;
  readonly settingsRevision: number;
  readonly catalogSnapshotId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly latestReceipt: WorkspaceInitializationReceiptRecord;
}

export interface CatalogRevisionEntry {
  readonly revision: number;
  readonly decisionType: 'Created' | 'Renamed' | 'Archived' | 'Retired' | 'Reactivated';
  readonly label: string;
  readonly availability: 'Selectable' | 'Archived' | 'Retired';
  readonly recordedAt: string;
}

export interface StoredInstitutionRecord {
  readonly id: string;
  readonly kind: 'Institution';
  readonly label: string;
  readonly normalizedLabel: string;
  readonly availability: 'Selectable' | 'Archived';
  readonly origin: 'TraderCreated';
  readonly currentRevision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly history: readonly CatalogRevisionEntry[];
}

export interface StoredAccountRecord {
  readonly id: string;
  readonly kind: 'Account';
  readonly parentInstitutionId: string;
  readonly label: string;
  readonly normalizedLabel: string;
  readonly availability: 'Selectable' | 'Archived';
  readonly origin: 'TraderCreated';
  readonly currentRevision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly history: readonly CatalogRevisionEntry[];
}

export type StoredCatalogRecord = StoredInstitutionRecord | StoredAccountRecord;

export function isValidWorkspaceMetaRecord(raw: unknown): raw is WorkspaceMetaRecord {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;
  if (obj.key !== 'root') return false;
  if (typeof obj.workspaceId !== 'string' || obj.workspaceId.trim().length === 0) return false;
  if (obj.schemaVersion !== 1) return false;
  if (typeof obj.snapshotBinding !== 'string' || obj.snapshotBinding.trim().length === 0) return false;
  if (typeof obj.timeZone !== 'string' || obj.timeZone.trim().length === 0) return false;
  if (typeof obj.settingsRevision !== 'number' || obj.settingsRevision < 1) return false;
  if (typeof obj.catalogSnapshotId !== 'string' || obj.catalogSnapshotId.trim().length === 0) return false;
  if (!obj.latestReceipt || typeof obj.latestReceipt !== 'object') return false;
  return true;
}
