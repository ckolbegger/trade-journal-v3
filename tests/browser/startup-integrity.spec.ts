import { expect, test } from "@playwright/test";
import { startWith } from "./startup-support";

test("Integrity Blocked is presented together with Unsupported and the warning that data may exist, with no empty-workspace control", async ({
  page,
}) => {
  await startWith(page, { rootUnreadable: true, capacityFreeBytes: 1 });

  await expect(page.getByRole("heading", { name: "Storage integrity is blocked" })).toBeVisible();
  await expect(page.getByText("Runtime Readiness: Unsupported")).toBeVisible();
  await expect(page.getByText("Existing data may already be in this storage")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry checks" })).toBeVisible();
  expect(await page.getByRole("button", { name: "Create this journal" }).count()).toBe(0);
});
