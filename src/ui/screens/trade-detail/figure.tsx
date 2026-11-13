import type { ReactNode } from 'react';
import type { PlannedTradeDetail } from '../../../app/types.ts';
import { decimalMoney as price, decimalUnderlyingPrice } from '../../format.ts';
import { conditionDirection } from '../option-words.ts';
import type { PlannedLeg } from './words.ts';

// One label and value in a figure grid; a row never grows wider than its cap (app.css).
export function Figure({ term, plain, tone, children }: { readonly term: string; readonly plain?: boolean; readonly tone?: 'stop' | 'target'; readonly children: ReactNode }) {
  return (
    <div>
      <dt className={tone && `${tone}-label`}>{term}</dt>
      <dd className={[plain ? '' : 'number', tone ?? ''].filter(Boolean).join(' ') || undefined}>{children}</dd>
    </div>
  );
}

type PlannedCondition = PlannedTradeDetail['plan']['stops'][number];

// A Plan's Stops or Targets, one line per condition in Plan order (W6). A stock's is its price in dollars; an option's
// reads "MNO at or below 41.00" for an Underlying price (C3) and "Option at or above $3.60" for an option price.
export function ConditionLines({ role, conditions, leg, symbol }: { readonly role: 'Stop' | 'Target'; readonly conditions: readonly PlannedCondition[]; readonly leg: PlannedLeg | undefined; readonly symbol: string }) {
  const option = leg?.instrument.kind === 'Option' ? { right: leg.instrument.right, side: leg.side } : undefined;
  return (
    <>
      {conditions.map((condition) => (
        <div key={condition.factId}>
          {option
            ? condition.kind === 'StructureValue'
              ? `Option at or ${conditionDirection(role, condition.kind, option)} ${price(condition.price)}`
              : `${symbol} at or ${conditionDirection(role, condition.kind, option)} ${decimalUnderlyingPrice(condition.price)}`
            : price(condition.price)}
        </div>
      ))}
    </>
  );
}
