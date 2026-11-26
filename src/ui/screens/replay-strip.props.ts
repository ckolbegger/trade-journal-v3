import type { ReplayStripFigures, TradeReplayView } from '../../app/types.ts';
import { pnlRange, timeAxis, valueAxis } from '../cockpit/replay/geometry.ts';
import { signed } from '../figures.ts';
import { money, plural, shortDate } from '../format.ts';
import type { Rational } from '../../domain/values/index.ts';

// The Replay strip's words (W146): one line from the figures the coordinator counted. Nothing is worked out here.
const signedMoney = signed(money);


// Whether the Trade is past a line now: the strip is shown more strongly.
export const pastLine = (strip: ReplayStripFigures | undefined): boolean => Boolean(strip?.stop?.since || strip?.target?.since);

export function stripWords(strip: ReplayStripFigures, closed = false): string {
  const { stop, target } = strip;
  if (closed) return `${plural(strip.sessions, 'session', 'sessions')}${strip.low ? ` · low ${signedMoney(strip.low.value)} on ${shortDate(strip.low.date)}` : ''}. Walk it before you write.`;
  if (stop?.since) return `Past the Stop since ${shortDate(stop.since)}${stop.sessions === undefined ? '' : ` · ${plural(stop.sessions, 'session', 'sessions')}`}. See how it got here.`;
  if (target?.since) return `At the Target since ${shortDate(target.since)}${target.first && target.first !== target.since ? ` · first reached ${shortDate(target.first)}` : ''}. See the run.`;
  const range = [strip.low && `low ${signedMoney(strip.low.value)}`, strip.high && `high ${signedMoney(strip.high.value)}`].filter(Boolean);
  return `Session ${strip.sessions} of this Trade${range.length > 0 ? ` · ${range.join(', ')}` : ''}. See the path.`;
}

// The small chart: the Trade P&L by session as a path (broken where a session has no figure), with the Plan's Stop and Target results as lines and
// break-even between them. Drawing only (A256): the figures are the replay's.
const WIDTH = 240;
const HEIGHT = 64;
const TOP = 6;
const FLOOR = HEIGHT - 6;
const toNumber = (value: Rational): number => Number(value.numerator) / Number(value.denominator);
const at = (n: number): string => String(Math.round(n * 10) / 10);

export interface StripChart {
  readonly width: number;
  readonly height: number;
  readonly path: string;
  readonly zeroY: number;
  readonly stopY?: number;
  readonly targetY?: number;
  readonly left: number;
  readonly right: number;
}

export function stripChart(replay: TradeReplayView): StripChart {
  const time = timeAxis(WIDTH, replay.sessions.length);
  const stop = replay.planColumn && toNumber(replay.planColumn.atStop);
  const target = replay.planColumn && toNumber(replay.planColumn.atTarget);
  const pnls = replay.sessions.map((s) => (s.tradePnl.kind === 'Value' ? toNumber(s.tradePnl.value) : null));
  const value = valueAxis(pnlRange([...pnls.filter((p): p is number => p !== null), ...(stop === undefined ? [] : [stop]), ...(target === undefined ? [] : [target])]), TOP, FLOOR);
  let path = '';
  let broken = true;
  pnls.forEach((pnl, i) => {
    if (pnl === null) {
      broken = true;
      return;
    }
    path += `${broken ? 'M' : 'L'}${at(time.x(i))} ${at(value.y(pnl))}`;
    broken = false;
  });
  return { width: WIDTH, height: HEIGHT, path, zeroY: value.y(0), ...(stop !== undefined && { stopY: value.y(stop) }), ...(target !== undefined && { targetY: value.y(target) }), left: time.left, right: time.right };
}
