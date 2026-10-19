/**
 * Pure civil-date arithmetic. The calendar must resolve identically on every machine, so it does
 * not use `Date` at all: day numbers are integers and all conversion is arithmetic.
 */
export interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export function daysFromCivil({ year, month, day }: CivilDate): number {
  const shiftedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(shiftedYear / 400);
  const yearOfEra = shiftedYear - era * 400;
  const monthIndex = month > 2 ? month - 3 : month + 9;
  const dayOfYear = Math.floor((153 * monthIndex + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

export function civilFromDays(dayNumber: number): CivilDate {
  const shifted = dayNumber + 719468;
  const era = Math.floor(shifted / 146097);
  const dayOfEra = shifted - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  );
  const year = yearOfEra + era * 400;
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPrime = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthPrime + 2) / 5) + 1;
  const month = monthPrime < 10 ? monthPrime + 3 : monthPrime - 9;
  return { year: year + (month <= 2 ? 1 : 0), month, day };
}

export function isoDateFromDays(dayNumber: number): string {
  const { year, month, day } = civilFromDays(dayNumber);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysFromIsoDate(date: string): number {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return daysFromCivil({ year, month, day });
}

/** 0 = Sunday, 1 = Monday, … 6 = Saturday. Day 0 (1970-01-01) was a Thursday. */
export function weekdayOf(dayNumber: number): number {
  return (((dayNumber + 4) % 7) + 7) % 7;
}
