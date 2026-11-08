import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import type { PositionChangeResult } from '../../app/types.ts';
import { instrumentLabel } from '../calculation-words.ts';
import { Badge } from '../Badge.tsx';
import { calculation, signed } from '../figures.ts';
import { localTime, money, rMultiple } from '../format.ts';
import { PageTitle } from '../PageTitle.tsx';
import { LotMatchesTable } from './LotMatchesTable.tsx';
import { closedViaOption, timingWords } from './option-disposition.ts';
import { reflectionMessage } from './PositionChangeReceipt.tsx';

type Recorded = Extract<PositionChangeResult, { readonly kind: 'Recorded' }>;

export interface ExpirationReceiptProps {
  readonly result: Recorded;
  readonly timeZone: string;
  // The form was opened from the Review (conflict K14), so the receipt offers the way back to it.
  readonly fromReview: boolean;
}

// The saved Expiration, rendered from the command's post-commit result alone (AC-RESP-001). It has no
// Close Reason: the contract expired rather than being closed by the trader's decision (row 21.16).
export function ExpirationReceipt({ result, timeZone, fromReview }: ExpirationReceiptProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const { receipt, postCommit } = result;
  const { trade, derivation, closeReview } = postCommit;
  const saved = trade.positionChanges.find((c) => c.factId === receipt.createdFactIds[0])!;
  const side = trade.plan.legs[0]!.side;
  const exitMessage = reflectionMessage(postCommit.reflection);
  const closeMessage = closeReview?.kind === 'Entry' ? 'Close Review saved.' : closeReview?.kind === 'Decline' ? `Close Review declined${closeReview.decline.reason ? `: ${closeReview.decline.reason}` : '.'}` : undefined;
  const timing = derivation.optionDispositionTiming;

  return (
    <section className="card" aria-labelledby="receipt-heading">
      <PageTitle id="receipt-heading" ref={headingRef} tabIndex={-1}>
        Expiration recorded
      </PageTitle>
      <section aria-labelledby="saved-change-heading">
        <h2 id="saved-change-heading">
          Position Change at <span className="nowrap">{localTime(saved.economicTime, timeZone)}</span>
        </h2>
        <ul className="executions">
          {(saved.settlements ?? []).map((s) => (
            <li key={s.factId} className="execution-line">{`Expiration of ${s.quantity} ${instrumentLabel(s.instrument)}, no price or fee`}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="lot-matches-heading">
        <h2 id="lot-matches-heading">Lot Matches</h2>
        <div className="table-scroll" role="region" aria-label="Matched lots" tabIndex={0}>
          <LotMatchesTable
            caption="Lot Matches"
            rows={derivation.lotMatches.map((match, index) => ({ ...match, realized: derivation.lotMatchResults[index]!.realized }))}
            executions={trade.positionChanges.flatMap((c) => c.executions)}
            settlements={trade.positionChanges.flatMap((c) => c.settlements ?? [])}
            timeZone={timeZone}
            option
          />
        </div>
      </section>
      <section aria-labelledby="expiration-result-heading">
        <h2 id="expiration-result-heading">Result</h2>
        <dl>
          <dt>Lifecycle</dt>
          <dd>{trade.storedLifecycle}</dd>
          <dt>Realized P&L</dt>
          <dd className="number">{signed(money)(derivation.realizedToDate)}</dd>
          <dt>Realized R</dt>
          <dd className="number">{calculation(derivation.realizedR, signed(rMultiple))}</dd>
          <dt>Terminal Disposition</dt>
          <dd>{calculation(derivation.terminalDisposition, (mechanisms) => closedViaOption(side, mechanisms))}</dd>
          <dt>Option Disposition Timing</dt>
          <dd>{calculation(timing, timingWords)}</dd>
        </dl>
        {exitMessage && <p>{exitMessage}</p>}
        {postCommit.reflection.kind === 'Debt' && <Badge tone="warning">Reflection owed</Badge>}
        {closeMessage && <p>{closeMessage}</p>}
        {closeReview?.kind === 'Debt' && <Badge tone="warning">Close Review owed</Badge>}
      </section>
      <Link className="pill primary" to={`/trades/${receipt.tradeId}`}>
        Back to the Trade
      </Link>
      {fromReview && <Link className="pill secondary" to="/review">Back to the Review</Link>}
    </section>
  );
}
