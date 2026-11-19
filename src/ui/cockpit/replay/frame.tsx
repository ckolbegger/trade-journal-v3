import { useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { Readout } from './readout.tsx';
import type { ReplayProps } from './replay.types.ts';
import { SessionCards } from './session-cards.tsx';

// A255: the frame owns the headline, the slider and the reveal rule. It selects finished values; it works out none.
export function ReplayFrame({ tradeKey, sessions, initialSession, sliderLabel, previousLabel, nextLabel, cardsWords, plotBase, Plot, renderSince, renderChips, renderLinks, onSessionChange }: ReplayProps) {
  const last = sessions.length - 1;
  // A257: the slider's session is a date held with the Trade it belongs to, so a longer replay of the same Trade keeps it and another Trade starts afresh.
  const [held, setHeld] = useState({ tradeKey, date: initialSession });
  // The session under the pointer or the keyboard's focus, which the plot reports and the frame shows.
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
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
      <div className="replay-top">
        {/* Suggestion 14: the session's date, quiet, beside the headline. */}
        <span className="replay-date" data-testid="session-date">
          {session.dateLabel}
        </span>
        {/* A figure stays on one line in the large type; the reason standing in for it is a sentence at normal size (A281). */}
        {session.headline.figure ? (
          <p className="replay-headline" data-testid="headline">
            <span className="replay-figure">{headline}</span>
          </p>
        ) : (
          <p className="replay-headline replay-reason" data-testid="headline">
            {headline}
          </p>
        )}
        {/* A281: a Mark still to add, while the Trade is Open; the link goes to the Review's Marks row. */}
        {session.addMarkTo && <Link to={session.addMarkTo}>Add the Mark</Link>}
      </div>
      {session.howItIsGoing && <p className="replay-going">{session.howItIsGoing}</p>}
      {session.stake && (
        <p className="replay-stake">
          {/* A267: a screen reader hears the odds in full; the visible sentence stays as it is. */}
          {session.stakeSpoken ? (
            <>
              <span aria-hidden="true">{session.stake}</span>
              <span className="visually-hidden">{session.stakeSpoken}</span>
            </>
          ) : (
            session.stake
          )}
        </p>
      )}
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
      <div className="replay-chart-box">
        <Plot {...plotBase} sessions={sessions.slice(0, current + 1).map((s) => s.plot)} sliderIndex={current} hoverIndex={hoverIndex} onHoverSession={setHoverIndex} onSelectSession={(index) => index <= current && move(index)} />
        {/* Hover and focus show the session's own lines, finished in the props, in a box over the chart: nothing moves (suggestion 14). */}
        {hovered && (
          <div className="replay-hover" data-testid="hover">
            {hovered.hover.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}
      </div>
      <Readout groups={session.readout} />
      {/* W46: the screen's links for the slider's session, under the readout. */}
      {renderLinks?.(session)}
      {/* A277: the charts' text equivalent; the plot is described by its list, which holds the revealed sessions only (P118), newest first. */}
      <SessionCards {...cardsWords} id={plotBase.describedBy} cards={sessions.slice(0, current + 1).reverse().map((s) => ({ ...s.card, id: s.date, isCurrent: s.date === session.date }))} onSelectSession={(id) => move(sessions.findIndex((s) => s.date === id))} />
    </section>
  );
}
