import {
  PLAN_REFLECTION_TYPE_ID,
  POSITION_CHANGE_REFLECTION_TYPE_ID,
  validatePlanReflectionInput,
  validatePositionChangeReflectionInput,
  type PlanReflectionInput,
  type PositionChangeReflectionInput,
} from '../journal/journal';
import type {
  DeviationRecord,
  ExecutionRecord,
  JournalDebtRecord,
  JournalDeclineRecord,
  JournalEntryRecord,
  PersistenceSeam,
  PlannedLegIntent,
  PlanVersionFactRecord,
  PositionChangeRecord,
  SerializedPlanBaseline,
  TradeRecordRow,
} from '../persistence/idb';
import type { Clock } from '../shared/clock';
import { ExactNumber, isNegative, isPositive, tryFromDecimalString } from '../shared/exact-number';
import type { RuntimeNotWritableResult } from '../shared/result';
import { assessLongStockPlan } from '../trade-analysis/assess-plan';
import { deriveLongStockPosition, type DerivedLongStockState } from '../trade-analysis/derive';

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

export interface OpeningExecutionInput {
  readonly quantity: string;
  readonly fillPrice: string;
  readonly fee: string;
  readonly plannedLegIntent: PlannedLegIntent;
}

export type PositionChangeReflectionDisposition =
  | ({ readonly kind: 'Complete' } & PositionChangeReflectionInput)
  | { readonly kind: 'Defer' }
  | { readonly kind: 'Decline'; readonly reason?: string };

export interface RecordPositionChangeCommand {
  readonly tradeId: string;
  readonly expectedFactRevision: number;
  readonly economicTime: string;
  readonly executions: readonly OpeningExecutionInput[];
  readonly reflection: PositionChangeReflectionDisposition;
}

export type PositionChangeJournalOutcome =
  | { readonly kind: 'Entry'; readonly entry: JournalEntryRecord }
  | { readonly kind: 'Debt'; readonly debt: JournalDebtRecord }
  | { readonly kind: 'Decline'; readonly decline: JournalDeclineRecord };

export type RecordPositionChangeResult =
  | {
      readonly status: 'Recorded';
      readonly postCommit: {
        readonly trade: TradeRecordRow;
        readonly positionChange: PositionChangeRecord;
        readonly executions: readonly ExecutionRecord[];
        readonly derived: DerivedLongStockState;
        readonly journalOutcome: PositionChangeJournalOutcome;
      };
    }
  | {
      readonly status: 'Conflict';
      readonly currentFactRevision: number;
      readonly message: string;
    }
  | {
      readonly status: 'Rejected';
      readonly errors: readonly ConfirmPlanFieldError[];
    }
  | RuntimeNotWritableResult;

export interface TradeWorkflows {
  confirmPlan(command: ConfirmPlanCommand): Promise<ConfirmPlanResult>;
  recordPositionChange(command: RecordPositionChangeCommand): Promise<RecordPositionChangeResult>;
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
          'proj_trade_analysis_input',
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
          tx.put('proj_trade_analysis_input', {
            tradeId,
            factRevision: 1,
            lifecycleState: 'Planned',
            openSharesDisplay: '0',
            executionCount: 0,
            updatedAt: now,
          });

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

    async recordPositionChange(
      command: RecordPositionChangeCommand,
    ): Promise<RecordPositionChangeResult> {
      const txResult = await persistence.runWriteTransaction(
        [
          'trades',
          'position_changes',
          'executions',
          'deviations',
          'journal_definitions',
          'journal_entries',
          'journal_debt',
          'journal_declines',
          'proj_trade_analysis_input',
        ],
        async (tx): Promise<Exclude<RecordPositionChangeResult, RuntimeNotWritableResult>> => {
          const trade = await tx.get('trades', command.tradeId);
          if (!trade) {
            return {
              status: 'Rejected',
              errors: [{ field: 'tradeId', message: 'Trade not found.' }],
            };
          }

          if (trade.factRevision !== command.expectedFactRevision) {
            return {
              status: 'Conflict',
              currentFactRevision: trade.factRevision,
              message: 'Trade was modified since it was loaded.',
            };
          }

          if (trade.lifecycleState !== 'Planned' && trade.lifecycleState !== 'Open') {
            return {
              status: 'Rejected',
              errors: [
                {
                  field: 'tradeId',
                  message: `Cannot record opening execution on a ${trade.lifecycleState} Trade.`,
                },
              ],
            };
          }

          const errors: ConfirmPlanFieldError[] = [];
          if (command.executions.length === 0) {
            errors.push({
              field: 'executions',
              message: 'Add at least one opening fill.',
            });
          }

          const parsedExecs: {
            quantity: ReturnType<typeof ExactNumber.toJSON>;
            fillPrice: ReturnType<typeof ExactNumber.toJSON>;
            fee: ReturnType<typeof ExactNumber.toJSON>;
            plannedLegIntent: PlannedLegIntent;
          }[] = [];

          command.executions.forEach((ex, idx) => {
            const qty = tryFromDecimalString(ex.quantity);
            if (!qty || !isPositive(qty)) {
              errors.push({
                field: `executions[${idx}].quantity`,
                message: `Fill #${idx + 1}: Share quantity must be positive.`,
              });
            }
            const price = tryFromDecimalString(ex.fillPrice);
            if (!price || !isPositive(price)) {
              errors.push({
                field: `executions[${idx}].fillPrice`,
                message: `Fill #${idx + 1}: Fill price must be greater than zero.`,
              });
            }
            const fee = tryFromDecimalString(ex.fee.trim() === '' ? '0' : ex.fee);
            if (!fee || isNegative(fee)) {
              errors.push({
                field: `executions[${idx}].fee`,
                message: `Fill #${idx + 1}: Fee cannot be negative.`,
              });
            }
            if (qty && isPositive(qty) && price && isPositive(price) && fee && !isNegative(fee)) {
              parsedExecs.push({
                quantity: ExactNumber.toJSON(qty),
                fillPrice: ExactNumber.toJSON(price),
                fee: ExactNumber.toJSON(fee),
                plannedLegIntent: ex.plannedLegIntent,
              });
            }
          });

          const [existingExecs, existingDevs, definitions] = await Promise.all([
            tx.getAllByIndex('executions', 'by_trade', trade.id),
            tx.getAllByIndex('deviations', 'by_trade', trade.id),
            tx.getAll('journal_definitions'),
          ]);

          // Pre-mutation integrity agreement check: never auto-repair disagreeing stored state
          const preCheck = deriveLongStockPosition({
            storedLifecycleState: trade.lifecycleState,
            plan: {
              plannedQuantity: trade.plannedQuantity,
              intendedEntryPrice: trade.intendedEntryPrice,
              stopPrice: trade.stopPrice,
              targetPrice: trade.targetPrice,
            },
            executions: existingExecs,
          });
          if (preCheck.integrityDisagreement) {
            return {
              status: 'Rejected',
              errors: [
                {
                  field: 'tradeId',
                  message: `Facts can't be replayed: stored lifecycle (${trade.lifecycleState}) disagrees with derived state (${preCheck.derivedLifecycleState}).`,
                },
              ],
            };
          }

          const parsedEconMs = Date.parse(command.economicTime);
          if (Number.isNaN(parsedEconMs)) {
            errors.push({
              field: 'economicTime',
              message: 'Execution Economic Time must be a valid timestamp.',
            });
          }
          const canonicalEconomicTime = Number.isNaN(parsedEconMs)
            ? command.economicTime
            : new Date(parsedEconMs).toISOString();

          const pcDefinition = [...definitions]
            .filter((d) => d.entryTypeId === POSITION_CHANGE_REFLECTION_TYPE_ID)
            .sort((a, b) => b.revision - a.revision)[0];

          let validatedNote: string | undefined;
          if (command.reflection.kind === 'Complete') {
            const check = validatePositionChangeReflectionInput(pcDefinition, command.reflection);
            if (!check.ok) {
              errors.push(...check.errors);
            } else {
              validatedNote = check.note;
            }
          } else if (command.reflection.kind === 'Defer' && !pcDefinition) {
            errors.push({
              field: 'reflection',
              message: 'Position Change Reflection definition is missing; cannot snapshot Debt.',
            });
          }

          if (errors.length > 0) {
            return { status: 'Rejected', errors };
          }

          const now = clock.nowIso();
          const nextFactRevision = trade.factRevision + 1;
          const positionChangeId = genId('pc');
          let seq = existingExecs.length + 2;

          const newExecRecords: ExecutionRecord[] = parsedExecs.map((p) => ({
            id: genId('exec'),
            tradeId: trade.id,
            positionChangeId,
            side: 'Buy',
            quantity: p.quantity,
            fillPrice: p.fillPrice,
            fee: p.fee,
            plannedLegIntent: p.plannedLegIntent,
            economicTime: canonicalEconomicTime,
            recordedSequence: seq++,
            recordedAt: now,
          }));

          const allExecs = [...existingExecs, ...newExecRecords];
          const derived = deriveLongStockPosition({
            storedLifecycleState: 'Open',
            plan: {
              plannedQuantity: trade.plannedQuantity,
              intendedEntryPrice: trade.intendedEntryPrice,
              stopPrice: trade.stopPrice,
              targetPrice: trade.targetPrice,
            },
            executions: allExecs,
          });

          const updatedTrade: TradeRecordRow = {
            ...trade,
            lifecycleState: derived.derivedLifecycleState,
            factRevision: nextFactRevision,
            updatedAt: now,
          };

          const positionChange: PositionChangeRecord = {
            id: positionChangeId,
            tradeId: trade.id,
            recordedSequence: nextFactRevision,
            economicTime: command.economicTime,
            executionIds: newExecRecords.map((e) => e.id),
            recordedAt: now,
          };

          tx.put('trades', updatedTrade);
          tx.put('position_changes', positionChange);
          for (const exec of newExecRecords) {
            tx.put('executions', exec);
          }

          // Reconcile fact-only deviations for this Trade
          for (const oldDev of existingDevs) {
            tx.delete('deviations', oldDev.id);
          }
          for (const dev of derived.deviations) {
            const devRec: DeviationRecord = {
              id: genId('dev'),
              tradeId: trade.id,
              kind: dev.kind,
              message: dev.message,
              recordedAt: now,
            };
            tx.put('deviations', devRec);
          }

          let journalOutcome: PositionChangeJournalOutcome;
          if (command.reflection.kind === 'Complete') {
            const entry: JournalEntryRecord = {
              id: genId('jrn'),
              entryTypeId: POSITION_CHANGE_REFLECTION_TYPE_ID,
              definitionId: pcDefinition!.id,
              definitionRevision: pcDefinition!.revision,
              definitionSnapshot: pcDefinition!,
              source: 'PositionChange',
              anchor: { kind: 'Trade', tradeId: trade.id },
              tradeId: trade.id,
              origin: { kind: 'PositionChange', factId: positionChangeId },
              responses: {
                decisionMode: command.reflection.decisionMode,
                primaryEmotion: command.reflection.primaryEmotion,
                decisionConfidence: command.reflection.decisionConfidence,
                note: validatedNote,
              },
              recordedAt: now,
            };
            tx.put('journal_entries', entry);
            journalOutcome = { kind: 'Entry', entry };
          } else if (command.reflection.kind === 'Defer') {
            const debt: JournalDebtRecord = {
              id: genId('debt'),
              tradeId: trade.id,
              entryTypeId: POSITION_CHANGE_REFLECTION_TYPE_ID,
              definitionSnapshot: pcDefinition!,
              source: 'PositionChange',
              origin: { kind: 'PositionChange', factId: positionChangeId },
              status: 'Outstanding',
              createdAt: now,
            };
            tx.put('journal_debt', debt);
            journalOutcome = { kind: 'Debt', debt };
          } else {
            const decline: JournalDeclineRecord = {
              id: genId('decl'),
              tradeId: trade.id,
              entryTypeId: POSITION_CHANGE_REFLECTION_TYPE_ID,
              source: 'PositionChange',
              origin: { kind: 'PositionChange', factId: positionChangeId },
              reason: command.reflection.reason?.trim() || undefined,
              recordedAt: now,
            };
            tx.put('journal_declines', decline);
            journalOutcome = { kind: 'Decline', decline };
          }

          tx.put('proj_trade_analysis_input', {
            tradeId: trade.id,
            factRevision: nextFactRevision,
            lifecycleState: updatedTrade.lifecycleState,
            openSharesDisplay: derived.openSharesDisplay,
            executionCount: allExecs.length,
            updatedAt: now,
          });

          return {
            status: 'Recorded',
            postCommit: {
              trade: updatedTrade,
              positionChange,
              executions: newExecRecords,
              derived,
              journalOutcome,
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
