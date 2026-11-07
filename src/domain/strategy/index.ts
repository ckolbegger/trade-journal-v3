// A Strategy's immutable structural shape: ordered long/short Stock/Call/Put roles with positive
// relative quantities (Reference Catalog, "Strategy shapes and canonical seeds"). Pure rules over a
// shape that callers pass in; nothing here looks a Strategy up or decides a fact from a leg's sign.
export interface StrategyRole {
  readonly side: 'Long' | 'Short';
  readonly instrument: 'Stock' | 'Call' | 'Put';
  readonly ratio: number;
}

export interface StrategyShape {
  readonly roles: readonly StrategyRole[];
}

// A leg as the shape rules see it: its side and what it is, never its quantity or price.
export interface ShapedLeg {
  readonly side: 'Long' | 'Short';
  readonly instrument: { readonly kind: 'Stock' } | { readonly kind: 'Option'; readonly right: 'Call' | 'Put' };
}

function roleOf(leg: ShapedLeg): StrategyRole['instrument'] {
  return leg.instrument.kind === 'Stock' ? 'Stock' : leg.instrument.right;
}

// Legs must fill the Strategy's ordered roles exactly.
export function matchesShape(legs: readonly ShapedLeg[], shape: StrategyShape): boolean {
  return (
    legs.length === shape.roles.length &&
    legs.every((leg, i) => leg.side === shape.roles[i]?.side && roleOf(leg) === shape.roles[i]?.instrument)
  );
}

// Two shapes are the same when their ordered roles are equal.
export function sameShape(a: StrategyShape, b: StrategyShape): boolean {
  return (
    a.roles.length === b.roles.length &&
    a.roles.every((r, i) => r.side === b.roles[i]?.side && r.instrument === b.roles[i]?.instrument && r.ratio === b.roles[i]?.ratio)
  );
}

// Exercise Intent is a fact of a long option only (A100): a shape whose single role is a long Call or Put.
export function exerciseIntentApplies(shape: StrategyShape): boolean {
  const [role] = shape.roles;
  return shape.roles.length === 1 && role?.side === 'Long' && role.instrument !== 'Stock';
}
