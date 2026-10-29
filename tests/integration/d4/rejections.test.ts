// I4.8: Mark rejections write nothing (AC-MARK-001 and A37 partial).
import { describe, expect, it } from 'vitest';
import { device, dumpAll, MONDAY, MONDAY_1700, onboarded, saveMark } from './support.ts';

const initial = (tradingDate: string, price: string) =>
  ({ intention: 'RecordInitialManualMark', instrumentKey: 'XYZ', tradingDate, price, expectedResolutionRevision: 'None' }) as const;
const rejected = (field: string, code: string) => ({ kind: 'Rejected', issues: [expect.objectContaining({ field, code })] });

describe('I4.8 Mark rejections write nothing', () => {
  it('should reject a Saturday, Thanksgiving 2026, a 2030 date, a negative price, a blank correction reason, an initial Mark on an existing key and an acknowledgment on a key with a Mark, with every store unchanged', async () => {
    const d = await device(undefined, MONDAY_1700);
    const app = await onboarded(d);
    const first = await saveMark(app, 'XYZ', MONDAY, '52.00');
    const before = await dumpAll(d.factory);
    const key = { instrumentKey: 'XYZ', tradingDate: MONDAY };

    expect(await app.MarketData.save(initial('2026-10-10', '52.00'))).toEqual(rejected('tradingDate', 'NotASession'));
    expect(await app.MarketData.save(initial('2026-11-26', '52.00'))).toEqual(rejected('tradingDate', 'NotASession'));
    // A 2030 date is outside the session policy's coverage (decision 54).
    expect(await app.MarketData.save(initial('2030-01-02', '52.00'))).toEqual(rejected('tradingDate', 'SessionPolicyCoverage'));
    expect(await app.MarketData.save(initial('2026-10-09', '-1'))).toEqual(rejected('price', 'PriceNegative'));
    expect(
      await app.MarketData.save({ intention: 'CorrectMark', ...key, price: '51.50', reason: '   ', expectedResolutionRevision: first.resolutionRevision }),
    ).toEqual(rejected('reason', 'ReasonRequired'));
    expect(await app.MarketData.save({ ...initial(MONDAY, '51.00') })).toEqual(expect.objectContaining({ kind: 'Conflict', key, resolutionRevision: 1 }));
    expect(
      await app.MarketData.save({ intention: 'AssertUnavailable', ...key, reason: 'No quote.', expectedResolutionRevision: first.resolutionRevision }),
    ).toEqual(rejected('key', 'MarkExists'));
    expect(await dumpAll(d.factory)).toEqual(before);

    // Tuesday at 16:10 the session has closed but is not yet completed.
    const tuesday = await device(undefined, '2026-10-13T20:10:00Z');
    const tuesdayApp = await onboarded(tuesday);
    const tuesdayBefore = await dumpAll(tuesday.factory);
    expect(await tuesdayApp.MarketData.save(initial('2026-10-13', '52.00'))).toEqual(rejected('tradingDate', 'SessionNotCompleted'));
    expect(await dumpAll(tuesday.factory)).toEqual(tuesdayBefore);
  });
});
