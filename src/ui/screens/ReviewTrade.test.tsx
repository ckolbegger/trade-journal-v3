// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { DailyTradeReview, OpenDailyReviewResult, ReviewBinding, ReviewTradeItem, SaveDailyReviewResult } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ReviewView } from './ReviewView.tsx';

afterEach(cleanup);

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;
type Evaluation = NonNullable<DailyTradeReview['evaluation']>;

const binding: ReviewBinding = {
  workspace: { databaseName: 'tj-ws-1', contentRevision: 3 },
  catalogRevision: 1,
  journalRevision: 1,
  marketDataSnapshotId: 'mds1:1:abc',
  factRevisions: { t1: 2 },
};
const item = (tradeId: string, underlying: string, over: Partial<ReviewTradeItem> = {}): ReviewTradeItem => ({
  tradeId,
  underlying,
  lastActivity: '2026-10-12T14:00:00Z',
  band: 'Routine',
  reasons: [{ code: 'NoPressure' }],
  basis: { kind: 'Comparable', side: 'None', share: Rational.of(0n, 1n) },
  ...over,
});
function ready(trades: readonly ReviewTradeItem[], missing: readonly string[] = trades.map((t) => t.tradeId), over: Partial<Ready> = {}): Ready {
  return {
    kind: 'Ready',
    reviewDate: '2026-10-12',
    cutoff: '2026-10-12T20:00:00Z',
    families: [
      { family: 'Marks', today: [], earlier: [] },
      { family: 'Trades', trades },
    ],
    completion: missing.length > 0 ? { kind: 'Incomplete', reasons: missing.map((tradeId) => ({ code: 'ActionMissing' as const, tradeId })) } : { kind: 'Complete' },
    binding,
    ...over,
  };
}

const value = (n: bigint, d = 1n) => ({ kind: 'Value' as const, value: Rational.of(n, d) });
const symbol = { kind: 'Stock' as const, symbol: 'XYZ' };
// The figures the Review reads; every other evaluation field is out of this screen's sight.
function evaluation(over: Record<string, unknown> = {}): Evaluation {
  return {
    kind: 'Evaluated',
    valuationDate: '2026-10-12',
    coverage: { kind: 'Available', revisionId: 'r1', revisionNumber: 1 },
    observation: { instrument: symbol, tradingDate: '2026-10-12', mark: { revisionId: 'r1', revisionNumber: 1, price: '52.00' } },
    currentMarkedPnl: value(582n),
    currentMarkedPnlInPlanR: value(582n, 250n),
    ongoingRiskToStop: value(400n),
    incrementalRewardToTarget: value(1200n),
    atEntry: null,
    ...over,
  } as unknown as Evaluation;
}
const savedBinding = (over: Partial<DailyTradeReview['saveBinding']> = {}): DailyTradeReview['saveBinding'] => ({
  reviewDate: '2026-10-12',
  tradeId: 't1',
  factRevision: 2,
  marketDataSnapshotId: 'mds1:1:abc',
  obligationKey: { entryType: 'DailyTradeReview', trade: 't1', reviewDate: '2026-10-12' },
  definitionRevision: 'def1',
  databaseName: 'tj-ws-1',
  ...over,
});
function tradeReview(tradeId: string, underlying: string, over: Partial<DailyTradeReview> = {}): DailyTradeReview {
  return {
    tradeId,
    underlying,
    attention: item(tradeId, underlying),
    labels: { strategy: 'Long Stock', account: 'Main', institution: 'Broker' },
    evaluation: evaluation(),
    form: { kind: 'New', viewState: { selectedAction: 'Hold' } },
    definitionRevision: 'def1',
    saveBinding: savedBinding({ tradeId, obligationKey: { entryType: 'DailyTradeReview', trade: tradeId, reviewDate: '2026-10-12' } }),
    ...over,
  };
}

function renderWalk(facade: UiFacade, options: { writable?: boolean; onDirtyChange?: (dirty: boolean) => void; report?: (result: { kind: string }) => void } = {}) {
  render(
    <RuntimeContext.Provider value={{ writable: options.writable ?? true, report: options.report ?? (() => undefined) }}>
      <MemoryRouter initialEntries={['/review']}>
        <ReviewView facade={facade} now={() => '2026-10-12T21:00:00Z'} onDirtyChange={options.onDirtyChange ?? (() => undefined)} />
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}
function walkFacade(review: Ready, ...trades: DailyTradeReview[]): UiFacade {
  const facade = facadeDouble();
  vi.mocked(facade.DailyReview.open).mockResolvedValue(review);
  const getTrade = vi.mocked(facade.DailyReview.getTrade);
  for (const trade of trades) getTrade.mockResolvedValueOnce({ kind: 'Ready', reviewDate: '2026-10-12', cutoff: review.cutoff, trade });
  return facade;
}
// Opens the walk and the named Trade.
async function openTrade(user: ReturnType<typeof userEvent.setup>, underlying: string) {
  await user.click(await screen.findByRole('button', { name: 'Continue to Trades' }));
  await user.click(await screen.findByRole('button', { name: `Review ${underlying}` }));
  return screen.findByRole('region', { name: `${underlying} review` });
}

describe('Trade in the walk', () => {
  it('should show the Trade figures for the Review Date, the dated and at-entry lines when present, and its attention reasons', async () => {
    const attention = item('t1', 'XYZ', { band: 'QuantifiedPressure', reasons: [{ code: 'PressureTowardTarget' }], basis: { kind: 'Comparable', side: 'Winning', share: Rational.of(91n, 291n), atEntry: Rational.of(1000n), now: Rational.of(700n) } });
    const facade = walkFacade(ready([attention]), tradeReview('t1', 'XYZ', { attention }));
    renderWalk(facade);
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenCalledExactlyOnceWith({ reviewDate: '2026-10-12', tradeId: 't1', binding });
    expect(within(trade).getByText('Mark $52.00 for XYZ, Mon Oct 12')).toBeTruthy();
    const figure = (term: string) => within(trade).getByText(term).nextElementSibling?.textContent;
    expect(figure('Current Marked Trade P&L')).toBe('+$582.00 · +2.33R');
    expect(figure('Ongoing Risk to Stop')).toBe('$400.00');
    expect(figure('Incremental Reward to Target')).toBe('$1,200.00');
    expect(within(trade).getByText('31% of the way from entry to the Target')).toBeTruthy();
    expect(within(trade).queryByRole('group', { name: /close/ })).toBeNull();
    expect(within(trade).queryByRole('group', { name: 'At entry' })).toBeNull();
    cleanup();

    // The Review Date Mark is missing: no number stands in for it, the dated close and the at-entry lots are their own lines.
    const unavailable = { kind: 'Unavailable' as const, reason: 'MarkMissing', detail: { instrument: symbol, date: '2026-10-12' } };
    const limited = item('t1', 'XYZ', { band: 'EvidenceLimited', reasons: [{ code: 'MarkMissing', instrumentKey: 'XYZ', date: '2026-10-12' }], basis: { kind: 'NotComparable', reason: 'MissingInput', instrumentKey: 'XYZ', date: '2026-10-12' } });
    const missing = tradeReview('t1', 'XYZ', {
      attention: limited,
      evaluation: evaluation({
        coverage: { kind: 'Missing' },
        observation: { instrument: symbol, tradingDate: '2026-10-12', mark: null },
        currentMarkedPnl: unavailable,
        currentMarkedPnlInPlanR: unavailable,
        ongoingRiskToStop: unavailable,
        incrementalRewardToTarget: unavailable,
        atEntry: { label: 'AtEntry', quantity: Rational.of(20n), averageEntry: Rational.of(60n), riskFromEntry: Rational.of(60n), rewardFromEntry: Rational.of(200n) },
      }),
      datedLastClose: { tradingDate: '2026-10-09', evaluation: evaluation({ currentMarkedPnl: value(-50n), currentMarkedPnlInPlanR: value(-1n, 5n), ongoingRiskToStop: value(300n), incrementalRewardToTarget: value(900n) }) },
    });
    const again = walkFacade(ready([limited]), missing);
    renderWalk(again);
    const second = await openTrade(user, 'XYZ');
    expect(figure2(second, 'Current Marked Trade P&L')).toBe('Mark missing: XYZ, Mon Oct 12');
    expect(figure2(second, 'Ongoing Risk to Stop')).toBe('Mark missing: XYZ, Mon Oct 12');
    expect(within(second).queryByText('Mark $52.00 for XYZ, Mon Oct 12')).toBeNull();
    const dated = within(second).getByRole('group', { name: 'Fri Oct 9 close' });
    expect(figure2(dated, 'Current Marked Trade P&L')).toBe('−$50.00 · −0.20R');
    expect(figure2(dated, 'Ongoing Risk to Stop')).toBe('$300.00');
    const atEntry = within(second).getByRole('group', { name: 'At entry' });
    expect(figure2(atEntry, 'Risk to stop')).toBe('$60.00');
    expect(figure2(atEntry, 'Reward to target')).toBe('$200.00');
    expect(within(second).getByText('Mark missing for XYZ on Mon Oct 12')).toBeTruthy();
  });
});

function figure2(scope: HTMLElement, term: string) {
  return within(scope).getAllByText(term)[0]?.nextElementSibling?.textContent;
}

describe('Action form (AC-REV-003)', () => {
  it('should render Action as a radio group in a labelled fieldset with Hold selected, and one visible Save', async () => {
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ'));
    renderWalk(facade);
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    const group = within(trade).getByRole('group', { name: 'Action' });
    expect(group.tagName).toBe('FIELDSET');
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => (r as HTMLInputElement).labels?.[0]?.textContent)).toEqual(['Hold', 'Exit', 'Roll', 'Adjust']);
    expect(within(group).getByRole('radio', { name: 'Hold' })).toHaveProperty('checked', true);
    expect(within(trade).getAllByRole('button', { name: /Save/ }).map((b) => b.textContent)).toEqual(['Save']);
    // Opening it records nothing.
    expect(vi.mocked(facade.DailyReview.save)).not.toHaveBeenCalled();
  });

  it('should save Hold with one press of Save and move to the next Trade from the returned next step without calling open or getTrade', async () => {
    const trades = [item('t1', 'XYZ'), item('t2', 'DEF')];
    const first = tradeReview('t1', 'XYZ');
    const next = tradeReview('t2', 'DEF', { evaluation: evaluation({ ongoingRiskToStop: value(150n) }) });
    const facade = walkFacade(ready(trades), first);
    const nextBinding: ReviewBinding = { ...binding, journalRevision: 2 };
    vi.mocked(facade.DailyReview.save).mockResolvedValue({
      kind: 'Saved',
      action: savedAction('Hold'),
      review: { kind: 'Ready', progress: { tradesWithAction: 1, tradesEligible: 2 }, completion: { kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: 't2' }] }, nextStep: { kind: 'Trade', trade: next }, binding: nextBinding },
    });
    renderWalk(facade);
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    const opens = vi.mocked(facade.DailyReview.open).mock.calls.length;
    await user.click(within(trade).getByRole('button', { name: 'Save' }));

    // One call, carrying the exact binding getTrade returned and no Intent.
    expect(vi.mocked(facade.DailyReview.save)).toHaveBeenCalledExactlyOnceWith({ kind: 'SaveTradeAction', binding: first.saveBinding, action: 'Hold' });
    const following = await screen.findByRole('region', { name: 'DEF review' });
    expect(within(following).getByText('$150.00')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
    expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledTimes(opens);
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenCalledTimes(1);
    // The walk's rows follow the returned completion.
    const rows = within(screen.getByRole('region', { name: 'Trades' })).getAllByRole('listitem');
    expect(rows.map((row) => within(row).getByText(/^Action (saved|missing)$/).textContent)).toEqual(['Action saved', 'Action missing']);
  });
});

describe('Action form (AC-REV-003)', () => {
  it('should require Intent when Exit, Roll, or Adjust is selected, showing the issue beside the field', async () => {
    const first = tradeReview('t1', 'XYZ');
    const facade = walkFacade(ready([item('t1', 'XYZ')]), first);
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: savedAction('Roll', 'Move to Nov.'), review: { kind: 'Ready', progress: { tradesWithAction: 1, tradesEligible: 1 }, completion: { kind: 'Complete' }, nextStep: { kind: 'Done' }, binding } });
    renderWalk(facade);
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    const intent = within(trade).getByRole('textbox', { name: /Intent/ });
    expect(intent.parentElement?.textContent).toContain('Intent (optional)');
    for (const choice of ['Exit', 'Roll', 'Adjust']) {
      await user.click(within(trade).getByRole('radio', { name: choice }));
      expect(within(trade).getByRole('textbox', { name: /Intent/ }).parentElement?.textContent).toContain('Intent (required)');
      await user.click(within(trade).getByRole('button', { name: 'Save' }));
      const message = within(trade).getByText('Enter your Intent for this Action.');
      expect(within(trade).getByRole('textbox', { name: /Intent/ }).getAttribute('aria-describedby')).toBe(message.id);
      expect(document.activeElement).toBe(within(trade).getByRole('textbox', { name: /Intent/ }));
      // Blank is not Intent.
      await user.type(within(trade).getByRole('textbox', { name: /Intent/ }), '   ');
      await user.click(within(trade).getByRole('button', { name: 'Save' }));
      expect(vi.mocked(facade.DailyReview.save)).not.toHaveBeenCalled();
      await user.clear(within(trade).getByRole('textbox', { name: /Intent/ }));
    }

    await user.type(within(trade).getByRole('textbox', { name: /Intent/ }), ' Move to Nov. ');
    await user.click(within(trade).getByRole('button', { name: 'Save' }));
    expect(vi.mocked(facade.DailyReview.save)).toHaveBeenCalledExactlyOnceWith({ kind: 'SaveTradeAction', binding: first.saveBinding, action: 'Adjust', intent: 'Move to Nov.' });
  });
});

describe('Saved Action', () => {
  it('should show a saved Action with its values and allow changing it, submitting the expected Entry revision', async () => {
    const saved = savedAction('Exit', 'Because the plan changed.', 2);
    const first = tradeReview('t1', 'XYZ', { form: { kind: 'Saved', action: saved }, saveBinding: savedBinding({ expectedEntryRevision: 2 }) });
    const facade = walkFacade(ready([item('t1', 'XYZ')], []), first);
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: savedAction('Roll', 'Roll to November.', 3), review: { kind: 'Ready', progress: { tradesWithAction: 1, tradesEligible: 1 }, completion: { kind: 'Complete' }, nextStep: { kind: 'Done' }, binding } });
    renderWalk(facade);
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    // The saved values, and no form until the trader chooses to change them.
    expect(within(trade).getByText('Saved Action: Exit')).toBeTruthy();
    expect(within(trade).getByText('Intent: Because the plan changed.')).toBeTruthy();
    expect(within(trade).queryByRole('button', { name: 'Save' })).toBeNull();
    await user.click(within(trade).getByRole('button', { name: 'Change' }));
    expect(within(trade).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', true);
    expect(within(trade).getByRole('textbox', { name: /Intent/ })).toHaveProperty('value', 'Because the plan changed.');
    await user.click(within(trade).getByRole('radio', { name: 'Roll' }));
    await user.clear(within(trade).getByRole('textbox', { name: /Intent/ }));
    await user.type(within(trade).getByRole('textbox', { name: /Intent/ }), 'Roll to November.');
    await user.click(within(trade).getByRole('button', { name: 'Save' }));

    expect(vi.mocked(facade.DailyReview.save)).toHaveBeenCalledExactlyOnceWith({ kind: 'SaveTradeAction', binding: { ...first.saveBinding, expectedEntryRevision: 2 }, action: 'Roll', intent: 'Roll to November.' });
  });
});

describe('Changed review', () => {
  it('should show ReviewChanged with the entered values kept and offer Refresh', async () => {
    const first = tradeReview('t1', 'XYZ');
    const refreshedBinding: ReviewBinding = { ...binding, marketDataSnapshotId: 'mds1:2:def', factRevisions: { t1: 3 } };
    const refreshed = tradeReview('t1', 'XYZ', { evaluation: evaluation({ ongoingRiskToStop: value(350n) }), saveBinding: savedBinding({ factRevision: 3, marketDataSnapshotId: 'mds1:2:def' }) });
    const facade = walkFacade(ready([item('t1', 'XYZ')]), first, refreshed);
    vi.mocked(facade.DailyReview.open).mockResolvedValueOnce(ready([item('t1', 'XYZ')])).mockResolvedValueOnce(ready([item('t1', 'XYZ')])).mockResolvedValue(ready([item('t1', 'XYZ')], undefined, { binding: refreshedBinding }));
    vi.mocked(facade.DailyReview.save)
      .mockResolvedValueOnce({ kind: 'ReviewChanged', evidence: { marketDataSnapshotId: 'mds1:2:def', frames: [], factRevision: 3 } })
      .mockResolvedValue({ kind: 'Saved', action: savedAction('Exit', 'Stopped out.'), review: { kind: 'Ready', progress: { tradesWithAction: 1, tradesEligible: 1 }, completion: { kind: 'Complete' }, nextStep: { kind: 'Done' }, binding: refreshedBinding } });
    renderWalk(facade);
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenLastCalledWith({ reviewDate: '2026-10-12', tradeId: 't1', binding });
    await user.click(within(trade).getByRole('radio', { name: 'Exit' }));
    await user.type(within(trade).getByRole('textbox', { name: /Intent/ }), 'Stopped out.');
    await user.click(within(trade).getByRole('button', { name: 'Save' }));

    const alert = await within(trade).findByRole('alert');
    expect(alert.textContent).toContain('The Review changed after you opened this Trade. Nothing was saved.');
    expect(alert.textContent).toContain('Your values are kept');
    expect(document.activeElement).toBe(alert);
    expect(within(trade).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', true);
    expect(within(trade).getByRole('textbox', { name: /Intent/ })).toHaveProperty('value', 'Stopped out.');

    await user.click(within(alert).getByRole('button', { name: 'Refresh' }));
    // The Review is asked for again and the Trade is read under the new binding; the entered values stay.
    expect(await within(await screen.findByRole('region', { name: 'XYZ review' })).findByText('$350.00')).toBeTruthy();
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenLastCalledWith({ reviewDate: '2026-10-12', tradeId: 't1', binding: refreshedBinding });
    const again = screen.getByRole('region', { name: 'XYZ review' });
    expect(within(again).queryByRole('alert')).toBeNull();
    expect(within(again).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', true);
    expect(within(again).getByRole('textbox', { name: /Intent/ })).toHaveProperty('value', 'Stopped out.');
    await user.click(within(again).getByRole('button', { name: 'Save' }));
    expect(vi.mocked(facade.DailyReview.save)).toHaveBeenLastCalledWith({ kind: 'SaveTradeAction', binding: refreshed.saveBinding, action: 'Exit', intent: 'Stopped out.' });
  });
});

describe('Leaving the form', () => {
  it('should make no call when the trader leaves, and register as unsaved only after a value differs from the returned state', async () => {
    const first = tradeReview('t1', 'XYZ');
    const facade = walkFacade(ready([item('t1', 'XYZ')]), first);
    const onDirtyChange = vi.fn();
    renderWalk(facade, { onDirtyChange });
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    // Hold preselected is the returned state: nothing is unsaved.
    expect(onDirtyChange).not.toHaveBeenCalledWith(true);
    await user.click(within(trade).getByRole('radio', { name: 'Exit' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.click(within(trade).getByRole('radio', { name: 'Hold' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await user.type(within(trade).getByRole('textbox', { name: /Intent/ }), 'Watching.');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.clear(within(trade).getByRole('textbox', { name: /Intent/ }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await user.click(within(trade).getByRole('radio', { name: 'Roll' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    // Leaving abandons the values: nothing is saved, nothing is read, nothing is stored, and the page is no longer unsaved.
    const opens = vi.mocked(facade.DailyReview.open).mock.calls.length;
    cleanup();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(vi.mocked(facade.DailyReview.save)).not.toHaveBeenCalled();
    expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledTimes(opens);
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenCalledTimes(1);
  });
});

describe('Leaving an unsaved Action', () => {
  it('should hold Continue to Trades and the other Reviews while the open Action form holds an unsaved value, and say why', async () => {
    const facade = walkFacade(ready([item('t1', 'XYZ'), item('t2', 'DEF')]), tradeReview('t1', 'XYZ'));
    renderWalk(facade);
    const user = userEvent.setup();
    const trade = await openTrade(user, 'XYZ');
    const opens = vi.mocked(facade.DailyReview.open).mock.calls.length;
    const reasonText = /Save your Action or put back its saved values to leave this Trade/;

    expect(screen.queryByText(reasonText)).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Continue to Trades' }).disabled).toBe(false);

    await user.click(within(trade).getByRole('radio', { name: 'Exit' }));
    const proceed = screen.getByRole<HTMLButtonElement>('button', { name: 'Continue to Trades' });
    const other = screen.getByRole<HTMLButtonElement>('button', { name: 'Review DEF' });
    expect(proceed.disabled).toBe(true);
    expect(other.disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Review XYZ' }).disabled).toBe(true);
    expect(screen.getByText(reasonText)).toBeTruthy();
    expect(proceed.getAttribute('aria-describedby')).toBe(other.getAttribute('aria-describedby'));
    expect(proceed.getAttribute('aria-describedby')).toBe(screen.getByText(reasonText).id);
    await user.click(proceed);
    await user.click(other);
    expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledTimes(opens);
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: 'XYZ review' })).toBeTruthy();

    await user.click(within(trade).getByRole('radio', { name: 'Hold' }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Continue to Trades' }).disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Review DEF' }).disabled).toBe(false);
    expect(screen.queryByText(reasonText)).toBeNull();
  });
});

describe('Action form extras', () => {
  it('should offer no Save while the runtime is not writable, and still show a saved Action', async () => {
    const saved = tradeReview('t2', 'DEF', { form: { kind: 'Saved', action: savedAction('Hold') } });
    const facade = walkFacade(ready([item('t1', 'XYZ'), item('t2', 'DEF')]), tradeReview('t1', 'XYZ'), saved);
    renderWalk(facade, { writable: false });
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    expect(within(trade).queryByRole('button', { name: 'Save' })).toBeNull();
    expect(within(trade).queryByRole('radio')).toBeNull();
    expect(within(trade).getByText('No Action saved.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Review DEF' }));
    const other = await screen.findByRole('region', { name: 'DEF review' });
    expect(within(other).getByText('Saved Action: Hold')).toBeTruthy();
    expect(within(other).queryByRole('button', { name: 'Change' })).toBeNull();
  });
});

describe('Action save failures', () => {
  it('should keep the entered values and say nothing was saved on Conflict, storage failure, rejection, or a refused write', async () => {
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ'));
    const save = vi.mocked(facade.DailyReview.save);
    const report = vi.fn();
    renderWalk(facade, { report });
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    await user.click(within(trade).getByRole('radio', { name: 'Exit' }));
    await user.type(within(trade).getByRole('textbox', { name: /Intent/ }), 'Plan changed.');
    const press = () => user.click(within(trade).getByRole('button', { name: 'Save' }));
    const kept = () => {
      expect(within(trade).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', true);
      expect(within(trade).getByRole('textbox', { name: /Intent/ })).toHaveProperty('value', 'Plan changed.');
    };

    save.mockResolvedValueOnce({ kind: 'Conflict' });
    await press();
    expect((await within(trade).findByRole('alert')).textContent).toContain('This Action changed after you opened it. Nothing was saved.');
    expect(within(trade).getByRole('button', { name: 'Refresh' })).toBeTruthy();
    kept();

    save.mockResolvedValueOnce({ kind: 'StorageFailure', reason: 'QuotaExceededError' });
    await press();
    await within(trade).findByText(/could not be saved/);
    expect(within(trade).getByRole('alert').textContent).toContain('Nothing was saved. Your values are kept, so you can try again.');
    expect(within(trade).queryByRole('button', { name: 'Refresh' })).toBeNull();
    kept();

    save.mockResolvedValueOnce({ kind: 'Rejected', issues: [{ code: 'RequiredAnswerMissing', promptId: 'prompt.daily-trade-review.intent' }] });
    await press();
    expect(await within(trade).findByText('Enter your Intent for this Action.')).toBeTruthy();
    expect(within(trade).queryByRole('alert')).toBeNull();
    kept();

    // Any other rejection is about the Action as a whole, not the Intent.
    save.mockResolvedValueOnce({ kind: 'Rejected', issues: [{ code: 'DefinitionRevisionMismatch' }] });
    await press();
    expect(await within(trade).findByText('This Action could not be saved. Reopen the Trade and try again.')).toBeTruthy();
    expect(within(trade).queryByText('Enter your Intent for this Action.')).toBeNull();
    kept();

    const refused = { kind: 'RuntimeNotWritable', runtimeReadiness: 'RecoveryOnly', failedChecks: [], workspaceStatus: 'RecoveryOnly', safeActions: [] } as const;
    save.mockResolvedValueOnce(refused);
    await press();
    await vi.waitFor(() => expect(report).toHaveBeenCalledWith(refused));
    kept();
  });
});

describe('After a save', () => {
  it('should start the next Trade form afresh, and say what follows when no Trade is next', async () => {
    const user = userEvent.setup();
    const trades = [item('t1', 'XYZ'), item('t2', 'DEF')];
    const post = (nextStep: Extract<NonNullable<Extract<SaveDailyReviewResult, { kind: 'Saved' }>['review']>, { kind: 'Ready' }>['nextStep']) =>
      ({ kind: 'Ready', progress: { tradesWithAction: 1, tradesEligible: 2 }, completion: { kind: 'Complete' }, nextStep, binding }) as const;

    const facade = walkFacade(ready(trades), tradeReview('t1', 'XYZ'));
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: savedAction('Exit', 'Done.'), review: post({ kind: 'Trade', trade: tradeReview('t2', 'DEF') }) });
    renderWalk(facade);
    const first = await openTrade(user, 'XYZ');
    await user.click(within(first).getByRole('radio', { name: 'Exit' }));
    await user.type(within(first).getByRole('textbox', { name: /Intent/ }), 'Done.');
    await user.click(within(first).getByRole('button', { name: 'Save' }));
    const next = await screen.findByRole('region', { name: 'DEF review' });
    expect(within(next).getByRole('radio', { name: 'Hold' })).toHaveProperty('checked', true);
    expect(within(next).getByRole('textbox', { name: /Intent/ })).toHaveProperty('value', '');
    cleanup();

    const outcomes = [
      { nextStep: post({ kind: 'Done' }), text: 'Every Trade has an Action.' },
      { nextStep: post({ kind: 'Mark', row: { instrumentKey: 'XYZ', tradingDate: '2026-10-12', trades: ['t1'], resolution: { kind: 'Missing' }, resolutionRevision: 'None', task: 'Manual' } }), text: 'A Mark is needed before the next Trade. It is listed under Marks.' },
      { nextStep: { kind: 'ChangedDuringAssembly' } as const, text: 'The Action is saved. Continue to Trades to refresh the Review.' },
    ] as const;
    for (const { nextStep, text } of outcomes) {
      const again = walkFacade(ready(trades), tradeReview('t1', 'XYZ'));
      vi.mocked(again.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: savedAction('Hold'), review: nextStep });
      renderWalk(again);
      const trade = await openTrade(user, 'XYZ');
      await user.click(within(trade).getByRole('button', { name: 'Save' }));
      expect((await screen.findByRole('status')).textContent).toBe(text);
      expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
      cleanup();
    }
  });
});

// A result held until the test releases it.
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('Action form while saving', () => {
  it('should disable the Action choices and Intent while a save is in flight', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ'));
    const held = deferred<SaveDailyReviewResult>();
    vi.mocked(facade.DailyReview.save).mockReturnValue(held.promise);
    renderWalk(facade);
    const trade = await openTrade(user, 'XYZ');
    await user.click(within(trade).getByRole('radio', { name: 'Exit' }));
    await user.type(within(trade).getByRole('textbox', { name: /Intent/ }), 'Plan changed.');
    await user.click(within(trade).getByRole('button', { name: 'Save' }));

    for (const radio of within(trade).getAllByRole('radio')) expect(radio).toHaveProperty('disabled', true);
    expect(within(trade).getByRole('textbox', { name: /Intent/ })).toHaveProperty('disabled', true);

    held.resolve({ kind: 'Conflict' });
    await within(trade).findByRole('alert');
    for (const radio of within(trade).getAllByRole('radio')) expect(radio).toHaveProperty('disabled', false);
    const intent = within(trade).getByRole('textbox', { name: /Intent/ });
    expect(intent).toHaveProperty('disabled', false);
    expect(intent).toHaveProperty('value', 'Plan changed.');
  });
});

describe('Results for a Trade no longer open', () => {
  const post = (nextStep: Extract<NonNullable<Extract<SaveDailyReviewResult, { kind: 'Saved' }>['review']>, { kind: 'Ready' }>['nextStep']) =>
    ({ kind: 'Ready', progress: { tradesWithAction: 1, tradesEligible: 3 }, completion: { kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: 't2' }, { code: 'ActionMissing', tradeId: 't3' }] }, nextStep, binding }) as const;
  const trades = [item('t1', 'XYZ'), item('t2', 'DEF'), item('t3', 'GHI')];
  const ready1 = (trade: DailyTradeReview) => ({ kind: 'Ready' as const, reviewDate: '2026-10-12', cutoff: ready(trades).cutoff, trade });

  it('should keep the open Trade and its entered values when a save for another Trade settles late', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready(trades), tradeReview('t1', 'XYZ'), tradeReview('t2', 'DEF'));
    const held = deferred<SaveDailyReviewResult>();
    vi.mocked(facade.DailyReview.save).mockReturnValue(held.promise);
    renderWalk(facade);
    const first = await openTrade(user, 'XYZ');
    await user.click(within(first).getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Review DEF' }));
    const second = await screen.findByRole('region', { name: 'DEF review' });
    await user.click(within(second).getByRole('radio', { name: 'Exit' }));
    await user.type(within(second).getByRole('textbox', { name: /Intent/ }), 'Keep me.');

    held.resolve({ kind: 'Saved', action: savedAction('Hold'), review: post({ kind: 'Trade', trade: tradeReview('t3', 'GHI') }) });

    // The save's walk-level effect applies; the selection does not move.
    await vi.waitFor(() => {
      const rows = within(screen.getByRole('region', { name: 'Trades' })).getAllByRole('listitem');
      expect(rows.map((row) => within(row).getByText(/^Action (saved|missing)$/).textContent)).toEqual(['Action saved', 'Action missing', 'Action missing']);
    });
    const still = screen.getByRole('region', { name: 'DEF review' });
    expect(screen.queryByRole('region', { name: 'GHI review' })).toBeNull();
    expect(within(still).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', true);
    expect(within(still).getByRole('textbox', { name: /Intent/ })).toHaveProperty('value', 'Keep me.');
  });

  it('should show the last Trade asked for when two Trade reads settle out of order', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready(trades));
    const slow = deferred<ReturnType<typeof ready1>>();
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(((query: { tradeId: string }) => (query.tradeId === 't1' ? slow.promise : Promise.resolve(ready1(tradeReview('t2', 'DEF'))))));
    renderWalk(facade);
    await user.click(await screen.findByRole('button', { name: 'Continue to Trades' }));
    await user.click(await screen.findByRole('button', { name: 'Review XYZ' }));
    await user.click(screen.getByRole('button', { name: 'Review DEF' }));
    await screen.findByRole('region', { name: 'DEF review' });

    slow.resolve(ready1(tradeReview('t1', 'XYZ')));
    await new Promise((r) => setTimeout(r, 20));

    expect(screen.getByRole('region', { name: 'DEF review' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
  });

  it('should not bring back a Trade refreshed after the trader opened another', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready(trades), tradeReview('t1', 'XYZ'));
    const slow = deferred<ReturnType<typeof ready1>>();
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'ReviewChanged', evidence: { marketDataSnapshotId: 'mds1:2:def', frames: [], factRevision: 3 } });
    renderWalk(facade);
    const first = await openTrade(user, 'XYZ');
    await user.click(within(first).getByRole('button', { name: 'Save' }));
    const alert = await within(first).findByRole('alert');
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(((query: { tradeId: string }) => (query.tradeId === 't1' ? slow.promise : Promise.resolve(ready1(tradeReview('t2', 'DEF'))))));
    await user.click(within(alert).getByRole('button', { name: 'Refresh' }));
    await user.click(screen.getByRole('button', { name: 'Review DEF' }));
    await screen.findByRole('region', { name: 'DEF review' });

    slow.resolve(ready1(tradeReview('t1', 'XYZ')));
    await new Promise((r) => setTimeout(r, 20));

    expect(screen.getByRole('region', { name: 'DEF review' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
  });

  it('should not replace a Trade opened while a refresh waits for the Review', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready(trades), tradeReview('t1', 'XYZ'));
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'ReviewChanged', evidence: { marketDataSnapshotId: 'mds1:2:def', frames: [], factRevision: 3 } });
    renderWalk(facade);
    const first = await openTrade(user, 'XYZ');
    await user.click(within(first).getByRole('button', { name: 'Save' }));
    const alert = await within(first).findByRole('alert');
    const heldOpen = deferred<Ready>();
    vi.mocked(facade.DailyReview.open).mockReturnValueOnce(heldOpen.promise);
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(((query: { tradeId: string }) => Promise.resolve(ready1(query.tradeId === 't1' ? tradeReview('t1', 'XYZ') : tradeReview('t2', 'DEF')))));
    await user.click(within(alert).getByRole('button', { name: 'Refresh' }));
    await user.click(screen.getByRole('button', { name: 'Review DEF' }));
    await screen.findByRole('region', { name: 'DEF review' });

    heldOpen.resolve(ready(trades));
    await new Promise((r) => setTimeout(r, 20));

    expect(screen.getByRole('region', { name: 'DEF review' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
  });

  it('should keep the form opened again when a save for the earlier opening of the same Trade settles late', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready(trades));
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(((query: { tradeId: string }) => Promise.resolve(ready1(query.tradeId === 't1' ? tradeReview('t1', 'XYZ') : tradeReview('t2', 'DEF')))));
    const held = deferred<SaveDailyReviewResult>();
    vi.mocked(facade.DailyReview.save).mockReturnValue(held.promise);
    renderWalk(facade);
    const first = await openTrade(user, 'XYZ');
    await user.click(within(first).getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Review DEF' }));
    await screen.findByRole('region', { name: 'DEF review' });
    await user.click(screen.getByRole('button', { name: 'Review XYZ' }));
    const again = await screen.findByRole('region', { name: 'XYZ review' });
    await user.click(within(again).getByRole('radio', { name: 'Exit' }));
    await user.type(within(again).getByRole('textbox', { name: /Intent/ }), 'Keep me.');

    held.resolve({ kind: 'Saved', action: savedAction('Hold'), review: post({ kind: 'Trade', trade: tradeReview('t3', 'GHI') }) });

    await vi.waitFor(() => {
      const rows = within(screen.getByRole('region', { name: 'Trades' })).getAllByRole('listitem');
      expect(rows.map((row) => within(row).getByText(/^Action (saved|missing)$/).textContent)).toEqual(['Action saved', 'Action missing', 'Action missing']);
    });
    expect(screen.queryByRole('region', { name: 'GHI review' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'XYZ review' })).getByRole('textbox', { name: /Intent/ })).toHaveProperty('value', 'Keep me.');
  });

  it('should replace an open Trade with nothing when Continue to Trades refreshes the Review', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready(trades), tradeReview('t1', 'XYZ'));
    renderWalk(facade);
    await openTrade(user, 'XYZ');
    await user.click(screen.getByRole('button', { name: 'Continue to Trades' }));
    await vi.waitFor(() => expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
  });

  it('should drop the after-save message when Continue to Trades refreshes the Review', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready(trades), tradeReview('t1', 'XYZ'));
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: savedAction('Hold'), review: post({ kind: 'Done' }) });
    renderWalk(facade);
    const first = await openTrade(user, 'XYZ');
    await user.click(within(first).getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('status')).textContent).toBe('Every Trade has an Action.');
    await user.click(screen.getByRole('button', { name: 'Continue to Trades' }));
    await vi.waitFor(() => expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

function savedAction(action: string, intent?: string, entryRevision = 1): Extract<SaveDailyReviewResult, { kind: 'Saved' }>['action'] {
  return {
    id: 'e1',
    entryType: 'Daily Trade Review',
    source: 'Daily Review',
    anchor: { kind: 'Trade', tradeId: 't1' },
    momentTime: '2026-10-12T20:00:00Z',
    authoredTime: '2026-10-12T21:00:00Z',
    responses: [{ prompt: 'Action', answer: { kind: 'Option', label: action } }, ...(intent === undefined ? [] : [{ prompt: 'Intent', answer: { kind: 'Text' as const, text: intent } }])],
    entryRevision,
    action,
    definitionId: 'def1',
  };
}
