import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  buildPlanReflectionDefinitionV1,
  buildPositionChangeReflectionDefinitionV1,
  createJournal,
  PLAN_REFLECTION_TYPE_ID,
  POSITION_CHANGE_REFLECTION_TYPE_ID,
  validatePlanReflectionInput,
  validatePositionChangeReflectionInput,
} from '../../src/journal/journal';
import { createPersistenceSeam, CURRENT_SCHEMA_VERSION } from '../../src/persistence/idb';

describe('Journal validation, seeding, and query seam', () => {
  it('validates PlanReflectionInput boundaries and trims valid inputs', () => {
    const def = buildPlanReflectionDefinitionV1('2026-11-23T14:00:00.000Z');

    // Empty / whitespace thesis or invalidation rejected
    const emptyText = validatePlanReflectionInput(def, {
      definitionId: def.id,
      definitionRevision: def.revision,
      thesis: '   ',
      invalidation: '\t',
    });
    expect(emptyText.ok).toBe(false);
    if (!emptyText.ok) {
      expect(emptyText.errors.map((e) => e.field)).toContain('thesis');
      expect(emptyText.errors.map((e) => e.field)).toContain('invalidation');
    }

    // Stale / missing definition rejected
    const staleDef = validatePlanReflectionInput(
      { ...def, revision: def.revision + 1 },
      {
        definitionId: def.id,
        definitionRevision: def.revision,
        thesis: 'Breakout',
        invalidation: 'Below 100',
      },
    );
    expect(staleDef.ok).toBe(false);
    if (!staleDef.ok) {
      expect(staleDef.errors.map((e) => e.field)).toContain('definition');
    }

    // Out-of-range or non-integer conviction, invalid emotion rejected
    for (const conviction of [0, 6, 2.5]) {
      const badConv = validatePlanReflectionInput(def, {
        definitionId: def.id,
        definitionRevision: def.revision,
        thesis: 'Breakout',
        invalidation: 'Below 100',
        conviction,
        primaryEmotion: 'NotAnEmotion' as never,
      });
      expect(badConv.ok).toBe(false);
      if (!badConv.ok) {
        expect(badConv.errors.map((e) => e.field)).toContain('conviction');
        expect(badConv.errors.map((e) => e.field)).toContain('primaryEmotion');
      }
    }

    const valid = validatePlanReflectionInput(def, {
      definitionId: def.id,
      definitionRevision: def.revision,
      thesis: '  Weekly breakout  ',
      invalidation: '  Lose 50-day MA  ',
      conviction: 4,
      primaryEmotion: 'Calm',
    });
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.thesis).toBe('Weekly breakout');
      expect(valid.invalidation).toBe('Lose 50-day MA');
    }
  });

  it('validates PositionChangeReflectionInput boundaries and trims optional note', () => {
    const def = buildPositionChangeReflectionDefinitionV1('2026-11-23T14:00:00.000Z');

    const missingDef = validatePositionChangeReflectionInput(undefined, {
      definitionId: def.id,
      definitionRevision: def.revision,
      decisionMode: 'As Planned',
      primaryEmotion: 'Calm',
      decisionConfidence: 3,
    });
    expect(missingDef.ok).toBe(false);
    if (!missingDef.ok) {
      expect(missingDef.errors.map((e) => e.field)).toContain('definition');
    }

    for (const confidence of [0, 6, 1.5]) {
      const invalid = validatePositionChangeReflectionInput(def, {
        definitionId: def.id,
        definitionRevision: def.revision,
        decisionMode: 'BadMode' as never,
        primaryEmotion: 'BadEmotion' as never,
        decisionConfidence: confidence,
      });
      expect(invalid.ok).toBe(false);
      if (!invalid.ok) {
        expect(invalid.errors.map((e) => e.field)).toEqual(
          expect.arrayContaining(['decisionMode', 'primaryEmotion', 'decisionConfidence']),
        );
      }
    }

    const blankNote = validatePositionChangeReflectionInput(def, {
      definitionId: def.id,
      definitionRevision: def.revision,
      decisionMode: 'As Planned',
      primaryEmotion: 'Calm',
      decisionConfidence: 5,
      note: '   ',
    });
    expect(blankNote).toEqual({ ok: true, note: undefined });

    const trimmedNote = validatePositionChangeReflectionInput(def, {
      definitionId: def.id,
      definitionRevision: def.revision,
      decisionMode: 'Deliberate Adjustment',
      primaryEmotion: 'Eager',
      decisionConfidence: 4,
      note: '  Scaled at VWAP  ',
    });
    expect(trimmedNote).toEqual({ ok: true, note: 'Scaled at VWAP' });
  });

  it('seeds defaults idempotently, respects write gate, and queries by tradeId/entryTypeId sorted newest-first', async () => {
    let writable = true;
    const persistence = createPersistenceSeam({
      indexedDB: new IDBFactory(),
      writeGate: {
        checkWritable: () =>
          writable
            ? { writable: true }
            : { writable: false, reason: 'RecoveryOnly', failedChecks: ['storage_diagnostic'] },
      },
    });
    const journal = createJournal({
      persistence,
      clock: {
        now: () => new Date('2026-11-23T14:00:00.000Z'),
        nowIso: () => '2026-11-23T14:00:00.000Z',
      },
    });

    // Initialize workspace_meta so bootstrap pointer exists before reads
    await persistence.runWriteTransaction(['workspace_meta'], async (tx) => {
      tx.put('workspace_meta', {
        key: 'singleton',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        timeZone: 'America/New_York',
        settingsRevision: 1,
        workspaceRevision: 1,
        initializedAt: '2026-11-23T14:00:00.000Z',
        updatedAt: '2026-11-23T14:00:00.000Z',
      });
    });

    // Gate denies seedDefaults and writes nothing
    writable = false;
    const blocked = await journal.seedDefaults();
    expect(blocked.status).toBe('RuntimeNotWritable');
    expect((await journal.getDefinitions()).definitions).toEqual([]);

    // First seed populates definitions, second seed is idempotent
    writable = true;
    const seed1 = await journal.seedDefaults();
    expect(seed1.status).toBe('Seeded');
    if (seed1.status === 'Seeded') {
      expect(seed1.additions.length).toBeGreaterThan(0);
    }
    const seed2 = await journal.seedDefaults();
    expect(seed2.status).toBe('Seeded');
    if (seed2.status === 'Seeded') {
      expect(seed2.additions).toEqual([]);
    }
    const defs = await journal.getDefinitions();
    expect(defs.definitions.map((d) => d.entryTypeId)).toEqual(
      expect.arrayContaining([PLAN_REFLECTION_TYPE_ID, POSITION_CHANGE_REFLECTION_TYPE_ID]),
    );

    const planSnap = defs.definitions.find((d) => d.entryTypeId === PLAN_REFLECTION_TYPE_ID)!;
    const pcSnap = defs.definitions.find(
      (d) => d.entryTypeId === POSITION_CHANGE_REFLECTION_TYPE_ID,
    )!;

    // Seed synthetic entries across multiple trades/types/timestamps to verify query filters and newest-first sort
    await persistence.runWriteTransaction(['journal_entries'], (tx) => {
      tx.put('journal_entries', {
        id: 'j1',
        tradeId: 't1',
        entryTypeId: PLAN_REFLECTION_TYPE_ID,
        definitionId: planSnap.id,
        definitionRevision: planSnap.revision,
        definitionSnapshot: planSnap,
        source: 'PlanConfirmation',
        anchor: { kind: 'Trade', tradeId: 't1' },
        origin: { kind: 'Plan', factId: 'f1' },
        responses: { thesis: 'T1', invalidation: 'I1' },
        recordedAt: '2026-11-23T14:00:00.000Z',
      });
      tx.put('journal_entries', {
        id: 'j2',
        tradeId: 't1',
        entryTypeId: POSITION_CHANGE_REFLECTION_TYPE_ID,
        definitionId: pcSnap.id,
        definitionRevision: pcSnap.revision,
        definitionSnapshot: pcSnap,
        source: 'PositionChange',
        anchor: { kind: 'Trade', tradeId: 't1' },
        origin: { kind: 'PositionChange', factId: 'pc1' },
        responses: { decisionMode: 'As Planned', primaryEmotion: 'Calm', decisionConfidence: 4 },
        recordedAt: '2026-11-23T16:00:00.000Z',
      });
      tx.put('journal_entries', {
        id: 'j3',
        tradeId: 't2',
        entryTypeId: PLAN_REFLECTION_TYPE_ID,
        definitionId: planSnap.id,
        definitionRevision: planSnap.revision,
        definitionSnapshot: planSnap,
        source: 'PlanConfirmation',
        anchor: { kind: 'Trade', tradeId: 't2' },
        origin: { kind: 'Plan', factId: 'f2' },
        responses: { thesis: 'T2', invalidation: 'I2' },
        recordedAt: '2026-11-23T15:00:00.000Z',
      });
    });

    const all = await journal.query({});
    expect(all.items.map((e) => e.id)).toEqual(['j2', 'j3', 'j1']);

    const byTrade = await journal.query({ tradeId: 't1' });
    expect(byTrade.items.map((e) => e.id)).toEqual(['j2', 'j1']);

    const byType = await journal.query({ entryTypeId: PLAN_REFLECTION_TYPE_ID });
    expect(byType.items.map((e) => e.id)).toEqual(['j3', 'j1']);

    const byBoth = await journal.query({
      tradeId: 't1',
      entryTypeId: POSITION_CHANGE_REFLECTION_TYPE_ID,
    });
    expect(byBoth.items.map((e) => e.id)).toEqual(['j2']);
  });
});
