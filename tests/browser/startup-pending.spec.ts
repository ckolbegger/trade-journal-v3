import { expect, test } from "@playwright/test";
import { startWith } from "./startup-support";

test("while readiness is still being verified the startup state does not claim an empty workspace or enable a mutation", async ({
  page,
}) => {
  await startWith(page, { delayMs: 2500 });

  await expect(page.getByRole("heading", { name: "Verifying this browser" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Checking authoritative storage");

  expect(await page.getByRole("button").count()).toBe(0);
  expect(await page.getByRole("navigation").count()).toBe(0);
  expect(await page.getByText("No institutions yet").count()).toBe(0);
  expect(await page.getByText("Ready to write").count()).toBe(0);
});
