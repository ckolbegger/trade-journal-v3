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
    meta: (await tx.getAll('meta')) as unknown as { key: string; revision?: number }[],
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

  it('should commit in one semantic commit that increments the Workspace content revision exactly once and writes only the key observation record', async () => {
    const { marketData, persistence } = await setup();
    const before = await stored(persistence);
    await marketData.save(initial());
    const after = await stored(persistence);
    expect(after.content).toBe((before.content as number) + 1);
    // Every record the commit wrote carries that one content revision: the observation, and no meta record.
    expect(after.observations.map((o) => o.revision)).toEqual([after.content]);
    const unchanged = (m: { key: string }) => m.key !== 'content';
    expect(after.meta.filter(unchanged)).toEqual(before.meta.filter(unchanged));
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
    const { observations } = await stored(persistence);
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
    const { observations } = await stored(persistence);
    expect(observations).toHaveLength(1);
    expect(observations[0]?.marks).toHaveLength(1);
  });

  it('should save both of two simultaneous initial Marks for different keys', async () => {
    const { marketData, persistence } = await setup();
    const results = await Promise.all([marketData.save(initial({ instrumentKey: 'AAA' })), marketData.save(initial({ instrumentKey: 'BBB' }))]);
    expect(results.map((r) => r.kind)).toEqual(['Saved', 'Saved']);
    const { observations } = await stored(persistence);
    expect(observations).toHaveLength(2);
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
    const result = await marketData.save({ intention: 'OverrideManualValuation', instrumentKey: 'XYZ', tradingDate: '2026-10-12', price: '52', expectedResolutionRevision: 'None' });
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

// T4.5: acknowledgments and resolution precedence (D4 A35, A36, A47; AC-MARK-003).

const FRIDAY_CLOSE = '2026-10-09T20:00:00Z';

const assertUnavailable = (overrides: Partial<Extract<MarketDataSaveCommand, { intention: 'AssertUnavailable' }>> = {}): MarketDataSaveCommand => ({
  intention: 'AssertUnavailable',
  instrumentKey: 'DEF',
  tradingDate: '2026-10-12',
  reason: 'Halted, no close printed',
  expectedResolutionRevision: 'None',
  ...overrides,
});

describe('assert unavailable (AC-MARK-003)', () => {
  it('should append an Asserted acknowledgment with its reason and time, and no price, for DEF 2026-10-12, returning AcknowledgedUnavailable with Stale context and the new resolution revision', async () => {
    const { marketData, persistence } = await setup();
    await marketData.save(initial({ instrumentKey: 'DEF', tradingDate: '2026-10-09', price: '51.20' }));
    const result = await marketData.save(assertUnavailable());
    const version = { versionId: 'rev-0002', kind: 'Asserted', reason: 'Halted, no close printed', savedAt: TUESDAY_NOON };
    expect(result).toEqual({
      kind: 'Saved',
      key: { instrumentKey: 'DEF', tradingDate: '2026-10-12' },
      resolution: {
        kind: 'AcknowledgedUnavailable',
        acknowledgment: version,
        stale: { tradingDate: '2026-10-09', price: '51.2', revisionId: 'rev-0001', revisionNumber: 1, closeInstant: FRIDAY_CLOSE },
      },
      resolutionRevision: 1,
      classification: 'Asserted',
      acknowledgment: version,
      binding: { instrumentKey: 'DEF', tradingDate: '2026-10-12', expectedResolutionRevision: 'None' },
    });
    const { observations } = await stored(persistence);
    const record = observations.find((o) => o.tradingDate === '2026-10-12')!;
    expect(record.marks).toEqual([]);
    expect(record.acknowledgments).toEqual([version]);
    expect(record.effectiveAcknowledgmentId).toBe('rev-0002');
  });
});

describe('assert rejections', () => {
  it('should reject assert on a key with an effective Mark with MarkExists, and a blank or over-long reason', async () => {
    const { marketData, persistence } = await setup();
    await marketData.save(initial({ instrumentKey: 'DEF' }));
    const before = await stored(persistence);
    expect(await marketData.save(assertUnavailable({ expectedResolutionRevision: 1 }))).toEqual({
      kind: 'Rejected',
      issues: [{ field: 'key', code: 'MarkExists' }],
    });
    expect(await marketData.save(assertUnavailable({ instrumentKey: 'ABC', reason: '   ' }))).toEqual({
      kind: 'Rejected',
      issues: [{ field: 'reason', code: 'ReasonRequired' }],
    });
    expect(await marketData.save(assertUnavailable({ instrumentKey: 'ABC', reason: 'x'.repeat(501) }))).toEqual({
      kind: 'Rejected',
      issues: [{ field: 'reason', code: 'ReasonTooLong' }],
    });
    expect(await stored(persistence)).toEqual(before);
  });
});

describe('assert for a past session', () => {
  it('should accept assert for a past session, so a skipped day can be acknowledged', async () => {
    const { marketData, persistence } = await setup();
    const result = await marketData.save(assertUnavailable({ tradingDate: '2026-10-09' }));
    expect(result).toMatchObject({
      kind: 'Saved',
      key: { instrumentKey: 'DEF', tradingDate: '2026-10-09' },
      resolution: { kind: 'AcknowledgedUnavailable' },
      resolutionRevision: 1,
    });
    const { observations } = await stored(persistence);
    expect(observations).toEqual([expect.objectContaining({ tradingDate: '2026-10-09', effectiveAcknowledgmentId: 'rev-0001' })]);
  });
});

const withdraw = (overrides: Partial<Extract<MarketDataSaveCommand, { intention: 'WithdrawAcknowledgment' }>> = {}): MarketDataSaveCommand => ({
  intention: 'WithdrawAcknowledgment',
  instrumentKey: 'DEF',
  tradingDate: '2026-10-12',
  expectedResolutionRevision: 1,
  ...overrides,
});

describe('withdraw', () => {
  it('should append a Withdrawn version, return Missing, and keep the assertion in history', async () => {
    const { marketData, persistence } = await setup();
    await marketData.save(initial({ instrumentKey: 'DEF', tradingDate: '2026-10-09', price: '51.20' }));
    await marketData.save(assertUnavailable());
    const result = await marketData.save(withdraw({ reason: 'Close was printed after all' }));
    const withdrawn = { versionId: 'rev-0003', kind: 'Withdrawn', reason: 'Close was printed after all', savedAt: TUESDAY_NOON };
    expect(result).toEqual({
      kind: 'Saved',
      key: { instrumentKey: 'DEF', tradingDate: '2026-10-12' },
      resolution: {
        kind: 'Missing',
        stale: { tradingDate: '2026-10-09', price: '51.2', revisionId: 'rev-0001', revisionNumber: 1, closeInstant: FRIDAY_CLOSE },
      },
      resolutionRevision: 2,
      classification: 'Withdrawn',
      acknowledgment: withdrawn,
      binding: { instrumentKey: 'DEF', tradingDate: '2026-10-12', expectedResolutionRevision: 1 },
    });
    const { observations } = await stored(persistence);
    const record = observations.find((o) => o.tradingDate === '2026-10-12')!;
    expect(record.acknowledgments.map((a) => [a.versionId, a.kind])).toEqual([['rev-0002', 'Asserted'], ['rev-0003', 'Withdrawn']]);
    expect(record.effectiveAcknowledgmentId).toBe('rev-0003');
  });
});

describe('withdraw rejections', () => {
  it('should reject withdraw when no assertion is effective with NothingToWithdraw', async () => {
    const { marketData, persistence } = await setup();
    const nothing = { kind: 'Rejected', issues: [{ field: 'key', code: 'NothingToWithdraw' }] };
    // No record at all.
    expect(await marketData.save(withdraw({ expectedResolutionRevision: 'None' }))).toEqual(nothing);
    // An assertion that was already withdrawn.
    await marketData.save(assertUnavailable());
    await marketData.save(withdraw());
    const before = await stored(persistence);
    expect(await marketData.save(withdraw({ expectedResolutionRevision: 2 }))).toEqual(nothing);
    // A key with an effective Mark and no assertion.
    await marketData.save(initial({ instrumentKey: 'ABC' }));
    expect(await marketData.save(withdraw({ instrumentKey: 'ABC', expectedResolutionRevision: 1 }))).toEqual(nothing);
    expect((await stored(persistence)).observations).toHaveLength(before.observations.length + 1);
  });
});

describe('precedence', () => {
  it('should resolve Available when an exact Mark is saved after an acknowledgment, keeping the acknowledgment history', async () => {
    const { marketData, persistence } = await setup();
    await marketData.save(assertUnavailable({ instrumentKey: 'XYZ' }));
    const result = await marketData.save(initial({ expectedResolutionRevision: 1 }));
    expect(result).toMatchObject({
      kind: 'Saved',
      classification: 'InitialManual',
      resolution: { kind: 'Available', mark: { revisionId: 'rev-0002', price: '52' } },
      resolutionRevision: 2,
    });
    const { observations } = await stored(persistence);
    expect(observations[0]!.acknowledgments).toEqual([
      { versionId: 'rev-0001', kind: 'Asserted', reason: 'Halted, no close printed', savedAt: TUESDAY_NOON },
    ]);
    expect(observations[0]!.effectiveAcknowledgmentId).toBe('rev-0001');
  });
});

describe('no price for an acknowledged key', () => {
  it('should never return a price for an acknowledged key', async () => {
    const { marketData, persistence } = await setup();
    await marketData.save(initial({ instrumentKey: 'DEF', tradingDate: '2026-10-09', price: '51.20' }));
    const result = await marketData.save(assertUnavailable());
    if (result.kind !== 'Saved' || !('acknowledgment' in result)) throw new Error('not an acknowledgment save');
    expect(result.resolution.kind).toBe('AcknowledgedUnavailable');
    expect(result.resolution).not.toHaveProperty('mark');
    expect(result.resolution).not.toHaveProperty('price');
    expect(result.acknowledgment).not.toHaveProperty('price');
    const { observations } = await stored(persistence);
    const record = observations.find((o) => o.tradingDate === '2026-10-12')!;
    expect(record.marks).toEqual([]);
    expect(record.effectiveMarkId).toBeNull();
  });
});

describe('acknowledgment saves keep the shared save guarantees', () => {
  it('should return Conflict for an acknowledgment prepared against an old resolution revision, and RuntimeNotWritable when the gate refuses, writing nothing', async () => {
    const { marketData, persistence, gate } = await setup();
    await marketData.save(assertUnavailable());
    const before = await stored(persistence);
    expect(await marketData.save(assertUnavailable({ expectedResolutionRevision: 'None' }))).toMatchObject({
      kind: 'Conflict',
      resolutionRevision: 1,
      resolution: { kind: 'AcknowledgedUnavailable' },
    });
    expect(await marketData.save(withdraw({ expectedResolutionRevision: 7 }))).toMatchObject({ kind: 'Conflict', resolutionRevision: 1 });
    const refusal: RuntimeNotWritable = {
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'RecoveryOnly',
      failedChecks: [{ check: 'inventory', reason: 'InventoryInvalid' }],
      workspaceStatus: 'RecoveryOnly',
      safeActions: [{ action: 'Retry', explanation: 'Check again once the problem is fixed.' }],
    };
    gate.refusal = refusal;
    expect(await marketData.save(withdraw({ expectedResolutionRevision: 1 }))).toEqual(refusal);
    expect(await stored(persistence)).toEqual(before);
  });

  it('should reject an acknowledgment for a malformed symbol, a weekend, and a session not yet completed, as a Mark does', async () => {
    const { marketData, persistence } = await setup();
    const result = await marketData.save(assertUnavailable({ instrumentKey: 'bad key', tradingDate: '2026-10-10' }));
    expect(result).toEqual({
      kind: 'Rejected',
      issues: [{ field: 'instrumentKey', code: 'InvalidInstrument' }, { field: 'tradingDate', code: 'NotASession' }],
    });
    expect(await marketData.save(assertUnavailable({ tradingDate: '2026-10-13' }))).toEqual({
      kind: 'Rejected',
      issues: [{ field: 'tradingDate', code: 'SessionNotCompleted' }],
    });
    expect((await stored(persistence)).observations).toEqual([]);
  });
});

describe('Stale context lookup bound (T4.5-B1)', () => {
  it('should look up Stale context within the Instrument own byInstrumentDate range, visiting no other Instrument records, when the Instrument has no earlier Mark', async () => {
    const { marketData, persistence } = await setup();
    for (const tradingDate of ['2026-10-07', '2026-10-08', '2026-10-09']) {
      await marketData.save(initial({ instrumentKey: 'AAA', tradingDate }));
    }
    const visited: unknown[] = [];
    const spying: typeof persistence = {
      ...persistence,
      readSnapshot: (stores, read) =>
        persistence.readSnapshot(stores, (tx) =>
          read({
            ...tx,
            findLastFromIndex: (store, index, range, accept) =>
              tx.findLastFromIndex(store, index, range, (r) => {
                visited.push(r['instrumentKey']);
                return accept(r);
              }),
          }),
        ),
    };
    const watched = createMarketData({ persistence: spying, ids: sequentialIds('spy'), clock: fixedClock(TUESDAY_NOON), sessionPolicy: nyseSessionPolicy });
    const result = await watched.save(assertUnavailable());
    expect(result.kind).toBe('Saved');
    expect(visited.filter((k) => k !== 'DEF')).toEqual([]);
  });
});
