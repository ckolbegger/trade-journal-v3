import type { SafeAction } from '../../delivery/runtime-not-writable.ts';
import { formatDecimal, type Rational } from '../../domain/values/index.ts';
import {
  D3_JOURNAL_MANIFEST,
  prepareJournalSeed,
  validateSection as validateJournal,
  type EntryDefinitionRecord,
  type JournalSectionIssue,
  type JournalTypeRecord,
} from '../../modules/journal/index.ts';
import {
  D1_CATALOG_MANIFEST,
  prepareSeed,
  validateSection as validateCatalog,
  type CatalogRecord,
  type CatalogSectionIssue,
} from '../../modules/reference-catalog/index.ts';
import {
  repairedDocument,
  validateSection as validateTrades,
  type TradeDocument,
  type TradeSectionIssue,
} from '../../modules/trade-record/index.ts';
import {
  migrationChain,
  SCHEMA_VERSION,
  type DatabaseDescription,
  type IdGenerator,
  type Persistence,
  type RecordSource,
  type StoreRecord,
} from '../../persistence/index.ts';
import type { WorkspaceStore } from '../../persistence/index.ts';

// The stage a migration stopped at: validation, or the root flip that activates the candidate.
export type MigrationStage = 'Validate' | 'Activate';

// The root flip transaction aborted, so the pointer still names the old database.
export interface ActivationIssue {
  readonly code: 'ActivationFailed';
}

export type MigrationIssue = CatalogSectionIssue | JournalSectionIssue | TradeSectionIssue | ActivationIssue;

// A repaired disagreement as the receipt lists it: stored versus expected, exact values as decimals.
export interface MigrationRepair {
  readonly tradeId: string;
  readonly findings: readonly unknown[];
}

export interface MigrationReceipt {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly sourceDatabase: string;
  readonly databaseName: string;
  // Records copied from the source, per store.
  readonly counts: Readonly<Record<string, number>>;
  readonly repairs: readonly MigrationRepair[];
  readonly privateRebuilds: readonly string[];
}

// What a migration rebuilds after the transform chain (D2 A30, D8 A139).
const PRIVATE_REBUILDS = ['trades.activityDesc', 'journalObligations', 'indexes'] as const;

// Called at migration stage boundaries. Production passes none; T2.16's faults build hooks here.
export interface MigrationStageHooks {
  // Receives the validation issues and returns the issues the migration judges.
  readonly validated?: (issues: readonly MigrationIssue[]) => readonly MigrationIssue[];
  // Runs immediately before activation, for example to hold the migrator there.
  readonly beforeActivate?: () => Promise<void>;
  // Runs inside the root flip transaction after its writes; a throw aborts the flip.
  readonly activating?: () => void;
}

export interface MigrationDeps {
  readonly persistence: Persistence;
  readonly ids: IdGenerator;
  readonly migrationHooks?: MigrationStageHooks;
}

// The candidate was discarded and the old database left exactly as it was (D2 P6): it is never
// read by this release, and Retry is calling initialize again.
export interface MigrationBlocked {
  readonly kind: 'MigrationBlocked';
  readonly stage: MigrationStage;
  readonly issues: readonly MigrationIssue[];
  readonly fromVersion: number;
  readonly toVersion: number;
  // The old database read after the candidate was discarded: name, content revision, and counts.
  readonly unchangedData: DatabaseDescription;
  readonly recoveryActions: readonly SafeAction[];
}

export type MigrationOutcome =
  | {
      readonly kind: 'Migrated';
      readonly receipt: MigrationReceipt;
      readonly seeds: { readonly catalog: readonly string[]; readonly journal: readonly string[] };
    }
  | MigrationBlocked;

async function all<T>(source: RecordSource, store: WorkspaceStore): Promise<T[]> {
  const records: T[] = [];
  for await (const batch of source.batches(store)) records.push(...(batch as unknown as T[]));
  return records;
}

const isRational = (value: unknown): value is Rational =>
  typeof value === 'object' && value !== null && typeof (value as Rational).numerator === 'bigint';

// Exact values as decimal text, so the receipt is plain data.
function plain(value: unknown): unknown {
  if (isRational(value)) return formatDecimal(value, 6).replace(/\.?0+$/, '');
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
}

// Migrates the Workspace at `source` from `fromVersion` through an isolated candidate (D2 A30).
// The caller holds the lifecycle lock. The source database is only read.
export async function migrate(deps: MigrationDeps, source: string, fromVersion: number): Promise<MigrationOutcome> {
  const { persistence, ids } = deps;
  await persistence.discardAbandoned();
  const { databaseName: candidate } = await persistence.createCandidate();
  const { counts } = await persistence.copySnapshot(source, candidate, migrationChain(fromVersion));
  const records = persistence.candidateSource(candidate);

  // Seed: genuinely missing defaults join the candidate without overwriting customization.
  const catalogSeed = prepareSeed(await all<CatalogRecord>(records, 'catalog'), D1_CATALOG_MANIFEST, ids);
  const journalSeed = prepareJournalSeed(
    await all<JournalTypeRecord>(records, 'journalTypes'),
    await all<EntryDefinitionRecord>(records, 'journalDefinitions'),
    D3_JOURNAL_MANIFEST,
    ids,
  );
  if (catalogSeed.kind !== 'Additions' || journalSeed.kind !== 'Additions') throw new Error('Seed manifests conflict with stored defaults');
  await persistence.putCandidateRecords(candidate, [
    ...catalogSeed.records.map((r): StoreRecord => ({ store: 'catalog', value: { ...r } })),
    ...journalSeed.types.map((t): StoreRecord => ({ store: 'journalTypes', value: { ...t } })),
    ...journalSeed.definitions.map((d): StoreRecord => ({ store: 'journalDefinitions', value: { ...d } })),
  ]);

  // Validate: each module judges its own section; Trade Record derives every Trade.
  const catalog = await validateCatalog(records, D1_CATALOG_MANIFEST);
  const journal = await validateJournal(records);
  const trades = await validateTrades(records, { accountIds: catalog.references.accountIds, anchorTradeIds: journal.references.anchorTradeIds });
  const found = [...catalog.issues, ...journal.issues, ...trades.issues];
  // Failure discards the candidate; the old database is left exactly as it was.
  const block = async (stage: MigrationStage, issues: readonly MigrationIssue[]): Promise<MigrationBlocked> => {
    await persistence.discardCandidate(candidate);
    return {
      kind: 'MigrationBlocked',
      stage,
      issues,
      fromVersion,
      toVersion: SCHEMA_VERSION,
      unchangedData: await persistence.describeDatabase(source),
      recoveryActions: [{ action: 'Retry', explanation: 'Your journal could not be converted to this release. Your data is unchanged.' }],
    };
  };
  const issues = deps.migrationHooks?.validated?.(found) ?? found;
  if (issues.length > 0) return block('Validate', issues);

  // Repair: coherent disagreements are written as the facts imply and disclosed (P7).
  const repairs = new Map(trades.repairs.map((r) => [r.tradeId, r]));
  if (repairs.size > 0) {
    const repaired: StoreRecord[] = [];
    for await (const batch of records.batches('trades')) {
      for (const document of batch as unknown as readonly TradeDocument[]) {
        const repair = repairs.get(document.tradeId);
        if (repair) repaired.push({ store: 'trades', value: { ...repairedDocument(document, repair, ids) } });
      }
    }
    await persistence.putCandidateRecords(candidate, repaired);
  }

  await persistence.rebuildCandidate(candidate);
  await deps.migrationHooks?.beforeActivate?.();
  const activation = await persistence.activateCandidate(candidate, source, deps.migrationHooks?.activating);
  if (activation.kind === 'Aborted') return block('Activate', [{ code: 'ActivationFailed' }]);
  return {
    kind: 'Migrated',
    receipt: {
      fromVersion,
      toVersion: SCHEMA_VERSION,
      sourceDatabase: source,
      databaseName: candidate,
      counts,
      repairs: trades.repairs.map((r) => ({ tradeId: r.tradeId, findings: r.findings.map(plain) })),
      privateRebuilds: PRIVATE_REBUILDS,
    },
    seeds: { catalog: catalogSeed.records.map((r) => r.productKey), journal: journalSeed.types.map((t) => t.productKey) },
  };
}
