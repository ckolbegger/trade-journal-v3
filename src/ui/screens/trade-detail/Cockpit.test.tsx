// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { closedDetailOf } from '../../../../tests/support/closed-detail-fixtures.ts';
import { incoherentDetailOf, openDetailOf, PC1, PC2, X1, X2 } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionOpenDetail, type OptionFrames } from '../../../../tests/support/option-detail-fixtures.ts';
import { OS_S1 } from '../../../../tests/support/option-trade-fixtures.ts';
import { plannedDetail } from '../../../../tests/support/views-fixtures.ts';
import { renderView, useFixedClock } from './test-support.ts';

afterEach(cleanup);

const tabNames = () => within(screen.getByRole('tablist', { name: 'Detail' })).getAllByRole('tab').map((tab) => tab.textContent);
const selectedTab = () => screen.getByRole('tab', { selected: true }).textContent;

// Friday 2026-11-20 after the close: the expiration date, whose contracts are due for settlement.
const FRIDAY: OptionFrames = { tradingDate: '2026-11-20', closeInstant: '2026-11-20T21:00:00Z', contractMark: '0.80', underlyingMark: '52.00' };

describe('Trade Detail cockpit (W1, A217)', () => {
  it("should show an Open Trade's rail with the identity, P&L, Conditions and Needs you cards beside a Detail tab list of Today, Position, Plan and Risk, Price History, Journal and Payoff in that order, with Today selected", async () => {
    renderView(openDetailOf([PC1, PC2]));
    const rail = await screen.findByRole('region', { name: 'State of play' });
    // The identity card is the rail's first card; the Summary, Valuation and Risk and reward figures stay as legacy blocks (plan section 4.2).
    expect(within(rail).getByRole('heading', { name: 'XYZ', level: 1 })).toBeTruthy();
    expect(within(rail).getByRole('region', { name: 'Summary' })).toBeTruthy();
    // The tab list sits beside the rail, not in it.
    const tablist = screen.getByRole('tablist', { name: 'Detail' });
    expect(rail.contains(tablist)).toBe(false);
    expect(tabNames()).toEqual(['Today', 'Position', 'Plan and Risk', 'Price History', 'Journal', 'Payoff']);
    expect(selectedTab()).toBe('Today');
    // Only the selected drawer is mounted: Today holds the Valuation, and Position's content is absent.
    const panel = screen.getByRole('tabpanel', { name: 'Today' });
    expect(within(panel).getByRole('region', { name: 'Valuation' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Open Lots' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Position' })).toBeNull();
  });

  it('should show only Plan and Risk, Journal and Payoff on a Planned Detail, with Plan and Risk selected', async () => {
    renderView(plannedDetail);
    await screen.findByRole('region', { name: 'State of play' });
    expect(tabNames()).toEqual(['Plan and Risk', 'Journal', 'Payoff']);
    expect(selectedTab()).toBe('Plan and Risk');
    expect(within(screen.getByRole('tabpanel', { name: 'Plan and Risk' })).getByRole('region', { name: 'Plan' })).toBeTruthy();
  });

  describe('Closed and Settlement Due', () => {
    useFixedClock();
    it('should leave out Today on a Closed or Settlement Due Detail, and select Position', async () => {
      renderView(closedDetailOf([PC1, PC2, X1, X2]));
      await screen.findByRole('region', { name: 'State of play' });
      expect(tabNames()).not.toContain('Today');
      expect(tabNames()[0]).toBe('Position');
      expect(selectedTab()).toBe('Position');
      expect(within(screen.getByRole('tabpanel', { name: 'Position' })).getByRole('region', { name: 'Result' })).toBeTruthy();
      cleanup();

      // The Valuation and Risk and reward legacy blocks go to the default drawer, so no figure disappears with Today.
      renderView(optionOpenDetail('O-S', [OS_S1], FRIDAY));
      await screen.findByRole('region', { name: 'State of play' });
      expect(tabNames()).not.toContain('Today');
      expect(selectedTab()).toBe('Position');
      const panel = screen.getByRole('tabpanel', { name: 'Position' });
      expect(within(panel).getByRole('region', { name: 'Valuation' })).toBeTruthy();
      expect(within(panel).getByRole('region', { name: 'Position' })).toBeTruthy();
      // The Settlement Due panel stands in the rail.
      expect(within(screen.getByRole('region', { name: 'State of play' })).getByRole('region', { name: 'Settlement Due' })).toBeTruthy();
    });
  });

  it("should show the Facts can't be replayed region across the page above the rail on an incoherent Detail, with only Position, Plan and Risk and Journal", async () => {
    const findings = [{ factId: 'pc-9', kind: 'PositionChange', economicTime: '2026-10-14T14:30:00Z', reason: 'DuplicateFactId' }] as const;
    renderView(incoherentDetailOf([PC1, PC2], findings));
    const banner = await screen.findByRole('region', { name: "Facts can't be replayed" });
    const rail = screen.getByRole('region', { name: 'State of play' });
    expect(banner.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rail.contains(banner)).toBe(false);
    expect(screen.getByRole('tablist', { name: 'Detail' }).contains(banner)).toBe(false);
    expect(tabNames()).toEqual(['Position', 'Plan and Risk', 'Journal']);
    expect(selectedTab()).toBe('Position');
  });

  it('should move between the shown drawers with the arrow keys, Home and End, and keep focus on the selected tab', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2]));
    await screen.findByRole('region', { name: 'State of play' });
    screen.getByRole('tab', { name: 'Today' }).focus();
    const expectOn = (name: string) => {
      expect(selectedTab()).toBe(name);
      expect(document.activeElement).toBe(screen.getByRole('tab', { name }));
      expect(screen.getByRole('tabpanel', { name })).toBeTruthy();
    };
    await user.keyboard('{ArrowRight}');
    expectOn('Position');
    await user.keyboard('{End}');
    expectOn('Payoff');
    await user.keyboard('{ArrowRight}');
    expectOn('Today');
    await user.keyboard('{ArrowLeft}');
    expectOn('Payoff');
    await user.keyboard('{Home}');
    expectOn('Today');
    // One tab stop: only the selected tab is in the tab order.
    expect(screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
  });
});
