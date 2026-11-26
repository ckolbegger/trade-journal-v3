// I95.16 A Close Review owed under the new form needs the key lesson to be answered; one owed under the earlier form does not; declining leaves a Decline and no Entry
// (AC-JOUR-003, the Journal contract's Close Review). Through the real facade on fake-indexeddb: a Closed Trade whose Close Review was put off at the sale (new form),
// and the workspace-v7 fixture's two Outstanding Close Reviews, owed under the earlier form.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { closeReasonId, closeReviewDisposition, outstandingDebts, recordExit } from '../d7/support.ts';
import { dumpAll, launch, w7Device } from '../d8/support.ts';
import { CLOSE } from './seed-support.ts';
import { heldTrade, MON_1700 } from './support.ts';

const TAKE_AGAIN = 'prompt.close-review.take-again';
const KEY_LESSON = 'prompt.close-review.key-lesson';
const WORKED = 'prompt.close-review.what-worked';
const YES = { kind: 'Option', optionId: 'option.close-review.take-again.yes-as-planned' } as const;
const LESSON = { kind: 'Text', text: 'Sell into strength.' } as const;

// An XYZ stock Trade sold Monday 10-12 with its Close Review put off: an Outstanding Close Review Debt under the latest form.
async function closedWithCloseReviewOwed() {
  const { app, d, tradeId } = await heldTrade({ '2026-10-05': '50.00', '2026-10-12': '46.00' }, []);
  await recordExit(app, tradeId, [{ quantity: '100', price: '46.00', economicTime: '2026-10-12T19:00:00Z', fee: '1.00' }], { closeReasonId: await closeReasonId(app, 'Target Reached'), closeReview: await closeReviewDisposition(app, 'Defer') });
  return { app, d, tradeId, debt: await closeReviewDebtOf(app, tradeId) };
}

async function closeReviewDebtOf(app: Application, tradeId: string) {
  const debt = (await outstandingDebts(app)).find((d) => d.entryTypeKey === CLOSE && d.anchor.tradeId === tradeId);
  if (!debt) throw new Error('no Outstanding Close Review Debt');
  return debt;
}

type Debt = Awaited<ReturnType<typeof closeReviewDebtOf>>;

const answer = (app: Application, debt: Debt, answers: Record<string, { kind: 'Option'; optionId: string } | { kind: 'Text'; text: string }>) =>
  app.Journal.save({ intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: debt.revision, resolution: { kind: 'Answer', form: { definitionId: debt.definitionId, answers } } });

// The Workspace's stores, and the Close Review Entries and Declines in them.
async function storesOf(factory: Parameters<typeof dumpAll>[0]) {
  const dump = await dumpAll(factory);
  return dump[Object.keys(dump).find((n) => n.startsWith('tj-ws-'))!] as Record<string, { entryTypeKey?: string }[]>;
}

describe('I95.16 The Close Review and its key lesson', () => {
  it('should refuse a Close Review owed under the new form without the key lesson, and save it with one, through Journal.save', { timeout: 120_000 }, async () => {
    const { app, debt } = await closedWithCloseReviewOwed();

    const without = await answer(app, debt, { [TAKE_AGAIN]: YES, [WORKED]: { kind: 'Text', text: 'The exit.' } });
    const blank = await answer(app, debt, { [TAKE_AGAIN]: YES, [KEY_LESSON]: { kind: 'Text', text: '  ' } });

    // Catches a Close Review saved without its key lesson (blank included), or one refused even when it has the lesson.
    expect([without.kind, blank.kind]).toEqual(['Rejected', 'Rejected']);
    const stillOwed = await closeReviewDebtOf(app, debt.anchor.tradeId);
    expect(stillOwed.debtId).toBe(debt.debtId);
    expect((await answer(app, stillOwed, { [TAKE_AGAIN]: YES, [KEY_LESSON]: LESSON })).kind).toBe('Saved');
  });

  it('should refuse the same Close Review without the key lesson through the Review card too', { timeout: 120_000 }, async () => {
    const { app, tradeId, debt } = await closedWithCloseReviewOwed();
    const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MON_1700 });
    if (opened.kind !== 'Empty') throw new Error(`open: ${opened.kind}`);
    const card = await app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
    if (card.kind !== 'ReflectionsOwed') throw new Error(`getTrade: ${card.kind}`);
    const binding = card.card.reflections.find((r) => r.debtId === debt.debtId)!.saveBinding;

    const without = await app.DailyReview.save({ kind: 'ResolveReviewDebt', reviewDate: opened.reviewDate, binding, resolution: { kind: 'Answer', answers: { [TAKE_AGAIN]: YES } } });
    expect(without.kind).toBe('Rejected');
    const answered = await app.DailyReview.save({ kind: 'ResolveReviewDebt', reviewDate: opened.reviewDate, binding, resolution: { kind: 'Answer', answers: { [TAKE_AGAIN]: YES, [KEY_LESSON]: LESSON } } });
    expect(answered.kind).toBe('DebtResolved');
  });

  it('should save a Close Review owed under the earlier form without the key lesson', { timeout: 120_000 }, async () => {
    const d = await w7Device();
    const app = await launch(d);
    const opened = await app.Workspace.initialize({ timeZone: 'America/New_York' });
    expect(opened.kind).toBe('Opened');
    const earlier = (await outstandingDebts(app)).find((debt) => debt.entryTypeKey === CLOSE)!;
    const latest = await app.Journal.getDefinitions({ latestFor: CLOSE });
    if (latest.kind !== 'Found') throw new Error('no Close Review definition');

    const saved = await answer(app, earlier, { [TAKE_AGAIN]: YES });

    // Catches an earlier-form Debt held to the new rule: it keeps its own form (fx-0012, not the latest revision), where the key lesson is optional.
    expect(earlier.definitionId).not.toBe(latest.definition.id);
    expect(saved.kind).toBe('Saved');
  });

  it('should leave a Decline and no Entry when a Close Review is declined, without the key lesson', { timeout: 120_000 }, async () => {
    const { app, d, tradeId, debt } = await closedWithCloseReviewOwed();
    const before = await storesOf(d.factory);

    const declined = await app.Journal.save({ intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: debt.revision, resolution: { kind: 'Decline', reason: 'Nothing to add.' } });

    // Catches a decline that writes an Entry, records no Decline, or leaves the Debt Outstanding.
    const after = await storesOf(d.factory);
    const closeReviews = (stores: typeof after, store: string) => stores[store]!.filter((record) => record.entryTypeKey === CLOSE);
    expect(declined.kind).toBe('Saved');
    expect(closeReviews(after, 'journalEntries')).toEqual(closeReviews(before, 'journalEntries'));
    expect(closeReviews(after, 'journalEntries')).toEqual([]);
    expect(closeReviews(after, 'journalDeclines')).toHaveLength(closeReviews(before, 'journalDeclines').length + 1);
    expect((await outstandingDebts(app)).filter((owed) => owed.anchor.tradeId === tradeId && owed.entryTypeKey === CLOSE)).toEqual([]);
  });
});
