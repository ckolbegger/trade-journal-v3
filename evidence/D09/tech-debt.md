# D09 tech debt

Stage B's items, reviewed with the user after the gate (the user's rule, 2026-11-19: style-only ocr findings and low critic defects come here, not to tasks).

## Stage B

| # | Source | Kind | Item |
|---|---|---|---|
| 1 | The user, 2026-11-19 | Maintainability | Clear the 76 nested ternaries in 45 files that `eslint-suppressions.json` records (added by the D9A-R retrospective, so lint fails only on new ones): `src/ui/screens` 18, `src/modules/trade-record` 8, `tools/capacity/measure-page.ts` 7, the six `e2e/*/no-save.spec.ts` 1 each, `src/domain/trade-analysis` 6, `src/coordinators/workspace` 5, `src/ui/cockpit` 5, 21 more across 18 files. Rewrite each as if/else or a lookup and drop its entry. |
| 2 | ocr on T9.22 (`7291900a`), style only | Style | `src/domain/trade-analysis/replay-estimates.test.ts:22`: the test helper's `== null` could be an explicit null and undefined check (no `eqeqeq` rule in the lint configs). |
