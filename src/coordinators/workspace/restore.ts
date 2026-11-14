// Workspace Restore: preparation of a candidate and its atomic apply (D8 A132-A138). T8.23
// freezes the signatures; the Restore tasks build the bodies.
import type { LifecycleLock } from '../../persistence/index.ts';
import type { ApplyRestoreOutcome, PrepareRestoreRequest, PrepareRestoreResult, ApplyPreparedRestoreRequest } from './backup-types.ts';
import type { BackupDeps, BackupOperations } from './backup.ts';

// What Restore needs: the backup dependencies, the lifecycle lock, and a way to read the fresh status
// that the Restored result carries (S is the WorkspaceStatus; Workspace passes its own getStatus).
export interface RestoreDeps<S> extends BackupDeps {
  readonly locks: LifecycleLock;
  readonly status: () => Promise<S>;
}

export interface RestoreOperations<S> {
  prepareRestore(request: PrepareRestoreRequest): Promise<PrepareRestoreResult>;
  applyPreparedRestore(request: ApplyPreparedRestoreRequest): Promise<ApplyRestoreOutcome<S>>;
}

// The backup operations are passed in for their receipt registry (A131).
export function createRestoreOperations<S>(deps: RestoreDeps<S>, backup: BackupOperations): RestoreOperations<S> {
  void deps;
  void backup;
  return {
    prepareRestore() {
      throw new Error('not built');
    },
    applyPreparedRestore() {
      throw new Error('not built');
    },
  };
}
