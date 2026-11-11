import { describe, expect, it } from 'vitest';
import { instrumentKey } from '../../domain/instrument/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { D5_JOURNAL_MANIFEST, type ReflectionDisposition } from '../../modules/journal/index.ts';
import type { MarketData, MarketDataReadSession } from '../../modules/market-data/index.ts';
import { D7_CATALOG_MANIFEST, type StrategyRecord } from '../../modules/reference-catalog/index.ts';
import { reviewStack } from '../../../tests/support/review-fixture.ts';
import type { ConfirmPlanCommand, ExpirationMember, PositionChangeMember } from '../trade-workflows/index.ts';
import { createTradeViews, type ClosedTradeDetail, type ClosedTradeItem, type OpenTradeDetail, type PlannedTradeDetail, type ReadViewResult, type TradeDetailView } from './index.ts';

// D7 section 4: O-S (Cash-Secured Put on MNO) and O-C (Long Call on XYZ). Every contract expires Friday
// 2026-11-20; New York is on standard time from 11-01, so 16:00 is 21:00Z and 17:00 is 22:00Z.
const THURSDAY_1700 = '2026-11-19T22:00:00Z';
const FRIDAY_1600 = '2026-11-20T21:00:00Z';
const FRIDAY_1700 = '2026-11-20T22:00:00Z';
const MONDAY_NOV_23_1700 = '2026-11-23T22:00:00Z';
const MONDAY_PLAN = '2026-10-12T13:00:00Z';
const MONDAY_10 = '2026-10-12T14:00:00Z';
const MONDAY_11 = '2026-10-12T15:00:00Z';
const TUESDAY_10 = '2026-10-13T14:00:00Z';

const XYZ_CALL = { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', right: 'Call', strike: '55', multiplier: 100 } as const;
const MNO_PUT = { kind: 'Option', symbol: 'MNO', root: 'MNO', expiration: '2026-11-20', right: 'Put', strike: '45', multiplier: 100 } as const;
type Contract = typeof XYZ_CALL | typeof MNO_PUT;

const money = (text: string) => {
  const [whole, cents = ''] = text.split('.');
  return Rational.of(BigInt(`${whole}${cents.padEnd(2, '0')}`), 100n);
};

// The Market Data whose read sessions answer as the real ones do, except for the methods `wrap` replaces (decision 103).
const withSession = <M extends { openReadSession(context: Parameters<MarketData['openReadSession']>[0]): Promise<MarketDataReadSession> }>(marketData: M, wrap: (session: MarketDataReadSession) => Partial<MarketDataReadSession>): M => ({
  ...marketData,
  openReadSession: async (context: Parameters<MarketData['openReadSession']>[0]) => {
    const session = await marketData.openReadSession(context);
    return { ...session, ...wrap(session) };
  },
});

async function optionStack(now: string) {
  const stack = await reviewStack(now);
  await stack.catalog.seedDefaults(D7_CATALOG_MANIFEST);
  await stack.journal.seedDefaults(D5_JOURNAL_MANIFEST);
  const strategies = await stack.catalog.query({ family: 'Strategy' });
  if (strategies.kind !== 'Page') throw new Error('no strategies');
  // Looked up by product key, never by position in the list.
  const strategyOf = (productKey: string): StrategyRecord => {
    const found = strategies.items.find((s): s is StrategyRecord => s.kind === 'Strategy' && s.productKey === productKey);
    if (!found) throw new Error(`no ${productKey}`);
    return found;
  };
  const closeReview = await stack.journal.getDefinitions({ latestFor: 'entry-type.close-review' });
  if (closeReview.kind !== 'Found') throw new Error('no Close Review definition');
  const closeReviewForm: ReflectionDisposition = {
    kind: 'Complete',
    form: { definitionId: closeReview.definition.id, answers: { 'prompt.close-review.take-again': { kind: 'Option', optionId: 'option.close-review.take-again.yes-as-planned' } } },
  };
  const planReflection = {
    definitionId: stack.definition.id,
    answers: { 'prompt.plan-reflection.thesis': { kind: 'Text', text: 'The setup is worth the risk.' }, 'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close beyond the stop.' } },
  } as const;

  const confirm = async (productKey: string, plan: ConfirmPlanCommand['plan']) => {
    const strategy = strategyOf(productKey);
    const confirmed = await stack.tradeWorkflows.confirmPlan({ accountId: stack.account.id, accountRevision: stack.account.recordRevision, strategyId: strategy.id, strategyRevision: strategy.recordRevision, economicTime: MONDAY_PLAN, plan, reflection: planReflection });
    if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${confirmed.kind}`);
    return confirmed.postCommit.trade.tradeId;
  };
  const record = async (tradeId: string, members: (legId: string) => PositionChangeMember[] | ExpirationMember[], closeReviewDisposition?: ReflectionDisposition) => {
    const current = await stack.tradeRecord.getRecord({ tradeId, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error('no Trade');
    const legId = (current.projection as unknown as { plan: { legs: { factId: string }[] } }).plan.legs[0]!.factId;
    const result = await stack.tradeWorkflows.recordPositionChange({
      originTradeId: tradeId,
      trades: [{ tradeId, expectedFactRevision: current.factRevision }],
      members: members(legId),
      reflection: stack.reflection,
      ...(closeReviewDisposition && { closeReview: closeReviewDisposition }),
    });
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${JSON.stringify(result)}`);
  };
  const fill = (tradeId: string, instrument: Contract, action: 'Buy' | 'Sell', economicTime: string, quantity: string, price: string, fee: string) => (legId: string): PositionChangeMember[] => [
    { kind: 'Execution', tradeId, action, instrument, intent: { kind: 'ServesPlannedLeg', plannedLegId: legId }, quantity, price, fee, economicTime },
  ];
  const expire = (tradeId: string, instrument: Contract, quantity: string) => () => [{ kind: 'Expiration', tradeId, instrument, quantity, economicTime: FRIDAY_1600 } as const];

  const planOS = (): ConfirmPlanCommand['plan'] => ({ underlying: 'MNO', legs: [{ side: 'Short', instrument: MNO_PUT, quantity: '-2', intendedEntry: '1.20' }], stops: [{ kind: 'UnderlyingPrice', price: '42.00' }], targets: [{ kind: 'UnderlyingPrice', price: '50.00' }] });
  const planOC = (): ConfirmPlanCommand['plan'] => ({ underlying: 'XYZ', legs: [{ side: 'Long', instrument: XYZ_CALL, quantity: '2', intendedEntry: '2.00' }], stops: [{ kind: 'UnderlyingPrice', price: '48.00' }], targets: [{ kind: 'UnderlyingPrice', price: '60.00' }], exerciseIntent: 'NotAuthorized' });

  // O-S through S1: 2 short MNO puts.
  const openCashSecuredPut = async () => {
    const tradeId = await confirm('strategy.cash-secured-put', planOS());
    await record(tradeId, fill(tradeId, MNO_PUT, 'Sell', MONDAY_10, '2', '1.25', '1.30'));
    return tradeId;
  };
  // O-C through PC1, PC2 and X1, leaving 1 contract.
  const openLongCall = async () => {
    const tradeId = await confirm('strategy.long-call', planOC());
    await record(tradeId, fill(tradeId, XYZ_CALL, 'Buy', MONDAY_10, '1', '2.10', '0.65'));
    await record(tradeId, fill(tradeId, XYZ_CALL, 'Buy', MONDAY_11, '1', '1.90', '0.65'));
    await record(tradeId, fill(tradeId, XYZ_CALL, 'Sell', TUESDAY_10, '1', '3.00', '0.65'));
    return tradeId;
  };
  // O-C through PC1 and PC2 (Monday), 2 contracts.
  const openLongCallAtMonday = async () => {
    const tradeId = await confirm('strategy.long-call', planOC());
    await record(tradeId, fill(tradeId, XYZ_CALL, 'Buy', MONDAY_10, '1', '2.10', '0.65'));
    await record(tradeId, fill(tradeId, XYZ_CALL, 'Buy', MONDAY_11, '1', '1.90', '0.65'));
    return tradeId;
  };
  const closeLongCall = async () => {
    const tradeId = await openLongCall();
    await record(tradeId, expire(tradeId, XYZ_CALL, '1'), closeReviewForm);
    return tradeId;
  };
  // O-S through S1 and E-S: both contracts expired.
  const closeCashSecuredPut = async () => {
    const tradeId = await openCashSecuredPut();
    await record(tradeId, expire(tradeId, MNO_PUT, '2'), closeReviewForm);
    return tradeId;
  };
  return { stack, tradeViews: createTradeViews(stack), strategyOf, confirm, record, fill, planOC, openCashSecuredPut, openLongCall, openLongCallAtMonday, closeLongCall, closeCashSecuredPut };
}

function openDetail(result: ReadViewResult<TradeDetailView>): OpenTradeDetail {
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result.view as OpenTradeDetail;
}

describe('getTradeDetail: option Trades (AC-SET-003, A119)', () => {
  it('should return O-S at Friday 17:00 with stored lifecycle Open, no Expiration fact, a Settlement Due item with settlement time Friday 16:00, and both payoff views, and at Thursday 17:00 the same Trade with the expiration date, no item, and its value at expiration at MNO Thursday close', async () => {
    const friday = await optionStack(FRIDAY_1700);
    const tradeId = await friday.openCashSecuredPut();

    const onExpiration = openDetail(await friday.tradeViews.getTradeDetail({ tradeId }));

    expect(onExpiration.lifecycle.stored).toBe('Open');
    expect(onExpiration.positionChanges.flatMap((change) => change.settlements ?? [])).toEqual([]);
    expect(onExpiration.settlement).toEqual([{ tradeId, instrument: MNO_PUT, quantity: Rational.of(-2n), expiration: '2026-11-20', settlementTime: { kind: 'Value', value: FRIDAY_1600 } }]);
    expect(onExpiration.payoff.planned.kind).toBe('Value');
    expect(onExpiration.payoff.current.kind).toBe('Value');

    const thursday = await optionStack(THURSDAY_1700);
    const thursdayId = await thursday.openCashSecuredPut();
    await thursday.stack.saveMark('MNO', '46.00', '2026-11-19');

    const before = openDetail(await thursday.tradeViews.getTradeDetail({ tradeId: thursdayId }));

    expect(before.lifecycle.stored).toBe('Open');
    expect(before.settlement).toEqual([]);
    expect(before.current.evaluation.settlement).toEqual([expect.objectContaining({ expiration: '2026-11-20', status: 'NotYetDue' })]);
    expect(before.current.evaluation.expirationValueAtUnderlyingClose).toEqual({ kind: 'Value', value: { underlyingPrice: money('46.00'), value: money('248.70') } });
  }, 60_000);

  it('should return O-C after E1 as Closed with Terminal Disposition and Option Disposition Timing Mixed with both quantities, no Close Reason, Exercise Intent NotAuthorized, the Planned payoff, Current NotApplicable NoRemainingPosition, and no Mark requirement', async () => {
    const { tradeViews, closeLongCall } = await optionStack(FRIDAY_1700);
    const tradeId = await closeLongCall();
    const trade = openDetail(await tradeViews.getTradeDetail({ tradeId })) as ClosedTradeDetail;

    expect(trade.lifecycle.stored).toBe('Closed');
    expect(trade.terminalDisposition).toEqual({
      kind: 'Value',
      value: [
        { mechanism: 'Executions', quantity: Rational.of(1n) },
        { mechanism: 'Expiration', quantity: Rational.of(1n) },
      ],
    });
    expect(trade.optionDispositionTiming).toEqual({ kind: 'Value', value: { timing: 'Mixed', disposedByExecutions: Rational.of(1n), disposedBySettlement: Rational.of(1n) } });
    expect(trade.closeReason).toBeUndefined();
    expect(trade.plan.exerciseIntent).toBe('NotAuthorized');
    expect(trade.payoff.planned.kind).toBe('Value');
    expect(trade.payoff.current).toEqual({ kind: 'NotApplicable', reason: 'NoRemainingPosition' });
    expect(trade.settlement).toEqual([]);
    // Nothing is held, so no Mark is wanted and none was read: the Closed form has no Expected Mark Date or Mark.
    expect(trade.current.expectedMarkDate).toBeUndefined();
    expect(trade.current.mark).toBeUndefined();
    expect(trade.current.evaluation.expirationValueAtUnderlyingClose).toEqual({ kind: 'NotApplicable', reason: 'NoRemainingPosition' });
  }, 60_000);
});

describe('getTradeDetail: option Underlying Mark (T7.23-B1)', () => {
  it('should carry the Underlying Mark with its price and provenance on an open option Detail apart from the contract Mark', async () => {
    const thursday = await optionStack(THURSDAY_1700);
    const tradeId = await thursday.openCashSecuredPut();
    await thursday.stack.saveMark('MNO', '46.00', '2026-11-19');

    const detail = openDetail(await thursday.tradeViews.getTradeDetail({ tradeId }));

    expect(detail.current.underlyingMark).toEqual(expect.objectContaining({ source: 'Manual', price: '46' }));
  }, 60_000);
});

describe('getTradeDetail: option dated line (T7.30-B3)', () => {
  it('should add the dated line from Monday close valuing 2 contracts at the call Mark 2.20 with XYZ at 52.00 when Tuesday has neither Mark, on Detail and on the Open list item', async () => {
    const tuesday = await optionStack('2026-10-13T21:00:00Z');
    const tradeId = await tuesday.openLongCallAtMonday();
    await tuesday.stack.saveMark(instrumentKey(XYZ_CALL), '2.20', '2026-10-12');
    await tuesday.stack.saveMark('XYZ', '52.00', '2026-10-12');

    const detail = openDetail(await tuesday.tradeViews.getTradeDetail({ tradeId }));
    const line = detail.current.datedLine;
    expect(line?.tradingDate).toBe('2026-10-12');
    if (line?.evaluation.kind !== 'Evaluated') throw new Error('the dated line has no evaluation');
    expect(line.evaluation.marketValue).toEqual({ kind: 'Value', value: Rational.of(440n) });
    expect(line.evaluation.remainingOpenPnl).toEqual({ kind: 'Value', value: money('38.70') });
    const list = await tuesday.tradeViews.browseTrades({ lifecycle: 'Open' });
    if (list.kind !== 'Ready') throw new Error('list not ready');
    expect(list.view.items).toEqual([expect.objectContaining({ tradeId, current: expect.objectContaining({ datedLine: expect.objectContaining({ tradingDate: '2026-10-12' }) as unknown }) as unknown })]);
  }, 60_000);
});

describe('getTradeDetail: option dated line pairs the Underlying Mark at the dated close (T7.30-B3-R1)', () => {
  const lineOf = (detail: OpenTradeDetail) => {
    const line = detail.current.datedLine;
    if (line?.evaluation.kind !== 'Evaluated') throw new Error('the dated line has no evaluation');
    return line.evaluation;
  };
  const stopReading = (evaluation: ReturnType<typeof lineOf>) => evaluation.conditions.find((c) => c.role === 'Stop')!.result;

  it('should value the Monday dated line with XYZ Monday Mark 52.00 when the call is Missing on Tuesday and XYZ is marked on both days', async () => {
    const tuesday = await optionStack('2026-10-13T21:00:00Z');
    const tradeId = await tuesday.openLongCallAtMonday();
    await tuesday.stack.saveMark(instrumentKey(XYZ_CALL), '2.20', '2026-10-12');
    await tuesday.stack.saveMark('XYZ', '52.00', '2026-10-12');
    await tuesday.stack.saveMark('XYZ', '53.00', '2026-10-13');

    const detail = openDetail(await tuesday.tradeViews.getTradeDetail({ tradeId }));

    expect(detail.current.datedLine?.tradingDate).toBe('2026-10-12');
    const stop = stopReading(lineOf(detail));
    if (stop.kind !== 'Value') throw new Error(`expected a Value, got ${stop.kind}`);
    expect(stop.value.evidence.mark.price).toBe('52');
    const list = await tuesday.tradeViews.browseTrades({ lifecycle: 'Open' });
    if (list.kind !== 'Ready') throw new Error('list not ready');
    expect(list.view.items).toEqual([expect.objectContaining({ current: expect.objectContaining({ datedLine: expect.objectContaining({ tradingDate: '2026-10-12' }) as unknown }) as unknown })]);
  }, 60_000);

  it('should add no dated line when the call is Available on Tuesday and XYZ is Missing, since D4 gives the current figures no earlier close to show', async () => {
    const tuesday = await optionStack('2026-10-13T21:00:00Z');
    const tradeId = await tuesday.openLongCallAtMonday();
    await tuesday.stack.saveMark(instrumentKey(XYZ_CALL), '2.30', '2026-10-13');
    await tuesday.stack.saveMark('XYZ', '52.00', '2026-10-12');

    const detail = openDetail(await tuesday.tradeViews.getTradeDetail({ tradeId }));

    expect(detail.current.datedLine).toBeUndefined();
  }, 60_000);

  it('should keep the Monday dated line with the contract-only figures as Values and the Underlying-dependent figures Unavailable MarkMissing for XYZ on Monday when only XYZ has no Monday Mark', async () => {
    const tuesday = await optionStack('2026-10-13T21:00:00Z');
    const tradeId = await tuesday.openLongCallAtMonday();
    await tuesday.stack.saveMark(instrumentKey(XYZ_CALL), '2.20', '2026-10-12');
    await tuesday.stack.saveMark('XYZ', '53.00', '2026-10-13');

    const detail = openDetail(await tuesday.tradeViews.getTradeDetail({ tradeId }));

    expect(detail.current.datedLine?.tradingDate).toBe('2026-10-12');
    const evaluation = lineOf(detail);
    expect(evaluation.marketValue).toEqual({ kind: 'Value', value: Rational.of(440n) });
    expect(evaluation.remainingOpenPnl).toEqual({ kind: 'Value', value: money('38.70') });
    expect(stopReading(evaluation)).toEqual({ kind: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'XYZ' }, date: '2026-10-12' });
    expect(evaluation.incrementalRewardToTarget).toEqual({ kind: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'XYZ' }, date: '2026-10-12' });
  }, 60_000);

  it('should value the at-entry path dated line at the Tuesday close with XYZ Tuesday Mark when a contract was bought after that close', async () => {
    const afterClose = await optionStack('2026-10-13T22:00:00Z');
    const tradeId = await afterClose.confirm('strategy.long-call', afterClose.planOC());
    await afterClose.record(tradeId, afterClose.fill(tradeId, XYZ_CALL, 'Buy', MONDAY_10, '1', '2.10', '0.65'));
    await afterClose.record(tradeId, afterClose.fill(tradeId, XYZ_CALL, 'Buy', '2026-10-13T21:30:00Z', '1', '2.40', '0.65'));
    await afterClose.stack.saveMark(instrumentKey(XYZ_CALL), '2.30', '2026-10-13');
    await afterClose.stack.saveMark('XYZ', '53.00', '2026-10-13');

    const detail = openDetail(await afterClose.tradeViews.getTradeDetail({ tradeId }));

    expect(detail.current.datedLine?.tradingDate).toBe('2026-10-13');
    const stop = stopReading(lineOf(detail));
    if (stop.kind !== 'Value') throw new Error(`expected a Value, got ${stop.kind}`);
    expect(stop.value.evidence.mark.price).toBe('53');
  }, 60_000);
});

describe('getTradeDetail: Planned option Trade (T7.23)', () => {
  it('should return a Planned option Trade Detail with its Planned payoff and Current NotApplicable NoRemainingPosition, so a read after a reload shows the Plan payoff', async () => {
    const fixture = await optionStack(THURSDAY_1700);
    const tradeId = await fixture.confirm('strategy.long-call', fixture.planOC());

    const result = await fixture.tradeViews.getTradeDetail({ tradeId });
    if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
    const planned = result.view as PlannedTradeDetail;

    expect(planned.lifecycle.stored).toBe('Planned');
    expect(planned.payoff.planned.kind).toBe('Value');
    expect(planned.payoff.current).toEqual({ kind: 'NotApplicable', reason: 'NoRemainingPosition' });
  }, 60_000);
});

describe('browseTrades: option rows', () => {
  it('should carry the Settlement Due item on an Open option row on the expiration date after the settlement time, as Detail does, and none the day before', async () => {
    const friday = await optionStack(FRIDAY_1700);
    const tradeId = await friday.openCashSecuredPut();
    const thursday = await optionStack(THURSDAY_1700);
    await thursday.openCashSecuredPut();
    await thursday.stack.saveMark('MNO', '46.00', '2026-11-19');

    const onExpiration = await friday.tradeViews.browseTrades({ lifecycle: 'Open' });
    const before = await thursday.tradeViews.browseTrades({ lifecycle: 'Open' });
    if (onExpiration.kind !== 'Ready' || before.kind !== 'Ready') throw new Error('expected Ready pages');

    expect(onExpiration.view.items).toEqual([expect.objectContaining({ settlement: [{ tradeId, instrument: MNO_PUT, quantity: Rational.of(-2n), expiration: '2026-11-20', settlementTime: { kind: 'Value', value: FRIDAY_1600 } }] })]);
    expect(before.view.items).toEqual([expect.objectContaining({ settlement: [] })]);
  }, 60_000);

  it('should look up the Open page settlement times concurrently', async () => {
    const fixture = await optionStack(FRIDAY_1700);
    const first = await fixture.openCashSecuredPut();
    const second = await fixture.openCashSecuredPut();
    let inFlight = 0;
    let peak = 0;
    const marketData = withSession(fixture.stack.marketData, (session) => ({
      settlementTime: async (contract) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return session.settlementTime(contract);
      },
    }));
    const views = createTradeViews({ ...fixture.stack, marketData });

    const page = await views.browseTrades({ lifecycle: 'Open' });
    if (page.kind !== 'Ready') throw new Error('expected a Ready page');

    expect(page.view.items.map((item) => item.tradeId)).toEqual([first, second]);
    expect(peak).toBe(2);
  }, 60_000);

  it('should give an unavailable settlement time for an expiration date outside calendar coverage and still list every Open Trade', async () => {
    const fixture = await optionStack(FRIDAY_1700);
    const tradeId = await fixture.openCashSecuredPut();
    const uncovered = { kind: 'Unavailable', reason: 'SessionPolicyNotCovered', instrument: MNO_PUT, date: '2026-11-20' } as const;
    const marketData = withSession(fixture.stack.marketData, () => ({ settlementTime: () => Promise.resolve(uncovered) }));
    const views = createTradeViews({ ...fixture.stack, marketData });

    const page = await views.browseTrades({ lifecycle: 'Open' });
    const detail = openDetail(await views.getTradeDetail({ tradeId }));

    if (page.kind !== 'Ready') throw new Error('expected a Ready page');
    expect(page.view.items).toEqual([expect.objectContaining({ settlement: [{ tradeId, instrument: MNO_PUT, quantity: Rational.of(-2n), expiration: '2026-11-20', settlementTime: uncovered }] })]);
    expect(detail.settlement).toEqual([expect.objectContaining({ settlementTime: uncovered })]);
  }, 60_000);

  it('should return Open, Planned, and Closed rows with the Trade summary and Strategy, and Closed rows with their Terminal Disposition and Option Disposition Timing, reading Market Data only for Open rows', async () => {
    const fixture = await optionStack(FRIDAY_1700);
    const plannedId = await fixture.confirm('strategy.long-call', fixture.planOC());
    const openId = await fixture.openCashSecuredPut();
    const soldAndExpiredId = await fixture.closeLongCall();
    const expiredId = await fixture.closeCashSecuredPut();
    let reads = 0;
    const marketData = { ...fixture.stack.marketData, openReadSession: (context: Parameters<typeof fixture.stack.marketData.openReadSession>[0]) => { reads += 1; return fixture.stack.marketData.openReadSession(context); } };
    const views = createTradeViews({ ...fixture.stack, marketData });
    const call = { kind: 'Option', direction: 'Long', contracts: Rational.of(2n), expiration: '2026-11-20', strike: '55', right: 'Call' } as const;
    const put = { kind: 'Option', direction: 'Short', contracts: Rational.of(2n), expiration: '2026-11-20', strike: '45', right: 'Put' } as const;

    const planned = await views.browseTrades({ lifecycle: 'Planned' });
    const closed = await views.browseTrades({ lifecycle: 'Closed' });
    if (planned.kind !== 'Ready' || closed.kind !== 'Ready') throw new Error('expected Ready pages');

    expect(reads).toBe(0);
    expect(planned.view.items).toEqual([expect.objectContaining({ tradeId: plannedId, strategy: fixture.strategyOf('strategy.long-call').label, summary: call })]);
    const closedRow = (tradeId: string) => closed.view.items.find((item) => item.tradeId === tradeId);
    expect(closedRow(soldAndExpiredId)).toEqual(
      expect.objectContaining({
        strategy: fixture.strategyOf('strategy.long-call').label,
        summary: call,
        terminalDisposition: { kind: 'Value', value: [{ mechanism: 'Executions', quantity: Rational.of(1n) }, { mechanism: 'Expiration', quantity: Rational.of(1n) }] },
        optionDispositionTiming: { kind: 'Value', value: { timing: 'Mixed', disposedByExecutions: Rational.of(1n), disposedBySettlement: Rational.of(1n) } },
      }),
    );
    expect(closedRow(expiredId)).toEqual(
      expect.objectContaining({
        strategy: fixture.strategyOf('strategy.cash-secured-put').label,
        summary: put,
        terminalDisposition: { kind: 'Value', value: [{ mechanism: 'Expiration', quantity: Rational.of(2n) }] },
        optionDispositionTiming: { kind: 'Value', value: { timing: 'FullyHeldToExpirationSettlement', disposedByExecutions: Rational.of(0n), disposedBySettlement: Rational.of(2n) } },
      }),
    );

    // A typed read of the Closed row's field, with no cast (T7.16-B1).
    const timingOf = (tradeId: string): ClosedTradeItem['optionDispositionTiming'] => closed.view.items.find((item) => item.tradeId === tradeId)?.optionDispositionTiming;
    expect(timingOf(expiredId)).toEqual({ kind: 'Value', value: { timing: 'FullyHeldToExpirationSettlement', disposedByExecutions: Rational.of(0n), disposedBySettlement: Rational.of(2n) } });

    const open = await views.browseTrades({ lifecycle: 'Open' });
    if (open.kind !== 'Ready') throw new Error('expected a Ready page');

    expect(reads).toBeGreaterThan(0);
    expect(open.view.items).toEqual([expect.objectContaining({ tradeId: openId, strategy: fixture.strategyOf('strategy.cash-secured-put').label, summary: put, openQuantity: Rational.of(-2n), current: expect.objectContaining({ expectedMarkDate: '2026-11-20' }) as unknown })]);
  }, 60_000);
});

describe('browseTrades: a failing Historical answer for the dated close (T7.30-B3-R2)', () => {
  it('should keep the Open page Ready and give the affected option Trade no dated line when Market Data rejects the Historical request', async () => {
    const tuesday = await optionStack('2026-10-13T21:00:00Z');
    const tradeId = await tuesday.openLongCallAtMonday();
    await tuesday.stack.saveMark(instrumentKey(XYZ_CALL), '2.20', '2026-10-12');
    await tuesday.stack.saveMark('XYZ', '52.00', '2026-10-12');
    // A date outside coverage has no frames: the session answers none for it.
    const marketData = withSession(tuesday.stack.marketData, () => ({ historicalFrames: () => Promise.resolve([]) }));
    const views = createTradeViews({ ...tuesday.stack, marketData });

    const list = await views.browseTrades({ lifecycle: 'Open' });
    const detail = openDetail(await views.getTradeDetail({ tradeId }));

    if (list.kind !== 'Ready') throw new Error(`expected a Ready page, got ${list.kind}`);
    expect(list.view.items).toEqual([expect.objectContaining({ tradeId })]);
    expect((list.view.items[0] as { current: { datedLine?: unknown } }).current.datedLine).toBeUndefined();
    expect(detail.current.datedLine).toBeUndefined();
  }, 60_000);

  it('should throw when Market Data rejects the Historical request for any reason but session-policy coverage', async () => {
    const tuesday = await optionStack('2026-10-13T21:00:00Z');
    await tuesday.openLongCallAtMonday();
    await tuesday.stack.saveMark(instrumentKey(XYZ_CALL), '2.20', '2026-10-12');
    await tuesday.stack.saveMark('XYZ', '52.00', '2026-10-12');
    const marketData = withSession(tuesday.stack.marketData, () => ({ historicalFrames: () => Promise.reject(new Error('Market Data rejected the Historical request: NotASession')) }));
    const views = createTradeViews({ ...tuesday.stack, marketData });

    await expect(views.browseTrades({ lifecycle: 'Open' })).rejects.toThrow(/Historical|Market Data/);
  }, 60_000);

  it('should throw from Trade Detail when Market Data rejects the Historical request for any reason but session-policy coverage', async () => {
    const tuesday = await optionStack('2026-10-13T21:00:00Z');
    const tradeId = await tuesday.openLongCallAtMonday();
    await tuesday.stack.saveMark(instrumentKey(XYZ_CALL), '2.20', '2026-10-12');
    await tuesday.stack.saveMark('XYZ', '52.00', '2026-10-12');
    const marketData = withSession(tuesday.stack.marketData, () => ({ historicalFrames: () => Promise.reject(new Error('Market Data rejected the Historical request: NotASession')) }));
    const views = createTradeViews({ ...tuesday.stack, marketData });

    await expect(views.getTradeDetail({ tradeId })).rejects.toThrow(/Historical|Market Data/);
  }, 60_000);
});

describe('getTradeDetail: no Mark is requested after the expiration date (T7.32-B6)', () => {
  it('should carry no Mark resolution for the expired contract after the expiration date while Settlement Due', async () => {
    const monday = await optionStack(MONDAY_NOV_23_1700);
    const tradeId = await monday.openCashSecuredPut();

    const detail = openDetail(await monday.tradeViews.getTradeDetail({ tradeId }));

    expect(detail.settlement).toHaveLength(1);
    expect(detail.current.evaluation.settlement).toEqual([expect.objectContaining({ status: 'Due' })]);
    expect(detail.current).not.toHaveProperty('markResolution');
  }, 60_000);

  it('should still report a missing contract Mark on the expiration date itself', async () => {
    const friday = await optionStack(FRIDAY_1700);
    const tradeId = await friday.openCashSecuredPut();

    const detail = openDetail(await friday.tradeViews.getTradeDetail({ tradeId }));

    expect(detail.current.markResolution).toEqual(expect.objectContaining({ kind: 'Missing' }));
  }, 60_000);
});
