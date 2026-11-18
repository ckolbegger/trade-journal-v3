import { useState, type KeyboardEvent } from 'react';
import type { ReplayProps } from './replay.types.ts';

// A255: the frame owns the headline, the slider and the reveal rule. It selects finished values; it works out none.
export function ReplayFrame({ tradeKey, sessions, initialSession, sliderLabel, previousLabel, nextLabel, plotBase, Plot, renderSince, renderChips }: ReplayProps) {
  const last = sessions.length - 1;
  // A257: the slider's session is a date held with the Trade it belongs to, so a longer replay of the same Trade keeps it and another Trade starts afresh.
  const [held, setHeld] = useState({ tradeKey, date: initialSession });
  if (held.tradeKey !== tradeKey) setHeld({ tradeKey, date: initialSession });
  const found = sessions.findIndex((s) => s.date === (held.tradeKey === tradeKey ? held.date : initialSession));
  const current = found < 0 ? last : found;
  const session = sessions[current];
  if (!session) return null;
  // W36: with no Mark the reason stands in the figure's place.
  const headline = session.headline.figure ?? session.headline.reason ?? '';
  const move = (to: number) => {
    const date = sessions[Math.min(last, Math.max(0, to))]?.date;
    if (date) setHeld({ tradeKey, date });
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
        {headline}
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
      <Plot {...plotBase} sessions={sessions.slice(0, current + 1).map((s) => s.plot)} sliderIndex={current} />
    </section>
  );
}
