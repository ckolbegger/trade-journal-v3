import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { missingFromCache, startHarness, waitForControl, armHarness } from "./worker-support";

test.describe("readiness", () => {
  interface ReadinessResult {
    outcome: string;
    checks: { check: string; outcome: string; detail: string }[];
    failedChecks: unknown[];
    protection: { kind: string };
    notProtectedWarning: boolean;
    intendedReleaseId?: string;
  }

  test("the four-check gate reaches Writable on a real engine and records engine versions as provenance only", async ({
    page,
  }) => {
    await startHarness(page);
    await waitForControl(page);
    await expect.poll(() => missingFromCache(page), { timeout: 20_000 }).toBe(0);

    const result = (await page.evaluate(async () => {
      const bridge = window.__TRADE_JOURNAL_READINESS__;
      if (bridge === undefined) throw new Error("the harness did not expose readiness");
      return bridge.evaluate();
    })) as ReadinessResult;

    expect(result.outcome).toBe("Writable");
    expect(result.checks.map((check) => check.check)).toEqual([
      "diagnostic-transaction",
      "capacity",
      "service-worker-control",
      "offline-release-inventory",
    ]);
    expect(result.checks.every((check) => check.outcome === "Passed")).toBe(true);
    expect(result.failedChecks).toEqual([]);
    expect(["Protected", "BestEffort", "Unavailable"]).toContain(result.protection.kind);
    expect(Object.keys(result)).not.toContain("browserVersion");
    expect(Object.keys(result)).not.toContain("userAgent");

    mkdirSync("artifacts/browser", { recursive: true });
    writeFileSync(
      `artifacts/browser/readiness-${test.info().project.name}.json`,
      `${JSON.stringify(
        {
          kind: "readiness-provenance",
          decisionInput: false,
          project: test.info().project.name,
          browserVersion: page.context().browser()?.version() ?? "unknown",
          checks: result.checks,
          protection: result.protection,
          notProtectedWarning: result.notProtectedWarning,
        },
        null,
        2,
      )}\n`,
    );
  });
});

test.describe("inventory-offline", () => {
  async function validate(page: Page): Promise<{
    outcome: string;
    releaseId?: string;
    verifiedEntries?: number;
    failures?: { kind: string; assetUrl?: string }[];
  }> {
    return page.evaluate(async () => {
      const bridge = window.__TRADE_JOURNAL_INVENTORY__;
      if (bridge === undefined) throw new Error("the harness did not expose inventory validation");
      return bridge.validate() as Promise<{
        outcome: string;
        releaseId?: string;
        verifiedEntries?: number;
        failures?: { kind: string; assetUrl?: string }[];
      }>;
    });
  }

  test("on a stopped offline context the release inventory validates complete with no network request", async ({
    page,
    context,
  }) => {
    await startHarness(page);
    await waitForControl(page);
    await expect.poll(() => missingFromCache(page), { timeout: 20_000 }).toBe(0);
    const online = await validate(page);
    expect(online.outcome).toBe("Complete");

    await page.close();
    await context.setOffline(true);

    const offline = await context.newPage();
    await armHarness(offline);
    const requested: string[] = [];
    offline.on("request", (request) => {
      if (/^https?:\/\//.test(request.url())) requested.push(request.url());
    });
    await offline.goto("/");
    await expect(offline.getByRole("heading", { level: 1, name: "Trade Journal" })).toBeVisible();

    const result = await validate(offline);
    expect(result).toMatchObject({
      outcome: "Complete",
      releaseId: online.releaseId,
      verifiedEntries: expect.any(Number),
    });
    expect(result.verifiedEntries).toBeGreaterThan(0);
    const origin = new URL(offline.url()).origin;
    expect([...new Set(requested.map((url) => new URL(url).origin))]).toEqual([origin]);
  });

  test("a deleted cached asset is named and never reported as an empty cache", async ({ page, context }) => {
    await startHarness(page);
    await waitForControl(page);
    await expect.poll(() => missingFromCache(page), { timeout: 20_000 }).toBe(0);

    const deleted = await page.evaluate(async () => {
      const response = await fetch("/release-inventory.json", { cache: "no-store" });
      const inventory = (await response.json()) as { entries: { url: string }[] };
      const target = inventory.entries.find(
        (entry) => entry.url.startsWith("icons/") || entry.url.startsWith("/icons/"),
      );
      if (target === undefined) throw new Error("no icon entry to delete");
      for (const key of await caches.keys()) {
        const cache = await caches.open(key);
        await cache.delete(target.url);
      }
      return target.url;
    });

    await page.close();
    await context.setOffline(true);
    const offline = await context.newPage();
    await armHarness(offline);
    await offline.goto("/");
    await expect(offline.getByRole("heading", { level: 1, name: "Trade Journal" })).toBeVisible();

    const result = await validate(offline);
    expect(result.outcome).toBe("Incomplete");
    expect(result.failures).toEqual([{ kind: "Missing", assetUrl: deleted }]);
  });
});
