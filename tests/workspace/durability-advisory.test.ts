import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase } from "../../src/persistence/indexeddb/schema";
import { establishReadiness } from "../../src/readiness";
import { requestDurability } from "../../src/workspace/durability";
import { close, openSeam, seed } from "../persistence/revision-support";
import { passingPorts } from "../readiness/support";

afterEach(async () => {
  await deleteDatabase();
});

describe("Workspace.requestDurability reports the host's real answer and never fabricates protection", () => {
  it("should leave Runtime Readiness unchanged: the session remains Writable with the not-protected warning visible after a NotImproved result while all four checks pass", async () => {
    const readiness = await establishReadiness(
      passingPorts({ protection: async () => ({ kind: "BestEffort", reason: "not granted" }) }),
    );
    const denied = await requestDurability({
      protection: async () => ({ kind: "BestEffort", reason: "not granted" }),
      requestDurability: async () => ({ kind: "Denied", reason: "denied" }),
      readiness: async () => readiness,
    });

    expect(readiness.outcome).toBe("Writable");
    expect(readiness.notProtectedWarning).toBe(true);
    expect(denied).toMatchObject({
      outcome: "NotImproved",
      readiness: { outcome: "Writable", notProtectedWarning: true },
    });
  });

  it("should record the protection state in the readiness evidence at each launch regardless of the request outcome", async () => {
    const readiness = await establishReadiness(
      passingPorts({ protection: async () => ({ kind: "BestEffort", reason: "not granted" }) }),
    );

    expect(readiness.evidence.protection).toEqual({ kind: "BestEffort", reason: "not granted" });
    expect(readiness.notProtectedWarning).toBe(true);
  });

  it("should delete, export and mutate nothing, proven by identical authoritative revisions before and after the call", async () => {
    const { database, seam } = await openSeam();
    await seed(seam, "workspaceMeta", { key: "workspace", value: { timeZone: "America/New_York" } });
    const fingerprint = async (): Promise<string> => {
      const snapshot = await seam.snapshot(["workspaceMeta", "referenceCatalog", "journal"]);
      return JSON.stringify({
        workspaceMeta: snapshot.rows("workspaceMeta"),
        referenceCatalog: snapshot.rows("referenceCatalog"),
        journal: snapshot.rows("journal"),
      });
    };
    const before = await fingerprint();
    const readiness = await establishReadiness(passingPorts());

    await requestDurability({
      protection: async () => ({ kind: "BestEffort", reason: "not granted" }),
      requestDurability: async () => ({ kind: "Granted" }),
      readiness: async () => readiness,
    });

    expect(await fingerprint()).toBe(before);
    await close(database);
  });
});
