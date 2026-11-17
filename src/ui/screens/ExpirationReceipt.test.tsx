// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expiredOptionTrade } from '../../../tests/support/option-trade-fixtures.ts';
import { instrumentOf } from '../../domain/instrument/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { ExpirationReceipt } from './ExpirationReceipt.tsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// The saved Expiration is of a contract that expires 2027-01-15, rendered at New York's New Year, when UTC is already 2027.
function receiptProps() {
  const { record, derivation } = expiredOptionTrade('O-C');
  const rename = (change: (typeof record.positionChanges)[number]) =>
    change.settlements ? { ...change, settlements: change.settlements.map((s) => ({ ...s, instrument: instrumentOf('XYZ270115C00055000') })) } : change;
  const positionChanges = record.positionChanges.map(rename);
  const settled = positionChanges.find((c) => c.settlements)!;
  const trade = { ...record, storedLifecycle: 'Closed' as const, positionChanges };
  const result = {
    kind: 'Recorded' as const,
    receipt: { tradeId: 'trade-1', createdFactIds: [settled.factId], deviationReconciliation: [], entryChanges: [], repairs: [], lotMatchChanges: [], realizedToDate: { before: Rational.of(0n), after: derivation.realizedToDate } },
    postCommit: { trade, derivation, reflection: { kind: 'Entry', entry: { id: 'entry-1' } }, closeReview: { kind: 'Entry', entry: { id: 'entry-2' } } },
  };
  return { result: result as never, timeZone: 'America/New_York', fromReview: false };
}

describe('contract names in the Workspace zone (A238)', () => {
  it('should name a settled contract on the Expiration receipt with its year decided in the Workspace zone', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2027-01-01T03:00:00Z') });
    render(
      <MemoryRouter>
        <ExpirationReceipt {...receiptProps()} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/^Expiration of 1 /).textContent).toContain('XYZ Jan 15 2027');
  });
});
