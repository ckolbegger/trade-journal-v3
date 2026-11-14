// node tools/agent-report.ts "<heading>" [transcript.jsonl]: prints a subagent's final report from the session transcript,
// unindented. Subagents can't write report files, so a critic sends its report as its final message under a fixed heading
// ("# D09 critic-1 report"), and the main session saves it with this script (D08P retro, finding 2).
// The transcript defaults to the newest .jsonl in this project's ~/.claude/projects/ folder, which is the current session.
// Exits 1 when no agent message holds the heading. With several (a re-sent report), the last one wins.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const [heading, given] = process.argv.slice(2);
if (!heading) {
  console.error('usage: node tools/agent-report.ts "<heading>" [transcript.jsonl]');
  process.exit(2);
}
const marker = `  ${heading}`;

function newestTranscript(): string {
  const dir = join(homedir(), '.claude', 'projects', process.cwd().replace(/[/.]/g, '-'));
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => join(dir, f));
  const newest = files.reduce<string | undefined>((a, b) => (a === undefined || statSync(b).mtimeMs > statSync(a).mtimeMs ? b : a), undefined);
  if (newest === undefined) throw new Error(`no transcript in ${dir}`);
  return newest;
}

const transcript = given ?? newestTranscript();
let found: string | undefined;
function scan(value: unknown): void {
  if (typeof value === 'string') {
    if (value.includes('agent-message') && value.includes(marker)) found = value;
  } else if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value)) scan(inner);
  }
}
for (const line of readFileSync(transcript, 'utf8').split('\n')) {
  if (line === '') continue;
  try {
    scan(JSON.parse(line));
  } catch {
    // A partial last line while the session is still writing it.
  }
}
if (found === undefined) {
  console.error(`no agent message with "${heading}" in ${transcript}`);
  process.exit(1);
}

// The harness indents every line of a hand-back by two spaces and closes it with </agent-message>.
let body = found.slice(found.indexOf(marker));
const end = body.lastIndexOf('</agent-message>');
if (end >= 0) body = body.slice(0, end);
const lines = body.split('\n').map((s) => (s.startsWith('  ') ? s.slice(2) : s));
process.stdout.write(`${lines.join('\n').trimEnd()}\n`);
