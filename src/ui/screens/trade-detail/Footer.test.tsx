// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { openDetailOf, PC1, PC2, PC3, pc3Excess } from '../../../../tests/support/open-detail-fixtures.ts';
import { ocExcess, optionOpenDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { OC_PC1, OC_PC2 } from '../../../../tests/support/option-trade-fixtures.ts';
import { OC_PC3, THURSDAY, renderView, termValue, useFixedClock } from './test-support.ts';

afterEach(cleanup);

describe('Open Trade Detail', () => {
  it('should show Planned-Leg Fulfillment and each Entry Size Deviation with its quantity and causing Position Change', async () => {
    renderView(openDetailOf([PC1]));
    const partial = await screen.findByRole('region', {
      name: 'Planned-Leg Fulfillment',
    });
    expect(termValue(partial, 'Long 100 shares of XYZ')).toBe('Partially filled');
    expect(within(screen.getByRole('region', { name: 'Deviations' })).getByText('No Deviations recorded.')).toBeTruthy();
    cleanup();

    renderView(openDetailOf([PC1, PC2, PC3], { recordedDeviations: [pc3Excess] }));
    const fulfillment = await screen.findByRole('region', {
      name: 'Planned-Leg Fulfillment',
    });
    expect(termValue(fulfillment, 'Long 100 shares of XYZ')).toBe('Filled with Deviation');
    const deviations = screen.getByRole('region', { name: 'Deviations' });
    expect(
      within(deviations)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Entry Size (Excess): 20 shares above plan, caused by the Position Change at 2026-10-12 14:00.']);
  });
});

describe('fulfillment row', () => {
  it('should show Planned-Leg Fulfillment as a label/value row with the leg as label and the result as value', async () => {
    renderView(openDetailOf([PC1, PC2, PC3], { recordedDeviations: [pc3Excess] }));
    const fulfillment = await screen.findByRole('region', { name: 'Planned-Leg Fulfillment' });
    const label = within(fulfillment).getByText('Long 100 shares of XYZ', { selector: 'dt' });
    expect(label.closest('dl')?.classList.contains('figure-grid')).toBe(true);
    expect(label.nextElementSibling?.textContent).toBe('Filled with Deviation');
  });
});

describe('deviations', () => {
  const superseded = {
    ...pc3Excess,
    versions: [{ ...pc3Excess.versions[0]!, status: 'Superseded' as const, reason: 'NoLongerExpected' as const }],
  } as unknown as typeof pc3Excess;
  const deviationItem = async (recorded: typeof pc3Excess) => {
    renderView(openDetailOf([PC1, PC2, PC3], { recordedDeviations: [recorded] }));
    const region = await screen.findByRole('region', { name: 'Deviations' });
    return within(region).getByRole('listitem');
  };

  it('should show an Active Deviation as plain text with no status badge', async () => {
    const item = await deviationItem(pc3Excess);
    expect(item.textContent).toBe('Entry Size (Excess): 20 shares above plan, caused by the Position Change at 2026-10-12 14:00.');
    expect(item.querySelector('.badge, del')).toBeNull();
  });

  it('should strike through a Superseded Deviation and name it Superseded for assistive technology', async () => {
    const item = await deviationItem(superseded);
    const struck = item.querySelector('del')!;
    expect(struck.textContent).toContain('Entry Size (Excess): 20 shares above plan');
    expect(item.querySelector('.badge')).toBeNull();
    const hidden = item.querySelector('.visually-hidden')!;
    expect(hidden.textContent).toBe('Superseded');
    expect(hidden.compareDocumentPosition(struck) & Node.DOCUMENT_POSITION_FOLLOWING || struck.contains(hidden)).toBeTruthy();
  });
});

describe('option Trade Detail Deviations and Fulfillment (rows 20.15, 23.2, 23.8)', () => {
  useFixedClock();
  it('should word an option Entry Size Deviation and the Planned Leg in contracts on Trade Detail', async () => {
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_PC3], THURSDAY, { recordedDeviations: [ocExcess] }));
    const deviations = await screen.findByRole('region', { name: 'Deviations' });
    expect(within(deviations).getByText('Entry Size (Excess): 1 contract above plan, caused by the Position Change at 2026-10-12 12:00.')).toBeTruthy();
    const fulfillment = screen.getByRole('region', { name: 'Planned-Leg Fulfillment' });
    expect(within(fulfillment).getByText('Long 2 contracts of XYZ 20 Nov 2026 55 Call', { selector: 'dt' })).toBeTruthy();
  });
});
