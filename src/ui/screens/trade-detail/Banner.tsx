import type { IncoherentTradeDetail, IntegrityFinding, OpenTradeDetail } from '../../../app/types.ts';
import { findingWords, text } from '../../calculation-words.ts';
import { FACTS_INCOHERENT_LABEL } from '../../figures.ts';
import { localTime, quantity } from '../../format.ts';
import { contractCount } from '../option-words.ts';
import { changeTime, INCOHERENT_ENTRY_NOTE } from './words.ts';

// Where stored records disagree with what the recorded facts imply (AC-LIFE-003): each stored value
// beside the expected one. A read surfaces the disagreement and never repairs it.
export function IntegrityPanel({ view, timeZone }: { readonly view: OpenTradeDetail; readonly timeZone: string }) {
  const timeOf = (positionChangeId: string) => changeTime(view, positionChangeId, timeZone);
  const recordedVersion = (occurrenceId: string) => view.deviations.find((d) => d.occurrenceId === occurrenceId)?.versions.at(-1);
  // A Shortfall's fingerprint has no cause, so its time is its own causing Position Change's, or
  // its Economic Time when that change is not among the recorded ones.
  const shortfallTime = (cause: { readonly causingPositionChangeId: string; readonly economicTime: string } | undefined) =>
    localTime(view.positionChanges.find((c) => c.factId === cause?.causingPositionChangeId)?.economicTime ?? cause?.economicTime ?? '', timeZone);
  const row = (finding: IntegrityFinding): readonly [string, string, string] => {
    if (finding.kind === 'LifecycleDisagreement') return ['Lifecycle', finding.stored, finding.expected];
    const shortfall = finding.fingerprint.form === 'Shortfall';
    const stored = finding.kind === 'DeviationMissing' ? finding.expected : recordedVersion(finding.occurrenceId);
    const at = shortfall ? shortfallTime(stored) : timeOf(finding.fingerprint.positionChangeId ?? '');
    const record = `Entry Size Deviation, Position Change at ${at}`;
    const optionLeg = view.plan.legs[0]?.instrument.kind === 'Option';
    const shares = (amount: string) => `${optionLeg ? contractCount(amount) : `${amount} shares`}${shortfall ? ' below plan' : ''}`;
    switch (finding.kind) {
      case 'DeviationMissing':
        return [record, 'None', shares(quantity(finding.expected.quantityAbovePlan ?? finding.expected.quantityBelowPlan))];
      case 'DeviationQuantityDisagreement':
        return [record, shares(quantity(finding.recorded)), shares(quantity(finding.expected))];
      case 'DeviationUnexpected': {
        const version = recordedVersion(finding.occurrenceId);
        return [record, shares(version?.quantityAbovePlan ?? version?.quantityBelowPlan ?? ''), 'None'];
      }
    }
  };
  return (
    <section className="card integrity" aria-labelledby="integrity-heading">
      <h2 id="integrity-heading">Records disagree</h2>
      <p>Viewing this Trade does not change its records.</p>
      <div className="table-scroll" role="region" aria-label="Stored versus expected" tabIndex={0}>
        <table className="trades">
          <caption>Stored versus expected</caption>
          <thead>
            <tr>
              <th scope="col">Record</th>
              <th scope="col">Stored</th>
              <th scope="col">Expected</th>
            </tr>
          </thead>
          <tbody>
            {view.findings.map((finding, index) => (
              <tr key={index}>
                {row(finding).map((cell, column) => (
                  <td key={column}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Recorded facts that cannot be replayed (AC-LIFE-003): each finding in its own sentence. Nothing is
// derived from them, so no Position, entry, or fulfillment figure is shown.
export function IncoherentPanel({ view, timeZone }: { readonly view: IncoherentTradeDetail; readonly timeZone: string }) {
  return (
    <section className="card integrity" aria-labelledby="integrity-heading">
      <h2 id="integrity-heading">{FACTS_INCOHERENT_LABEL}</h2>
      <p>Viewing this Trade does not change its records.</p>
      <p>These recorded facts cannot be replayed, so the Position, entry, and fulfillment figures are unavailable.</p>
      <p>{INCOHERENT_ENTRY_NOTE}</p>
      <div className="table-scroll" role="region" aria-label="Facts that cannot be replayed" tabIndex={0}>
        <table className="trades">
          <caption>Facts that cannot be replayed</caption>
          <thead>
            <tr>
              <th scope="col">Finding</th>
            </tr>
          </thead>
          <tbody>
            {view.findings.map((finding, index) => (
              <tr key={index}>
                <td>{text(findingWords(finding, timeZone))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
