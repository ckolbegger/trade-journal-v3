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

test("with a staged newer worker the running worker is still in control, no reload occurs, and the newer worker waits", async ({
  page,
}) => {
  const releaseB = JSON.parse(
    readFileSync("artifacts/sw-test/release-b/release-inventory.json", "utf8"),
  ) as { releaseId: string };

  await startHarness(page);
  const controller = await waitForControl(page);
  await expect.poll(() => missingFromCache(page), { timeout: 20_000 }).toBe(0);

  await page.evaluate(() => {
    (window as unknown as { __noReloadMarker?: number }).__noReloadMarker = 1;
  });

  writeFileSync("artifacts/sw-test/active.txt", "b");
  await page.evaluate(async () => {
    const host = window.__TRADE_JOURNAL_HOST__;
    if (host === undefined) throw new Error("the harness did not expose the host port");
    await host.updateWorker();
  });

  await expect
    .poll(async () => (await workerStatus(page)).waitingReleaseId, { timeout: 20_000 })
    .toBe(releaseB.releaseId);

  const status = await workerStatus(page);
  expect(status.controllerReleaseId).toBe(controller);
  expect(
    await page.evaluate(() => (window as unknown as { __noReloadMarker?: number }).__noReloadMarker),
  ).toBe(1);
});
