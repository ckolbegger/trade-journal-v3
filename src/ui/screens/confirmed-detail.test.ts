import { describe, expect, it } from 'vitest';
import { Rational } from '../../domain/values/index.ts';
import type { ConfirmPlanResult, EntryDefinitionRecord } from '../../app/types.ts';
import { payoffFixtures } from '../../../tests/support/payoff-fixtures.ts';
import { confirmedDetail } from './confirmed-detail.ts';

type ConfirmedResult = Extract<ConfirmPlanResult, { readonly kind: 'Confirmed' }>;

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
    payoff: payoffFixtures.stock(),
  },
} as unknown as ConfirmedResult;

const optionSuccess = {
  postCommit: {
    ...success.postCommit,
    trade: {
      ...success.postCommit.trade,
      plan: {
        ...success.postCommit.trade.plan,
        underlying: 'MNO',
        legs: [
          {
            factId: 'f-2',
            side: 'Short',
            instrument: { kind: 'Option', symbol: 'MNO', root: 'MNO', expiration: '2026-11-20', strike: '45', right: 'Put', multiplier: 100 },
            quantity: '-2',
            intendedEntry: '1.20',
          },
        ],
        exerciseIntent: 'Authorized',
      },
    },
    payoff: payoffFixtures.ocPayoffs(),
  },
} as unknown as ConfirmedResult;

describe('confirmedDetail', () => {
  it('should give the just-confirmed option Plan Detail its option Trade Summary, its Exercise Intent and its payoff views from the result', () => {
    const detail = confirmedDetail(optionSuccess, { prompts: [] } as unknown as EntryDefinitionRecord, { strategy: '', account: '', institution: '' });
    expect(detail.summary).toEqual({ kind: 'Option', direction: 'Short', contracts: Rational.of(2n), expiration: '2026-11-20', strike: '45', right: 'Put' });
    expect(detail.plan.exerciseIntent).toBe('Authorized');
    expect(detail.payoff).toBe(optionSuccess.postCommit.payoff);
  });

  it('should show "Expires" on the handed-over Planned Detail without a read', () => {
    const contractExpiration = { status: 'Expires', date: '2026-11-20', days: 39 } as const;
    const withLine = { ...optionSuccess, postCommit: { ...optionSuccess.postCommit, contractExpiration } } as unknown as ConfirmedResult;
    const detail = confirmedDetail(withLine, { prompts: [] } as unknown as EntryDefinitionRecord, { strategy: '', account: '', institution: '' });
    expect(detail.contractExpiration).toEqual(contractExpiration);
  });

  it('should give the just-confirmed Planned Detail the Trade Summary of the Plan, as a Planned list item has', () => {
    const detail = confirmedDetail(success, { prompts: [] } as unknown as EntryDefinitionRecord, { strategy: '', account: '', institution: '' });
    expect(detail.summary).toEqual({ kind: 'Stock', direction: 'Long', quantity: Rational.of(100n), price: Rational.of(201n, 4n) });
  });
});
