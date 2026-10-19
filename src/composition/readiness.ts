import { runDiagnosticTransaction } from "../persistence/indexeddb/diagnostic";
import { openDatabase } from "../persistence/indexeddb/schema";
import type { HostPort } from "../platform/host";
import { establishReadiness, type ReadinessResult } from "../readiness";
import { validateReleaseInventory } from "../release/inventory";

/** The production wiring: the real host port, the real database and the real inventory artifact. */
export async function establishApplicationReadiness(host: HostPort): Promise<ReadinessResult> {
  const database = await openDatabase();
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
