// Shared support for the D1 browser suite (plan section 6.2): the release harness server on
// localhost:5175, persistent Chromium profiles, the read-only IndexedDB probe, and UI steps that
// drive the production screens.
import { test as base, chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { startReleaseServer, type ReleaseServer } from '../../tools/release-server.ts';
import { detail } from '../support/detail/index.ts';

export { expect };
// Every later suite's support re-exports this one, so each spec reads Trade Detail through these (plan section 6.3).
export { detail, eachDrawer, openDrawer } from '../support/detail/index.ts';

export const BASE_URL = 'http://localhost:5175';
export const ZONE = 'America/New_York';
// Two named waits. STEP is for a check in the middle of a test; it matches Playwright's own default of 5 s,
// so a plain expect needs no option and the name is used only where the default differs (clicks, element states).
// LAUNCH is the first sign of life after the app opens (launch, relaunch, reload, restore, an update or migration
// notice), when a release must claim the page first. Measured worst cases sit far below both.
export const STEP = { timeout: 5_000 };
export const LAUNCH = { timeout: 10_000 };

export interface Profile {
  readonly dir: string;
  // Launches the browser on this profile; closing the context is a full browser restart.
  launch(options?: { offline?: boolean; userAgent?: string; width?: number; touch?: boolean }): Promise<BrowserContext>;
}

// A saved setup (plan/setup-snapshot-plan.md): a state that many tests build through the screens, built once per worker and copied to each test that asks.
// `build` runs on an empty profile, leaves the app on the state, and returns its (still open) context and what the test needs to know about it (the Trade ids).
export interface Setup<T> {
  readonly name: string;
  readonly build: (profile: Profile) => Promise<{ context: BrowserContext; made: T }>;
}
export const defineSetup = <T>(name: string, build: Setup<T>['build']): Setup<T> => ({ name, build });

interface SavedSetups {
  // The setup's finished profile folder and what its build returned, built on first use on the release the asking test's server serves.
  saved<T>(setup: Setup<T>, server: ReleaseServer): Promise<{ dir: string; made: T }>;
}

export const test = base.extend<{ server: ReleaseServer; profile: Profile; copySetup: <T>(setup: Setup<T>) => Promise<T> }, { savedSetups: SavedSetups }>({
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
    // Every context the test launches is closed when the test ends, so a failure leaves no browser running
    // (closing a context the test already closed does nothing).
    const plain = profileAt(dir);
    const launched: BrowserContext[] = [];
    try {
      await provide({
        dir,
        launch: async (options) => {
          const context = await plain.launch(options);
          launched.push(context);
          return context;
        },
      });
    } finally {
      await Promise.all(launched.map((context) => context.close().catch(() => undefined)));
    }
  },
  // A test asks for a setup by name and gets a copy of its folder as its own profile, plus what the build returned. A test that asks for nothing keeps an empty profile.
  savedSetups: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring form.
    async ({}, provide, workerInfo) => {
      const root = path.join(workerInfo.project.outputDir, `saved-setups-${workerInfo.workerIndex}`);
      rmSync(root, { recursive: true, force: true });
      // Keyed by setup and release: a copy is only handed to a test serving the release it was built on.
      const built = new Map<string, Promise<{ dir: string; made: unknown; release: string }>>();
      await provide({
        saved: async <T>(setup: Setup<T>, server: ReleaseServer) => {
          const release = server.current();
          const key = `${setup.name}@${release}`;
          if (!built.has(key)) {
            built.set(key, (async () => {
              // Built through the asking test's own server, on the release it serves now (the server is not switched).
              const dir = path.join(root, release.replace(/\W+/g, '_'), setup.name);
              mkdirSync(dir, { recursive: true });
              // Every context the builder's profile launches is closed when the build ends, failed or not.
              const plain = profileAt(dir);
              const launched: BrowserContext[] = [];
              try {
                const { context, made } = await setup.build({
                  dir,
                  launch: async (options) => {
                    const opened = await plain.launch(options);
                    launched.push(opened);
                    return opened;
                  },
                });
                await context.close();
                return { dir, made, release: server.current() };
              } catch (cause) {
                // The failure is kept, not retried: each asking test fails at once naming the setup, where a retry would repeat a long build that already failed.
                throw new Error(`Saved setup "${setup.name}" failed to build: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
              } finally {
                await Promise.all(launched.map((opened) => opened.close().catch(() => undefined)));
              }
            })());
          }
          const { dir, made, release: builtOn } = await built.get(key)!;
          if (builtOn !== release) throw new Error(`Saved setup "${setup.name}" was built on ${builtOn} but this test serves ${release}`);
          return { dir, made: made as T };
        },
      });
      rmSync(root, { recursive: true, force: true });
    },
    { scope: 'worker', timeout: 120_000 },
  ],
  copySetup: async ({ profile, savedSetups, server }, provide) => {
    await provide(async <T>(setup: Setup<T>): Promise<T> => {
      const { dir, made } = await savedSetups.saved(setup, server);
      mkdirSync(profile.dir, { recursive: true });
      // An APFS clone of the finished folder, without Chromium's lock files.
      execFileSync('cp', ['-c', '-R', `${dir}/.`, profile.dir]);
      for (const lock of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) rmSync(path.join(profile.dir, lock), { force: true });
      return made;
    });
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
        ...(options.touch ? { hasTouch: true } : {}),
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
  await expect(page.getByRole('heading', { name: 'Start your journal' })).toBeVisible(LAUNCH);
  await page.getByLabel('Time zone').selectOption(ZONE);
  await page.getByRole('button', { name: 'Start my journal' }).click();
}

export async function onboard(page: Page, institution = 'Fidelity', account = 'Roth IRA'): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Add your brokerage account' })).toBeVisible();
  await page.getByLabel('Institution').fill(institution);
  await page.getByLabel('Account').fill(account);
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expectNoTradesYet(page);
}

// The Trades view opens on its Open tab (D2 A32); a direct navigation to the Planned list uses this.
export const PLANNED = '/?lifecycle=Planned';

export async function openPlanned(page: Page): Promise<void> {
  const tab = page.getByRole('tablist', { name: 'Trades by lifecycle' }).getByRole('tab', { name: 'Planned' });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

// A new Workspace's Trades view: the Open tab's Empty state, then the Planned tab's.
export async function expectNoTradesYet(page: Page): Promise<void> {
  await expect(page.getByText('No open trades. Recording an entry on a Planned Trade opens it.')).toBeVisible();
  await openPlanned(page);
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
  await expect(page.getByRole('heading', { name: 'New Plan' })).toBeVisible(LAUNCH);
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
  await expect(detail.heading(page, values.symbol)).toBeVisible();
}

// A fresh profile taken through first run and onboarding, left on the Trades page.
export async function onboardedPage(context: BrowserContext, query = ''): Promise<Page> {
  const page = await firstPage(context);
  await page.goto(`${BASE_URL}/${query}`);
  await startJournal(page);
  await onboard(page);
  return page;
}
