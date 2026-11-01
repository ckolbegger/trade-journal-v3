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

### ocr review of `9cbbe55`

Session `627f05e6-a2f0-498c-a593-8a0af9de999c`, 1 file reviewed, no findings. Raw output: [ocr/setup-9cbbe55.json](ocr/setup-9cbbe55.json). The change is tooling only (no product code or test changed since the start-of-D5R2 run), so no cumulative run follows it; T5R2.1's is the first.

## T5R2.1 Domain: due classification

Behavioral; red and green rows in `tdd-log.md`. Commit `9ebeb83`: `src/domain/journal-debt/index.ts` (`DueRule`, `DueClassification`, `SessionCloses`, `classifyDue` with its `undefined` overload) and `classify-due.test.ts` (4 cases). No first-run passes. Implementation decision: `SessionCloses` and the anchor use the repository's `Instant` (an ISO-8601 UTC string from `src/domain/time`), which is what Journal and the coordinators already hold; the comparison is done with `temporal-polyfill`'s `Temporal.Instant.compare`, as A166 asks.

### ocr review of `9ebeb83`

Session `e9ee2433-1568-4db6-a85f-a52d09c6556b`, 1 file reviewed (the test file excluded), no findings. Raw output: [ocr/T5R2.1-9ebeb83.json](ocr/T5R2.1-9ebeb83.json).

### Cumulative suite at `9ebeb83` (T5R2.1 closed)

Date 2026-11-01 06:32 EST. The working tree's only uncommitted changes were evidence files.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 76 passed (76)`, `Tests 1015 passed (1015)`, exit 0 | `suite-runs/t5r2-1-classify-due-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/t5r2-1-classify-due-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.4m)`, exit 0 | `suite-runs/t5r2-1-classify-due-browser.txt` |
| Static and verification checks (12 commands) | typecheck, `tsc6 --noEmit`, lint, `lint:deps`, build, `verify:release`, `verify:capabilities`, `verify:releases`, `verify:no-fault-hooks`, `verify:capacity`, `verify:fixtures`, `verify:session-policy` | 12 of 12 exit 0 | `suite-runs/t5r2-1-classify-due-checks.txt` |

Ports 9341, 9342 and 5175 free before and after.

## T5R2.2 Journal imports the due rule

Type-only change (A166, P44). `dueRule: 'OneSessionGrace'` became `dueRule: DueRule` (type imported from `src/domain/journal-debt/index.ts`) at three declarations: `src/modules/journal/journal.ts` (the Debt shape) and `src/modules/journal/effects.ts` (two effect shapes). The stored value `dueRule: 'OneSessionGrace'` written into a new Debt in `journal.ts` is unchanged. `.dependency-cruiser.js` allows modules to import `src/domain` (`lint:deps` passes).

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint:deps` | exit 0, no dependency violations (243 modules) |
| `npm run verify:fixtures` | exit 0, workspace-v1 to v4 open Ready at schema 4, views equal |
| `npm run test:unit -- src/modules/journal` | exit 0, 7 files, 69 tests passed |
| `npx tsc6 --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `rg "'OneSessionGrace'" src --glob '!*.test.*'` | only `src/domain/journal-debt/index.ts` (`export type DueRule`) and `src/modules/journal/journal.ts` (value in a new Debt); no type declaration remains |
| `git diff claude-opus-5.5-d5r -- tests/fixtures` | empty (0 lines) |

The breakdown's A166 counts "four places"; at `claude-opus-5.5-d5r` there are three type declarations (`journal.ts:162`, `effects.ts:155`, `effects.ts:249`) plus the stored value at `journal.ts:409`, which stays a literal. Checked by the main session with `git grep -n OneSessionGrace claude-opus-5.5-d5r -- src ':!*.test.*'`.

### ocr review of `451b093`

Session `7b9a23a1-e187-496f-920a-e0da745a331a`, 2 files reviewed, no findings. Raw output: [ocr/T5R2.2-451b093.json](ocr/T5R2.2-451b093.json).

### Cumulative suite at `451b093` (T5R2.2 closed)

Date 2026-11-01 06:43 EST. The working tree's only uncommitted changes were evidence files.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 76 passed (76)`, `Tests 1015 passed (1015)`, exit 0 | `suite-runs/t5r2-2-journal-due-rule-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 60 passed (60)`, `Tests 117 passed (117)`, exit 0 | `suite-runs/t5r2-2-journal-due-rule-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `179 passed (7.1m)`, exit 0 | `suite-runs/t5r2-2-journal-due-rule-browser.txt` |
| Static and verification checks (12 commands) | as at T5R2.1 | 12 of 12 exit 0 | `suite-runs/t5r2-2-journal-due-rule-checks.txt` |

Ports 9341, 9342 and 5175 free before and after.
