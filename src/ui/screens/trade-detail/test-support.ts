import { cleanup, render, screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, vi } from 'vitest';
import { facadeDouble } from '../../../../tests/support/facade-double.ts';
import { openDetailAt } from '../../../../tests/support/open-detail-fixtures.ts';
import type { OptionFrames } from '../../../../tests/support/option-detail-fixtures.ts';
import { ocChange } from '../../../../tests/support/option-trade-fixtures.ts';
import type { UiFacade } from '../../../app/compose.ts';
import type { TradeDetailView } from '../../../app/types.ts';
import { RuntimeContext } from '../../runtime.tsx';
import { TradeDetail } from '../TradeDetail.tsx';
import { RiskRewardSection } from './RiskReward.tsx';
import { SummaryCard } from './Summary.tsx';
import { ValuationSection } from './Valuation.tsx';

export function renderDetail(facade: UiFacade, path = '/trades/trade-1') {
  render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(Routes, null, createElement(Route, { path: '/trades/:tradeId', element: createElement(TradeDetail, { facade, timeZone: 'America/New_York' }) })),
    ),
  );
}

export function renderView(view: TradeDetailView, writable = true) {
  const facade = facadeDouble();
  vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view, binding: {} } as never);
  render(
    createElement(
      RuntimeContext.Provider,
      { value: { writable, report: () => undefined, timeZone: 'America/New_York' } },
      createElement(
        MemoryRouter,
        { initialEntries: ['/trades/trade-1'] },
        createElement(Routes, null, createElement(Route, { path: '/trades/:tradeId', element: createElement(TradeDetail, { facade, timeZone: 'America/New_York' }) })),
      ),
    ),
  );
}

// The retired Summary, Valuation and Risk and reward blocks (plan section 4.2), rendered beside the cockpit for the legacy section tests until
// T8P.27 pairs and removes them: the shell no longer renders them, so these tests read their components directly. Same view, same zone.
function legacyBlocks(view: TradeDetailView) {
  const open = 'positionChanges' in view && !('terminalDisposition' in view) ? view : undefined;
  return createElement(
    'div',
    null,
    !('recordedPositionChanges' in view) && createElement(SummaryCard, { view, timeZone: 'America/New_York' }),
    open && createElement(ValuationSection, { tradeId: open.tradeId, current: open.current, timeZone: 'America/New_York' }),
    open &&
      createElement(RiskRewardSection, {
        evaluation: open.current.evaluation,
        baseline: open.baseline,
        option: open.plan.legs[0]?.instrument.kind === 'Option',
        symbol: open.plan.underlying,
      }),
  );
}

export function renderLegacyDetail(facade: UiFacade, view: TradeDetailView, writable = true) {
  render(
    createElement(
      RuntimeContext.Provider,
      { value: { writable, report: () => undefined, timeZone: 'America/New_York' } },
      createElement(
        MemoryRouter,
        { initialEntries: ['/trades/trade-1'] },
        createElement(Routes, null, createElement(Route, { path: '/trades/:tradeId', element: createElement('div', null, createElement(TradeDetail, { facade, timeZone: 'America/New_York' }), legacyBlocks(view)) })),
      ),
    ),
  );
}

export function renderLegacyView(view: TradeDetailView, writable = true) {
  const facade = facadeDouble();
  vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view, binding: {} } as never);
  renderLegacyDetail(facade, view, writable);
}

// Selects a drawer by its W1 tab name and waits for its panel (D08P, A217). It first waits for the Detail's tab list, so a case calls it right
// after rendering.
export async function openDrawer(user: UserEvent, name: string) {
  const tab = await screen.findByRole('tab', { name });
  if (tab.getAttribute('aria-selected') !== 'true') await user.click(tab);
  await screen.findByRole('tabpanel', { name });
}

// The option Trade cases read the current year from the clock, so they fix it: expirations in 2026 are this year's.
export function useFixedClock() {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-08T17:00:00Z') });
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });
}


// The text of the definition following a term, within one region.
export const termValue = (region: HTMLElement, term: string) => within(region).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;

export const rowsOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    );

export const TUE_CLOSE = '2026-10-13T20:00:00Z';

export const available = (price: string, extra: { correctionReason?: string } = {}) =>
  ({ kind: 'Available', mark: { revisionId: 'm-1', revisionNumber: extra.correctionReason ? 2 : 1, price, source: 'Manual', savedAt: '2026-10-13T21:30:00Z', ...extra } }) as const;

export const tuesday = (resolution: Parameters<typeof openDetailAt>[1]['resolution']): Parameters<typeof openDetailAt>[1] => ({
  instrumentKey: 'XYZ',
  tradingDate: '2026-10-13',
  closeInstant: TUE_CLOSE,
  previousCloseInstant: '2026-10-12T20:00:00Z',
  resolution,
});

export const MON_CLOSE = '2026-10-12T20:00:00Z';

// Thursday 2026-11-19 at the close: the day before expiration, both Marks entered.
export const THURSDAY: OptionFrames = { tradingDate: '2026-11-19', closeInstant: '2026-11-19T21:00:00Z', contractMark: '0.80', underlyingMark: '52.00' };

// A third contract bought on O-C at 12:00 New York time: one above the planned two.
export const OC_PC3 = ocChange('pc-3', '2026-10-12T16:00:00Z', 8, 'Buy', '1', '2.00', '0.65');
