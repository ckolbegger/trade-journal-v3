import type { RuntimeNotWritable } from '../../delivery/runtime-not-writable.ts';
import type { Instant } from '../../domain/time/index.ts';
import type { StorageFailure } from '../mutation-guard.ts';
import {
  derive,
  type DerivedTradeState,
  type DeviationAction,
  type EntryQuality,
  type IncoherentFacts,
  type IntegrityFinding,
  type RecordedDeviation,
  type RecordedDeviationVersion,
} from '../../domain/trade-analysis/index.ts';
import { parseDecimal, Rational } from '../../domain/values/index.ts';
import type { DebtProjection, DeclineProjection, EntryProjection, ReflectionDisposition } from '../../modules/journal/index.ts';
import { beginSemanticTransaction, type WorkspaceSnapshotBinding } from '../../persistence/index.ts';
import type { TradeMutationSuccess, TradeWorkflowsDeps, WorkflowIssue } from './types.ts';

// One member of a Position Change in the full spec form (D2 A18): the Trade that owns it, its
// action, Instrument, Planned-Leg intent, quantity, price, fee, and its own Economic Time.
export interface PositionChangeMember {
  readonly kind: 'Execution';
  readonly tradeId: string;
  readonly action: 'Buy' | 'Sell';
  readonly instrument: { readonly kind: 'Stock'; readonly symbol: string } | { readonly kind: 'Option'; readonly symbol: string };
  readonly intent: { readonly kind: 'ServesPlannedLeg'; readonly plannedLegId: string } | { readonly kind: 'ExplicitlyUnplanned' };
  readonly quantity: string;
  readonly price: string;
  readonly fee?: string;
  readonly economicTime: Instant;
}

// One decision: the Trades it affects, each against the FactRevision the form was loaded at, its
// members, and the one Position Change Reflection disposition, anchored to the originating Trade.
export interface PositionChangeCommand {
  readonly originTradeId: string;
  readonly trades: readonly { readonly tradeId: string; readonly expectedFactRevision: number }[];
  readonly members: readonly PositionChangeMember[];
  readonly reflection: ReflectionDisposition;
}

// The one Position Change Reflection outcome: its identity in the receipt, its projection after commit.
export type PositionChangeSuccess = TradeMutationSuccess<
  {
    // A Defer names the Outstanding Debt it created instead of an Entry or decline (D5 A66).
    readonly reflection: { readonly kind: 'Entry' | 'Decline' | 'Debt'; readonly id: string };
    // What the commit did to each recorded Deviation occurrence, by fingerprint (D2 A26).
    readonly deviationReconciliation: readonly DeviationReconciliationItem[];
    // Disclosed when the change, typically an earlier-dated one, moved a resolved entry (P5).
    readonly entryChanges: readonly EntryChange[];
    // Before-state disagreements with coherent facts that this commit repaired (P7).
    readonly repairs: readonly IntegrityFinding[];
  },
  {
    readonly reflection:
      | { readonly kind: 'Entry'; readonly entry: EntryProjection }
      | { readonly kind: 'Decline'; readonly decline: DeclineProjection }
      | { readonly kind: 'Debt'; readonly debt: DebtProjection };
  }
>;

type ReflectionOutcome = PositionChangeSuccess['postCommit']['reflection'];

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

// Sells arrive with D6, other Instruments and ExplicitlyUnplanned intent with D10, and Position
// Changes across several Trades with D20 and D21.
export type UninstalledVariant = 'Sell' | 'OtherInstrument' | 'ExplicitlyUnplanned' | 'MultipleTrades';

// D2's installed variant: Buys of a Stock serving a Planned Leg, every member in the one Trade.
type InstalledMember = PositionChangeMember & {
  readonly action: 'Buy';
  readonly instrument: { readonly kind: 'Stock' };
  readonly intent: { readonly kind: 'ServesPlannedLeg' };
};

function uninstalledVariants(command: PositionChangeCommand): UninstalledVariant[] {
  const variants = new Set<UninstalledVariant>();
  const origin = command.originTradeId;
  if (command.trades.some((t) => t.tradeId !== origin) || command.members.some((m) => m.tradeId !== origin)) variants.add('MultipleTrades');
  for (const member of command.members) {
    if (member.action !== 'Buy') variants.add('Sell');
    if (member.instrument.kind !== 'Stock') variants.add('OtherInstrument');
    if (member.intent.kind !== 'ServesPlannedLeg') variants.add('ExplicitlyUnplanned');
  }
  return [...variants];
}

const installed = (members: readonly PositionChangeMember[]): members is readonly InstalledMember[] =>
  members.every((m) => m.action === 'Buy' && m.instrument.kind === 'Stock' && m.intent.kind === 'ServesPlannedLeg');

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
function memberIssues(member: PositionChangeMember, index: number, planTime: Instant, now: Instant): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  const issue = (field: string, code: string) => issues.push({ source: 'TradeWorkflows', member: index, field, code });
  for (const [field, text, positive] of [
    ['quantity', member.quantity, true],
    ['price', member.price, true],
    ['fee', member.fee, false],
  ] as const) {
    const code = decimalIssue(text, positive);
    if (code) issue(field, code);
  }
  const time = Date.parse(member.economicTime);
  if (time < Date.parse(planTime)) issue('economicTime', 'EconomicTimeBeforePlan');
  if (time > Date.parse(now)) issue('economicTime', 'EconomicTimeInFuture');
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
              fingerprint.positionChangeId === (mapping[expected.positionChangeId] ?? expected.positionChangeId)
            );
          })!
        : recorded.find((d) => d.occurrenceId === action.occurrenceId)!;
    return { action: action.kind, occurrenceId: occurrence.occurrenceId, version: occurrence.versions.at(-1)! };
  });
}

export async function recordPositionChange(deps: TradeWorkflowsDeps, command: PositionChangeCommand): Promise<PositionChangeResult> {
  const variants = uninstalledVariants(command);
  if (variants.length > 0 || !installed(command.members)) return { kind: 'VariantNotInstalled', variants };
  const tradeId = command.originTradeId;
  const prepared = await deps.tradeRecord.prepareChange({
    kind: 'PositionChange',
    tradeId,
    expectedFactRevision: command.trades[0]!.expectedFactRevision,
    executions: command.members.map((m) => ({
      action: m.action,
      instrument: { kind: m.instrument.kind, symbol: m.instrument.symbol },
      intent: { kind: m.intent.kind, plannedLegId: m.intent.plannedLegId },
      quantity: m.quantity,
      price: m.price,
      fee: m.fee ?? '',
      economicTime: m.economicTime,
    })),
  });
  // The same binding name the commit-time recheck of the Trade's FactRevision reports.
  if (prepared.kind === 'Conflict') return { kind: 'Conflict', changed: [`trade:${prepared.tradeId}`] };
  if (prepared.kind !== 'Prepared') throw new Error(prepared.kind);
  // Another Stock than the served Planned Leg's is Planned-Leg Terms, not installed until D10.
  const legs = prepared.beforeAnalysisInput!.plan.legs;
  if (command.members.some((m) => m.instrument.symbol !== legs.find((l) => l.factId === m.intent.plannedLegId)?.instrument.symbol)) {
    return { kind: 'VariantNotInstalled', variants: ['OtherInstrument'] };
  }
  // The candidate Position Change the Journal outcome's origin names until apply maps it.
  const positionChange = prepared.candidate.facts.slice(prepared.before?.facts.length).find((f) => f.kind === 'PositionChange')!;
  const reflection = await deps.journal.prepareEffects({
    obligation: 'PositionChangeReflection',
    disposition: command.reflection,
    anchor: { kind: 'Trade', ref: tradeId },
    origin: { kind: 'PositionChange', ref: positionChange.factId },
    // The reflection's moment is the Position Change's Economic Time, its earliest member's (D2 A19);
    // a command with no members is rejected below, and its form is still validated.
    momentTime: earliest(command.members.map((m) => m.economicTime)) ?? prepared.before!.planTime,
  });
  const issues: WorkflowIssue[] = [
    ...(command.members.length === 0 ? [{ source: 'TradeWorkflows', field: 'members', code: 'NoExecutions' } as const] : []),
    ...(command.members.length > MAX_EXECUTIONS ? [{ source: 'TradeWorkflows', field: 'members', code: 'TooManyExecutions' } as const] : []),
    ...command.members.flatMap((m, i) => memberIssues(m, i, prepared.before!.planTime, deps.clock.now())),
  ];
  if (reflection.kind === 'Rejected') {
    for (const issue of reflection.issues) issues.push({ source: 'Journal', ...(issue.promptId && { field: issue.promptId }), code: issue.code });
  }
  if (issues.length > 0 || reflection.kind !== 'Prepared') {
    const { binding } = await deps.persistence.readSnapshot(['meta'], () => Promise.resolve(null));
    return { kind: 'Rejected', issues, binding };
  }
  const derived = derive({ record: prepared.analysisInput, candidate: { digest: prepared.digest, before: prepared.beforeAnalysisInput! } });
  if (derived.kind === 'IncoherentFacts') return { kind: 'IntegrityDisagreement', tradeId, findings: derived.findings };
  if (!derived.reconciliation) throw new Error('no reconciliation');
  const tx = beginSemanticTransaction();
  const staged = deps.tradeRecord.applyPreparedChange(tx, prepared, derived.reconciliation);
  if (staged.kind !== 'Staged') throw new Error('mismatch');
  const journal = deps.journal.applyPreparedEffects(tx, reflection, staged.mapping);
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
      reflection: ref,
    },
    postCommit: { trade, derivation, reflection: outcome },
    // The Open list reorders by Last Activity; the list the Trade left loses it.
    affected: [trade.storedLifecycle, ...(before === trade.storedLifecycle ? [] : [before])].map((lifecycle) => ({ scope: 'TradeList', lifecycle })),
  };
}
