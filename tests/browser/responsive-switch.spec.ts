import { expect, test } from "@playwright/test";
import { initializeJournal, startWith } from "./startup-support";

test("the layout switches from the wide sidebar to the narrow bottom navigation without a reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startWith(page);
  await initializeJournal(page);

  await page.evaluate(() => {
    (window as unknown as { __noReload?: number }).__noReload = 1;
  });

  const nav = page.getByRole("navigation", { name: "Primary" });
  const wide = await nav.boundingBox();
  expect(wide?.x).toBeLessThan(2);
  expect(wide?.width).toBeGreaterThan(150);

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await nav.boundingBox();
  expect(narrow?.width).toBeGreaterThan(380);
  expect((narrow?.y ?? 0) + (narrow?.height ?? 0)).toBeGreaterThan(800);

  await page.setViewportSize({ width: 1440, height: 900 });
  const wideAgain = await nav.boundingBox();
  expect(wideAgain?.x).toBeLessThan(2);

  expect(
    await page.evaluate(() => (window as unknown as { __noReload?: number }).__noReload),
  ).toBe(1);
});
