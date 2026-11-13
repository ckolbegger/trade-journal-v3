// The Position drawer (W15, W17, P96): the Position card with its open lots and figures, the Result of a Closed Trade, the Lot Matches, the
// fee reconciliation, the Executions and the Settlement. The shell passes the view and the zone; `position.props` turns them into display values.
import type { ShellProps } from '../placeholder.ts';
import { TradeText } from '../../TradeText.tsx';
import { ChevronIcon } from '../../icons.tsx';
import { Figure } from '../../screens/trade-detail/figure.tsx';
import { positionProps } from './position.props.ts';
import type { PositionDrawerProps } from './position.types.ts';

export function PositionPanel({ tradeSummary, summary, openLots, figures, result, lotMatches, feeReconciliation, executions, settlement }: PositionDrawerProps) {
  return (
    <>
      {result}
      {(summary || openLots || figures) && (
        <section className="card" aria-labelledby="position-heading">
          <h2 id="position-heading">Position</h2>
          {tradeSummary && (
            <p className="summary-text number">
              <TradeText text={tradeSummary} />
            </p>
          )}
          {summary && (
            <dl className="figure-grid">
              {summary.map(({ label, value, plain }) => (
                <Figure key={label} term={label} {...(plain && { plain })}>
                  {value}
                </Figure>
              ))}
            </dl>
          )}
          {/* Tables scroll inside their own focusable region on a narrow screen, never the page. */}
          {openLots && (
            <div className="table-scroll lots-scroll" role="region" aria-label="Open Lots" tabIndex={0}>
              <table className="trades lots">
                <caption>Open Lots</caption>
                <thead>
                  <tr>
                    {openLots.columns.map((column, at) => (
                      <th key={column} scope="col" className={at > 0 ? 'number' : undefined}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {openLots.rows.map((row, at) => (
                    <tr key={at}>
                      {row.map((cell, column) => (
                        <td key={column} className={column > 0 ? 'number' : undefined}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {figures && (
            <dl className="figure-grid">
              {figures.map(({ label, value }) => (
                <Figure key={label} term={label}>
                  {value}
                </Figure>
              ))}
            </dl>
          )}
        </section>
      )}
      {lotMatches && (
        <section className="card" aria-labelledby="lot-matches-heading">
          <h2 id="lot-matches-heading">Lot Matches</h2>
          <p id="lot-matches-note">{lotMatches.roundingNote}</p>
          <div className="table-scroll" role="region" aria-label="Matched lots" tabIndex={0}>
            {lotMatches.table}
          </div>
        </section>
      )}
      {feeReconciliation && (
        <section className="card" aria-labelledby="fee-reconciliation-heading">
          <details className="fee-reconciliation">
            <summary>
              <h2 id="fee-reconciliation-heading">Fee reconciliation</h2>
              <ChevronIcon />
            </summary>
            <dl className="figure-grid">
              {feeReconciliation.map(({ label, value }) => (
                <Figure key={label} term={label}>
                  {value}
                </Figure>
              ))}
            </dl>
          </details>
        </section>
      )}
      {executions}
      {settlement}
    </>
  );
}

export function PositionDrawer({ view, timeZone }: ShellProps) {
  const props = positionProps(view, timeZone ?? 'UTC');
  return props ? <PositionPanel {...props} /> : null;
}
