# Setup snapshot: timings

One run each, with the main worktree's browser lock held, Playwright's own file totals (the list reporter, tests plus worker start).

| Task | File | Before (s) | After (s) |
|---|---|---|---|
| ST.1 | e2e/d9ar/review.spec.ts | 28.8 | 12.0 |

ST.1 per test (before / after, s): 1: 7.1 / 7.6 (this test pays the one build of the setup), 2: 5.4 / 1.2, 3: 5.2 / 0.84, 4: 5.3 / 0.95, 5: 5.3 / 0.84.

ST.1-B1 (e2e/d9ar/review.spec.ts with e2e/d2/narrow.spec.ts in one run, total for both files, one run each): before 20.9 s, after 20.6 s.
ST.1-B2 (same two files in one run): before 20.6 s (after B1), after 20.4 s. e2e/d9ar/review.spec.ts alone, break check with the copy on: 11.3 s (ST.1: 12.0 s).
