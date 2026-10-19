import { expect, test } from "@playwright/test";
import { initializeJournal, startWith } from "../support/browser";

/**
 * T19's real-engine leg. `fake-indexeddb` is a behavioural substitute for the browser-owned store, so
 * the durability-critical half of the D2 proofs is repeated here against the real engine:
 *
 * - multi-store atomicity of the confirming commit (writer/readback across four stores),
 * - lifecycle-index membership surviving a full page stop,
 * - the committed values being identical after a restart.
 *
 * Fidelity gaps this leg does NOT close, and which no D2 proof claims: transaction scheduling under
 * multi-connection contention, storage quota accounting and eviction, and durability across a
 * browser *process* kill (a page close is a new page, not a new browser process). Those are listed in
 * `tests/substitutions.md` and remain open.
 */
test.describe("d2-durability", () => {
  async function onboardAndConfirm(page: import("@playwright/test").Page): Promise<void> {
    await startWith(page);
    await initializeJournal(page);
    await page.getByRole("button", { name: "Set up" }).click();
    await page.getByLabel("Institution name").fill("Fidelity");
    await page.getByRole("button", { name: "Add institution" }).click();
    await page.getByLabel("Institution", { exact: true }).selectOption({ label: "Fidelity" });
    await page.getByLabel("Account name").fill("Brokerage One");
    await page.getByRole("button", { name: "Add account" }).click();
    await page.getByRole("button", { name: "Plan", exact: true }).click();
    await page.getByLabel("Account", { exact: true }).selectOption({ label: "Brokerage One" });
    await page.getByLabel("Strategy", { exact: true }).selectOption({ label: "Long Stock" });
    await page.getByLabel("Intended entry").fill("180");
    await page.getByLabel("Instrument", { exact: true }).fill("AAPL");
    await page.getByLabel("Planned Leg quantity").fill("100");
    await page.getByLabel("Boundary price").nth(0).fill("175");
    await page.getByLabel("Boundary price").nth(1).fill("190");
    await page.getByLabel("Why this trade, why now? (required)").fill("Breakout above the base");
    await page
      .getByLabel("What would invalidate the thesis? (required)")
      .fill("Closes back inside the base");
    await page.getByRole("button", { name: "Save the plan" }).click();
    await expect(page.getByRole("heading", { name: "Plan confirmed" })).toBeVisible();
  }

  async function readDurable(page: import("@playwright/test").Page): Promise<{
    lifecycleIndex: { tradeId: string; state: string; factRevision: number }[];
    tradeLifecycle: { tradeId: string; state: string; factRevision: number }[];
    tradeVersion: { factRevision: number }[];
    factKinds: string[];
    entries: { thesis: string; invalidation: string; sourceStableKey: string }[];
  }> {
    return page.evaluate(async () => {
      const schema = window.__TRADE_JOURNAL_SCHEMA__;
      if (schema === undefined) throw new Error("the harness did not expose the schema");
      const database = await schema.open();
      const read = (store: string): Promise<Record<string, unknown>[]> =>
        new Promise((resolve, reject) => {
          const request = database.transaction(store).objectStore(store).getAll();
          request.onsuccess = () => resolve(request.result as Record<string, unknown>[]);
          request.onerror = () => reject(request.error);
        });
      const state = {
        lifecycleIndex: (await read("lifecycleIndex")) as { tradeId: string; state: string; factRevision: number }[],
        tradeLifecycle: (await read("tradeLifecycle")) as { tradeId: string; state: string; factRevision: number }[],
        tradeVersion: (await read("tradeVersion")) as { factRevision: number }[],
        factKinds: (await read("tradeRecord")).map((row) => String(row.kind)).sort(),
        entries: (await read("journal"))
          .filter((row) => row.kind === "entry")
          .map((row) => ({
            thesis: String(row.thesis ?? ""),
            invalidation: String(row.invalidation ?? ""),
            sourceStableKey: String(row.sourceStableKey ?? ""),
          })),
      };
      database.close();
      return state;
    });
  }

  test("the confirming commit is atomic across the real engine's stores and its index membership survives a full page stop", async ({
    page,
    context,
  }) => {
    await onboardAndConfirm(page);

    const before = await readDurable(page);
    expect(before.factKinds).toEqual([
      "management-condition",
      "management-condition",
      "plan",
      "planned-leg",
      "trade",
    ]);
    expect(before.tradeLifecycle).toHaveLength(1);
    expect(before.lifecycleIndex).toHaveLength(1);
    expect(before.tradeVersion).toHaveLength(1);
    expect(before.entries).toHaveLength(1);
    // One commit: the lifecycle record, the index entry and the version row all name FactRevision 1.
    expect(before.tradeLifecycle[0]?.factRevision).toBe(1);
    expect(before.lifecycleIndex[0]?.factRevision).toBe(1);
    expect(before.tradeVersion[0]?.factRevision).toBe(1);
    expect(before.lifecycleIndex[0]?.tradeId).toBe(before.tradeLifecycle[0]?.tradeId);
    expect(before.entries[0]?.sourceStableKey).toBe("source.plan-confirmation");

    // A full page stop, then a fresh page against the same real engine.
    await page.close();
    const restarted = await context.newPage();
    await startWith(restarted);
    const after = await readDurable(restarted);
    expect(after).toEqual(before);

    await restarted.getByRole("button", { name: "Trades" }).click();
    await expect(restarted.getByTestId("trade-one-r")).toContainText("500");
    await expect(restarted.getByTestId("trade-stored-lifecycle")).toHaveText("Planned");
    await expect(restarted.getByTestId("trade-thesis")).toHaveText("Breakout above the base");
  });

  test("a commit touching D2's stores aborts on the real engine without leaving a lifecycle record, an index entry or a version row", async ({
    page,
  }) => {
    await startWith(page);
    await initializeJournal(page);

    const result = await page.evaluate(async () => {
      const tx = window.__TRADE_JOURNAL_TX__;
      if (tx === undefined) throw new Error("the harness did not expose the transaction seam");
      try {
        await tx.commit({
          participants: [
            { store: "tradeRecord", put: [{ id: "probe:trade", tradeId: "probe", kind: "trade" }] },
            { store: "tradeLifecycle", put: [{ tradeId: "probe", state: "Planned", factRevision: 1 }] },
            { store: "lifecycleIndex", put: [{ tradeId: "probe", state: "Planned", factRevision: 1 }] },
            { store: "tradeVersion", put: [{ id: "probe:1", tradeId: "probe", factRevision: 1, recordedSequence: 1 }] },
            { store: "storeThatDoesNotExist", put: [{ id: "x" }] },
          ],
        });
        return { aborted: false };
      } catch {
        return { aborted: true };
      }
    });
    expect(result).toEqual({ aborted: true });

    const after = await page.evaluate(async () => {
      const schema = window.__TRADE_JOURNAL_SCHEMA__;
      if (schema === undefined) throw new Error("the harness did not expose the schema");
      const database = await schema.open();
      const count = (store: string): Promise<number> =>
        new Promise((resolve, reject) => {
          const request = database.transaction(store).objectStore(store).count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      const counts = {
        tradeRecord: await count("tradeRecord"),
        tradeLifecycle: await count("tradeLifecycle"),
        lifecycleIndex: await count("lifecycleIndex"),
        tradeVersion: await count("tradeVersion"),
      };
      database.close();
      return counts;
    });
    expect(after).toEqual({
      tradeRecord: 0,
      tradeLifecycle: 0,
      lifecycleIndex: 0,
      tradeVersion: 0,
    });
  });
});
