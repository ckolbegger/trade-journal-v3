// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { execution, openDetailAt, PC1, positionChange } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionOpenDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { ocChange, OC_PC1 } from '../../../../tests/support/option-trade-fixtures.ts';
import { MON_CLOSE, available, renderView, termValue, useFixedClock } from './test-support.ts';

afterEach(cleanup);

describe('missing or later evidence (P12, P13)', () => {
  it('should show an At entry section for shares bought after the dated close, with risk and reward labelled from entry and no P&L', async () => {
    const afterClose = positionChange('pc-9', 3, [execution('ex-9', '2026-10-12T21:00:00Z', 4, '40', '50.30', '1.00')]);
    const monday = { instrumentKey: 'XYZ', tradingDate: '2026-10-12', closeInstant: MON_CLOSE, previousCloseInstant: '2026-10-09T20:00:00Z', resolution: available('51.20') } as const;
    renderView(openDetailAt([PC1, afterClose], monday));
    const entry = await screen.findByRole('region', { name: 'At entry' });
    expect(termValue(entry, 'Quantity')).toBe('40 shares');
    expect(termValue(entry, 'Average entry')).toBe('$50.30');
    expect(termValue(entry, 'Risk from entry')).toBe('$112.00 · 0.45R');
    expect(termValue(entry, 'Reward from entry')).toBe('$228.00 · 0.91R');
    expect(within(entry).queryByText(/P&L/)).toBeNull();
    // The earlier close keeps its own line, and the current P&L waits for the next close.
    expect(termValue(screen.getByRole('region', { name: 'At Mon Oct 12 close' }), 'Current Marked Trade P&L')).toBe('+$65.00 · +0.26R');
    expect(termValue(screen.getByRole('region', { name: 'Valuation' }), 'Current Marked Trade P&L')).toBe('Awaiting the close after Mon Oct 12');
  });
});

describe('option Trade Detail At entry (row 23.5)', () => {
  useFixedClock();
  it('should word the contracts bought after the last close in the At entry section as a contract count', async () => {
    // A contract bought Monday 17:00 New York, after the close of the frame the figures are valued at.
    const lateBuy = ocChange('pc-4', '2026-10-12T21:00:00Z', 8, 'Buy', '1', '2.00', '0.65');
    renderView(optionOpenDetail('O-C', [OC_PC1, lateBuy], { tradingDate: '2026-10-12', closeInstant: '2026-10-12T20:00:00Z', contractMark: '2.20', underlyingMark: '52.00' }));
    const atEntry = await screen.findByRole('region', { name: 'At entry' });
    expect(termValue(atEntry, 'Quantity')).toBe('1 contract');
  });
});
