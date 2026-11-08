// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exitFormFacade, plannedDetail } from '../../../tests/support/position-change-form-facade.ts';
import { OC_CONTRACT, optionTrade, OS_CONTRACT } from '../../../tests/support/option-trade-fixtures.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ExitReceipt } from './ExitReceipt.tsx';
import { PositionChangeForm } from './PositionChangeForm.tsx';
import { PositionChangeReceipt } from './PositionChangeReceipt.tsx';

afterEach(cleanup);

// A Plan's one option leg: O-C's Long Call (2 contracts) or O-S's Cash-Secured Put (a signed -2).
const CALL_LEG = { factId: 'leg-oc', side: 'Long', instrument: OC_CONTRACT, quantity: '2', intendedEntry: '2.00' };
const PUT_LEG = { factId: 'leg-os', side: 'Short', instrument: OS_CONTRACT, quantity: '-2', intendedEntry: '1.20' };

// The Trade Detail the form loads: planned, or open with `held` contracts (negative for a short).
function optionDetail(leg: typeof CALL_LEG, strategy: string, held?: bigint) {
  return {
    ...plannedDetail,
    plan: { ...plannedDetail.plan, underlying: leg.instrument.symbol, legs: [leg] },
    labels: { ...plannedDetail.labels, strategy },
    ...(held !== undefined && {
      lifecycle: { stored: 'Open', agreement: { kind: 'Agrees' } },
      positions: [{ instrument: leg.instrument, quantity: Rational.of(held), openLots: [] }],
    }),
  };
}

function renderForm(detail: unknown, action: 'Buy' | 'Sell') {
  const facade = exitFormFacade(detail);
  render(
    <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
      <MemoryRouter initialEntries={[`/trades/trade-1/record-entry${action === 'Sell' ? '?action=Sell' : ''}`]}>
        <Routes>
          <Route
            path="/trades/:tradeId/record-entry"
            element={<PositionChangeForm facade={facade} timeZone="America/New_York" now={() => '2026-10-12T14:05:00Z'} onDirtyChange={() => undefined} />}
          />
        </Routes>
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
  return facade;
}

const row = (n: number) => screen.getByRole('group', { name: `Execution ${n}` });
async function fill(user: ReturnType<typeof userEvent.setup>, n: number, contracts: string, price: string) {
  await user.clear(within(row(n)).getByLabelText('Contracts'));
  await user.type(within(row(n)).getByLabelText('Contracts'), contracts);
  await user.clear(within(row(n)).getByLabelText('Price (per share)'));
  await user.type(within(row(n)).getByLabelText('Price (per share)'), price);
}

// Not in the breakdown: the receipts' lines are named by the role (C5, rows 20.12 and 20.13).
describe('option receipts', () => {
  const recorded = (trade: unknown, derivation: unknown, createdFactIds: string[], lotMatchChanges: unknown[] = []) => ({
    kind: 'Recorded',
    receipt: { tradeId: 'trade-1', createdFactIds, deviationReconciliation: [], entryChanges: [], repairs: [], lotMatchChanges, realizedToDate: { before: Rational.of(0n), after: Rational.of(0n) } },
    postCommit: { trade, derivation, reflection: { kind: 'Debt', debt: { debtId: 'debt-1' } } },
  });

  it('should name an entry receipts Execution lines by the role, the contract label, and the price, with no fee', () => {
    const { record, derivation } = optionTrade('O-S');
    render(
      <MemoryRouter>
        <PositionChangeReceipt result={recorded(record, { ...derivation, entryQuality: { kind: 'NotApplicable' } }, ['pc-s1']) as never} timeZone="America/New_York" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Sell to open 2 MNO 20 Nov 2026 45 Put')).toBeTruthy();
    expect(screen.getByText('@ $1.25')).toBeTruthy();
  });

  it('should name an exit receipts Execution line by the role and head the Lot Matches Opened and Closed', () => {
    const { record, derivation } = optionTrade('O-C');
    render(
      <MemoryRouter>
        <ExitReceipt result={recorded(record, derivation, ['pc-x1'], []) as never} timeZone="America/New_York" closeReasons={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Sell to close 1 XYZ 20 Nov 2026 55 Call')).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Lot Matches' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Opened', 'Closed', 'Quantity', 'Realized']);
  });
});

describe('option Executions (A117)', () => {
  it('should label the action Buy to open and Sell to close on a Long Call and Sell to open and Buy to close on a Cash-Secured Put, take contracts and premium, and show each rows cash amount', async () => {
    const user = userEvent.setup();
    const cases = [
      { leg: CALL_LEG, strategy: 'Long Call', held: 1n, action: 'Buy', words: 'Buy to open', contract: 'XYZ 20 Nov 2026 55 Call', planned: 'Long 2 contracts of XYZ 20 Nov 2026 55 Call', price: '2.10', amount: '= $210.00 for 1 contract', progress: '1 of 2 contracts entered' },
      { leg: CALL_LEG, strategy: 'Long Call', held: 2n, action: 'Sell', words: 'Sell to close', contract: 'XYZ 20 Nov 2026 55 Call', planned: 'Long 2 contracts of XYZ 20 Nov 2026 55 Call', price: '3.00', amount: '= $300.00 credit for 1 contract' },
      { leg: PUT_LEG, strategy: 'Cash-Secured Put', held: -1n, action: 'Sell', words: 'Sell to open', contract: 'MNO 20 Nov 2026 45 Put', planned: 'Short 2 contracts of MNO 20 Nov 2026 45 Put', price: '3.00', amount: '= $300.00 credit for 1 contract', progress: '1 of 2 contracts entered' },
      { leg: PUT_LEG, strategy: 'Cash-Secured Put', held: -2n, action: 'Buy', words: 'Buy to close', contract: 'MNO 20 Nov 2026 45 Put', planned: 'Short 2 contracts of MNO 20 Nov 2026 45 Put', price: '0.60', amount: '= $60.00 for 1 contract' },
    ] as const;
    for (const c of cases) {
      const exit = c.words.endsWith('close');
      const facade = renderForm(optionDetail(c.leg, c.strategy, c.held), exit ? 'Sell' : 'Buy');
      const terms = await screen.findByRole('region', { name: exit ? 'Exit' : 'Entry' });
      expect(within(terms).getByText('Contract')).toBeTruthy();
      expect(within(terms).getByText(c.contract)).toBeTruthy();
      expect(within(terms).queryByText('Symbol')).toBeNull();
      expect(within(terms).getByText(c.words)).toBeTruthy();
      expect(within(terms).getByText(c.planned)).toBeTruthy();
      if ('progress' in c) expect(screen.getByText(c.progress)).toBeTruthy();
      for (const label of ['Contracts', 'Price (per share)', 'Fee', 'Economic Time']) expect(within(row(1)).getByLabelText(label)).toBeTruthy();
      expect(within(row(1)).queryByLabelText('Quantity')).toBeNull();
      await fill(user, 1, '1', c.price);
      expect(within(row(1)).getByText(c.amount)).toBeTruthy();
      // The submitted Execution names the role's side and the contract itself, with a positive count.
      vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({ kind: 'Rejected', issues: [], binding: { databaseName: 'tj-ws-1', contentRevision: 7 } } as never);
      await user.type(within(row(1)).getByLabelText('Fee'), '0.65');
      await user.click(screen.getByRole('button', { name: exit ? 'Save exit' : 'Save entry' }));
      const command = vi.mocked(facade.TradeWorkflows.recordPositionChange).mock.lastCall![0] as unknown as { members: Record<string, unknown>[] };
      expect(command.members[0]).toMatchObject({ action: c.action, instrument: c.leg.instrument, intent: { kind: 'ServesPlannedLeg', plannedLegId: c.leg.factId }, quantity: '1', price: c.price });
      cleanup();
    }
  });

  it('should show Closing the Trade when the entered contracts total the open quantity, and say the position has only 2 contracts for a Buy 3 to close', async () => {
    const user = userEvent.setup();
    // A short position of 2 contracts is held as -2; the contracts entered are positive.
    const facade = renderForm(optionDetail(PUT_LEG, 'Cash-Secured Put', -2n), 'Sell');
    await screen.findByRole('group', { name: 'Execution 1' });
    const closing = () => screen.queryByRole('region', { name: 'Closing the Trade' });
    await fill(user, 1, '1', '0.60');
    expect(closing()).toBeNull();
    await fill(user, 1, '2', '0.60');
    expect(closing()).not.toBeNull();
    await fill(user, 1, '3', '0.60');
    expect(closing()).toBeNull();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({
      kind: 'Rejected',
      issues: [{ source: 'TradeAnalysis', member: 0, field: 'quantity', code: 'ExceedsOpenQuantity', available: Rational.of(2n) }],
      binding: { databaseName: 'tj-ws-1', contentRevision: 7 },
    } as never);
    await user.click(screen.getByRole('button', { name: 'Save exit' }));
    expect(await within(row(1)).findByText('Execution 1: The position has only 2 contracts.')).toBeTruthy();
  });
});

// Rows 20.7, 20.8, 20.9 and 20.11: an option form's errors and its conflict banner use contracts words.
describe('option form errors', () => {
  const reject = (facade: ReturnType<typeof renderForm>, issues: unknown[]) =>
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({ kind: 'Rejected', issues, binding: { databaseName: 'tj-ws-1', contentRevision: 7 } } as never);

  it('should word an option rows InvalidQuantity and ContractQuantityNotWhole each with its own contracts sentence', async () => {
    const user = userEvent.setup();
    const facade = renderForm(optionDetail(CALL_LEG, 'Long Call'), 'Buy');
    await screen.findByRole('group', { name: 'Execution 1' });
    await fill(user, 1, '1', '2.10');
    reject(facade, [{ source: 'TradeWorkflows', member: 0, field: 'quantity', code: 'InvalidQuantity' }]);
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    expect(await within(row(1)).findByText('Execution 1: enter a number of contracts greater than zero.')).toBeTruthy();
    reject(facade, [{ source: 'TradeAnalysis', member: 0, field: 'quantity', code: 'ContractQuantityNotWhole' }]);
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    expect(await within(row(1)).findByText('Execution 1: enter a whole number of contracts.')).toBeTruthy();
  });

  it('should word AfterExpiration on a new option Execution with the expiration date', async () => {
    const user = userEvent.setup();
    const facade = renderForm(optionDetail(CALL_LEG, 'Long Call'), 'Buy');
    await screen.findByRole('group', { name: 'Execution 1' });
    await fill(user, 1, '1', '2.10');
    reject(facade, [{ source: 'TradeAnalysis', member: 0, field: 'economicTime', code: 'AfterExpiration' }]);
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    expect(await within(row(1)).findByText('Execution 1: the Economic Time cannot be after the expiration date, Fri Nov 20.')).toBeTruthy();
  });

  it('should word the members issue for a later recorded exit with contracts', async () => {
    const user = userEvent.setup();
    const facade = renderForm(optionDetail(CALL_LEG, 'Long Call', 2n), 'Sell');
    await screen.findByRole('group', { name: 'Execution 1' });
    await fill(user, 1, '1', '2.10');
    reject(facade, [{ source: 'TradeAnalysis', code: 'FlatBeforeLaterFacts', field: 'quantity' }]);
    await user.click(screen.getByRole('button', { name: 'Save exit' }));
    expect((await screen.findAllByText('This exit would leave a later recorded exit without enough contracts in the position.')).length).toBeGreaterThan(0);
  });

  it('should show the option position in the conflict reload banner as a holding in words', async () => {
    const user = userEvent.setup();
    const facade = renderForm(optionDetail(CALL_LEG, 'Long Call'), 'Buy');
    await screen.findByRole('group', { name: 'Execution 1' });
    await fill(user, 1, '1', '2.10');
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({ kind: 'Conflict', changed: ['trade:trade-1'] } as never);
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    const message = await screen.findByRole('region', { name: 'This Trade changed after you opened this form' });
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({
      kind: 'Ready',
      view: optionDetail(CALL_LEG, 'Long Call', 1n),
      binding: { databaseName: 'tj-ws-1', contentRevision: 8 },
    } as never);
    await user.click(within(message).getByRole('button', { name: 'Load the latest Trade' }));
    const latest = await screen.findByRole('region', { name: 'Latest Trade' });
    expect(within(latest).getByText('Long 1 contract of XYZ 20 Nov 2026 55 Call')).toBeTruthy();
  });
});
