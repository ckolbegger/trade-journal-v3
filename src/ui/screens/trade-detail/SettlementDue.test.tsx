// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { optionOpenDetail, type OptionFrames } from '../../../../tests/support/option-detail-fixtures.ts';
import { OC_PC1, OC_PC2, OC_X1, OS_S1, OS2_S1 } from '../../../../tests/support/option-trade-fixtures.ts';
import { renderView, termValue, useFixedClock } from './test-support.ts';

afterEach(cleanup);

// Friday 2026-11-20 after the close: the expiration date, whose contracts are due for settlement.
const FRIDAY: OptionFrames = { tradingDate: '2026-11-20', closeInstant: '2026-11-20T21:00:00Z', contractMark: '0.80', underlyingMark: '52.00' };

describe('option Trade Detail Settlement Due panel (rows 23.9 and 23.10)', () => {
  useFixedClock();
  it('should show a Settlement Due panel with the contract, quantity, expiry and settlement time, an explanation keyed by the quantity sign, and Record expiration only while Writable', async () => {
    renderView(optionOpenDetail('O-S', [OS_S1], FRIDAY), true);
    const panel = await screen.findByRole('region', { name: 'Settlement Due' });
    expect(termValue(panel, 'Contract')).toBe('MNO 20 Nov 2026 45 Put');
    expect(termValue(panel, 'Quantity')).toBe('Short 2 contracts');
    expect(termValue(panel, 'Expired')).toBe('Fri Nov 20');
    expect(termValue(panel, 'Settlement time')).toBe('Fri Nov 20, 16:00');
    expect(within(panel).getByText("If it was assigned, this release can't record the assignment yet, so this Trade stays open until a later release can.")).toBeTruthy();
    expect(within(panel).getByRole('link', { name: 'Record expiration' }).getAttribute('href')).toBe('/trades/trade-1/record-expiration');
    // Due, the panel stands in for the expiration line.
    expect(screen.queryByText(/^Expires /)).toBeNull();
    cleanup();

    // A long contract is worded by its sign, not by the Strategy.
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], FRIDAY), false);
    const long = await screen.findByRole('region', { name: 'Settlement Due' });
    expect(termValue(long, 'Quantity')).toBe('Long 1 contract');
    expect(within(long).getByText("If it was exercised, this release can't record the exercise yet, so this Trade stays open until a later release can.")).toBeTruthy();
    expect(within(long).queryByRole('link', { name: 'Record expiration', hidden: true })).toBeNull();
  });

  it('should show Outside the market calendar in place of the settlement time, with no Record expiration, for an expiration date outside calendar coverage', async () => {
    const covered = optionOpenDetail('O-S', [OS_S1], FRIDAY);
    const settlementTime = { kind: 'Unavailable', reason: 'SessionPolicyNotCovered', instrument: covered.settlement[0]!.instrument, date: '2026-11-20' } as const;
    renderView({ ...covered, settlement: covered.settlement.map((item) => ({ ...item, settlementTime })) }, true);
    const panel = await screen.findByRole('region', { name: 'Settlement Due' });
    expect(termValue(panel, 'Settlement time')).toBe('Outside the market calendar: Fri Nov 20');
    expect(within(panel).queryByRole('link', { name: 'Record expiration', hidden: true })).toBeNull();
  });
});

describe('Trade Detail: every condition (W6, W7)', () => {
  useFixedClock();
  it('should stamp an O-S2 Due settlement item with the close of its own expiration session, 2026-12-18', () => {
    const detail = optionOpenDetail('O-S2', [OS2_S1], { tradingDate: '2026-12-18', closeInstant: '2026-12-18T21:00:00Z', contractMark: '0.10', underlyingMark: '43.20' });
    expect(detail.settlement.map((item) => [item.expiration, item.settlementTime])).toEqual([['2026-12-18', { kind: 'Value', value: '2026-12-18T21:00:00Z' }]]);
  });
});
