// The Plan and Risk drawer (P96, A216): Plan, Plan Baseline and Entry Quality as plain-prop sections. The shell hands it a Detail's view, and the
// adapter turns that into finished display values; the sections themselves import no view type.
import type { ReactNode } from 'react';
import { planRiskProps, type PlanRiskSource } from './plan-risk.props.ts';
import type { PlanRiskDrawerProps, PlanRiskGroup, PlanRiskRow } from './plan-risk.types.ts';
import { WithSecondLine } from '../../SecondLine.tsx';
import { TradeText } from '../../TradeText.tsx';

// A row's value: one line per condition, an amount with its second line, or the plain text.
function valueContent({ value, second }: PlanRiskRow): ReactNode {
  if (typeof value !== 'string') return value.map((line, at) => <div key={at}>{line}</div>);
  if (second !== undefined) return <WithSecondLine amount={value} second={second} />;
  return value;
}

function Row({ row }: { readonly row: PlanRiskRow }) {
  return (
    <div>
      <dt>{row.label}</dt>
      <dd className={row.plain ? undefined : 'number'}>{valueContent(row)}</dd>
    </div>
  );
}

function Group({ group }: { readonly group: PlanRiskGroup }) {
  return (
    <section className="card" {...(group.heading !== undefined && { 'aria-labelledby': `${group.id}-heading` })}>
      {group.heading !== undefined && <h2 id={`${group.id}-heading`}>{group.heading}</h2>}
      {group.note !== undefined && <p>{group.note}</p>}
      {group.table && (
        <div className="table-scroll" role="region" aria-label={`${group.heading} table`} tabIndex={0}>
          <table>
            <thead>
              <tr>
                {group.table.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.table.rows.map((cells, at) => (
                <tr key={at}>
                  {cells.map((cell, column) => (
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
      {group.notes && (
        <ul className="plan-risk-notes" aria-label={group.notes.every((note) => note.label !== undefined) ? 'Worst case and Max reward' : 'Notes'}>
          {group.notes.map((note) => (
            <li key={note.label ?? note.text}>
              {note.label === undefined ? (
                note.text
              ) : (
                <>
                  {note.label}: <span className="number">{note.text}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {group.rows.length > 0 && (
        <dl className="figure-grid">
          {group.rows.map((row) => (
            <Row key={row.label} row={row} />
          ))}
        </dl>
      )}
    </section>
  );
}

export const PlanRiskPanel = ({ tradeSummary, groups }: PlanRiskDrawerProps) => (
  <>
    {tradeSummary && (
      <p className="summary-text number">
        <TradeText text={tradeSummary} />
      </p>
    )}
    {groups.map((group) => (
      <Group key={group.id} group={group} />
    ))}
  </>
);

export const PlanRiskDrawer = (source: PlanRiskSource) => <PlanRiskPanel {...planRiskProps(source)} />;
