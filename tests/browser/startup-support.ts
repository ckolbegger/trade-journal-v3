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
