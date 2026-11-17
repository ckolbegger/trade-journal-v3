# Handoff: `claude-opus-5.5`, implement D8R

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, D8R's specifics, the swarm procedure and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-11-17, after plan revision 104. [D08R-drafting-handoff.md](D08R-drafting-handoff.md) is the record of the planning session that drafted the breakdown.

This session **implements D8R, "The Trade Detail refactor"**, under the frozen plan at revision 104. D8R carries out the Trade Detail audit (`research/trade-detail-audit.html`): each part of Trade Detail shows each thing once, where the trader looks for it. The breakdown is [D08R-trade-detail-refactor.md](D08R-trade-detail-refactor.md):
- 28 tasks (T8R.1 to T8R.28) in three waves and eleven lanes, with an agent cap of six;
- agreed by the user on 2026-11-17 as **decision 115**, with P108–P116, its six answered questions (section 12) and the words W21–W34 approved (W1 and W28 amended);
- run as a **swarm** under **decision 111**, with pending questions handled under **decision 113 as amended by decision 115**: one question at a time, the others queued.

Task status lives in the breakdown's Progress section, which has Wave and Lane columns (decision 100, amended by decision 111).

Where things stand:
- **D8: complete, tagged `claude-opus-5.5-d8` (`be736f8b`)**, with its follow-up T8.19-F1 and the D8 retrospective's fixes after it.
- **The last complete cumulative run** is `T8.19-F1` (`evidence/D08/suite-runs/`). It passed: unit 189 files and 2027 tests; integration 118 files and 258 tests; browser 126 in `browser-1` and 120 in `browser-2`; checks 14 of 14. The retrospective's later fixes changed only tooling (`.claude/scripts/status.sh`, the capacity hints).
- **Revision 104 changed `specs/`** in two sentences, which the work builds on: Market Data's read session names the previous session and a current context's as-of exchange date (`specs/design/market-data.md`, "Query contract"), and Trade Detail's Journal leaves out the Trade Anchor (`specs/design/ui-contract.md`, "Trade and Journal presentation"). No code implements them yet.
- **Not part of D8R:** the replay prototypes (`prototypes/replay/`, `research/replay-requirements.md`) and the D9 drafting handoff are research for D9.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D08R-handoff.md and follow it."*
1. Take the session lock (`implementing.md`, "Start-of-deliverable reading").
2. Run the location checks in section 1.
3. Do the reading in section 2.
4. Print the run order (decision 113), then **start the next task(s) at once**, as section 3 orders them. Don't stop to report that the reading is done.

Continue through the gate (T8R.28) and the `claude-opus-5.5-d8r` tag. Stop only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` (the deliverable branch every lane merges into) |
| Ports | `5175`, from the gitignored `.env.local`; `4175` is the benchmark's, and D8R runs no benchmark (A246) |
| Frozen plan | tag `claude-opus-5.5-plan-r104` (decision 115) |
| Code D8R builds on | `claude-opus-5.5-plan-r104`'s tree: D8 (`claude-opus-5.5-d8`) plus T8.19-F1 and the retrospective's tooling fixes |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `ls .claude/session.lock` | Absent. If it exists, another session may be working here: stop and show the user its contents. |
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5`, possibly followed by `[ahead N]`. No uncommitted changes. |
| `git log --oneline claude-opus-5.5-plan-r104..HEAD` | Empty at the first session. Afterwards: only D8R task and merge commits, their evidence and Progress updates, handoff updates, and approved plan revisions. |
| `git rev-parse --short 'claude-opus-5.5-d8^{commit}'` | `be736f8b` |
| `git diff --stat claude-opus-5.5-d8 claude-opus-5.5-plan-r104 -- src e2e tests` | Empty: no product code or test changed after the D8 gate. |
| `ls .claude/worktrees 2>/dev/null` | Empty or absent at the first session. Afterwards, only this deliverable's lane worktrees. |
| `git rev-parse --git-path hooks` | `.githooks` (the pre-commit typecheck and lint hook; the setup commands are at the top of `.githooks/pre-commit`) |
| `ocr llm test` | Prints `✓ Connection test successful`. If it fails on authentication, ask the user to run `ocr auth login`. If it reports the usage limit, wait as `.claude/agents/ocr-review.md` says. |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `lsof -nP -iTCP:5175 -iTCP:9341 -iTCP:9342 -sTCP:LISTEN` | Nothing listening. |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run src && npx vitest run tests/integration` | Every test passes. Record the file and test counts in `evidence/D08R/provenance.md`. |

Record the exact Node version in `evidence/D08R/provenance.md`.

If any check fails, **stop and ask the user**:
- Don't edit files, create branches or `cd` into another worktree to fix things.
- Don't change the machine's Node installation, and don't proceed on another Node version.

**Never look at any other worktree** under `worktrees/`, or another implementation's branch. The implementations are being compared, and reading another one contaminates the comparison. This includes other sessions' scratch, task-output and Playwright directories, and processes you did not start.
- **The lane worktrees are different.** D8R's lane worktrees, under this worktree's `.claude/worktrees/d08r-<lane>`, belong to this implementation. Never confuse the two.
- **Tags are shared** across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.
- **Hooks.** The PreToolUse hooks in `.claude/settings.json`, `filter-test-output.sh` and `guard-shell-writes.sh`, behave as in D8.

## 2. Reading

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first, all of it, including "Running a swarm deliverable" and "Pending decisions". Then, scoped:

**The `specs/` baseline (A244).** D8R has no reading list of its own. Read **`plan/spec-reading/D07.md`** as `implementing.md` says. Also read these sections, which D9's list (`plan/spec-reading/D09.md`) holds; find their line ranges with `plan/spec-map.md`:
- `specs/design/market-data.md`, "Query contract" (S124: `ReadSeries` and the read session, with revision 104's sentence);
- `specs/design/trade-views-and-reporting.md`, "`getTradeDetail`", "`replayTrade`" and "Invariants";
- `specs/design/trade-analysis.md`, "`evaluate`" and "`replay`";
- `specs/acceptance/acceptance-contract.md`, AC-MARK-004 (S047);
- `specs/design/ui-contract.md`, "Trade and Journal presentation" (S211, with revision 104's sentence) and "Numbers, availability, and graphs" (S212).

Search `plan/spec-map.md` (don't read it in full) when the work touches another section, and note it in `evidence/D08R/structural.md`.

**The frozen plan (scoped):**
- **`plan/D08R-trade-detail-refactor.md` in full**, which is the work. Its section 1.5 (the Texts, Shapes, Checks and Names lookups) and its appendix are what each task's brief cites.
- **`plan/implementation-plan.md`:** everything except the `## D9` through `## D28` definition sections. That covers decisions 1–115 (100 as amended by 111, 113 as amended by 115), the rules and cumulative obligations, the freeze record, the definitions through D8R, and the tech debt list (item 24 is fixed here).
- **`plan/acceptance-matrix.md`:** only the opening sections, and the rows the breakdown's section 13 names.
- **`plan/D07-approved-words.md`:** conventions C1–C8, with the D8R note above them (contract names).
- **`plan/D08P-trade-detail-cockpit.md`**, the deliverable D8R reworks: its status note, sections 1.3 (assumptions), 1.6 (words), 4.2 (lanes and ownership), section 5's O-C3 and O-S2 data, T8P.30 (absence checks), section 7 and section 9 (the swarm process). Not its other behavioral task text.
- **`plan/D08-backup-and-restore.md`:** only what T8R.20 needs: the backup fixtures (A145, A147) and I8.x's round trip.
- **The audit**, `research/trade-detail-audit.html`, sections 7 to 14, as the design behind each task. It is not a specification: where it and the breakdown differ, the breakdown wins (the user's answers changed several of its proposals, section 12 of the breakdown).

`specs/` and the frozen plan are read-only. A deviation, or a question the specs and plan leave to the user, is a pending decision (decision 113 as amended): ask in an ordinary message, one question at a time, queue any other in `evidence/D08R/DECISIONS-PENDING.md`, pause only the tasks it blocks, and keep the other lanes going. An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`. The next revision is r105, the next decision 116, and the breakdown's numbering continues at P117, A247 and W35. Editing the Progress section alone is not a revision.

## 3. D8R specifics

### Setup before wave 0

Create `evidence/D08R/` with:
- `tdd-log.md`, with the note that its rows are single-case runs; `tdd.sh` writes each task's rows to `evidence/D08R/tdd-log/<task>.md`;
- `structural.md`, `provenance.md` and `DECISIONS-PENDING.md`.

### Wave 0

T8R.1, T8R.2, T8R.3 and T8R.4 run **at once**, each in its own lane (TY, SH, CN, PH), each a fresh `tdd-task` with `isolation: "worktree"` whose brief starts with `.claude/scripts/lane-setup.sh`. Their files are disjoint (breakdown section 4.2). T8R.2 and T8R.3 both touch `e2e/d8p/states.spec.ts`, on different lines; T8R.3 owns only line 48. Merge each as it becomes mergeable, then run one complete cumulative run before wave 1.

- **T8R.3 is the widest task**: every contract-name expectation in the appendix, and only those. The "Expires" and "Expired" lines don't change. Every unit test it touches pins the clock.
- **T8R.1 is types only**: additive fields, no behavior, so the UI lanes can write doubles before the backend lanes finish.

### Wave 1

The breakdown's sections 4.1 and 4.2 give the tasks, blocking and file ownership.

**Agents and order.**
- At most **six `tdd-task` agents at once**. `ocr-review` agents don't count against the cap.
- Start TD (T8R.6), BV (T8R.21), PR (T8R.10), RA (T8R.13), BA (T8R.18) and JR (T8R.15). PO (T8R.5) takes the first free slot.
- Each lane runs its own tasks in its listed order. A lane's next task starts once its previous task has merged.

**Blocking and merge order** (P116: no figure disappears between merges):
- T8R.14 merges only after T8R.10 has merged.
- T8R.9 starts only when T8R.10, T8R.12, T8R.13 and T8R.14 have merged.
- T8R.17 starts only after T8R.11 has merged.
- T8R.19 starts only after T8R.21 has merged.
- T8R.20 starts only after T8R.14 has merged. It is the only task that edits frozen fixtures, and only their `"nearest": true` lines (P111).
- T8R.26, the Node suite, may start in wave 1 once T8R.18, T8R.19, T8R.20, T8R.21, T8R.22 and T8R.23 have merged.
- T8R.6 merges only after T8R.4, which is already in from wave 0.

**Each task** gets a fresh worktree from the deliverable branch's head at dispatch.
- Before the brief, mark the task's Progress row "In progress from `<head>`".
- Record in `structural.md` the worktree and branch names the Agent tool gives.

**Merging.** A task is mergeable when its ocr review and bug tasks are clean, and its lane tier passed (`full-suite.sh evidence/D08R <task> lane`, in its worktree, recorded in `suite-runs/`). Then rebase its branch onto `claude-opus-5.5` and fast-forward. If the rebase changed a file the task doesn't own, rerun its lane tier first. Mark the row "Done" with the **rebased** hashes. Remove the lane worktree once merged.

**Merge runs.** When no merge is pending, and at least one task has merged since the last run:
1. Send `suite-runner` the complete cumulative run on `claude-opus-5.5`, with `browser-auto <last merge run's commit>`.
2. Record it in `structural.md`.
3. If a failure appears, pin it to a merged task with one targeted run, and fix it in a fresh `tdd-task` from the current head, failing test first.

Lanes keep working during merge runs.

### Wave 2

1. **T8R.24**, the before-Marks words, after T8R.19 and every wave-1 UI task have merged. It changes `calculation-words.ts` and the "Awaiting the close after" expectations on Trade Detail, the Trades list and the Review (C1), and extends the wording rule to "Awaiting the <date> close".
2. A full-tier run.
3. **The checkpoint critic, T8R.25**, on flows C8R.1–C8R.4, beside **T8R.27**, the browser suite. Critic defects become bug tasks, each reproduced by a failing test first.
4. **T8R.26**, the Node suite, if it hasn't already merged.
5. A full-tier run, then **the gate, T8R.28**, once T8R.25's bug tasks and T8R.27 have merged.

### Other rules

- **Ports.** Every browser run, wherever it starts, goes through `.claude/scripts/with-browser-lock.sh`. In a lane, run only the spec files the task changes.
- **Words.** Screens use the breakdown's section 1.6, W21–W34, with W1 and W28 as amended. A price is a **Mark**, never a "close"; the end of a session is "the close" ("Awaiting the Mon Oct 12 close"). Moved content keeps its words. A screen text no approved word covers is a pending decision.
- **Lane briefs carry the lane rules:** start with `lane-setup.sh`; run only the lane tier, never a complete run; browser tests through the lock; red and green rows to `evidence/D08R/tdd-log/<task>.md`; commit on the lane branch only; the main session rebases and merges. Each brief also names the lane's owned files from section 4.2, and says that a need for any other file is a stop-and-report.
- **What must not change.**
  - Every existing case keeps its expected values, except where section 1.5's Texts table, or the appendix for contract names, names the case and the task. Everywhere else, a changed expected value is a defect.
  - Every existing query-count proof keeps its exact request lists. I8R.7 adds the Settlement Due Detail's one `series` read.
  - No frozen fixture view changes, except T8R.20's `nearest` deletions, whose diff check proves nothing else changed.
  - Every new view field is additive (A245).
- **The UI calculates nothing (ADR 0001).** Every figure comes from Trade Analysis or Trade Views. The UI selects and formats: Today's cells are selected from the replay (A233), and the Exit column picks the last Execution (A235). Code under `src/ui/cockpit/` takes plain props, and only `*.props.ts` adapters import view types (A216's lint rule).
- **Absence checks prove absence** (T8P.30): a "gone" case checks hidden drawer panels too.
- **TDD discipline, clock pinning, mutation builds, and ocr on test-only commits:** as in D08P.
  - Run each case red, then green. Back out code written before its red.
  - A first-run pass gets the mutation check (an assertion failure or runtime exception, not a compile error) and is listed under section 7's open questions.
  - Pinned browser cases use `launchAt`, `pinClock` and `setClock` from `e2e/d4/support.ts`.
  - Test-only commits are relocated under `src/itg/d08r/` for `ocr-review`.
- **Tech debt triggers.** Item 24 is fixed in T8R.16, with B8R.6's focus case red first. Raise item 11 (the Open list's Ready-state race) with the user if `TradeList.test.tsx` fails a run. Don't fix other items unasked.
- **No benchmark** (A246, decision 114): D8R's changes don't touch the gated paths.
- **The gate (T8R.28).**
  1. Run the full tier with `suite-runner` until it passes.
  2. Run `.claude/scripts/acceptance-commands.sh plan/D08R-trade-detail-refactor.md`, which must exit 0.
  3. Brief a **fresh** `general-purpose` critic (effort medium) from `.claude/docs/critic-brief.md`, with flows C8R.1–C8R.6, the future-capability list in breakdown section 8, the 375 and 320 px checks, port 5175 under the lock, and no reading of `evidence/` or another worktree.
  4. Reports go to `test-results/critic-d08r-<n>/report.md`. Copy each to `evidence/D08R/critic-<n>.md`; the checkpoint's report is `critic-1.md`.
  5. At most three critics per checkpoint before asking the user.
  6. When the gate passes, mark section 13's rows covered, and tag `claude-opus-5.5-d8r`.

## 4. What is in place

Build on these. Read the code before extending it. Line numbers are on `6b11c8bc` (breakdown section 1.5).

| Piece | Where | Notes for D8R |
|---|---|---|
| Cockpit shell | `src/ui/screens/trade-detail/Cockpit.tsx`: `drawersOf` :26–31, the `CurrentMarksOnly` branch :105, `<DetailFooter>` :168, `ReflectRequestContext` | T8R.2 (drawers, the drawer request); T8R.11 deletes the footer line. |
| Today drawer | `src/ui/cockpit/drawers/today.props.ts` (`marksOf`, `conditionLineOf`, `tracksOf`, `valuedAtOf`, `atEntryOf`, `currentMarksOf`, `todayProps`), `today.tsx`, `today.types.ts`; `src/ui/cockpit/track.tsx` | Lane TD. |
| Rail | `src/ui/cockpit/rail/` (`identity*`, `pnl*`, `conditions*`, `needs-you*`) | Lane RA; Needs you is unchanged. |
| Plan and Risk, footer | `drawers/plan-risk.props.ts` (`conditionFiguresGroup`), `src/ui/cockpit/footer*` | Lane PR. |
| Position, Lot Matches | `drawers/position.props.ts`; `src/ui/screens/LotMatchesTable.tsx`, shared with `ExitReceipt.tsx` and `ExpirationReceipt.tsx` | Lane PO. |
| Journal | `drawers/journal.props.ts` (`itemOf`), `src/ui/cockpit/journal-cards.tsx`; the fallback list `trade-detail/Journal.tsx` | Lane JR. |
| Price History | `drawers/price-history.tsx`; the replay's Marks carry `source`, `savedAt`, `correctionReason` (revision 93) | Lane PH. |
| Words | `src/ui/calculation-words.ts` (`instrumentLabel` :22–25, `AwaitingClose` :57–60); `src/ui/format.ts` (`summaryExpiration`, `summaryStrike`); `eslint.wording.config.js` (`PHRASES`) | T8R.3, T8R.24. |
| Evaluation | `src/domain/trade-analysis/evaluate.ts`: `ConditionReading` :52–62, `nearest` :72 and :396–401, `conditionOf` :339–353, `AwaitingClose` :256; `src/domain/calculation-result/index.ts` | Lane BA. |
| Valuation | `src/coordinators/valuation/` (`dated-line.ts`) | T8R.19 passes `nextSessionDate`. |
| Market Data | `src/modules/market-data/market-data.ts`: `MarketDataReadSession` :293, `openReadSession` about :805 | T8R.21. |
| Trade Views | `src/coordinators/trade-views/trade-views.ts` (the Detail types, `firstMarksDueOf` :465), `replay-view.ts`, `replay-trade.ts` | Lane BV. |
| Fixtures | `tests/fixtures/backup-v3-blocked` to `backup-v6-blocked`, `backup-v7`: `expected-views.json`; `tools/fixtures/snapshot-compare.ts` | T8R.20 only. |
| Browser helpers | `e2e/support/detail/*.ts` (one file per area), `e2e/d8p/` | Each lane rewrites only its own helper file. |
| Suite tooling | `.claude/scripts/full-suite.sh` (maps `evidence/D08R` to `e2e/d8r`), `tdd.sh`, `lane-setup.sh`, `with-browser-lock.sh`, `run-complete.sh`, `acceptance-commands.sh` | `test:e2e:2`'s `e2e/d8` filter also matches `e2e/d8r`. |

## 5. Working rules

- **Commits.**
  - Commit each finished task locally.
  - The main session's commits end with the attribution lines from the session's system reminder.
  - Subagent briefs say "ending with the trailer your agent instructions specify".
  - **Never push** unless the user asks.
- **Who edits what.** The main session edits only plan, evidence and handoff documents, and does the merging. Every task, bug task and code change goes to a fresh `tdd-task`.
- **Runs.** Lane tiers per task, one complete run per merge batch, and the full tier before every critic (decision 111). Tell the runner to check ports 9341, 9342 and 5175 inside the lock, to send exactly one report only when complete, to run each stage in its own foreground call, and to use a label without a trailing hyphen.
- **ocr reviews.** Every implementation commit gets an `ocr-review`. Only findings ocr itself raises become bug tasks, which run in the same lane. Copy each output to `evidence/D08R/ocr/<task>-<sha>.json`.
- **Subagents.** General-purpose subagents run at medium effort. Don't resume an old subagent. Stop one that keeps resending its hand-back.
- **Git.** Never use bare `git stash`. Don't `git add evidence/D08R` as a whole; add the files you mean.
- **Refer to sections in words**, never with the "§" sign. List each task ID ("T8R.5, T8R.6, T8R.7"), never a range.
- **Asking.** Plain language first, then the context, the options with their tradeoffs, and a recommendation. One question per message; queue the rest (decision 113 as amended).
- **After each merge:** update the Progress row and section 7 of this note, commit, and keep the lanes full.

### Running a whole deliverable

Stop all work and ask the user **only** when:
1. the session lock exists, or a location check in section 1 fails;
2. nothing unblocked remains while a pending decision waits;
3. a fresh critic or a browser can't be provided, or three critics at one checkpoint still leave a FAIL or a high or moderate defect;
4. a merge conflict falls in a file two lanes both own, which section 4.2 says can't happen.

These are pending decisions, asked one at a time while the unblocked lanes keep working (decision 113 as amended):
- the work needs a deviation from `specs/` or the frozen plan, or exposes an ambiguity: a breakdown passage the built code can't meet, a query-count proof that can't keep its request list, a changed frozen view other than T8R.20's, or a screen text no approved word covers;
- a suite failure, critic defect or ocr bug-task fix can't be fixed without such a deviation, or a third ocr round on one task still leaves findings;
- `acceptance-commands.sh` can't exit 0 without a revision.

Everything else continues without the user. Make implementation-level decisions with the recommendation you would have offered, and record them. Reproduce and fix suite failures in fresh subagents. Log first-run passes.

When the gate passes, tag `claude-opus-5.5-d8r` locally. Write `evidence/D08R/final-report.md`, with tasks and commits, each task's fix rounds, flaky tests with the run they flaked in, decisions (answered and pending), critics, and the wall-clock time against the breakdown's estimate (section 3). Remove `.claude/session.lock`. Never push.

## 6. Out of scope

- **D9** and everything later: the replay chart, the replay prototypes and the D9 drafting handoff.
- **The breakdown's follow-ons** (section 10): the Trade Summary line's two-leg form, the Daily Review card's At entry block, two contracts sharing a short name, removing `underlying` from `ConditionReading`.
- **A second browser port**, upgrade tests (decision 76, tech debt item 10), and the other tech debt items.
- **Editing `specs/` or the frozen plan** without an approved revision.
- **Pushing.**

## 7. D8R progress

Task status and commits are in the breakdown's Progress section. This section holds two lists, one bullet per entry.

### Notes for later tasks

- (none yet)

### Open questions

- (none yet)
