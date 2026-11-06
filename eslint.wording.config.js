// The Calculation Result wording rule (D7 prefactor P74, decision 80), run by `npm run verify:wording` on its
// own and merged into the main ESLint configuration so `npm run lint` enforces it too.
// src/ui/calculation-words.ts is the only place that words a Calculation Result's reason or finding, and the
// only place that branches on a reason code. Every other non-test file under src/ui/ fails when it contains
//   (a) a reason's words: a phrase of the plan's text tables, matched case-insensitively on the decoded text of
//       a string, template or JSX text (comments are never matched); or a NotApplicable reason's words as a
//       whole string literal, template without substitutions, or JSX text node (ordinary sentences contain
//       them, so they count only when they are the whole text); or
//   (b) a `case` or an equality comparison (=== !== == !=) on a reason code, such as `case 'NotClosed':` or
//       `x.reason === 'MarkMissing'`, through any parentheses, `as`, `satisfies`, `<T>x` or `!`.
// Market Data's Expected-Mark Status (Available, Missing, AcknowledgedUnavailable) is the evidence itself and
// is compared on a `.kind` property access (optional chaining included), which (b) leaves alone.
// Test files assert the words and are exempt, as is the module itself.
import tseslint from 'typescript-eslint';
import { noIdentitySelector } from './eslint.deps.config.js';

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

// The NotApplicable reasons' words (calculation-words.ts, notApplicableTail).
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

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// An apostrophe may be straight or curly in source text.
const phraseRe = PHRASES.map((p) => escape(p).replace(/'/g, "['’]")).join('|');
const reasonRe = `^\\s*(${REASON_WORDS.map(escape).join('|')})\\s*$`;
const codeRe = `^(${CODES.join('|')})$`;
// `as`, `satisfies`, `<T>x` and `x!` wrap their operand in `.expression`; ESTree has no parenthesis nodes.
// Up to three wrappers are looked through.
const wrapperPaths = (side) => [0, 1, 2, 3].map((depth) => `${side}${'.expression'.repeat(depth)}`);

const message = (what) => `verify:wording: ${what}. Word it through src/ui/calculation-words.ts, the only place that words a Calculation Result or branches on its reason code.`;
const wordsMessage = message("this is a reason's or finding's words");
const codeMessage = message('this branches on a reason code');

// A code literal at `path`: a string literal, or a template without substitutions.
const codeAt = (path) => [`[${path}.value=/${codeRe}/]`, `[${path}.expressions.length=0][${path}.quasis.0.value.cooked=/${codeRe}/]`];
// A `.kind` property access: not a computed member such as `result[kind]`. An optional chain (`status?.kind`) is a
// ChainExpression around the member and counts as no wrapper level, so the member is also looked for one level
// further in when the node at that path is a chain.
const kindAt = (p) => `[${p}.property.name="kind"][${p}.computed=false]`;
const notKind = (side) =>
  wrapperPaths(side)
    .flatMap((p) => [kindAt(p), `[${p}.type="ChainExpression"]${kindAt(`${p}.expression`)}`])
    .map((c) => `:not(${c})`)
    .join('');

const equality = '[operator=/^[!=]==?$/]';
const selectors = [
  [`Literal[value=/${phraseRe}/i]`, wordsMessage],
  [`TemplateElement[value.cooked=/${phraseRe}/i]`, wordsMessage],
  [`JSXText[value=/${phraseRe}/i]`, wordsMessage],
  [`Literal[value=/${reasonRe}/i]`, wordsMessage],
  [`TemplateLiteral[expressions.length=0] > TemplateElement[value.cooked=/${reasonRe}/i]`, wordsMessage],
  [`JSXText[value=/${reasonRe}/i]`, wordsMessage],
  ...wrapperPaths('test').flatMap((p) => codeAt(p).map((c) => [`SwitchCase${c}`, codeMessage])),
  ...wrapperPaths('right').flatMap((p) => codeAt(p).map((c) => [`BinaryExpression${equality}${c}${notKind('left')}`, codeMessage])),
  ...wrapperPaths('left').flatMap((p) => codeAt(p).map((c) => [`BinaryExpression${equality}${c}${notKind('right')}`, codeMessage])),
];

export const wordingRules = {
  files: ['src/ui/**/*.{ts,tsx}'],
  ignores: ['src/ui/calculation-words.ts', '**/*.test.{ts,tsx}'],
  rules: {
    // Repeats the no-identity selector: this entry's options replace noIdentityRules' for these files.
    'no-restricted-syntax': ['error', noIdentitySelector, ...selectors.map(([selector, msg]) => ({ selector, message: msg }))],
  },
};

export default [{ files: ['**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser } }, wordingRules];
