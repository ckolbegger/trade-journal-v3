import { afterEach, describe, expect, it } from "vitest";
import { closeAll, openStore } from "./support";

afterEach(async () => {
  await closeAll();
});

describe("the D1 integration suite proves the installed foundation end to end through the real stack", () => {
  it("should roll back every participating store to its prior revision when one participant fails inside a multi-store semantic commit", async () => {
    const { database, seam, decisions } = await openStore();
    decisions.current = { outcome: "Writable", failedChecks: [] };
    const seeded = await seam.commit({
      participants: [
        { store: "journal", put: [{ id: "journal:1", anchorKey: "trade:1:open" }] },
        { store: "tradeRecord", put: [{ id: "trade:1", kind: "trade" }] },
      ],
      counters: ["journalEntries"],
    });
    expect(seeded.kind).toBe("Committed");
    const before = await seam.snapshot(["workspaceMeta", "journal", "tradeRecord"]);

    const failing = seam.commit({
      participants: [
        { store: "journal", put: [{ id: "journal:2", anchorKey: "trade:2:open" }] },
        {
          store: "tradeRecord",
          // Not structured-cloneable: adding this request throws and aborts the transaction.
          put: [{ id: "trade:2", kind: "trade", invalid: () => undefined }],
        },
      ],
    });
    await expect(failing).rejects.toThrow();

    const after = await seam.snapshot(["workspaceMeta", "journal", "tradeRecord"]);
    expect(after.rows("workspaceMeta")).toEqual(before.rows("workspaceMeta"));
    expect(after.rows("journal")).toEqual(before.rows("journal"));
    expect(after.rows("tradeRecord")).toEqual(before.rows("tradeRecord"));
    database.close();
  });
});
