import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Runs tools/agent-report.ts as a child process on a small transcript of one JSON string per line.
const dir = mkdtempSync(join(tmpdir(), 'agent-report-'));
let count = 0;
function run(heading: string, strings: string[]) {
  const path = join(dir, `t${count++}.jsonl`);
  writeFileSync(path, strings.map((s) => JSON.stringify({ message: { content: [{ text: s }] } })).join('\n') + '\n');
  const out = spawnSync('node', ['tools/agent-report.ts', heading, path], { encoding: 'utf8' });
  return { stdout: out.stdout, stderr: out.stderr, status: out.status, path };
}

const heading = '# D09 critic-b9 report';
const notification = (body: string) =>
  `<task-notification>\n<task-id>x</task-id>\n<result>${heading}\n${body}\n</result>\n<usage>1</usage>\n</task-notification>`;
const handBack = (body: string) =>
  `<agent-message>\n  ${heading}\n${body.split('\n').map((s) => `  ${s}`).join('\n')}\n</agent-message>`;

describe('agent-report', () => {
  it('prints a report that came back as a task notification result, without the closing result tag', () => {
    const out = run(heading, ['noise', notification('overall PASS\n\n- one\n  indented')]);
    expect(out.status).toBe(0);
    expect(out.stdout).toBe(`${heading}\noverall PASS\n\n- one\n  indented\n`);
  });

  it('still reads the indented hand-back form, cut at the agent-message tag and unindented', () => {
    const out = run(heading, [handBack('overall PASS\n- one')]);
    expect(out.status).toBe(0);
    expect(out.stdout).toBe(`${heading}\noverall PASS\n- one\n`);
  });

  it('takes the later line when both forms are present', () => {
    const early = run(heading, [handBack('old'), notification('new')]);
    expect(early.stdout).toBe(`${heading}\nnew\n`);
    const late = run(heading, [notification('old'), handBack('new')]);
    expect(late.stdout).toBe(`${heading}\nnew\n`);
  });

  it('exits 1 with the no-agent-message line when neither form holds the heading', () => {
    const out = run(heading, ['<agent-message>\n  # D09 critic-b8 report\n</agent-message>', '<task-notification><result># D09 critic-b8 report\nx</result></task-notification>']);
    expect(out.status).toBe(1);
    expect(out.stdout).toBe('');
    expect(out.stderr).toBe(`no agent message with "${heading}" in ${out.path}\n`);
  });
});
