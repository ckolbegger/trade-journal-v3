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
