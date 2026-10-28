import { describe, expect, it } from 'vitest';
import { createSessionPolicy, nyseSessionPolicy as policy } from './index.ts';

function holidayName(date: string): string | undefined {
  const day = policy.classify(date);
  return day.kind === 'Holiday' ? day.name : undefined;
}

describe('regular holiday rules', () => {
  it('should classify the ten regular holidays of 2026 with their names, and the weekdays around each as sessions', () => {
    const holidays: [string, string][] = [
      ['2026-01-01', "New Year's Day"],
      ['2026-01-19', 'Martin Luther King Jr. Day'],
      ['2026-02-16', "Washington's Birthday"],
      ['2026-04-03', 'Good Friday'],
      ['2026-05-25', 'Memorial Day'],
      ['2026-06-19', 'Juneteenth'],
      ['2026-07-03', 'Independence Day'],
      ['2026-09-07', 'Labor Day'],
      ['2026-11-26', 'Thanksgiving'],
      ['2026-12-25', 'Christmas'],
    ];
    for (const [date, name] of holidays) expect(holidayName(date), date).toBe(name);
    const around = ['2026-01-02', '2026-01-20', '2026-02-17', '2026-04-02', '2026-05-26', '2026-06-18', '2026-07-02', '2026-09-08', '2026-11-25', '2026-12-28'];
    for (const date of around) expect(policy.classify(date).kind, date).toBe('Session');
  });

  it('should observe a Saturday holiday on the preceding Friday and a Sunday holiday on the following Monday', () => {
    expect(holidayName('2026-07-03')).toBe('Independence Day');
    expect(policy.classify('2026-07-04').kind).toBe('Weekend');
    expect(holidayName('2022-06-20')).toBe('Juneteenth');
    expect(policy.classify('2022-06-17').kind).toBe('Session');
  });

  it('should keep Friday 2021-12-31 a session, because New Year\'s Day 2022 falls on a Saturday', () => {
    expect(policy.classify('2021-12-31').kind).toBe('Session');
    expect(policy.classify('2022-01-01').kind).toBe('Weekend');
    expect(policy.classify('2022-01-03').kind).toBe('Session');
  });

  it('should place Good Friday two days before Easter', () => {
    expect(holidayName('2026-04-03')).toBe('Good Friday');
    expect(holidayName('2027-03-26')).toBe('Good Friday');
  });

  it('should treat Juneteenth as a holiday only from 2022', () => {
    expect(policy.classify('2021-06-18').kind).toBe('Session');
    expect(policy.classify('2021-06-21').kind).toBe('Session');
    expect(holidayName('2022-06-20')).toBe('Juneteenth');
    expect(holidayName('2023-06-19')).toBe('Juneteenth');
  });

  it('should keep Columbus Day 2026-10-12 a session', () => {
    expect(policy.classify('2026-10-12').kind).toBe('Session');
  });
});

function sessionOf(date: string) {
  const day = policy.classify(date);
  if (day.kind !== 'Session') throw new Error(`${date} is ${day.kind}`);
  return day;
}

describe('explicit table', () => {
  it('should classify each listed one-off closure as a Closure with its name', () => {
    for (const date of ['2001-09-11', '2001-09-12', '2001-09-13', '2001-09-14', '2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09']) {
      const day = policy.classify(date);
      expect(day.kind, date).toBe('Closure');
      if (day.kind === 'Closure') expect(day.name.length, date).toBeGreaterThan(0);
    }
    expect(policy.classify('2001-09-10').kind).toBe('Session');
    expect(policy.classify('2001-09-17').kind).toBe('Session');
    expect(policy.classify('2004-06-11').kind).toBe('Closure');
    expect(policy.classify('2007-01-02').kind).toBe('Closure');
  });

  it('should give each listed early-close day a 13:00 America/New_York close and every other session a 16:00 close', () => {
    expect(sessionOf('2026-11-27')).toMatchObject({ earlyClose: true, close: '2026-11-27T18:00:00Z' });
    expect(sessionOf('2026-12-24')).toMatchObject({ earlyClose: true, close: '2026-12-24T18:00:00Z' });
    expect(sessionOf('2026-11-30')).toMatchObject({ earlyClose: false, close: '2026-11-30T21:00:00Z' });
    expect(sessionOf('2026-07-02')).toMatchObject({ earlyClose: false });
  });
});

describe('close and completion instants (P9)', () => {
  it('should return each close as an exact instant across daylight-saving changes', () => {
    expect(sessionOf('2026-03-06').close).toBe('2026-03-06T21:00:00Z');
    expect(sessionOf('2026-03-09').close).toBe('2026-03-09T20:00:00Z');
    expect(sessionOf('2026-11-02').close).toBe('2026-11-02T21:00:00Z');
    expect(sessionOf('2026-10-30').close).toBe('2026-10-30T20:00:00Z');
  });

  it('should return each completion 30 minutes after its close', () => {
    expect(sessionOf('2026-10-13').completion).toBe('2026-10-13T20:30:00Z');
    expect(sessionOf('2026-11-27').completion).toBe('2026-11-27T18:30:00Z');
  });
});

function latest(at: string): string {
  const result = policy.latestCompleted(at);
  if (!result.ok) throw new Error(`not covered: ${at}`);
  return result.value.date;
}

describe('latest completed session (P9)', () => {
  it('should return Monday 2026-10-12 at Tuesday 2026-10-13 12:00 (AC-MARK-001)', () => {
    expect(latest('2026-10-13T16:00:00Z')).toBe('2026-10-12');
  });

  it('should return Tuesday at exactly Tuesday 16:30:00, and Monday at Tuesday 16:00 and at 16:29:59.999', () => {
    expect(latest('2026-10-13T20:30:00Z')).toBe('2026-10-13');
    expect(latest('2026-10-13T20:00:00Z')).toBe('2026-10-12');
    expect(latest('2026-10-13T20:29:59.999Z')).toBe('2026-10-12');
  });

  it('should return Friday 2026-10-16 on Saturday, on Sunday, and on Monday 2026-10-19 before 16:30', () => {
    expect(latest('2026-10-17T16:00:00Z')).toBe('2026-10-16');
    expect(latest('2026-10-18T16:00:00Z')).toBe('2026-10-16');
    expect(latest('2026-10-19T20:29:59Z')).toBe('2026-10-16');
    expect(latest('2026-10-19T20:30:00Z')).toBe('2026-10-19');
  });

  it('should return Friday 2026-11-27 at 13:30 that day and Wednesday 2026-11-25 at 13:29 that day', () => {
    expect(latest('2026-11-27T18:30:00Z')).toBe('2026-11-27');
    expect(latest('2026-11-27T18:29:00Z')).toBe('2026-11-25');
  });

  it('should skip a holiday, returning 2026-11-25 at Thanksgiving 2026-11-26 18:00', () => {
    expect(latest('2026-11-26T23:00:00Z')).toBe('2026-11-25');
  });
});

describe('neighbours and enumeration', () => {
  it('should return the previous and next sessions of a date, skipping weekends, holidays, and closures', () => {
    const dateOf = (r: ReturnType<typeof policy.previousSession>) => (r.ok ? r.value.date : r.diagnostic.kind);
    expect(dateOf(policy.previousSession('2026-10-12'))).toBe('2026-10-09');
    expect(dateOf(policy.nextSession('2026-10-09'))).toBe('2026-10-12');
    expect(dateOf(policy.nextSession('2026-11-25'))).toBe('2026-11-27');
    expect(dateOf(policy.previousSession('2026-11-27'))).toBe('2026-11-25');
    expect(dateOf(policy.nextSession('2012-10-26'))).toBe('2012-10-31');
    expect(dateOf(policy.previousSession('2025-01-10'))).toBe('2025-01-08');
    expect(dateOf(policy.nextSession('2026-10-17'))).toBe('2026-10-19');
  });

  it('should enumerate sessions inclusively (2026-11-23 to 2026-11-30 gives 23, 24, 25, 27, and 30)', () => {
    const result = policy.sessionsBetween('2026-11-23', '2026-11-30');
    expect(result.ok && result.value.map((s) => s.date)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27', '2026-11-30']);
    const single = policy.sessionsBetween('2026-11-24', '2026-11-24');
    expect(single.ok && single.value.map((s) => s.date)).toEqual(['2026-11-24']);
    const empty = policy.sessionsBetween('2026-11-28', '2026-11-29');
    expect(empty.ok && empty.value).toEqual([]);
  });
});

describe('neighbours and coverage', () => {
  const coverage = { first: '2000-01-01', last: '2028-12-31' };
  const diagnostic = (date: string) => ({ ok: false, diagnostic: { kind: 'SessionPolicyCoverage', date, coverage } });

  it('should return a SessionPolicyCoverage diagnostic from previousSession and nextSession when the input date is outside coverage', () => {
    expect(policy.nextSession('1999-12-31')).toEqual(diagnostic('1999-12-31'));
    expect(policy.previousSession('2029-01-02')).toEqual(diagnostic('2029-01-02'));
  });

  it('should return a SessionPolicyCoverage diagnostic when the neighbour would fall outside coverage', () => {
    expect(policy.previousSession('2000-01-03')).toEqual(diagnostic('1999-12-31'));
    expect(policy.nextSession('2028-12-29')).toEqual(diagnostic('2029-01-01'));
  });
});

describe('coverage (P8)', () => {
  it('should classify a date before 2000-01-01 or after the last covered year as NotCovered with the coverage range, never as a session or a holiday', () => {
    const coverage = { first: '2000-01-01', last: '2028-12-31' };
    for (const date of ['1999-12-31', '1999-12-24', '2029-01-01', '2029-01-02', '2030-07-04', '2040-03-15']) {
      expect(policy.classify(date), date).toEqual({ kind: 'NotCovered', date, coverage });
    }
    expect(policy.classify('2000-01-03').kind).toBe('Session');
    expect(policy.classify('2028-12-29').kind).toBe('Session');
    expect(policy.classify('2028-12-31').kind).toBe('Weekend');
  });

  it('should return a SessionPolicyCoverage diagnostic from latest completed session when the instant\'s exchange date is outside coverage', () => {
    const coverage = { first: '2000-01-01', last: '2028-12-31' };
    expect(policy.latestCompleted('2029-01-03T20:00:00Z')).toEqual({ ok: false, diagnostic: { kind: 'SessionPolicyCoverage', date: '2029-01-03', coverage } });
    expect(policy.latestCompleted('1999-06-01T12:00:00Z')).toEqual({ ok: false, diagnostic: { kind: 'SessionPolicyCoverage', date: '1999-06-01', coverage } });
    // Inside coverage, but no session has completed yet inside the window.
    expect(policy.latestCompleted('2000-01-03T12:00:00Z').ok).toBe(false);
    // The exchange date is New York's: 2029-01-01T03:00Z is still 2028-12-31 there.
    expect(latest('2029-01-01T03:00:00Z')).toBe('2028-12-29');
    expect(policy.nextSession('2028-12-29').ok).toBe(false);
    expect(policy.previousSession('2000-01-03').ok).toBe(false);
    expect(policy.sessionsBetween('2028-12-28', '2029-01-02').ok).toBe(false);
  });

  it('should expose its identity (id, revision, digest, coverage range) and return deep-equal results for identical inputs', () => {
    expect(policy.identity).toEqual({
      id: 'nyse',
      revision: 1,
      digest: policy.identity.digest,
      coverage: { first: '2000-01-01', last: '2028-12-31' },
    });
    expect(policy.identity.digest).toMatch(/^[0-9a-f]{64}$/);
    const definition = { id: 'test', revision: 7, coverage: { first: '2020-01-01', last: '2030-12-31' }, table: [] };
    const first = createSessionPolicy(definition);
    const second = createSessionPolicy({ ...definition });
    expect(second.identity).toEqual(first.identity);
    expect(second.classify('2026-10-12')).toEqual(first.classify('2026-10-12'));
    expect(second.latestCompleted('2026-10-13T16:00:00Z')).toEqual(first.latestCompleted('2026-10-13T16:00:00Z'));
    // The table decides the digest; the revision and the id do not.
    const row = { date: '2026-10-12', kind: 'Closure' as const, name: 'Test closure', source: { name: 'test', url: 'https://example.test' } };
    const withRow = createSessionPolicy({ ...definition, revision: 8, table: [row] });
    expect(withRow.identity.digest).not.toBe(first.identity.digest);
    expect(withRow.identity.revision).toBe(8);
    expect(createSessionPolicy({ ...definition, id: 'other', revision: 9 }).identity.digest).toBe(first.identity.digest);
    expect(withRow.classify('2026-10-12')).toMatchObject({ kind: 'Closure', name: 'Test closure' });
  });
});
