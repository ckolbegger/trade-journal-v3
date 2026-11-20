import type { MeterReading } from '../../../app/types.ts';
import type { Rational } from '../../../domain/values/index.ts';
import { calculation, signed } from '../../figures.ts';
import { money, shortDate } from '../../format.ts';
import type { MeterFigure, MeterProps, MeterSize } from './meter.types.ts';

// A finished dollar figure, as drawn and as worded. Turning a Rational into a position is drawing (A215), not working out a figure.
const figure = (value: Rational): MeterFigure => ({ value: Number(value.numerator) / Number(value.denominator), text: signed(money)(value) });

// The meter's props from a finished reading (A260), shared by the Review card, the Open list and the Detail so the three read alike (C9.7):
// mapping and formatting only; the zone, the share, the amount past a rail and the direction against the session before are the domain's.
// Nothing is drawn when a rail cannot be read.
export function meterProps(reading: MeterReading, size: MeterSize, timeZone: string | undefined): MeterProps | undefined {
  const { stop, target, banked, now, previous } = reading;
  if (stop.kind !== 'Value' || target.kind !== 'Value') return undefined;
  const nowProps: MeterProps['now'] =
    now.kind === 'Value'
      ? {
          kind: 'Value',
          ...figure(now.value.pnl),
          zone: now.value.zone === 'Between' ? 'Within' : now.value.zone,
          ...(now.value.share && { share: { percent: `${now.value.share.percent.numerator}%`, toward: now.value.share.toward } }),
          ...(now.value.pastBy && { pastBy: money(now.value.pastBy.dollars) }),
        }
      : // With no Mark the reason stands in the result's place, in the same words as the P&L card's figure.
        { kind: 'Unavailable', reason: calculation(now, money, timeZone) };
  return {
    size,
    stop: figure(stop.value),
    target: figure(target.value),
    ...(banked.kind === 'Value' && { banked: figure(banked.value) }),
    now: nowProps,
    ...(previous && { previous: { ...figure(previous.pnl), dateLabel: shortDate(previous.tradingDate), ...(previous.direction && { direction: previous.direction }) } }),
  };
}
