// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardProgress, reflectionsOwedProgress } from '../../../tests/support/card-progress.ts';
import { expiredOptionTrade, OC_CONTRACT } from '../../../tests/support/option-trade-fixtures.ts';
import { exitFormFacade, plannedDetail, reflectionDefinition } from '../../../tests/support/position-change-form-facade.ts';
import type { DailyTradeReview, OpenDailyReviewResult, OwedReflection, OwedReflectionsCard, ReviewBinding, WalkedTrade } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ExpirationForm } from './ExpirationForm.tsx';
import { ReviewView } from './ReviewView.tsx';

afterEach(cleanup);

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;

// O-C on its expiration day, Friday 2026-11-20: one Long XYZ 55 Call is left, so the Trade is Settlement Due.
const DATE = '2026-11-20';
const CUTOFF = '2026-11-21T01:00:00Z';
const SETTLEMENT_TIME = '2026-11-20T21:00:00Z';
const binding: ReviewBinding = {
  workspace: { databaseName: 'tj-ws-1', contentRevision: 3 },
  catalogRevision: 1,
  journalRevision: 1,
  marketDataSnapshotId: 'mds1:1:abc',
  factRevisions: {},
  outstandingDebts: {},
};
const item = { tradeId: 'trade-1', instrument: OC_CONTRACT, quantity: Rational.of(1n), expiration: '2026-11-20', settlementTime: { kind: 'Value', value: SETTLEMENT_TIME } } as const;
const walked: WalkedTrade = {
  tradeId: 'trade-1',
  underlying: 'XYZ',
  lastActivity: '2026-11-17T15:00:00Z',
  band: 'Blocker',
  reasons: [{ code: 'SettlementDue', instrument: OC_CONTRACT, quantity: item.quantity, expiration: item.expiration }],
  basis: { kind: 'Value', value: { side: 'None', share: Rational.of(0n, 1n) } },
  rangePosition: { kind: 'Value', value: { now: Rational.of(1n, 2n), atEntry: Rational.of(1n, 2n) } },
  progress: cardProgress(0, 0, { settlement: true }),
};
const duringReview: Ready = {
  kind: 'Ready',
  reviewDate: DATE,
  cutoff: CUTOFF,
  families: [
    { family: 'Marks', today: [], earlier: [] },
    { family: 'Settlement', items: [item] },
    { family: 'Trades', trades: [walked] },
  ],
  owed: [],
  completion: { kind: 'Incomplete', reasons: [{ code: 'SettlementDue', ...item }, { code: 'ActionMissing', tradeId: 'trade-1' }] },
  binding,
};
const trade: DailyTradeReview = {
  tradeId: 'trade-1',
  underlying: 'XYZ',
  lifecycle: 'Open',
  attention: walked,
  labels: { strategy: 'Long Call', account: 'Main', institution: 'Broker' },
  settlement: [item],
  reflections: [],
  progress: walked.progress,
  form: { kind: 'New', viewState: { selectedAction: 'Hold' } },
  definitionRevision: 'def1',
  saveBinding: {
    reviewDate: DATE,
    tradeId: 'trade-1',
    factRevision: 4,
    marketDataSnapshotId: 'mds1:1:abc',
    obligationKey: { entryType: 'DailyTradeReview', trade: 'trade-1', reviewDate: DATE },
    definitionRevision: 'def1',
    databaseName: 'tj-ws-1',
  },
};

// After the Expiration is recorded the Trade is Closed, so it has left the walk; its Position Change Reflection is owed.
const expiration = { factId: 'exp-1', economicTime: SETTLEMENT_TIME, recordedSequence: 4, instrument: OC_CONTRACT, quantity: '1' };
const owedReflection: OwedReflection = {
  debtId: 'd-1',
  entryType: 'Position Change Reflection',
  definition: reflectionDefinition,
  economicTime: SETTLEMENT_TIME,
  executions: [],
  settlements: [expiration],
  classification: 'Due',
  saveBinding: { debtId: 'd-1', debtRevision: 'd-1-rev-1', definitionRevision: 'def-pcr-1' },
};
const owedCard: OwedReflectionsCard = {
  tradeId: 'trade-1',
  underlying: 'XYZ',
  lifecycle: 'Closed',
  labels: { strategy: 'Long Call', account: 'Main', institution: 'Broker' },
  reflections: [owedReflection],
  progress: reflectionsOwedProgress(1, 0),
};
const afterReview: Ready = {
  kind: 'Ready',
  reviewDate: DATE,
  cutoff: CUTOFF,
  families: [
    { family: 'Marks', today: [], earlier: [] },
    { family: 'Trades', trades: [] },
  ],
  owed: [{ tradeId: 'trade-1', underlying: 'XYZ', lifecycle: 'Closed', owed: [{ debtId: 'd-1', entryTypeKey: 'entry-type.position-change-reflection', dueAnchor: SETTLEMENT_TIME, classification: 'Due' }], progress: owedCard.progress }],
  completion: { kind: 'Incomplete', reasons: [{ code: 'ReflectionDue', tradeId: 'trade-1', debtIds: ['d-1'] }] },
  binding,
};

// The expiration form's own Trade Detail: the Trade is due for settlement.
const dueDetail = {
  ...plannedDetail,
  factRevision: 4,
  plan: { ...plannedDetail.plan, underlying: 'XYZ', legs: [{ factId: 'leg-oc', side: 'Long', instrument: OC_CONTRACT, quantity: '2', intendedEntry: '2.00' }] },
  labels: { ...plannedDetail.labels, strategy: 'Long Call' },
  lifecycle: { stored: 'Open', agreement: { kind: 'Agrees' } },
  positions: [{ instrument: OC_CONTRACT, quantity: Rational.of(1n), openLots: [] }],
  settlement: [item],
};
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

describe('record expiration from the Review (A113, conflict K14)', () => {
  it('should open the expiration form from the Settlement panel and, after Save, offer Back to the Review, where the recorded Expiration shows on the Trade owed reflection, with no Refresh Review', async () => {
    const user = userEvent.setup();
    const facade = exitFormFacade(dueDetail);
    vi.mocked(facade.DailyReview.open).mockResolvedValueOnce(duringReview).mockResolvedValueOnce(afterReview);
    vi.mocked(facade.DailyReview.getTrade).mockResolvedValueOnce({ kind: 'Ready', reviewDate: DATE, cutoff: CUTOFF, trade }).mockResolvedValueOnce({ kind: 'ReflectionsOwed', reviewDate: DATE, cutoff: CUTOFF, card: owedCard });
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(expirationResult() as never);
    render(
      <RuntimeContext.Provider value={{ writable: true, timeZone: 'America/New_York', report: () => undefined }}>
        <MemoryRouter initialEntries={['/review']}>
          <Routes>
            <Route path="/review" element={<ReviewView facade={facade} now={() => '2026-11-20T22:00:00Z'} onDirtyChange={() => undefined} />} />
            <Route path="/trades/:tradeId/record-expiration" element={<ExpirationForm facade={facade} timeZone="America/New_York" onDirtyChange={() => undefined} />} />
          </Routes>
        </MemoryRouter>
      </RuntimeContext.Provider>,
    );

    // The Settlement panel's link opens the form on its own page.
    const card = await screen.findByRole('region', { name: 'XYZ review' });
    await user.click(within(card).getByRole('link', { name: 'Record expiration' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Expiration' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();

    // Its receipt offers the way back, and no refresh of the Review.
    await user.click(await screen.findByRole('button', { name: 'Save expiration' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Expiration recorded' })).toBeTruthy();
    expect(screen.queryByText('Refresh Review')).toBeNull();
    await user.click(screen.getByRole('link', { name: 'Back to the Review' }));

    // The Review is read again: the Trade has left the walk, and its owed reflection names the recorded Expiration.
    const owedTrade = await screen.findByRole('region', { name: 'XYZ review' });
    expect(within(owedTrade).getByText('Expiration of 1 XYZ 20 Nov 2026 55 Call, no price or fee')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Record expiration' })).toBeNull();
  });
});
