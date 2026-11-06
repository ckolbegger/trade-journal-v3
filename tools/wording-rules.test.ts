import { readdirSync, readFileSync } from 'node:fs';
import { ESLint, Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
// @ts-expect-error The configuration is plain JavaScript (as eslint.deps.config.js is), with no declaration file.
import wordingConfig from '../eslint.wording.config.js';

const linter = new Linter({ configType: 'flat' });
// Every hit as { line, message }: the start line of the hit node, and the rule's message.
const scanSource = (path: string, source: string) => {
  const messages = linter.verify(source, wordingConfig as Linter.Config[], { filename: path });
  expect(messages.filter((m) => m.fatal)).toEqual([]);
  return messages.map((m) => ({ line: m.line, message: m.message }));
};
const lines = (hits: { line: number }[]) => hits.map((h) => h.line);

const uiDir = new URL('../src/ui/', import.meta.url);
const uiSources = (dir: URL): URL[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const child = new URL(e.name + (e.isDirectory() ? '/' : ''), dir);
    return e.isDirectory() ? uiSources(child) : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [child] : [];
  });

describe('verify:wording rules', () => {
  it('fails on a comparison whose operator and code literal are on consecutive lines', () => {
    const source = ['const a = 1;', 'const b = result.reason ===', "  'MarkMissing';"].join('\n');
    const hits = scanSource('src/ui/X.tsx', source);
    // The hit is the comparison, which starts on line 2 (the scanner reported the literal's line, 3).
    expect(lines(hits)).toEqual([2]);
    expect(hits[0]?.message).toMatch(/^verify:wording: .*src\/ui\/calculation-words\.ts/);
  });

  it('fails on a case whose code literal is on the line after case', () => {
    const source = ['switch (r) {', '  case', "    'NotClosed':", '    break;', '}'].join('\n');
    expect(lines(scanSource('src/ui/Y.tsx', source))).toEqual([2]);
  });

  it('fails on a phrase after a string containing a line comment marker', () => {
    expect(lines(scanSource('src/ui/Z.tsx', "const a = ' // '; const b = 'Mark missing';"))).toEqual([1]);
  });

  it('fails on a case after a string containing a block comment marker', () => {
    const source = ["const a = '/*';", "switch (r) { case 'NotClosed': break; }", "const b = '*/';"].join('\n');
    expect(lines(scanSource('src/ui/W.tsx', source))).toEqual([2]);
  });

  it('fails on a string literal that is a NotApplicable reason words', () => {
    expect(lines(scanSource('src/ui/V.tsx', "const label = 'not closed yet';"))).toEqual([1]);
  });

  it('fails on JSX text that is a NotApplicable reason words', () => {
    const source = ['const a = (', '  <span>', '    No open position', '  </span>', ');'].join('\n');
    // A JSX text node starts right after the tag, on line 2 (the scanner reported the words' line, 3).
    expect(lines(scanSource('src/ui/U.tsx', source))).toEqual([2]);
  });

  it('still ignores real comments and keeps line numbers', () => {
    const source = [
      "// case 'NotClosed':",
      "/* case 'NotClosed':",
      "   Mark missing */ const s = 'x'; // Mark missing",
      "const t = `a // b`; r === 'MarkMissing';",
    ].join('\n');
    expect(lines(scanSource('src/ui/V.tsx', source))).toEqual([4]);
  });

  it('passes on a code-first comparison whose operand wraps before .kind', () => {
    expect(scanSource('src/ui/K.tsx', ["const a = 'AcknowledgedUnavailable' === status", '  .kind;'].join('\n'))).toEqual([]);
  });

  it('passes on a code-first comparison whose operand wraps before optional chaining kind', () => {
    expect(scanSource('src/ui/K.tsx', ["const a = 'AcknowledgedUnavailable' === status", '  ?.kind;'].join('\n'))).toEqual([]);
  });

  it('still fails on a code-first comparison whose operand wraps before reason', () => {
    const hits = scanSource('src/ui/K.tsx', ["const a = 'AcknowledgedUnavailable' === result", '  .reason;'].join('\n'));
    expect(lines(hits)).toEqual([1]);
  });

  it('passes on a comment inside a template substitution', () => {
    expect(scanSource('src/ui/B5.tsx', '`${1 /* Mark missing */}`;')).toEqual([]);
  });

  it('still fails on a phrase in a template literal with a substitution', () => {
    expect(lines(scanSource('src/ui/B5.tsx', '`Mark missing ${x}`;'))).toEqual([1]);
  });

  it('passes on a trailing comment after JSX text with an apostrophe', () => {
    expect(scanSource('src/ui/B6.tsx', "const a = <span>Don't</span>; // Mark missing")).toEqual([]);
  });

  it('still fails on a phrase in an expression after JSX text with an apostrophe', () => {
    expect(lines(scanSource('src/ui/B6.tsx', "const a = <span>Don't</span>;\nconst b = <i>{'Mark missing'}</i>;"))).toEqual([2]);
  });

  it('fails on a code literal after a CRLF line continuation inside a string followed by comment text', () => {
    const source = "const a = 'x\\\r\ny'; // note\r\nswitch (r) { case 'NotClosed': break; }\r\n";
    expect(lines(scanSource('src/ui/B7.tsx', source))).toEqual([3]);
  });

  it('fails on reason words next to a JSX expression', () => {
    expect(lines(scanSource('src/ui/B8.tsx', '<p>{icon}No open position</p>'))).toEqual([1]);
    expect(lines(scanSource('src/ui/B8.tsx', '<p>Not closed yet{icon}</p>'))).toEqual([1]);
  });

  it('fails on the NoOptionExpirationAnchor words as a whole string and on its code in a comparison', () => {
    expect(lines(scanSource('src/ui/B11.tsx', "const label = 'no option expiration';"))).toEqual([1]);
    expect(lines(scanSource('src/ui/B11.tsx', "if (x.reason === 'NoOptionExpirationAnchor') {}"))).toEqual([1]);
  });

  it('fails on the AfterExpiration and ContractQuantityNotWhole finding words and codes', () => {
    expect(lines(scanSource('src/ui/B13.tsx', "const a = 1;\nconst b = ' is dated after the contract’s expiration';"))).toEqual([2]);
    expect(lines(scanSource('src/ui/B13.tsx', "const b = \" isn't a whole number of contracts\";"))).toEqual([1]);
    expect(lines(scanSource('src/ui/B13.tsx', "if (f.reason === 'AfterExpiration') {}"))).toEqual([1]);
    expect(lines(scanSource('src/ui/B13.tsx', "switch (f.reason) {\n  case 'ContractQuantityNotWhole': break;\n}"))).toEqual([2]);
  });

  it('fails on the SettlementDue words at each length and on its code', () => {
    expect(lines(scanSource('src/ui/B15.tsx', "const label = 'Settlement due';"))).toEqual([1]);
    expect(lines(scanSource('src/ui/B15.tsx', "const a = 1;\nconst figure = 'Settlement due: XYZ 20 Nov 2026 55 Call';"))).toEqual([2]);
    expect(lines(scanSource('src/ui/B15.tsx', "const s = 'Settlement due for XYZ 20 Nov 2026 55 Call, which expired Fri Nov 20';"))).toEqual([1]);
    expect(lines(scanSource('src/ui/B15.tsx', "const s = 'The contract, which expired Fri Nov 20';"))).toEqual([1]);
    expect(lines(scanSource('src/ui/B15.tsx', "if (x.reason === 'SettlementDue') {}"))).toEqual([1]);
    expect(lines(scanSource('src/ui/B15.tsx', "switch (x.reason) {\n  case 'SettlementDue': break;\n}"))).toEqual([2]);
  });

  it('fails on the Expiration finding words and codes', () => {
    expect(lines(scanSource('src/ui/B14.tsx', "const a = 1;\nconst b = ' doesn’t settle all 2 contracts open';"))).toEqual([2]);
    expect(lines(scanSource('src/ui/B14.tsx', "const b = ' is dated after the contract’s expiration or before an Execution on it';"))).toEqual([1]);
    expect(lines(scanSource('src/ui/B14.tsx', "const b = 'Expiration of 100 XYZ at now names a stock, not an option';"))).toEqual([1]);
    expect(lines(scanSource('src/ui/B14.tsx', "if (f.reason === 'ExpirationMustSettleAllOpen') {}"))).toEqual([1]);
    expect(lines(scanSource('src/ui/B14.tsx', "switch (f.reason) {\n  case 'SettlementTimeInvalid': break;\n}"))).toEqual([2]);
    expect(lines(scanSource('src/ui/B14.tsx', "if (f.reason !== 'NotAnOption') {}"))).toEqual([1]);
  });

  it('passes on a reason quoted inside a longer string', () => {
    expect(scanSource('src/ui/B9.tsx', `const a = "The label 'not closed yet' means the Trade is open";`)).toEqual([]);
  });

  it('fails on a code literal wrapped in as const in a comparison', () => {
    expect(lines(scanSource('src/ui/B10.tsx', "if (x === ('MarkMissing' as const)) {}"))).toEqual([1]);
  });

  it('fails on a parenthesized code literal in a case clause', () => {
    expect(lines(scanSource('src/ui/B10.tsx', "switch (r) { case ('NotClosed'): break; }"))).toEqual([1]);
  });

  it('fails on a code literal with satisfies in a comparison', () => {
    expect(lines(scanSource('src/ui/B10.tsx', "if (('AwaitingClose' satisfies string) === x) {}"))).toEqual([1]);
  });

  it('still passes on a wrapped code literal compared with a kind access', () => {
    expect(scanSource('src/ui/B10.tsx', "if (('AcknowledgedUnavailable' as const) === status.kind) {}")).toEqual([]);
    expect(scanSource('src/ui/B10.tsx', "if (('AcknowledgedUnavailable' as const) === (status!.kind as string)) {}")).toEqual([]);
  });

  it('fails on a phrase spelled with an escape in a string', () => {
    expect(lines(scanSource('src/ui/B11.tsx', "const a = 'Mark\\x20missing';"))).toEqual([1]);
  });

  it('fails on a phrase spelled with an escape in a template literal', () => {
    expect(lines(scanSource('src/ui/B11.tsx', 'const a = `Awaiting\\x20the close`;'))).toEqual([1]);
  });

  it('still reports the hit at the literal line', () => {
    expect(lines(scanSource('src/ui/B11.tsx', "const a = 1;\nconst b = 'x';\nconst c = `y ${z} Mark\\x20missing`;"))).toEqual([3]);
  });

  it('reports a phrase on line 2 of a multi-line template at the line where the template starts', () => {
    expect(lines(scanSource('src/ui/B12.tsx', 'const a = `x\\x20y\nMark missing`;'))).toEqual([1]);
    // Without an escape the offset into the text is exact, yet the hit still names the line where the template starts.
    expect(lines(scanSource('src/ui/B12.tsx', 'const a = `x y\nab Mark missing`;'))).toEqual([1]);
  });

  it('reports a single-line literal hit at its own line', () => {
    expect(lines(scanSource('src/ui/B12.tsx', "const a = 1;\nconst b = 'Mark missing';"))).toEqual([2]);
  });

  it('still passes on a sentence that contains a reason words, and on the current tree', () => {
    expect(scanSource('src/ui/T.tsx', '<p>This Trade has no open Position to exit.</p>; const a = "not closed yet, so wait";')).toEqual([]);
    const files = uiSources(uiDir).filter((f) => !f.pathname.endsWith('/src/ui/calculation-words.ts'));
    expect(files.length).toBeGreaterThan(0);
    const hits = files.flatMap((f) => scanSource(`src/ui/${f.pathname.split('/src/ui/')[1]!}`, readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('fails on a reason code compared with a computed member named kind but passes on the kind property', () => {
    expect(lines(scanSource('src/ui/K2.tsx', "if (result[kind] === 'MarkMissing') {}"))).toEqual([1]);
    expect(lines(scanSource('src/ui/K2.tsx', "if ('MarkMissing' === result[kind]) {}"))).toEqual([1]);
    expect(scanSource('src/ui/K2.tsx', "if (status.kind === 'AcknowledgedUnavailable') {}")).toEqual([]);
  });

  it('passes on a kind comparison whose chain, as, satisfies and non-null wrappers use the three levels', () => {
    expect(scanSource('src/ui/K3.tsx', "if (((status?.kind as string) satisfies string)! === 'AcknowledgedUnavailable') {}")).toEqual([]);
    expect(scanSource('src/ui/K3.tsx', "if ('AcknowledgedUnavailable' === ((status?.kind as string) satisfies string)!) {}")).toEqual([]);
  });

  // The merged main configuration, run on existing files' paths with other text (type-aware parsing needs a real path).
  const mainEslint = new ESLint({ cwd: new URL('..', import.meta.url).pathname });
  const lintMain = async (path: string, source: string) => (await mainEslint.lintText(source, { filePath: path }))[0]!.messages;
  const uiPath = 'src/ui/Badge.tsx';

  it('reports navigator.userAgent in a non-test src/ui file through the merged main config', async () => {
    const messages = await lintMain(uiPath, 'export const a = navigator.userAgent;');
    expect(messages.map((m) => m.message)).toEqual([expect.stringMatching(/^no-identity:/)]);
  });

  it('still reports a wording violation in a src/ui file that also uses the identity ban', async () => {
    const messages = await lintMain(uiPath, "export const a = navigator.userAgent;\nexport const b = 'Mark missing';");
    expect(messages.map((m) => [m.line, m.message.split(':')[0]])).toEqual([[1, 'no-identity'], [2, 'verify']]);
  });

  it('applies only the identity rule in a src file outside src/ui and src/domain', async () => {
    const messages = await lintMain('src/main.tsx', "export const a = navigator.platform;\nexport const b = 'Mark missing';");
    expect(messages.map((m) => [m.line, m.message.split(':')[0]])).toEqual([[1, 'no-identity']]);
  });

  it('keeps the domain purity and identity rules in src/domain and adds no wording rule', async () => {
    const messages = await lintMain('src/domain/daily-trade-review-prompts.ts', "export const a = navigator.platform;\nexport const b = 'Mark missing';\nexport const c = Date.now();");
    expect(messages.map((m) => [m.line, /no-identity|domain-purity|verify:wording/.exec(m.message)?.[0]])).toEqual([
      [1, 'domain-purity'],
      [1, 'no-identity'],
      [3, 'domain-purity'],
    ]);
  });
});
