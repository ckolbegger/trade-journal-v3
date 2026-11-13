# D08P TDD log, T8P.18-B

One file per task (decision 111). Each row is one run; see `../tdd-log.md` for the rules.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.18-B1 | it should choose the row value without a nested conditional | refactor | `npx vitest run src/ui/cockpit/drawers/plan-risk.test.tsx src/ui/cockpit/footer.test.tsx`, and `npx vitest run src/ui/cockpit src/ui/screens/trade-detail` | Refactor kept green, no behaviour change. `plan-risk.tsx` computes the row value in `valueContent` with early returns (lines, then amount with second line, then plain text) instead of a nested ternary. Before: drawer and footer cases 3 passed (2 files); cockpit and trade-detail 120 passed (27 files). After: the same counts. | |
