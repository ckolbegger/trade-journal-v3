import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { rebuildPrivateState } from '../../../src/persistence/index.ts';
import { device, onboarded, planCommand, restart } from './support.ts';

// The views with their opaque revision tokens (bindings) removed.
async function views(app: Application, tradeIds: readonly string[]) {
  const browse = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Planned' });
  if (browse.kind !== 'Ready') throw new Error(`browse: ${browse.kind}`);
  const details = [];
  for (const tradeId of tradeIds) {
    const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
    if (detail.kind !== 'Ready') throw new Error(`detail: ${detail.kind}`);
    details.push(detail.view);
  }
  return { list: browse.view, details };
}

describe('I1.11 rebuild equivalence', () => {
  it('should give equal normalized views after every IndexedDB index is dropped and recreated through the migration path', async () => {
    const d = await device();
    const { app } = await onboarded(d);
    const tradeIds: string[] = [];
    for (const [underlying, economicTime] of [['AAA', '2026-10-12T13:00:00Z'], ['BBB', '2026-10-12T13:10:00Z'], ['CCC', '2026-10-12T13:20:00Z']] as const) {
      const result = await app.TradeWorkflows.confirmPlan(await planCommand(app, { underlying, economicTime }));
      if (result.kind !== 'Confirmed') throw new Error(`confirmPlan: ${result.kind}`);
      tradeIds.push(result.receipt.tradeId);
    }
    const before = await views(app, tradeIds);
    const status = await app.Workspace.getStatus();
    if (status.kind !== 'Ready') throw new Error(`status: ${status.kind}`);

    app.persistence.close();
    await rebuildPrivateState(d.factory, status.binding.databaseName);
    const after = await views(await restart(app, d), tradeIds);

    expect(before.list.items).toHaveLength(3);
    expect(after).toEqual(before);
  });
});
