import { expect, test } from "@playwright/test";
import { initializeJournal, startWith } from "./startup-support";

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
