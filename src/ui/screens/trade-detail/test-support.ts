import { cleanup, render, within } from '@testing-library/react';
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
