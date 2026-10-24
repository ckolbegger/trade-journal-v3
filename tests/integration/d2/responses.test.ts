// I2.5, AC-RESP-001: the recordPositionChange response equals the Detail read after restart.
import { describe, expect, it } from 'vitest';
import { complete, device, onboarded, PC1, confirmReference, record, restart } from './support.ts';

describe('I2.5 open a position, AC-RESP-001 responses', () => {
  it('should return the Trade, derivation, and Entry equal to the Detail read after restart', async () => {
    const d = await device();
    const app = await onboarded(d);
    const tradeId = await confirmReference(app);
    const result = await record(app, tradeId, PC1, await complete(app));
    const { receipt, postCommit } = result;
    if (postCommit.reflection.kind !== 'Entry') throw new Error('expected an Entry');
    const entry = postCommit.reflection.entry;

    const again = await restart(app, d);
    const detail = await again.TradeViewsAndReporting.getTradeDetail({ tradeId });
    if (detail.kind !== 'Ready' || !('positionChanges' in detail.view)) throw new Error('expected the Open form of Detail');
    const view = detail.view;
    expect(view.factRevision).toBe(receipt.factRevision);
    expect(view.factRevision).toBe(postCommit.trade.factRevision);
    expect(view.lifecycle).toEqual({ stored: postCommit.trade.storedLifecycle, agreement: postCommit.derivation.agreement });
    expect(view.lifecycle).toEqual({ stored: 'Open', agreement: { kind: 'Agrees' } });
    expect(view.positionChanges).toEqual(postCommit.trade.positionChanges);
    expect(view.positions).toEqual(postCommit.derivation.positions);
    expect(view.fees).toEqual(postCommit.derivation.fees);
    expect(view.baseline).toEqual(postCommit.derivation.baseline);
    expect(view.entryResolution).toEqual(postCommit.derivation.entryResolution);
    expect(view.entryQuality).toEqual(postCommit.derivation.entryQuality);
    expect(view.legFulfillment).toEqual(postCommit.derivation.legFulfillment);
    expect(view.findings).toEqual(postCommit.derivation.findings);
    expect(view.deviations).toEqual(postCommit.trade.recordedDeviations ?? []);
    const narrativeEntry = view.journal.find((item) => item.id === entry.id);
    expect(narrativeEntry && [narrativeEntry.kind, narrativeEntry.anchor, narrativeEntry.momentTime, narrativeEntry.authoredTime]).toEqual([
      'Entry',
      entry.anchor,
      entry.momentTime,
      entry.authoredTime,
    ]);
    expect(narrativeEntry?.kind === 'Entry' && narrativeEntry.responses).toHaveLength(entry.responses.length);
  });
});
