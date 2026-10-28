import type { Instant } from '../time/index.ts';

// An exchange date is an ISO calendar date such as "2026-10-12".
export type ExchangeDate = string;

export interface CoverageRange {
  readonly first: ExchangeDate;
  readonly last: ExchangeDate;
}

export interface TableSource {
  readonly name: string;
  readonly url: string;
}

// One explicit row of the table: a one-off closure or an early close, citing its NYSE source.
export interface TableRow {
  readonly date: ExchangeDate;
  readonly kind: 'Closure' | 'EarlyClose';
  readonly name: string;
  readonly source: TableSource;
}

export interface SessionPolicyDefinition {
  readonly id: string;
  readonly revision: number;
  readonly coverage: CoverageRange;
  readonly table: readonly TableRow[];
}

export interface Session {
  readonly kind: 'Session';
  readonly date: ExchangeDate;
  // The close is the Review Cutoff; the completion is the close plus the buffer.
  readonly close: Instant;
  readonly completion: Instant;
  readonly earlyClose: boolean;
}

export type DayClass =
  | Session
  | { readonly kind: 'Weekend'; readonly date: ExchangeDate }
  | { readonly kind: 'Holiday'; readonly date: ExchangeDate; readonly name: string }
  | { readonly kind: 'Closure'; readonly date: ExchangeDate; readonly name: string }
  | { readonly kind: 'NotCovered'; readonly date: ExchangeDate; readonly coverage: CoverageRange };

export interface SessionPolicyCoverage {
  readonly kind: 'SessionPolicyCoverage';
  readonly date: ExchangeDate;
  readonly coverage: CoverageRange;
}

export type Covered<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly diagnostic: SessionPolicyCoverage };

export interface SessionPolicyIdentity {
  readonly id: string;
  readonly revision: number;
  readonly digest: string;
  readonly coverage: CoverageRange;
}

export interface SessionPolicy {
  readonly identity: SessionPolicyIdentity;
  classify(date: ExchangeDate): DayClass;
  latestCompleted(at: Instant): Covered<Session>;
  previousSession(date: ExchangeDate): Covered<Session>;
  nextSession(date: ExchangeDate): Covered<Session>;
  sessionsBetween(from: ExchangeDate, to: ExchangeDate): Covered<readonly Session[]>;
}
