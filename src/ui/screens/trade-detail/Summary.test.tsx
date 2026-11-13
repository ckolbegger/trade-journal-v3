// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../../tests/support/facade-double.ts';
import { incoherentDetailOf, openDetailOf, PC1, PC2, PC3, pc3Excess } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionClosedDetail, optionOpenDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { ocChange, OC_E1, OC_PC1, OC_PC2, OC_X1, OS_ES, OS_S1, osChange } from '../../../../tests/support/option-trade-fixtures.ts';
import { plannedDetail } from '../../../../tests/support/views-fixtures.ts';
import { THURSDAY, openDrawer, renderDetail, renderView, termValue, useFixedClock } from './test-support.ts';

afterEach(cleanup);

describe('Trade Detail', () => {
  it('should render the Detail summary Trade text through the shared at-price component so the at sign stays with its price', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: plannedDetail, binding: {} } as never);
    renderDetail(facade);
    const card = await screen.findByRole('region', { name: 'Summary' });
    const text = card.querySelector('.summary-text')!;
    expect(text.textContent).toBe('Long 100 shares @ $50.00');
    expect(text.querySelector('.nowrap')?.textContent).toBe('@ $50.00');
  });
});

describe('summary card', () => {
  const summaryOf = () => screen.findByRole('region', { name: 'Summary' });

  it('should lead the summary card with the Trade Summary text and on an Open Detail with Net cost', async () => {
    renderView(plannedDetail);
    const planned = await summaryOf();
    expect(planned.querySelector('.summary-text')?.textContent).toBe('Long 100 shares @ $50.00');
    expect(within(planned).queryByText('Net cost')).toBeNull();
    cleanup();

    renderView(openDetailOf([PC1]));
    const open = await summaryOf();
    expect(open.querySelector('.summary-text')?.textContent).toBe('Long 60 shares @ $50.10');
    expect(termValue(open, 'Net cost')).toBe('$3,007.00');
  });

  it('should open a Planned Detail with a summary of Intended entry, Stop, and Target, each with its text label, plus 1R and Reward : risk', async () => {
    renderView(plannedDetail);
    const card = await summaryOf();
    expect(termValue(card, 'Intended entry')).toBe('$50.00');
    expect(termValue(card, 'Stop')).toBe('$47.50');
    expect(termValue(card, 'Target')).toBe('$56.00');
    expect(termValue(card, '1R')).toBe('$250.00');
    expect(termValue(card, 'Reward : risk')).toBe('2.4');
    expect(within(card).getByText('$50.00', { selector: 'dd' }).className).toContain('number');
  });

  it('should open an Open Detail with the Position quantity against plan, the entry status, opening fees, Stop, and Target', async () => {
    renderView(openDetailOf([PC1, PC2, PC3]));
    const card = await summaryOf();
    expect(termValue(card, 'Quantity')).toBe('120 of 100 shares');
    expect(termValue(card, 'Entry')).toBe('Resolved');
    expect(termValue(card, 'Opening fees')).toBe('$3.00');
    expect(termValue(card, 'Stop')).toBe('$47.50');
    expect(termValue(card, 'Target')).toBe('$56.00');
    expect(within(card).queryByText('Intended entry')).toBeNull();
    cleanup();

    renderView(openDetailOf([PC1]));
    expect(termValue(await summaryOf(), 'Entry')).toBe('Entering');
  });

  it('should add the Average entry and Actual initial risk to the Open summary once the entry is resolved, and say Entry not yet resolved before', async () => {
    renderView(openDetailOf([PC1, PC2]));
    const resolved = await summaryOf();
    expect(termValue(resolved, 'Average entry')).toBe('$50.18');
    expect(termValue(resolved, 'Actual initial risk')).toBe('$270.00');
    expect(within(resolved).queryByText('Entry not yet resolved')).toBeNull();
    cleanup();

    renderView(openDetailOf([PC1]));
    const pending = await summaryOf();
    expect(within(pending).getByText('Entry not yet resolved')).toBeTruthy();
    expect(within(pending).queryByText('Average entry')).toBeNull();
    expect(within(pending).queryByText('Actual initial risk')).toBeNull();
  });

  it('should show an active-Deviation badge in the Open summary when a recorded Deviation is Active', async () => {
    renderView(openDetailOf([PC1, PC2, PC3], { recordedDeviations: [pc3Excess] }));
    const card = await summaryOf();
    expect(within(card).getByText('Deviation active').getAttribute('data-tone')).toBe('warning');
    cleanup();

    renderView(openDetailOf([PC1, PC2]));
    expect(within(await summaryOf()).queryByText('Deviation active')).toBeNull();
  });

  it('should show no summary figures on an incoherent Detail, leaving the Facts cannot be replayed panel first', async () => {
    renderView(incoherentDetailOf([PC1, PC2], [{ factId: 'ex-1', kind: 'Execution', instrument: { kind: 'Stock', symbol: 'XYZ' }, economicTime: '2026-10-12T14:00:00Z', side: 'Buy', quantity: '60', reason: 'NonpositiveQuantity' }]));
    const panel = await screen.findByRole('region', { name: "Facts can't be replayed" });
    expect(screen.queryByRole('region', { name: 'Summary', hidden: true })).toBeNull();
    const regions = screen.getAllByRole('region').filter((r) => r.getAttribute('aria-label') === null || r.tagName === 'SECTION');
    expect(regions[0]).toBe(panel);
  });
});

describe('deviations', () => {
  it('should keep the summary card Deviation active badge while a Deviation is Active', async () => {
    renderView(openDetailOf([PC1, PC2, PC3], { recordedDeviations: [pc3Excess] }));
    const card = await screen.findByRole('region', { name: 'Summary' });
    expect(within(card).getByText('Deviation active').getAttribute('data-tone')).toBe('warning');
  });
});

describe('option Trade Detail (A119)', () => {
  useFixedClock();
  it('should show the contract label, Exercise Intent and the Trade Summary on an open option Trade, with its contracts in the Position and the expiration line', async () => {
    const user = userEvent.setup();
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    await screen.findByRole('heading', { name: 'XYZ', level: 1 });
    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(summary.querySelector('.summary-text')?.textContent).toBe('Long 1 Nov 20 $55 Call');
    expect(termValue(summary, 'Quantity')).toBe('1 of 2 contracts');

    await openDrawer(user, 'Plan and Risk');
    const plan = screen.getByRole('region', { name: 'Plan' });
    expect(termValue(plan, 'Contract')).toBe('XYZ 20 Nov 2026 55 Call');
    expect(termValue(plan, 'Leg')).toBe('Long 2 contracts of XYZ 20 Nov 2026 55 Call');
    expect(termValue(plan, 'Exercise Intent')).toBe('Not authorized in advance');

    await openDrawer(user, 'Position');
    const position = screen.getByRole('region', { name: 'Position' });
    expect(termValue(position, 'Position')).toBe('Long 1 contract of XYZ 20 Nov 2026 55 Call');
    expect(within(screen.getByRole('region', { name: 'Summary' })).getByText('Expires Fri 20 Nov 2026')).toBeTruthy();
  });
});

describe('option Trade Detail expiration line (decision 94, row 23.19)', () => {
  useFixedClock();
  it('should show Expired Fri 20 Nov 2026 on a Closed option Trade whose Terminal Disposition includes an expiration, wholly or in part, and no expiration line on one only the trader Executions disposed of, and keep Expires on an Open one', async () => {
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    expect(within(await screen.findByRole('region', { name: 'Summary' })).getByText('Expires Fri 20 Nov 2026')).toBeTruthy();
    cleanup();
    // The mixed Trade (a sale plus an expiration) and the wholly expired one: part of the position expired.
    for (const view of [optionClosedDetail('O-C', [OC_PC1, OC_PC2, OC_X1, OC_E1]), optionClosedDetail('O-S', [OS_S1, OS_ES])]) {
      renderView(view);
      await screen.findByRole('region', { name: 'Result' });
      expect(within(screen.getByRole('region', { name: 'Summary' })).getAllByText(/^Expire[sd] [A-Z][a-z]{2} \d/).map((e) => e.textContent)).toEqual(['Expired Fri 20 Nov 2026']);
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

describe('option Trade Detail Net cost (revision 8)', () => {
  useFixedClock();
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
