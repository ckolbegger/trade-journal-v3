import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scanSource } from './wording-scan.ts';

const uiDir = new URL('../src/ui/', import.meta.url);
const uiSources = (dir: URL): URL[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const child = new URL(e.name + (e.isDirectory() ? '/' : ''), dir);
    return e.isDirectory() ? uiSources(child) : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [child] : [];
  });

describe('verify:wording scanning', () => {
  it('fails on a comparison whose operator and code literal are on consecutive lines', () => {
    const source = ['const a = 1;', 'const b = result.reason ===', "  'MarkMissing';"].join('\n');
    const hits = scanSource('src/ui/X.tsx', source);
    expect(hits.length).toBe(1);
    expect(hits[0]).toMatch(/^src\/ui\/X\.tsx:3: code: /);
  });

  it('fails on a case whose code literal is on the line after case', () => {
    const source = ['switch (r) {', '  case', "    'NotClosed':", '    break;', '}'].join('\n');
    const hits = scanSource('src/ui/Y.tsx', source);
    expect(hits.length).toBe(1);
    expect(hits[0]).toMatch(/^src\/ui\/Y\.tsx:3: code: /);
  });

  it('still passes on the current tree', () => {
    const files = uiSources(uiDir).filter((f) => !f.pathname.endsWith('/src/ui/calculation-words.ts'));
    expect(files.length).toBeGreaterThan(0);
    const hits = files.flatMap((f) => scanSource(f.pathname, readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});
