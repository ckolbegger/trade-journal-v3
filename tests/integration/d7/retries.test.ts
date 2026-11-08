// I7.11: retries around the Expiration (AC-JOUR-005 partial): a repeated E1 and a deferred Close Review answered twice
// each leave one settlement fact and one current Close Review outcome, and the second submission writes nothing.
import { describe, expect, it } from 'vitest';
import {
  closeReviewDisposition, complete, confirmOption, dumpAll, expirationMember, FRIDAY_1600, FRIDAY_1700, journalStores, OC_PC1, OC_PC2, OC_X1, onboardedAt, optionCommand, outstandingDebts, recordExpiration,
  recordOption, workspaceStores, type StoredTradeDoc,
} from './support.ts';

// O-C after PC1, PC2 and X1 on a Friday 17:00 device: one contract left to expire.
async function afterX1() {
  const { d, app } = await onboardedAt(FRIDAY_1700);
  const tradeId = (await confirmOption(app, 'O-C')).receipt.tradeId;
  await recordOption(app, tradeId, 'Buy', OC_PC1);
  await recordOption(app, tradeId, 'Buy', OC_PC2);
  await recordOption(app, tradeId, 'Sell', OC_X1);
  return { d, app, tradeId };
}

describe('I7.11 Retries', () => {
  it('a: should return Conflict for a second submission of E1, leaving one Expiration settlement fact and one Close Review outcome', async () => {
    const { d, app, tradeId } = await afterX1();
    const command = await optionCommand(app, tradeId, [await expirationMember(app, tradeId, '1', FRIDAY_1600)], { reflection: await complete(app), closeReview: await closeReviewDisposition(app, 'Complete') });

    const first = await app.TradeWorkflows.recordPositionChange(command);
    expect(first.kind).toBe('Recorded');
    const before = await dumpAll(d.factory);
    const second = await app.TradeWorkflows.recordPositionChange(command);

    expect(second.kind).toBe('Conflict');
    expect(await dumpAll(d.factory)).toEqual(before);
    const trade = (workspaceStores(before)['trades'] as StoredTradeDoc[])[0]!;
    expect(trade.facts.filter((f) => f.kind === 'Expiration')).toHaveLength(1);
    const outcomes = journalStores(before).obligations.filter((o) => o.obligationKey === `CloseReview:${tradeId}`);
    expect(outcomes).toEqual([expect.objectContaining({ outcome: expect.objectContaining({ kind: 'Entry' }) as unknown })]);
  }, 60_000);

  it('b: should return Conflict carrying the Entry when the deferred Close Review of E1 is answered twice with the same expected revision', async () => {
    const { d, app, tradeId } = await afterX1();
    await recordExpiration(app, tradeId, '1', FRIDAY_1600, { closeReview: await closeReviewDisposition(app, 'Defer') });
    const debt = (await outstandingDebts(app)).find((x) => x.entryTypeKey === 'entry-type.close-review')!;
    const answer = await closeReviewDisposition(app, 'Complete');
    if (answer.kind !== 'Complete') throw new Error('expected Complete');
    const command = { intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: debt.revision, resolution: { kind: 'Answer', form: answer.form } } as const;

    const first = await app.Journal.save(command);
    if (first.kind !== 'Saved') throw new Error(`first save: ${first.kind}`);
    const before = await dumpAll(d.factory);
    const second = await app.Journal.save(command);

    expect(second).toEqual({ kind: 'Conflict', currentOutcome: { kind: 'Entry', id: first.entry!.id } });
    expect(await dumpAll(d.factory)).toEqual(before);
    const stores = journalStores(before);
    expect(stores.entries.filter((e) => e.settledDebtId === debt.debtId)).toHaveLength(1);
    expect(stores.obligations.filter((o) => o.obligationKey === `CloseReview:${tradeId}`)).toHaveLength(1);
    const trade = (workspaceStores(before)['trades'] as StoredTradeDoc[])[0]!;
    expect(trade.facts.filter((f) => f.kind === 'Expiration')).toHaveLength(1);
  }, 60_000);
});
