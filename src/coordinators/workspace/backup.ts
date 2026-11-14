// Workspace backup: export and verification, and the registry of receipts this application
// instance issued (D8 A129-A131). T8.23 freezes the signatures; T8.4 and T8.5 build the bodies.
import { z } from 'zod';
import type { DownloadPort, HostPort } from '../../delivery/host.ts';
import type { ReadinessSession } from '../../delivery/readiness.ts';
import type { Clock } from '../../domain/time/index.ts';
import { toWorkspaceLocal } from '../../domain/time/index.ts';
import { D5_JOURNAL_MANIFEST } from '../../modules/journal/index.ts';
import { D7_CATALOG_MANIFEST } from '../../modules/reference-catalog/index.ts';
import { exportLayoutFor, type IdGenerator, type Persistence, type WorkspaceSnapshotBinding } from '../../persistence/index.ts';
import { ArtifactReadError, readArtifact } from '../../backup/format/index.ts';
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

const bindingShape = z.object({ databaseName: z.string(), contentRevision: z.number() });
const countsShape = z.record(z.string(), z.number());
const headerShape = z.object({ sourceBinding: bindingShape, sections: z.array(z.string()), counts: countsShape });
const sectionEndShape = z.object({ section: z.string(), counts: countsShape, digest: z.string() });
// The Workspace Backup Manifest's fields (A123): versions, capability footprint, counts, exclusions, section digests, full digest.
const manifestShape = z.object({
  formatVersion: z.number(),
  schemaVersion: z.number(),
  footprint: z.array(z.string()),
  counts: countsShape,
  exclusions: z.array(z.string()),
  sectionDigests: z.record(z.string(), z.string()),
  fullDigest: z.string(),
});
// Record lines are never parsed (T8.1): their section and store are the last two keys of the canonical line.
const RECORD_TAIL = /,"s":"([^"]*)","t":"([^"]*)"\}$/;

type Verified = { readonly kind: 'Verified'; readonly binding: WorkspaceSnapshotBinding; readonly fullDigest: string; readonly manifestDigest: string; readonly compressed: boolean; readonly lineCount: number };

function sameCounts(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? 0) === (b[key] ?? 0));
}

// Streams the file and recomputes every digest and count against the artifact's own header and manifest (A130).
async function verifyArtifact(file: File): Promise<Verified | { readonly kind: 'Unreadable' | 'IncompleteOrCorrupt' }> {
  let sourceFailed = false;
  let source: ReadableStream<Uint8Array>;
  try {
    const reader = file.stream().getReader();
    source = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const r = await reader.read();
          if (r.done) controller.close();
          else controller.enqueue(r.value);
        } catch (e) {
          sourceFailed = true;
          throw e;
        }
      },
      cancel: (reason) => reader.cancel(reason),
    });
  } catch {
    return { kind: 'Unreadable' };
  }
  let header: z.infer<typeof headerShape> | undefined;
  let sectionEnds = 0;
  const actual = new Map<string, Record<string, number>>();
  try {
    for await (const line of readArtifact(source)) {
      if (line.kind === 'header') {
        const parsed = headerShape.safeParse(line.value);
        if (line.lineNumber !== 1 || !parsed.success) return { kind: 'IncompleteOrCorrupt' };
        header = parsed.data;
      } else if (!header) {
        return { kind: 'IncompleteOrCorrupt' };
      } else if (line.kind === 'record') {
        const tail = RECORD_TAIL.exec(line.text);
        if (!tail) return { kind: 'IncompleteOrCorrupt' };
        const stores = actual.get(tail[1]!) ?? {};
        stores[tail[2]!] = (stores[tail[2]!] ?? 0) + 1;
        actual.set(tail[1]!, stores);
      } else if (line.kind === 'sectionEnd') {
        const parsed = sectionEndShape.safeParse(line.value);
        // The ends must name the header's sections, each once, in the header's order (A123).
        if (!parsed.success || parsed.data.section !== header.sections[sectionEnds] || parsed.data.digest !== line.computedSectionDigest || !sameCounts(parsed.data.counts, actual.get(parsed.data.section) ?? {})) {
          return { kind: 'IncompleteOrCorrupt' };
        }
        sectionEnds += 1;
      } else {
        const parsed = manifestShape.safeParse(line.value);
        if (!parsed.success || sectionEnds !== header.sections.length) return { kind: 'IncompleteOrCorrupt' };
        const stored = parsed.data;
        const bySection = Object.keys(line.computedSectionDigests);
        const authoritative: Record<string, number> = {};
        for (const [section, stores] of actual) {
          if (section !== 'workspace') for (const [store, n] of Object.entries(stores)) authoritative[store] = (authoritative[store] ?? 0) + n;
        }
        if (
          stored.fullDigest !== line.computedFullDigest ||
          bySection.length !== Object.keys(stored.sectionDigests).length ||
          bySection.some((section) => stored.sectionDigests[section] !== line.computedSectionDigests[section]) ||
          !sameCounts(stored.counts, header.counts) ||
          !sameCounts(header.counts, authoritative)
        ) {
          return { kind: 'IncompleteOrCorrupt' };
        }
        return { kind: 'Verified', binding: header.sourceBinding, fullDigest: line.computedFullDigest, manifestDigest: line.computedManifestDigest, compressed: line.compressed, lineCount: line.lineNumber };
      }
    }
  } catch (e) {
    if (sourceFailed) return { kind: 'Unreadable' };
    if (e instanceof ArtifactReadError && e.reason === 'NotUtf8') return { kind: 'Unreadable' };
    if (e instanceof ArtifactReadError) return { kind: 'IncompleteOrCorrupt' };
    throw e;
  }
  return { kind: 'IncompleteOrCorrupt' };
}

function notCompleted(reason: 'IntegrityBlocked' | 'ReadFailed', workspaceBinding: WorkspaceSnapshotBinding | null = null): ExportBackupResult {
  return { kind: 'NotCompleted', stage: 'Read', reason, workspaceBinding };
}

export function createBackupOperations(deps: BackupDeps): BackupOperations {
  // Receipts issued by this application instance only; never stored (A131, ADR 0010).
  const issued = new Set<string>();
  const exporter = deps.backup?.export ?? createInProcessExportPort(deps.persistence);
  return {
    async exportBackup(request) {
      const inspection = await deps.persistence.lookupRoot().catch(() => undefined);
      if (!inspection) return notCompleted('ReadFailed');
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
      }).catch((): { readonly kind: 'Failed' } => ({ kind: 'Failed' }));
      if (run.kind === 'Conflict') return run;
      if (run.kind === 'Failed') {
        // The read changed nothing; describe the database to show the Workspace unchanged.
        const described = await deps.persistence.describeDatabase(inspection.databaseName).catch(() => undefined);
        const workspaceBinding = described && { databaseName: described.databaseName, contentRevision: described.contentRevision };
        return notCompleted('ReadFailed', workspaceBinding);
      }
      const stamp = toWorkspaceLocal(deps.clock.now(), run.timeZone).replace('T', '-').replace(':', '');
      const fileName = `trade-journal-${stamp}-${run.fullDigest.slice(0, 8)}.tjbackup`;
      const offered = await deps.backup?.download?.offer({ blob: run.blob, fileName, type: 'application/octet-stream' }).catch(() => undefined);
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
    async confirmBackup(request) {
      const verified = await verifyArtifact(request.file);
      if (verified.kind !== 'Verified') return { kind: 'NotVerified', reason: verified.kind };
      const expected = request.expectedBinding;
      if (
        verified.fullDigest !== request.expectedFullDigest ||
        verified.binding.databaseName !== expected.databaseName ||
        verified.binding.contentRevision !== expected.contentRevision
      ) {
        return { kind: 'NotVerified', reason: 'DifferentArtifact' };
      }
      const receiptId = deps.ids.next();
      issued.add(receiptId);
      return {
        kind: 'Completed',
        receipt: {
          receiptId,
          sourceBinding: verified.binding,
          fullDigest: verified.fullDigest,
          manifestDigest: verified.manifestDigest,
          evidence: { fileName: request.file.name, byteSize: request.file.size, compressed: verified.compressed, lineCount: verified.lineCount },
          completedAt: deps.clock.now(),
        },
      };
    },
    recognizesReceipt: (receiptId) => issued.has(receiptId),
  };
}
