import { expect, test } from "@playwright/test";
import { initializeJournal, startWith } from "./startup-support";

test("a real engine persists the created reference and re-validates every readiness check after a full restart", async ({
  page,
  context,
}) => {
  await startWith(page);
  await initializeJournal(page);
  await page.getByRole("button", { name: "Set up" }).click();
  await page.getByLabel("Institution name").fill("Fidelity");
  await page.keyboard.press("Enter");
  await page.getByLabel("Institution", { exact: true }).selectOption({ label: "Fidelity" });
  await page.getByLabel("Account name").fill("Brokerage One");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Onboarding:" }),
  ).toContainText("Ready for Trade Planning");

  await page.close();
  const restarted = await context.newPage();
  await startWith(restarted);
  await expect(restarted.getByRole("navigation", { name: "Primary" })).toBeVisible();
  const checks = restarted.getByRole("list", { name: "Readiness checks" });
  await expect(checks.locator("li")).toHaveCount(4);
  for (const check of ["Authoritative storage", "Storage capacity", "Application release worker", "Offline release inventory"]) {
    await expect(checks).toContainText(`${check}: Passed`);
  }
  await restarted.getByRole("button", { name: "Set up" }).click();
  await expect(restarted.getByRole("list", { name: "Institutions" })).toContainText("Fidelity");
  await expect(restarted.getByRole("list", { name: "Accounts" })).toContainText("Brokerage One");
});
