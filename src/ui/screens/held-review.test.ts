import { describe, expect, it } from 'vitest';
import { cardProgress, reflectionsOwedProgress } from '../../../tests/support/card-progress.ts';
import type { DailyTradeReview, IncompleteReason, MarkResolution, MarkRow, OpenDailyReviewResult, OwedReflectionsTrade, PostMarksReview, PostSaveReview, ReviewBinding, ReviewCompletion, ReviewNextStep, SavedMark, WalkedTrade } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { fold, marksOf, nextCard, standing, type Held, type Standing } from './held-review.ts';

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;
type Earlier = Extract<Ready['families'][number], { family: 'Marks' }>['earlier'];

// The card fixture in miniature (D5R2 section 4): T-A and T-F both hold XYZ, T-A from Friday 2026-10-09 and T-F from Monday;
// T-C holds DEF. XYZ has an earlier session without a Mark, Friday. The Reviews are built on the facade double's UI shapes.
const MONDAY = '2026-10-12';
const FRIDAY = '2026-10-09';
const CUTOFF = '2026-10-12T20:00:00Z';
const binding: ReviewBinding = {
  workspace: { databaseName: 'tj-ws-1', contentRevision: 3 },
  catalogRevision: 1,
  journalRevision: 1,
  marketDataSnapshotId: 'mds1:1:abc',
  factRevisions: {},
  outstandingDebts: {},
};
const newBinding: ReviewBinding = { ...binding, marketDataSnapshotId: 'mds1:2:def' };
const available = (price: string, revisionNumber = 1): MarkResolution => ({ kind: 'Available', mark: { revisionId: `r${revisionNumber}`, revisionNumber, price, source: 'Manual', savedAt: '2026-10-12T21:00:00Z' } });
const missingRow = (instrumentKey: string, trades: readonly string[]): MarkRow => ({ instrumentKey, tradingDate: MONDAY, trades, resolution: { kind: 'Missing' }, resolutionRevision: 'None', task: 'Manual' });
const walked = (tradeId: string, underlying: string): WalkedTrade => ({
  tradeId,
  underlying,
  lastActivity: '2026-10-12T14:00:00Z',
  band: 'Routine',
  reasons: [{ code: 'NoPressure' }],
  basis: { kind: 'Value', value: { side: 'None', share: Rational.of(0n, 1n) } },
  rangePosition: { kind: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: underlying }, date: MONDAY },
  progress: cardProgress(),
});
const TA = walked('t-a', 'XYZ');
const TF = walked('t-f', 'XYZ');
const TC = walked('t-c', 'DEF');

const markMissing = (instrumentKey: string, ...trades: string[]): IncompleteReason => ({ code: 'MarkMissing', instrument: { kind: 'Stock', symbol: instrumentKey }, tradingDate: MONDAY, trades });
const actionMissing = (...ids: string[]): IncompleteReason[] => ids.map((tradeId) => ({ code: 'ActionMissing', tradeId }));
const OWING: ReviewCompletion = { kind: 'Incomplete', reasons: [markMissing('XYZ', 't-a', 't-f'), markMissing('DEF', 't-c'), ...actionMissing('t-a', 't-f', 't-c')] };
const xyzGap: Earlier[number] = {
  instrumentKey: 'XYZ',
  trades: [
    { tradeId: 't-a', from: FRIDAY },
    { tradeId: 't-f', from: MONDAY },
  ],
  missing: [FRIDAY],
  acknowledged: [],
  revisions: { [FRIDAY]: 'None' },
  acknowledgments: {},
  blocking: false,
};

function review(over: { readonly trades?: readonly WalkedTrade[]; readonly earlier?: Earlier; readonly today?: readonly MarkRow[]; readonly completion?: ReviewCompletion; readonly binding?: ReviewBinding } = {}): Ready {
  return {
    kind: 'Ready',
    reviewDate: MONDAY,
    cutoff: CUTOFF,
    families: [
      { family: 'Marks', today: over.today ?? [missingRow('XYZ', ['t-a', 't-f']), missingRow('DEF', ['t-c'])], earlier: over.earlier ?? [xyzGap] },
      { family: 'Trades', trades: over.trades ?? [TA, TF, TC] },
    ],
    owed: [],
    completion: over.completion ?? OWING,
    binding: over.binding ?? binding,
  };
}
// A Ready Review under saved Marks; the card's Trade and the next step are not folded (the view reads them).
const postMarks = (over: { readonly completion: ReviewCompletion; readonly trades: readonly WalkedTrade[] }): PostMarksReview => ({
  kind: 'Ready',
  progress: { tradesWithAction: 0, tradesEligible: 3 },
  completion: over.completion,
  binding: newBinding,
  trades: over.trades,
  trade: {} as DailyTradeReview,
  nextStep: { kind: 'Done' },
});
const held = (over: Parameters<typeof review>[0] = {}): Held => ({ review: review(over), standings: {} });
const tradeIds = (r: Ready): string[] => r.families.flatMap((f) => (f.family === 'Trades' ? f.trades.map((t) => t.tradeId) : []));
const marksFamily = (r: Ready) => r.families.find((f) => f.family === 'Marks') as Extract<Ready['families'][number], { family: 'Marks' }>;
const saved = (instrumentKey: string, tradingDate: string, resolution: MarkResolution, resolutionRevision = 1): SavedMark => ({ key: { instrumentKey, tradingDate }, resolution, resolutionRevision, classification: 'InitialManual' });

describe('fold (A171)', () => {
  it('should replace the held Review with an Opened one, keeping the new Trade order (decision 64)', () => {
    const opened = review({ trades: [TC, TA, TF], binding: newBinding });

    const next = fold(held(), { kind: 'Opened', review: opened });

    expect(next.review).toEqual(opened);
    expect(tradeIds(next.review)).toEqual(['t-c', 't-a', 't-f']);
  });

  it('should replace the completion and binding from a Ready ActionSaved or DebtResolved Review, and leave the held Review as it was for ChangedDuringAssembly', () => {
    const before = held();
    const completion: ReviewCompletion = { kind: 'Incomplete', reasons: [markMissing('DEF', 't-c'), ...actionMissing('t-c')] };
    const post: PostSaveReview = { kind: 'Ready', cards: [], progress: { tradesWithAction: 2, tradesEligible: 3 }, completion, nextStep: { kind: 'Done' }, binding: newBinding };

    for (const kind of ['ActionSaved', 'DebtResolved'] as const) {
      const next = fold(before, { kind, review: post });
      expect(next.review).toEqual({ ...before.review, completion, binding: newBinding });
    }
    for (const kind of ['ActionSaved', 'DebtResolved'] as const) {
      expect(fold(before, { kind, review: { kind: 'ChangedDuringAssembly' } })).toEqual(before);
    }
  });

  it('should put each MarksSaved key resolution and revision on its Review-date row, clear the row Manual task, and replace the walked Trades, completion and binding', () => {
    const before = held();
    const completion: ReviewCompletion = { kind: 'Incomplete', reasons: [markMissing('DEF', 't-c'), ...actionMissing('t-a', 't-f', 't-c')] };
    const reordered = [TC, { ...TA, band: 'BoundaryReached' as const }, TF];

    const next = fold(before, { kind: 'MarksSaved', marks: [saved('XYZ', MONDAY, available('52'))], review: postMarks({ completion, trades: reordered }) });

    expect(marksFamily(next.review).today).toEqual([{ ...missingRow('XYZ', ['t-a', 't-f']), resolution: available('52'), resolutionRevision: 1, task: null }, missingRow('DEF', ['t-c'])]);
    expect(next.review.completion).toEqual(completion);
    expect(next.review.binding).toEqual(newBinding);
    expect(next.review.families.find((f) => f.family === 'Trades')).toEqual({ family: 'Trades', trades: reordered });
  });

  it('should take a saved earlier session out of its Instrument missing list, and keep an acknowledged one listed as acknowledged with its acknowledgment', () => {
    const THURSDAY = '2026-10-08';
    const WEDNESDAY = '2026-10-07';
    const old = { versionId: 'a0', kind: 'Asserted' as const, reason: 'no quote', savedAt: '2026-10-08T21:00:00Z' };
    const fresh = { versionId: 'a1', kind: 'Asserted' as const, reason: 'halted', savedAt: '2026-10-12T21:00:00Z' };
    const gap: Earlier[number] = { ...xyzGap, missing: [FRIDAY, THURSDAY], acknowledged: [WEDNESDAY], revisions: { [FRIDAY]: 'None', [THURSDAY]: 'None', [WEDNESDAY]: 2 }, acknowledgments: { [WEDNESDAY]: old } };
    const before = held({ earlier: [gap] });
    const completion: ReviewCompletion = { kind: 'Complete' };

    const next = fold(before, {
      kind: 'MarksSaved',
      marks: [saved('XYZ', FRIDAY, available('9')), saved('XYZ', THURSDAY, { kind: 'AcknowledgedUnavailable', acknowledgment: fresh }, 3), saved('XYZ', WEDNESDAY, available('8', 3), 3)],
      review: postMarks({ completion, trades: [TA, TF, TC] }),
    });

    expect(marksFamily(next.review).earlier).toEqual([
      { ...gap, missing: [], acknowledged: [THURSDAY], revisions: { [FRIDAY]: 1, [THURSDAY]: 3, [WEDNESDAY]: 3 }, acknowledgments: { [WEDNESDAY]: old, [THURSDAY]: fresh } },
    ]);
  });

  it('should apply the saved keys and nothing else when the MarksSaved Review is ChangedDuringAssembly', () => {
    const before = held();

    const next = fold(before, { kind: 'MarksSaved', marks: [saved('XYZ', MONDAY, available('52')), saved('XYZ', FRIDAY, available('9'))], review: { kind: 'ChangedDuringAssembly' } });

    expect(marksFamily(next.review).today[0]).toEqual({ ...missingRow('XYZ', ['t-a', 't-f']), resolution: available('52'), resolutionRevision: 1, task: null });
    expect(marksFamily(next.review).earlier).toEqual([{ ...xyzGap, missing: [], revisions: { [FRIDAY]: 1 } }]);
    expect(next.review.completion).toEqual(before.review.completion);
    expect(next.review.binding).toEqual(binding);
    expect(next.review.families.find((f) => f.family === 'Trades')).toEqual(before.review.families.find((f) => f.family === 'Trades'));
  });
});

describe('fold with progress (A165, A171)', () => {
  it('should replace a walked Trade progress with the one an ActionSaved or DebtResolved Review cards carry, and leave the other Trades as held', () => {
    const before = held();
    const saved = cardProgress(0, 1, { owed: false });
    const resolved = cardProgress(0, 0, { needed: 0 });
    const walkedProgress = (r: Ready) => r.families.flatMap((f) => (f.family === 'Trades' ? f.trades.map((t) => [t.tradeId, t.progress] as const) : []));

    for (const kind of ['ActionSaved', 'DebtResolved'] as const) {
      // A card for a Trade the Review does not hold is ignored.
      const post: PostSaveReview = { kind: 'Ready', cards: [{ tradeId: 't-a', progress: saved }, { tradeId: 't-z', progress: resolved }], progress: { tradesWithAction: 1, tradesEligible: 3 }, completion: OWING, nextStep: { kind: 'Done' }, binding: newBinding };

      const next = fold(before, { kind, review: post });

      expect(walkedProgress(next.review)).toEqual([
        ['t-a', saved],
        ['t-f', TF.progress],
        ['t-c', TC.progress],
      ]);
    }
  });
});

describe('fold with owed progress (A165, T6.13)', () => {
  const owedTrade = (tradeId: string, dueNow: number): OwedReflectionsTrade => ({ tradeId, underlying: 'ABC', lifecycle: 'Closed', owed: [], progress: reflectionsOwedProgress(dueNow, 0) });

  it('should replace an owed Trade progress with the one an ActionSaved or DebtResolved Review cards carry, and leave the other owed Trades and the walked ones as held', () => {
    const base = held();
    const before: Held = { ...base, review: { ...base.review, owed: [owedTrade('t-x', 1), owedTrade('t-y', 2)] } };
    const answered = reflectionsOwedProgress(0, 0);
    const owedProgress = (r: Ready) => r.owed.map((t) => [t.tradeId, t.progress] as const);

    for (const kind of ['ActionSaved', 'DebtResolved'] as const) {
      const post: PostSaveReview = { kind: 'Ready', cards: [{ tradeId: 't-x', progress: answered }, { tradeId: 't-z', progress: answered }], progress: { tradesWithAction: 1, tradesEligible: 3 }, completion: OWING, nextStep: { kind: 'Done' }, binding: newBinding };

      const next = fold(before, { kind, review: post });

      expect(owedProgress(next.review)).toEqual([
        ['t-x', answered],
        ['t-y', reflectionsOwedProgress(2, 0)],
      ]);
      expect(tradeIds(next.review)).toEqual(['t-a', 't-f', 't-c']);
    }
  });
});

describe('standing (A172)', () => {
  const key =(instrumentKey: string, tradingDate: string) => ({ instrumentKey, tradingDate });

  it('should return a key resolution and revision from MarkSaved, and from each moved key of MarksConflict', () => {
    const corrected = available('50.00', 2);
    const moved = fold(held(), { kind: 'MarkSaved', key: key('XYZ', MONDAY), resolution: corrected, resolutionRevision: 2 });

    expect(standing(moved, key('XYZ', MONDAY))).toEqual({ resolution: corrected, revision: 2 });

    const conflicted = fold(held(), {
      kind: 'MarksConflict',
      moved: [
        { key: key('DEF', MONDAY), resolution: available('33.10'), resolutionRevision: 1 },
        { key: key('XYZ', FRIDAY), resolution: available('9'), resolutionRevision: 4 },
      ],
    });

    expect(standing(conflicted, key('DEF', MONDAY))).toEqual({ resolution: available('33.10'), revision: 1 });
    expect(standing(conflicted, key('XYZ', FRIDAY))).toEqual({ resolution: available('9'), revision: 4 });
  });

  it('should return a saved earlier session exact Mark from MarksSaved after the session has left its gap list', () => {
    const next = fold(held(), { kind: 'MarksSaved', marks: [saved('XYZ', FRIDAY, available('9'))], review: { kind: 'ChangedDuringAssembly' } });

    expect(marksFamily(next.review).earlier[0]!.missing).toEqual([]);
    expect(standing(next, key('XYZ', FRIDAY))).toEqual({ resolution: available('9'), revision: 1 });
    const read = fold(held(), { kind: 'MarksSaved', marks: [saved('XYZ', FRIDAY, available('9'))], review: postMarks({ completion: OWING, trades: [TA, TF, TC] }) });
    expect(standing(read, key('XYZ', FRIDAY))).toEqual({ resolution: available('9'), revision: 1 });
  });

  it('should keep the learned standing when a later Opened Review lists the key at a lower revision, and take the Review one when it lists the key at the same or a newer one', () => {
    const acknowledgment = { versionId: 'a1', kind: 'Asserted' as const, reason: 'no quote', savedAt: '2026-10-12T21:00:00Z' };
    const learned = fold(held(), { kind: 'MarksSaved', marks: [saved('XYZ', FRIDAY, available('9'))], review: { kind: 'ChangedDuringAssembly' } });
    // Opened again, the Review still lists the session as missing at revision None, older than the learned 1.
    const stale = fold(learned, { kind: 'Opened', review: review() });

    expect(standing(stale, key('XYZ', FRIDAY))).toEqual({ resolution: available('9'), revision: 1 });

    const listedAt = (revision: number) => review({ earlier: [{ ...xyzGap, missing: [], acknowledged: [FRIDAY], revisions: { [FRIDAY]: revision }, acknowledgments: { [FRIDAY]: acknowledgment } }] });
    const acknowledged = (revision: number): Standing => ({ resolution: { kind: 'AcknowledgedUnavailable', acknowledgment }, revision });

    expect(standing(fold(learned, { kind: 'Opened', review: listedAt(4) }), key('XYZ', FRIDAY))).toEqual(acknowledged(4));
    expect(standing(fold(learned, { kind: 'Opened', review: listedAt(1) }), key('XYZ', FRIDAY))).toEqual(acknowledged(1));
  });

  it('should keep a key learned standing when a later MarksConflict or MarksSaved reports it at a lower revision, and take the newer one at the same or a higher revision', () => {
    const at = (revision: number) => available(String(10 + revision), revision);
    const k = key('XYZ', MONDAY);
    const newer = fold(held(), { kind: 'MarkSaved', key: k, resolution: at(2), resolutionRevision: 2 });

    const lateConflict = fold(newer, { kind: 'MarksConflict', moved: [{ key: k, resolution: at(1), resolutionRevision: 1 }] });
    expect(standing(lateConflict, k)).toEqual({ resolution: at(2), revision: 2 });

    const lateSaved = fold(newer, { kind: 'MarksSaved', marks: [saved('XYZ', MONDAY, at(1), 1)], review: { kind: 'ChangedDuringAssembly' } });
    expect(standing(lateSaved, k)).toEqual({ resolution: at(2), revision: 2 });

    const same = fold(newer, { kind: 'MarksConflict', moved: [{ key: k, resolution: at(3), resolutionRevision: 2 }] });
    expect(standing(same, k)).toEqual({ resolution: at(3), revision: 2 });
    const higher = fold(newer, { kind: 'MarkSaved', key: k, resolution: at(3), resolutionRevision: 3 });
    expect(standing(higher, k)).toEqual({ resolution: at(3), revision: 3 });
  });
});

describe('nextCard (P50)', () => {
  const markStep = (instrumentKey: string, trades: readonly string[]): ReviewNextStep => ({ kind: 'Mark', row: missingRow(instrumentKey, trades) });

  it('should name the first card in the held order whose Trade is in a Mark step row, with the row Instrument', () => {
    // The row lists t-f before t-a, but T-A comes before T-F in the held attention order.
    expect(nextCard(held(), markStep('DEF', ['t-f', 't-a']))).toEqual({ kind: 'Mark', tradeId: 't-a', instrumentKey: 'DEF' });
  });

  it('should say no card holds a Mark step row when none of its Trades is held', () => {
    expect(nextCard(held(), markStep('DEF', ['t-zzz']))).toEqual({ kind: 'MarkNotHeld' });
  });

  it('should name the next step Trade, or Done', () => {
    const trade = { tradeId: 't-e', underlying: 'ABC' } as DailyTradeReview;

    expect(nextCard(held(), { kind: 'Trade', trade })).toEqual({ kind: 'Trade', trade });
    expect(nextCard(held(), { kind: 'Done' })).toEqual({ kind: 'Done' });
  });
});

describe('marksOf (A153)', () => {
  it('should list T-A XYZ row and Friday session, and T-F XYZ row with no Friday session', () => {
    const xyz = missingRow('XYZ', ['t-a', 't-f']);

    expect(marksOf(held(), 't-a')).toEqual({ today: [xyz], earlier: [xyzGap] });
    expect(marksOf(held(), 't-f')).toEqual({ today: [xyz], earlier: [] });
    expect(marksOf(held(), 't-c')).toEqual({ today: [missingRow('DEF', ['t-c'])], earlier: [] });
  });
});
