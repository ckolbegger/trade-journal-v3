// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { openItem, plannedItem } from '../../../tests/support/views-fixtures.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { TradeList } from './TradeList.tsx';

// The current year is read from the clock, so the tests fix it: expirations in 2026 are this year's.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-08T17:00:00Z') });
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function renderList(items: readonly unknown[], lifecycle: 'Open' | 'Planned' | 'Closed') {
  const facade = facadeDouble();
  vi.mocked(facade.TradeViewsAndReporting.browseTrades).mockResolvedValue({ kind: 'Ready', view: { items }, binding: {} } as never);
  render(
    <RuntimeContext.Provider value={{ writable: true, timeZone: 'America/New_York', report: () => undefined }}>
      <MemoryRouter initialEntries={[`/?lifecycle=${lifecycle}`]}>
        <TradeList facade={facade} />
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}

const put = { kind: 'Option', symbol: 'MNO', root: 'MNO', expiration: '2026-11-20', strike: '45', right: 'Put', multiplier: 100 } as const;
const shortPut = { kind: 'Option', direction: 'Short', contracts: Rational.of(2n), expiration: '2026-11-20', strike: '45', right: 'Put' } as const;
const longCall = { kind: 'Option', direction: 'Long', contracts: Rational.of(2n), expiration: '2026-11-20', strike: '55', right: 'Call' } as const;

// The row of a table by its Underlying link.
const rowOf = (table: HTMLElement, underlying: string) => within(table).getByRole('link', { name: underlying }).closest('tr')!;
const cells = (row: HTMLElement) => within(row).getAllByRole('cell');

describe('option rows (A119)', () => {
  it('should show the Trade summary on Planned, Open and Closed option rows, and Settlement Due as text on an Open row that needs it', async () => {
    renderList([{ ...plannedItem, tradeId: 'trade-p', underlying: 'XYZ', strategy: 'Long Call', summary: longCall }], 'Planned');
    const planned = await screen.findByRole('region', { name: 'Planned Trades' });
    expect(cells(rowOf(planned, 'XYZ'))[1]?.textContent).toContain('Long 2 Nov 20 $55 Call');
    cleanup();

    // O-S on the expiration date after the settlement time: the row carries the settlement item Detail's panel
    // shows, while its P&L still awaits the close (K4, row A113).
    const dueItem = { tradeId: 'trade-o', instrument: put, quantity: Rational.of(-2n), expiration: '2026-11-20', settlementTime: '2026-11-20T21:00:00Z' } as const;
    renderList(
      [
        {
          ...openItem,
          tradeId: 'trade-o',
          underlying: 'MNO',
          strategy: 'Cash-Secured Put',
          summary: shortPut,
          netCost: { kind: 'Value', value: Rational.of(-24870n, 100n) },
          settlement: [dueItem],
        },
        { ...openItem, tradeId: 'trade-q', underlying: 'ABC', summary: longCall },
      ],
      'Open',
    );
    const open = await screen.findByRole('region', { name: 'Open Trades' });
    const dueRow = rowOf(open, 'MNO');
    expect(cells(dueRow)[1]?.textContent).toContain('Short 2 Nov 20 $45 Put');
    expect(within(cells(dueRow)[1]!).getByText('Settlement Due', { selector: '.badge' })).toBeTruthy();
    expect(cells(dueRow)[2]?.textContent).toBe('$248.70 credit');
    // A row not past its expiration says nothing of settlement.
    expect(within(cells(rowOf(open, 'ABC'))[1]!).queryByText('Settlement Due', { selector: '.badge' })).toBeNull();
    cleanup();

    // Closed rows: the summary, then how the exposure ended (rows 23.14 and 23.15).
    const closed = (tradeId: string, underlying: string, summary: unknown, mechanisms: readonly { mechanism: string; quantity: Rational }[], timing: string, closeReason?: { id: string; label: string }) => ({
      tradeId,
      underlying,
      strategy: 'Long Call',
      account: 'Roth IRA',
      institution: 'Fidelity',
      summary,
      netRealizedPnl: Rational.of(55n),
      realizedR: { kind: 'Value', value: Rational.of(1n) },
      terminalDisposition: { kind: 'Value', value: mechanisms },
      optionDispositionTiming: { kind: 'Value', value: { timing, disposedByExecutions: Rational.of(1n), disposedBySettlement: Rational.of(1n) } },
      ...(closeReason && { closeReason }),
      terminalTime: '2026-11-20T22:00:00Z',
      deviationCount: 0,
      reflectionOwed: false,
      integrity: 'Agrees',
    });
    const one = Rational.of(1n);
    renderList(
      [
        closed('c-1', 'XYZ', longCall, [{ mechanism: 'Executions', quantity: one }, { mechanism: 'Expiration', quantity: one }], 'Mixed'),
        closed('c-2', 'MNO', shortPut, [{ mechanism: 'Executions', quantity: Rational.of(2n) }], 'FullyDisposedPreExpiration', { id: 'cr-1', label: 'Target reached' }),
        closed('c-3', 'ABC', shortPut, [{ mechanism: 'Expiration', quantity: Rational.of(2n) }], 'FullyHeldToExpirationSettlement'),
      ],
      'Closed',
    );
    const list = await screen.findByRole('region', { name: 'Closed Trades' });
    const columns = within(list).getAllByRole('columnheader').map((h) => h.textContent);
    const at = (underlying: string, header: string) => cells(rowOf(list, underlying))[columns.indexOf(header)]?.textContent;
    expect(cells(rowOf(list, 'XYZ'))[1]?.textContent).toContain('Long 2 Nov 20 $55 Call');
    expect(at('XYZ', 'Disposition')).toBe('Closed via sale and expiration · Mixed');
    expect(at('XYZ', 'Close Reason')).toBe('Not needed');
    expect(at('MNO', 'Disposition')).toBe('Closed via buyback · Fully disposed before expiration');
    expect(at('MNO', 'Close Reason')).toBe('Target reached');
    expect(at('ABC', 'Disposition')).toBe('Closed via expiration · Fully held to expiration');
    expect(at('ABC', 'Close Reason')).toBe('Not needed');
  });
});
