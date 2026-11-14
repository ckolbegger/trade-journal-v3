// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closedDetailOf } from '../../../../tests/support/closed-detail-fixtures.ts';
import { facadeDouble } from '../../../../tests/support/facade-double.ts';
import { incoherentDetailOf, openDetailOf, PC1, PC2, X1, X2 } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionOpenDetail, type OptionFrames } from '../../../../tests/support/option-detail-fixtures.ts';
import { OS_S1 } from '../../../../tests/support/option-trade-fixtures.ts';
import { reflectionDefinition } from '../../../../tests/support/position-change-form-facade.ts';
import { plannedDetail } from '../../../../tests/support/views-fixtures.ts';
import type { TradeDetailDebt } from '../../../app/types.ts';
import { RuntimeContext } from '../../runtime.tsx';
import { TradeDetail } from '../TradeDetail.tsx';
import { openDrawer, renderView, useFixedClock } from './test-support.ts';

afterEach(cleanup);

// A tab's name is its W1 name; a count (W1) is its description and its visible text, so the name is read from the accessible name.
const nameOf = (tab: HTMLElement) => tab.getAttribute('aria-label');
const tabNames = () => within(screen.getByRole('tablist', { name: 'Detail' })).getAllByRole('tab').map(nameOf);
const selectedTab = () => nameOf(screen.getByRole('tab', { selected: true }));

// Friday 2026-11-20 after the close: the expiration date, whose contracts are due for settlement.
const FRIDAY: OptionFrames = { tradingDate: '2026-11-20', closeInstant: '2026-11-20T21:00:00Z', contractMark: '0.80', underlyingMark: '52.00' };

describe('Trade Detail cockpit (W1, A217)', () => {
  it("should show an Open Trade's rail with the identity, P&L, Conditions and Needs you cards beside a Detail tab list of Today, Position, Plan and Risk, Price History, Journal and Payoff in that order, with Today selected", async () => {
    renderView(openDetailOf([PC1, PC2]));
    const rail = await screen.findByRole('region', { name: 'State of play' });
    // The identity card is the rail's first card; the Summary card is retired (T8P.22), so the Trade P&L card follows Needs you.
    expect(within(rail).getByRole('heading', { name: 'XYZ', level: 1 })).toBeTruthy();
    expect(within(rail).getByRole('region', { name: 'Trade P&L' })).toBeTruthy();
    expect(screen.queryAllByRole('region', { name: 'Summary', hidden: true })).toEqual([]);
    // The tab list sits beside the rail, not in it.
    const tablist = screen.getByRole('tablist', { name: 'Detail' });
    expect(rail.contains(tablist)).toBe(false);
    expect(tabNames()).toEqual(['Today', 'Position', 'Plan and Risk', 'Price History', 'Journal', 'Payoff']);
    expect(selectedTab()).toBe('Today');
    // Every shown drawer is mounted and the unselected ones are hidden (T8P.5-B1): Position's content is present in its own hidden panel, where
    // an accessible query without `hidden: true` cannot see it. The Valuation section is retired (T8P.22).
    expect(screen.getByRole('tabpanel', { name: 'Today' })).toBeTruthy();
    expect(screen.queryAllByRole('region', { name: 'Valuation', hidden: true })).toEqual([]);
    const position = document.getElementById('drawer-panel-position')!;
    expect(position.hidden).toBe(true);
    expect(within(position).getByRole('region', { name: 'Open Lots', hidden: true })).toBeTruthy();
    expect(within(position).getByRole('region', { name: 'Position', hidden: true })).toBeTruthy();
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

      // The Valuation and Risk and reward legacy blocks are retired (T8P.22), so the default drawer holds the Position.
      renderView(optionOpenDetail('O-S', [OS_S1], FRIDAY));
      await screen.findByRole('region', { name: 'State of play' });
      expect(tabNames()).not.toContain('Today');
      expect(selectedTab()).toBe('Position');
      const panel = screen.getByRole('tabpanel', { name: 'Position' });
      for (const name of ['Valuation', 'Risk and reward']) expect(screen.queryAllByRole('region', { name, hidden: true }), name).toEqual([]);
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

  it("should let the keyboard reach the selected drawer's panel", async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2]));
    await openDrawer(user, 'Plan and Risk');
    // Plan and Risk has no focusable first content, so the panel itself is a tab stop.
    expect(screen.getByRole('tabpanel', { name: 'Plan and Risk' }).tabIndex).toBe(0);
  });

  describe('a Journal drawer left and returned to', () => {
    const debt: TradeDetailDebt = {
      kind: 'Debt',
      id: 'debt-1',
      entryType: 'Position Change Reflection',
      entryTypeKey: 'entry-type.position-change-reflection',
      source: 'Position Change',
      anchor: { kind: 'Trade', tradeId: 'trade-1' },
      momentTime: '2026-10-12T14:00:00Z',
      positionChangeId: 'pc-1',
      definitionId: 'def-pcr-1',
      dueAnchor: '2026-10-13T20:00:00Z',
      revision: 'debt-1-rev-1',
      dueStatus: 'Due',
    };
    const renderOwed = (writable = true, debts: readonly TradeDetailDebt[] = [debt]) => {
      const facade = facadeDouble();
      vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: openDetailOf([PC1, PC2], { journal: debts }), binding: {} } as never);
      vi.mocked(facade.Journal.getDefinitions).mockResolvedValue({ kind: 'Found', definition: reflectionDefinition } as never);
      vi.mocked(facade.Journal.save).mockResolvedValue({ kind: 'Saved', decline: { id: 'decl-1' }, debt: { debtId: 'debt-1' }, currentOutcome: { kind: 'Decline', id: 'decl-1' }, snapshot: { journalRevision: 5 } } as never);
      const onDirtyChange = vi.fn();
      render(
        <RuntimeContext.Provider value={{ writable, report: () => undefined }}>
          <MemoryRouter initialEntries={['/trades/trade-1']}>
            <Routes>
              <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" onDirtyChange={onDirtyChange} />} />
            </Routes>
          </MemoryRouter>
        </RuntimeContext.Provider>,
      );
      return onDirtyChange;
    };

    it("should select the Journal drawer and open that Debt's form when Reflect now is chosen in Needs you", async () => {
      const user = userEvent.setup();
      renderOwed();
      const needsYou = await screen.findByRole('region', { name: 'Needs you' });
      expect(selectedTab()).toBe('Today');
      await user.click(within(needsYou).getByRole('button', { name: 'Reflect now' }));
      expect(selectedTab()).toBe('Journal');
      // The form opens on the Debt's card in the Journal drawer, not in the rail.
      const form = await within(screen.getByRole('tabpanel', { name: 'Journal' })).findByRole('form', { name: 'Reflection' });
      expect(form).toBeTruthy();
      expect(within(needsYou).queryByRole('form', { name: 'Reflection', hidden: true })).toBeNull();
      cleanup();

      // Read only, no Reflect now is offered anywhere on the page, the hidden drawers included.
      renderOwed(false);
      await screen.findByRole('region', { name: 'Needs you' });
      expect(within(screen.getByRole('region', { name: 'Needs you' })).getByText('Position Change Reflection Reflection owed')).toBeTruthy();
      expect([...document.querySelectorAll('button')].filter((button) => button.textContent === 'Reflect now')).toEqual([]);
    });

    it("should open the chosen Debt's form when two Debts of one Entry Type fall in the same minute", async () => {
      const user = userEvent.setup();
      // Two Position Change Reflections 30 seconds apart, so the same minute on the clock.
      const first: TradeDetailDebt = { ...debt, id: 'debt-1', revision: 'debt-1-rev-1', positionChangeId: 'pc-1', momentTime: '2026-10-12T14:00:10Z' };
      const second: TradeDetailDebt = { ...debt, id: 'debt-2', revision: 'debt-2-rev-1', positionChangeId: 'pc-2', momentTime: '2026-10-12T14:00:40Z' };
      renderOwed(true, [first, second]);
      const needsYou = await screen.findByRole('region', { name: 'Needs you' });
      await user.click(within(needsYou).getAllByRole('button', { name: 'Reflect now' })[1]!);
      const journal = screen.getByRole('tabpanel', { name: 'Journal' });
      await within(journal).findByRole('form', { name: 'Reflection' });
      // The form is on the second Debt's item, and the first Debt's item has none, hidden or not.
      const items = [...journal.querySelectorAll('li')].filter((item) => item.querySelector('h3')?.textContent?.includes('Reflection owed'));
      expect(items).toHaveLength(2);
      expect(items[0]!.querySelector('form')).toBeNull();
      expect(items[1]!.querySelector('form')).not.toBeNull();
      // A second Reflect now on the same Debt works again once its form is closed.
      await user.click(within(items[1] as HTMLElement).getByRole('button', { name: 'Cancel' }));
      expect(items[1]!.querySelector('form')).toBeNull();
      await user.click(within(needsYou).getAllByRole('button', { name: 'Reflect now' })[1]!);
      await waitFor(() => expect(items[1]!.querySelector('form')).not.toBeNull());
      expect(items[0]!.querySelector('form')).toBeNull();
    });

    it('should keep an unsaved reflection when the reader moves to another drawer and back', async () => {
      const user = userEvent.setup();
      const onDirtyChange = renderOwed();
      await openDrawer(user, 'Journal');
      await user.click(await within(await screen.findByRole('tabpanel', { name: 'Journal' })).findByRole('button', { name: 'Reflect now' }));
      const form = await screen.findByRole('form', { name: 'Reflection' });
      await user.click(within(within(form).getByRole('radiogroup', { name: 'Decision mode' })).getByLabelText('Reactive'));
      expect(onDirtyChange).toHaveBeenLastCalledWith(true);

      await openDrawer(user, 'Plan and Risk');
      // The leave-page guard stays registered while the answers are held.
      expect(onDirtyChange).toHaveBeenLastCalledWith(true);
      await openDrawer(user, 'Journal');
      const again = screen.getByRole('form', { name: 'Reflection' });
      expect(within(within(again).getByRole('radiogroup', { name: 'Decision mode' })).getByLabelText<HTMLInputElement>('Reactive').checked).toBe(true);
    });

    it('should still show a saved reflection as saved after moving to another drawer and back', async () => {
      const user = userEvent.setup();
      renderOwed();
      await openDrawer(user, 'Journal');
      await user.click(await within(await screen.findByRole('tabpanel', { name: 'Journal' })).findByRole('button', { name: 'Reflect now' }));
      await user.click(await screen.findByRole('button', { name: 'Decline' }));
      await screen.findByRole('region', { name: 'Saved reflection' });

      await openDrawer(user, 'Plan and Risk');
      await openDrawer(user, 'Journal');
      expect(screen.getByRole('region', { name: 'Saved reflection' })).toBeTruthy();
      expect(screen.queryByText('Reflection owed')).toBeNull();
    });
  });
});

// The retired Summary card, Valuation and Risk and reward sections are gone from every state, hidden drawer panels included (T8P.27, revision 86;
// moved from the legacy Summary tests' absence checks).
describe('Trade Detail cockpit: no retired block on any state (T8P.27)', () => {
  useFixedClock();
  const retired = () => ['Summary', 'Valuation', 'Risk and reward'].flatMap((name) => screen.queryAllByRole('region', { name, hidden: true }));
  const retiredByDom = () => document.querySelectorAll('[aria-label="Summary"], [aria-label="Valuation"], [aria-label="Risk and reward"], .summary-card');

  it('should render no Summary, Valuation or Risk and reward region on a Planned, Open, Closed, incoherent or option Detail, and no Net cost on a Planned one', async () => {
    const findings = [{ factId: 'pc-9', kind: 'PositionChange', economicTime: '2026-10-14T14:30:00Z', reason: 'DuplicateFactId' }] as const;
    for (const view of [plannedDetail, openDetailOf([PC1, PC2]), closedDetailOf([PC1, PC2, X1, X2]), incoherentDetailOf([PC1, PC2], findings), optionOpenDetail('O-S', [OS_S1], FRIDAY)]) {
      renderView(view);
      await screen.findByRole('region', { name: 'State of play' });
      expect(retired()).toEqual([]);
      expect(retiredByDom()).toHaveLength(0);
      cleanup();
    }
    renderView(plannedDetail);
    await screen.findByRole('region', { name: 'State of play' });
    expect(Array.from(document.querySelectorAll('dt')).filter((term) => term.textContent === 'Net cost')).toEqual([]);
  });
});
