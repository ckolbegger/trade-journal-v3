import { axisMoney, priceRange, ticks, timeAxis, valueAxis } from './geometry.ts';
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
      {anchors.priceLines.map((l) => {
        const y = value.y(l.price);
        return (
          <g key={l.kind}>
            <path className={`price-line ${l.kind.toLowerCase()}`} data-kind={l.kind} d={`M${time.left} ${f1(y)}H${time.right}`} />
            <text className={`price-line-label ${l.kind.toLowerCase()}`} x={time.left + 4} y={f1(y + (l.kind === 'Stop' ? 12 : -4))}>
              {l.label}
            </text>
          </g>
        );
      })}
      <text className="plot-title" x={time.left} y={12}>
        {props.compact ? (props.priceShortTitle ?? props.priceTitle) : props.priceTitle}
      </text>
      <text className="axis-end" x={time.right} y={HEIGHT - 2} textAnchor="end">
        {axis.endLabel}
      </text>
      <path className="mark-line" d={d} />
      {drawn.map((p) => (
        <circle key={p.x} className={p.current ? 'mark current' : 'mark'} cx={f1(p.x)} cy={f1(p.y)} r={p.current ? 5 : 3} />
      ))}
      {current && (
        <g>
          <path className="cursor" d={`M${f1(time.x(current.slot))} ${TOP}V${FLOOR}`} />
          {current.underlyingMark !== null && current.underlyingLabel && (
            <text className="mark-label" x={f1(time.x(current.slot))} y={f1(value.y(current.underlyingMark) - 9)} textAnchor="middle">
              {current.underlyingLabel}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
