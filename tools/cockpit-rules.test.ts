import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
// @ts-expect-error Same as condition-rules.test.ts: plain JavaScript with no declaration file.
import mergedConfig from '../eslint.config.js';

// Lints a planted source string with the merged repository configuration, keeping only the entries that set
// no-restricted-imports (type-aware rules need a project service a string lacks), so a plant is never a committed file.
const linter = new Linter({ configType: 'flat' });
const config: Linter.Config[] = [
  { files: ['**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser } },
  ...(mergedConfig as Linter.Config[]).filter((entry) => entry.rules?.['no-restricted-imports'] !== undefined),
];
const hits = (path: string, source: string) =>
  linter
    .verify(source, config, { filename: path })
    .filter((m) => m.ruleId === 'no-restricted-imports')
    .map((m) => ({ line: m.line, message: m.message }));

describe('cockpit import rule (A216) in the merged lint configuration', () => {
  it.each([
    "import type { TradeDetailView } from '../../app/types.ts';",
    "import type { ConditionStatus } from '../../../app/types';",
    "import { createTradeViews } from '../../coordinators/trade-views/index.ts';",
    "import type { OpenTradeDetail } from '../../../coordinators/trade-views/trade-views.ts';",
  ])('flags %s in a non-props cockpit file', (source) => {
    for (const path of ['src/ui/cockpit/rail/identity.tsx', 'src/ui/cockpit/drawers/today.types.ts', 'src/ui/cockpit/journal-cards.ts']) {
      const found = hits(path, source);
      expect(found).toHaveLength(1);
      expect(found[0]?.message).toContain('cockpit-import:');
    }
  });

  it('passes in a *.props.ts adapter and its test', () => {
    expect(hits('src/ui/cockpit/rail/identity.props.ts', "import type { TradeDetailView } from '../../app/types.ts';")).toEqual([]);
    expect(hits('src/ui/cockpit/rail/identity.props.test.ts', "import type { OpenTradeDetail } from '../../../coordinators/trade-views/trade-views.ts';")).toEqual([]);
  });

  it('passes for an ordinary import in a cockpit file, and outside the cockpit', () => {
    expect(hits('src/ui/cockpit/rail/identity.tsx', "import type { IdentityCardProps } from './identity.types.ts';")).toEqual([]);
    expect(hits('src/ui/screens/TradeDetail.tsx', "import type { TradeDetailView } from '../../app/types.ts';")).toEqual([]);
  });
});
