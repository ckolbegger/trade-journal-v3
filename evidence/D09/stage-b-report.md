# D09 stage B report: the option estimates

Stage B of D9, "Trade replay", on `claude-opus-5.5`: nine planned tasks, T9.20, T9.21, T9.22, T9.23, T9.24, T9.25, T9.26, T9.27, T9.28, run one at a time (decision 100). The gate closed on 2026-11-20 with critic-b2's PASS and no defects. Tag `claude-opus-5.5-d9b`.

## What the trader gets

For an option Trade, the replay now shows three figures, each tagged "estimate": the option's implied volatility, how many shares the Position behaves like, and how the option's Mark change since the session before splits between the Underlying's move, time and volatility. Where one can't be worked out it reads "Unavailable" with one of W49's reasons. None of them changes a P&L, a risk figure or a condition's status (AC-CALC-005, AC-CALC-004). The About page states the interest rates and the formula's limits (W50).

## Tasks and commits

| Task | What | Commits | Fix rounds |
|---|---|---|---|
| D9AR-retro-7 | Delete T9AR.24-B5's 375 instance | `3618dcb0` | none |
| T9.20 | The Estimate type and the estimates lint rule | `aa5a5c79`; B1 `273df21d`; B2 `4228114d` | ocr: B1 (a dynamic `import()` slipped past the rule), B2 (a parse error read as clean) |
| T9.20-D1 | Delete duplicate browser cases between `e2e/d9` and `e2e/d9ar` (SB-Q2) | `f1209b94` | none |
| T9.20-D2 | The `browser-4` stage (SB-Q2) | `8d8f37c2` | none |
| T9.21 | Option pricing: price, delta, implied volatility, rates | `0ac934d0` | none |
| T9.22 | Replay estimates: volatility, share equivalent, the split | `7291900a`; B1 `5f08db60` | ocr: B1 (the not-split baseline needed both Marks) |
| T9.23 | Estimates in each replay session | `4bf2c557`; B1 `9c2a0b35` | suite: B1 (an extensionless import broke three Node-loaded checks) |
| T9.24 | The estimate chips and the About page section | `d96f7ae8` | none |
| T9.25 | The "since the session before" line; estimates in the readout and the session cards | `4e30a157`; B1 `119880de`; B2 `5268e5ac` | ocr: B1 (the not-split sentence ignored its reason); suite: B2 (three stage A card row lists gained the estimate rows) |
| T9.26 | Integration suite, I9.8 and I9.9 | `7d0c3c08`; B1 `48aa665f`; B2 `d7f2b65e` | ocr: B1, B2 (test-strength gaps) |
| T9.27 | Browser suite, B9.6 and B9.7 | `ad16f6b7`; B1 `855ad380` | ocr: B1 (test-strength gap) |
| T9.28 | The gate | B1 `db89563a` | critic-b1: B1 (the exercise-value reason) |

Every ocr review of a fix came back clean. Commits, ocr outputs and every run are in `evidence/D09/structural.md`, "Stage B", and `evidence/D09/ocr/`, `evidence/D09/suite-runs/`.

## Runs and flaky tests

Each task ended with a complete cumulative run; the full tier ran before each critic (`t9.27`, `t9.27-r1`, `t9.28-b1`). At the last run: unit 218 files, 2,544 tests; integration 136 files, 292 tests; browser-1 126 (5.1 min), browser-2 79 (4.9 min), browser-3 57 (4.2 min), browser-4 109 passed and 4 skipped (4.9 min); 14 of 14 checks.

- **Flaky:** `e2e/d8/responsive-a11y.spec.ts:299` (B8.16, Restore by keyboard) timed out once on the file chooser in run `t9.24`; it passed alone and in a full rerun of `browser-3`, and in every later run. Tech debt item 3. P138's two known flaky unit cases did not fail this stage.
- **Real failures caught by runs:** `t9.23` (T9.23-B1) and `t9.25` (T9.25-B2).

## Decisions

- **SB-Q1, answered (a):** the No-Edge Odds stay outside the Estimate type, with a code comment saying why.
- **SB-Q2, answered (c):** remove duplication between `e2e/d9` and `e2e/d9ar` (T9.20-D1; one true duplicate found, not the ten to twelve the titles suggested) and add `browser-4` (T9.20-D2). Plan revision 108, decision 119: AC-DEL-001's command repointed to `e2e/d9ar/responsive-a11y.spec.ts`.
- **SB-Q3, answered:** D9A-R's three tech debt items stay as tech debt.
- **The main session's implementation-level choices, reported as made:** T9.25-B2 (extend three stage A card row lists by exactly the new estimate rows); one combined run for T9.20-D1 and T9.20-D2; one full-tier run (`t9.28-b1`) standing for T9.28-B1's quick run and the run after the last fix; critic reports saved by the same transcript extraction as `tools/agent-report.ts`, since the critics' reports came back as the task's result rather than as a hand-back message (the script found none).
- **Pending:** none.

## Critics

| Critic | Result | Tokens | Tool calls | Time |
|---|---|---|---|---|
| critic-b1 | PASS; 1 moderate defect (fixed, T9.28-B1), 1 low (tech debt item 4) | 131,578 | 167 | 10 min 44 s |
| critic-b2 | PASS, no defects | 166,629 | 157 | 9 min 35 s |

Critic-b1's moderate defect: "The Mark is at or below the option's exercise value" showed for a call Mark above it (BREN Thu Nov 19, $6.01 against $6.00), because the check used an exercise value discounted at the assumed rate. T9.28-B1 checks the plain exercise value; four sessions' reasons changed (BREN Thu Nov 19 to "No volatility fits this Mark."; CORV Tue Nov 17, CORV Wed Nov 18 and DALE Wed Nov 18 to the exercise-value reason).

Critic-b2's minor observations, for the user (no task made):
1. The implied volatility chip's small chart has no scale, dates, values or tag of its own; the values reach only a screen reader. The prototype's pop-up has an axis and a caption. Critic-b2 calls it "the stage B item most likely to mislead".
2. The share equivalent never shows its own Unavailable reason; only the volatility chip carries one.
3. The share equivalent chip opens no small chart (the plan asks only for the volatility chip's).
4. The small chart opens on focus, click and Enter, not on hover.
5. At 1280 the open small chart covers the lower left of the Trade P&L chart and its key.
6. A flat session reads "Trade P&L $0.00. The call moved $0.00 a share: …" (stage A's "up $0.00 since …" line is the same).

## Tech debt (`evidence/D09/tech-debt.md`), for review now

1. The 76 suppressed nested ternaries in 45 files (the user, 2026-11-19).
2. `replay-estimates.test.ts:22`'s `== null` (ocr, style only).
3. The B8.16 Restore by keyboard flake (run `t9.24`).
4. Critic-b1's low defect: the not-split sentence's cause phrase "a Mark is missing for Tue Nov 10" replaces W48's "no implied volatility for Tue Nov 10" (from T9.25-B1). Keep it and approve the phrase, or go back to W48's one wording.
5. Critic-b2's minor observation 1, added by the user 2026-11-20: the implied volatility chip's small chart has no scale, dates or values on screen.

D9A-R's three items (`evidence/D09AR/tech-debt.md`) stand as before (SB-Q3).

## New words awaiting approval (`evidence/D09/new-words.md`, "Stage B")

- T9.24: the small chart's name "Implied volatility by session"; its hidden list "Fri Nov 13: 30.1%" and "Fri Nov 13: Unavailable"; W50's rate sentence set as its own paragraph; W47's singular forms "1 share", "1 day to expiration", "Short 1 contract".
- T9.25: "The call moved …" and "The put moved …" (W48's "The call moved"); the not-split sentence for every reason; the readout and card rows "Implied volatility" and "Behaves like", with "Unavailable" and W49's reason as hover text.
- T9.25-B1: the cause phrase "a Mark is missing for <date>" (tech debt item 4).

## Text shortened under P137

None. `evidence/D09/words-changed.md` has no stage B entry.

## Process notes

- Four tdd-task subagents wrote code before a case's red (T9.20-B1, T9.21, T9.22, T9.23); each backed it out and redid the case red first. First-run passes were flagged and mutation-checked: T9.20 case 5; T9.21 cases 2 and 4; T9.22's Put signs, parts adding up, weekend; T9.23's three; T9.24's no-rate case; T9.25's final-session case and T9.25-B1's second case; every case of T9.26 and T9.27 (tests over built code).
- T9.25's subagent could not run the browser (its sandbox refused the build and the lock), which is how three stage A card cases reached run `t9.25` failing.
- T9.23-B1: no lint rule requires `.ts` on relative imports, which the Node-loaded checks need. Not made a task.
- `browser-4` kept every stage under the 8-minute limit (largest 5.2 min).

## Time

The session lock was taken at 2026-11-20 01:38 UTC (Nov 19, 8:38 pm Eastern); the gate closed at about 07:10 UTC, about 5 h 30 min wall-clock, including the time spent on the user's three questions, against the breakdown's estimate of about 7 hours serial.
