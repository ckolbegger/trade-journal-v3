# D09 tech debt

Stage B's items, reviewed with the user after the gate (the user's rule, 2026-11-19: style-only ocr findings and low critic defects come here, not to tasks).

## Stage B

| # | Source | Kind | Item |
|---|---|---|---|
| 1 | The user, 2026-11-19 | Maintainability | Clear the 76 nested ternaries in 45 files that `eslint-suppressions.json` records (added by the D9A-R retrospective, so lint fails only on new ones): `src/ui/screens` 18, `src/modules/trade-record` 8, `tools/capacity/measure-page.ts` 7, the six `e2e/*/no-save.spec.ts` 1 each, `src/domain/trade-analysis` 6, `src/coordinators/workspace` 5, `src/ui/cockpit` 5, 21 more across 18 files. Rewrite each as if/else or a lookup and drop its entry. |
| 2 | ocr on T9.22 (`7291900a`), style only | Style | `src/domain/trade-analysis/replay-estimates.test.ts:22`: the test helper's `== null` could be an explicit null and undefined check (no `eqeqeq` rule in the lint configs). |
| 3 | Complete run `t9.24` | Flaky test | `e2e/d8/responsive-a11y.spec.ts:299` "B8.16 … should complete a Restore with the keyboard only, every focused control showing a focus ring" timed out waiting for the file chooser once in the full `browser-3` stage; passed alone and in a full rerun of the stage. Not on P138's known list. |
| 4 | critic-b1, defect 2 (low) | Words | The not-split sentence reads "The put's move is not split: a Mark is missing for Tue Nov 10." where W48 reads "… no implied volatility for Tue Nov 10." T9.25-B1 made the cause follow the reason, after ocr found every reason worded as a missing implied volatility; the new phrase is in `new-words.md` (T9.25-B1) for approval. Decide: keep the cause phrase (and approve it), or go back to W48's single wording. |
