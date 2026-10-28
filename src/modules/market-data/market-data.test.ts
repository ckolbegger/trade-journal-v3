import { describe, expect, it } from 'vitest';
import { nyseSessionPolicy } from '../../domain/session-policy/index.ts';
import { fixedClock } from '../../domain/time/index.ts';
import type { RuntimeNotWritable } from '../../delivery/runtime-not-writable.ts';
import { createPersistence } from '../../persistence/index.ts';
import { IDBFactory } from 'fake-indexeddb';
import { sequentialIds } from '../../../tests/support/workspace.ts';
import { createMarketData, type MarketDataSaveCommand } from './index.ts';
import type { ObservationRecord } from './records.ts';

// T4.4: Manual Mark save (D4 P8, P9, P10, A35 to A38).

// Tuesday 2026-10-13 12:00 America/New_York.
const TUESDAY_NOON = '2026-10-13T16:00:00Z';

async function setup(now = TUESDAY_NOON) {
  // The gate reads `gate.refusal` at every write, so a test can turn the session unwritable later.
  const gate: { refusal: RuntimeNotWritable | null } = { refusal: null };
  const persistence = createPersistence({
    indexedDB: new IDBFactory(),
    ids: sequentialIds('ws'),
    writeGate: { current: () => gate.refusal, recheck: () => Promise.resolve(gate.refusal) },
    sessionPolicy: { ...nyseSessionPolicy.identity },
  });
  const created = await persistence.createWorkspace([]);
  if (created.kind !== 'Created') throw new Error('workspace not created');
  const marketData = createMarketData({
    persistence,
    ids: sequentialIds('rev'),
    clock: fixedClock(now),
    sessionPolicy: nyseSessionPolicy,
  });
  return { marketData, persistence, gate };
}

const initial = (overrides: Partial<Extract<MarketDataSaveCommand, { intention: 'RecordInitialManualMark' }>> = {}): MarketDataSaveCommand => ({
  intention: 'RecordInitialManualMark',
  instrumentKey: 'XYZ',
  tradingDate: '2026-10-12',
  price: '52',
  expectedResolutionRevision: 'None',
  ...overrides,
});

async function stored(persistence: Awaited<ReturnType<typeof setup>>['persistence']) {
  const { value } = await persistence.readSnapshot(['meta', 'observations'], async (tx) => ({
    observations: (await tx.getAll('observations')) as unknown as (ObservationRecord & { revision: number })[],
    marketDataRevision: (await tx.get('meta', 'marketDataRevision'))?.['marketDataRevision'],
    content: (await tx.get('meta', 'content'))?.['contentRevision'],
  }));
  return value;
}

const correct = (overrides: Partial<Extract<MarketDataSaveCommand, { intention: 'CorrectMark' }>> = {}): MarketDataSaveCommand => ({
  intention: 'CorrectMark',
  instrumentKey: 'XYZ',
  tradingDate: '2026-10-12',
  price: '51.50',
  reason: 'Typo: I read the wrong row',
  expectedResolutionRevision: 1,
  ...overrides,
});

describe('record an initial Manual Mark', () => {
  it('should append revision 1 (Manual, InitialManual, 52.00) for (XYZ, 2026-10-12) and return Saved with resolution Available, the new resolution revision, the saved-intention classification, and the accepted command binding', async () => {
    const { marketData, persistence } = await setup();
    const result = await marketData.save(initial());
    expect(result).toEqual({
      kind: 'Saved',
      key: { instrumentKey: 'XYZ', tradingDate: '2026-10-12' },
      resolution: { kind: 'Available', mark: { revisionId: 'rev-0001', revisionNumber: 1, price: '52', source: 'Manual' } },
      resolutionRevision: 1,
      classification: 'InitialManual',
      revision: {
        revisionId: 'rev-0001',
        revisionNumber: 1,
        price: '52',
        source: 'Manual',
        intention: 'InitialManual',
        observedAt: TUESDAY_NOON,
        savedAt: TUESDAY_NOON,
      },
      binding: { instrumentKey: 'XYZ', tradingDate: '2026-10-12', expectedResolutionRevision: 'None' },
    });
    const { observations } = await stored(persistence);
    expect(observations).toEqual([
      expect.objectContaining({
        instrumentKey: 'XYZ',
        tradingDate: '2026-10-12',
        resolutionRevision: 1,
        effectiveMarkId: 'rev-0001',
        marks: [expect.objectContaining({ revisionNumber: 1, price: '52', source: 'Manual', intention: 'InitialManual' })],
        acknowledgments: [],
        effectiveAcknowledgmentId: null,
      }),
    ]);
  });

  it('should store "52.000" as "52" without changing its exact value', async () => {
    const { marketData, persistence } = await setup();
    const result = await marketData.save(initial({ price: '52.000' }));
    expect(result).toMatchObject({ kind: 'Saved', resolution: { mark: { price: '52' } } });
    const { observations } = await stored(persistence);
    expect(observations[0]?.marks[0]?.price).toBe('52');
    const decimals = await marketData.save(initial({ instrumentKey: 'ABC', price: '0052.500' }));
    expect(decimals).toMatchObject({ revision: { price: '52.5' } });
  });

  it('should commit in one semantic commit that increments marketDataRevision and the Workspace content revision exactly once', async () => {
    const { marketData, persistence } = await setup();
    const before = await stored(persistence);
    expect(before.marketDataRevision).toBe(0);
    await marketData.save(initial());
    const after = await stored(persistence);
    expect(after.marketDataRevision).toBe(1);
    expect(after.content).toBe((before.content as number) + 1);
    // Every record the commit wrote carries that one content revision.
    expect(after.observations.map((o) => o.revision)).toEqual([after.content]);
    await marketData.save(initial({ instrumentKey: 'ABC' }));
    expect((await stored(persistence)).marketDataRevision).toBe(2);
  });

  it('should return Conflict with the current resolution and write nothing when the key already has a Mark', async () => {
    const { marketData, persistence } = await setup();
    await marketData.save(initial());
    const before = await stored(persistence);
    const result = await marketData.save(initial({ price: '53' }));
    expect(result).toEqual({
      kind: 'Conflict',
      key: { instrumentKey: 'XYZ', tradingDate: '2026-10-12' },
      resolution: { kind: 'Available', mark: { revisionId: 'rev-0001', revisionNumber: 1, price: '52', source: 'Manual' } },
      resolutionRevision: 1,
    });
    expect(await stored(persistence)).toEqual(before);
  });
});

describe('correct a believed-wrong Mark', () => {
  it('should append revision 2 (Correction, 51.50, reason, superseding revision 1) with its Correction Footprint (key, effect date 2026-10-12, save time, domains valuation, condition status, and replay, interval 2026-10-12 to 2026-10-12), make it effective, and keep revision 1', async () => {
    const { marketData, persistence } = await setup();
    await marketData.save(initial());
    const result = await marketData.save(correct());
    const revision2 = {
      revisionId: 'rev-0002',
      revisionNumber: 2,
      price: '51.5',
      source: 'Manual',
      intention: 'Correction',
      reason: 'Typo: I read the wrong row',
      supersedes: 'rev-0001',
      correctionFootprint: {
        key: { instrumentKey: 'XYZ', tradingDate: '2026-10-12' },
        effectDate: '2026-10-12',
        savedAt: TUESDAY_NOON,
        domains: ['Valuation', 'ConditionStatus', 'Replay'],
        replayInterval: { from: '2026-10-12', to: '2026-10-12' },
      },
      observedAt: TUESDAY_NOON,
      savedAt: TUESDAY_NOON,
    };
    expect(result).toEqual({
      kind: 'Saved',
      key: { instrumentKey: 'XYZ', tradingDate: '2026-10-12' },
      resolution: { kind: 'Available', mark: { revisionId: 'rev-0002', revisionNumber: 2, price: '51.5', source: 'Manual' } },
      resolutionRevision: 2,
      classification: 'Correction',
      revision: revision2,
      binding: { instrumentKey: 'XYZ', tradingDate: '2026-10-12', expectedResolutionRevision: 1 },
    });
    const { observations, marketDataRevision } = await stored(persistence);
    expect(marketDataRevision).toBe(2);
    expect(observations[0]).toEqual(
      expect.objectContaining({
        effectiveMarkId: 'rev-0002',
        resolutionRevision: 2,
        marks: [expect.objectContaining({ revisionId: 'rev-0001', price: '52', intention: 'InitialManual' }), revision2],
      }),
    );
  });

  it('should require a reason of 1 to 500 characters, returning ReasonRequired or ReasonTooLong', async () => {
    const { marketData, persistence } = await setup();
    await marketData.save(initial());
    const before = await stored(persistence);
    for (const reason of ['', '   ']) {
      expect(await marketData.save(correct({ reason }))).toEqual({ kind: 'Rejected', issues: [{ field: 'reason', code: 'ReasonRequired' }] });
    }
    expect(await marketData.save(correct({ reason: 'x'.repeat(501) }))).toEqual({
      kind: 'Rejected',
      issues: [{ field: 'reason', code: 'ReasonTooLong' }],
    });
    expect(await stored(persistence)).toEqual(before);
    const exact = await marketData.save(correct({ reason: 'x'.repeat(500) }));
    expect(exact).toEqual(expect.objectContaining({ kind: 'Saved' }));
  });

  it('should reject a correction to the effective price with CorrectionUnchanged and a correction for a key with no Mark with NothingToCorrect', async () => {
    const { marketData, persistence } = await setup();
    expect(await marketData.save(correct({ expectedResolutionRevision: 'None' }))).toEqual({
      kind: 'Rejected',
      issues: [{ field: 'price', code: 'NothingToCorrect' }],
    });
    await marketData.save(initial());
    const before = await stored(persistence);
    // "52.000" is the same exact value as the effective "52".
    expect(await marketData.save(correct({ price: '52.000' }))).toEqual({
      kind: 'Rejected',
      issues: [{ field: 'price', code: 'CorrectionUnchanged' }],
    });
    expect(await stored(persistence)).toEqual(before);
  });

  it('should return Conflict and write nothing when the expected resolution revision is stale', async () => {
    const { marketData, persistence } = await setup();
    await marketData.save(initial());
    await marketData.save(correct({ price: '51.50' }));
    const before = await stored(persistence);
    // Prepared against revision 1, but the key is now at revision 2.
    expect(await marketData.save(correct({ price: '50', expectedResolutionRevision: 1 }))).toEqual({
      kind: 'Conflict',
      key: { instrumentKey: 'XYZ', tradingDate: '2026-10-12' },
      resolution: { kind: 'Available', mark: { revisionId: 'rev-0002', revisionNumber: 2, price: '51.5', source: 'Manual' } },
      resolutionRevision: 2,
    });
    expect(await stored(persistence)).toEqual(before);
    // A key with no record binds as None: a number does not match it.
    expect(await marketData.save(initial({ instrumentKey: 'ABC', expectedResolutionRevision: 3 }))).toEqual(
      expect.objectContaining({ kind: 'Conflict', resolutionRevision: 'None', resolution: { kind: 'Missing' } }),
    );
  });
});

describe('concurrent saves', () => {
  it('should save one of two simultaneous initial Marks for a key and return Conflict for the other', async () => {
    const { marketData, persistence } = await setup();
    const results = await Promise.all([marketData.save(initial({ price: '52' })), marketData.save(initial({ price: '53' }))]);
    expect(results.map((r) => r.kind).sort()).toEqual(['Conflict', 'Saved']);
    const { observations, marketDataRevision } = await stored(persistence);
    expect(observations).toHaveLength(1);
    expect(observations[0]?.marks).toHaveLength(1);
    expect(marketDataRevision).toBe(1);
  });
});

describe('key and price validation (P8, P9, P10)', () => {
  it('should reject a well-shaped impossible date such as 2026-02-30 with InvalidDate and write nothing', async () => {
    const { marketData, persistence } = await setup();
    const before = await stored(persistence);
    for (const tradingDate of ['2026-02-30', '2026-13-01', '2026-00-10']) {
      expect(await marketData.save(initial({ tradingDate }))).toEqual({ kind: 'Rejected', issues: [{ field: 'tradingDate', code: 'InvalidDate' }] });
    }
    expect(await stored(persistence)).toEqual(before);
  });

  it('should reject a weekend, holiday, or closure date with NotASession and a date outside coverage with SessionPolicyCoverage', async () => {
    const { marketData, persistence } = await setup();
    const before = await stored(persistence);
    const weekend = '2026-10-10';
    const holiday = '2025-11-27'; // Thanksgiving
    const closure = '2025-01-09'; // National Day of Mourning
    for (const tradingDate of [weekend, holiday, closure]) {
      expect(await marketData.save(initial({ tradingDate }))).toEqual({ kind: 'Rejected', issues: [{ field: 'tradingDate', code: 'NotASession' }] });
    }
    for (const tradingDate of ['2023-12-29', '2029-01-02']) {
      expect(await marketData.save(initial({ tradingDate }))).toEqual({
        kind: 'Rejected',
        issues: [{ field: 'tradingDate', code: 'SessionPolicyCoverage' }],
      });
    }
    expect(await stored(persistence)).toEqual(before);
  });

  it('should reject Tuesday at Tuesday noon and at Tuesday 16:10 (closed but not completed), and any later date, with SessionNotCompleted', async () => {
    const notCompleted = { kind: 'Rejected', issues: [{ field: 'tradingDate', code: 'SessionNotCompleted' }] };
    const noon = await setup(TUESDAY_NOON);
    expect(await noon.marketData.save(initial({ tradingDate: '2026-10-13' }))).toEqual(notCompleted);
    expect(await noon.marketData.save(initial({ tradingDate: '2026-10-14' }))).toEqual(notCompleted);
    expect(await noon.marketData.save(initial({ tradingDate: '2026-11-02' }))).toEqual(notCompleted);
    // 16:10 New York is 20:10Z: the close was at 16:00, the completion is at 16:30.
    const afterClose = await setup('2026-10-13T20:10:00Z');
    expect(await afterClose.marketData.save(initial({ tradingDate: '2026-10-13' }))).toEqual(notCompleted);
    expect((await stored(afterClose.persistence)).observations).toEqual([]);
    // At the completion instant the session becomes a valid key.
    const completed = await setup('2026-10-13T20:30:00Z');
    expect(await completed.marketData.save(initial({ tradingDate: '2026-10-13' }))).toEqual(expect.objectContaining({ kind: 'Saved' }));
  });

  it('should accept a Mark for Tuesday at 16:30:00.500 on Tuesday, a fractional-second instant after the completion', async () => {
    const { marketData } = await setup('2026-10-13T20:30:00.500Z');
    expect(await marketData.save(initial({ tradingDate: '2026-10-13' }))).toEqual(expect.objectContaining({ kind: 'Saved' }));
  });

  it('should accept Friday 2026-10-09, because past completed sessions are valid keys', async () => {
    const { marketData } = await setup();
    const result = await marketData.save(initial({ tradingDate: '2026-10-09' }));
    expect(result).toEqual(expect.objectContaining({ kind: 'Saved', key: { instrumentKey: 'XYZ', tradingDate: '2026-10-09' } }));
  });

  it('should reject a malformed symbol with InvalidInstrument and a negative, non-finite, or over-precise price with InvalidPrice, all at once', async () => {
    const { marketData, persistence } = await setup();
    const before = await stored(persistence);
    // Every issue is reported together, never only the first.
    expect(await marketData.save(initial({ instrumentKey: 'xyz!', price: '1.2345678' }))).toEqual({
      kind: 'Rejected',
      issues: [
        { field: 'instrumentKey', code: 'InvalidInstrument' },
        { field: 'price', code: 'InvalidPrice' },
      ],
    });
    expect(await marketData.save(initial({ instrumentKey: '', tradingDate: '2026-10-10', price: 'NaN' }))).toEqual({
      kind: 'Rejected',
      issues: [
        { field: 'instrumentKey', code: 'InvalidInstrument' },
        { field: 'tradingDate', code: 'NotASession' },
        { field: 'price', code: 'InvalidPrice' },
      ],
    });
    for (const price of ['', 'Infinity', '-Infinity', 'NaN', '1e3', '12,5', ' 5', '0.0000001']) {
      expect(await marketData.save(initial({ price }))).toEqual({ kind: 'Rejected', issues: [{ field: 'price', code: 'InvalidPrice' }] });
    }
    // A negative price is its own failure (A37, amended by D7 P27).
    expect(await marketData.save(initial({ price: '-0.01' }))).toEqual({ kind: 'Rejected', issues: [{ field: 'price', code: 'PriceNegative' }] });
    expect(await marketData.save(initial({ tradingDate: '10/12/2026' }))).toEqual({
      kind: 'Rejected',
      issues: [{ field: 'tradingDate', code: 'InvalidDate' }],
    });
    expect(await stored(persistence)).toEqual(before);
    // A Mark may be exactly 0 (A37).
    expect(await marketData.save(initial({ instrumentKey: 'DEAD', price: '0.00' }))).toMatchObject({ kind: 'Saved', resolution: { mark: { price: '0' } } });
  });

  it('should reject OverrideManualValuation with VariantNotInstalled', async () => {
    const { marketData, persistence } = await setup();
    const before = await stored(persistence);
    const result = await marketData.save({ ...initial(), intention: 'OverrideManualValuation' });
    expect(result).toEqual({ kind: 'VariantNotInstalled', intention: 'OverrideManualValuation' });
    expect(await stored(persistence)).toEqual(before);
  });
});

describe('write gate', () => {
  it('should return RuntimeNotWritable and write nothing when the mutation-boundary readiness recheck fails', async () => {
    const { marketData, persistence, gate } = await setup();
    await marketData.save(initial());
    const before = await stored(persistence);
    const refusal: RuntimeNotWritable = {
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'RecoveryOnly',
      failedChecks: [{ check: 'inventory', reason: 'InventoryInvalid' }],
      workspaceStatus: 'RecoveryOnly',
      safeActions: [{ action: 'Retry', explanation: 'Check again once the problem is fixed.' }],
    };
    gate.refusal = refusal;
    expect(await marketData.save(correct())).toEqual(refusal);
    expect(await marketData.save(initial({ instrumentKey: 'ABC' }))).toEqual(refusal);
    expect(await stored(persistence)).toEqual(before);
  });
});
