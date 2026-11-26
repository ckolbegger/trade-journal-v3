// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFixedClock as fixClock } from './trade-detail/test-support.ts';
import { cardProgress } from '../../../tests/support/card-progress.ts';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { closeReviewDefinition, plannedDetail, reflectionDefinition6 } from '../../../tests/support/position-change-form-facade.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { DailyTradeReview, OpenDailyReviewResult, ReviewBinding, SettlementItem, WalkedTrade } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { expiredOptionTrade } from '../../../tests/support/option-trade-fixtures.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ReviewView } from './ReviewView.tsx';
import { dayOf } from '../../../tests/support/review-day.ts';

afterEach(cleanup);
fixClock();

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;

// The Friday 2026-11-20 Review of D7's Settlement fixture: T-3 (O-S, Short 2 MNO 45 Puts) and T-1 (O-C, Long 1 XYZ 55 Call)
// both expire on the Review Date, so both are Settlement Due and walked in the blocker band.
const DATE = '2026-11-20';
const CUTOFF = '2026-11-21T01:00:00Z';
const FRIDAY_CLOSE = '2026-11-20T21:00:00Z';
const MNO_PUT = { kind: 'Option', symbol: 'MNO', root: 'MNO', expiration: '2026-11-20', right: 'Put', strike: '45', multiplier: 100 } as const;
const XYZ_CALL = { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', right: 'Call', strike: '55', multiplier: 100 } as const;
const binding: ReviewBinding = {
  workspace: { databaseName: 'tj-ws-1', contentRevision: 3 },
  catalogRevision: 1,
  journalRevision: 1,
  marketDataSnapshotId: 'mds1:1:abc',
  factRevisions: {},
  outstandingDebts: {},
};

const itemOf = (tradeId: string, instrument: SettlementItem['instrument'], quantity: bigint, settlementTime: SettlementItem['settlementTime'] = { kind: 'Value', value: FRIDAY_CLOSE }): SettlementItem => ({
  tradeId,
  instrument,
  quantity: Rational.of(quantity),
  expiration: instrument.expiration,
  settlementTime,
});
const MNO_ITEM = itemOf('t3', MNO_PUT, -2n);
const XYZ_ITEM = itemOf('t1', XYZ_CALL, 1n);

function walked(item: SettlementItem, underlying: string, progress: WalkedTrade['progress']): WalkedTrade {
  return {
    tradeId: item.tradeId,
    underlying,
    lastActivity: '2026-10-12T14:00:00Z',
    band: 'SettlementDue',
    reasons: [{ code: 'SettlementDue', instrument: item.instrument, quantity: item.quantity, expiration: item.expiration }],
    basis: { kind: 'Value', value: { side: 'None', share: Rational.of(0n, 1n) } },
    progress,
  };
}
const T3 = walked(MNO_ITEM, 'MNO', cardProgress(0, 0, { needed: 1, resolved: 0, settlement: true }));
const T1 = walked(XYZ_ITEM, 'XYZ', cardProgress(0, 0, { settlement: true }));

function review(over: Partial<Ready> = {}): Ready {
  const built: Ready = {
    kind: 'Ready',
    reviewDate: DATE,
    cutoff: CUTOFF,
    families: [
      { family: 'Marks', earlierMarks: [], today: [{ instrumentKey: 'MNO', instrument: { kind: 'Stock', symbol: 'MNO' }, tradingDate: DATE, trades: ['t3'], resolution: { kind: 'Missing' }, resolutionRevision: 'None', task: 'Manual' }], earlier: [] },
      { family: 'Settlement', items: [XYZ_ITEM, MNO_ITEM] },
      { family: 'Trades', trades: [T3, T1] },
    ],
    owed: [],
    completion: {
      kind: 'Incomplete',
      reasons: [
        { code: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'MNO' }, tradingDate: DATE, trades: ['t3'] },
        { code: 'SettlementDue', ...XYZ_ITEM },
        { code: 'SettlementDue', ...MNO_ITEM },
        { code: 'ActionMissing', tradeId: 't3' },
        { code: 'ActionMissing', tradeId: 't1' },
      ],
    },
    binding,
    ...over,
  };
  return over.day ? built : { ...built, day: dayOf(built) };
}

function tradeReview(walkedTrade: WalkedTrade, item: SettlementItem, over: Partial<DailyTradeReview> = {}): DailyTradeReview {
  return {
    tradeId: walkedTrade.tradeId,
    underlying: walkedTrade.underlying,
    lifecycle: 'Open',
    attention: walkedTrade,
    labels: { strategy: 'Cash-Secured Put', account: 'Main', institution: 'Broker' },
    settlement: [item],
    reflections: [],
    progress: walkedTrade.progress,
    form: { kind: 'New', viewState: { selectedAction: 'Hold' } },
    definitionRevision: 'def1',
    saveBinding: {
      reviewDate: DATE,
      tradeId: walkedTrade.tradeId,
      factRevision: 2,
      marketDataSnapshotId: 'mds1:1:abc',
      obligationKey: { entryType: 'DailyTradeReview', trade: walkedTrade.tradeId, reviewDate: DATE },
      definitionRevision: 'def1',
      databaseName: 'tj-ws-1',
    },
    ...over,
  };
}

function walkFacade(overview: Ready, ...trades: DailyTradeReview[]): UiFacade {
  const facade = facadeDouble();
  vi.mocked(facade.DailyReview.open).mockResolvedValue(overview);
  const getTrade = vi.mocked(facade.DailyReview.getTrade);
  for (const trade of trades) getTrade.mockResolvedValueOnce({ kind: 'Ready', reviewDate: DATE, cutoff: overview.cutoff, trade });
  return facade;
}

function renderReview(facade: UiFacade, options: { writable?: boolean } = {}) {
  render(
    <RuntimeContext.Provider value={{ writable: options.writable ?? true, timeZone: 'America/New_York', report: () => undefined }}>
      <MemoryRouter initialEntries={['/review']}>
        <ReviewView facade={facade} now={() => '2026-11-20T22:00:00Z'} onDirtyChange={() => undefined} />
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}


describe('settlement family (A112)', () => {
  it('should list each Trade owing a settlement among the day lines, with its expiration block where the Action panel would be', async () => {
    const user = userEvent.setup();
    renderReview(walkFacade(review(), tradeReview(T3, MNO_ITEM), tradeReview(T1, XYZ_ITEM)));

    // The day card lists each Trade with its settlement still to record, its link opening the card once its Marks are in.
    const dayLines = within(await screen.findByRole('region', { name: 'The day' })).getByRole('list', { name: 'Trade lines' });
    expect(within(dayLines).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['MNO Expired: settle To do: Mark, Settle', 'XYZ Expired: settle To do: Settle']);
    expect(within(dayLines).getByRole('link', { name: 'XYZ' }).getAttribute('href')).toBe('/review?trade=t1');

    // The card has no Settlement panel and no Action panel: the block says the contract expired and needs no Action.
    const card = await screen.findByRole('region', { name: 'MNO review' });
    expect(within(card).queryByRole('button', { name: /^Settlement/ })).toBeNull();
    expect(within(card).queryByRole('button', { name: /^Action/ })).toBeNull();
    expect(within(card).getByRole('heading', { name: 'Expired Fri Nov 20 · no Action needed' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Review XYZ/ }));
    const longCard = await screen.findByRole('region', { name: 'XYZ review' });
    expect(within(longCard).getByRole('heading', { name: 'Expired Fri Nov 20 · no Action needed' })).toBeTruthy();
  });
});

// Not in the breakdown: the rules the block keeps from the Settlement panel (24.2, Q1), each against one card.
describe('the expiration block around its item', () => {
  const open = async (item: SettlementItem, underlying: string, progress: WalkedTrade['progress'], over: Partial<DailyTradeReview> = {}, options: { writable?: boolean } = {}) => {
    const trade = walked(item, underlying, progress);
    renderReview(walkFacade(review({ families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: [trade] }] }), tradeReview(trade, item, over)), options);
    const card = await screen.findByRole('region', { name: `${underlying} review` });
    return { card, trade };
  };
  const OUT_OF_THE_MONEY = { kind: 'Value', value: { underlyingPrice: Rational.of(46n), strike: Rational.of(45n), inTheMoney: false, amount: Rational.of(1n), worth: Rational.of(0n), ifSettled: { dollars: Rational.of(250n), r: Rational.of(1n) }, ifExpiredWorthless: { dollars: Rational.of(250n), r: Rational.of(1n) } } } as const;

  it('should offer no Record expiration for an expiration date outside the market calendar, only the choices that need no settlement time', async () => {
    const outside = { kind: 'Unavailable', reason: 'SessionPolicyNotCovered', instrument: MNO_PUT, date: '2026-11-20' } as const;
    const { card } = await open(itemOf('t3', MNO_PUT, -2n, outside), 'MNO', cardProgress(0, 0, { settlement: true, owed: false }), { expirationStanding: OUT_OF_THE_MONEY });

    expect(within(card).queryByRole('button', { name: 'Record expiration' })).toBeNull();
    expect(within(card).getByRole('button', { name: 'Bought it back before the close' })).toBeTruthy();
  });

  it('should state the Settlement Due reason in the card and offer no choice while the runtime is read only', async () => {
    const { card } = await open(MNO_ITEM, 'MNO', cardProgress(0, 0, { settlement: true, owed: false }), { expirationStanding: OUT_OF_THE_MONEY }, { writable: false });

    expect(within(card).getByText('Settlement Due for MNO Nov 20 $45 Put, which expired Fri Nov 20')).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'Record expiration' })).toBeNull();
    expect(within(card).queryByRole('button', { name: /before the close/ })).toBeNull();
  });

  it('should leave a recorded settlement out of what remains', async () => {
    // Every panel is done, so no card opens by itself.
    const trade = walked(MNO_ITEM, 'MNO', cardProgress(0, 0, { settlement: false, owed: false }));
    renderReview(walkFacade(review({ families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: [trade] }] }), tradeReview(trade, MNO_ITEM)));
    await userEvent.setup().click(await screen.findByRole('button', { name: /Review MNO/ }));
    await screen.findByRole('region', { name: 'MNO review' });

    expect(screen.getByRole('button', { name: /Review MNO/ }).textContent).not.toContain('Settlement');
    expect(screen.getByRole('button', { name: /Review MNO/ }).textContent).toContain('Done');
  });
});

// The expiration block (D9.5 Part C): CORV's put, long 3, expired Fri Nov 20.
const CORV_PUT = { kind: 'Option', symbol: 'CORV', root: 'CORV', expiration: '2026-11-20', right: 'Put', strike: '80', multiplier: 100 } as const;
const CORV_ITEM = itemOf('t5', CORV_PUT, 3n);
const dollars = (n: bigint) => Rational.of(n);
const standing = (over: { mark: bigint; inTheMoney: boolean; amount: bigint; worth: bigint; settled: bigint; settledR: Rational; worthless: bigint; worthlessR: Rational }): NonNullable<DailyTradeReview['expirationStanding']> => ({
  kind: 'Value',
  value: {
    underlyingPrice: dollars(over.mark),
    strike: dollars(80n),
    inTheMoney: over.inTheMoney,
    amount: dollars(over.amount),
    worth: dollars(over.worth),
    ifSettled: { dollars: dollars(over.settled), r: over.settledR },
    ifExpiredWorthless: { dollars: dollars(over.worthless), r: over.worthlessR },
  },
});
// In the money: CORV finished at $73.00, $7.00 under the $80.00 strike; 3 puts are worth $2,100.00.
const IN_THE_MONEY = standing({ mark: 73n, inTheMoney: true, amount: 7n, worth: 2100n, settled: 1467n, settledR: Rational.of(461n, 100n), worthless: -633n, worthlessR: Rational.of(-199n, 100n) });

// The Settle Later entry saved for the Review Date: the protected option and nothing else (A315).
const settleLater = (): Extract<DailyTradeReview['form'], { kind: 'Saved' }>['action'] => ({
  id: 'e1',
  entryType: 'Daily Trade Review',
  entryTypeKey: 'entry-type.daily-trade-review',
  source: 'Daily Review',
  anchor: { kind: 'Trade', tradeId: 't5' },
  momentTime: '2026-11-20T21:00:00Z',
  authoredTime: '2026-11-20T22:00:00Z',
  responses: [{ prompt: 'Action', answer: { kind: 'Option', label: 'Settle Later' } }],
  entryRevision: 1,
  action: 'Settle Later',
  definitionId: 'def1',
});

// The Trade the expiration form reads: the put's Position and its due settlement.
const putDetail = {
  ...plannedDetail,
  factRevision: 4,
  plan: { ...plannedDetail.plan, underlying: 'CORV', legs: [{ factId: 'leg-put', side: 'Long', instrument: CORV_PUT, quantity: '3', intendedEntry: '2.11' }] },
  labels: { ...plannedDetail.labels, strategy: 'Long Put' },
  lifecycle: { stored: 'Open', agreement: { kind: 'Agrees' } },
  positions: [{ instrument: CORV_PUT, quantity: Rational.of(3n), openLots: [] }],
  settlement: [CORV_ITEM],
};
// The Recorded result of CORV's expiration: the receipt renders from it alone.
function expirationResult() {
  const { record, derivation } = expiredOptionTrade('O-C');
  return {
    kind: 'Recorded',
    receipt: { tradeId: 't5', createdFactIds: ['pc-e1'], deviationReconciliation: [], entryChanges: [], repairs: [], lotMatchChanges: [], realizedToDate: { before: Rational.of(0n), after: derivation.realizedToDate } },
    postCommit: { trade: { ...record, storedLifecycle: 'Closed' }, derivation, reflection: { kind: 'Entry', entry: { id: 'entry-1' } }, closeReview: { kind: 'Debt', debt: { id: 'debt-1' } } },
  };
}
// What the expiration form loads beside the card's own reads.
function withForm(facade: UiFacade): UiFacade {
  vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: putDetail, binding: { databaseName: 'tj-ws-1', contentRevision: 7 } } as never);
  vi.mocked(facade.Journal.getDefinitions).mockImplementation((request) => Promise.resolve({ kind: 'Found', definition: ('latestFor' in request && request.latestFor === 'entry-type.close-review' ? closeReviewDefinition : reflectionDefinition6) as never }));
  return facade;
}

describe('the expiration block on the card (T95.52)', () => {
  const openBlock = async (over: Partial<DailyTradeReview> = {}, options: { writable?: boolean; item?: SettlementItem } = {}) => {
    const item = options.item ?? CORV_ITEM;
    const trade = walked(item, 'CORV', cardProgress(0, 0, { settlement: true, owed: false }));
    const facade = withForm(walkFacade(review({ families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: [trade] }] }), tradeReview(trade, item, over)));
    renderReview(facade, options);
    const card = await screen.findByRole('region', { name: 'CORV review' });
    return { card, facade };
  };

  it('should head the block Expired Fri Nov 20 and no Action needed and show no Action form', async () => {
    const { card } = await openBlock({ expirationStanding: IN_THE_MONEY });

    expect(within(card).getByRole('heading', { name: 'Expired Fri Nov 20 · no Action needed' })).toBeTruthy();
    expect(within(card).queryByRole('form', { name: 'Action' })).toBeNull();
    expect(within(card).queryByRole('button', { name: /^Action/ })).toBeNull();
    expect(within(card).queryByRole('radio', { name: 'Hold' })).toBeNull();
  });

  it('should say where it finished: the Underlying Mark, the strike, in the money by how much, and what it is worth', async () => {
    const { card } = await openBlock({ expirationStanding: IN_THE_MONEY });

    const block = within(card).getByRole('region', { name: 'Expired contract' });
    expect(within(block).getByText('CORV $73.00, strike $80.00: $7.00 in the money')).toBeTruthy();
    expect(within(block).getByText('Worth $2,100.00 at expiration: +$1,467.00 · +4.61R on the Trade.')).toBeTruthy();
  });

  it('should make Exercised record later the main button in the money for a long contract, and Assigned record later for a short one', async () => {
    const long = await openBlock({ expirationStanding: IN_THE_MONEY });
    const exercised = within(long.card).getByRole('button', { name: 'Exercised: record later' });
    expect(exercised.className).toContain('primary');
    expect(within(long.card).queryByRole('button', { name: 'Assigned: record later' })).toBeNull();
    cleanup();

    const short = await openBlock({ expirationStanding: IN_THE_MONEY }, { item: itemOf('t5', CORV_PUT, -3n) });
    const assigned = within(short.card).getByRole('button', { name: 'Assigned: record later' });
    expect(assigned.className).toContain('primary');
    expect(within(short.card).queryByRole('button', { name: 'Exercised: record later' })).toBeNull();
  });

  it('should word what a short contract is worth as an amount, not a negative figure', async () => {
    const user = userEvent.setup();
    // A short put finished $7.00 in the money: three contracts are owed $2,100.00, which is minus in the standing's own signs.
    const owed = standing({ mark: 73n, inTheMoney: true, amount: 7n, worth: -2100n, settled: -1467n, settledR: Rational.of(-461n, 100n), worthless: 564n, worthlessR: Rational.of(94n, 100n) });
    const { card } = await openBlock({ expirationStanding: owed }, { item: itemOf('t5', CORV_PUT, -3n) });

    expect(within(card).getByText('Worth $2,100.00 at expiration: −$1,467.00 · −4.61R on the Trade.')).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: 'It expired worthless' }));
    expect(within(card).getByText('This books +$564.00 · +0.94R on a put worth $2,100.00.')).toBeTruthy();
  });

  it('should say what record later does and does not do', async () => {
    const long = await openBlock({ expirationStanding: IN_THE_MONEY });
    const button = within(long.card).getByRole('button', { name: 'Exercised: record later' });
    const sentence = within(long.card).getByText("The app can't record an exercise yet. This only lets today's Review finish. The next Review asks again.");
    // The button is described by the sentence, so a screen reader hears what it does.
    expect(button.getAttribute('aria-describedby')).toBe(sentence.id);
    cleanup();

    const short = await openBlock({ expirationStanding: IN_THE_MONEY }, { item: itemOf('t5', CORV_PUT, -3n) });
    expect(within(short.card).getByText("The app can't record an assignment yet. This only lets today's Review finish. The next Review asks again.")).toBeTruthy();
  });

  it('should save Settle Later on that button and show the saved line', async () => {
    const user = userEvent.setup();
    const trade = walked(CORV_ITEM, 'CORV', cardProgress(0, 0, { settlement: true, owed: false }));
    const first = tradeReview(trade, CORV_ITEM, { expirationStanding: IN_THE_MONEY });
    const facade = walkFacade(review({ families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: [trade] }] }), first);
    vi.mocked(facade.DailyReview.save).mockResolvedValue({
      kind: 'Saved',
      action: settleLater(),
      review: { kind: 'Ready', cards: [], progress: { tradesWithAction: 1, tradesEligible: 1 }, completion: { kind: 'CompleteWithSettlementToRecord', trades: ['t5'] }, nextStep: { kind: 'Done' }, binding },
    });
    renderReview(facade);

    await user.click(await within(await screen.findByRole('region', { name: 'CORV review' })).findByRole('button', { name: 'Exercised: record later' }));

    expect(vi.mocked(facade.DailyReview.save)).toHaveBeenCalledExactlyOnceWith({ kind: 'SettleLater', binding: first.saveBinding });
    cleanup();

    // The card read again shows the saved line in place of the button.
    const { card } = await openBlock({ expirationStanding: IN_THE_MONEY, form: { kind: 'Saved', action: settleLater() } });
    expect(within(card).getByText("Exercised, to record later. Today's Review can finish. The next Review asks again.")).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'Exercised: record later' })).toBeNull();
  });

  it('should offer It expired worthless as a link that states what it would book and asks why before Record expiration anyway', async () => {
    const user = userEvent.setup();
    const { card } = await openBlock({ expirationStanding: IN_THE_MONEY });
    expect(within(card).queryByRole('textbox', { name: 'Why did it expire worthless?' })).toBeNull();

    await user.click(within(card).getByRole('button', { name: 'It expired worthless' }));

    expect(within(card).getByText('This books −$633.00 · −1.99R on a put worth $2,100.00.')).toBeTruthy();
    const why = await within(card).findByRole('textbox', { name: 'Why did it expire worthless?' });
    const anyway = within(card).getByRole('button', { name: 'Record expiration anyway' });
    expect(why.compareDocumentPosition(anyway) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should open the sale form on Sold before the close or Bought back before the close', async () => {
    const user = userEvent.setup();
    const long = await openBlock({ expirationStanding: IN_THE_MONEY });
    await user.click(within(long.card).getByRole('button', { name: 'Sold before the close' }));
    expect(await within(long.card).findByRole('heading', { name: 'Record exit' })).toBeTruthy();
    expect(within(long.card).queryByRole('button', { name: 'Exercised: record later' })).toBeNull();
    cleanup();

    const short = await openBlock({ expirationStanding: IN_THE_MONEY }, { item: itemOf('t5', CORV_PUT, -3n) });
    await user.click(within(short.card).getByRole('button', { name: 'Bought back before the close' }));
    expect(await within(short.card).findByRole('heading', { name: 'Record exit' })).toBeTruthy();
  });

  it('should offer all three with no main button when the Underlying has no Mark', async () => {
    const missing = { kind: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'CORV' }, date: '2026-11-20' } as const;
    const { card } = await openBlock({ expirationStanding: missing });

    expect(within(card).getByText("No price for CORV, so the app can't say where it finished. What happened?")).toBeTruthy();
    const choices = ['Exercised: record later', 'Sold before the close', 'It expired worthless'].map((name) => within(card).getByRole('button', { name }));
    expect(choices.filter((button) => button.className.includes('primary'))).toEqual([]);
    expect(within(card).queryByText(/in the money|strike/)).toBeNull();
  });

  it('should record the expiration through the Trades own form in the card, with no reflection or Close Review choice', async () => {
    const user = userEvent.setup();
    const lost = standing({ mark: 81n, inTheMoney: false, amount: 1n, worth: 0n, settled: -633n, settledR: Rational.of(-199n, 100n), worthless: -633n, worthlessR: Rational.of(-199n, 100n) });
    const { card, facade } = await openBlock({ expirationStanding: lost });
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(expirationResult() as never);

    await user.click(within(card).getByRole('button', { name: 'Record expiration' }));

    // The Trade's own form: the contract, quantity and settlement time, and no choice of how to meet a reflection.
    expect(await within(card).findByText('Fri Nov 20, 16:00')).toBeTruthy();
    expect(within(card).queryByRole('radiogroup', { name: 'Reflection' })).toBeNull();
    expect(within(card).queryByRole('region', { name: 'Closing the Trade' })).toBeNull();
    expect(within(card).queryByLabelText('Reflect now')).toBeNull();
    expect(within(card).queryByRole('textbox', { name: 'Why did it expire worthless?' })).toBeNull();
    await user.click(within(card).getByRole('button', { name: 'Record expiration' }));

    expect(vi.mocked(facade.TradeWorkflows.recordPositionChange)).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        members: [expect.objectContaining({ kind: 'Expiration', tradeId: 't5', quantity: '3', economicTime: '2026-11-20T21:00:00Z' })],
        reflection: { kind: 'Complete', form: { definitionId: 'def-pcr-3', answers: {} } },
        closeReview: { kind: 'Defer' },
      }),
    );
    // The receipt's way back is the card's own.
    expect(await within(card).findByRole('heading', { name: 'Expiration recorded' })).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Back to the Review' })).toBeTruthy();
    expect(within(card).queryByRole('link', { name: 'Back to the Trade' })).toBeNull();
  });

  it('should say nothing was saved when the Review changed under a record later, and offer Refresh to read it again', async () => {
    const user = userEvent.setup();
    const trade = walked(CORV_ITEM, 'CORV', cardProgress(0, 0, { settlement: true, owed: false }));
    const first = tradeReview(trade, CORV_ITEM, { expirationStanding: IN_THE_MONEY });
    const facade = walkFacade(review({ families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: [trade] }] }), first, first);
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'ReviewChanged', evidence: {} as never });
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'CORV review' });

    await user.click(within(card).getByRole('button', { name: 'Exercised: record later' }));
    expect((await within(card).findByRole('alert')).textContent).toContain('The Review changed after you opened this Trade. Nothing was saved.');
    const opens = vi.mocked(facade.DailyReview.open).mock.calls.length;
    await user.click(within(card).getByRole('button', { name: 'Refresh' }));

    // The Review and this Trade are read again under a fresh binding, and the notice goes.
    await waitFor(() => expect(vi.mocked(facade.DailyReview.open).mock.calls.length).toBeGreaterThan(opens));
    await waitFor(() => expect(within(card).queryByRole('alert')).toBeNull());
  });

  it('should disable the other choices while record later is saving', async () => {
    const user = userEvent.setup();
    const trade = walked(CORV_ITEM, 'CORV', cardProgress(0, 0, { settlement: true, owed: false }));
    const first = tradeReview(trade, CORV_ITEM, { expirationStanding: IN_THE_MONEY });
    const facade = walkFacade(review({ families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: [trade] }] }), first, first);
    vi.mocked(facade.DailyReview.save).mockReturnValue(new Promise(() => {}) as never);
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'CORV review' });

    await user.click(within(card).getByRole('button', { name: 'Exercised: record later' }));

    for (const name of ['Sold before the close', 'It expired worthless']) {
      expect(within(card).getByRole('button', { name })).toHaveProperty('disabled', true);
    }
  });

  it('should enable the other choices again when the record later save is refused', async () => {
    const user = userEvent.setup();
    const trade = walked(CORV_ITEM, 'CORV', cardProgress(0, 0, { settlement: true, owed: false }));
    const first = tradeReview(trade, CORV_ITEM, { expirationStanding: IN_THE_MONEY });
    const facade = walkFacade(review({ families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: [trade] }] }), first, first);
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'ReviewChanged', evidence: {} as never });
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'CORV review' });

    await user.click(within(card).getByRole('button', { name: 'Exercised: record later' }));
    await within(card).findByRole('alert');

    for (const name of ['Sold before the close', 'It expired worthless']) {
      expect(within(card).getByRole('button', { name })).toHaveProperty('disabled', false);
    }
  });

  it('should still offer the other two choices after a saved record later, and no undo', async () => {
    const { card } = await openBlock({ expirationStanding: IN_THE_MONEY, form: { kind: 'Saved', action: settleLater() } });

    expect(within(card).getByRole('button', { name: 'Sold before the close' })).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'It expired worthless' })).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'Exercised: record later' })).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Change' })).toBeNull();
    expect(within(card).queryByRole('button', { name: /undo/i })).toBeNull();
  });

  it('should lay the block out in one column at 375 wide', () => {
    const css = readFileSync('src/ui/app.css', 'utf8');
    // A row of choices on a desktop; the phone width (the Action choices' own breakpoint) stacks them, each across the card.
    expect(css).toMatch(/\.expiration-choices\s*\{[^}]*display:\s*flex/);
    const phone = [...css.matchAll(/@media \(max-width: 479\.98px\) \{([\s\S]*?)\n\}/g)].map((match) => match[1]!);
    expect(phone.some((rules) => /\.expiration-choices\s*\{[^}]*flex-direction:\s*column/.test(rules))).toBe(true);
    expect(phone.some((rules) => /\.expiration-choices\s*>\s*button\s*\{[^}]*width:\s*100%/.test(rules))).toBe(true);
  });

  it('should make Record expiration the main button out of the money, saying what is kept or lost', async () => {
    // A long put that finished above its strike: the premium paid is lost.
    const lost = standing({ mark: 81n, inTheMoney: false, amount: 1n, worth: 0n, settled: -633n, settledR: Rational.of(-199n, 100n), worthless: -633n, worthlessR: Rational.of(-199n, 100n) });
    const long = await openBlock({ expirationStanding: lost });
    expect(within(long.card).getByText('CORV $81.00, above the $80.00 strike: expired worthless. You lose the $633.00 paid.')).toBeTruthy();
    expect(within(long.card).getByRole('button', { name: 'Record expiration' }).className).toContain('primary');
    expect(within(long.card).getByRole('button', { name: 'Sold it before the close' }).className).not.toContain('primary');
    expect(within(long.card).queryByRole('button', { name: 'It expired worthless' })).toBeNull();
    expect(within(long.card).queryByRole('button', { name: 'Exercised: record later' })).toBeNull();
    cleanup();

    // A short put: the premium received is kept.
    const kept = standing({ mark: 81n, inTheMoney: false, amount: 1n, worth: 0n, settled: 564n, settledR: Rational.of(94n, 100n), worthless: 564n, worthlessR: Rational.of(94n, 100n) });
    const short = await openBlock({ expirationStanding: kept }, { item: itemOf('t5', CORV_PUT, -3n) });
    expect(within(short.card).getByText('CORV $81.00, above the $80.00 strike: expired worthless. You keep $564.00.')).toBeTruthy();
    expect(within(short.card).getByRole('button', { name: 'Bought it back before the close' })).toBeTruthy();
  });
});
