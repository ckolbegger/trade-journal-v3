// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect, useState, type ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDrafts } from './action-draft.ts';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { DailyTradeReview, MarkRow, OpenDailyReviewResult, OwedReflection, OwedReflectionsCard, ReviewBinding, ReviewCompletion, ReviewTradeItem, SaveDailyReviewResult } from '../../app/types.ts';
import { exitFormFacade, reflectionDefinition } from '../../../tests/support/position-change-form-facade.ts';
import { closedExitResult } from '../../../tests/support/exit-result-fixtures.ts';
import { DAILY_TRADE_REVIEW_PROMPTS } from '../../domain/daily-trade-review-prompts.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ReviewView } from './ReviewView.tsx';
import { dayOf } from '../../../tests/support/review-day.ts';
import { cardProgress, reflectionsOwedProgress } from '../../../tests/support/card-progress.ts';

afterEach(cleanup);
beforeEach(resetDrafts);

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;
type Evaluation = NonNullable<DailyTradeReview['evaluation']>;

const binding: ReviewBinding = {
  workspace: { databaseName: 'tj-ws-1', contentRevision: 3 },
  catalogRevision: 1,
  journalRevision: 1,
  marketDataSnapshotId: 'mds1:1:abc',
  factRevisions: { t1: 2 },
  outstandingDebts: {},
};
const item = (tradeId: string, underlying: string, over: Partial<ReviewTradeItem> = {}): ReviewTradeItem => ({
  tradeId,
  underlying,
  lastActivity: '2026-10-12T14:00:00Z',
  band: 'Routine',
  reasons: [{ code: 'NoPressure' }],
  basis: { kind: 'Value', value: { side: 'None', share: Rational.of(0n, 1n) } },
  ...over,
});
function ready(trades: readonly ReviewTradeItem[], missing: readonly string[] = trades.map((t) => t.tradeId), over: Partial<Ready> = {}): Ready {
  const built: Ready = {
    kind: 'Ready',
    reviewDate: '2026-10-12',
    cutoff: '2026-10-12T20:00:00Z',
    families: [
      { family: 'Marks', earlierMarks: [], today: [], earlier: [] },
      { family: 'Trades', trades: trades.map((t) => ({ ...t, progress: cardProgress(0, 0, { resolved: 0, owed: missing.includes(t.tradeId) }) })) },
    ],
    owed: [],
    completion: missing.length > 0 ? { kind: 'Incomplete', reasons: missing.map((tradeId) => ({ code: 'ActionMissing' as const, tradeId })) } : { kind: 'Complete' },
    binding,
    ...over,
  };
  return over.day ? built : { ...built, day: dayOf(built) };
}

const value = (n: bigint, d = 1n) => ({ kind: 'Value' as const, value: Rational.of(n, d) });
const symbol = { kind: 'Stock' as const, symbol: 'XYZ' };
// The figures the Review reads; every other evaluation field is out of this screen's sight.
function evaluation(over: Record<string, unknown> = {}): Evaluation {
  return {
    kind: 'Evaluated',
    conditions: [],
    valuationDate: '2026-10-12',
    coverage: { kind: 'Available', revisionId: 'r1', revisionNumber: 1 },
    observation: { instrument: symbol, tradingDate: '2026-10-12', mark: { revisionId: 'r1', revisionNumber: 1, price: '52.00' } },
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
    lifecycle: 'Open',
    attention: item(tradeId, underlying),
    labels: { strategy: 'Long Stock', account: 'Main', institution: 'Broker' },
    evaluation: evaluation(),
    settlement: [],
    reflections: [],
    progress: cardProgress(),
    form: { kind: 'New', viewState: { selectedAction: 'Hold' } },
    definitionRevision: 'def1',
    saveBinding: savedBinding({ tradeId, obligationKey: { entryType: 'DailyTradeReview', trade: tradeId, reviewDate: '2026-10-12' } }),
    ...over,
  };
}

// Like the shell: a RuntimeNotWritable result reported by a screen turns the whole runtime read only.
function ShellLike({ children }: { readonly children: ReactNode }) {
  const [writable, setWritable] = useState(true);
  return <RuntimeContext.Provider value={{ writable, report: (result) => result.kind === 'RuntimeNotWritable' && setWritable(false) }}>{children}</RuntimeContext.Provider>;
}
// The address the page is at now, and how the router got there (A274: opening pushes an entry; Close goes back one, or replaces the address).
const here = { address: '', how: 'POP' as string, go: undefined as ((delta: number) => void) | undefined, push: undefined as ((to: string) => void) | undefined };
function Where() {
  const location = useLocation();
  const how = useNavigationType();
  const navigate = useNavigate();
  useEffect(() => {
    Object.assign(here, { address: location.pathname + location.search, how, go: (delta: number) => void navigate(delta), push: (to: string) => void navigate(to) });
  });
  return null;
}
// The browser's Back button.
const browserBack = () =>
  act(() => {
    here.go?.(-1);
    return Promise.resolve();
  });
function renderWalk(facade: UiFacade, options: { writable?: boolean; onDirtyChange?: (dirty: boolean) => void; report?: (result: { kind: string }) => void; shellLike?: boolean; address?: string } = {}) {
  const review = (
    <MemoryRouter initialEntries={[options.address ?? '/review']}>
      <Where />
      <ReviewView facade={facade} now={() => '2026-10-12T21:00:00Z'} onDirtyChange={options.onDirtyChange ?? (() => undefined)} />
    </MemoryRouter>
  );
  render(
    options.shellLike ? (
      <ShellLike>{review}</ShellLike>
    ) : (
      <RuntimeContext.Provider value={{ writable: options.writable ?? true, timeZone: 'America/New_York', report: options.report ?? (() => undefined) }}>{review}</RuntimeContext.Provider>
    ),
  );
}
function walkFacade(review: Ready, ...trades: DailyTradeReview[]): UiFacade {
  const facade = facadeDouble();
  vi.mocked(facade.DailyReview.open).mockResolvedValue(review);
  const getTrade = vi.mocked(facade.DailyReview.getTrade);
  for (const trade of trades) getTrade.mockResolvedValueOnce({ kind: 'Ready', reviewDate: '2026-10-12', cutoff: review.cutoff, trade });
  return facade;
}
// A save result's card for a Trade whose Action was just saved: nothing else is owed on these fixtures (D5R2 section 6.3).
const savedCard = (tradeId: string) => ({ tradeId, progress: cardProgress(0, 0, { resolved: 0, owed: false }) });
// Opens the named Trade's card; the first card that is not Done is already open when the Review loads.
async function openTrade(user: ReturnType<typeof userEvent.setup>, underlying: string) {
  const header = await screen.findByRole('button', { name: new RegExp(`^Review ${underlying}\\b`) });
  if (header.getAttribute('aria-expanded') !== 'true') await user.click(header);
  // A Trade with a summary names its region with the summary after the Underlying.
  return screen.findByRole('region', { name: new RegExp(`^${underlying}\\b.* review$`) });
}

describe('Trade in the walk', () => {
  it('should show the Trade figures for the Review Date, the dated and at-entry lines when present, and its attention reasons', async () => {
    const attention = item('t1', 'XYZ', { band: 'QuantifiedPressure', reasons: [{ code: 'PressureTowardTarget' }], basis: { kind: 'Value', value: { side: 'Winning', share: Rational.of(91n, 291n), atEntry: Rational.of(1000n), now: Rational.of(700n) } } });
    const facade = walkFacade(ready([attention]), tradeReview('t1', 'XYZ', { attention }));
    renderWalk(facade);
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenCalledExactlyOnceWith({ reviewDate: '2026-10-12', tradeId: 't1', binding });
    expect(within(trade).getByRole('heading', { name: 'Now · Mon Oct 12' })).toBeTruthy();
    const figure = (term: string) => within(trade).getByText(term).nextElementSibling?.textContent;
    expect(figure('Worst case')).toBe('$5,000.00 more · 20.00R');
    expect(figure('Max reward')).toBe('No cap');
    expect(within(trade).getByText('31% of the way from entry to the Target')).toBeTruthy();
    expect(within(trade).queryByRole('group', { name: /close/ })).toBeNull();
    expect(within(trade).queryByRole('group', { name: 'At entry' })).toBeNull();
    cleanup();

    // The Review Date Mark is missing: no number stands in for it, the dated close and the at-entry lots are their own lines.
    const unavailable = { kind: 'Unavailable' as const, reason: 'MarkMissing', instrument: symbol, date: '2026-10-12' };
    const limited = item('t1', 'XYZ', { band: 'EvidenceLimited', reasons: [{ code: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'XYZ' }, date: '2026-10-12' }], basis: { kind: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'XYZ' }, date: '2026-10-12' } });
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
      datedLastClose: { tradingDate: '2026-10-09', evaluation: evaluation({ currentMarkedPnl: value(-50n), currentMarkedPnlInPlanR: value(-1n, 5n), ongoingRiskToStop: value(300n), ongoingRiskToStopInPlanR: value(6n, 5n), worstCaseOngoingRisk: value(2600n), worstCaseOngoingRiskInPlanR: value(52n, 5n), incrementalRewardToTarget: value(900n), incrementalRewardToTargetInPlanR: value(18n, 5n) }) },
    });
    const again = walkFacade(ready([limited]), missing);
    renderWalk(again);
    const second = await openTrade(user, 'XYZ');
    // The box reads the dated close, headed by its date, and no number stands in for the Mark that is missing.
    expect(within(second).getByRole('heading', { name: 'At the Fri Oct 9 Marks' })).toBeTruthy();
    expect(within(second).queryByRole('heading', { name: /^Now · / })).toBeNull();
    expect(figure2(second, 'Worst case')).toBe('$2,600.00 more · 10.40R');
    const atEntry = within(second).getByRole('group', { name: 'At entry' });
    expect(figure2(atEntry, 'Risk to stop')).toBe('$60.00');
    expect(figure2(atEntry, 'Reward to target')).toBe('$200.00');
    expect(within(second).getByText('Mark missing for XYZ on Mon Oct 12')).toBeTruthy();
  });
});

describe('Trade figures in R and worst case', () => {
  const rValue = (n: bigint, d = 1n) => value(n, d);
  it('should show the reference Trade with its worst case and its R in the Now box', async () => {
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', {
      evaluation: evaluation({
        currentMarkedPnl: value(180n), currentMarkedPnlInPlanR: rValue(18n, 25n),
        ongoingRiskToStop: value(450n), ongoingRiskToStopInPlanR: rValue(9n, 5n),
        worstCaseOngoingRisk: value(5200n), worstCaseOngoingRiskInPlanR: rValue(104n, 5n),
        incrementalRewardToTarget: value(400n), incrementalRewardToTargetInPlanR: rValue(8n, 5n),
      }),
    }));
    renderWalk(facade);
    const trade = await openTrade(userEvent.setup(), 'XYZ');
    expect(figure2(trade, 'Worst case')).toBe('$5,200.00 more · 20.80R');
    expect(figure2(trade, 'Reward to risk')).toBe('3.00 to 1 · Plan 2.40 to 1');
  });

  it('should show the worst case Unavailable in the same words when the Mark is missing', async () => {
    const unavailable = { kind: 'Unavailable' as const, reason: 'MarkMissing', instrument: symbol, date: '2026-10-12' };
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', {
      evaluation: evaluation({
        observation: { instrument: symbol, tradingDate: '2026-10-12', mark: null },
        ongoingRiskToStop: unavailable, worstCaseOngoingRisk: unavailable, worstCaseOngoingRiskInPlanR: unavailable, incrementalRewardToTarget: unavailable,
      }),
    }));
    renderWalk(facade);
    const trade = await openTrade(userEvent.setup(), 'XYZ');
    expect(figure2(trade, 'Worst case')).toBe('Mark missing: XYZ, Mon Oct 12');
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
    expect(within(trade).getAllByRole('button', { name: /Save/ }).map((b) => b.textContent)).toEqual(['Save Hold']);
    // Opening it records nothing.
    expect(vi.mocked(facade.DailyReview.save)).not.toHaveBeenCalled();
  });

  it('should render the Action choices as the shared chip radio group, each label wrapping its radio', async () => {
    renderWalk(walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ')));
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    const group = within(trade).getByRole('group', { name: 'Action' });
    expect(group.className).toBe('choices');
    for (const radio of within(group).getAllByRole('radio')) {
      const label = (radio as HTMLInputElement).labels?.[0];
      expect(label?.className).toBe('chip');
      expect(label?.contains(radio)).toBe(true);
    }
  });

  it('should save Hold with one press of Save and move to the next Trade from the returned next step without calling open or getTrade', async () => {
    const trades = [item('t1', 'XYZ'), item('t2', 'DEF')];
    const first = tradeReview('t1', 'XYZ');
    const next = tradeReview('t2', 'DEF', { evaluation: evaluation({ worstCaseOngoingRisk: value(1500n), worstCaseOngoingRiskInPlanR: value(10n) }) });
    const facade = walkFacade(ready(trades), first);
    const nextBinding: ReviewBinding = { ...binding, journalRevision: 2 };
    vi.mocked(facade.DailyReview.save).mockResolvedValue({
      kind: 'Saved',
      action: savedAction('Hold'),
      review: { kind: 'Ready', cards: [savedCard('t1')], progress: { tradesWithAction: 1, tradesEligible: 2 }, completion: { kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: 't2' }] }, nextStep: { kind: 'Trade', trade: next }, binding: nextBinding },
    });
    renderWalk(facade);
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    const opens = vi.mocked(facade.DailyReview.open).mock.calls.length;
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));

    // One call, carrying the exact binding getTrade returned and no Intent.
    expect(vi.mocked(facade.DailyReview.save)).toHaveBeenCalledExactlyOnceWith({ kind: 'SaveTradeAction', binding: first.saveBinding, action: 'Hold' });
    const following = await screen.findByRole('region', { name: 'DEF review' });
    expect(within(following).getByText('$1,500.00 more · 10.00R')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
    expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledTimes(opens);
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenCalledTimes(1);
    // The cards follow the returned completion: the first is Done, the second still owes its Action.
    const cards = screen.getAllByRole('button', { name: /^Review / }).map((header) => header.textContent);
    expect(cards[0]).toContain('Done');
    expect(cards[1]).toContain('Action');
    expect(cards[1]).not.toContain('Done');
  });
});

const INTENT_PROMPT = DAILY_TRADE_REVIEW_PROMPTS.intent;
const INTENT_LABEL = /^Why\?/;

describe('Action form (AC-REV-003)', () => {
  it('should label the Intent field with the definition prompt and its required or optional marker', async () => {
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ'));
    renderWalk(facade);
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    expect(within(trade).getByRole('textbox', { name: `${INTENT_PROMPT} (optional)` })).toBeTruthy();
    await user.click(within(trade).getByRole('radio', { name: 'Exit' }));
    expect(within(trade).getByRole('textbox', { name: `${INTENT_PROMPT} (required)` })).toBeTruthy();
  });

  it('should require Intent when Exit, Roll, or Adjust is selected, showing the issue beside the field', async () => {
    const first = tradeReview('t1', 'XYZ');
    const facade = walkFacade(ready([item('t1', 'XYZ')]), first);
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: savedAction('Roll', 'Move to Nov.'), review: { kind: 'Ready', cards: [], progress: { tradesWithAction: 1, tradesEligible: 1 }, completion: { kind: 'Complete' }, nextStep: { kind: 'Done' }, binding } });
    renderWalk(facade);
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    const intent = within(trade).getByRole('textbox', { name: INTENT_LABEL });
    expect(intent.parentElement?.textContent).toContain(`${INTENT_PROMPT} (optional)`);
    for (const choice of ['Exit', 'Roll', 'Adjust']) {
      await user.click(within(trade).getByRole('radio', { name: choice }));
      expect(within(trade).getByRole('textbox', { name: INTENT_LABEL }).parentElement?.textContent).toContain(`${INTENT_PROMPT} (required)`);
      await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
      const message = within(trade).getByText('Say why.');
      expect(within(trade).getByRole('textbox', { name: INTENT_LABEL }).getAttribute('aria-describedby')).toBe(message.id);
      expect(document.activeElement).toBe(within(trade).getByRole('textbox', { name: INTENT_LABEL }));
      // Blank is not Intent.
      await user.type(within(trade).getByRole('textbox', { name: INTENT_LABEL }), '   ');
      await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
      expect(vi.mocked(facade.DailyReview.save)).not.toHaveBeenCalled();
      await user.clear(within(trade).getByRole('textbox', { name: INTENT_LABEL }));
    }

    await user.type(within(trade).getByRole('textbox', { name: INTENT_LABEL }), ' Move to Nov. ');
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    expect(vi.mocked(facade.DailyReview.save)).toHaveBeenCalledExactlyOnceWith({ kind: 'SaveTradeAction', binding: first.saveBinding, action: 'Adjust', intent: 'Move to Nov.' });
  });
});

describe('Saved Action', () => {
  it('should show the reason of an Action saved under the earlier form, and pre-fill it on Change', async () => {
    const earlier = { ...savedAction('Exit', undefined, 1), responses: [{ prompt: 'Action', answer: { kind: 'Option' as const, label: 'Exit' } }, { prompt: DAILY_TRADE_REVIEW_PROMPTS.earlierIntent, answer: { kind: 'Text' as const, text: 'Saved under the earlier form.' } }] };
    const first = tradeReview('t1', 'XYZ', { form: { kind: 'Saved', action: earlier }, saveBinding: savedBinding({ expectedEntryRevision: 1 }) });
    renderWalk(walkFacade(ready([item('t1', 'XYZ')], []), first));
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    expect(within(trade).getByText('Mon Oct 12: Exit · “Saved under the earlier form.”')).toBeTruthy();
    await user.click(within(trade).getByRole('button', { name: 'Change' }));
    expect(within(trade).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('value', 'Saved under the earlier form.');
  });

  it('should show a saved Action with its values and allow changing it, submitting the expected Entry revision', async () => {
    const saved = savedAction('Exit', 'Because the plan changed.', 2);
    const first = tradeReview('t1', 'XYZ', { form: { kind: 'Saved', action: saved }, saveBinding: savedBinding({ expectedEntryRevision: 2 }) });
    const facade = walkFacade(ready([item('t1', 'XYZ')], []), first);
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: savedAction('Roll', 'Roll to November.', 3), review: { kind: 'Ready', cards: [], progress: { tradesWithAction: 1, tradesEligible: 1 }, completion: { kind: 'Complete' }, nextStep: { kind: 'Done' }, binding } });
    renderWalk(facade);
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    // The saved values, and no form until the trader chooses to change them.
    expect(within(trade).getByText('Mon Oct 12: Exit · “Because the plan changed.”')).toBeTruthy();
    expect(within(trade).queryByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ })).toBeNull();
    await user.click(within(trade).getByRole('button', { name: 'Change' }));
    expect(within(trade).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', true);
    expect(within(trade).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('value', 'Because the plan changed.');
    await user.click(within(trade).getByRole('radio', { name: 'Roll' }));
    await user.clear(within(trade).getByRole('textbox', { name: INTENT_LABEL }));
    await user.type(within(trade).getByRole('textbox', { name: INTENT_LABEL }), 'Roll to November.');
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));

    expect(vi.mocked(facade.DailyReview.save)).toHaveBeenCalledExactlyOnceWith({ kind: 'SaveTradeAction', binding: { ...first.saveBinding, expectedEntryRevision: 2 }, action: 'Roll', intent: 'Roll to November.' });
  });
});

describe('Saved Action answers', () => {
  it('should not show or re-send a Text answer under an unrecognised prompt as the Intent', async () => {
    // A later definition revision reworded Note, so its answer is not one the form knows.
    const saved = savedAction('Hold', undefined, 2, [{ prompt: 'Remarks', answer: { kind: 'Text', text: 'Earnings Thursday.' } }]);
    const first = tradeReview('t1', 'XYZ', { form: { kind: 'Saved', action: saved }, saveBinding: savedBinding({ expectedEntryRevision: 2 }) });
    const facade = walkFacade(ready([item('t1', 'XYZ')], []), first);
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: savedAction('Hold', undefined, 3), review: { kind: 'Ready', cards: [], progress: { tradesWithAction: 1, tradesEligible: 1 }, completion: { kind: 'Complete' }, nextStep: { kind: 'Done' }, binding } });
    renderWalk(facade);
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    expect(within(trade).queryByText(INTENT_LABEL)).toBeNull();
    expect(within(trade).queryByText(/Earnings Thursday/)).toBeNull();
    await user.click(within(trade).getByRole('button', { name: 'Change' }));
    expect(within(trade).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('value', '');
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));

    expect(vi.mocked(facade.DailyReview.save)).toHaveBeenCalledExactlyOnceWith({ kind: 'SaveTradeAction', binding: { ...first.saveBinding, expectedEntryRevision: 2 }, action: 'Hold' });
  });
});

describe('Changed review', () => {
  it('should show ReviewChanged with the entered values kept and offer Refresh', async () => {
    const first = tradeReview('t1', 'XYZ');
    const refreshedBinding: ReviewBinding = { ...binding, marketDataSnapshotId: 'mds1:2:def', factRevisions: { t1: 3 } };
    const refreshed = tradeReview('t1', 'XYZ', { evaluation: evaluation({ worstCaseOngoingRisk: value(3500n), worstCaseOngoingRiskInPlanR: value(14n) }), saveBinding: savedBinding({ factRevision: 3, marketDataSnapshotId: 'mds1:2:def' }) });
    const facade = walkFacade(ready([item('t1', 'XYZ')]), first, refreshed);
    vi.mocked(facade.DailyReview.open).mockResolvedValueOnce(ready([item('t1', 'XYZ')])).mockResolvedValue(ready([item('t1', 'XYZ')], undefined, { binding: refreshedBinding }));
    vi.mocked(facade.DailyReview.save)
      .mockResolvedValueOnce({ kind: 'ReviewChanged', evidence: { marketDataSnapshotId: 'mds1:2:def', frames: [], factRevision: 3 } })
      .mockResolvedValue({ kind: 'Saved', action: savedAction('Exit', 'Stopped out.'), review: { kind: 'Ready', cards: [], progress: { tradesWithAction: 1, tradesEligible: 1 }, completion: { kind: 'Complete' }, nextStep: { kind: 'Done' }, binding: refreshedBinding } });
    renderWalk(facade);
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenLastCalledWith({ reviewDate: '2026-10-12', tradeId: 't1', binding });
    await user.click(within(trade).getByRole('radio', { name: 'Exit' }));
    await user.type(within(trade).getByRole('textbox', { name: INTENT_LABEL }), 'Stopped out.');
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));

    const alert = await within(trade).findByRole('alert');
    expect(alert.textContent).toContain('The Review changed after you opened this Trade. Nothing was saved.');
    expect(alert.textContent).toContain('Your values are kept');
    expect(document.activeElement).toBe(alert);
    expect(within(trade).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', true);
    expect(within(trade).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('value', 'Stopped out.');

    await user.click(within(alert).getByRole('button', { name: 'Refresh' }));
    // The Review is asked for again and the Trade is read under the new binding; the entered values stay.
    expect(await within(await screen.findByRole('region', { name: 'XYZ review' })).findByText('$3,500.00 more · 14.00R')).toBeTruthy();
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenLastCalledWith({ reviewDate: '2026-10-12', tradeId: 't1', binding: refreshedBinding });
    const again = screen.getByRole('region', { name: 'XYZ review' });
    expect(within(again).queryByRole('alert')).toBeNull();
    expect(within(again).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', true);
    expect(within(again).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('value', 'Stopped out.');
    await user.click(within(again).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    expect(vi.mocked(facade.DailyReview.save)).toHaveBeenLastCalledWith({ kind: 'SaveTradeAction', binding: refreshed.saveBinding, action: 'Exit', intent: 'Stopped out.' });
  });

  it('should say the Review kept changing and offer Refresh when a save returns ChangedDuringAssembly', async () => {
    const first = tradeReview('t1', 'XYZ');
    const facade = walkFacade(ready([item('t1', 'XYZ')]), first, first);
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'ChangedDuringAssembly' });
    renderWalk(facade);
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    await user.click(within(trade).getByRole('radio', { name: 'Exit' }));
    await user.type(within(trade).getByRole('textbox', { name: INTENT_LABEL }), 'Stopped out.');
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));

    const alert = await within(trade).findByRole('alert');
    expect(alert.textContent).toContain('The Review kept changing while this Action was checked. Nothing was saved.');
    expect(alert.textContent).toContain('Your values are kept');
    expect(document.activeElement).toBe(alert);
    expect(within(alert).getByRole('button', { name: 'Refresh' })).toBeTruthy();
    expect(within(trade).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', true);
    expect(within(trade).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('value', 'Stopped out.');
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
    await user.type(within(trade).getByRole('textbox', { name: INTENT_LABEL }), 'Watching.');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.clear(within(trade).getByRole('textbox', { name: INTENT_LABEL }));
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

describe('Leaving an unsaved reflection', () => {
  it('should hold Trade selection and the day line links while a reflection draft has a value, as it does for an Action draft', async () => {
    const user = userEvent.setup();
    const reflections = [owed('d1', 'Due', '2026-10-09T14:30:00Z', [{}])];
    // XYZ still owes its Action, so it is the card open on load.
    const review = ready([item('t1', 'XYZ'), item('t2', 'DEF')], [], { completion: { kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: 't1' }, { code: 'ReflectionDue', tradeId: 't2', debtIds: ['d9'] }] } });
    const facade = walkFacade(review, tradeReview('t1', 'XYZ', { reflections }));
    renderWalk(facade);
    const trade = await openTrade(user, 'XYZ');
    const opens = vi.mocked(facade.DailyReview.open).mock.calls.length;

    await user.click(panelHeader(trade, 'Reflections'));
    await user.click(within(trade).getByRole('button', { name: /Reflect on 2026-10-09 10:30/ }));
    await user.click(within(trade).getByRole('button', { name: 'Decline…' }));
    await user.type(within(within(trade).getByRole('region', { name: 'Reflections' })).getByLabelText('Why? (optional)'), 'No time.');

    await user.click(within(screen.getByRole('list', { name: 'Trade lines' })).getByRole('link', { name: 'DEF' }));
    await user.click(screen.getByRole('button', { name: /^Review DEF/ }));
    expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledTimes(opens);
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: 'XYZ review' })).toBeTruthy();
    expect(screen.getByText("XYZ's note isn't saved.")).toBeTruthy();
    expect(within(within(trade).getByRole('region', { name: 'Reflections' })).getByLabelText<HTMLTextAreaElement>('Why? (optional)').value).toBe('No time.');
  });
});

describe('Action form extras', () => {
  it('should offer no Save while the runtime is not writable, and still show a saved Action', async () => {
    const saved = tradeReview('t2', 'DEF', { form: { kind: 'Saved', action: savedAction('Hold') } });
    const facade = walkFacade(ready([item('t1', 'XYZ'), item('t2', 'DEF')]), tradeReview('t1', 'XYZ'), saved);
    renderWalk(facade, { writable: false });
    const user = userEvent.setup();

    const trade = await openTrade(user, 'XYZ');
    expect(within(trade).queryByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ })).toBeNull();
    expect(within(trade).queryByRole('radio')).toBeNull();
    expect(within(trade).getByText('No Action saved.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Review DEF\b/ }));
    const other = await screen.findByRole('region', { name: 'DEF review' });
    expect(within(other).getByText(/^Mon Oct 12: Hold/)).toBeTruthy();
    expect(within(other).queryByRole('button', { name: 'Change' })).toBeNull();
  });
});

describe('Action form when the shell turns read only after a refused write', () => {
  const refused = { kind: 'RuntimeNotWritable', runtimeReadiness: 'RecoveryOnly', failedChecks: [], workspaceStatus: 'RecoveryOnly', safeActions: [] } as const;
  async function refusedSave() {
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ'));
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce(refused);
    renderWalk(facade, { shellLike: true });
    const user = userEvent.setup();
    const trade = await openTrade(user, 'XYZ');
    await user.click(within(trade).getByRole('radio', { name: 'Exit' }));
    await user.type(within(trade).getByRole('textbox', { name: INTENT_LABEL }), 'Plan changed.');
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    return { facade, trade };
  }

  it('should keep the form on screen with the Exit choice and the Intent text, and offer no working Save', async () => {
    const { facade, trade } = await refusedSave();
    await vi.waitFor(() => expect(facade.DailyReview.save).toHaveBeenCalledOnce());
    const exit = await within(trade).findByRole('radio', { name: 'Exit' });
    expect(exit).toHaveProperty('checked', true);
    expect(within(trade).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('value', 'Plan changed.');
    expect(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ })).toHaveProperty('disabled', true);
    expect(within(trade).queryByText('No Action saved.')).toBeNull();
  });

  it('should release the unsaved hold so the card can be left', async () => {
    const { trade } = await refusedSave();
    await within(trade).findByRole('radio', { name: 'Exit' });
    // Once the shell is read only the entered values no longer hold the card: its header collapses it.
    await vi.waitFor(async () => {
      await userEvent.setup().click(screen.getByRole('button', { name: /^Review XYZ\b/ }));
      expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
    });
    expect(screen.queryByText(/note isn't saved/)).toBeNull();
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
    await user.type(within(trade).getByRole('textbox', { name: INTENT_LABEL }), 'Plan changed.');
    const press = () => user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    const kept = () => {
      expect(within(trade).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', true);
      expect(within(trade).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('value', 'Plan changed.');
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
    expect(await within(trade).findByText('Say why.')).toBeTruthy();
    expect(within(trade).queryByRole('alert')).toBeNull();
    kept();

    // Any other rejection is about the Action as a whole, not the Intent.
    save.mockResolvedValueOnce({ kind: 'Rejected', issues: [{ code: 'DefinitionRevisionMismatch' }] });
    await press();
    expect(await within(trade).findByText('This Action could not be saved. Reopen the Trade and try again.')).toBeTruthy();
    expect(within(trade).queryByText('Say why.')).toBeNull();
    kept();

    const refused = { kind: 'RuntimeNotWritable', runtimeReadiness: 'RecoveryOnly', failedChecks: [], workspaceStatus: 'RecoveryOnly', safeActions: [] } as const;
    save.mockResolvedValueOnce(refused);
    await press();
    await vi.waitFor(() => expect(report).toHaveBeenCalledWith(refused));
    kept();
  });
});

describe('Conflict refresh with a saved Action', () => {
  async function conflictThenRefresh(refreshedAction: ReturnType<typeof savedAction>, onDirtyChange: (dirty: boolean) => void = () => undefined) {
    const first = tradeReview('t1', 'XYZ');
    const refreshed = tradeReview('t1', 'XYZ', { form: { kind: 'Saved', action: refreshedAction }, saveBinding: savedBinding({ expectedEntryRevision: 2 }) });
    const facade = walkFacade(ready([item('t1', 'XYZ')]), first, refreshed);
    const save = vi.mocked(facade.DailyReview.save);
    save.mockResolvedValueOnce({ kind: 'Conflict' });
    renderWalk(facade, { onDirtyChange });
    const user = userEvent.setup();
    const trade = await openTrade(user, 'XYZ');
    await user.click(within(trade).getByRole('radio', { name: 'Exit' }));
    await user.type(within(trade).getByRole('textbox', { name: INTENT_LABEL }), 'Plan changed.');
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    await user.click(await within(trade).findByRole('button', { name: 'Refresh' }));
    return { facade, save, user, trade: await screen.findByRole('region', { name: 'XYZ review' }) };
  }

  it('should keep the entered values in an open form after a Conflict refresh shows a saved Action', async () => {
    const onDirtyChange = vi.fn();
    const { save, user, trade } = await conflictThenRefresh(savedAction('Hold', 'Other save.', 2), onDirtyChange);

    // The trader's values stay in an open form, with the other save shown to compare.
    await within(trade).findByText(/^Mon Oct 12: Hold/);
    expect(within(trade).getByText('Mon Oct 12: Hold · “Other save.”')).toBeTruthy();
    expect(within(trade).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', true);
    expect(within(trade).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('value', 'Plan changed.');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    // Save replaces the other save under the refreshed expected Entry revision.
    save.mockResolvedValueOnce({ kind: 'Saved', action: savedAction('Exit', 'Plan changed.', 3), review: { kind: 'Ready', cards: [], progress: { tradesWithAction: 1, tradesEligible: 1 }, completion: { kind: 'Complete' }, nextStep: { kind: 'Done' }, binding } });
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    expect(save).toHaveBeenLastCalledWith({ kind: 'SaveTradeAction', binding: savedBinding({ expectedEntryRevision: 2 }), action: 'Exit', intent: 'Plan changed.' });
  });

  it('should show the saved view when the kept values equal the refreshed saved Action', async () => {
    const onDirtyChange = vi.fn();
    const { trade } = await conflictThenRefresh(savedAction('Exit', 'Plan changed.', 2), onDirtyChange);

    await within(trade).findByText(/^Mon Oct 12: Exit/);
    expect(within(trade).queryByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ })).toBeNull();
    expect(within(trade).getByRole('button', { name: 'Change' })).toBeTruthy();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});

describe('Refresh to a different Review Date', () => {
  it('should start the form afresh when a Refresh returns a different Review Date', async () => {
    const onDirtyChange = vi.fn();
    const first = tradeReview('t1', 'XYZ');
    const newBinding = savedBinding({ reviewDate: '2026-10-13', obligationKey: { entryType: 'DailyTradeReview', trade: 't1', reviewDate: '2026-10-13' } });
    const moved = tradeReview('t1', 'XYZ', { saveBinding: newBinding });
    const facade = walkFacade(ready([item('t1', 'XYZ')]), first);
    vi.mocked(facade.DailyReview.getTrade).mockResolvedValueOnce({ kind: 'Ready', reviewDate: '2026-10-13', cutoff: '2026-10-13T20:00:00Z', trade: moved });
    vi.mocked(facade.DailyReview.open)
      .mockResolvedValueOnce(ready([item('t1', 'XYZ')]))
      .mockResolvedValue(ready([item('t1', 'XYZ')], undefined, { reviewDate: '2026-10-13' }));
    const save = vi.mocked(facade.DailyReview.save);
    save.mockResolvedValueOnce({ kind: 'Conflict' });
    renderWalk(facade, { onDirtyChange });
    const user = userEvent.setup();
    const trade = await openTrade(user, 'XYZ');
    await user.click(within(trade).getByRole('radio', { name: 'Exit' }));
    await user.type(within(trade).getByRole('textbox', { name: INTENT_LABEL }), 'Plan changed.');
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    await user.click(await within(trade).findByRole('button', { name: 'Refresh' }));

    // The old date's draft does not carry over; the trader is told why.
    const again = await screen.findByRole('status');
    expect(again.textContent).toBe('The Review moved to Tue Oct 13. This Trade’s form starts afresh for that date.');
    const form = screen.getByRole('region', { name: 'XYZ review' });
    expect(within(form).getByRole('radio', { name: 'Hold' })).toHaveProperty('checked', true);
    expect(within(form).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('value', '');
    expect(within(form).queryByRole('alert')).toBeNull();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    save.mockResolvedValueOnce({ kind: 'Conflict' });
    await user.click(within(form).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    expect(save).toHaveBeenLastCalledWith({ kind: 'SaveTradeAction', binding: newBinding, action: 'Hold' });
  });
});

describe('Refresh to a different Review Date after a failed Trade read', () => {
  it('should say the form starts afresh when the Trade read failed on the first Refresh that moved the date', async () => {
    const first = tradeReview('t1', 'XYZ');
    const newBinding = savedBinding({ reviewDate: '2026-10-13', obligationKey: { entryType: 'DailyTradeReview', trade: 't1', reviewDate: '2026-10-13' } });
    const moved = tradeReview('t1', 'XYZ', { saveBinding: newBinding });
    const facade = walkFacade(ready([item('t1', 'XYZ')]), first);
    vi.mocked(facade.DailyReview.getTrade)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ kind: 'Ready', reviewDate: '2026-10-13', cutoff: '2026-10-13T20:00:00Z', trade: moved });
    vi.mocked(facade.DailyReview.open)
      .mockResolvedValueOnce(ready([item('t1', 'XYZ')]))
      .mockResolvedValue(ready([item('t1', 'XYZ')], undefined, { reviewDate: '2026-10-13' }));
    const save = vi.mocked(facade.DailyReview.save);
    save.mockResolvedValueOnce({ kind: 'Conflict' });
    renderWalk(facade);
    const user = userEvent.setup();
    const trade = await openTrade(user, 'XYZ');
    await user.click(within(trade).getByRole('radio', { name: 'Exit' }));
    await user.type(within(trade).getByRole('textbox', { name: INTENT_LABEL }), 'Plan changed.');
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    await user.click(await within(trade).findByRole('button', { name: 'Refresh' }));
    // The Review moved but the Trade read failed: the form stays on its own date.
    await screen.findByRole('region', { name: 'XYZ review' });
    expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenCalledTimes(2);
    await user.click(await within(screen.getByRole('region', { name: 'XYZ review' })).findByRole('button', { name: 'Refresh' }));

    expect((await screen.findByRole('status')).textContent).toBe('The Review moved to Tue Oct 13. This Trade’s form starts afresh for that date.');
    const form = screen.getByRole('region', { name: 'XYZ review' });
    expect(within(form).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('value', '');
  });
});

describe('After a save', () => {
  it('should start the next Trade form afresh, and say what follows when no Trade is next', async () => {
    const user = userEvent.setup();
    const trades = [item('t1', 'XYZ'), item('t2', 'DEF')];
    const post = (nextStep: Extract<NonNullable<Extract<SaveDailyReviewResult, { kind: 'Saved' }>['review']>, { kind: 'Ready' }>['nextStep']) =>
      ({ kind: 'Ready', cards: [], progress: { tradesWithAction: 1, tradesEligible: 2 }, completion: { kind: 'Complete' }, nextStep, binding }) as const;

    const facade = walkFacade(ready(trades), tradeReview('t1', 'XYZ'));
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: savedAction('Exit', 'Done.'), review: post({ kind: 'Trade', trade: tradeReview('t2', 'DEF') }) });
    renderWalk(facade);
    const first = await openTrade(user, 'XYZ');
    await user.click(within(first).getByRole('radio', { name: 'Exit' }));
    await user.type(within(first).getByRole('textbox', { name: INTENT_LABEL }), 'Done.');
    await user.click(within(first).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    const next = await screen.findByRole('region', { name: 'DEF review' });
    expect(within(next).getByRole('radio', { name: 'Hold' })).toHaveProperty('checked', true);
    expect(within(next).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('value', '');
    cleanup();

    // When no Trade is next the card closes: the day card says what is left, and the only message is for a Review that could not be read again.
    const done = walkFacade(ready(trades), tradeReview('t1', 'XYZ'));
    vi.mocked(done.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: savedAction('Hold'), review: post({ kind: 'Done' }) });
    renderWalk(done);
    await user.click(within(await openTrade(user, 'XYZ')).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    await vi.waitFor(() => expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull());
    expect(screen.queryByRole('status')).toBeNull();
    cleanup();

    const again = walkFacade(ready(trades), tradeReview('t1', 'XYZ'));
    vi.mocked(again.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: savedAction('Hold'), review: { kind: 'ChangedDuringAssembly' } });
    renderWalk(again);
    const trade = await openTrade(user, 'XYZ');
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    expect((await screen.findByRole('status')).textContent).toBe('The Action is saved. Reload the Review to refresh it.');
    expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
  });
});

const CONSIDERED = 'Anything you considered doing and decided against?';

describe('the definition optional questions (T4.33-B3)', () => {
  const closed = { kind: 'Saved', action: savedAction('Hold'), review: { kind: 'Ready', cards: [], progress: { tradesWithAction: 1, tradesEligible: 1 }, completion: { kind: 'Complete' }, nextStep: { kind: 'Done' }, binding } } as const;
  const fill = async (user: ReturnType<typeof userEvent.setup>, trade: HTMLElement) => {
    await user.click(within(within(trade).getByRole('group', { name: 'Conviction now (optional)' })).getByRole('button', { name: '3' }));
    await user.type(within(trade).getByRole('textbox', { name: CONSIDERED }), ' Selling the call. ');
    await user.type(within(trade).getByRole('textbox', { name: 'Note' }), ' Earnings Thursday. ');
  };

  it('should show Conviction now, the considered question, and Note after Intent in definition order, labelled with the definition text', async () => {
    const user = userEvent.setup();
    renderWalk(walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ')));
    const trade = await openTrade(user, 'XYZ');

    const form = within(trade).getByRole('form', { name: 'Action' });
    // The fields in document order, each by the question text of its label.
    const questions = [...form.querySelectorAll('textarea, [role="group"]')].map((field) => (field.tagName === 'TEXTAREA' ? field.closest('label')!.firstChild!.textContent : document.getElementById(field.getAttribute('aria-labelledby')!)!.textContent));
    expect(questions).toEqual([`${INTENT_PROMPT} (optional)`, 'Conviction now (optional)', CONSIDERED, 'Note']);
    const conviction = within(trade).getByRole('group', { name: 'Conviction now (optional)' });
    expect(within(conviction).getAllByRole('button').map((b) => b.textContent)).toEqual(['1', '2', '3', '4', '5']);
    expect(within(conviction).queryAllByRole('button', { pressed: true })).toHaveLength(0);
  });

  it('should save the answered optional questions with the Action, trimmed, and send none that were left unanswered', async () => {
    const user = userEvent.setup();
    const first = tradeReview('t1', 'XYZ');
    const facade = walkFacade(ready([item('t1', 'XYZ')]), first);
    vi.mocked(facade.DailyReview.save).mockResolvedValue(closed);
    renderWalk(facade);
    const trade = await openTrade(user, 'XYZ');
    await fill(user, trade);
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    expect(vi.mocked(facade.DailyReview.save)).toHaveBeenCalledExactlyOnceWith({ kind: 'SaveTradeAction', binding: first.saveBinding, action: 'Hold', conviction: 3, considered: 'Selling the call.', note: 'Earnings Thursday.' });
  });

  it('should hold the form back as unsaved while an optional answer differs from the returned state', async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    renderWalk(walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ')), { onDirtyChange });
    const trade = await openTrade(user, 'XYZ');
    expect(onDirtyChange).not.toHaveBeenCalledWith(true);
    await user.type(within(trade).getByRole('textbox', { name: 'Note' }), 'x');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.clear(within(trade).getByRole('textbox', { name: 'Note' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await user.click(within(within(trade).getByRole('group', { name: 'Conviction now (optional)' })).getByRole('button', { name: '2' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.click(within(within(trade).getByRole('group', { name: 'Conviction now (optional)' })).getByRole('button', { name: '2' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await user.type(within(trade).getByRole('textbox', { name: CONSIDERED }), 'x');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it('should disable the optional fields while a save is in flight and keep their values after a Conflict', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ'));
    const held = deferred<SaveDailyReviewResult>();
    vi.mocked(facade.DailyReview.save).mockReturnValue(held.promise);
    renderWalk(facade);
    const trade = await openTrade(user, 'XYZ');
    await fill(user, trade);
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    for (const field of [within(within(trade).getByRole('group', { name: 'Conviction now (optional)' })).getByRole('button', { name: '3' }), within(trade).getByRole('textbox', { name: CONSIDERED }), within(trade).getByRole('textbox', { name: 'Note' })]) expect(field).toHaveProperty('disabled', true);

    held.resolve({ kind: 'Conflict' });
    await within(trade).findByRole('alert');
    expect(within(within(trade).getByRole('group', { name: 'Conviction now (optional)' })).getByRole('button', { name: '3' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(trade).getByRole('textbox', { name: CONSIDERED })).toHaveProperty('value', ' Selling the call. ');
    expect(within(trade).getByRole('textbox', { name: 'Note' })).toHaveProperty('value', ' Earnings Thursday. ');
    expect(within(trade).getByRole('textbox', { name: 'Note' })).toHaveProperty('disabled', false);
  });

  it('should keep the optional values on screen, disabled, when the shell turns read only', async () => {
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ'));
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'RuntimeNotWritable', runtimeReadiness: 'RecoveryOnly', failedChecks: [], workspaceStatus: 'RecoveryOnly', safeActions: [] });
    renderWalk(facade, { shellLike: true });
    const user = userEvent.setup();
    const trade = await openTrade(user, 'XYZ');
    await fill(user, trade);
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    await vi.waitFor(() => expect(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ })).toHaveProperty('disabled', true));
    expect(within(within(trade).getByRole('group', { name: 'Conviction now (optional)' })).getByRole('button', { name: '3' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(within(trade).getByRole('group', { name: 'Conviction now (optional)' })).getByRole('button', { name: '3' })).toHaveProperty('disabled', true);
    expect(within(trade).getByRole('textbox', { name: CONSIDERED })).toHaveProperty('disabled', true);
    expect(within(trade).getByRole('textbox', { name: 'Note' })).toHaveProperty('value', ' Earnings Thursday. ');
  });

  it('should show each answered optional value in the saved Action and pre-fill them on Change', async () => {
    const user = userEvent.setup();
    const saved = savedAction('Hold', undefined, 2, OPTIONAL_ANSWERS);
    const first = tradeReview('t1', 'XYZ', { form: { kind: 'Saved', action: saved }, saveBinding: savedBinding({ expectedEntryRevision: 2 }) });
    const facade = walkFacade(ready([item('t1', 'XYZ')], []), first);
    vi.mocked(facade.DailyReview.save).mockResolvedValue(closed);
    renderWalk(facade);
    const trade = await openTrade(user, 'XYZ');

    expect(within(trade).getByText('Conviction now: 4')).toBeTruthy();
    expect(within(trade).getByText(`${CONSIDERED} Selling the call.`)).toBeTruthy();
    expect(within(trade).getByText('Note: Earnings Thursday.')).toBeTruthy();
    await user.click(within(trade).getByRole('button', { name: 'Change' }));
    expect(within(within(trade).getByRole('group', { name: 'Conviction now (optional)' })).getByRole('button', { name: '4' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(trade).getByRole('textbox', { name: CONSIDERED })).toHaveProperty('value', 'Selling the call.');
    expect(within(trade).getByRole('textbox', { name: 'Note' })).toHaveProperty('value', 'Earnings Thursday.');
    await user.clear(within(trade).getByRole('textbox', { name: 'Note' }));
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    expect(vi.mocked(facade.DailyReview.save)).toHaveBeenCalledExactlyOnceWith({ kind: 'SaveTradeAction', binding: { ...first.saveBinding, expectedEntryRevision: 2 }, action: 'Hold', conviction: 4, considered: 'Selling the call.' });
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
    await user.type(within(trade).getByRole('textbox', { name: INTENT_LABEL }), 'Plan changed.');
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));

    for (const radio of within(trade).getAllByRole('radio')) expect(radio).toHaveProperty('disabled', true);
    expect(within(trade).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('disabled', true);

    held.resolve({ kind: 'Conflict' });
    await within(trade).findByRole('alert');
    for (const radio of within(trade).getAllByRole('radio')) expect(radio).toHaveProperty('disabled', false);
    const intent = within(trade).getByRole('textbox', { name: INTENT_LABEL });
    expect(intent).toHaveProperty('disabled', false);
    expect(intent).toHaveProperty('value', 'Plan changed.');
  });

  it('should disable the notice Refresh while a save is in flight', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ'));
    const held = deferred<SaveDailyReviewResult>();
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'Conflict' }).mockReturnValueOnce(held.promise);
    renderWalk(facade);
    const trade = await openTrade(user, 'XYZ');
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    await within(trade).findByRole('alert');
    expect(within(trade).getByRole('button', { name: 'Refresh' })).toHaveProperty('disabled', false);
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));

    expect(within(trade).getByRole('button', { name: 'Refresh' })).toHaveProperty('disabled', true);

    held.resolve({ kind: 'Conflict' });
    await vi.waitFor(() => expect(within(trade).getByRole('button', { name: 'Refresh' })).toHaveProperty('disabled', false));
  });

  it('should disable Save while a Refresh is in flight', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ'));
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'Conflict' });
    renderWalk(facade);
    const trade = await openTrade(user, 'XYZ');
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    await within(trade).findByRole('alert');
    const held = deferred<Ready>();
    vi.mocked(facade.DailyReview.open).mockReturnValue(held.promise);
    vi.mocked(facade.DailyReview.getTrade).mockResolvedValue({ kind: 'Ready', reviewDate: '2026-10-12', cutoff: ready([]).cutoff, trade: tradeReview('t1', 'XYZ') });
    await user.click(within(trade).getByRole('button', { name: 'Refresh' }));

    expect(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ })).toHaveProperty('disabled', true);

    held.resolve(ready([item('t1', 'XYZ')]));
    await vi.waitFor(() => expect(within(screen.getByRole('region', { name: 'XYZ review' })).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ })).toHaveProperty('disabled', false));
  });

  it('should disable the notice Refresh while a Refresh is in flight so Save stays disabled until it settles', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ'));
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'Conflict' });
    renderWalk(facade);
    const trade = await openTrade(user, 'XYZ');
    await user.click(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    await within(trade).findByRole('alert');
    const held = deferred<Ready>();
    vi.mocked(facade.DailyReview.open).mockReturnValue(held.promise);
    vi.mocked(facade.DailyReview.getTrade).mockResolvedValue({ kind: 'Ready', reviewDate: '2026-10-12', cutoff: ready([]).cutoff, trade: tradeReview('t1', 'XYZ') });
    await user.click(within(trade).getByRole('button', { name: 'Refresh' }));

    expect(within(trade).getByRole('button', { name: 'Refresh' })).toHaveProperty('disabled', true);
    expect(within(trade).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ })).toHaveProperty('disabled', true);

    held.resolve(ready([item('t1', 'XYZ')]));
    await vi.waitFor(() => expect(within(screen.getByRole('region', { name: 'XYZ review' })).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ })).toHaveProperty('disabled', false));
  });
});

describe('Results for a Trade no longer open', () => {
  const post = (nextStep: Extract<NonNullable<Extract<SaveDailyReviewResult, { kind: 'Saved' }>['review']>, { kind: 'Ready' }>['nextStep']) =>
    ({ kind: 'Ready', cards: [savedCard('t1')], progress: { tradesWithAction: 1, tradesEligible: 3 }, completion: { kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: 't2' }, { code: 'ActionMissing', tradeId: 't3' }] }, nextStep, binding }) as const;
  const trades = [item('t1', 'XYZ'), item('t2', 'DEF'), item('t3', 'GHI')];
  const ready1 = (trade: DailyTradeReview) => ({ kind: 'Ready' as const, reviewDate: '2026-10-12', cutoff: ready(trades).cutoff, trade });
  // Whether each card, in list order, reads Done.
  const doneCards = () => screen.getAllByRole('button', { name: /^Review / }).map((header) => header.textContent.includes('Done'));

  it('should keep the open Trade and its entered values when a save for another Trade settles late', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready(trades), tradeReview('t1', 'XYZ'), tradeReview('t2', 'DEF'));
    const held = deferred<SaveDailyReviewResult>();
    vi.mocked(facade.DailyReview.save).mockReturnValue(held.promise);
    renderWalk(facade);
    const first = await openTrade(user, 'XYZ');
    await user.click(within(first).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    await user.click(screen.getByRole('button', { name: /^Review DEF\b/ }));
    const second = await screen.findByRole('region', { name: 'DEF review' });
    await user.click(within(second).getByRole('radio', { name: 'Exit' }));
    await user.type(within(second).getByRole('textbox', { name: INTENT_LABEL }), 'Keep me.');

    held.resolve({ kind: 'Saved', action: savedAction('Hold'), review: post({ kind: 'Trade', trade: tradeReview('t3', 'GHI') }) });

    // The save's walk-level effect applies; the selection does not move.
    await vi.waitFor(() => expect(doneCards()).toEqual([true, false, false]));
    const still = screen.getByRole('region', { name: 'DEF review' });
    expect(screen.queryByRole('region', { name: 'GHI review' })).toBeNull();
    expect(within(still).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', true);
    expect(within(still).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('value', 'Keep me.');
  });

  it('should show the last Trade asked for when two Trade reads settle out of order', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready(trades));
    const slow = deferred<ReturnType<typeof ready1>>();
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(((query: { tradeId: string }) => (query.tradeId === 't1' ? slow.promise : Promise.resolve(ready1(tradeReview('t2', 'DEF'))))));
    renderWalk(facade);
    // The first card opens on load and its read is the slow one; the second is pressed before it settles.
    await user.click(await screen.findByRole('button', { name: /^Review DEF\b/ }));
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
    await user.click(within(first).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    const alert = await within(first).findByRole('alert');
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(((query: { tradeId: string }) => (query.tradeId === 't1' ? slow.promise : Promise.resolve(ready1(tradeReview('t2', 'DEF'))))));
    await user.click(within(alert).getByRole('button', { name: 'Refresh' }));
    await user.click(screen.getByRole('button', { name: /^Review DEF\b/ }));
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
    await user.click(within(first).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    const alert = await within(first).findByRole('alert');
    const heldOpen = deferred<Ready>();
    vi.mocked(facade.DailyReview.open).mockReturnValueOnce(heldOpen.promise);
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(((query: { tradeId: string }) => Promise.resolve(ready1(query.tradeId === 't1' ? tradeReview('t1', 'XYZ') : tradeReview('t2', 'DEF')))));
    await user.click(within(alert).getByRole('button', { name: 'Refresh' }));
    await user.click(screen.getByRole('button', { name: /^Review DEF\b/ }));
    // A card pressed while the Review is being asked for is read once that settles, under the binding it returned.
    heldOpen.resolve(ready(trades));
    await screen.findByRole('region', { name: 'DEF review' });
    await new Promise((r) => setTimeout(r, 20));
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
    await user.click(within(first).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    await user.click(screen.getByRole('button', { name: /^Review DEF\b/ }));
    await screen.findByRole('region', { name: 'DEF review' });
    await user.click(screen.getByRole('button', { name: /^Review XYZ\b/ }));
    const again = await screen.findByRole('region', { name: 'XYZ review' });
    await user.click(within(again).getByRole('radio', { name: 'Exit' }));
    await user.type(within(again).getByRole('textbox', { name: INTENT_LABEL }), 'Keep me.');

    held.resolve({ kind: 'Saved', action: savedAction('Hold'), review: post({ kind: 'Trade', trade: tradeReview('t3', 'GHI') }) });

    await vi.waitFor(() => expect(doneCards()).toEqual([true, false, false]));
    expect(screen.queryByRole('region', { name: 'GHI review' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'XYZ review' })).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('value', 'Keep me.');
  });

  it('should drop the after-save message when another card is opened', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready(trades), tradeReview('t1', 'XYZ'), tradeReview('t2', 'DEF'));
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: savedAction('Hold'), review: { kind: 'ChangedDuringAssembly' } });
    renderWalk(facade);
    const first = await openTrade(user, 'XYZ');
    await user.click(within(first).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    expect((await screen.findByRole('status')).textContent).toBe('The Action is saved. Reload the Review to refresh it.');
    await user.click(screen.getByRole('button', { name: /^Review DEF\b/ }));
    await screen.findByRole('region', { name: 'DEF review' });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

type Responses = Extract<SaveDailyReviewResult, { kind: 'Saved' }>['action']['responses'];
// The definition's optional answers as the Journal narrates them (the prompt text, then the answer).
const OPTIONAL_ANSWERS: Responses = [
  { prompt: 'Conviction now', answer: { kind: 'Scale', value: 4 } },
  { prompt: 'Anything you considered doing and decided against?', answer: { kind: 'Text', text: 'Selling the call.' } },
  { prompt: 'Note', answer: { kind: 'Text', text: 'Earnings Thursday.' } },
];
function savedAction(action: string, intent?: string, entryRevision = 1, extra: Responses = []): Extract<SaveDailyReviewResult, { kind: 'Saved' }>['action'] {
  return {
    id: 'e1',
    entryType: 'Daily Trade Review',
    entryTypeKey: 'entry-type.daily-trade-review',
    source: 'Daily Review',
    anchor: { kind: 'Trade', tradeId: 't1' },
    momentTime: '2026-10-12T20:00:00Z',
    authoredTime: '2026-10-12T21:00:00Z',
    responses: [{ prompt: 'Action', answer: { kind: 'Option', label: action } }, ...(intent === undefined ? [] : [{ prompt: DAILY_TRADE_REVIEW_PROMPTS.intent, answer: { kind: 'Text' as const, text: intent } }]), ...extra],
    entryRevision,
    action,
    definitionId: 'def1',
  };
}

// An Outstanding reflection of Trade t1 on the snapshot definition, anchored at the given instant.
function owed(debtId: string, classification: OwedReflection['classification'], economicTime: string, executions: readonly Partial<OwedReflection['executions'][number]>[] = []): OwedReflection {
  return {
    debtId,
    entryType: 'Position Change Reflection',
    definition: reflectionDefinition,
    economicTime,
    executions: executions.map((e, i) => ({ factId: `${debtId}-x${i}`, economicTime, recordedSequence: i + 1, action: 'Buy', instrument: symbol, quantity: '100', price: '50.00', fee: '1.00', ...e })) as unknown as OwedReflection['executions'],
    classification,
    saveBinding: { debtId, debtRevision: `${debtId}-rev-1`, definitionRevision: 'def-pcr-1' },
  };
}

describe('reflections in the Trade card (A71)', () => {
  it('should show a "Reflections" section above the Action form listing the Trade\'s owed reflections with the Position Change\'s date and Executions and "Due", "Due in the next Review", or "Due in the Review after next" as text, and no section when the Trade has none', async () => {
    const user = userEvent.setup();
    const reflections = [
      owed('d1', 'Due', '2026-10-09T14:30:00Z', [{ quantity: '100', price: '50.00' }, { quantity: '20', price: '51.25' }]),
      owed('d2', 'DueInNextReview', '2026-10-12T14:30:00Z', [{ quantity: '5', price: '52.00' }]),
      owed('d3', 'DueInReviewAfterNext', '2026-10-12T15:30:00Z', [{ quantity: '1', price: '53.00' }]),
    ];
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', { reflections }));
    renderWalk(facade);
    const trade = await openTrade(user, 'XYZ');
    // Nothing is due now, so the Action panel is open; the Reflections panel is one press away.
    await user.click(panelHeader(trade, 'Reflections'));

    const section = within(trade).getByRole('region', { name: 'Reflections' });
    const groups = within(section).getAllByRole('group');
    expect(groups.map((g) => g.querySelector('h5')?.textContent)).toEqual(['Fri Oct 9 · Due', 'Mon Oct 12 · Due in the next Review', 'Mon Oct 12 · Due in the Review after next']);
    const rows = groups.map((g) => g.querySelector('li')!);
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('2026-10-09 10:30'),
      expect.stringContaining('2026-10-12 10:30'),
      expect.stringContaining('2026-10-12 11:30'),
    ]);
    expect(within(rows[0]!).getByText('Buy 100 XYZ @ $50.00')).toBeTruthy();
    expect(within(rows[0]!).getByText('Buy 20 XYZ @ $51.25')).toBeTruthy();
    // The Reflections panel sits above the Action panel.
    expect(panelHeader(trade, 'Reflections').compareDocumentPosition(panelHeader(trade, 'Action')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    cleanup();

    const none = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ'));
    renderWalk(none);
    const bare = await openTrade(user, 'XYZ');
    await user.click(panelHeader(bare, 'Reflections'));
    expect(within(bare).queryByRole('region', { name: 'Reflections' })).toBeNull();
  });

  it('should open DebtForm for a reflection and, after Save, render it resolved from the result and move focus to the next reflection in the card, or to the Action form when none remains', async () => {
    const user = userEvent.setup();
    const reflections = [owed('d1', 'Due', '2026-10-09T14:30:00Z', [{}]), owed('d2', 'Due', '2026-10-12T14:30:00Z', [{}])];
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', { reflections }));
    const post = (completion: ReviewCompletion) =>
      ({ kind: 'Ready', cards: [], progress: { tradesWithAction: 0, tradesEligible: 1 }, completion, nextStep: { kind: 'Done' }, binding }) as const;
    const debt = { debtId: 'd1', status: 'Settled', revision: 'd1-rev-2' } as never;
    vi.mocked(facade.DailyReview.save)
      .mockResolvedValueOnce({ kind: 'DebtResolved', decline: { id: 'decl-1', reason: 'No time.' } as never, debt, review: post({ kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: 't1' }] }) })
      .mockResolvedValueOnce({ kind: 'DebtResolved', decline: { id: 'decl-2' } as never, debt, review: post({ kind: 'Complete' }) });
    const report = vi.fn();
    renderWalk(facade, { report });
    const trade = await openTrade(user, 'XYZ');
    await user.click(panelHeader(trade, 'Reflections'));
    const section = within(trade).getByRole('region', { name: 'Reflections' });

    await user.click(within(section).getByRole('button', { name: /Reflect on 2026-10-09 10:30/ }));
    await user.click(within(section).getByRole('button', { name: 'Decline…' }));
    await user.type(within(section).getByLabelText('Why? (optional)'), 'No time.');
    await user.click(within(section).getByRole('button', { name: 'Decline the reflection' }));

    expect(vi.mocked(facade.DailyReview.save)).toHaveBeenLastCalledWith({ kind: 'ResolveReviewDebt', reviewDate: '2026-10-12', binding: reflections[0]!.saveBinding, resolution: { kind: 'Decline', reason: 'No time.' } });
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'DebtResolved' }));
    expect(await within(section).findByText('Declined to reflect. Reason: No time.')).toBeTruthy();
    // The Review's progress renders before the reflection reports resolved, so focus lands a render later.
    await vi.waitFor(() => expect(document.activeElement).toBe(within(section).getByRole('button', { name: /Reflect on 2026-10-12 10:30/ })));
    expect(screen.queryByText('Complete')).toBeNull();

    await user.click(within(section).getByRole('button', { name: /Reflect on 2026-10-12 10:30/ }));
    await user.click(within(section).getByRole('button', { name: 'Decline…' }));
    await user.click(within(section).getByRole('button', { name: 'Decline the reflection' }));

    expect(vi.mocked(facade.DailyReview.save)).toHaveBeenLastCalledWith({ kind: 'ResolveReviewDebt', reviewDate: '2026-10-12', binding: reflections[1]!.saveBinding, resolution: { kind: 'Decline' } });
    expect((await screen.findByText('Complete')).tagName).toBe('STRONG');
    // Nothing remains to resolve, so the Action panel opens and takes focus.
    // "Complete" renders from the Review before the reflection reports resolved, so the panel opens and focus lands a render later.
    await vi.waitFor(() => {
      expect(panelHeader(trade, 'Action').getAttribute('aria-expanded')).toBe('true');
      expect(document.activeElement).toBe(panelHeader(trade, 'Action'));
    });
    expect(within(trade).getByRole('form', { name: 'Action' })).toBeTruthy();
    // The card stays open, with both reflections shown resolved.
    await user.click(panelHeader(trade, 'Reflections'));
    expect(within(section).getAllByRole('region', { name: 'Saved reflection' })).toHaveLength(2);
  });
});

// A card that owes two Marks, a reflection due and a later one, and its Action.
const markRow = (instrumentKey: string): MarkRow => ({ instrumentKey, instrument: { kind: 'Stock', symbol: instrumentKey }, tradingDate: '2026-10-12', trades: ['t1'], resolution: { kind: 'Missing' }, resolutionRevision: 'None', task: 'Manual' });
const owedPair = [owed('d1', 'Due', '2026-10-09T14:30:00Z', [{}]), owed('d2', 'DueInNextReview', '2026-10-12T14:30:00Z', [{}])];
// A card that owes one reflection due now, one later, and its Action (the pair below).
const dueReview = (): Ready =>
  ready([item('t1', 'XYZ')], [], {
    completion: { kind: 'Incomplete', reasons: [{ code: 'ReflectionDue', tradeId: 't1', debtIds: ['d1'] }, { code: 'ActionMissing', tradeId: 't1' }] },
    families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: [{ ...item('t1', 'XYZ'), progress: cardProgress(1, 1, { resolved: 0 }) }] }],
  });
// The card's progress once its due reflection is answered: the later one is still owed.
const afterDue = [{ tradeId: 't1', progress: cardProgress(0, 1, { resolved: 0 }) }];
const panelHeader = (card: HTMLElement, name: 'Marks' | 'Reflections' | 'Action') => within(card).getByRole('button', { name: new RegExp(`^${name}\\b`) });

describe('reflections', () => {
  it('should group the card owed reflections by session date, label each group as text, and resolve one with DebtForm as in D5 A71', async () => {
    const user = userEvent.setup();
    const review = dueReview();
    const facade = walkFacade(review, tradeReview('t1', 'XYZ', { reflections: owedPair }));
    const post = { kind: 'Ready', cards: afterDue, progress: { tradesWithAction: 0, tradesEligible: 1 }, completion: { kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: 't1' }] }, nextStep: { kind: 'Done' }, binding } as const;
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'DebtResolved', decline: { id: 'decl-1', reason: 'No time.' } as never, debt: { debtId: 'd1', status: 'Settled', revision: 'd1-rev-2' } as never, review: post });
    renderWalk(facade);
    const card = await openTrade(user, 'XYZ');

    // The Reflections panel opens first: it is the first panel that is not done.
    expect(panelHeader(card, 'Reflections').getAttribute('aria-expanded')).toBe('true');
    const friday = within(card).getByRole('group', { name: 'Fri Oct 9 · Due' });
    const monday = within(card).getByRole('group', { name: 'Mon Oct 12 · Due in the next Review' });
    expect(friday.compareDocumentPosition(monday) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(friday).getAllByRole('button', { name: /^Reflect on/ })).toHaveLength(1);
    expect(within(monday).getAllByRole('button', { name: /^Reflect on/ })).toHaveLength(1);

    await user.click(within(friday).getByRole('button', { name: /Reflect on 2026-10-09 10:30/ }));
    await user.click(within(friday).getByRole('button', { name: 'Decline…' }));
    await user.type(within(friday).getByLabelText('Why? (optional)'), 'No time.');
    await user.click(within(friday).getByRole('button', { name: 'Decline the reflection' }));

    expect(vi.mocked(facade.DailyReview.save)).toHaveBeenLastCalledWith({ kind: 'ResolveReviewDebt', reviewDate: '2026-10-12', binding: owedPair[0]!.saveBinding, resolution: { kind: 'Decline', reason: 'No time.' } });
    expect(await within(friday).findByText('Declined to reflect. Reason: No time.')).toBeTruthy();
    // Nothing is due now, so the panel moves on; the Monday reflection stays listed and answerable.
    await vi.waitFor(() => expect(panelHeader(card, 'Action').getAttribute('aria-expanded')).toBe('true'));
    await user.click(panelHeader(card, 'Reflections'));
    expect(within(monday).getByRole('button', { name: /Reflect on 2026-10-12 10:30/ })).toBeTruthy();
  });

});

describe('progress from save results (A165, P46)', () => {
  it('should show the progress the Debt resolution result carries, None owed and None once the card last reflection is answered, with no reload', async () => {
    const user = userEvent.setup();
    const review = ready([item('t1', 'XYZ')], [], { families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: [{ ...item('t1', 'XYZ'), progress: cardProgress(1, 1) }] }] });
    const facade = walkFacade(review, tradeReview('t1', 'XYZ', { reflections: owedPair, progress: cardProgress(1, 1) }));
    const post = (progress: ReturnType<typeof cardProgress>) =>
      ({ kind: 'Ready', cards: [{ tradeId: 't1', progress }], progress: { tradesWithAction: 0, tradesEligible: 1 }, completion: { kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: 't1' }] }, nextStep: { kind: 'Done' }, binding }) as const;
    const resolved = (debtId: string, progress: ReturnType<typeof cardProgress>) => ({ kind: 'DebtResolved', decline: { id: `decl-${debtId}` } as never, debt: { debtId, status: 'Settled', revision: `${debtId}-rev-2` } as never, review: post(progress) }) as const;
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce(resolved('d1', cardProgress(0, 1))).mockResolvedValueOnce(resolved('d2', cardProgress(0, 0)));
    renderWalk(facade);
    const card = await openTrade(user, 'XYZ');
    expect(within(panelHeader(card, 'Reflections')).getByText('2 owed, 1 due now')).toBeTruthy();

    await user.click(within(card).getByRole('button', { name: /Reflect on 2026-10-09 10:30/ }));
    await user.click(within(card).getByRole('button', { name: 'Decline…' }));
    await user.click(within(card).getByRole('button', { name: 'Decline the reflection' }));
    expect(await within(card).findByText('Declined to reflect.')).toBeTruthy();

    // The one answered is no longer owed: the same state read fresh shows one owed and none due.
    await vi.waitFor(() => expect(within(panelHeader(card, 'Reflections')).getByText('1 owed, 0 due now')).toBeTruthy());
    expect(within(panelHeader(card, 'Reflections')).getByText('Not due')).toBeTruthy();

    await user.click(panelHeader(card, 'Reflections'));
    await user.click(within(card).getByRole('button', { name: /Reflect on 2026-10-12 10:30/ }));
    await user.click(within(card).getByRole('button', { name: 'Decline…' }));
    await user.click(within(card).getByRole('button', { name: 'Decline the reflection' }));
    await vi.waitFor(() => expect(within(panelHeader(card, 'Reflections')).getByText('None owed')).toBeTruthy());
    expect(within(panelHeader(card, 'Reflections')).getByText('None')).toBeTruthy();
    expect(within(panelHeader(card, 'Reflections')).queryByText('Resolved')).toBeNull();
  });

  it('should show the progress a SaveTradeAction result carries for the saved card on its collapsed header', async () => {
    const user = userEvent.setup();
    const review = ready([item('t1', 'XYZ'), item('t2', 'DEF')], ['t1', 't2']);
    const next = tradeReview('t2', 'DEF');
    const facade = walkFacade(review, tradeReview('t1', 'XYZ'));
    // The completion still names both Actions: only the card progress says the saved card is done.
    const post = { kind: 'Ready', cards: [{ tradeId: 't1', progress: cardProgress(0, 0, { owed: false }) }], progress: { tradesWithAction: 1, tradesEligible: 2 }, completion: review.completion, nextStep: { kind: 'Trade', trade: next }, binding } as const;
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'Saved', action: savedAction('Hold'), review: post });
    renderWalk(facade);
    const card = await openTrade(user, 'XYZ');
    expect(screen.getByRole('button', { name: /^Review XYZ\b/ }).textContent).toContain('Action');

    await user.click(within(card).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));

    await screen.findByRole('region', { name: 'DEF review' });
    const header = screen.getByRole('button', { name: /^Review XYZ\b/ });
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(header.textContent).toContain('Done');
    expect(screen.getByRole('button', { name: /^Review DEF\b/ }).textContent).toContain('Action');
    expect(screen.getByRole('button', { name: /^Review DEF\b/ }).textContent).not.toContain('Done');
  });
});

describe('reflections (continued)', () => {

  it('should move focus into the Reflection form when Reflect on is pressed in a Review card, and back to its button when the form is cancelled', async () => {
    const user = userEvent.setup();
    const review = dueReview();
    renderWalk(walkFacade(review, tradeReview('t1', 'XYZ', { reflections: owedPair })));
    const card = await openTrade(user, 'XYZ');
    const button = () => within(card).getByRole('button', { name: /Reflect on 2026-10-09 10:30/ });

    // Pressed with the keyboard, as a screen reader user would.
    button().focus();
    await user.keyboard('{Enter}');

    const form = within(card).getByRole('form', { name: 'Reflection' });
    expect(document.activeElement).toBe(within(form).getAllByRole('radio')[0]);

    await user.click(within(form).getByRole('button', { name: 'Cancel' }));

    expect(within(card).queryByRole('form', { name: 'Reflection' })).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it('should move focus to Cancel when Reflect on is pressed while the runtime is read only, since every input is disabled', async () => {
    const user = userEvent.setup();
    const review = dueReview();
    renderWalk(walkFacade(review, tradeReview('t1', 'XYZ', { reflections: owedPair })), { writable: false });
    const card = await openTrade(user, 'XYZ');

    await user.click(within(card).getByRole('button', { name: /Reflect on 2026-10-09 10:30/ }));

    const form = within(card).getByRole('form', { name: 'Reflection' });
    expect(document.activeElement).toBe(within(form).getByRole('button', { name: 'Cancel' }));
  });
});

describe('Action (A159)', () => {
  it('should open the Action panel with Hold preselected and one visible Save, which records Hold with no other input', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(dueReview(), tradeReview('t1', 'XYZ', { reflections: owedPair }));
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'Saved', action: savedAction('Hold'), review: { kind: 'Ready', cards: [], progress: { tradesWithAction: 1, tradesEligible: 1 }, completion: { kind: 'Complete' }, nextStep: { kind: 'Done' }, binding } });
    renderWalk(facade);
    const card = await openTrade(user, 'XYZ');

    // The card owes a reflection first; the Action panel opens when its header is pressed.
    await user.click(panelHeader(card, 'Action'));
    expect(within(card).getByRole('radio', { name: 'Hold' })).toHaveProperty('checked', true);
    expect(within(card).getAllByRole('button', { name: /^Save/ }).map((b) => b.textContent)).toEqual(['Save Hold']);
    expect(facade.DailyReview.save).not.toHaveBeenCalled();

    await user.click(within(card).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));

    expect(facade.DailyReview.save).toHaveBeenCalledTimes(1);
    expect(facade.DailyReview.save).toHaveBeenCalledWith({ kind: 'SaveTradeAction', binding: savedBinding({ tradeId: 't1', obligationKey: { entryType: 'DailyTradeReview', trade: 't1', reviewDate: '2026-10-12' } }), action: 'Hold' });
  });
});

// The Marks step is the page's: its grid and its Save Marks are not in any card.
const marksStep = () => screen.getByRole('region', { name: /^Marks for / });

describe('moving on', () => {
  it('should open the next panel that is not done when a panel work is finished, and after an Action save open the card the result names as the next step, collapsing this one', async () => {
    const user = userEvent.setup();
    // T-1 owes a Mark, a reflection due and its Action; T-2 owes its Action.
    const walkedTrades = [item('t1', 'XYZ'), item('t2', 'DEF')].map((t) => ({ ...t, progress: t.tradeId === 't1' ? cardProgress(1, 0, { needed: 1, resolved: 0 }) : cardProgress(0, 0, { resolved: 0 }) }));
    const owing: ReviewCompletion = {
      kind: 'Incomplete',
      reasons: [{ code: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'XYZ' }, tradingDate: '2026-10-12', trades: ['t1'] }, { code: 'ReflectionDue', tradeId: 't1', debtIds: ['d1'] }, { code: 'ActionMissing', tradeId: 't1' }, { code: 'ActionMissing', tradeId: 't2' }],
    };
    const review = ready([item('t1', 'XYZ'), item('t2', 'DEF')], [], { completion: owing, families: [{ family: 'Marks', earlierMarks: [], today: [markRow('XYZ')], earlier: [] }, { family: 'Trades', trades: walkedTrades }] });
    const first = tradeReview('t1', 'XYZ', { reflections: [owed('d1', 'Due', '2026-10-09T14:30:00Z', [{}])] });
    const next = tradeReview('t2', 'DEF');
    const facade = walkFacade(review, first);
    const afterMarks: ReviewCompletion = { kind: 'Incomplete', reasons: owing.kind === 'Incomplete' ? owing.reasons.filter((r) => r.code !== 'MarkMissing') : [] };
    const afterDebt: ReviewCompletion = { kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: 't1' }, { code: 'ActionMissing', tradeId: 't2' }] };
    const atT2: ReviewCompletion = { kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: 't2' }] };
    const keyOf = { instrumentKey: 'XYZ', tradingDate: '2026-10-12' };
    const mark = { revisionId: 'r1', revisionNumber: 1, price: '52.00', source: 'Manual', savedAt: '2026-10-12T21:00:00Z' } as const;
    vi.mocked(facade.DailyReview.save)
      .mockResolvedValueOnce({
        kind: 'MarksSaved',
        marks: [{ key: keyOf, resolution: { kind: 'Available', mark }, resolutionRevision: 1, classification: 'InitialManual' }],
        review: { kind: 'Ready', progress: { tradesWithAction: 0, tradesEligible: 2 }, completion: afterMarks, binding, trades: walkedTrades.map((t) => (t.tradeId === 't1' ? { ...t, progress: cardProgress(1, 0) } : t)), trade: first, nextStep: { kind: 'Trade', trade: first } },
      })
      .mockResolvedValueOnce({ kind: 'DebtResolved', decline: { id: 'decl-1' } as never, debt: { debtId: 'd1', status: 'Settled', revision: 'd1-rev-2' } as never, review: { kind: 'Ready', cards: [{ tradeId: 't1', progress: cardProgress(0, 0) }], progress: { tradesWithAction: 0, tradesEligible: 2 }, completion: afterDebt, nextStep: { kind: 'Done' }, binding } })
      .mockResolvedValueOnce({ kind: 'Saved', action: savedAction('Hold'), review: { kind: 'Ready', cards: [savedCard('t1')], progress: { tradesWithAction: 1, tradesEligible: 2 }, completion: atT2, nextStep: { kind: 'Trade', trade: next }, binding } });
    renderWalk(facade);
    const card = await openTrade(user, 'XYZ');
    const opened = () => (['Reflections', 'Action'] as const).filter((name) => panelHeader(card, name).getAttribute('aria-expanded') === 'true');
    // The Marks are the page's, so the card opens on the reflection due.
    expect(opened()).toEqual(['Reflections']);

    // Save Marks, in the Marks step, leaves the card's panels as they are.
    await user.type(within(marksStep()).getByRole('textbox', { name: /Mark, / }), '52.00');
    await user.click(within(marksStep()).getByRole('button', { name: 'Save Marks (1)' }));
    // The only Mark is in, so the grid folds to its line.
    await vi.waitFor(() => expect(within(marksStep()).getByRole('button', { name: 'Edit' })).toBeTruthy());
    expect(opened()).toEqual(['Reflections']);

    // The last reflection resolved finishes that one: the Action panel opens.
    await user.click(within(card).getByRole('button', { name: /Reflect on 2026-10-09 10:30/ }));
    await user.click(within(card).getByRole('button', { name: 'Decline…' }));
    await user.click(within(card).getByRole('button', { name: 'Decline the reflection' }));
    await vi.waitFor(() => expect(opened()).toEqual(['Action']));

    // The Action save opens the card the result names, and this one collapses.
    await user.click(within(card).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    const other = await screen.findByRole('region', { name: 'DEF review' });
    expect(within(other).getByRole('form', { name: 'Action' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Review XYZ\b/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: /^Review DEF\b/ }).getAttribute('aria-expanded')).toBe('true');
  });
});

// T95.6-B1: Save Marks is page-wide, so the Review it returns lists the first Trade's card; the card the trader has open stays open.
describe('Save Marks from a card that is not first in the new order', () => {
  async function savedFromSecondCard() {
    const user = userEvent.setup();
    const walkedTrades = [item('t1', 'XYZ'), item('t2', 'DEF')].map((t) => ({ ...t, progress: t.tradeId === 't1' ? cardProgress(1, 0, { resolved: 0 }) : cardProgress(0, 0, { resolved: 0 }) }));
    const owing: ReviewCompletion = { kind: 'Incomplete', reasons: [{ code: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'XYZ' }, tradingDate: '2026-10-12', trades: ['t1'] }, { code: 'ActionMissing', tradeId: 't1' }, { code: 'ActionMissing', tradeId: 't2' }] };
    const review = ready([item('t1', 'XYZ'), item('t2', 'DEF')], [], { completion: owing, families: [{ family: 'Marks', earlierMarks: [], today: [markRow('XYZ')], earlier: [] }, { family: 'Trades', trades: walkedTrades }] });
    const first = tradeReview('t1', 'XYZ');
    const second = tradeReview('t2', 'DEF');
    const facade = walkFacade(review, first, first);
    const mark = { revisionId: 'r1', revisionNumber: 1, price: '52.00', source: 'Manual', savedAt: '2026-10-12T21:00:00Z' } as const;
    // The new order puts DEF first: the returned Review carries DEF's card.
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({
      kind: 'MarksSaved',
      marks: [{ key: { instrumentKey: 'XYZ', tradingDate: '2026-10-12' }, resolution: { kind: 'Available', mark }, resolutionRevision: 1, classification: 'InitialManual' }],
      review: { kind: 'Ready', progress: { tradesWithAction: 0, tradesEligible: 2 }, completion: { kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: 't2' }, { code: 'ActionMissing', tradeId: 't1' }] }, binding, trades: [walkedTrades[1]!, { ...walkedTrades[0]!, progress: cardProgress(0, 0, { resolved: 0 }) }], trade: second, nextStep: { kind: 'Trade', trade: second } },
    });
    renderWalk(facade);
    const card = await openTrade(user, 'XYZ');
    return { user, card, facade };
  }

  it('should keep the open card open after Save Marks when it is not first in the new order', async () => {
    const { user } = await savedFromSecondCard();
    await user.type(within(marksStep()).getByRole('textbox', { name: /Mark, / }), '52.00');
    await user.click(within(marksStep()).getByRole('button', { name: 'Save Marks (1)' }));

    await vi.waitFor(() => expect(screen.getByRole('button', { name: /^Review DEF\b/ })).toBeTruthy());
    expect(screen.getByRole('button', { name: /^Review XYZ\b/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /^Review DEF\b/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('region', { name: 'XYZ review' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'DEF review' })).toBeNull();
  });

  it('should keep an unsaved Action draft on that card after Save Marks', async () => {
    const { user, card } = await savedFromSecondCard();
    await user.click(panelHeader(card, 'Action'));
    await user.click(within(card).getByRole('radio', { name: 'Exit' }));
    await user.type(within(marksStep()).getByRole('textbox', { name: /Mark, / }), '52.00');
    await user.click(within(marksStep()).getByRole('button', { name: 'Save Marks (1)' }));

    await vi.waitFor(() => expect(screen.getAllByRole('button', { name: /^Review (DEF|XYZ)\b/ })[0]!.textContent).toMatch(/DEF/));
    await new Promise((resolve) => setTimeout(resolve, 50));
    const after = screen.getByRole('region', { name: 'XYZ review' });
    expect(within(after).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', true);
  });
});

describe('Save Marks from a card that is not first when reading it again fails', () => {
  it('should keep the open card and its drafts when reading it again after Save Marks fails', async () => {
    const user = userEvent.setup();
    const walkedTrades = [item('t1', 'XYZ'), item('t2', 'DEF')].map((t) => ({ ...t, progress: t.tradeId === 't1' ? cardProgress(1, 0, { resolved: 0 }) : cardProgress(0, 0, { resolved: 0 }) }));
    const owing: ReviewCompletion = { kind: 'Incomplete', reasons: [{ code: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'XYZ' }, tradingDate: '2026-10-12', trades: ['t1'] }, { code: 'ActionMissing', tradeId: 't1' }, { code: 'ActionMissing', tradeId: 't2' }] };
    const review = ready([item('t1', 'XYZ'), item('t2', 'DEF')], [], { completion: owing, families: [{ family: 'Marks', earlierMarks: [], today: [markRow('XYZ')], earlier: [] }, { family: 'Trades', trades: walkedTrades }] });
    const first = tradeReview('t1', 'XYZ');
    const second = tradeReview('t2', 'DEF');
    const facade = walkFacade(review, first);
    vi.mocked(facade.DailyReview.getTrade).mockRejectedValueOnce(new Error('read failed'));
    const mark = { revisionId: 'r1', revisionNumber: 1, price: '52.00', source: 'Manual', savedAt: '2026-10-12T21:00:00Z' } as const;
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({
      kind: 'MarksSaved',
      marks: [{ key: { instrumentKey: 'XYZ', tradingDate: '2026-10-12' }, resolution: { kind: 'Available', mark }, resolutionRevision: 1, classification: 'InitialManual' }],
      review: { kind: 'Ready', progress: { tradesWithAction: 0, tradesEligible: 2 }, completion: { kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: 't2' }, { code: 'ActionMissing', tradeId: 't1' }] }, binding, trades: [walkedTrades[1]!, { ...walkedTrades[0]!, progress: cardProgress(0, 0, { resolved: 0 }) }], trade: second, nextStep: { kind: 'Trade', trade: second } },
    });
    renderWalk(facade);
    const card = await openTrade(user, 'XYZ');
    await user.click(panelHeader(card, 'Action'));
    await user.click(within(card).getByRole('radio', { name: 'Exit' }));
    await user.type(within(marksStep()).getByRole('textbox', { name: /Mark, / }), '52.00');
    await user.click(within(marksStep()).getByRole('button', { name: 'Save Marks (1)' }));

    await vi.waitFor(() => expect(screen.getAllByRole('button', { name: /^Review (DEF|XYZ)\b/ })[0]!.textContent).toMatch(/DEF/));
    await vi.waitFor(() => expect(vi.mocked(facade.DailyReview.getTrade)).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(/We couldn’t load this Trade/)).toBeNull();
    const after = screen.getByRole('region', { name: 'XYZ review' });
    expect(within(after).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', true);
  });
});

describe('moving on from Reflections', () => {
  it('should open the next panel that is not done when the card last Due reflection is resolved, though a reflection due in the next Review remains', async () => {
    const user = userEvent.setup();
    const review = dueReview();
    const facade = walkFacade(review, tradeReview('t1', 'XYZ', { reflections: owedPair }));
    const post = { kind: 'Ready', cards: afterDue, progress: { tradesWithAction: 0, tradesEligible: 1 }, completion: { kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: 't1' }] }, nextStep: { kind: 'Done' }, binding } as const;
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'DebtResolved', decline: { id: 'decl-1' } as never, debt: { debtId: 'd1', status: 'Settled', revision: 'd1-rev-2' } as never, review: post });
    renderWalk(facade);
    const card = await openTrade(user, 'XYZ');
    expect(panelHeader(card, 'Reflections').getAttribute('aria-expanded')).toBe('true');

    await user.click(within(card).getByRole('button', { name: /Reflect on 2026-10-09 10:30/ }));
    await user.click(within(card).getByRole('button', { name: 'Decline…' }));
    await user.click(within(card).getByRole('button', { name: 'Decline the reflection' }));

    await vi.waitFor(() => expect(panelHeader(card, 'Action').getAttribute('aria-expanded')).toBe('true'));
    expect(panelHeader(card, 'Reflections').getAttribute('aria-expanded')).toBe('false');
  });
});

describe('a reflection draft when the shell turns read only', () => {
  it('should release the unsaved hold on the card once the shell is read only, as the Action form does', async () => {
    const user = userEvent.setup();
    const refused = { kind: 'RuntimeNotWritable', runtimeReadiness: 'RecoveryOnly', failedChecks: [], workspaceStatus: 'RecoveryOnly', safeActions: [] } as const;
    const review = dueReview();
    const facade = walkFacade(review, tradeReview('t1', 'XYZ', { reflections: owedPair }));
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce(refused);
    renderWalk(facade, { shellLike: true });
    const card = await openTrade(user, 'XYZ');
    await user.click(within(card).getByRole('button', { name: /Reflect on 2026-10-09/ }));
    await user.click(within(card).getByRole('button', { name: 'Decline…' }));
    await user.type(within(within(card).getByRole('region', { name: 'Reflections' })).getByLabelText('Why? (optional)'), 'No time.');
    // A refused Action save turns the shell read only, with the reflection form still holding its value.
    await user.click(panelHeader(card, 'Action'));
    await user.click(within(card).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));

    await vi.waitFor(async () => {
      await user.click(screen.getByRole('button', { name: /^Review XYZ\b/ }));
      expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
    });
    expect(screen.queryByText(/note isn't saved/)).toBeNull();
  });
});

describe('panel headers from progress (A169)', () => {
  it('should read the Reflections panel as 2 owed, 1 due now with 1 due, 1 owed, 0 due now with Not due, and None owed with None', async () => {
    const user = userEvent.setup();
    // The Trade lists no owed reflection and the completion names none: only the progress says what the panel owes.
    for (const [dueNow, later, summary, status] of [
      [1, 1, '2 owed, 1 due now', '1 due'],
      [0, 1, '1 owed, 0 due now', 'Not due'],
      [0, 0, 'None owed', 'None'],
    ] as const) {
      const review = ready([item('t1', 'XYZ')], ['t1'], { families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: [{ ...item('t1', 'XYZ'), progress: cardProgress(dueNow, later) }] }] });
      renderWalk(walkFacade(review, tradeReview('t1', 'XYZ')));
      const card = await openTrade(user, 'XYZ');

      expect(within(panelHeader(card, 'Reflections')).getByText(summary)).toBeTruthy();
      expect(within(panelHeader(card, 'Reflections')).getByText(status)).toBeTruthy();
      cleanup();
    }
  });

  it('should read the Action panel as Needed while owed, and Saved with the saved Action name otherwise', async () => {
    const user = userEvent.setup();
    const saved = { kind: 'Saved', action: savedAction('Roll', 'Move to Nov.') } as const;
    // The form holds a saved Action in both Reviews; only the progress says whether the Action is still owed.
    for (const [owed, status] of [
      [true, 'Needed'],
      [false, 'Saved'],
    ] as const) {
      const review = ready([item('t1', 'XYZ')], [], { families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: [{ ...item('t1', 'XYZ'), progress: cardProgress(0, 0, { owed }) }] }] });
      renderWalk(walkFacade(review, tradeReview('t1', 'XYZ', { form: saved })));
      const card = await openTrade(user, 'XYZ');

      expect(within(panelHeader(card, 'Action')).getByText(status)).toBeTruthy();
      if (!owed) expect(within(panelHeader(card, 'Action')).getByText('Roll')).toBeTruthy();
      cleanup();
    }
  });

  it('should open the card on its first panel whose progress is not done', async () => {
    const user = userEvent.setup();
    // The completion names a Mark missing for T-1 and nothing else, so only the progress says which panel is not done.
    for (const [progress, panel] of [
      [cardProgress(0, 1), 'Action'],
      [cardProgress(1, 0), 'Reflections'],
      // A Mark still to enter is the page's: the card opens on its first panel of its own that is not done.
      [cardProgress(1, 0, { needed: 1 }), 'Reflections'],
    ] as const) {
      const review = ready([item('t1', 'XYZ')], [], {
        completion: { kind: 'Incomplete', reasons: [{ code: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'XYZ' }, tradingDate: '2026-10-12', trades: ['t1'] }] },
        families: [{ family: 'Marks', earlierMarks: [], today: [markRow('XYZ')], earlier: [] }, { family: 'Trades', trades: [{ ...item('t1', 'XYZ'), progress }] }],
      });
      renderWalk(walkFacade(review, tradeReview('t1', 'XYZ', { reflections: [], progress })));
      const card = await openTrade(user, 'XYZ');

      expect((['Reflections', 'Action'] as const).filter((name) => panelHeader(card, name).getAttribute('aria-expanded') === 'true')).toEqual([panel]);
      cleanup();
    }
  });
});

describe('panels (A152)', () => {

  it('should show Reflections and Action panels in that order and no Marks panel, with one open at a time, each header a button with its summary and status as text, and None on Reflections for a card that owes none', async () => {
    const user = userEvent.setup();
    renderWalk(walkFacade(dueReview(), tradeReview('t1', 'XYZ', { reflections: owedPair })));
    const card = await openTrade(user, 'XYZ');

    const [reflections, action] = [panelHeader(card, 'Reflections'), panelHeader(card, 'Action')] as const;
    expect(reflections.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(card).queryByRole('button', { name: /^Marks\b/ })).toBeNull();
    expect(within(reflections).getByText('2 owed, 1 due now')).toBeTruthy();
    expect(within(reflections).getByText('1 due')).toBeTruthy();
    expect(within(action).getByText('Hold, Exit, Roll or Adjust')).toBeTruthy();
    expect(within(action).getByText('Needed')).toBeTruthy();
    // The card opens on its first panel that is not done; pressing another header opens that one and closes this.
    expect([reflections, action].map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'false']);
    expect(within(card).queryByRole('form', { name: 'Action' })).toBeNull();
    await user.click(action);
    expect([reflections, action].map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'true']);
    expect(within(card).getByRole('form', { name: 'Action' })).toBeTruthy();
    cleanup();

    renderWalk(walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ')));
    const bare = await openTrade(user, 'XYZ');
    expect(within(panelHeader(bare, 'Reflections')).getByText('None')).toBeTruthy();
  });
});

// XYZ held 200 shares: the replay a card carries, ending at the Review Date (finished figures; the adapter's own cases are in replay.props.test.ts).
const replaySession = (date: string, price: string, pnl: bigint) => ({
  date,
  positions: [{ instrument: symbol, quantity: Rational.of(200n) }],
  heldQuantity: Rational.of(200n),
  realizedPnl: Rational.of(0n),
  tradePnl: value(pnl),
  change: null,
  marks: [{ instrument: symbol, resolution: { kind: 'Available', mark: { price, revisionNumber: 1, source: 'Manual', savedAt: `${date}T21:30:00Z` } }, change: null }],
  positionChangeIds: [],
  journal: [],
});
const replayTo = (...sessions: ReturnType<typeof replaySession>[]) => ({ tradeId: 't1', instruments: [symbol], sessions, plan: [], pending: null }) as unknown as DailyTradeReview['replay'];
const THURSDAY_AND_MONDAY = replayTo(replaySession('2026-10-08', '50.00', 0n), replaySession('2026-10-12', '52.00', 582n));

describe('Review card: the Replay button (decision 3)', () => {
  it('should open the Replay from the strip, and show no Replay button inside the Action', async () => {
    const user = userEvent.setup();
    renderWalk(walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', { replay: THURSDAY_AND_MONDAY, strip: { sessions: 2, stop: {}, target: {} } })));
    const card = await openTrade(user, 'XYZ');
    // T95.56: the button sits in the card's strip, whichever panel is open, and not in the Action panel.
    const strip = within(card).getByRole('region', { name: 'Replay strip' });
    const actionPanel = within(card).getByRole('form', { name: 'Action' }).parentElement!;
    expect(within(actionPanel).queryByRole('button', { name: 'Replay' })).toBeNull();
    await user.click(within(card).getByRole('button', { name: /^Reflections\b/ }));
    expect(within(card).getByRole('button', { name: /^Reflections\b/ }).getAttribute('aria-expanded')).toBe('true');
    await user.click(within(strip).getByRole('button', { name: 'Replay' }));
    await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    // The entry names the panel that was open, not always the Action's.
    expect(here.address).toContain('panel=Reflections');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(within(strip).getByRole('button', { name: 'Replay' }));
    expect(within(card).queryByRole('region', { name: 'Replay' })).toBeNull();
    expect(within(card).queryByRole('slider', { name: 'Session' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should open the overlay from getTrade replay, resting on the Review Date, and never call replayTrade', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', { replay: THURSDAY_AND_MONDAY }));
    renderWalk(facade);
    const card = await openTrade(user, 'XYZ');
    await user.click(within(card).getByRole('button', { name: 'Replay' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    expect(within(dialog).getByRole('slider', { name: 'Session' }).getAttribute('aria-valuetext')).toBe('Mon Oct 12 · 2 of 2. +$582.00');
    expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1);
    expect(facade.TradeViewsAndReporting.replayTrade).not.toHaveBeenCalled();
  });

  it('should keep the Action form unsaved choice and Intent through opening and closing the overlay, and save nothing by either', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', { replay: THURSDAY_AND_MONDAY }));
    renderWalk(facade);
    const card = await openTrade(user, 'XYZ');
    await user.click(within(card).getByRole('radio', { name: 'Roll' }));
    await user.type(within(card).getByRole('textbox', { name: INTENT_LABEL }), 'Move to Nov.');
    await user.click(within(card).getByRole('button', { name: 'Replay' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    // The form is still on the page under the overlay, as it was.
    expect(within(card).getByRole('radio', { name: 'Roll' })).toHaveProperty('checked', true);
    expect(within(card).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('value', 'Move to Nov.');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(card).getByRole('radio', { name: 'Roll' })).toHaveProperty('checked', true);
    expect(within(card).getByRole('textbox', { name: INTENT_LABEL })).toHaveProperty('value', 'Move to Nov.');
    expect(facade.DailyReview.save).not.toHaveBeenCalled();
  });

  it('should close on Close, on Escape and on the browser Back, staying on the card with its Action panel open and focus on the Replay button', async () => {
    const user = userEvent.setup();
    renderWalk(walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', { replay: THURSDAY_AND_MONDAY })));
    const card = await openTrade(user, 'XYZ');
    const button = within(card).getByRole('button', { name: 'Replay' });
    const before = here.address;
    const closers = [
      () => user.click(screen.getByRole('button', { name: 'Close' })),
      () => user.keyboard('{Escape}'),
      () => browserBack(),
    ];
    for (const close of closers) {
      await user.click(button);
      await screen.findByRole('dialog', { name: 'Replay, XYZ' });
      // Opening pushed one entry that names the overlay.
      expect(here.address).toContain('replay=open');
      await close();
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      // Still on the card with the address as it was; the entry opening pushed is gone, so Back leaves nothing behind.
      expect(here.address).toBe(before);
      expect(here.how).toBe('POP');
      expect(within(card).getByRole('button', { name: /^Action\b/ }).getAttribute('aria-expanded')).toBe('true');
      expect(document.activeElement).toBe(button);
    }
  });

  it('should show the new Mark session in the overlay after Save Marks, from the save result, without reading again', async () => {
    const user = userEvent.setup();
    const walked = { ...item('t1', 'XYZ'), progress: cardProgress(0, 0, { needed: 1, resolved: 0 }) };
    const review = ready([walked], [], { families: [{ family: 'Marks', earlierMarks: [], today: [markRow('XYZ')], earlier: [] }, { family: 'Trades', trades: [walked] }] });
    const before = tradeReview('t1', 'XYZ', { progress: walked.progress, replay: replayTo(replaySession('2026-10-08', '50.00', 0n)) });
    const after = tradeReview('t1', 'XYZ', { replay: THURSDAY_AND_MONDAY });
    const facade = walkFacade(review, before);
    const mark = { revisionId: 'r1', revisionNumber: 1, price: '52.00', source: 'Manual', savedAt: '2026-10-12T21:00:00Z' } as const;
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({
      kind: 'MarksSaved',
      marks: [{ key: { instrumentKey: 'XYZ', tradingDate: '2026-10-12' }, resolution: { kind: 'Available', mark }, resolutionRevision: 1, classification: 'InitialManual' }],
      review: { kind: 'Ready', progress: { tradesWithAction: 0, tradesEligible: 1 }, completion: { kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: 't1' }] }, binding, trades: [{ ...walked, progress: cardProgress(0, 0, { resolved: 1 }) }], trade: after, nextStep: { kind: 'Trade', trade: after } },
    });
    renderWalk(facade);
    const card = await openTrade(user, 'XYZ');
    await user.type(within(marksStep()).getByRole('textbox', { name: /Mark, / }), '52.00');
    await user.click(within(marksStep()).getByRole('button', { name: 'Save Marks (1)' }));
    await user.click(await within(card).findByRole('button', { name: 'Replay' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe('XYZ · Trade P&L +$582.00');
    expect(within(dialog).getByRole('slider', { name: 'Session' }).getAttribute('aria-valuetext')).toBe('Mon Oct 12 · 2 of 2. +$582.00');
    expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1);
  });

  it('should link Price History in the overlay to the Trade Detail with the drawer, the session and from=review', async () => {
    const user = userEvent.setup();
    renderWalk(walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', { replay: THURSDAY_AND_MONDAY })));
    await user.click(within(await openTrade(user, 'XYZ')).getByRole('button', { name: 'Replay' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    expect(within(dialog).getByRole('link', { name: 'Price History' }).getAttribute('href')).toBe('/trades/t1?drawer=price-history&session=2026-10-12&from=review&panel=Action');
    // The link follows the slider, and the overlay offers no link to the Journal or the Position here.
    await user.click(within(dialog).getByRole('button', { name: 'Previous session' }));
    expect(within(dialog).getByRole('link', { name: 'Price History' }).getAttribute('href')).toBe('/trades/t1?drawer=price-history&session=2026-10-08&from=review&panel=Action');
    expect(within(dialog).queryByRole('link', { name: 'Journal' })).toBeNull();
    expect(within(dialog).queryByRole('link', { name: 'Position' })).toBeNull();
  });

  it('should carry the open panel on the Price History link, Reflections here', async () => {
    renderWalk(walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', { replay: THURSDAY_AND_MONDAY })), { address: '/review?trade=t1&panel=Reflections&replay=open' });
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    expect(within(dialog).getByRole('link', { name: 'Price History' }).getAttribute('href')).toBe('/trades/t1?drawer=price-history&session=2026-10-12&from=review&panel=Reflections');
  });

  it('should still carry Action on the Price History link when the Replay was opened from Action', async () => {
    const user = userEvent.setup();
    renderWalk(walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', { replay: THURSDAY_AND_MONDAY })));
    await user.click(within(await openTrade(user, 'XYZ')).getByRole('button', { name: 'Replay' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    expect(within(dialog).getByRole('link', { name: 'Price History' }).getAttribute('href')).toBe('/trades/t1?drawer=price-history&session=2026-10-12&from=review&panel=Action');
  });

  it("should keep each card's Price History link once the Marks are saved and the grid is folded", async () => {
    const user = userEvent.setup();
    const walked = { ...item('t1', 'XYZ'), progress: cardProgress(0, 0, { needed: 1, resolved: 0 }) };
    const review = ready([walked], [], { families: [{ family: 'Marks', earlierMarks: [], today: [markRow('XYZ')], earlier: [] }, { family: 'Trades', trades: [walked] }] });
    const before = tradeReview('t1', 'XYZ', { progress: walked.progress, replay: replayTo(replaySession('2026-10-08', '50.00', 0n)) });
    const after = tradeReview('t1', 'XYZ', { replay: THURSDAY_AND_MONDAY });
    const facade = walkFacade(review, before);
    const mark = { revisionId: 'r1', revisionNumber: 1, price: '52.00', source: 'Manual', savedAt: '2026-10-12T21:00:00Z' } as const;
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({
      kind: 'MarksSaved',
      marks: [{ key: { instrumentKey: 'XYZ', tradingDate: '2026-10-12' }, resolution: { kind: 'Available', mark }, resolutionRevision: 1, classification: 'InitialManual' }],
      review: { kind: 'Ready', progress: { tradesWithAction: 0, tradesEligible: 1 }, completion: { kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: 't1' }] }, binding, trades: [{ ...walked, progress: cardProgress(0, 0, { resolved: 1 }) }], trade: after, nextStep: { kind: 'Trade', trade: after } },
    });
    renderWalk(facade);
    const card = await openTrade(user, 'XYZ');
    await user.type(within(marksStep()).getByRole('textbox', { name: /Mark, / }), '52.00');
    await user.click(within(marksStep()).getByRole('button', { name: 'Save Marks (1)' }));
    // The only Mark is in, so the grid folds to its line, which holds no Price History link.
    await vi.waitFor(() => expect(within(marksStep()).getByRole('button', { name: 'Edit' })).toBeTruthy());
    expect(within(marksStep()).queryByRole('link', { name: 'Price History' })).toBeNull();
    // The card's own Replay still offers it.
    await user.click(await within(card).findByRole('button', { name: 'Replay' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    expect(within(dialog).getByRole('link', { name: 'Price History' }).getAttribute('href')).toBe('/trades/t1?drawer=price-history&session=2026-10-12&from=review&panel=Action');
  });

  it('should reopen the overlay on the named session when the address names the card with replay=open', async () => {
    const user = userEvent.setup();
    // Two cards: the first not done would open by itself, so the card named is the one that opens, with its overlay.
    renderWalk(walkFacade(ready([item('t2', 'ABC'), item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', { replay: THURSDAY_AND_MONDAY })), { address: '/review?trade=t1&panel=Action&replay=open&session=2026-10-08' });
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    expect(within(dialog).getByRole('slider', { name: 'Session' }).getAttribute('aria-valuetext')).toBe('Thu Oct 8 · 1 of 2. $0.00');
    const card = screen.getByRole('region', { name: 'XYZ review' });
    expect(within(card).getByRole('button', { name: /^Action\b/ }).getAttribute('aria-expanded')).toBe('true');
    // This visit pushed nothing, so Close replaces the address without `replay`, the card stays, and the Replay button holds focus.
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(here.address).toBe('/review?trade=t1&panel=Action&session=2026-10-08');
    expect(here.how).toBe('REPLACE');
    expect(document.activeElement).toBe(within(card).getByRole('button', { name: 'Replay' }));
    // Reopened, it rests on the session the slider was on.
    await user.click(within(card).getByRole('button', { name: 'Replay' }));
    expect(within(await screen.findByRole('dialog', { name: 'Replay, XYZ' })).getByRole('slider', { name: 'Session' }).getAttribute('aria-valuetext')).toBe('Thu Oct 8 · 1 of 2. $0.00');
  });

  it('should keep a started Action when the Review is left for Price History and read again on the way back', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    renderWalk(walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', { replay: THURSDAY_AND_MONDAY })));
    const card = await openTrade(user, 'XYZ');
    await user.click(within(card).getByRole('radio', { name: 'Exit' }));
    await user.type(within(card).getByRole('textbox', { name: `${INTENT_PROMPT} (required)` }), 'Take the profit.');
    await user.click(within(card).getByRole('button', { name: 'Replay' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Replay, XYZ' })).getByRole('link', { name: 'Price History' }));
    // The Review leaves the page and is read again from the address the way back names.
    cleanup();
    const facade = walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', { replay: THURSDAY_AND_MONDAY }));
    vi.mocked(facade.DailyReview.save).mockImplementation(save);
    renderWalk(facade, { address: '/review?trade=t1&panel=Action&replay=open&session=2026-10-08' });
    await user.click(within(await screen.findByRole('dialog', { name: 'Replay, XYZ' })).getByRole('button', { name: 'Close' }));
    const back = await screen.findByRole('region', { name: 'XYZ review' });
    expect(within(back).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', true);
    expect(within(back).getByRole('textbox', { name: `${INTENT_PROMPT} (required)` })).toHaveProperty('value', 'Take the profit.');
    // The trip itself recorded nothing.
    expect(save).not.toHaveBeenCalled();
  });

  it('should show the saved Action, not an earlier draft, after a Ctrl click on Price History, a Save, and a switch to another card and back', async () => {
    const user = userEvent.setup();
    const first = tradeReview('t1', 'XYZ', { replay: THURSDAY_AND_MONDAY });
    const next = tradeReview('t2', 'DEF');
    const again = tradeReview('t1', 'XYZ', { form: { kind: 'Saved', action: savedAction('Exit', 'Take it all.', 2) }, saveBinding: savedBinding({ expectedEntryRevision: 2 }) });
    const facade = walkFacade(ready([item('t1', 'XYZ'), item('t2', 'DEF')]), first, again);
    vi.mocked(facade.DailyReview.save).mockResolvedValue({
      kind: 'Saved',
      action: savedAction('Exit', 'Take it all.', 2),
      review: { kind: 'Ready', cards: [savedCard('t1')], progress: { tradesWithAction: 1, tradesEligible: 2 }, completion: { kind: 'Incomplete', reasons: [{ code: 'ActionMissing', tradeId: 't2' }] }, nextStep: { kind: 'Trade', trade: next }, binding },
    });
    renderWalk(facade);
    const card = await openTrade(user, 'XYZ');
    await user.click(within(card).getByRole('radio', { name: 'Exit' }));
    await user.type(within(card).getByRole('textbox', { name: `${INTENT_PROMPT} (required)` }), 'Take the profit.');
    await user.click(within(card).getByRole('button', { name: 'Replay' }));
    const link = within(await screen.findByRole('dialog', { name: 'Replay, XYZ' })).getByRole('link', { name: 'Price History' });
    // A Ctrl click leaves the Review on screen.
    await user.keyboard('{Control>}');
    await user.click(link);
    await user.keyboard('{/Control}');
    await user.click(within(screen.getByRole('dialog', { name: 'Replay, XYZ' })).getByRole('button', { name: 'Close' }));
    await user.click(within(card).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    await screen.findByRole('region', { name: 'DEF review' });
    const back = await openTrade(user, 'XYZ');
    // The Action shows as saved; the earlier draft is not on the card as an unsaved change.
    expect(within(back).getByText(/“Take it all\.”$/)).toBeTruthy();
    expect(within(back).queryByRole('textbox', { name: INTENT_LABEL })).toBeNull();
    expect(within(back).queryByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ })).toBeNull();
  });

  it('should not bring a started Action back when the Review was left some other way', async () => {
    const user = userEvent.setup();
    renderWalk(walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ')));
    const card = await openTrade(user, 'XYZ');
    await user.click(within(card).getByRole('radio', { name: 'Exit' }));
    await user.type(within(card).getByRole('textbox', { name: `${INTENT_PROMPT} (required)` }), 'Take the profit.');
    cleanup();
    renderWalk(walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ')));
    const back = await openTrade(user, 'XYZ');
    expect(within(back).getByRole('radio', { name: 'Hold' })).toHaveProperty('checked', true);
    expect(within(back).getByRole('textbox', { name: `${INTENT_PROMPT} (optional)` })).toHaveProperty('value', '');
  });

  it('should open the overlay over the Action panel even when the address still names an Instrument', async () => {
    const user = userEvent.setup();
    const walked = { ...item('t1', 'XYZ'), progress: cardProgress(0, 0, { needed: 1, resolved: 0 }) };
    const review = ready([walked], ['t1'], { families: [{ family: 'Marks', earlierMarks: [], today: [markRow('XYZ')], earlier: [] }, { family: 'Trades', trades: [walked] }] });
    renderWalk(walkFacade(review, tradeReview('t1', 'XYZ', { progress: walked.progress, replay: THURSDAY_AND_MONDAY })), { address: '/review?trade=t1&instrument=XYZ' });
    const card = await screen.findByRole('region', { name: 'XYZ review' });
    await user.click(within(card).getByRole('button', { name: /^Action\b/ }));
    await user.click(within(card).getByRole('button', { name: 'Replay' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    expect(within(card).getByRole('button', { name: /^Action\b/ }).getAttribute('aria-expanded')).toBe('true');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(card).getByRole('button', { name: /^Action\b/ }).getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(within(card).getByRole('button', { name: 'Replay' }));
  });

  it('should keep the card the trader opened by its header when the overlay closes back to an older address', async () => {
    const user = userEvent.setup();
    const t1 = item('t1', 'XYZ');
    const t2 = item('t2', 'ABC');
    renderWalk(walkFacade(ready([t1, t2]), tradeReview('t1', 'XYZ'), tradeReview('t2', 'ABC', { replay: THURSDAY_AND_MONDAY })), { address: '/review?trade=t1&panel=Action' });
    const card = await openTrade(user, 'ABC');
    await user.click(within(card).getByRole('button', { name: 'Replay' }));
    const dialog = await screen.findByRole('dialog', { name: /^Replay/ });
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('region', { name: 'ABC review' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
  });

  it('should open the card the address names when a history move changes both the card and the overlay', async () => {
    const user = userEvent.setup();
    const review = ready([item('t1', 'XYZ'), item('t2', 'ABC')]);
    const facade = walkFacade(review);
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ tradeId }) =>
      Promise.resolve({ kind: 'Ready', reviewDate: '2026-10-12', cutoff: review.cutoff, trade: tradeReview(tradeId, tradeId === 't1' ? 'XYZ' : 'ABC', { replay: THURSDAY_AND_MONDAY }) }),
    );
    renderWalk(facade, { address: '/review?trade=t1&panel=Action' });
    await user.click(within(await screen.findByRole('region', { name: 'XYZ review' })).getByRole('button', { name: 'Replay' }));
    await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    await act(() => {
      here.push?.('/review?trade=t2&panel=Action');
      return Promise.resolve();
    });
    await screen.findByRole('region', { name: 'ABC review' });
    // Back lands on the entry that holds the first card's overlay: that card and its overlay are the ones shown.
    await browserBack();
    expect(await screen.findByRole('dialog', { name: 'Replay, XYZ' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'XYZ review' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'ABC review' })).toBeNull();
    // Forward goes to the second card, whose address holds no overlay.
    await act(() => {
      here.go?.(1);
      return Promise.resolve();
    });
    expect(await screen.findByRole('region', { name: 'ABC review' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should go back one entry on the second Close after Replay, Close, Forward', async () => {
    const user = userEvent.setup();
    renderWalk(walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', { replay: THURSDAY_AND_MONDAY })));
    const card = await openTrade(user, 'XYZ');
    const before = here.address;
    await user.click(within(card).getByRole('button', { name: 'Replay' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Replay, XYZ' })).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await act(() => {
      here.go?.(1);
      return Promise.resolve();
    });
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(here.address).toBe(before);
    expect(here.how).toBe('POP');
    // No extra closed entry is left: one more Back stays where it was.
    await browserBack();
    expect(here.address).toBe(before);
  });

  it('should show the strip on a card that owes only a reflection, and none on a card whose Trade facts cannot be replayed', async () => {
    const user = userEvent.setup();
    const progress = reflectionsOwedProgress(1, 0);
    const owed = { tradeId: 't9', underlying: 'ABC', lifecycle: 'Closed', labels: { strategy: 'Long Stock', account: 'Main', institution: 'Broker' }, reflections: [], progress, replay: THURSDAY_AND_MONDAY, strip: { sessions: 2, low: { date: '2026-10-08', value: Rational.of(0n) }, stop: {}, target: {} } } as unknown as OwedReflectionsCard;
    const review = ready([item('t1', 'XYZ')], [], { owed: [{ tradeId: 't9', underlying: 'ABC', lifecycle: 'Closed', owed: [], progress }] });
    const facade = walkFacade(review);
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ tradeId }) =>
      Promise.resolve(tradeId === 't9' ? { kind: 'ReflectionsOwed', reviewDate: '2026-10-12', cutoff: review.cutoff, card: owed } : { kind: 'Ready', reviewDate: '2026-10-12', cutoff: review.cutoff, trade: tradeReview('t1', 'XYZ') }),
    );
    renderWalk(facade);
    const owedCard = await openTrade(user, 'ABC');
    expect(within(owedCard).getByRole('button', { name: /^Reflections\b/ })).toBeTruthy();
    // Decision 136: the owed card carries its Trade's replay, so its strip says the sessions and the low, and the button opens the Replay.
    const strip = within(owedCard).getByRole('region', { name: 'Replay strip' });
    expect(within(strip).getByText('2 sessions · low $0.00 on Thu Oct 8. Walk it before you write.')).toBeTruthy();
    await user.click(within(strip).getByRole('button', { name: 'Replay' }));
    await screen.findByRole('dialog', { name: 'Replay, ABC' });
    expect(here.address).toContain('panel=Reflections');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(within(strip).getByRole('button', { name: 'Replay' }));
    // A card with no replay in its Trade keeps its other panels and the Action form.
    const card = await openTrade(user, 'XYZ');
    expect(within(card).queryByRole('button', { name: 'Replay' })).toBeNull();
    for (const name of ['Reflections', 'Action']) expect(within(card).getByRole('button', { name: new RegExp(`^${name}\\b`) })).toBeTruthy();
    expect(within(card).getByRole('form', { name: 'Action' })).toBeTruthy();
  });
});

// T95.57, A318: the Replay opens on the session of the first crossing of the line the Trade is past now, and on the newest session otherwise.
const crossed = (first: string, since?: string) => ({ conditions: [], first: { date: first, afterGap: false }, ...(since && { since: { date: since, afterGap: false } }) });
const withCrossings = (dates: readonly string[], last: { stop?: ReturnType<typeof crossed>; target?: ReturnType<typeof crossed> }) =>
  replayTo(...dates.map((date, i) => ({ ...replaySession(date, '50.00', 0n), ...(i === dates.length - 1 && { crossings: { stop: last.stop ?? { conditions: [] }, target: last.target ?? { conditions: [] } } }) })));
const FOUR_DAYS = ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12'];

describe('Review card: where the Replay opens (T95.57, A318)', () => {
  const opened = async (replay: DailyTradeReview['replay']) => {
    const user = userEvent.setup();
    renderWalk(walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', { replay })));
    const card = await openTrade(user, 'XYZ');
    await user.click(within(card).getByRole('button', { name: 'Replay' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    return within(dialog).getByRole('slider', { name: 'Session' }).getAttribute('aria-valuetext')!;
  };

  it('should open from a Review card on the session of the first crossing when the Trade is past a line, and on the newest session otherwise', async () => {
    // Past the Stop now, first crossed on Thu Oct 8 and held there since Fri Oct 9: the Replay opens on Thu Oct 8, in the address too.
    expect(await opened(withCrossings(FOUR_DAYS, { stop: crossed('2026-10-08', '2026-10-09') }))).toMatch(/^Thu Oct 8 · 2 of 4/);
    expect(here.address).toContain('session=2026-10-08');
    cleanup();
    // Past the Target now: the Target's first crossing.
    expect(await opened(withCrossings(FOUR_DAYS, { target: crossed('2026-10-09', '2026-10-12') }))).toMatch(/^Fri Oct 9 · 3 of 4/);
    cleanup();
    // The Stop was crossed once and the Trade is back inside: nothing is past a line now, so the newest session.
    expect(await opened(withCrossings(FOUR_DAYS, { stop: crossed('2026-10-08') }))).toMatch(/^Mon Oct 12 · 4 of 4/);
    expect(here.address).not.toContain('session=');
  });
});

describe('The last decision line', () => {
  const decisions: NonNullable<DailyTradeReview['decisions']> = {
    recent: [{ date: '2026-10-09', action: 'Hold', reason: 'Up today. One more day.', tradePnl: value(-930n) }],
    earlier: 0,
    sessionsWithoutReview: [],
  };

  it('should show the card top line only where the list is not shown', async () => {
    const user = userEvent.setup();
    // Marks still to enter: the Action waits, so no list is shown and the top line says the last decision.
    const waiting = { ...item('t1', 'XYZ'), progress: cardProgress(0, 0, { needed: 1, resolved: 0 }) };
    const review = ready([waiting], [], { families: [{ family: 'Marks', earlierMarks: [], today: [markRow('XYZ')], earlier: [] }, { family: 'Trades', trades: [waiting] }] });
    renderWalk(walkFacade(review, tradeReview('t1', 'XYZ', { progress: waiting.progress, decisions: { ...decisions, sessionsWithoutReview: ['2026-10-12'] } })));
    const card = await openTrade(user, 'XYZ');
    expect(within(card).getByText('Fri Oct 9 you chose Hold: “Up today. One more day.”')).toBeTruthy();
    expect(within(card).getByText('No Review Mon Oct 12.')).toBeTruthy();
    expect(within(card).queryByRole('region', { name: 'Your last decisions' })).toBeNull();
    cleanup();

    // Marks in: the list sits by the Action and the top line stays out, so the decision is said once.
    renderWalk(walkFacade(ready([item('t1', 'XYZ')]), tradeReview('t1', 'XYZ', { decisions })));
    const open = await openTrade(user, 'XYZ');
    expect(within(open).getByRole('region', { name: 'Your last decisions' })).toBeTruthy();
    expect(within(open).queryByText(/you chose/)).toBeNull();
  });

  it('should show the card top line when Reflections is the open panel and the Action panel is closed', async () => {
    const user = userEvent.setup();
    const review = dueReview();
    renderWalk(walkFacade(review, tradeReview('t1', 'XYZ', { reflections: owedPair, progress: cardProgress(1, 1, { resolved: 0 }), decisions })));
    const card = await openTrade(user, 'XYZ');
    expect(panelHeader(card, 'Reflections').getAttribute('aria-expanded')).toBe('true');
    expect(panelHeader(card, 'Action').getAttribute('aria-expanded')).toBe('false');
    expect(within(card).getByText('Fri Oct 9 you chose Hold: “Up today. One more day.”')).toBeTruthy();
    // Opening the Action panel moves the decision to the list, so it is said once.
    await user.click(panelHeader(card, 'Action'));
    expect(within(card).getByRole('region', { name: 'Your last decisions' })).toBeTruthy();
    expect(within(card).queryByText(/you chose/)).toBeNull();
  });
});

describe('The card before its Marks (T95.20)', () => {
  const gone = { kind: 'Unavailable', reason: 'MarkMissing', instrument: symbol, date: '2026-10-12' };
  // Marks still to enter for the Review Date: the walked card says one to go, and the Trade's figures are the session before's.
  async function openWaiting(toGo = 1, writable = true) {
    const user = userEvent.setup();
    const progress = cardProgress(0, 0, { needed: toGo, resolved: 0 });
    const waiting = { ...item('t1', 'XYZ'), progress };
    const review = ready([waiting], [], { families: [{ family: 'Marks', earlierMarks: [], today: [markRow('XYZ')], earlier: [] }, { family: 'Trades', trades: [waiting] }] });
    const trade = tradeReview('t1', 'XYZ', {
      progress,
      evaluation: evaluation({ currentMarkedPnl: gone, observation: { instrument: symbol, tradingDate: '2026-10-12', mark: null } }),
      datedLastClose: { tradingDate: '2026-10-09', evaluation: evaluation({ valuationDate: '2026-10-09' }) },
    });
    const facade = walkFacade(review, trade);
    renderWalk(facade, { writable });
    return { user, facade, card: await openTrade(user, 'XYZ') };
  }

  it('should say the figures wait for todays Marks and show the session before', async () => {
    const { card } = await openWaiting();
    expect(within(card).getByText("Figures wait for today's Marks. Below: at the Fri Oct 9 Marks.")).toBeTruthy();
    expect(within(card).getByRole('heading', { name: 'At the Fri Oct 9 Marks' })).toBeTruthy();
  });

  it('should show the Action form once the Trades Marks are saved or marked Cant get a price', async () => {
    // Nothing left to enter: saved Marks, or a Mark acknowledged as no price, both leave none to go. The figures may still be the session before's.
    const { card } = await openWaiting(0);
    expect(within(card).getByRole('form', { name: 'Action' })).toBeTruthy();
    expect(within(card).queryByText(/No Action until/)).toBeNull();
    expect(within(card).queryByText(/Figures wait/)).toBeNull();
  });

  it('should show the same words if a save comes back ReviewMarksUnresolved', async () => {
    const { user, facade, card } = await openWaiting(0);
    vi.mocked(facade.DailyReview.save).mockResolvedValueOnce({ kind: 'Rejected', issues: [{ code: 'ReviewMarksUnresolved', instruments: [symbol, { kind: 'Stock', symbol: 'ABC' }] }] });
    await user.click(within(card).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    expect((await within(card).findByText("No Action until today's Marks are in.", { exact: false })).textContent).toBe("No Action until today's Marks are in. Enter them");
    expect(within(card).queryByRole('form', { name: 'Action' })).toBeNull();
    expect(within(card).queryByText(/could not be saved/)).toBeNull();
  });

  it('should show No Action until todays Marks are in in place of the Action form with a link to the Marks step', async () => {
    const { user, card } = await openWaiting(2);
    expect(within(card).getByText("No Action until today's Marks are in.", { exact: false }).textContent).toBe("No Action until today's Marks are in. Enter them");
    expect(within(card).queryByRole('form', { name: 'Action' })).toBeNull();
    expect(within(card).queryByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ })).toBeNull();
    await user.click(within(card).getByRole('link', { name: 'Enter them' }));
    expect(here.address).toBe('/review?trade=t1&panel=Marks');
    cleanup();

    const one = await openWaiting(1);
    expect(within(one.card).getByText("No Action until today's Mark is in.", { exact: false }).textContent).toBe("No Action until today's Mark is in. Enter it");
    expect(within(one.card).getByRole('link', { name: 'Enter it' })).toBeTruthy();
  });

  it('should show No Action saved with no link while the runtime is not writable and Marks are still to go', async () => {
    const { card } = await openWaiting(1, false);
    expect(within(card).getByText('No Action saved.')).toBeTruthy();
    expect(within(card).queryByText(/No Action until today/)).toBeNull();
    expect(within(card).queryByRole('link', { name: 'Enter it' })).toBeNull();
  });
});

// T95.41: an Exit chosen earlier and not carried out: the card says so first, with the two ways to answer (A313, W129).
describe('An Exit not carried out (T95.41)', () => {
  const exit = { reviewDate: '2026-10-09', action: 'Exit', reason: 'Take the money.' };
  const planExitOf = (quantity: string) => ({ positions: [{ instrument: symbol, quantity, conditions: [] }], heldPast: [] }) as DailyTradeReview['planExit'];
  async function openExited(over: { readonly carry?: ReviewTradeItem['exitCarry']; readonly lastAction?: ReviewTradeItem['lastAction']; readonly toGo?: number; readonly form?: DailyTradeReview['form']; readonly onDirtyChange?: (dirty: boolean) => void; readonly writable?: boolean; readonly item?: Partial<ReviewTradeItem> } = {}) {
    const user = userEvent.setup();
    const progress = cardProgress(0, 0, { needed: over.toGo ?? 0, resolved: 0 });
    const exited = { ...item('t1', 'XYZ', { band: 'ExitNotCarriedOut', reasons: [{ code: 'ExitNotCarriedOut' }], lastAction: over.lastAction ?? exit, ...('carry' in over ? (over.carry && { exitCarry: over.carry }) : { exitCarry: { direction: 'Long' as const, held: Rational.of(2n) } }), ...over.item }), progress };
    const review = ready([exited], [], { families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: [exited] }] });
    const trade = tradeReview('t1', 'XYZ', { attention: exited, progress, planExit: planExitOf('2'), form: over.form ?? { kind: 'New', viewState: {} } });
    const facade = exitFormFacade();
    vi.mocked(facade.DailyReview.open).mockResolvedValue(review);
    vi.mocked(facade.DailyReview.getTrade).mockResolvedValue({ kind: 'Ready', reviewDate: '2026-10-12', cutoff: review.cutoff, trade });
    renderWalk(facade, { ...(over.onDirtyChange && { onDirtyChange: over.onDirtyChange }), ...(over.writable !== undefined && { writable: over.writable }) });
    return { user, facade, card: await openTrade(user, 'XYZ') };
  }

  it('should say first on the card that an Exit was chosen, on which day, and what is still held', async () => {
    const { card } = await openExited();
    const banner = within(card).getByRole('group', { name: 'Exit not carried out' });
    expect(banner.textContent).toContain('You chose Exit on Fri Oct 9. Still holding 2.');
    expect(card.firstElementChild).toBe(banner);
    expect(banner.textContent).not.toMatch(/since/);
  });

  it('should open the sale form on I sold: record it, with its Marks still to enter', async () => {
    const { user, card } = await openExited({ toGo: 1 });
    expect(within(card).getByText("No Action until today's Mark is in.", { exact: false })).toBeTruthy();
    await user.click(within(within(card).getByRole('group', { name: 'Exit not carried out' })).getByRole('button', { name: 'I sold: record it' }));
    expect(await within(card).findByRole('group', { name: 'Execution 1' })).toBeTruthy();
    expect(within(card).getByText('Back to the Review')).toBeTruthy();
  });

  it('should put focus on I sold: record it after Cancel on a sale opened by it', async () => {
    const { user, card } = await openExited();
    const banner = within(card).getByRole('group', { name: 'Exit not carried out' });
    await user.click(within(banner).getByRole('button', { name: 'I sold: record it' }));
    await user.click(await within(card).findByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(within(card).getByRole('group', { name: 'Exit not carried out' }).querySelector('button'));
    expect(document.activeElement?.textContent).toBe('I sold: record it');
  });

  it('should keep the ordinary sale form default time outside the expiration block', async () => {
    const { user, card } = await openExited();
    await user.click(within(within(card).getByRole('group', { name: 'Exit not carried out' })).getByRole('button', { name: 'I sold: record it' }));
    expect((await within(card).findByLabelText<HTMLInputElement>('Economic Time')).value).toBe('2026-10-12T17:00');
  });

  it('should open the sale form from I sold: record it on the day card', async () => {
    const { user, card } = await openExited({ toGo: 1 });
    const day = screen.getByRole('region', { name: 'The day' });
    expect(within(card).queryByRole('group', { name: 'Execution 1' })).toBeNull();
    await user.click(within(within(day).getByRole('group', { name: 'Exit not carried out: XYZ' })).getByRole('button', { name: 'I sold: record it' }));
    expect(await within(card).findByRole('group', { name: 'Execution 1' })).toBeTruthy();
  });

  it('should keep the page unsaved when the sale form is opened over an Action draft', async () => {
    const onDirtyChange = vi.fn();
    const { user, card } = await openExited({ onDirtyChange });
    await user.type(within(card).getByRole('textbox', { name: INTENT_LABEL }), 'Not yet.');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.click(within(within(card).getByRole('group', { name: 'Exit not carried out' })).getByRole('button', { name: 'I sold: record it' }));
    expect(await within(card).findByRole('group', { name: 'Execution 1' })).toBeTruthy();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    // Back to the Review shows the Action draft as it was.
    await user.click(within(card).getByText('Back to the Review'));
    expect(within(card).getByRole<HTMLTextAreaElement>('textbox', { name: INTENT_LABEL }).value).toBe('Not yet.');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it('should disable I sold: record it on the card and the day card while the runtime is read only', async () => {
    const { card } = await openExited({ writable: false });
    const day = screen.getByRole('region', { name: 'The day' });
    const sold = (scope: HTMLElement, name: string) => within(within(scope).getByRole('group', { name })).getByRole<HTMLButtonElement>('button', { name: 'I sold: record it' });
    expect(sold(card, 'Exit not carried out').disabled).toBe(true);
    expect(sold(day, 'Exit not carried out: XYZ').disabled).toBe(true);
  });

  it('should hide the banner on Still holding, save nothing, and show the Action form as usual', async () => {
    const { user, facade, card } = await openExited({ form: { kind: 'New', viewState: { selectedAction: 'Hold' } } });
    const day = screen.getByRole('region', { name: 'The day' });
    await user.click(within(within(card).getByRole('group', { name: 'Exit not carried out' })).getByRole('button', { name: 'Still holding' }));
    expect(within(card).queryByRole('group', { name: 'Exit not carried out' })).toBeNull();
    expect(within(day).queryByRole('group', { name: 'Exit not carried out: XYZ' })).toBeNull();
    // The Action form is asked as usual: the Plan Call's own preselection stands, and nothing was written.
    expect(within(card).getByRole<HTMLInputElement>('radio', { name: 'Hold' }).checked).toBe(true);
    expect(vi.mocked(facade.DailyReview.save)).not.toHaveBeenCalled();
    expect(vi.mocked(facade.TradeWorkflows.recordPositionChange)).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Review XYZ/ }));
  });

  it('should leave the banner off once the Review Dates own Action is saved', async () => {
    const { card } = await openExited({ form: { kind: 'Saved', action: savedAction('Hold') } });
    expect(within(card).queryByRole('group', { name: 'Exit not carried out' })).toBeNull();
  });

  it('should show the banner again after a fresh open', async () => {
    const first = await openExited();
    await first.user.click(within(within(first.card).getByRole('group', { name: 'Exit not carried out' })).getByRole('button', { name: 'Still holding' }));
    expect(within(first.card).queryByRole('group', { name: 'Exit not carried out' })).toBeNull();
    cleanup();
    const again = await openExited();
    expect(within(again.card).getByRole('group', { name: 'Exit not carried out' })).toBeTruthy();
  });

  it('should show no Exit banner, to-do, Needed or day card note beside the receipt of a closing sale recorded from the banner', async () => {
    const { user, facade, card } = await openExited();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(closedExitResult({ reflection: { kind: 'Debt', debt: { debtId: 'debt-1' } }, closeReview: { kind: 'Debt', debt: { debtId: 'debt-2' } } }) as never);
    const day = screen.getByRole('region', { name: 'The day' });
    expect(within(day).getByRole('group', { name: 'Exit not carried out: XYZ' })).toBeTruthy();
    await user.click(within(within(card).getByRole('group', { name: 'Exit not carried out' })).getByRole('button', { name: 'I sold: record it' }));
    const row = await within(card).findByRole('group', { name: 'Execution 1' });
    for (const [label, value] of [['Quantity', '2'], ['Price', '53.00'], ['Fee', '1.00']] as const) {
      await user.clear(within(row).getByLabelText(label));
      await user.type(within(row).getByLabelText(label), value);
    }
    await user.click(within(card).getByRole('button', { name: 'Save exit' }));

    expect(await within(card).findByText('Recorded. XYZ is closed. Its Close Review is due in the next Review.')).toBeTruthy();
    expect(within(card).queryByRole('group', { name: 'Exit not carried out' })).toBeNull();
    expect(within(day).queryByRole('group', { name: 'Exit not carried out: XYZ' })).toBeNull();
    expect(card.textContent).not.toContain('You chose Exit and it is not recorded');
    expect(card.textContent).not.toContain('Needed');
    expect(screen.getByRole('button', { name: /^Review XYZ/ }).textContent).not.toContain('To do');
  });

  // Records a closing sale from the banner, as the case above does.
  async function sellAll(user: ReturnType<typeof userEvent.setup>, facade: Awaited<ReturnType<typeof openExited>>['facade'], card: HTMLElement) {
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(closedExitResult({ reflection: { kind: 'Debt', debt: { debtId: 'debt-1' } }, closeReview: { kind: 'Debt', debt: { debtId: 'debt-2' } } }) as never);
    await user.click(within(within(card).getByRole('group', { name: 'Exit not carried out' })).getByRole('button', { name: 'I sold: record it' }));
    const row = await within(card).findByRole('group', { name: 'Execution 1' });
    for (const [label, value] of [['Quantity', '2'], ['Price', '53.00'], ['Fee', '1.00']] as const) {
      await user.clear(within(row).getByLabelText(label));
      await user.type(within(row).getByLabelText(label), value);
    }
    await user.click(within(card).getByRole('button', { name: 'Save exit' }));
    await within(card).findByText('Recorded. XYZ is closed. Its Close Review is due in the next Review.');
  }
  const losing = { kind: 'Value' as const, value: { side: 'Losing' as const, share: Rational.of(1n, 2n), atEntry: Rational.of(1000n), now: Rational.of(500n) } };

  it('should give a sold-out card a header with no open-position reasons in its accessible description', async () => {
    const { user, facade, card } = await openExited({ item: { basis: losing } });
    const header = screen.getByRole('button', { name: /^Review XYZ/ });
    const reasonOf = () => (header.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean).map((id) => document.getElementById(id)?.textContent).join(' ');
    expect(reasonOf()).toContain('of the way from entry to the Stop');
    await sellAll(user, facade, card);
    expect(header.getAttribute('aria-describedby')).toBeNull();
    expect(card.textContent).not.toContain('of the way from entry to the Stop');
  });

  it('should leave the position summary off the header of a card whose closing sale shows its receipt', async () => {
    const summary = { kind: 'Stock' as const, direction: 'Long' as const, quantity: Rational.of(2n), price: Rational.of(5010n, 100n) };
    const { user, facade, card } = await openExited({ item: { summary } });
    const header = screen.getByRole('button', { name: /^Review XYZ/ });
    expect(header.textContent).toContain('Long 2 shares');
    await sellAll(user, facade, card);
    expect(header.textContent).not.toContain('Long 2 shares');
    expect(header.querySelector('.review-card-summary')).toBeNull();
  });

  it('should keep a closed Trades card free of open-position figures when the Review is read again and still lists it', async () => {
    const summary = { kind: 'Stock' as const, direction: 'Long' as const, quantity: Rational.of(2n), price: Rational.of(5010n, 100n) };
    const { user, facade, card } = await openExited({ item: { summary, basis: losing } });
    const day = screen.getByRole('region', { name: 'The day' });
    await sellAll(user, facade, card);
    // A sale after the session's close leaves the Trade in that day's Review: every read returns it, as the double does, and only a void or correction on another screen could reopen it.
    await user.click(within(card).getByRole('button', { name: 'Back to the Review' }));
    await waitFor(() => expect(vi.mocked(facade.DailyReview.open).mock.calls.length).toBeGreaterThan(1));
    const header = screen.getByRole('button', { name: /^Review XYZ/ });
    expect(header.textContent).not.toContain('Long 2 shares');
    expect(header.getAttribute('aria-describedby')).toBeNull();
    expect(within(screen.getByRole('region', { name: /^XYZ.* review$/ })).queryByRole('group', { name: 'Exit not carried out' })).toBeNull();
    expect(within(day).queryByRole('group', { name: 'Exit not carried out: XYZ' })).toBeNull();
  });

  it('should say how much was sold since, when part was sold', async () => {
    const { card } = await openExited({ carry: { direction: 'Long', held: Rational.of(1n), sold: Rational.of(1n) } });
    expect(within(card).getByRole('group', { name: 'Exit not carried out' }).textContent).toContain('You chose Exit on Fri Oct 9. Sold 1 since. Still holding 1.');
  });
});
