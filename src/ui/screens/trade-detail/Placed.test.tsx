// @vitest-environment jsdom
// The figures the legacy Summary card, Valuation and Risk and reward sections gave that no cockpit component showed, each in its one place
// (D08P T8P.31, revision 96). Every read is scoped to the figure's new place, since the legacy block still shows it too until T8P.22.
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { closedDetailOf } from '../../../../tests/support/closed-detail-fixtures.ts';
import { openDetailAt, openDetailOf, PC1, PC2, PC3, pc3Excess, X1, X2 } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionOpenDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { OC_PC1, OC_PC2, OC_X1, OS_S1, OS2_S1 } from '../../../../tests/support/option-trade-fixtures.ts';
import { plannedDetail } from '../../../../tests/support/views-fixtures.ts';
import { available, MON_CLOSE, openDrawer, renderView, termValue, THURSDAY, tuesday, useFixedClock } from './test-support.ts';

afterEach(cleanup);

describe("Trade Detail: the legacy blocks' figures in one place (revision 96)", () => {
  // The option Trade's cases read the current year from the clock, so it is fixed.
  useFixedClock();
  // T8R.6 (W29): Today's one Marks table replaces the current-Marks card on an Open Detail. T8P.31's cases for the Mark with its Source, Saved
  // and correction, the Underlying Mark and the Expected Mark Date retire: the table's cases are in today.props.test.ts, and each Mark's
  // provenance and correction are Price History's (T8R.4). The Stale context and the acknowledgment stay, under the table.
  it("should show a missing Mark's Stale context and an acknowledged one as the trader's acknowledgment, not a price, in the Today drawer, with no Mark-missing link", async () => {
    const user = userEvent.setup();
    const monContext = { tradingDate: '2026-10-12', price: '51.20', revisionId: 'm-0', revisionNumber: 1, closeInstant: MON_CLOSE };
    renderView(openDetailAt([PC1, PC2], tuesday({ kind: 'Missing', stale: monContext })));
    await openDrawer(user, 'Today');
    const missing = screen.getByRole('tabpanel', { name: 'Today' });
    expect(within(missing).getByText('Stale context: $51.20 from Mon Oct 12 close (stale, not used in any current figure)')).toBeTruthy();
    expect(within(missing).queryByRole('link', { name: /Mark missing for/, hidden: true })).toBeNull();
    expect(missing.querySelector('.current-marks')).toBeNull();
    cleanup();

    const acknowledgment = { versionId: 'ack-1', kind: 'Asserted', observedAt: '2026-10-13T21:00:00Z', savedAt: '2026-10-13T21:30:00Z' };
    renderView(openDetailAt([PC1, PC2], tuesday({ kind: 'AcknowledgedUnavailable', acknowledgment, stale: monContext } as never)));
    await openDrawer(user, 'Today');
    const acknowledged = screen.getByRole('tabpanel', { name: 'Today' });
    expect(within(acknowledged).getByText('Mark acknowledged unavailable for XYZ on Tue Oct 13: your acknowledgment, not a price')).toBeTruthy();
    expect(within(acknowledged).queryByRole('link', { hidden: true })).toBeNull();
    expect(within(acknowledged).queryByText(/Mark missing for/)).toBeNull();
    expect(within(acknowledged).getByText(/^Stale context: \$51\.20/)).toBeTruthy();
  });

  it('should show the Trade Summary in the Position drawer on a Closed Detail and in the Plan and Risk drawer on a Planned one', async () => {
    const user = userEvent.setup();
    const summaryIn = (drawer: string) => document.getElementById(`drawer-panel-${drawer}`)?.querySelector('.summary-text');
    renderView(closedDetailOf([PC1, PC2, X1, X2], { closeReason: { id: 'cr-1', label: 'Target reached' } }));
    await openDrawer(user, 'Position');
    expect(screen.getByRole('tabpanel', { name: 'Position' }).querySelector('.summary-text')?.textContent).toBe('Long 100 shares @ $50.18');
    // On a Closed Detail it is the Position drawer's alone.
    expect(summaryIn('plan-and-risk')).toBeNull();
    cleanup();

    renderView(plannedDetail);
    await openDrawer(user, 'Plan and Risk');
    const planned = screen.getByRole('tabpanel', { name: 'Plan and Risk' }).querySelector('.summary-text')!;
    expect(planned.textContent).toBe('Long 100 shares @ $50.00');
    // The shared at-price component keeps the at sign with its price.
    expect(planned.querySelector('.nowrap')?.textContent).toBe('@ $50.00');
    cleanup();

    // An Open Detail already has it in Position, and only there.
    renderView(openDetailOf([PC1]));
    await openDrawer(user, 'Position');
    expect(screen.getByRole('tabpanel', { name: 'Position' }).querySelector('.summary-text')?.textContent).toBe('Long 60 shares @ $50.10');
    expect(summaryIn('plan-and-risk')).toBeNull();
  });

  it('should show Net cost in the Position drawer, the Entry status in Entry Quality, and no Deviation active badge in the identity card', async () => {
    const user = userEvent.setup();
    const netCostOf = async (view: Parameters<typeof renderView>[0]) => {
      renderView(view);
      await openDrawer(user, 'Position');
      const net = termValue(screen.getByRole('region', { name: 'Position' }), 'Net cost');
      cleanup();
      return net;
    };
    expect(await netCostOf(openDetailOf([PC1]))).toBe('$3,007.00');
    // A Cash-Secured Put's is a credit and a Long Call's a debit, each carrying the premium.
    expect(await netCostOf(optionOpenDetail('O-S', [OS_S1], THURSDAY))).toBe('$248.70 credit');
    expect(await netCostOf(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY))).toBe('$190.65');

    renderView(openDetailOf([PC1, PC2, PC3]));
    await openDrawer(user, 'Plan and Risk');
    expect(termValue(screen.getByRole('region', { name: 'Entry Quality' }), 'Entry')).toBe('Resolved');
    expect(within(screen.getByRole('region', { name: 'Entry Quality' })).queryByText(/Entry not yet resolved/)).toBeNull();
    cleanup();

    renderView(openDetailOf([PC1]));
    await openDrawer(user, 'Plan and Risk');
    const pending = screen.getByRole('region', { name: 'Entry Quality' });
    expect(termValue(pending, 'Entry')).toBe('Entering');
    expect(within(pending).getByText(/^Entry not yet resolved/)).toBeTruthy();
    cleanup();

    renderView(openDetailOf([PC1, PC2, PC3], { recordedDeviations: [pc3Excess] }));
    const identity = (await screen.findByRole('heading', { name: 'XYZ', level: 1 })).closest('header')!;
    expect(within(identity).queryByText('Deviation active')).toBeNull();
    expect(within(identity).getByText('Long Stock, Open', { selector: '.badge' })).toBeTruthy();
    cleanup();

    renderView(openDetailOf([PC1, PC2]));
    const plain = (await screen.findByRole('heading', { name: 'XYZ', level: 1 })).closest('header')!;
    expect(within(plain).queryByText('Deviation active')).toBeNull();
  });

  it("should show every condition's Risk to stop or Reward to target in the Plan and Risk drawer", async () => {
    const user = userEvent.setup();
    // T8R.10: one row per condition in Plan order in the Conditions table, every Stop then every Target; a figure with no reading carries its
    // reason without the label.
    const linesOf = (term: string) => {
      const cells = within(screen.getByRole('tabpanel', { name: 'Plan and Risk' }))
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[2]!.textContent ?? '');
      const half = cells.length / 2;
      return (term === 'Risk to stop' ? cells.slice(0, half) : cells.slice(half)).map((cell) => (cell.startsWith(term) ? cell.slice(term.length).trim() : cell));
    };
    const planAt = async (view: Parameters<typeof renderView>[0]) => {
      renderView(view);
      await openDrawer(user, 'Plan and Risk');
    };
    await planAt(openDetailAt([PC1, PC2], tuesday(available('52.00'))));
    expect(linesOf('Risk to stop')).toEqual(['$450.00 · 1.80R']);
    expect(linesOf('Reward to target')).toEqual(['$400.00 · 1.60R']);
    cleanup();

    await planAt(openDetailAt([PC1, PC2], tuesday(available('57.00'))));
    // W32: a crossed condition shows how far past it the Trade is, not a zero.
    expect(linesOf('Reward to target')).toEqual(['$100.00 · 0.40R past']);
    cleanup();

    await planAt(openDetailAt([PC1, PC2], tuesday(available('47.00'))));
    expect(linesOf('Risk to stop')).toEqual(['$50.00 · 0.20R past']);
    cleanup();

    // Without a Mark no distance is invented: the reason shows at the figure length (A222, T8P.23-B8).
    await planAt(openDetailAt([PC1, PC2], tuesday({ kind: 'Missing' })));
    expect(linesOf('Risk to stop')).toEqual(['Mark missing: XYZ, Tue Oct 13']);
    expect(linesOf('Reward to target')).toEqual(['Mark missing: XYZ, Tue Oct 13']);
    cleanup();

    // Wednesday 10-14, O-S2: MNO 43.20 and the put 3.70, four conditions, two to each role.
    await planAt(optionOpenDetail('O-S2', [OS2_S1], { tradingDate: '2026-10-14', closeInstant: '2026-10-14T20:00:00Z', contractMark: '3.70', underlyingMark: '43.20' }));
    const risk = linesOf('Risk to stop');
    expect(risk).toHaveLength(2);
    expect(risk[0]).toMatch(/^\$60\.00/);
    expect(linesOf('Reward to target')).toHaveLength(2);
  });

  // T8R.7: the Settlement Due table replaces the current-Marks card (its case "should show the Mark, Source, Saved and Underlying Mark in the Position
  // drawer card ..." retires with `CurrentMarksOnly`); the tracks, dated card and At entry stay out.
  it('should show no current Marks card, price track or At entry in the Today drawer on a Settlement Due Detail', async () => {
    const user = userEvent.setup();
    renderView(optionOpenDetail('O-S', [OS_S1], { tradingDate: '2026-11-20', closeInstant: '2026-11-20T21:00:00Z', contractMark: '0.80', underlyingMark: '52.00' }));
    await openDrawer(user, 'Today');
    const panel = document.getElementById('drawer-panel-today')!;
    expect(panel.querySelector('section.current-marks')).toBeNull();
    // The tracks, condition lines and At entry are the Today drawer's own, so they are gone, hidden panels included.
    expect(panel.querySelector('.tracks, .price-track')).toBeNull();
    expect(within(panel).queryByText(/Where the prices? sits?/, { selector: 'h2' })).toBeNull();
    expect(within(panel).queryByText(/Distance on /, { ignore: 'none' })).toBeNull();
    expect(within(panel).queryByText(/Value at expiration/, { selector: 'dt, dd, span, small, p, li, div' })).toBeNull();
    expect(within(panel).queryByRole('region', { name: /At entry/, hidden: true })).toBeNull();
    expect(within(panel).queryByRole('heading', { name: /At entry/, hidden: true })).toBeNull();
    expect(panel.querySelector('#today-at-entry-heading, #today-tracks-heading')).toBeNull();
  });
});
