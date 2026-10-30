// I5.5: when a deferred reflection falls due in the Review (P16, A63, AC-REV-006 partial). The Debt
// fixture is built through the real module APIs (tests/support/debt-fixture.ts); `open` is called on
// the Daily Review with the Review's own as-of instant.
import { describe, expect, it } from 'vitest';
import { createDailyReview, type OpenDailyReviewResult } from '../../../src/coordinators/daily-review/index.ts';
import { nyseSessionPolicy } from '../../../src/domain/session-policy/index.ts';
import { fixedClock } from '../../../src/domain/time/index.ts';
import { createMarketData } from '../../../src/modules/market-data/index.ts';
import { debtFixture, TUESDAY_1700, TUESDAY_REVIEW_DATE, type DebtFixture, type DebtName } from '../../support/debt-fixture.ts';
import { ELEVEN_AM, reviewStack } from '../../support/review-fixture.ts';
import { sequentialIds } from '../../support/workspace.ts';

const MONDAY_1700 = '2026-10-12T21:00:00Z';
const WEDNESDAY_1700 = '2026-10-14T21:00:00Z';
// Tuesday 20:00 America/New_York, after the Tuesday Review's cutoff.
const TUESDAY_2000 = '2026-10-14T00:00:00Z';
const TUESDAY_ELEVEN_AM = '2026-10-13T15:00:00Z';

function ready(result: OpenDailyReviewResult) {
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result;
}

// The Review the Debt fixture's Workspace presents at `asOf`, by a Daily Review whose Market Data
// reads the clock at that instant.
function reviewAt(fixture: DebtFixture, asOf: string) {
  const { stack } = fixture;
  const marketData = createMarketData({ persistence: stack.persistence, ids: sequentialIds('md-at'), clock: fixedClock(asOf), sessionPolicy: nyseSessionPolicy });
  return createDailyReview({ ...stack, marketData });
}

async function openAt(fixture: DebtFixture, asOf: string) {
  return ready(await reviewAt(fixture, asOf).open({ date: { kind: 'LatestCompleted' }, asOf }));
}

// The Debts the Review marks Due, in the order the Review presents them (T5.8): the Trades in the
// walk's order, and within each Trade's card the reflections in anchor order. The order is taken
// from the Review's own cards, never re-sorted by the Journal.
async function dueDebts(fixture: DebtFixture, asOf: string): Promise<DebtName[]> {
  const review = reviewAt(fixture, asOf);
  const opened = ready(await review.open({ date: { kind: 'LatestCompleted' }, asOf }));
  const due: string[] = [];
  for (const family of opened.families) {
    if (family.family !== 'Trades') continue;
    for (const item of family.trades) {
      const card = await review.getTrade({ reviewDate: opened.reviewDate, tradeId: item.tradeId, binding: opened.binding });
      if (card.kind !== 'Ready') throw new Error(`getTrade: ${card.kind}`);
      for (const reflection of card.trade.reflections) if (reflection.classification === 'Due') due.push(reflection.debtId);
    }
  }
  const names = Object.entries(fixture.debts).map(([name, debt]) => [debt.debtId, name as DebtName] as const);
  return due.map((debtId) => names.find(([id]) => id === debtId)![1]);
}

const dueCount = (review: ReturnType<typeof ready>) =>
  review.families.flatMap((f) => (f.family === 'Trades' ? f.trades : [])).reduce((sum, trade) => sum + trade.reflections.due, 0);

describe('I5.5 Due timing', () => {
  it('should list D-3 alone on Monday, five Debts in the T5.8 order on Tuesday without D-6 and D-7, and add D-6 and D-7 on Wednesday', async () => {
    const fixture = await debtFixture();

    const monday = await openAt(fixture, MONDAY_1700);
    expect(dueCount(monday)).toBe(1);
    expect(await dueDebts(fixture, MONDAY_1700)).toEqual(['D-3']);

    const tuesday = await openAt(fixture, TUESDAY_1700);
    expect(dueCount(tuesday)).toBe(5);
    // The Review's own order: Trades in the walk's order (T-A, T-F, T-G, T-E), anchor order within a card.
    expect(await dueDebts(fixture, TUESDAY_1700)).toEqual(['D-1', 'D-2', 'D-3', 'D-5', 'D-4']);
    const tuesdayReasons = tuesday.completion.kind === 'Incomplete' ? tuesday.completion.reasons : [];
    expect(tuesdayReasons.flatMap((reason) => (reason.code === 'ReflectionDue' ? reason.debtIds : []))).toEqual(
      ['D-1', 'D-2', 'D-3', 'D-5', 'D-4'].map((name) => fixture.debts[name as DebtName].debtId),
    );
    // The Journal's own list is by due anchor, then Debt identity, and D-6 and D-7 are owed but not yet due.
    const outstanding = await fixture.stack.journal.query({ scope: 'OutstandingDebt' });
    expect(outstanding.debts.map((d) => d.debtId)).toEqual(['D-3', 'D-1', 'D-4', 'D-2', 'D-5', 'D-6', 'D-7'].map((name) => fixture.debts[name as DebtName].debtId));

    const wednesday = await openAt(fixture, WEDNESDAY_1700);
    expect(dueCount(wednesday)).toBe(7);
    expect(await dueDebts(fixture, WEDNESDAY_1700)).toEqual(['D-1', 'D-2', 'D-7', 'D-6', 'D-5', 'D-4', 'D-3']);
  }, 60_000);

  it('should leave a completed Tuesday Review Complete after a Tuesday-dated deferral, turn it Incomplete naming a Monday-dated one, and complete it again when answered', async () => {
    const stack = await reviewStack(TUESDAY_1700);
    const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(trade, '2026-10-12T14:00:00Z', '60', '50.10');
    await stack.saveMark('XYZ', '52.00', TUESDAY_REVIEW_DATE);
    await stack.saveAction(trade.tradeId, 'Hold', TUESDAY_REVIEW_DATE);
    const open = async () => ready(await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_2000 }));
    expect((await open()).completion).toEqual({ kind: 'Complete' });

    // A Tuesday-dated deferral belongs to Tuesday's own session: it falls due in Wednesday's Review.
    await stack.fill(trade, TUESDAY_ELEVEN_AM, '40', '50.30', { kind: 'Defer' });
    const afterTuesday = await open();
    expect(afterTuesday.completion).toEqual({ kind: 'Complete' });
    expect(afterTuesday.families.flatMap((f) => (f.family === 'Trades' ? f.trades.map((t) => t.reflections) : []))).toEqual([{ due: 0, later: 1 }]);

    // A Monday-dated deferral is due at once and reopens the completed Tuesday Review.
    await stack.fill(trade, ELEVEN_AM, '10', '50.20', { kind: 'Defer' });
    const monday = (await stack.journal.query({ scope: 'OutstandingDebt' })).debts.find((debt) => debt.momentTime === ELEVEN_AM)!;
    const reopened = await open();
    expect(reopened.completion).toEqual({ kind: 'Incomplete', reasons: [{ code: 'ReflectionDue', tradeId: trade.tradeId, debtIds: [monday.debtId] }] });

    const answers = {
      'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
      'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
      'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
    } as const;
    const answered = await stack.journal.save({
      intention: 'ResolveDebt',
      debtId: monday.debtId,
      expectedDebtRevision: monday.revision,
      resolution: { kind: 'Answer', form: { definitionId: monday.definitionId, answers } },
    });
    expect(answered.kind).toBe('Saved');
    expect((await open()).completion).toEqual({ kind: 'Complete' });
  }, 60_000);
});
