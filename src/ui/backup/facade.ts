import type {
  ApplyPreparedRestoreRequest,
  ApplyPreparedRestoreResult,
  ConfirmBackupRequest,
  ConfirmBackupResult,
  ExportBackupRequest,
  ExportBackupResult,
  PrepareRestoreRequest,
  PrepareRestoreResult,
} from '../../app/types.ts';

// The four backup and Restore operations the Backup page and Restore flow call (D8 T8.23).
// T8.11 serves them from the real facade's Workspace group.
export interface BackupFacade {
  exportBackup(request: ExportBackupRequest): Promise<ExportBackupResult>;
  confirmBackup(request: ConfirmBackupRequest): Promise<ConfirmBackupResult>;
  prepareRestore(request: PrepareRestoreRequest): Promise<PrepareRestoreResult>;
  applyPreparedRestore(request: ApplyPreparedRestoreRequest): Promise<ApplyPreparedRestoreResult>;
}
