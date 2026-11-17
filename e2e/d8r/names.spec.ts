import type { Page } from '@playwright/test';
import {
  completeReflection, detail, expect, executionRow, fillOptionExit, fillOptionPlan, fillOptionRows, MONDAY_1700, OC3, OC3_CALL, onboardedAt, openEntryForm, openReview,
  READY, reachCard, test, type TradeRef,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B8R.5 (plan section 7.2): O-C3 through the Plan form, the entry form, Detail, the Review card and the exit receipt; one contract in 2027. W28: the broker style on
// every screen, "XYZ Dec 18 $55 Call" for the current year and "XYZ Jan 15 2027 $55 Call" for a later one, and the accessible text of each name equals its
// visible text (P114): no label, title or alternative text spells the contract another way.
const CURRENT_YEAR = OC3_CALL;
const LATER_YEAR = 'XYZ Jan 15 2027 $55 Call';
const CONTRACT = /\bXYZ (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}(?: \d{4})? \$\d+(?:\.\d+)? (?:Call|Put)\b/g;

// Every contract name that the page shows as text, and every one that its labels and hover texts carry. Hidden drawer panels are left out of the text, since
// they show nothing; the labels of every element are read.
async function namesOn(page: Page): Promise<{ visible: string[]; accessible: string[] }> {
  return page.evaluate((source) => {
    const pattern = new RegExp(source, 'g');
    const visible = (document.body.innerText.match(pattern) ?? []).map((name) => name.trim());
    const accessible: string[] = [];
    for (const element of document.querySelectorAll('[aria-label], [title], [aria-labelledby]')) {
      const labels = [element.getAttribute('aria-label'), element.getAttribute('title')];
      const by = element.getAttribute('aria-labelledby');
      if (by) labels.push(...by.split(' ').map((id) => document.getElementById(id)?.textContent ?? null));
      for (const label of labels) accessible.push(...(label?.match(pattern) ?? []).map((name) => name.trim()));
    }
    return { visible, accessible };
  }, CONTRACT.source);
}

// On this screen the contract is named only in the broker style, once the style is the one `name` is, and no label spells it another way.
async function expectNamed(page: Page, screen: string, name: string, shown: boolean): Promise<void> {
  const { visible, accessible } = await namesOn(page);
  expect(new Set(visible), `${screen}: visible names`).toEqual(shown ? new Set([name]) : new Set());
  for (const label of accessible) expect(label, `${screen}: a label's name`).toBe(name);
}

const cellText = (page: Page): Promise<string> => page.evaluate(() => document.body.innerText);

test.describe('B8R.5 Contract names', () => {
  test('should name O-C3 "XYZ Dec 18 $55 Call" on every screen, and the 2027 contract "XYZ Jan 15 2027 $55 Call", each name read the same by screen readers', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);

    await test.step('the Plan form and Detail', async () => {
      await fillOptionPlan(page, OC3);
      await page.getByLabel('Stop (option price at or below)', { exact: true }).fill('1.00');
      await expectNamed(page, 'the Plan form', CURRENT_YEAR, false);
      await page.getByRole('button', { name: 'Confirm Plan' }).click();
      await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);
      await expectNamed(page, 'Detail', CURRENT_YEAR, true);
    });
    const trade: TradeRef = { symbol: 'XYZ', tradeId: new URL(page.url()).pathname.split('/')[2]!, label: 'O-C3' };

    await test.step('the entry form and its receipt', async () => {
      await openEntryForm(page);
      await fillOptionRows(page, [{ quantity: '2', price: '2.00', fee: '1.30', time: '2026-10-12T10:00' }]);
      await expectNamed(page, 'the entry form', CURRENT_YEAR, true);
      await completeReflection(page);
      await page.getByRole('button', { name: 'Save entry' }).click();
      await expect(page.getByRole('heading', { name: 'Entry recorded' })).toBeVisible(READY);
      await expectNamed(page, 'the entry receipt', CURRENT_YEAR, true);
    });

    await test.step('the Review card', async () => {
      await page.goto('/');
      await openReview(page);
      await reachCard(page, trade);
      await expectNamed(page, 'the Review card', CURRENT_YEAR, true);
    });

    await test.step('the exit form and its receipt', async () => {
      await page.goto(`/trades/${trade.tradeId}`);
      await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);
      await fillOptionExit(page, [{ quantity: '1', price: '3.00', fee: '0.65', time: '2026-10-12T14:00' }]);
      await expect(executionRow(page, 1)).toBeVisible();
      await expectNamed(page, 'the exit form', CURRENT_YEAR, true);
      await page.getByRole('region', { name: 'Reflection on this exit' }).getByLabel('Reflect later').check();
      await page.getByRole('button', { name: 'Save exit' }).click();
      await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible(READY);
      await expectNamed(page, 'the exit receipt', CURRENT_YEAR, true);
      expect(await cellText(page)).not.toMatch(/Dec 18,? 2026|2026-12-18/);
    });

    await test.step('a contract expiring in 2027 carries its year in full on its Detail', async () => {
      await fillOptionPlan(page, { ...OC3, expiration: '2027-01-15' });
      await page.getByLabel('Stop (option price at or below)', { exact: true }).fill('1.00');
      await page.getByRole('button', { name: 'Confirm Plan' }).click();
      await expect(detail.heading(page, 'XYZ')).toBeVisible(READY);
      await expectNamed(page, 'the 2027 Detail', LATER_YEAR, true);
      expect(await cellText(page)).not.toMatch(/Jan 15 \$55|'27/);
    });
    await context.close();
  });
});
