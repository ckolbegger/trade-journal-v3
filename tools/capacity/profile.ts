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
  // Stored JSON bytes per Trade document plus its Plan Reflection Entry.
  readonly jsonBytesPerTradeWithReflection: number;
  // On-disk bytes per JSON byte for this engine's own records.
  readonly overheadRatio: number;
  // Stored JSON bytes per Catalog record (Institution, Account, Strategy).
  readonly jsonBytesPerCatalogRecord: number;
}

// Measured kinds: Trades with their Plan Reflection Entries (25,000 each), Catalog records.
export const MEASURED = { tradesWithPlanReflection: 25_000, catalogRecords: 60 } as const;

// Kinds that do not exist yet: count × estimated JSON bytes from the planned shape, scaled by the
// measured overhead ratio. Each schema-changing deliverable replaces its allowance.
export const ALLOWANCES = [
  { kind: 'Position Changes', count: 100_000, jsonBytes: 700, until: 'D2', shape: 'change header, quantity, price, Economic Time, Plan Basis' },
  { kind: 'Executions and settlement facts', count: 200_000, jsonBytes: 450, until: 'D2 and D7', shape: 'instrument, side, quantity, price, fees, time' },
  { kind: 'Position Change Reflection outcomes', count: 100_000, jsonBytes: 600, until: 'D2 and D5', shape: 'four short answers or a decline' },
  { kind: 'Close Review outcomes', count: 24_700, jsonBytes: 1_200, until: 'D6', shape: 'review answers and grades' },
  { kind: 'Daily Trade Review Actions', count: 126_000, jsonBytes: 350, until: 'D4', shape: 'action kind, session, short note' },
  { kind: 'Review Notes and Trader Reflections', count: 5_000, jsonBytes: 1_500, until: 'D13', shape: 'free text' },
  { kind: 'Marks', count: 190_000, jsonBytes: 180, until: 'D4', shape: 'instrument, session, price, source' },
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
    MEASURED.catalogRecords * m.jsonBytesPerCatalogRecord * m.overheadRatio;
  const allowed = ALLOWANCES.reduce((sum, a) => sum + a.count * a.jsonBytes * m.overheadRatio, 0);
  const projectedWorkspaceBytes = Math.ceil(measured + allowed);
  return { projectedWorkspaceBytes, requiredQuotaBytes: 3 * projectedWorkspaceBytes };
}

// When several engines have been measured, the largest projection is used.
export function largestProjection(measurements: readonly EngineMeasurement[]): Projection {
  return measurements.map(project).reduce((a, b) => (b.projectedWorkspaceBytes > a.projectedWorkspaceBytes ? b : a));
}
