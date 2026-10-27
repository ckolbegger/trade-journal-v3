import {
  getInstalledCapabilityManifest,
  type InstalledCapabilityManifest,
} from './capability-manifest';
import {
  requestWorkspaceDurability,
  type DurabilityRequestAdapters,
  type DurabilityRequestResult,
} from './request-durability';
import type { RuntimeReadinessReport } from './runtime-readiness';
import {
  SCHEMA_VERSION_V1,
  STORE_WORKSPACE_META,
  type WorkspaceInitializationReceiptRecord,
  type WorkspaceMetaRecord,
} from '../../persistence/schema-v1';
import type { TransactionManager } from '../../persistence/transaction-manager';

export type WorkspaceOnboardingState =
  | 'NeedsInstitutionAndAccount'
  | 'ReadyForTradePlanning';

export interface ReadyWorkspaceSummary {
  readonly workspaceId: string;
  readonly schemaVersion: 1;
  readonly snapshotBinding: string;
  readonly timeZone: string;
  readonly settingsRevision: number;
  readonly catalogSnapshotId: string;
  readonly onboardingState: WorkspaceOnboardingState;
  readonly selectableAccountCount: number;
  readonly institutionCount: number;
  readonly accountCount: number;
  readonly capabilityManifest: InstalledCapabilityManifest;
  readonly latestReceipt: WorkspaceInitializationReceiptRecord;
}

export type WorkspaceStatusResult =
  | {
      readonly status: 'InitializationRequired';
      readonly readinessReport: RuntimeReadinessReport;
      readonly suggestedTimeZone: string;
      readonly capabilityManifest: InstalledCapabilityManifest;
    }
  | {
      readonly status: 'Ready';
      readonly readinessReport: RuntimeReadinessReport;
      readonly workspace: ReadyWorkspaceSummary;
    }
  | {
      readonly status: 'RecoveryOnly';
      readonly readinessReport: RuntimeReadinessReport;
      readonly workspace: ReadyWorkspaceSummary;
    }
  | {
      readonly status: 'Unsupported';
      readonly readinessReport: RuntimeReadinessReport;
      readonly capabilityManifest: InstalledCapabilityManifest;
    }
  | {
      readonly status: 'IntegrityBlocked';
      readonly readinessReport: RuntimeReadinessReport;
      readonly capabilityManifest: InstalledCapabilityManifest;
      readonly reason: string;
    };

export type InitializeWorkspaceResult =
  | {
      readonly outcome: 'Opened';
      readonly statusResult: Extract<WorkspaceStatusResult, { readonly status: 'Ready' }>;
      readonly receipt: WorkspaceInitializationReceiptRecord;
    }
  | {
      readonly outcome: 'TimeZoneSelectionRequired';
      readonly suggestedTimeZone: string;
      readonly message: string;
    }
  | {
      readonly outcome: 'InvalidTimeZone';
      readonly providedTimeZone: string;
      readonly message: string;
    }
  | {
      readonly outcome: 'RuntimeNotWritable';
      readonly readinessReport: RuntimeReadinessReport;
      readonly message: string;
    }
  | {
      readonly outcome: 'IntegrityBlocked';
      readonly readinessReport: RuntimeReadinessReport;
      readonly message: string;
    };

export type SaveWorkspaceSettingsResult =
  | {
      readonly outcome: 'Saved';
      readonly statusResult: Extract<WorkspaceStatusResult, { readonly status: 'Ready' }>;
    }
  | {
      readonly outcome: 'Unchanged';
      readonly statusResult: Extract<WorkspaceStatusResult, { readonly status: 'Ready' }>;
    }
  | {
      readonly outcome: 'Conflict';
      readonly expectedSettingsRevision: number;
      readonly actualSettingsRevision: number;
      readonly currentStatus: Extract<WorkspaceStatusResult, { readonly status: 'Ready' }>;
      readonly message: string;
    }
  | {
      readonly outcome: 'InvalidTimeZone';
      readonly providedTimeZone: string;
      readonly message: string;
    }
  | {
      readonly outcome: 'RuntimeNotWritable';
      readonly readinessReport: RuntimeReadinessReport;
      readonly message: string;
    }
  | {
      readonly outcome: 'WorkspaceNotInitialized';
      readonly message: string;
    };

export function isValidIanaTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== 'string') return false;
  if (timeZone !== timeZone.trim() || timeZone.length === 0) return false;

  // Reject fixed UTC offsets (+05:00, -04:00, GMT+2, UTC-5, Etc/GMT+5)
  if (/^[+-]\d/.test(timeZone)) return false;
  if (/^(?:GMT|UTC)[+-]/i.test(timeZone)) return false;
  if (/^Etc\/GMT[+-]/i.test(timeZone)) return false;

  // Require either 'UTC' or a canonical Area/Location IANA identifier containing '/'
  if (timeZone !== 'UTC' && !timeZone.includes('/')) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export interface WorkspaceServiceDependencies {
  readonly transactionManager: TransactionManager;
  readonly evaluateReadiness: () => Promise<RuntimeReadinessReport>;
  readonly requestDurabilityAdapter: DurabilityRequestAdapters;
  readonly detectDefaultTimeZone?: () => string;
  readonly nowIso?: () => string;
}

export const COMMON_IANA_TIME_ZONES: readonly string[] = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'America/Indiana/Indianapolis',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Zurich',
  'Asia/Tokyo',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
];

export class WorkspaceService {
  private readonly tm: TransactionManager;
  private readonly evaluateReadiness: () => Promise<RuntimeReadinessReport>;
  private readonly requestDurabilityAdapter: DurabilityRequestAdapters;
  private readonly detectDefaultTimeZone: () => string;
  private readonly nowIso: () => string;
  private tokenCounter = 0;

  constructor(deps: WorkspaceServiceDependencies) {
    this.tm = deps.transactionManager;
    this.evaluateReadiness = deps.evaluateReadiness;
    this.requestDurabilityAdapter = deps.requestDurabilityAdapter;
    this.detectDefaultTimeZone =
      deps.detectDefaultTimeZone ??
      (() => {
        try {
          const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
          return isValidIanaTimeZone(detected) ? detected : 'America/New_York';
        } catch {
          return 'America/New_York';
        }
      });
    this.nowIso = deps.nowIso ?? (() => new Date().toISOString());
  }

  private nextToken(prefix: string): string {
    this.tokenCounter += 1;
    return `${prefix}-${Date.now()}-${this.tokenCounter}`;
  }

  public buildReadySummaryFromMeta(
    meta: WorkspaceMetaRecord,
    counts: {
      readonly institutionCount: number;
      readonly accountCount: number;
      readonly selectableAccountCount: number;
    },
  ): ReadyWorkspaceSummary {
    const onboardingState: WorkspaceOnboardingState =
      counts.selectableAccountCount > 0
        ? 'ReadyForTradePlanning'
        : 'NeedsInstitutionAndAccount';

    return {
      workspaceId: meta.workspaceId,
      schemaVersion: meta.schemaVersion,
      snapshotBinding: meta.snapshotBinding,
      timeZone: meta.timeZone,
      settingsRevision: meta.settingsRevision,
      catalogSnapshotId: meta.catalogSnapshotId,
      onboardingState,
      selectableAccountCount: counts.selectableAccountCount,
      institutionCount: counts.institutionCount,
      accountCount: counts.accountCount,
      capabilityManifest: getInstalledCapabilityManifest(),
      latestReceipt: meta.latestReceipt,
    };
  }

  public async getStatus(): Promise<WorkspaceStatusResult> {
    const report = await this.evaluateReadiness();
    this.tm.setReadinessMode(report.readiness);
    const capabilityManifest = getInstalledCapabilityManifest();

    if (report.workspaceIntegrity === 'IntegrityBlocked') {
      return {
        status: 'IntegrityBlocked',
        readinessReport: report,
        capabilityManifest,
        reason: report.summaryMessage,
      };
    }

    if (report.inspection.kind === 'ExistingReadableWorkspace') {
      const summary = this.buildReadySummaryFromMeta(report.inspection.meta, {
        institutionCount: report.inspection.institutions.length,
        accountCount: report.inspection.accounts.length,
        selectableAccountCount: report.inspection.selectableAccountCount,
      });

      if (report.readiness === 'Writable') {
        return {
          status: 'Ready',
          readinessReport: report,
          workspace: summary,
        };
      }

      return {
        status: 'RecoveryOnly',
        readinessReport: report,
        workspace: summary,
      };
    }

    if (report.readiness === 'Writable') {
      return {
        status: 'InitializationRequired',
        readinessReport: report,
        suggestedTimeZone: this.detectDefaultTimeZone(),
        capabilityManifest,
      };
    }

    return {
      status: 'Unsupported',
      readinessReport: report,
      capabilityManifest,
    };
  }

  public async initialize(request: {
    readonly proposedTimeZone?: string;
  }): Promise<InitializeWorkspaceResult> {
    const report = await this.evaluateReadiness();
    this.tm.setReadinessMode(report.readiness);

    if (report.workspaceIntegrity === 'IntegrityBlocked') {
      return {
        outcome: 'IntegrityBlocked',
        readinessReport: report,
        message: report.summaryMessage,
      };
    }

    if (report.readiness !== 'Writable') {
      return {
        outcome: 'RuntimeNotWritable',
        readinessReport: report,
        message: report.summaryMessage,
      };
    }

    // If an existing valid v1 Workspace is already present, open idempotently without overwriting
    if (report.inspection.kind === 'ExistingReadableWorkspace') {
      const existingMeta = report.inspection.meta;
      const now = this.nowIso();
      const reopenReceipt: WorkspaceInitializationReceiptRecord = {
        receiptId: this.nextToken('rcpt'),
        openedAt: now,
        isFreshInitialization: false,
        fromSchemaVersion: existingMeta.schemaVersion,
        toSchemaVersion: SCHEMA_VERSION_V1,
        migrationsApplied: [],
        catalogSeedVersion: 0,
        journalSeedVersion: 0,
        privateStateRebuilt: false,
        incompleteTransactionRecovered: false,
      };

      const updatedMeta: WorkspaceMetaRecord = {
        ...existingMeta,
        latestReceipt: reopenReceipt,
      };

      const summary = this.buildReadySummaryFromMeta(updatedMeta, {
        institutionCount: report.inspection.institutions.length,
        accountCount: report.inspection.accounts.length,
        selectableAccountCount: report.inspection.selectableAccountCount,
      });

      return {
        outcome: 'Opened',
        statusResult: {
          status: 'Ready',
          readinessReport: report,
          workspace: summary,
        },
        receipt: reopenReceipt,
      };
    }

    if (request.proposedTimeZone === undefined) {
      return {
        outcome: 'TimeZoneSelectionRequired',
        suggestedTimeZone: this.detectDefaultTimeZone(),
        message: 'Please select a rules-based IANA time zone to initialize this workspace.',
      };
    }

    if (!isValidIanaTimeZone(request.proposedTimeZone)) {
      return {
        outcome: 'InvalidTimeZone',
        providedTimeZone: request.proposedTimeZone,
        message: `Invalid time zone "${request.proposedTimeZone}". Choose a rules-based IANA time zone such as "America/New_York".`,
      };
    }

    const now = this.nowIso();
    const receipt: WorkspaceInitializationReceiptRecord = {
      receiptId: this.nextToken('rcpt'),
      openedAt: now,
      isFreshInitialization: true,
      fromSchemaVersion: null,
      toSchemaVersion: SCHEMA_VERSION_V1,
      migrationsApplied: [],
      catalogSeedVersion: 0,
      journalSeedVersion: 0,
      privateStateRebuilt: false,
      incompleteTransactionRecovered: false,
    };

    const metaRecord: WorkspaceMetaRecord = {
      key: 'root',
      workspaceId: this.nextToken('ws'),
      schemaVersion: SCHEMA_VERSION_V1,
      snapshotBinding: this.nextToken('snap'),
      timeZone: request.proposedTimeZone,
      settingsRevision: 1,
      catalogSnapshotId: this.nextToken('cat'),
      createdAt: now,
      updatedAt: now,
      latestReceipt: receipt,
    };

    const txRes = await this.tm.executeWriteTransaction([STORE_WORKSPACE_META], async (tx) => {
      await tx.objectStore(STORE_WORKSPACE_META).put(metaRecord);
      return metaRecord;
    });

    if (!txRes.ok) {
      return {
        outcome: 'RuntimeNotWritable',
        readinessReport: report,
        message: txRes.error.message,
      };
    }

    const summary = this.buildReadySummaryFromMeta(metaRecord, {
      institutionCount: 0,
      accountCount: 0,
      selectableAccountCount: 0,
    });

    return {
      outcome: 'Opened',
      statusResult: {
        status: 'Ready',
        readinessReport: report,
        workspace: summary,
      },
      receipt,
    };
  }

  public async saveSettings(command: {
    readonly timeZone: string;
    readonly expectedSettingsRevision: number;
  }): Promise<SaveWorkspaceSettingsResult> {
    const report = await this.evaluateReadiness();
    this.tm.setReadinessMode(report.readiness);

    if (report.readiness !== 'Writable') {
      return {
        outcome: 'RuntimeNotWritable',
        readinessReport: report,
        message: report.summaryMessage,
      };
    }

    if (report.inspection.kind !== 'ExistingReadableWorkspace') {
      return {
        outcome: 'WorkspaceNotInitialized',
        message: 'Cannot save workspace settings before the workspace has been initialized.',
      };
    }

    if (!isValidIanaTimeZone(command.timeZone)) {
      return {
        outcome: 'InvalidTimeZone',
        providedTimeZone: command.timeZone,
        message: `Invalid IANA time zone "${command.timeZone}". Choose a rules-based IANA time zone such as "America/New_York".`,
      };
    }

    const currentMeta = report.inspection.meta;
    const counts = {
      institutionCount: report.inspection.institutions.length,
      accountCount: report.inspection.accounts.length,
      selectableAccountCount: report.inspection.selectableAccountCount,
    };

    if (command.expectedSettingsRevision !== currentMeta.settingsRevision) {
      const currentSummary = this.buildReadySummaryFromMeta(currentMeta, counts);
      return {
        outcome: 'Conflict',
        expectedSettingsRevision: command.expectedSettingsRevision,
        actualSettingsRevision: currentMeta.settingsRevision,
        currentStatus: {
          status: 'Ready',
          readinessReport: report,
          workspace: currentSummary,
        },
        message: `Workspace settings were modified in another view (expected revision ${command.expectedSettingsRevision}, current revision is ${currentMeta.settingsRevision}). Review the latest settings and save again.`,
      };
    }

    if (command.timeZone === currentMeta.timeZone) {
      const currentSummary = this.buildReadySummaryFromMeta(currentMeta, counts);
      return {
        outcome: 'Unchanged',
        statusResult: {
          status: 'Ready',
          readinessReport: report,
          workspace: currentSummary,
        },
      };
    }

    const now = this.nowIso();
    const updatedMeta: WorkspaceMetaRecord = {
      ...currentMeta,
      timeZone: command.timeZone,
      settingsRevision: currentMeta.settingsRevision + 1,
      snapshotBinding: this.nextToken('snap'),
      updatedAt: now,
    };

    const txRes = await this.tm.executeWriteTransaction([STORE_WORKSPACE_META], async (tx) => {
      await tx.objectStore(STORE_WORKSPACE_META).put(updatedMeta);
      return updatedMeta;
    });

    if (!txRes.ok) {
      return {
        outcome: 'RuntimeNotWritable',
        readinessReport: report,
        message: txRes.error.message,
      };
    }

    const updatedSummary = this.buildReadySummaryFromMeta(updatedMeta, counts);
    return {
      outcome: 'Saved',
      statusResult: {
        status: 'Ready',
        readinessReport: report,
        workspace: updatedSummary,
      },
    };
  }

  public async requestDurability(): Promise<DurabilityRequestResult> {
    return requestWorkspaceDurability(this.requestDurabilityAdapter);
  }
}
