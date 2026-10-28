import type { RuntimeNotWritable } from '../../delivery/runtime-not-writable.ts';
import type { Clock } from '../../domain/time/index.ts';
import { requireOpen, type BindingCheck, type IdGenerator, type Persistence, type SemanticTransaction, type Write } from '../../persistence/index.ts';
import type {
  AnswerInput,
  CandidateRef,
  DeclineProjection,
  EntryProjection,
  JournalObligationKey,
  JournalApplyResult,
  JournalIssue,
  JournalPage,
  JournalQuery,
  NarrativeAnswer,
  NarrativeEntry,
  NarrativeItem,
  JournalEffectRequest,
  PlanReflectionRequest,
  PlanSemantics,
  PositionChangeReflectionRequest,
  PreparedJournalOutcome,
  PreparePlanReflectionResult,
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
  | { readonly kind: 'SeedConflict'; readonly productKey: string }
  // journalRevision kept moving through every attempt; nothing was written.
  | { readonly kind: 'Conflict' }
  | RuntimeNotWritable;

// Attempts in all when only the shared journalRevision counter moved between read and commit.
const MAX_ATTEMPTS = 3;

// Rechecked inside the commit: the seed was prepared against this Journal revision.
function journalUnchanged(journalRevision: number): BindingCheck {
  return {
    name: `journal@${journalRevision}`,
    store: 'meta',
    key: 'journal',
    verify: (current) => ((current?.['journalRevision'] as number | undefined) ?? 0) === journalRevision,
  };
}

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
  prepareEffects(request: PlanReflectionRequest): Promise<PreparePlanReflectionResult>;
  prepareEffects(request: PositionChangeReflectionRequest): Promise<PrepareJournalEffectsResult>;
  // Stages prepared outcomes in the coordinator's semantic transaction, mapping candidate
  // references through Trade Record's durable identities; assigns Entry identities.
  applyPreparedEffects(
    tx: SemanticTransaction,
    prepared: PreparedJournalOutcome,
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
  readonly origin: { readonly kind: string; readonly factId: string };
  readonly versions: readonly {
    readonly definitionId: string;
    readonly responses: readonly { readonly promptId: string; readonly value: ResponseValue }[];
  }[];
}

interface StoredDecline {
  readonly id: string;
  readonly entryTypeKey: string;
  readonly sourceKey: string;
  readonly anchor: { readonly kind: 'Trade'; readonly tradeId: string };
  readonly momentTime: string;
  readonly authoredTime: string;
  readonly origin: { readonly kind: string; readonly factId: string };
  readonly reason?: string;
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
    ...(entry.origin.kind === 'PositionChange' ? { positionChangeId: entry.origin.factId } : {}),
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

// A decline's optional reason, in characters (Unicode code points) (D2 A29).
const MAX_DECLINE_REASON = 500;

// The fixed Entry Type and automatic Source of each workflow obligation.
const OBLIGATIONS = {
  PlanReflection: { entryTypeKey: 'entry-type.plan-reflection', sourceKey: 'source.plan-confirmation' },
  PositionChangeReflection: { entryTypeKey: 'entry-type.position-change-reflection', sourceKey: 'source.position-change' },
} as const;

export function createJournal(deps: JournalDeps): Journal {
  async function prepareEffects(
    request: JournalEffectRequest,
  ): Promise<PrepareJournalEffectsResult | PreparePlanReflectionResult> {
    const { disposition } = request;
    // Plan Reflection requires completion now; Position Change Reflection may also be declined.
    // Defer arrives with D5.
    const declining = disposition.kind === 'Decline' && request.obligation === 'PositionChangeReflection';
    if (disposition.kind !== 'Complete' && !declining) return { kind: 'Rejected', issues: [{ code: 'DispositionNotAllowed' }] };
    const { entryTypeKey, sourceKey } = OBLIGATIONS[request.obligation];
    const obligationKey: JournalObligationKey =
      request.obligation === 'PlanReflection'
        ? { entryType: 'PlanReflection', trade: request.anchor.ref }
        : { entryType: 'PositionChangeReflection', positionChange: request.origin.ref };
    const { value } = await deps.persistence.readSnapshot(['journalDefinitions', 'meta'], async (tx) => ({
      definitions: (await tx.getAll('journalDefinitions')) as unknown as EntryDefinitionRecord[],
      meta: (await tx.get('meta', 'journal')) as JournalMeta | undefined,
    }));
    const snapshot = { journalRevision: value.meta?.journalRevision ?? 0 };
    // The outcome must name the exact current revision the trader was shown.
    const definition = value.definitions
      .filter((d) => d.entryTypeKey === entryTypeKey)
      .sort((a, b) => b.revisionNumber - a.revisionNumber)[0];
    const shown = disposition.kind === 'Decline' ? disposition.definitionId : disposition.form.definitionId;
    if (!definition || definition.id !== shown) {
      return { kind: 'Rejected', issues: [{ code: 'DefinitionRevisionMismatch' }] };
    }
    if (disposition.kind === 'Decline' && request.obligation === 'PositionChangeReflection') {
      if ([...(disposition.reason ?? '')].length > MAX_DECLINE_REASON) return { kind: 'Rejected', issues: [{ code: 'ReasonTooLong' }] };
      return {
        kind: 'Prepared',
        effects: {
          entries: [],
          declines: [
            {
              entryTypeKey,
              obligationKey,
              anchor: request.anchor,
              sourceKey,
              origin: request.origin,
              definitionId: definition.id,
              ...(disposition.reason === undefined ? {} : { reason: disposition.reason }),
              momentTime: request.momentTime,
              authoredTime: deps.clock.now(),
            },
          ],
        },
        snapshot,
      };
    }
    // Unreachable after the guard above; it narrows the disposition to Complete.
    if (disposition.kind !== 'Complete') return { kind: 'Rejected', issues: [{ code: 'DispositionNotAllowed' }] };
    const form = disposition.form;
    const issues = validateForm(definition, form.answers);
    if (issues.length > 0) return { kind: 'Rejected', issues };
    const prepared: PreparedJournalOutcome = {
      kind: 'Prepared',
      effects: {
        entries: [
          {
            entryTypeKey,
            definitionId: form.definitionId,
            sourceKey,
            obligationKey,
            anchor: request.anchor,
            origin: request.origin,
            momentTime: request.momentTime,
            authoredTime: deps.clock.now(),
            // A blank optional answer is saved as Unanswered, never as declined.
            responses: definition.prompts.map((prompt) => {
              const answer = form.answers[prompt.id];
              return { promptId: prompt.id, value: answer === undefined || isBlank(answer) ? { kind: 'Unanswered' } : answer };
            }),
          },
        ],
        declines: [],
      },
      snapshot,
    };
    if (request.obligation !== 'PlanReflection') return prepared;
    const textFor = (role: 'Thesis' | 'Invalidation') => {
      const prompt = definition.prompts.find((p) => p.kind === 'Text' && p.role === role);
      const answer = prompt ? form.answers[prompt.id] : undefined;
      return answer?.kind === 'Text' ? answer.text : '';
    };
    const semantics: PlanSemantics = { Thesis: textFor('Thesis'), Invalidation: textFor('Invalidation') };
    return { ...prepared, semantics };
  }

  return {
    async query(query) {
      const { value } = await deps.persistence.readSnapshot(
        ['journalEntries', 'journalDeclines', 'journalDefinitions', 'journalTypes', 'meta'],
        async (tx) => ({
          entries: (await tx.getAllFromIndex('journalEntries', 'byAnchorTrade', query.tradeId)) as unknown as StoredEntry[],
          declines: (await tx.getAllFromIndex('journalDeclines', 'byAnchorTrade', query.tradeId)) as unknown as StoredDecline[],
          definitions: (await tx.getAll('journalDefinitions')) as unknown as EntryDefinitionRecord[],
          types: (await tx.getAll('journalTypes')) as unknown as JournalTypeRecord[],
          meta: (await tx.get('meta', 'journal')) as JournalMeta | undefined,
        }),
      );
      const definitions = new Map(value.definitions.map((d) => [d.id, d]));
      const labels = new Map(value.types.map((t) => [t.productKey, t.label]));
      const label = (key: string) => labels.get(key) ?? key;
      const items: NarrativeItem[] = [
        ...value.entries.map((entry): NarrativeItem => ({ kind: 'Entry', ...narrativeEntry(entry, definitions, labels) })),
        ...value.declines.map(
          (decline): NarrativeItem => ({
            kind: 'Decline',
            id: decline.id,
            entryType: label(decline.entryTypeKey),
            source: label(decline.sourceKey),
            anchor: decline.anchor,
            momentTime: decline.momentTime,
            authoredTime: decline.authoredTime,
            ...(decline.origin.kind === 'PositionChange' ? { positionChangeId: decline.origin.factId } : {}),
            ...(decline.reason === undefined ? {} : { reason: decline.reason }),
          }),
        ),
      ];
      items.sort((a, b) =>
        a.momentTime !== b.momentTime ? (a.momentTime < b.momentTime ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
      );
      return { kind: 'Page', items, snapshot: { journalRevision: value.meta?.journalRevision ?? 0 } };
    },

    applyPreparedEffects(tx, prepared, mapping) {
      requireOpen(tx);
      // Trade Record's exact durable mapping; a reference it does not list is already durable.
      const durable = (ref: CandidateRef) => mapping[ref] ?? ref;
      const keyOf = (key: JournalObligationKey) =>
        key.entryType === 'PlanReflection' ? `PlanReflection:${durable(key.trade)}` : `PositionChangeReflection:${durable(key.positionChange)}`;
      // Each outcome is staged with its obligation record; `add` fails the whole transaction when
      // the key already has an outcome (D2 A28).
      const stageObligation = (obligationKey: string, outcome: { kind: 'Entry' | 'Decline'; id: string }) =>
        tx.stage({ op: 'add', store: 'journalObligations', value: { obligationKey, outcome } });
      const entries = prepared.effects.entries.map((entry): EntryProjection => {
        const projection: EntryProjection = {
          id: deps.ids.next(),
          entryTypeKey: entry.entryTypeKey,
          sourceKey: entry.sourceKey,
          anchor: { kind: 'Trade', tradeId: durable(entry.anchor.ref) },
          origin: { kind: entry.origin.kind, factId: durable(entry.origin.ref) },
          momentTime: entry.momentTime,
          authoredTime: entry.authoredTime,
          definitionId: entry.definitionId,
          responses: entry.responses,
        };
        const { definitionId, responses, ...identity } = projection;
        const obligationKey = keyOf(entry.obligationKey);
        tx.stage({
          op: 'add',
          store: 'journalEntries',
          value: {
            ...identity,
            obligationKey,
            anchorTradeId: projection.anchor.tradeId,
            // An Entry is a stable identity with an immutable version chain (one version until D13).
            versions: [{ versionNumber: 1, definitionId, responses, savedAt: projection.authoredTime }],
          },
        });
        stageObligation(obligationKey, { kind: 'Entry', id: projection.id });
        return projection;
      });
      const declines = prepared.effects.declines.map((decline): DeclineProjection => {
        const projection: DeclineProjection = {
          id: deps.ids.next(),
          entryTypeKey: decline.entryTypeKey,
          sourceKey: decline.sourceKey,
          anchor: { kind: 'Trade', tradeId: durable(decline.anchor.ref) },
          origin: { kind: 'PositionChange', factId: durable(decline.origin.ref) },
          definitionId: decline.definitionId,
          ...(decline.reason === undefined ? {} : { reason: decline.reason }),
          momentTime: decline.momentTime,
          authoredTime: decline.authoredTime,
        };
        const obligationKey = keyOf(decline.obligationKey);
        tx.stage({ op: 'add', store: 'journalDeclines', value: { ...projection, obligationKey, anchorTradeId: projection.anchor.tradeId } });
        stageObligation(obligationKey, { kind: 'Decline', id: projection.id });
        return projection;
      });
      tx.stage({ op: 'put', store: 'meta', value: { key: 'journal', journalRevision: prepared.snapshot.journalRevision + 1 } });
      return { kind: 'Staged', entries, declines };
    },

    // One implementation serves both overloads: only a Plan Reflection carries semantics.
    prepareEffects: prepareEffects as Journal['prepareEffects'],

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
      for (let attempt = 1; ; attempt++) {
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
        const committed = await deps.persistence.commit({ checks: [journalUnchanged(current)], writes });
        if (committed.kind === 'RuntimeNotWritable') return committed;
        // Only the Journal counter moved: read again and prepare the seed afresh.
        if (committed.kind !== 'Committed') {
          if (attempt < MAX_ATTEMPTS) continue;
          return { kind: 'Conflict' };
        }
        return { kind: 'Seeded', additions: prepared.types.map((t) => t.productKey), snapshot: { journalRevision } };
      }
    },
  };
}
