import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import type { TradeAnalysisRecord } from '../../domain/trade-analysis/index.ts';
import { Rational } from '../../domain/values/index.ts';
import type { ReflectionDisposition } from '../../modules/journal/index.ts';
import { dumpAll } from '../../../tests/support/stack.ts';
import { onboardedStack } from '../../../tests/support/onboarded.ts';
import type { PositionChangeCommand, PositionChangeMember } from './index.ts';

// D2's reference Trade (breakdown, section 4): 100 shares, intended entry 50, Stop 47.50, Target 56,
// confirmed 2026-10-12 09:00 America/New_York. The clock reads 17:00 that day, after the close.
const NOW = '2026-10-12T21:00:00Z';
const PLAN_TIME = '2026-10-12T13:00:00Z';
const PC1 = '2026-10-12T14:00:00Z';
const PC2 = '2026-10-12T15:00:00Z';
const PC3 = '2026-10-12T18:00:00Z';

type Stack = Awaited<ReturnType<typeof onboardedStack>>;

interface Reference {
  readonly stack: Stack;
  readonly trade: TradeAnalysisRecord;
  readonly reflectionDefinitionId: string;
}

async function referenceTrade(): Promise<Reference> {
  const stack = await onboardedStack(new IDBFactory(), NOW);
  const confirmed = await stack.tradeWorkflows.confirmPlan({
    accountId: stack.account.id,
    accountRevision: stack.account.recordRevision,
    strategyId: stack.strategy.id,
    strategyRevision: stack.strategy.recordRevision,
    economicTime: PLAN_TIME,
    plan: {
      underlying: 'XYZ',
      legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50.00' }],
      stops: [{ kind: 'UnderlyingPrice', price: '47.50' }],
      targets: [{ kind: 'UnderlyingPrice', price: '56.00' }],
    },
    reflection: {
      definitionId: stack.definition.id,
      answers: {
        'prompt.plan-reflection.thesis': { kind: 'Text', text: 'Breakout above the 50-day on volume.' },
        'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close back below 48.' },
      },
    },
  });
  if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${confirmed.kind}`);
  const definition = await stack.journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  if (definition.kind !== 'Found') throw new Error('no Position Change Reflection definition');
  return { stack, trade: confirmed.postCommit.trade, reflectionDefinitionId: definition.definition.id };
}

function buy(ref: Reference, economicTime: string, quantity: string, price: string, overrides: Partial<PositionChangeMember> = {}): PositionChangeMember {
  return {
    kind: 'Execution',
    tradeId: ref.trade.tradeId,
    action: 'Buy',
    instrument: { kind: 'Stock', symbol: 'XYZ' },
    intent: { kind: 'ServesPlannedLeg', plannedLegId: ref.trade.plan.legs[0]!.factId },
    quantity,
    price,
    fee: '1.00',
    economicTime,
    ...overrides,
  };
}

function complete(ref: Reference): ReflectionDisposition {
  return {
    kind: 'Complete',
    form: {
      definitionId: ref.reflectionDefinitionId,
      answers: {
        'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
        'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
        'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
      },
    },
  };
}

function command(
  ref: Reference,
  expectedFactRevision: number,
  members: readonly PositionChangeMember[],
  reflection: ReflectionDisposition = complete(ref),
): PositionChangeCommand {
  return {
    originTradeId: ref.trade.tradeId,
    trades: [{ tradeId: ref.trade.tradeId, expectedFactRevision }],
    members,
    reflection,
  };
}

// Records each Position Change in turn with a completed reflection, from the Plan's FactRevision 1.
async function recordAll(ref: Reference, changes: readonly (readonly PositionChangeMember[])[]) {
  let factRevision = 1;
  for (const members of changes) {
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, factRevision, members));
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${result.kind}`);
    factRevision = result.receipt.factRevision;
  }
  return factRevision;
}

function workspaceStores(dump: Awaited<ReturnType<typeof dumpAll>>) {
  return Object.entries(dump).find(([name]) => name.startsWith('tj-ws-'))![1];
}

const contentRevision = (stores: Record<string, unknown[]>) =>
  (stores['meta'] as { key: string; contentRevision?: number }[]).find((m) => m.key === 'content')!.contentRevision!;

describe('accepted opening Position Change', () => {
  it('should commit the Position Change, its Executions, the Open lifecycle-index move, Deviation actions, and the reflection Entry in one semantic commit', async () => {
    const ref = await referenceTrade();
    const before = workspaceStores(await dumpAll(ref.stack.factory));
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, 1, [buy(ref, PC1, '60', '50.10')]));
    expect(result.kind).toBe('Recorded');
    const after = workspaceStores(await dumpAll(ref.stack.factory));
    const trade = (after['trades'] as { lifecycle: string; factRevision: number; facts: { kind: string; factId: string }[]; deviations?: unknown[] }[])[0]!;
    expect(trade).toEqual(expect.objectContaining({ lifecycle: 'Open', factRevision: 2, lastActivity: PC1 }));
    expect(trade.facts.map((f) => f.kind)).toEqual(['Plan', 'PlannedLeg', 'Stop', 'Target', 'PositionChange', 'Execution']);
    // The Reference Trade's first Position Change leaves no Entry Size excess to record.
    expect(trade.deviations).toEqual([]);
    const pcId = trade.facts[4]!.factId;
    expect(after['journalEntries']).toEqual([
      expect.objectContaining({ entryTypeKey: 'entry-type.plan-reflection' }),
      expect.objectContaining({
        entryTypeKey: 'entry-type.position-change-reflection',
        sourceKey: 'source.position-change',
        anchor: { kind: 'Trade', tradeId: ref.trade.tradeId },
        origin: { kind: 'PositionChange', factId: pcId },
        // The reflection's moment is the Position Change's Economic Time (D2 A19).
        momentTime: PC1,
      }),
    ]);
    expect(after['journalObligations']).toContainEqual(
      expect.objectContaining({ obligationKey: `PositionChangeReflection:${pcId}`, outcome: expect.objectContaining({ kind: 'Entry' }) as unknown }),
    );
    // One semantic commit: the content revision advanced exactly once.
    expect(contentRevision(after)).toBe(contentRevision(before) + 1);
  });

  it('should return TradeMutationSuccess: new FactRevision, created fact identities, the lifecycle transition Planned to Open, the Entry or decline identity, the post-commit Trade projection, its derivation with Position, Lots, Entry status, Entry Quality, Fulfillment, Deviations, the Journal outcome projection, and the affected Open and Planned list scopes', async () => {
    const ref = await referenceTrade();
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, 1, [buy(ref, PC1, '60', '50.10')]));
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${result.kind}`);
    const { receipt, postCommit, affected } = result;
    const stored = workspaceStores(await dumpAll(ref.stack.factory));
    const facts = (stored['trades'] as { facts: { factId: string }[] }[])[0]!.facts;
    expect(receipt).toEqual(
      expect.objectContaining({
        tradeId: ref.trade.tradeId,
        factRevision: 2,
        // The Position Change, then its Execution.
        createdFactIds: [facts[4]!.factId, facts[5]!.factId],
        lifecycleTransitions: [{ tradeId: ref.trade.tradeId, from: 'Planned', to: 'Open' }],
        reflection: { kind: 'Entry', id: postCommit.reflection.kind === 'Entry' ? postCommit.reflection.entry.id : 'none' },
      }),
    );
    expect(receipt.binding.contentRevision).toBe(contentRevision(stored));
    expect(postCommit.trade).toEqual(expect.objectContaining({ tradeId: ref.trade.tradeId, factRevision: 2, storedLifecycle: 'Open' }));
    expect(postCommit.trade.positionChanges.map((pc) => pc.factId)).toEqual([facts[4]!.factId]);
    const { derivation } = postCommit;
    expect(derivation.factRevision).toBe(2);
    expect(derivation.agreement).toEqual({ kind: 'Agrees' });
    expect(derivation.positions).toHaveLength(1);
    expect(derivation.positions[0]!.quantity.equals(Rational.of(60n))).toBe(true);
    expect(derivation.positions[0]!.openLots.map((l) => l.openingExecutionId)).toEqual([facts[5]!.factId]);
    expect(derivation.entryResolution).toEqual({ kind: 'Unresolved' });
    expect(derivation.entryQuality).toEqual({ kind: 'NotApplicable', reason: 'EntryNotResolved' });
    expect(derivation.legFulfillment).toEqual([{ plannedLegId: ref.trade.plan.legs[0]!.factId, fulfillment: 'PartiallyFilled' }]);
    expect(derivation.deviations).toEqual([]);
    expect(postCommit.reflection).toEqual({
      kind: 'Entry',
      entry: expect.objectContaining({
        entryTypeKey: 'entry-type.position-change-reflection',
        anchor: { kind: 'Trade', tradeId: ref.trade.tradeId },
        origin: { kind: 'PositionChange', factId: facts[4]!.factId },
        momentTime: PC1,
        authoredTime: NOW,
      }) as unknown,
    });
    expect(affected).toEqual([
      { scope: 'TradeList', lifecycle: 'Open' },
      { scope: 'TradeList', lifecycle: 'Planned' },
    ]);
  });

  it('should record a decline instead of an Entry when the disposition is Decline', async () => {
    const ref = await referenceTrade();
    const decline: ReflectionDisposition = { kind: 'Decline', definitionId: ref.reflectionDefinitionId, reason: 'Routine fill.' };
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, 1, [buy(ref, PC1, '60', '50.10')], decline));
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${result.kind}`);
    const stored = workspaceStores(await dumpAll(ref.stack.factory));
    const pcId = (stored['trades'] as { facts: { factId: string }[] }[])[0]!.facts[4]!.factId;
    expect(stored['journalEntries']).toEqual([expect.objectContaining({ entryTypeKey: 'entry-type.plan-reflection' })]);
    expect(stored['journalDeclines']).toEqual([
      expect.objectContaining({
        entryTypeKey: 'entry-type.position-change-reflection',
        anchor: { kind: 'Trade', tradeId: ref.trade.tradeId },
        origin: { kind: 'PositionChange', factId: pcId },
        reason: 'Routine fill.',
        momentTime: PC1,
      }),
    ]);
    const declineId = (stored['journalDeclines'] as { id: string }[])[0]!.id;
    expect(result.receipt.reflection).toEqual({ kind: 'Decline', id: declineId });
    expect(result.postCommit.reflection).toEqual({
      kind: 'Decline',
      decline: expect.objectContaining({ id: declineId, origin: { kind: 'PositionChange', factId: pcId }, reason: 'Routine fill.' }) as unknown,
    });
  });

  it('should keep the Trade Open and add PC3s Entry Size occurrence to the receipts Deviation reconciliation', async () => {
    const ref = await referenceTrade();
    await recordAll(ref, [[buy(ref, PC1, '60', '50.10')], [buy(ref, PC2, '40', '50.30')]]);
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, 3, [buy(ref, PC3, '20', '51.00')]));
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${result.kind}`);
    const pc3 = result.receipt.createdFactIds[0]!;
    expect(result.postCommit.trade.storedLifecycle).toBe('Open');
    expect(result.receipt.lifecycleTransitions).toEqual([]);
    expect(result.affected).toEqual([{ scope: 'TradeList', lifecycle: 'Open' }]);
    const occurrence = result.postCommit.trade.recordedDeviations![0]!;
    expect(result.receipt.deviationReconciliation).toEqual([
      {
        action: 'Create',
        occurrenceId: occurrence.occurrenceId,
        version: {
          fingerprint: { tradeId: ref.trade.tradeId, plannedLegId: ref.trade.plan.legs[0]!.factId, positionChangeId: pc3 },
          type: 'EntrySize',
          form: 'Excess',
          quantityAbovePlan: '20',
          causingPositionChangeId: pc3,
          economicTime: PC3,
          status: 'Active',
        },
      },
    ]);
    expect(result.postCommit.derivation.legFulfillment[0]!.fulfillment).toBe('FilledWithDeviation');
  });
});

describe('earlier-dated entry P5', () => {
  it('should accept an Execution dated between the Plan and the Trades latest fact, and disclose in the receipt that the Entry Resolution Point and Entry Quality changed', async () => {
    const ref = await referenceTrade();
    const PC_EARLY = '2026-10-12T14:30:00Z';
    const factRevision = await recordAll(ref, [[buy(ref, PC1, '60', '50.10')], [buy(ref, PC2, '60', '50.30')]]);
    const pc2 = (await ref.stack.tradeRecord.getRecord({ tradeId: ref.trade.tradeId, projection: 'AnalysisInput' })) as {
      projection: TradeAnalysisRecord;
    };
    const pc2Id = pc2.projection.positionChanges[1]!.factId;
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, factRevision, [buy(ref, PC_EARLY, '40', '50.20')]));
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${result.kind}`);
    const early = result.receipt.createdFactIds[0]!;
    expect(result.postCommit.derivation.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: early });
    const [moved, quality] = result.receipt.entryChanges;
    expect(moved).toEqual({ kind: 'EntryResolutionMoved', from: pc2Id, to: early });
    if (quality?.kind !== 'EntryQualityChanged' || quality.from.kind !== 'Value' || quality.to.kind !== 'Value') {
      throw new Error('expected an Entry Quality change between two resolved values');
    }
    // Over PC1 and PC2 before; over PC1 and the earlier-dated Position Change after.
    expect(quality.from.value.averageEntry).toEqual({ kind: 'Value', value: Rational.of(5020n, 100n) });
    expect(quality.to.value.averageEntry).toEqual({ kind: 'Value', value: Rational.of(5014n, 100n) });
    expect(result.receipt.entryChanges).toHaveLength(2);
    // PC2's occurrence now carries all 60 of its shares above plan.
    expect(result.receipt.deviationReconciliation).toEqual([
      expect.objectContaining({ action: 'NewVersion', version: expect.objectContaining({ quantityAbovePlan: '60', causingPositionChangeId: pc2Id }) as unknown }),
    ]);
  });
});

// The integrity fixture writer: rewrites one stored Trade document with the raw IndexedDB API,
// as a defect or a hand edit would, bypassing every module.
async function rewriteTrade(ref: Reference, change: (document: Record<string, unknown>) => Record<string, unknown>) {
  const dump = await dumpAll(ref.stack.factory);
  const name = Object.keys(dump).find((n) => n.startsWith('tj-ws-'))!;
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = ref.stack.factory.open(name);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('open failed'));
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('trades', 'readwrite');
    const store = tx.objectStore('trades');
    const read = store.get(ref.trade.tradeId);
    read.onsuccess = () => store.put(change(read.result as Record<string, unknown>));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('write failed'));
  });
  db.close();
}

describe('integrity before the change P7', () => {
  it('should commit and list each repair in the receipt when the Trades stored lifecycle or recorded Deviations disagree with coherent facts', async () => {
    const ref = await referenceTrade();
    const factRevision = await recordAll(ref, [[buy(ref, PC1, '60', '50.10')], [buy(ref, PC2, '40', '50.30')], [buy(ref, PC3, '20', '51.00')]]);
    const stored = await ref.stack.tradeRecord.getRecord({ tradeId: ref.trade.tradeId, projection: 'AnalysisInput' });
    if (stored.kind !== 'Found') throw new Error('no Trade');
    const pc3 = (stored.projection as TradeAnalysisRecord).positionChanges[2]!.factId;
    await rewriteTrade(ref, (document) => ({ ...document, lifecycle: 'Planned', deviations: [] }));
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, factRevision, [buy(ref, '2026-10-12T19:00:00Z', '10', '51.20')]));
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${result.kind}`);
    const legId = ref.trade.plan.legs[0]!.factId;
    expect(result.receipt.repairs).toEqual([
      { kind: 'LifecycleDisagreement', stored: 'Planned', expected: 'Open' },
      expect.objectContaining({ kind: 'DeviationMissing', fingerprint: { tradeId: ref.trade.tradeId, plannedLegId: legId, positionChangeId: pc3 } }),
    ]);
    // The expected records are written: Open again, and PC3's occurrence recorded next to the new one.
    expect(result.postCommit.trade.storedLifecycle).toBe('Open');
    expect(result.receipt.lifecycleTransitions).toEqual([{ tradeId: ref.trade.tradeId, from: 'Planned', to: 'Open' }]);
    expect(result.receipt.deviationReconciliation.map((d) => [d.action, d.version.causingPositionChangeId, d.version.quantityAbovePlan])).toEqual([
      ['Create', pc3, '20'],
      ['Create', result.receipt.createdFactIds[0], '10'],
    ]);
    expect(result.postCommit.derivation.findings).toEqual([]);
  });

  it('should return IntegrityDisagreement with the findings and write nothing when the Trades facts are incoherent', async () => {
    const ref = await referenceTrade();
    const factRevision = await recordAll(ref, [[buy(ref, PC1, '60', '50.10')]]);
    type StoredFact = { factId: string; kind: string; versions: { value: Record<string, unknown> }[] };
    let execution = '';
    await rewriteTrade(ref, (document) => ({
      ...document,
      facts: (document['facts'] as StoredFact[]).map((fact) => {
        if (fact.kind !== 'Execution') return fact;
        execution = fact.factId;
        return { ...fact, versions: fact.versions.map((v) => ({ ...v, value: { ...v.value, intent: { kind: 'ServesPlannedLeg', plannedLegId: 'no-such-leg' } } })) };
      }),
    }));
    const before = await dumpAll(ref.stack.factory);
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, factRevision, [buy(ref, PC2, '40', '50.30')]));
    expect(result).toEqual({
      kind: 'IntegrityDisagreement',
      tradeId: ref.trade.tradeId,
      findings: [{ factId: execution, reason: 'UnknownPlannedLeg' }],
    });
    expect(await dumpAll(ref.stack.factory)).toEqual(before);
  });
});

describe('rejected', () => {
  it('should reject an Execution before the Plans Economic Time with EconomicTimeBeforePlan, and one in the future with EconomicTimeInFuture', async () => {
    const ref = await referenceTrade();
    const before = await dumpAll(ref.stack.factory);
    expect(await ref.stack.tradeWorkflows.recordPositionChange(command(ref, 1, [buy(ref, '2026-10-12T12:59:59Z', '60', '50.10')]))).toEqual({
      kind: 'Rejected',
      binding: expect.any(Object) as unknown,
      issues: [{ source: 'TradeWorkflows', member: 0, field: 'economicTime', code: 'EconomicTimeBeforePlan' }],
    });
    expect(
      await ref.stack.tradeWorkflows.recordPositionChange(command(ref, 1, [buy(ref, PC1, '60', '50.10'), buy(ref, '2026-10-12T21:00:01Z', '40', '50.30')])),
    ).toEqual({
      kind: 'Rejected',
      binding: expect.any(Object) as unknown,
      issues: [{ source: 'TradeWorkflows', member: 1, field: 'economicTime', code: 'EconomicTimeInFuture' }],
    });
    expect(await dumpAll(ref.stack.factory)).toEqual(before);
  });

  it('should reject a Sell, another Instrument, ExplicitlyUnplanned intent, or a second Trade with VariantNotInstalled', async () => {
    const ref = await referenceTrade();
    const before = await dumpAll(ref.stack.factory);
    const member = buy(ref, PC1, '60', '50.10');
    const attempts: [PositionChangeCommand, string][] = [
      [command(ref, 1, [{ ...member, action: 'Sell' }]), 'Sell'],
      [command(ref, 1, [{ ...member, instrument: { kind: 'Stock', symbol: 'ABC' } }]), 'OtherInstrument'],
      [command(ref, 1, [{ ...member, instrument: { kind: 'Option', symbol: 'XYZ261120C00055000' } }]), 'OtherInstrument'],
      [command(ref, 1, [{ ...member, intent: { kind: 'ExplicitlyUnplanned' } }]), 'ExplicitlyUnplanned'],
      [
        { ...command(ref, 1, [member, { ...member, tradeId: 'trade-2' }]), trades: [{ tradeId: ref.trade.tradeId, expectedFactRevision: 1 }, { tradeId: 'trade-2', expectedFactRevision: 1 }] },
        'MultipleTrades',
      ],
    ];
    for (const [attempt, variant] of attempts) {
      expect(await ref.stack.tradeWorkflows.recordPositionChange(attempt)).toEqual({ kind: 'VariantNotInstalled', variants: [variant] });
    }
    expect(await dumpAll(ref.stack.factory)).toEqual(before);
  });

  it('should reject zero or negative quantity or price, a negative fee, a missing fee, or more than 20 Executions with typed issues, all at once together with Journal issues', async () => {
    const ref = await referenceTrade();
    const before = await dumpAll(ref.stack.factory);
    const withoutFee: PositionChangeMember = { ...buy(ref, PC1, '5', '50.10') };
    delete (withoutFee as { fee?: string }).fee;
    const members: PositionChangeMember[] = [
      buy(ref, PC1, '0', '50.10'),
      buy(ref, PC1, '5', '-50.10'),
      buy(ref, PC1, '-5', '0', { fee: '-0.01' }),
      withoutFee,
      buy(ref, PC1, '1.1234567', '50.10'),
      ...Array.from({ length: 16 }, () => buy(ref, PC1, '1', '50.10')),
    ];
    const incomplete = complete(ref);
    if (incomplete.kind !== 'Complete') throw new Error('expected Complete');
    const answers = { ...incomplete.form.answers };
    delete answers['prompt.position-change-reflection.decision-confidence'];
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, 1, members, { kind: 'Complete', form: { ...incomplete.form, answers } }));
    expect(result).toEqual({
      kind: 'Rejected',
      binding: expect.any(Object) as unknown,
      issues: [
        { source: 'TradeWorkflows', field: 'members', code: 'TooManyExecutions' },
        { source: 'TradeWorkflows', member: 0, field: 'quantity', code: 'NotPositive' },
        { source: 'TradeWorkflows', member: 1, field: 'price', code: 'NotPositive' },
        { source: 'TradeWorkflows', member: 2, field: 'quantity', code: 'NotPositive' },
        { source: 'TradeWorkflows', member: 2, field: 'price', code: 'NotPositive' },
        { source: 'TradeWorkflows', member: 2, field: 'fee', code: 'Negative' },
        { source: 'TradeWorkflows', member: 3, field: 'fee', code: 'Required' },
        { source: 'TradeWorkflows', member: 4, field: 'quantity', code: 'TooManyFractionalDigits' },
        { source: 'Journal', field: 'prompt.position-change-reflection.decision-confidence', code: 'RequiredAnswerMissing' },
      ],
    });
    expect(await dumpAll(ref.stack.factory)).toEqual(before);
  });

  it('should return Conflict and write nothing when the same command is submitted twice, the second carrying a stale FactRevision', async () => {
    const ref = await referenceTrade();
    const same = command(ref, 1, [buy(ref, PC1, '60', '50.10')]);
    expect((await ref.stack.tradeWorkflows.recordPositionChange(same)).kind).toBe('Recorded');
    const before = await dumpAll(ref.stack.factory);
    expect(await ref.stack.tradeWorkflows.recordPositionChange(same)).toEqual({ kind: 'Conflict', changed: [`trade:${ref.trade.tradeId}`] });
    expect(await dumpAll(ref.stack.factory)).toEqual(before);
  });

  it('should leave Trade Record, Journal, and Workspace content revisions unchanged on every rejection', async () => {
    const ref = await referenceTrade();
    const member = buy(ref, PC1, '60', '50.10');
    const rejected: PositionChangeCommand[] = [
      command(ref, 1, [{ ...member, economicTime: '2026-10-12T12:00:00Z' }]),
      command(ref, 1, [{ ...member, economicTime: '2026-10-13T00:00:00Z' }]),
      command(ref, 1, [{ ...member, quantity: '0' }]),
      command(ref, 1, [{ ...member, action: 'Sell' }]),
      command(ref, 1, [member], { kind: 'Complete', form: { definitionId: ref.reflectionDefinitionId, answers: {} } }),
      command(ref, 0, [member]),
    ];
    const revisions = (stores: Record<string, unknown[]>) => {
      const meta = stores['meta'] as { key: string; revision?: number; contentRevision?: number; journalRevision?: number }[];
      return {
        tradeRecord: meta.find((m) => m.key === 'tradeRecord')?.revision,
        journal: meta.find((m) => m.key === 'journal')?.journalRevision,
        content: meta.find((m) => m.key === 'content')?.contentRevision,
      };
    };
    for (const attempt of rejected) {
      const before = await dumpAll(ref.stack.factory);
      const binding = (await ref.stack.persistence.readSnapshot(['meta'], () => Promise.resolve(null))).binding;
      const result = await ref.stack.tradeWorkflows.recordPositionChange(attempt);
      expect(['Rejected', 'VariantNotInstalled', 'Conflict']).toContain(result.kind);
      // A rejection names the Workspace snapshot it was judged against, which is unchanged.
      if (result.kind === 'Rejected') expect(result.binding).toEqual(binding);
      const after = await dumpAll(ref.stack.factory);
      expect(revisions(workspaceStores(after))).toEqual(revisions(workspaceStores(before)));
      expect(after).toEqual(before);
    }
  });

  it('should return RuntimeNotWritable and write nothing when the mutation-boundary readiness recheck fails', async () => {
    const ref = await referenceTrade();
    ref.stack.testHost.fail(['inventory']);
    const before = await dumpAll(ref.stack.factory);
    expect(await ref.stack.tradeWorkflows.recordPositionChange(command(ref, 1, [buy(ref, PC1, '60', '50.10')]))).toEqual(
      expect.objectContaining({
        kind: 'RuntimeNotWritable',
        runtimeReadiness: 'RecoveryOnly',
        failedChecks: [{ check: 'inventory', reason: 'InventoryMissing' }],
      }),
    );
    expect(await dumpAll(ref.stack.factory)).toEqual(before);
  });

  it('should reject a Position Change with no Executions with NoExecutions and write nothing', async () => {
    const ref = await referenceTrade();
    const before = await dumpAll(ref.stack.factory);
    expect(await ref.stack.tradeWorkflows.recordPositionChange(command(ref, 1, []))).toEqual({
      kind: 'Rejected',
      binding: expect.any(Object) as unknown,
      issues: [{ source: 'TradeWorkflows', field: 'members', code: 'NoExecutions' }],
    });
    expect(await dumpAll(ref.stack.factory)).toEqual(before);
  });
});

describe('Defer (AC-JOUR-003)', () => {
  it('should commit the Position Change, its Executions, the lifecycle move, the Deviation actions, and one Outstanding Debt in one semantic commit, with no Entry or decline', async () => {
    const ref = await referenceTrade();
    const before = workspaceStores(await dumpAll(ref.stack.factory));
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, 1, [buy(ref, PC1, '60', '50.10')], { kind: 'Defer' }));
    expect(result.kind).toBe('Recorded');
    const after = workspaceStores(await dumpAll(ref.stack.factory));
    const trade = (after['trades'] as { lifecycle: string; factRevision: number; facts: { kind: string; factId: string }[]; deviations?: unknown[] }[])[0]!;
    expect(trade).toEqual(expect.objectContaining({ lifecycle: 'Open', factRevision: 2, lastActivity: PC1 }));
    expect(trade.facts.map((f) => f.kind)).toEqual(['Plan', 'PlannedLeg', 'Stop', 'Target', 'PositionChange', 'Execution']);
    expect(trade.deviations).toEqual([]);
    const pcId = trade.facts[4]!.factId;
    // No new Entry (only the Plan Reflection) and no decline.
    expect(after['journalEntries']).toEqual([expect.objectContaining({ entryTypeKey: 'entry-type.plan-reflection' })]);
    expect(after['journalDeclines']).toEqual([]);
    expect(after['journalDebts']).toEqual([
      expect.objectContaining({
        obligationKey: `PositionChangeReflection:${pcId}`,
        anchor: { kind: 'Trade', tradeId: ref.trade.tradeId },
        origin: { kind: 'PositionChange', factId: pcId },
        momentTime: PC1,
        dueAnchor: PC1,
      }),
    ]);
    expect(after['journalObligations']).toContainEqual(
      expect.objectContaining({ obligationKey: `PositionChangeReflection:${pcId}`, outcome: expect.objectContaining({ kind: 'Debt' }) as unknown }),
    );
    expect(contentRevision(after)).toBe(contentRevision(before) + 1);
  });

  it('should return TradeMutationSuccess with the Debt identity in the receipt and the Debt projection with snapshot revision, due anchor, and status in the post-commit Journal outcomes, equal to the stored Debt, AC-RESP-001', async () => {
    const ref = await referenceTrade();
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, 1, [buy(ref, PC1, '60', '50.10')], { kind: 'Defer' }));
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${result.kind}`);
    const stored = (workspaceStores(await dumpAll(ref.stack.factory))['journalDebts'] as { debtId: string; definitionId: string; versions: { versionId: string; status: string }[] }[])[0]!;
    expect(result.receipt.reflection).toEqual({ kind: 'Debt', id: stored.debtId });
    expect(result.receipt.lifecycleTransitions).toEqual([{ tradeId: ref.trade.tradeId, from: 'Planned', to: 'Open' }]);
    expect(result.postCommit.reflection).toEqual({
      kind: 'Debt',
      debt: expect.objectContaining({
        debtId: stored.debtId,
        definitionId: ref.reflectionDefinitionId,
        dueAnchor: PC1,
        status: 'Outstanding',
        revision: stored.versions.at(-1)!.versionId,
      }) as unknown,
    });
    expect(stored.definitionId).toBe(ref.reflectionDefinitionId);
    expect(stored.versions.at(-1)!.status).toBe('Outstanding');
  });
});
