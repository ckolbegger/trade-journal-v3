import type { Clock } from '../../domain/time/index.ts';
import { requireOpen, type IdGenerator, type Persistence, type SemanticTransaction, type Write } from '../../persistence/index.ts';
import type {
  AnswerInput,
  CandidateRef,
  EntryProjection,
  JournalApplyResult,
  JournalIssue,
  JournalPage,
  JournalQuery,
  NarrativeAnswer,
  NarrativeEntry,
  PlanReflectionRequest,
  ResponseValue,
  PrepareJournalEffectsResult,
} from './effects.ts';
import type { JournalSeedManifest } from './manifest.ts';
import type { EntryDefinitionRecord, JournalSnapshot, JournalTypeRecord } from './records.ts';

export interface JournalDeps {
  readonly persistence: Persistence;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

export type SeedJournalResult =
  | { readonly kind: 'Seeded'; readonly additions: readonly string[]; readonly snapshot: JournalSnapshot }
  | { readonly kind: 'SeedConflict'; readonly productKey: string };

interface JournalMeta {
  readonly key: 'journal';
  readonly journalRevision: number;
}

export type GetDefinitionsRequest = { readonly latestFor: string } | { readonly revision: string };

export type GetDefinitionsResult =
  | { readonly kind: 'Found'; readonly definition: EntryDefinitionRecord }
  | { readonly kind: 'NotFound' };

export interface Journal {
  seedDefaults(manifest: JournalSeedManifest): Promise<SeedJournalResult>;
  getDefinitions(request: GetDefinitionsRequest): Promise<GetDefinitionsResult>;
  // Validates a workflow's Journal obligation and prepares its outcome without writing.
  prepareEffects(request: PlanReflectionRequest): Promise<PrepareJournalEffectsResult>;
  // Stages prepared outcomes in the coordinator's semantic transaction, mapping candidate
  // references through Trade Record's durable identities; assigns Entry identities.
  applyPreparedEffects(
    tx: SemanticTransaction,
    prepared: Extract<PrepareJournalEffectsResult, { kind: 'Prepared' }>,
    mapping: Readonly<Record<CandidateRef, string>>,
  ): JournalApplyResult;
  query(query: JournalQuery): Promise<JournalPage>;
}

interface StoredEntry {
  readonly id: string;
  readonly entryTypeKey: string;
  readonly sourceKey: string;
  readonly anchor: { readonly kind: 'Trade'; readonly tradeId: string };
  readonly momentTime: string;
  readonly authoredTime: string;
  readonly versions: readonly {
    readonly definitionId: string;
    readonly responses: readonly { readonly promptId: string; readonly value: ResponseValue }[];
  }[];
}

// Drops persistence's write stamp so callers see exactly the immutable definition revision.
function stripRevision(record: EntryDefinitionRecord): EntryDefinitionRecord {
  return { id: record.id, entryTypeKey: record.entryTypeKey, revisionNumber: record.revisionNumber, prompts: record.prompts };
}

export type PreparedJournalSeed =
  | {
      readonly kind: 'Additions';
      readonly types: readonly JournalTypeRecord[];
      readonly definitions: readonly EntryDefinitionRecord[];
    }
  | { readonly kind: 'SeedConflict'; readonly productKey: string };

// Matches stable product keys and prepares only genuinely missing identities; it never resets
// a revised definition or matches by label.
export function prepareJournalSeed(
  existing: readonly JournalTypeRecord[],
  existingDefinitions: readonly EntryDefinitionRecord[],
  manifest: JournalSeedManifest,
  ids: IdGenerator,
): PreparedJournalSeed {
  const present = new Set(existing.map((t) => t.productKey));
  // A known Entry Type whose seeded revision differs from the manifest is incompatible key history.
  for (const entryType of manifest.entryTypes) {
    const seeded = existingDefinitions.find((d) => d.entryTypeKey === entryType.productKey && d.revisionNumber === 1);
    if (seeded && JSON.stringify(seeded.prompts) !== JSON.stringify(entryType.prompts)) {
      return { kind: 'SeedConflict', productKey: entryType.productKey };
    }
  }
  const newTypes = manifest.entryTypes.filter((t) => !present.has(t.productKey));
  return {
    kind: 'Additions',
    types: [
      ...newTypes.map((t): JournalTypeRecord => ({ id: t.productKey, kind: 'EntryType', productKey: t.productKey, label: t.label })),
      ...manifest.sources
        .filter((src) => !present.has(src.productKey))
        .map((src): JournalTypeRecord => ({ id: src.productKey, kind: 'Source', productKey: src.productKey, label: src.label })),
    ],
    definitions: newTypes.map(
      (t): EntryDefinitionRecord => ({ id: ids.next(), entryTypeKey: t.productKey, revisionNumber: 1, prompts: t.prompts }),
    ),
  };
}

function isBlank(answer: AnswerInput | undefined): boolean {
  return answer === undefined || (answer.kind === 'Text' && answer.text.trim() === '');
}

// Every issue in the completed form, all at once.
function validateForm(definition: EntryDefinitionRecord, answers: Readonly<Record<string, AnswerInput>>): JournalIssue[] {
  const issues: JournalIssue[] = [];
  const known = new Set(definition.prompts.map((p) => p.id));
  for (const promptId of Object.keys(answers)) {
    if (!known.has(promptId)) issues.push({ promptId, code: 'UnknownPrompt' });
  }
  for (const prompt of definition.prompts) {
    const answer = answers[prompt.id];
    if (isBlank(answer)) {
      if (prompt.required) issues.push({ promptId: prompt.id, code: 'RequiredAnswerMissing' });
      continue;
    }
    if (prompt.kind === 'Scale') {
      const valid = answer?.kind === 'Scale' && Number.isInteger(answer.value) && answer.value >= prompt.min && answer.value <= prompt.max;
      if (!valid) issues.push({ promptId: prompt.id, code: 'InvalidScaleValue' });
    } else if (prompt.kind === 'SingleSelect') {
      const valid = answer?.kind === 'Option' && prompt.options.some((o) => o.id === answer.optionId);
      if (!valid) issues.push({ promptId: prompt.id, code: 'UnknownOption' });
    }
  }
  return issues;
}

// Renders an Entry with the exact prompt wording and option labels of the definition revision
// it was saved against, never the current ones.
function narrativeEntry(
  entry: StoredEntry,
  definitions: ReadonlyMap<string, EntryDefinitionRecord>,
  labels: ReadonlyMap<string, string>,
): NarrativeEntry {
  const version = entry.versions[entry.versions.length - 1]!;
  const definition = definitions.get(version.definitionId)!;
  return {
    id: entry.id,
    entryType: labels.get(entry.entryTypeKey) ?? entry.entryTypeKey,
    source: labels.get(entry.sourceKey) ?? entry.sourceKey,
    anchor: entry.anchor,
    momentTime: entry.momentTime,
    authoredTime: entry.authoredTime,
    responses: version.responses.map(({ promptId, value }) => {
      const prompt = definition.prompts.find((p) => p.id === promptId)!;
      let answer: NarrativeAnswer;
      if (value.kind === 'Option') {
        const options = prompt.kind === 'SingleSelect' ? prompt.options : [];
        answer = { kind: 'Option', label: options.find((o) => o.id === value.optionId)?.label ?? value.optionId };
      } else {
        answer = value;
      }
      return { prompt: prompt.text, answer };
    }),
  };
}

export function createJournal(deps: JournalDeps): Journal {
  return {
    async query(query) {
      const { value } = await deps.persistence.readSnapshot(
        ['journalEntries', 'journalDefinitions', 'journalTypes', 'meta'],
        async (tx) => ({
          entries: (await tx.getAllFromIndex('journalEntries', 'byAnchorTrade', query.tradeId)) as unknown as StoredEntry[],
          definitions: (await tx.getAll('journalDefinitions')) as unknown as EntryDefinitionRecord[],
          types: (await tx.getAll('journalTypes')) as unknown as JournalTypeRecord[],
          meta: (await tx.get('meta', 'journal')) as JournalMeta | undefined,
        }),
      );
      const definitions = new Map(value.definitions.map((d) => [d.id, d]));
      const labels = new Map(value.types.map((t) => [t.productKey, t.label]));
      const items = [...value.entries]
        .sort((a, b) =>
          a.momentTime !== b.momentTime ? (a.momentTime < b.momentTime ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
        )
        .map((entry) => narrativeEntry(entry, definitions, labels));
      return { kind: 'Page', items, snapshot: { journalRevision: value.meta?.journalRevision ?? 0 } };
    },

    applyPreparedEffects(tx, prepared, mapping) {
      requireOpen(tx);
      const entries = prepared.effects.entries.map((entry): EntryProjection => {
        const tradeId = mapping[entry.anchor.ref]!;
        return {
          id: deps.ids.next(),
          entryTypeKey: entry.entryTypeKey,
          sourceKey: entry.sourceKey,
          anchor: { kind: 'Trade', tradeId },
          origin: { kind: 'Plan', factId: mapping[entry.origin.ref]! },
          momentTime: entry.momentTime,
          authoredTime: entry.authoredTime,
          definitionId: entry.definitionId,
          responses: entry.responses,
        };
      });
      for (const entry of entries) {
        const { definitionId, responses, ...identity } = entry;
        tx.stage({
          op: 'add',
          store: 'journalEntries',
          value: {
            ...identity,
            obligationKey: `PlanReflection:${entry.anchor.tradeId}`,
            anchorTradeId: entry.anchor.tradeId,
            // An Entry is a stable identity with an immutable version chain (one version until D13).
            versions: [{ versionNumber: 1, definitionId, responses, savedAt: entry.authoredTime }],
          },
        });
      }
      tx.stage({ op: 'put', store: 'meta', value: { key: 'journal', journalRevision: prepared.snapshot.journalRevision + 1 } });
      return { kind: 'Staged', entries };
    },


    async prepareEffects(request) {
      // Plan Reflection requires completion now; it cannot be deferred or declined.
      if (request.disposition.kind !== 'Complete') return { kind: 'Rejected', issues: [{ code: 'DispositionNotAllowed' }] };
      const form = request.disposition.form;
      const { value } = await deps.persistence.readSnapshot(['journalDefinitions', 'meta'], async (tx) => ({
        definitions: (await tx.getAll('journalDefinitions')) as unknown as EntryDefinitionRecord[],
        meta: (await tx.get('meta', 'journal')) as JournalMeta | undefined,
      }));
      // The form must answer the exact current revision the trader was shown.
      const definition = value.definitions
        .filter((d) => d.entryTypeKey === 'entry-type.plan-reflection')
        .sort((a, b) => b.revisionNumber - a.revisionNumber)[0];
      if (!definition || definition.id !== form.definitionId) {
        return { kind: 'Rejected', issues: [{ code: 'DefinitionRevisionMismatch' }] };
      }
      const issues = validateForm(definition, form.answers);
      if (issues.length > 0) return { kind: 'Rejected', issues };
      const textFor = (role: 'Thesis' | 'Invalidation') => {
        const prompt = definition.prompts.find((p) => p.kind === 'Text' && p.role === role);
        const answer = prompt ? form.answers[prompt.id] : undefined;
        return answer?.kind === 'Text' ? answer.text : '';
      };
      return {
        kind: 'Prepared',
        effects: {
          entries: [
            {
              entryTypeKey: 'entry-type.plan-reflection',
              definitionId: form.definitionId,
              sourceKey: 'source.plan-confirmation',
              anchor: request.anchor,
              origin: request.origin,
              momentTime: request.momentTime,
              authoredTime: deps.clock.now(),
              responses: definition.prompts.map((prompt) => ({
                promptId: prompt.id,
                value: form.answers[prompt.id] ?? { kind: 'Unanswered' },
              })),
            },
          ],
        },
        semantics: { Thesis: textFor('Thesis'), Invalidation: textFor('Invalidation') },
        snapshot: { journalRevision: value.meta?.journalRevision ?? 0 },
      };
    },

    async getDefinitions(request) {
      const { value } = await deps.persistence.readSnapshot(['journalDefinitions'], (tx) => tx.getAll('journalDefinitions'));
      const all = value as unknown as EntryDefinitionRecord[];
      const found =
        'revision' in request
          ? all.find((d) => d.id === request.revision)
          : all.filter((d) => d.entryTypeKey === request.latestFor).sort((a, b) => b.revisionNumber - a.revisionNumber)[0];
      return found ? { kind: 'Found', definition: stripRevision(found) } : { kind: 'NotFound' };
    },

    async seedDefaults(manifest) {
      const { value } = await deps.persistence.readSnapshot(['meta', 'journalTypes', 'journalDefinitions'], async (tx) => ({
        meta: (await tx.get('meta', 'journal')) as JournalMeta | undefined,
        types: (await tx.getAll('journalTypes')) as unknown as JournalTypeRecord[],
        definitions: (await tx.getAll('journalDefinitions')) as unknown as EntryDefinitionRecord[],
      }));
      const current = value.meta?.journalRevision ?? 0;
      const prepared = prepareJournalSeed(value.types, value.definitions, manifest, deps.ids);
      if (prepared.kind === 'SeedConflict') return prepared;
      if (prepared.types.length === 0) return { kind: 'Seeded', additions: [], snapshot: { journalRevision: current } };
      const journalRevision = current + 1;
      const writes: Write[] = [
        ...prepared.types.map((t): Write => ({ op: 'put', store: 'journalTypes', value: { ...t } })),
        ...prepared.definitions.map((d): Write => ({ op: 'put', store: 'journalDefinitions', value: { ...d } })),
        { op: 'put', store: 'meta', value: { key: 'journal', journalRevision } },
      ];
      await deps.persistence.commit({ checks: [], writes });
      return { kind: 'Seeded', additions: prepared.types.map((t) => t.productKey), snapshot: { journalRevision } };
    },
  };
}
