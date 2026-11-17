// I8R.2: the Today table's column dates (A232, P110) on O-C3, through the real facade on fake-indexeddb, with a restart between reads.
import { describe, expect, it } from 'vitest';
import {
  at, DAY_AFTER_THANKSGIVING_1200, evaluationOf, oc3, openDetailOf, restart, SATURDAY_1000, THANKSGIVING_1200, THURSDAY_1200, THURSDAY_1800,
} from './support.ts';

describe('I8R.2 Column dates', () => {
  it('I8R.2 Column dates', { timeout: 120_000 }, async () => {
    const { d, app: built, tradeId } = await oc3({ thursdayHold: true });
    const reads = [
      [THURSDAY_1200, { today: { date: '2026-10-15', next: false }, yesterday: '2026-10-14' }],
      [THURSDAY_1800, { today: { date: '2026-10-15', next: false }, yesterday: '2026-10-14' }],
      [SATURDAY_1000, { today: { date: '2026-10-19', next: true }, yesterday: '2026-10-16' }],
      // Thanksgiving, Thu 11-26, is a holiday: the next session is Friday and Wednesday is the one before.
      [THANKSGIVING_1200, { today: { date: '2026-11-27', next: true }, yesterday: '2026-11-25' }],
      // The day after it, Fri 11-27, is a session again, and the session before it is still Wednesday's.
      [DAY_AFTER_THANKSGIVING_1200, { today: { date: '2026-11-27', next: false }, yesterday: '2026-11-25' }],
    ] as const;

    let app = built;
    for (const [now, columns] of reads) {
      app = await restart(app, at(d, now));
      expect((await openDetailOf(app, tradeId)).marksColumns, now).toEqual(columns);
      // The same dates after another restart over the same stores.
      app = await restart(app, at(d, now));
      expect((await openDetailOf(app, tradeId)).marksColumns, `${now} after a restart`).toEqual(columns);
    }
    await expect(evaluationOf(app, tradeId)).resolves.toBeDefined();
  });
});
