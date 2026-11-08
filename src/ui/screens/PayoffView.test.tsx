// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { payoffFixtures, viewOf } from '../../../tests/support/payoff-fixtures.ts';
import { Rational } from '../../domain/values/index.ts';
import { PayoffView, type PayoffViewProps } from './PayoffView.tsx';
import { zeroText } from './payoff-text.ts';

afterEach(cleanup);

const show = (props: Partial<PayoffViewProps> & Pick<PayoffViewProps, 'kind' | 'result'>) => render(<PayoffView symbol="XYZ" {...props} />);

// The chart's textual equivalent: the table the SVG is labelled by.
const tableOf = (chart: HTMLElement) => {
  const id = chart.getAttribute('aria-labelledby') ?? '';
  const caption = document.getElementById(id);
  expect(caption?.tagName).toBe('CAPTION');
  return caption!.closest('table') as HTMLElement;
};

describe('chart and textual equivalent (A114, AC-UI-002)', () => {
  it('should render O-C Planned view as an SVG with role img labelled by a table listing both segments, its breakeven, its max loss for XYZ from 0.00 to 55.00, and unlimited max profit',() => {
    show({ kind: 'Planned', result: payoffFixtures.ocPayoffs().planned });
    expect(screen.getByRole('heading', { name: 'Planned Expiration Payoff' })).toBeTruthy();
    const chart = screen.getByRole('img', { name: 'Planned payoff at expiration by XYZ price' });
    expect(chart.tagName.toLowerCase()).toBe('svg');
    const table = tableOf(chart);
    expect(within(table).getByRole('caption').textContent).toBe('Planned payoff at expiration by XYZ price');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['XYZ at expiration', 'Payoff at start', 'Change per $1 rise in XYZ']);
    const rows = within(table).getAllByRole('row').map((row) => within(row).queryAllByRole('cell').map((c) => c.textContent));
    expect(rows).toContainEqual(['0.00 to 55.00', '−$400.00', '$0.00']);
    expect(rows).toContainEqual(['55.00 and above', '−$400.00', '+$200.00']);
    expect(within(table).getByText('Breakeven 57.00')).toBeTruthy();
    expect(within(table).getByText('Max loss $400.00 for XYZ from 0.00 to 55.00')).toBeTruthy();
    expect(within(table).getByText('Max profit: unlimited')).toBeTruthy();
    // The last ray carries its arrow text, and the chart has its axis labels.
    expect(within(chart).getByText('continues rising')).toBeTruthy();
    expect(within(chart).getByText('XYZ at expiration')).toBeTruthy();
    expect(within(chart).getByText('Payoff')).toBeTruthy();
  });

  it('should render a Zero Range as a labelled range and a Touch as a labelled point, and Current with its realized offset stated in the caption', () => {
    show({ kind: 'Current', result: payoffFixtures.zeroRange().current });
    let table = tableOf(screen.getByRole('img'));
    expect(within(table).getByRole('caption').textContent).toBe('Current payoff at expiration by XYZ price, including +$190.65 realized to date');
    expect(within(table).getByText('Breakeven from 0.00 to 55.00')).toBeTruthy();
    expect(within(table).getByText('No loss: at worst $0.00 for XYZ from 0.00 to 55.00')).toBeTruthy();
    expect(within(screen.getByRole('img')).getByText('Breakeven from 0.00 to 55.00')).toBeTruthy();
    cleanup();

    show({ kind: 'Planned', symbol: 'DEF', result: payoffFixtures.touch().planned });
    table = tableOf(screen.getByRole('img'));
    expect(within(table).getByText('Breakeven at 0.00, touched without crossing')).toBeTruthy();
    expect(within(table).getByText('No profit: at best $0.00 for DEF at 0.00')).toBeTruthy();
    expect(within(screen.getByRole('img')).getByText('Breakeven at 0.00, touched without crossing')).toBeTruthy();
    expect(within(screen.getByRole('img')).getByText('DEF at expiration')).toBeTruthy();
    cleanup();

    // Current with a zero offset reads "$0.00", a gain carries its plus sign, and a Crossing is rounded to cents.
    const afterPc2 = payoffFixtures.ocPayoffs().current;
    show({ kind: 'Current', result: afterPc2 });
    table = tableOf(screen.getByRole('img'));
    expect(within(table).getByRole('caption').textContent).toBe('Current payoff at expiration by XYZ price, including $0.00 realized to date');
    expect(within(table).getByText('Breakeven 57.01')).toBeTruthy();
    cleanup();

    // A curve that never reaches zero has no breakeven.
    show({ kind: 'Current', result: payoffFixtures.noBreakeven().current });
    table = tableOf(screen.getByRole('img'));
    expect(within(table).getByText('No breakeven')).toBeTruthy();
    expect(within(table).getByText('No loss: at worst +$309.35 for XYZ from 0.00 to 55.00')).toBeTruthy();
    cleanup();

    // A Long Put's last ray is flat at its loss, and its Minimum is attained on that ray.
    show({ kind: 'Planned', symbol: 'ABC', result: payoffFixtures.longPut().planned });
    table = tableOf(screen.getByRole('img'));
    expect(within(table).getByText('Max profit $4,850.00 for ABC at 0.00')).toBeTruthy();
    expect(within(table).getByText('Max loss $150.00 for ABC at 50.00 and above')).toBeTruthy();
    expect(within(screen.getByRole('img')).getByText('stays at −$150.00')).toBeTruthy();
  });

  it('should mark the value at expiration at the latest close on the Current chart and state it as the If XYZ is at 52.00 at expiration line, and render NotApplicable views as text naming the reason, with no chart', () => {
    const current = payoffFixtures.ocPayoffs().current;
    show({ kind: 'Current', result: current, latestClose: payoffFixtures.valueAt(viewOf(current), '52') });
    expect(screen.getByText('If XYZ is at 52.00 at expiration: −$401.30')).toBeTruthy();
    expect(within(screen.getByRole('img')).getByText('Latest close 52.00: −$401.30')).toBeTruthy();
    cleanup();

    show({ kind: 'Current', result: payoffFixtures.ocFlat().current });
    expect(screen.getByRole('heading', { name: 'Current Expiration Payoff' })).toBeTruthy();
    expect(screen.getByText('Not applicable: no open position')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    cleanup();

    show({ kind: 'Planned', result: payoffFixtures.stock().planned });
    expect(screen.getByText('Not applicable: no option expiration')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('chart drawing and ticks (T7.22-B2)', () => {
  it('should stroke the payoff curve, the axes and a Zero Range so the chart draws them', () => {
    const { container } = show({ kind: 'Current', result: payoffFixtures.zeroRange().current });
    const marks = [...container.querySelectorAll('.payoff-curve, .payoff-axis, .payoff-zero-range')];
    expect(container.querySelector('.payoff-curve')).not.toBeNull();
    expect(container.querySelectorAll('.payoff-axis')).toHaveLength(2);
    expect(container.querySelector('.payoff-zero-range')).not.toBeNull();
    for (const mark of marks) {
      expect(mark.getAttribute('stroke')).toBe('currentColor');
      expect(Number(mark.getAttribute('stroke-width'))).toBeGreaterThan(0);
    }
  });

  it('should label each axis price once when a segment start is also a zero-set end', () => {
    const { container } = show({ kind: 'Current', result: payoffFixtures.zeroRange().current });
    const ticks = [...container.querySelectorAll('svg text[text-anchor="middle"]')].map((t) => t.textContent);
    expect(ticks.filter((t) => t === '0.00')).toHaveLength(1);
    expect(ticks.filter((t) => t === '55.00')).toHaveLength(1);
  });
});

describe('chart labels stay inside the SVG (T7.32-B3)', () => {
  it('should keep every chart label inside the SVG bounds, including the Latest close label near a rising ray end', () => {
    for (const [payoffs, close] of [
      [payoffFixtures.ocAfterExit(), '56.50'],
      [payoffFixtures.ocAfterExit(), '90'],
      [payoffFixtures.ocPayoffs(), '60'],
      [payoffFixtures.ocPayoffs(), '200'],
    ] as const) {
      const current = payoffs.current;
      show({ kind: 'Current', result: current, latestClose: payoffFixtures.valueAt(viewOf(current), close) });
      for (const label of screen.getByRole('img').querySelectorAll('text')) {
        const x = Number(label.getAttribute('x'));
        const y = Number(label.getAttribute('y'));
        const width = (label.textContent ?? '').length * 7.5;
        const anchor = label.getAttribute('text-anchor');
        const left = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x;
        const where = `${label.textContent} (close ${close})`;
        // A 13 px label sits between its baseline minus its height and its baseline.
        expect(y - 13, where).toBeGreaterThanOrEqual(0);
        expect(y, where).toBeLessThanOrEqual(344);
        if (label.getAttribute('transform') === null) {
          expect(left, where).toBeGreaterThanOrEqual(0);
          expect(left + width, where).toBeLessThanOrEqual(640);
        }
      }
      cleanup();
    }
  });
});

describe('moved chart labels stay clear of ticks and axis titles (T7.32-B4)', () => {
  it('should keep a moved label clear of every tick label and axis title and never render two overlapping labels when the search runs out', () => {
    const base = viewOf(payoffFixtures.ocPayoffs().planned);
    const at = (n: number) => Rational.of(BigInt(n), 1n);
    const first = base.segments[0]!;
    const prices = [0, 10, 20, 30, 40, 55];
    const segments = prices.map((p, i) => ({ ...first, from: at(p), to: i < prices.length - 1 ? at(prices[i + 1]!) : null }));
    const pairs = prices.flatMap((from, i) => prices.slice(i + 1).map((to) => ({ kind: 'ZeroRange' as const, from: at(from), to: at(to) })));
    // 9 labels reach the tick rows from the Zero Set line; 21 leave the old search (6 moves each way) with no place.
    for (const count of [9, 21]) {
      const zeroSet = [...prices.map((p) => ({ kind: 'Touch' as const, price: at(p) })), ...pairs].slice(0, count);
      show({ kind: 'Planned', result: { kind: 'Value', value: { ...base, segments, zeroSet } } });
      const boxes = [...screen.getByRole('img').querySelectorAll('text')].map((label) => {
        const x = Number(label.getAttribute('x'));
        const y = Number(label.getAttribute('y'));
        const text = label.textContent ?? '';
        const width = text.length * 7.5;
        const anchor = label.getAttribute('text-anchor');
        if (label.getAttribute('transform') !== null) return { text, left: x - 7, right: x + 7, top: y - width / 2, bottom: y + width / 2 };
        const left = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x;
        return { text, left, right: left + width, top: y - 13, bottom: y };
      });
      expect(boxes.filter((b) => b.text.startsWith('Breakeven')), `${count} zero labels rendered`).toHaveLength(count);
      for (const [i, a] of boxes.entries()) {
        for (const b of boxes.slice(i + 1)) {
          const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          expect(overlap, `${count} zero labels: "${a.text}" overlaps "${b.text}"`).toBe(false);
        }
      }
      cleanup();
    }
  });
});

describe('tick rows stay inside the SVG (T7.32-B5)', () => {
  it('should keep every tick row inside the SVG and clear of the axis title when breakpoints cluster beyond three rows', () => {
    const base = viewOf(payoffFixtures.ocPayoffs().planned);
    const at = (n: number) => Rational.of(BigInt(n), 1n);
    const first = base.segments[0]!;
    const prices = [0, 50, 51, 52, 53, 54, 55];
    const segments = prices.map((p, i) => ({ ...first, from: at(p), to: i < prices.length - 1 ? at(prices[i + 1]!) : null }));
    show({ kind: 'Planned', result: { kind: 'Value', value: { ...base, segments, zeroSet: [] } } });
    const svg = screen.getByRole('img');
    const height = Number(svg.getAttribute('viewBox')!.split(' ')[3]);
    const texts = [...svg.querySelectorAll('text')];
    const title = texts.find((t) => t.textContent === 'XYZ at expiration')!;
    const titleTop = Number(title.getAttribute('y')) - 13;
    const ticks = texts.filter((t) => /^\d+\.\d\d$/.test(t.textContent ?? ''));
    expect(ticks).toHaveLength(prices.length);
    expect(new Set(ticks.map((t) => t.getAttribute('y'))).size, 'tick rows').toBeGreaterThan(3);
    expect(Number(title.getAttribute('y'))).toBeLessThanOrEqual(height);
    for (const tick of ticks) {
      const baseline = Number(tick.getAttribute('y'));
      expect(baseline, `${tick.textContent} inside`).toBeLessThanOrEqual(height);
      expect(titleTop - baseline, `${tick.textContent} clear of the axis title`).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('a Zero Range with no upper end (T7.22-B1)', () => {
  it('should refuse to word a Zero Range with no upper end, which no approved row words', () => {
    expect(() => zeroText({ kind: 'ZeroRange', from: Rational.of(55n), to: null })).toThrow('no approved words');
  });
});
