import type {
  PersistenceSeam,
  TradeFactRecord,
  TradeLifecycleState,
  TradeRecordRow,
} from '../persistence/idb';

export interface TradeRecordAggregate {
  readonly trade: TradeRecordRow;
  readonly facts: readonly TradeFactRecord[];
}

export interface TradeRecord {
  getRecord(tradeId: string): Promise<TradeRecordAggregate | null>;
  queryRecords(filter?: {
    readonly lifecycleState?: TradeLifecycleState;
  }): Promise<{ readonly items: readonly TradeRecordRow[] }>;
}

export function createTradeRecord(options: {
  readonly persistence: PersistenceSeam;
}): TradeRecord {
  const { persistence } = options;

  return {
    async getRecord(tradeId: string): Promise<TradeRecordAggregate | null> {
      return persistence.runReadTransaction(['trades', 'trade_facts'], async (tx) => {
        const trade = await tx.get('trades', tradeId);
        if (!trade) {
          return null;
        }
        const allFacts = await tx.getAllByIndex('trade_facts', 'by_trade', tradeId);
        const facts = [...allFacts].sort((a, b) => a.recordedSequence - b.recordedSequence);
        return { trade, facts };
      });
    },

    async queryRecords(filter = {}): Promise<{ readonly items: readonly TradeRecordRow[] }> {
      const all = await persistence.runReadTransaction(['trades'], (tx) => tx.getAll('trades'));
      const filtered = all
        .filter((t) => {
          if (filter.lifecycleState && t.lifecycleState !== filter.lifecycleState) {
            return false;
          }
          return true;
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { items: filtered };
    },
  };
}
