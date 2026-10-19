import { expect, test } from "@playwright/test";
import { initializeJournal, startWith } from "./startup-support";

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
