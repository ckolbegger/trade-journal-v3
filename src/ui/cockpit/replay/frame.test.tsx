// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReplayFrame } from './frame.tsx';
import type { PlotSession, ReplayFrameSession, ReplayPlotProps, ReplayProps } from './replay.types.ts';

afterEach(cleanup);

// BREN's eleven sessions, Mon Nov 2 to Mon Nov 16, as the adapter would finish them: the frame selects, it works out nothing.
const DAYS = ['Mon Nov 2', 'Tue Nov 3', 'Wed Nov 4', 'Thu Nov 5', 'Fri Nov 6', 'Mon Nov 9', 'Tue Nov 10', 'Wed Nov 11', 'Thu Nov 12', 'Fri Nov 13', 'Mon Nov 16'];
const DATES = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16'];
const FIGURES = ['-$40.00 · -0.06R', '-$120.00 · -0.18R', '+$60.00 · 0.09R', '+$150.00 · 0.22R', '+$210.00 · 0.31R', '+$340.00 · 0.50R', '+$520.00 · 0.77R', '+$688.00 · 1.02R', '+$790.00 · 1.17R', '+$838.00 · 1.25R', '+$988.00 · 3.05R'];
const TONES = [-1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

function plotSession(slot: number): PlotSession {
  return { slot, dateLabel: DAYS[slot] ?? `Day ${slot}`, underlyingMark: 100 + slot, tradePnl: slot * 10, banked: 0, resultAtStop: null, resultAtTarget: null, worstCase: null, maxReward: null, markers: [] };
}

function frameSession(index: number): ReplayFrameSession {
  const loss = TONES[index] === -1;
  return {
    date: DATES[index] ?? `2026-11-${20 + index}`,
    sliderValue: `${DAYS[index]} · ${index + 1} of 15`,
    dateLabel: DAYS[index] ?? `Day ${index}`,
    headline: { figure: FIGURES[index] ?? '+$1.00 · 0.01R', tone: loss ? 'Loss' : 'Profit' },
    howItIsGoing: loss ? 'Behind: 12% of the way to the Stop.' : `Ahead: ${index * 8}% of the way to the Target.`,
    stake: null,
    isFinal: false,
    readout: [],
    card: { heading: DAYS[index] ?? `Day ${index}`, rows: [{ label: 'BREN Mark', value: { kind: 'Figure', text: `$${100 + index}.00` } }, { label: 'Trade P&L', value: { kind: 'Figure', text: FIGURES[index] ?? '' } }], events: [] },
    plot: plotSession(index),
    hover: [],
    hasMarker: false,
  };
}

// The plot double lists what it is given, so a test can see what the frame passes it.
// Each session is a button that hovers, focuses and selects the way the real plot's hit areas do; one more, past the
// revealed sessions, stands for a pointer reaching a session the frame has not revealed.
const PlotDouble: ComponentType<ReplayPlotProps> = ({ sessions, sliderIndex, describedBy, onHoverSession, onSelectSession }) => (
  <div data-testid="plot" data-slider={sliderIndex} aria-describedby={describedBy}>
    {sessions.map((s, i) => (
      <button key={s.slot} type="button" data-testid="point" data-mark={s.underlyingMark ?? ''} onMouseEnter={() => onHoverSession?.(i)} onFocus={() => onHoverSession?.(i)} onMouseLeave={() => onHoverSession?.(null)} onBlur={() => onHoverSession?.(null)} onClick={() => onSelectSession?.(i)}>
        {s.dateLabel}
      </button>
    ))}
    <button type="button" aria-label="Later session" onMouseEnter={() => onHoverSession?.(sessions.length)} onClick={() => onSelectSession?.(sessions.length)} />
  </div>
);

function props(over: Partial<ReplayProps> = {}, count = 11): ReplayProps {
  return {
    tradeKey: 'trade-bren',
    sessions: Array.from({ length: count }, (_, i) => frameSession(i)),
    sliderLabel: 'Session',
    previousLabel: 'Previous session',
    nextLabel: 'Next session',
    cardsWords: { title: 'Session by session', newerLabel: 'Newer sessions', earlierLabel: 'Earlier sessions' },
    plotBase: { priceTitle: 'BREN price', pnlTitle: 'Trade P&L', accessibleName: 'BREN Marks and Trade P&L by session', describedBy: 'replay-cards', anchors: { priceLines: [], planAtStop: null, planAtTarget: null }, axis: { slots: 15, endLabels: ['Fri Nov 20'] } },
    Plot: PlotDouble,
    ...over,
  };
}

const slider = () => screen.getByRole('slider', { name: 'Session' });
const value = () => (slider() as HTMLInputElement).value;
const text = (el: Element) => el.textContent ?? '';
const attr = (el: Element, name: string) => el.getAttribute(name);

describe('Replay: the top (suggestion 14)', () => {
  it('should show the session date beside the headline figure: Mon Nov 16, then +$988.00 · 3.05R', () => {
    render(<ReplayFrame {...props()} />);
    const date = screen.getByTestId('session-date');
    expect(text(date)).toBe('Mon Nov 16');
    // The date comes first, in the same row as the headline.
    const headline = screen.getByTestId('headline');
    expect(date.parentElement).toBe(headline.parentElement);
    expect(date.compareDocumentPosition(headline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(text(headline)).toBe('+$988.00 · 3.05R');
  });
});

describe('Replay: a session with no Mark (suggestion 12)', () => {
  const noMark = (over: Partial<ReplayFrameSession> = {}): ReplayProps => {
    const base = props();
    const sessions = base.sessions.map((s, i) => (i === 10 ? { ...s, headline: { reason: 'No Mark for the put on Tue Nov 10.', tone: 'None' as const }, howItIsGoing: '', ...over } : s));
    return { ...base, sessions };
  };

  it('should say No Mark for the put on Tue Nov 10 once, at normal size, where the headline figure would be', () => {
    const { container } = render(<ReplayFrame {...noMark()} />);
    const headline = screen.getByTestId('headline');
    expect(text(headline)).toBe('No Mark for the put on Tue Nov 10.');
    // Normal size: the reason is not the figure's large, unbreakable span.
    expect(headline.classList.contains('replay-reason')).toBe(true);
    expect(headline.querySelector('.replay-figure')).toBeNull();
    // Once: nothing else on the page repeats it, and no empty sentence is left under it.
    expect(text(container).split('No Mark for the put').length).toBe(2);
    expect(container.querySelector('.replay-going')).toBeNull();
    expect(screen.getByTestId('session-date').nextElementSibling).toBe(headline);
  });

  it('should offer Add the Mark after the headline as a link to the Review row, and no link when the session has none', () => {
    const to = '/review?trade=T-1&instrument=BREN';
    const { unmount } = render(<MemoryRouter><ReplayFrame {...noMark({ addMarkTo: to })} /></MemoryRouter>);
    const link = screen.getByRole('link', { name: 'Add the Mark' });
    expect(attr(link, 'href')).toBe(to);
    expect(screen.getByTestId('headline').compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(link.parentElement).toBe(screen.getByTestId('headline').parentElement);
    unmount();
    render(<MemoryRouter><ReplayFrame {...noMark()} /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: 'Add the Mark' })).toBeNull();
  });
});

describe('Replay frame: the slider (W42)', () => {
  it('should open resting on the last session, with its headline', () => {
    render(<ReplayFrame {...props()} />);
    expect(value()).toBe('10');
    expect(text(screen.getByTestId('headline'))).toContain('+$988.00 · 3.05R');
  });

  it('should show an earlier session\'s headline when the slider moves to it', async () => {
    const user = userEvent.setup();
    render(<ReplayFrame {...props()} />);
    await user.click(screen.getByRole('button', { name: 'Previous session' }));
    expect(text(screen.getByTestId('headline'))).toContain('+$838.00 · 1.25R');
    expect(screen.queryByText('Ahead: 72% of the way to the Target.')).not.toBeNull();
  });

  it('should keep every later session out of the DOM: no figure, date or point of a session after the slider\'s', async () => {
    const user = userEvent.setup();
    const { container } = render(<ReplayFrame {...props({ initialSession: '2026-11-04' })} />);
    expect(screen.getAllByTestId('point').map((p) => p.textContent)).toEqual(['Mon Nov 2', 'Tue Nov 3', 'Wed Nov 4']);
    expect(attr(screen.getByTestId('plot'), 'data-slider')).toBe('2');
    for (const later of ['Thu Nov 5', 'Mon Nov 16', '+$150.00', '+$988.00', '4 of 15', '11 of 15']) expect(text(container)).not.toContain(later);
    await user.click(screen.getByRole('button', { name: 'Previous session' }));
    expect(screen.getAllByTestId('point')).toHaveLength(2);
    expect(text(container)).not.toContain('Wed Nov 4');
    expect(text(container)).not.toContain('+$60.00');
  });

  it('should move one session with the Left and Right keys and to either end with Home and End', async () => {
    const user = userEvent.setup();
    render(<ReplayFrame {...props()} />);
    slider().focus();
    await user.keyboard('{ArrowLeft}');
    expect(value()).toBe('9');
    await user.keyboard('{ArrowRight}');
    expect(value()).toBe('10');
    await user.keyboard('{Home}');
    expect(value()).toBe('0');
    expect(text(screen.getByTestId('headline'))).toContain('-$40.00 · -0.06R');
    await user.keyboard('{End}');
    expect(value()).toBe('10');
  });

  it('should name the slider "Session" and speak "Mon Nov 16 · 11 of 15", then the headline, as its value', () => {
    render(<ReplayFrame {...props()} />);
    expect(attr(slider(), 'aria-valuetext')).toBe('Mon Nov 16 · 11 of 15. +$988.00 · 3.05R');
  });

  it('should start from a given session when one is passed in', () => {
    render(<ReplayFrame {...props({ initialSession: '2026-11-12' })} />);
    expect(value()).toBe('8');
    expect(attr(slider(), 'aria-valuetext')).toBe('Thu Nov 12 · 9 of 15. +$790.00 · 1.17R');
  });

  it('should keep the slider\'s session when the same Trade\'s replay is passed in again with one more session', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ReplayFrame {...props({}, 11)} />);
    await user.click(screen.getByRole('button', { name: 'Previous session' }));
    rerender(<ReplayFrame {...props({}, 12)} />);
    expect(value()).toBe('9');
    expect(attr(slider(), 'max')).toBe('11');
    rerender(<ReplayFrame {...props({ tradeKey: 'trade-other' }, 12)} />);
    expect(value()).toBe('11');
  });

  it('should follow a new last session when the slider has not been moved, and keep a moved slider\'s session', async () => {
    const user = userEvent.setup();
    const untouched = render(<ReplayFrame {...props({}, 11)} />);
    untouched.rerender(<ReplayFrame {...props({}, 12)} />);
    expect(value()).toBe('11');
    expect(attr(slider(), 'max')).toBe('11');
    untouched.unmount();
    const moved = render(<ReplayFrame {...props({}, 11)} />);
    await user.click(screen.getByRole('button', { name: 'Previous session' }));
    moved.rerender(<ReplayFrame {...props({}, 12)} />);
    expect(value()).toBe('9');
  });

  it('should tell the screen the slider\'s new session when it moves', async () => {
    const user = userEvent.setup();
    const onSessionChange = vi.fn();
    render(<ReplayFrame {...props({ onSessionChange })} />);
    expect(onSessionChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Previous session' }));
    expect(onSessionChange).toHaveBeenLastCalledWith('2026-11-13');
    slider().focus();
    await user.keyboard('{Home}');
    expect(onSessionChange).toHaveBeenLastCalledWith('2026-11-02');
    fireEvent.change(slider(), { target: { value: '4' } });
    expect(onSessionChange).toHaveBeenLastCalledWith('2026-11-06');
    expect(onSessionChange).toHaveBeenCalledTimes(3);
  });

  it('should edge the card in the result\'s colour and say the result in words, never by colour alone', async () => {
    const user = userEvent.setup();
    render(<ReplayFrame {...props()} />);
    expect(attr(screen.getByTestId('replay-card'), 'data-tone')).toBe('Profit');
    expect(screen.queryByText('Ahead: 80% of the way to the Target.')).not.toBeNull();
    slider().focus();
    await user.keyboard('{Home}');
    expect(attr(screen.getByTestId('replay-card'), 'data-tone')).toBe('Loss');
    expect(screen.queryByText('Behind: 12% of the way to the Stop.')).not.toBeNull();
  });
});

describe('Replay frame: the readout (W43)', () => {
  // The readout's own cases are in readout.test.tsx (A286); this one is the frame's reveal rule.
  it('should show the readout of the slider session, not the last', () => {
    const own = (index: number): ReplayFrameSession['readout'] => [{ title: 'Marks', rows: [{ label: 'BREN Mark', value: { kind: 'Figure', text: `$${100 + index}.00` } }] }];
    render(<ReplayFrame {...props({ sessions: Array.from({ length: 11 }, (_, i) => ({ ...frameSession(i), readout: own(i) })) })} />);
    expect(text(screen.getByTestId('readout'))).toContain('$110.00');
    fireEvent.change(slider(), { target: { value: '3' } });
    expect(text(screen.getByTestId('readout'))).toContain('$103.00');
    expect(text(screen.getByTestId('readout'))).not.toContain('$110.00');
  });
});

describe('Replay frame: the stake sentence (W38, A267)', () => {
  const stake = 'From here: $78.00 at risk to the Stop · $912.00 more to the Target · 11.69 to 1 · about 8% : 92% (the Plan was 0.29 to 1 · 78% : 22%).';
  const spoken = 'From here: $78.00 at risk to the Stop · $912.00 more to the Target · 11.69 to 1 · about 8% chance of the Target first, 92% of the Stop first (the Plan was 0.29 to 1 · 78% : 22%).';

  it('should speak the stake sentence with the odds in full to a screen reader', () => {
    const base = props();
    render(<ReplayFrame {...props({ sessions: base.sessions.map((s, i) => (i === 10 ? { ...s, stake, stakeSpoken: spoken } : s)) })} />);
    // A screen reader hears the spoken sentence, and the visible one is hidden from it; the sighted text is unchanged.
    expect(screen.getByText(spoken).className).toContain('visually-hidden');
    const shown = screen.getByText(stake);
    expect(attr(shown, 'aria-hidden')).toBe('true');
    expect(shown.parentElement).toBe(screen.getByText(spoken).parentElement);
  });
});

// A277, decision 5: the cards replace the table that was the charts' text equivalent (W45). Each card's own contents are the adapter's
// (cards.props.test.ts); the frame shows the cards of the revealed sessions and keeps them and the slider together.
describe('Replay: session cards (decision 5)', () => {
  afterEach(() => vi.restoreAllMocks());
  const cardsOf = () => screen.getAllByRole('article', { hidden: true });
  const headingOf = (card: HTMLElement) => text(within(card).getByRole('heading', { hidden: true }));

  it('should show one card for each session up to the slider, newest first, each headed by its date, under Session by session, and no table', () => {
    const { container } = render(<ReplayFrame {...props({ initialSession: '2026-11-04' })} />);
    expect(screen.getByRole('heading', { name: 'Session by session', hidden: true })).toBeTruthy();
    expect(cardsOf().map(headingOf)).toEqual(['Wed Nov 4', 'Tue Nov 3', 'Mon Nov 2']);
    expect(container.querySelector('table, details')).toBeNull();
  });

  it('should mark the slider session card current', async () => {
    render(<ReplayFrame {...props({ initialSession: '2026-11-04' })} />);
    const current = () => cardsOf().filter((card) => card.getAttribute('aria-current') === 'true').map(headingOf);
    expect(current()).toEqual(['Wed Nov 4']);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Previous session' }));
    expect(current()).toEqual(['Tue Nov 3']);
  });

  it('should move the slider to a card session when the card heading is pressed', async () => {
    const onSessionChange = vi.fn();
    render(<ReplayFrame {...props({ initialSession: '2026-11-04' })} onSessionChange={onSessionChange} />);
    // The plot double has a button for each session too, so the card's own heading is found inside the cards.
    const heading = within(cardsOf().at(-1)!).getByRole('button', { name: 'Mon Nov 2', hidden: true });
    await userEvent.setup().click(heading);
    expect(value()).toBe('0');
    expect(onSessionChange).toHaveBeenLastCalledWith('2026-11-02');
    // The later cards go with the slider: nothing after Mon Nov 2 is left (P145).
    expect(cardsOf().map(headingOf)).toEqual(['Mon Nov 2']);
  });

  it('should name the cards list as the charts description', () => {
    const base = props({ initialSession: '2026-11-04' });
    const { container } = render(<ReplayFrame {...base} plotBase={{ ...base.plotBase, describedBy: 'bren-cards' }} />);
    const list = container.querySelector('ol')!;
    expect(attr(list, 'id')).toBe('bren-cards');
    expect(attr(screen.getByTestId('plot'), 'aria-describedby')).toBe(attr(list, 'id'));
    expect(within(list).getAllByRole('article', { hidden: true })).toHaveLength(3);
  });

  it('should turn back to the page holding the slider card when the slider moves', async () => {
    // 700px holds two cards side by side.
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(700);
    const user = userEvent.setup();
    render(<ReplayFrame {...props({ initialSession: '2026-11-12' })} />);
    const visible = () => screen.getAllByRole('article').map(headingOf);
    expect(visible()).toEqual(['Thu Nov 12', 'Wed Nov 11']);
    await user.click(screen.getByRole('button', { name: 'Earlier sessions' }));
    expect(visible()).toEqual(['Tue Nov 10', 'Mon Nov 9']);
    // The slider moves forward, and the cards turn back to its card, the newest.
    await user.click(screen.getByRole('button', { name: 'Next session' }));
    expect(visible()).toEqual(['Fri Nov 13', 'Thu Nov 12']);
  });

  it('should turn the cards back to the first page when another Trade is handed to the frame with the same slider date', async () => {
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(700);
    const user = userEvent.setup();
    const { rerender } = render(<ReplayFrame {...props({ initialSession: '2026-11-12' })} />);
    await user.click(screen.getByRole('button', { name: 'Earlier sessions' }));
    expect(screen.getAllByRole('article').map(headingOf)).toEqual(['Tue Nov 10', 'Mon Nov 9']);
    rerender(<ReplayFrame {...props({ tradeKey: 'trade-other', initialSession: '2026-11-12' })} />);
    expect(screen.getAllByRole('article').map(headingOf)).toEqual(['Thu Nov 12', 'Wed Nov 11']);
  });
});

describe('Replay: the Plan block (decision 5)', () => {
  it('should show The Plan with its rows above the session cards, whichever session the slider is on', () => {
    const plan = { title: 'The Plan', rows: ['Entry: 4 contracts at $1.61', 'Stop: call at or below $0.80 · P&L if hit −$324.00'] };
    const { container } = render(<ReplayFrame {...props({ plan, initialSession: '2026-11-04' })} />);
    const block = screen.getByRole('region', { name: 'The Plan' });
    expect(within(block).getAllByRole('listitem').map(text)).toEqual(plan.rows);
    // Above the cards in the page.
    expect(block.compareDocumentPosition(container.querySelector('ol')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(slider(), { target: { value: '0' } });
    expect(within(screen.getByRole('region', { name: 'The Plan' })).getAllByRole('listitem').map(text)).toEqual(plan.rows);
  });
});

describe('Replay: the Plan block figures (C9AR.2, A278)', () => {
  it('should draw each figure of the Plan block, a signed amount and an odds pair included, as one card-figure span', () => {
    const plan = { title: 'The Plan', rows: ['Entry: 4 contracts at $1.61', 'Stop: call at or below $0.80 · P&L if hit −$324.00', 'Reward to risk: 2.95 to 1 · 25% : 75%'] };
    render(<ReplayFrame {...props({ plan })} />);
    const block = screen.getByRole('region', { name: 'The Plan' });
    expect([...block.querySelectorAll('.card-figure')].map(text)).toEqual(['$1.61', '$0.80', '−$324.00', '2.95 to 1', '25% : 75%']);
    expect(within(block).getAllByRole('listitem').map(text)).toEqual(plan.rows);
  });
});

describe('Replay: a first crossing after the status line (decision 2)', () => {
  it('should show the crossing sentence right after the status line, and only for the slider session', () => {
    const sessions = Array.from({ length: 11 }, (_, i) => ({ ...frameSession(i), ...(i >= 4 && { crossingWords: 'Target first reached Fri Nov 6.' }) }));
    render(<ReplayFrame {...props({ sessions, initialSession: '2026-11-06' })} />);
    const going = document.querySelector('.replay-going')!;
    expect(text(going.nextElementSibling!)).toBe('Target first reached Fri Nov 6.');
    fireEvent.change(slider(), { target: { value: '3' } });
    expect(document.body.textContent).not.toContain('Target first reached');
  });
});

describe('Replay frame: hover and tap', () => {
  const withHover = (initialSession?: string): ReplayProps => {
    const base = props({ initialSession });
    return { ...base, sessions: base.sessions.map((s, i) => ({ ...s, hover: [DAYS[i] ?? '', `BREN Mark $${100 + i}.00`, `Trade P&L ${FIGURES[i]?.split(' · ')[0]}`] })) };
  };
  const point = (day: string) => screen.getAllByTestId('point').find((p) => text(p) === day)!;

  it('should show a revealed session Marks and result on hover and on focus', async () => {
    const user = userEvent.setup();
    render(<ReplayFrame {...withHover()} />);
    expect(screen.queryByTestId('hover')).toBeNull();
    await user.hover(point('Tue Nov 3'));
    expect(text(screen.getByTestId('hover'))).toBe('Tue Nov 3BREN Mark $101.00Trade P&L -$120.00');
    await user.unhover(point('Tue Nov 3'));
    expect(screen.queryByTestId('hover')).toBeNull();
    act(() => point('Fri Nov 6').focus());
    expect(text(screen.getByTestId('hover'))).toBe('Fri Nov 6BREN Mark $104.00Trade P&L +$210.00');
    act(() => point('Fri Nov 6').blur());
    expect(screen.queryByTestId('hover')).toBeNull();
  });

  it('should show the hovered session lines in a box over the chart, with nothing between the chart and the readout', async () => {
    const user = userEvent.setup();
    render(<ReplayFrame {...withHover()} />);
    await user.hover(point('Tue Nov 3'));
    const hover = screen.getByTestId('hover');
    const chart = screen.getByTestId('plot').parentElement!;
    // Over the chart: the box lives inside the chart's own box, which also holds the plot.
    expect(chart.contains(hover)).toBe(true);
    expect(hover.parentElement).toBe(chart);
    // Nothing between the chart and the readout, hovered or not.
    expect(chart.nextElementSibling).toBe(screen.getByTestId('readout'));
    await user.unhover(point('Tue Nov 3'));
    expect(chart.nextElementSibling).toBe(screen.getByTestId('readout'));
  });

  it('should move the slider to a session when it is clicked or tapped', async () => {
    const user = userEvent.setup();
    const onSessionChange = vi.fn();
    render(<ReplayFrame {...withHover()} onSessionChange={onSessionChange} />);
    await user.click(point('Wed Nov 4'));
    expect(value()).toBe('2');
    expect(onSessionChange).toHaveBeenLastCalledWith('2026-11-04');
    expect(text(screen.getByTestId('headline'))).toContain('+$60.00 · 0.09R');
    expect(screen.getAllByTestId('point')).toHaveLength(3);
  });

  it('should clear the hover when another Trade\'s replay is passed in', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ReplayFrame {...withHover()} />);
    await user.hover(point('Tue Nov 3'));
    expect(screen.getByTestId('hover')).toBeTruthy();
    rerender(<ReplayFrame {...withHover()} tradeKey="trade-other" />);
    expect(screen.queryByTestId('hover')).toBeNull();
  });

  it('should show nothing for a session not yet revealed', async () => {
    const user = userEvent.setup();
    const { container } = render(<ReplayFrame {...withHover('2026-11-04')} />);
    await user.hover(screen.getByRole('button', { name: 'Later session' }));
    expect(screen.queryByTestId('hover')).toBeNull();
    expect(text(container)).not.toContain('Thu Nov 5');
    expect(text(container)).not.toContain('$103.00');
    await user.click(screen.getByRole('button', { name: 'Later session' }));
    expect(value()).toBe('2');
  });
});
