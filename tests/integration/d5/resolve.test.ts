// I5.7 and I5.8: resolving a Debt on Trade Detail before it is due (P17) and the retry and concurrency
// rules (AC-JOUR-005), through the real facade on fake-indexeddb.
import { describe, expect, it } from 'vitest';
import {
  bindingFor, confirmReference, detail, device, dumpAll, journalStores, MONDAY_1005, onboarded, openReview, outstandingDebts,
  PC1, positionChange, buy, recordDeferred, reflectionForm, restart, type Device,
} from './support.ts';

const TUESDAY_1005 = '2026-10-13T14:05:00Z';
const TUESDAY_1000 = '2026-10-13T14:00:00Z';
const TUESDAY_1230 = '2026-10-13T16:30:00Z';
const WEDNESDAY_1700 = '2026-10-14T21:00:00Z';

describe('I5.7 Resolve on Trade Detail before due', () => {
  it('should show Due in the Review after next, save the Answer with Source Trade Detail, moment time 10:00 and authored time 12:30 equal to the stored records, and leave Wednesday\'s Review with no Debt for it', async () => {
    const d = await device(undefined, TUESDAY_1005);
    let app = await onboarded(d);
    const tradeId = await confirmReference(app);
    await recordDeferred(app, tradeId, { ...PC1, economicTime: TUESDAY_1000 });

    // Tuesday 12:30: the Debt is not due until the Review after next.
    const noon: Device = { ...d, now: TUESDAY_1230 };
    app = await restart(app, noon);
    const before = await detail(app, tradeId);
    const owed = before.journal.filter((item) => item.kind === 'Debt');
    expect(owed).toEqual([expect.objectContaining({ dueStatus: 'DueInReviewAfterNext', momentTime: TUESDAY_1000 })]);
    const debt = (await outstandingDebts(app))[0]!;
    expect(owed[0]).toEqual(expect.objectContaining({ id: debt.debtId, revision: debt.revision }));

    const form = await reflectionForm(app);
    const saved = await app.Journal.save({ intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: debt.revision, resolution: { kind: 'Answer', form } });
    if (saved.kind !== 'Saved') throw new Error(`Journal.save: ${saved.kind}`);
    expect(saved.entry).toEqual(expect.objectContaining({ sourceKey: 'source.trade-detail', momentTime: TUESDAY_1000, authoredTime: TUESDAY_1230, settledDebtId: debt.debtId, definitionId: debt.definitionId }));

    // The result equals the stored records.
    const stores = journalStores(await dumpAll(d.factory));
    const entry = stores.entries.find((e) => e.settledDebtId === debt.debtId)!;
    expect(saved.entry).toEqual(expect.objectContaining({ id: entry.id, sourceKey: entry.sourceKey, momentTime: entry.momentTime, authoredTime: entry.authoredTime, definitionId: entry.versions[0]!.definitionId }));
    const stored = stores.debts.find((x) => x.debtId === debt.debtId)!;
    expect(stored.versions.map((v) => v.status)).toEqual(['Outstanding', 'Settled']);
    expect(saved.debt).toEqual({ ...debt, status: 'Settled', entryId: entry.id, revision: stored.versions.at(-1)!.versionId });
    expect(saved.currentOutcome).toEqual({ kind: 'Entry', id: entry.id });
    expect(stores.obligations.filter((o) => o.obligationKey === debt.obligationKey)).toEqual([expect.objectContaining({ outcome: { kind: 'Entry', id: entry.id } })]);

    // After restart the Detail shows the answered reflection and no Debt.
    app = await restart(app, noon);
    const after = await detail(app, tradeId);
    expect(after.journal.filter((item) => item.kind === 'Debt')).toEqual([]);
    expect(after.journal.filter((item) => item.kind === 'Entry' && 'answeredLater' in item && item.answeredLater)).toEqual([
      expect.objectContaining({ id: entry.id, authoredTime: TUESDAY_1230, answeredLater: { debtId: debt.debtId, dueAnchor: TUESDAY_1000 } }),
    ]);

    // Wednesday 17:00: the Review lists no reflection for the Trade.
    const wednesday: Device = { ...d, now: WEDNESDAY_1700 };
    app = await restart(app, wednesday);
    const review = await openReview(app, wednesday);
    expect(review.families.flatMap((f) => (f.family === 'Trades' ? f.trades.map((t) => t.reflections) : []))).toEqual([{ due: 0, later: 0 }]);
    const { form: card } = await bindingFor(app, wednesday, tradeId);
    expect(card.reflections).toEqual([]);
  }, 60_000);
});

// The key's outcome is current exactly once: one obligation record per key, naming what its Debt links.
function expectOneCurrentOutcomePerKey(dump: Awaited<ReturnType<typeof dumpAll>>) {
  const { debts, obligations, entries, declines } = journalStores(dump);
  const keys = obligations.map((o) => o.obligationKey);
  expect(new Set(keys).size).toBe(keys.length);
  for (const debt of debts) {
    const last = debt.versions.at(-1)!;
    const outcome = obligations.find((o) => o.obligationKey === debt.obligationKey)!.outcome;
    if (last.status === 'Outstanding') expect(outcome).toEqual({ kind: 'Debt', id: debt.debtId });
    if (last.status === 'Settled') {
      expect(outcome).toEqual({ kind: 'Entry', id: last.entryId });
      expect(entries.filter((e) => e.settledDebtId === debt.debtId)).toHaveLength(1);
      expect(declines.filter((x) => x.settledDebtId === debt.debtId)).toHaveLength(0);
    }
    if (last.status === 'Declined') {
      expect(outcome).toEqual({ kind: 'Decline', id: last.declineId });
      expect(declines.filter((x) => x.settledDebtId === debt.debtId)).toHaveLength(1);
      expect(entries.filter((e) => e.settledDebtId === debt.debtId)).toHaveLength(0);
    }
  }
}

// An onboarded Workspace on Monday 17:00 holding the reference Trade with PC1 deferred (D-1), and its binding.
async function withDebt() {
  const d = await device(undefined, MONDAY_1005);
  const app = await onboarded(d);
  const tradeId = await confirmReference(app);
  await recordDeferred(app, tradeId, PC1);
  const debt = (await outstandingDebts(app))[0]!;
  return { d, app, tradeId, debt };
}

describe('I5.8 Retries and concurrency', () => {
  it('should return Conflict for a repeated Defer command and keep one Debt', async () => {
    const d = await device(undefined, MONDAY_1005);
    const app = await onboarded(d);
    const tradeId = await confirmReference(app);
    const command = await positionChange(app, tradeId, [await buy(app, tradeId, PC1)], { kind: 'Defer' });

    const first = await app.TradeWorkflows.recordPositionChange(command);
    expect(first.kind).toBe('Recorded');
    const before = await dumpAll(d.factory);
    const second = await app.TradeWorkflows.recordPositionChange(command);

    expect(second.kind).toBe('Conflict');
    expect(await dumpAll(d.factory)).toEqual(before);
    expect(journalStores(before).debts).toHaveLength(1);
    expect(await outstandingDebts(app)).toHaveLength(1);
    expectOneCurrentOutcomePerKey(before);
  }, 60_000);

  it('should return Conflict carrying the Entry when D-1 is answered twice with the same expected revision', async () => {
    const { d, app, debt } = await withDebt();
    const form = await reflectionForm(app);
    const command = { intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: debt.revision, resolution: { kind: 'Answer', form } } as const;

    const first = await app.Journal.save(command);
    if (first.kind !== 'Saved') throw new Error(`first save: ${first.kind}`);
    const before = await dumpAll(d.factory);
    const second = await app.Journal.save(command);

    expect(second).toEqual({ kind: 'Conflict', currentOutcome: { kind: 'Entry', id: first.entry!.id } });
    expect(await dumpAll(d.factory)).toEqual(before);
    expect(journalStores(before).entries.filter((e) => e.settledDebtId === debt.debtId)).toHaveLength(1);
    expectOneCurrentOutcomePerKey(before);
  }, 60_000);

  it('should let exactly one of an answer through the Review and a decline through Journal.save succeed on one binding, the other returning Conflict', async () => {
    const { d, app, tradeId, debt } = await withDebt();
    // Tuesday 17:00 makes D-1 due; the Review's card binding and the Journal command share the Debt revision.
    const tuesday: Device = { ...d, now: '2026-10-13T21:00:00Z' };
    const live = await restart(app, tuesday);
    const { opened, form } = await bindingFor(live, tuesday, tradeId);
    const binding = form.reflections[0]!.saveBinding;
    expect(binding.debtRevision).toBe(debt.revision);
    const answers = (await reflectionForm(live)).answers;

    const [viaReview, viaDetail] = await Promise.all([
      live.DailyReview.save({ kind: 'ResolveReviewDebt', reviewDate: opened.reviewDate, binding, resolution: { kind: 'Answer', answers } }),
      live.Journal.save({ intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: binding.debtRevision, resolution: { kind: 'Decline', reason: 'Skipped.' } }),
    ]);

    // Exactly one of the two commits; the other is a Conflict.
    expect([viaReview.kind === 'DebtResolved', viaDetail.kind === 'Saved'].filter(Boolean)).toHaveLength(1);
    expect([viaReview.kind === 'Conflict', viaDetail.kind === 'Conflict'].filter(Boolean)).toHaveLength(1);
    const dump = await dumpAll(d.factory);
    const stores = journalStores(dump);
    expect(stores.debts.find((x) => x.debtId === debt.debtId)!.versions.map((v) => v.status)).toHaveLength(2);
    expect(stores.entries.filter((e) => e.settledDebtId === debt.debtId).length + stores.declines.filter((x) => x.settledDebtId === debt.debtId).length).toBe(1);
    expectOneCurrentOutcomePerKey(dump);
  }, 60_000);
});
