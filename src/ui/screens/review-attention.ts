import type { ReviewTradeItem, WalkedTrade } from '../../app/types.ts';
import { Rational, formatDecimal } from '../../domain/values/index.ts';
import { isAcknowledgedUnavailableAttention, isSettlementDueAttention, text, unavailableWords } from '../calculation-words.ts';

// The short weekday of a returned date: display only.
const shortDay = (date: string): string => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

// The bands that read as a label of their own: a due settlement outranks the Marks; a crossed line follows them.
const SETTLEMENT_LABEL: Partial<Record<ReviewTradeItem['band'], string>> = { SettlementDue: 'Expired: settle' };
const BOUNDARY_LABEL: Partial<Record<ReviewTradeItem['band'], string>> = { StopReached: 'Past Stop', TargetReached: 'At Target' };
const STANDING_TEXT = { Between: undefined, PastStop: 'Past Stop', PastTarget: 'At Target' } as const;

// The plain labels of a card or a day line (A302): what the Trade's band and reasons say, in the words the trader uses.
export function labelsOf(trade: Pick<WalkedTrade, 'band' | 'meter' | 'progress' | 'expiresOnReviewDate' | 'reasons'>): string[] {
  const settle = SETTLEMENT_LABEL[trade.band];
  if (settle) return [settle];
  if (trade.progress.panels.some((panel) => panel.panel === 'Marks' && !panel.done)) {
    const before = trade.meter?.previous;
    const standing = before?.zone && STANDING_TEXT[before.zone];
    return [trade.expiresOnReviewDate ? 'Expires today · Marks needed' : 'Marks needed', ...(before && standing ? [`${standing} ${shortDay(before.tradingDate)}`] : [])];
  }
  const boundary = BOUNDARY_LABEL[trade.band];
  if (boundary) return [boundary];
  if (trade.reasons.some(isAcknowledgedUnavailableAttention)) return ['No price today'];
  const now = trade.meter?.now;
  if (now?.kind === 'Value' && now.value.share) return [`${formatDecimal(now.value.share.percent, 0)}% to ${now.value.share.toward}`];
  return [];
}

// The share of the planned range travelled, as a whole percent.
const percent = (share: Rational): string => formatDecimal(Rational.of(share.numerator * 100n, share.denominator), 0);

// Why a Trade is in its band, in words; an Unavailable reason's words are the module's sentence (P72).
export function reasonText(reason: ReviewTradeItem['reasons'][number], basis: ReviewTradeItem['basis'], timeZone: string): string {
  // Row 24.5's sentence is the module's, so the card and the overview say the same; a screen never branches on its code.
  if (isSettlementDueAttention(reason)) return text(unavailableWords({ reason: 'SettlementDue', instrument: reason.instrument, expiration: reason.expiration }, 'sentence', timeZone), timeZone);
  switch (reason.code) {
    case 'IntegrityDisagreement':
      return 'Recorded facts disagree';
    case 'Unavailable':
      return text(unavailableWords(reason, 'sentence', timeZone), timeZone);
    case 'StopBreached':
      return 'Stop breached';
    case 'TargetReached':
      return 'Target reached';
    case 'PressureTowardStop':
    case 'PressureTowardTarget': {
      const boundary = reason.code === 'PressureTowardStop' ? 'Stop' : 'Target';
      return basis.kind === 'Value' && basis.value.side !== 'None' ? `${percent(basis.value.share)}% of the way from entry to the ${boundary}` : `Pressure toward the ${boundary}`;
    }
    case 'ExitNotCarriedOut':
      return 'You chose Exit and it is not recorded';
    case 'NoPressure':
      return 'No pressure toward the Stop or the Target';
  }
}
