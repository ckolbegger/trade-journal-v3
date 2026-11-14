// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { openDetailAt, openDetailUncovered, PC1, PC2 } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionOpenDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { OC_PC1, OC_PC2, OC_X1 } from '../../../../tests/support/option-trade-fixtures.ts';
import { Rational } from '../../../domain/values/index.ts';
// The Valuation section is retired from the shell (T8P.22), so these cases render it directly (`renderLegacyView`) until T8P.27 removes them.
import { MON_CLOSE, THURSDAY, available, renderLegacyView as renderView, termValue, tuesday, useFixedClock } from './test-support.ts';

afterEach(cleanup);

const monContext = { tradingDate: '2026-10-12', price: '51.20', revisionId: 'm-0', revisionNumber: 1, closeInstant: MON_CLOSE };

describe('valuation', () => {
  it('should show the Expected Mark Date, the Mark price, source Manual, save time in the Workspace zone, and a Corrected badge with its reason when the effective revision is a Correction', async () => {
    renderView(openDetailAt([PC1, PC2], tuesday(available('52.00', { correctionReason: 'Typo in the first save.' }))));
    const valuation = await screen.findByRole('region', { name: 'Valuation' });
    expect(termValue(valuation, 'Expected Mark Date')).toBe('Tue Oct 13');
    expect(termValue(valuation, 'Mark')).toBe('$52.00');
    expect(termValue(valuation, 'Source')).toBe('Manual');
    expect(termValue(valuation, 'Saved')).toBe('2026-10-13 17:30');
    expect(within(valuation).getByText('Corrected', { selector: '.badge' })).toBeTruthy();
    expect(within(valuation).getByText('Typo in the first save.')).toBeTruthy();
    cleanup();

    renderView(openDetailAt([PC1, PC2], tuesday(available('52.00'))));
    const plain = await screen.findByRole('region', { name: 'Valuation' });
    expect(within(plain).queryByText('Corrected')).toBeNull();
  });

  it('should show realized to date, open, Current Marked Trade P&L, and incurred fees as separate figures with units and signs', async () => {
    renderView(openDetailAt([PC1, PC2], tuesday(available('52.00'))));
    const valuation = await screen.findByRole('region', { name: 'Valuation' });
    expect(termValue(valuation, 'Realized to date')).toBe('$0.00');
    expect(termValue(valuation, 'Open P&L')).toBe('+$180.00');
    expect(termValue(valuation, 'Current Marked Trade P&L')).toBe('+$180.00 · +0.72R');
    expect(termValue(valuation, 'Incurred fees')).toBe('$2.00');
    cleanup();

    // A loss carries its minus; realized and fees keep their values when the Mark is missing.
    renderView(openDetailAt([PC1, PC2], tuesday(available('48.00'))));
    const loss = await screen.findByRole('region', { name: 'Valuation' });
    expect(termValue(loss, 'Open P&L')).toBe('−$220.00');
    expect(termValue(loss, 'Current Marked Trade P&L')).toBe('−$220.00 · −0.88R');
    cleanup();

    renderView(openDetailAt([PC1, PC2], tuesday({ kind: 'Missing' })));
    const missing = await screen.findByRole('region', { name: 'Valuation' });
    expect(termValue(missing, 'Realized to date')).toBe('$0.00');
    expect(termValue(missing, 'Incurred fees')).toBe('$2.00');
    expect(termValue(missing, 'Open P&L')).toBe('Mark missing: XYZ, Tue Oct 13');
    expect(termValue(missing, 'Current Marked Trade P&L')).toBe('Mark missing: XYZ, Tue Oct 13');
  });

  it('should show realized to date with a plus sign for a gain and a minus sign for a loss, in the current and the dated figures', async () => {
    const withRealized = (value: bigint) => {
      const detail = openDetailAt([PC1, PC2], tuesday({ kind: 'Missing', stale: monContext }));
      const realizedToDate = { kind: 'Value' as const, value: Rational.of(value) };
      const { datedLine } = detail.current;
      if (!datedLine) throw new Error('fixture needs a dated line');
      return { ...detail, current: { ...detail.current, evaluation: { ...detail.current.evaluation, realizedToDate }, datedLine: { ...datedLine, evaluation: { ...datedLine.evaluation, realizedToDate } } } };
    };
    renderView(withRealized(120n));
    const gain = await screen.findByRole('region', { name: 'Valuation' });
    expect(termValue(gain, 'Realized to date')).toBe('+$120.00');
    expect(termValue(screen.getByRole('region', { name: 'At the Mon Oct 12 Marks' }), 'Realized to date')).toBe('+$120.00');
    cleanup();

    renderView(withRealized(-75n));
    const loss = await screen.findByRole('region', { name: 'Valuation' });
    expect(termValue(loss, 'Realized to date')).toBe('−$75.00');
    expect(termValue(screen.getByRole('region', { name: 'At the Mon Oct 12 Marks' }), 'Realized to date')).toBe('−$75.00');
  });
});

describe('missing or later evidence (P12, P13)', () => {
  it('should link Trade Detail Mark missing line to the Review with its trade id and instrument key', async () => {
    renderView(openDetailAt([PC1, PC2], tuesday({ kind: 'Missing' })));
    const valuation = await screen.findByRole('region', { name: 'Valuation' });
    // The Trade being read is named, so the Review opens this Trade's card, not another Trade's on the same Instrument.
    expect(within(valuation).getByRole('link', { name: 'Mark missing for XYZ on Tue Oct 13' }).getAttribute('href')).toBe('/review?trade=trade-1&instrument=XYZ');
  });

  it('should show Mark missing for XYZ on Tue Oct 13, the Stale context labelled stale, an At the Mon Oct 12 Marks section with its own figures, and a link to the Review Marks family', async () => {
    renderView(openDetailAt([PC1, PC2], tuesday({ kind: 'Missing', stale: monContext })));
    const valuation = await screen.findByRole('region', { name: 'Valuation' });
    const link = within(valuation).getByRole('link', { name: 'Mark missing for XYZ on Tue Oct 13' });
    expect(link.getAttribute('href')).toBe('/review?trade=trade-1&instrument=XYZ');
    expect(within(valuation).getByText('Stale context: $51.20 from Mon Oct 12 close (stale, not used in any current figure)')).toBeTruthy();
    expect(termValue(valuation, 'Current Marked Trade P&L')).toBe('Mark missing: XYZ, Tue Oct 13');

    const dated = screen.getByRole('region', { name: 'At the Mon Oct 12 Marks' });
    expect(termValue(dated, 'Mark')).toBe('$51.20');
    expect(termValue(dated, 'Open P&L')).toBe('+$100.00');
    expect(termValue(dated, 'Current Marked Trade P&L')).toBe('+$100.00 · +0.40R');
    expect(termValue(dated, 'Risk to stop')).toBe('$370.00 · 1.48R');
    expect(termValue(dated, 'Reward to target')).toBe('$480.00 · 1.92R');
  });

  it('should show Outside the market calendar with the date for an Open Trade Mark-dependent figures outside coverage while realized and fees keep their values', async () => {
    renderView(openDetailUncovered([PC1, PC2], '2031-01-02'));
    const valuation = await screen.findByRole('region', { name: 'Valuation' });
    expect(within(valuation).queryByText('Expected Mark Date')).toBeNull();
    expect(termValue(valuation, 'Realized to date')).toBe('$0.00');
    expect(termValue(valuation, 'Incurred fees')).toBe('$2.00');
    expect(termValue(valuation, 'Current Marked Trade P&L')).toBe('Outside the market calendar: Thu Jan 2');
    expect(within(valuation).queryByText(/Mark missing/)).toBeNull();
    const risk = screen.getByRole('region', { name: 'Risk and reward' });
    expect(termValue(risk, 'Risk to stop')).toBe('Outside the market calendar: Thu Jan 2');
    expect(termValue(risk, 'Max reward')).toBe('Unbounded above');
  });

  it('should show an acknowledged unavailable Mark as the trader acknowledgment it is, not a link and not a price', async () => {
    const acknowledgment = { versionId: 'ack-1', kind: 'Asserted', observedAt: '2026-10-13T21:00:00Z', savedAt: '2026-10-13T21:30:00Z' };
    renderView(openDetailAt([PC1, PC2], tuesday({ kind: 'AcknowledgedUnavailable', acknowledgment, stale: monContext } as never)));
    const valuation = await screen.findByRole('region', { name: 'Valuation' });
    expect(within(valuation).getByText('Mark acknowledged unavailable for XYZ on Tue Oct 13: your acknowledgment, not a price')).toBeTruthy();
    expect(within(valuation).queryByRole('link', { hidden: true })).toBeNull();
    expect(within(valuation).queryByText(/Mark missing for/)).toBeNull();
    expect(termValue(valuation, 'Current Marked Trade P&L')).toBe('Acknowledged unavailable: XYZ, Tue Oct 13');
    expect(within(valuation).getByText(/^Stale context: \$51\.20/)).toBeTruthy();
  });
});

describe('option Trade Detail Valuation Underlying Mark (row 23.18)', () => {
  useFixedClock();
  it('should show the Valuation sections Underlying Mark with its price and provenance, Manual', async () => {
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    const valuation = await screen.findByRole('region', { name: 'Valuation' });
    expect(termValue(valuation, 'Underlying Mark')).toBe('$52.00 · Manual');
  });
});
