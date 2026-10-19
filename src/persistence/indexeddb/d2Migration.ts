import { migrate, type MigrationOutcome, type MigrationPlan } from "./migration";
import { D2_SCHEMA_MANIFEST, D2_SCHEMA_VERSION, SCHEMA_VERSION } from "./schema";
import type { RuntimeNotWritable } from "../../results";
import type { WriteGate } from "./writeGate";

/**
 * The one D2 migration. It adds the D2 durable representation on top of D1's schema through D1's
 * migration runner, so a failed D2 migration leaves the D1 Workspace readable and in control.
 *
 * It is forward-only within this branch and is deliberately not a Restore path. The Journal
 * definition revision lives in the existing `journal` store and the Catalog manifest version marker
 * in the existing `workspaceMeta` store, so neither needs a store of its own; the
 * `tradeLifecycle` store holds the stored Lifecycle State record while `lifecycleIndex` remains the
 * authoritative current-state index written in the same commit.
 */
export const D2_MIGRATION_ID = "d2-plan-facts";

export const D2_MIGRATION: MigrationPlan = {
  migrationId: D2_MIGRATION_ID,
  targetVersion: D2_SCHEMA_VERSION,
  stores: D2_SCHEMA_MANIFEST,
  steps: [
    {
      id: "add-d2-plan-fact-stores",
      fromVersion: SCHEMA_VERSION,
      toVersion: D2_SCHEMA_VERSION,
      apply: (snapshot) => snapshot,
    },
  ],
  seedVersion: "",
  seedAdditions: [],
};

export type D2MigrationOutcome =
  | MigrationOutcome
  | { readonly outcome: "RuntimeNotWritable"; readonly payload: RuntimeNotWritable };

/**
 * D2's migration entry point. It consults the Runtime Readiness write gate *before* any candidate is
 * opened, so a non-`Writable` session cannot begin a migration and cannot create a D2 store.
 */
export async function migrateD2(gate: WriteGate): Promise<D2MigrationOutcome> {
  const gated = await gate.beforeWrite();
  if (gated.kind === "Rejected") return { outcome: "RuntimeNotWritable", payload: gated.payload };
  return migrate(D2_MIGRATION);
}
