# D7 retrospective (2026-11-08)

Covers the session from T7.29-B12 to the D7 push. Findings are ordered by severity. None is applied yet; each waits for the user's choice.

## 1. The critic gate has no stopping point for minor defects

- **What happened:** critics 1, 2 and 3 each reported PASS with one or two new minor or low defects. `plan/D07-handoff.md` (the browser-critic gate, step 4) says to fix them, rerun the suites and spawn another fresh critic, so the cycle ended only when the user said "Don't do a fourth critic run. It's time to move on."
- **Cost:** 640,000 critic tokens (189,339 + 232,137 + 218,395) and about 41 minutes of critic time, plus a fix, an ocr review and a 9-minute full-tier run per round.
- **Proposed change:** in `.claude/docs/critic-brief.md` ("After each critic") and the handoff template's gate steps: a PASS whose defects are all minor or low has them fixed, followed by a full-tier run, and the gate closes. A new critic runs only after a failed flow or a moderate (or worse) defect. The wording is the user's to set.
- **Applied (2026-11-08, the user's wording):**
  - **Severity:** the critic brief now defines three levels: high, moderate and low.
  - **Fixes:** every defect is fixed before the gate closes, one bug task each. Each fix gets ocr and a quick run (`browser-task`), plus the browser specs that cover the touched screens.
  - **After the last fix:** one full run. Then the gate closes if the critic passed with only low defects. After a FAIL or a high or moderate defect, a fresh critic follows.
  - **Cap:** a third critic still finding high or moderate defects stops for the user.
  - **Measured against D7:** critics 2 and 3 each found one minor defect, so the gate would have closed after critic 2's fix. That saves critic 3 (about 218,000 tokens and 14 minutes) and one full run.

## 2. Notes for later tasks are buried in one 19,500-character table cell

- **What happened:** critic 1's main defect (option Trade Terminal Disposition in "shares", T7.32-B1) was noted after T7.5: "For the UI tasks: `closedViaSale` and the list's 'Closed via sale' are stock-only." The note sat inside the handoff's "Tasks done" cell, which mixes commit history with warnings meant for later tasks. It never reached the briefs for the exit receipt or the owed card.
- **Cost:** a known gap reached the gate. Reading the cell also costs about 5,000 tokens each time.
- **Proposed change:** split the handoff's progress section into a short "Tasks done" list and a "Notes for later tasks" list, one bullet per target task. In `.claude/docs/implementing.md`, add a step: before each brief, copy the notes addressed to that task into the brief, then strike them from the list.
- **Applied (2026-11-08, the user's direction):**
  - **Process:** `implementing.md` now has three rules:
    - a brief copies in every "Notes for later tasks" bullet that names its task, and the bullet is deleted once every task it names has had it;
    - after each task, the update adds one "Tasks done" bullet, and puts each warning in its own notes bullet, starting with the task IDs it is for;
    - the next handoff's progress section is a short table followed by those two lists.
  - **Then superseded the same day by decision 100 (revision 69), at the user's suggestion:** task status and commits moved to a Progress section at the end of each breakdown, and editing that section is not a plan revision. The handoff keeps only "Notes for later tasks" and "Open questions". The D7 breakdown's section 11 was backfilled from the handoff and `git log`, with every D7 code commit assigned to a task.
  - **D7 handoff:** the "Tasks done" cell is now a list, one bullet per task, below the table. The text is unchanged (checked with `cmp`). Its inline "For T7.xx" notes stay as history, since the gate has addressed them all.

## 3. Nobody checked the acceptance-row commands until the end

- **What happened:** AC-POS-004's `npm run test:integration -- d7/close-review` and AC-RESP-001's `d7/responses` match no test file. That only came out when each row's command was run after the tag, so both rows stay `planned`.
- **Proposed change:** add a script, `.claude/scripts/acceptance-commands.sh <breakdown>`. It extracts the backticked commands from the breakdown's acceptance table and runs each in list mode (`vitest list`, `playwright test --list`), failing on any command that matches zero tests. Call it from `.claude/docs/drafting-breakdowns.md` when a breakdown is written, and from the gate before the first critic.

## 4. Critic reports are copied into the evidence by retyping them

- **What happened:** each critic report arrives only as a message, so the main session saved `critic-1.md` to `critic-3.md` by writing their full text out again, about 6,000 to 8,000 output tokens each. A script to extract a report from the transcript was rightly blocked by `guard-shell-writes.sh`.
- **Proposed change:** in `.claude/docs/critic-brief.md`, the critic also writes its report to `test-results/critic-d<nn>-<n>/report.md`. The main session then copies it into `evidence/` with `cp`, which the hook already allows.
- **Applied (2026-11-08, the user's direction):**
  - The critic brief's report section has the critic write `test-results/critic-d<nn>-<n>/report.md` (git-ignored), then send the same text as its final message.
  - "After each critic" copies that file to `evidence/D<nn>/critic-<n>.md` with `cp`. If the file is missing, the main session asks the critic, through SendMessage, to write it.
  - `guard-shell-writes.sh` passes the `cp` (tested, exit 0).

## 5. The plan's revision history sits in one 19,600-character table cell

- **What happened:** the "Immutable revision" cell in `plan/implementation-plan.md` (line 122) holds every revision from 5 to 68. Every session reads it at the start, and each revision makes it longer.
- **Proposed change:** move revisions 5 to 67 into `plan/revisions.md`, leave the current revision and a pointer to that file in the cell, and add each later revision to that file.
- **Applied (2026-11-08, the user's direction, revision 70):**
  - `plan/revisions.md` lists every revision, newest first, one bullet each. Revisions 69 to 5 are verbatim from the cell (checked with `cmp`).
  - The cell now names revision 70 only and points to the file. It is down from about 20,000 characters to about 330.
  - Each new revision adds its entry at the top of `revisions.md` and replaces the cell's entry.

## 6. The chart-layout fixes were checked only on the charts that failed

- **What happened:** B2's browser spec (`e2e/d7/payoff-chart-layout.spec.ts`) checked label overlap on two Planned charts only. ocr then found three more problems (B3 to B5) on the Current chart's latest-close label and on crowded tick rows, and critic 3 still saw labels touching the curve. The layout depends on estimated text widths (7.5 px per character).
- **Proposed change:** add an `expectNoTextOverlap(chart)` helper in `e2e/d7/support.ts`, using real rendered text boxes. Apply it to every payoff state the suite already builds (Planned, Current with a latest close, the short Put, Settlement Due), not only the states that failed.

## 7. No commit hook or CI job

- **What happened:** the repository has no `.github/workflows` and no git hooks. Typecheck and lint run only when a subagent remembers to, or in the cumulative run. Nothing went wrong in this session because of it.
- **Proposed change:** a pre-commit hook that runs `npm run typecheck && npm run lint` when staged files include `src/`.
- **Applied 2026-11-08, at the user's direction** ("Not running a typecheck and lint is a serious violation of code hygiene"). `.githooks/pre-commit` runs `npm run typecheck` (about 0.6 s), then `npm run lint` (about 12 s), whenever the commit stages a `.ts`, `.tsx`, `.js`, `.mjs` or `.cjs` file, `package.json`, `package-lock.json` or a `tsconfig*.json`; it refuses the commit if either fails. It is enabled for this worktree only (`extensions.worktreeConfig` on, `git config --worktree core.hooksPath .githooks`), because `.git/hooks` is shared by every worktree. Verified on a scratch index: a docs-only commit skips the checks, a code commit runs both and passes, and a failing typecheck or lint (simulated with a fake `npm`) refuses with exit 1. The next handoff's location checks confirm `git rev-parse --git-path hooks` prints `.githooks` (`implementing.md`).
- **Bypass blocked, at the user's direction:** `.claude/hooks/guard-shell-writes.sh` (the PreToolUse Bash guard, which also covers subagents) refuses, in the project's own repository, `git commit --no-verify` and its unambiguous prefixes, `-n` alone or in a short-option cluster (quoted words such as a `-m` message are not read as options), `git -c core.hooksPath=...`, and `git config` writes to `core.hooksPath` (a value, `set`, `unset`, `--unset`, `--replace-all`, `--add`, or removing or renaming the `core` section). Reads (`git config --get`, `git config get`) and commits in scratch clones outside the project stay allowed. The first version read each line of a multi-line commit message as a command and refused its own commit, whose message has a line starting "git config writes to core.hooksPath"; the guard now reads lines that start inside a quote or a heredoc body as text (a character scanner tracks `"` and `'` across lines, so an apostrophe inside a double-quoted message is handled), which also removes the same false positive from the older HEAD rule. Verified by a 43-case table (deny and allow cases, including messages that mention `-n` and `--no-verify`, that multi-line message, heredoc bodies, a bypass chained after a closed multi-line message or after "it's" in a message, `-uno`, `-mnothing` and the guard's earlier HEAD and `sed -i` rules): 43 of 43. The live guard also refused the first attempt to run that table inline, since one case line chains `&& git commit --no-verify`. Known limits, as for the guard's other rules: env prefixes (`GIT_CONFIG_KEY_0=core.hooksPath`), `--config-env` and aliases are not looked into.
- **Hooks that travel with the branch (the user's direction, 2026-11-08; CI declined for now).** Git copies no config, and both Claude PreToolUse hooks (`filter-test-output.sh`, `guard-shell-writes.sh`) were registered only in `.claude/settings.local.json`, which the user's global git ignore excludes, so on another machine none of them would run. Three changes: (1) `npm install` enables the pre-commit hook through a `prepare` script; (2) a `verify:hooks` script fails the cumulative run's checks stage when the hook is not enabled (the stage runs every `verify:*` script); (3) the PreToolUse registrations moved from `settings.local.json` into `.claude/settings.json`, now committed with its four project permissions. After the move the guard still refused a probe `sed -i`. `tdd-task.md` and the D7 handoff no longer describe `settings.json` as untracked.

## 8. D7 was two deliverables' worth of scope in one breakdown

Added at the user's request, after the first draft looked only at the session's own work.

- **What happened:** D7 was the largest deliverable so far by tasks and code, and far the largest by decisions:

  | | Tasks | Commits | Bug and fix commits | Code changed (src, tests, e2e, tools) | Decisions during the deliverable |
  |---|---|---|---|---|---|
  | D2 | 24 | 250 | 70 | +23,016 lines, 161 files | — |
  | D4 | 34 | 288 | 169 | +23,562, 179 files | — |
  | D5 | 25 | 106 | 41 | +15,379, 108 files | — |
  | D6 | 28 | 134 | 60 | +29,375, 182 files | 6 (70–75) |
  | D7 | 36 | 198 | 86 | +35,551, 231 files | 19 (81–99), 22 plan revisions |

  Counts come from the breakdowns' task graphs and `git` between each deliverable's start and release tags. D4 had more commits and bug fixes, so D7's problem was breadth and uncertainty more than length. Options touched every layer at once: Instruments, Trade Analysis and the schema-6 migration, Market Data and the Catalog, workflows, Daily Review, the views, three new forms and a new chart. The plan moved mid-flight: the approved-words batch (decision 87) and the Strategy module (decision 88) each added two tasks, option-price Stops and Targets split out into D7S (decision 89), and decisions 95 to 99 came out of the structural tail.
- **Would a split have helped?** Mostly yes. The natural seam is expiration:
  - D7a, contracts while open: Instruments, Plan, Executions, the lists, Detail and the payoff view.
  - D7b, at and after expiration: the Expiration fact, Settlement Due, the Review's settlement family and the value at expiration.

  The critics' seven defects fall on both sides: three in settlement and the Review (B1's owed card, B6, B7), four in the payoff chart (B2 to B5). A gate after D7a would have caught the chart and the "shares" wording before the settlement work landed. Each breakdown would have carried half the decisions. The progress cell (finding 2) and the many context compactions both grow with a 36-task deliverable.
- **What a split costs:** the structural tail runs once per deliverable (capacity, fixtures, the benchmark generator and latency harness, the integration and browser suites, the critic): about eight tasks, including a 2.5-hour benchmark generation. A split doubles that unless the first half takes a lighter gate. Under D7a alone, an option past its expiration date would show Settlement Due with no way to record it, which is acceptable only because nothing is released for real use (decision 76).
- **Proposed change:** add a size check to `.claude/docs/drafting-breakdowns.md`. A drafted breakdown that has more than 30 tasks, or a schema change that reaches every layer, or many open questions at drafting gets a proposed split at a seam where the in-between state is coherent. The first part takes a light gate (the suites and a critic, no benchmark); the full tail runs at the end. A cheaper partial fix is a checkpoint critic after the UI tasks, before the structural tail: it would have caught B1, B2, B6 and B7 earlier without a second breakdown, but does nothing for the decisions or the sprawl.
- **Applied 2026-11-08, at the user's direction:** `.claude/docs/drafting-breakdowns.md` gains a "Size check" bullet with these thresholds ("many open questions" made concrete as five or more; the task threshold set by the user to more than 25, after 20 proved to catch every deliverable since D1), the light first gate, and the checkpoint critic when the user keeps one breakdown.

## Not findings

- **`CLAUDE.md`** is small (about 3,000 characters).
- **Earlier problems already have fixes:** the ocr-only rule (`implementing.md`, 2026-11-08) and the two-stage full browser tier (decision 98) address this session's bug-task inflation and the 10-minute Bash limit.
- **The guard hook's two refusals** (an inline Python write and an in-place `sed`) were the hook working as intended.

## D7-Retro-H1: install and verify the pre-commit hook

- **Commit `1b1ff5c1`.** `package.json` gains `"prepare": "sh tools/install-hooks.sh"` and `"verify:hooks": "sh tools/verify-hooks.sh"` (the checks stage runs every `verify:*` script). `install-hooks.sh` works on the current directory (npm runs `prepare` at the package root), exits 0 with one line when git is missing, the directory is not a work tree or `.githooks` is absent, prints "already enabled" when `git rev-parse --git-path hooks` already prints `.githooks`, and otherwise enables `extensions.worktreeConfig` and sets `core.hooksPath` with `--worktree`. `verify-hooks.sh` exits 1, naming the fix, unless the hooks path is `.githooks` and `.githooks/pre-commit` is executable.
- **Verified:** `npm run verify:hooks` and `npm run prepare` exit 0 here (re-run by the main session: "pre-commit hook enabled"); in a scratch clone, verify fails before install, install enables the hook, a second install changes nothing, and verify then passes; outside any repository install skips with exit 0. The pre-commit hook ran typecheck and lint on the commit. No cumulative run: no application code changed (the user, 2026-11-08).
- **ocr** (`ocr/D7-Retro-H1-1b1ff5c1.json`): 3 files, 2 comments, both Doubtful, so both become bug tasks:

  | Severity | Location | ocr's claim | Assessment |
  |---|---|---|---|
  | medium | `tools/install-hooks.sh:14` | Enabling `extensions.worktreeConfig` with a shared `core.bare=true` or `core.worktree` makes linked worktrees inherit them | Doubtful (this repo has `core.bare false`). **D7-Retro-H1-B1** |
  | medium | `tools/install-hooks.sh:10-13` | The "already enabled" exit tests the effective hooks path, so a shared or global `.githooks` skips the per-worktree setting | Doubtful (here it is set at worktree scope). **D7-Retro-H1-B2** |

- **D7-Retro-H1-B1:** `install-hooks.sh` should change nothing and say why when the shared config has `core.bare=true` or a `core.worktree` value, leaving `verify:hooks` to fail.
- **D7-Retro-H1-B2:** `install-hooks.sh` should treat the hook as enabled only when `core.hooksPath` is `.githooks` at worktree scope, so a shared or global value still gets the worktree setting.
- **D7-Retro-H1-B1, commit `af86c92a`:** before enabling `extensions.worktreeConfig`, `install-hooks.sh` reads the local-scope `core.bare` (as a bool) and `core.worktree`; if `core.bare` is true or `core.worktree` has a value, it changes nothing, prints one line pointing to git-worktree's CONFIGURATION FILE section, and exits 0. Verified in a scratch clone: `core.worktree` set skips with both settings left unset; `core.bare false` enables as before; `core.bare true` stops at the earlier "not a git work tree" check, and with `GIT_WORK_TREE` forcing a work tree it reaches the new check and skips. `npm run prepare` and `npm run verify:hooks` exit 0 here. ocr (`ocr/D7-Retro-H1-B1-af86c92a.json`): 1 file, 0 comments. No findings.
- **D7-Retro-H1-B2, commit `d30ed7f9`:** the "already enabled" exit now requires `extensions.worktreeConfig` true at local scope and `core.hooksPath` `.githooks` at worktree scope (without the extension, `--worktree` reads the shared config). Verified in scratch clones: with only a local `.githooks` value the script now writes the worktree setting (`--show-scope` lists `local` and `worktree`); a second run says "already enabled" and changes nothing; a fresh clone enables as before; B1's `core.worktree` skip still holds. `npm run prepare` and `npm run verify:hooks` exit 0 here. ocr (`ocr/D7-Retro-H1-B2-d30ed7f9.json`): 1 file, 0 comments. No findings. **D7-Retro-H1 is closed** (one round of bug tasks).

## D7-Retro-F3: acceptance-commands.sh

- **New script** `.claude/scripts/acceptance-commands.sh <breakdown.md>` (read-only, list mode only). It finds the `## <n>. Acceptance matrix rows` table, locates the "Command or procedure" column by header text, and takes the backticked strings starting `npm run ` or `npx ` as commands (revision notes quoting old filters are ignored). "as <ID>" borrows that row's commands; any other cell with no command prints `procedure, not checked`. `test:integration` and `test:unit` become `npx vitest list --project <p> <filters>` (tests counted from the listed lines); `npx playwright test` and `test:e2e` forms become `npx playwright test --list <args>` (count from its "Total:" line); other `npm run` scripts are checked only for presence in `package.json`. Zero tests or a list error fails the row; exit 1 if any row fails. It writes no file.
- **Verified:**
  1. `.claude/scripts/acceptance-commands.sh plan/D07-single-leg-options-happy-path.md; echo "exit $?"`: exit 0. 18 commands checked, 0 failed, 1 procedure (AC-DEL-003, "as B7.7"). AC-CALC-003 ("as AC-CALC-004") resolved to `d7/payoff`, 2 tests.
  2. The r70 plan (`git show claude-opus-5.5-plan-r70:plan/D07-single-leg-options-happy-path.md` into a `mktemp -d` file): exit 1, failing exactly `AC-POS-004 | ... d7/close-review | FAIL: 0 tests` and `AC-RESP-001 | ... d7/responses | FAIL: 0 tests`; summary "18 commands checked, 2 failed, 1 rows are procedures".
  3. `plan/D06-close-a-long-stock-position.md`: exit 0. 21 commands checked, 0 failed, 1 procedure (AC-DEL-003). No D6 row has a dead filter.
  4. `git status --short` after the runs lists only the script and this file besides the main session's `.claude/docs/drafting-breakdowns.md` and `plan/D07-handoff.md`. Ports 5175, 9341 and 9342 were free before and after.
  5. `shellcheck`: not installed.
- **Commit `b6ac2fbe`.** ocr (`ocr/D7-Retro-F3-b6ac2fbe.json`): 1 file, 4 comments. Three are Valid and one is Doubtful, so each becomes a bug task:

  | Severity | Location | ocr's claim | Assessment |
  |---|---|---|---|
  | medium | `acceptance-commands.sh:12` | The path is checked from the caller's directory, then the script changes to the repository root, so a relative path given from another directory can't be opened | Valid. **D7-Retro-F3-B1** |
  | medium | `acceptance-commands.sh:52` | The presence check matches any top-level `package.json` key (`npm run name` reads "script present"), and uses the name as a regex | Valid. **D7-Retro-F3-B2** |
  | medium | `acceptance-commands.sh:36` | A bare `npm run test:integration`, `test:unit` or `test:e2e`, with no `-- <filters>`, is only checked for presence and never listed | Valid. **D7-Retro-F3-B3** |
  | medium | `acceptance-commands.sh:45` | The unquoted `$args` drops shell quoting (`--grep "two words"`) and expands globs against the repository | Doubtful (no current row quotes a filter). **D7-Retro-F3-B4** |

- **D7-Retro-F3-B1:** the script should open a breakdown path given relative to the caller's directory from any directory, such as `plan/`.
- **D7-Retro-F3-B2:** the presence check should look only in `package.json`'s `scripts` object, matching the name exactly, so `npm run name` fails.
- **D7-Retro-F3-B3:** a bare `test:integration`, `test:unit` or `test:e2e` command should be listed for its whole project and counted.
- **D7-Retro-F3-B4:** command arguments should keep their shell quoting and never glob-expand, so a quoted `--grep` filter is passed as one argument.
- **D7-Retro-F3-B1, commit `d2f14d3d`:** the script now makes the breakdown path absolute (from the caller's directory) before changing to the repository root; a missing file exits 2 with `acceptance-commands.sh: no such file: <path>`.
  - **Red** (before the fix): `(cd plan && ../.claude/scripts/acceptance-commands.sh D07-single-leg-options-happy-path.md); echo "exit $?"` printed `awk: can't open file D07-single-leg-options-happy-path.md`, then `no acceptance table with a "Command or procedure" column found in D07-single-leg-options-happy-path.md`, exit 2.
  - **1.** The same command after the fix: exit 0, output identical to the root run (`diff` empty); 18 commands checked, 0 failed, 1 procedure.
  - **2.** `.claude/scripts/acceptance-commands.sh plan/D07-single-leg-options-happy-path.md; echo "exit $?"`: exit 0; 18 commands checked, 0 failed, 1 rows are procedures.
  - **3.** `.claude/scripts/acceptance-commands.sh plan/no-such.md; echo "exit $?"`: `acceptance-commands.sh: no such file: plan/no-such.md`, exit 2.
  - **4.** The r70 plan (from `git show claude-opus-5.5-plan-r70:...` into a `mktemp -d` file): exit 1, failing exactly AC-POS-004 and AC-RESP-001 (`FAIL: 0 tests`); 18 checked, 2 failed.
- **D7-Retro-F3-B1 ocr** (`ocr/D7-Retro-F3-B1-d2f14d3d.json`): 1 file, 0 comments. No findings.
- **D7-Retro-F3-B2, commit `e595ed40`:** the presence check now reads `package.json` with `node -e` and accepts a name only if it is an own key of the `scripts` object (exact match, no regex); otherwise the row prints `FAIL: no such npm script`. The brief named AC-DEL-001, but `npm run verify:capabilities` is the command of AC-CAP-001 (line 714 of the D7 breakdown), so the copies change that row.
  - **Red** (before the fix, `HEAD`'s script run from a `git show` copy in a `mktemp -d` directory, on a copy of the D7 breakdown with line 714's command replaced by `npm run name`): `AC-CAP-001 (cumulative) | npm run name | script present`, exit 0, 18 checked, 0 failed.
  - **1.** The fixed script on that copy: `AC-CAP-001 (cumulative) | npm run name | FAIL: no such npm script`, exit 1, 18 checked, 1 failed.
  - **2.** The regex near-miss copy (`npm run verify.capabilities`): the old script said `script present` (exit 0); the fixed script prints `FAIL: no such npm script`, exit 1, 1 failed.
  - **3.** `.claude/scripts/acceptance-commands.sh plan/D07-single-leg-options-happy-path.md; echo "exit $?"`: exit 0; 18 checked, 0 failed; `npm run verify:capabilities` and `npm run bench:run` both `script present`.
  - **4.** The r70 plan (`git show claude-opus-5.5-plan-r70:...` into a `mktemp -d` file): exit 1, failing exactly AC-POS-004 and AC-RESP-001 (`FAIL: 0 tests`); 18 checked, 2 failed.
- **D7-Retro-F3-B2 ocr** (`ocr/D7-Retro-F3-B2-e595ed40.json`): 1 file, 0 comments. No findings. The reviewer's own note, not an ocr finding: a missing or unparseable `package.json` reads "no such npm script", which fails closed.
- **D7-Retro-F3-B3, commit `8006f567`:** a bare `npm run test:integration` or `test:unit` is now listed with `vitest list --project <name>`, and a bare `test:e2e`, `test:e2e:1` or `test:e2e:2` with `playwright test --list` on the folders and `--grep-invert` read from that script's text in `package.json` (never run; `test:e2e` sums `:1` and `:2`). Copies of the D7 breakdown in a `mktemp -d` directory replace AC-CAP-001's command (`npm run verify:capabilities`).
  - **Red** (before the fix, copy with `npm run test:integration`): `AC-CAP-001 (cumulative) | npm run test:integration | script present`, no count.
  - **1.** After the fix, the same copy: `191 tests`, exit 0 (18 checked, 0 failed).
  - **2.** `npm run test:unit`: `1502 tests`, exit 0. `npm run test:e2e:2`: `64 tests`, exit 0. `npm run test:e2e`: `183 tests`, exit 0.
  - **3.** `.claude/scripts/acceptance-commands.sh plan/D07-single-leg-options-happy-path.md; echo "exit $?"`: exit 0; 18 checked, 0 failed; output identical to the previous script's (`diff` empty), so the filtered rows' counts are unchanged.
  - **4.** The r70 plan: exit 1, failing exactly AC-POS-004 and AC-RESP-001 (`FAIL: 0 tests`); 18 checked, 2 failed.
  - **5.** Ports 5175, 9341 and 9342 free before and after (`--list` starts no server).
- **D7-Retro-F3-B3 ocr** (`ocr/D7-Retro-F3-B3-8006f567.json`): 1 file, 0 comments. No findings.
- **D7-Retro-F3-B4:** the script splits each command's arguments with a new `split_args` function. It keeps single quotes, double quotes and backslashes the way a shell does, never globs, and never evaluates `$(...)` or backticks (no `eval`). The vitest, `playwright test --list` and package.json-script paths all use it.
  - **1.** Red, before the fix: a copy of the D7 breakdown in a `mktemp -d` directory, with AC-CAP-001's command `npx playwright test e2e/d7/no-save.spec.ts --grep "store no Trade"`. The old script printed `AC-CAP-001 (cumulative) | ... | FAIL: playwright --list exited 1, no tests` (the phrase became `"store` and `no` and `Trade"`).
  - **2.** After the fix, that copy: `1 tests`, exit 0. By hand, `npx playwright test --list e2e/d7/no-save.spec.ts` lists 1 test, and its title contains "store no Trade". A phrase matching nothing (`"zzz absent phrase"`) gives `FAIL: playwright --list exited 1, no tests`.
  - **3.** A copy with `npm run test:integration -- tests/integration/d7/*` (the filter `d7/*` alone matches no path either way): the old script expanded the glob and printed `37 tests`; the new one passes `tests/integration/d7/*` literally, vitest lists nothing, and the row prints `FAIL: 0 tests`. With the filter `d7/*` the new script also prints `FAIL: 0 tests`.
  - **4.** A copy with the command `npm run test:integration -- --testNamePattern $(touch <scratch>/pwned)`: nothing ran, `pwned` does not exist, and the row prints `FAIL: vitest list exited 1` (the literal text is passed as an argument).
  - **5.** `.claude/scripts/acceptance-commands.sh plan/D07-single-leg-options-happy-path.md; echo "exit $?"`: exit 0; 18 checked, 0 failed; output identical to the previous script's (`diff` empty).
  - **6.** The r70 plan: failing exactly AC-POS-004 and AC-RESP-001 (`FAIL: 0 tests`); 18 checked, 2 failed. Ports 5175, 9341 and 9342 free before and after.
