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

## T7S.4 Trade Analysis: `evaluate` per condition and the headline

Behavioral, commit `51d84965`; six cases in `src/domain/trade-analysis/evaluate-conditions.test.ts`, red and green in `tdd-log.md`. Flagged: case 2 (O-C2 after P1′) passed on its first run; mutation `crossed = toward.compare(ZERO) < 0` in `conditionOf` failed it with an AssertionError on `target-2`, restored. Case 4's first run was an invalid red (the headline's zero clause had been coded during case 3); the clause was removed, the case went red with an AssertionError, and green on restoring it. Case names rephrase `$` amounts ("zero", "470 dollars", "150 dollars") for `-t`. No existing expectation changed; `ConditionStatus.kind` already existed and was widened. Added `headlineBasisOf` (plan.ts, exported) and test Executions `OS2_S1`, `OC2_P1`.

**ocr review of `51d84965`** (`ocr/T7S.4-51d84965.json`): 0 comments.

**Cumulative run `t7s-4`** (2026-11-12, on `51d84965`), outputs in `suite-runs/t7s-4-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 127 files, 1492 passed |
| Node integration | 97 files, 202 passed |
| Browser (Chromium), task tier | `@every-task` 5 passed (11.1s); no `e2e/d7s` folder yet |
| Checks | 14 of 14 exit 0 |

Browser tier printed by `browser-auto f40e99e5`: `browser tier: task (no changed path since f40e99e5 is on the full-tier list)`. Ports 5175, 9341, 9342 free before and after.

## T7S.5 Trade Analysis: Entry Quality from the headline conditions

Behavioral, commit `f7590645`; one case in `src/domain/trade-analysis/entry.test.ts` (name rephrased: "S1 prime", `$` dropped), red (`expected '5513/10' to be '4713/10'`, the old first-condition S-u measurement) then green. No first-run pass. `entryQualityOf` measures from `measurementOf(headlineBasisOf(...))` for both roles; direction still from `leg.side`.

**ocr review of `f7590645`** (`ocr/T7S.5-f7590645.json`): 0 comments.

**Cumulative run `t7s-5`** (2026-11-12, on `f7590645`), outputs in `suite-runs/t7s-5-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 127 files, 1493 passed |
| Node integration | 97 files, 202 passed |
| Browser (Chromium), task tier | `@every-task` 5 passed (10.8s); no `e2e/d7s` folder yet |
| Checks | 14 of 14 exit 0 |

Browser tier printed by `browser-auto 51d84965`: `browser tier: task (no changed path since 51d84965 is on the full-tier list)`. Ports 5175, 9341, 9342 free before and after.

## T7S.6 Daily Review: pressure and range position from the headline conditions

Behavioral, commit `edbc03a5`; one case in `src/coordinators/daily-review/option-attention.test.ts` (apostrophes dropped from the name), red (pressure from S-u's value at expiration 4.00: at-entry risk 550, share 19/55) then green. No first-run pass. Arithmetic (tdd-log note): at entry risk −2 × 100 × (1.25 − 3.60) = 470, reward −2 × 100 × (0.50 − 1.25) = 150; Tuesday risk 360, reward 260; pressure Losing (470 − 360) / 470 = 11/47; range position now 360/620 = 18/31, at entry 470/620 = 47/62. `riskRewardOf` measures from `measurementOf(headlineBasisOf(...))`; signed-quantity arithmetic unchanged.

**ocr review of `edbc03a5`** (`ocr/T7S.6-edbc03a5.json`): 0 comments.

**Cumulative run `t7s-6`** (2026-11-12, on `edbc03a5`), outputs in `suite-runs/t7s-6-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 127 files, 1494 passed |
| Node integration | 97 files, 202 passed |
| Browser (Chromium), task tier | `@every-task` 5 passed (10.9s); no `e2e/d7s` folder yet |
| Checks | 14 of 14 exit 0 |

Browser tier printed by `browser-auto f7590645`: `browser tier: task (no changed path since f7590645 is on the full-tier list)`. Ports 5175, 9341, 9342 free before and after.

## T7S.7 Installed Capability Manifest for D7S

Structural. Schema 7 was already reported since T7S.1 (`SCHEMA_VERSION`). Changes: `TradeWorkflows.confirmPlan` gains the variant `StructureValueCondition` (A202) in `src/coordinators/workspace/capabilities.ts`; `src/app/routes.ts` (route `new-plan`) lists it so the tool finds the installed variant presented by a route (the tool fails on an installed variant no route presents); the manifest equality assertion in `src/coordinators/workspace/workspace.test.ts` follows. No other operation or variant changed; no domain or facade code touched.

| Command | Result |
|---|---|
| `npm run verify:capabilities` | exit 0: `verify:capabilities OK: 19 operations, 11 variant-qualified, 9 routes, 4 Entry Types, schema 7, release 853915999821e451dab53a036014cc8b75c550437222e52b40765fad954a9b29` |
| `npx vitest run src/coordinators/workspace src/app` | exit 0; 3 files, 49 passed |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | each exit 0 |

**Cumulative run `t7s-7`** (2026-11-12, on `ef641c00`): unit 1 failed, 1493 passed; integration 202 passed; browser full tier (`browser-auto edbc03a5`: `first matching path since edbc03a5: src/app/routes.ts`) `browser-1` 119 passed (4.9 min), `browser-2` 65 passed (4.1 min); checks 14 of 14 exit 0. Outputs in `suite-runs/t7s-7-*.txt`.

Failure: `src/ui/screens/AboutView.test.tsx:54` "About this release > should show the application name, …, and the Installed Capability Manifest": `Unable to find an element with the text: TradeWorkflows.confirmPlan (LongStock, LongCall, LongPut, CashSecuredPut)`. Reproduced in the main session by a targeted run (1 failed). Cause: the About view renders the installed manifest, which now lists `StructureValueCondition` on `confirmPlan` (A202); T7S.7 updated `workspace.test.ts`'s manifest expectation but not this one. Fix task **T7S.7-F1**: the expectation gains the variant, additively, as A202 names.

**ocr review of `ef641c00`** (`ocr/T7S.7-ef641c00.json`): 0 comments.

**T7S.7-F1** (`7feef7dc`, test-only): `AboutView.test.tsx:54`'s expected manifest line gains `StructureValueCondition`; the view reads `capabilities.operations` from the installed status (no copy). Red (the existing failure) then green; no other expectation names the old line (grep of `src/`, `tests/`, `e2e/`). **ocr review of `7feef7dc`** (relocated, `ocr/T7S.7-F1-7feef7dc.json`): 0 comments.

**Cumulative run `t7s-7-f1`** (2026-11-12, on `7feef7dc`), outputs in `suite-runs/t7s-7-f1-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 127 files, 1494 passed |
| Node integration | 97 files, 202 passed |
| Browser (Chromium), full tier | `browser-1` 119 passed (4.8 min); `browser-2` 65 passed (4.0 min) |
| Checks | 14 of 14 exit 0 |

Browser tier printed by `browser-auto edbc03a5`: `browser tier: full (first matching path since edbc03a5: src/app/routes.ts)`. Ports 5175, 9341, 9342 free before and after.

## T7S.8 UI: option Plan form with both kinds

Behavioral, commit `4f347d43`; four planned cases in `src/ui/screens/PlanForm.test.tsx`, each red then green (`tdd-log.md`); no first-run pass. Named expectation changes: `PlanForm.test.tsx:582` (the A116 Long Call case) to W2; `plan-issues.test.ts:27` from `ConditionCountNotOne` to W9's `ConditionKindRepeated`, plus one small case for `ConditionKindNotApplicable` on the stock form (W9). Supporting case for case 4 (facade pass-through of `details.condition`, as the handoff's T7S.8 note foresaw): `src/coordinators/trade-workflows/confirm-plan-options.test.ts` "should pass on a rejected condition role, position and kind, with no breakeven for an option-price one", red then green. `WorkflowIssue.details` widened to `{ breakeven?; condition? }` (it was `{ breakeven }`, not carrying `condition` by type as the note assumed).

Other existing tests touched, each a consequence of the planned behaviour, with no expected figure changed:
- `details.condition` passed on: two cases in `confirm-plan-options.test.ts` and `tests/integration/d7/rejections.test.ts:65` gain `condition` additively (as T7SP.16 did for AtEntry fields).
- `PlanForm.test.tsx`'s `submitRejected` helper matched `/^Stop/`, which now finds two fields; narrowed to `/^Stop \(ABC/` and `/^Target \(ABC/`.
- Two option Plan cases (hand-over to Trade Detail; the Planned payoff) submitted an empty form; W3 now blocks that client-side (case 3), so they type the Underlying Stop and Target first.

W10: `assessPlan`'s `InvalidPrice` carries no condition, so the form checks option prices client-side, as D7 does for its price fields; only filled prices are checked.

Flagged (behaviour without a planned case of its own): W3 clears once either price of its role is filled; an `InvalidPrice` beside an option-price field clears once that field holds a positive decimal; the option-price `NoPositiveRisk` and `TargetNotBeyondEntry` stay until the next submit (existing `OPTION_TRIGGER_CODES`). Only W3's clearing has a regression guard (the stock case).

Provisional words: none; every phrase is W1–W5, W9, W10 or a D7 row.

**ocr review of `4f347d43`** (`ocr/T7S.8-4f347d43.json`): 2 comments, both bug tasks.

| Severity | Location | Claim | Reviewer's assessment | Outcome |
|---|---|---|---|---|
| medium | `src/ui/screens/PlanForm.tsx:284` | Clearing an invalid optional option-price field leaves its `InvalidPrice` error while the role's Underlying price is filled | Valid: `corrected` clears a `stopOption`/`targetOption` error only when the field holds a positive decimal; an emptied field, valid under P92, keeps the stale error until the next submit | Bug task T7S.8-B1 |
| low | `src/ui/screens/PlanForm.tsx:388` | In the two-column risk grid the order Stop, Target, option Stop, option Target puts the Underlying Stop beside the Underlying Target, not beside its option-price field | Doubtful: confirmed against `app.css:353`'s two columns; P92 says the option-price field sits beside the Underlying field, and case 1 lists Stop, option Stop, Target, option Target | Bug task T7S.8-B2 |

**T7S.8-B1** Stale option-price error after emptying the field. Defect: on a Cash-Secured Put with "Stop (MNO at or below)" 41.00, typing "abc" in "Stop (option price at or above)" and submitting shows W10; emptying that field leaves W10 showing, though an empty option-price field is valid while its role's Underlying price is filled (P92). Case: `it should clear W10 beside an option-price field once the field is emptied while its role's Underlying price is filled`.

**T7S.8-B2** Each option-price field beside its own Underlying field. Defect: at a width where the risk grid has two columns, "Stop (MNO at or below)" sits beside "Target (MNO at or above)" and the option-price fields share the next row, so the option-price field is not beside the Underlying field it pairs with (P92), against case 1's order. Case: `it should place the price fields in the order Stop on the Underlying, Stop option price, Target on the Underlying, Target option price, so each option-price field sits beside its Underlying field`.

T7S.8-B1 done in `743defbe`: red (`expected 'stopOption-error' to be null`) then green, both roles covered; the option-price branch of `corrected` also clears when the field is emptied and its role's Underlying field is filled. **ocr review of `743defbe`** (`ocr/T7S.8-B1-743defbe.json`): 0 comments.

T7S.8-B2 done in `f3340232`: red (`expected +0 to be truthy`, DOM order) then green; the grid's order is now quantity, entry, Stop, Stop option price, Target, Target option price, so its two columns pair each role's fields with no CSS change; submit order unchanged. **ocr review of `f3340232`** (`ocr/T7S.8-B2-f3340232.json`): 0 comments.

**Cumulative run `t7s-8`** (2026-11-12, on `f3340232`): unit 127 files, 1502 passed; integration 202 passed; browser full tier (`browser-auto 7feef7dc`: `first matching path since 7feef7dc: src/ui/screens/PlanForm.tsx`) `browser-1` 119 passed (4.8 min), `browser-2` 18 failed, 47 passed (3.5 min); checks 14 of 14 exit 0. Outputs in `suite-runs/t7s-8-*.txt`.

Failures: 18 `browser-2` cases (`e2e/d7/` confirm-option-plan, kill, marks-zero, no-save, offline, payoff-chart-layout ×3, plan-open, plan-validation, responsive-a11y ×2, review-expiration, runtime-failure ×2, settlement-due, short-put; `e2e/d7sp/review-dated-line`), all `locator.fill: Error: strict mode violation: getByLabel(/^Stop \(/) resolved to 2 elements`. Reproduced in the main session with `npx playwright test e2e/d7/plan-open.spec.ts` (1 failed, same error). Cause: the option Plan form now has "Stop (XYZ at or below)" and "Stop (option price at or below)" (W1), and `e2e/d7/support.ts:59`–`:60` and `e2e/d7/plan-validation.spec.ts:20`, `:23`, `:24` locate by `/^Stop \(/` and `/^Target \(/`. Section 1.5's Texts lookup grepped the label strings, not these regex locators. Fix task **T7S.8-F1**: narrow those locators to the Underlying fields; no expected value changes.

**T7S.8-F1** (`bb461313`, test-only): `e2e/d7/support.ts:59`–`:60` and `plan-validation.spec.ts:20`, `:23`, `:24` locate `/^Stop \((?!option price)/` and `/^Target \((?!option price)/`; no other locator in `e2e/` needed it; no expected value changed. Red (`plan-open.spec.ts`, strict-mode violation) then green; `npm run test:e2e:2` 65 passed. **ocr review of `bb461313`** (relocated, `ocr/T7S.8-F1-bb461313.json`): 0 comments.

**Cumulative run `t7s-8-f1`** (2026-11-12, on `bb461313`), outputs in `suite-runs/t7s-8-f1-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 127 files, 1502 passed |
| Node integration | 97 files, 202 passed |
| Browser (Chromium), full tier | `browser-1` 119 passed (4.9 min); `browser-2` 65 passed (4.1 min) |
| Checks | 14 of 14 exit 0 |

Browser tier printed by `browser-auto 7feef7dc`: `browser tier: full (first matching path since 7feef7dc: e2e/d7/plan-validation.spec.ts)`. Ports 5175, 9341, 9342 free before and after.
