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
