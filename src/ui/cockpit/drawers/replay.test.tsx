// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Rational } from '../../../domain/values/index.ts';
import type { ReplayView } from '../replay/replay.props.ts';
import { ReplayDrawer } from './replay.tsx';

afterEach(cleanup);

// R-AXIO-D, two sessions: 200 shares bought at $48.00. The view is finished figures; the drawer draws them (the adapter's own cases are in replay.props.test.ts).
const AXIO = { kind: 'Stock', symbol: 'AXIO' } as const;
const session = (date: string, price: string, pnl: bigint) => ({
  date,
  positions: [{ instrument: AXIO, quantity: Rational.of(200n) }],
  heldQuantity: Rational.of(200n),
  realizedPnl: Rational.of(0n),
  tradePnl: { kind: 'Value', value: Rational.of(pnl) },
  change: null,
  marks: [{ instrument: AXIO, resolution: { kind: 'Available', mark: { price, revisionNumber: 1, source: 'Manual', savedAt: '2026-11-06T21:30:00Z' } }, change: null }],
  positionChangeIds: [],
  journal: [],
});
const replay = { tradeId: 'trade-axio', instruments: [AXIO], sessions: [session('2026-11-06', '46.10', -380n), session('2026-11-09', '43.40', -920n)], plan: [], pending: null } as unknown as ReplayView;

describe('Replay drawer (A255)', () => {
  it('should draw the Corridor and the readout from the view, open on the session asked for, and tell which session the slider moves to', async () => {
    const user = userEvent.setup();
    const moved = vi.fn();
    render(<ReplayDrawer replay={replay} initialSession="2026-11-06" onSessionChange={moved} />);
    expect(screen.getByTestId('headline').textContent).toBe('−$380.00');
    const slider = screen.getByRole('slider', { name: 'Session' });
    expect(slider.getAttribute('aria-valuetext')).toBe('Fri Nov 6 · 1 of 2. −$380.00');
    expect(screen.getByRole('img', { name: 'AXIO Marks and Trade P&L by session' })).toBeTruthy();
    expect(within(screen.getByTestId('readout')).getByText('AXIO Mark', { selector: 'dt' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Next session' }));
    expect(screen.getByTestId('headline').textContent).toBe('−$920.00');
    expect(moved).toHaveBeenCalledWith('2026-11-09');
  });
});
