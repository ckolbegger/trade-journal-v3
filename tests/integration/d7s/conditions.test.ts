// I7S.4, I7S.5 and I7S.8: O-S2, the Cash-Secured Put holding both condition kinds (D7S section 4), through the real
// facade on fake-indexeddb. The Marks are saved session by session, as the clock reaches each session's close, and the
// application restarts between sessions (AC-CALC-003, AC-CALC-002 re-proven).
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { Rational } from '../../../src/domain/values/index.ts';
import { dec, detailOf, dumpAll, listed, onboardedAt, openOs2, restart, saveSession, THURSDAY, THURSDAY_1700_NY, TUESDAY, TUESDAY_1700_NY, WEDNESDAY, WEDNESDAY_1700_NY, workspaceStores } from './support.ts';

const r = (n: bigint, d = 1n) => Rational.of(n, d);
const value = (x: Rational) => ({ kind: 'Value', value: x });

// The current figures of a Detail or an Open list row, as the plan's table gives them.
interface Current {
  readonly ongoingRiskToStop: unknown;
  readonly ongoingRiskToStopInPlanR: unknown;
  readonly incrementalRewardToTarget: unknown;
  readonly incrementalRewardToTargetInPlanR: unknown;
  readonly worstCaseOngoingRisk: unknown;
  readonly worstCaseOngoingRiskInPlanR: unknown;
  readonly maximumIncrementalReward: unknown;
  readonly currentMarkedPnl: unknown;
  readonly deviations?: unknown;
  readonly conditions: readonly { id: string; role: string; kind: string; result: { kind: string; value?: { status: string; distance: { dollars: Rational; planR: Rational }; overrun: { dollars: Rational; planR: Rational } | null; underlying?: { beyond: Rational | null } } } }[];
}

const detailCurrent = async (app: Application, tradeId: string) => {
  const detail = await detailOf(app, tradeId);
  if (!('current' in detail)) throw new Error('expected a Detail with current figures');
  // The Detail carries the evaluation (kind Evaluated) under `current`; an Open row carries the same figures flat.
  return (detail.current as unknown as { evaluation: Current }).evaluation;
};
const rowCurrent = async (app: Application, tradeId: string) => {
  const row = (await listed(app, 'Open')).find((item) => item.tradeId === tradeId);
  if (!row || !('current' in row)) throw new Error('expected the Open row with current figures');
  return row.current as unknown as Current;
};

// Each condition as [id, kind, status, distance, overrun in dollars] and the headline figures.
const conditionRows = (current: Current) =>
  current.conditions.map((c) => [c.id, c.kind, c.result.value?.status, c.result.value?.distance.dollars, c.result.value?.overrun?.dollars ?? null]);
const headline = (current: Current) => [current.ongoingRiskToStop, current.ongoingRiskToStopInPlanR, current.incrementalRewardToTarget, current.incrementalRewardToTargetInPlanR];

const UP = 'UnderlyingPrice';
const SV = 'StructureValue';

describe('I7S.4 One crossed Stop and one reached Target', () => {
  it('should give O-S2 its four condition results and headlines of section 4 on Tuesday, Wednesday and Thursday, Thursday with S-o Breached and T-u Reached at once, restarting between and leaving the Deviation set empty', async () => {
    const { d, app: first } = await onboardedAt(TUESDAY_1700_NY);
    let app = first;
    const tradeId = await openOs2(app);
    await saveSession(app, TUESDAY, { mno: '44.00', put: '1.80' });

    const tuesday = await detailCurrent(app, tradeId);
    expect(conditionRows(tuesday)).toEqual([
      ['stop-1', UP, 'Active', r(440n), null],
      ['stop-2', SV, 'Active', r(360n), null],
      ['target-1', UP, 'Active', r(260n), null],
      ['target-2', SV, 'Active', r(300n), null],
    ]);
    // 1R is $480: the risk of $360 is 3/4 R and the reward of $260 is 13/24 R.
    expect(headline(tuesday)).toEqual([value(r(360n)), value(r(3n, 4n)), value(r(260n)), value(r(13n, 24n))]);
    expect(await rowCurrent(app, tradeId)).toEqual(expect.objectContaining({ conditions: tuesday.conditions, ongoingRiskToStop: tuesday.ongoingRiskToStop, incrementalRewardToTarget: tuesday.incrementalRewardToTarget }));

    app = await restart(app, { ...d, now: WEDNESDAY_1700_NY });
    await saveSession(app, WEDNESDAY, { mno: '43.20', put: '3.70' });
    const wednesday = await detailCurrent(app, tradeId);
    expect(conditionRows(wednesday)).toEqual([
      ['stop-1', UP, 'Active', r(60n), null],
      ['stop-2', SV, 'Breached', r(0n), r(20n)],
      ['target-1', UP, 'Active', r(640n), null],
      ['target-2', SV, 'Active', r(680n), null],
    ]);
    expect(wednesday.conditions[1]!.result.value!.overrun!.planR).toEqual(r(1n, 24n));
    expect(headline(wednesday)).toEqual([value(r(0n)), value(r(0n)), value(r(640n)), value(r(4n, 3n))]);
    expect(await rowCurrent(app, tradeId)).toEqual(expect.objectContaining({ conditions: wednesday.conditions, ongoingRiskToStop: wednesday.ongoingRiskToStop, incrementalRewardToTarget: wednesday.incrementalRewardToTarget }));

    app = await restart(app, { ...d, now: THURSDAY_1700_NY });
    await saveSession(app, THURSDAY, { mno: '44.60', put: '3.65' });
    const thursday = await detailCurrent(app, tradeId);
    // The volatility spike: the put trades rich while MNO recovers, so one Stop is crossed and one Target reached.
    expect(conditionRows(thursday)).toEqual([
      ['stop-1', UP, 'Active', r(70n), null],
      ['stop-2', SV, 'Breached', r(0n), r(10n)],
      ['target-1', UP, 'Reached', r(0n), r(0n)],
      ['target-2', SV, 'Active', r(670n), null],
    ]);
    expect(thursday.conditions[2]!.result.value!.underlying!.beyond).toEqual(dec('0.10'));
    expect(headline(thursday)).toEqual([value(r(0n)), value(r(0n)), value(r(0n)), value(r(0n))]);
    expect(thursday.worstCaseOngoingRisk).toEqual(value(r(8270n)));
    expect(thursday.worstCaseOngoingRiskInPlanR).toEqual(value(r(827n, 48n)));
    expect(thursday.maximumIncrementalReward).toEqual(value(r(730n)));
    // The Current Marked P&L comes from the put's Mark 3.65: the open cost 250, the market value 730 and the opening fee 1.30.
    expect(thursday.currentMarkedPnl).toEqual(value(dec('-481.30')));
    expect(await rowCurrent(app, tradeId)).toEqual(expect.objectContaining({ conditions: thursday.conditions, ongoingRiskToStop: thursday.ongoingRiskToStop, incrementalRewardToTarget: thursday.incrementalRewardToTarget }));

    // The Trade stays Open on every day, and its Deviation set is empty in the evaluation and in the stored facts.
    for (const current of [tuesday, wednesday, thursday]) expect(current.deviations).toEqual([]);
    expect((await detailOf(app, tradeId)).lifecycle).toEqual({ stored: 'Open', agreement: { kind: 'Agrees' } });
    expect((await listed(app, 'Open')).map((item) => item.tradeId)).toEqual([tradeId]);
    const stored = workspaceStores(await dumpAll(d.factory))['trades'] as { deviations: unknown[] }[];
    expect(stored.map((trade) => trade.deviations)).toEqual([[]]);
  }, 120_000);
});

const unavailable = (instrumentSymbol: string) => ({ kind: 'Unavailable', reason: 'MarkMissing', instrument: expect.objectContaining({ symbol: instrumentSymbol }) as unknown });

describe('I7S.5 Underlying Mark missing', () => {
  it('should read O-S2 with only the put Marked, Tuesday with Ongoing Risk and S-u Unavailable naming MNO and Wednesday with Ongoing Risk 0.00 from S-o and Incremental Reward Unavailable naming MNO and 2026-10-14', async () => {
    const { d, app: first } = await onboardedAt(TUESDAY_1700_NY);
    let app = first;
    const tradeId = await openOs2(app);
    await saveSession(app, TUESDAY, { put: '1.80' });

    const tuesday = (await detailCurrent(app, tradeId)) as Current & { remainingOpenPnl: unknown };
    expect(tuesday.ongoingRiskToStop).toEqual(expect.objectContaining(unavailable('MNO')));
    expect(tuesday.conditions.map((c) => [c.id, c.result.kind])).toEqual([['stop-1', 'Unavailable'], ['stop-2', 'Value'], ['target-1', 'Unavailable'], ['target-2', 'Value']]);
    expect(tuesday.conditions[0]!.result).toEqual(expect.objectContaining(unavailable('MNO')));
    expect(tuesday.conditions[1]!.result.value!.distance.dollars).toEqual(r(360n));
    expect(tuesday.conditions[3]!.result.value!.distance.dollars).toEqual(r(300n));
    // The valuation needs only the put's Mark, so it is a Value.
    expect(tuesday.currentMarkedPnl).toEqual(value(dec('-111.30')));
    expect(tuesday.remainingOpenPnl).toEqual(value(dec('-111.30')));

    app = await restart(app, { ...d, now: WEDNESDAY_1700_NY });
    await saveSession(app, WEDNESDAY, { put: '3.70' });
    const wednesday = await detailCurrent(app, tradeId);
    // S-o is crossed at 3.70, so the headline Stop is reached whatever MNO did; P91 leaves the reward unavailable.
    expect(wednesday.ongoingRiskToStop).toEqual(value(r(0n)));
    expect(wednesday.incrementalRewardToTarget).toEqual(expect.objectContaining({ ...unavailable('MNO'), date: WEDNESDAY }));
    expect(wednesday.conditions[1]!.result.value!.status).toBe('Breached');
  }, 120_000);
});

describe('I7S.8 Entry Quality', () => {
  it('should give O-S2 after S1 an actual initial risk of 471.30, reward 148.70, risk 4713/4800 R and slippage -10.00', async () => {
    const { app } = await onboardedAt(TUESDAY_1700_NY);
    const tradeId = await openOs2(app);

    const detail = await detailOf(app, tradeId);
    if (!('entryQuality' in detail) || detail.entryQuality.kind !== 'Value') throw new Error('expected Entry Quality');
    const quality = detail.entryQuality.value;
    expect(quality.actualInitialRisk).toEqual(value(dec('471.30')));
    expect(quality.actualInitialReward).toEqual(value(dec('148.70')));
    expect(quality.riskInPlanR).toEqual(value(r(4713n, 4800n)));
    expect(quality.slippage).toEqual(value(dec('-10.00')));
  }, 60_000);
});
