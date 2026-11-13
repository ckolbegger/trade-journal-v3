import type { ClosedTradeDetail, OpenTradeDetail, PlannedTradeDetail } from '../../../app/types.ts';
import { Rational } from '../../../domain/values/index.ts';
import { Badge } from '../../Badge.tsx';
import { TradeText } from '../../TradeText.tsx';
import { decimalMoney as price, money, netCost, quantity, ratio, tradeSummary } from '../../format.ts';
import { calculation } from '../../figures.ts';
import { contractCount, expirationDate } from '../option-words.ts';
import { ConditionLines, Figure } from './figure.tsx';
import { abs } from './words.ts';

// The Trade at a glance, from values the Detail already holds. Stop and Target carry their colour
// and always their label.
export function SummaryCard({ view, timeZone }: { readonly view: PlannedTradeDetail | OpenTradeDetail | ClosedTradeDetail; readonly timeZone: string }) {
  const leg = view.plan.legs[0];
  const contract = leg?.instrument.kind === 'Option' ? leg.instrument : undefined;
  const held = 'heldQuantity' in view ? view.heldQuantity : Rational.of(0n);
  const expiration = view.contractExpiration;
  return (
    <section className="card summary-card" aria-label="Summary">
      {view.summary && <p className="summary-text number"><TradeText text={tradeSummary(view.summary, timeZone)} /></p>}
      {/* A contract due for settlement has its panel. A Closed Trade shows "Expired" only when its Terminal Disposition
          includes an expiration; one only the trader's Executions disposed of shows no line (decision 94, row 23.19). */}
      {expiration && <p>{`${expiration.status} ${expirationDate(expiration.date)}`}</p>}
      {'deviations' in view && view.deviations.some((d) => d.versions.at(-1)?.status === 'Active') && <Badge tone="warning">Deviation active</Badge>}
      <dl className="figure-grid">
        {'netCost' in view && view.netCost.kind === 'Value' && <Figure term="Net cost">{netCost(view.netCost.value)}</Figure>}
        {'positionChanges' in view && (
          <>
            {/* A Closed Trade holds no shares, so its quantity against the plan would read as none. */}
            {!('terminalDisposition' in view) && (
              <Figure term="Quantity">{contract ? `${quantity(abs(held))} of ${contractCount(leg?.quantity ?? 0)}` : `${quantity(held)} of ${leg?.quantity ?? ''} shares`}</Figure>
            )}
            <Figure term="Entry" plain>{view.entryStatus}</Figure>
            <Figure term="Opening fees">{money(view.fees.incurredOpening)}</Figure>
          </>
        )}
        {'positionChanges' in view && view.entryQuality.kind === 'Value' && (
          <>
            <Figure term="Average entry">{calculation(view.entryQuality.value.averageEntry, money)}</Figure>
            <Figure term="Actual initial risk">{calculation(view.entryQuality.value.actualInitialRisk, money)}</Figure>
          </>
        )}
        {!('positionChanges' in view) && <Figure term="Intended entry">{leg ? price(leg.intendedEntry) : ''}</Figure>}
        <Figure term="Stop" tone="stop"><ConditionLines role="Stop" conditions={view.plan.stops} leg={leg} symbol={view.plan.underlying} /></Figure>
        <Figure term="Target" tone="target"><ConditionLines role="Target" conditions={view.plan.targets} leg={leg} symbol={view.plan.underlying} /></Figure>
        {!('positionChanges' in view) && (
          <>
            <Figure term="1R">{money(view.baseline.oneR)}</Figure>
            <Figure term="Reward : risk">{ratio(view.baseline.rewardRiskRatio)}</Figure>
          </>
        )}
      </dl>
      {'positionChanges' in view && view.entryQuality.kind !== 'Value' && <p>Entry not yet resolved</p>}
    </section>
  );
}
