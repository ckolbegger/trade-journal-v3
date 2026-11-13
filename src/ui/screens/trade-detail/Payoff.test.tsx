// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, NavigationType, Route, Router, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../../tests/support/facade-double.ts';
import { openDetailOf, PC1, PC2 } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionPlannedDetail, optionOpenDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { OC_PC1, OC_PC2, OC_X1, OS_S1 } from '../../../../tests/support/option-trade-fixtures.ts';
import { RuntimeContext } from '../../runtime.tsx';
import { TradeDetail } from '../TradeDetail.tsx';
import { handOffConfirmed } from '../confirmed-handoff.ts';
import { THURSDAY, openDrawer, renderView, useFixedClock } from './test-support.ts';

afterEach(cleanup);

describe('Trade Detail of a just-confirmed Plan after a reload', () => {
  it('should render the confirmed Plan Detail after a reload or back navigation without throwing, with its Planned payoff', async () => {
    const user = userEvent.setup();
    const facade = facadeDouble();
    // The confirmed option Plan; the read after the reload carries its Planned payoff.
    const confirmed = optionPlannedDetail('O-C');
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: confirmed, binding: {} } as never);
    // history.state is structured-cloned on a reload or back navigation: Rational instances come back as plain objects.
    const cloned = structuredClone({ confirmed });
    render(
      // MemoryRouter would JSON-serialize the state (and fail on a BigInt), so the location is supplied directly.
      <Router location={{ pathname: '/trades/trade-1', search: '', hash: '', state: cloned, key: 'reloaded' }} navigationType={NavigationType.Pop} navigator={{ createHref: () => '', go: () => undefined, push: () => undefined, replace: () => undefined }}>
        <Routes>
          <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" />} />
        </Routes>
      </Router>,
    );
    expect(await screen.findByRole('heading', { name: 'XYZ', level: 1 })).toBeTruthy();
    expect(facade.TradeViewsAndReporting.getTradeDetail).toHaveBeenCalledWith({ tradeId: 'trade-1' });
    const baseline = screen.getByRole('region', { name: 'Plan Baseline' });
    expect(within(baseline).getByText('1R (original risk)', { selector: 'dt' }).nextElementSibling?.textContent).toBe('$400.00');
    // The Planned payoff comes from the read, since the cloned state is not used (T7.23).
    await openDrawer(user, 'Payoff');
    expect(within(screen.getByRole('region', { name: 'Planned Expiration Payoff' })).getByRole('table', { name: 'Planned payoff at expiration by XYZ price' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Planned payoff at expiration by XYZ price' })).toBeTruthy();
  });
});

describe('Trade Detail of a Plan just confirmed in this session', () => {
  it('should render the handed-over confirmed Plan Detail without a read, once, with its Planned payoff', async () => {
    const user = userEvent.setup();
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: optionPlannedDetail('O-C'), binding: {} } as never);
    handOffConfirmed(optionPlannedDetail('O-C'));
    const mount = () =>
      render(
        <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
          <MemoryRouter initialEntries={['/trades/trade-1']}>
            <Routes>
              <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" />} />
            </Routes>
          </MemoryRouter>
        </RuntimeContext.Provider>,
      );
    mount();
    expect(await screen.findByRole('heading', { name: 'XYZ', level: 1 })).toBeTruthy();
    expect(facade.TradeViewsAndReporting.getTradeDetail).not.toHaveBeenCalled();
    await openDrawer(user, 'Payoff');
    expect(within(screen.getByRole('region', { name: 'Planned Expiration Payoff' })).getByRole('table', { name: 'Planned payoff at expiration by XYZ price' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Planned payoff at expiration by XYZ price' })).toBeTruthy();
    // Used once: a later visit to the same Trade takes the normal read.
    cleanup();
    mount();
    await screen.findByRole('heading', { name: 'XYZ', level: 1 });
    expect(facade.TradeViewsAndReporting.getTradeDetail).toHaveBeenCalledTimes(1);
  });
});

describe('option Trade Detail payoff sections (A119, A122)', () => {
  useFixedClock();
  it('should show the Planned and Current payoff sections apart from the Valuation, with the value at expiration at the latest close beside the Current chart', async () => {
    const user = userEvent.setup();
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    await openDrawer(user, 'Payoff');
    const planned = await screen.findByRole('region', { name: 'Planned Expiration Payoff' });
    expect(within(planned).getByRole('table', { name: 'Planned payoff at expiration by XYZ price' })).toBeTruthy();

    const current = screen.getByRole('region', { name: 'Current Expiration Payoff' });
    expect(within(current).getByRole('table', { name: /^Current payoff at expiration by XYZ price/ })).toBeTruthy();
    // One chart for both lines, named by both tables' captions.
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('img', { name: /^Planned payoff at expiration by XYZ price Current payoff at expiration by XYZ price/ })).toBeTruthy();
    // 1 contract bought at 1.90 with its 0.65 fee, worth nothing at 52.00, and 88.70 realized by the sale.
    expect(screen.getByText('If XYZ is at 52.00 at expiration: −$101.95')).toBeTruthy();

    // The expiration views are their own sections: no Mark-to-Market figure repeats them.
    await openDrawer(user, 'Today');
    expect(within(screen.getByRole('region', { name: 'Valuation' })).queryByText(/at expiration/)).toBeNull();
  });
});

describe('option Trade Detail value at expiration without a number (row 23.11)', () => {
  useFixedClock();
  const termIn = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;

  it('should word the value at expiration at the latest close by the module when the Underlying Mark is missing or the contract is past its settlement', async () => {
    const user = userEvent.setup();
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], { ...THURSDAY, underlyingMark: undefined }));
    await openDrawer(user, 'Payoff');
    await screen.findByRole('heading', { name: 'XYZ', level: 1 });
    expect(termIn("Value at expiration at XYZ's latest Mark")).toBe('Mark missing: XYZ, Thu Nov 19');
    cleanup();

    // The Monday after expiration, with no Mark for the expired contract.
    renderView(optionOpenDetail('O-S', [OS_S1], { tradingDate: '2026-11-23', closeInstant: '2026-11-23T21:00:00Z', underlyingMark: '46.00' }));
    await openDrawer(user, 'Payoff');
    await screen.findByRole('heading', { name: 'MNO', level: 1 });
    expect(termIn("Value at expiration at MNO's latest Mark")).toBe('Settlement Due: MNO 20 Nov 2026 45 Put');
  });
});

describe('Long Stock Trade Detail payoff sections (K1)', () => {
  useFixedClock();
  it('should show both payoff sections of a Long Stock Detail as Not applicable no option expiration', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2]));
    await openDrawer(user, 'Payoff');
    await screen.findByRole('heading', { name: 'XYZ', level: 1 });
    // One line (W14), not one for each view.
    const section = screen.getByRole('region', { name: 'Expiration Payoff' });
    expect(section.textContent).toBe('Expiration Payoff: Not applicable: no option expiration');
    expect(within(section).queryByRole('img')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Planned Expiration Payoff' })).toBeNull();
  });
});
