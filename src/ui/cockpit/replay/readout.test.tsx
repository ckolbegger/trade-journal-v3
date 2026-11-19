// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Readout } from './readout.tsx';
import type { ReplayFrameSession } from './replay.types.ts';

afterEach(cleanup);

const text = (el: Element) => el.textContent ?? '';
const attr = (el: Element, name: string) => el.getAttribute(name);

// The readout takes the slider session's finished groups; the frame passes them (its own reveal case stays in frame.test.tsx).
describe('Replay frame: the readout (W43)', () => {
  const groups: ReplayFrameSession['readout'] = [
    { title: 'How it is going', rows: [{ label: 'Trade P&L', value: { kind: 'Figure', text: '+$988.00' }, drawn: true }, { label: 'Banked', value: { kind: 'Figure', text: '+$478.00' }, drawn: true }] },
    { title: 'At stake from here, whole Position', rows: [{ label: 'At Stop', value: { kind: 'Figure', text: '$672.00' }, drawn: true }, { label: 'At Max reward', value: { kind: 'Unbounded', text: 'No cap above' } }] },
    { title: 'Marks', rows: [{ label: 'BREN Mark', value: { kind: 'Figure', text: '$110.00' }, drawn: true }] },
    { title: 'Position', rows: [{ label: 'Open', value: { kind: 'Figure', text: '+$510.00' }, drawn: true }] },
    { title: 'The Plan', rows: [{ label: 'At the Stop', value: { kind: 'Figure', text: '+$316.00' }, drawn: true }, { label: 'At the Target', value: { kind: 'Figure', text: '+$956.00' }, drawn: true }] },
  ];

  it('should list the slider session under its five groups, with every figure the charts draw', () => {
    render(<Readout groups={groups} />);
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
    render(<Readout groups={rows} />);
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
    render(<Readout groups={rows} />);
    const readout = screen.getByTestId('readout');
    expect(within(readout).getAllByRole('heading', { level: 4 }).map(text)).toEqual(['Current Risk', 'Remaining Reward']);
    const worst = readout.querySelector('[data-row="At Worst case"]')!;
    expect(text(worst.querySelector('.replay-value')!)).toBe('$832.00 · 2.57R');
    expect(text(worst.querySelector('dd')!)).toBe('$832.00 · 2.57R · P&L +$156.00');
    expect(readout.querySelector('[data-row="At Max reward"] .replay-pnl')).toBeNull();
  });

  it('should put the P&L right after the amount and before the change on a row with both (T9.19-B14)', () => {
    const rows: ReplayFrameSession['readout'] = [
      {
        title: 'At stake from here, whole Position',
        rows: [{ label: 'At Stop', value: { kind: 'Figure', text: '$832.00 · 2.57R' }, pnl: { kind: 'Figure', text: '+$156.00' }, change: 'down $150.00 since Fri Nov 13' }],
      },
    ];
    render(<Readout groups={rows} />);
    const dd = screen.getByTestId('readout').querySelector('[data-row="At Stop"] dd')!;
    expect(text(dd)).toBe('$832.00 · 2.57R · P&L +$156.00 down $150.00 since Fri Nov 13');
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
    render(<Readout groups={rows} />);
    const row = (label: string) => screen.getByText(label).closest('[data-row]')!;
    expect(text(row('Trade P&L'))).toContain('down $150.00 since Fri Nov 13');
    expect(text(row('Banked'))).toContain('up $60.00 since Fri Nov 13');
    expect(text(row('Open'))).not.toContain('since');
  });

  it('should show Final result in place of the first two groups on a final session', () => {
    const final: ReplayFrameSession['readout'] = [{ title: 'Final result', rows: [{ label: 'Trade P&L', value: { kind: 'Figure', text: '+$988.00' } }] }, groups[2]!];
    render(<Readout groups={final} />);
    expect(within(screen.getByTestId('readout')).getAllByRole('heading').map(text)).toEqual(['Final result', 'Marks']);
    expect(screen.queryByText('How it is going', { selector: 'h3' })).toBeNull();
  });
});
