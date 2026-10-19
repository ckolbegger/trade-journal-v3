import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the shell has no automatically detectable accessibility violation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Trade Journal" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});
