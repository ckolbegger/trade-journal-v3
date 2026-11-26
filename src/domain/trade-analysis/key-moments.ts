import { Rational } from '../values/index.ts';
import type { ReplayedSession } from './replay-series.ts';

const ZERO = Rational.of(0n);

export type KeyMomentKind = 'Entry' | 'Low' | 'Stop' | 'Target' | 'High' | 'Sale' | 'Now' | 'End';

const ORDER: readonly KeyMomentKind[] = ['Entry', 'Low', 'Stop', 'Target', 'High', 'Sale', 'Now', 'End'];

export interface KeyMoment {
  readonly date: string;
  readonly kinds: readonly KeyMomentKind[];
}

export function keyMoments(sessions: readonly ReplayedSession[]): readonly KeyMoment[] {
  const first = sessions[0];
  if (!first) return [];
  const kindsByDate = new Map<string, Set<KeyMomentKind>>();
  const add = (date: string, kind: KeyMomentKind) => kindsByDate.set(date, (kindsByDate.get(date) ?? new Set()).add(kind));
  add(first.date, 'Entry');
  // Worst and best by the series' Trade P&L in dollars; a tie keeps the earliest session.
  let low: { date: string; value: Rational } | undefined;
  let high: { date: string; value: Rational } | undefined;
  for (const s of sessions) {
    if (s.tradePnl.kind !== 'Value') continue;
    const value = s.tradePnl.value;
    if (!low || value.compare(low.value) < 0) low = { date: s.date, value };
    if (!high || value.compare(high.value) > 0) high = { date: s.date, value };
  }
  // A271: `first` is kept on every later session, so the last session holds it.
  const last = sessions[sessions.length - 1]!;
  if (last.crossings?.stop.first) add(last.crossings.stop.first.date, 'Stop');
  if (last.crossings?.target.first) add(last.crossings.target.first.date, 'Target');
  // A sale is a Position Change that reduces or closes the Position; an Expiration is not one.
  for (const s of sessions) if (s.markers?.some((m) => m.kind === 'Execution' && (m.effect === 'Reduced' || m.effect === 'Closed'))) add(s.date, 'Sale');
  add(last.date, last.heldQuantity.compare(ZERO) === 0 ? 'End' : 'Now');
  if (low) add(low.date, 'Low');
  if (high) add(high.date, 'High');
  return [...kindsByDate]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, kinds]) => ({ date, kinds: ORDER.filter((k) => kinds.has(k)) }));
}
