// I95.15 The Replay carries each session's Action, the key moments and the Plan Calls, equal from the Review card and from replayTrade (A317, decisions 136 and 137),
// and replayTrade keeps the one journal read it makes today (the pin R6). Through the real facade on fake-indexeddb.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { countRequests } from '../../support/request-counter.ts';
import { closeReasonId, closeReviewDisposition, device, onboarded, optionPlanCommand, recordExit, recordOption, restart, saveMark, XYZ_CALL } from '../d7/support.ts';
import { FRI_1700, FRIDAY, heldTrade, MARKS, MON_1700, MONDAY, openOn } from './support.ts';

interface ReplayLike {
  readonly sessions: readonly { readonly date: string; readonly action?: { readonly action: string; readonly intent?: string }; readonly planCall?: { readonly call: string } }[];
  readonly keyMoments?: readonly unknown[];
}

// What a replay says of each session's Action and Plan Call, and its key moments.
const projectionOf = (replay: ReplayLike) => ({
  sessions: replay.sessions.map((s) => ({ date: s.date, ...(s.action && { action: s.action }), ...(s.planCall && { planCall: s.planCall.call }) })),
  keyMoments: replay.keyMoments,
});

async function cardReplay(app: Application, tradeId: string, now = MON_1700) {
  const opened = await openOn(app, now);
  const card = await app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (card.kind !== 'Ready' || !card.trade.replay) throw new Error(`getTrade: ${card.kind}`);
  return card.trade.replay;
}

async function detailReplay(app: Application, tradeId: string) {
  const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
  if (detail.kind !== 'Ready') throw new Error(`getTradeDetail: ${detail.kind}`);
  const replay = await app.TradeViewsAndReporting.replayTrade({ tradeId, binding: detail.binding });
  if (replay.kind !== 'Ready') throw new Error(`replayTrade: ${replay.kind}`);
  return replay.view;
}

// An XYZ stock Trade bought 10-05 (Stop 47.50, Target 56) with a Hold saved for 10-06 and 10-08.
const held = () => heldTrade(MARKS, ['2026-10-06', '2026-10-08']);

describe('I95.15 The Replay carries each session Action, key moments and Plan Calls', () => {
  it('should place each saved Action with its reason on its Review Date session and none on the others, from the Review card and from replayTrade', { timeout: 120_000 }, async () => {
    const { app, tradeId } = await held();

    const fromCard = projectionOf(await cardReplay(app, tradeId));
    const fromDetail = projectionOf(await detailReplay(app, tradeId));

    // Catches an Action placed on the wrong session, one without its reason, or one carried by only one of the two replays.
    const actions = (p: typeof fromCard) => p.sessions.map((s) => [s.date, s.action]);
    const expected = [
      ['2026-10-05', undefined],
      ['2026-10-06', { action: 'Hold', intent: 'Held on 2026-10-06.' }],
      ['2026-10-07', undefined],
      ['2026-10-08', { action: 'Hold', intent: 'Held on 2026-10-08.' }],
      ['2026-10-09', undefined],
      [MONDAY, undefined],
    ];
    expect(actions(fromCard)).toEqual(expected);
    expect(actions(fromDetail)).toEqual(expected);
  });

  it('should carry the key moments and each session Plan Call, equal from the Review card and from replayTrade', { timeout: 120_000 }, async () => {
    const { app, tradeId } = await held();

    const fromCard = projectionOf(await cardReplay(app, tradeId));
    const fromDetail = projectionOf(await detailReplay(app, tradeId));

    // Bought at 50, inside both lines; below the Stop at 47.50 from 10-06; the lowest Trade P&L is 10-07's (46.00), and the highest is the first session's.
    const calls = ['Hold', 'Out', 'Out', 'Out', 'Out', 'Out'];
    const moments = [
      { date: '2026-10-05', kinds: ['Entry', 'High'] },
      { date: '2026-10-06', kinds: ['Stop'] },
      { date: '2026-10-07', kinds: ['Low'] },
      { date: MONDAY, kinds: ['Now'] },
    ];
    for (const projection of [fromCard, fromDetail]) {
      expect(projection.sessions.map((s) => s.planCall)).toEqual(calls);
      expect(projection.keyMoments).toEqual(moments);
    }
    expect(fromCard).toEqual(fromDetail);
  });

  it('should carry the Actions on the Review card with no narrative read, and keep the one journal read of replayTrade, the pin R6', { timeout: 120_000 }, async () => {
    const book = await held();
    const detail = await book.app.TradeViewsAndReporting.getTradeDetail({ tradeId: book.tradeId });
    if (detail.kind !== 'Ready') throw new Error(`getTradeDetail: ${detail.kind}`);
    const replaying = await restart(book.app, book.d);
    const opened = await openOn(replaying, MON_1700);
    const reviewing = await restart(replaying, book.d);

    const replayed = await countRequests(() => replaying.TradeViewsAndReporting.replayTrade({ tradeId: book.tradeId, binding: detail.binding }));
    const carded = await countRequests(() => reviewing.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId: book.tradeId, binding: opened.binding }));

    // Catches an extra whole-store narrative read in either: replayTrade makes one journalEntries.getAll, the card one read by the Trade's anchor and nothing else.
    expect(replayed.requests.filter((r) => r.store === 'journalEntries' && r.method === 'getAll')).toHaveLength(1);
    expect(carded.requests.filter((r) => r.store === 'journalEntries')).toEqual([{ on: 'index', store: 'journalEntries', index: 'byAnchorTrade', method: 'getAll' }]);
    if (carded.result.kind !== 'Ready' || !carded.result.trade.replay) throw new Error('getTrade is not Ready');
    expect(carded.result.trade.replay.sessions.filter((s) => s.action).map((s) => s.date)).toEqual(['2026-10-06', '2026-10-08']);
    // The card's replay places no Journal items.
    expect(carded.result.trade.replay.sessions.flatMap((s) => s.journal)).toEqual([]);
  });

  it('should give the owed card of a closed Trade the same replay with its Plan Calls and key moments as replayTrade, ending with the sale', { timeout: 120_000 }, async () => {
    const { app, tradeId } = await held();
    await recordExit(app, tradeId, [{ quantity: '100', price: '46.00', economicTime: '2026-10-12T19:00:00Z', fee: '1.00' }], { closeReasonId: await closeReasonId(app, 'Target Reached'), closeReview: await closeReviewDisposition(app, 'Defer') });
    // The closed Trade is outside the walk: the Review opens Empty, with the reflection owed beside it.
    const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MON_1700 });
    if (opened.kind !== 'Empty') throw new Error(`open: ${opened.kind}`);

    const owed = await app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });

    // Catches an owed card with no replay (decision 136), or one whose Plan Calls or key moments differ from the Trade's own replay. The owed card assembles
    // its replay with no Journal read (decision 136), so its sessions carry no Action; that is left unasserted here.
    if (owed.kind !== 'ReflectionsOwed' || !owed.card.replay) throw new Error(`getTrade: ${owed.kind}`);
    const withoutActions = (replay: ReplayLike) => ({ ...projectionOf(replay), sessions: projectionOf(replay).sessions.map(({ date, planCall }) => ({ date, planCall })) });
    const fromCard = withoutActions(owed.card.replay);
    expect(fromCard).toEqual(withoutActions(await detailReplay(app, tradeId)));
    // The closed Trade holds nothing at its last session, so that session has no call to make.
    expect(fromCard.sessions.map((s) => s.planCall)).toEqual(['Hold', 'Out', 'Out', 'Out', 'Out', 'Unknown']);
    expect(fromCard.keyMoments).toEqual([
      { date: '2026-10-05', kinds: ['Entry', 'High'] },
      { date: '2026-10-06', kinds: ['Stop'] },
      // The sale's fee puts the last session's Trade P&L (-402) below 10-07's (-401).
      { date: MONDAY, kinds: ['Low', 'Sale', 'End'] },
    ]);
  });

  it('should place a Settle Later on its session, from the Review card and from replayTrade', { timeout: 120_000 }, async () => {
    // The contract's last session is the replay's last, so the Settle Later is saved on Friday's Review (the day it expires).
    const d = await device(undefined, FRI_1700);
    const app = await onboarded(d);
    const call = await optionPlanCommand(app, 'O-C', '2026-10-05T13:00:00Z');
    const confirmed = await app.TradeWorkflows.confirmPlan({ ...call, plan: { ...call.plan, legs: [{ ...call.plan.legs[0]!, instrument: { ...XYZ_CALL, expiration: FRIDAY }, quantity: '1' }] } });
    if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan: ${JSON.stringify(confirmed)}`);
    const tradeId = confirmed.receipt.tradeId;
    await recordOption(app, tradeId, 'Buy', { quantity: '1', price: '2.10', economicTime: '2026-10-05T14:00:00Z', fee: '0.65' });
    await saveMark(app, 'XYZ', FRIDAY, '60.00');
    const opened = await openOn(app, FRI_1700);
    const card = await app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
    if (card.kind !== 'Ready') throw new Error(`getTrade: ${card.kind}`);
    const saved = await app.DailyReview.save({ kind: 'SettleLater', binding: card.trade.saveBinding });
    if (saved.kind !== 'Saved') throw new Error(`SettleLater: ${saved.kind}`);

    for (const replay of [await cardReplay(app, tradeId, FRI_1700), await detailReplay(app, tradeId)]) {
      // Catches a Settle Later left off the replay or put on another session; it holds no reason.
      expect(replay.sessions.filter((s) => s.action).map((s) => [s.date, s.action])).toEqual([[FRIDAY, { action: 'Settle Later' }]]);
    }
  });
});
