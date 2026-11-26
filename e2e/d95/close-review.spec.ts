import type { Locator, Page } from '@playwright/test';
import { answerCloseReviewIn, detail, expect, probe, test, walkCloseReview, workspaceOf } from '../d7/support.ts';
import { setWidth } from '../d7p/support.ts';
import { boxOf, replay } from '../d9ar/support.ts';
import { debtsOf, declinesOf, entriesWithSettledDebt } from '../d5/support.ts';
import { openAbcWalk, storeOf, WIDTHS } from './support.ts';

test.use({ actionTimeout: 15_000 });

// Everything a Close Review could change when it is saved or declined, read as it is stored (a missing store throws).
const STORES = ['trades', 'journalEntries', 'journalDeclines', 'journalObligations', 'journalDebts', 'observations'] as const;
async function stored(page: Page): Promise<string> {
  return JSON.stringify(await Promise.all(STORES.map((name) => storeOf(page, name))));
}

// The Entries that settled a Debt, narrowed to Close Reviews.
const closeReviewEntries = (workspace: Parameters<typeof entriesWithSettledDebt>[0]): unknown[] => (entriesWithSettledDebt(workspace) as unknown as { entryTypeKey: string }[]).filter((e) => /close-review/.test(e.entryTypeKey));

const cardOf = (page: Page, id: string): Locator => page.locator(`li.review-card[data-trade-id="${id}"]`);
async function openCard(page: Page, id: string): Promise<Locator> {
  const card = cardOf(page, id);
  const header = card.getByRole('button', { name: /^Review ABC/ });
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  return card;
}

test.describe('B95.14 The Close Review walk (AC-JOUR-001)', () => {
  for (const width of WIDTHS) {
    test(`should lock the questions until every moment is seen, require the answers, and save the Close Review from the Review at ${width}`, async ({ profile, copySetup }) => {
      test.setTimeout(240_000);
      const { context, page, ids } = await openAbcWalk(profile, copySetup);
      await setWidth(page, width);
      const card = await openCard(page, ids.ABC);
      await expect(card.getByText('How it ended: sold all 100 shares, Tue Oct 13. Stop Triggered.', { exact: true })).toBeVisible();
      await expect(card.getByRole('button', { name: 'Write the Close Review' })).toBeVisible();
      const before = await stored(page);
      await card.getByRole('button', { name: 'Write the Close Review' }).click();
      const scope = replay(page);
      await expect(scope, 'the walk opens over the Replay').toBeVisible();
      const form = scope.getByRole('form', { name: 'Close Review' });
      const take = form.getByRole('radiogroup', { name: 'Would you take this Trade again under similar conditions?' });
      const lesson = form.getByLabel('What is the key lesson?');
      const save = form.getByRole('button', { name: 'Save the Close Review', exact: true });
      // It opens on the first key moment; the questions are there and locked.
      await expect(scope.getByRole('slider', { name: 'Session' })).toHaveAccessibleName('Session');
      await expect(scope.getByText('Mon Oct 12 · 1 of 2')).toBeVisible();
      await expect(scope.getByText('1 of 2 seen', { exact: true })).toBeVisible();
      await expect(scope.getByText('See the 2 key moments first, then answer.', { exact: true })).toBeVisible();
      await expect(take.getByRole('radio', { name: 'Yes, as planned' }), 'locked: the answer').toBeDisabled();
      await expect(lesson, 'locked: the lesson').toBeDisabled();
      await expect(save, 'locked: Save').toBeDisabled();
      // Seeing a moment is screen state: nothing is stored, and a reload forgets it.
      await scope.getByRole('button', { name: 'Next moment', exact: true }).click();
      await expect(scope.getByText('All 2 seen. Now write.', { exact: true })).toBeVisible();
      expect(await stored(page), 'seeing every moment stores nothing').toBe(before);
      await page.reload();
      const again = await openCard(page, ids.ABC);
      await again.getByRole('button', { name: 'Write the Close Review' }).click();
      await expect(scope.getByText('1 of 2 seen', { exact: true }), 'the seen moments are forgotten').toBeVisible();
      await expect(save, 'locked again').toBeDisabled();
      expect(await stored(page), 'nothing stored after the reload').toBe(before);
      await scope.getByRole('button', { name: 'Next moment', exact: true }).click();
      await expect(scope.getByText('All 2 seen. Now write.', { exact: true })).toBeVisible();
      // Beside the chart when wide, under it on a phone.
      const chart = await boxOf(scope.getByRole('img', { name: /ABC price|Trade P&L/ }).first());
      const asked = await boxOf(form);
      if (width < 480) expect(asked.y, 'the questions are under the chart at 375').toBeGreaterThanOrEqual(chart.y + chart.height - 1);
      else expect(asked.x, 'the questions are beside the chart at 1280').toBeGreaterThanOrEqual(chart.x + chart.width - 1);
      // The answers are required: Would you take it again? and the key lesson; What worked is optional.
      await expect(save).toBeEnabled();
      await save.click();
      await expect(form.getByText('Choose one.', { exact: true }), 'the answer is required').toBeVisible();
      await expect(form.getByText('Write the lesson.', { exact: true }), 'the lesson is required').toBeVisible();
      expect(await stored(page), 'a refused save writes nothing').toBe(before);
      await take.getByLabel('Yes, as planned').check();
      await save.click();
      await expect(form.getByText('Choose one.', { exact: true })).toHaveCount(0);
      await expect(form.getByText('Write the lesson.', { exact: true }), 'the lesson is still required').toBeVisible();
      expect(await stored(page), 'a refused save writes nothing').toBe(before);
      await answerCloseReviewIn(form);
      await save.click();
      await expect(scope).toBeHidden();
      await expect(cardOf(page, ids.ABC).getByText('Close Review saved', { exact: true }).first()).toBeVisible();
      const workspace = workspaceOf(await probe(page))!;
      const entries = closeReviewEntries(workspace);
      expect(entries, 'one Close Review Entry').toHaveLength(1);
      expect(JSON.stringify(entries[0]), 'the key lesson is stored').toContain('Stick to the Plan.');
      const debts = debtsOf(workspace);
      expect(debts, 'one Debt').toHaveLength(1);
      expect((debts[0]!.versions as { status: string }[]).at(-1)!.status).toBe('Settled');
      expect(declinesOf(workspace), 'no Decline').toHaveLength(0);
      await context.close();
    });

    test(`should walk the moments from Trade Detail and save the same Close Review at ${width}`, async ({ profile, copySetup }) => {
      test.setTimeout(240_000);
      const { context, page, ids } = await openAbcWalk(profile, copySetup);
      await setWidth(page, width);
      await page.goto(`/trades/${ids.ABC}`);
      await detail.reflectNowButton(page).click();
      const scope = replay(page);
      await expect(scope.getByRole('form', { name: 'Close Review' }).getByRole('button', { name: 'Save the Close Review', exact: true }), 'locked on Trade Detail').toBeDisabled();
      await walkCloseReview(page);
      await expect(detail.savedReflection(page)).toBeVisible();
      const workspace = workspaceOf(await probe(page))!;
      expect(closeReviewEntries(workspace), 'one Close Review Entry').toHaveLength(1);
      expect(((debtsOf(workspace)[0]!.versions) as { status: string }[]).at(-1)!.status).toBe('Settled');
      await context.close();
    });

    test(`should ask to confirm before declining, keep the Debt on Keep it, and store a Decline and no Entry on confirming at ${width}`, async ({ profile, copySetup }) => {
      test.setTimeout(240_000);
      const { context, page, ids } = await openAbcWalk(profile, copySetup);
      await setWidth(page, width);
      const card = await openCard(page, ids.ABC);
      await expect(card.getByRole('link', { name: 'Decline…', exact: true }).or(card.getByRole('button', { name: 'Decline…', exact: true })), 'Decline is offered apart from Write').toBeVisible();
      const before = await stored(page);
      const declineIn = (scope: Locator): Locator => scope.getByRole('link', { name: 'Decline…', exact: true }).or(scope.getByRole('button', { name: 'Decline…', exact: true }));
      await declineIn(card).click();
      await expect(card.getByText('Decline this Close Review? The Journal will show it as declined.', { exact: true })).toBeVisible();
      await expect(card.getByLabel('Why? (optional)')).toBeVisible();
      await card.getByRole('button', { name: 'Keep it', exact: true }).click();
      await expect(card.getByText('Decline this Close Review? The Journal will show it as declined.', { exact: true })).toHaveCount(0);
      await expect(card.getByRole('button', { name: 'Write the Close Review' }), 'still owed').toBeVisible();
      // A write, if Keep it started one, lands within a moment (nothing on screen says it has finished); then a reload reads it all back.
      await page.waitForTimeout(500);
      expect(await stored(page), 'Keep it writes nothing').toBe(before);
      await page.reload();
      const reread = await openCard(page, ids.ABC);
      await expect(reread.getByRole('button', { name: 'Write the Close Review' }), 'still owed after a reload').toBeVisible();
      expect(await stored(page), 'Keep it writes nothing').toBe(before);
      await declineIn(reread).click();
      await reread.getByLabel('Why? (optional)').fill('Not worth writing up.');
      await reread.getByRole('button', { name: 'Decline the Close Review', exact: true }).click();
      await expect(cardOf(page, ids.ABC).getByText('Close Review declined', { exact: true }).first()).toBeVisible();
      const workspace = workspaceOf(await probe(page))!;
      expect(declinesOf(workspace), 'one Decline').toHaveLength(1);
      expect(JSON.stringify(declinesOf(workspace)[0]), 'with its reason').toContain('Not worth writing up.');
      expect(closeReviewEntries(workspace), 'no Close Review Entry').toHaveLength(0);
      await context.close();
    });
  }
});
