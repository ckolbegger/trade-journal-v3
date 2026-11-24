// Shared support for the D9.5 browser suite (plan section 7.2): every spec asserts the same information, fields and actions at 1280 and at 375 wide (AC-UI-002).
import type { BrowserContext, Page } from '@playwright/test';
import { createTrades, defineSetup, firstPage, FOUR_TRADES, launchAt, MONDAY_1700, onboardedAt, type Profile, type Setup } from '../d4/support.ts';
import { setWidth } from '../d7p/support.ts';

export const WIDTHS = [1280, 375] as const;

// Onboarded at Mon Oct 12 17:00 with ABC (100 shares at $30.00, Stop $28.00, Target $36.00) and DEF (100 shares at $40.00, Stop $38.00, Target $46.00): built once per worker, each case starts on a copy.
export const ABC_DEF = defineSetup('d95-abc-def', async (profile) => {
  const { context, page } = await onboardedAt(profile, MONDAY_1700);
  const [abc, def] = await createTrades(page, [FOUR_TRADES[1]!, FOUR_TRADES[2]!]);
  return { context, made: { ABC: abc!, DEF: def! } };
});

// The copy launched at Mon Oct 12 17:00, on the Trades screen with its first load done.
export async function openAbcDef(profile: Profile, copySetup: <T>(setup: Setup<T>) => Promise<T>): Promise<{ context: BrowserContext; page: Page; ids: { ABC: string; DEF: string } }> {
  const ids = await copySetup(ABC_DEF);
  const context = await launchAt(profile, MONDAY_1700);
  const page = await firstPage(context);
  await page.goto('/');
  return { context, page, ids };
}

// Runs the same check at each width and leaves the page at 1280.
export async function atBothWidths(page: Page, check: (width: number) => Promise<void>): Promise<void> {
  for (const width of WIDTHS) {
    await setWidth(page, width);
    await check(width);
  }
  await setWidth(page, WIDTHS[0]);
}
