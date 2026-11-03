import type { Page } from '@playwright/test';
import {
  answerCloseReviewIn, answerIn, closeReasonGroup, closeReviewGroup, closingSection, createTA, debtsOf, declinesOf, entriesWithSettledDebt, executionRow, exitReflection, expect, factsOf, fillRows,
  firstPage, launchAt, MONDAY_1700, onboardedAt, openExitForm, openTradeFromOpenList, probe, READY, sell, test, tradesOf, TUESDAY_1405, TUESDAY_1405_LOCAL, workspaceOf,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// Distinctive values, so any trace of them in storage is unmistakable.
const TYPED = {
  price: '53.17',
  fee: '3.17',
  exitNote: 'Unsaved exit note marker 7d41.',
  exitReason: 'Unsaved exit decline marker 1f86.',
  closeReason: 'Unsaved close review decline marker 9e03.',
};
const TEXT = [TYPED.exitNote, TYPED.exitReason, TYPED.closeReason];
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

test.describe('B6.11 Nothing saved without Save (AC-JOUR-001)', () => {
  test('should store no Position Change, Close Reason, Entry, decline, Debt, or Web Storage value after typing a full exit with a Close Reason and both reflections, resizing, leaving, and restarting', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context: setup, page: setupPage } = await onboardedAt(profile, MONDAY_1700);
    await createTA(setupPage);
    await setup.close();

    const context = await launchAt(profile, TUESDAY_1405);
    const page = await firstPage(context);
    await page.goto('/');
    await openTradeFromOpenList(page, 'XYZ');
    const before = workspaceOf(await probe(page));

    // A full exit with the Close Reason and both reflections answered, plus a Note on each, all unsaved.
    await openExitForm(page);
    await fillRows(page, [sell('100', TYPED.price, TYPED.fee, TUESDAY_1405_LOCAL)]);
    await answerIn(exitReflection(page));
    await exitReflection(page).getByLabel('Note').fill(TYPED.exitNote);
    await expect(closingSection(page)).toBeVisible();
    await closeReasonGroup(page).getByLabel('Target Reached', { exact: true }).check();
    await answerCloseReviewIn(closingSection(page));

    // Switch both dispositions through Reflect later and Decline (typing a reason) and back to Reflect now.
    await exitReflection(page).getByLabel('Reflect later').check();
    await exitReflection(page).getByLabel('Decline to reflect').check();
    await page.getByLabel('Reason for declining (optional)').fill(TYPED.exitReason);
    await exitReflection(page).getByLabel('Reflect now').check();
    await closeReviewGroup(page).getByLabel('Reflect later').check();
    await closeReviewGroup(page).getByLabel('Decline to reflect').check();
    await page.getByLabel('Reason for declining the Close Review (optional)').fill(TYPED.closeReason);
    await closeReviewGroup(page).getByLabel('Reflect now').check();

    // Resize to 390 px and back: the values stay, and nothing is stored.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(executionRow(page, 1).getByLabel('Price')).toHaveValue(TYPED.price);
    await expect(exitReflection(page).getByLabel('Note')).toHaveValue(TYPED.exitNote);
    await expect(closeReasonGroup(page).getByLabel('Target Reached', { exact: true })).toBeChecked();
    await expect(closingSection(page).getByLabel('Yes, as planned')).toBeChecked();
    expect(traces(await webStorage(page))).toEqual([]);
    expect(workspaceOf(await probe(page))).toEqual(before);

    // Navigate away without saving, then restart the browser.
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await expect(page.getByRole('table', { name: 'Open Trades' })).toBeVisible(READY);
    expect(traces(await webStorage(page))).toEqual([]);
    expect(workspaceOf(await probe(page))).toEqual(before);
    await context.close();

    const relaunched = await launchAt(profile, TUESDAY_1405);
    const again = await firstPage(relaunched);
    await again.goto('/');
    await expect(again.getByRole('table', { name: 'Open Trades' })).toBeVisible(READY);
    const probed = await probe(again);
    const workspace = workspaceOf(probed)!;
    expect(workspace).toEqual(before);
    const [trade] = tradesOf(workspace);
    expect(trade!.lifecycle).toBe('Open');
    expect(factsOf(trade!, 'Execution').filter((f) => f.versions.at(-1)!.value['action'] === 'Sell')).toEqual([]);
    expect(factsOf(trade!, 'PositionChange')).toHaveLength(2);
    expect((trade as unknown as { closeReasonFacts?: unknown[] }).closeReasonFacts ?? []).toEqual([]);
    expect(debtsOf(workspace)).toEqual([]);
    expect(entriesWithSettledDebt(workspace)).toEqual([]);
    expect(declinesOf(workspace)).toEqual([]);
    expect(traces({ indexedDB: probed, webStorage: await webStorage(again) })).toEqual([]);
    await relaunched.close();
  });
});
