import { useState } from 'react';
import type { BackupProgress, ConfirmBackupResult, ExportBackupResult, FileSelectionPort } from '../../app/types.ts';
import type { ReadinessFailure } from '../../delivery/runtime-not-writable.ts';
import { PageTitle } from '../PageTitle.tsx';
import { explainFailure } from '../readiness-copy.ts';
import type { BackupFacade } from './facade.ts';
import { RestoreFlow } from './RestoreFlow.tsx';
import './backup.css';

export interface BackupViewProps {
  readonly facade: BackupFacade;
  readonly selectFile: FileSelectionPort;
  // Writable shows the Restore section; Recovery Only replaces it with the failed checks (A144).
  readonly readiness: { readonly kind: 'Writable' } | { readonly kind: 'RecoveryOnly'; readonly failedChecks: readonly ReadinessFailure[] };
  // The Workspace time zone, for the completion time (convention C4).
  readonly timeZone: string;
}

type Downloaded = Extract<ExportBackupResult, { kind: 'Downloaded' }>;

const records = (progress: BackupProgress) => `${progress.done.toLocaleString('en-US')} of ${progress.total.toLocaleString('en-US')} records`;

type NotVerifiedReason = Extract<ConfirmBackupResult, { kind: 'NotVerified' }>['reason'];

const NOT_VERIFIED: Record<NotVerifiedReason, string> = {
  Unreadable: "This file couldn't be read. Choose the file you just downloaded.",
  IncompleteOrCorrupt: "This file is incomplete or damaged, so it isn't a usable backup.",
  DifferentArtifact: 'This is a different backup from the one you just downloaded.',
};

// "Sat Nov 14, 16:05" in the Workspace zone (convention C4).
function completionTime(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('weekday')} ${part('month')} ${part('day')}, ${part('hour')}:${part('minute')}`;
}

// The Backup page: Download backup and Verify backup (D8 A141). The Downloaded result lives only
// in this component's state, so leaving the page forgets it (ADR 0010).
export function BackupView({ facade, selectFile, readiness, timeZone }: BackupViewProps) {
  const [downloaded, setDownloaded] = useState<Downloaded | undefined>();
  const [checking, setChecking] = useState<BackupProgress | 'Starting' | undefined>();
  const [outcome, setOutcome] = useState<{ readonly kind: 'Completed'; readonly at: string } | { readonly kind: 'NotVerified'; readonly reason: NotVerifiedReason } | undefined>();
  const [making, setMaking] = useState<BackupProgress | 'Starting' | undefined>();
  const [failedStage, setFailedStage] = useState<'Read' | 'Offer' | undefined>();

  const download = async () => {
    setMaking('Starting');
    setFailedStage(undefined);
    setDownloaded(undefined);
    // A refused, conflicting or throwing export left the Workspace as it was: say it was not made.
    const result = await facade.exportBackup({ onProgress: setMaking }).catch((): ExportBackupResult => ({ kind: 'NotCompleted', stage: 'Read', reason: 'ReadFailed', workspaceBinding: null }));
    setMaking(undefined);
    if (result.kind === 'Downloaded') setDownloaded(result);
    else setFailedStage(result.kind === 'NotCompleted' ? result.stage : 'Read');
  };

  const verify = async (expected: Downloaded) => {
    const chosen = await selectFile.choose();
    if (chosen.kind === 'Cancelled') return;
    setChecking('Starting');
    setOutcome(undefined);
    // A file the check could not even read is the Unreadable case.
    const result = await facade
      .confirmBackup({ file: chosen.file, expectedBinding: expected.sourceBinding, expectedFullDigest: expected.fullDigest, onProgress: setChecking })
      .catch((): ConfirmBackupResult => ({ kind: 'NotVerified', reason: 'Unreadable' }));
    setChecking(undefined);
    setOutcome(result.kind === 'Completed' ? { kind: 'Completed', at: result.receipt.completedAt } : result);
  };

  return (
    <article className="backup">
      <PageTitle>Backup</PageTitle>
      <section className="card" aria-labelledby="backup-download-heading">
        <h2 id="backup-download-heading">Download a backup</h2>
        <p>While a backup is being made, saving waits until it finishes.</p>
        {making !== undefined && <p role="status">{making === 'Starting' ? 'Making the backup' : `Making the backup: ${records(making)}`}</p>}
        {failedStage && (
          <p role="alert">
            The backup could not be made. {failedStage === 'Read' ? "Your journal couldn't be read." : "Your browser didn't accept the download."} Nothing was changed.
          </p>
        )}
        <button type="button" className="pill primary" disabled={making !== undefined} onClick={() => void download()}>
          {failedStage ? 'Retry' : 'Download backup'}
        </button>
        {downloaded && (
          <div className="backup-result">
            <p>Downloaded, not verified yet. This app can't see where your browser saved the file.</p>
            <p className="backup-file-name">{downloaded.fileName}</p>
            {checking !== undefined && <p role="status">{checking === 'Starting' ? 'Checking the file' : `Checking the file: ${records(checking)}`}</p>}
            {outcome?.kind === 'Completed' && <p role="status">Backup complete. Checked {completionTime(outcome.at, timeZone)}.</p>}
            {outcome?.kind === 'NotVerified' && <p role="alert">{NOT_VERIFIED[outcome.reason]}</p>}
            <button type="button" className="pill secondary" disabled={checking !== undefined} onClick={() => void verify(downloaded)}>
              {outcome?.kind === 'NotVerified' ? 'Choose another file' : 'Verify backup'}
            </button>
          </div>
        )}
      </section>
      {readiness.kind === 'Writable' ? (
        <section className="card" aria-labelledby="backup-restore-heading">
          <h2 id="backup-restore-heading">Restore from a backup</h2>
          <RestoreFlow facade={facade} selectFile={selectFile} />
        </section>
      ) : (
        <section className="card" aria-labelledby="backup-restore-heading">
          <h2 id="backup-restore-heading">Restore needs a browser that can save safely</h2>
          <ul className="backup-checks">
            {readiness.failedChecks.map((failure) => (
              <li key={failure.check}>{explainFailure(failure)}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
