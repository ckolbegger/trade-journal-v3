/**
 * The single time seam. Nothing outside this module reads the host clock, and every instant
 * crossing the seam is an ISO 8601 UTC string so that Economic Time stays a durable, exact value
 * rather than a mutable `Date`.
 */
export type Instant = string;

export interface Clock {
  /** The module that provides time, recorded in evidence so the seam is auditable. */
  readonly source: string;
  now(): Instant;
}

const SOURCE = "src/platform/clock";

export class SystemClock implements Clock {
  readonly source = SOURCE;

  now(): Instant {
    return new Date().toISOString();
  }
}

export class FixedClock implements Clock {
  readonly source = SOURCE;
  readonly #instant: Instant;

  constructor(instant: Instant) {
    this.#instant = instant;
  }

  now(): Instant {
    return this.#instant;
  }
}

export function isInstant(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function epochMilliseconds(instant: Instant): number {
  return Date.parse(instant);
}

export function instantFromEpochMilliseconds(milliseconds: number): Instant {
  return new Date(milliseconds).toISOString();
}
