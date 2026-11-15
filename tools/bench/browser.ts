// The benchmark's browser steps for Restore (D8 T8.19): the production Restore flow driven through its own screen (the first-run
// "Restore from a backup" and the Backup page's), timed from the file chosen to the preview (prepare) and from Replace to
// "Restore complete" (apply), and a poller of `navigator.storage.estimate().usage` that keeps the peak.
import type { Page } from '@playwright/test';

// A full-size Restore takes minutes; the limit only stops a hung page.
export const RESTORE_WAIT_MS = 30 * 60_000;

export interface UiRestore {
  readonly prepareMs: number;
  readonly applyMs: number;
  // The preview's notes ("No updates needed.", "No repairs needed.") and the Trades and Marks counts of its "In the backup" column.
  readonly notes: readonly string[];
  readonly tradesInBackup: string;
  readonly marksInBackup: string;
}

// Chooses `file` on the Restore screen the page shows, previews it, and replaces the journal with it. The first-run screen has
// no safety backup step; the Backup page's offers one, which the benchmark declines (the restored data is the artifact's).
export async function restoreThroughUi(page: Page, file: string): Promise<UiRestore> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose backup file' }).click();
  const started = performance.now();
  await (await chooser).setFiles(file);
  const preview = page.getByRole('heading', { name: 'Restoring replaces your entire current journal' });
  const refused = page.getByRole('alert');
  await Promise.race([preview.waitFor({ timeout: RESTORE_WAIT_MS }), refused.first().waitFor({ timeout: RESTORE_WAIT_MS })]);
  if (!(await preview.isVisible())) throw new Error(`the Restore screen refused the artifact: ${(await refused.first().innerText()).slice(0, 400)}`);
  const prepareMs = performance.now() - started;

  const notes = (await page.locator('.restore-notes li').allInnerTexts()).map((t) => t.trim());
  const cellOf = async (label: string) => (await page.locator('.restore-counts tbody tr', { has: page.getByRole('rowheader', { name: label, exact: true }) }).locator('td').first().innerText()).trim();
  const tradesInBackup = await cellOf('Trades');
  const marksInBackup = await cellOf('Marks');

  await page.getByLabel('I understand this replaces my entire current journal').check();
  const safety = page.getByRole('radiogroup', { name: 'Safety backup' });
  if (await safety.isVisible()) {
    await page.getByRole('radio', { name: 'Replace without a backup' }).check();
    await page.getByRole('checkbox', { name: 'If this backup is wrong or incomplete, your current journal cannot be recovered.' }).check();
  }
  const applying = performance.now();
  await page.getByRole('button', { name: 'Replace entire journal' }).click();
  await page.getByRole('heading', { name: 'Restore complete' }).waitFor({ timeout: RESTORE_WAIT_MS });
  return { prepareMs, applyMs: performance.now() - applying, notes, tradesInBackup, marksInBackup };
}

// `navigator.storage.estimate().usage` of the page's origin, now.
export const usageNow = (page: Page): Promise<number> => page.evaluate(async () => (await navigator.storage.estimate()).usage ?? 0);

// Samples the usage every `everyMs` in the page until stopped; stop() returns the largest sample (and the one-time count).
export async function pollPeakUsage(page: Page, everyMs = 250): Promise<{ stop: () => Promise<{ peakBytes: number; samples: number }> }> {
  await page.evaluate((interval) => {
    const state = { peak: 0, samples: 0, running: true };
    (window as unknown as { __usagePoll: typeof state }).__usagePoll = state;
    void (async () => {
      while (state.running) {
        const usage = (await navigator.storage.estimate()).usage ?? 0;
        state.peak = Math.max(state.peak, usage);
        state.samples += 1;
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    })();
  }, everyMs);
  return {
    stop: () =>
      page.evaluate(() => {
        const state = (window as unknown as { __usagePoll: { peak: number; samples: number; running: boolean } }).__usagePoll;
        state.running = false;
        return { peakBytes: state.peak, samples: state.samples };
      }),
  };
}
