import { expect, test } from "@playwright/test";
import { initializeJournal, startWith } from "./startup-support";

test("entered-but-unsaved values survive a live narrow-to-wide resize and nothing is recorded", async ({
  page,
}) => {
  await startWith(page);
  await initializeJournal(page);
  await page.getByRole("button", { name: "Set up" }).click();

  await page.getByLabel("Institution name").fill("Fidelity");
  await page.getByLabel("Institution name").press("Enter");
  await expect(page.getByRole("list", { name: "Institutions" })).toContainText("Fidelity");

  const input = page.getByLabel("Institution name");
  await input.fill("Fidelity");
  await expect(input).toHaveValue("Fidelity");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(input).toHaveValue("Fidelity");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(input).toHaveValue("Fidelity");

  await expect(page.getByRole("list", { name: "Institutions" })).toContainText("Fidelity");
});
