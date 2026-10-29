import type { Page } from '@playwright/test';
import { actionEntriesOf, actionForm, continueToTrades, createTrades, enterMark, expect, firstPage, FOUR_TRADES, launchAt, markEntry, MONDAY_1700, observationsOf, onboardedAt, openReview, probe, READY, test, tradesFamily, workspaceOf } from './support.ts';

const DATE = 'Mon Oct 12';
// Distinctive values, so any trace of them in storage is unmistakable.
const TYPED = { markPrice: '43.71', correctedPrice: '51.37', reason: 'Unsaved correction reason marker 7c2a.', intent: 'Unsaved intent marker 5d8e.', considered: 'Unsaved considered marker 3b91.', note: 'Unsaved note marker 9f40.' };
const TEXT = [TYPED.reason, TYPED.intent, TYPED.considered, TYPED.note];
const NUMBERS = [TYPED.markPrice, TYPED.correctedPrice];

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

test.describe('B4.12 Nothing saved without Save (AC-JOUR-001)', () => {
  test('should store no observation revision, Entry, or Web Storage value after typing a Mark price, a correction, and an Action with Intent, Conviction, considered text, and Note, resizing, leaving, and restarting', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, [FOUR_TRADES[0]!, FOUR_TRADES[1]!, FOUR_TRADES[2]!]);
    await openReview(page);
    await enterMark(page, 'XYZ', DATE, '52.00');
    await enterMark(page, 'ABC', DATE, '27.50');
    await continueToTrades(page);
    await tradesFamily(page).getByRole('button', { name: 'Review XYZ' }).click();
    await expect(actionForm(page)).toBeVisible();
    const before = workspaceOf(await probe(page));

    // Type, and save nothing: an initial Mark price, a correction with its reason, and an Exit with Intent, Conviction, considered text, and Note.
    await markEntry(page, 'DEF', DATE).getByRole('button', { name: 'Enter', exact: true }).click();
    await markEntry(page, 'DEF', DATE).getByLabel('Price').fill(TYPED.markPrice);
    await markEntry(page, 'ABC', DATE).getByRole('button', { name: 'Correct' }).click();
    await markEntry(page, 'ABC', DATE).getByLabel('Price').fill(TYPED.correctedPrice);
    await markEntry(page, 'ABC', DATE).getByLabel('Reason (required)').fill(TYPED.reason);
    await actionForm(page).getByRole('radio', { name: 'Exit', exact: true }).check();
    await actionForm(page).getByLabel(/^Why are you taking this action\?/).fill(TYPED.intent);
    await actionForm(page).getByLabel('Conviction now').selectOption('4');
    await actionForm(page).getByLabel('Anything you considered doing and decided against?').fill(TYPED.considered);
    await actionForm(page).getByLabel(/^Note/).fill(TYPED.note);

    // Resize and back: the typed values are still there, none of them saved.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(markEntry(page, 'DEF', DATE).getByLabel('Price')).toHaveValue(TYPED.markPrice);
    await expect(markEntry(page, 'ABC', DATE).getByLabel('Price')).toHaveValue(TYPED.correctedPrice);
    await expect(markEntry(page, 'ABC', DATE).getByLabel('Reason (required)')).toHaveValue(TYPED.reason);
    await expect(actionForm(page).getByLabel(/^Why are you taking this action\?/)).toHaveValue(TYPED.intent);
    await expect(actionForm(page).getByLabel('Conviction now')).toHaveValue('4');
    await expect(actionForm(page).getByLabel(/^Note/)).toHaveValue(TYPED.note);
    expect(traces(await webStorage(page))).toEqual([]);
    expect(workspaceOf(await probe(page))).toEqual(before);

    // Navigate away (the Open list), then restart the browser.
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await expect(page.getByRole('table', { name: 'Open Trades' })).toBeVisible(READY);
    expect(traces(await webStorage(page))).toEqual([]);
    await context.close();

    const relaunched = await launchAt(profile, MONDAY_1700);
    const again = await firstPage(relaunched);
    await again.goto('/');
    await openReview(again);
    await expect(markEntry(again, 'DEF', DATE)).toContainText('Missing');
    await expect(markEntry(again, 'ABC', DATE)).toContainText('$27.50');
    const probed = await probe(again);
    const workspace = workspaceOf(probed)!;
    expect(workspace).toEqual(before);
    expect(observationsOf(workspace).map((o) => [o.instrumentKey, o.marks.map((m) => m.revisionNumber)])).toEqual([['ABC', [1]], ['XYZ', [1]]]);
    expect(actionEntriesOf(workspace)).toEqual([]);
    expect(traces({ indexedDB: probed, webStorage: await webStorage(again) })).toEqual([]);
    await relaunched.close();
  });
});
