import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { checkStockMarkSanity, createMarketData } from '../../src/market-data/market-data';
import { createPersistenceSeam, CURRENT_SCHEMA_VERSION } from '../../src/persistence/idb';
import { createManualClock } from '../../src/shared/clock';
import { ExactNumber, toMoneyString } from '../../src/shared/exact-number';

async function createMarketHarness(writable = true) {
  let isWritable = true;
  const clock = createManualClock('2026-11-23T21:30:00.000Z');
  const persistence = createPersistenceSeam({
    indexedDB: new IDBFactory(),
    writeGate: {
      checkWritable: () =>
        isWritable
          ? { writable: true }
          : { writable: false, reason: 'RecoveryOnly', failedChecks: ['offline_inventory'] },
    },
  });
  await persistence.runWriteTransaction(['workspace_meta'], (tx) => {
    tx.put('workspace_meta', {
      key: 'singleton',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      timeZone: 'America/New_York',
      settingsRevision: 1,
      workspaceRevision: 1,
      initializedAt: clock.nowIso(),
      updatedAt: clock.nowIso(),
    });
  });
  isWritable = writable;
  const marketData = createMarketData({ persistence, clock });
  return {
    marketData,
    clock,
    setWritable: (next: boolean) => {
      isWritable = next;
    },
  };
}

describe('MarketData seam', () => {
  it('saves Manual Marks with revision history, rejects $0.00 stock marks, and resolves today + prior frames', async () => {
    const { marketData, clock } = await createMarketHarness();

    const zeroReject = await marketData.save({
      kind: 'SaveManualMark',
      symbol: 'NVDA',
      sessionDate: '2026-11-23',
      price: '0.00',
      intent: 'Initial',
    });
    expect(zeroReject.status).toBe('Rejected');

    const prior = await marketData.save({
      kind: 'SaveManualMark',
      symbol: 'nvda',
      sessionDate: '2026-11-20',
      price: '141.25',
      intent: 'Initial',
    });
    expect(prior.status).toBe('Saved');

    clock.advanceMs(60_000);
    const today1 = await marketData.save({
      kind: 'SaveManualMark',
      symbol: 'NVDA',
      sessionDate: '2026-11-23',
      price: '145.00',
      intent: 'Initial',
    });
    expect(today1.status).toBe('Saved');

    clock.advanceMs(60_000);
    const today2 = await marketData.save({
      kind: 'SaveManualMark',
      symbol: 'NVDA',
      sessionDate: '2026-11-23',
      price: '145.50',
      intent: 'Correction',
      reason: 'Fixed closing print',
    });
    expect(today2.status).toBe('Saved');

    const frames = await marketData.resolveFrames({
      symbols: ['NVDA'],
      expectedSessionDate: '2026-11-23',
    });
    const nvda = frames.bySymbol.NVDA;
    expect(nvda).toBeDefined();
    expect(toMoneyString(ExactNumber.fromJSON(nvda!.todayMark!.price))).toBe('$145.50');
    expect(toMoneyString(ExactNumber.fromJSON(nvda!.priorMark!.price))).toBe('$141.25');

    // Audit history preserves both revisions
    const obs = await marketData.inspectObservations({
      symbol: 'NVDA',
      sessionDate: '2026-11-23',
    });
    expect(obs.marks).toHaveLength(2);
    expect(obs.marks.filter((m) => m.effective)).toHaveLength(1);
  });

  it('supports Unavailable Mark Acknowledgment, Undo (Withdraw), superseding by later Manual Mark, and explicit gaps in ReadSeries', async () => {
    const { marketData } = await createMarketHarness();

    await marketData.save({
      kind: 'SaveManualMark',
      symbol: 'AAPL',
      sessionDate: '2026-11-18',
      price: '220.00',
      intent: 'Initial',
    });

    const ack = await marketData.save({
      kind: 'AssertUnavailable',
      symbol: 'AAPL',
      sessionDate: '2026-11-20',
      reason: 'Broker feed down',
    });
    expect(ack.status).toBe('Saved');

    const series = await marketData.readSeries({
      symbol: 'AAPL',
      fromDate: '2026-11-18',
      toDate: '2026-11-20',
    });
    expect(series.rows.map((r) => [r.sessionDate, r.mark !== null, r.unavailableAcknowledged])).toEqual([
      ['2026-11-18', true, false],
      ['2026-11-19', false, false], // explicit gap
      ['2026-11-20', false, true],
    ]);

    // Withdraw acknowledgment -> back to unmarked
    const withdrawn = await marketData.save({
      kind: 'WithdrawAcknowledgment',
      symbol: 'AAPL',
      sessionDate: '2026-11-20',
    });
    expect(withdrawn.status).toBe('Saved');

    // Re-acknowledge then supersede with Manual Mark
    await marketData.save({
      kind: 'AssertUnavailable',
      symbol: 'AAPL',
      sessionDate: '2026-11-20',
    });
    await marketData.save({
      kind: 'SaveManualMark',
      symbol: 'AAPL',
      sessionDate: '2026-11-20',
      price: '224.50',
      intent: 'Initial',
    });

    const obs = await marketData.inspectObservations({
      symbol: 'AAPL',
      sessionDate: '2026-11-20',
    });
    expect(obs.marks).toHaveLength(1);
    expect(obs.acknowledgments.some((a) => a.status === 'Superseded')).toBe(true);

    // AssertUnavailable is rejected when an effective Mark already exists for that session
    const dupUnavail = await marketData.save({
      kind: 'AssertUnavailable',
      symbol: 'AAPL',
      sessionDate: '2026-11-20',
    });
    expect(dupUnavail.status).toBe('Rejected');

    // WithdrawAcknowledgment when no active acknowledgment exists is rejected
    const noAck = await marketData.save({
      kind: 'WithdrawAcknowledgment',
      symbol: 'AAPL',
      sessionDate: '2026-11-20',
    });
    expect(noAck.status).toBe('Rejected');

    // Rejects non-trading day (weekend / impossible date)
    const weekend = await marketData.save({
      kind: 'SaveManualMark',
      symbol: 'AAPL',
      sessionDate: '2026-11-21', // Saturday
      price: '225.00',
      intent: 'Initial',
    });
    expect(weekend.status).toBe('Rejected');

    // Downward 10x decimal slip detection (4.40 vs $44.00 -> suggests $44.00)
    const downSlip = checkStockMarkSanity('4.40', ExactNumber.fromDecimalString('44.00'));
    expect(downSlip.status).toBe('ConfirmDecimalSlip');
    if (downSlip.status === 'ConfirmDecimalSlip') {
      expect(downSlip.suggestedDisplay).toBe('$44.00');
    }
  });

  it('covers upward 10x slip, exact 5% vs 5.1% outlier boundary, invalid price inputs, null reference, bad Save inputs, and RuntimeNotWritable', async () => {
    const ref = ExactNumber.fromDecimalString('44.00');

    const upSlip = checkStockMarkSanity('440.00', ref);
    expect(upSlip.status).toBe('ConfirmDecimalSlip');
    if (upSlip.status === 'ConfirmDecimalSlip') {
      expect(upSlip.suggestedRaw).toBe('44.00');
    }

    // Exact +5.0% move (46.20 vs 44.00) is within threshold -> Ok; +5.02% (46.21) -> ConfirmOutlier
    expect(checkStockMarkSanity('46.20', ref).status).toBe('Ok');
    const outlier = checkStockMarkSanity('46.21', ref);
    expect(outlier.status).toBe('ConfirmOutlier');

    expect(checkStockMarkSanity('', ref).status).toBe('Error');
    expect(checkStockMarkSanity('abc', ref).status).toBe('Error');
    expect(checkStockMarkSanity('0', ref).status).toBe('Error');
    expect(checkStockMarkSanity('-12.50', ref).status).toBe('Error');
    expect(checkStockMarkSanity('500.00', null).status).toBe('Ok');

    const { marketData, setWritable } = await createMarketHarness();
    const blankSymbol = await marketData.save({
      kind: 'SaveManualMark',
      symbol: '   ',
      sessionDate: '2026-11-23',
      price: '100.00',
      intent: 'Initial',
    });
    expect(blankSymbol).toMatchObject({
      status: 'Rejected',
      message: expect.stringMatching(/Symbol is required/i),
    });

    const invalidDate = await marketData.save({
      kind: 'SaveManualMark',
      symbol: 'AAPL',
      sessionDate: '2026-13-45',
      price: '100.00',
      intent: 'Initial',
    });
    expect(invalidDate).toMatchObject({
      status: 'Rejected',
      message: expect.stringMatching(/YYYY-MM-DD/),
    });

    // Thanksgiving 2026-11-26 is an exchange holiday -> Rejected
    const holidaySave = await marketData.save({
      kind: 'SaveManualMark',
      symbol: 'AAPL',
      sessionDate: '2026-11-26',
      price: '100.00',
      intent: 'Initial',
    });
    expect(holidaySave).toMatchObject({
      status: 'Rejected',
      message: expect.stringMatching(/not a U\.S\. equity trading session/),
    });

    setWritable(false);
    const blocked = await marketData.save({
      kind: 'SaveManualMark',
      symbol: 'AAPL',
      sessionDate: '2026-11-23',
      price: '100.00',
      intent: 'Initial',
    });
    expect(blocked.status).toBe('RuntimeNotWritable');
    setWritable(true);
    const obsAfterBlocked = await marketData.inspectObservations({
      symbol: 'AAPL',
      sessionDate: '2026-11-23',
    });
    expect(obsAfterBlocked.marks).toEqual([]);
    expect(obsAfterBlocked.acknowledgments).toEqual([]);
  });
});
