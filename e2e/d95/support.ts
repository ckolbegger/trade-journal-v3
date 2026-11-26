// Shared support for the D9.5 browser suite (plan section 7.2): every spec asserts the same information, fields and actions at 1280 and at 375 wide (AC-UI-002).
import type { BrowserContext, Page } from '@playwright/test';
import { createTrades, defineSetup, firstPage, FOUR_TRADES, launchAt, MONDAY_1700, onboardedAt, type Profile, type Setup, type TradeRef } from '../d4/support.ts';
import { setWidth } from '../d7p/support.ts';
import { createSettlementFixture, FRIDAY_NOV_1700, TUESDAY_1030 } from '../d7/support.ts';
import { setClock, TUESDAY_1700, WEDNESDAY_1700 } from '../d6/support.ts';
import { answerSlipQuestions, closeReasonGroup, enterMark, expect, fillRows, openReview, probe, reachPanel, saveAction, saveMarksButton, marksStepOf, sell, workspaceOf } from '../d6/support.ts';

export const WIDTHS = [1280, 375] as const;

// Onboarded at Mon Oct 12 17:00 with ABC (100 shares at $30.00, Stop $28.00, Target $36.00) and DEF (100 shares at $40.00, Stop $38.00, Target $46.00): built once per worker, each case starts on a copy.
export const ABC_DEF = defineSetup('d95-abc-def', async (profile) => {
  const { context, page } = await onboardedAt(profile, MONDAY_1700);
  const [abc, def] = await createTrades(page, [FOUR_TRADES[1]!, FOUR_TRADES[2]!]);
  return { context, made: { ABC: abc!, DEF: def! } };
});

// The copy launched at Mon Oct 12 17:00, on the Trades screen with its first load done.
export async function openAbcDef(profile: Profile, copySetup: <T>(setup: Setup<T>) => Promise<T>): Promise<{ context: BrowserContext; page: Page; ids: { ABC: string; DEF: string } }> {
  const ids = await copySetup(ABC_DEF);
  const context = await launchAt(profile, MONDAY_1700);
  const page = await firstPage(context);
  await page.goto('/');
  return { context, page, ids };
}

// Runs the same check at each width and leaves the page at 1280.
export async function atBothWidths(page: Page, check: (width: number) => Promise<void>): Promise<void> {
  for (const width of WIDTHS) {
    await setWidth(page, width);
    await check(width);
  }
  await setWidth(page, WIDTHS[0]);
}

// The Settlement Review fixture (D7's: T-1 a long XYZ Call with 1 contract left, T-2 a Long Stock XYZ, T-3 two short MNO Puts), built once per worker; every contract expires Fri Nov 20.
export const SETTLEMENT = defineSetup('d95-settlement', async (profile) => {
  const { context, page } = await onboardedAt(profile, TUESDAY_1030);
  return { context, made: await createSettlementFixture(page) };
});

// The copy launched at Fri Nov 20 17:00 (the expiration day) or at the instant given, on the Trades screen.
export async function openSettlement(profile: Profile, copySetup: <T>(setup: Setup<T>) => Promise<T>, at: string = FRIDAY_NOV_1700): Promise<{ context: BrowserContext; page: Page; t1: TradeRef; t2: TradeRef; t3: TradeRef }> {
  const { t1, t2, t3 } = await copySetup(SETTLEMENT);
  const context = await launchAt(profile, at);
  const page = await firstPage(context);
  await page.goto('/');
  return { context, page, t1, t2, t3 };
}

// A stored collection, read through the probe; it throws when the Workspace has no such store, so a check that "nothing was written" never reads an empty guess.
export async function storeOf(page: Page, name: string): Promise<unknown[]> {
  const workspace = workspaceOf(await probe(page));
  if (!workspace) throw new Error('no Workspace database was probed');
  const rows = workspace.stores[name];
  if (rows === undefined) throw new Error(`the workspace has no ${name} store`);
  return rows;
}

// Closes ABC with a sale of the whole Position at the Stop in the Review, and comes back to the Review with the closed card in the owed group.
export async function closeAbc(page: Page, on = { date: 'Mon Oct 12', mark: '27.50', saleTime: '2026-10-12T11:00' }): Promise<void> {
  await openReview(page);
  await enterMark(page, 'ABC', on.date, on.mark);
  await saveAction(page, 'Exit', undefined, 'ABC');
  const panel = await reachPanel(page, 'ABC', 'Action');
  await panel.getByRole('button', { name: 'Record the sale', exact: true }).click();
  await fillRows(page, [sell('100', '27.60', '1.00', on.saleTime)]);
  await closeReasonGroup(page).getByRole('radio', { name: 'Stop Triggered', exact: true }).check();
  await page.locator('form.plan-form').getByRole('button', { name: 'Save exit' }).click();
  await expect(page.getByText('Recorded. ABC is closed. Its Close Review is due in the next Review.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to the Review' }).click();
}

// ABC and DEF as ABC_DEF has them, with ABC sold at the Stop in the Review: its Close Review is owed from the next Review.
export const ABC_CLOSED = defineSetup('d95-abc-closed', async (profile) => {
  const { context, page } = await onboardedAt(profile, MONDAY_1700);
  const [abc, def] = await createTrades(page, [FOUR_TRADES[1]!, FOUR_TRADES[2]!]);
  await closeAbc(page);
  return { context, made: { ABC: abc!, DEF: def! } };
});

// The copy launched at Mon Oct 12 17:00 on the Review, where ABC's closed card is under "Trades with owed reflections".
export async function openAbcClosed(profile: Profile, copySetup: <T>(setup: Setup<T>) => Promise<T>): Promise<{ context: BrowserContext; page: Page; ids: { ABC: string; DEF: string } }> {
  const ids = await copySetup(ABC_CLOSED);
  const context = await launchAt(profile, MONDAY_1700);
  const page = await firstPage(context);
  await page.goto('/');
  await openReview(page);
  return { context, page, ids };
}

// Every Mark the expiry day's Review asks for, in one save from the Marks step: the two Underlyings and the two expired contracts, each in the money.
export async function enterExpiryMarks(page: Page): Promise<void> {
  const step = marksStepOf(page);
  for (const [name, price] of [['XYZ Mark, Fri Nov 20', '57.00'], ['XYZ Nov 20 $55 Call Mark, Fri Nov 20', '2.00'], ['MNO Mark, Fri Nov 20', '43.00'], ['MNO Nov 20 $45 Put Mark, Fri Nov 20', '2.00']] as const) {
    await step.getByRole('textbox', { name, exact: true }).fill(price);
  }
  await answerSlipQuestions(page);
  await saveMarksButton(page).click();
  await expect(step.getByRole('button', { name: /^(Save Marks \(0\)|Edit)$/ })).toBeVisible();
}

// ABC and DEF, with ABC held on Mon Oct 12 and sold at the Stop on Tue Oct 13 in the Review: three key moments, and its Close Review due from Wed Oct 14.
export const ABC_WALK = defineSetup('d95-abc-walk', async (profile) => {
  const { context, page } = await onboardedAt(profile, MONDAY_1700);
  const [abc, def] = await createTrades(page, [FOUR_TRADES[1]!, FOUR_TRADES[2]!]);
  await openReview(page);
  await enterMark(page, 'ABC', 'Mon Oct 12', '29.00');
  await saveAction(page, 'Hold', undefined, 'ABC');
  await setClock(context, page, TUESDAY_1700, '/');
  await closeAbc(page, { date: 'Tue Oct 13', mark: '27.50', saleTime: '2026-10-13T11:00' });
  return { context, made: { ABC: abc!, DEF: def! } };
});

// The copy launched at Wed Oct 14 17:00 on the Review, where ABC's Close Review is due.
export async function openAbcWalk(profile: Profile, copySetup: <T>(setup: Setup<T>) => Promise<T>): Promise<{ context: BrowserContext; page: Page; ids: { ABC: string; DEF: string } }> {
  const ids = await copySetup(ABC_WALK);
  const context = await launchAt(profile, WEDNESDAY_1700);
  const page = await firstPage(context);
  await page.goto('/');
  await openReview(page);
  return { context, page, ids };
}
