import { runDiagnosticTransaction } from "../persistence/indexeddb/diagnostic";
import {
  DATABASE_NAME,
  D2_SCHEMA_MANIFEST,
  D2_SCHEMA_VERSION,
  openDatabaseWithStores,
} from "../persistence/indexeddb/schema";
import type { HostPort } from "../platform/host";
import { establishReadiness, type ReadinessResult } from "../readiness";
import { validateReleaseInventory } from "../release/inventory";

/** The production wiring: the real host port, the real database and the real inventory artifact. */
export async function establishApplicationReadiness(host: HostPort): Promise<ReadinessResult> {
  // The diagnostic must open the schema the application actually uses, or the engine rejects the
  // open as a lower version than the existing database.
  const database = await openDatabaseWithStores(
    D2_SCHEMA_MANIFEST,
    DATABASE_NAME,
    D2_SCHEMA_VERSION,
  );
  try {
    return await establishReadiness({
      protection: () => host.protection(),
      diagnostic: () => runDiagnosticTransaction(database),
      capacity: async () => {
        const measured = await host.capacity();
        if (measured.kind === "Measured") return { freeBytes: measured.freeBytes };
        return {
          unavailableReason:
            measured.kind === "Unavailable"
              ? measured.reason
              : "the host does not expose a capacity estimate",
        };
      },
      workerControl: () => host.workerControl(),
      inventory: (expectedReleaseId) =>
        validateReleaseInventory(
          host,
          expectedReleaseId === undefined ? {} : { expectedReleaseId },
        ),
    });
  } finally {
    database.close();
  }
}
