// I95.1 Daily Review open: bands, order, last Actions and AC-REV-002 in full, through the real facade on fake-indexeddb.
// The six-Trade book of support.ts: Monday 2026-10-12 17:00, Friday's Exit saved for MNO.
import { describe, expect, it } from 'vitest';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { dumpAll, planStock, record, restart, workspaceStores, onboardedAt } from '../d7/support.ts';
import { MON_1700, MONDAY, openOn, saveActionOn, sixTradeBook, walkOf, type Book } from './support.ts';

const SIX = ['exit', 'expired', 'deep', 'shallow', 'target', 'inside'] as const;

const orderOf = (book: Book, trades: readonly { tradeId: string }[]) => {
  const names: Record<string, string> = Object.fromEntries(Object.entries(book.ids).map(([name, id]) => [id, name]));
  return trades.map((t) => names[t.tradeId]);
};

describe('I95.1 Daily Review open: the order of six Trades (AC-REV-002)', () => {
  it('should return six Trades in the spec order with their bands and last Actions', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook();

    const trades = walkOf(await openOn(book.app, MON_1700));

    // Catches a wrong band, or two Trades past their Stops not deepest first: 2R before 1.5R.
    expect(trades.map((t) => [orderOf(book, [t])[0], t.band])).toEqual([
      ['exit', 'ExitNotCarriedOut'],
      ['expired', 'SettlementDue'],
      ['deep', 'StopReached'],
      ['shallow', 'StopReached'],
      ['target', 'TargetReached'],
      ['inside', 'QuantifiedPressure'],
    ]);
    // Catches a last Action given to the wrong Trade: only the Exit saved Friday.
    expect(trades.map((t) => t.lastAction && [t.lastAction.reviewDate, t.lastAction.action])).toEqual([['2026-10-09', 'Exit'], undefined, undefined, undefined, undefined, undefined]);
  });

  it('should keep the order when an Action is saved', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook();
    await saveActionOn(book.app, MON_1700, book.ids.deep, 'Exit', 'The Stop was passed.');

    const trades = walkOf(await openOn(book.app, MON_1700));

    // Catches an Action that moves its Trade: an Exit saved for the Review Date is not an earlier Exit still to carry out.
    expect(orderOf(book, trades)).toEqual(SIX);
  });

  it('should return a new order from a Marks save', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook({ withoutMonday: ['inside'] });
    expect(orderOf(book, walkOf(await openOn(book.app, MON_1700))).at(-1)).toBe('inside');
    const opened = await openOn(book.app, MON_1700);

    // JKL's Stop is 19.00 and 1R is 1.00: a Mark of 17.00 puts it 2R past its Stop.
    const saved = await book.app.DailyReview.save({
      kind: 'SaveReviewMarks',
      reviewDate: opened.reviewDate,
      binding: opened.binding,
      entries: [{ key: { instrumentKey: 'JKL', tradingDate: MONDAY }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '17.00' } }],
    });

    if (saved.kind !== 'MarksSaved' || saved.review.kind !== 'Ready') throw new Error(`save: ${saved.kind}`);
    // Catches an order left as it was, or a band not revised by the Mark just saved.
    const returned = orderOf(book, saved.review.trades);
    expect(returned.slice(0, 2)).toEqual(['exit', 'expired']);
    expect(returned.indexOf('inside')).toBeLessThan(returned.indexOf('target'));
    expect(saved.review.trades.find((t) => t.tradeId === book.ids.inside)?.band).toBe('StopReached');
    // The order the Marks save returned is the one the next open returns.
    expect(orderOf(book, walkOf(await openOn(book.app, MON_1700)))).toEqual(returned);
  });

  it('should keep a due reflection and the expired Trade Settlement Due with their own Trades', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook();

    const opened = await openOn(book.app, MON_1700);

    // Catches a need listed on another Trade's line.
    const needs: Record<string, readonly string[]> = Object.fromEntries(opened.day!.lines.map((line): [string, readonly string[]] => [orderOf(book, [line])[0]!, line.needs]));
    expect(needs).toMatchObject({ expired: ['Settlement'], inside: ['Reflection', 'Action'], deep: ['Action'] });
    if (opened.completion.kind !== 'Incomplete') throw new Error('expected Incomplete');
    const reasons = opened.completion.reasons;
    expect(reasons.filter((r) => r.code === 'SettlementDue').map((r) => r.tradeId)).toEqual([book.ids.expired]);
    expect(reasons.filter((r) => r.code === 'ReflectionDue').map((r) => r.tradeId)).toEqual([book.ids.inside]);
  });

  it('should save one Missing Mark shared by two Trades once and resolve it for both', { timeout: 120_000 }, async () => {
    const { d, app: first } = await onboardedAt(MON_1700);
    const one = await planStock(first, 'ABC', '30.00', '28.00', '36.00', '100', '2026-10-12T13:00:00Z');
    await record(first, one, { quantity: '100', price: '30.00', economicTime: '2026-10-12T14:00:00Z' });
    const two = await planStock(first, 'ABC', '31.00', '28.00', '36.00', '50', '2026-10-12T13:30:00Z');
    await record(first, two, { quantity: '50', price: '31.00', economicTime: '2026-10-12T15:00:00Z' });
    const app = await restart(first, d);
    const opened = await openOn(app, MON_1700);

    // Marks come first, once for the Instrument, naming both Trades.
    if (opened.completion.kind !== 'Incomplete') throw new Error('expected Incomplete');
    const shared = opened.completion.reasons[0];
    expect(shared?.code === 'MarkMissing' && [...shared.trades].sort()).toEqual([one, two].sort());
    expect(opened.completion.reasons.filter((r) => r.code === 'MarkMissing')).toHaveLength(1);

    const saved = await app.DailyReview.save({
      kind: 'SaveReviewMarks',
      reviewDate: opened.reviewDate,
      binding: opened.binding,
      entries: [{ key: { instrumentKey: instrumentKey({ kind: 'Stock', symbol: 'ABC' }), tradingDate: MONDAY }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '29.00' } }],
    });

    // Catches a Mark that resolves for one Trade only: neither Trade lists a Mark to go.
    expect(saved.kind).toBe('MarksSaved');
    const after = await openOn(app, MON_1700);
    expect(after.day!.lines.map((line) => line.marks)).toEqual([0, 0]);
    expect(after.completion.kind === 'Incomplete' && after.completion.reasons.some((r) => r.code === 'MarkMissing')).toBe(false);
    expect(await saveActionOn(app, MON_1700, one)).toMatchObject({ kind: 'Saved' });
    expect(await saveActionOn(app, MON_1700, two)).toMatchObject({ kind: 'Saved' });
  });

  it('should bring the saved outcomes back from facts after a restart and keep no Review-session record', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook();
    const before = workspaceStores(await dumpAll(book.d.factory));

    await saveActionOn(book.app, MON_1700, book.ids.deep, 'Hold', 'Staying with the plan.');
    const written = workspaceStores(await dumpAll(book.d.factory));
    const fresh = await restart(book.app, book.d);
    const opened = await openOn(fresh, MON_1700);

    // Catches an outcome that did not survive the restart.
    expect(opened.day!.lines.find((line) => line.tradeId === book.ids.deep)).toMatchObject({ action: 'Hold', needs: [] });
    expect(opened.completion.kind === 'Incomplete' && opened.completion.reasons.filter((r) => r.code === 'ActionMissing').map((r) => r.tradeId)).not.toContain(book.ids.deep);
    // Catches a Review session, finish flag or placeholder: the save changed only the Journal's stores and the two revision counters.
    const changed = Object.keys(written).filter((store) => JSON.stringify(written[store]) !== JSON.stringify(before[store]));
    expect(changed.sort()).toEqual(['journalEntries', 'journalObligations', 'meta']);
    const counters = (written.meta ?? []).filter((r) => JSON.stringify(before.meta) !== JSON.stringify(written.meta) && !(before.meta ?? []).some((b) => JSON.stringify(b) === JSON.stringify(r)));
    expect(counters.map((r) => (r as { key: string }).key).sort()).toEqual(['content', 'journal']);
    expect(Object.keys(written).filter((store) => /session|finish|placeholder/i.test(store))).toEqual([]);
  });
});
