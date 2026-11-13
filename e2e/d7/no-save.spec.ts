import type { Page } from '@playwright/test';
import {
  answerCloseReviewIn, answerIn, closeReviewGroup, closingSection, createShortPutTrade, debtsOf, declinesOf, detail, entriesOf, entriesWithSettledDebt, expect, factsOf, fillOptionPlan, firstPage, FRIDAY_NOV_1700, launchAt,
  OC, onboardedAt, probe, READY, test, tradesOf, workspaceOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// Distinctive values, so any trace of them in storage is unmistakable.
const TYPED = {
  strike: '57.37',
  entry: '2.37',
  stop: '47.37',
  target: '63.37',
  thesis: 'Unsaved plan thesis marker 7d41.',
  invalidation: 'Unsaved plan invalidation marker 2c58.',
  note: 'Unsaved expiration note marker 5b19.',
  reason: 'Unsaved expiration decline marker 1f86.',
  closeReason: 'Unsaved close review decline marker 9e03.',
};
const TEXT = [TYPED.thesis, TYPED.invalidation, TYPED.note, TYPED.reason, TYPED.closeReason];
const NUMBERS = [TYPED.strike, TYPED.entry, TYPED.stop, TYPED.target];

const webStorage = (page: Page): Promise<unknown> => page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));

// Every key and leaf in the dump, with Web Storage strings that hold JSON walked as well.
function leaves(value: unknown, at = '$'): [string, unknown][] {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed !== null && typeof parsed === 'object') return [[at, value], ...leaves(parsed, at)];
    } catch {
      // Not JSON: the string itself is the leaf.
    }
    return [[at, value]];
  }
  if (value === null || typeof value !== 'object') return [[at, value]];
  return Object.entries(value).flatMap(([key, child]) => [[`${at}.${key}#key`, key] as [string, unknown], ...leaves(child, `${at}.${key}`)]);
}

// The paths of stored values derived from what was typed.
function traces(dump: unknown): string[] {
  return leaves(dump).flatMap(([at, leaf]) => {
    const text = typeof leaf === 'string' ? leaf.trim() : typeof leaf === 'number' ? String(leaf) : undefined;
    if (text === undefined) return [];
    const typed = TEXT.find((value) => text.includes(value)) ?? NUMBERS.find((value) => text === value || Number(text) === Number(value));
    return typed === undefined ? [] : [`${at} = ${JSON.stringify(leaf)} (typed ${JSON.stringify(typed)})`];
  });
}

test.describe('B7.12 Nothing saved without Save (AC-JOUR-001)', () => {
  test('should store no Trade, Expiration, Entry, decline, Debt, or Web Storage value after typing an option Plan and an expiration form, resizing, leaving, and restarting', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, FRIDAY_NOV_1700);
    await createShortPutTrade(setupPage);
    await setup.close();

    const context = await launchAt(profile, FRIDAY_NOV_1700);
    const page = await firstPage(context);
    await page.goto('/');
    await expect(page.getByRole('table', { name: 'Open Trades' })).toBeVisible(READY);
    const before = workspaceOf(await probe(page));

    // A full option Plan with its reflection, all unsaved, resized to 390 px and back.
    await fillOptionPlan(page, { ...OC, strike: TYPED.strike, entry: TYPED.entry, stop: TYPED.stop, target: TYPED.target, planTime: '2026-11-20T09:00' });
    await page.getByLabel('Why this trade, why now?').fill(TYPED.thesis);
    await page.getByLabel('What would invalidate the thesis?').fill(TYPED.invalidation);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByLabel('Strike')).toHaveValue(TYPED.strike);
    await expect(page.getByLabel('Why this trade, why now?')).toHaveValue(TYPED.thesis);
    expect(traces(await webStorage(page))).toEqual([]);
    expect(workspaceOf(await probe(page))).toEqual(before);

    // Leave the Plan unsaved for the expiration form of the short Put: answers, a Note, and both dispositions through Decline.
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await page.getByRole('table', { name: 'Open Trades' }).getByRole('link', { name: 'MNO', exact: true }).click();
    await detail.recordExpirationLink(page).click();
    await expect(page.getByRole('heading', { name: 'Expiration', level: 1 })).toBeVisible(READY);
    const reflection = page.getByRole('region', { name: 'Reflection on this expiration' });
    await answerIn(reflection);
    await reflection.getByLabel('Note').fill(TYPED.note);
    await reflection.getByLabel('Decline to reflect').check();
    await page.getByLabel('Reason for declining (optional)').fill(TYPED.reason);
    await reflection.getByLabel('Reflect now').check();
    await answerCloseReviewIn(closingSection(page));
    await closeReviewGroup(page).getByLabel('Decline to reflect').check();
    await page.getByLabel('Reason for declining the Close Review (optional)').fill(TYPED.closeReason);
    await closeReviewGroup(page).getByLabel('Reflect later').check();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(reflection.getByLabel('Note')).toHaveValue(TYPED.note);
    await expect(closeReviewGroup(page).getByLabel('Reflect later')).toBeChecked();
    expect(traces(await webStorage(page))).toEqual([]);
    expect(workspaceOf(await probe(page))).toEqual(before);

    // Navigate away without saving, then restart the browser.
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await expect(page.getByRole('table', { name: 'Open Trades' })).toBeVisible(READY);
    expect(traces(await webStorage(page))).toEqual([]);
    expect(workspaceOf(await probe(page))).toEqual(before);
    await context.close();

    const relaunched = await launchAt(profile, FRIDAY_NOV_1700);
    const again = await firstPage(relaunched);
    await again.goto('/');
    await expect(again.getByRole('table', { name: 'Open Trades' })).toBeVisible(READY);
    const probed = await probe(again);
    const workspace = workspaceOf(probed)!;
    expect(workspace).toEqual(before);
    const trades = tradesOf(workspace);
    expect(trades).toHaveLength(1);
    expect(trades[0]!.lifecycle).toBe('Open');
    expect(factsOf(trades[0]!, 'Expiration')).toEqual([]);
    expect(entriesOf(workspace).filter((e) => /close-review/.test(e.entryTypeKey))).toEqual([]);
    expect(debtsOf(workspace)).toEqual([]);
    expect(entriesWithSettledDebt(workspace)).toEqual([]);
    expect(declinesOf(workspace)).toEqual([]);
    expect(traces({ indexedDB: probed, webStorage: await webStorage(again) })).toEqual([]);
    await relaunched.close();
  });
});
