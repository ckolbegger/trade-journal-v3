import type { RestoreCounts, RestoreMigrations, RestorePreview, RestoreRepair, RestoreWarning } from '../../app/types.ts';
import { ACKNOWLEDGED_UNAVAILABLE_COUNT_LABEL } from '../calculation-words.ts';
import { tradeName } from '../format.ts';
import { completionTime, entryTypeName } from './backup-text.ts';

const number = (n: number) => n.toLocaleString('en-US');

interface CountRow {
  readonly label: string;
  readonly value: (counts: RestoreCounts) => number;
  // The key of `counts.versions` for a kind that keeps history.
  readonly history?: string;
}

// The rows of the counts table in A5's order; entry types and debt statuses add rows from the data.
function countRows(restored: RestoreCounts, current: RestoreCounts | null): readonly CountRow[] {
  const keys = (pick: (c: RestoreCounts) => Readonly<Record<string, number>>) => [...new Set([...Object.keys(pick(restored)), ...Object.keys(current ? pick(current) : {})])];
  return [
    // The version count shows once per kind: here for Trades, on the Journal entries row for entries and on the Reflections owed row for debts.
    { label: 'Trades', value: (c) => c.tradesByLifecycle.Planned + c.tradesByLifecycle.Open + c.tradesByLifecycle.Closed, history: 'trades' },
    { label: 'Planned Trades', value: (c) => c.tradesByLifecycle.Planned },
    { label: 'Open Trades', value: (c) => c.tradesByLifecycle.Open },
    { label: 'Closed Trades', value: (c) => c.tradesByLifecycle.Closed },
    { label: 'Position Changes', value: (c) => c.positionChanges },
    { label: 'Executions', value: (c) => c.executions },
    { label: 'Expirations', value: (c) => c.expirations },
    { label: 'Deviations', value: (c) => c.deviationOccurrences },
    { label: 'Journal entries', value: (c) => Object.values(c.entriesByType).reduce((sum, n) => sum + n, 0), history: 'entries' },
    ...keys((c) => c.entriesByType).map((type) => ({ label: `Journal entries: ${entryTypeName(type)}`, value: (c: RestoreCounts) => c.entriesByType[type] ?? 0 })),
    { label: 'Declined reflections', value: (c) => c.declines },
    { label: 'Reflections owed', value: (c) => Object.values(c.debtsByStatus).reduce((sum, n) => sum + n, 0), history: 'debts' },
    ...keys((c) => c.debtsByStatus).map((status) => ({ label: `Reflections owed: ${status}`, value: (c: RestoreCounts) => c.debtsByStatus[status] ?? 0 })),
    { label: 'Marks', value: (c) => c.marks },
    { label: ACKNOWLEDGED_UNAVAILABLE_COUNT_LABEL, value: (c) => c.acknowledgments },
    { label: 'Institutions', value: (c) => c.institutions },
    { label: 'Accounts', value: (c) => c.accounts },
    { label: 'Strategies', value: (c) => c.strategies },
    { label: 'Close Reasons', value: (c) => c.closeReasons },
    { label: 'Journal question revisions', value: (c) => c.entryDefinitionRevisions },
  ];
}

function cell(row: CountRow, counts: RestoreCounts) {
  const versions = row.history === undefined ? undefined : counts.versions[row.history];
  return versions === undefined ? number(row.value(counts)) : `${number(row.value(counts))} (${number(versions)} ${versions === 1 ? 'version' : 'versions'})`;
}

export function CountsTable({ restored, current }: { readonly restored: RestoreCounts; readonly current: RestoreCounts | null }) {
  return (
    <table className="restore-counts">
      <thead>
        <tr>
          <td />
          <th scope="col">In the backup</th>
          {current && <th scope="col">In your current journal</th>}
        </tr>
      </thead>
      <tbody>
        {countRows(restored, current).map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>{cell(row, restored)}</td>
            {current && <td>{cell(row, current)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function repairSentence(repair: RestoreRepair): string {
  const trade = tradeName(repair.tradeSummary);
  if (repair.kind === 'EntrySizeDeviation') return `${trade}: Entry Size deviation missing. It will be added.`;
  return `${trade}: lifecycle recorded ${repair.stored}, facts say ${repair.expected}. It will be corrected.`;
}

function migrationSentences(migrations: RestoreMigrations): readonly string[] {
  return [...migrations.steps.map((step) => `Updated from schema ${step.from} to ${step.to}`), ...migrations.seedAdditions.map((seed) => `Added default: ${seed}`)];
}

function warningSentence(warning: RestoreWarning, preview: RestorePreview): string {
  switch (warning) {
    case 'TimeZoneDiffers':
      return `The backup's time zone (${preview.target.restoredTimeZone}) differs from this journal's (${preview.target.currentTimeZone ?? ''}). The restored journal uses the backup's.`;
    case 'OlderSchema':
      return "This backup was made by an earlier version and will be updated as it's restored.";
    case 'AnotherTabHasUnsavedWork':
      return 'Another tab has unsaved changes. They will be lost when the journal is replaced.';
  }
}

export function PreviewContents({ preview }: { readonly preview: RestorePreview }) {
  const { source } = preview;
  const migrations = migrationSentences(preview.migrations);
  return (
    <div className="restore-preview">
      <h3>Restoring replaces your entire current journal</h3>
      <p>
        {/* source.createdAt is already Workspace-local (no zone), so format its digits as they are. */}
        From a backup made {completionTime(`${source.createdAt}Z`, 'UTC')} (release {source.releaseId}, schema {source.schemaVersion})
        {source.exportKind === 'BlockedDatabase' ? ", a copy of a journal that couldn't be updated" : ''}
      </p>
      <CountsTable restored={preview.counts} current={preview.target.counts} />
      <ul className="restore-notes">
        {migrations.length === 0 ? <li>No updates needed.</li> : migrations.map((line) => <li key={line}>{line}</li>)}
        {preview.repairs.length === 0 ? <li>No repairs needed.</li> : preview.repairs.map((repair) => <li key={`${repair.tradeId}${repair.kind}`}>{repairSentence(repair)}</li>)}
      </ul>
      {preview.warnings.length > 0 && (
        <ul className="restore-warnings">
          {preview.warnings.map((warning) => (
            <li key={warning}>{warningSentence(warning, preview)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
