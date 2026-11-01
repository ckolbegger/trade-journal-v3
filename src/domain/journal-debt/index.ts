import { Temporal } from 'temporal-polyfill';
import type { Instant } from '../time/index.ts';

// The only due rule: a Debt is owed one Review session after it falls due (D5 A63).
export type DueRule = 'OneSessionGrace';

export type DueClassification = 'Due' | 'DueInNextReview' | 'DueInReviewAfterNext';

export type SessionCloses = { previousClose: Instant; close: Instant };

function atOrBefore(a: Instant, b: Instant): boolean {
  return Temporal.Instant.compare(Temporal.Instant.from(a), Temporal.Instant.from(b)) <= 0;
}

export function classifyDue(dueAnchor: Instant, closes: SessionCloses): DueClassification;
export function classifyDue(dueAnchor: Instant, closes: SessionCloses | undefined): DueClassification | undefined;
export function classifyDue(dueAnchor: Instant, closes: SessionCloses | undefined): DueClassification | undefined {
  if (closes === undefined) return undefined;
  if (atOrBefore(dueAnchor, closes.previousClose)) return 'Due';
  if (atOrBefore(dueAnchor, closes.close)) return 'DueInNextReview';
  return 'DueInReviewAfterNext';
}
