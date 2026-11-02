import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { PositionChangeResult } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { Badge } from '../Badge.tsx';
import { calculation, closedViaSale, signed } from '../figures.ts';
import { decimalMoney as price, localTime, money, quantity, rMultiple } from '../format.ts';
import type { CloseReasonOption } from './ClosingTheTrade.tsx';
import { FormTitle, SectionHeading } from './heading-level.tsx';
import { LotMatchesTable } from './LotMatchesTable.tsx';
import { reflectionMessage } from './PositionChangeReceipt.tsx';

type Recorded = Extract<PositionChangeResult, { readonly kind: 'Recorded' }>;

export interface ExitReceiptProps {
  readonly result: Recorded;
  readonly timeZone: string;
  // The Close Reasons the form offered, to name the one the result holds by identity.
  readonly closeReasons: readonly CloseReasonOption[];
  // Where a host shows the receipt inside its own page (the Review's card, A94): this follows it in place of the link back to
  // the Trade. Its heading levels are the host's, through the form that shows it.
  readonly after?: ReactNode;
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
export function ExitReceipt({ result, timeZone, closeReasons, after }: ExitReceiptProps) {
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
  // An earlier-dated exit (P23) changes matches of other exits: a match that was revised or removed
  // always belonged to an earlier derivation, and a created one belongs to another exit when its
  // disposing Execution is not one of this Position Change's. A plain exit only creates its own.
  const ownExecutions = new Set(saved.executions.map((e) => e.factId));
  const { lotMatchChanges, realizedToDate } = receipt;
  const disclosed = lotMatchChanges.some((c) => c.kind !== 'Created' || !ownExecutions.has(c.disposingExecutionId));
  const matchQuantity = (amount: Rational | null) => (amount === null ? '—' : quantity(amount));

  return (
    <section className="card" aria-labelledby="receipt-heading">
      <FormTitle id="receipt-heading" ref={headingRef} tabIndex={-1}>
        Exit recorded
      </FormTitle>
      <section aria-labelledby="saved-change-heading">
        <SectionHeading id="saved-change-heading">
          Position Change at <span className="nowrap">{localTime(saved.economicTime, timeZone)}</span>
        </SectionHeading>
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
        <SectionHeading id="lot-matches-heading">Lot Matches</SectionHeading>
        <LotMatchesTable
          rows={derivation.lotMatches.map((match, index) => ({ ...match, realized: derivation.lotMatchResults[index]!.realized }))}
          executions={trade.positionChanges.flatMap((c) => c.executions)}
          timeZone={timeZone}
        />
      </section>
      {disclosed && (
        <section aria-labelledby="changed-matches-heading">
          <SectionHeading id="changed-matches-heading">Changed Lot Matches</SectionHeading>
          <p>This exit is dated before a later recorded change, so the sales are matched to the purchases again in order. The matches that changed:</p>
          <table>
            <thead>
              <tr>
                <th scope="col">Change</th>
                <th scope="col">Bought</th>
                <th scope="col">Sold</th>
                <th scope="col">Quantity before</th>
                <th scope="col">Quantity after</th>
              </tr>
            </thead>
            <tbody>
              {lotMatchChanges.map((change) => (
                <tr key={`${change.openingExecutionId}|${change.disposingExecutionId}`}>
                  <td>{change.kind}</td>
                  <td>{at(change.openingExecutionId)}</td>
                  <td>{at(change.disposingExecutionId)}</td>
                  <td className="number">{matchQuantity(change.quantity.before)}</td>
                  <td className="number">{matchQuantity(change.quantity.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl>
            <dt>Realized to date before</dt>
            <dd className="number">{signed(money)(realizedToDate.before)}</dd>
            <dt>Realized to date after</dt>
            <dd className="number">{signed(money)(realizedToDate.after)}</dd>
          </dl>
        </section>
      )}
      <section aria-labelledby="exit-result-heading">
        <SectionHeading id="exit-result-heading">Result</SectionHeading>
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
              <dd>{calculation(derivation.terminalDisposition, closedViaSale)}</dd>
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
      {after ?? (
        <Link className="pill primary" to={`/trades/${receipt.tradeId}`}>
          Back to the Trade
        </Link>
      )}
    </section>
  );
}
