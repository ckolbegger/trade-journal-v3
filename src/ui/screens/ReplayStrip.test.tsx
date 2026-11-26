// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReplayStripFigures } from '../../app/types.ts';
import { session, usd, view } from '../cockpit/replay/view-doubles.props.ts';
import { ReplayStrip, type ReplayStripProps } from './ReplayStrip.tsx';

afterEach(cleanup);

// Four sessions of a Trade: down, down, a little up, down again.
const FOUR = view([
  session({ date: '2026-11-02', pnl: -100 }),
  session({ date: '2026-11-03', pnl: -280 }),
  session({ date: '2026-11-04', pnl: -50 }),
  session({ date: '2026-11-05', pnl: 0 }),
]);
const FIGURES: ReplayStripFigures = { sessions: 4, low: { date: '2026-11-03', value: usd(-280) }, high: { date: '2026-11-05', value: usd(0) }, stop: {}, target: {} };

const renderStrip = (over: Partial<ReplayStripProps> = {}) => render(<ReplayStrip replay={FOUR} strip={FIGURES} onOpen={() => undefined} {...over} />);

describe('the Replay strip (T95.56, W146)', () => {
  it('should show a strip on an open Trade card: a small chart of Trade P and L with the Stop and Target lines, one line of words, and the Replay button', () => {
    renderStrip();
    const strip = screen.getByRole('region', { name: 'Replay strip' });
    const chart = within(strip).getByRole('img', { name: 'Trade P&L by session' });
    // One path through the sessions' P&L, and a line each for the Plan's Stop (−$324.00) and Target (+$956.00).
    expect(chart.querySelectorAll('path.replay-strip-pnl')).toHaveLength(1);
    expect(chart.querySelector('line.replay-strip-stop')).not.toBeNull();
    expect(chart.querySelector('line.replay-strip-target')).not.toBeNull();
    expect(within(strip).getByText(/^Session 4 of this Trade/)).toBeTruthy();
    expect(within(strip).getByRole('button', { name: 'Replay' })).toBeTruthy();
  });

  it('should show the strip more strongly when the Trade is past a line or an Exit is not carried out', () => {
    const strong = () => screen.getByRole('region', { name: 'Replay strip' }).classList.contains('replay-strip-strong');
    renderStrip();
    expect(strong()).toBe(false);
    cleanup();
    renderStrip({ strip: { ...FIGURES, stop: { first: '2026-11-03', since: '2026-11-04', sessions: 2 } } });
    expect(strong()).toBe(true);
    cleanup();
    renderStrip({ strip: { ...FIGURES, target: { first: '2026-11-03', since: '2026-11-04', sessions: 2 } } });
    expect(strong()).toBe(true);
    cleanup();
    renderStrip({ exitNotCarriedOut: true });
    expect(strong()).toBe(true);
    // The stylesheet gives the strong strip a mark of its own.
    expect(readFileSync('src/ui/app.css', 'utf8')).toMatch(/\.replay-strip-strong\s*\{[^}]*border-left:\s*4px/);
  });

  it('should show the strip on a closed Trade card, with the sessions and the low', () => {
    renderStrip({ closed: true, strip: { sessions: 9, low: { date: '2026-11-04', value: usd(-210) }, high: { date: '2026-11-05', value: usd(40) }, stop: {}, target: {} } });
    const strip = screen.getByRole('region', { name: 'Replay strip' });
    expect(within(strip).getByText('9 sessions · low −$210.00 on Wed Nov 4. Walk it before you write.')).toBeTruthy();
    expect(within(strip).getByRole('button', { name: 'Replay' })).toBeTruthy();
    cleanup();

    // A Trade that ended after one session, with no figure to call a low.
    renderStrip({ closed: true, strip: { sessions: 1, stop: {}, target: {} } });
    expect(screen.getByText('1 session. Walk it before you write.')).toBeTruthy();
  });

  it('should stack the chart above the words at 375 wide', () => {
    // The strip's card is a container (A162): under 40rem wide the strip's columns become one, in the order chart, words, button.
    const css = readFileSync('src/ui/app.css', 'utf8');
    const narrow = [...css.matchAll(/@container \(max-width: 39\.99rem\) \{([\s\S]*?)\n\}/g)].map((match) => match[1]!).join('\n');
    expect(narrow).toMatch(/\.replay-strip\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
    renderStrip();
    const strip = screen.getByRole('region', { name: 'Replay strip' });
    expect([...strip.children].map((child) => child.tagName.toLowerCase())).toEqual(['svg', 'p', 'button']);
  });

  it('should say the session number with the low and the high for a Trade inside its lines', () => {
    renderStrip();
    expect(screen.getByText('Session 4 of this Trade · low −$280.00, high $0.00. See the path.')).toBeTruthy();
    cleanup();

    // A Trade with no figure for either keeps the session number alone.
    renderStrip({ strip: { sessions: 4, stop: {}, target: {} } });
    expect(screen.getByText('Session 4 of this Trade. See the path.')).toBeTruthy();
  });

  it('should say how long the Trade has been past the Stop, or at the Target and when it was first reached', () => {
    renderStrip({ strip: { ...FIGURES, stop: { first: '2026-11-03', since: '2026-11-09', sessions: 6 } } });
    expect(screen.getByText('Past the Stop since Mon Nov 9 · 6 sessions. See how it got here.')).toBeTruthy();
    cleanup();

    renderStrip({ strip: { ...FIGURES, target: { first: '2026-11-06', since: '2026-11-12', sessions: 1 } } });
    expect(screen.getByText('At the Target since Thu Nov 12 · first reached Fri Nov 6. See the run.')).toBeTruthy();
    cleanup();

    // Reached for the first time on the day the run began, there is nothing earlier to name.
    renderStrip({ strip: { ...FIGURES, target: { first: '2026-11-12', since: '2026-11-12', sessions: 1 } } });
    expect(screen.getByText('At the Target since Thu Nov 12. See the run.')).toBeTruthy();
  });
});
