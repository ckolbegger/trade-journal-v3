import { expect, test } from "@playwright/test";

async function start(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => {
    (globalThis as unknown as { __TRADE_JOURNAL_HARNESS__?: boolean }).__TRADE_JOURNAL_HARNESS__ =
      true;
  });
  await page.goto("/");
}

test("aborting a multi-store transaction after a staged write leaves every store at its prior revision after a full restart", async ({
  page,
  context,
}) => {
  await start(page);

  const baseline = await page.evaluate(async () => {
    const tx = window.__TRADE_JOURNAL_TX__;
    if (tx === undefined) throw new Error("the harness did not expose the transaction seam");
    return tx.commit({
      participants: [
        { store: "tradeRecord", put: [{ id: "trade-1", kind: "trade" }] },
        { store: "journal", put: [{ id: "entry-1", entryType: "Plan Reflection" }] },
      ],
    });
  });
  expect(baseline).toEqual({
    kind: "Committed",
    revisions: { tradeRecord: 1, journal: 1 },
  });

  const aborted = await page.evaluate(async () => {
    const tx = window.__TRADE_JOURNAL_TX__;
    if (tx === undefined) throw new Error("the harness did not expose the transaction seam");
    try {
      await tx.commit({
        participants: [
          { store: "tradeRecord", put: [{ id: "trade-2", kind: "trade" }] },
          { store: "journal", put: [{ id: "entry-2", entryType: "Plan Reflection" }] },
          { store: "referenceCatalog", put: [{ notAKey: true }] },
        ],
      });
      return { aborted: false };
    } catch {
      return { aborted: true };
    }
  });
  expect(aborted).toEqual({ aborted: true });

  await page.close();
  const restarted = await context.newPage();
  await start(restarted);

  const after = await restarted.evaluate(async () => {
    const schema = window.__TRADE_JOURNAL_SCHEMA__;
    if (schema === undefined) throw new Error("the harness did not expose the schema");
    const database = await schema.open();
    const read = (store: string): Promise<unknown[]> =>
      new Promise((resolve, reject) => {
        const request = database.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result as unknown[]);
        request.onerror = () => reject(request.error);
      });
    const state = {
      tradeRecord: await read("tradeRecord"),
      journal: await read("journal"),
      referenceCatalog: await read("referenceCatalog"),
      workspaceMeta: await read("workspaceMeta"),
    };
    database.close();
    return state;
  });

  expect(after.tradeRecord).toEqual([{ id: "trade-1", kind: "trade" }]);
  expect(after.journal).toEqual([{ id: "entry-1", entryType: "Plan Reflection" }]);
  expect(after.referenceCatalog).toEqual([]);
  expect(after.workspaceMeta).toEqual([
    { key: "revisions", value: { tradeRecord: 1, journal: 1 } },
  ]);
});
