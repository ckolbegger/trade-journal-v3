import { useEffect, useRef } from 'react';
import { PageTitle } from '../PageTitle.tsx';
import { WithSecondLine } from '../SecondLine.tsx';
import { Link } from 'react-router';
import type { IntegrityFinding, PositionChangeResult } from '../../app/types.ts';
import { decimalMoney as price, localTime, money, ratio, rMultiple } from '../format.ts';

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
  // The receipt replaces the form in place, so focus moves to its heading when it appears.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
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
  // An earlier-dated entry can change or end an existing occurrence (P5); Retain says nothing.
  const recorded = postCommit.trade.recordedDeviations ?? [];
  const deviationChanges = receipt.deviationReconciliation.flatMap((d) => {
    if (d.action === 'NewVersion') {
      const was = recorded.find((r) => r.occurrenceId === d.occurrenceId)?.versions.at(-2);
      return [
        {
          key: d.occurrenceId,
          text: `Entry Size Deviation changed: now ${d.version.quantityAbovePlan} shares above plan${was ? ` (was ${was.quantityAbovePlan})` : ''}, caused by ${
            d.version.causingPositionChangeId === savedId ? 'this Position Change' : `the Position Change at ${timeOf(d.version.causingPositionChangeId)}`
          }.`,
        },
      ];
    }
    return d.action === 'Supersede' ? [{ key: d.occurrenceId, text: 'Entry Size Deviation no longer applies.' }] : [];
  });
  const reflection = postCommit.reflection;

  return (
    <section className="card" aria-labelledby="receipt-heading">
      <PageTitle id="receipt-heading" ref={headingRef} tabIndex={-1}>
        Entry recorded
      </PageTitle>
      <section aria-labelledby="saved-change-heading">
        <h2 id="saved-change-heading">
          Position Change at <span className="nowrap">{localTime(saved.economicTime, timeZone)}</span>
        </h2>
        <ul className="executions">
          {saved.executions.map((e) => (
            <li key={e.factId} className="execution-line">
              <span className="execution-what">{`${e.action} ${e.quantity} ${e.instrument.symbol}`}</span>{' '}
              <span className="execution-price number">{`@ ${price(e.price)}`}</span>,{' '}
              <span className="nowrap number">{`fee ${price(e.fee)}`}</span>
            </li>
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
            <dd className="number"><WithSecondLine amount={shown(figures.actualInitialRisk, money)} second={shown(figures.riskInPlanR, rMultiple)} /></dd>
            <dt>Actual initial reward</dt>
            <dd className="number">{shown(figures.actualInitialReward, money)}</dd>
            <dt>Reward : risk</dt>
            <dd className="number"><WithSecondLine amount={shown(figures.actualRewardRisk, ratio)} second={`planned ${shown(figures.plannedRewardRisk, ratio)}`} /></dd>
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
      {deviationChanges.map((c) => (
        <p key={c.key}>{c.text}</p>
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
      <Link className="pill primary" to={`/trades/${receipt.tradeId}`}>Back to the Trade</Link>
    </section>
  );
}
