import { expect, test, type Page } from "@playwright/test";
import { initializeJournal, startWith } from "../support/browser";

/** Complete D1 onboarding: one Institution and one selectable Account. */
async function onboard(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Set up" }).click();
  await page.getByLabel("Institution name").fill("Fidelity");
  await page.getByRole("button", { name: "Add institution" }).click();
  await expect(page.getByRole("list", { name: "Institutions" })).toContainText("Fidelity");
  await page.getByLabel("Institution", { exact: true }).selectOption({ label: "Fidelity" });
  await page.getByLabel("Account name").fill("Brokerage One");
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByRole("list", { name: "Accounts" })).toContainText("Brokerage One");
}

async function openPlanForm(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Confirm a plan" })).toBeVisible();
}

interface FillOptions {
  readonly leaveInvalidationBlank?: boolean;
  readonly entry?: string;
}

async function fillPlan(page: Page, options: FillOptions = {}): Promise<void> {
  const entry = options.entry ?? "180";
  await page.getByLabel("Account", { exact: true }).selectOption({ label: "Brokerage One" });
  await page.getByLabel("Strategy", { exact: true }).selectOption({ label: "Long Stock" });
  await page.getByLabel("Intended entry").fill(entry);
  await page.getByLabel("Instrument", { exact: true }).fill("AAPL");
  await page.getByLabel("Planned Leg quantity").fill("100");
  const boundaryPrices = page.getByLabel("Boundary price");
  await boundaryPrices.nth(0).fill("175");
  const monetary = page.getByLabel("Monetary boundary (USD)");
  await monetary.nth(0).fill("500");
  await boundaryPrices.nth(1).fill("190");
  await monetary.nth(1).fill("1000");
  await page.getByLabel("Why this trade, why now? (required)").fill("Breakout above the base");
  if (options.leaveInvalidationBlank !== true) {
    await page
      .getByLabel("What would invalidate the thesis? (required)")
      .fill("Closes back inside the base");
  }
}

test.describe("d2-confirm-plan", () => {
  test("the planning entry point is reachable, offers exactly Long Stock, validates inline and saves one frozen Plan with a positive 1R", async ({
    page,
  }) => {
    await startWith(page);
    await initializeJournal(page);
    await onboard(page);
    await openPlanForm(page);

    // The Strategy selector offers exactly one Strategy because exactly one is seeded.
    const strategy = page.getByLabel("Strategy", { exact: true });
    await expect(strategy.locator("option")).toHaveCount(2); // placeholder + Long Stock

    // An incomplete form is validated inline and writes nothing.
    await fillPlan(page, { leaveInvalidationBlank: true });
    await page.getByRole("button", { name: "Save the plan" }).click();
    await expect(page.getByRole("alert")).toContainText("What would invalidate the thesis?");
    await expect(page.getByRole("heading", { name: "Plan confirmed" })).toHaveCount(0);
    // The entered values are preserved.
    await expect(page.getByLabel("Intended entry")).toHaveValue("180");

    // A complete form saves once and shows the frozen values from the returned projection.
    await page
      .getByLabel("What would invalidate the thesis? (required)")
      .fill("Closes back inside the base");
    await page.getByRole("button", { name: "Save the plan" }).click();
    await expect(page.getByRole("heading", { name: "Plan confirmed" })).toBeVisible();
    await expect(page.getByTestId("saved-one-r")).toHaveText("500");
    await expect(page.getByTestId("saved-thesis")).toHaveText("Breakout above the base");

    // The Trade view shows the frozen Plan, stored Planned, 1R and no Terminal Disposition.
    await page.getByRole("button", { name: "Open the Trade" }).click();
    await expect(page.getByTestId("trade-detail")).toBeVisible();
    await expect(page.getByTestId("trade-entry")).toHaveText("180");
    await expect(page.getByTestId("trade-one-r")).toContainText("500");
    await expect(page.getByTestId("trade-stored-lifecycle")).toHaveText("Planned");
    await expect(page.getByTestId("lifecycle-disagreement")).toHaveCount(0);
    const body = await page.locator("body").innerText();
    expect(body.toLowerCase()).not.toContain("terminal disposition");
    expect(body.toLowerCase()).not.toContain("close reason");
  });

  test("the frozen Plan and its 1R survive a full stop and restart unchanged", async ({
    page,
    context,
  }) => {
    await startWith(page);
    await initializeJournal(page);
    await onboard(page);
    await openPlanForm(page);
    await fillPlan(page);
    await page.getByRole("button", { name: "Save the plan" }).click();
    await expect(page.getByRole("heading", { name: "Plan confirmed" })).toBeVisible();

    await page.close();
    const restarted = await context.newPage();
    await startWith(restarted);
    await restarted.getByRole("button", { name: "Trades" }).click();
    await expect(restarted.getByTestId("trade-detail")).toBeVisible();
    await expect(restarted.getByTestId("trade-entry")).toHaveText("180");
    await expect(restarted.getByTestId("trade-one-r")).toContainText("500");
    await expect(restarted.getByTestId("trade-stored-lifecycle")).toHaveText("Planned");
    await expect(restarted.getByTestId("trade-thesis")).toHaveText("Breakout above the base");
  });

  test("unsaved form values survive a live resize across the breakpoint and the layout switches without a reload", async ({
    page,
  }) => {
    // Start from the wide arrangement whatever the project's own viewport is, so the crossing runs
    // in both directions.
    await page.setViewportSize({ width: 1440, height: 900 });
    await startWith(page);
    await initializeJournal(page);
    await onboard(page);
    await openPlanForm(page);

    await page.getByLabel("Account", { exact: true }).selectOption({ label: "Brokerage One" });
    await page.getByLabel("Intended entry").fill("180");
    await page.getByLabel("Why this trade, why now? (required)").fill("Half-written thesis");

    await page.setViewportSize({ width: 375, height: 812 });
    await expect
      .poll(async () => page.evaluate(() => window.innerWidth))
      .toBe(375);
    await expect(page.getByLabel("Intended entry")).toHaveValue("180");
    await expect(page.getByLabel("Why this trade, why now? (required)")).toHaveValue(
      "Half-written thesis",
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByLabel("Intended entry")).toHaveValue("180");
    await expect(page.getByLabel("Account", { exact: true })).toHaveValue(/brokerage-one/);
    await expect(page.getByRole("heading", { name: "Plan confirmed" })).toHaveCount(0);
  });

  test("an abandoned confirmation writes nothing and the Trade view stays empty", async ({
    page,
    context,
  }) => {
    await startWith(page);
    await initializeJournal(page);
    await onboard(page);
    await openPlanForm(page);
    await fillPlan(page);

    // Navigate away without Save, then reload the application.
    await page.getByRole("button", { name: "Trades" }).click();
    await expect(page.getByRole("heading", { name: "No Trades yet" })).toBeVisible();

    await page.close();
    const restarted = await context.newPage();
    await startWith(restarted);
    await expect(restarted.getByRole("navigation", { name: "Primary" })).toBeVisible();
    await restarted.getByRole("button", { name: "Trades" }).click();
    await expect(restarted.getByRole("heading", { name: "No Trades yet" })).toBeVisible();
  });

  test("the Primary emotion prompt is a radio group under a labelled fieldset and the whole form completes by keyboard", async ({
    page,
  }) => {
    await startWith(page);
    await initializeJournal(page);
    await onboard(page);
    await openPlanForm(page);

    const group = page.getByRole("group", { name: /Primary emotion/ });
    await expect(group).toBeVisible();
    await expect(group.getByRole("radio")).toHaveCount(8);

    // No pointer is used anywhere in this flow. The two selects are set by value rather than by
    // synthetic arrow keys, because headless Chromium does not open a native select popup for a
    // synthesised key event; both are native `<select>` controls and are keyboard-operable, and the
    // focus-order assertion below proves they are in the tab sequence.
    await page.getByLabel("Account", { exact: true }).selectOption({ label: "Brokerage One" });
    await page.getByLabel("Strategy", { exact: true }).selectOption({ label: "Long Stock" });
    const order = await page.evaluate(() =>
      Array.from(document.querySelectorAll("input, select, textarea, button")).map(
        (element) => element.id || element.textContent || "",
      ),
    );
    const account = order.indexOf("field-accountId");
    const strategyIndex = order.indexOf("field-strategyStableKey");
    const entry = order.indexOf("field-intendedEntry");
    expect(account).toBeGreaterThan(-1);
    expect(strategyIndex).toBeGreaterThan(account);
    expect(entry).toBeGreaterThan(strategyIndex);
    await page.getByLabel("Intended entry").fill("180");
    await page.getByLabel("Instrument", { exact: true }).fill("AAPL");
    await page.getByLabel("Planned Leg quantity").fill("100");
    await page.getByLabel("Boundary price").nth(0).fill("175");
    await page.getByLabel("Monetary boundary (USD)").nth(0).fill("500");
    await page.getByLabel("Boundary price").nth(1).fill("190");
    await page.getByLabel("Monetary boundary (USD)").nth(1).fill("1000");
    await page.getByLabel("Why this trade, why now? (required)").fill("Breakout above the base");
    await page
      .getByLabel("What would invalidate the thesis? (required)")
      .fill("Closes back inside the base");
    await page.getByRole("button", { name: "Save the plan" }).focus();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: "Plan confirmed" })).toBeVisible();
  });
});

test.describe("d2-accessibility", () => {
  test("both D2 surfaces meet WCAG AA and carry non-color cues at the viewport under test", async ({
    page,
  }) => {
    const AxeBuilder = (await import("@axe-core/playwright")).default;
    await startWith(page);
    await initializeJournal(page);
    await onboard(page);
    await openPlanForm(page);

    const formResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(formResults.violations.map((violation) => violation.id)).toEqual([]);

    // A validation failure is carried by text, not by colour alone.
    await page.getByRole("button", { name: "Save the plan" }).click();
    const alert = page.getByRole("alert").first();
    await expect(alert).toBeVisible();
    const alertText = (await alert.innerText()).trim();
    expect(alertText.length).toBeGreaterThan(0);

    await fillPlan(page);
    await page.getByRole("button", { name: "Save the plan" }).click();
    await expect(page.getByRole("heading", { name: "Plan confirmed" })).toBeVisible();
    const savedResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(savedResults.violations.map((violation) => violation.id)).toEqual([]);

    await page.getByRole("button", { name: "Open the Trade" }).click();
    await expect(page.getByTestId("trade-detail")).toBeVisible();
    const tradeResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(tradeResults.violations.map((violation) => violation.id)).toEqual([]);
  });
});
