// Shared support for the D1 browser suite (plan section 6.2): the release harness server on
// localhost:5175, persistent Chromium profiles, the read-only IndexedDB probe, and UI steps that
// drive the production screens.
import { test as base, chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import { startReleaseServer, type ReleaseServer } from '../../tools/release-server.ts';

export { expect };

export const BASE_URL = 'http://localhost:5175';
export const ZONE = 'America/New_York';
// Readiness waits for the first release to claim the page, so first launches take a moment.
export const READY = { timeout: 20_000 };

export interface Profile {
  readonly dir: string;
  // Launches the browser on this profile; closing the context is a full browser restart.
  launch(options?: { offline?: boolean; userAgent?: string; width?: number }): Promise<BrowserContext>;
}

export const test = base.extend<{ server: ReleaseServer; profile: Profile }>({
  // Routine cases serve the faults build (P2); update cases switch to the harness releases.
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring form.
  server: async ({}, provide) => {
    const server = await startReleaseServer({ root: process.cwd(), release: 'dist-faults' });
    await provide(server);
    await server.close();
  },
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring form.
  profile: async ({}, provide, info) => {
    const dir = info.outputPath('profile');
    await provide(profileAt(dir));
  },
});

export function profileAt(dir: string): Profile {
  return {
    dir,
    launch: (options = {}) =>
      // The full Chromium build in new headless mode, the same binary a killed browser used.
      chromium.launchPersistentContext(path.resolve(dir), {
        channel: 'chromium',
        baseURL: BASE_URL,
        timezoneId: ZONE,
        viewport: { width: options.width ?? 1280, height: 900 },
        offline: options.offline ?? false,
        ...(options.userAgent ? { userAgent: options.userAgent } : {}),
      }),
  };
}

export async function firstPage(context: BrowserContext): Promise<Page> {
  return context.pages()[0] ?? (await context.newPage());
}

// The plain-language explanation the shell shows for each failed readiness check.
export const EXPLANATION = {
  diagnostic: 'This browser could not complete a test save and read-back of its storage.',
  capacity: 'There is not enough storage space available in this browser for your journal and its safety margin.',
  control: "The app's offline component is not in control of this page yet.",
  inventory: "The app's offline copy is missing or damaged, so it could not reopen without a network.",
} as const;
export type Check = keyof typeof EXPLANATION;

// B1.5 and B1.6: each check singly, then two together.
export const FAULT_SETS: readonly (readonly Check[])[] = [['diagnostic'], ['capacity'], ['control'], ['inventory'], ['diagnostic', 'capacity'], ['control', 'inventory']];

export interface ProbedDatabase {
  readonly version: number;
  readonly stores: Record<string, unknown[]>;
  // Primary keys in each index, by "store.index".
  readonly indexes: Record<string, unknown[]>;
}

// The read-only probe: reads every existing database with the raw API and never writes. It opens
// only databases that already exist, so it cannot create one.
export function probe(page: Page): Promise<Record<string, ProbedDatabase>> {
  return page.evaluate(async () => {
    const out: Record<string, { version: number; stores: Record<string, unknown[]>; indexes: Record<string, unknown[]> }> = {};
    const request = <T>(r: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error ?? new Error('probe read failed'));
      });
    for (const { name } of await indexedDB.databases()) {
      if (!name) continue;
      const db = await request(indexedDB.open(name));
      const entry = { version: db.version, stores: {} as Record<string, unknown[]>, indexes: {} as Record<string, unknown[]> };
      for (const storeName of Array.from(db.objectStoreNames)) {
        const store = db.transaction(storeName, 'readonly').objectStore(storeName);
        entry.stores[storeName] = await request(store.getAll());
        for (const indexName of Array.from(store.indexNames)) {
          const index = db.transaction(storeName, 'readonly').objectStore(storeName).index(indexName);
          entry.indexes[`${storeName}.${indexName}`] = await request(index.getAllKeys());
        }
      }
      db.close();
      out[name] = entry;
    }
    return out;
  });
}

export function workspaceOf(probed: Record<string, ProbedDatabase>): ProbedDatabase | undefined {
  return Object.entries(probed).find(([name]) => name.startsWith('tj-ws-'))?.[1];
}

// First run: accept the proposed zone.
export async function startJournal(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Start your journal' })).toBeVisible(READY);
  await page.getByLabel('Time zone').selectOption(ZONE);
  await page.getByRole('button', { name: 'Start my journal' }).click();
}

export async function onboard(page: Page, institution = 'Fidelity', account = 'Roth IRA'): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Add your brokerage account' })).toBeVisible(READY);
  await page.getByLabel('Institution').fill(institution);
  await page.getByLabel('Account').fill(account);
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByText('No planned trades yet')).toBeVisible();
}

export interface PlanValues {
  readonly symbol: string;
  readonly quantity: string;
  readonly entry: string;
  readonly stop: string;
  readonly target: string;
  readonly thesis: string;
  readonly invalidation: string;
}

// AC-PLAN-001's Long Stock Plan: 100 @ 50, Stop 47.50, Target 56.
export const PLAN: PlanValues = {
  symbol: 'XYZ',
  quantity: '100',
  entry: '50',
  stop: '47.50',
  target: '56',
  thesis: 'Breakout above the 50-day on volume.',
  invalidation: 'A close back below 48.',
};

export async function fillPlan(page: Page, values: PlanValues = PLAN): Promise<void> {
  await expect(page.getByRole('heading', { name: 'New Plan' })).toBeVisible(READY);
  await page.getByLabel('Symbol').fill(values.symbol);
  await page.getByLabel('Quantity').fill(values.quantity);
  await page.getByLabel('Intended entry').fill(values.entry);
  await page.getByLabel('Stop').fill(values.stop);
  await page.getByLabel('Target').fill(values.target);
  await page.getByLabel('Why this trade, why now?').fill(values.thesis);
  await page.getByLabel('What would invalidate the thesis?').fill(values.invalidation);
  await page.getByRole('radiogroup', { name: 'Conviction' }).getByLabel('4').check();
  await page.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Calm').check();
}

// Fills and confirms a Plan, ending on its Trade Detail.
export async function confirmPlan(page: Page, values: PlanValues = PLAN): Promise<void> {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'New Plan' }).click();
  await fillPlan(page, values);
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(page.getByRole('heading', { name: values.symbol, level: 1 })).toBeVisible();
}

// A fresh profile taken through first run and onboarding, left on the Trades page.
export async function onboardedPage(context: BrowserContext, query = ''): Promise<Page> {
  const page = await firstPage(context);
  await page.goto(`${BASE_URL}/${query}`);
  await startJournal(page);
  await onboard(page);
  return page;
}
