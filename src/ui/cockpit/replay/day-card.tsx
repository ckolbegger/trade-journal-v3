import { Words } from './figure-words.tsx';
import type { DayWords } from './replay.types.ts';

// W147: "What you did that day": the session's fills, then the Action and its reason, or why there is none. It stands first in the readout's
// column. A Review not written reads amber, never red: it is a gap to fill, not a loss. The reason is the trader's own words, shown as typed.
export function DayCard({ day }: { readonly day: DayWords }) {
  const { fills, action } = day;
  return (
    <section className="replay-day" aria-labelledby="replay-day-title">
      <h3 id="replay-day-title">What you did that day</h3>
      {fills && (
        <p className="replay-day-fills">
          <Words text={fills} />
        </p>
      )}
      {action && (
        <p className="replay-day-action" data-kind={action.kind}>
          <Words text={action.text} />
          {action.reason && (
            <>
              {' · '}
              <span className="replay-day-reason">{action.reason}</span>
            </>
          )}
        </p>
      )}
    </section>
  );
}
