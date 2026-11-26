// I95.13 Settle Later finishes one Review only (AC-SET-005), nothing is inferred from an expiration date that has passed (AC-SET-003), and the four completion states
// are honest and reverse on the next date (AC-REV-006); each save returns the refreshed Review (AC-RESP-001). Through the real facade on fake-indexeddb.
// A call on XYZ expired Friday 10-09 with no settlement recorded, and two stock Trades inside their lines (JKL, KLM); Monday 10-12 is the Review Date.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { closeReviewDisposition, device, dumpAll, onboarded, optionPlanCommand, planStock, record, recordExpiration, recordOption, resolveCloseReview, saveMark, XYZ_CALL } from '../d7/support.ts';
import { FRIDAY, MON_1700, MONDAY, onDay, openOn, saveActionOn } from './support.ts';

const MON_1000 = '2026-10-12T14:00:00Z';
const TUE_1700 = '2026-10-13T21:00:00Z';
const TUESDAY = '2026-10-13';
const SETTLEMENT_TIME = '2026-10-09T20:00:00Z';
const EXPIRED_CALL = { ...XYZ_CALL, expiration: FRIDAY } as const;

interface BookOptions {
  // KLM's Monday Mark is acknowledged Unavailable instead of typed.
  readonly klmUnavailable?: boolean;
}

async function settlementBook(options: BookOptions = {}) {
  const d = await device(undefined, MON_1700);
  const app = await onboarded(d);
  const stock = async (symbol: string, entry: string, stop: string, target: string) => {
    const tradeId = await planStock(app, symbol, entry, stop, target, '100', '2026-10-12T13:00:00Z');
    await record(app, tradeId, { quantity: '100', price: entry, economicTime: MON_1000 });
    return tradeId;
  };
  const jkl = await stock('JKL', '20.00', '19.00', '30.00');
  const klm = await stock('KLM', '20.00', '19.00', '30.00');
  const call = await optionPlanCommand(app, 'O-C', '2026-10-05T13:00:00Z');
  const confirmed = await app.TradeWorkflows.confirmPlan({ ...call, plan: { ...call.plan, legs: [{ ...call.plan.legs[0]!, instrument: EXPIRED_CALL, quantity: '1' }] } });
  if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan: ${JSON.stringify(confirmed)}`);
  const xyz = confirmed.receipt.tradeId;
  await recordOption(app, xyz, 'Buy', { quantity: '1', price: '2.10', economicTime: '2026-10-05T14:00:00Z', fee: '0.65' });
  // XYZ finished Friday at 60 against a 55 strike: the call is in the money.
  await saveMark(app, 'XYZ', FRIDAY, '60.00');
  await saveMark(app, 'JKL', MONDAY, '20.50');
  if (options.klmUnavailable) {
    const acknowledged = await app.MarketData.save({ intention: 'AssertUnavailable', instrumentKey: 'KLM', tradingDate: MONDAY, reason: 'No quote today.', expectedResolutionRevision: 'None' });
    if (acknowledged.kind !== 'Saved') throw new Error(`AssertUnavailable: ${acknowledged.kind}`);
  } else {
    await saveMark(app, 'KLM', MONDAY, '20.50');
  }
  return { d, app, ids: { jkl, klm, xyz } };
}

type Book = Awaited<ReturnType<typeof settlementBook>>;

async function cardOf(app: Application, now: string, tradeId: string) {
  const opened = await openOn(app, now);
  const card = await app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (card.kind !== 'Ready') throw new Error(`getTrade: ${card.kind}`);
  return card.trade;
}

async function settleLater(app: Application, now: string, tradeId: string) {
  const saved = await app.DailyReview.save({ kind: 'SettleLater', binding: (await cardOf(app, now, tradeId)).saveBinding });
  if (saved.kind !== 'Saved') throw new Error(`SettleLater: ${JSON.stringify(saved).slice(0, 300)}`);
  return saved;
}

// Every other obligation resolved: a Hold for each stock Trade.
async function holdBoth(book: Book) {
  await saveActionOn(book.app, MON_1700, book.ids.jkl, 'Hold');
  await saveActionOn(book.app, MON_1700, book.ids.klm, 'Hold');
}

// The Workspace's stores as the dump holds them.
async function storesOf(book: Book) {
  const dump = await dumpAll(book.d.factory);
  const name = Object.keys(dump).find((n) => n.startsWith('tj-ws-'));
  return dump[name!] as Record<string, unknown[]>;
}

const changedStores = (before: Record<string, unknown[]>, after: Record<string, unknown[]>) => Object.keys(after).filter((name) => JSON.stringify(after[name]) !== JSON.stringify(before[name]));

// The Daily Trade Review Entries stored for a Trade, as the option each chose.
async function actionsOf(book: Book, tradeId: string) {
  const entries = (await storesOf(book))['journalEntries'] as { entryTypeKey: string; anchorTradeId: string; origin: { reviewDate?: string }; versions: { responses: { promptId: string; value: { optionId?: string } }[] }[] }[];
  return entries
    .filter((entry) => entry.entryTypeKey === 'entry-type.daily-trade-review' && entry.anchorTradeId === tradeId)
    .map((entry) => ({ reviewDate: entry.origin.reviewDate, option: entry.versions.at(-1)!.responses.find((r) => r.promptId === 'prompt.daily-trade-review.action')!.value.optionId }));
}

const reasonsOf = (completion: Awaited<ReturnType<typeof openOn>>['completion']) => (completion.kind === 'Incomplete' ? completion.reasons : []);

describe('I95.13 AC-SET-003 An expiration is never inferred', () => {
  it('should infer no Expiration and no Closed Trade when the Review and Trade Detail are opened after the expiration date, and keep the Review Incomplete with Settlement Due', { timeout: 120_000 }, async () => {
    const book = await settlementBook();
    const before = await storesOf(book);

    const opened = await openOn(book.app, MON_1700);
    const detail = await book.app.TradeViewsAndReporting.getTradeDetail({ tradeId: book.ids.xyz });
    const closed = await book.app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Closed' });

    // Catches an Expiration or Closed lifecycle written on open: no store changes, the Trade is Open and not listed as Closed.
    expect(changedStores(before, await storesOf(book))).toEqual([]);
    if (detail.kind !== 'Ready' || closed.kind !== 'Ready') throw new Error('not Ready');
    expect(detail.view.lifecycle).toEqual({ stored: 'Open', agreement: { kind: 'Agrees' } });
    expect('settlement' in detail.view ? detail.view.settlement.map((item) => item.tradeId) : undefined).toEqual([book.ids.xyz]);
    expect(closed.view.items).toEqual([]);
    // Catches a Review that completes without the settlement, or that owes the expired Trade an Action: Settlement Due is the Review's reason.
    const reasons = reasonsOf(opened.completion);
    expect(reasons.filter((r) => r.code === 'SettlementDue').map((r) => r.tradeId)).toEqual([book.ids.xyz]);
    expect(reasons.filter((r) => r.code === 'ActionMissing').map((r) => r.tradeId).sort()).toEqual([book.ids.jkl, book.ids.klm].sort());
  });

  it('should refuse Hold, Exit, Roll and Adjust for the expired Trade with ActionNotOwed, and Settle Later for a Trade with no Settlement Due, writing nothing', { timeout: 120_000 }, async () => {
    const book = await settlementBook();
    const expired = (await cardOf(book.app, MON_1700, book.ids.xyz)).saveBinding;
    const stock = (await cardOf(book.app, MON_1700, book.ids.jkl)).saveBinding;
    const before = await storesOf(book);

    const actions = [];
    for (const action of ['Hold', 'Exit', 'Roll', 'Adjust'] as const) actions.push(await book.app.DailyReview.save({ kind: 'SaveTradeAction', binding: expired, action, intent: 'The plan changed.' }));
    const later = await book.app.DailyReview.save({ kind: 'SettleLater', binding: stock });

    expect(actions).toEqual(Array(4).fill({ kind: 'Rejected', issues: [{ code: 'ActionNotOwed' }] }));
    expect(later).toEqual({ kind: 'Rejected', issues: [{ code: 'SettleLaterNotApplicable' }] });
    expect(changedStores(before, await storesOf(book))).toEqual([]);
  });
});

describe('I95.13 AC-SET-005 Settle Later finishes one Review only', () => {
  it('should save one Daily Trade Review Entry with Settle Later for the Trade and date, change no Trade fact and return the refreshed Review', { timeout: 120_000 }, async () => {
    const book = await settlementBook();
    const before = await storesOf(book);

    const saved = await settleLater(book.app, MON_1700, book.ids.xyz);

    // Catches an Action saved as another option, a second Entry, a save that touches a Trade fact, or a response that is not the Review after the save.
    expect(await actionsOf(book, book.ids.xyz)).toEqual([{ reviewDate: MONDAY, option: 'option.daily-trade-review.action.settle-later' }]);
    expect(changedStores(before, await storesOf(book))).toEqual(['journalEntries', 'journalObligations', 'meta']);
    expect(saved.action).toMatchObject({ action: 'Settle Later', reviewDate: MONDAY, anchor: { kind: 'Trade', tradeId: book.ids.xyz } });
    if (saved.review.kind !== 'Ready') throw new Error(`review: ${saved.review.kind}`);
    expect(saved.review.progress).toEqual({ tradesWithAction: 1, tradesEligible: 3 });
    expect(reasonsOf(saved.review.completion).map((r) => r.code)).not.toContain('SettlementDue');
    expect(saved.review.day?.toGo.expirations).toBe(0);
  });

  it('should report CompleteWithSettlementToRecord naming the Trade once every other obligation is resolved, in the save response and the next open alike', { timeout: 120_000 }, async () => {
    const book = await settlementBook();
    await holdBoth(book);

    const saved = await settleLater(book.app, MON_1700, book.ids.xyz);

    // Catches a Review that stays Incomplete, completes as plain Complete, or names no Trade.
    expect(saved.review.kind === 'Ready' && saved.review.completion).toEqual({ kind: 'CompleteWithSettlementToRecord', trades: [book.ids.xyz] });
    expect((await openOn(book.app, MON_1700)).completion).toEqual({ kind: 'CompleteWithSettlementToRecord', trades: [book.ids.xyz] });
    // The Trade stays Open with its Settlement Due, and owes no Hold, Exit, Roll or Adjust.
    const detail = await book.app.TradeViewsAndReporting.getTradeDetail({ tradeId: book.ids.xyz });
    expect(detail.kind === 'Ready' && detail.view.lifecycle).toEqual({ stored: 'Open', agreement: { kind: 'Agrees' } });
    expect(await actionsOf(book, book.ids.xyz)).toHaveLength(1);
  });

  it('should carry the Unavailable disclosure beside the settlement to record when both apply', { timeout: 120_000 }, async () => {
    const book = await settlementBook({ klmUnavailable: true });
    await holdBoth(book);

    const saved = await settleLater(book.app, MON_1700, book.ids.xyz);

    // Catches a completion that drops either disclosure: the Trade naming the settlement and the Instrument, Trade and families of the acknowledged Mark.
    const expected = { kind: 'CompleteWithSettlementToRecord', trades: [book.ids.xyz], unavailable: { instruments: [{ kind: 'Stock', symbol: 'KLM' }], trades: [book.ids.klm], families: expect.any(Array) as unknown } };
    expect(saved.review.kind === 'Ready' && saved.review.completion).toEqual(expected);
    expect((await openOn(book.app, MON_1700)).completion).toEqual(expected);
  });

  it('should report Settlement Due again, and Incomplete, on the next Review Date, with the Settle Later date on the card and no Action owed', { timeout: 120_000 }, async () => {
    const book = await settlementBook();
    await holdBoth(book);
    await settleLater(book.app, MON_1700, book.ids.xyz);
    book.app.persistence.close();

    await onDay(book.d, TUE_1700, async (app) => {
      await saveMark(app, 'JKL', TUESDAY, '20.50');
      await saveMark(app, 'KLM', TUESDAY, '20.50');
      const tuesday = await openOn(app, TUE_1700);
      const card = await cardOf(app, TUE_1700, book.ids.xyz);

      // Catches a Settle Later that carries over: Tuesday is Incomplete, asks for the settlement again and still owes the expired Trade no Action.
      expect(tuesday.reviewDate).toBe(TUESDAY);
      expect(reasonsOf(tuesday.completion).filter((r) => r.code === 'SettlementDue').map((r) => r.tradeId)).toEqual([book.ids.xyz]);
      expect(reasonsOf(tuesday.completion).filter((r) => r.code === 'ActionMissing').map((r) => r.tradeId).sort()).toEqual([book.ids.jkl, book.ids.klm].sort());
      expect(tuesday.day?.toGo.expirations).toBe(1);
      expect(card.settledLaterOn).toBe(MONDAY);
      expect(card.progress.panels.find((p) => p.panel === 'Action')).toEqual({ panel: 'Action', done: true, owed: false });
    });
  });

  it('should report Complete once the expiration is recorded, keeping the Settle Later Entry', { timeout: 120_000 }, async () => {
    const book = await settlementBook();
    await holdBoth(book);
    await settleLater(book.app, MON_1700, book.ids.xyz);

    await recordExpiration(book.app, book.ids.xyz, '1', SETTLEMENT_TIME, { closeReview: await closeReviewDisposition(book.app, 'Defer') });
    await resolveCloseReview(book.app, book.ids.xyz, await closeReviewDisposition(book.app, 'Decline'));

    // Catches a Review that stays Complete With Settlement To Record after the outcome, or an Entry removed with it.
    expect((await openOn(book.app, MON_1700)).completion).toEqual({ kind: 'Complete' });
    expect(await actionsOf(book, book.ids.xyz)).toEqual([{ reviewDate: MONDAY, option: 'option.daily-trade-review.action.settle-later' }]);
  });

  it('should report Complete With Unavailable Marks when the expiration is recorded and an acknowledged Mark remains', { timeout: 120_000 }, async () => {
    const book = await settlementBook({ klmUnavailable: true });
    await holdBoth(book);
    await settleLater(book.app, MON_1700, book.ids.xyz);

    await recordExpiration(book.app, book.ids.xyz, '1', SETTLEMENT_TIME, { closeReview: await closeReviewDisposition(book.app, 'Defer') });
    await resolveCloseReview(book.app, book.ids.xyz, await closeReviewDisposition(book.app, 'Decline'));

    // Catches a disclosure lost with the settlement: the same Instrument and Trade, with no Trade to record.
    expect((await openOn(book.app, MON_1700)).completion).toEqual({ kind: 'CompleteWithUnavailableMarks', instruments: [{ kind: 'Stock', symbol: 'KLM' }], trades: [book.ids.klm], families: expect.any(Array) as unknown });
  });
});
