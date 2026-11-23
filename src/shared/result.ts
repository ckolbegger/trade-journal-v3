export type ReadinessCheckId =
  | 'storage_diagnostic'
  | 'capacity_headroom'
  | 'service_worker_control'
  | 'offline_inventory';

export type RuntimeNotWritableReason = 'Unsupported' | 'RecoveryOnly' | 'IntegrityBlocked';

export interface RuntimeNotWritableResult {
  readonly status: 'RuntimeNotWritable';
  readonly reason: RuntimeNotWritableReason;
  readonly failedChecks: readonly ReadinessCheckId[];
}

export type StorageProtectionStatus =
  | { readonly state: 'Protected' }
  | { readonly state: 'BestEffort'; readonly reason: string }
  | { readonly state: 'Unavailable'; readonly reason: string };

export interface WorkspaceSnapshotBinding {
  readonly schemaVersion: number;
  readonly workspaceRevision: number;
  readonly catalogRevision: number;
  readonly bindingToken: string;
}

export function formatWorkspaceBindingToken(
  schemaVersion: number,
  workspaceRevision: number,
  catalogRevision: number,
): string {
  return `v${schemaVersion}:w${workspaceRevision}:c${catalogRevision}`;
}
