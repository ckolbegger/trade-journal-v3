// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { DailyTradeReview, ExpectedResolutionRevision, IncompleteReason, MarkRow, MarkResolution, MarketDataSaveResult, OpenDailyReviewResult, ReviewBinding, ReviewCompletion, ReviewTradeItem, SaveReviewMarksResult } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ReviewView } from './ReviewView.tsx';
import { cardProgress } from '../../../tests/support/card-progress.ts';

afterEach(cleanup);

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;

const CUTOFF = '2026-10-12T20:00:00Z';
const binding: ReviewBinding = {
  workspace: { databaseName: 'tj-ws-1', contentRevision: 3 },
  catalogRevision: 1,
  journalRevision: 1,
  marketDataSnapshotId: 'mds1:1:abc',
  factRevisions: {},
  outstandingDebts: {},
};
const available = (price: string): MarkResolution => ({
  kind: 'Available',
  mark: { revisionId: 'r1', revisionNumber: 1, price, source: 'Manual', savedAt: '2026-10-12T21:00:00Z' },
});
const markRow = (instrumentKey: string, trades: readonly string[], resolution: MarkResolution = { kind: 'Missing' }, resolutionRevision: MarkRow['resolutionRevision'] = 'None'): MarkRow => ({
  instrumentKey,
  tradingDate: '2026-10-12',
  trades,
  resolution,
  resolutionRevision,
  task: resolution.kind === 'Missing' ? 'Manual' : null,
});
const tradeItem = (tradeId: string, underlying: string, over: Partial<ReviewTradeItem> = {}): ReviewTradeItem => ({
  tradeId,
  underlying,
  lastActivity: '2026-10-12T14:00:00Z',
  band: 'Routine',
  reasons: [{ code: 'NoPressure' }],
  basis: { kind: 'Comparable', side: 'None', share: Rational.of(0n, 1n) },
  rangePosition: { kind: 'Placed', now: Rational.of(1n, 2n), atEntry: Rational.of(1n, 2n) },
  ...over,
});
type Earlier = Extract<Ready['families'][number], { family: 'Marks' }>['earlier'];
function ready(over: { today?: readonly MarkRow[]; earlier?: Earlier; trades?: readonly ReviewTradeItem[]; completion?: ReviewCompletion; reviewDate?: string } = {}): Ready {
  return {
    kind: 'Ready',
    reviewDate: over.reviewDate ?? '2026-10-12',
    cutoff: CUTOFF,
    families: [
      { family: 'Marks', today: over.today ?? [], earlier: over.earlier ?? [] },
      { family: 'Trades', trades: (over.trades ?? []).map((t) => ({ ...t, progress: cardProgress() })) },
    ],
    completion: over.completion ?? { kind: 'Complete' },
    binding,
  };
}
const incomplete = (...reasons: IncompleteReason[]): ReviewCompletion => ({ kind: 'Incomplete', reasons });
const markMissing = (instrumentKey: string, ...trades: string[]): IncompleteReason => ({ code: 'MarkMissing', instrumentKey, tradingDate: '2026-10-12', trades });
const actionMissing = (...ids: string[]): IncompleteReason[] => ids.map((tradeId) => ({ code: 'ActionMissing', tradeId }));
// An Instrument's earlier sessions without Marks, relevant to the Trades named from the first date.
const gap = (instrumentKey: string, over: Partial<Earlier[number]> = {}): Earlier[number] => ({
  instrumentKey,
  trades: [{ tradeId: 't1', from: '2026-09-01' }],
  missing: [],
  acknowledged: [],
  revisions: {},
  acknowledgments: {},
  blocking: false,
  ...over,
});

// A Trade as getTrade returns it: only what the card shows of it matters to these cases.
function tradeFor(tradeId: string, underlying: string, reviewDate: string): DailyTradeReview {
  return {
    tradeId,
    underlying,
    attention: tradeItem(tradeId, underlying),
    labels: { strategy: 'Long Stock', account: 'Main', institution: 'Broker' },
    reflections: [],
    progress: cardProgress(),
    form: { kind: 'New', viewState: { selectedAction: 'Hold' } },
    definitionRevision: 'def1',
    saveBinding: {
      reviewDate,
      tradeId,
      factRevision: 1,
      marketDataSnapshotId: 'mds1:1:abc',
      obligationKey: { entryType: 'DailyTradeReview', trade: tradeId, reviewDate },
      definitionRevision: 'def1',
      databaseName: 'tj-ws-1',
    },
  };
}

function renderReview(facade: UiFacade, options: { writable?: boolean; onDirtyChange?: (dirty: boolean) => void } = {}) {
  render(
    <RuntimeContext.Provider value={{ writable: options.writable ?? true, report: () => undefined }}>
      <MemoryRouter initialEntries={['/review']}>
        <ReviewView facade={facade} now={() => '2026-10-12T21:00:00Z'} onDirtyChange={options.onDirtyChange ?? (() => undefined)} />
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}
function reviewFacade(...results: OpenDailyReviewResult[]): UiFacade {
  const facade = facadeDouble();
  const open = vi.mocked(facade.DailyReview.open);
  for (const result of results.slice(0, -1)) open.mockResolvedValueOnce(result);
  open.mockResolvedValue(results[results.length - 1]!);
  const names = new Map(results.flatMap((r) => (r.kind === 'Ready' ? r.families.flatMap((f) => (f.family === 'Trades' ? f.trades.map((t) => [t.tradeId, t.underlying] as const) : [])) : [])));
  vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ reviewDate, tradeId }) => Promise.resolve({ kind: 'Ready', reviewDate, cutoff: CUTOFF, trade: tradeFor(tradeId, names.get(tradeId) ?? tradeId, reviewDate) }));
  return facade;
}
// A Mark save result for the key, as MarkEntry renders it.
const savedMark = (instrumentKey: string, tradingDate: string, price: string): MarketDataSaveResult => {
  const key = { instrumentKey, tradingDate };
  const mark = { revisionId: 'r9', revisionNumber: 1, price, source: 'Manual', savedAt: '2026-10-12T21:00:00Z' } as const;
  return {
    kind: 'Saved',
    key,
    resolution: { kind: 'Available', mark },
    resolutionRevision: 1,
    classification: 'InitialManual',
    revision: { ...mark, intention: 'InitialManual', observedAt: '2026-10-12T21:00:00Z' },
    binding: { ...key, expectedResolutionRevision: 'None' },
  };
};
// What Save Marks answers when the Marks were written but the Review under them could not be read.
const savedButNotRead = (instrumentKey: string, tradingDate: string, price: string): SaveReviewMarksResult => ({
  kind: 'MarksSaved',
  marks: [{ key: { instrumentKey, tradingDate }, resolution: available(price), resolutionRevision: 1, classification: 'InitialManual' }],
  review: { kind: 'ChangedDuringAssembly' },
});
// Opens the open card's Marks panel by its header, unless it is already open (A152).
async function openMarks(user: ReturnType<typeof userEvent.setup>) {
  const header = await screen.findByRole('button', { name: /^Marks\b/ });
  if (header.getAttribute('aria-expanded') !== 'true') await user.click(header);
}
// Corrects the row's Mark and saves it: the per-row save, which refreshes the Review.
async function correctPrice(user: ReturnType<typeof userEvent.setup>, entry: HTMLElement, price: string) {
  await user.click(within(entry).getByRole('button', { name: 'Correct' }));
  await user.type(within(entry).getByLabelText('Price'), price);
  await user.type(within(entry).getByLabelText('Reason (required)'), 'typo');
  await user.click(within(entry).getByRole('button', { name: 'Save correction' }));
}

describe('overview', () => {
  it('should show the Review Date, completion as text, and each blocker', async () => {
    const trades = [tradeItem('t1', 'XYZ'), tradeItem('t2', 'DEF')];
    const facade = reviewFacade(
      ready({
        today: [markRow('DEF', ['t2'])],
        trades,
        completion: incomplete({ code: 'MarkMissing', instrumentKey: 'DEF', tradingDate: '2026-10-12', trades: ['t2'] }, { code: 'ActionMissing', tradeId: 't1' }, { code: 'IntegrityDisagreement', tradeId: 't2', findings: [] }),
      }),
    );
    renderReview(facade);

    expect(await screen.findByText('Mon Oct 12')).toBeTruthy();
    expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledExactlyOnceWith({ date: { kind: 'LatestCompleted' }, asOf: '2026-10-12T21:00:00Z' });
    const header = screen.getByRole('region', { name: 'Review status' });
    expect(within(header).getByText('Incomplete')).toBeTruthy();
    const blockers = within(within(header).getByRole('list', { name: 'Blockers' })).getAllByRole('listitem');
    expect(blockers.map((b) => b.textContent)).toEqual([
      'Mark missing for DEF on Mon Oct 12',
      'Action missing for XYZ',
      'DEF: recorded facts disagree',
    ]);
  });

  it('should name the due reflections by Trade among the blockers while completion is Incomplete, each linking to its Trade card', async () => {
    const trades = [tradeItem('t1', 'XYZ'), tradeItem('t2', 'DEF')];
    const facade = reviewFacade(
      ready({
        trades,
        completion: incomplete({ code: 'ReflectionDue', tradeId: 't1', debtIds: ['d1', 'd2'] }, { code: 'ReflectionDue', tradeId: 't2', debtIds: ['d3'] }),
      }),
    );
    renderReview(facade);

    const header = await screen.findByRole('region', { name: 'Review status' });
    const blockers = within(within(header).getByRole('list', { name: 'Blockers' })).getAllByRole('listitem');
    expect(blockers.map((b) => b.textContent)).toEqual(['2 reflections due for XYZ', 'Reflection due for DEF']);
    // The first Trade owing opens on load; the link for the other one opens its card.
    await screen.findByRole('region', { name: 'XYZ review' });
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenCalledExactlyOnceWith({ reviewDate: '2026-10-12', tradeId: 't1', binding });

    await userEvent.setup().click(within(blockers[1]!).getByRole('link', { name: 'DEF' }));

    expect(await screen.findByRole('region', { name: 'DEF review' })).toBeTruthy();
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenLastCalledWith({ reviewDate: '2026-10-12', tradeId: 't2', binding });
  });

  it('should show Complete as text with no blockers when every obligation is resolved', async () => {
    renderReview(reviewFacade(ready({ trades: [tradeItem('t1', 'XYZ')], completion: { kind: 'Complete' } })));

    const header = await screen.findByRole('region', { name: 'Review status' });
    expect(within(header).getByText('Complete')).toBeTruthy();
    expect(within(header).queryByRole('list', { name: 'Blockers' })).toBeNull();
  });

  it('should render distinct Loading, Ready, Empty, and Error states with Retry', async () => {
    const facade = facadeDouble();
    const open = vi.mocked(facade.DailyReview.open);
    let settle: (result: OpenDailyReviewResult) => void = () => undefined;
    open.mockReturnValueOnce(new Promise((resolve) => (settle = resolve)));
    renderReview(facade);

    // Loading: neither a false Empty nor a Review status.
    expect(screen.getByRole('status').textContent).toBe('Loading the Review…');
    expect(screen.queryByText("No Trades were open at this session's close")).toBeNull();
    expect(screen.queryByRole('region', { name: 'Review status' })).toBeNull();

    settle({ kind: 'Empty', reviewDate: '2026-10-12', cutoff: CUTOFF });
    expect(await screen.findByText("No Trades were open at this session's close")).toBeTruthy();
    expect(screen.getByText('Mon Oct 12')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    cleanup();

    // Error: a failed read and a refused read each offer Retry, and Retry asks again.
    const failing = facadeDouble();
    vi.mocked(failing.DailyReview.open).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ kind: 'ChangedDuringAssembly' }).mockResolvedValue(ready({ completion: { kind: 'Complete' } }));
    renderReview(failing);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(screen.getByText(/couldn’t load the Review/)).toBeTruthy();
    expect(screen.queryByText("No Trades were open at this session's close")).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('region', { name: 'Review status' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(vi.mocked(failing.DailyReview.open)).toHaveBeenCalledTimes(3);
  });

  it('should name the Instruments, Trades, and calculation families when completion is Complete with Unavailable Marks', async () => {
    renderReview(
      reviewFacade(
        ready({
          trades: [tradeItem('t1', 'XYZ'), tradeItem('t2', 'ABC'), tradeItem('t3', 'DEF')],
          completion: { kind: 'CompleteWithUnavailableMarks', instruments: ['XYZ', 'DEF'], trades: ['t1', 't3'], families: ['Valuation', 'Risk', 'Reward', 'ConditionStatus'] },
        }),
      ),
    );

    const header = await screen.findByRole('region', { name: 'Review status' });
    expect(within(header).getByText('Complete with Unavailable Marks')).toBeTruthy();
    const disclosure = within(header).getByRole('group', { name: 'Unavailable Marks' });
    expect(within(disclosure).getByText('Instruments: XYZ, DEF')).toBeTruthy();
    expect(within(disclosure).getByText('Trades: XYZ, DEF')).toBeTruthy();
    expect(within(disclosure).getByText('Not calculated: Valuation, Risk, Reward, Condition status')).toBeTruthy();
  });
});

describe('Marks in the card (P11, P15)', () => {
  it('should list the Review-date rows that name the card Trade, each shared Instrument with its Trades, using MarkEntry', async () => {
    const facade = reviewFacade(
      ready({
        today: [markRow('DEF', ['t3']), markRow('XYZ', ['t1', 't2'], available('52'), 3)],
        trades: [tradeItem('t1', 'XYZ'), tradeItem('t2', 'XYZ'), tradeItem('t3', 'DEF')],
        completion: incomplete(markMissing('DEF', 't3'), ...actionMissing('t1', 't2', 't3')),
      }),
    );
    vi.mocked(facade.MarketData.save).mockResolvedValue({ kind: 'Conflict', key: { instrumentKey: 'XYZ', tradingDate: '2026-10-12' }, resolution: available('52'), resolutionRevision: 3 });
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Conflict' });
    renderReview(facade);
    const user = userEvent.setup();

    // The first card holds the shared Instrument alone, naming both Trades that hold it.
    await openMarks(user);
    const marks =await within(await screen.findByRole('region', { name: 'XYZ review' })).findByRole('region', { name: 'Marks' });
    const rows = within(within(marks).getByRole('list', { name: "Today's Marks" })).getAllByRole('listitem');
    expect(rows.map((row) => within(row).getByRole('heading', { level: 4 }).textContent)).toEqual(['XYZ']);
    expect(within(rows[0]!).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/trades/t2']);
    // Its row is a MarkEntry bound to the key's revision.
    await user.click(within(rows[0]!).getByRole('button', { name: 'Correct' }));
    await user.type(within(rows[0]!).getByLabelText('Price'), '51.5');
    await user.type(within(rows[0]!).getByLabelText('Reason (required)'), 'typo');
    await user.click(within(rows[0]!).getByRole('button', { name: 'Save correction' }));
    expect(facade.MarketData.save).toHaveBeenLastCalledWith({ intention: 'CorrectMark', instrumentKey: 'XYZ', tradingDate: '2026-10-12', price: '51.5', reason: 'typo', expectedResolutionRevision: 3 });

    // The Conflict keeps the typed values, which hold the card; cancelling them lets it be left.
    await user.click(within(rows[0]!).getByRole('button', { name: 'Cancel' }));
    // The third card holds the other Instrument and not the shared one.
    await user.click(screen.getByRole('button', { name: /^Review DEF\b/ }));
    const other = await screen.findByRole('region', { name: 'DEF review' });
    const otherRows = within(within(other).getByRole('list', { name: "Today's Marks" })).getAllByRole('listitem');
    expect(otherRows.map((row) => within(row).getByRole('heading', { level: 4 }).textContent)).toEqual(['DEF']);
    // Held by this card's Trade alone, it names no other Trade.
    expect(within(otherRows[0]!).queryByRole('link')).toBeNull();
    await user.type(within(otherRows[0]!).getByLabelText('Price'), '12');
    await user.click(screen.getByRole('button', { name: 'Save Marks (1)' }));
    expect(facade.DailyReview.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'SaveReviewMarks', tradeId: 't3', entries: [{ key: { instrumentKey: 'DEF', tradingDate: '2026-10-12' }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '12' } }] }),
    );
  });

  it('should list a card Earlier sessions without Marks as optional per Instrument from the date the Trade is relevant, newest first, 20 per page, and say they do not block the Review', async () => {
    // MNO: Missing Sep 1 to Sep 25 except Sep 10, which was acknowledged unavailable.
    const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}`;
    const missing = Array.from({ length: 25 }, (_, i) => day(i + 1)).filter((d) => d !== day(10));
    const revisions: Record<string, ExpectedResolutionRevision> = Object.fromEntries([...missing, day(10)].map((d) => [d, d === day(24) ? 4 : d === day(10) ? 1 : 'None']));
    const acknowledgments = { [day(10)]: { versionId: 'a1', kind: 'Asserted', reason: 'no quote', savedAt: '2026-09-11T21:00:00Z' } } as const;
    const facade = reviewFacade(
      ready({
        today: [markRow('MNO', ['t1'])],
        trades: [tradeItem('t1', 'MNO')],
        earlier: [
          // A session before the date the Trade is relevant from (2026-09-01) is not this card's.
          gap('MNO', { missing: [...missing, '2026-08-20'], acknowledged: [day(10)], revisions, acknowledgments }),
          gap('ABC', { missing: ['2026-09-30'], revisions: { '2026-09-30': 'None' } }),
          // Another Trade's Instrument is not this card's.
          gap('OTHER', { trades: [{ tradeId: 't9', from: '2026-09-01' }], missing: ['2026-09-30'], revisions: { '2026-09-30': 'None' } }),
        ],
        completion: incomplete(markMissing('MNO', 't1'), ...actionMissing('t1')),
      }),
    );
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Conflict' });
    renderReview(facade);
    const user = userEvent.setup();

    const marks = await screen.findByRole('region', { name: 'Marks' });
    // Today's tasks come first; the optional group follows them.
    const headings = within(marks).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Today's Marks", 'Earlier sessions without Marks — optional']);
    const group = within(marks).getByRole('group', { name: 'Earlier sessions without Marks — optional' });
    expect(within(group).getByText(/do not block the Review/)).toBeTruthy();
    expect(within(group).queryByRole('region', { name: 'OTHER earlier sessions' })).toBeNull();

    const mno = within(group).getByRole('region', { name: 'MNO earlier sessions' });
    const page1 = within(mno).getAllByRole('listitem');
    expect(page1).toHaveLength(20);
    expect(within(page1[0]!).getByText('Fri Sep 25')).toBeTruthy();
    expect(within(page1[19]!).getByText('Sun Sep 6')).toBeTruthy();
    // The acknowledged session is listed in order among the others.
    const acknowledged = page1.find((row) => within(row).queryByText('Thu Sep 10'));
    expect(within(acknowledged!).getByText(/Acknowledged Unavailable/)).toBeTruthy();
    // ABC has its own single-row list, so it has no pager.
    expect(within(within(group).getByRole('region', { name: 'ABC earlier sessions' })).queryByRole('button', { name: 'Next page' })).toBeNull();

    // Each row's draft is bound to its own date and revision.
    await user.type(within(page1[1]!).getByLabelText('Price'), '9');
    await user.click(screen.getByRole('button', { name: 'Save Marks (1)' }));
    expect(facade.DailyReview.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ entries: [{ key: { instrumentKey: 'MNO', tradingDate: day(24) }, expectedRevision: 4, intention: { kind: 'RecordInitialManualMark', price: '9' } }] }),
    );

    // The refused save keeps the draft, which holds paging; clear it so the pager is free.
    await user.clear(within(page1[1]!).getByLabelText('Price'));
    expect(within(mno).getByText('Sessions 1 to 20 of 25')).toBeTruthy();
    expect(within(mno).queryByRole('button', { name: 'Previous page' })).toBeNull();
    await user.click(within(mno).getByRole('button', { name: 'Next page' }));
    const page2 = within(mno).getAllByRole('listitem');
    expect(page2).toHaveLength(5);
    expect(within(page2[0]!).getByText('Sat Sep 5')).toBeTruthy();
    expect(within(mno).getByText('Sessions 21 to 25 of 25')).toBeTruthy();
    expect(within(mno).queryByRole('button', { name: 'Next page' })).toBeNull();
    await user.click(within(mno).getByRole('button', { name: 'Previous page' }));
    expect(within(mno).getAllByRole('listitem')).toHaveLength(20);
  });

  it('should not page away from earlier sessions while a Mark on the page holds an unsaved value', async () => {
    const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}`;
    const missing = Array.from({ length: 25 }, (_, i) => day(i + 1));
    const facade = reviewFacade(
      ready({
        today: [markRow('MNO', ['t1'])],
        trades: [tradeItem('t1', 'MNO')],
        earlier: [gap('MNO', { missing, revisions: Object.fromEntries(missing.map((d) => [d, 'None'])) })],
        completion: incomplete(markMissing('MNO', 't1'), ...actionMissing('t1')),
      }),
    );
    renderReview(facade);
    const user = userEvent.setup();
    const mno = await screen.findByRole('region', { name: 'MNO earlier sessions' });
    const row = within(mno).getAllByRole('listitem')[2]!;
    await user.type(within(row).getByLabelText('Price'), '9');

    const next = within(mno).getByRole('button', { name: 'Next page' });
    expect((next as HTMLButtonElement).disabled).toBe(true);
    expect(next.getAttribute('aria-describedby')).toBeTruthy();
    expect(within(mno).getByText(/Save or clear the value/)).toBeTruthy();
    await user.click(next);
    expect(within(mno).getByText('Sessions 1 to 20 of 25')).toBeTruthy();

    await user.clear(within(row).getByLabelText('Price'));
    expect(within(mno).getByRole<HTMLButtonElement>('button', { name: 'Next page' }).disabled).toBe(false);
    expect(within(mno).queryByText(/Save or clear the value/)).toBeNull();
    await user.click(within(mno).getByRole('button', { name: 'Next page' }));
    expect(within(mno).getByText('Sessions 21 to 25 of 25')).toBeTruthy();
  });

  it('should offer a price on an acknowledged earlier-session date, drafted under that date revision, without Withdraw', async () => {
    const acknowledgment = { versionId: 'a1', kind: 'Asserted', reason: 'no quote', savedAt: '2026-10-10T21:00:00Z' } as const;
    const facade = reviewFacade(
      ready({
        today: [markRow('DEF', ['t1'], available('12'), 1)],
        trades: [tradeItem('t1', 'DEF')],
        earlier: [gap('DEF', { acknowledged: ['2026-10-09'], revisions: { '2026-10-09': 2 }, acknowledgments: { '2026-10-09': acknowledgment } })],
        completion: incomplete(...actionMissing('t1')),
      }),
    );
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Conflict' });
    renderReview(facade);
    const user = userEvent.setup();

    await openMarks(user);
    const row = within(await screen.findByRole('region', { name: 'DEF earlier sessions' })).getByRole('listitem');
    expect(within(row).getByText(/no quote/)).toBeTruthy();
    expect(within(row).queryByRole('button', { name: 'Withdraw' })).toBeNull();
    // An acknowledged date can take a price, but not another acknowledgment.
    expect(within(row).queryByRole('button', { name: "Can't get a price" })).toBeNull();
    await user.type(within(row).getByLabelText('Price'), '9.5');
    await user.click(screen.getByRole('button', { name: 'Save Marks (1)' }));
    expect(facade.DailyReview.save).toHaveBeenCalledWith(
      expect.objectContaining({ entries: [{ key: { instrumentKey: 'DEF', tradingDate: '2026-10-09' }, expectedRevision: 2, intention: { kind: 'RecordInitialManualMark', price: '9.5' } }] }),
    );
  });

  it('should keep a value typed into a Mark entry when the Review read again after a save brings that key a newer revision', async () => {
    const trades = [tradeItem('t1', 'DEF')];
    const first = ready({ today: [markRow('DEF', ['t1']), markRow('XYZ', ['t1'], available('52'), 1)], trades, completion: incomplete(markMissing('DEF', 't1'), ...actionMissing('t1')) });
    // The refreshed key is acknowledged unavailable, so the typed price still fits it.
    const acknowledged: MarkResolution = { kind: 'AcknowledgedUnavailable', acknowledgment: { versionId: 'a1', kind: 'Asserted', savedAt: '2026-10-12T21:00:00Z' } };
    const second = ready({ today: [markRow('DEF', ['t1'], acknowledged, 1), markRow('XYZ', ['t1'], available('52'), 1)], trades, completion: incomplete(...actionMissing('t1')) });
    const facade = reviewFacade(first, second);
    vi.mocked(facade.MarketData.save).mockResolvedValue(savedMark('XYZ', '2026-10-12', '52'));
    renderReview(facade);
    const user = userEvent.setup();
    const def = await screen.findByRole('region', { name: 'DEF Mark, Mon Oct 12' });
    await user.type(within(def).getByLabelText('Price'), '12.5');

    await correctPrice(user, screen.getByRole('region', { name: 'XYZ Mark, Mon Oct 12' }), '52');
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'DEF Mark, Mon Oct 12' })).getByText(/Acknowledged Unavailable/)).toBeTruthy());

    expect(within(screen.getByRole('region', { name: 'DEF Mark, Mon Oct 12' })).getByLabelText<HTMLInputElement>('Price').value).toBe('12.5');
  });

  it('should keep an earlier session listed with its saved Mark while the card stays open, although the Review read again no longer lists it', async () => {
    const trades = [tradeItem('t1', 'DEF')];
    const first = ready({ today: [markRow('DEF', ['t1'], available('12'), 1)], earlier: [gap('DEF', { missing: ['2026-10-09'], revisions: { '2026-10-09': 'None' } })], trades, completion: incomplete(...actionMissing('t1')) });
    // Read again, the filled session is no longer a gap.
    const second = ready({ today: [markRow('DEF', ['t1'], available('12'), 1)], earlier: [], trades, completion: incomplete(...actionMissing('t1')) });
    const facade = reviewFacade(first, second);
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce(savedButNotRead('DEF', '2026-10-09', '9'));
    renderReview(facade);
    const user = userEvent.setup();
    await openMarks(user);
    await user.type(within(await screen.findByRole('region', { name: 'DEF Mark, Fri Oct 9' })).getByLabelText('Price'), '9');
    await user.click(screen.getByRole('button', { name: 'Save Marks (1)' }));
    await user.click(await screen.findByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(2));

    expect(within(screen.getByRole('region', { name: 'DEF Mark, Fri Oct 9' })).getByText('$9.00', { exact: false })).toBeTruthy();
  });

  it('should resume from the returned state after a reload, showing saved Actions and Marks without any stored session', async () => {
    const stored = vi.spyOn(Storage.prototype, 'setItem');
    const read = vi.spyOn(Storage.prototype, 'getItem');
    const returned = ready({
      today: [markRow('XYZ', ['t1'], available('52'), 1), markRow('DEF', ['t2'])],
      trades: [tradeItem('t1', 'XYZ'), tradeItem('t2', 'DEF')],
      completion: incomplete({ code: 'MarkMissing', instrumentKey: 'DEF', tradingDate: '2026-10-12', trades: ['t2'] }, { code: 'ActionMissing', tradeId: 't2' }),
    });
    const facade = reviewFacade(returned);
    renderReview(facade);
    const user = userEvent.setup();

    // The first card that is not Done opens; its Mark is the returned one.
    expect(within(await screen.findByRole('region', { name: 'DEF Mark, Mon Oct 12' })).getByText('Missing')).toBeTruthy();
    const headers = screen.getAllByRole('button', { name: /^Review / });
    expect(headers[0]!.textContent).toContain('Done · Action saved');
    expect(headers[1]!.textContent).toContain('1 Mark · Action');
    // The saved Mark comes from the returned state alone.
    await user.click(headers[0]!);
    await openMarks(user);
    const xyz =await screen.findByRole('region', { name: 'XYZ Mark, Mon Oct 12' });
    expect(within(xyz).getByText('$52.00', { exact: false })).toBeTruthy();
    // No Review session, stage, or progress is kept in the browser.
    expect(stored).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    stored.mockRestore();
    read.mockRestore();
  });

  it('should show a fresh entry for an Instrument whose Review Date changed when the Review is read again', async () => {
    const trades = [tradeItem('t1', 'DEF')];
    const monday = ready({ today: [markRow('DEF', ['t1']), markRow('XYZ', ['t1'], available('52'), 1)], trades, completion: incomplete(markMissing('DEF', 't1'), ...actionMissing('t1')) });
    const tuesday: Ready = {
      ...ready({ today: [{ ...markRow('DEF', ['t1']), tradingDate: '2026-10-13' }], trades, completion: incomplete({ code: 'MarkMissing', instrumentKey: 'DEF', tradingDate: '2026-10-13', trades: ['t1'] }, ...actionMissing('t1')) }),
      reviewDate: '2026-10-13',
    };
    const facade = reviewFacade(monday, tuesday);
    vi.mocked(facade.MarketData.save).mockResolvedValue(savedMark('XYZ', '2026-10-12', '52'));
    renderReview(facade);
    const user = userEvent.setup();
    const def = await screen.findByRole('region', { name: 'DEF Mark, Mon Oct 12' });
    await user.type(within(def).getByLabelText('Price'), '12');

    await correctPrice(user, screen.getByRole('region', { name: 'XYZ Mark, Mon Oct 12' }), '52');
    await screen.findByRole('region', { name: 'DEF Mark, Tue Oct 13' });

    // The Monday draft, with its typed price, is gone; Tuesday's key starts empty and Unsaved is not shown.
    expect(screen.getByText('Tue Oct 13', { selector: 'time' })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Price').value).toBe('');
    expect(screen.queryByText('Unsaved')).toBeNull();
  });

  it('should name each Mark entry region by Instrument and date', async () => {
    const facade = reviewFacade(
      ready({
        today: [markRow('DEF', ['t1'])],
        earlier: [gap('DEF', { missing: ['2026-10-09'], revisions: { '2026-10-09': 'None' } })],
        trades: [tradeItem('t1', 'DEF')],
        completion: incomplete(markMissing('DEF', 't1'), ...actionMissing('t1')),
      }),
    );
    renderReview(facade);
    await screen.findByRole('region', { name: 'DEF Mark, Mon Oct 12' });
    expect(screen.getByRole('region', { name: 'DEF Mark, Fri Oct 9' })).toBeTruthy();
  });

  it('should register as unsaved while any draft Mark holds a value, today or earlier, and clear when they are discarded', async () => {
    const dirty = vi.fn<(dirty: boolean) => void>();
    const facade = reviewFacade(
      ready({
        today: [markRow('DEF', ['t1'])],
        earlier: [gap('DEF', { missing: ['2026-10-09'], revisions: { '2026-10-09': 'None' } })],
        trades: [tradeItem('t1', 'DEF')],
        completion: incomplete(markMissing('DEF', 't1'), ...actionMissing('t1')),
      }),
    );
    renderReview(facade, { onDirtyChange: dirty });
    const user = userEvent.setup();
    const todayEntry = await screen.findByRole('region', { name: 'DEF Mark, Mon Oct 12' });
    const earlierEntry = screen.getByRole('region', { name: 'DEF Mark, Fri Oct 9' });
    expect(dirty).not.toHaveBeenCalledWith(true);

    await user.type(within(todayEntry).getByLabelText('Price'), '1');
    expect(dirty).toHaveBeenLastCalledWith(true);
    await user.type(within(earlierEntry).getByLabelText('Price'), '2');
    await user.clear(within(todayEntry).getByLabelText('Price'));
    // One draft still holds a value.
    expect(dirty).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(dirty).toHaveBeenLastCalledWith(false);
  });

  it('should offer no Mark entry controls while the runtime is not writable', async () => {
    const facade = reviewFacade(
      ready({
        today: [markRow('DEF', ['t1']), markRow('XYZ', ['t2'], available('52'), 1)],
        earlier: [gap('DEF', { missing: ['2026-10-09'], revisions: { '2026-10-09': 'None' } })],
        trades: [tradeItem('t1', 'DEF'), tradeItem('t2', 'XYZ')],
        completion: incomplete(markMissing('DEF', 't1'), ...actionMissing('t1', 't2')),
      }),
    );
    renderReview(facade, { writable: false });

    const marks = await screen.findByRole('region', { name: 'Marks' });
    expect(within(marks).getAllByText('Missing')).toHaveLength(2);
    for (const name of ['Enter', "Can't get a price", 'Correct', 'Withdraw']) expect(within(marks).queryByRole('button', { name })).toBeNull();
    expect(facade.MarketData.save).not.toHaveBeenCalled();
  });

  it('should keep the Marks and say the Review could not be refreshed when the Review read after a save fails, then clear it once a refresh succeeds', async () => {
    const trades = [tradeItem('t1', 'XYZ')];
    const first = ready({ today: [markRow('DEF', ['t1'], available('1'), 1), markRow('XYZ', ['t1'], available('1'), 1), markRow('GHI', ['t1'], available('1'), 1)], trades, completion: incomplete(...actionMissing('t1')) });
    const facade = reviewFacade(first);
    vi.mocked(facade.DailyReview.open).mockResolvedValueOnce(first).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ kind: 'ChangedDuringAssembly' }).mockResolvedValue(first);
    vi.mocked(facade.MarketData.save).mockImplementation((command) => Promise.resolve(savedMark(command.instrumentKey, command.tradingDate, '1')));
    renderReview(facade);
    const user = userEvent.setup();

    await openMarks(user);
    await correctPrice(user, await screen.findByRole('region', { name: 'DEF Mark, Mon Oct 12' }), '2');
    expect((await screen.findByRole('alert')).textContent).toContain('We couldn’t refresh the Review. Nothing was changed.');
    expect(screen.getByRole('region', { name: 'XYZ Mark, Mon Oct 12' })).toBeTruthy();

    // A refused refresh says the same, and the next save's succeeds.
    await correctPrice(user, screen.getByRole('region', { name: 'XYZ Mark, Mon Oct 12' }), '2');
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(3));
    expect(screen.getByRole('alert').textContent).toContain('We couldn’t refresh the Review.');
    await correctPrice(user, screen.getByRole('region', { name: 'GHI Mark, Mon Oct 12' }), '2');
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(facade.DailyReview.open).toHaveBeenCalledTimes(4);
  });
});
