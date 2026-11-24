import { describe, expect, it } from 'vitest';
import { derive, type TradeAnalysisRecord } from './index.ts';
import { evaluate, type ObservationFrame } from './evaluate.ts';
import { planCall } from './plan-call.ts';
import { R_CORV_D, R_DALE_D } from './option-trade.ts';
import { PC1, R_AXIO_D, REPLAY_SESSION_DATES, referenceRecord, type ReplayTestSeries } from './reference-trade.ts';
import { replay } from './replay-series.ts';
import type { Instrument } from '../instrument/index.ts';

const frameOf = (instrument: Instrument, date: string, price: string | null): ObservationFrame => {
  const closeInstant = `${date}T21:00:00Z`;
  return price === null
    ? { instrument, tradingDate: date, closeInstant, resolution: { kind: 'Missing' } }
    : { instrument, tradingDate: date, closeInstant, resolution: { kind: 'Available', mark: { revisionId: 'mark-1', revisionNumber: 1, price } } };
};

// The Plan Call at one session's Marks: the Trade's held Instrument (and, for an option, its Underlying).
function callAt(record: TradeAnalysisRecord, date: string, held: string | null, underlying?: string | null) {
  const state = derive({ record, valuationDate: date });
  if (state.kind !== 'Derived') throw new Error('facts cannot be derived');
  const instrument = record.plan.legs[0]!.instrument;
  const evaluation = evaluate({
    state,
    frame: frameOf(instrument, date, held),
    ...(instrument.kind === 'Option' && { underlyingFrame: frameOf({ kind: 'Stock', symbol: record.plan.underlying }, date, underlying ?? null) }),
  });
  return planCall(evaluation);
}

// Long XYZ 100 shares, Stop 47.5, Target 56, held from 2026-10-12.
const XYZ_RECORD = referenceRecord([PC1]);

describe('planCall (A306)', () => {
  it('should give Out when a headline Stop is Breached', () => {
    expect(callAt(XYZ_RECORD, '2026-10-13', '47.00').call).toBe('Out');
  });

  it('should give Out when a headline Target is Reached', () => {
    expect(callAt(XYZ_RECORD, '2026-10-13', '56.00').call).toBe('Out');
  });

  it('should give Hold when every stated headline condition is evaluable and none is reached', () => {
    expect(callAt(XYZ_RECORD, '2026-10-13', '51.00').call).toBe('Hold');
    expect(callAt(R_DALE_D.record, '2026-11-03', R_DALE_D.held[1] ?? null, R_DALE_D.underlying[1] ?? null).call).toBe('Hold');
  });

  it('should give Unknown when a headline condition cannot be evaluated', () => {
    expect(callAt(XYZ_RECORD, '2026-10-13', null).call).toBe('Unknown');
    // An option's Underlying Mark is missing: its Stop cannot be read.
    expect(callAt(R_DALE_D.record, '2026-11-03', R_DALE_D.held[1] ?? null, null).call).toBe('Unknown');
  });

  it('should give Out when either of two headline conditions is reached', () => {
    // R-DALE: the Stop is on DALE at or below 54.00 and the Target is the put at or below 0.20.
    expect(callAt(R_DALE_D.record, '2026-11-03', '1.30', '53.00').call).toBe('Out');
    expect(callAt(R_DALE_D.record, '2026-11-03', '0.15', '60.00').call).toBe('Out');
    expect(callAt(R_DALE_D.record, '2026-11-03', '0.15', '53.00').call).toBe('Out');
  });

  it('should give Out when the contract Mark is missing but the Underlying Mark crosses a headline Stop', () => {
    // R-DALE: no put Mark, DALE at 53.00 is at or below the Stop's 54.00 (A110: the Underlying alone reads the Stop).
    const call = callAt(R_DALE_D.record, '2026-11-03', null, '53.00');
    expect(call.call).toBe('Out');
    expect(call.condition?.role).toBe('Stop');
  });

  it('should keep Unknown when the contract Mark is missing and the Underlying Mark crosses nothing', () => {
    const call = callAt(R_DALE_D.record, '2026-11-03', null, '60.00');
    // The Stop reads Active from the Underlying alone; the put-price Target has no Mark to read, so it is the one named.
    expect(call.call).toBe('Unknown');
    expect(call.condition?.role).toBe('Target');
  });

  it('should name the condition that made the call', () => {
    expect(callAt(XYZ_RECORD, '2026-10-13', '47.00').condition).toEqual({ id: 'stop-1', role: 'Stop', boundary: '47.5' });
    expect(callAt(XYZ_RECORD, '2026-10-13', '56.00').condition).toEqual({ id: 'target-1', role: 'Target', boundary: '56' });
    // Both reached at once: the Stop is named.
    expect(callAt(R_DALE_D.record, '2026-11-03', '0.15', '53.00').condition?.role).toBe('Stop');
    // The condition that could not be read is the one named for Unknown; Hold names none.
    expect(callAt(XYZ_RECORD, '2026-10-13', null).condition).toEqual({ id: 'stop-1', role: 'Stop', boundary: '47.5' });
    expect(callAt(XYZ_RECORD, '2026-10-13', '51.00').condition).toBeUndefined();
  });

  it('should give each replayed session its call', () => {
    const callsOf = (series: ReplayTestSeries) => {
      const result = replay({
        record: series.record,
        sessions: REPLAY_SESSION_DATES.map((date, i) => {
          const closeInstant = `${date}T21:00:00Z`;
          return {
            tradingDate: date,
            closeInstant,
            frames: [frameOf({ kind: 'Stock', symbol: series.record.plan.underlying }, date, series.underlying[i] ?? null), frameOf(series.record.plan.legs[0]!.instrument, date, series.held[i] ?? null)],
          };
        }),
      });
      if (result.kind !== 'Replayed') throw new Error('expected Replayed');
      return result.sessions.map((session) => [session.date, session.planCall?.call, session.planCall?.condition?.id]);
    };
    // R-AXIO-D: the Stop is crossed on Mon 11-09 and stays crossed.
    const axio = callsOf(R_AXIO_D);
    expect(axio[4]).toEqual(['2026-11-06', 'Hold', undefined]);
    expect(axio[5]).toEqual(['2026-11-09', 'Out', 'stop-1']);
    expect(axio[6]).toEqual(['2026-11-10', 'Out', 'stop-1']);
    // R-CORV-D: the Target is reached on Fri 11-06, and Tue 11-10 has no put Mark.
    const corv = callsOf(R_CORV_D);
    expect(corv[3]).toEqual(['2026-11-05', 'Hold', undefined]);
    expect(corv[4]).toEqual(['2026-11-06', 'Out', 'target-1']);
    expect(corv[6]).toEqual(['2026-11-10', 'Unknown', 'stop-1']);
  });
});
