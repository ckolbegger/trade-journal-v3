import { Words } from './figure-words.tsx';
import type { ReadoutProps, ReadoutValue, StakeGrid } from './replay.types.ts';

// W61: a cell or value that needs a Mark it does not have is a dash named "No Mark", as in Price History.
// A grid cell is one figure and does not wrap (its stylesheet); a row's value may hold several (C9AR.2), so it is drawn by `Words`.
function shown(value: ReadoutValue, inRow = false) {
  if (value.kind === 'Unavailable' && value.text === 'No Mark') {
    return (
      <span role="img" aria-label="No Mark">
        —
      </span>
    );
  }
  if (inRow) {
    return <Words text={value.text} />;
  }
  return value.text;
}

function StakeGridTable({ grid }: { grid: StakeGrid }) {
  return (
    <table className="replay-stake-grid">
      <thead>
        <tr>
          <th scope="col">
            <span className="visually-hidden">Stake</span>
          </th>
          {grid.columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      {grid.pastLine && (
        <tbody>
          <tr className="replay-past-line" title={grid.pastLine.term}>
            <td colSpan={4}>
              <Words text={grid.pastLine.text} />
            </td>
          </tr>
        </tbody>
      )}
      {grid.groups.map((group) => (
        <tbody key={group.heading}>
          <tr>
            <th scope="rowgroup" colSpan={4}>
              {group.heading}
            </th>
          </tr>
          {group.rows.map((row) => (
            <tr key={row.label} data-row={row.label} data-weight={row.weight} title={row.term}>
              <th scope="row">{row.label}</th>
              <td className="replay-value" data-kind={row.fromHere.kind} colSpan={row.r ? 1 : 3}>
                {shown(row.fromHere)}
              </td>
              {row.r && (
                <td className="replay-r" data-kind={row.r.kind}>
                  {shown(row.r)}
                </td>
              )}
              {row.pnlIfHit && (
                <td className="replay-pnl-value" data-kind={row.pnlIfHit.kind}>
                  {shown(row.pnlIfHit)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}

// W43: the slider's session as text, every figure the charts draw; the rows are finished, nothing is added up here.
export function Readout({ groups }: ReadoutProps) {
  return (
    <div className="replay-readout" data-testid="readout">
      {groups.map((group) => (
        <section key={group.title} className={group.grid ? 'replay-readout-group replay-readout-group-stake' : 'replay-readout-group'}>
          <h3>{group.title}</h3>
          {group.grid && <StakeGridTable grid={group.grid} />}
          {/* W60: what the odds are, once, under the grid. */}
          {group.grid?.odds && <p className="replay-odds-note">{group.grid.odds.note}</p>}
          {group.rows.length > 0 && (
            <dl>
              {group.rows.map((row) => (
                <div key={row.label} className="replay-readout-row" data-row={row.label} title={row.term}>
                  <dt>{row.label}</dt>
                  <dd>
                    {/* The kind is for the styling: an Unavailable figure reads in italics, a Not applicable one muted, apart from a Figure. */}
                    <span className="replay-value" data-kind={row.value.kind}>
                      {row.label === 'Reward to risk' && group.grid?.odds ? (
                        // The odds are heard in full, where the page shows them as ratio-like marks (A267).
                        // The ratio stays plain text; only the odds part is labelled, since an image hides its children.
                        (() => {
                          const [ratio, ...oddsMarks] = row.value.text.split(' · ');
                          return (
                            <>
                              <Words text={ratio!} /> · <span role="img" aria-label={group.grid.odds.spoken}><Words text={oddsMarks.join(' · ')} /></span>
                            </>
                          );
                        })()
                      ) : (
                        shown(row.value, true)
                      )}
                    </span>
                    {row.tag && <span className="replay-chip-tag">{row.tag}</span>}
                    {/* The change line (decision 8) is a block under the figure, on the Trade P&L and each Mark only. */}
                    {row.change && <span className="replay-change"> <Words text={row.change} /></span>}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ))}
    </div>
  );
}
