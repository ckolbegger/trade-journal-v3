import { test, expect } from './fixtures';
import { onboard, confirmPlan } from './helpers';
test('D1-B01 D1-T09 stopped-browser offline reopening retains the Plan and history', async ({ page, context, playwright, browserName, profilePath, baseURL }) => {
  await onboard(page); await confirmPlan(page);
  await page.getByText('View history', { exact: true }).click();
  const fact = await page.getByText(/^Plan fact:/).textContent();
  await context.close();
  const reopened = await playwright[browserName].launchPersistentContext(profilePath, { headless: true, baseURL, offline: true, viewport: { width: 390, height: 844 } });
  try {
    const offline = await reopened.newPage();
    await offline.goto('/');
    await expect(offline.getByRole('button', { name: /XYZ · Planned/ })).toBeVisible();
    await offline.getByRole('button', { name: /XYZ · Planned/ }).click();
    await offline.getByText('View history', { exact: true }).click();
    await expect(offline.getByText(fact ?? 'Missing fact')).toBeVisible();
    await expect(offline.getByText('Improving earnings', { exact: true })).toBeVisible();
    expect(await offline.evaluate(() => isSecureContext)).toBe(true);
  } finally { await reopened.close(); }
});
