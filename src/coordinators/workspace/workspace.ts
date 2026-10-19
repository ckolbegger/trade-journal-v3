import type { HostPort } from '../../delivery/host.ts';
import type { ReadinessEvaluation, ReadinessSession, StorageProtection } from '../../delivery/readiness.ts';
import type { ReadinessFailure, RuntimeNotWritable, SafeAction } from '../../delivery/runtime-not-writable.ts';
import { toRuntimeNotWritable } from '../../delivery/write-gate.ts';
import { validateTimeZone, type Clock } from '../../domain/time/index.ts';
import { D1_JOURNAL_MANIFEST, prepareJournalSeed, type Journal } from '../../modules/journal/index.ts';
import { D1_CATALOG_MANIFEST, prepareSeed, type ReferenceCatalog } from '../../modules/reference-catalog/index.ts';
import { SCHEMA_VERSION } from '../../persistence/schema.ts';
import type { IdGenerator, Persistence, StoreRecord, WorkspaceSnapshotBinding } from '../../persistence/index.ts';
import { installedCapabilities, type InstalledCapabilityManifest } from './capabilities.ts';

export interface WorkspaceDeps {
  readonly persistence: Persistence;
  readonly session: ReadinessSession;
  readonly catalog: ReferenceCatalog;
  readonly journal: Journal;
  readonly host: HostPort;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly releaseId: string;
}

export interface InitializeWorkspace {
  readonly timeZone?: string;
}

export type Onboarding = 'NeedsInstitutionAndAccount' | 'ReadyForTradePlanning';

interface StatusBase {
  // The observation instant this status was read at.
  readonly observedAt: string;
  readonly installedCapabilities: InstalledCapabilityManifest;
  // Current Runtime Readiness with its per-check evidence.
  readonly readiness: ReadinessEvaluation;
  readonly protection: StorageProtection;
}

export type WorkspaceStatus =
  | ReadyStatus
  | (StatusBase & { readonly kind: 'InitializationRequired' })
  // Readable: ordinary reads remain available while every write is refused.
  | (StatusBase & {
      readonly kind: 'RecoveryOnly';
      readonly failedChecks: readonly ReadinessFailure[];
      readonly binding: WorkspaceSnapshotBinding;
      readonly timeZone: string;
    })
  | (StatusBase & { readonly kind: 'Unsupported'; readonly failedChecks: readonly ReadinessFailure[] })
  // A known or possible existing root that cannot be read or validated: never treated as empty.
  | (StatusBase & {
      readonly kind: 'IntegrityBlocked';
      readonly failedChecks: readonly ReadinessFailure[];
      readonly root?: 'PossibleRoot' | 'KnownRoot';
      readonly reason?: 'MissingMeta' | 'UnknownSchemaVersion';
    });

export interface ReadyStatus {
  readonly kind: 'Ready';
  readonly observedAt: string;
  readonly binding: WorkspaceSnapshotBinding;
  readonly timeZone: string;
  readonly onboarding: Onboarding;
  readonly installedCapabilities: InstalledCapabilityManifest;
  // Current Runtime Readiness with its per-check evidence.
  readonly readiness: ReadinessEvaluation;
  readonly protection: StorageProtection;
  readonly schemaVersion: number;
  readonly latestReceipt: InitializationReceipt | null;
}

export interface SeedReceipt {
  readonly manifestVersion: number;
  readonly additions: readonly string[];
}

export interface InitializationReceipt {
  readonly fresh: boolean;
  readonly readiness: ReadinessEvaluation;
  readonly seeds: { readonly catalog: SeedReceipt; readonly journal: SeedReceipt };
}

export type WorkspaceInitializationResult =
  | RuntimeNotWritable
  | { readonly kind: 'TimeZoneSelectionRequired' }
  // Readiness passed, but the stored Workspace cannot be validated; it is never treated as empty.
  | {
      readonly kind: 'IntegrityBlocked';
      readonly reason: 'MissingMeta' | 'UnknownSchemaVersion';
      readonly recoveryActions: readonly SafeAction[];
    }
  | { readonly kind: 'Rejected'; readonly issues: readonly { readonly code: 'InvalidTimeZone' }[] }
  | { readonly kind: 'Opened'; readonly status: ReadyStatus; readonly receipt: InitializationReceipt };

export interface Workspace {
  initialize(request: InitializeWorkspace): Promise<WorkspaceInitializationResult>;
  // Reads status under the current session's readiness; it never mutates or repairs.
  getStatus(): Promise<WorkspaceStatus>;
  // One explicit trader gesture asking the host for stronger local persistence. Advisory: it
  // never changes Runtime Readiness and never replaces backup.
  requestDurability(): Promise<WorkspaceDurabilityResult>;
}

export type WorkspaceDurabilityResult =
  | { readonly kind: 'Improved'; readonly currentProtection: 'Protected' }
  | { readonly kind: 'AlreadyProtected'; readonly currentProtection: 'Protected' }
  | {
      readonly kind: 'NotImproved';
      readonly currentProtection:
        | { readonly kind: 'BestEffort'; readonly reason: 'HostDeclined' }
        | { readonly kind: 'Unavailable'; readonly reason: 'NoStorageManager' };
    };

export function createWorkspace(deps: WorkspaceDeps): Workspace {
  let latestReceipt: InitializationReceipt | null = null;
  // Protection learned from an explicit durability request after the session's last evaluation;
  // it is reported, never fed into Runtime Readiness.
  let requestedProtection: StorageProtection | undefined;
  const protectionOf = (readiness: ReadinessEvaluation) => requestedProtection ?? readiness.protection;

  // The Ready status of the open Workspace, read from one snapshot.
  async function readyStatus(readiness: ReadinessEvaluation): Promise<ReadyStatus> {
    const { value, binding } = await deps.persistence.readSnapshot(['meta'], (tx) => tx.get('meta', 'settings'));
    // Onboarding is derived from the Catalog: Trade planning needs one selectable Account.
    const accounts = await deps.catalog.query({ family: 'Account', pageSize: 1 });
    return {
      kind: 'Ready',
      observedAt: deps.clock.now(),
      binding,
      timeZone: (value as { timeZone: string }).timeZone,
      onboarding: accounts.kind === 'Page' && accounts.items.length > 0 ? 'ReadyForTradePlanning' : 'NeedsInstitutionAndAccount',
      installedCapabilities: installedCapabilities(deps.releaseId),
      readiness,
      protection: protectionOf(readiness),
      schemaVersion: SCHEMA_VERSION,
      latestReceipt,
    };
  }

  return {
    async requestDurability() {
      if (!deps.host.persisted || !deps.host.persist) {
        requestedProtection = 'Unavailable';
        return { kind: 'NotImproved', currentProtection: { kind: 'Unavailable', reason: 'NoStorageManager' } };
      }
      if (await deps.host.persisted()) {
        requestedProtection = 'Protected';
        return { kind: 'AlreadyProtected', currentProtection: 'Protected' };
      }
      // A denied request neither fabricates success nor touches any data.
      if (!(await deps.host.persist())) {
        requestedProtection = 'BestEffort';
        return { kind: 'NotImproved', currentProtection: { kind: 'BestEffort', reason: 'HostDeclined' } };
      }
      requestedProtection = 'Protected';
      return { kind: 'Improved', currentProtection: 'Protected' };
    },

    async getStatus() {
      const readiness = deps.session.current();
      const inspection = readiness.rootInspection;
      const base: StatusBase = {
        observedAt: deps.clock.now(),
        installedCapabilities: installedCapabilities(deps.releaseId),
        readiness,
        protection: protectionOf(readiness),
      };
      if (inspection?.kind === 'Unreadable') {
        return { ...base, kind: 'IntegrityBlocked', failedChecks: readiness.failures, root: inspection.root };
      }
      if (inspection?.kind === 'Invalid') {
        return { ...base, kind: 'IntegrityBlocked', failedChecks: readiness.failures, reason: inspection.reason };
      }
      if (readiness.outcome === 'Writable') {
        return inspection?.kind === 'KnownWorkspace' ? readyStatus(readiness) : { ...base, kind: 'InitializationRequired' };
      }
      if (readiness.outcome === 'RecoveryOnly') {
        const ready = await readyStatus(readiness);
        return { ...base, kind: 'RecoveryOnly', failedChecks: readiness.failures, binding: ready.binding, timeZone: ready.timeZone };
      }
      return { ...base, kind: 'Unsupported', failedChecks: readiness.failures };
    },

    async initialize(request) {
      // Initialization first re-establishes Runtime Readiness.
      const readiness = await deps.session.recheck();
      const refusal = toRuntimeNotWritable(readiness);
      // Outside Writable nothing is initialized, seeded, or imported.
      if (refusal) return refusal;
      if (readiness.rootInspection?.kind === 'Invalid') {
        return {
          kind: 'IntegrityBlocked',
          reason: readiness.rootInspection.reason,
          recoveryActions: [{ action: 'Retry', explanation: 'Your journal data may exist but cannot be read by this release. Nothing was changed.' }],
        };
      }
      if (readiness.rootInspection?.kind === 'KnownWorkspace') {
        // An existing Workspace receives only genuinely missing seeds.
        const catalog = await deps.catalog.seedDefaults(D1_CATALOG_MANIFEST);
        const journal = await deps.journal.seedDefaults(D1_JOURNAL_MANIFEST);
        latestReceipt = {
          fresh: false,
          readiness,
          seeds: {
            catalog: { manifestVersion: D1_CATALOG_MANIFEST.version, additions: catalog.kind === 'Seeded' ? catalog.additions : [] },
            journal: { manifestVersion: D1_JOURNAL_MANIFEST.version, additions: journal.kind === 'Seeded' ? journal.additions : [] },
          },
        };
        return { kind: 'Opened', status: await readyStatus(readiness), receipt: latestReceipt };
      }
      if (!request.timeZone) return { kind: 'TimeZoneSelectionRequired' };
      const zone = validateTimeZone(request.timeZone);
      if (!zone.ok) return { kind: 'Rejected', issues: [{ code: 'InvalidTimeZone' }] };
      const timeZone = zone.timeZone;
      const catalogSeed = prepareSeed([], D1_CATALOG_MANIFEST, deps.ids);
      const journalSeed = prepareJournalSeed([], [], D1_JOURNAL_MANIFEST, deps.ids);
      if (catalogSeed.kind !== 'Additions' || journalSeed.kind !== 'Additions') throw new Error('Fresh seeds cannot conflict');
      // Metadata and both modules' defaults are written by the one Workspace-creating transaction.
      const records: StoreRecord[] = [
        { store: 'meta', value: { key: 'settings', timeZone, settingsRevision: 1 } },
        { store: 'meta', value: { key: 'catalog', catalogRevision: 1 } },
        { store: 'meta', value: { key: 'journal', journalRevision: 1 } },
        ...catalogSeed.records.map((r): StoreRecord => ({ store: 'catalog', value: { ...r } })),
        ...journalSeed.types.map((t): StoreRecord => ({ store: 'journalTypes', value: { ...t } })),
        ...journalSeed.definitions.map((d): StoreRecord => ({ store: 'journalDefinitions', value: { ...d } })),
      ];
      const created = await deps.persistence.createWorkspace(records);
      if (created.kind !== 'Created') throw new Error(`Workspace not created: ${created.kind}`);
      latestReceipt = {
        fresh: true,
        readiness,
        seeds: {
          catalog: { manifestVersion: D1_CATALOG_MANIFEST.version, additions: catalogSeed.records.map((r) => r.productKey) },
          journal: { manifestVersion: D1_JOURNAL_MANIFEST.version, additions: journalSeed.types.map((t) => t.productKey) },
        },
      };
      // The session re-evaluates so it describes the Workspace that now exists. The response
      // carries the new status, so no getStatus follows a successful initialize.
      return { kind: 'Opened', status: await readyStatus(await deps.session.recheck()), receipt: latestReceipt };
    },
  };
}
