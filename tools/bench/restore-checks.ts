// The pure rules of the benchmark's Restore steps (D8 T8.19): the artifact and provenance checks before a restore, the
// capacity rules (usage within 10% of the projection for the same counts; peak below 3 × M) and the report text.

import { BENCH_ROWS_WRITER } from '../../src/app/bench-generator.ts';
import type { EngineMeasurement } from '../capacity/profile.ts';

export interface DatasetArtifactRef {
  readonly artifact?: { readonly fileDigest?: string };
}
export interface ExpectedRowsProvenance {
  readonly writer?: string;
  readonly artifactFileDigest?: string;
}

// The restored Workspace's usage may exceed the projection for the same counts by at most this fraction.
export const CAPACITY_TOLERANCE = 0.1;

export interface Verdict {
  readonly ok: boolean;
  // The measured figure over its reference: usage / projection, or peak / M.
  readonly ratio: number;
}

export function usageVerdict(usageBytes: number, projectedBytes: number): Verdict {
  return { ok: usageBytes <= projectedBytes * (1 + CAPACITY_TOLERANCE), ratio: usageBytes / projectedBytes };
}

// The peak usage during a second Restore over the restored Workspace must stay below the required quota, 3 × M (decision 18).
export function peakVerdict(peakBytes: number, projectedBytes: number): Verdict {
  return { ok: peakBytes < 3 * projectedBytes, ratio: peakBytes / projectedBytes };
}

interface Dispositions {
  readonly complete: number;
  readonly declined: number;
  readonly answered: number;
  readonly declinedLater: number;
  readonly outstanding: number;
}
// The parts of bench/dataset.json that the projection prices.
export interface PricedDataset {
  readonly counts: {
    readonly trades: number;
    readonly optionTrades: number;
    readonly expirations: number;
    readonly institutions: number;
    readonly accounts: number;
    readonly strategies: number;
    readonly positionChanges: number;
    readonly executions: number;
    readonly marks: number;
    readonly actions: number;
  };
  readonly dispositions: Dispositions;
  readonly closeReviewDispositions: Dispositions;
}

// The bytes the capacity projection (tools/capacity/profile.ts `project`) gives for this dataset's own counts instead of the
// mature profile's, from one engine's measured per-record bytes. The kinds are the same; the Allowances (Daily Bars, Review
// Notes, Correction versions) are left out, since the dataset holds none. Position Changes split half entries and half exits
// and Executions (which exclude Expirations) split 100,000 to 97,000, as the mature profile does.
export function projectForDataset(m: EngineMeasurement, dataset: PricedDataset): number {
  const { counts: c, dispositions: d, closeReviewDispositions: r } = dataset;
  const pcEntries = Math.round(c.positionChanges / 2);
  const executionEntries = Math.round((c.executions * 100_000) / 197_000);
  return Math.ceil(
    (c.trades - c.optionTrades) * m.bytesPerTradeWithReflection +
      c.optionTrades * m.bytesPerOptionTradeWithReflection +
      c.expirations * m.bytesPerExpiration +
      (c.institutions + c.accounts + c.strategies) * m.jsonBytesPerCatalogRecord * m.overheadRatio +
      pcEntries * m.bytesPerPositionChange +
      (c.positionChanges - pcEntries) * m.bytesPerExitPositionChange +
      executionEntries * m.bytesPerExecution +
      (c.executions - executionEntries) * m.bytesPerExitExecution +
      d.complete * m.bytesPerReflectionCompletedAtCapture +
      d.declined * m.bytesPerReflectionDeclinedAtCapture +
      d.answered * m.bytesPerDebtAnswered +
      d.declinedLater * m.bytesPerDebtDeclined +
      d.outstanding * m.bytesPerDebtOutstanding +
      r.complete * m.bytesPerCloseReviewCompletedAtCapture +
      r.declined * m.bytesPerCloseReviewDeclinedAtCapture +
      r.answered * m.bytesPerCloseReviewDebtAnswered +
      r.declinedLater * m.bytesPerCloseReviewDebtDeclined +
      r.outstanding * m.bytesPerCloseReviewDebtOutstanding +
      c.marks * m.bytesPerMark +
      c.actions * m.bytesPerAction,
  );
}

// What `bench:setup` records (.cache/bench/setup.json), `measure:capacity --restored` adds (.cache/bench/capacity.json) and
// `bench:run` adds (the export and verification timings): the facts the D8 section of bench.md reports.
export interface SetupRecord {
  readonly artifactDigest: string;
  readonly artifactBytes: number;
  readonly prepareMs: number;
  readonly applyMs: number;
  readonly repairs: number;
  readonly issues: number;
}
export interface CapacityRecord {
  readonly usageBytes: number;
  readonly projectedBytes: number;
  // M, the mature projection (src/delivery/capacity-basis.json), and the peak usage of a second Restore.
  readonly matureProjectedBytes: number;
  readonly peakBytes: number;
}
export interface BackupTimings {
  readonly exportMs: number;
  readonly exportBytes: number;
  readonly verifyMs: number;
}

const bytes = (n: number) => `${n.toLocaleString('en-US')} bytes (${(n / 1024 / 1024).toFixed(1)} MiB)`;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

// The D8 section of evidence/D08/bench.md.
export function restoreReport(setup: SetupRecord, capacity: CapacityRecord, timings: BackupTimings): string {
  const usage = usageVerdict(capacity.usageBytes, capacity.projectedBytes);
  const peak = peakVerdict(capacity.peakBytes, capacity.matureProjectedBytes);
  const word = (v: Verdict) => (v.ok ? 'pass' : 'FAIL');
  return `## Restore, capacity and backup timings (D8 T8.19)

The benchmark artifact (digest \`${setup.artifactDigest}\`, ${bytes(setup.artifactBytes)}) was restored through the production first-run Restore in a fresh Chromium profile: ${setup.issues} issues, ${setup.repairs} repairs.

| Step | Result |
| --- | --- |
| First-run Restore, prepare (choose file to preview) | ${seconds(setup.prepareMs)} |
| First-run Restore, apply (Replace to Restore complete) | ${seconds(setup.applyMs)} |
| Restored Workspace \`estimate().usage\` | ${bytes(capacity.usageBytes)} |
| Projection for the same counts | ${bytes(capacity.projectedBytes)} |
| Usage over projection (limit 1.10) | ${usage.ratio.toFixed(3)}: ${word(usage)} |
| Peak usage during a second Restore over the restored Workspace | ${bytes(capacity.peakBytes)} |
| M, the mature projection | ${bytes(capacity.matureProjectedBytes)} |
| Peak over M (limit below 3) | ${peak.ratio.toFixed(3)}: ${word(peak)} |
| One export of the mature dataset (Download backup) | ${seconds(timings.exportMs)}, ${bytes(timings.exportBytes)} |
| One verification of that export (Verify backup) | ${seconds(timings.verifyMs)} |
`;
}

// The recorded projection and M must be the ones computed now (from the dataset's counts and the embedded requirement).
export function cachedProjectionProblems(
  cached: { readonly projectedBytes: number; readonly matureProjectedBytes: number },
  fresh: { readonly projectedBytes: number; readonly matureProjectedBytes: number },
): string[] {
  const problems: string[] = [];
  if (cached.projectedBytes !== fresh.projectedBytes) {
    problems.push(`the cached projection for the dataset counts ${cached.projectedBytes} is not the recomputed ${fresh.projectedBytes}: rerun measure:capacity -- --restored`);
  }
  if (cached.matureProjectedBytes !== fresh.matureProjectedBytes) {
    problems.push(`the cached M ${cached.matureProjectedBytes} is not the embedded ${fresh.matureProjectedBytes}: rerun measure:capacity -- --restored`);
  }
  return problems;
}

// What stops a measurement of the cached profile: it must have been restored from the artifact the dataset records (the
// setup record's digest), not an earlier one.
export function profileProblems(setup: { readonly artifactDigest?: string } | undefined, datasetDigest: string): string[] {
  return setup?.artifactDigest === datasetDigest
    ? []
    : [`the cached profile was restored from artifact ${String(setup?.artifactDigest)}, not ${datasetDigest}: run npm run bench:setup`];
}

// What stops the benchmark before it restores: the artifact is not the one the dataset records, or the expected rows
// were not written by the Node generator for it.
export function artifactProblems(fileDigest: string, dataset: DatasetArtifactRef, rows: ExpectedRowsProvenance | undefined): string[] {
  const problems: string[] = [];
  if (dataset.artifact?.fileDigest !== fileDigest) problems.push(`the artifact's file digest ${fileDigest} is not the dataset's ${String(dataset.artifact?.fileDigest)}`);
  if (rows?.artifactFileDigest !== fileDigest) problems.push(`the expected rows are for artifact ${String(rows?.artifactFileDigest)}, not ${fileDigest}`);
  if (rows?.writer !== BENCH_ROWS_WRITER) problems.push(`the expected rows were written by ${String(rows?.writer)}, not by ${BENCH_ROWS_WRITER}`);
  return problems;
}
