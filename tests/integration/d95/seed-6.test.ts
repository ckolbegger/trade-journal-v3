// I95.8 The Journal seed manifest 6 reaches a Workspace (AC-JOUR-007): the workspace-v7 fixture, seeded at version 5, on its first start; a new Workspace;
// a second start. Expected forms are written out from the Journal contract, "Initial Entry Definitions", not read from the manifest.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { dumpAll, emptyDevice, launch, restart, w7Device } from '../d8/support.ts';
import { CONTRACT, definitionsOf, latestForm, REFLECTION, REVISED, shapeOf } from './seed-support.ts';

async function opened(app: Application) {
  const result = await app.Workspace.initialize({ timeZone: 'America/New_York' });
  if (result.kind !== 'Opened') throw new Error(`initialize: ${result.kind}`);
  return result;
}

// A valid answer to any prompt of a form.
function answerFor(p: Awaited<ReturnType<typeof latestForm>>['prompts'][number]) {
  if (p.kind === 'Text') return { kind: 'Text' as const, text: 'Answered.' };
  if (p.kind === 'SingleSelect') return { kind: 'Option' as const, optionId: p.options[0]!.id };
  return { kind: 'Scale' as const, value: p.kind === 'Scale' ? p.min : 1 };
}

describe('I95.8 Journal seed 6 (AC-JOUR-007)', () => {
  it('should give the workspace-v7 fixture exactly three revisions on its first start and name them in the receipt', { timeout: 120_000 }, async () => {
    const d = await w7Device();
    const before = definitionsOf(await dumpAll(d.factory));

    const start = await opened(await launch(d));

    const after = definitionsOf(await dumpAll(d.factory));
    const stored = new Set(before.map((definition) => definition.id));
    const added = after.filter((definition) => !stored.has(definition.id));
    // Catches a start that revises another type, revises one twice or leaves one out; each is one revision past its latest.
    expect(added.map((definition) => definition.entryTypeKey).sort()).toEqual(REVISED);
    for (const definition of added) {
      expect(definition.revisionNumber).toBe(Math.max(...before.filter((b) => b.entryTypeKey === definition.entryTypeKey).map((b) => b.revisionNumber)) + 1);
    }
    expect(start.receipt.seeds.journal.manifestVersion).toBe(6);
    expect([...start.receipt.seeds.journal.additions].sort()).toEqual(REVISED);
  });

  it('should hold each revised form equal to the Journal contract after the fixture start', { timeout: 120_000 }, async () => {
    const app = await launch(await w7Device());
    await opened(app);

    for (const key of REVISED) {
      // Catches a prompt, option, requiredness, role, bound or protected mark that differs from the contract.
      expect(shapeOf((await latestForm(app, key)).prompts)).toEqual(CONTRACT[key]);
    }
  });

  it('should keep an owed reflection on the form it was owed under and let it be answered with that form', { timeout: 120_000 }, async () => {
    const d = await w7Device();
    const app = await launch(d);
    const owedBefore = (await app.Journal.query({ scope: 'OutstandingDebt' }));
    if (!('debts' in owedBefore)) throw new Error('no debts page');
    const debt = owedBefore.debts.find((x) => x.entryTypeKey === REFLECTION);
    if (!debt) throw new Error('workspace-v7 owes no Position Change Reflection');
    await opened(app);

    const owed = (await app.Journal.query({ scope: 'OutstandingDebt' }));
    if (!('debts' in owed)) throw new Error('no debts page');
    const now = owed.debts.find((x) => x.debtId === debt.debtId);
    // Catches a seed that re-pins an owed reflection to the new form: it keeps the revision it was owed under and requires nothing more.
    expect(now?.definitionId).toBe(debt.definitionId);
    expect(now).not.toHaveProperty('requires');
    const latest = await latestForm(app, REFLECTION);
    expect(latest.id).not.toBe(debt.definitionId);

    const found = await app.Journal.getDefinitions({ revision: debt.definitionId });
    if (found.kind !== 'Found') throw new Error('owed form is gone');
    const answers = Object.fromEntries(found.definition.prompts.filter((p) => p.required).map((p) => [p.id, answerFor(p)]));
    const answered = await app.Journal.save({ intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: now!.revision, resolution: { kind: 'Answer', form: { definitionId: debt.definitionId, answers } } });
    expect(answered.kind).toBe('Saved');
  });

  it('should seed a new Workspace at version 6 with each form equal to the Journal contract', { timeout: 120_000 }, async () => {
    const d = await emptyDevice();
    const app = await launch(d);

    const start = await opened(app);

    expect(start.receipt.seeds.journal.manifestVersion).toBe(6);
    const definitions = definitionsOf(await dumpAll(d.factory));
    for (const key of REVISED) {
      // Catches a new Workspace seeded with an earlier form, or with two revisions where one is the first.
      expect(definitions.filter((definition) => definition.entryTypeKey === key).map((definition) => definition.revisionNumber)).toEqual([1]);
      expect(shapeOf((await latestForm(app, key)).prompts)).toEqual(CONTRACT[key]);
    }
  });

  it('should add nothing on a second start of the same Workspace', { timeout: 120_000 }, async () => {
    const d = await w7Device();
    const first = await launch(d);
    await opened(first);
    const once = await dumpAll(d.factory);

    const second = await opened(await restart(first, d));

    // Catches a seed that is not idempotent: no definition, revision or other record is added or rewritten.
    expect(second.receipt.seeds.journal).toEqual({ manifestVersion: 6, additions: [] });
    expect(definitionsOf(await dumpAll(d.factory))).toEqual(definitionsOf(once));
  });
});
