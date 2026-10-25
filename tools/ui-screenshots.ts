// npm run ui:screenshots (D2 UI alignment, T2.54): captures the 17 built screens of the screenshot
// comparison at 390 and 1280 px into evidence/D02/ui-alignment/, with a README pairing each with
// its reference in specs/reference/ui-screenshots/. It builds dist-faults, serves it as the e2e
// specs do, and drives the app through the e2e/d2/support.ts steps with a fixed clock.
// It is not part of the e2e suite.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import {
  BASE_URL,
  PC1,
  PC2,
  PC3,
  PLAN,
  PLAN_TIME,
  READY,
  backToTrade,
  completeReflection,
  expect,
  executionRow,
  fillPlan,
  fillRows,
  onboard,
  openEntryForm,
  openTradeFromOpenList,
  profileAt,
  recordEntry,
  reflectionSection,
  startJournal,
} from '../e2e/d2/support.ts';
import { startReleaseServer } from './release-server.ts';

const OUT = path.resolve('evidence/D02/ui-alignment');
// Captures go under test-results/ (git-ignored, same filesystem as evidence/), so a killed run
// leaves nothing untracked in evidence/; OUT is overwritten only after a complete, verified run.
const SCRATCH = path.resolve('test-results');
let captureDir = OUT;
let keepCapture = false;
const WIDTHS = [
  { label: '390', width: 390, height: 844 },
  { label: '1280', width: 1280, height: 900 },
] as const;
// After the last Execution below (14:00 in the Workspace zone, America/New_York), so Authored
// times and default Economic Times are the same on every run.
const FIXED_NOW = '2026-10-12T16:00:00-04:00';

interface Screen {
  readonly name: string;
  readonly state: string;
  // Files in specs/reference/ui-screenshots/ (narrow, wide), or undefined where none exists.
  readonly reference: string | undefined;
}

// The 17 screens, numbered as in the comparison (01-first-launch through 17-about).
const SCREENS: readonly Screen[] = [
  { name: '01-first-launch', state: 'Fresh profile, "Start your journal"', reference: undefined },
  { name: '02-onboarding', state: 'After Start my journal, "Add your brokerage account"', reference: undefined },
  { name: '03-trades-empty', state: 'Trades, Open tab, no Trades yet', reference: 'proto-home' },
  { name: '04-new-plan', state: 'New Plan, blank', reference: 'proto-new-plan-step2' },
  { name: '05-new-plan-errors', state: 'New Plan after Confirm Plan with nothing filled (field issues and summary)', reference: 'proto-new-plan-step2' },
  { name: '06-new-plan-filled', state: 'New Plan filled: XYZ, 100 @ 50, Stop 47.50, Target 56, Plan time 2026-10-12 09:30', reference: 'proto-new-plan-step2-filled' },
  { name: '07-detail-planned', state: 'Trade Detail of the confirmed Plan, Planned', reference: 'proto-position-detail-planned' },
  { name: '08-trades-planned', state: 'Trades, Planned tab, one Planned Trade', reference: 'proto-home' },
  { name: '09-record-entry', state: 'Record entry for the Planned Trade, blank', reference: 'proto-add-fill' },
  { name: '10-record-entry-filled', state: 'Record entry with two Executions (30 @ 50.00 and 30 @ 50.20)', reference: 'proto-add-fill' },
  { name: '11-reflection', state: 'Position Change Reflection section (element), answered As Planned, Calm, confidence 4', reference: 'proto-entry-composer' },
  { name: '12-receipt', state: 'Receipt after saving the first Position Change', reference: undefined },
  { name: '13-trades-open', state: 'Trades, Open tab, XYZ at 120 shares', reference: 'proto-home' },
  { name: '14-detail-open', state: 'Trade Detail, Open: three Position Changes (the second declines its Reflection)', reference: 'proto-position-detail-stock' },
  { name: '15-journal', state: 'Journal region of the Open Trade Detail (element)', reference: 'proto-position-journal' },
  { name: '16-accounts', state: 'Accounts, one Account (Fidelity, Roth IRA)', reference: undefined },
  { name: '17-about', state: 'About', reference: undefined },
];

const nav = (page: Page): Locator => page.getByRole('navigation', { name: 'Primary' });

async function shoot(page: Page, name: string, target?: Locator): Promise<void> {
  for (const { label, width, height } of WIDTHS) {
    await page.setViewportSize({ width, height });
    // Layout settles after the viewport change (the layout switch is a media query).
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    // A blinking caret or a focused date segment is the only run-to-run difference otherwise.
    await page.evaluate(() => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) active.blur();
    });
    const file = path.join(captureDir, `${name}-${label}.png`);
    if (target) await target.screenshot({ path: file, animations: 'disabled' });
    else await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
  }
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
}

function readme(): string {
  const link = (file: string) => `[${file}](../../../specs/reference/ui-screenshots/${file})`;
  const rows = SCREENS.map((s) => {
    const ours = WIDTHS.map(({ label }) => `[${label}](${s.name}-${label}.png)`);
    const reference = s.reference ? `${link(`${s.reference}.png`)} (narrow), ${link(`${s.reference}-desktop.png`)} (wide)` : 'none: the prototype has no matching screen';
    return `| ${s.name} | ${s.state} | ${ours[0]} | ${ours[1]} | ${reference} |`;
  });
  return [
    '# UI alignment: built screens beside their references',
    '',
    'Generated by `npm run ui:screenshots` (`tools/ui-screenshots.ts`); do not edit by hand. The 17 screens are the built screens of the [screenshot comparison](../screenshot-comparison.md), numbered as there. Each is captured at 390 and 1280 px, in the same Workspace data as the comparison (the reference Trade of AC-PLAN-001: XYZ, 100 @ 50, then Position Changes to 120 shares), with a fixed clock and the Workspace zone America/New_York.',
    '',
    'The references are illustrations of density and hierarchy only; the UI contract and the specs override their wording, arithmetic and state ([index](../../../specs/reference/ui-screenshots/index.md)). Page captures are full page, so the fixed bottom bar appears mid-page at 390 and the sidebar background stops at the viewport height at 1280; both are capture artifacts.',
    '',
    '| Screen | State | Ours at 390 | Ours at 1280 | Reference |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

async function drive(context: BrowserContext): Promise<void> {
  // Installed before any navigation so every document starts on the fixed clock.
  await context.clock.install({ time: FIXED_NOW });
  await context.clock.setFixedTime(FIXED_NOW);
  // Chromium ships a native Temporal, which the app uses and the Playwright clock does not fake.
  await context.addInitScript((now: string) => {
    const T = (globalThis as unknown as { Temporal?: { Now: object; Instant: { from(s: string): { toZonedDateTimeISO(tz: string): unknown } } } }).Temporal;
    if (!T) return;
    const instant = () => T.Instant.from(now);
    const zone = () => new Intl.DateTimeFormat().resolvedOptions().timeZone;
    const at = (tz: string | undefined) => instant().toZonedDateTimeISO(tz ?? zone()) as Record<string, () => unknown>;
    Object.defineProperties(T.Now, {
      instant: { value: instant, configurable: true },
      zonedDateTimeISO: { value: (tz?: string) => at(tz), configurable: true },
      plainDateTimeISO: { value: (tz?: string) => at(tz)['toPlainDateTime']!(), configurable: true },
      plainDateISO: { value: (tz?: string) => at(tz)['toPlainDate']!(), configurable: true },
      plainTimeISO: { value: (tz?: string) => at(tz)['toPlainTime']!(), configurable: true },
    });
  }, FIXED_NOW);
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`${BASE_URL}/`);
  await expect(page.getByRole('heading', { name: 'Start your journal' })).toBeVisible(READY);
  await shoot(page, '01-first-launch');
  await startJournal(page);
  await expect(page.getByRole('heading', { name: 'Add your brokerage account' })).toBeVisible(READY);
  await shoot(page, '02-onboarding');
  await onboard(page);
  await page.getByRole('tablist', { name: 'Trades by lifecycle' }).getByRole('tab', { name: 'Open' }).click();
  await shoot(page, '03-trades-empty');

  await nav(page).getByRole('link', { name: 'New Plan' }).click();
  await expect(page.getByRole('heading', { name: 'New Plan' })).toBeVisible(READY);
  await shoot(page, '04-new-plan');
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(page.getByRole('region', { name: 'This Plan can’t be confirmed yet' })).toBeVisible();
  await shoot(page, '05-new-plan-errors');
  await fillPlan(page, PLAN);
  await page.getByLabel('Plan time').fill(PLAN_TIME);
  await shoot(page, '06-new-plan-filled');
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(page.getByRole('heading', { name: PLAN.symbol, level: 1 })).toBeVisible(READY);
  await shoot(page, '07-detail-planned');
  await nav(page).getByRole('link', { name: 'Trades' }).click();
  await page.getByRole('tablist', { name: 'Trades by lifecycle' }).getByRole('tab', { name: 'Planned' }).click();
  await expect(page.getByRole('table', { name: 'Planned Trades' })).toBeVisible(READY);
  await shoot(page, '08-trades-planned');
  await page.getByRole('table', { name: 'Planned Trades' }).getByRole('link', { name: PLAN.symbol }).click();
  await expect(page.getByRole('heading', { name: PLAN.symbol, level: 1 })).toBeVisible(READY);

  await openEntryForm(page);
  await shoot(page, '09-record-entry');
  await fillRows(page, PC1);
  await expect(executionRow(page, 2)).toBeVisible();
  await shoot(page, '10-record-entry-filled');
  await completeReflection(page);
  await shoot(page, '11-reflection', reflectionSection(page));
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByRole('heading', { name: 'Entry recorded' })).toBeVisible();
  await shoot(page, '12-receipt');
  await backToTrade(page);
  await recordEntry(page, PC2, { decline: true });
  await backToTrade(page);
  await recordEntry(page, PC3);
  await nav(page).getByRole('link', { name: 'Trades' }).click();
  await page.getByRole('tablist', { name: 'Trades by lifecycle' }).getByRole('tab', { name: 'Open' }).click();
  await expect(page.getByRole('table', { name: 'Open Trades' })).toBeVisible(READY);
  await shoot(page, '13-trades-open');
  await openTradeFromOpenList(page);
  const journal = page.getByRole('region', { name: /^Journal \(\d+\)$/ });
  await expect(journal).toBeVisible(READY);
  await shoot(page, '14-detail-open');
  await shoot(page, '15-journal', journal);

  await nav(page).getByRole('link', { name: 'Accounts' }).click();
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible(READY);
  await shoot(page, '16-accounts');
  await nav(page).getByRole('link', { name: 'About' }).click(READY);
  await expect(page.getByRole('heading', { name: 'About' }).first()).toBeVisible(READY);
  await shoot(page, '17-about');
}

async function main(): Promise<void> {
  run('npm', ['run', 'build:faults']);
  mkdirSync(SCRATCH, { recursive: true });
  captureDir = mkdtempSync(path.join(SCRATCH, 'ui-screenshots-'));
  try {
    const server = await startReleaseServer({ root: process.cwd(), release: 'dist-faults' });
    try {
      const dir = mkdtempSync(path.join(tmpdir(), 'ui-screenshots-'));
      try {
        const context = await profileAt(dir).launch({ width: 390 });
        try {
          await drive(context);
        } finally {
          await context.close();
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    } finally {
      await server.close();
    }
    writeFileSync(path.join(captureDir, 'README.md'), readme());
    const files = readdirSync(captureDir);
    const pngs = files.filter((f) => f.endsWith('.png')).length;
    if (pngs !== SCREENS.length * WIDTHS.length) throw new Error(`expected ${SCREENS.length * WIDTHS.length} PNGs, wrote ${pngs}`);
    if (!files.includes('README.md')) throw new Error('no README written');
    copyIn();
    console.log(`wrote ${pngs} PNGs and the README to ${path.relative('.', OUT)}`);
  } catch (error) {
    if (!keepCapture) rmSync(captureDir, { recursive: true, force: true });
    throw error;
  }
}

// Copies the checked capture over OUT, drops files the capture lacks, then removes the capture.
// OUT is tracked in git, so git is the backup if the copy stops partway.
function copyIn(): void {
  try {
    mkdirSync(OUT, { recursive: true });
    const names = readdirSync(captureDir);
    for (const name of names) copyFileSync(path.join(captureDir, name), path.join(OUT, name));
    for (const name of readdirSync(OUT)) if (!names.includes(name)) rmSync(path.join(OUT, name), { recursive: true, force: true });
  } catch (error) {
    keepCapture = true;
    console.error(`copy into ${path.relative('.', OUT)} failed; the capture is at ${captureDir}, and the committed screenshots can be restored with: git checkout evidence/D02/ui-alignment`);
    throw error;
  }
  rmSync(captureDir, { recursive: true, force: true });
}

await main();
