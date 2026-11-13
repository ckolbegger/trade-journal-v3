import type { DueClassification } from '../../domain/journal-debt/index.ts';
import type { NarrativeDebt, NarrativeItem } from '../../modules/journal/index.ts';
import type { WorkspaceSnapshotBinding } from '../../persistence/index.ts';

// What every Trade Views read shares, apart from the reads' own views: `trade-views.ts` re-exports it, and `replay-view.ts` reads it
// without importing `trade-views.ts`, which imports the replay.

// The revisions one coherent view represents.
export interface ViewBinding {
  readonly workspace: WorkspaceSnapshotBinding;
  readonly catalogRevision: number;
  readonly journalRevision: number;
  // The Mark evidence a current evaluation read, bound with the Workspace content revision it was read in.
  readonly marketDataSnapshotId?: string;
}

export type ReadViewResult<T> =
  | { readonly kind: 'Ready'; readonly view: T; readonly binding: ViewBinding }
  // A commit kept racing the assembly; nothing incoherent is returned.
  | { readonly kind: 'ChangedDuringAssembly' }
  | { readonly kind: 'NotFound' }
  | { readonly kind: 'Rejected'; readonly reason: 'CursorExpired' };

// An Outstanding Debt in the narrative: "Reflection owed" beside its Position Change, with its snapshot
// revision (the NarrativeDebt revision and definition). Without a due status outside session-policy
// coverage, where there is no Expected Mark Date (decision 56).
export interface TradeDetailDebt extends NarrativeDebt {
  readonly dueStatus?: DueClassification;
}

export type TradeDetailNarrativeItem = NarrativeItem | TradeDetailDebt;
