import type { BrowserContext, Page } from '@playwright/test';
import {
  cardHeader, createOs2Trade, detail, expect, firstPage, launchAt, onboardedAt, openReview, reachCard, READY, reloadReview, saveSessionMarks, test, tradeCard, TUESDAY, TUESDAY_1030, TUESDAY_1700, WEDNESDAY, WEDNESDAY_1700_NY,
  THURSDAY, THURSDAY_1700_NY, type TradeRef,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// Section 4's Marks: MNO then the put, for each session.
const TUESDAY_MARKS = ['44.00', '1.80'] as const;
const WEDNESDAY_MARKS = ['43.20', '3.70'] as const;
const THURSDAY_MARKS = ['44.60', '3.65'] as const;

// A fresh launch at the instant, with the Marks of one session saved in the Review.
async function markSession(profile: Parameters<typeof launchAt>[0], instant: string, trade: TradeRef, date: string, marks: readonly [string, string]): Promise<void> {
  const context: BrowserContext = await launchAt(profile, instant);
  const page = await firstPage(context);
  await page.goto('/');
  await openReview(page);
  await saveSessionMarks(page, trade, date, marks[0], marks[1]);
  await context.close();
}

test.describe('B7S.3 Detail and list on Thursday', () => {
  test('should show one Stop breached and one Target reached badge on the Open list row, and Detail conditions with the option-price Stop Breached and the MNO Target Reached and Risk to stop and Reward to target $0.00', async ({ profile }) => {
    test.setTimeout(540_000);
    // Tuesday 10:30: O-S2 created through the UI with S1'.
    const { context: setup, page: setupPage } = await onboardedAt(profile, TUESDAY_1030);
    const trade = await createOs2Trade(setupPage);
    await setup.close();

    // Each session's Marks at that day's 17:00 New York clock (section 4's table).
    await markSession(profile, TUESDAY_1700, trade, TUESDAY, TUESDAY_MARKS);
    await markSession(profile, WEDNESDAY_1700_NY, trade, WEDNESDAY, WEDNESDAY_MARKS);
    await markSession(profile, THURSDAY_1700_NY, trade, THURSDAY, THURSDAY_MARKS);

    // Thursday, after a relaunch: the Open list row carries one badge per role; Detail's table reads each condition.
    const context = await launchAt(profile, THURSDAY_1700_NY);
    const page = await firstPage(context);
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    const list = page.getByRole('table', { name: 'Open Trades' });
    await expect(list).toBeVisible(READY);
    const row = list.getByRole('row', { name: /MNO/ });
    await expect(row.getByText('Stop breached', { exact: true })).toHaveCount(1);
    await expect(row.getByText('Target reached', { exact: true })).toHaveCount(1);

    await page.goto(`/trades/${trade.tradeId}`);
    await expect(detail.heading(page, 'MNO')).toBeVisible(READY);
    const table = detail.conditionsTable(page);
    const cells = async (name: string): Promise<string[]> => (await table.getByRole('row', { name }).getByRole('cell').allTextContents()).slice(0, 3);
    expect(await cells('Stop on MNO')).toEqual(['Stop on MNO', '41.00', 'Active']);
    expect(await cells('Stop on the option price')).toEqual(['Stop on the option price', '$3.60', 'Breached']);
    expect(await cells('Target on MNO')).toEqual(['Target on MNO', '44.50', 'Reached']);
    expect(await cells('Target on the option price')).toEqual(['Target on the option price', '$0.30', 'Active']);
    await expect(detail.riskToStop(page)).toContainText('$0.00');
    await expect(detail.rewardToTarget(page)).toContainText('$0.00');
    await context.close();
  });
});

test.describe('B7S.4 Review card conditions', () => {
  test('should list W8 four condition lines on O-S2 card in the Wednesday 17:00 Review with the option-price Stop Breached, $20.00 beyond, and the card in the boundary band, after a reload', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, TUESDAY_1030);
    const trade = await createOs2Trade(setupPage);
    await setup.close();
    await markSession(profile, TUESDAY_1700, trade, TUESDAY, TUESDAY_MARKS);

    // Wednesday 17:00: the Marks are saved, then the Review is reloaded so every figure is read from stored facts.
    const context = await launchAt(profile, WEDNESDAY_1700_NY);
    const page: Page = await firstPage(context);
    await page.goto('/');
    await openReview(page);
    await saveSessionMarks(page, trade, WEDNESDAY, ...WEDNESDAY_MARKS);
    await reloadReview(page);
    await reachCard(page, trade);
    await expect(cardHeader(page, trade)).toContainText('Boundary reached');
    const heading = tradeCard(page, trade).getByRole('heading', { name: 'Conditions', level: 4 });
    const lines = tradeCard(page, trade).getByRole('list', { name: 'Conditions' }).locator('li');
    await expect(heading).toBeVisible();
    await expect(lines).toHaveText([
      'Stop on MNO at or below 41.00: Active',
      'Stop on the option price at or above $3.60: Breached, $20.00 beyond',
      'Target on MNO at or above 44.50: Active',
      'Target on the option price at or below $0.30: Active',
    ]);
    await context.close();
  });
});
