import { Link } from 'react-router';
import type { OpenTradeDetail } from '../../../app/types.ts';
import type { UnavailableReason } from '../../../domain/calculation-result/index.ts';
import { Badge } from '../../Badge.tsx';
import { text, unavailableWords } from '../../calculation-words.ts';
import { calculation, pnlText, signed } from '../../figures.ts';
import { decimalMoney as price, localTime, money, shortDate } from '../../format.ts';
import { Figure } from './figure.tsx';
import type { Evaluation } from './words.ts';

// The Mark that valued the figures at the Expected Mark Date: its price, source, and save time, and
// the reason when the effective revision is a Correction.
export function ValuationSection({ tradeId, current, timeZone }: { readonly tradeId: string; readonly current: OpenTradeDetail['current']; readonly timeZone: string }) {
  const { mark, markResolution, evaluation } = current;
  const { instrument } = evaluation.observation;
  const symbol = instrument.symbol;
  const date = evaluation.valuationDate;
  const sentence = (reason: UnavailableReason) => text(unavailableWords(reason, 'sentence', timeZone));
  const stale = evaluation.staleContext;
  return (
    <section className="card" aria-labelledby="valuation-heading">
      <h2 id="valuation-heading">Valuation</h2>
      {markResolution?.kind === 'Missing' && (
        <p>
          <Link to={`/review?trade=${encodeURIComponent(tradeId)}&instrument=${encodeURIComponent(symbol)}`}>{sentence({ reason: 'MarkMissing', instrument, date })}</Link>
        </p>
      )}
      {markResolution?.kind === 'AcknowledgedUnavailable' && <p>{`${sentence({ reason: 'AcknowledgedUnavailable', instrument, date })}: your acknowledgment, not a price`}</p>}
      {stale && <p>{`Stale context: ${price(stale.price)} from ${shortDate(stale.tradingDate)} close (stale, not used in any current figure)`}</p>}
      <dl className="figure-grid">
        {current.expectedMarkDate && <Figure term="Expected Mark Date" plain>{shortDate(current.expectedMarkDate)}</Figure>}
        {mark && (
          <>
            <Figure term="Mark">{price(mark.price)}</Figure>
            <Figure term="Source" plain>{mark.source}</Figure>
            <Figure term="Saved" plain>{localTime(mark.savedAt, timeZone)}</Figure>
          </>
        )}
        {current.underlyingMark && <Figure term="Underlying Mark">{`${price(current.underlyingMark.price)} · ${current.underlyingMark.source}`}</Figure>}
        <ValuationFigures evaluation={current.evaluation} />
      </dl>
      {mark?.correctionReason !== undefined && (
        <p>
          <Badge tone="info">Corrected</Badge> {mark.correctionReason}
        </p>
      )}
    </section>
  );
}

// Realized, open, and Current Marked Trade P&L and incurred fees, each its own figure; the dated line uses the same.
export function ValuationFigures({ evaluation }: { readonly evaluation: Evaluation }) {
  return (
    <>
      <Figure term="Realized to date">{calculation(evaluation.realizedToDate, signed(money))}</Figure>
      <Figure term="Open P&L">{calculation(evaluation.remainingOpenPnl, signed(money))}</Figure>
      <Figure term="Current Marked Trade P&L">{pnlText(evaluation.currentMarkedPnl, evaluation.currentMarkedPnlInPlanR)}</Figure>
      <Figure term="Incurred fees">{calculation(evaluation.incurredFees, money)}</Figure>
    </>
  );
}
