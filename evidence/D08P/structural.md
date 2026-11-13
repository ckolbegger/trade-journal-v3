# D08P structural verifications

Each entry records a structural task's exact verification (D08P breakdown, section 6). Wave-0 tasks before T8P.1's merge end with a complete cumulative run delegated to `suite-runner`. From T8P.1's merge on, decision 111 applies: each lane task ends with its lane tier (unit, integration, checks, in its lane worktree), and the complete cumulative run runs once per merge batch on `claude-opus-5.5`, with the full tier before every critic. Full outputs are in `suite-runs/`. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`.

## Start of D08P

Location checks (D08P implementing handoff, section 1) on 2026-11-12:
- worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`: matched.
- `git status -sb`: `## claude-opus-5.5...origin/claude-opus-5.5`, clean (not ahead: `HEAD` is `4b90de47`, the handoff commit, already on `origin`).
- `git log --oneline claude-opus-5.5-pre-d08p..HEAD`: one commit, `4b90de47` "D08P implementing handoff, drawer labels follow the prototype; lane briefs carry the lane rules".
- tags `claude-opus-5.5-d7s`, `claude-opus-5.5-pre-d8p`, `claude-opus-5.5-plan-r84` and `claude-opus-5.5-pre-d08p`: present.
- `claude-opus-5.5-d7s^{commit}`: `2240fe1c9d6f1c0e1c8fa1846db700eb63fc82c4`.
- `claude-opus-5.5-plan-r84^{commit}` and `claude-opus-5.5-pre-d08p^{commit}`: both `6dd6c8594b7ac6efea57745fe08ba4cc5fde9bba`.
- `git diff --stat claude-opus-5.5-d7s claude-opus-5.5-pre-d08p -- src e2e tests tools package.json 'eslint*'`: empty.
- `ls .claude/worktrees`: absent.
- `git rev-parse --git-path hooks`: `.githooks`.
- `ocr llm test`: `✓ Connection test successful` (and `✓ Tool-call round trip verified`).
- `DEV_PORT=5175`; Node v26.12.0.
- `npm ci`: exit 0. `npx vitest run src`: `Test Files 127 passed (127)`, `Tests 1519 passed (1519)`. `npx vitest run tests/integration`: `Test Files 103 passed (103)`, `Tests 218 passed (218)`.

Spec reading (A218): `plan/spec-reading/D07.md`, plus D9's entries for Trade Analysis `replay`, Market Data's query contract (`ReadSeries`), Trade Views' `getTradeDetail`, `replayTrade` and invariants, AC-MARK-004 (S047), and the UI contract's Trade Detail and replay paragraphs. Any other section the work touches is noted below.

**Implementation-level decision (reading order).** T8P.1 is tooling only (no product code, no spec section). Its brief needs only the breakdown's sections 6 and 9 and the handoff's notes, which were read first, so T8P.1 was dispatched before the `specs/` baseline and the rest of the scoped plan were read, and that reading continued while it ran. Every later brief is written after the reading.

## Critic cost

| Critic | Report | Flows | Result |
|---|---|---|---|

## Lane worktrees

Worktree and branch names the Agent tool gives each lane task (handoff, section 3, wave 1).

| Task | Lane | Worktree | Branch | Base |
|---|---|---|---|---|

## T8P.1 Swarm tooling

No product code. Changed: `.claude/scripts/tdd.sh`, `full-suite.sh`, `run-complete.sh`; new `.claude/scripts/with-browser-lock.sh` and `lane-setup.sh`; `eslint.config.js` (`.claude/worktrees/**` in `globalIgnores`); the text of section 9 applied to `.claude/docs/implementing.md`, `.claude/agents/tdd-task.md` and `.claude/agents/suite-runner.md`.

**1. `tdd.sh`, one file per task.** Run for `T8P.1` and `T8P.6-B1-R1` (a bug-fix ID shape), each with the harmless unit case `should authorize 10 percent of the long-option Plans and no other` in `src/app/bench-generator.test.ts`: `green exit=0 | Tests 1 passed, 8 skipped (9)`. Two files appeared, `evidence/D08P/tdd-log/T8P.1.md` and `evidence/D08P/tdd-log/T8P.6-B1-R1.md`, each with its header, the column header row copied from `evidence/D08P/tdd-log.md`, and one row; `evidence/D08P/tdd-log.md` itself was unchanged. Both probe files were then removed (they aren't TDD evidence). The deliverable log's absence still refuses (the existing check is untouched).

**2. `with-browser-lock.sh`.** Lock: directory `tj-browser-lock-5175` under the user's temp directory (`getconf DARWIN_USER_TEMP_DIR`, symlinks resolved with `pwd -P`; `$TMPDIR` is only a fallback), with the holder's PID in `pid`. Two callers, the first holding for 5 s and exiting 7:

```
A start 23:51:51
A holds 23:51:51
B start 23:51:52
with-browser-lock: waiting for the lock held by process 31343 (/private/var/folders/ks/n63g0mm937v5rdb147g4txg40000gn/T/tj-browser-lock-5175)
A done 23:51:56
A exit 7          <- the command's exit code passes through
with-browser-lock: acquired
B holds 23:51:57
B exit 0
```

Killed holder (`kill -9` of the script; the lock directory stayed, PID file 31502): the next caller, started from `/` with `TMPDIR=/tmp`, printed `taking over the lock left by dead process 31502`, ran, and released (`lock after: released`). A holder sent SIGTERM exits 143 and the lock is released. The path is the same from any directory and any `$TMPDIR` because it comes from `getconf DARWIN_USER_TEMP_DIR`, not the environment or cwd (the run from `/` with a different `TMPDIR` found and took over the same directory).

**3. `lane-setup.sh`** on a scratch worktree `.claude/worktrees/t8p1-probe` (branch `scratch/t8p1-probe`, from HEAD). Run from the main root it refuses (`is not under a .claude/worktrees/ directory`, exit 2). In the lane: source root derived from the lane path; `node_modules` cloned with `cp -c -R`; `dist-releases` cloned the same way (see the finding below); `tools/install-hooks.sh` run; `.env.local` copied and `DEV_PORT=5175` confirmed; `git rev-parse --git-path hooks` printed `.githooks`. Rerunning leaves existing files alone. Finding: the first lane-tier run failed `verify:releases` (ENOENT on `dist-releases/v1`), because the checks stage reads the gitignored `dist-releases/`. `lane-setup.sh` now clones it. No other gitignored file is needed by the unit, integration or checks stages (`.cache/` and `dist-faults/`, `dist-bench/` aren't read there; `dist/` is rebuilt by `npm run build`). The new scripts were copied into the scratch worktree from the main worktree (they were not yet committed).

**4. `full-suite.sh evidence/D08P t8p-1-lane-probe lane`** in the scratch worktree: unit exit 0 (127 files, 1519 tests), integration exit 0 (103 files, 218 tests), checks 14 of 14 exit 0 (after the `dist-releases` fix). It wrote `t8p-1-lane-probe-unit.txt`, `-integration.txt` and `-checks.txt` under the lane's `evidence/D08P/suite-runs/` (they went with the worktree). `run-complete.sh evidence/D08P t8p-1-lane-probe` printed `unit: finished`, `integration: finished`, `checks: finished`, `run complete`, exit 0. The browser stages (`browser-1`, `browser-2`, `browser-task` and its builds) now run through `with-browser-lock.sh`; `browser-auto` runs the task tier through `browser_task`, so it is wrapped too. No browser command ran in this task.

**5. `npm run lint` in the main worktree with the scratch worktree present:** exit 0, and the debug log shows ESLint calculated config for the `.claude/worktrees` directory only and linted none of its files. Other commands checked with the scratch worktree present: `npx vitest list --filesOnly` (unfiltered, `src`, `tests/integration`) lists 0 files under `.claude/worktrees` (the project's include patterns are anchored at the root), `npm run lint:deps` exit 0, `npm run verify:wording` and `npm run verify:hooks` ok. None needed an exclude.

**6. Cleanup:** `git worktree remove --force .claude/worktrees/t8p1-probe`, `git branch -D scratch/t8p1-probe`; `.claude/worktrees` is absent, and `git worktree list` has no entry under this worktree's `.claude/`. Nothing listens on 5175; the lock directory is absent.

### T8P.1 ocr review (`cac803c2`)

Session `8fa4e4ef-ba95-4d01-91bc-382abf8ff697`, model gpt-6.1-sol, 6 files reviewed (4 excluded), 4 comments. Raw output: [ocr/T8P.1-cac803c2.json](ocr/T8P.1-cac803c2.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| high | bug | `.claude/scripts/with-browser-lock.sh:49` | Stale-lock takeover isn't atomic with the ownership check. Two waiters can read the same dead PID, and the second `mv` can move the live lock the first waiter just created. | Valid: the dead-PID check, the `mv` and the retry `mkdir` are separate steps (lines 45–51), so both waiters can run, and A's release deletes B's lock. The window is narrow and needs a dead holder. |
| medium | bug | `.claude/scripts/with-browser-lock.sh:31` | On a signal the wrapper kills only the immediate child, so its descendants (npm, npx, playwright) can outlive it, and the lock is released while they still hold port 5175. | Valid, signal path only: the child is the bare `"$@"` (line 64), not a process group. Normal exits are unaffected. |
| medium | bug | `.claude/scripts/run-complete.sh:15` | A missing browser file is now read as the lane tier, so a full or task run with no browser evidence can report "run complete". | Valid, limited reach: an in-order run still shows checks missing, but a run whose stages were called separately, or whose browser stage was skipped, would pass wrongly. |
| medium | bug | `.claude/scripts/lane-setup.sh:20` | `${root%%/.claude/worktrees/*}` strips from the first `.claude/worktrees/` component, so a lane nested inside another Claude worktree resolves the wrong source root. | Doubtful: it matters only if the deliverable worktree itself sits under a `.claude/worktrees/` directory, which this layout doesn't do. |

Reviewer's notes: no question was put in the brief; the worktree was unchanged afterwards.

**Bug tasks** (each Valid or Doubtful finding; one fresh `tdd-task` each, failing reproduction first, in the main worktree, since lanes haven't started):

- **T8P.1-B1** (finding 1). Defect: two callers that find the same dead holder can both run, so two browser suites share port 5175, and one caller's release deletes the other's lock. Case: *it should let only one of two callers that find the same dead holder take the lock, while the other waits for it.*
- **T8P.1-B2** (finding 2). Defect: a wrapper stopped by a signal releases the lock while the command's descendants still hold port 5175 or the CDP ports. Case: *it should end every descendant of the command before releasing the lock when the wrapper receives SIGTERM.*
- **T8P.1-B3** (finding 3). Defect: a full-tier or task-tier run missing its browser file reads as a complete lane tier. Cases: *it should report run INCOMPLETE for a run with unit, integration and checks files but no browser file and no lane marker*; *it should still report run complete for a lane-tier run.*
- **T8P.1-B4** (finding 4). Defect: a lane under a deliverable worktree that is itself inside a `.claude/worktrees/` directory would clone `node_modules`, `.env.local` and `dist-releases` from the wrong root. Case: *it should take the source root from the innermost `.claude/worktrees/` component of the lane's path.*
