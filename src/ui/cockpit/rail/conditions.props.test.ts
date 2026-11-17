// @vitest-environment jsdom
// The Conditions card through the shell's path (D08P T8P.14): a Detail view, as the shell passes it, rendered by `ConditionsCard`. Only an adapter
// test may build view data from `app/types` (A216), so the cases live here.
import { cleanup, render, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { incoherentDetailOf, openDetailAt, PC1, PC2 } from '../../../../tests/support/open-detail-fixtures.ts';
import { available, tuesday } from '../../screens/trade-detail/test-support.ts';
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

  it('should show an option-price Stop as "Stop · $1.80 away" and an Underlying Target as "Target · 0.50 away"', () => {
    // Tuesday 10-13: the put is $1.80 against its $3.60 Stop (it must rise $1.80), and MNO is 44.00 against its 44.50 Target (W21, A230).
    const heads = blocks(renderCard(os2(TUESDAY))).map((item) => item.querySelector('.condition-head')?.textContent);
    expect(heads).toEqual(['Stop · 3.00 away', 'Stop · $1.80 away', 'Target · 0.50 away', 'Target · $1.50 away']);
  });

  it('should show Wednesday\'s option-price Stop as "Breached · $0.10 past" and Thursday\'s Underlying Target as "Reached · 0.10 past"', () => {
    const stop = blocks(renderCard(os2(WEDNESDAY)))[1]!;
    expect(stop.querySelector('.condition-head')?.textContent).toBe('Stop · Breached · $0.10 past');
    cleanup();
    // Thursday 10-15: MNO is 44.60, 0.10 beyond its 44.50 Target.
    const target = blocks(renderCard(os2({ tradingDate: '2026-10-15', closeInstant: '2026-10-15T20:00:00Z', contractMark: '3.65', underlyingMark: '44.60' })))[2]!;
    expect(target.querySelector('.condition-head')?.textContent).toBe('Target · Reached · 0.10 past');
  });

  it('should show a dated distance "· Mon Oct 12 Marks" when today\'s Mark is missing, and the reason when the dated Mark is missing too', () => {
    // Tuesday's MNO Mark is missing (the Underlying conditions are Unavailable); Monday's Marks measured them.
    const missing = os2({ ...TUESDAY, underlyingMark: undefined });
    const monday = os2({ tradingDate: '2026-10-12', closeInstant: '2026-10-12T20:00:00Z', contractMark: '1.90', underlyingMark: '43.50' });
    const withDated = (dated: OpenTradeDetail): OpenTradeDetail => ({ ...missing, current: { ...missing.current, datedLine: { tradingDate: '2026-10-12', evaluation: dated.current.evaluation } } });
    const heads = (view: OpenTradeDetail) => blocks(renderCard(view)).map((item) => item.querySelector('.condition-head')?.textContent);
    // One date per row; the option-price rows are today's own.
    expect(heads(withDated(monday))).toEqual(['Stop · 2.50 away · Mon Oct 12 Marks', 'Stop · $1.80 away', 'Target · 1.00 away · Mon Oct 12 Marks', 'Target · $1.50 away']);
    cleanup();
    // The dated Marks had no Underlying Mark either: the reason stays (A231).
    const bothMissing = os2({ tradingDate: '2026-10-12', closeInstant: '2026-10-12T20:00:00Z', contractMark: '1.90', underlyingMark: undefined });
    expect(heads(withDated(bothMissing))).toEqual(['Stop · Mark missing', 'Stop · $1.80 away', 'Target · Mark missing', 'Target · $1.50 away']);
    cleanup();
    // A stock Trade's dated distance says "Mark".
    const stock = openDetailAt([PC1, PC2], tuesday({ kind: 'Missing' }));
    const stockDated: OpenTradeDetail = { ...stock, current: { ...stock.current, datedLine: { tradingDate: '2026-10-12', evaluation: openDetailAt([PC1, PC2], tuesday(available('52.00'))).current.evaluation } } };
    expect(heads(stockDated)[0]).toMatch(/^Stop · \$[\d,.]+ away · Mon Oct 12 Mark$/);
  });

  it('should show an Underlying row from the current Underlying Mark, undated, when only the contracts Mark is missing, and keep the option-price rows dated', () => {
    // Tuesday's MNO Mark is in, the put's is missing; Monday's Marks measured everything.
    const missing = os2({ ...TUESDAY, contractMark: undefined });
    const monday = os2({ tradingDate: '2026-10-12', closeInstant: '2026-10-12T20:00:00Z', contractMark: '1.90', underlyingMark: '43.50' });
    const view: OpenTradeDetail = { ...missing, current: { ...missing.current, datedLine: { tradingDate: '2026-10-12', evaluation: monday.current.evaluation } } };
    const heads = blocks(renderCard(view)).map((item) => item.querySelector('.condition-head')?.textContent);
    // MNO 44.00 today: the Underlying rows carry no date; the option-price rows (the put's own Mark) still say Monday's.
    expect(heads[0]).toBe('Stop · 3.00 away');
    expect(heads[1]).toMatch(/^Stop · \$[\d,.]+ away · Mon Oct 12 Marks$/);
    expect(heads[2]).toBe('Target · 0.50 away');
    expect(heads[3]).toMatch(/^Target · \$[\d,.]+ away · Mon Oct 12 Marks$/);
  });

  it("should show an Unavailable condition's reason at the label length on row 1", () => {
    // MNO has no Mark on Tuesday, so the Underlying conditions are Unavailable while the option-price ones are measured.
    const items = blocks(renderCard(os2({ ...TUESDAY, underlyingMark: undefined })));
    const stop = items[0]!;
    expect(within(stop).getByText('Mark missing')).toBeTruthy();
    expect(within(stop).getByText('MNO at or below 41.00')).toBeTruthy();
    expect(stop.querySelector('.condition-why')).toBeNull();
    expect(within(items[1]!).getByText('$1.80 away')).toBeTruthy();
  });

  it('should show only rows 1 and 2 before any Marks and on a Closed Detail', () => {
    // A Trade opened after the last close has no Marks: every condition is Unavailable until the session ends.
    const waiting = os2(TUESDAY);
    const beforeMarks: OpenTradeDetail = {
      ...waiting,
      current: {
        ...waiting.current,
        firstMarksDue: '2026-10-12',
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

  it('should not show nearest, a Change in Trade P&L sentence, Worst case or Max reward', () => {
    // Thursday 10-15: two conditions crossed or close, a Worst case and a Max reward the rail used to give. Hidden elements count, so the check holds
    // in a collapsed panel too.
    const thursday = { tradingDate: '2026-10-15', closeInstant: '2026-10-15T20:00:00Z', contractMark: '3.65', underlyingMark: '44.60' };
    const views: TradeDetailView[] = [os2(TUESDAY), os2(thursday), openDetailAt([PC1, PC2], tuesday(available('52.00'))), optionOpenDetail('O-C', [OC_PC1, OC_PC2], { tradingDate: '2026-10-13', closeInstant: '2026-10-13T20:00:00Z', contractMark: '2.50', underlyingMark: '52.00' })];
    for (const view of views) {
      const container = renderCard(view);
      expect(blocks(container).length).toBeGreaterThan(0);
      expect(container.querySelector('.condition-nearest, .condition-why, .conditions-summary, .summary-label')).toBeNull();
      expect(within(container).queryAllByText(/nearest|Change in Trade P&L|Worst case|Max reward/, { ignore: 'none' })).toEqual([]);
      cleanup();
    }
  });

  it('should say beneath the conditions when their distances arrive: before Marks, on a Planned Detail and once the contract expired, and show nothing beneath a Closed Detail', () => {
    const notes = (view: TradeDetailView) => {
      const summary = within(renderCard(view)).queryByRole('list', { name: 'Conditions notes', hidden: true });
      const lines = summary ? within(summary).queryAllByRole('listitem', { hidden: true }).map((item) => item.textContent) : [];
      cleanup();
      return lines;
    };
    const waiting = os2(TUESDAY);
    const beforeMarks: OpenTradeDetail = {
      ...waiting,
      current: {
        ...waiting.current,
        firstMarksDue: '2026-10-12',
        evaluation: { ...waiting.current.evaluation, conditions: waiting.current.evaluation.conditions.map((c) => ({ ...c, result: { kind: 'Unavailable' as const, reason: 'AwaitingClose' as const, after: '2026-10-12' } })) },
      },
    };
    expect(notes(beforeMarks)).toEqual(['Distances to each condition arrive with the first Marks.']);
    expect(notes(optionPlannedDetail('O-S2'))).toEqual(['Distances to each condition arrive with the first Marks after entry.']);
    const expired = optionOpenDetail('O-S2', [OS2_S1], { tradingDate: '2026-12-18', closeInstant: '2026-12-18T21:00:00Z', contractMark: '0.10', underlyingMark: '43.20' });
    expect(notes(expired)).toEqual(['The contract expired, so its conditions are no longer measured.']);
    expect(notes(optionClosedDetail('O-C', [OC_PC1, OC_PC2, OC_X1, OC_E1]))).toEqual([]);

    // A Planned Detail lists its Plan's conditions, rows 1 and 2 only.
    const planned = blocks(renderCard(optionPlannedDetail('O-S2')));
    expect(planned.map((item) => item.querySelector('.condition-text')?.textContent)).toEqual(['MNO at or below 41.00', 'Option at or above $3.60', 'MNO at or above 44.50', 'Option at or below $0.30']);
    expect(planned.every((item) => item.querySelector('.condition-figure') === null && item.querySelector('.condition-why') === null)).toBe(true);
  });

  it('should name the list of notes beneath the conditions Conditions notes', () => {
    const view = optionPlannedDetail('O-S2');
    const list = within(renderCard(view)).getByRole('list', { name: 'Conditions notes', hidden: true });
    expect(within(list).getByText('Distances to each condition arrive with the first Marks after entry.')).toBeTruthy();
    cleanup();
    expect(within(renderCard(view)).queryByRole('list', { name: 'Worst case and Max reward', hidden: true })).toBeNull();
  });

  it('should list the Plan conditions on an incoherent Detail, rows 1 and 2 only, with no figure, no row 3 and no summary', () => {
    const finding = { factId: 'ex-1', kind: 'Execution' as const, instrument: { kind: 'Stock' as const, symbol: 'XYZ' }, economicTime: '2026-10-12T14:00:00Z', side: 'Buy' as const, quantity: '60', reason: 'UnknownPlannedLeg' as const };
    const view = incoherentDetailOf([PC1], [finding]);
    const container = renderCard(view);
    const items = blocks(container);
    expect(items.map((item) => [item.querySelector('.condition-role')?.textContent, item.querySelector('.condition-text')?.textContent])).toEqual([
      ['Stop', 'XYZ at or below $47.50'],
      ['Target', 'XYZ at or above $56.00'],
    ]);
    expect(container.querySelector('.condition-figure, .condition-why, .conditions-summary, .condition-nearest')).toBeNull();
  });
});

describe('Conditions card: first Marks pending (revision 90)', () => {
  it('should show the reason on row 1, not the first-Marks note, when shares were added after an earlier Mark', () => {
    // Shares bought after an earlier session's Marks: every condition waits for the next close, but Trade Views states no `firstMarksDue`,
    // because an earlier Mark has valued the Trade.
    const base = os2(TUESDAY);
    const awaiting = base.current.evaluation.conditions.map((c) => ({ ...c, result: { kind: 'Unavailable' as const, reason: 'AwaitingClose' as const, after: '2026-10-13' } }));
    const view: OpenTradeDetail = { ...base, current: { ...base.current, evaluation: { ...base.current.evaluation, conditions: awaiting } } };
    expect(view.current).not.toHaveProperty('firstMarksDue');
    const container = renderCard(view);
    const items = blocks(container);
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item.querySelector('.condition-figure')?.textContent).toBe('Awaiting close');
    }
    expect(container.querySelector('.conditions-summary')).toBeNull();
    expect(container.textContent).not.toContain('arrive with the first Marks');
  });
});
