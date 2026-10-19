import { expect, test } from "@playwright/test";
import { startWith } from "./startup-support";

test("Unsupported names each failed check, offers safe retry and another-browser guidance, and offers no initialization control", async ({
  page,
}) => {
  await startWith(page, { capacityFreeBytes: 1 });

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "This browser cannot safely save journal data" }),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "Failed readiness checks" })).toContainText(
    "Storage capacity",
  );
  await expect(page.getByRole("button", { name: "Retry checks" })).toBeVisible();
  await expect(page.getByText("Try another browser")).toBeVisible();
  expect(await page.getByRole("button", { name: "Create this journal" }).count()).toBe(0);
});
