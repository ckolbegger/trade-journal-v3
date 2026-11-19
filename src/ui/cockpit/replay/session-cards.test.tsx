// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { replayProps } from './replay.props.ts';
import { SessionCards } from './session-cards.tsx';
import { AXIO, BREN, BREN_STOCK, brenMon1102, brenWed1111, frac, fullView, markOf, Plot, PLAN, session, usd, value, view, withMarks } from './view-doubles.props.ts';

afterEach(cleanup);

// The cards as the app draws them: the adapter's cards for the sessions, newest first, with the frame's `id` and `isCurrent`.
function show(props: ReturnType<typeof replayProps>) {
  const cards = props.sessions.map((s) => ({ ...s.card, id: s.date, isCurrent: false })).reverse();
  render(<SessionCards {...props.cardsWords} id="cards" cards={cards} onSelectSession={() => undefined} />);
}
const text = (el: Element) => el.textContent ?? '';
const cardOf = (heading: string) => screen.getByRole('button', { name: heading, hidden: true }).closest('article')!;
const rowOf = (card: HTMLElement, label: string) => within(card).getByText(label).closest('div')!;

describe('Replay: session cards (decision 5)', () => {
  it('should read a session without a Mark as a dash in the cells that need it, never a carried value, and a Trade past its Stop as Past the Stop by 300.00 and 0.50R, never 0.00', () => {
    // R-BREN-U Tue 11-10 has no Mark for the call: the results at the Stop and Target read no Mark, so they stand.
    const none = withMarks(session({ date: '2026-11-10', pnl: null, outcomes: { atStop: value(usd(-324)), atTarget: value(usd(956)) } }), [markOf(BREN_STOCK, '100.20'), markOf(BREN)]);
    show(replayProps(fullView([none], PLAN), { Plot }));
    const gap = cardOf('Tue Nov 10');
    expect(text(rowOf(gap, 'BREN Mark'))).toBe('BREN Mark$100.20');
    for (const label of ['Call Mark', 'Trade P&L']) expect(within(rowOf(gap, label)).getByRole('img', { name: 'No Mark', hidden: true }).textContent).toBe('—');
    expect(text(rowOf(gap, 'At Stop'))).toBe('At Stop— · — · P&L if hit −$324.00');
    expect(within(rowOf(gap, 'At Stop')).getAllByRole('img', { name: 'No Mark', hidden: true })).toHaveLength(2);
    expect(text(gap)).not.toContain('No Mark for');
    cleanup();

    // R-AXIO-D Mon 11-16: past the Stop by $300.00, so the card says so in one row, and holds no "$0.00" at risk.
    const past = session({
      date: '2026-11-16',
      instrument: AXIO,
      held: 100,
      pnl: -1040,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(300), r: frac(1, 2), crossed: true } }),
      figures: { ongoingRiskToStop: value(usd(0)), ongoingRiskToStopInPlanR: value(frac(0, 1)), worstCaseOngoingRisk: value(usd(4520)), worstCaseOngoingRiskInPlanR: value(frac(4520, 600)), incrementalRewardToTarget: value(usd(1080)), incrementalRewardToTargetInPlanR: value(frac(1080, 600)) },
      outcomes: { atStop: value(usd(-740)), atTarget: value(usd(160)), atWorstCase: value(usd(-4520)) },
    });
    show(replayProps({ ...view([past]), instruments: [AXIO] }, { Plot }));
    const card = cardOf('Mon Nov 16');
    expect(text(card)).toContain('Past the Stop by $300.00 (0.50R) · at Stop −$740.00');
    expect(within(card).queryByText('At Stop')).toBeNull();
    expect(text(card)).not.toContain('$0.00');
  });
});

describe('Replay: session cards, paging (A277)', () => {
  afterEach(() => vi.restoreAllMocks());
  const days = ['Mon Nov 2', 'Tue Nov 3', 'Wed Nov 4', 'Thu Nov 5', 'Fri Nov 6'];
  // Newest first, as the frame passes them.
  const cards = [...days].reverse().map((heading, at) => ({ id: `2026-11-0${6 - at}`, heading, isCurrent: at === 0, rows: [], events: [] }));
  const draw = () => render(<SessionCards title="Session by session" newerLabel="Newer sessions" earlierLabel="Earlier sessions" id="cards" cards={cards} onSelectSession={() => undefined} />);
  const shown = () => screen.getAllByRole('article').map((card) => text(within(card).getByRole('heading')));
  const button = (name: string) => screen.getByRole('button', { name });

  it('should page with Newer sessions and Earlier sessions, a page being the cards that fit side by side, handing focus on at either end', async () => {
    // 700px holds two cards side by side.
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(700);
    draw();
    const user = userEvent.setup();
    expect(shown()).toEqual(['Fri Nov 6', 'Thu Nov 5']);
    expect(button('Newer sessions').hasAttribute('disabled')).toBe(true);
    await user.click(button('Earlier sessions'));
    expect(shown()).toEqual(['Wed Nov 4', 'Tue Nov 3']);
    expect(document.activeElement).toBe(button('Earlier sessions'));
    // The last page holds the one card left, and the pressed button, now disabled, hands focus to the other.
    await user.click(button('Earlier sessions'));
    expect(shown()).toEqual(['Mon Nov 2']);
    expect(button('Earlier sessions').hasAttribute('disabled')).toBe(true);
    expect(document.activeElement).toBe(button('Newer sessions'));
    await user.click(button('Newer sessions'));
    await user.click(button('Newer sessions'));
    expect(shown()).toEqual(['Fri Nov 6', 'Thu Nov 5']);
    expect(document.activeElement).toBe(button('Earlier sessions'));
    cleanup();
    // A box too narrow for two, or with no layout at all, still holds one.
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(100);
    draw();
    expect(shown()).toEqual(['Fri Nov 6']);
  });

  it('should hand focus to an enabled paging button when a resize repaginates the cards and hides the card heading or disables the button that held focus', async () => {
    let width = 700;
    let notify = () => undefined as void;
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(() => width);
    vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { notify = cb; } observe() {} unobserve() {} disconnect() {} });
    draw();
    const user = userEvent.setup();
    // The last page of two per page holds Mon Nov 2 alone; its heading holds focus.
    await user.click(button('Earlier sessions'));
    await user.click(button('Earlier sessions'));
    await user.click(screen.getByRole('button', { name: 'Mon Nov 2' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mon Nov 2' }));
    // Narrowed to one per page the cards stay on page 3 of 5, so Mon Nov 2 is hidden.
    width = 100;
    act(() => notify());
    expect(shown()).toEqual(['Wed Nov 4']);
    expect(document.activeElement).toBe(button('Newer sessions'));
    expect((document.activeElement as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('Replay: session cards, the rest of a card (A277, A267)', () => {
  it('should list the events of a session under Events, and none for a session without any', () => {
    const sale = { id: 'x2', kind: 'Execution', effect: 'Reduced', fills: [{ instrument: BREN, action: 'Sell', quantity: usd(2), price: usd(4) }] } as const;
    show(replayProps(fullView([{ ...brenWed1111, markers: [sale] }, brenMon1102], PLAN), { Plot }));
    expect(text(rowOf(cardOf('Wed Nov 11'), 'Events'))).toBe('EventsSold 2 at $4.00');
    expect(within(cardOf('Mon Nov 2')).queryByText('Events')).toBeNull();
  });

  it('should let a screen reader hear the odds in the Reward to risk row in full, as the readout does', () => {
    show(replayProps(fullView([brenWed1111], PLAN), { Plot }));
    const odds = within(rowOf(cardOf('Wed Nov 11'), 'Reward to risk')).getByRole('img', { hidden: true });
    expect(odds.getAttribute('aria-label')).toBe('about 28% chance of the Target first, 72% of the Stop first');
    expect(text(rowOf(cardOf('Wed Nov 11'), 'Reward to risk'))).toBe('Reward to risk2.64 to 1 · about 28% : 72%');
  });
});

describe("Session cards: carried from D9's Stage A gate (critic-2, section 1.8)", () => {
  it('should show a session past a line on its card as the one row, Past the Stop by 180.00 and 0.30R then at Stop -740.00, R-AXIO-D Mon 11-09, never 0.00 at risk, defect 1a', () => {
    const monday = session({
      date: '2026-11-09',
      instrument: AXIO,
      held: 100,
      pnl: -920,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(180), r: frac(3, 10), crossed: true } }),
      figures: { ongoingRiskToStop: value(usd(0)), ongoingRiskToStopInPlanR: value(frac(0, 1)), worstCaseOngoingRisk: value(usd(5440)), worstCaseOngoingRiskInPlanR: value(frac(5440, 600)), incrementalRewardToTarget: value(usd(1080)), incrementalRewardToTargetInPlanR: value(frac(1080, 600)) },
      outcomes: { atStop: value(usd(-740)), atTarget: value(usd(160)), atWorstCase: value(usd(-5440)) },
    });
    show(replayProps({ ...view([monday]), instruments: [AXIO] }, { Plot }));
    const card = cardOf('Mon Nov 9');
    expect(within(card).getByText('Past the Stop by $180.00 (0.30R) · at Stop −$740.00')).toBeTruthy();
    // The risk to the Stop, which is zero once past it, has no row and no figure on the card.
    expect(within(card).queryByText('At Stop')).toBeNull();
    expect(text(card)).not.toContain('$0.00');
  });
});
