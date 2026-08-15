// ISODate arithmetic ('YYYY-MM-DD'), in the domain layer so both PriceBook (which
// enumerates a gap range) and Valuations (which starts a gap the day after the
// last Mark) compute dates the same way — and neither the UI nor a Book invents
// its own. Imports nothing outside the domain, like everything else under src/domain.
//
// Arithmetic runs in UTC so a local DST transition can never skip or repeat a
// day; a Timestamp, by contrast, converts through the trader's LOCAL date, because
// the trader's local date is the trading date (docs/plan/README.md).

import type { ISODate, Timestamp } from './trademath/types'

const DAY_MS = 24 * 60 * 60 * 1000

function toUTC(date: ISODate): number {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10)
}

// The calendar day after `date`.
export function nextISODate(date: ISODate): ISODate {
  return fromUTC(toUTC(date) + DAY_MS)
}

// Every calendar date from..to inclusive — unchanged by S4.4's weekend-quiet
// ruling (docs/design/pricebook.md, amended 2026-07-19): this stays a plain
// calendar enumeration; the filtering of Saturdays/Sundays out of "needed"
// happens in the caller, PriceBook.missingMarks. Empty when `to` precedes `from`.
export function datesInRange(from: ISODate, to: ISODate): ISODate[] {
  const dates: ISODate[] = []
  for (let ms = toUTC(from); ms <= toUTC(to); ms += DAY_MS) dates.push(fromUTC(ms))
  return dates
}

// True for Saturday and Sunday. UTC arithmetic like the rest of this file, so a
// local DST transition can never shift which weekday a date lands on.
export function isWeekend(date: ISODate): boolean {
  const day = new Date(toUTC(date)).getUTCDay()
  return day === 0 || day === 6
}

// The trading date an epoch-ms Timestamp falls on, in the trader's local zone.
export function isoDateOf(timestamp: Timestamp): ISODate {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
