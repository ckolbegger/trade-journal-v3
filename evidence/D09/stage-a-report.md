# D09 Stage A report: the replay chart

Stage A of D9, "Trade replay": T9.1, T9.2, T9.3, T9.4, T9.5, T9.6, T9.7, T9.8, T9.9, T9.10, T9.11, T9.12, T9.13, T9.14, T9.15, T9.16, T9.17, T9.18, T9.19. Run as a swarm (decision 111, at most 4 agents) from the plan at revision 106.

## Outcome

- **Stage A is closed, 2026-11-18, by the user's decision, not by a passing critic.** Critic-2 failed C9.2 with four defects (1 high, 1 moderate, 2 low). The user chose to close the stage and carry all four into D9A-R, where each is a planned case (D9A-R's breakdown, section 1.8). **This is an exception to the rule that every critic defect is fixed before its gate closes**, taken because D9A-R replaces most of what the four touch.
- **Final full run, on `2b9497c7`: all green.**

  | Stage | Result |
  |---|---|
  | Unit | 198 files, 2,289 tests passed |
  | Integration | 130 files, 280 tests passed |
  | Browser 1 (`e2e/d1`, `d2`, `d4`) | 126 passed (5.2 min) |
  | Browser 2 (`e2e/d5`, `d5r`, `d6`, `d7p`, `d7`) | 79 passed (4.9 min) |
  | Browser 3 (`e2e/d8p`, `d8`, `d8r`, `d9`) | 77 passed (5.1 min) |
  | Checks | 14 of 14 |

- **Acceptance commands** (`suite-runs/T9.19-acceptance.txt`, before critic-1): 7 of 9 pass. AC-CALC-005 and AC-REV-002 fail by design (stage B's and stage C's files).
- **Tag:** `claude-opus-5.5-d9a`.

## What was built

Trade Detail gains a Replay drawer, and each Review card shows the replay just above its Action form. The replay draws the Underlying's Marks over the Trade's P&L, between the Trade's result at the Stop and at the Target, with a slider that steps back through the sessions and never shows a later session early. A headline and a "From here" sentence say how the Trade is going and what is at stake; a readout and a folded "Session by session" table hold every figure as text. Trade Analysis works out each session's results at the boundaries, standing, risk, reward, condition status and markers; the coordinators pass them through; the screen only formats them (ADR 0001). Audit links go to Price History, Position and Journal, and the Review's Price History link returns to the same card, panel and session.

## Tasks

"B" tasks come from ocr findings or critic defects; "F" tasks are follow-ups the main session routed. Readability tasks (no behavior change) are counted inside each column.

| Task | Title | Lane | B tasks | of them readability | F tasks |
|---|---|---|---|---|---|
| T9.1 | A third browser stage | TL | 0 | 0 | 0 |
| T9.2 | Freeze the replay view and chart props types | TY | 0 | 0 | 0 |
| T9.3 | Trade Analysis: result at each boundary, and standing | TA | 3 | 1 | 0 |
| T9.4 | Trade Analysis: each session's risk, reward and condition status | TA | 1 | 1 | 0 |
| T9.5 | Trade Analysis: markers and the Plan column | TA | 2 | 1 | 0 |
| T9.6 | The shared replay assembly | RV | 1 | 0 | 0 |
| T9.7 | Daily Review: the card's replay, to the Review Date | RV | 2 | 1 | 3 (F1 stopped with no change; F2, F3) |
| T9.8 | Facade and manifest | RV | 0 | 0 | 0 |
| T9.9 | Replay adapter: headline and stake sentence | CF | 3 | 1 | 0 |
| T9.10 | Replay frame: the slider reveals sessions | CF | 2 | 0 | 0 |
| T9.11 | Replay frame: readout, table, hover and tap | CF (B5, B6, B7 in CP) | 7 | 0 | 0 |
| T9.12 | Corridor: the Underlying's price strip | CP | 1 | 0 | 0 |
| T9.13 | Corridor: P&L area, lines, banked band, markers | CP | 4 | 1 | 0 |
| T9.14 | Trade Detail: the Replay drawer | DW | 10 | 2 | 2 |
| T9.15 | Review card: the replay before the Action | RW | 1 | 0 | 0 |
| T9.16 | Audit navigation, and the round trip to the Review | DW | 2 | 0 | 0 |
| T9.17 | Node integration suite | IN | 3 | 1 | 0 |
| T9.18 | Browser suite | BR (F1 in PL) | 3 | 0 | 4 (F4 readability) |
| T9.19 | Stage A gate | BR | 14 | 0 | 2 (both readability) |
| **Total** | | | **59** | **9** | **11** |

Commits for each are in the breakdown's Progress section.

## Critics and reviews

| Review | Verdict | Defects | Tokens | Tool calls | Duration |
|---|---|---|---|---|---|
| Critic-1 (on `8105d35c`) | FAIL (C9.4 failed) | 8: 1 high, 6 moderate, 1 low | 246,675 | 77 | 12 min 20 s |
| Critic-2 (on `2b9497c7`) | FAIL (C9.2 failed) | 4: 1 high, 1 moderate, 2 low | 191,064 | 74 | 11 min 6 s |
| Coach review 1 | 6 of 10 | 15 suggestions: 5 high, 8 medium, 2 low | not recorded | not recorded | not recorded |

**Critic-1's defects, all fixed in T9.19:**

| # | Severity | Defect | Fixed by |
|---|---|---|---|
| 1 | High | Review card's replay does not fit one screen at 320×667 | T9.19-B1 |
| 2 | Moderate | Chart labels overlap | T9.19-B2 (then ocr's T9.19-B9, T9.19-B10) |
| 3 | Moderate | Worst case and Max reward lines flat across the whole axis | T9.19-B3 |
| 4 | Moderate | The chart's Worst case and Max reward figures not in the readout or table | T9.19-B4 after PD4 (then ocr's T9.19-B14) |
| 5 | Moderate | On a session with no Mark, the results at the Stop and Target hidden | T9.19-B5 (then ocr's T9.19-B11) |
| 6 | Moderate | Phone: minus sign of an axis tick and a price label clipped | T9.19-B6 (then ocr's T9.19-B13) |
| 7 | Moderate | Keyboard focus under the bottom navigation on the Review card at 375 px | T9.19-B7 |
| 8 | Low | Review card's chart text 9.0 to 9.4 px at 320 px | T9.19-B8 |

T9.19-B12 fixed a real resize lag behind an intermittent "fits one screen" failure seen in T9.19-B1's and T9.19-B9's runs. T9.19-F1 and T9.19-F2 were readability tasks from ocr.

**Critic-2's defects, all carried into D9A-R unfixed (the user's decision):**

| # | Severity | Defect | D9A-R task |
|---|---|---|---|
| 1a | High | The chart's overrun labels ("$180 past the Stop") are not in the table, which reads "$0.00" at risk | T9AR.17 |
| 1b | High | The price chart's "Strike $100" is in neither the readout nor the table | T9AR.18 |
| 2 | Moderate | The minus sign wraps away from its amount ("P&L –" / "$17,463.00") | T9AR.13 |
| 3 | Low | A stock Trade's axis end shows the last session's date before it is revealed | T9AR.10 |
| 4 | Low | An Expiration is labelled "Execution, Fri Nov 20" | T9AR.18 |

**Coach review:** commissioned by the user after their own layout concerns (outside the gate). It judged the thinking right and the figures correct, and the Trade Detail and phone presentation not ready. All 15 suggestions are in D9A-R's scope by the user's decision 2 (`plan/D09A-R-decisions.md`). The coach saw the user's four concerns in `DECISIONS-PENDING.md` before reviewing, so its suggestions 1, 2, 7 and 9 are not independent confirmation.

## Words for the user's approval

**Words used provisionally (P135), from `new-words.md`.** Each still needs your approval unless marked.

| Task | Screen | Words | Status |
|---|---|---|---|
| T9.9 | Headline, how it is going, session with no Mark | "No Mark." | Needs approval |
| T9.14 | Readout, Marks group | "BREN Mark", "Call Mark"; an option Trade's Underlying price without "$" | Needs approval |
| T9.14 | Readout, Position group | "Held" with "4 contracts", "short 2 contracts", "100 shares"; "Execution, Fri Nov 13" with the marker text | Needs approval |
| T9.14 | Readout, The Plan | "At the Stop", "At the Target" | Needs approval |
| T9.14 | Readout, Reward to risk change | "(Plan 2.95 to 1)" | Needs approval |
| T9.14 | Hover lines | "BREN Mark: 101.80", "Trade P&L: No Mark" | Needs approval |
| T9.14 | Chart's accessible name | "BREN Marks and Trade P&L by session" | Needs approval |
| T9.14-F2 | Headline, Stop crossed but P&L short of it | "Stop breached: DALE $0.30 past $54.00." | **Approved by the user, 2026-11-18** |
| T9.14-B3 | Readout, past a line's planned amount, condition not triggered | Rows "Past Stop's amount", "Past Target's amount"; ending "Not triggered" | Needs approval |
| T9.14-B4 | Replay drawer when the replay could not be read | "No replay." | Needs approval (an implementation-level decision, not yours) |
| T9.14 | P&L chart labels | "Banked +$478", "Realized −$495", cents dropped only when zero | Needs approval |

**Words shortened or changed under P137, from `words-changed.md`.**

| Task | Where | Before | After |
|---|---|---|---|
| T9.14 | Readout's Plan group (W43) | "Result at the Stop", "Result at the Target", "Reward to risk" | "At the Stop", "At the Target"; the Plan's ratio moved to the Reward to risk row as "(Plan 2.95 to 1)" |
| T9.10 | Slider's step buttons (W42) | Visible "Previous session", "Next session" | Visible ‹ and ›; the words kept as accessible names |
| T9.19-B2 | P&L chart's stake tags (W40) | "Risk to stop $666", "Reward to target $1,080" always drawn | Drawn only when a spot is free; the figure stays in the readout |
| T9.19-B4 | Readout, "At stake from here" (W43) | "Risk to stop", "Result at the Stop", "Worst case", "Reward to target", "Result at the Target", "Max reward" | "Current Risk" over "At Stop", "At Worst case"; "Remaining Reward" over "At Target", "At Max reward"; each "amount · R · P&L result". Your words (PD4) |
| T9.19-B4 | Table "Session by session" (W45) | "Risk to stop", "Reward to target", "Result at the Stop", "Result at the Target" | "Current Risk at Stop", "P&L at Stop", "Current Risk at Worst case", "P&L at Worst case", "Remaining Reward at Target", "P&L at Target", "Remaining Reward at Max reward", "P&L at Max reward". Your words (PD4) |
| T9.19-B4 | P&L chart's wide stake tags (W40) | "Risk to stop $672", "Reward to target $928" | "Current Risk $672", "Remaining Reward $928" (phone unchanged). Your words (PD4), longer by your decision |

## Decisions made during the stage

- **PD1** (a Position Change whose fills fall on two days): **(a) leave it**; the later day's fills get no marker.
- **PD2** (hover and tap on the real chart): withdrawn; ocr raised it, so it became T9.11-B5.
- **PD3** (the Review card's replay adds a Journal read): **(c)** the card's replay skips the narrative read and places no Journal items (T9.7-F2).
- **PD4** (the chart's Worst case and Max reward figures): **your own wording**, "Current Risk" and "Remaining Reward" with a P&L on each row (T9.19-B4).
- **User decision on the headline** (2026-11-18): a crossed Stop or Target changes the headline in both directions, whatever the dollars (T9.14-F2).
- **Gate:** **(c)** close Stage A now and carry critic-2's four defects into D9A-R.

## Known limits

- **PD1:** a Position Change whose fills span two sessions shows only the first day's fills as a marker; the later fills get none, though that day's P&L counts them.
- **T9.19-B3:** a Worst case off the chart's scale is not drawn (BREN's −$644 before the sale). D9A-R's W68 tag covers it.
- **Critic-2's minor observations D9A-R does not cover** (its critic looks again):
  - a final session's headline drops the R ("+$1,138.00", where W36 shows "· 3.05R");
  - "up $0.00 since Thu Nov 19" on an expired put's final session;
  - focus lands on the page body after returning through the Review card's Price History link;
  - each revealed session is its own tab stop (11 on BREN).
- 320×568 does not fit one screen (not required; T9.19-B1).
- **Flaky or unreproduced failures:** P138's known `TradeList.test.tsx` case flaked in the lane tiers of T9.5, T9.14-B7 and T9.18-B2 (each passed alone). Two D8 Restore cases failed once and did not reproduce: B8.16 in `wave0`, B8.3 in `wave1a`.

## Planning lessons

- **Hover and tap were tested against a stand-in, not the real chart (T9.11-B5).** T9.11's cases passed against a plot double; the real `CorridorPlot` never called the hover or select handlers, so neither worked in the app. *Lesson:* when two lanes meet through a frozen props type, plan a case that drives the real component on the other side, not only the double.
- **Building the frame and the chart against doubles cost twelve bug and follow-up tasks where they met in T9.14.** *Lesson:* plan the joining task with its own cases for the adapter (`replayProps`), and name who writes it; here no task owned it until T9.14 took it on.
- **A frozen type blocked a fix (T9.14-B2).** `PlotSession.stake` required `riskLabel`, so the first dispatch stopped. *Lesson:* say in the breakdown which lane may change a frozen type once the lanes that built against it are done.
- **A planned case pinned wrong behavior (T9.19-B5).** `gaps.spec.ts` asserted "No Mark" where A248 says the results hold; T9.18 noticed and the main session recorded it only as a note. *Lesson:* a summary note that contradicts an assumption should be checked against the breakdown at once, not left to the critic.
- **The chart was never drawn at phone width until the browser suite (T9.18-F3).** Nothing set the compact drawing, so phone words never appeared. *Lesson:* a chart task's cases should render at the real phone widths, and the prototype check at 375 and 320 px should be in its brief and done (T9.12 and T9.13 did not).
- **A view field was missing for an approved word (T9.14-F1, the "Open" row; T9.9-B1, the headline's R).** *Lesson:* trace every approved word's figure to a domain field while drafting.
- **Test-only bug tasks are first-run passes by nature.** *Lesson:* plan them with their mutation check named in the case.

## First-run passes and process slips (T9.19's tasks)

**Flagged first-run passes, each with a mutation check:**
- T9.19-B3: the props case (mutation on `worstCase`'s source).
- T9.19-B4: the frame case (P&L dropped from the row).
- T9.19-B11: the whole case (production already right; mutation on the At Worst case P&L).
- T9.19-B13: the whole case (B6 had built it; mutation on the price strip title's position).

**Agent deviations and process slips:**
- T9.19-B1: the first browser task-tier run failed two fit cases and its output was overwritten; the errors survive only in the tdd log.
- T9.19-B2: the main session's brief named a browser stage `task` that does not exist (`browser-task`). The DALE title overlap did not reproduce in the unit double; a throwaway real-app probe was not run on the old code. Existing cases changed under P137 (stake tags no longer asserted).
- T9.19-B3: the agent wrote the fix before its tests once and reverted it before any case ran.
- T9.19-B4: the browser case was written after the code (mutation evidence in `55388096` instead of a red). The main session's brief gave Mon Nov 16's figures for Thu Nov 12.
- T9.19-B5: a second commit was needed for `states.spec.ts`, which pinned the same wrong behavior.
- T9.19-B6: a first draft passed on the old code (invalid red, corrected); the browser check was not run red on the old build and covers BREN only.
- T9.19-B8: changed T9.18-B3's existing unit case (240 to 200 wide).
- T9.19-B9: a first red at 640 wide was invalid (the spot was free); the fixture moved to the compact width.

## Gaps

- **Critic-2's four defects were not reproduced by failing tests** and remain in the app until D9A-R.
- **No critic passed C9.1, C9.2, C9.3 and C9.4 together**: critic-1 failed C9.4, critic-2 failed C9.2.
- **Section 13's acceptance rows are all still "planned"**; none was marked covered at the gate.
- **The acceptance script was not rerun** after critic-1's fixes; its last record is from before critic-1.
- **The final full run is not recorded in `structural.md`**, only in its suite-run files and the commit `2b9497c7`; no `run-complete.sh` result is recorded for it.
- **Wall-clock time against the breakdown's estimate** (about 7 hours for the swarm) is not recorded anywhere.
- **The coach review's cost** (tokens, tool calls, time) is not recorded.
- **`structural.md`'s critic cost table** has a stray sentence about T9.18-F3 pasted onto critic-2's row.
- The main session read only the D9-specific ranges of `plan/spec-reading/D09.md`, not all 132 entries.
- T9.12 and T9.10 did not look at the prototype in a browser; T9.13 saw it at 1280 px only.
- T9.14 could not run `build:releases` (the permission check denied it).
- No real touch screen, screen reader, dark mode or widths under 320 px were checked.
- `.claude/settings.json`'s allow list may not match `npm run test:e2e:3` (T9.1's note; not changed).
