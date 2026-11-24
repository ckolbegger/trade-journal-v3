import {
  buildDailyTradeReviewDefinition,
  DAILY_TRADE_REVIEW_DEF_ID,
  DAILY_TRADE_REVIEW_TYPE_ID,
  type DailyReviewAction,
} from '../../src/journal/journal';
import type {
  ExecutionRecord,
  JournalEntryRecord,
  MarketMarkRecord,
  PlannedLegIntent,
} from '../../src/persistence/idb';
import {
  ExactNumber,
  fromDecimalString,
  type SerializedRational,
} from '../../src/shared/exact-number';

export function ser(value: string): SerializedRational {
  return ExactNumber.toJSON(fromDecimalString(value));
}

export interface LongStockPlanBuilderOptions {
  readonly plannedQuantity?: string;
  readonly intendedEntryPrice?: string;
  readonly stopPrice?: string;
  readonly targetPrice?: string;
}

export function makeLongStockPlan(options: LongStockPlanBuilderOptions = {}) {
  return {
    plannedQuantity: ser(options.plannedQuantity ?? '100'),
    intendedEntryPrice: ser(options.intendedEntryPrice ?? '50.00'),
    stopPrice: ser(options.stopPrice ?? '47.00'),
    targetPrice: ser(options.targetPrice ?? '56.00'),
  };
}

export interface ExecutionBuilderOptions {
  readonly id?: string;
  readonly tradeId?: string;
  readonly positionChangeId?: string;
  readonly side?: 'Buy' | 'Sell';
  readonly quantity?: string;
  readonly fillPrice?: string;
  readonly fee?: string;
  readonly plannedLegIntent?: PlannedLegIntent;
  readonly economicTime?: string;
  readonly recordedSequence?: number;
  readonly recordedAt?: string;
}

export function makeExecution(options: ExecutionBuilderOptions = {}): ExecutionRecord {
  const economicTime = options.economicTime ?? '2026-11-02T15:00:00.000Z';
  return {
    id: options.id ?? 'exec-1',
    tradeId: options.tradeId ?? 'trd-1',
    positionChangeId: options.positionChangeId ?? 'pc-1',
    side: options.side ?? 'Buy',
    quantity: ser(options.quantity ?? '100'),
    fillPrice: ser(options.fillPrice ?? '50.00'),
    fee: ser(options.fee ?? '0.00'),
    plannedLegIntent: options.plannedLegIntent ?? 'PlannedLeg',
    economicTime,
    recordedSequence: options.recordedSequence ?? 2,
    recordedAt: options.recordedAt ?? economicTime,
  };
}

export interface MarkBuilderOptions {
  readonly id?: string;
  readonly symbol?: string;
  readonly sessionDate?: string;
  readonly price?: string;
  readonly intent?: 'Initial' | 'Override' | 'Correction';
  readonly revision?: number;
  readonly effective?: boolean;
  readonly recordedAt?: string;
  readonly reason?: string;
}

export function makeMark(options: MarkBuilderOptions = {}): MarketMarkRecord {
  const sessionDate = options.sessionDate ?? '2026-11-02';
  const symbol = options.symbol ?? 'AXIO';
  return {
    id: options.id ?? `mk-${symbol}-${sessionDate}-${options.revision ?? 1}`,
    symbol,
    sessionDate,
    price: ser(options.price ?? '50.00'),
    source: 'Manual',
    intent: options.intent ?? 'Initial',
    revision: options.revision ?? 1,
    effective: options.effective ?? true,
    recordedAt: options.recordedAt ?? `${sessionDate}T21:15:00.000Z`,
    ...(options.reason !== undefined ? { reason: options.reason } : {}),
  };
}

export interface ReviewActionEntryBuilderOptions {
  readonly id?: string;
  readonly tradeId?: string;
  readonly reviewDate?: string;
  readonly action?: DailyReviewAction;
  readonly reason?: string;
  readonly conviction?: number;
  readonly consideredAgainst?: string;
  readonly note?: string;
  readonly recordedAt?: string;
}

export function makeReviewActionEntry(
  options: ReviewActionEntryBuilderOptions = {},
): JournalEntryRecord {
  const tradeId = options.tradeId ?? 'trd-1';
  const reviewDate = options.reviewDate ?? '2026-11-02';
  const recordedAt = options.recordedAt ?? `${reviewDate}T22:00:00.000Z`;
  const def = buildDailyTradeReviewDefinition(recordedAt);
  return {
    id: options.id ?? `dtr-${tradeId}-${reviewDate}`,
    entryTypeId: DAILY_TRADE_REVIEW_TYPE_ID,
    definitionId: DAILY_TRADE_REVIEW_DEF_ID,
    definitionRevision: def.revision,
    definitionSnapshot: def,
    source: 'DailyReview',
    anchor: { kind: 'Trade', tradeId },
    tradeId,
    origin: { kind: 'DailyReview', reviewDate },
    obligationKey: `daily_review:${tradeId}:${reviewDate}`,
    responses: {
      action: options.action ?? 'Hold',
      ...(options.reason !== undefined ? { reason: options.reason } : {}),
      ...(options.conviction !== undefined ? { conviction: options.conviction } : {}),
      ...(options.consideredAgainst !== undefined
        ? { consideredAgainst: options.consideredAgainst }
        : {}),
      ...(options.note !== undefined ? { note: options.note } : {}),
    },
    recordedAt,
  };
}
