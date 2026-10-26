import { describe, expect, it } from 'vitest';
import { Rational } from '../../domain/values/index.ts';
import type { EntryDefinitionRecord, TradeMutationSuccess } from '../../app/types.ts';
import { confirmedDetail } from './confirmed-detail.ts';

const success = {
  postCommit: {
    trade: {
      tradeId: 'trade-9',
      factRevision: 1,
      storedLifecycle: 'Planned',
      plan: {
        economicTime: '2026-10-09T19:30:00Z',
        underlying: 'XYZ',
        thesis: 'Breakout.',
        invalidation: 'Below 48.',
        legs: [{ factId: 'f-2', side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50.25' }],
        stops: [{ factId: 'f-3', kind: 'UnderlyingPrice', price: '47.5' }],
        targets: [{ factId: 'f-4', kind: 'UnderlyingPrice', price: '56' }],
      },
    },
    derivation: { agreement: { kind: 'Agrees' }, baseline: {} },
    entry: { id: 'e-1', anchor: { kind: 'Trade', tradeId: 'trade-9' }, momentTime: '', authoredTime: '', responses: [] },
  },
} as unknown as TradeMutationSuccess;

describe('confirmedDetail', () => {
  it('should give the just-confirmed Planned Detail the Trade Summary of the Plan, as a Planned list item has', () => {
    const detail = confirmedDetail(success, { prompts: [] } as unknown as EntryDefinitionRecord, { strategy: '', account: '', institution: '' });
    expect(detail.summary).toEqual({ kind: 'Stock', direction: 'Long', quantity: Rational.of(100n), price: Rational.of(201n, 4n) });
  });
});
