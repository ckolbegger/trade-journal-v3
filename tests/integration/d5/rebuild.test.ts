// I5.12: rebuilding private state gives equal Review, Open list and Details, and identical Journal
// indexes, in the Workspace I5.6 and I5.7 leave behind (AC-REBUILD-001).
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { rebuildPrivateState } from '../../../src/persistence/index.ts';
import {
  currentDatabase, device, dumpAll, fixture, journalStores, MONDAY, MONDAY_1700, onboarded, openReview, outstandingDebts, reflectionForm, readIndex,
  restart, saveAction, saveMarks, TUESDAY_1700, bindingFor, recordDeferred, type Device,
} from './support.ts';

const TUESDAY = '2026-10-13';
const TUESDAY_1000 = '2026-10-13T14:00:00Z';

// The Review without its binding, the Open list, every Open Trade's Detail and the Outstanding Debts.
async function views(app: Application, d: Device) {
  const opened = await openReview(app, d);
  const review = { ...opened, binding: undefined };
  const open = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
  if (open.kind !== 'Ready') throw new Error(`browseTrades: ${open.kind}`);
  const details = [];
  for (const { tradeId } of open.view.items) {
    const result = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
    if (result.kind !== 'Ready') throw new Error(`getTradeDetail: ${result.kind}`);
    details.push(result.view);
  }
  return { review, list: open.view, details, debts: await outstandingDebts(app) };
}

describe('I5.12 Rebuild equivalence', () => {
  it('should give equal Review, Open list and Details after rebuildPrivateState, with byOutstandingDue, byAnchorTrade and journalObligations rebuilt identical', async () => {
    // I5.6: T-A's PC1 deferred and answered through the Review on Tuesday, every Action saved.
    const monday = await device(undefined, MONDAY_1700);
    let app = await onboarded(monday);
    const { a, b, c, e, all } = await fixture(app);
    await saveMarks(app, MONDAY);
    for (const tradeId of all) await saveAction(app, monday, tradeId);
    const tuesday: Device = { ...monday, now: TUESDAY_1700 };
    app = await restart(app, tuesday);
    await saveMarks(app, TUESDAY);
    const { form } = await bindingFor(app, tuesday, a);
    const d1 = form.reflections[0]!;
    const answered = await app.DailyReview.save({
      kind: 'ResolveReviewDebt',
      reviewDate: TUESDAY,
      binding: d1.saveBinding,
      resolution: { kind: 'Answer', answers: (await reflectionForm(app)).answers },
    });
    expect(answered.kind).toBe('DebtResolved');
    for (const tradeId of all) await saveAction(app, tuesday, tradeId);

    // I5.7: a deferral dated Tuesday 10:00 on T-B answered on Trade Detail, one on T-E declined there,
    // and one on T-C left Outstanding.
    const fill = { quantity: '10', price: '31.00', economicTime: TUESDAY_1000 };
    for (const tradeId of [b, e, c]) await recordDeferred(app, tradeId, fill);
    const owed = new Map((await outstandingDebts(app)).map((debt) => [debt.anchor.tradeId, debt]));
    const toAnswer = owed.get(b)!;
    const toDecline = owed.get(e)!;
    const saved = await app.Journal.save({ intention: 'ResolveDebt', debtId: toAnswer.debtId, expectedDebtRevision: toAnswer.revision, resolution: { kind: 'Answer', form: await reflectionForm(app) } });
    const declined = await app.Journal.save({ intention: 'ResolveDebt', debtId: toDecline.debtId, expectedDebtRevision: toDecline.revision, resolution: { kind: 'Decline', reason: 'Nothing to add.' } });
    expect([saved.kind, declined.kind]).toEqual(['Saved', 'Saved']);

    const databaseName = await currentDatabase(tuesday.factory);
    const before = await views(app, tuesday);
    const indexes = async () => ({
      byOutstandingDue: await readIndex(tuesday.factory, databaseName, 'journalDebts', 'byOutstandingDue'),
      byAnchorTrade: await readIndex(tuesday.factory, databaseName, 'journalDebts', 'byAnchorTrade'),
      journalObligations: (await dumpAll(tuesday.factory))[databaseName]!['journalObligations'],
    });
    const indexesBefore = await indexes();

    app.persistence.close();
    await rebuildPrivateState(tuesday.factory, databaseName);
    const again = await restart(app, tuesday);

    // The Workspace holds all three outcomes: an Entry from the Review, an Entry from Trade Detail
    // and a decline, besides one Outstanding Debt.
    const stores = journalStores(await dumpAll(tuesday.factory));
    expect(stores.debts.map((debt) => debt.versions.at(-1)!.status).sort()).toEqual(['Declined', 'Outstanding', 'Settled', 'Settled']);
    expect(before.debts).toHaveLength(1);
    expect(before.list.items).toHaveLength(4);
    expect(indexesBefore.byOutstandingDue).toHaveLength(1);
    expect(indexesBefore.byAnchorTrade).toHaveLength(4);
    expect(indexesBefore.journalObligations).toHaveLength(stores.obligations.length);

    expect(await views(again, tuesday)).toEqual(before);
    expect(await indexes()).toEqual(indexesBefore);
    expect(await openReview(again, tuesday)).toEqual(expect.objectContaining({ reviewDate: TUESDAY }));
  }, 120_000);
});
