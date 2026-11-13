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

### T8P.1-B1 (`f003e616`)

Fix: a takeover guard directory (`$lock.takeover`, taken with `mkdir`); only the guard's winner rereads `$lock/pid` and removes the lock, and only if it still holds the dead PID; a guard older than 10 s is removed. New shell test `.claude/scripts/with-browser-lock.test.sh` (no earlier test covered `.claude/scripts/`), red then green, rows in [tdd-log/T8P.1-B1.md](tdd-log/T8P.1-B1.md). T8P.1's lock behaviors rerun and held. The task's own note (not an ocr finding): the no-PID crash-recovery path (the 10 s age check on the lock) still uses an unguarded `mv`.

ocr: session `843585b9-8c13-46e8-9288-7f2387e5c3b1`, model gpt-6.1-sol, 2 files reviewed (0 excluded), 1 comment. Raw output: [ocr/T8P.1-B1-f003e616.json](ocr/T8P.1-B1-f003e616.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| high | bug | `.claude/scripts/with-browser-lock.sh:67-68` | The age-based `rmdir` of a "stale" takeover guard can remove a live taker's replacement guard, letting a second taker in and reintroducing the double takeover. | Valid (narrow): two waiters can both see the same expired guard, and the slower one's `rmdir` can delete a guard a new taker has just made. The 10 s age doesn't prove the guard's owner is dead. |

Reviewer's notes: the script uses BSD `stat -f %m` (macOS only; it predates the commit).

- **T8P.1-B1-R1** (round 2). Defect: a stale takeover guard's removal can delete a live taker's guard, so two takers can each remove a lock. Case: *it should let only one of two callers that find the same expired takeover guard go on to take the lock.* **Implementation-level decision:** the age-based removals of a guard or of a PID-less lock keep producing the same race in a new place, so the fix moves the lock to a kernel lock held by the wrapper for the command's lifetime (`lockf(1)` or Perl's `flock`, whichever this macOS ships), which the kernel releases when its holder dies. That removes every takeover path, including the PID-less one the task noted, and keeps the PID file only for the waiting message.

### T8P.1-B1-R1 (`fd732662`)

Fix: the wrapper's bash prologue (usage, `TJ_BROWSER_LOCK_HELD` reentrancy, the user temp directory from `getconf` and `pwd -P`) now execs `/usr/bin/perl`, which takes `flock(LOCK_EX|LOCK_NB)` on `<DARWIN_USER_TEMP_DIR>/tj-browser-lock-5175.flock`, polling every 0.25 s. It prints the waiting message once, from the PID written in the file (used only for that message), writes its own PID once it holds the lock, then forks the command and waits for it. The lock descriptor is close-on-exec, so the command never inherits it, and a `kill -9` of the wrapper frees the lock at once. The guard, the dead-PID takeover, both age checks and `TJ_BROWSER_LOCK_PAUSE` are gone. `TJ_BROWSER_LOCK_DIR` now names the lock file. Red: a staged copy of `7b7621f6`'s script, with two extra scratch pause points, exit 1 (`FAIL: both callers ran at once`). Green: `.claude/scripts/with-browser-lock.test.sh`, exit 0. Rows are in [tdd-log/T8P.1-B1-R1.md](tdd-log/T8P.1-B1-R1.md). Rerun and held: the waiting message, exit-code passthrough (7), a `kill -9`'d holder (no takeover), SIGTERM (143, then the next caller gets the lock), reentrancy, and the path's independence from the cwd and `$TMPDIR`. The task's notes: a wrapper killed by SIGKILL orphans its running command (T8P.1-B2's ground); this macOS has no `timeout` binary.

ocr: session `604d2688-7913-4bdc-b860-482ff22159c0`, model gpt-6.1-sol, 2 files reviewed (0 excluded), 4 comments. Raw output: [ocr/T8P.1-B1-R1-fd732662.json](ocr/T8P.1-B1-R1-fd732662.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `.claude/scripts/with-browser-lock.sh:46-48` | A TERM forwarded to the child between fork and exec hits the inherited handler, which only sets a flag, so the cancellation is lost and the wrapper keeps waiting while it holds the lock. | Valid: the child inherits the Perl handlers until exec, and in the child `$child` is 0, so nothing is re-raised. The window is microseconds. |
| medium | bug | `.claude/scripts/with-browser-lock.sh:34` | Every `flock` failure is treated as contention, so a persistent error polls forever and reports a holder that doesn't exist. | Valid: the loop never tells EWOULDBLOCK or EINTR from other errors. It's reachable mainly through a `TJ_BROWSER_LOCK_DIR` override on an odd filesystem. |
| medium | test | `.claude/scripts/with-browser-lock.test.sh:20` | Killing the surviving command before the next caller starts hides an implementation in which the command inherits and keeps the lock. | Valid: line 15's comment says the command doesn't hold the lock, but nothing asserts it. |
| medium | test | `.claude/scripts/with-browser-lock.test.sh:27` | `wait "$pa" "$pb"`, and the SIGTERM case's `wait "$ps_"`, have no deadline, so a regression hangs the test instead of failing it. | Valid: the other cases use the bounded `waitfor`. |

**Round count (implementation-level reading).** `implementing.md` stops the session when "a third round of bug tasks on the same task still leaves findings". T8P.1's rounds so far: round 1 (B1 to B4, from `cac803c2`'s review) and round 2 (B1-R1, from `f003e616`'s review). These four findings start round 3. If the reviews of round 3's fixes still raise findings, the session stops and asks.

Round 3's bug tasks (numbering continues):
- **T8P.1-B5** (finding 1). Defect: a SIGTERM to the wrapper in the instant between fork and exec is lost, so the wrapper keeps the lock instead of exiting 143. Case: *it should exit 143 and release the lock when the TERM reaches the command before it has started.*
- **T8P.1-B6** (finding 2). Defect: a lock file that can't be locked for any reason other than contention makes the wrapper wait forever and name a holder that doesn't exist. Case: *it should fail with a message, and not wait, when the lock can't be taken for a reason other than another holder.*
- **T8P.1-B7** (finding 3). Defect in the test: a lock leaked to the command wouldn't be caught. Case: *it should let the next caller run while the killed holder's command is still running.*
- **T8P.1-B8** (finding 4). Defect in the test: a lock or signal regression hangs the test. Case: *it should fail, not hang, when a caller never finishes.*

### T8P.1-B2 (`2e7ab770`)

Fix: the forked command calls `setpgrp(0,0)` before exec (and the wrapper calls `setpgrp($child,$child)` from its side). Signals go to the group `-$child`. After the child is reaped, a signalled wrapper polls the group for up to 5 s, then sends KILL and polls up to 5 s more. The exit status is still the child's, so 143 on TERM. New case in `with-browser-lock.test.sh`: red against `9345c4df` (`FAIL: a grandchild of the command outlived the wrapper's SIGTERM and the lock was released`), then green three times. Rows are in [tdd-log/T8P.1-B2.md](tdd-log/T8P.1-B2.md). The existing cases held; `npm --version` and an `npm run` through the wrapper exit 0; ports 5175, 9341 and 9342 were free before and after. The task's note: the command now runs in a background process group, so a command that reads the terminal would stop (none of the stages does).

ocr: session `198416d0-84c2-4d8e-87a6-c61351b1dc1a`, model gpt-6.1-sol, 2 files reviewed (0 excluded), 2 comments. Raw output: [ocr/T8P.1-B2-2e7ab770.json](ocr/T8P.1-B2-2e7ab770.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| high | bug | `.claude/scripts/with-browser-lock.sh:59-61` | The 5 s grace period and KILL start only after the blocking `waitpid($child, 0)` returns, so a command that ignores TERM keeps the wrapper and the lock forever. | Valid: reproduced by the reviewer with `sh -c 'trap "" TERM; sleep 40'`, still alive 9 s after TERM. |
| medium | bug | `.claude/scripts/with-browser-lock.sh:58` | Signalling `-$child` reaches only one process group, so a descendant in another group or session (a Node `spawn(..., {detached: true})`) gets neither TERM nor KILL and can still hold port 5175 after the lock is released. | Valid: the code signals and checks only `-$child`. Playwright starts its browsers detached in their own group, so this is reachable. |

These join round 3 (they come from the review of a round-1 fix, made after round 2):
- **T8P.1-B9** (finding 1). Defect: a command that ignores TERM keeps the wrapper, and the lock, forever. Case: *it should KILL a command that ignores TERM once the grace period has passed, and then release the lock.*
- **T8P.1-B10** (finding 2). Defect: a descendant that left the command's process group survives the wrapper's signal and can hold port 5175 after the lock is released. Case: *it should end a descendant that moved to its own process group before releasing the lock when the wrapper receives SIGTERM.*

### T8P.1-B9 (`b5f8cc46`)

Fix: the wait loop polls `waitpid` with WNOHANG every 50 ms. The signal handler records `$sigtime`, and at `$sigtime + $grace` the loop sends KILL to `-$child`. The post-reap wait uses the same deadline. New override: `TJ_BROWSER_LOCK_GRACE` (seconds, default 5, inert unless set). New case: red against `460f3775` (`FAIL: wrapper did not exit after SIGTERM to a command that ignores it`), then green 3 of 3. Rows are in [tdd-log/T8P.1-B9.md](tdd-log/T8P.1-B9.md). Existing cases held; ports were free before and after.

ocr: session `20e96c54-58dc-41d1-8869-f3084c12f93b`, model gpt-6.1-sol, 2 files reviewed (0 excluded), 1 comment. Raw output: [ocr/T8P.1-B9-b5f8cc46.json](ocr/T8P.1-B9-b5f8cc46.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | test | `.claude/scripts/with-browser-lock.test.sh:65-66` | The new case checks only that the wrapper exits and the lock is free. It never checks that the TERM-ignoring command was killed, or the wrapper's status (137), so a wrapper that merely exits on TERM would pass and leave the command running. | Valid: the command's PID is saved in `i.pid` but never checked with `kill -0`, and the wrapper isn't reaped for its status. The reviewer judged the production change correct. |

**Stop (handoff, section 2, condition 5; `implementing.md`, "a third round of bug tasks on the same task still leaves findings").** This is the review of a round-3 fix, and it still leaves a finding. The session stops here and asks the user how to go on. Still queued: T8P.1-B3, B4, B5, B6, B7, B8, B10, and this finding.

**User's decision (2026-11-13), "Batch and continue".** All the remaining lock findings are fixed in one bug task with one review, then B3 and B4. Further ocr findings on these tooling scripts keep becoming bug tasks, and the session stops again if a fifth round still leaves findings.
- **T8P.1-B11** (the finding above). Defect in the test: a wrapper that merely exits on TERM, leaving the command running, would pass. Case: *it should leave no process of a TERM-ignoring command running, and exit 137, once the grace period has passed.*
- **T8P.1-B12, round 4**, is the batch: B5, B6, B7, B8, B10 and B11, each case as written above, in one commit, reviewed once.

### T8P.1-B12 (`7da860a1`), round 4

Fixes, by case:
1. **B5.** INT, TERM and HUP are blocked across the fork. The child resets them to default before unblocking; the parent unblocks after `setpgrp` and acts on any pending signal.
2. **B6.** A `flock` failure other than EWOULDBLOCK or EINTR prints `cannot lock <path>: <err>` and exits 2. Staged with a FIFO.
3. **B7.** The test runs the next caller while the killed holder's command is still alive.
4. **B8.** Every wait in the test goes through a bounded `bwait`.
5. **B10.** A `ps -axo pid=,ppid=,pgid=` walk at signal time, then every 0.25 s while signalled and before release, sends TERM and then KILL at the grace deadline to the group, each known descendant and each descendant's group. Release waits until none is alive.
6. **B11.** The test checks exit 137 and no process left in the command's group.

Cases 1, 2 and 5 were red against the old script. Cases 3, 4 and 6, the test defects, were red as the old test passing (or hanging) against a deliberately broken scratch script. The test file then passed 3 of 3, about 8 s each. Rows are in [tdd-log/T8P.1-B12.md](tdd-log/T8P.1-B12.md). New test-only knob: `TJ_BROWSER_LOCK_TEST_CHILD_PAUSE`, inert unless set. The task's note: descendants are tracked only from the signal on.

ocr: session `700efb8e-dc65-4a27-a599-1e05de91676c`, model gpt-6.1-sol, 2 files reviewed (1 excluded, the log), 3 comments. Raw output: [ocr/T8P.1-B12-7da860a1.json](ocr/T8P.1-B12-7da860a1.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| high | bug | `.claude/scripts/with-browser-lock.sh:56` | Descendants are found only after a signal, so a detached descendant whose parent exited before the signal (PPID 1) is never found, and the lock is released with it running. | Valid: `snapshot()` runs only once signalled, and such a process is outside the command's group. |
| medium | bug | `.claude/scripts/with-browser-lock.sh:66` | `%known` keeps stale PIDs and group IDs and re-signals them at the grace deadline, so a reused ID could TERM or KILL an unrelated process. | Doubtful: no identity check before re-signalling; reuse inside the grace window is a theoretical race. |
| medium | test | `.claude/scripts/with-browser-lock.test.sh:120` | The early-TERM test sends TERM during the child's pause, after the parent has restored its mask, so removing the signal blocking would still pass. | Valid: the fork-to-`setpgrp` window isn't exercised; covering it needs a parent-side hook. |

Round 5 (under the user's decision: batched, and the session stops if round 5 still leaves findings):
- **T8P.1-B13** (finding 1). Defect: a detached descendant orphaned before the signal survives the wrapper and the lock's release. Case: *it should end a descendant that detached and lost its parent before the signal, before releasing the lock.*
- **T8P.1-B14** (finding 2). Defect: a stale remembered ID could be signalled after reuse. Case: *it should signal only processes that are still the command's descendants.*
- **T8P.1-B15** (finding 3). Defect in the test: the masked fork window isn't covered. Case: *it should exit 143 and run no command when the TERM arrives between the fork and the parent's `setpgrp`.*
- **T8P.1-B16** is the batch of B13, B14 and B15.

### T8P.1-B16 (`a87e8aed`), round 5

Fix:
- **Token.** The command's environment carries `TJ_BROWSER_LOCK_TOKEN=<wrapper pid>-<random>-<time>`.
- **Scan.** One `ps -axwwE -o pid,ppid,pgid,stat,lstart,command` runs about once a second while the command runs (about 30 ms each), and every 0.25 s once signalled.
- **Members** are the processes that carry the token, are in the command's group, are a child of a member, or were seen before with an unchanged start time. `%known` is rebuilt from each scan.
- **Signals.** A fresh scan precedes every signal, and each identity gets each signal once.
- **Release.** A drain loop sends TERM, then KILL at the grace deadline, and releases the lock once no member is left.

Checking the suggested design: `ps -E` shows the token for node, including a `detached: true` child with PPID 1, but not for Apple system binaries. Hence token plus scan.

Cases:
- B13, red against `50e792d7`: a perl double-fork with `setsid`, and a node `detached: true` child, both outliving TERM. A mutation removing the token fails the node sub-case.
- B14, red with a planted stale PID.
- B15, the old test passing against a copy without `SIG_BLOCK`. The new test fails against that copy, using `TJ_BROWSER_LOCK_TEST_PARENT_PAUSE`, with `TJ_BROWSER_LOCK_TEST_CHILD_PAUSE` moved inside the masked window.

The test file passed 3 of 3, about 15 s each. Rows are in [tdd-log/T8P.1-B16.md](tdd-log/T8P.1-B16.md). Exits 143, 137, 2 and the command's own code held, and so did the waiting message, reentrancy, path independence and `npm` through the wrapper. Ports were free before and after.

The task's documented limit: a system binary with no readable environment, born and orphaned within one scan interval, can be missed. This supersedes B12's note that descendants were tracked only from the signal on.

ocr: session `238f0f5e-e699-4785-987f-4c7e8bfe4f64`, model gpt-6.1-sol, 2 files reviewed (1 excluded, the log), 2 comments. Raw output: [ocr/T8P.1-B16-a87e8aed.json](ocr/T8P.1-B16-a87e8aed.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| high | bug | `.claude/scripts/with-browser-lock.sh:69` | A ps failure (launch, non-zero exit, unparseable output) reads as "no members left", so the drain loop can release the lock while detached descendants still run, and a partial scan overwrites `%known` and loses orphans. | Valid, with limits: `scan()` returns `{}` when ps can't be opened; `close($ps)` and ps's exit status are never checked. The wrapper fails open. |
| medium | bug | `.claude/scripts/with-browser-lock.sh:84` | `lstart` has one-second resolution, so a remembered PID reused by an unrelated process started in the same second would be admitted and signalled. | Doubtful: needs a PID wrap within one second of the original's start; `%known` is rebuilt every scan. |

**Stop (the user's decision of 2026-11-13: the session stops if round 5 still leaves findings).** The session asks the user how to go on. Still queued: T8P.1-B3 and B4.

**User's decision (2026-11-13), "Last fix, then accept limits".** One final bug task, T8P.1-B19, batches the two findings above. Any finding its review raises on `with-browser-lock.sh` or its test is recorded as an accepted limit of dev tooling, for the final report, with no further rounds. Then B3, B4 and T8P.1's complete cumulative run.
- **T8P.1-B17** (finding 1). Defect: a `ps` failure or partial listing releases the lock while members may still run. Case: *it should keep the lock, and keep the last known members, when a scan fails, and release only after a scan that succeeds shows no member left.*
- **T8P.1-B18** (finding 2). Defect: a PID reused within the same second passes the identity check. Case: *it should not treat a process as a remembered member when its PID matches but its identity differs within the same second.*
- **T8P.1-B19, round 6**, is the batch of B17 and B18.

### T8P.1-B19 (`c6b51bc3`), round 6, the last on the lock wrapper

Fix:
- **B17.** A scan is valid only when ps opened, `close` reports exit 0, the header parsed, and the wrapper's own PID is listed. An invalid scan leaves `%known` as it was and signals the last known identities, plus the command and its group while the command is unreaped. Release happens only after a valid scan shows no member left. If ps keeps failing for 30 s past the KILL deadline, the wrapper releases with a stderr `WARNING … PIDs: …` line, and exits 1 if the command's status was 0.
- **B18.** A remembered identity is `lstart` plus the full command line.

New test-only hooks, inert unless set: `TJ_BROWSER_LOCK_TEST_PS`, `TJ_BROWSER_LOCK_TEST_PS_FAIL_LIMIT`, `TJ_BROWSER_LOCK_TEST_STALE_SAME_LSTART`.

Red:
- B17: both stub modes, ps exiting 1 and an empty listing, hung the old script. It never gave up, never signalled the last known member and printed no warning.
- B18: a planted PID with the same start time but another command line was signalled.

The test file then ran green 3 times, about 30 s each. Rows are in [tdd-log/T8P.1-B19.md](tdd-log/T8P.1-B19.md). Exit 5, path independence, `npm --version`, and the existing cases held. Ports were free before and after.

The task's note: a process that rewrites its own command line drops out of `%known`, but is still found by token, group or parent.

ocr: session `622a540d-01ba-42ab-adba-62d59ec5c532`, model gpt-6.1-sol, 2 files reviewed (1 excluded, the log), 2 comments. Raw output: [ocr/T8P.1-B19-c6b51bc3.json](ocr/T8P.1-B19-c6b51bc3.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| high | bug | `.claude/scripts/with-browser-lock.sh:96-97` | A zero-exit scan that lists the wrapper is accepted even when other rows are malformed; the parser skips unmatched rows, so a remembered descendant with a corrupted row is dropped and the lock can be released. | Valid, low likelihood: it needs ps to exit 0 with a bad row. The reviewer notes that rejecting any unmatched row would also reject a scan where a command line holds a newline. |
| medium | bug | `.claude/scripts/with-browser-lock.sh:93` | The successful-scan branch dedupes sent signals by PID and start time only, not the full identity B18 introduced, so a same-second reused PID that is still a member can miss a TERM. | Valid, low practical risk: KILL has its own key. |

**Accepted limits (the user's decision of 2026-11-13).** No more bug tasks on the lock wrapper. Both findings are recorded as accepted limits of dev tooling, listed in the handoff's open questions for the final report:
- **AL-1.** A malformed `ps` row in a zero-exit scan can drop a remembered descendant.
- **AL-2.** The successful-scan signal dedupe key omits the command line.

Also carried as documented limits:
- **AL-3** (from B16). A system binary with no readable environment, born and orphaned within one scan interval, can be missed.
- **AL-4** (from B2). The command runs in a background process group, so a command that reads the terminal would stop.

### T8P.1-B3 (`d8a39865`)

Fix: `full-suite.sh … lane` writes the marker `<label>-lane.txt` (`TIER lane`). `run-complete.sh` precedence:
1. browser-1 or browser-2 means the full tier;
2. otherwise a `browser.txt` means the task tier;
3. otherwise the marker means the lane tier;
4. otherwise the task tier, with `browser: missing` named.

New shell test `.claude/scripts/run-complete.test.sh`; one sentence in `suite-runner.md`.

Cases:
- Case 1 was red against the old scripts (`FAIL: a run with no browser file and no lane marker was not reported INCOMPLETE`), then green.
- **Case 2 was a first-run pass**: the old rule already passed a marked lane run. Its mutation check, on a scratch copy of the fixed script that looks for a differently named marker, failed with `FAIL: a marked lane-tier run was not reported complete … run INCOMPLETE`. Listed in the open questions.

The test also covers the full tier (5 files) and the task tier (4 files), complete and incomplete. A real lane-tier probe in the main worktree exited 0 (1519 unit, 218 integration, 14 of 14 checks), wrote the marker, and gave "run complete", or "run INCOMPLETE" with the marker moved away. The probe files were deleted. Rows are in [tdd-log/T8P.1-B3.md](tdd-log/T8P.1-B3.md).

ocr: session `e4222aeb-9d44-495b-925d-30c262639f79`, model gpt-6.1-sol, 3 files reviewed (2 excluded: `suite-runner.md` and the log), 1 comment. Raw output: [ocr/T8P.1-B3-d8a39865.json](ocr/T8P.1-B3-d8a39865.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `.claude/scripts/full-suite.sh:94` | The lane marker is never cleared, so a later non-lane run under the same evidence directory and label that never reaches its browser stage still sees the old marker and prints "run complete". | Valid but narrow: it needs a label reused across tiers. |

- **T8P.1-B20** (round 2 of B3's line; the lock wrapper's cap doesn't apply here). Defect: a stale lane marker makes an unfinished full or task run read as a complete lane run. Case: *it should report run INCOMPLETE for a task-tier run under a label that earlier held a lane-tier run, when the browser stage hasn't run.*
