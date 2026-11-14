# Handoff: `claude-opus-5.5`, implement D8

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, D8's specifics, the swarm procedure and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-11-14, after plan revision 102.

This session **implements D8, "Backup and Restore"**, under the frozen plan at revision 102. The breakdown is [D08-backup-and-restore.md](D08-backup-and-restore.md):
- 22 tasks (T8.1 to T8.23; T8.16 is withdrawn by decision 76) in three waves with lanes;
- agreed by the user on 2026-10-17 (P29–P35, decisions 33–39), and brought up to date by revision 102: schema 7 (decision 107), the swarm (P103–P105, A225–A228), and the user's answers P106 (Backup only in the wide sidebar, reached from About on narrow screens) and P107 (the first-run button stays "Start my journal");
- run as a **swarm** under **decision 111**, with **decision 113**'s session lock, run order, pending decisions and final report.

Task status lives in the breakdown's Progress section, section 11, which has Wave and Lane columns (decision 100, amended by decision 111).

Where things stand:
- **D08P: complete, tagged `claude-opus-5.5-d08p` (`05b914af`).** After it: bug tasks BUG-4.1 and BUG-4.2 (decision 112), the D08P retrospective's fixes, and revision 102.
- **The last complete cumulative run** is `T8P.BUG-4.2`, at `6c9cb6c7`. It passed:
  - unit: 156 files, 1662 tests (the unit stage now runs the whole `unit` project, tool tests included: 162 files, 1748 tests, `suite-unit-project`);
  - integration: 106 files, 229 tests;
  - browser: 126 in `browser-1` (4.8 min) and 98 in `browser-2` (6.1 min);
  - checks: 14 of 14.
- **No product code or test has changed since `4028908d`.** Later commits changed only `.claude/` tooling and documents, `CLAUDE.md`, `AGENTS.md`, `.gitignore`, `evidence/` and `plan/`.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D08-handoff.md and follow it."*
1. Take the session lock (`implementing.md`, "Start-of-deliverable reading").
2. Run the location checks in section 1.
3. Do the reading in section 2.
4. Print the run order (section 3), then **start the next task(s) at once**. Don't stop to report that the reading is done.

Continue through the gate (T8.22) and the `claude-opus-5.5-d8` tag. Stop only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` (the deliverable branch every lane merges into) |
| Dev server port | `5175`, from the gitignored `.env.local`; the benchmark alone uses `4175` (T8.19) |
| Frozen plan | tag `claude-opus-5.5-plan-r102` (revision 102, decision 113) |
| Code D8 builds on | tag `claude-opus-5.5-d08p` (`05b914af`), plus BUG-4 (`ad6d0189`, `2a95b28b`) |
| D8 starting point | tag `claude-opus-5.5-pre-d08`: the same commit as `plan-r102` |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5`, possibly followed by `[ahead N]`, where N counts the commits not yet pushed. No uncommitted changes. |
| `git log --oneline claude-opus-5.5-pre-d08..HEAD` | At the first session, one commit: "D8 handoff". Afterwards also: only D8 task and merge commits, their evidence and Progress updates, handoff updates, and any approved plan revisions. |
| `git rev-parse 'claude-opus-5.5-plan-r102^{commit}' 'claude-opus-5.5-pre-d08^{commit}'` | The same hash twice. |
| `git rev-parse 'claude-opus-5.5-d08p^{commit}'` | Starts with `05b914af`. |
| `git diff --stat 4028908d claude-opus-5.5-pre-d08 -- src e2e tests tools package.json package-lock.json 'eslint*'` | Empty. |
| `ls .claude/worktrees 2>/dev/null` | Empty or absent at the first session. Afterwards, only this deliverable's lane worktrees. |
| `git rev-parse --git-path hooks` | `.githooks` (the pre-commit typecheck and lint hook) |
| `ocr llm test` | Prints `✓ Connection test successful`. If it fails, ask the user to run `ocr auth login`. |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run --project unit && npx vitest run tests/integration` | 162 files and 1748 tests (unit); 106 files and 229 tests (integration). |

Record the exact Node version in `evidence/D08/provenance.md`.

If any check fails, **stop and ask the user**:
- Don't edit files, create branches or `cd` into another worktree to fix things.
- Don't change the machine's Node installation, and don't proceed on another Node version.

**Never look at any other worktree** under `worktrees/`, or another implementation's branch. The implementations are being compared, and reading another one contaminates the comparison. This includes other sessions' scratch, task-output and Playwright directories, and processes you did not start.
- **The lane worktrees are different.** D8's lane worktrees, under this worktree's `.claude/worktrees/`, belong to this implementation. Never confuse the two.
- **Tags are shared** across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.
- **Hooks.** The PreToolUse hooks in `.claude/settings.json`, `filter-test-output.sh` and `guard-shell-writes.sh`, behave as in D08P.

## 2. How to start

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first, all of it. It holds the session lock, the run order, the single-task procedure (briefs, `ocr-review`, bug tasks, `suite-runner`), "Running a swarm deliverable", "Pending decisions", "Final report" and "Plan revisions and evidence".

The governing instruction is [plan/kickoff.md](kickoff.md). It requires reading two baselines, each scoped to what D8 uses.

**The `specs/` baseline.** Read the ranges in **`plan/spec-reading/D08.md`**, as `implementing.md` says. Search `plan/spec-map.md` (don't read it in full) when the work touches another section, and note it in `evidence/D08/structural.md`.

**The frozen plan (scoped):**
- **`plan/D08-backup-and-restore.md` in full**, which is the work. Section 1.5 holds revision 102's decisions, assumptions and lookups; section 3 the waves, lanes and file ownership.
- **`plan/implementation-plan.md`:** everything except the `## D9` through `## D28` definition sections. That covers:
  - decisions 1–113 (100 as amended by 111);
  - the rules and cumulative obligations;
  - the freeze record;
  - the definitions through D8;
  - the tech debt items.
- **`plan/technology-stack.md`** in full (T8.1 adds `@noble/hashes` and `fflate`).
- **`plan/acceptance-matrix.md`:** the opening sections, and the rows the breakdown's section 8 names.
- **Earlier breakdowns, only these sections** (never their behavioral task text):
  - `plan/D07-single-leg-options-happy-path.md`: sections 1 (with 1.4, the benchmark mix; A121's migrations), 2, 3 and 5;
  - `plan/D07S-option-price-stops-and-targets.md`: A199 and A204 (schema 7 and `workspace-v7/`), and section 4's O-S2 data;
  - `plan/D08P-trade-detail-cockpit.md`: section 9 (the swarm process, decision 111) and section 4.2 (the lane table that D8's section 3.2 follows);
  - `plan/D01-start-a-workspace-and-confirm-a-long-stock-plan.md`: the readiness states, the faults build (T1.27) and the shell copy A13, which A143 replaces;
  - `plan/D02-open-a-long-stock-position.md`: section 11's follow-up F12, which T8.6 carries (the D8 breakdown's status note).
- **`plan/D07-approved-words.md`:** conventions C1–C8. D8's screen words are A143, A144 (as amended by P106), A228 and the case texts.

`specs/` and the frozen plan are read-only. A deviation is a pending decision ("Pending decisions" in `implementing.md`). An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`. The next revision is r103, the next decision is 114, and the breakdown's numbering continues at P108 and A229. Editing the Progress section alone is not a revision.

## 3. D8 specifics

### Setup before the first task

Create `evidence/D08/` with:
- `tdd-log.md`, with the note that its rows are single-case runs (the per-task files go in `tdd-log/`);
- `structural.md`;
- `provenance.md`;
- `DECISIONS-PENDING.md`, with a one-line note that it lists the questions asked of the user, open and answered (decision 113).

Then print the run order: every Progress row with its wave, lane and blocking tasks, from section 3.1's "Blocked by" column (decision 113).

### Wave 0

- **T8.1 ∥ T8.23**, in lanes F and T. T8.23 adds types, skeletons, ports and stubs, and no behavior (A225). Its verification is section 5's row.
- **After both merge, run `npm install` in the main worktree (A226)**, so the next lane worktrees clone a `node_modules` with `@noble/hashes` and `fflate`. `package-lock.json` must not change; if it does, that is T8.1's defect.

### Wave 1

Section 3.1 gives the tasks and blocking edges, section 3.2 the file ownership.

**Agents and order.**
- At most **six `tdd-task` agents at once**. `ocr-review` agents don't count against the cap.
- Start FM (T8.2), PS (T8.3), UB (T8.12) and US (T8.14) at once.
- WB starts T8.4 when T8.2 and T8.3 have merged. WR starts T8.8 when T8.4, T8.6 and T8.7 have merged, and T8.9 when T8.5 has.
- The longest chain is T8.2 → T8.4 → T8.8 → T8.9: merge its tasks first when several are ready.

**Each task** gets a fresh worktree from the deliverable branch's head at dispatch (`isolation: "worktree"`, then `.claude/scripts/lane-setup.sh`). A lane's next task starts once its previous task has merged.
- Before the brief, mark the task's Progress row "In progress from `<head>`".
- Record in `structural.md` the worktree and branch names the Agent tool gives.

**Merging**, merge runs and failures: as `implementing.md`'s "Running a swarm deliverable" says. Mark the row "Done" with the **rebased** hashes. Remove the lane worktree once merged.

**Merge order constraints.** None beyond the blocking edges. The UI lanes build against T8.23's facade double, and the real app shows no Backup destination until T8.11 installs the manifest, so a UI task can merge before the backend.

### Wave 2

1. **T8.11 alone**, after every wave-1 task has merged (P105). It wires the composition root, the export worker (`src/workers/` is new), the host ports and the manifest.
2. **FT (T8.15) ∥ FX (T8.17, then T8.20) ∥ BG (T8.18).**
3. **BR (T8.21)** once T8.15 and T8.17 have merged. It adds `e2e/d8/` to `test:e2e:2` with the first D8 spec. T8.20 may run beside it.
4. **BN (T8.19) alone (A227):** start it only when no lane, merge run or critic is running, and start nothing until it finishes. It uses port 4175.
5. A full-tier run.
6. **The gate, T8.22.**

There is no checkpoint critic (section 1.5's size check).

### Other rules

- **Ports.** Every browser run, wherever it starts, goes through `.claude/scripts/with-browser-lock.sh`. Never run two browser suites outside the lock.
- **Words.** Screens use A143's copy, A144 as amended by P106, A228 and the case texts. The first-run button stays "Start my journal" (P107). Words no row covers are a pending decision.
- **Lane briefs** name the lane, its owned files from section 3.2, the lane's base commit, and the task's breakdown section and assumptions. A task that needs a file outside its lane stops and reports it; that is a pending decision, since it changes section 3.2.
- **What must not change.**
  - Every existing case keeps its expected values, except where section 1.5's lookups name the case and the task. Everywhere else, a changed expected value is a defect.
  - No frozen fixture view changes. `workspace-v7/` is read, never rewritten.
  - `e2e/d2/ui-alignment.spec.ts` keeps `NAV_LINK_COUNT = 5` (P106).
- **Flakes.** A failure in a run that the targeted rerun can't reproduce is a flake. Log it in `structural.md` with the run label and the test, and list it in the final report. A test that flakes twice is reported to the user with the evidence.
- **TDD discipline, clock pinning and mutation builds:** as in D08P.
  - Run each case red, then green.
  - Back out code written before its red.
  - A first-run pass gets the mutation check and is listed under section 7's open questions.
  - Pinned browser cases use `launchAt`, `pinClock` and `setClock` from `e2e/d4/support.ts`.
  - Mutations rebuild `dist-faults` in the worktree they run in.
  - ocr reviews test files in place (`.claude/ocr-rule.json`).
- **Tech debt.** Raise item 11 (the Open list's Ready-state race) with the user if `TradeList.test.tsx:125` fails a run. Don't fix other items unasked.
- **The gate (T8.22).**
  1. Run the full tier with `suite-runner` until it passes.
  2. Run `.claude/scripts/acceptance-commands.sh plan/D08-backup-and-restore.md`, which must exit 0.
  3. Brief a **fresh** `general-purpose` critic (effort medium) from `.claude/docs/critic-brief.md`, with:
     - flows C8.1–C8.10 (C8.9 withdrawn);
     - the future-capability list in the breakdown's section 7;
     - the 390 and 320 px checks, including P106's About link;
     - port 5175 under the lock;
     - no reading of `evidence/` or another worktree.
  4. Save each report with `node tools/agent-report.ts "# D08 critic-<n> report" > evidence/D08/critic-<n>.md`, and add its row to the critic-cost table in `structural.md`.
  5. At most three critics before asking the user.
  6. When the gate passes, mark section 8's acceptance rows covered, and tag `claude-opus-5.5-d8`.

## 4. What is in place

Build on these. Read the code before extending it.

| Piece | Where | Notes for D8 |
|---|---|---|
| Workspace | `src/coordinators/workspace/workspace.ts` (365 lines, `createWorkspace`, `getStatus` :243, `initialize` :275), `migration.ts`, `capabilities.ts`, `index.ts` | T8.23 adds `backup.ts` and `restore.ts` skeletons and delegating methods; T8.10 alone edits `getStatus` and `initialize`. |
| Facade and composition | `src/app/compose.ts` (`UiFacade`, `FACADE_GROUPS`), `src/app/types.ts`, `src/app/routes.ts` (the navigation map, gated by installed capabilities) | T8.23 adds the types; T8.11 the facade operations and ports; T8.14 the Backup route. |
| Host ports | `src/delivery/host.ts`, `browser-host.ts`; NodeTestHost in `tests/integration/d1/support.ts` | T8.23 adds the download and file-selection port types and NodeTestHost's ports; T8.11 the browser ones. |
| Faults | `src/delivery/faults.ts`; `tools/verify-no-fault-hooks.ts` | T8.15. |
| Fact modules | `src/modules/trade-record/`, `journal/`, `market-data/`, `reference-catalog/` (each with `index.ts` and `section.ts`) | T8.2, T8.6. |
| Persistence | `src/persistence/` | T8.3, T8.7. |
| Shell and first run | `src/ui/AppShell.tsx` (A13's copy at :58; both blocked views at :148–276; layout at :385, :453), `src/ui/screens/FirstRun.tsx` (:56), `src/ui/StorageProtectionCard.tsx`, `PageTitle.tsx` (:19), `readiness-copy.ts`, `src/ui/screens/AboutView.tsx` | T8.14. Section 1.5's lookups list the expectations that change. |
| Fixtures | `tests/fixtures/workspace-v1/` to `workspace-v7/`; `tools/fixtures-freeze.ts`, `verify-fixtures.ts` (decision 112's check reads `workspace-v<n>` only) | T8.17 adds `backup-*` and `fixtures:freeze-backup`. |
| Benchmark | `src/app/bench-generator.ts`, `tools/bench-generate.ts`, `bench-run.ts`, `measure-capacity.ts`, `verify-capacity.ts` | T8.18, T8.19 (`bench:setup` is new). |
| Suite tooling | `.claude/scripts/full-suite.sh` (maps `evidence/D08` to `e2e/d8`), `tdd.sh`, `run-complete.sh`, `acceptance-commands.sh`, `lane-setup.sh`, `with-browser-lock.sh` | `test:e2e:2` gains `e2e/d8` in T8.21. |

## 5. Working rules

- **Commits.**
  - Commit each finished task locally.
  - The main session's commits end with the attribution lines from the session's system reminder.
  - Subagent briefs say "ending with the trailer your agent instructions specify".
  - **Never push** unless the user asks.
- **Who edits what.** The main session edits only plan, evidence and handoff documents, and does the merging. Every task, bug task and code change goes to a fresh `tdd-task`.
- **Runs.** Decision 111: lane tiers per task, one complete run per merge batch with `browser-auto`, and the full tier before every critic. A `suite-runner` brief gives only the evidence folder, the run label and the browser stage.
- **ocr reviews.** Every implementation commit gets an `ocr-review`. Only findings ocr itself raises become bug tasks, which run in the same lane. Copy each output to `evidence/D08/ocr/<task>-<sha>.json`, and record the result at once.
- **Subagents.**
  - General-purpose subagents run at medium effort.
  - Don't resume an old subagent. Stop one that keeps resending its hand-back.
- **Never use bare `git stash`.**
- **Refer to sections in words**, never with the "§" sign. Say "Mark", never "close", for a session's closing price.
- **Asking.** Plain language first, then the detail. One decision per message, with options and a recommendation, in an ordinary message (decision 113).
- **After each merge:** update the Progress row and section 7 of this note, commit, and keep the lanes full.

### Running a whole deliverable

**Stop completely** and ask the user only when:
1. the session lock exists, or a location check in section 1 fails;
2. a fresh critic or a browser can't be provided, or three critics still leave a FAIL or a high or moderate defect;
3. nothing unblocked remains while decisions are pending.

**Ask, record and keep going** (decision 113, `implementing.md`'s "Pending decisions") when:
- the work needs a deviation from `specs/` or the frozen plan, or exposes an ambiguity. This includes a breakdown passage the built code can't meet, a changed frozen view, a screen text no approved word covers, or a file outside a task's lane;
- a suite failure or critic defect can't be fixed without such a deviation;
- an ocr bug-task fix needs a deviation, or a third round on one task still leaves findings;
- `acceptance-commands.sh` can't exit 0 without a revision;
- a merge conflict falls in a file two lanes both own, which section 3.2 says can't happen.

Pause only the task, the tasks blocked by it and the later tasks in its lane. Never decide the question yourself, and never change a plan test to get past it.

Everything else continues without the user. Make implementation-level decisions with the recommendation you would have offered, and record them. Reproduce and fix suite failures in fresh subagents. Log first-run passes and flakes.

When the gate passes, tag `claude-opus-5.5-d8` locally. Write `evidence/D08/final-report.md` (`implementing.md`'s "Final report"), with:
- tasks and commits, and each task's fix rounds (ocr bug-task rounds and suite-failure fixes);
- flaky tests, with the runs they flaked in;
- decisions pending and answered;
- flagged items and critics;
- the wall-clock time against the estimate (about 10 hours, section 1.5).

Then remove `.claude/session.lock`. Never push.

## 6. Out of scope

- **D9** and everything later, including trade replay beyond D08P's slice, multi-leg Strategies, the Pricing Provider, Stop Discipline, correcting or Voiding facts, reference management and reports.
- **Upgrade tests** (decision 76, tech debt item 10): T8.16, B8.12 and C8.9 stay withdrawn.
- **A second browser port.**
- **Pushing, the retrospective and D9's handoff**, unless the user asks.
- **The other tech debt items**, and editing `specs/` or the frozen plan without an approved revision.

## 7. D8 progress

Task status and commits are in the breakdown's Progress section. This section holds two lists, one bullet per entry.

### Notes for later tasks

- **For T8.4, T8.5, T8.8, T8.9:** `backup.ts` and `restore.ts` take their own deps interfaces (`BackupDeps`, `RestoreDeps`), which `WorkspaceDeps` satisfies structurally (T8.23). A dependency `WorkspaceDeps` lacks would mean editing `workspace.ts`, outside lanes WB and WR: a pending decision. The migration code calls the fact modules' section functions directly, which these lanes can do too.
- **For T8.2, T8.4, T8.6, T8.8, T8.17 (the user's direction, 2026-11-14: the format must carry multi-leg option Trades, which D10 adds soon after D8):** keep every backup and Restore path leg-generic. A stored Trade is one document whose `facts` list holds any number of `PlannedLeg`, Execution and settlement facts, each with its own Instrument. Export it as stored, never flattened to one leg or one Instrument; count Planned Legs, Executions and Instruments by iterating, never by `[0]`; derive the capability footprint from the records; and in the strict schema-7 record schemas, validate `facts` as a list of fact kinds with no leg-count limit. Any rule about how many legs a Strategy has belongs to the section validators and `assessPlan` (decision 88), which D10 changes, never to the artifact or its record schemas. D10's schema change then adds only its new fact kinds and fields, its layout entry, its footprint identifiers and `backup-v8/` (the review queue's "Raised by the D8 breakdown", item 1).
- **For T8.4, T8.5, T8.8:** T8.1's reader yields the manifest line only after the rest of the stream has drained clean (T8.1-B1), and record lines are never parsed by the reader (`{"r":` prefix).
- **For T8.2, T8.4, T8.6, T8.7, T8.8, T8.17 (Q3, the user's answer of 2026-11-14):** the per-record `revision` write stamp is not exported. The export projection removes it from every record, the manifest's `exclusions` names it, and Restore stamps records at the new database's revision 1, as the migration copy does. Journal entries' and declines' top-level `anchorTradeId` is exported as stored.
- **For T8.4 (from T8.3):** look the layout up with `exportLayoutFor(storedVersion)` and report `UnknownLayout` yourself when it returns nothing. `readExportSnapshot` opens its own connection by database name and returns every `meta` record. T8.2 and T8.4 pick the Workspace-section fields from them.
- **For T8.11 (from T8.14):** T8.14 merges with T8.11 in one batch, because its Backup route fails `verify:capabilities` until the manifest installs the four operations. Create T8.11's lane from `d08/us` rebased onto the main branch. Wire `screens.backup`, `AppShellProps.backup`, `selectFile`, `onWorkspaceReplaced` (over the BroadcastChannel) and `FirstRun`'s `restore`. After a first-run Restore, refresh the shell, since `RestoreFlow` has no completion callback.
- **For T8.11:** `src/workers/` doesn't exist yet. The worker chunks must appear in the Offline Release Inventory (`verify:release`). The bottom bar keeps five links.
- **For T8.17, T8.19:** `fixtures:freeze-backup` and `bench:setup` don't exist yet; each task adds its script to `package.json`. Three wave-2 lanes add one script line each, which git merges.
- **For T8.21:** no existing Playwright filter matches `e2e/d8/` (`e2e/d8p` doesn't), so add `e2e/d8` to `test:e2e:2` with the first spec.

### Open questions

- First-run pass, T8.1: "should accept records pushed one at a time" (mutation-checked).
- First-run pass, T8.23-B1: the added guard "should reject an unconfigured operation with the operation name" (mutation-checked).
- Q1 (T8.12's words): answered 2026-11-14, table approved as written; to be carried into revision r103 (`evidence/D08/DECISIONS-PENDING.md`).
- First-run pass T8.7-B2 ("should delete this session earlier Restore candidate database when a new one is listed"): a test-gap bug task whose behavior T8.7 had built; mutation-checked (`evidence/D08/tdd-log/T8.7-B2.md`).
- Q2 (the Restore flow's words, T8.12's and T8.14's remaining states): answered 2026-11-14, (a) approved as written; to be carried into r103.
- Q3 (the per-record write stamp): answered 2026-11-14, (a) not exported; refines A125; to be carried into r103.
