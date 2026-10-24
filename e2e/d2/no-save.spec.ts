import type { Page } from '@playwright/test';
import {
  completeReflection,
  confirmReference,
  executionRow,
  fillRows,
  expect,
  factsOf,
  firstPage,
  onboardedPage,
  openEntryForm,
  PC2,
  PC3,
  probe,
  recordEntry,
  READY,
  reflectionEntriesOf,
  reflectionSection,
  test,
  tradesOf,
  workspaceOf,
} from './support.ts';

// Distinctive values, so any trace of them in storage is unmistakable.
const TYPED = { quantity: '37', price: '43.71', fee: '0.37', quantity2: '29', price2: '43.93', note: 'Unsaved entry note marker 5d8e.' };

// Free text is distinctive enough to search for inside any stored string. The numbers are short,
// so they are matched only as whole values (as in D1's B1.14).
const TEXT = [TYPED.note];
const NUMBERS = [TYPED.quantity, TYPED.price, TYPED.fee, TYPED.quantity2, TYPED.price2];

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

test.describe('B2.11 nothing saved without Save', () => {
  test('should store no Position Change, Entry, decline, draft, or Web Storage value after filling rows and the reflection, resizing, leaving, and restarting', async ({
    server,
    profile,
  }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmReference(page);
    const before = workspaceOf(await probe(page));

    await openEntryForm(page);
    const first = executionRow(page, 1);
    await first.getByLabel('Quantity').fill(TYPED.quantity);
    await first.getByLabel('Price').fill(TYPED.price);
    await first.getByLabel('Fee').fill(TYPED.fee);
    await page.getByRole('button', { name: 'Add Execution' }).click();
    const second = executionRow(page, 2);
    await second.getByLabel('Quantity').fill(TYPED.quantity2);
    await second.getByLabel('Price').fill(TYPED.price2);
    await second.getByLabel('Fee').fill(TYPED.fee);
    const reflection = reflectionSection(page);
    await reflection.getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('Reactive').check();
    await reflection.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('FOMO').check();
    await reflection.getByRole('radiogroup', { name: 'Decision confidence' }).getByLabel('2').check();
    await reflection.getByLabel('Note').fill(TYPED.note);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Trades' }).click();
    await expect(page.getByText('No open trades. Recording an entry on a Planned Trade opens it.')).toBeVisible();
    expect(traces(await webStorage(page))).toEqual([]);
    await context.close();

    const relaunched = await profile.launch();
    const again = await firstPage(relaunched);
    await again.goto('/');
    await expect(again.getByText('No open trades. Recording an entry on a Planned Trade opens it.')).toBeVisible(READY);
    const probed = await probe(again);
    const workspace = workspaceOf(probed)!;
    expect(factsOf(tradesOf(workspace)[0]!, 'PositionChange')).toEqual([]);
    expect(factsOf(tradesOf(workspace)[0]!, 'Execution')).toEqual([]);
    expect(reflectionEntriesOf(workspace)).toEqual([]);
    expect(workspace.stores['journalDeclines']).toEqual([]);
    expect(workspace).toEqual(before);
    expect(traces({ indexedDB: probed, webStorage: await webStorage(again) })).toEqual([]);
    await relaunched.close();
  });
});

test.describe('F4 saving again after a Conflict', () => {
  test('should keep the entered values through Load the latest Trade and then record a second Position Change, one from each page', async ({
    server,
    profile,
  }) => {
    void server;
    const context = await profile.launch();
    const pageA = await onboardedPage(context);
    await confirmReference(pageA);
    const detail = pageA.url();
    await openEntryForm(pageA);
    await fillRows(pageA, PC3);
    await completeReflection(pageA);

    // Page B records an entry while page A's form is open.
    const pageB = await context.newPage();
    await pageB.goto(detail);
    await recordEntry(pageB, PC2);

    await pageA.getByRole('button', { name: 'Save entry' }).click();
    const conflict = pageA.getByRole('region', { name: 'This Trade changed after you opened this form' });
    await expect(conflict).toBeVisible(READY);
    await conflict.getByRole('button', { name: 'Load the latest Trade' }).click();
    const latest = pageA.getByRole('region', { name: 'Latest Trade' });
    await expect(latest).toContainText('40 shares of XYZ');
    await expect(conflict).toHaveCount(0);
    const first = executionRow(pageA, 1);
    await expect(first.getByLabel('Quantity')).toHaveValue(PC3[0]!.quantity);
    await expect(first.getByLabel('Price')).toHaveValue(PC3[0]!.price);
    await expect(first.getByLabel('Economic Time')).toHaveValue(PC3[0]!.time);

    await pageA.getByRole('button', { name: 'Save entry' }).click();
    await expect(pageA.getByRole('heading', { name: 'Entry recorded' })).toBeVisible(READY);
    const workspace = workspaceOf(await probe(pageA))!;
    const changes = factsOf(tradesOf(workspace)[0]!, 'PositionChange');
    expect(changes).toHaveLength(2);
    const quantities = factsOf(tradesOf(workspace)[0]!, 'Execution').map((fact) => fact.versions.at(-1)!.value['quantity']);
    expect(quantities.sort()).toEqual(['20', '40']);
    expect(reflectionEntriesOf(workspace)).toHaveLength(2);
    await context.close();
  });
});
