import type { PlanInput } from '../trade-analysis';
export interface ExecutionInput {
  instrument: NonNullable<PlanInput['instrument']>; action: 'Buy';
  quantity: string; price: string; fee: string; economicTime: string;
  plannedLegId: string;
}
export interface Execution extends ExecutionInput {
  id: string; version: string; tradeId: string; positionChangeId: string;
  sequence: number; saveTime: string;
}
export interface PositionChange {
  id: string; version: string; tradeId: string; originTradeId: string;
  kind: 'InitialStockEntry'; economicTime: string; saveTime: string;
  sequence: number; executionIds: string[];
}
export interface OpeningAgreement {
  factRevision: string; lotMatches: { openingId: string; disposingId: string; quantity: string }[];
  deviations: { kind: 'PlannedLegTerms'; plannedLegId: string; mismatches: string[] }[];
  entryResolution: { positionChangeId: string; economicTime: string };
}
