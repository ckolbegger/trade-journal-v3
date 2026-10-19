import { expect, test } from "@playwright/test";
import { initializeJournal, startWith } from "./startup-support";

test("a fresh Workspace offers an explanatory empty state and no fictional brokerage record", async ({
  page,
}) => {
  await startWith(page);
  await initializeJournal(page);
  await page.getByRole("button", { name: "Set up" }).click();

  await expect(
    page.getByText("No institutions yet. Add the brokerage you trade with to begin."),
  ).toBeVisible();
  await expect(page.getByLabel("Institution name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add institution" })).toBeVisible();
  expect(
    await page.getByRole("list", { name: "Institutions" }).count(),
  ).toBe(0);
});
