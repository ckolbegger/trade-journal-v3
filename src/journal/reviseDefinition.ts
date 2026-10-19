import type { TransactionSeam } from "../persistence/indexeddb/transaction";
import type { RuntimeNotWritable } from "../results";
import type { EntryTypeDefinition, EntryDefinitionPrompt } from "./definitions";
import type { PromptDefinition } from "./seedManifest";

const JOURNAL_STORE = "journal";

/** `reviseDefinition` atomically replaces the complete future form of one fixed Entry Type. */
export interface ReviseEntryDefinitionCommand {
  readonly entryTypeStableKey: string;
  readonly expectedRevision: number;
  readonly label?: string;
  readonly prompts: readonly PromptDefinition[];
}

export type ReviseEntryDefinitionResult =
  | { readonly outcome: "Revised"; readonly definition: EntryTypeDefinition }
  | { readonly outcome: "Unchanged"; readonly definition: EntryTypeDefinition }
  | { readonly outcome: "Conflict"; readonly expected: number; readonly current: number }
  | { readonly outcome: "Rejected"; readonly detail: string }
  | { readonly outcome: "NotFound"; readonly entryTypeStableKey: string }
  | { readonly outcome: "RuntimeNotWritable"; readonly payload: RuntimeNotWritable };

function sameForm(left: readonly EntryDefinitionPrompt[], right: readonly PromptDefinition[]): boolean {
  const canonical = (prompts: readonly PromptDefinition[]): string =>
    JSON.stringify(
      prompts.map((prompt) => ({
        stableKey: prompt.stableKey,
        label: prompt.label,
        kind: prompt.kind,
        required: prompt.required,
        semanticRole: prompt.semanticRole ?? null,
        scaleMin: prompt.scaleMin ?? null,
        scaleMax: prompt.scaleMax ?? null,
        options: (prompt.options ?? []).map((option) => ({
          stableKey: option.stableKey,
          label: option.label,
        })),
      })),
    );
  return canonical(left as readonly PromptDefinition[]) === canonical(right);
}

function definitionOf(row: Record<string, unknown>): EntryTypeDefinition {
  const definition = row.definition as
    | { version?: string; prompts?: readonly EntryDefinitionPrompt[] }
    | undefined;
  return {
    entryTypeStableKey: String(row.stableKey),
    label: String(row.label),
    revision: Number(row.revision),
    definitionVersion: definition?.version ?? "",
    prompts: definition?.prompts ?? [],
  };
}

/**
 * `reviseDefinition` atomically replaces the complete future form of one fixed Entry Type after an
 * expected-revision check. An identical normalized definition is unchanged and returns the existing
 * definition; the previous form is retained so an exact revision stays readable.
 */
export async function reviseDefinition(
  seam: TransactionSeam,
  command: ReviseEntryDefinitionCommand,
): Promise<ReviseEntryDefinitionResult> {
  const rows = (await seam.snapshot([JOURNAL_STORE])).rows(JOURNAL_STORE);
  const row = rows.find(
    (candidate) =>
      candidate.kind === "entryType" && candidate.stableKey === command.entryTypeStableKey,
  );
  if (row === undefined) {
    return { outcome: "NotFound", entryTypeStableKey: command.entryTypeStableKey };
  }
  const current = Number(row.revision);
  if (current !== command.expectedRevision) {
    return { outcome: "Conflict", expected: command.expectedRevision, current };
  }
  const definition = row.definition as { version?: string; prompts?: readonly EntryDefinitionPrompt[] } | undefined;
  // A workflow-critical role cannot be removed or repurposed while its capability is installed.
  const retainedKeys = new Set(command.prompts.map((prompt) => prompt.stableKey));
  const lost = (definition?.prompts ?? []).find(
    (prompt) => prompt.semanticRole !== undefined && !retainedKeys.has(prompt.stableKey),
  );
  if (lost !== undefined) {
    return {
      outcome: "Rejected",
      detail: `the workflow-critical ${String(lost.semanticRole)} role cannot be removed while Plan confirmation is installed`,
    };
  }
  if (sameForm(definition?.prompts ?? [], command.prompts)) {
    return { outcome: "Unchanged", definition: definitionOf(row) };
  }

  const nextRow: Record<string, unknown> = {
    ...row,
    label: command.label ?? row.label,
    revision: current + 1,
    definition: { version: command.label === undefined ? (definition?.version ?? "") : definition?.version ?? "", prompts: command.prompts },
    revisions: [
      ...((row.revisions as readonly unknown[] | undefined) ?? []),
      {
        revision: current,
        label: row.label,
        definition: { version: definition?.version ?? "", prompts: definition?.prompts ?? [] },
      },
    ],
  };
  const committed = await seam.commit({
    participants: [{ store: JOURNAL_STORE, put: [nextRow] }],
  });
  if (committed.kind === "Rejected") {
    return { outcome: "RuntimeNotWritable", payload: committed.payload };
  }
  return { outcome: "Revised", definition: definitionOf(nextRow) };
}
