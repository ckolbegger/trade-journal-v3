// The Position drawer's adapter (A216): the Detail view and the time zone in, finished display values out. Only this file and its test import the view's types.
import { createElement } from 'react';
import type { TradeDetailView } from '../../../app/types.ts';
import { calculation, signed, unavailableLabel } from '../../figures.ts';
import { localTime, money, quantity, tradeSummary } from '../../format.ts';
import { LotMatchesTable } from '../../screens/LotMatchesTable.tsx';
import { ExecutionsSection, outcomesOnly, SettlementSection } from '../../screens/trade-detail/Position.tsx';
import { ClosedResultSection } from '../../screens/trade-detail/Result.tsx';
import { positionText } from '../../screens/trade-detail/words.ts';
import type { PositionDrawerProps } from './position.types.ts';

export function positionProps(input: unknown, timeZone: string): PositionDrawerProps | undefined {
  const view = input as TradeDetailView;
  if ('recordedPositionChanges' in view) {
    return {
      executions: createElement(ExecutionsSection, { positionChanges: view.recordedPositionChanges, journal: outcomesOnly(view.journal), legs: view.plan.legs, timeZone }),
      settlement: createElement(SettlementSection, { positionChanges: view.recordedPositionChanges, timeZone }),
    };
  }
  if (!('positionChanges' in view)) return undefined;
  const closed = 'terminalDisposition' in view;
  const { positionChanges } = view;
  const executions = positionChanges.flatMap((change) => change.executions);
  const openedAt = (executionId: string) => localTime(executions.find((e) => e.factId === executionId)?.economicTime ?? '', timeZone);
  const { fees, feeReconciliation } = view;
  const due = 'settlement' in view ? view.settlement[0] : undefined;
  return {
    ...(closed
      ? { result: createElement(ClosedResultSection, { view }) }
      : {
          ...(view.summary && { tradeSummary: tradeSummary(view.summary, timeZone) }),
          summary: [
            { label: 'Position', value: view.positions.map(positionText).join(', ') },
            { label: 'Opening fees', value: money(fees.incurredOpening) },
            { label: 'Last activity', value: localTime(view.lastActivity, timeZone), plain: true },
          ],
          openLots: {
            columns: ['Opened', 'Quantity', 'Price', 'Unconsumed opening fee'],
            rows: view.positions.flatMap((p) =>
              p.openLots.map((lot) => [openedAt(lot.openingExecutionId), quantity(lot.quantity), money(lot.price), money(lot.unconsumedOpeningFee)]),
            ),
          },
          figures: [
            {
              label: 'Open P&L',
              value: due
                ? unavailableLabel({ reason: 'SettlementDue', instrument: due.instrument, expiration: due.expiration })
                : calculation(view.current.evaluation.remainingOpenPnl, signed(money)),
            },
            { label: 'Realized to date', value: calculation(view.current.evaluation.realizedToDate, signed(money)) },
            { label: 'Incurred fees', value: calculation(view.current.evaluation.incurredFees, money) },
          ],
        }),
    ...(view.lotMatches.length > 0 && {
      lotMatches: {
        roundingNote: 'Each match’s amount is rounded to the cent for display.',
        table: createElement(LotMatchesTable, {
          caption: 'Lot Matches',
          describedBy: 'lot-matches-note',
          rows: view.lotMatches,
          executions,
          settlements: positionChanges.flatMap((change) => change.settlements ?? []),
          option: view.plan.legs[0]?.instrument.kind === 'Option',
          timeZone,
        }),
      },
      feeReconciliation: [
        { label: 'Incurred fees', value: money(feeReconciliation.incurred) },
        { label: 'Opening fees incurred', value: money(feeReconciliation.incurredOpening) },
        { label: 'Opening fees allocated to Lot Matches', value: money(feeReconciliation.allocatedOpening) },
        { label: 'Opening fees unconsumed', value: money(feeReconciliation.unconsumedOpening) },
        { label: 'Disposal fees incurred', value: money(feeReconciliation.incurredDisposal) },
        { label: 'Disposal fees allocated to Lot Matches', value: money(feeReconciliation.allocatedDisposal) },
      ],
    }),
    executions: createElement(ExecutionsSection, { positionChanges, journal: outcomesOnly(view.journal), legs: view.plan.legs, timeZone }),
    settlement: createElement(SettlementSection, { positionChanges, timeZone }),
  };
}
