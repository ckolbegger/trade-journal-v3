// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionGrid } from './session-grid.tsx';
import type { SessionGridProps } from './session-grid.types.ts';

// The grid renders what it is given (A216, A291): each case hands it finished cells and looks at the markup.
const REVIEW_FRAME = { label: 'Marks, NVDA', tableClass: 'price-history review-marks' };
const grid = (props: Partial<SessionGridProps> & Pick<SessionGridProps, 'columns'>, rowLabels: readonly string[] = ['NVDA Mark']) =>
  render(<SessionGrid {...REVIEW_FRAME} rowLabels={rowLabels} {...props} />);
const column = (session: string, weekday: string, date: string, cells: SessionGridProps['columns'][number]['cells'], role?: 'review-date' | 'previous'): SessionGridProps['columns'][number] => ({
  session,
  weekday,
  date,
  cells,
  ...(role !== undefined && { role }),
});

afterEach(cleanup);

describe('Session grid: editable cells and the turned layout (P158 to P161)', () => {
  it('should render an editable cell as an input named after the cell', () => {
    const onChange = vi.fn();
    grid({ columns: [column('2026-10-08', 'Thu', 'Oct 8', [{ label: 'NVDA Mark, Thu Oct 8', input: { value: '', onChange } }])] });
    const input = screen.getByRole('textbox', { name: 'NVDA Mark, Thu Oct 8' });
    fireEvent.change(input, { target: { value: '151.10' } });
    expect(onChange).toHaveBeenCalledWith('151.10');
  });

  // W71.
  it('should tag the Review Date and previous columns', () => {
    const cell = { text: '152.40' };
    grid({
      columns: [
        column('2026-10-08', 'Thu', 'Oct 8', [cell], 'review-date'),
        column('2026-10-07', 'Wed', 'Oct 7', [cell], 'previous'),
        column('2026-10-06', 'Tue', 'Oct 6', [cell]),
      ],
    });
    const heads = screen.getAllByRole('columnheader').slice(1);
    expect(within(heads[0]!).getByText('Review Date')).toBeTruthy();
    expect(within(heads[1]!).getByText('Previous')).toBeTruthy();
    expect(heads[2]!.textContent).toBe('TueOct 6');
  });

  // W77.
  it('should render a session before the Trade held the Instrument as a dash named Not held', () => {
    grid({ columns: [column('2026-10-05', 'Mon', 'Oct 5', [{ notHeld: true }, null])] }, ['NVDA Mark', 'Call Mark']);
    const notHeld = screen.getByRole('img', { name: 'Not held' });
    expect(notHeld.textContent).toBe('—');
    expect(screen.getByRole('img', { name: 'No Mark' }).textContent).toBe('—');
  });

  // W73, W74, A293.
  it('should render a cell holding a draft from another Trade as its price and Unsaved, described by that Trade', () => {
    grid({ columns: [column('2026-10-07', 'Wed', 'Oct 7', [{ text: '151.10', label: 'XYZ Mark, Wed Oct 7', unsaved: { typedIn: 'XYZ (Long 100 shares @ $50.10)' } }])] });
    const cell = screen.getByRole('button', { name: 'XYZ Mark, Wed Oct 7' });
    expect(cell.textContent).toContain('151.10');
    expect(within(cell).getByText('Unsaved')).toBeTruthy();
    const described = cell.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(described)?.textContent).toBe('Typed in XYZ (Long 100 shares @ $50.10)');
  });

  // A293: pressing a cell that is not an input (a Mark, an acknowledged one, a draft typed elsewhere) chooses it.
  it('should report a pressed cell and mark it as the chosen one', () => {
    const onPressCell = vi.fn();
    const columns = [
      column('2026-10-08', 'Thu', 'Oct 8', [
        { id: 'mark', text: '152.40', label: 'NVDA Mark, Thu Oct 8' },
        { id: 'draft', text: '151.10', label: 'Call Mark, Thu Oct 8', unsaved: { typedIn: 'XYZ' } },
      ]),
    ];
    const { rerender } = grid({ columns, onPressCell }, ['NVDA Mark', 'Call Mark']);
    fireEvent.click(screen.getByRole('button', { name: 'NVDA Mark, Thu Oct 8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Call Mark, Thu Oct 8' }));
    expect(onPressCell.mock.calls).toEqual([['mark'], ['draft']]);
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
    rerender(<SessionGrid {...REVIEW_FRAME} rowLabels={['NVDA Mark', 'Call Mark']} columns={columns} onPressCell={onPressCell} chosen="draft" />);
    expect(screen.getByRole('button', { name: 'Call Mark, Thu Oct 8', pressed: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'NVDA Mark, Thu Oct 8', pressed: false })).toBeTruthy();
  });

  // P161. jsdom has no layout, so the observer is a stub that reports widths; the browser run proves the real thing.
  it('should turn when its container is narrower than 40rem, measured', () => {
    let report: (width: number) => void = () => undefined;
    const observed: Element[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          report = (width) => callback([{ contentRect: { width } } as ResizeObserverEntry], undefined as never);
        }
        observe = (target: Element) => void observed.push(target);
        disconnect = () => undefined;
        unobserve = () => undefined;
      },
    );
    try {
      const { container } = grid({ columns: [column('2026-10-08', 'Thu', 'Oct 8', [{ text: '152.40' }])], layout: 'auto' });
      const table = container.querySelector('table') as HTMLElement;
      expect(observed).toEqual([screen.getByRole('region', { name: 'Marks, NVDA' })]);
      act(() => report(639));
      expect(table.getAttribute('data-layout')).toBe('turned');
      act(() => report(641));
      expect(container.querySelector('table')?.getAttribute('data-layout')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  // P161. CSS only: jsdom loads no stylesheet, so this reads the rule's text.
  it('should give cells at least 44 px of height on a touch screen', () => {
    const css = readFileSync('src/ui/cockpit/styles/session-grid.css', 'utf8');
    const touch = /@media \(pointer: coarse\)\s*\{([\s\S]*?\})\s*\}/.exec(css)?.[1] ?? '';
    const rule = /\.session-grid-control\s*\{([^}]*)\}/.exec(touch)?.[1] ?? '';
    expect(rule).toMatch(/min-height:\s*44px/);
  });

  // P161.
  it('should render sessions as rows and Instruments as columns when turned, keeping every cell name', () => {
    const columns = [
      column('2026-10-08', 'Thu', 'Oct 8', [{ label: 'NVDA Mark, Thu Oct 8', input: { value: '', onChange: vi.fn() } }, { notHeld: true }], 'review-date'),
      column('2026-10-07', 'Wed', 'Oct 7', [{ text: '152.40', label: 'NVDA Mark, Wed Oct 7', id: 'mark' }, null], 'previous'),
    ];
    const { container } = grid({ columns, layout: 'turned' }, ['NVDA Mark', 'Call Mark']);
    const rows = within(container.querySelector('table') as HTMLElement).getAllByRole('row').map((row) => Array.from(row.children).map((c) => c.textContent));
    expect(rows).toEqual([
      ['Session', 'NVDA Mark', 'Call Mark'],
      ['ThuOct 8Review Date', '', '—'],
      ['WedOct 7Previous', '152.40', '—'],
    ]);
    expect(screen.getByRole('textbox', { name: 'NVDA Mark, Thu Oct 8' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'NVDA Mark, Wed Oct 7' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Not held' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'No Mark' })).toBeTruthy();
  });
});
