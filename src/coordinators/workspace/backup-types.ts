// The frozen shapes of Workspace backup and Restore (D8 T8.23, A129-A138, A148). Types only: the
// operations behind them are filled in by the backup and Restore tasks (backup.ts, restore.ts).
import type { ReadinessEvaluation } from '../../delivery/readiness.ts';
import type { RuntimeNotWritable } from '../../delivery/runtime-not-writable.ts';
import type { WorkspaceSnapshotBinding } from '../../persistence/index.ts';

// A Workspace binding, or the absence of any Workspace (a Restore into an empty browser).
export type TargetBinding = WorkspaceSnapshotBinding | 'NoWorkspace';

// Records done of the counted total, reported by export, verification and preparation (A148).
export interface BackupProgress {
  readonly done: number;
  readonly total: number;
}
export type ProgressCallback = (progress: BackupProgress) => void;

// Per-record-kind counts, as the Restore preview shows them beside each other (A133).
export interface RestoreCounts {
  readonly tradesByLifecycle: Readonly<Record<'Planned' | 'Open' | 'Closed', number>>;
  readonly positionChanges: number;
  readonly executions: number;
  readonly expirations: number;
  readonly deviationOccurrences: number;
  readonly entriesByType: Readonly<Record<string, number>>;
  readonly declines: number;
  readonly debtsByStatus: Readonly<Record<string, number>>;
  readonly marks: number;
  readonly acknowledgments: number;
  readonly institutions: number;
  readonly accounts: number;
  readonly strategies: number;
  readonly closeReasons: number;
  readonly entryDefinitionRevisions: number;
  // Version counts for the kinds that keep history, keyed by kind name.
  readonly versions: Readonly<Record<string, number>>;
}

// The technical detail of a failure, for the developer log only (D8 Q5). Never journal contents:
// `context` holds ids, a section, a line, a store or a code.
export interface FailureDetail {
  // The step that failed, for example 'Read', 'Build', 'Offer', 'Verify', 'Prepare', 'Apply'.
  readonly stage: string;
  // The error's name, or the result kind that signalled the failure.
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly context?: Readonly<Record<string, string | number>>;
}

// ---- Export (A129) ----

export interface ExportBackupRequest {
  // When supplied and different from the live binding, the export returns Conflict.
  readonly expectedBinding?: WorkspaceSnapshotBinding;
  readonly onProgress?: ProgressCallback;
}

export type ExportBackupResult =
  | {
      readonly kind: 'Downloaded';
      readonly sourceBinding: WorkspaceSnapshotBinding;
      readonly fullDigest: string;
      readonly manifestDigest: string;
      readonly fileName: string;
      // Records per authoritative store.
      readonly counts: Readonly<Record<string, number>>;
      readonly byteSize: number;
    }
  | { readonly kind: 'Conflict'; readonly currentBinding: WorkspaceSnapshotBinding }
  | {
      readonly kind: 'NotCompleted';
      readonly stage: 'Read' | 'Offer';
      // IntegrityBlocked: the root is unreadable and nothing was read.
      readonly reason: 'IntegrityBlocked' | 'ReadFailed' | 'OfferFailed';
      // The binding showing the Workspace unchanged; null when no Workspace could be read.
      readonly workspaceBinding: WorkspaceSnapshotBinding | null;
      readonly detail?: FailureDetail;
    };

// ---- Verification (A130) ----

export interface ConfirmBackupRequest {
  readonly file: File;
  // From the Downloaded result the page holds in view state.
  readonly expectedBinding: WorkspaceSnapshotBinding;
  readonly expectedFullDigest: string;
  readonly onProgress?: ProgressCallback;
}

export interface CompletedBackupReceipt {
  // Identity the Workspace remembers for this application instance only (A131).
  readonly receiptId: string;
  readonly sourceBinding: WorkspaceSnapshotBinding;
  readonly fullDigest: string;
  readonly manifestDigest: string;
  readonly evidence: {
    readonly fileName: string;
    readonly byteSize: number;
    readonly compressed: boolean;
    readonly lineCount: number;
  };
  readonly completedAt: string;
}

export type ConfirmBackupResult =
  | { readonly kind: 'Completed'; readonly receipt: CompletedBackupReceipt }
  | { readonly kind: 'NotVerified'; readonly reason: 'Unreadable' | 'IncompleteOrCorrupt' | 'DifferentArtifact'; readonly detail?: FailureDetail };

// ---- Restore preparation (A132-A134, A138) ----

export interface PrepareRestoreRequest {
  readonly file: File;
  readonly onProgress?: ProgressCallback;
  // Aborting it cancels the preparation and deletes its candidate (A138, A148).
  readonly signal?: AbortSignal;
}

// The nondurable token a preparation returns: it binds the candidate, the artifact and the live target.
export interface RestoreToken {
  readonly candidateId: string;
  readonly fullDigest: string;
  readonly targetBinding: TargetBinding;
  readonly releaseId: string;
}

export type RestoreWarning = 'TimeZoneDiffers' | 'OlderSchema' | 'AnotherTabHasUnsavedWork';

export interface RestoreRepair {
  readonly tradeId: string;
  readonly kind: string;
  readonly stored: string;
  readonly expected: string;
}

export interface RestoreMigrations {
  // Each schema step the artifact is converted through, for example { from: 5, to: 6 }.
  readonly steps: readonly { readonly from: number; readonly to: number }[];
  readonly seedAdditions: readonly string[];
}

export interface RestorePreview {
  readonly source: {
    readonly createdAt: string;
    readonly releaseId: string;
    readonly schemaVersion: number;
    readonly exportKind: 'Normal' | 'BlockedDatabase';
  };
  readonly counts: RestoreCounts;
  readonly migrations: RestoreMigrations;
  readonly repairs: readonly RestoreRepair[];
  // Empty until D11, and then the UI omits the section.
  readonly providerNeedsSetup: readonly string[];
  readonly target: {
    readonly hasUserData: boolean;
    // Null when there is no Workspace.
    readonly counts: RestoreCounts | null;
    readonly currentTimeZone: string | null;
    readonly restoredTimeZone: string;
  };
  readonly warnings: readonly RestoreWarning[];
  // True when the target has user data (A137), so a safety choice must come with the apply.
  readonly safetyChoiceRequired: boolean;
}

export type RestoreIssueCode =
  | 'UnsupportedFormat'
  | 'UnsupportedNewerSchema'
  | 'InsufficientCapacity'
  | 'MalformedRecord'
  | 'DigestMismatch'
  | 'IncompleteArtifact'
  | 'ManifestMismatch'
  | 'UnsupportedDataCapability'
  | 'CrossSectionReference'
  // A module validator's code, for example DuplicateIdentity, MissingReference, IncoherentFacts, PriceNegative.
  | (string & {});

export interface RestoreIssue {
  readonly code: RestoreIssueCode;
  // MalformedRecord: the artifact line and the path inside the record.
  readonly line?: number;
  readonly path?: string;
  // DigestMismatch: the section.
  readonly section?: string;
  // CrossSectionReference: the kind and identity of the dangling reference.
  readonly kind?: string;
  readonly identity?: string;
  // InsufficientCapacity: available and required bytes.
  readonly availableBytes?: number;
  readonly requiredBytes?: number;
}

export type PrepareRestoreResult =
  | RuntimeNotWritable
  | { readonly kind: 'Prepared'; readonly token: RestoreToken; readonly preview: RestorePreview }
  | {
      readonly kind: 'Rejected';
      // The first 200 issues in artifact order.
      readonly issues: readonly RestoreIssue[];
      readonly totalIssues: number;
      readonly liveBinding: TargetBinding;
    }
  | { readonly kind: 'Cancelled'; readonly liveBinding: TargetBinding };

// ---- Restore apply (A135, A136) ----

export interface ReplaceEntireWorkspace {
  readonly kind: 'ReplaceEntireWorkspace';
}

// The safety choice when the target has user data (P33): a verified receipt, or a decline after the warning.
export type SafetyChoice =
  | { readonly kind: 'Receipt'; readonly receipt: CompletedBackupReceipt }
  | { readonly kind: 'DeclinedAfterWarning' };

export interface ApplyPreparedRestoreRequest {
  readonly token: RestoreToken;
  // Absent: the result is ConfirmationRequired.
  readonly confirmation?: ReplaceEntireWorkspace;
  readonly safety?: SafetyChoice;
}

export interface RestoreReceipt {
  readonly artifactDigest: string;
  readonly replacedBinding: TargetBinding;
  readonly newBinding: WorkspaceSnapshotBinding;
  readonly counts: RestoreCounts;
  readonly migrations: RestoreMigrations;
  readonly repairs: readonly RestoreRepair[];
  readonly readiness: ReadinessEvaluation;
}

export interface RestoreLanding {
  readonly kind: 'RestoreComplete';
  readonly next: 'Trades' | 'InstitutionAndAccountOnboarding';
}

// Generic over the status so this file does not import workspace.ts (no cycles); Workspace and
// src/app/types.ts use it as ApplyPreparedRestoreResult, with S = WorkspaceStatus.
export type ApplyRestoreOutcome<S> =
  | RuntimeNotWritable
  | { readonly kind: 'Restored'; readonly receipt: RestoreReceipt; readonly status: S; readonly landing: RestoreLanding }
  // Each of the following leaves the pointer and live database unchanged and carries the live binding.
  | { readonly kind: 'ConfirmationRequired'; readonly liveBinding: TargetBinding }
  | { readonly kind: 'PreparationNotFound'; readonly liveBinding: TargetBinding }
  | { readonly kind: 'Conflict'; readonly reason: 'TargetChanged'; readonly liveBinding: TargetBinding }
  | { readonly kind: 'SafetyBackupRequired'; readonly liveBinding: TargetBinding }
  | { readonly kind: 'SafetyBackupNotRecognized'; readonly liveBinding: TargetBinding }
  | { readonly kind: 'SafetyBackupStale'; readonly liveBinding: TargetBinding }
  | { readonly kind: 'CandidateChanged'; readonly store: string; readonly liveBinding: TargetBinding }
  | { readonly kind: 'AlreadyInitialized'; readonly databaseName: string; readonly liveBinding: TargetBinding };

// What another tab hears over the BroadcastChannel after a Restore activates (A136).
export interface WorkspaceReplaced {
  readonly kind: 'WorkspaceReplaced';
  readonly databaseName: string;
}

// ---- Safe actions a status offers (T8.10 fills them) ----

export type BackupSafeAction = 'DownloadBackup' | 'VerifyBackup' | 'DownloadCopy' | 'RestoreFromBackup';
