import { expect, test } from "@playwright/test";
import { initializeJournal, startWith } from "./startup-support";

test("a full stop with the network disabled reopens to Writable with stored data intact", async ({
  page,
  context,
}) => {
  await startWith(page);
  await initializeJournal(page);
  await page.getByRole("button", { name: "Set up" }).click();
  await page.getByLabel("Institution name").fill("Fidelity");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "Institutions" })).toContainText("Fidelity");

  await page.close();
  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto("/");

  await expect(offline.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(offline.getByRole("status").filter({ hasText: "Ready to write" })).toBeVisible();
  await offline.getByRole("button", { name: "Set up" }).click();
  await expect(offline.getByRole("list", { name: "Institutions" })).toContainText("Fidelity");
  await expect(offline.getByRole("status").filter({ hasText: "Onboarding:" })).toBeVisible();
});
