// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { plannedDetail } from '../../../tests/support/views-fixtures.ts';
import type { UiFacade } from '../../app/compose.ts';
import { TradeDetail } from './TradeDetail.tsx';

afterEach(cleanup);

function renderDetail(facade: UiFacade, path = '/trades/trade-1') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Trade Detail', () => {
  it('should show the Plan, Planned Leg, Stop, Target, Plan Baseline, 1R, the "Planned" lifecycle as text (not only colour), and the Plan Reflection with its snapshot prompt labels', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: plannedDetail, binding: {} } as never);
    renderDetail(facade);
    expect(await screen.findByRole('heading', { name: 'XYZ', level: 1 })).toBeTruthy();
    expect(screen.getByText('Planned', { selector: '.badge' })).toBeTruthy();
    const plan = screen.getByRole('region', { name: 'Plan' });
    const value = (term: string) => within(plan).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
    expect(value('Leg')).toBe('Long 100 shares of XYZ');
    expect(value('Intended entry')).toBe('$50.00');
    expect(value('Stop')).toBe('$47.50');
    expect(value('Target')).toBe('$56.00');
    expect(value('Plan time')).toBe('2026-10-12 09:30');
    expect(value('Account')).toBe('Fidelity — Roth IRA');
    const baseline = screen.getByRole('region', { name: 'Plan Baseline' });
    const figure = (term: string) => within(baseline).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
    expect(figure('1R (original risk)')).toBe('$250.00');
    expect(figure('Original reward')).toBe('$600.00');
    expect(figure('Reward : risk')).toBe('2.4');
    const reflection = screen.getByRole('region', { name: 'Plan Reflection' });
    expect(within(reflection).getByText('Why this trade, why now?')).toBeTruthy();
    expect(within(reflection).getByText('Breakout above the 50-day.')).toBeTruthy();
    expect(within(reflection).getByText('Calm')).toBeTruthy();
  });

  it('should render NotFound and Error states distinctly', async () => {
    const missing = facadeDouble();
    vi.mocked(missing.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'NotFound' });
    renderDetail(missing);
    expect(await screen.findByRole('heading', { name: 'Trade not found' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    cleanup();

    const failing = facadeDouble();
    vi.mocked(failing.TradeViewsAndReporting.getTradeDetail)
      .mockResolvedValueOnce({ kind: 'ChangedDuringAssembly' })
      .mockResolvedValueOnce({ kind: 'Ready', view: plannedDetail, binding: {} } as never);
    renderDetail(failing);
    expect(await screen.findByText(/couldn’t load this trade/i)).toBeTruthy();
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(await screen.findByRole('heading', { name: 'XYZ', level: 1 })).toBeTruthy();
  });
});
