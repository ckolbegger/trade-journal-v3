import type { TransactionSeam } from "../persistence/indexeddb/transaction";
import type { RuntimeNotWritable } from "../results";
import type { CatalogSeedManifest, StrategyShape } from "./seedManifest";

export type { CatalogSeedManifest, StrategyShape } from "./seedManifest";
export { CATALOG_SEED_MANIFEST_V1 } from "./seedManifest";

const CATALOG_STORE = "referenceCatalog";

export type CatalogKind =
  | "strategy"
  | "institution"
  | "account"
  | "closeReason"
  | "abandonmentReason"
  | "tagType"
  | "tagValue";

export interface CatalogRecord extends Record<string, unknown> {
  readonly id: string;
  readonly kind: CatalogKind;
  readonly stableKey?: string;
  readonly label: string;
  readonly revision: number;
  readonly retired?: boolean;
  readonly parentId?: string;
  readonly shape?: StrategyShape;
}

export interface StrategyRecord {
  readonly stableKey: string;
  readonly label: string;
  readonly shape: StrategyShape;
  readonly retired: boolean;
}

export interface AccountSummary {
  readonly id: string;
  readonly label: string;
  readonly institutionId: string;
  readonly retired: boolean;
}

export interface InstitutionRecord {
  readonly id: string;
  readonly label: string;
  readonly archived: boolean;
  readonly revision: number;
}

export interface CatalogSnapshot {
  readonly revision: number;
  readonly strategies: readonly StrategyRecord[];
  readonly institutions: readonly InstitutionRecord[];
  readonly accounts: readonly AccountSummary[];
}

export interface CatalogHistoryEntry {
  readonly revision: number;
  readonly label: string;
  readonly inactive: boolean;
}

export type CatalogSeedResult =
  | {
      readonly outcome: "Seeded";
      readonly seedVersion: string;
      readonly additions: readonly string[];
      readonly catalog: CatalogSnapshot;
      readonly selectableAccounts: readonly AccountSummary[];
    }
  | { readonly outcome: "SeedConflict"; readonly stableKey: string; readonly detail: string }
  | { readonly outcome: "RuntimeNotWritable"; readonly payload: RuntimeNotWritable };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function shapesEqual(left: StrategyShape, right: StrategyShape): boolean {
  return canonical(left) === canonical(right);
}

async function catalogRevision(seam: TransactionSeam): Promise<number> {
  const snapshot = await seam.snapshot(["workspaceMeta"]);
  const row = snapshot.rows("workspaceMeta").find((entry) => entry.key === "revisions");
  const value = row?.value as Record<string, number> | undefined;
  return value?.[CATALOG_STORE] ?? 0;
}

export function snapshotOf(
  rows: readonly CatalogRecord[],
  revision: number,
): CatalogSnapshot {
  const institutions = rows
    .filter((row) => row.kind === "institution")
    .map((row) => ({
      id: row.id,
      label: row.label,
      archived: row.retired === true,
      revision: row.revision,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const strategies = rows
    .filter((row) => row.kind === "strategy")
    .map((row) => ({
      stableKey: row.stableKey ?? row.id,
      label: row.label,
      shape: row.shape as StrategyShape,
      retired: row.retired === true,
    }))
    .sort((left, right) => left.stableKey.localeCompare(right.stableKey));
  const accounts = rows
    .filter((row) => row.kind === "account")
    .map((row) => ({
      id: row.id,
      label: row.label,
      institutionId: row.parentId ?? "",
      retired: row.retired === true,
    }));
  return { revision, strategies, institutions, accounts };
}

export type CatalogSeedPlan =
  | {
      readonly outcome: "Plan";
      readonly additions: readonly Record<string, unknown>[];
      readonly additionKeys: readonly string[];
    }
  | { readonly outcome: "SeedConflict"; readonly stableKey: string; readonly detail: string };

/** The non-committing half of the seed, so Workspace can seed Journal and Catalog in one transaction. */
export function planCatalogSeed(
  rows: readonly Record<string, unknown>[],
  manifest: CatalogSeedManifest,
): CatalogSeedPlan {
  const typedRows = rows as unknown as readonly CatalogRecord[];
  const additions: Record<string, unknown>[] = [];
  const additionKeys: string[] = [];

  for (const strategy of manifest.strategies) {
    const id = `strategy:${strategy.stableKey}`;
    const existing = typedRows.find((row) => row.id === id);
    if (existing !== undefined) {
      if (existing.kind !== "strategy") {
        return {
          outcome: "SeedConflict",
          stableKey: strategy.stableKey,
          detail: `the stable key already exists as a ${existing.kind}`,
        };
      }
      if (!shapesEqual(existing.shape as StrategyShape, strategy.shape)) {
        return {
          outcome: "SeedConflict",
          stableKey: strategy.stableKey,
          detail: "the stable key exists with an incompatible Strategy shape",
        };
      }
      continue;
    }
    additions.push({
      id,
      kind: "strategy",
      stableKey: strategy.stableKey,
      label: strategy.label,
      revision: 1,
      shape: strategy.shape,
      retired: false,
    });
    additionKeys.push(strategy.stableKey);
  }

  return { outcome: "Plan", additions, additionKeys };
}

/**
 * Workspace-supplied, stable-keyed, idempotent seeding of exactly the declared defaults. It never
 * seeds an Institution, Account, reason taxonomy, generic Strategy or Tag Type, never matches by
 * label, never overwrites a trader rename, and never reactivates a retired seed.
 */
export async function seedDefaults(
  seam: TransactionSeam,
  manifest: CatalogSeedManifest,
): Promise<CatalogSeedResult> {
  const snapshot = await seam.snapshot([CATALOG_STORE]);
  const rows = snapshot.rows(CATALOG_STORE) as unknown as CatalogRecord[];
  const plan = planCatalogSeed(rows, manifest);
  if (plan.outcome === "SeedConflict") return plan;

  let revision = await catalogRevision(seam);
  if (plan.additions.length > 0) {
    const committed = await seam.commit({
      participants: [{ store: CATALOG_STORE, put: plan.additions }],
    });
    if (committed.kind === "Rejected") {
      return { outcome: "RuntimeNotWritable", payload: committed.payload };
    }
    revision = committed.revisions[CATALOG_STORE] ?? revision;
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const addition of plan.additions) {
    byId.set(String(addition.id), addition as unknown as CatalogRecord);
  }
  const current = [...byId.values()];
  const catalog = snapshotOf(current, revision);
  return {
    outcome: "Seeded",
    seedVersion: manifest.version,
    additions: plan.additionKeys,
    catalog,
    selectableAccounts: catalog.accounts,
  };
}
