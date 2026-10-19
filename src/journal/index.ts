import type { RuntimeNotWritable } from "../results";
import type { TransactionSeam } from "../persistence/indexeddb/transaction";
import { FIXED_ENTRY_TYPE_KEYS, FIXED_SOURCE_KEYS } from "./definitions";
import type { JournalSeedManifest } from "./seedManifest";

export type { JournalSeedManifest } from "./seedManifest";
export { SEED_MANIFEST_FULL, SEED_MANIFEST_V1, SEED_MANIFEST_V2 } from "./seedManifest";
export { getDefinitions } from "./definitions";
export { reviseDefinition } from "./reviseDefinition";
export { prepareEffects, applyPreparedEffects } from "./effects";
export type { JournalEffectRequest, JournalObligation, PlanReflectionForm, PreparedPlanReflection } from "./effects";
export type { EntryDefinitionSet, EntryTypeDefinition, EntryDefinitionPrompt } from "./definitions";
export type { ReviseEntryDefinitionCommand, ReviseEntryDefinitionResult } from "./reviseDefinition";

const JOURNAL_STORE = "journal";

export type JournalSeedResult =
  | {
      readonly outcome: "Seeded";
      readonly seedVersion: string;
      readonly definitionRevision: number;
      readonly additions: readonly string[];
      readonly entryTypes: number;
      readonly sources: number;
      /** The Sources this seed actually installed, in stable-key order. */
      readonly installedSources: readonly string[];
      /** Fixed product identities this release has not installed, named rather than faked. */
      readonly absentEntryTypes: readonly string[];
      readonly absentSources: readonly string[];
    }
  | {
      readonly outcome: "SeedConflict";
      readonly stableKey: string;
      readonly detail: string;
    }
  | { readonly outcome: "RuntimeNotWritable"; readonly payload: RuntimeNotWritable };

interface JournalRow extends Record<string, unknown> {
  readonly id: string;
  readonly kind: string;
  readonly stableKey: string;
  readonly label: string;
  readonly revision: number;
  readonly definition?: { readonly version: string; readonly prompts: readonly unknown[] };
  readonly writingPath?: string;
}

function promptKeysOf(prompts: readonly { stableKey: string }[]): string[] {
  return prompts.map((prompt) => prompt.stableKey).sort();
}

function incompatibleEntryType(row: JournalRow, seed: { stableKey: string; prompts: readonly { stableKey: string }[] }): string | undefined {
  if (row.kind !== "entryType") {
    return `the stable key ${seed.stableKey} already exists as a ${row.kind}`;
  }
  const existing = promptKeysOf((row.definition?.prompts ?? []) as { stableKey: string }[]);
  const incoming = promptKeysOf(seed.prompts);
  if (existing.length !== incoming.length || existing.some((key, index) => key !== incoming[index])) {
    return `the stable key ${seed.stableKey} exists with an incompatible prompt set`;
  }
  return undefined;
}

function incompatibleSource(row: JournalRow, seed: { stableKey: string; writingPath: string }): string | undefined {
  if (row.kind !== "source") {
    return `the stable key ${seed.stableKey} already exists as a ${row.kind}`;
  }
  if (row.writingPath !== seed.writingPath) {
    return `the stable key ${seed.stableKey} is bound to a different writing path`;
  }
  return undefined;
}

export type JournalSeedPlan =
  | {
      readonly outcome: "Plan";
      readonly additions: readonly Record<string, unknown>[];
      readonly additionKeys: readonly string[];
      readonly definitionRevision: number;
    }
  | { readonly outcome: "SeedConflict"; readonly stableKey: string; readonly detail: string };

/** The non-committing half of the seed, so Workspace can seed Journal and Catalog in one transaction. */
export function planJournalSeed(
  rows: readonly Record<string, unknown>[],
  manifest: JournalSeedManifest,
): JournalSeedPlan {
  const typedRows = rows as unknown as readonly JournalRow[];
  const additions: Record<string, unknown>[] = [];
  const additionKeys: string[] = [];
  let highestRevision = 0;

  for (const entryType of manifest.entryTypes) {
    const id = `entryType:${entryType.stableKey}`;
    const existing = typedRows.find((row) => row.id === id);
    if (existing !== undefined) {
      const problem = incompatibleEntryType(existing, entryType);
      if (problem !== undefined) {
        return { outcome: "SeedConflict", stableKey: entryType.stableKey, detail: problem };
      }
      highestRevision = Math.max(highestRevision, existing.revision);
      continue;
    }
    additions.push({
      id,
      kind: "entryType",
      stableKey: entryType.stableKey,
      label: entryType.label,
      revision: 1,
      definition: { version: manifest.version, prompts: entryType.prompts },
    });
    additionKeys.push(entryType.stableKey);
    highestRevision = Math.max(highestRevision, 1);
  }

  for (const source of manifest.sources) {
    const id = `source:${source.stableKey}`;
    const existing = typedRows.find((row) => row.id === id);
    if (existing !== undefined) {
      const problem = incompatibleSource(existing, source);
      if (problem !== undefined) {
        return { outcome: "SeedConflict", stableKey: source.stableKey, detail: problem };
      }
      highestRevision = Math.max(highestRevision, existing.revision);
      continue;
    }
    additions.push({
      id,
      kind: "source",
      stableKey: source.stableKey,
      label: source.label,
      revision: 1,
      writingPath: source.writingPath,
    });
    additionKeys.push(source.stableKey);
    highestRevision = Math.max(highestRevision, 1);
  }

  return {
    outcome: "Plan",
    additions,
    additionKeys,
    definitionRevision: highestRevision,
  };
}

/**
 * Workspace-only, stable-keyed, idempotent, atomic seeder for Journal's fixed product identities
 * (`journal.md:192-194`). It creates only what the supplied manifest declares, matches by stable
 * product key rather than label, never resets a trader revision, and commits everything in one
 * transaction.
 */
export async function seedDefaults(
  seam: TransactionSeam,
  manifest: JournalSeedManifest,
): Promise<JournalSeedResult> {
  const snapshot = await seam.snapshot([JOURNAL_STORE]);
  const rows = snapshot.rows(JOURNAL_STORE) as unknown as JournalRow[];
  const plan = planJournalSeed(rows, manifest);
  if (plan.outcome === "SeedConflict") return plan;

  if (plan.additions.length > 0) {
    const committed = await seam.commit({
      participants: [{ store: JOURNAL_STORE, put: plan.additions }],
    });
    if (committed.kind === "Rejected") {
      return { outcome: "RuntimeNotWritable", payload: committed.payload };
    }
  }

  const installed = await installedIdentities(seam);
  return {
    outcome: "Seeded",
    seedVersion: manifest.version,
    definitionRevision: plan.definitionRevision,
    additions: plan.additionKeys,
    entryTypes: manifest.entryTypes.length,
    sources: manifest.sources.length,
    installedSources: installed.sources,
    absentEntryTypes: FIXED_ENTRY_TYPE_KEYS.filter((key) => !installed.entryTypes.includes(key)),
    absentSources: FIXED_SOURCE_KEYS.filter((key) => !installed.sources.includes(key)),
  };
}

/** A normalized identity-and-definition view for idempotence evidence. */
export function normalizedJournalManifest(rows: readonly Record<string, unknown>[]): unknown[] {
  return rows
    .filter((row) => row.kind === "entryType" || row.kind === "source")
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      stableKey: row.stableKey,
      label: row.label,
      revision: row.revision,
      ...(row.kind === "entryType"
        ? { prompts: (row.definition as { prompts?: unknown[] } | undefined)?.prompts ?? [] }
        : { writingPath: row.writingPath }),
    }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

async function installedIdentities(
  seam: TransactionSeam,
): Promise<{ entryTypes: string[]; sources: string[] }> {
  const rows = await seam.snapshot([JOURNAL_STORE]);
  const entryTypes = rows
    .rows(JOURNAL_STORE)
    .filter((row) => row.kind === "entryType")
    .map((row) => String(row.stableKey))
    .sort();
  const sources = rows
    .rows(JOURNAL_STORE)
    .filter((row) => row.kind === "source")
    .map((row) => String(row.stableKey))
    .sort();
  return { entryTypes, sources };
}
