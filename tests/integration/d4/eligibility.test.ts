// I4.14: eligibility at the cutoff (AC-REV-001 partial, AC-REV-006 partial).
import { describe, expect, it } from 'vitest';
import { device, MONDAY, MONDAY_1700, onboarded, openReview, planStock, PC1_TIME, record, restart, saveAction, saveMark } from './support.ts';

const AFTER_CUTOFF = '2026-10-12T20:05:00Z'; // Monday 16:05 New York, after the 16:00 cutoff
const BEFORE_CUTOFF = '2026-10-12T19:00:00Z'; // Monday 15:00 New York

function tradeIds(opened: Awaited<ReturnType<typeof openReview>>): string[] {
  const trades = opened.families.find((f) => f.family === 'Trades');
  return trades?.family === 'Trades' ? trades.trades.map((t) => t.tradeId) : [];
}

describe('I4.14 eligibility at the cutoff', () => {
  it('should make a Trade first filled after the cutoff eligible, and the Review Incomplete again, once an earlier-dated fill is recorded', async () => {
    const d = await device(undefined, MONDAY_1700);
    const app = await onboarded(d);
    const p = await planStock(app, 'XYZ', '50.00', '47.50', '56.00');
    await record(app, p, { quantity: '100', price: '50.00', economicTime: PC1_TIME });
    const q = await planStock(app, 'ABC', '30.00', '28.00', '36.00');
    await record(app, q, { quantity: '100', price: '30.00', economicTime: AFTER_CUTOFF });

    // Only P is eligible; with its Mark and Action the Review is Complete.
    const first = await openReview(app, d);
    expect(tradeIds(first)).toEqual([p]);
    const marks = first.families.find((f) => f.family === 'Marks');
    expect(marks?.family === 'Marks' && marks.today.map((r) => r.instrumentKey)).toEqual(['XYZ']);
    expect(first.completion.kind).toBe('Incomplete');
    await saveMark(app, 'XYZ', MONDAY, '52.00');
    await saveAction(app, d, p);
    expect((await openReview(app, d)).completion).toEqual({ kind: 'Complete' });

    // An earlier-dated fill for Q makes it eligible at the cutoff: Incomplete again.
    await record(app, q, { quantity: '50', price: '30.10', economicTime: BEFORE_CUTOFF });
    const second = await openReview(app, d);
    expect(tradeIds(second).sort()).toEqual([p, q].sort());
    expect(second.completion.kind).toBe('Incomplete');
    expect(second.completion.kind === 'Incomplete' && second.completion.reasons.map((r) => [r.code, r.code === 'ActionMissing' ? r.tradeId : r.code === 'MarkMissing' ? r.instrumentKey : ''])).toEqual([
      ['MarkMissing', 'ABC'],
      ['ActionMissing', q],
    ]);

    // The same after restart; Q's Mark and Action complete it again.
    const again = await restart(app, d);
    expect((await openReview(again, d)).completion).toEqual(second.completion);
    await saveMark(again, 'ABC', MONDAY, '31.00');
    expect((await openReview(again, d)).completion).toMatchObject({ kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: q }] });
    await saveAction(again, d, q);
    expect((await openReview(again, d)).completion).toEqual({ kind: 'Complete' });
  }, 30_000);
});
