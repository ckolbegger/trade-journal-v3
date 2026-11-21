// I9R2.1 The open's previous session and earlier Marks (A288, P155), through the real facade on fake-indexeddb: CORV held by two Trades (the put
// Trade from Tue 11-10, a stock Trade opened Thu 11-12), R-CORV-D's mixed Tue 11-10 (a CORV Mark, no put Mark), and a Trade on NEWX opened on
// the Review Date Mon 11-16.
import { describe, expect, it } from 'vitest';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { CORV_PUT } from '../../../src/domain/trade-analysis/option-trade.ts';
import { marksFamily, openReady, sharedBook } from './support.ts';

const PUT = instrumentKey(CORV_PUT);

describe('I9R2.1 The open lists the previous session and each Instrument earlier Marks (A288)', () => {
  it('I9R2.1 should give the previous session, each holding Trade with its first relevant session, the Available Marks only and nothing for an Instrument opened on the Review Date', { timeout: 120_000 }, async () => {
    const { app, tradeIds } = await sharedBook();
    const [put, later] = tradeIds as [string, string, string];

    const family = marksFamily(await openReady(app));

    // Catches a previousSession that is absent or taken from another date.
    expect(family.previousSession).toBe('2026-11-13');
    // Catches an Instrument opened on the Review Date being listed (NEWX has no earlier session) or an exposed one dropped.
    expect([...family.earlierMarks.map((g) => g.instrumentKey)].sort()).toEqual(['CORV', PUT].sort());
    const byKey = (key: string) => family.earlierMarks.find((g) => g.instrumentKey === key);
    // Catches a Trade missing from the group of an Instrument two Trades hold, or a wrong first relevant session.
    expect(byKey('CORV')?.trades).toHaveLength(2);
    expect(byKey('CORV')?.trades).toEqual(expect.arrayContaining([{ tradeId: put, from: '2026-11-10' }, { tradeId: later, from: '2026-11-13' }]));
    expect(byKey(PUT)?.trades).toEqual([{ tradeId: put, from: '2026-11-10' }]);
    // Catches Missing or acknowledged dates leaking into marks (the put has none on 11-10, and it travels in the gap groups), and a lost Available one.
    expect(Object.keys(byKey('CORV')?.marks ?? {})).toEqual(['2026-11-10', '2026-11-13']);
    expect(Object.keys(byKey(PUT)?.marks ?? {})).toEqual(['2026-11-13']);
    expect(family.earlier).toEqual([expect.objectContaining({ instrumentKey: PUT, missing: ['2026-11-10'], acknowledged: [] })]);
    // Catches a missing resolution revision (the binding of a later Correct, A290) and a resolution that is not the Available Mark.
    expect(byKey('CORV')?.marks['2026-11-10']).toEqual({ resolution: { kind: 'Available', mark: expect.objectContaining({ price: '76.2', revisionNumber: 1 }) as unknown }, resolutionRevision: 1 });
    expect(byKey(PUT)?.marks['2026-11-13']?.resolutionRevision).toBe(1);
    // The Review Date's own Marks stay in today, including the new Trade's.
    expect(family.today.map((row) => row.instrumentKey)).toContain('NEWX');
  });
});
