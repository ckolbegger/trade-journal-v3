import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { initializeJournal, startWith } from "./startup-support";

async function audit(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

for (const width of [1440, 390]) {
  test(`every D1 view reports zero axe-core violations at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });

    await startWith(page, { delayMs: 1200 });
    await expect(page.getByRole("heading", { name: "Verifying this browser" })).toBeVisible();
    await audit(page);

    await page.goto("/");
    await initializeJournal(page);
    await audit(page);

    await page.getByRole("button", { name: "Set up" }).click();
    await audit(page);

    await expect(page.getByRole("heading", { name: "Brokerage institutions" })).toBeVisible();
    await audit(page);
  });
}

test("each failure view is accessible and carries its status in text, not colour", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startWith(page, { capacityFreeBytes: 1 });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Storage capacity");
  await audit(page);

  await startWith(page, { rootUnreadable: true, capacityFreeBytes: 1 });
  await expect(page.getByRole("heading", { name: "Storage integrity is blocked" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Runtime Readiness: Unsupported");
  await audit(page);
});
