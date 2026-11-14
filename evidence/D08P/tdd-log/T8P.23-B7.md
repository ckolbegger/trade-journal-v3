# D08P TDD log, T8P.23-B7

One file per task (decision 111), so parallel lanes never edit one file. Each row is one single-case run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B7 | should show a Planned Detail's Journal as the Plan card with the Plan Reflection's answers, and no old Plan Reflection region or Journal heading | red | `npx vitest run src/ui/screens/trade-detail/Cockpit.test.tsx -t "should show a Planned Detail's Journal as the Plan card with the Plan Reflection's answers, and no old Plan Reflection region or Journal heading"` | exit 1; Tests  1 failed, 11 skipped (12) | TestingLibraryElementError: Unable to find an accessible element with the role "article" and name "Plan"  |
| T8P.23-B7 | should show a Planned Detail's Journal as the Plan card with the Plan Reflection's answers, and no old Plan Reflection region or Journal heading | green | `npx vitest run src/ui/screens/trade-detail/Cockpit.test.tsx -t "should show a Planned Detail's Journal as the Plan card with the Plan Reflection's answers, and no old Plan Reflection region or Journal heading"` | exit 0; Tests  1 passed, 11 skipped (12) |  |

| T8P.23-B7 | note | browser | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d8p e2e/d1/plan.spec.ts e2e/d1/recovery-only.spec.ts e2e/d1/responsive-a11y.spec.ts e2e/d2/ui-alignment.spec.ts e2e/d2/durability.spec.ts e2e/d5/responsive.spec.ts e2e/d6/runtime-failure.spec.ts --grep-invert @release-history` | 55 passed, 1 failed: `ui-alignment` "Plan Reflection answers as prose" read the card's item-details `dl > div` rows as answers (reach change); selector narrowed to `dl.answers > div`, rerun 1 passed (`evidence/D08P/browser/T8P.23-B7-ui-alignment-rerun.txt`). The new browser case in `e2e/d8p/planned.spec.ts` was written with the fix, so it has no separate red run (the unit case carries the red). |
| T8P.23-B7 | refactor | - | `npx vitest run src` | No change beyond removing `PlanReflectionSection` and its `JournalBlock` use, which the fix orphaned. |
