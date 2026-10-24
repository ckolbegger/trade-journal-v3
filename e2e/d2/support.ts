// Shared support for the D2 browser suite (plan section 6.2): D1's server and profile fixtures,
// read-only probe, and UI steps, plus the entry form, the previous-release update flow, browsers
// this suite can kill, and the integrity fixture writer.
import AxeBuilder from '@axe-core/playwright';
import { chromium, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { OfflineReleaseInventory } from '../../src/delivery/inventory.ts';
import { BASE_URL, expect, fillPlan, firstPage, PLAN, READY, startJournal, ZONE, type PlanValues, type ProbedDatabase } from '../d1/support.ts';

export * from '../d1/support.ts';

// The reference Plan (AC-PLAN-001: 100 @ 50, Stop 47.50, Target 56), dated so every entry below
// has a fixed, distinct Economic Time in the Workspace zone.
export const PLAN_TIME = '2026-10-12T09:30';

export interface Row {
  readonly quantity: string;
  readonly price: string;
  readonly fee: string;
  readonly time: string;
}

// B2.1's Position Change (average 50.10, fees 1.00) and B2.2's scale-in to 100 and then 120 shares:
// together the reference Trade of C2.1–C2.3.
export const PC1: readonly Row[] = [
  { quantity: '30', price: '50.00', fee: '0.50', time: '2026-10-12T10:00' },
  { quantity: '30', price: '50.20', fee: '0.50', time: '2026-10-12T10:01' },
];
export const PC2: readonly Row[] = [{ quantity: '40', price: '50.30', fee: '1.00', time: '2026-10-12T11:00' }];
export const PC3: readonly Row[] = [{ quantity: '20', price: '51.00', fee: '1.00', time: '2026-10-12T14:00' }];
// One row at the form's default time, for Plans confirmed at the current time.
export const NOW_ROW: readonly Row[] = [{ quantity: '60', price: '50.10', fee: '1.00', time: '' }];

const nav = (page: Page) => page.getByRole('navigation', { name: 'Primary' });

// Fills and confirms a Plan with a fixed Plan time, ending on its Trade Detail.
export async function confirmReference(page: Page, values: PlanValues = PLAN): Promise<void> {
  await nav(page).getByRole('link', { name: 'New Plan' }).click();
  await fillPlan(page, values);
  await page.getByLabel('Plan time').fill(PLAN_TIME);
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(page.getByRole('heading', { name: values.symbol, level: 1 })).toBeVisible();
}

export const executionRow = (page: Page, n: number): Locator => page.getByRole('group', { name: `Execution ${n}`, exact: true });
export const reflectionSection = (page: Page): Locator => page.getByRole('region', { name: 'Position Change Reflection' });

// From a Trade Detail, opens the entry form.
export async function openEntryForm(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Record entry' }).click();
  await expect(page.getByRole('heading', { name: 'Record entry', level: 1 })).toBeVisible(READY);
  await expect(executionRow(page, 1)).toBeVisible();
}

export async function fillRows(page: Page, rows: readonly Row[]): Promise<void> {
  for (const [index, row] of rows.entries()) {
    if (index > 0) await page.getByRole('button', { name: 'Add Execution' }).click();
    const group = executionRow(page, index + 1);
    await group.getByLabel('Quantity').fill(row.quantity);
    await group.getByLabel('Price').fill(row.price);
    await group.getByLabel('Fee').fill(row.fee);
    // An empty time keeps the form's default, now in the Workspace zone.
    if (row.time !== '') await group.getByLabel('Economic Time').fill(row.time);
  }
}

// The Position Change Reflection's required answers: As Planned, Calm, confidence 4.
export async function completeReflection(page: Page): Promise<void> {
  const section = reflectionSection(page);
  await section.getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned').check();
  await section.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Calm').check();
  await section.getByRole('radiogroup', { name: 'Decision confidence' }).getByLabel('4').check();
}

export async function declineReflection(page: Page, reason?: string): Promise<void> {
  await reflectionSection(page).getByLabel('Decline to reflect').check();
  if (reason !== undefined) await page.getByLabel('Reason for declining (optional)').fill(reason);
}

// From a Trade Detail: one Position Change with these rows, ending on its receipt.
export async function recordEntry(page: Page, rows: readonly Row[], reflection: { decline?: string | true } = {}): Promise<void> {
  await openEntryForm(page);
  await fillRows(page, rows);
  if (reflection.decline === undefined) await completeReflection(page);
  else await declineReflection(page, reflection.decline === true ? undefined : reflection.decline);
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByRole('heading', { name: 'Entry recorded' })).toBeVisible();
}

export async function backToTrade(page: Page, symbol = PLAN.symbol): Promise<void> {
  await page.getByRole('link', { name: 'Back to the Trade' }).click();
  await expect(page.getByRole('heading', { name: symbol, level: 1 })).toBeVisible();
}

// Opens a Trade's Detail from the Open list.
export async function openTradeFromOpenList(page: Page, symbol = PLAN.symbol): Promise<void> {
  await page.getByRole('table', { name: 'Open Trades' }).getByRole('link', { name: symbol }).click(READY);
  await expect(page.getByRole('heading', { name: symbol, level: 1 })).toBeVisible();
}

// ---- Stored records, read through the probe -------------------------------------------------

export interface StoredFact {
  readonly factId: string;
  readonly kind: string;
  readonly versions: readonly { readonly value: Record<string, unknown> }[];
}
export interface StoredTrade {
  readonly tradeId: string;
  readonly underlying: string;
  readonly lifecycle: string;
  readonly facts: readonly StoredFact[];
  readonly deviations?: readonly unknown[];
}

export const tradesOf = (workspace: ProbedDatabase): StoredTrade[] => workspace.stores['trades'] as StoredTrade[];
export const factsOf = (trade: StoredTrade, kind: string): StoredFact[] => trade.facts.filter((f) => f.kind === kind);
export const POSITION_CHANGE_REFLECTION = 'entry-type.position-change-reflection';
export const reflectionEntriesOf = (workspace: ProbedDatabase): unknown[] =>
  (workspace.stores['journalEntries'] as { entryTypeKey: string }[]).filter((e) => e.entryTypeKey === POSITION_CHANGE_REFLECTION);

// The root's current pointer and listed candidates.
export function rootOf(probed: Record<string, ProbedDatabase>): { current: string; candidates: unknown[] } {
  const root = probed['tj-root']!;
  const pointer = (root.stores['pointer'] as { key: string; databaseName?: string }[]).find((p) => p.key === 'current');
  return { current: pointer?.databaseName ?? '', candidates: root.stores['candidates'] ?? [] };
}

// A record without the persistence write stamp `revision`, which a database assigns on every write
// and a migration's copy therefore renumbers.
export const withoutStamps = (records: unknown[] | undefined): unknown[] =>
  (records ?? []).map((record) => {
    const { revision, ...rest } = record as Record<string, unknown>;
    void revision;
    return rest;
  });

export const workspaceNames = (probed: Record<string, ProbedDatabase>): string[] => Object.keys(probed).filter((name) => name.startsWith('tj-ws-'));

// ---- The previous release and its update notice ---------------------------------------------

export const identity = (release: string): string =>
  (JSON.parse(readFileSync(`dist-releases/${release}/inventory.json`, 'utf8')) as OfflineReleaseInventory).releaseId;

// First run and onboarding on the D1 release, whose Trades view is the Planned list only.
export async function onboardedD1Page(context: BrowserContext, query = ''): Promise<Page> {
  const page = await firstPage(context);
  await page.goto(`${BASE_URL}/${query}`);
  await startJournal(page);
  await expect(page.getByRole('heading', { name: 'Add your brokerage account' })).toBeVisible(READY);
  await page.getByLabel('Institution').fill('Fidelity');
  await page.getByLabel('Account').fill('Roth IRA');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByText('No planned trades yet')).toBeVisible();
  return page;
}

// Confirms a Plan on the D1 release, which has the same Plan form.
export async function confirmD1Plan(page: Page, values: PlanValues): Promise<void> {
  await nav(page).getByRole('link', { name: 'New Plan' }).click();
  await fillPlan(page, values);
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(page.getByRole('heading', { name: values.symbol, level: 1 })).toBeVisible();
}

export const SECOND_PLAN: PlanValues = { ...PLAN, symbol: 'ABC', thesis: 'Second Plan thesis.', invalidation: 'Second Plan invalidation.' };

// Asks the browser to look for a newer release, as "Check for updates" does, and waits for the
// attempt to settle (installed and waiting, or discarded).
export function checkForUpdate(page: Page): Promise<{ waiting: string | null }> {
  return page.evaluate(async () => {
    const registration = (await navigator.serviceWorker.getRegistration())!;
    await registration.update().catch(() => undefined);
    for (let i = 0; i < 100 && registration.installing; i++) await new Promise((resolve) => setTimeout(resolve, 100));
    return { waiting: registration.waiting?.state ?? null };
  });
}

export const notice = (page: Page): Locator => page.getByRole('region', { name: 'Update' });

// Presses Reload in the update notice and waits for the reloaded document.
export async function reloadFromNotice(page: Page): Promise<void> {
  await expect(notice(page)).toContainText('An update is ready');
  const loaded = page.waitForEvent('load');
  await notice(page).getByRole('button', { name: 'Reload' }).click();
  await loaded;
}

// Records, in every document of the context, whether the migration message was ever rendered:
// it may show for only a few milliseconds. The observer reads the DOM and changes nothing.
export async function watchForUpdatingMessage(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const w = window as unknown as { __tjSeenUpdating?: boolean };
    w.__tjSeenUpdating = false;
    new MutationObserver(() => {
      if (document.body?.textContent?.includes('Updating your journal to this release')) w.__tjSeenUpdating = true;
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
}

export const sawUpdatingMessage = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as unknown as { __tjSeenUpdating?: boolean }).__tjSeenUpdating === true);

// ---- Browsers this suite kills --------------------------------------------------------------

export interface KillableBrowser {
  readonly context: BrowserContext;
  kill(): Promise<void>;
}

// A Chromium process this test owns (default features, new headless mode), so it can be killed
// outright rather than closed. A killed profile is relaunched the same way, since a browser
// spawned with default features uses a different IndexedDB backend from a Playwright launch.
export async function spawnedBrowser(dir: string, port: number): Promise<KillableBrowser> {
  // A killed browser restores its last tabs on the next start, which would rerun the killed tab's
  // URL (and its faults) beside the case's own page. Removing the browser's saved session and
  // marking the last exit clean prevents that; only the browser's own profile files change, never
  // the app's storage.
  rmSync(path.resolve(dir, 'Default', 'Sessions'), { recursive: true, force: true });
  const preferences = path.resolve(dir, 'Default', 'Preferences');
  if (existsSync(preferences)) {
    const prefs = JSON.parse(readFileSync(preferences, 'utf8')) as { profile?: Record<string, unknown> };
    prefs.profile = { ...prefs.profile, exit_type: 'Normal', exited_cleanly: true };
    writeFileSync(preferences, JSON.stringify(prefs));
  }
  const child = spawn(
    chromium.executablePath(),
    [
      '--headless=new',
      `--user-data-dir=${path.resolve(dir)}`,
      `--remote-debugging-port=${port}`,
      '--window-size=1280,900',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: 'ignore', env: { ...process.env, TZ: ZONE } },
  );
  let browser;
  for (let attempt = 0; !browser && attempt < 50; attempt++) {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`).catch(() => undefined);
    if (!browser) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!browser) throw new Error('could not connect to the browser');
  return {
    context: browser.contexts()[0]!,
    kill: async () => {
      if (child.exitCode !== null) return;
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill('SIGKILL');
      await exited;
    },
  };
}

// ---- Integrity fixture writer (D2 section 6.0) ----------------------------------------------

export type FixtureEdit =
  // AC-LIFE-003 (B2.13): the Trade's stored lifecycle no longer matches its facts.
  | { readonly kind: 'StoredLifecycle'; readonly underlying: string; readonly lifecycle: string }
  // A Position Change naming an Execution that does not exist, so the Trade cannot be read at all.
  | { readonly kind: 'MissingMember'; readonly underlying: string };

// Edits raw stored records of the profile's current Workspace while the application is not
// running: the browser is launched with service workers blocked on a blank page of the app's
// origin, so no application code runs, and closed again before the case launches the app.
export async function writeIntegrityFixture(dir: string, edit: FixtureEdit): Promise<void> {
  const context = await chromium.launchPersistentContext(path.resolve(dir), { channel: 'chromium', serviceWorkers: 'block' });
  const page = await firstPage(context);
  await page.route(`${BASE_URL}/__fixture`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>fixture</title>' }));
  await page.goto(`${BASE_URL}/__fixture`);
  await page.evaluate(async (change: FixtureEdit) => {
    const request = <T>(r: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error ?? new Error('fixture failed'));
      });
    const open = (name: string) => request(indexedDB.open(name));
    const root = await open('tj-root');
    const pointer = (await request(root.transaction('pointer').objectStore('pointer').get('current'))) as { databaseName: string };
    root.close();
    const db = await open(pointer.databaseName);
    const tx = db.transaction('trades', 'readwrite');
    const store = tx.objectStore('trades');
    const trades = (await request(store.getAll())) as {
      underlying: string;
      lifecycle: string;
      facts: { kind: string; versions: { value: { memberIds: string[] } }[] }[];
    }[];
    const trade = trades.find((t) => t.underlying === change.underlying);
    if (!trade) throw new Error(`no stored Trade for ${change.underlying}`);
    if (change.kind === 'StoredLifecycle') trade.lifecycle = change.lifecycle;
    else trade.facts.find((f) => f.kind === 'PositionChange')!.versions[0]!.value.memberIds.push('fixture-missing-execution');
    await request(store.put(trade));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('fixture failed'));
    });
    db.close();
  }, edit);
  await context.close();
}

// ---- Accessibility and keyboard steps (as in D1's B1.15) ------------------------------------

export async function expectAccessible(page: Page, state: string): Promise<void> {
  // @axe-core/playwright types its page against its own playwright-core copy; the object is the same.
  const results = await new AxeBuilder({ page } as unknown as ConstructorParameters<typeof AxeBuilder>[0])
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    state,
  ).toEqual([]);
}

// Presses Tab until the target has focus, checking that every focused element shows a focus ring.
export async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let presses = 0; presses < 120; presses++) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      const style = element ? getComputedStyle(element) : undefined;
      const name = element?.getAttribute('name') ?? element?.getAttribute('type') ?? element?.textContent?.slice(0, 30);
      return { visible: !!style && style.outlineStyle !== 'none' && style.outlineWidth !== '0px', tag: `${element?.tagName} ${name}` };
    });
    expect(focus.visible, `focus ring on ${focus.tag}`).toBe(true);
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error('target never received focus');
}

// Holds the Workspace's `trades` store behind a read-write transaction that only reads, so a list
// read waits and its Loading state stays on screen until `releaseTradesStore`. Nothing is written.
export async function holdTradesStore(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const request = <T>(r: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error ?? new Error('hold failed'));
      });
    const root = await request(indexedDB.open('tj-root'));
    const pointer = (await request(root.transaction('pointer').objectStore('pointer').get('current'))) as { databaseName: string };
    root.close();
    const db = await request(indexedDB.open(pointer.databaseName));
    const w = window as unknown as { __tjHold?: boolean };
    w.__tjHold = true;
    const store = db.transaction('trades', 'readwrite').objectStore('trades');
    store.transaction.oncomplete = () => db.close();
    // Each read keeps the transaction active; the transaction ends once the reads stop.
    const spin = () => {
      if (w.__tjHold) store.count().onsuccess = spin;
    };
    spin();
  });
}

export async function releaseTradesStore(page: Page): Promise<void> {
  await page.evaluate(() => ((window as unknown as { __tjHold?: boolean }).__tjHold = false));
}
