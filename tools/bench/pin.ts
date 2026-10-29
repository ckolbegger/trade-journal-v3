// The benchmark pins the app's clock to the dataset's as-of instant (A52). Playwright's
// `clock.setFixedTime` pins only `Date`; this Chromium has native Temporal, which the application's
// systemClock reads (`Temporal.Now.instant()`), so Temporal is pointed at the pinned `Date` too
// (the approach of e2e/d4/support.ts launchAt). The application uses no other `Temporal.Now`.
import type { BrowserContext, Page } from '@playwright/test';

export async function pinAsOf(context: BrowserContext, asOf: Date): Promise<void> {
  await context.clock.setFixedTime(asOf);
  await context.addInitScript(() => {
    const native = (globalThis as unknown as { Temporal?: { Now: { instant: () => unknown }; Instant: { fromEpochMilliseconds: (ms: number) => unknown } } }).Temporal;
    if (native) native.Now.instant = () => native.Instant.fromEpochMilliseconds(Date.now());
  });
}

// The guard: the page's Date and Temporal clock must both read the as-of instant.
export async function assertPinned(page: Page, asOf: Date): Promise<void> {
  const seen = await page.evaluate(() => ({
    date: new Date().toISOString(),
    temporal: (globalThis as unknown as { Temporal?: { Now: { instant: () => { toString(): string } } } }).Temporal?.Now.instant().toString() ?? 'no Temporal',
  }));
  const want = asOf.getTime();
  if (new Date(seen.date).getTime() !== want || new Date(seen.temporal).getTime() !== want) {
    throw new Error(`the page is not pinned to the as-of instant ${asOf.toISOString()}: Date ${seen.date}, Temporal.Now.instant ${seen.temporal}`);
  }
}

// The Open list rendered: the Missing Instruments (and only those) show "Mark missing" in P&L.
export function assertMissingRendered(rows: readonly (readonly string[])[], missing: readonly string[]): void {
  const flagged = rows.filter((r) => r[3]!.startsWith('Mark missing')).map((r) => r[0]!);
  const wrong = rows.filter((r) => missing.includes(r[0]!) !== r[3]!.startsWith('Mark missing')).map((r) => r[0]!);
  if (wrong.length > 0 || flagged.length === 0) {
    throw new Error(`the Open list's Mark-missing rows (${[...new Set(flagged)].join(', ') || 'none'}) are not the Missing Instruments (${missing.join(', ')})`);
  }
}
