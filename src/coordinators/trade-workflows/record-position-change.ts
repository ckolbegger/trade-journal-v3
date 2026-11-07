import type { RuntimeNotWritable } from '../../delivery/runtime-not-writable.ts';
import { instrumentKey, type OptionInstrument, type StockInstrument } from '../../domain/instrument/index.ts';
import type { Instant } from '../../domain/time/index.ts';
import type { StorageFailure } from '../mutation-guard.ts';
import {
  derive,
  type DerivedTradeState,
  type CloseRequirement,
  type DeviationAction,
  type EntryQuality,
  type IncoherentFacts,
  type IntegrityFinding,
  type LotMatch,
  type RecordedDeviation,
  type RecordedDeviationVersion,
} from '../../domain/trade-analysis/index.ts';
import { parseDecimal, Rational } from '../../domain/values/index.ts';
import type { DebtProjection, DeclineProjection, EntryProjection, JournalIssue, ReflectionDisposition } from '../../modules/journal/index.ts';
import type { TradeFact } from '../../modules/trade-record/index.ts';
import { beginSemanticTransaction, type WorkspaceSnapshotBinding } from '../../persistence/index.ts';
import { retryCounterConflict } from './counter-retry.ts';
import type { TradeMutationSuccess, TradeWorkflowsDeps, WorkflowIssue } from './types.ts';

// One member of a Position Change in the full spec form (D2 A18): the Trade that owns it, its
// action, Instrument, Planned-Leg intent, quantity, price, fee, and its own Economic Time.
export interface PositionChangeMember {
  readonly kind: 'Execution';
  readonly tradeId: string;
  readonly action: 'Buy' | 'Sell';
  readonly instrument: StockInstrument | OptionInstrument;
  readonly intent: { readonly kind: 'ServesPlannedLeg'; readonly plannedLegId: string } | { readonly kind: 'ExplicitlyUnplanned' };
  readonly quantity: string;
  readonly price: string;
  readonly fee?: string;
  readonly economicTime: Instant;
}

// The one settlement member of an Expiration Position Change (D7 A106): the option Instrument, the
// quantity, and the settlement time as its Economic Time. It has no price, fee, or agency.
export interface ExpirationMember {
  readonly kind: 'Expiration';
  readonly tradeId: string;
  readonly instrument: StockInstrument | OptionInstrument;
  readonly quantity: string;
  readonly economicTime: Instant;
}

// One decision: the Trades it affects, each against the FactRevision the form was loaded at, its
// members, and the one Position Change Reflection disposition, anchored to the originating Trade.
export interface PositionChangeCommand {
  readonly originTradeId: string;
  readonly trades: readonly { readonly tradeId: string; readonly expectedFactRevision: number }[];
  readonly members: readonly (PositionChangeMember | ExpirationMember)[];
  readonly reflection: ReflectionDisposition;
  // Supplied exactly when the change closes the Trade (D6 A77): the Catalog identity of its one
  // Close Reason and the disposition of the Close Review, which is separate from `reflection`.
  readonly closeReasonId?: string;
  readonly closeReview?: ReflectionDisposition;
}

type ReflectionOutcome =
  | { readonly kind: 'Entry'; readonly entry: EntryProjection }
  | { readonly kind: 'Decline'; readonly decline: DeclineProjection }
  | { readonly kind: 'Debt'; readonly debt: DebtProjection };

// The one Position Change Reflection outcome, and for a terminal change the Close Review outcome:
// each one's identity in the receipt, its projection after commit.
export type PositionChangeSuccess = TradeMutationSuccess<
  {
    // A Defer names the Outstanding Debt it created instead of an Entry or decline (D5 A66).
    readonly reflection: { readonly kind: 'Entry' | 'Decline' | 'Debt'; readonly id: string };
    // Present only when the change closed the Trade.
    readonly closeReview?: { readonly kind: 'Entry' | 'Decline' | 'Debt'; readonly id: string };
    // What the commit did to each recorded Deviation occurrence, by fingerprint (D2 A26).
    readonly deviationReconciliation: readonly DeviationReconciliationItem[];
    // Disclosed when the change, typically an earlier-dated one, moved a resolved entry (P5).
    readonly entryChanges: readonly EntryChange[];
    // Before-state disagreements with coherent facts that this commit repaired (P7).
    readonly repairs: readonly IntegrityFinding[];
    // The derived Lot Matches the change created, revised, or superseded, and the realized P&L
    // before and after (P23). Nothing is stored: both sides are derivations of the effective facts.
    readonly lotMatchChanges: readonly LotMatchChange[];
    readonly realizedToDate: { readonly before: Rational; readonly after: Rational };
  },
  {
    readonly reflection: ReflectionOutcome;
    // Present only when the change closed the Trade.
    readonly closeReview?: ReflectionOutcome;
  }
>;

// Selects the one outcome the commit produced, and the identity the receipt names for it.
function reflectionOutcome(journal: {
  readonly entries: readonly EntryProjection[];
  readonly declines: readonly DeclineProjection[];
  readonly debts?: readonly DebtProjection[];
}): { outcome: ReflectionOutcome; ref: PositionChangeSuccess['receipt']['reflection'] } {
  const [entry] = journal.entries;
  if (entry) return { outcome: { kind: 'Entry', entry }, ref: { kind: 'Entry', id: entry.id } };
  const [decline] = journal.declines;
  if (decline) return { outcome: { kind: 'Decline', decline }, ref: { kind: 'Decline', id: decline.id } };
  const [debt] = journal.debts ?? [];
  if (!debt) throw new Error('no reflection outcome');
  return { outcome: { kind: 'Debt', debt }, ref: { kind: 'Debt', id: debt.debtId } };
}

export type PositionChangeResult =
  | ({ readonly kind: 'Recorded' } & PositionChangeSuccess)
  // The command needs an operation variant this release does not install (D2 A18); nothing was written.
  | { readonly kind: 'VariantNotInstalled'; readonly variants: readonly UninstalledVariant[] }
  // Every issue from the command and the Journal together; nothing was written.
  | { readonly kind: 'Rejected'; readonly issues: readonly WorkflowIssue[]; readonly binding: WorkspaceSnapshotBinding }
  // The Trade changed after the form was loaded; nothing was written.
  | { readonly kind: 'Conflict'; readonly changed: readonly string[] }
  // The Trade's facts cannot be replayed, so no repair can be derived; nothing was written (P7).
  | { readonly kind: 'IntegrityDisagreement'; readonly tradeId: string; readonly findings: IncoherentFacts['findings'] }
  | RuntimeNotWritable
  | StorageFailure;

export interface DeviationReconciliationItem {
  readonly action: DeviationAction['kind'];
  readonly occurrenceId: string;
  // The occurrence's latest version after the commit.
  readonly version: RecordedDeviationVersion;
}

export type EntryChange =
  | { readonly kind: 'EntryResolutionMoved'; readonly from: string; readonly to: string }
  | { readonly kind: 'EntryQualityChanged'; readonly from: EntryQuality; readonly to: EntryQuality };

// One derived FIFO match whose matched quantity differs between the before and after derivations,
// identified by its opening and disposing Executions (A78). A quantity is null on the side where
// the match does not exist.
export interface LotMatchChange {
  readonly kind: 'Created' | 'Revised' | 'Superseded';
  readonly openingExecutionId: string;
  readonly disposingExecutionId: string;
  readonly quantity: { readonly before: Rational | null; readonly after: Rational | null };
}

// Matches the change removed come first, in their earlier order; then the ones it created or
// revised, in their new order.
function lotMatchChangesOf(before: DerivedTradeState, after: DerivedTradeState): LotMatchChange[] {
  const identity = (m: LotMatch) => `${m.openingExecutionId}|${m.disposingExecutionId}`;
  const earlier = new Map(before.lotMatches.map((m) => [identity(m), m]));
  const later = new Set(after.lotMatches.map(identity));
  const superseded = before.lotMatches
    .filter((m) => !later.has(identity(m)))
    .map((m): LotMatchChange => ({ kind: 'Superseded', openingExecutionId: m.openingExecutionId, disposingExecutionId: m.disposingExecutionId, quantity: { before: m.quantity, after: null } }));
  const current = after.lotMatches.flatMap((m): LotMatchChange[] => {
    const was = earlier.get(identity(m));
    if (was?.quantity.equals(m.quantity)) return [];
    return [
      {
        kind: was ? 'Revised' : 'Created',
        openingExecutionId: m.openingExecutionId,
        disposingExecutionId: m.disposingExecutionId,
        quantity: { before: was?.quantity ?? null, after: m.quantity },
      },
    ];
  });
  return [...superseded, ...current];
}

// Exact comparison of two Entry Quality results: Rationals are always reduced, so equal values
// have equal numerators and denominators.
const exact = (quality: EntryQuality) =>
  JSON.stringify(quality, (_, v: unknown) => (v instanceof Rational ? `${v.numerator}/${v.denominator}` : v));
const sameQuality = (a: EntryQuality, b: EntryQuality) => exact(a) === exact(b);

// Compares the entry before the change with the entry after it, once the entry had resolved.
function entryChangesOf(before: DerivedTradeState, after: DerivedTradeState): EntryChange[] {
  if (before.entryResolution.kind !== 'Resolved') return [];
  const changes: EntryChange[] = [];
  const to = after.entryResolution.kind === 'Resolved' ? after.entryResolution.positionChangeId : null;
  if (to && to !== before.entryResolution.positionChangeId) {
    changes.push({ kind: 'EntryResolutionMoved', from: before.entryResolution.positionChangeId, to });
  }
  if (!sameQuality(before.entryQuality, after.entryQuality)) {
    changes.push({ kind: 'EntryQualityChanged', from: before.entryQuality, to: after.entryQuality });
  }
  return changes;
}

// A Position Change mixing Buys and Sells (A76), other Instruments and ExplicitlyUnplanned intent
// (D10), and Position Changes across several Trades (D20, D21) are not installed.
// An Expiration shares its Position Change with no other member (D7 A106).
export type UninstalledVariant = 'MixedActions' | 'OtherInstrument' | 'ExplicitlyUnplanned' | 'MultipleTrades' | 'MixedMembers';

const isExecution = (m: PositionChangeMember | ExpirationMember): m is PositionChangeMember => m.kind === 'Execution';

// The installed variant (D2 A18, D6 A76, D7 A102): Buys or Sells of a Stock or an option contract
// serving a Planned Leg, every member in the one Trade, all sharing one action.
type InstalledMember = PositionChangeMember & {
  readonly intent: { readonly kind: 'ServesPlannedLeg' };
};

function uninstalledVariants(command: PositionChangeCommand): UninstalledVariant[] {
  const variants = new Set<UninstalledVariant>();
  const origin = command.originTradeId;
  if (command.trades.some((t) => t.tradeId !== origin) || command.members.some((m) => m.tradeId !== origin)) variants.add('MultipleTrades');
  const executions = command.members.filter(isExecution);
  if (executions.length < command.members.length && command.members.length > 1) variants.add('MixedMembers');
  if (new Set(executions.map((m) => m.action)).size > 1) variants.add('MixedActions');
  for (const member of executions) {
    if (member.intent.kind !== 'ServesPlannedLeg') variants.add('ExplicitlyUnplanned');
  }
  return [...variants];
}

const installed = (members: readonly PositionChangeMember[]): members is readonly InstalledMember[] =>
  members.every((m) => m.intent.kind === 'ServesPlannedLeg');

// At most 20 Executions per Position Change (D2 A18).
const MAX_EXECUTIONS = 20;

// A decimal with more than 6 fractional digits, which D1 A9 does not accept.
const TOO_PRECISE = /^-?\d+\.\d{7,}$/;

// The issue with one decimal value, if any: quantity and price are positive, a fee is 0 or more.
function decimalIssue(text: string | undefined, positive: boolean): string | null {
  if (text === undefined || text.trim() === '') return 'Required';
  if (TOO_PRECISE.test(text)) return 'TooManyFractionalDigits';
  const parsed = parseDecimal(text, { positive });
  if (!parsed.ok) return parsed.reason;
  return parsed.value.compare(Rational.of(0n)) < 0 ? 'Negative' : null;
}

// Issues with one member's own values: quantity and price positive, a required fee of 0 or more,
// and an Economic Time from the Plan's up to now (D2 A18, A19, decision 20).
function memberIssues(member: PositionChangeMember | ExpirationMember, index: number, planTime: Instant, now: Instant): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  const issue = (field: string, code: string) => issues.push({ source: 'TradeWorkflows', member: index, field, code });
  // An Expiration has a quantity and a time only; it has no price or fee (A106).
  for (const [field, text, positive] of isExecution(member)
    ? ([
        ['quantity', member.quantity, true],
        ['price', member.price, true],
        ['fee', member.fee, false],
      ] as const)
    : ([['quantity', member.quantity, true]] as const)) {
    const code = decimalIssue(text, positive);
    if (code) issue(field, code);
  }
  const time = Date.parse(member.economicTime);
  if (time < Date.parse(planTime)) issue('economicTime', 'EconomicTimeBeforePlan');
  if (time > Date.parse(now)) issue('economicTime', 'EconomicTimeInFuture');
  return issues;
}

// A Journal issue is told apart by its Prompt; one with none names the command field of the form
// it belongs to, when the caller gives one, since two forms can be submitted together.
function journalIssues(issues: readonly JournalIssue[], form?: string): WorkflowIssue[] {
  return issues.map((issue) => {
    const field = issue.promptId ?? form;
    return { source: 'Journal', ...(field !== undefined && { field }), code: issue.code };
  });
}

// A terminal change by a trader requires one Close Reason and a Close Review disposition; any
// other change takes neither (A77). A terminal Expiration has no agency, so it takes a Close Review
// disposition but no Close Reason (A107).
function closeRequirementIssues(command: PositionChangeCommand, requirement: CloseRequirement): WorkflowIssue[] {
  const issue = (field: string, code: string): WorkflowIssue => ({ source: 'TradeWorkflows', field, code });
  if (requirement === 'TerminalWithoutAgency') {
    return [
      ...(command.closeReasonId === undefined ? [] : [issue('closeReasonId', 'CloseReasonNotApplicable')]),
      ...(command.closeReview === undefined ? [issue('closeReview', 'CloseReviewDispositionRequired')] : []),
    ];
  }
  if (requirement === 'TerminalWithAgency') {
    return [
      ...(command.closeReasonId === undefined ? [issue('closeReasonId', 'CloseReasonRequired')] : []),
      ...(command.closeReview === undefined ? [issue('closeReview', 'CloseReviewDispositionRequired')] : []),
    ];
  }
  return [
    ...(command.closeReasonId === undefined ? [] : [issue('closeReasonId', 'CloseReasonNotApplicable')]),
    ...(command.closeReview === undefined ? [] : [issue('closeReview', 'CloseReviewNotApplicable')]),
  ];
}

// P22: findings that are only about the position path are the change's own fault and come back as
// typed issues; any other incoherence is the Trade's facts, not this command (P7). An Expiration that
// settles the wrong quantity, at an invalid time, or on a stock is the change's own fault too (A106).
const OWN_FINDINGS = {
  ExceedsOpenQuantity: 'quantity',
  FlatBeforeLaterFacts: 'quantity',
  ExpirationMustSettleAllOpen: 'quantity',
  SettlementTimeInvalid: 'economicTime',
  NotAnOption: 'instrument',
} as const;

function positionPathIssues(findings: IncoherentFacts['findings'], memberIds: readonly string[]): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  for (const finding of findings) {
    if (!(finding.reason in OWN_FINDINGS)) return [];
    const member = memberIds.indexOf(finding.factId);
    issues.push({
      source: 'TradeAnalysis',
      // A recorded Sell the new change would leave short is named by its identity.
      ...(member >= 0 ? { member, field: OWN_FINDINGS[finding.reason as keyof typeof OWN_FINDINGS] } : { factId: finding.factId }),
      code: finding.reason,
      ...((finding.reason === 'ExceedsOpenQuantity' || finding.reason === 'ExpirationMustSettleAllOpen') && { available: finding.available }),
    });
  }
  return issues;
}

const earliest = (times: readonly Instant[]): Instant | undefined => [...times].sort((a, b) => Date.parse(a) - Date.parse(b))[0];

// Each Deviation action with the occurrence it acted on, as committed. A created occurrence is found
// by its fingerprint, whose Position Change the commit mapped to its durable identity.
function reconciliationOf(
  actions: readonly DeviationAction[],
  recorded: readonly RecordedDeviation[],
  mapping: Readonly<Record<string, string>>,
): DeviationReconciliationItem[] {
  return actions.map((action) => {
    const occurrence =
      action.kind === 'Create'
        ? recorded.find((d) => {
            const { fingerprint } = d.versions.at(-1)!;
            const expected = action.occurrence.fingerprint;
            return (
              fingerprint.plannedLegId === expected.plannedLegId &&
              fingerprint.positionChangeId === (expected.positionChangeId && (mapping[expected.positionChangeId] ?? expected.positionChangeId))
            );
          })!
        : recorded.find((d) => d.occurrenceId === action.occurrenceId)!;
    return { action: action.kind, occurrenceId: occurrence.occurrenceId, version: occurrence.versions.at(-1)! };
  });
}

// A rejection names the Workspace snapshot the command was judged against; it never changes it.
async function rejected(deps: TradeWorkflowsDeps, issues: readonly WorkflowIssue[]): Promise<PositionChangeResult> {
  const { binding } = await deps.persistence.readSnapshot(['meta'], () => Promise.resolve(null));
  return { kind: 'Rejected', issues, binding };
}

export function recordPositionChange(deps: TradeWorkflowsDeps, command: PositionChangeCommand): Promise<PositionChangeResult> {
  return retryCounterConflict(() => attemptPositionChange(deps, command));
}

async function attemptPositionChange(deps: TradeWorkflowsDeps, command: PositionChangeCommand): Promise<PositionChangeResult> {
  const variants = uninstalledVariants(command);
  const executionMembers: readonly PositionChangeMember[] = command.members.filter(isExecution);
  const expirationMember = command.members.find((m): m is ExpirationMember => m.kind === 'Expiration');
  if (variants.length > 0 || !installed(executionMembers)) return { kind: 'VariantNotInstalled', variants };
  const tradeId = command.originTradeId;
  const prepared = await deps.tradeRecord.prepareChange({
    kind: 'PositionChange',
    tradeId,
    expectedFactRevision: command.trades[0]!.expectedFactRevision,
    executions: executionMembers.map((m) => ({
      action: m.action,
      instrument: m.instrument,
      intent: { kind: m.intent.kind, plannedLegId: m.intent.plannedLegId },
      quantity: m.quantity,
      price: m.price,
      fee: m.fee ?? '',
      economicTime: m.economicTime,
    })),
    ...(expirationMember && { expiration: { economicTime: expirationMember.economicTime, instrument: expirationMember.instrument, quantity: expirationMember.quantity } }),
    // Carried by the candidate; analysis then rejects it unless the change proves terminal.
    ...(command.closeReasonId !== undefined && { closeReasonId: command.closeReasonId }),
  });
  // The same binding name the commit-time recheck of the Trade's FactRevision reports.
  if (prepared.kind === 'Conflict') return { kind: 'Conflict', changed: [`trade:${prepared.tradeId}`] };
  if (prepared.kind !== 'Prepared') throw new Error(prepared.kind);
  // New exposure needs a new Plan, and a missed fill waits for correction or Rebuild (P22).
  // A stored lifecycle that disagrees with flat, Closed facts stays visible until repair, so the facts count too (A96).
  const beforeDerived = derive({ record: prepared.beforeAnalysisInput! });
  if (prepared.before!.lifecycle === 'Closed' || (beforeDerived.kind === 'Derived' && beforeDerived.expectedLifecycle === 'Closed')) return rejected(deps, [{ source: 'TradeWorkflows', code: 'TradeClosed' }]);
  // Another Instrument than the served Planned Leg's is Planned-Leg Terms, not installed until D10.
  const legs = prepared.beforeAnalysisInput!.plan.legs;
  const legKey = (m: InstalledMember) => {
    const leg = legs.find((l) => l.factId === m.intent.plannedLegId);
    return leg && instrumentKey(leg.instrument);
  };
  // An Expiration names the contract held (A106), which is a Planned Leg's, so it is held to the same rule.
  // A non-option instrument stays analysis's NotAnOption.
  const otherExpiration = expirationMember !== undefined && expirationMember.instrument.kind === 'Option' && !legs.some((l) => instrumentKey(l.instrument) === instrumentKey(expirationMember.instrument));
  if (otherExpiration || executionMembers.some((m) => instrumentKey(m.instrument) !== legKey(m))) {
    return { kind: 'VariantNotInstalled', variants: ['OtherInstrument'] };
  }
  // The candidate Position Change the Journal outcome's origin names until apply maps it.
  const positionChange = prepared.candidate.facts
    .slice(prepared.before?.facts.length)
    .find((f): f is Extract<TradeFact, { kind: 'PositionChange' }> => f.kind === 'PositionChange')!;
  // Both reflections' moment is the Position Change's Economic Time, its earliest member's (D2 A19,
  // D6 A86); a command with no members is rejected below, and its form is still validated.
  const momentTime = earliest(command.members.map((m) => m.economicTime)) ?? prepared.before!.planTime;
  const reflection = await deps.journal.prepareEffects({
    obligation: 'PositionChangeReflection',
    disposition: command.reflection,
    anchor: { kind: 'Trade', ref: tradeId },
    origin: { kind: 'PositionChange', ref: positionChange.factId },
    momentTime,
  });
  const issues: WorkflowIssue[] = [
    ...(command.members.length === 0 ? [{ source: 'TradeWorkflows', field: 'members', code: 'NoExecutions' } as const] : []),
    ...(command.members.length > MAX_EXECUTIONS ? [{ source: 'TradeWorkflows', field: 'members', code: 'TooManyExecutions' } as const] : []),
    ...command.members.flatMap((m, i) => memberIssues(m, i, prepared.before!.planTime, deps.clock.now())),
  ];
  if (reflection.kind === 'Rejected') issues.push(...journalIssues(reflection.issues));
  // Values that do not parse cannot be replayed, so the candidate is analysed only when every member is valid.
  const candidateDerived = issues.some((i) => i.source === 'TradeWorkflows')
    ? undefined
    : derive({ record: prepared.analysisInput, candidate: { digest: prepared.digest, before: prepared.beforeAnalysisInput! } });
  // Findings the stored Trade already has are its facts, not this change's fault (P7), so they stay an
  // IntegrityDisagreement; the change's own path findings are the candidate's only when the before-state is coherent.
  const storedDerived = candidateDerived?.kind === 'IncoherentFacts' ? derive({ record: prepared.beforeAnalysisInput! }) : undefined;
  const storedIncoherent = storedDerived?.kind === 'IncoherentFacts';
  const derived = storedIncoherent ? storedDerived : candidateDerived;
  if (derived?.kind === 'IncoherentFacts' && !storedIncoherent) {
    issues.push(...positionPathIssues(derived.findings, positionChange.versions[0]!.value.memberIds));
  }
  const closeRequirement = derived?.kind === 'Derived' ? derived.reconciliation?.closeRequirement : undefined;
  if (closeRequirement) issues.push(...closeRequirementIssues(command, closeRequirement));
  // Every terminal change owes a Close Review, with or without agency (A107).
  const terminal = closeRequirement === 'TerminalWithAgency' || closeRequirement === 'TerminalWithoutAgency';
  // The Close Reason must be a selectable record of its own family (A77).
  if (closeRequirement === 'TerminalWithAgency' && command.closeReasonId !== undefined) {
    const resolution = await deps.catalog.resolve([{ name: 'closeReasonId', kind: 'CloseReason', id: command.closeReasonId, mode: 'NewSelection' }]);
    if (resolution.kind === 'Unresolved') {
      for (const issue of resolution.issues) issues.push({ source: 'ReferenceCatalog', field: issue.name, code: issue.code });
    }
  }
  const closeReview =
    terminal && command.closeReview
      ? await deps.journal.prepareEffects({
          obligation: 'CloseReview',
          disposition: command.closeReview,
          anchor: { kind: 'Trade', ref: tradeId },
          origin: { kind: 'PositionChange', ref: positionChange.factId },
          momentTime,
        })
      : undefined;
  if (closeReview?.kind === 'Rejected') issues.push(...journalIssues(closeReview.issues, 'closeReview'));
  if (issues.length > 0 || !derived || reflection.kind !== 'Prepared' || closeReview?.kind === 'Rejected') {
    return rejected(deps, issues);
  }
  if (derived.kind === 'IncoherentFacts') return { kind: 'IntegrityDisagreement', tradeId, findings: derived.findings };
  if (!derived.reconciliation) throw new Error('no reconciliation');
  const tx = beginSemanticTransaction();
  const staged = deps.tradeRecord.applyPreparedChange(tx, prepared, derived.reconciliation);
  if (staged.kind !== 'Staged') throw new Error('mismatch');
  const journal = deps.journal.applyPreparedEffects(tx, reflection, staged.mapping);
  const closeJournal = closeReview?.kind === 'Prepared' ? deps.journal.applyPreparedEffects(tx, closeReview, staged.mapping) : undefined;
  const committed = await deps.persistence.commit(tx.close());
  if (committed.kind === 'Conflict') return { kind: 'Conflict', changed: [committed.binding] };
  if (committed.kind === 'RuntimeNotWritable') return committed;
  if (committed.kind !== 'Committed') throw new Error(committed.kind);
  const trade = staged.projection;
  const derivation = derive({ record: trade });
  if (derivation.kind !== 'Derived') throw new Error('incoherent');
  const before = prepared.before!.lifecycle;
  // The candidate was derived above, so the before-state's coherent facts derive too.
  const beforeDerivation = derive({ record: prepared.beforeAnalysisInput! });
  if (beforeDerivation.kind !== 'Derived') throw new Error('incoherent');
  // Exactly one outcome: the completed Entry, the explicit decline, or the deferred Debt.
  const { outcome, ref } = reflectionOutcome(journal);
  const close = closeJournal && reflectionOutcome(closeJournal);
  return {
    kind: 'Recorded',
    receipt: {
      tradeId,
      factRevision: trade.factRevision,
      binding: committed.binding,
      // The Position Change, then its members in submitted order.
      createdFactIds: Object.values(staged.mapping),
      lifecycleTransitions: before === trade.storedLifecycle ? [] : [{ tradeId, from: before, to: trade.storedLifecycle }],
      deviationReconciliation: reconciliationOf(derived.reconciliation.deviationActions, trade.recordedDeviations ?? [], staged.mapping),
      repairs: staged.repairs ?? [],
      entryChanges: entryChangesOf(beforeDerivation, derivation),
      lotMatchChanges: lotMatchChangesOf(beforeDerivation, derivation),
      realizedToDate: { before: beforeDerivation.realizedToDate, after: derivation.realizedToDate },
      reflection: ref,
      ...(close && { closeReview: close.ref }),
    },
    postCommit: { trade, derivation, reflection: outcome, ...(close && { closeReview: close.outcome }) },
    // The Open list reorders by Last Activity; the list the Trade left loses it.
    affected: [trade.storedLifecycle, ...(before === trade.storedLifecycle ? [] : [before])].map((lifecycle) => ({ scope: 'TradeList', lifecycle })),
  };
}
