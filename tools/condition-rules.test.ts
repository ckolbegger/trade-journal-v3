import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
// @ts-expect-error The configuration is plain JavaScript (as eslint.deps.config.js is), with no declaration file.
import { conditionIndexSelectors } from '../eslint.conditions.config.js';
// @ts-expect-error Same: plain JavaScript with no declaration file.
import mergedConfig from '../eslint.config.js';

// Lints a planted source string with the merged repository configuration, so a plant is never a committed file.
// Only the entries that set no-restricted-syntax are kept (type-aware rules need a project service a string lacks),
// in their order, so the test sees how they replace one another.
const linter = new Linter({ configType: 'flat' });
const config: Linter.Config[] = [
  { files: ['**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser } },
  ...(mergedConfig as Linter.Config[]).filter((entry) => entry.rules?.['no-restricted-syntax'] !== undefined),
];
const hits = (path: string, source: string) =>
  linter
    .verify(source, config, { filename: path })
    .filter((m) => m.ruleId === 'no-restricted-syntax')
    .map((m) => ({ line: m.line, message: m.message }));
const message = (conditionIndexSelectors as { message: string }[])[0]?.message;

describe('condition-index rule in the merged lint configuration', () => {
  it.each(['plan.stops[0]', 'x.targets[0]', 'baseline.stopBasis[0]', 'b.targetBasis[1]'])('flags %s in a non-test src file', (expr) => {
    expect(hits('src/coordinators/X.ts', `const a = ${expr};`)).toEqual([{ line: 1, message }]);
  });

  it('flags the same plant in a src/ui file and a src/domain file', () => {
    expect(hits('src/ui/X.tsx', 'const a = plan.stops[0];').map((h) => h.message)).toEqual([message]);
    expect(hits('src/domain/trade-analysis/X.ts', 'const a = plan.stops[0];').map((h) => h.message)).toEqual([message]);
    expect(hits('src/domain/instrument/X.ts', 'const a = plan.stops[0];').map((h) => h.message)).toEqual([message]);
  });

  it('passes on a computed non-literal index', () => {
    expect(hits('src/ui/screens/X.tsx', 'const a = basis.stopBasis[i];')).toEqual([]);
  });

  it('passes in a test file and under tools/', () => {
    expect(hits('src/domain/X.test.ts', 'const a = plan.stops[0];')).toEqual([]);
    expect(hits('src/ui/X.test.tsx', 'const a = plan.stops[0];')).toEqual([]);
    expect(hits('tools/X.ts', 'const a = plan.stops[0];')).toEqual([]);
  });

  it('keeps the expiration comparison hit beside the condition hit in src/ui', () => {
    const found = hits('src/ui/X.tsx', ['const a = plan.stops[0];', 'const b = today < t.expiration;'].join('\n'));
    expect(found.map((h) => h.line)).toEqual([1, 2]);
    expect(found[1]?.message).toMatch(/^expiration-comparison:/);
  });

  it('keeps the wording hit beside the condition hit in src/ui', () => {
    const found = hits('src/ui/X.tsx', ['const a = plan.stops[0];', "const label = 'not closed yet';"].join('\n'));
    expect(found.map((h) => h.line)).toEqual([1, 2]);
    expect(found[1]?.message).toMatch(/^verify:wording:/);
  });

  it('keeps the purity hit beside the condition hit in src/domain', () => {
    const found = hits('src/domain/X.ts', ['const a = plan.stops[0];', 'const b = Date.now();'].join('\n'));
    expect(found.map((h) => h.line)).toEqual([1, 2]);
    expect(found[1]?.message).toMatch(/^domain-purity:/);
  });
});
