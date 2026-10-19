// An instant is an ISO-8601 UTC string such as "2026-10-12T13:00:00Z".
export type Instant = string;

// Time is always read from an injected clock; pure analysis never reads the wall clock.
export interface Clock {
  now(): Instant;
}

export function fixedClock(instant: Instant): Clock {
  return { now: () => instant };
}
