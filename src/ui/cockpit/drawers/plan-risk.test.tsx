// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { openDetailOf, PC1, PC2 } from '../../../../tests/support/open-detail-fixtures.ts';
import { plannedDetail } from '../../../../tests/support/views-fixtures.ts';
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
    // Each Plan figure once, and none of the Summary card's own figures (Net cost, Quantity, Entry, Opening fees, a bare 1R).
    const terms = Array.from(container.querySelectorAll('dt')).map((term) => term.textContent);
    for (const once of ['Intended entry', 'Stop', 'Target', '1R (original risk)', 'Original reward']) expect(terms.filter((term) => term === once)).toHaveLength(1);
    for (const summaryOnly of ['Net cost', 'Quantity', 'Entry', 'Opening fees', '1R']) expect(terms).not.toContain(summaryOnly);
    expect(screen.queryByRole('region', { name: 'Summary' })).toBeNull();
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
