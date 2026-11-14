// Workspace backup: export and verification, and the registry of receipts this application
// instance issued (D8 A129-A131). T8.23 freezes the signatures; T8.4 and T8.5 build the bodies.
import type { DownloadPort, HostPort } from '../../delivery/host.ts';
import type { ReadinessSession } from '../../delivery/readiness.ts';
import type { Clock } from '../../domain/time/index.ts';
import { toWorkspaceLocal } from '../../domain/time/index.ts';
import { D5_JOURNAL_MANIFEST } from '../../modules/journal/index.ts';
import { D7_CATALOG_MANIFEST } from '../../modules/reference-catalog/index.ts';
import { exportLayoutFor, type IdGenerator, type Persistence, type WorkspaceSnapshotBinding } from '../../persistence/index.ts';
import { createInProcessExportPort, type ExportPort } from './backup-export.ts';
import type { ConfirmBackupRequest, ConfirmBackupResult, ExportBackupRequest, ExportBackupResult } from './backup-types.ts';

// The host seams backup uses. Optional until composition supplies them (T8.11).
export interface BackupPorts {
  readonly download?: DownloadPort;
  // Runs the export pipeline: the module worker in the browser (T8.11). Absent: the in-process port.
  readonly export?: ExportPort;
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

// The seed manifests each schema version was seeded with (D8 P32): what a Workspace section records
// for a database the release has not migrated. Schema 7 changed no seed (D7S A199).
const SEED_MANIFEST_VERSIONS: Readonly<Record<number, { readonly catalog: number; readonly journal: number }>> = {
  1: { catalog: 1, journal: 1 },
  2: { catalog: 1, journal: 2 },
  3: { catalog: 1, journal: 3 },
  4: { catalog: 1, journal: 4 },
  5: { catalog: 2, journal: 5 },
  6: { catalog: D7_CATALOG_MANIFEST.version, journal: D5_JOURNAL_MANIFEST.version },
  7: { catalog: D7_CATALOG_MANIFEST.version, journal: D5_JOURNAL_MANIFEST.version },
};

function notCompleted(reason: 'IntegrityBlocked' | 'ReadFailed', workspaceBinding: WorkspaceSnapshotBinding | null = null): ExportBackupResult {
  return { kind: 'NotCompleted', stage: 'Read', reason, workspaceBinding };
}

export function createBackupOperations(deps: BackupDeps): BackupOperations {
  const exporter = deps.backup?.export ?? createInProcessExportPort(deps.persistence);
  return {
    async exportBackup(request) {
      const inspection = await deps.persistence.inspectRoot();
      // Export never passes the write gate, so it serves a Writable, a blocked, and a Recovery Only root alike.
      if (inspection.kind === 'NoWorkspace') return notCompleted('ReadFailed');
      if (inspection.kind === 'Unreadable' || inspection.kind === 'Invalid') return notCompleted('IntegrityBlocked');
      const layout = exportLayoutFor(inspection.schemaVersion);
      const seeds = SEED_MANIFEST_VERSIONS[inspection.schemaVersion];
      if (!layout || !seeds) return notCompleted('IntegrityBlocked');
      const run = await exporter.run({
        databaseName: inspection.databaseName,
        layout,
        exportKind: inspection.kind === 'OlderSchema' ? 'BlockedDatabase' : 'Normal',
        createdAt: deps.clock.now(),
        releaseId: deps.releaseId,
        seedManifestVersions: seeds,
        expectedBinding: request.expectedBinding,
        onProgress: request.onProgress,
      });
      if (run.kind === 'Conflict') return run;
      if (run.kind === 'Failed') {
        // The read changed nothing; describe the database to show the Workspace unchanged.
        const described = await deps.persistence.describeDatabase(inspection.databaseName).catch(() => undefined);
        const workspaceBinding = described && { databaseName: described.databaseName, contentRevision: described.contentRevision };
        return notCompleted('ReadFailed', workspaceBinding);
      }
      const stamp = toWorkspaceLocal(deps.clock.now(), run.timeZone).replace('T', '-').replace(':', '');
      const fileName = `trade-journal-${stamp}-${run.fullDigest.slice(0, 8)}.tjbackup`;
      const offered = await deps.backup?.download?.offer({ blob: run.blob, fileName, type: 'application/octet-stream' });
      if (offered?.kind !== 'Offered') return { kind: 'NotCompleted', stage: 'Offer', reason: 'OfferFailed', workspaceBinding: run.sourceBinding };
      return {
        kind: 'Downloaded',
        sourceBinding: run.sourceBinding,
        fullDigest: run.fullDigest,
        manifestDigest: run.manifestDigest,
        fileName,
        counts: run.counts,
        byteSize: run.blob.size,
      };
    },
    confirmBackup() {
      throw new Error('not built');
    },
    recognizesReceipt() {
      throw new Error('not built');
    },
  };
}
