import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { fixedClock } from '../../domain/time/index.ts';
import { beginSemanticTransaction, createPersistence } from '../../persistence/index.ts';
import { TEST_SESSION_POLICY } from '../../../tests/support/session-policy.ts';
import { countRequests } from '../../../tests/support/request-counter.ts';
import { sequentialIds } from '../../../tests/support/workspace.ts';
import { createJournal, D2_JOURNAL_MANIFEST, type DebtProjection } from './index.ts';

// T5.4: Debt queries and the Trade narrative (D5 A63, A69). The Debt fixture, built through the
// public Journal operations. Economic Times are New York (UTC-4 in October 2026).
const NOW = '2026-10-13T21:00:00Z';
// Seeding manifest v2 on an empty Journal: j-0001 is Plan Reflection's revision, j-0002 this one's.
const DEFINITION = 'j-0002';
const MODE = 'prompt.position-change-reflection.decision-mode';
const EMOTION = 'prompt.position-change-reflection.primary-emotion';
const CONFIDENCE = 'prompt.position-change-reflection.decision-confidence';
const NOTE = 'prompt.position-change-reflection.note';
const answers = {
  [MODE]: { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
  [EMOTION]: { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
  [CONFIDENCE]: { kind: 'Scale', value: 4 },
  [NOTE]: { kind: 'Text', text: 'Filled the first tranche at the open.' },
} as const;

// The fixture's Debt, in the order they are recorded below (identities rise in that order, so
// D-1 sorts before D-4 at their shared anchor).
const FIXTURE = {
  'D-7': { trade: 'trade-A', pc: 'pc-3', at: '2026-10-13T14:00:00Z' },
  'D-2': { trade: 'trade-A', pc: 'pc-2', at: '2026-10-12T15:00:00Z' },
  'D-1': { trade: 'trade-A', pc: 'pc-1', at: '2026-10-12T14:00:00Z' },
  'D-6': { trade: 'trade-H', pc: 'pc-h', at: '2026-10-12T20:05:00Z' },
  'D-4': { trade: 'trade-E', pc: 'pc-e', at: '2026-10-12T14:00:00Z' },
  'D-5': { trade: 'trade-G', pc: 'pc-g', at: '2026-10-12T20:00:00Z' },
  'D-3': { trade: 'trade-F', pc: 'pc-f', at: '2026-10-09T18:00:00Z' },
} as const;

async function fixture() {
  const persistence = createPersistence({
    indexedDB: new IDBFactory(),
    ids: sequentialIds('ws'),
    writeGate: { current: () => null, recheck: () => Promise.resolve(null) },
    sessionPolicy: TEST_SESSION_POLICY,
  });
  const created = await persistence.createWorkspace([]);
  if (created.kind !== 'Created') throw new Error('workspace not created');
  const journal = createJournal({ persistence, ids: sequentialIds('j'), clock: fixedClock(NOW) });
  await journal.seedDefaults(D2_JOURNAL_MANIFEST);

  async function defer(trade: string, pc: string, momentTime: string): Promise<DebtProjection> {
    const prepared = await journal.prepareEffects({
      obligation: 'PositionChangeReflection',
      disposition: { kind: 'Defer' },
      anchor: { kind: 'Trade', ref: trade },
      origin: { kind: 'PositionChange', ref: `candidate:${pc}` },
      momentTime,
    });
    if (prepared.kind !== 'Prepared') throw new Error('expected Prepared');
    const tx = beginSemanticTransaction();
    const staged = journal.applyPreparedEffects(tx, prepared, { [`candidate:${pc}`]: pc });
    expect((await persistence.commit(tx.close())).kind).toBe('Committed');
    return staged.debts![0]!;
  }

  const debts = {} as Record<keyof typeof FIXTURE, DebtProjection>;
  for (const [name, { trade, pc, at }] of Object.entries(FIXTURE)) debts[name as keyof typeof FIXTURE] = await defer(trade, pc, at);
  return { journal, persistence, debts, defer };
}

describe('query: Outstanding Debt (A63)', () => {
  it('should return every Outstanding Debt, and no Settled or Declined one, in due-anchor then Debt-identity order with one getAll on byOutstandingDue (D-3, D-1, D-4, D-2, D-5, D-6, D-7)', async () => {
    const { journal, defer, debts } = await fixture();
    // One Settled and one Declined Debt on top of the fixture; neither may appear.
    const settled = await defer('trade-A', 'pc-s', '2026-10-12T16:00:00Z');
    const declined = await defer('trade-A', 'pc-x', '2026-10-12T17:00:00Z');
    expect((await journal.save({ intention: 'ResolveDebt', debtId: settled.debtId, expectedDebtRevision: settled.revision, resolution: { kind: 'Answer', form: { definitionId: DEFINITION, answers } } })).kind).toBe('Saved');
    expect((await journal.save({ intention: 'ResolveDebt', debtId: declined.debtId, expectedDebtRevision: declined.revision, resolution: { kind: 'Decline' } })).kind).toBe('Saved');

    const { result, requests } = await countRequests(() => journal.query({ scope: 'OutstandingDebt' }));

    expect(result.kind).toBe('Debts');
    expect(result.debts).toEqual(['D-3', 'D-1', 'D-4', 'D-2', 'D-5', 'D-6', 'D-7'].map((name) => debts[name as keyof typeof FIXTURE]));
    expect(result.debts.every((debt) => debt.status === 'Outstanding')).toBe(true);
    expect(requests.filter((r) => r.store === 'journalDebts')).toEqual([{ on: 'index', store: 'journalDebts', index: 'byOutstandingDue', method: 'getAll' }]);
  });
});

describe('query: Trade narrative (A69)', () => {
  it('should return one item per obligation: an Outstanding Debt as a Debt item, a settled Debt inside its Entry item marked answered later, and a declined Debt inside its decline item, in moment-time order, read with one getAll on byAnchorTrade', async () => {
    const { journal, debts } = await fixture();
    // Resolved out of moment-time order: D-2 declined first, then D-1 answered; D-7 stays Outstanding.
    const d2 = debts['D-2'];
    const d1 = debts['D-1'];
    expect((await journal.save({ intention: 'ResolveDebt', debtId: d2.debtId, expectedDebtRevision: d2.revision, resolution: { kind: 'Decline', reason: 'No view at the time.' } })).kind).toBe('Saved');
    expect((await journal.save({ intention: 'ResolveDebt', debtId: d1.debtId, expectedDebtRevision: d1.revision, resolution: { kind: 'Answer', form: { definitionId: DEFINITION, answers } } })).kind).toBe('Saved');

    const { result, requests } = await countRequests(() => journal.query({ scope: 'TradeNarrative', tradeId: 'trade-A' }));

    expect(result.items).toEqual([
      expect.objectContaining({
        kind: 'Entry',
        entryType: 'Position Change Reflection',
        momentTime: '2026-10-12T14:00:00Z',
        authoredTime: NOW,
        positionChangeId: 'pc-1',
        answeredLater: { debtId: d1.debtId, dueAnchor: d1.dueAnchor },
      }),
      expect.objectContaining({
        kind: 'Decline',
        momentTime: '2026-10-12T15:00:00Z',
        positionChangeId: 'pc-2',
        reason: 'No view at the time.',
        declinedLater: { debtId: d2.debtId, dueAnchor: d2.dueAnchor },
      }),
      {
        kind: 'Debt',
        id: debts['D-7'].debtId,
        entryType: 'Position Change Reflection',
        source: 'Position Change',
        anchor: { kind: 'Trade', tradeId: 'trade-A' },
        momentTime: '2026-10-13T14:00:00Z',
        positionChangeId: 'pc-3',
        definitionId: DEFINITION,
        dueAnchor: '2026-10-13T14:00:00Z',
        revision: debts['D-7'].revision,
      },
    ]);
    expect(requests.filter((r) => r.store === 'journalDebts')).toEqual([{ on: 'index', store: 'journalDebts', index: 'byAnchorTrade', method: 'getAll' }]);
  });
});
