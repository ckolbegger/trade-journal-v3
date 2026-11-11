// Purity and no-identity rules (D1 A17). Used by `npm run lint:deps` on its own and merged into
// the main ESLint configuration so `npm run lint` enforces them too.
import tseslint from 'typescript-eslint';

const identity = 'userAgent|userAgentData|platform|vendor';

// ESLint replaces a rule's options when a later config entry sets the rule again, so every entry that sets
// no-restricted-syntax for files under src/ repeats this selector.
export const noIdentitySelector = {
  selector: `MemberExpression[property.name=/^(${identity})$/]`,
  message: 'no-identity: support is decided by functional checks, never browser or OS identity.',
};

// P82: a relational comparison with an .expiration member on one side and anything else on the other is the
// expiration rule written by hand. A comparison of two expirations (a sort) passes.
const relational = 'BinaryExpression[operator=/^(<|<=|>|>=)$/]';
const expirationMessage =
  'expiration-comparison: ask the instrument module (expiredOn, settlementDueOn in src/domain/instrument/), never compare a date with .expiration.';
// An operand wrapped in as, !, satisfies, <T> or ?. is still that operand: TSAsExpression, TSNonNullExpression,
// TSSatisfiesExpression, TSTypeAssertion and ChainExpression all hold it in .expression (the same looking-through
// as wrapperPaths in eslint.wording.config.js). Up to three wrappers deep.
// The member is x.expiration (not computed, identifier) or x['expiration'] (computed, string literal); a computed
// key that is a variable named expiration (dates[expiration]) is neither.
const isExpiration = (side) =>
  `:matches(${[0, 1, 2, 3]
    .flatMap((depth) => {
      const member = `${side}${'.expression'.repeat(depth)}`;
      return [`[${member}.computed=false][${member}.property.name='expiration']`, `[${member}.computed=true][${member}.property.value='expiration']`];
    })
    .join(', ')})`;
export const expirationComparisonSelectors = [
  {
    selector: `${relational}${isExpiration('left')}:not(${isExpiration('right')})`,
    message: expirationMessage,
  },
  {
    selector: `${relational}${isExpiration('right')}:not(${isExpiration('left')})`,
    message: expirationMessage,
  },
];

const domainPuritySelectors = [
  {
    selector: "MemberExpression[object.name='Date'][property.name='now']",
    message: 'domain-purity: read time from an injected clock, never Date.now.',
  },
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'domain-purity: read time from an injected clock, never new Date().',
  },
  {
    selector: "MemberExpression[object.name='Math'][property.name='random']",
    message: 'domain-purity: no randomness in pure analysis.',
  },
  {
    selector: "MemberExpression[object.name='Temporal'][property.name='Now']",
    message: 'domain-purity: read time from an injected clock, never Temporal.Now.',
  },
  {
    selector: "MemberExpression[property.name='randomUUID']",
    message: 'domain-purity: identities are injected, never generated in pure analysis.',
  },
];

const domainPurityGlobals = {
  'no-restricted-globals': [
    'error',
    ...['indexedDB', 'localStorage', 'sessionStorage', 'caches', 'fetch', 'navigator'].map((name) => ({
      name,
      message: `domain-purity: pure analysis performs no I/O (${name}).`,
    })),
  ],
};

export const noIdentityRules = {
  files: ['**/src/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-syntax': ['error', noIdentitySelector, ...expirationComparisonSelectors],
  },
};

export const domainPurityRules = {
  files: ['**/src/domain/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-syntax': ['error', noIdentitySelector, ...expirationComparisonSelectors, ...domainPuritySelectors],
    ...domainPurityGlobals,
  },
};

// The expiration rule's exemptions (P82): test files, and src/domain/instrument/ where the rule lives. Domain
// files among them keep the purity rules.
export const expirationExemptRules = [
  {
    files: ['**/src/**/*.test.{ts,tsx}'],
    ignores: ['**/src/domain/**'],
    rules: { 'no-restricted-syntax': ['error', noIdentitySelector] },
  },
  {
    files: ['**/src/domain/instrument/**/*.{ts,tsx}', '**/src/domain/**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', noIdentitySelector, ...domainPuritySelectors], ...domainPurityGlobals },
  },
];

export default [
  { files: ['**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser } },
  noIdentityRules,
  domainPurityRules,
  ...expirationExemptRules,
];
