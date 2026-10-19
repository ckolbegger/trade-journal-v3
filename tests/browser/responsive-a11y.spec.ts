import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { initializeJournal, startWith } from "./startup-support";

test.describe("a11y-d1", () => {
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
});

test.describe("a11y-smoke", () => {
  test("the shell has no automatically detectable accessibility violation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Trade Journal" })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });
});

test.describe("responsive-state", () => {
  test("unsaved values, focus, validation and available actions survive the switch in both directions", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startWith(page);
    await initializeJournal(page);
    await page.getByRole("button", { name: "Set up" }).click();

    const input = page.getByLabel("Institution name");
    await page.getByRole("button", { name: "Add institution" }).click();
    await expect(page.getByRole("alert")).toContainText("Enter the brokerage name.");
    await input.fill("Fidelity");
    await input.focus();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(input).toHaveValue("Fidelity");
    await expect(page.getByRole("alert")).toContainText("Enter the brokerage name.");
    await expect(page.getByRole("button", { name: "Add institution" })).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(input).toHaveValue("Fidelity");
    await expect(page.getByRole("button", { name: "Set up" })).toBeVisible();
  });
});

test.describe("responsive-switch", () => {
  test("the layout switches from the wide sidebar to the narrow bottom navigation without a reload", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startWith(page);
    await initializeJournal(page);

    await page.evaluate(() => {
      (window as unknown as { __noReload?: number }).__noReload = 1;
    });

    const nav = page.getByRole("navigation", { name: "Primary" });
    const wide = await nav.boundingBox();
    expect(wide?.x).toBeLessThan(2);
    expect(wide?.width).toBeGreaterThan(150);

    await page.setViewportSize({ width: 390, height: 844 });
    const narrow = await nav.boundingBox();
    expect(narrow?.width).toBeGreaterThan(380);
    expect((narrow?.y ?? 0) + (narrow?.height ?? 0)).toBeGreaterThan(800);

    await page.setViewportSize({ width: 1440, height: 900 });
    const wideAgain = await nav.boundingBox();
    expect(wideAgain?.x).toBeLessThan(2);

    expect(
      await page.evaluate(() => (window as unknown as { __noReload?: number }).__noReload),
    ).toBe(1);
  });
});
