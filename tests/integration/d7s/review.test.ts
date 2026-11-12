// I7S.6: the Daily Review reads O-S2's option-price conditions (D7S A197, A198), through the real facade on
// fake-indexeddb: the walk's attention and the Trade card, at Tuesday and Wednesday 17:00.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { Rational } from '../../../src/domain/values/index.ts';
import { MNO_DEC_PUT, onboardedAt, openOs2, restart, reviewAt, saveSession, TUESDAY, TUESDAY_1700_NY, WEDNESDAY, WEDNESDAY_1700_NY } from './support.ts';

const r = (n: bigint, d = 1n) => Rational.of(n, d);

// The Review opened at `asOf`, its walk item for the Trade, its Marks tasks, and the Trade's card.
async function reviewOf(app: Application, asOf: string, tradeId: string) {
  const review = await reviewAt(app, asOf);
  if (review.kind !== 'Ready') throw new Error(`open: ${review.kind}`);
  const trades = review.families.find((f) => f.family === 'Trades');
  const marks = review.families.find((f) => f.family === 'Marks');
  if (trades?.family !== 'Trades' || marks?.family !== 'Marks') throw new Error('expected the Marks and Trades families');
  const card = await app.DailyReview.getTrade({ reviewDate: review.reviewDate, tradeId, binding: review.binding });
  if (card.kind !== 'Ready') throw new Error(`getTrade: ${card.kind}`);
  return { walked: trades.trades.find((t) => t.tradeId === tradeId)!, tasks: marks.today, card: card.trade };
}

describe('I7S.6 Review with option-price conditions', () => {
  it('should give O-S2 pressure 11/47 toward the Stop on Tuesday and, on Wednesday, the band BoundaryReached naming stop-2 with Overrun 20, with MNO and the put each one Mark task', async () => {
    const { d, app: first } = await onboardedAt(TUESDAY_1700_NY);
    let app = first;
    const tradeId = await openOs2(app);
    await saveSession(app, TUESDAY, { mno: '44.00', put: '1.80' });

    // Tuesday: S-o's risk of 360 against 470 at entry, from the option-price Stop, in the walk and on the card.
    const tuesday = await reviewOf(app, TUESDAY_1700_NY, tradeId);
    const pressure = { kind: 'Value', value: { side: 'Losing', share: r(11n, 47n), atEntry: r(470n), now: r(360n) } };
    for (const attention of [tuesday.walked, tuesday.card.attention]) {
      expect(attention).toEqual(expect.objectContaining({ band: 'QuantifiedPressure', reasons: [{ code: 'PressureTowardStop' }], basis: pressure }));
    }

    app = await restart(app, { ...d, now: WEDNESDAY_1700_NY });
    await saveSession(app, WEDNESDAY, { mno: '43.20', put: '3.70' });

    // Wednesday: S-o is crossed by 3.70 - 3.60 on 2 contracts, an Overrun of 20.
    const wednesday = await reviewOf(app, WEDNESDAY_1700_NY, tradeId);
    for (const attention of [wednesday.walked, wednesday.card.attention]) {
      expect(attention).toEqual(expect.objectContaining({ band: 'BoundaryReached', reasons: [{ code: 'StopBreached', conditionId: 'stop-2', overrun: r(20n) }] }));
    }
    expect(wednesday.tasks.filter((task) => task.instrumentKey === 'MNO').map((task) => task.trades)).toEqual([[tradeId]]);
    expect(wednesday.tasks.filter((task) => task.instrumentKey === instrumentKey(MNO_DEC_PUT)).map((task) => task.trades)).toEqual([[tradeId]]);
  }, 120_000);
});
