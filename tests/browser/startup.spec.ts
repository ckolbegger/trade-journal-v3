import { expect, test } from "@playwright/test";
import { startWith, initializeJournal } from "./startup-support";

test.describe("startup-pending", () => {
  test("while readiness is still being verified the startup state does not claim an empty workspace or enable a mutation", async ({
    page,
  }) => {
    await startWith(page, { delayMs: 2500 });

    await expect(page.getByRole("heading", { name: "Verifying this browser" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Checking authoritative storage");

    expect(await page.getByRole("button").count()).toBe(0);
    expect(await page.getByRole("navigation").count()).toBe(0);
    expect(await page.getByText("No institutions yet").count()).toBe(0);
    expect(await page.getByText("Ready to write").count()).toBe(0);
  });
});

test.describe("startup-writable", () => {
  test("a Writable session enables data entry and the complete normal navigation", async ({ page }) => {
    await startWith(page);
    await initializeJournal(page);

    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible();
    const destinations = await nav
      .locator("[data-destination]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-destination")).sort());
    expect(destinations).toEqual(["onboarding", "startup"]);

    await page.getByRole("button", { name: "Set up" }).click();
    await expect(page.getByRole("heading", { name: "Set up your brokerage" })).toBeVisible();
    await expect(page.getByText("No institutions yet")).toBeVisible();
    await page.getByRole("button", { name: "Add institution" }).click();
    await expect(page.getByRole("alert")).toContainText("Enter the brokerage name.");
    await page.getByLabel("Institution name").fill("Fidelity");
    await expect(page.getByRole("button", { name: "Add institution" })).toBeEnabled();
  });
});

test.describe("startup-protection", () => {
  test("the not-protected warning stays visible with exactly one durability action while every control stays enabled", async ({
    page,
  }) => {
    await startWith(page, { protection: { kind: "BestEffort", reason: "not granted" } });
    await initializeJournal(page);

    const warning = page
      .getByRole("status")
      .filter({ hasText: "This browser may clear your journal data" });
    await expect(warning).toBeVisible();
    await expect(warning.getByRole("button")).toHaveCount(1);
    await expect(
      warning.getByRole("button", { name: "Keep this data on this device" }),
    ).toBeEnabled();
    await expect(page.getByText("Recommend exporting a backup")).toBeVisible();
    expect(await page.locator("button:disabled").count()).toBe(0);
  });
});

test.describe("startup-unsupported", () => {
  test("Unsupported names each failed check, offers safe retry and another-browser guidance, and offers no initialization control", async ({
    page,
  }) => {
    await startWith(page, { capacityFreeBytes: 1 });

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "This browser cannot safely save journal data" }),
    ).toBeVisible();
    await expect(page.getByRole("list", { name: "Failed readiness checks" })).toContainText(
      "Storage capacity",
    );
    await expect(page.getByRole("button", { name: "Retry checks" })).toBeVisible();
    await expect(page.getByText("Try another browser")).toBeVisible();
    expect(await page.getByRole("button", { name: "Create this journal" }).count()).toBe(0);
  });
});

test.describe("startup-recovery", () => {
  test("Recovery Only keeps readable history available and disables writes with one stated reason", async ({
    page,
  }) => {
    await startWith(page);
    await initializeJournal(page);
    await page.getByRole("button", { name: "Set up" }).click();
    await page.getByLabel("Institution name").fill("Fidelity");
    await page.getByRole("button", { name: "Add institution" }).click();
    await expect(page.getByRole("list", { name: "Institutions" })).toContainText("Fidelity");

    const recovery = await page.context().newPage();
    await startWith(recovery, { capacityFreeBytes: 1 });

    await expect(recovery.getByRole("heading", { name: "Read-only recovery" })).toBeVisible();
    await expect(recovery.getByText("Writes and Restore are disabled:")).toBeVisible();
    await expect(recovery.getByText("separate storage")).toBeVisible();
    await expect(recovery.getByRole("list", { name: "Institutions" })).toContainText("Fidelity");
    expect(await recovery.getByRole("button", { name: "Add institution" }).count()).toBe(0);
  });
});

test.describe("startup-integrity", () => {
  test("Integrity Blocked is presented together with Unsupported and the warning that data may exist, with no empty-workspace control", async ({
    page,
  }) => {
    await startWith(page, { rootUnreadable: true, capacityFreeBytes: 1 });

    await expect(page.getByRole("heading", { name: "Storage integrity is blocked" })).toBeVisible();
    await expect(page.getByText("Runtime Readiness: Unsupported")).toBeVisible();
    await expect(page.getByText("Existing data may already be in this storage")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry checks" })).toBeVisible();
    expect(await page.getByRole("button", { name: "Create this journal" }).count()).toBe(0);
  });
});

test.describe("startup-view-states", () => {
  test("a data-bearing view distinguishes Loading, Empty and Ready", async ({ page }) => {
    await startWith(page, { queryDelayMs: 1500 });
    await initializeJournal(page);
    await page.getByRole("button", { name: "Set up" }).click();

    await expect(page.getByText("Loading institutions…")).toBeVisible();
    await expect(page.getByText("No institutions yet")).toBeVisible();

    await page.getByLabel("Institution name").fill("Fidelity");
    await page.getByRole("button", { name: "Add institution" }).click();
    await expect(page.getByRole("list", { name: "Institutions" })).toContainText("Fidelity");
  });

  test("a data-bearing view names a load failure and offers a retry", async ({ page }) => {
    await startWith(page, { queryFailure: true });
    await initializeJournal(page);
    await page.getByRole("button", { name: "Set up" }).click();

    await expect(page.getByRole("alert")).toContainText("The institutions could not be loaded");
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});
