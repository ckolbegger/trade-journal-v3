import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { missingReleaseEntries, startHarness, waitForControl, workerStatus } from "./worker-support";



test.beforeAll(() => {
  mkdirSync("artifacts/sw-test", { recursive: true });
  writeFileSync("artifacts/sw-test/active.txt", "a");
  execFileSync("node", ["scripts/build-variant.mjs", "c"], { stdio: "inherit" });
  // Deploy a release that is missing one asset it claims in its inventory.
  const missing = "artifacts/sw-test/release-c/manifest.webmanifest";
  const held = "artifacts/sw-test/release-c/manifest.webmanifest.held";
  copyFileSync(missing, held);
  execFileSync("node", [
    "-e",
    `require('node:fs').rmSync(${JSON.stringify(missing)})`,
  ]);
});

test.afterAll(() => {
  const held = "artifacts/sw-test/release-c/manifest.webmanifest.held";
  const target = "artifacts/sw-test/release-c/manifest.webmanifest";
  if (existsSync(held)) copyFileSync(held, target);
  writeFileSync("artifacts/sw-test/active.txt", "a");
});

test("with one asset absent from the deployed build the new worker fails to install, the previous worker remains in control, and readiness stays on the previous release", async ({
  page,
}) => {
  await startHarness(page);
  const controller = await waitForControl(page);
  const releaseA = await page.evaluate(async () => {
    const response = await fetch("/release-inventory.json", { cache: "no-store" });
    return (await response.json()) as { entries: { url: string }[] };
  });
  await expect.poll(() => missingReleaseEntries(page, releaseA.entries), { timeout: 20_000 }).toBe(0);

  writeFileSync("artifacts/sw-test/active.txt", "c");
  await page.evaluate(async () => {
    const host = window.__TRADE_JOURNAL_HOST__;
    if (host === undefined) throw new Error("the harness did not expose the host port");
    await host.updateWorker();
  });

  await page.waitForTimeout(1500);
  const status = await workerStatus(page);
  expect(status.waitingReleaseId).toBeUndefined();
  expect(status.controllerReleaseId).toBe(controller);
  // The previous release's cached inventory is still complete, so the session stays on it.
  expect(await missingReleaseEntries(page, releaseA.entries)).toBe(0);
});
