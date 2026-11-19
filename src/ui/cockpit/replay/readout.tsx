import { Fragment } from 'react';
import type { ReadoutProps, ReadoutRow } from './replay.types.ts';

// A group's rows in runs, a new run beginning at each row that carries a heading.
function rowsUnderHeadings(rows: readonly ReadoutRow[]): ReadoutRow[][] {
  const runs: ReadoutRow[][] = [];
  for (const row of rows) {
    if (row.heading || runs.length === 0) runs.push([row]);
    else runs[runs.length - 1]!.push(row);
  }
  return runs;
}

// W43: the slider's session as text, every figure the charts draw; the rows are finished, nothing is added up here.
export function Readout({ groups }: ReadoutProps) {
  return (
    <div className="replay-readout" data-testid="readout">
      {groups.map((group) => (
        <section key={group.title} className="replay-readout-group">
          <h3>{group.title}</h3>
          {/* A row with a heading opens a new list under that heading ("Current Risk", "Remaining Reward"); a list holds only its terms. */}
          {rowsUnderHeadings(group.rows).map((part) => (
          <Fragment key={part[0]!.label}>
          {part[0]!.heading && <h4 className="replay-readout-heading">{part[0]!.heading}</h4>}
          <dl>
            {part.map((row) => (
              <div key={row.label} className="replay-readout-row" data-row={row.label}>
                <dt>{row.label}</dt>
                <dd>
                  {/* The kind is for the styling: an Unavailable figure reads in italics, a Not applicable one muted, apart from a Figure. */}
                  <span className="replay-value" data-kind={row.value.kind}>
                    {row.value.text}
                  </span>
                  {/* Where the Trade would end, beside the amount from here; the change line (a block) follows, below both. */}
                  {row.pnl && (
                    <span className="replay-pnl">
                      {' · P&L '}
                      <span className="replay-pnl-value" data-kind={row.pnl.kind}>
                        {row.pnl.text}
                      </span>
                    </span>
                  )}
                  {row.change && <span className="replay-change"> {row.change}</span>}
                </dd>
              </div>
            ))}
          </dl>
          </Fragment>
          ))}
        </section>
      ))}
    </div>
  );
}
