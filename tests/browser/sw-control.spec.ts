import { expect, test } from "@playwright/test";
import { startHarness, waitForControl } from "./worker-support";

test("after one load the intended release controls the page", async ({ page }) => {
  await startHarness(page);

  const releaseId = await waitForControl(page);
  const inventoryRelease = await page.evaluate(async () => {
    const response = await fetch("/release-inventory.json", { cache: "no-store" });
    return ((await response.json()) as { releaseId: string }).releaseId;
  });

  expect(releaseId).toBe(inventoryRelease);
  const status = await page.evaluate(async () => {
    const host = window.__TRADE_JOURNAL_HOST__;
    if (host === undefined) throw new Error("the harness did not expose the host port");
    return host.workerStatus();
  });
  expect(status).toMatchObject({ kind: "Reported", controllerReleaseId: releaseId });
});
