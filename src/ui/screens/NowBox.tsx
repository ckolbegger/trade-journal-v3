import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { DailyTradeReview, MeterReading } from '../../app/types.ts';
import { Meter } from '../cockpit/meter/meter.tsx';
import type { MeterProps } from '../cockpit/meter/meter.types.ts';
import { useRuntime } from '../runtime.tsx';
import { captionLength, type CaptionLength } from './caption-fit.ts';
import { Figures } from './Figures.tsx';
import { nowBoxOf, type Caption } from './now-box.props.ts';

export interface NowBoxProps {
  readonly trade: DailyTradeReview;
  // The Trade's reading on the Review Date, from the walk (the card's own read carries none); the dated close brings its own.
  readonly meter: MeterReading | undefined;
}

// Where the shared meter put its marks, as it wrote them (a left offset in percent). The labels and arrows stand at the same places, so the
// drawing never works out a position of its own: it reads the meter's.
interface Places {
  readonly stop?: string;
  readonly target?: string;
  readonly now?: string;
}

const placeOf = (root: HTMLElement, testId: string): string | undefined => root.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.style.left || undefined;

// The key (W91), in the order of the drawing's marks: a swatch of each and its word.
const KEY = ['Realized', 'open', 'past the line', 'session before', 'now', 'Stop', 'Target'] as const;

// Which row each arrow takes: one row inside the lines; past a line both arrows run the same way, so they take two, the short one on top (W86).
const rowsOf = (zone: 'Within' | 'PastStop' | 'PastTarget'): Record<'stop' | 'target', 1 | 2> => ({ stop: zone === 'PastTarget' ? 2 : 1, target: zone === 'PastStop' ? 2 : 1 });

const number = (place: string | undefined): number | undefined => (place === undefined ? undefined : Number.parseFloat(place));

function Drawing({ meter, captions }: { readonly meter: MeterProps; readonly captions: readonly Caption[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<Places>({});
  useLayoutEffect(() => {
    if (!root.current) return;
    const next = { stop: placeOf(root.current, 'meter-stop'), target: placeOf(root.current, 'meter-target'), now: placeOf(root.current, 'meter-pointer') };
    setAt((was) => (was.stop === next.stop && was.target === next.target && was.now === next.now ? was : next));
  }, [meter]);
  const stopText = `Stop ${meter.stop.text}`;
  const targetText = `Target ${meter.target.text}`;
  // Two lines close on the meter's scale (both on one side of $0) would put their labels on top of each other: the Target's takes a second row then.
  const [stacked, setStacked] = useState(false);
  useLayoutEffect(() => {
    const drawing = root.current;
    if (!drawing) return;
    const apart = () => {
      const stop = drawing.querySelector('.now-label[data-line="stop"]')?.getBoundingClientRect();
      const target = drawing.querySelector('.now-label[data-line="target"]')?.getBoundingClientRect();
      if (stop && target) setStacked(stop.left < target.right && target.left < stop.right);
    };
    apart();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(apart);
    watch.observe(drawing);
    return () => watch.disconnect();
  }, [at, stopText, targetText]);
  // The captions' length (P170): the longest at which they fit side by side in the room the box has, measured in hidden copies of every form.
  const legs = useRef<HTMLDivElement>(null);
  const [length, setLength] = useState<CaptionLength>(0);
  const forms = captions.map((caption) => caption.forms.join('|')).join('/');
  useLayoutEffect(() => {
    const row = legs.current;
    if (!row) return;
    const choose = () => {
      const widthOf = (line: string, at: number) => root.current?.querySelector(`[data-measure][data-line="${line}"][data-length="${at}"]`)?.getBoundingClientRect().width ?? 0;
      // Only the lines that have a caption were rendered for measuring.
      const widths = (['Stop', 'Target'] as const).flatMap((line) => (root.current?.querySelector(`[data-measure][data-line="${line}"]`) ? [[0, 1, 2].map((at) => widthOf(line, at)) as [number, number, number]] : []));
      setLength(captionLength(widths, row.getBoundingClientRect().width, Number.parseFloat(getComputedStyle(row).columnGap) || 0));
    };
    choose();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(choose);
    watch.observe(row);
    return () => watch.disconnect();
  }, [forms]);
  // A label stands over its mark, shifted by its own share of its width so the one at either end stays inside the bar.
  const label = (line: 'stop' | 'target', text: string, place: string | undefined) =>
    place && (
      <span className="now-label" data-line={line} data-row={stacked && line === 'target' ? 2 : 1} data-tone={line === 'stop' ? 'loss' : 'profit'} style={{ left: place, transform: `translateX(-${place})` }}>
        {text}
      </span>
    );
  // From now to each line: a shaft from one place to the other and its head at the line, in the line's tone. Nothing is drawn with no Mark.
  const nowAt = number(at.now);
  const rows = meter.now.kind === 'Value' ? rowsOf(meter.now.zone) : undefined;
  const arrowTo = (line: 'stop' | 'target', place: string | undefined) => {
    const to = number(place);
    if (rows === undefined || nowAt === undefined || to === undefined || to === nowAt) return null;
    return (
      <span
        key={line}
        className="now-arrow"
        data-arrow={line}
        data-tone={line === 'stop' ? 'loss' : 'profit'}
        data-direction={to > nowAt ? 'right' : 'left'}
        data-row={rows[line]}
        style={{ left: `${Math.min(nowAt, to)}%`, width: `${Math.abs(to - nowAt)}%` }}
      />
    );
  };
  const arrows = (
    <div className="now-arrows" aria-hidden="true">
      {arrowTo('stop', at.stop)}
      {arrowTo('target', at.target)}
    </div>
  );
  return (
    <div className="now-draw" data-testid="now-drawing" ref={root}>
      <div className="now-labels">
        {label('stop', stopText, at.stop)}
        {label('target', targetText, at.target)}
      </div>
      <Meter {...meter} />
      {arrows}
      <div className="now-legs" ref={legs}>
        {captions.map((caption) => (
          <span key={caption.line} className="now-caption" role="note" aria-label={caption.text} title={caption.text} data-caption={caption.line.toLowerCase()} data-tone={caption.tone} data-past={caption.past || undefined}>
            {caption.past && length < 2 ? <b>{caption.forms[length]}</b> : caption.forms[length]}
          </span>
        ))}
      </div>
      <span className="now-measure" aria-hidden="true">
        {captions.flatMap((caption) =>
          caption.forms.map((form, at) => (
            <span key={`${caption.line}${at}`} data-measure data-line={caption.line} data-length={at}>
              {caption.past && at < 2 ? <b>{form}</b> : form}
            </span>
          )),
        )}
      </span>
    </div>
  );
}

// The open card's "Now" box (U3): the session's Marks, the drawing with its arrows, then only the figures the card's header and the drawing do not give.
export function NowBox({ trade, meter }: NowBoxProps) {
  const uid = useId();
  const { timeZone } = useRuntime();
  const props = nowBoxOf(trade, meter, timeZone);
  if (!props) return null;
  return (
    <section className="now-box" aria-labelledby={`${uid}-now`}>
      <h4 id={`${uid}-now`}>{props.heading}</h4>
      {props.marks.length > 0 && (
        <p className="now-marks">
          {props.marks.map((mark, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              {mark.label} <b className="number">{mark.price}</b>
              {mark.change && (
                <>
                  {' '}
                  <small className="number">
                    <Figures text={mark.change} />
                  </small>
                </>
              )}
            </span>
          ))}
        </p>
      )}
      {props.meter && <Drawing meter={props.meter} captions={props.captions} />}
      <dl className="now-rows">
        {props.rows.map((row) => (
          <div key={row.label} data-weight={row.weight}>
            <dt title={row.term}>{row.label}</dt>
            <dd className="number">
              <Figures text={row.value} />
            </dd>
          </div>
        ))}
      </dl>
      <ul className="now-key">
        {KEY.map((word) => (
          <li key={word} data-mark={word.replaceAll(' ', '-')}>
            {word}
          </li>
        ))}
      </ul>
      {props.more && (
        <details className="now-more">
          <summary>More figures</summary>
          <p>{props.more}</p>
        </details>
      )}
    </section>
  );
}
