// What the forms share about a Workspace-local time field defaulted to now.

// The codes fromWorkspaceLocal can fail with: the forms judge all of them themselves.
export const LOCAL_TIME_CODES: ReadonlySet<string> = new Set(['InvalidLocalTime', 'NonexistentLocalTime', 'AmbiguousLocalTime']);

// The instant a time field defaulted to now shows, to the minute as the field does. The untouched
// default is submitted as this instant: "now" is exact, so a wall time that occurs twice at a
// fall-back (D1 A8) never makes it ambiguous. An edited field is resolved from its text instead.
export function minuteOf(instant: string): string {
  return new Date(Math.floor(Date.parse(instant) / 60000) * 60000).toISOString().replace('.000Z', 'Z');
}

// Why a typed Workspace-local time was rejected, to follow the name of the field it is typed in.
export const AMBIGUOUS_TIME = 'occurs twice because clocks fall back; enter an earlier or later time.';
export const NONEXISTENT_TIME = 'does not exist because clocks spring forward; enter an earlier or later time.';
export const INVALID_TIME = 'is not a valid date and time; enter one.';
