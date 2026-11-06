// The scanning half of `npm run verify:wording` (see verify-wording.ts for what the check enforces): the
// phrase and code lists, and a pure function from one file's text to its hits. The text is read with the
// TypeScript parser, so what is a string, a template, JSX text or a comment is the compiler's call.
import ts from 'typescript';

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

// The NotApplicable reasons' words (calculation-words.ts, notApplicableTail). Ordinary sentences contain them
// ("This Trade has no open Position to exit."), so they count only as a whole string literal or JSX text node.
export const REASON_WORDS = [
  'no open position',
  'not closed yet',
  'entry not resolved yet',
  'no risk to the Stop',
  'entry at or beyond the Stop',
  'entry at or beyond the Target',
  'no risk at entry',
  'no reward at entry',
];
// An apostrophe may be straight or curly in source text.
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phraseRe = new RegExp(PHRASES.map((p) => escape(p).replace(/'/g, "['’]")).join('|'), 'gi');
const reasonWords = new Set(REASON_WORDS.map((w) => w.toLowerCase()));
const codes = new Set(CODES);
const equalityOperators = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

const isStringLike = (n: ts.Node): n is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
// Parentheses, `as`, `satisfies`, `<T>x` and `x!` do not change which value a node is.
const unwrap = (n: ts.Node): ts.Node =>
  ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isTypeAssertionExpression(n) || ts.isNonNullExpression(n)
    ? unwrap(n.expression)
    : n;
const isCode = (n: ts.Node) => {
  const u = unwrap(n);
  return isStringLike(u) && codes.has(u.text);
};
// A comparison on Market Data's Expected-Mark Status reads `.kind`; that is a status, not a reason.
const isKindAccess = (n: ts.Node) => {
  const u = unwrap(n);
  return ts.isPropertyAccessExpression(u) && u.name.text === 'kind';
};
const squash = (s: string) => s.replace(/\s*\n\s*/g, ' ');

// Each hit as `path:line: kind: match`.
export function scanSource(path: string, source: string): string[] {
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: { line: number; kind: string; match: string }[] = [];
  const lineAt = (offset: number) => sf.getLineAndCharacterOfPosition(offset).line + 1;
  const hit = (offset: number, kind: string, match: string) => found.push({ line: lineAt(offset), kind, match: squash(match) });

  const visit = (node: ts.Node): void => {
    const start = node.getStart(sf);
    if (
      isStringLike(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      node.kind === ts.SyntaxKind.JsxText
    ) {
      const raw = node.getText(sf);
      // Phrases are matched on the decoded text, so an escape inside a phrase does not hide it; JSX text has no escapes.
      const decoded = node.kind === ts.SyntaxKind.JsxText ? raw : (node as ts.StringLiteral | ts.TemplateLiteralLikeNode).text;
      for (const m of decoded.matchAll(phraseRe)) hit(start, 'words', m[0]);
      // Reason words count only as the whole literal or the whole JSX text node.
      const whole = node.kind === ts.SyntaxKind.JsxText || isStringLike(node) ? (isStringLike(node) ? node.text : raw).trim() : '';
      if (reasonWords.has(whole.toLowerCase())) hit(start + Math.max(raw.indexOf(whole), 0), 'words', whole);
    } else if (ts.isCaseClause(node) && isCode(node.expression)) {
      hit(node.expression.getStart(sf), 'code', node.getText(sf).slice(0, node.expression.getEnd() - start));
    } else if (ts.isBinaryExpression(node) && equalityOperators.has(node.operatorToken.kind)) {
      const { left, right } = node;
      const literal = isCode(left) ? left : isCode(right) ? right : undefined;
      const other = literal === left ? right : left;
      if (literal && !isKindAccess(other)) hit(literal.getStart(sf), 'code', node.getText(sf));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  // Source order is traversal order, so the stable sort keeps hits of one line in the order they were found.
  return found.sort((a, b) => a.line - b.line).map((h) => `${path}:${h.line}: ${h.kind}: ${h.match}`);
}
