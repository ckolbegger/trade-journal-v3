// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { ocExcess, optionClosedDetail, optionOpenDetail, type OptionFrames } from '../../../tests/support/option-detail-fixtures.ts';
import { incoherentDetailOf, openDetailOf, PC1, PC2, X1 } from '../../../tests/support/open-detail-fixtures.ts';
import { ocChange, OC_CONTRACT, OC_E1, OC_PC1, OC_PC2, OC_X1, OS_ES, OS_S1, osChange } from '../../../tests/support/option-trade-fixtures.ts';
import type { TradeDetailView } from '../../app/types.ts';
import { RuntimeContext } from '../runtime.tsx';
import { TradeDetail } from './TradeDetail.tsx';

// The current year is read from the clock, so the tests fix it: expirations in 2026 are this year's.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-08T17:00:00Z') });
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function renderView(view: TradeDetailView, writable = true) {
  const facade = facadeDouble();
  vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view, binding: {} } as never);
  render(
    <RuntimeContext.Provider value={{ writable, report: () => undefined, timeZone: 'America/New_York' }}>
      <MemoryRouter initialEntries={['/trades/trade-1']}>
        <Routes>
          <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" />} />
        </Routes>
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}

// The text of the definition following a term, within one region.
const termValue = (region: HTMLElement, term: string) => within(region).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;

// Thursday 2026-11-19 at the close: the day before expiration, both Marks entered.
const THURSDAY: OptionFrames = { tradingDate: '2026-11-19', closeInstant: '2026-11-19T21:00:00Z', contractMark: '0.80', underlyingMark: '52.00' };
// Friday 2026-11-20 after the close: the expiration date, whose contracts are due for settlement.
const FRIDAY: OptionFrames = { tradingDate: '2026-11-20', closeInstant: '2026-11-20T21:00:00Z', contractMark: '0.80', underlyingMark: '52.00' };

describe('option Trade Detail (A119)', () => {
  it('should show the contract label, Exercise Intent and the Trade Summary on an open option Trade, with its contracts in the Position and the expiration line', async () => {
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    await screen.findByRole('heading', { name: 'XYZ', level: 1 });
    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(summary.querySelector('.summary-text')?.textContent).toBe('Long 1 Nov 20 $55 Call');
    expect(termValue(summary, 'Quantity')).toBe('1 of 2 contracts');

    const plan = screen.getByRole('region', { name: 'Plan' });
    expect(termValue(plan, 'Contract')).toBe('XYZ 20 Nov 2026 55 Call');
    expect(termValue(plan, 'Leg')).toBe('Long 2 contracts of XYZ 20 Nov 2026 55 Call');
    expect(termValue(plan, 'Exercise Intent')).toBe('Not authorized in advance');

    const position = screen.getByRole('region', { name: 'Position' });
    expect(termValue(position, 'Position')).toBe('Long 1 contract of XYZ 20 Nov 2026 55 Call');
    expect(screen.getByText('Expires Fri 20 Nov 2026')).toBeTruthy();
  });
});

describe('option Trade Detail Valuation Underlying Mark (row 23.18)', () => {
  it('should show the Valuation sections Underlying Mark with its price and provenance, Manual', async () => {
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    const valuation = await screen.findByRole('region', { name: 'Valuation' });
    expect(termValue(valuation, 'Underlying Mark')).toBe('$52.00 · Manual');
  });
});

describe('option Trade Detail payoff sections (A119, A122)', () => {
  it('should show the Planned and Current payoff sections apart from the Valuation, with the value at expiration at the latest close beside the Current chart', async () => {
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    const planned = await screen.findByRole('region', { name: 'Planned Expiration Payoff' });
    expect(within(planned).getByRole('img', { name: 'Planned payoff at expiration by XYZ price' })).toBeTruthy();

    const current = screen.getByRole('region', { name: 'Current Expiration Payoff' });
    expect(within(current).getByRole('img', { name: /^Current payoff at expiration by XYZ price/ })).toBeTruthy();
    // 1 contract bought at 1.90 with its 0.65 fee, worth nothing at 52.00, and 88.70 realized by the sale.
    expect(within(current).getByText('If XYZ is at 52.00 at expiration: −$101.95')).toBeTruthy();

    // The expiration views are their own sections: no Mark-to-Market figure repeats them.
    expect(within(screen.getByRole('region', { name: 'Valuation' })).queryByText(/at expiration/)).toBeNull();
  });
});

describe('option Trade Detail value at expiration without a number (row 23.11)', () => {
  const termIn = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;

  it('should word the value at expiration at the latest close by the module when the Underlying Mark is missing or the contract is past its settlement', async () => {
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], { ...THURSDAY, underlyingMark: undefined }));
    await screen.findByRole('heading', { name: 'XYZ', level: 1 });
    expect(termIn("Value at expiration at XYZ's latest close")).toBe('Mark missing: XYZ, Thu Nov 19');
    cleanup();

    // The Monday after expiration, with no Mark for the expired contract.
    renderView(optionOpenDetail('O-S', [OS_S1], { tradingDate: '2026-11-23', closeInstant: '2026-11-23T21:00:00Z', underlyingMark: '46.00' }));
    await screen.findByRole('heading', { name: 'MNO', level: 1 });
    expect(termIn("Value at expiration at MNO's latest close")).toBe('Settlement Due: MNO 20 Nov 2026 45 Put');
  });
});

describe('Long Stock Trade Detail payoff sections (K1)', () => {
  it('should show both payoff sections of a Long Stock Detail as Not applicable no option expiration', async () => {
    renderView(openDetailOf([PC1, PC2]));
    await screen.findByRole('heading', { name: 'XYZ', level: 1 });
    for (const heading of ['Planned Expiration Payoff', 'Current Expiration Payoff']) {
      const section = screen.getByRole('region', { name: heading });
      expect(within(section).getByText('Not applicable: no option expiration')).toBeTruthy();
      expect(within(section).queryByRole('img')).toBeNull();
    }
  });
});

describe('option Trade Detail Settlement Due panel (rows 23.9 and 23.10)', () => {
  it('should show a Settlement Due panel with the contract, quantity, expiry and settlement time, an explanation keyed by the quantity sign, and Record expiration only while Writable', async () => {
    renderView(optionOpenDetail('O-S', [OS_S1], FRIDAY), true);
    const panel = await screen.findByRole('region', { name: 'Settlement Due' });
    expect(termValue(panel, 'Contract')).toBe('MNO 20 Nov 2026 45 Put');
    expect(termValue(panel, 'Quantity')).toBe('Short 2 contracts');
    expect(termValue(panel, 'Expired')).toBe('Fri Nov 20');
    expect(termValue(panel, 'Settlement time')).toBe('Fri Nov 20, 16:00');
    expect(within(panel).getByText("If it was assigned, this release can't record the assignment yet, so this Trade stays open until a later release can.")).toBeTruthy();
    expect(within(panel).getByRole('link', { name: 'Record expiration' }).getAttribute('href')).toBe('/trades/trade-1/record-expiration');
    // Due, the panel stands in for the expiration line.
    expect(screen.queryByText(/^Expires /)).toBeNull();
    cleanup();

    // A long contract is worded by its sign, not by the Strategy.
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], FRIDAY), false);
    const long = await screen.findByRole('region', { name: 'Settlement Due' });
    expect(termValue(long, 'Quantity')).toBe('Long 1 contract');
    expect(within(long).getByText("If it was exercised, this release can't record the exercise yet, so this Trade stays open until a later release can.")).toBeTruthy();
    expect(within(long).queryByRole('link', { name: 'Record expiration' })).toBeNull();
  });
});

describe('option Trade Detail expiration line (decision 94, row 23.19)', () => {
  it('should show Expired Fri 20 Nov 2026 on a Closed option Trade whose Terminal Disposition includes an expiration, wholly or in part, and no expiration line on one only the trader Executions disposed of, and keep Expires on an Open one', async () => {
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    expect(await screen.findByText('Expires Fri 20 Nov 2026')).toBeTruthy();
    cleanup();
    // The mixed Trade (a sale plus an expiration) and the wholly expired one: part of the position expired.
    for (const view of [optionClosedDetail('O-C', [OC_PC1, OC_PC2, OC_X1, OC_E1]), optionClosedDetail('O-S', [OS_S1, OS_ES])]) {
      renderView(view);
      await screen.findByRole('region', { name: 'Result' });
      expect(screen.getAllByText(/^Expire[sd] [A-Z][a-z]{2} \d/).map((e) => e.textContent)).toEqual(['Expired Fri 20 Nov 2026']);
      cleanup();
    }
    for (const view of [
      optionClosedDetail('O-C', [OC_PC1, OC_PC2, ocChange('pc-x2', '2026-10-13T14:00:00Z', 5, 'Sell', '2', '3.00', '0.65')]),
      optionClosedDetail('O-S', [OS_S1, osChange('pc-b2', '2026-10-13T14:00:00Z', 3, 'Buy', '2', '0.60', '1.30')]),
    ]) {
      renderView(view);
      await screen.findByRole('region', { name: 'Result' });
      expect(screen.queryAllByText(/^Expire[sd] [A-Z][a-z]{2} \d/)).toEqual([]);
      cleanup();
    }
  });
});

describe('closed option Trade Detail (A119)', () => {
  it('should show a Closed option Trade Closed via sale of 1 contract and expiration of 1 contract, Option Disposition Timing Mixed with both quantities, and no Close Reason field', async () => {
    renderView(optionClosedDetail('O-C', [OC_PC1, OC_PC2, OC_X1, OC_E1]));
    const result = await screen.findByRole('region', { name: 'Result' });
    expect(termValue(result, 'Terminal Disposition')).toBe('Closed via sale of 1 contract and expiration of 1 contract');
    expect(termValue(result, 'Option Disposition Timing')).toBe('Mixed: 1 before expiration, 1 at expiration');
    expect(within(result).queryByText('Close Reason', { selector: 'dt' })).toBeNull();
    // A Closed Trade's Current payoff has nothing left to show.
    expect(within(screen.getByRole('region', { name: 'Current Expiration Payoff' })).getByText('Not applicable: no open position')).toBeTruthy();
  });

  it('should list an Expiration in its own Settlement section after the Executions, with the contract named by its label', async () => {
    renderView(optionClosedDetail('O-C', [OC_PC1, OC_PC2, OC_X1, OC_E1]));
    const executions = await screen.findByRole('region', { name: 'Executions (3)' });
    expect(within(executions).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Buy to open 1 XYZ 20 Nov 2026 55 Call @ $2.10 2026-10-12 10:00details',
      'Buy to open 1 XYZ 20 Nov 2026 55 Call @ $1.90 2026-10-12 11:00details',
      'Sell to close 1 XYZ 20 Nov 2026 55 Call @ $3.00 2026-10-13 10:00details',
    ]);
    const settlement = screen.getByRole('region', { name: 'Settlement (1)' });
    expect(executions.compareDocumentPosition(settlement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const row = within(settlement).getByRole('button');
    expect(row.textContent).toBe('Expiration of 1 XYZ 20 Nov 2026 55 Call 2026-11-20 16:00details');
    row.click();
    expect(await within(settlement).findByText('Settlement time', { selector: 'dt' })).toBeTruthy();
    expect(termValue(settlement, 'Instrument')).toBe('XYZ 20 Nov 2026 55 Call');
    expect(termValue(settlement, 'Settlement time')).toBe('2026-11-20 16:00');
    expect(within(settlement).getByText('Position Change', { selector: 'dt' })).toBeTruthy();
    expect(within(settlement).queryByText('Fee', { selector: 'dt' })).toBeNull();
  });
});

describe('option Trade Detail on an incoherent Detail (ocr comment 1)', () => {
  it('should list a recorded Expiration in its Settlement section on an incoherent Detail too', async () => {
    renderView(incoherentDetailOf([OC_PC1, OC_PC2, OC_X1, OC_E1], [{ factId: 'ex-1', kind: 'Execution', instrument: OC_CONTRACT, economicTime: '2026-10-12T14:00:00Z', side: 'Buy', quantity: '60', reason: 'UnknownPlannedLeg' }]));
    const settlement = await screen.findByRole('region', { name: 'Settlement (1)' });
    expect(within(settlement).getByRole('button').textContent).toBe('Expiration of 1 XYZ 20 Nov 2026 55 Call 2026-11-20 16:00details');
  });
});

describe('option Trade Detail Lot Matches (row 20.13)', () => {
  it('should head an option Trades Lot Matches Opened and Closed on Trade Detail, open or closed, and a stock Trades Bought and Sold', async () => {
    const headers = () => within(screen.getByRole('region', { name: 'Lot Matches' })).getAllByRole('columnheader').map((h) => h.textContent);
    renderView(optionClosedDetail('O-C', [OC_PC1, OC_PC2, OC_X1, OC_E1]));
    await screen.findByRole('region', { name: 'Lot Matches' });
    expect(headers()).toEqual(['Opened', 'Closed', 'Quantity', 'Realized']);
    cleanup();

    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    await screen.findByRole('region', { name: 'Lot Matches' });
    expect(headers()).toEqual(['Opened', 'Closed', 'Quantity', 'Realized']);
    cleanup();

    renderView(openDetailOf([PC1, PC2, X1]));
    await screen.findByRole('region', { name: 'Lot Matches' });
    expect(headers()).toEqual(['Bought', 'Sold', 'Quantity', 'Realized']);
  });
});

// A third contract bought on O-C at 12:00 New York time: one above the planned two.
const OC_PC3 = ocChange('pc-3', '2026-10-12T16:00:00Z', 8, 'Buy', '1', '2.00', '0.65');

describe('option Trade Detail Deviations and Fulfillment (rows 20.15, 23.2, 23.8)', () => {
  it('should word an option Entry Size Deviation and the Planned Leg in contracts on Trade Detail', async () => {
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_PC3], THURSDAY, { recordedDeviations: [ocExcess] }));
    const deviations = await screen.findByRole('region', { name: 'Deviations' });
    expect(within(deviations).getByText('Entry Size (Excess): 1 contract above plan, caused by the Position Change at 2026-10-12 12:00.')).toBeTruthy();
    const fulfillment = screen.getByRole('region', { name: 'Planned-Leg Fulfillment' });
    expect(within(fulfillment).getByText('Long 2 contracts of XYZ 20 Nov 2026 55 Call', { selector: 'dt' })).toBeTruthy();
  });

  it('should word an option Trades unrecorded Entry Size Deviation in contracts in the Records disagree table', async () => {
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_PC3], THURSDAY));
    const table = within(await screen.findByRole('region', { name: 'Stored versus expected' })).getByRole('table');
    expect(within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((c) => c.textContent))).toEqual([
      ['Entry Size Deviation, Position Change at 2026-10-12 12:00', 'None', '1 contract'],
    ]);
  });
});

describe('option Trade Detail At entry (row 23.5)', () => {
  it('should word the contracts bought after the last close in the At entry section as a contract count', async () => {
    // A contract bought Monday 17:00 New York, after the close of the frame the figures are valued at.
    const lateBuy = ocChange('pc-4', '2026-10-12T21:00:00Z', 8, 'Buy', '1', '2.00', '0.65');
    renderView(optionOpenDetail('O-C', [OC_PC1, lateBuy], { tradingDate: '2026-10-12', closeInstant: '2026-10-12T20:00:00Z', contractMark: '2.20', underlyingMark: '52.00' }));
    const atEntry = await screen.findByRole('region', { name: 'At entry' });
    expect(termValue(atEntry, 'Quantity')).toBe('1 contract');
  });
});

describe('option Trade Detail conditions (row 23.17)', () => {
  it('should add the contracts value at expiration and the distance on the Underlying to each Stop and Target, with the trigger as an Underlying price', async () => {
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    const table = within(await screen.findByRole('region', { name: 'Stop and Target conditions' })).getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    const cell = (role: string, header: string) => {
      const row = within(table).getAllByRole('row').find((r) => within(r).queryAllByRole('cell')[0]?.textContent === role)!;
      return within(row).getAllByRole('cell')[headers.indexOf(header)]?.textContent;
    };
    expect(headers).toEqual(expect.arrayContaining(['Value at expiration', 'Distance on XYZ']));
    expect(cell('Stop', 'Boundary')).toBe('48.00');
    expect(cell('Stop', 'Value at expiration')).toBe('$0.00');
    expect(cell('Stop', 'Distance on XYZ')).toBe('4.00');
    expect(cell('Target', 'Boundary')).toBe('60.00');
    expect(cell('Target', 'Value at expiration')).toBe('$5.00');
    expect(cell('Target', 'Distance on XYZ')).toBe('8.00');
  });
});

describe('option Trade Detail triggers (convention C3)', () => {
  it('should show an option Plans Stop and Target as Underlying prices without a dollar sign in the Plan and Summary cards', async () => {
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    await screen.findByRole('heading', { name: 'XYZ', level: 1 });
    for (const card of ['Plan', 'Summary']) {
      const region = screen.getByRole('region', { name: card });
      expect(termValue(region, 'Stop')).toBe('48.00');
      expect(termValue(region, 'Target')).toBe('60.00');
    }
    // The intended entry is a premium per share, so it keeps its dollar sign.
    expect(termValue(screen.getByRole('region', { name: 'Plan' }), 'Intended entry')).toBe('$2.00');
  });
});

describe('option Trade Detail Net cost (revision 8)', () => {
  it('should show a Cash-Secured Puts Net cost as a credit and a Long Calls as a debit, each carrying the premium', async () => {
    renderView(optionOpenDetail('O-S', [OS_S1], THURSDAY));
    const credit = await screen.findByRole('region', { name: 'Summary' });
    // 2 contracts sold at 1.25 is 250.00 received, less the 1.30 fee.
    expect(termValue(credit, 'Net cost')).toBe('$248.70 credit');
    expect(credit.querySelector('.summary-text')?.textContent).toBe('Short 2 Nov 20 $45 Put');
    cleanup();

    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    // 1 contract held at 1.90 is 190.00 paid, plus its 0.65 fee.
    expect(termValue(await screen.findByRole('region', { name: 'Summary' }), 'Net cost')).toBe('$190.65');
  });
});
