import { expect, test } from "@playwright/test";

test("the shell loads from the loopback origin and depends on no other origin", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => {
    if (/^https?:\/\//.test(request.url())) requested.push(request.url());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Trade Journal" })).toBeVisible();

  const origin = new URL(page.url()).origin;
  const origins = new Set(requested.map((url) => new URL(url).origin));

  expect(requested.length).toBeGreaterThan(0);
  expect([...origins]).toEqual([origin]);
});
