import { useEffect, useRef, useState } from 'react';
import type {
  BackupProgress,
  CompletedBackupReceipt,
  ConfirmBackupResult,
  ExportBackupResult,
  FileSelectionPort,
  RestoreToken,
  SafetyChoice,
} from '../../app/types.ts';
import { completionTime, NOT_MADE, NOT_VERIFIED, records, type NotMadeReason, type NotVerifiedReason } from './backup-text.ts';
import type { BackupFacade } from './facade.ts';

type Downloaded = Extract<ExportBackupResult, { kind: 'Downloaded' }>;

interface SafetyBackupProps {
  readonly facade: BackupFacade;
  readonly selectFile: FileSelectionPort;
  readonly token: RestoreToken;
  readonly timeZone: string;
  readonly receipt: CompletedBackupReceipt | undefined;
  readonly onReceipt: (receipt: CompletedBackupReceipt | undefined) => void;
  readonly onRecheck: () => void;
}

// Back up this journal first: the backup page's download and verify steps, inline, with the
// Restore token's target as the expected binding (A142).
function SafetyBackup({ facade, selectFile, token, timeZone, receipt, onReceipt, onRecheck }: SafetyBackupProps) {
  const [downloaded, setDownloaded] = useState<Downloaded | undefined>();
  const [making, setMaking] = useState<BackupProgress | 'Starting' | undefined>();
  const [notMade, setNotMade] = useState<NotMadeReason | undefined>();
  const [changed, setChanged] = useState(false);
  const [checking, setChecking] = useState<BackupProgress | 'Starting' | undefined>();
  const [notVerified, setNotVerified] = useState<NotVerifiedReason | undefined>();
  // Counts downloads, so a check that finishes after a newer download is dropped.
  const downloadCount = useRef(0);
  // Leaving the choice unmounts this component; a check still pending then counts as superseded.
  useEffect(() => {
    const count = downloadCount;
    return () => {
      count.current += 1;
    };
  }, []);

  const download = async () => {
    // A target with no Workspace has no user data, so no safety choice reaches this point.
    if (token.targetBinding === 'NoWorkspace') return;
    downloadCount.current += 1;
    setMaking('Starting');
    setNotMade(undefined);
    setChanged(false);
    setDownloaded(undefined);
    setNotVerified(undefined);
    setChecking(undefined);
    onReceipt(undefined);
    const result = await facade.exportBackup({ expectedBinding: token.targetBinding, onProgress: setMaking }).catch((): ExportBackupResult => ({ kind: 'NotCompleted', stage: 'Read', reason: 'ReadFailed', workspaceBinding: null }));
    setMaking(undefined);
    if (result.kind === 'Downloaded') setDownloaded(result);
    else if (result.kind === 'Conflict') setChanged(true);
    else setNotMade(result.reason);
  };

  const verify = async (expected: Downloaded) => {
    const forDownload = downloadCount.current;
    const chosen = await selectFile.choose();
    if (chosen.kind === 'Cancelled' || forDownload !== downloadCount.current) return;
    setChecking('Starting');
    setNotVerified(undefined);
    const result = await facade
      .confirmBackup({ file: chosen.file, expectedBinding: expected.sourceBinding, expectedFullDigest: expected.fullDigest, onProgress: (progress) => {
        if (forDownload === downloadCount.current) setChecking(progress);
      } })
      .catch((): ConfirmBackupResult => ({ kind: 'NotVerified', reason: 'Unreadable' }));
    if (forDownload !== downloadCount.current) return;
    setChecking(undefined);
    if (result.kind === 'Completed') onReceipt(result.receipt);
    else setNotVerified(result.reason);
  };

  return (
    <div className="backup-result">
      {making !== undefined && <p role="status">{making === 'Starting' ? 'Making the backup' : `Making the backup: ${records(making)}`}</p>}
      {notMade && (
        <p role="alert">
          The backup could not be made. {NOT_MADE[notMade]} Nothing was changed.
        </p>
      )}
      {changed && (
        <div role="alert">
          <p>Your journal changed after the backup was checked.</p>
          <button type="button" className="pill secondary" onClick={onRecheck}>
            Check the backup again
          </button>
        </div>
      )}
      {!changed && (
        <button type="button" className="pill secondary" disabled={making !== undefined} onClick={() => void download()}>
          {notMade ? 'Retry' : 'Download backup'}
        </button>
      )}
      {downloaded && (
        <div>
          {receipt === undefined && <p>Downloaded, not verified yet. This app can't see where your browser saved the file.</p>}
          <p className="backup-file-name">{downloaded.fileName}</p>
          {checking !== undefined && <p role="status">{checking === 'Starting' ? 'Checking the file' : `Checking the file: ${records(checking)}`}</p>}
          {receipt && <p role="status">Backup complete. Checked {completionTime(receipt.completedAt, timeZone)}.</p>}
          {notVerified && <p role="alert">{NOT_VERIFIED[notVerified]}</p>}
          <button type="button" className="pill secondary" disabled={checking !== undefined} onClick={() => void verify(downloaded)}>
            {notVerified ? 'Choose another file' : 'Verify backup'}
          </button>
        </div>
      )}
    </div>
  );
}

export interface RestoreConfirmProps {
  readonly facade: BackupFacade;
  readonly selectFile: FileSelectionPort;
  readonly token: RestoreToken;
  readonly safetyChoiceRequired: boolean;
  readonly timeZone: string;
  readonly busy: boolean;
  readonly onReplace: (safety: SafetyChoice | undefined) => void;
  readonly onRecheck: () => void;
}

type Choice = 'BackUpFirst' | 'WithoutBackup';

// The safety choice once it is complete, else undefined. Only the chosen option's own proof counts: a receipt kept from
// Back up first is ignored under Replace without a backup, and an acknowledgment is ignored under Back up first.
function completedSafetyChoice(choice: Choice | undefined, receipt: CompletedBackupReceipt | undefined, declineAcknowledged: boolean): SafetyChoice | undefined {
  if (choice === 'BackUpFirst' && receipt) return { kind: 'Receipt', receipt };
  if (choice === 'WithoutBackup' && declineAcknowledged) return { kind: 'DeclinedAfterWarning' };
  return undefined;
}

// The confirmation step: the replacement checkbox, the safety choice when user data exists (P33), and Replace (A142).
export function RestoreConfirm({ facade, selectFile, token, safetyChoiceRequired, timeZone, busy, onReplace, onRecheck }: RestoreConfirmProps) {
  const [understood, setUnderstood] = useState(false);
  const [choice, setChoice] = useState<Choice | undefined>();
  const [receipt, setReceipt] = useState<CompletedBackupReceipt | undefined>();
  const [declineAcknowledged, setDeclineAcknowledged] = useState(false);

  const safety = completedSafetyChoice(choice, receipt, declineAcknowledged);
  const ready = understood && !busy && (!safetyChoiceRequired || safety !== undefined);

  return (
    <div className="restore-confirm">
      <label>
        <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} /> I understand this replaces my entire current journal
      </label>
      {safetyChoiceRequired && (
        <div role="radiogroup" aria-label="Safety backup">
          <label>
            <input type="radio" name="safety" checked={choice === 'BackUpFirst'} onChange={() => setChoice('BackUpFirst')} /> Back up this journal first (recommended)
          </label>
          {choice === 'BackUpFirst' && <SafetyBackup facade={facade} selectFile={selectFile} token={token} timeZone={timeZone} receipt={receipt} onReceipt={setReceipt} onRecheck={onRecheck} />}
          <label>
            <input type="radio" name="safety" checked={choice === 'WithoutBackup'} onChange={() => setChoice('WithoutBackup')} /> Replace without a backup
          </label>
          {choice === 'WithoutBackup' && (
            <label className="restore-decline">
              <input type="checkbox" checked={declineAcknowledged} onChange={(event) => setDeclineAcknowledged(event.target.checked)} />
              <span>If this backup is wrong or incomplete, your current journal cannot be recovered.</span>
            </label>
          )}
        </div>
      )}
      <button type="button" className="pill primary" disabled={!ready} onClick={() => onReplace(safety)}>
        Replace entire journal
      </button>
    </div>
  );
}
