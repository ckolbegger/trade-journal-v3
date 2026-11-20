import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
// @ts-expect-error Same as estimate-rules.test.ts: plain JavaScript with no declaration file.
import mergedConfig from '../eslint.config.js';

// Lints a planted source string with the merged repository configuration, keeping the entries that set the
// extension rule, and any fatal diagnostic such as a parse error.
const ruleId = 'imports/require-extension';
const linter = new Linter({ configType: 'flat' });
const config: Linter.Config[] = [
  { files: ['**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser } },
  ...(mergedConfig as Linter.Config[]).filter((entry) => entry.rules?.[ruleId] !== undefined),
];
const hits = (source: string) =>
  linter
    .verify(source, config, { filename: 'src/anything.ts' })
    .filter((m) => m.fatal === true || m.ruleId === ruleId)
    .map((m) => m.line);

describe('the relative import extension rule (retro D9B-2)', () => {
  it('should reject a relative import, re-export, or dynamic import without an extension', () => {
    for (const source of [
      "import { x } from './x';",
      "import { x } from '../x';",
      "import './x';",
      "export { x } from './x';",
      "export * from '../x';",
      "const m = await import('./x');",
      "import { a,\n  b } from '../instrument';",
    ]) {
      expect(hits(source), source).not.toEqual([]);
    }
  });

  it('should accept an import with an extension, and a package import', () => {
    for (const source of [
      "import { x } from './x.ts';",
      "import { x } from '../x.tsx';",
      "import data from './x.json';",
      "import './x.css';",
      "import { x } from './x.js';",
      "import { x } from '../instrument/index.ts';",
      "export { x } from './x.ts';",
      "const m = await import('./x.ts');",
      "import { x } from 'vitest';",
      "import { y } from '@scope/pkg/sub';",
      "import { z } from 'node:fs';",
    ]) {
      expect(hits(source), source).toEqual([]);
    }
  });

  it('should reject a type-only import without an extension', () => {
    expect(hits("import type { X } from './x';")).toEqual([1]);
    expect(hits("export type { X } from '../x';")).toEqual([1]);
  });
});
