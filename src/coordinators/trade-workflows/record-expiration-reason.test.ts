import { describe, expect, it } from 'vitest';
import type { OptionInstrument } from '../../domain/instrument/index.ts';
import type { ReflectionDisposition } from '../../modules/journal/index.ts';
import { D7_CATALOG_MANIFEST, type StrategyRecord } from '../../modules/reference-catalog/index.ts';
import { reviewStack, type ReviewStack } from '../../../tests/support/review-fixture.ts';
import type { ExpirationMember, PositionChangeResult } from './index.ts';

// T95.50: an expiration's dispositions and its reason (A312, A321, U14, Q2).
// A short 2 MNO 45 Puts sold Monday 2026-10-12, expiring Friday 2026-11-20. New York is on standard time: Friday's close is 21:00Z.
const FRIDAY = '2026-11-20';
const FRIDAY_1700 = '2026-11-20T22:00:00Z';
const FRIDAY_CLOSE = '2026-11-20T21:00:00Z';
const MONDAY_1700 = '2026-11-23T22:00:00Z';
const PLAN_TIME = '2026-10-12T13:00:00Z';
const SOLD_TIME = '2026-10-12T14:00:00Z';
const REASON = 'prompt.position-change-reflection.expiration-reason';

const PUT: OptionInstrument = { kind: 'Option', symbol: 'MNO', root: 'MNO', expiration: FRIDAY, right: 'Put', strike: '45', multiplier: 100 };

async function shortPut(options: { readonly mark?: string; readonly now?: string } = {}) {
  const stack = await reviewStack(options.now ?? FRIDAY_1700);
  await stack.catalog.seedDefaults(D7_CATALOG_MANIFEST);
  const strategies = await stack.catalog.query({ family: 'Strategy' });
  if (strategies.kind !== 'Page') throw new Error('no strategies');
  const strategy = strategies.items.find((s): s is StrategyRecord => s.kind === 'Strategy' && s.productKey === 'strategy.cash-secured-put');
  if (!strategy) throw new Error('no strategy');
  const planReflection = {
    definitionId: stack.definition.id,
    answers: { 'prompt.plan-reflection.thesis': { kind: 'Text', text: 'The premium is worth the risk.' }, 'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close below 42.' } },
  } as const;
  const confirmed = await stack.tradeWorkflows.confirmPlan({
    accountId: stack.account.id,
    accountRevision: stack.account.recordRevision,
    strategyId: strategy.id,
    strategyRevision: strategy.recordRevision,
    economicTime: PLAN_TIME,
    plan: { underlying: 'MNO', legs: [{ side: 'Short', instrument: PUT, quantity: '-2', intendedEntry: '1.20' }], stops: [{ kind: 'UnderlyingPrice', price: '42.00' }], targets: [{ kind: 'UnderlyingPrice', price: '50.00' }] },
    reflection: planReflection,
  });
  if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${confirmed.kind}`);
  const tradeId = confirmed.postCommit.trade.tradeId;
  const legId = confirmed.postCommit.trade.plan.legs[0]!.factId;
  const sold = await stack.tradeWorkflows.recordPositionChange({
    originTradeId: tradeId,
    trades: [{ tradeId, expectedFactRevision: confirmed.postCommit.trade.factRevision }],
    members: [{ kind: 'Execution', tradeId, action: 'Sell', instrument: PUT, intent: { kind: 'ServesPlannedLeg', plannedLegId: legId }, quantity: '2', price: '1.25', fee: '1.30', economicTime: SOLD_TIME }],
    reflection: stack.reflection,
  });
  if (sold.kind !== 'Recorded') throw new Error(`expected Recorded, got ${sold.kind}`);
  if (options.mark !== undefined) await stack.saveMark('MNO', options.mark, FRIDAY);
  return { stack, tradeId };
}

type Held = Awaited<ReturnType<typeof shortPut>>;

const noAnswers = (stack: ReviewStack): ReflectionDisposition => {
  if (stack.reflection.kind !== 'Complete') throw new Error('expected Complete');
  return { kind: 'Complete', form: { definitionId: stack.reflection.form.definitionId, answers: {} } };
};

async function expire(held: Held, reflection: ReflectionDisposition, closeReview: ReflectionDisposition = { kind: 'Defer' }, member: Partial<ExpirationMember> = {}): Promise<PositionChangeResult> {
  const current = await held.stack.tradeRecord.getRecord({ tradeId: held.tradeId, projection: 'AnalysisInput' });
  if (current.kind !== 'Found') throw new Error('no Trade');
  return held.stack.tradeWorkflows.recordPositionChange({
    originTradeId: held.tradeId,
    trades: [{ tradeId: held.tradeId, expectedFactRevision: current.factRevision }],
    members: [{ kind: 'Expiration', tradeId: held.tradeId, instrument: PUT, quantity: '2', economicTime: FRIDAY_CLOSE, ...member }],
    reflection,
    closeReview,
  });
}

const issuesOf = (result: PositionChangeResult) => {
  if (result.kind !== 'Rejected') throw new Error(`expected Rejected, got ${result.kind}`);
  return result.issues;
};

describe('an expiration and its reason', () => {
  it('should record an out-of-the-money expiration with a completed reflection holding no answers', async () => {
    const held = await shortPut({ mark: '46.00' });

    const result = await expire(held, noAnswers(held.stack));

    expect(result.kind).toBe('Recorded');
  }, 60_000);

  it('should refuse an expiration recorded while the contract is in the money at the session Underlying Mark with no Expiration Reason', async () => {
    const held = await shortPut({ mark: '40.00' });

    const result = await expire(held, noAnswers(held.stack));

    expect(issuesOf(result)).toEqual([{ source: 'TradeWorkflows', field: REASON, code: 'ExpirationReasonRequired' }]);
  }, 60_000);

  it('should record it with the reason, saved as the reflection Expiration Reason', async () => {
    const held = await shortPut({ mark: '40.00' });
    const base = noAnswers(held.stack);
    if (base.kind !== 'Complete') throw new Error('expected Complete');

    const result = await expire(held, { kind: 'Complete', form: { ...base.form, answers: { [REASON]: { kind: 'Text', text: 'Assigned early would have cost more.' } } } });

    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${JSON.stringify(result)}`);
    if (result.postCommit.reflection.kind !== 'Entry') throw new Error('expected an Entry');
    expect(result.postCommit.reflection.entry.responses).toEqual(expect.arrayContaining([{ promptId: REASON, value: { kind: 'Text', text: 'Assigned early would have cost more.' } }]));
  }, 60_000);

  it('should ask no reason when the session has no Underlying Mark', async () => {
    const held = await shortPut();

    const result = await expire(held, noAnswers(held.stack));

    expect(result.kind).toBe('Recorded');
  }, 60_000);

  it('should refuse Defer or Decline for the reflection, and Complete or Decline for a terminal Close Review', async () => {
    const held = await shortPut({ mark: '46.00' });
    const decline = (definitionId: string): ReflectionDisposition => ({ kind: 'Decline', definitionId, reason: 'Nothing to add.' });
    const definitionId = held.stack.reflection.kind === 'Complete' ? held.stack.reflection.form.definitionId : '';
    const review = await held.stack.journal.getDefinitions({ latestFor: 'entry-type.close-review' });
    if (review.kind !== 'Found') throw new Error('no Close Review definition');
    const closeForm: ReflectionDisposition = { kind: 'Complete', form: { definitionId: review.definition.id, answers: {} } };

    const reflections = [await expire(held, { kind: 'Defer' }), await expire(held, decline(definitionId))];
    const closeReviews = [await expire(held, noAnswers(held.stack), closeForm), await expire(held, noAnswers(held.stack), decline(review.definition.id))];

    expect(reflections.map(issuesOf)).toEqual(Array(2).fill([{ source: 'TradeWorkflows', field: 'reflection', code: 'ReflectionMustComplete' }]));
    expect(closeReviews.map((r) => issuesOf(r).filter((i) => i.source === 'TradeWorkflows'))).toEqual(Array(2).fill([{ source: 'TradeWorkflows', field: 'closeReview', code: 'CloseReviewMustDefer' }]));
  }, 60_000);

  it('should leave one Outstanding Close Review Debt on a terminal expiration, with no Close Reason', async () => {
    const held = await shortPut({ mark: '46.00' });

    const result = await expire(held, noAnswers(held.stack));

    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${result.kind}`);
    const outstanding = await held.stack.journal.query({ scope: 'OutstandingDebt' });
    expect(outstanding.debts.filter((d) => d.entryTypeKey === 'entry-type.close-review' && d.anchor.tradeId === held.tradeId)).toHaveLength(1);
    expect(result.postCommit.trade.closeReason).toBeUndefined();
  }, 60_000);

  it('should still return ExpirationMustSettleAllOpen and SettlementTimeInvalid as today', async () => {
    const held = await shortPut({ mark: '46.00', now: MONDAY_1700 });

    const partial = await expire(held, noAnswers(held.stack), { kind: 'Defer' }, { quantity: '1' });
    const wrongTime = await expire(held, noAnswers(held.stack), { kind: 'Defer' }, { economicTime: '2026-11-23T21:00:00Z' });

    expect(issuesOf(partial)).toEqual([expect.objectContaining({ source: 'TradeAnalysis', member: 0, field: 'quantity', code: 'ExpirationMustSettleAllOpen' })]);
    expect(issuesOf(wrongTime)).toEqual([expect.objectContaining({ source: 'TradeAnalysis', member: 0, code: 'SettlementTimeInvalid' })]);
  }, 60_000);

  it('should return ExpirationMustSettleAllOpen together with ExpirationReasonRequired for an in-the-money expiration with no reason that settles part of the open quantity', async () => {
    const held = await shortPut({ mark: '40.00' });

    const result = await expire(held, noAnswers(held.stack), { kind: 'Defer' }, { quantity: '1' });

    expect(issuesOf(result)).toEqual(
      expect.arrayContaining([
        { source: 'TradeWorkflows', field: REASON, code: 'ExpirationReasonRequired' },
        expect.objectContaining({ source: 'TradeAnalysis', member: 0, field: 'quantity', code: 'ExpirationMustSettleAllOpen' }),
      ]),
    );
  }, 60_000);

  it('should return SettlementTimeInvalid together with ExpirationReasonRequired for an in-the-money expiration with no reason at a wrong settlement time', async () => {
    const held = await shortPut({ mark: '40.00', now: MONDAY_1700 });

    const result = await expire(held, noAnswers(held.stack), { kind: 'Defer' }, { economicTime: '2026-11-21T15:00:00Z' });

    expect(issuesOf(result)).toEqual(
      expect.arrayContaining([
        { source: 'TradeWorkflows', field: REASON, code: 'ExpirationReasonRequired' },
        expect.objectContaining({ source: 'TradeAnalysis', member: 0, code: 'SettlementTimeInvalid' }),
      ]),
    );
  }, 60_000);
});
