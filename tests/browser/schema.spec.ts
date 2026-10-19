import { expect, test } from "@playwright/test";

test("a real IndexedDB database matches the declared manifest and survives a full stop", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    (globalThis as unknown as { __TRADE_JOURNAL_HARNESS__?: boolean }).__TRADE_JOURNAL_HARNESS__ =
      true;
  });
  await page.goto("/");

  const created = await page.evaluate(async () => {
    const schema = window.__TRADE_JOURNAL_SCHEMA__;
    if (schema === undefined) throw new Error("the harness did not expose the schema");
    const database = await schema.open();
    const state = {
      names: Array.from(database.objectStoreNames).sort(),
      expected: schema.manifest.map((store) => store.name).sort(),
      version: database.version,
    };
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("workspaceMeta", "readwrite");
      transaction
        .objectStore("workspaceMeta")
        .put({ key: "schema-probe", value: "kept" });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    return state;
  });

  expect(created.names).toEqual(created.expected);

  await page.close();
  const restarted = await context.newPage();
  await restarted.addInitScript(() => {
    (globalThis as unknown as { __TRADE_JOURNAL_HARNESS__?: boolean }).__TRADE_JOURNAL_HARNESS__ =
      true;
  });
  await restarted.goto("/");

  const reopened = await restarted.evaluate(async () => {
    const schema = window.__TRADE_JOURNAL_SCHEMA__;
    if (schema === undefined) throw new Error("the harness did not expose the schema");
    const database = await schema.open();
    const row = await new Promise<unknown>((resolve, reject) => {
      const request = database
        .transaction("workspaceMeta", "readonly")
        .objectStore("workspaceMeta")
        .get("schema-probe");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const version = database.version;
    database.close();
    return { row, version };
  });

  expect(reopened.version).toBe(created.version);
  expect(reopened.row).toEqual({ key: "schema-probe", value: "kept" });
});
