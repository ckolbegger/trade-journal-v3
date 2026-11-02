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
}: {
  readonly rows: readonly LotMatchRow[];
  readonly executions: readonly ExecutionFact[];
  readonly timeZone: string;
  // Names the table where its section does not (the Detail's scroll region).
  readonly caption?: string;
}) {
  const at = (executionId: string) => {
    const execution = executions.find((e) => e.factId === executionId)!;
    return `${price(execution.price)} on ${localTime(execution.economicTime, timeZone)}`;
  };
  return (
    <table>
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
            <td>{at(match.openingExecutionId)}</td>
            <td>{at(match.disposingExecutionId)}</td>
            <td className="number">{quantity(match.quantity)}</td>
            <td className="number">{calculation(match.realized, signed(money))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
