import { describe, expect, it } from 'vitest';
import { recordSourceOf } from '../../../tests/support/record-source.ts';
import { sequentialIds } from '../../../tests/support/workspace.ts';
import { D2_JOURNAL_MANIFEST, prepareJournalSeed, validateSection } from './index.ts';

// The seeded Journal types and definitions as seedDefaults leaves them.
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

// A stored Entry as applyPreparedEffects writes it.
function entry(id: string, tradeId: string, obligationKey: string, definitionId: string, origin: { kind: 'Plan' | 'PositionChange'; factId: string }) {
  const plan = origin.kind === 'Plan';
  return {
    id,
    entryTypeKey: plan ? 'entry-type.plan-reflection' : 'entry-type.position-change-reflection',
    sourceKey: plan ? 'source.plan-confirmation' : 'source.position-change',
    anchor: { kind: 'Trade', tradeId },
    origin,
    momentTime: '2026-10-12T14:00:00Z',
    authoredTime: '2026-10-12T14:01:00Z',
    obligationKey,
    anchorTradeId: tradeId,
    versions: [{ versionNumber: 1, definitionId, responses: [], savedAt: '2026-10-12T14:01:00Z' }],
  };
}

// A stored decline as applyPreparedEffects writes it (D2 A29).
function decline(id: string, tradeId: string, positionChangeId: string, definitionId: string) {
  return {
    id,
    entryTypeKey: 'entry-type.position-change-reflection',
    sourceKey: 'source.position-change',
    anchor: { kind: 'Trade', tradeId },
    origin: { kind: 'PositionChange', factId: positionChangeId },
    definitionId,
    reason: 'Routine add.',
    momentTime: '2026-10-12T15:00:00Z',
    authoredTime: '2026-10-12T15:01:00Z',
    obligationKey: `PositionChangeReflection:${positionChangeId}`,
    anchorTradeId: tradeId,
  };
}

function withoutAnchor(record: { anchor: unknown }): object {
  const copy: Partial<typeof record> = { ...record };
  delete copy.anchor;
  return copy;
}

describe('Journal section', () => {
  it('should accept seeded definitions, Plan and Position Change Reflection Entries, and declines', async () => {
    const { types, definitions, planReflection, positionChangeReflection } = seeded();
    const source = recordSourceOf({
      journalTypes: types,
      journalDefinitions: definitions,
      journalEntries: [
        entry('e-1', 'trade-1', 'PlanReflection:trade-1', planReflection, { kind: 'Plan', factId: 'trade-1:plan' }),
        entry('e-2', 'trade-2', 'PlanReflection:trade-2', planReflection, { kind: 'Plan', factId: 'trade-2:plan' }),
        entry('e-3', 'trade-1', 'PositionChangeReflection:pc-1', positionChangeReflection, { kind: 'PositionChange', factId: 'pc-1' }),
      ],
      journalDeclines: [decline('d-1', 'trade-1', 'pc-2', positionChangeReflection)],
    });

    const result = await validateSection(source);

    expect(result.issues).toEqual([]);
    expect(result.repairs).toEqual([]);
    // Workspace closes these Anchors against the Trade section.
    expect([...result.references.anchorTradeIds].sort()).toEqual(['trade-1', 'trade-2']);
  });

  it('should report an Entry whose definition revision is absent, an obligation with two outcomes, and an Entry or decline with no Anchor', async () => {
    const { types, definitions, planReflection, positionChangeReflection } = seeded();
    const unanchoredEntry = withoutAnchor(entry('e-4', 'trade-2', 'PositionChangeReflection:pc-3', positionChangeReflection, { kind: 'PositionChange', factId: 'pc-3' }));
    const unanchoredDecline = withoutAnchor(decline('d-2', 'trade-2', 'pc-4', positionChangeReflection));
    const source = recordSourceOf({
      journalTypes: types,
      journalDefinitions: definitions,
      journalEntries: [
        entry('e-1', 'trade-1', 'PlanReflection:trade-1', planReflection, { kind: 'Plan', factId: 'trade-1:plan' }),
        entry('e-2', 'trade-2', 'PlanReflection:trade-2', 'def-missing', { kind: 'Plan', factId: 'trade-2:plan' }),
        entry('e-3', 'trade-1', 'PositionChangeReflection:pc-1', positionChangeReflection, { kind: 'PositionChange', factId: 'pc-1' }),
        unanchoredEntry,
      ],
      // A decline for the obligation e-3 already completed, in another store and batch.
      journalDeclines: [decline('d-1', 'trade-1', 'pc-1', positionChangeReflection), unanchoredDecline],
    });

    const result = await validateSection(source);

    expect(result.issues).toEqual([
      { code: 'MissingDefinitionRevision', id: 'e-2', definitionId: 'def-missing' },
      { code: 'MissingAnchor', id: 'e-4' },
      { code: 'DuplicateObligationOutcome', obligationKey: 'PositionChangeReflection:pc-1', ids: ['e-3', 'd-1'] },
      { code: 'MissingAnchor', id: 'd-2' },
    ]);
    expect(result.repairs).toEqual([]);
  });
});
