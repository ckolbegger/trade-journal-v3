// npm run verify:session-policy: the built-in NYSE session policy (rules plus table) equals NYSE's
// published calendars for every covered year, exactly (D4 T4.2, P8, A39). It also fails when the
// policy's digest differs from the digest recorded for its declared revision.
import { readFile } from 'node:fs/promises';
import { Temporal } from 'temporal-polyfill';
import { nyseSessionPolicy } from '../src/domain/session-policy/index.ts';
import { NYSE_TABLE } from '../src/domain/session-policy/table.ts';

interface Published {
  readonly years: readonly {
    readonly year: number;
    readonly sources: readonly { readonly title: string; readonly url: string }[];
    readonly closures: readonly { readonly date: string; readonly weekday: string }[];
    readonly earlyCloses: readonly { readonly date: string; readonly weekday: string; readonly close: string }[];
  }[];
}

const dir = new URL('../src/domain/session-policy/', import.meta.url);
const published = JSON.parse(await readFile(new URL('nyse-published.json', dir), 'utf8')) as Published;
const recorded = JSON.parse(await readFile(new URL('revision-digests.json', dir), 'utf8')) as Record<string, Record<string, string>>;
const problems: string[] = [];
const { id, revision, digest, coverage } = nyseSessionPolicy.identity;

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const weekdayOf = (date: string) => WEEKDAYS[Temporal.PlainDate.from(date).dayOfWeek - 1];

const first = Number(coverage.first.slice(0, 4));
const last = Number(coverage.last.slice(0, 4));
const covered = published.years.map((y) => y.year);
for (let year = first; year <= last; year++) {
  if (!covered.includes(year)) problems.push(`${year}: no transcription in nyse-published.json`);
}

const sourceUrls = new Map(published.years.map((y) => [y.year, new Set(y.sources.map((s) => s.url))]));
for (const row of NYSE_TABLE) {
  const urls = sourceUrls.get(Number(row.date.slice(0, 4)));
  if (urls !== undefined && !urls.has(row.source.url)) problems.push(`${row.date}: table source ${row.source.url} is not a source of that year's transcription`);
}

let compared = 0;
for (const year of published.years) {
  const expectedClosed = new Map<string, string>();
  for (const c of year.closures) {
    if (weekdayOf(c.date) !== c.weekday) problems.push(`${c.date}: transcription says ${c.weekday}, the calendar says ${weekdayOf(c.date)}`);
    expectedClosed.set(c.date, c.weekday);
  }
  const expectedEarly = new Map(year.earlyCloses.map((e) => [e.date, e.close]));
  for (const e of year.earlyCloses) {
    if (weekdayOf(e.date) !== e.weekday) problems.push(`${e.date}: transcription says ${e.weekday}, the calendar says ${weekdayOf(e.date)}`);
  }
  const actualClosed = new Set<string>();
  const actualEarly = new Map<string, string>();
  for (let day = Temporal.PlainDate.from({ year: year.year, month: 1, day: 1 }); day.year === year.year; day = day.add({ days: 1 })) {
    const date = day.toString();
    const found = nyseSessionPolicy.classify(date);
    if (found.kind === 'NotCovered') {
      problems.push(`${date}: published year is outside the policy's coverage`);
      continue;
    }
    compared++;
    if (found.kind === 'Holiday' || found.kind === 'Closure') actualClosed.add(date);
    if (found.kind === 'Session' && found.earlyClose) {
      actualEarly.set(date, Temporal.Instant.from(found.close).toZonedDateTimeISO('America/New_York').toPlainTime().toString({ smallestUnit: 'minute' }));
    }
  }
  for (const date of expectedClosed.keys()) if (!actualClosed.has(date)) problems.push(`${date}: published closed (${expectedClosed.get(date)}), policy has a session`);
  for (const date of actualClosed) if (!expectedClosed.has(date)) problems.push(`${date}: policy closed (${weekdayOf(date)}), not in the published calendar`);
  for (const [date, close] of expectedEarly) {
    if (!actualEarly.has(date)) problems.push(`${date}: published early close at ${close}, policy has no early close`);
    else if (actualEarly.get(date) !== close) problems.push(`${date}: published early close at ${close}, policy closes at ${actualEarly.get(date)}`);
  }
  for (const date of actualEarly.keys()) if (!expectedEarly.has(date)) problems.push(`${date}: policy early close, not in the published calendar`);
}

const expectedDigest = recorded[id]?.[String(revision)];
if (expectedDigest === undefined) problems.push(`no digest recorded for ${id} revision ${revision} in revision-digests.json`);
else if (expectedDigest !== digest) problems.push(`digest of ${id} revision ${revision} is ${digest}, recorded ${expectedDigest}: bump the revision and record the new digest`);

if (problems.length > 0) {
  for (const p of problems) console.error(`verify:session-policy: ${p}`);
  console.error(`verify:session-policy FAILED (${problems.length} problem${problems.length === 1 ? '' : 's'})`);
  process.exit(1);
}
console.log(`verify:session-policy OK: ${published.years.length} years (${coverage.first} to ${coverage.last}), ${compared} dates compared, ${id} revision ${revision} digest ${digest}`);
