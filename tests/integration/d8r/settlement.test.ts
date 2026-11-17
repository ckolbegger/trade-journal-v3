// I8R.3: the Settlement Due Detail's Underlying Marks (A234) on O-S2X, through the real facade on fake-indexeddb.
import { describe, expect, it } from 'vitest';
import { Rational } from '../../../src/domain/values/index.ts';
import { at, MONDAY_NOV_23_1800, openDetailOf, os2x, restart, saveMark, WEDNESDAY_NOV_25_1800 } from './support.ts';

describe('I8R.3 Settlement Due', () => {
  it('I8R.3 Settlement Due', { timeout: 120_000 }, async () => {
    const { d, app, tradeId } = await os2x(MONDAY_NOV_23_1800);
    await saveMark(app, 'MNO', '2026-11-20', '45.50');
    await saveMark(app, 'MNO', '2026-11-23', '44.25');

    // Mon 11-23 18:00: Today's and Yesterday's Marks and the change between them.
    const monday = await openDetailOf(await restart(app, d), tradeId);
    expect(monday.settlement).toHaveLength(1);
    expect(monday.marksColumns).toEqual({ today: { date: '2026-11-23', next: false }, yesterday: '2026-11-20' });
    const { today, yesterday, change } = monday.settlementUnderlying!;
    expect(today).toMatchObject({ kind: 'Available', tradingDate: '2026-11-23', price: '44.25' });
    expect(yesterday).toMatchObject({ kind: 'Available', tradingDate: '2026-11-20', price: '45.5' });
    expect(change).toEqual({ since: '2026-11-20', dollars: Rational.of(-5n, 4n) });

    // Wed 11-25 18:00: neither session has a Mark, so both are gaps and there is no change.
    const wednesday = await openDetailOf(await restart(app, at(d, WEDNESDAY_NOV_25_1800)), tradeId);
    expect(wednesday.settlementUnderlying!.today).toMatchObject({ kind: 'Missing', tradingDate: '2026-11-25' });
    expect(wednesday.settlementUnderlying!.yesterday).toMatchObject({ kind: 'Missing', tradingDate: '2026-11-24' });
    expect(wednesday.settlementUnderlying).not.toHaveProperty('change');
  });
});
