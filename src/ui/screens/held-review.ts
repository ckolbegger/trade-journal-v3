import type { DailyTradeReview, ExpectedResolutionRevision, MarkResolution, ObservationKey, OpenDailyReviewResult, PostMarksReview, PostSaveReview, ReviewNextStep, SavedMark, WalkedTrade } from '../../app/types.ts';

export type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;

// Where a key stands: its resolution and the revision a save of it binds to.
export interface Standing {
  readonly resolution: MarkResolution;
  readonly revision: ExpectedResolutionRevision;
}

// The Review the screen holds, and each key's standing learned from results since it was read (A171, A172).
export interface Held {
  readonly review: Ready;
  readonly standings: Readonly<Record<string, Standing>>;
}

export type HeldResult =
  | { readonly kind: 'Opened'; readonly review: Ready }
  | { readonly kind: 'ActionSaved' | 'DebtResolved'; readonly review: PostSaveReview }
  | { readonly kind: 'MarksSaved'; readonly marks: readonly SavedMark[]; readonly review: PostMarksReview }
  | { readonly kind: 'MarkSaved'; readonly key: ObservationKey; readonly resolution: MarkResolution; readonly resolutionRevision: number }
  | { readonly kind: 'MarksConflict'; readonly moved: readonly MovedKey[] };

// A key a Save Marks Conflict reported as moved, with the resolution and revision it now stands at.
export interface MovedKey {
  readonly key: ObservationKey;
  readonly resolution: MarkResolution;
  readonly resolutionRevision: number;
}

export function fold(held: Held, result: HeldResult): Held {
  switch (result.kind) {
    case 'Opened':
      return { ...held, review: result.review };
    case 'ActionSaved':
    case 'DebtResolved': {
      const post = result.review;
      if (post.kind !== 'Ready') return held;
      return { ...held, review: { ...held.review, completion: post.completion, binding: post.binding } };
    }
    case 'MarksSaved': {
      const learned = learn({ ...held, review: withSavedMarks(held.review, result.marks) }, result.marks);
      const post = result.review;
      if (post.kind !== 'Ready') return learned;
      // The re-sort (decision 64): the walked Trades follow the Review the save returned.
      const families = learned.review.families.map((f) => (f.family === 'Trades' ? { ...f, trades: post.trades } : f));
      return { ...learned, review: { ...learned.review, completion: post.completion, binding: post.binding, families } };
    }
    case 'MarkSaved':
      return learn(held, [result]);
    case 'MarksConflict':
      return learn(held, result.moved);
  }
}

const idOf = (key: ObservationKey): string => `${key.instrumentKey}:${key.tradingDate}`;

// Records where each key now stands, unless it is already learned at a newer revision (A172: never backward).
function learn(held: Held, keys: readonly MovedKey[]): Held {
  const standings = { ...held.standings };
  for (const k of keys) {
    const known = standings[idOf(k.key)];
    if (known === undefined || k.resolutionRevision >= rank(known.revision)) standings[idOf(k.key)] = { resolution: k.resolution, revision: k.resolutionRevision };
  }
  return { ...held, standings };
}

export type MarkRows = Extract<Ready['families'][number], { family: 'Marks' }>;
export type GapGroup = MarkRows['earlier'][number];

// The Marks a card owns (A153): its Review-date rows, and its earlier sessions from the date each is relevant to the Trade.
export interface CardMarkRows {
  readonly today: MarkRows['today'];
  readonly earlier: readonly GapGroup[];
}

export function marksOf(held: Held, tradeId: string): CardMarkRows {
  const family = held.review.families.find((f) => f.family === 'Marks');
  if (family?.family !== 'Marks') return { today: [], earlier: [] };
  const earlier = family.earlier.flatMap((group) => {
    const from = group.trades.find((t) => t.tradeId === tradeId)?.from;
    if (from === undefined) return [];
    const missing = group.missing.filter((date) => date >= from);
    const acknowledged = group.acknowledged.filter((date) => date >= from);
    return missing.length + acknowledged.length > 0 ? [{ ...group, missing, acknowledged }] : [];
  });
  return { today: family.today.filter((row) => row.trades.includes(tradeId)), earlier };
}

// The card to open after an Action save (P50).
export type NextCard =
  | { readonly kind: 'Mark'; readonly tradeId: string; readonly instrumentKey: string }
  | { readonly kind: 'MarkNotHeld' }
  | { readonly kind: 'Trade'; readonly trade: DailyTradeReview }
  | { readonly kind: 'Done' };

const walkedOf = (review: Ready): readonly WalkedTrade[] => review.families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));

// A Mark step opens the first card, in the held order, whose Trade is in the row, on that Instrument's row.
export function nextCard(held: Held, next: ReviewNextStep): NextCard {
  if (next.kind === 'Trade') return { kind: 'Trade', trade: next.trade };
  if (next.kind === 'Done') return { kind: 'Done' };
  const holder = walkedOf(held.review).find((t) => next.row.trades.includes(t.tradeId));
  return holder ? { kind: 'Mark', tradeId: holder.tradeId, instrumentKey: next.row.instrumentKey } : { kind: 'MarkNotHeld' };
}

const rank =(revision: ExpectedResolutionRevision): number => (revision === 'None' ? 0 : revision);

// What the held Review lists for a key: its Review-date row, or its earlier session in an Instrument's gap group.
function listedStanding(review: Ready, key: ObservationKey): Standing | undefined {
  const family = review.families.find((f) => f.family === 'Marks');
  if (family?.family !== 'Marks') return undefined;
  const row = family.today.find((r) => r.instrumentKey === key.instrumentKey && r.tradingDate === key.tradingDate);
  if (row) return { resolution: row.resolution, revision: row.resolutionRevision };
  const group = family.earlier.find((g) => g.instrumentKey === key.instrumentKey && [...g.missing, ...g.acknowledged].includes(key.tradingDate));
  if (!group) return undefined;
  const acknowledgment = group.acknowledgments[key.tradingDate];
  return { resolution: acknowledgment ? { kind: 'AcknowledgedUnavailable', acknowledgment } : { kind: 'Missing' }, revision: group.revisions[key.tradingDate] ?? 'None' };
}

// A key's current resolution and revision (A172): what was learned from results, unless the Review lists the key at a
// revision at least as new. A key's revision never moves backward.
export function standing(held: Held, key: ObservationKey): Standing | undefined {
  const learned = held.standings[idOf(key)];
  const listed = listedStanding(held.review, key);
  if (learned === undefined || listed === undefined) return learned ?? listed;
  return rank(listed.revision) >= rank(learned.revision) ? listed : learned;
}

// The Review's Marks family after a Marks save: each saved key's resolution and revision on its Review-date row.
function withSavedMarks(review: Ready, saved: readonly SavedMark[]): Ready {
  const savedFor = (instrumentKey: string, tradingDate: string) => saved.find((m) => m.key.instrumentKey === instrumentKey && m.key.tradingDate === tradingDate);
  return {
    ...review,
    families: review.families.map((family) => {
      if (family.family !== 'Marks') return family;
      const today = family.today.map((row) => {
        const mark = savedFor(row.instrumentKey, row.tradingDate);
        return mark ? { ...row, resolution: mark.resolution, resolutionRevision: mark.resolutionRevision, task: mark.resolution.kind === 'Missing' ? ('Manual' as const) : null } : row;
      });
      // A saved earlier session leaves its gap list; an acknowledged one stays, listed as acknowledged. The gap groups are
      // rebuilt at the next `open` (P38).
      const earlier = family.earlier.map((group) => {
        const marked = [...group.missing, ...group.acknowledged].flatMap((date) => {
          const mark = savedFor(group.instrumentKey, date);
          return mark ? [{ date, mark }] : [];
        });
        if (marked.length === 0) return group;
        const dates = new Set(marked.map((m) => m.date));
        const acknowledgments = { ...group.acknowledgments };
        const revisions = { ...group.revisions };
        const acknowledged = group.acknowledged.filter((date) => !dates.has(date));
        for (const { date, mark } of marked) {
          revisions[date] = mark.resolutionRevision;
          if (mark.resolution.kind === 'AcknowledgedUnavailable') {
            acknowledgments[date] = mark.resolution.acknowledgment;
            acknowledged.push(date);
          }
        }
        return { ...group, missing: group.missing.filter((date) => !dates.has(date)), acknowledged, revisions, acknowledgments };
      });
      return { ...family, today, earlier };
    }),
  };
}
