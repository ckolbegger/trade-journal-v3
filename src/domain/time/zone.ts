import { Temporal } from 'temporal-polyfill';

export type ValidateTimeZoneResult =
  | { readonly ok: true; readonly timeZone: string }
  | { readonly ok: false; readonly reason: 'InvalidTimeZone' };

export function validateTimeZone(id: string): ValidateTimeZoneResult {
  try {
    const zoned = Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(id);
    // A fixed UTC offset has no rules, so it cannot be a Workspace time zone.
    if (/^[+-]/.test(zoned.timeZoneId)) return { ok: false, reason: 'InvalidTimeZone' };
    return { ok: true, timeZone: zoned.timeZoneId };
  } catch {
    return { ok: false, reason: 'InvalidTimeZone' };
  }
}
