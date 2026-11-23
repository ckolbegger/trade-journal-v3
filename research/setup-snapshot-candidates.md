# Setup snapshot: where else a saved browser setup could be reused

Survey of 2026-11-23, read only. No test, server or browser was run. Sources: every spec in e2e/ that runs in the browser tier, the support files, playwright.config.ts, package.json, the latest full run (evidence/Test-Dedup/suite-runs/td.11-dedup-browser-1.txt, -2, -3 and -4), research/setup-snapshot-poc-results.md, research/setup-snapshot-poc-2-results.md and plan/setup-snapshot-poc-plan.md section 2.1.

## In short

Many more tests build the same journal than the two proofs of concept covered, and most of them sit in the same browser stage as their twins, in different files. If one saved setup is built once per stage and shared by every file of that stage that needs it, the browser tier could drop by roughly **5 to 6.5 minutes out of 21.4 (about 25 to 30%)**. That is within one run, with nothing kept between runs. The proofs of concept, which shared only inside single files, pointed to 1 to 2 minutes; the difference is almost all cross-file sharing.

The three biggest wins:

1. **The standard three-Trade Review** (BREN, AXIO and DALE held, Marked to Mon 11-16). About 50 more tests in 12 files of d9 and d9ar build one of these three Trades alone, on top of the 21 tests the two proofs of concept already moved. About 2 minutes for stage 4 if all 71 share one build.
2. **O-C3 with the Thursday Hold** (buildOc3 with thursdayHold). Nine tests in d8, d8p and d8r each spend 6 to 7 s building it over eight browser launches. About 50 s for stage 3, and about 1 minute if the two plain O-C3 tests use it too (their checks suggest they can).
3. **The d5r card fixture** (createCardFixture). Thirteen tests in five d5r files. About half a minute for stage 2.

Suggested next proofs of concept: **O-C3 with the Thursday Hold across d8, d8p and d8r** (the biggest saving per test, and the first test of sharing across files), then **the standard Review spread to d9/replay.spec.ts, d9/review.spec.ts and d9ar/overlay.spec.ts** (to check that a worker fixture in a shared support file survives a change of file, with d95 in between).

## How the stages run

- playwright.config.ts sets workers: 1, and each browser stage is a separate playwright run (package.json test:e2e:1 to test:e2e:4). So every stage runs one test at a time: its wall-clock time is the sum of its tests' times plus a few seconds of start-up, and **a wall-clock saving equals the test-seconds saving** (less a few tenths of a second per extra worker change).
- Playwright matches the stage folders by prefix: test:e2e:2's e2e/d7 also runs d7p, d7s and d7sp; test:e2e:3's e2e/d8 runs d8, d8p and d8r; test:e2e:4's e2e/d9 runs d9, d95, d9ar and d9r2.
- Sum of test durations in the latest run: stage 1 326 s (127 tests), stage 2 312 s (79), stage 3 263 s (55), stage 4 380 s (114, 4 skipped). Total 1281 s, 21.4 min.
- A saved setup can be shared only inside one stage run. Sharing across stages, or between runs, needs the kept snapshot (level 2 of the proof-of-concept reports), which is not estimated here.

## Method

- **Same data.** Two calls are counted as one setup only when they build the same Trades with the same fills, Marks and actions, at the same clock, so that the stored journal is the same. A test that afterwards relaunches its own way (touch, offline, a later clock, a staged update) can still share it: it copies the profile and goes straight to its own launch ("copy only").
- **Build cost B.** From the group's lightest test, as plan section 2.1 did, less a small allowance for that test's own checks: about 0.3 s for a test that carries on, about 0.5 to 1 s for one that relaunches or has heavier checks. Checks against measured values: buildReview's lightest test is 5.1 s and its measured build 4.8 s; the one-Trade BREN build's lightest test is 2.6 s and its measured cost about 2.3 s.
- **Saving.** As the task set: (B − 0.6 s) for each test that carries on from the copy, and about B for a copy-only test (it skips the build and the build's launch, and pays only the 40 ms copy; the second proof of concept measured about 2.3 s for a 2.3 s build). Minus one build per worker. Durations are the latest run's, matched by file and line.
- **Workers.** A worker-scoped fixture is built once per worker. Playwright starts a new worker when the set of worker fixtures changes between files (the first proof of concept saw this as a 0.3 s changeover). Checked in the installed Playwright 1.63: the worker hash is the project plus a digest of the **worker-scoped** fixture registrations only (node_modules/playwright/lib/common/index.js, the end of the fixture pool's validate), and the dispatcher hands a test group to a free worker with the same hash (lib/runner/index.js, about line 5567). Test-scoped fixtures do not count. Every support file's `test` extends d1's `test` (d4's adds d4Release, d7's adds d7Faults, both test-scoped). If the snapshot fixtures are declared on d1's `test`, not automatic, every file has the same worker fixtures, the worker carries on across files, and each setup is built once per stage on first use. If they are declared lower in the chain, d95 (d4's `test`) sits between d9 and d9ar in stage 4 and forces a second build there. The estimates below allow one build per group per stage, and say where a second is likely.
- **Release.** The profile holds the service worker and its saved files, so a setup must be built on the release its tests serve: d1 and d2 serve dist-faults; d4, d5, d5r, d6, d7p and d95 take d4's `test` and serve dist-releases/current (d4Release; d7p/layout then switches to dist-faults inside the test); d7 and everything that imports from it (d7s, d8, d8p, d8r, d9, d9ar, d9r2) take d7's `test` and serve dist-faults (d7Faults).

## Ranked groups

Saving is per stage, in seconds, once per run. "Within a file" or "across files" says where the sharing happens. Tests are counted as Playwright cases (a test in a loop counts once per case).

| Rank | Setup (helper and data) | Stage | Tests | Files | B (s) | Saving (s) | Sharing |
|---|---|---|---|---|---|---|---|
| 1 | Standard Review: BREN, AXIO, DALE held (R-DALE-D) at Mon 11-16, through 10 (buildReview default; build(profile, BREN or AXIO or DALE_HOLD, closeOf('2026-11-16'), 10); buildReview(profile, [BREN])) | 4 | 50 new + 21 in the proofs of concept | 12 new + 2 | 4.8 shared (one-Trade builds 1.9 to 2.3) | about 80 for the new tests; about 125 with the two proof-of-concept files on the same build | across files |
| 2 | O-C3 with the Thursday Hold (buildOc3(profile, { thursdayHold: true }), and buildOc3Plus on top) | 3 | 9 (11 with rank 9) | 7 (9) | 6 to 7 | about 48 to 56; about 60 to 70 with rank 9 | across files |
| 3 | d5r card fixture at Mon 10-12 17:00 (onboardedAt(MONDAY_1700) + createCardFixture default) | 2 | 13 | 5 | about 3.2 | about 31 | across files (one folder) |
| 4 | d9r2 gap fixture (createGapFixture) | 4 | 16 | 5 | about 2.3 | about 26 | across files (one folder) |
| 5 | d6 T-A at Mon 10-12 17:00 (createTA, or createTrades(FOUR_TRADES.slice(0, 1))) | 2 | 10 | 7 | about 1.8 | about 16 | across files |
| 6 | d9 four Trades at Fri 11-13, through 9 (BREN, CORV, DALE-D, AXIO-U by buildOn) | 4 | 4 | 2 | about 5.9 | about 15 | across files |
| 7 | O-C3 without Tuesday's Review (buildOc3 with thursdayHold and noTuesdayReview) | 3 | 3 | 2 | about 6.7 | about 13 | across files |
| 8 | One XYZ Plan, journal seeded at Mon 10:05 (seedJournal(profile)) | 3 | 15 | 6 | about 1.0 (not measured) | about 13 (6 to 20) | across files (d8 only) |
| 9 | O-C3 plain (buildOc3(profile)) | 3 | 2 | 2 | 6 to 6.6 | about 6 alone, or 12 to 14 inside rank 2 | across files |
| 10 | D4's four Trades at Mon 10-12 17:00 (createTrades(page) default) | 1 | 8 | 4 | about 2.5 | about 13 | across files |
| 11 | d7 Settlement fixture at Tue 10:30 (createSettlementFixture) | 2 | 5 | 3 | about 2.5 | about 10 | across files |
| 12 | d7p worded-reasons scenario (launchScenario) | 2 | 3 | 1 | about 4 | about 8 | within a file |
| 13 | d2 ui-alignment's four Trades (seedTrades) | 1 | 6 | 1 | about 2.1 | about 7 | within a file |
| 14 | D4's five Trades with two XYZ (twoXyzReview) | 1 | 3 | 1 | about 3.6 | about 5 | within a file |
| 15 | O-S entered Mon 11:05 (onboard Mon 09:00, confirmOptionPlan(OS), entry at Mon 11:05) | 3 | 3 (4 with buildOs2x) | 3 (4) | about 2.4 | about 5 | across files |
| 16 | D4's four Trades with DEF sold Mon 15:00 | 3 | 3 | 3 | about 3.5 | about 5 (two tests add Marks on top) | across files |
| 17 | R-DALE-U to Thu 11-19, through 13, no Expiration (build(profile, DALE, closeOf('2026-11-19'), 13, 0)) | 4 | 3 | 3 | about 2.5 | about 5 | across files |
| 18 | CORV at Wed 11-11, through 7 | 4 | 6 | 5 | about 1.7 | about 3 to 5 | across files |
| 19 | T-A with Monday's XYZ Mark 52.00 (createTrades([FOUR_TRADES[0]]) + enterMark) | 1 | 6 | 4 | about 1.6 | about 4 | across files |
| 20 | Smaller: d2 one Open XYZ after PC1 (about 10 tests, about 5 s, unsure); d7 short put at Fri Nov 20 (3 tests, about 3 s); d95 ABC and DEF Marked Friday (3, about 3 s); d7s O-S2 with Tuesday's Marks (2 or 3, about 3 s); d7 O-S over two launches (2, about 2 s); AXIO at Mon 11-09 (2, under 1 s); openBreachedStockTrade (2, under 1 s) | | | | | about 20 together | |

## The groups in detail

Durations in seconds from the latest run. "Carry on" means the test goes on from the setup's page; "copy only" means it closes the setup and relaunches its own way.

### 1. Standard Review at Mon 11-16 (stage 4)

The second proof of concept found that build(profile, BREN, Mon 11-16, 10) records the same BREN Trade as buildReview's. build and buildReview record AXIO the same way too (partial sale first, then the Marks, same rows), and d9ar's DALE_HOLD (R-DALE-D, no buyback) is buildReview's third Trade. So every test below can start from the one three-Trade profile and open the Trade it needs by id.

New tests (50), by Trade:

- **BREN (31).** d9/estimates-a11y line 19 (2 cases, 3.4 and 2.9); d9/estimates openBren at lines 33, 76, 146 (3.2, 2.6, 2.7); d9/meter-detail lines 10, 32 (2.6, 2.7); d9/replay lines 17, 53, 92, 108, 131 (2.6 to 2.7 each); d9/review lines 11, 39 (2.8, 2.9; they open the Review); d9/session-cards line 7 (3.1); d9ar/cards lines 159 and 240 BREN case (3.5, 3.9); d9ar/chart lines 42, 221 BREN case, 250, 262, 306 BREN case (2.7, 2.8, 2.6, 2.8, 3.2); d9ar/overlay lines 11, 29, 54, 76 (2.6 to 2.7); d9ar/readout lines 29, 66, 152, 239 BREN case (2.6, 2.7, 2.7, 2.7); d9ar/sweep line 24 BREN case (4.2, copy only, touch launch).
- **AXIO (11).** d9ar/cards lines 105, 240 AXIO case; d9ar/chart lines 65, 127, 167, 306 AXIO case; d9ar/crossing-position line 10; d9ar/readout lines 76, 140, 239 AXIO case; d9ar/sweep AXIO case (copy only). 2.2 to 3.7 s.
- **DALE held (8).** d9ar/cards line 240 case; d9ar/chart lines 78, 306 case; d9ar/readout lines 114, 239 (three cases); d9ar/sweep case (copy only). 2.2 to 3.6 s.

Already moved by the proofs of concept, on the branch only (not on claude-opus-5.5): d9ar/review.spec.ts (5 tests) and d9ar/responsive-a11y.spec.ts (16 of 18 on the shared profile, 1 with CORV added on top, 1 on its own R-DALE-U build).

Estimate. BREN build about 2.3 s (measured), AXIO and DALE held about 1.9 s (their lightest tests are 2.2 s). Saving: 30 BREN tests × 1.7 + 1 copy-only × 2.2 + 10 AXIO × 1.3 + 1 × 1.8 + 7 DALE × 1.3 + 1 × 1.8 ≈ 79 s for the new tests. The two proof-of-concept files saved about 20 s and 34 s before paying their builds. One shared build of 4.8 s for all of them: about 79 + 20 + 34 − 4.8 ≈ 128 s; with a second build (fixture declared below d1's `test`, so d95 splits d9 from d9ar), about 123 s. **About 2 minutes of stage 4's 6.3.**

Subsets and on-top additions:
- A one-Trade test is a subset of the three-Trade profile. In the second proof of concept the extra two Trades changed no check on BREN's or DALE held's Trade Detail and overlay, nor on the Review card tests. AXIO's Trade Detail on the shared profile has not been tried.
- CORV at Mon 11-16, through 10 is not in the profile. Three tests use it: responsive-a11y's four-Trade chart test (already adds CORV on top, saved 3.84 s), d9ar/sweep's CORV case and d9ar/chart line 221's CORV case. Adding CORV on top saves nothing for the last two (CORV is all their build). Making CORV a fourth standard Trade (build about 2.3 s more, once) would save about 1.7 s for each of those two and about 2 s more for the four-Trade test, but every Review test would then show four cards (see risks).

Conflicts:
- **Same contract, other series.** R-DALE-U (DALE with the Expiration, or held on R-DALE-U) cannot join: one Mark per contract per session (second proof of concept). Groups 17 and 18 (R-DALE-U to Thu 11-19, CORV at Wed 11-11) and AXIO at Mon 11-09 also cannot join, because their clock and last Marked session differ: a test at Wed 11-11 must not see Marks dated after it.
- **Review tests.** d9/review lines 11 and 39 open the Review and work on BREN's card. With three cards, BREN's card may not be the one open on load. Both call reachCard(page, trade) first and then use tradeCard(page, trade) and openCardReplay(page, trade) (read), so they reach BREN's card by Trade, as the proof-of-concept Review tests do. Line 39 also checks the address (trade, panel and replay), which names BREN's Trade either way.
- **Counts.** A search of the 12 files for openReview, the Open list, toHaveCount, count(), toHaveLength, aria-expanded, probe, tradesOf, goBack and goForward found counts only inside one Trade's replay, chart, readout or Detail meter (session cards, chart marks, readout rows, chips). None counts Trades, cards, Open list rows or stored records. Only d9/review opens the Review.
- **Browser Back.** d9ar/overlay line 29 closes the overlay with page.goBack(). On a copy the history starts at the Trade Detail, not after the build's pages. The first proof of concept's Forward and Back test passed on a copy, but this test is the one to watch in d9ar/overlay.

Risks:
- **Worker restarts.** A failing test ends its worker, and the next test's worker rebuilds the setup (4.8 s each time). Only failing runs pay it.
- **Staged update.** responsive-a11y's staged-update test saved nothing in the second proof of concept. d9ar has no other update test.
- **Shared support file.** The fixture would move into a support file (d9ar/support.ts, or lower, see Method). That touches files other deliverables import, so it needs its own task and a full stage run.

### 2. O-C3 with the Thursday Hold (stage 3)

buildOc3(profile, { thursdayHold: true }) launches the browser eight times at eight clocks (Mon 09:00, Mon 10:05, Mon 17:00, Wed 08:00, Wed 11:05, Wed 17:00, Thu 17:00, Thu 18:00) and closes it each time. Every test then launches its own browser, so all of these are copy-only starts and save nearly the whole build.

- d8/backup line 11 (8.5, the lightest), d8/restore line 33 (11.9; builds on profile "a", then seeds a second profile), d8p/responsive-a11y lines 62 and 124 (16.2, 9.1), d8r/rail line 20 (9.7; opens at Thu 18:00, Fri 12:00 and Fri 18:00), d8r/responsive-a11y lines 78 and 107 (9.1, 20.8; line 107 adds O-S2X on top with addOs2x), d8r/today line 8 (9.5; opens at Thu 18:00, Fri 12:00, Sat 10:00).
- **On top:** d8r/plan-risk line 12 (9.2) uses buildOc3Plus, which is this setup plus one launch at Fri 11:05 that buys one more contract. It can copy the profile and run that one step itself.

Estimate: B 6 to 7 s. Backup's 8.5 s less its own launch and backup checks gives about 7 s; plan section 2.1 put this build at 6 to 6.5 s. Saving about 9 × B − B ≈ **48 to 56 s**, out of stage 3's 4.4 minutes. All these files take `test` from the same chain (d8 imports from d8p, d8r from d8p), so one build per stage is likely.

Subset: plain O-C3 (group 9: d8p/lot-matches-fit line 75, 7.6; d8p/payoff-fit line 23, 7.8) is this setup without the Thu 18:00 Hold. Both open the Trade Detail at Thu 18:00 and check only layout: lot-matches-fit checks that the Lot Matches columns fit at 1280 px with the realized figure +$98.70 (from Wednesday's sale), payoff-fit checks the Payoff chart's geometry at 1280, 375 and 320 px. A Hold is an Action, which changes neither the Lot Matches nor the Payoff chart, so they can very likely use this profile too: about 12 to 14 s more. Running them once on it would confirm.

Conflicts: the variant without Tuesday's Review (group 7: d8p/cockpit line 37, d8p/history lines 17 and 135) and the corrected Wednesday Mark (d8r/history line 16) store different facts and cannot share it. buildOc3BeforeMarks (d8r/today line 48) is a different, much smaller state.

Risks: the build ends with every browser closed at Thu 18:00, and the tests open at that clock or later, so no test goes back in time. d8/restore's second profile (seeded with ABC) stays its own. The backup test downloads the whole journal, which is the same data.

### 3. d5r card fixture (stage 2)

onboardedAt(profile, MONDAY_1700) then createCardFixture(page): T-A (two deferred entries, the first on Fri 10-09), T-B, T-C, T-E and T-F.

- d5r/marks lines 8, 75, 91, 112 (4.0, 3.7, 4.0, 4.3); d5r/responsive-a11y lines 9, 105 (8.1, 3.8); d5r/review lines 9, 93 (6.6, 11.7; line 93 adds 16 routine Trades on top); d5r/sliders lines 9, 29, 57 (3.8, 3.8, 4.4); d5r/durability lines 46 (5.3; opens the Review, then stops the server and relaunches offline, so nearly copy only) and 76 (5.0; enters a Mark, then relaunches in Recovery Only, so it carries on).
- Left out: d5r/marks line 39 (earlierDay '2026-10-08' builds T-A on another day), d5r/durability line 10 (a killable browser that is started its own way).

Estimate: B about 3.2 s. 12 carry on × 2.6 + 1 copy only × 3.2 − 3.2 ≈ **31 s**. One support file (d5r/support.ts), five spec files.

Risks: d5r/review line 9 checks which card opens first on load. That follows from the stored data, which is the same, but it is the test to watch. Line 93 relies on the routine Trades being added after the fixture, which the copy keeps.

### 4. d9r2 gap fixture (stage 4)

createGapFixture(profile): onboard at Wed 10-07 17:00, T-A with a Mark and an acknowledged session, setClock to Mon 10-12 17:00, T-F, Review open.

- d9r2/drafts lines 26, 77, 116, 147, 175 (3.0, 2.9, 3.1, 2.8, 3.6); d9r2/editor lines 9, 66, 90, 122 (4.6, 3.2, 3.6, 3.1; lines 66 and 90 open a second tab on the same context); d9r2/grid line 11 (2.9); d9r2/history line 21 (3.0); d9r2/responsive-a11y lines 16, 58 (three touch cases, copy only, 3.8 to 3.9) and 87.

Estimate: B about 2.3 s. 13 × 1.7 + 3 × 2.3 − 2.3 ≈ **26 s**. One support file, five spec files.

Risks: the setup moves the clock inside one browser session; a copy must launch straight at Mon 10-12 17:00 and open the Review. Anything the setup keeps only in memory or session storage (not in IndexedDB) is lost on relaunch; the drafts tests store drafts themselves after the setup, so probably nothing is lost.

### 5. d6 T-A (stage 2)

onboardedAt(profile, MONDAY_1700) then createTA(page), which is createTrades(page, FOUR_TRADES.slice(0, 1)).

- Copy only (they close and relaunch at Tue 10:05 or 14:05, some offline): d6/exit-requirements lines 9, 62 (2.8, 3.3); d6/exit line 10 (3.9); d6/no-save line 48 (3.7); d6/offline line 11 (3.8); d6/runtime-failure line 77 (2.7); d6/responsive-a11y lines 196, 248, 293 (3.1, 2.9, 3.0).
- Carry on: d6/exit-action line 9 (2.9).
- Left out: d6/kill (killable browser). FOUR_TRADES.slice(0, 2) and slice(0, 3) (d6/runtime-failure line 11, d6/responsive-a11y line 28, d6/close-review line 41) are bigger journals; they could add ABC and DEF on top, but they read the Closed and Open lists, so leave them.

Estimate: B about 1.8 s. 9 × 1.8 + 1 × 1.2 − 1.8 ≈ **16 s**.

### 6. d9 four Trades at Fri 11-13 (stage 4)

onboardedAt(closeOf('2026-11-13')) then buildOn for BREN, CORV, DALE-D and AXIO-U through session 9.

- d9/meter-a11y lines 81, 90, 118 (14.1, 6.4, 6.6); d9/open-list line 25 via fourTrades (6.4).

Estimate: B about 5.9 s. 4 × 5.3 − 5.9 ≈ **15 s**. It cannot join group 1: other clock, other last session, and DALE-D is the DALE contract on another series.

### 7. O-C3 without Tuesday's Review (stage 3)

d8p/cockpit line 37 (7.4), d8p/history lines 17, 135 (7.8, 7.2). All copy only. B about 6.7 s. Saving about 3 × 6.7 − 6.7 ≈ **13 s**. Cannot share group 2's profile (Tuesday's acknowledged Marks and Wednesday's Hold are missing here by design).

### 8. seedJournal (stage 3)

seedJournal(profile): onboard at Mon 10:05, confirm one XYZ Plan, close. Every test then relaunches at Mon 10:05, so all are copy only.

- d8/after-restore line 19; d8/backup lines 44, 80; d8/offline line 9; d8/recovery-only line 11; d8/responsive-a11y lines 16, 99, 172, 203, 239, 299; d8/restore lines 98, 140, 176, 212. 15 tests, 1.8 to 8.5 s.

Estimate: seedJournal's cost is not measured. A launch with onboarding takes about 1 s in total (d8/shell is 0.96 s with its checks; d8p/planned line 28, onboarding and an option Plan, is 1.2 s). Taking about 1 s: 15 × 1.0 − 1.0 ≈ **13 s**, between 6 and 20 s for a cost of 0.5 to 1.4 s. Low risk: the restore tests replace or keep this one journal, which is the same data each time.

### 10. D4's four Trades (stage 1)

onboardedAt(profile, MONDAY_1700) then createTrades(page) (XYZ with two entries, ABC, DEF, JKL).

- d4/card-helpers lines 22, 39, 59, 78, 108 (3.3, 3.5, 3.4, 3.6, 3.0); d4/responsive-a11y line 96 (3.6); d4/offline line 20 (8.0; completes Monday's Review, then stops the server); d4/review line 6 (6.5; checks the card order).

Estimate: B about 2.5 s. 8 × 1.9 − 2.5 ≈ **13 s**.

Conflict: twoXyzReview (group 14: d4/card-helpers lines 124, 140, 158) adds T-F, a second XYZ. It is a superset, but these tests check which XYZ card is open on load and the card order, so the four-Trade tests cannot use the five-Trade profile, nor the reverse. Group 14 can share its own profile within its file.

### 11. d7 Settlement fixture (stage 2)

onboardedAt(TUESDAY_1030) then createSettlementFixture: T-1 (O-C after X1), T-2 (stock), T-3 (O-S after S1). All five close and relaunch later (Fri Nov 20 or Mon Nov 23), so all copy only.

- d7/responsive-a11y lines 29, 124, 163 (15.4, 3.4, 3.6); d7/review-expiration line 13 (4.8); d7/runtime-failure line 11 (3.8).

Estimate: B about 2.5 s. 5 × 2.5 − 2.5 ≈ **10 s**.

### 12. d7p worded-reasons scenario (stage 2)

launchScenario: three Trades, XYZ sold in two parts, DEF's Monday Mark acknowledged, then the stored sell quantities edited on disk (writeSellQuantities) before the relaunch. Used by d7p/layout lines 54, 71, 120 (5.0, 5.1, 5.6), all on the dist-faults server.

Estimate: B about 4 s; copy the edited profile and launch. 3 × 4 − 4 ≈ **8 s**, within one file. Risk: the copy must be taken after the on-disk edit, and built on dist-faults.

### Smaller groups

- **13. d2/ui-alignment seedTrades** (lines 588, 634, 1477, 1558, 1596, 1870: 9.3, 2.6, 3.0, 2.8, 2.7, 3.6): XYZ and ABC entered, DEF and GHI planned. B about 2.1 s; about 7 s within the file. TD.10 has finished with this file.
- **15. O-S entered at Mon 11:05** (d8p/journal-final-session line 46, d8p/settlement-due-replay line 22, d8p/states line 28; all copy only, 3.0 to 3.2): about 5 s. buildOs2x (d8r/responsive-a11y line 91) records the same Plan and entry but confirms the Plan at Mon 11:05, not 09:00; it may join if that stamp is not read.
- **16. Four Trades with DEF sold** (d8p/lot-matches-fit line 55, d8p/journal-final-session line 14, d8p/states line 101): the same up to the sale; the last two then add Monday Marks (XYZ, and ABC) in one more launch. About 5 s.
- **17. R-DALE-U to Thu 11-19** (d9/open-list line 48, d9ar/chart line 315, d9ar/states line 48; all relaunch at Mon 11-23, copy only): about 5 s.
- **18. CORV at Wed 11-11, through 7** (d9/estimates line 102, d9/gaps line 9, d9ar/cards line 183, d9ar/chart lines 104 and the line 306 CORV case, d9ar/states line 105): about 3 to 5 s, less if d9 and d9ar each pay a build.
- **19. T-A with Monday's XYZ Mark** (d4/correct-mark line 6, d4/hold line 4, d4/responsive-a11y lines 39, 63, 120, d4/runtime-failure line 70; 2.1 to 2.9): about 4 s. d4/breach-overrun Marks 47.00 instead, so it cannot join.
- **d2, one Open XYZ after PC1**, about 10 tests (d2/narrow line 54, d2/open-position line 23, d2/runtime-failure line 21, d2/ui-alignment lines 362, 400, 984, 1183, 1659, 1792, 1826, and the integrity tests that then edit the stored records and relaunch). The build beyond onboarding is well under a second, close to the 0.6 s a copy costs, so about 5 s at best. Several tests check the entry itself (after-save, the receipt), and must keep recording it.
- **d95** (marks-keys, marks-step, slip-questions; 2.7 to 2.9): the same ABC and DEF Marked Friday, then setClock to Monday. About 3 s.
- **d7 short put at Fri Nov 20** (createShortPutTrade: d7/no-save line 52, d7/responsive-a11y line 225, d7/runtime-failure line 55): about 3 s. **d7s O-S2 with Tuesday's Marks** (d7s/conditions lines 25 and 65 share createOs2Trade plus Tuesday's markSession): about 3 s. **d7 O-S over two launches** (d7/settlement-due, d7/short-put): about 2 s.
- **An onboarded profile for every test** (level 3 of the reports): 37 test declarations in stage 1 do no more setup than onboarding before their checks (or do their own steps). Onboarding's share of a 1 s test is not known, and a copy and open costs about 0.5 s, so no saving is claimed.

## Total for the browser tier

Assumptions:
- One test at a time per stage (workers: 1), so a stage's saving is the sum of its groups' savings.
- Each setup is a worker fixture declared on d1's `test` and not automatic, so every file of a stage has the same worker hash and the setup is built once per stage on first use (the worker-reuse rule was read in the Playwright source; it has not been run). If it is declared lower in the chain, add one build per extra worker (about 2 to 7 s per group; for the standard Review, d95 sits between d9 and d9ar in stage 4's run order).
- Build costs other than buildReview (4.8 s) and the one-Trade BREN build (2.3 s) are estimates from the lightest test, not measurements.
- A copy-only start saves about the whole build; a carry-on start saves the build less 0.6 s.
- No test fails in the run (a failure restarts the worker and rebuilds its setups).
- Each test's checks pass unchanged on the shared data. This is checked here only by reading the setup lines, not each test's checks.

| Stage | Now | Groups counted | Saving | After |
|---|---|---|---|---|
| browser-1 | 5.5 min | 10, 13, 14, 19, d2 PC1 | about 35 s | about 4.9 min |
| browser-2 | 5.2 min | 3, 5, 11, 12, short put, O-S2, O-S | about 74 s | about 4.0 min |
| browser-3 | 4.4 min | 2 (with 9), 7, 8, 15, 16 | about 95 to 105 s | about 2.7 to 2.8 min |
| browser-4 | 6.3 min | 1 (with the proof-of-concept files), 4, 6, 17, 18, d95 | about 175 to 180 s | about 3.3 min |
| **Tier** | **21.4 min** | everything above | **about 6.3 to 6.6 min (29 to 31%)** | **about 15 min** |

Top candidates only (ranks 1 to 8 and 10: the standard Review with the proof-of-concept files, O-C3 with the Hold and the plain O-C3, the d5r card fixture, the gap fixture, d6 T-A, the four Trades at Fri 11-13, O-C3 without Tuesday's Review, seedJournal and D4's four Trades): about 125 + (60 to 70) + 31 + 26 + 16 + 15 + 13 + 13 + 13 ≈ 310 to 320 s, **about 5.2 to 5.4 minutes (25%)**, the tier at about 16 minutes. These nine groups need seven support-file changes (d9ar or lower, d8p, d5r, d9r2, d6, d8, d4).

How this compares with the reports: the second proof of concept estimated 1 to 2 minutes for sharing inside files. Sharing across the files of a stage reaches most of what it put at 3 to 5 minutes for a snapshot kept between runs, without the stamp file and the staleness risk, because each stage builds each setup once per run. A kept snapshot would add at most about one build per group per stage (about 1 minute for the whole tier).

## Which to try next

1. **O-C3 with the Thursday Hold, across d8, d8p and d8r (rank 2).** The biggest saving per test (about 7 s, all copy-only starts), only nine tests, and the first test of a worker fixture shared across files and folders in one stage. It also checks that a profile built over eight launches survives the copy, and lets the plain O-C3 question (does the Thu 18:00 Hold change the Lot Matches and Payoff checks?) be answered by running lot-matches-fit and payoff-fit on it. Measure stage 3 before and after: expect about 50 to 70 s off 4.4 min.
2. **The standard Review spread across d9 and d9ar (rank 1).** Start with d9/replay.spec.ts (5 tests) and d9ar/overlay.spec.ts (4 tests), which are BREN only, plus the two Review tests in d9/review.spec.ts. That checks the cross-file worker reuse with d95 in between, whether the two d9/review tests are happy with three cards, and whether overlay line 29's browser Back works on a copy. Then roll out to the rest of the 50.

## Appendix A: setup helpers

Helpers that plan, enter or Mark Trades (or seed a journal) before a test checks anything. "Launches" counts browser launches inside the helper.

| Helper | Where | What it builds | Launches |
|---|---|---|---|
| onboardedAt(profile, instant) | d4/support.ts | Launch at a pinned clock, onboard (Fidelity, Roth IRA) | 1 |
| onboardedPage(context), onboardedD1Page | d1/support.ts, d2/support.ts | Onboard on a context the test launched | 0 |
| confirmPlan, confirmReference, confirmD1Plan | d1, d2 support | One stock Plan (XYZ by default) | 0 |
| recordEntry(page, rows) with PC1, PC2, PC3 | d2/support.ts | Position Changes on the open Trade | 0 |
| createTrades(page, trades = FOUR_TRADES) | d4/support.ts | Plans and entries: XYZ (60 + 40), ABC, DEF, JKL, all Mon 10-12 | 0 |
| createTradeAt(page, plan, planTime, fills) | d4/support.ts | One stock Trade at given times | 0 |
| enterMark, acknowledgeMark | d4/support.ts | One Mark (or an acknowledged gap) in the Review | 0 |
| createCardFixture(page, { earlierDay }) | d5r/support.ts | T-A (deferred entries, first on Fri 10-09), T-B, T-C, T-E, T-F | 0 |
| createRoutineTrades(page, n) | d5r/support.ts | n one-entry stock Trades | 0 |
| startEntry, deferEntry | d5/support.ts | An entry with its reflection deferred | 0 |
| createTA(page) | d6/support.ts | createTrades(FOUR_TRADES.slice(0, 1)) | 0 |
| createSettlementFixture(page) | d7/support.ts | T-1 (O-C after a sale), T-2 (stock), T-3 (O-S) | 0 |
| createShortPutTrade(page) | d7/support.ts | O-S with its Sell to open | 0 |
| confirmOptionPlan, recordOptionEntry, recordOptionExit | d7/support.ts | Option Plan, entry, exit | 0 |
| createOs2Trade(page), confirmBothKinds | d7s/support.ts | O-S2 with both kinds of conditions and its entry | 0 |
| writeSellQuantities(dir, ...) | d7p/support.ts | Edits stored sells on disk (no browser) | 0 |
| seedJournal(profile, instant, values) | d8/support.ts | Onboard and one Plan, then close | 1 |
| installDump(dir, ...) | d8/support.ts | Writes a v5 Workspace dump into the profile (no browser) | 0 |
| writeIntegrityFixture(dir, edit) | d2/support.ts | Edits stored records on disk (no browser) | 0 |
| confirmOc3, buildOc3(profile, { thursdayHold, correctedWednesdayXyz, noTuesdayReview }) | d8p/support.ts | O-C3 over a week: Plan, entry, Marks Mon, Wed, Thu, Tuesday acknowledged, a Hold, a partial sale with reflection deferred | 7 or 8 (6 without Tuesday's Review) |
| at(profile, instant, step) | d8p/support.ts | One launch at a clock for one step | 1 |
| openDetailAt(profile, instant, trade) | d8p/support.ts | Launch and open a Trade Detail | 1 |
| buildOc3Plus, buildOc3BeforeMarks | d8r/support.ts | O-C3 plus a Friday entry; O-C3's Plan and entry only | 9; 2 |
| addOs2x, buildOs2x, addK1 | d8r/support.ts | O-S2X; O-S2X on a fresh profile; K1 sold out | 1; 2; 2 |
| openBreachedStockTrade(profile) | d8r/support.ts | XYZ with Monday's Mark 47.00, Detail open | 1 |
| build(profile, fixture, clock, through, recorded), buildOn, buildPlanned | d9/support.ts | One section-5 Trade (BREN, CORV, AXIO, DALE and variants) planned, entered and Marked through a session | 1 (buildOn 0) |
| buildReview(profile, fixtures = [BREN, AXIO, DALE_HOLD], through = 10) | d9ar/support.ts | Several Trades in one launch, ending on the Review | 1 |
| launchTouchAt(profile, instant, width) | d9ar/support.ts | A touch launch | 1 |
| createGapFixture(profile) | d9r2/support.ts | T-A held since Aug 31 with gaps and an acknowledged session, T-F bought Mon 10-12, clock moved | 1 |
| Spec-local wrappers | d2/ui-alignment (seedTrades, openTradeWithJournal), d4/card-helpers (twoXyzReview), d4/offline (completeReview), d5/review-debt (deferredThenMondayReview), d6/close-review (closeWithCloseReviewLater), d7p/layout (launchScenario, sellXyzInTwoParts), d7s/conditions (markSession), d7/payoff-chart-layout (reachCharts), d9/estimates (openBren), d9/open-list (fourTrades) | Their file's setups | varies |

## Appendix B: every test in the browser tier

One row per test declaration that ran in the latest run (352 declarations, 379 cases; a declaration in a loop shows one duration per case). d9ar/label-sweep (4 cases) is listed but was skipped in the run, so it has no duration. Left out: d2/migration lines 48 and 123 (tagged for the release-history run, not in the tier) and e2e/smoke (in no stage). Setup is the helper calls in the test's body, abbreviated, as a script read them; a test whose own steps are the behaviour under test shows them too. Flags come from the body: relaunch (two or more browser launches in the test, counting those inside helpers such as build, seedJournal and buildOc3), touch, offline (offline: true or the server stopped), update (a staged release), kill (a killable browser). Group is the rank in the table above, when the test belongs to one.

| Stage | File:line | Test | Cases: s | Setup | Flags | Group |
|---|---|---|---|---|---|---|
| 1 | d1/identity.spec.ts:6 | should serve a complete manifest and digest-valid inventory and reach Writable with all four chec... | 2: 1.5, 0.983 | onboardedPage(context) |  |  |
| 1 | d1/integrity-blocked.spec.ts:6 | should block a root at version 99 created before launch, offering only Retry and leaving the root... | 1: 0.596 | (none) |  |  |
| 1 | d1/integrity-blocked.spec.ts:38 | should block a pointer whose Workspace database was deleted, keeping the pointer and creating no ... | 1: 0.999 | onboardedPage(context) |  |  |
| 1 | d1/no-save.spec.ts:50 | should store no Entry, Trade, draft, or Web Storage value after typing, resizing, leaving, and re... | 1: 1.8 | onboardedPage(context) | relaunch |  |
| 1 | d1/offline.spec.ts:4 | should open Writable without a network, confirm a second Plan and add an Account, and keep both a... | 1: 2.6 | confirmPlan(await onboardedPage(online)); confirmPlan(page, { ...PLAN, symbol: 'ABC' }) | relaunch, offline |  |
| 1 | d1/onboarding.spec.ts:5 | should show the protection warning on first run and onboarding, and reuse an Institution saved wi... | 1: 1.1 | (none) |  |  |
| 1 | d1/plan.spec.ts:7 | should show the Plan, 1R, and reflection after relaunch, with one Trade, one Entry, and Planned i... | 1: 1.8 | onboardedPage(context); confirmPlan(page) | relaunch |  |
| 1 | d1/plan.spec.ts:39 | should keep the complete Plan, with its Entry, after the browser process is killed once the confi... | 1: 1.5 | spawnedBrowser(profile.dir, 9333); onboardedPage(killed.context); confirmPlan(page); spawnedBrowser(profile.dir, 9334) | relaunch, kill |  |
| 1 | d1/readiness.spec.ts:7 | should show Unsupported naming exactly diagnostic, with Retry and the another-browser recommendat... | 2: 0.653, 0.634 | (none) |  |  |
| 1 | d1/readiness.spec.ts:27 | should stay Writable with the warning and durability action while unprotected, and report the req... | 1: 1.4 | onboardedPage(context); confirmPlan(page) |  |  |
| 1 | d1/recovery-only.spec.ts:4 | should open Recovery Only with the failed checks for each fault set, keeping the Plan readable an... | 1: 5 | onboardedPage(setup); confirmPlan(first) | relaunch |  |
| 1 | d1/responsive-a11y.spec.ts:33 | should switch layout at 960 px with the route and entered values intact | 1: 0.97 | onboardedPage(context) |  |  |
| 1 | d1/responsive-a11y.spec.ts:57 | should report no WCAG 2.1 AA violations in any D1 view state | 1: 4.9 | (none) | relaunch |  |
| 1 | d1/responsive-a11y.spec.ts:135 | should complete onboarding and a Plan with the keyboard only, with visible focus throughout | 1: 1.1 | (none) |  |  |
| 1 | d1/runtime-failure.spec.ts:5 | should explain RuntimeNotWritable, keep the form values, and switch to Recovery Only when invento... | 2: 1.1, 1.1 | onboardedPage(context) |  |  |
| 1 | d1/update.spec.ts:42 | should notify only once v2 is waiting, defer Reload while the form is unsaved, then activate v2 w... | 1: 3.7 | onboardedPage(context) | update |  |
| 1 | d1/update.spec.ts:74 | should show no notice, keep v1 in control, and leave no v2 cache when the update fails verification | 1: 2.5 | onboardedPage(context) | update |  |
| 1 | d1/update.spec.ts:90 | should show no notice offline and keep v1 running and Writable | 1: 2.5 | onboardedPage(context) | offline, update |  |
| 1 | d1/update.spec.ts:111 | should explain in the clean tab that another tab has unsaved work, keeping Reload disabled until ... | 1: 2.5 | onboardedPage(context) | update |  |
| 1 | d1/update.spec.ts:133 | should defer Reload and explain in a tab opened later, where "Check for updates" reports the wait... | 1: 2.5 | onboardedPage(context) | update |  |
| 1 | d2/after-save.spec.ts:15 | should replace the entry form history entry with the Trade Detail once saved, so reload, Back and... | 1: 1.5 | onboardedPage(context); confirmReference(page); recordEntry(page, PC1) |  |  |
| 1 | d2/cockpit-layout.spec.ts:18 | should place the rail beside the drawers at a wide viewport, with the banner across both, and sta... | 1: 2.6 | onboardedPage(setup); confirmReference(first); recordEntry(first, PC1); writeIntegrityFixture(profile.dir, { kind: 'StoredLifecycle', underlying: 'XYZ', lifecy... | relaunch |  |
| 1 | d2/durability.spec.ts:22 | should keep the Position Change, its Executions, lifecycle Open, and the reflection after the bro... | 1: 2 | spawnedBrowser(profile.dir, 9337); onboardedPage(killed.context); confirmReference(page); recordEntry(page, PC1) | relaunch, kill |  |
| 1 | d2/integrity.spec.ts:19 | should show the integrity panel in Detail and the badge in the list for an Open Trade stored as P... | 1: 2.5 | onboardedPage(setup); confirmReference(page); recordEntry(page, PC1); writeIntegrityFixture(profile.dir, { kind: 'StoredLifecycle', underlying: 'XYZ', lifecy... | relaunch |  |
| 1 | d2/integrity.spec.ts:58 | should show the row with Facts can't be replayed and Not available in each derived cell, linking ... | 1: 3.1 | onboardedPage(setup); confirmReference(page, SECOND_PLAN); confirmReference(page); recordEntry(page, PC1) | relaunch |  |
| 1 | d2/integrity.spec.ts:92 | should not offer Record entry on an incoherent Detail, explain why beside the Facts can't be repl... | 1: 2.6 | onboardedPage(setup); confirmReference(page); recordEntry(page, PC1); writeIntegrityFixture(profile.dir, { kind: 'UnknownPlannedLeg', underlying: 'XYZ' }) | relaunch |  |
| 1 | d2/migration.spec.ts:87 | should show Migration Blocked with "Your data is unchanged" and Retry, leave the old stores uncha... | 1: 3.8 | onboardedD1Page(context); confirmD1Plan(page, PLAN); confirmD1Plan(page, SECOND_PLAN) | update |  |
| 1 | d2/migration.spec.ts:171 | should complete the migration on relaunch without faults, with the pre-update data and no candida... | 1: 5.1 | spawnedBrowser(profile.dir, 9335); onboardedD1Page(killed.context); confirmD1Plan(page, PLAN); confirmD1Plan(page, SECOND_PLAN) | relaunch, update, kill |  |
| 1 | d2/narrow.spec.ts:54 | should keep the Open list page within 375 and 320 px with the table scrolling inside its own region | 1: 1.6 | onboardedPage(context); confirmReference(page); recordEntry(page, PC1) |  |  |
| 1 | d2/narrow.spec.ts:72 | should keep the Open Trade Detail within 375 and 320 px with every table inside a scroll container | 1: 3.8 | onboardedPage(setup); confirmReference(page); recordEntry(page, PC1); recordEntry(page, PC2) | relaunch |  |
| 1 | d2/narrow.spec.ts:108 | should keep the Planned list page within 375 and 320 px with the table inside its own scroll region | 1: 1.4 | onboardedPage(context); confirmReference(page) |  |  |
| 1 | d2/narrow.spec.ts:127 | should keep About within 375 and 320 px with its long identifiers wrapping | 1: 1 | onboardedPage(context) |  |  |
| 1 | d2/narrow.spec.ts:141 | should keep first run, onboarding, Accounts, the New Plan form and the Planned Detail within 375 ... | 1: 1.4 | (none) |  |  |
| 1 | d2/no-save.spec.ts:62 | should store no Position Change, Entry, decline, draft, or Web Storage value after filling rows a... | 1: 1.9 | onboardedPage(context); confirmReference(page) | relaunch |  |
| 1 | d2/no-save.spec.ts:111 | should keep the entered values through Load the latest Trade and then record a second Position Ch... | 1: 2 | onboardedPage(context); confirmReference(pageA); recordEntry(pageB, PC2) |  |  |
| 1 | d2/offline.spec.ts:17 | should open Writable offline, record PC2, and keep it across another offline restart | 1: 3 | onboardedPage(online); confirmReference(first); recordEntry(first, PC1); recordEntry(page, PC2) | relaunch, offline |  |
| 1 | d2/open-position.spec.ts:23 | should show Open, Position 60, two Lots, one Position Change with two Executions, and 60 of 100 a... | 1: 2.2 | onboardedPage(context); confirmReference(page); recordEntry(page, PC1) | relaunch |  |
| 1 | d2/open-position.spec.ts:60 | should show Entry Quality, an Entry Size Deviation of 20 naming its causing Position Change, and ... | 1: 2.2 | onboardedPage(context); confirmReference(page); recordEntry(page, PC1); recordEntry(page, PC2) |  |  |
| 1 | d2/open-position.spec.ts:96 | should say on the receipt that the Entry Size Deviation changed from 20 to 60 shares above plan, ... | 1: 2.2 | onboardedPage(context); confirmReference(page); recordEntry(page, PC1); recordEntry(page, [{ quantity: '60', price: '50.30', fee: '1.00', time: '2026-10-12T11:... |  |  |
| 1 | d2/responsive-a11y.spec.ts:60 | should keep three Execution rows and the reflection answers through 390 px and back, switching la... | 1: 1.6 | onboardedPage(context); confirmReference(page) |  |  |
| 1 | d2/responsive-a11y.spec.ts:92 | should report no WCAG 2.1 AA violations on the entry form, the Open list in every state, the Open... | 1: 10.1 | onboardedPage(context); confirmReference(page); recordEntry(page, PC2); recordEntry(page, PC3, { decline: 'Added into strength.' }) | relaunch, update |  |
| 1 | d2/responsive-a11y.spec.ts:182 | should report no WCAG 2.1 AA violations on the entry form Not Found and Error states | 1: 2.9 | onboardedPage(context); confirmReference(page); recordEntry(page, PC1); writeIntegrityFixture(profile.dir, { kind: 'MissingMember', underlying: PLAN.symbol }) | relaunch |  |
| 1 | d2/responsive-a11y.spec.ts:208 | should complete an entry with the keyboard only, with visible focus throughout | 1: 1.3 | onboardedPage(context); confirmReference(page) |  |  |
| 1 | d2/runtime-failure.spec.ts:21 | should keep the Open list and Detail readable with no Record entry, and leave the stores unchanged | 1: 2.1 | onboardedPage(setup); confirmReference(first); recordEntry(first, PC1) | relaunch |  |
| 1 | d2/runtime-failure.spec.ts:48 | should explain Record entry isn't available on a direct link while Recovery Only, with a link bac... | 1: 1.7 | onboardedPage(setup); confirmReference(first) | relaunch |  |
| 1 | d2/runtime-failure.spec.ts:70 | should explain RuntimeNotWritable, keep the entry form values, and record no Position Change | 1: 1.4 | onboardedPage(context); confirmReference(page) |  |  |
| 1 | d2/ui-alignment.spec.ts:53 | should keep every bottom bar link inside the viewport with no horizontal overflow in the bar | 1: 1 | onboardedPage(context) |  |  |
| 1 | d2/ui-alignment.spec.ts:87 | should fill the current sidebar link with ink and white text | 1: 0.986 | onboardedPage(context) |  |  |
| 1 | d2/ui-alignment.spec.ts:109 | should stack each bottom bar icon above its label | 1: 1.1 | onboardedPage(context) |  |  |
| 1 | d2/ui-alignment.spec.ts:136 | should show a focusable warning icon linking to About and no storage card outside About at 320, 3... | 1: 4.8 | onboardedPage(context) |  |  |
| 1 | d2/ui-alignment.spec.ts:218 | should put the storage icon at the far right of the title row on Trades, a Detail, New Plan and A... | 1: 7.7 | onboardedPage(context) |  |  |
| 1 | d2/ui-alignment.spec.ts:309 | should keep the storage banner compact with the warning ground on first run and account onboardin... | 1: 1.4 | (none) |  |  |
| 1 | d2/ui-alignment.spec.ts:362 | should keep the heading, tabs and first card on one left edge on Trades and Open Detail at 1280 | 1: 1.6 | onboardedPage(context); confirmReference(page); recordEntry(page, PC1) |  |  |
| 1 | d2/ui-alignment.spec.ts:384 | should keep a 16 px gutter on first run and onboarding at 390 and 320 | 1: 1.6 | (none) |  |  |
| 1 | d2/ui-alignment.spec.ts:400 | should keep a 16 px gutter on Trades and Open Detail at 390 and 320 | 1: 3.4 | onboardedPage(context); confirmReference(page); recordEntry(page, PC1) |  |  |
| 1 | d2/ui-alignment.spec.ts:417 | should keep a 16 px gutter on Migration Blocked at 390 and 320 | 1: 3.6 | onboardedD1Page(context); confirmD1Plan(page, PLAN); confirmD1Plan(page, SECOND_PLAN) | update |  |
| 1 | d2/ui-alignment.spec.ts:588 | should pin Underlying, keep Underlying and Trade in view and show each figure once in both tables... | 1: 9.3 | onboardedPage(context); seedTrades(page) |  | 13 |
| 1 | d2/ui-alignment.spec.ts:602 | should keep a Records disagree badge inside the viewport with the Trade cell at 390 and 320 | 1: 4.3 | onboardedPage(setup); confirmReference(page, { ...PLAN, symbol: 'ABC' }); recordEntry(page, PC1); confirmReference(page, { ...PLAN, symbol: 'XYZ' }) | relaunch |  |
| 1 | d2/ui-alignment.spec.ts:634 | should show one-line uppercase headers, a bold symbol link and right-aligned tabular figures at 1280 | 1: 2.6 | onboardedPage(context); seedTrades(page) |  | 13 |
| 1 | d2/ui-alignment.spec.ts:680 | should keep a Records disagree badge and dates on one line in a wide row | 1: 2.5 | onboardedPage(setup); confirmReference(page, { ...PLAN, symbol: 'ABC' }); recordEntry(page, PC1); writeIntegrityFixture(profile.dir, { kind: 'StoredLifecycle', underlying: 'ABC', lifecy... | relaunch |  |
| 1 | d2/ui-alignment.spec.ts:705 | should give every tone text that reaches 4.5:1 on its background and use neither the green nor th... | 1: 0.881 | onboardedPage(context) |  |  |
| 1 | d2/ui-alignment.spec.ts:826 | should render prompt chips as borderless groups with an ink checked chip and a visible focus ring... | 1: 1.9 | onboardedPage(context); confirmReference(page) |  |  |
| 1 | d2/ui-alignment.spec.ts:841 | should distinguish a checked chip from an unchecked chip and keep the focus ring in forced colors | 1: 1.1 | onboardedPage(context) |  |  |
| 1 | d2/ui-alignment.spec.ts:875 | should render each Execution as a rounded panel with Quantity, Price and Fee in a grid and Econom... | 1: 1.2 | onboardedPage(context); confirmReference(page) |  |  |
| 1 | d2/ui-alignment.spec.ts:940 | should group the New Plan controls into Trade, Risk and Plan Reflection cards with a two-column R... | 1: 0.974 | onboardedPage(context) |  |  |
| 1 | d2/ui-alignment.spec.ts:984 | should stack the expanded labels above their values at 320, keep each row time on one line, and c... | 1: 1.8 | onboardedPage(context); confirmReference(page); recordEntry(page, PC1) |  |  |
| 1 | d2/ui-alignment.spec.ts:1102 | should lay Plan Baseline and Entry Quality out as a two-column figure grid at 1280 with no row wi... | 1: 1.9 | onboardedPage(context); openTradeWithJournal(page) |  |  |
| 1 | d2/ui-alignment.spec.ts:1130 | should show Plan Reflection answers as prose sections with hairline dividers | 1: 1.2 | onboardedPage(context); confirmReference(page) |  |  |
| 1 | d2/ui-alignment.spec.ts:1165 | should put each Execution row on the tint | 1: 1.9 | onboardedPage(context); openTradeWithJournal(page) |  |  |
| 1 | d2/ui-alignment.spec.ts:1183 | should style the receipt rows as Execution rows and Back to the Trade as an ink pill link | 1: 1.6 | onboardedPage(context); confirmReference(page); recordEntry(page, PC1) |  |  |
| 1 | d2/ui-alignment.spec.ts:1214 | should list Accounts as rows with no bullets | 1: 1.2 | onboardedPage(context) |  |  |
| 1 | d2/ui-alignment.spec.ts:1245 | should not overflow at 320 and 390 and stay axe clean on the Detail, the receipt and Accounts | 1: 3.7 | onboardedPage(context); confirmReference(page); recordEntry(page, PC1); recordEntry(page, PC2, { decline: true }) |  |  |
| 1 | d2/ui-alignment.spec.ts:1279 | should lead the summary card of a just-confirmed Planned Detail, and of the same Detail reloaded,... | 1: 1.2 | onboardedPage(context); confirmReference(page) |  |  |
| 1 | d2/ui-alignment.spec.ts:1312 | should keep every label/value row on the Planned and Open Details at most 480 px wide at 1280 | 1: 2.1 | onboardedPage(context); confirmReference(page); recordEntry(page, PC1) |  |  |
| 1 | d2/ui-alignment.spec.ts:1338 | should show Net cost once in the accessibility tree of an incoherent Open row at 1280, 390 and 320 | 1: 2.5 | onboardedPage(setup); confirmReference(page, { ...PLAN, symbol: 'ABC' }); recordEntry(page, PC1); writeIntegrityFixture(profile.dir, { kind: 'UnknownPlannedLeg', underlying: 'ABC' }) | relaunch |  |
| 1 | d2/ui-alignment.spec.ts:1365 | should mark a blank Stop and a blank Target, not the valid Intended entry, after Confirm Plan | 1: 2.2 | onboardedPage(context) |  |  |
| 1 | d2/ui-alignment.spec.ts:1384 | should show 1R and Reward : risk once in the accessibility tree of an incoherent Planned row at 1... | 1: 2.9 | onboardedPage(setup); confirmReference(page, { ...PLAN, symbol: 'ABC' }); recordEntry(page, PC1); writeIntegrityFixture(profile.dir, { kind: 'StoredLifecycle', underlying: 'ABC', lifecy... | relaunch |  |
| 1 | d2/ui-alignment.spec.ts:1477 | should keep the Underlying header on one line and each Trade cell's "@" with its price at 320, 39... | 1: 3 | onboardedPage(context); seedTrades(page) |  | 13 |
| 1 | d2/ui-alignment.spec.ts:1507 | should keep "@" with its price in the Detail Trade Summary text at 320, 340 and 390 | 1: 2 | onboardedPage(context); confirmReference(page, planned); confirmReference(page, open); recordEntry(page, rows) |  |  |
| 1 | d2/ui-alignment.spec.ts:1558 | should keep the Underlying and Trade cells, with the second line and any badge, inside the scroll... | 1: 2.8 | onboardedPage(context); seedTrades(page) |  | 13 |
| 1 | d2/ui-alignment.spec.ts:1576 | should keep a Records disagree badge inside the scroll region at 320 and 390 | 1: 2.5 | onboardedPage(setup); confirmReference(page, { ...PLAN, symbol: 'ABC' }); recordEntry(page, PC1); writeIntegrityFixture(profile.dir, { kind: 'StoredLifecycle', underlying: 'ABC', lifecy... | relaunch |  |
| 1 | d2/ui-alignment.spec.ts:1596 | should keep the UNDERLYING header inside its own cell on one line at 320 and 390 | 1: 2.7 | onboardedPage(context); seedTrades(page) |  | 13 |
| 1 | d2/ui-alignment.spec.ts:1640 | should read each Detail Execution as one phrase with the price straight after the "@" at 320, 390... | 1: 1.9 | onboardedPage(context); openTradeWithJournal(page) |  |  |
| 1 | d2/ui-alignment.spec.ts:1659 | should read each receipt row as one phrase with the price after the "@" and no fee at 320, 390 an... | 1: 1.5 | onboardedPage(context); confirmReference(page); recordEntry(page, PC1) |  |  |
| 1 | d2/ui-alignment.spec.ts:1699 | should put the second line at or below the amount on the receipt and in Entry Quality at 320 and ... | 1: 2 | onboardedPage(context); confirmReference(page); recordEntry(page, PC1); recordEntry(page, PC2, { decline: true }) |  |  |
| 1 | d2/ui-alignment.spec.ts:1730 | should align the Fulfillment row with the other rows, set Journal answers below their questions, ... | 1: 2.2 | onboardedPage(context); confirmReference(page) |  |  |
| 1 | d2/ui-alignment.spec.ts:1792 | should keep the date and time of the receipt heading on one line at 320, 340 and 390 | 1: 2 | onboardedPage(context); confirmReference(page); recordEntry(page, PC1) |  |  |
| 1 | d2/ui-alignment.spec.ts:1826 | should draw Open Lots without a pinned hairline and with its last row on the card's row edges at ... | 1: 1.6 | onboardedPage(context); confirmReference(page); recordEntry(page, PC1) |  |  |
| 1 | d2/ui-alignment.spec.ts:1870 | should keep the Trades table caption in view after scrolling the region fully right at 320 and 390 | 1: 3.6 | onboardedPage(context); seedTrades(page) |  | 13 |
| 1 | d4/acknowledge.spec.ts:6 | should complete with Unavailable Marks naming DEF, go Incomplete when withdrawn, and complete aft... | 1: 4 | onboardedAt(profile, MONDAY_1700); createTrades(page, [FOUR_TRADES[0]!, FOUR_TRADES[2]!]); openReview(page); enterMark(page, 'XYZ', DATE, '52.00') |  |  |
| 1 | d4/breach-overrun.spec.ts:11 | should show Stop Breached with Risk to stop $0.00 and Stop Overrun $50.00 and no Deviation, then ... | 1: 2.7 | onboardedAt(profile, MONDAY_1700); createTrades(page, [FOUR_TRADES[0]!]); openReview(page); enterMark(page, 'XYZ', 'Mon Oct 12', '47.00') |  |  |
| 1 | d4/card-helpers.spec.ts:22 | should return ABC’s Monday cell in the Marks step, empty, and leave ABC’s card collapsed and XYZ’... | 1: 3.3 | onboardedAt(profile, MONDAY_1700); createTrades(page); openReview(page) |  |  |
| 1 | d4/card-helpers.spec.ts:39 | should leave XYZ’s card on its Action panel, with a typed Intent, unchanged when XYZ’s Action for... | 1: 3.5 | onboardedAt(profile, MONDAY_1700); createTrades(page); openReview(page) |  |  |
| 1 | d4/card-helpers.spec.ts:59 | should fail naming XYZ’s and ABC’s cards when reaching ABC’s card is refused while XYZ’s card hol... | 1: 3.4 | onboardedAt(profile, MONDAY_1700); createTrades(page); openReview(page) |  |  |
| 1 | d4/card-helpers.spec.ts:78 | should reach ABC’s card with no hold message while XYZ’s card holds only a Mark draft, and keep t... | 1: 3.6 | onboardedAt(profile, MONDAY_1700); createTrades(page); openReview(page) |  |  |
| 1 | d4/card-helpers.spec.ts:93 | should reach BRK’s card, not BRK.B’s, when both Trades are listed | 1: 2.2 | onboardedAt(profile, MONDAY_1700); createTrades(page, [; openReview(page) |  |  |
| 1 | d4/card-helpers.spec.ts:108 | should return the Marks family’s row for XYZ on a previous release’s Review (dist-releases/d4) | 1: 3 | onboardedAt(profile, MONDAY_1700); createTrades(page); openReview(page) |  |  |
| 1 | d4/card-helpers.spec.ts:124 | should return the one XYZ Monday cell in the Marks step for the second XYZ Trade, opening no card | 1: 4.1 | onboardedAt(profile, MONDAY_1700); twoXyzReview(page) |  | 14 |
| 1 | d4/card-helpers.spec.ts:140 | should fail naming both XYZ cards, the holder found by its list item’s Trade id, when reaching th... | 1: 4.1 | onboardedAt(profile, MONDAY_1700); twoXyzReview(page) |  | 14 |
| 1 | d4/card-helpers.spec.ts:158 | should reach each XYZ card by its Trade after the cards re-sort and after a reload | 1: 4.6 | onboardedAt(profile, MONDAY_1700); twoXyzReview(page); enterMark(page, tF, DATE, '52.00') |  | 14 |
| 1 | d4/correct-mark.spec.ts:6 | should show Corrected with the reason and +$130.00 on the Detail, with two revisions stored | 1: 2.5 | onboardedAt(profile, MONDAY_1700); createTrades(page, [FOUR_TRADES[0]!]); openReview(page); enterMark(page, 'XYZ', DATE, '52.00') |  |  |
| 1 | d4/expected-mark.spec.ts:12 | should show Missing with the stale Friday Mark as context and no current dollar figure at Tuesday... | 1: 2.6 | onboardedAt(profile, FRIDAY_1700); createTradeAt(page, XYZ, '2026-10-08T09:30', [['100', '50.00', '2026-10-08T10:00']]); openReview(page); enterMark(page, 'XYZ', 'Fri Oct 9', '51.20') |  |  |
| 1 | d4/gaps.spec.ts:9 | should list Friday as optional, reach Complete without it, and show an empty list after Friday is... | 1: 3 | onboardedAt(profile, WEDNESDAY_1700); createTradeAt(page, MNO, '2026-10-07T09:30', [['100', '50.00', '2026-10-07T10:00']]); openReview(page); enterMark(page, 'MNO', 'Wed Oct 7', '50.50') |  |  |
| 1 | d4/hold.spec.ts:4 | should record nothing on leaving, show the error for Exit without Intent, save it with Intent, an... | 1: 2.6 | onboardedAt(profile, MONDAY_1700); createTrades(page, [FOUR_TRADES[0]!]); openReview(page); enterMark(page, 'XYZ', 'Mon Oct 12', '52.00') |  |  |
| 1 | d4/kill.spec.ts:4 | should keep the Action after the browser is killed once its save result renders, and resume the R... | 1: 2.5 | spawnedBrowser(profile.dir, 9339); onboardedPage(killed.context); createTrades(page, [FOUR_TRADES[0]!]); openReview(page) | relaunch, kill |  |
| 1 | d4/no-save.spec.ts:38 | should store no observation revision, Entry, or Web Storage value after typing a correction and a... | 1: 3.7 | onboardedAt(profile, MONDAY_1700); createTrades(page, [FOUR_TRADES[0]!, FOUR_TRADES[1]!]); openReview(page); enterMark(page, 'XYZ', DATE, '52.00') | relaunch |  |
| 1 | d4/offline.spec.ts:20 | should complete the next session’s Review offline after a full stop and keep its Marks and Action... | 1: 8 | onboardedAt(profile, MONDAY_1700); createTrades(page); completeReview(page, 'Mon Oct 12', MONDAY_MARKS); launchAt(profile, TUESDAY_1700, { offline: true }) | relaunch, offline |  |
| 1 | d4/responsive-a11y.spec.ts:39 | should keep a half-filled Action form through 390 px and back, switching layout at 960 px | 1: 2.2 | onboardedAt(profile, MONDAY_1700); createTrades(page, [FOUR_TRADES[0]!]); openReview(page); enterMark(page, 'XYZ', DATE, '52.00') |  |  |
| 1 | d4/responsive-a11y.spec.ts:63 | should lay the Action choices out as compact chips, each radio inside its label, at 375 and 320 px | 1: 2.9 | onboardedAt(profile, MONDAY_1700); createTrades(page, [FOUR_TRADES[0]!]); openReview(page); enterMark(page, 'XYZ', DATE, '52.00') |  |  |
| 1 | d4/responsive-a11y.spec.ts:96 | should list the Trades in one column at 375 wide, with the same links | 1: 3.6 | onboardedAt(profile, MONDAY_1700); createTrades(page); openReview(page) |  |  |
| 1 | d4/responsive-a11y.spec.ts:120 | should show a disabled Action chip as disabled with a not-allowed cursor and reduced opacity | 1: 2.3 | onboardedAt(profile, MONDAY_1700); createTrades(page, [FOUR_TRADES[0]!]); openReview(page); enterMark(page, 'XYZ', DATE, '52.00') |  |  |
| 1 | d4/responsive-a11y.spec.ts:138 | should report no WCAG 2.1 AA violations on the Review, the Action form, the Open list, and Detail... | 1: 21.1 | onboardedAt(profile, MONDAY_1700); createTrades(page, [FOUR_TRADES[0]!, FOUR_TRADES[1]!, FOUR_TRADES[2]!]); createTradeAt(page, JKL, '2026-10-08T09:30', [['100', '20.00', '2026-10-08T10:00']]); openReview(page) | relaunch |  |
| 1 | d4/responsive-a11y.spec.ts:283 | should complete a Review using the keyboard only, with visible focus throughout | 1: 2.7 | launchAt(profile, MONDAY_1700); onboardedPage(context); createTrades(page, [FOUR_TRADES[0]!]) |  |  |
| 1 | d4/review.spec.ts:6 | should list the position cards with their Marks inside in attention order with reasons and, after... | 1: 6.5 | onboardedAt(profile, MONDAY_1700); createTrades(page); openReview(page); enterMark(page, 'XYZ', DATE, '52.00') | relaunch |  |
| 1 | d4/runtime-failure.spec.ts:7 | should keep the Review, Open list, and Detail readable with no Mark entry or Save, and leave the ... | 1: 3.8 | onboardedAt(profile, MONDAY_1700); createTrades(first, [FOUR_TRADES[0]!, FOUR_TRADES[1]!]); openReview(first); enterMark(first, 'XYZ', DATE, '52.00') | relaunch |  |
| 1 | d4/runtime-failure.spec.ts:70 | should explain RuntimeNotWritable, keep the Action values, and record no Entry | 1: 2.1 | onboardedAt(profile, MONDAY_1700); createTrades(page, [FOUR_TRADES[0]!]); openReview(page); enterMark(page, 'XYZ', DATE, '52.00') |  |  |
| 1 | support/detail/helpers.spec.ts:30 | should wait for the Detail to finish loading before deciding whether it has a tab list | 1: 1 | (none) |  |  |
| 1 | support/detail/helpers.spec.ts:39 | should return at once on a page that is no Trade Detail | 1: 0.042 | (none) |  |  |
| 1 | support/detail/helpers.spec.ts:47 | should measure the Detail cards and heading without counting the Detail tab list | 1: 0.035 | (none) |  |  |
| 1 | support/detail/helpers.spec.ts:54 | should still count the tab list of a page without a Detail | 1: 0.035 | (none) |  |  |
| 1 | support/detail/helpers.spec.ts:61 | should read Realized to date from the Valuation card when a dated line is also shown | 1: 0.04 | (none) |  |  |
| 1 | support/detail/helpers.spec.ts:75 | should measure every Detail table in every drawer that holds one at narrow width | 1: 0.109 | (none) |  |  |
| 1 | support/detail/helpers.spec.ts:82 | should read once over a Detail with no tab list | 1: 0.046 | (none) |  |  |
| 1 | support/detail/helpers.spec.ts:89 | should measure the description lists of every drawer that holds them | 1: 0.109 | (none) |  |  |
| 2 | d5/detail-debt.spec.ts:7 | should show Due in the Review after next before, Deferred, answered with Tuesday 12:30 after, and... | 1: 2.6 | onboardedAt(profile, TUESDAY_1005); confirmReference(page); openReview(page); enterMark(page, 'XYZ', TUESDAY, '52.00') |  |  |
| 2 | d5/detail-debt.spec.ts:50 | should show the opened form in view with focus inside it after Reflect now in Needs you at 1280 p... | 2: 1.6, 1.7 | onboardedAt(profile, TUESDAY_1005); confirmReference(page) |  |  |
| 2 | d5/due-timing.spec.ts:7 | should list the reflection as due in the next Review in Monday’s Review, which reaches Complete, ... | 1: 2.2 | onboardedAt(profile, MONDAY_1100); confirmReference(page); openReview(page); enterMark(page, 'XYZ', MONDAY, '52.00') |  |  |
| 2 | d5/due-timing.spec.ts:33 | should save an entry with Reflect now while a reflection is due and still list the first reflecti... | 1: 2.4 | onboardedAt(profile, MONDAY_1005); confirmReference(page); openReview(page); enterMark(page, 'XYZ', MONDAY, '52.00') |  |  |
| 2 | d5/faults.spec.ts:9 | should show the Outstanding Debt on Detail and in the Review with no Reflect now, Decline, or Sav... | 1: 2.8 | onboardedAt(profile, MONDAY_1005); confirmReference(first); openReview(first); enterMark(first, 'XYZ', MONDAY, '52.00') | relaunch |  |
| 2 | d5/faults.spec.ts:59 | should explain RuntimeNotWritable, keep the typed Debt answer, and record no Entry | 1: 2.2 | onboardedAt(profile, MONDAY_1005); confirmReference(page); openReview(page); enterMark(page, 'XYZ', MONDAY, '52.00') |  |  |
| 2 | d5/kill-offline.spec.ts:9 | should keep the Entry and the Settled version after the browser is killed once a Debt answer’s re... | 1: 2.6 | spawnedBrowser(profile.dir, 9341); onboardedPage(killed.context); confirmReference(page); openReview(page) | relaunch, kill |  |
| 2 | d5/kill-offline.spec.ts:54 | should record a deferred entry and answer it on Trade Detail offline, and keep both across anothe... | 1: 2.9 | onboardedAt(profile, MONDAY_1005); confirmReference(page); launchAt(profile, MONDAY_1005, { offline: true }); launchAt(profile, MONDAY_1005, { offline: true }) | relaunch, offline |  |
| 2 | d5/no-save.spec.ts:40 | should store no Position Change, Entry, decline, Debt change, or Web Storage value after typing i... | 1: 3.4 | onboardedAt(profile, MONDAY_1005); confirmReference(page); openReview(page); enterMark(page, 'XYZ', MONDAY, '52.00') | relaunch |  |
| 2 | d5/responsive.spec.ts:11 | should keep a half-filled Debt answer through 390 px and back, switching layout at 960 px | 1: 2.3 | onboardedAt(profile, MONDAY_1100); confirmReference(page); openReview(page); enterMark(page, 'XYZ', MONDAY, '52.00') |  |  |
| 2 | d5/responsive.spec.ts:38 | should report no WCAG 2.1 AA violations on the entry form in each disposition, the Review card, t... | 1: 8.7 | onboardedAt(profile, MONDAY_1100); confirmReference(page); deferEntry(page, [at('2026-10-12T10:30')]); deferEntry(page, [at('2026-10-12T10:45')]) | relaunch |  |
| 2 | d5/review-debt.spec.ts:36 | should show Reflection owed on Detail, the reflection as due in the next Review on Monday, Due an... | 1: 3.5 | deferredThenMondayReview(profile); openReview(page); enterMark(page, 'XYZ', TUESDAY, '52.50'); launchAt(profile, TUESDAY_1700) |  |  |
| 2 | d5/review-debt.spec.ts:80 | should read Complete after declining with a reason in Tuesday’s Review, show Declined later with ... | 1: 3 | deferredThenMondayReview(profile); openReview(page); enterMark(page, 'XYZ', TUESDAY, '52.50') |  |  |
| 2 | d5r/durability.spec.ts:10 | should keep the Marks after the browser is killed once the rows render from the result, and show ... | 1: 4.3 | spawnedBrowser(profile.dir, 9341); onboardedPage(killed.context); ({ 'T-A': tA } = await createCardFixture(page)); openReview(page) | relaunch, kill | 3 |
| 2 | d5r/durability.spec.ts:46 | should save Marks offline after a full stop and keep them across another offline restart (AC-DEL-... | 1: 5.3 | onboardedAt(profile, MONDAY_1700); createCardFixture(page); openReview(page); launchAt(profile, MONDAY_1700, { offline: true }) | relaunch, offline | 3 |
| 2 | d5r/durability.spec.ts:76 | should open every card read only in Recovery Only, with no inputs or Save buttons, and leave the ... | 1: 5 | onboardedAt(profile, MONDAY_1700); createCardFixture(first); openReview(first); enterMark(first, trades['T-A'], MONDAY, '52.00') | relaunch | 3 |
| 2 | d5r/marks.spec.ts:8 | should move T-A’s collapsed meter at once when XYZ is saved in T-F’s card, show XYZ saved there a... | 1: 4 | onboardedAt(profile, MONDAY_1700); createCardFixture(page); openReview(page); enterMark(page, tF, MONDAY, '52.00') |  | 3 |
| 2 | d5r/marks.spec.ts:39 | should show the issue beside the invalid row with focus on it and keep every draft with nothing s... | 1: 4.5 | onboardedAt(profile, MONDAY_1700); createCardFixture(page, { earlierDay: '2026-10-08' }); openReview(page) |  |  |
| 2 | d5r/marks.spec.ts:75 | should keep the card open with the message while an Action value is entered, and write nothing | 1: 3.7 | onboardedAt(profile, MONDAY_1700); createCardFixture(page); openReview(page) |  | 3 |
| 2 | d5r/marks.spec.ts:91 | should open the other card with no message while a price is typed, keep the draft, empty it with ... | 1: 4 | onboardedAt(profile, MONDAY_1700); createCardFixture(page); openReview(page) |  | 3 |
| 2 | d5r/marks.spec.ts:112 | should show a Conflict with the other tab’s value, keep the draft, and write nothing from the fir... | 1: 4.3 | onboardedAt(profile, MONDAY_1700); createCardFixture(page); openReview(page); openReview(second) |  | 3 |
| 2 | d5r/responsive-a11y.spec.ts:9 | should keep drafts and the open panel through 390 px and back, put the meter on its own row at na... | 1: 8.1 | onboardedAt(profile, MONDAY_1700); createCardFixture(page); openReview(page) |  | 3 |
| 2 | d5r/responsive-a11y.spec.ts:105 | should keep the meter beside the header while the card's header is at least 40rem wide, with T-A'... | 1: 3.8 | onboardedAt(profile, MONDAY_1700); createCardFixture(page); openReview(page) |  | 3 |
| 2 | d5r/responsive-a11y.spec.ts:163 | should keep the bottom navigation above the Open list's sticky cells at 375 and 320 px, so its Re... | 1: 7.9 | onboardedAt(profile, MONDAY_1700); createTrades(page); createRoutineTrades(page, 8) |  |  |
| 2 | d5r/review.spec.ts:9 | should open the first card not Done on load, update the figures and meters from Save Marks, open ... | 1: 6.6 | onboardedAt(profile, MONDAY_1700); createCardFixture(page); openReview(page); enterMark(page, tA, MONDAY, '52.00') | relaunch | 3 |
| 2 | d5r/review.spec.ts:93 | should open the 18th card where it is, with its header and first input in the viewport without sc... | 1: 11.7 | onboardedAt(profile, MONDAY_1700); createCardFixture(page); createRoutineTrades(page, 16); openReview(page) |  | 3 |
| 2 | d5r/sliders.spec.ts:9 | should open the Review with focus on DEF’s cell in the Marks step, and no card opened for it, whe... | 1: 3.8 | onboardedAt(profile, MONDAY_1700); createCardFixture(page) |  | 3 |
| 2 | d5r/sliders.spec.ts:29 | should focus XYZ’s one cell in the Marks step, and open no card for the Trade that is not the fir... | 1: 3.8 | onboardedAt(profile, MONDAY_1700); createCardFixture(page) |  | 3 |
| 2 | d5r/sliders.spec.ts:57 | should draw T-A’s pointer right of break-even, T-B’s pointer pinned at the Stop end in the square... | 1: 4.4 | onboardedAt(profile, MONDAY_1700); createCardFixture(page); openReview(page); enterMark(page, tA, MONDAY, '52.00') |  | 3 |
| 2 | d6/close-review.spec.ts:41 | should list both closed Trades as due in the next Review on Tuesday, drop Trade 1 once answered t... | 1: 8.1 | onboardedAt(profile, MONDAY_1700); createTrades(setupPage, [FOUR_TRADES[0]!, FOUR_TRADES[1]!, FOUR_TRADES[2]!]); launchAt(profile, TUESDAY_1405); closeWithCloseReviewLater(page) | relaunch |  |
| 2 | d6/exit-action.spec.ts:9 | should save Exit with Intent in the Review with no Record the exit offered, record the exit from ... | 1: 2.9 | onboardedAt(profile, MONDAY_1700); createTA(page); openReview(page); enterMark(page, 'XYZ', MONDAY, '52.00') |  | 5 |
| 2 | d6/exit-requirements.spec.ts:9 | should show Choose a Close Reason beside the group with focus on the issues and the values kept, ... | 1: 2.8 | onboardedAt(profile, MONDAY_1700); createTA(setupPage); launchAt(profile, TUESDAY_1405) | relaunch | 5 |
| 2 | d6/exit-requirements.spec.ts:62 | should refuse an exit of 101 shares on a 100-share Position with The position has only 100 shares... | 1: 3.3 | onboardedAt(profile, MONDAY_1700); createTA(setupPage); launchAt(profile, TUESDAY_1405); launchAt(profile, TUESDAY_1405) | relaunch | 5 |
| 2 | d6/exit.spec.ts:10 | should keep T-A Open at 70 shares with one Lot Match and $55.90 realized after the first exit, cl... | 1: 3.9 | onboardedAt(profile, MONDAY_1700); createTA(setupPage); launchAt(profile, TUESDAY_1005); launchAt(profile, TUESDAY_1405) | relaunch | 5 |
| 2 | d6/kill.spec.ts:9 | should keep the Closed lifecycle, the Sell Executions, the Close Reason, and both reflection outc... | 1: 2.7 | spawnedBrowser(profile.dir, 9341); onboardedPage(killed.context); createTA(page); spawnedBrowser(profile.dir, 9342) | relaunch, kill | 5 |
| 2 | d6/no-save.spec.ts:48 | should store no Position Change, Close Reason, Entry, decline, Debt, or Web Storage value after t... | 1: 3.7 | onboardedAt(profile, MONDAY_1700); createTA(setupPage); launchAt(profile, TUESDAY_1405); launchAt(profile, TUESDAY_1405) | relaunch | 5 |
| 2 | d6/offline.spec.ts:11 | should record a partial and then a full exit offline after a full stop, and keep both across anot... | 1: 3.8 | onboardedAt(profile, MONDAY_1700); createTA(setupPage); launchAt(profile, TUESDAY_1405, { offline: true }); launchAt(profile, TUESDAY_1405, { offline: true }) | relaunch, offline | 5 |
| 2 | d6/responsive-a11y.spec.ts:28 | should keep a half-filled full exit through 390 px and back, switching layout at 960 px, report n... | 1: 18.1 | onboardedAt(profile, MONDAY_1700); createTrades(setupPage, FOUR_TRADES.slice(0, 3)); launchAt(profile, TUESDAY_1405); openReview(page) | relaunch |  |
| 2 | d6/responsive-a11y.spec.ts:196 | should keep every money amount in the figure grids on one line at 375 px and 320 px, on Open Deta... | 1: 3.1 | onboardedAt(profile, MONDAY_1700); createTrades(setupPage, FOUR_TRADES.slice(0, 1)); launchAt(profile, TUESDAY_1405) | relaunch | 5 |
| 2 | d6/responsive-a11y.spec.ts:248 | should keep each price with its date and time, and each money amount, whole on one line in the Lo... | 1: 2.9 | onboardedAt(profile, MONDAY_1700); createTrades(setupPage, FOUR_TRADES.slice(0, 1)); launchAt(profile, TUESDAY_1405) | relaunch | 5 |
| 2 | d6/responsive-a11y.spec.ts:293 | should reflow the exit receipt, with its Lot Matches and Changed Lot Matches tables reachable by ... | 1: 3 | onboardedAt(profile, MONDAY_1700); createTrades(setupPage, FOUR_TRADES.slice(0, 1)); launchAt(profile, TUESDAY_1405) | relaunch | 5 |
| 2 | d6/runtime-failure.spec.ts:11 | should keep the Closed list, Closed Detail, and Open Detail with Lot Matches readable with no Rec... | 1: 4.3 | onboardedAt(profile, MONDAY_1700); createTrades(first, FOUR_TRADES.slice(0, 2)); launchAt(profile, TUESDAY_1405) | relaunch |  |
| 2 | d6/runtime-failure.spec.ts:77 | should explain RuntimeNotWritable, keep the typed exit and its answers, and record no Position Ch... | 1: 2.7 | onboardedAt(profile, MONDAY_1700); createTA(setupPage); launchAt(profile, TUESDAY_1405) | relaunch | 5 |
| 2 | d6/stale-debt.spec.ts:16 | should keep the Outstanding Debt index read within a small factor of a fresh database after Debts... | 1: 2.4 | (none) |  |  |
| 2 | d6/stale-index.spec.ts:17 | should keep the Open-range index read within a small factor of a fresh database after Trades chur... | 1: 4.5 | (none) |  |  |
| 2 | d7/confirm-option-plan.spec.ts:6 | should render the confirmed option Plan Detail with its Planned payoff and 1R straight after Conf... | 1: 1.3 | onboardedAt(profile, MONDAY_0900) |  |  |
| 2 | d7/kill.spec.ts:8 | should keep the Closed lifecycle, the Expiration, and both reflection outcomes after the browser ... | 1: 2.3 | spawnedBrowser(profile.dir, 9341); onboardedPage(killed.context); createShortPutTrade(page); spawnedBrowser(profile.dir, 9342) | relaunch, kill | short put |
| 2 | d7/marks-zero.spec.ts:14 | should save a Mark of 0 for the MNO put with the note, refuse 0 for KLM stock and -1 for ABC on t... | 1: 3.3 | onboardedAt(profile, TUESDAY_1030); confirmOptionPlan(setupPage, { ...OS, planTime: '2026-10-12T09:00' }); recordOptionEntry(setupPage, [{ quantity: '2', price: '1.25', fee: '1.30', time: '2026-...; { symbol: 'KLM', tradeId: await createTradeAt(setupPage, stock('KLM'), '2026-10-12T09:3... | relaunch |  |
| 2 | d7/no-save.spec.ts:52 | should store no Trade, Expiration, Entry, decline, Debt, or Web Storage value after typing an opt... | 1: 3.4 | onboardedAt(profile, FRIDAY_NOV_1700); createShortPutTrade(setupPage); launchAt(profile, FRIDAY_NOV_1700); launchAt(profile, FRIDAY_NOV_1700) | relaunch | short put |
| 2 | d7/offline.spec.ts:10 | should confirm an option Plan, record an entry, and record an Expiration offline after a full sto... | 1: 3.1 | onboardedAt(profile, MONDAY_0900); launchAt(profile, FRIDAY_NOV_1700, { offline: true }); createShortPutTrade(page); launchAt(profile, FRIDAY_NOV_1700, { offline: true }) | relaunch, offline | short put |
| 2 | d7/payoff-chart-layout.spec.ts:51 | should print no two chart text labels over each other on the Long Call and Cash-Secured Put Plann... | 1: 2.2 | reachCharts(profile) |  |  |
| 2 | d7/payoff-chart-layout.spec.ts:66 | should render chart text at 10 px or more at 320 px | 1: 1.7 | reachCharts(profile) |  |  |
| 2 | d7/payoff-chart-layout.spec.ts:79 | should keep a negative payoff table amount on one line at 320 px | 1: 1.6 | reachCharts(profile) |  |  |
| 2 | d7/plan-open.spec.ts:7 | should show 1R $400.00 and the Planned payoff with Breakeven 57.00 after confirmation, then Open ... | 1: 2.8 | onboardedAt(profile, MONDAY_0900); confirmOptionPlan(page, OC); launchAt(profile, MONDAY_1105); recordOptionEntry(again, [ | relaunch |  |
| 2 | d7/plan-open.spec.ts:61 | should show the Expiration error beside an empty date, clear it as soon as 2026-11-20 is filled, ... | 1: 2.2 | onboardedAt(profile, MONDAY_0900); launchAt(profile, MONDAY_1105); recordOptionEntry(reopened, [{ quantity: '2', price: '2.00', fee: '0.65', time: '2026-1... | relaunch |  |
| 2 | d7/plan-open.spec.ts:91 | should draw the Exercise Intent checkbox small, beside its label text, in a row at least 44 px ta... | 1: 1.2 | onboardedAt(profile, MONDAY_0900) |  |  |
| 2 | d7/plan-validation.spec.ts:6 | should reject a Long Call Stop of 61 above the breakeven and the Target 60 with both errors besid... | 1: 1.3 | onboardedAt(profile, MONDAY_0900) |  |  |
| 2 | d7/responsive-a11y.spec.ts:29 | should keep a half-filled option Plan through 390 px and back, switching layout at 960 px, report... | 1: 15.4 | onboardedAt(profile, TUESDAY_1030); createSettlementFixture(setupPage); launchAt(profile, TUESDAY_1030); launchAt(profile, FRIDAY_NOV_1700) | relaunch | 11 |
| 2 | d7/responsive-a11y.spec.ts:124 | should show every term and value of the Settlement Due panel in the rail at 1280 px without a wor... | 1: 3.4 | onboardedAt(profile, TUESDAY_1030); createSettlementFixture(setupPage); launchAt(profile, MONDAY_NOV_1700) | relaunch | 11 |
| 2 | d7/responsive-a11y.spec.ts:163 | should show the Position drawer tables of a Settlement Due option Trade spaced, with Lot Matches ... | 1: 3.6 | onboardedAt(profile, TUESDAY_1030); createSettlementFixture(setupPage); launchAt(profile, MONDAY_NOV_1700) | relaunch | 11 |
| 2 | d7/responsive-a11y.spec.ts:225 | should record an Expiration by keyboard alone, with a visible focus ring on every stop | 1: 3.3 | onboardedAt(profile, FRIDAY_NOV_1700); createShortPutTrade(setupPage); launchAt(profile, FRIDAY_NOV_1700) | relaunch | short put |
| 2 | d7/review-expiration.spec.ts:13 | should record T-1 expiration from its card Settlement panel with Close Review Reflect later and r... | 1: 4.8 | onboardedAt(profile, TUESDAY_1030); createSettlementFixture(setupPage); launchAt(profile, FRIDAY_NOV_1700); openReview(page) | relaunch | 11 |
| 2 | d7/runtime-failure.spec.ts:11 | should keep the lists, option Detail, both payoff views and the Review readable with no Record ex... | 1: 3.8 | onboardedAt(profile, TUESDAY_1030); createSettlementFixture(setupPage); launchAt(profile, FRIDAY_NOV_1700); openReview(page) | relaunch | 11 |
| 2 | d7/runtime-failure.spec.ts:55 | should explain RuntimeNotWritable, keep the typed expiration and its answers, and record no Posit... | 1: 2.4 | onboardedAt(profile, FRIDAY_NOV_1700); createShortPutTrade(setupPage); launchAt(profile, FRIDAY_NOV_1700) | relaunch | short put |
| 2 | d7/settlement-due.spec.ts:11 | should show the Settlement Due panel on Friday and on Monday with the Trade Open and no current d... | 1: 4.1 | onboardedAt(profile, MONDAY_0900); confirmOptionPlan(setupPage, OS); launchAt(profile, MONDAY_1105); recordOptionEntry(entryPage, [{ quantity: '2', price: '1.25', fee: '1.30', time: '2026-... | relaunch |  |
| 2 | d7/short-put.spec.ts:9 | should refuse Buy to close 3 of 2 short contracts with the position-only-has-2 error and save not... | 1: 3.8 | onboardedAt(profile, MONDAY_0900); confirmOptionPlan(page, OS); launchAt(profile, MONDAY_1105); recordOptionEntry(entryPage, [{ quantity: '2', price: '1.25', fee: '1.30', time: '2026-... | relaunch |  |
| 2 | d7p/layout.spec.ts:54 | should show both finding sentences in full in the Trade Detail findings table at 320 and 375 px | 1: 5 | launchScenario(profile) | relaunch | 12 |
| 2 | d7p/layout.spec.ts:71 | should keep the Facts cannot be replayed and Mark missing badges inside their cells in the Trades... | 1: 5.1 | launchScenario(profile) | relaunch | 12 |
| 2 | d7p/layout.spec.ts:87 | should show Mark missing and Awaiting the close in full in an Open Detail at 320 and 375 px | 1: 3.1 | onboardedAt(profile, MONDAY_1700); createTrades(page, [ABC!, DEF!]); openReview(page); enterMark(page, 'DEF', DATE, '40.50') |  |  |
| 2 | d7p/layout.spec.ts:120 | should show the attention sentences, meter names and day card lines in full in the Review at 320 ... | 1: 5.6 | launchScenario(profile); openReview(page) | relaunch | 12 |
| 2 | d7s/conditions.spec.ts:25 | should show one Stop breached and one Target reached badge on the Open list row, and Detail condi... | 1: 5.3 | onboardedAt(profile, TUESDAY_1030); createOs2Trade(setupPage); markSession(profile, TUESDAY_1700, trade, TUESDAY, TUESDAY_MARKS); markSession(profile, WEDNESDAY_1700_NY, trade, WEDNESDAY, WEDNESDAY_MARKS) | relaunch | O-S2 |
| 2 | d7s/conditions.spec.ts:65 | should list W8 four condition lines on O-S2 card in the Wednesday 17:00 Review with the option-pr... | 1: 3.7 | onboardedAt(profile, TUESDAY_1030); createOs2Trade(setupPage); markSession(profile, TUESDAY_1700, trade, TUESDAY, TUESDAY_MARKS); launchAt(profile, WEDNESDAY_1700_NY) | relaunch | O-S2 |
| 2 | d7s/entry-beyond-stop.spec.ts:13 | should read Actual initial risk $735.00 on the summary card after recording 1 at 7.35, past the 7... | 1: 1.5 | onboardedAt(profile, TUESDAY_1030); confirmBothKinds(page, NVDA_CALL); recordOptionEntry(page, [{ quantity: '1', price: '7.35', fee: '0', time: '2026-10-12T10... |  |  |
| 2 | d7s/plan.spec.ts:9 | should show 1R $480.00 and Reward : risk 0.29 after confirming O-S2 with all four price fields, l... | 1: 1.6 | onboardedAt(profile, MONDAY_0900); confirmBothKinds(page, OS2); launchAt(profile, MONDAY_1105) | relaunch |  |
| 2 | d7s/plan.spec.ts:42 | should reject a Long Call with an option-price Stop of 2.50 and no Target with the Stop error bes... | 1: 1.2 | onboardedAt(profile, MONDAY_0900) |  |  |
| 2 | d7s/responsive-a11y.spec.ts:24 | should keep a half-filled option Plan through 390 px and back, report no WCAG 2.1 AA violations o... | 1: 5.9 | onboardedAt(profile, TUESDAY_1030); createOs2Trade(setupPage); launchAt(profile, TUESDAY_1700); openReview(page) | relaunch | O-S2 |
| 2 | d7s/responsive-a11y.spec.ts:72 | should plan O-S2 by keyboard alone, with a visible focus ring on every stop, and show 1R $480.00 | 1: 1.2 | onboardedAt(profile, MONDAY_0900) |  |  |
| 2 | d7sp/review-dated-line.spec.ts:11 | should show O-C bought Monday, in the Tuesday 17:00 Review with the calls Monday Mark only, a Mon... | 1: 2.6 | onboardedAt(profile, MONDAY_1700); confirmOptionPlan(setupPage, { ...OC, planTime: '2026-10-12T09:00' }); recordOptionEntry(setupPage, [{ quantity: '2', price: '2.00', fee: '1.30', time: '2026-...; openReview(setupPage) | relaunch |  |
| 3 | d8/after-restore.spec.ts:19 | should show the Restore completed with the shell in Recovery Only naming the inventory check, and... | 1: 2.5 | seedJournal(profile); launchAt(profile, MONDAY_1005) | relaunch | 8 |
| 3 | d8/backup.spec.ts:11 | should show Downloaded not verified yet and then Backup complete with the time, name the file by ... | 1: 8.5 | buildOc3(profile, { thursdayHold: true }); launchAt(profile, THURSDAY_1800) | relaunch | 2 |
| 3 | d8/backup.spec.ts:44 | should offer no Verify for an earlier download after leaving the page, show the messages for a tr... | 1: 2.1 | seedJournal(profile); launchAt(profile, MONDAY_1005) | relaunch | 8 |
| 3 | d8/backup.spec.ts:80 | should say The backup could not be made with the Read stage, offer no download, and leave the pro... | 1: 1.8 | seedJournal(profile); launchAt(profile, MONDAY_1005) | relaunch | 8 |
| 3 | d8/backup.spec.ts:104 | should offer Download a copy and Verify on Migration Blocked and verify the copy, and Download a ... | 1: 2.4 | installDump(blockedDir, { brokenCloseReason: true }); installDump(waitingDir, { brokenCloseReason: false }) | relaunch |  |
| 3 | d8/offline.spec.ts:9 | should download and verify a backup and restore a local file into a second profile with no network | 1: 3.4 | seedJournal(profile); launchAt(profile, MONDAY_1005, { offline: true }) | relaunch, offline | 8 |
| 3 | d8/recovery-only.spec.ts:11 | should list Backup in the navigation with the A143 copy, complete a download and verification, of... | 1: 2.1 | seedJournal(profile); launchAt(profile, MONDAY_1005) | relaunch | 8 |
| 3 | d8/responsive-a11y.spec.ts:16 | should keep the flow state and ticked checkboxes across 390 px and back, switch the layout at 960... | 1: 8.5 | seedJournal(profile); launchAt(profile, MONDAY_1005) | relaunch | 8 |
| 3 | d8/responsive-a11y.spec.ts:99 | should show text warnings and migrations for an older backup, and no violations on the Backup pag... | 1: 3.8 | seedJournal(profile); launchAt(profile, MONDAY_1005) | relaunch | 8 |
| 3 | d8/responsive-a11y.spec.ts:125 | should show no violations on first run, on its Restore steps, and on the blocked views | 1: 4.6 | installDump(blockedDir, { brokenCloseReason: true }); installDump(waitingDir, { brokenCloseReason: false }) | relaunch |  |
| 3 | d8/responsive-a11y.spec.ts:172 | should show the Restore preview without sideways scroll at 375 and 320 px on the Backup page and ... | 1: 3.2 | seedJournal(profile); launchAt(profile, MONDAY_1005) | relaunch | 8 |
| 3 | d8/responsive-a11y.spec.ts:203 | should not split any word of the Restore counts table across lines at 375 and 320 px | 1: 2.2 | seedJournal(profile); launchAt(profile, MONDAY_1005) | relaunch | 8 |
| 3 | d8/responsive-a11y.spec.ts:239 | should keep each confirm-step checkbox and radio small and on the same line as its label at 1280 ... | 1: 3.3 | seedJournal(profile); launchAt(profile, MONDAY_1005) | relaunch | 8 |
| 3 | d8/responsive-a11y.spec.ts:299 | should complete a Restore with the keyboard only, every focused control showing a focus ring | 1: 2.2 | seedJournal(profile); launchAt(profile, MONDAY_1005) | relaunch | 8 |
| 3 | d8/restore.spec.ts:33 | should show the preview with counts, enable Replace only after both steps, render the summary, an... | 1: 11.9 | buildOc3(a, { thursdayHold: true }); launchAt(a, THURSDAY_1800); seedJournal(b, MONDAY_1005, { ...PLAN, symbol: 'ABC' }); launchAt(b, THURSDAY_1800) | relaunch | 2 |
| 3 | d8/restore.spec.ts:98 | should require the warning and its acknowledgment to replace without a backup, then complete, and... | 1: 3.5 | seedJournal(profile); launchAt(profile, MONDAY_1005) | relaunch | 8 |
| 3 | d8/restore.spec.ts:140 | should list the issues with Your current journal is unchanged, leave every store and every databa... | 1: 1.9 | seedJournal(profile); launchAt(profile, MONDAY_1005) | relaunch | 8 |
| 3 | d8/restore.spec.ts:176 | should say Your current journal is unchanged with the old pointer and no candidate, and complete ... | 1: 2.9 | seedJournal(profile); launchAt(profile, MONDAY_1005) | relaunch | 8 |
| 3 | d8/restore.spec.ts:212 | should warn in tab 1 about unsaved work in another tab, show Replaced by a Restore in another tab... | 1: 2.4 | seedJournal(profile); launchAt(profile, MONDAY_1005) | relaunch, kill | 8 |
| 3 | d8/restore.spec.ts:252 | should keep the live journal and leave no candidate after a kill during preparation, and open the... | 1: 2.7 | spawnedBrowser(profile.dir, PORT_BEFORE); onboardedPage(first.context); spawnedBrowser(profile.dir, PORT_AFTER); spawnedBrowser(profile.dir, PORT_BEFORE) | relaunch, update, kill |  |
| 3 | d8/shell.spec.ts:5 | should recommend a backup with a link to Backup and leave every control enabled | 1: 0.964 | onboardedPage(context) |  |  |
| 3 | d8/watch-outgoing.spec.ts:7 | should count a request to another port as leaving the origin and ignore one to the application or... | 1: 0.133 | (none) |  |  |
| 3 | d8p/cockpit.spec.ts:37 | should show the rail with W2, W3, W5 and W7, the tabs in W1 order moved by the arrow keys, each d... | 1: 7.4 | buildOc3(profile, { thursdayHold: true, noTuesdayReview: true }); openDetailAt(profile, THURSDAY_1800, trade) | relaunch | 7 |
| 3 | d8p/first-marks-pending.spec.ts:9 | should show only the first-Marks note in Needs you and no Mark missing anywhere on the Detail | 1: 1.6 | onboardedAt(profile, MONDAY_1105); confirmOptionPlan(page, { ...OC, planTime: '2026-10-12T09:00' }); recordOptionEntry(page, [{ quantity: '2', price: '2.00', fee: '1.30', time: '2026-10-12... |  |  |
| 3 | d8p/history.spec.ts:17 | should show sessions newest left with Tuesday as a gap and the Review link, the cards newest firs... | 1: 7.8 | buildOc3(profile, { thursdayHold: true, noTuesdayReview: true }); openDetailAt(profile, THURSDAY_1800, trade) | relaunch | 7 |
| 3 | d8p/history.spec.ts:135 | should select the Journal drawer from Reflect now in Needs you and open the form on Wednesday car... | 1: 7.2 | buildOc3(profile, { thursdayHold: true, noTuesdayReview: true }); openDetailAt(profile, THURSDAY_1800, trade) | relaunch | 7 |
| 3 | d8p/journal-final-session.spec.ts:14 | should show DEF Closed by sale with its Trade P&L and no change line, while XYZ keeps First Mark ... | 1: 4.8 | onboardedAt(profile, MONDAY_1700); createTrades(setupPage, FOUR_TRADES); openReview(setupPage); enterMark(setupPage, 'XYZ', MONDAY, '52.00') | relaunch |  |
| 3 | d8p/journal-final-session.spec.ts:46 | should show the expired MNO put final session with its Trade P&L and no change line | 1: 3 | onboardedAt(profile, MONDAY_0900); confirmOptionPlan(setupPage, OS); launchAt(profile, MONDAY_1105); recordOptionEntry(entryPage, [{ quantity: '2', price: '1.25', fee: '1.30', time: '2026-... | relaunch |  |
| 3 | d8p/lot-matches-fit.spec.ts:55 | should show every Lot Matches column in view at 1280 px on DEF Closed by sale, with the table scr... | 1: 4.5 | onboardedAt(profile, MONDAY_1700); createTrades(setupPage, FOUR_TRADES); launchAt(profile, MONDAY_1700, { width: 1280 }) | relaunch |  |
| 3 | d8p/lot-matches-fit.spec.ts:75 | should show every Lot Matches column in view at 1280 px on O-C3, with the table scrolling inside ... | 1: 7.6 | buildOc3(profile); launchAt(profile, THURSDAY_1800, { width: 1280 }) | relaunch | 9 |
| 3 | d8p/payoff-fit.spec.ts:23 | should show the whole Payoff chart, the Now legend and both lines, inside its box at 1280 px, and... | 1: 7.8 | buildOc3(profile); openDetailAt(profile, THURSDAY_1800, trade, 1280) | relaunch | 9 |
| 3 | d8p/planned.spec.ts:9 | should show the Expires line on a just-confirmed option Plan, and again after a reload | 1: 1.6 | onboardedAt(profile, MONDAY_0900); confirmOptionPlan(page, { ...OC, expiration: '2026-12-18' }); launchAt(profile, MONDAY_0900) | relaunch |  |
| 3 | d8p/planned.spec.ts:28 | should show the Plan card, "Planned Mon Oct 12, 9:00 am", and no old Plan Reflection region or Jo... | 1: 1.2 | onboardedAt(profile, MONDAY_0900); confirmOptionPlan(page, { ...OC, expiration: '2026-12-18' }) |  |  |
| 3 | d8p/responsive-a11y.spec.ts:62 | should fit every drawer at 1280, 375 and 320 px with no sideways scroll, no wrapped condition row... | 1: 16.2 | buildOc3(profile, { thursdayHold: true }); openDetailAt(profile, THURSDAY_1800, trade) | relaunch | 2 |
| 3 | d8p/responsive-a11y.spec.ts:124 | should work by keyboard alone: Tab through the rail with a visible focus ring, the tabs by the ar... | 1: 9.1 | buildOc3(profile, { thursdayHold: true }); openDetailAt(profile, THURSDAY_1800, trade) | relaunch | 2 |
| 3 | d8p/settlement-due-replay.spec.ts:22 | should show no later Price History column and no Session not ended yet card on Friday Nov 20 and ... | 1: 3.2 | onboardedAt(profile, MONDAY_0900); confirmOptionPlan(setupPage, OS); launchAt(profile, MONDAY_1105); recordOptionEntry(entryPage, [{ quantity: '2', price: '1.25', fee: '1.30', time: '2026-... | relaunch |  |
| 3 | d8p/states.spec.ts:28 | should show a Settlement Due Detail with Today selected and Settlement Due in the P&L card, then ... | 1: 3 | onboardedAt(profile, MONDAY_0900); confirmOptionPlan(setupPage, OS); launchAt(profile, MONDAY_1105); recordOptionEntry(entryPage, [{ quantity: '2', price: '1.25', fee: '1.30', time: '2026-... | relaunch |  |
| 3 | d8p/states.spec.ts:101 | should show a Trade Closed by sale, a stock Trade and a Trade with two open lots each with its dr... | 1: 5 | onboardedAt(profile, MONDAY_1700); createTrades(setupPage, FOUR_TRADES); openReview(setupPage); enterMark(setupPage, 'XYZ', MONDAY, '52.00') | relaunch |  |
| 3 | d8p/states.spec.ts:177 | should show an incoherent Detail with the Facts cannot be replayed region, only Position, Plan an... | 1: 2.6 | onboardedPage(setup); confirmReference(setupPage); recordEntry(setupPage, PC1); writeIntegrityFixture(profile.dir, { kind: 'UnknownPlannedLeg', underlying: 'XYZ' }) | relaunch |  |
| 3 | d8p/today-narrow.spec.ts:77 | should show the Today, Yesterday and Change columns inside the Marks table scroll box at 375 and ... | 1: 3 | onboardedAt(profile, MONDAY_1700); confirmOptionPlan(setupPage, { ...OC, planTime: '2026-10-12T09:00' }); recordOptionEntry(setupPage, [{ quantity: '2', price: '2.00', fee: '1.30', time: '2026-...; openReview(setupPage) | relaunch |  |
| 3 | d8p/today-narrow.spec.ts:103 | should keep a three-digit stock Mark, a negative change and the column headings whole at 375 and ... | 1: 2.7 | onboardedAt(profile, MONDAY_1700); { symbol: 'XYZ', tradeId: await createTradeAt(setupPage, { ...PLAN, symbol: 'XYZ', quan...; openReview(setupPage); enterMark(setupPage, xyz, MONDAY, '418.60') | relaunch |  |
| 3 | d8r/history.spec.ts:16 | should show each Mark cell with its provenance and the corrected one with its reason, then one da... | 1: 8.8 | buildOc3(profile, { thursdayHold: true, correctedWednesdayXyz: '57.45' }); openDetailAt(profile, THURSDAY_1800, trade) | relaunch |  |
| 3 | d8r/names.spec.ts:68 | should name O-C3 "XYZ Dec 18 $55 Call" on every screen, and the 2027 contract "XYZ Jan 15 2027 $5... | 1: 2.3 | onboardedAt(profile, MONDAY_1700); openReview(page) |  |  |
| 3 | d8r/plan-risk.spec.ts:12 | should list the groups in order with W23 and W31, then land on Deviations when See Plan and Risk ... | 1: 9.2 | buildOc3Plus(profile); openDetailAt(profile, FRIDAY_1200, trade) | relaunch | 2 (on top) |
| 3 | d8r/plan-risk.spec.ts:58 | should word a breached Stop in the Conditions group as "Breached · $0.50 past" and "Risk to stop ... | 1: 2.2 | openBreachedStockTrade(profile) |  | breached XYZ |
| 3 | d8r/rail.spec.ts:20 | should show each condition with its distance at Thu 18:00, then no dated line at Fri 12:00 and Th... | 1: 9.7 | buildOc3(profile, { thursdayHold: true }); openDetailAt(profile, THURSDAY_1800, trade); openDetailAt(profile, FRIDAY_1200, trade); openDetailAt(profile, FRIDAY_1800, trade) | relaunch | 2 |
| 3 | d8r/rail.spec.ts:59 | should show a stock Trade with its Stop breached as "Breached · $0.50 past", with no nearest, Wor... | 1: 2.2 | openBreachedStockTrade(profile) |  | breached XYZ |
| 3 | d8r/responsive-a11y.spec.ts:78 | should fit the Today table in its drawer at 1280 px, unscrolled, with each column heading read in... | 1: 9.1 | buildOc3(profile, { thursdayHold: true }); openDetailAt(profile, instant, oc3) | relaunch | 2 |
| 3 | d8r/responsive-a11y.spec.ts:91 | should pass axe on the Payoff drawer at 320 px | 1: 3 | buildOs2x(profile); launchAt(profile, MONDAY_NOV_1700) | relaunch |  |
| 3 | d8r/responsive-a11y.spec.ts:107 | should fit Today, Plan and Risk and Position on an Open, a Settlement Due and a Closed Trade at 1... | 1: 20.8 | buildOc3(profile, { thursdayHold: true }); addOs2x(profile, MONDAY_NOV_1700); openDetailAt(profile, THURSDAY_1800, oc3); launchAt(profile, MONDAY_NOV_1700) | relaunch | 2 |
| 3 | d8r/states.spec.ts:35 | should show K1 Closed by sale with "Exit Fri Nov 13", its final exit price, an empty Today column... | 1: 3.4 | onboardedAt(profile, MONDAY_0900); addK1(profile); launchAt(profile, MONDAY_NOV_1700) | relaunch |  |
| 3 | d8r/states.spec.ts:60 | should show a Planned Trade with Plan and Risk, Journal and Payoff only, opening on Plan and Risk... | 1: 1.2 | onboardedAt(profile, MONDAY_0900); confirmOc3(page) |  |  |
| 3 | d8r/states.spec.ts:71 | should show an incoherent Detail with Position, Plan and Risk and Journal only, opening on Positi... | 1: 2.6 | onboardedPage(setup); confirmReference(setupPage); recordEntry(setupPage, PC1); writeIntegrityFixture(profile.dir, { kind: 'UnknownPlannedLeg', underlying: 'XYZ' }) | relaunch |  |
| 3 | d8r/today.spec.ts:8 | should show the Marks table dated by the session at Thu 18:00, Fri 12:00 and Sat 10:00, with a no... | 1: 9.5 | buildOc3(profile, { thursdayHold: true }); openDetailAt(profile, THURSDAY_1800, trade); openDetailAt(profile, FRIDAY_1200, trade); openDetailAt(profile, SATURDAY_1000, trade) | relaunch | 2 |
| 3 | d8r/today.spec.ts:48 | should show dashes in both columns beside the No Marks yet note on Mon 10-12 12:00, before the fi... | 1: 2.6 | buildOc3BeforeMarks(profile); openDetailAt(profile, MONDAY_1200, trade) | relaunch |  |
| 4 | d9/estimates-a11y.spec.ts:19 | should keep the chip's small chart inside the overlay with no sideways scroll and no axe violatio... | 2: 3.4, 2.9 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9/estimates.spec.ts:33 | should show W47’s chips for R-BREN-U on Mon 11-16, each estimate tagged, and open the volatility ... | 1: 3.2 | openBren(profile) |  | 1 |
| 4 | d9/estimates.spec.ts:76 | should read W48’s line under the charts at Mon 11-09 and Wed 11-11, split into the Underlying’s m... | 1: 2.6 | openBren(profile) |  | 1 |
| 4 | d9/estimates.spec.ts:102 | should say Unavailable with W49’s reason after R-CORV-D’s missing Mark, and keep the not-split se... | 1: 2.2 | build(profile, CORV, closeOf('2026-11-11'), 7) |  | 18 |
| 4 | d9/estimates.spec.ts:146 | should show no interest rate and no formula beside the chart, and state them once on the About pa... | 1: 2.7 | openBren(profile) |  | 1 |
| 4 | d9/gaps.spec.ts:9 | should show No Mark on Tue 11-10 with the two results kept and no figure carried, and Wed 11-11 m... | 1: 2.5 | build(profile, CORV, closeOf('2026-11-11'), 7) |  | 18 |
| 4 | d9/gaps.spec.ts:54 | should read Past the Stop by $180.00 (0.30R) on Mon 11-09 with the sale as banked loss, in the re... | 1: 2.2 | build(profile, AXIO, closeOf('2026-11-09'), 5) |  | AXIO 11-09 |
| 4 | d9/gaps.spec.ts:83 | should label the banked loss "Realized −$440" in the P&L chart on Mon 11-09 | 1: 2.2 | build(profile, AXIO, closeOf('2026-11-09'), 5) |  | AXIO 11-09 |
| 4 | d9/meter-a11y.spec.ts:81 | should keep one named meter per Open row, on a Review card and in the rail at 1280, 375 and 320 p... | 1: 14.1 | onboardedAt(profile, closeOf('2026-11-13')); for (const fixture of [BREN, CORV, DALE_D, AXIO_U] satisfies Fixture[]) refs[fixture.sy... |  | 6 |
| 4 | d9/meter-a11y.spec.ts:90 | should say what each meter shows in shape and words as well as colour, at 375 px | 1: 6.4 | onboardedAt(profile, closeOf('2026-11-13')); for (const fixture of [BREN, CORV, DALE_D, AXIO_U] satisfies Fixture[]) refs[fixture.sy... |  | 6 |
| 4 | d9/meter-a11y.spec.ts:118 | should show the square pointer, the hatch and the outlined open fill in the rendered styles, not ... | 1: 6.6 | onboardedAt(profile, closeOf('2026-11-13')); for (const fixture of [BREN, CORV, DALE_D, AXIO_U] satisfies Fixture[]) await buildOn(p... |  | 6 |
| 4 | d9/meter-detail.spec.ts:10 | should show the meter at the top of the Conditions card, named by its figures, with no visible words | 1: 2.6 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9/meter-detail.spec.ts:32 | should show the dashed track on a day with a missing Mark, named by the reason, with the lines an... | 1: 2.7 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9/open-list.spec.ts:25 | should list the Open Trades in the Review’s order under the line In the Review’s order, each row’... | 1: 6.4 | fourTrades(profile); openReview(page) |  | 6 |
| 4 | d9/open-list.spec.ts:48 | should show the dashed track on a Settlement Due row | 1: 2.8 | build(profile, DALE, closeOf('2026-11-19'), 13, 0); launchAt(profile, MON_1123_1700) | relaunch | 17 |
| 4 | d9/replay.spec.ts:17 | should show Mon 11-16 with the headline, how it is going, what is at stake and the labels W36 to ... | 1: 2.7 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9/replay.spec.ts:53 | should step back to Thu 11-12 by keyboard with its own figures, the Stop line stepped at the sale... | 1: 2.7 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9/replay.spec.ts:92 | should hold the chart’s Worst case figure in the readout’s At Worst case row and on its card (C9.2) | 1: 2.7 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9/replay.spec.ts:108 | should step back to Mon 11-02 by keyboard with the first session, no band and no sale, and nothin... | 1: 2.6 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9/replay.spec.ts:131 | should name each revealed session as a button, mark the hovered one in both charts and move to th... | 1: 2.7 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9/review.spec.ts:11 | should show the Replay button above the Action form, opening the replay with Price History as its... | 1: 2.8 | build(profile, BREN, closeOf('2026-11-16'), 10); openReview(page) |  | 1 |
| 4 | d9/review.spec.ts:39 | should move the slider on the card, open Price History on that session and return to the same car... | 1: 2.9 | build(profile, BREN, closeOf('2026-11-16'), 10); openReview(page) |  | 1 |
| 4 | d9/session-cards.spec.ts:7 | should find a newer card after an older one when the cards span pages | 1: 3.1 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d95/marks-keys.spec.ts:9 | should show the key hint at 375 wide, and take Enter, the arrow keys and N in the grid | 1: 2.9 | onboardedAt(profile, FRIDAY_1700); createTradeAt(page, trade.plan, '2026-10-09T09:30', [[trade.fills[0]![0], trade.fills[0...; openReview(page); enterMark(page, 'ABC', FRIDAY, '30.50') |  |  |
| 4 | d95/marks-step.spec.ts:11 | should stack each row at 375 wide: the Instrument and its input, then the previous Mark and Can't... | 1: 2.7 | onboardedAt(profile, FRIDAY_1700); createTradeAt(page, trade.plan, '2026-10-09T09:30', [[trade.fills[0]![0], trade.fills[0...; openReview(page); enterMark(page, 'ABC', FRIDAY, '30.50') |  |  |
| 4 | d95/slip-questions.spec.ts:8 | should question a ten-times slip, take the reading pressed, and save only the price | 1: 2.9 | onboardedAt(profile, FRIDAY_1700); createTradeAt(page, trade.plan, '2026-10-09T09:30', [[trade.fills[0]![0], trade.fills[0...; openReview(page); enterMark(page, 'ABC', FRIDAY, '30.50') |  |  |
| 4 | d9ar/cards.spec.ts:105 | should step R-AXIO-D from the first session to the last with one card each, then page the cards a... | 1: 3.4 | build(profile, AXIO, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/cards.spec.ts:159 | should show R-BREN-U’s Plan block and W63’s words on its entry and its sale | 1: 3.5 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/cards.spec.ts:183 | should show R-CORV-D’s first crossing on Fri 11-06, Mon 11-09 and Wed 11-11, and none before | 1: 2.7 | build(profile, CORV, closeOf('2026-11-11'), 7) |  | 18 |
| 4 | d9ar/cards.spec.ts:240 | should keep every figure on a session card on one line, sign with its number, at 1280, 1440, 375 ... | 3: 3.5, 3.7, 3.9 | build(profile, fixture, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/chart.spec.ts:42 | should list in the key only what R-BREN-U has drawn, at Mon 11-02 and Thu 11-12 | 1: 2.7 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/chart.spec.ts:65 | should end a stock’s time axis with nothing at the right, and keep the cursor clear of text on it... | 1: 2.3 | build(profile, AXIO, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/chart.spec.ts:78 | should name DALE-hold’s Worst case at the bottom edge with an arrow, with every line labelled and... | 1: 2.6 | build(profile, DALE_HOLD, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/chart.spec.ts:104 | should shade the session with no Mark on R-CORV-D, join nothing across it and flag the Target rea... | 1: 2 | build(profile, CORV, closeOf('2026-11-11'), 7) |  | 18 |
| 4 | d9ar/chart.spec.ts:127 | should draw each stake bar and hatch on AXIO Mon Nov 16 with its label and no label over another,... | 1: 2.5 | build(profile, AXIO, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/chart.spec.ts:167 | should keep AXIO’s Stop breached flag on the P&L chart and in the key on every session from Mon N... | 1: 3 | build(profile, AXIO, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/chart.spec.ts:221 | should draw no label over a y-axis figure or another label on BREN Mon Nov 2 at 1280, 1366, 1440,... | 2: 2.8, 2.3 | build(profile, fixture, closeOf('2026-11-16'), 10) |  | 1 (CORV case: own) |
| 4 | d9ar/chart.spec.ts:250 | should name the hatch and the stake bar in the key on BREN, where both are drawn with their labels | 1: 2.6 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/chart.spec.ts:262 | should leave the top of the readout where it is when a session is hovered | 1: 2.8 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/chart.spec.ts:306 | should keep BREN’s key on one line at 1280, 1440 and 1920 on every session | 4: 3.2, 3, 2.9, 2.7 | build(profile, fixture, closeOf(close), through) |  | 1 (CORV case: 18) |
| 4 | d9ar/chart.spec.ts:315 | should keep R-DALE-U’s key on one line on every session, and name no Execution after the Expirati... | 1: 4.3 | build(profile, DALE, closeOf('2026-11-19'), 13, 0); openDetailAt(profile, MON_1123_1700, built.trade) | relaunch | 17 |
| 4 | d9ar/crossing-position.spec.ts:10 | should put the first-crossing sentence after the charts on a phone and after the status line on a... | 1: 2.5 | build(profile, AXIO, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/label-sweep.spec.ts:23 | D9AR-retro-1 should list every chart label drawn over something, at every session, BREN | 4: skip, skip, skip, skip | build(profile, fixture, closeOf('2026-11-16'), 10); launchTouchAt(profile, closeOf('2026-11-16'), 375) | relaunch, touch | skipped |
| 4 | d9ar/overlay.spec.ts:11 | should open the overlay from the Replay button beside six drawers, named and headed as W53 says | 1: 2.6 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/overlay.spec.ts:29 | should close by Escape, by Close and by the browser’s Back, each leaving the Trade’s page with fo... | 1: 2.7 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/overlay.spec.ts:54 | should reopen on a reload inside the overlay, and let Price History close it and focus that sessi... | 1: 2.7 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/overlay.spec.ts:76 | should put the readout beside the charts at 1280 | 1: 2.7 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/readout.spec.ts:29 | should show R-BREN-U’s grid at Wed 11-11 and its past-the-Target row, Marks and odds at Mon 11-16 | 1: 2.6 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/readout.spec.ts:66 | should draw the From here sentence in the status line’s colour | 1: 2.7 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/readout.spec.ts:76 | should show R-AXIO-D past the Stop on Mon 11-16 with a realized loss, a grey Worst case and axe c... | 1: 3.1 | build(profile, AXIO, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/readout.spec.ts:114 | should show DALE-hold at Wed 11-11 with full-strength extremes, the odds with the Plan’s, and the... | 1: 2.2 | build(profile, DALE_HOLD, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/readout.spec.ts:140 | should word R-AXIO-D’s sale below the Stop against the Plan in the Position group | 1: 2.2 | build(profile, AXIO, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/readout.spec.ts:152 | should word R-BREN-U’s entry and its sale at the Target against the Plan in the Position group | 1: 2.7 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/readout.spec.ts:169 | should show R-CORV-D at Mon 11-09 with the extremes smaller and grey | 1: 2.1 | build(profile, CORV, closeOf('2026-11-09'), 5) |  |  |
| 4 | d9ar/readout.spec.ts:239 | should keep every figure in the readout and the header on one line, sign with its number, at 1280... | 6: 2.5, 2.5, 2.5, 2.5, 2.7, 2.1 | build(profile, fixture, closeOf(date), through) |  | 1 (CORV case: own) |
| 4 | d9ar/responsive-a11y.spec.ts:124 | should fit the Detail overlay on one screen at every size, keeping the session across each resize | 1: 6.6 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/responsive-a11y.spec.ts:132 | should fit the Review card’s overlay on one screen at every size, keeping the session across each... | 1: 6.4 | buildReview(profile, [BREN]) |  | 1 |
| 4 | d9ar/responsive-a11y.spec.ts:142 | should fit the Detail overlay’s header, headline and both charts on one 320 by 667 screen | 2: 2.7, 2.7 | build(profile, BREN, closeOf('2026-11-16'), 10); buildReview(profile, [BREN]) | relaunch | 1 |
| 4 | d9ar/responsive-a11y.spec.ts:163 | should draw the P&L chart at least 800 wide at 1280 and wider at 1440 and 1920, with its text the... | 1: 2.7 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/responsive-a11y.spec.ts:186 | should keep the P&L chart 800 wide and still, and each stake grid inside the readout, at every se... | 2: 8.1, 2.6 | buildReview(profile, fixtures) |  | 1 (CORV on top) / own (R-DALE-U) |
| 4 | d9ar/responsive-a11y.spec.ts:201 | should keep Tab inside the overlay, from either end, at 1280 and on a phone | 1: 3.4 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/responsive-a11y.spec.ts:229 | should show the page in the new width’s layout after Close, with a started Action still there | 1: 2.8 | buildReview(profile, [BREN]) |  | 1 |
| 4 | d9ar/responsive-a11y.spec.ts:259 | should make the phone’s Replay buttons, paging buttons and card headings at least 44 pixels high | 1: 2.7 | buildReview(profile, [BREN]) |  | 1 |
| 4 | d9ar/responsive-a11y.spec.ts:276 | should make the overlay’s Close button at least 44 pixels high on a phone | 1: 2.6 | build(profile, BREN, closeOf('2026-11-16'), 10) |  | 1 |
| 4 | d9ar/responsive-a11y.spec.ts:287 | should move the slider by a tap on a session and a tap on a card’s heading | 1: 3.3 | build(profile, BREN, closeOf('2026-11-16'), 10); launchTouchAt(profile, closeOf('2026-11-16'), 375) | relaunch, touch | 1 |
| 4 | d9ar/responsive-a11y.spec.ts:316 | should show no hover box or band from the Review card's Replay tap and after two taps on sessions... | 1: 3.3 | buildReview(profile, [BREN]); launchTouchAt(profile, closeOf('2026-11-16'), width); openReview(page) | relaunch, touch | 1 |
| 4 | d9ar/responsive-a11y.spec.ts:345 | should make the Review overlay's Price History link at least 44 pixels high at 375 | 2: 3.4, 3.3 | buildReview(profile, [BREN]); launchTouchAt(profile, closeOf('2026-11-16'), width); openReview(page) | relaunch, touch | 1 |
| 4 | d9ar/responsive-a11y.spec.ts:363 | should leave the slider’s value uncovered by any chart element for DALE from Trade Detail at 320 | 1: 2.8 | build(profile, DALE_HOLD, closeOf('2026-11-16'), 10); launchTouchAt(profile, closeOf('2026-11-16'), 320) | relaunch, touch | 1 |
| 4 | d9ar/responsive-a11y.spec.ts:383 | should read the overlay offline after a cold restart with the server stopped (AC-DEL-001) | 1: 3.2 | build(profile, BREN, closeOf('2026-11-16'), 10); launchAt(profile, closeOf('2026-11-16'), { offline: true }) | relaunch, offline | 1 |
| 4 | d9ar/responsive-a11y.spec.ts:402 | should leave a staged update’s notice in place and unchanged when the overlay is opened and closed | 1: 2.7 | build(profile, BREN, closeOf('2026-11-16'), 10) | update | 1 |
| 4 | d9ar/review.spec.ts:29 | should restore a started Action on each card after the Price History round trip, and save exactly... | 1: 6.2 | buildReview(profile) |  | 1 |
| 4 | d9ar/review.spec.ts:83 | should keep a started Action when the browser goes Forward to Price History and Back again after ... | 1: 5.4 | buildReview(profile) |  | 1 |
| 4 | d9ar/review.spec.ts:112 | should arrive at Price History from the Review with the slider session column header focused and ... | 1: 5.2 | buildReview(profile) |  | 1 |
| 4 | d9ar/review.spec.ts:133 | should return focus to Replay on Close after a reload of the Price History address with Replay open | 1: 5.1 | buildReview(profile) |  | 1 |
| 4 | d9ar/review.spec.ts:152 | should read each card’s summary in the replay’s words, with no zero Overrun | 1: 5.1 | buildReview(profile) |  | 1 |
| 4 | d9ar/states.spec.ts:12 | should end K-sale on a Final result with its header, cards to the final session and nothing at stake | 1: 3.1 | build(profile, BREN_SOLD_OUT, closeOf('2026-11-13'), 9) |  |  |
| 4 | d9ar/states.spec.ts:48 | should end R-DALE-U with no Mark while Settlement Due, then with a Final result and an Expiration... | 1: 3.4 | build(profile, DALE, closeOf('2026-11-19'), 13, 0); openDetailAt(profile, MON_1123_1700, built.trade) | relaunch | 17 |
| 4 | d9ar/states.spec.ts:96 | should show no Replay button on a Planned Trade | 1: 1.2 | buildPlanned(profile, BREN, closeOf('2026-11-02')) |  |  |
| 4 | d9ar/states.spec.ts:105 | should say No Mark once on Tue 11-10 with Add the Mark and a dash where the Mark is needed, then ... | 1: 2.6 | build(profile, CORV, closeOf('2026-11-11'), 7) |  | 18 |
| 4 | d9ar/sweep.spec.ts:24 | should find no broken or unmarked figure anywhere in the replay at any session, BREN | 4: 4.2, 3.7, 3.6, 3.8 | build(profile, fixture, closeOf('2026-11-16'), 10); launchTouchAt(profile, closeOf('2026-11-16'), 375) | relaunch, touch | 1 (CORV case: own) |
| 4 | d9r2/drafts.spec.ts:26 | should keep drafts across cards and pages, count them on Save Marks and empty them all with Discard | 1: 3 | createGapFixture(profile) |  | 4 |
| 4 | d9r2/drafts.spec.ts:77 | should save every draft of every session in one Save Marks, one Mark for the key two Trades share | 1: 2.9 | createGapFixture(profile) |  | 4 |
| 4 | d9r2/drafts.spec.ts:116 | should hold leaving the page while a draft exists, and store nothing when the page is reloaded wi... | 1: 3.1 | createGapFixture(profile) |  | 4 |
| 4 | d9r2/drafts.spec.ts:147 | should ask before a route change while a draft exists, stay on Cancel, leave on OK, and mark the ... | 1: 2.8 | createGapFixture(profile) |  | 4 |
| 4 | d9r2/drafts.spec.ts:175 | should raise the browser leave prompt on a real page close while a draft exists, keep the page on... | 1: 3.6 | createGapFixture(profile) |  | 4 |
| 4 | d9r2/editor.spec.ts:9 | should ask for a reason with Can't get a price, correct an earlier Mark, offer Withdraw on the Re... | 1: 4.6 | createGapFixture(profile); enterMark(page, tA, OCT_9, '50.40'); enterMark(page, tA, OCT_8, '50.20') |  | 4 |
| 4 | d9r2/editor.spec.ts:66 | should name a conflict, and after a refused save open the first refused cell with focus in its input | 1: 3.2 | createGapFixture(profile); openReview(second); enterMark(second, tA, OCT_9, '50.10') |  | 4 |
| 4 | d9r2/editor.spec.ts:90 | should read a card that was not open after another tab saved a Mark, and open the refused cell of... | 1: 3.6 | createGapFixture(profile); openReview(second); enterMark(second, tA, OCT_8, '50.85'); openReview(second) |  | 4 |
| 4 | d9r2/editor.spec.ts:122 | should open the first refused cell, on its page, with its issue and focus in the input | 1: 3.1 | createGapFixture(profile) |  | 4 |
| 4 | d9r2/grid.spec.ts:11 | should show the previous session and the Review Date, the skipped sessions as optional columns on... | 1: 2.9 | createGapFixture(profile) |  | 4 |
| 4 | d9r2/grid.spec.ts:70 | should put a session with one Missing Mark and one Available Mark in a mixed column, and move Ent... | 1: 2 | onboardedAt(profile, THURSDAY_OCT_8_1700); confirmOptionPlan(page, { ...OC, planTime: '2026-10-08T09:00' }); recordOptionEntry(page, [{ quantity: '2', price: '2.00', fee: '1.30', time: '2026-10-08...; openReview(page) |  |  |
| 4 | d9r2/history.spec.ts:21 | should show an acknowledged session as Acknowledged Unavailable, count only Missing sessions on t... | 1: 3 | createGapFixture(profile); enterMark(page, tA, OCT_9, '50.50') |  | 4 |
| 4 | d9r2/responsive-a11y.spec.ts:16 | should keep drafts, the chosen cell and the focus through a live resize, show no sideways scroll ... | 1: 4.4 | createGapFixture(profile) |  | 4 |
| 4 | d9r2/responsive-a11y.spec.ts:58 | should fit the Marks step at 390 px with no sideways scroll, no clipped text and 44 px cells on a... | 3: 3.9, 3.8, 3.9 | createGapFixture(profile); launchTouchAt(profile, MONDAY_1700, width); openReview(page) | relaunch, touch | 4 |
| 4 | d9r2/responsive-a11y.spec.ts:87 | should take the whole flow by keyboard: choose a cell, type, Enter through the cells, add the ski... | 1: 3.6 | createGapFixture(profile) |  | 4 |
