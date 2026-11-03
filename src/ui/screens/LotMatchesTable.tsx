import type { CalculationResult, ExecutionFact } from '../../app/types.ts';
import type { Rational } from '../../domain/values/index.ts';
import { calculation, signed } from '../figures.ts';
import { decimalMoney as price, localTime, money, quantity } from '../format.ts';

export interface LotMatchRow {
  readonly openingExecutionId: string;
  readonly disposingExecutionId: string;
  readonly quantity: Rational;
  readonly realized: CalculationResult<Rational>;
}

// The derived Lot Matches: each purchase and sale named by its price and time, the matched
// quantity, and the realized amount, rounded to cents for display (A80).
export function LotMatchesTable({
  rows,
  executions,
  timeZone,
  caption,
  describedBy,
}: {
  readonly rows: readonly LotMatchRow[];
  readonly executions: readonly ExecutionFact[];
  readonly timeZone: string;
  // Names the table where its section does not (the Detail's scroll region).
  readonly caption?: string;
  // The id of a note that describes the table, so a screen reader announces it with the table.
  readonly describedBy?: string;
}) {
  const at = (executionId: string) => {
    const execution = executions.find((e) => e.factId === executionId)!;
    return `${price(execution.price)} on ${localTime(execution.economicTime, timeZone)}`;
  };
  return (
    <table aria-describedby={describedBy}>
      {caption !== undefined && <caption>{caption}</caption>}
      <thead>
        <tr>
          <th scope="col">Bought</th>
          <th scope="col">Sold</th>
          <th scope="col" className="number">
            Quantity
          </th>
          <th scope="col" className="number">
            Realized
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((match) => (
          <tr key={`${match.openingExecutionId}|${match.disposingExecutionId}`}>
            <td className="nowrap">{at(match.openingExecutionId)}</td>
            <td className="nowrap">{at(match.disposingExecutionId)}</td>
            <td className="number nowrap">{quantity(match.quantity)}</td>
            <td className="number nowrap">{calculation(match.realized, signed(money))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
