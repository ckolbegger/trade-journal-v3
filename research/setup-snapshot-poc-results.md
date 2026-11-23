# Setup snapshot proof of concept: results

Run 2026-11-23 from plan/setup-snapshot-poc-plan.md. Worktree .claude/worktrees/setup-snapshot-poc, branch setup-snapshot-poc (from claude-opus-5.5 at 52d6ec90), five local commits, not pushed or merged. The full timing record is evidence/Setup-Snapshot-PoC/timings.md on that branch.

## In short

The idea works. The Review file's three Trades are now built once through the screens, and each of the five tests starts on a copy of that finished browser profile. The file went from 26.50 s to 11.22 s (median of four timed runs each), 2.36 times as fast, saving 15.28 s. All tests passed in every run, and ten more runs of the new file all passed.

For the whole browser tier the gain is small if the idea stays inside single files: about half a minute to a minute out of 21.4 minutes (about 2 to 5%). A bigger gain needs a snapshot kept between runs and shared across files, which this proof of concept did not measure.

## What was built

- **Port move** (commit 41f06677). The worktree's test servers use port 4175 and the kill tests' Chrome debugging ports are 8343 and 8344, in tools/release-server.ts, e2e/d1/support.ts, e2e/d5/kill-offline.spec.ts, e2e/d5r/durability.spec.ts, e2e/d6/kill.spec.ts, e2e/d7/kill.spec.ts, e2e/d8/restore.spec.ts, e2e/d6/stale-index.spec.ts, e2e/d6/stale-debt.spec.ts, e2e/smoke/engine-capabilities.spec.ts and tools/capacity/measure-basis.ts. Nothing in src/ changed.
- **New spec** e2e/d9ar/review-snapshot.spec.ts (commits 9ebc8549 and 70853ddf). The test bodies are review.spec.ts's, unchanged except that buildReview(profile) became openSnapshotReview(profile). It adds three pieces:
  - reviewSnapshot, an automatic worker-scoped fixture. Before any test starts, it starts its own server on dist-releases/current, runs the existing buildReview on a side folder (test-results/review-snapshot-<worker>), closes the browser and the server, and keeps the folder and the Trade ids.
  - reviewProfile, an automatic test fixture. It clones that folder into the test's own profile folder (cp -c -R, an APFS clone) and removes Chromium's Singleton lock files.
  - openSnapshotReview. It launches at the instant the build used (Mon 11-16 at the close), opens the app, checks that the Review link is there and "Start your journal" is not, opens the Review, and checks that the stored Trades are the ones the build made.
- **Evidence** (commit 4f616cd9, plus the run script pair.sh in the next commit): evidence/Setup-Snapshot-PoC/timings.md and the raw Playwright JSON and list output of every timed run.

Checks before timing: both files passed. A deliberate break (no copy, so an empty profile) made all five new tests fail at the first screen, and undoing it made them pass again.

## Timed runs

Four old and new pairs in alternating order. Each pair ran while holding the main worktree's browser lock, so no other browser run could overlap, with 120 s between pairs. Durations are in seconds. A file total includes the worker start, the snapshot build and every test.

| Run (order) | Old file total | New file total | Old wall | New wall | 1-min load (old / new) | Snapshot build |
|---|---|---|---|---|---|---|
| Pair 1 (old then new) | 26.52 | 11.38 | 26.95 | 11.80 | 11.79 / 12.75 | 4.97 |
| Pair 2 (new then old) | 26.47 | 11.20 | 27.02 | 11.60 | 5.48 / 5.39 | 4.83 |
| Pair 3 (old then new) | 27.08 | 11.22 | 27.59 | 11.75 | 2.31 / 2.82 | 4.81 |
| Pair 4 (new then old) | 26.44 | 11.22 | 26.98 | 11.72 | 5.14 / 3.77 | 4.84 |
| **Median** | **26.50** | **11.22** | 27.00 | 11.73 | | **4.83** |

Pair 1 ran at a 1-minute load near 12, against 2 to 5 for the others, but its times match the rest, so it is counted. Without it the medians are 26.47 and 11.22.

Per test:

| Test | Old run 1 | Old run 2 | Old run 3 | Old run 4 | Old median | New run 1 | New run 2 | New run 3 | New run 4 | New median | Saved (median) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1. restore a started Action after the Price History round trip, save with one press | 5.95 | 6.05 | 6.38 | 6.07 | **6.06** | 2.16 | 2.19 | 2.16 | 2.15 | **2.16** | 3.90 |
| 2. keep a started Action through browser Forward and Back | 5.13 | 5.24 | 5.13 | 5.22 | **5.17** | 1.21 | 1.17 | 1.24 | 1.22 | **1.21** | 3.96 |
| 3. arrive at Price History with the session column header focused | 4.86 | 5.02 | 4.93 | 4.88 | **4.90** | 0.83 | 0.79 | 0.83 | 0.86 | **0.83** | 4.07 |
| 4. return focus to Replay on Close after a reload | 5.10 | 4.90 | 5.19 | 4.93 | **5.02** | 0.93 | 0.94 | 0.92 | 0.91 | **0.92** | 4.10 |
| 5. read each card’s summary in the replay’s words | 5.00 | 4.81 | 5.00 | 4.88 | **4.94** | 0.83 | 0.83 | 0.81 | 0.81 | **0.82** | 4.12 |

The snapshot build counts toward no single test, because it runs before test 1. The new per-test medians sum to 5.94 s. Adding the build (4.83 s) gives 10.77 s, against the 11.22 s file total.

The parts, measured:
- **Build once:** 4.83 s (median). That is the server, the launch, onboarding, and the three Trades planned, entered and Marked.
- **Clone the profile:** 42 ms. The folder is 11 MB.
- **Open the snapshot's Review:** 513 ms.
- **Overall cost a snapshot test still pays beyond its own checks:** about 0.8 s.
- **Saved per test, before paying for the one build:** 4.03 s on average.

The saving for k tests sharing one build of cost B is about (k − 1) × B − k × 0.8 s. The 0.8 s was solved from this file's saving, so the formula gives back that saving by construction. One check does not depend on that solve: the build minus the average saving per test is 4.83 − 4.03 = 0.80 s, the same figure.

## Flake check

Ten untimed runs of the new file all passed: every run exited 0 with 5 passed, in 10.8 to 12.0 s per run. The build took 4.5 to 5.2 s and each open took 0.47 to 0.58 s. The four timed runs passed too. That includes the browser Forward and Back test, which the plan flagged to watch because its back history now starts empty.

## What behaved differently from the plan

- **Bigger gain than expected.** The plan expected about 2 times (25 s down to 12 to 14 s). The result was 2.36 times (26.50 s down to 11.22 s). The cost a snapshot test still pays was about 0.8 s, against the plan's estimate of 1 to 1.5 s.
- **Fixture order confirmed.** The automatic worker fixture runs before the first test's server starts, so the fallback (beforeAll) was not needed. Its build time is in no test's duration.
- **Trade ids kept in memory.** No trades.json was written. The Trade ids are passed from the worker fixture in memory, since both run in the same worker process.
- **Snapshot check reads storage.** The check that the snapshot was used reads the stored Trades through the existing IndexedDB probe, not the Review cards. The first-screen wait is for the Review link in the Primary navigation, not for a heading.
- **Nothing trimmed from the copy.** The snapshot folder is 11 MB, half of it Chromium's GraphiteDawnCache. A clone takes about 40 ms, so nothing was left out.
- **A new worker per file.** When the new file runs in the same Playwright run as other files, its worker fixture makes Playwright start a separate worker. The changeover cost about 0.3 s (one combined run of both files, total 37.88 s).
- **One added timer.** A third log line (the time to open the snapshot's Review) was added before the flake and timed runs, so the plan's "what a snapshot test pays" could be measured.

## Extrapolation to the browser tier

The tier is 21.4 min after the dedup (browser-1 5.5 min, browser-2 5.2 min, browser-3 4.4 min, browser-4 6.3 min).

Assumptions:
- The tier still runs one test at a time (workers: 1), so its time is the sum of the files' times.
- The measured cost per snapshot test (about 0.8 s) holds for other files.
- Each file that gets its own snapshot adds about 0.3 to 0.6 s for extra workers. One changeover (snapshot file to plain file) was measured at 0.3 s; a snapshot file in the middle of a stage probably costs two.
- Build costs other than buildReview's are the plan's estimates from the t95.15 timings, not measurements. Only buildReview was measured here.
- The test counts were recounted in the worktree (at 52d6ec90, after the dedup) by counting the builder calls in each file.

**1. Within a file, one build per run (what was built here).** Saving ≈ (k − 1) × B − 0.8 × k − 0.3 s per file.

| File | Tests sharing one build (k) | Build B (s) | Saving (s) |
|---|---|---|---|
| d9ar/review | 5 | 4.8 (measured) | 15.0 (15.3 measured, less 0.3 for the worker) |
| d9/meter-a11y | 3 | about 5 | about 7.3 |
| d8p/history | 2 | about 6.25 | about 4.3 |
| d9ar/responsive-a11y | two groups: 8 build(BREN) and 6 buildReview([BREN]) calls (some inside loops), one-Trade builds | about 1.35 | about 4.5, if the touch, offline and update launches allow it |

That is about 30 s for the four named files. Adding the plan's other, uncounted groups (the d8p and d8r responsive-a11y pairs, some groups in d9ar/chart and d9ar/readout) might double it. So expect about 0.5 to 1 min, 2.5 to 5% of 21.4 min. This is below the plan's 1 to 2 min, because the named groups are small.

The break-even is two tests. With k = 2, a build is worth sharing once B is more than about 1.9 s (2 × 0.8 + 0.3). So d8p/history (two tests, a build of about 6 s) still gains about 4 s, but the one-Trade builds near 1.3 s only pay off in groups of four or more.

**2. Across files, a snapshot kept between runs (not measured).** On a run where nothing relevant changed, each test on a cached build saves about B − 0.8 s, and no build is paid at all. In this file, the build was about 82% of an old test's time (4.0 of 4.9 s, test 5). The plan put the tests of 4 s or more at 9.7 min (83 tests, before the dedup). If every one of them sat on a cached build with that share, the ceiling would be about 8 min. Not every heavy test shares a build, so the plan's 3 to 5 min (about 14 to 23% of 21.4 min) stays plausible but unchecked. It also needs the stamp file of the plan's section 3.6 to keep a cached snapshot from going stale. A run after a code change pays each distinct build once, like level 1.

**3. An onboarded profile for every test (not measured).** Opening an existing profile at the Review took about 0.5 s. This run gives no figure for onboarding's own share of a fresh test, so this level's gain is still unknown.
