// A Strategy's immutable structural shape: ordered long/short Stock/Call/Put roles with positive
// relative quantities (Reference Catalog, "Strategy shapes and canonical seeds").
export interface StrategyRole {
  readonly side: 'Long' | 'Short';
  readonly instrument: 'Stock' | 'Call' | 'Put';
  readonly ratio: number;
}

export interface StrategyShape {
  readonly roles: readonly StrategyRole[];
}
