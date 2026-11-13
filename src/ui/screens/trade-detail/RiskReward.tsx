import type { OpenTradeDetail } from '../../../app/types.ts';
import { Rational } from '../../../domain/values/index.ts';
import { calculation, dollarsAndR } from '../../figures.ts';
import { decimalMoney as price, decimalUnderlyingPrice, money, rMultiple, underlyingPrice } from '../../format.ts';
import { Figure } from './figure.tsx';
import { measureText, type Evaluation } from './words.ts';

// The Mark-dependent risk and reward in dollars and R.
export function ExposureFigures({ evaluation }: { readonly evaluation: Evaluation }) {
  return (
    <>
      <Figure term="Risk to stop">{dollarsAndR(evaluation.ongoingRiskToStop, evaluation.ongoingRiskToStopInPlanR)}</Figure>
      <Figure term="Worst case">{dollarsAndR(evaluation.worstCaseOngoingRisk, evaluation.worstCaseOngoingRiskInPlanR)}</Figure>
      <Figure term="Reward to target">{dollarsAndR(evaluation.incrementalRewardToTarget, evaluation.incrementalRewardToTargetInPlanR)}</Figure>
    </>
  );
}

// Original risk and reward from the frozen Plan, beside the current Mark-dependent risk and reward; a
// figure the Mark cannot give says why, never a zero.
export function RiskRewardSection({
  evaluation,
  baseline,
  option,
  symbol,
}: {
  readonly evaluation: OpenTradeDetail['current']['evaluation'];
  readonly baseline: OpenTradeDetail['baseline'];
  // An option's conditions are Underlying prices, read against the contract's value at expiration there (rows 23.17, C3).
  readonly option: boolean;
  readonly symbol: string;
}) {
  return (
    <section className="card" aria-labelledby="risk-reward-heading">
      <h2 id="risk-reward-heading">Risk and reward</h2>
      <dl className="figure-grid">
        <Figure term="Original risk">{dollarsAndR(evaluation.oneR, { kind: 'Value', value: Rational.of(1n) })}</Figure>
        <ExposureFigures evaluation={evaluation} />
        <Figure term="Max reward">{calculation(evaluation.maximumIncrementalReward, money)}</Figure>
        <Figure term="Original reward">{`${money(baseline.originalPlannedReward)} · ${rMultiple(baseline.rewardRiskRatio)}`}</Figure>
      </dl>
      <div className="table-scroll" role="region" aria-label="Stop and Target conditions" tabIndex={0}>
        <table className="trades">
          <caption>Conditions</caption>
          <thead>
            <tr>
              <th scope="col">Condition</th>
              <th scope="col" className="number">Boundary</th>
              <th scope="col">Status</th>
              <th scope="col" className="number">Distance</th>
              <th scope="col" className="number">Overrun</th>
              {option && (
                <>
                  <th scope="col" className="number">Value at expiration</th>
                  <th scope="col" className="number">{`Distance on ${symbol}`}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {evaluation.conditions.map((condition) => {
              const { result } = condition;
              const reading = result.kind === 'Value' ? result.value : undefined;
              const optionPrice = condition.kind === 'StructureValue';
              // The frozen basis of this Stop or Target: its id is its role and 1-based position.
              const basis = (condition.role === 'Stop' ? baseline.stopBasis : baseline.targetBasis)[Number(condition.id.split('-')[1]) - 1];
              return (
                <tr key={condition.id}>
                  <td>{option ? `${condition.role} on ${optionPrice ? 'the option price' : symbol}` : condition.role}</td>
                  <td className="number">{option && !optionPrice ? decimalUnderlyingPrice(condition.boundary) : price(condition.boundary)}</td>
                  <td>{reading ? reading.status : calculation(result, () => '')}</td>
                  <td className="number">{reading ? measureText(reading.distance) : '—'}</td>
                  <td className="number">{reading ? (reading.overrun ? measureText(reading.overrun) : 'None') : '—'}</td>
                  {option && (
                    <>
                      <td className="number">{basis?.valueAtExpiration ? money(basis.valueAtExpiration) : '—'}</td>
                      <td className="number">{reading?.underlying ? underlyingPrice(reading.underlying.distance) : '—'}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
