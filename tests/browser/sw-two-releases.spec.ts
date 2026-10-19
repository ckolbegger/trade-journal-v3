import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { missingFromCache, startHarness, waitForControl, workerStatus } from "./worker-support";

test.beforeAll(() => {
  mkdirSync("artifacts/sw-test", { recursive: true });
  writeFileSync("artifacts/sw-test/active.txt", "a");
  execFileSync("node", ["scripts/build-variant.mjs", "b"], { stdio: "inherit" });
});

test.afterAll(() => {
  writeFileSync("artifacts/sw-test/active.txt", "a");
});

test("activating the waiting worker at an explicit reload leaves the previous release's cache untouched and the new inventory validated", async ({
  page,
}) => {
  const releaseB = JSON.parse(
    readFileSync("artifacts/sw-test/release-b/release-inventory.json", "utf8"),
  ) as { releaseId: string };

  await startHarness(page);
  const controllerA = await waitForControl(page);
  const releaseA = await page.evaluate(async () => {
    const response = await fetch("/release-inventory.json", { cache: "no-store" });
    return (await response.json()) as { releaseId: string };
  });
  expect(controllerA).toBe(releaseA.releaseId);

  writeFileSync("artifacts/sw-test/active.txt", "b");
  await page.evaluate(async () => {
    const host = window.__TRADE_JOURNAL_HOST__;
    if (host === undefined) throw new Error("the harness did not expose the host port");
    await host.updateWorker();
  });
  await expect
    .poll(async () => (await workerStatus(page)).waitingReleaseId, { timeout: 20_000 })
    .toBe(releaseB.releaseId);

  const beforeActivation = await page.evaluate(async () => {
    const keys = await caches.keys();
    return keys;
  });
  expect(beforeActivation).toContain(`trade-journal-release-${releaseA.releaseId}`);

  const activation = await page.evaluate(async () => {
    const host = window.__TRADE_JOURNAL_HOST__;
    if (host === undefined) throw new Error("the harness did not expose the host port");
    return host.activateWaitingWorker();
  });
  expect(activation).toEqual({ kind: "Requested" });

  await expect
    .poll(async () => (await workerStatus(page)).controllerReleaseId, { timeout: 20_000 })
    .toBe(releaseB.releaseId);

  const keys = await page.evaluate(async () => caches.keys());
  expect(keys).toContain(`trade-journal-release-${releaseA.releaseId}`);
  expect(keys).toContain(`trade-journal-release-${releaseB.releaseId}`);
  expect(await missingFromCache(page)).toBe(0);
});
