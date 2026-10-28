import { Temporal } from 'temporal-polyfill';
import type { Instant } from '../time/index.ts';
import { policyDigest } from './digest.ts';
import { BUFFER_MINUTES, regularHolidays } from './rules.ts';
import type { Covered, DayClass, ExchangeDate, Session, SessionPolicy, SessionPolicyCoverage, SessionPolicyDefinition } from './types.ts';

const EXCHANGE_ZONE = 'America/New_York';

// An exchange wall-clock hour on an exchange date, as an exact UTC instant.
function exchangeInstant(day: Temporal.PlainDate, hour: number): Instant {
  return day.toZonedDateTime({ timeZone: EXCHANGE_ZONE, plainTime: { hour } }).toInstant().toString();
}

export function createSessionPolicy(definition: SessionPolicyDefinition): SessionPolicy {
  const rows = new Map(definition.table.map((row) => [row.date, row]));
  const coverageDiagnostic = (date: ExchangeDate): SessionPolicyCoverage => ({ kind: 'SessionPolicyCoverage', date, coverage: definition.coverage });
  const classify = (date: ExchangeDate): DayClass => {
    if (date < definition.coverage.first || date > definition.coverage.last) return { kind: 'NotCovered', date, coverage: definition.coverage };
    const day = Temporal.PlainDate.from(date);
    if (day.dayOfWeek >= 6) return { kind: 'Weekend', date };
    const row = rows.get(date);
    if (row?.kind === 'Closure') return { kind: 'Closure', date, name: row.name };
    const holiday = regularHolidays(day.year).find((h) => h.date.equals(day));
    if (holiday) return { kind: 'Holiday', date, name: holiday.name };
    const earlyClose = row?.kind === 'EarlyClose';
    const close = exchangeInstant(day, earlyClose ? 13 : 16);
    const completion = Temporal.Instant.from(close).add({ minutes: BUFFER_MINUTES }).toString();
    return { kind: 'Session', date, close, completion, earlyClose };
  };
  // The nearest session strictly before (step -1) or after (step 1) a date.
  const neighbour = (date: ExchangeDate, step: 1 | -1): Covered<Session> => {
    const input = classify(date);
    if (input.kind === 'NotCovered') return { ok: false, diagnostic: coverageDiagnostic(input.date) };
    for (let day = Temporal.PlainDate.from(date).add({ days: step }); ; day = day.add({ days: step })) {
      const found = classify(day.toString());
      if (found.kind === 'NotCovered') return { ok: false, diagnostic: coverageDiagnostic(found.date) };
      if (found.kind === 'Session') return { ok: true, value: found };
    }
  };
  return {
    identity: { id: definition.id, revision: definition.revision, digest: policyDigest(definition.table), coverage: definition.coverage },
    classify,
    latestCompleted: (at) => {
      const exchangeDate = Temporal.Instant.from(at).toZonedDateTimeISO(EXCHANGE_ZONE).toPlainDate();
      for (let day = exchangeDate; ; day = day.subtract({ days: 1 })) {
        const found = classify(day.toString());
        if (found.kind === 'NotCovered') return { ok: false, diagnostic: coverageDiagnostic(found.date) };
        if (found.kind === 'Session' && Temporal.Instant.compare(found.completion, at) <= 0) return { ok: true, value: found };
      }
    },
    previousSession: (date) => neighbour(date, -1),
    nextSession: (date) => neighbour(date, 1),
    sessionsBetween: (from, to) => {
      const sessions: Session[] = [];
      const last = Temporal.PlainDate.from(to);
      for (let day = Temporal.PlainDate.from(from); Temporal.PlainDate.compare(day, last) <= 0; day = day.add({ days: 1 })) {
        const found = classify(day.toString());
        if (found.kind === 'NotCovered') return { ok: false, diagnostic: coverageDiagnostic(found.date) };
        if (found.kind === 'Session') sessions.push(found);
      }
      return { ok: true, value: sessions };
    },
  };
}
