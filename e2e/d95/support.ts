// Shared support for the D9.5 browser suite (plan section 7.2): every spec asserts the same information, fields and actions at 1280 and at 375 wide (AC-UI-002).
import type { Page } from '@playwright/test';
import { setWidth } from '../d7p/support.ts';

export const WIDTHS = [1280, 375] as const;

// Runs the same check at each width and leaves the page at 1280.
export async function atBothWidths(page: Page, check: (width: number) => Promise<void>): Promise<void> {
  for (const width of WIDTHS) {
    await setWidth(page, width);
    await check(width);
  }
  await setWidth(page, WIDTHS[0]);
}
