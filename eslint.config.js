import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import { cockpitImportRules } from './eslint.cockpit.config.js';
import { conditionIndexSelectors } from './eslint.conditions.config.js';
import { domainPurityRules, expirationComparisonSelectors, expirationExemptRules, noIdentityRules } from './eslint.deps.config.js';
import { wordingRules } from './eslint.wording.config.js';

// wordingRules sets no-restricted-syntax for non-test src/ui files, which replaces the options of the entries
// above, so the expiration (P82) and condition-index selectors are repeated here after its identity and wording selectors.
const wordingWithExpirationRules = {
  ...wordingRules,
  rules: {
    'no-restricted-syntax': ['error', ...wordingRules.rules['no-restricted-syntax'].slice(1), ...expirationComparisonSelectors, ...conditionIndexSelectors],
  },
};

export default defineConfig(
  globalIgnores(['dist', 'dist-*', 'coverage', 'test-results', 'playwright-report', 'tools/dep-fixtures', '.claude/worktrees/**']),
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  reactHooks.configs.flat.recommended,
  noIdentityRules,
  domainPurityRules,
  ...expirationExemptRules,
  wordingWithExpirationRules,
  cockpitImportRules,
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
