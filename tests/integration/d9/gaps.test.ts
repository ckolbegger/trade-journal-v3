// I9.2 Gaps stay gaps (AC-MARK-004): R-CORV-D has no put Mark on Tue 11-10; then the trader acknowledges the missing Mark.
// The Mark-dependent figures of that session stay Unavailable, its two results are kept, and nothing is carried across it.
import { describe, expect, it } from 'vitest';
import { CORV_PUT, R_CORV_D } from '../../../src/domain/trade-analysis/option-trade.ts';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { restart } from '../d7s/support.ts';
import { dollars as q, figure, frac, readyReplay, row, seriesApp } from './support.ts';

const WED_1111_1700 = '2026-11-11T22:00:00Z';
const TUE = '2026-11-10';
const WED = '2026-11-11';

type View = Awaited<ReturnType<typeof readyReplay>>;
const session = (view: View, date: string) => {
  const found = view.sessions.find((s) => s.date === date);
  if (!found) throw new Error(`no session ${date}`);
  return found;
};
const putMark = (view: View, date: string) => session(view, date).marks.find((m) => m.instrument.kind === 'Option')!;

describe('I9.2 Gaps stay gaps (AC-MARK-004)', () => {
  it('I9.2 should keep Tuesday Mark-dependent figures Unavailable with its two results, measure Wednesday from Monday, and never turn an acknowledgment into a price', { timeout: 120_000 }, async () => {
    const { d, app, tradeId } = await seriesApp(R_CORV_D, 'strategy.long-put', WED_1111_1700, { marksThrough: 7 });

    const before = await readyReplay(app, tradeId);

    const tuesday = session(before, TUE);
    expect(row(tuesday)).toMatchObject({
      held: q(3n),
      tradePnl: 'Unavailable:MarkMissing',
      risk: 'Unavailable:MarkMissing',
      reward: 'Unavailable:MarkMissing',
      atStop: q(-318n),
      atTarget: q(867n),
    });
    expect(putMark(before, TUE).resolution).toEqual({ kind: 'Missing' });
    expect(tuesday.change).toBeNull();
    expect(tuesday.riskChange).toBeUndefined();
    expect(tuesday.rewardChange).toBeUndefined();
    // Wednesday is measured from Monday 11-09, the last session that had each figure.
    const wednesday = session(before, WED);
    expect(row(wednesday)).toMatchObject({ tradePnl: q(903n), risk: q(1221n), reward: q(0n) });
    expect(wednesday.change && { since: wednesday.change.since, dollars: frac(wednesday.change.dollars) }).toEqual({ since: '2026-11-09', dollars: q(261n) });
    expect(wednesday.riskChange && { since: wednesday.riskChange.since, dollars: frac(wednesday.riskChange.dollars) }).toEqual({ since: '2026-11-09', dollars: q(261n) });
    expect(wednesday.rewardChange && { since: wednesday.rewardChange.since, dollars: frac(wednesday.rewardChange.dollars) }).toEqual({ since: '2026-11-09', dollars: q(-225n) });

    // The trader acknowledges that Tuesday's put Mark is unavailable.
    const saved = await app.MarketData.save({ intention: 'AssertUnavailable', instrumentKey: instrumentKey(CORV_PUT), tradingDate: TUE, reason: 'No quote', expectedResolutionRevision: 'None' });
    expect(saved.kind).toBe('Saved');

    const after = await readyReplay(await restart(app, d), tradeId);
    expect(putMark(after, TUE).resolution.kind).toBe('AcknowledgedUnavailable');
    const acknowledged = session(after, TUE);
    // Still no value: the acknowledgment only changes why the figure is Unavailable.
    expect(figure(acknowledged.tradePnl)).toBe('Unavailable:AcknowledgedUnavailable');
    expect(row(acknowledged)).toMatchObject({ risk: 'Unavailable:AcknowledgedUnavailable', reward: 'Unavailable:AcknowledgedUnavailable', atStop: q(-318n), atTarget: q(867n) });
    expect(acknowledged.change).toBeNull();
    expect(acknowledged.riskChange).toBeUndefined();
    expect(acknowledged.rewardChange).toBeUndefined();
    // Wednesday still measures all three changes from Monday, with the same values as before.
    const wednesdayAfter = session(after, WED);
    expect(wednesdayAfter.change).toEqual(wednesday.change);
    expect(wednesdayAfter.riskChange).toEqual(wednesday.riskChange);
    expect(wednesdayAfter.rewardChange).toEqual(wednesday.rewardChange);
    expect(wednesdayAfter.riskChange && { since: wednesdayAfter.riskChange.since, dollars: frac(wednesdayAfter.riskChange.dollars) }).toEqual({ since: '2026-11-09', dollars: q(261n) });
    expect(wednesdayAfter.rewardChange && { since: wednesdayAfter.rewardChange.since, dollars: frac(wednesdayAfter.rewardChange.dollars) }).toEqual({ since: '2026-11-09', dollars: q(-225n) });
  });
});
