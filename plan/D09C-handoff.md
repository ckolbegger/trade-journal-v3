# Handoff: `claude-opus-5.5`, implement D9, stage C (the meter and the Open list's order)

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, stage C's specifics and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-11-20, when stage B's gate closed (tagged `claude-opus-5.5-d9b` at `ff80c66f`). The frozen plan is revision 108.

This session **implements stage C of D9, "Trade replay": the meter and the Open list's order**, the deliverable's last stage. Each open Trade gains a small meter: where its Trade P&L sits between its Stop and its Target, with what is banked and where it stood the session before. The meter replaces the Stop-to-Target slider on the Review card, sits under the P&L on the Open list and tops the Conditions card on Trade Detail, reading the same everywhere. The Open list is sorted in the Review's order (attention first), and the old range position is removed. The breakdown is [D09-trade-replay.md](D09-trade-replay.md):
- stage C is twelve tasks: T9.29, T9.30, T9.31, T9.32, T9.33, T9.34, T9.35, T9.40, T9.36, T9.37, T9.38, T9.39;
- agreed by the user on 2026-11-17 as **decision 117** (revision 106), with stage C's words W51 and W52 approved, and P132's answer: remove `rangePosition` now (T9.40);
- **amended for D9A-R by decision 118** (revision 107; D9A-R's breakdown, section 10). For stage C the amendments touch only T9.29 and T9.33 (section 3, "D9A-R's amendments");
- run **one task at a time** (decision 100), in the Progress section's order. No lanes, lane worktrees or merges. Pending questions follow **decision 113 as amended by decision 115**: one question at a time, the others queued.

Task status lives in the breakdown's Progress section (section 15).

Where things stand:
- **Stage B: closed 2026-11-20**, tagged `claude-opus-5.5-d9b`. Critic-b1 found one moderate defect (fixed, T9.28-B1) and one low (tech debt item 4); critic-b2 passed with no defects. Its report is `evidence/D09/stage-b-report.md`.
- **The last complete cumulative run** is `t9.28-b1` (`evidence/D09/suite-runs/t9.28-b1-*.txt`, on `dbf207c2`, full tier). It passed: unit 218 files, 2,544 tests; integration 136 files, 292 tests; browser-1 126 (5.1 min), browser-2 79 (4.9 min), browser-3 57 (4.2 min), browser-4 109 passed and 4 skipped (4.9 min); checks 14 of 14.
- **The acceptance script** fails only AC-REV-002 (`e2e/d9/meter-review.spec.ts`, stage C's file, which T9.38 writes).
- **No stage C code exists yet.** `StopTargetSlider` and `rangePosition` are as stage A and D9A-R left them; the Open list is still in Last Activity order.
- **Waiting on the user, not blocking stage C:** stage B's tech debt (`evidence/D09/tech-debt.md`, four items) and its new words, listed in the stage B report.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D09C-handoff.md and follow it."*
1. Take the session lock (`implementing.md`, "Start-of-deliverable reading").
2. Run the location checks in section 1.
3. Do the reading in section 2.
4. Print the run order (decision 113), then **start the next task at once** as soon as nothing blocks it. Don't stop to report that the reading is done.

Continue through the deliverable's gate (T9.39), the benchmark and the `claude-opus-5.5-d9` tag. Stop only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` (every task commits here directly; stage C has no lanes) |
| Ports | `5175`, from the gitignored `.env.local`; `4175` is the benchmark's, used only for the benchmark after the gate |
| Frozen plan | tag `claude-opus-5.5-plan-r108` (decision 119) |
| Code stage C builds on | `claude-opus-5.5-d9b` (`ff80c66f`) |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `ls .claude/session.lock` | Absent. If it exists, another session may be working here: stop and show the user its contents. |
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5`, possibly followed by `[ahead N]`. No uncommitted changes. |
| `git tag -l 'claude-opus-5.5-plan-r*' \| sort -V \| tail -1` | `claude-opus-5.5-plan-r108` at the first session. Afterwards, a later tag only for a revision approved in this stage. |
| `git merge-base --is-ancestor claude-opus-5.5-plan-r108 HEAD && echo ok` | `ok` |
| `git rev-parse --short 'claude-opus-5.5-d9b^{commit}'` | `ff80c66f` |
| `git diff --stat claude-opus-5.5-d9b HEAD -- src e2e tests tools bench package.json .claude/scripts .claude/agents` | Empty at the first session. Afterwards: only stage C's task commits. |
| `git log --oneline claude-opus-5.5-d9b..HEAD` | At the first session: only this handoff's commit and any tech debt or word decisions the user made (plan and evidence documents only). Afterwards also stage C's task commits, their evidence and Progress updates, handoff updates, and approved plan revisions. |
| `git tag -l 'claude-opus-5.5-d9'` | Empty until the benchmark passes after stage C's gate. |
| `ls .claude/worktrees 2>/dev/null` | Empty, absent, or only this implementation's old lane worktrees (D9's `d09-<lane>`, D9A-R's `d09ar-<lane>`). Stage C creates none. |
| `git rev-parse --git-path hooks` | `.githooks` (the pre-commit typecheck and lint hook) |
| `ocr llm test` | Prints `✓ Connection test successful`. If it fails on authentication, ask the user to run `ocr auth login`. If it reports the usage limit, wait as `.claude/agents/ocr-review.md` says. |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `lsof -nP -iTCP:5175 -iTCP:4175 -iTCP:9341 -iTCP:9342 -sTCP:LISTEN` | Nothing listening. |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run --project unit && npx vitest run tests/integration` | Every test passes: at stage B's close, unit 218 files, 2,544 tests; integration 136 files, 292 tests. |

Once every check matches, record the exact Node version and the two test counts in `evidence/D09/provenance.md`, as a new row for stage C.

If any check fails, **stop and ask the user**:
- Don't edit files, create branches or `cd` into another worktree to fix things.
- Don't change the machine's Node installation, and don't proceed on another Node version.

**Never look at any other worktree** under `worktrees/`, or another implementation's branch. The implementations are being compared, and reading another one contaminates the comparison. This includes other sessions' scratch, task-output and Playwright directories, and processes you did not start.
- **The old lane worktrees** under this worktree's `.claude/worktrees/` belong to this implementation, but stage C doesn't use them. Leave them alone.
- **Tags are shared** across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.
- **Hooks.** The PreToolUse hooks in `.claude/settings.json`, `filter-test-output.sh` and `guard-shell-writes.sh`, behave as in stage B. The guard blocks shell and inline-script writes to project files: change them with the Edit and Write tools.

## 2. Reading

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first, all of it, including "Pending decisions". Its "Running a swarm deliverable" section does not apply to stage C. Then, scoped (decision 45):

**The `specs/` baseline.** Read **`plan/spec-reading/D09.md`** as `implementing.md` says. Stage C leans on its entries for Daily Review's attention order, Trade Views' `browseTrades`, the valuation module, the UI contract and AC-REV-002, AC-PERF-001 and AC-UI-001. Search `plan/spec-map.md` (don't read it in full) when the work touches another section, and note it in `evidence/D09/structural.md`.

**The frozen plan (scoped):**
- **`plan/D09-trade-replay.md` in full.** Stage C's work is:
  - T9.29, T9.30, T9.31, T9.32, T9.33, T9.34 and T9.35 in section 5;
  - T9.40, T9.36, T9.37, T9.38 and T9.39 in section 6;
  - I9.10 and I9.11 in section 7.1; B9.8, B9.9, B9.10 and B9.11 in section 7.2;
  - flows C9.7, C9.8 and C9.9 in section 8;
  - P132 and P133, A260, A261, A262, A263 and A265, and the words W51 and W52;
  - section 4.2's stage C rows (marked C), which list the files each task changes; section 13's AC-REV-002, AC-PERF-001 and AC-UI-001 rows.
- **`plan/D09A-R-stage-a-refactor.md`**: section 10, "What D9's stage B and stage C must change" (its stage C paragraph); section 1.6's W57 (the meter's "Realized" form); section 15, Progress, for what D9A-R built. Not its behavioral task text.
- **`plan/D09A-R-decisions.md`**: decision 3 (the replay as an overlay), which T9.33 is re-read against.
- **`plan/implementation-plan.md`:** everything except the `## D10` through `## D28` definition sections. That covers decisions 1 to 119, the rules and cumulative obligations (including "Benchmark once, at the end (decision 114, from D9)"), the definitions through D9 and D9A-R, and the tech debt list.
- **`plan/acceptance-matrix.md`:** only the opening sections, and the rows of D9's section 13 stage C touches.
- **`plan/D07-approved-words.md`:** conventions C1 to C8, with the D8R note above them.
- **The design:** `prototypes/replay/trade-list.html` (the meter on the list and the cards). The prototype is a picture, not code to port: where it and the breakdown differ, the breakdown wins.
- **Evidence from stage B:** `evidence/D09/stage-b-report.md` and `evidence/D09/critic-b2.md` (its "Minor observations").

`specs/` and the frozen plan are read-only. A deviation, or a question the specs and plan leave to the user, is a pending decision (decision 113 as amended): ask in an ordinary message, one question at a time, queue any other in `evidence/D09/DECISIONS-PENDING.md`, and pause only the tasks it blocks. An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`. The next revision is r109, the next decision 120, and the breakdown's numbering continues at P154, A288 and W71. Editing the Progress section alone is not a revision.

## 3. Stage C specifics

### Evidence

Stage C's evidence goes under **`evidence/D09/`**, beside stages A and B (`tdd.sh` maps `T9.n` there, and `full-suite.sh` maps `evidence/D09` to `e2e/d9`). Add a heading "Stage C" in each file that has entries (`structural.md`, `tdd-log.md`, `new-words.md`, `words-changed.md`, `DECISIONS-PENDING.md`, `tech-debt.md`, `provenance.md`), and append below it. New at the gate: `stage-c-report.md` and the deliverable's final report (`implementing.md`, "Final report"). Name stage C's critics **`critic-c1.md`, `critic-c2.md`, `critic-c3.md`**, with the report header `# D09 critic-c<n> report`.

### Run order

T9.29, T9.30, T9.31, T9.32, T9.33, T9.34, T9.35, T9.40, T9.36, T9.37, T9.38, T9.39, one at a time on `claude-opus-5.5`, in the Progress section's order. T9.40 runs after T9.35 (after T9.33 removed the range position's only reader). Each task ends with its own complete cumulative run (decision 100). Then a full-tier run, the gate (T9.39), the benchmark, and the tag.

### D9A-R's amendments (its section 10, already in D9's breakdown)

- **T9.29 (the meter) and W51.** "Banked +$400.00" in the meter's name reads "Realized −$440.00" when what was realized is a loss, as everywhere else (D9A-R's W57). One case is added to T9.29 for it.
- **T9.33 (Review card: the meter replaces the slider).** Re-read against decision 3. "The slider" there is the Stop-to-Target slider in the card's header (`StopTargetSlider`), not the replay's. Its four cases stand. The card's body now holds a "Replay" button and no chart, so the meter is the only drawing on the card while the Action is written; and `e2e/d5r/review.spec.ts` is also changed by D9A-R's T9AR.20 (line 28, the summary), on different lines from T9.33's five.

### Other rules

- **The UI calculates nothing (ADR 0001).** The meter reading (A260) is one finished value from the valuation module: the two rails, `banked`, `now` (with `standing`'s zone and `pastBy`) and `previous`. Placing these on a track (break-even always on it, stretching by a third at most past a rail) is presentation (A215); working out a figure in `src/ui/` is a defect. Say this in the briefs for T9.29, T9.33, T9.34 and T9.35 and check it in each summary. Only `*.props.ts` adapters import view types.
- **One reading everywhere** (C9.7). The Review card, the Open-list row and the Conditions card read the same `meter` value; no screen builds its own.
- **The Open list's order** (A262). Trade Record still returns the Open book by Last Activity; Trade Views sorts that one page with `byAttention` after valuing it, as one named sort step, so later sorting and filtering can choose another (the user's condition, 2026-11-17). Planned and Closed keep their orders. A Trade that can't be replayed is first, in the Blocker band.
- **Attention moves, readers don't** (A261). `attentionOf`, `byAttention` and their types move from `src/coordinators/daily-review/attention.ts` to `src/coordinators/valuation/attention.ts`; Daily Review re-exports the types.
- **Removing the range position** (P132, T9.40). After T9.33, `rangePosition`, `RangePlacement`, `RangePositionResult` and `rangePositionOf` go, and the grep in T9.40's verification finds nothing. The fixture diff deletes exactly the 84 `rangePosition` entries (and the comma each leaves) in the eight `expected-views.json` files, and nothing else. Each D5R case that asserts the range position is re-pointed at the meter reading for the same Trades, or deleted where T9.30 or T9.31 already asserts the same fact; `structural.md` lists each one and which it was. The capability manifest changes variants only.
- **Query counts** (I9.11, AC-PERF-001). `browseTrades` and `open` each read one more date's observations than in stage A, and nothing per Trade (for `previous`); every other request list stays exact.
- **Words.** W51 and W52, with D9A-R's W57 for a loss realized. A price is a **Mark**, never a "close"; the end of a session is "the close".
  - **Words no row covers** are not a stop: use the wording you would have recommended, and record each phrase in `evidence/D09/new-words.md`, under "Stage C", with the task, the screen and the nearest approved row (P135).
  - **The wording rule (P137), into the brief of every task that puts words on screen (T9.29, T9.33, T9.34, T9.35), pasted word for word:**
    > Each task that puts words on screen judges whether they should be shorter, and shortens them when it thinks so. The user has approved this in advance. What a task may do: use fewer words for the same meaning; drop a label from the chart; move part of a sentence to the readout, the hover or the session cards. What it may not do: lengthen anything; change a figure or how it is worked out; take a figure off the page altogether (each stays in the readout or the session cards); or change what a planned case tests. When a planned case quotes words that are shortened, the case's quoted words change to match and nothing else in the case does. Every change is recorded with its before and after in `evidence/D09/words-changed.md`, by task, and listed in the stage's final report. Section 1.6 keeps the approved wording as the starting point.

    The main session copies each change from the task's summary into `evidence/D09/words-changed.md`, under "Stage C", by task.
- **What must not change.**
  - Every existing case keeps its expected values, except the D5R range-position cases T9.40 re-points or deletes, and the benchmark's expected Open rows T9.36 reorders. Any other changed expected value is a defect.
  - No frozen fixture view changes except T9.40's 84 deletions (A263).
  - The replay, its estimates and the overlay are untouched.
- **TDD discipline.** Run each case red, then green. Never write a test after its code, and back out code written before its red. A first-run pass gets the mutation check (an assertion failure or runtime exception, not a compile error) and is flagged in section 7's open questions. Pinned browser cases use `launchAt`, `pinClock` and `setClock` from `e2e/d4/support.ts`.
- **Browser access in subagents.** In stage B one task's subagent could not run the browser (its sandbox refused the build and the lock), which let three failing cases through to the task's run. Tell every UI task's subagent to run the browser specs that cover its screens under `.claude/scripts/with-browser-lock.sh` on port 5175, and to say so in its summary if it can't.
- **ocr reviews every commit in place**, test-only commits included.
- **Known flaky cases (P138).** Tech debt item 11's case (`TradeList.test.tsx`, the Ready state) and the `PositionChangeForm` focus case ("should move focus to the Record entry heading when the form finishes loading"); also stage B's B8.16 (`e2e/d8/responsive-a11y.spec.ts:299`, tech debt item 3), which flaked once. If one fails a run, have the runner rerun it alone once. A pass is logged as a flake, with the run, and the run continues; two failures in a row are a pending decision. Any other failing test is a failure: reproduce it with one targeted run and fix it in a fresh subagent. T9.34 changes `TradeList`, the Ready-state flake's file: if that case starts failing steadily, it is a failure, not a flake.
- **Tech debt.** Don't fix the tech debt list's items unasked (`evidence/D09/tech-debt.md`, `evidence/D09AR/tech-debt.md`).

### The gate (T9.39)

1. Run the full tier with `suite-runner` until it passes.
2. Run `.claude/scripts/acceptance-commands.sh plan/D09-trade-replay.md`. Every command must pass, AC-REV-002's included.
3. Brief a **fresh** `general-purpose` critic (effort medium) from `.claude/docs/critic-brief.md`, with:
   - flows C9.7, C9.8 and C9.9;
   - what D9's section 8 says the critic receives, and its future-capability list (Ribbon; spreads; Daily Bar candles; a moved Stop's marker; Deviation markers);
   - D9A-R's answered decisions, the standing tech debt items (`evidence/D09/tech-debt.md`, `evidence/D09AR/tech-debt.md`) and critic-b2's minor observations, named as known and not reported again unless stage C made them worse;
   - the 375 and 320 px checks;
   - port 5175 under the lock;
   - a fresh browser profile for every build (the app's service worker serves a profile's cached build, so a reused or copied profile shows stale code unless its `Default/Service Worker` folder is deleted);
   - its scratch in `test-results/critic-d09c-<n>/`;
   - no reading of `evidence/` or of another worktree.
4. Save each report as soon as the critic hands back, with `node tools/agent-report.ts "# D09 critic-c<n> report" > evidence/D09/critic-c<n>.md`. In stage B both critics' reports came back as the Agent call's result rather than as a hand-back message, so the script found nothing; the main session then took the text from the session transcript's task notification by the same method (from the heading to the end of the result), never retyping it. Copy its cost (tokens, tool calls, time, from the completion notice) to `structural.md`'s critic table.
5. **Critic rules.**
   - **High and moderate defects are fixed.** Each is first reproduced by a failing test, then fixed as a bug task (`T9.39-B<n>`) in a fresh `tdd-task`. After the last fix, one full run.
   - **Low defects go to `evidence/D09/tech-debt.md`**, not to tasks. A critic that finds only low defects closes the gate.
   - A fresh critic repeats every flow whenever any high or moderate defect was found.
   - At most three critics (P138). If the third still leaves a moderate defect, ask the user. A high defect or a FAIL always stops the run.
6. **The benchmark** (decision 114; A265; `implementation-plan.md`, "Benchmark once, at the end (decision 114, from D9)"). After the gate closes, with no development work left, run it once, alone, on port 4175, in this worktree, by that rule's steps. It re-proves AC-PERF-001 and the restored capacity checks. A failure is a pending decision, not a fix to make unasked.

## 4. What is in place

Build on these. Read the code before extending it. Paths are on `claude-opus-5.5-d9b`.

| Piece | Where | Notes for stage C |
|---|---|---|
| Valuation module | `src/coordinators/valuation/index.ts` | T9.30 adds `meterReadingOf` and receives `attention.ts` (A260, A261). |
| Attention | `src/coordinators/daily-review/attention.ts` (`attentionOf`, `byAttention`), tests `attention.test.ts`, `option-attention.test.ts` | Moves to the valuation module in T9.30; Daily Review re-exports the types. Also computes `rangePosition` today. |
| Daily Review | `src/coordinators/daily-review/daily-review.ts`, `types.ts`, `index.ts` | T9.31: each walked Trade's `meter`. `DailyReview.open`'s `RangePosition` variant becomes `Meter` (T9.40). |
| Trade Views | `src/coordinators/trade-views/index.ts` (`browseTrades`) | T9.32: the Open page in attention order, each item with `attention` and `meter` (A262). |
| Review card | `src/ui/screens/ReviewCard.tsx` (header `StopTargetSlider`; body holds the "Replay" button, no chart), `CardFigures.tsx` | T9.33: the meter replaces `StopTargetSlider` (`src/ui/screens/StopTargetSlider.tsx`). D9A-R's moderate tech debt item is in `CardFigures.tsx`. |
| Open list | `src/ui/screens/TradeList.tsx`; `review-attention.ts` | T9.34: the meter under the P&L, W52's line under "Open Trades". |
| Trade Detail rail | `src/ui/cockpit/rail/conditions.props.ts` and the Conditions card | T9.35: the meter at the top of the Conditions card. |
| Frozen fixtures | `tests/fixtures/{backup-v3-blocked,backup-v4-blocked,backup-v5-blocked,backup-v6-blocked,backup-v7,workspace-v5,workspace-v6,workspace-v7}/expected-views.json` | The eight files holding T9.40's 84 `rangePosition` entries. |
| D5R range cases | `tests/integration/d5r/range-and-baseline.test.ts`, `query-count.test.ts`, `save-marks.test.ts`, `shared-mark.test.ts`; the `src/ui/screens/Review*.test.tsx`, `CardMarks.test.tsx`, `held-review.test.ts` | Re-pointed or deleted in T9.40, each listed. |
| Benchmark | `bench/expected-open-rows.json`, `bench/dataset.json`, `bench/capacity-baseline.json`; `tools/bench-*.ts`; `npm run bench:*` | T9.36 regenerates the expected Open rows in the new order (`bench:expected`); the benchmark itself runs after the gate. |
| Suites | `tests/integration/d9/`; `e2e/d9/` (`support.ts`), `e2e/d9ar/` (`support.ts`) | T9.37 adds `meter.test.ts` and extends `query-count.test.ts`; T9.38 adds `meter-review.spec.ts`, `open-list.spec.ts`, `meter-detail.spec.ts`, `meter-a11y.spec.ts` to `e2e/d9/` (they join `browser-4`). |
| Tooling | `.claude/scripts/tdd.sh`, `full-suite.sh`, `run-complete.sh`, `acceptance-commands.sh`, `with-browser-lock.sh`, `status.sh`; `package.json` (`test:e2e:1`, `test:e2e:2`, `test:e2e:3`, `test:e2e:4`) | `browser-4` (T9.20-D2) runs `e2e/d9` and `e2e/d9ar`; 4.9 min at stage B's close. If a stage passes 8 minutes, ask (as SB-Q2 did). |

## 5. Working rules

- **Commits.**
  - Commit each finished task locally.
  - The main session's commits end with the Co-Authored-By line the session's system reminder gives.
  - Subagent briefs say "ending with the trailer your agent instructions specify".
  - **Never push** unless the user asks.
- **Who edits what.** The main session edits only plan, evidence and handoff documents. Every task, bug task and code change goes to a fresh `tdd-task`, working on `claude-opus-5.5` in this worktree, without `isolation`.
- **Runs (decision 111's tiers, for one task at a time).** One complete cumulative run after each task, with `browser-auto <base>`, where `<base>` is the commit in the task's Progress row; and the full tier before every critic. Tell the runner to check ports 9341, 9342 and 5175 inside the lock, to send exactly one report only when complete, to run each stage in its own foreground call, and to use a label without a trailing hyphen. Run `run-complete.sh evidence/D09 <label>` before recording any run. Don't commit while a run is in progress: in stage B a fix landed mid-run and the run had to be repeated.
- **ocr reviews.** Every implementation commit gets an `ocr-review`. Copy each output to `evidence/D09/ocr/<task>-<sha>.json`.
  - **Only ocr's own Valid or Doubtful *correctness* findings become bug tasks** (the user's rule, 2026-11-19). In stage B, ocr's test-strength findings (a test that would pass a real defect) were treated as correctness and fixed.
  - **A style-only finding goes to `evidence/D09/tech-debt.md`**, not to a task, Valid or not.
  - A Wrong finding is dismissed with its reason, checked against the cited lines.
  - A reviewer's or subagent's own note is recorded in `structural.md`, never made a bug task.
- **Tech debt (the user's rule, 2026-11-19).** Style-only ocr findings and low critic defects go to `evidence/D09/tech-debt.md`: source, kind and item, one row each. The list is reviewed with the user after the gate.
- **No "part 2".** Never send a task back for a second part on the strength of reviewer notes. A task is done when its planned cases pass and ocr's correctness findings are fixed.
- **Follow-on IDs.**
  - **B** is a bug task, for correctness (`T9.30-B1`).
  - **F** is a follow-on for maintainability (`T9.30-F1`).
  - **D** (`T9.30-D1`) is only for carrying out the user's answer to a pending decision.
- **Subagents.** General-purpose subagents run at medium effort. Don't resume an old subagent. Stop one that keeps resending its hand-back.
- **Git.** Never use bare `git stash`. Don't `git add evidence/D09` as a whole; add the files you mean.
- **Refer to sections in words**, never with the section sign. List each task ID ("T9.29, T9.30, T9.31"), never a range.
- **Asking.** Plain language first, then the context, the options with their tradeoffs, and a recommendation. One question per message; queue the rest (decision 113 as amended).
- **After each task:** update the Progress row and section 7 of this note, commit, and start the next task.

### Running a whole deliverable

Stop all work and ask the user **only** when:
1. the session lock exists, or a location check in section 1 fails;
2. nothing unblocked remains while a pending decision waits;
3. a fresh critic or a browser can't be provided, or three critics at the gate still leave a FAIL or a high defect (a moderate defect left by the third critic is asked about, section 3, "The gate").

These are pending decisions, asked one at a time while any unblocked task keeps going (decision 113 as amended):
- the work needs a deviation from `specs/` or the frozen plan, or exposes an ambiguity: a breakdown passage the built code can't meet, a query-count proof that can't keep its request list, or a changed frozen view beyond T9.40's 84 deletions;
- a suite failure, critic defect or ocr bug-task fix can't be fixed without such a deviation, or a third ocr round on one task still leaves correctness findings;
- a known flaky case fails twice in a row (P138);
- `acceptance-commands.sh` can't pass every command without a revision;
- the benchmark fails.

Not pending decisions: a screen text no approved word covers (P135), a text a task shortens under P137, and a style-only or low item sent to tech debt. Each is recorded and reported.

Everything else continues without the user. Make implementation-level decisions with the recommendation you would have offered, and record them. Reproduce and fix suite failures in fresh subagents. Log first-run passes.

### When the gate closes

1. Run the benchmark (section 3, "The gate", step 6).
2. Mark D9's section 13 rows covered where the deliverable completes every task they list (AC-REV-002, AC-PERF-001, AC-UI-001 and AC-UI-002, and any other row left planned), and tag **`claude-opus-5.5-d9`** locally.
3. Write `evidence/D09/stage-c-report.md` (in stage B's report's form) and the deliverable's final report as `implementing.md`, "Final report", says: tasks and commits, each task's fix rounds, flaky tests with the run they flaked in, decisions (answered and pending), critics with their cost, the benchmark's result, the tech debt list, the new words awaiting approval (stages A, B and C), every text shortened under P137, and the wall-clock time against the breakdown's estimate (section 3).
4. Remove `.claude/session.lock`. Never push.

The main session saves the reports itself (`implementing.md`, "Final report"). A subagent that drafts one returns it as text.

## 6. Out of scope

- **Refining the estimated odds with volatility** (D9's section 10 follow-on; D9A-R's decision 4): a new task for the user to commission.
- **The breakdown's other follow-ons** (D9's section 10): Ribbon, spreads, Daily Bar candles, Deviation and revision markers, sorting and filtering on the Trades list (A262 leaves room for them).
- **Stage B's critic-b2 minor observations** (the small chart's missing scale, the share equivalent's reason, hover): for the user, not tasks, unless the user makes them one.
- A second browser port, and the tech debt items.
- **Editing `specs/` or the frozen plan** without an approved revision.
- **Pushing.**

## 7. D9 stage C progress

### Notes for later tasks

- For T9.33: the card's body now holds a "Replay" button and no chart; `e2e/d5r/review.spec.ts` line 28 was changed by T9AR.20, on different lines from T9.33's five.
- For T9.29: "Banked +$400.00" in the meter's name reads "Realized −$440.00" when what was realized is a loss (D9A-R's W57); one case is added for it.
- For T9.33, T9.40: stages A and B and D9A-R leave `StopTargetSlider` and `rangePosition` exactly as they are.
- For T9.33, T9.34, T9.35, T9.38: stage B's session cards and readout rows assert exact row lists in `e2e/d9/gaps.spec.ts` and `replay.spec.ts` (T9.25-B2); stage C adds nothing to the replay, so those lists should not change. If a stage C task changes one, that is a defect.
- For T9.38: `meter-review.spec.ts` is AC-REV-002's command; the acceptance script fails on it until T9.38 writes it.

### Open questions

- Stage B's tech debt (`evidence/D09/tech-debt.md`, items 1, 2, 3 and 4) and new words (`evidence/D09/new-words.md`, "Stage B") await the user's review; stage A's and D9A-R's words and P137 changes too. None blocks stage C.
