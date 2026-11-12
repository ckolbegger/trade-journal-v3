# Handoff: `claude-opus-5.5`, implement D7S

> **Read [plan/kickoff.md](kickoff.md) first.** The text in its code block is your governing instruction: treat it as if the user had given it to you as your prompt, and follow all of it. This note adds the location checks, D7S's specifics, what the D7S prefactor left in place, and the working rules. If this note and the kickoff ever disagree, the kickoff wins.

Written 2026-11-11, after plan revision 79. [D07SP-handoff.md](D07SP-handoff.md) is the record of the prefactor's session; its section 7, the prefactor breakdown's Progress section and `evidence/D07SP/final-report.md` list every prefactor task, commit, decision and flagged item.

This session **implements D7S, "Option-price Stops and Targets"**, under the frozen plan at revision 79 (revision 78's breakdown plus revision 79's acceptance-matrix links). The breakdown is [D07S-option-price-stops-and-targets.md](D07S-option-price-stops-and-targets.md): 17 tasks (T7S.1 to T7S.17), agreed by the user on 2026-11-11 as decision 107, with P90–P93 agreed as recommended, the words in its section 1.6 approved (W4 in the user's own words), and one breakdown with a checkpoint critic (T7S.12) in place of a split. Task status lives in the breakdown's Progress section (decision 100).

Where things stand:
- **D7S prefactor:** complete, tagged `claude-opus-5.5-d7sp` (`27970527`). Its gate run (`t7sp-15-full`) passed 1481 unit, 202 integration and 184 browser tests (119 in `browser-1`, 65 in `browser-2`), with 14 of 14 checks. Tech debt item 22 records T7SP.14's accepted slowdowns.
- **Revision 78** (`0c679938`, tag `claude-opus-5.5-plan-r78`) added the D7S breakdown and amended D7's A100, D7's approved words (rows 19.9, 19.10, 19.23, 23.17), D8's breakdown (a schema-7 note) and the plan's open questions. It changed no code.
- **Revision 79** (`d28fb444`, tag `claude-opus-5.5-plan-r79`, no decision) linked D7S's section 8 in the acceptance matrix where D7S adds coverage: AC-CALC-003 (single-leg structure-value conditions; its "Later" note now leaves only multi-leg structures to D10) and AC-REST-004 (schema 7). D7S's other rows only re-prove existing claims and stay in its breakdown.
- Neither revision is pushed.

**Starting a session.** The user starts a session with one prompt: *"Read plan/D07S-handoff.md and follow it."*
1. Run the location checks in section 1.
2. Do the reading in section 2.
3. **Start the next task at once**: the first row of the breakdown's Progress section not marked "Done". Don't stop to report that the reading is done.

Continue task by task through the gate (T7S.17) and the `claude-opus-5.5-d7s` tag. Stop only for the conditions in section 5, "Running a whole deliverable".

## 1. Confirm the location before anything else

The repository hosts several independent implementations of the same spec, each in its own git worktree under `worktrees/`. This work belongs **only** to:

| | |
|---|---|
| Worktree path | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| Branch | `claude-opus-5.5` |
| Dev server port | `5175`, from the gitignored `.env.local`; the benchmark uses `4175` (`tools/bench/profile.ts`) |
| Frozen plan | tag `claude-opus-5.5-plan-r80` (revision 80, decision 108's run order; the breakdown was agreed at `claude-opus-5.5-plan-r78`, and revision 79 linked its matrix rows) |
| Code D7S builds on | tag `claude-opus-5.5-d7sp` (`27970527`) |
| D7S starting point | tag `claude-opus-5.5-pre-d7s` (the commit that brought this note up to revision 79) |

Run these checks. Each one must match:

| Command | Expected |
|---|---|
| `git rev-parse --show-toplevel` | `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5` |
| `git branch --show-current` | `claude-opus-5.5` |
| `git status -sb` | `## claude-opus-5.5...origin/claude-opus-5.5 [ahead N]`. At the first session N is 63 (the prefactor's commits, revisions 78 and 79, and this note's two commits), unless the user has pushed since; afterwards N also counts D7S's commits. No uncommitted changes. `.claude/settings.json` is committed, holding the project's permissions and the PreToolUse hook registrations; only the user edits it. |
| `git log --oneline claude-opus-5.5-pre-d7s..HEAD` | Empty at the first session. Afterwards, only D7S task commits, their evidence and Progress updates, handoff updates, and any approved plan revisions. |
| `git tag --list 'claude-opus-5.5-*'` | Includes `claude-opus-5.5-d7sp`, `claude-opus-5.5-plan-r78`, `claude-opus-5.5-plan-r79` and `claude-opus-5.5-pre-d7s`. |
| `git rev-parse 'claude-opus-5.5-d7sp^{commit}'` | `27970527be8a04fba56f22676afe54a5c8b2af4a` |
| `git rev-parse 'claude-opus-5.5-plan-r78^{commit}'` | `0c679938d93a96c3d90d9fd62286376d232b1f38` |
| `git rev-parse 'claude-opus-5.5-plan-r79^{commit}'` | `d28fb44450aa3e320eec3c5a6ba3c7a1977c7519` |
| `git diff --stat claude-opus-5.5-d7sp claude-opus-5.5-pre-d7s -- src e2e tests tools package.json 'eslint*'` | Empty: no product code, test suite or tooling changed after the prefactor's gate. |
| `git rev-parse --git-path hooks` | `.githooks` (the pre-commit typecheck and lint hook; the setup commands are at the top of `.githooks/pre-commit`) |
| `ocr llm test` | Prints `✓ Connection test successful`. If it fails, ask the user to run `ocr auth login` (`.claude/docs/implementing.md`). |
| `grep DEV_PORT .env.local` | `DEV_PORT=5175` |
| `node --version` | `v26.x`, at or above `v26.12.0` (decision 43) |
| `npm ci && npx vitest run src && npx vitest run tests/integration` | Every test file and test passes: 125 files and 1481 tests (unit), and 97 files and 202 tests (integration), as at the prefactor's gate. The full browser tier had 184 passing (`browser-1` 119 in 4.8 min, `browser-2` 65 in 4.1 min). The checks stage runs 14 checks. |

About Node: it comes from Homebrew and isn't pinned there, so a later 26.x is fine. Record the exact version in `evidence/D07S/provenance.md`.

If any check fails, **stop and ask the user**. In particular:
- Do not edit files, create branches, or `cd` into another worktree to fix things.
- Do not change the machine's Node installation, and do not proceed on another Node version.
- Leave the global TypeScript (7.0.2) alone. The project gets its versions from `package.json`.

**Never look at any other worktree** or another implementation's branch, such as `backup/codex-*`. The implementations are being compared, and reading another one contaminates the comparison. This includes other sessions' scratch, task-output and Playwright directories, and processes you did not start. Other worktrees' preview servers run on other ports; leave them alone.

Git tags are shared across worktrees, which is why every tag here carries the `claude-opus-5.5-` prefix.

The worktree's `.claude/settings.local.json` sets `"syncClaudeAiPlugins": false`, so synced claude.ai plugins are intentionally absent. The PreToolUse hooks on Bash, registered in `.claude/settings.json`, have their scripts in `.claude/hooks/`:
- `filter-test-output.sh` cuts single-case test output to failures and the summary.
- `guard-shell-writes.sh` refuses `sed -i`, `perl -i`, redirects, here-docs and `tee` into any tracked path outside `evidence/`, inline node or python that writes files, and git commands that move HEAD in the worktree (including `git reset`; drop a scratch commit with a revert).

## 2. How to start

Read [.claude/docs/implementing.md](../.claude/docs/implementing.md) first. It sets how this session orchestrates: the scoped reading, delegating each task to `tdd-task` and writing its brief (with the "Notes for later tasks" bullets in section 7 that name the task, copied word for word), the `ocr-review` run and bug tasks, and recording `suite-runner` runs.

The governing instruction is [plan/kickoff.md](kickoff.md). Follow it exactly. It requires reading two baselines, each scoped to what D7S uses.

**The `specs/` baseline (A205).** D7S has no reading list of its own. It reads **`plan/spec-reading/D07.md`**, D7's generated list, whose tags already cover every section D7S uses (AC-CALC-003 S052, the glossary's Stop and Target language S252, `assessPlan` S165, Daily Review S090, Daily Bar use S126; breakdown section 1.5). Read it as `implementing.md` says. Search `plan/spec-map.md` (don't read it in full) when the work touches another section, then read that section before building on it, and note it in `evidence/D07S/structural.md`.

**The frozen plan (scoped):**
- **`plan/D07S-option-price-stops-and-targets.md` in full**, which is the work.
- **`plan/implementation-plan.md`:** everything except the `## D8` through `## D28` definition sections. That leaves decisions 1–107 (89 lifts A100's "exactly one" and allows option-price conditions; 107 is this breakdown), the rules and cumulative obligations, the freeze record, the definitions through D7S, and the closing sections with tech debt items 1–22 (item 22 holds the prefactor's accepted bench numbers that T7S.14 compares with).
- **`plan/technology-stack.md`** in full, including "Pinned versions".
- **`plan/acceptance-matrix.md`:** only the opening sections, through "Evidence methods common to every row", and the AC-CALC-003 and AC-REST-004 rows, which carry D7S's entries (revision 79).
- **`plan/D07-single-leg-options-happy-path.md`:** section 1 (A99–A122 with the amendment notes, especially A100 as amended by revision 78, A109 and A110 on the Marks, A116 and A122), section 2 (implementation boundaries), and the task texts that built what D7S changes: T7.2 (`assessPlan`), T7.4 (Entry Quality), T7.6 (`evaluate`), T7.7 (schema v6, the model for T7S.1), T7.14 (Review `open`), T7.17 (migration to schema 6), T7.19 (Plan form), T7.23 (lists and Detail) and T7.24 (Review card). Also section 5's structural rows for capacity, capabilities, fixtures and the benchmark, and section 7's critic-flow conventions.
- **`plan/D07-approved-words.md`:** conventions C1–C8 and rows 19.x and 23.x, with the revision 78 amendment notes. D7S's own words are section 1.6 of its breakdown.
- **`plan/D07S-prefactor-mark-to-market-valuation.md`:** sections 1.1 and 1.7 (A189–A194), for the valuation module the headline reads through.
- **`plan/D04-daily-review.md`:** section 1's P14 (attention bands) and A42 (boundary contact), for T7S.4 and T7S.6.

`specs/` and the frozen plan are read-only. If implementation needs a deviation:
1. Stop before making it.
2. Name the affected specification passages, acceptance scenarios and durable compatibility.
3. Ask for approval to revise the plan.

An approved revision is committed and tagged `claude-opus-5.5-plan-r<n>`. The next revision is r81 and the next decision is 109 (revision 80 took decision 108, the run order below). Editing the breakdown's Progress section alone is not a revision (decision 100).

## 3. D7S specifics

- **Setup before T7S.1:** create `evidence/D07S/` with `tdd-log.md` (with its note that rows are single-case runs; `tdd.sh` maps `T7S.n` to this folder and refuses to run without it), `structural.md` and `provenance.md`. Briefs take `evidence/D07S` as the evidence directory. `full-suite.sh --current-folder evidence/D07S` prints `e2e/d7s`, so the browser cases go in `e2e/d7s/` and the Node cases in `tests/integration/d7s/`.
- **Order.** The Progress section's order, one task at a time: T7S.1, T7S.3, T7S.2, T7S.4 to T7S.13, then T7S.15, T7S.16, T7S.14 and the gate T7S.17 (decision 108, revision 80). Mark a row "In progress from `<commit>`" before its brief; that commit is the base for `browser-auto`.
- **T7S.3 runs straight after T7S.1, and T7S.2 straight after T7S.3 (decision 108).** `verify:capacity` is in every task's checks and fails at a new schema version until the basis is re-measured (breakdown section 1.5, shapes). T7S.2's measurement confirms option-price conditions through the facade, which T7S.3 builds. Between T7S.1's commit and T7S.2's, that one check failing is expected; record it, don't fix it in T7S.1 or T7S.3. After T7S.2 every check passes again. D7 carried this failure from T7.7 to T7.26; D7S carries it through T7S.3 only.
- **Schema 7 is an identity transform.** `v6→v7` only drops private fields for the rebuild, as `src/persistence/migrations/v5-to-v6.ts` does (A199). No store, index or record shape changes.
- **Fixtures.** **Never regenerate a v1–v6 dump or snapshot.** No v1–v6 expected view changes (section 1.5, shapes); a changed one is a defect to fix. T7S.13 alone freezes `workspace-v7/` with A204's content.
- **What must not change.** Every existing query-count proof keeps its exact request lists, and every existing case keeps its expected values, except the expectations section 1.5's "Texts" table names, each in the task it names (`plan-option.test.ts:158` and `:161` and `tests/integration/d7/rejections.test.ts:68`–`:83` in T7S.3; `PlanForm.test.tsx:582` and `plan-issues.test.ts:27` in T7S.8; `TradeDetailOptions.test.tsx:272`–`:276`, `:286` and `:287` in T7S.9). A changed request list or expected value anywhere else is a defect to fix, never an expectation to update. A stock Trade and a one-condition-per-role option Trade must give D7's figures unchanged (P91).
- **Words.** Screens use section 1.6's approved words (W1–W10). Words no row covers still need the user's approval: that is a stop (section 5).
- **Lint rules.** ESLint replaces a rule's options rather than merging them. Since T7SP.9, every `no-restricted-syntax` entry under `src/` that isn't exempt (test files and `src/domain/instrument/` are exempt) must spread `expirationComparisonSelectors` from `eslint.deps.config.js`, and the `src/ui` wording entry in `eslint.config.js` (`wordingWithExpirationRules`) relies on the identity selector staying first in `wordingRules` (`.slice(1)`). T7S.11's new `eslint.conditions.config.js` must keep all of these; its brief also runs `npm run lint` and `npm run verify:wording`. T7S.11's plant is linted from a test in `tools/`, as `tools/wording-rules.test.ts` does, so it is never committed (`--no-verify` is blocked).
- **The checkpoint critic (T7S.12).** After T7S.11, before the structural tail: run the full tier with `suite-runner` first, then a fresh critic on flows C7S.1–C7S.4 (breakdown section 7), briefed as at the gate below. Its defects become bug tasks, fixed before T7S.13.
- **The benchmark (T7S.14).** Unlike the prefactor, D7S **bumps `BENCH_GENERATOR_VERSION`** (6 today, in `src/app/bench.ts`) and regenerates the dataset at schema 7 with A203's condition mix. `bench:run` refuses the schema-6 dataset until then. `tools/bench-run.ts` writes D7's evidence path: move its output aside to `evidence/D07S/bench.md` and restore D7's file, as the prefactor did. Compare with `evidence/D07SP/bench-r3.md`. Never run `bench:run` alongside a browser suite.
- **Browser folders.** `test:e2e:2` and `test:e2e:release-history` pass `e2e/d7` to Playwright as a regex, which already matches `e2e/d7s`, so no script change is needed. No D7S spec is tagged `@release-history` (decision 76).
- **TDD discipline.** Run every `it should` case red, then green, one at a time, logged in `evidence/D07S/tdd-log.md` (`tdd.sh` runs vitest only; log Playwright reds and greens by hand). Code written before its red is backed out and rerun to a genuine red. A first-run pass gets the mutation check (an assertion failure or runtime exception, never a compile error) and is listed under section 7's open questions. The breakdown folds the cases it expects to pass today and names each fold.
- **Clock pinning in tests.** Chromium has native Temporal and the app reads `Temporal.Now.instant()`. Playwright's `clock.setFixedTime` pins only `Date`, so every pinned browser case uses `launchAt`/`pinClock`/`setClock` from `e2e/d4/support.ts`.
- **Browser mutation builds.** The browser suites measure `dist-faults`. A mutation of coordinator or UI code must rebuild that folder (`npm run build:faults`) before the run, and again after restoring.
- **ocr on test-only commits.** `ocr` excludes test files. Brief the `ocr-review` agent to recreate a test-only commit in a scratch clone (in its own scratch directory, never in the worktree) with the test files relocated under `src/itg/d07s/` as plain `.ts`, copying the `support.ts` files alongside. Findings caused only by the relocation are dismissed as relocation artifacts. This covers T7S.15 and T7S.16, and any task whose commit holds only tests.
- **Tech debt triggers:** item 11 (the Open list's Ready-state race, `TradeList.test.tsx:125`) if that case fails a run. When a trigger fires, raise the item with the user; don't fix it unasked.
- **The gate (T7S.17).**
  1. Run the complete cumulative suites with `suite-runner` on the full tier (`browser-full`: `browser-1` then `browser-2`, never `browser-auto`) until they pass, and record the runs. Decision 76: no `test:e2e:release-history` run. Before the critic, run `.claude/scripts/acceptance-commands.sh plan/D07S-option-price-stops-and-targets.md`. It must exit 0: a row whose command matches no test is corrected by a plan revision before any row is marked covered.
  2. Spawn a **fresh** `general-purpose` critic agent, briefed from `.claude/docs/critic-brief.md`. Name the worktree and commit; forbid reading `evidence/` and any other worktree; list the setup helpers in `e2e/d4/support.ts`, `e2e/d5/support.ts`, `e2e/d5r/support.ts`, `e2e/d6/support.ts`, `e2e/d7/support.ts` and `e2e/d7p/support.ts` by name with the Temporal pin helpers and clock constants; require port 5175 only; name flows C7S.1 to C7S.6, the future-capability list in breakdown section 7, and the 375 and 320 px checks.
  3. It starts the app itself, drives the production UI in a browser, and never edits code.
  4. Delegate each defect to a fresh subagent, which reproduces it with a failing test first and then fixes it, following `critic-brief.md`, "After each critic". Each fix gets a quick run with the touched browser specs; the full run comes after the last fix. A new critic is spawned only after a FAIL or a high or moderate defect, with at most three critics before asking the user.
  5. Name the report path `test-results/critic-d07s-<n>/report.md` in the brief. Copy each report from there to `evidence/D07S/critic-<n>.md` with `cp` and add a row to the critic-cost table in `evidence/D07S/structural.md`. The checkpoint's report is `critic-1.md`.

  If a fresh agent or a browser can't be provided, stop and report. Never self-certify. When the gate passes, mark section 8's rows covered and tag `claude-opus-5.5-d7s`.

## 4. What is in place

Build on these rather than re-creating them. Read the code before extending it. [D07SP-handoff.md](D07SP-handoff.md), section 4, and [D07-handoff.md](D07-handoff.md), section 4, describe what the earlier deliverables left; all of it is still in place.

| Piece | Where | Notes for D7S |
|---|---|---|
| Plan assessment | `src/domain/trade-analysis/plan.ts` (`assessPlan`, `nearest`, the `ConditionBasis` shapes) | T7S.3 adds `StructureValue`, P90's count rule, per-condition issues and `measurementOf` (A196). |
| Evaluation | `src/domain/trade-analysis/evaluate.ts` (the at-entry line at 215–216, the headline at 363–366, the anchor at 387) | T7S.4: per-condition reading (A198) and the headline (P91, A197). |
| Entry Quality | `src/domain/trade-analysis/derive.ts` (776–777) | T7S.5 reads the headline condition. |
| Review pressure | `src/coordinators/daily-review/attention.ts` (53) | T7S.6 reads the headline condition. |
| Option test records | `src/domain/trade-analysis/option-trade.ts` | `os2Record` and `oc2Record` join it (breakdown section 4). |
| Persistence | `src/persistence/schema.ts` (`SCHEMA_VERSION` 6), `src/persistence/migrations/` (`v5-to-v6.ts`, `private-fields.ts`, `index.ts`), `src/persistence/schema-v6.test.ts` | T7S.1 adds `v6-to-v7.ts` and `schema-v7.test.ts` on these models. |
| Capability manifest | `src/coordinators/workspace/capabilities.ts`; `npm run verify:capabilities` | T7S.7 (A202). |
| Plan form | `src/ui/screens/PlanForm.tsx`, `src/ui/screens/plan-issues.ts` | T7S.8 (W1–W5, W9, W10). |
| Detail | `src/ui/screens/TradeDetail.tsx` (155–156, 311–312; 505 stays) | T7S.9 (W6, W7). |
| Review card and lists | `src/ui/screens/ReviewCard.tsx`, `CardFigures.tsx`, the Open list's `TradeList` | T7S.10 (W8, A201). |
| Valuation module | `src/coordinators/valuation/` (the prefactor's Mark-to-Market Valuation and read session) | Needs no change (breakdown section 2); the headline reaches the screens through it. |
| Option fixtures | `tests/integration/d7/support.ts` (`confirmOption`, `recordOption`, `saveMark`, `onboardedAt`, `XYZ_CALL`, the clock constants); `e2e/d7/support.ts` | The D7S suites build on them. |
| Lint configs | `eslint.config.js`, `eslint.deps.config.js` (`noIdentitySelector`, `expirationComparisonSelectors`, domain purity), `eslint.wording.config.js` | T7S.11 adds `eslint.conditions.config.js`, merged as the wording config is. |
| Fixtures | `tests/fixtures/workspace-v1/` to `workspace-v6/`; `tools/fixtures-freeze.ts`, `tools/verify-fixtures.ts` (the v6 content check at 122) | T7S.13 adds `workspace-v7/`. |
| Benchmark | `src/app/bench.ts` (`BENCH_GENERATOR_VERSION` 6), `src/app/bench-generator.ts`, `tools/bench-run.ts`, `.cache/bench/profile`; the prefactor's results in `evidence/D07SP/bench-r3.md` | T7S.14 bumps the version (A203). |
| Suite runner | `.claude/agents/suite-runner.md`, `.claude/scripts/full-suite.sh` (`unit`, `integration`, `browser-1`, `browser-2`, `browser-task`, `browser-auto <base>`, `checks`) | Each stage is one foreground call. When `browser-auto` picks the full tier it runs nothing and tells the runner to run `browser-1` and `browser-2` (decision 98). 14 checks. |

## 5. Working rules

- **Commits.** Commit each finished task locally. The main session's commits end with the attribution lines from the session's system reminder. **Subagent briefs say "ending with the trailer your agent instructions specify"** and never dictate a model name. **Never push** unless the user asks, and never push the tags `claude-opus-5.5-plan-r30` or `-plan-r32` to `-plan-r40`.
- **Who edits what.** The main session edits only plan, evidence and handoff documents. Every task, bug task and code change goes to a fresh `tdd-task` subagent. The agent definitions hold the working rules (Edit tool only, scratch directories, exit codes, browser runs and ports, rebuilding after a mutation, staging, the clean-tree check), so briefs don't repeat them.
- **Cumulative runs.** End every task with a complete cumulative run, delegated to `suite-runner` and recorded in `evidence/D07S/structural.md`, with outputs in `evidence/D07S/suite-runs/`. The browser stage is `browser-auto <base>`, where `<base>` is the commit in the task's Progress row; record the tier it chose and its printed reason. The full tier runs before every critic. Tell the runner to leave no wait loop running, to check ports 9341, 9342 and 5175 before and after a run, and to use a label without a trailing hyphen. Subagents never run `npm run build:releases` on its own.
- **ocr reviews.** Every implementation commit gets an `ocr-review` run. Only findings ocr itself raises become bug tasks (`implementing.md`): a Valid or Doubtful finding with a failure scenario becomes `<task>-B<n>`, fixed test-first in a fresh `tdd-task` subagent and reviewed again, one at a time; a Wrong finding, or one with no failure scenario, is dismissed with its reason in `structural.md` and listed under section 7's open questions. Reviewer notes and brief answers never become bug tasks. Copy each `ocr.json` to `evidence/D07S/ocr/<task>-<sha>.json`.
- **Background work.** An `ocr-review` alongside the next task is fine. Never run two browser suites at once (they share port 5175), and never run `bench:run` alongside a browser suite.
- **Subagents.** A finished subagent that keeps resending its hand-back is stopped with TaskStop. Don't resume an old subagent; start a fresh one. General-purpose subagents run at medium effort unless the user names another level.
- **Never use bare `git stash`.** Use a WIP commit, or a tagged stash applied by SHA.
- **Section references.** Refer to document sections in words, never with the "§" sign.
- **Asking.** Lead with a recommendation and its tradeoff. Ask **one consequential decision at a time**, in prose, with enough context that the question stands on its own. Check every user proposal against the spec; if one conflicts, quote the passages, offer the closest compliant design, and let the user choose.
- **After each finished task:** commit it, record its cumulative run, mark its Progress row "Done" with its commits, update section 7 of this note, commit that, and **start the next task**.

### Running a whole deliverable

The goal is to complete D7S from one prompt (user's direction, 2026-10-21). Stop and ask the user **only** when:
1. a location check in section 1 fails;
2. the work needs a deviation from `specs/` or the frozen plan, or exposes a spec or plan ambiguity (the kickoff requires approval for these), including a breakdown passage the built code can't meet as written, a query-count proof that can't keep its request list, or a screen text no approved word covers (section 3);
3. a suite failure or critic defect can't be fixed by a fresh subagent without such a deviation;
4. a fresh critic agent or a browser can't be provided (never self-certify), or three critics at one checkpoint still leave a FAIL or a high or moderate defect;
5. a bug-task fix for an `ocr-review` finding needs a spec or plan deviation, or a third round of bug tasks on the same task still leaves findings;
6. T7S.14 measures a step more than 10% slower than `evidence/D07SP/bench-r3.md` (A203, tech debt item 22);
7. `acceptance-commands.sh` can't exit 0 without a plan revision (section 3, the gate).

Everything else continues without the user:
- **Implementation-level decisions:** make them with the recommendation you would have offered, and record them in the evidence and in section 7.
- **Suite failures:** reproduce each with one targeted run, delegate the fix to a fresh subagent (failing test first), and rerun the suite. Rerun a single browser failure once alone before treating it as real, and record both outcomes.
- **First-run passes:** log them with their mutation check and list them under section 7's open questions. They don't stop the session.
- **Context growth:** compaction is automatic. The breakdown's Progress section and section 7, updated after every task, are the recovery point.

When the gate passes, tag `claude-opus-5.5-d7s` locally. Then stop with a final report in `evidence/D07S/final-report.md`:
- tasks and commits;
- every flagged item;
- decisions made along the way;
- the critics' results;
- the benchmark's comparison with the prefactor's r3;
- the D8 amendment still due (breakdown section 1.2: D8's breakdown moves to schema 7 by its own revision when D8 starts).

Never push.

## 6. Out of scope

- Any deliverable other than D7S, unless the user says otherwise. In particular, **D8's schema-7 amendment** is made by D8's own revision when D8 starts (breakdown section 1.2); D7S doesn't edit D8's breakdown.
- **Structure-value conditions on multi-leg structures** (D10), **Management Revision of conditions** (D17), **Stop Discipline and Daily Bars** (D12), Assignment and Exercise (D20), backup and Restore (D8), and provider prices (D11).
- **Asking for the Underlying's Mark only when needed:** P93 keeps A110; every open option Trade asks for both Marks.
- **Add and remove rows, or a kind selector, on the Plan form** (P92 rejected both).
- **Upgrade tests** (decision 76; tech debt item 10).
- **The tech-debt items** at the end of `plan/implementation-plan.md`: they stay as recorded (raise 11 when section 3's trigger fires).
- Editing `specs/`, or editing the frozen plan without an approved revision.

## 7. D7S progress

Task status and commits are in the breakdown's Progress section (decision 100). This section holds two lists, one bullet per entry.

### Notes for later tasks

- **T7S.1 to T7S.17 (any lint change):** since T7SP.9 (`552d0d06`, B1 `96660874`), every `no-restricted-syntax` entry under `src/` that isn't exempt must spread `expirationComparisonSelectors` from `eslint.deps.config.js`, including the `src/ui` wording entry in `eslint.config.js` (`wordingWithExpirationRules`), which relies on the identity selector staying first in `wordingRules` (`.slice(1)`).
- **T7S.4 to T7S.10:** since T7SP.16 (`8008446f`), the AtEntry line carries `riskFromEntryInPlanR` and `rewardFromEntryInPlanR`, and since T7SP.17 (`75aaee66`) Detail carries `heldQuantity` and the expiration line. Several unit cases compare whole AtEntry objects with `toEqual` (`intraday.test.ts:30` and five coordinator cases); a new field on the line must be added to them additively, as T7SP.16 did.
- **T7S.6 and T7S.10:** since T7SP.8 (`e8b78874`, decision 104), the read session runs a date's frames, Stale-context lookups and gaps scans in one snapshot, and the Review open skips the dated line (`skipDatedLine`); only `getTrade` reads for it.
- **T7S.14 (user's direction, 2026-11-11):** tech debt item 22's trigger fires here. Before T7S.14's own bench, make its control run (a): build `claude-opus-5.5-pre-d7sp` in a scratch clone and run `bench:run` back to back with the current head on the same machine, recording both. No bisect or fix unasked. Stop condition 6 is relaxed by the user: a step 10% to under 35% slower than `evidence/D07SP/bench-r3.md` is recorded in `bench.md` and the final report and the session continues; a step 35% or more slower stops the session and is reported.
- **T7S.3 to T7S.5 (tech debt item 14, user's decision 2026-11-11):** its trigger, "the first change to any of the three" direction rules, fires in these tasks. The user chose to leave it for D10. Each task reuses its module's existing direction helper and adds no new copy of the rule.
- **T7S.8 to T7S.10, and any later screen text (user's direction 2026-11-11):** words no approved row (W1–W10, D7's rows) covers no longer stop the session. Use the closest approved pattern, and list each new phrase under "Open questions" below and in the final report for the user's approval.

### Open questions

- Provisional words awaiting the user's approval (user's direction 2026-11-11): none yet.
- Possible timing flake, not tech debt item 11: `src/ui/screens/ReviewCards.test.tsx:670` and `:694` ("links (A161)", focus read synchronously after `findByRole`) failed in run `t7s-1` while an ocr review ran alongside, and passed alone and in a whole-file run. Not fixed; a fix task (failing test first) if it fails again.
