import { describe, expect, it } from 'vitest';
import { optionTrade, OC_CONTRACT, OS_CONTRACT } from '../../tests/support/option-trade-fixtures.ts';
import { standingOf } from './settlement.ts';

const partClosedBefore = (which: 'O-C' | 'O-S', contract: typeof OC_CONTRACT) => {
  const standing = standingOf(optionTrade(which).derivation, contract, '40.00');
  if (standing.kind !== 'Value') throw new Error('expected a Value');
  return standing.value.partClosedBefore;
};

describe('the standing of an expiring contract (W141)', () => {
  it('should report that part of the position was closed before when the Trade sold some of it', () => {
    // R-O-C: 1 of 2 calls sold by X1 before the expiration.
    expect(partClosedBefore('O-C', OC_CONTRACT)).toBe(true);
  });

  it('should report that nothing was closed before when the Trade only opened the position', () => {
    expect(partClosedBefore('O-S', OS_CONTRACT)).toBe(false);
  });
});
