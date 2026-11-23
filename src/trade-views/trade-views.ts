import type {
  ExecutionRecord,
  JournalDebtRecord,
  JournalDeclineRecord,
  JournalEntryRecord,
  PersistenceSeam,
  PlanVersionFactRecord,
  TradeLifecycleState,
  TradeRecordRow,
} from '../persistence/idb';
import { ExactNumber, toDecimalString, toMoneyString } from '../shared/exact-number';
import { deriveLongStockPosition, type DerivedLongStockState } from '../trade-analysis/derive';

export interface TradeBrowseItem {
  readonly id: string;
  readonly symbol: string;
  readonly lifecycleState: TradeLifecycleState;
  readonly strategyLabel: string;
  readonly accountLabel: string;
  readonly institutionLabel: string;
  readonly plannedQuantityDisplay: string;
  readonly openSharesDisplay: string;
  readonly intendedEntryDisplay: string;
  readonly oneRDisplay: string;
  readonly plannedRewardDisplay: string;
  readonly plannedRRDisplay: string;
  readonly createdAt: string;
}

export interface TradeDetailCockpitViewModel {
  readonly trade: TradeRecordRow;
  readonly strategyLabel: string;
  readonly accountLabel: string;
  readonly institutionLabel: string;
  readonly plannedQuantityDisplay: string;
  readonly intendedEntryDisplay: string;
  readonly stopPriceDisplay: string;
  readonly targetPriceDisplay: string;
  readonly planFact: PlanVersionFactRecord;
  readonly executions: readonly ExecutionRecord[];
  readonly derived: DerivedLongStockState;
  readonly journalEntries: readonly JournalEntryRecord[];
  readonly journalDebt: readonly JournalDebtRecord[];
  readonly journalDeclines: readonly JournalDeclineRecord[];
}

export interface TradeViewsAndReporting {
  browseTrades(filter?: {
    readonly lifecycleState?: TradeLifecycleState;
  }): Promise<{ readonly items: readonly TradeBrowseItem[] }>;
  getTradeDetail(tradeId: string): Promise<TradeDetailCockpitViewModel | null>;
}

function formatShares(raw: { num: string; den: string }): string {
  const rat = ExactNumber.fromJSON(raw);
  return rat.den === 1n ? rat.num.toString() : toDecimalString(rat, 4).replace(/\.?0+$/, '');
}

export function createTradeViews(options: {
  readonly persistence: PersistenceSeam;
}): TradeViewsAndReporting {
  const { persistence } = options;

  return {
    async browseTrades(filter = {}) {
      return persistence.runReadTransaction(
        [
          'trades',
          'catalog_institutions',
          'catalog_accounts',
          'catalog_strategies',
          'proj_trade_analysis_input',
        ],
        async (tx) => {
          const [trades, institutions, accounts, strategies, projections] = await Promise.all([
            tx.getAll('trades'),
            tx.getAll('catalog_institutions'),
            tx.getAll('catalog_accounts'),
            tx.getAll('catalog_strategies'),
            tx.getAll('proj_trade_analysis_input'),
          ]);

          const instMap = new Map(institutions.map((i) => [i.id, i.currentLabel]));
          const acctMap = new Map(accounts.map((a) => [a.id, a.currentLabel]));
          const stratMap = new Map(strategies.map((s) => [s.id, s.currentLabel]));
          const projMap = new Map(projections.map((p) => [p.tradeId, p]));

          const items: TradeBrowseItem[] = trades
            .filter((t) => !filter.lifecycleState || t.lifecycleState === filter.lifecycleState)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((t) => ({
              id: t.id,
              symbol: t.symbol,
              lifecycleState: t.lifecycleState,
              strategyLabel: stratMap.get(t.strategyId) ?? 'Unknown Strategy',
              accountLabel: acctMap.get(t.accountId) ?? 'Unknown Account',
              institutionLabel: instMap.get(t.institutionId) ?? 'Unknown Institution',
              plannedQuantityDisplay: formatShares(t.plannedQuantity),
              openSharesDisplay: projMap.get(t.id)?.openSharesDisplay ?? '0',
              intendedEntryDisplay: toMoneyString(ExactNumber.fromJSON(t.intendedEntryPrice)),
              oneRDisplay: t.baseline.originalPlannedRiskDisplay,
              plannedRewardDisplay: t.baseline.originalPlannedRewardDisplay,
              plannedRRDisplay: t.baseline.plannedRewardToRiskDisplay,
              createdAt: t.createdAt,
            }));

          return { items };
        },
      );
    },

    async getTradeDetail(tradeId: string): Promise<TradeDetailCockpitViewModel | null> {
      return persistence.runReadTransaction(
        [
          'trades',
          'trade_facts',
          'executions',
          'journal_entries',
          'journal_debt',
          'journal_declines',
          'catalog_institutions',
          'catalog_accounts',
          'catalog_strategies',
        ],
        async (tx) => {
          const trade = await tx.get('trades', tradeId);
          if (!trade) {
            return null;
          }

          const [facts, executions, entries, debt, declines, institution, account, strategy] =
            await Promise.all([
              tx.getAllByIndex('trade_facts', 'by_trade', tradeId),
              tx.getAllByIndex('executions', 'by_trade', tradeId),
              tx.getAllByIndex('journal_entries', 'by_trade', tradeId),
              tx.getAllByIndex('journal_debt', 'by_trade', tradeId),
              tx.getAllByIndex('journal_declines', 'by_trade', tradeId),
              tx.get('catalog_institutions', trade.institutionId),
              tx.get('catalog_accounts', trade.accountId),
              tx.get('catalog_strategies', trade.strategyId),
            ]);

          const tradeFacts = [...facts].sort((a, b) => a.recordedSequence - b.recordedSequence);
          const planFact = tradeFacts.find((f) => f.kind === 'PlanVersion');
          if (!planFact) {
            return null;
          }

          const sortedExecs = [...executions].sort((a, b) => {
            const byTime = a.economicTime.localeCompare(b.economicTime);
            return byTime !== 0 ? byTime : a.recordedSequence - b.recordedSequence;
          });

          const derived = deriveLongStockPosition({
            storedLifecycleState: trade.lifecycleState,
            plan: {
              plannedQuantity: trade.plannedQuantity,
              intendedEntryPrice: trade.intendedEntryPrice,
              stopPrice: trade.stopPrice,
              targetPrice: trade.targetPrice,
            },
            executions: sortedExecs,
          });

          const journalEntries = [...entries].sort((a, b) =>
            b.recordedAt.localeCompare(a.recordedAt),
          );
          const journalDebt = [...debt].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          const journalDeclines = [...declines].sort((a, b) =>
            b.recordedAt.localeCompare(a.recordedAt),
          );

          return {
            trade,
            strategyLabel: strategy?.currentLabel ?? 'Unknown Strategy',
            accountLabel: account?.currentLabel ?? 'Unknown Account',
            institutionLabel: institution?.currentLabel ?? 'Unknown Institution',
            plannedQuantityDisplay: formatShares(trade.plannedQuantity),
            intendedEntryDisplay: toMoneyString(ExactNumber.fromJSON(trade.intendedEntryPrice)),
            stopPriceDisplay: toMoneyString(ExactNumber.fromJSON(trade.stopPrice)),
            targetPriceDisplay: toMoneyString(ExactNumber.fromJSON(trade.targetPrice)),
            planFact,
            executions: sortedExecs,
            derived,
            journalEntries,
            journalDebt,
            journalDeclines,
          };
        },
      );
    },
  };
}
