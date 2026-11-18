import { useMemo, type ReactNode } from 'react';
import { CorridorPlot } from '../replay/corridor.tsx';
import { ReplayFrame } from '../replay/frame.tsx';
import { replayProps, type ReplayView } from '../replay/replay.props.ts';

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
  const renderLinks = links
    ? ({ date }: { readonly date: string }) => {
        const session = replay.sessions.find((s) => s.date === date);
        const changeId = session?.markers?.[0]?.id;
        return links({ date, ...(changeId !== undefined && { changeId }), hasJournal: (session?.journal.length ?? 0) > 0 });
      }
    : undefined;
  return <ReplayFrame {...props} {...(renderLinks && { renderLinks })} />;
}
