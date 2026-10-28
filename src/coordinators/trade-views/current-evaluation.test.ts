import { describe, expect, it, vi } from 'vitest';
import { Rational } from '../../domain/values/index.ts';
import { MONDAY_1700, REVIEW_DATE, TEN_AM, reviewStack } from '../../../tests/support/review-fixture.ts';
import { derive, evaluate } from '../../domain/trade-analysis/index.ts';
import { dumpAll } from '../../../tests/support/stack.ts';
import { createTradeViews } from './index.ts';

// derive and evaluate are the real ones, spied on so a read's calls can be counted.
vi.mock('../../domain/trade-analysis/index.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../domain/trade-analysis/index.ts')>();
  return { ...original, derive: vi.fn(original.derive), evaluate: vi.fn(original.evaluate) };
});

const PLAN = { symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' };

async function openBook(now = MONDAY_1700) {
  const stack = await reviewStack(now);
  return { ...stack, views: createTradeViews(stack) };
}

async function openItems(views: ReturnType<typeof createTradeViews>) {
  const result = await views.browseTrades({ lifecycle: 'Open' });
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result;
}

const FRIDAY = '2026-10-09';
const TUESDAY_NOON = '2026-10-13T16:00:00Z';
const TUESDAY_10AM = '2026-10-13T14:00:00Z';
const THURSDAY_PLAN = '2026-10-08T13:00:00Z';
const THURSDAY_10AM = '2026-10-08T14:00:00Z';

const value = (v: Rational) => ({ kind: 'Value', value: v });

describe('browseTrades: Open with current evaluation', () => {
  it('should add to each item the Expected Mark Date, its Mark resolution, remaining-open marked P&L, Current Marked Trade P&L, Ongoing Risk to Stop, Worst-Case Ongoing Risk, Incremental Reward to Target, Maximum Incremental Reward, their Plan-R conversions, and Stop and Target status, each with its own availability', async () => {
    const stack = await openBook();
    const trade = await stack.confirm(PLAN);
    await stack.fill(trade, TEN_AM, '100', '50.00');
    await stack.saveMark('XYZ', '52.00');

    const { view } = await openItems(stack.views);

    const [item] = view.items;
    if (!item || !('current' in item)) throw new Error('expected a coherent Open item with current figures');
    // 100 shares at 50.00 with a 1.00 fee, marked 52.00; 1R is 250.
    const oneR = Rational.of(250n);
    const reading = (status: string, distance: Rational, role: 'Stop' | 'Target') => ({
      id: `${role.toLowerCase()}-1`,
      role,
      kind: 'UnderlyingPrice',
      boundary: role === 'Stop' ? '47.5' : '56',
      result: {
        kind: 'Value',
        value: expect.objectContaining({ status, distance: { dollars: distance, planR: distance.div(oneR) }, overrun: null }) as unknown,
      },
    });
    expect(item.current).toEqual(
      expect.objectContaining({
        expectedMarkDate: REVIEW_DATE,
        markResolution: { kind: 'Available', mark: expect.objectContaining({ price: '52', source: 'Manual' }) as unknown },
        remainingOpenPnl: value(Rational.of(199n)),
        currentMarkedPnl: value(Rational.of(199n)),
        currentMarkedPnlInPlanR: value(Rational.of(199n, 250n)),
        ongoingRiskToStop: value(Rational.of(450n)),
        ongoingRiskToStopInPlanR: value(Rational.of(450n, 250n)),
        worstCaseOngoingRisk: value(Rational.of(5200n)),
        worstCaseOngoingRiskInPlanR: value(Rational.of(5200n, 250n)),
        incrementalRewardToTarget: value(Rational.of(400n)),
        incrementalRewardToTargetInPlanR: value(Rational.of(400n, 250n)),
        maximumIncrementalReward: { kind: 'Unbounded', direction: 'Above', explanation: expect.any(String) as unknown },
        conditions: [reading('Active', Rational.of(450n), 'Stop'), reading('Active', Rational.of(400n), 'Target')],
      }),
    );
  });

  it('should return Unavailable figures naming the Instrument and date when the Mark is Missing, with the dated last-close and at-entry lines (P13), never fill cost or zero', async () => {
    const stack = await openBook();
    // 100 shares held at Friday's close, 40 more bought Monday morning; Monday's Mark is not entered.
    const trade = await stack.confirm({ ...PLAN, shares: '150', planTime: THURSDAY_PLAN });
    await stack.fill(trade, THURSDAY_10AM, '100', '50.00');
    await stack.fill(trade, TEN_AM, '40', '52.00');
    await stack.saveMark('XYZ', '51.00', FRIDAY);

    const { view } = await openItems(stack.views);

    const [item] = view.items;
    if (!item || !('current' in item)) throw new Error('expected a coherent Open item with current figures');
    const { current } = item;
    const missing = { kind: 'Unavailable', reason: 'MarkMissing', detail: { instrument: { kind: 'Stock', symbol: 'XYZ' }, date: REVIEW_DATE } };
    expect(current).toEqual(
      expect.objectContaining({
        expectedMarkDate: REVIEW_DATE,
        markResolution: { kind: 'Missing', stale: expect.objectContaining({ tradingDate: FRIDAY, price: '51' }) as unknown },
        remainingOpenPnl: missing,
        currentMarkedPnl: missing,
        currentMarkedPnlInPlanR: missing,
        ongoingRiskToStop: missing,
        ongoingRiskToStopInPlanR: missing,
        worstCaseOngoingRisk: missing,
        worstCaseOngoingRiskInPlanR: missing,
        incrementalRewardToTarget: missing,
        incrementalRewardToTargetInPlanR: missing,
        maximumIncrementalReward: expect.objectContaining({ kind: 'Unbounded' }) as unknown,
        conditions: [expect.objectContaining({ result: missing }), expect.objectContaining({ result: missing })],
        // The 40 shares bought after Friday's close, measured from their execution price.
        atEntry: { label: 'AtEntry', quantity: Rational.of(40n), averageEntry: Rational.of(52n), riskFromEntry: Rational.of(180n), rewardFromEntry: Rational.of(160n) },
        // The 100 shares held at Friday's close, valued with Friday's own Mark: 5100 - 5000 - 1.
        datedLine: { tradingDate: FRIDAY, evaluation: expect.objectContaining({ remainingOpenPnl: value(Rational.of(99n)), currentMarkedPnl: value(Rational.of(99n)), atEntry: null }) as unknown },
      }),
    );
  });

  it('should return AwaitingClose figures with the dated and at-entry lines when Lots opened after the Expected Mark Date close (P12)', async () => {
    // Tuesday 12:00 New York: Monday's close is still the Expected Mark Date.
    const stack = await openBook(TUESDAY_NOON);
    const trade = await stack.confirm({ ...PLAN, shares: '150' });
    await stack.fill(trade, TEN_AM, '100', '50.00');
    await stack.fill(trade, TUESDAY_10AM, '40', '53.00');
    await stack.saveMark('XYZ', '52.00');

    const { view } = await openItems(stack.views);

    const [item] = view.items;
    if (!item || !('current' in item)) throw new Error('expected a coherent Open item with current figures');
    const awaiting = { kind: 'Unavailable', reason: 'AwaitingClose', detail: { after: REVIEW_DATE } };
    expect(item.current).toEqual(
      expect.objectContaining({
        expectedMarkDate: REVIEW_DATE,
        markResolution: { kind: 'Available', mark: expect.objectContaining({ price: '52' }) as unknown },
        remainingOpenPnl: awaiting,
        currentMarkedPnl: awaiting,
        ongoingRiskToStop: awaiting,
        worstCaseOngoingRisk: awaiting,
        incrementalRewardToTarget: awaiting,
        conditions: [expect.objectContaining({ result: awaiting }), expect.objectContaining({ result: awaiting })],
        // The 40 shares bought Tuesday, measured from their execution price.
        atEntry: { label: 'AtEntry', quantity: Rational.of(40n), averageEntry: Rational.of(53n), riskFromEntry: Rational.of(220n), rewardFromEntry: Rational.of(120n) },
        // The 100 shares held at Monday's close, valued with Monday's Mark: 5200 - 5000 - 1.
        datedLine: { tradingDate: REVIEW_DATE, evaluation: expect.objectContaining({ remainingOpenPnl: value(Rational.of(199n)), atEntry: null }) as unknown },
      }),
    );
  });

  it('should derive and evaluate each Trade once, plus once more at the dated line close only for Trades that need it', async () => {
    const stack = await openBook();
    // XYZ has no Monday Mark but a Friday one, so it needs the dated line; ABC is marked; DEF has no Mark at all.
    const needy = await stack.confirm({ ...PLAN, planTime: THURSDAY_PLAN });
    await stack.fill(needy, THURSDAY_10AM, '100', '50.00');
    await stack.saveMark('XYZ', '51.00', FRIDAY);
    const marked = await stack.confirm({ ...PLAN, symbol: 'ABC' });
    await stack.fill(marked, TEN_AM, '100', '50.00');
    await stack.saveMark('ABC', '52.00');
    const bare = await stack.confirm({ ...PLAN, symbol: 'DEF' });
    await stack.fill(bare, TEN_AM, '100', '50.00');
    vi.mocked(derive).mockClear();
    vi.mocked(evaluate).mockClear();

    const { view } = await openItems(stack.views);

    expect(view.items).toHaveLength(3);
    const ids = [needy.tradeId, marked.tradeId, bare.tradeId].sort();
    const derivedAtCutoff = vi.mocked(derive).mock.calls.filter(([input]) => input.cutoff !== undefined);
    const derivedAll = vi.mocked(derive).mock.calls.filter(([input]) => input.cutoff === undefined);
    expect(derivedAll.map(([input]) => input.record.tradeId).sort()).toEqual(ids);
    expect(derivedAtCutoff.map(([input]) => [input.record.tradeId, input.cutoff])).toEqual([[needy.tradeId, '2026-10-09T20:00:00Z']]);
    expect(vi.mocked(evaluate).mock.calls.map(([input]) => input.state.tradeId).sort()).toEqual([...ids, needy.tradeId].sort());
  });

  it('should bind the Trade, Journal, and Catalog revisions and the MarketDataSnapshotId of one Workspace content revision, retrying when a write lands between phases and returning ChangedDuringAssembly after 3 retries', async () => {
    const stack = await openBook();
    const trade = await stack.confirm(PLAN);
    await stack.fill(trade, TEN_AM, '100', '50.00');
    await stack.saveMark('XYZ', '52.00');

    const result = await openItems(stack.views);

    const current = await stack.persistence.readSnapshot(['meta'], async (tx) => ({
      catalog: await tx.get('meta', 'catalog'),
      journal: await tx.get('meta', 'journal'),
    }));
    const frames = await stack.marketData.query({ kind: 'ResolveFrames', context: { kind: 'Current', asOf: MONDAY_1700 }, instruments: ['XYZ'] });
    if (frames.kind !== 'Frames') throw new Error(`expected Frames, got ${frames.kind}`);
    expect(result.binding).toEqual({
      workspace: current.binding,
      catalogRevision: (current.value.catalog as { catalogRevision: number }).catalogRevision,
      journalRevision: (current.value.journal as { journalRevision: number }).journalRevision,
      marketDataSnapshotId: frames.snapshotId,
    });

    // A write that lands between the page and the frames is noticed: the read is repeated and returns the later revision.
    let queries = 0;
    const racing = {
      ...stack.marketData,
      query: async (query: Parameters<typeof stack.marketData.query>[0]) => {
        queries++;
        if (queries === 1) await stack.confirm({ ...PLAN, symbol: 'ABC' });
        return stack.marketData.query(query);
      },
    };
    const retried = await createTradeViews({ ...stack, marketData: racing }).browseTrades({ lifecycle: 'Open' });
    const after = await stack.persistence.readSnapshot(['meta'], () => Promise.resolve(null));
    expect(retried.kind === 'Ready' && retried.binding.workspace).toEqual(after.binding);
    expect(queries).toBe(2);

    // Writes that keep landing exhaust the 3 attempts; nothing incoherent is returned.
    let raced = 0;
    const always = {
      ...stack.marketData,
      query: async (query: Parameters<typeof stack.marketData.query>[0]) => {
        raced++;
        await stack.confirm({ ...PLAN, symbol: `R${raced}` });
        return stack.marketData.query(query);
      },
    };
    expect(await createTradeViews({ ...stack, marketData: always }).browseTrades({ lifecycle: 'Open' })).toEqual({ kind: 'ChangedDuringAssembly' });
    expect(raced).toBe(3);
  });
});

async function openDetail(views: ReturnType<typeof createTradeViews>, tradeId: string) {
  const result = await views.getTradeDetail({ tradeId });
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  if (!('positionChanges' in result.view)) throw new Error('expected the Open form of Detail');
  return { ...result, view: result.view };
}

describe('getTradeDetail: Open with current evaluation', () => {
  it('should return valuation with per-Instrument coverage, the P&L components, risk and reward with Plan R, every condition status and Overrun, the dated and at-entry lines when present, and the Mark source, revision, save time, and correction reason', async () => {
    const stack = await openBook();
    // XYZ: 100 shares at 50.00, Monday's Mark corrected from 52.00 to 47.00, below the 47.50 Stop.
    const marked = await stack.confirm(PLAN);
    await stack.fill(marked, TEN_AM, '100', '50.00');
    const initial = await stack.saveMark('XYZ', '52.00');
    if (!('resolutionRevision' in initial)) throw new Error('expected a Saved Mark');
    const corrected = await stack.marketData.save({
      intention: 'CorrectMark',
      instrumentKey: 'XYZ',
      tradingDate: REVIEW_DATE,
      price: '47.00',
      reason: 'First entry was a typo.',
      expectedResolutionRevision: initial.resolutionRevision,
    });
    if (!('revision' in corrected)) throw new Error(`expected a Saved Mark, got ${corrected.kind}`);
    // ABC: 100 shares held at Friday's close and 40 bought Monday, with no Monday Mark.
    const missing = await stack.confirm({ ...PLAN, symbol: 'ABC', shares: '150', planTime: THURSDAY_PLAN });
    await stack.fill(missing, THURSDAY_10AM, '100', '50.00');
    await stack.fill(missing, TEN_AM, '40', '52.00');
    await stack.saveMark('ABC', '51.00', FRIDAY);

    const { view } = await openDetail(stack.views, marked.tradeId);

    const oneR = Rational.of(250n);
    const unit = { kind: 'Stock', symbol: 'XYZ' };
    expect(view.current).toEqual(
      expect.objectContaining({
        expectedMarkDate: REVIEW_DATE,
        markResolution: { kind: 'Available', mark: expect.objectContaining({ price: '47', revisionNumber: 2 }) as unknown },
        mark: { source: 'Manual', revisionId: corrected.revision.revisionId, revisionNumber: 2, price: '47', savedAt: MONDAY_1700, correctionReason: 'First entry was a typo.' },
        coverage: [{ instrument: unit, coverage: { kind: 'Available', revisionId: corrected.revision.revisionId, revisionNumber: 2 } }],
        evaluation: expect.objectContaining({
          marketValue: value(Rational.of(4700n)),
          remainingOpenPnl: value(Rational.of(-301n)),
          realizedToDate: value(Rational.of(0n)),
          currentMarkedPnl: value(Rational.of(-301n)),
          currentMarkedPnlInPlanR: value(Rational.of(-301n, 250n)),
          incurredFees: value(Rational.of(1n)),
          ongoingRiskToStop: value(Rational.of(0n)),
          worstCaseOngoingRiskInPlanR: value(Rational.of(4700n).div(oneR)),
          incrementalRewardToTarget: value(Rational.of(900n)),
          incrementalRewardToTargetInPlanR: value(Rational.of(900n).div(oneR)),
          conditions: [
            expect.objectContaining({ role: 'Stop', result: value(expect.objectContaining({ status: 'Breached', overrun: { dollars: Rational.of(50n), planR: Rational.of(1n, 5n) } }) as unknown as Rational) }),
            expect.objectContaining({ role: 'Target', result: value(expect.objectContaining({ status: 'Active', overrun: null }) as unknown as Rational) }),
          ],
        }) as unknown,
      }),
    );
    expect(view.current).not.toHaveProperty('datedLine');

    const lines = (await openDetail(stack.views, missing.tradeId)).view.current;
    expect(lines.evaluation.atEntry).toEqual({ label: 'AtEntry', quantity: Rational.of(40n), averageEntry: Rational.of(52n), riskFromEntry: Rational.of(180n), rewardFromEntry: Rational.of(160n) });
    expect(lines.datedLine).toEqual({ tradingDate: FRIDAY, evaluation: expect.objectContaining({ remainingOpenPnl: value(Rational.of(99n)) }) as unknown });
    expect(lines).not.toHaveProperty('mark');
  });

  it('should include Daily Trade Review Actions in the narrative', async () => {
    const stack = await openBook();
    const trade = await stack.confirm(PLAN);
    await stack.fill(trade, TEN_AM, '100', '50.00');
    await stack.saveAction(trade.tradeId, 'Exit');

    const { view } = await openDetail(stack.views, trade.tradeId);

    const action = view.journal.find((item) => item.kind === 'Entry' && item.entryType === 'Daily Trade Review');
    expect(action).toEqual(
      expect.objectContaining({
        kind: 'Entry',
        entryType: 'Daily Trade Review',
        anchor: { kind: 'Trade', tradeId: trade.tradeId },
        responses: expect.arrayContaining([expect.objectContaining({ answer: { kind: 'Option', label: 'Exit' } })]) as unknown,
      }),
    );
  });

  it('should return Planned Detail without current evaluation and leave every content revision unchanged after reading', async () => {
    const stack = await openBook();
    const planned = await stack.confirm({ ...PLAN, symbol: 'ABC' });
    const open = await stack.confirm(PLAN);
    await stack.fill(open, TEN_AM, '100', '50.00');
    await stack.saveMark('XYZ', '52.00');
    let queries = 0;
    const counting = {
      ...stack.marketData,
      query: (query: Parameters<typeof stack.marketData.query>[0]) => {
        queries++;
        return stack.marketData.query(query);
      },
    };
    const views = createTradeViews({ ...stack, marketData: counting });
    const before = await dumpAll(stack.factory);

    const detail = await views.getTradeDetail({ tradeId: planned.tradeId });

    if (detail.kind !== 'Ready') throw new Error(`expected Ready, got ${detail.kind}`);
    expect(Object.keys(detail.view).sort()).toEqual(['baseline', 'factRevision', 'journal', 'labels', 'lifecycle', 'plan', 'summary', 'tradeId']);
    expect(detail.binding).not.toHaveProperty('marketDataSnapshotId');
    expect(queries).toBe(0);
    expect((await views.getTradeDetail({ tradeId: open.tradeId })).kind).toBe('Ready');
    expect((await views.browseTrades({ lifecycle: 'Open' })).kind).toBe('Ready');
    expect(await dumpAll(stack.factory)).toEqual(before);
  });
});
