# D5R2 structural verifications

Each entry records a structural task's exact verification (D5R2 breakdown, section 5), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`. The record of carried-over expected values (breakdown, sections 6.1 and 6.1a) is kept under the task that moves each case.

## Start of D5R2

Location checks (D5R2 handoff, section 1) on 2026-11-01:
- worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`: matched.
- `git status -sb`: `## claude-opus-5.5...origin/claude-opus-5.5`, clean except the untracked `.claude/settings.json`. The handoff expected `[ahead 175]`; the branch reads `ahead 0` because the remote was pushed to exactly the starting point (the remote-tracking reflog's latest entry is "update by push" to `75f7f18`). `HEAD`, `claude-opus-5.5-pre-d5r2` and `origin/claude-opus-5.5` are all `75f7f18cc8f9bb3862bdfd1f124ceb2316d60aa8`, so the check's purpose (no unexpected commits, no uncommitted changes) holds. Recorded as an open question for the final report.
- `git log --oneline claude-opus-5.5-pre-d5r2..HEAD`: empty.
- tags `claude-opus-5.5-plan-r28`, `claude-opus-5.5-d5r`, `claude-opus-5.5-pre-d5r2`: present. `claude-opus-5.5-d5r` is `72c742c1b6f393d432e533a7d65b84c45df933ff`.
- `DEV_PORT=5175`; Node v26.12.0.
- `npm ci`: exit 0. `npx vitest run src`: `Test Files 75 passed (75)`, `Tests 1011 passed (1011)`. `npx vitest run tests/integration`: `Test Files 60 passed (60)`, `Tests 117 passed (117)`.

Spec reading: `plan/spec-reading/D05.md` (with the glossary entry "Due Classification"), as the handoff directs. No other spec section has been needed yet.

## Setup: tdd.sh accepts any deliverable suffix

Change in `.claude/scripts/tdd.sh`: the task-ID pattern is now `^T([0-9]+)([A-Z][A-Z0-9]*)?\.` (a number, then an optional suffix of an upper-case letter followed by upper-case letters or digits). The log path is still `evidence/D%02d%s/tdd-log.md` from `$match[1]` and `$match[2]`; the latter is empty when the optional group does not match, so the `printf` is unchanged and `T<n>.<m>` IDs map as before. So `T5R2.1` logs to `evidence/D05R2/tdd-log.md`, `T6R.1` to `evidence/D06R/tdd-log.md`, `T5R.1` to `evidence/D05R/tdd-log.md`. The usage comment and the rejection message describe `T<n>.<m>` or `T<n><suffix>.<m>`. Each command was run on its own from the repository root, while `evidence/D05R2/tdd-log.md` did not exist, so nothing was appended anywhere.

1. `.claude/scripts/tdd.sh red T5R2.1 x y`
   - Output: `no log at evidence/D05R2/tdd-log.md: create it with its header note first`
   - Exit code: 2
2. `.claude/scripts/tdd.sh red T6R.1 x y`
   - Output: `no log at evidence/D06R/tdd-log.md: create it with its header note first`
   - Exit code: 2
3. `.claude/scripts/tdd.sh red T99.1 x y`
   - Output: `no log at evidence/D99/tdd-log.md: create it with its header note first`
   - Exit code: 2
4. `.claude/scripts/tdd.sh red X5.1 x y` (malformed ID, still rejected)
   - Output: `task must look like T<n>.<m> or T<n><suffix>.<m> (suffix: an upper-case letter, then upper-case letters or digits), got: X5.1`
   - Exit code: 2

The IDs `T1.`, `T2.`, `T4.`, `T5.` and `T5R.` were not run, because those deliverables' logs exist and a run would append to them. Their mappings (`T2.2` to `D02`, `T12.4` to `D12`, `T5.1` to `D05`, `T5R.1` to `D05R`) are checked by reading the diff: the `printf` format and arguments are untouched, and an unmatched optional group leaves `$match[2]` empty.
