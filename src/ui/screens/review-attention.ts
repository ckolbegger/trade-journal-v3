import type { ReviewTradeItem, WalkedTrade } from '../../app/types.ts';
import { Rational, formatDecimal } from '../../domain/values/index.ts';
import { isAcknowledgedUnavailableAttention, isSettlementDueAttention, text, unavailableWords } from '../calculation-words.ts';

// The short weekday of a returned date: display only.
const shortDay = (date: string): string => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

// The bands that read as a label of their own: a due settlement outranks the Marks; a crossed line follows them.
const SETTLEMENT_LABEL: Partial<Record<ReviewTradeItem['band'], string>> = { SettlementDue: 'Expired: settle' };
const BOUNDARY_LABEL: Partial<Record<ReviewTradeItem['band'], string>> = { StopReached: 'Past Stop', TargetReached: 'At Target' };
const CROSSED_LABEL = { StopBreached: 'Past Stop', TargetReached: 'At Target' } as const;
const STANDING_TEXT = { Between: undefined, PastStop: 'Past Stop', PastTarget: 'At Target' } as const;

type Reason = ReviewTradeItem['reasons'][number];
type LabelledTrade = Pick<WalkedTrade, 'band' | 'meter' | 'progress' | 'expiresOnReviewDate' | 'reasons' | 'basis'>;
const reasonsText = (reasons: readonly Reason[], trade: LabelledTrade, timeZone: string): string | undefined =>
  reasons.length === 0 ? undefined : reasons.map((reason) => reasonText(reason, trade.basis, timeZone)).join('. ');

// The plain labels of a card or a day line (A302): what the Trade's band and reasons say, in the words the trader uses,
// each with its own reason from the returned figures (none when the walk returned none).
export function describedLabelsOf(trade: LabelledTrade, timeZone: string): { label: string; reason: string | undefined }[] {
  const why = (reasons: readonly Reason[]) => reasonsText(reasons, trade, timeZone);
  const settle = SETTLEMENT_LABEL[trade.band];
  if (settle) return [{ label: settle, reason: why(trade.reasons.filter(isSettlementDueAttention)) }];
  if (trade.progress.panels.some((panel) => panel.panel === 'Marks' && !panel.done)) {
    const before = trade.meter?.previous;
    const standing = before?.zone && STANDING_TEXT[before.zone];
    const missing = why(trade.reasons.filter((reason) => reason.code === 'Unavailable' && !isSettlementDueAttention(reason)));
    return [
      { label: trade.expiresOnReviewDate ? 'Expires today · Marks needed' : 'Marks needed', reason: missing },
      ...(before && standing ? [{ label: `${standing} ${shortDay(before.tradingDate)}`, reason: `${standing} at the close on ${shortDay(before.tradingDate)}` }] : []),
    ];
  }
  // An Exit not carried out keeps its band; the line the Trade is at or past is in its reasons (A302).
  const crossedLine = (['StopBreached', 'TargetReached'] as const).filter((code) => trade.reasons.some((reason) => reason.code === code)).map((code) => CROSSED_LABEL[code])[0];
  const boundary = BOUNDARY_LABEL[trade.band] ?? (trade.band === 'ExitNotCarriedOut' ? crossedLine : undefined);
  if (boundary) return [{ label: boundary, reason: why(trade.reasons.filter((reason) => reason.code === 'StopBreached' || reason.code === 'TargetReached')) }];
  const acknowledged = trade.reasons.filter(isAcknowledgedUnavailableAttention);
  if (acknowledged.length > 0) return [{ label: 'No price today', reason: why(acknowledged) }];
  // The share is the Pressure's (risk or reward consumed since entry, on the open Lots), the figure the card's line and the order use; the meter's share counts the realized P&L too, and is absent when the total result is zero.
  const pressure = trade.basis.kind === 'Value' && trade.basis.value.side !== 'None' ? trade.basis.value : undefined;
  if (pressure) {
    const toward = pressure.side === 'Losing' ? 'Stop' : 'Target';
    return [{ label: `${percent(pressure.share)}% to ${toward}`, reason: `${percent(pressure.share)}% of the way from entry to the ${toward}` }];
  }
  return [];
}

export const labelsOf = (trade: LabelledTrade): string[] => describedLabelsOf(trade, 'UTC').map(({ label }) => label);

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
