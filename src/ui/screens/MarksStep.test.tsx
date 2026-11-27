// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { DailyTradeReview, IncompleteReason, MarkResolution, MarkRow, MeterReading, OpenDailyReviewResult, ReviewBinding, ReviewCompletion, WalkedTrade } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { tradeSummary } from '../format.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ReviewView } from './ReviewView.tsx';
import { cardProgress } from '../../../tests/support/card-progress.ts';
import { dayOf } from '../../../tests/support/review-day.ts';

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
const missingRow = (instrumentKey: string, trades: readonly string[]): MarkRow => ({ instrumentKey, instrument: { kind: 'Stock', symbol: instrumentKey }, tradingDate: MONDAY, trades, resolution: { kind: 'Missing' }, resolutionRevision: 'None', task: 'Manual' });
const walked = (tradeId: string, underlying: string, over: Partial<WalkedTrade> = {}): WalkedTrade => ({
  tradeId,
  underlying,
  lastActivity: '2026-10-12T14:00:00Z',
  band: 'Routine',
  reasons: [{ code: 'NoPressure' }],
  basis: { kind: 'Value', value: { side: 'None', share: rational(0n) } },
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
  instrument: { kind: 'Stock', symbol: 'XYZ' },
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
  const built: Ready = {
    kind: 'Ready',
    reviewDate: MONDAY,
    cutoff: CUTOFF,
    families: [
      { family: 'Marks', earlierMarks: [], today: [missingRow('XYZ', ['t-a', 't-f']), missingRow('DEF', ['t-c'])], earlier: [xyzGap] },
      { family: 'Trades', trades: WALK },
    ],
    owed: [],
    completion: OWING,
    binding,
    ...over,
  };
  return over.day ? built : { ...built, day: dayOf(built) };
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
    settlement: [],
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

function renderReview(facade: UiFacade, options: { writable?: boolean; onDirtyChange?: (dirty: boolean) => void; at?: string } = {}) {
  render(
    <RuntimeContext.Provider value={{ writable: options.writable ?? true, timeZone: 'America/New_York', report: () => undefined }}>
      <MemoryRouter initialEntries={[options.at ?? '/review']}>
        <ReviewView facade={facade} now={() => '2026-10-12T21:00:00Z'} onDirtyChange={options.onDirtyChange ?? (() => undefined)} />
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}

// The Marks step: one grid for the page, headed "Marks for <date>" (W104).
const marksPanel = () => screen.findByRole('region', { name: /^Marks for / });
// The step with its skipped sessions' columns added, when the Review lists any (the moved cases read them).
async function marksPanelWithEarlier() {
  const step = await marksPanel();
  const add = within(step).queryByRole('button', { name: 'Add the skipped sessions' });
  if (add) await userEvent.setup().click(add);
  return step;
}
// A Missing cell is an input named after it; once it holds a Mark it is a button of that name (P158).
const inputOf = (panel: HTMLElement, symbol: string, date: string) => within(panel).getByRole<HTMLInputElement>('textbox', { name: `${symbol} Mark, ${date}` });
// Choosing a cell (focusing its input, or pressing its button) opens its editor, a region named after it.
async function choose(user: ReturnType<typeof userEvent.setup>, panel: HTMLElement, symbol: string, date: string) {
  const name = `${symbol} Mark, ${date}`;
  await user.click(within(panel).queryByRole('textbox', { name }) ?? within(panel).getByRole('button', { name }));
  return within(panel).getByRole('region', { name });
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

// The Marks grid (P158): the fixture's Marks family with the grid's fields, for T-A (XYZ held from Friday) and T-F (XYZ from Monday).
const THURSDAY = '2026-10-08';
const WEDNESDAY = '2026-10-07';
const markAt = (price: string, revisionNumber = 1) => ({ resolution: available(price, revisionNumber) as Extract<MarkResolution, { kind: 'Available' }>, resolutionRevision: revisionNumber });
type MarksFamily = Extract<Ready['families'][number], { family: 'Marks' }>;
function gridReview(over: Partial<Omit<MarksFamily, 'family'>> = {}): Ready {
  const family: MarksFamily = { family: 'Marks', today: [missingRow('XYZ', ['t-a', 't-f']), missingRow('DEF', ['t-c'])], earlier: [], earlierMarks: [], previousSession: FRIDAY, ...over };
  return review({ families: [family, { family: 'Trades', trades: WALK }] });
}
const xyzMarks = (marks: Record<string, ReturnType<typeof markAt>>, from = FRIDAY) => ({ instrumentKey: 'XYZ', instrument: { kind: 'Stock' as const, symbol: 'XYZ' }, trades: [{ tradeId: 't-a', from }, { tradeId: 't-f', from: MONDAY }], marks });
const abcRow = missingRow('ABC', ['t-a']);
const abcMarks = (marks: Record<string, ReturnType<typeof markAt>>, from = FRIDAY) => ({ instrumentKey: 'ABC', instrument: { kind: 'Stock' as const, symbol: 'ABC' }, trades: [{ tradeId: 't-a', from }], marks });
const gridOf = (panel: HTMLElement) => within(panel).getByRole('table');
const cellOf = (panel: HTMLElement, symbol: string, date: string) => within(panel).getByRole('button', { name: `${symbol} Mark, ${date}` });

describe('the Marks step (T95.12)', () => {
  it('should show one row per Instrument on the page, in the Trades order, with the previous session Mark, the Review Date input and the change', async () => {
    // The Review lists DEF before XYZ; the Trades walk holds XYZ first (T-A, T-F), then DEF (T-C).
    renderReview(cardFacade(gridReview({ today: [missingRow('DEF', ['t-c']), missingRow('XYZ', ['t-a', 't-f'])], earlierMarks: [{ ...xyzMarks({ [FRIDAY]: markAt('51') }), instrumentKey: 'DEF', instrument: { kind: 'Stock', symbol: 'DEF' }, trades: [{ tradeId: 't-c', from: FRIDAY }], marks: { [FRIDAY]: markAt('27.5') } }, xyzMarks({ [FRIDAY]: markAt('51') })] })));
    const step = await marksPanel();
    const table = gridOf(step);

    expect(within(step).getByRole('heading', { name: 'Marks for Mon Oct 12' })).toBeTruthy();
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Instrument', 'Fri Oct 9', 'Mon Oct 12', 'Change']);
    expect(within(table).getAllByRole('rowheader').map((header) => header.textContent)).toEqual(['XYZ', 'DEF']);
    expect(cellOf(step, 'XYZ', 'Fri Oct 9').textContent).toContain('51.00');
    expect(cellOf(step, 'DEF', 'Fri Oct 9').textContent).toContain('27.50');
    expect(within(step).getByRole('textbox', { name: 'XYZ Mark, Mon Oct 12' })).toBeTruthy();
    expect(within(step).getByRole('textbox', { name: 'DEF Mark, Mon Oct 12' })).toBeTruthy();
    // Each row has its previous Mark, its Review Date cell and its change cell.
    expect(within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').length)).toEqual([3, 3]);
  });

  it('should show an Instrument held by two Trades once', async () => {
    // XYZ is held by T-A and T-F: the Review lists it on the Review Date, in a gap and in the earlier Marks, and the grid has one row for it.
    renderReview(cardFacade(gridReview({ earlier: [xyzGap], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') })] })));
    const step = await marksPanel();

    expect(within(gridOf(step)).getAllByRole('rowheader').map((header) => header.textContent)).toEqual(['XYZ', 'DEF']);
    expect(within(step).getAllByRole('textbox', { name: 'XYZ Mark, Mon Oct 12' })).toHaveLength(1);
  });

  it('should show the change from the previous Mark as a price is typed', async () => {
    renderReview(cardFacade(gridReview({ earlierMarks: [xyzMarks({ [FRIDAY]: markAt('45.10') })] })));
    const user = userEvent.setup();
    const step = await marksPanel();
    const row = within(gridOf(step)).getByRole('rowheader', { name: 'XYZ' }).closest('tr')!;
    // Nothing is typed, so there is no change.
    expect(within(row).queryByText(/%/)).toBeNull();

    await user.type(within(step).getByRole('textbox', { name: 'XYZ Mark, Mon Oct 12' }), '44.00');
    expect(within(row).getByText('−$1.10 (−2.4%)')).toBeTruthy();
    await user.clear(within(step).getByRole('textbox', { name: 'XYZ Mark, Mon Oct 12' }));
    await user.type(within(step).getByRole('textbox', { name: 'XYZ Mark, Mon Oct 12' }), '49.00');
    expect(within(row).getByText('+$3.90 (+8.6%)')).toBeTruthy();
    // DEF has no previous Mark to measure from.
    const defRow = within(gridOf(step)).getByRole('rowheader', { name: 'DEF' }).closest('tr')!;
    await user.type(within(step).getByRole('textbox', { name: 'DEF Mark, Mon Oct 12' }), '30.00');
    expect(within(defRow).queryByText(/%/)).toBeNull();
  });

  it("should mark Can't get a price with its reason, and undo it", async () => {
    renderReview(cardFacade(gridReview({ earlierMarks: [xyzMarks({ [FRIDAY]: markAt('45.10') })] })));
    const user = userEvent.setup();
    const step = await marksPanel();
    const row = within(gridOf(step)).getByRole('rowheader', { name: 'XYZ' }).closest('tr')!;

    await user.click(within(row).getByRole('button', { name: /^Can't get a price/ }));
    const why = within(row).getByPlaceholderText('Why no price? Halted, no quote…');
    expect(document.activeElement).toBe(why);
    // A reason is required: nothing is held without one.
    await user.click(within(row).getByRole('button', { name: 'No price' }));
    expect(within(row).getByText("Enter why you can't get a price.")).toBeTruthy();
    expect(within(step).getByRole('button', { name: 'Save Marks (0)' })).toBeTruthy();

    await user.type(why, 'Halted');
    await user.click(within(row).getByRole('button', { name: 'No price' }));
    // The cell says no price, the reason stays beside it, and it counts as an unsaved Mark.
    expect(within(row).getByRole('button', { name: 'XYZ Mark, Mon Oct 12' }).textContent).toBe('No price');
    expect(within(row).getByText('Halted')).toBeTruthy();
    expect(within(step).getByRole('button', { name: 'Save Marks (1)' })).toBeTruthy();

    await user.click(within(row).getByRole('button', { name: 'Undo' }));
    expect(within(step).getByRole('button', { name: 'Save Marks (0)' })).toBeTruthy();
    expect(document.activeElement).toBe(within(row).getByRole('textbox', { name: 'XYZ Mark, Mon Oct 12' }));
    expect(within(row).getByRole('button', { name: /^Can't get a price/ })).toBeTruthy();
  });

  it('should leave focus on Undo after No price holds the reason', async () => {
    renderReview(cardFacade(gridReview({ earlierMarks: [xyzMarks({ [FRIDAY]: markAt('45.10') })] })));
    const user = userEvent.setup();
    const step = await marksPanel();
    const row = within(gridOf(step)).getByRole('rowheader', { name: 'XYZ' }).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /^Can't get a price/ }));
    await user.type(within(row).getByPlaceholderText('Why no price? Halted, no quote…'), 'Halted');
    await user.click(within(row).getByRole('button', { name: 'No price' }));
    expect(document.activeElement).toBe(within(row).getByRole('button', { name: 'Undo' }));
  });

  it('should add the skipped sessions as optional columns on request, and not before', async () => {
    const xyzThursday: Earlier[number] = { ...xyzGap, trades: [{ tradeId: 't-a', from: THURSDAY }, { tradeId: 't-f', from: MONDAY }], missing: [THURSDAY], revisions: { [THURSDAY]: 'None' } };
    renderReview(cardFacade(gridReview({ earlier: [xyzThursday], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') }, THURSDAY)] })));
    const user = userEvent.setup();
    const step = await marksPanel();
    const headers = () => within(gridOf(step)).getAllByRole('columnheader').map((header) => header.textContent);

    // Not before: the previous session and the Review Date only.
    expect(headers()).toEqual(['Instrument', 'Fri Oct 9', 'Mon Oct 12', 'Change']);
    expect(within(step).queryByRole('textbox', { name: 'XYZ Mark, Thu Oct 8' })).toBeNull();

    await user.click(within(step).getByRole('button', { name: 'Add the skipped sessions' }));
    // On request: each is an optional column, oldest first, before the previous session.
    expect(headers()).toEqual(['Instrument', 'Thu Oct 8 · optional', 'Fri Oct 9', 'Mon Oct 12', 'Change']);
    expect(within(step).getByRole('textbox', { name: 'XYZ Mark, Thu Oct 8' })).toBeTruthy();
    expect(within(step).queryByRole('button', { name: 'Add the skipped sessions' })).toBeNull();
  });

  it('should keep what was typed while cards are opened and closed', async () => {
    renderReview(cardFacade(gridReview()));
    const user = userEvent.setup();
    const step = await marksPanel();
    await user.type(within(step).getByRole('textbox', { name: 'XYZ Mark, Mon Oct 12' }), '52.00');
    await user.type(within(step).getByRole('textbox', { name: 'DEF Mark, Mon Oct 12' }), '30.00');
    // Two cards hold XYZ (T-A, T-F): the first is meant.
    const header = (name: string) => screen.getAllByRole('button', { name: new RegExp(`^Review ${name}\\b`) })[0]!;

    // Opening a card holds nothing back from the grid, and closing it takes nothing from it.
    await user.click(header('DEF'));
    expect(header('DEF').getAttribute('aria-expanded')).toBe('true');
    await user.click(header('XYZ'));
    expect(header('XYZ').getAttribute('aria-expanded')).toBe('true');
    expect(within(step).getByRole<HTMLInputElement>('textbox', { name: 'XYZ Mark, Mon Oct 12' }).value).toBe('52.00');
    await user.click(header('XYZ'));
    expect(header('XYZ').getAttribute('aria-expanded')).toBe('false');
    expect(within(step).getByRole<HTMLInputElement>('textbox', { name: 'XYZ Mark, Mon Oct 12' }).value).toBe('52.00');
    expect(within(step).getByRole<HTMLInputElement>('textbox', { name: 'DEF Mark, Mon Oct 12' }).value).toBe('30.00');
    expect(within(step).getByRole('button', { name: 'Save Marks (2)' })).toBeTruthy();
  });

  it('should show no Marks panel on a card', async () => {
    renderReview(cardFacade(gridReview()));
    await marksPanel();
    // The first card that is not done opens on load.
    const body = await screen.findByRole('region', { name: 'XYZ review' });

    // The card's panels are its Reflections and its Action; the Marks are entered in the step above.
    expect(within(body).getAllByRole('button', { name: /^(Reflections|Settlement|Action)\b/ }).length).toBeGreaterThan(0);
    expect(within(body).queryByRole('button', { name: /^Marks\b/ })).toBeNull();
    expect(within(body).queryByRole('region', { name: 'Marks' })).toBeNull();
    expect(within(body).queryByRole('textbox', { name: /Mark, / })).toBeNull();
  });

  it('should say "Expired worth nothing: enter 0." on a day a contract expires', async () => {
    renderReview(cardFacade(gridReview()));
    expect(within(await marksPanel()).queryByText(/Expired worth nothing/)).toBeNull();
    cleanup();

    const expiring = { ...TC, expiresOnReviewDate: true as const };
    renderReview(cardFacade(review({ families: [{ family: 'Marks', earlierMarks: [], today: [missingRow('DEF', ['t-c'])], earlier: [] }, { family: 'Trades', trades: [expiring] }] })));
    expect(within(await marksPanel()).getByText('Expired worth nothing: enter 0.')).toBeTruthy();
  });
});

// ---- Cases moved from CardMarks.test.tsx (the card's Marks panel left the card, T95.12) ----

describe('the Marks grid, earlier sessions (A291)', () => {
  it('should add a column for each earlier session where any of the Trade Instruments lacks a Mark, showing the others Marks in it', async () => {
    const abcGap: Earlier[number] = { ...xyzGap, instrumentKey: 'ABC', instrument: { kind: 'Stock', symbol: 'ABC' }, trades: [{ tradeId: 't-a', from: THURSDAY }], missing: [THURSDAY], revisions: { [THURSDAY]: 'None' } };
    renderReview(
      cardFacade(
        gridReview({
          today: [missingRow('XYZ', ['t-a', 't-f']), abcRow],
          earlier: [abcGap],
          earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51'), [THURSDAY]: markAt('50') }, THURSDAY), abcMarks({ [FRIDAY]: markAt('27.5') }, THURSDAY)],
        }),
      ),
    );
    const panel = await marksPanelWithEarlier();

    // Thu Oct 8 shows because ABC has no Mark there, though XYZ does; Wed Oct 7, where both do, does not.
    expect(sessionDates(panel)).toEqual([MONDAY, FRIDAY, THURSDAY]);
    expect(cellOf(panel, 'XYZ', 'Thu Oct 8').textContent).toContain('50.00');
    expect(within(panel).getByRole('textbox', { name: 'ABC Mark, Thu Oct 8' })).toBeTruthy();
  });
});

describe('the Marks grid, Not held (W77)', () => {
  it('should show a session before the Trade held an Instrument as Not held', async () => {
    // ABC was opened on the Review Date, so the Review lists no earlier Marks for it; XYZ lacks Thursday's Mark.
    const xyzThursday: Earlier[number] = { ...xyzGap, trades: [{ tradeId: 't-a', from: THURSDAY }], missing: [THURSDAY], revisions: { [THURSDAY]: 'None' } };
    renderReview(cardFacade(gridReview({ today: [missingRow('XYZ', ['t-a', 't-f']), abcRow], earlier: [xyzThursday], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') }, THURSDAY)] })));
    const panel = await marksPanelWithEarlier();

    const abcRow$ = within(gridOf(panel)).getByRole('rowheader', { name: 'ABC' }).closest('tr')!;
    // Friday and Thursday are before ABC was held; Monday is its first session.
    expect(within(abcRow$).getAllByRole('img', { name: 'Not held' })).toHaveLength(2);
    expect(within(abcRow$).getByRole('textbox', { name: 'ABC Mark, Mon Oct 12' })).toBeTruthy();
    const xyzRow = within(gridOf(panel)).getByRole('rowheader', { name: 'XYZ' }).closest('tr')!;
    expect(within(xyzRow).queryByRole('img', { name: 'Not held' })).toBeNull();
    expect(within(xyzRow).getByRole('textbox', { name: 'XYZ Mark, Thu Oct 8' })).toBeTruthy();
  });
});

const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}`;
// XYZ lacks a Mark on 25 earlier sessions (Sep 1 to 25), and has one on Friday.
function pagedReview(): Ready {
  const missing = Array.from({ length: 25 }, (_, i) => day(i + 1));
  const gap: Earlier[number] = { ...xyzGap, trades: [{ tradeId: 't-a', from: day(1) }], missing, revisions: Object.fromEntries(missing.map((d) => [d, 'None'])) };
  return gridReview({ today: [missingRow('XYZ', ['t-a', 't-f'])], earlier: [gap], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') }, day(1))] });
}
// The sessions in the grid's headers, newest first (the headers run oldest to newest).
const sessionDates = (panel: HTMLElement) => within(gridOf(panel)).getAllByRole('columnheader').flatMap((header) => header.getAttribute('data-session') ?? []).reverse();

describe('the Marks grid, paging (A296)', () => {
  it('should page earlier sessions 20 at a time, with the Review Date and previous columns on every page', async () => {
    renderReview(cardFacade(pagedReview()));
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();

    expect(sessionDates(panel)).toEqual([MONDAY, FRIDAY, ...Array.from({ length: 20 }, (_, i) => day(25 - i))]);
    expect(within(panel).getByText('Sessions 1 to 20 of 25')).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: 'Previous page' })).toBeNull();

    await user.click(within(panel).getByRole('button', { name: 'Next page' }));
    expect(sessionDates(panel)).toEqual([MONDAY, FRIDAY, day(5), day(4), day(3), day(2), day(1)]);
    expect(within(panel).getByText('Sessions 21 to 25 of 25')).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: 'Next page' })).toBeNull();

    await user.click(within(panel).getByRole('button', { name: 'Previous page' }));
    expect(sessionDates(panel)).toHaveLength(22);
  });
});

describe('the Marks grid, drafts and paging (A296)', () => {
  it('should keep a typed price when the page changes', async () => {
    renderReview(cardFacade(pagedReview()));
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(within(panel).getByRole('textbox', { name: 'XYZ Mark, Mon Oct 12' }), '52.00');
    await user.type(within(panel).getByRole('textbox', { name: 'XYZ Mark, Fri Sep 25' }), '49.00');
    expect(within(panel).getByRole('button', { name: 'Save Marks (2)' })).toBeTruthy();

    await user.click(within(panel).getByRole('button', { name: 'Next page' }));
    // Page 2 holds neither earlier price on screen, and the Review Date's stays; both are still drafts.
    expect(within(panel).queryByRole('textbox', { name: 'XYZ Mark, Fri Sep 25' })).toBeNull();
    expect(within(panel).getByRole<HTMLInputElement>('textbox', { name: 'XYZ Mark, Mon Oct 12' }).value).toBe('52.00');
    expect(within(panel).getByRole('button', { name: 'Save Marks (2)' })).toBeTruthy();

    await user.click(within(panel).getByRole('button', { name: 'Previous page' }));
    expect(within(panel).getByRole<HTMLInputElement>('textbox', { name: 'XYZ Mark, Fri Sep 25' }).value).toBe('49.00');
  });
});

describe('the Marks grid, keyboard (A295)', () => {
  it('should move Enter down a session column, then to the next session first input, then to Save Marks', async () => {
    const xyzGaps: Earlier[number] = { ...xyzGap, trades: [{ tradeId: 't-a', from: WEDNESDAY }], missing: [THURSDAY, WEDNESDAY], revisions: { [THURSDAY]: 'None', [WEDNESDAY]: 'None' } };
    const abcGaps: Earlier[number] = { ...xyzGap, instrumentKey: 'ABC', instrument: { kind: 'Stock', symbol: 'ABC' }, trades: [{ tradeId: 't-a', from: THURSDAY }], missing: [THURSDAY], revisions: { [THURSDAY]: 'None' } };
    renderReview(
      cardFacade(gridReview({ today: [missingRow('XYZ', ['t-a', 't-f']), abcRow], earlier: [xyzGaps, abcGaps], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') }, WEDNESDAY), abcMarks({ [FRIDAY]: markAt('27.5') }, THURSDAY)] })),
    );
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    const input = (symbol: string, date: string) => within(panel).getByRole('textbox', { name: `${symbol} Mark, ${date}` });
    await user.type(input('XYZ', 'Mon Oct 12'), '52{Enter}');

    // Down Monday's column, then Thursday's first input, down it, then Wednesday's.
    expect(document.activeElement).toBe(input('ABC', 'Mon Oct 12'));
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(input('XYZ', 'Thu Oct 8'));
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(input('ABC', 'Thu Oct 8'));
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(input('XYZ', 'Wed Oct 7'));
    // From the last input to Save Marks.
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
  });
});

describe('the cell editor shows its cell and goes when its page does (P160)', () => {
  it('should title the editor box with its cell name and status', async () => {
    renderReview(cardFacade(pagedReview()));
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    // An earlier session's cell keeps its editor; the Review Date's Missing cell is answered in its row (W113).
    const earlier = await choose(user, panel, 'XYZ', 'Fri Sep 25');
    expect(earlier.querySelector('.cell-editor-title')?.getAttribute('data-title')).toBe('XYZ Mark, Fri Sep 25 · Missing');

    await user.click(within(earlier).getByRole('button', { name: "Can't get a price" }));
    expect(earlier.querySelector('.cell-editor-title')?.getAttribute('data-title')).toBe("XYZ Mark, Fri Sep 25 · Can't get a price");
  });

  it('should close an editor whose cell is not on the shown page, keeping its draft', async () => {
    renderReview(cardFacade(pagedReview()));
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', 'Fri Sep 25'), '49.00');
    expect(editors(panel).map((editor) => editor.getAttribute('aria-label'))).toEqual(['XYZ Mark, Fri Sep 25']);

    await user.click(within(panel).getByRole('button', { name: 'Next page' }));
    expect(editors(panel)).toEqual([]);
    expect(within(panel).getByRole('button', { name: 'Save Marks (1)' })).toBeTruthy();

    await user.click(within(panel).getByRole('button', { name: 'Previous page' }));
    expect(editors(panel)).toEqual([]);
    expect(inputOf(panel, 'XYZ', 'Fri Sep 25').value).toBe('49.00');
  });

  it('should not send Tab to the first grid cell after paging away from the chosen cell', async () => {
    renderReview(cardFacade(pagedReview()));
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await choose(user, panel, 'XYZ', 'Fri Sep 25');
    await user.click(within(panel).getByRole('button', { name: 'Next page' }));
    // The editor went with its page, so there is no last control for Tab to leave from.
    expect(editors(panel)).toEqual([]);

    await user.tab();
    await user.tab();
    const grid = gridOf(panel);
    expect(grid.contains(document.activeElement)).toBe(false);
  });
});

describe('the Marks grid, one tab stop per cell with its editor in between (P160)', () => {
  const laterCells = () => {
    const thursday: Earlier[number] = { ...xyzGap, trades: [{ tradeId: 't-a', from: THURSDAY }], missing: [THURSDAY], revisions: { [THURSDAY]: 'None' } };
    return cardFacade(gridReview({ today: [missingRow('XYZ', ['t-a', 't-f'])], earlier: [thursday], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51', 3) }, THURSDAY)] }));
  };

  // Tabs on from the chosen cell while the focus stays in its editor; returns what took the focus in it, with the control Tab left it for.
  async function tabThrough(user: ReturnType<typeof userEvent.setup>, editor: HTMLElement) {
    const stops: Element[] = [];
    for (let i = 0; i < 10; i++) {
      await user.tab();
      if (!editor.contains(document.activeElement)) return { stops, next: document.activeElement };
      stops.push(document.activeElement!);
    }
    throw new Error('Tab never left the editor');
  }

  it('should take Tab from a chosen Missing earlier cell to Cant get a price in its editor, then to the next cell, and Shift+Tab back', async () => {
    renderReview(laterCells());
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    // The columns run oldest to newest: Thu Oct 8, Fri Oct 9, then the Review Date. The Review Date's Missing cell has no editor (W113).
    const thursday = await choose(user, panel, 'XYZ', 'Thu Oct 8');
    expect(document.activeElement).toBe(inputOf(panel, 'XYZ', 'Thu Oct 8'));

    const { stops, next } = await tabThrough(user, thursday);
    expect(stops).toContain(within(thursday).getByRole('button', { name: "Can't get a price" }));
    expect(next).toBe(cellOf(panel, 'XYZ', FRIDAY_LABEL));
    // Shift+Tab from the editor's first control returns to its cell, not to the last cell of the grid.
    await user.click(inputOf(panel, 'XYZ', 'Thu Oct 8'));
    await user.tab();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(inputOf(panel, 'XYZ', 'Thu Oct 8'));
  });

  it('should reach Save Marks by Tab past a saved cell that follows the chosen cell', async () => {
    renderReview(cardFacade(gridReview({ today: [missingRow('XYZ', ['t-a', 't-f'])], earlier: [], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51', 3) })] })));
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');

    let reached = false;
    for (let i = 0; i < 25 && !reached; i++) {
      await user.tab();
      reached = document.activeElement === within(panel).getByRole('button', { name: 'Save Marks (1)' });
    }
    expect(reached).toBe(true);
  });

  it('should take Tab from a chosen earlier cell to Correct in its editor while later cells exist', async () => {
    renderReview(laterCells());
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    const friday = await choose(user, panel, 'XYZ', FRIDAY_LABEL);

    const { stops, next } = await tabThrough(user, friday);
    expect(stops).toContain(within(friday).getByRole('button', { name: 'Correct' }));
    // The next cell is the Review Date's, which follows Friday in the row.
    expect(next).toBe(inputOf(panel, 'XYZ', MONDAY_LABEL));
  });

  it('should take Tab from a chosen acknowledged Review Date cell to Withdraw in its editor while later cells exist', async () => {
    const thursday: Earlier[number] = { ...xyzGap, trades: [{ tradeId: 't-a', from: THURSDAY }], missing: [], acknowledged: [THURSDAY], revisions: { [THURSDAY]: 2 }, acknowledgments: { [THURSDAY]: ACK.acknowledgment } };
    renderReview(cardFacade(gridReview({ today: [markRowOf('ABC', ACK, 2)], earlier: [thursday], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') }, THURSDAY), abcMarks({ [FRIDAY]: markAt('27.5') })] })));
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    const monday = await choose(user, panel, 'ABC', MONDAY_LABEL);

    const { stops, next } = await tabThrough(user, monday);
    expect(stops).toContain(within(monday).getByRole('button', { name: 'Withdraw' }));
    // The next cell is the first of the next row: XYZ's acknowledged Thursday.
    expect(next).toBe(cellOf(panel, 'XYZ', 'Thu Oct 8'));
  });

  // T9R2.17-B7: Tab reaches the pager from the last cell, and Shift+Tab reaches it again from Save Marks. The last cell is the Review Date's input, which has no editor.
  it('should reach Previous page and Next page by Tab from the last cell and by Shift Tab from Save Marks', async () => {
    renderReview(cardFacade(pagedReview()));
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', 'Mon Oct 12'), '52.00');
    const next = within(panel).getByRole('button', { name: 'Next page' });
    const save = within(panel).getByRole('button', { name: 'Save Marks (1)' });

    await user.tab();
    expect(document.activeElement).toBe(next);
    await user.tab();
    expect(document.activeElement).toBe(save);
    // And Shift+Tab from Save Marks reaches the pager again.
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(next);
  });
});

describe('the Marks grid, earlier sessions note (W72)', () => {
  it('should say Earlier sessions do not block the Review only while earlier columns show', async () => {
    const note = "Earlier sessions don't block the Review.";
    renderReview(cardFacade(gridReview({ today: [missingRow('XYZ', ['t-a', 't-f'])], earlier: [xyzGap], earlierMarks: [xyzMarks({}, FRIDAY)], previousSession: THURSDAY })));
    const panel = await marksPanelWithEarlier();
    expect(within(gridOf(panel)).getAllByRole('columnheader').map((header) => header.getAttribute('data-session'))).toContain(FRIDAY);
    expect(within(panel).getByText(note)).toBeTruthy();
    // The words it replaces are gone.
    expect(within(panel).queryByText('These sessions do not block the Review.')).toBeNull();
    expect(within(panel).queryByText('Earlier sessions without Marks — optional')).toBeNull();
    cleanup();

    // With no earlier session lacking a Mark, only the Review Date and previous columns show, and the note does not.
    renderReview(cardFacade(gridReview({ earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') })] })));
    const bare = await marksPanelWithEarlier();
    expect(sessionDates(bare)).toEqual([MONDAY, FRIDAY]);
    expect(within(bare).queryByText(note)).toBeNull();
    cleanup();

    // A previous session lacking a Mark is an earlier session without one too: optional, so the note shows.
    renderReview(cardFacade(gridReview({ earlier: [xyzGap], earlierMarks: [xyzMarks({}, FRIDAY)] })));
    const previousGap = await marksPanelWithEarlier();
    expect(sessionDates(previousGap)).toEqual([MONDAY, FRIDAY]);
    expect(within(previousGap).getByText(note)).toBeTruthy();
  });
});

describe('the Marks grid, Save Marks (P37)', () => {
  it('should save a Review Date price and an earlier session price with one Save Marks', async () => {
    const thursday: Earlier[number] = { ...xyzGap, trades: [{ tradeId: 't-a', from: THURSDAY }], missing: [THURSDAY], revisions: { [THURSDAY]: 4 } };
    const facade = cardFacade(gridReview({ today: [missingRow('XYZ', ['t-a', 't-f'])], earlier: [thursday], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') }, THURSDAY)] }));
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([savedKey('XYZ', MONDAY, '52.00'), savedKey('XYZ', THURSDAY, '50.00')]));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(within(panel).getByRole('textbox', { name: 'XYZ Mark, Mon Oct 12' }), '52.00');
    await user.type(within(panel).getByRole('textbox', { name: 'XYZ Mark, Thu Oct 8' }), '50.00');

    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));

    expect(facade.DailyReview.save).toHaveBeenCalledTimes(1);
    expect(facade.DailyReview.save).toHaveBeenCalledWith({
      kind: 'SaveReviewMarks',
      reviewDate: MONDAY,
      binding,
      entries: [
        { key: { instrumentKey: 'XYZ', tradingDate: MONDAY }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '52.00' } },
        { key: { instrumentKey: 'XYZ', tradingDate: THURSDAY }, expectedRevision: 4, intention: { kind: 'RecordInitialManualMark', price: '50.00' } },
      ],
    });
  });
});

describe('drafts', () => {
  it('should mark a typed price and a Cant get a price with its reason as Unsaved, count them on Save Marks, make no call, and drop them all on Discard', async () => {
    const facade = cardFacade();
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    expect(within(panel).queryByText('Unsaved')).toBeNull();

    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    const friday = await choose(user, panel, 'XYZ', FRIDAY_LABEL);
    await user.click(within(friday).getByRole('button', { name: "Can't get a price" }));
    await user.type(within(friday).getByLabelText('Reason (required)'), 'no quote');

    expect(within(friday).getByText('Unsaved')).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Save Marks (2)' })).toBeTruthy();
    // Nothing is written until Save Marks.
    expect(facade.MarketData.save).not.toHaveBeenCalled();
    expect(facade.DailyReview.save).not.toHaveBeenCalled();

    await user.click(within(panel).getByRole('button', { name: 'Discard' }));
    expect(within(panel).queryByText('Unsaved')).toBeNull();
    expect(inputOf(panel, 'XYZ', MONDAY_LABEL).value).toBe('');
    expect(inputOf(panel, 'XYZ', FRIDAY_LABEL).value).toBe('');
    expect(within(panel).queryByLabelText('Reason (required)')).toBeNull();
    expect(within(panel).getByRole<HTMLButtonElement>('button', { name: 'Save Marks (0)' }).disabled).toBe(true);
    expect(facade.DailyReview.save).not.toHaveBeenCalled();
  });

  it('should tag a typed Review Date price Unsaved until it is saved', async () => {
    renderReview(cardFacade());
    const user = userEvent.setup();
    const step = await marksPanel();
    const rows = Object.fromEntries(['XYZ', 'DEF'].map((symbol) => [symbol, inputOf(step, symbol, MONDAY_LABEL).closest('tr')!]));
    const row = (symbol: string) => rows[symbol]!;
    expect(within(step).queryByText('Unsaved')).toBeNull();

    await user.type(inputOf(step, 'XYZ', MONDAY_LABEL), '52.00');
    // The tag sits in the row of the typed price, and the cell keeps its name.
    expect(within(row('XYZ')).getByText('Unsaved')).toBeTruthy();
    expect(within(row('DEF')).queryByText('Unsaved')).toBeNull();
    expect(inputOf(step, 'XYZ', MONDAY_LABEL).getAttribute('aria-describedby')).toBe(within(row('XYZ')).getByText('Unsaved').id);

    // A "Can't get a price" with its reason is unsaved too.
    await user.click(within(step).getByRole('button', { name: /^Can't get a price/ }));
    await user.type(within(step).getByRole('textbox', { name: /^Why no price/ }), 'halted');
    await user.click(within(step).getByRole('button', { name: 'No price' }));
    expect(within(row('DEF')).getByText('Unsaved')).toBeTruthy();
  });

  it('should drop the Unsaved tag on Discard and when the price is typed back to the saved one', async () => {
    const facade = cardFacade();
    const xyzSaved = { ...missingRow('XYZ', ['t-a', 't-f']), resolution: available('52'), resolutionRevision: 1, task: null };
    vi.mocked(facade.DailyReview.open).mockResolvedValue(gridReview({ today: [xyzSaved, missingRow('DEF', ['t-c'])] }));
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce(marksSavedResult([savedKey('DEF', MONDAY, '33.10')]));
    renderReview(facade);
    const user = userEvent.setup();
    let step = await marksPanel();
    await user.type(inputOf(step, 'DEF', MONDAY_LABEL), '33.10');
    expect(within(step).getByText('Unsaved')).toBeTruthy();
    await user.click(within(step).getByRole('button', { name: 'Discard' }));
    expect(within(step).queryByText('Unsaved')).toBeNull();

    await user.type(inputOf(step, 'DEF', MONDAY_LABEL), '33.10');
    await user.click(within(step).getByRole('button', { name: 'Save Marks (1)' }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    step = await marksPanel();
    // A saved Mark edited in place is unsaved while it differs from the saved price.
    const xyz = inputOf(step, 'XYZ', MONDAY_LABEL);
    expect(within(step).queryByText('Unsaved')).toBeNull();
    await user.clear(xyz);
    await user.type(xyz, '52.50');
    expect(within(step).getByText('Unsaved')).toBeTruthy();
    await user.clear(xyz);
    await user.type(xyz, '52.00');
    expect(within(step).queryByText('Unsaved')).toBeNull();
  });
});

describe('Save Marks (P37, A155)', () => {
  it('should send one SaveReviewMarks command with the card Trade, the overview binding, and every draft with its expected revision', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([savedKey('XYZ', MONDAY, '52.00'), savedKey('XYZ', FRIDAY, '51.00')]));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), ' 52.00');
    const friday = await choose(user, panel, 'XYZ', FRIDAY_LABEL);
    await user.click(within(friday).getByRole('button', { name: "Can't get a price" }));
    await user.type(within(friday).getByLabelText('Reason (required)'), 'no quote');

    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));

    expect(facade.DailyReview.save).toHaveBeenCalledTimes(1);
    expect(facade.DailyReview.save).toHaveBeenCalledWith({
      kind: 'SaveReviewMarks',
      reviewDate: MONDAY,
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
  conditions: [],
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
  maximumIncrementalReward: { kind: 'Unbounded', direction: 'Above' },
  realizedToDate: value(0n),
  remainingOpenPnl: value(582n),
  planBaseline: { kind: 'Value' as const, value: { rewardRiskRatio: Rational.of(12n, 5n) } },
  atEntry: null,
} as unknown as DailyTradeReview['evaluation'];
// T-F shares XYZ: once the Mark is saved its meter is placed.
const TF_METER: MeterReading = { stop: value(-400n), target: value(400n), banked: value(0n), now: { kind: 'Value', value: { pnl: rational(200n), zone: 'Between', share: { fraction: rational(1n, 2n), percent: rational(50n), toward: 'Target' } } } };
const TF_PLACED = walked('t-f', 'XYZ', { summary: TF.summary, meter: TF_METER, figures: { riskToStop: value(200n), pnl: value(100n), rewardRiskNow: value(3n, 4n) } });
// T-F's collapsed card, picked by its header's name: the two XYZ cards read alike but for the summary line (decision 68).
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tfHeader = () => screen.getByRole('button', { name: new RegExp(`^Review XYZ ${escaped(tradeSummary(TF.summary!))}\\b`) });
const AFTER_XYZ: ReviewCompletion = { kind: 'Incomplete', reasons: [markMissing('DEF', 't-c'), ...actionMissing('t-a', 't-f', 't-c')] };

describe('Save Marks (P37, A155) rendering', () => {
  it('should render every row, the card figures, and every collapsed card summary and meter from the MarksSaved result, with no open or getTrade call', async () => {
    const facade = cardFacade();
    const trade = tradeReview(TA, { evaluation: EVALUATED });
    vi.mocked(facade.DailyReview.save).mockResolvedValue(
      marksSavedResult([savedKey('XYZ', MONDAY, '52.00'), savedKey('XYZ', FRIDAY, '51.00')], readyReview({ completion: AFTER_XYZ, trades: [TA, TF_PLACED, TC], trade, nextStep: { kind: 'Trade', trade } })),
    );
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    expect(screen.queryByRole('heading', { name: /^Now · / })).toBeNull();
    const otherHeader = tfHeader();
    expect(otherHeader.textContent).toContain('To do: Mark');
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    await user.type(inputOf(panel, 'XYZ', FRIDAY_LABEL), '51.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));

    // Every row shows its saved Mark, and nothing is Unsaved.
    // The Review Date's saved Mark is an input holding its price (fixed in place, T95.14); an earlier session's is a button with its Correct.
    await waitFor(() => expect(inputOf(panel, 'XYZ', MONDAY_LABEL).value).toBe('52.00'));
    expect(within(cellOf(panel, 'XYZ', FRIDAY_LABEL)).getByText('$51.00', { exact: false })).toBeTruthy();
    expect(within(panel).queryByText('Unsaved')).toBeNull();
    expect(within(await choose(user, panel, 'XYZ', FRIDAY_LABEL)).getByRole('button', { name: 'Correct' })).toBeTruthy();
    // The card's figures come from the result.
    const card = screen.getByRole('region', { name: 'XYZ review' });
    expect(within(card).getByRole('heading', { name: 'Now · Mon Oct 12' })).toBeTruthy();
    // The other XYZ card's summary and meter follow the shared Mark.
    const sharedHeader = tfHeader();
    expect(sharedHeader.textContent).not.toContain('To do: Mark');
    expect(within(sharedHeader.closest('li')!).getByRole('img').getAttribute('aria-label')).toContain('50% of the way to the Target');
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
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    await user.type(inputOf(panel, 'XYZ', FRIDAY_LABEL), '51.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));

    // While it is pending: one sent draft is changed.
    await user.type(inputOf(panel, 'XYZ', FRIDAY_LABEL), '1');
    finish(marksSavedResult([savedKey('XYZ', MONDAY, '52.00'), savedKey('XYZ', FRIDAY, '51.00')]));

    // Monday was sent unchanged, so it shows its saved Mark; Friday stays Unsaved with what was typed.
    await waitFor(() => expect(inputOf(panel, 'XYZ', MONDAY_LABEL).value).toBe('52.00'));
    expect(within(panel).getByRole('button', { name: 'Save Marks (1)' })).toBeTruthy();
    // Friday now holds its saved Mark in the grid, and the changed draft over it shows in its editor.
    expect(within(await choose(user, panel, 'XYZ', FRIDAY_LABEL)).getByLabelText<HTMLInputElement>('Price').value).toBe('51.001');
    // A draft over an earlier session's Mark is no in-place fix: it goes as it always went, not as a correction with no reason.
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    expect(vi.mocked(facade.DailyReview.save).mock.calls[1]![0]).toMatchObject({ entries: [{ key: { instrumentKey: 'XYZ', tradingDate: FRIDAY }, intention: { kind: 'RecordInitialManualMark', price: '51.001' } }] });
  });

  it('should keep a draft for a key that was not sent when the result is MarksSaved', async () => {
    const facade = cardFacade();
    let finish: (result: SaveResult) => void = () => undefined;
    vi.mocked(facade.DailyReview.save).mockImplementation(() => new Promise<SaveResult>((resolve) => (finish = resolve)));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    await user.type(inputOf(panel, 'XYZ', FRIDAY_LABEL), '51.00');
    finish(marksSavedResult([savedKey('XYZ', MONDAY, '52.00')]));

    await waitFor(() => expect(within(panel).getByRole('button', { name: 'Save Marks (1)' })).toBeTruthy());
    expect(inputOf(panel, 'XYZ', MONDAY_LABEL).value).toBe('52.00');
    expect(inputOf(panel, 'XYZ', FRIDAY_LABEL).value).toBe('51.00');
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
    const panel = await marksPanelWithEarlier();
    const monday = inputOf(panel, 'XYZ', MONDAY_LABEL);
    const friday = inputOf(panel, 'XYZ', FRIDAY_LABEL);
    await user.type(monday, '7');
    await user.type(friday, '-1');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));

    // The first refused key opens its editor with its issue and takes focus; the other cell is marked invalid until it is chosen.
    await waitFor(() => expect(within(panel).getByText('Enter a price as a number, with at most 6 decimal places.')).toBeTruthy());
    expect(document.activeElement).toBe(monday);
    expect(monday.getAttribute('aria-invalid')).toBe('true');
    expect(friday.getAttribute('aria-invalid')).toBe('true');
    expect(within(await choose(user, panel, 'XYZ', FRIDAY_LABEL)).getByText('A price cannot be negative.')).toBeTruthy();
    // Every draft is kept for correction.
    expect(monday.value).toBe('7');
    expect(friday.value).toBe('-1');
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
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    await user.type(inputOf(panel, 'XYZ', FRIDAY_LABEL), '51.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));

    // The key that moved says nothing was saved, in its row; its input holds the draft over the Mark it is now.
    expect((await within(panel).findByRole('alert')).textContent).toContain('Nothing was saved');
    expect(within(panel).getAllByRole('alert')).toHaveLength(1);
    // Every draft is kept, and the retry binds to the revision the Conflict reported.
    expect(inputOf(panel, 'XYZ', MONDAY_LABEL).value).toBe('52.00');
    expect(inputOf(panel, 'XYZ', FRIDAY_LABEL).value).toBe('51.00');
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce(marksSavedResult([savedKey('XYZ', MONDAY, '52.00'), savedKey('XYZ', FRIDAY, '51.00')]));
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (2)' }));
    await waitFor(() => expect(facade.DailyReview.save).toHaveBeenCalledTimes(2));
    expect(vi.mocked(facade.DailyReview.save).mock.calls[1]![0]).toMatchObject({ entries: [{ expectedRevision: 2 }, { expectedRevision: 'None' }] });
  });
});

describe('Save Marks (A294) conflicted, focus', () => {
  it('should take focus to the first conflicted key input when a save is refused by a Conflict', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({
      kind: 'Conflict',
      keys: [{ entryIndex: 0, key: { instrumentKey: 'XYZ', tradingDate: MONDAY }, code: 'StaleRevision', resolution: available('51.50', 2), resolutionRevision: 2 }],
    });
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    expect((await within(panel).findByRole('alert')).textContent).toContain('Nothing was saved');
    await waitFor(() => expect(document.activeElement).toBe(inputOf(panel, 'XYZ', MONDAY_LABEL)));
  });
});

describe('Save Marks (P37, A155) with the Review changed during assembly', () => {
  it('should render the saved rows and offer Refresh, which calls open and getTrade, when the result Review part is ChangedDuringAssembly', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([savedKey('XYZ', MONDAY, '52.00')], { kind: 'ChangedDuringAssembly' }));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));

    await waitFor(() => expect(inputOf(panel, 'XYZ', MONDAY_LABEL).value).toBe('52.00'));
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
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    await waitFor(() => expect(within(panel).getByText(/figures are out of date/)).toBeTruthy());

    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce(marksSavedResult([savedKey('XYZ', FRIDAY, '51.00')]));
    await user.type(inputOf(panel, 'XYZ', FRIDAY_LABEL), '51.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));

    await waitFor(() => expect(within(panel).queryByText(/figures are out of date/)).toBeNull());
    expect(within(panel).queryByRole('button', { name: 'Refresh' })).toBeNull();
  });
});

describe('rows with a Mark', () => {
  it('should keep D4 per-row Correct and Withdraw for a row with an exact Mark or an acknowledgment, saving through MarketData.save as today', async () => {
    const acknowledged: MarkResolution = { kind: 'AcknowledgedUnavailable', acknowledgment: { versionId: 'a1', kind: 'Asserted', reason: 'no quote', savedAt: '2026-10-12T21:00:00Z' } };
    const rows: MarkRow[] = [
      { instrumentKey: 'XYZ', instrument: { kind: 'Stock', symbol: 'XYZ' }, tradingDate: MONDAY, trades: ['t-a', 't-f'], resolution: available('52.00', 3), resolutionRevision: 3, task: null },
      { instrumentKey: 'ABC', instrument: { kind: 'Stock', symbol: 'ABC' }, tradingDate: MONDAY, trades: ['t-a'], resolution: acknowledged, resolutionRevision: 2, task: null },
    ];
    const facade = cardFacade(review({ families: [{ family: 'Marks', earlierMarks: [], today: rows, earlier: [] }, { family: 'Trades', trades: WALK }] }));
    vi.mocked(facade.MarketData.save).mockResolvedValue({ kind: 'Conflict', key: { instrumentKey: 'XYZ', tradingDate: MONDAY }, resolution: available('52.00', 3), resolutionRevision: 3 });
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();

    // The Review Date's typed Mark is fixed in place, with no editor and no Correct (T95.14); an earlier session's Correct is covered in the cell editor cases.
    expect(inputOf(panel, 'XYZ', MONDAY_LABEL).value).toBe('52.00');
    expect(within(panel).queryByRole('button', { name: 'Correct' })).toBeNull();
    await user.click(inputOf(panel, 'XYZ', MONDAY_LABEL));
    expect(editors(panel)).toEqual([]);

    const abc = await choose(user, panel, 'ABC', MONDAY_LABEL);
    await user.click(within(abc).getByRole('button', { name: 'Withdraw' }));
    expect(facade.MarketData.save).toHaveBeenLastCalledWith({ intention: 'WithdrawAcknowledgment', instrumentKey: 'ABC', tradingDate: MONDAY, expectedResolutionRevision: 2 });
    // Neither goes through Save Marks.
    expect(facade.DailyReview.save).not.toHaveBeenCalled();
  });
});

describe('two quick row saves', () => {
  it('should refresh after both and show no could-not-refresh notice when a second per-row save finishes while the first refresh is still in flight', async () => {
    const rows: MarkRow[] = [
      { instrumentKey: 'XYZ', instrument: { kind: 'Stock', symbol: 'XYZ' }, tradingDate: MONDAY, trades: ['t-a', 't-f'], resolution: available('52.00', 1), resolutionRevision: 1, task: null },
      { instrumentKey: 'ABC', instrument: { kind: 'Stock', symbol: 'ABC' }, tradingDate: MONDAY, trades: ['t-a'], resolution: available('27.50', 1), resolutionRevision: 1, task: null },
    ];
    // The previous session's Marks are corrected: the Review Date's own are fixed in place.
    const overview = review({ families: [{ family: 'Marks', earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') }), abcMarks({ [FRIDAY]: markAt('27') })], today: rows, earlier: [], previousSession: FRIDAY }, { family: 'Trades', trades: WALK }] });
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
    const panel = await marksPanelWithEarlier();
    for (const symbol of ['XYZ', 'ABC']) {
      const row = await choose(user, panel, symbol, FRIDAY_LABEL);
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
    const rows: MarkRow[] = [{ instrumentKey: 'XYZ', instrument: { kind: 'Stock', symbol: 'XYZ' }, tradingDate: MONDAY, trades: ['t-a', 't-f'], resolution: available('52.00', 1), resolutionRevision: 1, task: null }];
    const facade = cardFacade(review({ families: [{ family: 'Marks', earlierMarks: [], today: rows, earlier: [gap] }, { family: 'Trades', trades: WALK }] }));
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([savedKey('XYZ', day(25), '9')]));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', 'Fri Sep 25'), '9');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    // Every Review Date Mark is in, so the grid folds; Edit opens it again with its skipped sessions.
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(within(cellOf(panel, 'XYZ', 'Fri Sep 25')).getByText('$9.00', { exact: false })).toBeTruthy());

    await user.click(within(panel).getByRole('button', { name: 'Next page' }));
    await user.click(within(panel).getByRole('button', { name: 'Previous page' }));

    expect(within(cellOf(panel, 'XYZ', 'Fri Sep 25')).getByText('$9.00', { exact: false })).toBeTruthy();
    expect(within(await choose(user, panel, 'XYZ', 'Fri Sep 25')).getByRole('button', { name: 'Correct' })).toBeTruthy();
  });
});

describe('earlier sessions after Refresh', () => {
  it('should send an earlier-session draft with the resolution and revision of the newest Review after Refresh, not those of the first snapshot', async () => {
    const acknowledgment = { versionId: 'a1', kind: 'Asserted' as const, reason: 'no quote', savedAt: '2026-10-12T21:00:00Z' };
    const changedGap: Earlier[number] = { ...xyzGap, missing: [], acknowledged: [FRIDAY], revisions: { [FRIDAY]: 4 }, acknowledgments: { [FRIDAY]: acknowledgment } };
    const changed = review({ families: [{ family: 'Marks', earlierMarks: [], today: [missingRow('XYZ', ['t-a', 't-f']), missingRow('DEF', ['t-c'])], earlier: [changedGap] }, { family: 'Trades', trades: WALK }] });
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'ReviewChanged', evidence: { marketDataSnapshotId: 'mds1:2:def', frames: [] } }).mockResolvedValueOnce(marksSavedResult([savedKey('XYZ', FRIDAY, '51.00')]));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', FRIDAY_LABEL), '51.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    await within(panel).findByRole('alert');

    vi.mocked(facade.DailyReview.open).mockResolvedValue(changed);
    await user.click(within(panel).getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(cellOf(panel, 'XYZ', FRIDAY_LABEL)).getByText('Acknowledged Unavailable')).toBeTruthy());
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));

    await waitFor(() => expect(facade.DailyReview.save).toHaveBeenCalledTimes(2));
    expect(vi.mocked(facade.DailyReview.save).mock.calls[1]![0]).toMatchObject({ entries: [{ key: { instrumentKey: 'XYZ', tradingDate: FRIDAY }, expectedRevision: 4 }] });
  });
});

describe('earlier sessions after a header Refresh with a card open (T95.12-B1-B1)', () => {
  const changedSave = () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'ReviewChanged', evidence: { marketDataSnapshotId: 'mds1:2:def', frames: [] } });
    return facade;
  };
  async function refreshedFrom(facade: UiFacade, refreshed: Ready) {
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', 'Mon Oct 12'), '51.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    await within(panel).findByRole('alert');
    vi.mocked(facade.DailyReview.open).mockResolvedValue(refreshed);
    await user.click(within(panel).getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    return { panel, user };
  }

  it('should drop the skipped-session columns the refreshed Review no longer lists when a card is open', async () => {
    const none = review({ families: [{ family: 'Marks', earlierMarks: [], today: [missingRow('XYZ', ['t-a', 't-f']), missingRow('DEF', ['t-c'])], earlier: [] }, { family: 'Trades', trades: WALK }] });
    const { panel } = await refreshedFrom(changedSave(), none);
    await waitFor(() => expect(sessionDates(panel)).toEqual([MONDAY]));
  });

  it('should show the last page when a Refresh leaves fewer skipped sessions than the page it was on', async () => {
    const facade = cardFacade(pagedReview());
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'ReviewChanged', evidence: { marketDataSnapshotId: 'mds1:2:def', frames: [] } });
    const missing = [day(1), day(2), day(3)];
    const gap: Earlier[number] = { ...xyzGap, trades: [{ tradeId: 't-a', from: day(1) }], missing, revisions: Object.fromEntries(missing.map((d) => [d, 'None'])) };
    const fewer = gridReview({ today: [missingRow('XYZ', ['t-a', 't-f'])], earlier: [gap], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') }, day(1))] });
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.click(within(panel).getByRole('button', { name: 'Next page' }));
    await user.type(inputOf(panel, 'XYZ', 'Mon Oct 12'), '51.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    await within(panel).findByRole('alert');
    vi.mocked(facade.DailyReview.open).mockResolvedValue(fewer);
    await user.click(within(panel).getByRole('button', { name: 'Refresh' }));

    await waitFor(() => expect(sessionDates(panel)).toEqual([MONDAY, FRIDAY, day(3), day(2), day(1)]));
  });
});

describe('Save Marks (P37, A155) not written', () => {
  it('should say nothing was saved, keep the drafts, and offer Refresh when the Review changed, and say so when storage failed', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'ReviewChanged', evidence: { marketDataSnapshotId: 'mds1:2:def', frames: [] } }).mockResolvedValueOnce({ kind: 'StorageFailure' } as SaveResult);
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));

    expect((await within(panel).findByRole('alert')).textContent).toContain('The Review changed');
    expect(within(panel).getByRole('alert').textContent).toContain('Nothing was saved');
    expect(inputOf(panel, 'XYZ', MONDAY_LABEL).value).toBe('52.00');
    await user.click(within(panel).getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));

    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    await waitFor(() => expect(within(panel).getByRole('alert').textContent).toContain('could not be saved'));
    expect(inputOf(panel, 'XYZ', MONDAY_LABEL).value).toBe('52.00');
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
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));

    // Read only: no draft fields, and nothing holds the card.
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    expect(within(panel).queryByRole('button', { name: /Save Marks/ })).toBeNull();
    const open = screen.getAllByRole('button', { name: /^Review / }).find((header) => header.getAttribute('aria-expanded') === 'true')!;
    await user.click(open);
    expect(screen.queryByRole('region', { name: 'Marks' })).toBeNull();
    expect(screen.queryByText(/note isn't saved/)).toBeNull();
  });
});

describe('the cell editor (A153)', () => {
  it('should name the Trades holding XYZ, linked, in the editor of its acknowledged Review Date cell', async () => {
    const saved = { ...markRowOf('XYZ', ACK, 2), trades: ['t-a', 't-f'] };
    renderReview(cardFacade(gridReview({ today: [saved], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') })] })));
    const user = userEvent.setup();

    const panel = await marksPanelWithEarlier();
    expect(sessionDates(panel)).toEqual([MONDAY, FRIDAY]);
    const xyz = await choose(user, panel, 'XYZ', MONDAY_LABEL);
    // The shared Instrument names the Trades holding it, linked, by their summary line as the Trade list shows it (decision 67).
    expect(within(xyz).getByText(/held by/)).toBeTruthy();
    expect(within(xyz).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([['XYZ', '/trades/t-a'], ['Long 100 shares @ $50.00', '/trades/t-f']]);
  });
});

// The cell editor (P160): one region under the grid, named after the chosen cell.
const ACK: Extract<MarkResolution, { kind: 'AcknowledgedUnavailable' }> = { kind: 'AcknowledgedUnavailable', acknowledgment: { versionId: 'a1', kind: 'Asserted', reason: 'no quote', savedAt: '2026-10-12T21:00:00Z' } };
const editors = (panel: HTMLElement) => within(panel).queryAllByRole('region', { name: /Mark, / });
const markRowOf = (instrumentKey: string, resolution: MarkResolution, revision: number | 'None', task: MarkRow['task'] = null): MarkRow => ({ instrumentKey, instrument: { kind: 'Stock', symbol: instrumentKey }, tradingDate: MONDAY, trades: ['t-a'], resolution, resolutionRevision: revision, task });

describe('the cell editor (P160)', () => {
  it('should open one editor under the grid when a cell is chosen, named after the cell, with the cell status', async () => {
    renderReview(cardFacade());
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    // Adding the skipped sessions puts the focus in the first of them, which chooses it; no editor is open before that.

    const friday = await choose(user, panel, 'XYZ', FRIDAY_LABEL);
    expect(editors(panel)).toEqual([friday]);
    expect(within(friday).getByText('Missing')).toBeTruthy();
    // It sits under the grid, not inside it.
    expect(gridOf(panel).contains(friday)).toBe(false);
    expect(gridOf(panel).compareDocumentPosition(friday) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The Review Date's Missing cell has no editor: it is answered in its own row (W113).
    await user.click(inputOf(panel, 'XYZ', MONDAY_LABEL));
    expect(editors(panel)).toEqual([]);
  });

  it('should offer Cant get a price with Reason required and Cancel for a Missing cell, keeping the reason as a draft', async () => {
    renderReview(cardFacade());
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    const friday = await choose(user, panel, 'XYZ', FRIDAY_LABEL);
    expect(within(friday).queryByLabelText('Reason (required)')).toBeNull();

    await user.click(within(friday).getByRole('button', { name: "Can't get a price" }));
    await user.type(within(friday).getByLabelText('Reason (required)'), 'no quote');
    // Cancel gives the draft up.
    await user.click(within(friday).getByRole('button', { name: 'Cancel' }));
    expect(within(friday).queryByLabelText('Reason (required)')).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Save Marks (0)' })).toBeTruthy();

    await user.click(within(friday).getByRole('button', { name: "Can't get a price" }));
    await user.type(within(friday).getByLabelText('Reason (required)'), 'no quote');
    // The reason is a draft: it survives choosing another cell and coming back.
    await user.click(inputOf(panel, 'XYZ', MONDAY_LABEL));
    expect(within(panel).getByRole('button', { name: 'Save Marks (1)' })).toBeTruthy();
    const back = await choose(user, panel, 'XYZ', FRIDAY_LABEL);
    expect(within(back).getByLabelText<HTMLTextAreaElement>('Reason (required)').value).toBe('no quote');
  });

  it('should correct an earlier session Mark at once with its reason, bound at the revision the open listed', async () => {
    const facade = cardFacade(gridReview({ earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51', 3) })] }));
    vi.mocked(facade.MarketData.save).mockResolvedValue({ kind: 'Saved', resolution: available('51.50', 4), resolutionRevision: 4, classification: 'Correction' } as never);
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();

    const friday = await choose(user, panel, 'XYZ', FRIDAY_LABEL);
    await user.click(within(friday).getByRole('button', { name: 'Correct' }));
    await user.type(within(friday).getByLabelText('Price'), '51.5');
    await user.type(within(friday).getByLabelText('Reason (required)'), 'typo');
    await user.click(within(friday).getByRole('button', { name: 'Save correction' }));

    expect(facade.MarketData.save).toHaveBeenCalledWith({ intention: 'CorrectMark', instrumentKey: 'XYZ', tradingDate: FRIDAY, price: '51.5', reason: 'typo', expectedResolutionRevision: 3 });
    expect(facade.DailyReview.save).not.toHaveBeenCalled();
  });

  it('should offer Withdraw on an acknowledged Review Date cell and not on an earlier session', async () => {
    const thursday: Earlier[number] = { ...xyzGap, trades: [{ tradeId: 't-a', from: THURSDAY }], missing: [], acknowledged: [THURSDAY], revisions: { [THURSDAY]: 2 }, acknowledgments: { [THURSDAY]: ACK.acknowledgment } };
    renderReview(cardFacade(gridReview({ today: [markRowOf('ABC', ACK, 2)], earlier: [thursday], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') }, THURSDAY), abcMarks({ [FRIDAY]: markAt('27.5') })] })));
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();

    const monday = await choose(user, panel, 'ABC', MONDAY_LABEL);
    expect(within(monday).getByText('Acknowledged Unavailable')).toBeTruthy();
    expect(within(monday).getByRole('button', { name: 'Withdraw' })).toBeTruthy();
    // An earlier session offers a price over the acknowledgment, but no Withdraw (A57).
    const earlier = await choose(user, panel, 'XYZ', 'Thu Oct 8');
    expect(within(earlier).getByText('Acknowledged Unavailable')).toBeTruthy();
    expect(within(earlier).getByLabelText('Price')).toBeTruthy();
    expect(within(earlier).queryByRole('button', { name: 'Withdraw' })).toBeNull();
  });

  it('should say which Trades hold the Instrument, only when more than one does', async () => {
    const xyz = { ...markRowOf('XYZ', ACK, 2), trades: ['t-a', 't-f'] };
    renderReview(cardFacade(gridReview({ today: [xyz, markRowOf('ABC', ACK, 2)], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') }), abcMarks({ [FRIDAY]: markAt('27.5') })] })));
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();

    expect(within(await choose(user, panel, 'XYZ', MONDAY_LABEL)).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/trades/t-a', '/trades/t-f']);
    // ABC is held by one Trade, which is not named as if another held it too.
    expect(within(await choose(user, panel, 'ABC', MONDAY_LABEL)).queryByText(/held by/)).toBeNull();
  });

  it('should show Needed only while settlement is due beside the Review Date price, and the zero hint in an earlier cell editor', async () => {
    const settling = walked('t-a', 'XYZ', { progress: cardProgress(0, 0, { needed: 1, resolved: 0, settlement: true }) });
    const marks = gridReview({ today: [markRowOf('XYZ', { kind: 'Missing' }, 'None', 'Manual'), missingRow('DEF', ['t-c'])], earlier: [{ ...xyzGap, trades: [{ tradeId: 't-a', from: FRIDAY }] }], earlierMarks: [xyzMarks({}, FRIDAY)] });
    renderReview(cardFacade(review({ families: [marks.families[0]!, { family: 'Trades', trades: [settling, TF, TC] }] })));
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();

    const row = (symbol: string) => within(gridOf(panel)).getByRole('rowheader', { name: symbol }).closest('tr')!;
    expect(within(row('XYZ')).getByText('Needed only while settlement is due')).toBeTruthy();
    expect(within(row('DEF')).queryByText('Needed only while settlement is due')).toBeNull();
    // An earlier session's Mark is not a settlement task: the zero hint only.
    const friday = await choose(user, panel, 'XYZ', FRIDAY_LABEL);
    expect(within(friday).getByText('0 means it closed with no value')).toBeTruthy();
    expect(within(friday).queryByText('Needed only while settlement is due')).toBeNull();
  });

  it('should show a Correct conflict in the editor and keep what was entered', async () => {
    const facade = cardFacade(gridReview({ earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51', 3) })] }));
    vi.mocked(facade.MarketData.save).mockResolvedValue({ kind: 'Conflict', key: { instrumentKey: 'XYZ', tradingDate: FRIDAY }, resolution: available('52.25', 4), resolutionRevision: 4 });
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();

    const friday = await choose(user, panel, 'XYZ', FRIDAY_LABEL);
    await user.click(within(friday).getByRole('button', { name: 'Correct' }));
    await user.type(within(friday).getByLabelText('Price'), '51.5');
    await user.type(within(friday).getByLabelText('Reason (required)'), 'typo');
    await user.click(within(friday).getByRole('button', { name: 'Save correction' }));

    expect(within(friday).getByRole('alert').textContent).toContain('Nothing was saved');
    expect(within(friday).getByText('Current price $52.25')).toBeTruthy();
    expect(within(friday).getByLabelText<HTMLInputElement>('Price').value).toBe('51.5');
    expect(within(friday).getByLabelText<HTMLTextAreaElement>('Reason (required)').value).toBe('typo');
  });

  it('should close the editor without saving when another cell is chosen, keeping a typed price as a draft', async () => {
    const facade = cardFacade();
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', FRIDAY_LABEL), '49.00');
    expect(editors(panel).map((editor) => editor.getAttribute('aria-label'))).toEqual(['XYZ Mark, Fri Oct 9']);

    // The Review Date's Missing cell has no editor of its own, so choosing it closes Friday's.
    await user.click(inputOf(panel, 'XYZ', MONDAY_LABEL));
    expect(editors(panel)).toEqual([]);
    expect(within(panel).getByRole('button', { name: 'Save Marks (1)' })).toBeTruthy();
    expect(facade.MarketData.save).not.toHaveBeenCalled();
    expect(facade.DailyReview.save).not.toHaveBeenCalled();
  });

  it('should refuse another cell while a Correct is in progress', async () => {
    const paged = pagedReview();
    const marks = paged.families[0] as MarksFamily;
    const facade = cardFacade(review({ families: [{ ...marks, today: [...marks.today, markRowOf('ABC', ACK, 2)] }, paged.families[1]!] }));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    const friday = await choose(user, panel, 'XYZ', FRIDAY_LABEL);
    await user.click(within(friday).getByRole('button', { name: 'Correct' }));
    await user.type(within(friday).getByLabelText('Price'), '51.5');
    await user.type(within(friday).getByLabelText('Reason (required)'), 'typo');
    const stays = () => {
      expect(editors(panel).map((editor) => editor.getAttribute('aria-label'))).toEqual(['XYZ Mark, Fri Oct 9']);
      expect(within(friday).getByLabelText<HTMLInputElement>('Price').value).toBe('51.5');
      expect(within(friday).getByLabelText<HTMLTextAreaElement>('Reason (required)').value).toBe('typo');
    };

    // Focusing an input cell chooses it, and is refused: the correction keeps the focus.
    await user.click(inputOf(panel, 'XYZ', MONDAY_LABEL));
    stays();
    expect(document.activeElement).toBe(within(friday).getByLabelText('Price'));
    expect(within(panel).getByText('Save or cancel the correction to choose another cell.')).toBeTruthy();
    // So is pressing a cell.
    await user.click(cellOf(panel, 'ABC', MONDAY_LABEL));
    stays();
    // So is paging.
    expect(within(panel).getByRole<HTMLButtonElement>('button', { name: 'Next page' }).disabled).toBe(true);
    expect(within(panel).getByText('Save or cancel the correction to change pages.')).toBeTruthy();

    // Cancelling the correction frees the grid.
    await user.click(within(friday).getByRole('button', { name: 'Cancel' }));
    expect(within(panel).queryByText('Save or cancel the correction to choose another cell.')).toBeNull();
    await user.click(inputOf(panel, 'XYZ', MONDAY_LABEL));
    expect(editors(panel)).toEqual([]);
    expect(within(panel).getByRole<HTMLButtonElement>('button', { name: 'Next page' }).disabled).toBe(false);
  });

  it('should refuse a link to another Instrument of the open card while a Correct is in progress', async () => {
    const paged = pagedReview();
    const marks = paged.families[0] as MarksFamily;
    const abc = { ...markRowOf('ABC', { kind: 'Missing' }, 'None', 'Manual'), trades: ['t-a'] };
    const facade = cardFacade(review({ completion: { kind: 'Incomplete', reasons: [markMissing('ABC', 't-a')] }, families: [{ ...marks, today: [abc, ...marks.today] }, paged.families[1]!] }));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    const friday = await choose(user, panel, 'XYZ', FRIDAY_LABEL);
    await user.click(within(friday).getByRole('button', { name: 'Correct' }));
    await user.type(within(friday).getByLabelText('Price'), '51.5');
    await user.type(within(friday).getByLabelText('Reason (required)'), 'typo');

    // The day line of the open card's Trade links to its first Mark to go, which is ABC's.
    const link = within(screen.getByRole('list', { name: 'Trade lines' })).getAllByRole('link', { name: 'XYZ' })[0]!;
    expect(link.getAttribute('href')).toBe('/review?trade=t-a&instrument=ABC');
    await user.click(link);
    expect(editors(panel).map((editor) => editor.getAttribute('aria-label'))).toEqual(['XYZ Mark, Fri Oct 9']);
    expect(within(friday).getByLabelText<HTMLInputElement>('Price').value).toBe('51.5');
    expect(within(friday).getByLabelText<HTMLTextAreaElement>('Reason (required)').value).toBe('typo');
    expect(document.activeElement).toBe(within(friday).getByLabelText('Price'));
    expect(within(panel).getByText('Save or cancel the correction to choose another cell.')).toBeTruthy();
  });

  it('should keep a Correct in progress when a Save Marks result reveals another cell', async () => {
    const facade = cardFacade(gridReview({ earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51', 3) })] }));
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Rejected', issues: [{ entryIndex: 0, field: 'price', code: 'InvalidPrice' }] });
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    const monday = inputOf(panel, 'XYZ', MONDAY_LABEL);
    await user.type(monday, '51');
    const friday = await choose(user, panel, 'XYZ', FRIDAY_LABEL);
    await user.click(within(friday).getByRole('button', { name: 'Correct' }));
    await user.type(within(friday).getByLabelText('Price'), '51.5');
    await user.type(within(friday).getByLabelText('Reason (required)'), 'typo');

    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));

    await waitFor(() => expect(monday.getAttribute('aria-invalid')).toBe('true'));
    expect(editors(panel).map((editor) => editor.getAttribute('aria-label'))).toEqual(['XYZ Mark, Fri Oct 9']);
    expect(within(friday).getByLabelText<HTMLInputElement>('Price').value).toBe('51.5');
    expect(within(friday).getByLabelText<HTMLTextAreaElement>('Reason (required)').value).toBe('typo');
    expect(document.activeElement).toBe(within(friday).getByLabelText('Price'));
    expect(monday.value).toBe('51');
  });
});

describe('drafts belong to the Review (P156)', () => {
  const headerOf = (symbol: string) => screen.getByRole('button', { name: new RegExp(`^Review ${symbol}\\b`) });

  it('should open another card with no hold message while only Mark drafts exist', async () => {
    renderReview(cardFacade());
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');

    await user.click(headerOf('DEF'));

    expect(await screen.findByRole('region', { name: 'DEF review' })).toBeTruthy();
    expect(screen.queryByText(/note isn't saved/)).toBeNull();
    expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
  });

  it('should save every draft, across Instruments and sessions, in one Save Marks command', async () => {
    const facade = cardFacade();
    const tc = tradeReview(TC);
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([savedKey('XYZ', MONDAY, '52.00'), savedKey('XYZ', FRIDAY, '51.00'), savedKey('DEF', MONDAY, '33.10')], readyReview({ trade: tc, nextStep: { kind: 'Trade', trade: tc } })));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    await user.type(inputOf(panel, 'XYZ', FRIDAY_LABEL), '51.00');
    await user.type(inputOf(panel, 'DEF', MONDAY_LABEL), '33.10');

    await user.click(within(panel).getByRole('button', { name: 'Save Marks (3)' }));

    expect(facade.DailyReview.save).toHaveBeenCalledTimes(1);
    expect(facade.DailyReview.save).toHaveBeenCalledWith({
      kind: 'SaveReviewMarks',
      reviewDate: MONDAY,
      binding,
      entries: [
        { key: { instrumentKey: 'XYZ', tradingDate: MONDAY }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '52.00' } },
        { key: { instrumentKey: 'XYZ', tradingDate: FRIDAY }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '51.00' } },
        { key: { instrumentKey: 'DEF', tradingDate: MONDAY }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '33.10' } },
      ],
    });
    // Every Review Date Mark is in: the grid folds to its line.
    expect(await screen.findByRole('region', { name: 'Marks for Mon Oct 12 · 2 of 2 saved' })).toBeTruthy();
  });

  it('should empty every draft on the page with Discard', async () => {
    const facade = cardFacade();
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    await user.type(inputOf(panel, 'XYZ', FRIDAY_LABEL), '51.00');
    await user.type(inputOf(panel, 'DEF', MONDAY_LABEL), '33.10');
    expect(within(panel).getByRole('button', { name: 'Save Marks (3)' })).toBeTruthy();

    await user.click(within(panel).getByRole('button', { name: 'Discard' }));

    expect(within(panel).getByRole('button', { name: 'Save Marks (0)' })).toBeTruthy();
    for (const [symbol, date] of [['XYZ', MONDAY_LABEL], ['XYZ', FRIDAY_LABEL], ['DEF', MONDAY_LABEL]] as const) expect(inputOf(panel, symbol, date).value).toBe('');
    expect(facade.DailyReview.save).not.toHaveBeenCalled();
  });

  it('should keep a draft whose key is still in the refreshed Review when the Trade that held it no longer does', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'ReviewChanged', evidence: { marketDataSnapshotId: 'mds1:2:def', frames: [] } });
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    await within(panel).findByRole('alert');
    // T-A no longer holds XYZ; T-F still does.
    const moved = review({ families: [{ family: 'Marks', earlierMarks: [], today: [missingRow('XYZ', ['t-f']), missingRow('DEF', ['t-c'])], earlier: [] }, { family: 'Trades', trades: [TF, TC] }] });
    vi.mocked(facade.DailyReview.open).mockResolvedValue(moved);
    await user.click(within(panel).getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));

    await waitFor(() => expect(within(panel).getByRole('button', { name: 'Save Marks (1)' })).toBeTruthy());
    expect(inputOf(panel, 'XYZ', MONDAY_LABEL).value).toBe('52.00');
  });

  it('should name the Trade a dropped draft was typed in, in the not kept notice', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'ReviewChanged', evidence: { marketDataSnapshotId: 'mds1:2:def', frames: [] } });
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    await within(panel).findByRole('alert');
    // The Review no longer holds XYZ, nor either Trade that held it.
    const gone = review({ families: [{ family: 'Marks', earlierMarks: [], today: [missingRow('DEF', ['t-c'])], earlier: [] }, { family: 'Trades', trades: [TC] }] });
    vi.mocked(facade.DailyReview.open).mockResolvedValue(gone);
    await user.click(within(panel).getByRole('button', { name: 'Refresh' }));

    expect((await screen.findByRole('status')).textContent).toBe('XYZ is no longer in this Review, so what you entered for it was not kept.');
    expect(within(await marksPanel()).getByRole('button', { name: 'Save Marks (0)' })).toBeTruthy();
  });

  it('should send nothing and say W76 with more than 100 drafts', async () => {
    // 111 earlier sessions and the Review Date: 112 drafts, typed 20 sessions a page.
    const dates = Array.from({ length: 111 }, (_, i) => new Date(Date.UTC(2026, 5, 1 + i)).toISOString().slice(0, 10));
    const gap: Earlier[number] = { ...xyzGap, trades: [{ tradeId: 't-a', from: dates[0]! }], missing: dates, revisions: Object.fromEntries(dates.map((d) => [d, 'None'])) };
    const facade = cardFacade(gridReview({ today: [missingRow('XYZ', ['t-a', 't-f'])], earlier: [gap], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') }, dates[0])] }));
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([]));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    const enter = (value: string) => {
      for (const input of within(panel).getAllByRole<HTMLInputElement>('textbox')) fireEvent.change(input, { target: { value } });
    };
    for (let page = 0; page < 6; page++) {
      enter('51');
      if (page < 5) await user.click(within(panel).getByRole('button', { name: 'Next page' }));
    }
    expect(within(panel).getByRole('button', { name: 'Save Marks (112)' })).toBeTruthy();

    await user.click(within(panel).getByRole('button', { name: 'Save Marks (112)' }));

    const words = 'Save Marks takes up to 100 at once; 112 are entered. Clear 12, then save.';
    expect(within(panel).getByText(words)).toBeTruthy();
    expect(facade.DailyReview.save).not.toHaveBeenCalled();

    // The last page holds 12 of them: clearing those brings it back to the limit, the words go, and Save Marks sends the 100.
    enter('');
    expect(within(panel).queryByText(words)).toBeNull();
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (100)' }));
    expect(facade.DailyReview.save).toHaveBeenCalledTimes(1);
    const sent = vi.mocked(facade.DailyReview.save).mock.calls[0]![0];
    expect(sent.kind).toBe('SaveReviewMarks');
    expect(sent.kind === 'SaveReviewMarks' ? sent.entries : []).toHaveLength(100);
  });

  it('should still hold leaving the page while any Mark draft exists', async () => {
    const onDirtyChange = vi.fn();
    renderReview(cardFacade(), { onDirtyChange });
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    expect(onDirtyChange).not.toHaveBeenCalledWith(true);

    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    // The draft holds no card, and the page stays held when another card is open.
    await user.click(screen.getByRole('button', { name: /^Review DEF\b/ }));
    await marksPanelWithEarlier();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await user.click(within(panel).getByRole('button', { name: 'Discard' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('should hold paging only while a Correct is in progress, saying W80', async () => {
    renderReview(cardFacade(pagedReview()));
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    const next = () => within(panel).getByRole<HTMLButtonElement>('button', { name: 'Next page' });
    // A typed price holds nothing.
    await user.type(inputOf(panel, 'XYZ', 'Fri Sep 25'), '49.00');
    expect(next().disabled).toBe(false);
    expect(within(panel).queryByText('Save or cancel the correction to change pages.')).toBeNull();

    const friday = await choose(user, panel, 'XYZ', FRIDAY_LABEL);
    await user.click(within(friday).getByRole('button', { name: 'Correct' }));
    await user.type(within(friday).getByLabelText('Price'), '51.5');
    expect(next().disabled).toBe(true);
    expect(within(panel).getByText('Save or cancel the correction to change pages.')).toBeTruthy();

    await user.click(within(friday).getByRole('button', { name: 'Cancel' }));
    expect(next().disabled).toBe(false);
    expect(within(panel).queryByText('Save or cancel the correction to change pages.')).toBeNull();
  });
});

describe('links, refused saves, kept drafts and the turn (T9R2.14)', () => {
  it('should focus the Instrument Review Date cell from a Missing-Mark link, with no card opened for it', async () => {
    renderReview(cardFacade(), { at: '/review?trade=t-a&instrument=XYZ' });
    const panel = await marksPanel();

    // T-A also lacks Friday's Mark, but the link names the Review Date cell: Friday's column is not added.
    await waitFor(() => expect(document.activeElement).toBe(inputOf(panel, 'XYZ', MONDAY_LABEL)));
    expect(within(panel).queryByRole('textbox', { name: `XYZ Mark, ${FRIDAY_LABEL}` })).toBeNull();
  });

  it('should show the first refused key after a refused save, on its page, with its issue and focus on its input', async () => {
    const facade = cardFacade(pagedReview());
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Rejected', issues: [{ entryIndex: 0, field: 'price', code: 'InvalidPrice' }] });
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    // The draft is typed on the second page; the first page is back when Save Marks is pressed.
    await user.click(within(panel).getByRole('button', { name: 'Next page' }));
    await user.type(within(panel).getByRole('textbox', { name: 'XYZ Mark, Tue Sep 1' }), 'abc');
    await user.click(within(panel).getByRole('button', { name: 'Previous page' }));
    expect(within(panel).queryByRole('textbox', { name: 'XYZ Mark, Tue Sep 1' })).toBeNull();

    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));

    const editor = await within(panel).findByRole('region', { name: 'XYZ Mark, Tue Sep 1' });
    expect(within(editor).getByText('Enter a price as a number, with at most 6 decimal places.')).toBeTruthy();
    expect(within(panel).getByText('Sessions 21 to 25 of 25')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(within(panel).getByRole('textbox', { name: 'XYZ Mark, Tue Sep 1' })));
  });

  it('should name a Trade that is still in the Review when a draft was dropped because its key left', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'ReviewChanged', evidence: { marketDataSnapshotId: 'mds1:2:def', frames: [] } });
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', FRIDAY_LABEL), '49.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    await within(panel).findByRole('alert');
    // Friday is no longer listed, and T-A is still walked.
    vi.mocked(facade.DailyReview.open).mockResolvedValue(review({ families: [{ family: 'Marks', earlierMarks: [], today: [missingRow('XYZ', ['t-a', 't-f']), missingRow('DEF', ['t-c'])], earlier: [] }, { family: 'Trades', trades: WALK }] }));
    await user.click(within(panel).getByRole('button', { name: 'Refresh' }));

    expect((await screen.findByRole('status')).textContent).toBe('What you entered for XYZ was not kept, because the Review no longer lists it.');
    expect(within(panel).getByRole('button', { name: 'Save Marks (0)' })).toBeTruthy();
  });

  it('should drop every draft and release the page when the Review refreshes to Empty', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'ReviewChanged', evidence: { marketDataSnapshotId: 'mds1:2:def', frames: [] } });
    const onDirtyChange = vi.fn();
    renderReview(facade, { onDirtyChange });
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));
    await within(panel).findByRole('alert');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    vi.mocked(facade.DailyReview.open).mockResolvedValue({ kind: 'Empty', reviewDate: MONDAY, cutoff: CUTOFF, owed: [], binding: newBinding });
    await user.click(within(panel).getByRole('button', { name: 'Refresh' }));

    await waitFor(() => expect(screen.queryByRole('region', { name: 'The day' })).toBeNull());
    expect(screen.queryByRole('button', { name: /^Save Marks/ })).toBeNull();
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });
});

describe('focus when the pressed control goes (T9R2.17-B3)', () => {
  it('should move focus to Reason required when Cant get a price is pressed', async () => {
    renderReview(cardFacade());
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    const friday = await choose(user, panel, 'XYZ', FRIDAY_LABEL);

    await user.click(within(friday).getByRole('button', { name: "Can't get a price" }));

    expect(document.activeElement).toBe(within(friday).getByLabelText('Reason (required)'));
  });

  it('should move focus to the correction Price when Correct is pressed', async () => {
    renderReview(cardFacade(gridReview({ earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51', 3) })] })));
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    const friday = await choose(user, panel, 'XYZ', FRIDAY_LABEL);

    await user.click(within(friday).getByRole('button', { name: 'Correct' }));

    expect(document.activeElement).toBe(within(friday).getByLabelText('Price'));
  });

  it('should move focus to the cell when Withdraw is pressed and the cell turns into a price input', async () => {
    const facade = cardFacade(gridReview({ today: [markRowOf('ABC', ACK, 2)], earlierMarks: [abcMarks({ [FRIDAY]: markAt('27.5') })] }));
    vi.mocked(facade.MarketData.save).mockResolvedValue({ kind: 'Saved', resolution: { kind: 'Missing' }, resolutionRevision: 3, classification: 'Withdrawal' } as never);
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    const monday = await choose(user, panel, 'ABC', MONDAY_LABEL);

    await user.click(within(monday).getByRole('button', { name: 'Withdraw' }));

    await waitFor(() => expect(document.activeElement).toBe(inputOf(panel, 'ABC', MONDAY_LABEL)));
  });

  it('should move focus to Previous page when Next page goes on the last page, and back to Next page when Previous page goes', async () => {
    renderReview(cardFacade(pagedReview()));
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();

    await user.click(within(panel).getByRole('button', { name: 'Next page' }));
    expect(document.activeElement).toBe(within(panel).getByRole('button', { name: 'Previous page' }));

    await user.click(within(panel).getByRole('button', { name: 'Previous page' }));
    expect(document.activeElement).toBe(within(panel).getByRole('button', { name: 'Next page' }));
  });
});

describe('the skipped sessions, and the Cant get a price field (T95.12-B2)', () => {
  const stock = (symbol: string) => ({ kind: 'Stock' as const, symbol });
  const xyzAcknowledged: Earlier[number] = { ...xyzGap, trades: [{ tradeId: 't-a', from: THURSDAY }], missing: [], acknowledged: [THURSDAY], revisions: { [THURSDAY]: 2 }, acknowledgments: { [THURSDAY]: ACK.acknowledgment } };
  const defThursday: Earlier[number] = { ...xyzGap, instrumentKey: 'DEF', instrument: stock('DEF'), trades: [{ tradeId: 't-c', from: THURSDAY }], missing: [THURSDAY], revisions: { [THURSDAY]: 'None' } };
  const withMissedDay = (built: Ready): Ready => ({ ...built, day: { ...built.day!, missed: [THURSDAY] } });
  const reasonField = (step: HTMLElement) => within(step).getByRole<HTMLInputElement>('textbox', { name: 'Why no price, XYZ' });

  it('should focus the first Missing cell, not a held cell, when the skipped sessions are added', async () => {
    renderReview(cardFacade(gridReview({ earlier: [xyzAcknowledged, defThursday] })));
    const user = userEvent.setup();
    const step = await marksPanel();

    await user.click(within(step).getByRole('button', { name: 'Add the skipped sessions' }));

    // XYZ is acknowledged on Thursday; DEF is the one still Missing.
    expect(document.activeElement).toBe(within(step).getByRole('textbox', { name: 'DEF Mark, Thu Oct 8' }));
  });

  it('should focus the previous session Missing cell when Add them is pressed and that is the only gap', async () => {
    // XYZ has Friday's Mark; DEF lacks it, and Friday is the previous session, so no earlier column is added.
    const defFriday: Earlier[number] = { ...defThursday, trades: [{ tradeId: 't-c', from: FRIDAY }], missing: [FRIDAY], revisions: { [FRIDAY]: 'None' } };
    renderReview(cardFacade(withMissedDay(gridReview({ earlier: [defFriday], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') })] }))));
    const user = userEvent.setup();
    const step = await marksPanel();

    await user.click(await screen.findByRole('button', { name: 'Add them' }));

    await waitFor(() => expect(document.activeElement).toBe(within(step).getByRole('textbox', { name: 'DEF Mark, Fri Oct 9' })));
  });

  it('should leave focus on the first skipped cell after an Instrument link, not move it back to the Instrument', async () => {
    const xyzThursday: Earlier[number] = { ...xyzGap, trades: [{ tradeId: 't-a', from: THURSDAY }, { tradeId: 't-f', from: MONDAY }], missing: [THURSDAY], revisions: { [THURSDAY]: 'None' } };
    renderReview(cardFacade(gridReview({ earlier: [xyzThursday], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') }, THURSDAY)] })), { at: '/review?trade=t-a&instrument=XYZ' });
    const user = userEvent.setup();
    const step = await marksPanel();
    await waitFor(() => expect(document.activeElement).toBe(within(step).getByRole('textbox', { name: 'XYZ Mark, Mon Oct 12' })));

    await user.click(within(step).getByRole('button', { name: 'Add the skipped sessions' }));

    await waitFor(() => expect(document.activeElement).toBe(within(step).getByRole('textbox', { name: 'XYZ Mark, Thu Oct 8' })));
    // It stays: nothing moves it back a moment later.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.activeElement).toBe(within(step).getByRole('textbox', { name: 'XYZ Mark, Thu Oct 8' }));
  });

  it('should show a refused reason in its row and focus the reason field, when Save Marks refuses a Review Date Cant get a price', async () => {
    const facade = cardFacade(gridReview());
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Rejected', issues: [{ entryIndex: 0, field: 'reason', code: 'ReasonTooLong' }] });
    renderReview(facade);
    const user = userEvent.setup();
    const step = await marksPanel();
    await user.click(within(step).getByRole('button', { name: "Can't get a price, XYZ" }));
    await user.type(reasonField(step), 'no quote');
    await user.click(within(step).getByRole('button', { name: 'No price' }));
    expect(within(step).queryByRole('textbox', { name: 'Why no price, XYZ' })).toBeNull();

    await user.click(within(step).getByRole('button', { name: 'Save Marks (1)' }));

    expect(await within(step).findByText('Keep the reason to 500 characters or fewer.')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(reasonField(step)));
    expect(reasonField(step).value).toBe('no quote');
  });

  it('should reopen and focus the reason field when the same Cant get a price is refused again', async () => {
    const facade = cardFacade(gridReview());
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Rejected', issues: [{ entryIndex: 0, field: 'reason', code: 'ReasonTooLong' }] });
    renderReview(facade);
    const user = userEvent.setup();
    const step = await marksPanel();
    await user.click(within(step).getByRole('button', { name: "Can't get a price, XYZ" }));
    await user.type(reasonField(step), 'no quote');
    await user.click(within(step).getByRole('button', { name: 'No price' }));
    await user.click(within(step).getByRole('button', { name: 'Save Marks (1)' }));
    await waitFor(() => expect(document.activeElement).toBe(reasonField(step)));
    await user.click(within(step).getByRole('button', { name: 'No price' }));
    expect(within(step).queryByRole('textbox', { name: 'Why no price, XYZ' })).toBeNull();

    await user.click(within(step).getByRole('button', { name: 'Save Marks (1)' }));

    await waitFor(() => expect(document.activeElement).toBe(reasonField(step)));
  });

  it('should close the reason field when its Cant get a price is saved', async () => {
    const facade = cardFacade(gridReview());
    const acknowledged: Extract<SaveResult, { kind: 'MarksSaved' }>['marks'][number] = { ...savedKey('XYZ', MONDAY, '0'), resolution: ACK };
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([acknowledged]));
    renderReview(facade);
    const user = userEvent.setup();
    const step = await marksPanel();
    await user.click(within(step).getByRole('button', { name: "Can't get a price, XYZ" }));
    await user.type(reasonField(step), 'no quote');

    await user.click(within(step).getByRole('button', { name: 'Save Marks (1)' }));

    await waitFor(() => expect(within(step).getByRole('button', { name: 'XYZ Mark, Mon Oct 12' })).toBeTruthy());
    expect(within(step).queryByRole('textbox', { name: 'Why no price, XYZ' })).toBeNull();
  });

  describe('a first Missing cell beyond the first page', () => {
    // 20 newer skipped sessions hold an acknowledgment; the 5 oldest (Sep 1 to 5) are the first Missing cells, on the second page.
    const held = Array.from({ length: 20 }, (_, i) => day(i + 6));
    const lost = Array.from({ length: 5 }, (_, i) => day(i + 1));
    const farGap = (): Ready => {
      const gap: Earlier[number] = { ...xyzGap, trades: [{ tradeId: 't-a', from: day(1) }], missing: lost, acknowledged: held, revisions: { ...Object.fromEntries(lost.map((d) => [d, 'None'])), ...Object.fromEntries(held.map((d) => [d, 2])) }, acknowledgments: Object.fromEntries(held.map((d) => [d, ACK.acknowledgment])) };
      return gridReview({ today: [missingRow('XYZ', ['t-a', 't-f'])], earlier: [gap], earlierMarks: [xyzMarks({ [FRIDAY]: markAt('51') }, day(1))] });
    };

    it('should show the page of the first Missing cell and focus it when the skipped sessions are added', async () => {
      renderReview(cardFacade(farGap()));
      const user = userEvent.setup();
      const step = await marksPanel();

      await user.click(within(step).getByRole('button', { name: 'Add the skipped sessions' }));

      await waitFor(() => expect(document.activeElement).toBe(within(step).getByRole('textbox', { name: 'XYZ Mark, Sat Sep 5' })));
    });

    const startCorrection = async (user: ReturnType<typeof userEvent.setup>, step: HTMLElement) => {
      const friday = await choose(user, step, 'XYZ', FRIDAY_LABEL);
      await user.click(within(friday).getByRole('button', { name: 'Correct' }));
      await user.type(within(friday).getByLabelText('Price'), '51.5');
      return friday;
    };

    it('should leave the page and the correction focus alone when Add the skipped sessions is pressed during a Correct', async () => {
      renderReview(cardFacade(farGap()));
      const user = userEvent.setup();
      const step = await marksPanel();
      const friday = await startCorrection(user, step);

      await user.click(within(step).getByRole('button', { name: 'Add the skipped sessions' }));

      expect(within(step).queryByRole('textbox', { name: 'XYZ Mark, Sat Sep 5' })).toBeNull();
      expect(document.activeElement).toBe(within(friday).getByLabelText('Price'));
      expect(within(step).getByText('Save or cancel the correction to choose another cell.')).toBeTruthy();
    });

    it('should leave the page and the correction focus alone when the missed-day link is pressed during a Correct', async () => {
      const built = farGap();
      renderReview(cardFacade({ ...built, day: { ...built.day!, missed: [THURSDAY] } }));
      const user = userEvent.setup();
      const step = await marksPanel();
      const friday = await startCorrection(user, step);

      await user.click(await screen.findByRole('button', { name: 'Add them' }));

      expect(within(step).queryByRole('textbox', { name: 'XYZ Mark, Sat Sep 5' })).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(within(friday).getByLabelText('Price')));
    });

    it('should show the page of the first Missing cell and focus it from the missed-day link', async () => {
      const built = farGap();
      renderReview(cardFacade({ ...built, day: { ...built.day!, missed: [THURSDAY] } }));
      const user = userEvent.setup();
      const step = await marksPanel();

      await user.click(await screen.findByRole('button', { name: 'Add them' }));

      await waitFor(() => expect(document.activeElement).toBe(within(step).getByRole('textbox', { name: 'XYZ Mark, Sat Sep 5' })));
    });
  });

  it('should hold the reason to 500 characters', async () => {
    renderReview(cardFacade(gridReview()));
    const user = userEvent.setup();
    const step = await marksPanel();
    await user.click(within(step).getByRole('button', { name: "Can't get a price, XYZ" }));

    await user.click(reasonField(step));
    await user.paste('x'.repeat(501));

    expect(reasonField(step).value).toHaveLength(500);
  });

  it('should count a reason typed in the Cant get a price field as unsaved, and clear it with Discard', async () => {
    renderReview(cardFacade(gridReview()));
    const user = userEvent.setup();
    const step = await marksPanel();
    await user.click(within(step).getByRole('button', { name: "Can't get a price, XYZ" }));
    await user.type(reasonField(step), 'no quote');
    expect(within(step).getByRole('button', { name: 'Save Marks (1)' })).toBeTruthy();

    await user.click(within(step).getByRole('button', { name: 'Discard' }));

    expect(within(step).getByRole('button', { name: 'Save Marks (0)' })).toBeTruthy();
    expect(reasonField(step).value).toBe('');
  });
});

// The slip questions (T95.13): a Review Date price that reads as a slip is questioned when its cell is left. The answers are screen state.
describe('the slip questions in the grid (T95.13)', () => {
  const slipReview = () => cardFacade(gridReview({ earlierMarks: [xyzMarks({ [FRIDAY]: markAt('45.10') })] }));
  const xyzInput = (step: HTMLElement) => within(step).getByRole<HTMLInputElement>('textbox', { name: 'XYZ Mark, Mon Oct 12' });
  const xyzRow = (step: HTMLElement) => within(gridOf(step)).getByRole('rowheader', { name: 'XYZ' }).closest('tr')!;

  it('should question a Mark that reads as a slip when its cell is left, in place under the row', async () => {
    renderReview(slipReview());
    const user = userEvent.setup();
    const step = await marksPanel();

    await user.type(xyzInput(step), '49.00');
    // Still typing in the cell: nothing is asked.
    expect(within(step).queryByText('+8.6% from $45.10. Right?')).toBeNull();
    await user.tab();

    const question = within(step).getByText('+8.6% from $45.10. Right?');
    expect(xyzRow(step).nextElementSibling!.contains(question)).toBe(true);
    // A price inside the limits is not questioned.
    await user.clear(xyzInput(step));
    await user.type(xyzInput(step), '46.00');
    await user.tab();
    expect(within(step).queryByText(/Right\?/)).toBeNull();
  });

  it('should offer both readings of a ten-times slip and take the one pressed', async () => {
    renderReview(slipReview());
    const user = userEvent.setup();
    const step = await marksPanel();

    await user.type(xyzInput(step), '440');
    await user.tab();
    expect(within(step).getByText('$44.00 or $440.00?')).toBeTruthy();
    await user.click(within(step).getByRole('button', { name: '$44.00' }));
    expect(xyzInput(step).value).toBe('44.00');
    expect(within(step).queryByText('$44.00 or $440.00?')).toBeNull();
    expect(within(xyzRow(step)).getByText('−$1.10 (−2.4%)')).toBeTruthy();

    await user.clear(xyzInput(step));
    await user.type(xyzInput(step), '440');
    await user.tab();
    await user.click(within(step).getByRole('button', { name: '$440.00' }));
    expect(xyzInput(step).value).toBe('440');
    expect(within(step).queryByText('$44.00 or $440.00?')).toBeNull();
  });

  it('should keep the typed Mark on Yes and return to the input on Retype', async () => {
    renderReview(slipReview());
    const user = userEvent.setup();
    const step = await marksPanel();

    await user.type(xyzInput(step), '49.00');
    await user.tab();
    await user.click(within(step).getByRole('button', { name: 'Yes, $49.00' }));
    expect(xyzInput(step).value).toBe('49.00');
    expect(within(step).queryByText(/Right\?/)).toBeNull();
    expect(within(step).getByRole('button', { name: 'Save Marks (1)' })).toBeTruthy();
    // The pressed button is gone, so focus goes on to the next price, as Enter would.
    expect(document.activeElement).toBe(within(step).getByRole('textbox', { name: 'DEF Mark, Mon Oct 12' }));

    await user.clear(xyzInput(step));
    await user.type(xyzInput(step), '55.00');
    await user.tab();
    await user.click(within(step).getByRole('button', { name: 'Retype' }));
    expect(xyzInput(step).value).toBe('');
    expect(document.activeElement).toBe(xyzInput(step));
    expect(within(step).queryByText(/Right\?/)).toBeNull();
    expect(within(step).getByRole('button', { name: 'Save Marks (0)' })).toBeTruthy();
  });

  it('should ask Worth nothing for a zero option Mark', async () => {
    const call = { kind: 'Option' as const, symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', right: 'Call' as const, strike: '50', multiplier: 100 as const };
    const key = 'XYZ261120C00050000';
    const row: MarkRow = { ...missingRow(key, ['t-a']), instrument: call };
    const marks = { instrumentKey: key, instrument: call, trades: [{ tradeId: 't-a', from: FRIDAY }], marks: { [FRIDAY]: markAt('1.50') } };
    renderReview(cardFacade(gridReview({ today: [row], earlierMarks: [marks] })));
    const user = userEvent.setup();
    const step = await marksPanel();
    const price = within(step).getByRole<HTMLInputElement>('textbox', { name: /Mark, Mon Oct 12$/ });

    await user.type(price, '0');
    await user.tab();
    expect(within(step).getByText('Worth nothing?')).toBeTruthy();
    await user.click(within(step).getByRole('button', { name: 'Yes, $0.00' }));
    expect(price.value).toBe('0');
    expect(within(step).queryByText('Worth nothing?')).toBeNull();
    expect(within(step).getByRole('button', { name: 'Save Marks (1)' })).toBeTruthy();
  });

  it('should not ask Worth nothing for a zero option Mark on the day its contract expires', async () => {
    const call = { kind: 'Option' as const, symbol: 'XYZ', root: 'XYZ', expiration: '2026-10-12', right: 'Call' as const, strike: '50', multiplier: 100 as const };
    const key = 'XYZ261012C00050000';
    const row: MarkRow = { ...missingRow(key, ['t-a']), instrument: call };
    const marks = { instrumentKey: key, instrument: call, trades: [{ tradeId: 't-a', from: FRIDAY }], marks: { [FRIDAY]: markAt('1.50') } };
    const family: MarksFamily = { family: 'Marks', today: [row], earlier: [], earlierMarks: [marks], previousSession: FRIDAY };
    renderReview(cardFacade(review({ families: [family, { family: 'Trades', trades: [{ ...TA, expiresOnReviewDate: true as const }, TF, TC] }] })));
    const user = userEvent.setup();
    const step = await marksPanel();
    const price = within(step).getByRole<HTMLInputElement>('textbox', { name: /Mark, Mon Oct 12$/ });

    await user.type(price, '0');
    await user.tab();
    expect(within(step).queryByText('Worth nothing?')).toBeNull();
    expect(within(step).getByRole('button', { name: 'Save Marks (1)' })).toBeTruthy();
  });

  it('should refuse what is not a price, and a zero share price', async () => {
    renderReview(slipReview());
    const user = userEvent.setup();
    const step = await marksPanel();

    await user.type(xyzInput(step), 'abc');
    await user.tab();
    expect(within(step).getByText('Not a price. Digits only, like 45.10.')).toBeTruthy();
    // A refusal has nothing to press: the entry is typed again.
    expect(within(step).queryByRole('button', { name: 'Retype' })).toBeNull();

    await user.clear(xyzInput(step));
    await user.type(xyzInput(step), '0');
    await user.tab();
    expect(within(step).queryByText(/Not a price/)).toBeNull();
    expect(within(step).getByText("A share price can't be $0.00.")).toBeTruthy();
  });

  it('should hold Save Marks while a question is open and say how many', async () => {
    const facade = slipReview();
    renderReview(facade);
    const user = userEvent.setup();
    const step = await marksPanel();
    const defInput = within(step).getByRole<HTMLInputElement>('textbox', { name: 'DEF Mark, Mon Oct 12' });

    await user.type(xyzInput(step), '49.00');
    await user.type(defInput, 'x');
    // Pressing Save Marks leaves the cell it was typed in: both are asked about, and nothing is sent.
    await user.click(within(step).getByRole('button', { name: 'Save Marks (2)' }));
    expect(within(step).getByText('2 Marks to check first.')).toBeTruthy();
    expect(facade.DailyReview.save).not.toHaveBeenCalled();

    await user.click(within(step).getByRole('button', { name: 'Yes, $49.00' }));
    expect(within(step).getByText('1 Mark to check first.')).toBeTruthy();
    await user.click(within(step).getByRole('button', { name: 'Save Marks (2)' }));
    expect(facade.DailyReview.save).not.toHaveBeenCalled();
  });

  it('should not ask again about a Mark already answered, until it is retyped', async () => {
    const facade = slipReview();
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([savedKey('XYZ', MONDAY, '49.00')]));
    renderReview(facade);
    const user = userEvent.setup();
    const step = await marksPanel();

    await user.type(xyzInput(step), '49.00');
    await user.tab();
    await user.click(within(step).getByRole('button', { name: 'Yes, $49.00' }));
    // Back into the cell and out again: the answer stands.
    await user.click(xyzInput(step));
    await user.tab();
    expect(within(step).queryByText(/Right\?/)).toBeNull();

    // Typing the same price again is a new entry, and is asked about.
    await user.clear(xyzInput(step));
    await user.type(xyzInput(step), '49.00');
    await user.tab();
    expect(within(step).getByText('+8.6% from $45.10. Right?')).toBeTruthy();

    // Answered again, Save Marks sends it without asking.
    await user.click(within(step).getByRole('button', { name: 'Yes, $49.00' }));
    await user.click(within(step).getByRole('button', { name: 'Save Marks (1)' }));
    expect(within(step).queryByText(/to check first/)).toBeNull();
    expect(facade.DailyReview.save).toHaveBeenCalledTimes(1);
  });

  it('should not ask while a price answered earlier is typed again, only when its cell is left for T95.13-B1', async () => {
    renderReview(slipReview());
    const user = userEvent.setup();
    const step = await marksPanel();

    await user.type(xyzInput(step), '49.00');
    await user.tab();
    await user.click(within(step).getByRole('button', { name: 'Yes, $49.00' }));
    await user.clear(xyzInput(step));
    await user.type(xyzInput(step), '49.00');
    expect(within(step).queryByText(/Right\?/)).toBeNull();
    await user.tab();
    expect(within(step).getByText('+8.6% from $45.10. Right?')).toBeTruthy();
  });

  it('should not ask while a price is typed again after Discard, only when its cell is left for T95.13-B1', async () => {
    renderReview(slipReview());
    const user = userEvent.setup();
    const step = await marksPanel();

    await user.type(xyzInput(step), '49.00');
    await user.tab();
    expect(within(step).getByText('+8.6% from $45.10. Right?')).toBeTruthy();
    await user.click(within(step).getByRole('button', { name: 'Discard' }));
    await user.type(xyzInput(step), '49.00');
    expect(within(step).queryByText(/Right\?/)).toBeNull();
  });

  it('should question and re-question a price typed in the cell editor of an acknowledged Review Date cell when it is left for T95.13-B1', async () => {
    renderReview(cardFacade(gridReview({ today: [markRowOf('ABC', ACK, 2)], earlierMarks: [abcMarks({ [FRIDAY]: markAt('27.5') })] })));
    const user = userEvent.setup();
    const panel = await marksPanel();

    const editor = await choose(user, panel, 'ABC', MONDAY_LABEL);
    await user.type(within(editor).getByLabelText('Price'), '49');
    expect(within(panel).queryByText(/Right\?/)).toBeNull();
    await user.tab();
    await user.click(within(panel).getByRole('button', { name: /^Yes, / }));
    expect(within(panel).queryByText(/Right\?/)).toBeNull();
    // Typed again, the same price is a new entry and is asked about when left.
    const again = within(await marksPanel()).getByLabelText('Price');
    await user.clear(again);
    await user.type(again, '49');
    expect(within(panel).queryByText(/Right\?/)).toBeNull();
    await user.tab();
    expect(within(panel).getByText(/Right\?/)).toBeTruthy();
  });

  it('should state the limits under the grid', async () => {
    renderReview(slipReview());
    const step = await marksPanel();

    const limits = within(step).getByText('Asks before saving a Mark that moved more than 5% (stock), or 100% up or 50% down (option), since the last Mark.');
    // Under the grid, not inside it.
    expect(gridOf(step).contains(limits)).toBe(false);
    expect(gridOf(step).compareDocumentPosition(limits) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should send no slip answer with the save', async () => {
    const facade = slipReview();
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([savedKey('XYZ', MONDAY, '44.00')]));
    renderReview(facade);
    const user = userEvent.setup();
    const step = await marksPanel();

    await user.type(xyzInput(step), '440');
    await user.tab();
    await user.click(within(step).getByRole('button', { name: '$44.00' }));
    await user.click(within(step).getByRole('button', { name: 'Save Marks (1)' }));

    // The command holds the price and nothing of the question: no answer, no reading, no entry as typed.
    expect(facade.DailyReview.save).toHaveBeenCalledTimes(1);
    expect(facade.DailyReview.save).toHaveBeenCalledWith({
      kind: 'SaveReviewMarks',
      reviewDate: MONDAY,
      binding,
      entries: [{ key: { instrumentKey: 'XYZ', tradingDate: MONDAY }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '44.00' } }],
    });
  });
});

describe('Save Marks: fold, Edit, the re-sort, the fix in place (T95.14)', () => {
  const ackKey = (instrumentKey: string): Extract<SaveResult, { kind: 'MarksSaved' }>['marks'][number] => ({
    key: { instrumentKey, tradingDate: MONDAY },
    resolution: { kind: 'AcknowledgedUnavailable', acknowledgment: { versionId: 'a1', kind: 'Asserted', reason: 'halted', savedAt: '2026-10-12T21:00:00Z' } },
    resolutionRevision: 1,
    classification: 'Acknowledgment' as never,
  });
  const order = () => [...screen.getByRole('list', { name: 'Positions' }).querySelectorAll(':scope > li')].map((li) => li.getAttribute('data-trade-id'));

  it('should save every typed Mark and acknowledgment on the page with one Save Marks', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([savedKey('XYZ', MONDAY, '52.00'), ackKey('DEF')]));
    renderReview(facade);
    const user = userEvent.setup();
    const step = await marksPanel();
    await user.type(inputOf(step, 'XYZ', MONDAY_LABEL), '52.00');
    await user.click(within(step).getByRole('button', { name: /^Can't get a price/ }));
    await user.type(within(step).getByRole('textbox', { name: /^Why no price/ }), 'halted');
    await user.click(within(step).getByRole('button', { name: 'No price' }));

    await user.click(within(step).getByRole('button', { name: 'Save Marks (2)' }));

    expect(facade.DailyReview.save).toHaveBeenCalledTimes(1);
    expect(facade.DailyReview.save).toHaveBeenCalledWith({
      kind: 'SaveReviewMarks',
      reviewDate: MONDAY,
      binding,
      entries: [
        { key: { instrumentKey: 'XYZ', tradingDate: MONDAY }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '52.00' } },
        { key: { instrumentKey: 'DEF', tradingDate: MONDAY }, expectedRevision: 'None', intention: { kind: 'AssertUnavailable', reason: 'halted' } },
      ],
    });
  });

  it('should fold the grid to one line saying how many are saved and how many have no price', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([savedKey('XYZ', MONDAY, '52.00'), ackKey('DEF')]));
    renderReview(facade);
    const user = userEvent.setup();
    const step = await marksPanel();
    await user.type(inputOf(step, 'XYZ', MONDAY_LABEL), '52.00');
    await user.click(within(step).getByRole('button', { name: /^Can't get a price/ }));
    await user.type(within(step).getByRole('textbox', { name: /^Why no price/ }), 'halted');
    await user.click(within(step).getByRole('button', { name: 'No price' }));
    await user.click(within(step).getByRole('button', { name: 'Save Marks (2)' }));

    const folded = await screen.findByRole('region', { name: 'Marks for Mon Oct 12 · 2 of 2 saved · 1 no price' });
    expect(within(folded).getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(within(folded).queryByRole('table')).toBeNull();
    expect(within(folded).queryByRole('button', { name: /^Save Marks/ })).toBeNull();
  });

  it('should move focus to the first Trade header', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([savedKey('XYZ', MONDAY, '52.00'), savedKey('DEF', MONDAY, '33.10')], readyReview({ trades: [TC, TA, TF] })));
    renderReview(facade);
    const user = userEvent.setup();
    const step = await marksPanel();
    await user.type(inputOf(step, 'XYZ', MONDAY_LABEL), '52.00');
    await user.type(inputOf(step, 'DEF', MONDAY_LABEL), '33.10');
    await user.click(within(step).getByRole('button', { name: 'Save Marks (2)' }));

    // DEF's card is first in the returned order: its header, not the Edit button or the page, holds the focus.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Review DEF\b/ })));
  });

  it('should say how many Marks are still to go when some are left', async () => {
    const facade = cardFacade();
    // The returned day says how many are left: that count is the one shown, as the day card shows it.
    const day = review().day!;
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([savedKey('XYZ', MONDAY, '52.00')], readyReview({ day: { ...day, toGo: { ...day.toGo, marks: 3 } } })));
    renderReview(facade);
    const user = userEvent.setup();
    const step = await marksPanel();
    await user.type(inputOf(step, 'XYZ', MONDAY_LABEL), '52.00');
    await user.click(within(step).getByRole('button', { name: 'Save Marks (1)' }));

    // The grid stays open, says what is left, and takes focus to the first price still to enter.
    expect(await within(step).findByText('3 Marks to go.')).toBeTruthy();
    expect(document.activeElement).toBe(inputOf(step, 'DEF', MONDAY_LABEL));
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    // Typing again ends the note.
    await user.type(inputOf(step, 'DEF', MONDAY_LABEL), '3');
    expect(within(step).queryByText('3 Marks to go.')).toBeNull();
  });

  it('should open the grid again on Edit, with a saved Mark editable in place and no reason asked', async () => {
    const facade = cardFacade();
    const xyzSaved = { ...missingRow('XYZ', ['t-a', 't-f']), resolution: available('52'), resolutionRevision: 1, task: null };
    vi.mocked(facade.DailyReview.open).mockResolvedValue(gridReview({ today: [xyzSaved, missingRow('DEF', ['t-c'])] }));
    vi.mocked(facade.DailyReview.save)
      .mockResolvedValueOnce(marksSavedResult([savedKey('DEF', MONDAY, '33.10')]))
      .mockResolvedValueOnce(marksSavedResult([{ key: { instrumentKey: 'XYZ', tradingDate: MONDAY }, resolution: available('52.50', 2), resolutionRevision: 2, classification: 'Correction' }]));
    renderReview(facade);
    const user = userEvent.setup();
    const step = await marksPanel();
    await user.type(inputOf(step, 'DEF', MONDAY_LABEL), '33.10');
    await user.click(within(step).getByRole('button', { name: 'Save Marks (1)' }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));

    // The saved Mark is an input holding its price, with the words about fixing it, and no Correct or Withdraw editor.
    const xyz = inputOf(await marksPanel(), 'XYZ', MONDAY_LABEL);
    // Shown with two decimals, as the cell showed it before.
    expect(xyz.value).toBe('52.00');
    expect(document.activeElement).toBe(xyz);
    expect(screen.getByText('Saved in this Review: fix it in place, no reason needed.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Correct' })).toBeNull();
    // Typing the saved price back is no change.
    await user.clear(xyz);
    await user.type(xyz, '52.00');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Save Marks (0)' })).toBeTruthy();
    expect(xyz.value).toBe('52.00');
    await user.clear(xyz);
    await user.type(xyz, '52.50');
    await user.click(screen.getByRole('button', { name: 'Save Marks (1)' }));

    expect(screen.queryByText(/Reason/)).toBeNull();
    expect(facade.DailyReview.save).toHaveBeenLastCalledWith({
      kind: 'SaveReviewMarks',
      reviewDate: MONDAY,
      binding: newBinding,
      entries: [{ key: { instrumentKey: 'XYZ', tradingDate: MONDAY }, expectedRevision: 1, intention: { kind: 'CorrectMark', price: '52.50', reason: '' } }],
    });
    // The fixed Mark folds the grid again.
    expect(await screen.findByRole('region', { name: 'Marks for Mon Oct 12 · 2 of 2 saved' })).toBeTruthy();
  });

  it('should empty the typed Marks on Discard', async () => {
    const facade = cardFacade();
    renderReview(facade);
    const user = userEvent.setup();
    const step = await marksPanel();
    await user.type(inputOf(step, 'XYZ', MONDAY_LABEL), '52.00');
    await user.click(within(step).getByRole('button', { name: /^Can't get a price/ }));
    await user.type(within(step).getByRole('textbox', { name: /^Why no price/ }), 'halted');
    await user.click(within(step).getByRole('button', { name: 'No price' }));
    expect(within(step).getByRole('button', { name: 'Save Marks (2)' })).toBeTruthy();

    await user.click(within(step).getByRole('button', { name: 'Discard' }));

    expect(within(step).getByRole('button', { name: 'Save Marks (0)' })).toBeTruthy();
    expect(inputOf(step, 'XYZ', MONDAY_LABEL).value).toBe('');
    expect(within(step).queryByText('halted')).toBeNull();
    expect(facade.DailyReview.save).not.toHaveBeenCalled();
  });

  it('should keep the typed Marks and show the failure when the save fails', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockRejectedValue(new Error('storage'));
    renderReview(facade);
    const user = userEvent.setup();
    const step = await marksPanel();
    await user.type(inputOf(step, 'XYZ', MONDAY_LABEL), '52.00');
    await user.type(inputOf(step, 'DEF', MONDAY_LABEL), '33.10');

    await user.click(within(step).getByRole('button', { name: 'Save Marks (2)' }));

    expect(await within(step).findByText('These Marks could not be saved.')).toBeTruthy();
    expect(inputOf(step, 'XYZ', MONDAY_LABEL).value).toBe('52.00');
    expect(inputOf(step, 'DEF', MONDAY_LABEL).value).toBe('33.10');
    expect(within(step).getByRole('button', { name: 'Save Marks (2)' })).toBeTruthy();
    // Nothing folded.
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('should put the cards in the returned Review order, once', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([savedKey('XYZ', MONDAY, '52.00')], readyReview({ trades: [TC, TA, TF] })));
    renderReview(facade);
    const user = userEvent.setup();
    const step = await marksPanel();
    expect(order()).toEqual(['t-a', 't-f', 't-c']);
    await user.type(inputOf(step, 'XYZ', MONDAY_LABEL), '52.00');
    await user.click(within(step).getByRole('button', { name: 'Save Marks (1)' }));
    await waitFor(() => expect(order()).toEqual(['t-c', 't-a', 't-f']));

    // Later typing sorts nothing again: the order stays until the next save.
    await user.type(inputOf(step, 'DEF', MONDAY_LABEL), '33.10');
    expect(order()).toEqual(['t-c', 't-a', 't-f']);
  });
});

describe('Save Marks while a cell is being fixed (T95.14-B2)', () => {
  it('should keep a Correct in progress when Save Marks finishes the day', async () => {
    const paged = pagedReview();
    const marks = paged.families[0] as MarksFamily;
    const facade = cardFacade(review({ families: [{ ...marks, today: [...marks.today, markRowOf('ABC', ACK, 2)] }, paged.families[1]!] }));
    vi.mocked(facade.DailyReview.save).mockResolvedValue(marksSavedResult([savedKey('XYZ', MONDAY, '52.00')]));
    renderReview(facade);
    const user = userEvent.setup();
    const panel = await marksPanelWithEarlier();
    await user.type(inputOf(panel, 'XYZ', MONDAY_LABEL), '52.00');
    const friday = await choose(user, panel, 'XYZ', FRIDAY_LABEL);
    await user.click(within(friday).getByRole('button', { name: 'Correct' }));
    await user.type(within(friday).getByLabelText('Price'), '51.5');

    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));

    // The Marks are saved, yet the grid stays open with the correction as typed.
    await waitFor(() => expect(facade.DailyReview.save).toHaveBeenCalledTimes(1));
    expect(within(panel).getByLabelText<HTMLInputElement>('Price').value).toBe('51.5');
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  describe('a saved Mark emptied to be retyped', () => {
    // XYZ was saved earlier in this Review and DEF now, then the grid opened again with Edit: each is an input holding its price.
    async function editing(facade: UiFacade) {
      const xyzSaved = { ...missingRow('XYZ', ['t-a', 't-f']), resolution: available('52'), resolutionRevision: 1, task: null };
      vi.mocked(facade.DailyReview.open).mockResolvedValue(gridReview({ today: [xyzSaved, missingRow('DEF', ['t-c'])] }));
      vi.mocked(facade.DailyReview.save).mockResolvedValueOnce(marksSavedResult([savedKey('DEF', MONDAY, '33.10')]));
      renderReview(facade);
      const user = userEvent.setup();
      const step = await marksPanel();
      await user.type(inputOf(step, 'DEF', MONDAY_LABEL), '33.10');
      await user.click(within(step).getByRole('button', { name: 'Save Marks (1)' }));
      await user.click(await screen.findByRole('button', { name: 'Edit' }));
      return { user, step: await marksPanel() };
    }

    it('should stay empty when a save that was pending finishes', async () => {
      const facade = cardFacade();
      const { user, step } = await editing(facade);
      let finish: (result: SaveResult) => void = () => undefined;
      vi.mocked(facade.DailyReview.save).mockReturnValue(new Promise<SaveResult>((resolve) => (finish = resolve)));
      await user.clear(inputOf(step, 'DEF', MONDAY_LABEL));
      await user.type(inputOf(step, 'DEF', MONDAY_LABEL), '33.50');
      await user.click(within(step).getByRole('button', { name: 'Save Marks (1)' }));
      // The request is out: the trader empties the other saved Mark's input meanwhile.
      await user.clear(inputOf(step, 'XYZ', MONDAY_LABEL));

      act(() => finish(marksSavedResult([{ ...savedKey('DEF', MONDAY, '33.50'), classification: 'Correction' }])));
      await waitFor(() => expect(within(step).getByRole('button', { name: 'Save Marks (0)' })).toBeTruthy());

      expect(inputOf(step, 'XYZ', MONDAY_LABEL).value).toBe('');
    });

    it('should show the saved price again when its input is left empty', async () => {
      const { user, step } = await editing(cardFacade());
      const xyz = inputOf(step, 'XYZ', MONDAY_LABEL);
      expect(xyz.value).toBe('52.00');

      await user.clear(xyz);
      expect(xyz.value).toBe('');
      await user.tab();

      expect(xyz.value).toBe('52.00');
      expect(within(step).getByRole('button', { name: 'Save Marks (0)' })).toBeTruthy();
    });
  });
});

describe('the grids keys (T95.15)', () => {
  const keysReview = () => cardFacade(gridReview({ earlierMarks: [xyzMarks({ [FRIDAY]: markAt('45.10') })] }));
  const price = (step: HTMLElement, symbol: string) => inputOf(step, symbol, 'Mon Oct 12');

  it('should move to the next input on Enter, and to Save Marks after the last', async () => {
    renderReview(keysReview());
    const user = userEvent.setup();
    const step = await marksPanel();

    await user.type(price(step, 'XYZ'), '45.50{Enter}');
    expect(document.activeElement).toBe(price(step, 'DEF'));
    await user.type(price(step, 'DEF'), '30.00{Enter}');
    expect(document.activeElement).toBe(within(step).getByRole('button', { name: 'Save Marks (2)' }));
  });

  it('should move up and down the column with the arrow keys', async () => {
    renderReview(keysReview());
    const user = userEvent.setup();
    const step = await marksPanel();

    await user.type(price(step, 'XYZ'), '45.50');
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(price(step, 'DEF'));
    await user.keyboard('{ArrowDown}');
    // Past the last price the key does nothing: it stays.
    expect(document.activeElement).toBe(price(step, 'DEF'));
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(price(step, 'XYZ'));
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(price(step, 'XYZ'));
  });

  it('should mark Cant get a price on N in an empty input, and type no letter', async () => {
    renderReview(keysReview());
    const user = userEvent.setup();
    const step = await marksPanel();

    await user.click(price(step, 'XYZ'));
    await user.keyboard('N');
    // The reason is asked in the row, as the button asks it, and the letter is not typed.
    expect(price(step, 'XYZ').value).toBe('');
    const why = within(step).getByRole('textbox', { name: 'Why no price, XYZ' });
    expect(document.activeElement).toBe(why);
    expect((why as HTMLInputElement).value).toBe('');
    // A price being typed keeps its letters: N in a filled input is not the key.
    await user.type(price(step, 'DEF'), '4n');
    expect(price(step, 'DEF').value).toBe('4n');
    expect(within(step).queryByRole('textbox', { name: 'Why no price, DEF' })).toBeNull();
  });

  it('should hold Enter at an open slip question until it is answered', async () => {
    renderReview(keysReview());
    const user = userEvent.setup();
    const step = await marksPanel();

    await user.type(price(step, 'XYZ'), '49.00{Enter}');
    // The price reads as a slip: Enter asks and stays, and goes nowhere while the question stands.
    expect(within(step).getByText('+8.6% from $45.10. Right?')).toBeTruthy();
    expect(document.activeElement).toBe(price(step, 'XYZ'));
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(price(step, 'XYZ'));
    // Once answered, the price goes on as Enter does.
    await user.click(within(step).getByRole('button', { name: 'Yes, $49.00' }));
    expect(document.activeElement).toBe(price(step, 'DEF'));
    await user.type(price(step, 'XYZ'), '{Enter}');
    expect(document.activeElement).toBe(price(step, 'DEF'));
  });

  it('should show the key hint under the grid', async () => {
    renderReview(keysReview());
    const step = await marksPanel();

    expect(within(step).getByText('Enter next, then Save · ↑ ↓ move · N no price')).toBeTruthy();
  });
});
