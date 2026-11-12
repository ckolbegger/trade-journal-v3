# D7S structural verifications

Each entry records a structural task's exact verification (D7S breakdown, section 5), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`.

## Start of D7S

Location checks (D7S handoff, section 1) on 2026-11-11:
- worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`: matched.
- `git status -sb`: `## claude-opus-5.5...origin/claude-opus-5.5`, clean. Not "ahead 63": the user had pushed, and `HEAD`, `origin/claude-opus-5.5` and `claude-opus-5.5-pre-d7s` are all `ad11e458`.
- `git log --oneline claude-opus-5.5-pre-d7s..HEAD`: empty.
- tags `claude-opus-5.5-d7sp` (`27970527be8a04fba56f22676afe54a5c8b2af4a`), `claude-opus-5.5-plan-r78` (`0c679938d93a96c3d90d9fd62286376d232b1f38`), `claude-opus-5.5-plan-r79` (`d28fb44450aa3e320eec3c5a6ba3c7a1977c7519`) and `claude-opus-5.5-pre-d7s`: present.
- `git diff --stat claude-opus-5.5-d7sp claude-opus-5.5-pre-d7s -- src e2e tests tools package.json 'eslint*'`: empty.
- `git rev-parse --git-path hooks`: `.githooks`.
- `ocr llm test`: `✓ Connection test successful`.
- `DEV_PORT=5175`; Node v26.12.0.
- `npm ci`: exit 0. `npx vitest run src`: `Test Files 125 passed (125)`, `Tests 1481 passed (1481)`. `npx vitest run tests/integration`: `Test Files 97 passed (97)`, `Tests 202 passed (202)`.

Spec reading (decision 45, A205): `plan/spec-reading/D07.md`. No other spec section has been needed yet.

## Critic cost

| Critic | Report | Flows | Result |
|---|---|---|---|

## T7S.1 Persistence: schema 7 and the `v6→v7` transform

Behavioral (1 case, red then green, in `tdd-log.md`). Commit `1627e865`. Red: the schema-6 database read as current (`expected { kind: 'KnownWorkspace', … } to deeply equal { kind: 'OlderSchema', … }`); green after `SCHEMA_VERSION` 7 and `src/persistence/migrations/v6-to-v7.ts`, which only drops private fields, like `v5-to-v6.ts` (A199). No first-run passes. Current-schema version literals moved from 6 to 7, test names unchanged, as T7.7 did (implementation-level decision, recorded in the brief): `src/persistence/candidate.test.ts`, `persistence.test.ts`, `schema-v3..v6.test.ts`, `src/coordinators/workspace/workspace.test.ts`, `migration.test.ts` (the newer-schema case now seeds 8), and `tests/integration/d2|d4|d5|d6|d7/seed.test.ts` and `migration.test.ts`. No fixture touched; `verify:fixtures` opens workspace-v1 to v6 Ready at schema 7 with views equal to their snapshots. `verify:capabilities` already reports schema 7. `verify:capacity` fails as expected until T7S.2 (decision 108).

**ocr review** (`ocr/T7S.1-1627e865.json`): No findings (3 files reviewed).

**Cumulative run `t7s-1`** (2026-11-12, on `6582ea5b`, which adds only plan documents to `1627e865`), outputs in `suite-runs/t7s-1-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 126 files; 1480 passed, 2 failed (below) |
| Node integration | 97 files, 202 passed |
| Browser (Chromium), full tier | `browser-1` 119 passed (5.0 min); `browser-2` 65 passed (4.2 min) |
| Checks | 13 of 14 exit 0; `verify:capacity` the expected failure ("basis measured at schema version 6, current is 7") |

Browser tier printed by `browser-auto ad11e458`: `browser tier: full (first matching path since ad11e458: src/persistence/migrations/index.ts)`. Ports 5175, 9341, 9342 free before and after.

Unit failures: `src/ui/screens/ReviewCards.test.tsx:670` and `:694` ("links (A161)": the focused row's region `contains(document.activeElement)`, expected true). Reproduced with targeted runs in the main session: `npx vitest run src/ui/screens/ReviewCards.test.tsx -t "links"` 11 passed, and the whole file 50 of 50. The cases read focus synchronously after `findByRole`, and the unit stage ran while T7S.1's ocr review was running, so this is read as a timing flake under load, not a T7S.1 defect (T7S.1 changed persistence only). Not fixed; listed in the handoff's open questions, and it becomes a fix task (failing test first, `waitFor` on focus) if it fails again.

## T7S.3 Trade Analysis: `assessPlan` with option-price conditions

Behavioral (4 cases, red then green, in `tdd-log.md`); run straight after T7S.1 (decision 108). Commit `dd1a89e8`. Reds: case 1 `expected Accepted, got ConditionCountNotOne, StopTargetOrder, TargetNotBeyondEntry`; case 2 one `NoPositiveRisk` where two were expected; case 3 the code word still `ConditionCountNotOne`; case 4 `expected Rejected, got Accepted`. No first-run passes. `ConditionInput` gains `StructureValue`; option-price measurement at its own price; per-condition `NoPositiveRisk` and `TargetNotBeyondEntry` with `details.condition` (role, 1-based position, kind), de-duplicated by code and condition; `StopTargetOrder` over Underlying conditions only; `ConditionKindRepeated` replaces `ConditionCountNotOne` for every Plan; `ConditionKindNotApplicable` on a stock Plan; `measurementOf` exported. Expectations changed as section 1.5's Texts table names: `plan-option.test.ts:158`, `:161` and `tests/integration/d7/rejections.test.ts:68`–`:83` (test name's code word too). `plan-issues.ts` and `plan-issues.test.ts:27` unchanged (the sentence map is string-keyed, so the typecheck didn't force a change); T7S.8 owns them. Subagent notes: the facade passes only `breakeven` through, so `details.condition` doesn't reach the UI yet (T7S.8); a stock Plan with two conditions of one kind is now `ConditionKindRepeated`. Direction: the existing helper reused, no new copy (tech debt item 14, user's decision).

**ocr review** (`ocr/T7S.3-dd1a89e8.json`): No findings (3 files reviewed).

**Cumulative run `t7s-3`** (2026-11-12, on `dd1a89e8` with the handoff edit uncommitted), outputs in `suite-runs/t7s-3-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 126 files, 1486 passed |
| Node integration | 97 files, 202 passed |
| Browser (Chromium), task tier | 5 passed (11.3 s); no `e2e/d7s` folder yet |
| Checks | 13 of 14 exit 0; `verify:capacity` the expected failure until T7S.2 (decision 108) |

Browser tier printed by `browser-auto 6582ea5b`: `browser tier: task (no changed path since 6582ea5b is on the full-tier list)`. Ports 5175, 9341, 9342 free before and after. The `ReviewCards.test.tsx` focus cases that failed in `t7s-1` passed.

## T7S.2 Capacity basis

Structural. `tools/capacity/measure-page.ts` `measureOptionPhase` now gives the 600 option Plans A203's option-price mix by `n % 10`: 10% (slot 0) hold only option-price conditions (a `StructureValue` Stop and Target); 30% (slots 1 to 3) hold a `StructureValue` Stop beside the Underlying Stop; the rest are unchanged. Prices sit on the valid side of the entry: Long Call and Long Put Stop = entry - 1.00, Target = entry + 3.00; Cash-Secured Put Stop = entry + 1.00, Target = entry - 0.50. All 600 confirmed through the facade.

Ports 5175, 9341 and 9342 free before and after.

| Command | Result |
|---|---|
| `npm run measure:capacity` | exit 0; `measure:capacity OK: M 912516132 bytes, required quota 2737548396 bytes` (chromium 153.0.8010.12, about 11 minutes) |
| `npm run verify:capacity` | exit 0; `verify:capacity OK: required quota 2737548396 = 3 × 912516132, schema 7` |
| `npx vitest run tests/integration/d7/capacity-profile.test.ts` | 1 passed (no pinned figure changed) |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |

Basis change (schema 6 to 7): M 916073043 to 912516132 bytes; required quota 2748219129 to 2737548396. Bytes per option Trade with Plan Reflection 3679.57 to 3597.65; JSON bytes per option Trade 2522.22 to 2571.23 (up, as the conditions add content); option-Plan overhead ratio 1.4589 to 1.3992 (down). Stored bytes per option Trade fell because the measured overhead ratio fell by more than the JSON grew; the measurement is the source of truth.

**ocr review of `f40e99e5`** (`ocr/T7S.2-f40e99e5.json`): 2 comments, both dismissed (no failure scenario, `implementing.md`):

| Severity | Location | Claim | Reviewer's assessment | Outcome |
|---|---|---|---|---|
| low | `tools/capacity/measure-page.ts:727` | `entryPrice` repeats the entry-price expression that `legs[].intendedEntry` computes, so the two could drift | Valid as a maintainability point; the two agree today, checked after `toFixed(2)` | Dismissed: no failure scenario (only future drift in a measurement tool); listed in the handoff's open questions |
| low | `tools/capacity/measure-page.ts:744` | nested ternaries picking the Underlying Stop price should be a lookup | Doubtful: the ternary predates the commit and was only moved | Dismissed: no failure scenario, style only, pre-existing code |

**Cumulative run `t7s-2`** (2026-11-12, on `f40e99e5`), outputs in `suite-runs/t7s-2-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 126 files, 1486 passed |
| Node integration | 97 files, 202 passed |
| Browser (Chromium), full tier | `browser-1` 119 passed (4.8 min); `browser-2` 65 passed (4.1 min) |
| Checks | 14 of 14 exit 0 (`verify:capacity` passes again at schema 7) |

Browser tier printed by `browser-auto dd1a89e8`: `browser tier: full (first matching path since dd1a89e8: src/delivery/capacity-basis.json)`. Ports 5175, 9341, 9342 free before and after.
