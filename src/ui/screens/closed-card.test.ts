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

// T95.56, decision 136: the Stop and Target cells of What happened, from the replay's crossings.
describe('planResultRows Stop and Target cells (T95.56, W150)', () => {
  const withLines = (stops: boolean, targets: boolean): ClosedSummary => {
    const base = shortPlan('-2');
    return { ...base, plan: { ...base.plan, stops: stops ? [{ kind: 'UnderlyingPrice', price: '55.00' }] : [], targets: targets ? [{ kind: 'UnderlyingPrice', price: '45.00' }] : [] } };
  };
  const happened = (summary: ClosedSummary, label: string, strip?: Parameters<typeof planResultRows>[2]) => planResultRows(summary, 'America/New_York', strip).find((row) => row.label === label)!.happened;

  it('should fill the Stop and Target cells: Never reached, or Reached with the date first reached', () => {
    const strip = { sessions: 5, stop: { first: '2026-10-07' }, target: {} };
    expect(happened(withLines(true, true), 'Stop', strip)).toEqual(['Reached Wed Oct 7']);
    expect(happened(withLines(true, true), 'Target', strip)).toEqual(['Never reached']);
    // No replay to read, or no such line in the Plan: the cell stays empty.
    expect(happened(withLines(true, true), 'Stop')).toEqual([]);
    expect(happened(withLines(true, false), 'Target', strip)).toEqual([]);
  });
});

describe('planResultRows Entry for a short Plan', () => {
  it('should show a short Plan quantity without its sign', () => {
    expect(entryOf('-2')).toBe('Sell 2 contracts at $1.50');
  });

  it('should use the singular unit for a one-contract short', () => {
    expect(entryOf('-1')).toBe('Sell 1 contract at $1.50');
  });
});
