// @vitest-environment jsdom
// The figures the legacy Summary card, Valuation and Risk and reward sections gave that no cockpit component showed, each in its one place
// (D08P T8P.31, revision 96). Every read is scoped to the figure's new place, since the legacy block still shows it too until T8P.22.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { closedDetailOf } from '../../../../tests/support/closed-detail-fixtures.ts';
import { openDetailAt, openDetailOf, openDetailUncovered, PC1, PC2, PC3, pc3Excess, X1, X2 } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionOpenDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { OC_PC1, OC_PC2, OC_X1, OS_S1, OS2_S1 } from '../../../../tests/support/option-trade-fixtures.ts';
import { plannedDetail } from '../../../../tests/support/views-fixtures.ts';
import type { Instrument } from '../../../domain/instrument/index.ts';
import type { TodayReplay } from '../../cockpit/drawers/today.props.ts';
import { TodayDrawer } from '../../cockpit/drawers/today.tsx';
import { available, MON_CLOSE, openDrawer, renderView, termValue, THURSDAY, tuesday, useFixedClock } from './test-support.ts';

afterEach(cleanup);

// The card of current Marks inside a drawer's panel. It carries no heading of its own (no word is new), and the legacy Valuation section, which
// has the same terms, still renders in the same panel, so the card is found by its class.
function currentMarks(panel: HTMLElement): HTMLElement {
  const card = panel.querySelector<HTMLElement>('section.current-marks');
  expect(card).not.toBeNull();
  return card!;
}

describe("Trade Detail: the legacy blocks' figures in one place (revision 96)", () => {
  // The option Trade's cases read the current year from the clock, so it is fixed.
  useFixedClock();
  it("should show each Instrument's current Mark with its date, source and saved time, and any correction, in the Today drawer", async () => {
    const user = userEvent.setup();
    renderView(openDetailAt([PC1, PC2], tuesday(available('52.00', { correctionReason: 'Typo in the first save.' }))));
    await openDrawer(user, 'Today');
    const card = currentMarks(screen.getByRole('tabpanel', { name: 'Today' }));
    expect(termValue(card, 'Mark')).toBe('$52.00');
    expect(termValue(card, 'Source')).toBe('Manual');
    expect(termValue(card, 'Saved')).toBe('2026-10-13 17:30');
    expect(within(card).getByText('Corrected', { selector: '.badge' })).toBeTruthy();
    expect(within(card).getByText('Typo in the first save.')).toBeTruthy();
    cleanup();

    renderView(openDetailAt([PC1, PC2], tuesday(available('52.00'))));
    await openDrawer(user, 'Today');
    expect(within(currentMarks(screen.getByRole('tabpanel', { name: 'Today' }))).queryByText('Corrected')).toBeNull();
    cleanup();

    // Where the comparison shows the Mark with its provenance (the replay T8P.22 passes), the card does not show it twice.
    const xyz: Instrument = { kind: 'Stock', symbol: 'XYZ' };
    const marked = (price: string): TodayReplay['sessions'][number]['marks'][number] => ({
      instrument: xyz,
      resolution: { kind: 'Available', mark: { price, source: 'Manual', savedAt: '2026-10-13T21:30:00Z' } },
      change: null,
    });
    const replay: TodayReplay = {
      instruments: [xyz],
      sessions: [
        { date: '2026-10-12', marks: [marked('51.20')] },
        { date: '2026-10-13', marks: [marked('52.00')] },
      ],
    };
    const { container } = render(
      <MemoryRouter>
        <TodayDrawer view={openDetailAt([PC1, PC2], tuesday(available('52.00')))} timeZone="America/New_York" replay={replay} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('table', { name: 'Marks: Tue Oct 13 against Mon Oct 12' })).toBeTruthy();
    for (const term of ['Mark', 'Source', 'Saved']) expect(within(container).queryByText(term, { selector: 'dt' })).toBeNull();
    expect(termValue(currentMarks(container), 'Expected Mark Date')).toBe('Tue Oct 13');
  });

  it("should show a missing Mark's Instrument and date with any older Stale context, and an acknowledged one as the trader's acknowledgment, not a price", async () => {
    const user = userEvent.setup();
    const monContext = { tradingDate: '2026-10-12', price: '51.20', revisionId: 'm-0', revisionNumber: 1, closeInstant: MON_CLOSE };
    renderView(openDetailAt([PC1, PC2], tuesday({ kind: 'Missing', stale: monContext })));
    await openDrawer(user, 'Today');
    const missing = currentMarks(screen.getByRole('tabpanel', { name: 'Today' }));
    // The Review opens this Trade's card, not another Trade's on the same Instrument.
    expect(within(missing).getByRole('link', { name: 'Mark missing for XYZ on Tue Oct 13' }).getAttribute('href')).toBe('/review?trade=trade-1&instrument=XYZ');
    expect(within(missing).getByText('Stale context: $51.20 from Mon Oct 12 close (stale, not used in any current figure)')).toBeTruthy();
    cleanup();

    const acknowledgment = { versionId: 'ack-1', kind: 'Asserted', observedAt: '2026-10-13T21:00:00Z', savedAt: '2026-10-13T21:30:00Z' };
    renderView(openDetailAt([PC1, PC2], tuesday({ kind: 'AcknowledgedUnavailable', acknowledgment, stale: monContext } as never)));
    await openDrawer(user, 'Today');
    const acknowledged = currentMarks(screen.getByRole('tabpanel', { name: 'Today' }));
    expect(within(acknowledged).getByText('Mark acknowledged unavailable for XYZ on Tue Oct 13: your acknowledgment, not a price')).toBeTruthy();
    expect(within(acknowledged).queryByRole('link', { hidden: true })).toBeNull();
    expect(within(acknowledged).queryByText(/Mark missing for/)).toBeNull();
    expect(within(acknowledged).getByText(/^Stale context: \$51\.20/)).toBeTruthy();
  });

  it('should show the Underlying Mark and the Expected Mark Date with the current Marks', async () => {
    const user = userEvent.setup();
    renderView(openDetailAt([PC1, PC2], tuesday(available('52.00'))));
    await openDrawer(user, 'Today');
    expect(termValue(currentMarks(screen.getByRole('tabpanel', { name: 'Today' })), 'Expected Mark Date')).toBe('Tue Oct 13');
    cleanup();

    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    await openDrawer(user, 'Today');
    const option = currentMarks(screen.getByRole('tabpanel', { name: 'Today' }));
    expect(termValue(option, 'Underlying Mark')).toBe('$52.00 · Manual');
    cleanup();

    // Outside the market calendar no Mark is expected: no date, and no card with nothing in it.
    renderView(openDetailUncovered([PC1, PC2], '2031-01-02'));
    await openDrawer(user, 'Today');
    const panel = screen.getByRole('tabpanel', { name: 'Today' });
    expect(panel.querySelector('.current-marks')).toBeNull();
    expect(within(panel).queryByText('Expected Mark Date')).toBeNull();
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

  it('should show Net cost in the Position drawer, the Entry status in Entry Quality, and Deviation active beside the lifecycle badge', async () => {
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
    const deviation = within(identity).getByText('Deviation active');
    expect(deviation.getAttribute('data-tone')).toBe('warning');
    expect(deviation.parentElement).toBe(within(identity).getByText('Long Stock, Open', { selector: '.badge' }).parentElement);
    cleanup();

    renderView(openDetailOf([PC1, PC2]));
    const plain = (await screen.findByRole('heading', { name: 'XYZ', level: 1 })).closest('header')!;
    expect(within(plain).queryByText('Deviation active')).toBeNull();
  });

  it("should show every condition's Risk to stop or Reward to target in the Plan and Risk drawer", async () => {
    const user = userEvent.setup();
    // One line per condition in Plan order, as the Plan's own Stop and Target lines are.
    const linesOf = (term: string) => Array.from(within(screen.getByRole('tabpanel', { name: 'Plan and Risk' })).getByText(term, { selector: 'dt' }).nextElementSibling?.children ?? []).map((line) => line.textContent);
    const planAt = async (view: Parameters<typeof renderView>[0]) => {
      renderView(view);
      await openDrawer(user, 'Plan and Risk');
    };
    await planAt(openDetailAt([PC1, PC2], tuesday(available('52.00'))));
    expect(linesOf('Risk to stop')).toEqual(['$450.00 · 1.80R']);
    expect(linesOf('Reward to target')).toEqual(['$400.00 · 1.60R']);
    cleanup();

    await planAt(openDetailAt([PC1, PC2], tuesday(available('57.00'))));
    expect(linesOf('Reward to target')).toEqual(['$0.00 · 0.00R']);
    cleanup();

    await planAt(openDetailAt([PC1, PC2], tuesday(available('47.00'))));
    expect(linesOf('Risk to stop')).toEqual(['$0.00 · 0.00R']);
    cleanup();

    // Without a Mark no distance is invented.
    await planAt(openDetailAt([PC1, PC2], tuesday({ kind: 'Missing' })));
    expect(linesOf('Risk to stop')).toEqual(['—']);
    expect(linesOf('Reward to target')).toEqual(['—']);
    cleanup();

    // Wednesday 10-14, O-S2: MNO 43.20 and the put 3.70, four conditions, two to each role.
    await planAt(optionOpenDetail('O-S2', [OS2_S1], { tradingDate: '2026-10-14', closeInstant: '2026-10-14T20:00:00Z', contractMark: '3.70', underlyingMark: '43.20' }));
    const risk = linesOf('Risk to stop');
    expect(risk).toHaveLength(2);
    expect(risk[0]).toMatch(/^\$60\.00/);
    expect(linesOf('Reward to target')).toHaveLength(2);
  });

  it('should show the current Marks in the Position drawer on a state without a Today drawer', async () => {
    const user = userEvent.setup();
    // Friday 2026-11-20 after the close: the expiration date, whose contracts are due for settlement, so the Detail has no Today drawer.
    renderView(optionOpenDetail('O-S', [OS_S1], { tradingDate: '2026-11-20', closeInstant: '2026-11-20T21:00:00Z', contractMark: '0.80', underlyingMark: '52.00' }));
    await openDrawer(user, 'Position');
    expect(screen.queryByRole('tab', { name: 'Today' })).toBeNull();
    const card = currentMarks(screen.getByRole('tabpanel', { name: 'Position' }));
    expect(termValue(card, 'Mark')).toBe('$0.80');
    expect(termValue(card, 'Source')).toBe('Manual');
    expect(termValue(card, 'Saved')).toBe('2026-11-20 16:00');
    cleanup();

    // A state with a Today drawer keeps them there only: its Position panel, hidden or not, holds no second card.
    renderView(openDetailAt([PC1, PC2], tuesday(available('52.00'))));
    await openDrawer(user, 'Today');
    const position = document.getElementById('drawer-panel-position');
    expect(position?.hidden).toBe(true);
    expect(position?.querySelector('.current-marks')).toBeNull();
  });
});
