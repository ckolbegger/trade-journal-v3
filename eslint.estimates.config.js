import tseslint from 'typescript-eslint';

// D9 P121: estimates live in a floating-point module, src/domain/option-pricing/, read by one file,
// src/domain/trade-analysis/replay-estimates.ts, which only replay-series.ts reads. This rule is its own
// rule name (the typescript-eslint one), so the cockpit's no-restricted-imports entry never replaces it.
// Entries that set a rule replace each other's options where files overlap, so the file groups below do not overlap.
const message = (what) => `estimates-rule: ${what} (P121); estimates stay apart from the exact figures.`;

const optionPricing = {
  group: ['**/option-pricing', '**/option-pricing/**'],
  message: message('option-pricing is read only by trade-analysis/replay-estimates.ts'),
};
const replayEstimates = {
  group: ['**/replay-estimates', '**/replay-estimates.ts'],
  message: message('replay-estimates is read only by replay-series.ts'),
};

const exactGroup = ['**/values', '**/values/**'];
const exactIn = (what) => message(`${what} builds no exact value (no parseDecimal, no Rational); an Estimate holds a plain number`);
// The pricing module imports nothing from the exact values, not even as a type.
const noExactValues = { group: exactGroup, message: exactIn('option-pricing') };
// replay-estimates.ts reads exact inputs as a type, and builds no exact value.
const noExactBuilt = [
  { group: exactGroup, importNames: ['parseDecimal'], message: exactIn('replay-estimates') },
  { group: exactGroup, importNames: ['Rational'], allowTypeImports: true, message: exactIn('replay-estimates') },
];

// The About page (T9.24) states the two rates and the 365-day line, so it reads assumptions.ts and nothing else.
const aboutFile = '**/src/ui/screens/AboutView.tsx';
const optionPricingButAssumptions = [{ regex: '/option-pricing(/(?!assumptions(\\.ts)?$).*)?$', message: optionPricing.message }];

const pricingFiles = '**/src/domain/option-pricing/**';
const estimatesFiles = ['**/src/domain/trade-analysis/replay-estimates.ts', '**/src/domain/trade-analysis/replay-estimates.test.ts'];
const seriesFiles = ['**/src/domain/trade-analysis/replay-series.ts', '**/src/domain/trade-analysis/replay-series.test.ts'];

const entry = (files, ignores, patterns) => ({
  files,
  ignores,
  plugins: { '@typescript-eslint': tseslint.plugin },
  rules: { '@typescript-eslint/no-restricted-imports': ['error', { patterns }] },
});
const any = ['**/*.{ts,tsx}'];

export const estimatesImportRules = [
  // Every other file reads neither.
  entry(any, [pricingFiles, ...estimatesFiles, ...seriesFiles, aboutFile], [optionPricing, replayEstimates]),
  entry([aboutFile], [], [...optionPricingButAssumptions, replayEstimates]),
  // The pricing module reads no estimates file.
  entry([pricingFiles], [], [replayEstimates, noExactValues]),
  // replay-estimates.ts reads the pricing module, and builds no exact value.
  entry(['**/src/domain/trade-analysis/replay-estimates.ts'], [], noExactBuilt),
  // replay-series.ts reads replay-estimates.ts, and no pricing.
  entry(seriesFiles, [], [optionPricing]),
];
