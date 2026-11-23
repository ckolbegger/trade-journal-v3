# Plan: share saved browser setups across the browser tests

Drafted 2026-11-23 from `research/setup-snapshot-candidates.md` and the two proofs of concept (`research/setup-snapshot-poc-results.md`, `research/setup-snapshot-poc-2-results.md`). The user agreed the approach and the scope: all six groups of the survey, built in place on branch `setup-snapshot`, then merged back into `claude-opus-5.5`. Not a D9.5 task.

## 1. What and why

Many browser tests build the same Trades through the screens before they check anything. The proofs of concept showed that building such a setup once per test worker, saving the finished browser profile, and starting each test on a copy of it is safe and fast: `e2e/d9ar/review.spec.ts` went from 26.5 s to 11.2 s and `e2e/d9ar/responsive-a11y.spec.ts` from 64.6 s to 35.6 s. Each browser stage runs one test at a time (`workers: 1`), so seconds saved in tests are seconds saved in the run.

Estimated saving for the six groups: about 4 to 4.5 minutes of the 21.4-minute browser tier (after the dedup).

| Group | Shared setup | Stage | Tests | Estimated saving |
|---|---|---|---|---|
| 1 | Standard three-Trade Review (BREN, AXIO, DALE held) at Mon 11-16, through session 10 | 4 | 21 already in the proofs of concept, about 50 more in 12 d9 and d9ar files | about 125 s |
| 2 | O-C3 with the Thursday Hold (`buildOc3(profile, { thursdayHold: true })`), `buildOc3Plus` on top, and plain O-C3 if its two tests pass on it | 3 | 9, or 11 | about 50 to 70 s |
| 3 | d5r card fixture at Mon 10-12 17:00 (`createCardFixture`) | 2 | 13 | about 31 s |
| 4 | d9r2 gap fixture (`createGapFixture`) | 4 | 16 | about 26 s |
| 5 | d6 T-A at Mon 10-12 17:00 (`createTA`) | 2 | 10 | about 16 s |
| 6 | d9 four Trades at Fri 11-13, through session 9 (BREN, CORV, DALE-D, AXIO-U) | 4 | 4 | about 15 s |

The test lists, conflicts and risks per group are in the survey's section "The groups in detail"; each task below reads its group there.

## 2. Where the work happens

- Branch `setup-snapshot` (from `claude-opus-5.5` at `63b46893`), in the worktree `.claude/worktrees/setup-snapshot`. This plan and its Progress table live on that branch and merge back with the code.
- **Ports:** the primary ones (app 5175, Chrome debugging 9341 and 9342). The user, 2026-11-23: "We are the only change running, so you can use the primary ports." No port change is made, so none can reach `claude-opus-5.5`.
- The proof-of-concept branch `setup-snapshot-poc` and its worktree stay as a record. Its POC files (`review-snapshot.spec.ts`, `responsive-a11y-snapshot.spec.ts`) never reach this branch: their code is moved into the original spec files and the shared helper.
- Evidence: `evidence/Setup-Snapshot/` (`structural.md`, `timings.md`, `ocr/`, `suite-runs/`), on the branch.

## 3. Rules for every task

1. Test code only (e2e/ and test config). No product code (src/), styles, unit or integration tests.
2. A test's body stays as it is; only how it starts changes. Never weaken or drop a check.
3. A test joins a shared setup only if every check passes unchanged on it. If one doesn't (a count, which card opens first, a clock earlier than the setup's last Mark, the same contract Marked on another series), the test keeps its own build, and the task records which check and why.
4. Shared setups go through the one helper ST.1 builds, declared on the shared `test` in `e2e/d1/support.ts` (decision 65: through the support helpers). No setup code copied into a spec.
5. Each task runs only the spec files it changes, before and after, through `.claude/scripts/with-browser-lock.sh` (the main worktree's lock, so its timings are quiet). It records per-file times before and after in `evidence/Setup-Snapshot/timings.md`.
6. Each task shows its converted tests really start from the copy: with the copy switched off (an empty profile), they fail; switched back on, they pass. Recorded in `structural.md`.
7. No per-task full suite run. ST.11 is the one complete run.
8. Levels (decision 122): ST.1 and ST.5 are Standard (new shared logic, and sharing across three folders): an ocr review follows each commit. The others are Light: no ocr.
9. Commit each task locally on `setup-snapshot`. Never push. Never read `.env.local`. Never look at other worktrees under `worktrees/` or other implementation branches.

## 4. Tasks

### ST.0 — Working ports (dropped)

Dropped by the user, 2026-11-23: the work uses the primary ports.

### ST.1 — The shared helper, and `d9ar/review.spec.ts` on it (Standard)

- In `e2e/d1/support.ts`: a worker-scoped fixture holding saved setups, each built on first use from a named builder, on its own server serving the release the tests serve, in a side profile folder; the browser and server are closed after the build. A test asks for a setup by name and gets a clone of its folder (`cp -c -R`) in its own profile folder, with Chromium's Singleton lock files removed, plus what the builder returned (Trade ids). Setups are built in the run, never kept between runs, so they can't be stale.
- Declared, not automatic: a test that asks for nothing gets an empty profile, as today.
- Builders live in the support file that owns their data (group 1's in `e2e/d9ar/support.ts`), registered by name.
- Move the first proof of concept into `e2e/d9ar/review.spec.ts`: its five tests start from the standard Review setup.
- Verify: `e2e/d9ar/review.spec.ts` before and after, the break check, and a spec from another folder that uses `profile` (for example `e2e/d2/narrow.spec.ts`) unchanged and passing.

### ST.2 — `d9ar/responsive-a11y.spec.ts` on it (Light)

Move the second proof of concept into the original file: 17 of 18 tests on the standard Review setup (CORV added on top for the four-Trade test); R-DALE-U keeps its own build. Verify that file before and after, plus the break check.

### ST.3 — Group 1, the d9 files (Light)

`e2e/d9/estimates-a11y.spec.ts`, `estimates.spec.ts`, `meter-detail.spec.ts`, `replay.spec.ts`, `review.spec.ts`, `session-cards.spec.ts`. Watch `d9/review` lines 11 and 39 (three cards instead of one; the survey found they reach BREN's card by Trade).

### ST.4 — Group 1, the d9ar files (Light)

`e2e/d9ar/cards.spec.ts`, `chart.spec.ts`, `overlay.spec.ts`, `readout.spec.ts`, `sweep.spec.ts`, `crossing-position.spec.ts`. Watch `d9ar/overlay` line 29 (closes with browser Back; on a copy the history starts at the Trade Detail). CORV cases stay on their own build unless adding CORV on top saves time (it doesn't for a test whose whole build is CORV).

### ST.5 — Group 2, O-C3 with the Thursday Hold (Standard)

- `e2e/d8/backup.spec.ts`, `e2e/d8/restore.spec.ts` (profile "a" only; its second, ABC profile stays its own), `e2e/d8p/responsive-a11y.spec.ts` (2), `e2e/d8r/rail.spec.ts`, `e2e/d8r/responsive-a11y.spec.ts` (2; line 107 adds O-S2X on top), `e2e/d8r/today.spec.ts` line 8.
- `buildOc3Plus` (`e2e/d8r/support.ts`) starts from the copy and runs its one Fri 11:05 step; `e2e/d8r/plan-risk.spec.ts` uses it.
- Plain O-C3 (`e2e/d8p/lot-matches-fit.spec.ts`, `e2e/d8p/payoff-fit.spec.ts`): try them on the Thursday Hold setup. If every check passes unchanged, they join; otherwise they keep their build.
- Builder in `e2e/d8p/support.ts` beside `buildOc3`. Not in scope: the variant without Tuesday's Review, the corrected Wednesday Mark, `buildOc3BeforeMarks`.

### ST.6 — Group 3, the d5r card fixture (Light)

`e2e/d5r/marks.spec.ts` (4), `responsive-a11y.spec.ts` (2), `review.spec.ts` (2; line 93 adds 16 routine Trades on top), `sliders.spec.ts` (3), `durability.spec.ts` lines 46 and 76. Left out: `d5r/marks` line 39 (another day), `d5r/durability` line 10 (killable browser). Watch `d5r/review` line 9 (which card opens first).

### ST.7 — Group 4, the d9r2 gap fixture (Light)

`e2e/d9r2/drafts.spec.ts` (5), `editor.spec.ts` (4), `grid.spec.ts`, `history.spec.ts`, `responsive-a11y.spec.ts` (3 touch cases copy only, and line 87). The copy launches straight at Mon 10-12 17:00 and opens the Review; check nothing the setup held only in memory or session storage is needed.

### ST.8 — Group 5, d6 T-A (Light)

`e2e/d6/exit-requirements.spec.ts` (2), `exit.spec.ts`, `no-save.spec.ts`, `offline.spec.ts`, `runtime-failure.spec.ts` line 77, `responsive-a11y.spec.ts` (3), `exit-action.spec.ts`. Left out: `d6/kill`, and the two- and three-Trade journals.

### ST.9 — Group 6, d9 four Trades at Fri 11-13 (Light)

`e2e/d9/meter-a11y.spec.ts` (3) and `e2e/d9/open-list.spec.ts` (`fourTrades`).

### ST.10 — Second look at the worker count (Light)

Read the stage run outputs from the tasks' runs and confirm each stage builds each setup once (or say where a second build happens, for example d95 between d9 and d9ar, and whether declaring the fixture on d1's `test` avoided it). Record in `structural.md`. No code change unless a stage builds a setup more than twice.

### ST.11 — One complete run, merge (Standard)

1. Check `git diff claude-opus-5.5 -- tools` is empty and `e2e/d1/support.ts` changed only by the shared helper.
2. One complete cumulative run with the full browser tier (`browser-full`) through `suite-runner`, with per-stage timings, into `evidence/Setup-Snapshot/suite-runs/`, holding the main worktree's browser lock (nothing else may run on 5175 then). Compare per stage with `evidence/Test-Dedup/suite-runs/td.11-dedup-timings.md`.
3. If it passes, ask the user to merge `setup-snapshot` into `claude-opus-5.5` (or merge on their word). No push.

## 5. Progress

| Task | Level | Status | Commits |
|---|---|---|---|
| ST.0 | — | Dropped | |
| ST.1 | Standard | Done | 2ef488d0 |
| ST.1-B1 | Standard | Done | 944ecd24 |
| ST.1-B2 | Standard | Done | 2aa85183 |
| ST.2 | Light | Done | dd928e49 |
| ST.3 | Light | Done | ebba364c |
| ST.4 | Light | Done | aec53790 |
| ST.5 | Standard | Done | 34068c3c |
| ST.6 | Light | Done | 061b786f |
| ST.7 | Light | Not started | |
| ST.8 | Light | Not started | |
| ST.9 | Light | Not started | |
| ST.10 | Light | Not started | |
| ST.11 | Standard | Not started | |

## 6. Not in this plan

- Groups 7 and below of the survey (each under 15 s), including `e2e/d2/ui-alignment.spec.ts` (about 7 s).
- Keeping saved setups between runs or across stages (estimated 3 to 5 min more, with a stale-setup risk).
- Making CORV a fourth standard Trade.
