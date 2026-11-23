import type {
  EntryDefinitionRecord,
  JournalEntryRecord,
  JournalMetaRecord,
  PersistenceSeam,
} from '../persistence/idb';
import type { Clock } from '../shared/clock';
import type { RuntimeNotWritableResult } from '../shared/result';

export const JOURNAL_SEED_MANIFEST_VERSION = 4 as const;
export const PLAN_REFLECTION_TYPE_ID = 'entry_type_plan_reflection' as const;
export const PLAN_REFLECTION_DEF_ID = 'def_plan_reflection_v1' as const;
export const POSITION_CHANGE_REFLECTION_TYPE_ID = 'entry_type_position_change_reflection' as const;
export const POSITION_CHANGE_REFLECTION_DEF_ID = 'def_position_change_reflection_v1' as const;
export const DAILY_TRADE_REVIEW_TYPE_ID = 'entry_type_daily_trade_review' as const;
export const DAILY_TRADE_REVIEW_DEF_ID = 'def_daily_trade_review_v1' as const;

export const DAILY_REVIEW_ACTION_OPTIONS = ['Hold', 'Exit'] as const;
export type DailyReviewAction = (typeof DAILY_REVIEW_ACTION_OPTIONS)[number];

export const DECISION_MODE_OPTIONS = [
  'As Planned',
  'Deliberate Adjustment',
  'Reactive',
  'Externally Imposed',
] as const;

export type DecisionMode = (typeof DECISION_MODE_OPTIONS)[number];

export const PRIMARY_EMOTION_OPTIONS = [
  'Calm',
  'Eager',
  'Anxious',
  'FOMO',
  'Revenge',
  'Relieved',
  'Frustrated',
  'Other',
] as const;

export type PrimaryEmotion = (typeof PRIMARY_EMOTION_OPTIONS)[number];

export interface PlanReflectionInput {
  readonly definitionId: string;
  readonly definitionRevision: number;
  readonly thesis: string;
  readonly invalidation: string;
  readonly conviction?: number;
  readonly primaryEmotion?: PrimaryEmotion;
}

export interface PlanReflectionValidationError {
  readonly field: 'definition' | 'thesis' | 'invalidation' | 'conviction' | 'primaryEmotion';
  readonly message: string;
}

export type SeedJournalDefaultsResult =
  | {
      readonly status: 'Seeded';
      readonly seedManifestVersion: number;
      readonly additions: readonly string[];
    }
  | RuntimeNotWritableResult;

export interface Journal {
  seedDefaults(): Promise<SeedJournalDefaultsResult>;
  getDefinitions(): Promise<{ readonly definitions: readonly EntryDefinitionRecord[] }>;
  query(filter: {
    readonly tradeId?: string;
    readonly entryTypeId?: string;
  }): Promise<{ readonly items: readonly JournalEntryRecord[] }>;
}

export function buildPlanReflectionDefinitionV1(createdAt: string): EntryDefinitionRecord {
  return {
    id: PLAN_REFLECTION_DEF_ID,
    entryTypeId: PLAN_REFLECTION_TYPE_ID,
    label: 'Plan Reflection',
    revision: 1,
    createdAt,
    prompts: [
      {
        promptId: 'thesis',
        label: 'Why this trade, why now?',
        kind: 'Text',
        required: true,
        role: 'Thesis',
      },
      {
        promptId: 'invalidation',
        label: 'What would invalidate the thesis?',
        kind: 'Text',
        required: true,
        role: 'Invalidation',
      },
      {
        promptId: 'conviction',
        label: 'Conviction',
        kind: 'Scale',
        required: false,
        min: 1,
        max: 5,
      },
      {
        promptId: 'primaryEmotion',
        label: 'Primary emotion',
        kind: 'SingleSelect',
        required: false,
        options: [...PRIMARY_EMOTION_OPTIONS],
      },
    ],
  };
}

export function validatePlanReflectionInput(
  definition: EntryDefinitionRecord | undefined,
  input: PlanReflectionInput,
): { ok: true; thesis: string; invalidation: string } | { ok: false; errors: PlanReflectionValidationError[] } {
  const errors: PlanReflectionValidationError[] = [];

  if (
    !definition ||
    definition.id !== input.definitionId ||
    definition.revision !== input.definitionRevision
  ) {
    errors.push({
      field: 'definition',
      message: 'Plan Reflection form definition is missing or stale.',
    });
  }

  const thesis = input.thesis.trim();
  if (!thesis) {
    errors.push({
      field: 'thesis',
      message: 'Thesis ("Why this trade, why now?") is required.',
    });
  }

  const invalidation = input.invalidation.trim();
  if (!invalidation) {
    errors.push({
      field: 'invalidation',
      message: 'Invalidation ("What would invalidate the thesis?") is required.',
    });
  }

  if (
    input.conviction !== undefined &&
    (!Number.isInteger(input.conviction) || input.conviction < 1 || input.conviction > 5)
  ) {
    errors.push({
      field: 'conviction',
      message: 'Conviction must be an integer between 1 and 5.',
    });
  }

  if (
    input.primaryEmotion !== undefined &&
    !(PRIMARY_EMOTION_OPTIONS as readonly string[]).includes(input.primaryEmotion)
  ) {
    errors.push({
      field: 'primaryEmotion',
      message: `Primary emotion "${input.primaryEmotion}" is not a valid option.`,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, thesis, invalidation };
}

export interface PositionChangeReflectionInput {
  readonly definitionId: string;
  readonly definitionRevision: number;
  readonly decisionMode: DecisionMode;
  readonly primaryEmotion: PrimaryEmotion;
  readonly decisionConfidence: number;
  readonly note?: string;
}

export function buildPositionChangeReflectionDefinitionV1(createdAt: string): EntryDefinitionRecord {
  return {
    id: POSITION_CHANGE_REFLECTION_DEF_ID,
    entryTypeId: POSITION_CHANGE_REFLECTION_TYPE_ID,
    label: 'Position Change Reflection',
    revision: 1,
    createdAt,
    prompts: [
      {
        promptId: 'decisionMode',
        label: 'Decision mode',
        kind: 'SingleSelect',
        required: true,
        options: [...DECISION_MODE_OPTIONS],
      },
      {
        promptId: 'primaryEmotion',
        label: 'Primary emotion',
        kind: 'SingleSelect',
        required: true,
        options: [...PRIMARY_EMOTION_OPTIONS],
      },
      {
        promptId: 'decisionConfidence',
        label: 'Decision confidence',
        kind: 'Scale',
        required: true,
        min: 1,
        max: 5,
      },
      {
        promptId: 'note',
        label: 'Note',
        kind: 'Text',
        required: false,
      },
    ],
  };
}

export function validatePositionChangeReflectionInput(
  definition: EntryDefinitionRecord | undefined,
  input: PositionChangeReflectionInput,
): { ok: true; note?: string } | { ok: false; errors: { field: string; message: string }[] } {
  const errors: { field: string; message: string }[] = [];
  if (
    !definition ||
    definition.id !== input.definitionId ||
    definition.revision !== input.definitionRevision
  ) {
    errors.push({
      field: 'definition',
      message: 'Position Change Reflection form definition is missing or stale.',
    });
  }
  if (!(DECISION_MODE_OPTIONS as readonly string[]).includes(input.decisionMode)) {
    errors.push({ field: 'decisionMode', message: 'Select a valid Decision mode.' });
  }
  if (!(PRIMARY_EMOTION_OPTIONS as readonly string[]).includes(input.primaryEmotion)) {
    errors.push({ field: 'primaryEmotion', message: 'Select a valid Primary emotion.' });
  }
  if (
    !Number.isInteger(input.decisionConfidence) ||
    input.decisionConfidence < 1 ||
    input.decisionConfidence > 5
  ) {
    errors.push({
      field: 'decisionConfidence',
      message: 'Decision confidence must be an integer between 1 and 5.',
    });
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  const trimmedNote = input.note?.trim();
  return { ok: true, note: trimmedNote || undefined };
}

export function buildDailyTradeReviewDefinition(createdAt: string): EntryDefinitionRecord {
  return {
    id: DAILY_TRADE_REVIEW_DEF_ID,
    entryTypeId: DAILY_TRADE_REVIEW_TYPE_ID,
    label: 'Daily Trade Review',
    revision: 2,
    createdAt,
    prompts: [
      {
        promptId: 'action',
        label: 'Action',
        kind: 'SingleSelect',
        required: true,
        options: [...DAILY_REVIEW_ACTION_OPTIONS],
      },
      {
        promptId: 'reason',
        label: 'Why?',
        kind: 'Text',
        required: false,
      },
      {
        promptId: 'conviction',
        label: 'Conviction now',
        kind: 'Scale',
        required: false,
        min: 1,
        max: 5,
      },
      {
        promptId: 'consideredAgainst',
        label: 'Anything you considered and decided against?',
        kind: 'Text',
        required: false,
      },
      {
        promptId: 'note',
        label: 'Note',
        kind: 'Text',
        required: false,
      },
    ],
  };
}

export function createJournal(options: {
  readonly persistence: PersistenceSeam;
  readonly clock: Clock;
}): Journal {
  const { persistence, clock } = options;

  return {
    async seedDefaults(): Promise<SeedJournalDefaultsResult> {
      const txResult = await persistence.runWriteTransaction(
        ['journal_meta', 'journal_definitions'],
        async (tx): Promise<Exclude<SeedJournalDefaultsResult, RuntimeNotWritableResult>> => {
          const [meta, defs] = await Promise.all([
            tx.get('journal_meta', 'singleton'),
            tx.getAll('journal_definitions'),
          ]);

          const additions: string[] = [];
          const now = clock.nowIso();

          const hasPlanDef = defs.some((d) => d.entryTypeId === PLAN_REFLECTION_TYPE_ID);
          if (!hasPlanDef) {
            tx.put('journal_definitions', buildPlanReflectionDefinitionV1(now));
            additions.push(PLAN_REFLECTION_DEF_ID);
          }

          const hasPcDef = defs.some((d) => d.entryTypeId === POSITION_CHANGE_REFLECTION_TYPE_ID);
          if (!hasPcDef) {
            tx.put('journal_definitions', buildPositionChangeReflectionDefinitionV1(now));
            additions.push(POSITION_CHANGE_REFLECTION_DEF_ID);
          }

          // Safe in-place revision 1 -> 2 upgrade: all existing JournalEntryRecords preserve their own immutable point-in-time definitionSnapshot.
          const existingDtrDef = defs.find((d) => d.entryTypeId === DAILY_TRADE_REVIEW_TYPE_ID);
          if (!existingDtrDef || existingDtrDef.revision < 2) {
            tx.put(
              'journal_definitions',
              buildDailyTradeReviewDefinition(existingDtrDef?.createdAt ?? now),
            );
            additions.push(DAILY_TRADE_REVIEW_DEF_ID);
          }

          if (!meta || meta.seedManifestVersion < JOURNAL_SEED_MANIFEST_VERSION || additions.length > 0) {
            const nextMeta: JournalMetaRecord = {
              key: 'singleton',
              seedManifestVersion: JOURNAL_SEED_MANIFEST_VERSION,
              seededAt: meta?.seededAt || now,
            };
            tx.put('journal_meta', nextMeta);
          }

          return {
            status: 'Seeded',
            seedManifestVersion: JOURNAL_SEED_MANIFEST_VERSION,
            additions,
          };
        },
      );

      if (txResult.status === 'RuntimeNotWritable') {
        return txResult;
      }
      return txResult.value;
    },

    async getDefinitions() {
      const definitions = await persistence.runReadTransaction(['journal_definitions'], (tx) =>
        tx.getAll('journal_definitions'),
      );
      return {
        definitions: [...definitions].sort((a, b) => a.id.localeCompare(b.id)),
      };
    },

    async query(filter) {
      const all = await persistence.runReadTransaction(['journal_entries'], (tx) =>
        tx.getAll('journal_entries'),
      );
      const filtered = all
        .filter((entry) => {
          if (filter.tradeId && entry.tradeId !== filter.tradeId) return false;
          if (filter.entryTypeId && entry.entryTypeId !== filter.entryTypeId) return false;
          return true;
        })
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
      return { items: filtered };
    },
  };
}
