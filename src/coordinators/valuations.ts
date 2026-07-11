import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Position, TradeId } from '@/domain/trademath/types'
import { positionOf } from '@/domain/trademath/position'

// The only place TradeBook facts meet TradeMath (and, from S1.5, PriceBook).
// Returns finished items the UI renders directly. This slice implements its
// first operation — position — which needs no Marks: TradeBook serves the
// record, TradeMath.positionOf derives the holdings. PriceBook is not consulted.

export class Valuations {
  constructor(private tradeBook: TradeBook) {}

  async position(tradeId: TradeId): Promise<Position> {
    const record = await this.tradeBook.get(tradeId)
    return positionOf(record)
  }
}
