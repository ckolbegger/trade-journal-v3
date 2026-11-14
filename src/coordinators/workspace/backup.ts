// Workspace backup: export and verification, and the registry of receipts this application
// instance issued (D8 A129-A131). T8.23 freezes the signatures; T8.4 and T8.5 build the bodies.
import type { DownloadPort, HostPort } from '../../delivery/host.ts';
import type { ReadinessSession } from '../../delivery/readiness.ts';
import type { Clock } from '../../domain/time/index.ts';
import type { IdGenerator, Persistence } from '../../persistence/index.ts';
import type { ConfirmBackupRequest, ConfirmBackupResult, ExportBackupRequest, ExportBackupResult } from './backup-types.ts';

// The host seams backup uses. Optional until composition supplies them (T8.11); T8.4 may add the export port.
export interface BackupPorts {
  readonly download?: DownloadPort;
}

// What backup needs from the Workspace's dependencies. WorkspaceDeps satisfies it structurally, and
// a task that needs more (a fact module, say) adds a field here that WorkspaceDeps already has.
export interface BackupDeps {
  readonly persistence: Persistence;
  readonly session: ReadinessSession;
  readonly host: HostPort;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly releaseId: string;
  readonly backup?: BackupPorts;
}

export interface BackupOperations {
  exportBackup(request: ExportBackupRequest): Promise<ExportBackupResult>;
  confirmBackup(request: ConfirmBackupRequest): Promise<ConfirmBackupResult>;
  // Whether this instance issued the receipt (A131); Restore's safety choice asks.
  recognizesReceipt(receiptId: string): boolean;
}

export function createBackupOperations(deps: BackupDeps): BackupOperations {
  void deps;
  return {
    exportBackup() {
      throw new Error('not built');
    },
    confirmBackup() {
      throw new Error('not built');
    },
    recognizesReceipt() {
      throw new Error('not built');
    },
  };
}
