import { describe, expect, it } from 'vitest';
import { nyseSessionPolicy } from '../../domain/session-policy/index.ts';
import { recordSourceOf } from '../../../tests/support/record-source.ts';
import { validateSection } from './index.ts';
import type { MarkRevision, ObservationRecord } from './records.ts';

// XYZ's Call at strike 55 expiring Friday 2026-11-20.
const CALL = 'XYZ261120C00055000';

function mark(revisionId: string, price: string): MarkRevision {
  return { revisionId, revisionNumber: 1, price, source: 'Manual', intention: 'InitialManual', observedAt: '2026-11-20T21:00:00Z', savedAt: '2026-11-20T21:00:00Z' };
}

function observation(instrumentKey: string, tradingDate: string, price: string, revisionId: string): ObservationRecord {
  return { instrumentKey, tradingDate, resolutionRevision: 1, marks: [mark(revisionId, price)], effectiveMarkId: revisionId, acknowledgments: [], effectiveAcknowledgmentId: null };
}

describe('Market Data section, options', () => {
  it('should accept option and stock Marks of 0 and report a negative price and an option observation dated after its expiration date', async () => {
    const accepted = recordSourceOf({
      observations: [observation(CALL, '2026-11-20', '0', 'r-1'), observation('XYZ', '2026-11-20', '0', 'r-2'), observation(CALL, '2026-11-19', '0.05', 'r-3')],
    });

    expect((await validateSection(accepted, nyseSessionPolicy)).issues).toEqual([]);

    const flagged = recordSourceOf({
      observations: [
        observation(CALL, '2026-11-19', '-0.05', 'r-4'),
        // Monday after the Friday expiration: the key is an option's, never an unknown stock symbol.
        observation(CALL, '2026-11-23', '0', 'r-5'),
        observation('XYZ', '2026-11-23', '0', 'r-6'),
      ],
    });

    expect((await validateSection(flagged, nyseSessionPolicy)).issues).toEqual([
      { code: 'PriceNegative', instrumentKey: CALL, tradingDate: '2026-11-19', revisionId: 'r-4' },
      { code: 'AfterExpiration', instrumentKey: CALL, tradingDate: '2026-11-23' },
    ]);
  });
});
