import {
  STORE_REFERENCE_CATALOG,
  STORE_WORKSPACE_META,
  type CatalogRevisionEntry,
  type StoredAccountRecord,
  type StoredInstitutionRecord,
  type WorkspaceMetaRecord,
} from '../../persistence/schema-v1';
import type { TransactionManager } from '../../persistence/transaction-manager';
import { getInstalledCapabilityManifest } from '../workspace/capability-manifest';
import type { RuntimeReadinessReport } from '../workspace/runtime-readiness';
import type { ReadyWorkspaceSummary } from '../workspace/workspace-service';

export type CatalogSaveCommand =
  | {
      readonly kind: 'CreateInstitution';
      readonly label: string;
      readonly expectedCatalogSnapshot: string;
    }
  | {
      readonly kind: 'CreateAccount';
      readonly parentInstitutionId: string;
      readonly label: string;
      readonly expectedCatalogSnapshot: string;
    };

export type CatalogSaveResult =
  | {
      readonly outcome: 'Saved';
      readonly createdKind: 'Institution';
      readonly institution: StoredInstitutionRecord;
      readonly appendedHistoryHead: CatalogRevisionEntry;
      readonly catalogSnapshotId: string;
      readonly workspaceSummary: ReadyWorkspaceSummary;
      readonly institutions: readonly StoredInstitutionRecord[];
      readonly accounts: readonly StoredAccountRecord[];
    }
  | {
      readonly outcome: 'Saved';
      readonly createdKind: 'Account';
      readonly account: StoredAccountRecord;
      readonly parentInstitution: StoredInstitutionRecord;
      readonly appendedHistoryHead: CatalogRevisionEntry;
      readonly catalogSnapshotId: string;
      readonly workspaceSummary: ReadyWorkspaceSummary;
      readonly institutions: readonly StoredInstitutionRecord[];
      readonly accounts: readonly StoredAccountRecord[];
    }
  | {
      readonly outcome: 'Rejected';
      readonly reason:
        | 'InvalidLabel'
        | 'DuplicateLabelInNamespace'
        | 'InvalidParentReference'
        | 'ParentNotSelectable';
      readonly message: string;
    }
  | {
      readonly outcome: 'Conflict';
      readonly expectedCatalogSnapshot: string;
      readonly actualCatalogSnapshot: string;
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

export type CatalogQueryRequest =
  | {
      readonly mode: 'ListInstitutions';
      readonly availabilityFilter?: 'SelectableOnly' | 'IncludeInactive';
      readonly cursor?: string;
      readonly limit?: number;
    }
  | {
      readonly mode: 'ListAccounts';
      readonly parentInstitutionId?: string;
      readonly availabilityFilter?: 'SelectableOnly' | 'IncludeInactive';
      readonly cursor?: string;
      readonly limit?: number;
    }
  | {
      readonly mode: 'GetItemHistory';
      readonly id: string;
    };

export type CatalogQueryResult =
  | {
      readonly outcome: 'InstitutionList';
      readonly catalogSnapshotId: string;
      readonly items: readonly StoredInstitutionRecord[];
      readonly nextCursor: string | null;
    }
  | {
      readonly outcome: 'AccountList';
      readonly catalogSnapshotId: string;
      readonly items: readonly StoredAccountRecord[];
      readonly institutionsById: Readonly<Record<string, StoredInstitutionRecord>>;
      readonly nextCursor: string | null;
    }
  | {
      readonly outcome: 'ItemHistory';
      readonly catalogSnapshotId: string;
      readonly item: StoredInstitutionRecord | StoredAccountRecord;
      readonly history: readonly CatalogRevisionEntry[];
    }
  | {
      readonly outcome: 'StaleCursor';
      readonly message: string;
    }
  | {
      readonly outcome: 'NotFound';
      readonly message: string;
    }
  | {
      readonly outcome: 'WorkspaceNotInitialized';
      readonly message: string;
    };

export interface ResolveAccountNewSelectionRequest {
  readonly mode: 'NewSelection';
  readonly accountId: string;
  readonly expectedCatalogSnapshot?: string;
}

export type ResolveAccountNewSelectionResult =
  | {
      readonly outcome: 'Resolved';
      readonly catalogSnapshotId: string;
      readonly account: StoredAccountRecord;
      readonly institution: StoredInstitutionRecord;
    }
  | {
      readonly outcome: 'SnapshotMismatch';
      readonly expectedCatalogSnapshot: string;
      readonly actualCatalogSnapshot: string;
      readonly message: string;
    }
  | {
      readonly outcome: 'Unresolvable';
      readonly reason: 'AccountNotFound' | 'AccountNotSelectable' | 'InstitutionNotSelectable';
      readonly message: string;
    }
  | {
      readonly outcome: 'WorkspaceNotInitialized';
      readonly message: string;
    };

export function normalizeCatalogLabel(raw: string): {
  readonly displayLabel: string;
  readonly normalizedKey: string;
} {
  const displayLabel = raw.trim().replace(/\s+/g, ' ');
  return {
    displayLabel,
    normalizedKey: displayLabel.toLocaleLowerCase('en-US'),
  };
}

function sortDeterministically<T extends { readonly normalizedLabel: string; readonly id: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    const labelCompare = a.normalizedLabel.localeCompare(b.normalizedLabel);
    if (labelCompare !== 0) return labelCompare;
    return a.id.localeCompare(b.id);
  });
}

function encodeCursor(snapshotId: string, offset: number): string {
  return `${snapshotId}::${offset}`;
}

function decodeCursor(
  cursor: string,
  expectedSnapshotId: string,
): { readonly ok: true; readonly offset: number } | { readonly ok: false } {
  const parts = cursor.split('::');
  if (parts.length !== 2) return { ok: false };
  const [snap, offsetStr] = parts;
  if (snap !== expectedSnapshotId) return { ok: false };
  const offset = Number.parseInt(offsetStr ?? '', 10);
  if (!Number.isFinite(offset) || offset < 0) return { ok: false };
  return { ok: true, offset };
}

export interface ReferenceCatalogServiceDependencies {
  readonly transactionManager: TransactionManager;
  readonly evaluateReadiness: () => Promise<RuntimeReadinessReport>;
  readonly nowIso?: () => string;
}

export class ReferenceCatalogService {
  private readonly tm: TransactionManager;
  private readonly evaluateReadiness: () => Promise<RuntimeReadinessReport>;
  private readonly nowIso: () => string;
  private idCounter = 0;

  constructor(deps: ReferenceCatalogServiceDependencies) {
    this.tm = deps.transactionManager;
    this.evaluateReadiness = deps.evaluateReadiness;
    this.nowIso = deps.nowIso ?? (() => new Date().toISOString());
  }

  private nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}-${Date.now()}-${this.idCounter}`;
  }

  private buildSummary(
    meta: WorkspaceMetaRecord,
    institutions: readonly StoredInstitutionRecord[],
    accounts: readonly StoredAccountRecord[],
  ): ReadyWorkspaceSummary {
    const selectableInstIds = new Set(
      institutions.filter((i) => i.availability === 'Selectable').map((i) => i.id),
    );
    const selectableAccountCount = accounts.filter(
      (a) => a.availability === 'Selectable' && selectableInstIds.has(a.parentInstitutionId),
    ).length;

    return {
      workspaceId: meta.workspaceId,
      schemaVersion: meta.schemaVersion,
      snapshotBinding: meta.snapshotBinding,
      timeZone: meta.timeZone,
      settingsRevision: meta.settingsRevision,
      catalogSnapshotId: meta.catalogSnapshotId,
      onboardingState:
        selectableAccountCount > 0 ? 'ReadyForTradePlanning' : 'NeedsInstitutionAndAccount',
      selectableAccountCount,
      institutionCount: institutions.length,
      accountCount: accounts.length,
      capabilityManifest: getInstalledCapabilityManifest(),
      latestReceipt: meta.latestReceipt,
    };
  }

  public async save(command: CatalogSaveCommand): Promise<CatalogSaveResult> {
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
        message: 'Workspace must be initialized before creating Institutions or Accounts.',
      };
    }

    const currentMeta = report.inspection.meta;
    const currentInstitutions = report.inspection.institutions;
    const currentAccounts = report.inspection.accounts;

    if (command.expectedCatalogSnapshot !== currentMeta.catalogSnapshotId) {
      return {
        outcome: 'Conflict',
        expectedCatalogSnapshot: command.expectedCatalogSnapshot,
        actualCatalogSnapshot: currentMeta.catalogSnapshotId,
        message:
          'The Reference Catalog was updated in another view. Refresh and submit your change again.',
      };
    }

    const { displayLabel, normalizedKey } = normalizeCatalogLabel(command.label);
    if (displayLabel.length === 0) {
      return {
        outcome: 'Rejected',
        reason: 'InvalidLabel',
        message:
          command.kind === 'CreateInstitution'
            ? 'Institution name is required and cannot be blank.'
            : 'Account name is required and cannot be blank.',
      };
    }

    const now = this.nowIso();

    if (command.kind === 'CreateInstitution') {
      const duplicate = currentInstitutions.find((inst) => inst.normalizedLabel === normalizedKey);
      if (duplicate) {
        return {
          outcome: 'Rejected',
          reason: 'DuplicateLabelInNamespace',
          message: `An Institution named "${duplicate.label}" already exists. Choose a distinct Institution name.`,
        };
      }

      const historyHead: CatalogRevisionEntry = {
        revision: 1,
        decisionType: 'Created',
        label: displayLabel,
        availability: 'Selectable',
        recordedAt: now,
      };

      const newInstitution: StoredInstitutionRecord = {
        id: this.nextId('inst'),
        kind: 'Institution',
        label: displayLabel,
        normalizedLabel: normalizedKey,
        availability: 'Selectable',
        origin: 'TraderCreated',
        currentRevision: 1,
        createdAt: now,
        updatedAt: now,
        history: [historyHead],
      };

      const nextCatalogSnapshot = this.nextId('cat');
      const nextSnapshotBinding = this.nextId('snap');
      const updatedMeta: WorkspaceMetaRecord = {
        ...currentMeta,
        catalogSnapshotId: nextCatalogSnapshot,
        snapshotBinding: nextSnapshotBinding,
        updatedAt: now,
      };

      const txRes = await this.tm.executeWriteTransaction(
        [STORE_WORKSPACE_META, STORE_REFERENCE_CATALOG],
        async (tx) => {
          await tx.objectStore(STORE_WORKSPACE_META).put(updatedMeta);
          await tx.objectStore(STORE_REFERENCE_CATALOG).put(newInstitution);
          return true;
        },
      );

      if (!txRes.ok) {
        return {
          outcome: 'RuntimeNotWritable',
          readinessReport: report,
          message: txRes.error.message,
        };
      }

      const allInstitutions = sortDeterministically([...currentInstitutions, newInstitution]);
      const allAccounts = sortDeterministically(currentAccounts);
      const workspaceSummary = this.buildSummary(updatedMeta, allInstitutions, allAccounts);

      return {
        outcome: 'Saved',
        createdKind: 'Institution',
        institution: newInstitution,
        appendedHistoryHead: historyHead,
        catalogSnapshotId: nextCatalogSnapshot,
        workspaceSummary,
        institutions: allInstitutions,
        accounts: allAccounts,
      };
    }

    // CreateAccount
    const parentInstitution = currentInstitutions.find(
      (inst) => inst.id === command.parentInstitutionId,
    );
    if (!parentInstitution) {
      return {
        outcome: 'Rejected',
        reason: 'InvalidParentReference',
        message: 'Select a valid existing Institution for this Account.',
      };
    }

    if (parentInstitution.availability !== 'Selectable') {
      return {
        outcome: 'Rejected',
        reason: 'ParentNotSelectable',
        message: `Institution "${parentInstitution.label}" is not currently selectable for new Accounts.`,
      };
    }

    const duplicateAccount = currentAccounts.find(
      (acct) =>
        acct.parentInstitutionId === parentInstitution.id &&
        acct.normalizedLabel === normalizedKey,
    );
    if (duplicateAccount) {
      return {
        outcome: 'Rejected',
        reason: 'DuplicateLabelInNamespace',
        message: `An Account named "${duplicateAccount.label}" already exists under ${parentInstitution.label}. Choose a distinct Account name.`,
      };
    }

    const historyHead: CatalogRevisionEntry = {
      revision: 1,
      decisionType: 'Created',
      label: displayLabel,
      availability: 'Selectable',
      recordedAt: now,
    };

    const newAccount: StoredAccountRecord = {
      id: this.nextId('acct'),
      kind: 'Account',
      parentInstitutionId: parentInstitution.id,
      label: displayLabel,
      normalizedLabel: normalizedKey,
      availability: 'Selectable',
      origin: 'TraderCreated',
      currentRevision: 1,
      createdAt: now,
      updatedAt: now,
      history: [historyHead],
    };

    const nextCatalogSnapshot = this.nextId('cat');
    const nextSnapshotBinding = this.nextId('snap');
    const updatedMeta: WorkspaceMetaRecord = {
      ...currentMeta,
      catalogSnapshotId: nextCatalogSnapshot,
      snapshotBinding: nextSnapshotBinding,
      updatedAt: now,
    };

    const txRes = await this.tm.executeWriteTransaction(
      [STORE_WORKSPACE_META, STORE_REFERENCE_CATALOG],
      async (tx) => {
        await tx.objectStore(STORE_WORKSPACE_META).put(updatedMeta);
        await tx.objectStore(STORE_REFERENCE_CATALOG).put(newAccount);
        return true;
      },
    );

    if (!txRes.ok) {
      return {
        outcome: 'RuntimeNotWritable',
        readinessReport: report,
        message: txRes.error.message,
      };
    }

    const allInstitutions = sortDeterministically(currentInstitutions);
    const allAccounts = sortDeterministically([...currentAccounts, newAccount]);
    const workspaceSummary = this.buildSummary(updatedMeta, allInstitutions, allAccounts);

    return {
      outcome: 'Saved',
      createdKind: 'Account',
      account: newAccount,
      parentInstitution,
      appendedHistoryHead: historyHead,
      catalogSnapshotId: nextCatalogSnapshot,
      workspaceSummary,
      institutions: allInstitutions,
      accounts: allAccounts,
    };
  }

  public async query(request: CatalogQueryRequest): Promise<CatalogQueryResult> {
    const inspection = await this.tm.inspectStorageRoot();
    if (inspection.kind !== 'ExistingReadableWorkspace') {
      return {
        outcome: 'WorkspaceNotInitialized',
        message: 'Workspace has not been initialized.',
      };
    }

    const snapshotId = inspection.meta.catalogSnapshotId;

    if (request.mode === 'GetItemHistory') {
      const item =
        inspection.institutions.find((i) => i.id === request.id) ??
        inspection.accounts.find((a) => a.id === request.id);
      if (!item) {
        return {
          outcome: 'NotFound',
          message: `Catalog item "${request.id}" was not found.`,
        };
      }
      return {
        outcome: 'ItemHistory',
        catalogSnapshotId: snapshotId,
        item,
        history: item.history,
      };
    }

    if (request.mode === 'ListInstitutions') {
      const filter = request.availabilityFilter ?? 'SelectableOnly';
      const filtered = inspection.institutions.filter((i) =>
        filter === 'SelectableOnly' ? i.availability === 'Selectable' : true,
      );
      const sorted = sortDeterministically(filtered);

      let offset = 0;
      if (request.cursor) {
        const decoded = decodeCursor(request.cursor, snapshotId);
        if (!decoded.ok) {
          return {
            outcome: 'StaleCursor',
            message: 'Pagination cursor does not match the current catalog snapshot.',
          };
        }
        offset = decoded.offset;
      }

      const limit = request.limit ?? sorted.length;
      const slice = sorted.slice(offset, offset + limit);
      const nextOffset = offset + slice.length;
      const nextCursor = nextOffset < sorted.length ? encodeCursor(snapshotId, nextOffset) : null;

      return {
        outcome: 'InstitutionList',
        catalogSnapshotId: snapshotId,
        items: slice,
        nextCursor,
      };
    }

    // ListAccounts
    const filter = request.availabilityFilter ?? 'SelectableOnly';
    const filtered = inspection.accounts.filter((a) => {
      if (request.parentInstitutionId && a.parentInstitutionId !== request.parentInstitutionId) {
        return false;
      }
      return filter === 'SelectableOnly' ? a.availability === 'Selectable' : true;
    });
    const sorted = sortDeterministically(filtered);

    let offset = 0;
    if (request.cursor) {
      const decoded = decodeCursor(request.cursor, snapshotId);
      if (!decoded.ok) {
        return {
          outcome: 'StaleCursor',
          message: 'Pagination cursor does not match the current catalog snapshot.',
        };
      }
      offset = decoded.offset;
    }

    const limit = request.limit ?? sorted.length;
    const slice = sorted.slice(offset, offset + limit);
    const nextOffset = offset + slice.length;
    const nextCursor = nextOffset < sorted.length ? encodeCursor(snapshotId, nextOffset) : null;

    const institutionsById: Record<string, StoredInstitutionRecord> = {};
    for (const inst of inspection.institutions) {
      institutionsById[inst.id] = inst;
    }

    return {
      outcome: 'AccountList',
      catalogSnapshotId: snapshotId,
      items: slice,
      institutionsById,
      nextCursor,
    };
  }

  public async resolve(
    request: ResolveAccountNewSelectionRequest,
  ): Promise<ResolveAccountNewSelectionResult> {
    const inspection = await this.tm.inspectStorageRoot();
    if (inspection.kind !== 'ExistingReadableWorkspace') {
      return {
        outcome: 'WorkspaceNotInitialized',
        message: 'Workspace has not been initialized.',
      };
    }

    const actualSnapshot = inspection.meta.catalogSnapshotId;
    if (
      request.expectedCatalogSnapshot !== undefined &&
      request.expectedCatalogSnapshot !== actualSnapshot
    ) {
      return {
        outcome: 'SnapshotMismatch',
        expectedCatalogSnapshot: request.expectedCatalogSnapshot,
        actualCatalogSnapshot: actualSnapshot,
        message: 'Catalog snapshot changed since selection was prepared.',
      };
    }

    const account = inspection.accounts.find((a) => a.id === request.accountId);
    if (!account) {
      return {
        outcome: 'Unresolvable',
        reason: 'AccountNotFound',
        message: `Account "${request.accountId}" does not exist.`,
      };
    }

    if (account.availability !== 'Selectable') {
      return {
        outcome: 'Unresolvable',
        reason: 'AccountNotSelectable',
        message: `Account "${account.label}" is not selectable for new work.`,
      };
    }

    const institution = inspection.institutions.find((i) => i.id === account.parentInstitutionId);
    if (!institution || institution.availability !== 'Selectable') {
      return {
        outcome: 'Unresolvable',
        reason: 'InstitutionNotSelectable',
        message: 'Parent Institution is missing or not selectable for new work.',
      };
    }

    return {
      outcome: 'Resolved',
      catalogSnapshotId: actualSnapshot,
      account,
      institution,
    };
  }
}
