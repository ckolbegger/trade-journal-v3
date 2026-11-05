import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { derive, type TradeAnalysisRecord } from '../../domain/trade-analysis/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { D5_JOURNAL_MANIFEST, type ReflectionDisposition } from '../../modules/journal/index.ts';
import { D6_CATALOG_MANIFEST } from '../../modules/reference-catalog/index.ts';
import { dumpAll } from '../../../tests/support/stack.ts';
import { onboardedStack } from '../../../tests/support/onboarded.ts';
import type { PositionChangeCommand, PositionChangeMember, WorkflowIssue } from './index.ts';

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

async function referenceTrade(now: string = NOW): Promise<Reference> {
  const stack = await onboardedStack(new IDBFactory(), now);
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
      findings: [{ factId: execution, kind: 'Execution', instrument: { kind: 'Stock', symbol: 'XYZ' }, economicTime: '2026-10-12T14:00:00Z', side: 'Buy', quantity: '60', reason: 'UnknownPlannedLeg' }],
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

  it('should reject a Buy mixed with a Sell, another Instrument, ExplicitlyUnplanned intent, or a second Trade with VariantNotInstalled', async () => {
    const ref = await referenceTrade();
    const before = await dumpAll(ref.stack.factory);
    const member = buy(ref, PC1, '60', '50.10');
    const attempts: [PositionChangeCommand, string][] = [
      [command(ref, 1, [member, { ...member, action: 'Sell' }]), 'MixedActions'],
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
      command(ref, 1, [member, { ...member, action: 'Sell' }]),
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

// T6.10: exits (D6 section 4). Reference Trade T-A: PC1 and PC2 on Monday, X1 and X2 on Tuesday
// 2026-10-13 at 10:00 and 14:00 New York. The clock reads Tuesday 17:00, after the exits.
const EXIT_NOW = '2026-10-13T21:00:00Z';
const X1_TIME = '2026-10-13T14:00:00Z';

interface ExitReference extends Reference {
  readonly closeReasonId: string;
  readonly closeReviewDefinitionId: string;
}

// The reference Trade on a stack whose Catalog and Journal carry the D6 seeds (Close Reasons, Close Review).
async function exitReference(): Promise<ExitReference> {
  const ref = await referenceTrade(EXIT_NOW);
  await ref.stack.catalog.seedDefaults(D6_CATALOG_MANIFEST);
  await ref.stack.journal.seedDefaults(D5_JOURNAL_MANIFEST);
  const reasons = await ref.stack.catalog.query({ family: 'CloseReason' });
  if (reasons.kind !== 'Page') throw new Error('no Close Reasons');
  const definition = await ref.stack.journal.getDefinitions({ latestFor: 'entry-type.close-review' });
  if (definition.kind !== 'Found') throw new Error('no Close Review definition');
  return { ...ref, closeReasonId: reasons.items[0]!.id, closeReviewDefinitionId: definition.definition.id };
}

const sell = (ref: Reference, economicTime: string, quantity: string, price: string, fee: string) =>
  buy(ref, economicTime, quantity, price, { action: 'Sell', fee });

// PC1 and PC2 of T-A, each with a completed reflection; returns the Trade's FactRevision.
const enter = (ref: Reference) => recordAll(ref, [[buy(ref, PC1, '60', '50.10')], [buy(ref, PC2, '40', '50.30')]]);

const X2_TIME = '2026-10-13T18:00:00Z';

// X2: one decision of two Executions that sells the remaining 70 shares.
const x2Members = (ref: Reference) => [sell(ref, X2_TIME, '50', '53.00', '1.00'), sell(ref, X2_TIME, '20', '53.00', '0.40')];

// PC1, PC2 and X1, then X2's command as the form would submit it, with the given Close Review disposition.
async function beforeTerminalExit(ref: ExitReference) {
  const revision = await enter(ref);
  const x1 = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, revision, [sell(ref, X1_TIME, '30', '52.00', '0.60')]));
  if (x1.kind !== 'Recorded') throw new Error(`expected Recorded, got ${x1.kind}`);
  return x1.receipt.factRevision;
}

const closeCommand = (ref: ExitReference, revision: number, closeReview: ReflectionDisposition): PositionChangeCommand => ({
  ...command(ref, revision, x2Members(ref)),
  closeReasonId: ref.closeReasonId,
  closeReview,
});

const closeReviewForm = (ref: ExitReference): ReflectionDisposition => ({
  kind: 'Complete',
  form: {
    definitionId: ref.closeReviewDefinitionId,
    answers: { 'prompt.close-review.take-again': { kind: 'Option', optionId: 'option.close-review.take-again.yes-as-planned' } },
  },
});

describe('partial exit', () => {
  it('should commit X1, its Sell Execution, and the exit reflection outcome in one semantic commit, keep the Trade Open, and return the post-commit derivation equal to a fresh derivation of the stored Trade', async () => {
    const ref = await exitReference();
    const revision = await enter(ref);
    const before = workspaceStores(await dumpAll(ref.stack.factory));
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, revision, [sell(ref, X1_TIME, '30', '52.00', '0.60')]));
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${result.kind}`);
    const after = workspaceStores(await dumpAll(ref.stack.factory));
    // One semantic commit, and the Trade stays Open with no lifecycle transition.
    expect(contentRevision(after)).toBe(contentRevision(before) + 1);
    expect(result.receipt.lifecycleTransitions).toEqual([]);
    expect(result.receipt.factRevision).toBe(revision + 1);
    expect((after['trades'] as { lifecycle: string }[])[0]!.lifecycle).toBe('Open');
    expect(result.postCommit.reflection.kind).toBe('Entry');
    // AC-RESP-001: the returned Trade and derivation are those of a fresh read and derivation.
    const stored = await ref.stack.tradeRecord.getRecord({ tradeId: ref.trade.tradeId, projection: 'AnalysisInput' });
    if (stored.kind !== 'Found') throw new Error('trade not found');
    const record = stored.projection as TradeAnalysisRecord;
    expect(result.postCommit.trade).toEqual(record);
    expect(result.postCommit.derivation).toEqual(derive({ record }));
    // X1 consumes 30 of PC1's 60 shares: realized 57.00 - 0.50 - 0.60 = 55.90, with 70 shares remaining.
    const { derivation } = result.postCommit;
    expect(derivation.lotMatches).toEqual([expect.objectContaining({ quantity: Rational.of(30n), policy: 'FIFO' })]);
    expect(derivation.realizedToDate).toEqual(Rational.of(559n, 10n));
    expect(derivation.positions[0]!.openLots.map((l) => [l.quantity, l.unconsumedOpeningFee])).toEqual([
      [Rational.of(30n), Rational.of(1n, 2n)],
      [Rational.of(40n), Rational.of(1n)],
    ]);
  });
});

const blankReflection = (ref: Reference): ReflectionDisposition => ({ kind: 'Complete', form: { definitionId: ref.reflectionDefinitionId, answers: {} } });

describe('terminal exit AC-POS-004', () => {
  it('should commit X2 with one Close Reason fact, the Open-to-Closed lifecycle and index move, the terminal time, the exit reflection outcome, and the Close Review outcome for each disposition in one semantic commit, returning the lifecycle transition, Terminal Disposition, Realized R, and both Journal outcome projections', async () => {
    for (const kind of ['Complete', 'Decline', 'Defer'] as const) {
      const ref = await exitReference();
      const revision = await beforeTerminalExit(ref);
      const disposition: ReflectionDisposition =
        kind === 'Complete' ? closeReviewForm(ref) : kind === 'Decline' ? { kind, definitionId: ref.closeReviewDefinitionId, reason: 'Nothing to add.' } : { kind };
      const before = workspaceStores(await dumpAll(ref.stack.factory));
      const result = await ref.stack.tradeWorkflows.recordPositionChange(closeCommand(ref, revision, disposition));
      if (result.kind !== 'Recorded') throw new Error(`expected Recorded for ${kind}, got ${result.kind}`);
      const after = workspaceStores(await dumpAll(ref.stack.factory));
      // One semantic commit.
      expect(contentRevision(after)).toBe(contentRevision(before) + 1);
      // The Trade is Closed, with its terminal time and one Close Reason fact naming X2's Position Change.
      const trade = (after['trades'] as { lifecycle: string; terminalTime?: string; facts: { kind: string; factId: string }[]; closeReasonFacts: { versions: { value: unknown }[] }[] }[])[0]!;
      const x2 = trade.facts.filter((f) => f.kind === 'PositionChange').at(-1)!.factId;
      expect(trade).toEqual(expect.objectContaining({ lifecycle: 'Closed', terminalTime: X2_TIME }));
      expect(trade.closeReasonFacts).toHaveLength(1);
      expect(trade.closeReasonFacts[0]!.versions).toEqual([{ versionNumber: 1, value: { closeReasonId: ref.closeReasonId, terminalPositionChangeId: x2 } }]);
      // The Close Review outcome is separate from the exit's own reflection (Source Trade Close, key CloseReview and Trade).
      const closeKey = `CloseReview:${ref.trade.tradeId}`;
      const outcome = { Complete: 'Entry', Decline: 'Decline', Defer: 'Debt' }[kind];
      expect(after['journalObligations']).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ obligationKey: closeKey, outcome: expect.objectContaining({ kind: outcome }) as unknown }),
          expect.objectContaining({ obligationKey: `PositionChangeReflection:${x2}`, outcome: expect.objectContaining({ kind: 'Entry' }) as unknown }),
        ]),
      );
      const closeReview = {
        sourceKey: 'source.trade-close',
        anchor: { kind: 'Trade', tradeId: ref.trade.tradeId },
        origin: { kind: 'PositionChange', factId: x2 },
        momentTime: X2_TIME,
      };
      const stored = {
        Complete: (after['journalEntries'] as { entryTypeKey: string }[]).find((e) => e.entryTypeKey === 'entry-type.close-review'),
        Decline: (after['journalDeclines'] as { entryTypeKey: string }[]).find((e) => e.entryTypeKey === 'entry-type.close-review'),
        Defer: (after['journalDebts'] as { entryTypeKey: string }[]).find((e) => e.entryTypeKey === 'entry-type.close-review'),
      }[kind];
      expect(stored).toEqual(expect.objectContaining(closeReview));
      if (kind === 'Defer') expect(stored).toEqual(expect.objectContaining({ dueAnchor: X2_TIME, dueRule: 'OneSessionGrace' }));
      // The receipt and the post-commit result.
      const { receipt, postCommit, affected } = result;
      expect(receipt.lifecycleTransitions).toEqual([{ tradeId: ref.trade.tradeId, from: 'Open', to: 'Closed' }]);
      expect(receipt.reflection.kind).toBe('Entry');
      const storedId = kind === 'Defer' ? (stored as unknown as { debtId: string }).debtId : (stored as unknown as { id: string }).id;
      expect(receipt.closeReview).toEqual({ kind: outcome, id: storedId });
      expect(postCommit.reflection.kind).toBe('Entry');
      expect(postCommit.closeReview).toEqual(
        kind === 'Complete'
          ? { kind: 'Entry', entry: expect.objectContaining(closeReview) as unknown }
          : kind === 'Decline'
            ? { kind: 'Decline', decline: expect.objectContaining(closeReview) as unknown }
            : { kind: 'Debt', debt: expect.objectContaining({ ...closeReview, status: 'Outstanding', dueAnchor: X2_TIME }) as unknown },
      );
      expect(postCommit.trade).toEqual(expect.objectContaining({ storedLifecycle: 'Closed', terminalTime: X2_TIME }));
      expect(postCommit.trade.closeReason).toEqual(expect.objectContaining({ closeReasonId: ref.closeReasonId, terminalPositionChangeId: x2 }));
      expect(postCommit.derivation.expectedLifecycle).toBe('Closed');
      expect(postCommit.derivation.terminalDisposition).toEqual({ kind: 'Value', value: [{ mechanism: 'Executions', quantity: Rational.of(100n) }] });
      // Net realized 248.00 over 1R of 250.00.
      expect(postCommit.derivation.realizedToDate).toEqual(Rational.of(248n));
      expect(postCommit.derivation.realizedR).toEqual({ kind: 'Value', value: Rational.of(124n, 125n) });
      expect(affected).toEqual([
        { scope: 'TradeList', lifecycle: 'Closed' },
        { scope: 'TradeList', lifecycle: 'Open' },
      ]);
    }
  });

  it('should reject a terminal exit without a Close Reason and without a Close Review disposition, returning CloseReasonRequired and CloseReviewDispositionRequired together with any Journal issues', async () => {
    const ref = await exitReference();
    const revision = await beforeTerminalExit(ref);
    const before = await dumpAll(ref.stack.factory);
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, revision, x2Members(ref), blankReflection(ref)));
    if (result.kind !== 'Rejected') throw new Error(`expected Rejected, got ${result.kind}`);
    expect(result.issues).toHaveLength(5);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        { source: 'TradeWorkflows', field: 'closeReasonId', code: 'CloseReasonRequired' },
        { source: 'TradeWorkflows', field: 'closeReview', code: 'CloseReviewDispositionRequired' },
        expect.objectContaining({ source: 'Journal', field: 'prompt.position-change-reflection.decision-mode' }),
        expect.objectContaining({ source: 'Journal', field: 'prompt.position-change-reflection.primary-emotion' }),
        expect.objectContaining({ source: 'Journal', field: 'prompt.position-change-reflection.decision-confidence' }),
      ]),
    );
    expect(await dumpAll(ref.stack.factory)).toEqual(before);
  });

  it('should reject a Close Reason or Close Review disposition on a non-terminal exit with CloseReasonNotApplicable and CloseReviewNotApplicable', async () => {
    const ref = await exitReference();
    const revision = await enter(ref);
    const before = await dumpAll(ref.stack.factory);
    const x1 = [sell(ref, X1_TIME, '30', '52.00', '0.60')];
    const attempts: [Partial<PositionChangeCommand>, WorkflowIssue[]][] = [
      [
        { closeReasonId: ref.closeReasonId, closeReview: { kind: 'Defer' } },
        [
          { source: 'TradeWorkflows', field: 'closeReasonId', code: 'CloseReasonNotApplicable' },
          { source: 'TradeWorkflows', field: 'closeReview', code: 'CloseReviewNotApplicable' },
        ],
      ],
      [{ closeReasonId: ref.closeReasonId }, [{ source: 'TradeWorkflows', field: 'closeReasonId', code: 'CloseReasonNotApplicable' }]],
      [{ closeReview: { kind: 'Defer' } }, [{ source: 'TradeWorkflows', field: 'closeReview', code: 'CloseReviewNotApplicable' }]],
    ];
    for (const [extra, issues] of attempts) {
      const result = await ref.stack.tradeWorkflows.recordPositionChange({ ...command(ref, revision, x1), ...extra });
      expect(result).toEqual(expect.objectContaining({ kind: 'Rejected', issues }));
      expect(await dumpAll(ref.stack.factory)).toEqual(before);
    }
  });

  it('should reject an unknown Close Reason or a Strategy identity with the Catalog resolution issue, together with the Close Review form issues', async () => {
    const ref = await exitReference();
    const revision = await beforeTerminalExit(ref);
    const before = await dumpAll(ref.stack.factory);
    const blankCloseReview: ReflectionDisposition = { kind: 'Complete', form: { definitionId: ref.closeReviewDefinitionId, answers: {} } };
    const attempts: [string, string][] = [
      ['no-such-reason', 'UnknownReference'],
      [ref.stack.strategy.id, 'WrongKind'],
    ];
    for (const [closeReasonId, code] of attempts) {
      const result = await ref.stack.tradeWorkflows.recordPositionChange({ ...closeCommand(ref, revision, blankCloseReview), closeReasonId });
      expect(result).toEqual(
        expect.objectContaining({
          kind: 'Rejected',
          issues: [
            { source: 'ReferenceCatalog', field: 'closeReasonId', code },
            { source: 'Journal', field: 'prompt.close-review.take-again', code: 'RequiredAnswerMissing' },
          ],
        }),
      );
      expect(await dumpAll(ref.stack.factory)).toEqual(before);
    }
  });
});

describe('position paths P22', () => {
  // Monday 10:30 New York, between PC1 (10:00) and PC2 (11:00).
  const BETWEEN = '2026-10-12T14:30:00Z';

  it('should reject any Position Change on a Trade whose stored lifecycle is Closed with TradeClosed and write nothing', async () => {
    const ref = await exitReference();
    const revision = await beforeTerminalExit(ref);
    const closed = await ref.stack.tradeWorkflows.recordPositionChange(closeCommand(ref, revision, { kind: 'Defer' }));
    if (closed.kind !== 'Recorded') throw new Error(`expected Recorded, got ${closed.kind}`);
    const before = await dumpAll(ref.stack.factory);
    for (const member of [buy(ref, X2_TIME, '10', '50.00'), sell(ref, X2_TIME, '10', '50.00', '0.10')]) {
      const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, closed.receipt.factRevision, [member]));
      expect(result).toEqual(expect.objectContaining({ kind: 'Rejected', issues: [{ source: 'TradeWorkflows', code: 'TradeClosed' }] }));
      expect(await dumpAll(ref.stack.factory)).toEqual(before);
    }
  });

  it('should reject a Buy with TradeClosed and write nothing when the stored lifecycle is Open but the facts are flat and Closed', async () => {
    const ref = await exitReference();
    const revision = await beforeTerminalExit(ref);
    const closed = await ref.stack.tradeWorkflows.recordPositionChange(closeCommand(ref, revision, { kind: 'Defer' }));
    if (closed.kind !== 'Recorded') throw new Error(`expected Recorded, got ${closed.kind}`);
    await rewriteTrade(ref, (document) => ({ ...document, lifecycle: 'Open' }));
    const before = await dumpAll(ref.stack.factory);
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, closed.receipt.factRevision, [buy(ref, X2_TIME, '10', '50.00')]));
    expect(result).toEqual(expect.objectContaining({ kind: 'Rejected', issues: [{ source: 'TradeWorkflows', code: 'TradeClosed' }] }));
    expect(await dumpAll(ref.stack.factory)).toEqual(before);
  });

  it('should return ExceedsOpenQuantity and FlatBeforeLaterFacts from the candidates analysis as typed issues and write nothing', async () => {
    const ref = await exitReference();
    const revision = await enter(ref);
    const before = await dumpAll(ref.stack.factory);
    const attempts: [PositionChangeMember[], WorkflowIssue[]][] = [
      // 101 shares against 100 open.
      [[sell(ref, X1_TIME, '101', '52.00', '0.60')], [{ source: 'TradeAnalysis', member: 0, field: 'quantity', code: 'ExceedsOpenQuantity', available: Rational.of(100n) }]],
      // 70 at 10:30 against the 60 open at that point.
      [[sell(ref, BETWEEN, '70', '52.00', '0.60')], [{ source: 'TradeAnalysis', member: 0, field: 'quantity', code: 'ExceedsOpenQuantity', available: Rational.of(60n) }]],
      // 60 at 10:30 leaves the Position flat before PC2.
      [[sell(ref, BETWEEN, '60', '52.00', '0.60')], [{ source: 'TradeAnalysis', member: 0, field: 'quantity', code: 'FlatBeforeLaterFacts' }]],
    ];
    for (const [members, issues] of attempts) {
      const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, revision, members));
      expect(result).toEqual(expect.objectContaining({ kind: 'Rejected', issues }));
      expect(await dumpAll(ref.stack.factory)).toEqual(before);
    }
  });

  it('should name the recorded Sell that a new earlier-dated Sell would leave short, with the quantity then available', async () => {
    const ref = await exitReference();
    const entered = await enter(ref);
    const x1 = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, entered, [sell(ref, X1_TIME, '90', '52.00', '0.60')]));
    if (x1.kind !== 'Recorded') throw new Error(`expected Recorded, got ${x1.kind}`);
    const before = await dumpAll(ref.stack.factory);
    // 70 at 11:30 leaves 30, below the 90 that X1 later sells.
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, x1.receipt.factRevision, [sell(ref, '2026-10-12T15:30:00Z', '70', '52.00', '0.60')]));
    expect(result).toEqual(
      expect.objectContaining({
        kind: 'Rejected',
        issues: [{ source: 'TradeAnalysis', factId: x1.receipt.createdFactIds[1]!, code: 'ExceedsOpenQuantity', available: Rational.of(30n) }],
      }),
    );
    expect(await dumpAll(ref.stack.factory)).toEqual(before);
  });

  it('should return IntegrityDisagreement, not P22 issues, when the stored Trade is already path-incoherent', async () => {
    const ref = await exitReference();
    const entered = await enter(ref);
    const x1 = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, entered, [sell(ref, X1_TIME, '30', '52.00', '0.60')]));
    if (x1.kind !== 'Recorded') throw new Error(`expected Recorded, got ${x1.kind}`);
    // The stored Sell is rewritten to 150 shares against 100 open, as corruption or an import would leave it.
    const sellId = x1.receipt.createdFactIds[1]!;
    type StoredFact = { factId: string; versions: { value: Record<string, unknown> }[] };
    await rewriteTrade(ref, (document) => ({
      ...document,
      facts: (document['facts'] as StoredFact[]).map((fact) =>
        fact.factId === sellId ? { ...fact, versions: fact.versions.map((v) => ({ ...v, value: { ...v.value, quantity: '150' } })) } : fact,
      ),
    }));
    const before = await dumpAll(ref.stack.factory);
    // The change itself is sound: a later Sell of 10. Its own path is not what is wrong.
    const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, x1.receipt.factRevision, [sell(ref, '2026-10-13T15:00:00Z', '10', '52.00', '0.10')]));
    expect(result).toEqual({
      kind: 'IntegrityDisagreement',
      tradeId: ref.trade.tradeId,
      findings: [{ factId: sellId, kind: 'Execution', instrument: { kind: 'Stock', symbol: 'XYZ' }, economicTime: X1_TIME, side: 'Sell', quantity: '150', reason: 'ExceedsOpenQuantity', available: Rational.of(100n) }],
    });
    expect(await dumpAll(ref.stack.factory)).toEqual(before);
  });
});

describe('earlier-dated exit P23', () => {
  // X0 is dated Tuesday 09:45 New York, before X1 at 10:00.
  const X0_TIME = '2026-10-13T13:45:00Z';

  it('should commit X0 after X1 and disclose in the receipt the derived Lot Matches that changed and the realized P&L before and after', async () => {
    // [X0 quantity, the FIFO changes it makes, realized-to-date after]
    const variants = [
      ['60', 'supersedes X1 from PC1 and creates two', Rational.of(2041n, 20n)],
      ['40', 'revises X1 from PC1 and creates two', Rational.of(1771n, 20n)],
    ] as const;
    for (const [quantity, , realizedAfter] of variants) {
      const ref = await exitReference();
      const entered = await enter(ref);
      const x1 = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, entered, [sell(ref, X1_TIME, '30', '52.00', '0.60')]));
      if (x1.kind !== 'Recorded') throw new Error(`expected Recorded, got ${x1.kind}`);
      const [pc1x1] = x1.postCommit.derivation.lotMatches;
      const pc1 = pc1x1!.openingExecutionId;
      const x1Execution = pc1x1!.disposingExecutionId;
      const pc2 = x1.postCommit.derivation.positions[0]!.openLots[1]!.openingExecutionId;
      const result = await ref.stack.tradeWorkflows.recordPositionChange(command(ref, x1.receipt.factRevision, [sell(ref, X0_TIME, quantity, '51.00', '0.60')]));
      if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${result.kind}`);
      const x0Execution = result.receipt.createdFactIds[1]!;
      const change = (kind: 'Created' | 'Revised' | 'Superseded', opening: string, disposing: string, before: bigint | null, after: bigint | null) => ({
        kind,
        openingExecutionId: opening,
        disposingExecutionId: disposing,
        quantity: { before: before === null ? null : Rational.of(before), after: after === null ? null : Rational.of(after) },
      });
      // FIFO re-runs over the effective Executions: X0 now takes the oldest shares.
      expect(result.receipt.lotMatchChanges).toEqual(
        quantity === '60'
          ? [
              change('Superseded', pc1, x1Execution, 30n, null),
              change('Created', pc1, x0Execution, null, 60n),
              change('Created', pc2, x1Execution, null, 30n),
            ]
          : [
              change('Created', pc1, x0Execution, null, 40n),
              change('Revised', pc1, x1Execution, 30n, 20n),
              change('Created', pc2, x1Execution, null, 10n),
            ],
      );
      expect(result.receipt.realizedToDate).toEqual({ before: Rational.of(559n, 10n), after: realizedAfter });
      expect(result.postCommit.derivation.realizedToDate).toEqual(realizedAfter);
      // The disclosure is the difference of two derivations: Lot Matches are never stored (P23).
      const stored = workspaceStores(await dumpAll(ref.stack.factory));
      expect(Object.keys(stored).filter((store) => /lot/i.test(store))).toEqual([]);
    }
  });
});
