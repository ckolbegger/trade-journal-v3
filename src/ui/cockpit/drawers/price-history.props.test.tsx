// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router';
import type { Instrument } from '../../../domain/instrument/index.ts';
import { Rational } from '../../../domain/values/index.ts';
import { priceHistoryProps, priceHistoryTabCount, type ReplaySource } from './price-history.props.ts';
import { PriceHistory, PriceHistoryTable } from './price-history.tsx';

// The double is the slice of `TradeReplayView` the adapter reads (see ReplaySource); the Trade Views index does not export the view yet.
type ReplaySession = ReplaySource['sessions'][number];
type TradeReplayView = ReplaySource;

const STOCK: Instrument = { kind: 'Stock', symbol: 'XYZ' };
const CALL: Instrument = { kind: 'Option', symbol: 'XYZ   261218C00055000', root: 'XYZ', expiration: '2026-12-18', strike: '55', right: 'Call', multiplier: 100 };
const available = (instrument: Instrument, price: string): ReplaySession['marks'][number] => ({ instrument, resolution: { kind: 'Available', mark: { price } } });
const missing = (instrument: Instrument): ReplaySession['marks'][number] => ({ instrument, resolution: { kind: 'Missing' } });
const cents = (n: number) => Rational.of(BigInt(n), 100n);

// O-C3's sessions (plan section 5): the date, XYZ and call Marks (null for a gap), and the Trade P&L in cents (null when unavailable).
const session = (date: string, xyz: string | null, call: string | null, pnl: number | null): ReplaySession => ({
  date,
  tradePnl: pnl === null ? { kind: 'Unavailable' } : { kind: 'Value', value: cents(pnl) },
  marks: [xyz === null ? missing(STOCK) : available(STOCK, xyz), call === null ? missing(CALL) : available(CALL, call)],
});
const replay = (sessions: readonly ReplaySession[]): TradeReplayView => ({ instruments: [STOCK, CALL], sessions });

const MON = session('2026-10-12', '56.00', '2.10', 1870);
const TUE = session('2026-10-13', null, null, null);
const WED = session('2026-10-14', '57.40', '2.90', 18805);
const THU = session('2026-10-15', '57.90', '3.20', 21805);

describe('Price History (W9, P99)', () => {
  it('should show sessions as columns, newest on the left, with rows for each Instrument\'s Mark and Trade P&L', () => {
    const { container } = render(<PriceHistoryTable {...priceHistoryProps(replay([MON, WED, THU]), () => undefined)} />);
    const table = container.querySelector('table') as HTMLElement;
    const rows = within(table).getAllByRole('row').map((row) => Array.from(row.children).map((c) => c.textContent));
    expect(rows).toEqual([
      ['Session', 'ThuOct 15', 'WedOct 14', 'MonOct 12'],
      ['XYZ Mark', '57.90', '57.40', '56.00'],
      ['Call Mark', '$3.20', '$2.90', '$2.10'],
      ['Trade P&L', '$218.05', '$188.05', '$18.70'],
    ]);
  });

  // T8P.20-B1 (ocr on c0df748c).
  it('should open the Review from Enter Marks in the Review', () => {
    const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/trades/t1']}>
        <PriceHistory view={{ replay: replay([MON, TUE]) }} timeZone="America/New_York" />
        <Where />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Enter Marks in the Review' });
    expect(link.getAttribute('href')).toBe('/review');
    fireEvent.click(link);
    expect(getByTestId('where').textContent).toBe('/review');
  });

  // T8P.20-B2.
  it('should scroll a long history inside the drawer, not the page', () => {
    const { container } = render(<PriceHistoryTable {...priceHistoryProps(replay([MON, WED, THU]), () => undefined)} />);
    const region = within(container).getByRole('region', { name: 'Price History' });
    expect(region.classList.contains('table-scroll')).toBe(true);
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.querySelector('table.price-history')).not.toBeNull();
    expect(container.querySelectorAll('table')).toHaveLength(1);
  });

  // T8P.20-B3. CSS only: jsdom loads no stylesheet, so this reads the rule's text.
  it('should keep the pinned row labels opaque over scrolled values', () => {
    const css = readFileSync('src/ui/cockpit/styles/history.css', 'utf8');
    const rule = /\.price-history th:first-child\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('position: sticky');
    expect(rule).toMatch(/background:\s*var\(--card\)/);
  });

  // Not a planned case: the shell's wiring (T8P.5's ShellProps) until T8P.22 gives the Detail its replay.
  it('should show the replay the shell passes, and nothing without one', () => {
    const shown = render(<MemoryRouter><PriceHistory view={{ replay: replay([MON, WED]) }} timeZone="America/New_York" /></MemoryRouter>);
    expect(shown.container.querySelectorAll('thead th')).toHaveLength(3);
    const none = render(<MemoryRouter><PriceHistory view={{}} timeZone="America/New_York" /></MemoryRouter>);
    expect(none.container.innerHTML).toBe('');
  });

  it('should render a 500-session history in one table', () => {
    const day = (i: number) => new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
    const sessions = Array.from({ length: 500 }, (_, i) => session(day(i), '56.00', '2.10', 1870));
    const { container } = render(<PriceHistoryTable {...priceHistoryProps(replay(sessions), () => undefined)} />);
    expect(container.querySelectorAll('table')).toHaveLength(1);
    expect(container.querySelectorAll('thead th')).toHaveLength(501);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(container.querySelectorAll('tbody tr:first-child td')).toHaveLength(500);
    expect(container.querySelector('thead th:nth-child(2)')?.textContent).toBe('FriMay 15');
    expect(container.querySelector('thead th:last-child')?.textContent).toBe('WedJan 1');
  });

  it('should say "No sessions yet" before the first session ends', () => {
    const { container } = render(<PriceHistoryTable {...priceHistoryProps(replay([]), () => undefined)} />);
    expect(container.textContent).toBe("No sessions yet: the first ends once the Trade's first session ends.");
    expect(container.querySelector('table')).toBeNull();
    expect(priceHistoryTabCount(replay([]))).toBe(0);
  });

  it('should show a gap as "—" named "No Mark", count sessions without Marks on the tab, and link to the Review', () => {
    const gappy = replay([MON, TUE, WED, THU, session('2026-10-16', null, null, null)]);
    let opened = 0;
    const { container } = render(<PriceHistoryTable {...priceHistoryProps(gappy, () => (opened += 1))} />);
    const table = container.querySelector('table') as HTMLElement;
    const gaps = within(table).getAllByRole('img', { name: 'No Mark' });
    expect(gaps).toHaveLength(6);
    expect(gaps.every((gap) => gap.textContent === '—')).toBe(true);
    expect(priceHistoryTabCount(gappy)).toBe(2);
    expect(container.textContent).toContain('2 sessions without Marks.');
    fireEvent.click(within(container).getByRole('link', { name: 'Enter Marks in the Review' }));
    expect(opened).toBe(1);
    const whole = render(<PriceHistoryTable {...priceHistoryProps(replay([MON, WED, THU]), () => undefined)} />);
    expect(whole.container.textContent).not.toContain('without Marks');
    expect(within(whole.container).queryByRole('link', { hidden: true })).toBeNull();
    expect(priceHistoryTabCount(replay([MON, WED, THU]))).toBe(0);
  });
});
