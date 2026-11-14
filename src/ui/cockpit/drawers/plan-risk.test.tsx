// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { openDetailAt, openDetailOf, openDetailUncovered, PC1, PC2, PC3 } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionOpenDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { OC_PC1, OC_PC2, OC_X1 } from '../../../../tests/support/option-trade-fixtures.ts';
import { plannedDetail } from '../../../../tests/support/views-fixtures.ts';
import { THURSDAY, tuesday, useFixedClock } from '../../screens/trade-detail/test-support.ts';
import { PlanRiskDrawer } from './plan-risk.tsx';

afterEach(cleanup);

const termsIn = (region: HTMLElement) => within(region).queryAllByText(/.*/, { selector: 'dt' }).map((term) => term.textContent);
const valueOf = (region: HTMLElement, term: string) => within(region).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;

describe('Plan and Risk drawer and footer (P96)', () => {
  it('should show the Plan, the Plan Baseline with 1R and the original reward once, and Entry Quality, with no Summary duplicate on the page', () => {
    const { container } = render(<PlanRiskDrawer view={openDetailOf([PC1, PC2])} timeZone="America/New_York" />);
    const plan = screen.getByRole('region', { name: 'Plan' });
    expect(termsIn(plan)).toEqual(['Leg', 'Intended entry', 'Stop', 'Target', 'Plan time', 'Account']);
    expect(valueOf(plan, 'Stop')).toBe('$47.50');
    const baseline = screen.getByRole('region', { name: 'Plan Baseline' });
    expect(termsIn(baseline)).toEqual(['1R (original risk)', 'Original reward', 'Reward : risk']);
    expect(valueOf(baseline, '1R (original risk)')).toBe('$250.00');
    expect(valueOf(baseline, 'Original reward')).toBe('$600.00');
    const quality = screen.getByRole('region', { name: 'Entry Quality' });
    expect(valueOf(quality, 'Average entry')).toBe('$50.18');
    // Each Plan figure once, and none of the Summary card's own figures (Net cost, Quantity, Opening fees, a bare 1R). The Entry status is one
    // now, in Entry Quality (T8P.31, revision 96).
    const terms = Array.from(container.querySelectorAll('dt')).map((term) => term.textContent);
    for (const once of ['Intended entry', 'Stop', 'Target', '1R (original risk)', 'Original reward']) expect(terms.filter((term) => term === once)).toHaveLength(1);
    for (const summaryOnly of ['Net cost', 'Quantity', 'Opening fees', '1R']) expect(terms).not.toContain(summaryOnly);
    expect(screen.queryByRole('region', { name: 'Summary', hidden: true })).toBeNull();
  });

  it('should show the entry as not entered on a Planned Detail', () => {
    render(<PlanRiskDrawer view={plannedDetail} timeZone="America/New_York" />);
    // The existing Entry Quality words with nothing entered (P96); a Planned Detail has no Average entry or Actual initial risk to show.
    const quality = screen.getByRole('region', { name: 'Entry Quality' });
    expect(within(quality).getByText('Entry not yet resolved: 0 of 100 entered')).toBeTruthy();
    expect(termsIn(quality)).toEqual([]);
    expect(valueOf(screen.getByRole('region', { name: 'Plan Baseline' }), '1R (original risk)')).toBe('$250.00');
  });
});

// Figures the retired Summary card and Risk and reward section gave, moved here with their expected values (T8P.27, revision 86).
describe('Plan and Risk drawer: figures moved from the retired Summary card and Risk and reward section (T8P.27)', () => {
  useFixedClock();

  it('should show the Stop and Target of an Open Detail, the Intended entry as a number on a Planned one, and no Actual initial risk or Average entry while the entry is pending', () => {
    render(<PlanRiskDrawer view={openDetailOf([PC1, PC2, PC3])} timeZone="America/New_York" />);
    const plan = screen.getByRole('region', { name: 'Plan' });
    expect(valueOf(plan, 'Stop')).toBe('$47.50');
    expect(valueOf(plan, 'Target')).toBe('$56.00');
    cleanup();

    render(<PlanRiskDrawer view={plannedDetail} timeZone="America/New_York" />);
    expect(within(screen.getByRole('region', { name: 'Plan' })).getByText('$50.00', { selector: 'dd' }).className).toContain('number');
    cleanup();

    const { container } = render(<PlanRiskDrawer view={openDetailOf([PC1])} timeZone="America/New_York" />);
    const quality = screen.getByRole('region', { name: 'Entry Quality' });
    expect(within(quality).getByText('Entry not yet resolved: 60 of 100 entered')).toBeTruthy();
    const terms = Array.from(container.querySelectorAll('dt')).map((term) => term.textContent);
    expect(terms).not.toContain('Average entry');
    expect(terms).not.toContain('Actual initial risk');
  });

  it('should show the contract, the Leg and the Exercise Intent of an option Trade Plan', () => {
    render(<PlanRiskDrawer view={optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY)} timeZone="America/New_York" />);
    const plan = screen.getByRole('region', { name: 'Plan' });
    expect(valueOf(plan, 'Contract')).toBe('XYZ 20 Nov 2026 55 Call');
    expect(valueOf(plan, 'Leg')).toBe('Long 2 contracts of XYZ 20 Nov 2026 55 Call');
    expect(valueOf(plan, 'Exercise Intent')).toBe('Not authorized in advance');
  });

  it('should show a NotApplicable Slippage as Not applicable followed by its words, never a raw code', () => {
    const base = openDetailUncovered([PC1, PC2], '2031-01-02');
    const quality = base.entryQuality.kind === 'Value' ? base.entryQuality.value : undefined;
    const view = { ...base, entryQuality: { kind: 'Value', value: { ...quality, slippage: { kind: 'NotApplicable', reason: 'EntryNotResolved' } } } } as unknown as ComponentProps<typeof PlanRiskDrawer>['view'];
    render(<PlanRiskDrawer view={view} timeZone="America/New_York" />);
    expect(valueOf(screen.getByRole('region', { name: 'Entry Quality' }), 'Slippage')).toBe('Not applicable: entry not resolved yet');
  });
});

// A222: an Unavailable per-condition figure says why at the figure length, where the figure lives, never a bare "—" (T8P.23-B8).
describe('Plan and Risk drawer: unavailable condition figures (A222, T8P.23-B8)', () => {
  useFixedClock();

  it('should word a missing Mark in Risk to stop and Reward to target at the figure length, with no bare dash left', () => {
    const view = openDetailAt([PC1, PC2], tuesday({ kind: 'Missing' }));
    expect(view.current.evaluation.conditions.every((c) => c.result.kind === 'Unavailable')).toBe(true);
    const { container } = render(<PlanRiskDrawer view={view} timeZone="America/New_York" />);
    const figures = Array.from(container.querySelectorAll('dt'))
      .filter((term) => ['Risk to stop', 'Reward to target'].includes(term.textContent ?? ''))
      .map((term) => term.nextElementSibling?.textContent);
    expect(figures).toEqual(['Mark missing: XYZ, Tue Oct 13', 'Mark missing: XYZ, Tue Oct 13']);
    expect(figures.some((figure) => figure?.includes('—'))).toBe(false);
  });
});
