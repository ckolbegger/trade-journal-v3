# Setup snapshot proof of concept 2: results (responsive-a11y)

Run 2026-11-23. Same method as the first proof of concept (research/setup-snapshot-poc-results.md). Worktree .claude/worktrees/setup-snapshot-poc, branch setup-snapshot-poc, brought up to date with claude-opus-5.5 by a merge (fa42dc19), committed locally, not pushed or merged. The raw timing files are in evidence/Setup-Snapshot-PoC-2/ on that branch.

## In short

It works here too, and it saves about twice as much time as the first file did. responsive-a11y went from 64.55 s to 35.57 s (median of four timed runs each). That is 1.81 times as fast and saves 28.98 s. Every test passed in every run, and ten more runs of the new file all passed.

The speedup ratio is lower than the Review file's (2.36 times) because each test here used to build only one Trade. The saving in seconds is about twice as large, because 17 of the 18 tests now share one build. The one-Trade builds turned out to cost about 2.3 s each, not the 1.35 s the first proof of concept guessed, so the browser-tier estimate goes up. Sharing builds inside files now looks like about 1 to 2 minutes out of 21.4 (about 5 to 9%), not the 0.5 to 1 minute estimated before.

## What was built

A new file, e2e/d9ar/responsive-a11y-snapshot.spec.ts, beside the old one, which is unchanged (commit bbc86111). No support file and nothing in src/ changed.

- **The shared profile.** Once per worker, before any test starts, the file builds the standard three-Trade Review (BREN, AXIO and DALE held, each Marked to Mon 11-16) through the screens with the existing buildReview. It does this on its own server and its own profile folder, then closes both and keeps the folder. The code is the first proof of concept's fixture.
- **The copy is asked for, not automatic.** In the first proof of concept every test got a copy automatically. Here one test needs an empty profile (R-DALE-U, below), so a test gets a copy only when its start asks for one.
- **Three ways to start from the copy:**
  - **On the Review** (in place of buildReview(profile, [BREN]), or of the four-Trade build). Copy, launch at Mon 11-16 at the close, open the app, check it is onboarded and holds the snapshot's three Trades, then open the Review. If the test asks for a Trade the snapshot lacks, it is added through the screens first, and then the Review is opened. The adding uses buildOn, the d9 helper that plans, enters and Marks one Trade. buildReview's own helper (enterTrade) is not exported, and the support files were left alone. For a Trade with no Position Changes, such as CORV, the two run the same steps.
  - **On a Trade Detail** (in place of build(profile, BREN, Mon 11-16, 10)). Copy, launch, run the same checks, open BREN's Trade Detail. build and buildReview record the same BREN Trade (the same Plan, entry, sale of 2 and Marks), and every exact figure in these tests passed unchanged.
  - **Copy only.** Some tests used to build, close the browser at once, and relaunch it their own way (as a touch phone, or offline). These now copy the profile and go straight to their own launch, so they skip both the build and a launch.
- The time log lines (build, copy, open) are kept, as before.

Only how each test starts changed. No check was changed or removed.

## Which test starts how

| Test | Old start | New start |
|---|---|---|
| 1. Detail overlay through every size | build(BREN) | Shared profile, BREN's Trade Detail |
| 2. Review card's overlay through every size | buildReview([BREN]) | Shared profile, the Review |
| 3. Detail overlay on one 320 by 667 screen | build(BREN) | Shared profile, BREN's Trade Detail |
| 4. Review card overlay on one 320 by 667 screen | buildReview([BREN]) | Shared profile, the Review |
| 5. P&L chart 800 wide at 1280, wider at 1440 and 1920 | build(BREN) | Shared profile, BREN's Trade Detail |
| 6. Chart still at every session of BREN, AXIO, CORV and DALE held | buildReview([BREN, AXIO, CORV, DALE held]) | Shared profile **plus CORV added on top**, the Review |
| 7. Chart still at every session of R-DALE-U | buildReview([DALE R-DALE-U]) | **Kept its own build** |
| 8. Tab stays inside the overlay | build(BREN) | Shared profile, BREN's Trade Detail |
| 9. Layout after Close, started Action still there | buildReview([BREN]) | Shared profile, the Review |
| 10. Phone's Replay buttons, paging buttons, card headings 44 px | buildReview([BREN]) | Shared profile, the Review |
| 11. Overlay's Close button 44 px on a phone | build(BREN) | Shared profile, BREN's Trade Detail |
| 12. Tap moves the slider (touch launch) | build(BREN), close, touch launch | Copy only, then the touch launch |
| 13. No hover box from the Review card's tap at 320 (touch) | buildReview([BREN]), close, touch launch | Copy only, then the touch launch |
| 14, 15. Price History link 44 px at 375 and 320 (touch) | buildReview([BREN]), close, touch launch | Copy only, then the touch launch |
| 16. DALE's slider value uncovered at 320 (touch) | build(DALE held), close, touch launch | Copy only, then the touch launch (uses the shared DALE held) |
| 17. Offline after a cold restart | build(BREN), close, stop the server, offline launch | Copy only, stop the server, offline launch |
| 18. Staged update's notice unchanged | build(BREN), then switch the server to v2 | Shared profile, BREN's Trade Detail, then v2 |

**The six one-Trade Review starts (buildReview([BREN])).** They are tests 2, 4, 9, 10, 13, 14 and 15: six calls, one of them in a loop that makes two tests. All now start from the three-Trade Review. None of their checks depends on BREN being alone. The cards are reached by Trade, not by position. No check counts cards or Trades. The size, focus and Tab checks are about the overlay or BREN's own card. So every check passed unchanged with the two extra Trades on the page, in all 4 timed runs and all 10 flake runs.

**"Add DALE on top."** No test needed DALE added. DALE held is already one of the standard three, and the one test that builds DALE held alone (test 16) now uses the shared one. The only test that needs a Trade the snapshot lacks is test 6, which needs CORV, so CORV is added on top for it. Its Trades are still handed over in the old order (BREN, AXIO, CORV, DALE), so the test loops through them as before.

**Why R-DALE-U keeps its own build (test 7).** R-DALE-U is the same DALE put (DALE Nov 20 $57.50 Put) as DALE held, Marked on another series (R-DALE-U, where DALE held uses R-DALE-D). The Review's Marks step is one grid for the page, with each cell named by symbol or contract and date ("DALE Mark, Thu Nov 12"). So a journal holds one Mark per Instrument per session, and it cannot hold both DALE Trades with their different Marks. The old file already gave it a launch of its own for this reason. It still starts from an empty profile.

**Tests left on their old start:** only test 7. The touch, offline and staged-update tests all fit the shared profile. The service worker and its saved files come from the same release on the same port, so the offline test reads the app from them as before. As the break check below shows, each of these tests really does start from the copy.

## Timed runs

Four old and new pairs in alternating order. Each pair held the main worktree's browser lock, so no other browser run could overlap, with 120 s between pairs. Durations are in seconds. A file total covers the worker start, the shared build and every test.

| Run (order) | Old file total | New file total | Old wall | New wall | 1-min load (old / new) | Shared build |
|---|---|---|---|---|---|---|
| Pair 1 (old then new) | 64.67 | 36.08 | 65.21 | 36.59 | 3.31 / 4.45 | 4.88 |
| Pair 2 (new then old) | 64.84 | 35.29 | 65.36 | 35.80 | 4.07 / 3.25 | 4.76 |
| Pair 3 (old then new) | 64.43 | 35.68 | 64.93 | 36.19 | 4.10 / 4.28 | 4.89 |
| Pair 4 (new then old) | 62.55 | 35.46 | 63.06 | 36.07 | 13.07 / 7.80 | 5.14 |
| **Median** | **64.55** | **35.57** | 65.07 | 36.13 | | **4.88** |

Saving: 64.55 − 35.57 = **28.98 s per run of the file, 1.81 times as fast.** Pair 4 ran at a higher load (13.1 and 7.8, against 3 to 4.5 for the others), but its times match the rest (its old run was the fastest), so it is counted. Without it the medians are 64.67 and 35.68.

Per test:

| Test | New start | Old 1 | Old 2 | Old 3 | Old 4 | Old median | New 1 | New 2 | New 3 | New 4 | New median | Saved (median) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1. should fit the Detail overlay on one screen at every size, keeping the session across each resize | Trade Detail, carries on | 6.92 | 6.55 | 6.62 | 6.52 | **6.59** | 4.82 | 4.60 | 4.82 | 4.75 | **4.79** | 1.80 |
| 2. should fit the Review card’s overlay on one screen at every size, keeping the session across each resize | Review, carries on | 6.44 | 6.45 | 6.37 | 6.20 | **6.41** | 4.69 | 4.63 | 4.62 | 4.45 | **4.63** | 1.78 |
| 3. should fit the Detail overlay’s header, headline and both charts on one 320 by 667 screen | Trade Detail, carries on | 2.60 | 2.61 | 2.48 | 2.65 | **2.61** | 0.76 | 0.76 | 0.77 | 0.73 | **0.76** | 1.85 |
| 4. should fit the Review card overlay’s header, headline and both charts on one 320 by 667 screen | Review, carries on | 2.43 | 2.47 | 2.62 | 2.43 | **2.45** | 0.84 | 0.83 | 0.83 | 0.81 | **0.83** | 1.62 |
| 5. should draw the P&L chart at least 800 wide at 1280 and wider at 1440 and 1920, with its text the same size at each | Trade Detail, carries on | 2.70 | 2.68 | 2.69 | 2.66 | **2.68** | 0.82 | 0.82 | 0.84 | 0.82 | **0.82** | 1.86 |
| 6. should keep the P&L chart 800 wide and still, and each stake grid inside the readout, at every session of R-BREN-U, R-AXIO-D, R-CORV-D and R-DALE-D at 1280 | Review plus CORV | 8.10 | 7.95 | 8.07 | 7.77 | **8.01** | 4.20 | 4.09 | 4.20 | 4.13 | **4.16** | 3.84 |
| 7. should keep the P&L chart 800 wide and still, and each stake grid inside the readout, at every session of R-DALE-U at 1280 | own build (unchanged) | 2.56 | 2.50 | 2.54 | 2.56 | **2.55** | 2.54 | 2.53 | 2.44 | 2.46 | **2.50** | 0.05 |
| 8. should keep Tab inside the overlay, from either end, at 1280 and on a phone | Trade Detail, carries on | 3.59 | 3.45 | 3.30 | 3.35 | **3.40** | 1.67 | 1.59 | 1.60 | 1.48 | **1.59** | 1.80 |
| 9. should show the page in the new width’s layout after Close, with a started Action still there | Review, carries on | 2.87 | 2.85 | 2.67 | 2.55 | **2.76** | 1.07 | 1.06 | 1.03 | 1.01 | **1.04** | 1.72 |
| 10. should make the phone’s Replay buttons, paging buttons and card headings at least 44 pixels high | Review, carries on | 2.53 | 2.76 | 2.77 | 2.34 | **2.65** | 0.99 | 0.98 | 0.94 | 0.96 | **0.97** | 1.67 |
| 11. should make the overlay’s Close button at least 44 pixels high on a phone | Trade Detail, carries on | 2.44 | 2.61 | 2.63 | 2.37 | **2.52** | 0.73 | 0.72 | 0.77 | 0.75 | **0.74** | 1.79 |
| 12. should move the slider by a tap on a session and a tap on a card’s heading | copy only, then its own launch | 3.04 | 3.23 | 3.23 | 3.19 | **3.21** | 0.85 | 0.83 | 0.85 | 0.88 | **0.85** | 2.36 |
| 13. should show no hover box or band from the Review card's Replay tap and after two taps on sessions at 320 | copy only, then its own launch | 3.47 | 3.29 | 3.31 | 3.06 | **3.30** | 0.93 | 0.90 | 0.91 | 0.88 | **0.91** | 2.40 |
| 14. should make the Review overlay's Price History link at least 44 pixels high at 375 | copy only, then its own launch | 3.17 | 2.97 | 3.13 | 3.04 | **3.08** | 0.77 | 0.81 | 0.76 | 0.78 | **0.78** | 2.31 |
| 15. should make the Review overlay's Price History link at least 44 pixels high at 320 | copy only, then its own launch | 3.00 | 3.29 | 3.17 | 3.09 | **3.13** | 0.80 | 0.78 | 0.81 | 0.77 | **0.79** | 2.34 |
| 16. should leave the slider’s value uncovered by any chart element for DALE from Trade Detail at 320 | copy only, then its own launch | 2.48 | 2.71 | 2.52 | 2.54 | **2.53** | 0.68 | 0.65 | 0.63 | 0.67 | **0.66** | 1.87 |
| 17. should read the overlay offline after a cold restart with the server stopped (AC-DEL-001) | copy only, then its own launch | 2.88 | 3.16 | 3.08 | 3.00 | **3.04** | 0.70 | 0.67 | 0.67 | 0.68 | **0.68** | 2.37 |
| 18. should leave a staged update’s notice in place and unchanged when the overlay is opened and closed | Trade Detail, carries on | 2.68 | 2.67 | 2.62 | 2.62 | **2.64** | 2.64 | 2.65 | 2.68 | 2.69 | **2.66** | -0.02 |

The shared build counts toward no single test (as in the first proof of concept, it runs before test 1). The new per-test medians sum to 30.15 s. Adding the build (4.88 s) gives 35.03 s, against the 35.57 s file total.

By kind of start (sums of medians):

| Start | Tests | Old | New | Saved | Saved per test |
|---|---|---|---|---|---|
| Trade Detail, carries on | 6 | 20.45 | 11.36 | 9.08 | 1.51 |
| Review, carries on | 4 | 14.27 | 7.48 | 6.79 | 1.70 |
| Review plus CORV | 1 | 8.01 | 4.16 | 3.84 | 3.84 |
| own build (unchanged) | 1 | 2.55 | 2.50 | 0.05 | 0.05 |
| copy only, then its own launch | 6 | 18.30 | 4.65 | 13.64 | 2.27 |

The parts, measured:
- **Shared build:** 4.88 s (median of the timed runs; 4.41 to 4.76 s in the flake runs).
- **Copy:** 35 to 45 ms per test.
- **Opening the copy** (launch, first screen, checks, the Review or the Trade Detail): 0.43 to 0.52 s.
- **What a one-Trade build cost, as measured by its removal:** about 2.3 s. A test that carries on from the copy saves about 1.8 s (the build less the 0.5 s open). A test that only copies saves about 2.3 s, since it skips the build and does not open the copy first.
- **Test 6 (CORV added on top):** saved 3.84 s, because three of its four Trades now come from the copy.
- **Test 18 (staged update) saved nothing** (2.64 s old, 2.66 s new). The build it skips is paid back somewhere after the start. A likely place is the update check, which waits while the new release installs, and may wait longer in a browser that has only just started. This was not looked into further. The other five Trade Detail tests that carry on save 1.79 to 1.86 s each.

## Flake check

Ten untimed runs of the new file all passed: each exited 0 with 18 passed, in 34.4 to 35.4 s. The build took 4.41 to 4.76 s, and each open took 0.43 to 0.52 s. The four timed runs passed too.

## Break check

I made the copy do nothing, so every test that asks for the snapshot got an empty profile. 17 tests failed, and only test 7 (R-DALE-U, on its own build) passed. The eleven that open the copy (tests 1, 2, 3, 4, 5, 6, 8, 9, 10, 11 and 18) failed at the first screen: the Review link never appeared. The five touch tests failed when their first tap or click found nothing to press. The offline test failed loading the Trade Detail (no saved app to read offline). Undoing the change made all 18 pass again, as the timed and flake runs show.

## What differed from the first proof of concept

- **The copy is asked for, not automatic**, because one test (R-DALE-U) must keep an empty profile.
- **Trade Detail tests use the Review profile.** The first file had only Review tests. Here nine tests started from a one-Trade Trade Detail (tests 1, 3, 5, 8, 11, 12, 16, 17 and 18). They now use BREN's (or DALE held's) Trade from the shared profile instead, and three of them (12, 16 and 17) only copy it. The Trade is recorded the same way, so their exact figures did not change.
- **Copy-only starts.** Tests that closed their build's browser and relaunched now skip that launch too. They save the most per test (about 2.3 s).
- **One test adds a Trade on top** (CORV for test 6). That costs one Trade's entry and Marks through the screens inside the test and still saves 3.84 s.
- **One test gained nothing** (the staged update). Every test in the first file gained about the same.
- **The cost a snapshot test still pays is about 0.5 s** (copy and open), against about 0.8 s worked out from the first file. The first figure was solved from the file's saving, so it also took in the worker changeover and other costs. Here it is read straight from the log lines.
- **A smaller ratio but a bigger saving:** 1.81 times (64.55 to 35.57 s, saving 28.98 s) against 2.36 times (26.50 to 11.22 s, saving 15.28 s). Each test here skips a cheaper build, but far more tests share it.
- **The one-Trade build costs about 2.3 s, not 1.35 s.** The first report guessed 1.35 s and said such builds pay off only in groups of four or more. With 2.3 s builds and a 0.5 s open, two tests on the same build already pay off.

## Updated estimate for the browser tier (21.4 min)

Assumptions, as before: the tier runs one test at a time (workers: 1), so its time is the sum of the files' times. A file that gets its own snapshot adds about 0.3 s for an extra worker. Only buildReview with three Trades (4.8 s, both proofs of concept) and the one-Trade builds (about 2.3 s, here) have been measured. The other build costs are still the plan's estimates.

**1. Within a file, one build per run (what both proofs of concept built).** Saving ≈ the sum of the per-test savings − the build − 0.3 s, with about 1.8 s saved per test that carries on from a one-Trade build and about 2.3 s per test that only copies.

| File | Basis | Saving (s) |
|---|---|---|
| d9ar/review | measured | 15.3 |
| d9ar/responsive-a11y | measured | 29.0 |
| d9/meter-a11y | plan's estimate (first report) | about 7 |
| d8p/history | plan's estimate (first report) | about 4 |
| d9ar/chart, d9ar/readout, d9ar/overlay, d9ar/cards, d9ar/states, d9/replay | 36 builder calls in all (counted with rg), many on build(profile, BREN) but at several clocks and session counts; guessing a third to a half of them share a build, at about 1.8 s each less a build per file | about 15 to 30 |
| d8p and d8r responsive-a11y pairs, d9/gaps, the other two-call files | small groups | about 5 to 10 |

That is about 75 to 95 s (1.3 to 1.6 minutes, 6 to 7.5% of 21.4 min). Allowing for the guessed rows, call it **1 to 2 minutes, about 5 to 9%**. The first report said 0.5 to 1 min. The change is almost all down to the one-Trade build being dearer than guessed and to responsive-a11y sharing far more widely than the first report assumed (17 of 18 tests, not about 8).

**2. Across files, a snapshot kept between runs (not measured).** build(profile, BREN) alone appears 31 times across the browser files, buildOc3 12 times, build(AXIO) 9 times and build(CORV) 6 times. With a kept snapshot (and the plan's stamp so it never goes stale), a run where nothing relevant changed pays no build at all, and each of those tests saves its whole build less about 0.5 s. Both proofs of concept fit this: a test saves about 82% of its time on a three-Trade build and about 70% on a one-Trade build. The plan's 3 to 5 minutes (14 to 23%) still looks plausible, now with better support, but it was not measured.

**3. An onboarded profile for every test (not measured).** Opening an existing profile took 0.43 to 0.52 s in both proofs of concept. Onboarding's own share of a fresh test is still unknown.
