import { Temporal } from 'temporal-polyfill';
import type { Instant } from './clock.ts';

// A Workspace-local date-time in the form "YYYY-MM-DDTHH:mm", as a datetime-local input uses.
export type WorkspaceLocal = string;

export function toWorkspaceLocal(instant: Instant, timeZone: string): WorkspaceLocal {
  return Temporal.Instant.from(instant)
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime()
    .toString({ smallestUnit: 'minute' });
}

export type FromWorkspaceLocalResult =
  | { readonly ok: true; readonly instant: Instant }
  | { readonly ok: false; readonly reason: 'InvalidLocalTime' | 'NonexistentLocalTime' | 'AmbiguousLocalTime' };

export function fromWorkspaceLocal(local: WorkspaceLocal, timeZone: string): FromWorkspaceLocalResult {
  let dateTime: Temporal.PlainDateTime;
  try {
    dateTime = Temporal.PlainDateTime.from(local);
  } catch {
    return { ok: false, reason: 'InvalidLocalTime' };
  }
  const earlier = dateTime.toZonedDateTime(timeZone, { disambiguation: 'earlier' });
  // In a DST gap the wall time does not exist, so the resolved wall time differs from the input.
  if (!earlier.toPlainDateTime().equals(dateTime)) return { ok: false, reason: 'NonexistentLocalTime' };
  // At a fall-back the wall time occurs twice, so the earlier and later readings differ.
  const later = dateTime.toZonedDateTime(timeZone, { disambiguation: 'later' });
  if (!later.equals(earlier)) return { ok: false, reason: 'AmbiguousLocalTime' };
  return { ok: true, instant: earlier.toInstant().toString() };
}
