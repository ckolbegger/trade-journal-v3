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

| Critic | Report | Flows | Result | Tokens | Tool calls | Duration | Brief |
|---|---|---|---|---|---|---|---|
| critic-1 (T8P.23, checkpoint, at `05ca870f`) | `critic-1.md` | C8P.1–C8P.4, plus 375 and 320 px | FAIL (C8P.4): 8 defects (1 high, 3 moderate, 4 low), 11 minor observations | 215,050 | 70 | 10 min 57 s | `critic-brief.md` template with D08P's section 8, the accepted exceptions (with revision 96's case 7), and `e2e/d7s/support.ts` helpers |
| critic-2 (T8P.23, checkpoint, at `b11aa7ab`) | `critic-2.md` | C8P.1–C8P.4, plus 375 and 320 px | FAIL (C8P.2): 7 defects (1 high, 4 moderate, 2 low), 8 minor observations | 222,923 | 59 | 10 min 14 s | critic-1's brief, plus a fourth accepted exception (W10's per-card Trade P&L) |
| critic-3 (T8P.23, checkpoint, at `0d251d22`) | `critic-3.md` | C8P.1–C8P.4, plus 375 and 320 px | FAIL (C8P.2): 2 defects (1 high, 1 moderate), 10 minor observations | 190,820 | 57 | 11 min 28 s | critic-2's brief, plus revision 97's exceptions 5 to 8 and revision 98's choices |
| critic-4 (T8P.26, gate, at `d76e506b`) | `critic-4.md` | C8P.1–C8P.6 | PASS, with 4 defects (3 moderate, 1 low), 10 minor observations | 220,136 | 73 | 9 min 55 s | critic-3's brief for all six flows, plus revision 99's exception 9 |

## Lane worktrees

Worktree and branch names the Agent tool gives each lane task (handoff, section 3, wave 1).

| Task | Lane | Worktree | Branch | Base |
|---|---|---|---|---|
| T8P.3 | d08p-t8p3 (wave 0) | `.claude/worktrees/d08p-t8p3` | `d08p/t8p3` | `c5d2eb2e` |
| T8P.4 | d08p-t8p4 (wave 0) | `.claude/worktrees/d08p-t8p4` | `d08p/t8p4` | `c5d2eb2e` |
| T8P.5 | d08p-t8p5 (wave 0) | `.claude/worktrees/d08p-t8p5` | `d08p/t8p5` | `64cd1bd8` |
| T8P.6 | BA (wave 1) | `.claude/worktrees/d08p-ba` | `d08p/ba` | `12a396c0` |
| T8P.8 | BM (wave 1) | `.claude/worktrees/d08p-bm` | `d08p/bm` | `12a396c0` |
| T8P.9 | BV (wave 1) | `.claude/worktrees/d08p-bv` | `d08p/bv` | `12a396c0` |
| T8P.14 | R2 (wave 1) | `.claude/worktrees/d08p-r2` | `d08p/r2` | `12a396c0` |
| T8P.12 | R1 (wave 1) | `.claude/worktrees/d08p-r1` | `d08p/r1` | `12a396c0` |
| T8P.17 | D2 (wave 1) | `.claude/worktrees/d08p-d2` | `d08p/d2` | `12a396c0` |
| T8P.16 | D1 (wave 1) | `.claude/worktrees/d08p-d1` | `d08p/d1` | `f0c9948d` |
| T8P.19 | D4 (wave 1) | `.claude/worktrees/d08p-d4` | `d08p/d4` | `3b6a0e76` |
| T8P.18 | D3 (wave 1) | `.claude/worktrees/d08p-d3` | `d08p/d3` | `3b6a0e76` |
| T8P.20 | D5 (wave 1) | `.claude/worktrees/d08p-d5` | `d08p/d5` | `1242cd09` |
| T8P.7 | BA (wave 1) | `.claude/worktrees/d08p-ba` | `d08p/ba` | `7a253b4f` |
| T8P.21 | D6 (wave 1) | `.claude/worktrees/d08p-d6` | `d08p/d6` | `89d079dd` |
| T8P.15 | R2 (wave 1) | `.claude/worktrees/d08p-r2` | `d08p/r2` | `aa8bfddd` |
| T8P.10 | BV (wave 1, same lane) | `.claude/worktrees/d08p-bv` | `d08p/bv` | `aa8bfddd` |
| T8P.30 | AX (wave 1, last) | `.claude/worktrees/d08p-ax` | `d08p/ax` | `479923c3` |
| T8P.24 | NI (wave 2, beside the serial tasks) | `.claude/worktrees/d08p-ni` | `d08p/ni` | `46bb44f3` |
| T8P.31 | PL (wave 2, revision 96) | `.claude/worktrees/d08p-pl` | `d08p/pl` | `bbdc61a2` |
| T8P.27 | rm (wave 2; a lane, beside merge run 9; it ends with the full browser tier) | `.claude/worktrees/d08p-rm` | `d08p/rm` | `c670929c` |
| T8P.22 | wire (wave 2; a lane, as T8P.5 was, so it need not wait for merge run 8 in the main worktree; it ends with the full browser tier) | `.claude/worktrees/d08p-wire` | `d08p/wire` | `395f7ec5` |

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

### T8P.1-B20 (`7775984a`)

Fix: in `full-suite.sh`, every non-lane stage removes `<label>-lane.txt` before it works, and only the lane stage writes it. The lane stage's internal unit, integration and checks steps don't clear it. The new case in `run-complete.test.sh` drives the real `full-suite.sh` (`browser-auto` in a scratch repo whose diff picks the full tier and runs nothing). It was red (`FAIL: a non-lane run under a label with an old lane marker… was not reported INCOMPLETE`), then green, with every earlier case green. Rows are in [tdd-log/T8P.1-B20.md](tdd-log/T8P.1-B20.md).

ocr: session `f5d16a22-cc60-4f84-8bf3-9c47e845720d`, model gpt-6.1-sol, 2 files reviewed (1 excluded, the log), 0 comments. **No findings.** Raw output: [ocr/T8P.1-B20-7775984a.json](ocr/T8P.1-B20-7775984a.json).

### T8P.1-B4 (`e68ab797`)

Fix: `lane-setup.sh` derives the source root in a `source_root_of` function (`${1%/.claude/worktrees/*}`, the innermost component), refusing with exit 2 outside any `.claude/worktrees/`. A new `--print-source-root <path>` query prints it and exits before any git or clone work, and the no-argument call is unchanged.

New shell test `.claude/scripts/lane-setup.test.sh`, covering the nested path, the plain path and the refusal. It was red against a scratch copy with the old `%%` (`FAIL: nested path: expected /x/.claude/worktrees/outer, got exit 0: /x`), then green. Rows are in [tdd-log/T8P.1-B4.md](tdd-log/T8P.1-B4.md).

End to end, in a scratch worktree under `.claude/worktrees/`: exit 0, with `node_modules` and `dist-releases` cloned, `.env.local` copied (`DEV_PORT=5175`) and the hooks path `.githooks`. The scratch worktree was then removed.

ocr: session `53bff592-afbf-4fda-bb24-1e7cd667125e`, model gpt-6.1-sol, 2 files reviewed (1 excluded, the log), 0 comments. **No findings.** Raw output: [ocr/T8P.1-B4-e68ab797.json](ocr/T8P.1-B4-e68ab797.json).

Every T8P.1 bug task is closed: B20 and B4 are clean, and the lock wrapper's last findings are accepted limits AL-1 to AL-4.

### T8P.1 complete cumulative run (`t8p-1`)

Run on `f2ab6560` (main worktree; the only uncommitted change was the handoff's notes), 2026-11-13 08:52 EST. Browser stage `browser-auto 4b90de47`, which printed `browser tier: task (no changed path since 4b90de47 is on the full-tier list)`; no `e2e/d8p` folder yet, so only the `@every-task` call ran. Ports 5175, 9341 and 9342 were free before and after. `run-complete.sh evidence/D08P t8p-1`: run complete.

| Suite | Result | Output |
|---|---|---|
| Unit | 127 files, 1519 tests passed, exit 0 | [suite-runs/t8p-1-unit.txt](suite-runs/t8p-1-unit.txt) |
| Node integration | 103 files, 218 tests passed, exit 0 | [suite-runs/t8p-1-integration.txt](suite-runs/t8p-1-integration.txt) |
| Browser, task tier (Chromium) | 5 passed (11.4 s), exit 0 | [suite-runs/t8p-1-browser.txt](suite-runs/t8p-1-browser.txt) |
| Checks (14 commands) | 14 of 14 exit 0 | [suite-runs/t8p-1-checks.txt](suite-runs/t8p-1-checks.txt) |

## T8P.2 Split Trade Detail

Commit `10d63285` (base `cf690cb2`; the Progress row's `f2ab6560` differs only in evidence and plan files). 37 files.

**Implementation-level decisions (brief):**
- The section files live in `src/ui/screens/trade-detail/`, and `TradeDetail.tsx` stays put as the composition.
- Shared test helpers are in `trade-detail/test-support.ts`.
- **Browser verification.** The section 6 row's "full browser tier" is covered by the complete cumulative run that follows the task, since `browser-auto` picks the full tier for UI and style paths. The task itself ran only the computed-style specs before committing, so the tier doesn't run twice.

**Split.** `TradeDetail.tsx` is now 170 lines, composing `Banner`, `Footer`, `Identity`, `Journal`, `Payoff`, `Plan`, `Position`, `Result`, `RiskReward`, `SettlementDue`, `Summary`, `Today` and `Valuation`. Each has its `.test.tsx` beside it, and the shared files are `figure.tsx`, `words.ts` and `test-support.ts`. Valuation, Risk and reward and the Summary card are each their own file (section 4.2). `EXIT_ACTION` and `INCOHERENT_ENTRY_NOTE` are in `words.ts`, and `PositionChangeForm.tsx` imports them from there. `PayoffView` is untouched.

**Cases, 98 (77 + 21), by file:** Journal 20, Position 18, Summary 11, Valuation 8, Plan 7, Banner 6, Identity 6, Footer 5, Payoff 5, RiskReward 5, SettlementDue 3, Result 2, Today 2.

**Moved test helpers:**
- The Options file's fake-Date hooks became `useFixedClock()`, called first inside each moved Options `describe`.
- The two old `renderView` helpers became one that includes `timeZone`, which nothing in Detail reads.
- Case-local helpers left unused in a new file were dropped there.

**Exact verification:**
- `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint` and `npm run lint:deps`: exit 0 (367 modules).
- `npx vitest run src`: 138 files, 1519 tests passed.
- `it-titles.sh`, after against before: empty diff, 1513 titles each side.
- `git diff cf690cb2 -- src/ui/app.css`: 227 lines deleted, 0 added, every deleted non-blank line present in `legacy-detail.css`.
  - Selectors moved: `.card.integrity`, `ul.narrative` (and `> li + li`), `.back-link`, the `.summary-card` rules, the execution disclosure rules, `ul.executions > li[data-group]`, `.execution-group-mark`, the `.execution-details` and `.execution-reflection` rules (including the narrow media query), `dl.figure-grid` and its children (including the 960 px query), `.trade-detail dl:not(.figure-grid):not(.answers)`, the `dl.answers` rules, `table.lots` and `.table-scroll.lots-scroll`.
  - Selectors kept in `app.css`: `ul.executions` (and `> li`, `> li:first-child`, `> li.execution-line`, which the receipts use), `.nowrap`, `.chart-scroll`, `.payoff-chart`, `.execution-price` and `.table-scroll`.
  - The new stylesheet is imported in `src/main.tsx` right after `app.css`.
- Computed-style browser specs, after `npm run build:faults`, through `with-browser-lock.sh`: `e2e/d2/ui-alignment.spec.ts` and every `responsive*.spec.ts`, 70 passed in 3.6 min. Ports were clear before and after.

### T8P.2 ocr review (`10d63285`)

Session `27262bc7-f707-46e2-9459-5f9c5caa2b87`, model gpt-6.1-sol, 22 files reviewed (15 excluded as test files), 1 comment. Raw output: [ocr/T8P.2-10d63285.json](ocr/T8P.2-10d63285.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `.claude/scripts/it-titles.sh:8` | The pattern needs a quoted title right after `it(`, so `it.each(table)(...)` cases aren't listed, and losing them in a move would still give an empty diff. | Valid: `it.each` is used at `PlanForm.test.tsx:353` and `ReviewCards.test.tsx:774`. It doesn't affect T8P.2's check, since all 98 moved cases are plain `it(...)`, but T8P.5's proof uses the same script. |

Reviewer's answer to the brief's question: no rendering difference found. The section order, every render guard, the props, and the Plan, Baseline, plan-reflection, Position, `Figure` and `ConditionLines` markup all match `cf690cb2`. `useRuntime` moved into `IdentityHeader` and `SettlementDuePanel`. The reviewer found no cascade conflict between moved and remaining rules, though its CSS check was set-wise and doesn't prove the order within the file.

- **T8P.2-B1.** Defect: `it-titles.sh` omits `it.each` cases, so a lost table-driven case would pass the titles proof. Case: *it should list each `it.each` case's title template, and every other `it` form (`it.skip`, `it.only`, `it.todo`), once per occurrence.*

### T8P.2-B1 (`5ebf9e2b`)

Fix: `it-titles.sh` reads each file whole with Perl and lists `it.each` (with a balanced-parenthesis table), `it.skip`, `it.only`, `it.todo`, template-literal titles and titles that start on the next line. Plain `it(` titles print bare; other forms carry a prefix (`it.each: …`). New shell test `.claude/scripts/it-titles.test.sh`: red against the old script (7 of 11 titles), then green. Rows are in [tdd-log/T8P.2-B1.md](tdd-log/T8P.2-B1.md). Real tree: 1515 titles at both `cf690cb2` (via `git archive`) and HEAD, with an empty diff. The old script gave 1513; the two added are the `it.each` cases.

ocr: session `14f97088-77c8-4524-93aa-0344c5dbc0fa`, model gpt-6.1-sol, 2 files reviewed (1 excluded, the log), 2 comments. Raw output: [ocr/T8P.2-B1-5ebf9e2b.json](ocr/T8P.2-B1-5ebf9e2b.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `.claude/scripts/it-titles.sh:12` | The `it.each` table matcher treats parentheses and quotes inside regex literals or comments as table syntax, so such cases are silently omitted. | Valid: the reviewer's fixture `it.each([/\(/])('regex title', …)` printed nothing. |
| medium | bug | `.claude/scripts/it-titles.sh:19` | Collapsing newlines and whitespace makes a multi-line backtick title identical to a single-line title, so a change between them passes the diff. | Valid: reproduced by the reviewer. |

Round 2 of T8P.2's bug tasks:
- **T8P.2-B2** (finding 1). Case: *it should list an `it.each` case whose table holds a regex literal or a comment with brackets or quotes.*
- **T8P.2-B3** (finding 2). Case: *it should list a multi-line title differently from a single-line title with the same words.*

**Implementation-level decision: one task for both, with a different design.** Both findings come from parsing TypeScript with patterns, and each fix by pattern invites the next edge case, as the T8P.1 lock rounds showed. So B2 and B3 go to one `tdd-task`: `it-titles.sh` lists the cases from Vitest's own collection (`vitest list`) instead of parsing source, printing each case's exact title (with its describe path), so every form and every character survives. One commit, one review. If Vitest's listing proves unworkable, the task falls back to fixing the two patterns.

### T8P.2-B2 and B3 (`f8f59e9f`)

Fix: `it-titles.sh` lists cases from Vitest 4.1.12's Node API (`createVitest(...).collect()`, via `node --input-type=module -e`, about 3 s), since the `vitest list` CLI drops skipped cases.
- **Output.** One line per collected case: the describe path and title joined by " > ", with `\` escaped as `\\`, newlines as `\n`, and a `skip: ` or `todo: ` prefix. No file name. Sorted with `LC_ALL=C`.
- **Errors.** A collection error exits 1.

Each fixture runs in a scratch tree with its own config.
- B2 was red (4 lines expected, none listed), then green.
- B3 was red (`should multi line` twice), then green.
- B1's test was moved to the new format.
- Rows are in [tdd-log/T8P.2-B2.md](tdd-log/T8P.2-B2.md) and [tdd-log/T8P.2-B3.md](tdd-log/T8P.2-B3.md).

On the real tree: 1519 lines at `cf690cb2` (via `git archive`) and 1519 at HEAD, with an empty diff, so T8P.2's moves also kept every describe name. The 4 extra lines over the old 1515 are `it.each` expansion. `it.only` lists as a plain case.

ocr: session `7d22fbb9-f842-416e-a251-ba206bdb2013`, model gpt-6.1-sol, 2 files reviewed (2 excluded, the logs), 1 comment. Raw output: [ocr/T8P.2-B2-B3-f8f59e9f.json](ocr/T8P.2-B2-B3-f8f59e9f.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | test | `.claude/scripts/it-titles.test.sh:23` | The scratch `vitest.config.mjs` leaves `allowOnly` at its default (false when `CI` is set), so the b1 fixture's `it.only` makes collection fail under CI. | Valid: `CI=1 bash .claude/scripts/it-titles.test.sh b1` failed with `FAIL: b1: exit 1`. |

- **T8P.2-B4** (round 3 of T8P.2's bug tasks; if its review still leaves findings, the session stops). Case: *it should pass the `it.only` fixture with `CI` set.*

### T8P.2-B4 (`bf91aea7`), round 3

Fix: the shell test's scratch `vitest.config.mjs` sets `allowOnly: true`. `it-titles.sh` is unchanged, so a real `it.only` under `src/` still fails collection in CI. Red: `CI=1 bash .claude/scripts/it-titles.test.sh b1`, giving `FAIL: b1: exit 1`. Green: the same command, then the whole test with and without `CI`. Rows are in [tdd-log/T8P.2-B4.md](tdd-log/T8P.2-B4.md).

ocr: session `3901471b-1ca8-4597-b6bf-d8fb4c7b5292`, model gpt-6.1-sol, 1 file reviewed (1 excluded, the log), 0 comments. **No findings.** Raw output: [ocr/T8P.2-B4-bf91aea7.json](ocr/T8P.2-B4-bf91aea7.json). T8P.2's bug tasks are closed.

### T8P.2 complete cumulative run (`t8p-2`)

Unit and integration ran at `5cbcec4e`, and browser and checks at `7904cee7` (a Progress-only commit landed during the run), 2026-11-13. Browser stage `browser-auto f2ab6560` printed `browser tier: full (first matching path since f2ab6560: src/main.tsx)`, so the runner ran `browser-1` and `browser-2`. Ports 5175, 9341 and 9342 were free before and after. `run-complete.sh evidence/D08P t8p-2`: run complete.

| Suite | Result | Output |
|---|---|---|
| Unit | 138 files, 1519 tests passed, exit 0 | [suite-runs/t8p-2-unit.txt](suite-runs/t8p-2-unit.txt) |
| Node integration | 103 files, 218 tests passed, exit 0 | [suite-runs/t8p-2-integration.txt](suite-runs/t8p-2-integration.txt) |
| Browser, full tier, browser-1 (Chromium) | 119 passed (4.6 min), exit 0 | [suite-runs/t8p-2-browser-1.txt](suite-runs/t8p-2-browser-1.txt) |
| Browser, full tier, browser-2 (Chromium) | 74 passed (4.3 min), exit 0 | [suite-runs/t8p-2-browser-2.txt](suite-runs/t8p-2-browser-2.txt) |
| Checks (14 commands) | 14 of 14 exit 0 | [suite-runs/t8p-2-checks.txt](suite-runs/t8p-2-checks.txt) |

## Lane creation (user's decision, 2026-11-13)

The first lane pair (T8P.3, T8P.4) was dispatched with the Agent tool's `isolation: "worktree"`, as section 9 says. The tool created both worktrees under the main checkout (`trade-journal-v3/.claude/worktrees/agent-…`), based on `4185bae7`, which has no `plan/` and no `.claude/scripts/`. Both agents stopped at lane rule 1 (`lane-setup.sh`: exit 127) without changing anything, and the tool removed both worktrees and branches.

**The user chose "Main session creates lanes".** The main session runs `git worktree add .claude/worktrees/d08p-<lane> -b d08p/<lane> <head>` inside this worktree, which is section 9's path and branch. It then dispatches each `tdd-task` without the isolation flag, told to work only in that lane's absolute path and to start with `lane-setup.sh`. Only the mechanism differs from section 9. T8P.3 and T8P.4 have no lane name in section 4.2, so their lanes are `d08p-t8p3` and `d08p-t8p4`.

## T8P.3 Types and rule

Lane `d08p/t8p3`, 2026-11-13. Types and one lint rule only; no behavior.

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npx tsc6 --noEmit` | exit 0 |
| `npm run lint` (no planted import) | exit 0 |
| `npm run lint:deps` | exit 0 (380 modules, no violations) |
| `npx vitest run tools/cockpit-rules.test.ts` | 6 passed: an `app/types` or `coordinators/**` import fails in a non-props cockpit file, and passes in `*.props.ts`, its test, and elsewhere |
| `npm run lint` with `src/ui/cockpit/rail/plant.types.ts` importing `../../../app/types.ts` (removed afterwards) | exit 1: `no-restricted-imports ... cockpit-import: app/types is imported only by a *.props.ts adapter (A216)` |

Added: `src/coordinators/trade-views/replay-view.ts`; `nearest?: true` on `ConditionStatus`; `days?: number` on `ContractExpiration`; the props types under `src/ui/cockpit/` (rail: identity, pnl, conditions, needs-you; drawers: today, position, plan-risk, payoff, price-history, journal; root: track, footer); `eslint.cockpit.config.js`; `tools/cockpit-rules.test.ts`.

### T8P.3 ocr review and merge

ocr on `80743173` (in the lane): session `b0a304d6-2d46-4dda-a86a-84bc6b4bfe21`, model gpt-6.1-sol, 17 files reviewed (2 excluded: `structural.md` and the test file), 0 comments. **No findings.** One ocr warning: a `file_read` of `tsconfig.app.json`, which doesn't exist at this commit, failed. Raw output: [ocr/T8P.3-80743173.json](ocr/T8P.3-80743173.json).

Lane tier: [suite-runs/T8P.3-unit.txt](suite-runs/T8P.3-unit.txt), `-integration`, `-checks` and the `-lane` marker. 138 files and 1519 unit tests; 103 files and 218 integration tests; 14 of 14 checks; exit 0 throughout. `run-complete.sh evidence/D08P T8P.3` in the lane: run complete.

**Merge.** `d08p/t8p3` was rebased onto `claude-opus-5.5` (`268e6e92`) with no conflict; git merged this file's appends. The rebase brought in only plan and evidence commits, no code, so the lane tier wasn't rerun. Then `claude-opus-5.5` was fast-forwarded to `fe83cd1c` (rebased hashes `bba8b2bc` for the task and `fe83cd1c` for the lane tier), and the lane worktree and branch were removed.

**Implementation-level decisions accepted from T8P.3's summary:**
- The A216 rule also exempts `*.props.test.*` files, since each lane's adapter test needs view types.
- The globs `track*` and `footer*` in section 4.2 are read as relative to `src/ui/cockpit/`, so `track.types.ts` (D1) and `footer.types.ts` (D3) sit at the cockpit root, as `journal-cards.ts` does (A214).
- `replay-view.ts` isn't yet re-exported from `trade-views/index.ts`. BV (T8P.10, T8P.11) adds the export and the facade type.
- `journal.types.ts` holds a React type for `renderForm` (the one-form-at-a-time rule).

### Merge run 1 (`merge-1`, after T8P.3)

On `5fe66fc0`, 2026-11-13 10:21 to 10:32 EST. The "+ uncommitted changes" the later stages printed are this run's own output files. Browser stage `browser-auto 7904cee7` printed `browser tier: full (first matching path since 7904cee7: src/ui/cockpit/drawers/journal.types.ts)`. Ports were free before and after; the final check waited on the lock, which the T8P.4 lane held. `run-complete.sh evidence/D08P merge-1`: run complete.

| Suite | Result | Output |
|---|---|---|
| Unit | 138 files, 1519 tests passed, exit 0 | [suite-runs/merge-1-unit.txt](suite-runs/merge-1-unit.txt) |
| Node integration | 103 files, 218 tests passed, exit 0 | [suite-runs/merge-1-integration.txt](suite-runs/merge-1-integration.txt) |
| Browser, full tier, browser-1 | 119 passed (4.9 min), exit 0 | [suite-runs/merge-1-browser-1.txt](suite-runs/merge-1-browser-1.txt) |
| Browser, full tier, browser-2 | 74 passed (4.3 min), exit 0 | [suite-runs/merge-1-browser-2.txt](suite-runs/merge-1-browser-2.txt) |
| Checks (14 commands) | 14 of 14 exit 0 | [suite-runs/merge-1-checks.txt](suite-runs/merge-1-checks.txt) |

## T8P.4 Drawer reach (lane `d08p/t8p4`), the task's record

Adds `e2e/support/detail/index.ts` (`openDrawer(page, name)`, which returns at once when the Detail has no tab list named "Detail", and the full-width banner reads), one helper file per lane (`rail-a.ts`, `rail-b.ts`, `today.ts`, `position.ts`, `plan.ts`, `payoff.ts`, `journal.ts`; none for Price History) and a shared `scope.ts` (the Detail article, region, value and figure scoping). Every read goes through the current layout, scoped to its card; `detail` (the flat merge of the lane files) and `openDrawer` are re-exported by `e2e/d1/support.ts`, so every later suite's `./support.ts` carries them. `valueOf` (d6/support.ts) now takes a `Locator` only, so a page-wide Detail read no longer type-checks.

| Command | Result |
|---|---|
| `.claude/scripts/full-suite.sh evidence/D08P T8P.4 browser-1` | 119 passed (4.7 min), exit 0: [suite-runs/T8P.4-browser-1.txt](suite-runs/T8P.4-browser-1.txt) |
| `.claude/scripts/full-suite.sh evidence/D08P T8P.4 browser-2` | 74 passed (4.2 min), exit 0: [suite-runs/T8P.4-browser-2.txt](suite-runs/T8P.4-browser-2.txt). The first run failed 2 cases (d6/close-review: `answerDebt(page, undefined)` is also the Review's owed list, so it gained a `where` parameter; d7s/entry-beyond-stop: the first match was the Summary card, so it reads `summaryValue`). Both fixed, then the whole stage rerun. |
| `rg -c "openDrawer\|detail\." e2e` | 52 files, 460 lines; `openDrawer` alone: 40 files, 136 lines |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | exit 0 each (part of the checks stage) |
| `.claude/scripts/full-suite.sh evidence/D08P T8P.4 lane` | unit 1519 passed, integration 218 passed, checks 14 of 14 exit 0: [suite-runs/T8P.4-unit.txt](suite-runs/T8P.4-unit.txt), [-integration](suite-runs/T8P.4-integration.txt), [-checks](suite-runs/T8P.4-checks.txt), [-lane](suite-runs/T8P.4-lane.txt) |
| `.claude/scripts/run-complete.sh evidence/D08P T8P.4` | `run complete` |

Reach-table readers left direct, with the reason: d1/offline and d1/readiness (h1 only, outside the 44); d2/migration :71 (FROZEN release build, h1 only); d2/ui-alignment's `measureTitle` and `h1Top` (they measure the title row's geometry through `main h1`, not Detail content); d5/support `fillDebtAnswers` (page-wide `debtForm`, shared with the Review card's form, which is not a Detail read); `expectShownInFull` (takes the locator its caller scopes). Receipt and Review reads (Result region, Lot Matches on the exit receipt, "Reflection owed" on a receipt) are not Detail reads and stay.

## T8P.4 Drawer-reach helpers (lane `d08p-t8p4`)

Commits on `d08p/t8p4`: `f48eb077` (helpers and moved reads), `dadd6aeb` (browser and lane tier outputs). New `e2e/support/detail/`: `index.ts` (`openDrawer`, the banner reads, `CARDS`, `TABLES`, `root`), `scope.ts`, `rail-a.ts`, `rail-b.ts`, `today.ts`, `position.ts`, `plan.ts`, `payoff.ts`, `journal.ts`. The specs moved across `e2e/d1`, `d2`, `d4`, `d5`, `d6`, `d7`, `d7p` and `d7s`.

Verification:
- Browser tier: browser-1 119 passed; browser-2 74 passed on its rerun. The first run failed 2 cases, both fixed: `d6/close-review`'s `answerDebt` (now `where: 'Detail' | 'page'`), and `d7s/entry-beyond-stop`'s `.first()`, which had been the Summary card.
- `rg -c "openDrawer|detail\." e2e`: 52 files, 460 lines (`openDrawer` alone: 40 files, 136 lines).
- typecheck, tsc6, lint and lint:deps: exit 0. Lane tier: 1519 unit, 218 integration, 14 of 14 checks. `run-complete.sh`: run complete.

Readers left direct, with the task's reasons:
- `d1/offline` and `d1/readiness` read only the h1.
- `d2/migration:71` is the frozen release build.
- The `ui-alignment` title-geometry reads.
- `d5/support`'s `fillDebtAnswers`, which is shared with the Review.
- Receipt and Review reads.

The task's notes for later tasks are carried to the handoff: Needs-you reads scoped to the Journal card; Summary reads; the `d7/plan-open` expiration read.

### T8P.4 ocr review (`f48eb077`, test-only, relocated)

Relocated to `src/itg/d08p/` in a scratch clone (scratch commit `9da39cce`): all 61 changed non-evidence files, with no relocation artifact. Session `d149a62d-d9cd-44b6-b701-308f5f0b5866`, model gpt-6.1-sol, 61 files reviewed (0 excluded), 6 comments. Raw output: [ocr/T8P.4-f48eb077.json](ocr/T8P.4-f48eb077.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `e2e/support/detail/index.ts:19` | `openDrawer` reads `tabs.count()`, which doesn't auto-wait, so right after `goto` or `reload` it can return during loading and skip the click once the tab list exists. | Valid: `short-put.spec.ts:54-55` and `payoff-chart-layout.spec.ts:55-56` call it straight after `goto`. It would become flaky once T8P.5 lands. |
| medium | test | `e2e/d2/ui-alignment.spec.ts:378-379` | `lefts` still reads the page-wide `[role="tablist"]`, so the Detail tab list will add a key and break the exact `['card','h1']` assertion. | Valid, latent: it breaks when T8P.5 adds the tab list. |
| medium | bug | `e2e/support/detail/position.ts:19` | `realizedToDate` scopes to the whole Detail, and `DatedSection` renders its own "Realized to date", so a dated line gives two matches (a strict-mode failure). | Valid, latent: not a regression, since the old page-wide read had it too. It should scope to the Valuation card, as `openPnl` does. |
| medium | test | `e2e/d2/narrow.spec.ts:86` | The scenario opens only Plan and Risk, then measures every Detail table, so after the shell Position's tables go unmeasured. | Doubtful: depends on how T8P.5 mounts drawers. |
| medium | test | `e2e/d2/ui-alignment.spec.ts:1350` | `detailRows` measures all `dl:not(.answers)` at once, so with drawers it sees only the open drawer's lists. | Doubtful: a possible coverage change after T8P.5. |
| low | maintainability | `e2e/d5/support.ts:68` | The new `answerDebt` line nests a ternary. | Valid, trivial: style only. |

Reviewer's spot check (notes, not findings): five moved reads (`d2/open-position`, `d6/exit`, `d7/short-put`, `d7/settlement-due`, `d4/expected-mark`) keep their expected values, now scoped. The Open lifecycle read is slightly stricter (`lifecycleBadge` with `toHaveText('Open')`), as the reach table's `header .badge` row intends.

**User's decision (2026-11-13), "Batch into one task".** The six findings are bug tasks T8P.4-B1 to B6, fixed in one task on the T8P.4 lane, reviewed once. The stop rule is unchanged: a third round with findings stops the session.
- **B1** (finding 1). Case: *it should wait for the Detail to finish loading before deciding whether it has a tab list.*
- **B2** (finding 2). Case: *it should measure the Detail's cards and heading without counting the Detail tab list.*
- **B3** (finding 3). Case: *it should read Realized to date from the Valuation card when a dated line is also shown.*
- **B4** (finding 4). Case: *it should measure every Detail table in every drawer that holds one at narrow width.*
- **B5** (finding 5). Case: *it should measure the description lists of every drawer that holds them.*
- **B6** (finding 6). Case: *it should choose `answerDebt`'s scope without a nested conditional.* (Refactor, kept green.)

### T8P.4-B1 to B6 (batched, `3f85170f`) and the merge

The fix commit was `73510ab2` in the lane; it is `3f85170f` after the rebase. Its lane-tier outputs were `0a6d8a6a`, now `9bfc804e`. TDD rows: [tdd-log/T8P.4-B.md](tdd-log/T8P.4-B.md), with 5 reds and 7 greens by hand plus B6's refactor row.

**The stage.** The cases use a new helper self-test, `e2e/support/detail/helpers.spec.ts`. It builds static pages with `setContent`, plus a routed `http://stage.test/trades/t1` page for B1, and needs no app server.
- **B1.** The tab list is inserted 400 ms after load. Red: the old `openDrawer` skipped the click. Green: `openDrawer` now waits for `.trade-detail`, but only on `/trades/<id>` pages. An earlier version waited everywhere and timed out on `d7/responsive-a11y`, which calls it on the Plan form and the Review. Fixed and rerun, with a note row.
- **B2.** `lefts` moved to `leftEdges` in `e2e/support/detail/layout.ts`. It excludes a tab list inside `.trade-detail`, and a second case shows a page with no Detail still counts its own tab list.
- **B3.** `realizedToDate` is scoped to the Valuation card.
- **B4 and B5.** The new `eachDrawer(page, read)` opens each drawer in turn, and makes one pass when there is no tab list. It is used by `narrow.spec.ts`'s resolved Open Detail measure and by `ui-alignment.spec.ts`'s `detailRows`.
- **B6.** `debtFormWithoutCard(page, where)` replaces the nested ternary.

**The task's verification.**
- Real specs rerun through the lock: d2 70 passed; d1, d4, d5 and d5r 76 passed; d6, d7p, d7 and d7s 46 passed plus the 1 `d7/responsive-a11y` failure above, then 10 passed after the fix (that spec and the self-test).
- typecheck, tsc6, lint and lint:deps: exit 0.
- Lane tier: 1519 unit, 218 integration, 14 of 14 checks.

**Accepted from the task's notes:**
- The `npm run test:e2e*` filters don't name `e2e/support`, so the self-test runs only when named. T8P.5's brief adds `e2e/support` to `test:e2e:1`, before any wave-1 lane owns `package.json`.
- The "disagreeing Open Detail" measure in `narrow.spec.ts` stays a single pass, since its table is the full-width banner, outside every drawer.
- `eachDrawer` skips a name with no tab, so T8P.5 uses W1's names exactly.

**ocr on `73510ab2`** (test-only, relocated):
- Scratch commit `e1477360` on base `a77ad88a`.
- Session `b5f53aac-9f58-40e1-b996-84fde9d31859`, model gpt-6.1-sol, 8 files reviewed (0 excluded), 0 comments. **No findings.**
- One ocr warning: a guessed `support/detail/core.ts` read failed.
- Raw output: [ocr/T8P.4-B-73510ab2.json](ocr/T8P.4-B-73510ab2.json).

**Merge.**
- `d08p/t8p4` was rebased onto `claude-opus-5.5` (`ee43d21b`). The rebase changed one file the task doesn't own: `structural.md` conflicted, since both sides appended. It was resolved by keeping both, with the task's own T8P.4 record placed before the main session's T8P.4 section, its heading restored.
- The rebase also brought in T8P.3's code (the types and the A216 rule). So the lane tier was rerun on the rebased lane (`full-suite.sh evidence/D08P T8P.4-rebased lane`): 1519 unit, 218 integration and 14 of 14 checks, exit 0, and `run-complete.sh`: run complete. Outputs in `a33a9e9e`.
- `claude-opus-5.5` was fast-forwarded to `a33a9e9e`. Rebased hashes: `4f40c2f3` (task), `3dcb2d21` (its tiers), `3f85170f` (B1–B6), `9bfc804e` and `a33a9e9e` (lane tiers). The lane worktree and branch were removed.

## T8P.5 in a lane (implementation-level decision)

T8P.5 runs in the lane `d08p-t8p5` (`.claude/worktrees/d08p-t8p5`, branch `d08p/t8p5`, base `3ea6239d`), not in the main worktree. The reason: merge run 2 (after T8P.4) runs on the main worktree at the same time, and a task editing that tree would change what the run tests. The browser lock keeps their browser runs apart. T8P.5 still ends with the full browser tier, because it moves content into drawers across every Detail spec.

### Merge run 2 (`merge-2`, after T8P.4)

The complete cumulative run on `64cd1bd8`, by `suite-runner`, with `browser-auto 5fe66fc0`. The tier was full, since the first matching path was `e2e/d1/plan.spec.ts`. Evidence commit: `d2234dc8`. It ran beside T8P.5's lane, and the browser lock kept them apart. Ports were free before and after. `run-complete.sh`: run complete.

| Suite | Result | Output |
|---|---|---|
| Unit | 138 files, 1519 tests passed, exit 0 | [suite-runs/merge-2-unit.txt](suite-runs/merge-2-unit.txt) |
| Node integration | 103 files, 218 tests passed, exit 0 | [suite-runs/merge-2-integration.txt](suite-runs/merge-2-integration.txt) |
| Browser, full tier, browser-1 | 119 passed (4.9 min), exit 0 | [suite-runs/merge-2-browser-1.txt](suite-runs/merge-2-browser-1.txt) |
| Browser, full tier, browser-2 | 74 passed (4.5 min), exit 0 | [suite-runs/merge-2-browser-2.txt](suite-runs/merge-2-browser-2.txt) |
| Checks (14 commands) | 14 of 14 exit 0 | [suite-runs/merge-2-checks.txt](suite-runs/merge-2-checks.txt) |

## T8P.5 Cockpit shell (lane `d08p-t8p5`)

Commits on `d08p/t8p5`, base `64cd1bd8`:
- `4c2d49da` (the shell);
- `b960f9ac` (seven e2e specs read the legacy Valuation through Today);
- `9ac7cb06` (its run outputs).

TDD rows: [tdd-log/T8P.5.md](tdd-log/T8P.5.md). The five cases' reds:
- `Unable to find role="region" and name "State of play"`;
- a `TypeError` reading `view.settlement` on a Planned view (a runtime exception from the missing Planned branch);
- `expected [ 'Today', … ] to not include 'Today'`;
- the incoherent tab list's deep-equal;
- `expected 'Today' to be 'Position'`.

**Flagged: code written ahead of red.** The agent wrote the whole shell while greening case 1. For cases 2 to 5 it reverted each case's own code to see a genuine red, then restored it. This is recorded as a note row in the log, and carried to the final report.

**Verification by the task.**
- A complete cumulative run in the lane (`T8P.5-{unit,integration,browser-1,browser-2,checks}.txt`, all exit 0); `run-complete.sh`: run complete.
- `it-titles.sh` diff: additions only, 18 titles (the 5 cases, plus 13 path-file cases: 8 re-exports and 5 placeholders).
- Section 6.3's diff script (in the session scratchpad, `check-moved-diffs.mjs`): all 9 changed test files add only `openDrawer` lines, user setup and the import edit, and remove nothing else. That is 53 cases and 57 lines: Journal 22, Position 18, Plan and Risk 8, Payoff 8, Today 1.

**Implementation-level decisions accepted from the summary:**
- **More than one `openDrawer` line in some cases.** Section 6.3's "only that line" is read as "only `openDrawer` lines". Cases that render twice or read two drawers have 2 or 3 lines; the script proves nothing else changed.
- **`PlanForm.test.tsx` gains 1 Payoff line**, since its receipt test renders the whole Detail.
- **The Needs-you debt reads are reached in the specs, not the helpers.** `await openDrawer(page, 'Journal')` is added once before the first debt read in 9 specs: d5/detail-debt, faults, review-debt, responsive, kill-offline; d6/kill, update, runtime-failure; d7/kill. The helpers return Locators and can't click.
- **Seven specs read the legacy Valuation through Today**, not Position: d4/breach-overrun, expected-mark, responsive-a11y; d6/exit, runtime-failure; d7/short-put; d7p/layout. T8P.17 flips them back with `position.ts` (handoff note).
- **`src/ui/cockpit/styles/shell.css`** is new and belongs to the shell, so no lane edits it. It holds the tab-wrap rule, without which six tabs overflowed 320 px.
- **Placeholders render nothing:** `rail/pnl`, `rail/conditions`, `drawers/price-history`, `journal-cards`, `track` (`(props: ShellProps) => null`). The other 8 paths re-export a composition from `screens/trade-detail/Composed.tsx`.
- **Legacy blocks:**
  - The Summary card is in the rail, except on an incoherent Detail.
  - On Open, Valuation and Risk and reward are in Today.
  - On Settlement Due, they sit atop Position, the default.
  - Closed, Planned and incoherent have neither block.
- **Price History** shows on Open, Settlement Due and Closed, and not on Planned or incoherent, as the cases imply.
- **Stale release builds.** The task's first d2 and d4 runs passed against stale `dist-releases` builds; only runs after `build:releases` count.

### T8P.5 ocr review (`64cd1bd8..b960f9ac`)

In the lane: session `8e86b2ec-104d-4d5e-8678-87a592b75b0b`, model gpt-6.1-sol, ocr v1.13.9. 30 files reviewed, 39 excluded (tests and specs, by ocr's own exclusions), 5 comments. One harmless warning: a failed read of `src/ui/main.tsx`. Raw output: [ocr/T8P.5-64cd1bd8..b960f9ac.json](ocr/T8P.5-64cd1bd8..b960f9ac.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| high | bug | `Cockpit.tsx:130` | Changing drawers unmounts the Journal drawer and its open `DebtForm`, discarding an unsaved reflection and clearing the leave-page guard. | Valid. It is new: the old page kept the Journal mounted. It follows from the brief's "mount only the selected panel", which was the main session's implementation-level choice. |
| medium | bug | `Cockpit.tsx:98` | A saved reflection's resolved state lives in `OwedDebtItem`'s local state, so after a drawer round trip the debt shows "Reflection owed" again. | Valid. Same cause. |
| medium | bug | `styles/shell.css:2` | Nothing lays out `.cockpit-rail` beside `.cockpit-drawers`, so the rail stacks above the drawers at every width. | Valid. |
| medium | bug | `Cockpit.tsx:118` | No wide layout, and no full-width banner rule. | Valid. The same gap as the row above, so the two make one bug task. |
| medium | bug | `Cockpit.tsx:136` | The tabpanel needs `tabIndex={0}`, since Plan and Risk and Price History have no focusable first content. | Valid, minor (the WAI-ARIA tabs pattern). |

Bug tasks, run one after another by one agent in the lane, each with its own red, green and commit, then one ocr over the range:
- **T8P.5-B1** (findings 1 and 2). Every drawer panel stays mounted, and the inactive ones are `hidden`. This replaces the brief's mount-only-the-selected choice, and also makes text-query absence assertions meaningful again. Cases:
  - *it should keep an unsaved reflection when the reader moves to another drawer and back*;
  - *it should still show a saved reflection as saved after moving to another drawer and back*.
- **T8P.5-B2** (findings 3 and 4). Case: *it should place the rail beside the drawers at a wide viewport, with the banner across both, and stack them at a narrow one.*
- **T8P.5-B3** (finding 5). Case: *it should let the keyboard reach the selected drawer's panel.*

### T8P.5-B1 and B3 (`9e226c5b`, `86f85156`, `fdc9b1e5`), and B2 stopped

**T8P.5-B1** (`9e226c5b`, with `86f85156` for e2e). Every shown drawer's panel stays mounted, and the unselected ones are `hidden`.
- Reds:
  - the unsaved-reflection case: `onDirtyChange` last called with true failed;
  - the saved-reflection case: the "Saved reflection" region was missing, since the remounted panel showed "Reflection owed".
- One wrong-filter run (the `-t` filter included "it ", so no case ran) is logged as a note, not a red.
- `86f85156` appends `:not([hidden] *)` to `detail.CARDS`, `TABLES` and `figureAmounts` in `e2e/support/detail/index.ts`, so page-wide measures see the same elements as before. The hidden panels' cards had zero boxes and failed the 16 px gutter check. This is outside the brief's scope list, but mechanical and in its own commit, so it is accepted.

**T8P.5-B3** (`fdc9b1e5`). Every panel has `tabIndex={0}`. Red: `expected -1 to be +0`.

**Runs** (`cdc75a72`):
- typecheck, tsc6, lint and lint:deps exit 0;
- lane tier: 1540 unit, 218 integration, 14 of 14 checks;
- browser-1 127 passed, browser-2 74 passed;
- `run-complete.sh`: run complete;
- `it-titles.sh`: only the three new titles.

**Absence assertions that still can't see what they rule out** (B1's report; not ocr findings, so no bug task):
- `Cockpit.test.tsx:41-42` (Open Lots and Position regions, with a stale comment above);
- `Banner.test.tsx:133` (the derived-region loop with Journal open);
- `Result.test.tsx:51` (the `'Position'` region).

These are role queries, which skip hidden panels. Carried to the final report.

**T8P.5-B2 stopped, as the brief required.** The prototype layout (a 320 px rail beside a `minmax(0,1fr)` drawer column, the banner across both, one column at 860 px and below) passed its new spec, `e2e/d2/cockpit-layout.spec.ts`. Its red was "rail right edge, wide", received 1214. But it broke two `ui-alignment.spec.ts` checks:
- :216 T2.60-B4, the icon at 608 against the column's right edge;
- :1777 T2.64, the Fulfillment value at 1123 against the Summary values at 585.

The work is saved in the session scratchpad's `b2/`.

**The user's decision (2026-11-13), "Keep the intent, re-anchor".** Plan revision 87: both checks keep their meaning and measure against their new container. B2 resumes with its layout and those two changes.

### T8P.5-B2 (`6a9f29e8` after the rebase), round 2 ocr, and the merge

**T8P.5-B2.** The prototype's grid is on `.trade-detail`: a `320px minmax(0,1fr)` grid with a 16 px gap, the `.integrity` banner across both columns, and one column at 860 px and below. The new spec `e2e/d2/cockpit-layout.spec.ts` went red with "rail right edge, wide", received 1214, then green.

Revision 87's two re-anchored checks, each red on the old anchor and green on the new, at tolerance 1:
- **T2.60-B4.** The icon is measured against its title row: the h1's parent, minus padding. It was off by 608 before; now 0. Other screens keep the page column.
- **T2.64.** The Fulfillment value is compared with the visible drawer's `dd`s above it, with a non-empty guard: 1123 against 1123, where before it was 1123 against 585. The Journal's `dl.answers` prose is excluded, since it isn't a value column, as the old Summary-only anchor implied.

Runs (`833ad19a`):
- after `build:releases`, the lane tier: 1540 unit, 218 integration, 14 of 14 checks;
- browser-1 128 passed, browser-2 74 passed;
- `run-complete.sh`: run complete.

**Round 2 ocr on `9ac7cb06..7e93c1f6`.**
- In place: session `c99f8b58-f309-4892-8ca0-3a6153df5423`, 3 files reviewed, 4 excluded (tests and specs), 0 comments.
- Relocated (the three test files under `src/itg/d08p/`, scratch commits `93a6f0e4` and `1fa703cd`): session `7134266b-546d-4295-add9-35fee7b9960c`, 6 files reviewed, 0 comments.
- Model gpt-6.1-sol. **No findings.** Raw output: [ocr/T8P.5-B-9ac7cb06..7e93c1f6.json](ocr/T8P.5-B-9ac7cb06..7e93c1f6.json) and [-relocated](ocr/T8P.5-B-9ac7cb06..7e93c1f6-relocated.json).

The reviewer's notes (not findings, carried to the final report):
- `Cockpit.test.tsx`:~38's comment "Only the selected drawer is mounted" is stale. Its `queryByRole … toBeNull` checks now test that a hidden drawer isn't visible, which is still valid.
- No sticky rail, unlike the prototype's `.c-rail`.
- Between about 960 and 1100 px, the app's sidebar, the rail and the drawers share the width.

**Merge.** `d08p/t8p5` was rebased onto `claude-opus-5.5` (`b6fa7932`) with no conflict. The rebase brought in only plan and evidence commits, so the lane tier wasn't rerun. `claude-opus-5.5` was fast-forwarded to `833ad19a`, and the lane worktree and branch were removed.

Rebased hashes:
- `f0c51e60` (shell), `0577e92d` (e2e Valuation reads), `aa2c1b96` (runs);
- B1 `74ef50ce` and `002a78e9`; B3 `e45e6363`; runs `2e61898b`;
- B2 `6a9f29e8`; runs `833ad19a`.

## Wave 1, first dispatch (2026-11-13)

Six lanes from `12a396c0` (Progress rows say `ac089378`; only plan and evidence differ): BV T8P.9, BA T8P.6, BM T8P.8, R2 T8P.14, R1 T8P.12, D2 T8P.17. Merge run 3 (after T8P.5) runs on the main worktree at the same time.

**Implementation-level decisions in the wave-1 briefs:**
- **Test data.** Section 5 says "a cockpit fixture builder joins `tests/support/`", but no lane owns `tests/support/`. UI lanes import existing fixtures read-only, and build new view data inside their own `*.props.test.ts`, the only file under `src/ui/cockpit/` that A216 lets import `app/types`. A lane needing a shared new fixture stops. T8P.22 or T8P.27 may consolidate.
- **Shared spec files.** A lane edits only its owned files, plus the spec and unit-test lines section 1.5 assigns to its task (and, for D2, the seven spec lines T8P.5's note names). Other lanes change other lines of the same file, as section 4.2 expects.
- **Optional fields from parallel lanes.** R2 tests `nearest`, and R1 tests `days`, with view data that carries the field (typed since T8P.3), and shows nothing extra when it is absent. The backend lanes fill the fields.

### Merge run 3 (`merge-3`, after T8P.5)

The complete cumulative run on `9027c247`, by `suite-runner`, with `browser-auto 64cd1bd8`. The tier was full, since the first matching path was `e2e/d2/cockpit-layout.spec.ts`. Evidence commit: `c903e711`; it also carried the main session's uncommitted wave-1 note in this file. `run-complete.sh`: run complete. Ports were free before and after.

| Suite | Result | Output |
|---|---|---|
| Unit | 152 files, 1540 tests passed, exit 0 | [suite-runs/merge-3-unit.txt](suite-runs/merge-3-unit.txt) |
| Node integration | 103 files, 218 tests passed, exit 0 | [suite-runs/merge-3-integration.txt](suite-runs/merge-3-integration.txt) |
| Browser, full tier, browser-1 | 128 passed (6.5 min), exit 0 | [suite-runs/merge-3-browser-1.txt](suite-runs/merge-3-browser-1.txt) |
| Browser, full tier, browser-2 | 74 passed (4.7 min), exit 0 | [suite-runs/merge-3-browser-2.txt](suite-runs/merge-3-browser-2.txt) |
| Checks (14 commands) | 14 of 14 exit 0 | [suite-runs/merge-3-checks.txt](suite-runs/merge-3-checks.txt) |

### User decisions during wave 1 (2026-11-13)

- **T8P.6 stopped.** The new `nearest` failed one strict expectation in lane BV's `current-evaluation.test.ts`. The user chose "Add nearest to that helper".
- **T8P.9** had changed two strict expectations in `tests/integration/d7sp/trade-detail-finished.test.ts` to `days: 1`, which no row allowed. The user chose "Approve, plus a general rule".

Both are plan revision 88 (section 1.5, "Shapes").

## T8P.8 ReadSeries (lane `d08p-bm`)

Commits on `d08p/bm`: `3d830716` (the task), `5dab1848` (lane tier: 1544 unit, 218 integration, 14 of 14 checks; `run-complete.sh`: run complete). TDD rows: [tdd-log/T8P.8.md](tdd-log/T8P.8.md).

Flagged:
- **Case 3 was a first-run pass.** Its mutation (the effective revision minus 1) failed with `AssertionError`, and the code was restored.
- **Case 2 was coded ahead of red.** The clipping was in case 1's code, so it was reverted for a genuine red and restored. The log keeps the earlier "passed" row.

Case 4's red exposed a real double scan when `series` ran before `gaps`, so `scanOf` now compares the first relevant session. The query-count proof keeps its request list.

Public additions, for T8P.10 and T8P.11:
- `ReadSeriesQuery`, `SeriesPoint` (Available, Missing or AcknowledgedUnavailable), and the `Series` query result;
- `MarketDataReadSession.series(instrumentKey, from, to)`.
- `MarketData.query` in `src/app/types.ts` is untouched. T8P.11 adds the facade member.

### T8P.8 ocr review (`3d830716`)

In the lane: session `5a764ad7-abf6-43b1-9f4f-83a6e9988529`, model gpt-6.1-sol, ocr v1.13.9. 2 files reviewed, 2 excluded, 2 comments. Raw output: [ocr/T8P.8-3d830716.json](ocr/T8P.8-3d830716.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `market-data.ts:944-945` | `series` dereferences `frame!.resolution` from `framesAt`, which is empty when the read session is on the first covered session (no previous session), so it throws a TypeError. | Valid: `frameResult` returns `Rejected` there, and `framesAt` drops it. |
| medium | bug | `market-data.ts:942-944` | `series` awaits `scanOf` before calling `framesAt`, so the history and the final point are read in separate snapshots, against `openReadSession`'s one-snapshot rule. | Valid, narrow. |

Bug tasks, run by the task's agent in the lane:
- **T8P.8-B1.** Case: *it should give the series on the first covered session without a previous session.*
- **T8P.8-B2.** Case: *it should read a series's history and its final point in one snapshot.*

## T8P.6 Nearest condition (lane `d08p-ba`): reviews and merge

Task summary:
- Cases 1 and 2 had genuine reds. In case 1, the first green failed on wrongly guessed condition ids, so the test was corrected and the failed green row kept.
- Cases 3 and 4 were first-run passes, flagged: the Value-headline guard and `find`'s first match. Their mutations failed with assertions (mark a non-Value headline's first condition; `findLast`), and both were restored.
- Revision 88's line is in `current-evaluation.test.ts` (`cf94431d` after the rebase).
- O-S2's condition ids are `stop-1`, `stop-2`, `target-1` and `target-2`, in Plan order.
- The lane tier after the fix: 1544 unit, 218 integration, 14 of 14 checks; `run-complete.sh`: run complete.

**ocr on `12a396c0..ba8a2079`.** Session `04f83818-2624-4ed0-a2a0-214024f72ecd`, model gpt-6.1-sol. 1 file reviewed (`evaluate.ts`), 3 excluded (two tests, one log), 0 comments. **No findings.** The reviewer notes the run was short (6 s, one file read). Raw output: [ocr/T8P.6-12a396c0..ba8a2079.json](ocr/T8P.6-12a396c0..ba8a2079.json).

**Merge.** Rebased onto `claude-opus-5.5` with no conflict, bringing in only plan and evidence, so the lane tier wasn't rerun. Fast-forwarded to `eb08ab37`. Rebased hashes: `3c234ab6` (task), `cf94431d` (revision 88 line), `eb08ab37` (lane tier). The lane was removed.

## T8P.9 ocr review (`12a396c0..83ddb848`)

Session `c6c984a3-a560-4128-afb9-d40da9dff4ab`, model gpt-6.1-sol. 6 files reviewed (the five product files and `package.json`), 9 excluded (four tests and specs, five evidence files), 0 comments. **No findings.** Raw output: [ocr/T8P.9-12a396c0..83ddb848.json](ocr/T8P.9-12a396c0..83ddb848.json).

T8P.9 waits to merge until T8P.12 (the identity card, which shows the days) has merged. B8P.3 is then extended to "Expires Fri 18 Dec 2026 (… days)", as section 7.2 requires.

Other T8P.9 points accepted from its summary:
- Its two flagged first-run passes, with assertion mutations.
- `trade-workflows.ts` importing `expirationLineOf` from the Trade Views index (`lint:deps` accepts it).
- Its titles restored word for word (`83ddb848`).

### T8P.8-B1 and B2 (`3e6a679d`, `1994c211`), round 2 ocr

- **B1.** `series` no longer uses `framesAt`'s `!`: a new `evidenceFor` reads the date's evidence and records it for `binding()`. Red: `TypeError: Cannot read properties of undefined (reading 'resolution')`.
- **B2.** `scanOf` and `evidenceFor` are queued in one synchronous run. Red: two transactions where one was expected.

Lane tier (`ee47e047`): 1546 unit, 218 integration, 14 of 14 checks; `run-complete.sh`: run complete. The task notes that `tdd.sh` writes the test name, not the bug ID, so note rows name the bug.

**Round 2 ocr on `5dab1848..1994c211`.** Session `54f9cf44-a832-4050-8c7f-aa827d6e6d47`, model gpt-6.1-sol, 1 file reviewed, 2 excluded, 1 comment. Raw output: [ocr/T8P.8-B-5dab1848..1994c211.json](ocr/T8P.8-B-5dab1848..1994c211.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `market-data.ts:950-951` | `series` awaits `scanning`, then `reading`. When the shared batch's snapshot read fails, both reject, and `reading` has no handler once the first await throws: an unhandled rejection. | Valid: `batchOf`'s `.catch` rejects every promise in the batch. `Promise.all` fixes it. |

Bug task **T8P.8-B3**. Case: *it should reject a series once, with no unhandled rejection, when its snapshot read fails.* This is round 3 for T8P.8: if its review still has findings, the session stops for the user.

## T8P.12 Identity card (lane `d08p-r1`)

Commits on `d08p/r1`:
- `7ab5ae7b` (the task);
- `003262eb` (lane tier);
- `f2cafc21` (titles restored word for word);
- `8de8139e` (lane tier rerun, all passed). An earlier rerun, `df6a2bb0`, recorded a one-off timing flake in `ReviewCards.test.tsx` ("should open the first card holding XYZ in attention order…", 135 ms under load). That case passes alone (50 of 50) and on the rerun.

TDD rows: [tdd-log/T8P.12.md](tdd-log/T8P.12.md). Case 3 was a first-run pass, flagged: the mutation reads `contractExpiration` only with `positionChanges`, and fails with an element-not-found.

**Accepted as implementation-level:**
- `identity.types.ts` is reshaped: actions carry `to: string`, and `backTo` keeps "Back to Trades".
- Badge expectations change to "<Strategy>, <Lifecycle>" under section 1.5's `header .badge` row: unit lines in six `trade-detail/*.test.tsx` files, and seven e2e lines in six specs. The `lifecycle` helper matches the trailing ", Open".
- The expiration lookups in `Summary.test.tsx` are scoped to the Summary region.
- T8P.5's placeholder test is deleted.
- `IdentityCardFromView` takes the shell's `timeZone` and doesn't use it.

### T8P.12 ocr review (`12a396c0..f2cafc21`)

- In place: session `6ce77482-0d9a-4366-9601-7424d899ecd2`, 5 files reviewed, 19 excluded, 2 comments.
- Relocated (14 test and spec files under `src/itg/d08p/`, scratch commits `aef26546` and `6439eec1`): session `a1060edc-024d-48d8-8eb1-b411ba5e846a`, 14 files reviewed, 2 comments.
- Model gpt-6.1-sol. Raw output: [ocr/T8P.12-12a396c0..f2cafc21.json](ocr/T8P.12-12a396c0..f2cafc21.json) and [-relocated](ocr/T8P.12-12a396c0..f2cafc21-relocated.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `identity.props.ts:28` | `expiration.days` is always undefined with real data, since `expirationLineOf` returns no `days`, so the counts never show. | Wrong for this task: T8P.9 adds `days` to `expirationLineOf` (reviewed clean, merging right after T8P.12), and T8P.12 handles it correctly when present. B8P.3 is extended to the days words when T8P.9 merges, which proves it end to end. |
| low | maintainability | `identity.props.ts:11` | `daysText` nests a ternary. | Valid, style only. |
| high | bug | `src/itg/d08p/rail/identity.props.tsx:11-12` | The imports don't resolve. | Wrong: a relocation artifact. The real file's imports resolve. |
| medium | test | `src/itg/d08p/rail/identity.props.tsx:39` | No Vitest project discovers the suite. | Wrong: a relocation artifact (`.test` was dropped from the copy's name). |

Bug task **T8P.12-B1** (finding 2). Case: *it should choose the days text without a nested conditional.* A refactor, kept green.

## T8P.14 Conditions card (lane `d08p-r2`)

Commits on `d08p/r2`:
- `b4fdcc87` (the task);
- `77746a24` (lane tier);
- `72ae931a` (case titles and B7S.3's title restored word for word);
- `23ecbbed` (lane tier rerun: 1548 unit, 218 integration, 14 of 14 checks; `run-complete.sh`: run complete).

TDD rows: [tdd-log/T8P.14.md](tdd-log/T8P.14.md). There were no first-run passes. The Underlying wording was written ahead of case 3, so it was reverted for a genuine red and restored (a note row).

**Accepted:**
- one extra case for W6's notes;
- expectation changes under the "Risk to stop" and "Table Conditions" rows (`d7s/conditions`, `d7s/responsive-a11y`, `d7/settlement-due :48`);
- `ConditionsCard` taking shell or plain props;
- Max reward without an R, which plan revision 89 settles in T8P.7 and T8P.15.

### T8P.14 ocr review (`12a396c0..72ae931a`)

- In place: session `97c40e2c-5adf-4420-bf3d-6e7cf57cc6bb`, 4 files reviewed, 8 excluded, 3 comments.
- Relocated (5 test and spec files under `src/itg/d08p/`, scratch commits `bd209f2c` and `7f9e2f15`): session `3f9315d4-fad2-48e4-bfe1-c2da46555108`, 5 files reviewed, 5 comments.
- Model gpt-6.1-sol. Raw output: [ocr/T8P.14-12a396c0..72ae931a.json](ocr/T8P.14-12a396c0..72ae931a.json) and [-relocated](ocr/T8P.14-12a396c0..72ae931a-relocated.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `conditions.props.ts:91-92` | The "before any Marks" test also matches AwaitingClose after shares are added following an earlier Mark, so the card says the first Marks haven't arrived and hides Worst case and Max reward. | Valid: `evaluate` returns AwaitingClose for a lot opened after the latest close, as in `d4/breach-overrun`'s Tuesday. The main session flagged this in the brief. |
| medium | bug | `conditions.props.ts:53-54` | An Unavailable reason that isn't a missing Mark (for example "Outside calendar") is hidden, against W5's "the reason at the `label` length". | Valid, narrow. |
| low | maintainability | `conditions.props.ts:40-44` | A nested ternary chooses the subject wording. | Valid, style only. |
| high | test | relocated `d7s/responsive-a11y.ts:55` | `detail.conditionBlocks` isn't exported. | Wrong: a relocation artifact (`rail-b.ts:18` exports it). |
| high | bug | relocated `d7s/conditions.ts:51` | The three helpers aren't implemented. | Wrong: a relocation artifact (`rail-b.ts:18-21`). |
| high | bug | relocated `rail/conditions-props.ts:10` | The import resolves to a test module. | Wrong: a relocation name collision. |
| medium | test | relocated `rail/conditions-props.ts:32` | No Vitest project discovers the suite. | Wrong: a relocation artifact (`.test` was dropped). |
| high | test | relocated `d7s/responsive-a11y.ts:58` | The assertion runs before any Marks. | Wrong: the regex includes "Mark missing", the Tuesday 17:00 label, and the run passed. |

Bug tasks:
- **T8P.14-B1** (finding 1). An Unavailable condition that awaits a close after earlier Marks shows its reason on row 1, at the `label` length (W5), with Worst case and Max reward beneath. W6's "Distances to each condition and the worst case arrive with the first Marks." stays only for a Trade with no Mark yet. The signal must come from the view's data (for example its Mark provenance or dated line), not from branching on a reason code outside `calculation-words.ts`. If the view has none, the task stops. Case: *it should show the reason on row 1, not the first-Marks note, when shares were added after an earlier Mark.*
- **T8P.14-B2** (finding 2). Case: *it should show any other Unavailable reason at the label length on row 1.*
- **T8P.14-B3** (finding 3). Case: *it should choose the subject wording without a nested conditional.* A refactor, kept green.

### T8P.8-B3 (`18496f2f`)

`series` now awaits `Promise.all([scanning, reading])`: one snapshot, with case 4's request list unchanged. Case: "should reject a series once, with no unhandled rejection, when its snapshot read fails". Red: `AssertionError: expected [ Error: snapshot read failed ] to deeply equal []`. The agent found no other sequential awaits of two promises from one batch in the ReadSeries work. Lane tier (`94470d28`): 1547 unit, 218 integration, 14 of 14 checks; `run-complete.sh`: run complete. Round 3 ocr on `ee47e047..18496f2f` was dispatched.

## T8P.17 Position drawer (lane `d08p-d2`): ocr review

- Product code (`12a396c0..48ae877b`): session `d91ec51b-eab2-4030-973e-756aa0794110`, 5 files reviewed (`position.tsx`, `position.props.ts`, `position.types.ts`, `position.css`, `e2e/support/detail/position.ts`), 14 excluded, 0 comments.
- Relocated (`position.props.test.tsx`, the removed `position.test.tsx`, the seven flipped specs, scratch base `ffedfa59`): session `6b9b82f0-538b-4d38-9cdd-6c2767054323`, 9 files reviewed, 1 comment.
- Model gpt-6.1-sol. Raw output: [ocr/T8P.17-12a396c0..48ae877b.json](ocr/T8P.17-12a396c0..48ae877b.json) and [-relocated](ocr/T8P.17-12a396c0..48ae877b-relocated.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| high | bug | relocated `drawers/position.props.tsx:11` | The `./position.tsx` and `test-support.ts` imports don't resolve. | Wrong: a relocation artifact. The real file's imports resolve. |

**No findings.** The reviewer briefly detached the lane at `48ae877b` by mistake and switched straight back; the lane's branch, HEAD and tree were unchanged.

**Merge.** Rebased onto `claude-opus-5.5` with no conflict. The rebase brought in T8P.6's `evaluate.ts`, so the lane tier is rerun (`T8P.17-rebase`) before the fast-forward. Rebased hashes: `1c7b346c` (task), `4b4e336c` (lane tier), `96723384` (follow-up), `f2839a35` (lane tier rerun).

### T8P.8-B3 round 3 ocr (`ee47e047..18496f2f`)

In place: session `a8cf3b2f-a13d-484b-8e45-892e4b2ea040`, 1 file reviewed (`market-data.ts`), 2 excluded, 0 comments. Relocated (the test file): session `868a7ddb-1b6f-4454-884e-69af3d2a7fa5`, 1 file, 0 comments. Model gpt-6.1-sol. **No findings.** Raw output: [ocr/T8P.8-B-ee47e047..18496f2f.json](ocr/T8P.8-B-ee47e047..18496f2f.json) and [-relocated](ocr/T8P.8-B-ee47e047..18496f2f-relocated.json).

## Merges after merge run 3

**T8P.17.** Rebased onto `claude-opus-5.5` with no conflict. The rebase brought in T8P.6's `evaluate.ts`, so the lane tier was rerun (`T8P.17-rebase`: 1547 unit, 218 integration, 14 of 14 checks; `run-complete.sh`: run complete). Fast-forwarded to `9658f53b`. Rebased hashes: `057dc498` (task), `859517bd` (lane tier), `77d80591` (follow-up), `cfc572eb` (lane tier rerun), `9658f53b` (rebased tier). The lane was removed.

**T8P.8.** Rebased first onto T8P.6 (`T8P.8-rebase`: 1551 unit, 218 integration, 14 of 14), then onto T8P.17, which brought in code again (`T8P.8-rebase2`: 1554 unit, 218 integration, 14 of 14; run complete). Fast-forwarded to `957499ac`. Rebased hashes: `5439bfb0` (task), `becf9efb`, `ca59697a` (B1), `6cf43890` (B2), `a882280f`, `5c9dd2f3` (B3), `cb8e310d`, `923bc499`, `957499ac`. The lane was removed.

**T8P.12.** The rebase onto T8P.17 conflicted in `e2e/d7/short-put.spec.ts`, on adjacent lines with one owner each under section 1.5: T8P.17's Realized to date read (moved back to the Position drawer, as handoff note T8P.17 asks) and T8P.12's lifecycle badge (W2's "Cash-Secured Put, Open"). T8P.12's `openDrawer(reopened, 'Today')` line existed only for the old read from Today, so the resolution keeps T8P.17's read and T8P.12's badge and drops that line. This is not a file two lanes both own (handoff stop 7): each line has one owner. The lane tier was rerun after rebasing onto T8P.8 too (`T8P.12-rebase`: 1557 unit, 218 integration, 14 of 14; run complete). T8P.12's six changed specs passed on the resolved tree (13 tests, [suite-runs/T8P.12-rebase-browser.txt](suite-runs/T8P.12-rebase-browser.txt)). A first run had failed on stale release builds, since the specs serve `build:releases` rather than `dist`. Fast-forwarded to `f995af22`. Rebased hashes: `3ca9819b` (task), `ea517ac4`, `0c96414f` (titles), `e37c12a6`, `7ee44f66`, `b6a439cf` (B1), `0e1e64cc`, `f995af22`. The lane was removed.

### T8P.12-B1 (`a4dda1be`, rebased `b6a439cf`), round 2 ocr

`daysText` uses guarded returns. A refactor kept green: 7 of 7 rail cases before and after. Lane tier `T8P.12-B`: 1543 unit, 218 integration, 14 of 14. ocr session `0bf4c699-4014-40c6-a7b1-25ad6aaa41b6`, 1 file reviewed, 0 comments. **No findings.** Raw output: [ocr/T8P.12-B-a4dda1be.json](ocr/T8P.12-B-a4dda1be.json).

## T8P.18 Plan and Risk drawer and footer (lane `d08p-d3`)

Commits `6bcb636e` (task) and `c9b84488` (lane tier: 1541 unit, 218 integration, 14 of 14; run complete). Browser: 55 and 21 tests passed across the specs reading Plan and Risk and the footer, after `build:releases`, `build:faults` and `build`.

Accepted from its summary:
- **Two flagged first-run passes** (cases 1 and 3): T8P.5's composed sections already did both. The mutations ran on the lane's replacement code (a label and a W word) and failed with assertions. The old lines are in files outside lane D3.
- **"Entry not yet resolved: 0 of 100 entered"** on a Planned Detail (case 2): the existing Entry Quality sentence. Moved content keeps its words, so no new word is needed.
- T8P.5's two path tests replaced by the three cases; no existing expected value changed.
- `plan-risk.types.ts` and `footer.types.ts` reshaped to carry the moved sections' markup.

**ocr on `6bcb636e`.** In place: session `78607390-0b63-45c7-a0b2-05a90ecd8bd2`, 6 files reviewed, 1 comment. Relocated (2 tests): session `76ef9e62-14e7-4a5d-8c1d-8be91f9b9f6d`, 0 comments. Raw output: [ocr/T8P.18-6bcb636e.json](ocr/T8P.18-6bcb636e.json) and [-relocated](ocr/T8P.18-6bcb636e-relocated.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| low | maintainability | `plan-risk.tsx:13` | The row value is a nested ternary. | Valid, style only. |

Bug task **T8P.18-B1**. Case: *it should choose the row value without a nested conditional.* A refactor, kept green.

## T8P.20 Price History drawer (lane `d08p-d5`)

Commits `c0df748c` (task) and `66c34bf8` (lane tier: 1544 unit, 218 integration, 14 of 14; run complete). Accepted:
- case 4's flagged first-run pass (mutation `.slice(0, 60)` failed on the header count);
- one extra case for the shell wiring;
- a local `ReplaySource` type in `price-history.props.ts`, since `lint:deps` bars a UI import of `replay-view.ts` and the Trade Views index doesn't export `TradeReplayView` (T8P.22 swaps it for the facade type);
- `priceHistoryTabCount` exported for T8P.22;
- `plural()` for "1 session without Marks".

**ocr on `c0df748c`.** In place: session `5363e5d8-d907-448a-881a-a34f1ef69666`, 3 files reviewed, 3 comments. Relocated: session `e34813de-6de8-4e22-838c-9dcc829e87a6`, 4 files, the same three. Raw output: [ocr/T8P.20-c0df748c.json](ocr/T8P.20-c0df748c.json) and [-relocated](ocr/T8P.20-c0df748c-relocated.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `price-history.tsx:62` | "Enter Marks in the Review" navigates to `/` (Trades), and its `href` is `/`. | Valid: `/review` is the Review route. |
| medium | bug | `price-history.tsx:12` | No horizontal scroll container, so a long history widens the page. | Valid. |
| medium | bug | `history.css:15` | The pinned row labels use `background: inherit` on a transparent row, so values show through. | Valid. |

Bug tasks: **T8P.20-B1** (*it should open the Review from Enter Marks in the Review.*), **T8P.20-B2** (*it should scroll a long history inside the drawer, not the page.*), **T8P.20-B3** (*it should keep the pinned row labels opaque over scrolled values.*).

## T8P.7 Replay slice and Max reward's R (lane `d08p-ba`)

Commits `6443e319` (task) and `d5c0dd60` (lane tier: 1553 unit, 218 integration, 14 of 14; run complete). Accepted:
- two flagged first-run passes (Tuesday, mutation `realizedToDate` for `currentMarkedPnl`; Long Stock, mutation `frames.slice(1)`), both failing with assertions;
- two extra cases T8P.10 needs (a flat final session; facts that can't be replayed give `NotApplicable` with `FactsIncoherent`);
- revision 89's case, with no revision 88 lines needed;
- the public types for T8P.10, as the summary lists them. `ReplayMark.resolution` is `ObservationFrame['resolution']`, which T8P.10 maps to the view's `MarkResolution`.

**ocr on `6443e319`.** In place: session `e598a68c-09c5-43a6-ab45-00bb898ad352`, 4 files reviewed, 1 comment. Relocated (the test): session `5051329e-811f-480c-96cc-26d177ae2003`, 1 comment. Raw output: [ocr/T8P.7-6443e319.json](ocr/T8P.7-6443e319.json) and [-relocated](ocr/T8P.7-6443e319-relocated.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `replay-series.ts:112-113` | The `find(...)!` for the held Instrument's frame is undefined when a session lacks it, and `evaluate` throws. | Valid, low practical impact (the input contract asks for every frame), but one bad session crashes a whole replay. |
| medium | test | relocated `replay-series.ts:1` | No Vitest project discovers the suite. | Wrong: a relocation artifact. |

Bug task **T8P.7-B1**. Case: *it should give that session an unavailable Trade P&L, not throw, when its frames lack the held Instrument's.* The reviewer's note that `tradePnlOf` values only the first position with open lots is not an ocr finding; the B1 agent reports whether a multi-leg Trade can reach `replay` in D08P.

## T8P.16 Today drawer (lane `d08p-d1`)

Commits `7f9df7eb` (task) and `45595501` (lane tier, green; run complete). The six Today-reading specs passed (14 tests). No first-run passes. Accepted:
- the "At the Mon Oct 12 Marks" expectation changes under section 1.5's "At Mon Oct 12 close" row (T8P.16, W19), including four hits the row's location list missed, all the same dated heading;
- a local `TodayReplay` type (as T8P.20's);
- the reshaped `today.types.ts` and `track.types.ts`;
- track markers showing only "entry", "now" and the earlier date, without the prototype's end-price labels.

"No Marks yet" is inferred in `today.props.ts`. Revision 90 replaces the inference with a Trade Views field. ocr is running.

## User decisions (2026-11-13, during wave 1)

- **Absence checks.** "If something should be gone, check it isn't there (even if hidden). If something should just be hidden, check that it is hidden." Applies to every task's new checks from now on (briefs and bug-task messages carry it) and to the existing ones, through revision 90's T8P.29.
- **"No Marks yet" (option A).** Trade Views states it explicitly, and the Today drawer and the Conditions card read it instead of inferring it. Revision 90's T8P.28. T8P.14-B1 is withdrawn from lane R2 and becomes T8P.28's card case.
- **T8P.19's chart.** The values stay in the text tables beneath the one chart, with no breakeven or ray labels on it. To be reworked later if disliked.
- **Agents.** A new task gets a fresh agent; a bug fix goes back to the agent that wrote the task.

## T8P.19 follow-up

The lane tier's one failure was `PlanForm.test.tsx`'s receipt case. Its mocked Planned Detail used `ocPayoffs()`, an Open Trade's payoff with held lots, so the one chart carried both captions. Section 1.5 says that file's expectations are unchanged, so the agent may change only that case's mock to the payoff a Planned Detail really has, with every expect line kept. If it still fails, the task stops.

## Second rounds, T8P.16 and T8P.19 reviews, and the T8P.18 merge

**Round 2 reviews, all clean or handled:**
- **T8P.18-B1** (`45bba179`): session `c8cb316e-2775-40fc-b4a4-d2d29a1ba2c9`, 1 file, 0 comments ([ocr/T8P.18-B-45bba179.json](ocr/T8P.18-B-45bba179.json)).
- **T8P.14-B2 and B3** (`e5b5d233`): sessions `a7179567-c519-4ac8-b180-f2402db85e6e` and relocated `a75f312a-8a48-407f-8833-56d6d345161b`, 0 comments ([ocr/T8P.14-B-e5b5d233.json](ocr/T8P.14-B-e5b5d233.json)). B2's red: `Unable to find an element with the text: Outside calendar.` The reviewer noted a stale comment in `measuredItem` ("as on a Closed Detail"); T8P.29 rewrites that function.
- **T8P.7-B1** (`fc1b9ee5`): session `e616cfc4-9ca5-4f04-a57d-beabb85248c5`, 0 comments. The relocated session's one comment is Wrong: a relocation artifact, since the clone kept the parent's `replay-series.ts` ([ocr/T8P.7-B-fc1b9ee5.json](ocr/T8P.7-B-fc1b9ee5.json)). Red: `TypeError: Cannot use 'in' operator to search for 'resolution' in undefined`. On multi-leg Trades, every D08P fixture has one Instrument and `evaluate` already assumes one (A99), so none can reach `replay`.
- **T8P.20-B1 to B3** (`4338c6f9`): session `b25831e7-f67b-4f37-aff7-931f839ab070`, 1 comment, Valid and minor: `REVIEW_PATH` duplicates the `review` route's path in `ROUTES`. Bug task **T8P.20-B4** (*it should take the Review's path from the routes.*), round 3. B3's test reads `history.css` as text; the reviewer judges it a sound narrow guard but no layout evidence. The scroll region and opaque pin get a browser look once T8P.22 supplies data ([ocr/T8P.20-B-4338c6f9.json](ocr/T8P.20-B-4338c6f9.json)).

**T8P.19 ocr** (`f34448c2~1..91cee061`): session `6f9aaa7b-1336-4fd8-89e7-d8d6163f87f3`, 8 files, 1 comment; relocated `b7e10bd2-0af1-4e1c-8fe5-4e3d09a64f5b`, 0 comments ([ocr/T8P.19-f34448c2..91cee061.json](ocr/T8P.19-f34448c2..91cee061.json)). The one finding (no price tick at a breakeven inside a segment) is Wrong by the user's decision: the values sit in the tables beneath the chart. The PlanForm follow-up: `91cee061` mocks a real Planned Detail's payoff (`current` Not applicable, `NoRemainingPosition`, as `expirationPayoff` gives with no exposure), with every expect line unchanged; lane tier 1543 unit, 218 integration, 14 of 14. `a6119b59` was a transient form that broke `lint:deps`.

**T8P.16 ocr** (`7f9df7eb`): session `4dda4c32-ce13-4239-bd53-1b4ff4f88563`, 7 files, 3 comments; relocated `d6352625-8b3a-4d3c-9438-4e4b4fcb11f2`, 15 files, 4 comments (3 repeats). Raw output: [ocr/T8P.16-7f9df7eb.json](ocr/T8P.16-7f9df7eb.json) and [-relocated](ocr/T8P.16-7f9df7eb-relocated.json).

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `today.props.ts:77-78` | The Change cell uses each Instrument's own previous Mark, which can be older than the column's compared session. | Valid (A211: "need not be the previous session"). |
| medium | bug | `today.props.ts:221` | "This Trade opened today" never checks that it opened today; a Trade entered after an earlier close takes this branch. | Valid. The words need the user: revision 91. |
| medium | test | `today.props.test.ts:85` | No partially marked session is tested. | Valid, the same cause as finding 1. |
| medium | bug | `today.props.ts:103-104` | `trackOf` with no prices gives non-finite positions. | Valid, rare. |
| low | bug | `today.css:104-107` | The "entry" and "now" labels overlap when the Mark is near the entry. | Valid. |

Bug tasks:
- **T8P.16-B1** (findings 1 and 3): *it should show a change only against the compared session when an Instrument had no Mark then.*
- **T8P.16-B3** (finding 4): *it should draw no Underlying track when nothing can be placed on it.*
- **T8P.16-B4** (finding 5): *it should keep the entry and now labels apart when the Mark is at the entry.*
- **T8P.16-B2** (finding 2) is carried by T8P.29, with revision 91's words.

**T8P.18 merge.** The rebased lane tier (`T8P.18-rebase`) passed: 1558 unit, 218 integration, 14 of 14. While it ran, the reviewer of T8P.7-B1 ran commands in lane D3 by mistake. It committed the half-written tier files there as "relocated base" (`609280ca`, author `x <a@b>`), though it reported "nothing to commit". The commit held only those four evidence files, with no code. The main session reset the lane to `8e000474`, keeping the files, and committed the finished ones (`9c424051`). Fast-forwarded to `9c424051`. Rebased hashes: `ca0191e7` (task), `7a33e1aa`, `a9452c3f` (B1), `db553ee8`, `9c424051`. The lane was removed.

**Main-session slip.** One shell command included `git worktree list` with its output discarded (`>/dev/null`), against the location rules. Nothing was read from it. A zsh loop also failed to split its arguments, so three rebases ran in the main worktree. Git refused each (unstaged merge-run files), and nothing changed.

**Stacked merges.** T8P.7 (BA), T8P.14 (R2) and T8P.19 (D4) are rebased in a stack: BA on `claude-opus-5.5`, R2 on BA, D4 on R2. Each lane tier then runs once on exactly the code it merges with (labels `T8P.7-stack`, `T8P.14-stack`, `T8P.19-stack`).

**User decisions (revisions 90 and 91).** Revision 90 (`f6297cb6`): T8P.28 to T8P.30. Revision 91 (`be54204d`): the before-Marks words always name dates.

## Merge run 4 and the next merges

**Merge run 4** (`dab6bc5b`; suite-runner): unit 1557 of 1557, integration 218 of 218, browser stage 1 128 passed, stage 2 73 passed and 1 failed, checks 14 of 14; run complete. `claude-opus-5.5` moved during the run, so the stages saw different commits (unit `f995af22`, browser `df757fc9` and later, checks `fb324a49`). The failure was `e2e/d5r/responsive-a11y.spec.ts:9` (B5R.11): at 1280 px the slider sat at 2296 px, not below 846 px. **Pinned:** one targeted run on `dab6bc5b` with fresh `build:faults` and `build:releases` passed all 3 B5R.11 tests ([suite-runs/merge-4-b5r11-rerun.txt](suite-runs/merge-4-b5r11-rerun.txt)). It doesn't reproduce. Likely cause: load, with three lane tiers and other lanes' browser runs at once, while the branch moved. The next merge run checks it again.

**T8P.7, T8P.14 and T8P.19, stacked.** Lane tiers on the stack: `T8P.7-stack` 1568 unit, 218 integration, 14 of 14; `T8P.14-stack` 1576 of 1577 unit (one load flake: `PositionChangeForm.test.tsx` "should move focus to the Record entry heading when the form finishes loading", which passed 3 of 3 alone and passed in `T8P.19-stack`, which contains T8P.14's code), 218, 14 of 14; `T8P.19-stack` 1580 unit, 218, 14 of 14. The stack was rebased onto the tip (plan and evidence only) and fast-forwarded to `fb324a49`. Rebased hashes are in the Progress rows. The lanes were removed.

**T8P.9 and T8P.20, stacked.** The B8P.3 extension (`f4bbe83f`, rebased `f4bde124`) reads "Expires Fri 18 Dec 2026 (67 days)" through the identity card before and after the reload. 4 browser tests passed. Its relocated ocr: session `4ac01a3b-3e5f-4516-8e39-1b7e8f5464c1`, 0 comments; the day count checked (67) ([ocr/T8P.9-B8P.3-f4bbe83f-relocated.json](ocr/T8P.9-B8P.3-f4bbe83f-relocated.json)). T8P.20-B4 (`5e3f43eb`, rebased `5e442c6f`): `REVIEW_PATH` from `ROUTES`; round 3 ocr session `1e73b271-9602-429d-ac18-7fcb999832e0`, 0 comments ([ocr/T8P.20-B4-5e3f43eb.json](ocr/T8P.20-B4-5e3f43eb.json)). Lane tiers: `T8P.9-stack` 1581 unit, 222 integration, 14 of 14; `T8P.20-stack` 1588 unit, 222, 14 of 14. Fast-forwarded to `85b90fff`. The lanes were removed.

**T8P.28** is dispatched to a fresh agent in a fresh BV lane from `85b90fff`.

**Main-session slip: the specs reading path.** The briefs for T8P.21, T8P.13 and T8P.28 named `plan/spec-reading/D08P.md`, which doesn't exist. The handoff says to read `plan/spec-reading/D07.md` plus the listed D9 sections. T8P.21 worked from the breakdown and handoff notes; T8P.13 got the correction mid-task; T8P.28's brief was fixed before dispatch.

## T8P.21 Journal session cards (lane `d08p-d6`)

Commits `9ea46ea2` (task) and `cb77bcad` (lane tier: 1563 unit, 218 integration, 14 of 14; run complete). Six cases red then green. Three extra cases: option Mark words, a session with Marks but no Trade P&L, and `journalTabCount` ("1 owed"). No first-run passes, and no existing expectation changed. ocr is running. Its interpretations to check at review and at T8P.22:
- three cards per page, with off-page cards mounted but hidden (so an open form survives paging);
- "—" named "No Mark" borrowed from W9;
- "Today", "Yesterday" and "final session" labels;
- the reshaped `journal.types.ts`;
- owed items through the existing `OwedDebtItem`;
- T8P.22 must stop rendering the old Journal list when it passes a replay.

## The T8P.16 and T8P.13 merges, T8P.21's reviews, and revision 92

**T8P.16 merge.** ocr round 2 on the B1, B3 and B4 fix was clean (session `1826f69d-3bdc-41d9-b1fb-d1c4436254ba`, relocated `05a9fa84-0338-42c6-a39e-519ff8bd361c`; [ocr/T8P.16-B-r2.json](ocr/T8P.16-B-r2.json)). The rebase onto `ab329f1a` conflicted in `e2e/d4/expected-mark.spec.ts`: T8P.17 had moved the Open P&L read into the Position drawer, and T8P.16 had changed the dated heading to "At the Fri Oct 9 Marks" (W19). Each line had one owner, so the main session kept both (section 4.2). The rebased lane tier `T8P.16-rebase` passed (1598 unit, 222 integration, 14 of 14; run complete), and so did the four Today-reading specs (`d4/expected-mark`, `d4/breach-overrun`, `d4/responsive-a11y`, `d7p/layout`: 11 of 11) on fresh release builds. Fast-forwarded to `d2cdfc88`. Rebased hashes: `d8691e0e` (task), `a4dcf05c`, `6780b82c` (B1, B3, B4), `257e8a77`, `d2cdfc88`. The lane was removed.

**T8P.13 ocr** (`3b304ea4`): session `18a8333e-7d33-4deb-bca8-5ab2301aefbb`, 5 files, 0 comments; relocated `171a7159-8f36-480a-a87d-ffa0e33c32d8`, 5 files, 2 comments, both relocation artifacts (unresolved imports, and a file name outside Vitest's include patterns), dismissed as Wrong. Raw output: [ocr/T8P.13-3b304ea4.json](ocr/T8P.13-3b304ea4.json), [ocr/T8P.13-3b304ea4-relocated.json](ocr/T8P.13-3b304ea4-relocated.json). No bug task. Its five titles match the breakdown word for word. Case 3 keeps "today's session", since revision 91 gives that retitle to T8P.29.

**T8P.13 merge.** The rebase onto `d2cdfc88` was clean but brought in code. The rebased lane tier `T8P.13-rebase` passed (1602 unit, 222 integration, 14 of 14; run complete), and so did its four specs (`d4/expected-mark`, `d4/correct-mark`, `d6/exit`, `d6/responsive-a11y`: 7 of 7) on fresh release builds. Then rebased onto `58ebbf91` (revision 92, plan and spec text only) and fast-forwarded to `3308a842`. Hashes: `83d5c09b` (task), `56fbb391`, `3308a842`. The lane was removed.

**T8P.21 reviews, after the ocr limit was reset.**
- The full rerun of `9ea46ea2`: session `5e97eda3-2a99-4e24-b72a-efab451f9acf`, 4 files, 3 comments; relocated `6ff8b470-89cd-4fc0-a12d-d40128d0b721`, 1 comment. Raw output: [ocr/T8P.21-9ea46ea2-rerun.json](ocr/T8P.21-9ea46ea2-rerun.json), [ocr/T8P.21-9ea46ea2-rerun-relocated.json](ocr/T8P.21-9ea46ea2-rerun-relocated.json).
  - Findings 1 and 2 repeat B1 (the card page is not reconciled with the list) and B2 (saved entries lose their status and their Answered or Declined time), already fixed in `c085a279`.
  - Finding 3, Valid and new: `JournalCardsInput` leaves `view` optional beside a `replay`, and `journalCards` then reads `view.plan`, so a type-correct call without a view throws. Nothing calls it that way yet. It became **T8P.21-B3**, sent to the same agent.
  - The relocated comment (the `show` helper's `object` cast and `unknown[]` fixtures) is Doubtful as a defect. The test's header makes the loose types deliberate, so it was dismissed as a style preference, not a wrong result.
- Round 2 on `c085a279` (B1, B2): session `2554ed6d-65ff-486a-9592-d0712e3cf542`, 0 comments; relocated `a3e7f9be-4887-437d-aaca-21254430e752`, 0 comments. Raw output: [ocr/T8P.21-B-c085a279-r2.json](ocr/T8P.21-B-c085a279-r2.json), [ocr/T8P.21-B-c085a279-r2-relocated.json](ocr/T8P.21-B-c085a279-r2-relocated.json).
- **T8P.21-B3:** `66d1d141` (the replay branch requires `view: TradeDetailView`, and the cast is gone). Red was type-level: `npm run typecheck` reported `TS2578: Unused '@ts-expect-error' directive` on a replay-without-view call. Lane tier `ffacdaf3` (1566 unit, 218 integration, 14 of 14; run complete). ocr is running. T8P.22 must pass `view` whenever it passes `replay`.

**Revision 92** (`58ebbf91`, tag `claude-opus-5.5-plan-r92`), the user's choice "Add a calendar read":
- Market Data's read session names the session after its trading date, from the calendar alone (`nextSessionDate`), and none outside coverage. That is one clause in `specs/design/market-data.md`'s read-session paragraph.
- T8P.28 adds the field in lane BV, with one case, then reads it for `firstMarksDue`.
- S124's character count (2,471 to 2,610) and the reading-cost table are updated, and the reading lists are regenerated. No line moved and no tag changed.
- Lane BV, which held no commit of T8P.28's, was moved to `58ebbf91`, and T8P.28's agent resumed with the revision.

**T8P.21-B3 ocr** (`66d1d141`): session `92cd5759-0b98-427c-9bb0-7b799b1f02e5`, 1 file, 0 comments; relocated `811e4390-de1d-4759-a02b-88c9cf17ab06`, 2 files, 0 comments. Raw output: [ocr/T8P.21-B3-66d1d141.json](ocr/T8P.21-B3-66d1d141.json), [ocr/T8P.21-B3-66d1d141-relocated.json](ocr/T8P.21-B3-66d1d141-relocated.json). Clean.

**T8P.21 merge.** The rebase onto `5b0bad45` was clean but brought in code (T8P.16, T8P.13). T8P.21 changes no browser spec. The rebased lane tier `T8P.21-rebase` passed (1614 unit, 222 integration, 14 of 14; run complete). Fast-forwarded to `bb10b0dc`. Rebased hashes: `333af6d7` (task), `9b2271ef`, `67a46201` (B1, B2), `54f9d136`, `370a6cd5` (B3), `c3c4c6e6`, `bb10b0dc`. The lane was removed. Merge run 5 (`browser-auto dab6bc5b`) is running.

## T8P.28 Trade Views: `firstMarksDue` (lane `d08p-bv`, revisions 90 and 92)

Commits `d0d9be84` (task) and `68464489` (lane tier: 1602 unit, 222 integration, 14 of 14; run complete). Read session gains `nextSessionDate?: string` (from `sessionPolicy.nextSession(day.date)` when covered and `ok`, absent on the uncovered session); `OpenCurrentEvaluation` gains `firstMarksDue?: string`, set by `firstMarksDueOf(session, evaluation, datedLine, settlement)` in `getTradeDetail` only. The Open list item builds `current` separately, so it does not carry the field.
- Market Data case red: `expected undefined to be '2026-10-13'`. Case 1 red: a deep-equality failure on `ObjectContaining` (Monday 10:00 fill viewed Monday noon, and Friday 17:30 fill viewed Saturday, both `2026-10-12`).
- **Flagged first-run passes:** cases 2 and 3, since case 1's code built both behaviours. Mutations: dropping `!datedLine` failed case 2, and dropping the awaiting-close check failed case 3, each with `expected … to not have property "firstMarksDue"`. Both restored.
- The three cases sit in `option-views.test.ts` (one of the Detail test files the brief named), since the expired-contract fixture is local to it. No existing expectation changed (no revision 88 line), no read-session double needed the field, and no file outside lane BV was touched.

**T8P.28 ocr** (`d0d9be84`): session `e593e452-158a-4b98-87c1-a9786bb9c977`, 2 files, 0 comments; relocated `105df68c-f40d-404e-a0ff-4d57f053fb14`, 2 files, 0 comments. Raw output: [ocr/T8P.28-d0d9be84.json](ocr/T8P.28-d0d9be84.json), [ocr/T8P.28-d0d9be84-relocated.json](ocr/T8P.28-d0d9be84-relocated.json). Clean. Rebased onto `bb10b0dc` (brings in T8P.13 and T8P.21 code): `135a6651` (task), `45a24354`; the rebased lane tier `T8P.28-rebase` is running, and the fast-forward waits for merge run 5 to finish in the main worktree.

**Merge run 5** at `bb10b0dc` (`browser-auto dab6bc5b`; the merges of T8P.16, T8P.13 and T8P.21): unit 1614, integration 222, checks 14 of 14, browser tier 1 128 passed and tier 2 75 passed, no failures and no flakes; run complete. Outputs: `suite-runs/merge-5-*.txt`. The next merge run is `browser-auto bb10b0dc`.

**T8P.28 merge.** After merge run 5 finished, lane BV was rebased onto `158e80ba` (evidence only, no code) and fast-forwarded: `e163c073` (task), `ed2568fd`, `aa8bfddd` (the rebased lane tier `T8P.28-rebase`: 1618 unit, 222 integration, 14 of 14; run complete). Lane BV stays for T8P.10. T8P.15 (new lane R2 at `aa8bfddd`) and T8P.10 (lane BV) started with fresh agents. The next merge run is `browser-auto bb10b0dc`, and it covers T8P.28.

## T8P.15 Needs you (lane `d08p-r2`) and T8P.10 `replayTrade` (lane `d08p-bv`); revision 93

**T8P.15.** Commits `447c8241` (task) and `86e94f0b` (lane tier: 1624 unit, 222 integration, 14 of 14; run complete). Seven cases red then green, no first-run pass. Case 4 reads `view.current.firstMarksDue` (formatted with `shortDate`), and its second half drops the field from the double and expects "Nothing needs you now.". Its first red row is marked "Not a red" (an Edit had missed, so the filter matched no test).
- **Expectations changed, checked by the main session:**
  - "Max reward: $730.00" became "Max reward: $730.00 · 1.52R" in `conditions.props.test.ts` (T8P.14's case 7) and `e2e/d7s/conditions.spec.ts:56`. The basis is revision 89 (T8P.15 shows the R) and W6; the spec line is in section 1.5's reach table for the Conditions card (`d7s/conditions :48–57`).
  - `needs-you.test.tsx` (T8P.5's placeholder equality check) was deleted, as its comment said T8P.15 would replace it.
- Changed public names: `NeedsYouItem`'s `Debt.onReflectNow` is optional, `MarkMissing.reviewTo` is a route, and `SettlementDue` has `notes` and `recordExpirationTo`. Also new: `needsYouProps`, `needsYouPropsOf`, `NeedsYouShellProps`, and `crossingWords` (`conditions.props.ts`).
- **ocr** (`447c8241`): session `a4badfe0-5a8c-4614-aff6-6f375476e145`, 6 files, 1 comment; relocated `27e6f848-d033-4de3-8f8e-2ec381d54262`, 2 files, 1 comment. Raw output: [ocr/T8P.15-447c8241.json](ocr/T8P.15-447c8241.json), [ocr/T8P.15-447c8241-relocated.json](ocr/T8P.15-447c8241-relocated.json).
  - Valid: `Cockpit.tsx` passes no `onReflectNow`, so the rail's Reflect now never appears (A217). This became **T8P.15-B1**. Its fix needs the shell and the Journal cards, so it went to the user, who chose "Fix now in lane R2" (revision 93).
  - The relocated comment (suites not discovered) is a relocation artifact, dismissed as Wrong.
- **Main session's browser run in the lane** (both tiers, since T8P.15 moves content about 15 specs read): tier 2 75 of 75; tier 1 127 of 128. The failure is `d4/responsive-a11y:114`, "Detail Available (Stop Breached, Unbounded)", axe `list: .needs-you-list` (a non-`<li>` child in the Needs you list). It went back to the same agent with B1.

**T8P.10.** Commits `ae689ea6` (task) and `c3dff363` (lane tier: integration 222, 14 of 14; unit had one load flake in `TradeList.test.tsx`, which passed alone 3 of 3).
- Cases 1, 2, 4, 5 and 6 red then green. Case 4's first red was a fixture error (`CloseReasonRequired`), fixed before the valid red.
- **Flagged first-run pass:** case 3. Its mutation sent a late item to the last completed session, and it failed with an `AssertionError`.
- No existing expectation changed. Reads per call: one `openReadSession` and one `series` per distinct Instrument, growing with Instruments only. A Planned, never-exposed or incoherent Trade reads no Market Data.
- Reshaped T8P.3 types: `ReplayMark.resolution` became `ReplayMarkResolution` (price and revision only, from A210's series). `view-types.ts` breaks a `replay-view.ts` ⇄ `trade-views.ts` cycle, with the moved names re-exported unchanged.
- The agent's own choices, carried in the handoff's "For T8P.22 (from T8P.10)" note: items after a Closed Trade's final session stay in it, a Review Date before the first session goes to the Plan list, and replayed Debts carry no `dueStatus`.
- **The provenance conflict:** `TodayReplay` (T8P.16) needs each replayed Mark's source, saved time and correction reason for T8P.16's planned case, and A210 gave only price and revision. It went to the user, who chose "Series carries provenance" (revision 93). The same agent was resumed with two cases.
- **ocr** (`ae689ea6`): session `475b08cf-99ff-493d-bbd2-a26629a634f4`, 5 files, 0 comments; relocated `c2549399-81e8-41f0-af52-06286794411c`, 2 comments, both relocation artifacts (an unbuilt barrel at the scratch base, and an undiscovered file), dismissed as Wrong. Raw output: [ocr/T8P.10-ae689ea6.json](ocr/T8P.10-ae689ea6.json), [ocr/T8P.10-ae689ea6-relocated.json](ocr/T8P.10-ae689ea6-relocated.json).

**Revision 93** (`8785b649`, tag `claude-opus-5.5-plan-r93`):
- Series points carry the effective Mark revision's `source`, `savedAt` and `reason` (A210), and T8P.10 adds that with two cases.
- Lane R2 may edit `Cockpit.tsx` and `journal-cards.tsx` for T8P.15-B1 only.
- `specs/` is unchanged. Lane BV (T8P.10's two commits only) was rebased onto it, to `092719ba` and `538d0f72`.

**T8P.10, revision 93.** `74890b15` (code) and `b79c5602` (lane tier `T8P.10-R93`: 1626 unit, 222 integration, 14 of 14; run complete, and no TradeList flake this time). Both cases red then green, with no first-run pass. `SeriesPoint`'s Available kind gains `source`, `savedAt` and an optional `reason`. The replay's Available `mark` gains `source`, `savedAt` and an optional `correctionReason`. A throwaway assignment `(view: TradeReplayView): TodayReplay => view` type-checked and was deleted, so T8P.16's `TodayReplay` accepts the real view.
- Two strict ReadSeries expectations in `market-data.test.ts` each gained exactly `source: 'Manual', savedAt: TUESDAY_NOON` ("should return each completed session from the earliest exposure…" and "should give the series on the first covered session without a previous session").
- Revision 93's entry did not repeat revisions 89 and 90's sentence putting the new fields under revision 88's rule. The main session's message did say so, and it checked both lines as exactly the additive fields with their correct values. No other expected value changed.

**T8P.10 revision 93 ocr** (`74890b15`): session `8b6f00b5-cb51-44ca-8e1a-1d35294d17af`, 3 files, 0 comments; relocated `d8590889-b825-418e-8c5e-a07133358255`, 2 comments, both relocation artifacts (the scratch base held the parent's production code), dismissed as Wrong. Raw output: [ocr/T8P.10-R93-74890b15.json](ocr/T8P.10-R93-74890b15.json), [ocr/T8P.10-R93-74890b15-relocated.json](ocr/T8P.10-R93-74890b15-relocated.json). Clean.

**T8P.10 merge.** Lane BV's base `8785b649` already held every code change on `claude-opus-5.5`; what followed is evidence only. So its lane tier `T8P.10-R93` is the tier for the merged code. Rebased onto the evidence commit and fast-forwarded. Lane BV stays for T8P.11.

**T8P.11** (structural, lane BV). `533b2a18` (task) and `9044cf62` (lane tier: 1626 unit, 222 integration, 14 of 14; run complete).
- The facade gains `TradeViewsAndReporting.replayTrade`, as delegation only. Its `MarketData.query` already took `ReadSeries`, since the type is `Parameters<typeof marketData.query>[0]`.
- The manifest gains `'TradeViewsAndReporting.replayTrade': []` and the `MarketData.query` variant `ReadSeries`.
- `verify:capabilities` exits 0 ("20 operations, 11 variant-qualified, 9 routes"). Without the manifest entry it exits 1, with `FAIL facade exposes TradeViewsAndReporting.replayTrade, which the manifest does not declare`.
- **`src/app/routes.ts`** (inside BV's `src/app/`): the trade-detail route now requires `replayTrade` and `MarketData.query`, and presents `ReadSeries`. The check needs every operation reachable and every variant presented by some route. The main session accepted it: the Detail is where series appear, through the replay. T8P.22 may move the variant if another route turns out to present it, and it must stay presented somewhere.
- `workspace.test.ts`'s exact operation list gains exactly the two entries. Its title's stale "through D7" and "schema version 6" were left as they were.
- **T8P.11 ocr** (`533b2a18`): session `5c3eab17-4939-4695-a497-f7c66534646f`, 3 files, 0 comments; relocated `4a426fd2-ee3b-4ef7-a7ef-6b403c7c9731`, 1 comment, a relocation artifact (the scratch base held the parent's manifest), dismissed as Wrong. Raw output: [ocr/T8P.11-533b2a18.json](ocr/T8P.11-533b2a18.json), [ocr/T8P.11-533b2a18-relocated.json](ocr/T8P.11-533b2a18-relocated.json). Clean.
- **T8P.11 merge.** Only plan text followed lane BV's base `283e7996`, so its lane tier stands for the merged code. Rebased and fast-forwarded. Lane BV's tasks are all done, so the lane was removed.

**Merge run 6** at `b5960b12` (`browser-auto bb10b0dc`, which chose the full tier from `src/app/compose.ts`; the merges of T8P.28, T8P.10 and T8P.11): unit 1626, integration 222, checks 14 of 14, browser tier 1 128 and tier 2 75 passed, no failures; run complete. Outputs: `suite-runs/merge-6-*.txt`. The next merge run is `browser-auto b5960b12`.

**T8P.15 fixes.** `2a12ffaa` (the a11y fix: the alert is now `<li><div role="alert">`; and B1: `Cockpit.tsx` passes `onReflectNow`) and `618f31e8` (lane tier `T8P.15-B`: 1625 unit, 222 integration, 14 of 14; and its tier 1 browser run, 128 of 128).
- B1's red: `Unable to find an accessible element with the role "button" and name "Reflect now"`.
- Seven specs dropped an `openDrawer(page, 'Journal')` line where only rail reads follow: `d5/detail-debt:14`, `d5/review-debt:21`, `d6/update:37`, `d5/kill-offline:68`, `d5/faults:46`, `d7/kill:35` and `d6/kill:48`. The others were kept, since card reads or form interactions follow them. The `rail-b.ts` debt reads moved to the Needs you card, and `journalReflectNowButton` was added.
- The Journal drawer's Reflect now reads in `Cockpit.test.tsx` and `Journal.test.tsx` were scoped to the Journal tabpanel, with no expected value changed.
- The agent's run of `d6/update` (`@release-history`) failed on "Schema version" 5 against 7. Decision 76 defers the upgrade tests and no gate runs them, so that failure is not T8P.15's.
- The main session ran browser tier 2 in the lane after the fixes: 75 of 75 (`T8P.15-B-browser-2.txt`). The tier 1 and 2 runs before the fixes are committed in the lane (`7751d39b`).
- **ocr** (`2a12ffaa`): session `a766a80d-4ceb-4d92-9444-e18633746a4d`, 4 files, 1 comment; relocated `c34ba6d9-dc08-42f5-89f7-9ebf2e63b213`, 0 comments. Raw output: [ocr/T8P.15-B-2a12ffaa.json](ocr/T8P.15-B-2a12ffaa.json), [ocr/T8P.15-B-2a12ffaa-relocated.json](ocr/T8P.15-B-2a12ffaa-relocated.json).
  - Valid: `reflectNow` finds the card by heading text and a minute-precision time, so two Debts of one type in one minute open the wrong form. This became **T8P.15-B2**. Its fix needs `OwedDebtItem.tsx` and `Journal.tsx`, so it went to the user, who chose "Pass the Debt id" (revision 94, `claude-opus-5.5-plan-r94`).
- **Agent note, not an ocr finding:** after a Debt is answered or declined in place, the Journal card relabels it, but the rail's Needs you still lists it as owed until the next read. Under the ocr-only rule this is not a bug task. It is carried to the user and to T8P.22.

**T8P.15-B2.**
- Commits: `72506ba1` (the fix), `ff048cc4` (the first lane tier, with two checks failing on an `eslint-disable-next-line react-hooks/exhaustive-deps` comment that `verify:wording` could not resolve), `e8e6c228` (the comment removed, plus B1's uncommitted tdd-log row) and `ab0663be` (lane tier rerun: 1626 unit, 222 integration, 14 of 14; run complete).
- Red: `expected <form …> to be null`, from two Position Change Reflections 30 seconds apart. The old lookup opened the first one's form.
- Eight debt specs plus `d4/responsive-a11y`: 18 passed (`T8P.15-B2-specs.txt`).
- **Changed mechanism, accepted by the main session:** a React context (`ReflectRequestContext` in `OwedDebtItem.tsx`, with an inert default), not a prop through `JournalSection` and `JournalCards`. A prop would also have needed `JournalBlock` in `Composed.tsx`, outside the lane. It still passes the Debt's id, with no page lookup, as the user chose. `Journal.tsx` and `journal-cards.tsx` were not edited.
- The matching item opens its form in a microtask (lint's `react-hooks/set-state-in-effect`). That leaves one `react-hooks/exhaustive-deps` warning at `OwedDebtItem.tsx:69`, and lint still exits 0.
- **ocr** (`7751d39b..e8e6c228`): session `c956183a-d321-43f6-90a6-b8745bcb3cff`, 2 files, 0 comments; relocated `392bd6ce-5767-4157-99d7-3cf52b3b07ff`, 0 comments. Raw output: [ocr/T8P.15-B2-e8e6c228.json](ocr/T8P.15-B2-e8e6c228.json), [ocr/T8P.15-B2-e8e6c228-relocated.json](ocr/T8P.15-B2-e8e6c228-relocated.json). Clean.
- **T8P.15 rebase.** Lane R2 was rebased onto `175da9ed`, which brought in T8P.10 and T8P.11 code. The lane tier `T8P.15-rebase` is running.
- The rebased lane tier `T8P.15-rebase` passed (1634 unit, 222 integration, 14 of 14; run complete). Fast-forwarded, and lane R2 stays for T8P.29.

## T8P.29 The readers of "no Marks yet" (lane `d08p-r2`)

Commits `5341fb77` (task), `681e8788` (lane tier: 1635 unit, 222 integration, 14 of 14; run complete) and `697d1bfc` (mutation rows).
- **Cases, each red then green, with no first-run pass:**
  - The Conditions case. Red: `expected undefined to be 'Awaiting close'`.
  - T8P.13's case 3, retitled word for word to revision 91's W3 words. Red: `expected 'Trade P&L once today's session ends' to be 'Trade P&L once the Mon Oct 12 session…'`.
  - T8P.16's before-Marks case, title kept since it doesn't quote the old words. Red: `Unable to find an element with the text: No Marks yet. This Trade opened Fri Oct 9 at 4:30 pm. …`. This carries T8P.16-B2's fix.
- **Field-removal mutations** (section 5, requested by the main session after the first report), restored afterwards:
  - P&L: `pnl.props.test.tsx:77`, `expected 'Awaiting the close after Mon Oct 12' to be '—'`.
  - Today: `today.props.test.ts:141`, `Unable to find an element with the text: No Marks yet. …`.
  - Conditions: `conditions.props.test.ts:95`, `expected <span …> to be null`.
- **Expected values changed, both named by revision 91:**
  - `pnl.props.test.tsx` case 3's line (W3).
  - `today.props.test.ts`'s "No Marks yet." text (W8). Its double is now an opening at Fri Oct 9 20:30Z with `firstMarksDue` `2026-10-12`.
  - Two Conditions doubles gained `firstMarksDue`, with no expectation changed. No spec held the old words.
- **Inferences removed:** `hasNoMarksYet` (`pnl.props.ts`), the `waiting` inference (`conditions.props.ts`), `noMarksTextOf` (`today.props.ts`), and three unused `isMarkLacking` imports. Each double without the field now asserts the before-Marks words are absent.
- **ocr** (`5341fb77`): session `1d89ed47-d12d-4c8a-8dcb-622807de2f07`, 3 files, 0 comments; relocated `93e636c8-7ca7-4ee5-9afd-8706ba433e29`, 3 files, 0 comments. Raw output: [ocr/T8P.29-5341fb77.json](ocr/T8P.29-5341fb77.json), [ocr/T8P.29-5341fb77-relocated.json](ocr/T8P.29-5341fb77-relocated.json). Clean.

**Stray commits on `claude-opus-5.5` (a reviewer's slip, kept at the user's choice).**
- What happened: T8P.29's ocr reviewer had its first relocation command blocked by a guard hook. Its shell stayed in the main worktree, and its `git add -A; git commit` committed there.
- The commits, both authored `x <x@x>`:
  - `71c444cf` "relocated 5341fb77^": the uncommitted `structural.md` notes and the `merge-7-*.txt` outputs merge run 7 was still writing;
  - `e363d10e` "relocated 5341fb77": one more line of `merge-7-browser-2.txt`.
- Evidence text only, with no source file. The guard hook blocks moving HEAD, so neither the reviewer nor the main session could reset them. The user chose to let them stand ("we can let that one go"). This commit adds the rest of merge run 7's output on top.
- Merge run 7's checks file records HEAD `e363d10e`, but the code it tested is `0529a40b`'s.

**Merge run 7** at `0529a40b` (`browser-auto b5960b12`, which chose the full tier from `e2e/d5/detail-debt.spec.ts`; the merge of T8P.15): unit 1634, integration 222, checks 14 of 14, browser tier 1 128 and tier 2 75 passed, no failures; run complete. The next merge run is `browser-auto 0529a40b`.

**T8P.29 merge.** Only plan and evidence followed lane R2's base `2f740d17`, so its lane tier stands. Rebased onto `4432b791` and fast-forwarded: `511065e0` (task), `693eae8f`, `479923c3`. Lane R2 was removed. Lane AX was created at `479923c3` for T8P.30, which started with a fresh agent.

**T8P.30 (lane AX), absence checks prove absence.** Task `a7f398bf` (rebased to `97cde911`), lane tier `5e61a71c` (rebased to `1f3292c0`): unit 1635, integration 222, checks all exit 0; run complete. No product code changed. Titles `diff` before and after is empty (1635 lines). Changed: 77 gone checks (42 unit, 35 browser), each mutated by ghosting the thing inside a hidden panel and each failing on its own assertion. One hidden check: the Cockpit drawer panel is mounted and `hidden`, and failed with `expected false to be true` once `hidden={false}` was set. Its "Only the selected drawer is mounted" comment was corrected (T8P.5-B1). No Playwright spec asserts a Trade Detail element is mounted and hidden. No stop: every gone check still passes once it looks inside hidden panels. New helpers: `detail.anywhere(build)` and `roleOf` in `e2e/support/detail/scope.ts`. `TradeDetail.test.tsx` does not exist, so the Detail's unit tests are the files under `src/ui/screens/trade-detail/`. The main session spot-checked the "Not Trade Detail" list: `d5/detail-debt.spec.ts` lines 42 to 45 read the Review page.

**T8P.30 review.** ocr ran on `a7f398bf` from a scratch clone. The in-place pass reviewed 7 files and found nothing (`ocr/T8P.30-inplace.json`). The relocated pass reviewed 36 files and made 6 comments (`ocr/T8P.30-reloc.json`). All 6 say `detail.anywhere` is undefined, and all 6 are Wrong: a relocation artifact. The scratch branch kept the parent's helpers, while `index.ts` at `a7f398bf` imports `anywhere` from `scope.ts` (line 11) and exports it (line 67), which the main session checked. No bug tasks.

**T8P.30 merge.** Only plan and evidence followed lane AX's base `479923c3`, so its lane tier stands. Rebased onto `d5643021` and fast-forwarded: `97cde911`, `1f3292c0`. Lane AX was removed. Wave 1 is complete. Merge run 8 (`browser-auto 0529a40b`) covers T8P.29 and T8P.30.

**T8P.30 checks list** (copied from `evidence/D08P/T8P.30-checks.md`):

### T8P.30 absence checks prove absence (plan revision 90)

Scope: the unit tests under `src/ui/screens/trade-detail/` and `src/ui/cockpit/`, and every browser spec that reads Trade Detail. `TradeDetail.test.tsx` does not exist in this tree (the Detail's tests are the files under `src/ui/screens/trade-detail/`), and no other unit file renders a Trade Detail with an absence check (`PlanForm.test.tsx` renders it once, with none).

Titles: `.claude/scripts/it-titles.sh` before and after, `diff` empty (1635 lines each).

#### What a role query sees

A Testing Library role query and a Playwright `getByRole` leave out what sits in a hidden panel. The cockpit keeps every drawer mounted and hides the unselected ones (T8P.5-B1), so a role query without `hidden: true` / `includeHidden: true` proves only "not shown". A text query (`queryByText`), a DOM query (`querySelector`) and a Playwright `getByText` or CSS locator see hidden content, so they already prove gone. One more fact found while mutating: dom-accessibility-api gives an element that itself carries `hidden` an empty accessible name, so a named query finds a thing inside a hidden panel but not a named element that is itself `hidden`. Ghost elements in the mutations are therefore children of a hidden container, as a real drawer's content is.

#### Grep (run in the lane at base 479923c3)

Unit scope (30 files):

- `queryBy*(` / `queryAllBy*(`: 104 lines; `queryBy*Role` / `queryAllByRole`: 50 of them.
- All patterns (`queryBy*`, `queryAllBy*`, `not.toBeInTheDocument`, `toBeNull()`, `toHaveLength(0)`, `toBeFalsy`, `not.toBe(`): 140 lines in 23 files; 44 of them are absence or hidden checks that needed a change (below). The rest are `querySelector` / `queryByText` / presence (`not.toBeNull`) / value checks, listed by line under "Already proving".
- `not.toBeVisible`, `toBeHidden`, `not.toContainText` in unit tests: 0 hits (Playwright only).

Browser scope (52 specs that mention Detail, plus `e2e/support/detail/*.ts` and the `support.ts` files): `toHaveCount(0)` 96, `not.toContainText` 11, `toBeHidden` 1, `not.toBeVisible` 0, `toHaveLength(0)` 6 (workspace data, not DOM). 114 matching lines in all with the `.not.toBe`, `not.toHaveAttribute` and `not.toHaveClass` forms. 35 of them are gone checks on Trade Detail content and changed; the rest are listed under "Not Trade Detail" or "Already proving".

#### Helper change (e2e/support/detail)

`scope.ts` gains `anywhere(build)` and `roleOf(scope, role, options)`. While `anywhere` builds a locator, every role query the Detail helpers make adds `includeHidden`, so a gone check looks inside hidden panels. `regionOf`, `recordEntryLink`, `recordExitLink`, `resultHeading`, `lotMatchesHeading`, `settlementDueHeading`, `recordExpirationLink`, `closeReviewOwed`, `reflectNowButton`, `declineButton`, `answerButton`, `debtForm`, `savedReflection` and `owedItem` use `roleOf`. A presence read, built outside `anywhere`, is unchanged. `detail.anywhere` is exported from `index.ts`.

#### Unit checks changed (gone, 42) and hidden (1 block of 2 queries)

Every gone check gained `hidden: true` on its role query. Mutation key: the temporary ghost is an element rendered inside a `<div hidden>` in the component the test renders; each run is the file or files named, and the failure is the check's own assertion (`expected <...> to be null`). All product edits were reverted (`git checkout --`), and `git diff --name-only` shows no product file.

| File:line | Kind | Changed | Mutation (temporary, reverted) | Failure |
| --- | --- | --- | --- | --- |
| cockpit/drawers/payoff.test.tsx:42 | gone | yes | `cockpit/drawers/payoff.tsx`: render `<section aria-label="Current Expiration Payoff">` in a hidden div when there is no current line | `payoff.test.tsx:42` expected section to be null |
| payoff.test.tsx:51 | gone | yes | same file: hidden `<svg role="img">` in the stock-note branch | `:51` expected svg to be null |
| payoff.test.tsx:52 | gone | yes | same: hidden `<table>` in the stock-note branch (svg ghost removed) | `:52` expected table to be null |
| cockpit/drawers/plan-risk.test.tsx:29 | gone | yes | `plan-risk.tsx`: hidden `<section aria-label="Summary">` | `:29` expected section to be null |
| cockpit/drawers/price-history.props.test.tsx:121 | gone | yes | `price-history.tsx`: hidden link when no session lacks a Mark | `:121` expected link to be null |
| cockpit/drawers/today.props.test.ts:142 | gone | yes | `today.tsx`: hidden `<table>` | `:142` expected table to be null |
| today.props.test.ts:143 | gone | yes | same: hidden `At the … Marks` region (table ghost removed) | `:143` |
| today.props.test.ts:161 | gone | yes | same: hidden `At Mon Oct 12 close` region | `:161` |
| today.props.test.ts:195 | gone | yes | `track.tsx`: hidden `<ul>` when the track has no condition lines | `:195` expected ul to be null |
| cockpit/journal-cards.props.test.tsx:90 | gone | yes | `journal-cards.tsx`: hidden `<ul><li>` on a card with no items | `:90` expected li to be null |
| journal-cards.props.test.tsx:284 | gone | yes | `screens/OwedDebtItem.tsx`: hidden `<form aria-label="Reflection">` while no definition is loaded | `:284` expected form to be null |
| cockpit/rail/conditions.props.test.ts:157-158 | gone | yes | `conditions.tsx`: hidden `Worst case and Max reward` list when there are no summary lines | `:175` (the `notes()` helper now returns `['MUT']`) |
| cockpit/rail/identity.props.test.tsx:88 | gone | yes | `identity-card.tsx`: hidden Record entry and Record exit links | `:91` links list not empty |
| cockpit/track.test.tsx:30 | gone | yes | `track.tsx`: hidden `<ul>` | `:30` expected ul to be null |
| screens/trade-detail/Banner.test.tsx:20 | gone | yes | `Cockpit.tsx`: ghost hidden div holding regions named for every checked name | `:20` expected section to be null |
| Banner.test.tsx:96 | gone | yes | same | `:96` |
| Banner.test.tsx:131 | gone | yes | same (`Position Change Reflection`) | `:131` |
| Banner.test.tsx:133 | gone | yes | same, without that ghost (derived names: Plan Baseline, Position, Entry Quality, Planned-Leg Fulfillment, Deviations) | `:133` |
| screens/trade-detail/Identity.test.tsx:18 | gone | yes | `screens/TradeDetail.tsx`: hidden Retry button in the NotFound state | `:18` expected button to be null |
| Identity.test.tsx:42 | gone | yes | `Cockpit.tsx` ghost: hidden Record entry link | `:42` |
| Identity.test.tsx:54 | gone | yes | same | `:54` |
| Journal.test.tsx:195 | gone | yes | `screens/trade-detail/Journal.tsx`: hidden button in the Journal section | `:195` expected button to be null |
| Journal.test.tsx:355 | gone | yes | same | `:355` |
| Journal.test.tsx:382 | gone | yes | `OwedDebtItem.tsx` hidden form | `:382` expected form to be null |
| Journal.test.tsx:412 | gone | yes | same | `:412` |
| Payoff.test.tsx:128 | gone | yes | `payoff.tsx`: hidden `<svg role="img">` | `:128` |
| Payoff.test.tsx:129 | gone | yes | `Cockpit.tsx` ghost: hidden `Planned Expiration Payoff` region | `:129` |
| Position.test.tsx:52 | gone | yes | `Cockpit.tsx` ghost: hidden `Position Changes` region | `:52` |
| Position.test.tsx:86 | gone | yes | ghost: hidden `Plan Reflection` region | `:86` |
| Position.test.tsx:123 | gone | yes | ghost: hidden `<table aria-label="Executions">` | `:123` |
| Position.test.tsx:124 | gone | yes | ghost: hidden `<h3>Position Change at …` | `:124` |
| Position.test.tsx:125 | gone | yes | ghost: hidden `Position Changes` region only | `:125` |
| Position.test.tsx:279 | gone | yes | `identity-card.tsx`: hidden Record exit link | `:279` |
| Position.test.tsx:285 | gone | yes | `Cockpit.tsx` ghost: hidden Record exit link on a Planned Detail only | `:285` |
| Result.test.tsx:51 | gone | yes | ghost: hidden `Valuation`, `Risk and reward`, `Position` regions | `:51` |
| Result.test.tsx:53 | gone | yes | ghost: hidden Record entry link on a Closed Detail only | `:53` |
| Result.test.tsx:54 | gone | yes | `identity-card.tsx` hidden Record exit link | `:54` |
| SettlementDue.test.tsx:33 | gone | yes | `cockpit/rail/needs-you.tsx`: hidden Record expiration link when the panel has none | `:33` |
| SettlementDue.test.tsx:42 | gone | yes | same | `:42` |
| Summary.test.tsx:96 | gone | yes | ghost: hidden `Summary` region | `:96` |
| Valuation.test.tsx:118 | gone | yes | `screens/trade-detail/Valuation.tsx`: hidden link in the Valuation section | `:118` |
| Cockpit.test.tsx:38-47 (was 41-42) | **hidden** | yes | `Cockpit.tsx`: `hidden={name !== current}` replaced by `hidden={false}` | `:43` `expect(position.hidden).toBe(true)` received false |

The Cockpit hidden check now asserts the Position panel is mounted and has `hidden`, that its Open Lots and Position regions are present in it (`hidden: true` queries), and that a plain role query still does not see them. Its comment is corrected: unselected drawers are mounted and hidden (T8P.5-B1). The two plain-query lines after the `hidden` assertion are not reached by that mutation, because the `hidden` assertion fails first; they assert the same property.

The orphan `screens/trade-detail/SettlementDue.tsx` and `Identity.tsx` render nothing in the cockpit; the first mutation attempt against them left their tests green, which is how the real sites (`needs-you.tsx`, `identity-card.tsx`) were found. T8P.27 removes those two files.

#### Browser checks changed (gone, 35)

Each is wrapped in `detail.anywhere(...)` (or has `includeHidden: true` on a page-wide role query). The mutation is one ghost block of hidden elements in `Cockpit.tsx`, reduced round by round so each check is the first to fail: `evidence/D08P/browser/T8P.30-mutation-specs.txt` (all ghosts) and `T8P.30-mutation-r2.txt` to `-r7.txt`. Build for each: `npm run build:faults && npm run build:releases`; run: `with-browser-lock.sh npx playwright test <specs>`.

| File:line | Check | Failure (first line of the failing statement) |
| --- | --- | --- |
| e2e/d2/after-save.spec.ts:10 | no Record entry heading | round 1, `after-save.spec.ts:10` toHaveCount |
| after-save.spec.ts:11 | no Save entry button | round 2, `:11` |
| e2e/d2/integrity.spec.ts:114 | no Record entry link | round 1, `:114` |
| e2e/d2/runtime-failure.spec.ts:41 | no Record entry link | round 1, `:41` |
| runtime-failure.spec.ts:64 | no "Record entry isn't available" heading | round 1, `:64` |
| e2e/d4/expected-mark.spec.ts:36 | no Mark figure in the Valuation | round 1, `:36` |
| e2e/d5/detail-debt.spec.ts:27 | no "Reflection owed" | round 2, `:27` |
| detail-debt.spec.ts:28 | no due note | round 3, `:28` |
| e2e/d5/faults.spec.ts:47 | no Reflect now (Needs you) | round 1, `:47` |
| faults.spec.ts:48 | no Reflect now (Journal panel) | round 2, `:48` |
| faults.spec.ts:49 | no Decline | round 3, `:49` |
| faults.spec.ts:50 | no Reflection form | round 4, `:50` |
| faults.spec.ts:51 | no Answer | round 5, `:51` |
| e2e/d5/kill-offline.spec.ts:83 | no "Reflection owed" | round 2, `:83` |
| e2e/d5/review-debt.spec.ts:102 | no "Reflection owed" | round 1, `:102` |
| e2e/d5/support.ts:59 (`expectSavedReflection`) | no Reflection form on Detail | round 1, `support.ts:59` |
| e2e/d6/exit-requirements.spec.ts:94 | no Lot Matches heading | round 1, `:94` |
| e2e/d6/exit.spec.ts:38 | no Result heading | round 1, `:38` |
| exit.spec.ts:39 | no Close Reason value | round 2, `:39` |
| e2e/d6/kill.spec.ts:48 | no "Reflection owed" | round 1, `:48` |
| kill.spec.ts:49 | no Close Review owed heading | round 4b, `:49` |
| e2e/d6/runtime-failure.spec.ts:53 | no Reflect now (Needs you) | round 1, `:53` |
| runtime-failure.spec.ts:54 | no Reflect now (Journal panel) | round 2, `:54` |
| runtime-failure.spec.ts:55 | no Decline | round 3, `:55` |
| runtime-failure.spec.ts:56 | no Record exit (Closed Detail) | round 5, `:56` |
| runtime-failure.spec.ts:68 | no Record exit (Open Detail) | round 6, `:68` |
| runtime-failure.spec.ts:69 | no Record entry (Open Detail) | round 7, `:69` |
| e2e/d7/kill.spec.ts:35 | no "Reflection owed" | round 1, `:35` |
| d7/kill.spec.ts:36 | no Close Review owed heading | round 4b, `:36` |
| e2e/d7/responsive-a11y.spec.ts:75 | no Settlement Due heading | round 2, `:75` |
| e2e/d7/runtime-failure.spec.ts:34 | no Record expiration link | round 1, `:34` |
| d7/runtime-failure.spec.ts:34 | no Record entry link | round 7, `:35` (the loop line) |
| d7/runtime-failure.spec.ts:34 | no Record exit link | round 6, `:35` |
| e2e/d7/settlement-due.spec.ts:61 | no Settlement Due heading | round 1, `:61` |
| e2e/d7/support.ts:172 | no payoff region for an inapplicable line | round 1, `support.ts:172` |

#### Already proving (listed, unchanged)

- Unit, `querySelector` / `queryByText` / presence / value lines (DOM or text queries see hidden content, or the line is a presence check): payoff.test 23, 38, 39, 65; plan-risk.test 10; position.props.test 42; price-history.props 68, 103; today.props 151, 214, 225 (already `hidden: true`), 238; journal-cards.props 116, 163, 169, 179, 189, 190 (already `hidden: true`), 213, 241, 243; conditions.props 36, 53, 74, 94 to 97, 121, 197; identity.props 71, 72, 83; needs-you.props 34 (presence helper, left without `hidden` so a presence read stays strict), 42, 51, 65, 71, 84, 90, 98, 103 (already `hidden: true`), 118, 124, 131; pnl.props 65, 66, 84, 85, 119, 127, 136, 143; Cockpit.test 164 (already `hidden: true`), 169, 187 to 199, 225; Footer.test 59, 66; Journal.test 56, 63, 110, 141, 217, 220, 329, 330, 345, 346, 482, 549, 551; Payoff.test 94; Plan.test 52; Position.test 122, 153, 163, 197, 200, 210, 308; Result.test 52, 66; RiskReward.test 91; SettlementDue.test 25; Summary.test 33, 61, 73, 79, 80, 90, 152; Today.test 21; Valuation.test 28, 103, 107, 119.
- Browser, text of a visible region: d4/expected-mark.spec.ts:47, 48 (`valuation` not.toContainText).
- The `journalReflectNowButton` helper already passed `includeHidden`; its two call sites (faults.spec.ts:48, d6/runtime-failure.spec.ts:54) are in the changed list only for the `anywhere` wrapper that keeps the call uniform; the mutation round that ghosts `#drawer-panel-journal` made both fail.

#### Not Trade Detail (left unchanged)

Review, forms, list pages, nav and the app shell, so no hidden drawer applies: d1/recovery-only 22, 29; d2/integrity 81, 119; d2/no-save 135; d2/offline 30; d2/ui-alignment 148, 149, 175, 298, 1428; d4/responsive-a11y 157; d4/runtime-failure 33 to 50; d5/detail-debt 42 to 45; d5/faults 37 to 41; d5/kill-offline 37, 38, 65, 80; d5/review-debt 29, 64; d5/support 55; d5r/sliders 76 to 91; d6/close-review 75; d6/exit-action 21 to 24, 41; d6/exit-requirements 24; d6/exit 23, 46; d6/offline 22, 49 (and 56, a presence check); d6/responsive-a11y 80, 152; d6/runtime-failure 106; d7/offline 21, 32; d7/plan-open 71, 72; d7/runtime-failure 37, 38, 45, 46, 82; d7/short-put 37; d7/support 148.

#### Hidden checks in the browser suites

None found: no Playwright spec asserts a Trade Detail element is mounted and hidden (`toBeHidden` appears once, in `d5/support.ts:55`, on a Review card's form).

#### Totals

Gone 77 changed (42 unit, 35 browser); hidden 1 (Cockpit, two queries and one `hidden` assertion); already proving: the listed lines above. No stop: every gone check still passes once it looks inside hidden panels, so no thing is rendered where it should not be.

**Merge run 8** at `395f7ec5` (`browser-auto 0529a40b`, which chose the full tier from `e2e/d2/after-save.spec.ts`; the merges of T8P.29 and T8P.30): unit 1635, integration 222, checks 14 of 14, browser tier 1 128 and tier 2 75 passed, no failures; run complete. HEAD moved to `5fd1bfb4` mid-run (the main session's T8P.22 start record), and the scripts saw the uncommitted T8P.24 ocr JSON. Both are plan and evidence only, so the code tested is `395f7ec5`'s. The next merge run is `browser-auto 395f7ec5`.

**T8P.24 (lane NI), the Node suite.** Task `b3ec18e4`, lane tier `a8266e5e`. New: `tests/integration/d8p/support.ts` (the O-C3 builder `oc3({ thursdayHold? })`), `replay.test.ts` (I8P.1, I8P.2, I8P.3, I8P.7) and `replay-query-count.test.ts` (I8P.4); `detail.test.ts` gains I8P.5 and I8P.6, with section 6.1's titles word for word, beside T8P.9's "should …" cases. **Every case passed on its first run** (the behaviour exists already), and each is flagged. Each took a mutation of one expected value, which failed with an assertion and was reverted:
- I8P.1: the Wednesday call Mark 57.5 to 57.4;
- I8P.2: Wednesday's owed `Debt:` item to `Entry:`;
- I8P.3: the newest Trade P&L, `expected '4461/20' to be '11153/50'`;
- I8P.4: replay `meta.get` 9 to 8;
- I8P.5: nearest `['stop-2']` against `['stop-2', 'target-1']`;
- I8P.6: days 68 to 67;
- I8P.7: `FactsIncoherent` to `NeverExposed`.

I8P.3 first failed for a fixture reason (the Review's save result kind is `MarksSaved`, not `Saved`), not red evidence. **I8P.4:** a Detail read makes 20 requests (`meta.get` 11, `trades.get` 2, `catalog.getAll` 1, `observations.getAll` 1, one `getAll` each of the five Journal stores), equal to D7's `PINNED` and to D7S's end commit `795159cd` (measured in a throwaway worktree of this branch, since removed), and unchanged after a replay. The replay makes 17 (`meta.get` 8, `trades.get` 1, the five Journal stores, 3 `observations`: one date-wide read and one per Instrument, none per session). `npm run test:integration`: 106 files, 229 tests. `acceptance-commands.sh` exits 1 only on the two browser rows whose specs T8P.25 writes (`e2e/d8p/responsive-a11y.spec.ts`, `e2e/d8p/cockpit.spec.ts`); every Node row passes (AC-MARK-004, AC-RESP-001, AC-PERF-001, AC-CAP-001). Not a stop: those rows are due at the gate.

**T8P.24 review.** ocr, relocated (test-only commit), reviewed the 4 test files and made 2 comments (`ocr/T8P.24.json`). Both are Wrong, relocation artifacts: "the suites are not registered" (the real files match `tests/integration/**/*.test.ts`, and the lane's run counts 2 more files and 7 more tests) and "the `d1` and `d6` support imports are missing" (only `d7` and `d7s` support were copied). No bug tasks.

**T8P.24 merge.** Lane NI's base `46bb44f3` was behind T8P.30's test code (`97cde911`), so after rebasing onto `5fd1bfb4` the main session reran the lane tier: unit 1635, integration 229 (106 files), checks 14 of 14; run complete (`95a1c855`). Only evidence followed, so it was rebased onto `0a40eacd` and fast-forwarded: `3037a7c3` (task), `fe51f5a2`, `95a1c855`. Lane NI was removed. The next merge run (`browser-auto 395f7ec5`) covers T8P.24 with T8P.22.

**T8P.22 stop (lane wire).** Cases 1 to 5 and 7 are built, each red then green except case 5. Case 5, the saved reflection, passed on its first run, which is flagged; its mutation was `OwedDebtItem.resolved` no longer calling `setSettled`, and it failed with `expected <span class="badge" …> to be null`. The work in progress is held, unmerged, at `bec0bf84` on `d08p/wire`. It holds:
- the replay read, with up to 3 reads on `ChangedDuringAssembly`, then the Error state with Retry;
- a Settlement Due Detail reads the replay like Open;
- a failed or NotApplicable replay leaves the Detail-only cockpit;
- while the replay is pending, Price History and Journal show "Loading the Trade…";
- the tab counts as `.tab-count` spans described by `aria-describedby`, with each tab's name kept through `aria-label`;
- `ReflectRequest.settled(debtId)`, so Needs you follows the Journal without a read (revision 95).

It stopped on its brief's stop rule: retiring the three legacy blocks (case 6) drops figures no task had placed. The main session checked that against the plan and the specs. Section 1.5 dissolves the Summary card "one figure in one place", but places none of them. The UI contract requires the Valuation items (exact dates and source, Stale context, correction indicators, the acknowledgment wording). The user chose to place them all: revision 96 adds T8P.31 (lane PL). T8P.22 rebases onto it and then finishes case 6, the browser reach moves and the CSS. Unit at the stop: 24 failures, all legacy-block reads (Summary 10, Valuation 8, RiskReward 5, `Result.test.tsx` 1), which revision 96 settles.

**T8P.31 (lane PL), the legacy blocks' figures in one place.** Task `4ab7ee0f`, evidence `ca28d3d9`: unit 1642, integration 229, checks exit 0, browser tier 1 128 and tier 2 75 passed; run complete. The titles diff is exactly the seven new titles. Case 2 (the current Marks in Position on a state without Today) passed on its first run, because `Cockpit.tsx` already renders `TodayDrawer` in the Position panel there. It is flagged; its mutation (`todayProps` leaves out `currentMarks` when a settlement is due) failed with `expected null not to be null`. Places:
- the current Marks card (`.current-marks`, no heading, since no existing word fits without clashing with a legacy region): Today, or Position on Settlement Due; Mark, Source, Saved and correction rows left out where Today's comparison shows them;
- the Trade Summary: Position on Closed, Plan and Risk on Planned;
- Net cost: the Position card, Open only;
- the Entry status: Entry Quality's first row;
- Deviation active: in the lifecycle badge's line;
- each condition's figures: a Plan and Risk card in Plan order.

Expectations changed by the placement (revision 96):
- `plan-risk.test.tsx` no longer lists `Entry` as a Summary-only term;
- `e2e/d2/ui-alignment.spec.ts:1163`: the Entry Quality row count goes from 7 to 8, the new Entry row. The main session accepted this as the direct consequence of revision 96's Entry placement; the figure itself is unchanged.

Accepted beyond the plan's words: the new card leaves out the "Mark missing" link while `firstMarksDue` is set, since no Mark is due yet and "No Marks yet" names when they are (revision 90). The Overrun, Boundary and Status columns of the legacy conditions table already have their place on the Conditions card (W5: row 2 names the boundary, row 1 the status, row 3 the overrun), which the main session checked.

**The user's choice on case 7.** The main session found that the Conditions card already shows every condition's distance (W5, one block per condition), so case 7 repeats it. T8P.22's agent had read the rail as nearest-only. The user chose to keep case 7 as built ("Keep case 7"), so revision 96 stands unchanged.

**T8P.31 review.** ocr ran on `4ab7ee0f` from a scratch clone. The in-place pass reviewed 11 files (5 excluded) and found nothing (`ocr/T8P.31-inplace.json`). The relocated pass reviewed the three changed test files with `test-support.ts` (14 files) and made 1 comment (`ocr/T8P.31-reloc.json`): "JSX inside a `.ts` file". It is Wrong, a relocation artifact: the real file is `Placed.test.tsx`. No bug tasks.

**T8P.31 merge.** Only plan and evidence followed lane PL's base `bbdc61a2`, so its tiers stand. Rebased onto `99c6c7cc` and fast-forwarded: `b6e476ef` (task), `9d7c38b0`. Lane PL was removed. T8P.22 now rebases its work in progress onto this and finishes.

**T8P.22 (lane wire), Trade Detail reads `replayTrade`.** Rebased onto `0e9ac4c2` with no conflicts. The work in progress was amended into the task commit `cc5c9f4f`, and evidence `84eaddd3`. Results: unit 1649, integration 229, checks 14 of 14, browser tier 1 126 (two retired `ui-alignment` tests fewer) and tier 2 75; run complete. `verify:capabilities` OK, with `routes.ts` unchanged. The titles diff has only additions: T8P.22's seven and T8P.31's seven.

Red lines:
1. `Unable to find an element with the text: +$200.00 since Mon Oct 12`.
2. The same.
3. `expected "vi.fn()" to not be called at all`.
4. `Unable to find role="region" and name "State of play"`.
5. A flagged first-run pass. Its mutation, `OwedDebtItem.resolved` without `setSettled`, failed with `expected <span class="badge" …> to be null`.
6. `Summary: expected [ <section …> ] to deeply equal []`. Its additions for T8P.31's figures passed on their first run and are flagged; five mutations (the Net cost, Risk to stop, Expected Mark Date and Source labels, and the Deviation active condition) each failed with an assertion.
7. `expected [ <h3></h3>, <h3></h3> ] to have a length of 1 but got 2`.

Assertions added after a case's green ran red then green: case 3's incoherent Journal card, and case 1's "Due in the next Review".

**Accepted by the main session:**
- **The due status.** A replayed Debt carries no `dueStatus`, so `journal.props.ts` takes it from the Detail's own Debt of the same id. This restores `d5/responsive`'s "Due in the Review after next".
- **Expected values that follow approved words.** None was listed in the brief; each follows the Conditions card or an A-row:
  - `d4/breach-overrun`:
    - the Stop's boundary reads row 2 in W6's words;
    - its Overrun `$50.00 (0.20R)` reads row 3 (W5);
    - an Active Target shows its distance, `/^\+\$/`, not "Active" (W5);
    - awaiting conditions read "Awaiting close" at the `label` length (A222), with Worst case still "Awaiting the close after Mon Oct 12";
    - the per-condition lines show "—", as the retired table's Distance column did.
  - `d4/expected-mark`: the conditions read "Mark missing" at the `label` length (A222). The P&L card keeps the full sentence.
  - `d7/settlement-due`: the Position card's Open P&L reads "Settlement Due" (A224, T8P.17).
  - `d7s/entry-beyond-stop`: `toContainText('$735.00')`, since Entry Quality adds the R (T8P.18).
- **Retired checks** (`evidence/D08P/T8P.22-retired.md`). T8P.25 names the cockpit check that replaces each one:
  - two `d2/ui-alignment` tests, "should set the summary card figures at 18 px or more…" and "should show Stop and Target with their labels in colours that reach 4.5:1…", with their helpers `channels` and `contrastOf`;
  - the "summary values on one right edge" assertion, whose test stays for its 480 px row width.
- **CSS removed** from `legacy-detail.css`: `.summary-card .summary-text`, `.stop`, `.target`, `dd`, `.badge` and `.summary-card dl.figure-grid`. `.summary-text` stays, since both drawers use it.
- **Behaviour** (no new words):
  - up to 3 reads on `ChangedDuringAssembly`, then the Error state with Retry;
  - Settlement Due reads the replay;
  - a failed or NotApplicable replay leaves the Detail-only cockpit;
  - the tab counts are `aria-describedby` spans with `aria-label` names.

**T8P.22 review.** ocr ran on `cc5c9f4f` from a scratch clone. The in-place pass reviewed 16 files (25 test, e2e and evidence files excluded) and made 2 comments (`ocr/T8P.22.json`). The relocated pass reviewed the 23 test files and made 1 comment (`ocr/T8P.22-reloc.json`).
- **Valid → bug task T8P.22-B1.** Reflect now from Needs you does not turn the Journal cards to the page that holds the Debt. `JournalCards` shows 3 cards a page, and hides the rest. For an older session's Debt, the form opens inside a hidden card and blocks every other form (A217: Reflect now opens that Debt's form on its card). The main session confirmed it in `journal-cards.tsx`.
- **Doubtful → bug task T8P.22-B2.** A slow read for one Trade can settle after the route moves to another and overwrite its state: there is no stale-read guard, and the route is not keyed by `tradeId`. The gap is old, but the replay read and its retries widen it.
- **Wrong.** "The import resolves to the test file itself" is a relocation artifact.

The reviewer reported the lane modified and main clean; the reverse was true (main held the main session's uncommitted record). No action.

**T8P.22-B1 and B2** (`cb27d447`, evidence `c31b0399`): unit 1651, lane tier and run complete. Each case ran red then green, with no first-run pass (`tdd-log/T8P.22-B1.md`, `T8P.22-B2.md`).
- **B1:** "should turn the Journal cards to the page holding the Debt when Reflect now is chosen for a Debt on an older session". Red: `Unable to find role="form" and name "Reflection"`. `JournalCards` reads the existing `ReflectRequestContext` and turns to the page holding the Debt's card.
- **B2:** "should keep the Detail of the Trade the route is on when an earlier Trade's read settles after the route moved". Red: `expected [ <h1></h1> ] to deeply equal []`. `TradeDetail.tsx` applies only the newest request's answer through a ticket, and the effect cleanup voids a pending read.

**Re-review:** ocr ran on `cb27d447`. The in-place pass reviewed 2 files and the relocated pass 3, with 0 comments (`ocr/T8P.22-B.json`, `ocr/T8P.22-B-reloc.json`).

**T8P.22 merge.** Only plan and evidence followed lane wire's base `0e9ac4c2`, so its tiers stand. Rebased onto `af5442ce` and fast-forwarded: `0c78979f` (task), `7090ad0b`, `8771f053` (B1, B2), `7effc464`. Lane wire was removed. Merge run 9 (`browser-auto 395f7ec5`) covers T8P.24, T8P.31 and T8P.22.

**Merge run 9** at `c670929c` (`browser-auto 395f7ec5`, which chose the full tier from `e2e/d2/ui-alignment.spec.ts`; the merges of T8P.24, T8P.31 and T8P.22): unit 1651 (159 files), integration 229, checks 14 of 14, browser tier 1 126 and tier 2 75 passed, no failures; run complete. The scripts saw the main session's uncommitted T8P.27 start record, and HEAD moved to `4b0bae31` (that record) before the browser stages. Both touch only plan and evidence, so the code tested is `c670929c`'s. The next merge run is `browser-auto c670929c`.

**T8P.27 (lane rm), the old Detail sections removed.** Commits:
- the pairing table `2415fc21`, committed alone before any deletion;
- the moved assertions `5821d382`, 13 cases, committed before the deletion so coverage never lapses;
- the deletion `2a70088c`;
- evidence `d4ee5023`.

Results: unit 1640, integration 229, checks 14 of 14, browser tier 1 126 and tier 2 75; run complete. The lane marker went when the full browser tier ran.

**The unreachable check.** The dependency-cruiser module check from `src/main.tsx` was too coarse, since a file stays reachable through one live export, so an export-level script (no non-test importer) was added. Before: module level `Summary.tsx`, `test-support.ts`; export level the unused `Composed.tsx` blocks, `IdentityHeader`, `PositionSection`, `LotMatchesSection`, `FeeReconciliationSection`, `ConditionLines`, and every export of Today, Plan, Footer, Payoff, SettlementDue, Valuation, RiskReward and Summary. After: `test-support.ts` only, the shared test helper 16 test files use.

**Removed:**
- the files `Summary.tsx`, `Valuation.tsx`, `RiskReward.tsx`, `Today.tsx`, `Plan.tsx`, `Footer.tsx`, `Payoff.tsx`, `SettlementDue.tsx`, and the tests `Summary.test.tsx`, `Valuation.test.tsx`, `RiskReward.test.tsx`;
- trimmed: `Composed.tsx` to `JournalBlock` (the orphan `NeedsYouBlock` goes), `Identity.tsx` to `BackToTrades`, `Position.tsx` (three sections), `figure.tsx` (`ConditionLines`, the `tone` prop), and `test-support.ts` (`renderLegacyView`, `renderLegacyDetail`, `legacyBlocks`);
- **no CSS selector removed**: every remaining `legacy-detail.css` class is still rendered by a piece living on in the drawers and rail.

**Titles:** 24 removed, all in the table, and 13 added, the moved assertions M1 to M13. **All 13 passed on their first run** (the cockpit already rendered each value), and each is flagged with its mutation's assertion failure in `tdd-log/T8P.27.md`. M13's absence check uses both a `hidden: true` role query and a DOM query, because the role query missed a planted hidden region with an `aria-label`.

**Main-session check of the pairing table (revision 86), row by row.** All 24 rows hold.
- **Covering cases:** spot-checked against their files: row 3 in `Plan.test.tsx` (Intended entry "$50.00", Target "$56.00", Reward : risk "2.4"), row 5 (`$270.00`), row 9 (`pnl.props.test.tsx` "1 of 2 contracts open"), rows 10 and 9 (`identity.props.test.tsx`), row 11 (Placed "$248.70 credit", "$190.65"), row 17 (`conditions.props.test.ts` "Outside calendar"), rows 21 and 24 ("… past this Stop."), row 20 (Placed "$450.00 · 1.80R", "$400.00 · 1.60R"), row 23 (`Plan.test.tsx` "XYZ at or below 48.00", "XYZ at or above 60.00"), and row 24's order (`conditions.props.test.ts:181`).
- **Retirements:**
  - Rows 13, 16 and 18 retire the Valuation's "+$180.00 · +0.72R" form by W3, whose figure is "$188.05", with no sign and no R.
  - Rows 17 and 20 retire the aggregate Risk to stop and Reward to target words by A207 and A222: the reason sits at the `figure` length on the P&L card, and at the `label` length on the Conditions card.
  - Row 20's "1.00R" and "2.40R" companions are the Plan Baseline's 1R and its Reward : risk "2.4".
  - Row 22's NotApplicable aggregate: W5 is the stronger citation, since a Closed condition shows rows 1 and 2 only.
  - Row 23 retires by A223.

No row lacks a covering case, a retiring row or a moved case, so there is no gap.

**T8P.27 review.** ocr ran on `2415fc21..2a70088c` from a scratch clone. The in-place pass reviewed 6 files and found nothing (`ocr/T8P.27.json`). The relocated pass reviewed the 7 test files of `5821d382` and made 1 comment (`ocr/T8P.27-reloc.json`): "the moved assertions are not discovered". It is Wrong, a relocation artifact: the real files are `*.test.tsx` and `*.test.ts`, which vitest discovers. The reviewer also checked that nothing a non-test file imports was removed: `tsc`, eslint and `lint-deps` were clean at `2a70088c`, and a grep found no import of the 8 removed sections or the removed helpers. No bug tasks.

**T8P.27 merge.** Only plan and evidence followed lane rm's base `c670929c`, so its tiers stand. Rebased onto `f06828c4` and fast-forwarded: `f9ee10a2` (pairing table), `4a610613` (moved assertions), `9557c405` (removal), `e0cceac6`. Lane rm was removed. No lane remains. Next is wave 2's full-tier run, then the checkpoint critic, T8P.23.

**Merge run 10, the full tier before the checkpoint critic** at `117ba8d5` (the merge of T8P.27): unit 1640 (156 files), integration 229, checks 14 of 14, browser tier 1 126 and tier 2 75 passed, no failures; run complete. The "uncommitted changes" in the headers were the run's own new evidence files. The next merge run is `browser-auto 117ba8d5`. T8P.23, the checkpoint critic, starts on this commit.

**T8P.23, critic-1** (`critic-1.md`) at `05ca870f`: **FAIL** on C8P.4. C8P.1, C8P.2, C8P.3 and the narrow layout pass. The critic's tool refused to write `test-results/critic-d08p-1/report.md` ("Subagents should return findings as text"), so the main session saved its hand-back text unchanged: it took the text from the session transcript with a script, and copied it with `cp`, never retyping it.

Every defect becomes a bug task, run one at a time in the main worktree (`critic-brief.md`). The main session checked each against the plan; all are fixable within it, because C8P.4's pass condition is "each matches the prototype's state":
- **T8P.23-B1 (high).** On a Closed Detail the Result figures show twice: in the rail's P&L card (W4) and in the Position drawer's "Result" region. The Reach table's Position list holds no Result, and neither do the prototype's Closed Position drawers.
- **T8P.23-B2 (moderate).** The Settlement Due panel in Needs you breaks words mid-word at 1280 px ("contr / act").
- **T8P.23-B3 (moderate).** On Settlement Due, the Position drawer holds the whole Today drawer: the price tracks, the A223 condition lines and the "At entry" block. Revision 96 sends only the current Marks there. The "At entry" Average entry ($1.90) differs from Entry Quality's ($2.00) under the same label; the bug task finds why.
- **T8P.23-B4 (moderate).** The Position drawer's tables are hard to read at 1280 px. Lot Matches cells have no spacing and a duplicate visible caption, and Open Lots' fourth column is cut off.
- **T8P.23-B5 (low).** The rail order is identity, Needs you, P&L, Conditions. T8P.5 set it in `f0c51e60`, but T8P.5's case and the prototype give identity, P&L, Conditions, Needs you.
- **T8P.23-B6 (low).** An incoherent Detail has no Conditions card, by T8P.14's choice. The prototype's state lists the conditions without figures, which are W5's rows 1 and 2, as on Closed.
- **T8P.23-B7 (low).** A Planned Detail's Journal is the old list, not W11's Plan card ("Planned … ", heading "Plan").
- **T8P.23-B8 (low).** An unavailable per-condition figure shows a bare "—" (Plan and Risk's lines, and A223's distance lines). A222 says it shows its reason at the `label` length.

The minor observations are recorded, not tasks. Observation 1, the Journal card repeating the rail's Trade P&L, is W10's required content.

**T8P.23-B1** (`d15649d1`). The Position drawer no longer renders a Closed Trade's Result: the rail's P&L card is the one place (W4, the Reach table). `Result.tsx` had no non-test importer left and is deleted. Each moved read keeps its value and is also asserted on the rail (`pnl.props.test.tsx`).
- **Test:** "should show the Result rows and the realized figure once on the rail, with no Result region in the Position drawer, on a Closed by sale and a Closed by expiration Detail". Red: `expected <section class="card" …> to be null`.
- **Expected value moved:** the drawer-only "+$248.00" read now reads the rail's "$248.00" (W4).
- **Browser specs run:** 11 specs, 15 tests passed.
- **Review:** ocr in place, 4 files, 0 comments (`ocr/T8P.23-B1.json`). Relocated, 1 comment (`ocr/T8P.23-B1-reloc.json`). That comment is Wrong, a relocation artifact: `ClosedResultSection` no longer exists anywhere.
- **Quick run (`T8P.23-B1`):** unit 1641, integration 229, checks 14 of 14, browser-task 6 passed; run complete.

**T8P.23-B2** (`081024fe`). CSS only: `.settlement-due dl.figure-grid` in `rail-b.css` stacks each term above its value in the rail, and breaks only at spaces (A224, W7).
- **Test:** "should show every term and value of the Settlement Due panel in the rail at 1280 px without a word broken across lines" (`e2e/d7/responsive-a11y.spec.ts`). It measures each letter's line top. Red: `["Long 1 contract", "Fri Nov 20, 16:00"]`.
- **Browser specs run:** 7 passed. No expected value changed.
- **Review:** ocr in place and relocated, 0 comments (`ocr/T8P.23-B2*.json`).
- **Quick run:** unit 1641, integration 229, checks 14 of 14, browser-task 6; run complete.

**T8P.23-B3** (`f3c853ba`). On a state without Today, the Position drawer renders only the Today drawer's current Marks card (`CurrentMarksOnly`), not the whole drawer. The price tracks, A223's condition lines, the dated section and "At entry" stay Today's own (revision 96, W6, C8P.4).
- **Test:** "should show only the current Marks card of the Today drawer in the Position drawer on a Settlement Due Detail". Red: `expected <div class="tracks">… to be null`.
- **$1.90 against $2.00:** the fixture's entry fills are $2.10 and $1.90. Entry Quality averages both; "At entry" (A54) covers only the later lot. No figure is wrong.
- **Browser specs run:** 15 passed.
- **Quick run (`T8P.23-B3`):** unit 1642, integration 229, checks 14 of 14, browser-task 6; run complete.
- **Review:** ocr in place and relocated, 1 comment each, the same one (`ocr/T8P.23-B3*.json`). It is **Valid**: `CurrentMarksOnly` passed the replay, so the card left out the Mark, Source, Saved and Underlying Mark rows "already shown" by a comparison that the Position drawer doesn't render. This became bug task **T8P.23-B3-B1**.

**T8P.23-B3-B1** (`917eab41`). `CurrentMarksOnly` builds the card from the view alone. It no longer drops a row, and no longer changes when the replay arrives.
- **Test:** "should show the Mark, Source, Saved and Underlying Mark in the Position drawer card even when the replay holds an available Mark". Red: `Unable to find an element with the text: Mark`.
- **Browser specs run:** 15 passed.
- **Review:** ocr in place, 0 comments. Relocated, 1 comment, which is Wrong: the scratch base held the pre-fix `today.tsx` (`ocr/T8P.23-B3-B1*.json`).
- **Quick run:** unit 1643, integration 229, checks 14 of 14, browser-task 6; run complete.

**T8P.23-B4** (`7dccdff5`, `1e84b7b5`). CSS only, in `position.css`, every rule under `.cockpit-drawers`, so the exit and expiration receipts that share `LotMatchesTable` keep their look.
- **What changed:**
  - The Position drawer's tables take `table.trades`' cell padding and header style.
  - The Lot Matches caption stays as the table's accessible name, visually hidden, because the heading already names the section.
  - Open Lots' headers wrap.
- **Tests:**
  - "should space the Position drawer tables, name Lot Matches once in visible text, and show every Open Lots column whole at 1280 px" (`e2e/d6/responsive-a11y.spec.ts`). Red: `Position drawer cells that touch` ("BoughtSoldQuantityRealized").
  - "should show the Position drawer tables of a Settlement Due option Trade spaced, with Lot Matches named once and every Open Lots column and figure inside its region at 1280 px" (`e2e/d7/responsive-a11y.spec.ts`), on the critic's fixture with the $0.65 unconsumed opening fee.
    - It is a flagged first-run pass on `7dccdff5`.
    - Mutations:
      - header `nowrap` gives `cut: ["Unconsumed opening fee", "$0.65"]`, `scrolls: true`;
      - the caption shown gives `Expected: 1 Received: 2`.
    - Round 1 said the Open Lots clause couldn't be made red. That came from a stale `dist-releases`, and round 2 corrected it.
- **Browser specs run:** 60 passed (`browser/T8P.23-B4-r2-specs.txt`). No expected value changed.
- **Review:** ocr in place, 1 file, 0 comments (`ocr/T8P.23-B4.json`). The range changes `src`, so no relocated run.
- **Quick run (`T8P.23-B4`):** unit 1643, integration 229, checks 14 of 14, browser-task 6; run complete.

**T8P.23-B5** (`9215dbee`). The rail's cards now read identity, P&L, Conditions, Needs you, as in T8P.5's case and the prototype, which builds one rail for every state.
- **Test:** "should show the rail cards in the order identity, P&L, Conditions and Needs you" (`TradeDetail.test.tsx`), on an Open Trade with an owed Debt. Red: a deep-equal failure with Needs you second.
- **Expected values:** none changed. No existing case read the old order. `rail-b.ts`'s `needsYouCard` finds the card by its region name.
- **Browser specs run:** 51 passed (`browser/T8P.23-B5-specs.txt`).
- **Review:** ocr in place, 1 file, 0 comments (`ocr/T8P.23-B5.json`).
- **Quick run (`T8P.23-B5`):** unit 1644, integration 229, checks 14 of 14, browser-task 6; run complete. The task agent saw one unit failure on its first run, which it did not name and which did not come back on its rerun. This run had none.

**T8P.23-B6** (`78773d22`). An incoherent Detail's rail now carries the Conditions card. It lists each Plan condition as rows 1 and 2 only, with no figure and no summary (`conditionsProps`, `unmeasured(view.plan)`).
- **Why this layout:** W5 names only "No Marks yet, or Closed" for rows 1 and 2. The prototype's "Facts can't be replayed" state lists the conditions that way, and the breakdown says nothing else for this state, so the prototype decides (P96). No new words.
- **Test:** "should list the Plan conditions on an incoherent Detail, rows 1 and 2 only, with no figure, no row 3 and no summary" (`conditions.props.test.ts`). Red: `Unable to find an accessible element with the role "list" and name "Conditions"`.
- **Expected values:** none changed.
- **Browser specs run:** 60 passed (`browser/T8P.23-B6-specs.txt`).
- **Review:** ocr in place, 0 comments (`ocr/T8P.23-B6.json`). The reviewer confirmed that `Cockpit.tsx` renders `ConditionsCard` for every view, and a probe in its scratch clone found the card in the rail.
- **Quick run (`T8P.23-B6`):** unit 1645, integration 229, checks 14 of 14, browser-task 6; run complete.

**T8P.23-B7** (`f95e571e`). A Planned Detail's Journal is now the cards drawer: W10's heading "Sessions, newest first" with ‹ and ›, as in the prototype's Planned state, and W11's Plan card ("Planned Mon Oct 12, 9:00 am", heading "Plan") carrying the Plan Reflection. There is no W12 card, since there is no session yet.
- **What moved:**
  - `Cockpit.tsx` has `cardsReplayOf`, and `journal.props.ts` takes `replay: 'Planned'`.
  - The old Plan Reflection region (`PlanReflectionSection`) was orphaned and is removed. `JournalDrawer` stays, for an Open or Closed Detail whose replay can't be read.
- **Test:** "should show a Planned Detail's Journal as the Plan card with the Plan Reflection's answers, and no old Plan Reflection region or Journal heading" (`Cockpit.test.tsx`). Red: `Unable to find an accessible element with the role "article" and name "Plan"`. The region, `#reflection-heading` and "Journal (N)" are asserted absent from the DOM.
- **Reach changes:** these follow T8P.22's revision-96 note, "Reads through them move to the cards", and the text is unchanged.
  - The Plan Reflection read in `Plan.test.tsx` moves to the Plan article.
  - `planReflection` in `e2e/support/detail/journal.ts` now reads the Plan article alone.
  - In `d2/ui-alignment`, the "answers as prose" row selector narrows from `dl > div` to `dl.answers > div`, because the card item adds Anchor, Source and Moment rows. Its assertions are unchanged.
- **Browser specs run:** 55 passed and 1 failed, the `ui-alignment` case above. It passed on rerun after the selector change (`browser/T8P.23-B7-*.txt`).
- **Review:** ocr in place, 6 files, 1 comment (`ocr/T8P.23-B7.json`).
  - The comment says the Planned mapping puts every Entry in `view.journal` on the Plan card, unfiltered. The reviewer called it Doubtful, as a latent fragility it could not reach.
  - The main session reassessed it as **Wrong**, because A213 says "An item before the first exposure goes in a 'Plan' list". A Planned Trade has no exposure, so every one of its items is the Plan's, which is what the replay's `placeJournal` does. Filtering to the Plan Reflection would contradict A213. Dismissed, so no bug task.
- **Quick run (`T8P.23-B7`):** unit 1646, integration 229, checks 14 of 14, browser-task 7; run complete.

**T8P.23-B8** (`dc4aff42`). An Unavailable or Not Applicable condition result shows its reason at the `figure` length (A222) where the figure lives. A222 and W5 settle the lengths: the rail is where the cockpit refers to the figure again, at the `label` length.
- **Where the reason now shows:**
  - Plan and Risk's "Risk to stop" and "Reward to target" (`conditionFiguresGroup`);
  - Today's A223 "Distance on <Underlying>" line (`conditionLineOf`).
- **Source of the words:** `calculation(...)` from `figures.ts` produces them from `calculation-words.ts`. No new words.
- **Tests:**
  - "should word a missing Mark in Risk to stop and Reward to target at the figure length, with no bare dash left" (`plan-risk.test.tsx`). Red: `expected [ '—', '—' ] to deeply equal [ …(2) ]`.
  - "should word an unavailable condition result in the distance on the Underlying line at the figure length, with no bare dash" (`today.props.test.ts`). Red: `expected '—' to be 'Mark missing: XYZ, Thu Nov 19'`.
  - No fixture yields a Not Applicable result, so that path shares the helper but has no case.
- **Expected value changed (A222):** `Placed.test.tsx` lines 201 and 202, from `['—']` to `['Mark missing: XYZ, Tue Oct 13']`.
- **Dashes left in Today, by design.** Neither stands for an unavailable result:
  - "Value at expiration" without a baseline value;
  - a Value reading with no Underlying distance.
- **Browser specs run:** 59 passed (`browser/T8P.23-B8-specs.txt`).
- **Review:** ocr in place, 2 files, 0 comments (`ocr/T8P.23-B8.json`).
- **Quick run (`T8P.23-B8`):** unit 1648, integration 229, checks 14 of 14, browser-task 7; run complete.

**Merge run 11, the full tier after critic-1's bug tasks** at `081f3bf4`: unit 1648 (156 files), integration 229, checks 14 of 14, browser tier 1 126 and tier 2 79 passed, no failures; run complete. Critic-2 starts on this commit.

### Critic-2 (T8P.23) at `b11aa7ab`

FAIL on C8P.2. The report was refused as a file write, so it was extracted from the session transcript by script and copied unchanged to `critic-2.md`. Critic-1's eight defects did not recur. The new defects, numbered as bug tasks from B9:
- **Defect 1 (high, C8P.2):** figures shown twice beyond the accepted exceptions:
  - (a) and (b): the Position drawer's Opening fees and Incurred fees, beside the Fee reconciliation;
  - (c): Entry Quality's "Reward : risk 1.98 / planned 2", beside the Plan Baseline;
  - (d): Today's At entry block, beside Entry Quality and Position;
  - (e): Today's Stale context, comparison and dated block, which repeat a Mark, and the dated block's fees and realized figures.

  All of these are existing words that the plan kept: W8 says "The Valuation's Mark provenance, the dated line and At entry keep their words". So this needs the user's decision, not a bug task.
- **Defect 2 (moderate):** on the expiration day itself, the Settlement Due P&L card reads "Mark missing: …" instead of W4's "Settlement Due: <contract>". Bug task **B9**.
- **Defect 3 (moderate):** Price History and Journal count the sessions after a contract's expiration as missing Marks. A212 runs an Open Trade's lifetime to the Expected Mark Date, so this needs the user's reading.
- **Defect 4 (moderate):** Reflect now in Needs you opens the form out of view and leaves focus on the rail (A217). Bug task **B10**.
- **Defect 5 (moderate):** a Closed Trade's final session, flat at its close, reads "without Marks" and loses W10's "final session" card. Bug task **B11**.
- **Defect 6 (low):** a stock Mark has no "$" in Price History only. Bug task **B12**.
- **Defect 7 (low):** "Stale context: $51.50 from Tue Oct 13 close" still says "close" (P102). Changing it is a new text, so it needs the user's approval.

**User decisions on critic-2 (2026-11-14):**
- Defect 1: "Accept all five". Revision 97 names every accepted exception in C8P.2. Not a bug task.
- Defect 3: "End at expiration". Revision 98 ends a Settlement Due Trade's history with its contract's expiration session. Bug task **B13**.
- Defect 7: "Leave it as is". The Stale context line keeps "close". It is recorded in revision 98 and is not a bug task.

**T8P.23-B9** (`61a27c87`). On the expiration day, `view.settlement` is already non-empty, but the evaluation's reason is still `MarkMissing`. It becomes `SettlementDue` the next session.
- **The fix:** the P&L card now names the contract from `view.settlement[0]` whenever its Trade P&L is Unavailable (W4, A224). Plan and Risk's per-condition lines do the same for an Unavailable result (W6). The new `settlementDueFigure` in `figures.ts` uses existing words.
- **Tests:**
  - "should name the contract on the expiration day itself, with no Mark missing text on the card" (`pnl.props.test.tsx`). Red: `expected 'Mark missing: XYZ 20 Nov 2026 55 Call…' to be 'Settlement Due: …'`.
  - "should word Risk to stop and Reward to target as Settlement Due on the expiration day, with no Mark missing text" (`plan-risk.test.tsx`).
- **Expected values:** none changed.
- **Browser specs run:** 52 passed (`browser/T8P.23-B9-specs.txt`). No browser case sits at the Nov 20 clock; the props tests cover it.
- **Review:** ocr in place, 3 files, 0 comments (`ocr/T8P.23-B9.json`). The reviewer's notes are recorded and are not bug tasks:
  - on the expiration day, an Underlying condition whose Underlying Mark is missing is now worded "Settlement Due", as on the rail, rather than naming the Underlying;
  - a condition with a Value on that day still shows its figure in Plan and Risk, while the rail calls it unmeasured.
- **Quick run (`T8P.23-B9`):** unit 1650, integration 229, checks 14 of 14, browser-task 7; run complete.

**T8P.23-B10** (`4487acce`). When Reflect now in Needs you opens a Debt's form, `OwedDebtItem` now focuses the form area and scrolls it into view (A217). The card's own Reflect now and Decline still don't move focus.
- **Tests:**
  - "should move focus into the opened form and scroll it into view when Reflect now is chosen in Needs you" (`Cockpit.test.tsx`). Red: `expected false to be true`.
  - Two browser cases in `e2e/d5/detail-debt.spec.ts`, at 1280 and 375 px, showed red by taking the fix out: the focus check failed, and the form's `toBeInViewport` ratio was 0. Both are logged by hand.
- **Expected values:** none changed.
- **Lint:** a second `react-hooks/exhaustive-deps` warning, of the same kind as the item's existing request effect.
- **Browser specs run:** 78 passed (`browser/T8P.23-B10-specs.txt`).
- **Review:** ocr in place, 1 file, 0 comments (`ocr/T8P.23-B10.json`). Notes, not bug tasks:
  - the reviewer found no stale closure and no double focus, and every reset path covered;
  - the unit case's `Element.prototype.scrollIntoView` stub isn't restored. It leaks only within that test file, and production calls it with `?.`.
- **Quick run (`T8P.23-B10`):** unit 1651, integration 229, checks 14 of 14, browser-task 7; run complete.

**T8P.23-B11** (`21a54f12`). A session whose replayed Position is flat at its close (A211's `positions`, every quantity zero) has no Mark due.
- **Price History:** the session no longer counts as a gap on the tab or in the count line. Its cells read a plain "—" with no "No Mark" name, because W9's "No Mark" names a gap.
- **Journal:** it is not merged "without Marks" (A214), so a Closed Trade's final session keeps W10's "<date>, final session" card with its Trade P&L.
- **Scope:** the fix is in `src/ui` only.
- **Tests:**
  - "should not count the final session of a Closed Trade, flat at its close, as a session without Marks". Red: `expected 1 to be +0`. The count line and link are asserted absent from the DOM, and a real earlier gap still counts.
  - "should head a Closed Trade final session flat at its close as the final session with its Trade P&L, not as without Marks". Red: `expected [ 'Tue Oct 13 without Marks', …] to deeply equal [ 'Tue Oct 13, final session', …]`.
- **Expected values:** none changed. Test doubles gained `positions`. The `TradeDetail.test.tsx` replay double had `positions: []`, which now reads as flat, so it holds 100 shares per session, as the real view does.
- **Browser specs run:** 55 passed (`browser/T8P.23-B11-specs.txt`). No browser case reproduces the Closed-by-sale state; the props tests cover it.
- **Review:** ocr in place, 2 files, 0 comments (`ocr/T8P.23-B11.json`). The reviewer found no session that is flat at its close yet owed a Mark, and no Open Trade whose real gap would be hidden. The flat test is per session, not per Instrument, as before.
- **Quick run (`T8P.23-B11`):** unit 1653, integration 229, checks 14 of 14, browser-task 7; run complete.

**T8P.23-B12** (`9aab5e57`). Price History now decides "option Trade" the way the Journal does: any Option among the replay's instruments.
- **Effect:** a stock Trade's Mark keeps its "$" ("$51.50"), as in Today and the Journal (W9, W10, C1). An option Trade's Underlying Mark has none, and every option Mark keeps its "$".
- **Test:** "should give a stock Trade's Mark a dollar sign and an option Trade's Underlying Mark none". Red: `expected [ 'XYZ Mark', '51.50', '51.00' ] to deeply equal [ 'XYZ Mark', '$51.50', '$51.00' ]`.
- **Expected values:** none changed.
- **Browser specs run:** 49 passed (`browser/T8P.23-B12-specs.txt`).
- **Review:** ocr in place, 1 file, 0 comments (`ocr/T8P.23-B12.json`). The reviewer checked five Trade shapes against Price History, the Journal and Today, and the three agree on all of them:
  - stock;
  - long option;
  - short option;
  - Cash-Secured Put;
  - after exercise or assignment, holding stock.
- **Quick run (`T8P.23-B12`):** unit 1654, integration 229, checks 14 of 14, browser-task 7; run complete. The runner ran the checks stage, which builds, alongside the browser stage. Both passed.

**T8P.23-B13** (`c2565ce1`, revision 98). `replayTrade` now cuts a Settlement Due Trade's sessions at its contract's expiration.
- **How:** `settlementExpirationOf` finds an option with open lots that is at or past its expiration on the read session's trading date, and `replaySessions` keeps `tradingDate <= expiration`.
- **Effect:** `ended` makes later items go to the final session and leaves no pending session. No UI change was needed.
- **Tests (`option-views.test.ts`):**
  - "should end the sessions with the expiration session and list no later session and none not yet ended, read on Monday Nov 23". Red: `expected '2026-11-23' to be '2026-11-20'`.
  - "should show no session not yet ended when read on the expiration day itself, Friday Nov 20". Red: `expected { date: '2026-11-23', journal: [] } to be null`.
  - "should keep the newest session and the session not yet ended for an Open Trade whose contract has not expired, read on Thursday Nov 19". A flagged first-run pass; the mutation that counts every held contract as due fails it.
- **Browser case:** `e2e/d8p/settlement-due-replay.spec.ts`, at Fri Nov 20 and Mon Nov 23. Red, with the fix taken out: `getByText('Session not ended yet') toHaveCount(0): Expected 0, Received 1`, on the Friday read.
- **Expected values:** none changed.
- **Browser specs run:** 53 + 8 passed.
- **User decision (2026-11-14), "Keep final session":** the last card now reads "Fri Nov 20, final session". These are W10's words, and the last session the contract traded is the final one.
- **Review:** ocr in place, 2 files, 1 comment (`ocr/T8P.23-B13.json`). It is **Valid**: `settlementExpirationOf` cuts the whole Trade as soon as any held option is due. A Trade that also holds stock or a later contract would lose that leg's later sessions and its pending session. A212 and revision 98 name one contract, and the Covered Call is in the reference catalog. This became bug task **T8P.23-B13-B1**.
  - The reviewer also noted, not as an ocr finding, that an expiration with no completed session in the lifetime would drop later items: they go to `pending`, which `ended` nulls.
- **Quick run (`T8P.23-B13`):** unit 1657, integration 229, checks 14 of 14, browser-task passed (d8p 8); run complete. The runner reran `browser-task` alone after it had overlapped the checks stage once.

**T8P.23-B13-B1** (`0a146e03`). `settlementExpirationOf` now returns the latest expiration only when every Position still held is an option at or past its expiration. Held stock or a live contract means no cut, so the leg keeps its sessions and its pending session. Holding nothing also means no cut; a Closed Trade ends through `terminalTime`.
- **Test:** "should give no expiration while the Trade also holds stock or a live contract, and the latest expiration when every held leg is a due contract" (`replay-trade.test.ts`), a direct test of the helper. Red: `expected '2026-11-20' to be null`.
- **Expected values:** none changed.
- **Browser specs run:** 61 passed (`browser/T8P.23-B13-B1-specs.txt`).
- **Review:** ocr in place, 1 file, 0 comments (`ocr/T8P.23-B13-B1.json`). The reviewer found that the earlier finding no longer holds for a Covered Call, a calendar or diagonal with a live leg, or a live leg beside a due one.
- **Known edge case, recorded, not fixed:** the empty-session edge from B13's review. An expiration with no completed session in the lifetime leaves later Journal items off the drawer, though they stay stored. It needs a first fill after the expiration session's close. The user decided on 2026-11-14: "Leave the edge case recorded, no fix needed".
- **Quick run (`T8P.23-B13-B1`):** unit 1658, integration 229, checks 14 of 14, browser-task 8; run complete.

**Merge run 12, the full tier after critic-2's bug tasks** at `b6234b98`: unit 1658 (156 files), integration 229, checks 14 of 14, browser tier 1 126 and tier 2 82 passed, no failures; run complete. The runner's report was a placeholder, so the main session read the outputs and `run-complete.sh` itself. Critic-3 starts on this commit.

### Critic-3 (T8P.23) at `0d251d22`

FAIL on C8P.2. The report was refused as a file write, so it was extracted from the session transcript by script and copied unchanged to `critic-3.md`. Critic-2's defects didn't recur. C8P.1, C8P.3 and C8P.4 pass, and so does the narrow layout, apart from defect 2.
- **Defect 1 (high, C8P.2):** the Trade Summary that T8P.31 placed in Position, in its existing words, repeats two figures:
  - the average entry ("Long 100 shares @ $50.18"), beside Entry Quality's Average entry;
  - the held quantity, beside Position's row and the rail's "100 of 100 shares open".
- **Defect 2 (moderate):** at 375 and 320 px, Today's comparison table (550 px wide) opens on its labels and the earlier column. The current Marks and their changes sit past the scroll box's edge.

This is the third critic at this checkpoint, and it still leaves a FAIL with a high and a moderate defect. That is a stop in the handoff, so the user decides.

**User decision on critic-3 (2026-11-14), "Accept 1, fix 2, no 4th critic":** revision 99. Defect 1 joins C8P.2's exceptions. Defect 2 is bug task **B14**. The checkpoint closes after B14, and T8P.26's gate critic checks C8P.1 to C8P.6 afresh.

**T8P.23-B14** (`49cb92bf`). CSS only, in `today.css`, below 960 px and scoped to Today's comparison table. The label column is unpinned, the padding is tighter, and cells take `min-width: 0` and wrap with `overflow-wrap: anywhere`, so the table fits its box at 375 and 320 px.
- **Test:** "should show the current date column and the Change column inside the comparison scroll box at 375 and 320 px, with no sideways page scroll" (`e2e/d8p/today-narrow.spec.ts`). Red: `cells outside the scroll box at 375 px`, `"Tue Oct 13 510 > 338"`, `"Change 587 > 338"`.
- **Expected values:** none changed.
- **Browser specs run:** 77 passed. The auto-mode classifier refused the agent's `npm run build:releases` twice, so its d1, d2 and d4 specs ran against older release builds. The quick run rebuilds them and reruns those specs.
- **Review:** ocr in place, 1 file, 1 comment (`ocr/T8P.23-B14.json`). It is **Valid**: `overflow-wrap: anywhere` lets a figure split mid-token. The reviewer rendered the real styles and saw, at 320 px, "$412.3" over "5"; at 375 px, "-$104.25" split; and the provenance date broken at its hyphens. The spec's small figures stay whole and the spec checks only horizontal position. This became bug task **T8P.23-B14-B1**.
- **Quick run (`T8P.23-B14`), on fresh release builds:** unit 1658, integration 229, checks 14 of 14, browser-task 9; run complete. The rerun of the agent's specs passed 65 and failed 1: B14's own case, `cells outside the scroll box at 375 px`. That file then passed alone (`browser/T8P.23-B14-rerun-specs.txt`). The case is unstable, so its fix goes into B14-B1.

**T8P.23-B14-B1** (`c48ec4e3`). Text in Today's narrow comparison now wraps only at spaces:
- `overflow-wrap` is back to normal;
- each provenance word renders as a nowrap `.whole` span (`Words`), with its text unchanged;
- figures and Change cells are nowrap.

At 320 px the table is still about 5 px too wide, so the new `ScrollsToEnd` opens the scroll box at its right end, and the current date and Change show first. At 375 px the table fits, and the 1280 px layout is untouched.
- **Test:** the extended `e2e/d8p/today-narrow.spec.ts` checks the option case and a stock case ($418.60, $412.35). Red: `tokens broken across lines at 375 px`, `["Mark","Mark"]`. Green, then 3 of 3 repeats.
- **The B14 flake:** not reproduced. The spec now waits on `document.fonts.ready` and polls the geometry.
- **Browser specs run:** 61 passed twice, against `dist-faults`. Per the user's choice, the agent did not run `build:releases`; the quick run rebuilt `dist-releases` and reran the d4 specs.
- **Review:** ocr in place, 2 files, 0 comments (`ocr/T8P.23-B14-B1.json`). The reviewer's notes, read from the code and unmeasured, which are not bug tasks:
  - at 320 px, scrolled to the end by about 5 px, the label column's padding and about 2.6 px of its first glyph are clipped, and wider figures would clip more; the spec doesn't check the labels;
  - `ScrollsToEnd`'s ResizeObserver snaps the box back to the end on a reflow while the reader has scrolled left;
  - `ScrollsToEnd` also runs at 1280 px, where the table fits, so nothing moves.
- **Quick run (`T8P.23-B14-B1`):** the main session's run rebuilt all three dist folders, `build:releases` included, as the user chose. Unit 1658, integration 229, checks 14 of 14, browser-task 10, run complete. The rerun of the d8p, d2, d1, d7 and d4 specs on the fresh builds passed 67 (`browser/T8P.23-B14-B1-rerun-specs.txt`).

**T8P.23 done.** The checkpoint closes under revision 99 after three critics:
- critic-1: 8 defects, all fixed;
- critic-2: 7 defects, 4 fixed, 2 accepted and 1 accepted as a plan change;
- critic-3: 2 defects, 1 fixed and 1 accepted.

The bug tasks were B1 to B14, plus B3-B1, B13-B1 and B14-B1. T8P.26's gate critic checks C8P.1 to C8P.6 afresh.

## T8P.25 Browser integration suite

**T8P.25** (`a3b684c5`). Tests only: `e2e/d8p/support.ts`, `cockpit.spec.ts` (B8P.1), `history.spec.ts` (B8P.2, two cases), `states.spec.ts` (B8P.4, three cases) and `responsive-a11y.spec.ts` (B8P.5, two cases). `src/`, `specs/` and the plan are unchanged.
- **Fixtures:** O-C3 is built through the UI (`buildOc3`, in the order of `tests/integration/d8p/support.ts`) with section 5's Marks, clock Thu 2026-10-15 18:00 New York. B8P.4 reuses D7's Settlement Due fixture and expired put, D4's `FOUR_TRADES` (DEF sold for Closed by sale, ABC stock, XYZ two lots), and D2's `UnknownPlannedLeg` integrity fixture for the incoherent state.
- **First-run passes, all flagged:** all 8 cases passed on their first run against the app, since the behaviour was built. Each has a mutation check in `tdd-log/T8P.25.md` (an app change, `build:faults`, the case alone, then revert):
  - B8P.1: the "nearest" badge never rendered; `toBeVisible` failed.
  - B8P.2 case 1: Journal `PAGE_SIZE` 3 to 4; `toHaveText` received one more.
  - B8P.2 case 2 (Reflect now in Needs you selects Journal, A217, beyond section 7.2's list): `reflectNow` no longer selects Journal; `aria-selected` was "false".
  - B8P.4 case 1 (Settlement Due, then the expired put Closed): default drawer "Plan and Risk"; expected "Position".
  - B8P.4 case 2 (Closed by sale, stock, two lots): Open default "Position"; expected "Today".
  - B8P.4 case 3 (incoherent): the drawer list gains Payoff; received one more.
  - B8P.5 case 1 (every drawer at 1280, 375, 320 px, with axe): `.pnl-figure` at 1rem; 16 px against at least 18.
  - B8P.5 case 2 (keyboard, ending with Reflect now opening the Journal form): every tab `tabIndex=-1`; focus stayed on BODY.
- **The cockpit checks that replace the retired Summary-card checks** (`T8P.22-retired.md`), named in a comment in `responsive-a11y.spec.ts` and checked at 1280, 375 and 320 px; none needed a code change:
  - figures at 18 px, bold and tabular (`d2/ui-alignment.spec.ts` :1111): the P&L card's `.pnl-figure`, 24 px, weight 700, tabular numerals;
  - Stop and Target colours at 4.5:1 (:1135): the Conditions card's `.condition-role` and `.condition-figure` for the Stop and the Target, against the card background;
  - one right edge of summary values (:1361): the Conditions card's figures share one right edge, and each column of the Position and Plan and Risk label/value grids shares one, with no row wider than 480 px.
- **"Each drawer holds its content once":** on O-C3 the C8P.2 repeats reduce to "Incurred fees" and "Reward : risk"; `cockpit.spec.ts` allows exactly those and fails on any other repeated card heading or term.
- **Agent's notes, not tasks:** `plan/spec-reading/D08P.md` does not exist, so it read the plan sections directly. The Settlement Due state's tab reads "Price History 30" (the sessions without Marks), asserted only as `/^Price History( \d+)?$/`. O-C3 figures beyond section 5's table are W5 and W6 arithmetic from section 5's Marks and the Plan's 1R of $200.00, each derived in a comment.
- **Agent's browser runs:** by the main session's direction it never ran `build:releases` or the `test:e2e` scripts, which build releases; it ran their Playwright parts directly on `dist` and `dist-faults`: its four files 8 passed; d1, d2, d4 and support 126; d5 to d8p 92. Acceptance script exit 0, 6 commands, 0 failed.
- **Review:** ocr relocated (`ocr/T8P.25-a3b684c5-relocated.json`), 5 files, 1 comment, **Wrong**: it said the suites aren't discovered because they are plain `.ts` files outside `e2e`. That is the relocation; the real files are `e2e/d8p/*.spec.ts`, and `test:e2e:2` runs `e2e/d8p`. No bug task.
- **Full tier (`T8P.25`), on fresh builds including `build:releases` (the main session's, as the user chose):** unit 1658 (156 files), integration 229 (106 files), checks 14 of 14, browser-1 126 (5.1 min), browser-2 92 (5.8 min), no failures; run complete (`run-complete.sh` exit 0). Browser-2 rose from merge run 12's 82 by 10: B14's and B14-B1's two `today-narrow` cases and these 8.
- **Acceptance:** `.claude/scripts/acceptance-commands.sh plan/D08P-trade-detail-cockpit.md` exit 0, 6 commands checked, 0 failed (`suite-runs/T8P.25-acceptance.txt`). Every section 13 row now passes, including the two browser rows T8P.24 left waiting.

**T8P.25 done.** No app code changes after `a3b684c5`, so this full tier and acceptance run stand as T8P.26's full tier before its gate critic.

## T8P.26 The gate

**Full tier and acceptance:** T8P.25's full tier at `a3b684c5` (unit 1658, integration 229, checks 14 of 14, browser-1 126, browser-2 92; run complete) and its acceptance run (exit 0, 6 commands) stand as the gate's steps 1 and 2: only evidence and Progress text changed after it.

**Critic-4, the gate critic** (fresh `general-purpose`, effort medium, at `d76e506b`; `critic-4.md`). Brief: critic-3's, adapted to the gate's six flows, with revision 99's ninth exception. Its file write was refused, so the report was taken from its final message.
- **Result: PASS.** All six flows meet their pass conditions: C8P.1, C8P.3 and C8P.6 clean; C8P.2, C8P.4 and C8P.5 pass with defects. Offline reload and About (D1 to D08P capabilities) pass.
- **Defects** (each becomes a bug task under the critic rule):
  1. Moderate: at 1280 px the Payoff chart (640 px in a 592 px scroll box) hides W14's "Now" legend and the lines' right end. **T8P.26-B1.**
  2. Moderate: at 1280 px the Lot Matches table (622 to 651 px in a 550 px scroll box) hides its Realized column. **T8P.26-B2.**
  3. Moderate: a final-session Journal card with no Mark (a Trade closed by sale on its first session; an expired contract's final session) reads "First Mark" beside "DEF Mark —". **T8P.26-B3**, waiting on the user's reading of W10.
  4. Low: at 320 px, Today's comparison opened at its right end clips about 5 px of the row labels (B14-B1's reviewer note, now observed). **T8P.26-B4.**
- **Minor observations** (not tasks): Journal pages run 1.6 to 2 screens; "Due Due" on the owed card; tabs wrap to two rows at 1280; provenance wraps in the earlier comparison column; the account on the identity and Plan cards; a one-match Lot Matches Realized equal to the rail's realized P&L; Settlement Due's words in four places (A222); Record entry and Record exit on a Settlement Due Trade (unchanged from before D08P); lowercase headings in innerText (CSS); the sidebar background in full-page screenshots.

**Batching (implementation-level decision).** The gate's bug tasks B1 to B4 run one at a time in the main worktree, each with its own ocr review. One full tier after the last of them stands as their run and as the full tier before the next gate critic, instead of a quick run per task (decision 111's one run per batch).

**User decision on defect 3 (2026-11-14), "No change line":** "First Mark" names only a session that brought a Mark. A card whose session has no Mark shows its Trade P&L with no change line. No new words, and no revision: an implementation-level reading of W10, recorded here. Bug task **T8P.26-B3**.

**T8P.26-B1** (`c9948a31`). CSS only, in `payoff.css`: at 1200 px and wider, `.payoff-chart` drops its 640 px minimum, so the SVG fills its 592 px box at 1280 and the "Now" legend and both lines' right ends are in view; its text renders at about 12 px. Below 1200 px the chart keeps its minimum and scrolls inside its box.
- **Test:** "should show the whole Payoff chart, the Now legend and both lines, inside its box at 1280 px, and keep scrolling inside the box at 375 and 320 px" (`e2e/d8p/payoff-fit.spec.ts`). Red: `chart geometry at 1280 px`, `lineOutside: true, nowOutside: true`.
- **Expected values:** none changed.
- **Browser specs run:** all of `e2e/d8p` and four D7 Payoff and layout specs, 25 passed (on `dist` and `dist-faults`; the agent didn't run `build:releases`).
- **Review:** ocr in place on the CSS, 0 comments (`ocr/T8P.26-B1.json`); the spec relocated, 1 comment, **Wrong** (`ocr/T8P.26-B1-relocated.json`): "Playwright never discovers the suite" is the relocation. Reviewer's notes, not tasks: from 861 px (where the rail sits beside the drawers) to 1199 px the chart keeps its 640 px minimum and still scrolls inside its own box; the spec checks no width in that range; above about 1330 px the chart scales up past 13 px text, unchanged by this commit.
