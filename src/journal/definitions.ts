import { SEED_MANIFEST_FULL, type PromptKind } from "./seedManifest";

const JOURNAL_STORE = "journal";
import type { TransactionSeam } from "../persistence/indexeddb/transaction";

/**
 * Journal definitions: the immutable, versioned Entry Type forms a workflow renders and submits
 * against. D2 needs the exact latest or exact retained Plan Reflection revision, with every identity
 * the confirmation form must submit and no invented revision identity.
 */
export interface EntryDefinitionOption {
  /** Stable Option identity; survives rewording. */
  readonly stableKey: string;
  readonly label: string;
}

export interface EntryDefinitionPrompt {
  /** Stable Prompt identity; survives rewording and reordering. */
  readonly stableKey: string;
  readonly label: string;
  readonly kind: PromptKind;
  readonly required: boolean;
  readonly semanticRole?: "thesis" | "invalidation" | "revision-rationale";
  readonly options?: readonly EntryDefinitionOption[];
  readonly scaleMin?: number;
  readonly scaleMax?: number;
}

export interface EntryTypeDefinition {
  readonly entryTypeStableKey: string;
  readonly label: string;
  readonly revision: number;
  readonly definitionVersion: string;
  readonly prompts: readonly EntryDefinitionPrompt[];
}

export interface SourceDefinition {
  readonly sourceStableKey: string;
  readonly label: string;
  readonly revision: number;
  readonly writingPath: string;
}

export interface GetEntryDefinitionsRequest {
  /** A fixed Entry Type stable key; absent means every fixed type. */
  readonly entryTypeStableKey?: string;
  /** An exact retained revision; absent means the latest. */
  readonly revision?: number;
}

export type EntryDefinitionSet =
  | {
      readonly outcome: "Definitions";
      readonly entryTypes: readonly EntryTypeDefinition[];
      readonly sources: readonly SourceDefinition[];
      /** Fixed product identities this release has not installed, named rather than faked. */
      readonly absentEntryTypes: readonly string[];
      readonly absentSources: readonly string[];
    }
  | {
      readonly outcome: "NotFound";
      readonly entryTypeStableKey: string;
      readonly revision: number;
    };

/** The seven fixed Entry Type and Source identities, so absence can be named rather than faked. */
export const FIXED_ENTRY_TYPE_KEYS: readonly string[] = SEED_MANIFEST_FULL.entryTypes.map(
  (entryType) => entryType.stableKey,
);
export const FIXED_SOURCE_KEYS: readonly string[] = SEED_MANIFEST_FULL.sources.map(
  (source) => source.stableKey,
);

interface DefinitionRow extends Record<string, unknown> {
  readonly id: string;
  readonly kind: string;
  readonly stableKey: string;
  readonly label: string;
  readonly revision: number;
  readonly definition?: { readonly version?: string; readonly prompts?: readonly unknown[] };
  readonly writingPath?: string;
}

function scaleBounds(prompt: EntryDefinitionPrompt): EntryDefinitionPrompt {
  // A Scale prompt is bounded 1..5 unless its definition says otherwise (`journal.md:49`).
  if (prompt.kind !== "scale") return prompt;
  return { ...prompt, scaleMin: prompt.scaleMin ?? 1, scaleMax: prompt.scaleMax ?? 5 };
}

function entryTypeOf(row: DefinitionRow): EntryTypeDefinition {
  const prompts = (row.definition?.prompts ?? []) as readonly EntryDefinitionPrompt[];
  return {
    entryTypeStableKey: row.stableKey,
    label: row.label,
    revision: row.revision,
    definitionVersion: row.definition?.version ?? "",
    prompts: prompts.map((prompt) => scaleBounds(prompt)),
  };
}

function sourceOf(row: DefinitionRow): SourceDefinition {
  return {
    sourceStableKey: row.stableKey,
    label: row.label,
    revision: row.revision,
    writingPath: row.writingPath ?? "",
  };
}

/**
 * `getDefinitions` returns the latest definitions for the fixed types, or one exact retained
 * revision. A definition is an immutable revision, never a recomputed view, so the same request
 * returns an identical value.
 */
export async function getDefinitions(
  seam: TransactionSeam,
  request: GetEntryDefinitionsRequest = {},
): Promise<EntryDefinitionSet> {
  const rows = (await seam.snapshot([JOURNAL_STORE])).rows(JOURNAL_STORE) as unknown as DefinitionRow[];

  if (request.entryTypeStableKey !== undefined) {
    const candidates = rows.filter(
      (row) => row.kind === "entryType" && row.stableKey === request.entryTypeStableKey,
    );
    const selected = request.revision === undefined ? latestOf(candidates) : retainedAt(candidates, request.revision);
    if (selected === undefined) {
      return {
        outcome: "NotFound",
        entryTypeStableKey: request.entryTypeStableKey,
        revision: request.revision ?? 0,
      };
    }
    const entryTypes = [entryTypeOf(selected)];
    const sources = rows
      .filter((row) => row.kind === "source")
      .map((row) => sourceOf(row))
      .sort((left, right) => left.sourceStableKey.localeCompare(right.sourceStableKey));
    return {
      outcome: "Definitions",
      entryTypes,
      sources,
      absentEntryTypes: FIXED_ENTRY_TYPE_KEYS.filter(
        (key) => !entryTypes.some((entryType) => entryType.entryTypeStableKey === key),
      ),
      absentSources: FIXED_SOURCE_KEYS.filter(
        (key) => !sources.some((source) => source.sourceStableKey === key),
      ),
    };
  }

  const entryTypes = FIXED_ENTRY_TYPE_KEYS.flatMap((key) => {
    const selected = latestOf(rows.filter((row) => row.kind === "entryType" && row.stableKey === key));
    return selected === undefined ? [] : [entryTypeOf(selected)];
  });
  const sources = FIXED_SOURCE_KEYS.flatMap((key) => {
    const selected = latestOf(rows.filter((row) => row.kind === "source" && row.stableKey === key));
    return selected === undefined ? [] : [sourceOf(selected)];
  });

  return {
    outcome: "Definitions",
    entryTypes,
    sources,
    absentEntryTypes: FIXED_ENTRY_TYPE_KEYS.filter(
      (key) => !entryTypes.some((entryType) => entryType.entryTypeStableKey === key),
    ),
    absentSources: FIXED_SOURCE_KEYS.filter(
      (key) => !sources.some((source) => source.sourceStableKey === key),
    ),
  };
}

function latestOf(rows: readonly DefinitionRow[]): DefinitionRow | undefined {
  let latest: DefinitionRow | undefined;
  for (const row of rows) if (latest === undefined || row.revision > latest.revision) latest = row;
  return latest;
}

/** An exact retained revision, either the current row or one kept in its revision history. */
function retainedAt(
  rows: readonly DefinitionRow[],
  revision: number,
): DefinitionRow | undefined {
  for (const row of rows) {
    if (row.revision === revision) return row;
    const revisions =
      (row.revisions as
        | readonly {
            readonly revision: number;
            readonly label: string;
            readonly definition?: { readonly version?: string; readonly prompts?: readonly unknown[] };
          }[]
        | undefined) ?? [];
    const retained = revisions.find((entry) => entry.revision === revision);
    if (retained !== undefined) {
      return {
        id: row.id,
        kind: row.kind,
        stableKey: row.stableKey,
        label: retained.label,
        revision: retained.revision,
        definition: retained.definition,
      };
    }
  }
  return undefined;
}
