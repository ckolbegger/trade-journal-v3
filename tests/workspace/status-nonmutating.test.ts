import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase } from "../../src/persistence/indexeddb/schema";
import { getStatus } from "../../src/workspace/status";
import { close, openSeam, seed } from "../persistence/revision-support";
import { statusPorts } from "./status-support";

afterEach(async () => {
  await deleteDatabase();
});

describe("Workspace.getStatus reports one honest lifecycle status from readiness, root state and installed capability", () => {
  it("should mutate and repair nothing, proven by identical store digests before and after a call that reports a disagreement", async () => {
    const { database, seam } = await openSeam();
    await seed(seam, "workspaceMeta", {
      key: "workspace",
      value: { timeZone: "America/New_York", timeZoneRevision: 2 },
    });
    await seed(seam, "lifecycleIndex", {
      tradeId: "trade-1",
      state: "Open",
      factRevision: 1,
      openedOn: "2026-10-01",
    });

    const fingerprint = async (): Promise<string> => {
      const snapshot = await seam.snapshot(["workspaceMeta", "lifecycleIndex"]);
      return JSON.stringify({
        workspaceMeta: snapshot.rows("workspaceMeta"),
        lifecycleIndex: snapshot.rows("lifecycleIndex"),
      });
    };
    const before = await fingerprint();

    const status = await getStatus(
      await statusPorts({
        readWorkspace: async () => ({
          outcome: "Unreadable",
          detail: "stored lifecycle disagrees with the effective facts",
        }),
      }),
    );

    expect(status.outcome).toBe("IntegrityBlocked");
    expect(await fingerprint()).toBe(before);

    await close(database);
  });
});
