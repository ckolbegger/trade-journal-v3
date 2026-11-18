# Handoff: `claude-opus-5.5`, implement D9, stage A (the replay chart)

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, stage A's specifics, the swarm procedure and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-11-17, with plan revision 106. [D09-drafting-handoff.md](D09-drafting-handoff.md) and `research/replay-requirements.md` are the record of the interview, the prototypes and the planning that led to the breakdown.

This session **implements stage A of D9, "Trade replay"**, under the frozen plan at revision 106. Stage A builds the replay chart: the Underlying's price over the Trade's P&L, drawn between what the Trade would make at its Stop and at its Target, with a slider that steps back through the sessions. It goes in a new Replay drawer on Trade Detail and in the Review card before the Action. The breakdown is [D09-trade-replay.md](D09-trade-replay.md):
- 40 tasks in three stages; **this session runs stage A only**: T9.1, T9.2, T9.3, T9.4, T9.5, T9.6, T9.7, T9.8, T9.9, T9.10, T9.11, T9.12, T9.13, T9.14, T9.15, T9.16, T9.17, T9.18, T9.19;
- agreed by the user on 2026-11-17 as **decision 117**, with P118–P138, its ten answered questions (section 12) and the words W35–W52 approved (W1 amended);
- stage A runs as a **swarm** under **decision 111**, with an agent cap of 4, and pending questions under **decision 113 as amended by decision 115**: one question at a time, the others queued;
- stages B (the option estimates) and C (the meter) each get their own session and handoff, and run one task at a time.

Task status lives in the breakdown's Progress section. Stage A's rows have Wave and Lane columns.

Where things stand:
- **D8R: complete, tagged `claude-opus-5.5-d8r` (`85a7630e`).** Stage A builds on that tree.
- **The last complete cumulative run** is D8R's `gate-full1` (`evidence/D08R/suite-runs/`). It passed: unit 2111 tests; integration 269 tests; browser 126 in `browser-1` and 136 in `browser-2`; checks 14 of 14. `browser-2` took 8.9 minutes, which is why T9.1 comes first.
- **Revision 106 changed `specs/`** in seven files. Stage A builds on two of the changes: `evaluate` returns the Trade's result at each boundary and its standing (`specs/design/trade-analysis.md`, "`evaluate`"), and `DailyReview.getTrade` returns the replay, which `specs/design/daily-review.md` already said. The rest (ADR 0007's Estimates, AC-CALC-005, the Open list's default order) belong to stages B and C. No code implements any of it yet.
- **No product code, test or tooling changed after the D8R gate.** Revision 106 changed only `plan/` and `specs/`.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D09-handoff.md and follow it."*
1. Take the session lock (`implementing.md`, "Start-of-deliverable reading").
2. Run the location checks in section 1.
3. Do the reading in section 2.
4. Print the run order (decision 113), then **start the next task(s) at once**, as section 3 orders them. Don't stop to report that the reading is done.

Continue through stage A's gate (T9.19) and the `claude-opus-5.5-d9a` tag. Stop only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` (the deliverable branch every lane merges into) |
| Ports | `5175`, from the gitignored `.env.local`; `4175` is the benchmark's, and stage A runs no benchmark (A265) |
| Frozen plan | tag `claude-opus-5.5-plan-r106` (decision 117) |
| Code stage A builds on | `claude-opus-5.5-d8r` (`85a7630e`) |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `ls .claude/session.lock` | Absent. If it exists, another session may be working here: stop and show the user its contents. |
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5`, possibly followed by `[ahead N]`. No uncommitted changes. |
| `git log --oneline claude-opus-5.5-plan-r106..HEAD` | Empty at the first session. Afterwards: only D9 task and merge commits, their evidence and Progress updates, handoff updates, and approved plan revisions. |
| `git rev-parse --short 'claude-opus-5.5-d8r^{commit}'` | `85a7630e` |
| `git diff --stat claude-opus-5.5-d8r claude-opus-5.5-plan-r106 -- src e2e tests tools .claude package.json` | Empty. |
| `ls .claude/worktrees 2>/dev/null` | Empty or absent at the first session. Afterwards, only this deliverable's lane worktrees. |
| `git rev-parse --git-path hooks` | `.githooks` (the pre-commit typecheck and lint hook; the setup commands are at the top of `.githooks/pre-commit`) |
| `ocr llm test` | Prints `✓ Connection test successful`. If it fails on authentication, ask the user to run `ocr auth login`. If it reports the usage limit, wait as `.claude/agents/ocr-review.md` says. |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `lsof -nP -iTCP:5175 -iTCP:9341 -iTCP:9342 -sTCP:LISTEN` | Nothing listening. |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run src && npx vitest run tests/integration` | Every test passes. Record the file and test counts in `evidence/D09/provenance.md`. |

Record the exact Node version in `evidence/D09/provenance.md`.

If any check fails, **stop and ask the user**:
- Don't edit files, create branches or `cd` into another worktree to fix things.
- Don't change the machine's Node installation, and don't proceed on another Node version.

**Never look at any other worktree** under `worktrees/`, or another implementation's branch. The implementations are being compared, and reading another one contaminates the comparison. This includes other sessions' scratch, task-output and Playwright directories, and processes you did not start.
- **The lane worktrees are different.** Stage A's lane worktrees, under this worktree's `.claude/worktrees/d09-<lane>`, belong to this implementation. Never confuse the two.
- **Tags are shared** across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.
- **Hooks.** The PreToolUse hooks in `.claude/settings.json`, `filter-test-output.sh` and `guard-shell-writes.sh`, behave as in D8R. The guard blocks shell and inline-script writes to project files: change them with the Edit and Write tools.

## 2. Reading

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first, all of it, including "Running a swarm deliverable" and "Pending decisions". Then, scoped:

**The `specs/` baseline.** Read **`plan/spec-reading/D09.md`** as `implementing.md` says (132 entries, about 70K tokens; regenerated by revision 106 with D9's own tags). Search `plan/spec-map.md` (don't read it in full) when the work touches another section, and note it in `evidence/D09/structural.md`.

**The frozen plan (scoped):**
- **`plan/D09-trade-replay.md` in full**, which is the work. Its section 1.3 (assumptions A247–A265), section 1.5 (the Texts, Shapes, Checks and Names lookups), section 1.6 (the words) and section 5's test Trades are what each task's brief cites.
- **`plan/implementation-plan.md`:** everything except the `## D10` through `## D28` definition sections. That covers decisions 1–117 (100 as amended by 111, 113 as amended by 115), the rules and cumulative obligations, the freeze record, the definitions through D9, and the tech debt list (items 3 and 28 are named in the breakdown's section 11).
- **`plan/acceptance-matrix.md`:** only the opening sections, and the rows the breakdown's section 13 names.
- **`plan/D07-approved-words.md`:** conventions C1–C8, with the D8R note above them (contract names).
- **`plan/D08P-trade-detail-cockpit.md`**, whose replay slice stage A extends: its status notes; in section 1.3, A210, A211, A212, A213, A215 and A216; section 5's O-C3 data; section 9 (the swarm process). Not its other behavioral task text.
- **`plan/D08R-trade-detail-refactor.md`:** its status notes; in section 1.3, A230 and A240 (the trigger distance and the drawer request); section 1.6's W1. Not its behavioral task text.
- **The design:**
  - `prototypes/replay/round-2.html`, the **Corridor** tab. Open it with Playwright from the file; no server is needed. Look at it at 1280, 375 and 320 px before briefing any chart task.
  - `research/replay-requirements.md`: "Decisions from the interview", and all of "Round 2".
  - `prototypes/replay/checks/verify.js`, which states what each per-session figure must equal, and loads the model block that holds every session of the test Trades (`buildSeries(trade, 'bull' or 'bear').rows`).
  - The prototype is a picture, not code to port and not a specification: where it and the breakdown differ, the breakdown wins (for example P124, the expiration session).

`specs/` and the frozen plan are read-only. A deviation, or a question the specs and plan leave to the user, is a pending decision (decision 113 as amended): ask in an ordinary message, one question at a time, queue any other in `evidence/D09/DECISIONS-PENDING.md`, pause only the tasks it blocks, and keep the other lanes going. An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`. The next revision is r107, the next decision 118, and the breakdown's numbering continues at P139, A266 and W53. Editing the Progress section alone is not a revision.

## 3. Stage A specifics

### Setup before wave 0

Create `evidence/D09/` with:
- `tdd-log.md`, with the note that its rows are single-case runs; `tdd.sh` writes each task's rows to `evidence/D09/tdd-log/<task>.md`;
- `structural.md`, `provenance.md`, `DECISIONS-PENDING.md`, `new-words.md` (words used provisionally) and `words-changed.md` (P137).

### Lane worktrees, by hand

The Agent tool's `isolation: "worktree"` roots a lane at the main checkout on `main`, so it can't be used (D8R's finding). For each lane task:
1. `git worktree add .claude/worktrees/d09-<lane> -b d09/<lane> claude-opus-5.5` (or reset the lane's branch to the deliverable branch's head for the lane's next task);
2. brief a fresh `tdd-task` **without** `isolation`, whose brief names that worktree as its working directory and starts with `.claude/scripts/lane-setup.sh`.

### Wave 0

T9.1 and T9.2 run **at once**, in lanes TL and TY. Their files are disjoint (breakdown section 4.2). Merge each as it becomes mergeable, then run one complete cumulative run before wave 1; it is the first run with three browser stages.

- **T9.1** adds `test:e2e:3` for `e2e/d8p` and `e2e/d8` (the pattern also matches `e2e/d8r`), and the `browser-3` stage in every file section 1.5's Names list gives. `e2e/d9` joins `test:e2e:3` later, in T9.18, with its first spec: Playwright fails on a folder with no tests. After T9.1, a full tier is three foreground browser calls, and `run-complete.sh` expects six stage files.
- **T9.2 is types only**: additive, optional fields, no behavior, so lanes CF and CP can write doubles before lane TA finishes.

### Wave 1

Lanes **TA** (T9.3, T9.4, T9.5), **CF** (T9.9, T9.10, T9.11) and **CP** (T9.12, T9.13) run at once, each in its listed order. A lane's next task starts once its previous task has merged.

- **TA is the critical path.** Everything in wave 2 waits for T9.5.
- **CF and CP test against doubles** built from T9.2's types. CP's `CorridorPlot` and CF's `ReplayFrame` meet through `ReplayPlotProps` (A255), which T9.2 freezes; neither lane edits the other's files.
- **T9.4 changes how `replay` calls `evaluate`:** it must pass the Underlying's frame, which `tradePnlOf` (`replay-series.ts:108`) leaves out today.

### Wave 2

1. Lane **RV**: T9.6, then T9.7, then T9.8, starting when T9.5 has merged. T9.6's first step moves the replay assembly to `src/coordinators/replay/` with the existing cases passing unchanged; that move is its refactor step, not a case.
2. **T9.14** (lane DW) starts when T9.6, T9.11 and T9.13 have merged. **T9.15** (lane RW) starts when T9.7, T9.11 and T9.13 have merged. They run at once.
3. **T9.16** (lane DW) runs last, after T9.14 and T9.15 have merged. It is the only wave-2 task that touches both `Cockpit.tsx` and `ReviewView.tsx`.

### Wave 3

1. **T9.17**, the Node suite, may start once T9.8 has merged.
2. **T9.18**, the browser suite, after T9.16. It adds `e2e/d9` to `test:e2e:3`.
3. A full-tier run, then **the stage gate, T9.19**.

### Merging and merge runs

- **Each task** gets its lane worktree at the deliverable branch's head at dispatch. Before the brief, mark the task's Progress row "In progress from `<head>`".
- **Mergeable** means its ocr review and bug tasks are clean, and its lane tier passed (`full-suite.sh evidence/D09 <task> lane`, in its worktree, recorded in `suite-runs/`). Then rebase its branch onto `claude-opus-5.5` and fast-forward. If the rebase changed a file the task doesn't own, rerun its lane tier first. Mark the row "Done" with the **rebased** hashes.
- **Merge runs.** When no merge is pending, and at least one task has merged since the last run, send `suite-runner` the complete cumulative run on `claude-opus-5.5`, with `browser-auto <last merge run's commit>`. Record it in `structural.md`. Pin a failure to a merged task with one targeted run, and fix it in a fresh `tdd-task` from the current head, failing test first. Lanes keep working during merge runs.
- At most **four `tdd-task` agents at once**. `ocr-review` agents don't count against the cap.

### Other rules

- **The UI calculates nothing (ADR 0001).** Every dollar figure, share and status comes from Trade Analysis or a coordinator as a finished value. `replay.props.ts` selects and formats. Turning a finished figure into an SVG coordinate is drawing (A256); working out a figure in `src/ui/` is a defect. No lint rule can see arithmetic, so say this in the briefs for T9.9, T9.12 and T9.13 and check it in each summary. Code under `src/ui/cockpit/` takes plain props, and only `*.props.ts` adapters import view types (A216's lint rule).
- **Nothing later shows early** (T9.10). A session after the slider's is not in the DOM: no figure, date label or point. Axes are sized from the Plan's anchors and the revealed sessions only (A256).
- **A gap stays a gap** (AC-MARK-004). A session without a Mark breaks the line and the area, reads "No Mark" in the table, and keeps its two results (A248). Nothing is carried or joined across it.
- **Words.** Screens use the breakdown's section 1.6, W35–W46, with W1 as amended. A price is a **Mark**, never a "close"; the end of a session is "the close".
  - **Words no row covers** are not a stop: use the wording you would have recommended, and record each phrase in `evidence/D09/new-words.md`, with the task, the screen and the nearest approved row. The stage report lists them for the user's approval (P135).
  - **The wording rule (P137), into every brief for T9.9, T9.10, T9.11, T9.12, T9.13, T9.14, T9.15 and T9.16, word for word:** "Judge whether the words this task puts on screen should be shorter, and err toward too concise. You may use fewer words for the same meaning, drop a label from the chart, or move part of a sentence to the readout, the hover or the table. You may not lengthen anything, change a figure or how it is worked out, take a figure off the page altogether, or change what a planned case tests. If you shorten words that a planned case quotes, change only the case's quoted words. List every change in your summary with its before and after." The main session copies each one into `evidence/D09/words-changed.md`, by task.
- **Lane briefs carry the lane rules:** the worktree to work in; start with `lane-setup.sh`; run only the lane tier, never a complete run; browser tests through `.claude/scripts/with-browser-lock.sh`, and only the spec files the task changes; red and green rows to `evidence/D09/tdd-log/<task>.md`; commit on the lane branch only; the main session rebases and merges. Each brief also names the lane's owned files from section 4.2, and says that a need for any other file is a stop-and-report.
- **What must not change.**
  - Every existing case keeps its expected values, except where section 1.5's Texts table names the case and the task. In stage A that is only the drawer lists (T9.14). Everywhere else, a changed expected value is a defect.
  - Every existing query-count proof keeps its exact request lists. I9.6 adds `getTrade`'s series reads.
  - No frozen fixture view changes in stage A. Every new view field is additive (A263).
  - `StopTargetSlider`, `rangePosition` and the Open list's order are stage C's. Stage A leaves them alone.
- **TDD discipline, clock pinning, mutation builds, and ocr on test-only commits:** as in D8R.
  - Run each case red, then green. Never write a test after its code, and back out code written before its red.
  - A first-run pass gets the mutation check (an assertion failure or runtime exception, not a compile error) and is listed under section 7's open questions.
  - Pinned browser cases use `launchAt`, `pinClock` and `setClock` from `e2e/d4/support.ts`.
  - Test-only commits are relocated under `src/itg/d09/` for `ocr-review`.
- **Tech debt.** Item 28 is not fixed here; the replay follows `evaluate` (breakdown section 11). Don't fix other items unasked.
- **Flaky tests (P138 (2), decision 117 (9)).** Two cases are known to flake: tech debt item 11's (`TradeList.test.tsx`, the Ready state) and the `PositionChangeForm` focus case ("should move focus to the Record entry heading when the form finishes loading"). If either fails a run, have the runner rerun it alone once. A pass is logged as a flake, with the run, and the run continues; two failures in a row are a pending decision. Any other failing test is a failure: reproduce it with one targeted run and fix it in a fresh subagent.
- **The critic limit (P138 (1), decision 117 (9)).** At most three critics at the gate. If the third still leaves defects and none is high and none is a FAIL, close the gate: record each remaining defect as a new tech debt item in `plan/implementation-plan.md` (a plan edit the user approved in advance, made in the gate's evidence commit) and list them in the stage report. A remaining high defect or a FAIL stops the run. This replaces `.claude/docs/critic-brief.md`'s cap for D9.
- **No benchmark in stage A** (A265, decision 114). It runs once, after stage C.
- **The stage gate (T9.19).**
  1. Run the full tier with `suite-runner` until it passes.
  2. Run `.claude/scripts/acceptance-commands.sh plan/D09-trade-replay.md`. Seven of its nine commands must pass. The two that name later stages' files fail by design until those stages land: AC-CALC-005 (`d9/estimates`) and AC-REV-002 (`e2e/d9/meter-review.spec.ts`). Any other failure is a defect.
  3. Brief a **fresh** `general-purpose` critic (effort medium) from `.claude/docs/critic-brief.md`, with flows C9.1, C9.2, C9.3 and C9.4, the future-capability list in breakdown section 8 (which names the estimates and the meter as not defects in stage A), the 375 and 320 px checks, port 5175 under the lock, and no reading of `evidence/` or another worktree.
  4. Reports go to `test-results/critic-d09-<n>/report.md`. Copy each to `evidence/D09/critic-<n>.md`.
  5. Each critic defect is first reproduced by a failing test, then fixed as a bug task, then a fresh critic repeats all four flows, up to three critics (the critic limit above).
  6. When the gate passes, mark the stage A rows of section 13 covered where stage A completes them, and tag `claude-opus-5.5-d9a`.

## 4. What is in place

Build on these. Read the code before extending it. Line numbers are on `85a7630e`.

| Piece | Where | Notes for stage A |
|---|---|---|
| The replay slice | `src/domain/trade-analysis/replay-series.ts`: `replay` :56, `tradePnlOf` :108, `ReplayedSession` | Lane TA. One `derive` and one `evaluate` per session. |
| Evaluation | `src/domain/trade-analysis/evaluate.ts`: `TradeEvaluation` from :116, `evaluate` from :214 (`conditionOf`, `optionReadingOf`, `headlineOf`, the worst case and max reward); `plan.ts`: `measurementOf` :47, `PlanBaseline` :53, `headlineBasisOf` :138 | T9.3. The results at the Stop and the Target use the headline basis and need no Mark (A248). |
| Replay views | `src/coordinators/trade-views/replay-view.ts` (the view types), `replay-trade.ts` (`replaySessions`, `placeJournal`, `replayView`), `trade-views.ts` `replayTrade` :893 | Lane RV. The helpers move to `src/coordinators/replay/`. |
| The Review's card read | `src/coordinators/daily-review/daily-review.ts` `getTrade`; `types.ts` `DailyTradeReview` :266 | T9.7. |
| Shared valuation | `src/coordinators/valuation/` (`value-trade.ts`, `dated-line.ts`) | The model for a module both coordinators import. |
| Series | Market Data's read session `series` and `previousSessionDate` (`src/modules/market-data/market-data.ts`) | Unchanged. |
| Cockpit shell | `src/ui/screens/trade-detail/Cockpit.tsx`: `drawersOf` :27; `drawer-request.ts`: `DRAWERS` :3, `useDrawerRequest` | T9.14 adds Replay; T9.16 uses the drawer request for audit navigation. |
| Cockpit parts | `src/ui/cockpit/` (`drawers/`, `rail/`, `track.tsx`, `styles/`); `eslint.cockpit.config.js` | The chart lives in `src/ui/cockpit/replay/`. |
| Review card | `src/ui/screens/ReviewCard.tsx` (the Action form; the slider at :124 is stage C's), `ReviewView.tsx` (`linkedCard` :205) | T9.15, T9.16. |
| Manifest | `src/coordinators/workspace/capabilities.ts` (`replayTrade` :89, `getTrade` :104); `src/app/routes.ts` | T9.8. |
| Suite tooling | `package.json` (the `test:e2e` scripts), `.claude/scripts/full-suite.sh` (maps `evidence/D09` to `e2e/d9`), `tdd.sh`, `lane-setup.sh`, `with-browser-lock.sh`, `run-complete.sh`, `acceptance-commands.sh` | T9.1. |

## 5. Working rules

- **Commits.**
  - Commit each finished task locally.
  - The main session's commits end with the attribution lines from the session's system reminder.
  - Subagent briefs say "ending with the trailer your agent instructions specify".
  - **Never push** unless the user asks.
- **Who edits what.** The main session edits only plan, evidence and handoff documents, and does the merging. Every task, bug task and code change goes to a fresh `tdd-task`.
- **Runs.** Lane tiers per task, one complete run per merge batch, and the full tier before every critic (decision 111). Tell the runner to check ports 9341, 9342 and 5175 inside the lock, to send exactly one report only when complete, to run each stage in its own foreground call, and to use a label without a trailing hyphen.
- **ocr reviews.** Every implementation commit gets an `ocr-review`. Only findings ocr itself raises become bug tasks, which run in the same lane. Copy each output to `evidence/D09/ocr/<task>-<sha>.json`.
- **Subagents.** General-purpose subagents run at medium effort. Don't resume an old subagent. Stop one that keeps resending its hand-back.
- **Git.** Never use bare `git stash`. Don't `git add evidence/D09` as a whole; add the files you mean.
- **Refer to sections in words**, never with the "§" sign. List each task ID ("T9.3, T9.4, T9.5"), never a range.
- **Asking.** Plain language first, then the context, the options with their tradeoffs, and a recommendation. One question per message; queue the rest (decision 113 as amended).
- **After each merge:** update the Progress row and section 7 of this note, commit, and keep the lanes full.

### Running a whole deliverable

Stop all work and ask the user **only** when:
1. the session lock exists, or a location check in section 1 fails;
2. nothing unblocked remains while a pending decision waits;
3. a fresh critic or a browser can't be provided, or three critics at the gate still leave a FAIL or a high defect (moderate and lower become tech debt, P138);
4. a merge conflict falls in a file two lanes both own, which section 4.2 says can't happen.

These are pending decisions, asked one at a time while the unblocked lanes keep working (decision 113 as amended):
- the work needs a deviation from `specs/` or the frozen plan, or exposes an ambiguity: a breakdown passage the built code can't meet, a query-count proof that can't keep its request list, or a changed frozen view;
- a suite failure, critic defect or ocr bug-task fix can't be fixed without such a deviation, or a third ocr round on one task still leaves findings;
- a known flaky case fails twice in a row (P138);
- `acceptance-commands.sh` can't pass stage A's seven commands without a revision.

Not pending decisions: a screen text no approved word covers (P135), and a text a task shortens under P137. Both are recorded and reported.

Everything else continues without the user. Make implementation-level decisions with the recommendation you would have offered, and record them. Reproduce and fix suite failures in fresh subagents. Log first-run passes.

When the gate passes:
1. tag `claude-opus-5.5-d9a` locally;
2. write `evidence/D09/stage-a-report.md`, with tasks and commits, each task's fix rounds, flaky tests with the run they flaked in, decisions (answered and pending), critics, any defects moved to tech debt, the new words awaiting approval, every text shortened under P137 with its before and after, and the wall-clock time against the breakdown's estimate (section 3);
3. write stage B's handoff, `plan/D09B-handoff.md`, in this note's form, for T9.20, T9.21, T9.22, T9.23, T9.24, T9.25, T9.26, T9.27 and T9.28, run one task at a time (decision 100), carrying the "Starting a session" paragraph, these stop conditions, and the notes below that name stage B's tasks;
4. remove `.claude/session.lock`. Never push.

## 6. Out of scope

- **Stage B** (the estimates: T9.20, T9.21, T9.22, T9.23, T9.24, T9.25, T9.26, T9.27, T9.28) and **stage C** (the meter and the Open list's order: T9.29, T9.30, T9.31, T9.32, T9.33, T9.34, T9.35, T9.40, T9.36, T9.37, T9.38, T9.39).
- **The breakdown's follow-ons** (section 10): Ribbon, spreads, Daily Bar candles, Deviation and revision markers, sorting and filtering on the Trades list.
- **A second browser port**, upgrade tests (decision 76, tech debt item 10), and the tech debt items.
- **Editing `specs/` or the frozen plan** without an approved revision.
- **Pushing.**

## 7. D9 progress

Task status and commits are in the breakdown's Progress section. This section holds two lists, one bullet per entry.

### Notes for later tasks

- For T9.4: `tradePnlOf` builds a frame for the held Instrument only. Each session's `evaluate` call now needs the Underlying's frame too, or an option Trade's Underlying condition reads as Mark missing on every session (A250).
- For T9.6, T9.9: the view's Plan column is `TradeReplayView.planColumn` (T9.2), since `plan` already holds the pre-exposure Journal items. The domain result's field is `plan`.
- For T9.6, T9.8: T9.2 added no re-exports of the new type names (`ReplayFigures`, `ReplayMarker`, `ReplayFinal`, `ReplayPlanColumn`, `TradeOutcomes`, `TradeStandingReading`) to `trade-analysis/index.ts`, `trade-views/index.ts` or `src/app/types.ts`. Add them where an adapter needs them.
- For T9.7: before the brief, read how `daily-review.ts` builds the card a Save Marks result returns. A254 assumes it is the function `getTrade` uses, so the card carries the replay with no further read. If it is built another way, that is a pending decision, not something to work around.
- For T9.12, T9.13: the test Trades' full series are in the model block of `prototypes/replay/round-2.html`; section 5's table names only the sessions the cases use.
- For T9.14: Replay is the second drawer, after Today. Every drawer list in section 1.5's Texts table changes in this task and nowhere else.
- For T9.18: add `e2e/d9` to `test:e2e:3` in the same commit as the first spec.
- For T9.19: two of `acceptance-commands.sh`'s nine commands fail by design at stage A (section 3, "The stage gate").
- For T9.23 (stage B): `replay-series.ts` is lane TA's in stage A. Stage B adds `estimates` to the same session shape; keep `figures` free of any number type.
- For T9.33, T9.40 (stage C): stage A leaves `StopTargetSlider` and `rangePosition` exactly as they are.

### Open questions

- Session 1 (2026-11-17): the main session read the D9-specific ranges of `plan/spec-reading/D09.md` (Trade Analysis, Daily Review, the UI contract), not all 132 entries; each brief names the spec ranges its task needs. Recorded in `evidence/D09/structural.md`, "Session reading".
- Session 1: T9.1 and T9.2 were dispatched after the breakdown was read and before the rest of the reading, since neither needs it.
