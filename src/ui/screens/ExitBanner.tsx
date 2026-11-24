import type { ReviewTradeItem } from '../../app/types.ts';
import { quantity, shortDate } from '../format.ts';

type ExitCarry = NonNullable<ReviewTradeItem['exitCarry']>;

// The two ways to answer an Exit that was not carried out: record the sale, or say the Position is still held (A313).
function Answers({ carry, onSold, onHolding }: { readonly carry: ExitCarry; readonly onSold: () => void; readonly onHolding: () => void }) {
  return (
    <>
      <button type="button" className="pill secondary" onClick={onSold}>
        I {carry.direction === 'Long' ? 'sold' : 'bought back'}: record it
      </button>{' '}
      <button type="button" className="pill secondary" onClick={onHolding}>
        Still holding
      </button>
    </>
  );
}

interface Answering {
  readonly carry: ExitCarry;
  readonly onSold: () => void;
  readonly onHolding: () => void;
}

// What the Exit still holds, in words (W129): "You chose Exit on Mon Nov 16. Sold 1 since. Still holding 1."
export function ExitBanner({ reviewDate, carry, onSold, onHolding }: Answering & { readonly reviewDate: string }) {
  return (
    <div role="group" aria-label="Exit not carried out" className="banner exit-banner">
      <p>
        <b>
          You chose Exit on {shortDate(reviewDate)}. {carry.sold && `${carry.direction === 'Long' ? 'Sold' : 'Bought back'} ${quantity(carry.sold)} since. `}Still holding {quantity(carry.held)}.
        </b>{' '}
        <Answers carry={carry} onSold={onSold} onHolding={onHolding} />
      </p>
    </div>
  );
}

// The day card's line for one Trade: the day it chose Exit, why, and what is still held.
export function ExitDayNote({ underlying, lastAction, ...answering }: Answering & { readonly underlying: string; readonly lastAction: { readonly reviewDate: string; readonly reason?: string } }) {
  return (
    <div role="group" aria-label={`Exit not carried out: ${underlying}`} className="note exit-banner">
      <p>
        <b>
          {shortDate(lastAction.reviewDate)} you chose Exit on {underlying}:
        </b>{' '}
        {lastAction.reason && `“${lastAction.reason}”`} Still holding {quantity(answering.carry.held)}.{' '}
        <Answers {...answering} />
      </p>
    </div>
  );
}
