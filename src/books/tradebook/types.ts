// Trader-managed records the TradeBook owns. TradeMath never computes over
// these, so they live in the TradeBook module (not the domain fact contract).

export interface Institution {
  id: string
  name: string
  archived?: boolean
}

export interface Account {
  id: string
  name: string
  institutionId: string
  archived?: boolean
}
