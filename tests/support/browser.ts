import { expect, type Page } from "@playwright/test";
import type { StartupOverride } from "../../src/workspace/runtime";

export async function startWith(page: Page, override: StartupOverride = {}): Promise<void> {
  await page.addInitScript((value: StartupOverride) => {
    (globalThis as unknown as { __TRADE_JOURNAL_HARNESS__?: boolean }).__TRADE_JOURNAL_HARNESS__ =
      true;
    (
      globalThis as unknown as { __TRADE_JOURNAL_STARTUP_OVERRIDE__?: StartupOverride }
    ).__TRADE_JOURNAL_STARTUP_OVERRIDE__ = value;
  }, override);
  await page.goto("/");
}

export async function initializeJournal(
  page: Page,
  timeZone = "America/New_York",
): Promise<void> {
  await page.getByLabel("Time zone").selectOption(timeZone);
  await page.getByRole("button", { name: "Create this journal" }).click();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
}

export async function armHarness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (globalThis as unknown as { __TRADE_JOURNAL_HARNESS__?: boolean }).__TRADE_JOURNAL_HARNESS__ =
      true;
  });
}

export async function startHarness(page: Page): Promise<void> {
  await armHarness(page);
  await page.goto("/");
}

export async function waitForControl(page: Page, timeout = 20_000): Promise<string> {
  let releaseId = "";
  await expect
    .poll(
      async () => {
        const control = await page.evaluate(async (): Promise<{ kind: string; releaseId?: string }> => {
          const host = window.__TRADE_JOURNAL_HOST__;
          if (host === undefined) return { kind: "NotExposed" };
          return host.workerControl();
        });
        if (control.kind === "Controlled" && typeof control.releaseId === "string") {
          releaseId = control.releaseId;
        }
        return control.kind;
      },
      { timeout },
    )
    .toBe("Controlled");
  return releaseId;
}

export async function missingReleaseEntries(
  page: Page,
  entries: { url: string }[],
): Promise<number> {
  return page.evaluate(async (urls: string[]) => {
    let missing = 0;
    for (const url of urls) {
      const match = await caches.match(url, { ignoreSearch: true });
      if (match === undefined) missing += 1;
    }
    return missing;
  }, entries.map((entry) => entry.url));
}

export async function missingFromCache(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const response = await fetch("/release-inventory.json", { cache: "no-store" });
    const inventory = (await response.json()) as { entries: { url: string }[] };
    let missing = 0;
    for (const entry of inventory.entries) {
      const match = await caches.match(entry.url, { ignoreSearch: true });
      if (match === undefined) missing += 1;
    }
    return missing;
  });
}

export async function workerStatus(page: Page): Promise<{
  controllerReleaseId?: string;
  waitingReleaseId?: string;
  installing: boolean;
}> {
  return page.evaluate(async () => {
    const host = window.__TRADE_JOURNAL_HOST__;
    if (host === undefined) throw new Error("the harness did not expose the host port");
    const status = await host.workerStatus();
    if (status.kind !== "Reported") return { installing: false };
    return {
      controllerReleaseId: status.controllerReleaseId,
      waitingReleaseId: status.waitingReleaseId,
      installing: status.installing,
    };
  });
}
