import { axisMoney, LabelPlacer, priceRange, ticks, timeAxis, valueAxis, type Spot } from './geometry.ts';
import type { ReplayPlotProps } from './replay.types.ts';

const HEIGHT = 136;
const TOP = 18;
const FLOOR = HEIGHT - 20;

const f1 = (n: number): string => String(Math.round(n * 10) / 10);

// The Corridor's price strip (W39): one Mark per revealed session, joined in order, the line broken at a gap.
export function PriceStrip({ props, width }: { props: ReplayPlotProps; width: number }) {
  const { sessions, anchors, axis } = props;
  const time = timeAxis(width, axis.slots);
  const anchorPrices = [...(anchors.entryPrice === undefined ? [] : [anchors.entryPrice]), ...anchors.priceLines.map((l) => l.price)];
  const marks = sessions.flatMap((s) => (s.underlyingMark === null ? [] : [s.underlyingMark]));
  const [min, max] = priceRange(anchorPrices, marks);
  const value = valueAxis([min, max], TOP, FLOOR);

  const current = sessions[props.sliderIndex];
  const drawn = sessions.flatMap((s) =>
    s.underlyingMark === null ? [] : [{ x: time.x(s.slot), y: value.y(s.underlyingMark), current: s === current }],
  );
  let d = '';
  let open = false;
  for (const s of sessions) {
    if (s.underlyingMark === null) {
      open = false;
      continue;
    }
    d += `${open ? 'L' : 'M'}${f1(time.x(s.slot))} ${f1(value.y(s.underlyingMark))}`;
    open = true;
  }

  // Labels take a free spot or are left out; the slider's Mark is the result and is placed first, never left out.
  const placer = new LabelPlacer(width, HEIGHT);
  const title = props.compact ? (props.priceShortTitle ?? props.priceTitle) : props.priceTitle;
  placer.reserve(title, { x: time.left, y: 12, anchor: 'start' });
  const markSpot =
    current && current.underlyingMark !== null && current.underlyingLabel
      ? placer.place(
          current.underlyingLabel,
          [
            { x: time.x(current.slot), y: value.y(current.underlyingMark) - 9, anchor: 'middle' },
            { x: time.x(current.slot), y: value.y(current.underlyingMark) + 17, anchor: 'middle' },
            { x: time.x(current.slot) + 9, y: value.y(current.underlyingMark) + 3.5, anchor: 'start' },
            { x: time.x(current.slot) - 9, y: value.y(current.underlyingMark) + 3.5, anchor: 'end' },
          ],
          true,
        )
      : null;
  const lineLabels = anchors.priceLines.flatMap((l, i) => {
    const y = value.y(l.price);
    const spots: Spot[] = [-4, 12].map((dy) => ({ x: time.left + 4, y: y + dy, anchor: 'start' }));
    const spot = placer.place(l.label, l.kind === 'Stop' ? spots.reverse() : spots);
    return spot ? [{ key: `${l.kind}-${i}`, kind: l.kind.toLowerCase(), text: l.label, y: spot.y }] : [];
  });

  return (
    <svg className="price-strip" viewBox={`0 0 ${width} ${HEIGHT}`} width={width} height={HEIGHT}>
      {ticks(min, max, 3).map((v) => (
        <g key={v}>
          <path className="grid" d={`M${time.left} ${f1(value.y(v))}H${time.right}`} />
          <text x={time.left - 5} y={f1(value.y(v) + 3.5)} textAnchor="end">
            {axisMoney(v)}
          </text>
        </g>
      ))}
      {sessions[props.hoverIndex ?? -1] && (
        <rect className="hover-column" x={f1(time.x(sessions[props.hoverIndex!]!.slot) - time.column / 2)} y={TOP} width={f1(time.column)} height={FLOOR - TOP} />
      )}
      {sessions
        .filter((s) => s.underlyingMark === null)
        .map((s) => (
          <g key={s.slot}>
            <rect className="no-mark" x={f1(time.x(s.slot) - time.column / 2)} y={TOP} width={f1(time.column)} height={FLOOR - TOP} />
            <text className="no-mark-label" transform={`translate(${f1(time.x(s.slot) + 3.5)} ${FLOOR - 4}) rotate(-90)`}>
              No Mark
            </text>
          </g>
        ))}
      {anchors.priceLines.map((l, i) => (
        <path key={`${l.kind}-${i}`} className={`price-line ${l.kind.toLowerCase()}`} data-kind={l.kind} d={`M${time.left} ${f1(value.y(l.price))}H${time.right}`} />
      ))}
      {lineLabels.map((l) => (
        <text key={l.key} className={`price-line-label ${l.kind}`} x={time.left + 4} y={f1(l.y)}>
          {l.text}
        </text>
      ))}
      <text className="plot-title" x={time.left} y={12}>
        {title}
      </text>
      {sessions
        .filter((s) => s.markers.some((m) => !m.isEntry))
        .map((s) => (
          <path key={s.slot} className="marker-line" d={`M${f1(time.x(s.slot))} ${TOP}V${FLOOR}`} />
        ))}
      <path className="mark-line" d={d} />
      {drawn.map((p) => (
        <circle key={p.x} className={p.current ? 'mark current' : 'mark'} cx={f1(p.x)} cy={f1(p.y)} r={p.current ? 5 : 3} />
      ))}
      {current && (
        <g>
          <path className="cursor" d={`M${f1(time.x(current.slot))} ${TOP}V${FLOOR}`} />
          {markSpot && current.underlyingLabel && (
            <text className="mark-label" x={f1(markSpot.x)} y={f1(markSpot.y)} textAnchor={markSpot.anchor}>
              {current.underlyingLabel}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
