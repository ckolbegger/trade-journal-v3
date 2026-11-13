# T8P.30 Absence checks prove absence (structural, tests only)

Verification recorded per plan section 6; the changed checks and each mutation's failure are in `evidence/D08P/T8P.30-checks.md`.

| Step | Command | Result |
| --- | --- | --- |
| Titles before | `.claude/scripts/it-titles.sh` (kept in scratch) | 1635 lines |
| Grep, unit scope | `grep -nE 'queryBy|queryAllBy|not\.toBeInTheDocument|toBeNull\(\)|toHaveLength\(0\)|toBeFalsy|not\.toBe\(' src/ui/cockpit src/ui/screens/trade-detail tests` | 140 lines; 50 role queries; 44 checks changed |
| Grep, browser scope | `grep -nE 'toHaveCount\(0\)|not\.toBeVisible|toBeHidden|not\.toContainText|not\.toHaveAttribute|not\.toHaveClass' e2e` | 114 lines; 35 Trade Detail gone checks changed |
| Unit mutations | ghost elements in hidden divs, `npx vitest run src/ui/cockpit src/ui/screens`, four passes so each changed line is reached | each changed check failed with `expected <...> to be null` at its own line (see checks file) |
| Hidden mutation | `hidden={false}` on the tabpanel, `npx vitest run src/ui/screens/trade-detail/Cockpit.test.tsx` | `expected false to be true` at Cockpit.test.tsx:43 |
| Browser mutations | ghost block in `Cockpit.tsx`, rounds 1 to 7, `npm run build:faults && npm run build:releases`, `with-browser-lock.sh npx playwright test <specs>` | each changed check failed on its own `toHaveCount(0)` line (checks file); outputs `evidence/D08P/browser/T8P.30-mutation-*.txt` |
| Revert | `git checkout -- <product files>`; `git diff --name-only` shows only test, e2e and evidence files | clean |
| Titles after | `.claude/scripts/it-titles.sh`, `diff` against before | empty |
| Unit | `npx vitest run src` | 157 files, 1635 tests passed |
| Integration | `npm run test:integration` | 104 files, 222 tests passed |
| Browser | `npm run build && npm run build:faults && npm run build:releases`; `with-browser-lock.sh npx playwright test <17 changed specs>` | 35 passed (`evidence/D08P/browser/T8P.30-specs.txt`); ports 5175, 9341, 9342 clear before and after |
| Checks | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 (lint: the existing `OwedDebtItem.tsx` hook warning) |
