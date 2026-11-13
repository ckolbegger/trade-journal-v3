// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { optionClosedDetail, optionOpenDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { openDetailOf, PC1, PC2 } from '../../../../tests/support/open-detail-fixtures.ts';
import { OC_E1, OC_PC1, OC_PC2, OC_X1, OS_S1 } from '../../../../tests/support/option-trade-fixtures.ts';
import { THURSDAY, useFixedClock } from '../../screens/trade-detail/test-support.ts';
import { PayoffDrawer } from './payoff.tsx';

afterEach(cleanup);

describe('Payoff drawer (W14)', () => {
  useFixedClock();

  it('should draw one chart with the planned line dashed and the current line solid, each with its text-equivalent table', () => {
    render(<PayoffDrawer view={optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY)} />);
    const drawer = screen.getByRole('region', { name: 'Expiration Payoff' });
    const charts = within(drawer).getAllByRole('img');
    expect(charts).toHaveLength(1);
    const chart = charts[0]!;
    expect(chart.querySelector('polyline.payoff-planned')?.getAttribute('stroke-dasharray')).toBeTruthy();
    expect(chart.querySelector('polyline.payoff-now')).toBeTruthy();
    expect(chart.querySelector('polyline.payoff-now')?.getAttribute('stroke-dasharray')).toBeNull();
    expect(within(chart).getByText('Planned')).toBeTruthy();
    expect(within(chart).getByText('Now')).toBeTruthy();
    const planned = within(drawer).getByRole('region', { name: 'Planned Expiration Payoff' });
    expect(within(within(planned).getByRole('table')).getByRole('caption').textContent).toBe('Planned payoff at expiration by XYZ price');
    expect(within(planned).getByText('Breakeven 57.00')).toBeTruthy();
    const current = within(drawer).getByRole('region', { name: 'Current Expiration Payoff' });
    expect(within(within(current).getByRole('table')).getByRole('caption').textContent).toBe('Current payoff at expiration by XYZ price, including +$88.70 realized to date');
  });

  it('should draw only the planned line with "Now: Not applicable: no open position" on a Closed Detail', () => {
    render(<PayoffDrawer view={optionClosedDetail('O-C', [OC_PC1, OC_PC2, OC_X1, OC_E1])} />);
    const drawer = screen.getByRole('region', { name: 'Expiration Payoff' });
    const chart = within(drawer).getByRole('img');
    expect(chart.querySelector('polyline.payoff-planned')).toBeTruthy();
    expect(chart.querySelector('polyline.payoff-now')).toBeNull();
    expect(within(chart).queryByText('Now')).toBeNull();
    expect(within(drawer).getByText('Not applicable: no open position').closest('p')?.textContent).toBe('Now: Not applicable: no open position');
    expect(within(drawer).getByRole('region', { name: 'Planned Expiration Payoff' })).toBeTruthy();
    expect(within(drawer).queryByRole('region', { name: 'Current Expiration Payoff', hidden: true })).toBeNull();
    expect(within(drawer).getAllByRole('table')).toHaveLength(1);
  });

  it('should show one Not applicable line for a stock Trade', () => {
    render(<PayoffDrawer view={openDetailOf([PC1, PC2])} />);
    const drawer = screen.getByRole('region', { name: 'Expiration Payoff' });
    expect(within(drawer).getByText('Not applicable: no option expiration').closest('p')?.textContent).toBe('Expiration Payoff: Not applicable: no option expiration');
    expect(drawer.textContent).toBe('Expiration Payoff: Not applicable: no option expiration');
    expect(within(drawer).queryByRole('img', { hidden: true })).toBeNull();
    expect(within(drawer).queryByRole('table', { hidden: true })).toBeNull();
  });

  it("should state the value at expiration at the latest Mark through valueAtCloseText, as \"Value at expiration at MNO's latest Mark\" on Detail and the Review card", () => {
    const termIn = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
    // A number: the sentence, marked on the chart as a point.
    render(<PayoffDrawer view={optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY)} />);
    expect(within(screen.getByRole('region', { name: 'Expiration Payoff' })).getByText('If XYZ is at 52.00 at expiration: −$101.95', { selector: 'p' })).toBeTruthy();
    expect(screen.getByRole('img').querySelector('circle.payoff-marker')).toBeTruthy();
    cleanup();
    // No Underlying Mark, and the module's words say why.
    render(<PayoffDrawer view={optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], { ...THURSDAY, underlyingMark: undefined })} />);
    expect(termIn("Value at expiration at XYZ's latest Mark")).toBe('Mark missing: XYZ, Thu Nov 19');
    expect(screen.getByRole('img').querySelector('circle.payoff-marker')).toBeNull();
    cleanup();
    // The Monday after expiration, with no Mark for the expired contract.
    render(<PayoffDrawer view={optionOpenDetail('O-S', [OS_S1], { tradingDate: '2026-11-23', closeInstant: '2026-11-23T21:00:00Z', underlyingMark: '46.00' })} />);
    expect(termIn("Value at expiration at MNO's latest Mark")).toBe('Settlement Due: MNO 20 Nov 2026 45 Put');
  });
});
