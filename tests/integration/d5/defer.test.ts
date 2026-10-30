// I5.3 and I5.4: Defer at capture and Debt never blocking later facts (AC-JOUR-003, AC-RESP-001).
import { describe, expect, it } from 'vitest';
import { complete, confirmReference, dec, detail, device, dumpAll, onboarded, PC1, PC1_TIME, PC2, PC3, PC3_TIME, recordDeferred, record, restart, workspaceStores } from './support.ts';
import { MONDAY_1005, outstandingDebts, TUESDAY_1700 } from './support.ts';

interface StoredDebt {
  debtId: string;
  obligationKey: string;
  definitionId: string;
  anchor: { kind: string; tradeId: string };
  origin: { kind: string; factId: string };
  momentTime: string;
  dueAnchor: string;
  versions: { versionId: string; status: string }[];
}

describe('I5.3 Defer at capture', () => {
  it('should commit PC1 with one Outstanding Debt equal to the result, show Reflection owed on Trade Detail after restart, and store no Entry or decline for the key while the Trade is Open', async () => {
    const d = await device(undefined, MONDAY_1005);
    const app = await onboarded(d);
    const tradeId = await confirmReference(app);

    const recorded = await recordDeferred(app, tradeId, PC1);
    expect(recorded.postCommit.reflection.kind).toBe('Debt');
    const reflection = recorded.postCommit.reflection;
    if (reflection.kind !== 'Debt') throw new Error('expected a Debt outcome');

    const again = await restart(app, d);
    const view = await detail(again, tradeId);
    const owed = view.journal.filter((item) => item.kind === 'Debt');
    expect(owed).toEqual([expect.objectContaining({ id: reflection.debt.debtId, momentTime: PC1_TIME, dueAnchor: PC1_TIME, anchor: { kind: 'Trade', tradeId } })]);
    expect(view.lifecycle.stored).toBe('Open');

    const queried = (await outstandingDebts(again)).find((debt) => debt.obligationKey === reflection.debt.obligationKey);
    expect(queried).toBeDefined();

    // AC-RESP-001: the result's Debt projection, the query and the stored Debt agree.
    const dump = await dumpAll(d.factory);
    const stores = workspaceStores(dump);
    const debts = stores['journalDebts'] as StoredDebt[];
    expect(debts).toHaveLength(1);
    const stored = debts[0]!;
    expect(queried).toEqual(reflection.debt);
    expect(reflection.debt).toEqual(
      expect.objectContaining({ debtId: stored.debtId, obligationKey: stored.obligationKey, definitionId: stored.definitionId, momentTime: stored.momentTime, dueAnchor: stored.dueAnchor, status: 'Outstanding', revision: stored.versions.at(-1)!.versionId }),
    );
    expect(stored.versions.map((v) => v.status)).toEqual(['Outstanding']);
    expect(stored.definitionId).toBe((await again.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' }).then((r) => (r.kind === 'Found' ? r.definition.id : ''))));
    expect(stored.anchor).toEqual({ kind: 'Trade', tradeId });
    expect(stored.origin.kind).toBe('PositionChange');
    expect(stored.dueAnchor).toBe(PC1_TIME);

    const obligations = (stores['journalObligations'] as { obligationKey: string; outcome: { kind: string; id?: string } }[]).filter((o) => o.obligationKey === stored.obligationKey);
    expect(obligations).toEqual([expect.objectContaining({ outcome: { kind: 'Debt', id: stored.debtId } })]);
    // No Entry and no decline for that key.
    const entries = stores['journalEntries'] as { obligationKey: unknown }[];
    expect(entries.filter((e) => JSON.stringify(e).includes(stored.origin.factId))).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(stores['journalDeclines']).toEqual([]);
    expect((stores['trades'] as { lifecycle: string }[]).map((t) => t.lifecycle)).toEqual(['Open']);
  }, 60_000);
});

describe('I5.4 Debt never blocks facts', () => {
  it('should commit PC2 with Complete and PC3 with Defer while PC1 is due, leaving two Outstanding Debts and one Entry for PC2, three obligation records, and Position 120', async () => {
    const d = await device(undefined, MONDAY_1005);
    const app = await onboarded(d);
    const tradeId = await confirmReference(app);
    await recordDeferred(app, tradeId, PC1);

    // Tuesday 17:00: PC1 is due (D-1).
    const tuesday = await restart(app, { ...d, now: TUESDAY_1700 });
    await record(tuesday, tradeId, PC2, await complete(tuesday));
    await recordDeferred(tuesday, tradeId, PC3);

    const again = await restart(tuesday, { ...d, now: TUESDAY_1700 });
    const debts = await outstandingDebts(again);
    expect(debts.map((debt) => debt.momentTime)).toEqual([PC1_TIME, PC3_TIME]);
    expect(debts.every((debt) => debt.status === 'Outstanding')).toBe(true);

    const stores = workspaceStores(await dumpAll(d.factory));
    expect((stores['journalDebts'] as StoredDebt[]).map((debt) => debt.momentTime).sort()).toEqual([PC1_TIME, PC3_TIME]);
    // The Plan Reflection and PC2's Entry; PC1 and PC3 hold no Entry.
    expect((stores['journalEntries'] as { entryTypeKey: string }[]).map((e) => e.entryTypeKey).sort()).toEqual(['entry-type.plan-reflection', 'entry-type.position-change-reflection']);
    const obligations = stores['journalObligations'] as { obligationKey: string; outcome: { kind: string } }[];
    const pcOutcomes = obligations.filter((o) => o.obligationKey.startsWith('PositionChangeReflection:')).map((o) => o.outcome.kind).sort();
    expect(pcOutcomes).toEqual(['Debt', 'Debt', 'Entry']);
    expect(obligations).toHaveLength(4);

    const view = await detail(again, tradeId);
    expect(view.positions.map((p) => p.quantity)).toEqual([dec('120')]);
  }, 60_000);
});
