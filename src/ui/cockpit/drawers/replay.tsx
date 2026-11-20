import { useMemo, type ReactNode } from 'react';
import { Chips } from '../replay/chips.tsx';
import { chipsOf } from '../replay/chips.props.ts';
import { CorridorPlot } from '../replay/corridor.tsx';
import { ReplayFrame } from '../replay/frame.tsx';
import { replayProps, type ReplayView } from '../replay/replay.props.ts';
import { SinceLine } from '../replay/since-line.tsx';
import { sinceOf } from '../replay/since-line.props.ts';

// What a screen's links to the slider's session need to know of it (W46): its date and the Position Change in it (the first, when several).
export interface SessionLinks {
  readonly date: string;
  readonly changeId?: string;
  // Whether the session holds Journal items.
  readonly hasJournal: boolean;
}

export interface ReplayDrawerProps {
  readonly replay: ReplayView;
  // The links the screen offers under the readout for the slider's session.
  readonly links?: (session: SessionLinks) => ReactNode;
  // The session to open on (a date), from the address (A257); the newest when absent.
  readonly initialSession?: string;
  // Called when the slider moves to another session.
  readonly onSessionChange?: (date: string) => void;
}

// The Replay drawer (W1, W35, P128): the Corridor in its frame, drawn from the replay the Detail already read.
export function ReplayDrawer({ replay, links, initialSession, onSessionChange }: ReplayDrawerProps) {
  const props = useMemo(
    () => replayProps(replay, { Plot: CorridorPlot, ...(initialSession !== undefined && { initialSession }), ...(onSessionChange && { onSessionChange }) }),
    [replay, initialSession, onSessionChange],
  );
  // W47: the chips under the charts, from the estimates the view carries.
  const chips = useMemo(() => chipsOf(replay), [replay]);
  const renderChips = ({ date }: { readonly date: string }) => {
    const found = chips(date);
    return found && <Chips {...found} />;
  };
  // W48: the "since the session before" line, under the charts.
  const since = useMemo(() => sinceOf(replay), [replay]);
  const renderSince = ({ date }: { readonly date: string }) => {
    const found = since(date);
    return found && <SinceLine {...found} />;
  };
  const renderLinks = links
    ? ({ date }: { readonly date: string }) => {
        const session = replay.sessions.find((s) => s.date === date);
        const changeId = session?.markers?.[0]?.id;
        return links({ date, ...(changeId !== undefined && { changeId }), hasJournal: (session?.journal.length ?? 0) > 0 });
      }
    : undefined;
  return <ReplayFrame {...props} renderChips={renderChips} renderSince={renderSince} {...(renderLinks && { renderLinks })} />;
}
