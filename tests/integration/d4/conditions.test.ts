// I4.7: Stop crossed and Target reached (AC-CALC-003 partial), through the Open list and Detail.
import { describe, expect, it } from 'vitest';
import { dec, detail, dumpAll, MONDAY, openItem, referenceTrade, restart, saveMark, value, workspaceStores } from './support.ts';

// Every store apart from the two a Mark save writes: the Trade facts and Deviation records live there.
async function factStores(factory: Parameters<typeof dumpAll>[0]) {
  const stores = { ...workspaceStores(await dumpAll(factory)) };
  delete stores['observations'];
  delete stores['meta'];
  return stores;
}

const reading = (conditions: readonly { role: string; result: unknown }[], role: 'Stop' | 'Target') => {
  const found = conditions.find((c) => c.role === role);
  const result = found?.result as { kind: string; value: { status: string; overrun: { dollars: unknown; planR: unknown } | null } };
  if (result?.kind !== 'Value') throw new Error(`no ${role} reading`);
  return result.value;
};

describe('I4.7 Stop crossed and Target reached', () => {
  it('should report the Stop Breached with its Overrun and headlines at Mark 47.00, and the Target Reached with its Overrun and headlines at Mark 57.00, leaving the recorded Deviation occurrences unchanged', async () => {
    const stop = await referenceTrade();
    const target = await referenceTrade();
    const stopBefore = await factStores(stop.d.factory);
    const targetBefore = await factStores(target.d.factory);
    await saveMark(stop.app, 'XYZ', MONDAY, '47.00');
    await saveMark(target.app, 'XYZ', MONDAY, '57.00');

    const stopApp = await restart(stop.app, stop.d);
    const targetApp = await restart(target.app, target.d);

    // Stop crossed: the Stop is Breached by $50.00 (1/5 R); nothing remains to lose to it.
    const stopItem = (await openItem(stopApp, stop.tradeId)).current;
    const stopView = (await detail(stopApp, stop.tradeId)).current;
    if (stopView.evaluation.kind !== 'Evaluated') throw new Error('no evaluation');
    for (const figures of [stopItem, stopView.evaluation]) {
      expect(figures.currentMarkedPnl).toEqual(value('-320'));
      expect(figures.currentMarkedPnlInPlanR).toEqual({ kind: 'Value', value: dec('-320').div(dec('250')) });
      expect(figures.ongoingRiskToStop).toEqual(value('0'));
      expect(figures.worstCaseOngoingRisk).toEqual(value('4700'));
      expect(figures.incrementalRewardToTarget).toEqual(value('900'));
      const breached = reading(figures.conditions, 'Stop');
      expect(breached.status).toBe('Breached');
      expect(breached.overrun).toEqual({ dollars: value('50').value, planR: value('50').value.div(value('250').value) });
      expect(reading(figures.conditions, 'Target').status).toBe('Active');
    }

    // Target reached: the Target is Reached by $100.00 (2/5 R); the whole range to the Stop remains.
    const targetItem = (await openItem(targetApp, target.tradeId)).current;
    const targetView = (await detail(targetApp, target.tradeId)).current;
    if (targetView.evaluation.kind !== 'Evaluated') throw new Error('no evaluation');
    for (const figures of [targetItem, targetView.evaluation]) {
      expect(figures.incrementalRewardToTarget).toEqual(value('0'));
      expect(figures.ongoingRiskToStop).toEqual(value('950'));
      expect(figures.ongoingRiskToStopInPlanR).toEqual({ kind: 'Value', value: value('950').value.div(value('250').value) });
      const reached = reading(figures.conditions, 'Target');
      expect(reached.status).toBe('Reached');
      expect(reached.overrun).toEqual({ dollars: value('100').value, planR: value('100').value.div(value('250').value) });
      expect(reading(figures.conditions, 'Stop').status).toBe('Active');
    }

    // Neither crossing is a Deviation: no occurrence in the view, and no Trade or Deviation record written.
    for (const app of [stopApp, targetApp]) {
      const open = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
      expect(open.kind === 'Ready' && open.view.items.map((i) => 'deviationCount' in i && i.deviationCount)).toEqual([0]);
    }
    expect(await factStores(stop.d.factory)).toEqual(stopBefore);
    expect(await factStores(target.d.factory)).toEqual(targetBefore);
  });
});
