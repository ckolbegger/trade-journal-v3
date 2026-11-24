import type { Locator, Page } from '@playwright/test';
import { actionEntriesOf, cardHeader, createTrades, defineSetup, enterMark, expect, firstPage, FOUR_TRADES, fillRows, launchAt, MONDAY_1700, onboardedAt, openReview, probe, reachCard, reloadReview, saveAction, sell, test, TUESDAY_1700, workspaceOf, type Profile, type Setup } from '../d6/support.ts';
import { expectNoSidewaysScroll } from '../d7p/support.ts';
import { atBothWidths } from './support.ts';

// Monday: ABC (100 shares, Stop $28.00, Target $36.00) is inside its lines at $29.00 and an Exit is saved with a reason; DEF is untouched.
const EXIT_SAVED = defineSetup('d95-abc-exit', async (profile) => {
  const { context, page } = await onboardedAt(profile, MONDAY_1700);
  await createTrades(page, [FOUR_TRADES[1]!, FOUR_TRADES[2]!]);
  await openReview(page);
  await enterMark(page, 'ABC', 'Mon Oct 12', '29.00');
  await saveAction(page, 'Exit', 'Taking the gain.', 'ABC');
  return { context, made: undefined };
});
// The same, with a Roll saved in place of the Exit.
const ROLL_SAVED = defineSetup('d95-abc-roll', async (profile) => {
  const { context, page } = await onboardedAt(profile, MONDAY_1700);
  await createTrades(page, [FOUR_TRADES[1]!, FOUR_TRADES[2]!]);
  await openReview(page);
  await enterMark(page, 'ABC', 'Mon Oct 12', '29.00');
  await saveAction(page, 'Roll', 'Moving it out.', 'ABC');
  return { context, made: undefined };
});

// The copy launched on Tuesday's Review at 17:00, before any of Tuesday's Marks.
async function openTuesday(profile: Profile, copySetup: <T>(setup: Setup<T>) => Promise<T>, setup: Setup<undefined>) {
  await copySetup(setup);
  const context = await launchAt(profile, TUESDAY_1700);
  const page = await firstPage(context);
  await page.goto('/review');
  await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible();
  return { context, page };
}

const cardBanner = (page: Page): Locator => page.getByRole('group', { name: 'Exit not carried out', exact: true });
const dayNote = (page: Page): Locator => page.getByRole('group', { name: 'Exit not carried out: ABC', exact: true });
const storedActions = async (page: Page) => actionEntriesOf(workspaceOf(await probe(page))!);

test.use({ actionTimeout: 15_000 });

test.describe('B95.9 An Exit not carried out (AC-REV-007)', () => {
  test('should say on the card and on the day card that an Exit was chosen, on which day, and what is still held, with the two answers', async ({ profile, copySetup }) => {
    test.setTimeout(120_000);
    const { context, page } = await openTuesday(profile, copySetup, EXIT_SAVED);
    await reachCard(page, 'ABC');
    await atBothWidths(page, async (width) => {
      await expect(cardBanner(page).getByText('You chose Exit on Mon Oct 12. Still holding 100.', { exact: true }), `the card's banner at ${width}`).toBeVisible();
      await expect(cardBanner(page).getByRole('button', { name: 'I sold: record it', exact: true })).toBeVisible();
      await expect(cardBanner(page).getByRole('button', { name: 'Still holding', exact: true })).toBeVisible();
      // The day card says it with the Exit's reason.
      await expect(dayNote(page)).toContainText('Mon Oct 12 you chose Exit on ABC: “Taking the gain.” Still holding 100.');
      await expect(dayNote(page).getByRole('button', { name: 'I sold: record it', exact: true })).toBeVisible();
      await expect(dayNote(page).getByRole('button', { name: 'Still holding', exact: true })).toBeVisible();
      await expect(page.getByRole('group', { name: 'Exit not carried out: DEF' }), 'no banner for DEF').toHaveCount(0);
      await expectNoSidewaysScroll(page, `the banner at ${width} px`);
    });
    await context.close();
  });

  test('should hide the banner on Still holding, save nothing, and show it again after a fresh open', async ({ profile, copySetup }) => {
    test.setTimeout(120_000);
    const { context, page } = await openTuesday(profile, copySetup, EXIT_SAVED);
    await reachCard(page, 'ABC');
    expect(await storedActions(page), "Monday's Exit").toHaveLength(1);
    await cardBanner(page).getByRole('button', { name: 'Still holding', exact: true }).click();
    await atBothWidths(page, async (width) => {
      await expect(cardBanner(page), `the card's banner gone at ${width}`).toHaveCount(0);
      await expect(dayNote(page), `the day card's note gone at ${width}`).toHaveCount(0);
    });
    expect(await storedActions(page), 'Still holding saves nothing').toHaveLength(1);
    await reloadReview(page);
    await reachCard(page, 'ABC');
    await expect(cardBanner(page).getByText('You chose Exit on Mon Oct 12. Still holding 100.', { exact: true })).toBeVisible();
    await context.close();
  });

  test('should open the sale form on I sold: record it, and say how much was sold since once part is recorded', async ({ profile, copySetup }) => {
    test.setTimeout(120_000);
    const { context, page } = await openTuesday(profile, copySetup, EXIT_SAVED);
    await reachCard(page, 'ABC');
    await cardBanner(page).getByRole('button', { name: 'I sold: record it', exact: true }).click();
    const form = page.locator('form.plan-form');
    await expect(form.getByRole('group', { name: 'Execution 1' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Against the Plan' })).toBeVisible();
    await fillRows(page, [sell('40', '29.50', '1.00', '2026-10-13T10:00')]);
    // A part sale before either line leaves the Plan on two counts, so it asks why; the Exit's reason is not carried for it.
    await page.getByLabel('Why did you leave the Plan?').fill('Trimming.');
    await form.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByText(/^Recorded/).first().or(page.getByRole('heading', { name: 'Exit recorded' }))).toBeVisible();
    await page.getByRole('button', { name: 'Back to the Review' }).click();
    await reachCard(page, 'ABC');
    await atBothWidths(page, async (width) => {
      await expect(cardBanner(page).getByText('You chose Exit on Mon Oct 12. Sold 40 since. Still holding 60.', { exact: true }), `the banner after a part sale at ${width}`).toBeVisible();
    });
    await context.close();
  });

  test('should show no banner for an earlier Roll', async ({ profile, copySetup }) => {
    test.setTimeout(120_000);
    const { context, page } = await openTuesday(profile, copySetup, ROLL_SAVED);
    await reachCard(page, 'ABC');
    expect(await storedActions(page), "Monday's Roll").toHaveLength(1);
    await atBothWidths(page, async (width) => {
      await expect(cardHeader(page, 'ABC')).toBeVisible();
      await expect(cardBanner(page), `no banner at ${width}`).toHaveCount(0);
      await expect(dayNote(page)).toHaveCount(0);
    });
    await context.close();
  });
});
