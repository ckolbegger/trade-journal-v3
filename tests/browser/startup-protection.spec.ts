import { expect, test } from "@playwright/test";
import { initializeJournal, startWith } from "./startup-support";

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
