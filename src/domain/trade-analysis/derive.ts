import { Temporal } from 'temporal-polyfill';
import type { Instant } from '../time/index.ts';
import { parseDecimal, Rational } from '../values/index.ts';
import { frozenBaseline, type ConditionInput, type PlanBaseline, type PlannedLegInput } from './plan.ts';

export type LifecycleState = 'Planned' | 'Open' | 'Closed' | 'Abandoned';

// One effective fill. D2 records Buys of the Plan's Stock serving its Planned Leg (D2 A18).
export interface ExecutionFact {
  readonly factId: string;
  readonly economicTime: Instant;
  readonly recordedSequence: number;
  readonly action: 'Buy';
  readonly instrument: { readonly kind: 'Stock'; readonly symbol: string };
  readonly quantity: string;
  readonly price: string;
  readonly fee: string;
  readonly intent: { readonly kind: 'ServesPlannedLeg'; readonly plannedLegId: string };
}

// One decision grouping its member Executions; its Economic Time is its earliest member's (A19).
export interface PositionChangeFact {
  readonly factId: string;
  readonly economicTime: Instant;
  readonly recordedSequence: number;
  readonly executions: readonly ExecutionFact[];
}

// Trade Record's AnalysisInput projection: the complete effective facts of one Trade at one
// FactRevision.
export interface TradeAnalysisRecord {
  readonly tradeId: string;
  readonly factRevision: number;
  readonly storedLifecycle: LifecycleState;
  readonly plan: {
    readonly economicTime: Instant;
    readonly underlying: string;
    readonly thesis: string;
    readonly invalidation: string;
    readonly legs: readonly (PlannedLegInput & { readonly factId: string })[];
    readonly stops: readonly (ConditionInput & { readonly factId: string })[];
    readonly targets: readonly (ConditionInput & { readonly factId: string })[];
  };
  readonly positionChanges: readonly PositionChangeFact[];
  // Recorded Deviation occurrences, authoritative in Trade Record; absent means none recorded.
  readonly recordedDeviations?: readonly RecordedDeviation[];
}

// A prepared candidate's canonical digest and the before-state record: the reconciliation is bound
// to the digest and to the before-state's stored lifecycle and recorded occurrences, which the
// candidate leaves unchanged until it is applied.
export interface CandidateBinding {
  readonly digest: string;
  readonly before: TradeAnalysisRecord;
}

export interface TradeDerivationInput {
  readonly record: TradeAnalysisRecord;
  // Present when record is a prepared candidate.
  readonly candidate?: CandidateBinding;
}

// Agreement between stored and expected Lifecycle State; a disagreement is reported, never repaired.
export type LifecycleAgreement =
  | { readonly kind: 'Agrees' }
  | { readonly kind: 'LifecycleDisagreement'; readonly stored: LifecycleState; readonly expected: LifecycleState };

// The unmatched portion of one opening Execution, with its basis and unconsumed opening fee.
export interface OpenLot {
  readonly openingExecutionId: string;
  readonly quantity: Rational;
  readonly price: Rational;
  readonly unconsumedOpeningFee: Rational;
}

// Derived signed net quantity and Open Lots for one exact Instrument within the Trade.
export interface InstrumentPosition {
  readonly instrument: ExecutionFact['instrument'];
  readonly quantity: Rational;
  readonly openLots: readonly OpenLot[];
}

// One independently useful calculation (Trade Analysis, shared values); reasons are stable codes.
export type CalculationResult<T, Reason extends string = string> =
  | { readonly kind: 'Value'; readonly value: T }
  | { readonly kind: 'NotApplicable'; readonly reason: Reason };

// D2's Entry Resolution Point: the Position Change at which the entry window resolves (A23).
export type EntryResolution = { readonly kind: 'Unresolved' } | { readonly kind: 'Resolved'; readonly positionChangeId: string };

// Entry Quality over the entry window's opening Executions (A24), each figure its own result.
export interface EntryQualityFigures {
  readonly averageEntry: CalculationResult<Rational>;
  readonly windowQuantity: CalculationResult<Rational>;
  readonly windowFees: CalculationResult<Rational>;
  readonly actualInitialRisk: CalculationResult<Rational>;
  readonly actualInitialReward: CalculationResult<Rational>;
  readonly riskInPlanR: CalculationResult<Rational>;
  readonly slippage: CalculationResult<Rational>;
  readonly sizeRatio: CalculationResult<Rational>;
  readonly plannedRewardRisk: CalculationResult<Rational>;
  readonly actualRewardRisk: CalculationResult<Rational, EntryFlag>;
  readonly flags: readonly EntryFlag[];
}

// An average entry at or beyond a boundary: the actual reward/risk ratio is then not applicable.
export type EntryFlag = 'EntryAtOrBeyondStop' | 'EntryAtOrBeyondTarget';

export type EntryQuality = CalculationResult<EntryQualityFigures, 'EntryNotResolved'>;

// D2's per-leg fulfillment (A25); Not Entered and Not Verifiable arrive with later variants.
export interface LegFulfillment {
  readonly plannedLegId: string;
  readonly fulfillment: 'Unfilled' | 'PartiallyFilled' | 'FilledAsPlanned' | 'FilledWithDeviation';
}

// Identifies one Entry Size (Excess) occurrence: the Planned Leg and the Position Change that
// raised its open quantity above plan (P4).
export interface DeviationFingerprint {
  readonly tradeId: string;
  readonly plannedLegId: string;
  readonly positionChangeId: string;
}

// A deterministic fact-only Deviation the facts imply (A26's version, without its status).
export interface ExpectedDeviation {
  readonly fingerprint: DeviationFingerprint;
  readonly type: 'EntrySize';
  readonly form: 'Excess';
  readonly quantityAbovePlan: Rational;
  readonly causingPositionChangeId: string;
  readonly economicTime: Instant;
}

// A structured integrity finding: stored state that disagrees with what the facts imply. Analysis
// reports it and never repairs it.
export type IntegrityFinding =
  | Extract<LifecycleAgreement, { kind: 'LifecycleDisagreement' }>
  | {
      readonly kind: 'DeviationMissing';
      readonly fingerprint: DeviationFingerprint;
      readonly expected: ExpectedDeviation;
    }
  | {
      readonly kind: 'DeviationQuantityDisagreement';
      readonly fingerprint: DeviationFingerprint;
      readonly occurrenceId: string;
      readonly recorded: Rational;
      readonly expected: Rational;
    }
  | {
      readonly kind: 'DeviationUnexpected';
      readonly fingerprint: DeviationFingerprint;
      readonly occurrenceId: string;
    };

// One version of a recorded occurrence (A26): supersession appends a Superseded version.
export type RecordedDeviationVersion = {
  readonly fingerprint: DeviationFingerprint;
  readonly type: 'EntrySize';
  readonly form: 'Excess';
  readonly quantityAbovePlan: string;
  readonly causingPositionChangeId: string;
  readonly economicTime: Instant;
} & ({ readonly status: 'Active' } | { readonly status: 'Superseded'; readonly reason: 'NoLongerExpected' });

// A recorded Deviation occurrence: a stable occurrence identity with its version list (A26).
export interface RecordedDeviation {
  readonly occurrenceId: string;
  readonly versions: readonly RecordedDeviationVersion[];
}

// What applying the candidate must do to each recorded occurrence, by fingerprint (A26).
export type DeviationAction =
  | { readonly kind: 'Create'; readonly occurrence: ExpectedDeviation }
  | {
      readonly kind: 'Retain';
      readonly occurrenceId: string;
      readonly fingerprint: DeviationFingerprint;
    }
  | {
      readonly kind: 'NewVersion';
      readonly occurrenceId: string;
      readonly occurrence: ExpectedDeviation;
    }
  | {
      readonly kind: 'Supersede';
      readonly occurrenceId: string;
      readonly fingerprint: DeviationFingerprint;
      readonly reason: 'NoLongerExpected';
    };

// Trade Analysis's expected state for one exact candidate, which Trade Record's apply requires.
export interface DerivedTradeReconciliation {
  readonly candidateDigest: string;
  readonly expectedLifecycle: LifecycleState;
  readonly deviationActions: readonly DeviationAction[];
  // Where the before-state's stored lifecycle or recorded occurrences disagreed with its own
  // coherent facts: repaired by applying the candidate and disclosed (P7).
  readonly repairs: readonly IntegrityFinding[];
  // What the change itself does to expected state, from the before facts to the candidate's.
  readonly effects: readonly ChangeEffect[];
}

export type ChangeEffect =
  | {
      readonly kind: 'LifecycleTransition';
      readonly from: LifecycleState;
      readonly to: LifecycleState;
    }
  | {
      readonly kind: 'DeviationChange';
      readonly fingerprint: DeviationFingerprint;
      readonly from: Rational | null;
      readonly to: Rational | null;
    };

export interface DerivedTradeState {
  readonly kind: 'Derived';
  readonly tradeId: string;
  readonly factRevision: number;
  readonly expectedLifecycle: LifecycleState;
  readonly agreement: LifecycleAgreement;
  // Effective Executions in Fact Order, each with its Position Change.
  readonly facts: readonly (ExecutionFact & { readonly positionChangeId: string })[];
  readonly positions: readonly InstrumentPosition[];
  // Every opening Execution's actual fee, each counted once.
  readonly fees: { readonly incurredOpening: Rational };
  // Signed cost of the remaining open exposure: quantity x price over the Open Lots plus their unconsumed
  // opening fees (D4's C + F). Stock only until options add a multiplier.
  readonly netCost: CalculationResult<Rational, 'NoOpenQuantity'>;
  readonly baseline: PlanBaseline;
  readonly entryResolution: EntryResolution;
  readonly entryQuality: EntryQuality;
  readonly legFulfillment: readonly LegFulfillment[];
  readonly deviations: readonly ExpectedDeviation[];
  readonly findings: readonly IntegrityFinding[];
  // Present when a candidate binding was supplied.
  readonly reconciliation?: DerivedTradeReconciliation;
}

// Facts that cannot be replayed are a typed rejection naming each fact, never a number.
export interface IncoherentFacts {
  readonly kind: 'IncoherentFacts';
  readonly findings: readonly {
    readonly factId: string;
    readonly reason: 'UnknownPlannedLeg' | 'NonpositiveQuantity' | 'DuplicateFactId';
  }[];
}

export type DerivationResult = DerivedTradeState | IncoherentFacts;

function incoherence(record: TradeAnalysisRecord): IncoherentFacts['findings'] {
  const findings: { factId: string; reason: IncoherentFacts['findings'][number]['reason'] }[] = [];
  const legs = new Set(record.plan.legs.map((l) => l.factId));
  const seen = new Set<string>();
  for (const pc of record.positionChanges) {
    for (const fact of [pc, ...pc.executions]) {
      if (seen.has(fact.factId)) findings.push({ factId: fact.factId, reason: 'DuplicateFactId' });
      seen.add(fact.factId);
    }
    for (const e of pc.executions) {
      if (!legs.has(e.intent.plannedLegId)) findings.push({ factId: e.factId, reason: 'UnknownPlannedLeg' });
      if (!parseDecimal(e.quantity, { positive: true }).ok) findings.push({ factId: e.factId, reason: 'NonpositiveQuantity' });
    }
  }
  return findings;
}

// Facts reaching analysis were validated when recorded, so their decimals parse.
function decimal(text: string): Rational {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`Invalid stored decimal: ${text}`);
  return parsed.value;
}

function netCostOf(positions: readonly InstrumentPosition[]): DerivedTradeState['netCost'] {
  const lots = positions.flatMap((p) => p.openLots);
  if (lots.length === 0) return { kind: 'NotApplicable', reason: 'NoOpenQuantity' };
  const total = lots.reduce((sum, l) => sum.add(l.quantity.mul(l.price)).add(l.unconsumedOpeningFee), Rational.of(0n));
  return { kind: 'Value', value: total };
}

// Each opening Execution creates one Open Lot holding its whole fee (D2 A22).
function positionsOf(facts: readonly ExecutionFact[]): InstrumentPosition[] {
  const lots = facts.map((e): OpenLot => ({
    openingExecutionId: e.factId,
    quantity: decimal(e.quantity),
    price: decimal(e.price),
    unconsumedOpeningFee: decimal(e.fee),
  }));
  if (lots.length === 0) return [];
  return [
    {
      instrument: facts[0]!.instrument,
      quantity: lots.reduce((sum, l) => sum.add(l.quantity), Rational.of(0n)),
      openLots: lots,
    },
  ];
}

// FactOrder: Economic Time, then the stable Recorded Sequence for ties.
type Ordered = Pick<ExecutionFact, 'economicTime' | 'recordedSequence'>;
function factOrder(a: Ordered, b: Ordered): number {
  return Temporal.Instant.compare(a.economicTime, b.economicTime) || a.recordedSequence - b.recordedSequence;
}

// The entry window opens with the first Position Change and resolves at the first one, in Fact
// Order, after which every Planned Leg's entered quantity reaches its planned quantity (A23). The
// window holds every Execution of the Position Changes up to and including the resolving one.
function entryWindowOf(record: TradeAnalysisRecord): { resolution: EntryResolution; window: ExecutionFact[] } {
  const entered = new Map<string, Rational>();
  const window: ExecutionFact[] = [];
  for (const pc of [...record.positionChanges].sort(factOrder)) {
    for (const e of pc.executions) {
      const leg = e.intent.plannedLegId;
      entered.set(leg, (entered.get(leg) ?? Rational.of(0n)).add(decimal(e.quantity)));
      window.push(e);
    }
    const filled = record.plan.legs.every((leg) => (entered.get(leg.factId)?.compare(decimal(leg.quantity)) ?? -1) >= 0);
    if (filled) return { resolution: { kind: 'Resolved', positionChangeId: pc.factId }, window };
  }
  return { resolution: { kind: 'Unresolved' }, window };
}

const value = (v: Rational) => ({ kind: 'Value', value: v }) as const;
const total = (executions: readonly ExecutionFact[], of: (e: ExecutionFact) => Rational) =>
  executions.reduce((sum, e) => sum.add(of(e)), Rational.of(0n));

// Uses the Stop and Target effective at the Entry Resolution Point: before D17, the Plan's single
// original ones (D1 A1).
function entryQualityOf(
  resolution: EntryResolution,
  window: readonly ExecutionFact[],
  plan: TradeAnalysisRecord['plan'],
  baseline: PlanBaseline,
): EntryQuality {
  if (resolution.kind === 'Unresolved') return { kind: 'NotApplicable', reason: 'EntryNotResolved' };
  const zero = Rational.of(0n);
  const quantity = total(window, (e) => decimal(e.quantity));
  const cost = total(window, (e) => decimal(e.quantity).mul(decimal(e.price)));
  const fees = total(window, (e) => decimal(e.fee));
  const average = cost.div(quantity);
  const stop = decimal(plan.stops[0]!.price);
  const target = decimal(plan.targets[0]!.price);
  const flags: EntryFlag[] = [];
  if (average.compare(stop) <= 0) flags.push('EntryAtOrBeyondStop');
  if (average.compare(target) >= 0) flags.push('EntryAtOrBeyondTarget');
  const nonnegative = (r: Rational) => (r.compare(zero) > 0 ? r : zero);
  const risk = nonnegative(quantity.mul(average.sub(stop))).add(fees);
  const reward = nonnegative(quantity.mul(target.sub(average))).sub(fees);
  const leg = plan.legs[0]!;
  return {
    kind: 'Value',
    value: {
      averageEntry: value(average),
      windowQuantity: value(quantity),
      windowFees: value(fees),
      actualInitialRisk: value(risk),
      actualInitialReward: value(reward),
      riskInPlanR: value(risk.div(baseline.oneR)),
      slippage: value(average.sub(decimal(leg.intendedEntry)).mul(quantity)),
      sizeRatio: value(quantity.div(decimal(leg.quantity))),
      plannedRewardRisk: value(baseline.rewardRiskRatio),
      actualRewardRisk: flags[0] ? { kind: 'NotApplicable', reason: flags[0] } : value(reward.div(risk)),
      flags,
    },
  };
}

function legFulfillmentOf(
  plan: TradeAnalysisRecord['plan'],
  facts: readonly ExecutionFact[],
  deviations: readonly ExpectedDeviation[],
): LegFulfillment[] {
  return plan.legs.map((leg) => {
    const entered = total(
      facts.filter((e) => e.intent.plannedLegId === leg.factId),
      (e) => decimal(e.quantity),
    );
    // Any active Entry Size occurrence on the leg is a Deviation (A25).
    const fulfillment: LegFulfillment['fulfillment'] = deviations.some((d) => d.fingerprint.plannedLegId === leg.factId)
      ? 'FilledWithDeviation'
      : entered.compare(Rational.of(0n)) === 0
        ? 'Unfilled'
        : entered.compare(decimal(leg.quantity)) < 0
          ? 'PartiallyFilled'
          : 'FilledAsPlanned';
    return { plannedLegId: leg.factId, fulfillment };
  });
}

// Entry Size excess (P4): one occurrence per Position Change that raises a Planned Leg's open
// quantity above its planned quantity, carrying the quantity it added above plan.
function deviationsOf(record: TradeAnalysisRecord): ExpectedDeviation[] {
  return record.plan.legs.flatMap((leg) => {
    const planned = decimal(leg.quantity);
    let entered = Rational.of(0n);
    return [...record.positionChanges].sort(factOrder).flatMap((pc): ExpectedDeviation[] => {
      const before = entered;
      for (const e of pc.executions) if (e.intent.plannedLegId === leg.factId) entered = entered.add(decimal(e.quantity));
      const above = entered.sub(before.compare(planned) > 0 ? before : planned);
      if (above.compare(Rational.of(0n)) <= 0) return [];
      return [
        {
          fingerprint: {
            tradeId: record.tradeId,
            plannedLegId: leg.factId,
            positionChangeId: pc.factId,
          },
          type: 'EntrySize',
          form: 'Excess',
          quantityAbovePlan: above,
          causingPositionChangeId: pc.factId,
          economicTime: pc.economicTime,
        },
      ];
    });
  });
}

const fingerprintKey = (f: DeviationFingerprint) => JSON.stringify([f.tradeId, f.plannedLegId, f.positionChangeId]);

const latestVersion = (r: RecordedDeviation) => r.versions[r.versions.length - 1]!;

// Pairs each expected occurrence with the recorded one of the same fingerprint, and returns the
// recorded occurrences left unpaired.
function matchOccurrences(expected: readonly ExpectedDeviation[], recorded: readonly RecordedDeviation[]) {
  const unpaired = new Map(recorded.map((r) => [fingerprintKey(latestVersion(r).fingerprint), r]));
  const pairs = expected.map((occurrence) => {
    const key = fingerprintKey(occurrence.fingerprint);
    const match = unpaired.get(key);
    unpaired.delete(key);
    return {
      occurrence,
      match: match && {
        occurrenceId: match.occurrenceId,
        version: latestVersion(match),
      },
    };
  });
  return {
    pairs,
    unpaired: [...unpaired.values()].map((r) => ({
      occurrenceId: r.occurrenceId,
      version: latestVersion(r),
    })),
  };
}

// Compares expected and active recorded occurrences by fingerprint.
function deviationFindings(expected: readonly ExpectedDeviation[], recorded: readonly RecordedDeviation[]): IntegrityFinding[] {
  const { pairs, unpaired } = matchOccurrences(expected, recorded);
  const findings: IntegrityFinding[] = [];
  for (const { occurrence, match } of pairs) {
    if (match?.version.status !== 'Active') {
      findings.push({
        kind: 'DeviationMissing',
        fingerprint: occurrence.fingerprint,
        expected: occurrence,
      });
      continue;
    }
    const stored = decimal(match.version.quantityAbovePlan);
    if (stored.compare(occurrence.quantityAbovePlan) !== 0)
      findings.push({
        kind: 'DeviationQuantityDisagreement',
        fingerprint: occurrence.fingerprint,
        occurrenceId: match.occurrenceId,
        recorded: stored,
        expected: occurrence.quantityAbovePlan,
      });
  }
  for (const { occurrenceId, version } of unpaired)
    if (version.status === 'Active')
      findings.push({
        kind: 'DeviationUnexpected',
        fingerprint: version.fingerprint,
        occurrenceId,
      });
  return findings;
}

// Create, retain, append a new version when an occurrence changed or returns, or supersede.
function deviationActions(expected: readonly ExpectedDeviation[], recorded: readonly RecordedDeviation[]): DeviationAction[] {
  const { pairs, unpaired } = matchOccurrences(expected, recorded);
  return [
    ...pairs.map(({ occurrence, match }): DeviationAction => {
      if (!match) return { kind: 'Create', occurrence };
      const unchanged =
        match.version.status === 'Active' && decimal(match.version.quantityAbovePlan).compare(occurrence.quantityAbovePlan) === 0;
      return unchanged
        ? {
            kind: 'Retain',
            occurrenceId: match.occurrenceId,
            fingerprint: occurrence.fingerprint,
          }
        : { kind: 'NewVersion', occurrenceId: match.occurrenceId, occurrence };
    }),
    ...unpaired.map(({ occurrenceId, version }): DeviationAction =>
      version.status === 'Active'
        ? {
            kind: 'Supersede',
            occurrenceId,
            fingerprint: version.fingerprint,
            reason: 'NoLongerExpected',
          }
        : { kind: 'Retain', occurrenceId, fingerprint: version.fingerprint },
    ),
  ];
}

// The change's own effects: expected state before the change versus after it.
function changeEffects(before: DerivedTradeState, lifecycle: LifecycleState, deviations: readonly ExpectedDeviation[]): ChangeEffect[] {
  const effects: ChangeEffect[] = [];
  if (before.expectedLifecycle !== lifecycle)
    effects.push({
      kind: 'LifecycleTransition',
      from: before.expectedLifecycle,
      to: lifecycle,
    });
  const prior = new Map(before.deviations.map((d) => [fingerprintKey(d.fingerprint), d]));
  for (const d of deviations) {
    const key = fingerprintKey(d.fingerprint);
    const from = prior.get(key)?.quantityAbovePlan ?? null;
    prior.delete(key);
    if (from?.compare(d.quantityAbovePlan) !== 0)
      effects.push({
        kind: 'DeviationChange',
        fingerprint: d.fingerprint,
        from,
        to: d.quantityAbovePlan,
      });
  }
  for (const d of prior.values())
    effects.push({
      kind: 'DeviationChange',
      fingerprint: d.fingerprint,
      from: d.quantityAbovePlan,
      to: null,
    });
  return effects;
}

export function derive(input: TradeDerivationInput): DerivationResult {
  const { record } = input;
  const findings = incoherence(record);
  if (findings.length > 0) return { kind: 'IncoherentFacts', findings };
  const facts = record.positionChanges
    // Nested values are copied so the inert output never aliases the caller's input.
    .flatMap((pc) =>
      pc.executions.map((e) => ({ ...e, instrument: { ...e.instrument }, intent: { ...e.intent }, positionChangeId: pc.factId })),
    )
    .sort(factOrder);
  const positions = positionsOf(facts);
  const entry = entryWindowOf(record);
  const baseline = frozenBaseline(record.plan);
  // Effective facts that leave nonzero exposure make the Trade Open; none leave it Planned.
  const expectedLifecycle: LifecycleState = positions.length > 0 ? 'Open' : 'Planned';
  const deviations = deviationsOf(record);
  const before = input.candidate && derive({ record: input.candidate.before });
  if (before?.kind === 'IncoherentFacts') return before;
  const agreement: LifecycleAgreement =
    record.storedLifecycle === expectedLifecycle
      ? { kind: 'Agrees' }
      : {
          kind: 'LifecycleDisagreement',
          stored: record.storedLifecycle,
          expected: expectedLifecycle,
        };
  return {
    kind: 'Derived',
    tradeId: record.tradeId,
    factRevision: record.factRevision,
    expectedLifecycle,
    agreement,
    facts,
    positions,
    fees: { incurredOpening: facts.reduce((sum, e) => sum.add(decimal(e.fee)), Rational.of(0n)) },
    netCost: netCostOf(positions),
    baseline,
    entryResolution: entry.resolution,
    entryQuality: entryQualityOf(entry.resolution, entry.window, record.plan, baseline),
    legFulfillment: legFulfillmentOf(record.plan, facts, deviations),
    deviations,
    findings: [...(agreement.kind === 'Agrees' ? [] : [agreement]), ...deviationFindings(deviations, record.recordedDeviations ?? [])],
    ...(input.candidate &&
      before && {
        reconciliation: {
          candidateDigest: input.candidate.digest,
          expectedLifecycle,
          deviationActions: deviationActions(deviations, input.candidate.before.recordedDeviations ?? []),
          repairs: before.findings,
          effects: changeEffects(before, expectedLifecycle, deviations),
        },
      }),
  };
}
