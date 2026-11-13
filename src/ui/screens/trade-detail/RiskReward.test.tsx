// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { openDetailAt, openDetailUncovered, PC1, PC2 } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionOpenDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { OC_PC1, OC_PC2, OC_X1, OS2_S1 } from '../../../../tests/support/option-trade-fixtures.ts';
import type { TradeDetailView } from '../../../app/types.ts';
import { THURSDAY, available, openDrawer, renderView, rowsOf, termValue, tuesday, useFixedClock } from './test-support.ts';

afterEach(cleanup);

describe('risk and reward', () => {
  it('should show Original risk, Risk to stop, Worst case, Reward to target, Max reward, and Original reward with dollars and R, rendering Unbounded as Unbounded and Unavailable with its reason, never as 0', async () => {
    renderView(openDetailAt([PC1, PC2], tuesday(available('52.00'))));
    const risk = await screen.findByRole('region', { name: 'Risk and reward' });
    expect(termValue(risk, 'Original risk')).toBe('$250.00 · 1.00R');
    expect(termValue(risk, 'Risk to stop')).toBe('$450.00 · 1.80R');
    expect(termValue(risk, 'Worst case')).toBe('$5,200.00 · 20.80R');
    expect(termValue(risk, 'Reward to target')).toBe('$400.00 · 1.60R');
    expect(termValue(risk, 'Max reward')).toBe('Unbounded above');
    expect(termValue(risk, 'Original reward')).toBe('$600.00 · 2.40R');
    cleanup();

    renderView(openDetailAt([PC1, PC2], tuesday({ kind: 'Missing' })));
    const missing = await screen.findByRole('region', { name: 'Risk and reward' });
    for (const term of ['Risk to stop', 'Worst case', 'Reward to target']) expect(termValue(missing, term)).toBe('Mark missing: XYZ, Tue Oct 13');
    expect(termValue(missing, 'Max reward')).toBe('Unbounded above');
    expect(termValue(missing, 'Original risk')).toBe('$250.00 · 1.00R');
  });

  it('should show each condition with its boundary, status as text, distance, and Overrun when crossed', async () => {
    renderView(openDetailAt([PC1, PC2], tuesday(available('52.00'))));
    const conditions = await screen.findByRole('table', { name: 'Conditions' });
    expect(rowsOf(conditions)).toEqual([
      ['Stop', '$47.50', 'Active', '$450.00 · 1.80R', 'None'],
      ['Target', '$56.00', 'Active', '$400.00 · 1.60R', 'None'],
    ]);
    cleanup();

    renderView(openDetailAt([PC1, PC2], tuesday(available('57.00'))));
    expect(rowsOf(await screen.findByRole('table', { name: 'Conditions' }))[1]).toEqual(['Target', '$56.00', 'Reached', '$0.00 · 0.00R', '$100.00 · 0.40R']);
    cleanup();

    renderView(openDetailAt([PC1, PC2], tuesday(available('47.00'))));
    expect(rowsOf(await screen.findByRole('table', { name: 'Conditions' }))[0]).toEqual(['Stop', '$47.50', 'Breached', '$0.00 · 0.00R', '$50.00 · 0.20R']);
    cleanup();

    // Without a Mark the status says why, and no distance or Overrun is invented.
    renderView(openDetailAt([PC1, PC2], tuesday({ kind: 'Missing' })));
    expect(rowsOf(await screen.findByRole('table', { name: 'Conditions' }))[0]).toEqual(['Stop', '$47.50', 'Mark missing: XYZ, Tue Oct 13', '—', '—']);
  });
});

describe('missing or later evidence (P12, P13)', () => {
  it('should show each NotApplicable figure on Detail as Not applicable followed by its words, never a raw code', async () => {
    const user = userEvent.setup();
    const base = openDetailUncovered([PC1, PC2], '2031-01-02');
    const notApplicable = (reason: string) => ({ kind: 'NotApplicable', reason });
    const quality = base.entryQuality.kind === 'Value' ? base.entryQuality.value : undefined;
    const view = {
      ...base,
      entryQuality: { kind: 'Value', value: { ...quality, slippage: notApplicable('EntryNotResolved') } },
      current: {
        ...base.current,
        evaluation: {
          ...base.current.evaluation,
          ongoingRiskToStop: notApplicable('NoOngoingRisk'),
          ongoingRiskToStopInPlanR: notApplicable('NoOngoingRisk'),
          incrementalRewardToTarget: notApplicable('NoRemainingPosition'),
          incrementalRewardToTargetInPlanR: notApplicable('NoRemainingPosition'),
        },
      },
    } as unknown as TradeDetailView;
    renderView(view);
    const risk = await screen.findByRole('region', { name: 'Risk and reward' });
    expect(termValue(risk, 'Risk to stop')).toBe('Not applicable: no risk to the Stop');
    expect(termValue(risk, 'Reward to target')).toBe('Not applicable: no open position');
    await openDrawer(user, 'Plan and Risk');
    expect(termValue(screen.getByRole('region', { name: 'Entry Quality' }), 'Slippage')).toBe('Not applicable: entry not resolved yet');
  });
});

describe('option Trade Detail conditions (row 23.17)', () => {
  useFixedClock();
  it('should add the contracts value at expiration and the distance on the Underlying to each Stop and Target, with the trigger as an Underlying price', async () => {
    renderView(optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY));
    const table = within(await screen.findByRole('region', { name: 'Stop and Target conditions' })).getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    const cell = (role: string, header: string) => {
      const row = within(table).getAllByRole('row').find((r) => within(r).queryAllByRole('cell')[0]?.textContent === role)!;
      return within(row).getAllByRole('cell')[headers.indexOf(header)]?.textContent;
    };
    expect(headers).toEqual(expect.arrayContaining(['Value at expiration', 'Distance on XYZ']));
    expect(cell('Stop on XYZ', 'Boundary')).toBe('48.00');
    expect(cell('Stop on XYZ', 'Value at expiration')).toBe('$0.00');
    expect(cell('Stop on XYZ', 'Distance on XYZ')).toBe('4.00');
    expect(cell('Target on XYZ', 'Boundary')).toBe('60.00');
    expect(cell('Target on XYZ', 'Value at expiration')).toBe('$5.00');
    expect(cell('Target on XYZ', 'Distance on XYZ')).toBe('8.00');
  });
});

describe('Trade Detail: every condition (W6, W7)', () => {
  useFixedClock();
  it('should list Wednesdays O-S2 conditions as four rows, Stop on MNO Active 60.00 with value at expiration 4.00 and 2.20 on MNO, Stop on the option price at 3.60 Breached with Overrun 20.00 and a dash in both option columns, then both Targets', async () => {
    // Wednesday 10-14: MNO 43.20, the put 3.70.
    renderView(optionOpenDetail('O-S2', [OS2_S1], { tradingDate: '2026-10-14', closeInstant: '2026-10-14T20:00:00Z', contractMark: '3.70', underlyingMark: '43.20' }));
    const table = within(await screen.findByRole('region', { name: 'Stop and Target conditions' })).getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    const rows = within(table).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent ?? ''));
    expect(rows.map((r) => r[headers.indexOf('Condition')])).toEqual(['Stop on MNO', 'Stop on the option price', 'Target on MNO', 'Target on the option price']);
    const column = (row: number, header: string) => rows[row]![headers.indexOf(header)];
    expect([column(0, 'Boundary'), column(0, 'Status'), column(0, 'Value at expiration'), column(0, 'Distance on MNO')]).toEqual(['41.00', 'Active', '$4.00', '2.20']);
    expect(column(0, 'Distance')).toMatch(/^\$60\.00/);
    expect([column(1, 'Boundary'), column(1, 'Status'), column(1, 'Value at expiration'), column(1, 'Distance on MNO')]).toEqual(['$3.60', 'Breached', '—', '—']);
    expect(column(1, 'Overrun')).toMatch(/^\$20\.00/);
    expect([column(2, 'Boundary'), column(3, 'Boundary')]).toEqual(['44.50', '$0.30']);
  });
});
