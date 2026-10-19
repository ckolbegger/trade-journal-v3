/**
 * The capacity check of the Runtime Readiness gate: a minimum derived from the disclosed mature
 * workload plus migration and backup headroom (`delivery-contract.md:107-113`, D1 §1 decision 5).
 * The arithmetic is integer bytes, so Node and a browser host derive the same minimum.
 */
export interface WorkloadTerms {
  readonly trades: number;
  readonly openTrades: number;
  readonly positionChangingFacts: number;
  readonly marks: number;
  readonly journalEntries: number;
  readonly referenceRecords: number;
}

export interface CapacityTerm {
  readonly name:
    | "trades"
    | "positionChangingFacts"
    | "marks"
    | "journalEntries"
    | "referenceRecords"
    | "migrationHeadroom"
    | "backupHeadroom";
  readonly count: number;
  readonly bytesPerRecord: number;
  readonly bytes: number;
  readonly note: string;
}

export interface DerivedMinimum {
  readonly workload: WorkloadTerms;
  readonly bytes: number;
  readonly terms: readonly CapacityTerm[];
  readonly bytesPerRecord: {
    readonly trade: number;
    readonly positionChangingFact: number;
    readonly mark: number;
    readonly journalEntry: number;
    readonly referenceRecord: number;
  };
  readonly multiples: { readonly migration: number; readonly backup: number };
}

export interface CapacityEvidence {
  readonly derivedMinimumBytes: number;
  readonly observedFreeBytes?: number;
  readonly shortfallBytes?: number;
  readonly migrationHeadroomBytes: number;
  readonly backupHeadroomBytes: number;
  readonly terms: readonly CapacityTerm[];
  readonly workload: WorkloadTerms;
  readonly multiples: { readonly migration: number; readonly backup: number };
}

export interface ObservedCapacity {
  readonly freeBytes?: number;
  readonly unavailableReason?: string;
}

export type CapacityCheck =
  | {
      readonly outcome: "Sufficient";
      readonly evidence: CapacityEvidence;
    }
  | {
      readonly outcome: "Insufficient";
      readonly evidence: CapacityEvidence;
    }
  | {
      readonly outcome: "Unavailable";
      readonly reason: string;
      readonly evidence: CapacityEvidence;
    };

/** Plan-derived, not measured: 25,000 Trades, 200 Open, ~200,000 position-changing facts. */
export const MATURE_WORKLOAD: WorkloadTerms = {
  trades: 25_000,
  openTrades: 200,
  positionChangingFacts: 200_000,
  marks: 125_000,
  journalEntries: 10_000,
  referenceRecords: 500,
};

const BYTES_PER_RECORD = {
  trade: 2_048,
  positionChangingFact: 512,
  mark: 256,
  journalEntry: 1_024,
  referenceRecord: 512,
} as const;

const MIGRATION_HEADROOM_MULTIPLE = 2;
const BACKUP_HEADROOM_MULTIPLE = 2;

export function deriveMinimum(workload: WorkloadTerms): DerivedMinimum {
  const trades = workload.trades * BYTES_PER_RECORD.trade;
  const facts = workload.positionChangingFacts * BYTES_PER_RECORD.positionChangingFact;
  const marks = workload.marks * BYTES_PER_RECORD.mark;
  const journal = workload.journalEntries * BYTES_PER_RECORD.journalEntry;
  const references = workload.referenceRecords * BYTES_PER_RECORD.referenceRecord;
  const base = trades + facts + marks + journal + references;

  const migrationHeadroom = facts * MIGRATION_HEADROOM_MULTIPLE;
  const backupHeadroom = base * BACKUP_HEADROOM_MULTIPLE;

  const terms: CapacityTerm[] = [
    {
      name: "trades",
      count: workload.trades,
      bytesPerRecord: BYTES_PER_RECORD.trade,
      bytes: trades,
      note: "one record per Trade over about five years",
    },
    {
      name: "positionChangingFacts",
      count: workload.positionChangingFacts,
      bytesPerRecord: BYTES_PER_RECORD.positionChangingFact,
      bytes: facts,
      note: "Execution and settlement facts",
    },
    {
      name: "marks",
      count: workload.marks,
      bytesPerRecord: BYTES_PER_RECORD.mark,
      bytes: marks,
      note: "representative Mark history",
    },
    {
      name: "journalEntries",
      count: workload.journalEntries,
      bytesPerRecord: BYTES_PER_RECORD.journalEntry,
      bytes: journal,
      note: "representative saved Journal versions",
    },
    {
      name: "referenceRecords",
      count: workload.referenceRecords,
      bytesPerRecord: BYTES_PER_RECORD.referenceRecord,
      bytes: references,
      note: "reference identities and history",
    },
    {
      name: "migrationHeadroom",
      count: facts,
      bytesPerRecord: MIGRATION_HEADROOM_MULTIPLE,
      bytes: migrationHeadroom,
      note: `largest section rewrite times ${MIGRATION_HEADROOM_MULTIPLE}`,
    },
    {
      name: "backupHeadroom",
      count: base,
      bytesPerRecord: BACKUP_HEADROOM_MULTIPLE,
      bytes: backupHeadroom,
      note: `representative full artifact times ${BACKUP_HEADROOM_MULTIPLE}`,
    },
  ];

  return {
    workload,
    bytes: base + migrationHeadroom + backupHeadroom,
    terms,
    bytesPerRecord: {
      trade: BYTES_PER_RECORD.trade,
      positionChangingFact: BYTES_PER_RECORD.positionChangingFact,
      mark: BYTES_PER_RECORD.mark,
      journalEntry: BYTES_PER_RECORD.journalEntry,
      referenceRecord: BYTES_PER_RECORD.referenceRecord,
    },
    multiples: {
      migration: MIGRATION_HEADROOM_MULTIPLE,
      backup: BACKUP_HEADROOM_MULTIPLE,
    },
  };
}

export function evaluateCapacity(
  derived: DerivedMinimum,
  observed: ObservedCapacity,
): CapacityCheck {
  const migrationHeadroomBytes =
    derived.terms.find((term) => term.name === "migrationHeadroom")?.bytes ?? 0;
  const backupHeadroomBytes =
    derived.terms.find((term) => term.name === "backupHeadroom")?.bytes ?? 0;
  const evidence: CapacityEvidence = {
    derivedMinimumBytes: derived.bytes,
    ...(observed.freeBytes === undefined ? {} : { observedFreeBytes: observed.freeBytes }),
    migrationHeadroomBytes,
    backupHeadroomBytes,
    terms: derived.terms,
    workload: derived.workload,
    multiples: derived.multiples,
  };

  if (observed.freeBytes === undefined) {
    return {
      outcome: "Unavailable",
      reason: observed.unavailableReason ?? "the host did not report a capacity estimate",
      evidence,
    };
  }
  if (observed.freeBytes >= derived.bytes) {
    return { outcome: "Sufficient", evidence };
  }
  return {
    outcome: "Insufficient",
    evidence: {
      ...evidence,
      shortfallBytes: derived.bytes - observed.freeBytes,
    },
  };
}
