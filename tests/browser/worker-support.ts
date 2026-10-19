import { expect, type Page } from "@playwright/test";

export async function startHarness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (globalThis as unknown as { __TRADE_JOURNAL_HARNESS__?: boolean }).__TRADE_JOURNAL_HARNESS__ =
      true;
  });
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
