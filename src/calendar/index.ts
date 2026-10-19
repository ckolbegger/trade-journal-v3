import { epochMilliseconds, type Instant } from "../platform/clock";
import { daysFromCivil, isoDateFromDays, weekdayOf } from "./civilDate";
import {
  CURRENT_SESSION_POLICY_REVISION,
  SESSION_POLICY_REVISIONS,
  type SessionPolicyRevision,
  type SessionPolicyRevisionId,
} from "./sessionPolicy";

export type { SessionPolicyRevisionId } from "./sessionPolicy";

export type TradingDate = string;

export interface SessionDateResolved {
  readonly outcome: "Resolved";
  readonly tradingDate: TradingDate;
  readonly revision: SessionPolicyRevisionId;
}

export interface CalendarOutOfRange {
  readonly outcome: "CalendarOutOfRange";
  readonly revision: SessionPolicyRevisionId;
  readonly coveredInterval: { readonly from: Instant; readonly until: Instant };
}

export type SessionDateResult = SessionDateResolved | CalendarOutOfRange;



function isTradingDay(revision: SessionPolicyRevision, dayNumber: number): boolean {
  const weekday = weekdayOf(dayNumber);
  if (weekday === 0 || weekday === 6) return false;
  return !revision.closures.includes(isoDateFromDays(dayNumber));
}

function previousTradingDay(revision: SessionPolicyRevision, dayNumber: number): number {
  let candidate = dayNumber - 1;
  while (!isTradingDay(revision, candidate)) candidate -= 1;
  return candidate;
}

/**
 * The exchange-local calendar date and wall-clock minute of one instant. `timeZone` is explicit,
 * so the process time zone cannot influence the result and a DST boundary resolves the same way
 * on every machine.
 */
function exchangeDateTime(
  revision: SessionPolicyRevision,
  instant: Instant,
): { dayNumber: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: revision.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(epochMilliseconds(instant));
  const part = (type: string): number => Number(parts.find((entry) => entry.type === type)?.value);

  return {
    dayNumber: daysFromCivil({ year: part("year"), month: part("month"), day: part("day") }),
    minutes: part("hour") * 60 + part("minute"),
  };
}

function closeMinutes(revision: SessionPolicyRevision, dayNumber: number): number {
  const date = isoDateFromDays(dayNumber);
  return (
    revision.earlyCloses.find((entry) => entry.date === date)?.closeMinutes ??
    revision.regularCloseMinutes
  );
}

function resolved(revision: SessionPolicyRevision, dayNumber: number): SessionDateResolved {
  return {
    outcome: "Resolved",
    tradingDate: isoDateFromDays(dayNumber),
    revision: revision.id,
  };
}

export function resolveSessionDate(
  instant: Instant,
  revisionId: SessionPolicyRevisionId = CURRENT_SESSION_POLICY_REVISION,
): SessionDateResult {
  const revision = SESSION_POLICY_REVISIONS[revisionId];

  const instantMilliseconds = epochMilliseconds(instant);
  if (
    instantMilliseconds < epochMilliseconds(revision.coveredFrom) ||
    instantMilliseconds >= epochMilliseconds(revision.coveredUntil)
  ) {
    return {
      outcome: "CalendarOutOfRange",
      revision: revision.id,
      coveredInterval: { from: revision.coveredFrom, until: revision.coveredUntil },
    };
  }

  const { dayNumber, minutes } = exchangeDateTime(revision, instant);

  // After the close the session has completed, so after-close journaling belongs to it. Before
  // the close the most recently completed session is the prior one.
  if (!isTradingDay(revision, dayNumber)) return resolved(revision, previousTradingDay(revision, dayNumber));
  if (minutes >= closeMinutes(revision, dayNumber)) return resolved(revision, dayNumber);
  return resolved(revision, previousTradingDay(revision, dayNumber));
}
