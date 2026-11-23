import {
  CATALOG_SEED_MANIFEST_VERSION,
  type ReferenceCatalog,
} from '../catalog/reference-catalog';
import {
  SCHEMA_VERSION_V1,
  type AccountRecord,
  type CatalogMetaRecord,
  type InstitutionRecord,
  type PersistenceSeam,
  type WorkspaceMetaRecord,
} from '../persistence/idb';
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
  readonly clock: Clock;
  readonly requestPersistentStorage: () => Promise<StorageProtectionStatus>;
}): Workspace {
  const { persistence, readiness, catalog, clock, requestPersistentStorage } = options;

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
        const seeded = await catalog.seedDefaults();
        if (seeded.status === 'RuntimeNotWritable') {
          return {
            status: 'RuntimeNotWritable',
            reason: seeded.reason,
            readiness: readiness.getCurrent() ?? readinessSnapshot,
          };
        }
        const workspaceStatus = await loadStatusSnapshot(root.workspaceMeta, readinessSnapshot);
        return {
          status: 'Opened',
          fresh: false,
          workspaceStatus,
          receipt: {
            evaluatedAt: readinessSnapshot.evaluatedAt,
            fresh: false,
            schemaVersion: root.schemaVersion,
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
        ['workspace_meta', 'catalog_meta', 'catalog_institutions', 'catalog_accounts'],
        async (tx) => {
          const [existingMeta, existingCatalogMeta, institutions, accounts] = await Promise.all([
            tx.get('workspace_meta', 'singleton'),
            tx.get('catalog_meta', 'singleton'),
            tx.getAll('catalog_institutions'),
            tx.getAll('catalog_accounts'),
          ]);

          // Guard against concurrent initialization overwriting existing singleton metadata
          if (existingMeta) {
            return {
              fresh: false,
              meta: existingMeta,
              catalogRevision: existingCatalogMeta?.catalogRevision ?? 0,
              institutions,
              accounts,
            };
          }

          const workspaceMeta: WorkspaceMetaRecord = {
            key: 'singleton',
            schemaVersion: SCHEMA_VERSION_V1,
            timeZone: request.proposedTimeZone!,
            settingsRevision: 1,
            workspaceRevision: 1,
            initializedAt: now,
            updatedAt: now,
          };
          const nextCatalogRevision = (existingCatalogMeta?.catalogRevision ?? 0) + 1;
          const catalogMeta: CatalogMetaRecord = {
            key: 'singleton',
            catalogRevision: nextCatalogRevision,
            seedManifestVersion: CATALOG_SEED_MANIFEST_VERSION,
            seededAt: now,
          };
          tx.put('workspace_meta', workspaceMeta);
          tx.put('catalog_meta', catalogMeta);

          return {
            fresh: true,
            meta: workspaceMeta,
            catalogRevision: nextCatalogRevision,
            institutions,
            accounts,
          };
        },
      );

      if (txResult.status === 'RuntimeNotWritable') {
        return {
          status: 'RuntimeNotWritable',
          reason: txResult.reason,
          readiness: readiness.getCurrent() ?? readinessSnapshot,
        };
      }

      const workspaceStatus = assembleStatusSnapshot({
        meta: txResult.value.meta,
        catalogRevision: txResult.value.catalogRevision,
        institutions: txResult.value.institutions,
        accounts: txResult.value.accounts,
        readinessSnapshot,
      });

      return {
        status: 'Opened',
        fresh: txResult.value.fresh,
        workspaceStatus,
        receipt: {
          evaluatedAt: readinessSnapshot.evaluatedAt,
          fresh: txResult.value.fresh,
          schemaVersion: SCHEMA_VERSION_V1,
          seedManifestVersion: CATALOG_SEED_MANIFEST_VERSION,
          seedAdditions: [],
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
