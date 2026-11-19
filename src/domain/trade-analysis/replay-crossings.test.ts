import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/index.ts';
import { OS2_CONTRACT, OS2_S1, os2Record, R_CORV_D, R_DALE_D } from './option-trade.ts';
import { R_AXIO_D, REPLAY_SESSION_DATES, type ReplayTestSeries } from './reference-trade.ts';
import { replay, type ReplayCrossingDates, type ReplayedSession, type ReplaySessionInput } from './replay-series.ts';

// D9's test Trades: every session of the series, closing 16:00 New York (EST), with each session's Marks (null: no Mark).
const sessionsOf = (series: ReplayTestSeries): readonly ReplaySessionInput[] =>
  REPLAY_SESSION_DATES.map((date, i) => {
    const closeInstant = `${date}T21:00:00Z`;
    const frame = (instrument: Instrument, price: string | null | undefined): ReplaySessionInput['frames'][number] => ({
      instrument,
      tradingDate: date,
      closeInstant,
      resolution: price === null || price === undefined ? { kind: 'Missing' } : { kind: 'Available', mark: { revisionId: `rev-${date}`, revisionNumber: 1, price } },
    });
    return {
      tradingDate: date,
      closeInstant,
      frames: [frame({ kind: 'Stock', symbol: series.record.plan.underlying }, series.underlying[i]), frame(series.record.plan.legs[0]!.instrument, series.held[i])],
    };
  });

const replayed = (series: ReplayTestSeries): readonly ReplayedSession[] => {
  const result = replay({ record: series.record, sessions: sessionsOf(series) });
  if (result.kind !== 'Replayed') throw new Error(`expected Replayed, got ${JSON.stringify(result)}`);
  return result.sessions;
};

// A series with one session's Marks removed.
const without = (series: ReplayTestSeries, date: string, which: 'held' | 'both'): ReplayTestSeries => {
  const i = REPLAY_SESSION_DATES.indexOf(date as (typeof REPLAY_SESSION_DATES)[number]);
  const blank = (marks: readonly (string | null)[]) => marks.map((m, j) => (j === i ? null : m));
  return { ...series, held: blank(series.held), underlying: which === 'both' ? blank(series.underlying) : series.underlying };
};

type Role = 'stop' | 'target';
const crossingsOn = (sessions: readonly ReplayedSession[], date: string, role: Role) => {
  const crossings = sessions.find((s) => s.date === date)?.crossings;
  if (!crossings) throw new Error(`no crossings on ${date}`);
  return crossings[role];
};
// A role's or condition's dates as plain values: [first, since], each `date` or `date after a gap`; null when absent.
const datesOf = (dates: ReplayCrossingDates) => {
  const text = (d: ReplayCrossingDates['first']) => (d ? `${d.date}${d.afterGap ? ' after a gap' : ''}` : null);
  return [text(dates.first), text(dates.since)];
};

describe("replay: a condition's first crossing (A271)", () => {
  it("should give no crossing before a condition is crossed, then its first session and the run's start: R-CORV-D's Target on Fri 11-06, and R-AXIO-D's Stop on Mon 11-09", () => {
    const corv = replayed(R_CORV_D);
    expect(datesOf(crossingsOn(corv, '2026-11-05', 'target'))).toEqual([null, null]);
    expect(datesOf(crossingsOn(corv, '2026-11-06', 'target'))).toEqual(['2026-11-06', '2026-11-06']);
    const axio = replayed(R_AXIO_D);
    expect(datesOf(crossingsOn(axio, '2026-11-06', 'stop'))).toEqual([null, null]);
    expect(datesOf(crossingsOn(axio, '2026-11-09', 'stop'))).toEqual(['2026-11-09', '2026-11-09']);
    expect(datesOf(crossingsOn(axio, '2026-11-10', 'stop'))).toEqual(['2026-11-09', '2026-11-09']);
  });

  it('should keep the first crossing and drop the run when the condition is Active again (R-CORV-D Mon 11-09: first Fri 11-06, no run)', () => {
    const corv = replayed(R_CORV_D);
    expect(datesOf(crossingsOn(corv, '2026-11-09', 'target'))).toEqual(['2026-11-06', null]);
  });

  it('should start a new run when it is crossed again, marked first seen after a session with no reading (R-CORV-D Wed 11-11: since Wed 11-11, after a gap; first still Fri 11-06)', () => {
    const corv = replayed(R_CORV_D);
    expect(datesOf(crossingsOn(corv, '2026-11-11', 'target'))).toEqual(['2026-11-06', '2026-11-11 after a gap']);
  });

  it('should carry a run through a session with no reading (R-AXIO-D with no Mark on Tue 11-10: Wed 11-11 still since Mon 11-09)', () => {
    const axio = replayed(without(R_AXIO_D, '2026-11-10', 'both'));
    expect(datesOf(crossingsOn(axio, '2026-11-10', 'stop'))).toEqual(['2026-11-09', null]);
    expect(datesOf(crossingsOn(axio, '2026-11-11', 'stop'))).toEqual(['2026-11-09', '2026-11-09']);
  });

  it('should mark a first crossing first seen when the session before it had no reading (R-CORV-D with no put Mark on Thu 11-05: Fri 11-06, after a gap)', () => {
    const corv = replayed(without(R_CORV_D, '2026-11-05', 'held'));
    expect(datesOf(crossingsOn(corv, '2026-11-06', 'target'))).toEqual(['2026-11-06 after a gap', '2026-11-06 after a gap']);
  });

  it("should read an option's Underlying condition from the Underlying's Mark alone: R-DALE-D with no put Mark on Fri 11-13 still gives the Stop first crossed that day, and Thu 11-12, where only the planned amount is passed, gives none", () => {
    const dale = replayed(without(R_DALE_D, '2026-11-13', 'held'));
    expect(datesOf(crossingsOn(dale, '2026-11-12', 'stop'))).toEqual([null, null]);
    expect(datesOf(crossingsOn(dale, '2026-11-13', 'stop'))).toEqual(['2026-11-13', '2026-11-13']);
  });

  it("should keep each condition's own crossing when a role has two (full reading): O-S2 on Wed 10-14, the put at $3.70, gives its Stop on the option first crossed that day, its Stop on MNO none, and the Stop role first crossed that day", () => {
    const put = ['1.25', '1.50', '3.70'];
    const dates = ['2026-10-12', '2026-10-13', '2026-10-14'];
    const frame = (instrument: Instrument, date: string, price: string): ReplaySessionInput['frames'][number] => ({
      instrument,
      tradingDate: date,
      closeInstant: `${date}T20:00:00Z`,
      resolution: { kind: 'Available', mark: { revisionId: `rev-${date}`, revisionNumber: 1, price } },
    });
    const sessions = dates.map((date, i): ReplaySessionInput => ({
      tradingDate: date,
      closeInstant: `${date}T20:00:00Z`,
      frames: [frame({ kind: 'Stock', symbol: 'MNO' }, date, '43.20'), frame(OS2_CONTRACT, date, put[i]!)],
    }));
    const result = replay({ record: os2Record([OS2_S1]), sessions });
    if (result.kind !== 'Replayed') throw new Error('expected Replayed');
    const stop = crossingsOn(result.sessions, '2026-10-14', 'stop');
    expect(datesOf(stop)).toEqual(['2026-10-14', '2026-10-14']);
    expect(stop.conditions.map((c) => [c.id, ...datesOf(c)])).toEqual([
      ['stop-1', null, null],
      ['stop-2', '2026-10-14', '2026-10-14'],
    ]);
    expect(datesOf(crossingsOn(result.sessions, '2026-10-13', 'stop'))).toEqual([null, null]);
  });

  it("should hold the role's run through a session where its crossed condition has no reading and another condition reads Active, and mark nothing after a gap when it is crossed again", () => {
    // A copy of O-S2 with the put at 3.70 (option Stop crossed) on 10-12, no put Mark on 10-13 (MNO 43.20 reads Active), 3.70 again on 10-14.
    const put = ['3.70', null, '3.70'];
    const dates = ['2026-10-12', '2026-10-13', '2026-10-14'];
    const frame = (instrument: Instrument, date: string, price: string | null): ReplaySessionInput['frames'][number] => ({
      instrument,
      tradingDate: date,
      closeInstant: `${date}T20:00:00Z`,
      resolution: price === null ? { kind: 'Missing' } : { kind: 'Available', mark: { revisionId: `rev-${date}`, revisionNumber: 1, price } },
    });
    const sessions = dates.map((date, i): ReplaySessionInput => ({
      tradingDate: date,
      closeInstant: `${date}T20:00:00Z`,
      frames: [frame({ kind: 'Stock', symbol: 'MNO' }, date, '43.20'), frame(OS2_CONTRACT, date, put[i]!)],
    }));
    const result = replay({ record: os2Record([OS2_S1]), sessions });
    if (result.kind !== 'Replayed') throw new Error('expected Replayed');
    const stop = crossingsOn(result.sessions, '2026-10-14', 'stop');
    expect(datesOf(stop)).toEqual(['2026-10-12', '2026-10-12']);
    expect(stop.conditions.map((c) => [c.id, ...datesOf(c)])).toEqual([
      ['stop-1', null, null],
      ['stop-2', '2026-10-12', '2026-10-12'],
    ]);
  });
});

