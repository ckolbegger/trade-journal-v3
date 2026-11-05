// npm run verify:wording: src/ui/calculation-words.ts is the only place that words a Calculation Result's
// reason or finding, and the only place that branches on a reason code (D7 prefactor P74). Every other
// file under src/ui/ fails when it contains
//   (a) a reason's words: a phrase of the plan's text tables (section 1.4), matched case-insensitively
//       and ignoring comments; or
//   (b) a `case` or a comparison on a reason code, such as `case 'NotClosed':` or `x.reason === 'MarkMissing'`.
// Market Data's Expected-Mark Status (Available, Missing, AcknowledgedUnavailable) is the evidence itself and
// is compared on a `kind` field, which (b) leaves alone. Test files (*.test.ts, *.test.tsx) assert the words
// and are exempt, as is the module itself. Each hit prints as file:line, the kind of match and the match.
import { readdir, readFile } from 'node:fs/promises';
import { relative } from 'node:path';

const root = new URL('../', import.meta.url);
const uiDir = new URL('src/ui/', root);
const MODULE = 'src/ui/calculation-words.ts';

// Phrases: every label, figure and sentence of the unavailable, not-applicable and finding tables, and the
// Unbounded texts, reduced to the words that are fixed. "Not available" is FactsIncoherent's figure; it is
// also plain English, but a screen that writes it itself is the drift this check exists to stop.
const PHRASES = [
  'Mark missing',
  'Acknowledged unavailable',
  'Mark acknowledged unavailable',
  'Awaiting close',
  'Awaiting the close',
  'Awaiting the next close',
  'Outside calendar',
  'Outside the market calendar',
  'is outside the market calendar',
  "Facts can't be replayed",
  'Not available',
  'Not applicable',
  'Unbounded above',
  'Unbounded below',
  'is more than the',
  'leaves the Position flat',
  'names a Planned Leg',
  "has a quantity that isn't positive",
  'shares its identity',
];
const CODES = [
  'MarkMissing',
  'AcknowledgedUnavailable',
  'AwaitingClose',
  'SessionPolicyNotCovered',
  'FactsIncoherent',
  'NoRemainingPosition',
  'NotClosed',
  'EntryNotResolved',
  'NoOngoingRisk',
  'EntryAtOrBeyondStop',
  'EntryAtOrBeyondTarget',
  'NonPositiveAtEntry',
  'UnknownPlannedLeg',
  'NonpositiveQuantity',
  'DuplicateFactId',
  'FlatBeforeLaterFacts',
  'ExceedsOpenQuantity',
];

if (process.argv.includes('--list')) {
  console.log(`phrases (${PHRASES.length}):\n${PHRASES.map((p) => `  ${p}`).join('\n')}\ncodes (${CODES.length}):\n${CODES.map((c) => `  ${c}`).join('\n')}`);
  process.exit(0);
}

// An apostrophe may be straight or curly in source text.
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phraseRe = new RegExp(PHRASES.map((p) => escape(p).replace(/'/g, "['’]")).join('|'), 'gi');
const alt = CODES.join('|');
// `case 'Code'`, or an equality operator on either side of a quoted code; a `.kind` on the left is a status, not a reason.
const caseRe = new RegExp(`\\bcase\\s+(['"\`])(${alt})\\1`, 'g');
const eqAfterRe = new RegExp(`([\\w.?\\]]*)\\s*[!=]==?\\s*(['"\`])(${alt})\\2`, 'g');
const eqBeforeRe = new RegExp(`(['"\`])(${alt})\\1\\s*[!=]==?\\s*([\\w.?]*)`, 'g');

// Blank out comments, keeping every line break so line numbers hold.
const stripComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^\w:'"`])\/\/.*$/gm, (_m, lead: string) => lead);

async function* sources(dir: URL): AsyncGenerator<URL> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) yield* sources(child);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) yield child;
  }
}

const hits: string[] = [];
for await (const file of sources(uiDir)) {
  const path = relative(root.pathname, file.pathname);
  if (path === MODULE) continue;
  const lines = stripComments(await readFile(file, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    const at = (kind: string, match: string) => hits.push(`${path}:${i + 1}: ${kind}: ${match}`);
    for (const m of line.matchAll(phraseRe)) at('words', m[0]);
    for (const m of line.matchAll(caseRe)) at('code', m[0]);
    for (const m of line.matchAll(eqAfterRe)) if (!/\.kind$/.test(m[1] ?? '')) at('code', m[0].trim());
    for (const m of line.matchAll(eqBeforeRe)) if (!/\.kind$/.test(m[3] ?? '')) at('code', m[0].trim());
  });
}

if (hits.length > 0) {
  console.error(`verify:wording failed: ${hits.length} match(es) outside ${MODULE}`);
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log(`verify:wording: no reason words or reason-code branches outside ${MODULE}`);
