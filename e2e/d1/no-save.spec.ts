import type { Page } from '@playwright/test';
import { expect, fillPlan, firstPage, onboardedPage, probe, READY, test, workspaceOf, type PlanValues } from './support.ts';

// Distinctive values, so any trace of them in storage is unmistakable.
const TYPED: PlanValues = {
  symbol: 'QZXW',
  quantity: '317',
  entry: '41.37',
  stop: '39.11',
  target: '47.93',
  thesis: 'Unsaved thesis marker 7f3a.',
  invalidation: 'Unsaved invalidation marker 9c1d.',
};

// Free text is distinctive enough to search for inside any stored string. The numbers are short,
// so they are matched only as whole values: a substring check false-matched a random UUID.
const TEXT = [TYPED.symbol, TYPED.thesis, TYPED.invalidation];
const NUMBERS = [TYPED.quantity, TYPED.entry, TYPED.stop, TYPED.target];

function webStorage(page: Page): Promise<unknown> {
  return page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
}

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

test.describe('B1.14 nothing is saved without Save', () => {
  test('should store no Entry, Trade, draft, or Web Storage value after typing, resizing, leaving, and restarting', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    const before = workspaceOf(await probe(page));
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'New Plan' }).click();
    await fillPlan(page, TYPED);
    await page.getByRole('combobox', { name: 'Account' }).selectOption({ index: 0 });
    await page.getByRole('combobox', { name: 'Strategy' }).selectOption({ index: 0 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await expect(page.getByText('No planned trades yet')).toBeVisible();
    expect(traces(await webStorage(page))).toEqual([]);
    await context.close();

    const relaunched = await profile.launch();
    const again = await firstPage(relaunched);
    await again.goto('/');
    await expect(again.getByText('No planned trades yet')).toBeVisible(READY);
    const probed = await probe(again);
    const workspace = workspaceOf(probed)!;
    expect(workspace.stores['trades']).toEqual([]);
    expect(workspace.stores['journalEntries']).toEqual([]);
    expect(workspace).toEqual(before);
    expect(traces({ indexedDB: probed, webStorage: await webStorage(again) })).toEqual([]);
    await relaunched.close();
  });
});
