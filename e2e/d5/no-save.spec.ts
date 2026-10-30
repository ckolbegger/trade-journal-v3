import type { Page } from '@playwright/test';
import {
  AT_10, confirmReference, debtForm, debtsOf, declinesOf, deferEntry, enterMark, entriesWithSettledDebt, expect, fillDebtAnswers, fillRows, firstPage, launchAt, markAndOpenCard, MONDAY, MONDAY_1005, onboardedAt,
  openEntryForm, openReview, openTradeFromOpenList, probe, READY, reflectionSection, reflectionsOf, setClock, test, TUESDAY, TUESDAY_1700, tradesOf, workspaceOf, completeReflection, status,
} from './support.ts';

// Distinctive values, so any trace of them in storage is unmistakable.
const TYPED = { price: '43.71', fee: '3.17', entryNote: 'Unsaved entry note marker 4e17.', entryReason: 'Unsaved entry decline marker 8a03.', debtNote: 'Unsaved debt note marker 6c52.', debtReason: 'Unsaved debt decline marker 2b9d.' };
const TEXT = [TYPED.entryNote, TYPED.entryReason, TYPED.debtNote, TYPED.debtReason];
const NUMBERS = [TYPED.price, TYPED.fee];

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

test.describe('B5.11 Nothing saved without Save (AC-JOUR-001)', () => {
  test('should store no Position Change, Entry, decline, Debt change, or Web Storage value after typing in the entry form’s dispositions and a Debt answer, resizing, leaving, and restarting', async ({ profile }) => {
    const { context, page } = await onboardedAt(profile, MONDAY_1005);
    await confirmReference(page);
    await deferEntry(page, [AT_10]);
    await setClock(context, page, TUESDAY_1700);
    await openReview(page);
    await enterMark(page, 'XYZ', MONDAY, '52.00');
    await markAndOpenCard(page, 'XYZ', TUESDAY, '52.50');
    await expect(reflectionsOf(page, 'XYZ').getByText('Due', { exact: true })).toBeVisible();
    const before = workspaceOf(await probe(page));

    // A Debt answer: the required answers, a Note, and a decline reason, all unsaved; resize and back.
    await reflectionsOf(page, 'XYZ').getByRole('button', { name: /^Reflect on / }).click();
    await fillDebtAnswers(page);
    await debtForm(page).getByLabel('Note').fill(TYPED.debtNote);
    await debtForm(page).getByLabel('Reason for declining (optional)').fill(TYPED.debtReason);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(debtForm(page).getByLabel('Note')).toHaveValue(TYPED.debtNote);
    await expect(debtForm(page).getByLabel('Reason for declining (optional)')).toHaveValue(TYPED.debtReason);
    await expect(debtForm(page).getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned')).toBeChecked();
    expect(traces(await webStorage(page))).toEqual([]);
    expect(workspaceOf(await probe(page))).toEqual(before);

    // The entry form on the Trade: typed rows and answers, switched between Reflect now, Reflect later, and Decline.
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await openTradeFromOpenList(page);
    await openEntryForm(page);
    await fillRows(page, [{ quantity: '40', price: TYPED.price, fee: TYPED.fee, time: '2026-10-13T11:00' }]);
    const section = reflectionSection(page);
    await completeReflection(page);
    await section.getByLabel('Note').fill(TYPED.entryNote);
    await section.getByLabel('Reflect later').check();
    await section.getByLabel('Reflect now').check();
    await section.getByLabel('Decline to reflect').check();
    await page.getByLabel('Reason for declining (optional)').fill(TYPED.entryReason);
    await section.getByLabel('Reflect later').check();
    await section.getByLabel('Reflect now').check();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(traces(await webStorage(page))).toEqual([]);
    expect(workspaceOf(await probe(page))).toEqual(before);

    // Navigate away, then restart the browser.
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await expect(page.getByRole('table', { name: 'Open Trades' })).toBeVisible(READY);
    expect(traces(await webStorage(page))).toEqual([]);
    await context.close();

    const relaunched = await launchAt(profile, TUESDAY_1700);
    const again = await firstPage(relaunched);
    await again.goto('/');
    await openReview(again);
    await expect(status(again)).toBeVisible();
    const probed = await probe(again);
    const workspace = workspaceOf(probed)!;
    expect(workspace).toEqual(before);
    expect(debtsOf(workspace)).toHaveLength(1);
    expect(JSON.stringify(debtsOf(workspace)[0]!.versions.at(-1))).toContain('Outstanding');
    expect(entriesWithSettledDebt(workspace)).toEqual([]);
    expect(declinesOf(workspace)).toEqual([]);
    expect(tradesOf(workspace)).toHaveLength(1);
    expect(traces({ indexedDB: probed, webStorage: await webStorage(again) })).toEqual([]);
    await relaunched.close();
  });
});
