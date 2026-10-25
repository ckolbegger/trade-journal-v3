import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default defineConfig(
  { ignores: ['.cache/**', 'dist/**', 'node_modules/**', 'coverage/**', 'implementation/evidence/**', 'playwright-report/**', 'test-results/**'] },
  { files: ['**/*.{js,mjs}'], extends: [js.configs.recommended], languageOptions: { globals: globals.node } },
  { files: ['**/*.{ts,tsx,mts,cts}'], extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked], languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
  { files: ['src/**/*.{ts,tsx}'], languageOptions: { globals: globals.browser } },
  { files: ['worker/**/*.ts'], languageOptions: { globals: globals.serviceworker } },
  { files: ['*.config.ts', 'tools/**/*.ts', 'tests/**/*.ts', 'tests/**/*.tsx'], languageOptions: { globals: globals.node } },
);
