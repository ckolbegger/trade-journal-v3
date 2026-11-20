import type { MeterProps } from './meter.types.ts';

// A215: the track runs from the Trade's result at the Stop to its result at the Target and always holds break-even (0).
// Turning a finished figure into a position on it is drawing, not calculating.
function trackOf(props: MeterProps): (value: number) => number {
  const lo0 = Math.min(0, props.stop.value, props.target.value);
  const hi0 = Math.max(0, props.stop.value, props.target.value);
  // A result past a line stretches the track that way, by a third of its length at most; the pointer rests at the end beyond that.
  const room = (hi0 - lo0) / 3;
  const now = props.now.kind === 'Value' ? props.now : undefined;
  const lo = now?.zone === 'PastStop' ? Math.max(Math.min(lo0, now.value), lo0 - room) : lo0;
  const hi = now?.zone === 'PastTarget' ? Math.min(Math.max(hi0, now.value), hi0 + room) : hi0;
  const at = (value: number) => Math.max(0, Math.min(1, (value - lo) / (hi - lo))) * 100;
  return at;
}

const percent = (position: number) => `${position.toFixed(2)}%`;

// A bar between two figures, from the left one.
function between(at: (value: number) => number, a: number, b: number): { left: string; width: string } {
  const from = at(Math.min(a, b));
  return { left: percent(from), width: percent(at(Math.max(a, b)) - from) };
}

const DIRECTION_WORDS = { Up: 'Up from', Down: 'Down from', Level: 'Level with' } as const;

// W51: the meter's name, which is also its hover text. It joins finished figures and words; the share and the amount past a line come in finished.
function nameOf(props: MeterProps): string {
  const { now, previous } = props;
  const sentences: string[] = [];
  if (now.kind === 'Unavailable') sentences.push(now.reason);
  else if (now.zone === 'PastStop') sentences.push(`P&L ${now.text}, past the Stop by ${now.pastBy}.`);
  else if (now.zone === 'PastTarget') sentences.push(`P&L ${now.text}, past the Target by ${now.pastBy}.`);
  else sentences.push(now.share ? `P&L ${now.text}, ${now.share.percent} of the way to the ${now.share.toward}.` : `P&L ${now.text}.`);
  if (props.banked && props.banked.value !== 0) sentences.push(`Realized ${props.banked.text}.`);
  sentences.push(`Stop ${props.stop.text}, Target ${props.target.text}.`);
  if (previous) {
    const lead = now.kind === 'Unavailable' ? 'Session before' : DIRECTION_WORDS[previous.direction];
    sentences.push(`${lead} ${previous.text} on ${previous.dateLabel}.`);
  }
  return sentences.join(' ');
}

export function Meter(props: MeterProps) {
  const name = nameOf(props);
  const at = trackOf(props);
  const now = props.now.kind === 'Value' ? props.now : undefined;
  return (
    <span className="meter" role="img" aria-label={name} title={name} data-size={props.size} data-state={now ? 'filled' : 'empty'}>
      <span className="m-in">
        <span className="m-track" data-testid="meter-track" />
        {now && now.value !== 0 && (
          <span className={`m-open ${now.value > 0 ? 'up' : 'dn'}`} data-testid="meter-open" data-tone={now.value > 0 ? 'profit' : 'loss'} data-fill="outline" style={between(at, 0, now.value)} />
        )}
        {now && props.banked && props.banked.value !== 0 && (
          <span className={`m-bank ${props.banked.value > 0 ? 'up' : 'dn'}`} data-testid="meter-banked" data-tone={props.banked.value > 0 ? 'profit' : 'loss'} data-fill="solid" style={between(at, 0, props.banked.value)} />
        )}
        {now && now.zone !== 'Within' && (
          <span
            className={`m-over ${now.zone === 'PastStop' ? 's' : 't'}`}
            data-testid="meter-past"
            data-tone={now.zone === 'PastStop' ? 'loss' : 'profit'}
            style={between(at, now.value, now.zone === 'PastStop' ? props.stop.value : props.target.value)}
          />
        )}
        {props.previous && <span className="m-prev" data-testid="meter-previous" style={{ left: percent(at(props.previous.value)) }} />}
        <span className="m-stop" data-testid="meter-stop" style={{ left: percent(at(props.stop.value)) }} />
        <span className="m-target" data-testid="meter-target" style={{ left: percent(at(props.target.value)) }} />
        <span className="m-even" data-testid="meter-even" style={{ left: percent(at(0)) }} />
        {now && <span className="m-now" data-testid="meter-pointer" data-shape={now.zone === 'Within' ? 'round' : 'square'} style={{ left: percent(at(now.value)) }} />}
      </span>
    </span>
  );
}
