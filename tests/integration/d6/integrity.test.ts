// I6.9: a Closed Trade whose stored lifecycle says Open (AC-LIFE-003, A96). Reads surface the disagreement without
// writing; a Sell and a Buy are both rejected by P22 with no write, so it stays visible until migration or Restore.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import {
  buy, closeReasonId, closeReviewDisposition, complete, confirmReference, contentRevision, currentDatabase, device, dumpAll, exitCommand, launch, onboarded, PC1, PC2, PC3, positionChange, rawUpdate, record, recordExit,
  TUESDAY_1400, TUESDAY_1700,
} from './support.ts';

// A Closed Trade whose stored lifecycle the integrity fixture writer sets to Open, then a new application over it.
async function disagreeing() {
  const d = await device(undefined, TUESDAY_1700);
  const first = await onboarded(d);
  const tradeId = await confirmReference(first);
  await record(first, tradeId, PC1);
  await record(first, tradeId, PC2);
  await recordExit(first, tradeId, [{ quantity: '100', price: '52.00', economicTime: TUESDAY_1400, fee: '0.60' }], {
    closeReasonId: await closeReasonId(first, 'Target Reached'),
    closeReview: await closeReviewDisposition(first, 'Complete'),
  });
  first.persistence.close();

  // The stored lifecycle becomes Open, and the Trade's index entries move with it.
  await rawUpdate(d.factory, await currentDatabase(d.factory), 'trades', tradeId, (trade) => ({ ...trade, lifecycle: 'Open' }));
  const app = await launch(d);
  return { d, app, tradeId, before: await dumpAll(d.factory) };
}

const disagreement = { kind: 'LifecycleDisagreement', stored: 'Open', expected: 'Closed' };

type DetailResult = Awaited<ReturnType<Application['TradeViewsAndReporting']['getTradeDetail']>>;
// The integrity findings of a Detail that has the Open form.
const findingsOf = (detail: DetailResult) => (detail.kind === 'Ready' && 'findings' in detail.view ? detail.view.findings : undefined);

describe('I6.9 Closed-lifecycle integrity', () => {
  it('should read Ready with LifecycleDisagreement stored Open expected Closed and the integrity indicator with the content revision unchanged', async () => {
    const { d, app, tradeId, before } = await disagreeing();
    const revision = contentRevision(before);

    expect((await app.Workspace.getStatus()).kind).toBe('Ready');
    const open = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
    if (open.kind !== 'Ready') throw new Error(`browseTrades Open: ${open.kind}`);
    expect(open.view.items.map((i) => [i.tradeId, i.integrity])).toEqual([[tradeId, 'Disagrees']]);
    const closed = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Closed' });
    expect(closed.kind === 'Ready' && closed.view.items).toEqual([]);

    const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
    if (detail.kind !== 'Ready') throw new Error(`getTradeDetail: ${detail.kind}`);
    expect(findingsOf(detail)).toEqual([disagreement]);
    expect(detail.view.lifecycle).toEqual({ stored: 'Open', agreement: disagreement });
    expect(contentRevision(await dumpAll(d.factory))).toBe(revision);
  }, 60_000);

  it('should reject a Sell with no write, leaving the disagreement visible', async () => {
    const { d, app, tradeId, before } = await disagreeing();

    const sell = await app.TradeWorkflows.recordPositionChange(await exitCommand(app, tradeId, [{ quantity: '10', price: '52.00', economicTime: TUESDAY_1400 }]));
    expect(sell.kind).toBe('Rejected');
    expect(await dumpAll(d.factory)).toEqual(before);
    expect(findingsOf(await app.TradeViewsAndReporting.getTradeDetail({ tradeId }))).toEqual([disagreement]);
  }, 60_000);

  it('should reject a Buy with no write, leaving the disagreement visible', async () => {
    const { d, app, tradeId, before } = await disagreeing();

    const bought = await app.TradeWorkflows.recordPositionChange(await positionChange(app, tradeId, [await buy(app, tradeId, PC3)], await complete(app)));
    expect(bought.kind).toBe('Rejected');
    expect(await dumpAll(d.factory)).toEqual(before);
    expect(findingsOf(await app.TradeViewsAndReporting.getTradeDetail({ tradeId }))).toEqual([disagreement]);
  }, 60_000);
});
