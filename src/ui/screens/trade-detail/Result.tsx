import type { ClosedTradeDetail } from '../../../app/types.ts';
import { calculation, closedViaSale, signed } from '../../figures.ts';
import { money, rMultiple } from '../../format.ts';
import { closedViaOption, timingWords } from '../option-disposition.ts';
import { Figure } from './figure.tsx';

// "Closed via sale of 100 shares": how the exposure ended, with the Close Reason (why the trader closed)
// as its own field. Realized figures are the read model's, with no Mark behind them (A92).
export function ClosedResultSection({ view }: { readonly view: ClosedTradeDetail }) {
  const side = view.plan.legs[0]?.instrument.kind === 'Option' ? view.plan.legs[0].side : undefined;
  return (
    <section className="card" aria-labelledby="result-heading">
      <h2 id="result-heading">Result</h2>
      <dl className="figure-grid">
        <Figure term="Realized P&L">{signed(money)(view.realizedToDate)}</Figure>
        <Figure term="Realized R">{calculation(view.realizedR, signed(rMultiple))}</Figure>
        <Figure term="Terminal Disposition" plain>
          {calculation(view.terminalDisposition, side ? (mechanisms) => closedViaOption(side, mechanisms) : closedViaSale)}
        </Figure>
        {view.optionDispositionTiming && (
          <Figure term="Option Disposition Timing" plain>
            {calculation(view.optionDispositionTiming, timingWords)}
          </Figure>
        )}
        {view.closeReason && (
          <Figure term="Close Reason" plain>
            {view.closeReason.label}
          </Figure>
        )}
      </dl>
    </section>
  );
}
