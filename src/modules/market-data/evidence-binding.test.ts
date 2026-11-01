import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { nyseSessionPolicy } from '../../domain/session-policy/index.ts';
import { fixedClock } from '../../domain/time/index.ts';
import { beginSemanticTransaction, createPersistence } from '../../persistence/index.ts';
import { sequentialIds } from '../../../tests/support/workspace.ts';
import { createMarketData, type MarketDataSaveCommand } from './index.ts';

// T5R2.14: the Review frames carry the evidence binding they were read under (D5R2 P54, A176).

// Tuesday 2026-10-13 12:00 America/New_York: the Review Date 2026-10-12 is completed.
const TUESDAY_NOON = '2026-10-13T16:00:00Z';
const REVIEW_DATE = '2026-10-12';

async function setup() {
  const persistence = createPersistence({
    indexedDB: new IDBFactory(),
    ids: sequentialIds('ws'),
    writeGate: { current: () => null, recheck: () => Promise.resolve(null) },
    sessionPolicy: { ...nyseSessionPolicy.identity },
  });
  const created = await persistence.createWorkspace([]);
  if (created.kind !== 'Created') throw new Error('workspace not created');
  const marketData = createMarketData({ persistence, ids: sequentialIds('rev'), clock: fixedClock(TUESDAY_NOON), sessionPolicy: nyseSessionPolicy });
  // The card fixture: XYZ has a Mark on the Review Date; DEF has none and its Stale-context source is the Friday Mark.
  await marketData.save(initial('XYZ', REVIEW_DATE, '52'));
  await marketData.save(initial('DEF', '2026-10-09', '51.20'));
  return { marketData, persistence };
}

const initial = (instrumentKey: string, tradingDate: string, price: string): MarketDataSaveCommand => ({
  intention: 'RecordInitialManualMark',
  instrumentKey,
  tradingDate,
  price,
  expectedResolutionRevision: 'None',
});

const correct = (instrumentKey: string, tradingDate: string, price: string): MarketDataSaveCommand => ({
  intention: 'CorrectMark',
  instrumentKey,
  tradingDate,
  price,
  reason: 'Typo',
  expectedResolutionRevision: 1,
});

type Fixture = Awaited<ReturnType<typeof setup>>;

async function readFrames({ marketData }: Fixture) {
  const result = await marketData.query({ kind: 'ResolveFrames', context: { kind: 'Review', reviewDate: REVIEW_DATE }, instruments: ['DEF', 'XYZ'] });
  if (result.kind !== 'Frames') throw new Error(`expected Frames, got ${result.kind}`);
  return result.evidenceBinding;
}

async function commitBinding({ marketData, persistence }: Fixture, binding: Awaited<ReturnType<typeof readFrames>>) {
  const tx = beginSemanticTransaction();
  marketData.bindEvidence(tx, binding);
  return persistence.commit(tx.close());
}

describe('evidence binding (A176)', () => {
  it('should fail a commit that binds the frames evidence, naming mark:XYZ@2026-10-12, when the XYZ Review-date Mark is corrected after the frames were read', async () => {
    const fixture = await setup();
    const binding = await readFrames(fixture);
    expect((await fixture.marketData.save(correct('XYZ', REVIEW_DATE, '53'))).kind).toBe('Saved');
    expect(await commitBinding(fixture, binding)).toEqual({ kind: 'Conflict', binding: 'mark:XYZ@2026-10-12' });
  });

  it('should fail it, naming mark:DEF@2026-10-12, when a Mark is saved for the DEF Review date, which had no record when the frames were read', async () => {
    const fixture = await setup();
    const binding = await readFrames(fixture);
    expect((await fixture.marketData.save(initial('DEF', REVIEW_DATE, '51.5'))).kind).toBe('Saved');
    expect(await commitBinding(fixture, binding)).toEqual({ kind: 'Conflict', binding: 'mark:DEF@2026-10-12' });
  });

  it('should fail it when the Stale-context source of the DEF frame is corrected', async () => {
    const fixture = await setup();
    const binding = await readFrames(fixture);
    expect((await fixture.marketData.save(correct('DEF', '2026-10-09', '51.3'))).kind).toBe('Saved');
    expect(await commitBinding(fixture, binding)).toEqual({ kind: 'Conflict', binding: 'mark:DEF@2026-10-09' });
  });

  it('should commit when nothing bound changed, including when a Mark for an Instrument outside the request is saved', async () => {
    const fixture = await setup();
    const binding = await readFrames(fixture);
    expect((await fixture.marketData.save(initial('ABC', REVIEW_DATE, '27.5'))).kind).toBe('Saved');
    expect((await commitBinding(fixture, binding)).kind).toBe('Committed');
  });
});
