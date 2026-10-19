import { expect, test } from "@playwright/test";

const injected = "2026-10-19T13:30:00.000Z";

test("the shell displays the instant injected by the harness, not wall-clock time", async ({ page }) => {
  await page.addInitScript((instant: string) => {
    (globalThis as unknown as { __TRADE_JOURNAL_CLOCK__?: string }).__TRADE_JOURNAL_CLOCK__ =
      instant;
  }, injected);

  await page.goto("/");

  await expect(page.locator("time").filter({ hasText: injected })).toBeVisible();
  await expect(page.getByText(`Opening instant: ${injected}`)).toBeVisible();
});
