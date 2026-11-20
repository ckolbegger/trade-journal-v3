# D9A-R closing report (D9 Stage A Refactor)

D9A-R reworked D9's stage A replay. The replay now opens as a full-page overlay. A table of sessions became session cards. The readout's stake became a grid, and Reward to risk now carries estimated odds. The Plan now sits beside what happened, and the chart gained a key, dates, labelled lines and first-crossing flags.

All 24 planned tasks are Done. The gate (T9AR.24) took three critics. Critic-3 passed every flow and left one moderate and two low defects. The user moved all three to tech debt and closed the gate. The gate's commit is `c2431d50`, tagged `claude-opus-5.5-d9ar`.

Sources: `plan/D09A-R-stage-a-refactor.md` (its Progress section and section 3), `evidence/D09AR/structural.md`, `critic-1.md`, `critic-2.md`, `critic-3.md`, `DECISIONS-PENDING.md`, `tech-debt.md`, `new-words.md`, `words-changed.md`, `tdd-log/` and `suite-runs/`, plus `git log`. Where a figure is not in those files, this report says "not recorded".

## At a glance

| Item | Figure |
|---|---|
| Wall-clock, first D9A-R commit to the gate's tag | 19 h 47 min (2026-11-18 23:13 to 2026-11-19 19:00) |
| The breakdown's estimate (lanes, section 3) | about 9 hours, with critic defects and bug tasks left out |
| Commits from the handoff tag to the gate's tag | 204 (77 evidence commits, 127 others) |
| Planned tasks | 24, all Done |
| Follow-on tasks (B, F, S and D IDs) | 96: 67 B, 12 F, 12 S, 5 D. Of these, 65 came from ocr findings, 12 from critic defects, 12 from suite failures, 5 carried out a decision, and 2 were routed from other tasks' reports |
| "Part 2" send-backs (no new ID) | 3: T9AR.24-B5, T9AR.24-B7, T9AR.24-B11-B1 |
| Flaky tests | 3 lane-tier events (4 test files), plus 1 merge-run failure that turned out to be a race in a test helper |
| First-run passes | 41, across 22 tasks, each with a mutation check. In 2 of them the mutation did not bite (T9AR.24-B5) |
| Critics | 3: critic-1 FAIL (9 defects), critic-2 FAIL (4), critic-3 PASS (1 moderate, 2 low) |
| Final suite (`gate3`, `24a6a513`) | unit 2485, integration 286, browser-1 126, browser-2 79, browser-3 156, checks 14 of 14; all passed |

## 1. Wall-clock time against the estimate

**In plain terms:** D9A-R took just under 20 hours from its first commit to the gate's tag. That is more than twice the breakdown's 9-hour estimate. About 6.5 hours of it were three long stretches with no commits at all. Without them, the work took about 13.3 hours. The breakdown's section 3 warns that critic defects and bug tasks, which it leaves out, "about doubled the estimate" in D8R and D9's stage A. Here the gate alone produced 27 follow-on tasks.

| Point | Commit | Time (EST) |
|---|---|---|
| Handoff tag `claude-opus-5.5-plan-r107` | `1cc612ea` | 2026-11-18 23:03:55 |
| Start: D9A-R's first commit after the tag | `90658cdf` "setup before wave 0" | 2026-11-18 23:13:07 |
| End: the gate's commit, tag `claude-opus-5.5-d9ar` | `c2431d50` | 2026-11-19 19:00:15 |
| **Elapsed, start to end** | | **19 h 47 min 08 s** |
| From the handoff tag to the end | | 19 h 56 min 20 s |

`provenance.md` records the session's start as about 22:50 EST, with the location checks finished at about 23:15.

**Long gaps with no commits.** Lanes commit in their own worktrees and are later rebased, so commit dates on main can mislead. These gaps are measured on every commit's author date and committer date taken together, so no lane commit falls inside them.

| From | To | Length | What the commits on either side record |
|---|---|---|---|
| `e7c42f5d` (T9AR.13, authored 01:42) | `b75e4597` 03:09 | 1 h 28 min | The closing commit reads "T9AR.12 decision answered (price chart gives up 12 px)". The question was open during the gap. |
| `9bce9630` 05:32 (T9AR.23 part 1) | `237a717f` 08:03 | 2 h 31 min | The closing commit reads "T9AR.18 recorded, its phone-fit decision answered". |
| `657d33c7` 13:27 (T9AR.24-B7 round 2's lane tier) | `cf0d6c86` 15:59 (T9AR.24-B7-D1) | 2 h 32 min | ocr's third round on B7 was put to the user. B7-D1 carries out the answer ("fix both, then merge"). |
| `a2c87929` 16:47 | `1f6f35aa` 17:14 | 27 min | Critic-2 was running (16:45 to 17:13 by its report). This is work, not idle time. |

The first three gaps total 6 h 31 min 36 s. Elapsed time less those gaps is **13 h 15 min 32 s**. The files do not say whether the session was idle or waiting for the user during each gap; they show only that a user decision was open.

The gate itself, from `38978773` (10:07, merge7 recorded and the gate in progress) to `c2431d50` (19:00), took about 8 h 53 min of the total.

## 2. Tasks and commits

From the breakdown's Progress section. The commits are the hashes on main after each lane's rebase.

| Task | Title | Wave | Lane | Status | Commits |
|---|---|---|---|---|---|
| T9AR.1 | Tooling: the deliverable's evidence folder | 0 | TL | Done (from `90658cdf`) | `b271d709` |
| T9AR.2 | Freeze the new types; split the replay adapter | 0 | TY | Done (from `90658cdf`) | `a8fcaf67`; B1 `d88001ac`; F1 `c2882ae0` |
| T9AR.3 | Trade Analysis: the estimated odds and the extremes' weight | 1 | DM | Done (from `8245f6c6`) | `5187512d`; B1 `02b4f51c`; B2 `499751ed` |
| T9AR.4 | Trade Analysis: the Plan's terms, and each fill against the Plan | 1 | DM | Done (from `79b900d3`) | `955e3568`; F1 `70ddec48` |
| T9AR.5 | Trade Analysis: a condition's first crossing | 1 | DM | Done (from `523a8a0e`) | `60e4bd32`; B1 `6855e7d3` |
| T9AR.6 | Facade and manifest | 1 | DM | Done (from `ada81477`) | `f40f46e3`; S1 `f327db49`; B1 `d2a9c2f5`; B2 `4d79df81`; B3 `36fc3d54` |
| T9AR.7 | The Replay overlay | 1 | OV | Done (from `8245f6c6`) | `4fd70538`; B1 `6a0cb594`; B2 `e45bd7a5`; B3 `6ffc25fb`; B4 `4ac0f109`; B5 `59714fa3`; B6 `ddc5e849` |
| T9AR.8 | Trade Detail: Replay opens the overlay | 1 | OV | Done (from `ddc5e849`) | `39d876a0`; B1 `a76254b5`; B2 `3325fb9f`; B3 `ebbcdab4`; F1 `ca634afb` |
| T9AR.9 | Review card: the Replay button | 1 | OV | Done (from `e526637e`) | `182b2f55`; B1 `f8e25291`; B2 `a5949701`; B3 `0587caeb`; B4 `a3946e98`; and T9AR.8-B4 `67e462eb` |
| T9AR.10 | Chart: the key, the dates, every line labelled | 1 | PL | Done (from `8245f6c6`) | `170970f4`, `611d3453`; B1 `61c562e6`; B2 `3235985a`; B3 `c7c01655`; F1 `8ef41e51`; S1 `780b88e1` |
| T9AR.11 | Chart: the entry session, an off-scale Worst case, a session with no Mark | 1 | PL | Done (from `8ef41e51`) | `fa1e2f64`; B1 `8258d88c` |
| T9AR.12 | Chart on a phone: the labels in a strip | 1 | PL | Done (from `d74afb24`) | `9c501b86`; D1 `c2b1f641`; B1 `33146bfe`; F1 `199c0216` |
| T9AR.13 | Readout: the stake grid, a Trade past a line, the change line | 2 | RO | Done (from `e526637e`) | `e7c42f5d`; F1 `a086218b` |
| T9AR.14 | One name per figure in the replay | 2 | RO | Done (from `bcab74c4`) | `9a40b95a` |
| T9AR.15 | Reward to risk with the estimated odds; the extremes' weight | 2 | RO | Done (from `9a40b95a`) | `fde70be5`; B1 `3cb51638` |
| T9AR.16 | The top of the replay, a session with no Mark, the hover box | 2 | SC | Done (from `b75e4597`) | `f1188678`, `c04fb5d0`; B1 `4179346d` |
| T9AR.17 | Session cards replace the table | 2 | SC | Done (from `3fa682b6`) | `6da6b33f`, `f383ac30`; B1 `79b77814`; B2 `445ee9ac`; B3 `c7320081`; B4 `39e8983a`; and T9AR.15-D1 `93dbec7e`, its S1 `b8351ccb` |
| T9AR.18 | The Plan beside what happened | 2 | SC | Done (from `445aa9d9`) | `b52cfe8f`; D1 `55aa3561`; B1 `6a0106ce`; F1 `e2ea1776` |
| T9AR.19 | Chart: a first crossing | 2 | PL | Done (from `c2882ae0`) | `fdbfba3f`; B1 `bd746e92`; B2 `c406aab9`; B3 `92933bb9` |
| T9AR.20 | Review card: the summary in the replay's words | 2 | RW | Done (from `3cb51638`) | `c20b4c28`; F1 `cc983980` |
| T9AR.21 | Remove the stake rows' change fields | 2 | DM | Done (from `bcab74c4`) | `cf79c748` |
| T9AR.22 | Node integration suite | 3 | IN | Done (from `7f095ba3`) | `eac257eb`; B1 `fc179b08`; B2 `b9eb87f9` |
| T9AR.23 | Browser suite | 3 | BR | Done (from `70ce0f74`) | `9bce9630`, `9618d87b`; B1 `f7e72247`; B2 `e843b82b`; B3 `c2b50bb6`; S1 `d80b9f00`; S2 `30f73488`; S3 `91d99766`; S4 `6a8d7f0e`; S5 `54bc7766`, its B1 `7f62fec6`; S6 `85ef2c57`; S7 `c7fd6f2c`, its B1 `998ee90f`, B2 `206c4e0c` |
| T9AR.24 | Gate: fresh browser critic | 3 | — | Done (critic-3 passed at `7a776e7e`; its moderate defect moved to tech debt by the user's decision, and its two low defects too) | B1 `e1f276da`, its B1 `a916ebc1`; B2 `825dd738`, its F1 `c354ff33`; B3 `53ba488a`, its B1 and B2 `3fc56da6`, F1 `c0b48dad`, B3 `50ba4feb`; B4 `a7fe9d08`, its B1 `a242cc63`, its F1 `bcc2a893`; B5 `da8dcb7e`, `0f1f4935`; B6 `74294bbe`; B7 `cf7ce65b`, `354ef6f5`, `83089351`, its B1 `ab7e8d3d`, F1 `9cb979c7`, B2 and B3 `a0673948`, D1 `cf0d6c86`; B8 `f309edab`; B9 `d11fddbc`; B10 `3605eb43`; B11 `2de56279`, its B1 `ce288d91`, `a9247d05`, its B2 `ab291829`; B12 `ef1c9b20` |

**Tasks from merge runs** (not in the Progress table): merge4-S1 `83fea156` (lane S4); merge6-S1 `2882fee8` and its follow-up `c614cd64` (lane OV); merge6-S1-D1 `59864c7a` (lane BR).

**Lanes:** TL (tooling), TY (types), DM (domain), OV (overlay), PL (plot), RO (readout), SC (session cards), RW (Review), IN (integration), BR (browser), and S4 for merge4-S1.

## 3. Each task's fix rounds

A "round" is one ocr review and the bug tasks (B) or follow-up tasks (F) it raised. The next round reviews those fixes. S tasks fix a suite failure, and D tasks carry out a decision. Every chain ended with an ocr round that found nothing.

| Task | Fix rounds |
|---|---|
| T9AR.1 | None. ocr found nothing. |
| T9AR.2 | ocr found nothing. Two later tasks were routed to lane TY from other tasks' reports: **T9AR.2-B1** (the `addMarkTo?` field T9AR.16 needed) and **T9AR.2-F1** (delete `pnlShortTitle`, from T9AR.10's report). ocr found nothing in either. |
| T9AR.3 | Round 1: **T9AR.3-B1** (a session's figures lacked the odds and the weight), **T9AR.3-B2** (the weight was read from the first fill, not the Plan). Round 2: no findings. |
| T9AR.4 | Round 1: **T9AR.4-F1** (nested ternaries; Doubtful, readability). Round 2: no findings. |
| T9AR.5 | Round 1: **T9AR.5-B1** (a role's run ended when a crossed condition was unreadable). Round 2: no findings. |
| T9AR.6 | Its lane tier failed one integration case: **T9AR.6-S1**. Round 1: **T9AR.6-B1** (Plan odds always 50/50 in a test builder), **T9AR.6-B2** (`BigInt` of a decimal). Round 2, on B2: **T9AR.6-B3** (float subtraction before converting). Round 3: no findings. |
| T9AR.7 | Round 1: **T9AR.7-B1** (Tab left the dialog past a closed `<details>`), **T9AR.7-B2** (no wide layout), **T9AR.7-B3** (the Tab case passed with Tab swallowed). Round 2: **T9AR.7-B4** and **T9AR.7-B5** (from B1), **T9AR.7-B6** (from B2). Round 3: no findings. |
| T9AR.8 | Round 1: **T9AR.8-B1** (two findings folded into one), **T9AR.8-B2**, **T9AR.8-B3** (Doubtful), **T9AR.8-F1**. **T9AR.8-B4** came from T9AR.9's round 1 (the same defect on Trade Detail). Round 2: no findings. |
| T9AR.9 | Round 1: **T9AR.9-B1**, **T9AR.9-B2**, **T9AR.9-B3** (and T9AR.8-B4). Round 2, on B1: **T9AR.9-B4**. Its first attempt stopped with no commit, and a main-session decision reshaped the second. Round 3: no findings. |
| T9AR.10 | Round 1: **T9AR.10-B1**, **T9AR.10-B2**, **T9AR.10-B3** (Doubtful), **T9AR.10-F1**. One finding was Wrong and dismissed (Decisions, below). Round 2: no findings. The merge2 run then failed three browser cases: **T9AR.10-S1**. |
| T9AR.11 | Round 1: **T9AR.11-B1**. Round 2: no findings. |
| T9AR.12 | **T9AR.12-D1** carries out the user's answer on the phone fit. Round 1: **T9AR.12-B1**. Round 2, on B1: **T9AR.12-F1** (Doubtful, readability). Round 3: no findings. |
| T9AR.13 | Round 1: **T9AR.13-F1** (Doubtful, readability). Round 2: no findings. |
| T9AR.14 | None. ocr found nothing. |
| T9AR.15 | Round 1: **T9AR.15-B1** (a screen reader lost the current ratio). Round 2: no findings. The task left `stakeSpoken` unfilled, so **T9AR.15-D1** filled it in lane SC. Its first brief was premature and stopped with no change. T9AR.17's browser run then found D1 had broken `replay.spec.ts:108`: **T9AR.15-D1-S1**. |
| T9AR.16 | Round 1: **T9AR.16-B1** (Valid), **T9AR.16-B2** (Doubtful; checked and left unchanged). Round 2: no findings. |
| T9AR.17 | Round 1: **T9AR.17-B1**, **T9AR.17-B2**, **T9AR.17-B3**, **T9AR.17-B4**. Round 2: no findings. |
| T9AR.18 | **T9AR.18-D1** carries out the user's answer on the phone fit. Round 1: **T9AR.18-B1** (Doubtful), **T9AR.18-F1**. Round 2 (with T9AR.23-S4 and T9AR.20-F1 in the same batch): no findings. |
| T9AR.19 | Round 1: **T9AR.19-B1**, **T9AR.19-B2**, **T9AR.19-B3**. Round 2: no findings. |
| T9AR.20 | Round 1: **T9AR.20-F1**, done in lane SC. Its ocr found nothing. |
| T9AR.21 | None. ocr found nothing. |
| T9AR.22 | Round 1: **T9AR.22-B1**, **T9AR.22-B2**. Round 2: no findings. |
| T9AR.23 | Its own suite found six places where the product disagreed with the plan: **T9AR.23-S1**, **T9AR.23-S2**, **T9AR.23-S3**, **T9AR.23-S4**, **T9AR.23-S5**, **T9AR.23-S6**. A browser failure after S1 gave **T9AR.23-S7**. ocr on S5 and S6: **T9AR.23-S5-B1**, then no findings. ocr on S7: **T9AR.23-S7-B1**. ocr on that: **T9AR.23-S7-B2**. Then no findings. ocr on part 2: **T9AR.23-B1**, **T9AR.23-B2**, **T9AR.23-B3**. Then no findings. |
| Merge runs | merge4: **merge4-S1** (no findings). merge6: **merge6-S1**, sent back for a follow-up (merge6-S1b), then no findings; then **merge6-S1-D1** (no findings). |
| T9AR.24 | Critic-1's nine defects: **T9AR.24-B1**, **T9AR.24-B2**, **T9AR.24-B3**, **T9AR.24-B4**, **T9AR.24-B5**, **T9AR.24-B6**, **T9AR.24-B7**, **T9AR.24-B8**, **T9AR.24-B9**. Critic-2's three: **T9AR.24-B10**, **T9AR.24-B11**, **T9AR.24-B12**. Their own ocr rounds follow in the next table. |

**T9AR.24's chains:**

| Bug task | Rounds |
|---|---|
| T9AR.24-B1 | Round 1: **T9AR.24-B1-B1** (W60's edge odds missed). Round 2: no findings. |
| T9AR.24-B2 | Round 1: **T9AR.24-B2-F1** (nested ternary). Round 2: no findings. |
| T9AR.24-B3 | Round 1: **T9AR.24-B3-B1**, **T9AR.24-B3-B2** (one commit), **T9AR.24-B3-F1**. Round 2: **T9AR.24-B3-B3** (low, a test did not take the leg its title named). Round 3: no findings. |
| T9AR.24-B4 | Sent back once to change `gaps.spec.ts:40` and a stale comment, then amended. Round 1: **T9AR.24-B4-B1** (Doubtful). Round 2: **T9AR.24-B4-B1-F1**. Round 3: no findings. |
| T9AR.24-B5 | Round 1: no findings, but **sent back as B5 part 2**: B5 did not yet meet C9AR.7's "a tap leaves no hover box behind". Part 2's round: no findings. |
| T9AR.24-B6 | Round 1: no findings. |
| T9AR.24-B7 | Round 1: **T9AR.24-B7-B1**, and B7 **sent back as part 2**, since it did not yet keep the flag in general. Part 2 stopped on an existing case, and the main session chose Option A. Round 2: **T9AR.24-B7-B2**, **T9AR.24-B7-B3**, **T9AR.24-B7-F1** (Doubtful, style). Round 3: two low style findings, put to the user. **T9AR.24-B7-D1** carries out the answer. Its ocr found nothing. |
| T9AR.24-B8 | Round 1: no findings. |
| T9AR.24-B9 | Round 1: no findings. |
| T9AR.24-B10 | Round 1: no findings. |
| T9AR.24-B11 | Round 1: **T9AR.24-B11-B1**, **T9AR.24-B11-B2**. Round 2: two findings, both Wrong and dismissed, but **B11-B1 sent back as part 2**, since it did not yet meet its own brief. Round 3: no findings. |
| T9AR.24-B12 | Round 1: no findings. |

## 4. Suite runs and browser stage timing

Complete cumulative runs on main. Lane tiers (one per task and per rebase) are in `structural.md` under each task.

| Run | Commit | Unit | Integration | browser-1 | browser-2 | browser-3 | Checks | Result |
|---|---|---|---|---|---|---|---|---|
| wave0 | `1018d618` | 2289 | 280 | 126 (5.4m) | 79 (5.1m) | 77 (5.1m) | 14 of 14 | all passed |
| merge1 | `79b900d3` | 2297 | 280 | task tier: `@every-task` 5 (13.6s) | — | — | 14 of 14 | all passed |
| merge2 | `72ece0c8` | 2332 | 280 | 126 (5.2m) | 79 (5.1m) | 74 passed, **3 failed** (5.5m) | 14 of 14 | failures pinned to T9AR.10, fixed as T9AR.10-S1 |
| merge3 | `e526637e` | 2357 | 280 | 126 (5.2m) | 79 (4.9m) | 77 (5.0m) | 14 of 14 | all passed |
| merge4 | `c394ce6a` | 2388 | 280 | 126 (5.6m) | 79 (5.0m) | 78 passed, **1 failed** (5.2m) | 14 of 14 | `e2e/d8/restore.spec.ts:31`, fixed as merge4-S1 |
| merge5 | `f287a68a` | 2416 | 286 | 126 (5.0m) | 79 (4.7m) | 79 (5.0m) | 14 of 14 | all passed |
| merge6 | `dbafc601` | 2455 | 286 | 126 (5.0m) | 79 (4.7m) | 124 passed, **1 failed** (7.0m) | 14 of 14 | `e2e/d9/gaps.spec.ts:94`, fixed as merge6-S1 |
| merge7 | `3e92c98f` | 2455 | 286 | 126 (5.0m) | 79 (4.7m) | 127 (7.1m) | 14 of 14 | all passed; acceptance commands 7 of 7 |
| gate2 | `a2c87929` | 2475 | 286 | 126 (5.0m) | 79 (4.7m) | 149 (**8.2m**) | 14 of 14 | all passed, no reruns |
| gate3 | `24a6a513` | 2485 | 286 | 126 (5.1m) | 79 (4.8m) | 156 (**8.7m**) | 14 of 14 | all passed, no reruns |

**Browser stage timing.** Browser-3 took 8.2 minutes in `gate2` and 8.7 minutes in `gate3`, over its 8-minute limit both times. The suite runner advises a **browser-4 stage**, and this goes to the D9B handoff too. T9AR.23 had estimated browser-3 at about 6.6 minutes after part 1, and about 7.0 after part 2. The gate's bug tasks then added browser cases: browser-3 grew from 127 cases in `merge7` to 156 in `gate3`.

## 5. Flaky tests

| Run | Test | What happened | Outcome |
|---|---|---|---|
| Lane tier `T9AR.19` | `src/ui/screens/TradeList.test.tsx` (the Open list's Ready state, `marks('tj:open-list-ready')` expected 2, got 1) | A known flaky case (tech debt item 11, P138). It passed alone (36 of 36). | Logged as a flake. The lane's rerun at merge (`T9AR.19-rebased`) is the tier of record. |
| Lane tier `T9AR.9-B` | `src/app/bench-generator.test.ts` and `tools/wording-rules.test.ts` | Each took about 5.4 s against the 5 s timeout while two lane tiers ran at once. The main session ran them alone and got 62 of 62. | Load timeouts, not a defect. The lane's rerun after its rebase is the tier of record. |
| `merge4`, browser-3 | `e2e/d8/restore.spec.ts:31` (B8.3, line 84) | After a relaunch, the Trade Detail "Today" view lacked its Marks block. Rerun alone it passed (6 of 6, then 3 of 3 with `--repeat-each=3`). It was not a known flaky case, so it became merge4-S1. | **Not a flake in the end:** merge4-S1 found a race in the test helper `viewsOf`, present at stage A's tag too, not a regression. The helper now waits for the replay read. Under 20x CPU throttling the old helper failed and the new one passed 3 of 3. |

`merge7`, `gate2` and `gate3` record no flaky case. The other merge-run failures (merge2, merge6) were real failures with real fixes, not flakes.

## 6. First-run passes

A first-run pass is a new case that passed the first time it ran, before any code was written for it. Each one was flagged, and checked by a mutation: a deliberate break in the code that the case had to catch.

| Task | Case | Mutation check |
|---|---|---|
| T9AR.4 | O-S2's every condition with its own result | A Stop's `pnlIfHit` not negated: failed on an assertion |
| T9AR.4 | R-AXIO-U's added lot Above the entry | Above and Below swapped: failed |
| T9AR.4 | R-DALE-D's buyback Above the Target | An option fill matched to Underlying conditions: failed |
| T9AR.5 | Case 2: the first crossing kept, the run dropped when Active again | `since` given on every session once a first exists: `expected [ '2026-11-06', '2026-11-06' ] to deeply equal [ '2026-11-06', null ]` |
| T9AR.7 | The finished-Trade and symbol-alone header | Heading rendered `header.slice(0, 4)`: failed on the heading text |
| T9AR.7 | The shell banner | Cleanup set `aria-hidden` instead of removing `inert`: failed with the banner still inert |
| T9AR.8 | Case 2: no Replay button on a Planned or records-disagree Detail | The guard made always true: `expected <button …> to be null` |
| T9AR.8 | Three added adapter cases in `overlay.props.test.ts` (open-Trade header, Final result, symbol alone) | The Final result label made always "Trade P&L"; the no-Mark branch returned "CORV · Trade P&L": both failed, then restored |
| T9AR.9 | The unsaved choice and Intent survive | `key={String(replayOpen)}` on `ActionForm`: "expected radio to have property checked true" |
| T9AR.9 | Save Marks refreshes the replay | A replay captured at first mount: "expected 'Thu Oct 8 · 1 of 1. $0.00' to be 'Mon Oct 12 · 2 of 2. +$582.00'" |
| T9AR.9 | Price History link | `from=trades`: 1 failed |
| T9AR.9 | Reopen on the named session | `sessionX`: "expected 'Mon Oct 12 …' to be 'Thu Oct 8 · 1 of 2. $0.00'" |
| T9AR.9 | No button without a replay | The `trade.replay &&` guard dropped: 1 failed |
| T9AR.9-B2 | Keep the card opened by its header | The check made inert: `Unable to find an accessible element with the role "region" and name "ABC review"` |
| T9AR.12 | Case 4: the strip lists a label the wide drawing would leave out | "List a label only when the placer finds it a spot": `Sold 3: expected 'Stop +$316 · Banked +$478 · Target +$…' to contain 'Sold 3'` |
| T9AR.13 | The change line under Trade P&L and the Marks only | A change line attached to the Reward to risk row: failed (`… not to contain 'since'`) |
| T9AR.13 | Critic-2's carry, unit half: a signed amount in one piece of text | A "P&L " prefix in the cell: `expected 'P&L −$543.00' not to match /\s/` |
| T9AR.13 | The canonical terms, props half | A term renamed: failed on `deeply equal` |
| T9AR.16 | The acknowledgment keeps its own words | AcknowledgedUnavailable no longer sent to its figure words: failed |
| T9AR.17 | Name the cards' list as the charts' description | The list id changed: failed |
| T9AR.17 | Carried defect 1a (the past line on a card) | The past-line text cut: `Unable to find … Past the Stop by $180.00 (0.30R) · at Stop −$740.00` |
| T9AR.18 | Name what each price is a price of | Always the option's right: failed |
| T9AR.18 | Two Stops with their own rows | First condition only: failed |
| T9AR.23-S7 | The cursor's name left out on a 280 px chart | Always draw the cursor's name: failed, then restored |
| T9AR.23-S7-B2 | No end label forms on a stock Trade | `endLabels: []`: failed |
| T9AR.23-S7-B2 | No end label when even the shortest cannot clear | Fall back to the last form: failed |
| merge6-S1-D1 | The P&L chart 800 wide and still at every session of five Trades (the fix was already merged) | The readout column at 480 px: both tests failed ("the P&L chart is 729 wide … Expected: >= 800"); `git diff -- src` empty after restoring |
| T9AR.24-B3 | Do not bring a started Action back when the Review was left some other way | Set aside on every report, with the discard disabled: failed, then restored |
| T9AR.24-B3-B2 | E2e: keep a started Action after Forward to Price History and Back (B1's change covered it) | `from === 'review'` changed to `'nope'`: failed ("after the round trip: Exit"), then restored |
| T9AR.24-B4-B1 | The dash named No Mark for Acknowledged unavailable | The Acknowledged clause removed: failed, then restored |
| T9AR.24-B5 | E2e at 375, no hover box from a Review card | **The mutation did not bite.** With the 1000 ms gate made never true, both cases still passed. They are kept as guards and do not detect the defect; the unit case and the 320 e2e case do. |
| T9AR.24-B5 | E2e for DALE from Trade Detail at 320 (renamed in part 2 to "leave the slider's value uncovered by any chart element …") | As above: the mutation did not bite. The critic's band did not reproduce. |
| T9AR.24-B7-B1 | The overlap helper's `LABELS` includes the flag's label | The flag put at the banked label's spot: failed ("Realized −$440" over "Stop breached"), then restored |
| T9AR.24-B8 | E2e, the key on one line for AXIO, DALE-hold and CORV, and R-DALE-U's one-line and no-Execution case (4 cases) | The wide key's gap set to 60 px: all 5 key cases failed (BREN's included), then restored |
| T9AR.24-B11-B2 | Select Price History and throw nothing when the session is well formed but has no column | A throw on a missing target: failed, then restored |
| T9AR.24-B11-B1 part 2 | Do not override a drawer request made from the overlay | The clearing lines removed from `choose` and `openReplay`: failed, then restored. No UI path calls `requestDrawer` while the replay is loading. |

Total: **41 first-run passes**. The handoff's open questions list also names **T9AR.7-B3**: a test-only change proved by a mutation (a trap that always refocuses Close failed the tightened case). That was a test change, not a new case, so it is not counted above. Several other test-only tasks used the same kind of "bite" check without first-run passes being involved (T9AR.22-B1, T9AR.22-B2, T9AR.23-B1, T9AR.23-B2, T9AR.23-B3, T9AR.24-B3-B3, T9AR.13-F1).

## 7. Decisions

### The user's decisions (all answered; none pending)

`DECISIONS-PENDING.md` reads "None pending".

| Question | Answer | Carried out by |
|---|---|---|
| T9AR.12: a 200-high P&L chart did not fit one phone screen at 320 by 667 (601 px of 589) | Take the 12 px from the price chart's phone height. The P&L chart keeps 200. | **T9AR.12-D1** `b5412945`. 12 px left the Review card replay half a pixel over, so the phone price chart gave up 13 px (123 high, from 136). |
| T9AR.18: the first-crossing sentence did not fit one phone screen at 320 by 667 (616 px of 588.9) | Below the charts on a phone (option 1). Wide screens and the words are unchanged. | **T9AR.18-D1** `b49ff547` (on main `55aa3561`) |
| T9AR.24-B7: a third ocr round still left two low style findings | Fix both, then merge. | **T9AR.24-B7-D1** `cf0d6c86` |
| T9AR.24: critic-3 left one moderate defect (the Review card summary files the past-a-line row under a heading) | Record it as tech debt and close the gate now. | `tech-debt.md`; the gate closed on `gate3` and critic-3 |

### Implementation-level decisions by the main session

These are recorded in `structural.md`. None needed the user.

- **T9AR.2:** `view-doubles.props.ts`, a shared test-double file the ownership table does not name. A lane may add to it. Changing or removing an export is a stop-and-report, routed to lane TY.
- **T9AR.3-B2:** the task first read the extremes' weight from the first Execution. The main session accepted that, but ocr raised it, so it became a bug task: the weight now comes from the Plan.
- **T9AR.5-B1:** a role reads crossed when any condition does. It reads not crossed only when every condition has a reading and none is crossed. Otherwise the session has no reading for the role (A271, AC-RPT-004).
- **T9AR.8-B3:** an overlay opened from the address returns focus to the Replay button on Close (A273).
- **T9AR.9-B4:** on Replay, first replace the current entry with the card actually open, then push `replay=open`. This was narrowed to replace only when the entry names something else, because an unconditional replace broke two existing cases.
- **T9AR.11-B1:** P146 governs a lone session between two No Mark sessions too: its area runs to the edge of each shaded column.
- **T9AR.19-B1:** one field in `replay.types.ts` (lane TY's, idle) was routed to lane PL. This was ownership routing, not a plan change.
- **T9AR.23-S7:** changing the start-label rule meets W67 as written, so it was a fix within the plan, not a pending decision.
- **T9AR.24-B7 part 2, Option A:** an existing case's setup may change (the flag made too wide for any row) as long as its title and its key assertions stay. T9AR.19, A280 and W66 all hold.
- **T9AR.22-B1:** past the Target, the odds read "100% : 0%", not "no odds". That is A267's formula, not a deviation. The reviewer asked for it to be listed as an open question in this report; the plan does not state this case.

### ocr findings dismissed as Wrong

- **T9AR.10**, `plot.props.ts:63`: "the key's At Stop and At Target depend on the outcome figures, so the price strip's lines go unnamed". Dismissed: those key entries name the P&L chart's result lines. The price strip's Stop and Target lines carry their own labels, and A280 asks the key to name only what has no label of its own.
- **T9AR.24-B11-fixes**, two comments. ocr withdrew its trailing-newline claim itself: `$` without the `m` flag rejects a trailing newline.

## 8. The user's rule of 2026-11-19

The user made this rule while critic-3 was running:
- Style-only ocr findings and low critic defects now go to `tech-debt.md` instead of becoming tasks. The open tech debt is reviewed with the user after the gate passes.
- The main session no longer sends a task back for a "part 2" because of reviewer notes.
- So a critic-3 with only low defects would close the gate on the `gate3` full run.

**Before the rule, three tasks were sent back that way.** **T9AR.24-B5**, **T9AR.24-B7** and **T9AR.24-B11-B1** were each sent back for a "part 2" after an ocr round with no findings or only Wrong findings. Each time the main session gave a reason: the task did not yet meet its own defect's expected behaviour or its own brief. In practice, though, the send-backs drew on the reviewers' notes, which the rule now forbids. Style-only findings from before the rule were also made into F tasks and fixed. Examples are the nested-ternary findings behind T9AR.4-F1, T9AR.12-F1, T9AR.24-B2-F1, T9AR.24-B4-B1-F1, T9AR.24-B7-F1 and T9AR.24-B7-D1. `tech-debt.md` notes that these earlier items are not listed there.

## 9. Critics with their cost, and how the gate closed

From the critic table under "T9AR.24 Gate" in `structural.md`. The "Critics" table at the end of that file was left empty; the figures are in the gate's own table.

| Critic | Run at | Brief | Tokens | Tool calls | Duration | Result |
|---|---|---|---|---|---|---|
| critic-1 | `38978773`, about 09:40 to 10:22 | `critic-brief.md`, section 8's flows, coach review 1's 15 points to recheck, `words-changed.md` and `new-words.md` named | 284,147 | 98 | 16 min 21 s | FAIL: 9 defects (5 high, 2 moderate, 2 low) |
| critic-2 | `a2c87929`, about 16:45 to 17:13 | The same brief, with the flows listed by ID, the support exports named and the port rule, and without critic-1's report | 279,440 | 118 | 26 min 45 s | FAIL: 4 defects (1 high, 3 moderate) |
| critic-3 | `7a776e7e`, 18:35 to 18:54 | Critic-2's brief, with the widths 1366 and 1536, the answered decisions named, and P153 with the releases build | 287,086 | 149 | 22 min 59 s | PASS: 1 moderate, 2 low |
| **Total** | | | **850,673** | **365** | **66 min 05 s** | |

The run times above come from each critic's own report header. The durations come from the table.

**How the gate closed.**
1. **Critic-1** failed flows C9AR.2, C9AR.3, C9AR.5 and C9AR.7, and passed C9AR.1, C9AR.4 and C9AR.6. Its 9 defects became **T9AR.24-B1**, **T9AR.24-B2**, **T9AR.24-B3**, **T9AR.24-B4**, **T9AR.24-B5**, **T9AR.24-B6**, **T9AR.24-B7**, **T9AR.24-B8** and **T9AR.24-B9**, run one at a time with a failing test first. Full run `gate2` then passed.
2. **Critic-2** failed C9AR.2 and passed the other six flows. It saw every critic-1 defect fixed. Defects 1, 3 and 4 became **T9AR.24-B10**, **T9AR.24-B11** and **T9AR.24-B12**. Defect 2 was dismissed (below). Full run `gate3` then passed.
3. **Critic-3** passed all seven flows and addressed the coach's 15 points. Under P151, three critics that leave only moderate or lower defects let the gate close with tech debt items. The moderate defect needed the user under the cap. The user said: "Record it as tech debt and close the gate now." The two low defects went to tech debt under the user's rule.
4. T9AR.24 was marked Done, section 13's seven rows were marked covered (`acceptance-commands.sh` 7 of 7 after T9AR.23, and `gate3` passed), D9's Progress row for D9A-R was marked Done, and the tag `claude-opus-5.5-d9ar` was set.

**Critic-2's defect 2, dismissed.** On a phone the first-crossing line sits below the charts and the key, not after the status line as W64 says. This is exactly the user's answer to the T9AR.18 decision ("below the charts on a phone"), carried out as T9AR.18-D1 and recorded in `DECISIONS-PENDING.md`. So it is not a bug task. Critic-1 had noted the same placement among its minor observations.

**Critic-3's minor observations, carried forward for stage B** (from `critic-3.md`, section 4; no tasks):
- **Reload resets the session.** A reload with the overlay open lands on the latest session, since the address carries no `session` (A274 allows this). After closing an overlay opened from a link with `&session=2026-11-09`, the address keeps `?session=2026-11-09`.
- **A final headline has no R** ("+$1,138.00", "+$564.00"), carried from critic-2. The expired put's final session also shows "up $0.00 since Thu Nov 19".
- **"+3.05R" against "3.05R".** The Review card summary writes "+$988.00 · +3.05R" where the replay writes "3.05R". At 375 the card breaks that pair after the "·".
- **Key swatches.** The key shows "Stop breached" and "Target reached" as black squares, while the flags are red and green.
- **Hover box.** It floats at the top right of the charts and can cover the cursor's own value ("$104.00").
- **Cursor date at 320.** The phone axis at 320 drops the cursor's date (W67). The date still shows beside the slider.
- **Focus timing.** After a reload, focus reaches "Replay" a moment after Close or Escape. At rest it is correct.
- **Banners checked.** For P153 only the storage warning and the update notice were triggered. The read-only and "another tab" banners were not, because `__tjFaults` was not exposed.

Critic-2's minor observations not covered by critic-3's list: "Add the Mark" focuses the first "Correct" button, not the put's Price field; closing the first card's overlay on the Review goes back to `/review` without `trade` and `panel`; many tab stops (critic-3 saw this fixed); P153 not checked (critic-3 checked it).

## 10. Defects moved to tech debt

From `tech-debt.md`. These are to be reviewed with the user now that the gate has passed.

| Source | Kind | Item |
|---|---|---|
| critic-3, defect 1 | Moderate, moved by the user's decision | On the Review card (`CardFigures.tsx`), the past-a-line row sits under a heading: "Current Risk · Past the Stop by $300.00 (0.50R)" (AXIO, DALE), "Remaining Reward · Past the Target by $32.00 (0.10R)" (BREN). The replay puts it above both headings (W56, decision 7, coach point 6). Fix: drop the heading from that row in both of the card's groups. |
| critic-3, defect 2 | Low | Finished Trades (BREN sold out, DALE expired) draw the At Stop and At Target lines with no label, against A280 ("a line is drawn with its label or not at all"). |
| critic-3, defect 3 | Low | Labels drawn over on sessions other than the entry: BREN "Sold 2 at $4.00" under the Target line; AXIO "Realized −$440" under the sale line and flag pole; the "No Mark" column label under the cursor; at 320, "Strike" under the price line, and a Mark dot on the slider value's minus sign. |

## 11. New words awaiting approval

From `new-words.md`. These screen words have no approved row. Each task used them as it would have recommended, and they await the user's approval.

| Task | Screen | Words | Nearest approved row |
|---|---|---|---|
| T9AR.18 | Replay top and card Events, a first crossing | "Stop breached, first seen Mon Nov 9." (a Stop first seen after a gap and no longer crossed). A session with both crossings joins the two sentences, Stop first. | W64 |
| T9AR.20 | Review card summary, the row for a Trade past a line | Its label is the group heading alone, "Current Risk" (past the Stop) or "Remaining Reward" (past the Target), titled "Stop Overrun" or "Target Overrun"; the value is "Past the Stop by $300.00 (0.50R)". **Critic-3's defect 1 is about this row** (now tech debt). | W56 (the value); decision 7's names |
| T9AR.20 | Review card summary, Reward to risk with no current ratio | The reason followed by the Plan's ratio, for example "Mark missing: DEF, Mon Oct 12 (Plan 2.40 to 1)" | W59 |
| T9AR.15 | Readout and stake sentence, the odds | The mirror of W60's edge when the Stop side is under one percent: "over 99% : under 1%"; spoken "over 99% chance of the Target first, under 1% of the Stop first" | W60 |
| T9AR.13 | Readout, the stake grid's first column header | "Stake", visually hidden (read by a screen reader only) | A278 names the three figure columns only |
| T9AR.12 | Replay chart on a phone, the P&L drawing | The slider's value beside the dot, signed: "+$982" | W69; the signed-amount rule |
| T9AR.12 | Replay chart on a phone, the label strip | The strip's order: by level from the lowest figure up, then Risk and Reward, "past" and the Worst case tag, then sales; Break-even left out (the key names it) | W69 |
| T9AR.10 | Replay chart, the key | "Strike" (the key's entry for the strike line) | W66; W40's line label "Strike $100" |

T9AR.18's other uncovered points, recorded in `structural.md` but not in `new-words.md`: no "since" form for a Target, and both crossings on one session joined Stop then Target. T9AR.16 recorded as uncovered the session's date beside the headline (muted, smaller) and "the call" for a call (the plan names the put); these are not in `new-words.md` either.

## 12. Texts shortened under P137

From `words-changed.md`. Each entry shows the text before and after.

| Task | Where | Before | After |
|---|---|---|---|
| T9AR.13 | Readout, each stake row | "At Stop: $672.00 · 2.07R · P&L +$316.00" in one cell (the words "P&L " repeated on every row) | Three cells under the column headings "From here", "R" and "P&L if hit": "$672.00", "2.07R", "+$316.00" (A278, W55) |
| T9AR.13 | Readout, a Trade past a line | A row "Stop Overrun $180.00 · 0.30R · P&L −$740.00", then "Reward to risk: Stop breached" | One row "Past the Stop by $180.00 (0.30R) · at Stop −$740.00" above the two headings, and no Reward to risk row (W56). A planned amount passed without the Stop crossed reads "Past the Stop's amount by $9.00 (0.01R) · …" (was "Past Stop's amount", ending "Not triggered"). |
| T9AR.13 | Readout, a session with no Mark | The words "No Mark" in each cell | A dash named "No Mark" (W61, as Price History) |
| T9AR.23-S7-B1 | P&L chart, an option's right-hand time-axis label, on a narrow drawing only (so it clears "Mon Nov 2") | "Expires Fri Nov 20" | "Expires Nov 20" below about 227 px wide; "Exp Nov 20" below about 214 px (the Review card at 320) |
| T9AR.10 | P&L chart title | "Trade P&L · dollars for the whole Position, between the result at the Stop and at the Target" (phone: "Trade P&L") | "Trade P&L" at every width (decision 6, approved) |

T9AR.14's changes ("Realized −$440.00", "BREN Mark $104.00", "2.00 to 1") are the plan's W57, W58 and W59, not P137 shortenings.

## 13. Reviewer notes recorded for later

These notes came from ocr reviewers and from the task subagents' reports. They were recorded, not made tasks. They are grouped by area, and the first group holds the notes the handoff and the session asked for by name.

### The notes asked for by name

| Note | Source |
|---|---|
| **The data-router limit.** `UNSAFE_NavigationContext.navigator.location` works with `BrowserRouter` and `MemoryRouter`. Under a data router (`createBrowserRouter`) it is undefined, and a started Action's draft would stop surviving the Price History trip, silently. Nothing uses data mode today. | ocr on T9AR.24-B3's fixes (round 2) |
| **The Journal drawer's "Mark missing".** The Journal drawer's session card titles a no-Mark session "Mark missing: …" (`journal.props.ts:174`). That is a separate surface, outside this deliverable's fix. | ocr on T9AR.24-B4 |
| **Firefox and WebKit unverified for the hover.** B5 part 2's rule (a mouse hovers only from its first real `pointermove`) rests on a Chromium probe. | ocr on T9AR.24-B5 part 2 |
| **The hatch toggling while dragging.** A cursor session's hatch with no room for its label is dropped while the slider is on it, and drawn once the slider moves on. This is intended, but visible while dragging. | ocr on T9AR.24-B6 |
| **The key's words hardcoded.** "Past the Stop", "Past the Target" and "At stake" sit in `corridor.tsx`'s `DRAWN_AREAS`, not in `plot.props.ts` like the other key entries. | ocr on T9AR.24-B6 |
| **The key likely wrapping between 861 and 1279 px.** From 861 to 1279 the chart column shrinks to about 460 px, so the busiest key likely wraps. T9AR.10 and W66 name no width. The margin at 1280 is thin (about 16 px on BREN's busiest session). | ocr on T9AR.24-B8; B8's own note that 861 to 1279 was not tested |
| **The Expiration line unnamed in the key.** An Expiration line is drawn but the key does not name it, because W66 has no entry for it. That is a plan question, not a defect. | ocr on T9AR.24-B8 |
| **The price-strip gutter.** `price-strip.tsx` has its own label placer with the same structural gap over the price axis that B10 fixed on the P&L chart. It cannot show at 461 px or wider. The new e2e covers only the P&L chart. | T9AR.24-B10's agent and its ocr |
| **Back or Forward onto `replay=open` while the replay loads.** Browser Back or Forward onto a `replay=open` entry while the replay loads sets the overlay open without `openReplay`, so the Price History arrival stays armed and could later take focus from Replay. Narrow and Doubtful. | ocr round 3 on T9AR.24-B11-B1 part 2 |
| **The Plan block's e2e.** Its stray-mark scan bites, but it does not assert that each odds pair and signed amount is marked, per fixture. | ocr on T9AR.24-B12 |

### Other notes on the gate's bug tasks

- **T9AR.24-B1:** a screen reader still reads each card row as one sentence. Re-parsing finished text has to mirror every formatter; typed parts, or glue in the formatters, would hold up longer. 1920 and CORV are not covered by the e2e. Watch item: "63% of the way" in the status line would fail the check if it ever reached a card.
- **T9AR.24-B2:** `card-figure` is a global rule, but its name ties it to the cards' stylesheet.
- **T9AR.24-B3:** a full reload on the way back loses the draft, since it is held in memory. The holder had no test reset (B3-B1 added `resetDrafts()`). B3-B3's bite fails before the new steps, so only a mutant that breaks Forward alone would prove them, and no check sits between the second Back and the Forward.
- **T9AR.24-B4:** the new cases cover only an option's missing Mark. Nothing asserts the readout row for Acknowledged unavailable (B4-B1 then added a case for it). The Review card summary is unaffected.
- **T9AR.24-B5:** a mouse resting on a session when the chart opens shows no hover until it moves. A touch outside the session columns does not clear a mouse hover, which can only happen on a hybrid device. The tap-clears path has no e2e case, since a touch context has no mouse.
- **T9AR.24-B6:** earlier sessions' hatches are unlabelled areas that the key names, while A280 speaks of lines.
- **T9AR.24-B7:** on real AXIO the flag holds at frame widths 640 to 1800, but a sweep of 1,260 synthetic charts still dropped it in 154 before part 2. After round 2: the tie reads as the pole, runs along the sale marker's line on AXIO, and is hidden by the cursor on its own session. Every label relies on the same 3 px halo, and none is kept off lines. The tie is not reserved in the placer, so it can pass under a banked label. The e2e's "nothing after the label" check assumes one flag. A pre-existing case: a never-dropped banked label can overlap the axis's cursor text. The changed existing case still proves the key rule, but the crowded-out path has no case of its own.
- **T9AR.24-B9:** the link is an `<a>`, not a `<button>`, because it navigates.
- **T9AR.24-B10:** at a 461 to 521 px chart, session 3 of 15, the Remaining Reward tag is now dropped, and its bar with it (A280).
- **T9AR.24-B11:** a session with no column leaves focus on `<body>`. A column scrolled off to the left would park under the sticky label column, since there is no `scroll-padding-left`. The arrow keys and "Reflect now" have no case of their own while the replay loads.

### Notes from the browser suite and the merge runs

- **T9AR.23 part 1:** the Detail overlay's slider session does not survive a reload (the plan does not ask that it survive). The Review card reopens on its last session. `expectClearOfCursor` leaves out the cursor's own labels. The card's Trade P&L reads "+$988.00 · +3.05R".
- **T9AR.23-S1, S2, S3:** on a phone the app-wide two-column `dl` still applies to the readout. Between 860 and 861 px (fractional, under zoom) the override is off. The phone title can wrap to two lines though the CSS comment says "one line". The fixed readout column could overflow with four-digit stake figures; no test covers that. The file ends with `}}` on one line.
- **T9AR.23 part 2 and its B tasks:** labels still not compared: Max reward, the slider's value and markers (`slider-value`, `max-reward-label`, `break-even-label`, `marker-label`). The stake tag and the result share the "at Stop" row, so a swap would pass. Requiring the price lines on every session is brittle. "Past the Stop's amount by" is not mapped. The stale `B9AR.4-BREN-Thu-11-12.png` is left in place. The acknowledged-unavailable check could match `calculation-words.ts`'s words exactly.
- **T9AR.23-S5-B1:** a long press with no `pointercancel`, or a drag off the button that does not scroll, could still leave the `tapped` flag stale. No test covers the `keydown` reset.
- **T9AR.23-S7:** the cursor's name is clamped between the edge labels with no tie to its column, so on a narrow chart with many sessions it can sit about 5 columns from its session. On the first session of a wide chart, the date is drawn once at the far left. The narrowest end-label form clears down to about 185 px, and the shortened label is visual only. In `plot.props.ts`, the "trading days" comment now sits above `expiresLabels`.
- **merge6-S1 and merge6-S1-D1:** only about 5 px of headroom over the stake grid's minimum, which depends on the font. From 861 to about 1100 px the chart is about 418 to 657 px wide, untested. `padding-right: 0` on the stake group changes nothing. merge6-S1-D1's session count comes from the slider's `max` but is never asserted. The dialog's name is not checked against the Trade. The stake-grid loop would pass on zero grids. There is a stray whitespace edit on `INTENT`.

### Notes from the planned tasks

- **T9AR.6-S1:** I9.7 checks `getTrade` only with `toContain('Replay')`; the manifest test lists `Odds`.
- **T9AR.7:** `overlay.tsx` line 16 lacks a space (`||sibling`).
- **T9AR.15-B1 and T9AR.15-D1, suggested hardening:** the readout splits the finished ratio text at " · ", which is fragile. `ratioWords` could hand over the ratio and the odds separately, and the visible and spoken stake sentences could be built from the same parts in `stake-words.props.ts` instead of searching the finished sentence. The "under 1%" edge at exactly 1% is untested, and so are the edge wordings in D1.
- **T9AR.16:** `needs-you.props.ts:58` and `TradeList.tsx:294` use the listing `.symbol` for their Marks links, the same defect T9AR.16-B1 fixed for the replay. They are outside D9A-R.
- **T9AR.17:** readout groups are found by title with no shared constant. The cards also split the odds at " · ". `gapStakeGroup` gives no stake rows when neither Stop nor Target is a Value (doubtful against P148). The charts are described by the shown page of cards only, which matches A277's design but is narrower than the old table. B2's disabled-button trigger and one-page fallback are untested, and B3's `pnl` half is vacuous in its test.
- **T9AR.18:** `planBlockOf` words every condition by the first Planned Leg, which is a hidden problem for multi-leg Plans. With two conditions of a role, the chart's headline At Stop and At Target need not equal a row. A re-crossed Stop says only "Past the Stop since". A card's Events say "first breached" even after a gap. After D1, the flex-column lines are inert, because `.replay-overlay .replay-card { display: grid }` wins and only `order` takes effect. The `:not(.replay-crossing)` is redundant.
- **T9AR.19-B3:** the test checks the flag's height only loosely, and does not check that the flag stays on later sessions.
- **T9AR.20:** the card drops Reward to risk only past a line, while the replay also drops it when a condition is crossed but the amount is not passed, so the two can differ. The card keeps the row as "<reason> (Plan …)" where the replay hides it. The Remote weight is an inline style, where a stylesheet rule on `[data-weight='Remote']` would keep the two screens' looks together. There is no odds note on the card.
- **T9AR.22:** I9AR.4's counts are copied from I9.6, not imported, and I9AR.4 omits I9.6's read-order and no-narrative-store checks.

## 14. The screen-reader order note, and lookup misses

**The screen-reader order (T9AR.18-D1).** On a phone, CSS `order` moves the first-crossing sentence below the charts. A screen reader follows the page's order, not the CSS order, so on a phone it still hears the sentence right after the status line, as on a wide screen. Matching the order that is seen would need the sentence rendered twice, or JavaScript. That was not done, so the brief's "reading order follows what is seen" is **not met**.

**Lookup misses.** A lookup miss is a place where the breakdown's lookup table (section 1.5) named the wrong file or line. Each was accepted, and none was a plan revision.
- **T9AR.17:** the `describedBy` id is built in `plot.props.ts`, not in `replay.props.ts` as section 1.5 says. One line was changed in `plot.props.ts`.
- **T9AR.20:** `CardMarks.test.tsx` lines 270 and 287 were changed ("Current Marked Trade P&L" became "Trade P&L"), though section 1.5 lists the file under Stays. Those lines assert the card's own summary, so W70 renames them.
- **T9AR.23-S7-B2:** the frozen plan's lookup rows (the time-axis row in section 1.5, and the index) still name `endLabel`, which became `endLabels`.
- **T9AR.10** (not called a lookup miss in the evidence): expected values in `corridor.test.tsx` and `plot.props.test.ts` changed as consequences of planned cases but were not in section 1.5's lookup. They were accepted as implementation-level.

## 15. Other points for the record

- **A command denied to a subagent.** During T9AR.20, the agent's `npm run build:releases` was denied by the permission classifier. `e2e/d4/review.spec.ts` and the first case of `e2e/d5r/review.spec.ts` then failed against a stale `dist-releases/current`. The main session did not rerun it. Both specs passed in `merge5`.
- **A regression one task let through.** T9AR.15-D1's agent ran no browser spec, saying no spec read the stake paragraph. That was wrong: `replay.spec.ts:108` failed in T9AR.17's run and was fixed as T9AR.15-D1-S1.
- **No permanent case measured the chart width at every session** after merge6-S1's follow-up. merge6-S1-D1 then added one.
- **Stage A's provisional words.** The handoff asks this report to list which of stage A's provisional words (`evidence/D09/new-words.md`) D9A-R replaced, for example "Past Stop's amount" and "Not triggered" against W56, and the Underlying price without "$" against W58. The D09AR evidence does not record that comparison, so the list is **not recorded** and is still to be done. `words-changed.md` does show that "Past Stop's amount" and "Not triggered" were replaced (T9AR.13).
- **The odds past the Target** read "100% : 0%" (T9AR.22-B1's reviewer). This is the plan's formula, not a deviation, but the plan does not state the case. It is listed here as an open question for the user.
