// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { openDetailOf, PC1, PC2, PC3, pc3Excess } from '../../../tests/support/open-detail-fixtures.ts';
import { plannedDetail } from '../../../tests/support/views-fixtures.ts';
import { DetailFooter } from './footer.tsx';

afterEach(cleanup);

describe('Plan and Risk drawer and footer (P96)', () => {
  it('should show Planned-Leg Fulfillment and Deviations below the drawers', () => {
    const zone = 'America/New_York';
    const { container, rerender } = render(<DetailFooter view={openDetailOf([PC1, PC2, PC3], { recordedDeviations: [pc3Excess] })} timeZone={zone} />);
    // The two sections, in their existing words, in this order.
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Planned-Leg Fulfillment', 'Deviations']);
    const fulfillment = screen.getByRole('region', { name: 'Planned-Leg Fulfillment' });
    const label = within(fulfillment).getByText('Long 100 shares of XYZ', { selector: 'dt' });
    expect(label.closest('dl')?.className).toContain('figure-grid');
    expect(label.nextElementSibling?.textContent).toBe('Filled with Deviation');
    const deviations = screen.getByRole('region', { name: 'Deviations' });
    expect(within(deviations).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Entry Size (Excess): 20 shares above plan, caused by the Position Change at 2026-10-12 14:00.',
    ]);
    // Nothing recorded, and a Superseded one struck through and named for assistive technology.
    rerender(<DetailFooter view={openDetailOf([PC1])} timeZone={zone} />);
    expect(within(screen.getByRole('region', { name: 'Deviations' })).getByText('No Deviations recorded.')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Planned-Leg Fulfillment' })).getByText('Long 100 shares of XYZ', { selector: 'dt' }).nextElementSibling?.textContent).toBe(
      'Partially filled',
    );
    const superseded = { ...pc3Excess, versions: [{ ...pc3Excess.versions[0]!, status: 'Superseded' as const, reason: 'NoLongerExpected' as const }] } as unknown as typeof pc3Excess;
    rerender(<DetailFooter view={openDetailOf([PC1, PC2, PC3], { recordedDeviations: [superseded] })} timeZone={zone} />);
    const item = within(screen.getByRole('region', { name: 'Deviations' })).getByRole('listitem');
    expect(item.querySelector('del')?.textContent).toContain('Entry Size (Excess): 20 shares above plan');
    expect(item.querySelector('.visually-hidden')?.textContent).toBe('Superseded');
    // A Planned Detail has no Position, so no footer.
    rerender(<DetailFooter view={plannedDetail} timeZone={zone} />);
    expect(container.textContent).toBe('');
  });
});
