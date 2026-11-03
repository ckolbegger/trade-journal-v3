import type { Locator, Page } from '@playwright/test';
import {
  answerIn, closeReasonGroup, closeTheTrade, closingSection, createTrades, debtForm, executionRow, expect, expectAccessible, exitReflection, FOUR_TRADES, fillRows, firstPage, holdTradesStore,
  launchAt, MONDAY_1700, onboardedAt, openExitForm, openReview, openTradeFromOpenList, READY, receiptResult, releaseTradesStore, sell, setClock, tabTo, test, TUESDAY_1000_LOCAL, TUESDAY_1405,
  TUESDAY_1405_LOCAL, TUESDAY_1700, valueOf, writeIntegrityFixture,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

const nav = (page: Page): Locator => page.getByRole('navigation', { name: 'Primary' });
const OWED_GROUP = 'Trades with owed reflections';
const NARROW = { width: 390, height: 844 };
const WIDE = { width: 1280, height: 900 };

// Axe at 1280 px and again at 390 px, returning to 1280.
async function accessibleAtBothWidths(page: Page, state: string): Promise<void> {
  await expectAccessible(page, state);
  await page.setViewportSize(NARROW);
  await expectAccessible(page, `${state}, narrow`);
  await page.setViewportSize(WIDE);
}

// The signed figure, and the words "Closed via", read as text.
const LOSS = /^[-−–]\$\d/;
const GAIN = /^\+\$\d/;

test.describe('B6.12 Responsive and accessible', () => {
  test('should keep a half-filled full exit through 390 px and back, switching layout at 960 px, report no WCAG 2.1 AA violations on the exit form, the Closed list in each state, Closed Detail, Open Detail with Lot Matches and the owed-reflection cards, say signed P&L and Closed via in text, and record a full exit by keyboard alone', async ({ profile }) => {
    test.setTimeout(540_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    // XYZ (partly closed, Open Detail with Lot Matches), ABC (closed by keyboard at a loss), DEF (closed with its Close Review owed).
    await createTrades(setupPage, FOUR_TRADES.slice(0, 3));
    await setup.close();

    const context = await launchAt(profile, TUESDAY_1405);
    const page = await firstPage(context);
    await page.goto('/');

    // The Closed list, Empty, then Loading while the trades store is held.
    await page.getByRole('tab', { name: 'Closed' }).click();
    await expect(page.getByText('No closed trades yet')).toBeVisible(READY);
    await expectAccessible(page, 'Closed list, empty');
    await page.getByRole('tab', { name: 'Open' }).click();
    await expect(page.getByRole('table', { name: 'Open Trades' })).toBeVisible(READY);
    await holdTradesStore(page);
    await page.getByRole('tab', { name: 'Closed' }).click();
    await expect(page.getByRole('status')).toHaveText('Loading closed trades…');
    await expectAccessible(page, 'Closed list, loading');
    await releaseTradesStore(page);
    await expect(page.getByText('No closed trades yet')).toBeVisible(READY);

    // Half-fill a full exit of XYZ at 1280 px: the quantity, price, fee, one answer, a Note, and the Close Reason.
    await page.getByRole('tab', { name: 'Open' }).click();
    await openTradeFromOpenList(page, 'XYZ');
    await openExitForm(page);
    await fillRows(page, [sell('100', '53.00', '1.40', TUESDAY_1405_LOCAL)]);
    await exitReflection(page).getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned').check();
    await exitReflection(page).getByLabel('Note').fill('Half-written note that must survive resizing.');
    await expect(closingSection(page)).toBeVisible();
    await closeReasonGroup(page).getByLabel('Target Reached', { exact: true }).check();
    await expect(nav(page)).toHaveAttribute('data-placement', 'sidebar');

    // Resize: bottom navigation below 960 px, sidebar from 960 px; the values stay.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'bottom');
    await page.setViewportSize({ width: 959, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'bottom');
    await page.setViewportSize({ width: 960, height: 844 });
    await expect(nav(page)).toHaveAttribute('data-placement', 'sidebar');
    await page.setViewportSize(WIDE);
    await expect(executionRow(page, 1).getByLabel('Quantity')).toHaveValue('100');
    await expect(executionRow(page, 1).getByLabel('Price')).toHaveValue('53.00');
    await expect(exitReflection(page).getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned')).toBeChecked();
    await expect(exitReflection(page).getByLabel('Note')).toHaveValue('Half-written note that must survive resizing.');
    await expect(closeReasonGroup(page).getByLabel('Target Reached', { exact: true })).toBeChecked();

    // Axe on the exit form with the Closing section, then without it (30 of 100 shares).
    await accessibleAtBothWidths(page, 'Exit form with the Closing section');
    await executionRow(page, 1).getByLabel('Quantity').fill('30');
    await expect(closingSection(page)).toHaveCount(0);
    await accessibleAtBothWidths(page, 'Exit form without the Closing section');

    // Finish that partial exit, then axe on Open Detail with its Lot Matches.
    await executionRow(page, 1).getByLabel('Economic Time').fill(TUESDAY_1000_LOCAL);
    await answerIn(exitReflection(page));
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
    await expect(receiptResult(page)).toBeVisible();
    await accessibleAtBothWidths(page, 'Exit receipt');
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(page.getByRole('table', { name: 'Lot Matches' }).locator('tbody tr')).toHaveCount(1);
    await accessibleAtBothWidths(page, 'Open Detail with Lot Matches');

    // Keyboard only: close ABC at a loss, from its Detail to the receipt.
    await page.goto('/');
    await openTradeFromOpenList(page, 'ABC');
    const recordExit = page.getByRole('link', { name: 'Record exit' });
    await tabTo(page, recordExit);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Record exit', level: 1 })).toBeVisible(READY);
    const row = executionRow(page, 1);
    await tabTo(page, row.getByLabel('Quantity'));
    await page.keyboard.type('100');
    await tabTo(page, row.getByLabel('Price'));
    await page.keyboard.type('29.00');
    await tabTo(page, row.getByLabel('Fee'));
    await page.keyboard.type('1.00');
    const reflection = exitReflection(page);
    await tabTo(page, reflection.getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned'));
    await page.keyboard.press('Space');
    await tabTo(page, reflection.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Calm'));
    await page.keyboard.press('Space');
    await tabTo(page, reflection.getByRole('radiogroup', { name: 'Decision confidence' }).getByLabel('1', { exact: true }));
    for (let n = 0; n < 3; n++) await page.keyboard.press('ArrowRight');
    await expect(reflection.getByRole('radiogroup', { name: 'Decision confidence' }).getByLabel('4')).toBeChecked();
    await expect(closingSection(page)).toBeVisible();
    // Tab reaches the group at its first reason; Space chooses it and the arrow key moves the choice to the second.
    await tabTo(page, closeReasonGroup(page).getByLabel('Target Reached', { exact: true }));
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await expect(closeReasonGroup(page).getByLabel('Stop Triggered', { exact: true })).toBeChecked();
    await tabTo(page, closingSection(page).getByRole('radiogroup', { name: 'Would you take this Trade again under similar conditions?' }).getByLabel('Yes, as planned'));
    await page.keyboard.press('Space');
    await tabTo(page, page.getByRole('button', { name: 'Save exit' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible(READY);
    await expect(valueOf(receiptResult(page), 'Lifecycle')).toHaveText('Closed');

    // DEF is closed with the mouse and its Close Review deferred, so it owes one.
    await page.goto('/');
    await openTradeFromOpenList(page, 'DEF');
    await openExitForm(page);
    await fillRows(page, [sell('100', '41.00', '1.00', TUESDAY_1405_LOCAL)]);
    await closeTheTrade(page, 'later');
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
    await accessibleAtBothWidths(page, 'Exit receipt with the Close Review owed');

    // The Closed list, Ready: signed P&L and "Closed via" are words, and the owed Close Review is a badge, not a colour.
    await page.goto('/');
    await page.getByRole('tab', { name: 'Closed' }).click();
    const list = page.getByRole('table', { name: 'Closed Trades' });
    await expect(list).toBeVisible(READY);
    const abc = list.locator('tbody tr', { hasText: 'ABC' });
    const def = list.locator('tbody tr', { hasText: 'DEF' });
    await expect(abc.locator('td.number').first()).toHaveText(LOSS);
    await expect(def.locator('td.number').first()).toHaveText(GAIN);
    await expect(abc).toContainText('Closed via sale');
    await expect(abc).toContainText('Stop Triggered');
    await expect(def).toContainText('Reflection owed');
    await expect(abc).not.toContainText('Reflection owed');
    await accessibleAtBothWidths(page, 'Closed list, ready');

    // Narrow: the P&L columns leave the table, and the Trade cell carries the signed figures in words.
    await page.setViewportSize(NARROW);
    await expect(abc).toContainText(/Realized P&L [-−–]\$\d/);
    await expect(def).toContainText(/Realized P&L \+\$\d/);
    await page.setViewportSize(WIDE);

    // Closed Detail.
    await abc.getByRole('link', { name: 'ABC', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'ABC', level: 1 })).toBeVisible(READY);
    await expect(valueOf(page, 'Realized P&L')).toHaveText(LOSS);
    await expect(valueOf(page, 'Terminal Disposition')).toHaveText('Closed via sale of 100 shares');
    await expect(valueOf(page, 'Close Reason')).toHaveText('Stop Triggered');
    await accessibleAtBothWidths(page, 'Closed Detail');

    // The Review's owed-reflection cards (Tuesday 17:00), collapsed and with the Close Review form open.
    await setClock(context, page, TUESDAY_1700, '/');
    await openReview(page);
    await expect(page.getByRole('heading', { name: OWED_GROUP })).toBeVisible();
    const card = page.getByRole('list', { name: OWED_GROUP }).locator('li.review-card').filter({ hasText: 'DEF' });
    const header = card.getByRole('button', { name: /^Review / });
    await expect(header).toBeVisible();
    await accessibleAtBothWidths(page, 'Review owed-reflection cards, collapsed');
    if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await accessibleAtBothWidths(page, 'Review owed-reflection card, open');
    await card.getByRole('button', { name: /^Reflect on / }).click();
    await expect(debtForm(page)).toBeVisible(READY);
    await accessibleAtBothWidths(page, 'Review owed-reflection card with the Close Review form');
    await context.close();

    // The Closed list, Error: a Trade the list cannot read (a Position Change naming a missing Execution).
    await writeIntegrityFixture(profile.dir, { kind: 'MissingMember', underlying: 'DEF' });
    const failing = await launchAt(profile, TUESDAY_1700);
    const errorPage = await firstPage(failing);
    await errorPage.goto('/');
    await errorPage.getByRole('tab', { name: 'Closed' }).click();
    await expect(errorPage.getByText('We couldn’t load your closed trades. Nothing was changed.')).toBeVisible(READY);
    await expectAccessible(errorPage, 'Closed list, error');
    await failing.close();
  });

  test('should keep every money amount in the figure grids on one line at 375 px and 320 px, on Open Detail with Lot Matches and on Closed Detail', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(setupPage, FOUR_TRADES.slice(0, 1));
    await setup.close();
    const context = await launchAt(profile, TUESDAY_1405);
    const page = await firstPage(context);
    await page.goto('/');
    await openTradeFromOpenList(page, 'XYZ');
    await openExitForm(page);
    await fillRows(page, [sell('30', '53.00', '0.50', TUESDAY_1000_LOCAL)]);
    await answerIn(exitReflection(page));
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible(READY);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(page.getByRole('table', { name: 'Lot Matches' }).locator('tbody tr')).toHaveCount(1);

    // Each money amount is one line: its height is under 1.5 line heights.
    const expectAmountsOnOneLine = async (state: string): Promise<void> => {
      const wrapped = await page.locator('dl.figure-grid dd.number').evaluateAll((cells) =>
        cells.flatMap((cell) => {
          if (!/^[-+−–]?\$[\d,]+\.\d{2}$/.test(cell.textContent ?? '')) return [];
          const height = cell.getBoundingClientRect().height;
          const style = getComputedStyle(cell);
          const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
          return height > lineHeight * 1.5 ? [`${cell.parentElement?.querySelector('dt')?.textContent}: ${cell.textContent} (${height} px high, line ${lineHeight} px)`] : [];
        }));
      expect(wrapped, `${state}: amounts that wrap`).toEqual([]);
    };
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.getByRole('heading', { name: 'Fee reconciliation' })).toBeVisible();
      await expectAmountsOnOneLine(`Open Detail at ${width} px`);
    }

    await page.setViewportSize(WIDE);
    await openExitForm(page);
    await fillRows(page, [sell('70', '51.00', '1.00', TUESDAY_1405_LOCAL)]);
    await closeTheTrade(page, 'later');
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible(READY);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(page.getByRole('heading', { name: 'Result' })).toBeVisible(READY);
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expectAmountsOnOneLine(`Closed Detail at ${width} px`);
    }
    await context.close();
  });

  test('should keep each price with its date and time, and each money amount, whole on one line in the Lot Matches table at 375 px and 320 px', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(setupPage, FOUR_TRADES.slice(0, 1));
    await setup.close();
    const context = await launchAt(profile, TUESDAY_1405);
    const page = await firstPage(context);
    await page.goto('/');
    await openTradeFromOpenList(page, 'XYZ');
    await openExitForm(page);
    await fillRows(page, [sell('30', '53.00', '0.50', TUESDAY_1000_LOCAL)]);
    await answerIn(exitReflection(page));
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible(READY);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(page.getByRole('table', { name: 'Lot Matches' }).locator('tbody tr')).toHaveCount(1);

    // Each "price on date time" phrase and each signed money amount sits on one line: its text range has one top.
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const broken = await page.getByRole('table', { name: 'Lot Matches' }).evaluate((table) => {
        const found: string[] = [];
        const phrases = [/\$[\d,]+\.\d+ on \d{4}-\d{2}-\d{2} \d{2}:\d{2}/g, /[-+−–]?\$[\d,]+\.\d{2}/g];
        const walker = document.createTreeWalker(table.querySelector('tbody')!, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
          const text = node.textContent ?? '';
          for (const pattern of phrases) {
            for (const match of text.matchAll(pattern)) {
              const range = document.createRange();
              range.setStart(node, match.index);
              range.setEnd(node, match.index + match[0].length);
              const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
              if (tops.size > 1) found.push(`${match[0]} (${tops.size} lines)`);
            }
          }
        }
        return found;
      });
      expect(broken, `Lot Matches at ${width} px: text that breaks`).toEqual([]);
    }
    await context.close();
  });

  // T6.28-B5: the receipt's Lot Matches tables keep their nowrap cells (B4) inside focusable scroll regions, as Trade Detail does.
  test('should reflow the exit receipt, with its Lot Matches and Changed Lot Matches tables reachable by name, at 375 px and 320 px', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(setupPage, FOUR_TRADES.slice(0, 1));
    await setup.close();
    const context = await launchAt(profile, TUESDAY_1405);
    const page = await firstPage(context);
    await page.goto('/');
    await openTradeFromOpenList(page, 'XYZ');

    const expectReflowed = async (state: string): Promise<void> => {
      for (const width of [375, 320]) {
        await page.setViewportSize({ width, height: 844 });
        // Polled: the layout settles a moment after the viewport changes.
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), { message: `${state} at ${width} px: page scrollWidth beyond the viewport` })
          .toBeLessThanOrEqual(0);
        await expect(page.getByRole('table', { name: 'Lot Matches', exact: true }), `${state} at ${width} px`).toBeVisible();
      }
    };
    const recordExit = async (quantity: string, time: string): Promise<void> => {
      await openExitForm(page);
      await fillRows(page, [sell(quantity, '53.00', '0.50', time)]);
      await answerIn(exitReflection(page));
      await page.getByRole('button', { name: 'Save exit' }).click();
      await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible(READY);
    };

    await recordExit('70', TUESDAY_1000_LOCAL);
    await expectReflowed('Partial exit receipt');
    await page.setViewportSize(WIDE);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(page.getByRole('table', { name: 'Lot Matches' }).locator('tbody tr')).toHaveCount(2);

    // An exit dated before it: the sales are matched again, and the changed matches are disclosed.
    await recordExit('20', '2026-10-13T09:45');
    await expect(page.getByRole('heading', { name: 'Changed Lot Matches', level: 2 })).toBeVisible();
    await expectReflowed('Earlier-dated exit receipt');
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.getByRole('table', { name: 'Changed Lot Matches' })).toBeVisible();
    }
    await context.close();
  });
});
