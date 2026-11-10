import { describe, expect, it } from 'vitest';
import { nyseSessionPolicy } from '../../domain/session-policy/index.ts';
import { fixedClock } from '../../domain/time/index.ts';
import type { TradeAnalysisRecord } from '../../domain/trade-analysis/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { createMarketData, type FrameContext } from '../../modules/market-data/index.ts';
import { createTradeRecord } from '../../modules/trade-record/index.ts';
import { instrumentKey } from '../../domain/instrument/index.ts';
import { countRequests } from '../../../tests/support/request-counter.ts';
import { FRIDAY_1600, FRIDAY_1700, MONDAY_1700, MONDAY_NEXT_1700, OC_PC1, OC_PC2, PC1_TIME, TUESDAY_1400, WEDNESDAY_1700, XYZ_CALL, closeReasonId, closeReviewDisposition, confirmOption, onboardedAt, planStock, record, recordExit, recordOption, saveMark } from '../../../tests/integration/d7/support.ts';
import { sequentialIds } from '../../../tests/support/workspace.ts';
import { valueTrade } from './index.ts';

// T7SP.6: Mark-to-Market Valuation (P77, P78, P80). The expected values are those Trade Views' and Daily Review's
// existing cases assert for the same fixtures; each case names its source.

const MONDAY = '2026-10-12';

// An onboarded Workspace at `now`, with a read session opened on the Market Data the facade writes through.
async function book(now: string) {
  const { app } = await onboardedAt(now);
  const marketData = createMarketData({ persistence: app.persistence, ids: sequentialIds('md'), clock: fixedClock(now), sessionPolicy: nyseSessionPolicy });
  const tradeRecord = createTradeRecord({ persistence: app.persistence, ids: sequentialIds('tr') });
  const analysisOf = async (tradeId: string): Promise<TradeAnalysisRecord> => {
    const found = await tradeRecord.getRecord({ tradeId, projection: 'AnalysisInput' });
    if (found.kind !== 'Found') throw new Error(`no Trade ${tradeId}`);
    return found.projection as TradeAnalysisRecord;
  };
  const open = (context: FrameContext) => marketData.openReadSession(context);
  return { app, marketData, analysisOf, open };
}

// The facade the D7 support builds, named through its factory so the coordinator suite imports no composition root.
type Application = Awaited<ReturnType<typeof onboardedAt>>['app'];

const value = (v: Rational) => ({ kind: 'Value', value: v });

// O-C through PC1 and PC2 on Monday: 2 contracts held (as trade-views/option-views.test.ts's openLongCallAtMonday).
async function twoCalls(app: Application): Promise<string> {
  const tradeId = (await confirmOption(app, 'O-C')).receipt.tradeId;
  await recordOption(app, tradeId, 'Buy', OC_PC1);
  await recordOption(app, tradeId, 'Buy', OC_PC2);
  return tradeId;
}

// O-C through PC1: 1 contract held, expiring Friday 2026-11-20.
async function oneCall(app: Application): Promise<string> {
  const tradeId = (await confirmOption(app, 'O-C')).receipt.tradeId;
  await recordOption(app, tradeId, 'Buy', OC_PC1);
  return tradeId;
}

describe('Mark-to-Market Valuation (P77, P78, P80)', () => {
  it("should value a Long Stock Trade at the session's date from its Underlying's frame, with D4's figures for XYZ", async () => {
    const { app, analysisOf, open } = await book(MONDAY_1700);
    const tradeId = await planStock(app, 'XYZ', '50.00', '47.50', '56.00');
    await record(app, tradeId, { quantity: '100', price: '50.00', economicTime: PC1_TIME });
    await saveMark(app, 'XYZ', MONDAY, '52.00');

    const valuation = await valueTrade(await open({ kind: 'Review', reviewDate: MONDAY }), await analysisOf(tradeId), { factsAtClose: true });

    if (valuation.kind !== 'Valued') throw new Error(`expected Valued, got ${valuation.kind}`);
    expect(valuation.evaluation.valuationDate).toBe(MONDAY);
    expect(valuation.frame).toMatchObject({ instrumentKey: 'XYZ', tradingDate: MONDAY, resolution: { kind: 'Available', mark: { price: '52' } } });
    // Source: trade-views/current-evaluation.test.ts, 'should add to each item the Expected Mark Date ...': 100 shares at 50.00 with a
    // 1.00 fee, marked 52.00, 1R = 250.
    expect(valuation.evaluation).toEqual(
      expect.objectContaining({
        remainingOpenPnl: value(Rational.of(199n)),
        currentMarkedPnl: value(Rational.of(199n)),
        currentMarkedPnlInPlanR: value(Rational.of(199n, 250n)),
        ongoingRiskToStop: value(Rational.of(450n)),
        worstCaseOngoingRisk: value(Rational.of(5200n)),
        incrementalRewardToTarget: value(Rational.of(400n)),
      }),
    );
  });

  it('should value DEF with its Mark missing as Unavailable(MarkMissing, DEF, Mon Oct 12), with realized-to-date still a Value', async () => {
    const { app, analysisOf, open } = await book(MONDAY_1700);
    const tradeId = await planStock(app, 'DEF', '40.00', '38.00', '46.00');
    await record(app, tradeId, { quantity: '100', price: '40.00', economicTime: PC1_TIME });

    const valuation = await valueTrade(await open({ kind: 'Review', reviewDate: MONDAY }), await analysisOf(tradeId), { factsAtClose: true });

    if (valuation.kind !== 'Valued') throw new Error(`expected Valued, got ${valuation.kind}`);
    // Source: tests/integration/d4/expected-mark.test.ts, readB: every Mark-dependent figure and condition is Unavailable
    // naming the Instrument and the Expected Mark Date; realized-to-date is still a Value (0).
    const missing = { kind: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'DEF' }, date: MONDAY };
    expect(valuation.frame?.resolution).toEqual({ kind: 'Missing' });
    expect(valuation.evaluation).toEqual(
      expect.objectContaining({
        remainingOpenPnl: missing,
        currentMarkedPnl: missing,
        ongoingRiskToStop: missing,
        worstCaseOngoingRisk: missing,
        incrementalRewardToTarget: missing,
        conditions: [expect.objectContaining({ result: missing }), expect.objectContaining({ result: missing })],
        realizedToDate: value(Rational.of(0n)),
      }),
    );
  });

  it("should value O-C from its contract's frame, with XYZ's frame paired for condition status and risk to the Stop", async () => {
    const { app, analysisOf, open } = await book(MONDAY_1700);
    const tradeId = await twoCalls(app);
    await saveMark(app, instrumentKey(XYZ_CALL), MONDAY, '2.20');
    await saveMark(app, 'XYZ', MONDAY, '52.00');

    const valuation = await valueTrade(await open({ kind: 'Review', reviewDate: MONDAY }), await analysisOf(tradeId), { factsAtClose: true });

    if (valuation.kind !== 'Valued') throw new Error(`expected Valued, got ${valuation.kind}`);
    expect(valuation.frame).toMatchObject({ instrumentKey: instrumentKey(XYZ_CALL), resolution: { kind: 'Available', mark: { price: '2.2' } } });
    expect(valuation.underlyingFrame).toMatchObject({ instrumentKey: 'XYZ', resolution: { kind: 'Available', mark: { price: '52' } } });
    // Source: trade-views/option-views.test.ts, 'should add the dated line from Monday close valuing 2 contracts at the call Mark 2.20
    // with XYZ at 52.00': market value 440, remaining open P&L 38.70; and the Stop reading is evidenced by XYZ's Mark.
    expect(valuation.evaluation.marketValue).toEqual(value(Rational.of(440n)));
    expect(valuation.evaluation.remainingOpenPnl).toEqual(value(Rational.of(3870n, 100n)));
    const stop = valuation.evaluation.conditions.find((c) => c.role === 'Stop')!.result;
    if (stop.kind !== 'Value') throw new Error(`expected a Value, got ${stop.kind}`);
    expect(stop.value.evidence.mark.price).toBe('52');
    expect(valuation.evaluation.ongoingRiskToStop.kind).toBe('Value');
  });

  it("should value O-C at Mon 11-23 with no read for its contract or XYZ, its figures Unavailable(SettlementDue), and one Due settlement item with Fri 11-20's close", async () => {
    const { app, analysisOf, open } = await book(MONDAY_NEXT_1700);
    const tradeId = await oneCall(app);
    const session = await open({ kind: 'Review', reviewDate: '2026-11-23' });
    const analysis = await analysisOf(tradeId);

    const { result: valuation, requests } = await countRequests(() => valueTrade(session, analysis));

    if (valuation.kind !== 'Valued') throw new Error(`expected Valued, got ${valuation.kind}`);
    // Neither the contract's Mark nor XYZ's is read after the expiration date (P25, A110).
    expect(requests).toEqual([]);
    const settlementDue = { kind: 'Unavailable', reason: 'SettlementDue', instrument: XYZ_CALL, expiration: '2026-11-20' };
    expect(valuation.evaluation).toEqual(expect.objectContaining({ remainingOpenPnl: settlementDue, currentMarkedPnl: settlementDue, ongoingRiskToStop: settlementDue }));
    // Source: trade-views/option-views.test.ts, 'should return O-S at Friday 17:00 ...': the item and its settlement time, Friday 16:00;
    // and 'no Mark is requested after the expiration date (T7.32-B6)': the evaluation's item is Due.
    expect(valuation.evaluation.settlement).toEqual([expect.objectContaining({ status: 'Due' })]);
    expect(valuation.settlement).toEqual([{ tradeId, instrument: XYZ_CALL, quantity: Rational.of(1n), expiration: '2026-11-20', settlementTime: { kind: 'Value', value: FRIDAY_1600 } }]);
  });

  it("should value O-C at Fri 11-20 from its contract's Mark, with a Due settlement item", async () => {
    const { app, analysisOf, open } = await book(FRIDAY_1700);
    const tradeId = await oneCall(app);
    await saveMark(app, instrumentKey(XYZ_CALL), '2026-11-20', '0.05');
    await saveMark(app, 'XYZ', '2026-11-20', '56.00');

    const valuation = await valueTrade(await open({ kind: 'Review', reviewDate: '2026-11-20' }), await analysisOf(tradeId));

    if (valuation.kind !== 'Valued') throw new Error(`expected Valued, got ${valuation.kind}`);
    // Source: trade-views/option-views.test.ts, 'should still report a missing contract Mark on the expiration date itself' and
    // 'should return O-S at Friday 17:00': on the expiration date the Mark is still read and the item is Due, its time Friday 16:00.
    expect(valuation.frame?.resolution).toEqual({ kind: 'Available', mark: expect.objectContaining({ price: '0.05' }) as unknown });
    expect(valuation.evaluation.marketValue).toEqual(value(Rational.of(5n)));
    expect(valuation.evaluation.settlement).toEqual([expect.objectContaining({ status: 'Due' })]);
    expect(valuation.settlement).toEqual([{ tradeId, instrument: XYZ_CALL, quantity: Rational.of(1n), expiration: '2026-11-20', settlementTime: { kind: 'Value', value: FRIDAY_1600 } }]);
  });

  it('should value a session outside coverage with coverage NotCovered and its figures Unavailable(SessionPolicyNotCovered)', async () => {
    const { app, analysisOf, open } = await book(MONDAY_1700);
    const tradeId = await planStock(app, 'XYZ', '50.00', '47.50', '56.00');
    await record(app, tradeId, { quantity: '100', price: '50.00', economicTime: PC1_TIME });
    await saveMark(app, 'XYZ', MONDAY, '52.00');
    // Coverage ends 2028-12-31, so this Wednesday has no Expected Mark Date.
    const session = await open({ kind: 'Current', asOf: '2029-01-03T17:00:00Z' });
    const analysis = await analysisOf(tradeId);

    const { result: valuation, requests } = await countRequests(() => valueTrade(session, analysis));

    if (valuation.kind !== 'Valued') throw new Error(`expected Valued, got ${valuation.kind}`);
    expect(requests).toEqual([]);
    // Source: trade-views/current-evaluation.test.ts, 'Open views outside session-policy coverage'.
    const notCovered = { kind: 'Unavailable', reason: 'SessionPolicyNotCovered', instrument: { kind: 'Stock', symbol: 'XYZ' }, date: '2029-01-03' };
    expect(valuation.evaluation.coverage).toEqual({ kind: 'NotCovered' });
    expect(valuation.evaluation).toEqual(
      expect.objectContaining({
        marketValue: notCovered,
        remainingOpenPnl: notCovered,
        currentMarkedPnl: notCovered,
        ongoingRiskToStop: notCovered,
        worstCaseOngoingRisk: notCovered,
        incrementalRewardToTarget: notCovered,
        conditions: [expect.objectContaining({ result: notCovered }), expect.objectContaining({ result: notCovered })],
        openQuantity: value(Rational.of(100n)),
        incurredFees: value(Rational.of(1n)),
      }),
    );
    expect(valuation.frame).toBeUndefined();
  });

  it('should value a Closed Trade at its terminal date with no read, its Mark-dependent figures NotApplicable(NoRemainingPosition)', async () => {
    const { app, analysisOf, open } = await book(WEDNESDAY_1700);
    const tradeId = await planStock(app, 'XYZ', '50.00', '47.50', '56.00');
    await record(app, tradeId, { quantity: '100', price: '50.00', economicTime: PC1_TIME });
    await recordExit(app, tradeId, [{ quantity: '100', price: '52.00', economicTime: TUESDAY_1400, fee: '0.60' }], { closeReasonId: await closeReasonId(app, 'Target Reached'), closeReview: await closeReviewDisposition(app, 'Complete') });
    // A Mark on the session's own date, which a Closed Trade does not read.
    await saveMark(app, 'XYZ', '2026-10-14', '53.00');
    const session = await open({ kind: 'Current', asOf: WEDNESDAY_1700 });
    const analysis = await analysisOf(tradeId);

    const { result: valuation, requests } = await countRequests(() => valueTrade(session, analysis));

    if (valuation.kind !== 'Valued') throw new Error(`expected Valued, got ${valuation.kind}`);
    // Source: trade-views/closed-views.test.ts, 'Closed reads no Market Data and requires no Mark (T6.14-B1)': no read, no frame,
    // every Mark-dependent figure NotApplicable(NoRemainingPosition); the evaluation is dated at the terminal date (A92).
    expect(requests).toEqual([]);
    expect(valuation.frame).toBeUndefined();
    expect(valuation.evaluation.valuationDate).toBe('2026-10-13');
    const none = { kind: 'NotApplicable', reason: 'NoRemainingPosition' };
    expect(valuation.evaluation).toEqual(expect.objectContaining({ currentMarkedPnl: none, ongoingRiskToStop: none, remainingOpenPnl: none }));
    expect(valuation.settlement).toEqual([]);
  });

  it("should return a Trade whose facts can't be replayed as Unavailable(FactsIncoherent) with its findings and no read", async () => {
    const { app, analysisOf, open } = await book(MONDAY_1700);
    const tradeId = await planStock(app, 'XYZ', '50.00', '47.50', '56.00');
    await record(app, tradeId, { quantity: '100', price: '50.00', economicTime: PC1_TIME });
    await saveMark(app, 'XYZ', MONDAY, '52.00');
    // Its Execution names a Planned Leg that does not exist (as review-fixture.ts's breakFirstExecution).
    const stored = await analysisOf(tradeId);
    const analysis: TradeAnalysisRecord = {
      ...stored,
      positionChanges: stored.positionChanges.map((change) => ({ ...change, executions: change.executions.map((e) => ({ ...e, intent: { kind: 'ServesPlannedLeg', plannedLegId: 'leg-unknown' } as const })) })),
    };
    const session = await open({ kind: 'Review', reviewDate: MONDAY });

    const { result: valuation, requests } = await countRequests(() => valueTrade(session, analysis, { factsAtClose: true }));

    // Source: daily-review/daily-review.test.ts, 'should return a Trade whose facts cannot be replayed with both as Unavailable
    // FactsIncoherent carrying its findings'.
    expect(valuation).toEqual({ kind: 'Unavailable', reason: 'FactsIncoherent', findings: [expect.objectContaining({ reason: 'UnknownPlannedLeg', kind: 'Execution', instrument: { kind: 'Stock', symbol: 'XYZ' } })] });
    expect(requests).toEqual([]);
  });

  it("should add the dated line for XYZ at its Stale context's close, as Trade Views does today", async () => {
    const { app, analysisOf, open } = await book(MONDAY_1700);
    // 100 shares held at Friday's close, 40 more bought Monday morning; Monday's Mark is not entered.
    const tradeId = await planStock(app, 'XYZ', '50.00', '47.50', '56.00', '150', '2026-10-08T13:00:00Z');
    await record(app, tradeId, { quantity: '100', price: '50.00', economicTime: '2026-10-08T14:00:00Z' });
    await record(app, tradeId, { quantity: '40', price: '52.00', economicTime: PC1_TIME });
    await saveMark(app, 'XYZ', '2026-10-09', '51.00');

    const valuation = await valueTrade(await open({ kind: 'Current', asOf: MONDAY_1700 }), await analysisOf(tradeId));

    if (valuation.kind !== 'Valued') throw new Error(`expected Valued, got ${valuation.kind}`);
    // Source: trade-views/current-evaluation.test.ts, 'should return Unavailable figures naming the Instrument and date when the
    // Mark is Missing, with the dated last-close and at-entry lines (P13)': the 100 shares held at Friday's close, valued with
    // Friday's own Mark, 5100 - 5000 - 1; the 40 shares bought after it measured from their execution price.
    expect(valuation.evaluation.atEntry).toEqual({ label: 'AtEntry', quantity: Rational.of(40n), averageEntry: Rational.of(52n), riskFromEntry: Rational.of(180n), rewardFromEntry: Rational.of(160n) });
    expect(valuation.datedLine).toEqual({
      tradingDate: '2026-10-09',
      evaluation: expect.objectContaining({ remainingOpenPnl: value(Rational.of(99n)), currentMarkedPnl: value(Rational.of(99n)), atEntry: null }) as unknown,
    });
  });

  it("should add the dated line for O-C at Monday's close, with XYZ's frame at that close (decision 97)", async () => {
    const { app, analysisOf, open } = await book('2026-10-13T21:00:00Z');
    const tradeId = await twoCalls(app);
    await saveMark(app, instrumentKey(XYZ_CALL), MONDAY, '2.20');
    await saveMark(app, 'XYZ', MONDAY, '52.00');
    const session = await open({ kind: 'Current', asOf: '2026-10-13T21:00:00Z' });
    const analysis = await analysisOf(tradeId);

    const { result: valuation, requests } = await countRequests(() => valueTrade(session, analysis));

    if (valuation.kind !== 'Valued') throw new Error(`expected Valued, got ${valuation.kind}`);
    // Source: trade-views/option-views.test.ts, 'getTradeDetail: option dated line (T7.30-B3)': Tuesday has neither Mark, so the
    // line is Monday's close valuing 2 contracts at 2.20, market value 440 and remaining open P&L 38.70, with XYZ at 52.00 (R1).
    expect(valuation.datedLine?.tradingDate).toBe(MONDAY);
    if (valuation.datedLine?.evaluation.kind !== 'Evaluated') throw new Error('the dated line has no evaluation');
    expect(valuation.datedLine.evaluation.marketValue).toEqual(value(Rational.of(440n)));
    expect(valuation.datedLine.evaluation.remainingOpenPnl).toEqual(value(Rational.of(3870n, 100n)));
    const stop = valuation.datedLine.evaluation.conditions.find((c) => c.role === 'Stop')!.result;
    if (stop.kind !== 'Value') throw new Error(`expected a Value, got ${stop.kind}`);
    expect(stop.value.evidence.mark.price).toBe('52');
    // Decision 97: one observations read for Tuesday's frames and one for the earlier close, none per Instrument.
    expect(requests.filter((r) => r.store === 'observations' && r.method === 'getAll')).toHaveLength(2);
  });

  // Beyond the planned cases (reported): a Trade holding no Position that is not Closed has nothing derive requires.
  it('should value a Planned Trade holding no Position with no read, its Mark-dependent figures NotApplicable(NoRemainingPosition)', async () => {
    const { app, analysisOf, open } = await book(MONDAY_1700);
    const tradeId = await planStock(app, 'XYZ', '50.00', '47.50', '56.00');
    await saveMark(app, 'XYZ', MONDAY, '52.00');
    const session = await open({ kind: 'Current', asOf: MONDAY_1700 });
    const analysis = await analysisOf(tradeId);

    const { result: valuation, requests } = await countRequests(() => valueTrade(session, analysis));

    if (valuation.kind !== 'Valued') throw new Error(`expected Valued, got ${valuation.kind}`);
    expect(requests).toEqual([]);
    expect(valuation.evaluation.currentMarkedPnl).toEqual({ kind: 'NotApplicable', reason: 'NoRemainingPosition' });
    expect(valuation.frame).toBeUndefined();
  });

  it("should return O-C's and XYZ's gaps when the session recovers", async () => {
    const { app, analysisOf, open } = await book('2026-10-13T21:00:00Z');
    const tradeId = await twoCalls(app);
    const session = await open({ kind: 'Review', reviewDate: '2026-10-13' });
    const analysis = await analysisOf(tradeId);

    const valuation = await valueTrade(session, analysis, { withGaps: true });
    const without = await valueTrade(session, analysis);

    if (valuation.kind !== 'Valued' || without.kind !== 'Valued') throw new Error('expected Valued');
    // Source: tests/integration/d4/gaps.test.ts: each Instrument is Missing for every earlier session since its exposure began (Monday),
    // the way `recover` lists them; the session's own date is not a gap.
    const contract = instrumentKey(XYZ_CALL);
    expect(valuation.gaps.map((g) => [g.instrumentKey, g.missing])).toEqual([
      ['XYZ', [MONDAY]],
      [contract, [MONDAY]],
    ]);
    expect(await session.gaps([{ instrumentKey: 'XYZ', earliestExposure: OC_PC1.economicTime }])).toEqual([valuation.gaps[0]]);
    expect(without.gaps).toEqual([]);
  });
});
