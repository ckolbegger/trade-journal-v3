// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { closedDetailOf } from '../../../../tests/support/closed-detail-fixtures.ts';
import { execution, incoherentDetailOf, openDetailAt, openDetailOf, PC1, PC2, positionChange, X1, X2 } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionClosedDetail, optionOpenDetail, optionPlannedDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { OC_E1, OC_PC1, OC_PC2, OC_X1 } from '../../../../tests/support/option-trade-fixtures.ts';
import { plannedDetail } from '../../../../tests/support/views-fixtures.ts';
import type { OpenTradeDetail, TradeDetailView } from '../../../app/types.ts';
import { Rational } from '../../../domain/values/index.ts';
import { available, MON_CLOSE, useFixedClock } from '../../screens/trade-detail/test-support.ts';
import type { PnlReplay } from './pnl.props.ts';
import { PnlCard } from './pnl.tsx';

afterEach(cleanup);

const WEDNESDAY = { tradingDate: '2026-10-14', closeInstant: '2026-10-14T20:00:00Z', contractMark: '2.90', underlyingMark: '57.40' };

const cents = (value: bigint) => ({ kind: 'Value' as const, value: Rational.of(value, 100n) });

// O-C3 on Wednesday: 1 of the 2 planned contracts still held, Trade P&L $188.05 (breakdown, section 5). The fixture trade is O-C, so its
// current Trade P&L is replaced by O-C3's figure.
function oc3(): OpenTradeDetail {
  const view = optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], WEDNESDAY);
  return { ...view, current: { ...view.current, evaluation: { ...view.current.evaluation, currentMarkedPnl: cents(18805n) } } };
}

// Wednesday's session changed by +$169.35 since Monday's, as the replay's newest session reports it.
const sinceMonday: PnlReplay = {
  sessions: [
    { change: null },
    { change: null },
    { change: { since: '2026-10-12', dollars: Rational.of(16935n, 100n) } },
  ],
};

function show(view: TradeDetailView, replay?: PnlReplay) {
  render(createElement(PnlCard, { view, timeZone: 'America/New_York', ...(replay && { replay }) }));
  return screen.getByRole('region', { name: 'Trade P&L' });
}

describe('P&L card (W3, W4)', () => {
  // The option Trade cases read the current year from the clock, so it is fixed: expirations in 2026 are this year's.
  useFixedClock();

  it('should show O-C3\'s Trade P&L $188.05 with "+$169.35 since Mon Oct 12" and "1 of 2 contracts open"', () => {
    const card = show(oc3(), sinceMonday);
    expect(within(card).getByText('$188.05')).toBeTruthy();
    expect(within(card).getByText('+$169.35 since Mon Oct 12')).toBeTruthy();
    expect(within(card).getByText('1 of 2 contracts open')).toBeTruthy();
    expect(card.querySelector('.pnl-figure')?.getAttribute('data-tone')).toBe('gain');
    expect(card.querySelector('.pnl-line')?.getAttribute('data-tone')).toBe('gain');
    cleanup();

    // A stock Trade counts shares (A221).
    expect(within(show(openDetailOf([PC1, PC2]))).getByText('100 of 100 shares open')).toBeTruthy();
  });

  it('should show the reason at the figure length and no change line when the current Trade P&L is unavailable', () => {
    const missing = optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], { tradingDate: '2026-10-14', closeInstant: '2026-10-14T20:00:00Z' });
    // A replay is at hand, and still no change is shown beside a figure that is not there.
    const card = show(missing, sinceMonday);
    expect(card.querySelector('.pnl-figure')?.textContent).toBe('Mark missing: XYZ 20 Nov 2026 55 Call, Wed Oct 14');
    expect(card.querySelector('.pnl-figure')?.getAttribute('data-tone')).toBeNull();
    expect(card.querySelector('.pnl-line')).toBeNull();
    expect(within(card).getByText('1 of 2 contracts open')).toBeTruthy();
  });

  it('should show "—" and "Trade P&L once today\'s session ends" before any Marks, and the Planned words on a Planned Detail', () => {
    // Shares bought after the close the figures are valued at, with no earlier Mark: nothing is marked yet.
    const afterClose = positionChange('pc-9', 3, [execution('ex-9', '2026-10-12T21:00:00Z', 4, '40', '50.30', '1.00')]);
    const monday = { instrumentKey: 'XYZ', tradingDate: '2026-10-12', closeInstant: MON_CLOSE, previousCloseInstant: '2026-10-09T20:00:00Z', resolution: { kind: 'Missing' } } as const;
    const card = show(openDetailAt([afterClose], monday), sinceMonday);
    expect(card.querySelector('.pnl-figure')?.textContent).toBe('—');
    expect(card.querySelector('.pnl-line')?.textContent).toBe("Trade P&L once today's session ends");
    expect(within(card).getByText('40 of 100 shares open')).toBeTruthy();
    cleanup();

    // The same Detail with an earlier close's dated line has Marks, so the figure says why it waits for the next close.
    const dated = openDetailAt([PC1, afterClose], { ...monday, resolution: available('51.20') });
    expect(show(dated).querySelector('.pnl-figure')?.textContent).toBe('Awaiting the close after Mon Oct 12');
    cleanup();

    // A missing Mark is not "no Marks yet": it is the reason, at the figure length.
    expect(show(openDetailAt([PC1], monday)).querySelector('.pnl-figure')?.textContent).toBe('Mark missing: XYZ, Mon Oct 12');
    cleanup();

    const planned = show(plannedDetail);
    expect(planned.querySelector('.pnl-figure')?.textContent).toBe('—');
    expect(planned.querySelector('.pnl-line')?.textContent).toBe('Trade P&L once the entry is recorded and marked');
    expect(within(planned).getByText('0 of 100 shares open')).toBeTruthy();
    cleanup();

    expect(within(show(optionPlannedDetail('O-C'))).getByText('0 of 2 contracts open')).toBeTruthy();
  });

  it("should show a Closed Trade's realized P&L, its R, and the Result rows", () => {
    const rowsOf = (card: HTMLElement) => [...card.querySelectorAll('dt')].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]);

    const stock = show(closedDetailOf([PC1, PC2, X1, X2], { closeReason: { id: 'cr-1', label: 'Target reached' } }));
    expect(stock.querySelector('.pnl-figure')?.textContent).toBe('$248.00');
    expect(stock.querySelector('.pnl-figure')?.getAttribute('data-tone')).toBe('gain');
    expect(stock.querySelector('.pnl-line')?.textContent).toBe('+0.99R realized, final');
    expect(stock.querySelector('.pnl-line')?.getAttribute('data-tone')).toBe('gain');
    expect(rowsOf(stock)).toEqual([
      ['Terminal Disposition', 'Closed via sale of 100 shares'],
      ['Close Reason', 'Target reached'],
    ]);
    // Nothing is open any more, and the Result rows are the card's own, not the Position drawer's.
    expect(stock.querySelector('.pnl-open')).toBeNull();
    cleanup();

    const option = show(optionClosedDetail('O-C', [OC_PC1, OC_PC2, OC_X1, OC_E1]));
    expect(rowsOf(option)).toEqual([
      ['Terminal Disposition', 'Closed via sale of 1 contract and expiration of 1 contract'],
      ['Option Disposition Timing', 'Mixed: 1 before expiration, 1 at expiration'],
    ]);
    expect(option.querySelector('.pnl-open')).toBeNull();
  });

  it('should name the contract on a Settlement Due Detail, and show "Not available" on an incoherent one', () => {
    // The contract expired on 20 Nov and is still held on the Monday after: the Trade P&L waits for the expiration to be recorded.
    const monday = { tradingDate: '2026-11-23', closeInstant: '2026-11-23T21:00:00Z', contractMark: '0.80', underlyingMark: '52.00' };
    const due = show(optionOpenDetail('O-C', [OC_PC1, OC_PC2], monday), sinceMonday);
    expect(due.querySelector('.pnl-figure')?.textContent).toBe('Settlement Due: XYZ 20 Nov 2026 55 Call');
    expect(due.querySelector('.pnl-line')?.textContent).toBe('Trade P&L once the expiration is recorded');
    expect(due.querySelector('.pnl-open')).toBeNull();
    cleanup();

    const finding = { factId: 'ex-1', kind: 'Execution', instrument: { kind: 'Stock', symbol: 'XYZ' }, economicTime: '2026-10-12T14:00:00Z', side: 'Buy', quantity: '60', reason: 'UnknownPlannedLeg' } as const;
    const incoherent = show(incoherentDetailOf([PC1], [finding]), sinceMonday);
    expect(incoherent.querySelector('.pnl-figure')?.textContent).toBe('Not available');
    expect(incoherent.querySelector('.pnl-line')?.textContent).toBe('Trade P&L');
    expect(incoherent.querySelector('.pnl-open')).toBeNull();
  });
});
