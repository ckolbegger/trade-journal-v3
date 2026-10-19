import type { Instant } from "../platform/clock";

export type SessionPolicyRevisionId = "us-session-2025.1" | "us-session-2026.1";

export interface SessionPolicyRevision {
  readonly id: SessionPolicyRevisionId;
  /** Inclusive start of the instants this revision resolves. */
  readonly coveredFrom: Instant;
  /** Exclusive end of the instants this revision resolves. */
  readonly coveredUntil: Instant;
  readonly timeZone: string;
  readonly regularCloseMinutes: number;
  /** Exchange-local dates on which the market is closed. */
  readonly closures: readonly string[];
  /** Exchange-local half days that close before the regular close. */
  readonly earlyCloses: readonly { readonly date: string; readonly closeMinutes: number }[];
}

export const SESSION_POLICY_REVISIONS: Record<SessionPolicyRevisionId, SessionPolicyRevision> = {
  "us-session-2025.1": {
    id: "us-session-2025.1",
    coveredFrom: "2025-01-01T00:00:00.000Z",
    coveredUntil: "2026-01-01T00:00:00.000Z",
    timeZone: "America/New_York",
    regularCloseMinutes: 16 * 60,
    closures: [
      "2025-01-01",
      "2025-01-20",
      "2025-02-17",
      "2025-04-18",
      "2025-05-26",
      "2025-06-19",
      "2025-07-04",
      "2025-09-01",
      "2025-11-27",
      "2025-12-25",
    ],
    earlyCloses: [
      { date: "2025-07-03", closeMinutes: 13 * 60 },
      { date: "2025-11-28", closeMinutes: 13 * 60 },
      { date: "2025-12-24", closeMinutes: 13 * 60 },
    ],
  },
  "us-session-2026.1": {
    id: "us-session-2026.1",
    coveredFrom: "2026-01-01T00:00:00.000Z",
    coveredUntil: "2027-01-01T00:00:00.000Z",
    timeZone: "America/New_York",
    regularCloseMinutes: 16 * 60,
    closures: [
      "2026-01-01",
      "2026-01-19",
      "2026-02-16",
      "2026-04-03",
      "2026-05-25",
      "2026-06-19",
      "2026-07-03",
      "2026-09-07",
      "2026-11-26",
      "2026-12-25",
    ],
    earlyCloses: [
      { date: "2026-11-27", closeMinutes: 13 * 60 },
      { date: "2026-12-24", closeMinutes: 13 * 60 },
    ],
  },
};

export const CURRENT_SESSION_POLICY_REVISION: SessionPolicyRevisionId = "us-session-2026.1";
