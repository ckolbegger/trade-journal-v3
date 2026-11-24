// I95.10 The Action follows the Plan (AC-REV-007) and one-click Hold still needs Save (AC-REV-003), through the real facade on fake-indexeddb.
// The six-Trade book of support.ts at Monday 17:00, with DEF's Mark left out: ABC and GHI are Out (past the Stop, at the Target), JKL is inside both, DEF has no Mark.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { dumpAll, workspaceStores } from '../d7/support.ts';
import { MON_1700, MONDAY, openOn, sixTradeBook, type Book } from './support.ts';

const booked = () => sixTradeBook({ withoutMonday: ['deep'] });

// The Review's Trade card, freshly read: its form state, its Plan Call and the binding a save needs.
async function cardOf(app: Application, tradeId: string) {
  const opened = await openOn(app, MON_1700);
  const card = await app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (card.kind !== 'Ready') throw new Error(`getTrade: ${card.kind}`);
  return card.trade;
}

// A save from a freshly rendered card, whatever the result.
async function saveOn(app: Application, tradeId: string, action: 'Hold' | 'Exit' | 'Roll' | 'Adjust', intent?: string) {
  const trade = await cardOf(app, tradeId);
  return app.DailyReview.save({ kind: 'SaveTradeAction', binding: trade.saveBinding, action, ...(intent === undefined ? {} : { intent }) });
}

// Every store a Review Action may not touch: all but the Journal's two Entry stores and the revision counters.
const factsOf = (stores: ReturnType<typeof workspaceStores>) => Object.fromEntries(Object.entries(stores).filter(([store]) => !['journalEntries', 'journalObligations', 'meta'].includes(store)));

// The Trade's saved Review Actions and the answers of its Daily Trade Review Entries, as the Journal returns them.
async function savedActions(book: Book, tradeId: string) {
  const page = await book.app.Journal.query({ scope: 'TradeNarrative', tradeId });
  if (!('items' in page)) throw new Error('Journal.query: no page');
  const reviews = page.items.flatMap((item) => (item.kind === 'Entry' && item.entryTypeKey === 'entry-type.daily-trade-review' ? [item.responses] : []));
  return { actions: page.actions, reviews };
}

describe('I95.10 AC-REV-007 The Action follows the Plan', () => {
  it('should preselect Hold only for the Trade inside both lines and nothing for the two Out and the one with a Missing Mark', { timeout: 120_000 }, async () => {
    const book = await booked();

    const forms = await Promise.all((['inside', 'shallow', 'target', 'deep'] as const).map(async (name) => {
      const trade = await cardOf(book.app, book.ids[name]);
      return [name, trade.planCall?.call, trade.form] as const;
    }));

    // Catches a preselection for a Trade that is Out or unreadable, or none for the Trade inside both lines.
    expect(forms).toEqual([
      ['inside', 'Hold', { kind: 'New', viewState: { selectedAction: 'Hold' } }],
      ['shallow', 'Out', { kind: 'New', viewState: {} }],
      ['target', 'Out', { kind: 'New', viewState: {} }],
      ['deep', 'Unknown', { kind: 'New', viewState: {} }],
    ]);
  });

  it('should refuse a Hold without a reason for each Trade that is Out and save it with one', { timeout: 120_000 }, async () => {
    const book = await booked();
    const before = await dumpAll(book.d.factory);

    for (const name of ['shallow', 'target'] as const) {
      // Catches a Hold saved with no reason, or with a reason of spaces, past a line.
      expect(await saveOn(book.app, book.ids[name], 'Hold')).toEqual({ kind: 'Rejected', issues: [{ code: 'IntentRequired' }] });
      expect(await saveOn(book.app, book.ids[name], 'Hold', '   ')).toEqual({ kind: 'Rejected', issues: [{ code: 'IntentRequired' }] });
    }
    expect(await dumpAll(book.d.factory)).toEqual(before);

    for (const name of ['shallow', 'target'] as const) {
      // Catches a justified Hold refused or mis-saved for the Trade at either line.
      expect(await saveOn(book.app, book.ids[name], 'Hold', 'The gap will fill.')).toMatchObject({ kind: 'Saved' });
      const saved = await savedActions(book, book.ids[name]);
      expect(saved.actions).toEqual([{ tradeId: book.ids[name], reviewDate: MONDAY, action: 'Hold', reason: 'The gap will fill.' }]);
      expect(saved.reviews[0]).toContainEqual({ prompt: 'Why?', answer: { kind: 'Text', text: 'The gap will fill.' } });
    }
  });

  it('should save an Exit without a reason for each Trade that is Out', { timeout: 120_000 }, async () => {
    const book = await booked();

    for (const name of ['shallow', 'target'] as const) {
      // Catches an Exit refused for want of a reason when the Plan says out.
      expect(await saveOn(book.app, book.ids[name], 'Exit')).toMatchObject({ kind: 'Saved' });
      const saved = await savedActions(book, book.ids[name]);
      expect(saved.actions).toEqual([{ tradeId: book.ids[name], reviewDate: MONDAY, action: 'Exit' }]);
      expect(saved.reviews[0]).toContainEqual({ prompt: 'Why?', answer: { kind: 'Unanswered' } });
    }
  });

  it('should refuse an Exit without a reason for the Trade inside both lines and save it with one', { timeout: 120_000 }, async () => {
    const book = await booked();
    const before = await dumpAll(book.d.factory);

    // Catches an Exit saved with no reason while the Plan says hold.
    expect(await saveOn(book.app, book.ids.inside, 'Exit')).toEqual({ kind: 'Rejected', issues: [{ code: 'IntentRequired' }] });
    expect(await dumpAll(book.d.factory)).toEqual(before);

    expect(await saveOn(book.app, book.ids.inside, 'Exit', 'The thesis changed.')).toMatchObject({ kind: 'Saved' });
  });

  it('should save no Action for the Trade with a Missing Mark until the Mark is entered, and then apply the rule at that Mark', { timeout: 120_000 }, async () => {
    const book = await booked();
    const before = await dumpAll(book.d.factory);

    // Catches an Action saved on a Plan Call that cannot be read.
    expect(await saveOn(book.app, book.ids.deep, 'Hold', 'Fine.')).toMatchObject({ kind: 'Rejected', issues: [{ code: 'ReviewMarksUnresolved' }] });
    expect(await dumpAll(book.d.factory)).toEqual(before);

    // DEF at 47.00 is past its 49.00 Stop: Hold now needs a reason and Exit needs none.
    const opened = await openOn(book.app, MON_1700);
    const entered = await book.app.DailyReview.save({
      kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, binding: opened.binding,
      entries: [{ key: { instrumentKey: 'DEF', tradingDate: MONDAY }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '47.00' } }],
    });
    expect(entered.kind).toBe('MarksSaved');
    expect(await saveOn(book.app, book.ids.deep, 'Hold')).toEqual({ kind: 'Rejected', issues: [{ code: 'IntentRequired' }] });
    expect(await saveOn(book.app, book.ids.deep, 'Exit')).toMatchObject({ kind: 'Saved' });
  });

  it('should save a Hold with no reason and refuse an Exit with none for the Trade whose Mark is acknowledged Unavailable', { timeout: 120_000 }, async () => {
    const book = await booked();
    const opened = await openOn(book.app, MON_1700);
    const acknowledged = await book.app.DailyReview.save({
      kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, binding: opened.binding,
      entries: [{ key: { instrumentKey: 'DEF', tradingDate: MONDAY }, expectedRevision: 'None', intention: { kind: 'AssertUnavailable', reason: 'No quote today.' } }],
    });
    expect(acknowledged.kind).toBe('MarksSaved');

    // Catches an unreadable Plan Call treated as Out (Hold refused) or as Hold (Exit saved) when the Mark is acknowledged.
    expect((await cardOf(book.app, book.ids.deep)).planCall?.call).toBe('Unknown');
    expect(await saveOn(book.app, book.ids.deep, 'Exit')).toEqual({ kind: 'Rejected', issues: [{ code: 'IntentRequired' }] });
    expect(await saveOn(book.app, book.ids.deep, 'Hold')).toMatchObject({ kind: 'Saved' });
  });

  it('should record intent only: no Trade fact, Deviation or other store changes beside the Journal Entry', { timeout: 120_000 }, async () => {
    const book = await booked();
    const before = workspaceStores(await dumpAll(book.d.factory));

    expect(await saveOn(book.app, book.ids.shallow, 'Hold', 'The gap will fill.')).toMatchObject({ kind: 'Saved' });
    expect(await saveOn(book.app, book.ids.target, 'Exit')).toMatchObject({ kind: 'Saved' });
    expect(await saveOn(book.app, book.ids.inside, 'Hold')).toMatchObject({ kind: 'Saved' });

    // Catches an Action that writes a Deviation, a Trade fact or any store beyond its Entries: three Entries, no other fact.
    const after = workspaceStores(await dumpAll(book.d.factory));
    expect(factsOf(after)).toEqual(factsOf(before));
    expect((after.journalEntries ?? []).length - (before.journalEntries ?? []).length).toBe(3);
  });
});

describe('I95.10 AC-REV-003 One-click Hold still requires Save', () => {
  it('should record no Action and leave the Review Incomplete when the Review is opened and left', { timeout: 120_000 }, async () => {
    const book = await booked();
    const before = await dumpAll(book.d.factory);

    const opened = await openOn(book.app, MON_1700);
    await cardOf(book.app, book.ids.inside);

    // Catches an Action recorded by opening or leaving: nothing is written and the Trade still owes its Action.
    expect(await dumpAll(book.d.factory)).toEqual(before);
    if (opened.completion.kind !== 'Incomplete') throw new Error('expected Incomplete');
    expect(opened.completion.reasons.filter((r) => r.code === 'ActionMissing').map((r) => r.tradeId)).toContain(book.ids.inside);
  });

  it('should record exactly one Hold Entry for one Save of the preselected Hold', { timeout: 120_000 }, async () => {
    const book = await booked();
    const trade = await cardOf(book.app, book.ids.inside);
    expect(trade.form).toEqual({ kind: 'New', viewState: { selectedAction: 'Hold' } });
    const before = workspaceStores(await dumpAll(book.d.factory));

    const saved = await book.app.DailyReview.save({ kind: 'SaveTradeAction', binding: trade.saveBinding, action: 'Hold' });

    // Catches a save that writes two Entries, or none.
    expect(saved).toMatchObject({ kind: 'Saved' });
    const after = workspaceStores(await dumpAll(book.d.factory));
    expect((after.journalEntries ?? []).length - (before.journalEntries ?? []).length).toBe(1);
    expect(factsOf(after)).toEqual(factsOf(before));
    const again = await cardOf(book.app, book.ids.inside);
    expect(again.form).toMatchObject({ kind: 'Saved' });
  });

  it('should refuse Roll and Adjust without a reason and save each with one as intent only', { timeout: 120_000 }, async () => {
    const book = await booked();
    const before = workspaceStores(await dumpAll(book.d.factory));

    for (const action of ['Roll', 'Adjust'] as const) {
      // Catches a Roll or Adjust saved with no reason, at any Plan Call.
      expect(await saveOn(book.app, book.ids.inside, action)).toEqual({ kind: 'Rejected', issues: [{ code: 'IntentRequired' }] });
      expect(await saveOn(book.app, book.ids.inside, action, '  ')).toEqual({ kind: 'Rejected', issues: [{ code: 'IntentRequired' }] });
    }
    expect(workspaceStores(await dumpAll(book.d.factory))).toEqual(before);

    expect(await saveOn(book.app, book.ids.inside, 'Roll', 'Rolling out a month.')).toMatchObject({ kind: 'Saved' });
    expect(await saveOn(book.app, book.ids.shallow, 'Adjust', 'Moving the Stop up.')).toMatchObject({ kind: 'Saved' });
    const after = workspaceStores(await dumpAll(book.d.factory));
    expect(factsOf(after)).toEqual(factsOf(before));
    expect((after.journalEntries ?? []).length - (before.journalEntries ?? []).length).toBe(2);
  });

  it('should refuse a save from a stale binding and write nothing', { timeout: 120_000 }, async () => {
    const book = await booked();
    const stale = await cardOf(book.app, book.ids.inside);
    expect(await saveOn(book.app, book.ids.inside, 'Hold')).toMatchObject({ kind: 'Saved' });
    const before = await dumpAll(book.d.factory);

    // Catches a save that overwrites an Action saved since the form was read.
    const result = await book.app.DailyReview.save({ kind: 'SaveTradeAction', binding: stale.saveBinding, action: 'Exit', intent: 'Changed my mind.' });

    expect(result).toEqual({ kind: 'Conflict' });
    expect(await dumpAll(book.d.factory)).toEqual(before);
  });

  it('should refuse a save when a Mark changed since the form was read and write nothing', { timeout: 120_000 }, async () => {
    const book = await booked();
    const stale = await cardOf(book.app, book.ids.inside);
    const opened = await openOn(book.app, MON_1700);
    const corrected = await book.app.DailyReview.save({
      kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, binding: opened.binding,
      entries: [{ key: { instrumentKey: 'JKL', tradingDate: MONDAY }, expectedRevision: 1, intention: { kind: 'CorrectMark', price: '20.60', reason: '' } }],
    });
    expect(corrected.kind).toBe('MarksSaved');
    const before = await dumpAll(book.d.factory);

    // Catches an Action saved against evidence that changed after the form was read.
    const result = await book.app.DailyReview.save({ kind: 'SaveTradeAction', binding: stale.saveBinding, action: 'Hold' });

    expect(result.kind).not.toBe('Saved');
    expect(await dumpAll(book.d.factory)).toEqual(before);
  });
});
