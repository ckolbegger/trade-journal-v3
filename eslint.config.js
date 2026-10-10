import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'test-results', 'playwright-report', 'coverage'] },

  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },

  // Import boundaries (implementation-plan.md §2): dependency direction is
  // ui → modules → domain. Each override below restricts one layer. Patterns
  // cover both bare-directory imports (`../modules/x`) and deep/barrel forms
  // (`../modules/x/y`, `@/modules/x`).
  {
    // domain is pure: imports nothing from modules or ui
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/modules', '**/modules/**', '**/ui', '**/ui/**'],
              message:
                'domain must not import from modules or ui (plan §2: ui → modules → domain)',
            },
          ],
        },
      ],
    },
  },
  {
    // modules never import upward into ui
    files: ['src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/ui', '**/ui/**'],
              message:
                'modules must not import from ui (plan §2: ui → modules → domain)',
            },
          ],
        },
      ],
    },
  },
  {
    // fact modules never import coordinators
    files: [
      'src/modules/referenceCatalog/**/*.ts',
      'src/modules/journal/**/*.ts',
      'src/modules/marketData/**/*.ts',
      'src/modules/tradeRecord/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/tradeWorkflows',
                '**/tradeWorkflows/**',
                '**/dailyReview',
                '**/dailyReview/**',
                '**/tradeViews',
                '**/tradeViews/**',
                '**/workspace',
                '**/workspace/**',
              ],
              message: 'fact modules never import coordinators (plan §2)',
            },
          ],
        },
      ],
    },
  },
  {
    // ui calls module facades and domain types only: never the internal
    // seams (tradeRecord, persistence) and never Trade Analysis directly
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/tradeRecord',
                '**/tradeRecord/**',
                '**/persistence',
                '**/persistence/**',
                '**/domain/tradeAnalysis',
                '**/domain/tradeAnalysis/**',
              ],
              message:
                'ui imports module facades and domain types only — never tradeRecord, persistence, or Trade Analysis directly (plan §2)',
            },
          ],
        },
      ],
    },
  },
)
