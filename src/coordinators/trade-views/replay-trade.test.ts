import { describe, expect, it } from 'vitest';
import { instrumentKey, type Instrument } from '../../domain/instrument/index.ts';
import { OC2_CONTRACT } from '../../domain/trade-analysis/option-trade.ts';
import { Rational } from '../../domain/values/index.ts';
import { D5_JOURNAL_MANIFEST, type ReflectionDisposition } from '../../modules/journal/index.ts';
import { D7_CATALOG_MANIFEST, type StrategyRecord } from '../../modules/reference-catalog/index.ts';
import { beginSemanticTransaction } from '../../persistence/index.ts';
import { breakFirstExecution, reviewStack } from '../../../tests/support/review-fixture.ts';
import type { ConfirmPlanCommand, PositionChangeMember } from '../trade-workflows/index.ts';
import { createTradeViews, type TradeReplayView } from './index.ts';

// O-C3 (D08P section 5): a Long Call on XYZ, 18 Dec 2026 55 Call. Buy 2 @ 2.00 Mon 10-12 10:00 fee 1.30, sell 1 @ 3.00
// Wed 10-14 11:00 fee 0.65 (the exit reflection deferred). October is New York daylight time (UTC-4).
const THURSDAY_1700 = '2026-10-15T21:00:00Z';
const THURSDAY_1830 = '2026-10-15T22:30:00Z';
const CALL = OC2_CONTRACT;
const XYZ: Instrument = { kind: 'Stock', symbol: 'XYZ' };
const DATES = { mon: '2026-10-12', tue: '2026-10-13', wed: '2026-10-14', thu: '2026-10-15', fri: '2026-10-16' } as const;

const frac = (r: Rational) => `${r.numerator}/${r.denominator}`;
const q = (n: bigint, d = 1n) => frac(Rational.of(n, d));

async function oc3Stack(now = THURSDAY_1700) {
  const stack = await reviewStack(now);
  await stack.catalog.seedDefaults(D7_CATALOG_MANIFEST);
  await stack.journal.seedDefaults(D5_JOURNAL_MANIFEST);
  const strategies = await stack.catalog.query({ family: 'Strategy' });
  if (strategies.kind !== 'Page') throw new Error('no strategies');
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
  const plan: ConfirmPlanCommand['plan'] = {
    underlying: 'XYZ',
    legs: [{ side: 'Long', instrument: CALL, quantity: '2', intendedEntry: '2.00' }],
    stops: [{ kind: 'StructureValue', price: '1.00' }],
    targets: [{ kind: 'UnderlyingPrice', price: '60.00' }],
    exerciseIntent: 'NotAuthorized',
  };
  const strategy = strategyOf('strategy.long-call');
  const confirmed = await stack.tradeWorkflows.confirmPlan({
    accountId: stack.account.id,
    accountRevision: stack.account.recordRevision,
    strategyId: strategy.id,
    strategyRevision: strategy.recordRevision,
    economicTime: '2026-10-12T13:00:00Z',
    plan,
    reflection: {
      definitionId: stack.definition.id,
      answers: { 'prompt.plan-reflection.thesis': { kind: 'Text', text: 'Breakout.' }, 'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'The option at 1.00.' } },
    },
  });
  if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${confirmed.kind}`);
  const tradeId = confirmed.postCommit.trade.tradeId;

  const reasons = await stack.catalog.query({ family: 'CloseReason' });
  if (reasons.kind !== 'Page') throw new Error('no Close Reasons');
  const record = async (action: 'Buy' | 'Sell', economicTime: string, quantity: string, price: string, fee: string, reflection: ReflectionDisposition, closeReviewDisposition?: ReflectionDisposition) => {
    const current = await stack.tradeRecord.getRecord({ tradeId, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error('no Trade');
    const legId = (current.projection as unknown as { plan: { legs: { factId: string }[] } }).plan.legs[0]!.factId;
    const members: PositionChangeMember[] = [{ kind: 'Execution', tradeId, action, instrument: CALL, intent: { kind: 'ServesPlannedLeg', plannedLegId: legId }, quantity, price, fee, economicTime }];
    const result = await stack.tradeWorkflows.recordPositionChange({
      originTradeId: tradeId,
      trades: [{ tradeId, expectedFactRevision: current.factRevision }],
      members,
      reflection,
      ...(closeReviewDisposition && { closeReasonId: reasons.items[0]!.id, closeReview: closeReviewDisposition }),
    });
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${JSON.stringify(result)}`);
  };

  // A Daily Trade Review Action for a Review Date, saved at `momentTime`.
  const saveAction = async (reviewDate: string, momentTime: string) => {
    const definition = await stack.journal.getDefinitions({ latestFor: 'entry-type.daily-trade-review' });
    if (definition.kind !== 'Found') throw new Error('no Daily Trade Review definition');
    const prepared = await stack.journal.prepareEffects({
      obligation: 'DailyTradeReview',
      disposition: { kind: 'Complete', form: { definitionId: definition.definition.id, answers: { 'prompt.daily-trade-review.action': { kind: 'Option', optionId: 'option.daily-trade-review.action.hold' } } } },
      anchor: { kind: 'Trade', ref: tradeId },
      origin: { kind: 'DailyReview', ref: tradeId, reviewDate },
      momentTime,
    });
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${JSON.stringify(prepared)}`);
    const tx = beginSemanticTransaction();
    stack.journal.applyPreparedEffects(tx, prepared, {});
    const committed = await stack.persistence.commit(tx.close());
    if (committed.kind !== 'Committed') throw new Error(`expected Committed, got ${committed.kind}`);
  };

  const markBoth = async (date: string, xyz: string, call: string) => {
    await stack.saveMark(instrumentKey(XYZ), xyz, date);
    await stack.saveMark(instrumentKey(CALL), call, date);
  };

  // O-C3 as section 5 lists it: Mon, Wed and Thu Marks for both Instruments, none on Tuesday; the Tuesday Hold saved Wed 08:00,
  // the exit reflection deferred, and the Thursday Hold saved Thu 18:00.
  await record('Buy', '2026-10-12T14:00:00Z', '2', '2.00', '1.30', stack.reflection);
  await record('Sell', '2026-10-14T15:00:00Z', '1', '3.00', '0.65', { kind: 'Defer' });
  await markBoth(DATES.mon, '56.00', '2.10');
  await markBoth(DATES.wed, '57.40', '2.90');
  await markBoth(DATES.thu, '57.90', '3.20');
  await saveAction(DATES.tue, '2026-10-14T12:00:00Z');
  await saveAction(DATES.thu, '2026-10-15T22:00:00Z');

  const views = createTradeViews(stack);
  const detail = async () => {
    const result = await views.getTradeDetail({ tradeId });
    if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
    return result;
  };
  const replay = async () => {
    const { binding } = await detail();
    return views.replayTrade({ tradeId, binding });
  };
  return { stack, views, tradeId, strategy, closeReviewForm, record, saveAction, markBoth, detail, replay, confirmedPlan: confirmed };
}

function ready(result: Awaited<ReturnType<Awaited<ReturnType<typeof oc3Stack>>['replay']>>): TradeReplayView {
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${JSON.stringify(result)}`);
  return result.view;
}

describe('replayTrade (A212, A213)', () => {
  it("should replay O-C3 from Monday to the Expected Mark Date Thursday with section 5's figures, both Instruments' Marks and the Tuesday gap", async () => {
    const { replay, tradeId } = await oc3Stack();
    const view = ready(await replay());

    expect(view.tradeId).toBe(tradeId);
    expect(view.instruments).toEqual([XYZ, CALL]);
    expect(view.sessions.map((s) => s.date)).toEqual([DATES.mon, DATES.tue, DATES.wed, DATES.thu]);
    expect(view.sessions.map((s) => frac(s.heldQuantity))).toEqual([q(2n), q(2n), q(1n), q(1n)]);
    expect(view.sessions.map((s) => frac(s.realizedPnl))).toEqual([q(0n), q(0n), q(9870n, 100n), q(9870n, 100n)]);
    const pnl = (i: number) => {
      const p = view.sessions[i]!.tradePnl;
      return p.kind === 'Value' ? frac(p.value) : p;
    };
    expect([pnl(0), pnl(2), pnl(3)]).toEqual([q(1870n, 100n), q(18805n, 100n), q(21805n, 100n)]);
    expect(pnl(1)).toEqual({ kind: 'Unavailable', reason: 'MarkMissing', instrument: CALL, date: DATES.tue });
    const change = (i: number) => {
      const c = view.sessions[i]!.change;
      return c && { since: c.since, dollars: frac(c.dollars) };
    };
    expect([change(0), change(1), change(2), change(3)]).toEqual([null, null, { since: DATES.mon, dollars: q(16935n, 100n) }, { since: DATES.wed, dollars: q(3000n, 100n) }]);
    // Each session shows both Instruments in the view's order; Tuesday's are gaps, never carried forward.
    const marks = (i: number) =>
      view.sessions[i]!.marks.map((m) => ({
        instrument: m.instrument,
        price: m.resolution.kind === 'Available' ? m.resolution.mark.price : m.resolution.kind,
        change: m.change && { since: m.change.since, dollars: frac(m.change.dollars) },
      }));
    expect(marks(0)).toEqual([{ instrument: XYZ, price: '56', change: null }, { instrument: CALL, price: '2.1', change: null }]);
    expect(marks(1)).toEqual([{ instrument: XYZ, price: 'Missing', change: null }, { instrument: CALL, price: 'Missing', change: null }]);
    expect(marks(2)).toEqual([
      { instrument: XYZ, price: '57.4', change: { since: DATES.mon, dollars: q(140n, 100n) } },
      { instrument: CALL, price: '2.9', change: { since: DATES.mon, dollars: q(80n, 100n) } },
    ]);
    expect(marks(3)[1]).toEqual({ instrument: CALL, price: '3.2', change: { since: DATES.wed, dollars: q(30n, 100n) } });
    expect(view.sessions[2]!.positionChangeIds).toHaveLength(1);
  });

  it('should place each Journal item in its session: the Tuesday Action by its Review Date, the exit reflection in Wednesday\'s, the Plan Reflection in the Plan list', async () => {
    const { replay } = await oc3Stack();
    const view = ready(await replay());

    const kinds = (items: TradeReplayView['plan']) => items.map((item) => `${item.kind}:${item.entryTypeKey}`);
    expect(kinds(view.plan)).toEqual(['Entry:entry-type.plan-reflection']);
    expect(view.sessions.map((s) => kinds(s.journal))).toEqual([
      ['Entry:entry-type.position-change-reflection'],
      // Saved Wednesday 08:00, it belongs to Tuesday, its Review Date.
      ['Entry:entry-type.daily-trade-review'],
      ['Debt:entry-type.position-change-reflection'],
      ['Entry:entry-type.daily-trade-review'],
    ]);
    const tuesday = view.sessions[1]!.journal[0]!;
    expect(tuesday.kind === 'Entry' && tuesday.reviewDate).toBe(DATES.tue);
    expect(view.pending).toEqual({ date: DATES.fri, journal: [] });
  });

  it('should place an entry saved after Thursday\'s Mark in the session not yet ended', async () => {
    const { stack, record, replay } = await oc3Stack(THURSDAY_1830);
    // A third contract bought Thursday 18:15, after Thursday's close: its reflection belongs to Friday's session, not yet ended.
    await record('Buy', '2026-10-15T22:15:00Z', '1', '3.30', '0.65', stack.reflection);
    const view = ready(await replay());

    const kinds = (items: TradeReplayView['plan']) => items.map((item) => `${item.kind}:${item.entryTypeKey}`);
    expect(view.sessions.map((s) => s.date)).toEqual([DATES.mon, DATES.tue, DATES.wed, DATES.thu]);
    expect(kinds(view.sessions[3]!.journal)).toEqual(['Entry:entry-type.daily-trade-review']);
    expect(view.pending).toEqual({ date: DATES.fri, journal: [expect.objectContaining({ kind: 'Entry', entryTypeKey: 'entry-type.position-change-reflection' })] });
  });

  it('should end a Closed Trade at its final session', async () => {
    const { record, closeReviewForm, stack, replay } = await oc3Stack();
    // The last contract is sold Wednesday 12:00, which closes the Trade; Thursday's Mark and Hold were saved before.
    await record('Sell', '2026-10-14T16:00:00Z', '1', '3.10', '0.65', stack.reflection, closeReviewForm);
    const view = ready(await replay());

    expect(view.sessions.map((s) => s.date)).toEqual([DATES.mon, DATES.tue, DATES.wed]);
    const final = view.sessions[2]!;
    expect(frac(final.heldQuantity)).toBe(q(0n));
    expect(final.positionChangeIds).toHaveLength(2);
    expect(view.pending).toBeNull();
    // An item after the final session stays with it, since a Closed Trade has no session not yet ended.
    expect(final.journal.map((item) => item.kind === 'Entry' && item.reviewDate)).toContain(DATES.thu);
  });

  it("should return Not applicable for a Planned Trade and for facts that can't be replayed", async () => {
    const stack = await reviewStack(THURSDAY_1700);
    const views = createTradeViews(stack);
    const replayOf = async (tradeId: string) => {
      const detail = await views.getTradeDetail({ tradeId });
      if (detail.kind !== 'Ready') throw new Error(`expected Ready, got ${detail.kind}`);
      return views.replayTrade({ tradeId, binding: detail.binding });
    };
    const planned = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    // Exactly this result: no view, and no findings for a Trade that was never exposed.
    expect(await replayOf(planned.tradeId)).toEqual({ kind: 'NotApplicable', reason: 'NeverExposed' });

    const broken = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
    await stack.fill(broken, '2026-10-12T14:00:00Z', '100', '30.00');
    await breakFirstExecution(stack, broken.tradeId);
    const incoherent = await replayOf(broken.tradeId);
    expect(incoherent).toEqual({ kind: 'NotApplicable', reason: 'FactsIncoherent', findings: expect.any(Array) as unknown });
    expect(incoherent.kind === 'NotApplicable' && incoherent.reason === 'FactsIncoherent' && incoherent.findings.length).toBeGreaterThan(0);
    expect(incoherent).not.toHaveProperty('view');
  });

  it("should return ChangedDuringAssembly when a Mark is saved after the Detail's binding", async () => {
    const { detail, markBoth, views, tradeId } = await oc3Stack();
    const { binding } = await detail();
    // Tuesday's gap is filled after the Detail was read: the replay would no longer sit beside it.
    await markBoth(DATES.tue, '56.50', '2.40');

    expect(await views.replayTrade({ tradeId, binding })).toEqual({ kind: 'ChangedDuringAssembly' });
    const { binding: current } = await detail();
    expect(await views.replayTrade({ tradeId, binding: current })).toEqual(expect.objectContaining({ kind: 'Ready' }));
  });
});

describe('replayTrade: Mark provenance (revision 93)', () => {
  it("should carry each replayed Mark's source, saved time and correction reason from the series", async () => {
    const { stack, replay } = await oc3Stack();
    // Thursday's call Mark (the session's own date) is corrected; Monday's (a scanned session) keeps its first revision.
    const corrected = await stack.marketData.save({ intention: 'CorrectMark', instrumentKey: instrumentKey(CALL), tradingDate: DATES.thu, price: '3.25', reason: 'Typo', expectedResolutionRevision: 1 });
    if (corrected.kind !== 'Saved') throw new Error(`expected Saved, got ${corrected.kind}`);
    const view = ready(await replay());

    const callMark = (i: number) => view.sessions[i]!.marks[1]!.resolution;
    expect(callMark(0)).toEqual({ kind: 'Available', mark: { price: '2.1', revisionNumber: 1, source: 'Manual', savedAt: THURSDAY_1700 } });
    expect(callMark(0)).not.toHaveProperty('mark.correctionReason');
    expect(callMark(3)).toEqual({ kind: 'Available', mark: { price: '3.25', revisionNumber: 2, source: 'Manual', savedAt: THURSDAY_1700, correctionReason: 'Typo' } });
  });
});
