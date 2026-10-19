import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { BASE_URL, expect, firstPage, onboard, onboardedPage, PLAN, profileAt, READY, startJournal, test } from './support.ts';

async function expectAccessible(page: Page, state: string): Promise<void> {
  // @axe-core/playwright types its page against its own playwright-core copy; the object is the same.
  const results = await new AxeBuilder({ page } as unknown as ConstructorParameters<typeof AxeBuilder>[0]).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    state,
  ).toEqual([]);
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' });

// Presses Tab until the target has focus, checking that every focused element shows a focus ring.
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let presses = 0; presses < 80; presses++) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      const style = element ? getComputedStyle(element) : undefined;
      const name = element?.getAttribute('name') ?? element?.getAttribute('type') ?? element?.textContent?.slice(0, 30);
      return { visible: !!style && style.outlineStyle !== 'none' && style.outlineWidth !== '0px', tag: `${element?.tagName} ${name}` };
    });
    expect(focus.visible, `focus ring on ${focus.tag}`).toBe(true);
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error('target never received focus');
}

test.describe('B1.15 responsive and accessible', () => {
  test('should switch layout at 960 px with the route and entered values intact', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await nav(page).getByRole('link', { name: 'New Plan' }).click();
    await page.getByLabel('Symbol').fill('XYZ');
    await page.getByLabel('Quantity').fill('100');
    await page.getByLabel('Intended entry').fill('50');
    await expect(nav(page)).toHaveAttribute('data-placement', 'sidebar');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'bottom');
    await page.setViewportSize({ width: 959, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'bottom');
    await page.setViewportSize({ width: 960, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'sidebar');
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(new URL(page.url()).pathname).toBe('/plans/new');
    await expect(page.getByLabel('Symbol')).toHaveValue('XYZ');
    await expect(page.getByLabel('Quantity')).toHaveValue('100');
    await expect(page.getByLabel('Intended entry')).toHaveValue('50');
    await context.close();
  });

  test('should report no WCAG 2.1 AA violations in any D1 view state', async ({ server, profile }, info) => {
    test.setTimeout(120_000);
    void server;
    const context = await profile.launch();
    const page = await firstPage(context);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Start your journal' })).toBeVisible(READY);
    await expectAccessible(page, 'first run');
    await startJournal(page);
    await expect(page.getByRole('heading', { name: 'Add your brokerage account' })).toBeVisible();
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.locator('.field-error').first()).toBeVisible();
    await expectAccessible(page, 'onboarding with errors');
    await onboard(page);
    await expectAccessible(page, 'Trades empty');

    await nav(page).getByRole('link', { name: 'New Plan' }).click();
    await expect(page.getByRole('heading', { name: 'New Plan' })).toBeVisible();
    await expectAccessible(page, 'Plan form');
    await page.getByRole('button', { name: 'Confirm Plan' }).click();
    await expect(page.getByRole('region', { name: 'This Plan can’t be confirmed yet' })).toBeVisible();
    await expectAccessible(page, 'Plan form with rejection');
    await page.getByLabel('Symbol').fill(PLAN.symbol);
    await page.getByLabel('Quantity').fill(PLAN.quantity);
    await page.getByLabel('Intended entry').fill(PLAN.entry);
    await page.getByLabel('Stop').fill(PLAN.stop);
    await page.getByLabel('Target').fill(PLAN.target);
    await page.getByLabel('Why this trade, why now?').fill(PLAN.thesis);
    await page.getByLabel('What would invalidate the thesis?').fill(PLAN.invalidation);
    await page.getByRole('button', { name: 'Confirm Plan' }).click();
    await expect(page.getByRole('heading', { name: PLAN.symbol, level: 1 })).toBeVisible();
    await expectAccessible(page, 'Trade Detail');
    await nav(page).getByRole('link', { name: 'Trades' }).click();
    await expect(page.getByRole('row', { name: /XYZ/ })).toBeVisible();
    await expectAccessible(page, 'Planned list');
    await nav(page).getByRole('link', { name: 'Accounts' }).click();
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
    await expectAccessible(page, 'Accounts');
    await nav(page).getByRole('link', { name: 'About' }).click();
    await expect(page.locator('.identity')).toBeVisible();
    await expectAccessible(page, 'About');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectAccessible(page, 'About, narrow');

    await page.goto('/?faults=inventory');
    await expect(page.getByRole('region', { name: "Read only: this browser can't save right now" })).toBeVisible(READY);
    await expectAccessible(page, 'Recovery Only');
    await context.close();

    const fresh = await profileAt(info.outputPath('unsupported')).launch();
    const unsupported = await firstPage(fresh);
    await unsupported.goto('/?faults=diagnostic,capacity');
    await expect(unsupported.getByRole('heading', { name: "This browser can't safely store your journal" })).toBeVisible(READY);
    await expectAccessible(unsupported, 'Unsupported');
    await fresh.close();

    const blockedContext = await profileAt(info.outputPath('blocked')).launch();
    const blocked = await firstPage(blockedContext);
    await blocked.route(`${BASE_URL}/__fixture`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>fixture</title>' }));
    await blocked.goto('/__fixture');
    await blocked.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const open = indexedDB.open('tj-root', 99);
          open.onsuccess = () => {
            open.result.close();
            resolve();
          };
        }),
    );
    await blocked.unroute(`${BASE_URL}/__fixture`);
    await blocked.goto('/');
    await expect(blocked.getByRole('heading', { name: "Your journal data may already exist here, but it can't be read" })).toBeVisible(READY);
    await expectAccessible(blocked, 'Integrity Blocked');
    await blockedContext.close();
  });

  test('should complete onboarding and a Plan with the keyboard only, with visible focus throughout', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await firstPage(context);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Start your journal' })).toBeVisible(READY);
    await tabTo(page, page.getByRole('button', { name: 'Start my journal' }));
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'Add your brokerage account' })).toBeVisible();
    await tabTo(page, page.getByLabel('Institution'));
    await page.keyboard.type('Fidelity');
    await tabTo(page, page.getByLabel('Account'));
    await page.keyboard.type('Roth IRA');
    await page.keyboard.press('Enter');
    await expect(page.getByText('No planned trades yet')).toBeVisible();

    await tabTo(page, nav(page).getByRole('link', { name: 'New Plan' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'New Plan' })).toBeVisible();
    for (const [label, value] of [
      ['Symbol', PLAN.symbol],
      ['Quantity', PLAN.quantity],
      ['Intended entry', PLAN.entry],
      ['Stop', PLAN.stop],
      ['Target', PLAN.target],
      ['Why this trade, why now?', PLAN.thesis],
      ['What would invalidate the thesis?', PLAN.invalidation],
    ] as const) {
      await tabTo(page, page.getByLabel(label, { exact: true }));
      await page.keyboard.type(value);
    }
    const conviction = page.getByRole('radiogroup', { name: 'Conviction' });
    await tabTo(page, conviction.getByLabel('1'));
    await page.keyboard.press('Space');
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await expect(conviction.getByLabel('4')).toBeChecked();
    const emotion = page.getByRole('radiogroup', { name: 'Primary emotion' });
    await tabTo(page, emotion.getByLabel('Calm'));
    await page.keyboard.press('Space');
    await expect(emotion.getByLabel('Calm')).toBeChecked();
    await tabTo(page, page.getByRole('button', { name: 'Confirm Plan' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: PLAN.symbol, level: 1 })).toBeVisible();
    await expect(page.getByText('$250.00')).toBeVisible();
    await context.close();
  });
});
