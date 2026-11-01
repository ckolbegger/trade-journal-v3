# D6 prefactor structural verifications

Each entry records a structural task's exact verification (D6 prefactor breakdown, section 3), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`.

## Start of the D6 prefactor

Location checks (prefactor handoff, section 1) on 2026-11-01:
- worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`: matched.
- `git status -sb`: `## claude-opus-5.5...origin/claude-opus-5.5 [ahead 3]`, clean except the untracked `.claude/settings.json`.
- `git log --oneline claude-opus-5.5-pre-d6p..HEAD`: empty. `HEAD` is `6c8728b`.
- tags `claude-opus-5.5-plan-r30`, `claude-opus-5.5-d5r2`, `claude-opus-5.5-pre-d6p`: present. `claude-opus-5.5-d5r2` is `765ac1ea59f36e7d9923362f655c94bbef90e404`.
- `git diff claude-opus-5.5-d5r2 -- src`: empty.
- `DEV_PORT=5175`; Node v26.12.0.
- `npm ci`: exit 0. `npx vitest run src`: `Test Files 80 passed (80)`, `Tests 1051 passed (1051)`. `npx vitest run tests/integration`: `Test Files 60 passed (60)`, `Tests 117 passed (117)`.

Spec reading (decision 71, scoped): `specs/evaluation/planning-protocol.md`, "Required task and deliverable evidence" and "Independent browser-critic gate" (spec map S231, S232); `specs/acceptance/acceptance-contract.md`, AC-DEL-003 and AC-DEL-004, looked up through `plan/acceptance-matrix.md`. No other spec section has been needed.

## T6P.1 Tags and the routine and release-history scripts

Run on 2026-11-01. A177 first: `identity.spec.ts`'s describe was tagged `{ tag: '@every-task' }` alone, and `--list --grep @every-task` listed exactly its 2 tests while `--grep-invert @every-task` listed 177 of 179. Playwright 1.63 accepts `test.describe(title, { tag }, body)` on the project's extended `test`, and `--grep` / `--grep-invert` match tags. All 7 describes are tagged by the `{ tag }` option only (`@every-task`: B1.1, B1.3, B1.4, B1.6; `@release-history`: B2.3, B2.5, B4.7); no title or line number changed. `package.json`: `test:e2e` gains `--grep-invert @release-history`; new `test:e2e:release-history` runs the same two builds, then `playwright test e2e/d1 e2e/d2 e2e/d4 e2e/d5 e2e/d5r --grep @release-history`.

The six verifications (folders `e2e/d1 e2e/d2 e2e/d4 e2e/d5 e2e/d5r`):

| Command | Exit | Result |
|---|---|---|
| `npx playwright test <folders> --list --grep @every-task` | 0 | `Total: 5 tests in 4 files` (B1.1 both cases, B1.3, B1.4, B1.6) |
| `npx playwright test <folders> --list --grep @release-history` | 0 | `Total: 3 tests in 2 files` (B2.3, B2.5, B4.7) |
| `npx playwright test <folders> --list --grep-invert @release-history` | 0 | `Total: 176 tests in 48 files` |
| `npm run test:e2e` | 0 | `176 passed (7.3m)`; 7:22 wall time including builds; ports 5175, 9341, 9342 free before and after |
| `npm run test:e2e:release-history` | 0 | `3 passed (14.1s)`; 15.3 s wall time (builds cached); ports free before and after |
| Title diff: `--list` with no grep before any change, against the same after tagging | 0 (`diff` empty) | 179 tests both times, identical output including file:line. The 176 grep-invert titles plus the 3 `@release-history` titles equal the 179 baseline titles (sorted `diff` empty). |

The baseline `--list` was captured to a scratch directory outside the repo before any change.

Note on process: the subagent ran `npm run test:e2e` as one foreground call, and the harness moved it to the background after 180 s. The subagent waited for the completion notice and did not poll.

### ocr review of `c7ba533`

Session `fd07a460-92aa-4e58-98e6-f6391b7a499e`, model gpt-6.1-sol, 1 file reviewed (`package.json`), 7 excluded (the six tagged spec files and this evidence file), no findings. Raw output: [ocr/T6P.1-c7ba533.json](ocr/T6P.1-c7ba533.json). The commit changes `package.json`, so it was reviewed in place, as the handoff's section 3 directs. The excluded spec changes add a `{ tag }` option to seven describes and nothing else, and T6P.1's title diff and counts verify them.

### Cumulative run after T6P.1

Delegated to `suite-runner`, 2026-11-01 15:03 EST, commit `c7ba533` (the uncommitted changes were this file and the handoff only). Full tier, the `browser` stage (T6P.2's tiered stages did not exist yet).

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files  80 passed (80)`, `Tests  1051 passed (1051)`, exit 0 | [suite-runs/t6p-1-tags-unit.txt](suite-runs/t6p-1-tags-unit.txt) |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files  60 passed (60)`, `Tests  117 passed (117)`, exit 0 | [suite-runs/t6p-1-tags-integration.txt](suite-runs/t6p-1-tags-integration.txt) |
| Browser (Chromium) | `npm run test:e2e` | `176 passed (7.4m)`, exit 0 | [suite-runs/t6p-1-tags-browser.txt](suite-runs/t6p-1-tags-browser.txt) |
| Static and verification checks (12 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures`, `npm run verify:session-policy` | 12 of 12 exit 0 | [suite-runs/t6p-1-tags-checks.txt](suite-runs/t6p-1-tags-checks.txt) |

Ports 9341, 9342 and 5175 were free before the first stage and after the last. Browser stage wall time about 7 min 22 s (15:04:02 to 15:11:24). The harness moved the call to the background after 180 s, and the runner waited for the completion notice without polling.

## T6P.2 Two tiers in `full-suite.sh`

Run on 2026-11-01 against `.claude/scripts/full-suite.sh` (HEAD `0dde16c`, script uncommitted at run time). New: stages `browser-task` and `browser-auto <base>`, queries `--current-folder <evidence-dir>` and `--choose-tier <base>`, and `TJ_E2E_CURRENT`. The e2e folders of the task tier are read from the `test:e2e` script in `package.json`, so the two lists cannot drift apart. P55's path list is used exactly (`src/ui/`, `src/app/`, `src/sw/`, `src/delivery/`, `src/persistence/`, `src/main.tsx`, any `.css`, `index.html`, `e2e/`, `playwright.config.ts`, `vite.config.ts`, `package.json`, `package-lock.json`, `tools/release*.ts`, `tools/build-releases.ts`). The two `playwright` calls of `browser-task` write to one `<label>-browser.txt`, each followed by its own `EXIT` line, and the script prints the summed counts. `browser` is unchanged and a run with no stage still runs the full tier.

| Command | Exit | Result |
|---|---|---|
| `.claude/scripts/full-suite.sh --current-folder evidence/D06` | 0 | `e2e/d6` |
| `… --current-folder evidence/D05R` | 0 | `e2e/d5r` |
| `… --current-folder evidence/D05R2` | 0 | `e2e/d5r2` |
| `… --current-folder evidence/D06P` | 0 | `e2e/d6p` |
| `… --current-folder evidence/D06/suite-runs` and `evidence/D06P/` | 0 | `e2e/d6` and `e2e/d6p` (a trailing `/suite-runs` or `/` is ignored) |
| `… --current-folder foo` | 2 | `cannot derive an e2e folder from: foo` |
| `… --choose-tier c7ba533` (diff to HEAD `0dde16c` holds only `plan/` and `evidence/` paths) | 0 | `task` |
| `… --choose-tier 9b93ca7` (T6P.1's parent) | 0 | `full: e2e/d1/identity.spec.ts` |
| `… --choose-tier nosuch` | 2 | `unknown base commit: nosuch` |
| `.claude/scripts/full-suite.sh evidence/D06P t6p-2-check browser-task` | 0 | the `@every-task` call only (`e2e/d6p` does not exist): `5 passed (10.3s)`; summary `5 passed`; 13.5 s wall time; [suite-runs/t6p-2-check-browser.txt](suite-runs/t6p-2-check-browser.txt) |
| `TJ_E2E_CURRENT=e2e/d5r .claude/scripts/full-suite.sh evidence/D06P t6p-2-check-d5r browser-task` | 0 | call 1 `5 passed`, call 2 (`npx playwright test e2e/d5r --grep-invert "@every-task\|@release-history"`) `15 passed (1.2m)`, both `EXIT 0`; summary `20 passed`; 1 min 25.6 s wall time; [suite-runs/t6p-2-check-d5r-browser.txt](suite-runs/t6p-2-check-d5r-browser.txt) |

Ports 5175, 9341 and 9342 were free before and after each run. `git status --short evidence` shows only the two new output files; no other evidence folder changed.

Extra wiring checks (not part of the plan's list): `… <scratch>/D99 auto-check browser-auto c7ba533` printed `browser tier: task (no changed path since c7ba533 is on the full-tier list)`, ran `browser-task` (no `e2e/d99`, so one call) and reported `5 passed`, exit 0; its output went to the scratchpad, not to evidence. `browser-auto` with no base, and a fourth argument on another stage, print the usage and exit 2. The full-tier branch of `browser-auto` (it sets the stage to `browser`) was not run, since that is a 7-minute full run; `--choose-tier 9b93ca7` shows the choice it would act on.

### ocr review of `50a24f7`

Session `45944089-b9af-4c61-aa71-81175efd1458`, model gpt-6.1-sol, 1 file reviewed (`.claude/scripts/full-suite.sh`, in place), 3 comments. Raw output: [ocr/T6P.2-50a24f7.json](ocr/T6P.2-50a24f7.json).

| Severity | Location | Claim | Assessment | Bug task |
|---|---|---|---|---|
| medium | `full-suite.sh:47-48` | `git diff --name-only` quotes non-ASCII paths, so a change only to e.g. `src/ui/é.tsx` matches no pattern and picks the task tier. | Valid (reproduced in a scratch repo by the reviewer) | T6P.2-B1 |
| medium | `full-suite.sh:47` | With default rename detection, `--name-only` lists only the destination, so a move out of `src/ui/` into an unlisted directory picks the task tier. | Valid (reproduced) | T6P.2-B2 |
| medium | `full-suite.sh:102` | `$current` is expanded unquoted inside the second Playwright command, so a `TJ_E2E_CURRENT` path with spaces or shell metacharacters is split or interpreted. | Doubtful: derived names are alphanumeric, only a hand-set override can trigger it; it has a failure scenario, so it becomes a bug task | T6P.2-B3 |

#### Bug tasks

- **T6P.2-B1 Non-ASCII paths in the tier rule.** Defect: a change under a full-tier path whose name has a non-ASCII character is printed quoted and escaped by git, matches no pattern, and gets the task tier. Check: `--choose-tier` prints `full: <path>` for a base whose diff to HEAD changes only such a file under `src/ui/` (reproduced red first in a scratch repository), and the earlier T6P.2 checks still hold.
- **T6P.2-B2 Renames out of a full-tier path.** Defect: a file moved from a full-tier path to an unlisted one lists only its destination, so the move gets the task tier. P55 says the full tier applies when the commits "touch" a listed path, and the source of a move is touched. Check: `--choose-tier` prints `full: <source path>` for a base whose diff to HEAD only moves `src/ui/x.tsx` to an unlisted directory (red first in a scratch repository), and the earlier checks still hold.
- **T6P.2-B3 The current folder is passed as one argument.** Defect: a `TJ_E2E_CURRENT` holding a space or a shell metacharacter is split or interpreted in `browser-task`'s second call. Check: with `TJ_E2E_CURRENT` set to an existing folder whose name has a space, the second call receives it as one argument (red first, shown without running a browser suite where possible), and the T6P.2 `browser-task` checks still hold.

## T6P.2-B1 Non-ASCII paths in the tier rule

Run on 2026-11-01. Scratch repository from `mktemp -d` (`/var/folders/ks/n63g0mm937v5rdb147g4txg40000gn/T/tmp.z1l9kJOKiA`), outside every worktree: a base commit `d3876eeed7de1bdda4ef1e246ebcbb2f3814450e` with an empty `README`, then a commit that adds only the empty file `src/ui/é.tsx`. The worktree's script was invoked by absolute path from inside the scratch repository (it does `cd "$(git rev-parse --show-toplevel)"`, so it runs against the scratch repository as is).

| Step | Command | Output | Exit |
|---|---|---|---|
| Red: raw git output | `git diff --name-only d3876ee… HEAD` (in scratch) | `"src/ui/\303\251.tsx"` (quoted and escaped, so no `src/ui/*` pattern matches it) | 0 |
| Red: tier choice | `<worktree>/.claude/scripts/full-suite.sh --choose-tier d3876ee…` (in scratch) | `task` | 0 |
| Fix | `choose_tier`: `git diff --name-only "$1" HEAD` became `git -c core.quotePath=false diff --name-only "$1" HEAD` (one line; path list and patterns untouched) | | |
| Green: tier choice | same command as the red tier choice | `full: src/ui/é.tsx` | 0 |
| T6P.2 check | `.claude/scripts/full-suite.sh --choose-tier 9b93ca7` (in the worktree) | `full: e2e/d1/identity.spec.ts` | 0 |
| T6P.2 check | `.claude/scripts/full-suite.sh --current-folder evidence/D06P` (in the worktree) | `e2e/d6p` | 0 |

No browser run was needed. The scratch repository's red run used the committed script (fix not yet applied); the green run used the edited script.

## T6P.2-B2 Renames out of a full-tier path

Run on 2026-11-01. Scratch repository from `mktemp -d` (`/var/folders/ks/n63g0mm937v5rdb147g4txg40000gn/T/tmp.tlVXalPdE5`), outside every worktree: a base commit `cf91bc17f7f524c8cce17f2b87b5ee0686f27da8` holding `src/ui/x.tsx` (a copy of `full-suite.sh`, so it is non-empty and rename detection is unambiguous), then a commit that only does `git mv src/ui/x.tsx src/lib/x.tsx`. The worktree's script was invoked by absolute path from inside the scratch repository.

| Step | Command | Output | Exit |
|---|---|---|---|
| Red: raw git output | `git diff --name-only cf91bc1… HEAD` (in scratch) | `src/lib/x.tsx` (destination only; the source `src/ui/x.tsx` is not listed) | 0 |
| Red: tier choice | `<worktree>/.claude/scripts/full-suite.sh --choose-tier cf91bc1…` (in scratch) | `task` | 0 |
| Fix | `choose_tier`: `git -c core.quotePath=false diff --name-only "$1" HEAD` became `git -c core.quotePath=false diff --no-renames --name-only "$1" HEAD` (path list and patterns untouched) | | |
| Green: tier choice | same command as the red tier choice | `full: src/ui/x.tsx` | 0 |
| B1 check (recreated scratch: empty `README` base, then adds empty `src/ui/é.tsx`) | `<worktree>/.claude/scripts/full-suite.sh --choose-tier <base>` (in scratch) | `full: src/ui/é.tsx` | 0 |
| T6P.2 check | `.claude/scripts/full-suite.sh --choose-tier 9b93ca7` (in the worktree) | `full: e2e/d1/identity.spec.ts` | 0 |
| T6P.2 check | `.claude/scripts/full-suite.sh --choose-tier c7ba533` (in the worktree) | `task` (its diff to HEAD holds the T6P.2 script, `evidence/` and `plan/`, none on the full-tier list) | 0 |

No browser run was needed. The scratch repository's red run used the committed script (fix not yet applied); the green run used the edited script.

### ocr review of `73387a7` (T6P.2-B1)

Session `ec3f2cf0-af59-4e24-b230-aa80de3905f2`, model gpt-6.1-sol, 1 file reviewed (1 excluded, the evidence file), no findings. Raw output: [ocr/T6P.2-B1-73387a7.json](ocr/T6P.2-B1-73387a7.json).

## T6P.2-B3 The current folder is passed as one argument

Run on 2026-11-01. All red and green runs wrote to throwaway evidence directories in the scratchpad (`<scratch>/b3/D99`, `D98`), so nothing under `evidence/` changed until the final 20-test check. `<scratch>` is `/private/tmp/claude-501/-Users-ckolbegger-src-trade-journal-v3-worktrees-claude-opus-5-5/2e8bb8af-ceb0-4309-9fd5-ff3dbb5a527a/scratchpad`. Existing folders `<scratch>/b3/my folder` and `<scratch>/b3/semi;touch pwned` were made with `mkdir -p`.

| Step | Command | Output | Exit |
|---|---|---|---|
| Red, real Playwright | `TJ_E2E_CURRENT="<scratch>/b3/my folder" .claude/scripts/full-suite.sh <scratch>/b3/D99 red browser-task` | first call `5 passed`; the written command line is `$ npx playwright test <scratch>/b3/my folder --grep-invert "@every-task\|@release-history"` and the second call prints `Error: No tests found.` (Playwright treats `<scratch>/b3/my` and `folder` as two filters) | script 1 |
| Red, argument list | same script with stub `npm` (exits 0) and stub `npx` (prints `argc` and each argument as `[arg]`) first on `PATH`, `TJ_E2E_CURRENT="<scratch>/b3/my folder"`, evidence dir `<scratch>/b3/D98` | second call `npx argc=6`: `[playwright] [test] [<scratch>/b3/my] [folder] [--grep-invert] [@every-task\|@release-history]`, so the folder is two arguments | 0 |
| Red, metacharacter | same stubs, `TJ_E2E_CURRENT="<scratch>/b3/semi;touch pwned"` | second call `npx argc=3`: `[playwright] [test] [<scratch>/b3/semi]`; the `;` started a second command, which ran a real `touch pwned --grep-invert ...` in the repo root and created stray files `pwned`, `--grep-invert` and `@every-task\|@release-history` (removed again; `git status --short` clean of them) | 0 |
| Fix | `browser_task`: `cmd2="npx playwright test $current --grep-invert ..."` became `cmd2="npx playwright test $(printf '%q' "$current") --grep-invert ..."`. `%q` leaves a plain path such as `e2e/d5r` unchanged and escapes only spaces and metacharacters, so the `$ <command>` line stays readable and the string `bash -c` runs now reads as one word. Nothing else changed. | | |
| Green, space | same stubs, `TJ_E2E_CURRENT="<scratch>/b3/my folder"` | written line `$ npx playwright test <scratch>/b3/my\ folder --grep-invert "@every-task\|@release-history"`; `npx argc=5`: `[playwright] [test] [<scratch>/b3/my folder] [--grep-invert] [@every-task\|@release-history]` | 0 |
| Green, metacharacter | same stubs, `TJ_E2E_CURRENT="<scratch>/b3/semi;touch pwned"` | written line `... semi\;touch\ pwned ...`; `npx argc=5` with the single argument `[<scratch>/b3/semi;touch pwned]`; no `pwned` file in the repo root, `git status --short` shows no stray files | 0 |
| T6P.2 check | `TJ_E2E_CURRENT=e2e/d5r .claude/scripts/full-suite.sh evidence/D06P t6p-2-b3-check-d5r browser-task` | call 1 `5 passed (10.3s)`; call 2 `$ npx playwright test e2e/d5r --grep-invert "@every-task\|@release-history"` (unchanged text) `15 passed (1.2m)`; both `EXIT 0`; summary `20 passed`; 1 min 25 s wall time; [suite-runs/t6p-2-b3-check-d5r-browser.txt](suite-runs/t6p-2-b3-check-d5r-browser.txt) | 0 |

Ports 5175, 9341 and 9342 were free before and after the 20-test run. Only the real-Playwright red also ran a browser (the first call's 5 `@every-task` tests); the stub runs ran none.

### ocr review of `8834b52` (T6P.2-B2)

Session `5f7e72c0-4622-4158-a548-407c66fa3aea`, model gpt-6.1-sol, 1 file reviewed (1 excluded, the evidence file), no findings. Raw output: [ocr/T6P.2-B2-8834b52.json](ocr/T6P.2-B2-8834b52.json).

### ocr review of `18b3f01` (T6P.2-B3)

Session `288d5299-807e-4fa4-865b-dc626f179405`, model gpt-6.1-sol, 1 file reviewed (1 excluded, the evidence file), no findings. Raw output: [ocr/T6P.2-B3-18b3f01.json](ocr/T6P.2-B3-18b3f01.json). T6P.2 and its three bug tasks now all have ocr reviews with no findings.

Note: B3's red run with a metacharacter in `TJ_E2E_CURRENT` executed a `touch` in the repository root and created three stray untracked files, which the subagent removed; the main session confirmed none remain.

### Cumulative run after T6P.2

Delegated to `suite-runner`, 2026-11-01 15:26 EST, commit `d44bc1b` (T6P.2 and its bug tasks B1–B3). Base commit (A180): `0dde16c`.

**Tier decision (main session).** `full-suite.sh --choose-tier 0dde16c` printed `task`: T6P.2 changed only `.claude/scripts/full-suite.sh` and evidence, and P55's full-tier path list doesn't include `.claude/scripts/`. The prefactor's handoff (working rules, "Cumulative runs") requires every prefactor run to be the full tier, so the runner used the `browser` stage. P55's list was left as planned. The same applies to T6P.5, which changes only process documents.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files  80 passed (80)`, `Tests  1051 passed (1051)`, exit 0 | [suite-runs/t6p-2-tiers-unit.txt](suite-runs/t6p-2-tiers-unit.txt) |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files  60 passed (60)`, `Tests  117 passed (117)`, exit 0 | [suite-runs/t6p-2-tiers-integration.txt](suite-runs/t6p-2-tiers-integration.txt) |
| Browser (Chromium), full tier (`browser` stage) | `npm run test:e2e` | `176 passed (7.4m)`, exit 0 | [suite-runs/t6p-2-tiers-browser.txt](suite-runs/t6p-2-tiers-browser.txt) |
| Static and verification checks (12 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures`, `npm run verify:session-policy` | 12 of 12 exit 0 | [suite-runs/t6p-2-tiers-checks.txt](suite-runs/t6p-2-tiers-checks.txt) |

Ports 9341, 9342 and 5175 were free before and after. Browser stage wall time 7:23 (moved to the background by the harness after 180 s; the runner waited for the completion notice).

## T6P.3 B1.5 trim and T2.55-B3 removal

**Edits.**

- B1.5 (`e2e/d1/readiness.spec.ts`): added `const B1_5_FAULT_SETS: typeof FAULT_SETS = [['diagnostic'], ['control', 'inventory']];` and the loop now iterates it. The case body is unchanged. `FAULT_SETS` in `e2e/d1/support.ts` is untouched because `e2e/d1/recovery-only.spec.ts` still loops all six. Fault sets removed from B1.5: `capacity`, `control`, `inventory`, and `diagnostic + capacity` (4 tests). Kept: `diagnostic` and `control + inventory`.
- T2.55-B3 (`e2e/d2/ui-alignment.spec.ts`): removed the `describe` "T2.55-B3 Last activity on the Open Detail" (its one test, 17 lines including the trailing blank line): `should show Last activity in the Position card as the latest Position Change time`. Nothing else was removed. No helper or import was used only by it: `confirmReference`, `recordEntry`, `backToTrade`, `PC1`, `PC2`, `onboardedPage` and `READY` are each used elsewhere in the file (T2.55-B4 and others).
- `src/` unchanged: `git diff claude-opus-5.5-d5r2 --stat -- src` prints nothing.

**Verification.**

| Command | Result | Exit |
|---|---|---|
| `npx playwright test e2e/d1/readiness.spec.ts --list` | `Total: 3 tests in 1 file` (two B1.5 cases, naming `diagnostic` and `control and inventory`, plus B1.7) | 0 |
| `npx vitest run src/ui/screens/TradeDetail.test.tsx -t "Last activity"` | `Tests  1 passed \| 66 skipped (67)` (the case "should show Last activity in the Position card as a labelled local time") | 0 |
| `npm run test:e2e` (15:36:33 to 15:43:48, 7 min 14 s, moved to the background by the harness after 180 s; waited for the completion notice) | `171 passed (7.2m)` = 176 − 4 − 1 | 0 |
| `npx playwright test e2e/d2/ui-alignment.spec.ts --list` | `Total: 69 tests in 1 file` (was 70) | 0 |
| `grep -c 'expect(' e2e/d2/ui-alignment.spec.ts` | `257` (was 259; the removed test had two `expect(` lines). T6P.4 compares against 257. | 0 |
| `npm run typecheck` | exit 0 | 0 |
| `npx tsc6 --noEmit` | exit 0 | 0 |
| `npm run lint` | exit 0 | 0 |
| `npm run lint:deps` | exit 0 | 0 |

Ports 5175, 9341 and 9342 were free before and after the browser run.

### ocr review of `7670ff7`

Test-only commit, reviewed by the relocation procedure (prefactor handoff, section 3): a scratch clone outside the worktree, with the two changed specs and their `support.ts` files relocated under `src/itg/d06p/` as plain `.ts` in the parent state, then the commit's changes applied (scratch commit `666770ca`). Session `e757d66f-5c07-48ad-b176-4c01616bf594`, model gpt-6.1-sol (ocr v1.13.3), 2 files reviewed (the relocated spec copies), no findings. Raw output: [ocr/T6P.3-7670ff7.json](ocr/T6P.3-7670ff7.json). The reviewer also confirmed by reading that B1.5's new sets are valid `Check` sets, that no import or helper became unused, and that `src/ui/screens/TradeDetail.test.tsx:123` asserts the same "Last activity" value (`2026-10-12 11:00` for `[PC1, PC2]`).

Process note: the reviewer briefly ran `git checkout 7670ff7c` in the worktree (detached HEAD) and switched straight back to `claude-opus-5.5`. The main session confirmed from the reflog that the branch, HEAD and the working tree are unchanged.

### Cumulative run after T6P.3

Delegated to `suite-runner`, 2026-11-01 15:54 EST, commit `f8d48b1` (uncommitted: the run's own output files). Base commit (A180): `a9ef841`.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files  80 passed (80)`, `Tests  1051 passed (1051)`, exit 0 | [suite-runs/t6p-3-trims-unit.txt](suite-runs/t6p-3-trims-unit.txt) |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files  60 passed (60)`, `Tests  117 passed (117)`, exit 0 | [suite-runs/t6p-3-trims-integration.txt](suite-runs/t6p-3-trims-integration.txt) |
| Browser (Chromium), `browser-auto a9ef841` | chose the full tier, `npm run test:e2e` | `171 passed (7.2m)`, exit 0 | [suite-runs/t6p-3-trims-browser.txt](suite-runs/t6p-3-trims-browser.txt) |
| Static and verification checks (12 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures`, `npm run verify:session-policy` | 12 of 12 exit 0 | [suite-runs/t6p-3-trims-checks.txt](suite-runs/t6p-3-trims-checks.txt) |

Tier line: `browser tier: full (first matching path since a9ef841: e2e/d1/readiness.spec.ts)`. This is the first real run of `browser-auto`'s full-tier branch. Ports 9341, 9342 and 5175 were free before and after. Browser stage 7.2 min (moved to the background by the harness after 180 s; the runner waited for the completion notice).

## T6P.4 Collapse the `ui-alignment.spec.ts` copies

Only `e2e/d2/ui-alignment.spec.ts` changed. `git diff claude-opus-5.5-d5r2 -- src` is empty (0 lines), before and after the mutation checks.

**Counts and times.**

| Measure | Before (T6P.3 commit `4c1884b`) | After |
|---|---|---|
| `npx playwright test e2e/d2/ui-alignment.spec.ts --list` | 69 | 45 |
| `grep -c 'expect(' e2e/d2/ui-alignment.spec.ts` | 257 | 257 |
| File duration, run 1 | 2.1 min (Playwright's own figure; `dist-faults` rebuilt first) | 1.6 min (wall clock 96.2 s) |
| File duration, run 2 | | 1.6 min (wall clock 95.7 s) |
| File duration, run 3 | | 1.6 min (wall clock 97.9 s) |
| `npm run test:e2e` | 171 | 147 passed (6.8 min, exit 0) |

The `expect(` count did not drop because the removed assertion is not its own line: the Underlying header height assertion in T2.62's first body is now `if (width === 1280) expect(header.height, ...)`, one line. The three runs were `npx playwright test e2e/d2/ui-alignment.spec.ts --repeat-each=1`, each `45 passed`. The "before" time is Playwright's one-decimal minute figure from the single run before any change (69 passed); the seconds were not captured, so the saving is about 30 s (the plan estimated 36 s).

**One helper added.** `showOpenTrades(page)` (click the Primary navigation's Trades link, wait for the Open Trades table); `seedTrades` now ends by calling it (same two steps as before). The shared-setup bodies on seeded Trades call it at the start of each width, because the previous width ends on the Planned tab and the body's first step needs the Open tab. Import added: `profileAt` (from `./support.ts`, which re-exports D1's).

**Per-width (or per-stage) fresh profiles** use `profileAt(`${profile.dir}-${width}`).launch()`; the rest launch once with `profile.launch()`. No `test.setTimeout` or `test.slow()` was needed: every collapsed test finished well inside the 30 s default.

| # | Old lines (copies) | New title (widths listed) | Setup | Why |
|---|---|---|---|---|
| 1 | 132 (T2.60, x3) | "...outside About at 320, 390 and 1280" | fresh profile per width | Tried shared first: at the second width `tabTo` to the icon failed ("focus ring on BODY"); the Tab walk depends on the focus state of a fresh page. |
| 2 | 211 (T2.60-B4, x3) | "...New Plan and About at 320, 390 and 1280" | fresh profile per width | Each width confirms its own Plan and then reloads with `persisted` forced true (an init script that stays on the page), so a second width would find a plan and no icon. |
| 3 | 301 (T2.37-B1, x2 stages) | "...on first run and account onboarding at 390" | fresh profile per stage | First run exists only before the journal is started; the onboarding stage starts it. |
| 4 | 383 (T2.38 first run and onboarding, x2) | "...on first run and onboarding at 390 and 320" | fresh profile per width | The body walks first run to onboarding, which starts the journal. |
| 5 | 396 (T2.38 Trades and Open Detail, x2) | "...on Trades and Open Detail at 390 and 320" | fresh profile per width | Open Detail is reached from the entry receipt (`backToTrade`), which the walk on to Trades leaves; a second width cannot repeat the same steps on the same profile. |
| 6 | 578 (T2.40 tables, x3) | "...in both tables at 390, 320 and 1280" | fresh profile per width | Tried shared (with `showOpenTrades`): at the second width `tabTo` to the Underlying link failed ("focus ring on BODY" at Open at 320), the same focus-state dependence as row 1. Seeding is four Plans per width. |
| 7 | 591 (T2.40 Records disagree badge, x2) | "...with the Trade cell at 390 and 320" | one setup, one launch | Read-only: `setViewportSize`, then `goto('/?lifecycle=Planned')` per width. |
| 8 | ~1365 (T2.55-B4, x3) | "...of an incoherent Open row at 1280, 390 and 320" | one setup, one launch | Read-only: `setViewportSize`, `goto('/')`, `expectLayout` per width. |
| 9 | ~1392 (T2.55-B5, blank Stop and blank Target, x2) | "should mark a blank Stop and a blank Target, not the valid Intended entry, after Confirm Plan" | fresh profile per blank field | The Plan form ends in its error state, and the body starts from a fresh onboarded page. |
| 10 | ~1410 (T2.55-B6, x3) | "...of an incoherent Planned row at 1280, 390 and 320" | one setup, one launch | Read-only: `setViewportSize`, `goto('/?lifecycle=Planned')`, `expectLayout` per width. |
| 11 | ~1503 (T2.62 Underlying header and "@", x3) | "...with its price at 320, 390 and 1280" | one setup, `showOpenTrades` between widths | Read-only measurements, no keyboard. Underlying header height assertion runs at 1280 only (P57). |
| 12 | ~1580 (T2.62 cells inside the scroll region, x2) | "...inside the scroll region at 320 and 390" | one setup, `showOpenTrades` between widths | Read-only. |
| 13 | ~1595 (T2.62 Records disagree badge, x2) | "...inside the scroll region at 320 and 390" | one setup, one launch | Read-only: `setViewportSize`, `goto('/?lifecycle=Planned')` per width. |
| 14 | ~1613 (T2.62 UNDERLYING header, x2) | "...on one line at 320 and 390" | one setup, `showOpenTrades` between widths | Read-only. |
| 15 | ~1793 (T2.67 receipt heading, x3) | "...on one line at 320, 340 and 390" | one setup | Page stays on the receipt; read-only, `setViewportSize` and `expectLayout` per width. |
| 16 | ~1827 (T2.67 Open Lots, x2) | "...on the card's row edges at 1280 and 320" | one setup | Page stays on the Open Detail; read-only. |
| 17 | ~1870 (T2.67 caption in view, x2) | "...fully right at 320 and 390" | one setup, `showOpenTrades` between widths | The body scrolls the region back to 0 itself; no keyboard. |

Seven of the 17 bodies keep a profile per width or stage (rows 1 to 6 and 9, with the reasons above); the other ten share one setup. 17 bodies, 41 tests became 17 tests: 69 to 45 (check: 41 - 17 = 24, 69 - 24 = 45). The title of every collapsed test lists the widths (or stages, or blank fields) it loops over; every `expect` kept its matcher, value and message, including `${width}`, `${stage}` and `${where}`.

**The removed assertion.** T2.62's first body: `if (width === 1280) expect(header.height, ...)`, with a comment citing P57. During the mutation check below, the first body passed at 320 and 390 with the header font enlarged, while the UNDERLYING body failed there, which shows the UNDERLYING body is what now covers those widths.

**Mutation checks.** Each is a one-line CSS edit in `src/ui/app.css` (Edit tool), then `npm run build:faults` (the served rule was confirmed in `dist-faults/assets/*.css`), the test, restore, `git diff -- src` empty, and a rebuild. The loop stops at the first failing `expect`, so the committed file shows only the first width; the other widths were shown with a temporary copy of the spec, `e2e/d2/tmp-mutation.spec.ts`, in which the body's width array read `process.env.W ? [Number(process.env.W)] : [...]`. The copy was deleted before the commit and was never staged.

1. T2.40's body: `table.trades th, table.trades td { padding: 0.6rem }` changed to `0.2rem` (the focus outline needs 5 px of room beside the Underlying link).
   - Committed file, `-g "pin Underlying, keep"`: `Error: Open at 390 outline room left`, `Expected: >= 5`, `Received: 3.1875`.
   - Copy, `W=320`: `Error: Open at 320 outline room left`, `Received: 3.1875`.
   - Copy, `W=1280`: `Error: Open at 1280 outline room left`, `Received: 3.1875`.
2. T2.62's "UNDERLYING header" body: `table.trades th { font-size: 0.8rem }` changed to `1.8rem`.
   - Committed file, `-g "UNDERLYING header"`: `Error: Open UNDERLYING scrollWidth at 320`, `Expected: <= 104`, `Received: 199` (the other test the pattern matched, T2.62's first body, passed).
   - Copy, `W=390`: `Error: Open UNDERLYING scrollWidth at 390`, `Expected: <= 104`, `Received: 199`.
   - Copy, `W=320`: `Error: Open UNDERLYING scrollWidth at 320`, `Expected: <= 104`, `Received: 199`.

Both edits were reverted by Edit; `git diff claude-opus-5.5-d5r2 -- src | wc -l` is 0 and `dist-faults` was rebuilt from the restored source before the full `npm run test:e2e` run.

**Checks.** `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint` and `npm run lint:deps` all exit 0. Ports 5175, 9341 and 9342 had no listener before or after every browser run. (A Firefox Nightly process belonging to the user was running throughout; it was not touched.)
