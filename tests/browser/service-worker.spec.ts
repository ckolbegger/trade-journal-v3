import { expect, test } from "@playwright/test";
import { startHarness, waitForControl, missingFromCache, missingReleaseEntries, workerStatus } from "./worker-support";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";

test.describe("sw-control", () => {
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
});

test.describe("sw-offline", () => {
  test("with the context stopped and the network disabled the URL reopens from cache", async ({
    page,
    context,
  }) => {
    await startHarness(page);
    await waitForControl(page);
    await expect.poll(() => missingFromCache(page), { timeout: 20_000 }).toBe(0);

    await page.close();
    await context.setOffline(true);

    const offline = await context.newPage();
    const requested: string[] = [];
    offline.on("request", (request) => {
      if (/^https?:\/\//.test(request.url())) requested.push(request.url());
    });
    const response = await offline.goto("/");
    expect(response?.status()).toBe(200);
    await expect(offline.getByRole("heading", { level: 1, name: "Trade Journal" })).toBeVisible();

    expect(await missingFromCache(offline)).toBe(0);
    const origin = new URL(offline.url()).origin;
    expect([...new Set(requested.map((url) => new URL(url).origin))]).toEqual([origin]);
  });
});

test.describe("sw-staging-failure", () => {
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
});

test.describe("sw-two-releases", () => {
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

    // The activation takes effect at the explicit reload, exactly as the D22 update flow will do.
    await page.reload();
    await expect
      .poll(async () => (await workerStatus(page)).controllerReleaseId, { timeout: 20_000 })
      .toBe(releaseB.releaseId);

    const keys = await page.evaluate(async () => caches.keys());
    expect(keys).toContain(`trade-journal-release-${releaseA.releaseId}`);
    expect(keys).toContain(`trade-journal-release-${releaseB.releaseId}`);
    expect(await missingFromCache(page)).toBe(0);
  });
});

test.describe("sw-update", () => {
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
});
