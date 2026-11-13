import { Link } from 'react-router';
import { useRuntime } from '../../runtime.tsx';
import type { ShellProps } from '../placeholder.ts';
import { needsYouPropsOf } from './needs-you.props.ts';
import type { NeedsYouItem, NeedsYouProps } from './needs-you.types.ts';

// What the shell may add to its own props: the way to select the Journal drawer and open a Debt's form on its card (A217).
export interface NeedsYouShellProps extends ShellProps {
  readonly onReflectNow?: (debtId: string) => void;
}

function Item({ item }: { readonly item: NeedsYouItem }) {
  if (item.kind === 'Alert') return <li role="alert">{item.text}</li>;
  if (item.kind === 'Note') return <li>{item.text}</li>;
  if (item.kind === 'MarkMissing') {
    return (
      <li>
        <Link to={item.reviewTo}>{item.text}</Link>
      </li>
    );
  }
  if (item.kind === 'SettlementDue') {
    return (
      <li>
        <section className="settlement-due" aria-labelledby={`needs-you-${item.id}`}>
          <h3 id={`needs-you-${item.id}`}>{item.heading}</h3>
          <dl className="figure-grid">
            {item.rows.map((row, at) => (
              <div key={`${row.label}-${at}`}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          {item.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
          {item.recordExpirationTo && (
            <Link className="pill primary" to={item.recordExpirationTo}>
              Record expiration
            </Link>
          )}
        </section>
      </li>
    );
  }
  return (
    <li className="needs-you-debt">
      <h3>{item.heading}</h3>
      {item.dueText && <p>{item.dueText}</p>}
      {item.onReflectNow && (
        <button type="button" className="pill secondary" onClick={item.onReflectNow}>
          Reflect now
        </button>
      )}
    </li>
  );
}

// The rail's Needs you card (W7): what is owed, due or crossed, or "Nothing needs you now.". The shell passes the view, and a test or a later
// sharing passes the plain props directly.
export function NeedsYou(props: NeedsYouShellProps | NeedsYouProps) {
  const { writable } = useRuntime();
  const card = 'items' in props ? props : needsYouPropsOf(props, { writable, ...(props.onReflectNow && { onReflectNow: props.onReflectNow }) });
  if (!card) return null;
  return (
    <section className="card needs-you-card" aria-labelledby="needs-you-heading">
      <h2 id="needs-you-heading">Needs you</h2>
      {card.items.length === 0 ? (
        <p>Nothing needs you now.</p>
      ) : (
        <ul className="needs-you-list">
          {card.items.map((item) => (
            <Item key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
