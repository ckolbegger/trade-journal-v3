# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bug001.spec.ts >> reference board, modal keyboard and rejected draft journey at 1440
- Location: tests/visual/bug001.spec.ts:8:39

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Test source

```ts
  1  | import AxeBuilder from '@axe-core/playwright';
  2  | import { mkdir, writeFile, readFile } from 'node:fs/promises';
  3  | import { cpus, platform, release } from 'node:os';
  4  | import { test, expect } from '../browser/fixtures';
  5  | import { onboard, confirmPlan, fillPlan } from '../browser/helpers';
  6  | import { authority } from '../browser/d02-helpers';
  7  | const output = `implementation/evidence/bug-001/visual/${process.env.BUG001_EVIDENCE_RUN ?? Date.now()}`;
  8  | for (const width of [1440, 814, 390]) test(`reference board, modal keyboard and rejected draft journey at ${width}`, async ({ page, context, browserName, profilePath, playwright, baseURL }) => {
  9  |   await mkdir(output, { recursive: true }); await page.setViewportSize({ width, height: 900 });
  10 |   await page.clock.install({ time: new Date('2026-10-24T20:00:00Z') });
  11 |   const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  12 |   const geometry: Record<string, unknown> = {};
  13 |   async function capture(name: string) {
  14 |     await page.evaluate(() => document.fonts.ready);
  15 |     await page.screenshot({ path: `${output}/${width}-${name}.png`, fullPage: true });
  16 |     geometry[name] = await page.evaluate(() => ({ dpr: devicePixelRatio, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, nav: document.querySelector('nav')?.getBoundingClientRect().toJSON() as unknown, main: document.querySelector('main')?.getBoundingClientRect().toJSON() as unknown, panel: document.querySelector('[role=dialog]')?.getBoundingClientRect().toJSON() as unknown, fonts: Array.from(document.fonts).map(font => ({ family: font.family, status: font.status })), focused: document.activeElement?.outerHTML }));
  17 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  18 |     const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  19 |     await writeFile(`${output}/${width}-${name}-axe.json`, JSON.stringify(axe)); expect(axe.violations).toEqual([]);
  20 |   }
  21 |   await page.goto('/'); await expect(page.getByLabel('Workspace time zone')).toBeVisible(); await capture('setup');
  22 |   // Onboard uses this same native profile; no root, readiness or coordinator substitution.
  23 |   await onboard(page); await capture('empty');
  24 |   await page.getByRole('button', { name: 'Workspace', exact: true }).click(); await capture('workspace');
  25 |   await page.getByRole('button', { name: 'New Plan', exact: true }).click(); await capture('plan-stage1-blank');
  26 |   await page.getByLabel('Stock symbol').fill('XYZ'); await capture('plan-stage1-filled'); await page.getByRole('button', { name: 'Next: Plan and reflection' }).click(); await capture('plan-stage2-blank'); await page.getByRole('button', { name: 'Confirm Plan' }).click(); await capture('plan-validation');
  27 |   await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  28 |   await fillPlan(page); await capture('plan-stage2-filled'); await page.getByRole('button', { name: 'Confirm Plan' }).click(); await expect(page.getByRole('heading', { name: 'XYZ · Planned' })).toBeVisible(); await capture('planned-detail');
  29 |   await page.getByRole('button', { name: /Back to Trades/ }).click(); await expect(page.getByRole('button', { name: /XYZ · Planned/ })).toBeVisible(); await capture('planned-list');
  30 |   if (width === 1440) {
  31 |     expect(await page.getByRole('navigation').evaluate(nav => nav.getBoundingClientRect().width)).toBe(240);
  32 |     const row = await page.getByRole('button', { name: /XYZ · Planned/ }).boundingBox(); expect(row?.height).toBeGreaterThanOrEqual(66.5); expect(row?.height).toBeLessThanOrEqual(73.5);
  33 |     expect(await page.locator('main').evaluate(main => main.clientWidth - 48)).toBe(820);
  34 |   }
  35 |   await page.getByRole('button', { name: /XYZ · Planned/ }).click();
  36 |   await page.getByRole('button', { name: 'Record initial Position Change' }).click();
  37 |   const dialog = page.getByRole('dialog', { name: 'Opening entry' }); await capture('opening-blank');
  38 |   expect(await page.locator('[inert]').count()).toBe(1);
  39 |   if (width === 1440) expect((await dialog.boundingBox())?.width).toBe(440);
  40 |   await page.getByLabel('Execution 1 quantity (shares)').fill('100'); await page.getByLabel('Execution 1 price (USD)').fill('50');
  41 |   await page.getByRole('button', { name: 'Add another execution' }).click();
  42 |   const before = await authority(page);
  43 |   await page.getByRole('button', { name: 'Save opening entry' }).click();
  44 |   await expect(page.getByText('Nothing saved — Execution 2 needs a quantity and price')).toBeVisible(); expect(await authority(page)).toEqual(before);
  45 |   await page.getByRole('button', { name: 'Go to Execution 2 quantity' }).click(); await expect(page.getByLabel('Execution 2 quantity (shares)')).toBeFocused(); await capture('opening-rejected');
  46 |   await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(page.getByRole('button', { name: 'Continue unsaved entry' })).toBeFocused();
  47 |   await capture('draft-detail');
  48 |   await page.getByRole('button', { name: 'Continue unsaved entry' }).click(); await expect(page.getByLabel('Execution 1 quantity (shares)')).toHaveValue('100');
  49 |   await expect(page.getByText('Nothing saved — Execution 2 needs a quantity and price')).toBeVisible();
  50 |   await page.getByRole('button', { name: 'Remove draft row 2' }).click(); await expect(page.getByLabel('Execution 1 quantity (shares)')).toBeFocused();
  51 |   await page.getByLabel('Complete reflection now').check(); await page.getByLabel('As Planned', { exact: true }).check(); await page.getByLabel('Calm', { exact: true }).check(); await page.getByLabel('Decision confidence').selectOption('4'); await page.getByLabel('Note (optional)').fill('Synthetic retained reflection.');
  52 |   for (const liveWidth of [767, 768, 1023, 1024, 1440, 390, width]) {
  53 |     await page.setViewportSize({ width: liveWidth, height: 900 }); await page.getByLabel('Note (optional)').focus();
  54 |     await expect(page.getByLabel('Note (optional)')).toHaveValue('Synthetic retained reflection.');
  55 |     expect(await page.locator('nav').evaluate(nav => getComputedStyle(nav).position)).toBe(liveWidth < 1024 ? 'fixed' : 'static');
  56 |     await expect(dialog).toHaveCount(1);
  57 |     await expect.poll(async () => { const note = await page.getByLabel('Note (optional)').boundingBox(); const footer = await page.getByRole('button', { name: 'Save opening entry' }).boundingBox(); return !!note && !!footer && note.y >= 0 && note.y + note.height <= footer.y; }).toBe(true);
  58 |   }
  59 |   await page.getByRole('button', { name: 'Cancel', exact: true }).focus(); await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Close opening entry' })).toBeFocused();
  60 |   await page.keyboard.press('Shift+Tab'); await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
> 61 |   await expect.poll(async () => { const close = await page.getByRole('button', { name: 'Close opening entry' }).boundingBox(); return !!close && close.y >= 24 && close.y + close.height <= 900; }).toBe(true);
     |                                                                                                                                                                                                     ^ Error: expect(received).toBe(expected) // Object.is equality
  62 |   await capture('opening-filled');
  63 |   await page.getByRole('button', { name: 'Save opening entry' }).click(); await expect(page.getByRole('heading', { name: 'XYZ · Open' })).toBeVisible(); await capture('open-detail'); await page.getByRole('button', { name: 'Trades', exact: true }).click(); await page.getByRole('button', { name: 'Open', exact: true }).click(); await capture('open-list'); await page.getByRole('button', { name: /XYZ · Open/ }).click();
  64 |   await page.getByRole('button', { name: 'View Trade Journal' }).click(); await capture('trade-journal'); await page.getByRole('button', { name: 'Close trade journal' }).click();
  65 |   await confirmPlan(page); await page.getByRole('button', { name: 'Record initial Position Change' }).click(); await page.getByLabel('Execution 1 quantity (shares)').fill('100'); await page.getByLabel('Execution 1 price (USD)').fill('50'); await page.getByRole('button', { name: 'Save opening entry' }).click();
  66 |   await page.getByRole('button', { name: 'Journal Debt', exact: true }).click(); await capture('debt-queue'); await page.getByRole('button', { name: 'Answer reflection', exact: true }).click(); await capture('owed-composer');
  67 |   await page.getByLabel('Decline owed reflection').check(); await page.getByRole('button', { name: 'Save Debt outcome' }).click(); await capture('debt-declined');
  68 |   const committed = await authority(page);
  69 |   await writeFile(`${output}/${width}-environment.json`, JSON.stringify({ browserName, browser: context.browser()?.version(), os: { platform: platform(), release: release(), cpu: cpus()[0]?.model }, profilePath, geometry, errors, inventory: JSON.parse(await readFile('dist/offline-inventory.json', 'utf8')) as unknown, before, committed }, null, 2)); expect(errors).toEqual([]);
  70 |   await context.close(); const offline = await playwright[browserName].launchPersistentContext(profilePath, { headless: true, baseURL, offline: true });
  71 |   try { const reopened = await offline.newPage(); await reopened.goto('/'); await expect(reopened.getByRole('heading', { name: 'Trades', exact: true })).toBeVisible(); expect(await authority(reopened)).toEqual(committed); } finally { await offline.close(); }
  72 | });
  73 | 
```