import type { MarkRows, Held, CardEarlierMarks, GapGroup } from './held-review.ts';
import type { MarkRow } from '../../app/types.ts';

// What the Marks step's grid holds of the Review, for the whole page rather than one Trade (P158): each Review-date row once, whichever
// Trades hold the Instrument; the earlier sessions and earlier Marks from the date the first Trade holding the Instrument held it.
export interface StepMarks {
  readonly today: readonly MarkRow[];
  readonly earlier: readonly GapGroup[];
  readonly earlierMarks: CardEarlierMarks;
}

const earliest = (trades: readonly { readonly from: string }[]): string => trades.map(({ from }) => from).sort()[0]!;

// The Review's Marks family for the page, with the rows in the Trades' order: an Instrument comes where its first holding Trade does.
export function stepMarks(held: Held, order: readonly string[]): StepMarks {
  const family: MarkRows | undefined = held.review.families.find((f): f is MarkRows => f.family === 'Marks');
  if (family === undefined) return { today: [], earlier: [], earlierMarks: { instruments: [] } };
  const place = (trades: readonly string[]): number => Math.min(...trades.map((id) => order.indexOf(id)).filter((at) => at >= 0), order.length);
  const today = family.today.map((row, at) => ({ row, at })).sort((a, b) => place(a.row.trades) - place(b.row.trades) || a.at - b.at).map(({ row }) => row);
  const earlier = family.earlier.flatMap((group) => {
    const from = earliest(group.trades);
    const missing = group.missing.filter((date) => date >= from);
    const acknowledged = group.acknowledged.filter((date) => date >= from);
    return missing.length + acknowledged.length > 0 ? [{ ...group, missing, acknowledged }] : [];
  });
  const instruments = family.earlierMarks.map((group) => ({ instrumentKey: group.instrumentKey, instrument: group.instrument, from: earliest(group.trades), marks: group.marks }));
  return { today, earlier, earlierMarks: { ...(family.previousSession !== undefined && { previousSession: family.previousSession }), instruments } };
}
