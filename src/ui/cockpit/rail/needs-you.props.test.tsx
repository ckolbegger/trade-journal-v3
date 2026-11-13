// @vitest-environment jsdom
// The Needs you card through the shell's path (D08P T8P.15): a Detail view, as the shell passes it, rendered by `NeedsYou`. Only an adapter test
// may build view data from `app/types` (A216), so the cases live here.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { optionOpenDetail, type OptionFrames } from '../../../../tests/support/option-detail-fixtures.ts';
import { OS_S1, OS2_S1 } from '../../../../tests/support/option-trade-fixtures.ts';
import type { OpenTradeDetail, TradeDetailDebt, TradeDetailView } from '../../../app/types.ts';
import { RuntimeContext } from '../../runtime.tsx';
import { termValue, useFixedClock } from '../../screens/trade-detail/test-support.ts';
import { NeedsYou } from './needs-you.tsx';

afterEach(cleanup);

const TIME_ZONE = 'America/New_York';
// O-S2's Marks (D7S section 4): MNO and the put at each close.
const TUESDAY: OptionFrames = { tradingDate: '2026-10-13', closeInstant: '2026-10-13T20:00:00Z', contractMark: '1.80', underlyingMark: '44.00' };
const WEDNESDAY: OptionFrames = { tradingDate: '2026-10-14', closeInstant: '2026-10-14T20:00:00Z', contractMark: '3.70', underlyingMark: '43.20' };

const os2 = (frames: OptionFrames): OpenTradeDetail => optionOpenDetail('O-S2', [OS2_S1], frames);

// The card as the shell renders it: inside the router and the runtime, with the shell's own props.
function renderCard(view: TradeDetailView, writable = true, extra: { onReflectNow?: (debtId: string) => void } = {}) {
  render(
    createElement(
      RuntimeContext.Provider,
      { value: { writable, report: () => undefined, timeZone: TIME_ZONE } },
      createElement(MemoryRouter, null, createElement(NeedsYou, { view, timeZone: TIME_ZONE, ...extra })),
    ),
  );
  return screen.queryByRole('region', { name: 'Needs you' });
}

describe('Needs you (W7)', () => {
  useFixedClock();

  it('should say "Nothing needs you now." when nothing is owed, due or crossed', () => {
    const card = renderCard(os2(TUESDAY));
    expect(card).not.toBeNull();
    expect(within(card!).getByRole('heading', { name: 'Needs you' })).toBeTruthy();
    expect(within(card!).getByText('Nothing needs you now.')).toBeTruthy();
  });

  it('should list each Outstanding Debt with its owed heading and due text, and Reflect now opening its form on its Journal card', async () => {
    const view: OpenTradeDetail = { ...os2(TUESDAY), journal: [owedDebt('debt-1', 'DueInNextReview'), owedDebt('debt-2', 'Due', 'Close Review')] };
    const onReflectNow = vi.fn();
    const card = renderCard(view, true, { onReflectNow })!;
    expect(within(card).queryByText('Nothing needs you now.')).toBeNull();
    const debts = within(card).getAllByRole('listitem');
    expect(debts.map((item) => [within(item).getByRole('heading', { level: 3 }).textContent, item.querySelector('p')?.textContent])).toEqual([
      ['Position Change Reflection Reflection owed', 'Due in the next Review'],
      ['Close Review Reflection owed', 'Due'],
    ]);
    // Reflect now hands the Debt to the shell, which selects the Journal drawer and opens the form on the Debt's card.
    await userEvent.click(within(debts[1]!).getByRole('button', { name: 'Reflect now' }));
    expect(onReflectNow).toHaveBeenCalledExactlyOnceWith('debt-2');
    cleanup();

    // Read only, a Debt is listed and nothing resolves it.
    const readOnly = renderCard(view, false, { onReflectNow })!;
    expect(within(readOnly).getAllByRole('listitem')).toHaveLength(2);
    expect(document.querySelector('button')).toBeNull();
  });

  it("should alert \"Stop breached: the option's Mark is $3.70, at or above $3.60\" on O-S2's Wednesday", () => {
    const card = renderCard(os2(WEDNESDAY))!;
    expect(within(card).getAllByRole('alert').map((alert) => alert.textContent)).toEqual(["Stop breached: the option's Mark is $3.70, at or above $3.60"]);
    expect(within(card).queryByText('Nothing needs you now.')).toBeNull();
  });

  it('should say "First Marks are due once the Mon Oct 12 session ends." before any Marks', () => {
    // A Trade opened after the last close: every condition waits for the close, and Trade Views states the date it arrives (revision 90).
    const waiting = os2(TUESDAY);
    const awaiting = waiting.current.evaluation.conditions.map((c) => ({ ...c, result: { kind: 'Unavailable' as const, reason: 'AwaitingClose' as const, after: '2026-10-12' } }));
    const beforeMarks = (firstMarksDue?: string): OpenTradeDetail => ({
      ...waiting,
      current: { ...waiting.current, evaluation: { ...waiting.current.evaluation, conditions: awaiting }, ...(firstMarksDue && { firstMarksDue }) },
    });
    const card = renderCard(beforeMarks('2026-10-12'))!;
    expect(within(card).getByText('First Marks are due once the Mon Oct 12 session ends.')).toBeTruthy();
    expect(within(card).queryByText('Nothing needs you now.')).toBeNull();
    cleanup();

    // Without the field nothing is inferred from the waiting figures.
    const without = renderCard(beforeMarks())!;
    expect(within(without).getByText('Nothing needs you now.')).toBeTruthy();
    expect(within(without).queryByText(/First Marks/)).toBeNull();
  });

  it('should link a Mark missing at the Expected Mark Date to the Review', () => {
    // Tuesday's Mark for the put was never saved: the Expected Mark Date has passed without it.
    const card = renderCard(os2({ ...TUESDAY, contractMark: undefined }))!;
    const link = within(card).getByRole('link', { name: /^Mark missing for MNO .* on Tue Oct 13$/ });
    expect(link.getAttribute('href')).toBe('/review?trade=trade-1&instrument=MNO');
    expect(within(card).queryByText('Nothing needs you now.')).toBeNull();
    cleanup();

    // A Mark that is there is no link.
    const marked = renderCard(os2(TUESDAY))!;
    expect(within(marked).queryByRole('link', { hidden: true })).toBeNull();
  });

  it('should hold the Settlement Due panel, with Record expiration only while Writable', () => {
    // Friday 2026-11-20 after the close: the expiration date, whose contracts are due for settlement.
    const friday: OptionFrames = { tradingDate: '2026-11-20', closeInstant: '2026-11-20T21:00:00Z', contractMark: '0.80', underlyingMark: '52.00' };
    const view = optionOpenDetail('O-S', [OS_S1], friday);
    const card = renderCard(view, true)!;
    const panel = within(card).getByRole('region', { name: 'Settlement Due' });
    expect(termValue(panel, 'Contract')).toBe('MNO 20 Nov 2026 45 Put');
    expect(termValue(panel, 'Quantity')).toBe('Short 2 contracts');
    expect(termValue(panel, 'Expired')).toBe('Fri Nov 20');
    expect(termValue(panel, 'Settlement time')).toBe('Fri Nov 20, 16:00');
    expect(within(panel).getByText("If it was assigned, this release can't record the assignment yet, so this Trade stays open until a later release can.")).toBeTruthy();
    expect(within(panel).getByRole('link', { name: 'Record expiration' }).getAttribute('href')).toBe('/trades/trade-1/record-expiration');
    expect(within(card).queryByText('Nothing needs you now.')).toBeNull();
    cleanup();

    // Read only, the panel stays and the link is gone from the page.
    const readOnly = renderCard(view, false)!;
    expect(within(readOnly).getByRole('region', { name: 'Settlement Due' })).toBeTruthy();
    expect(document.querySelector('a')).toBeNull();
    cleanup();

    // A date outside the market calendar has no settlement time to record at, so no Record expiration.
    const settlementTime = { kind: 'Unavailable', reason: 'SessionPolicyNotCovered', instrument: view.settlement[0]!.instrument, date: '2026-11-20' } as const;
    const outside = renderCard({ ...view, settlement: view.settlement.map((item) => ({ ...item, settlementTime })) }, true)!;
    expect(termValue(within(outside).getByRole('region', { name: 'Settlement Due' }), 'Settlement time')).toBe('Outside the market calendar: Fri Nov 20');
    expect(document.querySelector('a')).toBeNull();
  });
});

const owedDebt = (id: string, dueStatus: TradeDetailDebt['dueStatus'], entryType = 'Position Change Reflection'): TradeDetailDebt => ({
  kind: 'Debt',
  id,
  entryType,
  entryTypeKey: 'entry-type.position-change-reflection',
  source: 'Position Change',
  anchor: { kind: 'Trade', tradeId: 'trade-1' },
  momentTime: '2026-10-12T16:00:00Z',
  positionChangeId: 'pc-1',
  definitionId: 'def-pcr-1',
  dueAnchor: '2026-10-12T20:00:00Z',
  revision: `${id}-rev-1`,
  ...(dueStatus && { dueStatus }),
});
