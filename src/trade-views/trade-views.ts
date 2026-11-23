import type {
  JournalEntryRecord,
  PersistenceSeam,
  PlanVersionFactRecord,
  TradeLifecycleState,
  TradeRecordRow,
} from '../persistence/idb';
import { ExactNumber, toDecimalString, toMoneyString } from '../shared/exact-number';

export interface TradeBrowseItem {
  readonly id: string;
  readonly symbol: string;
  readonly lifecycleState: TradeLifecycleState;
  readonly strategyLabel: string;
  readonly accountLabel: string;
  readonly institutionLabel: string;
  readonly plannedQuantityDisplay: string;
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
  readonly journalEntries: readonly JournalEntryRecord[];
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
        ['trades', 'catalog_institutions', 'catalog_accounts', 'catalog_strategies'],
        async (tx) => {
          const [trades, institutions, accounts, strategies] = await Promise.all([
            tx.getAll('trades'),
            tx.getAll('catalog_institutions'),
            tx.getAll('catalog_accounts'),
            tx.getAll('catalog_strategies'),
          ]);

          const instMap = new Map(institutions.map((i) => [i.id, i.currentLabel]));
          const acctMap = new Map(accounts.map((a) => [a.id, a.currentLabel]));
          const stratMap = new Map(strategies.map((s) => [s.id, s.currentLabel]));

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
          'journal_entries',
          'catalog_institutions',
          'catalog_accounts',
          'catalog_strategies',
        ],
        async (tx) => {
          const trade = await tx.get('trades', tradeId);
          if (!trade) {
            return null;
          }

          const [facts, entries, institution, account, strategy] = await Promise.all([
            tx.getAllByIndex('trade_facts', 'by_trade', tradeId),
            tx.getAllByIndex('journal_entries', 'by_trade', tradeId),
            tx.get('catalog_institutions', trade.institutionId),
            tx.get('catalog_accounts', trade.accountId),
            tx.get('catalog_strategies', trade.strategyId),
          ]);

          const tradeFacts = [...facts].sort((a, b) => a.recordedSequence - b.recordedSequence);
          const planFact = tradeFacts.find((f) => f.kind === 'PlanVersion');
          if (!planFact) {
            return null;
          }

          const journalEntries = [...entries].sort((a, b) =>
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
            journalEntries,
          };
        },
      );
    },
  };
}
