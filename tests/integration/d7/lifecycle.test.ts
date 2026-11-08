// I7.3: the complete lifecycle of the Long Call O-C, Planned through Closed by its Expiration (AC-PLAN-001,
// AC-POS-004, AC-CALC-004, AC-RESP-001): stored and expected lifecycle agree at each revision, every result
// equals the stored Trade, and the dump holds an Expiration settlement fact with no price or fee, no Close
// Reason fact and no Lot-Match record.
import { describe, expect, it } from 'vitest';
import { Rational } from '../../../src/domain/values/index.ts';
import { closedViaOption } from '../../../src/ui/screens/option-disposition.ts';
import {
  closeReviewDisposition, complete, confirmOption, dec, detailOf, dumpAll, listed, OC_PC1, OC_PC2, OC_X1, onboardedAt, recordExpiration, recordOption, restart, FRIDAY_1600, FRIDAY_1700, XYZ_CALL,
  workspaceStores, type StoredTradeDoc,
} from './support.ts';

describe('I7.3 Long Call lifecycle', () => {
  it('should confirm O-C with 1R $400 and the Planned view, then step Planned, Open, Open, Open, Closed with agreement at each revision, every result equal to the stored Trade, and show the Expiration, the Lot Matches, the Terminal Disposition and Mixed timing after restart', async () => {
    const { d, app } = await onboardedAt(FRIDAY_1700);

    // Confirmation: 1R $400, the Planned view, and the Entry snapshotting the definition the form showed.
    const confirmed = await confirmOption(app, 'O-C');
    const tradeId = confirmed.receipt.tradeId;
    expect(confirmed.postCommit.derivation.baseline.oneR).toEqual(dec('400'));
    expect(confirmed.postCommit.derivation.baseline.originalPlannedReward).toEqual(dec('600'));
    expect(confirmed.postCommit.derivation.agreement).toEqual({ kind: 'Agrees' });
    expect(confirmed.postCommit.trade.storedLifecycle).toBe('Planned');
    expect(confirmed.postCommit.payoff.planned.kind).toBe('Value');
    const planned = await detailOf(app, tradeId);
    if (!('baseline' in planned)) throw new Error('expected the Planned form of Detail');
    expect(planned.lifecycle).toEqual({ stored: 'Planned', agreement: { kind: 'Agrees' } });
    expect(planned.baseline.oneR).toEqual(dec('400'));
    expect(planned.payoff).toEqual(confirmed.postCommit.payoff);
    expect(confirmed.postCommit.trade.plan.legs).toEqual(planned.plan.legs);
    expect(confirmed.postCommit.trade.plan.exerciseIntent).toBe('NotAuthorized');
    const definitionId = (await app.Journal.getDefinitions({ latestFor: 'entry-type.plan-reflection' }))
    expect(definitionId.kind).toBe('Found');
    const planEntry = (workspaceStores(await dumpAll(d.factory))['journalEntries'] as { id: string; entryTypeKey: string; versions: { definitionId: string }[] }[]).find((e) => e.entryTypeKey === 'entry-type.plan-reflection')!;
    expect(planEntry.versions[0]!.definitionId).toBe(definitionId.kind === 'Found' ? definitionId.definition.id : '');
    expect(confirmed.postCommit.entry.anchor).toEqual({ kind: 'Trade', tradeId });

    // PC1, PC2, X1: Open, Open, Open; each result equals the stored Trade.
    const results = [];
    for (const [action, fill] of [['Buy', OC_PC1], ['Buy', OC_PC2], ['Sell', OC_X1]] as const) {
      const result = await recordOption(app, tradeId, action, fill, { reflection: await complete(app) });
      results.push(result);
      expect(result.postCommit.trade.storedLifecycle).toBe('Open');
      expect(result.postCommit.derivation.expectedLifecycle).toBe('Open');
      expect(result.postCommit.derivation.agreement).toEqual({ kind: 'Agrees' });
      const openDetail = await detailOf(app, tradeId);
      expect(openDetail.lifecycle).toEqual({ stored: 'Open', agreement: { kind: 'Agrees' } });
      expect('positionChanges' in openDetail && openDetail.positionChanges).toEqual(result.postCommit.trade.positionChanges);
      expect('realizedToDate' in openDetail && openDetail.realizedToDate).toEqual(result.postCommit.derivation.realizedToDate);
    }
    expect(results[0]!.receipt.lifecycleTransitions).toEqual([{ tradeId, from: 'Planned', to: 'Open' }]);
    expect(results[2]!.postCommit.derivation.realizedToDate).toEqual(dec('88.70'));

    // E1 at the settlement time, Friday 16:00, recorded at 17:00 with both reflections completed.
    const expired = await recordExpiration(app, tradeId, '1', FRIDAY_1600, { reflection: await complete(app), closeReview: await closeReviewDisposition(app, 'Complete') });
    expect(expired.receipt.lifecycleTransitions).toEqual([{ tradeId, from: 'Open', to: 'Closed' }]);
    expect(expired.postCommit.trade.storedLifecycle).toBe('Closed');
    expect(expired.postCommit.derivation.expectedLifecycle).toBe('Closed');
    expect(expired.postCommit.derivation.agreement).toEqual({ kind: 'Agrees' });
    expect(expired.postCommit.trade.closeReason).toBeUndefined();

    // Dump: an Expiration settlement fact with no price or fee, no Close Reason fact, no Lot-Match record.
    const dump = await dumpAll(d.factory);
    const stores = workspaceStores(dump);
    const trade = (stores['trades'] as (StoredTradeDoc & { closeReasonFacts?: unknown[] })[])[0]!;
    const expirations = trade.facts.filter((f) => f.kind === 'Expiration');
    expect(expirations).toHaveLength(1);
    const settlement = JSON.stringify(expirations[0]);
    expect(settlement).toContain('"quantity":"1"');
    expect(settlement).not.toMatch(/"(price|fee)"/);
    expect(trade.closeReasonFacts ?? []).toEqual([]);
    expect(trade.lifecycle).toBe('Closed');
    expect(Object.keys(stores).filter((name) => /lot|match/i.test(name))).toEqual([]);
    expect(JSON.stringify(dump)).not.toMatch(/lotMatch|LotMatch/);

    // Restart: the Closed Detail equals the last result (AC-RESP-001).
    const again = await restart(app, d);
    const detail = await detailOf(again, tradeId);
    if (!('terminalDisposition' in detail)) throw new Error('expected the Closed form of Detail');
    expect(detail.lifecycle).toEqual({ stored: 'Closed', agreement: { kind: 'Agrees' } });
    expect(expired.postCommit.trade.positionChanges).toEqual(detail.positionChanges);
    expect(expired.postCommit.derivation.realizedToDate).toEqual(detail.realizedToDate);
    expect(expired.postCommit.derivation.terminalDisposition).toEqual(detail.terminalDisposition);

    // Detail: PC1 <- X1 and PC2 <- E1, realized -101.95, Realized R -2039/8000 (-0.25R), the mechanisms, Mixed.
    const value = (text: string) => ({ kind: 'Value', value: dec(text) });
    expect(detail.lotMatches.map((m) => [m.quantity, m.realized])).toEqual([
      [dec('1'), value('88.70')],
      [dec('1'), value('-190.65')],
    ]);
    const [ex1, ex2] = [results[0]!, results[1]!].map((r) => r.receipt.createdFactIds[1]!);
    expect(detail.lotMatches.map((m) => m.openingExecutionId)).toEqual([ex1, ex2]);
    expect(detail.lotMatches[0]!.disposingExecutionId).toBe(results[2]!.receipt.createdFactIds[1]);
    expect(detail.lotMatches[1]!.disposingExecutionId).not.toBe(results[2]!.receipt.createdFactIds[1]);
    expect(detail.realizedToDate).toEqual(dec('-101.95'));
    expect(detail.realizedR).toEqual({ kind: 'Value', value: Rational.of(-2039n, 8000n) });
    if (detail.terminalDisposition.kind !== 'Value') throw new Error('expected a Terminal Disposition');
    expect(closedViaOption('Long', detail.terminalDisposition.value)).toBe('Closed via sale of 1 contract and expiration of 1 contract');
    expect(detail.optionDispositionTiming).toEqual(expect.objectContaining({ kind: 'Value', value: expect.objectContaining({ timing: 'Mixed' }) as unknown }));
    expect(detail.closeReason).toBeUndefined();
    expect(detail.terminalTime).toBe(FRIDAY_1600);
    expect(detail.journal).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'Entry', entryTypeKey: 'entry-type.close-review' })]));
    expect(detail.plan.legs[0]!.instrument).toEqual(XYZ_CALL);

    // Browse: Closed only.
    expect((await listed(again, 'Planned')).map((i) => i.tradeId)).toEqual([]);
    expect((await listed(again, 'Open')).map((i) => i.tradeId)).toEqual([]);
    expect((await listed(again, 'Closed')).map((i) => i.tradeId)).toEqual([tradeId]);
  }, 60_000);
});
