// I7.4: the Cash-Secured Put O-S through three lifecycles, each restarted (AC-POS-004, AC-RESP-001): closed by
// buying back (a Close Reason is owed), a buyback dated before an earlier-recorded one (the receipt discloses
// the changed Lot Matches), and held to Expiration (no Close Reason).
import { describe, expect, it } from 'vitest';
import { Rational } from '../../../src/domain/values/index.ts';
import {
  closeReasonId, closeReviewDisposition, complete, confirmOption, dec, detailOf, dumpAll, FRIDAY_1600, FRIDAY_1700, onboardedAt, OS_B1, OS_S1, recordExpiration, recordOption, restart, WEDNESDAY_10,
  workspaceStores, type Fill, type StoredTradeDoc,
} from './support.ts';

// B2 closes the last short contract; the plan row fixes only its quantity, action and day (Wednesday).
const B2: Fill = { quantity: '1', price: '0.40', economicTime: WEDNESDAY_10, fee: '0.65' };
// B0 is the Buy dated Monday 10:30, between S1 (10:00) and B1 (Tuesday 10:00).
const B0: Fill = { quantity: '1', price: '0.55', economicTime: '2026-10-12T14:30:00Z', fee: '0.65' };

const value = (text: string) => ({ kind: 'Value', value: dec(text) });

describe('I7.4 Cash-Secured Put lifecycle', () => {
  it('A: should hold a short Lot after S1, match S1 to B1 for 63.70, and close on B2 with the Close Reason Target Reached as FullyDisposedPreExpiration', async () => {
    const { d, app } = await onboardedAt(FRIDAY_1700);
    const tradeId = (await confirmOption(app, 'O-S')).receipt.tradeId;

    const s1 = await recordOption(app, tradeId, 'Sell', OS_S1);
    expect(s1.postCommit.derivation.positions[0]!.openLots.map((l) => l.quantity)).toEqual([Rational.of(-2n)]);
    expect(s1.receipt.lifecycleTransitions).toEqual([{ tradeId, from: 'Planned', to: 'Open' }]);

    const b1 = await recordOption(app, tradeId, 'Buy', OS_B1);
    expect(b1.postCommit.derivation.lotMatches).toEqual([expect.objectContaining({ openingExecutionId: s1.receipt.createdFactIds[1], disposingExecutionId: b1.receipt.createdFactIds[1], quantity: dec('1') })]);
    expect(b1.postCommit.derivation.realizedToDate).toEqual(dec('63.70'));
    expect(b1.postCommit.derivation.positions[0]!.openLots.map((l) => l.quantity)).toEqual([Rational.of(-1n)]);
    expect(b1.receipt.lifecycleTransitions).toEqual([]);

    const reason = await closeReasonId(app, 'Target Reached');
    const b2 = await recordOption(app, tradeId, 'Buy', B2, { closeReasonId: reason, closeReview: await closeReviewDisposition(app, 'Complete') });
    expect(b2.receipt.lifecycleTransitions).toEqual([{ tradeId, from: 'Open', to: 'Closed' }]);
    expect(b2.postCommit.derivation.agreement).toEqual({ kind: 'Agrees' });

    const again = await restart(app, d);
    const detail = await detailOf(again, tradeId);
    if (!('terminalDisposition' in detail)) throw new Error('expected the Closed form of Detail');
    expect(detail.lifecycle).toEqual({ stored: 'Closed', agreement: { kind: 'Agrees' } });
    expect(detail.lotMatches.map((m) => [m.openingExecutionId, m.disposingExecutionId, m.quantity, m.realized])).toEqual([
      [s1.receipt.createdFactIds[1], b1.receipt.createdFactIds[1], dec('1'), value('63.70')],
      [s1.receipt.createdFactIds[1], b2.receipt.createdFactIds[1], dec('1'), value('83.70')],
    ]);
    expect(detail.realizedToDate).toEqual(dec('147.40'));
    expect(detail.closeReason).toEqual({ id: reason, label: 'Target Reached' });
    expect(detail.terminalDisposition).toEqual({ kind: 'Value', value: [{ mechanism: 'Executions', quantity: dec('2') }] });
    expect(detail.optionDispositionTiming).toEqual(expect.objectContaining({ kind: 'Value', value: expect.objectContaining({ timing: 'FullyDisposedPreExpiration' }) as unknown }));
    const trade = (workspaceStores(await dumpAll(d.factory))['trades'] as StoredTradeDoc[])[0]!;
    expect(trade.closeReasonFacts).toHaveLength(1);
  }, 60_000);

  it('B: should disclose in the receipt of a Buy dated Monday 10:30, recorded after B1, the Lot Match it creates and the realized P&L before and after, and leave the Entry window unmoved', async () => {
    const { d, app } = await onboardedAt(FRIDAY_1700);
    const tradeId = (await confirmOption(app, 'O-S')).receipt.tradeId;
    const s1 = await recordOption(app, tradeId, 'Sell', OS_S1);
    const b1 = await recordOption(app, tradeId, 'Buy', OS_B1);
    expect(b1.postCommit.derivation.realizedToDate).toEqual(dec('63.70'));

    const early = await recordOption(app, tradeId, 'Buy', B0);
    const ids = { s1: s1.receipt.createdFactIds[1]!, b1: b1.receipt.createdFactIds[1]!, b0: early.receipt.createdFactIds[1]! };
    // FIFO over the effective facts: B0 takes one of S1's two contracts first, and B1 still takes the other, so
    // S1 <- B1 is unchanged and one link is created.
    expect(early.receipt.lotMatchChanges).toEqual([{ kind: 'Created', openingExecutionId: ids.s1, disposingExecutionId: ids.b0, quantity: { before: null, after: dec('1') } }]);
    expect(early.receipt.realizedToDate).toEqual({ before: dec('63.70'), after: dec('132.40') });
    // S1 alone fills the Plan's two contracts, so an exit dated after it moves no resolved entry.
    expect(early.receipt.entryChanges).toEqual([]);
    expect(early.postCommit.derivation.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: s1.receipt.createdFactIds[0] });

    const again = await restart(app, d);
    const detail = await detailOf(again, tradeId);
    if (!('lotMatches' in detail)) throw new Error('expected an Open or Closed Detail');
    expect(detail.lotMatches.map((m) => [m.openingExecutionId, m.disposingExecutionId, m.quantity, m.policy])).toEqual([
      [ids.s1, ids.b0, dec('1'), 'FIFO'],
      [ids.s1, ids.b1, dec('1'), 'FIFO'],
    ]);
    expect(detail.realizedToDate).toEqual(dec('132.40'));
    expect(detail.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: s1.receipt.createdFactIds[0] });
    // The dump holds the facts only.
    const dump = await dumpAll(d.factory);
    expect(JSON.stringify(dump)).not.toMatch(/lotMatch|LotMatch/);
  }, 60_000);

  it('C: should expire both contracts after S1 for 248.70 realized and Realized R 829/1200 as FullyHeldToExpirationSettlement, with no Close Reason', async () => {
    const { d, app } = await onboardedAt(FRIDAY_1700);
    const tradeId = (await confirmOption(app, 'O-S')).receipt.tradeId;
    const s1 = await recordOption(app, tradeId, 'Sell', OS_S1);
    const expired = await recordExpiration(app, tradeId, '2', FRIDAY_1600, { reflection: await complete(app), closeReview: await closeReviewDisposition(app, 'Defer') });
    expect(expired.receipt.lifecycleTransitions).toEqual([{ tradeId, from: 'Open', to: 'Closed' }]);

    const again = await restart(app, d);
    const detail = await detailOf(again, tradeId);
    if (!('terminalDisposition' in detail)) throw new Error('expected the Closed form of Detail');
    expect(detail.lifecycle).toEqual({ stored: 'Closed', agreement: { kind: 'Agrees' } });
    expect(detail.realizedToDate).toEqual(dec('248.70'));
    expect(detail.realizedR).toEqual({ kind: 'Value', value: Rational.of(829n, 1200n) });
    expect(detail.lotMatches.map((m) => [m.openingExecutionId, m.quantity, m.realized])).toEqual([[s1.receipt.createdFactIds[1], dec('2'), value('248.70')]]);
    expect(detail.terminalDisposition).toEqual({ kind: 'Value', value: [{ mechanism: 'Expiration', quantity: dec('2') }] });
    expect(detail.optionDispositionTiming).toEqual(expect.objectContaining({ kind: 'Value', value: expect.objectContaining({ timing: 'FullyHeldToExpirationSettlement' }) as unknown }));
    expect(detail.closeReason).toBeUndefined();
    expect(detail.terminalTime).toBe(FRIDAY_1600);
    const trade = (workspaceStores(await dumpAll(d.factory))['trades'] as StoredTradeDoc[])[0]!;
    expect(trade.closeReasonFacts ?? []).toEqual([]);
  }, 60_000);
});
