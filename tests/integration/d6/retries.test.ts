// I6.12: retries and concurrency around the Close Review (AC-JOUR-005 partial): a repeated terminal exit, a
// deferred Close Review answered twice, and an answer through the Review racing a decline through Journal.save.
// Each leaves one current outcome for (CloseReview, Trade).
import { describe, expect, it } from 'vitest';
import {
  closeReasonId, closeReviewDisposition, confirmReference, device, dumpAll, exitCommand, journalStores, onboarded, outstandingDebts, PC1, PC2, record, recordExit, restart, reviewAt, TUESDAY_1400, TUESDAY_1700,
  workspaceStores, type StoredTradeDoc,
} from './support.ts';

const SELL_ALL = { quantity: '100', price: '53.00', economicTime: TUESDAY_1400, fee: '1.00' };

// T-A after PC1 and PC2 on a Tuesday 17:00 device.
async function afterPc2() {
  const d = await device(undefined, TUESDAY_1700);
  const app = await onboarded(d);
  const tradeId = await confirmReference(app);
  await record(app, tradeId, PC1);
  await record(app, tradeId, PC2);
  return { d, app, tradeId, reason: await closeReasonId(app, 'Target Reached') };
}

// The current outcomes of the Close Review key: one obligation record names exactly one.
function closeReviewOutcomes(dump: Awaited<ReturnType<typeof dumpAll>>, tradeId: string) {
  const stores = journalStores(dump);
  return stores.obligations.filter((o) => o.obligationKey === `CloseReview:${tradeId}`);
}

describe('I6.12 Retries', () => {
  it('a: should return Conflict for a second submission of terminal X2, leaving one Close Reason and one Close Review outcome', async () => {
    const { d, app, tradeId, reason } = await afterPc2();
    const command = await exitCommand(app, tradeId, [SELL_ALL], { closeReasonId: reason, closeReview: await closeReviewDisposition(app, 'Complete') });

    const first = await app.TradeWorkflows.recordPositionChange(command);
    expect(first.kind).toBe('Recorded');
    const before = await dumpAll(d.factory);
    const second = await app.TradeWorkflows.recordPositionChange(command);

    expect(second.kind).toBe('Conflict');
    expect(await dumpAll(d.factory)).toEqual(before);
    const trades = workspaceStores(before)['trades'] as StoredTradeDoc[];
    expect(trades[0]!.closeReasonFacts).toHaveLength(1);
    expect(closeReviewOutcomes(before, tradeId)).toEqual([expect.objectContaining({ outcome: expect.objectContaining({ kind: 'Entry' }) as unknown })]);
  }, 60_000);

  it('b: should return Conflict carrying the Entry when a deferred Close Review is answered twice with the same expected revision', async () => {
    const { d, app, tradeId, reason } = await afterPc2();
    await recordExit(app, tradeId, [SELL_ALL], { closeReasonId: reason, closeReview: await closeReviewDisposition(app, 'Defer') });
    const debt = (await outstandingDebts(app)).find((x) => x.entryTypeKey === 'entry-type.close-review')!;
    const complete = await closeReviewDisposition(app, 'Complete');
    if (complete.kind !== 'Complete') throw new Error('expected Complete');
    const command = { intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: debt.revision, resolution: { kind: 'Answer', form: complete.form } } as const;

    const first = await app.Journal.save(command);
    if (first.kind !== 'Saved') throw new Error(`first save: ${first.kind}`);
    const before = await dumpAll(d.factory);
    const second = await app.Journal.save(command);

    expect(second).toEqual({ kind: 'Conflict', currentOutcome: { kind: 'Entry', id: first.entry!.id } });
    expect(await dumpAll(d.factory)).toEqual(before);
    expect(journalStores(before).entries.filter((e) => e.settledDebtId === debt.debtId)).toHaveLength(1);
    expect(closeReviewOutcomes(before, tradeId)).toHaveLength(1);
  }, 60_000);

  it('c: should let exactly one of an answer through the Review and a decline through Journal.save succeed on one binding, with one current Close Review outcome', async () => {
    const { d, app, tradeId, reason } = await afterPc2();
    await recordExit(app, tradeId, [SELL_ALL], { closeReasonId: reason, closeReview: await closeReviewDisposition(app, 'Defer') });
    const debt = (await outstandingDebts(app)).find((x) => x.entryTypeKey === 'entry-type.close-review')!;
    const live = await restart(app, d);
    const opened = await reviewAt(live, TUESDAY_1700);
    const card = await live.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
    if (card.kind !== 'ReflectionsOwed') throw new Error(`getTrade: ${card.kind}`);
    const binding = card.card.reflections[0]!.saveBinding;
    expect(binding.debtRevision).toBe(debt.revision);
    const complete = await closeReviewDisposition(live, 'Complete');
    if (complete.kind !== 'Complete') throw new Error('expected Complete');

    const [viaReview, viaDetail] = await Promise.all([
      live.DailyReview.save({ kind: 'ResolveReviewDebt', reviewDate: opened.reviewDate, binding, resolution: { kind: 'Answer', answers: complete.form.answers } }),
      live.Journal.save({ intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: binding.debtRevision, resolution: { kind: 'Decline', reason: 'Skipped.' } }),
    ]);

    expect([viaReview.kind === 'DebtResolved', viaDetail.kind === 'Saved'].filter(Boolean)).toHaveLength(1);
    expect([viaReview.kind === 'Conflict', viaDetail.kind === 'Conflict'].filter(Boolean)).toHaveLength(1);
    const stores = journalStores(await dumpAll(d.factory));
    expect(stores.debts.find((x) => x.debtId === debt.debtId)!.versions.map((v) => v.status)).toHaveLength(2);
    expect(stores.entries.filter((e) => e.settledDebtId === debt.debtId).length + stores.declines.filter((x) => x.settledDebtId === debt.debtId).length).toBe(1);
    expect(stores.obligations.filter((o) => o.obligationKey === `CloseReview:${tradeId}`)).toHaveLength(1);
    expect(await outstandingDebts(live)).toEqual([]);
  }, 60_000);
});
