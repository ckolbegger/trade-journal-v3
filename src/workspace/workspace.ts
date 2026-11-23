import {
  buildLongStockStrategySeed,
  CATALOG_SEED_MANIFEST_VERSION,
  LONG_STOCK_PRODUCT_KEY,
  LONG_STOCK_STRATEGY_ID,
  type ReferenceCatalog,
} from '../catalog/reference-catalog';
import {
  buildPlanReflectionDefinitionV1,
  buildPositionChangeReflectionDefinitionV1,
  JOURNAL_SEED_MANIFEST_VERSION,
  PLAN_REFLECTION_TYPE_ID,
  POSITION_CHANGE_REFLECTION_TYPE_ID,
  type Journal,
} from '../journal/journal';
import {
  CURRENT_SCHEMA_VERSION,
  SCHEMA_VERSION_V1,
  SCHEMA_VERSION_V2,
  SCHEMA_VERSION_V3,
  type AccountRecord,
  type InstitutionRecord,
  type PersistenceSeam,
  type WorkspaceMetaRecord,
} from '../persistence/idb';
import {
  migrateWorkspaceV1ToV2,
  migrateWorkspaceV2ToV3,
  migrateWorkspaceV3ToV4,
} from '../persistence/migrations';
import type {
  RuntimeReadinessController,
  RuntimeReadinessSnapshot,
} from '../runtime/readiness';
import {
  INSTALLED_CAPABILITY_MANIFEST,
  type InstalledCapabilityManifest,
} from '../shared/capabilities';
import type { Clock } from '../shared/clock';
import {
  formatWorkspaceBindingToken,
  type RuntimeNotWritableReason,
  type RuntimeNotWritableResult,
  type StorageProtectionStatus,
  type WorkspaceSnapshotBinding,
} from '../shared/result';

export type OnboardingState = 'NeedsInstitutionAndAccount' | 'ReadyForTradePlanning';

export interface WorkspaceStatusSnapshot {
  readonly binding: WorkspaceSnapshotBinding;
  readonly timeZone: string;
  readonly settingsRevision: number;
  readonly onboardingState: OnboardingState;
  readonly capabilities: InstalledCapabilityManifest;
  readonly readiness: RuntimeReadinessSnapshot;
  readonly schemaVersion: number;
  readonly institutionCount: number;
  readonly selectableAccountCount: number;
  readonly initializedAt: string;
  readonly updatedAt: string;
}

export interface WorkspaceInitializationReceipt {
  readonly evaluatedAt: string;
  readonly fresh: boolean;
  readonly schemaVersion: number;
  readonly seedManifestVersion: number;
  readonly seedAdditions: readonly string[];
}

export type WorkspaceInitializationResult =
  | {
      readonly status: 'Opened';
      readonly fresh: boolean;
      readonly workspaceStatus: WorkspaceStatusSnapshot;
      readonly receipt: WorkspaceInitializationReceipt;
    }
  | {
      readonly status: 'TimeZoneSelectionRequired';
      readonly readiness: RuntimeReadinessSnapshot;
    }
  | {
      readonly status: 'Rejected';
      readonly field: 'timeZone';
      readonly message: string;
    }
  | {
      readonly status: 'MigrationBlocked';
      readonly reason: string;
      readonly readiness: RuntimeReadinessSnapshot;
    }
  | {
      readonly status: 'RuntimeNotWritable';
      readonly reason: RuntimeNotWritableReason;
      readonly readiness: RuntimeReadinessSnapshot;
    };

export type WorkspaceStatusResult =
  | { readonly status: 'Ready'; readonly workspaceStatus: WorkspaceStatusSnapshot }
  | { readonly status: 'InitializationRequired'; readonly readiness: RuntimeReadinessSnapshot }
  | {
      readonly status: 'RecoveryOnly';
      readonly workspaceStatus: WorkspaceStatusSnapshot;
      readonly readiness: RuntimeReadinessSnapshot;
    }
  | { readonly status: 'Unsupported'; readonly readiness: RuntimeReadinessSnapshot }
  | {
      readonly status: 'IntegrityBlocked';
      readonly reason: string;
      readonly readiness: RuntimeReadinessSnapshot;
    };

export type SaveWorkspaceSettingsResult =
  | { readonly status: 'Saved'; readonly workspaceStatus: WorkspaceStatusSnapshot }
  | { readonly status: 'Unchanged'; readonly workspaceStatus: WorkspaceStatusSnapshot }
  | {
      readonly status: 'Conflict';
      readonly currentTimeZone: string;
      readonly currentSettingsRevision: number;
    }
  | { readonly status: 'Rejected'; readonly field: 'timeZone' | 'workspace'; readonly message: string }
  | RuntimeNotWritableResult;

export type WorkspaceDurabilityResult =
  | { readonly status: 'Improved'; readonly currentProtection: { readonly state: 'Protected' } }
  | {
      readonly status: 'AlreadyProtected';
      readonly currentProtection: { readonly state: 'Protected' };
    }
  | {
      readonly status: 'NotImproved';
      readonly currentProtection: Exclude<StorageProtectionStatus, { readonly state: 'Protected' }>;
    };

export interface Workspace {
  initialize(request: { readonly proposedTimeZone?: string }): Promise<WorkspaceInitializationResult>;
  getStatus(): Promise<WorkspaceStatusResult>;
  saveSettings(command: {
    readonly timeZone: string;
    readonly expectedSettingsRevision: number;
  }): Promise<SaveWorkspaceSettingsResult>;
  requestDurability(): Promise<WorkspaceDurabilityResult>;
}

export function isValidIanaTimeZone(timeZone: string): boolean {
  const trimmed = timeZone.trim();
  if (!trimmed || trimmed !== timeZone) {
    return false;
  }
  if (trimmed !== 'UTC' && !trimmed.includes('/')) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

function assembleStatusSnapshot(params: {
  meta: WorkspaceMetaRecord;
  catalogRevision: number;
  institutions: readonly InstitutionRecord[];
  accounts: readonly AccountRecord[];
  readinessSnapshot: RuntimeReadinessSnapshot;
}): WorkspaceStatusSnapshot {
  const { meta, catalogRevision, institutions, accounts, readinessSnapshot } = params;
  const activeInstIds = new Set(
    institutions.filter((inst) => inst.status === 'Active').map((inst) => inst.id),
  );
  const selectableAccountCount = accounts.filter(
    (acct) => acct.status === 'Active' && activeInstIds.has(acct.institutionId),
  ).length;

  return {
    binding: {
      schemaVersion: meta.schemaVersion,
      workspaceRevision: meta.workspaceRevision,
      catalogRevision,
      bindingToken: formatWorkspaceBindingToken(
        meta.schemaVersion,
        meta.workspaceRevision,
        catalogRevision,
      ),
    },
    timeZone: meta.timeZone,
    settingsRevision: meta.settingsRevision,
    onboardingState:
      selectableAccountCount > 0 ? 'ReadyForTradePlanning' : 'NeedsInstitutionAndAccount',
    capabilities: INSTALLED_CAPABILITY_MANIFEST,
    readiness: readinessSnapshot,
    schemaVersion: meta.schemaVersion,
    institutionCount: institutions.length,
    selectableAccountCount,
    initializedAt: meta.initializedAt,
    updatedAt: meta.updatedAt,
  };
}

export function createWorkspace(options: {
  readonly persistence: PersistenceSeam;
  readonly readiness: RuntimeReadinessController;
  readonly catalog: ReferenceCatalog;
  readonly journal?: Journal;
  readonly clock: Clock;
  readonly requestPersistentStorage: () => Promise<StorageProtectionStatus>;
}): Workspace {
  const { persistence, readiness, catalog, journal, clock, requestPersistentStorage } = options;

  async function loadStatusSnapshot(
    meta: WorkspaceMetaRecord,
    readinessSnapshot: RuntimeReadinessSnapshot,
  ): Promise<WorkspaceStatusSnapshot> {
    const [catalogMeta, institutions, accounts] = await persistence.runReadTransaction(
      ['catalog_meta', 'catalog_institutions', 'catalog_accounts'],
      async (tx) =>
        Promise.all([
          tx.get('catalog_meta', 'singleton'),
          tx.getAll('catalog_institutions'),
          tx.getAll('catalog_accounts'),
        ]),
    );
    return assembleStatusSnapshot({
      meta,
      catalogRevision: catalogMeta?.catalogRevision ?? 0,
      institutions,
      accounts,
      readinessSnapshot,
    });
  }

  return {
    async initialize(request): Promise<WorkspaceInitializationResult> {
      const readinessSnapshot = await readiness.evaluate();

      if (readinessSnapshot.integrityBlocked) {
        return {
          status: 'RuntimeNotWritable',
          reason: 'IntegrityBlocked',
          readiness: readinessSnapshot,
        };
      }
      if (readinessSnapshot.state !== 'Writable') {
        return {
          status: 'RuntimeNotWritable',
          reason: readinessSnapshot.state,
          readiness: readinessSnapshot,
        };
      }

      const root = readinessSnapshot.rootInspection;
      if (root.status === 'IntegrityBlocked') {
        return {
          status: 'RuntimeNotWritable',
          reason: 'IntegrityBlocked',
          readiness: readinessSnapshot,
        };
      }

      if (root.status === 'Present') {
        let activeMeta = root.workspaceMeta;
        let activeSchemaVersion = root.schemaVersion;
        let activeGeneration = root.activeGeneration;
        let activeReadiness = readinessSnapshot;

        if (activeSchemaVersion === SCHEMA_VERSION_V1) {
          if (!persistence.indexedDB) {
            return {
              status: 'MigrationBlocked',
              reason: 'IndexedDB factory is unavailable for v1 to v2 migration.',
              readiness: readinessSnapshot,
            };
          }
          const migrated = await migrateWorkspaceV1ToV2({
            indexedDB: persistence.indexedDB,
            fromGeneration: activeGeneration,
          });
          if (migrated.status === 'MigrationBlocked') {
            return {
              status: 'MigrationBlocked',
              reason: migrated.reason,
              readiness: readinessSnapshot,
            };
          }
          const postV2 = await persistence.inspectRoot();
          if (postV2.status !== 'Present' || postV2.schemaVersion !== SCHEMA_VERSION_V2) {
            return {
              status: 'MigrationBlocked',
              reason: 'Post-migration v2 root verification failed.',
              readiness: readinessSnapshot,
            };
          }
          activeMeta = postV2.workspaceMeta;
          activeSchemaVersion = postV2.schemaVersion;
          activeGeneration = postV2.activeGeneration;
        }

        if (activeSchemaVersion === SCHEMA_VERSION_V2) {
          if (!persistence.indexedDB) {
            return {
              status: 'MigrationBlocked',
              reason: 'IndexedDB factory is unavailable for v2 to v3 migration.',
              readiness: readinessSnapshot,
            };
          }
          const migrated = await migrateWorkspaceV2ToV3({
            indexedDB: persistence.indexedDB,
            fromGeneration: activeGeneration,
          });
          if (migrated.status === 'MigrationBlocked') {
            return {
              status: 'MigrationBlocked',
              reason: migrated.reason,
              readiness: readinessSnapshot,
            };
          }
          const postV3 = await persistence.inspectRoot();
          if (postV3.status !== 'Present' || postV3.schemaVersion !== SCHEMA_VERSION_V3) {
            return {
              status: 'MigrationBlocked',
              reason: 'Post-migration v3 root verification failed.',
              readiness: readinessSnapshot,
            };
          }
          activeMeta = postV3.workspaceMeta;
          activeSchemaVersion = postV3.schemaVersion;
          activeGeneration = postV3.activeGeneration;
        }

        if (activeSchemaVersion === SCHEMA_VERSION_V3) {
          if (!persistence.indexedDB) {
            return {
              status: 'MigrationBlocked',
              reason: 'IndexedDB factory is unavailable for v3 to v4 migration.',
              readiness: readinessSnapshot,
            };
          }
          const migrated = await migrateWorkspaceV3ToV4({
            indexedDB: persistence.indexedDB,
            fromGeneration: activeGeneration,
          });
          if (migrated.status === 'MigrationBlocked') {
            return {
              status: 'MigrationBlocked',
              reason: migrated.reason,
              readiness: readinessSnapshot,
            };
          }
          const postV4 = await persistence.inspectRoot();
          if (postV4.status !== 'Present' || postV4.schemaVersion !== CURRENT_SCHEMA_VERSION) {
            return {
              status: 'MigrationBlocked',
              reason: 'Post-migration v4 root verification failed.',
              readiness: readinessSnapshot,
            };
          }
          activeMeta = postV4.workspaceMeta;
          activeSchemaVersion = postV4.schemaVersion;
          activeGeneration = postV4.activeGeneration;
          activeReadiness = await readiness.evaluate();
        }

        const seeded = await catalog.seedDefaults();
        if (seeded.status === 'RuntimeNotWritable') {
          return {
            status: 'RuntimeNotWritable',
            reason: seeded.reason,
            readiness: readiness.getCurrent() ?? activeReadiness,
          };
        }
        if (journal) {
          const journalSeeded = await journal.seedDefaults();
          if (journalSeeded.status === 'RuntimeNotWritable') {
            return {
              status: 'RuntimeNotWritable',
              reason: journalSeeded.reason,
              readiness: readiness.getCurrent() ?? activeReadiness,
            };
          }
        }
        const workspaceStatus = await loadStatusSnapshot(activeMeta, activeReadiness);
        return {
          status: 'Opened',
          fresh: false,
          workspaceStatus,
          receipt: {
            evaluatedAt: activeReadiness.evaluatedAt,
            fresh: false,
            schemaVersion: activeSchemaVersion,
            seedManifestVersion: seeded.seedManifestVersion,
            seedAdditions: seeded.additions,
          },
        };
      }

      if (!request.proposedTimeZone) {
        return {
          status: 'TimeZoneSelectionRequired',
          readiness: readinessSnapshot,
        };
      }

      if (!isValidIanaTimeZone(request.proposedTimeZone)) {
        return {
          status: 'Rejected',
          field: 'timeZone',
          message: `"${request.proposedTimeZone}" is not a valid IANA time zone (e.g., America/New_York).`,
        };
      }

      const now = clock.nowIso();
      const txResult = await persistence.runWriteTransaction(
        [
          'workspace_meta',
          'catalog_meta',
          'catalog_strategies',
          'journal_meta',
          'journal_definitions',
        ],
        async (tx) => {
          const [existingMeta, existingCatalogMeta, strategies, definitions] = await Promise.all([
            tx.get('workspace_meta', 'singleton'),
            tx.get('catalog_meta', 'singleton'),
            tx.getAll('catalog_strategies'),
            tx.getAll('journal_definitions'),
          ]);

          if (existingMeta) {
            return { fresh: false, meta: existingMeta, additions: [] as string[] };
          }

          const workspaceMeta: WorkspaceMetaRecord = {
            key: 'singleton',
            schemaVersion: CURRENT_SCHEMA_VERSION,
            timeZone: request.proposedTimeZone!,
            settingsRevision: 1,
            workspaceRevision: 1,
            initializedAt: now,
            updatedAt: now,
          };
          tx.put('workspace_meta', workspaceMeta);

          const additions: string[] = [];
          if (!strategies.some((s) => s.productKey === LONG_STOCK_PRODUCT_KEY)) {
            tx.put('catalog_strategies', buildLongStockStrategySeed(now));
            additions.push(LONG_STOCK_STRATEGY_ID);
          }
          tx.put('catalog_meta', {
            key: 'singleton',
            catalogRevision: (existingCatalogMeta?.catalogRevision ?? 0) + 1,
            seedManifestVersion: CATALOG_SEED_MANIFEST_VERSION,
            seededAt: now,
          });

          if (!definitions.some((d) => d.entryTypeId === PLAN_REFLECTION_TYPE_ID)) {
            tx.put('journal_definitions', buildPlanReflectionDefinitionV1(now));
          }
          if (!definitions.some((d) => d.entryTypeId === POSITION_CHANGE_REFLECTION_TYPE_ID)) {
            tx.put('journal_definitions', buildPositionChangeReflectionDefinitionV1(now));
          }
          tx.put('journal_meta', {
            key: 'singleton',
            seedManifestVersion: JOURNAL_SEED_MANIFEST_VERSION,
            seededAt: now,
          });

          return { fresh: true, meta: workspaceMeta, additions };
        },
      );

      if (txResult.status === 'RuntimeNotWritable') {
        return {
          status: 'RuntimeNotWritable',
          reason: txResult.reason,
          readiness: readiness.getCurrent() ?? readinessSnapshot,
        };
      }

      const workspaceStatus = await loadStatusSnapshot(txResult.value.meta, readinessSnapshot);

      return {
        status: 'Opened',
        fresh: txResult.value.fresh,
        workspaceStatus,
        receipt: {
          evaluatedAt: readinessSnapshot.evaluatedAt,
          fresh: txResult.value.fresh,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          seedManifestVersion: CATALOG_SEED_MANIFEST_VERSION,
          seedAdditions: txResult.value.additions,
        },
      };
    },

    async getStatus(): Promise<WorkspaceStatusResult> {
      const readinessSnapshot = readiness.getCurrent() ?? (await readiness.evaluate());
      const root = await persistence.inspectRoot();

      if (readinessSnapshot.integrityBlocked || root.status === 'IntegrityBlocked') {
        return {
          status: 'IntegrityBlocked',
          reason:
            root.status === 'IntegrityBlocked'
              ? root.reason
              : 'Existing workspace root could not be validated.',
          readiness: readinessSnapshot,
        };
      }

      if (root.status === 'Empty') {
        if (readinessSnapshot.state === 'Writable') {
          return { status: 'InitializationRequired', readiness: readinessSnapshot };
        }
        return { status: 'Unsupported', readiness: readinessSnapshot };
      }

      try {
        const workspaceStatus = await loadStatusSnapshot(root.workspaceMeta, readinessSnapshot);
        if (readinessSnapshot.state === 'Writable') {
          return { status: 'Ready', workspaceStatus };
        }
        return {
          status: 'RecoveryOnly',
          workspaceStatus,
          readiness: readinessSnapshot,
        };
      } catch (error) {
        return {
          status: 'IntegrityBlocked',
          reason: error instanceof Error ? error.message : 'Unable to read workspace status.',
          readiness: readinessSnapshot,
        };
      }
    },

    async saveSettings(command): Promise<SaveWorkspaceSettingsResult> {
      if (!isValidIanaTimeZone(command.timeZone)) {
        return {
          status: 'Rejected',
          field: 'timeZone',
          message: `"${command.timeZone}" is not a valid IANA time zone (e.g., America/New_York).`,
        };
      }

      const readinessSnapshot = readiness.getCurrent() ?? (await readiness.evaluate());

      const txResult = await persistence.runWriteTransaction(
        ['workspace_meta', 'catalog_meta', 'catalog_institutions', 'catalog_accounts'],
        async (tx): Promise<Exclude<SaveWorkspaceSettingsResult, RuntimeNotWritableResult>> => {
          const [currentMeta, catalogMeta, institutions, accounts] = await Promise.all([
            tx.get('workspace_meta', 'singleton'),
            tx.get('catalog_meta', 'singleton'),
            tx.getAll('catalog_institutions'),
            tx.getAll('catalog_accounts'),
          ]);

          if (!currentMeta) {
            return {
              status: 'Rejected',
              field: 'workspace',
              message: 'Workspace must be initialized before saving settings.',
            };
          }

          if (currentMeta.settingsRevision !== command.expectedSettingsRevision) {
            return {
              status: 'Conflict',
              currentTimeZone: currentMeta.timeZone,
              currentSettingsRevision: currentMeta.settingsRevision,
            };
          }

          const catalogRevision = catalogMeta?.catalogRevision ?? 0;

          if (currentMeta.timeZone === command.timeZone) {
            return {
              status: 'Unchanged',
              workspaceStatus: assembleStatusSnapshot({
                meta: currentMeta,
                catalogRevision,
                institutions,
                accounts,
                readinessSnapshot,
              }),
            };
          }

          const nextMeta: WorkspaceMetaRecord = {
            ...currentMeta,
            timeZone: command.timeZone,
            settingsRevision: currentMeta.settingsRevision + 1,
            workspaceRevision: currentMeta.workspaceRevision + 1,
            updatedAt: clock.nowIso(),
          };
          tx.put('workspace_meta', nextMeta);

          return {
            status: 'Saved',
            workspaceStatus: assembleStatusSnapshot({
              meta: nextMeta,
              catalogRevision,
              institutions,
              accounts,
              readinessSnapshot,
            }),
          };
        },
      );

      if (txResult.status === 'RuntimeNotWritable') {
        return txResult;
      }
      return txResult.value;
    },

    async requestDurability(): Promise<WorkspaceDurabilityResult> {
      const before = readiness.getCurrent()?.storageProtection;
      if (before?.state === 'Protected') {
        return {
          status: 'AlreadyProtected',
          currentProtection: { state: 'Protected' },
        };
      }

      try {
        const next = await requestPersistentStorage();
        readiness.updateStorageProtection(next);
        if (next.state === 'Protected') {
          return {
            status: 'Improved',
            currentProtection: { state: 'Protected' },
          };
        }
        return {
          status: 'NotImproved',
          currentProtection: next,
        };
      } catch (error) {
        const fallback: Exclude<StorageProtectionStatus, { readonly state: 'Protected' }> = {
          state: 'Unavailable',
          reason:
            error instanceof Error ? error.message : 'Unable to request persistent storage.',
        };
        readiness.updateStorageProtection(fallback);
        return {
          status: 'NotImproved',
          currentProtection: fallback,
        };
      }
    },
  };
}
