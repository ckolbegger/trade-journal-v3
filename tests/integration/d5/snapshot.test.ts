// I5.9: a Debt is answered against the definition revision it was deferred under, after a later revision
// exists (AC-JOUR-004, partial). Revision 2 comes from the definition-revision fixture writer (A74), which
// appends it to the raw store while no application is open; everything else is production code.
import { describe, expect, it } from 'vitest';
import { appendPositionChangeReflectionRevision2, REVISION_2_ADDED_PROMPT, REVISION_2_ID } from '../../support/definition-revision.ts';
import { confirmReference, detail, device, dumpAll, journalStores, MONDAY_1700, onboarded, outstandingDebts, PC1, PC2, recordDeferred, restart } from './support.ts';

const MODE = 'prompt.position-change-reflection.decision-mode';
const REACTIVE = 'option.position-change-reflection.decision-mode.reactive';
const ANSWERS = {
  [MODE]: { kind: 'Option', optionId: REACTIVE },
  'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
  'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
} as const;

describe('I5.9 Snapshot answered after a later definition', () => {
  it('should validate a revision-1 answer against revision 1, store revision 1 and render its labels, and reject a revision-2 form with DefinitionRevisionMismatch writing nothing', async () => {
    const d = await device(undefined, MONDAY_1700);
    let app = await onboarded(d);
    const tradeId = await confirmReference(app);
    await recordDeferred(app, tradeId, PC1);
    await recordDeferred(app, tradeId, PC2);
    const [first, second] = await outstandingDebts(app);
    const revision1 = first!.definitionId;
    expect(second!.definitionId).toBe(revision1);

    // Revision 2 exists from now on: one option relabelled and one Prompt added.
    app.persistence.close();
    expect(await appendPositionChangeReflectionRevision2(d.factory)).toBe(REVISION_2_ID);
    app = await restart(app, d);
    const latest = await app.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
    expect(latest.kind === 'Found' && latest.definition.id).toBe(REVISION_2_ID);

    // A revision-2 form for a Debt deferred under revision 1 is refused and writes nothing.
    const before = await dumpAll(d.factory);
    const mismatch = await app.Journal.save({
      intention: 'ResolveDebt',
      debtId: second!.debtId,
      expectedDebtRevision: second!.revision,
      resolution: { kind: 'Answer', form: { definitionId: REVISION_2_ID, answers: { ...ANSWERS, [REVISION_2_ADDED_PROMPT]: { kind: 'Text', text: 'Wait for the close.' } } } },
    });
    expect(mismatch).toEqual({ kind: 'Rejected', issues: [expect.objectContaining({ code: 'DefinitionRevisionMismatch' })] });
    expect(await dumpAll(d.factory)).toEqual(before);

    // A revision-1 form, without revision 2's Prompt, is valid for the first Debt.
    const saved = await app.Journal.save({
      intention: 'ResolveDebt',
      debtId: first!.debtId,
      expectedDebtRevision: first!.revision,
      resolution: { kind: 'Answer', form: { definitionId: revision1, answers: ANSWERS } },
    });
    if (saved.kind !== 'Saved') throw new Error(`Journal.save: ${JSON.stringify(saved)}`);
    expect(saved.entry!.definitionId).toBe(revision1);

    const stores = journalStores(await dumpAll(d.factory));
    expect(stores.entries.find((e) => e.settledDebtId === first!.debtId)!.versions.map((v) => v.definitionId)).toEqual([revision1]);
    expect(stores.debts.find((x) => x.debtId === second!.debtId)!.versions.map((v) => v.status)).toEqual(['Outstanding']);

    // The Entry renders revision 1's label for the option, not revision 2's relabelling.
    app = await restart(app, d);
    const view = await detail(app, tradeId);
    const entry = view.journal.find((item) => item.kind === 'Entry' && item.id === saved.entry!.id);
    if (entry?.kind !== 'Entry') throw new Error('the answered Entry is not on Trade Detail');
    expect(entry.responses.find((r) => r.prompt === 'Decision mode')!.answer).toEqual({ kind: 'Option', label: 'Reactive' });
    expect(entry.responses.map((r) => r.prompt)).not.toContain('Lesson');
  }, 60_000);
});
