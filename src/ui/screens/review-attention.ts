import type { ReviewTradeItem } from '../../app/types.ts';
import { Rational, formatDecimal } from '../../domain/values/index.ts';
import { text, unavailableWords } from '../calculation-words.ts';

export const BAND_TEXT: Record<ReviewTradeItem['band'], string> = {
  Blocker: 'Blocker',
  BoundaryReached: 'Boundary reached',
  EvidenceLimited: 'Evidence limited',
  QuantifiedPressure: 'Quantified pressure',
  Routine: 'Routine',
};

// The share of the planned range travelled, as a whole percent.
const percent = (share: Rational): string => formatDecimal(Rational.of(share.numerator * 100n, share.denominator), 0);

// Why a Trade is in its band, in words; an Unavailable reason's words are the module's sentence (P72).
export function reasonText(reason: ReviewTradeItem['reasons'][number], basis: ReviewTradeItem['basis'], timeZone: string): string {
  switch (reason.code) {
    case 'IntegrityDisagreement':
      return 'Recorded facts disagree';
    case 'Unavailable':
      return text(unavailableWords(reason, 'sentence', timeZone));
    case 'StopBreached':
      return 'Stop breached';
    case 'TargetReached':
      return 'Target reached';
    case 'PressureTowardStop':
    case 'PressureTowardTarget': {
      const boundary = reason.code === 'PressureTowardStop' ? 'Stop' : 'Target';
      return basis.kind === 'Value' && basis.value.side !== 'None' ? `${percent(basis.value.share)}% of the way from entry to the ${boundary}` : `Pressure toward the ${boundary}`;
    }
    case 'NoPressure':
      return 'No pressure toward the Stop or the Target';
    // The settlement blocker has no words yet: T7.24 words it (K13) and replaces this.
    default:
      return '';
  }
}
