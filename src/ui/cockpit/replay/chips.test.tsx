// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReplayDrawer } from '../drawers/replay.tsx';
import { ReplayOverlay } from './overlay.tsx';
import { AXIO, brenThu1112, session, view, type Session } from './view-doubles.props.ts';

afterEach(cleanup);

// W47, W49 (T9.24): the chips under the charts. The estimates are the view's own finished numbers (T9.23); the chips select and format them.
// R-BREN-U after Thu Nov 12's sale holds 2 contracts, so Fri Nov 13 and Mon Nov 16 are session doubles of it with their estimates.
type Estimates = NonNullable<Session['estimates']>;
const estimates = (over: Partial<Estimates> = {}): Estimates => ({
  impliedVolatility: { kind: 'Estimate', value: 0.277 },
  shareEquivalent: { kind: 'Estimate', value: 183.2 },
  split: { kind: 'NotApplicable' },
  rate: 0.04,
  days: 4,
  ...over,
});
const withEstimates = (base: Session, over: Partial<Estimates> = {}): Session => ({ ...base, estimates: estimates(over) });
const bren = (date: string, over: Partial<Estimates> = {}, held = 2): Session => withEstimates(session({ date, held, pnl: 982 }), over);

const FRI = bren('2026-11-13', { impliedVolatility: { kind: 'Estimate', value: 0.301 }, days: 7 });
const MON = bren('2026-11-16');
const THU = withEstimates(brenThu1112, { impliedVolatility: { kind: 'Estimate', value: 0.312 }, days: 8 });
const open = (sessions: readonly Session[], initialSession: string) => render(<ReplayDrawer replay={view(sessions)} initialSession={initialSession} />);
const chart = () => screen.queryByRole('group', { name: 'Implied volatility by session' });
const chip = (name: string | RegExp) => screen.getByRole('button', { name });

describe('Replay: chips (W47)', () => {
  it('should show Implied volatility 27.7% tagged estimate for R-BREN-U on Mon 11-16', () => {
    open([THU, FRI, MON], '2026-11-16');
    const volatility = chip(/^Implied volatility 27\.7%/);
    expect(within(volatility).getByText('estimate')).toBeTruthy();
    expect(volatility.textContent).toBe('Implied volatility 27.7%estimate');
  });
  it('should open a small chart of the revealed sessions implied volatility on click, on Enter and on focus, and close the small chart with Escape, leaving the overlay open; a second Escape closes the overlay', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ReplayOverlay name="Replay, BREN" header="BREN" onClose={onClose}>
        <ReplayDrawer replay={view([THU, FRI, MON])} initialSession="2026-11-16" />
      </ReplayOverlay>,
    );
    const volatility = chip(/^Implied volatility 27\.7%/);
    expect(chart()).toBeNull();
    // Click opens it, with the revealed sessions only: Thu, Fri and Mon.
    await user.click(volatility);
    expect(within(chart()!).getAllByTestId('iv-point')).toHaveLength(3);
    // Escape closes the small chart and nothing else; the chip keeps the focus.
    await user.keyboard('{Escape}');
    expect(chart()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Replay, BREN' })).toBeTruthy();
    expect(document.activeElement).toBe(volatility);
    // Enter opens it again.
    await user.keyboard('{Enter}');
    expect(chart()).not.toBeNull();
    await user.keyboard('{Escape}');
    expect(chart()).toBeNull();
    // Focus opens it too, once the focus has been away.
    act(() => volatility.blur());
    act(() => volatility.focus());
    expect(chart()).not.toBeNull();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    // A second Escape closes the overlay.
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    // Nothing later shows early: on Fri Nov 13 the chart holds two sessions.
    cleanup();
    open([THU, FRI, MON], '2026-11-13');
    await user.click(chip(/^Implied volatility 30\.1%/));
    expect(within(chart()!).getAllByTestId('iv-point')).toHaveLength(2);
  });
  it('should draw an Unavailable session in that chart as a gap, and say why under the chip W49', async () => {
    const user = userEvent.setup();
    const gap = (reason: 'AtOrBelowExerciseValue' | 'MarkMissing' | 'ExpirationSession' | 'NoVolatilityFits' | 'InsensitiveToVolatility') => bren('2026-11-13', { impliedVolatility: { kind: 'Unavailable', reason }, shareEquivalent: { kind: 'Unavailable', reason }, days: 7 });
    // The gap between two sessions that have a figure is not bridged: two points and no line between them.
    open([THU, gap('NoVolatilityFits'), MON], '2026-11-16');
    await user.click(chip(/^Implied volatility 27\.7%/));
    expect(within(chart()!).getAllByTestId('iv-point')).toHaveLength(2);
    expect(within(chart()!).queryByTestId('iv-line')).toBeNull();
    expect(within(chart()!).getByText('Fri Nov 13:', { exact: false }).textContent).toBe('Fri Nov 13: Unavailable');
    cleanup();
    // On an Unavailable session the chip says so, and the reason stands under it, whether or not the chart is open.
    const reasons = {
      MarkMissing: 'A Mark is missing.',
      ExpirationSession: 'On the expiration session the price no longer depends on volatility.',
      AtOrBelowExerciseValue: "The Mark is at or below the option's exercise value, so no volatility fits.",
      NoVolatilityFits: 'No volatility fits this Mark.',
      InsensitiveToVolatility: 'This far from the strike, or this close to expiration, the price barely depends on volatility.',
    } as const;
    for (const [reason, sentence] of Object.entries(reasons) as [keyof typeof reasons, string][]) {
      open([THU, gap(reason)], '2026-11-13');
      const unavailable = chip(/^Implied volatility Unavailable/);
      expect(within(unavailable.closest('.replay-chip-item') as HTMLElement).getByText(sentence)).toBeTruthy();
      cleanup();
    }
  });
  it('should show Behaves like ≈ 183 shares, ≈ short 122 shares for a long Put, and Behaves like 200 shares with no tag for stock', () => {
    const shares = () => screen.getByTestId('shares-chip');
    const exact = (value: number): Estimates['shareEquivalent'] => ({ kind: 'Estimate', value });
    open([THU, FRI, MON], '2026-11-16');
    expect(shares().textContent).toBe('Behaves like ≈ 183 sharesestimate');
    expect(within(shares()).getByText('estimate')).toBeTruthy();
    cleanup();
    // A long Put behaves like a short stock Position: the share count is negative; it reads whole, with the singular at one.
    open([bren('2026-11-16', { shareEquivalent: exact(-122.4) })], '2026-11-16');
    expect(shares().textContent).toBe('Behaves like ≈ short 122 sharesestimate');
    cleanup();
    open([bren('2026-11-16', { shareEquivalent: exact(1.2) })], '2026-11-16');
    expect(shares().textContent).toBe('Behaves like ≈ 1 shareestimate');
    cleanup();
    // Stock: its shares exactly, with no tag, and no volatility chip.
    const stock = { ...session({ date: '2026-11-16', instrument: AXIO, held: 200, pnl: 340 }), estimates: estimates({ impliedVolatility: { kind: 'NotApplicable' }, shareEquivalent: { kind: 'Estimate', value: 200, exact: true }, rate: null, days: null }) };
    open([stock], '2026-11-16');
    expect(shares().textContent).toBe('Behaves like 200 shares');
    expect(screen.queryByText('estimate')).toBeNull();
    expect(screen.queryByRole('button', { name: /Implied volatility/ })).toBeNull();
  });
  it('should show 4 days to expiration and Long 2 contracts, and Expiration session at 0 days', () => {
    const days = () => screen.getByTestId('days-chip').textContent;
    const position = () => screen.getByTestId('position-chip').textContent;
    open([THU, FRI, MON], '2026-11-16');
    expect(days()).toBe('4 days to expiration');
    expect(position()).toBe('Long 2 contracts');
    cleanup();
    // One day takes the singular; a short Position reads Short; the expiration session has no days to count.
    open([bren('2026-11-19', { days: 1 }, -1)], '2026-11-19');
    expect(days()).toBe('1 day to expiration');
    expect(position()).toBe('Short 1 contract');
    cleanup();
    open([bren('2026-11-20', { days: 0 }, -3)], '2026-11-20');
    expect(days()).toBe('Expiration session');
    expect(position()).toBe('Short 3 contracts');
    cleanup();
    // Stock has no days to expiration and no contracts.
    const stock = { ...session({ date: '2026-11-16', instrument: AXIO, held: 200, pnl: 340 }), estimates: estimates({ impliedVolatility: { kind: 'NotApplicable' }, shareEquivalent: { kind: 'Estimate', value: 200, exact: true }, rate: null, days: null }) };
    open([stock], '2026-11-16');
    expect(screen.queryByTestId('days-chip')).toBeNull();
    expect(screen.queryByTestId('position-chip')).toBeNull();
  });
  it('should show no interest rate and no formula note beside the chart', async () => {
    const user = userEvent.setup();
    render(<ReplayDrawer replay={view([THU, FRI, MON])} initialSession="2026-11-16" />);
    await user.click(chip(/^Implied volatility 27\.7%/));
    expect(chart()).not.toBeNull();
    // The rate and the formula's limits are on the About page only (P122, W50).
    const shown = document.body.textContent ?? '';
    expect(shown).not.toMatch(/interest|\brate\b|Black-Scholes|formula|dividend/i);
    expect(shown).not.toMatch(/\b4%|5\.25%/);
  });
});
