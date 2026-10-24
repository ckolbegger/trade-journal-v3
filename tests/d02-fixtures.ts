import { workspaceFixture, economicTime } from './fixtures';
import type { PositionChangeCommand } from '../src/application/trade-workflows/opening-types';
export async function openingFixture() {
  const f = await workspaceFixture(); const confirmed = await f.workflows.confirmPlan(f.command);
  if (confirmed.status !== 'Confirmed') throw new Error('Plan fixture');
  const root = await f.store.roots.get('active'); if (!root) throw new Error('Root fixture');
  const command: PositionChangeCommand = { kind: 'InitialStockEntry', generation: root.generation, expectedWorkspaceRevision: root.revision, expectedCatalogRevision: root.catalogRevision, tradeId: confirmed.trade.tradeId, expectedTradeRevision: confirmed.trade.revision, plannedLegId: confirmed.trade.plannedLegId, definitionRevision: 'position-change-reflection-v1', economicTime, executions: [{ instrument: { kind: 'Stock', symbol: 'XYZ', currency: 'USD' }, action: 'Buy', quantity: '40', price: '49', fee: '1', economicTime, plannedLegId: confirmed.trade.plannedLegId }, { instrument: { kind: 'Stock', symbol: 'XYZ', currency: 'USD' }, action: 'Buy', quantity: '60', price: '51', fee: '2', economicTime, plannedLegId: confirmed.trade.plannedLegId }], reflection: { kind: 'Complete', answers: { 'decision-mode': 'as-planned', emotion: 'calm', confidence: '4' } } };
  return { ...f, command, planCommand: f.command, confirmed, root };
}
