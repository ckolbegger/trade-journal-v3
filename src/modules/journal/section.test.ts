import { describe, expect, it } from 'vitest';
import { recordSourceOf } from '../../../tests/support/record-source.ts';
import { sequentialIds } from '../../../tests/support/workspace.ts';
import { D2_JOURNAL_MANIFEST, D3_JOURNAL_MANIFEST, prepareJournalSeed, validateSection } from './index.ts';

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

// A stored Daily Trade Review Entry as applyPreparedEffects writes it: the obligation key is the
// array (D4 A38) and each edit appends a version under the same Entry identity.
function actionEntry(id: string, tradeId: string, reviewDate: string, definitionIds: readonly string[]) {
  return {
    id,
    entryTypeKey: 'entry-type.daily-trade-review',
    sourceKey: 'source.daily-review',
    anchor: { kind: 'Trade', tradeId },
    origin: { kind: 'DailyReview', factId: tradeId, reviewDate },
    momentTime: '2026-10-12T21:00:00Z',
    authoredTime: '2026-10-12T21:05:00Z',
    obligationKey: ['DailyTradeReview', reviewDate, tradeId],
    anchorTradeId: tradeId,
    versions: definitionIds.map((definitionId, i) => ({ versionNumber: i + 1, definitionId, responses: [], savedAt: `2026-10-12T21:0${i + 5}:00Z` })),
  };
}

function seededDailyReview() {
  const seed = prepareJournalSeed([], [], D3_JOURNAL_MANIFEST, sequentialIds('def'));
  if (seed.kind !== 'Additions') throw new Error('seed conflict');
  const definitionOf = (key: string) => seed.definitions.find((d) => d.entryTypeKey === key)!.id;
  return { types: seed.types, definitions: seed.definitions, dailyTradeReview: definitionOf('entry-type.daily-trade-review') };
}

describe('Journal section, Daily Trade Review', () => {
  it('should accept Action Entries with version chains under their obligation keys', async () => {
    const { types, definitions, dailyTradeReview } = seededDailyReview();
    const source = recordSourceOf({
      journalTypes: types,
      journalDefinitions: definitions,
      journalEntries: [
        actionEntry('e-1', 'trade-1', '2026-10-12', [dailyTradeReview]),
        actionEntry('e-2', 'trade-2', '2026-10-12', [dailyTradeReview, dailyTradeReview]),
        actionEntry('e-3', 'trade-1', '2026-10-13', [dailyTradeReview]),
      ],
    });

    const result = await validateSection(source);

    expect(result.issues).toEqual([]);
    expect(result.repairs).toEqual([]);
    expect([...result.references.anchorTradeIds].sort()).toEqual(['trade-1', 'trade-2']);
  });

  it('should report two Entries for one Trade and Review Date key and an Edit version whose definition snapshot differs from the first version', async () => {
    const { types, definitions, dailyTradeReview } = seededDailyReview();
    const otherRevision = definitions.find((d) => d.id !== dailyTradeReview)!.id;
    const source = recordSourceOf({
      journalTypes: types,
      journalDefinitions: definitions,
      journalEntries: [
        actionEntry('e-1', 'trade-1', '2026-10-12', [dailyTradeReview]),
        // A second Entry for the same (Trade, Review Date), in a later batch.
        actionEntry('e-2', 'trade-2', '2026-10-12', [dailyTradeReview]),
        actionEntry('e-3', 'trade-1', '2026-10-12', [dailyTradeReview]),
        // An Edit version that names another definition snapshot than the first version.
        actionEntry('e-4', 'trade-3', '2026-10-12', [dailyTradeReview, otherRevision]),
      ],
    });

    const result = await validateSection(source);

    expect(result.issues).toEqual([
      { code: 'DuplicateObligationOutcome', obligationKey: 'DailyTradeReview:2026-10-12:trade-1', ids: ['e-1', 'e-3'] },
      { code: 'EditDefinitionChanged', id: 'e-4', versionNumber: 2 },
    ]);
    expect(result.repairs).toEqual([]);
  });
});
