import { describe, expect, it, vi } from 'vitest';
import { derive, type TradeAnalysisRecord } from '../../domain/trade-analysis/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { D5_JOURNAL_MANIFEST, type ReflectionDisposition } from '../../modules/journal/index.ts';
import { D6_CATALOG_MANIFEST } from '../../modules/reference-catalog/index.ts';
import { closedTradeReviewFixture } from '../../../tests/support/closed-trade-review-fixture.ts';
import { ELEVEN_AM, TEN_AM, rawEditTrade, reviewStack } from '../../../tests/support/review-fixture.ts';
import { dumpAll } from '../../../tests/support/stack.ts';
import type { PositionChangeMember } from '../trade-workflows/index.ts';
import { createTradeViews } from './index.ts';

// derive is the real one, replaceable so a Trade can be made incoherent.
vi.mock('../../domain/trade-analysis/index.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../domain/trade-analysis/index.ts')>();
  return { ...original, derive: vi.fn(original.derive) };
});

const TUESDAY_1700 = '2026-10-13T21:00:00Z';
const TUESDAY_REVIEW_DATE = '2026-10-13';
const X1_TIME = '2026-10-13T14:00:00Z';
const X2_TIME = '2026-10-13T18:00:00Z';

const value = (v: Rational) => ({ kind: 'Value', value: v });
const money = (text: string) => {
  const [whole, cents = ''] = text.split('.');
  return Rational.of(BigInt(`${whole}${cents.padEnd(2, '0')}`), 100n);
};

// Market Data is not read: every use of it fails the read.
const noMarketData = new Proxy({}, { get: (_target, name) => () => { throw new Error(`Market Data read: ${String(name)}`); } }) as never;

describe('browseTrades: Closed (A95)', () => {
  it('should return a Ready page with, per Trade, symbol, Strategy, Account and Institution labels, net realized P&L, Realized R, Terminal Disposition, Close Reason label, terminal time, Deviation count, owed-reflection indicator, and integrity indicator, ordered by terminal time descending, reading no Market Data, and an empty Ready page when nothing is Closed', async () => {
    const empty = await reviewStack(TUESDAY_1700);
    expect(await createTradeViews({ ...empty, marketData: noMarketData }).browseTrades({ lifecycle: 'Closed' })).toEqual({
      kind: 'Ready',
      view: { items: [] },
      binding: expect.objectContaining({ workspace: expect.any(Object) as unknown }) as unknown,
    });

    const fixture = await closedTradeReviewFixture();
    const { stack, trades } = fixture;
    const reasons = await stack.catalog.query({ family: 'CloseReason' });
    if (reasons.kind !== 'Page') throw new Error('no Close Reasons');
    const closeReason = { id: reasons.items[0]!.id, label: reasons.items[0]!.label };
    const before = await dumpAll(stack.factory);

    const result = await createTradeViews({ ...stack, marketData: noMarketData }).browseTrades({ lifecycle: 'Closed' });
    if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);

    // Terminal times: N Tue 16:30, L Tue 15:00, K Tue 11:00, M Mon 15:00, P Mon 12:00.
    expect(result.view.items.map((i) => i.tradeId)).toEqual([trades.N, trades.L, trades.K, trades.M, trades.P]);
    const row = (symbol: string, terminalTime: string, oneR: bigint, reflectionOwed: boolean) => ({
      underlying: symbol,
      strategy: stack.strategy.label,
      account: stack.account.label,
      institution: stack.institution.label,
      // 100 shares up 1.00, less the entry fee 1.00 and the exit fee 0.60.
      netRealizedPnl: money('98.40'),
      realizedR: value(money('98.40').div(Rational.of(oneR))),
      terminalDisposition: value([{ mechanism: 'Executions', quantity: Rational.of(100n) }] as unknown as Rational),
      closeReason,
      terminalTime,
      deviationCount: 0,
      reflectionOwed,
      integrity: 'Agrees',
    });
    expect(result.view.items).toEqual([
      expect.objectContaining({ tradeId: trades.N, ...row('NOP', '2026-10-13T20:30:00Z', 200n, false) }),
      expect.objectContaining({ tradeId: trades.L, ...row('LMN', '2026-10-13T19:00:00Z', 200n, true) }),
      expect.objectContaining({ tradeId: trades.K, ...row('KLM', '2026-10-13T15:00:00Z', 100n, false) }),
      expect.objectContaining({ tradeId: trades.M, ...row('MNP', '2026-10-12T19:00:00Z', 200n, true) }),
      expect.objectContaining({ tradeId: trades.P, ...row('PQR', '2026-10-12T16:00:00Z', 100n, false) }),
    ]);
    expect(result.view.nextCursor).toBeUndefined();
    expect(await dumpAll(stack.factory)).toEqual(before);
  });

  it('should list a Closed Trade whose facts cannot be replayed with its stored values and integrity Disagrees', async () => {
    const { stack, trades } = await closedTradeReviewFixture({ only: ['K'] });
    vi.mocked(derive).mockReturnValueOnce({ kind: 'IncoherentFacts', findings: [{ factId: 'x', kind: 'PositionChange', economicTime: '2026-10-12T14:00:00Z', reason: 'DuplicateFactId' }] });

    const result = await createTradeViews({ ...stack, marketData: noMarketData }).browseTrades({ lifecycle: 'Closed' });
    if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);

    expect(result.view.items).toEqual([
      expect.objectContaining({ tradeId: trades.K, underlying: 'KLM', terminalTime: '2026-10-13T15:00:00Z', integrity: 'Disagrees', reflectionOwed: false }),
    ]);
    expect(result.view.items[0]).not.toHaveProperty('netRealizedPnl');
  });
});

// T-A on a stack whose Catalog and Journal carry the D6 seeds; the clock reads Tuesday 17:00.
async function tradeA() {
  const stack = await reviewStack(TUESDAY_1700);
  await stack.catalog.seedDefaults(D6_CATALOG_MANIFEST);
  await stack.journal.seedDefaults(D5_JOURNAL_MANIFEST);
  const reasons = await stack.catalog.query({ family: 'CloseReason' });
  if (reasons.kind !== 'Page') throw new Error('no Close Reasons');
  const definition = await stack.journal.getDefinitions({ latestFor: 'entry-type.close-review' });
  if (definition.kind !== 'Found') throw new Error('no Close Review definition');
  const closeReview: ReflectionDisposition = {
    kind: 'Complete',
    form: { definitionId: definition.definition.id, answers: { 'prompt.close-review.take-again': { kind: 'Option', optionId: 'option.close-review.take-again.yes-as-planned' } } },
  };
  const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
  await stack.fill(trade, TEN_AM, '60', '50.10');
  await stack.fill(trade, ELEVEN_AM, '40', '50.30');

  const exit = async (members: readonly { economicTime: string; quantity: string; price: string; fee: string }[], terminal = false) => {
    const current = await stack.tradeRecord.getRecord({ tradeId: trade.tradeId, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error('no Trade');
    const result = await stack.tradeWorkflows.recordPositionChange({
      originTradeId: trade.tradeId,
      trades: [{ tradeId: trade.tradeId, expectedFactRevision: current.factRevision }],
      members: members.map(
        (m): PositionChangeMember => ({
          kind: 'Execution',
          tradeId: trade.tradeId,
          action: 'Sell',
          instrument: { kind: 'Stock', symbol: 'XYZ' },
          intent: { kind: 'ServesPlannedLeg', plannedLegId: trade.plan.legs[0]!.factId },
          ...m,
        }),
      ),
      reflection: stack.reflection,
      ...(terminal && { closeReasonId: reasons.items[0]!.id, closeReview }),
    });
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${result.kind}`);
  };
  // X1: Sell 30 @ 52.00, fee 0.60. X2: two Executions that sell the remaining 70.
  const x1 = () => exit([{ economicTime: X1_TIME, quantity: '30', price: '52.00', fee: '0.60' }]);
  const x2 = () =>
    exit(
      [
        { economicTime: X2_TIME, quantity: '50', price: '53.00', fee: '1.00' },
        { economicTime: X2_TIME, quantity: '20', price: '53.00', fee: '0.40' },
      ],
      true,
    );
  const analysis = async (): Promise<TradeAnalysisRecord> => {
    const record = await stack.tradeRecord.getRecord({ tradeId: trade.tradeId, projection: 'AnalysisInput' });
    if (record.kind !== 'Found') throw new Error('no Trade');
    return record.projection as TradeAnalysisRecord;
  };
  return { stack, trade, closeReason: { id: reasons.items[0]!.id, label: reasons.items[0]!.label }, x1, x2, analysis };
}

describe('getTradeDetail: Closed', () => {
  it('should return the Plan, stored lifecycle Closed with agreement, Terminal Disposition and Close Reason as separate fields, Position Changes with their Executions, each Lot Match with its allocated opening and disposal fees and realized amount, the fee reconciliation, realized P&L, Realized R, Entry Quality, Fulfillment, Deviations, and the narrative including the Close Review, with no Mark requirement', async () => {
    const t = await tradeA();
    await t.x1();
    await t.x2();
    const record = await t.analysis();
    const before = await dumpAll(t.stack.factory);

    // No Mark is saved for any date.
    const result = await createTradeViews(t.stack).getTradeDetail({ tradeId: t.trade.tradeId });
    if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
    const detail = result.view;
    if (!('terminalDisposition' in detail)) throw new Error('expected the Closed form of Detail');

    expect(detail.plan).toEqual(expect.objectContaining({ underlying: 'XYZ', thesis: 'Breakout above the 50-day on volume.', stops: record.plan.stops, targets: record.plan.targets, legs: record.plan.legs }));
    expect(detail.lifecycle).toEqual({ stored: 'Closed', agreement: { kind: 'Agrees' } });
    expect(detail.terminalDisposition).toEqual(value([{ mechanism: 'Executions', quantity: Rational.of(100n) }] as unknown as Rational));
    expect(detail.closeReason).toEqual(t.closeReason);
    expect(detail.terminalTime).toBe(X2_TIME);
    expect(detail.positionChanges.map((pc) => pc.executions.map((e) => `${e.action} ${e.quantity}`))).toEqual([['Buy 60'], ['Buy 40'], ['Sell 30'], ['Sell 50', 'Sell 20']]);

    // PC1 <- X1, PC1 <- X2a, PC2 <- X2a, PC2 <- X2b (breakdown, section 4).
    const [pc1, pc2] = record.positionChanges.flatMap((pc) => pc.executions).slice(0, 2).map((e) => e.factId);
    const [x1, x2a, x2b] = record.positionChanges.slice(2).flatMap((pc) => pc.executions).map((e) => e.factId);
    const match = (opening: string | undefined, disposing: string | undefined, quantity: bigint, openingFee: string, disposalFee: string, realized: string) =>
      expect.objectContaining({
        openingExecutionId: opening,
        disposingExecutionId: disposing,
        quantity: Rational.of(quantity),
        policy: 'FIFO',
        allocatedOpeningFee: value(money(openingFee)),
        allocatedDisposalFee: value(money(disposalFee)),
        realized: value(money(realized)),
      }) as unknown;
    expect(detail.lotMatches).toEqual([
      match(pc1, x1, 30n, '0.50', '0.60', '55.90'),
      match(pc1, x2a, 30n, '0.50', '0.60', '85.90'),
      match(pc2, x2a, 20n, '0.50', '0.40', '53.10'),
      match(pc2, x2b, 20n, '0.50', '0.40', '53.10'),
    ]);
    // Incurred fees are the plain sum of the Execution fees, each opening and disposal fee is allocated once, and nothing remains on a Lot.
    expect(detail.feeReconciliation).toEqual({
      incurred: money('4.00'),
      incurredOpening: money('2.00'),
      incurredDisposal: money('2.00'),
      allocatedOpening: money('2.00'),
      allocatedDisposal: money('2.00'),
      unconsumedOpening: money('0'),
    });
    // For a Closed Trade realized-to-date is its net realized P&L.
    expect(detail.realizedToDate).toEqual(money('248.00'));
    expect(detail.realizedR).toEqual(value(Rational.of(124n, 125n)));
    // A Closed Trade has no current figures and needs no Mark (A92).
    expect(detail.current.mark).toBeUndefined();
    expect(detail.current.evaluation.currentMarkedPnl).toEqual({ kind: 'NotApplicable', reason: 'NoRemainingPosition' });
    expect(detail.current.evaluation.ongoingRiskToStop).toEqual({ kind: 'NotApplicable', reason: 'NoRemainingPosition' });
    const derived = derive({ record });
    if (derived.kind !== 'Derived') throw new Error('expected a Derived Trade');
    expect(detail.entryQuality).toEqual(derived.entryQuality);
    expect(detail.legFulfillment).toEqual([{ plannedLegId: record.plan.legs[0]!.factId, fulfillment: 'FilledAsPlanned' }]);
    expect(detail.deviations).toEqual([]);
    expect(detail.findings).toEqual([]);
    // The Close Review is in the narrative, found by its Entry Type key.
    expect(detail.journal.filter((item) => item.entryTypeKey === 'entry-type.close-review')).toEqual([
      expect.objectContaining({ kind: 'Entry', anchor: { kind: 'Trade', tradeId: t.trade.tradeId }, momentTime: X2_TIME }),
    ]);
    expect(await dumpAll(t.stack.factory)).toEqual(before);
  });

  it('should still show the other labels when the Close Reason is unknown to the Catalog', async () => {
    const t = await tradeA();
    await t.x1();
    await t.x2();
    const record = await t.analysis();
    const unknown = { ...record, closeReason: { ...record.closeReason!, closeReasonId: 'no-such-reason' } };
    const records = { ...t.stack.tradeRecord, getRecord: async (request: Parameters<typeof t.stack.tradeRecord.getRecord>[0]) => {
      const found = await t.stack.tradeRecord.getRecord(request);
      return found.kind === 'Found' && request.projection === 'AnalysisInput' ? { ...found, projection: unknown } : found;
    } };

    const result = await createTradeViews({ ...t.stack, tradeRecord: records }).getTradeDetail({ tradeId: t.trade.tradeId });
    if (result.kind !== 'Ready' || !('terminalDisposition' in result.view)) throw new Error('expected the Closed form of Detail');

    expect(result.view.closeReason).toEqual({ id: 'no-such-reason', label: '' });
    expect(result.view.labels).toEqual({ strategy: t.stack.strategy.label, account: t.stack.account.label, institution: t.stack.institution.label });
  });
});

describe('getTradeDetail: Closed reads no Market Data and requires no Mark (T6.14-B1)', () => {
  it('should return the Closed Detail with its Closed fields when Market Data rejects the frames for a reason other than coverage', async () => {
    const t = await tradeA();
    await t.x1();
    await t.x2();
    const rejecting = { query: () => Promise.resolve({ kind: 'Rejected', issues: [{ field: 'asOf', code: 'InvalidInstant' }] }) } as never;

    const result = await createTradeViews({ ...t.stack, marketData: rejecting }).getTradeDetail({ tradeId: t.trade.tradeId });
    if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
    if (!('terminalDisposition' in result.view)) throw new Error('expected the Closed form of Detail');

    expect(result.view.lifecycle).toEqual({ stored: 'Closed', agreement: { kind: 'Agrees' } });
    expect(result.view.realizedToDate).toEqual(money('248.00'));
    expect(result.view.realizedR).toEqual(value(Rational.of(124n, 125n)));
    expect(result.view.closeReason).toEqual(t.closeReason);
    expect(result.view.terminalTime).toBe(X2_TIME);
  });

  it('should show no saved Mark, no Expected Mark Date, and no Market Data snapshot in the Closed Detail', async () => {
    const t = await tradeA();
    await t.x1();
    await t.x2();
    // A Mark is saved for the Expected Mark Date, the Tuesday the clock reads.
    await t.stack.saveMark('XYZ', '53.00', TUESDAY_REVIEW_DATE);
    const query = vi.spyOn(t.stack.marketData, 'query');

    const result = await createTradeViews(t.stack).getTradeDetail({ tradeId: t.trade.tradeId });
    if (result.kind !== 'Ready' || !('terminalDisposition' in result.view)) throw new Error('expected the Closed form of Detail');

    expect(result.view.current).not.toHaveProperty('mark');
    expect(result.view.current).not.toHaveProperty('expectedMarkDate');
    expect(result.view.current).not.toHaveProperty('markResolution');
    expect(result.view.current).not.toHaveProperty('datedLine');
    expect(result.view.current.evaluation.currentMarkedPnl).toEqual({ kind: 'NotApplicable', reason: 'NoRemainingPosition' });
    expect(result.binding).not.toHaveProperty('marketDataSnapshotId');
    // The Trade owes no reflection, so nothing needs a session close.
    expect(query).not.toHaveBeenCalled();
  });

  it('should classify the Outstanding Debt of a Closed Trade when Market Data answers and leave it without a due status when it does not', async () => {
    const { stack, trades } = await closedTradeReviewFixture({ only: ['L'] });
    const debtOf = (view: Awaited<ReturnType<ReturnType<typeof createTradeViews>['getTradeDetail']>>) => {
      if (view.kind !== 'Ready' || !('terminalDisposition' in view.view)) throw new Error('expected the Closed form of Detail');
      return view.view.journal.filter((item) => item.kind === 'Debt');
    };

    const answered = await createTradeViews(stack).getTradeDetail({ tradeId: trades.L! });
    expect(debtOf(answered)).toEqual([expect.objectContaining({ kind: 'Debt', dueStatus: 'DueInNextReview' })]);

    const rejecting = { query: () => Promise.resolve({ kind: 'Rejected', issues: [{ field: 'asOf', code: 'InvalidInstant' }] }) } as never;
    const rejected = await createTradeViews({ ...stack, marketData: rejecting }).getTradeDetail({ tradeId: trades.L! });
    const [debt] = debtOf(rejected);
    expect(debt).toEqual(expect.objectContaining({ kind: 'Debt' }));
    expect(debt).not.toHaveProperty('dueStatus');
  });
});

describe('getTradeDetail: a stored-Closed Trade whose facts replay as Open (T6.14-B2, A96)', () => {
  it('should return Ready with the LifecycleDisagreement and the integrity finding, without throwing, and leave the content revision unchanged', async () => {
    const t = await tradeA();
    // Open by its facts (Buys and no Sell), stored Closed with no terminal key, as no writer would leave it.
    await rawEditTrade(t.stack, t.trade.tradeId, (trade) => ({ ...trade, lifecycle: 'Closed', terminalTime: undefined, terminalDesc: undefined }));
    const before = await dumpAll(t.stack.factory);

    const result = await createTradeViews(t.stack).getTradeDetail({ tradeId: t.trade.tradeId });
    if (result.kind !== 'Ready' || !('findings' in result.view)) throw new Error(`expected a Ready Detail with findings, got ${result.kind}`);

    const disagreement = { kind: 'LifecycleDisagreement', stored: 'Closed', expected: 'Open' };
    expect(result.view.lifecycle).toEqual({ stored: 'Closed', agreement: disagreement });
    expect(result.view.findings).toEqual([disagreement]);
    expect(await dumpAll(t.stack.factory)).toEqual(before);
  });
});

describe('getTradeDetail: Open after a partial exit', () => {
  it('should return the Lot Matches, realized-to-date 55.90, the remaining Lots with unconsumed fees, and current figures that include realized-to-date', async () => {
    const t = await tradeA();
    await t.x1();
    await t.stack.saveMark('XYZ', '52.50', TUESDAY_REVIEW_DATE);
    const record = await t.analysis();

    const result = await createTradeViews(t.stack).getTradeDetail({ tradeId: t.trade.tradeId });
    if (result.kind !== 'Ready' || !('current' in result.view)) throw new Error('expected the Open form of Detail');
    const detail = result.view;

    const [pc1, pc2] = record.positionChanges.flatMap((pc) => pc.executions).slice(0, 2).map((e) => e.factId);
    const x1 = record.positionChanges[2]!.executions[0]!.factId;
    expect(detail.lotMatches).toEqual([
      expect.objectContaining({
        openingExecutionId: pc1,
        disposingExecutionId: x1,
        quantity: Rational.of(30n),
        allocatedOpeningFee: value(money('0.50')),
        allocatedDisposalFee: value(money('0.60')),
        realized: value(money('55.90')),
      }),
    ]);
    expect(detail.realizedToDate).toEqual(money('55.90'));
    expect(detail.positions[0]!.openLots).toEqual([
      { openingExecutionId: pc1, quantity: Rational.of(30n), price: money('50.10'), unconsumedOpeningFee: money('0.50') },
      { openingExecutionId: pc2, quantity: Rational.of(40n), price: money('50.30'), unconsumedOpeningFee: money('1.00') },
    ]);
    expect(detail.feeReconciliation).toEqual({
      incurred: money('2.60'),
      incurredOpening: money('2.00'),
      incurredDisposal: money('0.60'),
      allocatedOpening: money('0.50'),
      allocatedDisposal: money('0.60'),
      unconsumedOpening: money('1.50'),
    });
    // Remaining-open marked P&L 158.50 plus realized-to-date 55.90: 214.40.
    expect(detail.current.evaluation.remainingOpenPnl).toEqual(value(money('158.50')));
    expect(detail.current.evaluation.currentMarkedPnl).toEqual(value(money('214.40')));
  });
});

describe('Trade Summary on Closed items and Details (decision 48)', () => {
  // Buy 60 @ 50.10 and Buy 40 @ 50.30: 5018.00 over 100 shares, "Long 100 shares @ $50.18".
  const entered = { kind: 'Stock', direction: 'Long', quantity: Rational.of(100n), price: money('50.18') };

  it('should give a Closed item the entered quantity at its average entry price as its Trade Summary', async () => {
    const t = await tradeA();
    await t.x1();
    await t.x2();

    const result = await createTradeViews({ ...t.stack, marketData: noMarketData }).browseTrades({ lifecycle: 'Closed' });
    if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);

    expect(result.view.items).toEqual([expect.objectContaining({ tradeId: t.trade.tradeId, summary: entered })]);
  });

  it('should give a Closed Detail the same Trade Summary, although it holds no Open Lot', async () => {
    const t = await tradeA();
    await t.x1();
    await t.x2();

    const result = await createTradeViews(t.stack).getTradeDetail({ tradeId: t.trade.tradeId });
    if (result.kind !== 'Ready' || !('terminalDisposition' in result.view)) throw new Error('expected the Closed form of Detail');

    expect(result.view.summary).toEqual(entered);
  });
});
