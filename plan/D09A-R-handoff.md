# Handoff: `claude-opus-5.5`, implement D9A-R (D9 Stage A Refactor)

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, D9A-R's specifics, the swarm procedure and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-11-18, when D9's stage A closed (`evidence/D09/stage-a-report.md`). The breakdown was agreed the same day as plan decision 118, revision 107.

This session **implements D9A-R, "D9 Stage A Refactor"**. It reworks the replay stage A built, from the coach review (`evidence/D09/coach-review-1.md`) and the user's eight decisions (`plan/D09A-R-decisions.md`): the replay opens as an overlay of the whole page, from Trade Detail and from a "Replay" button on the Review card; the readout's stake becomes a grid; reward to risk carries the estimated odds; the Plan stands beside what happened; session cards replace the wide table; the chart gets a key, dates and a label on every line; one name per figure. The breakdown is [D09A-R-stage-a-refactor.md](D09A-R-stage-a-refactor.md):
- 24 tasks: T9AR.1, T9AR.2, T9AR.3, T9AR.4, T9AR.5, T9AR.6, T9AR.7, T9AR.8, T9AR.9, T9AR.10, T9AR.11, T9AR.12, T9AR.13, T9AR.14, T9AR.15, T9AR.16, T9AR.17, T9AR.18, T9AR.19, T9AR.20, T9AR.21, T9AR.22, T9AR.23, T9AR.24;
- agreed by the user on 2026-11-18 as **decision 118**, with P139 to P153, its five answered questions (section 12) and the words W53 to W70 approved (W55 with the user's "P&L if hit");
- run as a **swarm** under **decision 111**, with an agent cap of 4 (P140), and pending questions under **decision 113 as amended by decision 115**: one question at a time, the others queued;
- it runs between D9's stage A (closed) and D9's stage B. Stage B's tasks were amended for D9A-R (the breakdown's section 10), so stage B's handoff is written when this gate closes.

Task status lives in the breakdown's Progress section (section 15), with Wave and Lane columns.

Where things stand:
- **D9's stage A: closed 2026-11-18 by the user's decision**, tagged `claude-opus-5.5-d9a`. Critic-2's four defects were not fixed; they are carried into this deliverable (section 1.8 of the breakdown, and "Critic-2's carried defects" below).
- **The last complete cumulative run** is D9's `T9.19-gate` (`evidence/D09/suite-runs/`, on `2b9497c7`). It passed: unit 198 files, 2,289 tests; integration 130 files, 280 tests; browser 126 in `browser-1` (5.2 min), 79 in `browser-2` (4.9 min), 77 in `browser-3` (5.1 min); checks 14 of 14.
- **Revision 107 changed `specs/`**: the glossary ("No-Edge Odds" and six compact labels), two Trade Analysis sentences, one Trade Views clause, and the UI contract's note on warnings under a read-only overlay (the breakdown's section 1.2). No code implements any of it yet.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D09A-R-handoff.md and follow it."*
1. Take the session lock (`implementing.md`, "Start-of-deliverable reading").
2. Run the location checks in section 1.
3. Do the reading in section 2.
4. Print the run order (decision 113), then **start the next task(s) at once**, as section 3 orders them. Don't stop to report that the reading is done.

Continue through the gate (T9AR.24) and the `claude-opus-5.5-d9ar` tag. Stop only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` (the deliverable branch every lane merges into) |
| Ports | `5175`, from the gitignored `.env.local`; `4175` is the benchmark's, and D9A-R runs no benchmark (A285) |
| Frozen plan | tag `claude-opus-5.5-plan-r107` (decision 118, commit `594feccf`) |
| Code D9A-R builds on | `claude-opus-5.5-d9a` |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `ls .claude/session.lock` | Absent. If it exists, another session may be working here: stop and show the user its contents. |
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5`, possibly followed by `[ahead N]`. No uncommitted changes. |
| `git rev-parse --short 'claude-opus-5.5-plan-r107^{commit}'` | `594feccf` |
| `git rev-parse --verify 'claude-opus-5.5-d9a^{commit}'` | Resolves. |
| `git log --oneline claude-opus-5.5-d9a..HEAD` | Empty at the first session, or only stage A's report and this handoff. Afterwards: only D9A-R task and merge commits, their evidence and Progress updates, handoff updates, and approved plan revisions. |
| `ls .claude/worktrees 2>/dev/null` | Empty, absent, or only this implementation's lane worktrees (D9's `d09-<lane>`, this deliverable's `d09ar-<lane>`). |
| `git rev-parse --git-path hooks` | `.githooks` (the pre-commit typecheck and lint hook; the setup commands are at the top of `.githooks/pre-commit`) |
| `ocr llm test` | Prints `✓ Connection test successful`. If it fails on authentication, ask the user to run `ocr auth login`. If it reports the usage limit, wait as `.claude/agents/ocr-review.md` says. |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `lsof -nP -iTCP:5175 -iTCP:9341 -iTCP:9342 -sTCP:LISTEN` | Nothing listening. |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run src && npx vitest run tests/integration` | Every test passes. Record the file and test counts in `evidence/D09AR/provenance.md`. |

Record the exact Node version in `evidence/D09AR/provenance.md`.

If any check fails, **stop and ask the user**:
- Don't edit files, create branches or `cd` into another worktree to fix things.
- Don't change the machine's Node installation, and don't proceed on another Node version.

**Never look at any other worktree** under `worktrees/`, or another implementation's branch. The implementations are being compared, and reading another one contaminates the comparison. This includes other sessions' scratch, task-output and Playwright directories, and processes you did not start.
- **The lane worktrees are different.** The lane worktrees under this worktree's `.claude/worktrees/` belong to this implementation. Never confuse the two.
- **Tags are shared** across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.
- **Hooks.** The PreToolUse hooks in `.claude/settings.json`, `filter-test-output.sh` and `guard-shell-writes.sh`, behave as in D9. The guard blocks shell and inline-script writes to project files: change them with the Edit and Write tools.

## 2. Reading

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first, all of it, including "Running a swarm deliverable" and "Pending decisions". Then, scoped (decision 45, and the breakdown's A284):

**The `specs/` baseline.** Read **`plan/spec-reading/D09.md`** as `implementing.md` says. No D9A-R reading list exists (A284: a `D9A-R` spec-map tag would break `spec-reading-lists.py`); D9's list already covers Trade Analysis's `evaluate` and `replay`, Trade Views' `replayTrade`, Daily Review's `getTrade`, the UI contract and the glossary. Add by hand:
- **AC-REV-003**, `specs/acceptance/acceptance-contract.md` lines 238 to 244, for T9AR.9 (AC-JOUR-001, lines 173 to 179, is already in D9's list);
- **AC-DEL-002**, the same file, lines 462 to 468, for T9AR.7's banner case.

Revision 107 changed the glossary and Trade Analysis; read their amended passages (the breakdown's section 1.2 names them). Search `plan/spec-map.md` (don't read it in full) when the work touches another section, and note it in `evidence/D09AR/structural.md`.

**The frozen plan (scoped):**
- **`plan/D09A-R-stage-a-refactor.md` in full**, which is the work. Its section 1.3 (assumptions A266 to A287), section 1.5 (the lookups each task's brief cites), section 1.6 (the words W53 to W70), section 1.8 (critic-2's carried defects), section 4.2 (lanes and owned files) and section 5's cases are what each brief cites.
- **`plan/D09A-R-decisions.md`**: the user's eight decisions, which are the authority where they differ from the coach's suggestions.
- **`plan/D09-trade-replay.md`**, as D9A-R builds on it: section 1.1's P137 and P138, section 1.3 (A247 to A265), section 1.6 (W35 to W46, as amended), section 5's test Trades (R-BREN-U, R-AXIO-U, R-AXIO-D, R-CORV-D, R-DALE-D, R-DALE-U, K-sale), and section 7.2's browser helpers. Not its behavioral task text.
- **`plan/implementation-plan.md`:** everything except the `## D10` through `## D28` definition sections. That covers decisions 1 to 118 (100 as amended by 111, 113 as amended by 115), the rules and cumulative obligations, the definitions through D9 and D9A-R, and the tech debt list (items 11, 24, 25 and 28 are named in the breakdown's section 11).
- **`plan/acceptance-matrix.md`:** only the opening sections, and the rows the breakdown's section 13 names.
- **`plan/D07-approved-words.md`:** conventions C1 to C8, with the D8R note above them.
- **Evidence from stage A:** `evidence/D09/stage-a-report.md`, `evidence/D09/coach-review-1.md` (the critic receives it too), `evidence/D09/critic-2.md`.

`specs/` and the frozen plan are read-only. A deviation, or a question the specs and plan leave to the user, is a pending decision (decision 113 as amended): ask in an ordinary message, one question at a time, queue any other in `evidence/D09AR/DECISIONS-PENDING.md`, pause only the tasks it blocks, and keep the other lanes going. An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`. The next revision is r108, the next decision 119, and the breakdown's numbering continues at P154, A288 and W71. Editing the Progress section alone is not a revision.

## 3. D9A-R specifics

### Setup before wave 0

Create `evidence/D09AR/` (the breakdown's section 14; `tdd.sh` maps `T9AR.n` there, and `full-suite.sh` maps it to `e2e/d9ar/`) with:
- `tdd-log.md`, with the note that its rows are single-case runs; `tdd.sh` writes each task's rows to `evidence/D09AR/tdd-log/<task>.md`;
- `structural.md`, `provenance.md`, `DECISIONS-PENDING.md`, `new-words.md` (words used provisionally) and `words-changed.md` (P137);
- `suite-runs/` and `ocr/` as they fill.

### Lane worktrees, by hand

The Agent tool's `isolation: "worktree"` roots a lane at the main checkout on `main`, so **never use it**. For each lane task:
1. `git worktree add .claude/worktrees/d09ar-<lane> -b d09ar/<lane> <base>`, where `<base>` is the deliverable branch's head (or reset the lane's branch to that head for the lane's next task);
2. brief a fresh `tdd-task` **without** `isolation`, whose brief names that worktree as its working directory and starts with `./.claude/scripts/lane-setup.sh`.

### Wave 0

**T9AR.1 first.** It fixes `status.sh` so that `status.sh D09A-R` finds `evidence/D09AR/` (P141); until it merges, `status.sh` reports "no decisions file" for this deliverable. **T9AR.2** runs at the same time in lane TY: it freezes every new type (optional fields only) and splits the replay adapter into `session-words.props.ts`, `stake-words.props.ts`, `readout.props.ts` and `plot.props.ts` with every case title unchanged (A286), so each lane starts on its own files. Merge each as it becomes mergeable, then one complete cumulative run before wave 1.

### Wave 1

Lanes **DM** (T9AR.3, T9AR.4, T9AR.5, T9AR.6), **OV** (T9AR.7, T9AR.8, T9AR.9) and **PL** (T9AR.10, T9AR.11, T9AR.12) run at once, each in its listed order. A lane's next task starts once its previous task has merged.

- **DM is the domain**: the estimated odds and the extremes' weight (A267, A268), the Plan's terms and each fill against the Plan (A269, A270), a condition's first crossing (A271), then the facade and manifest. It comes first by decision 2.
- **OV builds the overlay** and moves Trade Detail and the Review card onto it. Lanes RO and SC wait for T9AR.8.
- **PL changes the chart's drawing.** Unlike stage A, every lane works against the real replay, not doubles (section 3 of the breakdown).

### Wave 2

1. Lanes **RO** (T9AR.13, T9AR.14, T9AR.15) and **SC** (T9AR.16, T9AR.17, T9AR.18) start when T9AR.8 has merged.
2. T9AR.15, T9AR.18 and T9AR.19 also wait for T9AR.6. T9AR.17 waits for T9AR.14. T9AR.18 waits for T9AR.15 (it takes over two groups of `readout.props.ts` after RO is done).
3. **T9AR.19** (lane PL) follows T9AR.12 and T9AR.6.
4. **T9AR.20** (lane RW) starts when T9AR.9 and T9AR.15 have merged.
5. **T9AR.21** (lane DM) starts when T9AR.13 has merged.
6. At most four `tdd-task` agents at once across all lanes.

### Wave 3

1. **T9AR.22** (lane IN), the Node suite, may start once T9AR.6 and T9AR.21 have merged.
2. **T9AR.23** (lane BR), the browser suite, after the last UI task (T9AR.15, T9AR.18, T9AR.19, T9AR.20). `e2e/d9ar` joins `browser-3` with no script change: `test:e2e:3`'s `e2e/d9` argument also matches `e2e/d9ar`, as `e2e/d8` matches `e2e/d8r`. If `browser-3` passes 8 minutes, add `browser-4` for `e2e/d9` and `e2e/d9ar`.
3. A full-tier run, then **the gate, T9AR.24**.

### Shared files

Follow section 4.2's "Shared files" rules: `replay.types.ts` changes go to lane TY as a bug task; `readout.props.ts` is RO's through T9AR.15, then SC's two groups; `ReviewCard.test.tsx` is OV's for the button and RW's for the summary after T9AR.9; `e2e/d9` helpers are owned by group, and no lane renames another lane's helper. **P148:** a task that removes a figure's place is blocked by the task that gives it its new one, or keeps it until then. **P150:** each task re-points only the `e2e/d9` lines its lookup lists, so stage A's B9.1, B9.2, B9.3, B9.4 and B9.5 keep passing as amended.

### Critic-2's carried defects (the breakdown's section 1.8)

Stage A closed without fixing these, by the user's decision. Each is a planned case in the task named, written red first; the gate's critic checks each again.

| Critic-2 defect | Severity | Task |
|---|---|---|
| 1a. The chart's overrun labels are not in the table, whose "Current Risk at Stop" reads "$0.00" past the Stop | High | T9AR.17 |
| 1b. The price chart's "Strike $100" is in neither the readout nor the table | High | T9AR.18 |
| 2. The minus sign wraps away from its amount ("P&L –" / "$17,463.00") | Moderate | T9AR.13 |
| 3. A stock Trade's axis end names the last session before it is revealed | Low | T9AR.10 |
| 4. An Expiration is labelled "Execution, Fri Nov 20" | Low | T9AR.18 |

### Merging and merge runs

- **Each task** gets its lane worktree at the deliverable branch's head at dispatch. Before the brief, mark the task's Progress row "In progress from `<head>`".
- **Mergeable** means its ocr review and bug tasks are clean, and its lane tier passed (`full-suite.sh evidence/D09AR <task> lane`, in its worktree, recorded in `suite-runs/`). Then rebase its branch onto `claude-opus-5.5` and fast-forward. If the rebase changed a file the task doesn't own, rerun its lane tier first. Mark the row "Done" with the **rebased** hashes.
- **Merge runs.** When no merge is pending, and at least one task has merged since the last run, send `suite-runner` the complete cumulative run on `claude-opus-5.5`, with `browser-auto <last merge run's commit>`. Record it in `structural.md`. Pin a failure to a merged task with one targeted run, and fix it in a fresh `tdd-task` from the current head, failing test first. Lanes keep working during merge runs.
- At most **four `tdd-task` agents at once**. `ocr-review` agents don't count against the cap.

### Other rules

- **The UI calculates nothing (ADR 0001).** Every dollar figure, share, odds and status comes from Trade Analysis or a coordinator as a finished value (P142). The `*.props.ts` adapters select and format. Turning a finished figure into an SVG coordinate is drawing; working out a figure in `src/ui/` is a defect. Say this in every UI brief and check it in each summary. Code under `src/ui/cockpit/` takes plain props, and only `*.props.ts` adapters import view types.
- **Nothing later shows early.** A session after the slider's is not in the DOM, cards included (P145); the overlay header's today's P&L is the one exception (decision 3).
- **A gap stays a gap** (AC-MARK-004, P146). No bridge across a session with no Mark.
- **Words.** Screens use the breakdown's section 1.6, W53 to W70, and D9's approved words as amended. A price is a **Mark**, never a "close"; the end of a session is "the close".
  - **Words no row covers** are not a stop: use the wording you would have recommended, and record each phrase in `evidence/D09AR/new-words.md`, with the task, the screen and the nearest approved row. The final report lists them for the user's approval (P135, P149).
  - **The wording rule (P137), into the brief of every task that puts words on screen (T9AR.7, T9AR.8, T9AR.9, T9AR.10, T9AR.11, T9AR.12, T9AR.13, T9AR.14, T9AR.15, T9AR.16, T9AR.17, T9AR.18, T9AR.19, T9AR.20), pasted word for word from the breakdown's section 9:**
    > Each task that puts words on screen judges whether they should be shorter, and shortens them when it thinks so. The user has approved this in advance. What a task may do: use fewer words for the same meaning; drop a label from the chart; move part of a sentence to the readout, the hover or the session cards. What it may not do: lengthen anything; change a figure or how it is worked out; take a figure off the page altogether (each stays in the readout or the session cards); or change what a planned case tests. When a planned case quotes words that are shortened, the case's quoted words change to match and nothing else in the case does. Every change is recorded with its before and after in `evidence/D09AR/words-changed.md`, by task, and listed in the deliverable's final report. Section 1.6 keeps the approved wording as the starting point.

    The main session copies each change from the task's summary into `evidence/D09AR/words-changed.md`, by task.
- **Lane briefs carry the lane rules:** the worktree to work in; start with `./.claude/scripts/lane-setup.sh`; run only the lane tier, never a complete run; browser tests only on port 5175 and only under `.claude/scripts/with-browser-lock.sh`, and only the spec files the task changes; red and green rows to `evidence/D09AR/tdd-log/<task>.md`; commit on the lane branch only; the main session rebases and merges. Each brief also names the lane's owned files from section 4.2, and says that a need for any other file is a stop-and-report.
- **What must not change.**
  - Every existing case keeps its expected values, except where the breakdown's section 1.5 names the lines and the task. Everywhere else, a changed expected value is a defect.
  - Every existing query-count proof keeps its exact request lists; I9AR.4 proves the new figures read nothing.
  - No frozen fixture view changes, except T9AR.21's removal of `riskChange` and `rewardChange` (A279), with each deleted or changed case listed in `structural.md`.
  - The shell's warnings and banners stay in place under the overlay, never dismissed or changed (P153).
- **TDD discipline.** Run each case red, then green. Never write a test after its code, and back out code written before its red. A first-run pass gets the mutation check (an assertion failure or runtime exception, not a compile error) and is flagged in the handoff's open questions. Pinned browser cases use `launchAt`, `pinClock` and `setClock` from `e2e/d4/support.ts`.
- **ocr reviews every commit in place**, test-only commits included (`.claude/ocr-rule.json` brings test files in); nothing is relocated.
- **Known flaky cases (P138, carried by P151).** Tech debt item 11's case (`TradeList.test.tsx`, the Ready state) and the `PositionChangeForm` focus case ("should move focus to the Record entry heading when the form finishes loading"). If either fails a run, have the runner rerun it alone once. A pass is logged as a flake, with the run, and the run continues; two failures in a row are a pending decision. Any other failing test is a failure: reproduce it with one targeted run and fix it in a fresh subagent.
- **Tech debt.** Item 28 is touched by T9AR.5 only as the breakdown's section 11 says; don't fix other items unasked.
- **No benchmark** (A285).

### The gate (T9AR.24)

1. Run the full tier with `suite-runner` until it passes.
2. Run `.claude/scripts/acceptance-commands.sh plan/D09A-R-stage-a-refactor.md`. All seven of its commands must pass; a failure is a defect.
3. Brief a **fresh** `general-purpose` critic (effort medium) from `.claude/docs/critic-brief.md`, with flows C9AR.1, C9AR.2, C9AR.3, C9AR.4, C9AR.5, C9AR.6 and C9AR.7, what section 8 of the breakdown says it receives (`evidence/D09/coach-review-1.md`, whose 15 points it looks at again, and the future-capability list), critic-2's five carried defects and its four minor observations not covered (the breakdown's section 1.8), the 375 and 320 px checks, port 5175 under the lock, and no reading of the rest of `evidence/` or of another worktree.
4. Reports go to `test-results/critic-d09ar-<n>/report.md`. Copy each to `evidence/D09AR/critic-<n>.md`, and its cost (tokens, tool calls, time) to `structural.md`'s critic table.
5. **Critic rules.** Fix every defect: each is first reproduced by a failing test, then fixed as a bug task in a fresh `tdd-task`. After the last fix, one full run. A fresh critic repeats all seven flows whenever any high or moderate defect was found. At most three critics; if the third still leaves defects, **stop and ask the user** (P151 allows closing on moderate or lower defects as tech debt items, but the user decides; a high defect or a FAIL always stops).

## 4. What is in place

Build on these. Read the code before extending it. Section 1.5's lookups were run on `bbc3ae28`, before T9.19-B3 and T9.19-B11 merged; rerun a lookup if those fixes moved its lines.

| Piece | Where | Notes for D9A-R |
|---|---|---|
| Trade Analysis | `src/domain/trade-analysis/evaluate.ts` (`TradeOutcomes`, `TradeStandingReading`), `replay-series.ts` (`ReplayFigures` with `openPnl`, markers, `riskChange`, `rewardChange`) | Lane DM. |
| Replay assembly | `src/coordinators/replay/assemble-replay.ts` (`assembleReplay`, `withJournal` option) | Fields pass through (A272). |
| Replay views | `src/coordinators/trade-views/replay-view.ts`; `src/coordinators/daily-review/types.ts` (`DailyTradeReview.replay`) | View types only. |
| The adapter | `src/ui/cockpit/replay/replay.props.ts` (`replayProps`, about 500 lines) | T9AR.2 splits it. |
| The frame and chart | `src/ui/cockpit/replay/frame.tsx`, `corridor.tsx`, `corridor-pnl.tsx`, `price-strip.tsx`, `geometry.ts` (`LabelPlacer`, `timeAxis`), `replay.types.ts` | Lanes SC and PL. |
| Trade Detail | `src/ui/screens/trade-detail/Cockpit.tsx`, `drawer-request.ts`, `src/ui/screens/TradeDetail.tsx`, `src/ui/cockpit/drawers/replay.tsx` | Lane OV: Replay leaves the drawers (P143). |
| Review card | `src/ui/screens/ReviewCard.tsx` (the `.review-card-replay` section), `ReviewView.tsx` (`linkedCard`), `CardFigures.tsx` | Lanes OV and RW. |
| Suites | `tests/integration/d9/`, `e2e/d9/` (`support.ts`, `responsive-a11y.spec.ts`'s fit and text checks) | Re-pointed per section 1.5; new cases in `d9ar`. |
| Tooling | `.claude/scripts/status.sh`, `tdd.sh`, `full-suite.sh`, `lane-setup.sh`, `with-browser-lock.sh`, `run-complete.sh`, `acceptance-commands.sh` | T9AR.1 changes `status.sh`. |

## 5. Working rules

- **Commits.**
  - Commit each finished task locally.
  - The main session's commits end with the Co-Authored-By line the session's system reminder gives.
  - Subagent briefs say "ending with the trailer your agent instructions specify".
  - **Never push** unless the user asks.
- **Who edits what.** The main session edits only plan, evidence and handoff documents, and does the merging. Every task, bug task and code change goes to a fresh `tdd-task`.
- **Runs.** Lane tiers per task, one complete run per merge batch, and the full tier before every critic (decision 111). Tell the runner to check ports 9341, 9342 and 5175 inside the lock, to send exactly one report only when complete, to run each stage in its own foreground call, and to use a label without a trailing hyphen.
- **ocr reviews.** Every implementation commit gets an `ocr-review`. **Only ocr's own Valid or Doubtful findings become bug tasks**, which run in the same lane. A readability finding becomes a structural F task (verified by the same cases passing unchanged before and after). A Wrong finding is dismissed with its reason. A reviewer's or subagent's own note is recorded, never made a bug task. Copy each output to `evidence/D09AR/ocr/<task>-<sha>.json`.
- **Subagents.** General-purpose subagents run at medium effort. Don't resume an old subagent. Stop one that keeps resending its hand-back.
- **Git.** Never use bare `git stash`. Don't `git add evidence/D09AR` as a whole; add the files you mean.
- **Refer to sections in words**, never with the section sign. List each task ID ("T9AR.3, T9AR.4, T9AR.5"), never a range.
- **Asking.** Plain language first, then the context, the options with their tradeoffs, and a recommendation. One question per message; queue the rest (decision 113 as amended).
- **After each merge:** update the Progress row and section 7 of this note, commit, and keep the lanes full.

### Running a whole deliverable

Stop all work and ask the user **only** when:
1. the session lock exists, or a location check in section 1 fails;
2. nothing unblocked remains while a pending decision waits;
3. a fresh critic or a browser can't be provided, or three critics at the gate still leave defects;
4. a merge conflict falls in a file two lanes both own, which section 4.2 says can't happen.

These are pending decisions, asked one at a time while the unblocked lanes keep working (decision 113 as amended):
- the work needs a deviation from `specs/` or the frozen plan, or exposes an ambiguity: a breakdown passage the built code can't meet, a query-count proof that can't keep its request list, or a changed frozen view;
- a suite failure, critic defect or ocr bug-task fix can't be fixed without such a deviation, or a third ocr round on one task still leaves findings;
- a known flaky case fails twice in a row (P138);
- `acceptance-commands.sh` can't pass its seven commands without a revision.

Not pending decisions: a screen text no approved word covers (P135), and a text a task shortens under P137. Both are recorded and reported.

Everything else continues without the user. Make implementation-level decisions with the recommendation you would have offered, and record them. Reproduce and fix suite failures in fresh subagents. Log first-run passes.

### When the gate closes

1. Mark section 13's rows covered where D9A-R completes them, and tag **`claude-opus-5.5-d9ar`** locally.
2. Write `evidence/D09AR/report.md`: tasks and commits, each task's fix rounds, flaky tests with the run they flaked in, decisions (answered and pending), critics with their cost, any defects moved to tech debt, the new words awaiting approval, every text shortened under P137 with its before and after, and the wall-clock time against the breakdown's estimate (about 9 hours, section 3).
3. Write **stage B's handoff, `plan/D09B-handoff.md`**, in this note's form, for T9.20, T9.21, T9.22, T9.23, T9.24, T9.25, T9.26, T9.27 and T9.28, run one task at a time (decision 100). Stage B's tasks were amended for D9A-R (the breakdown's section 10: the odds decision row before T9.20's brief; the chips and the "since" line rendered in the overlay; table columns become session-card rows), so this handoff is written only now. Carry the "Starting a session" paragraph, these stop conditions, and the notes below that name stage B's tasks.
4. Remove `.claude/session.lock`. Never push.

## 6. Out of scope

- **D9's stage B** (T9.20, T9.21, T9.22, T9.23, T9.24, T9.25, T9.26, T9.27, T9.28) and **stage C** (T9.29, T9.30, T9.31, T9.32, T9.33, T9.34, T9.35, T9.40, T9.36, T9.37, T9.38, T9.39).
- **What P152 leaves out**: the other screens' older names, convention C3 outside the replay, a top-edge tag for an off-scale Max reward, refining the odds with volatility, a real touch device.
- **The benchmark** (A285), a second browser port, and the tech debt items.
- **Editing `specs/` or the frozen plan** without an approved revision.
- **Pushing.**

## 7. D9A-R progress

Task status and commits are in the breakdown's Progress section. This section holds two lists, one bullet per entry.

### Notes for later tasks

- For T9AR.2: section 1.5's lookups were run on `bbc3ae28`; T9.19-B3 (`f84a9391`) and T9.19-B11 (`1047b81a`) have since merged. Rerun any lookup whose lines they may have moved before the brief.
- For T9AR.10: critic-2's defect 3 (a stock Trade's axis end) is this task's case "it should show nothing at the right end of a stock Trade's time axis at any session (W67)".
- For T9AR.13: critic-2's defect 2 (the minus sign wraps) is this task's case at 1280, 375 and 320 wide (R-DALE-D Fri 11-13's At Worst case; R-BREN-U Mon 11-02).
- For T9AR.17: critic-2's defect 1a (overrun not in the table) is this task's case on R-AXIO-D Mon 11-09, never "$0.00" at risk.
- For T9AR.18: critic-2's defects 1b (the strike in "The Plan" block) and 4 ("Expiration, Fri Nov 20", never "Execution") are this task's cases.
- For T9AR.24: critic-2's minor observations not covered by any task, for the critic to look at again: a final session's headline drops the R; "up $0.00 since Thu Nov 19" on an expired put's final session; focus on the page body after the Review card's Price History link returns; each revealed session is its own tab stop (11 on BREN).
- For T9AR.7, T9AR.8, T9AR.9, T9AR.12, T9AR.23: stage A's "fits one screen" check once flaked from a resize lag; T9.19-B12 fixed it with `flushSync` in `useBoxWidth` and a poll in `expectFitsOneScreen`. A recurrence is a real failure, not a known flake.
- For T9.23 (stage B): `replay-series.ts` is lane DM's in D9A-R. Stage B adds `estimates` to the same session shape; keep `figures` free of any number type.
- For T9.33, T9.40 (stage C): D9A-R leaves `StopTargetSlider` and `rangePosition` exactly as they are.

### Open questions

- Stage A's provisional words (`evidence/D09/new-words.md`) still await the user's approval; some look replaced by D9A-R's W53 to W70 (check "Past Stop's amount" and "Not triggered" against W56, and the Underlying price without "$" against W58). List in the final report which stage A words D9A-R replaced.
