import type { ExpectedResolutionRevision, MarketDataPrepareEntry, ObservationKey } from '../../app/types.ts';

// What was entered for a key: a typed price, or "Can't get a price" with its reason (A153, A292).
export type DraftValue = { readonly kind: 'Price'; readonly price: string } | { readonly kind: 'CantGetPrice'; readonly reason: string };

// A draft: what was entered for a key, and the Trade it was typed in.
export interface Draft {
  readonly key: ObservationKey;
  readonly value: DraftValue;
  readonly tradeId: string;
}

// The Review's Mark drafts by observation key, Instrument and date (A292). View state only: nothing here is stored (AC-JOUR-001).
export type Drafts = Readonly<Record<string, Draft>>;

export const emptyDrafts: Drafts = {};

const idOf = (key: ObservationKey): string => `${key.instrumentKey}:${key.tradingDate}`;

export const draftAt = (drafts: Drafts, key: ObservationKey): Draft | undefined => drafts[idOf(key)];

export const draftCount = (drafts: Drafts): number => Object.keys(drafts).length;

// The Trade the newest draft was typed in: the Trade a Save Marks with no card open refreshes (P157).
export const newestTrade = (drafts: Drafts): string | undefined => Object.values(drafts).at(-1)?.tradeId;

// Discard empties every draft on the page (P156).
export const discardAll = (): Drafts => emptyDrafts;

// Clears what was entered for one key; the other drafts stay (W76: clear some, then save). A key with no draft changes nothing.
export function clearDraft(drafts: Drafts, key: ObservationKey): Drafts {
  if (!draftAt(drafts, key)) return drafts;
  return Object.fromEntries(Object.entries(drafts).filter(([id]) => id !== idOf(key)));
}

// A refreshed Review keeps the drafts whose keys it still lists, whichever Trade they were typed in; the rest are returned, with their
// Trades, for the "not kept" notice (P156).
export function keepOnly(drafts: Drafts, isListed: (key: ObservationKey) => boolean): { readonly kept: Drafts; readonly dropped: readonly Draft[] } {
  const all = Object.entries(drafts);
  return { kept: Object.fromEntries(all.filter(([, draft]) => isListed(draft.key))), dropped: all.filter(([, draft]) => !isListed(draft.key)).map(([, draft]) => draft) };
}

// A draft moves to another Trade (the mirrored cell's input, A293); what was entered stays. A key with no draft changes nothing.
export function moveDraft(drafts: Drafts, key: ObservationKey, tradeId: string): Drafts {
  const draft = draftAt(drafts, key);
  return draft ? { ...drafts, [idOf(key)]: { ...draft, tradeId } } : drafts;
}

// Market Data accepts 1 to 100 entries in one save (A154).
const MAX_ENTRIES = 100;

// The entries to send, or, with more drafts than one save takes, how many are entered and how many too many (W76: the view says it).
export type SaveEntries =
  | { readonly kind: 'Entries'; readonly entries: readonly MarketDataPrepareEntry[] }
  | { readonly kind: 'TooMany'; readonly entered: number; readonly limit: number; readonly over: number };

// One save entry per draft, in the order the drafts were first entered, each bound at the revision its key stands at (A172). A key
// with no known standing binds at None: Market Data's per-key revision check owns the rest.
export function saveEntries(drafts: Drafts, revisionOf: (key: ObservationKey) => ExpectedResolutionRevision | undefined): SaveEntries {
  const all = Object.values(drafts);
  if (all.length > MAX_ENTRIES) return { kind: 'TooMany', entered: all.length, limit: MAX_ENTRIES, over: all.length - MAX_ENTRIES };
  const entries = all.map(({ key, value }): MarketDataPrepareEntry => ({
    key,
    expectedRevision: revisionOf(key) ?? 'None',
    intention: value.kind === 'Price' ? { kind: 'RecordInitialManualMark', price: value.price.trim() } : { kind: 'AssertUnavailable', reason: value.reason },
  }));
  return { kind: 'Entries', entries };
}

// Holds what was entered for a key, typed in a Trade. A draft already at the key is replaced.
export const setDraft = (drafts: Drafts, key: ObservationKey, value: DraftValue, tradeId: string): Drafts => ({ ...drafts, [idOf(key)]: { key, value, tradeId } });
