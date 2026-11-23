import type { DailyTradeReview } from '../../app/types.ts';
import { money } from '../format.ts';
import { conditionClause, legWords, unsigned } from '../cockpit/replay/readout.props.ts';

export interface PlanBoxProps {
  readonly plan: DailyTradeReview['plan'];
  readonly replay: DailyTradeReview['replay'];
}

const capital = (words: string): string => words.charAt(0).toUpperCase() + words.slice(1);

// The Plan as it was confirmed (W93, U7): the entry, each Stop and Target in the Plan's own terms, the risk (1R) and the reward, with the
// Thesis and "No longer valid if" beside them. Every value is the view's finished figure; nothing is worked out here (ADR 0001).
export function PlanBox({ plan, replay }: PlanBoxProps) {
  const column = replay?.planColumn;
  const leg = column?.terms.legs[0];
  if (!column && !plan) return null;
  return (
    <section className="plan-box" aria-label="Plan">
      <h4>Plan</h4>
      <div className="plan-box-body">
        {column && (
          <dl className="plan-box-terms">
            {column.terms.legs.map((l, i) => (
              <div key={`entry-${i}`} className="plan-box-long">
                <dt>Entry</dt>
                <dd>
                  <strong>{`${legWords(l)} at ${money(l.entryPrice)}`}</strong>
                </dd>
              </div>
            ))}
            {leg &&
              column.terms.conditions.map((condition, i) => (
                <div key={`${condition.role}-${i}`} className="plan-box-long">
                  <dt>{condition.role}</dt>
                  <dd>
                    <strong>{capital(conditionClause(condition, leg))}</strong>
                  </dd>
                </div>
              ))}
            <div>
              <dt>Risk</dt>
              <dd>
                <strong>{`${money(unsigned(column.atStop))} (1R)`}</strong>
              </dd>
            </div>
            <div>
              <dt>Reward</dt>
              <dd>
                <strong>{money(column.atTarget)}</strong>
              </dd>
            </div>
          </dl>
        )}
        {plan && (
          <div className="plan-box-why">
            <p className="plan-box-label">Thesis</p>
            <p>
              <strong>{plan.thesis}</strong>
            </p>
            <p className="plan-box-label">No longer valid if</p>
            <p>
              <strong>{plan.invalidation}</strong>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
