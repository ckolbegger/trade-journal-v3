// I2.5: opening a position with PC1 of the reference Trade (AC-POS-001, AC-LIFE-001). The AC-RESP-001 checks are in responses.test.ts.
import { describe, expect, it } from 'vitest';
import { complete, device, dumpAll, onboarded, PC1, confirmReference, readIndex, record, restart, workspaceStores } from './support.ts';

type StoredTrade = { tradeId: string; lifecycle: string; facts: { factId: string; kind: string; versions: unknown[] }[] };

describe('I2.5 open a position', () => {
  it('should return the Trade, derivation, and Entry equal to the Detail read after restart, with the facts, Open index entry, Entry, and obligation durable, and the Trade absent from Planned', async () => {
    const d = await device();
    const app = await onboarded(d);
    const tradeId = await confirmReference(app);
    const result = await record(app, tradeId, PC1, await complete(app));
    const { receipt, postCommit } = result;
    if (postCommit.reflection.kind !== 'Entry') throw new Error('expected an Entry');
    const entry = postCommit.reflection.entry;

    const again = await restart(app, d);
    expect(receipt.lifecycleTransitions).toEqual([{ tradeId, from: 'Planned', to: 'Open' }]);

    const open = await again.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
    expect(open.kind === 'Ready' && open.view.items.map((i) => i.tradeId)).toEqual([tradeId]);
    const planned = await again.TradeViewsAndReporting.browseTrades({ lifecycle: 'Planned' });
    expect(planned.kind === 'Ready' && planned.view.items).toEqual([]);

    const dump = await dumpAll(d.factory);
    const stores = workspaceStores(dump);
    const trades = stores['trades'] as StoredTrade[];
    expect(trades).toHaveLength(1);
    const facts = trades[0]!.facts.filter((f) => f.kind === 'PositionChange' || f.kind === 'Execution');
    expect(facts.map((f) => f.kind).sort()).toEqual(['Execution', 'PositionChange']);
    expect(facts.map((f) => f.factId).sort()).toEqual([...receipt.createdFactIds].sort());
    expect(facts.every((f) => f.versions.length === 1)).toBe(true);
    const databaseName = Object.keys(dump).find((n) => n.startsWith('tj-ws-'))!;
    const index = (await readIndex(d.factory, databaseName, 'trades', 'byLifecycleActivity')) as StoredTrade[];
    expect(index.map((t) => [t.tradeId, t.lifecycle])).toEqual([[tradeId, 'Open']]);
    // The Plan Reflection has its own Entry and obligation; PC1 adds exactly one of each.
    const entries = stores['journalEntries'] as { id: string; obligationKey: string }[];
    expect(entries.filter((e) => e.obligationKey.startsWith('PositionChangeReflection:')).map((e) => e.id)).toEqual([entry.id]);
    const obligations = stores['journalObligations'] as { obligationKey: string; outcome: { kind: string; id: string } }[];
    expect(obligations.filter((o) => o.obligationKey.startsWith('PositionChangeReflection:'))).toEqual([
      expect.objectContaining({
        obligationKey: `PositionChangeReflection:${postCommit.trade.positionChanges[0]!.factId}`,
        outcome: { kind: 'Entry', id: entry.id },
      }),
    ]);
  });
});
