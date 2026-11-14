import { createElement } from 'react';
import type { TradeDetailView } from '../../../app/types.ts';
import { plural } from '../../format.ts';
import { useRuntime } from '../../runtime.tsx';
import { expirationDate } from '../../screens/option-words.ts';
import { EXIT_ACTION } from '../../screens/trade-detail/words.ts';
import { IdentityCardView } from './identity-card.tsx';
import type { IdentityAction, IdentityCardProps } from './identity.types.ts';

// " (36 days)", " (1 day)" or " (today)"; the count is absent on an Expired line and when the view carries none.
function daysText(days: number | undefined): string {
  if (days === undefined) return '';
  if (days === 0) return ' (today)';
  return ` (${plural(days, 'day', 'days')})`;
}

// Recording an entry is an authoritative write, offered where the Trade's facts can be replayed and it isn't Closed. An exit needs a Position
// to sell, so only an Open Detail offers it.
function actionsOf(view: TradeDetailView): readonly IdentityAction[] {
  if ('recordedPositionChanges' in view || 'terminalDisposition' in view) return [];
  const to = `/trades/${view.tradeId}/record-entry`;
  return [{ label: 'Record entry', to }, ...('positionChanges' in view ? [{ label: 'Record exit' as const, to: `${to}?action=${EXIT_ACTION}` }] : [])];
}

// The adapter from every Detail form to the identity card's plain props (A216, W2).
export function identityProps(view: TradeDetailView, writable: boolean): IdentityCardProps {
  const leg = view.plan.legs[0];
  const contract = leg?.instrument.kind === 'Option' ? leg.instrument : undefined;
  const expiration = 'contractExpiration' in view ? view.contractExpiration : undefined;
  const lines = [
    ...(contract ? [`Strike ${contract.strike}`] : []),
    ...(expiration ? [`${expiration.status} ${expirationDate(expiration.date)}${daysText(expiration.days)}`] : []),
    `${view.labels.institution} — ${view.labels.account}`,
  ];
  return {
    symbol: view.plan.underlying,
    badge: `${view.labels.strategy}, ${view.lifecycle.stored}`,
    ...('deviations' in view && view.deviations.some((d) => d.versions.at(-1)?.status === 'Active') && { deviationActive: true }),
    lines,
    actions: writable ? actionsOf(view) : [],
    backTo: view.lifecycle.stored === 'Planned' ? '/?lifecycle=Planned' : '/',
  };
}

// The card the shell renders: the Detail's view in, the card's plain props out.
export function IdentityCardFromView({ view }: { readonly view: TradeDetailView; readonly timeZone: string }) {
  const { writable } = useRuntime();
  return createElement(IdentityCardView, identityProps(view, writable));
}
