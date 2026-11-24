// Deterministic U.S. trading calendar for D2. No system clock: callers pass an
// explicit instant. Sessions are weekdays; holiday rules can be extended later
// without changing callers.

export function isCompletedSession(dateIso: string): boolean {
  const day = new Date(dateIso + 'T12:00:00Z').getUTCDay()
  return day !== 0 && day !== 6
}

// Latest completed regular session as of the given instant. A session is not
// "completed" until the regular close (20:00Z = 4pm ET); during an active
// Tuesday session the Expected Mark Date is Monday, not Tuesday.
const REGULAR_CLOSE_UTC_HOUR = 20

export function resolveExpectedMarkDate(instant: Date): string {
  const d = new Date(instant)
  const sessionComplete = d.getUTCHours() >= REGULAR_CLOSE_UTC_HOUR
  if (!sessionComplete) d.setUTCDate(d.getUTCDate() - 1)
  while (!isCompletedSession(d.toISOString().slice(0, 10))) {
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return d.toISOString().slice(0, 10)
}
