import type {
  AccountRecord,
  CatalogHistoryEntry,
  CatalogMetaRecord,
  InstitutionRecord,
  PersistenceSeam,
  ReadTxHandle,
} from '../persistence/idb';
import type { Clock } from '../shared/clock';
import type { RuntimeNotWritableResult } from '../shared/result';

export const CATALOG_SEED_MANIFEST_VERSION = 1 as const;

export type CatalogSaveCommand =
  | { readonly kind: 'CreateInstitution'; readonly label: string }
  | {
      readonly kind: 'RenameInstitution';
      readonly id: string;
      readonly label: string;
      readonly expectedRevision: number;
    }
  | {
      readonly kind: 'ArchiveInstitution';
      readonly id: string;
      readonly expectedRevision: number;
    }
  | {
      readonly kind: 'ReactivateInstitution';
      readonly id: string;
      readonly expectedRevision: number;
    }
  | {
      readonly kind: 'CreateAccount';
      readonly institutionId: string;
      readonly label: string;
    }
  | {
      readonly kind: 'RenameAccount';
      readonly id: string;
      readonly label: string;
      readonly expectedRevision: number;
    }
  | {
      readonly kind: 'ArchiveAccount';
      readonly id: string;
      readonly expectedRevision: number;
    }
  | {
      readonly kind: 'ReactivateAccount';
      readonly id: string;
      readonly expectedRevision: number;
    };

export type CatalogRejectionCode =
  | 'EmptyLabel'
  | 'DuplicateLabel'
  | 'NotFound'
  | 'InstitutionNotSelectable'
  | 'InstitutionHasSelectableAccounts'
  | 'InvalidStateTransition';

export type CatalogSaveResult =
  | {
      readonly status: 'Saved';
      readonly family: 'Institution';
      readonly record: InstitutionRecord;
      readonly historyHead: CatalogHistoryEntry;
      readonly catalogRevision: number;
      readonly hasSelectableAccounts: boolean;
    }
  | {
      readonly status: 'Saved';
      readonly family: 'Account';
      readonly record: AccountRecord;
      readonly historyHead: CatalogHistoryEntry;
      readonly catalogRevision: number;
      readonly hasSelectableAccounts: boolean;
    }
  | {
      readonly status: 'Unchanged';
      readonly family: 'Institution';
      readonly record: InstitutionRecord;
      readonly catalogRevision: number;
    }
  | {
      readonly status: 'Unchanged';
      readonly family: 'Account';
      readonly record: AccountRecord;
      readonly catalogRevision: number;
    }
  | {
      readonly status: 'Conflict';
      readonly currentRevision: number;
      readonly message: string;
    }
  | {
      readonly status: 'Rejected';
      readonly code: CatalogRejectionCode;
      readonly message: string;
    }
  | RuntimeNotWritableResult;

export type CatalogQueryRequest =
  | { readonly family: 'Institution'; readonly includeInactive: boolean }
  | {
      readonly family: 'Account';
      readonly includeInactive: boolean;
      readonly institutionId?: string;
    };

export type CatalogQueryResult =
  | {
      readonly family: 'Institution';
      readonly items: readonly InstitutionRecord[];
      readonly catalogRevision: number;
    }
  | {
      readonly family: 'Account';
      readonly items: readonly AccountRecord[];
      readonly catalogRevision: number;
    };

export type CatalogResolveMode = 'NewSelection' | 'RetainedReference' | 'DisplayOnly';

export interface CatalogResolveRequirement {
  readonly family: 'Institution' | 'Account';
  readonly id: string;
  readonly mode: CatalogResolveMode;
}

export type CatalogResolveItemResult =
  | {
      readonly status: 'Valid';
      readonly family: 'Institution';
      readonly record: InstitutionRecord;
    }
  | {
      readonly status: 'Valid';
      readonly family: 'Account';
      readonly record: AccountRecord;
      readonly institution: InstitutionRecord;
    }
  | {
      readonly status: 'InactiveForRequestedUse';
      readonly family: 'Institution' | 'Account';
      readonly id: string;
      readonly currentLabel: string;
    }
  | {
      readonly status: 'NotFound';
      readonly family: 'Institution' | 'Account';
      readonly id: string;
    };

export type CatalogResolutionSet =
  | {
      readonly status: 'Resolved';
      readonly catalogRevision: number;
      readonly results: readonly CatalogResolveItemResult[];
    }
  | {
      readonly status: 'SnapshotConflict';
      readonly expectedCatalogRevision: number;
      readonly currentCatalogRevision: number;
    };

export type SeedCatalogResult =
  | {
      readonly status: 'Seeded';
      readonly catalogRevision: number;
      readonly seedManifestVersion: number;
      readonly additions: readonly string[];
      readonly hasSelectableAccounts: boolean;
    }
  | RuntimeNotWritableResult;

export interface ReferenceCatalog {
  seedDefaults(): Promise<SeedCatalogResult>;
  save(command: CatalogSaveCommand): Promise<CatalogSaveResult>;
  query(request: CatalogQueryRequest): Promise<CatalogQueryResult>;
  resolve(request: {
    readonly requirements: readonly CatalogResolveRequirement[];
    readonly expectedCatalogRevision?: number;
  }): Promise<CatalogResolutionSet>;
}

function cleanLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function normalizeLabel(raw: string): string {
  return cleanLabel(raw).toLowerCase();
}

function generateId(prefix: 'inst' | 'acct'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function sortByLabelThenId<T extends { currentLabel: string; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const byLabel = a.currentLabel.localeCompare(b.currentLabel, undefined, { sensitivity: 'base' });
    return byLabel !== 0 ? byLabel : a.id.localeCompare(b.id);
  });
}

function computeHasSelectableAccounts(
  institutions: readonly InstitutionRecord[],
  accounts: readonly AccountRecord[],
): boolean {
  const activeInstitutionIds = new Set(
    institutions.filter((inst) => inst.status === 'Active').map((inst) => inst.id),
  );
  return accounts.some(
    (acct) => acct.status === 'Active' && activeInstitutionIds.has(acct.institutionId),
  );
}

async function readSnapshotFromTx(tx: ReadTxHandle) {
  const [meta, institutions, accounts] = await Promise.all([
    tx.get('catalog_meta', 'singleton'),
    tx.getAll('catalog_institutions'),
    tx.getAll('catalog_accounts'),
  ]);
  return {
    meta: meta ?? {
      key: 'singleton' as const,
      catalogRevision: 0,
      seedManifestVersion: 0,
      seededAt: '',
    },
    institutions,
    accounts,
  };
}

export function createReferenceCatalog(options: {
  readonly persistence: PersistenceSeam;
  readonly clock: Clock;
}): ReferenceCatalog {
  const { persistence, clock } = options;

  return {
    async seedDefaults(): Promise<SeedCatalogResult> {
      const txResult = await persistence.runWriteTransaction(
        ['catalog_meta', 'catalog_institutions', 'catalog_accounts'],
        async (tx): Promise<Exclude<SeedCatalogResult, RuntimeNotWritableResult>> => {
          const snapshot = await readSnapshotFromTx(tx);
          const hasSelectableAccounts = computeHasSelectableAccounts(
            snapshot.institutions,
            snapshot.accounts,
          );

          if (snapshot.meta.seedManifestVersion >= CATALOG_SEED_MANIFEST_VERSION) {
            return {
              status: 'Seeded',
              catalogRevision: snapshot.meta.catalogRevision,
              seedManifestVersion: snapshot.meta.seedManifestVersion,
              additions: [],
              hasSelectableAccounts,
            };
          }

          const nextRevision = snapshot.meta.catalogRevision + 1;
          const nextMeta: CatalogMetaRecord = {
            key: 'singleton',
            catalogRevision: nextRevision,
            seedManifestVersion: CATALOG_SEED_MANIFEST_VERSION,
            seededAt: clock.nowIso(),
          };
          tx.put('catalog_meta', nextMeta);

          return {
            status: 'Seeded',
            catalogRevision: nextRevision,
            seedManifestVersion: CATALOG_SEED_MANIFEST_VERSION,
            additions: [],
            hasSelectableAccounts,
          };
        },
      );

      if (txResult.status === 'RuntimeNotWritable') {
        return txResult;
      }
      return txResult.value;
    },

    async save(command: CatalogSaveCommand): Promise<CatalogSaveResult> {
      const txResult = await persistence.runWriteTransaction(
        ['catalog_meta', 'catalog_institutions', 'catalog_accounts'],
        async (tx): Promise<Exclude<CatalogSaveResult, RuntimeNotWritableResult>> => {
          const snapshot = await readSnapshotFromTx(tx);
          const now = clock.nowIso();
          const nextCatalogRevision = snapshot.meta.catalogRevision + 1;
          const nextMeta: CatalogMetaRecord = {
            key: 'singleton',
            catalogRevision: nextCatalogRevision,
            seedManifestVersion: snapshot.meta.seedManifestVersion,
            seededAt: snapshot.meta.seededAt,
          };

          switch (command.kind) {
            case 'CreateInstitution': {
              const label = cleanLabel(command.label);
              if (!label) {
                return {
                  status: 'Rejected',
                  code: 'EmptyLabel',
                  message: 'Institution name is required.',
                };
              }
              const normalized = normalizeLabel(label);
              if (snapshot.institutions.some((inst) => inst.normalizedLabel === normalized)) {
                return {
                  status: 'Rejected',
                  code: 'DuplicateLabel',
                  message: `An institution named "${label}" already exists.`,
                };
              }

              const historyHead: CatalogHistoryEntry = {
                revision: 1,
                action: 'Created',
                label,
                status: 'Active',
                recordedAt: now,
              };
              const record: InstitutionRecord = {
                id: generateId('inst'),
                currentLabel: label,
                normalizedLabel: normalized,
                status: 'Active',
                revision: 1,
                createdAt: now,
                updatedAt: now,
                history: [historyHead],
              };

              tx.put('catalog_meta', nextMeta);
              tx.put('catalog_institutions', record);

              return {
                status: 'Saved',
                family: 'Institution',
                record,
                historyHead,
                catalogRevision: nextCatalogRevision,
                hasSelectableAccounts: computeHasSelectableAccounts(
                  [...snapshot.institutions, record],
                  snapshot.accounts,
                ),
              };
            }

            case 'RenameInstitution': {
              const existing = snapshot.institutions.find((inst) => inst.id === command.id);
              if (!existing) {
                return { status: 'Rejected', code: 'NotFound', message: 'Institution not found.' };
              }
              if (existing.revision !== command.expectedRevision) {
                return {
                  status: 'Conflict',
                  currentRevision: existing.revision,
                  message: 'Institution was modified since it was loaded.',
                };
              }
              const label = cleanLabel(command.label);
              if (!label) {
                return {
                  status: 'Rejected',
                  code: 'EmptyLabel',
                  message: 'Institution name is required.',
                };
              }
              if (label === existing.currentLabel) {
                return {
                  status: 'Unchanged',
                  family: 'Institution',
                  record: existing,
                  catalogRevision: snapshot.meta.catalogRevision,
                };
              }
              const normalized = normalizeLabel(label);
              if (
                snapshot.institutions.some(
                  (inst) => inst.id !== existing.id && inst.normalizedLabel === normalized,
                )
              ) {
                return {
                  status: 'Rejected',
                  code: 'DuplicateLabel',
                  message: `An institution named "${label}" already exists.`,
                };
              }

              const nextRevision = existing.revision + 1;
              const historyHead: CatalogHistoryEntry = {
                revision: nextRevision,
                action: 'Renamed',
                label,
                status: existing.status,
                recordedAt: now,
              };
              const record: InstitutionRecord = {
                ...existing,
                currentLabel: label,
                normalizedLabel: normalized,
                revision: nextRevision,
                updatedAt: now,
                history: [...existing.history, historyHead],
              };

              tx.put('catalog_meta', nextMeta);
              tx.put('catalog_institutions', record);

              return {
                status: 'Saved',
                family: 'Institution',
                record,
                historyHead,
                catalogRevision: nextCatalogRevision,
                hasSelectableAccounts: computeHasSelectableAccounts(
                  snapshot.institutions.map((i) => (i.id === record.id ? record : i)),
                  snapshot.accounts,
                ),
              };
            }

            case 'ArchiveInstitution': {
              const existing = snapshot.institutions.find((inst) => inst.id === command.id);
              if (!existing) {
                return { status: 'Rejected', code: 'NotFound', message: 'Institution not found.' };
              }
              if (existing.revision !== command.expectedRevision) {
                return {
                  status: 'Conflict',
                  currentRevision: existing.revision,
                  message: 'Institution was modified since it was loaded.',
                };
              }
              if (existing.status === 'Archived') {
                return {
                  status: 'Unchanged',
                  family: 'Institution',
                  record: existing,
                  catalogRevision: snapshot.meta.catalogRevision,
                };
              }
              const hasActiveAccounts = snapshot.accounts.some(
                (acct) => acct.institutionId === existing.id && acct.status === 'Active',
              );
              if (hasActiveAccounts) {
                return {
                  status: 'Rejected',
                  code: 'InstitutionHasSelectableAccounts',
                  message:
                    'Archive all active accounts under this institution before archiving the institution.',
                };
              }

              const nextRevision = existing.revision + 1;
              const historyHead: CatalogHistoryEntry = {
                revision: nextRevision,
                action: 'Archived',
                label: existing.currentLabel,
                status: 'Archived',
                recordedAt: now,
              };
              const record: InstitutionRecord = {
                ...existing,
                status: 'Archived',
                revision: nextRevision,
                updatedAt: now,
                history: [...existing.history, historyHead],
              };

              tx.put('catalog_meta', nextMeta);
              tx.put('catalog_institutions', record);

              return {
                status: 'Saved',
                family: 'Institution',
                record,
                historyHead,
                catalogRevision: nextCatalogRevision,
                hasSelectableAccounts: computeHasSelectableAccounts(
                  snapshot.institutions.map((i) => (i.id === record.id ? record : i)),
                  snapshot.accounts,
                ),
              };
            }

            case 'ReactivateInstitution': {
              const existing = snapshot.institutions.find((inst) => inst.id === command.id);
              if (!existing) {
                return { status: 'Rejected', code: 'NotFound', message: 'Institution not found.' };
              }
              if (existing.revision !== command.expectedRevision) {
                return {
                  status: 'Conflict',
                  currentRevision: existing.revision,
                  message: 'Institution was modified since it was loaded.',
                };
              }
              if (existing.status === 'Active') {
                return {
                  status: 'Unchanged',
                  family: 'Institution',
                  record: existing,
                  catalogRevision: snapshot.meta.catalogRevision,
                };
              }

              const nextRevision = existing.revision + 1;
              const historyHead: CatalogHistoryEntry = {
                revision: nextRevision,
                action: 'Reactivated',
                label: existing.currentLabel,
                status: 'Active',
                recordedAt: now,
              };
              const record: InstitutionRecord = {
                ...existing,
                status: 'Active',
                revision: nextRevision,
                updatedAt: now,
                history: [...existing.history, historyHead],
              };

              tx.put('catalog_meta', nextMeta);
              tx.put('catalog_institutions', record);

              return {
                status: 'Saved',
                family: 'Institution',
                record,
                historyHead,
                catalogRevision: nextCatalogRevision,
                hasSelectableAccounts: computeHasSelectableAccounts(
                  snapshot.institutions.map((i) => (i.id === record.id ? record : i)),
                  snapshot.accounts,
                ),
              };
            }

            case 'CreateAccount': {
              const institution = snapshot.institutions.find(
                (inst) => inst.id === command.institutionId,
              );
              if (!institution || institution.status !== 'Active') {
                return {
                  status: 'Rejected',
                  code: 'InstitutionNotSelectable',
                  message: 'Accounts can only be created under an active institution.',
                };
              }
              const label = cleanLabel(command.label);
              if (!label) {
                return {
                  status: 'Rejected',
                  code: 'EmptyLabel',
                  message: 'Account name is required.',
                };
              }
              const normalized = normalizeLabel(label);
              if (
                snapshot.accounts.some(
                  (acct) =>
                    acct.institutionId === institution.id && acct.normalizedLabel === normalized,
                )
              ) {
                return {
                  status: 'Rejected',
                  code: 'DuplicateLabel',
                  message: `An account named "${label}" already exists under ${institution.currentLabel}.`,
                };
              }

              const historyHead: CatalogHistoryEntry = {
                revision: 1,
                action: 'Created',
                label,
                status: 'Active',
                recordedAt: now,
              };
              const record: AccountRecord = {
                id: generateId('acct'),
                institutionId: institution.id,
                currentLabel: label,
                normalizedLabel: normalized,
                status: 'Active',
                revision: 1,
                createdAt: now,
                updatedAt: now,
                history: [historyHead],
              };

              tx.put('catalog_meta', nextMeta);
              tx.put('catalog_accounts', record);

              return {
                status: 'Saved',
                family: 'Account',
                record,
                historyHead,
                catalogRevision: nextCatalogRevision,
                hasSelectableAccounts: computeHasSelectableAccounts(
                  snapshot.institutions,
                  [...snapshot.accounts, record],
                ),
              };
            }

            case 'RenameAccount': {
              const existing = snapshot.accounts.find((acct) => acct.id === command.id);
              if (!existing) {
                return { status: 'Rejected', code: 'NotFound', message: 'Account not found.' };
              }
              if (existing.revision !== command.expectedRevision) {
                return {
                  status: 'Conflict',
                  currentRevision: existing.revision,
                  message: 'Account was modified since it was loaded.',
                };
              }
              const label = cleanLabel(command.label);
              if (!label) {
                return {
                  status: 'Rejected',
                  code: 'EmptyLabel',
                  message: 'Account name is required.',
                };
              }
              if (label === existing.currentLabel) {
                return {
                  status: 'Unchanged',
                  family: 'Account',
                  record: existing,
                  catalogRevision: snapshot.meta.catalogRevision,
                };
              }
              const normalized = normalizeLabel(label);
              if (
                snapshot.accounts.some(
                  (acct) =>
                    acct.id !== existing.id &&
                    acct.institutionId === existing.institutionId &&
                    acct.normalizedLabel === normalized,
                )
              ) {
                return {
                  status: 'Rejected',
                  code: 'DuplicateLabel',
                  message: `An account named "${label}" already exists under this institution.`,
                };
              }

              const nextRevision = existing.revision + 1;
              const historyHead: CatalogHistoryEntry = {
                revision: nextRevision,
                action: 'Renamed',
                label,
                status: existing.status,
                recordedAt: now,
              };
              const record: AccountRecord = {
                ...existing,
                currentLabel: label,
                normalizedLabel: normalized,
                revision: nextRevision,
                updatedAt: now,
                history: [...existing.history, historyHead],
              };

              tx.put('catalog_meta', nextMeta);
              tx.put('catalog_accounts', record);

              return {
                status: 'Saved',
                family: 'Account',
                record,
                historyHead,
                catalogRevision: nextCatalogRevision,
                hasSelectableAccounts: computeHasSelectableAccounts(
                  snapshot.institutions,
                  snapshot.accounts.map((a) => (a.id === record.id ? record : a)),
                ),
              };
            }

            case 'ArchiveAccount': {
              const existing = snapshot.accounts.find((acct) => acct.id === command.id);
              if (!existing) {
                return { status: 'Rejected', code: 'NotFound', message: 'Account not found.' };
              }
              if (existing.revision !== command.expectedRevision) {
                return {
                  status: 'Conflict',
                  currentRevision: existing.revision,
                  message: 'Account was modified since it was loaded.',
                };
              }
              if (existing.status === 'Archived') {
                return {
                  status: 'Unchanged',
                  family: 'Account',
                  record: existing,
                  catalogRevision: snapshot.meta.catalogRevision,
                };
              }

              const nextRevision = existing.revision + 1;
              const historyHead: CatalogHistoryEntry = {
                revision: nextRevision,
                action: 'Archived',
                label: existing.currentLabel,
                status: 'Archived',
                recordedAt: now,
              };
              const record: AccountRecord = {
                ...existing,
                status: 'Archived',
                revision: nextRevision,
                updatedAt: now,
                history: [...existing.history, historyHead],
              };

              tx.put('catalog_meta', nextMeta);
              tx.put('catalog_accounts', record);

              return {
                status: 'Saved',
                family: 'Account',
                record,
                historyHead,
                catalogRevision: nextCatalogRevision,
                hasSelectableAccounts: computeHasSelectableAccounts(
                  snapshot.institutions,
                  snapshot.accounts.map((a) => (a.id === record.id ? record : a)),
                ),
              };
            }

            case 'ReactivateAccount': {
              const existing = snapshot.accounts.find((acct) => acct.id === command.id);
              if (!existing) {
                return { status: 'Rejected', code: 'NotFound', message: 'Account not found.' };
              }
              if (existing.revision !== command.expectedRevision) {
                return {
                  status: 'Conflict',
                  currentRevision: existing.revision,
                  message: 'Account was modified since it was loaded.',
                };
              }
              if (existing.status === 'Active') {
                return {
                  status: 'Unchanged',
                  family: 'Account',
                  record: existing,
                  catalogRevision: snapshot.meta.catalogRevision,
                };
              }
              const parent = snapshot.institutions.find(
                (inst) => inst.id === existing.institutionId,
              );
              if (!parent || parent.status !== 'Active') {
                return {
                  status: 'Rejected',
                  code: 'InstitutionNotSelectable',
                  message: 'Reactivate the parent institution before reactivating this account.',
                };
              }

              const nextRevision = existing.revision + 1;
              const historyHead: CatalogHistoryEntry = {
                revision: nextRevision,
                action: 'Reactivated',
                label: existing.currentLabel,
                status: 'Active',
                recordedAt: now,
              };
              const record: AccountRecord = {
                ...existing,
                status: 'Active',
                revision: nextRevision,
                updatedAt: now,
                history: [...existing.history, historyHead],
              };

              tx.put('catalog_meta', nextMeta);
              tx.put('catalog_accounts', record);

              return {
                status: 'Saved',
                family: 'Account',
                record,
                historyHead,
                catalogRevision: nextCatalogRevision,
                hasSelectableAccounts: computeHasSelectableAccounts(
                  snapshot.institutions,
                  snapshot.accounts.map((a) => (a.id === record.id ? record : a)),
                ),
              };
            }
          }
        },
      );

      if (txResult.status === 'RuntimeNotWritable') {
        return txResult;
      }
      return txResult.value;
    },

    async query(request: CatalogQueryRequest): Promise<CatalogQueryResult> {
      const snapshot = await persistence.runReadTransaction(
        ['catalog_meta', 'catalog_institutions', 'catalog_accounts'],
        readSnapshotFromTx,
      );
      if (request.family === 'Institution') {
        const filtered = request.includeInactive
          ? snapshot.institutions
          : snapshot.institutions.filter((inst) => inst.status === 'Active');
        return {
          family: 'Institution',
          items: sortByLabelThenId(filtered),
          catalogRevision: snapshot.meta.catalogRevision,
        };
      }

      const activeInstIds = new Set(
        snapshot.institutions.filter((i) => i.status === 'Active').map((i) => i.id),
      );
      let filtered = snapshot.accounts;
      if (request.institutionId) {
        filtered = filtered.filter((acct) => acct.institutionId === request.institutionId);
      }
      if (!request.includeInactive) {
        filtered = filtered.filter(
          (acct) => acct.status === 'Active' && activeInstIds.has(acct.institutionId),
        );
      }
      return {
        family: 'Account',
        items: sortByLabelThenId(filtered),
        catalogRevision: snapshot.meta.catalogRevision,
      };
    },

    async resolve(request): Promise<CatalogResolutionSet> {
      const snapshot = await persistence.runReadTransaction(
        ['catalog_meta', 'catalog_institutions', 'catalog_accounts'],
        readSnapshotFromTx,
      );
      if (
        request.expectedCatalogRevision !== undefined &&
        request.expectedCatalogRevision !== snapshot.meta.catalogRevision
      ) {
        return {
          status: 'SnapshotConflict',
          expectedCatalogRevision: request.expectedCatalogRevision,
          currentCatalogRevision: snapshot.meta.catalogRevision,
        };
      }

      const instById = new Map(snapshot.institutions.map((i) => [i.id, i]));
      const acctById = new Map(snapshot.accounts.map((a) => [a.id, a]));

      const results: CatalogResolveItemResult[] = request.requirements.map((req) => {
        if (req.family === 'Institution') {
          const inst = instById.get(req.id);
          if (!inst) {
            return { status: 'NotFound', family: 'Institution', id: req.id };
          }
          if (req.mode === 'NewSelection' && inst.status !== 'Active') {
            return {
              status: 'InactiveForRequestedUse',
              family: 'Institution',
              id: inst.id,
              currentLabel: inst.currentLabel,
            };
          }
          return { status: 'Valid', family: 'Institution', record: inst };
        }

        const acct = acctById.get(req.id);
        if (!acct) {
          return { status: 'NotFound', family: 'Account', id: req.id };
        }
        const parent = instById.get(acct.institutionId);
        if (!parent) {
          return { status: 'NotFound', family: 'Account', id: req.id };
        }
        if (req.mode === 'NewSelection' && (acct.status !== 'Active' || parent.status !== 'Active')) {
          return {
            status: 'InactiveForRequestedUse',
            family: 'Account',
            id: acct.id,
            currentLabel: acct.currentLabel,
          };
        }
        return { status: 'Valid', family: 'Account', record: acct, institution: parent };
      });

      return {
        status: 'Resolved',
        catalogRevision: snapshot.meta.catalogRevision,
        results,
      };
    },
  };
}
