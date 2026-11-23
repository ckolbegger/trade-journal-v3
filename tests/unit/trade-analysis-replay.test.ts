import { describe, expect, it } from 'vitest';
import { ExactNumber, fromDecimalString } from '../../src/shared/exact-number';
import {
  diffStopDisciplineDeviationRecords,
  reconcileStopDisciplineEpisodes,
} from '../../src/trade-analysis/replay';

describe('TradeAnalysis.replay (Continuous Stop-Discipline Episodes — AC-REV-004)', () => {
  it('groups consecutive Holds past Stop into ONE continuous episode with zero daily duplicates, splits separate episodes on recovery, and shrinks/voids on Exit', () => {
    const stopPrice = ExactNumber.toJSON(fromDecimalString('47.00'));
    const execs = [
      {
        id: 'b1',
        tradeId: 'trd-axio',
        positionChangeId: 'pc-1',
        side: 'Buy' as const,
        quantity: ExactNumber.toJSON(fromDecimalString('100')),
        fillPrice: ExactNumber.toJSON(fromDecimalString('50.00')),
        fee: ExactNumber.toJSON(fromDecimalString('0.00')),
        plannedLegIntent: 'PlannedLeg' as const,
        economicTime: '2026-11-02T15:00:00.000Z',
        recordedSequence: 2,
        recordedAt: '2026-11-02T15:00:05.000Z',
      },
    ];

    const marks = [
      { sessionDate: '2026-11-02', price: ExactNumber.toJSON(fromDecimalString('49.50')) },
      // Episode 1: 3 sessions past Stop (Nov 3 = $46.00, Nov 4 = $45.00 [max overrun $200], Nov 5 = $45.50)
      { sessionDate: '2026-11-03', price: ExactNumber.toJSON(fromDecimalString('46.00')) },
      { sessionDate: '2026-11-04', price: ExactNumber.toJSON(fromDecimalString('45.00')) },
      { sessionDate: '2026-11-05', price: ExactNumber.toJSON(fromDecimalString('45.50')) },
      // Recovery above Stop on Nov 6 ($48.00)
      { sessionDate: '2026-11-06', price: ExactNumber.toJSON(fromDecimalString('48.00')) },
      // Episode 2: Breached again on Nov 9 ($46.50)
      { sessionDate: '2026-11-09', price: ExactNumber.toJSON(fromDecimalString('46.50')) },
    ];

    const actions = [
      { reviewDate: '2026-11-02', action: 'Hold' as const },
      { reviewDate: '2026-11-03', action: 'Hold' as const },
      { reviewDate: '2026-11-04', action: 'Hold' as const },
      { reviewDate: '2026-11-05', action: 'Hold' as const },
      { reviewDate: '2026-11-06', action: 'Hold' as const },
      { reviewDate: '2026-11-09', action: 'Hold' as const },
    ];

    const episodes = reconcileStopDisciplineEpisodes({
      tradeId: 'trd-axio',
      stopPrice,
      executions: execs,
      effectiveMarks: marks,
      reviewActions: actions,
    });

    expect(episodes).toHaveLength(2);
    expect(episodes[0]).toMatchObject({
      episodeFingerprint: 'trd-axio::stop::2026-11-03',
      startSessionDate: '2026-11-03',
      endSessionDate: '2026-11-05',
      sessionCount: 3,
      maxOverrunDisplay: '-$200.00',
    });
    expect(episodes[1]).toMatchObject({
      episodeFingerprint: 'trd-axio::stop::2026-11-09',
      startSessionDate: '2026-11-09',
      endSessionDate: '2026-11-09',
      sessionCount: 1,
      maxOverrunDisplay: '-$50.00',
    });

    // If Nov 9 is switched to Exit, Episode 2 vanishes cleanly (voidable on reconciliation)
    const afterExit = reconcileStopDisciplineEpisodes({
      tradeId: 'trd-axio',
      stopPrice,
      executions: execs,
      effectiveMarks: marks,
      reviewActions: actions.map((a) =>
        a.reviewDate === '2026-11-09' ? { reviewDate: a.reviewDate, action: 'Exit' as const } : a,
      ),
    });
    expect(afterExit).toHaveLength(1);
    expect(afterExit[0]?.episodeFingerprint).toBe('trd-axio::stop::2026-11-03');
  });

  it('flushes active episode when an intermediate session has a Mark recovered above Stop even with no Review Action', () => {
    const stopPrice = ExactNumber.toJSON(fromDecimalString('47.00'));
    const execs = [
      {
        id: 'ex-1',
        tradeId: 'trd-gap',
        positionChangeId: 'pc-1',
        side: 'Buy' as const,
        quantity: ExactNumber.toJSON(fromDecimalString('100')),
        fillPrice: ExactNumber.toJSON(fromDecimalString('50.00')),
        fee: ExactNumber.toJSON(fromDecimalString('0.00')),
        plannedLegIntent: 'PlannedLeg' as const,
        economicTime: '2026-11-02T15:00:00.000Z',
        recordedSequence: 2,
        recordedAt: '2026-11-02T15:00:05.000Z',
      },
    ];
    const marks = [
      { sessionDate: '2026-11-03', price: ExactNumber.toJSON(fromDecimalString('46.00')) },
      // Recovered above 47.00 on Nov 4, with NO Review Action logged that day
      { sessionDate: '2026-11-04', price: ExactNumber.toJSON(fromDecimalString('48.50')) },
      { sessionDate: '2026-11-05', price: ExactNumber.toJSON(fromDecimalString('45.50')) },
    ];
    const actions = [
      { reviewDate: '2026-11-03', action: 'Hold' as const },
      { reviewDate: '2026-11-05', action: 'Hold' as const },
    ];

    const episodes = reconcileStopDisciplineEpisodes({
      tradeId: 'trd-gap',
      stopPrice,
      executions: execs,
      effectiveMarks: marks,
      reviewActions: actions,
    });

    expect(episodes).toHaveLength(2);
    expect(episodes[0]?.startSessionDate).toBe('2026-11-03');
    expect(episodes[0]?.sessionCount).toBe(1);
    expect(episodes[1]?.startSessionDate).toBe('2026-11-05');
    expect(episodes[1]?.sessionCount).toBe(1);
  });

  it('ends active episode on an unreviewed breached session so gapped Holds stay separate episodes', () => {
    const stopPrice = ExactNumber.toJSON(fromDecimalString('47.00'));
    const execs = [
      {
        id: 'ex-1',
        tradeId: 'trd-unrev',
        positionChangeId: 'pc-1',
        side: 'Buy' as const,
        quantity: ExactNumber.toJSON(fromDecimalString('100')),
        fillPrice: ExactNumber.toJSON(fromDecimalString('50.00')),
        fee: ExactNumber.toJSON(fromDecimalString('0.00')),
        plannedLegIntent: 'PlannedLeg' as const,
        economicTime: '2026-11-02T15:00:00.000Z',
        recordedSequence: 2,
        recordedAt: '2026-11-02T15:00:05.000Z',
      },
    ];
    const marks = [
      { sessionDate: '2026-11-03', price: ExactNumber.toJSON(fromDecimalString('46.00')) },
      { sessionDate: '2026-11-04', price: ExactNumber.toJSON(fromDecimalString('45.50')) },
      { sessionDate: '2026-11-05', price: ExactNumber.toJSON(fromDecimalString('45.00')) },
    ];
    // Nov 4 has no Review Action logged
    const actions = [
      { reviewDate: '2026-11-03', action: 'Hold' as const },
      { reviewDate: '2026-11-05', action: 'Hold' as const },
    ];

    const episodes = reconcileStopDisciplineEpisodes({
      tradeId: 'trd-unrev',
      stopPrice,
      executions: execs,
      effectiveMarks: marks,
      reviewActions: actions,
    });
    expect(episodes).toHaveLength(2);
    expect(episodes[0]?.sessionCount).toBe(1);
    expect(episodes[1]?.sessionCount).toBe(1);
  });

  it('diffStopDisciplineDeviationRecords reuses identical active records, un-voids, and voids stale or untagged ones', () => {
    const stopPrice = ExactNumber.toJSON(fromDecimalString('47.00'));
    const execs = [
      {
        id: 'ex-1',
        tradeId: 'trd-diff',
        positionChangeId: 'pc-1',
        side: 'Buy' as const,
        quantity: ExactNumber.toJSON(fromDecimalString('100')),
        fillPrice: ExactNumber.toJSON(fromDecimalString('50.00')),
        fee: ExactNumber.toJSON(fromDecimalString('0.00')),
        plannedLegIntent: 'PlannedLeg' as const,
        economicTime: '2026-11-02T15:00:00.000Z',
        recordedSequence: 2,
        recordedAt: '2026-11-02T15:00:05.000Z',
      },
    ];
    const marks = [
      { sessionDate: '2026-11-03', price: ExactNumber.toJSON(fromDecimalString('46.00')) },
    ];
    let seq = 1;
    const genId = (p: string) => `${p}-${seq++}`;

    // (a) Initial create
    const initialWrites = diffStopDisciplineDeviationRecords({
      tradeId: 'trd-diff',
      stopPrice,
      executions: execs,
      effectiveMarks: marks,
      reviewActions: [{ reviewDate: '2026-11-03', action: 'Hold' }],
      existingDeviations: [],
      nowIso: '2026-11-03T22:00:00.000Z',
      generateId: genId,
    });
    expect(initialWrites).toHaveLength(1);
    const created = initialWrites[0]!;

    // (a2) Identical non-voided existing record + already-voided stale record -> zero redundant writes!
    const noOpWrites = diffStopDisciplineDeviationRecords({
      tradeId: 'trd-diff',
      stopPrice,
      executions: execs,
      effectiveMarks: marks,
      reviewActions: [{ reviewDate: '2026-11-03', action: 'Hold' }],
      existingDeviations: [
        created,
        {
          id: 'dev-already-voided',
          tradeId: 'trd-diff',
          kind: 'StopDiscipline',
          episodeFingerprint: 'trd-diff::stop::2026-11-01',
          message: 'old',
          voided: true,
          recordedAt: '2026-11-01T22:00:00.000Z',
        },
      ],
      nowIso: '2026-11-04T22:00:00.000Z',
      generateId: genId,
    });
    expect(noOpWrites).toHaveLength(0);

    // (b) Switch Nov 3 to Exit -> voids active record & untagged legacy record
    const voidWrites = diffStopDisciplineDeviationRecords({
      tradeId: 'trd-diff',
      stopPrice,
      executions: execs,
      effectiveMarks: marks,
      reviewActions: [{ reviewDate: '2026-11-03', action: 'Exit' }],
      existingDeviations: [
        created,
        {
          id: 'dev-untagged',
          tradeId: 'trd-diff',
          kind: 'StopDiscipline',
          message: 'legacy',
          recordedAt: '2026-11-03T00:00:00.000Z',
        },
      ],
      nowIso: '2026-11-04T22:00:00.000Z',
      generateId: genId,
    });
    expect(voidWrites).toHaveLength(2);
    expect(voidWrites.every((w) => w.voided === true)).toBe(true);

    // (c) Un-voids previously voided record when fingerprint becomes desired again, keeping id & recordedAt
    const unvoidWrites = diffStopDisciplineDeviationRecords({
      tradeId: 'trd-diff',
      stopPrice,
      executions: execs,
      effectiveMarks: marks,
      reviewActions: [{ reviewDate: '2026-11-03', action: 'Hold' }],
      existingDeviations: [voidWrites[0]!],
      nowIso: '2026-11-05T22:00:00.000Z',
      generateId: genId,
    });
    expect(unvoidWrites).toHaveLength(1);
    expect(unvoidWrites[0]?.id).toBe(created.id);
    expect(unvoidWrites[0]?.recordedAt).toBe(created.recordedAt);
    expect(unvoidWrites[0]?.voided).toBe(false);
  });
});
