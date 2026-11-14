// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../../tests/support/facade-double.ts';
import { execution, openDetailOf, PC1, PC2, positionChange } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionPlannedDetail, optionOpenDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { OC_PC1, OC_PC2, OC_X1 } from '../../../../tests/support/option-trade-fixtures.ts';
import { plannedDetail } from '../../../../tests/support/views-fixtures.ts';
import { THURSDAY, openDrawer, renderDetail, renderView, termValue, useFixedClock } from './test-support.ts';

afterEach(cleanup);

describe('Trade Detail', () => {
  it('should show the Plan, Planned Leg, Stop, Target, Plan Baseline, 1R, the "Planned" lifecycle as text (not only colour), and the Plan Reflection with its snapshot prompt labels', async () => {
    const user = userEvent.setup();
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: plannedDetail, binding: {} } as never);
    renderDetail(facade);
    expect(await screen.findByRole('heading', { name: 'XYZ', level: 1 })).toBeTruthy();
    expect(screen.getByText('Long Stock, Planned', { selector: '.badge' })).toBeTruthy();
    const plan = screen.getByRole('region', { name: 'Plan' });
    const value = (term: string) => within(plan).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
    expect(value('Leg')).toBe('Long 100 shares of XYZ');
    expect(value('Intended entry')).toBe('$50.00');
    expect(value('Stop')).toBe('$47.50');
    expect(value('Target')).toBe('$56.00');
    expect(value('Plan time')).toBe('2026-10-12 09:30');
    expect(value('Account')).toBe('Fidelity — Roth IRA');
    const baseline = screen.getByRole('region', { name: 'Plan Baseline' });
    const figure = (term: string) => within(baseline).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
    expect(figure('1R (original risk)')).toBe('$250.00');
    expect(figure('Original reward')).toBe('$600.00');
    expect(figure('Reward : risk')).toBe('2.4');
    await openDrawer(user, 'Journal');
    // Revision 96: the Plan Reflection is on the Plan card of the Journal drawer.
    const reflection = screen.getByRole('article', { name: 'Plan' });
    expect(within(reflection).getByText('Why this trade, why now?')).toBeTruthy();
    expect(within(reflection).getByText('Breakout above the 50-day.')).toBeTruthy();
    expect(within(reflection).getByText('Calm')).toBeTruthy();
  });
});

describe('Open Trade Detail', () => {
  it('should show Entry Quality figures with units once resolved, and Entry not yet resolved: 60 of 100 entered before', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1]));
    await openDrawer(user, 'Plan and Risk');
    const pending = await screen.findByRole('region', {
      name: 'Entry Quality',
    });
    expect(within(pending).getByText('Entry not yet resolved: 60 of 100 entered')).toBeTruthy();
    expect(within(pending).queryByText('Average entry')).toBeNull();
    cleanup();

    renderView(openDetailOf([PC1, PC2]));
    await openDrawer(user, 'Plan and Risk');
    const quality = await screen.findByRole('region', {
      name: 'Entry Quality',
    });
    expect(termValue(quality, 'Resolved at')).toBe('Position Change at 2026-10-12 11:00');
    expect(termValue(quality, 'Average entry')).toBe('$50.18');
    expect(termValue(quality, 'Actual initial risk')).toBe('$270.00 1.08R');
    expect(termValue(quality, 'Actual initial reward')).toBe('$580.00');
    expect(termValue(quality, 'Reward : risk')).toBe('2.15 planned 2.4');
    expect(termValue(quality, 'Slippage')).toBe('$18.00');
    expect(termValue(quality, 'Size')).toBe('1× planned quantity');
    expect(within(quality).getByText('$50.18').className).toContain('number');
    cleanup();

    // An entry at or below the Stop: the actual ratio is Not applicable, never a number.
    const belowStop = positionChange('pc-9', 1, [execution('ex-9', '2026-10-12T14:00:00Z', 2, '100', '47.00', '1.00')]);
    renderView(openDetailOf([belowStop]));
    await openDrawer(user, 'Plan and Risk');
    const flagged = await screen.findByRole('region', {
      name: 'Entry Quality',
    });
    expect(termValue(flagged, 'Reward : risk')).toBe('Not applicable: entry at or beyond the Stop planned 2.4');
  });
});

describe('R lines', () => {
  async function detailEntryQuality() {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2]));
    await openDrawer(user, 'Plan and Risk');
    return screen.findByRole('region', { name: 'Entry Quality' });
  }
  const valueOf = (region: HTMLElement, term: string) => within(region).getByText(term, { selector: 'dt' }).nextElementSibling as HTMLElement;

  it('should put the R multiple on its own line below Actual initial risk on the receipt and in Entry Quality', async () => {
    const value = valueOf(await detailEntryQuality(), 'Actual initial risk');
    const [amount, second] = Array.from(value.children) as HTMLElement[];
    expect(amount!.textContent).toBe('$270.00');
    expect(second!.textContent).toBe('1.08R');
    expect(second!.className).toContain('second-line');
    expect(value.textContent).not.toMatch(/[()]/);
  });

  it('should put planned 2.4 on its own line below the Reward : risk value on the receipt and in Entry Quality', async () => {
    const value = valueOf(await detailEntryQuality(), 'Reward : risk');
    const [amount, second] = Array.from(value.children) as HTMLElement[];
    expect(amount!.textContent).toBe('2.15');
    expect(second!.textContent).toBe('planned 2.4');
    expect(second!.className).toContain('second-line');
    expect(value.textContent).not.toMatch(/[()]/);
  });

  it('should keep the amount and its second line in one value cell, read in order', async () => {
    const quality = await detailEntryQuality();
    expect(valueOf(quality, 'Actual initial risk').textContent).toBe('$270.00 1.08R');
    expect(valueOf(quality, 'Reward : risk').textContent).toBe('2.15 planned 2.4');
  });
});

describe('option Trade Detail triggers (convention C3)', () => {
  useFixedClock();
  it('should show an option Plans Stop and Target as Underlying prices without a dollar sign in the Plan and Summary cards', async () => {
    const user = userEvent.setup();
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    await openDrawer(user, 'Plan and Risk');
    await screen.findByRole('heading', { name: 'XYZ', level: 1 });
    // The Summary card repeated the Plan's Stop and Target; it is retired, so the Plan card holds them once.
    for (const card of ['Plan']) {
      const region = screen.getByRole('region', { name: card });
      expect(termValue(region, 'Stop')).toBe('XYZ at or below 48.00');
      expect(termValue(region, 'Target')).toBe('XYZ at or above 60.00');
    }
    // The intended entry is a premium per share, so it keeps its dollar sign.
    expect(termValue(screen.getByRole('region', { name: 'Plan' }), 'Intended entry')).toBe('$2.00');
  });
});

describe('Trade Detail: every condition (W6, W7)', () => {
  useFixedClock();
  // The lines under a term, one per condition in Plan order.
  const linesOf = (region: HTMLElement, term: string) => Array.from(within(region).getByText(term, { selector: 'dt' }).nextElementSibling?.children ?? []).map((line) => line.textContent);

  it('should show a Planned O-S2s Stop as MNO at or below 41.00 and Option at or above $3.60 and its Target as MNO at or above 44.50 and Option at or below $0.30', async () => {
    renderView(optionPlannedDetail('O-S2'));
    await screen.findByRole('heading', { name: 'MNO', level: 1 });
    // The Summary card repeated the Plan's Stop and Target; it is retired, so the Plan card holds them once.
    for (const card of ['Plan']) {
      const region = screen.getByRole('region', { name: card });
      expect(linesOf(region, 'Stop')).toEqual(['MNO at or below 41.00', 'Option at or above $3.60']);
      expect(linesOf(region, 'Target')).toEqual(['MNO at or above 44.50', 'Option at or below $0.30']);
    }
  });
});
