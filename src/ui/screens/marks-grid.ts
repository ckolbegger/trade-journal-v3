import type { MarkRow, ObservationKey } from '../../app/types.ts';
import type { Instrument } from '../../domain/instrument/index.ts';
import type { CardEarlierMarks, GapGroup, Standing } from './held-review.ts';

// What one cell of the Marks grid holds (A291): a key's resolution and the revision a save of it binds to.
export type GridCellState = Standing;

// The words of the key's `can't get a price` action and of the cell that holds it as a draft.
export const CANT_GET_A_PRICE = "Can't get a price";

// What a cell holds once "Can't get a price" is given with its reason (W113).
export const NO_PRICE = 'No price';

// A session before the Trade held the Instrument (W77).
export const NOT_HELD = 'NotHeld';

export interface GridInstrument {
  readonly instrumentKey: string;
  readonly instrument: Instrument;
}

// A session column: the Review Date and the previous session carry their role (W71).
export interface GridSession {
  readonly date: string;
  readonly role?: 'review-date' | 'previous';
}

// Which cells the page's grid holds and each one's state, decided from the open result (A291). Nothing is worked out here: a cell
// reads the Review's own rows, gap groups, earlier Marks and standings.
export interface GridModel {
  readonly instruments: readonly GridInstrument[];
  // Every session the grid shows, newest first: the Review Date, the previous session, then each earlier session missing a Mark.
  readonly sessions: readonly GridSession[];
  // A cell's state, Not held, or undefined when the Review lists no Mark there.
  readonly cellAt: (instrumentKey: string, date: string) => GridCellState | typeof NOT_HELD | undefined;
}

// The Instrument's Mark at the previous session, when it has one: what a typed price is measured from (P167).
export function previousMark(model: GridModel, instrumentKey: string): string | undefined {
  const previous = model.sessions.find(({ role }) => role === 'previous')?.date;
  const cell = previous === undefined ? undefined : model.cellAt(instrumentKey, previous);
  return cell && cell !== NOT_HELD && cell.resolution.kind === 'Available' ? cell.resolution.mark.price : undefined;
}

export interface GridInput {
  readonly reviewDate: string;
  // The page's Review-date rows.
  readonly today: readonly MarkRow[];
  // The page's earlier sessions without an effective Mark, as the page opened.
  readonly earlier: readonly GapGroup[];
  readonly earlierMarks: CardEarlierMarks;
  // A key's standing from the held Review, learned results included (A172).
  readonly standing: (key: ObservationKey) => Standing | undefined;
}

const earliest = (trades: readonly { readonly from: string }[] | undefined): string | undefined => trades?.map(({ from }) => from).sort()[0];

const newestFirst = (a: string, b: string): number => (a < b ? 1 : -1);

export function gridModel({ reviewDate, today, earlier, earlierMarks, standing }: GridInput): GridModel {
  const previous = earlierMarks.previousSession;
  const gapDates = [...new Set(earlier.flatMap((group) => [...group.missing, ...group.acknowledged]))].filter((date) => date !== previous && date !== reviewDate).sort(newestFirst);
  const sessions: GridSession[] = [
    { date: reviewDate, role: 'review-date' },
    ...(previous === undefined ? [] : [{ date: previous, role: 'previous' as const }]),
    ...gapDates.map((date) => ({ date })),
  ];
  // A date the Review lists as a gap starts from that listing; the held Review's standing, when it knows the key, comes first.
  const listedGap = (instrumentKey: string, date: string): GridCellState | undefined => {
    const group = earlier.find((g) => g.instrumentKey === instrumentKey);
    if (!group) return undefined;
    const acknowledgment = group.acknowledgments[date];
    if (acknowledgment) return { resolution: { kind: 'AcknowledgedUnavailable', acknowledgment }, revision: group.revisions[date] ?? 'None' };
    return group.missing.includes(date) ? { resolution: { kind: 'Missing' }, revision: group.revisions[date] ?? 'None' } : undefined;
  };
  // The session the first Trade holding the Instrument held it from; an Instrument with no earlier Marks was opened on the Review Date.
  const heldFrom = (instrumentKey: string): string =>
    earlierMarks.instruments.find((i) => i.instrumentKey === instrumentKey)?.from ?? earliest(earlier.find((g) => g.instrumentKey === instrumentKey)?.trades) ?? reviewDate;
  const cellAt = (instrumentKey: string, date: string): GridCellState | typeof NOT_HELD | undefined => {
    if (date < heldFrom(instrumentKey)) return NOT_HELD;
    const known = standing({ instrumentKey, tradingDate: date });
    if (date === reviewDate) {
      const row = today.find((r) => r.instrumentKey === instrumentKey);
      // An Instrument with earlier sessions only, no row on the Review Date, is not held on it.
      return row ? (known ?? { resolution: row.resolution, revision: row.resolutionRevision }) : NOT_HELD;
    }
    return known ?? listedGap(instrumentKey, date);
  };
  // One row per Instrument the Trade holds, in the Review-date rows' order; one it held only before the Review Date follows them.
  const instruments = [...today, ...earlier, ...earlierMarks.instruments].reduce<GridInstrument[]>(
    (rows, { instrumentKey, instrument }) => (rows.some((row) => row.instrumentKey === instrumentKey) ? rows : [...rows, { instrumentKey, instrument }]),
    [],
  );
  return { instruments, sessions, cellAt };
}
