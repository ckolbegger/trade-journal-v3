import { expect, onboardedPage, LAUNCH, test } from './support.ts';

// B8.15 (A143): a fresh profile whose browser has not promised to keep the data (persisted() is false in the Chromium the suite launches).
test.describe('B8.15 Not-protected warning', () => {
  test('should recommend a backup with a link to Backup and leave every control enabled', async ({ profile }) => {
    const context = await profile.launch();
    const page = await onboardedPage(context);
    expect(await page.evaluate(() => navigator.storage.persisted())).toBe(false);

    await page.goto('/about');
    await expect(page.getByRole('heading', { name: 'About', level: 1 })).toBeVisible(LAUNCH);
    const warning = page.getByRole('region', { name: 'Storage protection' });
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('Download a backup and verify it to keep a safe copy.');
    await expect(page.locator('button:disabled')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link')).not.toHaveCount(0);

    await warning.getByRole('link', { name: 'Download a backup' }).click();
    await expect(page.getByRole('heading', { name: 'Backup', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download backup' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Choose backup file' })).toBeEnabled();
    await expect(page.locator('button:disabled')).toHaveCount(0);
    await context.close();
  });
});
