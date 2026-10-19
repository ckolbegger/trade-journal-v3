import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase, rebuildProjections } from "../../src/persistence/indexeddb/schema";
import { close, openSeam, seed } from "./revision-support";

afterEach(async () => {
  await deleteDatabase();
});

describe("lifecycle index membership commits with its facts and answers cutoff queries within a bounded read", () => {
  it("should rebuild membership from authoritative facts and prove recomputed membership equals the rebuilt index after the projection is deliberately deleted", async () => {
    const { database, seam } = await openSeam();
    await seed(seam, "lifecycleIndex", {
      tradeId: "trade-1",
      state: "Open",
      factRevision: 5,
      openedOn: "2026-10-01",
    });
    await seed(seam, "lifecycleIndex", {
      tradeId: "trade-2",
      state: "Closed",
      factRevision: 8,
      openedOn: "2026-10-01",
      closedOn: "2026-10-20",
    });

    const indexRows = (await seam.snapshot(["lifecycleIndex"])).rows("lifecycleIndex");

    await rebuildProjections(database);
    const firstProjection = (await seam.snapshot(["lifecycleListProjection"])).rows(
      "lifecycleListProjection",
    );

    const clear = database.transaction("lifecycleListProjection", "readwrite");
    clear.objectStore("lifecycleListProjection").clear();
    await new Promise<void>((resolve, reject) => {
      clear.oncomplete = () => resolve();
      clear.onerror = () => reject(clear.error);
    });
    expect((await seam.snapshot(["lifecycleListProjection"])).rows("lifecycleListProjection")).toEqual(
      [],
    );

    await rebuildProjections(database);
    const secondProjection = (await seam.snapshot(["lifecycleListProjection"])).rows(
      "lifecycleListProjection",
    );

    expect(secondProjection).toEqual(firstProjection);
    expect(secondProjection.map((row) => row.tradeId).sort()).toEqual(
      indexRows.map((row) => row.tradeId).sort(),
    );
    expect(secondProjection.every((row) => typeof row.factRevision === "number")).toBe(true);

    await close(database);
  });
});
