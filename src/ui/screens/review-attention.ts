import type { ReviewTradeItem } from '../../app/types.ts';
import { Rational, formatDecimal } from '../../domain/values/index.ts';
import { shortDate } from '../format.ts';

export const BAND_TEXT: Record<ReviewTradeItem['band'], string> = {
  Blocker: 'Blocker',
  BoundaryReached: 'Boundary reached',
  EvidenceLimited: 'Evidence limited',
  QuantifiedPressure: 'Quantified pressure',
  Routine: 'Routine',
};

// The share of the planned range travelled, as a whole percent.
const percent = (share: Rational): string => formatDecimal(Rational.of(share.numerator * 100n, share.denominator), 0);

// Why a Trade is in its band, in words.
export function reasonText(reason: ReviewTradeItem['reasons'][number], basis: ReviewTradeItem['basis']): string {
  switch (reason.code) {
    case 'IntegrityDisagreement':
      return 'Recorded facts disagree';
    case 'IncoherentFacts':
      return 'Recorded facts cannot be replayed';
    case 'StopBreached':
      return 'Stop breached';
    case 'TargetReached':
      return 'Target reached';
    case 'MarkMissing':
      return `Mark missing for ${reason.instrumentKey} on ${shortDate(reason.date)}`;
    case 'AcknowledgedUnavailable':
      return `Mark acknowledged unavailable for ${reason.instrumentKey} on ${shortDate(reason.date)}`;
    case 'AwaitingClose':
      return `Awaiting the next close after ${shortDate(reason.after)}`;
    case 'PressureTowardStop':
    case 'PressureTowardTarget': {
      const boundary = reason.code === 'PressureTowardStop' ? 'Stop' : 'Target';
      return basis.kind === 'Comparable' && basis.side !== 'None' ? `${percent(basis.share)}% of the way from entry to the ${boundary}` : `Pressure toward the ${boundary}`;
    }
    case 'NoPressure':
      return 'No pressure toward the Stop or the Target';
  }
}
