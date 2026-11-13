import type { ShellProps } from '../placeholder.ts';
import { conditionsPropsOf } from './conditions.props.ts';
import type { ConditionsCardProps } from './conditions.types.ts';

// The rail's Conditions card (W5, W6): the shell passes the view, and a test or a later sharing passes the plain props directly. One block per
// condition in Plan order, each on its own list item.
export function ConditionsCard(props: ShellProps | ConditionsCardProps) {
  const card = 'conditions' in props ? props : conditionsPropsOf(props);
  if (!card) return null;
  return (
    <section className="card conditions-card" aria-labelledby="conditions-heading">
      <h2 id="conditions-heading">Conditions</h2>
      <ul className="conditions-list" aria-labelledby="conditions-heading">
        {card.conditions.map((condition) => (
          <li key={condition.id}>
            <div className="condition-head">
              <span className={`condition-role ${condition.role.toLowerCase()}`}>{condition.role}</span>
              {condition.nearest && <span className="badge condition-nearest" data-tone="info">nearest</span>}
              {condition.figure && <span className={`condition-figure number ${condition.figureTone ?? ''}`}>{condition.figure}</span>}
            </div>
            <div className="condition-text nowrap">{condition.text}</div>
            {condition.why && <p className="condition-why">{condition.why}</p>}
          </li>
        ))}
      </ul>
      {card.summary.length > 0 && (
        <ul className="conditions-summary" aria-label="Worst case and Max reward">
          {card.summary.map((line) => (
            <li key={line.label ?? line.text}>
              {line.label && <span className="summary-label">{line.label}: </span>}
              <span className="number">{line.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
