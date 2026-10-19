import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import { domainPurityRules, noIdentityRules } from './eslint.deps.config.js';

export default defineConfig(
  globalIgnores(['dist', 'dist-*', 'coverage', 'test-results', 'playwright-report', 'tools/dep-fixtures']),
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
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
