// @vitest-environment jsdom
// The Position drawer through its adapter (`position.props`): the views' figures reach the component as finished display values (A216).
// Only an adapter or its test may import a view's types, so every view is built here.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { openDetailOf, PC1, PC2 } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionClosedDetail, optionOpenDetail, type OptionFrames } from '../../../../tests/support/option-detail-fixtures.ts';
import { ocChange, OC_E1, OC_PC1, OC_PC2, OC_X1, OS_S1 } from '../../../../tests/support/option-trade-fixtures.ts';
import type { TradeDetailView } from '../../../app/types.ts';
import { rowsOf, termValue } from '../../screens/trade-detail/test-support.ts';
import { PositionDrawer } from './position.tsx';

afterEach(cleanup);

const show = (view: TradeDetailView) => render(<PositionDrawer view={view} timeZone="America/New_York" />);

// O-C3's Wednesday: Buy 2 @ 2.00 (fee 1.30) on Monday, Sell 1 @ 3.00 (fee 0.65) on Wednesday, the call's Mark 2.90.
const WEDNESDAY: OptionFrames = { tradingDate: '2026-10-14', closeInstant: '2026-10-14T20:00:00Z', contractMark: '2.90', underlyingMark: '57.40' };
const OC3_BUY = ocChange('pc-1', '2026-10-12T14:00:00Z', 1, 'Buy', '2', '2.00', '1.30');
// Friday 2026-11-20 after the close: the expiration date, whose contracts are due for settlement.
const FRIDAY: OptionFrames = { tradingDate: '2026-11-20', closeInstant: '2026-11-20T21:00:00Z', contractMark: '0.80', underlyingMark: '52.00' };
const OC3_SELL =ocChange('pc-2', '2026-10-14T15:00:00Z', 3, 'Sell', '1', '3.00', '0.65');

describe('Position drawer (P96)', () => {
  it("should show the open lots, then Open P&L including the open lot's opening fee, Realized to date and Incurred fees, O-C3's Wednesday $89.35 and $98.70", () => {
    show(optionOpenDetail('O-C', [OC3_BUY, OC3_SELL], WEDNESDAY));
    const position = screen.getByRole('region', { name: 'Position' });
    const lots = within(position).getByRole('table', { name: 'Open Lots' });
    expect(rowsOf(lots)).toEqual([['2026-10-12 10:00', '1', '$2.00', '$0.65']]);
    expect(termValue(position, 'Open P&L')).toBe('+$89.35');
    expect(termValue(position, 'Realized to date')).toBe('+$98.70');
    expect(termValue(position, 'Incurred fees')).toBe('$1.95');
    // The lots come before the figures.
    expect(lots.compareDocumentPosition(within(position).getByText('Open P&L')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should show the Trade Summary and Last activity', () => {
    show(openDetailOf([PC1, PC2]));
    const position = screen.getByRole('region', { name: 'Position' });
    // The Trade Summary text, in the words and markup the Summary card gave it: no label of its own.
    expect(position.querySelector('.summary-text')?.textContent).toBe('Long 100 shares @ $50.18');
    expect(within(position).queryByText('Trade Summary')).toBeNull();
    expect(termValue(position, 'Last activity')).toBe('2026-10-12 11:00');
  });

  it('should show Settlement Due as the Open P&L on a Settlement Due Detail', () => {
    show(optionOpenDetail('O-S', [OS_S1], FRIDAY));
    const position = screen.getByRole('region', { name: 'Position' });
    expect(termValue(position, 'Open P&L')).toBe('Settlement Due');
    expect(termValue(position, 'Realized to date')).toBe('$0.00');
  });

  it('should list Lot Matches with the rounding note, fold the fee reconciliation, and list the Executions and the Settlement section', () => {
    show(optionClosedDetail('O-C', [OC_PC1, OC_PC2, OC_X1, OC_E1]));
    const matches = screen.getByRole('region', { name: 'Lot Matches' });
    expect(within(matches).getByText('Each match’s amount is rounded to the cent for display.')).toBeTruthy();
    expect(within(screen.getByRole('table', { name: 'Lot Matches' })).getAllByRole('row')).toHaveLength(3);
    const fees = screen.getByText('Fee reconciliation').closest('details')!;
    expect(fees.open).toBe(false);
    expect(termValue(fees, 'Incurred fees')).toBe('$1.95');
    const executions = screen.getByRole('region', { name: 'Executions (3)' });
    expect(within(executions).getAllByRole('button')).toHaveLength(3);
    const settlement = screen.getByRole('region', { name: 'Settlement (1)' });
    expect(within(settlement).getAllByRole('button')).toHaveLength(1);
  });
});
