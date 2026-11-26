import type { CSSProperties } from 'react';
import type { ActionMark } from './replay.types.ts';

// W149: one cell for each revealed session, under the chart, in the chart's own columns (each session's slot, the Plan's column first, as in the chart): the
// letter of the Action saved for it, or a dash for a session that owed a Review and has none. The cell says its date and Action to a screen reader.
export function ActionRow({ cells, slots, actionKey }: { readonly cells: readonly { readonly dateLabel: string; readonly slot: number; readonly mark?: ActionMark }[]; readonly slots: number; readonly actionKey: string }) {
  return (
    <div className="replay-action-row-box">
      <ol className="replay-action-row" aria-label="Action by session" style={{ '--action-columns': slots + 1 } as CSSProperties}>
        {cells.map(({ dateLabel, slot, mark }) => (
          <li key={dateLabel} style={{ gridColumn: slot + 2 }} {...(!mark && { 'aria-hidden': true })}>
            {mark && (
              <>
                <span className="card-figure" aria-hidden="true">
                  {mark.letter}
                </span>
                <span className="visually-hidden">
                  {dateLabel}: {mark.name}
                </span>
              </>
            )}
          </li>
        ))}
      </ol>
      <p className="replay-action-key">{actionKey}</p>
    </div>
  );
}
