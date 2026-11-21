// Shared support for the D9R2 browser suite (plan section 7.2, A298): D9A-R's helpers (which re-export D9's, D8R's, D7's, D5R's, D4's and D2's: markRow,
// markCell, chooseCell, enterMark, acknowledgeMark, createCardFixture, saveMarksOf, remainsOf, optionMarkRow, saveMarkPrice, observationsOf, launchTouchAt),
// and the one thing this folder adds: the gap fixture.
import type { BrowserContext, Page } from '@playwright/test';
import { acknowledgeMark, createTradeAt, enterMark, FOUR_TRADES, MONDAY_1700, onboardedAt, openReview, PLAN, setClock, type PlanValues, type Profile, type TradeRef } from '../d9ar/support.ts';

export * from '../d9ar/support.ts';

// Wed 2026-10-07 17:00 New York (EDT), the day the fixture acknowledges one session.
export const WEDNESDAY_OCT_7_1700 = '2026-10-07T21:00:00Z';

export const OCT_6 = 'Tue Oct 6';
export const OCT_7 = 'Wed Oct 7';
export const OCT_8 = 'Thu Oct 8';
export const OCT_9 = 'Fri Oct 9';
export const OCT_12 = 'Mon Oct 12';

// T-A: XYZ, 100 shares, first bought Mon 2026-08-31 (long before the Review Date, so far more than 20 sessions have no Mark).
const T_A: PlanValues = FOUR_TRADES[0]!.plan;
// T-F: XYZ again, 50 shares, bought on the Review Date (Mon 2026-10-12 10:30): it holds nothing before then.
const T_F: PlanValues = { ...PLAN, symbol: 'XYZ', quantity: '50', entry: '50', stop: '48', target: '55' };

export interface GapFixture {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly tA: TradeRef;
  readonly tF: TradeRef;
}

// The gap fixture, created through the UI. One Instrument (XYZ) is shared by two Trades. At Wed Oct 7 17:00 T-A (held since Aug 31)
// is Marked for Tue Oct 6 and its Review Date Mark is acknowledged unavailable (with Mon Oct 5 and every session back to Aug 31 left
// without a Mark); at Mon Oct 12 17:00 T-F is bought. In the Mon Oct 12 Review XYZ is therefore: Missing on every session of T-A
// from Aug 31 to Oct 5 (more than 20 gaps), Acknowledged Unavailable on Wed Oct 7, Missing on Thu Oct 8 and Fri Oct 9 (the previous
// session), and Missing on the Review Date; T-F holds XYZ only from Oct 12, so every earlier session is Not held for it.
export async function createGapFixture(profile: Profile): Promise<GapFixture> {
  const { context, page } = await onboardedAt(profile, WEDNESDAY_OCT_7_1700);
  const tA = { symbol: 'XYZ', tradeId: await createTradeAt(page, T_A, '2026-08-31T09:30', [['100', '50.10', '2026-08-31T10:00']]), label: 'T-A' };
  await openReview(page);
  await enterMark(page, tA, OCT_6, '49.80');
  await acknowledgeMark(page, tA, OCT_7, 'No quote today');
  await setClock(context, page, MONDAY_1700);
  const tF = { symbol: 'XYZ', tradeId: await createTradeAt(page, T_F, '2026-10-12T09:30', [['50', '50.00', '2026-10-12T10:30']]), label: 'T-F' };
  await openReview(page);
  return { context, page, tA, tF };
}
