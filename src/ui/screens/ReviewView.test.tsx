// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { DailyTradeReview, ExpectedResolutionRevision, IncompleteReason, MarkRow, MarkResolution, MarketDataSaveResult, OpenDailyReviewResult, OwedReflectionsCard, OwedReflectionsTrade, ReviewBinding, ReviewCompletion, ReviewTradeItem, SaveReviewMarksResult } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ReviewView } from './ReviewView.tsx';
import { cardProgress, reflectionsOwedProgress } from '../../../tests/support/card-progress.ts';
import { dayOf } from '../../../tests/support/review-day.ts';

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
  instrument: { kind: 'Stock', symbol: instrumentKey },
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
  basis: { kind: 'Value', value: { side: 'None', share: Rational.of(0n, 1n) } },
  ...over,
});
type Earlier = Extract<Ready['families'][number], { family: 'Marks' }>['earlier'];
const progressFor = (rows: readonly MarkRow[], dueNow: number, owed: boolean) => {
  const needed = rows.filter((row) => row.resolution.kind === 'Missing').length;
  return cardProgress(dueNow, 0, { needed, resolved: rows.length - needed, owed });
};
type EarlierMarksFamily = Extract<Ready['families'][number], { family: 'Marks' }>['earlierMarks'];
// The previous session's saved Marks of the Instruments named: what a per-row Correct fixes, since a Review Date Mark is fixed in place (T95.14).
const fridayMarks = (...symbols: string[]): EarlierMarksFamily =>
  symbols.map((instrumentKey) => ({ instrumentKey, instrument: { kind: 'Stock', symbol: instrumentKey }, trades: [{ tradeId: 't1', from: '2026-10-09' }], marks: { '2026-10-09': { resolution: { kind: 'Available', mark: { revisionId: 'f1', revisionNumber: 1, price: '1', source: 'Manual', savedAt: '2026-10-09T21:00:00Z' } }, resolutionRevision: 1 } } }));
function ready(over: { today?: readonly MarkRow[]; earlier?: Earlier; earlierMarks?: EarlierMarksFamily; trades?: readonly ReviewTradeItem[]; completion?: ReviewCompletion; reviewDate?: string } = {}): Ready {
  const completion = over.completion ?? { kind: 'Complete' };
  const reasons = completion.kind === 'Incomplete' ? completion.reasons : [];
  const built: Omit<Ready, 'day'> = {
    kind: 'Ready',
    reviewDate: over.reviewDate ?? '2026-10-12',
    cutoff: CUTOFF,
    families: [
      { family: 'Marks', earlierMarks: over.earlierMarks ?? [], ...(over.earlierMarks && { previousSession: '2026-10-09' }), today: over.today ?? [], earlier: over.earlier ?? [] },
      // The double's progress follows its Review-date rows and its completion reasons (D5R2 section 6.3): a row without a Mark is
      // needed, one with a Mark resolved; a reflection reason is due now, and the Action is owed while the completion names it.
      {
        family: 'Trades',
        trades: (over.trades ?? []).map((t) => ({
          ...t,
          progress: progressFor(
            (over.today ?? []).filter((row) => row.trades.includes(t.tradeId)),
            reasons.flatMap((r) => (r.code === 'ReflectionDue' && r.tradeId === t.tradeId ? r.debtIds : [])).length,
            reasons.some((r) => r.code === 'ActionMissing' && r.tradeId === t.tradeId),
          ),
        })),
      },
    ],
    owed: [],
    completion,
    binding,
  };
  return { ...built, day: dayOf(built) };
}
const incomplete = (...reasons: IncompleteReason[]): ReviewCompletion => ({ kind: 'Incomplete', reasons });
const markMissing = (instrumentKey: string, ...trades: string[]): IncompleteReason => ({ code: 'MarkMissing', instrument: { kind: 'Stock', symbol: instrumentKey }, tradingDate: '2026-10-12', trades });
const actionMissing = (...ids: string[]): IncompleteReason[] => ids.map((tradeId) => ({ code: 'ActionMissing', tradeId }));
// An Instrument's earlier sessions without Marks, relevant to the Trades named from the first date.
const gap = (instrumentKey: string, over: Partial<Earlier[number]> = {}): Earlier[number] => ({
  instrumentKey,
  instrument: { kind: 'Stock', symbol: instrumentKey },
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
    lifecycle: 'Open',
    attention: tradeItem(tradeId, underlying),
    labels: { strategy: 'Long Stock', account: 'Main', institution: 'Broker' },
    settlement: [],
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
// The Marks step is the page's, so there is no panel to open: it waits for the step to be there.
async function openMarks() {
  await screen.findByRole('region', { name: /^Marks for / });
}
// Choosing a cell (focusing its input, or pressing its button) opens its editor, a region named after it.
async function chooseCell(user: ReturnType<typeof userEvent.setup>, name: string) {
  const cell = await waitFor(() => {
    const found = screen.queryByRole('textbox', { name }) ?? screen.queryByRole('button', { name });
    if (!found) throw new Error(`no cell named ${name}`);
    return found;
  });
  await user.click(cell);
  return screen.getByRole('region', { name });
}
// Corrects the row's Mark and saves it: the per-row save, which refreshes the Review.
async function correctPrice(user: ReturnType<typeof userEvent.setup>, entry: HTMLElement, price: string) {
  await user.click(within(entry).getByRole('button', { name: 'Correct' }));
  await user.type(within(entry).getByLabelText('Price'), price);
  await user.type(within(entry).getByLabelText('Reason (required)'), 'typo');
  await user.click(within(entry).getByRole('button', { name: 'Save correction' }));
}

describe('overview', () => {
  it('should show the Review Date, completion as text, the counts to go and each Trade line', async () => {
    const trades = [tradeItem('t1', 'XYZ'), tradeItem('t2', 'DEF')];
    const facade = reviewFacade(
      ready({
        today: [markRow('DEF', ['t2'])],
        trades,
        completion: incomplete({ code: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'DEF' }, tradingDate: '2026-10-12', trades: ['t2'] }, { code: 'ActionMissing', tradeId: 't1' }, { code: 'IntegrityDisagreement', tradeId: 't2', findings: [] }),
      }),
    );
    renderReview(facade);

    const header = await screen.findByRole('region', { name: 'The day' });
    expect(within(header).getByText('Mon Oct 12')).toBeTruthy();
    expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledExactlyOnceWith({ date: { kind: 'LatestCompleted' }, asOf: '2026-10-12T21:00:00Z' });
    expect(within(header).getByText('Incomplete')).toBeTruthy();
    expect(within(header).getByText('2 Trades · 1 Mark and 1 Action to go')).toBeTruthy();
    const lines = within(within(header).getByRole('list', { name: 'Trade lines' })).getAllByRole('listitem');
    expect(lines.map((line) => line.textContent)).toEqual(['XYZ To do: Action', 'DEF Marks needed To do: Mark']);
    expect(within(within(header).getByRole('list', { name: 'Facts to check' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['DEF: recorded facts disagree']);
  });

  it('should list the due reflections by Trade among the lines while completion is Incomplete, each linking to its Trade card', async () => {
    const trades = [tradeItem('t1', 'XYZ'), tradeItem('t2', 'DEF')];
    const facade = reviewFacade(
      ready({
        trades,
        completion: incomplete({ code: 'ReflectionDue', tradeId: 't1', debtIds: ['d1', 'd2'] }, { code: 'ReflectionDue', tradeId: 't2', debtIds: ['d3'] }),
      }),
    );
    renderReview(facade);

    const header = await screen.findByRole('region', { name: 'The day' });
    expect(within(header).getByText('2 Trades · 3 reflections to go')).toBeTruthy();
    const lines = within(within(header).getByRole('list', { name: 'Trade lines' })).getAllByRole('listitem');
    expect(lines.map((line) => line.textContent)).toEqual(['XYZ To do: Reflection', 'DEF To do: Reflection']);
    // The first Trade owing opens on load; the link for the other one opens its card.
    await screen.findByRole('region', { name: 'XYZ review' });
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenCalledExactlyOnceWith({ reviewDate: '2026-10-12', tradeId: 't1', binding });

    await userEvent.setup().click(within(lines[1]!).getByRole('link', { name: 'DEF' }));

    expect(await screen.findByRole('region', { name: 'DEF review' })).toBeTruthy();
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenLastCalledWith({ reviewDate: '2026-10-12', tradeId: 't2', binding });
  });

  it('should show Complete as text, with every Trade line done, when every obligation is resolved', async () => {
    renderReview(reviewFacade(ready({ trades: [tradeItem('t1', 'XYZ')], completion: { kind: 'Complete' } })));

    const header = await screen.findByRole('region', { name: 'The day' });
    expect(within(header).getByText('Complete')).toBeTruthy();
    expect(within(within(header).getByRole('list', { name: 'Trade lines' })).getAllByRole('listitem').map((line) => line.textContent)).toEqual(['XYZ Done']);
  });

  it('should no longer render the Blockers list, the Review status block or the Stop line', async () => {
    renderReview(reviewFacade(ready({ today: [markRow('DEF', ['t2'])], trades: [tradeItem('t1', 'XYZ'), tradeItem('t2', 'DEF')], completion: incomplete(markMissing('DEF', 't2'), ...actionMissing('t1', 't2')) })));

    await screen.findByRole('region', { name: 'The day' });
    expect(screen.queryByRole('list', { name: 'Blockers' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Review status' })).toBeNull();
    expect(screen.queryByText(/Stop ◂ ▸ Target/)).toBeNull();
    expect(screen.queryByText(/Action missing for|Reflection due for|Every Trade has an Action/)).toBeNull();
  });

  it('should head the cards Trades · most pressing first', async () => {
    renderReview(reviewFacade(ready({ trades: [tradeItem('t1', 'XYZ'), tradeItem('t2', 'DEF')], completion: incomplete(...actionMissing('t1', 't2')) })));

    const heading = await screen.findByRole('heading', { name: 'Trades · most pressing first' });
    expect(heading.compareDocumentPosition(screen.getByRole('list', { name: 'Positions' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    expect(screen.queryByRole('region', { name: 'The day' })).toBeNull();

    settle({ kind: 'Empty', reviewDate: '2026-10-12', cutoff: CUTOFF, owed: [], binding });
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
    expect(await screen.findByRole('region', { name: 'The day' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(vi.mocked(failing.DailyReview.open)).toHaveBeenCalledTimes(3);
  });

  it('should name the Instruments, Trades, and calculation families when completion is Complete with Unavailable Marks', async () => {
    renderReview(
      reviewFacade(
        ready({
          trades: [tradeItem('t1', 'XYZ'), tradeItem('t2', 'ABC'), tradeItem('t3', 'DEF')],
          completion: { kind: 'CompleteWithUnavailableMarks', instruments: [{ kind: 'Stock', symbol: 'XYZ' }, { kind: 'Stock', symbol: 'DEF' }], trades: ['t1', 't3'], families: ['Valuation', 'Risk', 'Reward', 'ConditionStatus'] },
        }),
      ),
    );

    const header = await screen.findByRole('region', { name: 'The day' });
    expect(within(header).getByText('Complete with Unavailable Marks')).toBeTruthy();
    const disclosure = within(header).getByRole('group', { name: 'Unavailable Marks' });
    expect(within(disclosure).getByText('Instruments: XYZ, DEF')).toBeTruthy();
    expect(within(disclosure).getByText('Trades: XYZ, DEF')).toBeTruthy();
    expect(within(disclosure).getByText('Not calculated: Valuation, Risk, Reward, Condition status')).toBeTruthy();
  });
});

describe('Marks in the card (P11, P15)', () => {
  it('should head each Instrument of the page as a row once, and name each shared Instrument with its Trades in its editor, using MarkEntry', async () => {
    const facade = reviewFacade(
      ready({
        // XYZ's Mark is acknowledged: a typed Mark is fixed in place with no editor (T95.14), so the editor with its Trades is the acknowledgment's.
        today: [markRow('DEF', ['t3']), markRow('XYZ', ['t1', 't2'], { kind: 'AcknowledgedUnavailable', acknowledgment: { versionId: 'a1', kind: 'Asserted', savedAt: '2026-10-12T21:00:00Z' } }, 3)],
        trades: [tradeItem('t1', 'XYZ'), tradeItem('t2', 'XYZ'), tradeItem('t3', 'DEF')],
        completion: incomplete(markMissing('DEF', 't3'), ...actionMissing('t1', 't2', 't3')),
      }),
    );
    vi.mocked(facade.MarketData.save).mockResolvedValue({ kind: 'Conflict', key: { instrumentKey: 'XYZ', tradingDate: '2026-10-12' }, resolution: available('52'), resolutionRevision: 3 });
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Conflict' });
    renderReview(facade);
    const user = userEvent.setup();

    // One grid holds the shared Instrument once, in the order of the Trades, and names both Trades that hold it.
    await openMarks();
    const marks = await screen.findByRole('region', { name: /^Marks for / });
    expect(within(marks).getAllByRole('rowheader').map((header) => header.textContent)).toEqual(['XYZ', 'DEF']);
    const xyz = await chooseCell(user, 'XYZ Mark, Mon Oct 12');
    expect(within(xyz).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/trades/t1', '/trades/t2']);
    // Its editor is a MarkEntry bound to the key's revision.
    await user.click(within(xyz).getByRole('button', { name: 'Withdraw' }));
    expect(facade.MarketData.save).toHaveBeenLastCalledWith({ intention: 'WithdrawAcknowledgment', instrumentKey: 'XYZ', tradingDate: '2026-10-12', expectedResolutionRevision: 3 });

    // The Instrument held by one Trade names no other Trade; it is typed and saved in the same grid.
    await user.type(within(marks).getByRole('textbox', { name: 'DEF Mark, Mon Oct 12' }), '12');
    await user.click(within(marks).getByRole('button', { name: 'Save Marks (1)' }));
    expect(facade.DailyReview.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'SaveReviewMarks', entries: [{ key: { instrumentKey: 'DEF', tradingDate: '2026-10-12' }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '12' } }] }),
    );
  });

  it('should show a card Earlier sessions without Marks as optional columns per Instrument from the date the Trade is relevant, newest first, 20 per page, and say they do not block the Review', async () => {
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
          // Another Trade's Instrument is on the page too.
          gap('OTHER', { trades: [{ tradeId: 't9', from: '2026-09-01' }], missing: ['2026-09-30'], revisions: { '2026-09-30': 'None' } }),
        ],
        completion: incomplete(markMissing('MNO', 't1'), ...actionMissing('t1')),
      }),
    );
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Conflict' });
    renderReview(facade);
    const user = userEvent.setup();

    const marks = await screen.findByRole('region', { name: /^Marks for / });
    await user.click(within(marks).getByRole('button', { name: 'Add the skipped sessions' }));
    // One row for each Instrument the page holds, and the earlier sessions run oldest to newest, the Review Date last (read here newest first).
    expect(within(marks).getAllByRole('rowheader').map((header) => header.textContent)).toEqual(['MNO', 'ABC', 'OTHER']);
    const sessions = () => within(marks).getAllByRole('columnheader').flatMap((header) => header.getAttribute('data-session') ?? []).reverse();
    expect(sessions()).toHaveLength(21);
    expect(sessions().slice(0, 3)).toEqual(['2026-10-12', '2026-09-30', day(25)]);
    expect(sessions()[20]).toBe(day(7));
    expect(sessions()).not.toContain('2026-08-20');
    expect(within(marks).getByText("Earlier sessions don't block the Review.")).toBeTruthy();
    // The acknowledged session is listed in order among the others.
    expect(within(within(marks).getByRole('button', { name: 'MNO Mark, Thu Sep 10' })).getByText(/Acknowledged Unavailable/)).toBeTruthy();

    // Each cell's draft is bound to its own date and revision.
    await user.type(within(marks).getByRole('textbox', { name: 'MNO Mark, Thu Sep 24' }), '9');
    await user.click(within(marks).getByRole('button', { name: 'Save Marks (1)' }));
    expect(facade.DailyReview.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ entries: [{ key: { instrumentKey: 'MNO', tradingDate: day(24) }, expectedRevision: 4, intention: { kind: 'RecordInitialManualMark', price: '9' } }] }),
    );

    // The refused save keeps the draft, and paging goes on over it.
    expect(within(marks).getByText('Sessions 1 to 20 of 26')).toBeTruthy();
    expect(within(marks).queryByRole('button', { name: 'Previous page' })).toBeNull();
    await user.click(within(marks).getByRole('button', { name: 'Next page' }));
    expect(sessions()).toHaveLength(7);
    expect(sessions()[1]).toBe(day(6));
    expect(within(marks).getByText('Sessions 21 to 26 of 26')).toBeTruthy();
    expect(within(marks).queryByRole('button', { name: 'Next page' })).toBeNull();
    await user.click(within(marks).getByRole('button', { name: 'Previous page' }));
    expect(sessions()).toHaveLength(21);
    expect(within(marks).getByRole<HTMLInputElement>('textbox', { name: 'MNO Mark, Thu Sep 24' }).value).toBe('9');
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

    await openMarks();
    await user.click(await screen.findByRole('button', { name: 'Add the skipped sessions' }));
    const row = await chooseCell(user, 'DEF Mark, Fri Oct 9');
    expect(within(row).getByText(/no quote/)).toBeTruthy();
    expect(within(row).queryByRole('button', { name: 'Withdraw' })).toBeNull();
    // An acknowledged date can take a price, but not another acknowledgment.
    expect(within(row).queryByRole('button', { name: "Can't get a price" })).toBeNull();
    await user.type(within(row).getByLabelText('Price'), '9.5');
    await user.click(within(screen.getByRole('region', { name: /^Marks for / })).getByRole('button', { name: 'Save Marks (1)' }));
    expect(facade.DailyReview.save).toHaveBeenCalledWith(
      expect.objectContaining({ entries: [{ key: { instrumentKey: 'DEF', tradingDate: '2026-10-09' }, expectedRevision: 2, intention: { kind: 'RecordInitialManualMark', price: '9.5' } }] }),
    );
  });

  it('should keep a value typed into a Mark entry when the Review read again after a save brings that key a newer revision', async () => {
    const trades = [tradeItem('t1', 'DEF')];
    const first = ready({ today: [markRow('DEF', ['t1']), markRow('XYZ', ['t1'], available('52'), 1)], earlierMarks: fridayMarks('XYZ'), trades, completion: incomplete(markMissing('DEF', 't1'), ...actionMissing('t1')) });
    // The refreshed key is acknowledged unavailable, so the typed price still fits it.
    const acknowledged: MarkResolution = { kind: 'AcknowledgedUnavailable', acknowledgment: { versionId: 'a1', kind: 'Asserted', savedAt: '2026-10-12T21:00:00Z' } };
    const second = ready({ today: [markRow('DEF', ['t1'], acknowledged, 1), markRow('XYZ', ['t1'], available('52'), 1)], earlierMarks: fridayMarks('XYZ'), trades, completion: incomplete(...actionMissing('t1')) });
    const facade = reviewFacade(first, second);
    vi.mocked(facade.MarketData.save).mockResolvedValue(savedMark('XYZ', '2026-10-09', '52'));
    renderReview(facade);
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: 'DEF Mark, Mon Oct 12' }), '12.5');

    await correctPrice(user, await chooseCell(user, 'XYZ Mark, Fri Oct 9'), '52');
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'DEF Mark, Mon Oct 12' }).textContent).toContain('Acknowledged Unavailable'));

    // The refreshed key is a cell to press now; the price typed stays, in its editor.
    expect(within(await chooseCell(user, 'DEF Mark, Mon Oct 12')).getByLabelText<HTMLInputElement>('Price').value).toBe('12.5');
  });

  it('should keep an earlier session listed with its saved Mark until the Refresh reads the Review again, then drop it when the Review no longer lists it', async () => {
    const trades = [tradeItem('t1', 'DEF')];
    const first = ready({ today: [markRow('DEF', ['t1'], available('12'), 1)], earlier: [gap('DEF', { missing: ['2026-10-09'], revisions: { '2026-10-09': 'None' } })], trades, completion: incomplete(...actionMissing('t1')) });
    // Read again, the filled session is no longer a gap.
    const second = ready({ today: [markRow('DEF', ['t1'], available('12'), 1)], earlier: [], trades, completion: incomplete(...actionMissing('t1')) });
    const facade = reviewFacade(first, second);
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce(savedButNotRead('DEF', '2026-10-09', '9'));
    renderReview(facade);
    const user = userEvent.setup();
    await openMarks();
    await user.click(await screen.findByRole('button', { name: 'Add the skipped sessions' }));
    await user.type(await screen.findByRole('textbox', { name: 'DEF Mark, Fri Oct 9' }), '9');
    await user.click(within(screen.getByRole('region', { name: /^Marks for / })).getByRole('button', { name: 'Save Marks (1)' }));
    await user.click(await screen.findByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(2));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'DEF Mark, Fri Oct 9' })).toBeNull());
  });

  it('should resume from the returned state after a reload, showing saved Actions and Marks without any stored session', async () => {
    const stored = vi.spyOn(Storage.prototype, 'setItem');
    const read = vi.spyOn(Storage.prototype, 'getItem');
    const returned = ready({
      today: [markRow('XYZ', ['t1'], available('52'), 1), markRow('DEF', ['t2'])],
      trades: [tradeItem('t1', 'XYZ'), tradeItem('t2', 'DEF')],
      completion: incomplete({ code: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'DEF' }, tradingDate: '2026-10-12', trades: ['t2'] }, { code: 'ActionMissing', tradeId: 't2' }),
    });
    const facade = reviewFacade(returned);
    renderReview(facade);
    const user = userEvent.setup();

    // The Marks step shows the returned Marks: DEF's is still to enter.
    expect(await screen.findByRole('textbox', { name: 'DEF Mark, Mon Oct 12' })).toBeTruthy();
    const headers = screen.getAllByRole('button', { name: /^Review / });
    expect(headers[0]!.textContent).toContain('Done · Action saved');
    expect(headers[1]!.textContent).toContain('1 Mark · Action');
    // The saved Mark comes from the returned state alone.
    await user.click(headers[0]!);
    await openMarks();
    expect((await screen.findByRole<HTMLInputElement>('textbox', { name: 'XYZ Mark, Mon Oct 12' })).value).toBe('52.00');
    // No Review session, stage, or progress is kept in the browser.
    expect(stored).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    stored.mockRestore();
    read.mockRestore();
  });

  it('should show a fresh entry for an Instrument whose Review Date changed when the Review is read again', async () => {
    const trades = [tradeItem('t1', 'DEF')];
    const monday = ready({ today: [markRow('DEF', ['t1']), markRow('XYZ', ['t1'], available('52'), 1)], earlierMarks: fridayMarks('XYZ'), trades, completion: incomplete(markMissing('DEF', 't1'), ...actionMissing('t1')) });
    const tuesday: Ready = {
      ...ready({ today: [{ ...markRow('DEF', ['t1']), tradingDate: '2026-10-13' }], trades, completion: incomplete({ code: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'DEF' }, tradingDate: '2026-10-13', trades: ['t1'] }, ...actionMissing('t1')) }),
      reviewDate: '2026-10-13',
    };
    const facade = reviewFacade(monday, tuesday);
    vi.mocked(facade.MarketData.save).mockResolvedValue(savedMark('XYZ', '2026-10-09', '52'));
    renderReview(facade);
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: 'DEF Mark, Mon Oct 12' }), '12');

    await correctPrice(user, await chooseCell(user, 'XYZ Mark, Fri Oct 9'), '52');
    const tuesday$ = await screen.findByRole<HTMLInputElement>('textbox', { name: 'DEF Mark, Tue Oct 13' });

    // The Monday draft, with its typed price, is gone; Tuesday's key starts empty and Unsaved is not shown.
    expect(screen.getByText('Tue Oct 13', { selector: 'time' })).toBeTruthy();
    expect(tuesday$.value).toBe('');
    expect(screen.queryByText('Unsaved')).toBeNull();
  });

  it('should name each Mark cell by Instrument and date, and an earlier session editor too', async () => {
    const facade = reviewFacade(
      ready({
        today: [markRow('DEF', ['t1'])],
        earlier: [gap('DEF', { missing: ['2026-10-09'], revisions: { '2026-10-09': 'None' } })],
        trades: [tradeItem('t1', 'DEF')],
        completion: incomplete(markMissing('DEF', 't1'), ...actionMissing('t1')),
      }),
    );
    renderReview(facade);
    const user = userEvent.setup();
    expect(await screen.findByRole('textbox', { name: 'DEF Mark, Mon Oct 12' })).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Add the skipped sessions' }));
    await chooseCell(user, 'DEF Mark, Fri Oct 9');
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
    const todayEntry = await screen.findByRole('textbox', { name: 'DEF Mark, Mon Oct 12' });
    await user.click(await screen.findByRole('button', { name: 'Add the skipped sessions' }));
    const earlierEntry = screen.getByRole('textbox', { name: 'DEF Mark, Fri Oct 9' });
    expect(dirty).not.toHaveBeenCalledWith(true);

    await user.type(todayEntry, '1');
    expect(dirty).toHaveBeenLastCalledWith(true);
    await user.type(earlierEntry, '2');
    await user.clear(todayEntry);
    // One draft still holds a value.
    expect(dirty).toHaveBeenLastCalledWith(true);
    await user.click(within(screen.getByRole('region', { name: /^Marks for / })).getByRole('button', { name: 'Discard' }));
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

    const marks = await screen.findByRole('region', { name: /^Marks for / });
    await userEvent.setup().click(within(marks).getByRole('button', { name: 'Add the skipped sessions' }));
    expect(within(marks).getAllByText('Missing')).toHaveLength(2);
    for (const name of ['Enter', "Can't get a price", 'Correct', 'Withdraw']) expect(within(marks).queryByRole('button', { name })).toBeNull();
    expect(facade.MarketData.save).not.toHaveBeenCalled();
  });

  it('should keep the Marks and say the Review could not be refreshed when the Review read after a save fails, then clear it once a refresh succeeds', async () => {
    const trades = [tradeItem('t1', 'XYZ')];
    const first = ready({ today: [markRow('DEF', ['t1'], available('1'), 1), markRow('XYZ', ['t1'], available('1'), 1), markRow('GHI', ['t1'], available('1'), 1)], earlierMarks: fridayMarks('DEF', 'XYZ', 'GHI'), trades, completion: incomplete(...actionMissing('t1')) });
    const facade = reviewFacade(first);
    vi.mocked(facade.DailyReview.open).mockResolvedValueOnce(first).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ kind: 'ChangedDuringAssembly' }).mockResolvedValue(first);
    vi.mocked(facade.MarketData.save).mockImplementation((command) => Promise.resolve(savedMark(command.instrumentKey, command.tradingDate, '1')));
    renderReview(facade);
    const user = userEvent.setup();

    await openMarks();
    await correctPrice(user, await chooseCell(user, 'DEF Mark, Fri Oct 9'), '2');
    expect((await screen.findByRole('alert')).textContent).toContain('We couldn’t refresh the Review. Nothing was changed.');
    expect(screen.getByRole('button', { name: 'XYZ Mark, Fri Oct 9' })).toBeTruthy();

    // A refused refresh says the same, and the next save's succeeds.
    await correctPrice(user, await chooseCell(user, 'XYZ Mark, Fri Oct 9'), '2');
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(3));
    expect(screen.getByRole('alert').textContent).toContain('We couldn’t refresh the Review.');
    await correctPrice(user, await chooseCell(user, 'GHI Mark, Fri Oct 9'), '2');
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(facade.DailyReview.open).toHaveBeenCalledTimes(4);
  });
});

describe('A Refresh with no card open (T95.12-B1)', () => {
  // Save Marks saved the Marks but its Review could not be read; the card is collapsed so the Refresh reads the Review alone.
  async function savedUnreadWithNoCard(first: Ready, second: Ready) {
    const facade = reviewFacade(first, second);
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce(savedButNotRead('DEF', '2026-10-12', '9'));
    renderReview(facade);
    const user = userEvent.setup();
    await openMarks();
    await user.type(await screen.findByRole('textbox', { name: 'DEF Mark, Mon Oct 12' }), '9');
    await user.click(screen.getByRole('button', { name: /^Review DEF\b/ }));
    const step = screen.getByRole('region', { name: /^Marks for / });
    await user.click(within(step).getByRole('button', { name: 'Save Marks (1)' }));
    await within(step).findByText(/figures are out of date/);
    await user.click(within(step).getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    return step;
  }
  const trades = [tradeItem('t1', 'DEF')];
  const base = { today: [markRow('DEF', ['t1'])], trades, completion: incomplete(...actionMissing('t1')) };

  it('should clear the out-of-date notice once the Refresh reads the Review', async () => {
    const step = await savedUnreadWithNoCard(ready(base), ready(base));
    await waitFor(() => expect(within(step).queryByText(/figures are out of date/)).toBeNull());
  });

  it('should add a column for a gap the refreshed Review newly lists, and drop one it no longer lists', async () => {
    const step = await savedUnreadWithNoCard(ready(base), ready({ ...base, earlier: [gap('DEF', { missing: ['2026-10-09'], revisions: { '2026-10-09': 'None' } })] }));
    await within(step).findByRole('button', { name: 'Add the skipped sessions' });
  });

  it('should drop the skipped sessions a refreshed Review no longer lists', async () => {
    const first = ready({ ...base, earlier: [gap('DEF', { missing: ['2026-10-09'], revisions: { '2026-10-09': 'None' } })] });
    const step = await savedUnreadWithNoCard(first, ready(base));
    await waitFor(() => expect(within(step).queryByRole('button', { name: 'Add the skipped sessions' })).toBeNull());
  });
});

describe('A failed Save Marks with no walked card open (T9R2.13-B3)', () => {
  it('should show a failed Save Marks and its Refresh in the Marks step when no walked card is open', async () => {
    const trades = [tradeItem('t1', 'DEF')];
    const first = ready({ today: [markRow('DEF', ['t1'])], trades, completion: incomplete(...actionMissing('t1')) });
    const facade = reviewFacade(first);
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'ReviewChanged', evidence: { marketDataSnapshotId: 'mds1:2:def', frames: [] } });
    renderReview(facade);
    const user = userEvent.setup();
    await openMarks();
    await user.type(await screen.findByRole('textbox', { name: 'DEF Mark, Mon Oct 12' }), '12');
    // Collapsing the card leaves the draft on the Review, and no walked card open.
    await user.click(screen.getByRole('button', { name: /^Review DEF\b/ }));
    const step = screen.getByRole('region', { name: /^Marks for / });
    await user.click(within(step).getByRole('button', { name: 'Save Marks (1)' }));

    expect((await within(step).findByRole('alert')).textContent).toContain('The Review changed after you opened it.');
    await user.click(within(step).getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(step).queryByRole('alert')).toBeNull());
    expect(within(step).getByRole('button', { name: 'Save Marks (1)' })).toBeTruthy();
  });
});

describe('A card opened during the status header Refresh (T9R2.13-B4)', () => {
  it('should let a card opened during the Marks step Refresh read its Trade from the refreshed Review', async () => {
    const trades = [tradeItem('t1', 'DEF')];
    const first = ready({ today: [markRow('DEF', ['t1'])], trades, completion: incomplete(...actionMissing('t1')) });
    const newBinding: ReviewBinding = { ...binding, journalRevision: 2 };
    const refreshed: Ready = { ...first, binding: newBinding };
    const facade = reviewFacade(first);
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'ReviewChanged', evidence: { marketDataSnapshotId: 'mds1:2:def', frames: [] } });
    renderReview(facade);
    const user = userEvent.setup();
    await openMarks();
    await user.type(await screen.findByRole('textbox', { name: 'DEF Mark, Mon Oct 12' }), '12');
    await user.click(screen.getByRole('button', { name: /^Review DEF\b/ }));
    const status = screen.getByRole('region', { name: /^Marks for / });
    await user.click(within(status).getByRole('button', { name: 'Save Marks (1)' }));
    await within(status).findByRole('alert');

    // The Refresh's Review is slow: the card is opened while it is pending.
    let release: (review: Ready) => void = () => undefined;
    vi.mocked(facade.DailyReview.open).mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    await user.click(within(status).getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    vi.mocked(facade.DailyReview.getTrade).mockClear();
    await user.click(screen.getByRole('button', { name: /^Review DEF\b/ }));
    expect(facade.DailyReview.getTrade).not.toHaveBeenCalled();
    release(refreshed);
    await waitFor(() => expect(facade.DailyReview.getTrade).toHaveBeenCalledWith({ reviewDate: '2026-10-12', tradeId: 't1', binding: newBinding }));
  });
});

describe('A card opened after another tab saved a Mark (T9R2.17-B8)', () => {
  it('should read the Review again and show the Trade when its read is refused on the held binding', async () => {
    const trades = [tradeItem('t1', 'XYZ'), tradeItem('t2', 'DEF')];
    const first = ready({ trades, completion: incomplete(...actionMissing('t1', 't2')) });
    const newBinding: ReviewBinding = { ...binding, marketDataSnapshotId: 'mds1:2:def' };
    const facade = reviewFacade(first);
    const asBefore = vi.mocked(facade.DailyReview.getTrade).getMockImplementation()!;
    renderReview(facade);
    await screen.findByRole('region', { name: 'XYZ review' });
    // Another tab saved a Mark after the page opened: the held binding no longer reads any card, the new one does. Only the read
    // made when the card is pressed is refused; the mount read has been answered.
    vi.mocked(facade.DailyReview.open).mockResolvedValue({ ...first, binding: newBinding });
    vi.mocked(facade.DailyReview.getTrade).mockImplementation((request) => (request.binding === newBinding ? asBefore(request) : Promise.resolve({ kind: 'ReviewChanged' })));
    await user_open();

    expect(await screen.findByRole('region', { name: 'DEF review' })).toBeTruthy();
    expect(screen.queryByText('We couldn’t load this Trade. Nothing was changed.')).toBeNull();
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenLastCalledWith({ reviewDate: '2026-10-12', tradeId: 't2', binding: newBinding });
  });
});
describe('An owed card opened after another tab closed the last walked Trade (T9R2.17-B10)', () => {
  it('should read the Review again and show the owed card when the reopened Review is Empty', async () => {
    const owedT2: OwedReflectionsTrade = { tradeId: 't2', underlying: 'DEF', lifecycle: 'Closed', owed: [], progress: reflectionsOwedProgress(1, 0) };
    const owedCard: OwedReflectionsCard = { tradeId: 't2', underlying: 'DEF', lifecycle: 'Closed', labels: { strategy: 'Long Stock', account: 'Main', institution: 'Broker' }, reflections: [], progress: owedT2.progress };
    const first = { ...ready({ trades: [tradeItem('t1', 'XYZ')], completion: incomplete(...actionMissing('t1')) }), owed: [owedT2] };
    const newBinding: ReviewBinding = { ...binding, marketDataSnapshotId: 'mds1:2:def' };
    const facade = reviewFacade(first);
    renderReview(facade);
    await screen.findByRole('region', { name: 'XYZ review' });
    // Another tab closed the last walked Trade: the Review is now Empty, holding only the owed Trade, under a new binding.
    vi.mocked(facade.DailyReview.open).mockResolvedValue({ kind: 'Empty', reviewDate: '2026-10-12', cutoff: CUTOFF, owed: [owedT2], binding: newBinding });
    vi.mocked(facade.DailyReview.getTrade).mockImplementation((request) =>
      Promise.resolve(request.binding === newBinding ? { kind: 'ReflectionsOwed', reviewDate: request.reviewDate, cutoff: CUTOFF, card: owedCard } : { kind: 'ReviewChanged' }),
    );
    await userEvent.setup().click(await screen.findByRole('button', { name: /^Review DEF\b/ }));

    expect(await screen.findByRole('region', { name: 'DEF review' })).toBeTruthy();
    expect(screen.queryByText('We couldn’t load this Trade. Nothing was changed.')).toBeNull();
  });
});
async function user_open() {
  await userEvent.setup().click(await screen.findByRole('button', { name: /^Review DEF\b/ }));
}
