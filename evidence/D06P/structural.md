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
