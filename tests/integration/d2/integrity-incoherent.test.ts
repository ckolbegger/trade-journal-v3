// I2.8 (c): facts that cannot be replayed (AC-LIFE-003, P7). The integrity fixture writer points an
// Execution at an unknown Planned Leg while no application is open. Reads stay Ready and surface
// the findings without writing; the next Position Change is rejected with IntegrityDisagreement
// and writes nothing.
import { describe, expect, it } from 'vitest';
import {
  complete,
  confirmReference,
  contentRevision,
  currentDatabase,
  device,
  dumpAll,
  launch,
  onboarded,
  PC1,
  PC2,
  rawUpdate,
  record,
  buy,
  positionChange,
} from './support.ts';

type Fact = { factId: string; kind: string; versions: { value: Record<string, unknown> }[] };

describe('I2.8 integrity disagreement (AC-LIFE-003)', () => {
  it('c: should read an Execution naming an unknown Planned Leg as Ready with the findings and no write, then reject the next Position Change with IntegrityDisagreement and an unchanged dump', async () => {
    const d = await device();
    const first = await onboarded(d);
    const tradeId = await confirmReference(first);
    const opened = await record(first, tradeId, PC1, await complete(first));
    const execution = opened.postCommit.trade.positionChanges[0]!.executions[0]!.factId;
    const next = await positionChange(first, tradeId, [await buy(first, tradeId, PC2)], await complete(first));
    first.persistence.close();
    await rawUpdate(d.factory, await currentDatabase(d.factory), 'trades', tradeId, (trade) => ({
      ...trade,
      facts: (trade['facts'] as Fact[]).map((fact) =>
        fact.factId === execution
          ? {
              ...fact,
              versions: fact.versions.map((v) => ({
                ...v,
                value: { ...v.value, intent: { kind: 'ServesPlannedLeg', plannedLegId: 'leg-unknown' } },
              })),
            }
          : fact,
      ),
    }));
    const app = await launch(d);
    const before = await dumpAll(d.factory);
    const finding = { factId: execution, reason: 'UnknownPlannedLeg' };

    expect((await app.Workspace.getStatus()).kind).toBe('Ready');
    const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
    expect(detail.kind).toBe('Ready');
    expect(detail.kind === 'Ready' && 'findings' in detail.view && detail.view.findings).toEqual(
      expect.arrayContaining([expect.objectContaining(finding)]),
    );
    const open = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
    expect(open.kind === 'Ready' && open.view.items.map((i) => [i.tradeId, i.integrity])).toEqual([[tradeId, 'Disagrees']]);
    expect(contentRevision(await dumpAll(d.factory))).toBe(contentRevision(before));

    expect(await app.TradeWorkflows.recordPositionChange(next)).toEqual({ kind: 'IntegrityDisagreement', tradeId, findings: [finding] });
    expect(await dumpAll(d.factory)).toEqual(before);
  });
});

// T2.25 (F1): a Trade stored as Planned whose facts cannot be replayed. The integrity fixture writer
// files an Open Trade under Planned and points its first Execution at an unknown Planned Leg; an
// agreeing Planned Trade is listed beside it.
async function incoherentPlanned() {
  const d = await device();
  const first = await onboarded(d);
  const agreeing = await confirmReference(first, 'ABC');
  const tradeId = await confirmReference(first);
  const opened = await record(first, tradeId, PC1, await complete(first));
  const execution = opened.postCommit.trade.positionChanges[0]!.executions[0]!.factId;
  const listed = await first.TradeViewsAndReporting.browseTrades({ lifecycle: 'Planned' });
  if (listed.kind !== 'Ready') throw new Error(`browseTrades: ${listed.kind}`);
  first.persistence.close();
  await rawUpdate(d.factory, await currentDatabase(d.factory), 'trades', tradeId, (trade) => ({
    ...trade,
    lifecycle: 'Planned',
    facts: (trade['facts'] as Fact[]).map((fact) =>
      fact.factId === execution
        ? {
            ...fact,
            versions: fact.versions.map((v) => ({ ...v, value: { ...v.value, intent: { kind: 'ServesPlannedLeg', plannedLegId: 'leg-unknown' } } })),
          }
        : fact,
    ),
  }));
  return { d, app: await launch(d), tradeId, agreeing, agreeingItem: listed.view.items.find((i) => i.tradeId === agreeing) };
}

describe('browseTrades Planned with an incoherent Trade', () => {
  it('should return Ready with the incoherent Trade as an item marked integrity Disagrees, and the other Planned items unchanged', async () => {
    const { app, tradeId, agreeing, agreeingItem } = await incoherentPlanned();

    const planned = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Planned' });
    expect(planned.kind).toBe('Ready');
    const items = planned.kind === 'Ready' ? planned.view.items : [];
    expect(items.map((i) => [i.tradeId, i.integrity])).toEqual(
      expect.arrayContaining([
        [tradeId, 'Disagrees'],
        [agreeing, undefined],
      ]),
    );
    expect(items).toHaveLength(2);
    expect(agreeingItem).toBeDefined();
    expect(items.find((i) => i.tradeId === agreeing)).toEqual(agreeingItem);
  });

  it('should give the incoherent item only stored values, symbol, Strategy, Account and Plan time, and no derived figures, so 1R, reward and Reward : risk show as unavailable', async () => {
    const { app, tradeId, agreeingItem } = await incoherentPlanned();

    const planned = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Planned' });
    const item = planned.kind === 'Ready' ? planned.view.items.find((i) => i.tradeId === tradeId) : undefined;
    // The same Account, Strategy, and Plan time as the agreeing Plan, read from storage.
    const { strategy, account, institution, planTime } = agreeingItem as { strategy: string; account: string; institution: string; planTime: string };
    expect(item).toStrictEqual({ tradeId, underlying: 'XYZ', strategy, account, institution, planTime, integrity: 'Disagrees' });
  });

  it('should leave the content revision and every store unchanged', async () => {
    const { d, app } = await incoherentPlanned();
    const before = await dumpAll(d.factory);

    expect((await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Planned' })).kind).toBe('Ready');
    const after = await dumpAll(d.factory);
    expect(contentRevision(after)).toBe(contentRevision(before));
    expect(after).toEqual(before);
  });
});
