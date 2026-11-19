import { axisMoney, type DrawnChart, LabelPlacer, pnlRange, signedAxisMoney, tickFits, ticks, timeAxis, valueAxis, type Spot } from './geometry.ts';
import type { LabelledFigure, PlotKeyEntry, PlotSession, ReplayPlotProps } from './replay.types.ts';

// A phone's chart is at least 200 high: its labels are in the strip under it, so the drawing keeps its room.
const HEIGHT_FULL = 210;
const HEIGHT_PHONE = 200;
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
  return drawPnl(props, width).svg;
}

// The chart and what it drew, so the key names only what is on the page.
export function drawPnl(props: ReplayPlotProps, width: number): DrawnChart {
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
        // A lone session has no neighbour to join: a short block across its own column, except that beside a session
        // with no Mark it runs to the edge of that column (P146), as a run of several sessions does.
        if (run.length === 1) {
          if (side(run[0]!.pnl, 0) === 0) return '';
          const [x, y] = [time.x(run[0]!.s.slot), f1(value.y(side(run[0]!.pnl, 0)))];
          const at = sessions.indexOf(run[0]!.s);
          const before = sessions[at - 1]?.tradePnl === null ? time.column / 2 : time.column / 4;
          const after = sessions[at + 1]?.tradePnl === null ? time.column / 2 : time.column / 4;
          return `M${f1(x - before)} ${f1(y0)}L${f1(x - before)} ${y}L${f1(x + after)} ${y}L${f1(x + after)} ${f1(y0)}Z`;
        }
        const edge = run.map((r, i) => {
          const point = `L${f1(time.x(r.s.slot))} ${f1(value.y(side(r.pnl, 0)))}`;
          const prev = run[i - 1];
          if (!prev || prev.pnl * r.pnl >= 0) return point;
          const xa = time.x(prev.s.slot);
          const cross = xa + ((time.x(r.s.slot) - xa) * prev.pnl) / (prev.pnl - r.pnl);
          return `L${f1(cross)} ${f1(y0)}${point}`;
        });
        // Beside a session with no Mark (P146) the area runs to the edge of that column and ends upright there, joining nothing across it.
        const first = run[0]!;
        const last = run.at(-1)!;
        const gapBefore = sessions[sessions.indexOf(first.s) - 1]?.tradePnl === null;
        const gapAfter = sessions[sessions.indexOf(last.s) + 1]?.tradePnl === null;
        const xStart = time.x(first.s.slot) - (gapBefore ? time.column / 2 : 0);
        const xEnd = time.x(last.s.slot) + (gapAfter ? time.column / 2 : 0);
        const lead = gapBefore ? `L${f1(xStart)} ${f1(value.y(side(first.pnl, 0)))}` : '';
        const trail = gapAfter ? `L${f1(xEnd)} ${f1(value.y(side(last.pnl, 0)))}` : '';
        return `M${f1(xStart)} ${f1(y0)}${lead}${edge.join('')}${trail}L${f1(xEnd)} ${f1(y0)}Z`;
      })
      .join('');

  // Labels, placed in priority order: the results, the banked labels and the stake tags first (the results and banked
  // labels are never left out), then the rest, each taking the first free spot or none. The title's space is held.
  const placer = new LabelPlacer(width, HEIGHT);
  const title = props.pnlTitle;
  placer.reserve(title, TITLE_SPOT(time.left));
  const labels: { key: string; cls: string; text: string; spot: Spot }[] = [];
  // On a phone (A280) no label is drawn on a line: each goes to the strip under the drawing, whether or not the wide drawing had room
  // for it. The labels of a level (a result, banked, a limit) are listed from the lowest figure up, the rest after them in the order placed.
  const stripped: { text: string; level?: number }[] = [];
  const kept = new Set<string>();
  const put = (key: string, cls: string, text: string, spots: Spot[], must = false, level?: number) => {
    if (props.compact) {
      kept.add(key);
      // The key names Break-even (A280): it is no label for the strip.
      if (key !== 'break-even') stripped.push({ text, ...(level !== undefined && { level }) });
      return;
    }
    const spot = placer.place(text, spots, must);
    if (spot) {
      kept.add(key);
      labels.push({ key, cls, text, spot });
    }
  };
  const xc = current ? time.x(current.slot) : 0;
  // A phone's drawing keeps the slider's value beside its dot, above it or below.
  if (props.compact && current && current.tradePnl !== null) {
    const y = value.y(current.tradePnl);
    const spot = placer.place(signedAxisMoney(current.tradePnl), [
      { x: xc, y: y - 9, anchor: 'middle' },
      { x: xc, y: y + 17, anchor: 'middle' },
      // Near an edge, where the centred spots run past it, the value ends at the cursor or starts at it, on the side with room.
      { x: xc + 6, y: y - 9, anchor: 'start' },
      { x: xc - 6, y: y - 9, anchor: 'end' },
      { x: xc + 6, y: y + 17, anchor: 'start' },
      { x: xc - 6, y: y + 17, anchor: 'end' },
    ], true);
    if (spot) labels.push({ key: 'slider-value', cls: 'slider-value', text: signedAxisMoney(current.tradePnl), spot });
  }
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
      ], true, f.value);
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
      put(`banked-${s.slot}`, 'banked-label', text, anchored, true, s.banked);
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
  // A first crossing (A271, W64): a flag at the session, on the line it crossed (the Trade P&L where that line has no figure); the plot is
  // given every revealed session, so the flag stays on later ones. It is drawn only with its label, or in the phone's strip.
  const flags = sessions.flatMap((s) =>
    (s.firstCrossing ?? []).flatMap((crossing) => {
      const at = (crossing.line === 'Stop' ? s.resultAtStop : s.resultAtTarget)?.value;
      const level = at ?? s.tradePnl;
      const x = time.x(s.slot);
      // A session with no figure to stand on (no Mark column) keeps the flag, at the top of the plot; nothing is joined across it (P146).
      const y = level === null ? TOP + 18 : value.y(level);
      const top = Math.max(TOP, y - 18);
      const key = `crossing-${s.slot}-${crossing.line}`;
      put(key, `crossing-label ${crossing.line.toLowerCase()}`, words(crossing.label, crossing.shortLabel), [
        { x: x + 6, y: top + 8, anchor: 'start' },
        { x: x - 6, y: top + 8, anchor: 'end' },
        { x: x + 6, y: top + 20, anchor: 'start' },
        { x: x - 6, y: top + 20, anchor: 'end' },
      ]);
      return kept.has(key) ? [{ key, line: crossing.line.toLowerCase(), label: crossing.label, x, y, top }] : [];
    }),
  );
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
  // The cursor's column is held free (A280): the two limit labels, placed from here on, take no spot over it.
  if (current) placer.reserveColumn(xc - time.column / 2, xc + time.column / 2);
  // A Worst case below the range is tagged at the bottom edge, clear of the cursor's column; the axis is not stretched to it (A256).
  const tag = current?.worstCaseTag;
  if (tag && current.worstCase && current.worstCase.value < min) {
    put('worst-case-tag', `worst-case-tag ${tag.weight.toLowerCase()}`, tag.label, [
      { x: time.right - 4, y: FLOOR - 4, anchor: 'end' },
      { x: time.left + 4, y: FLOOR - 4, anchor: 'start' },
    ]);
  }
  for (const { kind, limit, dy } of limits) {
    // The right end, or the left end when the cursor is at the right.
    put(kind, `${kind}-label`, words(limit.label, limit.shortLabel), [
      { x: time.right - 4, y: value.y(limit.value) + dy, anchor: 'end' },
      { x: time.left + 4, y: value.y(limit.value) + dy, anchor: 'start' },
    ], false, limit.value);
  }
  // The line itself steps with each revealed session's own figure; a session without one, or outside the range, leaves a break.
  const limitPath = (pick: (s: PlotSession) => LabelledFigure | null): string =>
    stepPath((s) => {
      const f = pick(s);
      return f && f.value >= min && f.value <= max ? f : null;
    }, null);
  put('break-even', 'break-even-label', 'Break-even', [
    { x: time.left + 4, y: y0 - 4, anchor: 'start' },
    { x: time.left + 4, y: y0 + 12, anchor: 'start' },
    { x: time.right - 4, y: y0 - 4, anchor: 'end' },
    { x: time.right - 4, y: y0 + 12, anchor: 'end' },
  ]);

  // The time axis's words, one row under the chart: the first date at the left, the end (an option's expiration) at the right, and the
  // slider's session under the cursor. An edge label the cursor's name would cover is left out.
  const span = (text: string, x: number, anchor: 'start' | 'middle' | 'end') => {
    const w = text.length * 6 + 2;
    let x0: number;
    if (anchor === 'start') x0 = x;
    else if (anchor === 'end') x0 = x - w;
    else x0 = x - w / 2;
    return { x0, x1: x0 + w };
  };
  // The first session's own date is the start label already, so it is not named twice.
  const cursorText = current && (props.cursorLabel ?? current.dateLabel) !== axis.startLabel ? (props.cursorLabel ?? current.dateLabel) : undefined;
  const half = cursorText ? (cursorText.length * 6 + 2) / 2 : 0;
  // Both edge labels always stay (the first date and the expiry are different facts); the cursor's name steps right of the first date and
  // left of the end label instead. On a chart too narrow for all three it is left out, and the two edge labels still do not overlap it.
  const startRight = axis.startLabel ? span(axis.startLabel, time.left, 'start').x1 + 4 : 0;
  // The end label's finished forms arrive longest first (P137); the first that clears the first date is drawn as it is. When none clears,
  // none is drawn: a label that overlaps is worse than a missing one (A280).
  const endText = axis.endLabels?.find((t) => span(t, time.right, 'end').x0 >= startRight);
  const endLeft = endText ? span(endText, time.right, 'end').x0 - 4 : width;
  const lowest = Math.max(half, startRight + half);
  const highest = Math.min(width - half, endLeft - half);
  const cursorX = Math.min(Math.max(xc, lowest), highest);
  const cursorFits = cursorText !== undefined && lowest <= highest;
  const axisText: { cls: string; text: string; x: number; anchor: 'start' | 'middle' | 'end' }[] = [
    ...(axis.startLabel ? [{ cls: 'axis-start', text: axis.startLabel, x: time.left, anchor: 'start' as const }] : []),
    ...(endText ? [{ cls: 'axis-end', text: endText, x: time.right, anchor: 'end' as const }] : []),
  ];
  if (cursorText && cursorFits) axisText.push({ cls: 'cursor-label', text: cursorText, x: cursorX, anchor: 'middle' });
  // A line is drawn only with its label (A280): one whose label found no room is not drawn at all.
  const limitLines = (
    [
      ['worst-case', 'WorstCase', (s: PlotSession) => s.worstCase],
      ['max-reward', 'MaxReward', (s: PlotSession) => s.maxReward],
    ] as const
  ).flatMap(([css, keyKind, pick]) => {
    const d = limitPath(pick);
    return d && kept.has(css) ? [{ css, keyKind, d }] : [];
  });
  const drawn = new Set<PlotKeyEntry['kind']>([...limitLines.map((l) => l.keyKind), ...(flags.length > 0 ? ['FirstCrossing' as const] : [])]);
  const svg = (
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
      {sessions
        .filter((s) => s.tradePnl === null)
        .map((s) => (
          <g key={s.slot}>
            <rect className="no-mark" x={f1(time.x(s.slot) - time.column / 2)} y={TOP} width={f1(time.column)} height={FLOOR - TOP} />
            <text className="no-mark-label" transform={`translate(${f1(time.x(s.slot) + 3.5)} ${FLOOR - 4}) rotate(-90)`}>
              No Mark
            </text>
          </g>
        ))}
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
      {limitLines.map((l) => (
        <path key={l.css} className={l.css} d={l.d} />
      ))}
      <path className="break-even" d={`M${time.left} ${f1(y0)}H${time.right}`} />
      {flags.map((f) => (
        <g key={f.key} className={`first-crossing ${f.line}`}>
          <path className="flag-pole" d={`M${f1(f.x)} ${f1(f.y)}V${f1(f.top)}`} />
          <path className="flag-pennant" d={`M${f1(f.x)} ${f1(f.top)}h6l-3 4l3 4h-6Z`} />
        </g>
      ))}
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
      {axisText.map((t) => (
        <text key={t.cls} className={t.cls} x={f1(t.x)} y={HEIGHT - 4} textAnchor={t.anchor}>
          {t.text}
        </text>
      ))}
      {labels.map((l) => (
        <text key={l.key} className={l.cls} x={f1(l.spot.x)} y={f1(l.spot.y)} textAnchor={l.spot.anchor}>
          {l.text}
        </text>
      ))}
    </svg>
  );
  const levels = stripped.filter((l) => l.level !== undefined).sort((a, b) => a.level! - b.level!);
  return { svg, drawn, crossingLabels: new Set(flags.map((f) => f.label)), strip: [...levels, ...stripped.filter((l) => l.level === undefined)].map((l) => l.text) };
}
