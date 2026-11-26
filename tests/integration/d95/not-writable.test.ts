// I95.17 A page Marks save, an Action under the Plan rule and a Settle Later are refused with RuntimeNotWritable and write nothing when the Workspace is not Writable (AC-DEL-006),
// through the real facade. Everything a save needs is read while the host is healthy; then the host fails the inventory check and the application restarts into recovery.
import { describe, expect, it } from 'vitest';
import type { MarketDataPrepareEntry } from '../../../src/modules/market-data/index.ts';
import { dumpAll, restart } from '../d7/support.ts';
import { MON_1700, MONDAY, openOn, sixTradeBook } from './support.ts';

const notWritable = expect.objectContaining({
  kind: 'RuntimeNotWritable',
  failedChecks: expect.arrayContaining([expect.objectContaining({ check: 'inventory' })]) as unknown,
}) as unknown;

// JKL has no Monday Mark: the page save records it. ABC is 1.5R past its Stop, so its Hold carries a reason. XYZ's call is Settlement Due.
const ENTRIES: readonly MarketDataPrepareEntry[] = [{ key: { instrumentKey: 'JKL', tradingDate: MONDAY }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '20.50' } }];

async function prepared() {
  const book = await sixTradeBook({ withoutMonday: ['inside'] });
  const opened = await openOn(book.app, MON_1700);
  const saveBindingOf = async (tradeId: string) => {
    const card = await book.app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
    if (card.kind !== 'Ready') throw new Error(`getTrade: ${card.kind}`);
    return card.trade.saveBinding;
  };
  const requests = {
    marks: { kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, binding: opened.binding, entries: ENTRIES },
    action: { kind: 'SaveTradeAction', binding: await saveBindingOf(book.ids.shallow), action: 'Hold', intent: 'The Stop was a poor level.' },
    settleLater: { kind: 'SettleLater', binding: await saveBindingOf(book.ids.expired) },
  } as const;
  return { book, requests };
}

async function failedHost() {
  const { book, requests } = await prepared();
  book.d.testHost.fail(['inventory']);
  const recovery = await restart(book.app, book.d);
  return { d: book.d, recovery, requests, before: await dumpAll(book.d.factory) };
}

describe('I95.17 The new saves refuse a Workspace that is not Writable (AC-DEL-006)', () => {
  // The control: each prepared request is accepted by a Writable Workspace, so the refusals below are the gate's and not an earlier rejection.
  it('should accept each of the three saves while the Workspace is Writable', { timeout: 120_000 }, async () => {
    const results = [];
    for (const name of ['marks', 'action', 'settleLater'] as const) {
      const { book, requests } = await prepared();
      results.push((await book.app.DailyReview.save(requests[name])).kind);
    }

    expect(results).toEqual(['MarksSaved', 'Saved', 'Saved']);
  });

  it('should return RuntimeNotWritable from the page Marks save and write nothing', { timeout: 120_000 }, async () => {
    const { d, recovery, requests, before } = await failedHost();

    expect(await recovery.DailyReview.save(requests.marks)).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
  });

  it('should return RuntimeNotWritable from an Action under the Plan rule and write nothing', { timeout: 120_000 }, async () => {
    const { d, recovery, requests, before } = await failedHost();

    expect(await recovery.DailyReview.save(requests.action)).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
  });

  it('should return RuntimeNotWritable from Settle Later and write nothing', { timeout: 120_000 }, async () => {
    const { d, recovery, requests, before } = await failedHost();

    expect(await recovery.DailyReview.save(requests.settleLater)).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
  });
});
