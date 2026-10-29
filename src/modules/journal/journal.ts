import type { RuntimeNotWritable } from '../../delivery/runtime-not-writable.ts';
import type { Clock } from '../../domain/time/index.ts';
import { beginSemanticTransaction, requireOpen, type BindingCheck, type IdGenerator, type Persistence, type SemanticTransaction, type Write } from '../../persistence/index.ts';
import type {
  AnswerInput,
  CandidateRef,
  DailyAction,
  DailyTradeReviewRequest,
  DebtProjection,
  DeclineProjection,
  EntryProjection,
  JournalObligationKey,
  JournalApplyResult,
  JournalIssue,
  JournalPage,
  JournalQuery,
  OutstandingDebtPage,
  ReviewDateActions,
  ReviewDateQuery,
  NarrativeAnswer,
  NarrativeEntry,
  TradeNarrativeItem,
  JournalEffectRequest,
  PlanReflectionRequest,
  PlanSemantics,
  PositionChangeReflectionRequest,
  ObligationOutcome,
  ResolveDebtCommand,
  ResolveDebtRequest,
  PreparedEntry,
  PreparedEntryEdit,
  PreparedJournalOutcome,
  PreparePlanReflectionResult,
  ResponseValue,
  PrepareJournalEffectsResult,
} from './effects.ts';
import type { JournalSeedManifest } from './manifest.ts';
import type { EntryDefinitionRecord, JournalSnapshot, JournalTypeRecord, PromptDefinition } from './records.ts';

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

// A Debt resolution validated without writing; a coordinator stages it in its own transaction.
export type PrepareResolveDebtResult =
  | PreparedJournalOutcome
  | { readonly kind: 'Rejected'; readonly issues: readonly JournalIssue[] }
  // The expected Debt revision is stale or the Debt is no longer Outstanding.
  | { readonly kind: 'Conflict'; readonly currentOutcome: ObligationOutcome }
  | { readonly kind: 'NotFound' };

export type JournalSaveResult =
  // The complete outcome at the new Journal revision: the Entry or decline, the Debt's transition,
  // and the key's current outcome, so a caller renders it without a Journal query.
  | {
      readonly kind: 'Saved';
      readonly entry?: EntryProjection;
      readonly decline?: DeclineProjection;
      readonly debt: DebtProjection;
      readonly currentOutcome: ObligationOutcome;
      readonly snapshot: { readonly journalRevision: number };
    }
  | Exclude<PrepareResolveDebtResult, PreparedJournalOutcome>
  | RuntimeNotWritable;

export type GetDefinitionsRequest = { readonly latestFor: string } | { readonly revision: string };

export type GetDefinitionsResult =
  | { readonly kind: 'Found'; readonly definition: EntryDefinitionRecord }
  | { readonly kind: 'NotFound' };

export interface Journal {
  seedDefaults(manifest: JournalSeedManifest): Promise<SeedJournalResult>;
  getDefinitions(request: GetDefinitionsRequest): Promise<GetDefinitionsResult>;
  // Journal-only Debt resolution from Trade Detail, in its own semantic commit (D5 A64).
  save(command: ResolveDebtCommand): Promise<JournalSaveResult>;
  // The same resolution as `save`, with Source Daily Review, for a coordinator to stage in its own transaction.
  prepareEffects(request: ResolveDebtRequest): Promise<PrepareResolveDebtResult>;
  // Validates a workflow's Journal obligation and prepares its outcome without writing.
  prepareEffects(request: PlanReflectionRequest): Promise<PreparePlanReflectionResult>;
  prepareEffects(request: DailyTradeReviewRequest): Promise<PrepareJournalEffectsResult>;
  prepareEffects(request: PositionChangeReflectionRequest): Promise<PrepareJournalEffectsResult>;
  // Stages prepared outcomes in the coordinator's semantic transaction, mapping candidate
  // references through Trade Record's durable identities; assigns Entry identities.
  applyPreparedEffects(
    tx: SemanticTransaction,
    prepared: PreparedJournalOutcome,
    mapping: Readonly<Record<CandidateRef, string>>,
  ): JournalApplyResult;
  // `TradeNarrative`: a Trade's narrative, one item per obligation (D5 A69). `OutstandingDebt`:
  // every Outstanding Debt in due-anchor then Debt-identity order, with one index read (D5 A63).
  query<Q extends JournalQuery>(query: Q): Promise<Q extends { scope: 'OutstandingDebt' } ? OutstandingDebtPage : JournalPage>;
  // Every Daily Trade Review Action for a Review Date, keyed by Trade.
  queryActions(query: ReviewDateQuery): Promise<ReviewDateActions>;
}

interface StoredEntry {
  readonly id: string;
  readonly entryTypeKey: string;
  readonly sourceKey: string;
  readonly anchor: { readonly kind: 'Trade'; readonly tradeId: string };
  readonly momentTime: string;
  readonly authoredTime: string;
  readonly origin: { readonly kind: string; readonly factId: string; readonly reviewDate?: string };
  readonly settledDebtId?: string;
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
  readonly settledDebtId?: string;
}

// A stored Debt (D5 A61, A62): the projection's fields, the private index fields, and its version chain.
interface StoredDebt {
  readonly debtId: string;
  readonly obligationKey: string;
  readonly entryTypeKey: string;
  readonly sourceKey: string;
  readonly definitionId: string;
  readonly anchor: { readonly kind: 'Trade'; readonly tradeId: string };
  readonly origin: { readonly kind: 'PositionChange'; readonly factId: string };
  readonly momentTime: string;
  readonly dueAnchor: string;
  readonly dueRule: 'OneSessionGrace';
  readonly route: 'JournalOnly';
  readonly anchorTradeId: string;
  readonly outstandingDue?: string;
  readonly versions: readonly {
    readonly versionId: string;
    readonly status: DebtProjection['status'];
    readonly entryId?: string;
    readonly declineId?: string;
    readonly savedAt: string;
  }[];
}

// A stored Debt as its current version reads (D5 A61).
function debtProjection(debt: StoredDebt): DebtProjection {
  const current = debt.versions.at(-1)!;
  return {
    debtId: debt.debtId,
    obligationKey: debt.obligationKey,
    entryTypeKey: debt.entryTypeKey,
    sourceKey: debt.sourceKey,
    definitionId: debt.definitionId,
    anchor: debt.anchor,
    origin: debt.origin,
    momentTime: debt.momentTime,
    dueAnchor: debt.dueAnchor,
    dueRule: debt.dueRule,
    route: debt.route,
    status: current.status,
    revision: current.versionId,
    ...(current.entryId === undefined ? {} : { entryId: current.entryId }),
    ...(current.declineId === undefined ? {} : { declineId: current.declineId }),
  };
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

// RequireWhenOption: the prompt becomes required when its controlling Single Select holds a named option.
function requiredByOption(prompt: PromptDefinition, answers: Readonly<Record<string, AnswerInput>>): boolean {
  if (prompt.kind !== 'Text' || !prompt.requiredWhen) return false;
  const controlling = answers[prompt.requiredWhen.promptId];
  return controlling?.kind === 'Option' && prompt.requiredWhen.optionIds.includes(controlling.optionId);
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
      if (prompt.required || requiredByOption(prompt, answers)) issues.push({ promptId: prompt.id, code: 'RequiredAnswerMissing' });
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

// One response per prompt of the definition revision, in its order; a blank answer is saved as
// Unanswered, never as declined.
function responsesOf(definition: EntryDefinitionRecord, answers: Readonly<Record<string, AnswerInput>>) {
  return definition.prompts.map((prompt): { promptId: string; value: ResponseValue } => {
    const answer = answers[prompt.id];
    return { promptId: prompt.id, value: answer === undefined || isBlank(answer) ? { kind: 'Unanswered' } : answer };
  });
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
    ...(entry.origin.kind === 'DailyReview' ? { reviewDate: entry.origin.reviewDate } : {}),
    // A discreet Edited indicator once an Entry has more than one version.
    ...(entry.versions.length > 1 ? { edited: true as const } : {}),
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

// An Entry's effective version as a Daily Action: the answers, the revision, the chosen Action's label.
function dailyAction(
  entry: StoredEntry,
  definitions: ReadonlyMap<string, EntryDefinitionRecord>,
  labels: ReadonlyMap<string, string>,
): DailyAction {
  const narrative = narrativeEntry(entry, definitions, labels);
  // The Action prompt is the one holding the Action role in the Entry's original definition.
  const actionPromptId = definitions.get(entry.versions[0]!.definitionId)?.prompts.find((p) => p.kind === 'SingleSelect' && p.role === 'Action')?.id;
  const latest = entry.versions[entry.versions.length - 1]!;
  const chosen = narrative.responses[latest.responses.findIndex((r) => r.promptId === actionPromptId)]?.answer;
  return { ...narrative, entryRevision: entry.versions.length, definitionId: entry.versions[0]!.definitionId, action: chosen?.kind === 'Option' ? chosen.label : '' };
}

// Sorts after every key string, to bound a whole-index range read.
const HIGH_KEY = String.fromCharCode(0xffff);

// A decline's optional reason, in characters (Unicode code points) (D2 A29).
const MAX_DECLINE_REASON = 500;

// The fixed Entry Type and automatic Source of each workflow obligation.
const OBLIGATIONS = {
  PlanReflection: { entryTypeKey: 'entry-type.plan-reflection', sourceKey: 'source.plan-confirmation' },
  PositionChangeReflection: { entryTypeKey: 'entry-type.position-change-reflection', sourceKey: 'source.position-change' },
  DailyTradeReview: { entryTypeKey: 'entry-type.daily-trade-review', sourceKey: 'source.daily-review' },
} as const;

export function createJournal(deps: JournalDeps): Journal {
  async function prepareEffects(
    request: JournalEffectRequest | ResolveDebtRequest,
  ): Promise<PrepareJournalEffectsResult | PreparePlanReflectionResult | PrepareResolveDebtResult> {
    if (request.obligation === 'ResolveDebt') {
      const { debtId, expectedDebtRevision, resolution } = request;
      return prepareResolution({ intention: 'ResolveDebt', debtId, expectedDebtRevision, resolution }, 'source.daily-review');
    }
    const { disposition } = request;
    // Plan Reflection requires completion now; Position Change Reflection may also be declined.
    // Defer is installed for the Position Change Reflection only (D5 A66).
    const declining = disposition.kind === 'Decline' && request.obligation === 'PositionChangeReflection';
    const deferring = disposition.kind === 'Defer' && request.obligation === 'PositionChangeReflection';
    if (disposition.kind !== 'Complete' && !declining && !deferring) return { kind: 'Rejected', issues: [{ code: 'DispositionNotAllowed' }] };
    const { entryTypeKey, sourceKey } = OBLIGATIONS[request.obligation];
    const obligationKeyOf = (): JournalObligationKey => {
      if (request.obligation === 'PlanReflection') return { entryType: 'PlanReflection', trade: request.anchor.ref };
      if (request.obligation === 'DailyTradeReview') {
        return { entryType: 'DailyTradeReview', trade: request.anchor.ref, reviewDate: request.origin.reviewDate };
      }
      return { entryType: 'PositionChangeReflection', positionChange: request.origin.ref };
    };
    const obligationKey = obligationKeyOf();
    const { value } = await deps.persistence.readSnapshot(['journalDefinitions', 'journalObligations', 'journalEntries', 'journalTypes', 'meta'], async (tx) => {
      // A Daily Trade Review whose key already has an Entry is an edit of that Entry.
      const obligation =
        obligationKey.entryType === 'DailyTradeReview'
          ? ((await tx.get('journalObligations', ['DailyTradeReview', obligationKey.reviewDate, obligationKey.trade])) as { outcome: { id: string } } | undefined)
          : undefined;
      return {
        definitions: (await tx.getAll('journalDefinitions')) as unknown as EntryDefinitionRecord[],
        types: (await tx.getAll('journalTypes')) as unknown as JournalTypeRecord[],
        meta: (await tx.get('meta', 'journal')) as JournalMeta | undefined,
        existing: obligation && ((await tx.get('journalEntries', obligation.outcome.id)) as unknown as StoredEntry | undefined),
      };
    });
    const existing = value.existing;
    // A Daily Trade Review save names the Entry revision it edits, or none when it creates the Entry.
    if (request.obligation === 'DailyTradeReview' && existing?.versions.length !== request.expectedEntryRevision) return { kind: 'Conflict' };
    const snapshot = { journalRevision: value.meta?.journalRevision ?? 0 };
    // The outcome must name the exact current revision the trader was shown.
    // An edit uses the Entry's original definition snapshot, never a later revision.
    const definition = existing
      ? value.definitions.find((d) => d.id === existing.versions[0]!.definitionId)
      : value.definitions.filter((d) => d.entryTypeKey === entryTypeKey).sort((a, b) => b.revisionNumber - a.revisionNumber)[0];
    if (disposition.kind === 'Defer') {
      // The trader is shown no form, so the Debt snapshots the current revision.
      if (!definition) return { kind: 'Rejected', issues: [{ code: 'DefinitionRevisionMismatch' }] };
      return {
        kind: 'Prepared',
        effects: {
          entries: [],
          declines: [],
          debts: [
            {
              entryTypeKey,
              definitionId: definition.id,
              sourceKey,
              obligationKey,
              anchor: request.anchor,
              origin: request.origin as { kind: 'PositionChange'; ref: CandidateRef },
              momentTime: request.momentTime,
              dueAnchor: request.momentTime,
              dueRule: 'OneSessionGrace',
              route: 'JournalOnly',
            },
          ],
        },
        snapshot,
      };
    }
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
            momentTime: existing ? existing.momentTime : request.momentTime,
            authoredTime: existing ? existing.authoredTime : deps.clock.now(),
            ...(existing
              ? { edit: { entryId: existing.id, expectedRevision: existing.versions.length, savedAt: deps.clock.now(), current: existing as unknown as Record<string, unknown> } }
              : {}),
            // A blank optional answer is saved as Unanswered, never as declined.
            responses: responsesOf(definition, form.answers),
          },
        ],
        declines: [],
      },
      snapshot,
    };
    if (request.obligation === 'DailyTradeReview') {
      const [entry] = prepared.effects.entries;
      const saved: StoredEntry = {
        id: '',
        entryTypeKey: entry!.entryTypeKey,
        sourceKey: entry!.sourceKey,
        anchor: { kind: 'Trade', tradeId: entry!.anchor.ref },
        momentTime: entry!.momentTime,
        authoredTime: entry!.authoredTime,
        origin: { kind: entry!.origin.kind, factId: entry!.origin.ref, ...(entry!.origin.kind === 'DailyReview' ? { reviewDate: entry!.origin.reviewDate } : {}) },
        // The Entry as this save leaves it: the versions it was prepared against, then the new one.
        versions: [...(existing?.versions ?? []), { definitionId: entry!.definitionId, responses: entry!.responses }],
      };
      const action = dailyAction(saved, new Map(value.definitions.map((d) => [d.id, d])), new Map(value.types.map((t) => [t.productKey, t.label])));
      return { ...prepared, action };
    }
    if (request.obligation !== 'PlanReflection') return prepared;
    const textFor = (role: 'Thesis' | 'Invalidation') => {
      const prompt = definition.prompts.find((p) => p.kind === 'Text' && p.role === role);
      const answer = prompt ? form.answers[prompt.id] : undefined;
      return answer?.kind === 'Text' ? answer.text : '';
    };
    const semantics: PlanSemantics = { Thesis: textFor('Thesis'), Invalidation: textFor('Invalidation') };
    return { ...prepared, semantics };
  }

  // One range read over the obligation keys of the Review Date finds every Action (D4 A38).
  async function queryActions(reviewDate: string): Promise<ReviewDateActions> {
    const range = IDBKeyRange.bound(['DailyTradeReview', reviewDate, ''], ['DailyTradeReview', reviewDate, '\uffff']);
    const { value } = await deps.persistence.readSnapshot(
      ['journalObligations', 'journalEntries', 'journalDefinitions', 'journalTypes', 'meta'],
      async (tx) => {
        const obligations = (await tx.getAllInRange('journalObligations', range)) as unknown as { obligationKey: string[]; outcome: { id: string } }[];
        return {
          entries: (await Promise.all(obligations.map((o) => tx.get('journalEntries', o.outcome.id)))) as unknown as StoredEntry[],
          definitions: (await tx.getAll('journalDefinitions')) as unknown as EntryDefinitionRecord[],
          types: (await tx.getAll('journalTypes')) as unknown as JournalTypeRecord[],
          meta: (await tx.get('meta', 'journal')) as JournalMeta | undefined,
        };
      },
    );
    const definitions = new Map(value.definitions.map((d) => [d.id, d]));
    const labels = new Map(value.types.map((t) => [t.productKey, t.label]));
    const actions: Record<string, DailyAction> = {};
    for (const entry of value.entries) actions[entry.anchor.tradeId] = dailyAction(entry, definitions, labels);
    return { kind: 'Actions', reviewDate, actions, snapshot: { journalRevision: value.meta?.journalRevision ?? 0 } };
  }

  async function currentOutcome(obligationKey: string): Promise<ObligationOutcome> {
    const { value } = await deps.persistence.readSnapshot(['journalObligations'], (tx) => tx.get('journalObligations', obligationKey));
    return (value as unknown as { outcome: ObligationOutcome }).outcome;
  }

  // Reads the Debt and what its resolution needs, and prepares the Entry that answers it.
  async function prepareResolution(
    command: ResolveDebtCommand,
    sourceKey: string,
  ): Promise<PrepareResolveDebtResult> {
    const { value } = await deps.persistence.readSnapshot(['journalDebts', 'journalObligations', 'journalDefinitions', 'meta'], async (tx) => {
      const debt = (await tx.get('journalDebts', command.debtId)) as unknown as StoredDebt | undefined;
      if (!debt) return undefined;
      return {
        debt,
        obligation: (await tx.get('journalObligations', debt.obligationKey)) as unknown as { outcome: ObligationOutcome },
        definition: (await tx.get('journalDefinitions', debt.definitionId)) as unknown as EntryDefinitionRecord,
        meta: (await tx.get('meta', 'journal')) as JournalMeta | undefined,
      };
    });
    if (!value) return { kind: 'NotFound' };
    const { debt, definition } = value;
    // Only an Outstanding Debt, still at the revision the trader was shown, can be resolved.
    if (debt.versions.at(-1)!.versionId !== command.expectedDebtRevision || value.obligation.outcome.kind !== 'Debt') {
      return { kind: 'Conflict', currentOutcome: value.obligation.outcome };
    }
    const { resolution } = command;
    const outcome = {
      entryTypeKey: debt.entryTypeKey,
      definitionId: debt.definitionId,
      sourceKey,
      obligationKey: { entryType: 'PositionChangeReflection', positionChange: debt.origin.factId } as const,
      anchor: { kind: 'Trade', ref: debt.anchor.tradeId } as const,
      origin: { kind: 'PositionChange', ref: debt.origin.factId } as const,
      momentTime: debt.momentTime,
      authoredTime: deps.clock.now(),
      settledDebtId: debt.debtId,
    };
    const transition = (status: 'Settled' | 'Declined') => ({
      debtId: debt.debtId,
      expectedRevision: command.expectedDebtRevision,
      status,
      savedAt: deps.clock.now(),
      current: debt as unknown as Record<string, unknown>,
    });
    const snapshot = { journalRevision: value.meta?.journalRevision ?? 0 };
    if (resolution.kind === 'Decline') {
      if ([...(resolution.reason ?? '')].length > MAX_DECLINE_REASON) return { kind: 'Rejected', issues: [{ code: 'ReasonTooLong' }] };
      return {
        kind: 'Prepared',
        effects: {
          entries: [],
          declines: [{ ...outcome, ...(resolution.reason === undefined ? {} : { reason: resolution.reason }) }],
          debtResolutions: [transition('Declined')],
        },
        snapshot,
      };
    }
    const { form } = resolution;
    // The answers are validated against the Debt's snapshot revision, never a later one.
    if (form.definitionId !== debt.definitionId) return { kind: 'Rejected', issues: [{ code: 'DefinitionRevisionMismatch' }] };
    const issues = validateForm(definition, form.answers);
    if (issues.length > 0) return { kind: 'Rejected', issues };
    return {
      kind: 'Prepared',
      effects: {
        entries: [
          {
            ...outcome,
            responses: responsesOf(definition, form.answers),
          },
        ],
        declines: [],
        debtResolutions: [transition('Settled')],
      },
      snapshot,
    };
  }

  const journal: Journal = {
    queryActions: ({ reviewDate }) => queryActions(reviewDate),

    async save(command) {
      for (let attempt = 1; ; attempt++) {
        const prepared = await prepareResolution(command, 'source.trade-detail');
        if (prepared.kind !== 'Prepared') return prepared;
        const tx = beginSemanticTransaction();
        const staged = journal.applyPreparedEffects(tx, prepared, {});
        const { checks, writes } = tx.close();
        const committed = await deps.persistence.commit({ checks: [...checks, journalUnchanged(prepared.snapshot.journalRevision)], writes });
        if (committed.kind === 'RuntimeNotWritable') return committed;
        if (committed.kind !== 'Committed') {
          // Only the shared Journal counter moved: read, validate, and prepare afresh (ADR 0011).
          if (committed.kind === 'Conflict' && committed.binding.startsWith('journal@') && attempt < MAX_ATTEMPTS) continue;
          return { kind: 'Conflict', currentOutcome: await currentOutcome(prepared.effects.debtResolutions![0]!.current['obligationKey'] as string) };
        }
        const [entry] = staged.entries;
        const [decline] = staged.declines;
        const outcome = (entry ?? decline)!;
        return {
          kind: 'Saved',
          ...(entry && { entry }),
          ...(decline && { decline }),
          debt: staged.debts![0]!,
          currentOutcome: { kind: entry ? 'Entry' : 'Decline', id: outcome.id },
          snapshot: { journalRevision: prepared.snapshot.journalRevision + 1 },
        };
      }
    },

    query: (async (query: JournalQuery) => {
      if (query.scope === 'OutstandingDebt') {
        const { value } = await deps.persistence.readSnapshot(['journalDebts', 'meta'], async (tx) => ({
          // Only Outstanding Debt is indexed (A62): the full range is every one, already in order.
          debts: (await tx.getAllFromIndex('journalDebts', 'byOutstandingDue', IDBKeyRange.bound(['', ''], [HIGH_KEY, HIGH_KEY]))) as unknown as StoredDebt[],
          meta: (await tx.get('meta', 'journal')) as JournalMeta | undefined,
        }));
        return { kind: 'Debts', debts: value.debts.map(debtProjection), snapshot: { journalRevision: value.meta?.journalRevision ?? 0 } };
      }
      const { value } = await deps.persistence.readSnapshot(
        ['journalEntries', 'journalDeclines', 'journalDebts', 'journalDefinitions', 'journalTypes', 'meta'],
        async (tx) => ({
          entries: (await tx.getAllFromIndex('journalEntries', 'byAnchorTrade', query.tradeId)) as unknown as StoredEntry[],
          declines: (await tx.getAllFromIndex('journalDeclines', 'byAnchorTrade', query.tradeId)) as unknown as StoredDecline[],
          debts: (await tx.getAllFromIndex('journalDebts', 'byAnchorTrade', query.tradeId)) as unknown as StoredDebt[],
          definitions: (await tx.getAll('journalDefinitions')) as unknown as EntryDefinitionRecord[],
          types: (await tx.getAll('journalTypes')) as unknown as JournalTypeRecord[],
          meta: (await tx.get('meta', 'journal')) as JournalMeta | undefined,
        }),
      );
      const definitions = new Map(value.definitions.map((d) => [d.id, d]));
      const labels = new Map(value.types.map((t) => [t.productKey, t.label]));
      const label = (key: string) => labels.get(key) ?? key;
      const debts = new Map(value.debts.map((d) => [d.debtId, d]));
      // A settled Debt shows once, inside the Entry or decline that settled it.
      const settledMark = (debtId: string | undefined) => {
        const debt = debtId === undefined ? undefined : debts.get(debtId);
        return debt && { debtId: debt.debtId, dueAnchor: debt.dueAnchor };
      };
      const declinedLater = Object.fromEntries(value.declines.map((decline) => [decline.id, settledMark(decline.settledDebtId)]));
      const items: TradeNarrativeItem[] = [
        ...value.entries.map((entry): TradeNarrativeItem => {
          const answeredLater = settledMark(entry.settledDebtId);
          return { kind: 'Entry', ...narrativeEntry(entry, definitions, labels), ...(answeredLater && { answeredLater }) };
        }),
        ...value.debts
          .filter((debt) => debt.versions.at(-1)!.status === 'Outstanding')
          .map(
            (debt): TradeNarrativeItem => ({
              kind: 'Debt',
              id: debt.debtId,
              entryType: label(debt.entryTypeKey),
              source: label(debt.sourceKey),
              anchor: debt.anchor,
              momentTime: debt.momentTime,
              positionChangeId: debt.origin.factId,
              definitionId: debt.definitionId,
              dueAnchor: debt.dueAnchor,
              revision: debt.versions.at(-1)!.versionId,
            }),
          ),
        ...value.declines.map(
          (decline): TradeNarrativeItem => ({
            kind: 'Decline',
            id: decline.id,
            entryType: label(decline.entryTypeKey),
            source: label(decline.sourceKey),
            anchor: decline.anchor,
            momentTime: decline.momentTime,
            authoredTime: decline.authoredTime,
            ...(decline.origin.kind === 'PositionChange' ? { positionChangeId: decline.origin.factId } : {}),
            ...(decline.reason === undefined ? {} : { reason: decline.reason }),
            ...(declinedLater[decline.id] && { declinedLater: declinedLater[decline.id] }),
          }),
        ),
      ];
      items.sort((a, b) =>
        a.momentTime !== b.momentTime ? (a.momentTime < b.momentTime ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
      );
      return { kind: 'Page', items, snapshot: { journalRevision: value.meta?.journalRevision ?? 0 } };
    }) as unknown as Journal['query'],

    applyPreparedEffects(tx, prepared, mapping) {
      requireOpen(tx);
      // Trade Record's exact durable mapping; a reference it does not list is already durable.
      const durable = (ref: CandidateRef) => mapping[ref] ?? ref;
      // A Daily Trade Review key is an array so one range read finds a Review Date's Actions (D4 A38).
      const keyOf = (key: JournalObligationKey): string | string[] => {
        if (key.entryType === 'DailyTradeReview') return ['DailyTradeReview', key.reviewDate, durable(key.trade)];
        if (key.entryType === 'PlanReflection') return `PlanReflection:${durable(key.trade)}`;
        return `PositionChangeReflection:${durable(key.positionChange)}`;
      };
      // Each outcome is staged with its obligation record; `add` fails the whole transaction when
      // the key already has an outcome (D2 A28).
      const stageObligation = (obligationKey: string | string[], outcome: { kind: 'Entry' | 'Decline' | 'Debt'; id: string }) =>
        tx.stage({ op: 'add', store: 'journalObligations', value: { obligationKey, outcome } });
      // A resolution moves the key's outcome from its Outstanding Debt, which the commit rechecks (A62).
      const moveObligation = (obligationKey: string | string[], debtId: string, outcome: { kind: 'Entry' | 'Decline'; id: string }) => {
        tx.require({
          name: `obligation@${String(obligationKey)}:${debtId}`,
          store: 'journalObligations',
          key: obligationKey,
          verify: (stored) => (stored?.['outcome'] as { kind: string; id: string } | undefined)?.id === debtId,
        });
        tx.stage({ op: 'put', store: 'journalObligations', value: { obligationKey, outcome } });
      };
      // An edit appends a version to the same Entry identity; the version count it was prepared
      // against is rechecked inside the commit.
      const stageEdit = (entry: PreparedEntry, edit: PreparedEntryEdit): EntryProjection => {
        const current = edit.current as unknown as StoredEntry;
        const version = { versionNumber: edit.expectedRevision + 1, definitionId: entry.definitionId, responses: entry.responses, savedAt: edit.savedAt };
        tx.require({
          name: `entry@${edit.entryId}:${edit.expectedRevision}`,
          store: 'journalEntries',
          key: edit.entryId,
          verify: (stored) => ((stored?.['versions'] as unknown[] | undefined)?.length ?? 0) === edit.expectedRevision,
        });
        tx.stage({ op: 'put', store: 'journalEntries', value: { ...edit.current, versions: [...current.versions, version] } });
        return {
          id: current.id,
          entryTypeKey: current.entryTypeKey,
          sourceKey: current.sourceKey,
          anchor: current.anchor,
          origin: current.origin as EntryProjection['origin'],
          momentTime: current.momentTime,
          authoredTime: current.authoredTime,
          definitionId: entry.definitionId,
          responses: entry.responses,
        };
      };
      const entries = prepared.effects.entries.map((entry): EntryProjection => {
        if (entry.edit) return stageEdit(entry, entry.edit);
        const projection: EntryProjection = {
          id: deps.ids.next(),
          entryTypeKey: entry.entryTypeKey,
          sourceKey: entry.sourceKey,
          anchor: { kind: 'Trade', tradeId: durable(entry.anchor.ref) },
          origin: { kind: entry.origin.kind, factId: durable(entry.origin.ref), ...(entry.origin.kind === 'DailyReview' ? { reviewDate: entry.origin.reviewDate } : {}) },
          momentTime: entry.momentTime,
          authoredTime: entry.authoredTime,
          definitionId: entry.definitionId,
          responses: entry.responses,
          ...(entry.settledDebtId === undefined ? {} : { settledDebtId: entry.settledDebtId }),
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
        if (entry.settledDebtId === undefined) stageObligation(obligationKey, { kind: 'Entry', id: projection.id });
        else moveObligation(obligationKey, entry.settledDebtId, { kind: 'Entry', id: projection.id });
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
          ...(decline.settledDebtId === undefined ? {} : { settledDebtId: decline.settledDebtId }),
        };
        const obligationKey = keyOf(decline.obligationKey);
        tx.stage({ op: 'add', store: 'journalDeclines', value: { ...projection, obligationKey, anchorTradeId: projection.anchor.tradeId } });
        if (decline.settledDebtId === undefined) stageObligation(obligationKey, { kind: 'Decline', id: projection.id });
        else moveObligation(obligationKey, decline.settledDebtId, { kind: 'Decline', id: projection.id });
        return projection;
      });
      const debts = (prepared.effects.debts ?? []).map((debt): DebtProjection => {
        const projection: DebtProjection = {
          debtId: deps.ids.next(),
          obligationKey: keyOf(debt.obligationKey) as string,
          entryTypeKey: debt.entryTypeKey,
          sourceKey: debt.sourceKey,
          definitionId: debt.definitionId,
          anchor: { kind: 'Trade', tradeId: durable(debt.anchor.ref) },
          origin: { kind: 'PositionChange', factId: durable(debt.origin.ref) },
          momentTime: debt.momentTime,
          dueAnchor: debt.dueAnchor,
          dueRule: debt.dueRule,
          route: debt.route,
          status: 'Outstanding',
          // The Debt's revision is its last version identity (A61).
          revision: deps.ids.next(),
        };
        const { status, revision, ...identity } = projection;
        tx.stage({
          op: 'add',
          store: 'journalDebts',
          value: {
            ...identity,
            // Private fields (A62), set here so the indexes find the Debt before any rebuild.
            anchorTradeId: projection.anchor.tradeId,
            outstandingDue: debt.dueAnchor,
            versions: [{ versionId: revision, status, savedAt: deps.clock.now() }],
          },
        });
        stageObligation(projection.obligationKey, { kind: 'Debt', id: projection.debtId });
        return projection;
      });
      // A Debt transition appends a version linking the outcome and leaves byOutstandingDue (A62);
      // the commit rechecks the revision it was prepared against.
      const resolved = (prepared.effects.debtResolutions ?? []).map((resolution): DebtProjection => {
        const current = resolution.current as unknown as StoredDebt;
        // The private due field is removed, so the Debt leaves byOutstandingDue.
        const rest = Object.fromEntries(Object.entries(current).filter(([field]) => field !== 'outstandingDue'));
        // The outcome is the Entry or decline carrying this Debt's identity (A64); the projections
        // keep the order of the prepared records.
        const entryAt = prepared.effects.entries.findIndex((entry) => entry.settledDebtId === resolution.debtId);
        const link = entryAt >= 0
          ? { entryId: entries[entryAt]!.id }
          : { declineId: declines[prepared.effects.declines.findIndex((decline) => decline.settledDebtId === resolution.debtId)]!.id };
        const version = { versionId: deps.ids.next(), status: resolution.status, ...link, savedAt: resolution.savedAt };
        tx.require({
          name: `debt@${resolution.debtId}:${resolution.expectedRevision}`,
          store: 'journalDebts',
          key: resolution.debtId,
          verify: (stored) => (stored?.['versions'] as StoredDebt['versions'] | undefined)?.at(-1)?.versionId === resolution.expectedRevision,
        });
        tx.stage({ op: 'put', store: 'journalDebts', value: { ...rest, versions: [...current.versions, version] } });
        return {
          debtId: current.debtId,
          obligationKey: current.obligationKey,
          entryTypeKey: current.entryTypeKey,
          sourceKey: current.sourceKey,
          definitionId: current.definitionId,
          anchor: current.anchor,
          origin: current.origin,
          momentTime: current.momentTime,
          dueAnchor: current.dueAnchor,
          dueRule: current.dueRule,
          route: current.route,
          status: resolution.status,
          revision: version.versionId,
          ...link,
        };
      });
      debts.push(...resolved);
      tx.stage({ op: 'put', store: 'meta', value: { key: 'journal', journalRevision: prepared.snapshot.journalRevision + 1 } });
      return { kind: 'Staged', entries, declines, ...(debts.length > 0 && { debts }), ...(prepared.action && { action: { ...prepared.action, id: entries[0]!.id } }) };
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
  return journal;
}
