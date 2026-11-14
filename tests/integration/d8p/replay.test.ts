// The D08P Node application-stack suite for replayTrade (plan section 6.1, I8P.1 to I8P.3 and I8P.7): the real facade from
// createApplication on fake-indexeddb, called through facade operations only. O-C3 and its clocks come from ./support.ts.
// Titles are the section 6.1 names word for word (the D8P detail.test.ts, from T8P.9, uses "should ..." titles instead).
import { describe, expect, it } from 'vitest';
import type { TradeReplayView } from '../../../src/coordinators/trade-views/index.ts';
import { Rational } from '../../../src/domain/values/index.ts';
import {
  closeReasonId, closeReviewDisposition, complete, confirmReference, currentDatabase, device, launch, onboarded, openReview, PC1, rawUpdate, record, recordOption, restart,
} from '../d7s/support.ts';
import { CALL_KEY, DATES, FRIDAY_1700, oc3, replayOf, XYZ, XYZ_DEC_CALL } from './support.ts';

const frac = (r: Rational) => `${r.numerator}/${r.denominator}`;
const q = (n: bigint, d = 1n) => frac(Rational.of(n, d));

function ready(result: Awaited<ReturnType<typeof replayOf>>['replay']): TradeReplayView {
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${JSON.stringify(result)}`);
  return result.view;
}

// Section 5's figures, as plain values, so two reads compare by value.
function figures(view: TradeReplayView) {
  return view.sessions.map((s) => ({
    date: s.date,
    held: frac(s.heldQuantity),
    realized: frac(s.realizedPnl),
    tradePnl: s.tradePnl.kind === 'Value' ? frac(s.tradePnl.value) : s.tradePnl,
    change: s.change && { since: s.change.since, dollars: frac(s.change.dollars) },
    marks: s.marks.map((m) => ({
      instrument: m.instrument,
      price: m.resolution.kind === 'Available' ? m.resolution.mark.price : m.resolution.kind,
      change: m.change && { since: m.change.since, dollars: frac(m.change.dollars) },
    })),
  }));
}

const kinds = (items: TradeReplayView['plan']) => items.map((item) => `${item.kind}:${item.entryTypeKey}`);

describe('I8P.1 Replay with a gap (AC-MARK-004, partial)', () => {
  it('I8P.1 Replay with a gap (AC-MARK-004, partial)', { timeout: 120_000 }, async () => {
    const { d, app, tradeId } = await oc3();

    const { replay } = await replayOf(app, tradeId);
    const view = ready(replay);

    expect(view.tradeId).toBe(tradeId);
    expect(view.instruments).toEqual([XYZ, XYZ_DEC_CALL]);
    expect(figures(view)).toEqual([
      { date: DATES.mon, held: q(2n), realized: q(0n), tradePnl: q(1870n, 100n), change: null, marks: [{ instrument: XYZ, price: '56', change: null }, { instrument: XYZ_DEC_CALL, price: '2.1', change: null }] },
      // Tuesday: a gap for both Instruments, no value carried from Monday, and nothing to change from.
      {
        date: DATES.tue, held: q(2n), realized: q(0n), tradePnl: { kind: 'Unavailable', reason: 'MarkMissing', instrument: XYZ_DEC_CALL, date: DATES.tue }, change: null,
        marks: [{ instrument: XYZ, price: 'Missing', change: null }, { instrument: XYZ_DEC_CALL, price: 'Missing', change: null }],
      },
      {
        date: DATES.wed, held: q(1n), realized: q(9870n, 100n), tradePnl: q(18805n, 100n), change: { since: DATES.mon, dollars: q(16935n, 100n) },
        marks: [{ instrument: XYZ, price: '57.4', change: { since: DATES.mon, dollars: q(140n, 100n) } }, { instrument: XYZ_DEC_CALL, price: '2.9', change: { since: DATES.mon, dollars: q(80n, 100n) } }],
      },
      {
        date: DATES.thu, held: q(1n), realized: q(9870n, 100n), tradePnl: q(21805n, 100n), change: { since: DATES.wed, dollars: q(3000n, 100n) },
        marks: [{ instrument: XYZ, price: '57.9', change: { since: DATES.wed, dollars: q(50n, 100n) } }, { instrument: XYZ_DEC_CALL, price: '3.2', change: { since: DATES.wed, dollars: q(30n, 100n) } }],
      },
    ]);

    // After a restart the same Workspace gives the same replay, from a fresh Detail's binding.
    const again = await replayOf(await restart(app, d), tradeId);
    expect(again.replay).toEqual(replay);
  });
});

describe('I8P.2 Journal by session', () => {
  it('I8P.2 Journal by session', { timeout: 120_000 }, async () => {
    const { app, tradeId } = await oc3({ thursdayHold: true });

    const view = ready((await replayOf(app, tradeId)).replay);

    // The Plan Reflection (Mon 09:00) precedes the first exposure, so it is in the Plan list.
    expect(kinds(view.plan)).toEqual(['Entry:entry-type.plan-reflection']);
    expect(view.sessions.map((s) => s.date)).toEqual([DATES.mon, DATES.tue, DATES.wed, DATES.thu]);
    expect(view.sessions.map((s) => kinds(s.journal))).toEqual([
      // Monday: the entry reflection (10:05).
      ['Entry:entry-type.position-change-reflection'],
      // Tuesday: the Hold, saved Wednesday 08:00, by its Review Date.
      ['Entry:entry-type.daily-trade-review'],
      // Wednesday: the owed exit reflection (11:05), the first session whose close is at or after it.
      ['Debt:entry-type.position-change-reflection'],
      // Thursday: the Hold saved Thursday 18:00, by its Review Date.
      ['Entry:entry-type.daily-trade-review'],
    ]);
    const hold = (i: number) => {
      const item = view.sessions[i]!.journal[0]!;
      return item.kind === 'Entry' && item.reviewDate;
    };
    expect([hold(1), hold(3)]).toEqual([DATES.tue, DATES.thu]);
    expect(view.pending).toEqual({ date: DATES.fri, journal: [] });
  });
});

describe('I8P.3 Coherence', () => {
  it('I8P.3 Coherence', { timeout: 120_000 }, async () => {
    const { d, app, tradeId } = await oc3();
    const before = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
    if (before.kind !== 'Ready') throw new Error(`getTradeDetail: ${before.kind}`);

    // Thursday's call Mark is corrected through the Review (3.20 to 3.25), after the Detail was read.
    const opened = await openReview(app, d);
    const marks = opened.families.find((f) => f.family === 'Marks');
    const row = marks?.family === 'Marks' ? marks.today.find((r) => r.instrumentKey === CALL_KEY) : undefined;
    if (!row) throw new Error('the Review has no Thursday row for the call');
    const entries = [{ key: { instrumentKey: CALL_KEY, tradingDate: DATES.thu }, expectedRevision: row.resolutionRevision, intention: { kind: 'CorrectMark' as const, price: '3.25', reason: 'A better quote.' } }];
    const saved = await app.DailyReview.save({ kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, tradeId, binding: opened.binding, entries });
    if (saved.kind !== 'MarksSaved') throw new Error(`SaveReviewMarks: ${saved.kind}`);

    expect(await app.TradeViewsAndReporting.replayTrade({ tradeId, binding: before.binding })).toEqual({ kind: 'ChangedDuringAssembly' });

    const { detail, replay } = await replayOf(app, tradeId);
    const view = ready(replay);
    const newest = view.sessions[view.sessions.length - 1]!;
    // Thursday's call Mark 3.25: 218.05 + 0.05 x 100 = 223.05, in both reads.
    expect(newest.tradePnl.kind === 'Value' && frac(newest.tradePnl.value)).toBe(q(22305n, 100n));
    if (!('current' in detail.view)) throw new Error('expected an Open Detail');
    const current = detail.view.current.evaluation.currentMarkedPnl;
    expect(current.kind === 'Value' && frac(current.value)).toBe(q(22305n, 100n));
    expect(view.sessions.map((s) => s.date)).toEqual([DATES.mon, DATES.tue, DATES.wed, DATES.thu]);
  });
});

describe('I8P.7 Closed, Planned and incoherent replay', () => {
  it('I8P.7 Closed, Planned and incoherent replay', { timeout: 120_000 }, async () => {
    // O-C3 sold out Friday 11:00: the last contract, with the Close Reason and a completed Close Review.
    const { d, app: thursday, tradeId } = await oc3();
    const friday = await restart(thursday, { ...d, now: FRIDAY_1700 });
    await recordOption(
      friday, tradeId, 'Sell', { quantity: '1', price: '3.40', economicTime: '2026-10-16T15:00:00Z', fee: '0.65' },
      { closeReasonId: await closeReasonId(friday, 'Target Reached'), closeReview: await closeReviewDisposition(friday, 'Complete') },
    );

    const closed = ready((await replayOf(friday, tradeId)).replay);

    expect(closed.sessions.map((s) => s.date)).toEqual([DATES.mon, DATES.tue, DATES.wed, DATES.thu, DATES.fri]);
    expect(frac(closed.sessions[4]!.heldQuantity)).toBe(q(0n));
    expect(closed.pending).toBeNull();

    // A Planned Trade was never exposed.
    const workspace = await device();
    const planApp = await onboarded(workspace);
    const planned = await confirmReference(planApp);
    expect((await replayOf(planApp, planned)).replay).toEqual({ kind: 'NotApplicable', reason: 'NeverExposed' });

    // D2's incoherent fixture: an Execution points at an unknown Planned Leg while no application is open.
    const opened = await record(planApp, planned, PC1, await complete(planApp));
    const execution = opened.postCommit.trade.positionChanges[0]!.executions[0]!.factId;
    planApp.persistence.close();
    type Fact = { factId: string; versions: { value: Record<string, unknown> }[] };
    await rawUpdate(workspace.factory, await currentDatabase(workspace.factory), 'trades', planned, (trade) => ({
      ...trade,
      facts: (trade['facts'] as Fact[]).map((fact) =>
        fact.factId === execution ? { ...fact, versions: fact.versions.map((v) => ({ ...v, value: { ...v.value, intent: { kind: 'ServesPlannedLeg', plannedLegId: 'leg-unknown' } } })) } : fact,
      ),
    }));
    const incoherent = (await replayOf(await launch(workspace), planned)).replay;
    expect(incoherent).toEqual({ kind: 'NotApplicable', reason: 'FactsIncoherent', findings: expect.arrayContaining([expect.objectContaining({ factId: execution, reason: 'UnknownPlannedLeg' })]) as unknown });
  });
});
