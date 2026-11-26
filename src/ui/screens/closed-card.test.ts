import { describe, expect, it } from 'vitest';
import type { OwedTradeSummary } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { planResultRows, type ClosedSummary } from './closed-card.ts';

// A short option Plan stores its leg's quantity signed ('-2'); the Entry cell shows the count without the sign.
const shortPlan = (quantity: string): ClosedSummary => ({
  kind: 'Closed',
  realizedPnl: Rational.of(100n),
  realizedR: { kind: 'Value', value: Rational.of(1n) },
  terminalDisposition: { kind: 'Value', value: [{ mechanism: 'Executions', quantity: Rational.of(2n) }] },
  closeReason: { id: 'cr-1', label: 'Target Reached' },
  terminalTime: '2026-10-12T18:00:00Z',
  plan: {
    side: 'Short',
    instrument: { kind: 'Option', symbol: 'ABC', root: 'ABC', expiration: '2026-11-20', strike: '50', right: 'Call', multiplier: 100 },
    quantity,
    intendedEntry: '1.50',
    stops: [],
    targets: [],
    plannedReward: Rational.of(300n),
    plannedR: Rational.of(2n),
  },
  fills: [],
  expirations: [],
} as unknown as Extract<OwedTradeSummary, { readonly kind: 'Closed' }>);

const entryOf = (quantity: string): string => planResultRows(shortPlan(quantity), 'America/New_York').find((row) => row.label === 'Entry')!.plan;

describe('planResultRows Entry for a short Plan', () => {
  it('should show a short Plan quantity without its sign', () => {
    expect(entryOf('-2')).toBe('Sell 2 contracts at $1.50');
  });

  it('should use the singular unit for a one-contract short', () => {
    expect(entryOf('-1')).toBe('Sell 1 contract at $1.50');
  });
});
