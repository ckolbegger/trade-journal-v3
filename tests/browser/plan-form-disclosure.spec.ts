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
}

/**
 * The complete Long Stock plan after E-012 and E-013: exactly one Stop and one Target, each with a
 * boundary price only. No monetary boundary is typed; Trade Analysis derives it.
 */
async function fillPlan(page: Page, options: FillOptions = {}): Promise<void> {
  await page.getByLabel("Account", { exact: true }).selectOption({ label: "Brokerage One" });
  await page.getByLabel("Strategy", { exact: true }).selectOption({ label: "Long Stock" });
  await page.getByLabel("Intended entry").fill("180");
  await page.getByLabel("Instrument", { exact: true }).fill("AAPL");
  await page.getByLabel("Planned Leg quantity").fill("100");
  await page.getByLabel("Boundary price").nth(0).fill("175");
  await page.getByLabel("Boundary price").nth(1).fill("190");
  await page.getByLabel("Why this trade, why now? (required)").fill("Breakout above the base");
  if (options.leaveInvalidationBlank !== true) {
    await page
      .getByLabel("What would invalidate the thesis? (required)")
      .fill("Closes back inside the base");
  }
}

test.describe("d2-plan-form-disclosure", () => {
  test("should show the provisional reward-to-risk ratio and the maximum loss before Save, from previewPlan, when a complete plan has been entered", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startWith(page);
    await initializeJournal(page);
    await onboard(page);
    await openPlanForm(page);

    await fillPlan(page);

    // Nothing has been saved: the figures come from the same assess-and-derive step confirmation runs.
    await expect(page.getByTestId("preview-rr")).toHaveText("2");
    await expect(page.getByTestId("preview-max-loss")).toHaveText("500 USD");
    const provisional = page.getByRole("region", { name: "Before you save (provisional)" });
    await expect(provisional).toContainText("Reward-to-risk (provisional)");
    await expect(provisional).toContainText("Maximum loss (provisional)");

    // The disclosure holds at both viewports without a reload.
    await page.setViewportSize({ width: 375, height: 812 });
    await expect.poll(async () => page.evaluate(() => window.innerWidth)).toBe(375);
    await expect(page.getByTestId("preview-rr")).toHaveText("2");
    await expect(page.getByTestId("preview-max-loss")).toHaveText("500 USD");
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId("preview-rr")).toHaveText("2");
  });

  test("should not offer any control that adds a third condition, when the Long Stock form is rendered", async ({
    page,
  }) => {
    await startWith(page);
    await initializeJournal(page);
    await onboard(page);
    await openPlanForm(page);

    await expect(page.getByRole("button", { name: "Add another condition" })).toHaveCount(0);
    await expect(page.getByLabel("Boundary price")).toHaveCount(2);
    await expect(page.getByText(/Condition 1: Stop/)).toBeVisible();
    await expect(page.getByText(/Condition 2: Target/)).toBeVisible();
  });

  test("should not ask for a monetary boundary and should display the amount the preview derives, when a condition carries a boundary price", async ({
    page,
  }) => {
    await startWith(page);
    await initializeJournal(page);
    await onboard(page);
    await openPlanForm(page);

    await fillPlan(page);

    // No monetary-boundary input exists at all, so a typed boundary cannot contradict the risk.
    await expect(page.getByLabel("Monetary boundary (USD)")).toHaveCount(0);
    await expect(page.locator('input[id*="monetaryBoundary"]')).toHaveCount(0);
    // The derived amount is displayed read-only for each condition.
    await expect(page.getByTestId("derived-boundary-cond-1")).toHaveText(/500 USD/);
    await expect(page.getByTestId("derived-boundary-cond-2")).toHaveText(/1000 USD/);
  });

  test('should show the preview\'s typed issues in place of a duplicated client-side rule set, when the draft is incomplete', async ({
    page,
  }) => {
    await startWith(page);
    await initializeJournal(page);
    await onboard(page);
    await openPlanForm(page);

    await fillPlan(page, { leaveInvalidationBlank: true });
    await page.getByRole("button", { name: "Save the plan" }).click();

    // The message is the preview's typed issue, not the form's own copy of the rule.
    await expect(page.getByRole("alert")).toHaveCount(1);
    await expect(page.getByRole("alert").first()).toContainText(
      '"What would invalidate the thesis?" is required and was not answered',
    );
    await expect(
      page.getByText('Answer "What would invalidate the thesis?" before saving.'),
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Plan confirmed" })).toHaveCount(0);
  });

  test("should show the frozen figures from the confirmation result and label them as frozen after Save, when the Plan is saved", async ({
    page,
  }) => {
    await startWith(page);
    await initializeJournal(page);
    await onboard(page);
    await openPlanForm(page);

    await fillPlan(page);
    const provisionalRr = await page.getByTestId("preview-rr").innerText();
    const provisionalMaxLoss = await page.getByTestId("preview-max-loss").innerText();
    expect(provisionalRr).toBe("2");
    expect(provisionalMaxLoss).toBe("500 USD");

    await page.getByRole("button", { name: "Save the plan" }).click();
    await expect(page.getByRole("heading", { name: "Plan confirmed" })).toBeVisible();

    // The frozen figures are the provisional ones, and the screen says so.
    await expect(page.getByTestId("saved-rr")).toHaveText(provisionalRr);
    await expect(page.getByTestId("saved-max-loss")).toHaveText(provisionalMaxLoss);
    await expect(page.getByText("Reward-to-risk (frozen)")).toBeVisible();
    await expect(page.getByText("Maximum loss (frozen)")).toBeVisible();
    await expect(page.getByText(/provisional ones you saw before Save/)).toBeVisible();
    await expect(page.getByTestId("preview-rr")).toHaveCount(0);
  });

  test("should confirm a second Plan in the same Workspace when the trader starts another plan, so the saved screen's own control is not a dead end", async ({
    page,
  }) => {
    await startWith(page);
    await initializeJournal(page);
    await onboard(page);
    await openPlanForm(page);

    // First Plan: frozen, saved, confirmed.
    await fillPlan(page);
    await page.getByRole("button", { name: "Save the plan" }).click();
    await expect(page.getByRole("heading", { name: "Plan confirmed" })).toBeVisible();

    // The screen the trader is left on offers "Start another plan"; it must lead somewhere.
    await page.getByRole("button", { name: "Start another plan" }).click();
    await expect(page.getByRole("heading", { name: "Confirm a plan" })).toBeVisible();

    await fillPlan(page);
    await page.getByRole("button", { name: "Save the plan" }).click();
    await expect(page.getByRole("heading", { name: "Plan confirmed" })).toBeVisible();
    await expect(page.getByTestId("saved-entry")).toHaveText("180");

    // Both confirmations are Trades in the one Workspace.
    await page.getByRole("button", { name: "Trades", exact: true }).click();
    await expect(
      page.getByRole("list", { name: "Confirmed Trades" }).getByRole("button"),
    ).toHaveCount(2);
  });

  test("should keep every value readable in the provisional, saved and Trade facts lists at the narrow viewport, so a value is never crushed into a one-character column", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await startWith(page);
    await initializeJournal(page);
    await onboard(page);
    await openPlanForm(page);
    await fillPlan(page);

    // Every definition list on every D2 surface gives its value at least half the list's width.
    const measureFacts = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll("dl.facts")).map((list) => {
          const values = Array.from(list.querySelectorAll("dd"));
          return {
            listWidth: Math.round(list.getBoundingClientRect().width),
            narrowestValue: Math.round(
              Math.min(...values.map((value) => value.getBoundingClientRect().width)),
            ),
          };
        }),
      );

    const provisional = await measureFacts();
    expect(provisional.length).toBeGreaterThan(0);
    for (const list of provisional) {
      expect(list.narrowestValue).toBeGreaterThanOrEqual(list.listWidth / 2);
    }

    await page.getByRole("button", { name: "Save the plan" }).click();
    await expect(page.getByRole("heading", { name: "Plan confirmed" })).toBeVisible();
    const confirmed = await measureFacts();
    expect(confirmed.length).toBeGreaterThan(0);
    for (const list of confirmed) {
      expect(list.narrowestValue).toBeGreaterThanOrEqual(list.listWidth / 2);
    }

    await page.getByRole("button", { name: "Open the Trade" }).click();
    await expect(page.getByTestId("trade-detail")).toBeVisible();
    const trade = await measureFacts();
    expect(trade.length).toBeGreaterThan(0);
    for (const list of trade) {
      expect(list.narrowestValue).toBeGreaterThanOrEqual(list.listWidth / 2);
    }
  });

  test("should not call previewPlan while a required identity field is still blank, so an empty form is not reported as invalid", async ({
    page,
  }) => {
    await startWith(page);
    await initializeJournal(page);
    await onboard(page);
    await openPlanForm(page);

    // Every Plan fact and both required answers are present, but no identity has been chosen.
    await page.getByLabel("Intended entry").fill("180");
    await page.getByLabel("Planned Leg quantity").fill("100");
    await page.getByLabel("Boundary price").nth(0).fill("175");
    await page.getByLabel("Boundary price").nth(1).fill("190");
    await page.getByLabel("Why this trade, why now? (required)").fill("Breakout above the base");
    await page
      .getByLabel("What would invalidate the thesis? (required)")
      .fill("Closes back inside the base");

    // No preview was attempted: the provisional block does not exist yet, and nothing about the
    // Plan is judged while an identity is missing.
    await expect(
      page.getByRole("region", { name: "Before you save (provisional)" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("preview-rr")).toHaveCount(0);

    await page.getByRole("button", { name: "Save the plan" }).click();
    const alerts = await page.getByRole("alert").allInnerTexts();
    expect(alerts.join(" ")).toContain("Choose the Account you trade.");
    expect(alerts.join(" ")).toContain("Choose the Strategy.");
    expect(alerts.join(" ")).toContain("Enter the Instrument.");
    // Nothing was assessed, so nothing is reported about the Plan itself.
    expect(alerts.join(" ")).not.toContain("a completed Plan needs an intended entry");
    await expect(page.getByTestId("preview-rr")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Plan confirmed" })).toHaveCount(0);

    // Presenting the identities opens the gate: the same Plan now previews.
    await page.getByLabel("Account", { exact: true }).selectOption({ label: "Brokerage One" });
    await page.getByLabel("Strategy", { exact: true }).selectOption({ label: "Long Stock" });
    await page.getByLabel("Instrument", { exact: true }).fill("AAPL");
    await expect(
      page.getByRole("region", { name: "Before you save (provisional)" }),
    ).toBeVisible();
    await expect(page.getByTestId("preview-rr")).toHaveText("2");
    await expect(page.getByTestId("preview-max-loss")).toHaveText("500 USD");
  });
});
