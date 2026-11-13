import { Link } from 'react-router';
import type { OpenTradeDetail } from '../../../app/types.ts';
import { Rational } from '../../../domain/values/index.ts';
import { instrumentLabel } from '../../calculation-words.ts';
import { calculation, unavailableLabel } from '../../figures.ts';
import { quantity, shortDate } from '../../format.ts';
import { useRuntime } from '../../runtime.tsx';
import { contractCount, settlementTime } from '../option-words.ts';
import { Figure } from './figure.tsx';
import { abs } from './words.ts';

// A contract still held at or past its expiration date, due for settlement (rows 23.9 and 23.10). Whether it was
// assigned or exercised is worded by the sign of its quantity, never by the Strategy (decision 88); Record expiration
// is an authoritative write, so it is offered only while Writable.
export function SettlementDuePanel({ tradeId, items, timeZone }: { readonly tradeId: string; readonly items: OpenTradeDetail['settlement']; readonly timeZone: string }) {
  const { writable } = useRuntime();
  return (
    <section className="card" aria-labelledby="settlement-due-heading">
      {/* The calculation-words module owns the words "Settlement Due" (conflict K4). */}
      <h2 id="settlement-due-heading">{unavailableLabel({ reason: 'SettlementDue', instrument: items[0]!.instrument, expiration: items[0]!.expiration })}</h2>
      {items.map((item) => {
        const short = item.quantity.compare(Rational.of(0n)) < 0;
        return (
          <div key={`${item.instrument.symbol}-${item.expiration}-${item.instrument.strike}`}>
            <dl className="figure-grid">
              <Figure term="Contract" plain>{instrumentLabel(item.instrument)}</Figure>
              <Figure term="Quantity" plain>{`${short ? 'Short' : 'Long'} ${contractCount(quantity(abs(item.quantity)))}`}</Figure>
              <Figure term="Expired" plain>{shortDate(item.expiration)}</Figure>
              <Figure term="Settlement time" plain>{calculation(item.settlementTime, (instant) => settlementTime(instant, timeZone))}</Figure>
            </dl>
            <p>
              {short
                ? "If it was assigned, this release can't record the assignment yet, so this Trade stays open until a later release can."
                : "If it was exercised, this release can't record the exercise yet, so this Trade stays open until a later release can."}
            </p>
          </div>
        );
      })}
      {/* A date outside the market calendar has no settlement time to record at (D7 Q1). */}
      {writable && items.every((item) => item.settlementTime.kind === 'Value') && (
        <Link className="pill primary" to={`/trades/${tradeId}/record-expiration`}>
          Record expiration
        </Link>
      )}
    </section>
  );
}
