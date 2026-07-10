import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

export default tseslint.config([
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results'] },
  {
    files: ['**/*.{js,ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // --- Module boundary rules (docs/plan/README.md dependency rules) ---
  // Cross-module imports use the '@/…' alias; intra-module imports stay relative.
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/*', '@/**'],
              message: 'domain (incl. trademath) imports nothing from src/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/books/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/coordinators', '@/coordinators/**', '@/ui', '@/ui/**'],
              message: 'Books may not import coordinators or ui.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/storage', '@/storage/**', '@/domain/trademath', '@/domain/trademath/**'],
              message: 'UI may not import storage or trademath internals.',
            },
          ],
        },
      ],
    },
  },
  prettier,
])
