import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import type { PositionChangeResult } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { Badge } from '../Badge.tsx';
import { calculation, signed } from '../figures.ts';
import { decimalMoney as price, localTime, money, quantity, rMultiple } from '../format.ts';
import { PageTitle } from '../PageTitle.tsx';
import type { CloseReasonOption } from './ClosingTheTrade.tsx';
import { reflectionMessage } from './PositionChangeReceipt.tsx';

type Recorded = Extract<PositionChangeResult, { readonly kind: 'Recorded' }>;

export interface ExitReceiptProps {
  readonly result: Recorded;
  readonly timeZone: string;
  // The Close Reasons the form offered, to name the one the result holds by identity.
  readonly closeReasons: readonly CloseReasonOption[];
}

// A Close Review is not a reflection on the exit: its words name it.
function closeReviewMessage(outcome: NonNullable<Recorded['postCommit']['closeReview']>): string | undefined {
  switch (outcome.kind) {
    case 'Entry':
      return 'Close Review saved.';
    case 'Debt':
      return undefined;
    case 'Decline':
      return `Close Review declined${outcome.decline.reason ? `: ${outcome.decline.reason}` : '.'}`;
  }
}

// The saved exit, rendered from the command's post-commit result alone (AC-RESP-001): the Position
// Change, the derived Lot Matches, the realized figures, and, when the exit closed the Trade, its
// Terminal Disposition and Close Reason, with the outcome of each reflection.
export function ExitReceipt({ result, timeZone, closeReasons }: ExitReceiptProps) {
  // The receipt replaces the form in place, so focus moves to its heading when it appears.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const { receipt, postCommit } = result;
  const { trade, derivation, closeReview } = postCommit;
  const savedId = receipt.createdFactIds[0]!;
  const saved = trade.positionChanges.find((c) => c.factId === savedId)!;
  const executions = new Map(trade.positionChanges.flatMap((c) => c.executions.map((e) => [e.factId, e] as const)));
  const closed = trade.storedLifecycle === 'Closed';
  const closeReason = trade.closeReason?.closeReasonId;
  const exitMessage = reflectionMessage(postCommit.reflection);
  const closeMessage = closeReview && closeReviewMessage(closeReview);
  const at = (executionId: string) => {
    const execution = executions.get(executionId)!;
    return `${price(execution.price)} on ${localTime(execution.economicTime, timeZone)}`;
  };
  const disposition = (mechanisms: readonly { readonly quantity: Rational }[]) =>
    `Closed via sale of ${quantity(mechanisms.reduce((total, m) => total.add(m.quantity), Rational.of(0n)))} shares`;

  return (
    <section className="card" aria-labelledby="receipt-heading">
      <PageTitle id="receipt-heading" ref={headingRef} tabIndex={-1}>
        Exit recorded
      </PageTitle>
      <section aria-labelledby="saved-change-heading">
        <h2 id="saved-change-heading">
          Position Change at <span className="nowrap">{localTime(saved.economicTime, timeZone)}</span>
        </h2>
        <ul className="executions">
          {saved.executions.map((e) => (
            <li key={e.factId} className="execution-line">
              <span className="execution-what">{`${e.action} ${e.quantity} ${e.instrument.symbol}`}</span>{' '}
              <span className="execution-price number">{`@ ${price(e.price)}`}</span>,{' '}
              <span className="nowrap number">{`fee ${price(e.fee)}`}</span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="lot-matches-heading">
        <h2 id="lot-matches-heading">Lot Matches</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Bought</th>
              <th scope="col">Sold</th>
              <th scope="col">Quantity</th>
              <th scope="col">Realized</th>
            </tr>
          </thead>
          <tbody>
            {derivation.lotMatches.map((match, index) => (
              <tr key={`${match.openingExecutionId}|${match.disposingExecutionId}`}>
                <td>{at(match.openingExecutionId)}</td>
                <td>{at(match.disposingExecutionId)}</td>
                <td className="number">{quantity(match.quantity)}</td>
                <td className="number">{calculation(derivation.lotMatchResults[index]!.realized, signed(money))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section aria-labelledby="exit-result-heading">
        <h2 id="exit-result-heading">Result</h2>
        <dl>
          <dt>Lifecycle</dt>
          <dd>{trade.storedLifecycle}</dd>
          <dt>{closed ? 'Realized P&L' : 'Realized to date'}</dt>
          <dd className="number">{signed(money)(derivation.realizedToDate)}</dd>
          {closed && (
            <>
              <dt>Realized R</dt>
              <dd className="number">{calculation(derivation.realizedR, signed(rMultiple))}</dd>
              <dt>Terminal Disposition</dt>
              <dd>{calculation(derivation.terminalDisposition, disposition)}</dd>
              {closeReason !== undefined && (
                <>
                  <dt>Close Reason</dt>
                  <dd>{closeReasons.find((r) => r.id === closeReason)?.label ?? closeReason}</dd>
                </>
              )}
            </>
          )}
        </dl>
        {exitMessage && <p>{exitMessage}</p>}
        {postCommit.reflection.kind === 'Debt' && <Badge tone="warning">Reflection owed</Badge>}
        {closeMessage && <p>{closeMessage}</p>}
        {closeReview?.kind === 'Debt' && <Badge tone="warning">Close Review owed</Badge>}
      </section>
      <Link className="pill primary" to={`/trades/${receipt.tradeId}`}>
        Back to the Trade
      </Link>
    </section>
  );
}
