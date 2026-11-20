import type { TradeReplayView } from '../../../app/types.ts';
import { Rational } from '../../../domain/values/index.ts';
import { plural, quantity, shortDate } from '../../format.ts';
import type { ChipsProps, VolatilityPoint } from './chips.tsx';

// W47: the chips of each session, selected and formatted from the view's estimates (T9.23). A fraction is shown as a percentage and a share
// count as a whole number; nothing is worked out here (ADR 0001).
type ViewSession = TradeReplayView['sessions'][number];
type Estimate = NonNullable<ViewSession['estimates']>['impliedVolatility'];

const TAG = 'estimate';

// W49: why an estimate is Unavailable, as the screen words it.
const REASONS: Partial<Record<Extract<Estimate, { kind: 'Unavailable' }>['reason'], string>> = {
  MarkMissing: 'A Mark is missing.',
  ExpirationSession: 'On the expiration session the price no longer depends on volatility.',
  AtOrBelowExerciseValue: "The Mark is at or below the option's exercise value, so no volatility fits.",
  NoVolatilityFits: 'No volatility fits this Mark.',
  InsensitiveToVolatility: 'This far from the strike, or this close to expiration, the price barely depends on volatility.',
};

// "27.7%": a fraction as the percentage the screen shows.
const percent = (fraction: number): string => `${(fraction * 100).toFixed(1)}%`;

// The words of a volatility: its percentage, "Unavailable", or none where it does not apply (stock).
function volatilityWords(estimate: Estimate): string | undefined {
  if (estimate.kind === 'Estimate') return percent(estimate.value);
  return estimate.kind === 'Unavailable' ? 'Unavailable' : undefined;
}

// "Behaves like ≈ 183 shares", "Behaves like ≈ short 122 shares" (a long Put), "Behaves like 200 shares" (stock, exact): the share count as a whole number.
function sharesOf(estimate: Estimate): ChipsProps['shares'] {
  if (estimate.kind !== 'Estimate') return undefined;
  const whole = Math.round(Math.abs(estimate.value));
  const short = estimate.value < 0 && whole > 0 ? 'short ' : '';
  return { text: `Behaves like ${estimate.exact ? '' : '≈ '}${short}${plural(whole, 'share', 'shares')}`, estimate: estimate.exact !== true };
}

// "4 days to expiration", "Expiration session" at 0 days; "Long 2 contracts", "Short 3 contracts": the contracts held come from the view, and a sign becomes the word.
function optionWords(session: ViewSession, days: number | null): Pick<ChipsProps, 'days' | 'position'> {
  if (days === null) return {};
  const held = session.heldQuantity;
  const short = held.numerator < 0n;
  const count = short ? Rational.of(-held.numerator, held.denominator) : held;
  return { days: days === 0 ? 'Expiration session' : plural(days, 'day', 'days') + ' to expiration', position: `${short ? 'Short' : 'Long'} ${quantity(count)} contract${count.equals(Rational.of(1n)) ? '' : 's'}` };
}

function pointOf(session: ViewSession): VolatilityPoint {
  const estimate = session.estimates?.impliedVolatility;
  return { label: shortDate(session.date), value: estimate?.kind === 'Estimate' ? estimate.value : null, text: (estimate && volatilityWords(estimate)) ?? 'Unavailable' };
}

// The chips of the session on a date; none for a session that holds nothing (it has no estimates). The small chart holds the sessions up to
// that one and no later (P145).
export function chipsOf(view: TradeReplayView): (date: string) => ChipsProps | undefined {
  return (date) => {
    const at = view.sessions.findIndex((s) => s.date === date);
    const session = view.sessions[at];
    const estimates = session?.estimates;
    if (!session || !estimates) return undefined;
    const volatility = estimates.impliedVolatility;
    const words = volatilityWords(volatility);
    const shares = sharesOf(estimates.shareEquivalent);
    const reason = volatility.kind === 'Unavailable' ? REASONS[volatility.reason] : undefined;
    return {
      tag: TAG,
      ...(shares && { shares }),
      ...optionWords(session, estimates.days),
      ...(words !== undefined && { volatility: { text: `Implied volatility ${words}`, ...(reason && { reason }), chartName: 'Implied volatility by session', points: view.sessions.slice(0, at + 1).map(pointOf) } }),
    };
  };
}
