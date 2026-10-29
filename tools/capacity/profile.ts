// The mature dataset profile (D1 plan, section 1.3) and the capacity projection over it
// (decision 18): M is the projected on-disk size of a mature Workspace; the requirement is 3 × M.

export const BASIS_FILE = 'src/delivery/capacity-basis.json';

// What `measure:capacity` records for one engine.
export interface EngineMeasurement {
  readonly engine: string;
  readonly version: string;
  readonly plans: number;
  // estimate().usage delta per Trade together with its Plan Reflection Entry.
  readonly bytesPerTradeWithReflection: number;
  // Stored JSON bytes per Trade document plus its Plan Reflection Entry and obligation record.
  readonly jsonBytesPerTradeWithReflection: number;
  // On-disk bytes per JSON byte for this engine's own records.
  readonly overheadRatio: number;
  // Stored JSON bytes per Catalog record (Institution, Account, Strategy).
  readonly jsonBytesPerCatalogRecord: number;
  // The Open phase (D2): Plans opened with Position Changes, their Executions and reflections.
  readonly openTrades: number;
  readonly positionChanges: number;
  readonly executions: number;
  readonly reflectionEntries: number;
  readonly reflectionDeclines: number;
  readonly usageAfterOpen: number;
  // On-disk bytes per JSON byte over the Open phase (estimate().usage delta / JSON delta).
  readonly positionChangeOverheadRatio: number;
  readonly jsonBytesPerPositionChange: number;
  readonly jsonBytesPerExecution: number;
  readonly jsonBytesPerPositionChangeReflection: number;
  // Each kind's JSON bytes × the Open phase's overhead ratio.
  readonly bytesPerPositionChange: number;
  readonly bytesPerExecution: number;
  readonly bytesPerPositionChangeReflection: number;
  // The Review phase (D4): Marks (some corrected), acknowledgments, and Daily Trade Review Actions,
  // each stored JSON per record and scaled by the phase's own on-disk overhead.
  readonly marks: number;
  readonly correctedMarks: number;
  readonly acknowledgments: number;
  readonly actions: number;
  // On-disk bytes per JSON byte over the Review phase (estimate().usage delta / JSON delta).
  readonly reviewOverheadRatio: number;
  readonly jsonBytesPerMark: number;
  readonly jsonBytesPerAcknowledgment: number;
  readonly jsonBytesPerAction: number;
  readonly bytesPerMark: number;
  readonly bytesPerAcknowledgment: number;
  readonly bytesPerAction: number;
}

// Measured kinds and their mature counts (D1 plan, section 1.3). Executions stand in for the
// whole "Executions and settlement facts" count until D7 adds settlement facts, and Position
// Change Reflection Entries and declines for the whole outcome count until D5 adds Debt.
export const MEASURED = {
  tradesWithPlanReflection: 25_000,
  catalogRecords: 60,
  positionChanges: 100_000,
  executions: 200_000,
  positionChangeReflectionOutcomes: 100_000,
  // Replaced the D1 allowances in D4 (T4.28): the Mark count includes corrections. Acknowledgments
  // have no mature count in the profile, so they are measured and recorded but not projected.
  marks: 190_000,
  dailyTradeReviewActions: 126_000,
} as const;

// Kinds that do not exist yet: count × estimated JSON bytes from the planned shape, scaled by the
// measured overhead ratio. Each schema-changing deliverable replaces its allowance.
export const ALLOWANCES = [
  { kind: 'Close Review outcomes', count: 24_700, jsonBytes: 1_200, until: 'D6', shape: 'review answers and grades' },
  { kind: 'Review Notes and Trader Reflections', count: 5_000, jsonBytes: 1_500, until: 'D13', shape: 'free text' },
  { kind: 'Daily Bars', count: 190_000, jsonBytes: 220, until: 'D11', shape: 'instrument, session, OHLC, volume' },
  { kind: 'Correction versions', count: 4_000, jsonBytes: 700, until: 'D15', shape: 'superseded fact copy and reason' },
] as const;

export interface Projection {
  readonly projectedWorkspaceBytes: number;
  readonly requiredQuotaBytes: number;
}

export function project(m: EngineMeasurement): Projection {
  const measured =
    MEASURED.tradesWithPlanReflection * m.bytesPerTradeWithReflection +
    MEASURED.catalogRecords * m.jsonBytesPerCatalogRecord * m.overheadRatio +
    MEASURED.positionChanges * m.bytesPerPositionChange +
    MEASURED.executions * m.bytesPerExecution +
    MEASURED.positionChangeReflectionOutcomes * m.bytesPerPositionChangeReflection +
    MEASURED.marks * m.bytesPerMark +
    MEASURED.dailyTradeReviewActions * m.bytesPerAction;
  const allowed = ALLOWANCES.reduce((sum, a) => sum + a.count * a.jsonBytes * m.overheadRatio, 0);
  const projectedWorkspaceBytes = Math.ceil(measured + allowed);
  return { projectedWorkspaceBytes, requiredQuotaBytes: 3 * projectedWorkspaceBytes };
}

// When several engines have been measured, the largest projection is used.
export function largestProjection(measurements: readonly EngineMeasurement[]): Projection {
  return measurements.map(project).reduce((a, b) => (b.projectedWorkspaceBytes > a.projectedWorkspaceBytes ? b : a));
}
