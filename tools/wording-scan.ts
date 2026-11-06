// The scanning half of `npm run verify:wording` (see verify-wording.ts for what the check enforces): the
// phrase and code lists, and a pure function from one file's text to its hits.

// Phrases: every label, figure and sentence of the unavailable, not-applicable and finding tables, and the
// Unbounded texts, reduced to the words that are fixed. "Not available" is FactsIncoherent's figure; it is
// also plain English, but a screen that writes it itself is the drift this check exists to stop.
export const PHRASES = [
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
export const CODES = [
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

// An apostrophe may be straight or curly in source text.
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phraseRe = new RegExp(PHRASES.map((p) => escape(p).replace(/'/g, "['’]")).join('|'), 'gi');
const alt = CODES.join('|');
// `case 'Code'`, or an equality operator on either side of a quoted code; a `.kind` on the left is a status, not a reason.
const caseRe = new RegExp(`\\bcase\\s+(['"\`])(${alt})\\1`, 'g');
const eqAfterRe = new RegExp(`([\\w.?\\]]*)\\s*[!=]==?\\s*(['"\`])(${alt})\\2`, 'g');
const eqBeforeRe = new RegExp(`(['"\`])(${alt})\\1\\s*[!=]==?\\s*([\\w.?]*)`, 'g');

// Blank out comments, keeping every line break so line numbers hold. A `//` or `/*` inside a single, double or
// backtick quoted literal is text, not a comment. A single or double quote ends at a line break (an apostrophe
// in JSX text must not swallow the rest of the file); a backtick literal may span lines.
const stripComments = (source: string): string => {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    const next = source[i + 1];
    if (c === '/' && (next === '/' || next === '*')) {
      const end =
        next === '/'
          ? (source.indexOf('\n', i) === -1 ? source.length : source.indexOf('\n', i))
          : (source.indexOf('*/', i + 2) === -1 ? source.length : source.indexOf('*/', i + 2) + 2);
      out += source.slice(i, end).replace(/[^\n]/g, ' ');
      i = end;
    } else if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < source.length && source[j] !== c && (c === '`' || source[j] !== '\n')) j += source[j] === '\\' ? 2 : 1;
      const end = source[j] === c ? j + 1 : Math.min(j, source.length);
      out += source.slice(i, end);
      i = end;
    } else {
      out += c;
      i++;
    }
  }
  return out;
};

// Each hit as `path:line: kind: match`.
export function scanSource(path: string, source: string): string[] {
  const text = stripComments(source);
  // The regexes run over the whole text so a match may cross line breaks; a hit names the line of its
  // code literal (or, for words, of the phrase), found from the offset.
  const lineAt = (offset: number) => text.slice(0, offset).split('\n').length;
  const found: { line: number; kind: string; match: string }[] = [];
  const at = (offset: number, kind: string, match: string) =>
    found.push({ line: lineAt(offset), kind, match: match.replace(/\s*\n\s*/g, ' ') });
  for (const m of text.matchAll(phraseRe)) at(m.index, 'words', m[0]);
  for (const m of text.matchAll(caseRe)) at(m.index + m[0].lastIndexOf(`${m[1]}${m[2]}`), 'code', m[0]);
  for (const m of text.matchAll(eqAfterRe))
    if (!/\.kind$/.test(m[1] ?? '')) at(m.index + m[0].lastIndexOf(`${m[2]}${m[3]}`), 'code', m[0].trim());
  for (const m of text.matchAll(eqBeforeRe))
    if (!/\.kind$/.test(m[3] ?? '')) at(m.index + m[0].indexOf(`${m[1]}${m[2]}`), 'code', m[0].trim());
  // Line order as before; within a line, phrases, then case, then comparisons, as they were found.
  return found.sort((a, b) => a.line - b.line).map((h) => `${path}:${h.line}: ${h.kind}: ${h.match}`);
}
