// Shared support for the D8 browser suite (plan section 6.2): D8P's helpers (which re-export D7S's and the earlier folders'), whose test fixture serves the
// faults build (every hook stays inert unless a case asks for `?faults=`), and the steps the Backup and Restore cases share: real downloads saved with
// `download.saveAs`, file selection through the browser's own file chooser, the test's own reading of a saved artifact (gunzip and SHA-256), the artifact
// fixture writer for R-flip and R-new (section 6.0), and the raw-database loader that writes a frozen Workspace dump into a fresh profile (B8.9).
import { chromium, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { BASE_URL, confirmReference, expect, firstPage, MONDAY_1005, onboardedAt, PLAN, LAUNCH, test, type PlanValues, type ProbedDatabase, type Profile } from '../d8p/support.ts';

export * from '../d8p/support.ts';

// The frozen schema-7 backup and the schema-5 Workspace dump (T8.17), used wherever a case needs a valid file or a stored older journal.
export const FIXTURE_BACKUP = 'tests/fixtures/backup-v7/backup.tjbackup';
export const FIXTURE_V5_DUMP = 'tests/fixtures/workspace-v5/dump.json';

// A scratch path for a file the case saves or writes, inside the case's own output folder.
export const scratch = (name: string): string => test.info().outputPath(name);

export const primaryNav = (page: Page): Locator => page.getByRole('navigation', { name: 'Primary' });

// Opens the Backup page from the wide sidebar (A144) and waits for its heading.
export async function openBackup(page: Page): Promise<void> {
  await primaryNav(page).getByRole('link', { name: 'Backup' }).click();
  await expect(page.getByRole('heading', { name: 'Backup', level: 1 })).toBeVisible(LAUNCH);
}

// The Backup page's two sections, and the Restore confirmation step's inline safety backup.
export const downloadSection = (page: Page): Locator => page.getByRole('region', { name: 'Download a backup' });
export const restoreSection = (page: Page): Locator => page.getByRole('region', { name: 'Restore from a backup' });
export const safetyBackup = (page: Page): Locator => page.getByRole('radiogroup', { name: 'Safety backup' });

// Clicks Download backup in the scope, saves the offered file at `saveTo`, and returns its suggested name.
export async function downloadBackup(page: Page, saveTo: string, scope: Locator = downloadSection(page)): Promise<string> {
  const [download] = await Promise.all([page.waitForEvent('download'), scope.getByRole('button', { name: 'Download backup' }).click()]);
  await download.saveAs(saveTo);
  return download.suggestedFilename();
}

// Runs the action that opens the browser's file chooser (a click or a key press) and supplies the file.
export async function chooseFile(page: Page, act: () => Promise<void>, file: string): Promise<void> {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), act()]);
  await chooser.setFiles(file);
}

// Verify backup (or Choose another file) with the saved file.
export async function verifyWith(page: Page, file: string, scope: Locator = downloadSection(page)): Promise<void> {
  const button = scope.getByRole('button', { name: /^(Verify backup|Choose another file)$/ });
  await chooseFile(page, () => button.click(), file);
}

// "Backup complete. Checked Fri Oct 16, 18:00." in the scope (the time is in the Workspace zone, convention C4).
export const completeLine = (scope: Locator | Page): Locator => scope.getByText(/^Backup complete\. Checked \w{3} \w{3} \d{1,2}, \d{2}:\d{2}\.$/);

export const DOWNLOADED_NOT_VERIFIED = "Downloaded, not verified yet. This app can't see where your browser saved the file.";

// ---- The test's own reading of a saved artifact --------------------------------------------

export interface SavedArtifact {
  readonly gzip: boolean;
  readonly lines: readonly string[];
  readonly header: { readonly createdAt: string; readonly schemaVersion: number; readonly kind: string; readonly exportKind: string };
  readonly manifest: { readonly fullDigest: string; readonly kind: string; readonly counts: Record<string, number> };
}

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

export function readSaved(file: string): SavedArtifact {
  const bytes = readFileSync(file);
  const gzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const lines = (gzip ? gunzipSync(bytes) : bytes).toString('utf8').split('\n');
  expect(lines.pop(), 'the file ends with a line feed').toBe('');
  return { gzip, lines, header: JSON.parse(lines[0]!) as SavedArtifact['header'], manifest: JSON.parse(lines.at(-1)!) as SavedArtifact['manifest'] };
}

// SHA-256 over every line before the manifest, each with its line feed (A123).
export const fullDigestOf = (artifact: SavedArtifact): string => sha256(artifact.lines.slice(0, -1).map((line) => `${line}\n`).join(''));

// R-flip: one stored value changed with no digest recomputed, so the artifact contradicts its own checksums.
export function writeFlipped(from: string, to: string): void {
  const text = (readSaved(from).lines.join('\n') + '\n').replace('"label":"Long Stock"', '"label":"Long Stockx"');
  expect(text, 'the flip changed a record').not.toBe(readSaved(from).lines.join('\n') + '\n');
  writeFileSync(to, text);
}

// R-new: an otherwise valid artifact whose header claims a schema newer than this release's.
export function writeNewer(from: string, to: string): void {
  const lines = [...readSaved(from).lines];
  const header = JSON.parse(lines[0]!) as { schemaVersion: number };
  lines[0] = JSON.stringify({ ...header, schemaVersion: header.schemaVersion + 1 });
  writeFileSync(to, lines.join('\n') + '\n');
}

// A truncated copy of a saved file: the first half of its bytes.
export function writeTruncated(from: string, to: string): void {
  const bytes = readFileSync(from);
  writeFileSync(to, bytes.subarray(0, Math.floor(bytes.length / 2)));
}

// ---- Profiles ------------------------------------------------------------------------------

// The Restore flow's steps (A142), on the Backup page and on the first-run screen alike.
export const WARNING = 'If this backup is wrong or incomplete, your current journal cannot be recovered.';
export const understood = (page: Page): Locator => page.getByLabel('I understand this replaces my entire current journal');
export const replaceEntire = (page: Page): Locator => page.getByRole('button', { name: 'Replace entire journal' });
export const restoreComplete = (page: Page): Locator => page.getByRole('heading', { name: 'Restore complete' });
export const confirmStep = (page: Page): Locator => page.locator('.restore-confirm');

export async function chooseRestoreFile(page: Page, file: string): Promise<void> {
  await chooseFile(page, () => page.getByRole('button', { name: 'Choose backup file' }).click(), file);
  await expect(page.getByRole('heading', { name: 'Restoring replaces your entire current journal' })).toBeVisible(LAUNCH);
}

// Replace without a backup, with its warning acknowledged.
export async function declineSafetyBackup(page: Page): Promise<void> {
  await page.getByRole('radio', { name: 'Replace without a backup' }).check();
  await page.getByRole('checkbox', { name: WARNING }).check();
}

// Back up this journal first: download inside the confirmation step, save, and verify the saved file there.
export async function backUpFirst(page: Page, saveTo: string): Promise<void> {
  await page.getByRole('radio', { name: 'Back up this journal first (recommended)' }).check();
  await downloadBackup(page, saveTo, confirmStep(page));
  await verifyWith(page, saveTo, confirmStep(page));
  await expect(completeLine(confirmStep(page))).toBeVisible(LAUNCH);
}

// A Restore of a file over a journal that holds data, without a safety backup, ending on the Restore complete summary.
export async function restoreWithoutBackup(page: Page, file: string): Promise<void> {
  await chooseRestoreFile(page, file);
  await understood(page).check();
  await declineSafetyBackup(page);
  await replaceEntire(page).click();
  await expect(restoreComplete(page)).toBeVisible(LAUNCH);
}

// The probe without the root's empty candidate list. A preparation lists its candidate in the root's `pointer` store and removes it again, which leaves
// `{ key: 'candidates', databaseNames: [] }` behind (reported to the main session with B8.6); nothing else in the root or any Workspace changes.
export function withoutEmptyCandidateList(probed: Record<string, ProbedDatabase>): Record<string, ProbedDatabase> {
  const root = probed['tj-root'];
  if (!root) return probed;
  const pointer = (root.stores['pointer'] ?? []).filter((record) => {
    const entry = record as { key: string; databaseNames?: string[] };
    return entry.key !== 'candidates' || (entry.databaseNames?.length ?? 0) > 0;
  });
  return { ...probed, 'tj-root': { ...root, stores: { ...root.stores, pointer } } };
}

// A journal with one Plan (XYZ unless the values say otherwise), created through the UI at the instant, and closed.
export async function seedJournal(profile: Profile, instant: string = MONDAY_1005, values: PlanValues = PLAN): Promise<void> {
  const { context, page } = await onboardedAt(profile, instant);
  await confirmReference(page, values);
  await context.close();
}

// Records every request that leaves the origin (the artifact never goes anywhere, AC-DEL-001).
export function watchOutgoing(context: BrowserContext): { leaving(): string[] } {
  const urls: string[] = [];
  context.on('request', (request) => {
    const url = request.url();
    // Origins are compared whole, so another port on the same host (http://localhost:51750) counts as leaving.
    if (/^https?:/.test(url) && new URL(url).origin !== new URL(BASE_URL).origin) urls.push(url);
  });
  return { leaving: () => urls };
}

// ---- The raw-database loader (B8.9) --------------------------------------------------------

interface DumpedDatabases {
  readonly databases: Record<string, { readonly version: number; readonly stores: Record<string, { readonly keyPath: string | string[] | null; readonly autoIncrement: boolean; readonly indexes: readonly { name: string; keyPath: string | string[]; unique: boolean; multiEntry: boolean }[]; records: unknown[] }> }>;
}

// Writes a frozen Workspace dump into the profile's IndexedDB while the application is not running (the browser is launched with service workers
// blocked on a blank page of the app's origin, as D2's integrity writer does). With `brokenCloseReason`, one Close Reason fact names a Catalog
// identity that does not exist, which makes the conversion to schema 7 stop (I8.10).
export async function installDump(dir: string, options: { readonly brokenCloseReason: boolean }): Promise<void> {
  const dump = JSON.parse(readFileSync(FIXTURE_V5_DUMP, 'utf8')) as DumpedDatabases;
  if (options.brokenCloseReason) {
    const workspace = Object.entries(dump.databases).find(([name]) => name.startsWith('tj-ws-'))![1];
    const trades = workspace.stores['trades']!.records as { closeReasonFacts?: { versions: { value: { closeReasonId: string } }[] }[] }[];
    trades.find((trade) => (trade.closeReasonFacts?.length ?? 0) > 0)!.closeReasonFacts![0]!.versions[0]!.value.closeReasonId = 'fx-unknown';
  }
  const context = await chromium.launchPersistentContext(path.resolve(dir), { channel: 'chromium', serviceWorkers: 'block' });
  const page = await firstPage(context);
  await page.route(`${BASE_URL}/__fixture`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>fixture</title>' }));
  await page.goto(`${BASE_URL}/__fixture`);
  await page.evaluate(async (loaded: DumpedDatabases) => {
    for (const [name, database] of Object.entries(loaded.databases)) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name, database.version);
        request.onupgradeneeded = () => {
          for (const [storeName, store] of Object.entries(database.stores)) {
            const created = request.result.createObjectStore(storeName, { ...(store.keyPath === null ? {} : { keyPath: store.keyPath }), autoIncrement: store.autoIncrement });
            for (const index of store.indexes) created.createIndex(index.name, index.keyPath, { unique: index.unique, multiEntry: index.multiEntry });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('fixture failed'));
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(Object.keys(database.stores), 'readwrite');
        for (const [storeName, store] of Object.entries(database.stores)) for (const record of store.records) tx.objectStore(storeName).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('fixture failed'));
      });
      db.close();
    }
  }, dump);
  await context.close();
}
