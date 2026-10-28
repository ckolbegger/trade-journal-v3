import { Temporal } from 'temporal-polyfill';

export const RULES_VERSION = 'nyse-rules-1';

// A session is completed this long after its close (P9). The digest covers it.
export const BUFFER_MINUTES = 30;

export interface RuleHoliday {
  readonly date: Temporal.PlainDate;
  readonly name: string;
}

function nthWeekday(year: number, month: number, weekday: number, n: number): Temporal.PlainDate {
  const first = Temporal.PlainDate.from({ year, month, day: 1 });
  const offset = (weekday - first.dayOfWeek + 7) % 7;
  return first.add({ days: offset + 7 * (n - 1) });
}

function lastWeekday(year: number, month: number, weekday: number): Temporal.PlainDate {
  const last = Temporal.PlainDate.from({ year, month, day: 1 }).add({ months: 1 }).subtract({ days: 1 });
  return last.subtract({ days: (last.dayOfWeek - weekday + 7) % 7 });
}

// Observance: a Saturday holiday moves to the preceding Friday, a Sunday holiday to the following Monday.
// A Saturday New Year's Day is the exception: it is not observed, so the Friday before stays a session.
function observed(date: Temporal.PlainDate, saturdayObserved = true): Temporal.PlainDate {
  if (date.dayOfWeek === 6) return saturdayObserved ? date.subtract({ days: 1 }) : date;
  if (date.dayOfWeek === 7) return date.add({ days: 1 });
  return date;
}

export function regularHolidays(year: number): RuleHoliday[] {
  const fixed = (month: number, day: number) => Temporal.PlainDate.from({ year, month, day });
  const holidays: RuleHoliday[] = [
    { date: observed(fixed(1, 1), false), name: "New Year's Day" },
    { date: nthWeekday(year, 1, 1, 3), name: 'Martin Luther King Jr. Day' },
    { date: nthWeekday(year, 2, 1, 3), name: "Washington's Birthday" },
    { date: easterSunday(year).subtract({ days: 2 }), name: 'Good Friday' },
    { date: lastWeekday(year, 5, 1), name: 'Memorial Day' },
    { date: observed(fixed(7, 4)), name: 'Independence Day' },
    { date: nthWeekday(year, 9, 1, 1), name: 'Labor Day' },
    { date: nthWeekday(year, 11, 4, 4), name: 'Thanksgiving' },
    { date: observed(fixed(12, 25)), name: 'Christmas' },
  ];
  // Juneteenth became an NYSE holiday in 2022.
  if (year >= 2022) holidays.push({ date: observed(fixed(6, 19)), name: 'Juneteenth' });
  return holidays;
}

// Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
function easterSunday(year: number): Temporal.PlainDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return Temporal.PlainDate.from({ year, month, day });
}
