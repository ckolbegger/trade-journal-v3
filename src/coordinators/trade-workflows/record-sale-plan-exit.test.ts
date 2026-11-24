import { describe, expect, it } from 'vitest';
import type { ReflectionDisposition } from '../../modules/journal/index.ts';
import { D6_CATALOG_MANIFEST } from '../../modules/reference-catalog/index.ts';
import { dumpAll } from '../../../tests/support/stack.ts';
import { MONDAY_1700, TEN_AM, reviewStack, type ReviewStack } from '../../../tests/support/review-fixture.ts';
import { createTradeWorkflows, type PositionChangeCommand, type PositionChangeMember, type PositionChangeResult } from './index.ts';

// T95.36: a sale is measured against the Plan Exit; its dispositions; "Say why later" (A309 to A312, U14).
// A long 100 shares of XYZ bought Monday 10-12 at 50.00 (Stop 47.50, Target 56.00), reviewed that evening.

const SALE_TIME = '2026-10-12T20:45:00Z';
const PLAN_DEPARTURE = 'prompt.position-change-reflection.plan-departure';

async function longTrade() {
  const stack = await reviewStack(MONDAY_1700);
  await stack.catalog.seedDefaults(D6_CATALOG_MANIFEST);
  const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
  await stack.fill(trade, TEN_AM, '100', '50.00');
  return { stack, tradeId: trade.tradeId, plannedLegId: trade.plan.legs[0]!.factId };
}

type Held = Awaited<ReturnType<typeof longTrade>>;

// What a sale that closes the whole Position adds: its one Close Reason, and its Close Review put off (A312).
async function closing(held: Held): Promise<Partial<PositionChangeCommand>> {
  const reasons = await held.stack.catalog.query({ family: 'CloseReason' });
  if (reasons.kind !== 'Page') throw new Error('no Close Reasons');
  return { closeReasonId: reasons.items[0]!.id, closeReview: { kind: 'Defer' } };
}

const sellMember = (held: Held, quantity: string, price: string): PositionChangeMember => ({
  kind: 'Execution',
  tradeId: held.tradeId,
  action: 'Sell',
  instrument: { kind: 'Stock', symbol: 'XYZ' },
  intent: { kind: 'ServesPlannedLeg', plannedLegId: held.plannedLegId },
  quantity,
  price,
  fee: '1.00',
  economicTime: SALE_TIME,
});

async function saleCommand(held: Held, quantity: string, price: string, reflection: ReflectionDisposition, extra: Partial<PositionChangeCommand> = {}): Promise<PositionChangeCommand> {
  const current = await held.stack.tradeRecord.getRecord({ tradeId: held.tradeId, projection: 'AnalysisInput' });
  if (current.kind !== 'Found') throw new Error('no Trade');
  return {
    originTradeId: held.tradeId,
    trades: [{ tradeId: held.tradeId, expectedFactRevision: current.factRevision }],
    members: [sellMember(held, quantity, price)],
    reflection,
    ...extra,
  };
}

const sell = async (held: Held, quantity: string, price: string, reflection: ReflectionDisposition, extra: Partial<PositionChangeCommand> = {}): Promise<PositionChangeResult> =>
  held.stack.tradeWorkflows.recordPositionChange(await saleCommand(held, quantity, price, reflection, extra));

const recorded = (result: PositionChangeResult) => {
  if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${result.kind}: ${JSON.stringify(result)}`);
  return result;
};

// The reflection with no answers at all: the three earlier prompts and the Plan Departure Reason are optional (manifest 6).
const noAnswers = (stack: ReviewStack): ReflectionDisposition => {
  const { definitionId } = stack.reflection.kind === 'Complete' ? stack.reflection.form : { definitionId: '' };
  return { kind: 'Complete', form: { definitionId, answers: {} } };
};

const withReason = (stack: ReviewStack, text = 'Stopped out early.'): ReflectionDisposition => {
  const base = noAnswers(stack);
  if (base.kind !== 'Complete') throw new Error('expected Complete');
  return { kind: 'Complete', form: { ...base.form, answers: { [PLAN_DEPARTURE]: { kind: 'Text', text } } } };
};

describe('a sale that follows the Plan Exit', () => {
  it('should record a sale that follows the Plan Exit with a completed reflection holding no answers', async () => {
    const held = await longTrade();
    await held.stack.saveMark('XYZ', '47.00');

    const result = recorded(await sell(held, '100', '47.00', noAnswers(held.stack), await closing(held)));

    expect(result.receipt.reflection.kind).toBe('Entry');
    const debts = await held.stack.journal.query({ scope: 'OutstandingDebt' });
    expect(debts.debts.filter((d) => d.entryTypeKey === 'entry-type.position-change-reflection')).toEqual([]);
  }, 60_000);
});

describe('a sale that leaves the Plan Exit', () => {
  it('should refuse a completed reflection with no Plan Departure Reason for a sale that leaves the Plan Exit, and write nothing', async () => {
    const held = await longTrade();
    await held.stack.saveMark('XYZ', '51.00');
    const before = await dumpAll(held.stack.factory);

    const result = await sell(held, '100', '51.00', noAnswers(held.stack), await closing(held));

    expect(result).toMatchObject({ kind: 'Rejected', issues: [{ source: 'TradeWorkflows', field: PLAN_DEPARTURE, code: 'PlanDepartureReasonRequired' }] });
    expect(await dumpAll(held.stack.factory)).toEqual(before);
  }, 60_000);

  it('should record it with the reason, saved as the reflection Plan Departure Reason', async () => {
    const held = await longTrade();
    await held.stack.saveMark('XYZ', '51.00');

    const result = recorded(await sell(held, '100', '51.00', withReason(held.stack, 'Needed the cash.'), await closing(held)));

    expect(result.postCommit.reflection).toMatchObject({ kind: 'Entry', entry: { responses: expect.arrayContaining([{ promptId: PLAN_DEPARTURE, value: { kind: 'Text', text: 'Needed the cash.' } }]) as unknown } });
  }, 60_000);

  it('should record that sale with its reflection put off, leaving one Outstanding reflection Debt that requires the Plan Departure Reason', async () => {
    const held = await longTrade();
    await held.stack.saveMark('XYZ', '51.00');

    const result = recorded(await sell(held, '100', '51.00', { kind: 'Defer' }, await closing(held)));

    expect(result.receipt.reflection.kind).toBe('Debt');
    const owed = (await held.stack.journal.query({ scope: 'OutstandingDebt' })).debts.filter((d) => d.entryTypeKey === 'entry-type.position-change-reflection');
    expect(owed).toHaveLength(1);
    expect(owed[0]).toMatchObject({ status: 'Outstanding', requires: ['PlanDepartureReason'] });
  }, 60_000);

  it('should leave a Debt that requires nothing when a sale that follows the Plan Exit puts its reflection off', async () => {
    const held = await longTrade();
    await held.stack.saveMark('XYZ', '47.00');

    recorded(await sell(held, '100', '47.00', { kind: 'Defer' }, await closing(held)));

    const owed = (await held.stack.journal.query({ scope: 'OutstandingDebt' })).debts.filter((d) => d.entryTypeKey === 'entry-type.position-change-reflection');
    expect(owed).toHaveLength(1);
    expect(owed[0]).not.toHaveProperty('requires');
  }, 60_000);

  it('should record a whole sale before a line with no reason when the Trade most recent Action is an Exit with a reason', async () => {
    const held = await longTrade();
    await held.stack.saveMark('XYZ', '51.00');
    await held.stack.saveAction(held.tradeId, 'Exit', '2026-10-12', 'The thesis broke.');

    const result = recorded(await sell(held, '100', '51.00', noAnswers(held.stack), await closing(held)));

    expect(result.receipt.reflection.kind).toBe('Entry');
  }, 60_000);

  it('should require the reason for the same sale when that Exit has no reason', async () => {
    const held = await longTrade();
    await held.stack.saveMark('XYZ', '51.00');
    await held.stack.saveAction(held.tradeId, 'Exit', '2026-10-12', null);

    const result = await sell(held, '100', '51.00', noAnswers(held.stack), await closing(held));

    expect(result).toMatchObject({ kind: 'Rejected', issues: [{ field: PLAN_DEPARTURE, code: 'PlanDepartureReasonRequired' }] });
  }, 60_000);

  it('should require the reason for a part sale whatever the Exit says', async () => {
    const held = await longTrade();
    await held.stack.saveMark('XYZ', '51.00');
    await held.stack.saveAction(held.tradeId, 'Exit', '2026-10-12', 'The thesis broke.');

    const result = await sell(held, '40', '51.00', noAnswers(held.stack));

    expect(result).toMatchObject({ kind: 'Rejected', issues: [{ field: PLAN_DEPARTURE, code: 'PlanDepartureReasonRequired' }] });
  }, 60_000);

  it('should refuse Decline for a sale reflection', async () => {
    const held = await longTrade();
    await held.stack.saveMark('XYZ', '51.00');
    const before = await dumpAll(held.stack.factory);

    const result = await sell(held, '40', '51.00', { kind: 'Decline', definitionId: held.stack.reflection.kind === 'Complete' ? held.stack.reflection.form.definitionId : '', reason: 'Routine fill.' });

    expect(result).toMatchObject({ kind: 'Rejected', issues: [{ source: 'TradeWorkflows', field: 'reflection', code: 'ReflectionDeclineNotAllowed' }] });
    expect(await dumpAll(held.stack.factory)).toEqual(before);
  }, 60_000);

  it('should refuse Complete or Decline for a closing sale Close Review, and leave one Outstanding Close Review Debt when it is deferred', async () => {
    const held = await longTrade();
    await held.stack.saveMark('XYZ', '47.00');
    const definition = await held.stack.journal.getDefinitions({ latestFor: 'entry-type.close-review' });
    if (definition.kind !== 'Found') throw new Error('no Close Review definition');
    const answered: ReflectionDisposition = {
      kind: 'Complete',
      form: {
        definitionId: definition.definition.id,
        answers: { 'prompt.close-review.take-again': { kind: 'Option', optionId: 'option.close-review.take-again.yes-as-planned' }, 'prompt.close-review.key-lesson': { kind: 'Text', text: 'Size down.' } },
      },
    };
    const declined: ReflectionDisposition = { kind: 'Decline', definitionId: definition.definition.id, reason: 'Nothing to add.' };
    const { closeReasonId } = await closing(held);
    const before = await dumpAll(held.stack.factory);

    for (const closeReview of [answered, declined]) {
      const result = await sell(held, '100', '47.00', noAnswers(held.stack), { closeReasonId, closeReview });
      expect(result).toMatchObject({ kind: 'Rejected', issues: [{ source: 'TradeWorkflows', field: 'closeReview', code: 'CloseReviewMustDefer' }] });
    }
    expect(await dumpAll(held.stack.factory)).toEqual(before);

    const deferred = recorded(await sell(held, '100', '47.00', noAnswers(held.stack), { closeReasonId, closeReview: { kind: 'Defer' } }));
    expect(deferred.receipt.closeReview?.kind).toBe('Debt');
    const owed = (await held.stack.journal.query({ scope: 'OutstandingDebt' })).debts.filter((d) => d.entryTypeKey === 'entry-type.close-review');
    expect(owed).toHaveLength(1);
  }, 60_000);

  it('should still require the Close Reason on a closing sale', async () => {
    const held = await longTrade();
    await held.stack.saveMark('XYZ', '47.00');

    const result = await sell(held, '100', '47.00', noAnswers(held.stack), { closeReview: { kind: 'Defer' } });

    expect(result).toMatchObject({ kind: 'Rejected', issues: [{ source: 'TradeWorkflows', field: 'closeReasonId', code: 'CloseReasonRequired' }] });
  }, 60_000);

  it('should leave a buy three dispositions as they are', async () => {
    const held = await longTrade();
    const reflectionId = held.stack.reflection.kind === 'Complete' ? held.stack.reflection.form.definitionId : '';
    const buyMember = { ...sellMember(held, '10', '50.00'), action: 'Buy' as const };
    const buyWith = async (reflection: ReflectionDisposition) => {
      const base = await saleCommand(held, '10', '50.00', reflection);
      return held.stack.tradeWorkflows.recordPositionChange({ ...base, members: [buyMember] });
    };

    for (const reflection of [noAnswers(held.stack), { kind: 'Decline', definitionId: reflectionId, reason: 'Routine fill.' } as const, { kind: 'Defer' } as const]) {
      const result = recorded(await buyWith(reflection));
      expect(result.receipt.reflection.kind).toBe({ Complete: 'Entry', Decline: 'Decline', Defer: 'Debt' }[reflection.kind]);
    }
    const owed = (await held.stack.journal.query({ scope: 'OutstandingDebt' })).debts.filter((d) => d.entryTypeKey === 'entry-type.position-change-reflection');
    expect(owed).toHaveLength(1);
    expect(owed[0]).not.toHaveProperty('requires');
  }, 60_000);

  it('should store no measure and create no Deviation', async () => {
    const held = await longTrade();
    await held.stack.saveMark('XYZ', '47.00');
    const before = JSON.stringify(await dumpAll(held.stack.factory));

    const part = recorded(await sell(held, '40', '47.00', withReason(held.stack)));
    const whole = recorded(await sell(held, '60', '47.00', { kind: 'Defer' }, await closing(held)));

    expect(part.receipt.deviationReconciliation).toEqual([]);
    expect(whole.receipt.deviationReconciliation).toEqual([]);
    expect(whole.postCommit.trade.recordedDeviations ?? []).toEqual([]);
    // Neither the Follows nor the Leaves of any sale, nor a reason of either, is in what the commits stored beyond what the stack already held.
    const stored = JSON.stringify(await dumpAll(held.stack.factory));
    expect(stored.length).toBeGreaterThan(before.length);
    expect(stored).not.toMatch(/Follows|Leaves|BeforeCondition|HeldPast|PartOnly/);
  }, 60_000);

  it('should require the reason for a whole sale at a line the Trade held past on an earlier Review Date', async () => {
    const stack = await reviewStack(MONDAY_1700);
    await stack.catalog.seedDefaults(D6_CATALOG_MANIFEST);
    const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00', planTime: '2026-10-05T13:00:00Z' });
    await stack.fill(trade, '2026-10-05T14:00:00Z', '100', '50.00');
    const held = { stack, tradeId: trade.tradeId, plannedLegId: trade.plan.legs[0]!.factId };
    // The Stop was reached on Tuesday, and Tuesday's Review saved Hold; it is reached again at Monday's Marks.
    await stack.saveMark('XYZ', '47.00', '2026-10-06');
    await stack.saveAction(held.tradeId, 'Hold', '2026-10-06');
    await stack.saveMark('XYZ', '47.00', '2026-10-12');

    const result = await sell(held, '100', '47.00', noAnswers(stack), await closing(held));

    expect(result).toMatchObject({ kind: 'Rejected', issues: [{ field: PLAN_DEPARTURE, code: 'PlanDepartureReasonRequired' }] });
  }, 60_000);

  it('should require the reason for a whole sale the next day at a line Monday Review held past while the latest Marks are still Monday', async () => {
    const stack = await reviewStack('2026-10-13T17:00:00Z');
    await stack.catalog.seedDefaults(D6_CATALOG_MANIFEST);
    const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(trade, TEN_AM, '100', '50.00');
    const held = { stack, tradeId: trade.tradeId, plannedLegId: trade.plan.legs[0]!.factId };
    await stack.saveMark('XYZ', '47.00', '2026-10-12');
    await stack.saveAction(held.tradeId, 'Hold', '2026-10-12');
    const base = await saleCommand(held, '100', '47.00', noAnswers(stack), await closing(held));

    const result = await stack.tradeWorkflows.recordPositionChange({ ...base, members: base.members.map((m) => ({ ...m, economicTime: '2026-10-13T15:00:00Z' })) });

    expect(result).toMatchObject({ kind: 'Rejected', issues: [{ field: PLAN_DEPARTURE, code: 'PlanDepartureReasonRequired' }] });
  }, 60_000);

  it('should give the same answer for the same Executions in either order, the earliest one fixing the sale date', async () => {
    const outcome = async (reverse: boolean) => {
      const stack = await reviewStack('2026-10-13T17:00:00Z');
      await stack.catalog.seedDefaults(D6_CATALOG_MANIFEST);
      const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
      await stack.fill(trade, TEN_AM, '100', '50.00');
      const held = { stack, tradeId: trade.tradeId, plannedLegId: trade.plan.legs[0]!.factId };
      await stack.saveMark('XYZ', '47.00', '2026-10-12');
      await stack.saveAction(held.tradeId, 'Hold', '2026-10-12');
      const base = await saleCommand(held, '50', '47.00', noAnswers(stack), await closing(held));
      const members = ['2026-10-12T20:45:00Z', '2026-10-13T15:00:00Z'].map((economicTime) => ({ ...base.members[0]!, economicTime }));
      const result = await stack.tradeWorkflows.recordPositionChange({ ...base, members: reverse ? members.reverse() : members });
      return result.kind;
    };

    // The earliest Execution is on Monday, the day of the Hold, which therefore does not count against the sale.
    expect([await outcome(false), await outcome(true)]).toEqual(['Recorded', 'Recorded']);
  }, 60_000);

  it('should not record a whole sale without its reason when the Exit that excused it becomes a Hold before the commit', async () => {
    const held = await longTrade();
    await held.stack.saveMark('XYZ', '51.00');
    await held.stack.saveAction(held.tradeId, 'Exit', '2026-10-12', 'The thesis broke.');
    // The Trade's latest Action changes to a Hold after the sale was measured, just before its reflection is prepared.
    let changed = false;
    const prepareEffects = held.stack.journal.prepareEffects.bind(held.stack.journal) as (command: { obligation?: string }) => Promise<unknown>;
    const journal = {
      ...held.stack.journal,
      prepareEffects: (async (command: { obligation?: string }) => {
        if (!changed && 'obligation' in command && command.obligation === 'PositionChangeReflection') {
          changed = true;
          await held.stack.saveAction(held.tradeId, 'Hold', '2026-10-13');
        }
        return prepareEffects(command);
      }) as typeof held.stack.journal.prepareEffects,
    };
    const racing = createTradeWorkflows({ ...held.stack, journal, guard: held.stack.guard });
    const command = await saleCommand(held, '100', '51.00', noAnswers(held.stack), await closing(held));

    const result = await racing.recordPositionChange(command);

    expect(result).toMatchObject({ kind: 'Rejected', issues: [{ field: PLAN_DEPARTURE, code: 'PlanDepartureReasonRequired' }] });
  }, 60_000);

  it('should reject a sale whose Economic Time is malformed as an economicTime issue and write nothing', async () => {
    const held = await longTrade();
    await held.stack.saveMark('XYZ', '47.00');
    const before = await dumpAll(held.stack.factory);
    const base = await saleCommand(held, '100', '47.00', noAnswers(held.stack), await closing(held));

    const result = await held.stack.tradeWorkflows.recordPositionChange({ ...base, members: base.members.map((m) => ({ ...m, economicTime: 'not a time' })) });

    expect(result).toMatchObject({ kind: 'Rejected', issues: [{ source: 'TradeWorkflows', member: 0, field: 'economicTime' }] });
    expect(await dumpAll(held.stack.factory)).toEqual(before);
  }, 60_000);

  it('should give the same answer in either order for Economic Times written with a time-zone annotation', async () => {
    const outcome = async (reverse: boolean) => {
      const stack = await reviewStack('2026-10-13T17:00:00Z');
      await stack.catalog.seedDefaults(D6_CATALOG_MANIFEST);
      const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
      await stack.fill(trade, TEN_AM, '100', '50.00');
      const held = { stack, tradeId: trade.tradeId, plannedLegId: trade.plan.legs[0]!.factId };
      await stack.saveMark('XYZ', '47.00', '2026-10-12');
      await stack.saveAction(held.tradeId, 'Hold', '2026-10-12');
      const base = await saleCommand(held, '50', '47.00', noAnswers(stack), await closing(held));
      const members = ['2026-10-12T20:45:00Z[UTC]', '2026-10-13T15:00:00Z[UTC]'].map((economicTime) => ({ ...base.members[0]!, economicTime }));
      const result = await stack.tradeWorkflows.recordPositionChange({ ...base, members: reverse ? members.reverse() : members });
      return result.kind;
    };

    expect([await outcome(false), await outcome(true)]).toEqual(['Recorded', 'Recorded']);
  }, 60_000);

  it('should record a whole sale with no reason when its own price reaches the Stop that the latest Marks have not', async () => {
    const held = await longTrade();
    await held.stack.saveMark('XYZ', '51.00');

    const result = recorded(await sell(held, '100', '47.00', noAnswers(held.stack), await closing(held)));

    expect(result.receipt.reflection.kind).toBe('Entry');
  }, 60_000);
});
