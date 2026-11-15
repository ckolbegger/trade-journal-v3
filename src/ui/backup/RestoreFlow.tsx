import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { ApplyPreparedRestoreResult, BackupProgress, FileSelectionPort, MigrationIssue, PrepareRestoreResult, RestoreCounts, RestoreIssue, RestoreLanding, RestorePreview, RestoreToken, SafetyChoice } from '../../app/types.ts';
import { useRuntime } from '../runtime.tsx';
import { explainFailure, explainMigrationIssue } from '../readiness-copy.ts';
import type { BackupFacade } from './facade.ts';
import { COULD_NOT_CHECK, RESTORE_UNFINISHED } from './backup-text.ts';
import { logFailure } from './dev-log.ts';
import { RestoreConfirm } from './RestoreConfirm.tsx';
import { CountsTable, PreviewContents } from './RestorePreview.tsx';

export interface RestoreFlowProps {
  readonly facade: BackupFacade;
  readonly selectFile: FileSelectionPort;
}

type Rejected = Extract<PrepareRestoreResult, { kind: 'Rejected' }>;

type Phase = { readonly kind: 'Choose' } | { readonly kind: 'Checking'; readonly progress: BackupProgress | undefined } | { readonly kind: 'CannotCheck'; readonly reason: string } | { readonly kind: 'Rejected'; readonly result: Rejected } | { readonly kind: 'Preview'; readonly token: RestoreToken; readonly preview: RestorePreview } | { readonly kind: 'NotReplaced'; readonly reason: string | undefined } | { readonly kind: 'Unfinished' } | { readonly kind: 'Restored'; readonly counts: RestoreCounts; readonly next: RestoreLanding['next'] };

// Why an apply left the journal as it was (Q2 A11).
function explainNotReplaced(result: Exclude<ApplyPreparedRestoreResult, { kind: 'Restored' }>): string | undefined {
  switch (result.kind) {
    case 'SafetyBackupStale':
      return 'Your safety backup is out of date: the journal changed after it was made.';
    case 'SafetyBackupNotRecognized':
      return "That safety backup wasn't made in this session. Back up again.";
    case 'Conflict':
      return 'Your journal changed after the backup was checked.';
    case 'CandidateChanged':
    case 'PreparationNotFound':
      return 'The checked backup is no longer available.';
    case 'AlreadyInitialized':
      return 'A journal was started in another tab meanwhile.';
    case 'RuntimeNotWritable':
      return result.failedChecks.map(explainFailure).join(' ');
    default:
      return undefined;
  }
}

const number = (n: number) => n.toLocaleString('en-US');

const megabytes = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

// One plain sentence per rejection issue (A134); a module validator's code reuses its startup-check sentence.
function explainIssue(issue: RestoreIssue): string {
  switch (issue.code) {
    case 'UnsupportedFormat':
      return "This file uses a backup format this app doesn't read.";
    case 'UnsupportedNewerSchema':
      return 'This backup was made by a newer version of the app.';
    case 'InsufficientCapacity':
      return `There isn't enough storage space: ${megabytes(issue.requiredBytes ?? 0)} needed, ${megabytes(issue.availableBytes ?? 0)} available.`;
    case 'MalformedRecord':
      return `Line ${number(issue.line ?? 0)} isn't a valid record (${issue.path ?? ''}).`;
    case 'DigestMismatch':
      return `The ${issue.section ?? ''} section doesn't match its checksum, so the file was changed or damaged.`;
    case 'IncompleteArtifact':
      return 'The file is incomplete.';
    case 'ManifestMismatch':
      return "The backup's summary doesn't match its contents.";
    case 'UnsupportedDataCapability':
      return `The backup holds data this version can't restore: ${issue.path ?? ''}.`;
    case 'CrossSectionReference':
      return `A record refers to ${/^[AEIOU]/i.test(issue.kind ?? '') ? 'an' : 'a'} ${issue.kind ?? ''} that isn't in the backup (${issue.identity ?? ''}).`;
    default:
      // A validator code with no sentence of its own (Q5 item 3).
      return explainMigrationIssue({ code: issue.code } as MigrationIssue) ?? `A record in the ${issue.section ?? ''} section didn't pass a check (${issue.code}).`;
  }
}

// The Restore flow: choose, preview, confirm, result (D8 A142). Built by T8.13; T8.23 freezes the props.
export function RestoreFlow({ facade, selectFile }: RestoreFlowProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'Choose' });
  const [applying, setApplying] = useState(false);
  const { report } = useRuntime();
  const abort = useRef<AbortController | undefined>(undefined);
  // Leaving the page cancels a preparation still running.
  useEffect(() => () => abort.current?.abort(), []);

  const check = async () => {
    const chosen = await selectFile.choose();
    if (chosen.kind === 'Cancelled') return;
    const controller = new AbortController();
    abort.current = controller;
    setPhase({ kind: 'Checking', progress: undefined });
    let result: PrepareRestoreResult;
    try {
      result = await facade.prepareRestore({ file: chosen.file, signal: controller.signal, onProgress: (progress) => setPhase({ kind: 'Checking', progress }) });
    } catch (error) {
      abort.current = undefined;
      const thrown = error instanceof Error ? error : new Error(String(error));
      logFailure({ stage: 'Prepare', name: thrown.name, message: thrown.message, ...(thrown.stack !== undefined && { stack: thrown.stack }) });
      setPhase({ kind: 'CannotCheck', reason: COULD_NOT_CHECK });
      return;
    }
    abort.current = undefined;
    if (result.kind === 'Rejected' && result.issues.length === 0 && result.detail) {
      // An unexpected failure inside the preparation: no issue to list (Q5 item 4).
      logFailure(result.detail);
      setPhase({ kind: 'CannotCheck', reason: COULD_NOT_CHECK });
    } else if (result.kind === 'Rejected') {
      // Never the values: only the count and the first issue's code and location.
      const first = result.issues[0];
      logFailure({
        stage: 'Prepare',
        name: 'Rejected',
        message: 'The backup was rejected.',
        context: { issueCount: result.totalIssues, ...(first && { code: first.code }), ...(first?.section !== undefined && { section: first.section }), ...(first?.line !== undefined && { line: first.line }), ...(first?.path !== undefined && { path: first.path }) },
      });
      setPhase({ kind: 'Rejected', result });
    }
    else if (result.kind === 'Prepared') setPhase({ kind: 'Preview', token: result.token, preview: result.preview });
    else if (result.kind === 'RuntimeNotWritable') {
      logFailure({ stage: 'Prepare', name: 'RuntimeNotWritable', message: 'The journal is not writable.', context: { failedChecks: result.failedChecks.map((failure) => `${failure.check}:${failure.reason}`).join(',') } });
      setPhase({ kind: 'CannotCheck', reason: result.failedChecks.map(explainFailure).join(' ') });
    } else if (result.kind === 'Cancelled') setPhase({ kind: 'Choose' });
  };

  const replace = async (token: RestoreToken, safety: SafetyChoice | undefined) => {
    setApplying(true);
    let result: ApplyPreparedRestoreResult;
    try {
      result = await facade.applyPreparedRestore({ token, confirmation: { kind: 'ReplaceEntireWorkspace' }, ...(safety && { safety }) });
    } catch (error) {
      const thrown = error instanceof Error ? error : new Error(String(error));
      logFailure({ stage: 'Apply', name: thrown.name, message: thrown.message, ...(thrown.stack !== undefined && { stack: thrown.stack }) });
      // Which journal is in use is unknown until the app reloads, so no "unchanged" claim is made.
      setApplying(false);
      setPhase({ kind: 'Unfinished' });
      return;
    }
    setApplying(false);
    // The summary comes from the result alone; no read follows, and the preview and its forms are dropped.
    // The shell learns the readiness found after the Restore now, not only when the trader leaves the summary.
    if (result.kind === 'Restored') report(result);
    setPhase(result.kind === 'Restored' ? { kind: 'Restored', counts: result.receipt.counts, next: result.landing.next } : { kind: 'NotReplaced', reason: explainNotReplaced(result) });
  };

  return (
    <div className="restore">
      {phase.kind === 'Choose' && (
        <button type="button" className="pill secondary" onClick={() => void check()}>
          Choose backup file
        </button>
      )}
      {phase.kind === 'Checking' && (
        <div>
          <p role="status">Checking the backup. Your current journal is not changed.</p>
          {phase.progress && <p role="status">Checking the backup: {`${number(phase.progress.done)} of ${number(phase.progress.total)} records`}</p>}
          <button type="button" className="pill secondary" onClick={() => abort.current?.abort()}>
            Cancel
          </button>
        </div>
      )}
      {phase.kind === 'CannotCheck' && (
        <div role="alert">
          <p>{phase.reason}</p>
          <button type="button" className="pill secondary" onClick={() => void check()}>
            Choose backup file
          </button>
        </div>
      )}
      {phase.kind === 'Rejected' && (
        <div role="alert">
          <p>This backup can't be restored.</p>
          <p>Your current journal is unchanged.</p>
          {phase.result.totalIssues > phase.result.issues.length && <p>Showing the first {phase.result.issues.length} of {number(phase.result.totalIssues)} problems.</p>}
          <ul>
            {phase.result.issues.map((issue, index) => (
              <li key={index}>{explainIssue(issue)}</li>
            ))}
          </ul>
          <button type="button" className="pill secondary" onClick={() => void check()}>
            Check the backup again
          </button>
        </div>
      )}
      {phase.kind === 'Preview' && (
        <>
          <PreviewContents preview={phase.preview} />
          <RestoreConfirm
            facade={facade}
            selectFile={selectFile}
            token={phase.token}
            safetyChoiceRequired={phase.preview.safetyChoiceRequired}
            timeZone={phase.preview.target.currentTimeZone ?? phase.preview.target.restoredTimeZone}
            busy={applying}
            onReplace={(safety) => void replace(phase.token, safety)}
            onRecheck={() => void check()}
          />
        </>
      )}
      {phase.kind === 'Restored' && (
        <div>
          <h3>Restore complete</h3>
          <p>Your journal now holds the restored backup.</p>
          <CountsTable restored={phase.counts} current={null} />
          {phase.next === 'Trades' ? (
            // After a first-run Restore the summary and Trades are both at "/", so an in-app link changes no route and
            // the shell is never rebuilt on the restored journal; a fresh page load starts it on the restored data.
            <Link className="pill primary" to="/" reloadDocument>
              Go to Trades
            </Link>
          ) : (
            <Link className="pill primary" to="/accounts">
              Add an institution and account
            </Link>
          )}
        </div>
      )}
      {phase.kind === 'Unfinished' && (
        <div role="alert">
          <p>{RESTORE_UNFINISHED}</p>
          <button type="button" className="pill primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
      {phase.kind === 'NotReplaced' && (
        <div role="alert">
          {phase.reason && <p>{phase.reason}</p>}
          <p>Your current journal is unchanged.</p>
          <button type="button" className="pill secondary" onClick={() => void check()}>
            Check the backup again
          </button>
        </div>
      )}
    </div>
  );
}
