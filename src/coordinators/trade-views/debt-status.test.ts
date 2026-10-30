import { describe, expect, it } from 'vitest';
import { debtFixture, TUESDAY_1700, type DebtFixture, type DebtName } from '../../../tests/support/debt-fixture.ts';
import { fixedClock } from '../../domain/time/index.ts';
import { createTradeViews, type OpenTradeDetail } from './index.ts';

// T5.11: TradeViewsAndReporting.getTradeDetail, against the Debt fixture (Tuesday 2026-10-13 17:00 New York).

const TUESDAY_1200 = '2026-10-13T16:00:00Z';

const ANSWERS = {
  'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
  'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
  'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
} as const;

async function detail(fixture: DebtFixture, tradeId: string, now?: string): Promise<OpenTradeDetail> {
  const { stack } = fixture;
  const views = createTradeViews(now === undefined ? stack : { ...stack, clock: fixedClock(now) });
  const result = await views.getTradeDetail({ tradeId });
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  if (!('positionChanges' in result.view)) throw new Error('expected the Open form of Trade Detail');
  return result.view;
}

function debtItem(view: OpenTradeDetail, fixture: DebtFixture, name: DebtName) {
  const item = view.journal.find((entry) => entry.kind === 'Debt' && entry.id === fixture.debts[name].debtId);
  if (item?.kind !== 'Debt') throw new Error(`no Debt item for ${name}`);
  return item;
}

describe('Debt status (A69)', () => {
  it('should include each Outstanding Debt beside its Position Change with its snapshot revision and status Due, Due in the next Review, or Due in the Review after next (at Tuesday 17:00: D-1 Due, D-6 and D-7 Due in the next Review; at Tuesday 12:00: D-1 Due in the next Review, D-7 Due in the Review after next)', async () => {
    const fixture = await debtFixture();
    const { debts, trades } = fixture;

    const tradeA = await detail(fixture, trades.a);
    const d1 = debtItem(tradeA, fixture, 'D-1');
    expect(d1).toEqual(expect.objectContaining({ positionChangeId: debts['D-1'].origin.factId, revision: debts['D-1'].revision, definitionId: debts['D-1'].definitionId, dueStatus: 'Due' }));
    expect(debtItem(tradeA, fixture, 'D-2').dueStatus).toBe('Due');
    expect(debtItem(tradeA, fixture, 'D-7').dueStatus).toBe('DueInNextReview');
    expect(debtItem(await detail(fixture, trades.h), fixture, 'D-6').dueStatus).toBe('DueInNextReview');

    const midday = await detail(fixture, trades.a, TUESDAY_1200);
    expect(debtItem(midday, fixture, 'D-1').dueStatus).toBe('DueInNextReview');
    expect(debtItem(midday, fixture, 'D-7').dueStatus).toBe('DueInReviewAfterNext');
  }, 60_000);

  it('should show a settled Debt once, inside its Entry item marked deferred and answered with authored time and Source, and a declined Debt once, inside its decline item', async () => {
    const fixture = await debtFixture();
    const { stack, debts, trades } = fixture;
    const d1 = debts['D-1'];
    const d2 = debts['D-2'];
    const answered = await stack.journal.save({ intention: 'ResolveDebt', debtId: d1.debtId, expectedDebtRevision: d1.revision, resolution: { kind: 'Answer', form: { definitionId: d1.definitionId, answers: ANSWERS } } });
    expect(answered.kind).toBe('Saved');
    const declined = await stack.journal.save({ intention: 'ResolveDebt', debtId: d2.debtId, expectedDebtRevision: d2.revision, resolution: { kind: 'Decline', reason: 'No view at the time.' } });
    expect(declined.kind).toBe('Saved');

    const view = await detail(fixture, trades.a);

    const forD1 = view.journal.filter((item) => item.kind !== 'Decline' && 'positionChangeId' in item && item.positionChangeId === d1.origin.factId);
    expect(forD1).toEqual([
      expect.objectContaining({
        kind: 'Entry',
        authoredTime: TUESDAY_1700,
        source: expect.stringMatching(/Trade Detail|source\.trade-detail/) as unknown,
        answeredLater: { debtId: d1.debtId, dueAnchor: d1.dueAnchor },
      }),
    ]);
    const forD2 = view.journal.filter((item) => 'positionChangeId' in item && item.positionChangeId === d2.origin.factId);
    expect(forD2).toEqual([expect.objectContaining({ kind: 'Decline', reason: 'No view at the time.', declinedLater: { debtId: d2.debtId, dueAnchor: d2.dueAnchor } })]);
    expect(view.journal.filter((item) => item.kind === 'Debt').map((item) => item.id)).toEqual([debts['D-7'].debtId]);
  }, 60_000);

  it('should include an Outstanding Debt with no due classification when the as-of date is outside session-policy coverage', async () => {
    const fixture = await debtFixture();
    const { debts, trades } = fixture;

    // Session-policy coverage starts on 2024-01-01 (decision 51).
    const view = await detail(fixture, trades.a, '2023-06-01T15:00:00Z');

    expect(view.journal.filter((item) => item.kind === 'Debt')).toEqual(
      ['D-1', 'D-2', 'D-7'].map((name) => expect.objectContaining({ id: debts[name as DebtName].debtId, revision: debts[name as DebtName].revision }) as unknown),
    );
    for (const item of view.journal) if (item.kind === 'Debt') expect(item).not.toHaveProperty('dueStatus');
  }, 60_000);
});
