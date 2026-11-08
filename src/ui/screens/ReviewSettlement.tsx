import { Link } from 'react-router';
import type { SettlementItem } from '../../app/types.ts';
import { toWorkspaceLocal } from '../../domain/time/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { instrumentLabel } from '../calculation-words.ts';
import { calculation } from '../figures.ts';
import { shortDate } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { settlementTime, signedContracts } from './option-words.ts';

// The exchange's zone: a settlement time is the close of a session, whatever zone the Workspace shows times in.
const EXCHANGE_ZONE = 'America/New_York';

// The assignment or exercise limit, keyed by the item's signed quantity and never by the Strategy (row 24.4, decision 88).
const assignmentSentence = (short: boolean): string =>
  short
    ? "If it was assigned, this release can't record the assignment yet, so this Review stays incomplete until a later release can"
    : "If it was exercised, this release can't record the exercise yet, so this Review stays incomplete until a later release can";

// The panel header's one-line summary: "Short 2 contracts, expired Fri Nov 20" (row 24.1).
export const settlementSummary = (items: readonly SettlementItem[]): string => items.map((item) => `${signedContracts(item.quantity)}, expired ${shortDate(item.expiration)}`).join('; ');

// When the expiration date was not a session, the settlement time is the close of the latest session before it (row 24.9).
function notASession(item: SettlementItem): string | undefined {
  if (item.settlementTime.kind !== 'Value') return undefined;
  const session = toWorkspaceLocal(item.settlementTime.value, EXCHANGE_ZONE).split('T')[0] ?? '';
  return session === item.expiration ? undefined : `${shortDate(item.expiration)} wasn't a trading session, so the settlement time is the close of ${shortDate(session)}.`;
}

export interface SettlementPanelProps {
  readonly tradeId: string;
  readonly items: readonly SettlementItem[];
  readonly timeZone: string;
}

// The card's Settlement panel: each contract still held at or past its expiration date, and where to record its expiration.
// Record expiration opens the form on its own page, which offers the way back to the Review (conflict K14); an item whose
// date lies outside the market calendar has no settlement time to record at, so it offers none (row Q1).
export function SettlementPanel({ tradeId, items, timeZone }: SettlementPanelProps) {
  const { writable } = useRuntime();
  return (
    <section aria-label="Settlement">
      {items.map((item) => {
        const note = notASession(item);
        return (
          <div key={`${instrumentLabel(item.instrument)}`}>
            <dl>
              <div>
                <dt>Contract</dt>
                <dd>{instrumentLabel(item.instrument)}</dd>
              </div>
              <div>
                <dt>Quantity</dt>
                <dd>{signedContracts(item.quantity)}</dd>
              </div>
              <div>
                <dt>Settlement time</dt>
                <dd>{calculation(item.settlementTime, (instant) => settlementTime(instant, timeZone))}</dd>
              </div>
            </dl>
            {note && <p>{note}</p>}
            <p>{assignmentSentence(item.quantity.compare(Rational.of(0n)) < 0)}</p>
          </div>
        );
      })}
      {writable && items.every((item) => item.settlementTime.kind === 'Value') && (
        <Link className="pill primary" to={`/trades/${tradeId}/record-expiration?from=review`}>
          Record expiration
        </Link>
      )}
    </section>
  );
}
