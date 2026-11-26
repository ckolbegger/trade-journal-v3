import type { Locator, Page } from '@playwright/test';
import { cardHeader, completion, expect, MONDAY_NOV_1700, openExpiration, openReview, reachCard, saveAction, setClock, status, test } from '../d7/support.ts';
import { setWidth } from '../d7p/support.ts';
import { enterExpiryMarks, openSettlement, storeOf, WIDTHS } from './support.ts';

test.use({ actionTimeout: 15_000 });

const button = (block: Locator, name: string): Locator => block.getByRole('button', { name, exact: true });

// The colour a piece of text is drawn in, and the one the amber tone names.
const colourOf = (locator: Locator): Promise<string> => locator.evaluate((el) => getComputedStyle(el).color);
async function amber(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--warning-text)';
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });
}

// Each stored Settle Later entry, and the Trades as stored.
const settleLaterEntries = async (page: Page): Promise<unknown[]> => (await storeOf(page, 'journalEntries')).filter((entry) => JSON.stringify(entry).includes('settle-later'));

test.describe('B95.12 Settle Later (AC-SET-005, AC-REV-006)', () => {
  for (const width of WIDTHS) {
    test(`should finish the day as Complete, settlement to record, in amber, and ask again in the next Review at ${width}`, async ({ profile, copySetup }) => {
      test.setTimeout(240_000);
      const { context, page, t1, t2, t3 } = await openSettlement(profile, copySetup);
      await setWidth(page, width);
      await openReview(page);
      await enterExpiryMarks(page);
      await saveAction(page, 'Hold', 'Letting it run.', t2);
      await expect(completion(page), 'Incomplete until both contracts are settled').toHaveText('Incomplete');
      await expect(status(page).getByText('2 expirations to settle', { exact: false }), 'the count in the heading').toBeVisible();
      const tradesBefore = JSON.stringify(await storeOf(page, 'trades'));
      expect(await settleLaterEntries(page), 'no Settle Later yet').toHaveLength(0);

      // The long contract in the money: record later, the saved line, the other choices still offered, no undo.
      const long = await openExpiration(page, t1);
      await button(long, 'Exercised: record later').click();
      // The card moves on once the choice is saved (its header then reads Done · Settle Later), so its line is read on the card opened again.
      await expect(cardHeader(page, t1)).toContainText('Done · Settle Later');
      const savedLong = await openExpiration(page, t1);
      await expect(savedLong.getByText("Exercised, to record later. Today's Review can finish. The next Review asks again.", { exact: true }), 'the saved line').toBeVisible();
      await expect(button(savedLong, 'Exercised: record later'), 'no second record later').toHaveCount(0);
      await expect(button(savedLong, 'Sold before the close'), 'the sale choice stays').toBeVisible();
      await expect(button(savedLong, 'It expired worthless'), 'the worthless link stays').toBeVisible();
      await expect(completion(page), 'one contract still to settle').toHaveText('Incomplete');
      // The short contract with no price: Assigned, record later.
      const short = await openExpiration(page, t3);
      await button(short, 'Assigned: record later').click();
      await expect(cardHeader(page, t3)).toContainText('Done · Settle Later');
      const savedShort = await openExpiration(page, t3);
      await expect(savedShort.getByText("Assigned, to record later. Today's Review can finish. The next Review asks again.", { exact: true })).toBeVisible();

      await expect(completion(page)).toHaveText('Complete, settlement to record');
      const heading = completion(page);
      await expect(heading).toHaveAttribute('data-tone', 'warning');
      expect(await colourOf(heading), 'drawn in the amber tone').toBe(await amber(page));
      expect(await colourOf(heading), 'not the plain text colour').not.toBe(await colourOf(status(page).getByText('Review Date')));
      const toRecord = status(page).locator('dt', { hasText: 'To record' }).locator('xpath=following-sibling::dd[1]');
      await expect(toRecord.getByText('XYZ: the exercise of 1 contract, expired Fri Nov 20.', { exact: true })).toBeVisible();
      await expect(toRecord.getByText('MNO: the assignment of 2 contracts, expired Fri Nov 20.', { exact: true })).toBeVisible();
      // Stored: two Settle Later entries and not one change to any Trade.
      expect(await settleLaterEntries(page), 'one Settle Later for each contract').toHaveLength(2);
      expect(JSON.stringify(await storeOf(page, 'trades')), 'no Trade fact was written').toBe(tradesBefore);

      // The next Review date: Incomplete, and each card says it asks again.
      await setClock(context, page, MONDAY_NOV_1700, '/');
      await openReview(page);
      await expect(completion(page), 'Incomplete again the next date').toHaveText('Incomplete');
      await reachCard(page, t1);
      const again = (await openExpiration(page, t1));
      await expect(again.getByText('Fri Nov 20 you chose Exercised: record later. It is still to settle, so this Review asks again.', { exact: true })).toBeVisible();
      await expect(button(again, 'Exercised: record later'), 'the choice is open again').toBeVisible();
      await expect(cardHeader(page, t1), 'the card is labelled').toContainText('Expired: settle');
      await context.close();
    });
  }
});
