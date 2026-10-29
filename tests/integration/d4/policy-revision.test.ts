// I4.11: a session-policy revision change on an existing Workspace (D4 A40). The test policy passed to
// the composition root replaces the release's only in its table and revision (section 6.0).
import { describe, expect, it } from 'vitest';
import { createSessionPolicy, nyseSessionPolicy } from '../../../src/domain/session-policy/index.ts';
import { NYSE_TABLE } from '../../../src/domain/session-policy/table.ts';
import type { TableRow } from '../../../src/domain/session-policy/types.ts';
import { dumpAll, MONDAY, openItem, referenceTrade, restartWithPolicy, saveMark, workspaceStores, type StoredObservation } from './support.ts';

// The plan names Wednesday 17:00, but that is an ordinary session on which 2026-10-14 stays the
// Expected Mark Date. Tuesday 17:00 is the instant on which closing 2026-10-13 moves it to 2026-10-12.
const TUESDAY_1700 = '2026-10-13T21:00:00Z';
const TUESDAY = '2026-10-13';
const COVERAGE = nyseSessionPolicy.identity.coverage;
const CLOSURE: TableRow = { date: TUESDAY, kind: 'Closure', name: 'Test closure', source: { name: 'test', url: 'https://example.invalid/test' } };

const revision2 = createSessionPolicy({ id: 'nyse', revision: 2, coverage: { first: COVERAGE.first, last: '2030-12-31' }, table: NYSE_TABLE });
const revision3 = createSessionPolicy({ id: 'nyse', revision: 3, coverage: { first: COVERAGE.first, last: '2030-12-31' }, table: [...NYSE_TABLE, CLOSURE] });

const storedPolicy = async (factory: Parameters<typeof dumpAll>[0]) =>
  (workspaceStores(await dumpAll(factory))['meta'] as { key: string; policy?: { revision: number } }[]).find((m) => m.key === 'sessionPolicy')?.policy;

describe('I4.11 session-policy revision change', () => {
  it('should record revision 2 with no findings, then list the 2026-10-13 record as a finding under revision 3, keep it, skip it in the frames and make 2026-10-12 the Expected Mark Date', async () => {
    const { d, app, tradeId } = await referenceTrade(TUESDAY_1700);
    await saveMark(app, 'XYZ', MONDAY, '52.00');
    await saveMark(app, 'XYZ', TUESDAY, '53.00');
    expect((await openItem(app, tradeId)).current.expectedMarkDate).toBe(TUESDAY);
    expect(await storedPolicy(d.factory)).toMatchObject({ id: 'nyse', revision: 1 });
    const marksBefore = workspaceStores(await dumpAll(d.factory))['observations'] as StoredObservation[];

    // Revision 2 extends coverage: nothing is found, and the stored identity moves.
    const second = await restartWithPolicy(app, d, revision2);
    const opened2 = await second.Workspace.initialize({});
    expect(opened2.kind === 'Opened' && opened2.receipt.sessionPolicy).toEqual({
      previous: expect.objectContaining({ revision: 1 }) as unknown,
      recorded: revision2.identity,
      findings: [],
    });
    expect(await storedPolicy(d.factory)).toMatchObject({ revision: 2, coverage: { last: '2030-12-31' } });
    expect((await openItem(second, tradeId)).current.expectedMarkDate).toBe(TUESDAY);

    // Revision 3 closes 2026-10-13: the record is reported and kept, and no frame uses it.
    const third = await restartWithPolicy(second, d, revision3);
    const opened3 = await third.Workspace.initialize({});
    expect(opened3.kind === 'Opened' && opened3.receipt.sessionPolicy).toEqual({
      previous: expect.objectContaining({ revision: 2 }) as unknown,
      recorded: revision3.identity,
      findings: [{ code: 'NotASession', instrumentKey: 'XYZ', tradingDate: TUESDAY }],
    });
    expect(await storedPolicy(d.factory)).toMatchObject({ revision: 3 });
    expect(workspaceStores(await dumpAll(d.factory))['observations']).toEqual(marksBefore);

    const current = (await openItem(third, tradeId)).current;
    expect(current.expectedMarkDate).toBe(MONDAY);
    expect(current.markResolution).toEqual({ kind: 'Available', mark: expect.objectContaining({ price: '52' }) as unknown });
  });
});
