import type { ExecutionInput } from '../../domain/trade-record/opening-types';
import type { ReflectionDisposition } from '../../domain/journal/position-change-types';
export interface PositionChangeCommand {
  kind: 'InitialStockEntry'; generation: string; expectedWorkspaceRevision: string;
  expectedCatalogRevision: string; tradeId: string; expectedTradeRevision: string;
  plannedLegId: string; definitionRevision: string; economicTime: string;
  executions: ExecutionInput[]; reflection: ReflectionDisposition;
}
