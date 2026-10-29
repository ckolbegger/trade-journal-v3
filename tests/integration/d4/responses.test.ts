// AC-RESP-001 for Market Data (D4): every `MarketData.save` result equals durable state. I4.3's
// save result, and I4.5's correction, its footprint, and its stale Conflict.
import { describe, expect, it } from 'vitest';
import { detail, dumpAll, MONDAY, openItem, referenceTrade, restart, saveMark, value, workspaceStores, type StoredObservation } from './support.ts';

const observations = async (factory: Parameters<typeof dumpAll>[0]) => workspaceStores(await dumpAll(factory))['observations'] as StoredObservation[];

describe('I4.3 save result equals durable state', () => {
  it('should return a resolution and resolution revision equal to the stored record', async () => {
    const { d, app } = await referenceTrade();
    const saved = await saveMark(app, 'XYZ', MONDAY, '52.00');
    const [stored] = await observations(d.factory);
    expect(saved.resolution.kind === 'Available' && saved.resolution.mark).toMatchObject({
      revisionId: stored!.effectiveMarkId,
      price: stored!.marks[0]!.price,
    });
    expect(saved.resolutionRevision).toBe(stored!.resolutionRevision);
    expect(saved.key).toEqual({ instrumentKey: stored!.instrumentKey, tradingDate: stored!.tradingDate });
  });
});

describe('I4.5 correct a Mark', () => {
  it('should classify the correction with its footprint, show 130.00, risk 400.00, reward 450.00 as Corrected with two stored revisions, and return Conflict for a stale correction with the dump unchanged', async () => {
    const { d, app, tradeId } = await referenceTrade();
    const first = await saveMark(app, 'XYZ', MONDAY, '52.00');
    const correction = { intention: 'CorrectMark', instrumentKey: 'XYZ', tradingDate: MONDAY, price: '51.50', reason: 'Misread the quote.', expectedResolutionRevision: first.resolutionRevision } as const;

    const saved = await app.MarketData.save(correction);
    if (saved.kind !== 'Saved' || !('revision' in saved)) throw new Error(`correct: ${JSON.stringify(saved)}`);
    expect(saved.classification).toBe('Correction');
    expect(saved.resolutionRevision).toBe(2);
    expect(saved.revision).toEqual(
      expect.objectContaining({
        revisionNumber: 2,
        price: '51.5',
        reason: 'Misread the quote.',
        supersedes: first.revision.revisionId,
        correctionFootprint: expect.objectContaining({
          key: { instrumentKey: 'XYZ', tradingDate: MONDAY },
          effectDate: MONDAY,
          domains: ['Valuation', 'ConditionStatus', 'Replay'],
          replayInterval: { from: MONDAY, to: MONDAY },
        }) as unknown,
      }),
    );

    const again = await restart(app, d);
    const current = (await openItem(again, tradeId)).current;
    expect(current.currentMarkedPnl).toEqual(value('130'));
    expect(current.ongoingRiskToStop).toEqual(value('400'));
    expect(current.incrementalRewardToTarget).toEqual(value('450'));
    expect(current.markResolution).toEqual(saved.resolution);
    const view = (await detail(again, tradeId)).current;
    expect(view.evaluation).toEqual(
      expect.objectContaining({ kind: 'Evaluated', currentMarkedPnl: value('130'), ongoingRiskToStop: value('400'), incrementalRewardToTarget: value('450') }),
    );
    // The view exposes no Corrected flag: the UI shows Corrected from `correctionReason` on a revision past the first.
    expect(view.markResolution).toEqual({ kind: 'Available', mark: expect.objectContaining({ price: '51.5', revisionNumber: 2, correctionReason: 'Misread the quote.' }) as unknown });

    // Two revisions in the stored record, the resolution revision equal to the result's.
    const [stored] = await observations(d.factory);
    expect(stored!.marks.map((m) => m.price)).toEqual(['52', '51.5']);
    expect(stored!.resolutionRevision).toBe(saved.resolutionRevision);
    expect(stored!.effectiveMarkId).toBe(saved.revision.revisionId);

    // A second correction prepared against the original binding is stale: Conflict, nothing written.
    const before = await dumpAll(d.factory);
    const stale = await again.MarketData.save({ ...correction, price: '51.00' });
    expect(stale).toEqual(expect.objectContaining({ kind: 'Conflict', key: { instrumentKey: 'XYZ', tradingDate: MONDAY }, resolutionRevision: 2 }));
    expect(await dumpAll(d.factory)).toEqual(before);
  });
});
