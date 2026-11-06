// npm run verify:wording: src/ui/calculation-words.ts is the only place that words a Calculation Result's
// reason or finding, and the only place that branches on a reason code (D7 prefactor P74). Every other
// file under src/ui/ fails when it contains
//   (a) a reason's words: a phrase of the plan's text tables (section 1.4), matched case-insensitively
//       and ignoring comments; or
//   (b) a `case` or a comparison on a reason code, such as `case 'NotClosed':` or `x.reason === 'MarkMissing'`.
// Market Data's Expected-Mark Status (Available, Missing, AcknowledgedUnavailable) is the evidence itself and
// is compared on a `kind` field, which (b) leaves alone. Test files (*.test.ts, *.test.tsx) assert the words
// and are exempt, as is the module itself. Each hit prints as file:line, the kind of match and the match.
// The phrase and code lists and the scanning live in wording-scan.ts.
import { readdir, readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { CODES, PHRASES, REASON_WORDS, scanSource } from './wording-scan.ts';

const root = new URL('../', import.meta.url);
const uiDir = new URL('src/ui/', root);
const MODULE = 'src/ui/calculation-words.ts';

if (process.argv.includes('--list')) {
  console.log(`phrases (${PHRASES.length}):\n${PHRASES.map((p) => `  ${p}`).join('\n')}\nreason words, whole literal or JSX text only (${REASON_WORDS.length}):\n${REASON_WORDS.map((w) => `  ${w}`).join('\n')}\ncodes (${CODES.length}):\n${CODES.map((c) => `  ${c}`).join('\n')}`);
  process.exit(0);
}

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
  hits.push(...scanSource(path, await readFile(file, 'utf8')));
}

if (hits.length > 0) {
  console.error(`verify:wording failed: ${hits.length} match(es) outside ${MODULE}`);
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log(`verify:wording: no reason words or reason-code branches outside ${MODULE}`);
