import { useMemo } from 'react';
import { CorridorPlot } from '../replay/corridor.tsx';
import { ReplayFrame } from '../replay/frame.tsx';
import { replayProps, type ReplayView } from '../replay/replay.props.ts';

export interface ReplayDrawerProps {
  readonly replay: ReplayView;
  // The session to open on (a date), from the address (A257); the newest when absent.
  readonly initialSession?: string;
  // Called when the slider moves to another session.
  readonly onSessionChange?: (date: string) => void;
}

// The Replay drawer (W1, W35, P128): the Corridor in its frame, drawn from the replay the Detail already read.
export function ReplayDrawer({ replay, initialSession, onSessionChange }: ReplayDrawerProps) {
  const props = useMemo(
    () => replayProps(replay, { Plot: CorridorPlot, ...(initialSession !== undefined && { initialSession }), ...(onSessionChange && { onSessionChange }) }),
    [replay, initialSession, onSessionChange],
  );
  return <ReplayFrame {...props} />;
}
