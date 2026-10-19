import { expect, test } from "@playwright/test";
import { missingFromCache, startHarness, waitForControl } from "./worker-support";

test("with the context stopped and the network disabled the URL reopens from cache", async ({
  page,
  context,
}) => {
  await startHarness(page);
  await waitForControl(page);
  await expect.poll(() => missingFromCache(page), { timeout: 20_000 }).toBe(0);

  await page.close();
  await context.setOffline(true);

  const offline = await context.newPage();
  const requested: string[] = [];
  offline.on("request", (request) => {
    if (/^https?:\/\//.test(request.url())) requested.push(request.url());
  });
  const response = await offline.goto("/");
  expect(response?.status()).toBe(200);
  await expect(offline.getByRole("heading", { level: 1, name: "Trade Journal" })).toBeVisible();

  expect(await missingFromCache(offline)).toBe(0);
  const origin = new URL(offline.url()).origin;
  expect([...new Set(requested.map((url) => new URL(url).origin))]).toEqual([origin]);
});
