import { Fragment, useState, type KeyboardEvent } from 'react';
import type { ReadoutRow, ReplayProps } from './replay.types.ts';

// A group's rows in runs, a new run beginning at each row that carries a heading.
function rowsUnderHeadings(rows: readonly ReadoutRow[]): ReadoutRow[][] {
  const runs: ReadoutRow[][] = [];
  for (const row of rows) {
    if (row.heading || runs.length === 0) runs.push([row]);
    else runs[runs.length - 1]!.push(row);
  }
  return runs;
}

// A255: the frame owns the headline, the slider and the reveal rule. It selects finished values; it works out none.
export function ReplayFrame({ tradeKey, sessions, initialSession, sliderLabel, previousLabel, nextLabel, tableTitle, tableColumns, plotBase, Plot, renderSince, renderChips, renderLinks, onSessionChange }: ReplayProps) {
  const last = sessions.length - 1;
  // A257: the slider's session is a date held with the Trade it belongs to, so a longer replay of the same Trade keeps it and another Trade starts afresh.
  const [held, setHeld] = useState({ tradeKey, date: initialSession });
  // The session under the pointer or the keyboard's focus, which the plot reports and the frame shows.
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  if (held.tradeKey !== tradeKey) {
    setHeld({ tradeKey, date: initialSession });
    // Another Trade's sessions are not the ones the pointer was over.
    setHoverIndex(null);
  }
  const found = sessions.findIndex((s) => s.date === (held.tradeKey === tradeKey ? held.date : initialSession));
  const current = found < 0 ? last : found;
  const session = sessions[current];
  if (!session) return null;
  // P118: a session after the slider's is not shown, however it was reached.
  const hovered = hoverIndex === null || hoverIndex > current ? undefined : sessions[hoverIndex];
  // W36: with no Mark the reason stands in the figure's place.
  const headline = session.headline.figure ?? session.headline.reason ?? '';
  const move = (to: number) => {
    const date = sessions[Math.min(last, Math.max(0, to))]?.date;
    if (!date) return;
    setHeld({ tradeKey, date });
    // A257: only a real move is told to the screen, never the first render or a step against an end.
    if (date !== session.date) onSessionChange?.(date);
  };
  // The keys are handled here so every browser steps the same way; the native step is cancelled.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const target = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: last }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    move(target);
  };
  return (
    // The card's edge takes the headline's finished tone; the words below say the result too, so colour is never the only cue (W37).
    <section className="replay-card" data-testid="replay-card" data-tone={session.headline.tone}>
      <p className="replay-headline" data-testid="headline">
        {/* A figure stays on one line (the reason standing in for it may wrap). */}
        {session.headline.figure ? <span className="replay-figure">{headline}</span> : headline}
      </p>
      <p className="replay-going">{session.howItIsGoing}</p>
      {session.stake && <p className="replay-stake">{session.stake}</p>}
      {renderSince?.(session)}
      {renderChips?.(session)}
      <div className="replay-slider">
        <button type="button" aria-label={previousLabel} disabled={current === 0} onClick={() => move(current - 1)}>
          ‹
        </button>
        <input type="range" aria-label={sliderLabel} aria-valuetext={`${session.sliderValue}. ${headline}`} min={0} max={last} value={current} onChange={(event) => move(Number(event.target.value))} onKeyDown={onKeyDown} />
        <button type="button" aria-label={nextLabel} disabled={current === last} onClick={() => move(current + 1)}>
          ›
        </button>
        <span className="replay-slider-value" aria-hidden="true">
          {session.sliderValue}
        </span>
      </div>
      {/* P118: only the sessions up to the slider's reach the plot; a later one is never in the page. */}
      <Plot {...plotBase} sessions={sessions.slice(0, current + 1).map((s) => s.plot)} sliderIndex={current} hoverIndex={hoverIndex} onHoverSession={setHoverIndex} onSelectSession={(index) => index <= current && move(index)} />
      {/* Hover and focus show the session's own lines, finished in the props. */}
      {hovered && (
        <div className="replay-hover" data-testid="hover">
          {hovered.hover.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
      {/* W43: the slider's session as text, every figure the charts draw; the rows are finished, nothing is added up here. */}
      <div className="replay-readout" data-testid="readout">
        {session.readout.map((group) => (
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
      {/* W46: the screen's links for the slider's session, under the readout. */}
      {renderLinks?.(session)}
      {/* W45: the charts' text equivalent, folded; the plot is described by this table, so it holds the revealed sessions only (P118). */}
      <details className="replay-table" onToggle={(e) => setTableOpen(e.currentTarget.open)}>
        <summary>
          <span className="replay-table-cue" aria-hidden="true">
            {tableOpen ? '▾' : '▸'}
          </span>
          {tableTitle}
        </summary>
        {/* The table scrolls sideways inside its own region, a focusable one so the keyboard can reach it. */}
        <div className="replay-table-scroll" role="region" aria-label={tableTitle} tabIndex={0}>
          <table id={plotBase.describedBy}>
            <thead>
              <tr>
                {['Session', ...tableColumns, 'Events'].map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.slice(0, current + 1).map((s) => (
                <tr key={s.date}>
                  <th scope="row">{s.tableRow.dateLabel}</th>
                  {s.tableRow.cells.map((cell, i) => (
                    <td key={i}>{cell}</td>
                  ))}
                  <td>{s.tableRow.events.join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
