// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { ExpectedResolutionRevision, IncompleteReason, MarkRow, MarkResolution, OpenDailyReviewResult, ReviewBinding, ReviewCompletion, ReviewTradeItem } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ReviewView } from './ReviewView.tsx';

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
  ...over,
});
function ready(over: { today?: readonly MarkRow[]; earlier?: Extract<Ready['families'][number], { family: 'Marks' }>['earlier']; trades?: readonly ReviewTradeItem[]; completion?: ReviewCompletion } = {}): Ready {
  return {
    kind: 'Ready',
    reviewDate: '2026-10-12',
    cutoff: CUTOFF,
    families: [
      { family: 'Marks', today: over.today ?? [], earlier: over.earlier ?? [] },
      { family: 'Trades', trades: (over.trades ?? []).map((t) => ({ ...t, reflections: { due: 0, later: 0 } })) },
    ],
    completion: over.completion ?? { kind: 'Complete' },
    binding,
  };
}
const incomplete = (...reasons: IncompleteReason[]): ReviewCompletion => ({ kind: 'Incomplete', reasons });

function renderReview(facade: UiFacade, options: { writable?: boolean; entry?: string; onDirtyChange?: (dirty: boolean) => void } = {}) {
  render(
    <RuntimeContext.Provider value={{ writable: options.writable ?? true, report: () => undefined }}>
      <MemoryRouter initialEntries={[options.entry ?? '/review']}>
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
  return facade;
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
    vi.mocked(facade.DailyReview.getTrade).mockResolvedValue({ kind: 'ReviewChanged' });
    renderReview(facade);

    const header = await screen.findByRole('region', { name: 'Review status' });
    const blockers = within(within(header).getByRole('list', { name: 'Blockers' })).getAllByRole('listitem');
    expect(blockers.map((b) => b.textContent)).toEqual(['2 reflections due for XYZ', 'Reflection due for DEF']);
    expect(screen.queryByRole('region', { name: 'Trades' })).toBeNull();

    await userEvent.setup().click(within(blockers[0]!).getByRole('link', { name: 'XYZ' }));

    expect(await screen.findByRole('region', { name: 'Trades' })).toBeTruthy();
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenCalledExactlyOnceWith({ reviewDate: '2026-10-12', tradeId: 't1', binding });
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

describe('Marks family (P11, P15)', () => {
  it('should list Today Mark tasks, each shared Instrument once with its Trades, using MarkEntry', async () => {
    const facade = reviewFacade(
      ready({
        today: [markRow('DEF', ['t3']), markRow('XYZ', ['t1', 't2'], available('52'), 3)],
        trades: [tradeItem('t1', 'XYZ'), tradeItem('t2', 'XYZ'), tradeItem('t3', 'DEF')],
        completion: incomplete({ code: 'MarkMissing', instrumentKey: 'DEF', tradingDate: '2026-10-12', trades: ['t3'] }),
      }),
    );
    vi.mocked(facade.MarketData.save).mockResolvedValue({ kind: 'Conflict', key: { instrumentKey: 'DEF', tradingDate: '2026-10-12' }, resolution: { kind: 'Missing' }, resolutionRevision: 'None' });
    renderReview(facade);
    const user = userEvent.setup();

    const marks = await screen.findByRole('region', { name: 'Marks' });
    const today = within(marks).getByRole('list', { name: "Today's Marks" });
    const rows = within(today).getAllByRole('listitem');
    expect(rows.map((row) => within(row).getByRole('heading', { level: 4 }).textContent)).toEqual(['DEF', 'XYZ']);
    // The shared Instrument is one row naming both Trades.
    expect(within(rows[1]!).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/trades/t1', '/trades/t2']);
    expect(within(rows[0]!).getByRole('link').getAttribute('href')).toBe('/trades/t3');

    // Each row is a MarkEntry bound to its key's revision.
    await user.click(within(rows[0]!).getByRole('button', { name: 'Enter' }));
    await user.type(within(rows[0]!).getByLabelText('Price'), '12');
    await user.click(within(rows[0]!).getByRole('button', { name: 'Save Mark' }));
    expect(facade.MarketData.save).toHaveBeenLastCalledWith({ intention: 'RecordInitialManualMark', instrumentKey: 'DEF', tradingDate: '2026-10-12', price: '12', expectedResolutionRevision: 'None' });
    await user.click(within(rows[1]!).getByRole('button', { name: 'Correct' }));
    await user.type(within(rows[1]!).getByLabelText('Price'), '51.5');
    await user.type(within(rows[1]!).getByLabelText('Reason (required)'), 'typo');
    await user.click(within(rows[1]!).getByRole('button', { name: 'Save correction' }));
    expect(facade.MarketData.save).toHaveBeenLastCalledWith({ intention: 'CorrectMark', instrumentKey: 'XYZ', tradingDate: '2026-10-12', price: '51.5', reason: 'typo', expectedResolutionRevision: 3 });
  });

  it('should list Earlier sessions without Marks as optional per Instrument, newest first, 20 per page, and say they do not block the Review', async () => {
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
          { instrumentKey: 'MNO', missing, acknowledged: [day(10)], revisions, acknowledgments, blocking: false },
          { instrumentKey: 'ABC', missing: ['2026-09-30'], acknowledged: [], revisions: { '2026-09-30': 'None' }, acknowledgments: {}, blocking: false },
        ],
        completion: incomplete({ code: 'MarkMissing', instrumentKey: 'MNO', tradingDate: '2026-10-12', trades: ['t1'] }),
      }),
    );
    vi.mocked(facade.MarketData.save).mockResolvedValue({ kind: 'Conflict', key: { instrumentKey: 'MNO', tradingDate: day(24) }, resolution: { kind: 'Missing' }, resolutionRevision: 4 });
    renderReview(facade);
    const user = userEvent.setup();

    const marks = await screen.findByRole('region', { name: 'Marks' });
    // Today's tasks come first; the optional group follows them.
    const headings = within(marks).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Today's Marks", 'Earlier sessions without Marks — optional']);
    const group = within(marks).getByRole('group', { name: 'Earlier sessions without Marks — optional' });
    expect(within(group).getByText(/do not block the Review/)).toBeTruthy();

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

    // Each row's entry is bound to its own date and revision.
    await user.click(within(page1[1]!).getByRole('button', { name: 'Enter' }));
    await user.type(within(page1[1]!).getByLabelText('Price'), '9');
    await user.click(within(page1[1]!).getByRole('button', { name: 'Save Mark' }));
    expect(facade.MarketData.save).toHaveBeenLastCalledWith({ intention: 'RecordInitialManualMark', instrumentKey: 'MNO', tradingDate: day(24), price: '9', expectedResolutionRevision: 4 });

    // The Conflict keeps the typed value, which holds paging; clear it so the pager is free.
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
        earlier: [{ instrumentKey: 'MNO', missing, acknowledged: [], revisions: Object.fromEntries(missing.map((d) => [d, 'None'])), acknowledgments: {}, blocking: false }],
        completion: incomplete({ code: 'MarkMissing', instrumentKey: 'MNO', tradingDate: '2026-10-12', trades: ['t1'] }),
      }),
    );
    renderReview(facade);
    const user = userEvent.setup();
    const mno = await screen.findByRole('region', { name: 'MNO earlier sessions' });
    const row = within(mno).getAllByRole('listitem')[2]!;
    await user.click(within(row).getByRole('button', { name: 'Enter' }));
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

  it('should focus the Instrument named by the link it was opened from', async () => {
    const open = () =>
      reviewFacade(
        ready({
          today: [markRow('DEF', ['t3']), markRow('XYZ', ['t1'])],
          earlier: [{ instrumentKey: 'MNO', missing: ['2026-10-09'], acknowledged: [], revisions: { '2026-10-09': 'None' }, acknowledgments: {}, blocking: false }],
          trades: [tradeItem('t1', 'XYZ'), tradeItem('t3', 'DEF')],
          completion: incomplete({ code: 'MarkMissing', instrumentKey: 'DEF', tradingDate: '2026-10-12', trades: ['t3'] }),
        }),
      );
    renderReview(open(), { entry: '/review?instrument=XYZ' });
    await screen.findByRole('region', { name: 'Marks' });
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 4, name: 'XYZ' }));
    cleanup();

    // An Instrument with only earlier sessions to fill is focused where those are listed.
    renderReview(open(), { entry: '/review?instrument=MNO' });
    await screen.findByRole('region', { name: 'Marks' });
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 4, name: 'MNO' }));
    cleanup();

    // Without the link, or for an Instrument the Review does not list, nothing takes focus.
    renderReview(open(), { entry: '/review?instrument=ZZZ' });
    await screen.findByRole('region', { name: 'Marks' });
    expect(document.activeElement).toBe(document.body);
  });
});

describe('moving on', () => {
  it('should call open again when Continue to Trades is pressed, then show the Trade walk in the returned order with band labels and reasons as text', async () => {
    const first = ready({ today: [markRow('XYZ', ['t1'])], trades: [tradeItem('t1', 'XYZ'), tradeItem('t2', 'DEF')], completion: incomplete({ code: 'MarkMissing', instrumentKey: 'XYZ', tradingDate: '2026-10-12', trades: ['t1'] }) });
    const refreshed = ready({
      today: [markRow('XYZ', ['t1'], available('52'), 1)],
      trades: [
        tradeItem('t2', 'DEF', {
          band: 'BoundaryReached',
          reasons: [{ code: 'StopBreached', conditionId: 'stop', overrun: Rational.of(5n, 1n) }],
        }),
        tradeItem('t3', 'GHI', {
          band: 'EvidenceLimited',
          reasons: [{ code: 'MarkMissing', instrumentKey: 'GHI', date: '2026-10-12' }, { code: 'AwaitingClose', after: '2026-10-09' }],
        }),
        tradeItem('t1', 'XYZ', {
          band: 'QuantifiedPressure',
          reasons: [{ code: 'PressureTowardStop' }],
          basis: { kind: 'Comparable', side: 'Losing', share: Rational.of(1n, 2n), atEntry: Rational.of(250n, 1n), now: Rational.of(125n, 1n) },
        }),
        tradeItem('t4', 'ABC'),
      ],
      completion: incomplete({ code: 'ActionMissing', tradeId: 't2' }, { code: 'ActionMissing', tradeId: 't3' }, { code: 'ActionMissing', tradeId: 't4' }),
    });
    const facade = reviewFacade(first, refreshed);
    renderReview(facade);
    const user = userEvent.setup();

    await screen.findByRole('region', { name: 'Marks' });
    expect(screen.queryByRole('region', { name: 'Trades' })).toBeNull();
    expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Continue to Trades' }));

    const walk = await screen.findByRole('region', { name: 'Trades' });
    expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(facade.DailyReview.open)).toHaveBeenLastCalledWith({ date: { kind: 'LatestCompleted' }, asOf: '2026-10-12T21:00:00Z' });
    const rows = within(walk).getAllByRole('listitem');
    expect(rows.map((row) => within(row).getByRole('link').textContent)).toEqual(['DEF', 'GHI', 'XYZ', 'ABC']);
    expect(rows.map((row) => row.textContent)).toEqual([
      'DEF Boundary reachedStop breachedAction missingReview DEF',
      'GHI Evidence limitedMark missing for GHI on Mon Oct 12Awaiting the next close after Fri Oct 9Action missingReview GHI',
      'XYZ Quantified pressure50% of the way from entry to the StopAction savedReview XYZ',
      'ABC RoutineNo pressure toward the Stop or the TargetAction missingReview ABC',
    ]);
    // The refreshed Review replaces the first: its Mark and completion are the returned ones.
    expect(screen.getByText('Incomplete')).toBeTruthy();
    expect(screen.queryByText('Mark missing for XYZ on Mon Oct 12')).toBeNull();
  });

  it('should keep Continue to Trades available after the walk opens, refresh status, blockers and order on it, and show each Mark entry\'s refreshed resolution', async () => {
    const first = ready({ today: [markRow('XYZ', ['t1'])], trades: [tradeItem('t1', 'XYZ'), tradeItem('t2', 'DEF')], completion: incomplete({ code: 'MarkMissing', instrumentKey: 'XYZ', tradingDate: '2026-10-12', trades: ['t1'] }) });
    const second = ready({ today: [markRow('XYZ', ['t1'], available('52'), 1)], trades: [tradeItem('t1', 'XYZ'), tradeItem('t2', 'DEF')], completion: incomplete({ code: 'ActionMissing', tradeId: 't1' }, { code: 'ActionMissing', tradeId: 't2' }) });
    const third = ready({ today: [markRow('XYZ', ['t1'], available('55'), 2)], trades: [tradeItem('t2', 'DEF'), tradeItem('t1', 'XYZ')], completion: incomplete({ code: 'ActionMissing', tradeId: 't2' }) });
    const facade = reviewFacade(first, second, third);
    renderReview(facade);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Continue to Trades' }));
    await screen.findByRole('region', { name: 'Trades' });

    // The walk is open and the Mark is still editable; Continue asks again.
    await user.click(screen.getByRole('button', { name: 'Continue to Trades' }));
    await waitFor(() => expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledTimes(3));
    const rows = within(screen.getByRole('region', { name: 'Trades' })).getAllByRole('listitem');
    expect(rows.map((row) => within(row).getByRole('link').textContent)).toEqual(['DEF', 'XYZ']);
    const blockers = within(screen.getByRole('list', { name: 'Blockers' })).getAllByRole('listitem');
    expect(blockers.map((b) => b.textContent)).toEqual(['Action missing for DEF']);
    // The Mark entry for the unchanged key shows the refreshed resolution and saves against its revision.
    const xyz = screen.getByRole('region', { name: 'XYZ Mark, Mon Oct 12' });
    expect(within(xyz).getByText('$55.00', { exact: false })).toBeTruthy();
    vi.mocked(facade.MarketData.save).mockResolvedValue({ kind: 'Conflict', key: { instrumentKey: 'XYZ', tradingDate: '2026-10-12' }, resolution: available('55'), resolutionRevision: 2 });
    await user.click(within(xyz).getByRole('button', { name: 'Correct' }));
    await user.type(screen.getByLabelText('Price'), '56');
    await user.type(screen.getByLabelText('Reason (required)'), 'typo');
    await user.click(screen.getByRole('button', { name: 'Save correction' }));
    expect(facade.MarketData.save).toHaveBeenLastCalledWith({ intention: 'CorrectMark', instrumentKey: 'XYZ', tradingDate: '2026-10-12', price: '56', reason: 'typo', expectedResolutionRevision: 2 });
  });

  it('should send one open and disable Continue to Trades while a refresh is in flight', async () => {
    const first = ready({ trades: [tradeItem('t1', 'XYZ')] });
    const facade = reviewFacade(first);
    renderReview(facade);
    const user = userEvent.setup();
    const button = await screen.findByRole('button', { name: 'Continue to Trades' });
    let settle: (result: OpenDailyReviewResult) => void = () => undefined;
    vi.mocked(facade.DailyReview.open).mockReturnValueOnce(new Promise<OpenDailyReviewResult>((resolve) => (settle = resolve)));
    await user.click(button);
    await user.click(button);
    expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledTimes(2);
    expect(button).toHaveProperty('disabled', true);

    settle(first);
    await screen.findByRole('region', { name: 'Trades' });
    expect(screen.getByRole('button', { name: 'Continue to Trades' })).toHaveProperty('disabled', false);
    await user.click(screen.getByRole('button', { name: 'Continue to Trades' }));
    await waitFor(() => expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledTimes(3));
  });

  it('should offer Enter on an acknowledged earlier-session date, saved under that date revision, without Withdraw', async () => {
    const acknowledgment = { versionId: 'a1', kind: 'Asserted', reason: 'no quote', savedAt: '2026-10-10T21:00:00Z' } as const;
    const facade = reviewFacade(
      ready({
        today: [markRow('DEF', ['t1'], available('12'), 1)],
        trades: [tradeItem('t1', 'DEF')],
        earlier: [{ instrumentKey: 'DEF', missing: [], acknowledged: ['2026-10-09'], revisions: { '2026-10-09': 2 }, acknowledgments: { '2026-10-09': acknowledgment }, blocking: false }],
      }),
    );
    vi.mocked(facade.MarketData.save).mockResolvedValue({ kind: 'Conflict', key: { instrumentKey: 'DEF', tradingDate: '2026-10-09' }, resolution: { kind: 'AcknowledgedUnavailable', acknowledgment }, resolutionRevision: 2 });
    renderReview(facade);
    const user = userEvent.setup();

    const row = within(await screen.findByRole('region', { name: 'DEF earlier sessions' })).getByRole('listitem');
    expect(within(row).getByText(/no quote/)).toBeTruthy();
    expect(within(row).queryByRole('button', { name: 'Withdraw' })).toBeNull();
    await user.click(within(row).getByRole('button', { name: 'Enter' }));
    await user.type(within(row).getByLabelText('Price'), '9.5');
    await user.click(within(row).getByRole('button', { name: 'Save Mark' }));
    expect(facade.MarketData.save).toHaveBeenCalledWith(expect.objectContaining({ instrumentKey: 'DEF', tradingDate: '2026-10-09', price: '9.5', expectedResolutionRevision: 2 }));
  });

  it('should keep a value typed into a Mark entry when a refresh brings that key a newer revision', async () => {
    const first = ready({ today: [markRow('DEF', ['t1'])], trades: [tradeItem('t1', 'DEF')] });
    // The refreshed key is acknowledged unavailable, so the open Enter form still fits it.
    const acknowledged: MarkResolution = { kind: 'AcknowledgedUnavailable', acknowledgment: { versionId: 'a1', kind: 'Asserted', savedAt: '2026-10-12T21:00:00Z' } };
    const second = ready({ today: [markRow('DEF', ['t1'], acknowledged, 1)], trades: [tradeItem('t1', 'DEF')] });
    renderReview(reviewFacade(first, second));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Enter' }));
    await user.type(screen.getByLabelText('Price'), '12.5');

    await user.click(screen.getByRole('button', { name: 'Continue to Trades' }));
    await screen.findByRole('region', { name: 'Trades' });

    expect(screen.getByLabelText<HTMLInputElement>('Price').value).toBe('12.5');
  });

  it('should keep an earlier-session Mark\'s saved resolution when the Review re-renders without a newer revision', async () => {
    const gap = { instrumentKey: 'DEF', missing: ['2026-10-09'], acknowledged: [], revisions: { '2026-10-09': 'None' }, acknowledgments: {}, blocking: false } as const;
    const returned = ready({ today: [markRow('DEF', ['t1'], available('12'), 1)], earlier: [gap], trades: [tradeItem('t1', 'DEF')] });
    const facade = reviewFacade(returned);
    const key = { instrumentKey: 'DEF', tradingDate: '2026-10-09' };
    const mark = { revisionId: 'r9', revisionNumber: 1, price: '9', source: 'Manual', savedAt: '2026-10-12T21:00:00Z' } as const;
    vi.mocked(facade.MarketData.save).mockResolvedValueOnce({
      kind: 'Saved',
      key,
      resolution: { kind: 'Available', mark },
      resolutionRevision: 1,
      classification: 'InitialManual',
      revision: { revisionId: 'r9', revisionNumber: 1, price: '9', source: 'Manual', intention: 'InitialManual', observedAt: '2026-10-12T21:00:00Z', savedAt: '2026-10-12T21:00:00Z' },
      binding: { ...key, expectedResolutionRevision: 'None' },
    });
    renderReview(facade);
    const user = userEvent.setup();
    const earlierEntry = await screen.findByRole('region', { name: 'DEF Mark, Fri Oct 9' });
    await user.click(within(earlierEntry).getByRole('button', { name: 'Enter' }));
    await user.type(within(earlierEntry).getByLabelText('Price'), '9');
    await user.click(within(earlierEntry).getByRole('button', { name: 'Save Mark' }));
    await within(earlierEntry).findByText('$9.00', { exact: false });

    // Continue re-renders the Review with the same stale revision for that date.
    await user.click(screen.getByRole('button', { name: 'Continue to Trades' }));
    await screen.findByRole('region', { name: 'Trades' });

    const again = screen.getByRole('region', { name: 'DEF Mark, Fri Oct 9' });
    expect(within(again).getByText('$9.00', { exact: false })).toBeTruthy();
    vi.mocked(facade.MarketData.save).mockResolvedValue({ kind: 'Conflict', key, resolution: { kind: 'Available', mark }, resolutionRevision: 1 });
    await user.click(within(again).getByRole('button', { name: 'Correct' }));
    await user.type(within(again).getByLabelText('Price'), '9.5');
    await user.type(within(again).getByLabelText('Reason (required)'), 'typo');
    await user.click(within(again).getByRole('button', { name: 'Save correction' }));
    expect(facade.MarketData.save).toHaveBeenLastCalledWith({ intention: 'CorrectMark', ...key, price: '9.5', reason: 'typo', expectedResolutionRevision: 1 });
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

    // The saved Mark comes from the returned state alone.
    const xyz = await screen.findByRole('region', { name: 'XYZ Mark, Mon Oct 12' });
    expect(within(xyz).getByText('$52.00', { exact: false })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'DEF Mark, Mon Oct 12' })).getByText('Missing')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Continue to Trades' }));
    const rows = within(await screen.findByRole('region', { name: 'Trades' })).getAllByRole('listitem');
    expect(within(rows[0]!).getByText('Action saved')).toBeTruthy();
    expect(within(rows[1]!).getByText('Action missing')).toBeTruthy();
    // No Review session, stage, or progress is kept in the browser.
    expect(stored).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    stored.mockRestore();
    read.mockRestore();
  });

  it('should show a fresh entry for an Instrument whose Review Date changed when the Review is opened again', async () => {
    const monday = ready({ today: [markRow('DEF', ['t1'])], trades: [tradeItem('t1', 'DEF')], completion: incomplete({ code: 'MarkMissing', instrumentKey: 'DEF', tradingDate: '2026-10-12', trades: ['t1'] }) });
    const tuesday: Ready = {
      ...ready({ today: [{ ...markRow('DEF', ['t1']), tradingDate: '2026-10-13' }], trades: [tradeItem('t1', 'DEF')], completion: incomplete({ code: 'MarkMissing', instrumentKey: 'DEF', tradingDate: '2026-10-13', trades: ['t1'] }) }),
      reviewDate: '2026-10-13',
    };
    renderReview(reviewFacade(monday, tuesday));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Enter' }));
    await user.type(screen.getByLabelText('Price'), '12');

    await user.click(screen.getByRole('button', { name: 'Continue to Trades' }));
    await screen.findByRole('region', { name: 'Trades' });

    // The Monday entry, with its typed price, is gone; Tuesday's key starts closed.
    expect(screen.getByText('Tue Oct 13')).toBeTruthy();
    expect(screen.queryByLabelText('Price')).toBeNull();
    expect(screen.getByRole('button', { name: 'Enter' })).toBeTruthy();
  });

  it('should name each Mark entry region by Instrument and date', async () => {
    const facade = reviewFacade(
      ready({
        today: [markRow('DEF', ['t1'])],
        earlier: [{ instrumentKey: 'DEF', missing: ['2026-10-09'], acknowledged: [], revisions: { '2026-10-09': 'None' }, acknowledgments: {}, blocking: false }],
        trades: [tradeItem('t1', 'DEF')],
        completion: incomplete({ code: 'MarkMissing', instrumentKey: 'DEF', tradingDate: '2026-10-12', trades: ['t1'] }),
      }),
    );
    renderReview(facade);
    await screen.findByRole('region', { name: 'DEF Mark, Mon Oct 12' });
    expect(screen.getByRole('region', { name: 'DEF Mark, Fri Oct 9' })).toBeTruthy();
  });

  it('should register as unsaved while any Mark entry holds a value, today or earlier, and clear when the last is cancelled', async () => {
    const dirty = vi.fn<(dirty: boolean) => void>();
    const facade = reviewFacade(
      ready({
        today: [markRow('DEF', ['t1'])],
        earlier: [{ instrumentKey: 'DEF', missing: ['2026-10-09'], acknowledged: [], revisions: { '2026-10-09': 'None' }, acknowledgments: {}, blocking: false }],
        trades: [tradeItem('t1', 'DEF')],
        completion: incomplete({ code: 'MarkMissing', instrumentKey: 'DEF', tradingDate: '2026-10-12', trades: ['t1'] }),
      }),
    );
    renderReview(facade, { onDirtyChange: dirty });
    const user = userEvent.setup();
    const todayEntry = await screen.findByRole('region', { name: 'DEF Mark, Mon Oct 12' });
    const earlierEntry = screen.getByRole('region', { name: 'DEF Mark, Fri Oct 9' });
    expect(dirty).not.toHaveBeenCalledWith(true);

    await user.click(within(todayEntry).getByRole('button', { name: 'Enter' }));
    await user.type(within(todayEntry).getByLabelText('Price'), '1');
    expect(dirty).toHaveBeenLastCalledWith(true);
    await user.click(within(earlierEntry).getByRole('button', { name: 'Enter' }));
    await user.type(within(earlierEntry).getByLabelText('Price'), '2');
    await user.click(within(todayEntry).getByRole('button', { name: 'Cancel' }));
    // One entry still holds a value.
    expect(dirty).toHaveBeenLastCalledWith(true);
    await user.click(within(earlierEntry).getByRole('button', { name: 'Cancel' }));
    expect(dirty).toHaveBeenLastCalledWith(false);
  });

  it('should keep Continue to Trades available while a Mark entry holds a value', async () => {
    const facade = reviewFacade(
      ready({
        today: [markRow('DEF', ['t1'])],
        trades: [tradeItem('t1', 'DEF')],
        completion: incomplete({ code: 'MarkMissing', instrumentKey: 'DEF', tradingDate: '2026-10-12', trades: ['t1'] }),
      }),
    );
    renderReview(facade);
    const user = userEvent.setup();
    const entry = await screen.findByRole('region', { name: 'DEF Mark, Mon Oct 12' });
    await user.click(within(entry).getByRole('button', { name: 'Enter' }));
    await user.type(within(entry).getByLabelText('Price'), '1');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Continue to Trades' }).disabled).toBe(false);
    expect(screen.queryByText(/Save your Action/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Continue to Trades' }));
    expect(await screen.findByRole('button', { name: 'Review DEF' })).toBeTruthy();
    expect(within(entry).getByLabelText<HTMLInputElement>('Price').value).toBe('1');
  });

  it('should offer no Mark entry controls while the runtime is not writable, and still allow Continue to Trades', async () => {
    const facade = reviewFacade(
      ready({
        today: [markRow('DEF', ['t1']), markRow('XYZ', ['t2'], available('52'), 1)],
        earlier: [{ instrumentKey: 'DEF', missing: ['2026-10-09'], acknowledged: [], revisions: { '2026-10-09': 'None' }, acknowledgments: {}, blocking: false }],
        trades: [tradeItem('t1', 'DEF'), tradeItem('t2', 'XYZ')],
        completion: incomplete({ code: 'MarkMissing', instrumentKey: 'DEF', tradingDate: '2026-10-12', trades: ['t1'] }),
      }),
    );
    renderReview(facade, { writable: false });
    const user = userEvent.setup();

    const marks = await screen.findByRole('region', { name: 'Marks' });
    expect(within(marks).getAllByText('Missing')).toHaveLength(2);
    for (const name of ['Enter', "Can't get a price", 'Correct', 'Withdraw']) expect(within(marks).queryByRole('button', { name })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Continue to Trades' }));
    expect(await screen.findByRole('region', { name: 'Trades' })).toBeTruthy();
    expect(facade.MarketData.save).not.toHaveBeenCalled();
  });

  it('should keep the Marks and offer Continue to Trades again when the Review cannot be refreshed', async () => {
    const first = ready({ today: [markRow('XYZ', ['t1'])], trades: [tradeItem('t1', 'XYZ')], completion: incomplete({ code: 'MarkMissing', instrumentKey: 'XYZ', tradingDate: '2026-10-12', trades: ['t1'] }) });
    const facade = reviewFacade(first);
    vi.mocked(facade.DailyReview.open).mockResolvedValueOnce(first).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ kind: 'ChangedDuringAssembly' });
    renderReview(facade);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Continue to Trades' }));
    expect((await screen.findByRole('alert')).textContent).toContain('We couldn’t refresh the Review. Nothing was changed.');
    expect(screen.queryByRole('region', { name: 'Trades' })).toBeNull();
    expect(screen.getByRole('region', { name: 'XYZ Mark, Mon Oct 12' })).toBeTruthy();

    // A refused refresh says the same, and the next press succeeds.
    await user.click(screen.getByRole('button', { name: 'Continue to Trades' }));
    expect((await screen.findByRole('alert')).textContent).toContain('We couldn’t refresh the Review.');
    await user.click(screen.getByRole('button', { name: 'Continue to Trades' }));
    expect(await screen.findByRole('region', { name: 'Trades' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
