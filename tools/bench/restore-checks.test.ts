import { describe, expect, it } from 'vitest';
import type { EngineMeasurement } from '../capacity/profile.ts';
import { artifactProblems, cachedProjectionProblems, peakVerdict, profileProblems, projectForDataset, restoreReport, usageVerdict } from './restore-checks.ts';

// Each kind's bytes are a different prime, so a swapped mapping changes the total.
const MEASURED_BYTES = {
  overheadRatio: 1,
  jsonBytesPerCatalogRecord: 7,
  bytesPerTradeWithReflection: 2,
  bytesPerOptionTradeWithReflection: 3,
  bytesPerExpiration: 5,
  bytesPerPositionChange: 11,
  bytesPerExitPositionChange: 13,
  bytesPerExecution: 17,
  bytesPerExitExecution: 19,
  bytesPerReflectionCompletedAtCapture: 23,
  bytesPerReflectionDeclinedAtCapture: 29,
  bytesPerDebtAnswered: 31,
  bytesPerDebtDeclined: 37,
  bytesPerDebtOutstanding: 41,
  bytesPerCloseReviewCompletedAtCapture: 43,
  bytesPerCloseReviewDeclinedAtCapture: 47,
  bytesPerCloseReviewDebtAnswered: 53,
  bytesPerCloseReviewDebtDeclined: 59,
  bytesPerCloseReviewDebtOutstanding: 61,
  bytesPerMark: 67,
  bytesPerAction: 71,
} as unknown as EngineMeasurement;

describe('benchmark report', () => {
  const setup = { artifactDigest: DIGEST, artifactBytes: 20_869_684, prepareMs: 12_345, applyMs: 67_890, repairs: 0, issues: 0 };
  const timings = { exportMs: 4_200, exportBytes: 20_870_000, verifyMs: 9_100 };

  it('should report the timings, the capacity ratios and their verdicts', () => {
    const text = restoreReport(setup, { usageBytes: 1_050_000, projectedBytes: 1_000_000, matureProjectedBytes: 2_000_000, peakBytes: 5_000_000 }, timings);
    expect(text).toContain('| First-run Restore, prepare (choose file to preview) | 12.3 s |');
    expect(text).toContain('| First-run Restore, apply (Replace to Restore complete) | 67.9 s |');
    expect(text).toContain('| Usage over projection (limit 1.10) | 1.050: pass |');
    expect(text).toContain('| Peak over M (limit below 3) | 2.500: pass |');
    expect(text).toContain('| One verification of that export (Verify backup) | 9.1 s |');
    expect(text).toContain('0 issues, 0 repairs');
  });

  it('should mark a capacity figure over its limit as FAIL', () => {
    const text = restoreReport(setup, { usageBytes: 1_200_000, projectedBytes: 1_000_000, matureProjectedBytes: 2_000_000, peakBytes: 6_000_000 }, timings);
    expect(text).toContain('| Usage over projection (limit 1.10) | 1.200: FAIL |');
    expect(text).toContain('| Peak over M (limit below 3) | 3.000: FAIL |');
  });
});

describe('benchmark capacity projection for the dataset counts', () => {
  it('should price the dataset counts with the measured bytes of each kind', () => {
    const dataset = {
      counts: { trades: 100, optionTrades: 30, expirations: 10, institutions: 1, accounts: 2, strategies: 1, positionChanges: 40, executions: 197, marks: 50, actions: 60 },
      dispositions: { complete: 11, declined: 12, answered: 13, declinedLater: 14, outstanding: 15 },
      closeReviewDispositions: { complete: 21, declined: 22, answered: 23, declinedLater: 24, outstanding: 25 },
    };
    const expected =
      2 * 70 + 3 * 30 + 5 * 10 + 7 * 4 + 11 * 20 + 13 * 20 + 17 * 100 + 19 * 97 +
      (23 * 11 + 29 * 12 + 31 * 13 + 37 * 14 + 41 * 15) +
      (43 * 21 + 47 * 22 + 53 * 23 + 59 * 24 + 61 * 25) +
      67 * 50 + 71 * 60;
    expect(projectForDataset(MEASURED_BYTES, dataset)).toBe(expected);
  });
});

describe('benchmark capacity rules', () => {
  it('should fail restored usage above the projection by more than 10 percent', () => {
    expect(usageVerdict(1_100_000, 1_000_000).ok).toBe(true);
    expect(usageVerdict(1_100_001, 1_000_000).ok).toBe(false);
    expect(usageVerdict(1_100_001, 1_000_000).ratio).toBeCloseTo(1.100001, 6);
    expect(usageVerdict(400_000, 1_000_000).ok).toBe(true);
  });

  it('should require the second Restore peak to stay below 3 times M', () => {
    expect(peakVerdict(2_999_999, 1_000_000).ok).toBe(true);
    expect(peakVerdict(3_000_000, 1_000_000).ok).toBe(false);
    expect(peakVerdict(1_500_000, 1_000_000).ratio).toBe(1.5);
  });
});

const DIGEST = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);

describe('benchmark artifact checks', () => {
  it('should refuse an artifact whose digest differs from the dataset record', () => {
    expect(artifactProblems(OTHER, { artifact: { fileDigest: DIGEST } }, { writer: 'bench:generate', artifactFileDigest: DIGEST })).toEqual([
      `the artifact's file digest ${OTHER} is not the dataset's ${DIGEST}`,
      `the expected rows are for artifact ${DIGEST}, not ${OTHER}`,
    ]);
    expect(artifactProblems(DIGEST, { artifact: { fileDigest: DIGEST } }, { writer: 'bench:generate', artifactFileDigest: DIGEST })).toEqual([]);
  });

  it('should refuse expected rows that the Node generator did not write', () => {
    expect(artifactProblems(DIGEST, { artifact: { fileDigest: DIGEST } }, { writer: 'bench:expected', artifactFileDigest: DIGEST })).toEqual([
      'the expected rows were written by bench:expected, not by bench:generate',
    ]);
    expect(artifactProblems(DIGEST, { artifact: { fileDigest: DIGEST } }, undefined)).toHaveLength(2);
  });
});

describe('benchmark cached projection check', () => {
  it('should refuse a cached projection that differs from the one computed now', () => {
    const fresh = { projectedBytes: 1_000_000, matureProjectedBytes: 2_000_000 };
    expect(cachedProjectionProblems({ projectedBytes: 1_000_000, matureProjectedBytes: 2_000_000 }, fresh)).toEqual([]);
    expect(cachedProjectionProblems({ projectedBytes: 5_000_000, matureProjectedBytes: 2_000_000 }, fresh)).toEqual([
      'the cached projection for the dataset counts 5000000 is not the recomputed 1000000: rerun measure:capacity -- --restored',
    ]);
    expect(cachedProjectionProblems({ projectedBytes: 1_000_000, matureProjectedBytes: 9_000_000 }, fresh)).toEqual([
      'the cached M 9000000 is not the embedded 2000000: rerun measure:capacity -- --restored',
    ]);
  });
});

describe('benchmark restored profile check', () => {
  it('should refuse a profile restored from an artifact other than the dataset record', () => {
    expect(profileProblems({ artifactDigest: OTHER }, DIGEST)).toEqual([`the cached profile was restored from artifact ${OTHER}, not ${DIGEST}: run npm run bench:setup`]);
    expect(profileProblems(undefined, DIGEST)).toHaveLength(1);
    expect(profileProblems({ artifactDigest: DIGEST }, DIGEST)).toEqual([]);
  });
});
