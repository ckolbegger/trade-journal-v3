import {
  PLAN_REFLECTION_TYPE_ID,
  validatePlanReflectionInput,
  type PlanReflectionInput,
} from '../journal/journal';
import type {
  JournalEntryRecord,
  PersistenceSeam,
  PlanVersionFactRecord,
  SerializedPlanBaseline,
  TradeRecordRow,
} from '../persistence/idb';
import type { Clock } from '../shared/clock';
import { ExactNumber } from '../shared/exact-number';
import type { RuntimeNotWritableResult } from '../shared/result';
import { assessLongStockPlan } from '../trade-analysis/assess-plan';

export interface ConfirmPlanCommand {
  readonly accountId: string;
  readonly strategyId: string;
  readonly symbol: string;
  readonly quantity: string;
  readonly intendedEntryPrice: string;
  readonly stopPrice: string;
  readonly targetPrice: string;
  readonly economicTime: string;
  readonly planReflection: PlanReflectionInput;
}

export interface ConfirmPlanFieldError {
  readonly field: string;
  readonly message: string;
}

export type ConfirmPlanResult =
  | {
      readonly status: 'Confirmed';
      readonly postCommit: {
        readonly trade: TradeRecordRow;
        readonly planFact: PlanVersionFactRecord;
        readonly journalEntry: JournalEntryRecord;
      };
    }
  | {
      readonly status: 'Rejected';
      readonly errors: readonly ConfirmPlanFieldError[];
    }
  | RuntimeNotWritableResult;

export interface TradeWorkflows {
  confirmPlan(command: ConfirmPlanCommand): Promise<ConfirmPlanResult>;
}

function genId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createTradeWorkflows(options: {
  readonly persistence: PersistenceSeam;
  readonly clock: Clock;
}): TradeWorkflows {
  const { persistence, clock } = options;

  return {
    async confirmPlan(command: ConfirmPlanCommand): Promise<ConfirmPlanResult> {
      const txResult = await persistence.runWriteTransaction(
        [
          'catalog_institutions',
          'catalog_accounts',
          'catalog_strategies',
          'journal_definitions',
          'trades',
          'trade_facts',
          'journal_entries',
        ],
        async (tx): Promise<Exclude<ConfirmPlanResult, RuntimeNotWritableResult>> => {
          const errors: ConfirmPlanFieldError[] = [];

          const [institutions, accounts, strategies, definitions] = await Promise.all([
            tx.getAll('catalog_institutions'),
            tx.getAll('catalog_accounts'),
            tx.getAll('catalog_strategies'),
            tx.getAll('journal_definitions'),
          ]);

          const account = accounts.find((a) => a.id === command.accountId);
          const institution = account
            ? institutions.find((i) => i.id === account.institutionId)
            : undefined;
          if (!account || account.status !== 'Active' || !institution || institution.status !== 'Active') {
            errors.push({
              field: 'accountId',
              message: 'Select an active brokerage Account under an active Institution.',
            });
          }

          const strategy = strategies.find((s) => s.id === command.strategyId);
          if (!strategy || strategy.status !== 'Active') {
            errors.push({
              field: 'strategyId',
              message: 'Select an active Strategy.',
            });
          }

          const planAssessment = assessLongStockPlan({
            symbol: command.symbol,
            quantity: command.quantity,
            intendedEntryPrice: command.intendedEntryPrice,
            stopPrice: command.stopPrice,
            targetPrice: command.targetPrice,
          });
          if (planAssessment.status === 'Rejected') {
            errors.push(...planAssessment.errors);
          }

          const definition = definitions.find(
            (d) =>
              d.id === command.planReflection.definitionId &&
              d.entryTypeId === PLAN_REFLECTION_TYPE_ID,
          );
          const reflectionCheck = validatePlanReflectionInput(definition, command.planReflection);
          if (!reflectionCheck.ok) {
            errors.push(...reflectionCheck.errors);
          }

          if (
            errors.length > 0 ||
            !account ||
            !institution ||
            !strategy ||
            planAssessment.status !== 'Accepted' ||
            !definition ||
            !reflectionCheck.ok
          ) {
            return { status: 'Rejected', errors };
          }

          const now = clock.nowIso();
          const tradeId = genId('trd');
          const planFactId = genId('fact');
          const entryId = genId('jrn');

          const serializedBaseline: SerializedPlanBaseline = {
            riskPerShare: ExactNumber.toJSON(planAssessment.baseline.riskPerShare),
            rewardPerShare: ExactNumber.toJSON(planAssessment.baseline.rewardPerShare),
            originalPlannedRisk: ExactNumber.toJSON(planAssessment.baseline.originalPlannedRisk),
            originalPlannedReward: ExactNumber.toJSON(
              planAssessment.baseline.originalPlannedReward,
            ),
            plannedRewardToRisk: ExactNumber.toJSON(planAssessment.baseline.plannedRewardToRisk),
            originalPlannedRiskDisplay: planAssessment.baseline.originalPlannedRiskDisplay,
            originalPlannedRewardDisplay: planAssessment.baseline.originalPlannedRewardDisplay,
            plannedRewardToRiskDisplay: planAssessment.baseline.plannedRewardToRiskDisplay,
          };

          const plannedQuantity = ExactNumber.toJSON(planAssessment.quantity);
          const intendedEntryPrice = ExactNumber.toJSON(planAssessment.intendedEntryPrice);
          const stopPrice = ExactNumber.toJSON(planAssessment.stopPrice);
          const targetPrice = ExactNumber.toJSON(planAssessment.targetPrice);

          const trade: TradeRecordRow = {
            id: tradeId,
            accountId: account.id,
            institutionId: institution.id,
            strategyId: strategy.id,
            symbol: planAssessment.normalizedSymbol,
            lifecycleState: 'Planned',
            factRevision: 1,
            createdAt: now,
            updatedAt: now,
            plannedQuantity,
            intendedEntryPrice,
            stopPrice,
            targetPrice,
            baseline: serializedBaseline,
          };

          const planFact: PlanVersionFactRecord = {
            id: planFactId,
            kind: 'PlanVersion',
            tradeId,
            recordedSequence: 1,
            economicTime: command.economicTime,
            symbol: planAssessment.normalizedSymbol,
            plannedQuantity,
            intendedEntryPrice,
            stopPrice,
            targetPrice,
            thesis: reflectionCheck.thesis,
            invalidation: reflectionCheck.invalidation,
            baseline: serializedBaseline,
            recordedAt: now,
          };

          const journalEntry: JournalEntryRecord = {
            id: entryId,
            entryTypeId: PLAN_REFLECTION_TYPE_ID,
            definitionId: definition.id,
            definitionRevision: definition.revision,
            definitionSnapshot: definition,
            source: 'PlanConfirmation',
            anchor: { kind: 'Trade', tradeId },
            tradeId,
            origin: { kind: 'Plan', factId: planFactId },
            responses: {
              thesis: reflectionCheck.thesis,
              invalidation: reflectionCheck.invalidation,
              conviction: command.planReflection.conviction,
              primaryEmotion: command.planReflection.primaryEmotion,
            },
            recordedAt: now,
          };

          tx.put('trades', trade);
          tx.put('trade_facts', planFact);
          tx.put('journal_entries', journalEntry);

          return {
            status: 'Confirmed',
            postCommit: {
              trade,
              planFact,
              journalEntry,
            },
          };
        },
      );

      if (txResult.status === 'RuntimeNotWritable') {
        return txResult;
      }
      return txResult.value;
    },
  };
}
