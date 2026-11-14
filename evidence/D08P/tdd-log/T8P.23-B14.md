# T8P.23-B14 TDD log (hand-written: the case is a Playwright browser spec, which tdd.sh cannot run)

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.23-B14 | should show the current date column and the Change column inside the comparison scroll box at 375 and 320 px, with no sideways page scroll (`e2e/d8p/today-narrow.spec.ts`) | red | `.claude/scripts/with-browser-lock.sh npx playwright test e2e/d8p/today-narrow.spec.ts` (after `npm run build:faults`) | 1 failed | `cells outside the scroll box at 375 px`: `"Tue Oct 13 510 > 338"`, `"Change 587 > 338"`, `"$2.80Manual · 2026-10-13 17:00 510 > 338"`, `"+$0.30 587 > 338"` |
| T8P.23-B14 | same | green | same, after `today.css` gained a max-width 959.98px block for the comparison: label column unpinned, cell padding 0.5rem 0.3rem, `min-width: 0`, wrapping text, header letter-spacing 0 (intermediate runs failed at 344 > 338 on Change at 375 px, then passed) | 1 passed | |
| T8P.23-B14 | refactor | refactor | n/a | no change beyond the CSS block | |
