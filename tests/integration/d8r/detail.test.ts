// I8R.1, I8R.4 and I8R.5: the Detail's trigger distances, the open lots' average and the before-Marks due date, through the real
// facade on fake-indexeddb (D08R plan section 7.1). Each re-proves behavior that T8R.18, T8R.19 and T8R.23 built.
import { describe, expect, it } from 'vitest';
import { Rational } from '../../../src/domain/values/index.ts';
import {
  at, breachedStock, DATES, detailOf, evaluationOf, FRIDAY_1200, FRIDAY_1800, oc3, oc3BeforeMarks, oc3Plus, openDetailOf, restart,
} from './support.ts';

const r = (n: bigint, d = 1n) => Rational.of(n, d);
const showBigints = (_key: string, value: unknown) => (typeof value === 'bigint' ? `${value}n` : value);

// Every object in a view that names `reason: 'AwaitingClose'`, wherever it sits.
function awaitingCloses(node: unknown, found: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) node.forEach((item) => awaitingCloses(item, found));
  else if (node !== null && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (record['reason'] === 'AwaitingClose') found.push(record);
    Object.values(record).forEach((item) => awaitingCloses(item, found));
  }
  return found;
}

// Each condition as [id, trigger distance, trigger beyond].
const triggers = (conditions: readonly { id: string; result: { kind: string; value?: { trigger?: { distance: Rational; beyond: Rational | null } } } }[]) =>
  conditions.map((c) => [c.id, c.result.value?.trigger?.distance, c.result.value?.trigger?.beyond]);

describe('I8R.1 Trigger distance and dated distances (AC-CALC-003, re-proven)', () => {
  it('I8R.1 Trigger distance and dated distances (AC-CALC-003, re-proven)', { timeout: 120_000 }, async () => {
    const { d, app, tradeId } = await oc3({ thursdayHold: true });

    // Thu 10-15 18:00: the Stop's distance in the option's price (3.20 to 1.00), the Target's in XYZ's (57.90 to 60.00).
    const thursday = await evaluationOf(app, tradeId);
    expect(triggers(thursday.conditions)).toEqual([['stop-1', r(11n, 5n), null], ['target-1', r(21n, 10n), null]]);
    expect(JSON.stringify(await openDetailOf(app, tradeId), showBigints)).not.toContain('nearest');

    // Fri 10-16 18:00, after Friday's close with no Mark for the call: the figures are Unavailable, and the dated line carries
    // Thursday's distances.
    const friday = await restart(app, at(d, FRIDAY_1800));
    const fridayDetail = await openDetailOf(friday, tradeId);
    expect(fridayDetail.current.evaluation.kind === 'Evaluated' && fridayDetail.current.evaluation.conditions.map((c) => c.result.kind)).toEqual(['Unavailable', 'Unavailable']);
    const dated = fridayDetail.current.datedLine;
    if (dated?.evaluation.kind !== 'Evaluated') throw new Error('expected a dated line');
    expect(dated.tradingDate).toBe(DATES.thu);
    expect(triggers(dated.evaluation.conditions)).toEqual(triggers(thursday.conditions));
    expect(JSON.stringify(fridayDetail, showBigints)).not.toContain('nearest');

    // Fri 12:00 reads the same Thursday Marks as current.
    const noon = await restart(friday, at(d, FRIDAY_1200));
    expect(triggers((await evaluationOf(noon, tradeId)).conditions)).toEqual(triggers(thursday.conditions));

    // A stock Trade whose Stop is crossed: no distance left, and the distance beyond it, in the stock's price (46.00 against 47.50).
    const stock = await breachedStock();
    const breached = await evaluationOf(stock.app, stock.tradeId);
    expect(triggers(breached.conditions)).toEqual([['stop-1', r(0n), r(3n, 2n)], ['target-1', r(10n), null]]);
    expect(JSON.stringify(await openDetailOf(stock.app, stock.tradeId), showBigints)).not.toContain('nearest');
  });
});

describe("I8R.4 Open lots' average", () => {
  it("I8R.4 Open lots' average", { timeout: 120_000 }, async () => {
    const { d, app, tradeId } = await oc3Plus();

    // One contract at 2.00 and one at 3.30 are open at Fri 18:00.
    const detail = await openDetailOf(await restart(app, at(d, FRIDAY_1800)), tradeId);
    expect(detail.openAverage).toEqual(r(53n, 20n));

    const stock = await breachedStock();
    const stockDetail = await openDetailOf(stock.app, stock.tradeId);
    expect(stockDetail.openAverage).toEqual(r(50n));
    expect(stockDetail.summary).toMatchObject({ kind: 'Stock', price: stockDetail.openAverage });
  });
});

describe('I8R.5 Before-Marks due', () => {
  it('I8R.5 Before-Marks due', { timeout: 120_000 }, async () => {
    // O-C3 at Mon 10-12 12:00, entered at 10:00 with no Marks: the figures wait for Monday's close.
    const monday = await oc3BeforeMarks();
    const early = await detailOf(monday.app, monday.tradeId);
    const mondayWaits = awaitingCloses(early);
    expect(mondayWaits.length).toBeGreaterThan(0);
    for (const waiting of mondayWaits) expect(waiting).toMatchObject({ due: '2026-10-12' });

    // O-C3+ at Fri 10-16 12:00: the Friday contract was added after Thursday's Marks, so its figures wait for Friday's close.
    const plus = await oc3Plus();
    const later = await detailOf(await restart(plus.app, at(plus.d, FRIDAY_1200)), plus.tradeId);
    const fridayWaits = awaitingCloses(later);
    expect(fridayWaits.length).toBeGreaterThan(0);
    for (const waiting of fridayWaits) expect(waiting).toMatchObject({ due: DATES.fri });
  });
});
