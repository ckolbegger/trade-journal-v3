// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
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
    tableRow: { dateLabel: DAYS[index] ?? '', cells: [], events: [] },
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
    tableTitle: 'Session by session',
    tableColumns: [],
    plotBase: { priceTitle: 'BREN price', pnlTitle: 'Trade P&L', accessibleName: 'BREN Marks and Trade P&L by session', describedBy: 'replay-table', anchors: { priceLines: [], planAtStop: null, planAtTarget: null }, axis: { slots: 15, endLabel: 'Fri Nov 20' } },
    Plot: PlotDouble,
    ...over,
  };
}

const slider = () => screen.getByRole('slider', { name: 'Session' });
const value = () => (slider() as HTMLInputElement).value;
const text = (el: Element) => el.textContent ?? '';
const attr = (el: Element, name: string) => el.getAttribute(name);

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

// The readout, table and hover are finished text from the props; the last session carries some for the cases below.
const mixed = (over: Partial<ReplayFrameSession> = {}, count = 11): ReplayProps => props({ sessions: Array.from({ length: count }, (_, i) => (i === count - 1 ? { ...frameSession(i), ...over } : frameSession(i))) }, count);

describe('Replay frame: the readout (W43)', () => {
  const groups: ReplayFrameSession['readout'] = [
    { title: 'How it is going', rows: [{ label: 'Trade P&L', value: { kind: 'Figure', text: '+$988.00' }, drawn: true }, { label: 'Banked', value: { kind: 'Figure', text: '+$478.00' }, drawn: true }] },
    { title: 'At stake from here, whole Position', rows: [{ label: 'At Stop', value: { kind: 'Figure', text: '$672.00' }, drawn: true }, { label: 'At Max reward', value: { kind: 'Unbounded', text: 'No cap above' } }] },
    { title: 'Marks', rows: [{ label: 'BREN Mark', value: { kind: 'Figure', text: '$110.00' }, drawn: true }] },
    { title: 'Position', rows: [{ label: 'Open', value: { kind: 'Figure', text: '+$510.00' }, drawn: true }] },
    { title: 'The Plan', rows: [{ label: 'At the Stop', value: { kind: 'Figure', text: '+$316.00' }, drawn: true }, { label: 'At the Target', value: { kind: 'Figure', text: '+$956.00' }, drawn: true }] },
  ];

  it('should list the slider session under its five groups, with every figure the charts draw', () => {
    render(<ReplayFrame {...mixed({ readout: groups })} />);
    const readout = screen.getByTestId('readout');
    expect(within(readout).getAllByRole('heading').map(text)).toEqual(['How it is going', 'At stake from here, whole Position', 'Marks', 'Position', 'The Plan']);
    for (const figure of ['+$988.00', '+$478.00', '$672.00', '$110.00', '+$510.00', '+$316.00', '+$956.00']) expect(text(readout)).toContain(figure);
    expect(within(readout).getByText('Trade P&L')).toBeTruthy();
  });

  it('should read an Unbounded Max reward as No cap above, an Unavailable figure as its reason, and a Not applicable one differently from both', () => {
    const rows: ReplayFrameSession['readout'] = [
      {
        title: 'The Plan',
        rows: [
          { label: 'At Max reward', value: { kind: 'Unbounded', text: 'No cap above' } },
          { label: 'At Stop', value: { kind: 'Unavailable', text: 'No Mark on Mon Nov 16' } },
          { label: 'Stop Overrun', value: { kind: 'NotApplicable', text: 'Not applicable' } },
        ],
      },
    ];
    render(<ReplayFrame {...mixed({ readout: rows })} />);
    const cell = (label: string) => screen.getByText(label).closest('[data-row]')!.querySelector('[data-kind]')!;
    expect(text(cell('At Max reward'))).toBe('No cap above');
    expect(text(cell('At Stop'))).toBe('No Mark on Mon Nov 16');
    expect(text(cell('Stop Overrun'))).toBe('Not applicable');
    expect(new Set(['At Max reward', 'At Stop', 'Stop Overrun'].map((l) => attr(cell(l), 'data-kind'))).size).toBe(3);
  });

  it('should show a row heading above its row and the P&L beside the amount from here (T9.19-B4)', () => {
    const rows: ReplayFrameSession['readout'] = [
      {
        title: 'At stake from here, whole Position',
        rows: [
          { label: 'At Worst case', heading: 'Current Risk', value: { kind: 'Figure', text: '$832.00 · 2.57R' }, pnl: { kind: 'Figure', text: '+$156.00' } },
          { label: 'At Max reward', heading: 'Remaining Reward', value: { kind: 'Unbounded', text: 'No cap above' } },
        ],
      },
    ];
    render(<ReplayFrame {...mixed({ readout: rows })} />);
    const readout = screen.getByTestId('readout');
    expect(within(readout).getAllByRole('heading', { level: 4 }).map(text)).toEqual(['Current Risk', 'Remaining Reward']);
    const worst = readout.querySelector('[data-row="At Worst case"]')!;
    expect(text(worst.querySelector('.replay-value')!)).toBe('$832.00 · 2.57R');
    expect(text(worst.querySelector('dd')!)).toBe('$832.00 · 2.57R · P&L +$156.00');
    expect(readout.querySelector('[data-row="At Max reward"] .replay-pnl')).toBeNull();
  });

  it('should give each figure its change since the session it is measured from', () => {
    const rows: ReplayFrameSession['readout'] = [
      {
        title: 'How it is going',
        rows: [
          { label: 'Trade P&L', value: { kind: 'Figure', text: '+$688.00' }, change: 'down $150.00 since Fri Nov 13' },
          { label: 'Banked', value: { kind: 'Figure', text: '+$478.00' }, change: 'up $60.00 since Fri Nov 13' },
          { label: 'Open', value: { kind: 'Figure', text: '+$210.00' } },
        ],
      },
    ];
    render(<ReplayFrame {...mixed({ readout: rows })} />);
    const row = (label: string) => screen.getByText(label).closest('[data-row]')!;
    expect(text(row('Trade P&L'))).toContain('down $150.00 since Fri Nov 13');
    expect(text(row('Banked'))).toContain('up $60.00 since Fri Nov 13');
    expect(text(row('Open'))).not.toContain('since');
  });

  it('should show Final result in place of the first two groups on a final session', () => {
    const final: ReplayFrameSession['readout'] = [{ title: 'Final result', rows: [{ label: 'Trade P&L', value: { kind: 'Figure', text: '+$988.00' } }] }, groups[2]!];
    render(<ReplayFrame {...mixed({ isFinal: true, readout: final })} />);
    expect(within(screen.getByTestId('readout')).getAllByRole('heading').map(text)).toEqual(['Final result', 'Marks']);
    expect(screen.queryByText('How it is going', { selector: 'h3' })).toBeNull();
  });

  it('should show the readout of the slider session, not the last', () => {
    const own = (index: number): ReplayFrameSession['readout'] => [{ title: 'Marks', rows: [{ label: 'BREN Mark', value: { kind: 'Figure', text: `$${100 + index}.00` } }] }];
    render(<ReplayFrame {...props({ sessions: Array.from({ length: 11 }, (_, i) => ({ ...frameSession(i), readout: own(i) })) })} />);
    expect(text(screen.getByTestId('readout'))).toContain('$110.00');
    fireEvent.change(slider(), { target: { value: '3' } });
    expect(text(screen.getByTestId('readout'))).toContain('$103.00');
    expect(text(screen.getByTestId('readout'))).not.toContain('$110.00');
  });
});

describe('Replay frame: the text equivalent (W45)', () => {
  // Each session's table row, finished: a Mark, the Trade P&L and the events.
  const withTable = (count = 11, initialSession?: string): ReplayProps => {
    const base = props({ tableColumns: ['BREN Mark', 'Trade P&L'], initialSession }, count);
    return { ...base, sessions: base.sessions.map((s, i) => ({ ...s, tableRow: { dateLabel: DAYS[i] ?? '', cells: [`$${100 + i}.00`, FIGURES[i]?.split(' · ')[0] ?? ''], events: i === 3 ? ['Sold 2 at $4.00', 'Stop moved'] : [] } })) };
  };

  it('should fold a table titled Session by session under the charts, one row per revealed session', () => {
    const { container } = render(<ReplayFrame {...withTable(11, '2026-11-04')} />);
    const fold = container.querySelector('details')!;
    expect(fold.hasAttribute('open')).toBe(false);
    expect(text(fold.querySelector('summary')!).replace(text(fold.querySelector('.replay-table-cue')!), '')).toBe('Session by session');
    expect(within(fold).getAllByRole('columnheader', { hidden: true }).map(text)).toEqual(['Session', 'BREN Mark', 'Trade P&L', 'Events']);
    const rows = within(fold).getAllByRole('row', { hidden: true }).slice(1);
    expect(rows.map((r) => text(r))).toEqual(['Mon Nov 2$100.00-$40.00', 'Tue Nov 3$101.00-$120.00', 'Wed Nov 4$102.00+$60.00']);
    expect(attr(fold.querySelector('table')!, 'id')).toBe('replay-table');
  });

  it('should keep the replay table inside a scroll container', () => {
    const { container } = render(<ReplayFrame {...withTable(11, '2026-11-04')} />);
    const region = container.querySelector('details table')!.parentElement!;
    expect(region.className).toBe('replay-table-scroll');
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-label')).toBe('Session by session');
    expect(region.getAttribute('tabindex')).toBe('0');
  });

  it('should show whether the table is folded or open', () => {
    const { container } = render(<ReplayFrame {...withTable(11, '2026-11-04')} />);
    const fold = container.querySelector('details')!;
    const cue = () => text(fold.querySelector('summary .replay-table-cue')!);
    const folded = cue();
    fold.setAttribute('open', '');
    fireEvent(fold, new Event('toggle'));
    const open = cue();
    expect(folded).not.toBe(open);
    expect(text(fold.querySelector('summary')!)).toBe(`${open}Session by session`);
  });

  it('should give the plot the table id to describe it', () => {
    const base = withTable(11, '2026-11-04');
    const { container } = render(<ReplayFrame {...base} plotBase={{ ...base.plotBase, describedBy: 'bren-table' }} />);
    const tableId = attr(container.querySelector('details table')!, 'id');
    expect(tableId).toBe('bren-table');
    expect(attr(screen.getByTestId('plot'), 'aria-describedby')).toBe(tableId);
  });

  it('should read a session without a Mark as No Mark in its cells, never a carried value', () => {
    const base = withTable(11, '2026-11-04');
    const gap = { ...base, sessions: base.sessions.map((s, i) => (i === 1 ? { ...s, tableRow: { ...s.tableRow, cells: ['No Mark', 'No Mark'] } } : s)) };
    render(<ReplayFrame {...gap} />);
    const row = within(screen.getByRole('table', { hidden: true })).getByText('Tue Nov 3').closest('tr')!;
    expect(within(row).getAllByRole('cell', { hidden: true }).map(text)).toEqual(['No Mark', 'No Mark', '']);
    expect(text(row)).not.toContain('$100.00');
  });

  it('should name each session events in the Events column', () => {
    render(<ReplayFrame {...withTable()} />);
    const row = within(screen.getByRole('table', { hidden: true })).getByText('Thu Nov 5').closest('tr')!;
    const cells = within(row).getAllByRole('cell', { hidden: true });
    expect(text(cells[cells.length - 1]!)).toBe('Sold 2 at $4.00; Stop moved');
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
