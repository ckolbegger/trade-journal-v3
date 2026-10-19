// Purity and no-identity rules (D1 A17). Used by `npm run lint:deps` on its own and merged into
// the main ESLint configuration so `npm run lint` enforces them too.
import tseslint from 'typescript-eslint';

const identity = 'userAgent|userAgentData|platform|vendor';

export const noIdentityRules = {
  files: ['**/src/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: `MemberExpression[property.name=/^(${identity})$/]`,
        message: 'no-identity: support is decided by functional checks, never browser or OS identity.',
      },
    ],
  },
};

export const domainPurityRules = {
  files: ['**/src/domain/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: `MemberExpression[property.name=/^(${identity})$/]`,
        message: 'no-identity: support is decided by functional checks, never browser or OS identity.',
      },
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
    ],
    'no-restricted-globals': [
      'error',
      ...['indexedDB', 'localStorage', 'sessionStorage', 'caches', 'fetch', 'navigator'].map((name) => ({
        name,
        message: `domain-purity: pure analysis performs no I/O (${name}).`,
      })),
    ],
  },
};

export default [
  { files: ['**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser } },
  noIdentityRules,
  domainPurityRules,
];
