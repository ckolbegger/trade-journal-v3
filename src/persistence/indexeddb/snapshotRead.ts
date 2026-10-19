import type { ReadSnapshot, TransactionSeam } from "./transaction";

export interface ReadSource {
  readonly name: string;
  readonly store: string;
  read(
    snapshot: ReadSnapshot,
  ): Record<string, unknown> | undefined | Promise<Record<string, unknown> | undefined>;
}

export interface AssembledRead {
  readonly outcome: "Assembled";
  readonly model: Readonly<Record<string, unknown>>;
  /** The per-store revisions the model was assembled from. */
  readonly binding: Readonly<Record<string, number>>;
  readonly attempts: number;
}

export interface ChangedDuringAssembly {
  readonly outcome: "ChangedDuringAssembly";
  readonly changedRevisions: Readonly<
    Record<string, { readonly expected: number; readonly observed: number }>
  >;
  readonly attempts: number;
}

export type SnapshotReadResult = AssembledRead | ChangedDuringAssembly;

export interface AssembleOptions {
  /** The configured bound; the assembler never retries without limit. */
  readonly maxAttempts: number;
}

async function revisionBinding(seam: TransactionSeam): Promise<Record<string, number>> {
  const snapshot = await seam.snapshot(["workspaceMeta"]);
  const row = snapshot.rows("workspaceMeta").find((entry) => entry.key === "revisions");
  return (row?.value as Record<string, number> | undefined) ?? {};
}

function changedBetween(
  before: Record<string, number>,
  after: Record<string, number>,
): Record<string, { expected: number; observed: number }> {
  const changed: Record<string, { expected: number; observed: number }> = {};
  for (const store of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const expected = before[store] ?? 0;
    const observed = after[store] ?? 0;
    if (expected !== observed) changed[store] = { expected, observed };
  }
  return changed;
}

/**
 * Assemble one coherent multi-module view or report explicitly that the represented revisions changed
 * during assembly. It never returns a torn view, performs no write, and retries a bounded number of
 * times.
 */
export async function assembleRead(
  seam: TransactionSeam,
  sources: readonly ReadSource[],
  options: AssembleOptions,
): Promise<SnapshotReadResult> {
  let lastChanged: Record<string, { expected: number; observed: number }> = {};

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    const before = await revisionBinding(seam);
    const stores = [...new Set(sources.map((source) => source.store))];
    const snapshot = await seam.snapshot(stores);

    const model: Record<string, unknown> = {};
    for (const source of sources) {
      model[source.name] = (await source.read(snapshot)) ?? null;
    }

    const after = await revisionBinding(seam);
    const changed = changedBetween(before, after);
    if (Object.keys(changed).length === 0) {
      return { outcome: "Assembled", model, binding: after, attempts: attempt };
    }
    lastChanged = changed;
  }

  return {
    outcome: "ChangedDuringAssembly",
    changedRevisions: lastChanged,
    attempts: options.maxAttempts,
  };
}
