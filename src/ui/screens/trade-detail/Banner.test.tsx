// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { incoherentDetailOf, openDetailOf, PC1, PC2, pc1Reflection, pc2Decline, PC3, pc3Excess } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionOpenDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { OC_PC1, OC_PC2 } from '../../../../tests/support/option-trade-fixtures.ts';
import type { IntegrityFinding, RecordedDeviation, RecordedDeviationVersion } from '../../../app/types.ts';
import { Rational } from '../../../domain/values/index.ts';
import { OC_PC3, THURSDAY, openDrawer, renderView, rowsOf, useFixedClock } from './test-support.ts';

afterEach(cleanup);

describe('Open Trade Detail', () => {
  it('should show an integrity panel listing stored versus expected values when agreement fails', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2]));
    await openDrawer(user, 'Position');
    await screen.findByRole('region', { name: 'Position' });
    expect(screen.queryByRole('region', { name: 'Records disagree', hidden: true })).toBeNull();
    cleanup();

    renderView(openDetailOf([PC1, PC2, PC3], { storedLifecycle: 'Planned' }));
    const panel = await screen.findByRole('region', {
      name: 'Records disagree',
    });
    // The stored lifecycle stays shown as stored; the disagreement is a separate concept.
    expect(screen.getByText('Long Stock, Planned', { selector: '.badge' })).toBeTruthy();
    expect(rowsOf(within(panel).getByRole('table', { name: 'Stored versus expected' }))).toEqual([
      ['Lifecycle', 'Planned', 'Open'],
      ['Entry Size Deviation, Position Change at 2026-10-12 14:00', 'None', '20 shares'],
    ]);
    expect(within(panel).getByText('Viewing this Trade does not change its records.')).toBeTruthy();
    cleanup();

    const understated = {
      ...pc3Excess,
      versions: [{ ...pc3Excess.versions[0]!, quantityAbovePlan: '15' } as RecordedDeviationVersion],
    };
    renderView(openDetailOf([PC1, PC2, PC3], { recordedDeviations: [understated] }));
    const quantities = await screen.findByRole('region', {
      name: 'Records disagree',
    });
    expect(
      rowsOf(
        within(quantities).getByRole('table', {
          name: 'Stored versus expected',
        }),
      ),
    ).toEqual([['Entry Size Deviation, Position Change at 2026-10-12 14:00', '15 shares', '20 shares']]);
  });

  it('should render a Shortfall integrity finding with its quantity below plan and its causing change time without throwing', async () => {
    const fingerprint = { tradeId: 'trade-1', plannedLegId: 'leg-1', form: 'Shortfall' } as const;
    const shortfall = {
      fingerprint,
      type: 'EntrySize',
      form: 'Shortfall',
      quantityBelowPlan: '30',
      causingPositionChangeId: 'pc-3',
      economicTime: '2026-10-12T18:00:00Z',
      status: 'Active',
    } as const;
    const recordedShortfall: RecordedDeviation = { occurrenceId: 'dev-2', versions: [shortfall] };
    const base = openDetailOf([PC1, PC2, PC3], { recordedDeviations: [recordedShortfall] });
    const findings: IntegrityFinding[] = [
      { kind: 'DeviationMissing', fingerprint, expected: { ...shortfall, quantityBelowPlan: Rational.of(30n) } },
      { kind: 'DeviationQuantityDisagreement', fingerprint, occurrenceId: 'dev-2', recorded: Rational.of(30n), expected: Rational.of(25n) },
      { kind: 'DeviationUnexpected', fingerprint, occurrenceId: 'dev-2' },
    ];
    renderView({ ...base, findings });
    const panel = await screen.findByRole('region', { name: 'Records disagree' });
    expect(rowsOf(within(panel).getByRole('table', { name: 'Stored versus expected' }))).toEqual([
      ['Entry Size Deviation, Position Change at 2026-10-12 14:00', 'None', '30 shares below plan'],
      ['Entry Size Deviation, Position Change at 2026-10-12 14:00', '30 shares below plan', '25 shares below plan'],
      ['Entry Size Deviation, Position Change at 2026-10-12 14:00', '30 shares below plan', 'None'],
    ]);
  });

  it('should list every finding as its sentence in the Detail table, under the heading Facts cannot be replayed', async () => {
    renderView(
      incoherentDetailOf(
        [PC1, PC2],
        [
          { factId: 'ex-3', kind: 'Execution', instrument: { kind: 'Stock', symbol: 'XYZ' }, economicTime: '2026-10-14T14:30:00Z', side: 'Sell', quantity: '120', reason: 'ExceedsOpenQuantity', available: Rational.of(100n) },
          { factId: 'pc-9', kind: 'PositionChange', economicTime: '2026-10-14T14:30:00Z', reason: 'DuplicateFactId' },
        ],
      ),
    );
    const panel = await screen.findByRole('region', { name: "Facts can't be replayed" });
    expect(within(panel).getByRole('heading', { name: "Facts can't be replayed", level: 2 })).toBeTruthy();
    expect(rowsOf(within(panel).getByRole('table', { name: 'Facts that cannot be replayed' }))).toEqual([
      ['Sell of 120 XYZ on Wed Oct 14, 10:30 is more than the 100 shares in the position'],
      ['Position Change on Wed Oct 14, 10:30 shares its identity with another record'],
    ]);
    expect(screen.queryByRole('region', { name: 'Records disagree', hidden: true })).toBeNull();
  });

  it('should show the Facts cannot be replayed region naming each fact that cannot be replayed, with the Plan, recorded Position Changes and Journal but no derived figures, when the facts are incoherent', async () => {
    renderView(
      incoherentDetailOf(
        [PC1, PC2],
        [
          { factId: 'ex-2', kind: 'Execution', instrument: { kind: 'Stock', symbol: 'XYZ' }, economicTime: '2026-10-12T15:00:00Z', side: 'Buy', quantity: '40', reason: 'UnknownPlannedLeg' },
          { factId: 'ex-1', kind: 'Execution', instrument: { kind: 'Stock', symbol: 'XYZ' }, economicTime: '2026-10-12T14:00:00Z', side: 'Buy', quantity: '60', reason: 'NonpositiveQuantity' },
        ],
        [pc1Reflection, pc2Decline],
      ),
    );
    const user = userEvent.setup();
    const panel = await screen.findByRole('region', { name: "Facts can't be replayed" });
    expect(rowsOf(within(panel).getByRole('table', { name: 'Facts that cannot be replayed' }))).toEqual([
      ["Buy of 40 XYZ on Mon Oct 12, 11:00 names a Planned Leg that isn't in the Plan"],
      ["Buy of 60 XYZ on Mon Oct 12, 10:00 has a quantity that isn't positive"],
    ]);
    expect(within(panel).getByText('Viewing this Trade does not change its records.')).toBeTruthy();
    expect(within(panel).getByText(/position, entry, and fulfillment figures are unavailable/i)).toBeTruthy();
    expect(screen.getByText('Long Stock, Open', { selector: '.badge' })).toBeTruthy();
    await openDrawer(user, 'Plan and Risk');
    expect(screen.getByRole('region', { name: 'Plan' })).toBeTruthy();
    await openDrawer(user, 'Position');
    const executions = screen.getByRole('region', { name: 'Executions (2)' });
    expect(
      within(executions)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-labelledby')!.split(' ').map((id) => document.getElementById(id)!.textContent).join(' ')),
    ).toEqual(['Buy 60 XYZ @ $50.10 2026-10-12 10:00 details', 'Buy 40 XYZ @ $50.30 2026-10-12 11:00 details']);
    await openDrawer(user, 'Journal');
    // An incoherent Detail lists its entries as one Journal card (W13), which replaces the Journal section.
    expect(within(screen.getByRole('article', { name: 'Journal' })).getByText('Reflection declined')).toBeTruthy();
    // The narrative is the Journal section's alone, as in the Open form.
    expect(screen.queryByRole('region', { name: 'Position Change Reflection', hidden: true })).toBeNull();
    for (const derived of ['Plan Baseline', 'Position', 'Entry Quality', 'Planned-Leg Fulfillment', 'Deviations']) {
      expect(screen.queryByRole('region', { name: derived, hidden: true })).toBeNull();
    }
  });
});

describe('incoherent Trade Detail', () => {
  const incoherent = () => incoherentDetailOf([PC1], [{ factId: 'ex-1', kind: 'Execution', instrument: { kind: 'Stock', symbol: 'XYZ' }, economicTime: '2026-10-12T14:00:00Z', side: 'Buy', quantity: '60', reason: 'UnknownPlannedLeg' }]);

  it('should explain beside the Facts cannot be replayed panel that new entries cannot be recorded until the records agree', async () => {
    renderView(incoherent(), true);
    const panel = await screen.findByRole('region', { name: "Facts can't be replayed" });
    expect(within(panel).getByText('New entries cannot be recorded for this Trade until its records agree.')).toBeTruthy();
  });
});

describe('option Trade Detail Deviations and Fulfillment (rows 20.15, 23.2, 23.8)', () => {
  useFixedClock();
  it('should word an option Trades unrecorded Entry Size Deviation in contracts in the Records disagree table', async () => {
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_PC3], THURSDAY));
    const table = within(await screen.findByRole('region', { name: 'Stored versus expected' })).getByRole('table');
    expect(within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((c) => c.textContent))).toEqual([
      ['Entry Size Deviation, Position Change at 2026-10-12 12:00', 'None', '1 contract'],
    ]);
  });
});
