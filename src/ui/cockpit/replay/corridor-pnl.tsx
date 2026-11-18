import { axisMoney, LabelPlacer, pnlRange, tickFits, ticks, timeAxis, valueAxis, type Spot } from './geometry.ts';
import type { LabelledFigure, PlotSession, ReplayPlotProps } from './replay.types.ts';

// Drawn at a phone's real width the chart is no longer shrunk with the screen, so it is shorter, to keep the headline and both charts on one screen.
const HEIGHT_FULL = 210;
const HEIGHT_PHONE = 170;
const TOP = 20;

const TITLE_Y = 12;
const TITLE_SPOT = (left: number): Spot => ({ x: left, y: TITLE_Y, anchor: 'start' });

const f1 =(n: number): string => String(Math.round(n * 10) / 10);

// Runs of consecutive revealed sessions that have a Trade P&L: a session without one ends the run (AC-MARK-004).
function runs(sessions: readonly PlotSession[]): { s: PlotSession; pnl: number }[][] {
  const out: { s: PlotSession; pnl: number }[][] = [];
  let run: { s: PlotSession; pnl: number }[] | null = null;
  for (const s of sessions) {
    if (s.tradePnl === null) {
      run = null;
      continue;
    }
    if (!run) {
      run = [];
      out.push(run);
    }
    run.push({ s, pnl: s.tradePnl });
  }
  return out;
}

// Runs of consecutive revealed sessions with something banked (a realized result), one run for each sign.
function bands(sessions: readonly PlotSession[]): PlotSession[][] {
  const out: PlotSession[][] = [];
  let run: PlotSession[] | null = null;
  for (const s of sessions) {
    if (s.banked === 0 || (run && Math.sign(run[0]!.banked) !== Math.sign(s.banked))) run = null;
    if (s.banked === 0) continue;
    if (!run) {
      run = [];
      out.push(run);
    }
    run.push(s);
  }
  return out;
}

// The Corridor's Trade P&L chart (W40): dollars for the whole Position, break-even between profit and loss.
export function PnlChart({ props, width }: { props: ReplayPlotProps; width: number }) {
  const { sessions, anchors, axis } = props;
  const HEIGHT = props.compact ? HEIGHT_PHONE : HEIGHT_FULL;
  const FLOOR = HEIGHT - 22;
  const time = timeAxis(width, axis.slots);
  const figures = [
    ...sessions.flatMap((s) => [s.tradePnl, s.banked, s.resultAtStop?.value ?? null, s.resultAtTarget?.value ?? null]),
    anchors.planAtStop?.value ?? null,
    anchors.planAtTarget?.value ?? null,
  ].filter((v): v is number => v !== null);
  const [min, max] = pnlRange(figures);
  const value = valueAxis([min, max], TOP, FLOOR);
  const y0 = value.y(0);
  const current = sessions[props.sliderIndex];
  const words = (full: string, short?: string): string => (props.compact ? (short ?? full) : full);

  // A result line: level over each session's column, a vertical step at the left edge of the column where it changes,
  // and a break where a session has no figure. Both lines start in the Plan's column, at the Plan's results (A252).
  const stepPath = (pick: (s: PlotSession) => LabelledFigure | null, plan: LabelledFigure | null): string => {
    let d = plan ? `M${f1(time.x(-1))} ${f1(value.y(plan.value))}` : '';
    let prev: number | null = plan ? plan.value : null;
    for (const s of sessions) {
      const f = pick(s);
      if (!f) {
        prev = null;
        continue;
      }
      const left = time.x(s.slot) - time.column / 2;
      const y = f1(value.y(f.value));
      if (prev === null) d += `M${f1(left)} ${y}`;
      else if (f.value !== prev) d += `H${f1(left)}V${y}`;
      d += `H${f1(time.x(s.slot) + time.column / 2)}`;
      prev = f.value;
    }
    return d;
  };
  // One sub-path per run, so the area breaks where a session has no figure. Between two sessions of opposite sign the
  // edge turns at break-even, where the straight line between them crosses it, so the two fills meet there.
  const areaPath = (side: (p: number, zero: number) => number): string =>
    runs(sessions)
      .map((run) => {
        // A lone session has no neighbour to join: a short block across its own column, never reaching a gap.
        if (run.length === 1) {
          if (side(run[0]!.pnl, 0) === 0) return '';
          const [x, y] = [time.x(run[0]!.s.slot), f1(value.y(side(run[0]!.pnl, 0)))];
          const half = time.column / 4;
          return `M${f1(x - half)} ${f1(y0)}L${f1(x - half)} ${y}L${f1(x + half)} ${y}L${f1(x + half)} ${f1(y0)}Z`;
        }
        const edge = run.map((r, i) => {
          const point = `L${f1(time.x(r.s.slot))} ${f1(value.y(side(r.pnl, 0)))}`;
          const prev = run[i - 1];
          if (!prev || prev.pnl * r.pnl >= 0) return point;
          const xa = time.x(prev.s.slot);
          const cross = xa + ((time.x(r.s.slot) - xa) * prev.pnl) / (prev.pnl - r.pnl);
          return `L${f1(cross)} ${f1(y0)}${point}`;
        });
        return `M${f1(time.x(run[0]!.s.slot))} ${f1(y0)}${edge.join('')}L${f1(time.x(run.at(-1)!.s.slot))} ${f1(y0)}Z`;
      })
      .join('');

  // Labels, placed in priority order: the results, the banked labels and the stake tags first (the results and banked
  // labels are never left out), then the rest, each taking the first free spot or none. The title's space is held.
  const placer = new LabelPlacer(width, HEIGHT);
  const title = words(props.pnlTitle, props.pnlShortTitle);
  placer.reserve(title, TITLE_SPOT(time.left));
  const labels: { key: string; cls: string; text: string; spot: Spot }[] = [];
  const put = (key: string, cls: string, text: string, spots: Spot[], must = false) => {
    const spot = placer.place(text, spots, must);
    if (spot) labels.push({ key, cls, text, spot });
  };
  const xc = current ? time.x(current.slot) : 0;
  const right = xc + time.column / 2;
  if (current) {
    for (const [kind, f] of [
      ['stop', current.resultAtStop],
      ['target', current.resultAtTarget],
    ] as const) {
      if (!f) continue;
      const y = value.y(f.value);
      put(kind, `result-label ${kind}`, words(f.label, f.shortLabel), [
        { x: right + 4, y: y + 3.5, anchor: 'start' },
        { x: xc - time.column / 2 - 4, y: y - 4, anchor: 'end' },
        { x: xc - time.column / 2 - 4, y: y + 12, anchor: 'end' },
        { x: right + 4, y: y - 8, anchor: 'start' },
        { x: right + 4, y: y + 15, anchor: 'start' },
        { x: xc - time.column / 2 - 4, y: y - 16, anchor: 'end' },
        { x: xc - time.column / 2 - 4, y: y + 24, anchor: 'end' },
      ], true);
    }
  }
  // One label for each level a band steps through, that level's own finished text, at its first session. It is placed
  // before the stake tags: it states what is already locked in, so it wins the space when the two compete.
  for (const band of bands(sessions)) {
    band.forEach((s, i) => {
      if (i > 0 && band[i - 1]!.banked === s.banked) return;
      const text = s.bankedLabel;
      if (!text) return;
      const left = time.x(s.slot) - time.column / 2 + 3;
      const y = value.y(s.banked);
      // Six rows, alternating above and below the level (a narrow chart, with its wider axis margin, leaves the nearer ones to the results).
      const rows = s.banked > 0 ? [y - 4, y + 12, y - 20, y + 28, y - 36, y + 44] : [y + 12, y - 4, y + 28, y - 20, y + 44, y - 36];
      // A sale near the last session would run past the edge, so there the label ends at the column instead.
      const runsPast = left + text.length * 6 + 2 > width;
      const rightEdge = time.x(s.slot) + time.column / 2 - 3;
      const anchored: Spot[] = rows.map((dy): Spot => (runsPast ? { x: rightEdge, y: dy, anchor: 'end' } : { x: left, y: dy, anchor: 'start' }));
      // The banked label is never left out; the stake tags, "Break-even" and "Sold 2" labels give way to it.
      put(`banked-${s.slot}`, 'banked-label', text, anchored, true);
    });
  }
  if (current?.stake && current.tradePnl !== null) {
    for (const [kind, end, label, short] of [
      ['risk', current.resultAtStop, current.stake.riskLabel, current.stake.riskShortLabel],
      ['reward', current.resultAtTarget, current.stake.rewardLabel, current.stake.rewardShortLabel],
    ] as const) {
      if (!end || !label) continue;
      const mid = (value.y(current.tradePnl) + value.y(end.value)) / 2 + 3.5;
      put(`stake-${kind}`, `stake-tag ${kind}`, words(label, short), [
        { x: xc - 7, y: mid, anchor: 'end' },
        { x: xc + 7, y: mid, anchor: 'start' },
      ]);
    }
  }
  if (current?.past && current.tradePnl !== null) {
    const y = value.y(current.tradePnl);
    const [first, second] = current.past.line === 'Target' ? [y - 8, y + 16] : [y + 16, y - 8];
    put('past', 'past-label', words(current.past.label, current.past.shortLabel), [
      { x: xc, y: first, anchor: 'middle' },
      { x: xc, y: second, anchor: 'middle' },
    ]);
  }
  for (const s of sessions) {
    const x = time.x(s.slot);
    s.markers
      .filter((m) => !m.isEntry)
      .forEach((m) => {
        const rows = [0, 1, 2].map((r) => TOP + 10 + r * 12);
        put(`marker-${m.id}`, 'marker-label', words(m.label, m.shortLabel), [
          ...rows.map((y): Spot => ({ x: x + 4, y, anchor: 'start' })),
          ...rows.map((y): Spot => ({ x: x - 4, y, anchor: 'end' })),
        ]);
      });
  }
  // A limit is drawn only inside the range the Plan and the revealed sessions set; it never stretches the axis.
  const limits = (
    [
      ['worst-case', current?.worstCase, 12],
      ['max-reward', current?.maxReward, -4],
    ] as const
  ).flatMap(([kind, limit, dy]) => (limit && limit.value >= min && limit.value <= max ? [{ kind, limit, dy }] : []));
  for (const { kind, limit, dy } of limits) {
    put(kind, `${kind}-label`, words(limit.label, limit.shortLabel), [{ x: time.right - 4, y: value.y(limit.value) + dy, anchor: 'end' }]);
  }
  put('break-even', 'break-even-label', 'Break-even', [
    { x: time.left + 4, y: y0 - 4, anchor: 'start' },
    { x: time.left + 4, y: y0 + 12, anchor: 'start' },
  ]);

  return (
    <svg className="pnl-chart" viewBox={`0 0 ${width} ${HEIGHT}`} width={width} height={HEIGHT}>
      <defs>
        {(['stop', 'target'] as const).map((kind) => (
          <pattern key={kind} id={`replay-hatch-${kind}`} className={`hatch-pattern ${kind}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 0V6" />
          </pattern>
        ))}
      </defs>
      {ticks(min, max, 4)
        .filter((v) => v !== 0 && tickFits(axisMoney(v), time.left))
        .map((v) => (
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
      <path className="area profit" d={areaPath(Math.max)} />
      <path className="area loss" d={areaPath(Math.min)} />
      {sessions.map((s) => {
        const line = s.past && (s.past.line === 'Stop' ? s.resultAtStop : s.resultAtTarget);
        if (!s.past || !line || s.tradePnl === null) return null;
        const kind = s.past.line === 'Stop' ? 'stop' : 'target';
        const [a, b] = [value.y(line.value), value.y(s.tradePnl)];
        return (
          <rect key={s.slot} className={`hatch ${kind}`} fill={`url(#replay-hatch-${kind})`} x={f1(time.x(s.slot) - time.column / 2)} y={f1(Math.min(a, b))} width={f1(time.column)} height={f1(Math.abs(a - b))} />
        );
      })}
      {bands(sessions).map((band) => {
        const left = time.x(band[0]!.slot) - time.column / 2;
        const steps = band.map((s) => `V${f1(value.y(s.banked))}H${f1(time.x(s.slot) + time.column / 2)}`).join('');
        return <path key={band[0]!.slot} className={`banked-band ${band[0]!.banked > 0 ? 'gain' : 'loss'}`} d={`M${f1(left)} ${f1(y0)}${steps}V${f1(y0)}Z`} />;
      })}
      {sessions.map((s) =>
        s.markers.some((m) => !m.isEntry) ? <path key={s.slot} className="marker-line" d={`M${f1(time.x(s.slot))} ${TOP}V${FLOOR}`} /> : null,
      )}
      {(['stop', 'target'] as const).map((kind) => (
        <path
          key={kind}
          className={`result-line ${kind}`}
          d={stepPath((s) => (kind === 'stop' ? s.resultAtStop : s.resultAtTarget), kind === 'stop' ? anchors.planAtStop : anchors.planAtTarget)}
        />
      ))}
      {limits.map(({ kind, limit }) => (
        <path key={kind} className={kind} d={`M${time.left} ${f1(value.y(limit.value))}H${time.right}`} />
      ))}
      <path className="break-even" d={`M${time.left} ${f1(y0)}H${time.right}`} />
      {current && <path className="cursor" d={`M${f1(xc)} ${TOP}V${FLOOR}`} />}
      {current?.stake && current.tradePnl !== null && (
        <g className="stake">
          {(
            [
              ['risk', current.resultAtStop],
              ['reward', current.resultAtTarget],
            ] as const
          ).map(([kind, end]) => {
            const label = kind === 'risk' ? current.stake?.riskLabel : current.stake?.rewardLabel;
            return end && label ? <path key={kind} className={`stake-beam ${kind}`} d={`M${f1(xc)} ${f1(value.y(current.tradePnl!))}V${f1(value.y(end.value))}`} /> : null;
          })}
        </g>
      )}
      {sessions.map((s) =>
        s.tradePnl === null ? null : (
          <circle key={s.slot} className={s === current ? 'pnl-dot current' : 'pnl-dot'} cx={f1(time.x(s.slot))} cy={f1(value.y(s.tradePnl))} r={s === current ? 5 : 3} />
        ),
      )}
      <text className="plot-title" x={time.left} y={TITLE_Y}>
        {title}
      </text>
      <text className="axis-end" x={time.right} y={HEIGHT - 4} textAnchor="end">
        {axis.endLabel}
      </text>
      {labels.map((l) => (
        <text key={l.key} className={l.cls} x={f1(l.spot.x)} y={f1(l.spot.y)} textAnchor={l.spot.anchor}>
          {l.text}
        </text>
      ))}
    </svg>
  );
}
