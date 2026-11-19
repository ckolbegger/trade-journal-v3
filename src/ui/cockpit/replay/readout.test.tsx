// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { afterEach, describe, expect, it } from 'vitest';
import { Readout } from './readout.tsx';
import type { ReplayFrameSession } from './replay.types.ts';

afterEach(cleanup);

const text = (el: Element) => el.textContent ?? '';
const attr = (el: Element, name: string) => el.getAttribute(name);

const fig = (text: string) => ({ kind: 'Figure', text }) as const;
// R-BREN-U Wed 11-11 in the Stage A gate's figures (A278).
const stakeGroup: ReplayFrameSession['readout'][number] = {
  title: 'At stake from here, whole Position',
  rows: [],
  grid: {
    columns: ['From here', 'R', 'P&L if hit'],
    groups: [
      {
        heading: 'Current Risk',
        rows: [
          { label: 'At Stop', term: 'Ongoing Risk to Stop', fromHere: fig('$844.00'), r: fig('2.60R'), pnlIfHit: fig('−$324.00') },
          { label: 'At Worst case', term: 'Worst-Case Ongoing Risk', fromHere: fig('$1,164.00'), r: fig('3.59R'), pnlIfHit: fig('−$644.00') },
        ],
      },
      {
        heading: 'Remaining Reward',
        rows: [
          { label: 'At Target', term: 'Incremental Reward to Target', fromHere: fig('$436.00'), r: fig('1.35R'), pnlIfHit: fig('+$956.00') },
          { label: 'At Max reward', term: 'Maximum Incremental Reward', fromHere: { kind: 'Unbounded', text: 'No cap above' } },
        ],
      },
    ],
  },
};

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

  it('should set the grid under its column headings and its two row-group headings, one figure to a cell (T9.19-B4, A278)', () => {
    render(<Readout groups={[stakeGroup]} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(text)).toEqual(['Stake', 'From here', 'R', 'P&L if hit']);
    expect([...table.querySelectorAll('th[scope="rowgroup"]')].map(text)).toEqual(['Current Risk', 'Remaining Reward']);
    const worst = within(table).getByRole('row', { description: 'Worst-Case Ongoing Risk' });
    expect(within(worst).getAllByRole('cell').map(text)).toEqual(['$1,164.00', '3.59R', '−$644.00']);
    // An unbounded Max reward reads across its row: one cell, no R, no P&L.
    expect(within(within(table).getByRole('row', { description: 'Maximum Incremental Reward' })).getAllByRole('cell').map(text)).toEqual(['No cap above']);
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

  it('should mark every figure cell as unbreakable, sign included', () => {
    render(<Readout groups={[stakeGroup]} />);
    const table = screen.getByRole('table');
    const cells = within(table).getAllByRole('cell');
    expect(cells.length).toBeGreaterThan(0);
    // A278: the stylesheet rule on the grid's td is the one source of the no-break.
    const rules: Record<string, string> = {};
    postcss.parse(readFileSync('src/ui/cockpit/styles/replay-readout.css', 'utf8')).walkRules((rule) => {
      if (rule.selectors.some((sel) => sel.replace(/\s+/g, ' ') === '.replay-stake-grid td')) rule.walkDecls((d) => void (rules[d.prop] = d.value));
    });
    expect(rules['white-space']).toBe('nowrap');
    for (const cell of cells) {
      expect(cell.tagName).toBe('TD');
      expect(cell.closest('table')!.classList.contains('replay-stake-grid')).toBe(true);
    }
    // The sign and the amount are one piece of text, so no line break can fall between them.
    expect(within(table).getByText('−$644.00').getAttribute('data-kind')).toBe('Figure');
  });

  it('should give each stake row its canonical term as accessible text, with nothing added to see', () => {
    render(<Readout groups={[stakeGroup]} />);
    const table = screen.getByRole('table');
    for (const [label, term] of [['At Stop', 'Ongoing Risk to Stop'], ['At Worst case', 'Worst-Case Ongoing Risk'], ['At Target', 'Incremental Reward to Target'], ['At Max reward', 'Maximum Incremental Reward']] as const) {
      const row = within(table).getByRole('row', { description: term });
      expect(within(row).getByRole('rowheader').textContent).toBe(label);
      expect(row.getAttribute('title')).toBe(term);
      expect(text(row)).not.toContain(term);
    }
    // The row past a line carries "Stop Overrun" or "Target Overrun" the same way.
    cleanup();
    const past = { ...stakeGroup, grid: { ...stakeGroup.grid!, pastLine: { text: 'Past the Stop by $300.00 (0.50R) · at Stop −$740.00', term: 'Stop Overrun' } } };
    render(<Readout groups={[past]} />);
    const row = screen.getByRole('row', { description: 'Stop Overrun' });
    expect(text(row)).toBe('Past the Stop by $300.00 (0.50R) · at Stop −$740.00');
  });

  it('should show a dash named No Mark in each cell that needs the Mark, in the grid and in a Marks row', () => {
    const none = { kind: 'Unavailable', text: 'No Mark' } as const;
    const gap: ReplayFrameSession['readout'] = [
      { title: 'At stake from here, whole Position', rows: [], grid: { ...stakeGroup.grid!, groups: [{ heading: 'Current Risk', rows: [{ label: 'At Stop', term: 'Ongoing Risk to Stop', fromHere: none, r: none, pnlIfHit: fig('−$318.00') }] }] } },
      { title: 'Marks', rows: [{ label: 'Call Mark', value: none }] },
    ];
    render(<Readout groups={gap} />);
    const readout = screen.getByTestId('readout');
    const stop = readout.querySelector('[data-row="At Stop"]')!;
    expect(within(stop as HTMLElement).getAllByRole('img', { name: 'No Mark' }).map(text)).toEqual(['—', '—']);
    expect(text(readout.querySelector('[data-row="At Stop"] .replay-pnl-value')!)).toBe('−$318.00');
    expect(within(readout.querySelector('[data-row="Call Mark"]') as HTMLElement).getByRole('img', { name: 'No Mark' }).textContent).toBe('—');
    expect(text(readout)).not.toContain('No Mark');
  });

  it('should show the odds note once, under the grid, and let a screen reader hear the odds in full', () => {
    const note = 'Odds: Target first : Stop first, estimated with no edge and no time limit.';
    const odds = { text: '11.69 to 1 · about 8% : 92%', planText: '(Plan 0.29 to 1 · 78% : 22%)', spoken: 'about 8% chance of the Target first, 92% of the Stop first', note };
    const withOdds = { ...stakeGroup, rows: [{ label: 'Reward to risk', value: fig(odds.text), change: odds.planText }], grid: { ...stakeGroup.grid!, odds } };
    render(<Readout groups={[withOdds]} />);
    const readout = screen.getByTestId('readout');
    expect(screen.getAllByText(note)).toHaveLength(1);
    const table = screen.getByRole('table');
    expect(table.compareDocumentPosition(screen.getByText(note)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(text(readout.querySelector('[data-row="Reward to risk"]')!)).toContain('11.69 to 1 · about 8% : 92%');
    expect(within(readout).getByRole('img', { name: odds.spoken }).textContent).toBe('about 8% : 92%');
    // No odds, no note.
    cleanup();
    render(<Readout groups={[stakeGroup]} />);
    expect(screen.queryByText(note)).toBeNull();
  });

  it('should speak the current ratio and the odds in full to a screen reader in the Reward to risk row', () => {
    const odds = { text: '11.69 to 1 · about 8% : 92%', planText: '(Plan 0.29 to 1 · 78% : 22%)', spoken: 'about 8% chance of the Target first, 92% of the Stop first', note: 'Odds note.' };
    const withOdds = { ...stakeGroup, rows: [{ label: 'Reward to risk', value: fig(odds.text), change: odds.planText }], grid: { ...stakeGroup.grid!, odds } };
    render(<Readout groups={[withOdds]} />);
    const row = screen.getByTestId('readout').querySelector('[data-row="Reward to risk"]') as HTMLElement;
    // The ratio is plain text, not inside the labelled image (an image hides its children from a screen reader).
    expect(within(row).getByText(/11\.69 to 1/).closest('[role="img"]')).toBeNull();
    expect(within(row).getByRole('img', { name: odds.spoken })).toBeTruthy();
  });

  it('should carry the extremes weight on the At Worst case and At Max reward rows for the stylesheet to dim', () => {
    const weighted = { ...stakeGroup, grid: { ...stakeGroup.grid!, groups: stakeGroup.grid!.groups.map((g) => ({ ...g, rows: g.rows.map((r) => (r.label === 'At Worst case' || r.label === 'At Max reward' ? { ...r, weight: 'Remote' as const } : r)) })) } };
    render(<Readout groups={[weighted]} />);
    const readout = screen.getByTestId('readout');
    expect(['At Stop', 'At Worst case', 'At Target', 'At Max reward'].map((l) => attr(readout.querySelector(`[data-row="${l}"]`)!, 'data-weight'))).toEqual([null, 'Remote', null, 'Remote']);
  });

  it('should show Final result in place of the first two groups on a final session', () => {
    const final: ReplayFrameSession['readout'] = [{ title: 'Final result', rows: [{ label: 'Trade P&L', value: { kind: 'Figure', text: '+$988.00' } }] }, groups[2]!];
    render(<Readout groups={final} />);
    expect(within(screen.getByTestId('readout')).getAllByRole('heading').map(text)).toEqual(['Final result', 'Marks']);
    expect(screen.queryByText('How it is going', { selector: 'h3' })).toBeNull();
  });
});
