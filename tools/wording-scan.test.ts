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

  it('fails on a phrase after a string containing a line comment marker', () => {
    const hits = scanSource('src/ui/Z.tsx', "const a = ' // '; const b = 'Mark missing';");
    expect(hits.length).toBe(1);
    expect(hits[0]).toMatch(/^src\/ui\/Z\.tsx:1: words: Mark missing$/);
  });

  it('fails on a case after a string containing a block comment marker', () => {
    const source = ["const a = '/*';", "switch (r) { case 'NotClosed': break; }", "const b = '*/';"].join('\n');
    const hits = scanSource('src/ui/W.tsx', source);
    expect(hits.length).toBe(1);
    expect(hits[0]).toMatch(/^src\/ui\/W\.tsx:2: code: /);
  });

  it('fails on a string literal that is a NotApplicable reason words', () => {
    const hits = scanSource('src/ui/V.tsx', "const label = 'not closed yet';");
    expect(hits.length).toBe(1);
    expect(hits[0]).toMatch(/^src\/ui\/V\.tsx:1: words: not closed yet$/);
  });

  it('fails on JSX text that is a NotApplicable reason words', () => {
    const source = ['const a = (', '  <span>', '    No open position', '  </span>', ');'].join('\n');
    const hits = scanSource('src/ui/U.tsx', source);
    expect(hits.length).toBe(1);
    expect(hits[0]).toMatch(/^src\/ui\/U\.tsx:3: words: No open position$/);
  });

  it('still ignores real comments and keeps line numbers', () => {
    const source = [
      "// case 'NotClosed':",
      "/* case 'NotClosed':",
      "   Mark missing */ const s = 'x'; // Mark missing",
      "const t = `a // b`; r === 'MarkMissing';",
    ].join('\n');
    const hits = scanSource('src/ui/V.tsx', source);
    expect(hits.length).toBe(1);
    expect(hits[0]).toMatch(/^src\/ui\/V\.tsx:4: code: /);
  });

  it('still passes on a sentence that contains a reason words, and on the current tree', () => {
    const sentence = scanSource('src/ui/T.tsx', '<p>This Trade has no open Position to exit.</p>; const a = "not closed yet, so wait";');
    expect(sentence).toEqual([]);
    const files = uiSources(uiDir).filter((f) => !f.pathname.endsWith('/src/ui/calculation-words.ts'));
    expect(files.length).toBeGreaterThan(0);
    const hits = files.flatMap((f) => scanSource(f.pathname, readFileSync(f, 'utf8')));
    expect(scanSource('src/ui/screens/PositionChangeForm.tsx', readFileSync(new URL('screens/PositionChangeForm.tsx', uiDir), 'utf8'))).toEqual([]);
    expect(hits).toEqual([]);
  });
});
