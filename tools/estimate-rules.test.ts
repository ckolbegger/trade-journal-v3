import { readdirSync, readFileSync } from 'node:fs';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error Same as cockpit-rules.test.ts: plain JavaScript with no declaration file.
import mergedConfig from '../eslint.config.js';

// Lints a planted source string with the merged repository configuration, keeping only the entries that set the
// estimates rule, and any fatal diagnostic such as a parse error (ruleId null), so an unparsed file is never clean (type-aware rules need a project service a string lacks), so a plant is never a committed file.
const ruleId = '@typescript-eslint/no-restricted-imports';
const dynamicRuleId = 'estimates/no-dynamic-import';
const ruleIds = [ruleId, dynamicRuleId];
const linter = new Linter({ configType: 'flat' });
const config: Linter.Config[] = [
  { files: ['**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser } },
  ...(mergedConfig as Linter.Config[]).filter((entry) => ruleIds.some((id) => entry.rules?.[id] !== undefined)),
];
const hits = (path: string, source: string) =>
  linter
    .verify(source, config, { filename: path })
    .filter((m) => m.fatal === true || (m.ruleId !== null && ruleIds.includes(m.ruleId)))
    .map((m) => ({ line: m.line, message: m.message }));

describe('the estimates rule (P121)', () => {
  it('should reject an import of domain/option-pricing from any file but trade-analysis/replay-estimates.ts', () => {
    const source = "import { priceOption } from '../option-pricing/index.ts';";
    for (const path of ['src/domain/trade-analysis/replay-series.ts', 'src/domain/trade-analysis/evaluate.ts', 'src/coordinators/replay/replay.ts', 'src/ui/cockpit/replay/frame.tsx', 'tools/anything.ts']) {
      const found = hits(path, source);
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toContain('estimates-rule:');
    }
    expect(hits('src/domain/trade-analysis/replay-estimates.ts', "import { priceOption } from '../option-pricing/index.ts';")).toEqual([]);
  });

  it('should reject an import of replay-estimates from any file but replay-series.ts', () => {
    for (const [path, source] of [
      ['src/domain/trade-analysis/evaluate.ts', "import { estimatesOf } from './replay-estimates.ts';"],
      ['src/coordinators/replay/replay.ts', "import { estimatesOf } from '../../domain/trade-analysis/replay-estimates.ts';"],
      ['src/ui/cockpit/replay/frame.tsx', "import type { ReplayEstimates } from '../../../domain/trade-analysis/replay-estimates.ts';"],
      ['src/domain/option-pricing/price.ts', "import { estimatesOf } from '../trade-analysis/replay-estimates.ts';"],
    ] as const) {
      const found = hits(path, source);
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toContain('estimates-rule:');
    }
    expect(hits('src/domain/trade-analysis/replay-series.ts', "import { estimatesOf } from './replay-estimates.ts';")).toEqual([]);
  });

  it('should reject parseDecimal and Rational in option-pricing and in a value replay-estimates.ts returns', () => {
    for (const source of [
      "import { parseDecimal } from '../values/index.ts';",
      "import { Rational } from '../values/index.ts';",
      "import { Rational } from '../values/rational.ts';",
      "import type { Rational } from '../values/index.ts';",
    ]) {
      const found = hits('src/domain/option-pricing/price.ts', source);
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toContain('estimates-rule:');
    }
    // replay-estimates.ts reads exact inputs as a type, but builds no exact value: no parseDecimal, no Rational value.
    for (const source of [
      "import { parseDecimal } from '../values/index.ts';",
      "import { parseDecimal } from '../values/decimal.ts';",
      "import { Rational } from '../values/index.ts';",
      "import { Rational, type ParseDecimalResult } from '../values/rational.ts';",
    ]) {
      const found = hits('src/domain/trade-analysis/replay-estimates.ts', source);
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toContain('estimates-rule:');
    }
    expect(hits('src/domain/trade-analysis/replay-estimates.ts', "import type { Rational } from '../values/index.ts';")).toEqual([]);
    expect(hits('src/domain/trade-analysis/replay-series.ts', "import { parseDecimal, Rational } from '../values/index.ts';")).toEqual([]);
  });

  it('should allow the About page to import option-pricing/assumptions.ts, which holds the two rates and the 365-day line and no formula', () => {
    const about = 'src/ui/screens/AboutView.tsx';
    expect(hits(about, "import { shortRate, longRate, rateLineDays } from '../../domain/option-pricing/assumptions.ts';")).toEqual([]);
    // Only that file: a formula, the barrel and replay-estimates stay out of the About page, and other screens get no exception.
    for (const source of ["import { priceOption } from '../../domain/option-pricing/price.ts';", "import { priceOption } from '../../domain/option-pricing/index.ts';", "import { estimatesOf } from '../../domain/trade-analysis/replay-estimates.ts';"]) {
      expect(hits(about, source)).toHaveLength(1);
    }
    expect(hits('src/ui/screens/TradeDetail.tsx', "import { shortRate } from '../../domain/option-pricing/assumptions.ts';")).toHaveLength(1);
  });

  // A computed specifier is out of scope; only a string literal is read.
  it('should reject a dynamic import of domain/option-pricing from any file but trade-analysis/replay-estimates.ts, the About page may still import() assumptions.ts only', () => {
    const source = "const m = await import('../option-pricing/price.ts');";
    for (const path of ['src/domain/trade-analysis/replay-series.ts', 'src/domain/trade-analysis/evaluate.ts', 'src/coordinators/replay/replay.ts', 'src/ui/cockpit/replay/frame.tsx', 'tools/anything.ts']) {
      const found = hits(path, source);
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toContain('estimates-rule:');
    }
    expect(hits('src/domain/trade-analysis/replay-estimates.ts', source)).toEqual([]);
    const about = 'src/ui/screens/AboutView.tsx';
    expect(hits(about, "const m = await import('../../domain/option-pricing/assumptions.ts');")).toEqual([]);
    expect(hits(about, "const m = await import('../../domain/option-pricing/price.ts');")).toHaveLength(1);
    expect(hits('src/ui/screens/TradeDetail.tsx', "const m = await import('../../domain/option-pricing/assumptions.ts');")).toHaveLength(1);
  });

  it('should reject a dynamic import of replay-estimates from any file but replay-series.ts', () => {
    for (const [path, source] of [
      ['src/domain/trade-analysis/evaluate.ts', "const m = await import('./replay-estimates.ts');"],
      ['src/coordinators/replay/replay.ts', "const m = await import('../../domain/trade-analysis/replay-estimates.ts');"],
      ['src/domain/option-pricing/price.ts', "const m = await import('../trade-analysis/replay-estimates.ts');"],
    ] as const) {
      const found = hits(path, source);
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toContain('estimates-rule:');
    }
    expect(hits('src/domain/trade-analysis/replay-series.ts', "const m = await import('./replay-estimates.ts');")).toEqual([]);
    // Other modules stay importable dynamically.
    expect(hits('src/main.tsx', "const m = await import('./App.tsx');")).toEqual([]);
  });

  it('should count a file that fails to parse as a failure, not as clean', () => {
    const found = hits('src/domain/trade-analysis/evaluate.ts', 'const = ;');
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain('Parsing error');
  });

  it('should pass every file of the current tree', () => {
    const root = join(import.meta.dirname, '..');
    const sources = ['src', 'tools', 'e2e', 'tests'].flatMap((dir) =>
      readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
        .filter((p) => /\.tsx?$/.test(p) && !p.split('/').includes('dep-fixtures') && !p.split('/').includes('node_modules'))
        .map((p) => join(root, dir, p)),
    );
    expect(sources.length).toBeGreaterThan(500);
    const found = sources.flatMap((p) => hits(relative(root, p), readFileSync(p, 'utf8')).map((h) => `${relative(root, p)}:${h.line}`));
    expect(found).toEqual([]);
  }, 10_000);
});
