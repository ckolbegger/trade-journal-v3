import { expect, firstPage, probe, READY, startJournal, test, workspaceOf } from './support.ts';

// Strengthening from critic-2's observations (not a planned B1 case).
test.describe('onboarding after a partly failed attempt (critic-2)', () => {
  test('should show the protection warning on first run and onboarding, and reuse an Institution saved without its Account after a reload', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await firstPage(context);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Start your journal' })).toBeVisible(READY);
    await expect(page.getByText('This browser may clear your journal data')).toBeVisible();
    await startJournal(page);

    await expect(page.getByRole('heading', { name: 'Add your brokerage account' })).toBeVisible();
    await expect(page.getByText('This browser may clear your journal data')).toBeVisible();
    await page.getByLabel('Institution').fill('Schwab');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByText('Enter a name for the Account.')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Institution')).toHaveValue('Schwab', READY);
    await page.getByLabel('Account').fill('Individual');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByText('No planned trades yet')).toBeVisible();
    const catalog = workspaceOf(await probe(page))!.stores['catalog'] as { kind: string; label: string }[];
    expect(catalog.filter((r) => r.kind === 'Institution').map((r) => r.label)).toEqual(['Schwab']);
    await context.close();
  });
});
