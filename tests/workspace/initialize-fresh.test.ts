import { describe, expect, it } from "vitest";
import { initialize } from "../../src/workspace";
import { closeWorkspace, rowsOf, workspaceFixture } from "./support";

describe("Workspace.initialize creates one initialized Workspace or refuses with a typed non-writable result", () => {
  it("should create Workspace metadata and atomically seed the declared Journal and Catalog defaults, returning Opened with a receipt naming readiness evidence, schema transitions, seed versions and additions when readiness is Writable and no Workspace exists", async () => {
    const { database, seam, ports } = await workspaceFixture();

    const result = await initialize(ports, {
      openingInstant: "2026-10-20T14:00:00.000Z",
      timeZone: "America/New_York",
    });

    expect(result.outcome).toBe("Opened");
    if (result.outcome === "Opened") {
      expect(result.onboarding).toBe("Needs Institution and Account");
      expect(result.receipt).toMatchObject({
        fresh: true,
        seedVersions: { journal: "journal-seed-v1", catalog: "catalog-seed-v1" },
        seedAdditions: ["entryType.plan-reflection", "source.plan-confirmation", "strategy.long-stock"],
        schemaTransitions: [],
        migrations: [],
        privateRebuilds: [],
        incompleteTransactionRecovery: false,
        timeZone: "America/New_York",
        openingSession: { tradingDate: "2026-10-19", revision: "us-session-2026.1" },
        readiness: { outcome: "Writable" },
      });
    }
    expect(seam.counters.readwriteTransactions).toBe(1);
    expect(await rowsOf(seam, "journal")).toHaveLength(2);
    expect(await rowsOf(seam, "referenceCatalog")).toHaveLength(1);
    const workspace = (await rowsOf(seam, "workspaceMeta")).find((row) => row.key === "workspace");
    expect(workspace?.value).toMatchObject({
      timeZone: "America/New_York",
      openingSession: { tradingDate: "2026-10-19", revision: "us-session-2026.1" },
    });

    await closeWorkspace(database);
  });
});
