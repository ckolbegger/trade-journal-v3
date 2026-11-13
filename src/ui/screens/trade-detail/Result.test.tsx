// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { closedDetailOf, closeReviewEntry } from '../../../../tests/support/closed-detail-fixtures.ts';
import { PC1, PC2, X1, X2 } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionClosedDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { OC_E1, OC_PC1, OC_PC2, OC_X1 } from '../../../../tests/support/option-trade-fixtures.ts';
import { openDrawer, renderView, rowsOf, termValue, useFixedClock } from './test-support.ts';

afterEach(cleanup);

describe('Closed Trade Detail', () => {
  const CLOSE_REASON = { id: 'cr-1', label: 'Target reached' };

  it('should show lifecycle Closed as text, Closed via sale of 100 shares and the Close Reason as separately labelled fields, realized P&L and Realized R, the fee reconciliation, a Lot Matches table, and the Close Review in the narrative, with no Record entry or Record exit', async () => {
    const user = userEvent.setup();
    renderView(closedDetailOf([PC1, PC2, X1, X2], { closeReason: CLOSE_REASON, journal: [closeReviewEntry] }), true);
    expect(await screen.findByRole('heading', { name: 'XYZ', level: 1 })).toBeTruthy();
    expect(screen.getByText('Long Stock, Closed', { selector: '.badge' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Summary' }).querySelector('.summary-text')?.textContent).toBe('Long 100 shares @ $50.18');

    const result = screen.getByRole('region', { name: 'Result' });
    expect(termValue(result, 'Terminal Disposition')).toBe('Closed via sale of 100 shares');
    expect(termValue(result, 'Close Reason')).toBe('Target reached');
    expect(termValue(result, 'Realized P&L')).toBe('+$248.00');
    expect(termValue(result, 'Realized R')).toBe('+0.99R');

    const fees = screen.getByRole('region', { name: 'Fee reconciliation' });
    expect(termValue(fees, 'Incurred fees')).toBe('$4.00');
    expect(termValue(fees, 'Opening fees incurred')).toBe('$2.00');
    expect(termValue(fees, 'Opening fees allocated to Lot Matches')).toBe('$2.00');
    expect(termValue(fees, 'Opening fees unconsumed')).toBe('$0.00');
    expect(termValue(fees, 'Disposal fees incurred')).toBe('$2.00');
    expect(termValue(fees, 'Disposal fees allocated to Lot Matches')).toBe('$2.00');

    const matches = within(screen.getByRole('region', { name: 'Lot Matches' })).getByRole('table', { name: 'Lot Matches' });
    expect(rowsOf(matches)).toEqual([
      ['$50.10 on 2026-10-12 10:00', '$52.00 on 2026-10-13 10:00', '30', '+$55.90'],
      ['$50.10 on 2026-10-12 10:00', '$53.00 on 2026-10-13 14:00', '30', '+$85.90'],
      ['$50.30 on 2026-10-12 11:00', '$53.00 on 2026-10-13 14:00', '20', '+$53.10'],
      ['$50.30 on 2026-10-12 11:00', '$53.00 on 2026-10-13 14:00', '20', '+$53.10'],
    ]);

    await openDrawer(user, 'Journal');
    const journal = screen.getByRole('region', { name: 'Journal (1)' });
    expect(within(journal).getByText('Close Review', { selector: '.badge' })).toBeTruthy();
    expect(within(journal).getByText('Holding to the target paid.')).toBeTruthy();

    // No Open-only section, Mark, or Expected Mark Date; no way to record another entry or exit.
    for (const name of ['Valuation', 'Risk and reward', 'Position']) expect(screen.queryByRole('region', { name, hidden: true })).toBeNull();
    for (const text of ['Expected Mark Date', 'Mark', 'Open P&L']) expect(screen.queryByText(text)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Record entry', hidden: true })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Record exit', hidden: true })).toBeNull();
  });
});

describe('closed option Trade Detail (A119)', () => {
  useFixedClock();
  it('should show a Closed option Trade Closed via sale of 1 contract and expiration of 1 contract, Option Disposition Timing Mixed with both quantities, and no Close Reason field', async () => {
    const user = userEvent.setup();
    renderView(optionClosedDetail('O-C', [OC_PC1, OC_PC2, OC_X1, OC_E1]));
    const result = await screen.findByRole('region', { name: 'Result' });
    expect(termValue(result, 'Terminal Disposition')).toBe('Closed via sale of 1 contract and expiration of 1 contract');
    expect(termValue(result, 'Option Disposition Timing')).toBe('Mixed: 1 before expiration, 1 at expiration');
    expect(within(result).queryByText('Close Reason', { selector: 'dt' })).toBeNull();
    // A Closed Trade's Current payoff has nothing left to show.
    await openDrawer(user, 'Payoff');
    expect(within(screen.getByRole('region', { name: 'Expiration Payoff' })).getByText('Not applicable: no open position').closest('p')?.textContent).toBe('Now: Not applicable: no open position');
  });
});
