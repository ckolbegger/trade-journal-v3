import { expect, test } from "@playwright/test";
import { initializeJournal, startWith } from "./startup-support";

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
