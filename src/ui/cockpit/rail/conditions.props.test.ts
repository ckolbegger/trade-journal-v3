// @vitest-environment jsdom
// The Conditions card through the shell's path (D08P T8P.14): a Detail view, as the shell passes it, rendered by `ConditionsCard`. Only an adapter
// test may build view data from `app/types` (A216), so the cases live here.
import { cleanup, render, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { optionClosedDetail, optionOpenDetail, optionPlannedDetail, type OptionFrames } from '../../../../tests/support/option-detail-fixtures.ts';
import { OC_E1, OC_PC1, OC_PC2, OC_X1, OS2_S1 } from '../../../../tests/support/option-trade-fixtures.ts';
import type { OpenTradeDetail, TradeDetailView } from '../../../app/types.ts';
import { ConditionsCard } from './conditions.tsx';

afterEach(cleanup);

const TIME_ZONE = 'America/New_York';
// O-S2's Marks (D7S section 4): MNO and the put at each close.
const TUESDAY: OptionFrames = { tradingDate: '2026-10-13', closeInstant: '2026-10-13T20:00:00Z', contractMark: '1.80', underlyingMark: '44.00' };
const WEDNESDAY: OptionFrames = { tradingDate: '2026-10-14', closeInstant: '2026-10-14T20:00:00Z', contractMark: '3.70', underlyingMark: '43.20' };

const os2 = (frames: OptionFrames): OpenTradeDetail => optionOpenDetail('O-S2', [OS2_S1], frames);

// What T8P.6 adds to each Detail: `nearest` on the one condition per role that sets the role's headline (A207).
const withNearest = (view: OpenTradeDetail, ...ids: string[]): OpenTradeDetail => ({
  ...view,
  current: { ...view.current, evaluation: { ...view.current.evaluation, conditions: view.current.evaluation.conditions.map((c) => (ids.includes(c.id) ? { ...c, nearest: true as const } : c)) } },
});

// The card as the shell renders it.
const renderCard = (view: TradeDetailView) => render(createElement(ConditionsCard, { view, timeZone: TIME_ZONE })).container;
// One block per condition, not the lines beneath them.
const blocks = (container: HTMLElement) => within(within(container).getByRole('list', { name: 'Conditions' })).getAllByRole('listitem');

describe('Conditions card (W5, W6)', () => {
  it("should list O-S2's four conditions in Plan order with the role, and the full condition on one line that does not wrap", () => {
    const items = blocks(renderCard(os2(TUESDAY)));
    expect(items.map((item) => [within(item).queryByText('Stop') ? 'Stop' : 'Target', item.querySelector('.condition-text')?.textContent])).toEqual([
      ['Stop', 'MNO at or below 41.00'],
      ['Stop', 'Option at or above $3.60'],
      ['Target', 'MNO at or above 44.50'],
      ['Target', 'Option at or below $0.30'],
    ]);
    // The condition is one element, kept on one line.
    for (const item of items) expect(item.querySelector('.condition-text')?.classList.contains('nowrap')).toBe(true);
  });

  it('should show Tuesday\'s option-price Stop as "−$360.00" with "nearest" and "Change in Trade P&L from the Tue Oct 13 Marks if the option\'s Mark is $3.60 (−0.75R)."', () => {
    const items = blocks(renderCard(withNearest(os2(TUESDAY), 'stop-2', 'target-1')));
    const stop = items[1]!;
    expect(within(stop).getByText('−$360.00')).toBeTruthy();
    expect(within(stop).getByText('nearest')).toBeTruthy();
    expect(within(stop).getByText("Change in Trade P&L from the Tue Oct 13 Marks if the option's Mark is $3.60 (−0.75R).")).toBeTruthy();
    // Only the nearest condition of a role carries the badge.
    expect(items.map((item) => within(item).queryByText('nearest') !== null)).toEqual([false, true, true, false]);
  });

  it('should explain an Underlying condition as "… if MNO is at 41.00 at expiration (−0.92R)."', () => {
    const stop = blocks(renderCard(os2(TUESDAY)))[0]!;
    expect(within(stop).getByText('−$440.00')).toBeTruthy();
    expect(within(stop).getByText('Change in Trade P&L from the Tue Oct 13 Marks if MNO is at 41.00 at expiration (−0.92R).')).toBeTruthy();
  });

  it('should show Wednesday\'s option-price Stop as "Breached" with "The Wed Oct 14 Mark is $20.00 (0.04R) of Trade P&L past this Stop."', () => {
    const stop = blocks(renderCard(os2(WEDNESDAY)))[1]!;
    expect(within(stop).getByText('Breached')).toBeTruthy();
    expect(within(stop).getByText('The Wed Oct 14 Mark is $20.00 (0.04R) of Trade P&L past this Stop.')).toBeTruthy();
  });

  it("should show an Unavailable condition's reason at the label length on row 1", () => {
    // MNO has no Mark on Tuesday, so the Underlying conditions are Unavailable while the option-price ones are measured.
    const items = blocks(renderCard(os2({ ...TUESDAY, underlyingMark: undefined })));
    const stop = items[0]!;
    expect(within(stop).getByText('Mark missing')).toBeTruthy();
    expect(within(stop).getByText('MNO at or below 41.00')).toBeTruthy();
    expect(stop.querySelector('.condition-why')).toBeNull();
    expect(within(items[1]!).getByText('−$360.00')).toBeTruthy();
  });

  it('should show only rows 1 and 2 before any Marks and on a Closed Detail', () => {
    // A Trade opened after the last close has no Marks: every condition is Unavailable until the session ends.
    const waiting = os2(TUESDAY);
    const beforeMarks: OpenTradeDetail = {
      ...waiting,
      current: {
        ...waiting.current,
        evaluation: { ...waiting.current.evaluation, conditions: waiting.current.evaluation.conditions.map((c) => ({ ...c, result: { kind: 'Unavailable' as const, reason: 'AwaitingClose' as const, after: '2026-10-12' } })) },
      },
    };
    const closed = optionClosedDetail('O-C', [OC_PC1, OC_PC2, OC_X1, OC_E1]);
    for (const view of [beforeMarks, closed]) {
      const items = blocks(renderCard(view));
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.querySelector('.condition-role')).not.toBeNull();
        expect(item.querySelector('.condition-text')).not.toBeNull();
        expect(item.querySelector('.condition-figure')).toBeNull();
        expect(item.querySelector('.condition-why')).toBeNull();
      }
      cleanup();
    }
  });

  it('should show any other Unavailable reason at the label length on row 1', () => {
    // Outside the market calendar there is no Expected Mark Date: every condition is Unavailable for a reason that is neither a missing Mark nor the wait for the first one.
    const base = os2(TUESDAY);
    const outside: OpenTradeDetail = {
      ...base,
      current: {
        ...base.current,
        evaluation: {
          ...base.current.evaluation,
          coverage: { kind: 'NotCovered' as const },
          conditions: base.current.evaluation.conditions.map((c) => ({ ...c, result: { kind: 'Unavailable' as const, reason: 'SessionPolicyNotCovered' as const, instrument: base.current.evaluation.observation.instrument, date: '2026-10-13' } })),
        },
      },
    };
    const items = blocks(renderCard(outside));
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(within(item).getByText('Outside calendar')).toBeTruthy();
      expect(item.querySelector('.condition-why')).toBeNull();
    }
  });

  it('should show Worst case and Max reward beneath the conditions', () => {
    // Thursday 10-15: MNO 44.60, the put 3.65. A Cash-Secured Put's worst case is MNO going to zero.
    const thursday = renderCard(os2({ tradingDate: '2026-10-15', closeInstant: '2026-10-15T20:00:00Z', contractMark: '3.65', underlyingMark: '44.60' }));
    const summary = within(thursday).getByRole('list', { name: 'Worst case and Max reward' });
    expect(within(summary).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Worst case: $8,270.00 · 17.23R if MNO goes to zero', 'Max reward: $730.00']);
    // The summary follows the conditions.
    expect(thursday.querySelector('.conditions-list')!.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    cleanup();

    // A long call's worst case is its premium, and its reward has no ceiling.
    const call = renderCard(optionOpenDetail('O-C', [OC_PC1, OC_PC2], { tradingDate: '2026-10-13', closeInstant: '2026-10-13T20:00:00Z', contractMark: '2.50', underlyingMark: '52.00' }));
    const lines = within(within(call).getByRole('list', { name: 'Worst case and Max reward' })).getAllByRole('listitem').map((item) => item.textContent);
    expect(lines[0]).toMatch(/^Worst case: \$[\d,.]+ · [\d.]+R if the call expires worthless$/);
    expect(lines[1]).toBe('Max reward: Unbounded above');
  });

  it('should say beneath the conditions when their distances arrive: before Marks, on a Planned Detail and once the contract expired, and show nothing beneath a Closed Detail', () => {
    const notes = (view: TradeDetailView) => {
      const summary = within(renderCard(view)).queryByRole('list', { name: 'Worst case and Max reward' });
      const lines = summary ? within(summary).queryAllByRole('listitem').map((item) => item.textContent) : [];
      cleanup();
      return lines;
    };
    const waiting = os2(TUESDAY);
    const beforeMarks: OpenTradeDetail = {
      ...waiting,
      current: {
        ...waiting.current,
        evaluation: { ...waiting.current.evaluation, conditions: waiting.current.evaluation.conditions.map((c) => ({ ...c, result: { kind: 'Unavailable' as const, reason: 'AwaitingClose' as const, after: '2026-10-12' } })) },
      },
    };
    expect(notes(beforeMarks)).toEqual(['Distances to each condition and the worst case arrive with the first Marks.']);
    expect(notes(optionPlannedDetail('O-S2'))).toEqual(['Distances to each condition arrive with the first Marks after entry.']);
    const expired = optionOpenDetail('O-S2', [OS2_S1], { tradingDate: '2026-12-18', closeInstant: '2026-12-18T21:00:00Z', contractMark: '0.10', underlyingMark: '43.20' });
    expect(notes(expired)).toEqual(['The contract expired, so its conditions are no longer measured.']);
    expect(notes(optionClosedDetail('O-C', [OC_PC1, OC_PC2, OC_X1, OC_E1]))).toEqual([]);

    // A Planned Detail lists its Plan's conditions, rows 1 and 2 only.
    const planned = blocks(renderCard(optionPlannedDetail('O-S2')));
    expect(planned.map((item) => item.querySelector('.condition-text')?.textContent)).toEqual(['MNO at or below 41.00', 'Option at or above $3.60', 'MNO at or above 44.50', 'Option at or below $0.30']);
    expect(planned.every((item) => item.querySelector('.condition-figure') === null && item.querySelector('.condition-why') === null)).toBe(true);
  });
});
