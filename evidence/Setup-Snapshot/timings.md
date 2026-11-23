# Setup snapshot: timings

One run each, with the main worktree's browser lock held, Playwright's own file totals (the list reporter, tests plus worker start).

| Task | File | Before (s) | After (s) |
|---|---|---|---|
| ST.1 | e2e/d9ar/review.spec.ts | 28.8 | 12.0 |
| ST.2 | e2e/d9ar/responsive-a11y.spec.ts | 66 (1.1 min; tests sum 64.7) | 36.2 |

ST.1 per test (before / after, s): 1: 7.1 / 7.6 (this test pays the one build of the setup), 2: 5.4 / 1.2, 3: 5.2 / 0.84, 4: 5.3 / 0.95, 5: 5.3 / 0.84.

ST.1-B1 (e2e/d9ar/review.spec.ts with e2e/d2/narrow.spec.ts in one run, total for both files, one run each): before 20.9 s, after 20.6 s.
ST.1-B2 (same two files in one run): before 20.6 s (after B1), after 20.4 s. e2e/d9ar/review.spec.ts alone, break check with the copy on: 11.3 s (ST.1: 12.0 s).

ST.2: before, the original file (run from a temporary copy of HEAD's version, then deleted) 18 passed in 1.1 min; after 18 passed in 36.2 s. Break check with the copy off: 4.7 min (17 failures, each waiting out its first-screen check). e2e/d9ar/review.spec.ts after the helper change: 11.8 s (ST.1: 11.3 to 12.0 s).

ST.3 (the six e2e/d9 files in one run, main lock held, Playwright's list reporter; per-file figures are the sum of the tests' own times; one run each). Whole run before 45.0 s, after 22.3 s (16 passed both times). Break check with the copy off: 3.9 min (15 failures waiting out their first-screen check).

| Task | File | Before (s) | After (s) |
|---|---|---|---|
| ST.3 | e2e/d9/estimates-a11y.spec.ts | 6.9 | 8.1 (the first test pays the one build, 6.7) |
| ST.3 | e2e/d9/estimates.spec.ts | 10.8 | 5.1 |
| ST.3 | e2e/d9/meter-detail.spec.ts | 5.0 | 1.3 |
| ST.3 | e2e/d9/replay.spec.ts | 13.1 | 3.8 |
| ST.3 | e2e/d9/review.spec.ts | 5.6 | 2.2 |
| ST.3 | e2e/d9/session-cards.spec.ts | 3.1 | 1.3 |

In the full stage run the d9ar files that follow share the same built setup, so the build in the first test is paid once per stage.

ST.4 (the six e2e/d9ar files in one run, main lock held, Playwright's list reporter; per-file figures are the sum of the tests' own times; one run each; "before" ran HEAD's versions from temporary copies, deleted). Whole run before 2.1 min, after 1.1 min (43 passed both times). Break check with the copy off: about 9 min (35 failures, each waiting out its first-screen check).

| Task | File | Before (s) | After (s) |
|---|---|---|---|
| ST.4 | e2e/d9ar/cards.spec.ts | 21.4 | 17.2 (the first test pays the one build, 6.6) |
| ST.4 | e2e/d9ar/chart.spec.ts | 41.7 | 22.3 |
| ST.4 | e2e/d9ar/overlay.spec.ts | 10.7 | 3.1 |
| ST.4 | e2e/d9ar/readout.spec.ts | 32.3 | 13.7 |
| ST.4 | e2e/d9ar/sweep.spec.ts | 15.6 | 8.7 |
| ST.4 | e2e/d9ar/crossing-position.spec.ts | 2.5 | 0.8 |

ST.5 (the nine e2e/d8, d8p and d8r files in one run, main lock held, Playwright's list reporter; per-file figures are the sum of the tests' own times; one run each). Whole run before 2.6 min, after 1.3 min (24 passed both times). Break check with the copy off: 4.2 min (11 failures, each waiting out its first-screen check).

| Task | File | Before (s) | After (s) |
|---|---|---|---|
| ST.5 | e2e/d8/backup.spec.ts | 15.1 | 15.4 (the first test pays the one build, 9.2) |
| ST.5 | e2e/d8/restore.spec.ts | 24.9 | 17.0 |
| ST.5 | e2e/d8p/responsive-a11y.spec.ts | 25.8 | 10.7 |
| ST.5 | e2e/d8r/rail.spec.ts | 11.4 | 3.6 |
| ST.5 | e2e/d8r/responsive-a11y.spec.ts | 32.8 | 17.9 |
| ST.5 | e2e/d8r/today.spec.ts | 11.8 | 4.2 |
| ST.5 | e2e/d8r/plan-risk.spec.ts | 11.3 | 3.6 |
| ST.5 | e2e/d8p/lot-matches-fit.spec.ts | 12.0 | 5.1 |
| ST.5 | e2e/d8p/payoff-fit.spec.ts | 7.4 | 0.7 |

ST.6 (the five e2e/d5r files in one run, main lock held; per-file figures are the sum of the tests' own times; one run each; "before" is HEAD's versions). Whole run before 1.4 min (16 passed), after 51.3 s (16 passed). Break check with the copy off: 20.0 min (12 failures waiting out their first-screen check).

| Task | File | Before (s) | After (s) |
|---|---|---|---|
| ST.6 | e2e/d5r/marks.spec.ts | 20.1 | 7.9 |
| ST.6 | e2e/d5r/responsive-a11y.spec.ts | 20.2 | 13.6 |
| ST.6 | e2e/d5r/review.spec.ts | 18.7 | 12.5 |
| ST.6 | e2e/d5r/sliders.spec.ts | 12.3 | 2.8 |
| ST.6 | e2e/d5r/durability.spec.ts | 14.8 | 14.3 (the first test to ask pays the one build, 5.1) |

ST.7 (the five e2e/d9r2 files in one run, main lock held; per-file figures are the sum of the tests' own times; one run each; "before" is HEAD's versions). Whole run before 56.7 s (17 passed), after 26.2 s (17 passed). Break check with the copy off (two tests): both failed, 39 s in all.

| Task | File | Before (s) | After (s) |
|---|---|---|---|
| ST.7 | e2e/d9r2/drafts.spec.ts | 15.1 | 8.1 |
| ST.7 | e2e/d9r2/editor.spec.ts | 13.7 | 5.9 |
| ST.7 | e2e/d9r2/grid.spec.ts | 4.7 | 2.8 |
| ST.7 | e2e/d9r2/history.spec.ts | 2.9 | 1.0 |
| ST.7 | e2e/d9r2/responsive-a11y.spec.ts | 19.5 | 7.8 |

ST.8 (the seven e2e/d6 files in one run, main lock held; per-file figures are the sum of the tests' own times; one run each; "before" is HEAD~1's versions). Whole run before 53.2 s (12 passed), after 40.4 s (12 passed). Break check with the copy off (two tests): both failed.

| Task | File | Before (s) | After (s) |
|---|---|---|---|
| ST.8 | e2e/d6/exit-requirements.spec.ts | 5.8 | 2.5 |
| ST.8 | e2e/d6/exit.spec.ts | 3.7 | 2.1 |
| ST.8 | e2e/d6/no-save.spec.ts | 3.4 | 1.7 |
| ST.8 | e2e/d6/offline.spec.ts | 3.6 | 2.0 |
| ST.8 | e2e/d6/runtime-failure.spec.ts | 6.6 | 6.8 (unchanged: both tests keep their own build) |
| ST.8 | e2e/d6/responsive-a11y.spec.ts | 26.5 | 21.4 |
| ST.8 | e2e/d6/exit-action.spec.ts | 3.0 | 3.4 (the first test to ask pays the one build) |
