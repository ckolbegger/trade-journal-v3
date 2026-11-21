import { describe, expect, it } from 'vitest';
import type { ExpectedResolutionRevision, ObservationKey } from '../../app/types.ts';
import { draftAt, draftCount, emptyDrafts, discardAll, newestTrade, keepOnly, moveDraft, saveEntries, setDraft, clearDraft } from './review-drafts.ts';

const THURSDAY = { instrumentKey: 'XYZ', tradingDate: '2026-10-08' };
const MONDAY = { instrumentKey: 'XYZ', tradingDate: '2026-10-12' };
const CALL_MONDAY = { instrumentKey: 'XYZ-C', tradingDate: '2026-10-12' };

const revisions: Record<string, ExpectedResolutionRevision> = { [`XYZ:2026-10-08`]: 2, [`XYZ-C:2026-10-12`]: 5 };
const revisionOf = (key: ObservationKey): ExpectedResolutionRevision | undefined => revisions[`${key.instrumentKey}:${key.tradingDate}`];

describe('drafts by observation key (A292)', () => {
  it('should hold a typed price by Instrument and session with the Trade it was typed in', () => {
    const drafts = setDraft(emptyDrafts, THURSDAY, { kind: 'Price', price: '9.00' }, 't-a');

    expect(draftAt(drafts, THURSDAY)).toEqual({ key: THURSDAY, value: { kind: 'Price', price: '9.00' }, tradeId: 't-a' });
    expect(draftAt(drafts, MONDAY)).toBeUndefined();
    expect(draftAt(drafts, { ...THURSDAY, instrumentKey: 'DEF' })).toBeUndefined();
  });

  it('should replace a typed price with Cant get a price and its reason at the same key', () => {
    const typed = setDraft(emptyDrafts, THURSDAY, { kind: 'Price', price: '9.00' }, 't-a');

    const replaced = setDraft(typed, THURSDAY, { kind: 'CantGetPrice', reason: 'No quote on the screen' }, 't-a');

    expect(draftAt(replaced, THURSDAY)).toEqual({ key: THURSDAY, value: { kind: 'CantGetPrice', reason: 'No quote on the screen' }, tradeId: 't-a' });
    expect(draftAt(typed, THURSDAY)?.value).toEqual({ kind: 'Price', price: '9.00' });
  });

  it('should move a draft to another Trade without changing what was entered', () => {
    const typed = setDraft(setDraft(emptyDrafts, THURSDAY, { kind: 'Price', price: '9.00' }, 't-a'), MONDAY, { kind: 'CantGetPrice', reason: 'Halted' }, 't-a');

    const moved = moveDraft(typed, THURSDAY, 't-f');

    expect(draftAt(moved, THURSDAY)).toEqual({ key: THURSDAY, value: { kind: 'Price', price: '9.00' }, tradeId: 't-f' });
    expect(draftAt(moved, MONDAY)).toEqual(draftAt(typed, MONDAY));
    expect(moveDraft(typed, CALL_MONDAY, 't-f')).toBe(typed);
  });

  it('should keep only drafts whose keys are still in a refreshed Review, returning the dropped ones with their Trades', () => {
    const drafts = setDraft(setDraft(setDraft(emptyDrafts, THURSDAY, { kind: 'Price', price: '9.00' }, 't-a'), MONDAY, { kind: 'Price', price: '10.00' }, 't-f'), CALL_MONDAY, { kind: 'CantGetPrice', reason: 'Halted' }, 't-c');
    const stillListed = (key: ObservationKey) => key.instrumentKey === 'XYZ' && key.tradingDate === '2026-10-12';

    const { kept, dropped } = keepOnly(drafts, stillListed);

    expect(draftAt(kept, MONDAY)).toEqual(draftAt(drafts, MONDAY));
    expect(draftAt(kept, THURSDAY)).toBeUndefined();
    expect(draftAt(kept, CALL_MONDAY)).toBeUndefined();
    expect(dropped).toEqual([draftAt(drafts, THURSDAY), draftAt(drafts, CALL_MONDAY)]);
  });

  it('should empty every draft on Discard', () => {
    const drafts = setDraft(setDraft(emptyDrafts, THURSDAY, { kind: 'Price', price: '9.00' }, 't-a'), CALL_MONDAY, { kind: 'CantGetPrice', reason: 'Halted' }, 't-f');

    const discarded = discardAll();

    expect(draftAt(discarded, THURSDAY)).toBeUndefined();
    expect(draftAt(discarded, CALL_MONDAY)).toBeUndefined();
    expect(saveEntries(discarded, revisionOf)).toEqual({ kind: 'Entries', entries: [] });
    expect(draftAt(drafts, THURSDAY)).toBeDefined();
  });

  it('should clear one key draft, leaving the others, and build no save entry for it', () => {
    const drafts = setDraft(setDraft(emptyDrafts, THURSDAY, { kind: 'Price', price: '9.00' }, 't-a'), CALL_MONDAY, { kind: 'CantGetPrice', reason: 'Halted' }, 't-f');

    const cleared = clearDraft(drafts, THURSDAY);

    expect(draftAt(cleared, THURSDAY)).toBeUndefined();
    expect(draftAt(cleared, CALL_MONDAY)).toEqual(draftAt(drafts, CALL_MONDAY));
    const saved = saveEntries(cleared, revisionOf);
    expect(saved.kind === 'Entries' && saved.entries.map((e) => e.key)).toEqual([CALL_MONDAY]);
    expect(draftAt(drafts, THURSDAY)).toBeDefined();
  });

  it('should build no entries for more than 100 drafts and say how many are entered (W76)', () => {
    const entered = (count: number) => Array.from({ length: count }, (_, i) => i).reduce((drafts, i) => setDraft(drafts, { instrumentKey: 'XYZ', tradingDate: `2026-09-${String(i).padStart(3, '0')}` }, { kind: 'Price', price: '1.00' }, 't-a'), emptyDrafts);

    expect(saveEntries(entered(112), revisionOf)).toEqual({ kind: 'TooMany', entered: 112, limit: 100, over: 12 });

    const atLimit = saveEntries(entered(100), revisionOf);
    expect(atLimit.kind === 'Entries' && atLimit.entries.length).toBe(100);
  });

  it('should build one save entry per draft, bound at its key standing', () => {
    const typed = setDraft(emptyDrafts, THURSDAY, { kind: 'Price', price: ' 9.00 ' }, 't-a');
    const drafts = setDraft(setDraft(typed, MONDAY, { kind: 'CantGetPrice', reason: 'Halted' }, 't-f'), CALL_MONDAY, { kind: 'Price', price: '0.35' }, 't-a');

    expect(saveEntries(drafts, revisionOf)).toEqual({
      kind: 'Entries',
      entries: [
        { key: THURSDAY, expectedRevision: 2, intention: { kind: 'RecordInitialManualMark', price: '9.00' } },
        { key: MONDAY, expectedRevision: 'None', intention: { kind: 'AssertUnavailable', reason: 'Halted' } },
        { key: CALL_MONDAY, expectedRevision: 5, intention: { kind: 'RecordInitialManualMark', price: '0.35' } },
      ],
    });
  });

  it('should count the drafts on the page and name the Trade the newest was typed in', () => {
    const typed = setDraft(setDraft(emptyDrafts, THURSDAY, { kind: 'Price', price: '9.00' }, 't-a'), MONDAY, { kind: 'Price', price: '9.50' }, 't-f');

    expect(draftCount(emptyDrafts)).toBe(0);
    expect(newestTrade(emptyDrafts)).toBeUndefined();
    expect(draftCount(typed)).toBe(2);
    expect(newestTrade(typed)).toBe('t-f');
    // A key typed again keeps its place, so the newest key is still the last entered; moving a draft to a Trade makes that Trade its owner.
    expect(newestTrade(moveDraft(typed, MONDAY, 't-a'))).toBe('t-a');
  });
});
