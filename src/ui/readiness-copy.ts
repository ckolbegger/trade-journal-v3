import type { MigrationIssue } from '../app/types.ts';
import type { ReadinessFailure } from '../delivery/runtime-not-writable.ts';

// Plain-language explanations of each Runtime Readiness check that failed.
const CHECKS: Record<ReadinessFailure['check'], string> = {
  diagnostic: 'This browser could not complete a test save and read-back of its storage.',
  capacity: 'There is not enough storage space available in this browser for your journal and its safety margin.',
  control: "The app's offline component is not in control of this page yet.",
  inventory: "The app's offline copy is missing or damaged, so it could not reopen without a network.",
};

export function explainFailure(failure: ReadinessFailure): string {
  if (failure.reason === 'ExistingRootUnreadable') return 'Existing journal storage in this browser could not be read.';
  if (failure.reason === 'SessionSuperseded') return 'This tab was updated in another tab.';
  return CHECKS[failure.check];
}

// Plain-language reasons a converted journal failed validation (D2 P6).
const MIGRATION_ISSUES: Record<MigrationIssue['code'], string> = {
  DuplicateIdentity: 'Two Institution or Account records share one identity.',
  MissingParent: 'An Account names an Institution that does not exist.',
  UnknownSeedKey: 'A default record names a product this release does not know.',
  MissingDefinitionRevision: 'A Journal Entry names a form revision that does not exist.',
  DuplicateObligationOutcome: 'One reflection has more than one recorded outcome.',
  MissingAnchor: 'A reflection does not name the Trade it belongs to.',
  EditDefinitionChanged: 'An edited Journal Entry names a different form revision than its first version.',
  UnknownAccount: 'A Trade names an Account that does not exist.',
  DuplicateFactIdentity: 'A Trade records the same fact identity twice.',
  UnknownAnchorTrade: 'A reflection belongs to a Trade that does not exist.',
  IncoherentFacts: "A Trade's recorded facts cannot be replayed.",
  ActivationFailed: 'The final step that makes the converted copy your journal could not be saved.',
};

export function explainMigrationIssue(issue: MigrationIssue): string {
  return MIGRATION_ISSUES[issue.code];
}
