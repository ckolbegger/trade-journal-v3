import type { OpenTradeDetail, PlannedTradeDetail } from '../../../app/types.ts';
import { calculation } from '../../figures.ts';
import { PayoffView } from '../PayoffView.tsx';
import { Figure } from './figure.tsx';

// The Planned and Current Expiration Payoff, each its own section and apart from every Mark-dependent figure
// (A119). The Current chart marks the value at expiration at the Underlying's latest close (A122), once it has a number.
export function PayoffSections({ view }: { readonly view: PlannedTradeDetail | OpenTradeDetail }) {
  const symbol = view.plan.underlying;
  const atClose = 'current' in view ? view.current.evaluation.expirationValueAtUnderlyingClose : undefined;
  return (
    <>
      <PayoffView kind="Planned" symbol={symbol} result={view.payoff.planned} />
      <PayoffView kind="Current" symbol={symbol} result={view.payoff.current} {...(atClose?.kind === 'Value' && { latestClose: atClose.value })} />
      {/* Where the figure has no number, the module says why (row 23.11); a flat or stock Trade shows none. */}
      {atClose?.kind === 'Unavailable' && (
        <section className="card">
          <dl className="figure-grid">
            <Figure term={`Value at expiration at ${symbol}'s latest close`} plain>{calculation(atClose, () => '')}</Figure>
          </dl>
        </section>
      )}
    </>
  );
}
