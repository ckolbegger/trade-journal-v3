import { expect, test } from "@playwright/test";
import { initializeJournal, startWith } from "./startup-support";

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
