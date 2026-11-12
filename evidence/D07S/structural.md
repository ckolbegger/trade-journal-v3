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
| critic-1 (T7S.12 checkpoint; brief from `critic-brief.md`, general-purpose at medium effort) | `critic-1.md` | C7S.1–C7S.4 | FAIL, 1 high defect; 129,709 tokens, 47 tool calls, 5 min 40 s |
| critic-2 (T7S.12 checkpoint after B1; same brief, plus several C7S.4 combinations; general-purpose at medium effort) | `critic-2.md` | C7S.1–C7S.4 | PASS, no defects; 138,386 tokens, 40 tool calls, 5 min 5 s |

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

## T7S.9 UI: Trade Detail shows every condition

Behavioral, commit `1e5a2a45`; two cases in `src/ui/screens/TradeDetailOptions.test.tsx`, red then green; no first-run pass. Named expectation changes: `:286`–`:287` to W6 ("XYZ at or below 48.00", "XYZ at or above 60.00") with case 1; `:272`–`:276` to W7 rows ("Stop on XYZ", "Target on XYZ") with case 2. Direction: no shareable helper existed, so `isBullish` moved from `PlanForm.tsx` to `src/ui/screens/option-words.ts` with `conditionDirection(role, kind, leg)`; the form's W1 labels and Detail's W6 lines both use it (no second copy). `TradeDetail.tsx:155`–`156` and `:311`–`312` first-condition reads gone; `triggerText` removed as unused; `:505` kept. Test support: `OptionTradeName` gains `'O-S2'`; `option-trade-fixtures.ts` re-exports `OS2_S1`. No e2e expectation reads a changed text. Provisional words: none.

**ocr review of `1e5a2a45`** (`ocr/T7S.9-1e5a2a45.json`): 3 comments.

| Severity | Location | Claim | Reviewer's assessment | Outcome |
|---|---|---|---|---|
| medium | `tests/support/option-detail-fixtures.ts:13` | With O-S2 added, `optionOpenDetail` stamps every Due settlement item with the fixed 2026-11-20 `SETTLEMENT_TIME` (line 16, used at 139), though O-S2 expires 2026-12-18 | Doubtful: real in the code; no current assertion sees it | Bug task T7S.9-B1 (failure scenario: an O-S2 Detail built at or after 2026-12-18 shows a Due item settled 2026-11-20) |
| low | `src/ui/screens/TradeDetail.tsx:80` | `ConditionLines` nests a ternary; suggests early returns | Valid as style only; behaviour matches W6 | Dismissed: no failure scenario (style; the repo declined `no-nested-ternary`, D5R handoff) |
| low | `tests/support/option-detail-fixtures.ts:18` | `contractOf` and `recordOf` chain ternaries; suggests a keyed lookup | Valid as style only, test fixture code | Dismissed: no failure scenario |

**T7S.9-B1** Settlement time from each Due item's own expiration. Defect: `optionOpenDetail('O-S2', [OS2_S1], <an as-of at or after O-S2's expiration session close>)` gives a Due settlement item whose `settlementTime` is 2026-11-20 21:00Z, not the close of its own expiration session, 2026-12-18. Case: `it should stamp an O-S2 Due settlement item with the close of its own expiration session, 2026-12-18`.

T7S.9-B1 done in `7a8486b6` (test support only): red (settlement time 2026-11-20T21:00:00Z, not 2026-12-18T21:00:00Z) then green, case in `TradeDetailOptions.test.tsx`. No production helper was importable (`settlementTimeOf` in `src/coordinators/valuation/settlement.ts` is async and needs MarketData), so the fixture's fixed `SETTLEMENT_TIME` became a local `settlementTimeOf(expiration)` (16:00 New York, by `Intl`, no holiday calendar). **ocr review of `7a8486b6`** (relocated, `ocr/T7S.9-B1-7a8486b6.json`): 0 comments.

**Cumulative run `t7s-9`** (2026-11-12, on `7a8486b6`), outputs in `suite-runs/t7s-9-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 127 files, 1505 passed |
| Node integration | 97 files, 202 passed |
| Browser (Chromium), full tier | `browser-1` 119 passed (4.7 min); `browser-2` 65 passed (3.9 min) |
| Checks | 14 of 14 exit 0 |

Browser tier printed by `browser-auto bb461313`: `browser tier: full (first matching path since bb461313: src/ui/screens/PlanForm.tsx)`. Ports 5175, 9341, 9342 free before and after.

## T7S.10 UI: Review card conditions and list badges

Behavioral, commit `74ac6e82`; two cases (`TradeListOptions.test.tsx` one badge per role, red `expected [ …(2) ] to have a length of 1 but got 2`; `ReviewCard.test.tsx` W8 conditions list, red `Unable to find … role "list" and name "Conditions"`), each then green; run in the reverse of the planned order; no first-run pass. The card case builds Wednesday from `optionOpenDetail('O-S2', [OS2_S1], …)`; its Unavailable variant drops the MNO Mark, so both Underlying conditions read "Mark missing: MNO, Wed Oct 14". Direction from `conditionDirection` with the leg from `trade.summary`; a stock card is worded as Long Stock (Stop below, Target above), as no stock direction helper exists in the UI. `TradeList.tsx`'s `StatusBadges` shows one badge per role (`.some`).

Existing tests touched as a consequence of W8 (the card now reads `evaluation.conditions`), no figure changed: `conditions: []` added to the hand-built evaluation fixtures of `CardFigures.test.tsx`, `CardMarks.test.tsx`, `ReviewOptionMarks.test.tsx`, `ReviewCard.test.tsx` and `ReviewCards.test.tsx` (109 cases had failed without it). `CardFigures.test.tsx:95`, `:99` unchanged. No e2e locator or expectation matches the new list (grep reported in the return).

Provisional words (listed in the handoff's open questions for the user's approval):
1. A Breached or Reached condition reads "<status>, $X beyond" only when its Overrun is above zero; a zero Overrun reads bare ("Reached"). This extends W8's "Breached, $20.00 beyond" to Targets ("Reached, $X beyond").
2. An option-price Target line: "Target on the option price at or below $0.30: Active" (W7's naming; W8 shows only the Stop form).
3. The "Conditions" list heading is an `h4`, as the card's "At entry" group.
4. A stock card's Target line: "Target at or above $X: <status>" (W8 shows only the stock Stop form).

**ocr review of `74ac6e82`** (`ocr/T7S.10-74ac6e82.json`): 1 comment, dismissed.

| Severity | Location | Claim | Reviewer's assessment | Outcome |
|---|---|---|---|---|
| low | `src/ui/screens/CardFigures.tsx:53` | The `direction` line nests the stock Stop/Target ternary inside the option/stock ternary | Valid as style only; the logic is correct | Dismissed: no failure scenario (style; the repo declined `no-nested-ternary`, D5R handoff); listed in the handoff's open questions |

**Cumulative run `t7s-10`** (2026-11-12, on `74ac6e82`), outputs in `suite-runs/t7s-10-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 127 files, 1507 passed |
| Node integration | 97 files, 202 passed |
| Browser (Chromium), full tier | `browser-1` 119 passed (4.7 min); `browser-2` 65 passed (3.9 min) |
| Checks | 14 of 14 exit 0 |

Browser tier printed by `browser-auto 7a8486b6`: `browser tier: full (first matching path since 7a8486b6: src/ui/screens/CardFigures.tsx)`. Ports 5175, 9341, 9342 free before and after.

## T7S.11 Source check

`eslint.conditions.config.js` exports `conditionIndexSelectors` (one selector: a literal computed index on a member or identifier named `stops`, `targets`, `stopBasis` or `targetBasis`). It is spread into every non-exempt `no-restricted-syntax` entry under `src/`: `noIdentityRules`, `domainPurityRules` and the `src/domain/instrument/` non-test entry (split from the domain-test entry in `eslint.deps.config.js`), and `wordingWithExpirationRules` in `eslint.config.js` (identity selector still first, `.slice(1)` kept). Test files and `tools/` are outside.

| Command | Result |
|---|---|
| `npm run lint` (no plant) | exit 0: the 17 hits of section 1.5 are gone |
| `npm run lint` with `plan.stops[0]` in a scratch `src/coordinators/zz-plant.ts` | exit 1: `src/coordinators/zz-plant.ts` `1:55  error  condition-index: a Plan holds several conditions; use every condition, or headlineBasisOf / measurementOf from Trade Analysis (A197), ...  no-restricted-syntax` |
| plant removed, `npm run lint` | exit 0 |
| `npx vitest run tools` | 4 files, 74 passed (`tools/condition-rules.test.ts`: 10, including expiration, wording and purity hits kept beside the condition hit) |
| `npm run lint:deps`, `npm run verify:wording`, `npm run typecheck`, `npx tsc6 --noEmit` | exit 0 each |

**ocr review of `0d85bc9b`** (`ocr/T7S.11-0d85bc9b.json`): 0 comments.

**Cumulative run `t7s-11`** (2026-11-12, on `0d85bc9b`), outputs in `suite-runs/t7s-11-*.txt`, `run-complete.sh`: run complete. Run at the full tier on purpose, so it is also T7S.12's full run before the checkpoint critic (no commit between it and the critic but evidence).

| Suite | Result |
|---|---|
| Unit | 127 files, 1507 passed |
| Node integration | 97 files, 202 passed |
| Browser (Chromium), full tier | `browser-1` 119 passed (4.6 min); `browser-2` 65 passed (3.9 min) |
| Checks | 14 of 14 exit 0 |

`browser-auto 74ac6e82` printed `browser tier: task (no changed path since 74ac6e82 is on the full-tier list)` and also ran that tier (`suite-runs/t7s-11-browser.txt`, 5 passed, 10.8s). Ports 5175, 9341, 9342 free before and after.

## T7S.12 Checkpoint critic

Full run before the critic: `t7s-11` (full tier on `0d85bc9b`, all green; only evidence commits since). Critic-1 on `41d8d68f` (`critic-1.md`): C7S.1, C7S.2, C7S.3 PASS; C7S.4 FAIL; overall FAIL with one high defect. The critic could not write `test-results/critic-d07s-1/report.md` (the harness refused subagent report files), so `critic-1.md` records its final message verbatim with a note.

**T7S.12-B1** (critic-1 defect 1, high) A wrong-side option-price Stop gets no error while a Target is missing. Steps: Long Call XYZ 55, 2 @ 2.00; "Stop (option price at or below)" 2.50; both Target fields empty; Confirm Plan. Expected (C7S.4 "Errors beside the right fields"; B7S.2 "W4 beside 'Stop (option price at or below)' and W3 beside 'Target (XYZ at or above)'" from the same save). Actual: only W3; W4 appears only on a second save after a Target is filled. Cause per the critic: `PlanForm.tsx:179`–`189` returns early with only MissingStop/MissingTarget and doesn't submit (T7S.8 case 3), and `assessPlan` (`plan.ts:269`) stops before the per-condition checks when MissingTarget is present. Case: `it should show W4 beside a wrong-side option-price Stop together with W3 beside the empty Target, from one save, without submitting`.

Critic minor observation 1 (the Detail conditions table scrolls inside its own box at 375 and 320 px; D7's 7-column layout, with D7S's longer first-column labels) is listed as an observation, not a defect; recorded in the handoff's open questions.

T7S.12-B1 done in `d34f6670`: red (`expected undefined to be 'The option-price Stop must be below t…'`) then green; the case covers a Long Call (W4 with W3) and a Cash-Secured Put (W5 with W3), `confirmPlan` not called. In the "role missing" branch the form now also decides option-price wrong-side errors itself (positive entry and option price; `conditionDirection(role, 'StructureValue', leg)`; contact counts as wrong side), with sentences from `describeIssues` fed `NoPositiveRisk`/`TargetNotBeyondEntry` with `details.condition.kind` 'StructureValue', so no W4/W5 sentence or direction rule is copied. They stay until the next save, as the server's do. `assessPlan`, the facade and Underlying checks unchanged. Browser specs on the screen (plan-validation, plan-open, no-save, responsive-a11y): 5 passed. **ocr review of `d34f6670`** (`ocr/T7S.12-B1-d34f6670.json`): 0 comments.

**Cumulative run `t7s-12-b1`** (2026-11-12, on `d34f6670`, full tier as the run after the last fix), outputs in `suite-runs/t7s-12-b1-*.txt`, `run-complete.sh`: run complete. Unit 127 files, 1508 passed; integration 97 files, 202 passed; `browser-1` 119 passed (4.7 min), `browser-2` 65 passed (4.0 min); checks 14 of 14 exit 0. Ports 5175, 9341, 9342 free before and after. Critic-1 reported a high defect, so a fresh critic follows (`critic-brief.md`, "After each critic").

Critic-2 on `427d3396` (`critic-2.md`): C7S.1–C7S.4 PASS, no defects (C7S.4 with 11 combinations, each from one save, nothing stored). The checkpoint closes on critic-2, as the full run before it (`t7s-12-b1`) stands. Its minor observations are listed in the handoff's open questions; none is a defect.

## T7S.13 Freeze the schema-v7 fixture

- `npm run fixtures:freeze -- --schema 7` (exit 0): `fixtures:freeze OK: tests/fixtures/workspace-v7 (schema 7, 5 Planned and 5 Open and 2 Closed stock Trades plus 5 option Trades, 3 Accounts)`. The tool's v6 content is unchanged; O-S2 (MNO 45 Put expiring 2026-12-18, Plan -2 at 1.20, Stops 41.00 UnderlyingPrice and 3.60 StructureValue, Targets 44.50 UnderlyingPrice and 0.30 StructureValue, planned Monday 2026-10-12 09:00, S1' Sell 2 @ 1.25 fee 1.30 at 10:00) is added after the v6 option Trades, then Friday 2026-11-20 Marks MNO 44.60 and MNO261218P00045000 3.65.
- Snapshot readings for O-S2 (trade fx-0223): oneR 480, reward 140, ratio 7/24; stop-1 (S-u) Active $70 (MNO 3.6 away); stop-2 (S-o) Breached, Overrun $10 (1/48 R); target-1 (T-u) Reached, Overrun $0, MNO 0.10 beyond; target-2 (T-o) Active $670; Ongoing Risk to Stop $0.00, Incremental Reward to Target $0.00, Worst-Case $8,270 (827/48 R), Maximum Incremental Reward $730; settlement NotYetDue (expires 2026-12-18); no Deviations or findings.
- `npm run verify:fixtures` (exit 0): v1 to v6 "migrated to 7 ... views equal", `workspace-v7: schema 7, opened without migration, views equal`, then `verify:fixtures OK: workspace-v1 ... workspace-v7 open Ready at schema 7 ...`. A v7 content check (at least two StructureValue conditions among the Open details' Plan stops and targets) sits beside the v6 one.
- `git diff --stat` over `tests/fixtures/workspace-v1` to `workspace-v6`: empty.
- `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`: each exit 0. `npx vitest run tools`: 4 files, 74 tests passed.

**ocr review of `b3776f7f`** (`ocr/T7S.13-b3776f7f.json`): 1 comment, a bug task.

| Severity | Location | Claim | Reviewer's assessment | Outcome |
|---|---|---|---|---|
| medium | `tools/verify-fixtures.ts:136` | The v7 content check counts `StructureValue` conditions across every detail (Planned, Open, Closed), though A204 and the code's comment require them in the Open details | Valid: the filter has no lifecycle test; today only `fx-0223` (Open) holds them, so the frozen fixture passes correctly, but the guard is looser than A204 | Bug task T7S.13-B1 |

**T7S.13-B1** The v7 content check counts only Open details. Defect: a v7 snapshot whose two `StructureValue` conditions sit on a Planned or Closed Trade, with none on an Open one, passes `verify:fixtures`' v7 content check, though A204 requires at least two in its Open details. Case: `it should fail the v7 content check when the StructureValue conditions are only on Planned or Closed details`. (The v6 check above it counts every detail the same way; it predates D7S and isn't changed here: listed in the handoff's open questions.)

T7S.13-B1 done in `9b7ecce2` (log row `930964e7`): red (`expected 3 to be less than 2`) then green; the check is now `openStructureValueCount(expected)` in `tools/fixture-views.ts` (details with `lifecycle.stored === 'Open'`), used by `verify-fixtures.ts`; `verify:fixtures` exits 0, `tests/fixtures` unchanged. Flagged: the second case ("should count the two StructureValue conditions on the frozen v7 Open detail") passed on its first run; mutation (filter on `'Planned'`) failed it with `AssertionError: expected 0 to be greater than or equal to 2`, restored. **ocr review of `9b7ecce2`** (`ocr/T7S.13-B1-9b7ecce2.json`): 0 comments.

**Cumulative run `t7s-13`** (2026-11-12, on `930964e7`), outputs in `suite-runs/t7s-13-*.txt`, `run-complete.sh`: run complete. Unit 127 files, 1508 passed; integration 97 files, 202 passed; browser task tier (`browser-auto d34f6670`: `browser tier: task (no changed path since d34f6670 is on the full-tier list)`) `@every-task` 5 passed (11.1s); checks 14 of 14 exit 0. Ports 5175, 9341, 9342 free before and after.
