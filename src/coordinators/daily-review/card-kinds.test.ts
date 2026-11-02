import { describe, expect, it } from 'vitest';
import { derive, type TradeAnalysisRecord } from '../../domain/trade-analysis/index.ts';
import { parseDecimal, Rational } from '../../domain/values/index.ts';
import { reflectionsOwedProgress } from '../../../tests/support/card-progress.ts';
import { closedTradeReviewFixture, TUESDAY_1700 } from '../../../tests/support/closed-trade-review-fixture.ts';
import type { GetDailyTradeReviewResult, OpenDailyReviewResult } from './index.ts';

const decimal = (text: string): Rational => {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`not a decimal: ${text}`);
  return parsed.value;
};

function ready(result: OpenDailyReviewResult) {
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result;
}

function owedCard(result: GetDailyTradeReviewResult) {
  if (result.kind !== 'ReflectionsOwed') throw new Error(`expected ReflectionsOwed, got ${result.kind}`);
  return result.card;
}

function walkedCard(result: GetDailyTradeReviewResult) {
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result.trade;
}

describe('owed-reflection cards (A90)', () => {
  it('should return T-M and T-Q as ReflectionsOwed cards: T-M with its Closed summary and its owed Close Review, T-Q with its Open summary and its owed Position Change Reflection, each with its snapshot form and save binding, and neither with an Action form or evaluation', async () => {
    const { stack, trades, debts } = await closedTradeReviewFixture();
    const review = ready(await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 }));
    const open = (name: 'M' | 'Q') => stack.dailyReview.getTrade({ reviewDate: review.reviewDate, tradeId: trades[name]!, binding: review.binding });
    const debtOf = (name: 'M' | 'Q') => debts.find((debt) => debt.anchor.tradeId === trades[name])!;
    const stored = async (name: 'M' | 'Q'): Promise<TradeAnalysisRecord> => {
      const found = await stack.tradeRecord.getRecord({ tradeId: trades[name]!, projection: 'AnalysisInput' });
      if (found.kind !== 'Found') throw new Error('no Trade');
      return found.projection as TradeAnalysisRecord;
    };

    // T-M: Closed Monday 15:00 with its Close Review deferred, due now.
    const m = owedCard(await open('M'));
    const storedM = await stored('M');
    const derivedM = derive({ record: storedM });
    if (derivedM.kind !== 'Derived') throw new Error('T-M facts are coherent');
    const reasons = await stack.catalog.query({ family: 'CloseReason' });
    if (reasons.kind !== 'Page') throw new Error('no Close Reasons');
    const closeReason = reasons.items[0]!;
    expect(m.tradeId).toBe(trades.M);
    expect(m.underlying).toBe('MNP');
    expect(m.lifecycle).toBe('Closed');
    expect(m.summary).toEqual({
      kind: 'Closed',
      // Bought 100 at 40.00 with a 1.00 fee, sold at 41.00 with a 0.60 fee.
      realizedPnl: decimal('98.40'),
      realizedR: derivedM.realizedR,
      terminalDisposition: { kind: 'Value', value: [{ mechanism: 'Executions', quantity: Rational.of(100n) }] },
      closeReason: { id: closeReason.id, label: closeReason.label },
      terminalTime: '2026-10-12T19:00:00Z',
    });
    expect(derivedM.realizedR.kind).toBe('Value');
    const debtM = debtOf('M');
    expect(m.reflections).toEqual([
      {
        debtId: debtM.debtId,
        definition: expect.objectContaining({ id: debtM.definitionId }) as unknown,
        economicTime: debtM.momentTime,
        executions: [expect.objectContaining({ action: 'Sell', quantity: '100', price: '41.00' }) as unknown],
        classification: 'Due',
        saveBinding: { debtId: debtM.debtId, debtRevision: debtM.revision, definitionRevision: debtM.definitionId },
      },
    ]);
    expect(m.progress).toEqual(reflectionsOwedProgress(1, 0));

    // T-Q: bought after the close, its Position Change Reflection deferred, not yet due.
    const q = owedCard(await open('Q'));
    const derivedQ = derive({ record: await stored('Q') });
    if (derivedQ.kind !== 'Derived') throw new Error('T-Q facts are coherent');
    expect(q.lifecycle).toBe('Open');
    expect(q.summary).toEqual({
      kind: 'Open',
      position: { kind: 'Stock', direction: 'Long', quantity: Rational.of(100n), price: Rational.of(10n) },
      entryResolution: derivedQ.entryResolution,
    });
    const debtQ = debtOf('Q');
    expect(q.reflections).toEqual([
      {
        debtId: debtQ.debtId,
        definition: expect.objectContaining({ id: debtQ.definitionId }) as unknown,
        economicTime: debtQ.momentTime,
        executions: [expect.objectContaining({ action: 'Buy', quantity: '100', price: '10.00' }) as unknown],
        classification: 'DueInReviewAfterNext',
        saveBinding: { debtId: debtQ.debtId, debtRevision: debtQ.revision, definitionRevision: debtQ.definitionId },
      },
    ]);
    expect(q.progress).toEqual(reflectionsOwedProgress(0, 1));

    // Neither card has an Action form or an evaluation.
    for (const card of [m, q]) {
      for (const key of ['form', 'evaluation', 'frame', 'datedLastClose', 'attention']) expect(card).not.toHaveProperty(key);
    }
  }, 60_000);
});

describe('reflections in due-anchor order', () => {
  // The text of the later moment sorts before the earlier one ('.' before 'Z'), so the Journal's index lists the later Debt first.
  async function twoDeferredBuys(earlier: string, later: string) {
    const { stack } = await closedTradeReviewFixture({ only: [] });
    const trade = await stack.confirm({ shares: '100', symbol: 'QST', entry: '10.00', stop: '9.00', target: '12.00', planTime: '2026-10-13T13:00:00Z' });
    await stack.fill(trade, earlier, '50', '10.00', { kind: 'Defer' });
    await stack.fill(trade, later, '50', '10.00', { kind: 'Defer' });
    const indexOrder = (await stack.journal.query({ scope: 'OutstandingDebt' })).debts.map((debt) => debt.dueAnchor);
    expect(indexOrder).toEqual([later, earlier]);
    return { stack, tradeId: trade.tradeId };
  }

  it('should list the reflections of an owed-reflection card in due-anchor order as instants', async () => {
    // Both buys come after the Tuesday cutoff, so the Trade is outside the walk and the Review is Empty with the owed group attached.
    const earlier = '2026-10-13T20:10:00Z';
    const later = '2026-10-13T20:10:00.500Z';
    const { stack, tradeId } = await twoDeferredBuys(earlier, later);
    const review = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 });
    if (review.kind !== 'Empty') throw new Error(`expected Empty, got ${review.kind}`);

    const card = owedCard(await stack.dailyReview.getTrade({ reviewDate: review.reviewDate, tradeId, binding: review.binding }));
    expect(card.reflections.map((reflection) => reflection.economicTime)).toEqual([earlier, later]);
  }, 60_000);

  it('should list the reflections of a walked card in due-anchor order as instants', async () => {
    // Both buys come before the Tuesday cutoff, so the Trade is walked.
    const earlier = '2026-10-13T14:00:00Z';
    const later = '2026-10-13T14:00:00.500Z';
    const { stack, tradeId } = await twoDeferredBuys(earlier, later);
    const review = ready(await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 }));

    const trade = walkedCard(await stack.dailyReview.getTrade({ reviewDate: review.reviewDate, tradeId, binding: review.binding }));
    expect(trade.reflections.map((reflection) => reflection.economicTime)).toEqual([earlier, later]);
  }, 60_000);
});

describe('walked cards (A91, A94)', () => {
  it('should return the Action form and cutoff evaluation of T-N with its current lifecycle Closed and no exit route, and those of T-A with an exit route naming its remaining 70 shares', async () => {
    const { stack, trades } = await closedTradeReviewFixture();
    const review = ready(await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 }));
    const open = (name: 'A' | 'N') => stack.dailyReview.getTrade({ reviewDate: review.reviewDate, tradeId: trades[name]!, binding: review.binding });

    // T-N was sold after the close: the card describes the Position held at the cutoff, and the Trade is now Closed.
    const n = walkedCard(await open('N'));
    expect(n.lifecycle).toBe('Closed');
    expect(n.form.kind).toBe('Saved');
    expect(n.evaluation).toEqual(expect.objectContaining({ openQuantity: { kind: 'Value', value: Rational.of(100n) } }));
    expect(n).not.toHaveProperty('exitRoute');

    // T-A still holds 70 of its 100 shares.
    const a = walkedCard(await open('A'));
    expect(a.lifecycle).toBe('Open');
    expect(a.form.kind).toBe('Saved');
    expect(a.evaluation).toEqual(expect.objectContaining({ openQuantity: { kind: 'Value', value: Rational.of(70n) } }));
    expect(a.exitRoute).toEqual({ remainingQuantity: Rational.of(70n) });
  }, 60_000);
});
