import { Temporal } from 'temporal-polyfill';
import type { Instant } from '../time/index.ts';

// The only due rule: a Debt is owed one Review session after it falls due (D5 A63).
export type DueRule = 'OneSessionGrace';

export type DueClassification = 'Due' | 'DueInNextReview' | 'DueInReviewAfterNext';

export type SessionCloses = { previousClose: Instant; close: Instant };

function atOrBefore(a: Instant, b: Instant): boolean {
  return Temporal.Instant.compare(Temporal.Instant.from(a), Temporal.Instant.from(b)) <= 0;
}

// A Trade outside the walk in the Review's owed-reflection group (A89): whether any of its Outstanding reflections is due in this Review,
// and its oldest owed anchor.
export interface OwedStanding {
  readonly tradeId: string;
  readonly hasDue: boolean;
  readonly oldestAnchor: Instant;
}

export function owedStandingOf(tradeId: string, dueAnchors: readonly Instant[], closes: SessionCloses): OwedStanding {
  const oldest = dueAnchors.reduce((a, b) => (atOrBefore(a, b) ? a : b));
  return { tradeId, hasDue: dueAnchors.some((anchor) => classifyDue(anchor, closes) === 'Due'), oldestAnchor: oldest };
}

// Due anchors compared as instants, not as text: the Journal's index orders their text, which differs for anchors written
// with a fraction of a second or an offset.
export function compareDueAnchors(a: Instant, b: Instant): number {
  return Temporal.Instant.compare(Temporal.Instant.from(a), Temporal.Instant.from(b));
}

// The group's order: Trades with a due reflection first, then by oldest owed anchor, then Trade identity (P20, A89).
export function compareOwed(a: OwedStanding, b: OwedStanding): number {
  if (a.hasDue !== b.hasDue) return a.hasDue ? -1 : 1;
  const anchors = compareDueAnchors(a.oldestAnchor, b.oldestAnchor);
  if (anchors !== 0) return anchors;
  if (a.tradeId === b.tradeId) return 0;
  return a.tradeId < b.tradeId ? -1 : 1;
}

export function classifyDue(dueAnchor: Instant, closes: SessionCloses): DueClassification;
export function classifyDue(dueAnchor: Instant, closes: SessionCloses | undefined): DueClassification | undefined;
export function classifyDue(dueAnchor: Instant, closes: SessionCloses | undefined): DueClassification | undefined {
  if (closes === undefined) return undefined;
  if (atOrBefore(dueAnchor, closes.previousClose)) return 'Due';
  if (atOrBefore(dueAnchor, closes.close)) return 'DueInNextReview';
  return 'DueInReviewAfterNext';
}
