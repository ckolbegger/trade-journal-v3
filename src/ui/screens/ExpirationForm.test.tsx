// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exitFormFacade, plannedDetail } from '../../../tests/support/position-change-form-facade.ts';
import { expiredOptionTrade, OC_CONTRACT } from '../../../tests/support/option-trade-fixtures.ts';
import type { UiFacade } from '../../app/compose.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ExpirationForm } from './ExpirationForm.tsx';

afterEach(cleanup);

// Friday 2026-11-20 16:00 New York, the close of the expiration session.
const SETTLEMENT_TIME = '2026-11-20T21:00:00Z';

// An Open Trade of O-C's Long Call with one contract left, due for settlement: the item carries the
// quantity and the settlement time the form shows and submits.
const CALL_LEG = { factId: 'leg-oc', side: 'Long', instrument: OC_CONTRACT, quantity: '2', intendedEntry: '2.00' };
const dueDetail = {
  ...plannedDetail,
  factRevision: 4,
  plan: { ...plannedDetail.plan, underlying: 'XYZ', legs: [CALL_LEG] },
  labels: { ...plannedDetail.labels, strategy: 'Long Call' },
  lifecycle: { stored: 'Open', agreement: { kind: 'Agrees' } },
  positions: [{ instrument: OC_CONTRACT, quantity: Rational.of(1n), openLots: [] }],
  settlement: [{ tradeId: 'trade-1', instrument: OC_CONTRACT, quantity: Rational.of(1n), expiration: '2026-11-20', settlementTime: SETTLEMENT_TIME }],
};

function renderForm(facade: UiFacade = exitFormFacade(dueDetail), search = '') {
  render(
    <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
      <MemoryRouter initialEntries={[`/trades/trade-1/record-expiration${search}`]}>
        <Routes>
          <Route path="/trades/:tradeId/record-expiration" element={<ExpirationForm facade={facade} timeZone="America/New_York" onDirtyChange={() => undefined} />} />
        </Routes>
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
  return facade;
}

describe('rendering A113', () => {
  it('should show the contract, quantity, and settlement time read-only, the reflection disposition and the Close Review disposition each with Reflect now selected, no Close Reason, and the note explaining why none is needed', async () => {
    renderForm();
    expect(await screen.findByRole('heading', { level: 1, name: 'Expiration' })).toBeTruthy();
    const terms = screen.getByRole('region', { name: 'Expiration' });
    const value = (term: string) => within(terms).getByText(term).nextElementSibling?.textContent;
    expect(value('Contract')).toBe('XYZ 20 Nov 2026 55 Call');
    expect(value('Quantity')).toBe('Long 1 contract');
    expect(value('Settlement time')).toContain('Fri Nov 20, 16:00');
    expect(within(terms).getByText('The close of the expiration session.')).toBeTruthy();
    expect(within(terms).queryAllByRole('textbox')).toEqual([]);

    const reflection = screen.getByRole('region', { name: 'Reflection on this expiration' });
    expect(within(reflection).getByRole('radio', { name: 'Reflect now' })).toHaveProperty('checked', true);
    const closing = screen.getByRole('region', { name: 'Closing the Trade' });
    expect(within(closing).getByRole('radio', { name: 'Reflect now' })).toHaveProperty('checked', true);
    expect(within(closing).getByText('No Close Reason is needed, because the contract expired rather than being closed by your decision.')).toBeTruthy();
    expect(screen.queryByText('Close Reason')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save expiration' })).toBeTruthy();
  });
});

// O-C after PC1, PC2, X1 (a sale of 1) and E1, the Expiration of the one contract left: Closed, with
// both reflections saved.
function expirationResult() {
  const { record, derivation } = expiredOptionTrade('O-C');
  return {
    kind: 'Recorded',
    receipt: { tradeId: 'trade-1', createdFactIds: ['pc-e1'], deviationReconciliation: [], entryChanges: [], repairs: [], lotMatchChanges: [], realizedToDate: { before: Rational.of(0n), after: derivation.realizedToDate } },
    postCommit: {
      trade: { ...record, storedLifecycle: 'Closed' },
      derivation,
      reflection: { kind: 'Entry', entry: { id: 'entry-1' } },
      closeReview: { kind: 'Entry', entry: { id: 'entry-2' } },
    },
  };
}

describe('submission', () => {
  it('should submit one Expiration member with the items quantity and settlement time and both dispositions, and render the Closed Trade, Terminal Disposition, Option Disposition Timing, and both reflection outcomes from the result alone', async () => {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(expirationResult() as never);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Save expiration' }));
    const [command] = vi.mocked(facade.TradeWorkflows.recordPositionChange).mock.calls[0]!;
    const complete: unknown = expect.objectContaining({ kind: 'Complete' });
    expect(command).toEqual(
      expect.objectContaining({
        originTradeId: 'trade-1',
        trades: [{ tradeId: 'trade-1', expectedFactRevision: 4 }],
        members: [{ kind: 'Expiration', tradeId: 'trade-1', instrument: OC_CONTRACT, quantity: '1', economicTime: SETTLEMENT_TIME }],
        reflection: complete,
        closeReview: complete,
      }),
    );
    expect(command).not.toHaveProperty('closeReasonId');
    expect(await screen.findByRole('heading', { level: 1, name: 'Expiration recorded' })).toBeTruthy();
    expect(screen.getByText('Expiration of 1 XYZ 20 Nov 2026 55 Call, no price or fee')).toBeTruthy();
    expect(screen.getByText('Expired on 2026-11-20 16:00')).toBeTruthy();
    expect(screen.getByText('Lifecycle').nextElementSibling?.textContent).toBe('Closed');
    expect(screen.getByText('Closed via sale of 1 contract and expiration of 1 contract')).toBeTruthy();
    expect(screen.getByText('Mixed: 1 before expiration, 1 at expiration')).toBeTruthy();
    expect(screen.getByText('Reflection saved.')).toBeTruthy();
    expect(screen.getByText('Close Review saved.')).toBeTruthy();
    expect(screen.queryByText('Close Reason')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back to the Review' })).toBeNull();
  });
});

// Not in the breakdown: the K14 link, the row 21.12 states, and the rejected and conflicting saves.
describe('the form around the save', () => {
  const save = async (facade: UiFacade, result: unknown, search = '') => {
    renderForm(facade, search);
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(result as never);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Save expiration' }));
  };

  it('should offer Back to the Review on the receipt only when opened from the Review', async () => {
    await save(exitFormFacade(dueDetail), expirationResult(), '?from=review');
    expect(await screen.findByRole('link', { name: 'Back to the Review' })).toBeTruthy();
    cleanup();
    await save(exitFormFacade(dueDetail), expirationResult());
    await screen.findByRole('heading', { name: 'Expiration recorded' });
    expect(screen.queryByRole('link', { name: 'Back to the Review' })).toBeNull();
  });

  it('should say a Trade with no contract due for settlement has none', async () => {
    renderForm(exitFormFacade({ ...dueDetail, settlement: [] }));
    expect(await screen.findByText('This Trade has no contract due for settlement.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save expiration' })).toBeNull();
  });

  it('should list a rejected saves issues under the expiration cant be saved heading in their approved words', async () => {
    const issues = [
      { source: 'TradeAnalysis', member: 0, code: 'ExpirationMustSettleAllOpen', available: Rational.of(2n) },
      { source: 'TradeAnalysis', member: 0, code: 'SettlementTimeInvalid' },
      { source: 'TradeWorkflows', member: 0, field: 'economicTime', code: 'EconomicTimeInFuture' },
    ];
    await save(exitFormFacade(dueDetail), { kind: 'Rejected', issues });
    const summary = await screen.findByRole('region', { name: 'This expiration can’t be saved yet' });
    expect(within(summary).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'The expiration must cover all 2 contracts in the position. Load the latest Trade and try again.',
      'The settlement time must be on or before the expiration date and after every Execution on the contract.',
      'The settlement time cannot be in the future.',
    ]);
  });

  it('should show Conflict with nothing saved and the choices kept', async () => {
    await save(exitFormFacade(dueDetail), { kind: 'Conflict', changed: ['trade:trade-1'] });
    const banner = await screen.findByRole('region', { name: 'This Trade changed after you opened this form' });
    expect(within(banner).getByText('Nothing was saved. The Trade changed after this expiration was offered, so review the Trade before recording it. Your choices are kept below.')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Reflection on this expiration' })).toBeTruthy();
  });
});

describe('load, dirtiness, and another Trade', () => {
  it('should say the expiration form couldn’t load, and that nothing was changed, when the Trade can’t be read', async () => {
    const facade = exitFormFacade(dueDetail);
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockRejectedValue(new Error('unreadable'));
    renderForm(facade);
    expect(await screen.findByText('We couldn’t load this expiration form. Nothing was changed.')).toBeTruthy();
    expect(screen.queryByText('Loading the expiration form…')).toBeNull();
  });

  it('should report no unsaved values once the expiration is recorded', async () => {
    const facade = exitFormFacade(dueDetail);
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(expirationResult() as never);
    const onDirtyChange = vi.fn();
    render(
      <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
        <MemoryRouter initialEntries={['/trades/trade-1/record-expiration']}>
          <Routes>
            <Route path="/trades/:tradeId/record-expiration" element={<ExpirationForm facade={facade} timeZone="America/New_York" onDirtyChange={onDirtyChange} />} />
          </Routes>
        </MemoryRouter>
      </RuntimeContext.Provider>,
    );
    const user = userEvent.setup();
    const reflection = await screen.findByRole('region', { name: 'Reflection on this expiration' });
    await user.click(within(reflection).getByRole('radio', { name: 'Decline to reflect' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Save expiration' }));
    await screen.findByRole('heading', { name: 'Expiration recorded' });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('should load the other Trades settlement when the routes Trade changes', async () => {
    const facade = exitFormFacade(dueDetail);
    const other = { ...dueDetail, settlement: [{ ...dueDetail.settlement[0]!, tradeId: 'trade-2', quantity: Rational.of(3n) }] };
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockImplementation((request) =>
      Promise.resolve({ kind: 'Ready', view: 'tradeId' in request && request.tradeId === 'trade-2' ? other : dueDetail, binding: { databaseName: 'tj-ws-1', contentRevision: 7 } } as never),
    );
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(expirationResult() as never);
    render(
      <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
        <MemoryRouter initialEntries={['/trades/trade-1/record-expiration']}>
          <Link to="/trades/trade-2/record-expiration">Other Trade</Link>
          <Routes>
            <Route path="/trades/:tradeId/record-expiration" element={<ExpirationForm facade={facade} timeZone="America/New_York" onDirtyChange={() => undefined} />} />
          </Routes>
        </MemoryRouter>
      </RuntimeContext.Provider>,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Save expiration' }));
    await screen.findByRole('heading', { name: 'Expiration recorded' });
    await user.click(screen.getByRole('link', { name: 'Other Trade' }));
    const terms = await screen.findByRole('region', { name: 'Expiration' });
    expect(within(terms).getByText('Quantity').nextElementSibling?.textContent).toBe('Long 3 contracts');
    expect(screen.queryByRole('heading', { name: 'Expiration recorded' })).toBeNull();
  });
});
