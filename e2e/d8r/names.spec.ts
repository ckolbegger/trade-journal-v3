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
// Anything on a screen that names an XYZ option, spelled any way: from the symbol, through a digit (date or strike), to Call or Put ("XYZ · Long Call" is a
// position kind, not a contract). A contract spelled another way (for example
// "XYZ 2026-12-18 55 Call") is found here and fails the comparison with the broker name, instead of passing unseen.
// The match runs from the last XYZ before the digit, so "XYZ at or above 60.00: Mark missing: XYZ Dec 18 $55 Call" reads as the contract alone.
const NOT_XYZ = '(?:(?!\\bXYZ\\b)[^\\n"])';
const MENTION_SOURCE = `\\bXYZ\\b${NOT_XYZ}*?\\d${NOT_XYZ}*?\\b(?:Call|Put)\\b`;
// The Review card names a position "XYZ (Long 2 Dec 18 $55 Call)": the symbol, the side and quantity, then the contract's own date, strike and type. The side and
// quantity are taken out, and what is left must be the W28 name exactly.
const mentions = (text: string | null | undefined): string[] =>
  (text ?? '').match(new RegExp(MENTION_SOURCE, 'g'))?.map((name) => name.trim().replace(/^XYZ \(?(?:Long|Short) \d+ /, 'XYZ ').replace(/\)$/, '')) ?? [];

// Every contract mention that the page shows as text, and every one in the accessible names the browser computes (its accessibility tree joins aria-label,
// aria-labelledby, alt, title and content), plus every aria-label, title and alt attribute whatever the element's role.
async function namesOn(page: Page): Promise<{ visible: string[]; accessible: string[]; elements: { accessibleName: string; text: string }[] }> {
  const visible = mentions(await page.evaluate(() => document.body.innerText));
  const tree = await page.locator('body').ariaSnapshot();
  const accessible = [...tree.matchAll(/"((?:[^"\\]|\\.)*)"/g)].flatMap((found) => mentions(found[1]));
  const attributes = await page.evaluate(() => [...document.querySelectorAll('[aria-label], [title], [alt]')].flatMap((element) =>
    ['aria-label', 'title', 'alt'].map((attribute) => element.getAttribute(attribute) ?? '')));
  accessible.push(...attributes.flatMap(mentions));
  // Every element that has an accessible name, hidden or not (the accessibility tree leaves hidden ones out). The name is the text of the aria-labelledby targets
  // (read whether hidden or not), else aria-label, alt or title, else, for roles named by their content, the content. A content-named element's name is then
  // compared with its content, so a label such as "Open" over a span that spells the contract is found.
  const elements = await page.evaluate(() => {
    const byContent = 'button, a, summary, h1, h2, h3, h4, h5, h6, [role=button], [role=link], [role=tab], [role=menuitem], [role=option], [role=heading]';
    const squash = (text: string | null): string => (text ?? '').replace(/\s+/g, ' ').trim();
    return [...document.querySelectorAll('body *')].flatMap((element) => {
      const targets = (element.getAttribute('aria-labelledby') ?? '').split(/\s+/).map((id) => document.getElementById(id)).filter((found) => found !== null);
      const text = squash(element.textContent);
      const named = element.matches(byContent);
      const accessibleName = squash(targets.map((found) => found.textContent).join(' ')) || element.getAttribute('aria-label') || element.getAttribute('alt')
        || element.getAttribute('title') || (named ? text : '');
      return accessibleName ? [{ accessibleName, text: named ? text : '' }] : [];
    });
  });
  return { visible, accessible, elements };
}

// On this screen the contract is named only in the broker style, once the style is the one `name` is, and no accessible name or label spells it another way: each
// element's whole accessible name reads the broker name where its visible text does, and every contract mention in any accessible name is that name.
async function expectNamed(page: Page, screen: string, name: string, shown: boolean): Promise<void> {
  const { visible, accessible, elements } = await namesOn(page);
  expect(new Set(visible), `${screen}: visible names`).toEqual(shown ? new Set([name]) : new Set());
  for (const label of accessible) expect(label, `${screen}: an accessible name's contract`).toBe(name);
  for (const { accessibleName, text } of elements) {
    if (mentions(text).length > 0) expect(new Set(mentions(accessibleName)), `${screen}: the accessible name "${accessibleName}" against the visible "${text.slice(0, 80)}"`).toEqual(new Set(mentions(text)));
    expect(mentions(accessibleName).every((mention) => mention === name), `${screen}: the accessible name "${accessibleName}"`).toBe(true);
    expect(mentions(accessibleName).length > 0 || mentions(text).length === 0, `${screen}: the accessible name "${accessibleName}" leaves out the contract in "${text.slice(0, 80)}"`).toBe(true);
  }
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
