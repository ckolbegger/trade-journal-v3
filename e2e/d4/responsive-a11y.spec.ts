import type { Locator, Page } from '@playwright/test';
import {
  acknowledgeMark, actionForm, completion, continueToTrades, createTradeAt, createTrades, enterMark, expect, expectAccessible, firstPage, FOUR_TRADES, holdTradesStore, launchAt, markEntry, MONDAY_1700, onboardedAt, onboardedPage,
  openReview, openTradeFromOpenList, READY, recordEntry, releaseTradesStore, reloadReview, saveAction, setClock, status, tabTo, test, TUESDAY_NOON, tradesFamily, writeIntegrityFixture,
} from './support.ts';

const DATE = 'Mon Oct 12';
const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' });
const XYZ = FOUR_TRADES[0]!.plan;
const JKL = FOUR_TRADES[3]!.plan;

// One figure of a Detail section, by the section's name and the figure's term.
const figure = (page: Page, section: string, term: string): Locator =>
  page.getByRole('region', { name: section, exact: true }).locator('div', { has: page.locator('dt', { hasText: new RegExp(`^${term}$`) }) }).locator('dd');

const openList = (page: Page) => page.getByRole('table', { name: 'Open Trades' });
async function toOpenList(page: Page): Promise<void> {
  await nav(page).getByRole('link', { name: 'Trades' }).click();
  await expect(openList(page)).toBeVisible(READY);
}
async function detail(page: Page, symbol: string): Promise<void> {
  await toOpenList(page);
  await openTradeFromOpenList(page, symbol);
}

// Presses Shift+Tab until the target has focus, checking that every focused element shows a focus ring.
async function shiftTabTo(page: Page, target: Locator): Promise<void> {
  for (let presses = 0; presses < 120; presses++) {
    await page.keyboard.press('Shift+Tab');
    const focus = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      const style = element ? getComputedStyle(element) : undefined;
      return { visible: !!style && style.outlineStyle !== 'none' && style.outlineWidth !== '0px', tag: `${element?.tagName} ${element?.textContent?.slice(0, 30)}` };
    });
    if (focus.tag.startsWith('BODY')) continue;
    expect(focus.visible, `focus ring on ${focus.tag}`).toBe(true);
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error('target never received focus');
}

test.describe('B4.13 Responsive and accessible', () => {
  test('should keep a half-filled Action form through 390 px and back, switching layout at 960 px', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, [FOUR_TRADES[0]!]);
    await openReview(page);
    await enterMark(page, 'XYZ', DATE, '52.00');
    await continueToTrades(page);
    await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
    await actionForm(page).getByRole('radio', { name: 'Adjust', exact: true }).check();
    await actionForm(page).getByLabel(/^Why are you taking this action\?/).fill('Move the Stop to break even.');
    await expect(nav(page)).toHaveAttribute('data-placement', 'sidebar');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'bottom');
    await page.setViewportSize({ width: 959, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'bottom');
    await page.setViewportSize({ width: 960, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'sidebar');
    await page.setViewportSize({ width: 1280, height: 900 });

    await expect(actionForm(page).getByRole('radio', { name: 'Adjust', exact: true })).toBeChecked();
    await expect(actionForm(page).getByLabel(/^Why are you taking this action\?/)).toHaveValue('Move the Stop to break even.');
    await expect(completion(page)).toHaveText('Incomplete');
    await context.close();
  });

  test('should lay the Action choices out as compact chips, each radio inside its label, at 375 and 320 px', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, [FOUR_TRADES[0]!]);
    await openReview(page);
    await enterMark(page, 'XYZ', DATE, '52.00');
    await continueToTrades(page);
    await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 800 });
      for (const choice of ['Hold', 'Exit', 'Roll', 'Adjust']) {
        const radio = actionForm(page).getByRole('radio', { name: choice, exact: true });
        const label = actionForm(page).locator('label', { hasText: new RegExp(`^${choice}$`) });
        const [r, l] = [await radio.boundingBox(), await label.boundingBox()];
        expect(r && l, `${choice} boxes at ${width}`).toBeTruthy();
        expect(r!.width, `${choice} radio width at ${width}`).toBeLessThanOrEqual(120);
        // The chip contains the radio and its text: one box, on one line.
        expect(r!.x >= l!.x - 1 && r!.x + r!.width <= l!.x + l!.width + 1 && r!.y >= l!.y - 1 && r!.y + r!.height <= l!.y + l!.height + 1, `${choice} radio inside its chip at ${width}`).toBe(true);
        expect(l!.width, `${choice} chip width at ${width}`).toBeLessThanOrEqual(200);
        expect(l!.height, `${choice} chip height at ${width}`).toBeLessThanOrEqual(60);
      }
      await actionForm(page).getByRole('group', { name: 'Action' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/critic-d04-1/b2-${width}-actionform.png` });
    }
    // Arrow keys move within the group.
    await actionForm(page).getByRole('radio', { name: 'Hold', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(actionForm(page).getByRole('radio', { name: 'Exit', exact: true })).toBeChecked();
    await expectAccessible(page, 'Action form chips');
    await context.close();
  });

  test('should show a disabled Action chip as disabled with a not-allowed cursor and reduced opacity', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, [FOUR_TRADES[0]!]);
    await openReview(page);
    await enterMark(page, 'XYZ', DATE, '52.00');
    await continueToTrades(page);
    await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
    const chipStyle = (choice: string) => actionForm(page).locator('label.chip', { hasText: new RegExp(`^${choice}$`) })
      .evaluate((el) => ({ cursor: getComputedStyle(el).cursor, opacity: Number(getComputedStyle(el).opacity) }));
    expect((await chipStyle('Exit')).cursor).toBe('pointer');
    // The form disables its radios while saving or read only; disable one directly so the computed style is real.
    await actionForm(page).getByRole('radio', { name: 'Exit', exact: true }).evaluate((el) => { (el as HTMLInputElement).disabled = true; });
    const disabled = await chipStyle('Exit');
    expect(disabled.cursor).toBe('not-allowed');
    expect(disabled.opacity).toBeLessThan(1);
    expect((await chipStyle('Hold')).cursor).toBe('pointer');
    await context.close();
  });

  test('should report no WCAG 2.1 AA violations on the Review, the Action form, the Open list, and Detail in every evaluation state, with each state distinguishable by its words', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);

    // Review Empty.
    await nav(page).getByRole('link', { name: 'Review' }).click();
    await expect(page.getByText("No Trades were open at this session's close")).toBeVisible(READY);
    await expectAccessible(page, 'Review Empty');

    // Review Incomplete: the Marks family with Missing rows, one Trade opened Thursday so earlier sessions are listed.
    await createTrades(page, [FOUR_TRADES[0]!, FOUR_TRADES[1]!, FOUR_TRADES[2]!]);
    await createTradeAt(page, JKL, '2026-10-08T09:30', [['100', '20.00', '2026-10-08T10:00']]);
    await openReview(page);
    await expect(completion(page)).toHaveText('Incomplete');
    await expectAccessible(page, 'Review Incomplete, Marks family with Missing rows and earlier sessions');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectAccessible(page, 'Review Incomplete, narrow');
    await page.setViewportSize({ width: 1280, height: 900 });
    await markEntry(page, 'XYZ', DATE).getByRole('button', { name: 'Enter', exact: true }).click();
    await expectAccessible(page, 'Mark entry form');
    await markEntry(page, 'XYZ', DATE).getByRole('button', { name: 'Cancel' }).click();

    await enterMark(page, 'XYZ', DATE, '52.00');
    await enterMark(page, 'ABC', DATE, '27.50');
    await acknowledgeMark(page, 'DEF', DATE, 'No quote available.');
    await enterMark(page, 'JKL', 'Fri Oct 9', '20.80');
    await markEntry(page, 'ABC', DATE).getByRole('button', { name: 'Correct' }).click();
    await expectAccessible(page, 'Mark correction form');
    await markEntry(page, 'ABC', DATE).getByRole('button', { name: 'Cancel' }).click();
    // The words that tell the Marks apart without colour.
    await expect(markEntry(page, 'XYZ', DATE)).toContainText('Manual');
    await expect(markEntry(page, 'DEF', DATE)).toContainText('Acknowledged Unavailable');
    await expect(markEntry(page, 'JKL', DATE)).toContainText('Missing');
    await expectAccessible(page, 'Review Marks family: Manual, Acknowledged Unavailable, Missing');

    // The Open list at Monday 17:00: Available, Unavailable (acknowledged), and Missing rows.
    await toOpenList(page);
    const rows = openList(page);
    await expect(rows.getByRole('row', { name: /XYZ/ })).not.toContainText('Mark missing');
    await expect(rows.getByRole('row', { name: /JKL/ })).toContainText('Mark missing');
    await expect(rows.getByRole('row', { name: /DEF/ })).toContainText('Acknowledged');
    await expectAccessible(page, 'Open list with Available, Unavailable, and Missing rows');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectAccessible(page, 'Open list narrow');
    await page.setViewportSize({ width: 1280, height: 900 });

    // Detail in each evaluation state.
    await openTradeFromOpenList(page, 'ABC');
    await expect(figure(page, 'Valuation', 'Mark')).toHaveText('$27.50');
    await expect(figure(page, 'Risk and reward', 'Max reward')).toHaveText('Unbounded above');
    await expectAccessible(page, 'Detail Available (Stop Breached, Unbounded)');
    await detail(page, 'DEF');
    await expect(page.getByRole('region', { name: 'Valuation', exact: true })).toContainText('Acknowledged unavailable for DEF on Mon Oct 12: your acknowledgment, not a price');
    await expectAccessible(page, 'Detail Acknowledged Unavailable');
    await detail(page, 'JKL');
    await expect(page.getByRole('region', { name: 'Valuation', exact: true }).getByRole('link', { name: 'Mark missing for JKL on Mon Oct 12' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Valuation', exact: true })).toContainText('Stale context: $20.80 from Fri Oct 9 close (stale, not used in any current figure)');
    await expectAccessible(page, 'Detail Missing with Stale context');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectAccessible(page, 'Detail Missing with Stale context, narrow');
    await page.setViewportSize({ width: 1280, height: 900 });

    // The Review's Trades family and the Action form, half-filled and narrow.
    await openReview(page);
    await continueToTrades(page);
    await expectAccessible(page, 'Review Trades family');
    await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
    await expect(actionForm(page)).toBeVisible();
    await expectAccessible(page, 'Action form');
    await actionForm(page).getByRole('radio', { name: 'Exit', exact: true }).check();
    await actionForm(page).getByRole('button', { name: 'Save' }).click();
    await expect(actionForm(page).getByText('Say why you are taking this action.')).toBeVisible();
    await expectAccessible(page, 'Action form with an Intent error');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectAccessible(page, 'Action form with an Intent error, narrow');
    await page.setViewportSize({ width: 1280, height: 900 });
    await saveAction(page, 'Hold');
    await expectAccessible(page, 'Review Trades family with a saved Action');
    for (const symbol of ['ABC', 'DEF', 'JKL']) {
      await tradesFamily(page).getByRole('button', { name: `Review ${symbol}` }).click();
      await saveAction(page, 'Hold');
    }
    await expect(completion(page)).toHaveText('Incomplete');
    await expectAccessible(page, 'Review Incomplete with every Action saved and a Mark missing');
    await enterMark(page, 'JKL', DATE, '21.00');
    await reloadReview(page);
    await expect(completion(page)).toHaveText('Complete with Unavailable Marks');
    await expectAccessible(page, 'Review Complete with Unavailable Marks');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectAccessible(page, 'Review Complete with Unavailable Marks, narrow');
    await page.setViewportSize({ width: 1280, height: 900 });

    // Tuesday noon: 40 more shares at 10:00 make XYZ's current figures Awaiting the next close, with dated and at-entry lines.
    await setClock(context, page, TUESDAY_NOON);
    await openTradeFromOpenList(page, 'XYZ');
    await recordEntry(page, [{ quantity: '40', price: '50.30', fee: '1.00', time: '2026-10-13T10:00' }]);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(figure(page, 'Valuation', 'Open P&L')).toHaveText('Awaiting the next close');
    await expect(page.getByRole('heading', { name: 'At Mon Oct 12 close', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'At entry', level: 2 })).toBeVisible();
    await expect(figure(page, 'At entry', 'Quantity')).toHaveText('40 shares');
    await expectAccessible(page, 'Detail AwaitingClose with dated and at-entry sections');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectAccessible(page, 'Detail AwaitingClose, narrow');
    await page.setViewportSize({ width: 1280, height: 900 });
    await toOpenList(page);
    await expect(openList(page).getByRole('row', { name: /XYZ/ })).toContainText('Awaiting the next close');
    await expectAccessible(page, 'Open list with an AwaitingClose row');

    // Review Loading: the trades store is held behind a read-only transaction, so the read waits.
    await holdTradesStore(page);
    await nav(page).getByRole('link', { name: 'Review' }).click();
    await expect(page.getByRole('status')).toHaveText('Loading the Review…');
    await expectAccessible(page, 'Review Loading');
    await expect(page.getByRole('status')).toHaveText('Loading the Review…');
    await releaseTradesStore(page);
    await expect(status(page)).toBeVisible(READY);
    await context.close();

    // Review Error: a Position Change naming an Execution that does not exist, written before launch.
    await writeIntegrityFixture(profile.dir, { kind: 'MissingMember', underlying: XYZ.symbol });
    const failing = await launchAt(profile, TUESDAY_NOON);
    const errorPage = await firstPage(failing);
    await errorPage.goto('/');
    await nav(errorPage).getByRole('link', { name: 'Review' }).click();
    await expect(errorPage.getByText('We couldn’t load the Review. Nothing was changed.')).toBeVisible(READY);
    await expectAccessible(errorPage, 'Review Error');
    await failing.close();
  });

  test('should complete a Review using the keyboard only, with visible focus throughout', async ({ profile }) => {
    const context = await launchAt(profile, MONDAY_1700);
    const page = await onboardedPage(context);
    await createTrades(page, [FOUR_TRADES[0]!]);
    await page.goto('/');
    await expect(openList(page)).toBeVisible(READY);

    await tabTo(page, nav(page).getByRole('link', { name: 'Review' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible(READY);
    await expect(page.getByRole('region', { name: 'Review status' })).toBeVisible(READY);
    const entry = markEntry(page, 'XYZ', DATE);
    await tabTo(page, entry.getByRole('button', { name: 'Enter', exact: true }));
    await page.keyboard.press('Enter');
    await tabTo(page, entry.getByLabel('Price'));
    await page.keyboard.type('52.00');
    await tabTo(page, entry.getByRole('button', { name: 'Save Mark' }));
    await page.keyboard.press('Enter');
    await expect(entry.getByText('Manual')).toBeVisible();
    await tabTo(page, page.getByRole('button', { name: 'Continue to Trades' }));
    await page.keyboard.press('Enter');
    await expect(tradesFamily(page)).toBeVisible(READY);
    // Continue to Trades is disabled while the Review refreshes, which drops focus to the end of the page;
    // Shift+Tab walks back from there to the Trade's button.
    await shiftTabTo(page, tradesFamily(page).getByRole('button', { name: 'Review XYZ' }));
    await page.keyboard.press('Enter');
    // Hold is preselected: Save alone records the Action.
    await expect(page.getByRole('radio', { name: 'Hold', exact: true })).toBeChecked();
    await tabTo(page, actionForm(page).getByRole('button', { name: 'Save' }));
    await page.keyboard.press('Enter');
    await expect(completion(page)).toHaveText('Complete');
    await expect(page.getByText('Every Trade has an Action.')).toBeVisible();
    await expectAccessible(page, 'Review Complete');
    await context.close();
  });
});
