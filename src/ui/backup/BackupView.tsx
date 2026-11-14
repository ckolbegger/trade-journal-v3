import { useRef, useState } from 'react';
import type { BackupProgress, ConfirmBackupResult, ExportBackupResult, FileSelectionPort } from '../../app/types.ts';
import type { ReadinessFailure } from '../../delivery/runtime-not-writable.ts';
import { PageTitle } from '../PageTitle.tsx';
import { explainFailure } from '../readiness-copy.ts';
import { completionTime, NOT_MADE, NOT_VERIFIED, records, type NotMadeReason, type NotVerifiedReason } from './backup-text.ts';
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

// The Backup page: Download backup and Verify backup (D8 A141). The Downloaded result lives only
// in this component's state, so leaving the page forgets it (ADR 0010).
export function BackupView({ facade, selectFile, readiness, timeZone }: BackupViewProps) {
  const [downloaded, setDownloaded] = useState<Downloaded | undefined>();
  const [checking, setChecking] = useState<BackupProgress | 'Starting' | undefined>();
  const [outcome, setOutcome] = useState<{ readonly kind: 'Completed'; readonly at: string } | { readonly kind: 'NotVerified'; readonly reason: NotVerifiedReason } | undefined>();
  const [making, setMaking] = useState<BackupProgress | 'Starting' | undefined>();
  const [notMade, setNotMade] = useState<NotMadeReason | undefined>();

  // Counts downloads, so a check that finishes after a newer download can be told apart and dropped.
  const downloadCount = useRef(0);

  const download = async () => {
    downloadCount.current += 1;
    const thisDownload = downloadCount.current;
    setMaking('Starting');
    setNotMade(undefined);
    setDownloaded(undefined);
    setOutcome(undefined);
    setChecking(undefined);
    // A refused, conflicting or throwing export left the Workspace as it was: say it was not made.
    const result = await facade
      .exportBackup({ onProgress: (progress) => {
        if (thisDownload === downloadCount.current) setMaking(progress);
      } })
      .catch((): ExportBackupResult => ({ kind: 'NotCompleted', stage: 'Read', reason: 'ReadFailed', workspaceBinding: null }));
    // A Restore completed meanwhile: this export was of the replaced Workspace, so drop it.
    if (thisDownload !== downloadCount.current) return;
    setMaking(undefined);
    if (result.kind === 'Downloaded') setDownloaded(result);
    else setNotMade(result.kind === 'NotCompleted' ? result.reason : 'Conflict');
  };

  // A completed Restore replaces the Workspace, so a download or check of the old one is discarded (A142).
  // Bumping the count also drops a check still in flight.
  const restoreFacade: BackupFacade = {
    ...facade,
    applyPreparedRestore: async (request) => {
      const result = await facade.applyPreparedRestore(request);
      if (result.kind === 'Restored') {
        downloadCount.current += 1;
        setDownloaded(undefined);
        setOutcome(undefined);
        setChecking(undefined);
        setMaking(undefined);
        setNotMade(undefined);
      }
      return result;
    },
  };

  const verify = async (expected: Downloaded) => {
    const forDownload = downloadCount.current;
    const chosen = await selectFile.choose();
    // A file chosen for an earlier download is not checked against this one.
    if (chosen.kind === 'Cancelled' || forDownload !== downloadCount.current) return;
    setChecking('Starting');
    setOutcome(undefined);
    // A file the check could not even read is the Unreadable case.
    const result = await facade
      .confirmBackup({ file: chosen.file, expectedBinding: expected.sourceBinding, expectedFullDigest: expected.fullDigest, onProgress: (progress) => {
        if (forDownload === downloadCount.current) setChecking(progress);
      } })
      .catch((): ConfirmBackupResult => ({ kind: 'NotVerified', reason: 'Unreadable' }));
    if (forDownload !== downloadCount.current) return;
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
        {notMade && (
          <p role="alert">
            The backup could not be made. {NOT_MADE[notMade]} Nothing was changed.
          </p>
        )}
        <button type="button" className="pill primary" disabled={making !== undefined} onClick={() => void download()}>
          {notMade ? 'Retry' : 'Download backup'}
        </button>
        {downloaded && (
          <div className="backup-result">
            {outcome?.kind !== 'Completed' && <p>Downloaded, not verified yet. This app can't see where your browser saved the file.</p>}
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
          <RestoreFlow facade={restoreFacade} selectFile={selectFile} />
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
