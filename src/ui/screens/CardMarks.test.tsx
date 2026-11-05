// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { DailyTradeReview, IncompleteReason, MarkResolution, MarkRow, OpenDailyReviewResult, ReviewBinding, ReviewCompletion, WalkedTrade } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { tradeSummary } from '../format.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ReviewView } from './ReviewView.tsx';
import { cardProgress } from '../../../tests/support/card-progress.ts';

afterEach(cleanup);

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;
type SaveResult = Awaited<ReturnType<UiFacade['DailyReview']['save']>>;

// The card fixture in miniature: T-A and T-F both hold XYZ, T-A from Friday 2026-10-09 and T-F from Monday; T-C holds DEF.
const CUTOFF = '2026-10-12T20:00:00Z';
const MONDAY = '2026-10-12';
const FRIDAY = '2026-10-09';
const binding: ReviewBinding = {
  workspace: { databaseName: 'tj-ws-1', contentRevision: 3 },
  catalogRevision: 1,
  journalRevision: 1,
  marketDataSnapshotId: 'mds1:1:abc',
  factRevisions: {},
  outstandingDebts: {},
};
const newBinding: ReviewBinding = { ...binding, marketDataSnapshotId: 'mds1:2:def' };
const rational = (n: bigint, d = 1n) => Rational.of(n, d);
const available = (price: string, revisionNumber = 1): MarkResolution => ({ kind: 'Available', mark: { revisionId: `r${revisionNumber}`, revisionNumber, price, source: 'Manual', savedAt: '2026-10-12T21:00:00Z' } });
const missingRow = (instrumentKey: string, trades: readonly string[]): MarkRow => ({ instrumentKey, tradingDate: MONDAY, trades, resolution: { kind: 'Missing' }, resolutionRevision: 'None', task: 'Manual' });
const walked = (tradeId: string, underlying: string, over: Partial<WalkedTrade> = {}): WalkedTrade => ({
  tradeId,
  underlying,
  lastActivity: '2026-10-12T14:00:00Z',
  band: 'Routine',
  reasons: [{ code: 'NoPressure' }],
  basis: { kind: 'Value', value: { side: 'None', share: rational(0n) } },
  rangePosition: { kind: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: underlying }, date: MONDAY },
  progress: cardProgress(),
  ...over,
});
// Each card holds a Review-date row without a Mark, so its progress needs one.
const needsMark = cardProgress(0, 0, { needed: 1, resolved: 0 });
const TA = walked('t-a', 'XYZ', { progress: needsMark });
const TF = walked('t-f', 'XYZ', { progress: needsMark, summary: { kind: 'Stock', direction: 'Long', quantity: rational(100n), price: rational(50n) } });
const TC = walked('t-c', 'DEF', { progress: needsMark });
const WALK = [TA, TF, TC] as const;

const markMissing = (instrumentKey: string, ...trades: string[]): IncompleteReason => ({ code: 'MarkMissing', instrument: { kind: 'Stock', symbol: instrumentKey }, tradingDate: MONDAY, trades });
const actionMissing = (...ids: string[]): IncompleteReason[] => ids.map((tradeId) => ({ code: 'ActionMissing', tradeId }));
const OWING: ReviewCompletion = { kind: 'Incomplete', reasons: [markMissing('XYZ', 't-a', 't-f'), markMissing('DEF', 't-c'), ...actionMissing('t-a', 't-f', 't-c')] };

type Earlier = Extract<Ready['families'][number], { family: 'Marks' }>['earlier'];
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

function review(over: Partial<Ready> = {}): Ready {
  return {
    kind: 'Ready',
    reviewDate: MONDAY,
    cutoff: CUTOFF,
    families: [
      { family: 'Marks', today: [missingRow('XYZ', ['t-a', 't-f']), missingRow('DEF', ['t-c'])], earlier: [xyzGap] },
      { family: 'Trades', trades: WALK },
    ],
    owed: [],
    completion: OWING,
    binding,
    ...over,
  };
}

const saveBinding = (tradeId: string): DailyTradeReview['saveBinding'] => ({
  reviewDate: MONDAY,
  tradeId,
  factRevision: 2,
  marketDataSnapshotId: 'mds1:1:abc',
  obligationKey: { entryType: 'DailyTradeReview', trade: tradeId, reviewDate: MONDAY },
  definitionRevision: 'def1',
  databaseName: 'tj-ws-1',
});
function tradeReview(item: WalkedTrade, over: Partial<DailyTradeReview> = {}): DailyTradeReview {
  return {
    tradeId: item.tradeId,
    underlying: item.underlying,
    lifecycle: 'Open',
    attention: item,
    labels: { strategy: 'Long Stock', account: 'Main', institution: 'Broker' },
    reflections: [],
    progress: item.progress,
    form: { kind: 'New', viewState: { selectedAction: 'Hold' } },
    definitionRevision: 'def1',
    saveBinding: saveBinding(item.tradeId),
    ...over,
  };
}

function cardFacade(overview: Ready = review()): UiFacade {
  const facade = facadeDouble();
  vi.mocked(facade.DailyReview.open).mockResolvedValue(overview);
  vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ tradeId }) => {
    const found = WALK.find((t) => t.tradeId === tradeId)!;
    return Promise.resolve({ kind: 'Ready', reviewDate: MONDAY, cutoff: CUTOFF, trade: tradeReview(found) });
  });
  return facade;
}

function renderReview(facade: UiFacade, options: { writable?: boolean; onDirtyChange?: (dirty: boolean) => void } = {}) {
  render(
    <RuntimeContext.Provider value={{ writable: options.writable ?? true, timeZone: 'America/New_York', report: () => undefined }}>
      <MemoryRouter initialEntries={['/review']}>
        <ReviewView facade={facade} now={() => '2026-10-12T21:00:00Z'} onDirtyChange={options.onDirtyChange ?? (() => undefined)} />
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}

// The Marks panel of the open card, once it has rendered.
const marksPanel = () => screen.findByRole('region', { name: 'Marks' });
const rowOf = (panel: HTMLElement, symbol: string, date: string) => within(panel).getByRole('region', { name: `${symbol} Mark, ${date}` });

// Save Marks moves the card on to its next panel that is not done; the Marks come back by their header.
async function backToMarks(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole('button', { name: /^Action\b/ }).getAttribute('aria-expanded')).toBe('true'));
  await user.click(screen.getByRole('button', { name: /^Marks\b/ }));
}

const FRIDAY_LABEL = 'Fri Oct 9';
const MONDAY_LABEL = 'Mon Oct 12';

// What Save Marks answers when every entry was written: each key's resolution, and the Review under them.
const savedKey = (instrumentKey: string, tradingDate: string, price: string): Extract<SaveResult, { kind: 'MarksSaved' }>['marks'][number] => ({
  key: { instrumentKey, tradingDate },
  resolution: available(price),
  resolutionRevision: 1,
  classification: 'InitialManual',
});
function marksSavedResult(marks: readonly Extract<SaveResult, { kind: 'MarksSaved' }>['marks'][number][], review: Extract<SaveResult, { kind: 'MarksSaved' }>['review'] = readyReview()): SaveResult {
  return { kind: 'MarksSaved', marks, review };
}
function readyReview(over: Partial<Extract<Extract<SaveResult, { kind: 'MarksSaved' }>['review'], { kind: 'Ready' }>> = {}): Extract<Extract<SaveResult, { kind: 'MarksSaved' }>['review'], { kind: 'Ready' }> {
  const trade = tradeReview(TA);
  return {
    kind: 'Ready',
    progress: { tradesWithAction: 0, tradesEligible: 3 },
    completion: OWING,
    binding: newBinding,
    trades: WALK,
    trade,
    nextStep: { kind: 'Trade', trade },
    ...over,
  };
}

describe('drafts', () => {
  it('should mark a typed price and a Cant get a price with its reason as Unsaved, count them on Save Marks, make no call, and drop them all on Discard', async () => {
    const facade = cardFacade();
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanel();
    expect(within(panel).queryByText('Unsaved')).toBeNull();

    await user.type(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByLabelText('Price'), '52.00');
    const friday = rowOf(panel, 'XYZ', FRIDAY_LABEL);
    await user.click(within(friday).getByRole('button', { name: "Can't get a price" }));
    await user.type(within(friday).getByLabelText('Reason (required)'), 'no quote');

    expect(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByText('Unsaved')).toBeTruthy();
    expect(within(friday).getByText('Unsaved')).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Save Marks (2)' })).toBeTruthy();
    // Nothing is written until Save Marks.
    expect(facade.MarketData.save).not.toHaveBeenCalled();
    expect(facade.DailyReview.save).not.toHaveBeenCalled();

    await user.click(within(panel).getByRole('button', { name: 'Discard' }));
    expect(within(panel).queryByText('Unsaved')).toBeNull();
    expect(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByLabelText<HTMLInputElement>('Price').value).toBe('');
    expect(within(rowOf(panel, 'XYZ', FRIDAY_LABEL)).queryByLabelText('Reason (required)')).toBeNull();
    expect(within(panel).getByRole<HTMLButtonElement>('button', { name: 'Save Marks (0)' }).disabled).toBe(true);
    expect(facade.DailyReview.save).not.toHaveBeenCalled();
  });
});

describe('Save Marks (P37, A155)', () => {
  it('should send one SaveReviewMarks command with the card Trade, the overview binding, and every draft with its expected revision', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([savedKey('XYZ', MONDAY, '52.00'), savedKey('XYZ', FRIDAY, '51.00')]));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanel();
    await user.type(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByLabelText('Price'), ' 52.00');
    const friday = rowOf(panel, 'XYZ', FRIDAY_LABEL);
    await user.click(within(friday).getByRole('button', { name: "Can't get a price" }));
    await user.type(within(friday).getByLabelText('Reason (required)'), 'no quote');

    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));

    expect(facade.DailyReview.save).toHaveBeenCalledTimes(1);
    expect(facade.DailyReview.save).toHaveBeenCalledWith({
      kind: 'SaveReviewMarks',
      reviewDate: MONDAY,
      tradeId: 't-a',
      binding,
      entries: [
        { key: { instrumentKey: 'XYZ', tradingDate: MONDAY }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '52.00' } },
        { key: { instrumentKey: 'XYZ', tradingDate: FRIDAY }, expectedRevision: 'None', intention: { kind: 'AssertUnavailable', reason: 'no quote' } },
      ],
    });
    // Neither the single-key save nor a read is made for it.
    expect(facade.MarketData.save).not.toHaveBeenCalled();
  });
});

const value = (n: bigint, d = 1n) => ({ kind: 'Value' as const, value: Rational.of(n, d) });
const XYZ_SYMBOL = { kind: 'Stock' as const, symbol: 'XYZ' };
// T-A's card as the save result evaluates it, with XYZ 52.00.
const EVALUATED = {
  kind: 'Evaluated',
  valuationDate: MONDAY,
  coverage: { kind: 'Available', revisionId: 'r1', revisionNumber: 1 },
  observation: { instrument: XYZ_SYMBOL, tradingDate: MONDAY, mark: { revisionId: 'r1', revisionNumber: 1, price: '52.00' } },
  currentMarkedPnl: value(582n),
  currentMarkedPnlInPlanR: value(582n, 250n),
  ongoingRiskToStop: value(400n),
  ongoingRiskToStopInPlanR: value(8n, 5n),
  worstCaseOngoingRisk: value(5000n),
  worstCaseOngoingRiskInPlanR: value(20n),
  incrementalRewardToTarget: value(1200n),
  incrementalRewardToTargetInPlanR: value(24n, 5n),
  rewardRiskNow: value(3n),
  planBaseline: { kind: 'Value' as const, value: { rewardRiskRatio: Rational.of(12n, 5n) } },
  atEntry: null,
} as unknown as DailyTradeReview['evaluation'];
// T-F shares XYZ: once the Mark is saved its slider is placed.
const TF_PLACED = walked('t-f', 'XYZ', { summary: TF.summary, rangePosition: { kind: 'Value', value: { now: rational(1n, 2n), atEntry: rational(1n, 4n) } }, figures: { riskToStop: value(200n), pnl: value(100n), rewardRiskNow: value(3n, 4n) } });
// T-F's collapsed card, picked by its header's name: the two XYZ cards read alike but for the summary line (decision 68).
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tfHeader = () => screen.getByRole('button', { name: new RegExp(`^Review XYZ ${escaped(tradeSummary(TF.summary!))}\\b`) });
const AFTER_XYZ: ReviewCompletion = { kind: 'Incomplete', reasons: [markMissing('DEF', 't-c'), ...actionMissing('t-a', 't-f', 't-c')] };

describe('Save Marks (P37, A155) rendering', () => {
  it('should render every row, the card figures, and every collapsed card summary and slider from the MarksSaved result, with no open or getTrade call, and open the next panel that is not done', async () => {
    const facade = cardFacade();
    const trade = tradeReview(TA, { evaluation: EVALUATED });
    vi.mocked(facade.DailyReview.save).mockResolvedValue(
      marksSavedResult([savedKey('XYZ', MONDAY, '52.00'), savedKey('XYZ', FRIDAY, '51.00')], readyReview({ completion: AFTER_XYZ, trades: [TA, TF_PLACED, TC], trade, nextStep: { kind: 'Trade', trade } })),
    );
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanel();
    expect(screen.queryByText('Current Marked Trade P&L')).toBeNull();
    const otherHeader = tfHeader();
    expect(otherHeader.textContent).toContain('1 Mark');
    await user.type(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByLabelText('Price'), '52.00');
    await user.type(within(rowOf(panel, 'XYZ', FRIDAY_LABEL)).getByLabelText('Price'), '51.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));

    // The next panel that is not done opens (no reflection is owed, so the Action), and the Marks come back by their header.
    await backToMarks(user);
    expect(screen.getByRole('button', { name: /^Marks\b/ }).getAttribute('aria-expanded')).toBe('true');
    // Every row shows its saved Mark, and nothing is Unsaved.
    await waitFor(() => expect(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByText('$52.00', { exact: false })).toBeTruthy());
    expect(within(rowOf(panel, 'XYZ', FRIDAY_LABEL)).getByText('$51.00', { exact: false })).toBeTruthy();
    expect(within(panel).queryByText('Unsaved')).toBeNull();
    expect(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByRole('button', { name: 'Correct' })).toBeTruthy();
    // The card's figures come from the result.
    const card = screen.getByRole('region', { name: 'XYZ review' });
    expect(within(card).getByText('Current Marked Trade P&L')).toBeTruthy();
    // The other XYZ card's summary and slider follow the shared Mark.
    const sharedHeader = tfHeader();
    expect(sharedHeader.textContent).not.toContain('1 Mark');
    expect(within(sharedHeader.closest('li')!).getByRole('img').getAttribute('aria-label')).toContain('50% of the way');
    // No read followed the save.
    expect(facade.DailyReview.open).toHaveBeenCalledTimes(1);
    expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1);
  });
});

describe('Save Marks (P37, A155) pending', () => {
  it('should keep a draft typed or changed while Save Marks was pending, and clear only the drafts that were sent unchanged, when the result is MarksSaved', async () => {
    const facade = cardFacade();
    let finish: (result: SaveResult) => void = () => undefined;
    vi.mocked(facade.DailyReview.save).mockImplementation(() => new Promise<SaveResult>((resolve) => (finish = resolve)));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanel();
    await user.type(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByLabelText('Price'), '52.00');
    await user.type(within(rowOf(panel, 'XYZ', FRIDAY_LABEL)).getByLabelText('Price'), '51.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));

    // While it is pending: one sent draft is changed.
    await user.type(within(rowOf(panel, 'XYZ', FRIDAY_LABEL)).getByLabelText('Price'), '1');
    finish(marksSavedResult([savedKey('XYZ', MONDAY, '52.00'), savedKey('XYZ', FRIDAY, '51.00')]));
    await backToMarks(user);

    // Monday was sent unchanged, so it shows its saved Mark; Friday stays Unsaved with what was typed.
    await waitFor(() => expect(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByText('$52.00', { exact: false })).toBeTruthy());
    expect(within(panel).getByRole('button', { name: 'Save Marks (1)' })).toBeTruthy();
    expect(within(rowOf(panel, 'XYZ', FRIDAY_LABEL)).getByLabelText<HTMLInputElement>('Price').value).toBe('51.001');
  });

  it('should keep a draft for a key that was not sent when the result is MarksSaved', async () => {
    const facade = cardFacade();
    let finish: (result: SaveResult) => void = () => undefined;
    vi.mocked(facade.DailyReview.save).mockImplementation(() => new Promise<SaveResult>((resolve) => (finish = resolve)));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanel();
    await user.type(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByLabelText('Price'), '52.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    await user.type(within(rowOf(panel, 'XYZ', FRIDAY_LABEL)).getByLabelText('Price'), '51.00');
    finish(marksSavedResult([savedKey('XYZ', MONDAY, '52.00')]));
    await backToMarks(user);

    await waitFor(() => expect(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByText('$52.00', { exact: false })).toBeTruthy());
    expect(within(panel).getByRole('button', { name: 'Save Marks (1)' })).toBeTruthy();
    expect(within(rowOf(panel, 'XYZ', FRIDAY_LABEL)).getByLabelText<HTMLInputElement>('Price').value).toBe('51.00');
  });
});

describe('Save Marks (P37, A155) refused', () => {
  it('should show each returned issue beside its row, move focus to the first, and keep every draft, when the result is Rejected', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValue({
      kind: 'Rejected',
      issues: [
        { entryIndex: 0, field: 'price', code: 'InvalidPrice' },
        { entryIndex: 1, field: 'price', code: 'PriceNegative' },
      ],
    });
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanel();
    const monday = rowOf(panel, 'XYZ', MONDAY_LABEL);
    const friday = rowOf(panel, 'XYZ', FRIDAY_LABEL);
    await user.type(within(monday).getByLabelText('Price'), 'abc');
    await user.type(within(friday).getByLabelText('Price'), '-1');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));

    await waitFor(() => expect(within(monday).getByText('Enter a price as a number, with at most 6 decimal places.')).toBeTruthy());
    expect(within(friday).getByText('A price cannot be negative.')).toBeTruthy();
    expect(document.activeElement).toBe(within(monday).getByLabelText('Price'));
    expect(within(monday).getByLabelText('Price').getAttribute('aria-invalid')).toBe('true');
    // Every draft is kept for correction.
    expect(within(monday).getByLabelText<HTMLInputElement>('Price').value).toBe('abc');
    expect(within(friday).getByLabelText<HTMLInputElement>('Price').value).toBe('-1');
    expect(within(panel).getByRole('button', { name: 'Save Marks (2)' })).toBeTruthy();
  });
});

describe('Save Marks (P37, A155) conflicted', () => {
  it('should show Conflict with each changed key current resolution and keep the drafts when the result is Conflict', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({
      kind: 'Conflict',
      keys: [{ entryIndex: 0, key: { instrumentKey: 'XYZ', tradingDate: MONDAY }, code: 'StaleRevision', resolution: available('51.50', 2), resolutionRevision: 2 }],
    });
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanel();
    const monday = rowOf(panel, 'XYZ', MONDAY_LABEL);
    const friday = rowOf(panel, 'XYZ', FRIDAY_LABEL);
    await user.type(within(monday).getByLabelText('Price'), '52.00');
    await user.type(within(friday).getByLabelText('Price'), '51.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));

    // The key that moved shows what it is now, and says nothing was saved.
    await waitFor(() => expect(within(monday).getByText('$51.50', { exact: false })).toBeTruthy());
    expect(within(monday).getByRole('alert').textContent).toContain('Nothing was saved');
    expect(within(friday).queryByRole('alert')).toBeNull();
    // Every draft is kept, and the retry binds to the revision the Conflict reported.
    expect(within(monday).getByLabelText<HTMLInputElement>('Price').value).toBe('52.00');
    expect(within(friday).getByLabelText<HTMLInputElement>('Price').value).toBe('51.00');
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce(marksSavedResult([savedKey('XYZ', MONDAY, '52.00'), savedKey('XYZ', FRIDAY, '51.00')]));
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));
    await waitFor(() => expect(facade.DailyReview.save).toHaveBeenCalledTimes(2));
    expect(vi.mocked(facade.DailyReview.save).mock.calls[1]![0]).toMatchObject({ entries: [{ expectedRevision: 2 }, { expectedRevision: 'None' }] });
  });
});

describe('Save Marks (P37, A155) with the Review changed during assembly', () => {
  it('should render the saved rows and offer Refresh, which calls open and getTrade, when the result Review part is ChangedDuringAssembly', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([savedKey('XYZ', MONDAY, '52.00')], { kind: 'ChangedDuringAssembly' }));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanel();
    await user.type(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByLabelText('Price'), '52.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));

    await waitFor(() => expect(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByText('$52.00', { exact: false })).toBeTruthy());
    expect(within(panel).getByText(/figures are out of date/)).toBeTruthy();
    expect(facade.DailyReview.open).toHaveBeenCalledTimes(1);
    expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1);

    await user.click(within(panel).getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(within(panel).queryByText(/figures are out of date/)).toBeNull());
  });

  it('should clear the out-of-date notice and its Refresh when a later Save Marks returns a Ready Review', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce(marksSavedResult([savedKey('XYZ', MONDAY, '52.00')], { kind: 'ChangedDuringAssembly' }));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanel();
    await user.type(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByLabelText('Price'), '52.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    await waitFor(() => expect(within(panel).getByText(/figures are out of date/)).toBeTruthy());

    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce(marksSavedResult([savedKey('XYZ', FRIDAY, '51.00')]));
    await user.type(within(rowOf(panel, 'XYZ', FRIDAY_LABEL)).getByLabelText('Price'), '51.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));

    await waitFor(() => expect(within(panel).queryByText(/figures are out of date/)).toBeNull());
    expect(within(panel).queryByRole('button', { name: 'Refresh' })).toBeNull();
  });
});

describe('keyboard', () => {
  it('should move focus to the next price on Enter, and from the last price to Save Marks', async () => {
    const facade = cardFacade();
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanel();
    const monday = within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByLabelText('Price');
    const friday = within(rowOf(panel, 'XYZ', FRIDAY_LABEL)).getByLabelText('Price');

    await user.type(monday, '52.00{Enter}');
    expect(document.activeElement).toBe(friday);
    await user.type(friday, '51.00{Enter}');
    expect(document.activeElement).toBe(within(panel).getByRole('button', { name: 'Save Marks (2)' }));
    // Enter only moves on: nothing is saved until Save Marks is pressed.
    expect(facade.DailyReview.save).not.toHaveBeenCalled();
  });
});

describe('rows with a Mark', () => {
  it('should keep D4 per-row Correct and Withdraw for a row with an exact Mark or an acknowledgment, saving through MarketData.save as today', async () => {
    const acknowledged: MarkResolution = { kind: 'AcknowledgedUnavailable', acknowledgment: { versionId: 'a1', kind: 'Asserted', reason: 'no quote', savedAt: '2026-10-12T21:00:00Z' } };
    const rows: MarkRow[] = [
      { instrumentKey: 'XYZ', tradingDate: MONDAY, trades: ['t-a', 't-f'], resolution: available('52.00', 3), resolutionRevision: 3, task: null },
      { instrumentKey: 'ABC', tradingDate: MONDAY, trades: ['t-a'], resolution: acknowledged, resolutionRevision: 2, task: null },
    ];
    const facade = cardFacade(review({ families: [{ family: 'Marks', today: rows, earlier: [] }, { family: 'Trades', trades: WALK }] }));
    vi.mocked(facade.MarketData.save).mockResolvedValue({ kind: 'Conflict', key: { instrumentKey: 'XYZ', tradingDate: MONDAY }, resolution: available('52.00', 3), resolutionRevision: 3 });
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanel();

    const xyz = rowOf(panel, 'XYZ', MONDAY_LABEL);
    expect(within(xyz).queryByLabelText('Price')).toBeNull();
    await user.click(within(xyz).getByRole('button', { name: 'Correct' }));
    await user.type(within(xyz).getByLabelText('Price'), '51.5');
    await user.type(within(xyz).getByLabelText('Reason (required)'), 'typo');
    await user.click(within(xyz).getByRole('button', { name: 'Save correction' }));
    expect(facade.MarketData.save).toHaveBeenLastCalledWith({ intention: 'CorrectMark', instrumentKey: 'XYZ', tradingDate: MONDAY, price: '51.5', reason: 'typo', expectedResolutionRevision: 3 });
    await user.click(within(xyz).getByRole('button', { name: 'Cancel' }));

    const abc = rowOf(panel, 'ABC', MONDAY_LABEL);
    await user.click(within(abc).getByRole('button', { name: 'Withdraw' }));
    expect(facade.MarketData.save).toHaveBeenLastCalledWith({ intention: 'WithdrawAcknowledgment', instrumentKey: 'ABC', tradingDate: MONDAY, expectedResolutionRevision: 2 });
    // Neither goes through Save Marks.
    expect(facade.DailyReview.save).not.toHaveBeenCalled();
  });
});

describe('two quick row saves', () => {
  it('should refresh after both and show no could-not-refresh notice when a second per-row save finishes while the first refresh is still in flight', async () => {
    const rows: MarkRow[] = [
      { instrumentKey: 'XYZ', tradingDate: MONDAY, trades: ['t-a', 't-f'], resolution: available('52.00', 1), resolutionRevision: 1, task: null },
      { instrumentKey: 'ABC', tradingDate: MONDAY, trades: ['t-a'], resolution: available('27.50', 1), resolutionRevision: 1, task: null },
    ];
    const overview = review({ families: [{ family: 'Marks', today: rows, earlier: [] }, { family: 'Trades', trades: WALK }] });
    const facade = cardFacade(overview);
    // The first read at mount answers; the refresh after the first save waits to be released.
    let release: (result: Ready) => void = () => undefined;
    vi.mocked(facade.DailyReview.open)
      .mockResolvedValueOnce(overview)
      .mockImplementationOnce(() => new Promise<Ready>((resolve) => (release = resolve)));
    vi.mocked(facade.MarketData.save).mockImplementation((command) => {
      const key = { instrumentKey: command.instrumentKey, tradingDate: command.tradingDate };
      return Promise.resolve({ kind: 'Saved', key, resolution: available('50.00', 2), resolutionRevision: 2, classification: 'Correction', revision: {} as never, binding: { ...key, expectedResolutionRevision: 1 } });
    });
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanel();
    for (const symbol of ['XYZ', 'ABC']) {
      const row = rowOf(panel, symbol, MONDAY_LABEL);
      await user.click(within(row).getByRole('button', { name: 'Correct' }));
      await user.type(within(row).getByLabelText('Price'), '50.00');
      await user.type(within(row).getByLabelText('Reason (required)'), 'typo');
      await user.click(within(row).getByRole('button', { name: 'Save correction' }));
    }
    await waitFor(() => expect(facade.MarketData.save).toHaveBeenCalledTimes(2));
    release(overview);

    await waitFor(() => expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(3));
    expect(facade.DailyReview.open).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/couldn’t refresh/)).toBeNull();
  });
});

describe('earlier sessions after a save', () => {
  it('should keep an earlier session saved Mark when the trader pages away and back', async () => {
    const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}`;
    const missing = Array.from({ length: 25 }, (_, i) => day(i + 1));
    const gap: Earlier[number] = { ...xyzGap, trades: [{ tradeId: 't-a', from: day(1) }], missing, revisions: Object.fromEntries(missing.map((d) => [d, 'None'])) };
    const rows: MarkRow[] = [{ instrumentKey: 'XYZ', tradingDate: MONDAY, trades: ['t-a', 't-f'], resolution: available('52.00', 1), resolutionRevision: 1, task: null }];
    const facade = cardFacade(review({ families: [{ family: 'Marks', today: rows, earlier: [gap] }, { family: 'Trades', trades: WALK }] }));
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([savedKey('XYZ', day(25), '9')]));
    renderReview(facade);
    const user = userEvent.setup();
    const list = await screen.findByRole('region', { name: 'XYZ earlier sessions' });
    await user.type(within(screen.getByRole('region', { name: 'XYZ Mark, Fri Sep 25' })).getByLabelText('Price'), '9');
    await user.click(screen.getByRole('button', { name: 'Save Marks (1)' }));
    await backToMarks(user);
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'XYZ Mark, Fri Sep 25' })).getByText('$9.00', { exact: false })).toBeTruthy());

    await user.click(within(list).getByRole('button', { name: 'Next page' }));
    await user.click(within(list).getByRole('button', { name: 'Previous page' }));

    const first = screen.getByRole('region', { name: 'XYZ Mark, Fri Sep 25' });
    expect(within(first).getByText('$9.00', { exact: false })).toBeTruthy();
    expect(within(first).getByRole('button', { name: 'Correct' })).toBeTruthy();
  });
});

describe('earlier sessions after Refresh', () => {
  it('should send an earlier-session draft with the resolution and revision of the newest Review after Refresh, not those of the first snapshot', async () => {
    const acknowledgment = { versionId: 'a1', kind: 'Asserted' as const, reason: 'no quote', savedAt: '2026-10-12T21:00:00Z' };
    const changedGap: Earlier[number] = { ...xyzGap, missing: [], acknowledged: [FRIDAY], revisions: { [FRIDAY]: 4 }, acknowledgments: { [FRIDAY]: acknowledgment } };
    const changed = review({ families: [{ family: 'Marks', today: [missingRow('XYZ', ['t-a', 't-f']), missingRow('DEF', ['t-c'])], earlier: [changedGap] }, { family: 'Trades', trades: WALK }] });
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'ReviewChanged', evidence: { marketDataSnapshotId: 'mds1:2:def', frames: [] } }).mockResolvedValueOnce(marksSavedResult([savedKey('XYZ', FRIDAY, '51.00')]));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanel();
    await user.type(within(rowOf(panel, 'XYZ', FRIDAY_LABEL)).getByLabelText('Price'), '51.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    await within(panel).findByRole('alert');

    vi.mocked(facade.DailyReview.open).mockResolvedValue(changed);
    await user.click(within(panel).getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(rowOf(panel, 'XYZ', FRIDAY_LABEL)).getByText('Acknowledged Unavailable')).toBeTruthy());
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));

    await waitFor(() => expect(facade.DailyReview.save).toHaveBeenCalledTimes(2));
    expect(vi.mocked(facade.DailyReview.save).mock.calls[1]![0]).toMatchObject({ entries: [{ key: { instrumentKey: 'XYZ', tradingDate: FRIDAY }, expectedRevision: 4 }] });
  });
});

describe('Save Marks (P37, A155) not written', () => {
  it('should say nothing was saved, keep the drafts, and offer Refresh when the Review changed, and say so when storage failed', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'ReviewChanged', evidence: { marketDataSnapshotId: 'mds1:2:def', frames: [] } }).mockResolvedValueOnce({ kind: 'StorageFailure' } as SaveResult);
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanel();
    await user.type(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByLabelText('Price'), '52.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));

    expect((await within(panel).findByRole('alert')).textContent).toContain('The Review changed');
    expect(within(panel).getByRole('alert').textContent).toContain('Nothing was saved');
    expect(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByLabelText<HTMLInputElement>('Price').value).toBe('52.00');
    await user.click(within(panel).getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));

    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    await waitFor(() => expect(within(panel).getByRole('alert').textContent).toContain('could not be saved'));
    expect(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByLabelText<HTMLInputElement>('Price').value).toBe('52.00');
  });
});

describe('Save Marks (P37, A155) when the runtime turns read only', () => {
  it('should let the card close, with nothing left dirty, after Save Marks returns RuntimeNotWritable and the card turns read only, its drafts unsaved', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'RuntimeNotWritable', runtimeReadiness: 'RecoveryOnly', failedChecks: [], workspaceStatus: 'RecoveryOnly', safeActions: [] } as unknown as SaveResult);
    const onDirtyChange = vi.fn();
    // A shell in miniature: a refusal switches the runtime to read only.
    function Shell() {
      const [writable, setWritable] = useState(true);
      return (
        <RuntimeContext.Provider value={{ writable, timeZone: 'America/New_York', report: (result) => result.kind === 'RuntimeNotWritable' && setWritable(false) }}>
          <MemoryRouter initialEntries={['/review']}>
            <ReviewView facade={facade} now={() => '2026-10-12T21:00:00Z'} onDirtyChange={onDirtyChange} />
          </MemoryRouter>
        </RuntimeContext.Provider>
      );
    }
    render(<Shell />);
    const user = userEvent.setup();
    const panel = await marksPanel();
    await user.type(within(rowOf(panel, 'XYZ', MONDAY_LABEL)).getByLabelText('Price'), '52.00');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));

    // Read only: no draft fields, and nothing holds the card.
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    expect(within(panel).queryByRole('button', { name: /Save Marks/ })).toBeNull();
    const open = screen.getAllByRole('button', { name: /^Review / }).find((header) => header.getAttribute('aria-expanded') === 'true')!;
    await user.click(open);
    expect(screen.queryByRole('region', { name: 'Marks' })).toBeNull();
    expect(screen.queryByText(/Save or discard what you entered/)).toBeNull();
  });
});

describe('rows (A153)', () => {
  it('should list the card Review-date rows first, with also held by on XYZ, then its earlier sessions without Marks under the optional heading, and show T-F no Friday row', async () => {
    renderReview(cardFacade());
    const user = userEvent.setup();

    const panel = await marksPanel();
    const today = within(panel).getByRole('list', { name: "Today's Marks" });
    expect(within(today).getAllByRole('heading', { level: 4 }).map((h) => h.textContent)).toEqual(['XYZ']);
    // The shared Instrument names the other Trade holding it, linked; a row never lists its own card's Trade.
    const xyz = within(today).getAllByRole('listitem')[0]!;
    // It names that Trade by its summary line, as the Trade list shows it (decision 67), not by the shared Underlying.
    expect(within(xyz).getByText(/also held by/)).toBeTruthy();
    const link = within(xyz).getByRole('link', { name: 'Long 100 shares @ $50.00' });
    expect(link.getAttribute('href')).toBe('/trades/t-f');
    expect(within(xyz).getAllByRole('link')).toHaveLength(1);
    // The earlier sessions follow the Review-date rows, under their heading.
    expect(within(panel).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(["Today's Marks", 'Earlier sessions without Marks — optional']);
    const earlier = within(panel).getByRole('region', { name: 'XYZ earlier sessions' });
    expect(within(earlier).getAllByRole('listitem').map((row) => within(row).getByText('Fri Oct 9').textContent)).toEqual(['Fri Oct 9']);

    // T-F is relevant to XYZ only from Monday: its card has the Review-date row and no Friday row.
    await user.click(tfHeader());
    await waitFor(() => expect(tfHeader().getAttribute('aria-expanded')).toBe('true'));
    const other = await marksPanel();
    expect(within(other).getByText(/also held by/)).toBeTruthy();
    expect(within(other).queryByText('Fri Oct 9')).toBeNull();
    expect(within(other).queryByText('Earlier sessions without Marks — optional')).toBeNull();
  });
});
