import { useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { DailyTradeReview } from '../../app/types.ts';
import { ReplayDrawer } from '../cockpit/drawers/replay.tsx';
import { overlayWordsOf } from '../cockpit/replay/overlay.props.ts';
import { ReplayOverlay } from '../cockpit/replay/overlay.tsx';
import { ReplayStrip } from './ReplayStrip.tsx';

// A318: a Trade past a line opens its Replay on the session that line was first crossed in; any other Trade, on the newest session.
function openingSessionOf(replay: DailyTradeReview['replay']): string | undefined {
  const crossings = replay?.sessions.at(-1)?.crossings;
  if (crossings?.stop.since) return crossings.stop.first?.date;
  return crossings?.target.since ? crossings.target.first?.date : undefined;
}

export interface CardReplayProps {
  readonly tradeId: string;
  readonly underlying: string;
  readonly replay: NonNullable<DailyTradeReview['replay']>;
  readonly strip: DailyTradeReview['strip'];
  readonly closed?: boolean;
  readonly exitNotCarriedOut?: boolean;
  // The card's panel that is open: the address the overlay's entry is pushed over names it.
  readonly panel: string;
  // The session the overlay first opens on, from a way back from Trade Detail (A257, A274).
  readonly session: string | undefined;
}

// The Replay strip of a card with the Replay overlay it opens (T95.56): on every card, whatever panel is open.
export function CardReplay({ tradeId, underlying, replay, strip, closed, exitNotCarriedOut, panel, session }: CardReplayProps) {
  // A274: the overlay is open while the address holds `replay=open`. Opening pushes one history entry, so Back closes it; Close and Escape go
  // back that entry when this visit pushed it, and otherwise (a reload, a link straight in) replace the address without `replay`.
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const replayOpen = params.get('replay') === 'open';
  // It stays set when the browser's Back closes the overlay: the entry is still in history, and Forward brings the overlay back on it.
  const pushed = useRef(false);
  // The slider's session, from a link's `session` until the slider moves: opening writes it to the address, so the overlay rests there again.
  const sliderAt = useRef(session);
  const onSliderMove = useCallback((date: string) => {
    sliderAt.current = date;
  }, []);
  const openReplay = () => {
    pushed.current = true;
    // A card opened by its header writes no address, so an entry that names another card, panel or Instrument would be a link when the overlay
    // closes back to it: it is first replaced by this card's own address, then the overlay's entry is pushed over it.
    const card = new URLSearchParams(params);
    card.set('trade', tradeId);
    card.set('panel', panel);
    card.delete('instrument');
    card.delete('replay');
    card.delete('session');
    const named = new URLSearchParams(params);
    named.delete('replay');
    named.delete('session');
    const overlay = new URLSearchParams(card);
    overlay.set('replay', 'open');
    // A318: where the slider was left, else the session of the first crossing of the line the Trade is past now (read when the button is pressed, since a save can put it past one).
    const opensAt = sliderAt.current ?? openingSessionOf(replay);
    if (opensAt !== undefined) overlay.set('session', opensAt);
    if (named.size > 0 && named.toString() !== card.toString()) void navigate({ search: card.toString() }, { replace: true });
    void navigate({ search: overlay.toString() });
  };
  const closeReplay = () => {
    if (pushed.current) {
      // It stays set: the entry is still in history after this Back, and Forward brings the overlay back on it.
      void navigate(-1);
      return;
    }
    setParams(
      (now) => {
        const next = new URLSearchParams(now);
        next.delete('replay');
        return next;
      },
      { replace: true },
    );
  };
  // When the overlay closes, focus is on the Replay button, also for an overlay opened from the address (its opener was the body).
  const replayButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !replayOpen) replayButton.current?.focus();
    wasOpen.current = replayOpen;
  }, [replayOpen]);
  return (
    <>
      <ReplayStrip replay={replay} strip={strip} {...(closed && { closed })} {...(exitNotCarriedOut && { exitNotCarriedOut })} onOpen={openReplay} buttonRef={replayButton} />
      {replayOpen && (
        <ReplayOverlay {...overlayWordsOf(underlying, replay)} onClose={closeReplay}>
          {/* P129: the one link out; the address carries the drawer, the session and the way back. */}
          <ReplayDrawer replay={replay} {...(params.get('session') !== null && { initialSession: params.get('session')! })} onSessionChange={onSliderMove} links={({ date }) => <p className="replay-links"><Link className="pill secondary" to={`/trades/${tradeId}?drawer=price-history&session=${date}&from=review`}>Price History</Link></p>} />
        </ReplayOverlay>
      )}
    </>
  );
}
