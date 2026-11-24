// Workspace backup: export and verification, and the registry of receipts this application
// instance issued (D8 A129-A131). T8.23 freezes the signatures; T8.4 and T8.5 build the bodies.
import { z } from 'zod';
import type { DownloadPort, HostPort } from '../../delivery/host.ts';
import type { ReadinessSession } from '../../delivery/readiness.ts';
import type { Clock } from '../../domain/time/index.ts';
import { toWorkspaceLocal } from '../../domain/time/index.ts';
import { D5_JOURNAL_MANIFEST, seededManifestVersion, type EntryDefinitionRecord } from '../../modules/journal/index.ts';
import { D7_CATALOG_MANIFEST } from '../../modules/reference-catalog/index.ts';
import { exportLayoutFor, type IdGenerator, type Persistence, type WorkspaceSnapshotBinding } from '../../persistence/index.ts';
import { ArtifactReadError, readArtifact } from '../../backup/format/index.ts';
import { createInProcessExportPort, describeError, KNOWN_SECTIONS, type ExportPort } from './backup-export.ts';
import type { ConfirmBackupRequest, ConfirmBackupResult, ExportBackupRequest, ExportBackupResult, FailureDetail } from './backup-types.ts';

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

// The Journal manifest the live Workspace's forms match; undefined when none matches or the read fails (the table answers then).
async function storedJournalSeed(persistence: Persistence): Promise<number | undefined> {
  try {
    const { value } = await persistence.readSnapshot(['journalDefinitions'], (tx) => tx.getAll('journalDefinitions'));
    return seededManifestVersion(value as unknown as readonly EntryDefinitionRecord[]);
  } catch {
    return undefined;
  }
}

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

type Unverified = { readonly kind: 'Unreadable' | 'IncompleteOrCorrupt'; readonly detail: FailureDetail };

// A failed check, for the developer log: the check's name and where it failed, never record contents.
function failedCheck(kind: Unverified['kind'], check: string, context: Record<string, string | number> = {}): Unverified {
  return { kind, detail: { stage: 'Verify', name: check, message: `The ${check} check failed`, context: { check, ...context } } };
}

// A thrown error, described without its message or stack: reader and stream messages can quote file content.
function thrownCheck(kind: Unverified['kind'], check: string, error: unknown, context: Record<string, string | number> = {}): Unverified {
  const failed = failedCheck(kind, check, context);
  return { kind, detail: { ...failed.detail, name: error instanceof Error ? error.name : 'NonError' } };
}

// Streams the file and recomputes every digest and count against the artifact's own header and manifest (A130).
async function verifyArtifact(file: File): Promise<Verified | Unverified> {
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
  } catch (e) {
    return thrownCheck('Unreadable', 'StreamRead', e);
  }
  let header: z.infer<typeof headerShape> | undefined;
  let sectionEnds = 0;
  const actual = new Map<string, Record<string, number>>();
  try {
    for await (const line of readArtifact(source)) {
      if (line.kind === 'header') {
        const parsed = headerShape.safeParse(line.value);
        if (line.lineNumber !== 1 || !parsed.success || new Set(parsed.data.sections).size !== parsed.data.sections.length) return failedCheck('IncompleteOrCorrupt', 'HeaderShape', { line: line.lineNumber });
        header = parsed.data;
      } else if (!header) {
        return failedCheck('IncompleteOrCorrupt', 'MissingHeader', { line: line.lineNumber });
      } else if (line.kind === 'record') {
        const tail = RECORD_TAIL.exec(line.text);
        if (!tail) return failedCheck('IncompleteOrCorrupt', 'RecordShape', { line: line.lineNumber });
        const stores = actual.get(tail[1]!) ?? {};
        stores[tail[2]!] = (stores[tail[2]!] ?? 0) + 1;
        actual.set(tail[1]!, stores);
      } else if (line.kind === 'sectionEnd') {
        const parsed = sectionEndShape.safeParse(line.value);
        // The ends must name the header's sections, each once, in the header's order (A123).
        // The header is untrusted: only a section name the format knows reaches the developer log.
        const headerSection = header.sections[sectionEnds] ?? '';
        const at = { section: KNOWN_SECTIONS.has(headerSection) ? headerSection : 'unknown', line: line.lineNumber };
        if (!parsed.success || parsed.data.section !== header.sections[sectionEnds]) return failedCheck('IncompleteOrCorrupt', 'SectionEndMismatch', at);
        if (parsed.data.digest !== line.computedSectionDigest) return failedCheck('IncompleteOrCorrupt', 'SectionDigestMismatch', at);
        if (!sameCounts(parsed.data.counts, actual.get(parsed.data.section) ?? {})) return failedCheck('IncompleteOrCorrupt', 'CountsMismatch', at);
        sectionEnds += 1;
      } else {
        const parsed = manifestShape.safeParse(line.value);
        if (!parsed.success) return failedCheck('IncompleteOrCorrupt', 'ManifestShape', { line: line.lineNumber });
        if (sectionEnds !== header.sections.length) return failedCheck('IncompleteOrCorrupt', 'SectionEndMismatch', { line: line.lineNumber });
        const stored = parsed.data;
        const bySection = Object.keys(line.computedSectionDigests);
        const authoritative: Record<string, number> = {};
        for (const [section, stores] of actual) {
          if (section !== 'workspace') for (const [store, n] of Object.entries(stores)) authoritative[store] = (authoritative[store] ?? 0) + n;
        }
        const at = { line: line.lineNumber };
        if (stored.fullDigest !== line.computedFullDigest) return failedCheck('IncompleteOrCorrupt', 'FullDigestMismatch', at);
        if (bySection.length !== Object.keys(stored.sectionDigests).length || bySection.some((section) => stored.sectionDigests[section] !== line.computedSectionDigests[section])) {
          return failedCheck('IncompleteOrCorrupt', 'SectionDigestMismatch', at);
        }
        if (!sameCounts(stored.counts, header.counts) || !sameCounts(header.counts, authoritative)) return failedCheck('IncompleteOrCorrupt', 'CountsMismatch', at);
        return { kind: 'Verified', binding: header.sourceBinding, fullDigest: line.computedFullDigest, manifestDigest: line.computedManifestDigest, compressed: line.compressed, lineCount: line.lineNumber };
      }
    }
  } catch (e) {
    // The reader wraps a stream failure after the first chunk; the host's own error is its cause.
    if (sourceFailed) return thrownCheck('Unreadable', 'StreamRead', e instanceof ArtifactReadError && e.cause !== undefined ? e.cause : e);
    if (e instanceof ArtifactReadError && e.reason === 'NotUtf8') return thrownCheck('Unreadable', 'NotUtf8', e, { code: e.code });
    if (e instanceof ArtifactReadError) return thrownCheck('IncompleteOrCorrupt', 'ReaderError', e, { code: e.code });
    throw e;
  }
  return failedCheck('IncompleteOrCorrupt', 'MissingManifest');
}

function notCompleted(reason: 'IntegrityBlocked' | 'ReadFailed', detail: FailureDetail, workspaceBinding: WorkspaceSnapshotBinding | null = null): ExportBackupResult {
  return { kind: 'NotCompleted', stage: 'Read', reason, workspaceBinding, detail };
}

export function createBackupOperations(deps: BackupDeps): BackupOperations {
  // Receipts issued by this application instance only; never stored (A131, ADR 0010).
  const issued = new Set<string>();
  const exporter = deps.backup?.export ?? createInProcessExportPort(deps.persistence);
  return {
    async exportBackup(request) {
      let lookupError: FailureDetail | undefined;
      const inspection = await deps.persistence.lookupRoot().catch((error: unknown) => {
        lookupError = describeError('Read', error);
        return undefined;
      });
      if (!inspection) return notCompleted('ReadFailed', lookupError ?? { stage: 'Read', name: 'LookupFailed', message: 'The journal storage lookup returned nothing' });
      // Export never passes the write gate, so it serves a Writable, a blocked, and a Recovery Only root alike.
      if (inspection.kind === 'NoWorkspace') return notCompleted('ReadFailed', { stage: 'Read', name: 'NoWorkspace', message: 'No journal exists to back up' });
      if (inspection.kind === 'Unreadable' || inspection.kind === 'Invalid') {
        return notCompleted('IntegrityBlocked', { stage: 'Read', name: 'IntegrityBlocked', message: `The journal root is ${inspection.kind}`, context: { rootKind: inspection.kind } });
      }
      const layout = exportLayoutFor(inspection.schemaVersion);
      const tabled = SEED_MANIFEST_VERSIONS[inspection.schemaVersion];
      if (!layout || !tabled) {
        return notCompleted('IntegrityBlocked', {
          stage: 'Read',
          name: 'IntegrityBlocked',
          message: `No export layout for schema version ${inspection.schemaVersion}`,
          context: { rootKind: inspection.kind, schemaVersion: inspection.schemaVersion },
        });
      }
      // Schema 7 changed no store, so the table cannot tell a Workspace not yet started on a later seed from one that was:
      // a current-schema Workspace says which Journal manifest it holds by its stored forms (D9.5 A323).
      const stored = inspection.kind === 'KnownWorkspace' ? await storedJournalSeed(deps.persistence) : undefined;
      const seeds = stored === undefined ? tabled : { ...tabled, journal: stored };
      const run = await exporter.run({
        databaseName: inspection.databaseName,
        layout,
        exportKind: inspection.kind === 'OlderSchema' ? 'BlockedDatabase' : 'Normal',
        createdAt: deps.clock.now(),
        releaseId: deps.releaseId,
        seedManifestVersions: seeds,
        expectedBinding: request.expectedBinding,
        onProgress: request.onProgress,
      }).catch((error: unknown): { readonly kind: 'Failed'; readonly detail: FailureDetail } => ({ kind: 'Failed', detail: describeError('Read', error) }));
      if (run.kind === 'Conflict') return run;
      if (run.kind === 'Failed') {
        // The read changed nothing; describe the database to show the Workspace unchanged.
        const described = await deps.persistence.describeDatabase(inspection.databaseName).catch(() => undefined);
        const workspaceBinding = described && { databaseName: described.databaseName, contentRevision: described.contentRevision };
        return notCompleted('ReadFailed', run.detail, workspaceBinding);
      }
      const stamp = toWorkspaceLocal(deps.clock.now(), run.timeZone).replace('T', '-').replace(':', '');
      const fileName = `trade-journal-${stamp}-${run.fullDigest.slice(0, 8)}.tjbackup`;
      let offerError: FailureDetail | undefined;
      const offered = await deps.backup?.download?.offer({ blob: run.blob, fileName, type: 'application/octet-stream' }).catch((error: unknown) => {
        offerError = describeError('Offer', error);
        return undefined;
      });
      if (offered?.kind !== 'Offered') {
        const detail: FailureDetail =
          offerError ??
          (offered
            ? { stage: 'Offer', name: 'OfferFailed', message: offered.reason }
            : { stage: 'Offer', name: 'NoDownloadPort', message: 'The host supplied no download port' });
        return { kind: 'NotCompleted', stage: 'Offer', reason: 'OfferFailed', workspaceBinding: run.sourceBinding, detail };
      }
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
      if (verified.kind !== 'Verified') return { kind: 'NotVerified', reason: verified.kind, detail: verified.detail };
      const expected = request.expectedBinding;
      const comparisons = [
        { check: 'fullDigest', same: verified.fullDigest === request.expectedFullDigest },
        { check: 'databaseName', same: verified.binding.databaseName === expected.databaseName },
        { check: 'contentRevision', same: verified.binding.contentRevision === expected.contentRevision },
      ] as const;
      const differing = comparisons.find((comparison) => !comparison.same)?.check;
      if (differing) {
        return { kind: 'NotVerified', reason: 'DifferentArtifact', detail: { stage: 'Verify', name: 'DifferentArtifact', message: `The backup differs from the expected one in its ${differing}`, context: { check: differing } } };
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
