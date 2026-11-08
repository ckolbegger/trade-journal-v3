// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardProgress } from '../../../tests/support/card-progress.ts';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { DailyTradeReview, OpenDailyReviewResult, ReviewBinding, SettlementItem, WalkedTrade } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ReviewView } from './ReviewView.tsx';

afterEach(cleanup);

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
    band: 'Blocker',
    reasons: [{ code: 'SettlementDue', instrument: item.instrument, quantity: item.quantity, expiration: item.expiration }],
    basis: { kind: 'Value', value: { side: 'None', share: Rational.of(0n, 1n) } },
    rangePosition: { kind: 'Value', value: { now: Rational.of(1n, 2n), atEntry: Rational.of(1n, 2n) } },
    progress,
  };
}
const T3 = walked(MNO_ITEM, 'MNO', cardProgress(0, 0, { needed: 1, resolved: 0, settlement: true }));
const T1 = walked(XYZ_ITEM, 'XYZ', cardProgress(0, 0, { settlement: true }));

function review(over: Partial<Ready> = {}): Ready {
  return {
    kind: 'Ready',
    reviewDate: DATE,
    cutoff: CUTOFF,
    families: [
      { family: 'Marks', today: [{ instrumentKey: 'MNO', instrument: { kind: 'Stock', symbol: 'MNO' }, tradingDate: DATE, trades: ['t3'], resolution: { kind: 'Missing' }, resolutionRevision: 'None', task: 'Manual' }], earlier: [] },
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

const settlementPanel = (card: HTMLElement) => within(card).getByRole('region', { name: 'Settlement' });
const termValue = (panel: HTMLElement, term: string) => within(panel).getByText(term).nextElementSibling?.textContent;

describe('settlement family (A112)', () => {
  it('should show each cards Settlement panel with its contract, quantity, settlement time, Record expiration and the assignment or exercise sentence, and list the settlements among the overview blockers after Missing Marks', async () => {
    const user = userEvent.setup();
    renderReview(walkFacade(review(), tradeReview(T3, MNO_ITEM), tradeReview(T1, XYZ_ITEM)));

    // The overview lists each due settlement after the Missing Marks, its contract linking to the card's Settlement panel (row 24.5).
    const blockers = within(await screen.findByRole('region', { name: 'Review status' })).getByRole('list', { name: 'Blockers' });
    const lines = within(blockers).getAllByRole('listitem').map((li) => li.textContent);
    expect(lines.slice(0, 3)).toEqual([
      'Mark missing for MNO on Fri Nov 20',
      'Settlement Due for XYZ 20 Nov 2026 55 Call, which expired Fri Nov 20',
      'Settlement Due for MNO 20 Nov 2026 45 Put, which expired Fri Nov 20',
    ]);
    expect(within(blockers).getByRole('link', { name: 'MNO 20 Nov 2026 45 Put' }).getAttribute('href')).toBe('/review?trade=t3&panel=Settlement');

    // The collapsed card says what remains, with the settlement between the reflections and the Action (row 24.3).
    const card = await screen.findByRole('region', { name: 'MNO review' });
    expect(screen.getByRole('button', { name: /Review MNO/ }).textContent).toContain('1 Mark · Settlement · Action');

    // The panel header: the item in words and its status (rows 24.1, 24.2).
    const header = within(card).getByRole('button', { name: /^Settlement/ });
    expect(header.textContent).toContain('Short 2 contracts, expired Fri Nov 20');
    expect(header.textContent).toContain('Needed');
    await user.click(header);

    const panel = settlementPanel(card);
    expect(termValue(panel, 'Contract')).toBe('MNO 20 Nov 2026 45 Put');
    expect(termValue(panel, 'Quantity')).toBe('Short 2 contracts');
    expect(termValue(panel, 'Settlement time')).toBe('Fri Nov 20, 16:00');
    expect(within(panel).getByText("If it was assigned, this release can't record the assignment yet, so this Review stays incomplete until a later release can")).toBeTruthy();
    expect(within(panel).queryByText(/exercised/)).toBeNull();
    expect(within(panel).getByRole('link', { name: 'Record expiration' }).getAttribute('href')).toBe('/trades/t3/record-expiration?from=review');

    // A long contract's sentence follows its sign, not its Strategy (decision 88): this Trade's Strategy is a Cash-Secured Put.
    await user.click(screen.getByRole('button', { name: /Review XYZ/ }));
    const longCard = await screen.findByRole('region', { name: 'XYZ review' });
    await user.click(within(longCard).getByRole('button', { name: /^Settlement/ }));
    const longPanel = settlementPanel(longCard);
    expect(termValue(longPanel, 'Quantity')).toBe('Long 1 contract');
    expect(within(longPanel).getByText("If it was exercised, this release can't record the exercise yet, so this Review stays incomplete until a later release can")).toBeTruthy();
    expect(within(longPanel).queryByText(/assigned/)).toBeNull();
    expect(within(longPanel).queryByText(/trading session/)).toBeNull();
  });
});

// Not in the breakdown: the rows around the panel (24.2, 24.5, 24.9 and Q1), each against one card.
describe('the Settlement panel around its items', () => {
  const open = async (item: SettlementItem, underlying: string, progress: WalkedTrade['progress'], options: { writable?: boolean } = {}) => {
    const trade = walked(item, underlying, progress);
    renderReview(walkFacade(review({ families: [{ family: 'Marks', today: [], earlier: [] }, { family: 'Trades', trades: [trade] }] }), tradeReview(trade, item)), options);
    const card = await screen.findByRole('region', { name: `${underlying} review` });
    return { card, trade };
  };

  it('should word the settlement time of an expiration date outside the market calendar by the modules figure and offer no Record expiration', async () => {
    const outside = { kind: 'Unavailable', reason: 'SessionPolicyNotCovered', instrument: MNO_PUT, date: '2026-11-20' } as const;
    const { card } = await open(itemOf('t3', MNO_PUT, -2n, outside), 'MNO', cardProgress(0, 0, { settlement: true }));

    const panel = settlementPanel(card);
    expect(termValue(panel, 'Settlement time')).toBe('Outside the market calendar: Fri Nov 20');
    expect(within(panel).queryByRole('link', { name: 'Record expiration' })).toBeNull();
  });

  it('should say a settlement time is the close of the latest session when the expiration date was not a trading session', async () => {
    const goodFriday = { ...MNO_PUT, expiration: '2026-04-03' } as const;
    const { card } = await open(itemOf('t3', goodFriday, -2n, { kind: 'Value', value: '2026-04-02T20:00:00Z' }), 'MNO', cardProgress(0, 0, { settlement: true }));

    const panel = settlementPanel(card);
    expect(termValue(panel, 'Settlement time')).toBe('Thu Apr 2, 16:00');
    expect(within(panel).getByText("Fri Apr 3 wasn't a trading session, so the settlement time is the close of Thu Apr 2.")).toBeTruthy();
  });

  it('should state the Settlement Due reason in the card and offer Record expiration only while the runtime is writable', async () => {
    const { card } = await open(MNO_ITEM, 'MNO', cardProgress(0, 0, { settlement: true }), { writable: false });

    expect(within(card).getByText('Settlement Due for MNO 20 Nov 2026 45 Put, which expired Fri Nov 20')).toBeTruthy();
    expect(within(card).queryByRole('link', { name: 'Record expiration' })).toBeNull();
  });

  it('should show a recorded settlement as Recorded and leave it out of what remains', async () => {
    // Every panel is done, so no card opens by itself.
    const trade = walked(MNO_ITEM, 'MNO', cardProgress(0, 0, { settlement: false, owed: false }));
    renderReview(walkFacade(review({ families: [{ family: 'Marks', today: [], earlier: [] }, { family: 'Trades', trades: [trade] }] }), tradeReview(trade, MNO_ITEM)));
    await userEvent.setup().click(await screen.findByRole('button', { name: /Review MNO/ }));
    const card = await screen.findByRole('region', { name: 'MNO review' });

    expect(within(card).getByRole('button', { name: /^Settlement/ }).textContent).toContain('Recorded');
    expect(screen.getByRole('button', { name: /Review MNO/ }).textContent).not.toContain('Settlement');
    expect(screen.getByRole('button', { name: /Review MNO/ }).textContent).toContain('Done');
  });
});
