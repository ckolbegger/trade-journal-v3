// Shared support for the D7S browser suite (plan section 6.2): D7's helpers (which re-export D6's and the earlier folders'), the served
// build (dist-faults, as D7's test fixture sets), and O-S2 and O-C2 from section 4: the Plan form with all four price fields, and each
// session's Marks for MNO and the put. Both contracts expire Friday 2026-12-18, so nothing in D7S is Settlement Due.
import type { Page } from '@playwright/test';
import { currentTradeId, detail, enterMark, expect, fillOptionPlan, optionMarkRow, READY, reachCard, recordOptionEntry, saveMarkPrice, savedOptionMarkRow, type OptionPlanValues, type TradeRef } from '../d7/support.ts';

export * from '../d7/support.ts';

export const THURSDAY = 'Thu Oct 15';
export const WEDNESDAY_1700_NY = '2026-10-14T21:00:00Z';
export const THURSDAY_1700_NY = '2026-10-15T21:00:00Z';

export const MNO_DEC_PUT = 'MNO 18 Dec 2026 45 Put';

// The four price fields of an option Plan: the Underlying ones keep D7's labels, the option-price ones are W1's.
export interface BothKinds extends OptionPlanValues {
  readonly stopOption: string;
  readonly targetOption: string;
}

// O-S2: 2 short Puts at 1.20; Stops MNO at or below 41.00 and the option at or above 3.60; Targets MNO at or above 44.50 and the option at or below 0.30.
export const OS2: BothKinds = {
  strategy: 'Cash-Secured Put', underlying: 'MNO', expiration: '2026-12-18', strike: '45', contracts: '2', entry: '1.20',
  stop: '41.00', target: '44.50', stopOption: '3.60', targetOption: '0.30', planTime: '2026-10-12T09:00',
};
// O-C2: 2 Calls at 2.00; Stops XYZ at or below 48.00 and the option at or below 1.00; Targets XYZ at or above 60.00 and the option at or above 4.00.
export const OC2: BothKinds = {
  strategy: 'Long Call', underlying: 'XYZ', expiration: '2026-12-18', strike: '55', contracts: '2', entry: '2.00',
  stop: '48.00', target: '60.00', stopOption: '1.00', targetOption: '4.00', planTime: '2026-10-12T09:00',
};

// The option-price labels (W1): a Cash-Secured Put stops above and targets below; a Long Call the other way.
export const stopOptionLabel = (values: BothKinds): string => `Stop (option price at or ${values.strategy === 'Cash-Secured Put' ? 'above' : 'below'})`;
export const targetOptionLabel = (values: BothKinds): string => `Target (option price at or ${values.strategy === 'Cash-Secured Put' ? 'below' : 'above'})`;

// Fills the option Plan form with all four price fields and the reflection.
export async function fillBothKinds(page: Page, values: BothKinds): Promise<void> {
  await fillOptionPlan(page, values);
  await page.getByLabel(stopOptionLabel(values), { exact: true }).fill(values.stopOption);
  await page.getByLabel(targetOptionLabel(values), { exact: true }).fill(values.targetOption);
}

// Confirms O-S2 or O-C2 at the pinned clock, ending on its Trade Detail; returns the Trade's id.
export async function confirmBothKinds(page: Page, values: BothKinds): Promise<string> {
  await fillBothKinds(page, values);
  await page.getByRole('button', { name: 'Confirm Plan' }).click();
  await expect(detail.heading(page, values.underlying)).toBeVisible(READY);
  return currentTradeId(page);
}

// O-S2 confirmed, then S1' (Sell 2 at 1.25, Monday 10:00, fee 1.30), ending on its Trade Detail.
export async function createOs2Trade(page: Page): Promise<TradeRef> {
  const tradeId = await confirmBothKinds(page, OS2);
  await recordOptionEntry(page, [{ quantity: '2', price: '1.25', fee: '1.30', time: '2026-10-12T10:00' }]);
  await page.getByRole('link', { name: 'Back to the Trade' }).click();
  await expect(detail.heading(page, 'MNO')).toBeVisible(READY);
  return { symbol: 'MNO', tradeId, label: 'O-S2' };
}

// One session's Marks for MNO and the put, saved in the Review once the clock is past that session's close.
export async function saveSessionMarks(page: Page, trade: TradeRef, date: string, mno: string, put: string): Promise<void> {
  await enterMark(page, trade, date, mno);
  await saveMarkPrice(page, trade, await optionMarkRow(page, trade, MNO_DEC_PUT, date), put);
  await savedOptionMarkRow(page, trade, MNO_DEC_PUT, date);
  await reachCard(page, trade);
}
