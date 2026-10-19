import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase } from "../../src/persistence/indexeddb/schema";
import { readTradeAgreement } from "../../src/persistence/indexeddb/lifecycleIndex";
import { close, openSeam, seed } from "./revision-support";

afterEach(async () => {
  await deleteDatabase();
});

describe("lifecycle index membership commits with its facts and answers cutoff queries within a bounded read", () => {
  it("should surface a structured disagreement, and never repair it, when stored membership for a Trade contradicts its effective facts", async () => {
    const { database, seam } = await openSeam();
    await seed(seam, "lifecycleIndex", {
      tradeId: "trade-1",
      state: "Open",
      factRevision: 2,
      openedOn: "2026-10-01",
    });
    await seed(seam, "tradeRecord", {
      id: "execution-1",
      tradeId: "trade-1",
      kind: "execution",
      side: "buy",
      quantity: "10",
    });
    await seed(seam, "tradeRecord", {
      id: "execution-2",
      tradeId: "trade-1",
      kind: "execution",
      side: "sell",
      quantity: "10",
    });

    const fingerprint = async (): Promise<string> => {
      const snapshot = await seam.snapshot(["lifecycleIndex", "tradeRecord"]);
      return JSON.stringify({
        lifecycleIndex: snapshot.rows("lifecycleIndex"),
        tradeRecord: snapshot.rows("tradeRecord"),
      });
    };
    const before = await fingerprint();

    const read = await readTradeAgreement(seam, "trade-1");

    expect(read?.agreement).toEqual({
      outcome: "Disagreement",
      tradeId: "trade-1",
      storedState: "Open",
      derivedState: "Closed",
    });
    expect(await fingerprint()).toBe(before);

    await close(database);
  });
});
