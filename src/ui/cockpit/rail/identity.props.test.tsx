// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { incoherentDetailOf, openDetailOf, PC1 } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionClosedDetail, optionOpenDetail, optionPlannedDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { ocChange, OC_E1, OC_PC1, OC_PC2, OC_X1, OS_ES, OS_S1, osChange } from '../../../../tests/support/option-trade-fixtures.ts';
import { plannedDetail } from '../../../../tests/support/views-fixtures.ts';
import type { TradeDetailView } from '../../../app/types.ts';
import { RuntimeContext } from '../../runtime.tsx';
import { THURSDAY } from '../../screens/trade-detail/test-support.ts';
import { IdentityCard } from './identity.tsx';

afterEach(cleanup);

const TUESDAY = { tradingDate: '2026-10-13', closeInstant: '2026-10-13T20:00:00Z', contractMark: '2.50', underlyingMark: '50.00' };

// Builds the view data in place (A216 lets only this file import `app/types`): the Long Call with a strike of 150 and the expiration line.
function longCall<V extends TradeDetailView & { readonly plan: { readonly legs: readonly { readonly instrument: object }[] } }>(
  view: V,
  expiration: { readonly status: 'Expires' | 'Expired'; readonly date: string; readonly days?: number },
): V {
  const leg = view.plan.legs[0]!;
  return { ...view, plan: { ...view.plan, legs: [{ ...leg, instrument: { ...leg.instrument, strike: '150' } }] }, contractExpiration: expiration };
}

function show(view: TradeDetailView, writable = true) {
  render(
    createElement(
      RuntimeContext.Provider,
      { value: { writable, report: () => undefined } },
      createElement(MemoryRouter, null, createElement(IdentityCard, { view, timeZone: 'America/New_York' })),
    ),
  );
}

const open = () => longCall(optionOpenDetail('O-C', [OC_PC1], TUESDAY), { status: 'Expires', date: '2026-12-18', days: 36 });

describe('identity card (W2)', () => {
  it(`should show the symbol once as the page heading, "Long Call, Open", "Strike 150", "Expires Fri 18 Dec 2026 (36 days)" and the account`, () => {
    show(open());
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['XYZ']);
    const badge = document.querySelector('.badge');
    expect(badge?.textContent).toBe('Long Call, Open');
    expect(badge?.getAttribute('data-tone')).toBe('info');
    expect(screen.getByText('Strike 150')).toBeTruthy();
    expect(screen.getByText('Expires Fri 18 Dec 2026 (36 days)')).toBeTruthy();
    expect(screen.getByText('Fidelity — Roth IRA')).toBeTruthy();
  });

  it(`should show "(1 day)" and "(today)", "Expired Fri 20 Nov 2026" on a Closed option Trade, and no strike or expiration line on stock`, () => {
    show(longCall(optionOpenDetail('O-C', [OC_PC1], TUESDAY), { status: 'Expires', date: '2026-12-18', days: 1 }));
    expect(screen.getByText('Expires Fri 18 Dec 2026 (1 day)')).toBeTruthy();
    cleanup();

    show(longCall(optionOpenDetail('O-C', [OC_PC1], TUESDAY), { status: 'Expires', date: '2026-12-18', days: 0 }));
    expect(screen.getByText('Expires Fri 18 Dec 2026 (today)')).toBeTruthy();
    cleanup();

    show(longCall(optionOpenDetail('O-C', [OC_PC1], TUESDAY), { status: 'Expires', date: '2026-12-18' }));
    expect(screen.getByText('Expires Fri 18 Dec 2026')).toBeTruthy();
    cleanup();

    show(longCall(optionClosedDetail('O-C', [OC_PC1, OC_PC2, OC_X1, OC_E1]), { status: 'Expired', date: '2026-11-20' }));
    expect(screen.getByText('Expired Fri 20 Nov 2026')).toBeTruthy();
    expect(document.querySelector('.badge')?.textContent).toBe('Long Call, Closed');
    cleanup();

    show(openDetailOf([PC1]));
    expect(document.querySelector('.badge')?.textContent).toBe('Long Stock, Open');
    expect(screen.queryByText(/^Strike /)).toBeNull();
    expect(screen.queryByText(/^Expire[sd] /)).toBeNull();
  });

  it('should show the expiration line on a Planned option Trade', () => {
    show(longCall(optionPlannedDetail('O-C'), { status: 'Expires', date: '2026-12-18', days: 36 }));
    expect(document.querySelector('.badge')?.textContent).toBe('Long Call, Planned');
    expect(screen.getByText('Strike 150')).toBeTruthy();
    expect(screen.getByText('Expires Fri 18 Dec 2026 (36 days)')).toBeTruthy();
    cleanup();

    show(plannedDetail);
    expect(screen.queryByText(/^Expire[sd] /)).toBeNull();
  });

  it('should offer Record entry and Record exit only while Writable, and neither on an incoherent Detail', () => {
    const incoherent = incoherentDetailOf([PC1], [{ factId: 'ex-1', kind: 'Execution', instrument: { kind: 'Stock', symbol: 'XYZ' }, economicTime: '2026-10-12T14:00:00Z', side: 'Buy', quantity: '60', reason: 'UnknownPlannedLeg' }]);
    const links = () => screen.queryAllByRole('link', { hidden: true }).filter((l) => /^Record /.test(l.textContent ?? '')).map((l) => [l.textContent, l.getAttribute('href')]);

    show(openDetailOf([PC1]));
    expect(links()).toEqual([['Record entry', '/trades/trade-1/record-entry'], ['Record exit', '/trades/trade-1/record-entry?action=Sell']]);
    cleanup();

    show(plannedDetail);
    expect(links()).toEqual([['Record entry', '/trades/trade-1/record-entry']]);
    cleanup();

    show(openDetailOf([PC1]), false);
    expect(links()).toEqual([]);
    cleanup();

    show(incoherent);
    expect(links()).toEqual([]);
  });
});

describe('identity card expiration line from the Detail (decision 94, row 23.19; moved from the retired Summary card, T8P.27)', () => {
  const expirationLines = () => screen.queryAllByText(/^Expire[sd] [A-Z][a-z]{2} \d/).map((line) => line.textContent);

  it('should show Expires Fri 20 Nov 2026 on an Open option Trade, Expired Fri 20 Nov 2026 on a Closed one whose Terminal Disposition includes an expiration, and no expiration line on one only the trader Executions disposed of', () => {
    show(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    expect(expirationLines()).toEqual(['Expires Fri 20 Nov 2026']);
    cleanup();

    // The mixed Trade (a sale plus an expiration) and the wholly expired one: part of the position expired.
    for (const view of [optionClosedDetail('O-C', [OC_PC1, OC_PC2, OC_X1, OC_E1]), optionClosedDetail('O-S', [OS_S1, OS_ES])]) {
      show(view);
      expect(expirationLines()).toEqual(['Expired Fri 20 Nov 2026']);
      cleanup();
    }
    for (const view of [
      optionClosedDetail('O-C', [OC_PC1, OC_PC2, ocChange('pc-x2', '2026-10-13T14:00:00Z', 5, 'Sell', '2', '3.00', '0.65')]),
      optionClosedDetail('O-S', [OS_S1, osChange('pc-b2', '2026-10-13T14:00:00Z', 3, 'Buy', '2', '0.60', '1.30')]),
    ]) {
      show(view);
      expect(expirationLines()).toEqual([]);
      cleanup();
    }
  });
});
