import { describe, expect, it } from 'vitest';
import { fixedClock } from '../../domain/time/index.ts';
import type { Persistence } from '../../persistence/index.ts';
import { recordSourceOf } from '../../../tests/support/record-source.ts';
import { emptyWorkspace, sequentialIds } from '../../../tests/support/workspace.ts';
import {
  createJournal,
  D1_JOURNAL_MANIFEST,
  D2_JOURNAL_MANIFEST,
  D3_JOURNAL_MANIFEST,
  D4_JOURNAL_MANIFEST,
  prepareJournalSeed,
  validateSection,
} from './index.ts';

// T5.5: the Journal section validator for Debt (D5 A61, A62, A64) and seed manifest v4 (P17).
function seeded() {
  const seed = prepareJournalSeed([], [], D2_JOURNAL_MANIFEST, sequentialIds('def'));
  if (seed.kind !== 'Additions') throw new Error('seed conflict');
  const definitionOf = (key: string) => seed.definitions.find((d) => d.entryTypeKey === key)!.id;
  return {
    types: seed.types,
    definitions: seed.definitions,
    planReflection: definitionOf('entry-type.plan-reflection'),
    positionChangeReflection: definitionOf('entry-type.position-change-reflection'),
  };
}

type Version = { readonly versionId: string; readonly status: 'Outstanding' | 'Settled' | 'Declined'; readonly entryId?: string; readonly declineId?: string; readonly savedAt: string };

// A stored Debt as Journal writes it, with its private fields.
function debt(debtId: string, pc: string, definitionId: string, versions: readonly Version[], tradeId = 'trade-1') {
  return {
    debtId,
    obligationKey: `PositionChangeReflection:${pc}`,
    entryTypeKey: 'entry-type.position-change-reflection',
    sourceKey: 'source.position-change',
    definitionId,
    anchor: { kind: 'Trade', tradeId },
    origin: { kind: 'PositionChange', factId: pc },
    momentTime: '2026-10-12T14:00:00Z',
    dueAnchor: '2026-10-12T14:00:00Z',
    dueRule: 'NextSessionClose',
    route: 'Review',
    anchorTradeId: tradeId,
    outstandingDue: '2026-10-12T14:00:00Z',
    versions,
  };
}

const outstanding = (versionId: string): Version => ({ versionId, status: 'Outstanding', savedAt: '2026-10-12T14:00:00Z' });
const settled = (versionId: string, entryId?: string): Version => ({ versionId, status: 'Settled', ...(entryId === undefined ? {} : { entryId }), savedAt: '2026-10-13T14:00:00Z' });
const declined = (versionId: string, declineId?: string): Version => ({ versionId, status: 'Declined', ...(declineId === undefined ? {} : { declineId }), savedAt: '2026-10-13T14:00:00Z' });

// A stored Position Change Reflection Entry; a settling Entry carries settledDebtId.
function entry(id: string, pc: string, definitionId: string, settledDebtId?: string, tradeId = 'trade-1') {
  return {
    id,
    entryTypeKey: 'entry-type.position-change-reflection',
    sourceKey: 'source.position-change',
    anchor: { kind: 'Trade', tradeId },
    origin: { kind: 'PositionChange', factId: pc },
    momentTime: '2026-10-12T14:00:00Z',
    authoredTime: '2026-10-13T14:00:00Z',
    obligationKey: `PositionChangeReflection:${pc}`,
    anchorTradeId: tradeId,
    ...(settledDebtId === undefined ? {} : { settledDebtId }),
    versions: [{ versionNumber: 1, definitionId, responses: [], savedAt: '2026-10-13T14:00:00Z' }],
  };
}

function decline(id: string, pc: string, definitionId: string, settledDebtId: string, tradeId = 'trade-1') {
  return {
    id,
    entryTypeKey: 'entry-type.position-change-reflection',
    sourceKey: 'source.position-change',
    anchor: { kind: 'Trade', tradeId },
    origin: { kind: 'PositionChange', factId: pc },
    definitionId,
    momentTime: '2026-10-12T14:00:00Z',
    authoredTime: '2026-10-13T14:00:00Z',
    obligationKey: `PositionChangeReflection:${pc}`,
    anchorTradeId: tradeId,
    settledDebtId,
  };
}

describe('Journal section, Debt', () => {
  it('should accept Outstanding, Settled, and Declined Debt whose settlement links agree in both directions', async () => {
    const { types, definitions, positionChangeReflection: def } = seeded();
    const source = recordSourceOf({
      journalTypes: types,
      journalDefinitions: definitions,
      journalDebts: [
        debt('debt-1', 'pc-1', def, [outstanding('v-1')], 'trade-3'),
        debt('debt-2', 'pc-2', def, [outstanding('v-2'), settled('v-3', 'e-1')]),
        debt('debt-3', 'pc-3', def, [outstanding('v-4'), declined('v-5', 'd-1')], 'trade-2'),
      ],
      journalEntries: [entry('e-1', 'pc-2', def, 'debt-2')],
      journalDeclines: [decline('d-1', 'pc-3', def, 'debt-3', 'trade-2')],
    });

    const result = await validateSection(source);

    expect(result.issues).toEqual([]);
    expect(result.repairs).toEqual([]);
    expect([...result.references.anchorTradeIds].sort()).toEqual(['trade-1', 'trade-2', 'trade-3']);
  });

  it('should report a Debt whose snapshot revision is absent, a Settled version without an Entry or a version after Settled, an Entry whose definition revision differs from the Debt it settled, a link that does not point back, and two current outcomes for one obligation key', async () => {
    const { types, definitions, planReflection, positionChangeReflection: def } = seeded();
    const source = recordSourceOf({
      journalTypes: types,
      journalDefinitions: definitions,
      journalDebts: [
        debt('debt-a', 'pc-1', 'def-missing', [outstanding('v-a')]),
        debt('debt-b', 'pc-2', def, [outstanding('v-b1'), settled('v-b2')]),
        debt('debt-c', 'pc-3', def, [outstanding('v-c1'), settled('v-c2', 'e-c'), outstanding('v-c3')]),
        debt('debt-d', 'pc-4', def, [outstanding('v-d1'), settled('v-d2', 'e-d')]),
        debt('debt-e', 'pc-5', def, [outstanding('v-e1'), settled('v-e2', 'e-e')]),
        debt('debt-f', 'pc-6', def, [outstanding('v-f1'), declined('v-f2'), settled('v-f3', 'e-c')]),
        debt('debt-g', 'pc-7', def, [outstanding('v-g1')]),
        debt('debt-h', 'pc-8', def, [outstanding('v-h1')]),
        debt('debt-i', 'pc-8', def, [outstanding('v-i1')]),
      ],
      journalEntries: [
        entry('e-c', 'pc-3', def, 'debt-c'),
        entry('e-d', 'pc-4', planReflection, 'debt-d'),
        // Debt e names this Entry, but the Entry does not name the Debt.
        entry('e-e', 'pc-5', def),
        // The Entry names Debt g, which never names it back; Debt g is also still Outstanding.
        entry('e-g', 'pc-7', def, 'debt-g'),
      ],
    });

    const result = await validateSection(source);

    expect(result.issues).toEqual([
      { code: 'MissingDefinitionRevision', id: 'debt-a', definitionId: 'def-missing' },
      { code: 'DebtResolutionMissing', debtId: 'debt-b', versionId: 'v-b2', status: 'Settled' },
      { code: 'DebtVersionAfterResolution', debtId: 'debt-c', versionId: 'v-c3' },
      { code: 'DebtEntryDefinitionChanged', debtId: 'debt-d', entryId: 'e-d' },
      { code: 'DebtLinkNotReciprocated', debtId: 'debt-e', id: 'e-e' },
      { code: 'DebtResolutionMissing', debtId: 'debt-f', versionId: 'v-f2', status: 'Declined' },
      { code: 'DebtVersionAfterResolution', debtId: 'debt-f', versionId: 'v-f3' },
      { code: 'DebtLinkNotReciprocated', debtId: 'debt-f', id: 'e-c' },
      { code: 'DuplicateObligationOutcome', obligationKey: 'PositionChangeReflection:pc-7', ids: ['e-g', 'debt-g'] },
      { code: 'DuplicateObligationOutcome', obligationKey: 'PositionChangeReflection:pc-8', ids: ['debt-h', 'debt-i'] },
      { code: 'DebtLinkNotReciprocated', debtId: 'debt-g', id: 'e-g' },
    ]);
    expect(result.repairs).toEqual([]);
  });
});

async function stored(persistence: Persistence) {
  const { value } = await persistence.readSnapshot(['journalTypes', 'journalDefinitions', 'journalEntries', 'meta'], async (tx) => ({
    types: await tx.getAll('journalTypes'),
    definitions: await tx.getAll('journalDefinitions'),
    entries: await tx.getAll('journalEntries'),
    meta: await tx.get('meta', 'journal'),
  }));
  return value;
}

describe('Journal section, Debt anchor', () => {
  it('should report MissingAnchor for a Debt whose anchor or anchor Trade is absent, and add nothing undefined to the Trade references', async () => {
    const { types, definitions, positionChangeReflection: def } = seeded();
    const noAnchor: Record<string, unknown> = debt('debt-1', 'pc-1', def, [outstanding('v-1')]);
    delete noAnchor['anchor'];
    const noTrade = { ...debt('debt-2', 'pc-2', def, [outstanding('v-2')]), anchor: { kind: 'Trade' } };
    const source = recordSourceOf({ journalTypes: types, journalDefinitions: definitions, journalDebts: [noAnchor, noTrade] });

    const result = await validateSection(source);

    expect(result.issues).toEqual([
      { code: 'MissingAnchor', id: 'debt-1' },
      { code: 'MissingAnchor', id: 'debt-2' },
    ]);
    expect([...result.references.anchorTradeIds]).toEqual([]);
  });
});

describe('Journal section, Debt obligation', () => {
  it('should report a settling Entry or decline whose obligation key differs from the Debt it settled', async () => {
    const { types, definitions, positionChangeReflection: def } = seeded();
    const source = recordSourceOf({
      journalTypes: types,
      journalDefinitions: definitions,
      journalDebts: [
        debt('debt-1', 'pc-1', def, [outstanding('v-1'), settled('v-2', 'e-1')]),
        debt('debt-2', 'pc-3', def, [outstanding('v-3'), declined('v-4', 'd-1')]),
      ],
      journalEntries: [entry('e-1', 'pc-2', def, 'debt-1')],
      journalDeclines: [decline('d-1', 'pc-4', def, 'debt-2')],
    });

    const result = await validateSection(source);

    expect(result.issues).toEqual([
      { code: 'DebtObligationMismatch', debtId: 'debt-1', id: 'e-1' },
      { code: 'DebtObligationMismatch', debtId: 'debt-2', id: 'd-1' },
    ]);
  });
});

describe('Journal section, Debt reverse links', () => {
  it('should report the missing reverse link of a decline when an Entry with the same identity names the same Debt', async () => {
    const { types, definitions, positionChangeReflection: def } = seeded();
    const source = recordSourceOf({
      journalTypes: types,
      journalDefinitions: definitions,
      journalDebts: [debt('debt-1', 'pc-1', def, [outstanding('v-1'), settled('v-2', 'shared-id')])],
      journalEntries: [entry('shared-id', 'pc-1', def, 'debt-1')],
      journalDeclines: [decline('shared-id', 'pc-2', def, 'debt-1')],
    });

    const result = await validateSection(source);

    expect(result.issues).toEqual([{ code: 'DebtLinkNotReciprocated', debtId: 'debt-1', id: 'shared-id' }]);
  });
});

describe('seedDefaults: manifest v4 (P17)', () => {
  it('should add the Trade Detail Source, and nothing else, to a v3-seeded Journal, and add nothing when run again', async () => {
    const { persistence } = await emptyWorkspace();
    const j = createJournal({ persistence, ids: sequentialIds('j'), clock: fixedClock('2026-10-13T14:00:00Z') });
    for (const manifest of [D1_JOURNAL_MANIFEST, D2_JOURNAL_MANIFEST, D3_JOURNAL_MANIFEST]) await j.seedDefaults(manifest);
    const before = await stored(persistence);

    const result = await j.seedDefaults(D4_JOURNAL_MANIFEST);

    expect(D4_JOURNAL_MANIFEST.version).toBe(4);
    const revision = (before.meta!['journalRevision'] as number) + 1;
    expect(result).toEqual({ kind: 'Seeded', additions: ['source.trade-detail'], snapshot: { journalRevision: revision } });
    const after = await stored(persistence);
    expect(after.types).toEqual(
      expect.arrayContaining([...before.types, { id: 'source.trade-detail', kind: 'Source', productKey: 'source.trade-detail', label: 'Trade Detail', revision: revision + 1 }]),
    );
    expect(after.types).toHaveLength(before.types.length + 1);
    expect(after.definitions).toEqual(before.definitions);
    expect(after.entries).toEqual([]);

    expect(await j.seedDefaults(D4_JOURNAL_MANIFEST)).toEqual({ kind: 'Seeded', additions: [], snapshot: { journalRevision: revision } });
    expect(await stored(persistence)).toEqual(after);
  });
});
