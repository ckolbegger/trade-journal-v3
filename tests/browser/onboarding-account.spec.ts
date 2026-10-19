import { expect, test } from "@playwright/test";
import { initializeJournal, startWith } from "./startup-support";

test("a keyboard-only walk completes both onboarding steps and the landing state survives a full restart", async ({
  page,
  context,
}) => {
  await startWith(page);
  await initializeJournal(page);
  await page.getByRole("button", { name: "Set up" }).click();

  // Keyboard only from here: focus the Institution name, type, submit with Enter.
  await page.getByLabel("Institution name").focus();
  await page.keyboard.type("Fidelity");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "Institutions" })).toContainText("Fidelity");
  await expect(page.getByLabel("Institution", { exact: true })).toContainText("Fidelity");

  // Keyboard only: choose the Institution, name the Account, submit with Enter.
  await page.getByLabel("Institution", { exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await page.getByLabel("Account name").focus();
  await page.keyboard.type("Brokerage One");
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("status").filter({ hasText: "Onboarding:" }),
  ).toContainText("Ready for Trade Planning");
  await expect(page.getByRole("list", { name: "Accounts" })).toContainText("Brokerage One");

  await page.close();
  const restarted = await context.newPage();
  await startWith(restarted);
  await expect(restarted.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await restarted.getByRole("button", { name: "Set up" }).click();
  await expect(
    restarted.getByRole("status").filter({ hasText: "Onboarding:" }),
  ).toContainText("Ready for Trade Planning");
  await expect(restarted.getByRole("list", { name: "Institutions" })).toContainText("Fidelity");
  await expect(restarted.getByRole("list", { name: "Accounts" })).toContainText("Brokerage One");
});
