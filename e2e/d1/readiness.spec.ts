import { confirmPlan, EXPLANATION, expect, FAULT_SETS, firstPage, onboardedPage, probe, profileAt, READY, test } from './support.ts';

test.describe('B1.5 Unsupported matrix (faults build)', () => {
  for (const failing of FAULT_SETS) {
    test(`should show Unsupported naming exactly ${failing.join(' and ')}, with Retry and the another-browser recommendation, creating no Workspace`, async ({ server }, info) => {
      void server;
      const context = await profileAt(info.outputPath('profile')).launch();
      const page = await firstPage(context);
      await page.goto(`/?faults=${failing.join(',')}`);
      await expect(page.getByRole('heading', { name: "This browser can't safely store your journal" })).toBeVisible(READY);
      await expect(page.getByRole('listitem')).toHaveText(failing.map((check) => EXPLANATION[check]));
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
      await expect(page.getByText('try another browser')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Start my journal' })).toHaveCount(0);

      const probed = await probe(page);
      expect(Object.keys(probed).filter((name) => name.startsWith('tj-ws-'))).toEqual([]);
      expect(probed['tj-root']?.stores['diagnostics'] ?? []).toEqual([]);
      await context.close();
    });
  }
});

test.describe('B1.7 protection is advisory', () => {
  test('should stay Writable with the warning and durability action while unprotected, and report the request honestly', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    const persisted = await page.evaluate(() => navigator.storage.persisted());
    const warning = page.getByText('This browser may clear your journal data');
    if (persisted) {
      await expect(warning).toHaveCount(0);
    } else {
      await expect(warning).toBeVisible();
      const ask = page.getByRole('button', { name: 'Ask the browser to keep data' });
      const canPersist = await page.evaluate(() => typeof navigator.storage.persist === 'function');
      await expect(ask).toHaveCount(canPersist ? 1 : 0);
      await confirmPlan(page);
      if (canPersist) {
        await ask.click();
        const after = await page.evaluate(() => navigator.storage.persisted());
        await expect(
          page.getByText(after ? 'The browser will now keep your journal data unless you clear it.' : 'The browser declined to promise it will keep your data.'),
        ).toBeVisible(READY);
      }
    }
    await context.close();
  });
});
