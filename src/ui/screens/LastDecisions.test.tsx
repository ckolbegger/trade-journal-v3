// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DailyTradeReview } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { LastDecisions } from './LastDecisions.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type LastDecisionsRecord = NonNullable<DailyTradeReview['decisions']>;
type DecisionLine = LastDecisionsRecord['recent'][number];

const pnl = (n: bigint) => ({ kind: 'Value' as const, value: Rational.of(n) });
const line = (date: string, action: string, over: Partial<DecisionLine> = {}): DecisionLine => ({ date, action, tradePnl: pnl(-930n), ...over });
const decisions = (over: Partial<LastDecisionsRecord> = {}): LastDecisionsRecord => ({
  recent: [line('2026-11-13', 'Hold', { reason: 'Up today. One more day.' }), line('2026-11-12', 'Hold', { reason: 'Waiting.', tradePnl: pnl(120n) })],
  earlier: 0,
  sessionsWithoutReview: [],
  ...over,
});
const shown = (record: LastDecisionsRecord) => render(<LastDecisions decisions={record} />);

describe('LastDecisions', () => {
  it('should list the last four decisions with the day, the Action, that day Trade P&L and the reason', () => {
    shown(
      decisions({
        recent: [
          line('2026-11-13', 'Hold', { reason: 'Up today. One more day.' }),
          line('2026-11-12', 'Exit', { reason: 'Out.', tradePnl: pnl(120n) }),
          line('2026-11-11', 'Hold'),
          line('2026-11-10', 'Adjust', { reason: 'Tighter.' }),
        ],
      }),
    );
    const region = screen.getByRole('region', { name: 'Your last decisions' });
    const items = within(region).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]!.textContent).toBe('Fri Nov 13 · Hold · −$930.00“Up today. One more day.”');
    expect(items[1]!.textContent).toBe('Thu Nov 12 · Exit · +$120.00“Out.”');
    expect(items[3]!.textContent).toContain('Tue Nov 10 · Adjust');
  });

  it('should say how long the Trade has been held past a line', () => {
    const view = shown(decisions({ heldPast: { line: 'Stop', sessions: 5 } }));
    const region = () => screen.getByRole('region', { name: 'Your last decisions' });
    expect(within(region()).getByText('Held past the Stop 5 sessions running.')).toBeTruthy();
    view.rerender(<LastDecisions decisions={decisions({ heldPast: { line: 'Target', sessions: 1 } })} />);
    expect(within(region()).getByText('Held past the Target last session.')).toBeTruthy();
    view.rerender(<LastDecisions decisions={decisions()} />);
    expect(within(region()).queryByText(/Held past/)).toBeNull();
  });

  it('should name the sessions with no Review', () => {
    shown(decisions({ sessionsWithoutReview: ['2026-11-18', '2026-11-19'] }));
    expect(within(screen.getByRole('region', { name: 'Your last decisions' })).getByText('No Review Wed Nov 18, Thu Nov 19.')).toBeTruthy();
  });

  it('should show nothing for a Trade with no earlier Action', () => {
    const { container } = shown(decisions({ recent: [], sessionsWithoutReview: ['2026-11-18'] }));
    expect(container.textContent).toBe('');
  });

  it('should show the newest decision at 375 wide and fold the rest behind 3 earlier decisions', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(max-width: 959.98px)', media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    shown(
      decisions({
        recent: [line('2026-11-13', 'Hold', { reason: 'Up.' }), line('2026-11-12', 'Hold'), line('2026-11-11', 'Hold'), line('2026-11-10', 'Hold')],
      }),
    );
    const region = screen.getByRole('region', { name: 'Your last decisions' });
    const fold = within(region).getByText('3 earlier decisions').closest('details')!;
    expect(fold.open).toBe(false);
    expect(within(fold).getAllByRole('listitem')).toHaveLength(3);
    expect(within(region).getAllByRole('listitem')).toHaveLength(4);
    expect(within(region).getAllByRole('list')[0]!.textContent).toBe('Fri Nov 13 · Hold · −$930.00“Up.”');
  });

  it('should say no reason given where none was saved', () => {
    shown(decisions({ recent: [line('2026-11-13', 'Hold'), line('2026-11-12', 'Hold', { reason: 'Waiting.' })] }));
    const items = within(screen.getByRole('region', { name: 'Your last decisions' })).getAllByRole('listitem');
    expect(items[0]!.textContent).toBe('Fri Nov 13 · Hold · −$930.00no reason given');
    expect(items[1]!.textContent).not.toContain('no reason given');
  });
});
