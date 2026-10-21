import { Link } from 'react-router';
import type { IntegrityFinding, PositionChangeResult } from '../../app/types.ts';
import { decimalMoney as price, localTime, money, ratio } from '../format.ts';

type Recorded = Extract<PositionChangeResult, { readonly kind: 'Recorded' }>;

export interface PositionChangeReceiptProps {
  readonly result: Recorded;
  readonly timeZone: string;
}

// What one repair of stored records changed, in plain language (P7).
function repairText(finding: IntegrityFinding): string {
  switch (finding.kind) {
    case 'LifecycleDisagreement':
      return `The stored lifecycle was ${finding.stored}; the recorded facts show ${finding.expected}.`;
    case 'DeviationMissing':
      return 'A missing Entry Size Deviation was recorded.';
    case 'DeviationQuantityDisagreement':
      return 'An Entry Size Deviation’s quantity was corrected.';
    case 'DeviationUnexpected':
      return 'An Entry Size Deviation the facts no longer imply was superseded.';
  }
}

// The saved entry, rendered from the command's post-commit result alone (AC-RESP-001): the
// Position Change, Entry Quality once resolved, new Entry Size Deviations, what an earlier-dated
// entry changed (P5), any repairs (P7), and the reflection outcome.
export function PositionChangeReceipt({ result, timeZone }: PositionChangeReceiptProps) {
  const { receipt, postCommit } = result;
  const changes = postCommit.trade.positionChanges;
  const timeOf = (positionChangeId: string) => localTime(changes.find((c) => c.factId === positionChangeId)?.economicTime ?? '', timeZone);
  const savedId = receipt.createdFactIds[0]!;
  const saved = changes.find((c) => c.factId === savedId)!;
  const quality = postCommit.derivation.entryQuality;
  const figures = quality.kind === 'Value' ? quality.value : undefined;
  const shown = (r: { readonly kind: string; readonly value?: unknown }, format: (v: never) => string) =>
    r.kind === 'Value' ? format(r.value as never) : 'Not applicable';
  const created = receipt.deviationReconciliation.filter((d) => d.action === 'Create');
  const reflection = postCommit.reflection;

  return (
    <section className="card" aria-labelledby="receipt-heading">
      <h1 id="receipt-heading">Entry recorded</h1>
      <section aria-labelledby="saved-change-heading">
        <h2 id="saved-change-heading">{`Position Change at ${localTime(saved.economicTime, timeZone)}`}</h2>
        <ul>
          {saved.executions.map((e) => (
            <li key={e.factId}>{`${e.action} ${e.quantity} ${e.instrument.symbol} @ ${price(e.price)}, fee ${price(e.fee)}`}</li>
          ))}
        </ul>
      </section>
      {figures && (
        <section aria-labelledby="entry-quality-heading">
          <h2 id="entry-quality-heading">Entry Quality</h2>
          <dl>
            <dt>Average entry</dt>
            <dd className="number">{shown(figures.averageEntry, money)}</dd>
            <dt>Actual initial risk</dt>
            <dd className="number">{`${shown(figures.actualInitialRisk, money)} (${shown(figures.riskInPlanR, ratio)}R)`}</dd>
            <dt>Actual initial reward</dt>
            <dd className="number">{shown(figures.actualInitialReward, money)}</dd>
            <dt>Reward : risk</dt>
            <dd className="number">{`${shown(figures.actualRewardRisk, ratio)} (planned ${shown(figures.plannedRewardRisk, ratio)})`}</dd>
            <dt>Slippage</dt>
            <dd className="number">{shown(figures.slippage, money)}</dd>
          </dl>
        </section>
      )}
      {created.map((d) => (
        <p key={d.occurrenceId}>
          {`Entry Size Deviation: ${d.version.quantityAbovePlan} shares above plan, caused by ${
            d.version.causingPositionChangeId === savedId ? 'this Position Change' : `the Position Change at ${timeOf(d.version.causingPositionChangeId)}`
          }.`}
        </p>
      ))}
      {receipt.entryChanges.map((change) => (
        <p key={change.kind}>
          {change.kind === 'EntryResolutionMoved'
            ? `This entry moved the Entry Resolution Point to the Position Change at ${timeOf(change.to)}.`
            : 'This entry changed Entry Quality.'}
        </p>
      ))}
      {receipt.repairs.length > 0 && (
        <section aria-labelledby="repairs-heading">
          <h2 id="repairs-heading">Repaired while saving</h2>
          <ul>
            {receipt.repairs.map((finding, index) => (
              <li key={index}>{repairText(finding)}</li>
            ))}
          </ul>
        </section>
      )}
      <p>
        {reflection.kind === 'Entry'
          ? 'Reflection saved.'
          : `Reflection declined${reflection.decline.reason ? `: ${reflection.decline.reason}` : '.'}`}
      </p>
      <Link to={`/trades/${receipt.tradeId}`}>Back to the Trade</Link>
    </section>
  );
}
