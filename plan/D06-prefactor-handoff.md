# Handoff: `claude-opus-5.5`, implement the D6 prefactor

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, the prefactor's specifics, and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-11-01, after the user agreed the prefactor's breakdown. The prefactor is not one of the numbered deliverables. Plan revision 30 (decision 71) inserted it between D5R2 and D6, after the user reviewed a report on the browser suite and approved five of its six recommendations.

This session **implements the D6 prefactor, "a leaner browser suite"**, under the frozen plan at revision 30. The breakdown is [D06-prefactor-browser-tests.md](D06-prefactor-browser-tests.md). The user agreed all of it on 2026-11-01: P55–P62 and A177–A180.

The prefactor changes browser tests, test tooling and process documents only. **No file under `src/` changes.**
1. **Two browser tiers** (P55): after a task, `full-suite.sh` runs either the task tier (5 tests tagged `@every-task`, plus the current deliverable's `e2e/` folder) or the full suite. It chooses from the files the task changed.
2. **Release-history tests** (P56): B2.3, B2.5 and B4.7 upgrade between two frozen tag builds. They are tagged `@release-history` and leave the routine run.
3. **`ui-alignment.spec.ts`** (P57): its 41 looped copies become 17 tests, keeping every assertion except one listed duplicate.
4. **Two trims** (P59): B1.5 runs 2 fault sets instead of 6, and T2.55-B3 is removed.
5. **Process documents** (T6P.5): the implementing guide, the suite runner, the drafting guide, and the user's full-suite-runs memory.

Where things stand:
- **D5R2:** complete and tagged `claude-opus-5.5-d5r2` (`765ac1e`).
- **Code:** unchanged since the last complete cumulative run at `ccff276`, which passed 1051 unit, 117 integration and 179 browser tests and 12 of 12 checks (`evidence/D05R2/structural.md`). Since then only plan, evidence and handoff documents have changed.
- **D6:** not started. Its handoff, [D06-handoff.md](D06-handoff.md), says this prefactor runs first, and that D6 starts from the tag this session creates at its end.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D06-prefactor-handoff.md and follow it."*
1. Run the location checks in section 1.
2. Do the reading in section 2.
3. **Start the next step in section 7 at once**, without stopping to report that the reading is done.

Continue task by task through T6P.6 and the closing steps in section 5. Stop only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` |
| Dev server port | `5175`, from the gitignored `.env.local`; the benchmark uses `5181` |
| Frozen plan | tag `claude-opus-5.5-plan-r30` (revision 30) |
| D5R2 release | tag `claude-opus-5.5-d5r2` (`765ac1e`) |
| Prefactor starting point | tag `claude-opus-5.5-pre-d6p` (the commit that added this note) |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5 [ahead N]`. N counts the commits since `claude-opus-5.5-pre-d6c`, the last pushed commit, and grows with each prefactor commit. No uncommitted changes, except the untracked `.claude/settings.json`: it is the user's own file, expected, and **never staged**. |
| `git log --oneline claude-opus-5.5-pre-d6p..HEAD` | Empty at the first session. Afterwards, only prefactor task commits and their evidence and handoff updates, ending with the commit section 7 names as the last commit. |
| `git tag --list 'claude-opus-5.5-*'` | Includes `claude-opus-5.5-plan-r30`, `claude-opus-5.5-d5r2` and `claude-opus-5.5-pre-d6p`. |
| `git rev-parse 'claude-opus-5.5-d5r2^{commit}'` | `765ac1ea59f36e7d9923362f655c94bbef90e404` |
| `git diff claude-opus-5.5-d5r2 -- src` | Empty, now and at every step of the prefactor. |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run src && npx vitest run tests/integration` | Every test file and test passes: 80 files and 1051 tests (unit), and 60 files and 117 tests (integration). The browser suite (`npm run test:e2e`, D1 to D5R) had 179 passing. |

About Node: it comes from Homebrew and isn't pinned there, so a later 26.x is fine. Record the exact version in `evidence/D06P/provenance.md`.

If any check fails, **stop and ask the user**. In particular:
- Do not edit files, create branches, or `cd` into another worktree to fix things.
- Do not change the machine's Node installation, and do not proceed on another Node version.
- Leave the global TypeScript (7.0.2) alone. The project gets its versions from `package.json`.

**Never look at any other worktree** or another implementation's branch, such as `backup/codex-*`. The implementations are being compared, and reading another one contaminates the comparison. This includes:
- other sessions' scratch, task-output and Playwright directories;
- processes you did not start. Other worktrees' preview servers run on other ports; leave them alone.

Git tags are shared across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.

The worktree's `.claude/settings.local.json` sets `"syncClaudeAiPlugins": false`, so synced claude.ai plugins are intentionally absent. It also registers two PreToolUse hooks on Bash, whose scripts are tracked in `.claude/hooks/`:
- `filter-test-output.sh` cuts single-case test output to failures and the summary.
- `guard-shell-writes.sh` refuses `sed -i`, `perl -i`, redirects, here-docs and `tee` into any tracked path outside `evidence/`, and inline node or python that writes files.

The project's skills are vendored in `.agents/skills/`, linked from `.claude/skills/`.

## 2. How to start

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first. It sets how this session orchestrates:
- the scoped reading below;
- delegating each task to the `tdd-task` subagent, and writing its brief;
- the `ocr-review` run, and bug tasks, after each task;
- recording `suite-runner` runs.

The governing instruction is [plan/kickoff.md](kickoff.md). Follow it exactly. It requires reading two baselines, each scoped to what the work uses, as decision 45 directs.

**The `specs/` baseline (scoped, decision 71).** The prefactor changes no product behavior, so it reads only the spec passages that govern testing:
- `specs/evaluation/planning-protocol.md`: the sections on automated tests, mock-free integration tests, and the independent browser-critic gate. Find them through `plan/spec-map.md`.
- The acceptance rows whose browser evidence the prefactor touches: AC-DEL-003 (it cites B2.3, B4.7 and B5.6) and AC-DEL-004 (it cites B1.5 and its two-fault cases). Look them up by ID in `plan/acceptance-matrix.md`, then read the clauses they cite.

Search `plan/spec-map.md` for anything else the work touches, and read that section before building on it. Note any such section in `evidence/D06P/structural.md`.

**The frozen plan (scoped):**
- **`plan/implementation-plan.md`:**
  - decisions 19 (Chromium tiers and RC), 65 and 68 (the browser card helpers), 70 (D6's previous release) and 71 (this prefactor);
  - the freeze record;
  - the D6 prefactor's definition;
  - tech debt item 6.
- **`plan/D06-prefactor-browser-tests.md`:** in full. This is the work.
- **`plan/D01-start-a-workspace-and-confirm-a-long-stock-plan.md`:** section 6.2, rows B1.1, B1.3–B1.6, and the amendment note on B1.5.
- **`plan/D02-open-a-long-stock-position.md`:** section 6.2, rows B2.3–B2.6, and their amendment notes.
- **`plan/D02-ui-alignment.md`:** section 1 (authority, and "Accessible names stay stable"), the tasks whose browser cases T6P.4 collapses (T2.37-B1, T2.38, T2.40, T2.55, T2.60, T2.62, T2.67), and the amendment notes decision 71 added.
- **`plan/D04-daily-review.md`:** section 6.2, row B4.7, and its amendment note.
- **`plan/D06-close-a-long-stock-position.md`:** T6.21's and T6.27's structural rows and section 10, with decision 71's notes. These are what D6 inherits from the prefactor.
- **`plan/technology-stack.md`:** "Pinned versions" (Playwright 1.63.0, A177).

`specs/` and the frozen plan are read-only. T6P.5's process documents (`.claude/docs/`, `.claude/agents/suite-runner.md`, the user's memory) are not part of the plan. The main session edits them, under the breakdown's direction. If implementation needs a deviation:
1. Stop before making it.
2. Name the affected specification passages, acceptance scenarios and durable compatibility.
3. Ask for approval to revise the plan.

An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`. The next revision is r31 and the next decision is 72.

## 3. Prefactor specifics

- **Setup before T6P.1:** create `evidence/D06P/` with:
  - `tdd-log.md`, with its note that rows are single-case runs (`tdd.sh` refuses to run without it, and maps `T6P.n` to this folder);
  - `structural.md`;
  - `provenance.md`.
  The `suite-runner`, `ocr-review` and `tdd-task` briefs take `evidence/D06P` as the evidence directory.
- **Order.** T6P.1 through T6P.6, one at a time, in the breakdown's task-graph order. T6P.1 to T6P.4 are structural tasks for fresh `tdd-task` subagents; their briefs give each task's "Verification (exact)" list as the pass condition. T6P.5 is the main session's. T6P.6 is three `suite-runner` runs.
- **Code pointers.** Give each brief these pointers rather than having the subagent search. Line numbers are as of `claude-opus-5.5-pre-d6p`.
  - **Playwright setup:** `playwright.config.ts` (one Chromium project, `workers: 1`). The extended `test` is `e2e/d1/support.ts:21` (`base.extend`), re-exported by the later `support.ts` files.
  - **Scripts:** `package.json`: `test:e2e` builds `dist-faults` and the release folders, then runs `playwright test e2e/d1 e2e/d2 e2e/d4 e2e/d5 e2e/d5r`. `.claude/scripts/full-suite.sh` has the stages `unit`, `integration`, `browser` and `checks`.
  - **T6P.1's tags:**
    - `@every-task`: `e2e/d1/identity.spec.ts` (the B1.1 describe, both cases), `e2e/d1/plan.spec.ts:37` (B1.3), `e2e/d1/offline.spec.ts:4` (B1.4), `e2e/d1/recovery-only.spec.ts:4` (B1.6).
    - `@release-history`: `e2e/d2/migration.spec.ts:47` (B2.3), `:122` (B2.5), and `e2e/d4/update.spec.ts:6` (B4.7).
    - B2.4 (`:86`) and B2.6 (`:170`) are **not** tagged: they migrate D1 data into the current `dist-faults` build.
  - **T6P.3:** B1.5's fault-set list is in `e2e/d1/readiness.spec.ts` (the loop at line 5). T2.55-B3 is `e2e/d2/ui-alignment.spec.ts:1363`; the unit case that replaces it is `src/ui/screens/TradeDetail.test.tsx:123`.
  - **T6P.4:** the looped bodies in `e2e/d2/ui-alignment.spec.ts` start at:
    - T2.60: 132 and 211;
    - T2.37-B1: 301;
    - T2.38: 383 and 396;
    - T2.40: 578 and 591;
    - T2.55-B4: 1382; T2.55-B5: 1409; T2.55-B6: 1427;
    - T2.62: 1520, 1597, 1612 and 1630;
    - T2.67: 1810, 1844 and 1887.
    The header height check that P57 keeps at 1280 only is in T2.62's first body (around line 1536). T2.62's Detail case (around line 1547) is the model of a body that loops over widths inside one test.
- **Mutation checks on `ui-alignment` cases.** That file measures `dist-faults` (its first line says so). A mutation of a CSS rule must rebuild that folder (`npm run build:faults`) before the run, and again after restoring. A plain `vite build` leaves the served build unchanged, so the mutation would "pass" (D5's T5.24-B1). The same applies to `dist-releases/d5` for cases that serve the current release: `TJ_BUILD_LABEL=d5 npx vite build --outDir dist-releases/d5 --emptyOutDir`.
- **ocr on test-only commits.** `ocr` excludes test files, so a commit that only changes tests reviews almost nothing in place. Brief the `ocr-review` agent to recreate the commit in a scratch clone (in its own scratch directory, never in the worktree), with the test files relocated under `src/itg/d06p/` as plain `.ts`, and the `support.ts` files copied alongside in the parent commit. Findings caused only by the relocation (import paths, suite discovery) are dismissed as relocation artifacts. A commit that changes `package.json` or `full-suite.sh` is reviewed in place. Every `ocr-review` brief names the task's breakdown section as background.
- **Counts to expect** (breakdown section 3):

  | After | Routine browser tests (`npm run test:e2e`) |
  |---|---|
  | T6P.1 | 176, plus 3 `@release-history` |
  | T6P.3 | 171 |
  | T6P.4 | 147 |

  A different count means a tag, a grep or a loop is wrong. Find out why before going on.

## 4. What is in place

- **Browser suites:** `e2e/d1`, `d2`, `d4`, `d5` and `d5r`, with the card helpers in `e2e/d4/support.ts` (decisions 65 and 68). `e2e/smoke/` is RC's engine-capability probe; it is outside `test:e2e` and stays outside both tiers (A179).
- **Node suites:** `src` (unit) and `tests/integration/d1` to `d5r`. The prefactor changes neither.
- **The release harness:** `tools/build-releases.ts` builds `d1`, `d2` and `d4` from their tags, and `v1`, `v2`, `v2-corrupt` and `d5` from the current source. `tools/release-server.ts` serves one folder at a time on port 5175.
- **The suite runner:** `.claude/agents/suite-runner.md` and `.claude/scripts/full-suite.sh`. Each stage is one foreground call (tech debt item 6). The runner never backgrounds a stage or polls for it.

## 5. Working rules

- **Commits.** Commit each finished task locally. The main session's commits end with the attribution lines from the session's system reminder. **Subagent briefs say "ending with the trailer your agent instructions specify"** and never dictate a model name. **Never push** unless the user asks.
- **Who edits what.** The main session edits only plan, evidence and handoff documents, plus T6P.5's process documents. Every change under `e2e/`, `package.json` and `.claude/scripts/` goes to a fresh `tdd-task` subagent.
- **Edit tool only.** Briefs tell subagents to use the Edit tool only, never `sed -i`, here-docs, `printf >>`, `cat >>`, or node or python edit scripts. This includes temporary mutations. `guard-shell-writes.sh` refuses most of these, but it reads command text only, so check each report and record any slip.
- **Exit codes.** Briefs ask subagents to capture exit codes one command at a time. In zsh, a loop over a quoted command list fails with exit 127 for every command.
- **Cumulative runs.** End every task with a complete cumulative run, delegated to `suite-runner` and recorded in `evidence/D06P/structural.md`, with outputs in `evidence/D06P/suite-runs/`.
  - **Tier:** every prefactor task touches `e2e/`, `package.json` or the suite tooling, so every run is the full tier: the `browser` stage before T6P.2 lands, and `browser-auto <base>` after it (it should choose `full`; record its reason).
  - **Scope:** unit, integration and browser suites, plus the 12 static and verify checks, as four foreground stages.
  - **Brief:** tell the runner to leave no wait loop running, to check ports 9341, 9342 and 5175 before and after a run, and to use a label without a trailing hyphen.
- **ocr reviews.** Every implementation commit gets an `ocr-review` run (section 3 for test-only commits). **Findings become bug tasks automatically**, as `.claude/docs/implementing.md`, "After each task", says.
  - **Valid or Doubtful finding with a failure scenario:** it becomes `<task>-B<n>`, fixed in a fresh `tdd-task` subagent and reviewed again, one at a time.
  - **Wrong finding, or one with no failure scenario:** dismissed, with its reason in `structural.md`.
  - **Raw output:** copy each `ocr.json` to `evidence/D06P/ocr/<task>-<sha>.json`.
- **Background work.** An `ocr-review` alongside the next task is fine. Never run two browser suites at once: they share port 5175.
- **Subagents.** A finished subagent that keeps resending its hand-back is stopped with TaskStop. Don't resume an old subagent; start a fresh one.
- **Never use bare `git stash`.** Use a WIP commit, or a tagged stash applied by SHA.
- **Section references.** Refer to document sections in words, never with the "§" sign.
- **Asking.** Lead with a recommendation and its tradeoff. Ask **one consequential decision at a time**, in prose, with enough context that the question stands on its own.
- **After each finished task:** commit it, record its cumulative run, update section 7 of this note, commit that, and **start the next task**.

### Running a whole deliverable

The goal is to complete the prefactor from one prompt (user's direction, 2026-10-21). Stop and ask the user **only** when:
1. a location check in section 1 fails;
2. the work needs a deviation from `specs/` or the frozen plan, or exposes a spec or plan ambiguity;
3. a task would change any file under `src/`, or any browser assertion other than P57's one removal and P59's two trims;
4. a collapsed `ui-alignment` body can't keep an assertion's matcher, value and message, or a count in section 3 can't be reached;
5. a suite failure can't be fixed by a fresh subagent without such a deviation;
6. a bug-task fix for an `ocr-review` finding needs a spec or plan deviation, or a third round of bug tasks on the same task still leaves findings.

Everything else continues without the user:
- **Implementation-level decisions:** make them with the recommendation you would have offered, and record them in the evidence and in section 7.
- **Suite failures:** reproduce each with one targeted run, delegate the fix to a fresh subagent, and rerun the suite. Rerun a single browser failure once alone before treating it as real, and record both outcomes.
- **ocr findings:** handle them as the working rules describe.
- **Context growth:** compaction is automatic. Section 7, updated after every task, is the recovery point.

**When T6P.6 passes** (P61: no critic, no release tag):
1. Update [D06-handoff.md](D06-handoff.md) where it names this prefactor's results:
   - section 1's browser counts: 147 in `npm run test:e2e`, plus 3 in `npm run test:e2e:release-history`;
   - the commit it names as the starting point;
   - section 7's "Last commit".
2. Commit that, and create the local tag `claude-opus-5.5-pre-d6d` on the commit. D6 starts from it.
3. Stop with a final report:
   - tasks and commits;
   - every flagged item;
   - decisions made along the way;
   - the measured times: the full tier, the task tier, and the `ui-alignment` file before and after.

Never push.

## 6. Out of scope

- **Product code:** anything under `src/`.
- **Recommendation 6** of the browser-suite review (cumulative guarantee specs): dropped by the user (P60). Every guarantee test stays in its deliverable's folder.
- **Other test changes:**
  - folding any other browser tests together;
  - adding tags beyond P55's and P56's;
  - converting T2.55-B5 to a unit test (P59);
  - parallel Playwright workers.
- **D6:** none of its tasks. Tagging B5.6 `@release-history` belongs to D6's T6.21 (P56).
- **Tech debt items 1–5.** Item 6 gets the note decision 71 added, and nothing more.
- **Plan edits:** editing `specs/`, or editing the frozen plan without an approved revision.

## 7. Prefactor progress

Update this section at the end of each task.

| | |
|---|---|
| Tasks done | Setup (`9b93ca7`: `evidence/D06P/` and the location checks). **T6P.1** (`c7ba533`, base `9b93ca7`): 5 `@every-task`, 3 `@release-history`, 176 routine; ocr no findings; cumulative run passed (1051, 117, 176 in 7.4 min, 12 of 12). **T6P.2** (`50a24f7`, base `0dde16c`), with bug tasks B1 `73387a7` (non-ASCII paths), B2 `8834b52` (renames), B3 `18b3f01` (current folder quoted); all ocr reviews clean after the fixes; cumulative run passed, full tier (1051, 117, 176 in 7.4 min, 12 of 12). **T6P.3** (`7670ff7`, base `a9ef841`): B1.5 runs `diagnostic` and `control,inventory`; T2.55-B3 removed; `ui-alignment` 69 tests, 257 `expect(` lines; relocated ocr review no findings; cumulative run `browser-auto a9ef841` chose full (`e2e/d1/readiness.spec.ts`), 1051, 117, 171 in 7.2 min, 12 of 12. **T6P.4** (`3cd7ffd`, base `4c1884b`): 17 collapsed bodies, `ui-alignment` 45 tests, 257 `expect(` lines (the removed check is now `if (width === 1280)`), file 2.1 min before and about 96 s after (three runs: 96.2, 95.7, 97.9 s), both mutation checks failed at every width; relocated ocr review no findings; cumulative run `browser-auto 4c1884b` chose full (`e2e/d2/ui-alignment.spec.ts`), 1051, 117, 147 in 6.8 min, 12 of 12. **T6P.5** (`725b6e4`, base `332f44f`): implementing guide, suite runner, drafting guide and the user's memory, each citing P55 or P56; no ocr (documents only); cumulative run full tier (`--choose-tier` printed `task`), 1051, 117, 147 in 6.6 min, 12 of 12. |
| Next step | **T6P.6 Gate runs** (three `suite-runner` runs), then the closing steps in section 5. |
| Last commit | the commit that records T6P.5's run and this update (`docs(evidence): T6P.5 cumulative run`) |
| Open questions | For the final report: (1) T6P.1's ocr review covered only `package.json`; ocr excludes the tagged spec files, whose change is a `{ tag }` option only. (2) The harness moves a foreground Bash call to the background after 180 s, so long browser runs end with a completion notice (no polling was used). (3) Decision: P55's path list doesn't include `.claude/scripts/` or `.claude/docs/`, so `--choose-tier` picks `task` for T6P.2's and T6P.5's runs; following this note's "every run is the full tier", those runs use the `browser` stage and record what `--choose-tier` printed. P55's list is unchanged. (4) T6P.2-B3's red run with a metacharacter executed a `touch` in the repository root (three stray untracked files, removed, confirmed gone). |
