// I5.6: the Review with a deferred reflection end to end (AC-REV-002, AC-REV-006, P17). D4's five-Trade
// fixture without T-D, with T-A's PC1 deferred (D-1), through the real facade on fake-indexeddb.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import {
  bindingFor, device, dumpAll, journalStores, MONDAY, MONDAY_1700, onboarded, openReview, PC1, PC2, planStock, PC1_TIME, record,
  recordDeferred, reflectionForm, restart, saveAction, saveMark, TUESDAY_1700, type Device,
} from './support.ts';

const TUESDAY = '2026-10-13';
const SYMBOLS = ['XYZ', 'ABC', 'DEF', 'JKL'] as const;
const PRICES = { XYZ: '52.00', ABC: '27.50', DEF: '40.50', JKL: '21.00' } as const;

// T-A (XYZ) with PC1 deferred and PC2 completed, then T-B ABC, T-C DEF and T-E JKL, each filled at 10:00 Monday.
async function fixture(app: Application) {
  const a = await planStock(app, 'XYZ', '50.00', '47.50', '56.00');
  await recordDeferred(app, a, PC1);
  await record(app, a, PC2);
  const single = async (symbol: string, entry: string, stop: string, target: string) => {
    const tradeId = await planStock(app, symbol, entry, stop, target);
    await record(app, tradeId, { quantity: '100', price: entry, economicTime: PC1_TIME });
    return tradeId;
  };
  const b = await single('ABC', '30.00', '28.00', '36.00');
  const c = await single('DEF', '40.00', '38.00', '46.00');
  const e = await single('JKL', '20.00', '19.00', '30.00');
  return { a, b, c, e, all: [a, b, c, e] };
}

async function saveMarks(app: Application, date: string) {
  for (const symbol of SYMBOLS) await saveMark(app, symbol, date, PRICES[symbol]);
}

// T-A's card as getTrade renders it for the latest completed Review.
async function cardOf(app: Application, d: Device, tradeId: string) {
  const { form } = await bindingFor(app, d, tradeId);
  return form;
}

// D-1's Debt in the Journal, which is the only Outstanding Debt of the fixture.
async function onlyDebt(app: Application) {
  const page = await app.Journal.query({ scope: 'OutstandingDebt' });
  if (!('debts' in page) || page.debts.length !== 1) throw new Error('expected exactly one Outstanding Debt');
  return page.debts[0]!;
}

async function runReview(resolution: 'Answer' | 'Decline') {
  const monday = await device(undefined, MONDAY_1700);
  let app = await onboarded(monday);
  const { a, all } = await fixture(app);
  const d1 = await onlyDebt(app);

  // Monday: D-1 sits in T-A's card as due in the next Review, and the Review is Complete without it.
  const first = await openReview(app, monday);
  expect(first.families.flatMap((f) => (f.family === 'Trades' ? f.trades.filter((t) => t.tradeId === a).map((t) => t.reflections) : []))).toEqual([{ due: 0, later: 1 }]);
  expect((await cardOf(app, monday, a)).reflections).toEqual([expect.objectContaining({ debtId: d1.debtId, classification: 'DueInNextReview' })]);
  await saveMarks(app, MONDAY);
  for (const tradeId of all) await saveAction(app, monday, tradeId);
  expect((await openReview(app, monday)).completion).toEqual({ kind: 'Complete' });

  // Tuesday 17:00: Marks first, then the walk with D-1 Due in T-A's card.
  const tuesday = { ...monday, now: TUESDAY_1700 };
  app = await restart(app, tuesday);
  const opened = await openReview(app, tuesday);
  expect(opened.families.map((f) => f.family)).toEqual(['Marks', 'Trades']);
  expect(opened.completion.kind === 'Incomplete' && opened.completion.reasons.map((r) => r.code)).toEqual([
    'MarkMissing', 'MarkMissing', 'MarkMissing', 'MarkMissing', 'ActionMissing', 'ReflectionDue', 'ActionMissing', 'ActionMissing', 'ActionMissing',
  ]);
  await saveMarks(app, TUESDAY);
  const card = await cardOf(app, tuesday, a);
  expect(card.reflections).toEqual([expect.objectContaining({ debtId: d1.debtId, classification: 'Due' })]);
  const binding = card.reflections[0]!.saveBinding;
  expect(card.saveBinding).toBeDefined();

  const before = (await openReview(app, tuesday)).completion;
  expect(before.kind === 'Incomplete' && before.reasons.map((r) => r.code)).toContain('ReflectionDue');

  const form = await reflectionForm(app);
  const result = await app.DailyReview.save({
    kind: 'ResolveReviewDebt',
    reviewDate: TUESDAY,
    binding,
    resolution: resolution === 'Answer' ? { kind: 'Answer', answers: form.answers } : { kind: 'Decline', reason: 'Nothing to add.' },
  });
  if (result.kind !== 'DebtResolved') throw new Error(`ResolveReviewDebt: ${result.kind}`);
  if (result.review.kind !== 'Ready') throw new Error('expected a Ready review');
  expect(result.debt.status).toBe(resolution === 'Answer' ? 'Settled' : 'Declined');
  // Only the Actions are missing now.
  expect(result.review.completion.kind === 'Incomplete' && result.review.completion.reasons.map((r) => r.code)).toEqual(['ActionMissing', 'ActionMissing', 'ActionMissing', 'ActionMissing']);

  for (const tradeId of all.slice(0, -1)) await saveAction(app, tuesday, tradeId);
  const nearly = await openReview(app, tuesday);
  expect(nearly.completion.kind).toBe('Incomplete');
  await saveAction(app, tuesday, all.at(-1)!);
  const done = await openReview(app, tuesday);
  expect(done.completion).toEqual({ kind: 'Complete' });

  // After restart the same Review is derived from the stored facts.
  const again = await restart(app, tuesday);
  const resumed = await openReview(again, tuesday);
  expect(resumed.completion).toEqual({ kind: 'Complete' });
  expect(resumed.families).toEqual(done.families);
  expect((await cardOf(again, tuesday, a)).reflections).toEqual([]);

  return { d: monday, result, d1, stores: journalStores(await dumpAll(monday.factory)), again };
}

describe('I5.6 Review with Debt end to end', () => {
  it('should show D-1 as due in the next Review on Monday, mark it Due on Tuesday, stay Incomplete until it is answered and every Action is saved, and then be Complete, also after restart', async () => {
    const { result, d1, stores, again } = await runReview('Answer');

    const entry = stores.entries.find((e) => e.settledDebtId === d1.debtId);
    expect(entry).toBeDefined();
    expect(entry!.sourceKey).toBe('source.daily-review');
    expect(result.entry).toEqual(expect.objectContaining({ id: entry!.id, sourceKey: 'source.daily-review', settledDebtId: d1.debtId }));
    expect(stores.declines).toEqual([]);
    const debt = stores.debts.find((x) => x.debtId === d1.debtId)!;
    expect(debt.versions.map((v) => v.status)).toEqual(['Outstanding', 'Settled']);
    expect(debt.versions.at(-1)!.entryId).toBe(entry!.id);
    expect(result.debt.revision).toBe(debt.versions.at(-1)!.versionId);
    expect(stores.obligations.filter((o) => o.obligationKey === d1.obligationKey)).toEqual([expect.objectContaining({ outcome: { kind: 'Entry', id: entry!.id } })]);
    // No Review-session record exists: the Review is derived from facts.
    expect(Object.keys(stores.all).filter((name) => /review/i.test(name) && !/^journal/.test(name))).toEqual([]);
    expect((await onlyDebtsLeft(again))).toEqual([]);
  }, 120_000);

  it('should do the same in a second Workspace when D-1 is declined instead, with a decline carrying settledDebtId and the Debt Declined', async () => {
    const { result, d1, stores, again } = await runReview('Decline');

    const decline = stores.declines.find((x) => x.settledDebtId === d1.debtId);
    expect(decline).toBeDefined();
    expect(decline!.sourceKey).toBe('source.daily-review');
    expect(decline!.reason).toBe('Nothing to add.');
    expect(result.decline).toEqual(expect.objectContaining({ id: decline!.id, settledDebtId: d1.debtId }));
    expect(stores.entries.filter((e) => e.settledDebtId !== undefined)).toEqual([]);
    const debt = stores.debts.find((x) => x.debtId === d1.debtId)!;
    expect(debt.versions.map((v) => v.status)).toEqual(['Outstanding', 'Declined']);
    expect(debt.versions.at(-1)!.declineId).toBe(decline!.id);
    expect(stores.obligations.filter((o) => o.obligationKey === d1.obligationKey)).toEqual([expect.objectContaining({ outcome: { kind: 'Decline', id: decline!.id } })]);
    expect(Object.keys(stores.all).filter((name) => /review/i.test(name) && !/^journal/.test(name))).toEqual([]);
    expect((await onlyDebtsLeft(again))).toEqual([]);
  }, 120_000);
});

async function onlyDebtsLeft(app: Application) {
  const page = await app.Journal.query({ scope: 'OutstandingDebt' });
  if (!('debts' in page)) throw new Error(page.kind);
  return page.debts;
}
