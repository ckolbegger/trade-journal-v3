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
