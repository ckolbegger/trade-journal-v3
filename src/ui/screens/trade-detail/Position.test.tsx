// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { execution, incoherentDetailOf, openDetailOf, PC1, PC2, pc1Reflection, pc2Decline, positionChange, X1 } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionClosedDetail, optionOpenDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { expiredOptionTrade, OC_CONTRACT, OC_E1, OC_PC1, OC_PC2, OC_X1 } from '../../../../tests/support/option-trade-fixtures.ts';
import { plannedDetail } from '../../../../tests/support/views-fixtures.ts';
import { THURSDAY, openDrawer, renderView, rowsOf, termValue, useFixedClock } from './test-support.ts';

afterEach(cleanup);

// PC4 holds two Executions at one Economic Time, so the Detail has four Executions in all.
const PC4 = positionChange('pc-4', 7, [
  execution('ex-4', '2026-10-12T19:00:00Z', 8, '10', '52.00', '0.50'),
  execution('ex-5', '2026-10-12T19:00:00Z', 9, '5', '52.10', '0.25'),
]);

describe('Open Trade Detail', () => {
  it('should show Last activity in the Position card as a labelled local time', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2]));
    await openDrawer(user, 'Position');
    const position = await screen.findByRole('region', { name: 'Position' });
    expect(termValue(position, 'Last activity')).toBe('2026-10-12 11:00');
  });

  it('should show lifecycle Open as text, Position, an Open Lots table, and Executions as rows in Fact Order', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2]));
    expect(await screen.findByRole('heading', { name: 'XYZ', level: 1 })).toBeTruthy();
    expect(screen.getByText('Long Stock, Open', { selector: '.badge' })).toBeTruthy();
    await openDrawer(user, 'Position');

    const position = screen.getByRole('region', { name: 'Position' });
    expect(termValue(position, 'Position')).toBe('100 shares of XYZ');
    expect(termValue(position, 'Opening fees')).toBe('$2.00');
    const lots = within(position).getByRole('table', { name: 'Open Lots' });
    expect(rowsOf(lots)).toEqual([
      ['2026-10-12 10:00', '60', '$50.10', '$1.00'],
      ['2026-10-12 11:00', '40', '$50.30', '$1.00'],
    ]);
    // Numbers are right-aligned in tabular numerals.
    expect(within(lots).getAllByText('$50.10')[0]!.className).toContain('number');

    const executions = screen.getByRole('region', { name: 'Executions (2)' });
    expect(
      within(executions)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-labelledby')!.split(' ').map((id) => document.getElementById(id)!.textContent).join(' ')),
    ).toEqual(['Buy 60 XYZ @ $50.10 2026-10-12 10:00 details', 'Buy 40 XYZ @ $50.30 2026-10-12 11:00 details']);
    expect(screen.queryByRole('region', { name: 'Position Changes', hidden: true })).toBeNull();
  });

  it('should show Position Change Reflections with snapshot labels and declines as Reflection declined with the reason', async () => {
    const user = userEvent.setup();
    const planReflection = {
      kind: 'Entry' as const,
      ...plannedDetail.journal[0],
    };
    renderView(
      openDetailOf([PC1, PC2], {
        journal: [planReflection, pc1Reflection, pc2Decline],
      }),
    );
    await openDrawer(user, 'Journal');
    const journal = await screen.findByRole('region', { name: 'Journal (3)' });
    const items = within(journal).getAllByRole('listitem');
    expect(items.map((item) => within(item).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Plan Reflection',
      'Position Change Reflection',
      'Position Change Reflection',
    ]);

    const [, entry, decline] = items as [HTMLElement, HTMLElement, HTMLElement];
    expect(termValue(entry, 'Moment')).toBe('2026-10-12 10:00');
    expect(termValue(entry, 'Decision mode')).toBe('Planned');
    expect(termValue(entry, 'Primary emotion')).toBe('Calm');
    expect(termValue(entry, 'Decision confidence')).toBe('4');
    expect(termValue(entry, 'Note')).toBe('Not answered');

    expect(termValue(decline, 'Moment')).toBe('2026-10-12 11:00');
    expect(within(decline).getByText('Reflection declined')).toBeTruthy();
    expect(termValue(decline, 'Reason')).toBe('Same plan, second fill.');
    // The narrative is the Journal section's alone: no separate Plan Reflection region.
    expect(screen.queryByRole('region', { name: 'Plan Reflection', hidden: true })).toBeNull();
  });
});

describe('Executions', () => {
  it('should label the region Executions with its count of Executions and list them in Fact Order', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2, PC4]));
    await openDrawer(user, 'Position');
    const section = await screen.findByRole('region', { name: 'Executions (4)' });
    const rows = within(section).getAllByRole('listitem');
    expect(rows.map((row) => /Buy (\d+)/.exec(row.textContent ?? '')?.[1])).toEqual(['60', '40', '10', '5']);
  });

  it('should name each Execution row button exactly as its visible text followed by details', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2, PC4]));
    await openDrawer(user, 'Position');
    const section = await screen.findByRole('region', { name: 'Executions (4)' });
    expect(within(section).getByRole('button', { name: 'Buy 60 XYZ @ $50.10 2026-10-12 10:00 details' })).toBeTruthy();
    expect(within(section).getByRole('button', { name: 'Buy 40 XYZ @ $50.30 2026-10-12 11:00 details' })).toBeTruthy();
  });

  it('should show each Execution collapsed as one row with action, quantity, symbol, price, and Economic Time with no fee, with no Executions table and no Position Change headings', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2, PC4]));
    await openDrawer(user, 'Position');
    const section = await screen.findByRole('region', { name: 'Executions (4)' });
    const rows = within(section).getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('.execution-summary')?.textContent)).toEqual([
      'Buy 60 XYZ @ $50.10 2026-10-12 10:00',
      'Buy 40 XYZ @ $50.30 2026-10-12 11:00',
      'Buy 10 XYZ @ $52.00 2026-10-12 15:00',
      'Buy 5 XYZ @ $52.10 2026-10-12 15:00',
    ]);
    // The fee is in the expanded details only.
    expect(within(section).queryByText(/fee|\$1\.00|\$0\.50/i)).toBeNull();
    expect(screen.queryByRole('table', { name: 'Executions', hidden: true })).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: /^Position Change at/, hidden: true })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Position Changes', hidden: true })).toBeNull();
  });

  it('should give each row a disclosure button named for its Execution, collapsed by default with aria-expanded false', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2, PC4]));
    await openDrawer(user, 'Position');
    const section = await screen.findByRole('region', { name: 'Executions (4)' });
    const buttons = within(section).getAllByRole('button');
    // Label in Name: the accessible name begins with the row's visible text.
    const visible = buttons.map((b) => b.querySelector('.execution-summary')!.textContent);
    expect(visible.map((v) => v.slice(0, 10))).toEqual(['Buy 60 XYZ', 'Buy 40 XYZ', 'Buy 10 XYZ', 'Buy 5 XYZ ']);
    for (const text of visible) expect(within(section).getByRole('button', { name: `${text} details` })).toBeTruthy();
    expect(buttons.every((b) => !b.hasAttribute('aria-label'))).toBe(true);
    for (const button of buttons) {
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(button.getAttribute('aria-controls')).toBeTruthy();
      expect(button.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    }
    expect(new Set(buttons.map((b) => b.getAttribute('aria-controls'))).size).toBe(4);
  });

  it('should show the Instrument, Economic Time, fee, and the Position Change with its Execution count when the row is expanded, and hide them again when it is collapsed', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2, PC4]));
    await openDrawer(user, 'Position');
    await screen.findByRole('region', { name: 'Executions (4)' });
    const toggle = screen.getByRole('button', { name: /^Buy 10 XYZ @ .* 15:00 details$/ });
    expect(screen.queryByText('Instrument', { selector: 'dt' })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const details = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(termValue(details, 'Instrument')).toBe('XYZ');
    expect(termValue(details, 'Economic Time')).toBe('2026-10-12 15:00');
    expect(termValue(details, 'Fee')).toBe('$0.50');
    expect(termValue(details, 'Position Change')).toBe('2026-10-12 15:00 · 2 Executions');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toBeNull();
    // A Position Change with one Execution says so in the singular.
    fireEvent.click(screen.getByRole('button', { name: /^Buy 60 XYZ @ .* 10:00 details$/ }));
    expect(termValue(screen.getByRole('region', { name: 'Executions (4)' }), 'Position Change')).toBe('2026-10-12 10:00 · 1 Execution');
  });

  it("should show the Position Change Reflection's answers in the expanded row of an Execution whose Position Change has one", async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2, PC4], { journal: [pc1Reflection] }));
    await openDrawer(user, 'Position');
    await screen.findByRole('region', { name: 'Executions (4)' });
    const toggle = screen.getByRole('button', { name: /^Buy 60 XYZ @ .* 10:00 details$/ });
    fireEvent.click(toggle);
    const details = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(within(details).getByText('Position Change Reflection')).toBeTruthy();
    expect(termValue(details, 'Decision mode')).toBe('Planned');
    expect(termValue(details, 'Primary emotion')).toBe('Calm');
    expect(termValue(details, 'Decision confidence')).toBe('4');
    expect(termValue(details, 'Note')).toBe('Not answered');
  });

  it('should show Reflection declined with the reason, or No reflection, when the Position Change has a decline or no reflection', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2, PC4], { journal: [pc1Reflection, pc2Decline] }));
    await openDrawer(user, 'Position');
    await screen.findByRole('region', { name: 'Executions (4)' });
    const open = (name: RegExp) => {
      const toggle = screen.getByRole('button', { name });
      fireEvent.click(toggle);
      return document.getElementById(toggle.getAttribute('aria-controls')!)!;
    };
    const declined = open(/^Buy 40 XYZ @ .* 11:00 details$/);
    expect(within(declined).getByText('Reflection declined')).toBeTruthy();
    expect(within(declined).getByText('Reason: Same plan, second fill.')).toBeTruthy();
    expect(within(declined).queryByText('No reflection')).toBeNull();
    const none = open(/^Buy 10 XYZ @ .* 15:00 details$/);
    expect(within(none).getByText('No reflection')).toBeTruthy();
    expect(within(none).queryByText('Reflection declined')).toBeNull();
  });

  it('should mark the Executions of a Position Change with several Executions as one group and show the shared reflection in each ones expanded row', async () => {
    const pc4Reflection = { ...pc1Reflection, id: 'e-4', positionChangeId: 'pc-4', momentTime: '2026-10-12T19:00:00Z' };
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2, PC4], { journal: [pc1Reflection, pc4Reflection] }));
    await openDrawer(user, 'Position');
    const section = await screen.findByRole('region', { name: 'Executions (4)' });
    const rows = within(section).getAllByRole('listitem');
    expect(rows.map((row) => within(row).queryByText(/^Same Position Change/)?.textContent ?? null)).toEqual([
      null,
      null,
      'Same Position Change · 1 of 2',
      'Same Position Change · 2 of 2',
    ]);
    expect(rows[2]!.getAttribute('data-group')).toBe('pc-4');
    expect(rows[3]!.getAttribute('data-group')).toBe('pc-4');
    for (const row of rows.slice(2)) {
      fireEvent.click(within(row).getByRole('button'));
      expect(termValue(row, 'Decision mode')).toBe('Planned');
    }
  });

  it('should toggle with Enter and Space and keep focus on the button', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2, PC4]));
    await openDrawer(user, 'Position');
    await screen.findByRole('region', { name: 'Executions (4)' });
    const toggle = screen.getByRole('button', { name: /^Buy 60 XYZ @ .* 10:00 details$/ });
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(toggle);
    await user.keyboard(' ');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
    await user.keyboard(' ');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{Enter}');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('Closed option Trade Detail (T7.21-B2)', () => {
  it('should show a Closed option Trades Lot Match disposed by an Expiration as Expired on 2026-11-20 16:00 on Trade Detail', async () => {
    renderView(optionClosedDetail('O-C', expiredOptionTrade('O-C').record.positionChanges), true);
    const matches = within(await screen.findByRole('region', { name: 'Lot Matches' })).getByRole('table', { name: 'Lot Matches' });
    expect(within(matches).getAllByText('Expired on 2026-11-20 16:00').length).toBeGreaterThan(0);
  });
});

describe('Open Trade Detail after a partial exit', () => {
  it('should describe the Lot Matches table by the note that amounts are rounded for display', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2, X1]), true);
    await openDrawer(user, 'Position');
    const section = await screen.findByRole('region', { name: 'Lot Matches' });
    expect(within(section).getByRole('table', { name: 'Lot Matches', description: 'Each match’s amount is rounded to the cent for display.' })).toBeTruthy();
  });

  it('should show realized to date, the Lot Matches table with a note that per-match amounts are rounded for display, and Record exit beside Record entry only while Writable', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2, X1]), true);
    await openDrawer(user, 'Position');
    // Realized to date is the Position drawer's own figure now (the Valuation section it was read from is retired).
    expect(termValue(await screen.findByRole('region', { name: 'Position' }), 'Realized to date')).toBe('+$55.90');
    const section = screen.getByRole('region', { name: 'Lot Matches' });
    expect(rowsOf(within(section).getByRole('table', { name: 'Lot Matches' }))).toEqual([['$50.10 on 2026-10-12 10:00', '$52.00 on 2026-10-13 10:00', '30', '+$55.90']]);
    expect(within(section).getByText('Each match’s amount is rounded to the cent for display.')).toBeTruthy();

    const exit = screen.getByRole('link', { name: 'Record exit' });
    expect(exit.getAttribute('href')).toBe('/trades/trade-1/record-entry?action=Sell');
    expect(screen.getByRole('link', { name: 'Record entry' }).parentElement).toBe(exit.parentElement);
    cleanup();

    renderView(openDetailOf([PC1, PC2, X1]), false);
    await screen.findByRole('heading', { name: 'XYZ', level: 1 });
    expect(screen.queryByRole('link', { name: 'Record exit', hidden: true })).toBeNull();
    cleanup();

    // Nothing to exit before an entry: a Planned Detail offers Record entry alone.
    renderView(plannedDetail, true);
    await screen.findByRole('link', { name: 'Record entry' });
    expect(screen.queryByRole('link', { name: 'Record exit', hidden: true })).toBeNull();
  });
});

describe('closed option Trade Detail (A119)', () => {
  useFixedClock();
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
  useFixedClock();
  it('should list a recorded Expiration in its Settlement section on an incoherent Detail too', async () => {
    renderView(incoherentDetailOf([OC_PC1, OC_PC2, OC_X1, OC_E1], [{ factId: 'ex-1', kind: 'Execution', instrument: OC_CONTRACT, economicTime: '2026-10-12T14:00:00Z', side: 'Buy', quantity: '60', reason: 'UnknownPlannedLeg' }]));
    const settlement = await screen.findByRole('region', { name: 'Settlement (1)' });
    expect(within(settlement).getByRole('button').textContent).toBe('Expiration of 1 XYZ 20 Nov 2026 55 Call 2026-11-20 16:00details');
  });
});

describe('option Trade Detail Lot Matches (row 20.13)', () => {
  useFixedClock();
  it('should head an option Trades Lot Matches Opened and Closed on Trade Detail, open or closed, and a stock Trades Bought and Sold', async () => {
    const user = userEvent.setup();
    const headers = () => within(screen.getByRole('region', { name: 'Lot Matches' })).getAllByRole('columnheader').map((h) => h.textContent);
    renderView(optionClosedDetail('O-C', [OC_PC1, OC_PC2, OC_X1, OC_E1]));
    await screen.findByRole('region', { name: 'Lot Matches' });
    expect(headers()).toEqual(['Opened', 'Closed', 'Quantity', 'Realized']);
    cleanup();

    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    await openDrawer(user, 'Position');
    await screen.findByRole('region', { name: 'Lot Matches' });
    expect(headers()).toEqual(['Opened', 'Closed', 'Quantity', 'Realized']);
    cleanup();

    renderView(openDetailOf([PC1, PC2, X1]));
    await openDrawer(user, 'Position');
    await screen.findByRole('region', { name: 'Lot Matches' });
    expect(headers()).toEqual(['Bought', 'Sold', 'Quantity', 'Realized']);
  });
});
