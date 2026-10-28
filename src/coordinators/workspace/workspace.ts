import type { HostPort } from '../../delivery/host.ts';
import type { ReadinessEvaluation, ReadinessSession, StorageProtection } from '../../delivery/readiness.ts';
import type { ReadinessFailure, RuntimeNotWritable, SafeAction } from '../../delivery/runtime-not-writable.ts';
import { toRuntimeNotWritable } from '../../delivery/write-gate.ts';
import { validateTimeZone, type Clock } from '../../domain/time/index.ts';
import { D2_JOURNAL_MANIFEST, prepareJournalSeed, type Journal } from '../../modules/journal/index.ts';
import { D1_CATALOG_MANIFEST, prepareSeed, type ReferenceCatalog } from '../../modules/reference-catalog/index.ts';
import { SCHEMA_VERSION } from '../../persistence/schema.ts';
import type { IdGenerator, LifecycleLock, Persistence, StoreRecord, WorkspaceSnapshotBinding } from '../../persistence/index.ts';
import { installedCapabilities, type InstalledCapabilityManifest } from './capabilities.ts';
import { migrate, type MigrationBlocked, type MigrationReceipt, type MigrationStageHooks } from './migration.ts';

export interface WorkspaceDeps {
  readonly persistence: Persistence;
  readonly session: ReadinessSession;
  readonly catalog: ReferenceCatalog;
  readonly journal: Journal;
  readonly host: HostPort;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly releaseId: string;
  // The exclusive Workspace lifecycle lock: one migration at a time across every tab (D2 A30).
  readonly locks: LifecycleLock;
  // Stage-boundary hooks for the faults build (T2.16); production passes none.
  readonly migrationHooks?: MigrationStageHooks;
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
      // AwaitingMigration: an older schema this release converts once readiness is Writable (D2 P6).
      readonly reason?: 'MissingMeta' | 'UnknownSchemaVersion' | 'UnsupportedNewerSchema' | 'AwaitingMigration';
    })
  // The last migration attempt failed: the old database is unchanged and nothing is Ready (D2 P6).
  | (StatusBase & Omit<MigrationBlocked, 'recoveryActions'>);

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
  // Present (false) only when this seed's counter retry was exhausted and it added nothing.
  readonly completed?: false;
}

function seedReceipt(manifestVersion: number, seed: { readonly kind: string; readonly additions?: readonly string[] }): SeedReceipt {
  if (seed.kind === 'Seeded') return { manifestVersion, additions: seed.additions ?? [] };
  return { manifestVersion, additions: [], completed: false };
}

export interface InitializationReceipt {
  readonly fresh: boolean;
  readonly readiness: ReadinessEvaluation;
  readonly seeds: { readonly catalog: SeedReceipt; readonly journal: SeedReceipt };
  // Present when this initialization migrated the Workspace from an older schema.
  readonly migration?: MigrationReceipt;
}

export type WorkspaceInitializationResult =
  | RuntimeNotWritable
  | { readonly kind: 'TimeZoneSelectionRequired' }
  // Readiness passed, but the stored Workspace cannot be validated; it is never treated as empty.
  | {
      readonly kind: 'IntegrityBlocked';
      readonly reason: 'MissingMeta' | 'UnknownSchemaVersion' | 'UnsupportedNewerSchema';
      readonly recoveryActions: readonly SafeAction[];
    }
  | { readonly kind: 'Rejected'; readonly issues: readonly { readonly code: 'InvalidTimeZone' }[] }
  | { readonly kind: 'Opened'; readonly status: ReadyStatus; readonly receipt: InitializationReceipt }
  | MigrationBlocked;

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
  // The last migration attempt's failure, until a migration succeeds.
  let blocked: MigrationBlocked | undefined;
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

  const workspace: Workspace = {
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
      if (inspection?.kind === 'OlderSchema' && blocked) {
        const { kind, stage, issues, fromVersion, toVersion, unchangedData } = blocked;
        return { ...base, kind, stage, issues, fromVersion, toVersion, unchangedData };
      }
      if (inspection?.kind === 'OlderSchema') {
        return { ...base, kind: 'IntegrityBlocked', failedChecks: readiness.failures, reason: 'AwaitingMigration' };
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
      if (readiness.rootInspection?.kind === 'OlderSchema') {
        // Under the lock the root is inspected again: another tab may have migrated meanwhile.
        const outcome = await deps.locks.run(async () => {
          const inspection = await deps.persistence.inspectRoot();
          if (inspection.kind !== 'OlderSchema') return undefined;
          return migrate(deps, inspection.databaseName, inspection.schemaVersion);
        });
        if (!outcome) return workspace.initialize(request);
        if (outcome.kind === 'MigrationBlocked') return (blocked = outcome);
        latestReceipt = {
          fresh: false,
          readiness,
          seeds: {
            catalog: { manifestVersion: D1_CATALOG_MANIFEST.version, additions: outcome.seeds.catalog },
            journal: { manifestVersion: D2_JOURNAL_MANIFEST.version, additions: outcome.seeds.journal },
          },
          migration: outcome.receipt,
        };
        // The session re-evaluates so it describes the migrated Workspace.
        return { kind: 'Opened', status: await readyStatus(await deps.session.recheck()), receipt: latestReceipt };
      }
      if (readiness.rootInspection?.kind === 'KnownWorkspace') {
        // An existing Workspace receives only genuinely missing seeds.
        const catalog = await deps.catalog.seedDefaults(D1_CATALOG_MANIFEST);
        // A refused seed is a refused write, not an Opened Workspace; Journal's seed is not attempted.
        if (catalog.kind === 'RuntimeNotWritable') return catalog;
        const journal = await deps.journal.seedDefaults(D2_JOURNAL_MANIFEST);
        if (journal.kind === 'RuntimeNotWritable') return journal;
        latestReceipt = {
          fresh: false,
          readiness,
          seeds: {
            catalog: seedReceipt(D1_CATALOG_MANIFEST.version, catalog),
            journal: seedReceipt(D2_JOURNAL_MANIFEST.version, journal),
          },
        };
        return { kind: 'Opened', status: await readyStatus(readiness), receipt: latestReceipt };
      }
      if (!request.timeZone) return { kind: 'TimeZoneSelectionRequired' };
      const zone = validateTimeZone(request.timeZone);
      if (!zone.ok) return { kind: 'Rejected', issues: [{ code: 'InvalidTimeZone' }] };
      const timeZone = zone.timeZone;
      const catalogSeed = prepareSeed([], D1_CATALOG_MANIFEST, deps.ids);
      const journalSeed = prepareJournalSeed([], [], D2_JOURNAL_MANIFEST, deps.ids);
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
      // A concurrent first run made its Workspace visible first (D1 A12): open that one instead.
      if (created.kind === 'AlreadyInitialized') return workspace.initialize(request);
      if (created.kind !== 'Created') throw new Error(`Workspace not created: ${created.kind}`);
      latestReceipt = {
        fresh: true,
        readiness,
        seeds: {
          catalog: { manifestVersion: D1_CATALOG_MANIFEST.version, additions: catalogSeed.records.map((r) => r.productKey) },
          journal: { manifestVersion: D2_JOURNAL_MANIFEST.version, additions: journalSeed.types.map((t) => t.productKey) },
        },
      };
      // The session re-evaluates so it describes the Workspace that now exists. The response
      // carries the new status, so no getStatus follows a successful initialize.
      return { kind: 'Opened', status: await readyStatus(await deps.session.recheck()), receipt: latestReceipt };
    },
  };
  return workspace;
}
