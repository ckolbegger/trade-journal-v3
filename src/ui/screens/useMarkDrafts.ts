import { useCallback, useRef, useState } from 'react';
import type { MarketDataPrepareEntry, ObservationKey, SaveReviewMarksResult } from '../../app/types.ts';
import { useRuntime } from '../runtime.tsx';
import { holdersOf, listedStanding, standing, type Held, type HeldResult } from './held-review.ts';
import { clearDraft, discardAll, draftAt, draftCount, emptyDrafts, keepOnly, moveDraft, newestTrade, saveEntries, setDraft, type Draft, type Drafts, type DraftValue } from './review-drafts.ts';

const idOf = (key: ObservationKey): string => `${key.instrumentKey}:${key.tradingDate}`;
const without = <T,>(record: Readonly<Record<string, T>>, id: string): Record<string, T> => Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));

// What a refused save said about a key: its issues as the save named them, and the kind of draft they were about. Each card words them
// under its own field ids.
export interface Rejection {
  readonly issues: readonly { readonly field: string; readonly code: string }[];
  readonly draft: DraftValue['kind'];
}

// The Marks step shows this key's cell: its column and editor open, and focus goes to the issue when there is one (A294).
export interface Reveal {
  readonly key: ObservationKey;
  readonly tradeId: string;
  readonly count: number;
  readonly focus: boolean;
}

// The Review's Mark drafts and the one Save Marks over all of them (P156, P157): the Review owns them, each card's grid reads them.
export interface MarkDrafts {
  readonly drafts: Drafts;
  readonly count: number;
  // A draft typed in a Trade; an empty price, or nothing, clears it.
  readonly hold: (key: ObservationKey, value: DraftValue | undefined, tradeId: string) => void;
  // A draft typed in another Trade moves to this one (A293).
  readonly move: (key: ObservationKey, tradeId: string) => void;
  readonly rejections: Readonly<Record<string, Rejection>>;
  // What a Conflict said about a key: nothing was saved, and the Mark shown is the current one.
  readonly notices: Readonly<Record<string, string>>;
  // Why nothing was saved when no cell can say it: the Review changed since it was read, or the write failed.
  readonly failure: 'changed' | 'failed' | undefined;
  readonly setFailure: (failure: 'changed' | 'failed' | undefined) => void;
  // More drafts than one save takes (W76).
  readonly tooMany: { readonly entered: number; readonly limit: number; readonly over: number } | undefined;
  readonly saving: boolean;
  readonly reveal: Reveal | undefined;
  // The card that showed the reveal says so, and it goes: a card opened later does not answer it again.
  readonly settleReveal: (count: number) => void;
  // A Review read again: the drafts whose keys it still lists stay (a draft whose Trade no longer holds its key moves to one that does); the
  // rest are dropped and returned, with the Trades they were typed in (P156).
  readonly reconcile: (held: Held) => readonly Draft[];
  readonly save: () => Promise<void>;
  readonly discard: () => void;
}

interface Options {
  // The newest Review the screen holds, so each draft is bound at its key's current standing (A172).
  readonly latest: () => Held;
  readonly onResult: (result: HeldResult) => void;
  // Saves the entries as one command, for the open card's Trade or, with none open, the one given (P157).
  readonly onSave: (entries: readonly MarketDataPrepareEntry[], tradeId: string | undefined) => Promise<SaveReviewMarksResult>;
}

export function useMarkDrafts({ latest, onResult, onSave }: Options): MarkDrafts {
  const { report } = useRuntime();
  const [drafts, setDrafts] = useState<Drafts>(emptyDrafts);
  // The drafts as of the last change, for what runs between renders (a refreshed Review's reconciling).
  const live = useRef<Drafts>(emptyDrafts);
  const change = useCallback((next: (current: Drafts) => Drafts) => {
    live.current = next(live.current);
    setDrafts(live.current);
  }, []);
  const [rejections, setRejections] = useState<Readonly<Record<string, Rejection>>>({});
  const [notices, setNotices] = useState<Readonly<Record<string, string>>>({});
  const [failure, setFailure] = useState<'changed' | 'failed'>();
  // Save Marks was pressed with more drafts than one save takes: the words follow the count until it is back under the limit.
  const [overLimit, setOverLimit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState<Reveal>();
  const revealed = useRef(0);
  const show = (key: ObservationKey, focus: boolean) => {
    const draft = draftAt(live.current, key);
    if (draft === undefined) return;
    revealed.current += 1;
    setReveal({ key, tradeId: draft.tradeId, focus, count: revealed.current });
  };
  const settleReveal = useCallback((count: number) => setReveal((current) => (current?.count === count ? undefined : current)), []);
  // Changing a draft answers what a refused save said about its key.
  const answer = (key: ObservationKey) => {
    setRejections((current) => without(current, idOf(key)));
    setNotices((current) => without(current, idOf(key)));
  };
  const hold = useCallback((key: ObservationKey, value: DraftValue | undefined, tradeId: string) => {
    change((current) => (value === undefined || (value.kind === 'Price' && value.price === '') ? clearDraft(current, key) : setDraft(current, key, value, tradeId)));
    answer(key);
  }, [change]);
  const move = useCallback((key: ObservationKey, tradeId: string) => change((current) => moveDraft(current, key, tradeId)), [change]);
  const reconcile = (held: Held): readonly Draft[] => {
    const { kept, dropped } = keepOnly(live.current, (key) => listedStanding(held.review, key) !== undefined);
    let changed = dropped.length > 0;
    const moved = Object.values(kept).reduce((rest, draft) => {
      const holders = holdersOf(held.review, draft.key);
      if (holders.length === 0 || holders.includes(draft.tradeId)) return rest;
      changed = true;
      return moveDraft(rest, draft.key, holders[0]!);
    }, kept);
    if (!changed) return dropped;
    change(() => moved);
    for (const draft of dropped) answer(draft.key);
    return dropped;
  };
  const save = async () => {
    const sent = Object.values(drafts);
    const prepared = saveEntries(drafts, (key) => standing(latest(), key)?.revision);
    // Market Data takes 100 entries at once: the screen says so and sends nothing (W76).
    if (prepared.kind === 'TooMany') {
      setOverLimit(true);
      return;
    }
    setOverLimit(false);
    setSaving(true);
    let result: SaveReviewMarksResult | undefined;
    try {
      result = await onSave(prepared.entries, newestTrade(drafts));
    } catch {
      result = undefined;
    } finally {
      setSaving(false);
    }
    // A refusal to write switches the whole shell to read only; the drafts stay.
    if (result) report(result);
    setRejections({});
    setNotices({});
    setFailure(undefined);
    if (result === undefined) setFailure('failed');
    else if (result.kind === 'Conflict' && result.keys) {
      // Each key that moved shows what it is now, so the retry binds to it; the drafts stay.
      const moved = result.keys.flatMap((conflicted) => {
        const draft = sent[conflicted.entryIndex];
        return draft ? [{ key: draft.key, conflicted }] : [];
      });
      onResult({ kind: 'MarksConflict', moved: moved.map(({ key, conflicted }) => ({ key, resolution: conflicted.resolution, resolutionRevision: conflicted.resolutionRevision })) });
      setNotices(Object.fromEntries(moved.map(({ key, conflicted }) => [idOf(key), conflicted.code === 'MarkExists' ? 'A Mark already exists for this date, so it cannot be marked unavailable. Nothing was saved.' : 'This Mark changed after you opened it. Nothing was saved. The current Mark is shown above, and your values are kept.'])));
      if (moved[0]) show(moved[0].key, true);
    } else if (result.kind === 'MarksSaved') {
      // A draft typed or changed while the save was pending is not what was sent, so it stays.
      change((current) =>
        sent.reduce((rest, draft) => {
          const now = draftAt(rest, draft.key);
          return now && JSON.stringify(now.value) === JSON.stringify(draft.value) ? clearDraft(rest, draft.key) : rest;
        }, current),
      );
    } else if (result.kind === 'Rejected') {
      // Each entry's issues sit with its key, in the order the entries were sent in.
      const found = result.issues.flatMap((issue) => {
        const draft = 'entryIndex' in issue && issue.entryIndex !== undefined ? sent[issue.entryIndex] : undefined;
        return draft && 'field' in issue ? [{ draft, issue: { field: issue.field, code: issue.code } }] : [];
      });
      const ids = [...new Set(found.map(({ draft }) => idOf(draft.key)))];
      setRejections(Object.fromEntries(ids.map((id) => [id, { issues: found.filter(({ draft }) => idOf(draft.key) === id).map(({ issue }) => issue), draft: found.find(({ draft }) => idOf(draft.key) === id)!.draft.value.kind }])));
      // The first refused key opens its editor and takes focus (A294); the others show on their cells.
      if (found[0]) show(found[0].draft.key, true);
      else setFailure('failed');
    } else setFailure(result.kind === 'ReviewChanged' ? 'changed' : 'failed');
  };
  // Discard drops every draft on the page, and with them what a refused save said about them.
  const discard = () => {
    change(discardAll);
    setRejections({});
    setNotices({});
    setFailure(undefined);
    setOverLimit(false);
  };
  const tooMany = overLimit ? saveEntries(drafts, () => undefined) : undefined;
  return { drafts, count: draftCount(drafts), hold, move, rejections, notices, failure, setFailure, tooMany: tooMany?.kind === 'TooMany' ? tooMany : undefined, saving, reveal, settleReveal, reconcile, save, discard };
}
