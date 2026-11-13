import type { OpenTradeDetail } from '../../../app/types.ts';
import { contractCount } from '../option-words.ts';
import { Figure } from './figure.tsx';
import { changeTime, legText } from './words.ts';

const FULFILLMENT: Record<string, string> = {
  Unfilled: 'Unfilled',
  PartiallyFilled: 'Partially filled',
  FilledAsPlanned: 'Filled as planned',
  FilledWithDeviation: 'Filled with Deviation',
};

// Each Planned Leg's fulfillment under the frozen Plan (A25).
export function FulfillmentSection({ view }: { readonly view: OpenTradeDetail }) {
  return (
    <section className="card" aria-labelledby="fulfillment-heading">
      <h2 id="fulfillment-heading">Planned-Leg Fulfillment</h2>
      <dl className="figure-grid one-column">
        {view.legFulfillment.map((f) => {
          const leg = view.plan.legs.find((l) => l.factId === f.plannedLegId);
          return (
            <Figure key={f.plannedLegId} term={leg ? legText(leg) : f.plannedLegId} plain>
              {FULFILLMENT[f.fulfillment]}
            </Figure>
          );
        })}
      </dl>
    </section>
  );
}

// Each recorded Deviation occurrence in its current version, with the Position Change that caused it.
export function DeviationsSection({ view, timeZone }: { readonly view: OpenTradeDetail; readonly timeZone: string }) {
  const timeOf = (positionChangeId: string) => changeTime(view, positionChangeId, timeZone);
  const optionLeg = view.plan.legs[0]?.instrument.kind === 'Option';
  return (
    <section className="card" aria-labelledby="deviations-heading">
      <h2 id="deviations-heading">Deviations</h2>
      {view.deviations.length === 0 ? (
        <p>No Deviations recorded.</p>
      ) : (
        <ul>
          {view.deviations.map((occurrence) => {
            const current = occurrence.versions.at(-1)!;
            const unit = optionLeg ? contractCount(current.quantityAbovePlan ?? 0) : `${current.quantityAbovePlan} shares`;
            const text = `Entry Size (Excess): ${unit} above plan, caused by the Position Change at ${timeOf(current.causingPositionChangeId)}.`;
            return (
              <li key={occurrence.occurrenceId}>
                {current.status === 'Active' ? (
                  text
                ) : (
                  <>
                    <span className="visually-hidden">Superseded</span>{' '}
                    <del>{text}</del>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
