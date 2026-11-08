# D7 structural verifications

Each entry records a structural task's exact verification (D7 breakdown, section 5), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`.

## Start of D7

Location checks (D7 handoff, section 1) on 2026-11-06:
- worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`: matched.
- `git status -sb`: `## claude-opus-5.5...origin/claude-opus-5.5`, clean except the untracked `.claude/settings.json`.
- `git log --oneline claude-opus-5.5-pre-d7..HEAD`: empty. `HEAD` is `4e0e52be`.
- tags `claude-opus-5.5-plan-r48`, `claude-opus-5.5-d6`, `claude-opus-5.5-d7p`, `claude-opus-5.5-pre-d7`: present. `claude-opus-5.5-d7p` is `b8517d481182069683cdfb43a733cb336d5da194`; `claude-opus-5.5-d6` is `e10d55a225d19d70c5cb5923d6f45e0cb93b5a1b`.
- `git diff --stat claude-opus-5.5-d7p claude-opus-5.5-pre-d7 -- src e2e tests`: empty.
- `git diff --name-status claude-opus-5.5-d7p claude-opus-5.5-pre-d7 -- tools package.json 'eslint*'`: exactly the retrospective's files (`eslint.wording.config.js` and `tools/wording-rules.test.ts` added; `eslint.config.js`, `eslint.deps.config.js`, `package.json` modified; `tools/wording-scan.ts`, `tools/wording-scan.test.ts`, `tools/verify-wording.ts` deleted).
- `ocr llm test`: `✓ Connection test successful`.
- `DEV_PORT=5175`; Node v26.12.0.
- `npm ci`: exit 0. `npx vitest run src`: `Test Files 97 passed (97)`, `Tests 1225 passed (1225)`. `npx vitest run tests/integration`: `Test Files 76 passed (76)`, `Tests 154 passed (154)`.

Spec reading (decision 45): `plan/spec-reading/D07.md`, all 180 entries. No other spec section has been needed yet.

## T7.1 Option Instruments and keys

Behavioral; commit `ba247330`. 6 cases red then green (`tdd-log.md`; case 1 logged as two rows, key and label). One first-run pass, flagged: case 6 (a bare symbol is a Stock with multiplier 1), built by case 1's `multiplierOf` and the prefactor's Stock `instrumentOf`; mutation `multiplierOf` returning 100 for a Stock failed with `AssertionError: expected 100 to be 1`. Wording config and `tools/wording-rules.test.ts` not touched. Implementation decisions: `instrumentOf` on an OCC key returns `symbol` equal to the root (an OCC key does not carry the listing symbol; exact for every symbol without "."); new issue codes `RootTooLong`, `InvalidExpiration`, `InvalidStrike`, `StrikeNotPositive`, `StrikeTooPrecise`, `InvalidRight` (malformed symbol reuses D1's `MissingInstrument`); a strike with more than 5 whole digits is `InvalidStrike` (the key holds 8 digits).

### ocr review of `ba247330`

Session `a7a99898-e3de-485a-8338-f93d8ea736e0`, model gpt-6.1-sol, 2 files reviewed (tests excluded), 1 finding. Raw output: [ocr/T7.1-ba247330.json](ocr/T7.1-ba247330.json).

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| medium | `src/domain/instrument/index.ts:85` | `validateOptionContract` accepts any four-digit year, but the OCC key keeps only YY and `instrumentOf` rebuilds 20YY, so `2026-11-20` and `2126-11-20` share a key and the second decodes wrongly. | Valid: confirmed at lines 25, 49 and 63–67. Bug task T7.1-B1. |

**T7.1-B1.** Defect: an expiration outside 2000–2099 is accepted, gives the same key as one a century apart, and round-trips to the wrong date. Fix: reject an expiration year outside 2000–2099 with `InvalidExpiration`. Case: *it should reject an expiration outside 2000 to 2099 with InvalidExpiration, and accept 2000-01-21 and 2099-12-18, each round-tripping through its key.*

**T7.1-B1** done: commit `b115db30`, 1 case red (`expected { ok: true, … } to deeply equal { ok: false, … }`) then green. `InvalidExpiration` now also covers a year outside 2000–2099.

### ocr review of `b115db30` (T7.1-B1)

Session `61050e79-ec0b-4bfc-a732-3bce2af4e50e`, model gpt-6.1-sol, 1 file reviewed, **no findings**. Raw output: [ocr/T7.1-B1-b115db30.json](ocr/T7.1-B1-b115db30.json).

### Cumulative run after T7.1 (`t7-1-instrument`, at `b115db30`)

Run by `suite-runner` on 2026-11-06, browser stage `browser-auto 5b420449`.

| Suite | Result | Output |
|---|---|---|
| Unit | 97 files, 1233 passed, exit 0 | `suite-runs/t7-1-instrument-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-1-instrument-integration.txt` |
| Browser (Chromium), full tier | 167 passed (8.2 min), exit 0 | `suite-runs/t7-1-instrument-browser.txt` |
| Static and verification checks | 13 of 13 exit 0 | `suite-runs/t7-1-instrument-checks.txt` |

Tier: full, printed reason "first matching path since 5b420449: src/ui/calculation-words.test.ts". 8.2 min is below the handoff's 9-minute threshold for raising tech debt item 6. Ports 5175, 9341, 9342 free before and after. T7.1 is complete.

## T7.2 Trade Analysis: `assessPlan` for single-leg options

Behavioral; commit `504705d2`. 6 cases red then green; no first-run pass. New `PlanIssue` codes `StopTargetOrder`, `ExerciseIntentRequired`, `ExerciseIntentNotApplicable`, `ContractQuantityNotWhole`, `ContractAlreadyExpired` (plus T7.1's contract codes surfaced); `PlanIssue.details.breakeven`; `ConditionBasis.valueAtExpiration` for options; `PlanInput.exerciseIntent`; `PlanAssessmentInput.economicTime`. Note: for a Long Call, a Stop at or above the Target always also gives `NoPositiveRisk` or `TargetNotBeyondEntry`, so case 3 asserts `StopTargetOrder` is present, not alone.

### ocr review of `504705d2`

Session `74e9c69a-ce79-49f8-bf0a-588bb3d3f8b4`, model gpt-6.1-sol, 1 file reviewed, 4 findings. Raw output: [ocr/T7.2-504705d2.json](ocr/T7.2-504705d2.json).

| Severity | Location | Finding | Verdict |
|---|---|---|---|
| medium | `plan.ts:244-245` | A100's "exactly one" Stop and Target is not enforced for an option Plan; several are accepted. | Valid. Bug task T7.2-B1. |
| medium | `plan.ts:190` | `ContractAlreadyExpired` is skipped when `economicTime` is absent, and `confirmPlan` (`trade-workflows.ts:89`) doesn't pass it. | Valid. Bug task T7.2-B2. |
| medium | `plan.ts:186` | The accepted Plan keeps the raw option instrument, not the canonical one `validateOptionContract` returns, so a strike like `000055.00` or a wrong `root` survives. | Valid. Bug task T7.2-B3. |
| medium | `plan.ts:219` | A Long Stock Plan carrying `exerciseIntent` is accepted. | Doubtful (A118: `exerciseIntent` is absent for stock). Bug task T7.2-B4. |

- **T7.2-B1.** Defect: an option Plan with two Stops or two Targets is accepted. Case: *it should reject an option Plan with two Stops or two Targets, naming the extra condition* (main-session choice of code: reuse an existing code if one fits, otherwise `ConditionCountNotOne`).
- **T7.2-B2.** Defect: an expired contract confirmed through `confirmPlan` is not rejected. Fix: `economicTime` required on `PlanAssessmentInput`, and `confirmPlan` passes the command's Economic Time. Case: *it should reject through confirmPlan an option Plan whose expiration is before the Plan's New York date with ContractAlreadyExpired, writing nothing*.
- **T7.2-B3.** Defect: a non-canonical strike or root survives into the accepted Plan. Case: *it should return the accepted option leg's canonical Instrument, normalizing strike 055.000 to 55 and deriving the root from the symbol*.
- **T7.2-B4.** Defect: Exercise Intent accepted on a Long Stock Plan. Case: *it should reject Exercise Intent on a Long Stock Plan with ExerciseIntentNotApplicable*.

**T7.2-B1** done: commit `ba8f1893`, 1 case red (`expected Rejected, got Accepted`) then green; new code `ConditionCountNotOne` with `details.extraConditions`; `details.breakeven` became optional. ocr review: session `7d4d52d3-1e45-47ab-a3a5-5b25099f4049`, **no findings** ([ocr/T7.2-B1-ba8f1893.json](ocr/T7.2-B1-ba8f1893.json)).

**T7.2-B2** done: commit `ca36f848`, 1 case red (issues lacked `ContractAlreadyExpired`) then green through `TradeWorkflows.confirmPlan`, dumps unchanged; `PlanAssessmentInput.economicTime` is now required and `confirmPlan` passes `command.economicTime`. ocr review: session `079a7e81-4600-4e64-9435-d0fc19da1f28`, **no findings** ([ocr/T7.2-B2-ca36f848.json](ocr/T7.2-B2-ca36f848.json)).

**T7.2-B3** done: commit `3feb3f11`, 1 case red (raw strike and root survived) then green; the accepted Plan's option leg is the canonical Instrument. ocr review: session `af207d7b-9abf-44d5-bc8e-5a9b760c3e9c`, **no findings** ([ocr/T7.2-B3-3feb3f11.json](ocr/T7.2-B3-3feb3f11.json)).

**T7.2-B4** done: commit `f1ffa592`, 1 case red (`expected Rejected, got Accepted`) then green; Exercise Intent on anything but a long option leg is `ExerciseIntentNotApplicable`. ocr review: session `6f2cf98f-c88c-49f6-8657-630bdc7f9fae`, **no findings** ([ocr/T7.2-B4-f1ffa592.json](ocr/T7.2-B4-f1ffa592.json)).

### Cumulative run after T7.2 (`t7-2-assess-plan`, at `f1ffa592`)

Run by `suite-runner` on 2026-11-06, browser stage `browser-auto ddf82dbd`.

| Suite | Result | Output |
|---|---|---|
| Unit | 98 files, 1243 passed, exit 0 | `suite-runs/t7-2-assess-plan-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-2-assess-plan-integration.txt` |
| Browser (Chromium), task tier | 5 passed (12.3 s), exit 0 | `suite-runs/t7-2-assess-plan-browser.txt` |
| Static and verification checks | 13 of 13 exit 0 | `suite-runs/t7-2-assess-plan-checks.txt` |

Tier: task, printed reason "no changed path since ddf82dbd is on the full-tier list"; no `e2e/d7` folder yet. Ports free before and after. T7.2 is complete.

## T7.3 wording checks

Wording of `NoOptionExpirationAnchor` (decision 81): `notApplicableTail` in `src/ui/calculation-words.ts` gains the case "no option expiration" (label "Not applicable"; figure and sentence "Not applicable: no option expiration"); `eslint.wording.config.js` gains the code in `CODES` and the tail in `REASON_WORDS`.
- `npx vitest run tools`: exit 0; Test Files 3 passed (3), Tests 51 passed (51). `tools/wording-rules.test.ts` now has 34 cases (33 at `claude-opus-5.5-pre-d7`, plus one for the new words and code).
- `npm run verify:wording`: exit 0, no output beyond the command banner.
- Planted `export const PLANTED = 'no option expiration';` at line 2 of `src/ui/due-text.ts` (uncommitted Edit): `npm run verify:wording` exit 1:
  ```
  /Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/src/ui/due-text.ts
    2:24  error  verify:wording: this is a reason's or finding's words. Word it through src/ui/calculation-words.ts, the only place that words a Calculation Result or branches on its reason code  no-restricted-syntax
  ✖ 1 problem (1 error, 0 warnings)
  ```
  The line was removed by Edit; `git status` shows `src/ui/due-text.ts` unmodified, and `npm run verify:wording` exits 0 again.

## T7.3 Trade Analysis: `expirationPayoff`

Behavioral; commit `c9b225e0`. 8 payoff cases plus the wording unit case and the wording-rule case, red then green. One first-run pass, flagged: case 5 (O-S short Lots give a falling segment), built by cases 2 and 4; mutation (Current view took each Lot's absolute quantity) failed with `AssertionError: expected { from: Rational{ …(2) }, …(3) } to match object …`. Wording conditions met (see "T7.3 wording checks"): `npx vitest run tools` exit 0 with `tools/wording-rules.test.ts` at 34 cases (33 before), and the planted run failed. Notes: `payoff.ts` declares a structural `PayoffPlan` to avoid a cycle with `plan.ts`; `assessPlan` returns `plannedPayoff` on every accepted Plan (stock: `NotApplicable(NoOptionExpirationAnchor)`); the `Unbounded` explanation string follows `evaluate.ts`'s existing pattern.

### ocr review of `c9b225e0`

Not yet run: both attempts failed before reviewing, with `subscription_sharing_usage_limit_exceeded` (the ChatGPT usage limit for `ocr`), session `8ce87597-02c7-43bc-a1da-ef451ed9d766`. Queued, to be rerun once the limit resets; the session continues meanwhile and any findings become bug tasks then.

Rerun 2026-11-06 after the limit reset (`ocr/T7.3-c9b225e0.json`), 2 comments, both dismissed:

| Finding | Assessment | Outcome |
|---|---|---|
| `payoff.ts:190` builds one curve from several option legs without checking they share an underlying and expiration | Doubtful, no reachable failure scenario | Dismissed: T7.3 says multiple expirations "cannot arise with one Planned Leg and arrive with D10"; a guard now would be speculative. |
| `payoff.ts:148` nested ternary in `covers` | Style, no failure scenario | Dismissed: equivalent code, no behavior change. |

### Cumulative run after T7.3 (`t7-3-payoff`, at `c9b225e0`)

Run by `suite-runner` on 2026-11-06, browser stage `browser-auto 4ff2885a`.

| Suite | Result | Output |
|---|---|---|
| Unit | 99 files, 1252 passed, exit 0 | `suite-runs/t7-3-payoff-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-3-payoff-integration.txt` |
| Browser (Chromium), full tier | 167 passed (7.9 min), exit 0 | `suite-runs/t7-3-payoff-browser.txt` |
| Static and verification checks | 13 of 13 exit 0 | `suite-runs/t7-3-payoff-checks.txt` |

Tier: full, printed reason "first matching path since 4ff2885a: src/ui/calculation-words.test.ts". Ports free before and after. T7.3 is complete apart from its queued ocr review.

## T7.4 wording checks

- `npx vitest run tools`: exit 0; Test Files 3 passed (3), Tests 52 passed (52). `tools/wording-rules.test.ts` now has 35 cases (34 after T7.3, plus one for the AfterExpiration and ContractQuantityNotWhole words and codes).
- `npm run verify:wording`: exit 0, no output beyond the command banner.
- Planted `export const PLANTED = " is dated after the contract's expiration";` at line 2 of `src/ui/due-text.ts` (uncommitted Edit): `npm run verify:wording` exit 1:
  ```
  /Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/src/ui/due-text.ts
    2:24  error  verify:wording: this is a reason's or finding's words. Word it through src/ui/calculation-words.ts, the only place that words a Calculation Result or branches on its reason code  no-restricted-syntax
  ✖ 1 problem (1 error, 0 warnings)
  ```
  The line was removed by Edit; `git status` shows `src/ui/due-text.ts` unmodified, and `npm run verify:wording` exits 0 again.

## T7.4 Trade Analysis: option Executions, short Lots, Entry Quality, position paths

Behavioral; commit `0ab70bfd` (a first attempt stopped before any change for missing finding words; decision 82, revision 49, supplied them). 5 derive cases plus two wording unit cases and one wording-rule case, red then green. One first-run pass, flagged: case 4 (position paths), built by case 2's role-aware signed replay; mutation (`available: open` → `available: quantity`) failed with `AssertionError: expected [ { factId: 'ex-pc-b3', …(2) } ] to deeply equal [ … ]`. Wording conditions met (see "T7.4 wording checks"): `npx vitest run tools` exit 0, `tools/wording-rules.test.ts` at 35 cases (34 before), planted run failed. Notes: `OpenLot.quantity` and `InstrumentPosition.quantity` are signed (short Lots negative); the refactor extended the role logic to the entry window, Entry Size deviations, leg fulfillment and incurred opening fees (short role proven by integration only). **For T7.16:** `netCostOf` still computes `quantity × price` without the multiplier ("Stock only"); decision 48's note gives T7.16 "Net cost carries the premium, and a credit shows as `$212.00 credit`".

### ocr review of `0ab70bfd`

Run 2026-11-06 after the limit reset (`ocr/T7.4-0ab70bfd.json`), 1 comment:

| Finding | Assessment | Outcome |
|---|---|---|
| `derive.ts` `netCostOf` omits the contract multiplier: O-C after X1 reads 2.55 for 190.65, O-S after B1 −0.60 for −124.35 | Valid | Bug task T7.4-B1, `2d2f7f44` (two `net-cost.test.ts` cases, red then green; multiplier on quantity × price, fee unmultiplied). ocr of `2d2f7f44`: no findings (`ocr/T7.4-B1-2d2f7f44.json`). |

### Cumulative run after T7.4 (`t7-4-option-derive`, at `0ab70bfd`)

Run by `suite-runner` on 2026-11-06, browser stage `browser-auto 5f721ba2`. The harness moved the browser stage to the background after 180 s; the runner finished the checks stage after it exited.

| Suite | Result | Output |
|---|---|---|
| Unit | 100 files, 1259 passed, exit 0 | `suite-runs/t7-4-option-derive-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-4-option-derive-integration.txt` |
| Browser (Chromium), full tier | 167 passed (8.1 min), exit 0 | `suite-runs/t7-4-option-derive-browser.txt` |
| Static and verification checks | 13 of 13 exit 0 | `suite-runs/t7-4-option-derive-checks.txt` |

Tier: full, printed reason "first matching path since 5f721ba2: src/ui/calculation-words.test.ts". Ports free before and after. T7.4 is complete apart from its queued ocr review.

## T7.5 wording checks

- `npx vitest run tools`: exit 0; Test Files 3 passed (3), Tests 53 passed (53). `tools/wording-rules.test.ts` now has 36 cases (35 after T7.4, plus one for the Expiration finding words and codes).
- `npm run verify:wording`: exit 0, no output beyond the command banner.
- Planted `export const PLANTED = ' names a stock, not an option';` at line 2 of `src/ui/due-text.ts` (uncommitted Edit): `npm run verify:wording` exit 1:
  ```
  /Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/src/ui/due-text.ts
    2:24  error  verify:wording: this is a reason's or finding's words. Word it through src/ui/calculation-words.ts, the only place that words a Calculation Result or branches on its reason code  no-restricted-syntax
  ✖ 1 problem (1 error, 0 warnings)
  ```
  The line was removed by Edit; `git status` shows `src/ui/due-text.ts` unmodified, and `npm run verify:wording` exits 0 again.

## T7.5 Trade Analysis: Expiration, Terminal Disposition, Option Disposition Timing

Behavioral; commit `f2eecbbb` (a first attempt stopped before any change for missing finding words; decision 83, revision 50, `c5e38a80`, supplied them). 4 `expiration.test.ts` cases plus one wording unit case and one wording-rule case, red then green. No first-run passes. Wording conditions met (see "T7.5 wording checks"): `npx vitest run tools` exit 0, `tools/wording-rules.test.ts` at 36 cases (35 before), planted run failed. Implementation decisions (the subagent's, recorded in section 7 of the handoff): `ExpirationFact` (no price, fee or side) in `PositionChangeFact.settlements`; Expirations replay through the FIFO loop as a price-0, fee-0 disposal; an Expiration Lot Match's `disposingExecutionId` holds the settlement's fact id; `atCutoff` filters settlements; "after every Execution" is strict; `record-position-change.ts` unchanged (`TerminalWithoutAgency` falls into its not-applicable branch). `optionDispositionTiming` is a Calculation Result: `NotClosed` for Open Trades, `NoOptionExpirationAnchor` for Closed stock Trades. Two test names lost their brackets because they break `-t` filtering; two `tdd-log.md` rows logged `red` for runs that matched no case are annotated as invalid. **For later tasks:** an Expiration close still owes a deferred Close Review with no Close Reason (A107), and the workflow treats `TerminalWithoutAgency` as non-terminal (T7.10, T7.13); `closedViaSale` in `src/ui/figures.ts` and `TradeList.tsx`'s "Closed via sale" are stock-only (UI tasks); `entryWindowOf` isn't cut by an Expiration Position Change (no case; left alone).

### ocr review of `f2eecbbb`

`ocr/T7.5-f2eecbbb.json`, 4 comments:

| Finding | Assessment | Outcome |
|---|---|---|
| `derive.ts:430` settlement fact ids skip the `seen` duplicate check; a clash turns Mixed into FullyHeldToExpirationSettlement | Valid | Bug task T7.5-B1, `74701796`: `DuplicateFactId` with the Expiration kind, worded with the decision-83 head and the existing tail ("… shares its identity with another record"); two cases red then green. ocr: no findings (`ocr/T7.5-B1-74701796.json`). |
| `derive.ts:472` a zero-quantity Expiration after a flat position passes and becomes terminal | Valid | Bug task T7.5-B2, `1e65a41b`: `NonpositiveQuantity` with the Expiration kind, head plus the existing tail ("… has a quantity that isn't positive"); two cases red then green. ocr: no findings (`ocr/T7.5-B2-1e65a41b.json`). |
| `derive.ts:437` an Expiration naming a different contract than the one held isn't rejected | Doubtful | Dismissed and flagged for the final report: Executions have the same single-queue behavior since D6 (no instrument-mismatch finding exists), it needs hand-built or corrupt facts, and a check would need a finding whose words the plan doesn't give; it belongs with D10's multi-leg replay. |
| `derive.ts:634-638` nested ternary for the timing classification | Style | Dismissed: readability only, branches correct against A108. |

The two bug tasks reuse approved words only (decision 83's head, the prefactor's tails), so no wording-list change and no new decision. T7.5-B1's subagent saw one unidentified unit failure in an ad-hoc `vitest run src tools`, not reproduced in two reruns or in the cumulative run below.

### Cumulative run after T7.5 (`t7-5-expiration`, at `1e65a41b`)

Run by `suite-runner` on 2026-11-06, browser stage `browser-auto c5e38a80`, covering T7.4-B1, T7.5, T7.5-B1 and T7.5-B2.

| Suite | Result | Output |
|---|---|---|
| Unit | 101 files, 1270 passed, exit 0 | `suite-runs/t7-5-expiration-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-5-expiration-integration.txt` |
| Browser (Chromium), full tier | 167 passed (8.3 min), exit 0 | `suite-runs/t7-5-expiration-browser.txt` |
| Static and verification checks | 13 of 13 exit 0 | `suite-runs/t7-5-expiration-checks.txt` |

Tier: full, printed reason "first matching path since c5e38a80: src/ui/calculation-words.test.ts". Ports free before and after. Browser stage 8 min 17 s, under the 9-minute threshold for raising tech debt item 6. T7.5 is complete.

### T7.6 wording checks

Commands run from the repository root after the `SettlementDue` code and the phrases `Settlement due` and `which expired` were added to `eslint.wording.config.js`, with the new case in `tools/wording-rules.test.ts` (the lists are what T7.6 touched).

| Command | Result |
|---|---|
| `npx vitest run tools/wording-rules.test.ts` before the task | exit 0; 36 passed (36); all of `tools` 53 passed |
| `npx vitest run tools/wording-rules.test.ts` after | exit 0; 37 passed (37) |
| `npx vitest run tools` after | exit 0; 3 files, 54 passed (54) |
| `npm run verify:wording` after | exit 0; no output |
| Planted run: `export const planted = 'Settlement due';` added by an Edit to `src/ui/format.ts` line 40, then `npm run verify:wording` | exit 1; `src/ui/format.ts 40:24 error verify:wording: this is a reason's or finding's words ...`, 1 problem |
| After restoring `src/ui/format.ts` by Edit: `git diff -- src/ui/format.ts` empty, `npm run verify:wording` | exit 0 |

## T7.6 Trade Analysis: `evaluate` for options and Settlement Due

Behavioral; commit `2bbaa51b`. 9 `evaluate-option.test.ts` cases plus two wording unit cases and one wording-rule case, red then green. Two first-run passes, flagged: case 4 (Stop Breached) passed first because its branch had been written during case 2, ahead of its red; the branch was backed out, a genuine red (`expected '180/1' to be '0/1'`) obtained and the branch restored (the invalid red row is annotated in `tdd-log.md`); case 6 (call Mark of exactly 0) was built by cases 1 and 2, mutation (`marked` treating a Mark of 0 as unusable) failed with `AssertionError: expected { kind: 'Unavailable', …(3) } to be '-4013/10'`. Wording conditions met (see "T7.6 wording checks"): `npx vitest run tools` exit 0 (54), `tools/wording-rules.test.ts` at 37 cases (36 before), planted run failed. `SettlementDue` worded with decision 81's words; `CODES` gains `SettlementDue`, `PHRASES` gains "Settlement due" and "which expired".

Implementation decisions (accepted by the main session as implementation-level): after the expiration date, only the Mark-dependent figures (valuation, P&L, Risk to Stop, Reward to Target, Worst-Case, Maximum, conditions, value at expiration) are `Unavailable(SettlementDue)`; facts (open quantity, cost, fees, realized, 1R) stay, which is how "every current figure" (A111's case) was read. Condition figures need both the contract's and the Underlying's Mark; the contract's reason wins when both are missing. `TradeEvaluationInput.underlyingFrame` (optional), `ObservationFrame.instrument` widened to `Instrument`; `settlement: SettlementItem[]`; `expirationValueAtUnderlyingClose`; `ConditionReading.underlying`; `openCost` multiplied. `observationRequirements` lists the contract then its Underlying, and neither after expiration. One passthrough case added in `src/coordinators/daily-review/attention.ts` to keep its exhaustive switch compiling (P67; T7.14 owns the settlement family). **For T7.24:** `PHRASES` holds the bare "Settlement due" case-insensitively, so the Review panel heading must take its words from `calculation-words.ts`. **For T7.14/T7.16:** the coordinators don't yet pass `underlyingFrame`.

### ocr review of `2bbaa51b`

`ocr/T7.6-2bbaa51b.json`, 2 comments:

| Finding | Assessment | Outcome |
|---|---|---|
| `derive.ts:657` no requirements after expiration leaves `reviewItem` without an Underlying frame, so Daily Review throws for an expired open option | Doubtful, unreachable until options are stored (T7.7) and the Review is wired (T7.14) | Dismissed as a carried note for T7.14: A111's `Historical(expirationDate)` request and the Review's settlement handling must supply the frame or avoid the lookup. |
| `evaluate.ts:278` `underlyingFrame` accepted without the instrument, date and cutoff guards the contract frame has | Doubtful, concrete at `evaluate`'s seam | Bug task T7.6-B1, `bcefef80`: a mismatched Underlying frame reads as `Unavailable(MarkMissing)` for the Underlying (the contract frame's `foreign` mechanism); three cases (symbol, date, cutoff) red then green, no new words. The reds ran the whole file through a quoting slip (exactly those three failed, before any production change); annotated in `tdd-log.md`. |

### Cumulative run after T7.6 (`t7-6-option-evaluate`, at `2bbaa51b`)

Run by `suite-runner` on 2026-11-06, browser stage `browser-auto 90139b59`.

| Suite | Result | Output |
|---|---|---|
| Unit | 102 files, 1281 passed, exit 0 | `suite-runs/t7-6-option-evaluate-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-6-option-evaluate-integration.txt` |
| Browser (Chromium), full tier | 167 passed (8.0 min), exit 0 | `suite-runs/t7-6-option-evaluate-browser.txt` |
| Static and verification checks | 13 of 13 exit 0 | `suite-runs/t7-6-option-evaluate-checks.txt` |

Tier: full, printed reason "first matching path since 90139b59: src/ui/calculation-words.test.ts". Ports free before and after. T7.6-B1 (`bcefef80`) came after this run and gets its own, below.

### Cumulative run after T7.6-B1 (`t7-6-b1-underlying-frame`, at `bcefef80`)

Browser stage `browser-auto 2bbaa51b`, task tier ("no changed path since 2bbaa51b is on the full-tier list"), 5 passed (11.8 s). Integration 154 passed; checks 13 of 13. **Unit: 1 failed of 1284**: `src/ui/screens/TradeList.test.tsx` › "Closed list paging (T6.18-B1)" › "should move focus to the empty message when a cursor-expired reload finds no closed trades", `AssertionError: expected <body>… to be <p tabindex="-1">` (`suite-runs/t7-6-b1-underlying-frame-unit.txt`, about line 1296). Rerun alone: passed. Not tech debt item 11's case (the Open list's Ready mark at line 125).

### T7.6-F1: the Closed list's focus assertions wait for the focus effect

Suite-failure fix, commit `f058e165`, test only. Mechanism: `ClosedList` moves focus in a passive `useEffect` after the commit that shows the empty message, status line or new row, and three cases read `document.activeElement` straight after `findBy…`, so under load the read can come first. Shown with a temporary uncommitted `setTimeout(…, 20)` in the refreshed-branch focus: three cases failed, the empty-message one with the suite's error. Fix: the three positive focus assertions (append, refreshed status line, empty message) use `await waitFor(...)`; with the delay re-applied all 8 cases of the describe passed; mutation reverted, `git diff -- src` empty. Verification: the file 10 times sequentially (9 passed 35/35, one run failed 1 of 35, case not captured), then 15 sequential and 24 concurrent runs, all 35/35; the main session looped the file 20 more times, all 35/35. Not changed: the synchronous keyboard-focus assertions (lines 43, 46, 48) and the "focus stays where the trader moved it" assertions (about 471, 486, 493), which a `waitFor` would pass trivially. The one uncaptured failure (and T7.5-B1's unidentified one) may be tech debt item 11's case; its trigger is a cumulative-run failure of that case, which hasn't happened.

### Cumulative run after T7.6-F1 (`t7-6-f1-closed-list-focus`, at `f058e165`)

Run by `suite-runner` on 2026-11-06, browser stage `browser-auto 2bbaa51b`, covering T7.6-B1 and T7.6-F1.

| Suite | Result | Output |
|---|---|---|
| Unit | 102 files, 1284 passed, exit 0 | `suite-runs/t7-6-f1-closed-list-focus-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-6-f1-closed-list-focus-integration.txt` |
| Browser (Chromium), full tier | 167 passed (7.9 min), exit 0 | `suite-runs/t7-6-f1-closed-list-focus-browser.txt` |
| Static and verification checks | 13 of 13 exit 0 | `suite-runs/t7-6-f1-closed-list-focus-checks.txt` |

Tier: full, printed reason "first matching path since 2bbaa51b: src/ui/screens/TradeList.test.tsx". Ports free before and after. ocr of `bcefef80` (T7.6-B1): no findings (`ocr/T7.6-B1-bcefef80.json`). `f058e165` is test-only, so ocr (which excludes test files) has nothing to review. T7.6 is complete.

## T7.25

Tagged B6.6 (`e2e/d6/update.spec.ts`) `{ tag: '@release-history' }` on its `test.describe`, as B2.3, B2.5, B4.7 and B5.6 are. Assertions unchanged; no `d6` release folder built (decision 76).

- `npm run test:e2e -- --list`: exit 0, `Total: 166 tests in 59 files` (167 in 60 files before); no line names B6.6.
- `npx playwright test e2e/d1 e2e/d2 e2e/d4 e2e/d5 e2e/d5r e2e/d6 --list --grep @release-history`: exit 0, `Total: 5 tests in 4 files`: B2.3 (d2/migration.spec.ts:48), B2.5 (d2/migration.spec.ts:123), B4.7 (d4/update.spec.ts:6), B5.6 (d5/update.spec.ts:7), B6.6 (d6/update.spec.ts:9).

Run early (the handoff, section 3: T7.25 needs nothing): T7.7's cumulative run failed only B6.6, whose About assertion expects schema 5 and now reads 6. Commit `ca194099`, test only. ocr (relocated under `src/itg/d07/` in a scratch clone): no findings (`ocr/T7.25-ca194099.json`). T7.6-F1's test-only `f058e165` was reviewed the same way afterwards, also with no findings (`ocr/T7.6-F1-f058e165.json`); the note above that it had nothing to review was wrong, since the handoff requires the relocated review.

## T7.7 Persistence: schema v6

Behavioral; commit `668378bd`. A first attempt stopped before any change: schema 5 already stores the tagged `{ kind: 'Stock', symbol }`, and the domain Stock Instrument has no multiplier, so A118's "rewrite as Stock with multiplier 1" forced a choice; the user chose the identity transform (decision 84, revision 51, `72797dc5`). Two `schema-v6.test.ts` cases, red then green: case 1 red `inspectRoot` reported version 5; case 2 red `Error: No migration from schema 5`. No first-run passes. `SCHEMA_VERSION` 6; `v5-to-v6.ts` drops private fields only, like `v2-to-v3.ts`. Version expectations moved to 6 in `candidate.test.ts`, `persistence.test.ts`, `schema-v3/v4/v5.test.ts` (test names unchanged), `workspace.test.ts`, `migration.test.ts` (receipts `toVersion` 6; the newer-schema case now seeds 7) and `tests/integration/d2`, `d4`, `d5`, `d6` (`migration.test.ts`, `seed.test.ts`). `verify:fixtures`: v1–v5 migrate to 6 with views equal to their snapshots; no `dump.json` or `expected-views.json` touched. `verify:capacity` fails ("basis measured at schema version 5, current is 6"), expected until T7.26, as D5 (T5.1–T5.19) and D6 (until T6.22) carried it. `verify:releases` failed in the subagent's run only because `dist-releases/d6` (built from the current source) predated the bump; it passes after the browser stage rebuilds it. **For T7.17:** some integration test names in d2, d4, d5, d6 still say "schema 5".

### ocr review of `668378bd`

No findings (`ocr/T7.7-668378bd.json`).

### Cumulative run after T7.7 (`t7-7-schema-v6`, at `668378bd`)

Browser stage `browser-auto 72797dc5`, full tier ("first matching path since 72797dc5: src/persistence/candidate.test.ts"). Unit 103 files, 1286 passed; integration 154 passed; browser 1 failed, 166 passed (8.2 min): B6.6 (`e2e/d6/update.spec.ts:9`), `Schema version` expected "5", got "6", failed the same way rerun alone; fixed by tagging it under T7.25 (above). Checks 12 of 13, `verify:capacity` expected. Outputs `suite-runs/t7-7-schema-v6-*.txt`.

### Cumulative run after T7.25 (`t7-25-release-history`, at `ca194099`)

Run by `suite-runner` on 2026-11-06, browser stage `browser-auto 72797dc5`, covering T7.7 and T7.25.

| Suite | Result | Output |
|---|---|---|
| Unit | 103 files, 1286 passed, exit 0 | `suite-runs/t7-25-release-history-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-25-release-history-integration.txt` |
| Browser (Chromium), full tier | 166 passed (7.9 min), exit 0 | `suite-runs/t7-25-release-history-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-25-release-history-checks.txt` |

Tier: full, printed reason "first matching path since 72797dc5: e2e/d6/update.spec.ts". Ports free before and after. T7.7 and T7.25 are complete.

## T7.8 Market Data: option keys and Marks

Behavioral; commit `da4f2587`. Three cases, red then green: Marks of 0 for `XYZ261120C00055000` and XYZ stock with −0.01 rejected (red: the OCC key failed the stock-symbol check with `InvalidInstrument`); `AfterExpiration` for a contract Mark dated 2026-11-23 (red: `Saved`; the code had first been written ahead of the red, was backed out for a genuine red and restored, flagged); `Historical(2015-01-17)` returns `NotASession` carrying 2015-01-16 and its close (red: no `latestSession`). No first-run passes. P27 needed no D4 test change: Market Data already accepted a Mark of 0 (`market-data.test.ts:333` saves 0.00) and rejected only negatives. Existing expectations extended with `latestSession`: `query.test.ts` (Saturday 2026-10-10), `tests/integration/d4/policy-revision.test.ts` (Tuesday 2026-10-13), `src/coordinators/workspace/migration.test.ts:706` (2026-10-14). Decisions: a key is well formed if it is a stock symbol or `instrumentOf` parses it as an Option with a real expiration; `AfterExpiration` (field `tradingDate`) needs a well-formed date after the expiration; `NotASession` carries `latestSession { tradingDate, closeInstant }` only for `Historical`, and only where the session policy covers the previous session. **For T7.11:** the section validator still treats an option key as an unknown stock symbol. **For T7.14:** a non-session `Historical(expirationDate)` is `Rejected` with `issues[0].latestSession`; calendar coverage is 2024–2028, so a pre-2015 date gives `SessionPolicyCoverage`. **For the Marks panel (UI tasks):** Market Data's `AfterExpiration` needs words the plan doesn't give; raise when that task reaches it.

### ocr review of `da4f2587`

No findings (`ocr/T7.8-da4f2587.json`).

### Cumulative run after T7.8 (`t7-8-option-marks`, at `da4f2587`)

Run by `suite-runner` on 2026-11-06, browser stage `browser-auto 76588e6d`.

| Suite | Result | Output |
|---|---|---|
| Unit | 103 files, 1289 passed, exit 0 | `suite-runs/t7-8-option-marks-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-8-option-marks-integration.txt` |
| Browser (Chromium), task tier | 5 passed (12.5 s), exit 0 | `suite-runs/t7-8-option-marks-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-8-option-marks-checks.txt` |

Tier: task, printed reason "no changed path since 76588e6d is on the full-tier list". Ports free before and after. T7.8 is complete.

## T7.9 Reference Catalog: option Strategies

Behavioral; commit `e82f155f`. Two `option-strategies.test.ts` cases, red then green (case 1 against a temporary version-2 stub manifest so the red was an assertion; case 2 red: `query` sorted Cash-Secured Put first). No first-run passes. `D7_CATALOG_MANIFEST` (version 3): Long Stock, then `strategy.long-call` Long Call, `strategy.long-put` Long Put, `strategy.cash-secured-put` Cash-Secured Put, one role each (`ratio: 1`; Long Call, Long Put, Short Put), D6's close reasons; a v2-seeded Catalog gains exactly three Strategies and a second run adds nothing. No stored-record change beyond the three Strategy records. To meet case 2's "in seed order" the commit made `query` rank Strategies by manifest position, which departs from the spec's Query rule ("deterministic label/identity order", `specs/design/reference-catalog.md`). The main session asked; the user chose the spec's order (decision 85, revision 52, `274f853d`).

Notes: A101's Cash-Secured Put "description" (the application doesn't verify cash coverage) has no field on Strategy records and the spec states it as a product claim, not a stored description; it is left to the Plan form's UI wording (T7.19). **For T7.17/I7.14:** `workspace.ts` (lines 301, 313, 324, 335, 355) and `migration.ts` (129, 144) still seed `D6_CATALOG_MANIFEST`, as do `record-position-change.test.ts`, `closed-views.test.ts`, `tests/support/closed-trade-review-fixture.ts` and `e2e/d2/migration.spec.ts`; a fresh Workspace shows only Long Stock until then.

### T7.9-F1: `query` keeps label/identity order (decision 85)

Commit `d9fbbedb`. Case 2 amended to "in label order" (Cash-Secured Put, Long Call, Long Put, Long Stock), red against the seed-order code, green after `compareForSelection` was restored to its pre-`e82f155f` form (`STRATEGY_SEED_ORDER` and the `D7_CATALOG_MANIFEST` import removed). Case 1 unchanged and green. One uncaptured unit failure in the subagent's first combined run ("1 failed | 1288 passed (1289)", fewer tests collected than the 1291 of later runs), not reproduced in four reruns or the cumulative run. **For the Strategy picker:** `query` lists by label; a picker wanting seed order sorts by manifest position itself.

### ocr reviews of `e82f155f` and `d9fbbedb`

`ocr/T7.9-e82f155f.json`, 2 comments: "`D7_CATALOG_MANIFEST` not used by production seeding" — dismissed (Wrong for T7.9: the wiring is T7.17's, whose seam is the Workspace); "seed-order comparator contradicts decision 85" — superseded by `d9fbbedb`. `ocr/T7.9-F1-d9fbbedb.json`: no findings.

### Cumulative run after T7.9-F1 (`t7-9-option-strategies`, at `d9fbbedb`)

Run by `suite-runner` on 2026-11-07, browser stage `browser-auto 0042b80b`.

| Suite | Result | Output |
|---|---|---|
| Unit | 104 files, 1291 passed, exit 0 | `suite-runs/t7-9-option-strategies-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-9-option-strategies-integration.txt` |
| Browser (Chromium), task tier | 5 passed (11.4 s), exit 0 | `suite-runs/t7-9-option-strategies-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-9-option-strategies-checks.txt` |

Tier: task, printed reason "no changed path since 0042b80b is on the full-tier list". Ports free before and after. T7.9 is complete.

## T7.10 Trade Record: option facts and Expiration

Behavioral; commit `0ab541ba`. Three `option-record.test.ts` cases. Case 1 (ConfirmPlan for an option) was a first-run pass, flagged: `prepareChange` already spreads the Plan fact value and stores legs and conditions as submitted, and T7.7 left the Instrument tagged; only the optional `exerciseIntent` types were added; mutation (destructuring `exerciseIntent` out of the plan in `prepareChange`) failed with `AssertionError: expected { …(4) } to deeply equal ObjectContaining{…}`. Case 2 (Expiration) red: no Expiration member; green after the change. Case 3 (`getRecord`) first passed because its `analysisInputOf` branch had been written during case 2; backed out for a genuine red (`positionChanges` missing the Expiration member), restored, green; the invalid row is annotated in `tdd-log.md`.

Stored shapes (implementation decisions, accepted by the main session as following A106 and A118): `TradeFact` kind `'Expiration'`, value `{ economicTime, instrument, quantity }`, in `TradeDocument.facts` beside Executions with a single-version list, its own `recordedSequence`, and listed in its Position Change's `memberIds`; no price, fee or Close Reason. `PlanFactValue.exerciseIntent?: 'Authorized' | 'NotAuthorized'`. Change input `PositionChangeChange.expiration?` with `executions: []`. `analysisInputOf` projects the member into `PositionChangeFact.settlements`. No new store, index or private field. Indexes: `byLifecycle` and `byLifecycleActivity` are vacated by the existing `vacateIndexKey` staging on the Open→Closed move (asserted); `byLifecycleTerminal` gains the Closed entry (an Open Trade had none); `terminalTime` equals the settlement time; only `trades` and `meta` are written. **For T7.11:** treat the `Expiration` fact kind as known. **For T7.12:** pass `exerciseIntent` in `ConfirmPlanChange.plan`. **For T7.13:** build `{ executions: [], expiration: { economicTime, instrument, quantity } }` with `expectedLifecycle: 'Closed'` and no `closeReasonId`; the workflow owns the Expiration rules and the no-mixing rule.

### ocr review of `0ab541ba`

No findings (`ocr/T7.10-0ab541ba.json`).

### Cumulative run after T7.10 (`t7-10-trade-record`, at `0ab541ba`)

Run by `suite-runner` on 2026-11-07, browser stage `browser-auto 6a3a7d15`.

| Suite | Result | Output |
|---|---|---|
| Unit | 105 files, 1294 passed, exit 0 | `suite-runs/t7-10-trade-record-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-10-trade-record-integration.txt` |
| Browser (Chromium), task tier | 5 passed (10.2 s), exit 0 | `suite-runs/t7-10-trade-record-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-10-trade-record-checks.txt` |

Tier: task, printed reason "no changed path since 6a3a7d15 is on the full-tier list". Ports free before and after. T7.10 is complete.

## T7.11 Section validators: Trade Record, Catalog, Market Data

Behavioral, restarted on decisions 86, 88 and 90 (base `0a249bfe`; an earlier restart was stopped by the user and its uncommitted changes discarded). Refactor `50252abf` (before any red): `src/domain/strategy/` holds `StrategyShape`, `StrategyRole`, `ShapedLeg`, `matchesShape`, `sameShape` and `exerciseIntentApplies`; `assessPlan` decides Exercise Intent with `exerciseIntentApplies`, `prepareSeed` and the Catalog use `sameShape`. Feature `abf65522`, three cases, each with a genuine red (Trade: assertion, new codes missing; Catalog: `TypeError`, `strategyShapes` missing; Market Data: assertion, `AfterExpiration` missing; its Mark-0 and `PriceNegative` assertions already held from T4.13). New Trade codes `PlanShapeMismatch`, `ExerciseIntentRequired`, `ExerciseIntentNotApplicable`, `CloseReasonNotApplicable`, `ExpirationHasPriceOrFee`; Catalog `StrategyShapeMismatch`; Market Data `AfterExpiration`; six `MIGRATION_ISSUES` sentences from rows 11.1, 11.2, 11.4 and decision 86. `TradeSectionReferences.strategyShapes` is required (fixtures that build Trade section references must supply it); `migration.ts` needed no edit (it spreads the Catalog's references). A mismatched Plan reports only `PlanShapeMismatch` and skips the Exercise Intent checks, as `assessPlan` does. The Market Data validator never treated OCC keys as unknown symbols (it checks none), so only `AfterExpiration` was added.

### ocr review of `63e18213..abf65522`

No findings (`ocr/T7.11-abf65522.json`).

### Cumulative run after T7.11 (`t7-11-section-validators`, at `abf65522`)

Browser stage `browser-auto 0a249bfe`, full tier ("first matching path since 0a249bfe: src/ui/readiness-copy.ts"). Unit 1297 passed; integration 154 passed; browser 4 failed, 162 passed (9.2 m): B2.12 (`e2e/d2/responsive-a11y.spec.ts:90`, `:179`), B4.13 (`e2e/d4/…:118`), B6.12 (`e2e/d6/…:28`), each expecting a load Error state that no longer appeared; checks 12 of 13 (`verify:capacity`, expected until T7.26). Reproduced `e2e/d2/responsive-a11y.spec.ts:90` alone in the main session.

### T7.11-F1 a Position Change naming a missing member fails the read again

Suite-failure fix, commit `7c4a7bfd`. Root cause in T7.10 (`0ab541ba`), not T7.11: `analysisInputOf` changed `memberIds.map((id) => executions.get(id)!)` to `flatMap((id) => executions.get(id) ?? [])`, silently dropping a missing member, so D2's integrity fault no longer failed the read. The fixture was right. Reproducing case in `option-record.test.ts` ("should refuse to build the analysis input rather than drop the missing member"), red `AssertionError: expected [Function] to throw an error`, green after `analysisInputOf` throws on a member that is neither an Execution nor an Expiration. The subagent's `npm run build:releases` was denied by the auto-mode classifier, so it could not refresh `dist-releases/d6` for B4.13 and B6.12; the cumulative run's browser stage rebuilds it.

ocr review of `7c4a7bfd`: no findings (`ocr/T7.11-F1-7c4a7bfd.json`).

### Cumulative run after T7.11-F1 (`t7-11-f1-missing-member`, at `7c4a7bfd`)

Run by `suite-runner` on 2026-11-07, browser stage `browser-auto 0a249bfe`.

| Suite | Result | Output |
|---|---|---|
| Unit | 108 files, 1298 passed, exit 0 | `suite-runs/t7-11-f1-missing-member-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-11-f1-missing-member-integration.txt` |
| Browser (Chromium), full tier | 166 passed (8.1 m), exit 0 | `suite-runs/t7-11-f1-missing-member-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-11-f1-missing-member-checks.txt` |

Tier: full, printed reason "first matching path since 0a249bfe: src/ui/readiness-copy.ts". Ports free before and after. The runner notes the full browser stage (8.1 m) is near the 10-minute Bash limit. T7.11 is complete.

## T7.12 Trade Workflows: `confirmPlan` for options

Behavioral; commit `d04d91ed` (test only, `confirm-plan-options.test.ts`). **Both cases were first-run passes, flagged:** `confirmPlan` already resolved the Strategy once, passed its shape and `economicTime` to `assessPlan` (T7.2-B2) and aggregated Catalog, Journal and Trade Analysis issues (D1). Case 1's first red was a fixture error (expected "2.00", stored canonical "2"), annotated as invalid. Mutation checks: case 1, `confirmPlan` passing `exerciseIntent: 'Authorized'` failed with `AssertionError: expected 'Authorized' to be 'NotAuthorized'`; case 2, pushing `assessPlan` issues only when no other issue exists failed with `AssertionError: expected [ { …(3) }, …(1) ] to deeply equal ArrayContaining{…}`. The test seeds `D7_CATALOG_MANIFEST` itself and finds Long Call by product key; production seeding is unchanged (T7.17).

### T7.12-B1 the accepted result carries the payoff views

Defect from the subagent's summary: case 1 says `confirmPlan` returns "the Planned payoff view", and `specs/design/trade-workflows.md` line 200 has every accepted result carry the post-commit state the workflow needs (T7.19 renders the Planned payoff "from the result"), but the result had no payoff and the test computed it itself. Commit `f9b2eeaa`: case 1 reads `result.postCommit.payoff.planned`; red `TypeError: Cannot read properties of undefined (reading 'planned')`, green after `confirmPlan` returns `payoff: ExpirationPayoffs` (`planned`, `current`) from `expirationPayoff({ plan })`. A Long Stock Plan returns both views `NotApplicable(NoOptionExpirationAnchor)`. **For T7.19:** read `postCommit.payoff.planned`.

### ocr review of `045ca82f..f9b2eeaa`

No findings (`ocr/T7.12-f9b2eeaa.json`).

### Cumulative run after T7.12-B1 (`t7-12-confirm-plan`, at `f9b2eeaa`)

Run by `suite-runner` on 2026-11-07, browser stage `browser-auto 045ca82f`.

| Suite | Result | Output |
|---|---|---|
| Unit | 109 files, 1300 passed, exit 0 | `suite-runs/t7-12-confirm-plan-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-12-confirm-plan-integration.txt` |
| Browser (Chromium), task tier | 5 passed (12.4 s), exit 0 | `suite-runs/t7-12-confirm-plan-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-12-confirm-plan-checks.txt` |

Tier: task, printed reason "no changed path since 045ca82f is on the full-tier list". Ports free before and after. T7.12 is complete.

## T7.13 Trade Workflows: `recordPositionChange` for options and Expiration

Behavioral; commit `8c72420c`, five cases in `record-position-change-options.test.ts`. Genuine reds: S1/B1 on O-S (`VariantNotInstalled` where `Recorded` was expected), E1 commit (`StorageFailure TypeError`), and the analysis-issues case (`IntegrityDisagreement`; its production code had been written ahead, backed out for the genuine red, restored). **First-run passes, flagged:** the Close Reason on a flat Buy to close (built by D6's `closeRequirementIssues`; mutation "never emit `CloseReasonRequired`" failed with `AssertionError: expected [ { source: 'TradeWorkflows', …(2) } ] to deeply equal [ …(2) ]`), and the Close Reason on E1 / mixed members case (built in the E1 case; mutation of the `CloseReasonNotApplicable` half only failed with `AssertionError: expected { kind: 'Recorded', …(3) } to deeply equal ObjectContaining{…}`; the `MixedMembers` half was not mutation-checked). Public types: `ExpirationMember`, `PositionChangeCommand.members` admits it, `PositionChangeMember.instrument` is the full `StockInstrument | OptionInstrument`, `UninstalledVariant` gains `MixedMembers`. A terminal Expiration owes a Close Review disposition (`CloseReviewDispositionRequired`) and no Close Reason. One T6 fixture line moved from a loose Option shape to a full contract.

### ocr review of `8c72420c`

`ocr/T7.13-8c72420c.json`, 2 comments, both Valid: (1) the same-contract guard checked only Executions, so an Expiration naming another contract with the same quantity closed the position; (2) `ContractQuantityNotWhole` and `AfterExpiration` were missing from `OWN_FINDINGS`, so a fractional or post-expiry option Execution returned `IntegrityDisagreement` instead of a member-scoped rejection (A102).

### T7.13-B1 an Expiration naming another contract is rejected

Commit `75384559`. Case "should reject an Expiration naming a contract other than the held one (another strike, another expiration) with VariantNotInstalled OtherInstrument, writing nothing"; red `AssertionError: expected { kind: 'Recorded', …(3) } to deeply equal { kind: 'VariantNotInstalled', …(1) }`, green after the guard compares an option Expiration's `instrumentKey` with the Plan's leg Instruments. A non-option Expiration still reaches analysis (`NotAnOption`). **For the final report:** with several option legs (D10), an Expiration naming another leg's contract than the one held would still pass this guard.

### T7.13-B2 option Execution errors are member-scoped

Commit `9e980a06`. Case "should reject an option Execution of a fractional quantity with ContractQuantityNotWhole and one dated after the contract's expiration with AfterExpiration, each on its member, writing nothing"; red `IntegrityDisagreement` where `Rejected` was expected, green after `OWN_FINDINGS` maps `ContractQuantityNotWhole` to `quantity` and `AfterExpiration` to `economicTime`.

ocr review of `8c72420c..9e980a06`: no findings (`ocr/T7.13-B1-B2-9e980a06.json`).

### Cumulative run after T7.13-B2 (`t7-13-position-change`, at `9e980a06`)

Run by `suite-runner` on 2026-11-07, browser stage `browser-auto 640b42bf`.

| Suite | Result | Output |
|---|---|---|
| Unit | 110 files, 1307 passed, exit 0 | `suite-runs/t7-13-position-change-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-13-position-change-integration.txt` |
| Browser (Chromium), task tier | 5 passed (10.0 s), exit 0 | `suite-runs/t7-13-position-change-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-13-position-change-checks.txt` |

Tier: task, printed reason "no changed path since 640b42bf is on the full-tier list". Ports free before and after. T7.13 is complete.

## T7.14 Daily Review: `open` with the settlement family

Behavioral; stopped once before any change on a contradiction in case 3 (Monday: "XYZ's task names T-1 and T-2" against A110), resolved by the user as decision 91 (revision 56, `9443ae15`): "XYZ's task names T-2 only". Commit `8fd242ae`, three cases in `settlement.test.ts`. Reds: case 1 `expected ['Marks','Trades'] to deeply equal ['Marks','Settlement','Trades']`; case 2 (after backing out a `SettlementDue` reason line written ahead) the reasons lacked the settlements; case 3 first passed because the expired-option fallback frame was written in case 1, backed out to a throw for a genuine red (`Error: Market Data returned no frame for XYZ`), restored, green (annotated in `tdd-log.md`). Public types: `ReviewFamily` gains `Settlement` (between Marks and Trades, omitted when empty) with `SettlementItem { tradeId, instrument, quantity (signed), expiration, settlementTime }`; `IncompleteReason` and `AttentionReason` gain `SettlementDue` (Blocker band). Mark rows and `observationNeeds` key by `instrumentKey`; `observationFrame` derives the Instrument from the frame's key. `review-attention.ts` has a temporary wordless `default: return ''` for `SettlementDue`, for T7.24 to word. A `src/ui` mark-count assertion (`tj:open-list-ready`) failed once in a combined subagent run and passed alone (flaky; flagged for the final report).

### ocr review of `8fd242ae`

`ocr/T7.14-8fd242ae.json`, 3 comments, all real but owned by planned later tasks, so no bug task: (1) `getTrade`'s `figuresOf` throws "Market Data returned no frame for MNO" for an expired option with no stock Trade on its Underlying (T-3 on Monday) — **carried to T7.15** (`getTrade` with Settlement Due), whose brief names the Monday case; (2) `riskRewardOf` uses a stock formula for options — T7.33 (decision 88); (3) the empty `SettlementDue` attention line — the documented stub, T7.24.

### Cumulative run after T7.14 (`t7-14-review-settlement`, at `8fd242ae`)

Run by `suite-runner` on 2026-11-07, browser stage `browser-auto 5086f888`.

| Suite | Result | Output |
|---|---|---|
| Unit | 111 files, 1310 passed, exit 0 | `suite-runs/t7-14-review-settlement-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-14-review-settlement-integration.txt` |
| Browser (Chromium), full tier | 166 passed (8.2 m), exit 0 | `suite-runs/t7-14-review-settlement-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-14-review-settlement-checks.txt` |

Tier: full, printed reason "first matching path since 5086f888: src/ui/screens/review-attention.ts". Ports free before and after. T7.14 is complete.

## T7.15 Daily Review: `getTrade` with Settlement Due and payoff

Behavioral; commit `f70e9aea`, two cases in `settlement.test.ts`: T7.15's planned case, plus one carried from T7.14's ocr finding 1 (T-3's card at Monday 17:00 without an MNO frame). Reds: case 1 `TypeError: Cannot read properties of undefined (reading 'map')` (no `settlement` on the card); case 2 `Error: Market Data returned no frame for MNO`. No first-run passes. Public types: `PanelProgress` gains `Settlement` (between Reflections and Action, only while an item exists, never done while due); `DailyTradeReview` gains required `settlement` and optional `payoff: ExpirationPayoffs` (stock Trades get both views `NotApplicable(NoOptionExpirationAnchor)`). Five UI test fixtures gained `settlement: []` for the typecheck. **For later tasks:** the card has no separate route field (items carry the contract and settlement time); with an Underlying frame, an option card's `frame` is the Underlying's and `datedLineOf` still builds a Stock Instrument from it, so an option card's `datedLastClose` is not option-correct (T7.24, convention C6 and K18).

### ocr review of `f70e9aea`

No findings (`ocr/T7.15-f70e9aea.json`).

### Cumulative run after T7.15 (`t7-15-review-card`, at `f70e9aea`)

Run by `suite-runner` on 2026-11-07, browser stage `browser-auto a94c536a`. The runner first returned before the browser stage finished and was told to wait for it.

| Suite | Result | Output |
|---|---|---|
| Unit | 111 files, 1312 passed, exit 0 | `suite-runs/t7-15-review-card-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-15-review-card-integration.txt` |
| Browser (Chromium), full tier | 166 passed (7.9 m), exit 0 | `suite-runs/t7-15-review-card-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-15-review-card-checks.txt` |

Tier: full, printed reason "first matching path since a94c536a: src/ui/screens/CardMarks.test.tsx". Ports free before and after. T7.15 is complete.

## T7.33 Daily Review: pressure and range position for options

Behavioral (decision 88); commit `515311ea`, three cases in `option-attention.test.ts`, each asserting the walked Trade's basis and range position and the card's range position. Reds: case 1 basis assertion (old formula); case 2 `NotApplicable` instead of a Value (no multiplier); case 3 wrong side (the `mark < averageCost` rule picked Losing). The production change was written after case 1's red, ahead of cases 2 and 3; it was reverted for genuine reds and restored (noted in `tdd-log.md`). No first-run passes. D4, D5 and D5R stock pressure and range-position cases pass with no expectation edited. "Now" figures reuse `evaluate`'s `ongoingRiskToStop` and `incrementalRewardToTarget`; at-entry figures use the Plan's measurement values with each open Lot's cost (`evaluate`'s `atEntry` covers only Lots after the latest exact Mark). When no consumed share is positive: `NotApplicable(NonPositiveAtEntry)` if the value moved toward a side whose at-entry figure isn't positive, else a None-side Value with share 0.

### ocr review of `515311ea`

No findings (`ocr/T7.33-515311ea.json`).

### Cumulative run after T7.33 (`t7-33-option-pressure`, at `515311ea`)

Run by `suite-runner` on 2026-11-07, browser stage `browser-auto 6530186f`.

| Suite | Result | Output |
|---|---|---|
| Unit | 112 files, 1315 passed, exit 0 | `suite-runs/t7-33-option-pressure-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-33-option-pressure-integration.txt` |
| Browser (Chromium), task tier | 5 passed (12.6 s), exit 0 | `suite-runs/t7-33-option-pressure-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-33-option-pressure-checks.txt` |

Tier: task, printed reason "no changed path since 6530186f is on the full-tier list". Ports free before and after. T7.33 is complete.

## T7.16 Trade Views: option lists and Detail

Behavioral; commit `ee1e3dfd`, three cases in `option-views.test.ts`, each with a genuine red (no `settlement`; no `optionDispositionTiming`; a Stock-kind summary on the Planned row). No first-run passes. Shared `src/coordinators/settlement.ts` now holds `settlementTimeOf`, `payoffOf` and `SettlementItem`, used by Daily Review and Trade Views. `TradeSummary` gains an `Option` arm (direction, contracts, expiration, strike, right); Open and Closed Detail gain `settlement` (Due items only) and `payoff`; Closed Detail and rows gain `optionDispositionTiming` for option Trades; `PlannedTradeDetail.plan` gains `exerciseIntent`; `OpenTradeItem.openQuantity` is the signed open-lot sum (identical for stock). Trade Views requests the contract and Underlying frames together; the option dated line is skipped (`datedLineOf` is Stock-only). **Temporary rule:** `tradeSummary` in `src/ui/format.ts` throws for an Option summary until T7.23 words it. **For T7.23:** "expires 2026-11-20" from `current.evaluation.settlement[].expiration` (`NotYetDue`); "via … and expiration" from `terminalDisposition` mechanisms; value at expiration from `current.evaluation.expirationValueAtUnderlyingClose`; the Planned Detail carries no `payoff` yet.

### ocr review of `ee1e3dfd`

`ocr/T7.16-ee1e3dfd.json`, 2 comments: (1) Valid — `closedItem` returns `optionDispositionTiming` but `ClosedTradeItem` doesn't declare it (bug task B1); (2) Doubtful, **dismissed** — `tradeSummary` throws for an Option summary: it is the planned temporary rule, T7.23's scope, and no screen reaches it before the option forms (T7.19) except a restored backup holding an option Trade.

### T7.16-B1 `ClosedTradeItem` declares `optionDispositionTiming`

Commit `bb6c69ab`. Type-only defect: a typed read in `option-views.test.ts`; red `npm run typecheck` TS2339 "Property 'optionDispositionTiming' does not exist on type 'ClosedTradeItem'" (a compile-time red, noted in `tdd-log.md`), green after the optional field is declared (`IncoherentClosedTradeItem` inherits it through its `Omit`). ocr review: no findings (`ocr/T7.16-B1-bb6c69ab.json`).

### Cumulative run after T7.16-B1 (`t7-16-option-views`, at `bb6c69ab`)

Run by `suite-runner` on 2026-11-07, browser stage `browser-auto b5fb3e75`.

| Suite | Result | Output |
|---|---|---|
| Unit | 113 files, 1318 passed, exit 0 | `suite-runs/t7-16-option-views-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-16-option-views-integration.txt` |
| Browser (Chromium), full tier | 166 passed (7.9 m), exit 0 | `suite-runs/t7-16-option-views-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-16-option-views-checks.txt` |

Tier: full, printed reason "first matching path since b5fb3e75: src/ui/format.ts". Ports free before and after. T7.16 is complete.

## T7.34 Long Stock by product key in helpers and tools

- `grep -rn "strategies.items\[0\]" src tools tests e2e`: no output (exit 1).
- `npm run test:unit`: 116 files, 1372 tests passed. `npm run test:integration`: 76 files, 154 tests passed.
- `npx playwright test e2e/d1/no-save.spec.ts`: 1 passed (selects "Long Stock" by label).
- `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run verify:fixtures`: all exit 0.

### ocr review of `b9c52d41`

No findings (`ocr/T7.34-b9c52d41.json`).

### Cumulative run after T7.34 (`t7-34-long-stock-key`, at `b9c52d41`)

Run by `suite-runner` on 2026-11-07, browser stage `browser-auto 1ee7aa39`. The runner returned twice before its browser stage finished and was resumed each time.

| Suite | Result | Output |
|---|---|---|
| Unit | 113 files, 1318 passed, exit 0 | `suite-runs/t7-34-long-stock-key-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7-34-long-stock-key-integration.txt` |
| Browser (Chromium), full tier | 166 passed (7.8 m), exit 0 | `suite-runs/t7-34-long-stock-key-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-34-long-stock-key-checks.txt` |

Tier: full, printed reason "first matching path since 1ee7aa39: e2e/d1/no-save.spec.ts". Ports free before and after. T7.34 is complete.

## T7.17 Workspace: migration to schema 6

Behavioral; commit `35f38715`. One case, written as five per-version tests (v1 to v5 fixtures) in `tests/integration/d7/migration.test.ts`; red `AssertionError: expected 2 to be 3` (5 failed: the receipt's Catalog manifest was still 2), green after `workspace.ts` and `migration.ts` seed `D7_CATALOG_MANIFEST`. No first-run passes. Receipts name manifest 3 and the three option Strategy keys (after the four Close Reasons for v1–v4); per-store counts describe the source database, unchanged. `verify:fixtures` passes with no re-freeze. Expectations edited because the option Strategies are now seeded: `workspace.test.ts`, `migration.test.ts`, `tests/integration/d1/initialize.test.ts`, `d6/migration.test.ts`, `d6/seed.test.ts`; `e2e/d2/migration.spec.ts` filters the three option Strategy keys from its authoritative Catalog comparison; schema-5 test names in d2, d4, d5 and d6 renamed (d6 capacity-profile names left for T7.26). Four test-only places still seed `D6_CATALOG_MANIFEST` straight into the Catalog module, not through the Workspace (closed-trade-review fixture, position-change-form facade, `closed-views.test.ts`, `record-position-change.test.ts`).

### ocr review of `35f38715`

No findings (`ocr/T7.17-35f38715.json`).

### Cumulative run after T7.17 (`t7-17-schema-6-seed`, at `35f38715`)

Run by `suite-runner` on 2026-11-07, browser stage `browser-auto 02f84102`.

| Suite | Result | Output |
|---|---|---|
| Unit | 113 files, 1318 passed, exit 0 | `suite-runs/t7-17-schema-6-seed-unit.txt` |
| Node integration | 77 files, 159 passed, exit 0 | `suite-runs/t7-17-schema-6-seed-integration.txt` |
| Browser (Chromium), full tier | 166 passed (7.9 m), exit 0 | `suite-runs/t7-17-schema-6-seed-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-17-schema-6-seed-checks.txt` |

Tier: full, printed reason "first matching path since 02f84102: e2e/d2/migration.spec.ts". Ports free before and after. T7.17 is complete.

## T7.18 Installed Capability Manifest and composition root for D7

Command: `npm run verify:capabilities` (exit 0).

```text
verify:capabilities OK: 19 operations, 11 variant-qualified, 8 routes, 4 Entry Types, schema 6, release 853915999821e451dab53a036014cc8b75c550437222e52b40765fad954a9b29
```

The manifest (`src/coordinators/workspace/capabilities.ts`) adds: `confirmPlan` LongCall, LongPut, CashSecuredPut; `recordPositionChange` Option, SellToOpen, BuyToClose, Expiration; `getTradeDetail` and `DailyReview.getTrade` ExpirationPayoff, SettlementDue; `DailyReview.open` SettlementFamily; `browseTrades`, `MarketData.save` and `MarketData.query` Option; the three Strategies; schema 6. Assignment, Exercise, cash settlement, multi-leg and structure-value variants are absent. The route table (`src/app/routes.ts`) declares the same variants so the verifier's reachability checks hold; the forms arrive in T7.19 to T7.22. Also run: typecheck, tsc6, lint, lint:deps (exit 0), unit project (116 files, 1372 passed), integration project (77 files, 159 passed).

### ocr review of `236b72ce`

No findings (`ocr/T7.18-236b72ce.json`). The subagent also listed the new variants in `src/app/routes.ts`, because `verify:capabilities` fails when an installed variant has no presenting route; nothing checks that a screen renders a variant, so T7.19 to T7.24 must.

### Cumulative run after T7.18 (`t7-18-capabilities`, at `236b72ce`)

Browser stage `browser-auto 7853d74e`, full tier ("first matching path since 7853d74e: src/app/routes.ts"). Unit 1318 passed; integration 159 passed; **browser 132 failed, 34 passed (14.7 m)**; checks 12 of 13 (`verify:capacity`, expected). Reproduced `e2e/d1/plan.spec.ts:7` in the main session: the New Plan form preselected "Cash-Secured Put" (first in decision 85's label order now that the option Strategies are installed), so a stock Plan was rejected with "This Plan does not fit the chosen Strategy."

### T7.18-F1 the Plan form preselects Long Stock by product key

Suite-failure fix, commit `6b0ace78` (decision 88, point 8, brought forward from T7.19). Root cause: `PlanForm.tsx` preselected `strategyOptions[0]`. Case "should preselect Long Stock by product key when option Strategies are installed and sort first" in `PlanForm.test.tsx`; red `AssertionError: expected 'Cash-Secured Put' to be 'Long Stock'`, green after the form selects the row whose `productKey` is `strategy.long-stock` (first row only if none). The subagent's `npm run build:faults` and `npm run build:releases` were denied by the auto-mode classifier, so it ran no browser tests; the cumulative run below confirms the fix. ocr review: no findings (`ocr/T7.18-F1-6b0ace78.json`).

### Cumulative run after T7.18-F1 (`t7-18-f1-long-stock-default`, at `6b0ace78`)

Run by `suite-runner` on 2026-11-07, browser stage `browser-auto 7853d74e`.

| Suite | Result | Output |
|---|---|---|
| Unit | 113 files, 1319 passed, exit 0 | `suite-runs/t7-18-f1-long-stock-default-unit.txt` |
| Node integration | 77 files, 159 passed, exit 0 | `suite-runs/t7-18-f1-long-stock-default-integration.txt` |
| Browser (Chromium), full tier | 166 passed (7.9 m), exit 0 | `suite-runs/t7-18-f1-long-stock-default-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-18-f1-long-stock-default-checks.txt` |

Tier: full, printed reason "first matching path since 7853d74e: src/app/routes.ts". Ports free before and after. T7.18 is complete.

## T7.35 Trade Analysis: a long option's `NoPositiveRisk` names the breakeven

Behavioral (decision 87, K12); commit `015f46a1`. One case in `plan-option.test.ts`; red `expected undefined to be true` (no breakeven on the long Call's `NoPositiveRisk`), green after `NoPositiveRisk` takes `breakevenOf`'s value for every option leg (stock still gets none). No first-run passes. One earlier assertion (Long Call Stop 58.00) now compares issue codes only, since the issue carries details. **For T7.19:** row 19.13 reads `details.breakeven` for every option `NoPositiveRisk`.

### ocr review of `015f46a1`

No findings (`ocr/T7.35-015f46a1.json`).

### Cumulative run after T7.35 (`t7-35-long-breakeven`, at `015f46a1`)

Run by `suite-runner` on 2026-11-07, browser stage `browser-auto 54ac5150`.

| Suite | Result | Output |
|---|---|---|
| Unit | 113 files, 1320 passed, exit 0 | `suite-runs/t7-35-long-breakeven-unit.txt` |
| Node integration | 77 files, 159 passed, exit 0 | `suite-runs/t7-35-long-breakeven-integration.txt` |
| Browser (Chromium), task tier | 5 passed (12.6 s), exit 0 | `suite-runs/t7-35-long-breakeven-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-35-long-breakeven-checks.txt` |

Tier: task, printed reason "no changed path since 54ac5150 is on the full-tier list". Ports free before and after. T7.35 is complete.

## T7.36 UI: changes to existing approved words

Behavioral (decision 87); commit `f2c1371e`, four cases, each with a genuine red: "Settlement Due" capitalized at every length (K4); quantity findings "in the position" with the singular at 1 (C1, K9, row 20.6), including "doesn't settle the 1 contract in the position" and the stock "100 shares in the position"; stock exit rows "Execution 1: The position has only 60 shares." / "…only 1 share." / "…more shares than the position has." and the members issue "…enough shares in the position." (rows 20.6, 20.7); receipt Execution lines without the fee (C5; red `expected [ 'Buy 20 XYZ @ $51.00, fee $1.00' ] to deeply equal [ 'Buy 20 XYZ @ $51.00' ]`). No first-run passes. `PHRASES` and `CODES` unchanged. A local `isOne`/`plural1` pair in `calculation-words.ts` (the `plural` helper lives in `screens/ReviewCard.tsx`, a layer above). Existing assertions moved in five unit files and three e2e specs. One `test:unit` run had one uncaptured failure that two reruns didn't reproduce (flaky; flagged).

### ocr review of `f2c1371e`

`ocr/T7.36-f2c1371e.json`, 1 comment, Doubtful, **dismissed**: a nested singular/plural ternary in `position-change-issues.ts:31` against a "no nested ternaries" rule that the repo doesn't have; the output matches rows 20.6 and K9 (as T7.3's and T7.5's nested-ternary findings were dismissed). The reviewer also noted a harmless missing space in `findingWords =(`; lint passes.

### Cumulative run after T7.36 (`t7-36-existing-words`, at `f2c1371e`)

Browser stage `browser-auto 9ab16f31`, full tier. Unit 1321 passed; integration 159 passed; browser 1 failed, 165 passed (7.8 m): `e2e/d2/ui-alignment.spec.ts:1696` (T2.62) still expected "fee" beside each receipt row's amount (`Error: receipt shows a fee`), stale since C5; checks 12 of 13 (`verify:capacity`, expected).

### T7.36-F1 T2.62 expects no fee on receipt rows

Test-only fix, commit `ca93e623`: the T2.62 case now requires no fee on receipt rows and keeps its one-phrase, price-after-"@" and no-overflow checks; the Detail-row fee placement test is unchanged. `npx playwright test e2e/d2/ui-alignment.spec.ts`: 45 passed. ocr (relocated, test-only): no findings (`ocr/T7.36-F1-ca93e623.json`).

### Cumulative run after T7.36-F1 (`t7-36-f1-receipt-no-fee`, at `ca93e623`)

Run by `suite-runner` on 2026-11-07, browser stage `browser-auto 9ab16f31`.

| Suite | Result | Output |
|---|---|---|
| Unit | 113 files, 1321 passed, exit 0 | `suite-runs/t7-36-f1-receipt-no-fee-unit.txt` |
| Node integration | 77 files, 159 passed, exit 0 | `suite-runs/t7-36-f1-receipt-no-fee-integration.txt` |
| Browser (Chromium), full tier | 166 passed (7.8 m), exit 0 | `suite-runs/t7-36-f1-receipt-no-fee-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-36-f1-receipt-no-fee-checks.txt` |

Tier: full, printed reason "first matching path since 9ab16f31: e2e/d2/ui-alignment.spec.ts". Ports free before and after. T7.36 is complete.

## T7.19 UI: option Plan form

Behavioral (decisions 87, 88, 92); commit `551ca046`, four cases (the fourth as four tests: trigger-field sentences, one sentence per option code in `plan-issues.ts`, the breakeven issue kept after a Stop edit, and `confirmPlan` forwarding `details.breakeven`), each with a genuine red. An extra Long Put direction test first passed (direction logic written during case 1), then reverted to `bullish = true` for a genuine red ("Unable to find a label with the text of: Stop (ABC at or above)") and restored. **First-run pass (flagged):** "should hand the confirmed option Plan, with its 1R from the result, to Trade Detail without a read call", built earlier by `confirmedDetail`; mutation (doubling `baseline.oneR` in `confirmed-detail.ts`) failed with `Unable to find an element with the text: 1R $400.00`, then restored. Unit 1384 passed; typecheck, tsc6, lint, lint:deps, verify:wording exit 0. No words missing. Plumbing outside the named files: `WorkflowIssue.details?: { breakeven }` (`types.ts`) and its forwarding in `trade-workflows.ts`, so the form can word the breakeven; one existing coordinator expectation gains `details`. Left for T7.23: `confirmedDetail` builds the summary with `plannedLongStockSummary` and drops `plan.exerciseIntent`.

### ocr review of `551ca046`

`ocr/T7.19-551ca046.json`: no findings.

### T7.19-B1 a quantity issue clears on any positive edit

Found in the subagent's summary (the task's own code). The form clears a quantity issue on any positive edit, so on an option Plan `ContractQuantityNotWhole` for "2.5" clears when the field reads "2.6", and the trader sees no error until submission. Case: `it should keep ContractQuantityNotWhole beside Contracts while the count stays fractional, and clear it once the count is whole`.

Commit `630df208`: red `expected undefined to be 'Enter a whole number of contracts.'` (the issue gone after "2.5" replaced the rejected "1"); green, `PlanForm.test.tsx` 34 passed; typecheck, tsc6, lint, lint:deps exit 0. No first-run pass. The rule is "an option's quantity issue clears only once the count is a positive whole number" (`verify:wording` refuses a branch on the reason code outside `calculation-words.ts`), so an option `InvalidQuantity` for 0 edited to "2.5" also stays until the next submission, when `ContractQuantityNotWhole` replaces it. Stock Plans keep the old rule. ocr: no findings (`ocr/T7.19-B1-630df208.json`).

### Cumulative run after T7.19-B1 (`t7-19-option-plan-form`, at `630df208`)

Run by `suite-runner` (medium effort, `4e93847d`) on 2026-11-07, browser stage `browser-auto a678926d`; `run-complete.sh` printed "run complete" for the runner and again in the main session.

| Suite | Result | Output |
|---|---|---|
| Unit | 113 files, 1331 passed, exit 0 | `suite-runs/t7-19-option-plan-form-unit.txt` |
| Node integration | 77 files, 159 passed, exit 0 | `suite-runs/t7-19-option-plan-form-integration.txt` |
| Browser (Chromium), full tier | 166 passed (7.8 m), exit 0 | `suite-runs/t7-19-option-plan-form-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-19-option-plan-form-checks.txt` |

Tier: full, printed reason "first matching path since a678926d: src/ui/screens/PlanForm.test.tsx". Ports free before and after. (The task agent's "1384 passed" was a different unit command; the cumulative count is 1331.) T7.19 is complete.

## T7.20 UI: option Execution form

Behavioral (decision 87); commit `c666a5a6`, two cases, each with a genuine red ("Unable to find an element with the text: Contract"; "Unable to find an element with the text: Execution 1: The position has only 2 contracts."), plus two extra receipt cases with genuine reds (entry receipt "Sell to open 2 MNO 20 Nov 2026 45 Put", row 20.12; exit receipt "Sell to close 1 XYZ 20 Nov 2026 55 Call" with Lot Matches "Opened"/"Closed", row 20.13). Case 2's Closing the Trade half already passed from case 1's work (absolute held quantity); the case as a whole had a genuine red (note row in `tdd-log.md`). Option detected from the plan leg's instrument kind and side; new `execution-line.ts` (`executionWhat`), `LotMatchesTable` `option` prop, `describePositionChangeIssues(..., option)`, `tests/support/option-trade-fixtures.ts` (`optionTrade('O-C' | 'O-S')`). `src/ui` unit 512 passed; typecheck, tsc6, lint, lint:deps exit 0. No e2e change; nothing hit the `tradeSummary` throw. Two existing receipt fixtures gained `plan: {}`.

Not done by the task, though its amendment gives rows 20.1 to 20.15, and reachable from the form (an option `ContractQuantityNotWhole` falls back to "check this Execution."; an option `InvalidQuantity` says "quantity"): rows 20.7, 20.8, 20.9, 20.11, 20.14 and 20.15. These become bug tasks (the subagent's summary reveals them in the task's own scope).

### T7.20-B1 option row and form errors, and the conflict banner, take contracts words

Rows 20.7, 20.8, 20.9 and 20.11. Cases:
- `it should word an option row's InvalidQuantity and ContractQuantityNotWhole each with its own contracts sentence` (20.9)
- `it should word AfterExpiration on a new option Execution with the expiration date` (20.8)
- `it should word the members issue for a later recorded exit with contracts` (20.7)
- `it should show the option position in the conflict reload banner as a holding in words` (20.11)

### T7.20-B2 option receipts word the Changed Lot Matches note and the Entry Size Deviation with contracts

Rows 20.14 and 20.15 (the receipt sentence; the Detail sentence is T7.23's). Cases:
- `it should show the Changed Lot Matches note with Opened and Closed headers for an earlier-dated option exit` (20.13, 20.14)
- `it should state an option Entry Size Deviation on the receipt in contracts` (20.15)

### ocr review of `c666a5a6`

`ocr/T7.20-c666a5a6.json`, 1 comment, Valid: Trade Detail's Lot Matches (`TradeDetail.tsx`) don't pass `option`, so an option Trade's Detail still heads them "Bought"/"Sold" (row 20.13). **Assigned to T7.23** (option Trade Detail), as T7.14's findings were assigned to planned tasks; T7.20's brief left Trade Detail to T7.23. The comment's side claim that "Opened"/"Closed" reverses the meaning for a short put is wrong: that is the approved wording.

### T7.20-B1 result

Commit `b063515f`, four cases, each with a genuine red (text not found: "Execution 1: enter a number of contracts greater than zero."; "Execution 1: the Economic Time cannot be after the expiration date, Fri Nov 20."; "This exit would leave a later recorded exit without enough contracts in the position."; "Long 1 contract of XYZ 20 Nov 2026 55 Call"). One invalid red (0 tests ran: an apostrophe in the `-t` name) logged and renamed. No first-run pass. `PositionChangeFormOptions` and `PositionChangeForm` tests 60 passed; typecheck, tsc6, lint, lint:deps exit 0. The workflow's real row codes (Required, NotPositive, TooManyFractionalDigits) on an option row all read row 20.9's "enter a number of contracts greater than zero."; `ContractQuantityNotWhole` reads its own sentence. New `isAfterExpirationIssue` and `isContractQuantityNotWholeIssue` in `calculation-words.ts`; `describePositionChangeIssues`'s last parameter is now the Trade's `OptionInstrument | undefined`. A short holding in the banner is read from a negative quantity; C2's one line per leg waits for D10.

ocr (`ocr/T7.20-B1-b063515f.json`), 1 comment, Valid as a description, **dismissed**: a nested Short/Long ternary in the banner's Position wording (`PositionChangeForm.tsx:455-457`) against a "no nested ternaries" checklist item the repo doesn't have; output matches row 20.11. Dismissed as in T7.3, T7.5 and T7.36 (the reviewer cites a D7P precedent that fixed one; D7 has kept dismissing them).

### T7.20-B2 result

Commit `efe0af23`, two cases, each with a genuine red (the stock Changed Lot Matches sentence still shown; "1 contract above plan" not found, "shares" shown). No first-run pass. Form, Exit and Options tests 75 passed; typecheck, tsc6, lint, lint:deps exit 0. The option flag comes from `trade.plan.legs[0].instrument.kind` in `ExitReceipt` and from `saved.executions[0].instrument.kind` in `PositionChangeReceipt` (stock receipt fixtures carry no `plan.legs`).

ocr (`ocr/T7.20-B2-efe0af23.json`), 2 comments, both Valid, becoming bug task T7.20-B3: (1) the receipt's `NewVersion` sentence "Entry Size Deviation changed: now N shares above plan (was M)" still says shares for an option (also reported by the subagent); (2) the contract count is a hand-written ternary rather than C1's `plural(n, one, many)` helper. The reviewer also noted `const matchQuantity =(` missing a space in `ExitReceipt.tsx:62` (lint passes; tidied in B3).

### T7.20-B3 the changed Entry Size Deviation on an option receipt is in contracts, through C1's helper

No approved row words the `NewVersion` sentence for an option; C1 (contract count and plural) and row 20.15's pattern give it: "Entry Size Deviation changed: now 2 contracts above plan (was 1), caused by …" (flagged for the final report as a C1 reading). Case: `it should state a changed option Entry Size Deviation on the receipt in contracts, with the singular at 1`. Both receipt Deviation sentences take the count through `plural`.

### T7.20-B3 result

Commit `60df88b7`, one case: an invalid first red (TypeError from an unknown fixture id, logged), then a genuine red ("Entry Size Deviation changed: now 2 contracts above plan (was 1)…" not found); green, file 11 passed; typecheck, tsc6, lint, lint:deps exit 0. No first-run pass. Both receipt Deviation sentences use `plural(Number(quantityAbovePlan), 'contract', 'contracts')` from `ReviewCard.tsx` (lint:deps clean); stock unchanged; `ExitReceipt.tsx` spacing tidied. ocr: no findings (`ocr/T7.20-B3-60df88b7.json`).

### Cumulative run after T7.20-B3 (`t7-20-option-execution-form`, at `60df88b7`)

Run by `suite-runner` on 2026-11-07, browser stage `browser-auto 755b623b`. The runner handed back "waiting" while the browser stage ran, which used its one report, so its final table was refused; the main session read the four output files instead, and `run-complete.sh` printed "run complete". (`suite-runner.md` now says to end the turn without a handback while waiting.)

| Suite | Result | Output |
|---|---|---|
| Unit | 114 files, 1342 passed, exit 0 | `suite-runs/t7-20-option-execution-form-unit.txt` |
| Node integration | 77 files, 159 passed, exit 0 | `suite-runs/t7-20-option-execution-form-integration.txt` |
| Browser (Chromium), full tier | 166 passed (8.0 m), exit 0 | `suite-runs/t7-20-option-execution-form-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-20-option-execution-form-checks.txt` |

Tier: full; `full-suite.sh --choose-tier 755b623b` prints "full: src/ui/calculation-words.ts". T7.20 is complete; its Trade Detail Lot Matches headers (ocr finding on `c666a5a6`) and row 20.15's Detail sentence are T7.23's.

## T7.21 UI: expiration form

Behavioral (decision 87, conflict K14); commit `8ea8561b`. Two planned cases, each with a genuine red (`Unable to find role="heading" and name "Expiration"` against a null-rendering stub; `TypeError: undefined is not iterable`, `recordPositionChange` never called), plus four extra cases: rejected-save summary (row 21.7) and Conflict (row 21.11), each with a genuine red; **two first-run passes (flagged)**, code written before their tests: "Back to the Review" only when opened from the Review (mutation `{!fromReview && …}` in `ExpirationReceipt.tsx`, `Unable to find role="link" and name "Back to the Review"`) and the nothing-due state (mutation of row 21.12's sentence, text not found); both restored. `src/ui src/app tests` 685 passed; typecheck, tsc6, lint, lint:deps exit 0.

New route `record-expiration`, `/trades/:tradeId/record-expiration` (label "Record expiration"; requires `recordPositionChange` variant `Expiration`, `getTradeDetail`, `Journal.getDefinitions`), mounted in `src/main.tsx`; `?from=review` makes the receipt offer "Back to the Review" (T7.23 and T7.24 link with it). New `ExpirationForm`, `ExpirationReceipt`, `expiration-issues.ts` (rows 21.8–21.10), `option-disposition.ts` (`closedViaOption`, `timingWords`, rows 23.12–23.13, reusable by T7.23); `LotMatchesTable` `settlements` prop (row 21.15); `ClosingTheTrade` reason props optional plus `noReasonNote`. No `tradeSummary` throw hit; no Refresh Review.

Words: "Closed via expiration of 2 contracts" (an expiration-only Terminal Disposition) is row 23.12's "expiration of 1 contract" phrase with C1's count, the list form being 23.14's "Closed via expiration"; flagged for the final report as a 23.12 and C1 reading, like T7.20-B3. Receipt headings reuse `ExitReceipt`'s words.

### T7.21-B1 a failed load shows row 21.12's failure sentence

Found in the subagent's summary: a failed `getTradeDetail` leaves the form on "Loading the expiration form…", though row 21.12 gives "We couldn’t load this expiration form. Nothing was changed." Case: `it should say the expiration form couldn’t load, and that nothing was changed, when the Trade can’t be read`.

### ocr review of `8ea8561b`

`ocr/T7.21-8ea8561b.json`, 6 comments (one, the load failure, already bug task B1):
1. Valid (high): Trade Detail passes no `settlements` to `LotMatchesTable`, so a Closed Trade with a Lot Match disposed by an Expiration throws on `executions.find(...)!.price` and the Detail page breaks for every expired Trade. → bug task B2.
2. Valid: `ExpirationForm`'s `dirty` stays true after a successful save (no `!recorded` guard, unlike `PositionChangeForm.tsx:148`). → added to B1.
3. Doubtful: a route change to another `tradeId` doesn't reset view, receipt or reflection state. → added to B1.
4. Doubtful: a `StorageFailure` result shows nothing. **Deferred, open question for the final report:** `PositionChangeForm` has the same gap (pre-existing), no approved row words a storage failure on either form, and wording one needs a decision; B7.11 (the mid-session failure browser scenario, `RuntimeNotWritable`) will test the shell's not-writable explanation.
5. Doubtful: the route declares no data variant for `getTradeDetail`, though other routes list `SettlementDue`. → added to B2.

### T7.21-B1 cases (expanded)

- `it should say the expiration form couldn’t load, and that nothing was changed, when the Trade can’t be read` (row 21.12)
- `it should report no unsaved values once the expiration is recorded`
- `it should load the other Trade's settlement when the route's Trade changes`

### T7.21-B2 Trade Detail shows an expired Lot Match

- `it should show a Closed option Trade's Lot Match disposed by an Expiration as "Expired on 2026-11-20 16:00" on Trade Detail` (row 21.15)
- the `record-expiration` route declares `getTradeDetail`'s `SettlementDue` variant, checked by `verify:capabilities` and the routes test.

### T7.21-B1 result

Commit `089fee85`, three cases, each with a genuine red (row 21.12's failure sentence not found; last `onDirtyChange` not `false`; the old receipt stayed after the Trade changed). No first-run pass. `ExpirationForm.test.tsx` 9 passed; typecheck, tsc6, lint, lint:deps exit 0. The failure (`<p role="alert">`, no Retry) covers a rejected or non-Ready load of the Trade or either definition; NotFound shows the same sentence (row 21.12 gives no separate words; `PositionChangeForm` has its own "Trade not found" view). The Trade-change reset follows `PositionChangeForm`'s render-phase `loadingFor` comparison. ocr: no findings (`ocr/T7.21-B1-089fee85.json`).

### T7.21-B2 result

Commit `6a0dad29`. Item 1: red `TypeError: Cannot read properties of undefined (reading 'price')` (Lot Matches region not rendered); green with `settlements={view.positionChanges.flatMap((c) => c.settlements ?? [])}` in `LotMatchesSection`, as `ExpirationReceipt` does; new helper `expiredOptionLotMatches(which)` in `tests/support/option-trade-fixtures.ts` (`lint:deps` keeps UI tests off the coordinator); the fixture is stock `closedDetailOf` with the option `positionChanges` and `lotMatches` swapped in. Item 2 (route variant): **no red**: no test checks that a route declares the variants it reads (`verify:capabilities` checks only absent, unrequired or unpresented variants), so `verify:capabilities` (19 operations, 9 routes) is a regression check only. No first-run pass. TradeDetail and ExpirationForm tests 84 passed; typecheck, tsc6, lint, lint:deps exit 0. Detail's Lot Matches headers ("Opened"/"Closed") need a derived option flag in the shared `LotMatchesSection`: left to T7.23. ocr: no findings (`ocr/T7.21-B2-6a0dad29.json`).

### Cumulative run after T7.21-B2 (`t7-21-expiration-form`, at `6a0dad29`)

Run by `suite-runner` on 2026-11-07, browser stage `browser-auto 25bc833e`; `run-complete.sh` printed "run complete" for the runner and in the main session.

| Suite | Result | Output |
|---|---|---|
| Unit | 115 files, 1352 passed, exit 0 | `suite-runs/t7-21-expiration-form-unit.txt` |
| Node integration | 77 files, 159 passed, exit 0 | `suite-runs/t7-21-expiration-form-integration.txt` |
| Browser (Chromium), full tier | 166 passed (7.9 m), exit 0 | `suite-runs/t7-21-expiration-form-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-21-expiration-form-checks.txt` |

Tier: full, printed reason "first matching path since 25bc833e: src/app/routes.ts". Ports free before and after. T7.21 is complete.

## T7.22 UI: payoff view

Behavioral (decisions 87, 92); commit `a1f091fa`, four cases, each with a genuine red: (1) heading "Planned Expiration Payoff" not found (component rendered nothing); (2) runtime `Error: not yet worded` (Touch and Zero Range); (3) "If XYZ is at 52.00 at expiration: −$401.30" not found; (4, decision 92, `PlanForm.test.tsx` "option Plan receipt (A116)") role img "Planned payoff at expiration by XYZ price" not found while the 1R showed. No first-run pass; the NotApplicable branch was written during case 1, ahead of case 3, which stayed red on its first assertion (noted in `tdd-log.md`). `src/ui` 533 passed (before the last TradeDetail edit; PayoffView, PlanForm and TradeDetail rerun after it); typecheck, tsc6, lint, lint:deps, verify:wording exit 0.

New `PayoffView` (`kind`, `symbol`, `result`, optional `latestClose` for T7.23), `payoff-text.ts`, `tests/support/payoff-fixtures.ts`; `payoffUnboundedWords` in `calculation-words.ts` and "unlimited" in `PHRASES` (K2); `underlyingPrice` in `format.ts` (C3); payoff types re-exported from `src/app/types.ts` (lint:deps). `PlanForm` navigates with `plannedPayoff: result.postCommit.payoff?.planned`, and `TradeDetail` shows it after `SummaryCard` for a just-confirmed Plan when it is a `Value` (T7.23 gives every Detail its payoff sections). A falling final ray throws "a falling final ray has no approved words" (no D7 Strategy has one; D10 needs words). "Breakeven 57.00" for a crossing is the breakdown's case 1 text.

### T7.22-B1 an unbounded Zero Range uses no invented words

Found in the subagent's summary: a `ZeroRange` with no upper end reads "Breakeven at 55.00 and above", words no approved row gives. It occurs only for a flat final ray at 0, which no D7 Strategy can produce (every entry price is above zero). Like the falling final ray, it throws a "no approved words" error instead. Case: `it should refuse to word a Zero Range with no upper end, which no approved row words`.

### ocr review of `a1f091fa`

`ocr/T7.22-a1f091fa.json`, 3 comments, all Valid:
1. The payoff polyline, axes and zero-range lines have no stroke (no CSS rule for `payoff-curve`, `payoff-axis`, `payoff-zero-range`; SVG's default stroke is none), so the chart draws no curve, axes or Zero Range. → bug task B2.
2. The Planned payoff, holding `Rational` instances, travels in router history state; `history.state` is structured-cloned, so after a reload or back/forward its values are plain objects and `PayoffView`'s `compare` calls throw. → bug task B3.
3. Axis tick labels repeat a price that is both a segment start and a zero-set end (0 and 55 in the Zero Range fixture): duplicate React keys and doubled labels. → added to B2.

### T7.22-B2 the payoff chart draws its curve, axes and Zero Range, with each tick once

- `it should stroke the payoff curve, the axes and a Zero Range so the chart draws them`
- `it should label each axis price once when a segment start is also a zero-set end`

### T7.22-B3 the confirmed Plan's payoff survives a reload of its Detail

- `it should render the confirmed Plan's Detail after a reload or back navigation without throwing, with its Planned payoff` (history state carries no class instances, or they are revived)

### T7.22-B1 result

Commit `f1a63143`, one case: red `expected [Function] to throw an error` (`zeroText` returned "Breakeven at 55.00 and above"); green, `PayoffView.test.tsx` 4 passed; typecheck, tsc6, lint, lint:deps exit 0. No first-run pass. `zeroText` throws "a Zero Range with no upper end has no approved words", like the falling-final-ray throw; no fixture removed (the `zeroRange` fixture is bounded and shared). ocr: no findings (`ocr/T7.22-B1-f1a63143.json`). B2 and B3 run in parallel on separate files; both append to the shared `tdd-log.md`, so one commit may carry the other's log rows.

### T7.22-B2 result

Commit `5b7ec983`, two cases, each with a genuine red (`expected null to be 'currentColor'`; `expected [ '0.00', '0.00' ] to have a length of 1 but got 2`); green, `PayoffView.test.tsx` 6 passed; typecheck, tsc6, lint, lint:deps exit 0. No first-run pass. Strokes are SVG attributes (`stroke="currentColor"`, widths 1.5, curve 2.5, zero range 4), inheriting the page ink in light and dark (`app.css` has no SVG rules); ticks de-duplicated by exact value, x-range unchanged. Its `tdd-log.md` diff carries one B3 row (shared file). ocr: no findings (`ocr/T7.22-B2-5b7ec983.json`).

### T7.22-B3 result

Commit `50ad3b4e`, one case: an invalid first red (MemoryRouter JSON-serializes state and throws on a BigInt; the test then drives a low-level `<Router navigationType=Pop>` with a `structuredClone`d location), then a genuine red `TypeError: value.compare is not a function`; green, TradeDetail and PlanForm tests 111 passed; typecheck, tsc6, lint, lint:deps exit 0. No first-run pass. Fix: `TradeDetail` uses `location.state` only when `useNavigationType() !== NavigationType.Pop`; after a reload or back/forward it reads through `getTradeDetail` (covers `confirmed` too, which itself survives a clone). After a reload the confirmed option Plan's Detail shows no Planned payoff until T7.23 gives the read Detail its payoff sections; the test asserts the heading, the read call and the 1R (its name still says "with its Planned payoff"; T7.23 to assert the payoff on the read Detail).

ocr of `50ad3b4e` (`ocr/T7.22-B3-50ad3b4e.json`), 1 comment, Valid: after a POP the payoff section vanishes and the test, despite its name, doesn't check for it. **Assigned to T7.23**, whose first case gives the read Detail its Planned and Current payoff sections: T7.23's brief extends this B3 test to assert the Planned payoff after the reload, and drops "with its Planned payoff" from the name if it still can't.

### Cumulative run after T7.22-B2 and B3 (`t7-22-payoff-view`, at `5b7ec983`)

Run by `suite-runner` on 2026-11-08, browser stage `browser-auto 284a4c2d`; `run-complete.sh` printed "run complete" for the runner and in the main session.

| Suite | Result | Output |
|---|---|---|
| Unit | 116 files, 1360 passed, exit 0 | `suite-runs/t7-22-payoff-view-unit.txt` |
| Node integration | 77 files, 159 passed, exit 0 | `suite-runs/t7-22-payoff-view-integration.txt` |
| Browser (Chromium), full tier | 166 passed (7.8 m), exit 0 | `suite-runs/t7-22-payoff-view-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-22-payoff-view-checks.txt` |

Tier: full, printed reason "first matching path since 284a4c2d: src/app/types.ts". Ports free before and after. T7.22 is complete.

## T7.23 UI: option lists and Trade Detail

Behavioral (decisions 48, 87, 88); commit `90bd3571`. Three planned cases (case 1 as three tests: contract label, Exercise Intent and summary; Planned and Current payoff sections; the Settlement Due panel with Record expiration only while Writable), each with a genuine red (e.g. `expected '1 of 2 shares' to be '1 of 2 contracts'`; region "Planned Expiration Payoff" not found; region "Settlement Due" not found; `expected 'Closed via sale of 2 shares' to be 'Closed via sale of 1 contract and exp…'`; the "Settlement Due" row badge not found), plus extra cases with genuine reds for each carried-over item: Trade Summary Option text (`Error: option Trade summaries are worded by T7.23`, the T7.16 throw), the Planned Detail's `payoff`, `confirmedDetail` for an option Plan, row 23.11, Executions and "Settlement (1)" (23.7, C6, K18), Detail Lot Matches "Opened"/"Closed" (20.13), Deviation and Fulfillment in contracts (20.15, 23.2), Integrity cell (23.8; code written ahead, reverted for a genuine red, restored), At entry (23.5), Conditions columns (23.17), option Stop/Target as Underlying prices (C3). One invalid red (a fixture import) annotated. **Three first-run passes (flagged), each mutation-checked:** the extended T7.22-B3 reload case now asserts the Planned payoff (mutation: Planned `PayoffView` given `view.payoff.current`, role img "Planned payoff at expiration by XYZ price" not found); Long Stock Detail's two "Not applicable: no option expiration" sections (K1; mutation: Current given `NotApplicable(NoRemainingPosition)`); Net cost "$248.70 credit" and "$190.65" (mutation `< 0n` to `> 0n` in `netCost`, `expected '−$248.70' to be '$248.70 credit'`). Unit 121 files, 1432 passed; integration 159 passed; typecheck, tsc6, lint, lint:deps, verify:wording, verify:capabilities exit 0. Browser not run (the classifier denied the subagent `build:faults` and `build:releases`; the suite-runner's browser stage builds them).

Read-model change inside a UI task (accepted: A119 requires a Planned Detail's Planned payoff, and the extended reload test needs it from the read): `PlannedTradeDetail.payoff: ExpirationPayoffs` from `payoffOf` (`OpenTradeDetail` inherits it, `IncoherentTradeDetail` omits it); three trade-views key-list tests updated. `confirmedDetail` now carries the option summary, `exerciseIntent` and `payoff`, so T7.22's `plannedPayoff` navigation state is removed. `tradeSummary(summary, timeZone?)` takes the current year in the Workspace zone. New `option-words.ts`, `isSettlementDue` (`calculation-words.ts`), `closedViaOptionShort`, `closedByExpiration`, `timingLabel`; `tests/support/option-detail-fixtures.ts`. The Settlement Due heading's words come from `unavailableLabel` (the lint owns "Settlement Due").

Not done, becoming bug tasks (the task's own rows): row 23.18 "Underlying Mark" "$52.00 · Manual" (the read model carries only the contract Mark's provenance); an Open row shows "Settlement Due" only from the day after expiration (`OpenTradeItem` has no settlement field, the badge keys on `Unavailable(SettlementDue)`), while Detail shows its panel on the expiration date (B7.4, A113).

### ocr review of `90bd3571`

`ocr/T7.23-90bd3571.json`, 3 comments:
1. Valid: the incoherent-Detail branch (`TradeDetail.tsx:215`) renders only `ExecutionsSection`, so a recorded Expiration vanishes when replay fails; the Open and Closed branches render `SettlementSection`. → bug task B1.
2. Doubtful: every Closed option Trade shows "Expired <date>", including one sold or bought back before an expiration date still ahead. Row 23.19's words say "on a Closed or expired option Trade"; read literally the code follows them, but the line is then false before the date. **Asked the user** (a word-rule reading).
3. Valid as a description, **dismissed**: `mechanismWord` in `option-disposition.ts` is a nested ternary; no repo rule (as in T7.3, T7.5, T7.36, T7.20-B1).

### T7.23-B1 option Trade Detail: the Underlying Mark, and the Settlement section on an incoherent Detail

- `it should show the Valuation section's Underlying Mark with its price and provenance, "$52.00 · Manual"` (row 23.18; the read model gains the Underlying Mark's provenance)
- `it should list a recorded Expiration in its Settlement section on an incoherent Detail too` (ocr comment 1)

### T7.23-B2 an Open option row shows "Settlement Due" from the expiration date

- `it should show "Settlement Due" on an Open option row on the expiration date after the settlement time, as Detail's panel does` (`OpenTradeItem` carries the settlement state; K4)

ocr comment 2 resolved by the user's decision (decision 93, revision 58): a Closed option Trade's Detail shows no expiration line. → bug task B3.

### T7.23-B3 a Closed option Trade's Detail shows no expiration line

- `it should show no expiration line on a Closed option Trade's Detail, whether it was closed by sale, buyback or expiration, and keep "Expires Fri 20 Nov 2026" on an Open one` (decision 93, row 23.19 amended)

### T7.23-B1 result

Commit `bae86299`. Coordinator case (extra) "should carry the Underlying Mark with its price and provenance on an open option Detail apart from the contract Mark": red `expected undefined to deeply equal ObjectContaining{…}`, green. Case 1: red `Unable to find an element with the text: Underlying Mark` (`dt`), green ("$52.00 · Manual"). Case 2: red `Unable to find role="region" and name "Settlement (1)"`, green. No first-run pass. TradeDetailOptions, TradeDetail and trade-views tests 142 passed; typecheck, tsc6, lint, lint:deps exit 0. New `OpenCurrentEvaluation.underlyingMark?: MarkProvenance` (option Trades, exact Underlying Mark only), read from the Underlying frame `currentFrames` already fetches; price and source only (row 23.18). ocr: no findings (`ocr/T7.23-B1-bae86299.json`).

### T7.23-B2 result

Commit `4deaabb2`, one case as two tests: coordinator "should carry the Settlement Due item on an Open option row" (red: the Open item had no `settlement`; green, the same `SettlementItem` as Detail at Friday 17:00, `[]` at Thursday 17:00) and the UI row (red: no "Settlement Due" badge with the P&L still AwaitingClose; green). No first-run pass. `src/coordinators src/ui` 845 passed; typecheck, tsc6, lint, lint:deps exit 0. `OpenTradeItem.settlement: readonly SettlementItem[]` (empty for stock and before the settlement time; `IncoherentOpenTradeItem` omits it); `openItem` takes the evaluation as a parameter, so each Open Trade is still evaluated once (the existing "evaluate each Trade once" test caught a first double-evaluating version); two key-list tests gain `settlement`. The badge keys on `settlement[0]` through `unavailableLabel`. The orphaned `isSettlementDue` removed in `772dcf30`. ocr pending.

### T7.23-B3 result

Commit `7ab6b5e4`, one case: red `expected [ <p></p> ] to deeply equal []` (after invalid reds on the fixture and a regex also matching the Lot Match "Expired on …"); green; TradeDetailOptions and TradeDetail tests 93 passed; typecheck, tsc6, lint, lint:deps exit 0. No first-run pass. The Closed-Detail A119 case's "Expired Fri 20 Nov 2026" assertion moved to "no expiration line"; `osChange` re-exported from `option-trade-fixtures.ts`. ocr: no findings (`ocr/T7.23-B3-7ab6b5e4.json`).

**Decision 93 was a misreading of the user's answer.** The user: a Trade is closed only by the trader's own Executions; an expired Trade is no longer open but was never closed. Asked how far D7 applies that (it conflicts with the specs' Lifecycle Closed and with approved rows 23.12, 23.14 and 21.x), the user chose the expiration line only: decision 94 (revision 59, `claude-opus-5.5-plan-r59`) replaces 93, and the wider wording is a follow-up after D7. B3 is corrected by B4.

### T7.23-B4 an expired option Trade shows "Expired Fri 20 Nov 2026"; a trader-closed one shows none

- `it should show "Expired Fri 20 Nov 2026" on a Closed option Trade whose Terminal Disposition includes an expiration, wholly or in part, and no expiration line on one only the trader's Executions disposed of` (decision 94, row 23.19). A sale plus an expiration ("Mixed") shows the line: part of the position expired (flagged for the final report).

ocr of `7ab6b5e4..772dcf30` (`ocr/T7.23-B2-4deaabb2-772dcf30.json`), 1 comment, Doubtful: `browseTrades` awaits each Due Trade's settlement-time lookup in turn (`trade-views.ts:906`); a `Promise.all` is a small, safe improvement. → bug task B5. The reviewer also noted, outside ocr: `settlementTimeOf` (`src/coordinators/settlement.ts:20`) throws for an expiration date outside calendar coverage, so since B2 one such Trade fails the whole Open list (before, only its Detail). Approved-words Q1 already decides that case: the item shows the module's "outside the market calendar" figure in place of the settlement time and offers no Record expiration (tech debt item 18), and `calculation-words.ts` words `SessionPolicyNotCovered` ("Outside the market calendar: <date>"). → added to B5.

### T7.23-B5 settlement times are looked up together, and an uncovered expiration date doesn't fail the page

- `it should look up the Open page's settlement times concurrently` (coordinator)
- `it should show "Outside the market calendar" in place of the settlement time, with no Record expiration, for an expiration date outside calendar coverage, and still list the other Trades` (Q1; Detail panel and Open list)

### T7.23-B4 result

Commit `d2bf7560`, one case (B3's test reworked and renamed): red `Unable to find an element with the text: /^Expire[sd] .../` (the line absent on the expired Details); green; `src/ui/screens` 473 passed; typecheck, tsc6, lint, lint:deps exit 0. No first-run pass. `SummaryCard` reads `closedByExpiration` on the Terminal Disposition's mechanisms (no dates); its `view` prop widened to include `ClosedTradeDetail`. Assertions moved: the mixed O-C and a new wholly expired O-S Detail expect `['Expired Fri 20 Nov 2026']`; sale-only and buyback-only expect none; the A119 closed case's no-line assertion removed and the test renamed. ocr: no findings (`ocr/T7.23-B4-d2bf7560.json`).

### T7.23-B5 result

Commit `0152cfa7`. Cases: concurrent lookups (red `expected 1 to be 2`, peak in-flight ResolveSession calls; green with `Promise.all`, page order kept); coordinator uncovered date (red `Error: no settlement time for 2026-11-20`; green, `browseTrades` and `getTradeDetail` return the item with `settlementTime` `Unavailable(SessionPolicyNotCovered)` and list every Open Trade); Detail panel (red `Temporal error: Parsing ended abruptly`, after reverting a UI half written with the type change; green, "Outside the market calendar: Fri Nov 20" in place of the time, no Record expiration). No first-run pass. coordinators, ui and tests 1007 passed; typecheck, tsc6, lint, lint:deps exit 0. `SettlementItem.settlementTime: SettlementTime = CalculationResult<Instant, SessionPolicyNotCovered, never>`; `settlementTimeOf(marketData, instrument, expiration)`. The expiration form shows its nothing-due text for an uncovered item (unreachable from Detail). Daily Review carries the uncovered item without throwing and now looks up per item rather than per expiration; its wording is T7.24's.

ocr (`ocr/T7.23-B5-0152cfa7.json`), 1 comment, **Wrong, dismissed**: it claims `daily-review/settlement.test.ts` still asserts bare `FRIDAY_CLOSE` instants, but the same commit redefines `FRIDAY_CLOSE` as `{ kind: 'Value', … }` (line 14). Its side request, a Review case mixing a covered and an uncovered item, goes to T7.24 with the Review's wording of the uncovered item.

### Cumulative run after T7.23-B5 (`t7-23-option-lists-detail`, at `0152cfa7`)

Run by `suite-runner` on 2026-11-08, browser stage `browser-auto 66902ee1`; `run-complete.sh` printed "run complete" for the runner and in the main session.

| Suite | Result | Output |
|---|---|---|
| Unit | 118 files, 1386 passed, exit 0 | `suite-runs/t7-23-option-lists-detail-unit.txt` |
| Node integration | 77 files, 159 passed, exit 0 | `suite-runs/t7-23-option-lists-detail-integration.txt` |
| Browser (Chromium), full tier | 166 passed (8.0 m), exit 0 | `suite-runs/t7-23-option-lists-detail-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-23-option-lists-detail-checks.txt` |

Tier: full, printed reason "first matching path since 66902ee1: src/app/types.ts". Ports free before and after. The runner warned the browser stage (8.0 m) is near the 10-minute Bash limit: T7.31 adds D7's browser suite, so the full tier must be split before then (flagged for T7.31). T7.23 is complete.

## T7.24 UI: Review settlement family and option Marks

Behavioral (decisions 81, 87, 88; conflicts K13, K14, K18); commit `30af5e9c` (33 files). Three planned cases, each with a genuine red: (1) the overview blockers list lacked the settlement line (`expected [ …(3) ] to deeply equal [ …(3) ]`); green: each card's Settlement panel, the blocker "Settlement Due for MNO 20 Nov 2026 45 Put, which expired Fri Nov 20" linking to `/review?trade=t3&panel=Settlement`, "1 Mark · Settlement · Action", the exercise or assignment sentence by signed quantity; (2) the owed reflection lacked "Expiration of 1 XYZ 20 Nov 2026 55 Call, no price or fee"; green: Record expiration opens `/trades/:id/record-expiration?from=review`, "Back to the Review", no Refresh Review, the Expiration on the owed reflection after returning; (3) the Mark row heading showed `MNO261120P00045000`; green: label, P27's note "0 means it closed with no value" (P27 quotes it), 0 saved unchanged, "Needed only while settlement is due" only on a row held only by Settlement Due Trades. Extra tests, each with a genuine red: Q1 uncovered item ("Outside the market calendar: Fri Nov 20", no Record expiration), row 24.9 NotASession note, row 24.2 "Recorded", Record expiration only while Writable, the option Mark line, row 24.8 payoff line, the Mark blocker link focusing the contract row, row 24.7 `AfterExpiration`, the "Instruments:" list by label, MarkEntry's zero note; coordinator: **the option card's `datedLastClose` defect fixed** (built for Stock only, as Trade Views does), Mark rows and the MarkMissing blocker carry the Trade's Instrument (BRK.B keeps its dot), an owed reflection carries its Expiration. Two log irregularities corrected in the log (an invalid "Recorded" red from a fixture; a row mislabelled green that was the payoff red). **First-run pass (flagged):** the Daily Review covered-plus-uncovered case B5 asked for (built by T7.23-B5); mutation: the `SessionPolicyCoverage` branch of `settlementTimeOf` returning a Value, failure `AssertionError: expected [ { tradeId: 'id-0071', …(1) }, …(2) ] to deeply equal [ … ]`, restored. typecheck, tsc6, lint, lint:deps, verify:wording exit 0; `src/ui`, `src/coordinators`, `tests` green. No e2e change (e2e names only stock Marks, whose aria-labels are unchanged).

Notes: `isSettlementDueBlocker`, `isSettlementDueAttention` in `calculation-words.ts`; the Settlement panel shows only when `progress.panels` has one (the coordinator's `Settlement` family is ignored, K13); row focus matches a `data-instrument-key` attribute (K18 named the aria-label, which can't be matched against a key); `plural` moved to `format.ts`; row 24.4's sentences carry no final period, as the row gives them. Public: `MarkRow.instrument`, `HistoricalGapGroup.instrument`, `OwedReflection.settlements?`, `MarkEntryProps.instrument`, `describeMarkIssues(issues, prefix, instrument?)`, `PANELS` gains `'Settlement'`.

### T7.24-B1 reflection Execution lines name an option by its role and label

Found in the subagent's summary: the Review card's reflection Execution lines still print `instrument.symbol` ("Buy 1 XYZ @ …") for an option; C5 covers "receipts, Detail rows, reflections". Case: `it should name an option Execution in a Review reflection by the role's action, count and label, "Buy to open 1 XYZ 20 Nov 2026 55 Call @ $2.10", with no fee`.

ocr of `30af5e9c` (`ocr/T7.24-30af5e9c.json`): no findings (21 files reviewed; the background omitted the approved-words rows).

### T7.24-B1 result

Commit `4fba1c2d`. Case: red (list lacked "Buy to open 1 XYZ 20 Nov 2026 55 Call…"), green; read-model field test "should return each owed reflection with the Trade's Planned Legs and their sides…" red (legs undefined), green. No first-run pass. daily-review and `src/ui/screens` 633 passed; typecheck, tsc6, lint, lint:deps exit 0. `OwedReflection.legs?` (always set by the coordinator; optional like `settlements`, so other fixtures stay); `reflectionsOf` takes the `TradeAnalysisRecord`; two exact-equality coordinator tests gain `legs`. Stock reflection lines already had no fee and are unchanged ("Sell 100 ABC @ $52.48"). ocr: no findings (`ocr/T7.24-B1-4fba1c2d.json`).

### Cumulative run after T7.24-B1 (`t7-24-review-settlement`, at `4fba1c2d`)

Run by `suite-runner` on 2026-11-08, browser stage `browser-auto d81d3c41`; `run-complete.sh` printed "run complete" for the runner and in the main session.

| Suite | Result | Output |
|---|---|---|
| Unit | 121 files, 1404 passed, exit 0 | `suite-runs/t7-24-review-settlement-unit.txt` |
| Node integration | 77 files, 159 passed, exit 0 | `suite-runs/t7-24-review-settlement-integration.txt` |
| Browser (Chromium), full tier | 166 passed (7.9 m), exit 0 | `suite-runs/t7-24-review-settlement-browser.txt` |
| Static and verification checks | 12 of 13 exit 0; `verify:capacity` failed, expected until T7.26 | `suite-runs/t7-24-review-settlement-checks.txt` |

Tier: full, printed reason "first matching path since d81d3c41: src/app/types.ts". Ports free before and after. T7.24 is complete.

## T7.26 Capacity basis recomputed for schema 6

Commands: `npm run measure:capacity` (chromium, port 5175 free before and after), then `npm run verify:capacity`.

- The new Option phase (`tools/capacity/measure-page.ts`, `measureOptionPhase`) generates its records through the production facade (`confirmPlan`, `recordPositionChange`) on the engine's real IndexedDB: 600 option Plans in section 1.4's mix (240 Long Call, 160 Long Put, 200 Cash-Secured Put; 40 of the 400 long-option Plans Authorized), 400 entries, 120 partial exits, and 400 Expirations (each Close Review declined).
- `measure:capacity` output: `optionPlans 600, optionLongCalls 240, optionLongPuts 160, optionCashSecuredPuts 200, optionAuthorizedPlans 40, optionEntries 400, optionPartialExits 120, expirations 400`; `jsonBytesPerOptionTradeWithReflection 2522.2`, `bytesPerOptionTradeWithReflection 3679.6` (overhead 1.4589); `jsonBytesPerExpiration 319.5`, `bytesPerExpiration 527.7` (overhead 1.6517). Final line: `measure:capacity OK: M 916073043 bytes, required quota 2748219129 bytes`.
- Projection (`tools/capacity/profile.ts`): the 25,000 Trades are 17,500 stock plus 7,500 option Trades priced from the measured option Plan; the exit side holds 97,000 Executions plus 3,000 Expirations priced from the measured settlement fact (no settlement-fact allowance remains; the stated allowances are unchanged).
- `capacity-basis.json` carries `"schemaVersion": 6`.
- `npm run verify:capacity` exit 0: `verify:capacity OK: required quota 2748219129 = 3 × 916073043, schema 6`.
- Negative check: a temporary edit of `schemaVersion` to 5 in `src/delivery/capacity-basis.json` gave exit 1 with `FAIL basis measured at schema version 5, current is 6: run measure:capacity`; restored to 6 (see `git diff`).
- The D4, D5 and D6 projection tests take a `NO_OPTION_PHASE` helper (`tests/support/capacity-option-phase.ts`); D6's Execution split test and sum now count the 3,000 Expirations.

### ocr review of `e1621799`

`ocr/T7.26-e1621799.json`, 1 ocr comment plus 2 from the reviewer's own reading:
1. ocr, Valid as a description, **dismissed**: nested ternaries pick the strategy kind, strike, stop and target in `measure-page.ts:704` (no repo rule; as earlier). The mix is right: slots 6/4/5 of 15 give 240/160/200.
2. Reviewer, Valid: the new `project()` terms (`optionTradesWithPlanReflection × bytesPerOptionTradeWithReflection`, `expirations × bytesPerExpiration`) have no test with a nonzero Expiration price (`NO_OPTION_PHASE` zeroes it in D4–D6; no D7 projection test). → bug task B1.
3. Reviewer, Valid: `profile.ts:115-116` still says Executions stand in for the whole count "until D7 adds settlement facts". → added to B1.

Arithmetic checked by the reviewer: 100,000 + 97,000 + 3,000 = 200,000; 17,500 + 7,500 = 25,000; Expiration 319.5 JSON bytes × 1.6517 = 527.7 bytes on disk.

### T7.26-B1 the D7 projection terms are tested, and the stale comment goes

- `it should project the D7 option Trades and Expirations at their measured prices` (`tests/integration/d7/capacity-profile.test.ts`, nonzero `bytesPerOptionTradeWithReflection` and `bytesPerExpiration`, 7,500 and 3,000)
- the `profile.ts` comment says what the 200,000 count now holds.
- Commit `5510a9d7`. Both cases passed on their first run (flagged, as decided). The mutation check removed `MEASURED.expirations * m.bytesPerExpiration +` from `project()`. The D7 test then failed with `AssertionError: expected 750000 to be 840000`; the term was restored.
- ocr review: the in-place review of `tools/capacity/profile.ts` (`ocr/T7.26-B1-5510a9d7-inplace.json`) and the relocated review of the new test file (`ocr/T7.26-B1-5510a9d7.json`) both found nothing.

### Cumulative run after T7.26 (`t7-26-capacity-basis`, commit 5510a9d7 plus evidence edits)

| Suite | Result | Output |
|---|---|---|
| Unit | 121 files, 1404 tests passed, exit 0 | `suite-runs/t7-26-capacity-basis-unit.txt` |
| Node integration | 78 files, 160 tests passed, exit 0 | `suite-runs/t7-26-capacity-basis-integration.txt` |
| Browser (Chromium), full tier | 166 passed (7.9 m), exit 0 | `suite-runs/t7-26-capacity-basis-browser.txt` |
| Static and verification checks | 13 of 13 exit 0 (`verify:capacity` now passes) | `suite-runs/t7-26-capacity-basis-checks.txt` |

Tier: full, printed reason "first matching path since 9efbba23: src/delivery/capacity-basis.json". `run-complete.sh`: run complete. Ports free before and after. T7.26 is complete.

## T7.27 Schema fixtures

Commands (base 47ec312b):

- `npm run fixtures:freeze -- --schema 6` -> exit 0; final line: `fixtures:freeze OK: tests/fixtures/workspace-v6 (schema 6, 5 Planned and 5 Open and 2 Closed stock Trades plus 4 option Trades, 3 Accounts)`. (The count wording is the freezer's own; the 4 option Trades are O-C open, O-S closed, O-P closed, JKL planned. `5 Open` counts D6's five stock Open Trades, and the 2 Closed are GIS and SYY.)
- `npm run verify:fixtures` -> exit 0; final line: `verify:fixtures OK: workspace-v1, workspace-v2, workspace-v3, workspace-v4, workspace-v5, workspace-v6 open Ready at schema 6 with views equal to their snapshots`. Lines for v1-v5: `migrated to 6 ... views equal`; v6: `opened without migration, views equal`.
- `npx vitest run tools/fixture-views.test.ts` -> exit 0, 11 passed (four new `optionViolations` cases).
- `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` -> all exit 0.

What the v6 dump contains (frozen as of Friday 2026-11-20 17:00 America/New_York, 22:00Z): D6's content (5 Planned and 5 Open stock Trades, GIS and SYY Closed, Marks, Review Actions, Debts) plus

- O-C (XYZ 20 Nov 2026 55 Call, Long Call, Exercise Intent NotAuthorized): PC1, PC2, X1; one contract Open; Settlement Due at 2026-11-20T21:00:00Z (one Settlement item in Trade Detail, the Open row and the Review Settlement family).
- O-S (MNO 45 Put, Cash-Secured Put): S1 (Sell 2 @ 1.25, fee 1.30), then Expiration of 2 contracts at Friday 16:00; Closed; Close Review deferred.
- O-P (ABC 50 Put, Long Put, Exercise Intent Authorized): P1 and Q1 (Sell 1 @ 2.20, fee 0.65); Closed; Close Reason Target Reached; Close Review completed.
- A Planned Long Call on JKL (JKL 20 Nov 2026 60 Call), 1 contract, intended entry 2.00, Stop JKL at or below 55.00, Target JKL at or above 70.00, Exercise Intent Authorized, planned 2026-11-19 09:00 New York. The plan names no such Trade, so these figures are this fixture's own.
- The expected views add the four Planned payoff views (JKL, O-C, O-S, O-P are Value; stock Trades NotApplicable(NoOptionExpirationAnchor)), option Instruments, and the Settlement family of the Review.

The v1-v5 dumps and expected-views are unchanged. `verify:fixtures` now also runs `optionViolations` (A121) on each of them after migration: no option Instrument, Stock without a multiplier other than 1, both payoff views of every Trade NotApplicable(NoOptionExpirationAnchor), empty settlement lists on Detail, Open rows and Review Trades, and an empty Settlement family; a missing field or list, no Stock Instrument, no Open row where Open Trades exist, or no detail is reported. The earlier-field equality is the existing snapshot comparison. For v6 it also requires the snapshot to hold one Settlement item and four Planned payoff Values.

Negative checks:

- V6 value: changed `details[9].settlement[0].settlementTime.value` in `tests/fixtures/workspace-v6/expected-views.json` from `2026-11-20T21:00:00Z` to `2026-11-20T20:00:00Z` -> `npm run verify:fixtures` exit 1: `FAIL workspace-v6: views differ from expected-views.json at details[9].settlement[0].settlementTime.value`. Restored byte for byte; rerun exit 0.
- A121: `optionViolations` applied to the v6 expected views (which hold option Trades) reports 97 violations, the first `views.planned[0].summary (option Instrument)`. Unit cases in `tools/fixture-views.test.ts` cover a missing payoff, applicable payoff, missing or non-empty settlement, option Instrument, Stock multiplier, non-empty Settlement family, and missing lists.

### ocr review of `3d318b96`

`ocr/T7.27-3d318b96.json` (in place, 0 comments) and `ocr/T7.27-3d318b96-relocated.json` (relocated test file, 2 comments):
1. Doubtful: `optionViolations` (`tools/fixture-views.ts:144`) treats a missing `reviewTrades` as empty when `hasReview` is true, so the per-Trade Review settlement checks are skipped silently; `closeViolations` guards the same case (line 45). The loader always supplies the list today, but the T6.23-B1 rule is that a missing array is reported. → bug task B1.
2. Wrong, **dismissed**: "`optionViolations` is never called". `tools/verify-fixtures.ts:117` calls it for schemas below 6, and the scratch clone lacked that file (a relocation artifact).

Fixture facts the plan does not give, chosen by the task (for the final report): the Planned Long Call JKL 20 Nov 2026 60 Call (1 contract at 2.00, Stop JKL at or below 55.00, Target JKL at or above 70.00, planned 2026-11-19 09:00); O-P's Close Reason "Target Reached" and its completed Close Review; O-S's Expiration reflection declined with "Expired worthless."; the reflection texts.

### T7.27-B1 a missing Review list is reported

- `it should report a missing Review Trade list when the Workspace has a Review` (`tools/fixture-views.test.ts`)
- Red: `npx vitest run tools/fixture-views.test.ts -t "should report a missing Review Trade list when the Workspace has a Review"` failed with an assertion failure: expected `["reviewTrades (missing)"]`, received `[]`.
- Fix: `optionViolations` pushes `reviewTrades (missing)` when `hasReview` and `reviewTrades` is not an array.
- Green: whole `tools/fixture-views.test.ts` 12 passed (exit 0); `npm run verify:fixtures` exit 0 (all six fixtures views equal); `npm run typecheck` exit 0; `npm run lint` exit 0.
- ocr review of `15274b32` (relocated, with `tools/` as of the commit): no findings (`ocr/T7.27-B1-15274b32.json`).

### Cumulative run after T7.27 (`t7-27-schema-fixtures`, commit 15274b32 plus evidence edits)

| Suite | Result | Output |
|---|---|---|
| Unit | 121 files, 1404 tests passed, exit 0 | `suite-runs/t7-27-schema-fixtures-unit.txt` |
| Node integration | 78 files, 160 tests passed, exit 0 | `suite-runs/t7-27-schema-fixtures-integration.txt` |
| Browser (Chromium), task tier | 5 passed (12.5 s), exit 0 | `suite-runs/t7-27-schema-fixtures-browser.txt` |
| Static and verification checks | 13 of 13 exit 0 | `suite-runs/t7-27-schema-fixtures-checks.txt` |

Tier: task, printed reason "no changed path since 47ec312b is on the full-tier list". `run-complete.sh`: run complete. Ports free before and after. Note: `tools/*.test.ts` (including `fixture-views.test.ts`, 12 passed in the task) sits outside `src` and `tests/integration`, so the cumulative unit stage does not run it (as before D7). T7.27 is complete.

## T7.28 Benchmark generator

Generator 6 (`src/app/bench.ts`: marker `tj-bench-generator-v6`, version 6; `src/app/bench-generator.ts`). Stack: schema 6.

### Commands

| Command | Result |
|---|---|
| `npm run build:bench` | exit 0 (`built in 98ms`) |
| `BENCH_SESSIONS=12 node tools/bench-generate.ts` (smoke, same code path, scaled counts, writes only `.cache/bench/smoke-12/`) | exit 0, 228 s. Final line: `bench:generate OK: {"trades":413,"openTrades":3,"plannedTrades":2,"positionChanges":1602,"executions":3088,...,"optionTrades":126,"longCalls":54,"longPuts":32,"cashSecuredPuts":40,"exerciseIntentPlans":86,"authorizedPlans":9,"expirations":50,"expirationsAfterPartialExit":15,"openOptionTrades":1,"openContracts":1,...,"instrumentsPerSessionMean":142.1,"instrumentsPerSessionMax":202}`. Its as-of Review settlement family: one item (AAPL240118C00135000, expiration 2024-01-18, 20 contracts). |
| `npm run bench:generate` (full) | **Not finished.** Stopped by me at about 10 minutes (the brief's limit): 50 of 726 sessions done in 533 s (8,395 of about 127,000 Actions; `review.save` was 490 of the 516 s of Review time, about 16 Actions a second, and a save grows with the stored history, tech debt item 8). A full run is therefore several hours (D4 said "on the order of an hour" for 1,255 sessions at 20 plans a session; D7 has 726 sessions at about 34 plans a session, so each Review walks about 240 Trades). `bench/dataset.json` and `bench/expected-open-rows.json` are therefore **unchanged** (still generator 5, schema 5), and the full counts below are not yet measured. Starting the command deleted the cached generator-5 profile (`.cache/bench/profile`, stamp mismatch), as the command always does on a version change; the aborted directory has no stamp, so it is never reused. Ports 5175, 9341 and 9342 were free before and after. |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |
| `npx vitest run src/app/bench-generator.test.ts tools/bench` | 2 files, 17 tests passed (the file gained 5 cases: option mix, Authorized share, Expiration share and timing, Expirations not counted as Executions, four Settlement Due) |

### Counts against section 1.4

The full-profile counts are asserted inside the generator (it throws and writes nothing if they differ), and the schedule itself is unit tested at 1,000 Trades. Expected at 25,000 Trades, by construction:

| Section 1.4 | Generator |
|---|---|
| 25,000 Trades: 24,700 Closed, 200 Open, 100 Planned | unchanged |
| 30% options: Long Call 12%, Long Put 8%, Cash-Secured Put 10% | 7,500 = 3,000 / 2,000 / 2,500 (asserted) |
| 5,000 long-option Plans, 10% Authorized | 5,000 and 500 (asserted) |
| about 3,000 Expirations (40% of Closed option Trades, 30% after a partial exit) | **2,964** (40% of 7,410, asserted); after a partial exit **891** (30.06%) |
| Open book 200 with 60 option Trades | 60 (asserted); 140 stock Trades on 90 stock Instruments, the 60 option Underlyings among them, plus 60 contracts: 150 Instruments |
| about 150 distinct Instruments per session | 90 stock plus the contracts of the option Trades held at the cutoff: mean 142 and maximum 202 in the 12-session smoke; the full mean is recorded as `instrumentsPerSessionMean` |
| Marks about 190,000 | **not reachable as written**: see choices. Estimate about 120,000 (90 x 726 stock Marks plus the contracts held) |
| Close Review outcomes 24,700 split as D5 | unchanged (same `dispositionsFor` split over the 24,700 Closes, Expirations included; asserted) |
| as-of Friday 2026-11-20 17:00 New York, four Open option Trades Settlement Due | `asOf` 2026-11-20T22:00:00Z, review date 2026-11-20; four Open option Trades expire on 2026-11-20 (asserted: the as-of Review has exactly 4 settlement items) |

`bench/dataset.json` records, when generation completes: `generatorVersion`, `schemaVersion`, `asOf`, `reviewDate`, every count (including the new `optionTrades`, `longCalls`, `longPuts`, `cashSecuredPuts`, `exerciseIntentPlans`, `authorizedPlans`, `expirations`, `expirationsAfterPartialExit`, `openOptionTrades`, `openContracts`, `openStockInstruments`, `optionUnderlyingsHeldAsStock`, `instrumentsPerSessionMean`, `instrumentsPerSessionMax`) and `asOfReview` with the new `settlement` list (Trade, Underlying, contract key, expiration, quantity) beside `walk` and `owedGroup`.

### Choices the plan leaves open (flagged)

- **Session count and Marks.** Session-policy coverage starts 2024-01-01 (decision 51), so 2024-01-02 to 2026-11-20 is 726 sessions, not the 1,255 behind "about 190,000 Marks". With 150 Instruments a session the Marks are about 120,000. Reaching 190,000 would need about 260 Instruments a session, contradicting "about 150". I kept 150 and report the shortfall; the user decides.
- **Port.** `BENCH_PORT` is 5175 (was 5181) in `tools/bench/profile.ts`; the bench origin changes with it.
- **Stock instruments.** The Open stock Trades hold 90 symbols (the former 150 minus the 60 contract slots); a Marks gap on the as-of session is 10 of those 90.
- **Contracts.** Root and symbol are the Underlying. Contracts per Plan: 20 or 40 (enough that an Open Trade's up-to-nine partial fills are whole). Strike by Strategy (call u+5, put u-5, Cash-Secured Put u-2, u = 40 + index mod 160), premium 2.00 to 6.00 (long) or 1.20 or 2.20 (credit), Stop and Target as in the T7.26 capacity phase. A partial exit is a fifth of the contracts in one Execution.
- **Expiration dates.** A Closed option Trade's contract expires on the last session of a week (Friday, or Thursday before a holiday): for an Expiring Trade, the first such session at least 2 to 4 sessions after its last entry (one more after a partial exit); for a Trade closed by sale, the first one on or after its last exit. The Expiration is recorded at that session's close, before the Review; no Close Reason (A113), only a Close Review. So Close Reasons now total 24,700 less the Expirations; their section 1.4 shares apply to the other 21,736 and the old hard-coded exact reason counts were replaced by the option assertions. The four Settlement Due Trades expire on the as-of date, the other Open and the Planned option Trades on a later Friday (7 to 28 days).
- **Marks of contracts.** A contract is marked each session its Trade is held at the cutoff, up to its expiration date, once per contract (Trades on one contract share the Mark). Trades closed by Expiration therefore have no Mark on their expiration day.
- **Executions.** An Expiration is a settlement fact, not an Execution; the Executions are fewer than D6's by about the Expirations' exits.
- **Which Underlyings.** Closed and Planned option Trades use the first 40 symbols like stock; Open option Trade k uses stock symbol k of the 90, so each is also held as stock.
- **As-of clock.** Only the full run's last session uses 22:00Z; a smoke run keeps the session completion plus five minutes.

### Expected-rows tooling

`tools/bench-expected-rows.ts` and `bench:expected` are not changed: they re-render the Open table generically from the cached profile at the dataset's as-of instant, so option rows need nothing new. The comparison of the settlement family against `asOfReview.settlement` (and any option-figure checks in `bench-run.ts`) is T7.29's.

### Decision 95 (revision 60, `7aa783d2`)

The full generation could not finish within the 10-minute limit (about 10.7 s per session; session 50 of 726 after 533 s). The user's decision: keep 726 sessions and about 150 Instruments per session, so the Marks come to about 120,000 rather than 190,000. The full generation runs in the background from the main session.

### ocr review of `82751384`

`ocr/T7.28-82751384.json` (relocated), 2 comments:
1. Valid: `countStored` keys `openInstruments` and `sharedInstruments` by Underlying symbol, so with option Trades they would report 90 (all shared) instead of 150 distinct Instruments. → bug task B1.
2. Doubtful (style), **dismissed**: nested ternaries pick the strike, stop and target (no repo rule; as earlier).

The reviewer re-derived the mix from `schedule()`: 7,500 options split 3,000/2,000/2,500; 500 of 5,000 Authorized; 2,964 Expirations, 891 after a partial exit; 60 option Trades in the Open book; four Settlement Due. To watch in the full run: the Instruments marked per session may average about 170, counting contracts in flight; the actual mean goes into `bench/dataset.json`.

### T7.28-B1 Open Instruments are counted by Instrument key

- `it should count the Open book's distinct Instruments by Instrument key, so a contract and its Underlying's stock are two` (`src/app/bench-generator.test.ts`)

Result (T7.28-B1): `countStored` runs only in the browser, so the counting was extracted as the pure, exported `countHeld(instruments)` in `src/app/bench-generator.ts` (keys each Instrument with `instrumentKey`; `open` is the distinct keys, `shared` the keys held by two or more Open Trades, D6's meaning applied to Instrument keys). `countStored` now collects each Open Trade's planned-leg Instrument from the stored Trades and no longer takes the Open list's underlyings (the only call site is updated). The test name drops the apostrophes of the planned wording so `-t` filtering works.
- Red: `AssertionError: expected { open: 2, shared: 1 } to deeply equal { open: 3, shared: 1 }`; green after keying by `instrumentKey`.
- `npx vitest run src/app/bench-generator.test.ts tools/bench`: 2 files, 18 tests passed. `npm run build:bench`, `npm run typecheck`, `npm run lint`: exit 0.
- Smoke `BENCH_SESSIONS=12 npm run bench:generate`: exit 0, 240 s; `openInstruments` 3, `sharedInstruments` 0 (3 Open Trades: 1 contract plus 2 stocks, matching `openContracts` 1 and `openStockInstruments` 2). `bench/dataset.json` was not rewritten (still 150 / 50 from the full run; the full-run values need the D7 regeneration).
- Readers of the two fields: only `src/app/bench.ts` (type) and the generator; no other reader.
- ocr review of `b4550fe1` (relocated, with `src/` and `tools/` as of the commit): no findings (`ocr/T7.28-B1-b4550fe1.json`).
- Full generation started from the main session in the background after B1 (`npm run build:bench && npm run bench:generate`), logs in `bench-generate/`.

### T7.28-B2 the benchmark serves on its own port, 4175 (`534d3f8c`, at the user's direction)

T7.28 had moved `BENCH_PORT` from 5181 to 5175, the test port, so a multi-hour generation would have blocked every test run and critic. The user: "Please move the benchmark back to using its own port. Use port 4175 to avoid conflicts with any other worktrees." The first full generation, on 5175, was stopped after about 15 minutes. `BENCH_PORT` is now 4175 (`tools/bench/profile.ts`, the only definition; the bench tools import it). Verified by `npx vitest run tools/bench src/app/bench-generator.test.ts` (18 passed). Typecheck and lint at that moment failed only on T7.30's uncommitted test files, then in progress. The full generation was restarted on 4175.

## T7.30 Node mock-free integration suite (I7.1 to I7.15)

Every D7 Node case lives in `tests/integration/d7/`, with shared builders in `support.ts` (option Plans and Position Changes through the facade, the Expiration member, the Settlement Review fixture). The behavior was built by T7.1–T7.24, so every case that passed did so on its first run. Each is flagged and mutation-checked in `evidence/D07/tdd-log.md`, following D6's T6.26.

- **Part 1 (I7.1–I7.8):** 11 new tests in `lifecycle`, `short-put` (3), `expiration-close-review`, `settlement-due`, `review`, `rejections` (2) plus I7.2 and the A121/pointer additions to I7.1 in `migration`; `npx vitest run tests/integration/d7` gives 8 files, 16 tests. Every case passed on its first run, and each was mutation-checked (11 mutations, all restored; `git diff -- src` empty). No product bug found.
  - **Readings of the plan's wording:**
    - I7.1: extends T7.17's migration cases (v1 to v5), adding the A121 views (`compareSnapshot` against `expected-views.json`, `optionViolations`) and the pointer check (new database, `candidates` empty, only the root and the new database remain).
    - I7.2: the unknown Catalog identity sits on workspace-v5's Close Reason fact (`UnknownCloseReason`, naming the Trade and the fact). The old stores equal the fixture, `dumpAll` recording no IndexedDB version.
    - I7.3: "equals the stored Trade" is the Detail read after each step (`positionChanges`, `realizedToDate`). The facade exposes no Trade Record. The "Closed via sale of 1 contract and expiration of 1 contract" words come from the UI's own `closedViaOption`, fed with the Detail's Terminal Disposition. "Close Review in the narrative" is a Detail journal Entry of type `entry-type.close-review`.
    - I7.4: B2 is a Buy 1 @ 0.40, fee 0.65, on Wednesday 10-14 10:00 (the row fixes only its day and quantity); realized 83.70, total 147.40. B is S1, B1, then a Buy 1 @ 0.55 (fee 0.65) dated Monday 10:30. Receipt: one Created link S1 ← B0; realized 63.70 → 132.40; `entryChanges` is empty. S1 alone fills the Plan's two contracts, so no Entry window moves and no shortfall arises. The Trade also becomes Closed with no Close Reason, because the newest recorded change is not the terminal one (D6's `closeRequirementOf`; see item 4 of the report).
    - I7.5: the fourth Long Call is left Open after its rejected Expiration. Friday's Review has no `ReflectionDue` reason and Monday's has one for the deferred Trade.
    - I7.6: "expires 2026-11-20" is the Detail's Option summary and the evaluation's `NotYetDue` item. E-S is recorded with its Close Review deferred, so Monday 17:05 lists it Due in the owed group.
    - I7.7: the Friday Marks of the Settlement Review fixture are saved first. XYZ's Mark is saved at 52.00. After the restart, the Review equals the pre-restart Review apart from its binding.
    - I7.8: the Plan issues are asserted by code as members of the rejection (several arrive together). The clock is Monday 11-23 17:00 so that 11-23 dates are not in the future.

### T7.30-B1 The commit that closes a Trade asks for the Close Reason, even when dated before the last fill (decision 96)

- **Fix:** `closeRequirementOf` (`src/domain/trade-analysis/derive.ts`) no longer returns `NotTerminal` when the newest recorded Position Change is not the terminal one in Fact Order. A candidate that derives Closed is the closing commit: `TerminalWithAgency`, or `TerminalWithoutAgency` when the new change holds an Expiration. `recordPositionChange` reads only this value, so the Close Reason and Close Review checks follow.
- **Cases:**
  - Domain (`closed.test.ts`): a Sell of 70 dated Tuesday 13:00, recorded after X1 (Tuesday 14:00), is `TerminalWithAgency`. Red: `expected 'NotTerminal' to be 'TerminalWithAgency'`. Green.
  - Trade Workflows (`record-position-change.test.ts`): that Sell without a Close Reason is Rejected with `CloseReasonRequired` and `CloseReviewDispositionRequired`, writing nothing; with them it is Recorded, Closed, Close Review owed. First-run pass (flagged in `tdd-log.md`), mutation fails on the Rejected assertion.
  - I7.4 Workspace B (`short-put.test.ts`): the Monday 10:30 Buy is Rejected without a Close Reason; with one it is Recorded, Open to Closed, Close Review Debt, Close Reason on the Trade; the receipt assertions are unchanged. First-run pass (flagged), mutation fails with `expected Rejected, got Recorded`.
  - Execution form: no change. `PositionChangeForm.tsx` does not read the close requirement; it shows Closing the Trade when the entered quantities total the open quantity (ignoring dates) or when the workflow has answered `CloseReasonRequired`. An earlier-dated closing change enters exactly the open quantity, so the section shows; existing coverage is `PositionChangeFormExit.test.tsx` line 54.
- **Commands:** `.claude/scripts/tdd.sh red|green T7.30-B1 ...` (rows in `tdd-log.md`); `npx vitest run src` (121 files, 1413 passed); `npx vitest run tests/integration` (84 files, 170 passed); `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` all exit 0.

### ocr review of `62209ec5` (T7.30 part 1)

`ocr/T7.30-62209ec5.json` (relocated), 4 ocr comments plus 4 from the reviewer's own row-by-row reading:
1. ocr, Wrong, **dismissed**: "the relocated suites are not discovered by Vitest" is a relocation artifact; the real files are under `tests/integration/**/*.test.ts`.
2. ocr, Valid, already bug task T7.30-B1 (decision 96): I7.4 B's Monday 10:30 Buy closes the Trade.
3. ocr, Valid: I7.3 asserts only that PC2's disposing fact is not X1 (`lifecycle.test.ts:94`); it should be the Expiration fact. → B2.
4. ocr, Valid: I7.3's "each result equals the stored Trade" never compares `factRevision`. → B2.
5. Reviewer, Valid: I7.8 omits `ConditionCountNotOne` and the contract issue codes (`RootTooLong`, `InvalidExpiration`, `InvalidStrike`, `StrikeNotPositive`, `StrikeTooPrecise`, `InvalidRight`, `MissingInstrument`). → B2.
6. Reviewer, Doubtful: I7.7 checks T-3's settlement only by a negative quantity, not the assignment explanation (decision 10). → B2: assert whatever the read model carries; if the explanation exists only as UI wording, say so.
7. Reviewer, Valid: I7.6's Thursday assertions would pass on a Review that is not Ready. → B2.
8. Reviewer, Valid: I7.5 does not check the dump's `closeReasonFacts`. → B2.

B2 starts after part 2 lands, since both edit `tests/integration/d7/`.

### ocr review of `f6984753` (T7.30-B1)

`ocr/T7.30-B1-f6984753.json` (in place, `derive.ts`) and `ocr/T7.30-B1-f6984753-relocated.json` (test files, nothing):
1. ocr, Valid (read, not run): the earlier-dated closing commit stores its Close Reason against that change (B0), but `closeReasonIssuesOf` (`src/modules/trade-record/section.ts`) requires the terminal Position Change in Fact Order (B1). A valid Trade would then be flagged `CloseReasonOnNonTerminalChange` on migration, Restore and readiness. → bug task B1-R1. Decision 96 was corrected in revision 62 (`f30b9850`): the Close Reason fact names the terminal change in Fact Order, as the spec already requires.
2. Reviewer, Valid: decision 96's "no durable impact" was wrong. A Trade closed this way before the fix has no Close Reason and fails the section check with `MissingCloseReason`. No such Workspace exists (no release for real use, decision 76); corrected in revision 62, with no repair planned.

The reviewer confirmed that `closeRequirement` is read only by `recordPositionChange`, after its `TradeClosed` gate, so the "newest change closes" rule never runs for a Trade already Closed.

### T7.30-B1-R1 the Close Reason names the terminal Position Change in Fact Order

Bug task from T7.30-B1's ocr review (plan decision 96 as corrected in revision 62). `stagePositionChange` (`src/modules/trade-record/trade-record.ts`) now sets a newly staged Close Reason fact's `terminalPositionChangeId` to the last Position Change in Fact Order (Economic Time, then Recorded Sequence) instead of the change being recorded. The commit that closes still asks for the Close Reason; `terminalTime` is unchanged; `closeReasonIssuesOf` is not relaxed.

- Close Review: its Journal origin stays the Position Change the commit records (`origin: PositionChange`, `momentTime`). The Trade's terminal change is not part of its reference, so it was left as is.
- Cases: unit case in `record-position-change.test.ts` (earlier-dated closing Sell) and I7.4 Workspace B in `tests/integration/d7/short-put.test.ts` (Close Reason names B1; restart is Ready). Each had its own red; rows in `tdd-log.md`.
- `npx vitest run src`: 121 files, 1414 passed. `npx vitest run tests/integration`: 90 files, 181 passed. `npm run verify:fixtures` 0, `npm run lint` 0, `npm run lint:deps` 0.
- `npm run typecheck` and `npx tsc6 --noEmit` fail only on two errors in T7.30 part 2's uncommitted files (`tests/integration/d7/marks.test.ts`, `missing-mark.test.ts`: `underlyingMark` missing on `ClosedCurrentEvaluation`); none in this task's files.

### ocr review of `a4856c53` (T7.30-B1-R1)

`ocr/T7.30-B1-R1-a4856c53.json` (in place) and `-relocated.json`: ocr found nothing. The reviewer's own reading found:
1. Doubtful: `stagePositionChange` picks the terminal change by each change's own Economic Time (its earliest member), then by recorded sequence. The section validator uses the Position Change of the last fact in derived Fact Order (`derived.facts.at(-1).positionChangeId`). The two differ only for a closing change whose members have different times, interleaved with another change. → bug task B1-R2: take the same derived source as the validator.
2. Answered: no reader or validator needs the Close Review's origin to be the terminal change. Close Review lookup and Debt resolution key on the Trade, and the Journal section has no origin check. The owed card and Trade Detail show the Close Review against the change the commit records (B0), which is cosmetic and was already so before.

### T7.30-B1-R2 the Close Reason's terminal Position Change comes from the derived Fact Order

Finding (ocr review of `a4856c53`, Doubtful): `stagePositionChange` chose the Close Reason's `terminalPositionChangeId` by each change's own Economic Time, the section validator by the last fact in derived Fact Order. They disagree for a closing change whose members straddle another change's.

Fix: Trade Analysis's reconciliation now carries `terminalPositionChangeId` (the candidate's Position Change holding the last fact, null unless Closed), taken from the same step list as `terminalTime` and the validator; `stagePositionChange` maps it to its durable id. The validator is unchanged.

- Red: `tdd.sh red T7.30-B1-R2 ... "should name the Position Change of the last fact in Fact Order when the closing change has members either side"`: assertion failure (Close Reason named X1's change).
- Green: same case passes. `npx vitest run src` 1415 passed; `npx vitest run tests/integration` 185 passed, 1 expected fail; `npm run verify:fixtures`, `lint`, `lint:deps`, `typecheck`, `npx tsc6 --noEmit` all exit 0.
- Open point, not changed: staged `terminalTime` is the latest Position Change Economic Time, while Trade Analysis's `terminalTime` is the last-in-order change's own Economic Time (its earliest member). They differ in the same straddling case.

### T7.30 part 2 (I7.9 to I7.15, plus the Entry window case part 1 could not build)

- **Part 2 (I7.9–I7.15 and the Entry window case):** new files in `tests/integration/d7/`: `marks` (I7.9), `payoff` (I7.10, 2 tests), `retries` (I7.11, a and b), `write-gate` (I7.12, 4 tests), `rebuild` (I7.13), `seed` (I7.14), `missing-mark` (I7.15, 2 tests plus 1 `it.fails`), `entry-window` (2 tests). `npx vitest run tests/integration/d7` gives 16 files, 31 passed and 1 expected fail; `npx vitest run tests/integration` gives 92 files, 185 passed and 1 expected fail. Every case passed on its first run and was mutation-checked (see `tdd-log.md`, all restored). `typecheck`, `tsc6`, `lint` and `lint:deps` exit 0. No product code changed.
  - **Product bug found, kept as `it.fails` (I7.15, second half):** an option Trade whose current Marks are Missing gets no dated line. Expected: a dated line for Monday 2026-10-12 valuing 2 contracts at 2.20 with XYZ at 52.00 (market value 440.00, remaining open P&L 38.70). Actual: `datedLine` is undefined on the Detail and the Open item. Likely site: `src/coordinators/trade-views/trade-views.ts` builds `datedLine` only when `analysis.plan.legs[0].instrument.kind === 'Stock'` (two places), and `datedLineOf` in `src/coordinators/valuation.ts` frames the dated evaluation as a Stock named by the contract key, with no Underlying frame. The rest of I7.15 (current figures Missing for the call, naming the call and 2026-10-13) passes as a normal case. Needs a bug task; when it is fixed, change `it.fails` to `it`.
  - **Readings of the plan's wording:**
    - I7.9: T-1 and T-2 are the Settlement Review fixture's Trades, read through Trade Detail at Friday 17:00 with the Marks of 0 dated 2026-11-20. T-1 marked P&L is −101.95 (remaining −190.65 plus realized 88.70), T-2's is −5001 (cost 5000 plus fee 1). `PriceNegative` is checked at Friday; `AfterExpiration` after restarting at Monday 11-23 17:00, because at Friday it arrives together with `SessionNotCompleted`.
    - I7.10: the Marks are dated Tuesday 10-13 with the clock at Tuesday 17:00, and E1 is recorded after a restart at Friday 17:00. "Changes only when XYZ's Mark or the facts change" is shown by correcting the call's Mark to 3.10 (Mark-to-Market 620.00, the payoff views and the value at XYZ unchanged) and XYZ's Mark to 58.00 (value 198.70, payoff views unchanged). The "value at XYZ" is the Detail's `expirationValueAtUnderlyingClose`. "No theoretical option value" is a text check on the payoff view for theoretical, implied-volatility and Greek names.
    - I7.11: E1 is submitted twice as one command (O-C after X1, one contract left); the second returns `Conflict` and the dump is unchanged.
    - I7.12: four cases, one per boundary plus the reads. Each boundary is gated twice (the facade guard and `Persistence.commit`), so the case for `confirmPlan` or `recordPositionChange` cannot tell which gate fired; the mutation check removes both. In Recovery Only the Detail equals the Detail read while Writable.
    - I7.13: one Workspace holds the I7.3 O-C lifecycle, the three I7.4 O-S variants and the I7.7 Settlement Review fixture with E1 on T-1 (Close Review deferred) and the Actions; the Workspace is small enough for one page per list (4 Open, 5 Closed). The private-state damage is the same as D6's I6.14 and is copied into the test file.
    - I7.14: D6's I6.15 already asserts schema 6, manifest v3, the receipt's additions and the Close Reasons for a fresh launch, so `seed.test.ts` adds only the stored Strategies in seed order with exact shapes (rather than repeating it).
    - I7.15: the first Tuesday has the call's Mark 2.40 and no XYZ Mark. In the second, the Detail's Mark resolution is Missing with Monday's stale Mark. Option Trades carry no `marketValue` on the Open list item, so that field is checked on the Detail only.
    - Entry window: with O-S's S1 selling both contracts, and O-C's two contracts, an exit between two entries would leave the Position flat (`FlatBeforeLaterFacts`, or it closes the Trade and a later Buy is `TradeClosed`), so no cut can be built from the plan's own Trades. The case uses O-C's terms with a Plan of 3 contracts (1R $600): PC1 Buy 2 @ 2.10 (Monday 10:00), PC2 Buy 1 @ 1.90 (11:00) and an exit Sell 1 @ 3.00 at Monday 10:30. Recorded after both entries, the exit moves the Entry Resolution Point from PC2 to PC1 and creates a Shortfall of 1, disclosed in the receipt together with the Entry Quality change (window 2 of 3, risk 420.65, reward 579.35, size ratio 2/3, slippage 20.00). Recorded between them (PC1, exit, PC2), the exit creates the same Shortfall, and PC2 changes no Entry and only retains the Shortfall. The 3-contract Plan is this test's reading of the nearest case, not a figure from the plan.
  - **Concurrent work:** while this task ran, another agent edited `derive.ts`, `trade-record.ts` and `record-position-change.test.ts` (T7.30-B1-R2) in the same tree. My mutations touched `derive.ts` and `trade-record.ts` only through narrow edits, each restored; a test run of theirs during a mutation window could have seen it.

### T7.30 part 2 triage (`3bdc7b17`)

- Product bug, → bug task **T7.30-B3**: an option Trade with only an earlier session's Marks has no dated "At … close" line (I7.15 case 3, kept as `it.fails`). `trade-views.ts` builds `datedLine` only for a Stock leg (about lines 490 and 850), and `datedLineOf` (`src/coordinators/valuation.ts`) frames the dated evaluation as a Stock with no Underlying frame. T7.6 says the option dated line "reuses D4's mechanism unchanged".
- Entry window gap case: O-C's terms with a Plan of 3 contracts (1R $600), a quantity the plan does not give, because none of the plan's Trades can cut an Entry window (any exit between entries leaves them flat). Recorded for the final report.
- Concurrency check: part 2's mutations in `derive.ts` and `trade-record.ts` overlapped T7.30-B1-R2's commit `5f387a67`. The main session checked that commit's source diff, which holds only R2's change, and the worktree is clean.
- Order: B3 (product), then B2 (part 1's assertions), one at a time, since both mutation-check `src/`.

### ocr review of `5f387a67` (T7.30-B1-R2), the third round on this bug chain

`ocr/T7.30-B1-R2-5f387a67.json` and `-relocated.json`, 1 comment (the same finding in both):
1. Doubtful: `terminalPositionChangeId` is optional in Trade Record's `DerivedTradeReconciliation`, so a Closed reconciliation that omitted it would store the preparation-only id. The only production caller always supplies it, so this is a latent API weakness.
2. Reviewer, on the Terminal Time question: the disagreement **predates D7**. The stored `terminalTime` (`trade-record.ts:424-430`, T6.6; `rebuild.ts:98-103`) is the latest Position Change Economic Time. The derived `terminalTime` (`derive.ts:1051`, T6.2) is the Economic Time of the change holding the last fact, which D6 A87 defines. They differ only when a multi-member change straddles another change's time. No agreement check compares them (D6 A96: a private index key, never a finding). But `byLifecycleTerminal` sorts the Closed list and A88's cutoff read by the stored time, while the row shows the derived one.

Per the handoff, a third bug round that still leaves findings stops for the user.

### T7.30-B3 an option Trade's dated "At … close" line

I7.15 case 3 flipped from `it.fails` to `it`; red at the assertion (expected undefined to be '2026-10-12'). New unit case in `src/coordinators/trade-views/option-views.test.ts` (red, same assertion); both green after `datedLineOf` took an optional Underlying frame and Trade Views built the line for options from the contract and Underlying frames. Figures match the plan: market value 440.00, remaining-open P&L 38.70. No UI change: the Detail and list render the line from the same fields with D4's words, and the approved-words file has no option-specific dated-line row. Checks: `npx vitest run src` 1416 passed; `npx vitest run tests/integration` 186 passed; typecheck, tsc6, lint, lint:deps, verify:wording exit 0.

**The user's decision on the third-round findings (2026-11-08): "Fix both now."** → bug task **T7.30-B1-R3**:
- `terminalPositionChangeId` required for a Closed reconciliation;
- the stored `terminalTime` (`stagePositionChange`, and `terminalTimeOf` in `rebuild.ts`) becomes the Economic Time of the Position Change holding the last fact, as D6 A87 defines and the derived side already does, so the Closed list sorts by the time it shows.
No new decision: it follows A87.

### ocr review of `3bdc7b17` (T7.30 part 2)

`ocr/T7.30-3bdc7b17.json` (relocated), 1 ocr comment plus 5 from the reviewer:
1. ocr, Valid: the Entry window case's Lot Match accepts any opening Execution and doesn't pin the disposing one (`entry-window.test.ts:89`). → B2.
2. Valid: I7.13 compares only three private indexes; `byOutstandingDue`, the Debts indexes, `exposureStart` and `anchorTradeId` aren't damaged or compared. → B2.
3. Valid: I7.10 doesn't assert Planned for X1′, scans only `payoff` for a theoretical value, and doesn't re-check the value at XYZ after X1. → B2.
4. Doubtful, **dismissed**: I7.9's two rejections are each covered by the final dump equality, which is what the row asks.
5. Valid: I7.15's dated-line case doesn't assert the "At Mon Oct 12 close" label (B3 has since flipped it to `it`). → B2.
6. Wrong, **dismissed**: a relocation artifact (discovery patterns).

### T7.30-B3 note

The Review card's `datedLastClose` stays Stock-only, by design: T7.15 builds an option card's dated last close from the Underlying frame as a Stock Instrument (C6, K18). Not a defect.

B2 now covers part 1's six findings and part 2's four. It runs after B1-R3, since both mutation-check `src/`.

### ocr review of `00fd4bb1` (T7.30-B3)

`ocr/T7.30-B3-00fd4bb1.json` (in place, 2 comments) and `-relocated.json` (none), plus 2 from the reviewer:
1. ocr, Valid: when the call has no Tuesday Mark but XYZ has one, the Underlying frame is Available on Tuesday and never exposes XYZ's Monday Mark, so the Monday dated line is dropped (`valuation.ts:40`). The option's dated evaluation needs the Underlying's Mark at the dated close, fetched for that date. → bug task B3-R1.
2. ocr, Valid: returning no dated line when the Underlying has no Mark at that close drops the contract-only figures too. A110's independent availability, which the current figures already follow, says those should show, with the Underlying-dependent figures `Unavailable(MarkMissing)`. → B3-R1.
3. Reviewer, Valid: a stale "Expected to fail" comment in `missing-mark.test.ts:69-73`. → B3-R1.
4. Reviewer, Valid: no case covers a single missing Mark in either direction, or the at-entry path. → B3-R1.

The Stock path is confirmed unchanged. B3-R1 runs after B1-R3 (both in `src/coordinators/`), and B2 after that.

### T7.30-B1-R3 the stored Terminal Time is the terminal Position Change's, and the terminal change id is required when Closed

- **Required id (compile-time, no red test):** `DerivedTradeReconciliation` is now a union in both `derive.ts` and `trade-record.ts`: `expectedLifecycle: 'Closed'` carries a string `terminalPositionChangeId`; any other lifecycle carries null. A Closed reconciliation without it does not type-check, and Trade Record has no fallback. Callers: Plan confirmation in `trade-workflows.ts` passes the literal `'Planned'`; the test builders and `e2e/d6/stale-index-entry.ts` supply `candidate:pc-1` when Closed.
- **Stored Terminal Time:** `stagePositionChange` takes the Economic Time of the Position Change named by `terminalPositionChangeId`. `rebuild.ts` `terminalTimeOf` orders the stored Executions and Expirations by Economic Time then Recorded Sequence (Trade Analysis's Fact Order), takes the last, and returns the Economic Time of the Position Change whose `memberIds` hold it. No new dependency (`lint:deps` exit 0).
- **Red/green** (`tdd-log.md`): (a) workflow case, stored `terminalTime` 14:00 instead of the derived 13:00; (b) rebuild case, same 14:00 vs 13:00; (c) Closed-list order after rebuild, got [trade-a, trade-b], expected [trade-b, trade-a]. All green.
- **Fixture change:** `schema-v5.test.ts` rebuild fixture had Position Changes with no members; each now has one Execution and the Trade an `exposureStart`.
- **Checks:** `npx vitest run src` 1419 passed; `npx vitest run tests/integration` 186 passed; `npm run verify:fixtures` OK (all six views equal, no snapshot change); `typecheck`, `tsc6`, `lint`, `lint:deps` exit 0.

### ocr review of `5b0a0dfb` (T7.30-B1-R3)

`ocr/T7.30-B1-R3-5b0a0dfb.json` and `-relocated.json`: ocr found nothing. The reviewer confirmed that the rebuild's ordering matches Fact Order on well-formed data, that the stored and derived `terminalTime` are now identical for a Closed candidate, and that the `schema-v5.test.ts` fixture fix is legitimate. It also raised three Doubtful points:
1. `terminalTimeOf` considers every stored Execution and Expiration, while `derive` counts only the members a Position Change lists. Not producible today. → absorbed by R4.
2. For a stored-Closed Trade that isn't flat (`LifecycleDisagreement`), the rebuild still writes a time. **Dismissed**: it predates the commit, and A96 rebuilds the key while the disagreement stays visible.
3. A `terminalPositionChangeId` naming no Position Change stages a Closed Trade with no time, silently. → absorbed by R4.

**The user's question (2026-11-08):** "Should there not be a domain function that handles ordering that both can use instead?" Yes: Fact Order, the effective-version rule and the choice of terminal change are implemented separately in `derive.ts`, `rebuild.ts` and `trade-record.ts`. → **T7.30-B1-R4** (refactor): one exported Trade Analysis function, used by derive, stage and rebuild. It runs after B3-R1 lands.

### T7.30-B3-R1 an option's dated line pairs the Underlying's Mark at the dated close

- **Mechanism:** `datedCloseOf` (new, `valuation.ts`) names the dated close's date. Trade Views (`datedLineOfTrade`, now async inside the factory) reuses the Underlying's current frame when it is for that date, else asks Market Data for the Underlying's `Historical` frame at that date. `datedLineOf` requires the Underlying's frame at the dated date and hands its resolution to `evaluate` as it is, so a Missing Underlying leaves the line with contract-only figures as Values and the Underlying-dependent ones `Unavailable(MarkMissing)` for XYZ and that date (A110). The Open list computes the line in its concurrent per-Trade lookup.
- **Shape and words check:** the dated line carries a full `TradeEvaluation`, and the Detail's dated section renders it through `ValuationFigures` and `ExposureFigures`, which already show an Unavailable figure with its approved reason words (the same renderers the current figures use). No new words, no UI change.
- **Cases** (`option-views.test.ts`): (a) call Missing Tuesday, XYZ marked Monday 52 and Tuesday 53: Monday line, Underlying evidence 52 (red: expected undefined to be '2026-10-12'); (b) call Available Tuesday, XYZ Missing: no dated line, since D4 gives the current figures no Stale context or at-entry Lots (first-run pass, mutation below); (c) call marked Monday, XYZ no Monday Mark: line kept, market value 440 and remaining-open P&L 38.70 as Values, Stop reading and reward to target `Unavailable(MarkMissing, XYZ, 2026-10-12)` (red, same assertion as (a)); (d) at-entry path: a contract bought after Tuesday's close, line at Tuesday with XYZ's Tuesday Mark (first-run pass, mutation below).
- **First-run passes:** (b) mutated by dropping `&& evaluation.atEntry`, failing with "expected { tradingDate: '2026-10-13' ... } to be undefined"; (d) mutated by giving the Underlying's dated observation a Missing resolution, failing with "expected a Value, got Unavailable". Both restored.
- **Stale comment** in `missing-mark.test.ts` removed.
- **Checks:** `npx vitest run src` 1423 passed; `npx vitest run tests/integration` 186 passed; `verify:fixtures` OK; `typecheck`, `tsc6`, `lint`, `lint:deps`, `verify:wording` exit 0.

### ocr review of `7aeb6f6b` (T7.30-B3-R1)

`ocr/T7.30-B3-R1-7aeb6f6b.json` (1 comment) and `-relocated.json` (none):
1. ocr, Valid: the Open list issues one `Historical` `ResolveFrames` request per option Trade whose dated close differs from the frame date, concurrently and without deduplication (`trade-views.ts:718`, from about :919). D4 T4.31's cumulative count (AC-PERF-001) allows an Open page one `observations` read plus one `byInstrumentDate` per Missing Instrument; this makes it N+1. Trade Detail stays within T7.29's "at most one". → bug task **B3-R2**: one request per distinct dated close date carrying all its Underlyings, as A111's "per distinct date" rule does; an Open-list request-count case with option Trades; and handling of a non-`Frames` answer the way `currentFrames` does, since today a single throw rejects the whole page through `Promise.all`.

Confirmed: the Stock path is unchanged; `datedLineOf`'s option throw is unreachable from the Review (Stock only) and from the fixtures; a Stale or Missing Underlying gives contract-only Values per A110. B3-R2 runs after R4.

### T7.30-B1-R4 one Fact Order source for the terminal Position Change

- **Mechanism:** `terminalPositionChangeOf(changes)` (new, exported from `src/domain/trade-analysis/`, generic over `TerminalCandidate`: Economic Time plus the ordering keys of the listed Executions and Expirations) returns the change holding the last member in Fact Order, built on `factOrder` (Executions before Expirations at a full tie), counting only listed members. `derive` uses it for `terminalTime` and the reconciliation's `terminalPositionChangeId` (its private copy, which relied on the last step, is gone). `rebuild.ts` `terminalTimeOf` only maps stored records (latest version, members via `memberIds`) to it, with no sort of its own. `stagePositionChange` keeps the id derive returns, so derive remains the single source, and now throws when a Closed reconciliation's id names no Position Change (absorbs Doubtful point 3 of the R3 review; point 1 is absorbed by the listed-members rule).
- **Mutation:** `factOrder` comparing Economic Time in reverse (the Recorded Sequence-only reversal fails derive's cases but not the R3 tests, whose times differ). Command: `CLAUDE_FULL_OUTPUT=1 npx vitest run src/domain/trade-analysis/replay.test.ts src/persistence/schema-v5.test.ts src/coordinators/trade-workflows/record-position-change.test.ts`. 21 failed: derive (`replay.test.ts` "should order effective facts by Economic Time then Recorded Sequence..."), stage (`record-position-change.test.ts` "should store the Terminal Time of the Position Change holding the last fact..." and "should name the Position Change of the last fact in Fact Order..."), rebuild (`schema-v5.test.ts` "should rebuild byLifecycleTerminal from trades with identical contents..."). Restored.
- **Checks:** no assertion edited; `npx vitest run src` 1423 passed; `npx vitest run tests/integration` 186 passed; `verify:fixtures` OK; `typecheck`, `tsc6`, `lint`, `lint:deps` exit 0. No new unit test: the function is covered through all three consumers.

### ocr review of `c5e4bfaa` (T7.30-B1-R4)

`ocr/T7.30-B1-R4-c5e4bfaa.json`: ocr found nothing. The reviewer confirmed derive's and the rebuild's behavior is unchanged, and that the dependency rules hold. Its own points:
1. Design: `stagePositionChange` throws a plain `Error` when the Closed reconciliation's id names no Position Change. That is reachable only from a bad caller, since `candidateDigest` does not cover the id; `ReconciliationMismatch` would fit the module's other agreement failures.
2. Valid, duplication: `closeReasonIssuesOf` (`section.ts:122`) still picks the terminal change itself (`derived.facts.at(-1)?.positionChangeId`, Executions only). It agrees today because an Expiration-ended Trade returns early, but it is a second definition.
3. Awareness, **dismissed**: `entryWindowOf` and `deviationsOf` order Position Changes by the change's own time. That is intended for entry and deviation placement, not a terminal choice.
4. Info: the other `economicTime` sorts take an earliest time and should not use the shared function.

Points 1 and 2 are the sixth round on this bug chain, so they go to the user.

### T7.30-B3-R2 one dated-close frame request per distinct date on the Open list

- **Mechanism:** `datedLineOfTrade` is split in `trade-views.ts` into `historicalNeedOf` (the Underlying and dated date an option's line still needs, when the current frames lack it), `historicalFrames` (one `Historical` `ResolveFrames` per distinct date, carrying every Underlying that date needs, dates concurrent) and `datedLineWith` (synchronous, pairing the Underlying frame from the current frames or that map). The Open list evaluates every Trade first, collects the needs, makes the requests once, then builds the lines. Trade Detail asks for its one need through the same functions (at most one request).
- **Non-Frames answer:** like `currentFrames` on an uncovered session, which leaves frames without a Mark, a `Historical` answer that is not `Frames` (coverage rejection included) leaves that date without Underlying frames, so its Trades get no dated line and the page and Detail stay Ready. Unlike `currentFrames`, which throws on a non-coverage non-`Frames` answer, this path never throws: the dated line is an addition to the current figures, so losing it is the gentlest outcome (the Trade's current figures are untouched).
- **Cases:** (a) `tests/integration/d7/open-list-query-count.test.ts`: two Long Calls on XYZ (dated Monday 10-12), a Long Put on ABC (dated Friday 10-09), two Stock Trades, as of Tuesday 17:00; observations reads are exactly D4's (one `getAll`, one `byInstrumentDate` `openCursor` per Missing Instrument, four here) plus one `getAll` per distinct dated date (two); red: expected 7 observations requests to equal 6 (three Historical reads, one per option Trade). D4's rule as written (one `getAll` plus one cursor per Missing Instrument) leaves no room for the Historical reads, so this case states the added per-date read as the extension, per the brief. (b) `option-views.test.ts` "should keep the Open page Ready ... when Market Data rejects the Historical request": red with the runtime exception "Market Data returned Rejected for the Underlying's frame at the dated close".
- **Checks:** `npx vitest run src` 1424 passed; `npx vitest run tests/integration` 187 passed; `verify:fixtures` OK; `typecheck`, `tsc6`, `lint`, `lint:deps` exit 0.

### T7.30-B1-R5 the section check names the terminal change through the shared function

- **Mechanism:** `closeReasonIssuesOf` (`section.ts`) now takes the terminal change from `derived.reconciliation!.terminalPositionChangeId` (null mapped to undefined) instead of `derived.facts.at(-1)?.positionChangeId`. Chosen over calling `terminalPositionChangeOf` directly because the section already derives the Trade as a candidate of itself, so the reconciliation is present, and it comes from `terminalPositionChangeOf`: one source with no second import or call. The early return for Expiration-ended Trades is kept. The reconciliation id is null for a non-Closed Trade, which matches the old `closed ? ... : undefined`. The throw in `stagePositionChange` is left as is, per the user's decision.
- **Mutation:** `terminalPositionChangeOf` taking `.at(0)` instead of `.at(-1)`. Command: `CLAUDE_FULL_OUTPUT=1 npx vitest run src/modules/trade-record src/domain/trade-analysis src/persistence/schema-v5.test.ts src/coordinators/trade-workflows/record-position-change.test.ts`. 11 failed, including `section.test.ts` ("should accept Closed Trades whose lifecycle and Close Reason agree with their facts, ..." and "should report DuplicateFactIdentity when a Close Reason fact reuses another fact identity"), `close.test.ts` (R3), `closed.test.ts`, `expiration.test.ts`, `record-position-change.test.ts`, `schema-v5.test.ts`. Restored; `git diff` shows only `section.ts`.
- **Checks:** no assertion edited; `npx vitest run src` 1424 passed; `npx vitest run tests/integration` 187 passed; `verify:fixtures` OK; `typecheck`, `tsc6`, `lint`, `lint:deps` exit 0.

### T7.28 full generation (generator 6, schema 6, port 4175)

`npm run build:bench && npm run bench:generate` from the main session in the background, at `534d3f8c` (after B1 and B2): build exit 0, generate exit 0, from 05:30:40 to 08:04:29 (9,227 s; about 12.7 s per session, flat). Logs are in `bench-generate/` (`build.log`, `generate.log`, `run.txt`); `bench/dataset.json` and `bench/expected-open-rows.json` were rewritten.

Counts against section 1.4, as amended by decision 95:

| Kind | Section 1.4 | Generated |
|---|---|---|
| Trades | 25,000 (24,700 Closed, 200 Open, 100 Planned) | 25,000 (24,700, 200, 100) |
| Option Trades | 30%: Long Call 12%, Long Put 8%, Cash-Secured Put 10% | 7,500: 3,000, 2,000, 2,500 |
| Executions and settlement facts | about 200,000, of which about 3,000 Expirations | 187,435 Executions plus 2,964 Expirations = 190,399 |
| Expirations after a partial exit | 30% | 891 (30.1%) |
| Long-option Plans with Exercise Intent | 5,000, 10% Authorized | 5,000, 500 |
| Open book | 200 Trades, 60 options | 200, 60 (60 contracts) |
| Distinct Instruments per session | about 150 | mean 147.4, max 160; Open book 150 (50 shared) |
| Marks | about 120,000 (decision 95) | 106,985 (plus 1,069 corrections) |
| Close Review outcomes | 24,700 | 20,501 Entries + 4,100 declines + 99 Outstanding = 24,700 |
| Sessions | 726 | 726 |

Close Reasons total 21,736 = 24,700 − 2,964 Expirations (A113). `dataset.json` records generator 6, as-of `2026-11-20T22:00:00Z`, and an `asOfReview` with 4 settlement items, a walk of 200 and the owed group. The Marks come in below decision 95's rough 120,000 because the mean is 147.4 Instruments per session, not 165: 147.4 × 726 ≈ 107,000.

**For T7.29:** this profile was generated by code at `534d3f8c`. Since then, B3, B3-R1 and B3-R2 changed the option dated line on the Open list, and R3 changed the stored Terminal Time for straddling changes (none generated). Rebuild `dist-bench` from HEAD, and re-render `bench:expected` if `bench:run`'s row comparison differs only in the option dated line.

### ocr review of `51c21f36` (T7.30-B3-R2) and `c773f456` (T7.30-B1-R5)

**B3-R2** (`ocr/T7.30-B3-R2-51c21f36.json`, 1 comment; `-relocated.json`, none):
1. ocr, Valid (latency only): the Open list awaits every Historical frame request before starting the settlement lookups, which used to run concurrently (`trade-views.ts:957`).
2. Reviewer, Doubtful: `historicalFrames` swallows every non-`Frames` answer, whereas `currentFrames` absorbs only a `SessionPolicyCoverage` rejection and throws otherwise. A real Market Data fault would silently drop dated lines.
3. Reviewer, minor: the query-count test has no case with two Underlyings on one date, and it leaves a `console.log` in place.
The grouping, Trade Detail's at-most-one request and the exact counts are confirmed. **Held:** what happens to these depends on the user's pending Open-page budget decision. With a contract-only dated line on the Open page, the Open list's Historical reads go away.

**B1-R5** (`ocr/T7.30-B1-R5-c773f456.json`): no findings; the id is confirmed the same as before. The B1 chain is closed.

### T7.30-B2 strengthen the D7 Node integration assertions the two ocr reviews found weak

Test-only (`tests/integration/d7/`); `git diff -- src` is empty. Mutations are logged in `tdd-log.md` (notes for T7.30-B2).

- Reviews: part 1 items 3 to 8 and part 2 items 1, 2, 3, 5 are covered. Items marked dismissed (I7.9 rejections, discovery patterns) are untouched.
- I7.3: PC2's disposing fact equals the Expiration fact (from the dump, contained in the receipt's `createdFactIds`); `factRevision` of the receipt and of `postCommit.trade` equals the Detail's for Planned, each Open step and the Closed Detail.
- I7.8: new case for `ConditionCountNotOne` and the seven contract codes, all reachable through `confirmPlan` (the facade checks contract text, so `InvalidRight` and a malformed expiration pass the facade even though the Plan form's choice and date picker prevent them). **Product gap (not fixed, reported):** `assessPlan` returns `details.extraConditions`, but `confirmPlan`'s issue type (`types.ts:51`, `trade-workflows.ts:94`) carries only `details.breakeven`, so the facade drops it. The assertion is kept as `it.fails`; flip it to `it` if the facade is meant to pass it on.
- I7.7: the assignment explanation is UI wording (`ReviewSettlement.assignmentSentence`), keyed by the item's signed quantity; the test asserts the read-model fields (T-3's quantity exactly -2, expiration 2026-11-20, T-1's +1 for the exercise side).
- I7.6: Thursday's Review `kind` is `Ready`. I7.5: stored `closeReasonFacts` empty for the three Trades (field omitted when none, so `?? []`). Entry window: the Lot Match's opening Execution is PC1's Execution and the disposing one the exit's. I7.13: damage extended to `exposureStart`, `outstandingDue` and `anchorTradeId`; compares `byOutstandingDue`, the Debts `byAnchorTrade`, and the stored Trades and Debts (four Outstanding Debts). I7.10: Planned unchanged for X1 prime, theoretical-value scan over the whole Detail at four points, value at XYZ 58.00 after X1 is 198.05. I7.15: the dated line's date label ("At Mon Oct 12 close" via `shortDate`) and Mark 2.2.
- Mutations: every item has one that the old assertion survived and the new one catches, except I7.5 (`closeReasonFacts`): the old `detail.closeReason` check already caught a written Close Reason fact.
- Verification: `npx vitest run tests/integration/d7` 17 files, 34 passed and 1 expected fail; `tests/integration` 93 files, 188 passed and 1 expected fail; `src` 121 files, 1424 passed; `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` exit 0.

### T7.30-B2 triage (`c13d07b9`)

Nine of the ten gaps pass on the real code, each mutation-checked. The tenth, `details.extraConditions` on `ConditionCountNotOne` through `confirmPlan`, fails, and was kept as `it.fails`. **Dismissed as a defect**: nothing in the plan or the approved words uses it (row 19.23's sentence "An option Plan takes one Stop and one Target." names no conditions), and no production reader takes `extraConditions`. The domain detail is T7.2-B1's own choice. The `it.fails` case asserts behavior nothing requires, so T7.30-B3-R3 removes it.

### Decision 97 (revision 63, `145ded6c`)

The user chose one extra read per distinct earlier date: "Let's add the one extra read per distinct earlier date. Make a note that when we implement spreads, we should try to pick up all contracts in the spread on that earlier date in a single read." Recorded as decision 97, with tech debt item 19 for D10. → **T7.30-B3-R3** fixes B3-R2's review findings: the settlement lookups run concurrently again; only `SessionPolicyCoverage` is absorbed, matching `currentFrames`; the query-count test gets two Underlyings on one date and loses its `console.log`. It also removes B2's `extraConditions` `it.fails` case.

### T7.30-B3-R3 the Open list's earlier-date reads: concurrency, error handling, test gaps

From the ocr review of `51c21f36` (T7.30-B3-R2).
- Concurrency: the Open list now starts the Historical frame requests and the settlement lookups together and joins them (`Promise.all`), as the settlement lookups ran before B3-R2. No ordering-observable test exists (same fake-indexeddb, no hook for start order), so no red; the existing Open list tests stay green.
- Error handling: `historicalFrames` absorbs only a `Rejected` carrying `SessionPolicyCoverage`; every other non-`Frames` answer throws, as `currentFrames` does. B3-R2's test already used the coverage rejection. New red/green case: a `NotASession` rejection makes `browseTrades` reject.
- Test gaps: query-count case for two Underlyings needing the same earlier date (one Historical read; first-run pass, mutation-checked in `tdd-log.md`); stray `console.log` removed.
- B2's `it.fails` case on `details.extraConditions` through `confirmPlan` removed (dismissed by the main session); the ConditionCountNotOne code assertion stays.
- Verified: `npx vitest run src` 1425 passed; `npx vitest run tests/integration` 189 passed, no `it.fails` left; `npm run verify:fixtures` OK; `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` exit 0.

### ocr review of `c13d07b9` (T7.30-B2)

`ocr/T7.30-B2-c13d07b9.json` (relocated), 2 ocr comments plus 2 from the reviewer:
1. Valid: the `ConditionCountNotOne` case sends an extra Stop and an extra Target in one command and checks the code with `arrayContaining`, so dropping either family's check would still pass. Its title also promises "naming the extra condition", which nothing asserts. → bug task **B2-R1**: separate Stop-only and Target-only commands, and a title without "naming".
2. Ignored: the `it.fails` case, removed by B3-R3.
3. Doubtful, **dismissed**: I7.15 rebuilds the "At Mon Oct 12 close" label from `shortDate` instead of reading it from the UI. A Node test can't render the UI. It asserts the read-model fields (`tradingDate`, Mark) and the shared formatter, and the heading's words are the UI tests' to pin.
4. Wrong, **dismissed**: `closeReasonFacts ?? []` hides nothing, since the stored document omits the field when empty (`trade-record.ts:378`).
The reviewer confirmed that the other gaps are closed and that no assertion is vacuous. B2-R1 waits for the cumulative run to finish.

### ocr review of `18341190` (T7.30-B3-R3)

`ocr/T7.30-B3-R3-18341190.json` and `-relocated.json`: ocr found nothing. The reviewer's own reading:
1. Valid (comment only): `historicalFrames` absorbs any `SessionPolicyCoverage` rejection, while `currentFrames` requires a `date`, which the Historical coverage issue (`market-data.ts:394`) doesn't carry. The behavior is right; the "as `currentFrames` does" comment overstates the match. → B3-R4 (folded into one task with B2-R1).
2. Valid: no test shows that Trade Detail now throws on a non-coverage rejection, a behavior change on Detail. → B3-R4.
3. Valid but predates the commit, **dismissed**: the Open page resolves Catalog labels and `currentFrames` one after the other.
4. Info, **dismissed**: Detail runs its one Historical read and its settlement lookups in turn, within T7.29's "at most one".

### Cumulative run `t7-30-node-integration` (commit 18341190 plus evidence edits)

| Suite | Result | Output |
|---|---|---|
| Unit | 121 files, 1425 tests passed, exit 0 | `suite-runs/t7-30-node-integration-unit.txt` |
| Node integration | 93 files, 189 tests passed, exit 0 | `suite-runs/t7-30-node-integration-integration.txt` |
| Browser (Chromium), full tier | 166 passed (7.9 m), exit 0 | `suite-runs/t7-30-node-integration-browser.txt` |
| Static and verification checks | 13 of 13 exit 0 | `suite-runs/t7-30-node-integration-checks.txt` |

Tier: full, printed reason "first matching path since 10edb51a: e2e/d6/stale-index-entry.ts". `run-complete.sh`: run complete. Ports free before and after.

### T7.30-B2-R1 and B3-R4

- B2-R1 (`65c1f2f8`): the `ConditionCountNotOne` case in `tests/integration/d7/rejections.test.ts` now sends a Stop-only and a Target-only command, each expected Rejected with `ConditionCountNotOne` and an unchanged dump; "naming the extra condition" is gone from the title. Mutation-checked both halves in `plan.ts` (Stop slice, then Target slice, each replaced by `[]`): each fails with "expected Rejected, got Confirmed"; restored.
- B3-R4: the comment above `historicalFrames` now says a `SessionPolicyCoverage` rejection is absorbed and any other non-`Frames` answer throws, and that the Historical coverage issue has no `date`. New `option-views.test.ts` case: `getTradeDetail` rejects on a `NotASession` Historical rejection. First-run pass (built by B3-R3), mutation-checked by absorbing every `Rejected`; restored. `git diff -- src` for the commit is the comment alone plus the test file.
- Verified: see the final commands below.

### ocr review of `6ddaa465..ff7e8143` (T7.30-B2-R1 and B3-R4)

`ocr/T7.30-B2-R1-B3-R4-ff7e8143.json` (in place) and `-relocated.json`: no findings. The reviewer checked the comment's claim against `market-data.ts:394` (the Historical coverage issue carries no `date`) and found it right. The ocr queue for T7.30 is empty.

### Cumulative run `t7-30-b3-r4-final` (commit ff7e8143 plus evidence edits)

| Suite | Result | Output |
|---|---|---|
| Unit | 121 files, 1426 tests passed, exit 0 | `suite-runs/t7-30-b3-r4-final-unit.txt` |
| Node integration | 93 files, 189 tests passed, exit 0 | `suite-runs/t7-30-b3-r4-final-integration.txt` |
| Browser (Chromium), task tier | 5 passed (12.2 s), exit 0 | `suite-runs/t7-30-b3-r4-final-browser.txt` |
| Static and verification checks | 13 of 13 exit 0 | `suite-runs/t7-30-b3-r4-final-checks.txt` |

Tier: task, printed reason "no changed path since 6ddaa465 is on the full-tier list". `run-complete.sh`: run complete. T7.28 and T7.30 are complete; T7.29 runs next, on the T7.28 dataset.

## T7.29 Latency harness and query count

Structural task (breakdown row: `npm run bench:run`; `npm run test:integration -- d7/query-count`). Results: `evidence/D07/bench.md`; test log rows: `evidence/D07/tdd-log.md` (T7.29).

| Command | Exit | Result |
|---|---|---|
| `npm run build:bench` | 0 | `dist-bench` rebuilt from HEAD `a3c036d2` |
| `npm run build` (the harness serves `dist/`) | 0 | |
| `npm run bench:expected` (on a copy of the old file, `/tmp`) | 0 | 200 rows re-rendered at 2026-11-20T22:00:00Z; **`bench/expected-open-rows.json` came out byte-identical** (`git status` clean for `bench/`). So the dated lines T7.30-B3, B3-R1 and B3-R2 changed do not differ on the 60 option rows of this profile at the as-of date; nothing was re-rendered or committed. |
| `npm run bench:run` | 0 | cold p95 112.4 ms, warm p95 47.7 ms; both budgets met; every comparison equal (below) |
| `npm run test:integration -- d7/query-count` | 0 | 1 file, 2 tests passed |
| `npx vitest run tests/integration` | 0 | 94 files, 191 tests passed |
| `npx vitest run tools` | 0 | 3 files, 60 tests passed (includes the new settlement-identity case) |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | 0, 0, 0, 0 | |

Ports 4175, 5175, 9341 and 9342 were free before and after the run.

### Results against the budgets (profile: generator 6, 25,000 Trades, 7,500 option Trades = 30%, 60 Open option Trades, 4 Settlement Due at the as-of Review)

| Measure | Runs | Nearest-rank p95 | Budget | Result |
|---|---|---|---|---|
| Cold start to `tj:interactive` | 30 | 112.4 ms | 2,500 ms | pass |
| Warm Planned-to-Open switch to `tj:open-list-ready` | 30 | 47.7 ms | 1,500 ms | pass |

Disclosed, not gated (medians): open the first Review card 137.3 ms (p95 149.6), Save Marks 115.7 ms, Trade Action save 131.5 ms warm and 121.8 ms cold, Closed tab to its first page 110.5 ms (p95 156.0). The full tables are in `evidence/D07/bench.md`.

### Comparisons, before and after the runs

| Comparison | Expected from | Before | After |
|---|---|---|---|
| Open list: all 200 rows (option figures and dated lines included), headers, Missing Instruments | `bench/expected-open-rows.json` | equal | equal (and each of 30 cold starts equal) |
| First Closed page: 50 rows by Trade, Underlying, Close date | the first 50 of the stored `byLifecycleTerminal` index (the generator records no Closed page, as in D6) | equal | equal (and 10 more renders equal) |
| As-of Review's due reflections (487) | `bench/dataset.json` | equal | equal |
| As-of Review's walk (200 cards) and owed group (99 cards), by Trade and Underlying, in order | `asOfReview` | equal | equal |
| **New:** As-of Review's settlement family (4 items) by Trade, contract, open quantity and expiration date, in order | `asOfReview.settlement` | equal | equal |

The settlement comparison reads each "Settlement Due for ..., which expired ..." blocker and its link's Trade, then opens that Trade's card through the link and reads the Settlement panel's contract and quantity (`compareSettlement` in `tools/bench-run.ts`; pure helpers and a unit case in `tools/bench/compare.ts`).

### Query count (`tests/integration/d7/query-count.test.ts`)

- Review `open`: with 2 due Trades, 4 due Trades, and 2+2 due Trades on two distinct expiration dates, the facade issues the same requests, and the only `observations` read is D6's one `getAll`. **Deviation from the plan's wording:** the breakdown and A111 say one `Historical` frame request (one stored `observations` read) per distinct due expiration date. The code instead asks Market Data for a `ResolveSession` Historical per due item (`settlementItems`, `settlementTimeOf`), which the in-memory calendar answers with no stored read. So the Review open adds no stored read at all, rather than one per date, and at the Market Data query level it makes one session query per due item, not per distinct date. The plan's version of the case was written first and went red on exactly this; the case was reworded to pin the behavior (see the tdd-log note rows). Whether to change the code (one `ResolveFrames` per distinct date) or amend A111 and T7.29 is for the main session.
- Trade Detail: a due option Trade adds at most one `observations` request over the same Trade before it is due (it adds none).
- Open page (decision 97): covered by `tests/integration/d7/open-list-query-count.test.ts` (T7.30-B3-R2, 2 cases); referenced from the header of `query-count.test.ts`, not duplicated or folded in.

### ocr review of `efedd324` (T7.29)

Two runs, model gpt-6.1-sol. In place (`tools/bench-run.ts`, `tools/bench/compare.ts`): 0 comments, `ocr/T7.29-efedd324.json`. Relocated (`tools/bench/compare.test.ts`, `tests/integration/d7/query-count.test.ts`): 1 comment, `ocr/T7.29-efedd324-relocated.json`. Two earlier relocated runs raised only import paths and test discovery, which came from the relocation itself, so they were dismissed. The agent added rows 2–4 from reading the code.

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| medium | `query-count.test.ts:63-64` (ocr) | The Review-open case compares only runs that have due contracts, so it never proves D6's counts are kept: a constant extra read on some store other than `observations` would pass. | Valid. Becomes T7.29-B1. |
| medium | `query-count.test.ts`, Trade Detail case (agent) | The Thursday-versus-Monday difference doesn't isolate the settlement lookup: the clock differs too; `due - notDue <= 1` passes when the difference is negative; neither run's count is asserted. | Valid. Becomes T7.29-B2. |
| low | `tools/bench-run.ts:311-345` `compareSettlement` (agent, answering the brief) | It reads the UI and compares in order, and it can fail. Limits: all 4 items share a date; the settlement time isn't compared; a missing `asOfReview.settlement` returns silently as "not compared". | Valid, with limits. The silent return becomes T7.29-B3. The single date and the uncompared time go to the final report. |
| low | `compare.test.ts:156-165` (agent) | `contractLabel`, `reviewShortDate` and `signedContractsText` re-implement the UI's `instrumentLabel`, `shortDate` and `signedContracts`, and the case never calls the UI functions. | Doubtful. Becomes T7.29-B4. |

#### T7.29-B1 Review open preserves D6's counts

- Defect: an extra constant request on any store passes unnoticed.
- `it should` issue exactly the requests of a Review with no due contracts (same Workspace less the due option Trades, or the same Trades before they are due) when 2, 4, or 2+2 Trades are due.

#### T7.29-B2 Trade Detail settlement lookup isolated

- Defect: a different clock confounds the difference, a negative difference passes, and no absolute count is asserted.
- `it should` at one clock, with one Trade whose contract expired before now and one whose contract expires after, issue the same requests for both Details, with an exact count for each.

#### T7.29-B3 Bench fails when the as-of settlement expectations are missing

- Defect: `compareSettlement` returns silently when `asOfReview.settlement` is absent, so a generation that loses it still passes.
- `it should` fail the comparison, naming the missing expectations, when the profile has Settlement Due contracts but the expectations lack the settlement list.

#### T7.29-B4 Bench label helpers use the UI's functions

- Defect: hand-copied formatting can drift from the UI's.
- `it should` build the expected contract, date and signed-quantity texts by calling `instrumentLabel`, `shortDate` and `signedContracts` (or have the helpers delegate to them), with the existing literal expectations kept.

#### T7.29-B1 result (commit dcf3833b)

- **First-run pass.** The mutation added one `deps.catalog.resolve` to the Review `open` and failed with "expected { 'meta.get': 15, …(7) } to deeply equal { 'meta.get': 13, …(6) }". The source was restored, and `git diff -- src` is empty.
- **Baseline.** The baseline Review has the same number of Trades at the same clock, expiring 2026-12-18. The brief's two options didn't work: a Workspace with no Trades is `Empty`, and a different clock changes the walk. The baseline differs from the due runs only by D6's 4 `observations` `byInstrumentDate` mark reads for live contracts (2 `openCursor`, 2 `getAll`; measured by T7.29-B6, constant across the three baselines). The case removes those reads before comparing, and asserts that the baseline has them and no Settlement items.
- **Absolute pin.** The Review open's measured count at D7 is 20 requests: 13 `meta.get`, 2 `trades.getAll`, 1 `observations.getAll`, and 1 `getAll` each on `journalDebts`, `journalDefinitions`, `journalObligations` and `journalTypes`. `daily-review.ts` has added no read since tag `claude-opus-5.5-d6`, so the count is unchanged in source from D6. No D6 build can open option Trades, so D6 never measured it (T7.29-B5).
- **`tdd-log.md`.** It holds three `green exit=1` rows from abandoned attempts. The script wrote them, and they are not real greens.

#### T7.29-B2 result (commit dc7c88ac)

- **The case.** One clock (Monday 17:00) and two Trades: one expiring 2026-11-13, which is due, and one expiring 2026-12-18, which is not.
- **The live Trade's count is pinned at 22 requests:**
  - `meta.get` 11
  - `observations.openCursor` 2
  - `trades.get` 2
  - `getAll` 1 each on `catalog`, `journalDebts`, `journalDeclines`, `journalDefinitions`, `journalEntries`, `journalTypes` and `observations`
- **The due Trade's count.** It must equal the live Trade's on every store and method except `observations.getAll`, which may exceed it by 0 or 1. Today the two counts are identical, so the one-read allowance is a ceiling, not a measured cost.
- **First-run pass.** The mutation made two extra Historical `ResolveFrames` calls per due item in `settlementItemsOf`. It failed with "expected 2 to be less than or equal to 1". The source was restored.

#### ocr review of `dcf3833b` (T7.29-B1, relocated)

Model gpt-6.1-sol, 1 comment; the raw output is `ocr/T7.29-B1-dcf3833b-relocated.json`. The agent added three findings of its own.

| Severity | Location | Claim | Outcome |
|---|---|---|---|
| medium | `query-count.test.ts:80-82` | The pin of 20 is called "D6's count", but it is D7's count today. No D6 test pins `meta.get`, `journalDefinitions` or `journalTypes`. `daily-review.ts` adds no read since tag `claude-opus-5.5-d6`, but a D6 build can't open option Trades, so nothing can measure the count there. | Valid. Becomes T7.29-B5. |
| low | `query-count.test.ts:73-75` `withoutMarkReads` | Only `baselineTwo` is checked, with `not.toEqual`, and the baseline's `byInstrumentDate` reads (4, not 3, per T7.29-B6) are never pinned. A new constant index read on the live-contract path would be dropped from the baseline unseen. | Valid. Becomes T7.29-B6. |
| low | `query-count.test.ts:40` (ocr) | `reviewOpen` nests one ternary inside another. | Dismissed: a style point only; nested-ternary findings are dismissed throughout D7. |
| low | `tally` key `${store}.${method}` | The key merges store and index `getAll`. | Dismissed: the agent confirmed that the filtered-baseline `toEqual` and the `GET_ALL` check, which both compare `on` and `index`, catch a swap. |

#### T7.29-B5 The Review pin names what it measures

- Defect: the test and its evidence claim a count is D6's when it is D7's measured count.
- `it should` describe the pinned 20 requests as D7's Review open count, unchanged in source from D6's (no read added to `daily-review.ts` since tag `claude-opus-5.5-d6`), with no wording that claims D6 measured it.

#### T7.29-B6 The baseline's mark reads are pinned

- `it should` assert, for each of the three baselines, exactly the removed `observations` `byInstrumentDate` requests (the expected count per baseline), so any other index read fails.

#### T7.29-B3 result (commit 1ffca8f8)

- **The helper.** A new pure `settlementExpectations(settlement, expectedDue)` in `compare.ts`. It throws when `expectedDue` is above 0 and the list is missing or empty.
- **The constant.** `bench-run.ts` passes 4 for the full profile, from a constant with a comment, not derived from the dataset. A `--partial` dataset passes 0, so "not compared" survives only on that path.
- **Red and green.** The red failed with "expected [Function] to throw an error". The first green attempt failed (exit 1) on a test regex mistake, which was then fixed. The final green passed 12 of 12 in `compare.test.ts`.

#### ocr review of `dc7c88ac` (T7.29-B2, relocated)

Model gpt-6.1-sol, 1 comment; the raw output is `ocr/T7.29-B2-dc7c88ac-relocated.json`. The agent added two findings of its own.

| Severity | Location | Claim | Outcome |
|---|---|---|---|
| medium | `query-count.test.ts:107-110` (ocr) | The due Detail may make 22 or 23 requests; ocr suggests pinning it exactly. | Dismissed: T7.29 and A111 allow the due Detail at most one extra request, so an exact pin would reject behavior the plan allows. Anything beyond one extra still fails. |
| low | `detailOf` calls | Neither Trade has a saved Mark, so the live contract takes the missing-mark path rather than the usual marked path. The comment doesn't explain why the counts are identical. | Valid. Becomes T7.29-B7. |
| low | `detailOf` order | The due Detail runs first, so a cache it warms could lower the live count, or hide an extra request on the due side. | Doubtful. Becomes T7.29-B8. |

#### T7.29-B7 Detail counts with Marks

- `it should` give both contracts (and XYZ) their Marks before the Details, so the live Trade takes the usual marked path, and pin both counts again with a comment that explains any difference.

#### T7.29-B8 Detail counts independent of order

- `it should` measure each Detail on a fresh launch (or in both orders) so neither run warms the other.

#### T7.29-B5 and B6 results (commits a6f87d6c, 6eebc1e1)

- **B5.** The comment above the `tally` pin now says the 20 requests are D7's measured count, unchanged in source from D6. The test name and header still say "D6 counts", meaning the counts D6's code makes; neither claims D6 measured the pin.
- **B6.** Each of the three baselines must remove exactly `openCursor`, `openCursor`, `getAll`, `getAll` on `observations` `byInstrumentDate`.
- **B6 first-run pass.** The mutation added one `getAllFromIndex('observations','byInstrumentDate', …)` at the top of `staleSourceOf` in `market-data.ts`. It failed with "expected [ { on: 'index', …(3) }, …(5) ] to deeply equal [ { on: 'index', …(3) }, …(3) ]". The source was reverted.

#### T7.29-B4 result (commit d8707e7e)

- **The helpers delegate.** `contractLabel` builds an Option Instrument and calls `instrumentLabel`, `signedContractsText` calls `signedContracts`, and `reviewShortDate` is `shortDate`. The `SHORT_MONTHS` copy is gone, and the literal case is kept.
- **First-run pass, two mutations.** "Nov." in `dayMonthYear` failed the literal case. "Fr" in `reviewShortDate` failed the new case. Both were reverted.
- **Dependency rules.** `lint:deps` scans `src/` only. `tools/capacity` already imports from `src/`.

#### ocr review of `1ffca8f8` (T7.29-B3)

Model gpt-6.1-sol. In place: 0 comments (`ocr/T7.29-B3-1ffca8f8.json`). Relocated: 1 comment (`ocr/T7.29-B3-1ffca8f8-relocated.json`). The agent added two findings of its own.

| Severity | Location | Claim | Outcome |
|---|---|---|---|
| medium | `tools/bench-run.ts:318` | `partial ? 0 : 4` hard-codes the count, although `src/app/bench.ts` already exports `BENCH_SETTLEMENT_DUE = 4`, which the generator uses. | Valid. Becomes T7.29-B9. |
| low | `tools/bench-run.ts:318` | The generator expects `Math.min(BENCH_SETTLEMENT_DUE, counts.openOptionTrades)`, so a reduced profile with fewer than 4 Open option Trades would throw wrongly. | Valid. Folded into T7.29-B9. |
| high (ocr, relocated) | `compare.ts:86` | `settlementExpectations` is called only by the unit test. | Dismissed: an artifact of the relocation. The relocated review didn't include `bench-run.ts`, and at `1ffca8f8` `compareSettlement` does call it. |

#### T7.29-B9 The expected due count comes from the generator's rule

- `it should` expect `Math.min(BENCH_SETTLEMENT_DUE, openOptionTrades)` due items for a full dataset, and 0 for a partial one, through one shared function that both the generator and the harness call.

#### T7.29-B9 result (commit 71907d03)

- **The function.** `expectedSettlementDue({ partial, openOptionTrades })` lives in `src/app/bench.ts`, because the generator is in `src/` and can't import from `tools/`. It returns 0 for a partial dataset, and otherwise `Math.min(BENCH_SETTLEMENT_DUE, openOptionTrades)`.
- **Who calls it.** The generator's check calls it, and `bench-run.ts` calls it with `dataset.counts.openOptionTrades ?? 0`.
- **Red and green.** The red failed with "expectedSettlementDue is not a function". The green passed 14 of 14.

#### T7.29-B7 and B8 results (commits 4d46468c, 607bc1ef)

- **B7 Marks.** The expired contract is marked on its expiration date (2026-11-13), because a later Mark is rejected as `AfterExpiration`. The live contract and XYZ are marked on 2026-11-23.
- **B7 counts.** The live Detail drops from 22 to 20 requests, with no `openCursor`; the old 22 was the missing-mark scan. The due Detail makes 24: the live 20, plus `MARK_LOOKUP` (1 `meta.get` and 2 `openCursor`) for the expired contract's stale Mark, plus 1 `observations.getAll`. That last request uses the whole allowance of one extra. A hand probe of an unmarked due contract made 22 requests. The agent notes that the stale-Mark `getAll` can't be told apart from the allowed settlement frame read.
- **B7 first-run pass.** The mutation added an extra `historicalFrames` for XYZ in `datedLineOfTrade`, and the case failed. An earlier mutation, two extra `settlementTimeOf` calls, didn't fail, because `ResolveSession` makes no stored read.
- **B8.** Each Detail is now measured after a `restart`.
- **B8 first-run pass.** A `globalThis` first-call flag made the due Detail do one extra `historicalFrames`. It failed with "expected 2 to be less than or equal to 1". This proves the counts don't depend on order. It doesn't prove that the restart clears a module cache, since a module-level cache survives `restart`.

#### ocr review of `a6f87d6c..6eebc1e1` (T7.29-B5 and B6, relocated)

Model gpt-6.1-sol, 0 comments; the raw output is `ocr/T7.29-B5-B6-6eebc1e1-relocated.json`. The agent confirmed that the exact removed-request list is asserted for all three baselines. Its own checks:

| Severity | Location | Claim | Outcome |
|---|---|---|---|
| low | `query-count.test.ts:77-79` | "`daily-review.ts` has added no read since the tag": the file has changed since then (+80/-34, including `settlementItems`), and no test measures the claim. | Doubtful. Becomes T7.29-B10. |
| low | `:76` | The comment chains two "so" clauses. | Valid (wording). Folded into T7.29-B10. |
| low | `:71-72` | "Any other index read fails here", but the filter covers only `observations`; a read on another store is caught later, by the tally. | Valid (wording). Folded into T7.29-B10. |

#### T7.29-B10 The Review-case comments say exactly what is checked

- `it should` word the comments to: (a) say `daily-review.ts` adds no *stored* read since the tag, by source reading (its new settlement code asks Market Data for a calendar answer); (b) use one clause per sentence; (c) say that this assertion catches other `observations` index reads, and that the tally catches reads on other stores. Comments only.

#### T7.29-B10 result (commit c80bea20)

Comments only, in the Review-open case. The file's 2 tests pass.

#### ocr review of `d8707e7e` (T7.29-B4)

Model gpt-6.1-sol, 0 comments, both in place and relocated; the raw outputs are `ocr/T7.29-B4-d8707e7e.json` and `ocr/T7.29-B4-d8707e7e-relocated.json`. The agent confirmed that the Option Instrument built from the OCC key matches the UI's, and that the `BigInt` throw can't hit a value the bench passes, since option quantities are whole contracts. Its own findings:

| Severity | Location | Claim | Outcome |
|---|---|---|---|
| low | `tools/bench/compare.ts:63-69` | `contractLabel` re-parses the OCC key by hand, although `instrumentOf(key)` in `src/domain/instrument/index.ts` does the same parse. | Valid. Becomes T7.29-B11. |
| low | `compare.test.ts:168-179` | The new case builds its Instruments the same way the code does, so it can't catch a parse error. | Dismissed: the literal cases kept at lines 163-167 (for example 'NVDA 20 Nov 2026 107 Call') cover the parse. The new case is meant to catch drift in the formatters only. |

#### T7.29-B11 `contractLabel` uses `instrumentOf`

- `it should` label a contract by `instrumentLabel(instrumentOf(key))`, with the hand parse removed and the literal cases unchanged.

#### ocr review of `71907d03` (T7.29-B9)

Model gpt-6.1-sol. In place: 1 comment (`ocr/T7.29-B9-71907d03.json`). Relocated: 2 comments (`ocr/T7.29-B9-71907d03-relocated.json`). The agent confirmed that the generator and the harness both call `expectedSettlementDue`.

| Severity | Location | Claim | Outcome |
|---|---|---|---|
| medium | `tools/bench-run.ts:319` | `counts.openOptionTrades ?? 0` makes a full dataset that lacks the count expect 0 due items, which brings back B3's silent pass when the settlement list is also absent. Narrow: the current generator always writes the field. | Valid. Becomes T7.29-B12. |
| high (relocated) | `compare-cases.ts:2` | `expectedSettlementDue` isn't exported. | Dismissed: an artifact of the relocation (the parent's `bench.ts`). It is gone on the second run. |
| medium (relocated) | `src/app/bench.ts:29` | Only the test calls the helper. | Dismissed: an artifact of the relocation (the clone has no generator or harness); the in-place diff shows both call it. |

#### T7.29-B12 A full dataset without the Open option count fails

- `it should` throw a "regenerate the profile" error for a full dataset whose `counts.openOptionTrades` is not a non-negative integer, rather than defaulting it to 0.

#### T7.29-B11 result (commit ebfaddd9)

`contractLabel` now calls `instrumentLabel(instrumentOf(key))` and still throws for a key that isn't an option. That throw has no test. The 14 tests pass.

#### ocr review of `6eebc1e1..607bc1ef` (T7.29-B7 and B8, relocated)

Model gpt-6.1-sol, 0 comments; the raw output is `ocr/T7.29-B7-B8-607bc1ef-relocated.json`.

**Verdict on the budget: within it.** The due Detail makes 1 `Current` and 1 `Historical` `ResolveFrames`, and settlement makes 0 stored reads (`ResolveSession` only). The `Historical` read is the dated line at 2026-11-13 for XYZ, which decision 97 and A111 allow. The 4 extra store requests are the `Historical` read (1 `meta.get`, 1 `getAll`, 1 `openCursor`) plus the contract's stale-Mark scan (1 `openCursor`). Restart isolation holds, and no module-level caches were found.

The agent's notes, not made bug tasks (the user is reviewing the bug-task threshold, 2026-11-08):
- The `MARK_LOOKUP` label and comment put the `meta.get` and one `openCursor` under Mark reads, when they belong to the `Historical` read. Medium, wording.
- The "0 or 1" allowance is in effect exact, because `meta.get` +1 and the 2 `openCursor` are hard-coded.
- Counting `observations` transactions would pin the `Historical` request directly. Low.
- The comment about the unmarked probe ("1 cursor more") disagrees with the 22 requests recorded. Doubtful, low.

T7.29-B12 (the `?? 0` default) is not started, for the same reason.

#### ocr review of `c80bea20` (T7.29-B10, relocated)

Model gpt-6.1-sol, 1 comment; the raw output is `ocr/T7.29-B10-c80bea20-relocated.json`. Every changed comment is accurate. The one low finding: two sentences still have more than one clause, against requirement (b). Not a bug task; it is noted for the final report.

## Decision 98 tooling

Scratch clone (`mktemp -d`, never this worktree) with four commits: base; one changing only `src/ui/A.test.tsx`; one changing `src/ui/B.tsx`; one changing `e2e/x.spec.ts`. The stub `package.json` has `test:e2e` = `bash -c "sleep 987 & sleep 988 & wait"`. Script copied from `.claude/scripts/full-suite.sh`.

(a) and (b), run by a scratch script (`verify.sh`) that calls `bash full-suite.sh --choose-tier <parent>` per commit, then `TJ_BROWSER_LIMIT_SECONDS=3 bash full-suite.sh ev lbl browser`; output:

```
changed: src/ui/A.test.tsx  ->  task
changed: src/ui/B.tsx  ->  full: src/ui/B.tsx
changed: e2e/x.spec.ts  ->  full: e2e/x.spec.ts
bash -n exit 0
---
date: 2026-11-08 09:23 EST
commit: 7930551
../full-suite.sh: line 106: 42736 Terminated: 15          perl -e 'setpgrp(0, 0); exec "bash", "-c", $ARGV[0]' "$cmd" >> "$file" 2>&1
== browser: `npm run test:e2e` exit 124 -> ev/suite-runs/lbl-browser.txt

real	0m6.089s
user	0m0.097s
sys	0m0.064s
script exit 1

> test:e2e
> bash -c "sleep 987 & sleep 988 & wait"

TIMED OUT after 3 s (process group killed)
EXIT 124
survivors:
none
```

(c) `bash -n .claude/scripts/full-suite.sh` printed nothing, exit 0 (the "bash -n exit 0" line above checks the same file).

Normal path (stub `test:e2e` = `echo ok`, limit 30): `== browser: npm run test:e2e exit 0`, file ends `ok` then `EXIT 0`, script exit 0, no TIMED OUT line.

Notes: the timed-out file ends with the TIMED OUT line and `EXIT 124`, so `run-complete.sh` sees the stage as finished and failed. `TJ_BROWSER_LIMIT_SECONDS` overrides the 720 s limit and exists only for this check. The process group is created with `perl setpgrp` (macOS has no `setsid`); `pgrep -fl 'sleep 98[78]'` found no survivor.

#### The T7.29 bug chain under the ocr-only rule (user's direction, 2026-11-08)

- **The rule.** From now on, only findings ocr itself raises become bug tasks. Applied to T7.29's bug tasks, ocr raised B1 and B12; the rest came from the reviewer's own reading.
- **B10's ocr finding.** Two comment sentences still chain more than one clause. B10 was the third round of bug tasks on this test. At the user's choice, the finding is noted for the final report and the query-count test's bug chain is closed.
- **B12.** It runs after the cumulative run `t7-29-final`.

## Decision 98 tooling, revision 65

The full browser tier is two foreground stages. `package.json` has `test:e2e:1` (`e2e/d1 e2e/d2 e2e/d4`), `test:e2e:2` (`e2e/d5 e2e/d5r e2e/d6 e2e/d7p e2e/d7`) and `test:e2e` (runs both). Each half builds first and keeps `--grep-invert @release-history`. `full-suite.sh` lost `run_limited`, the perl watchdog and `TJ_BROWSER_LIMIT_SECONDS`; it kept `choose_tier`'s exclusion of `*.test.ts` and `*.test.tsx`. Stages are `unit`, `integration`, `browser-1`, `browser-2`, `browser-task`, `browser-auto <base>`, `checks`; the stage `browser` is a usage error naming `browser-1` and `browser-2`. `browser-auto <base>` runs the task tier itself (writing `<label>-browser.txt`) and, on the full tier, prints `browser tier: full (...)` and `next: run stages browser-1 and browser-2` and runs nothing; the runner then makes the two calls. `run-complete.sh` requires `browser-1` and `browser-2` when either file exists, else `browser`.

Playwright's positional arguments are regular expressions on the file path, so `e2e/d7` also matches `e2e/d7p` (and `e2e/d5` matches `e2e/d5r`); inside `browser-2` that is harmless. A folder argument that matches nothing is fine next to others (`e2e/d1 e2e/d9` lists 23 tests, exit 0) and only fails alone ("Total: 0 tests"), so `e2e/d7` can stay in `test:e2e:2` before T7.31 adds the folder.

### (a) Syntax

```
$ bash -n .claude/scripts/full-suite.sh; echo "exit $?"
exit 0
$ bash -n .claude/scripts/run-complete.sh; echo "exit $?"
exit 0
```

### (b) The two halves equal the old full tier

```
$ npx playwright test --list e2e/d1 e2e/d2 e2e/d4 e2e/d5 e2e/d5r e2e/d6 e2e/d7p --grep-invert @release-history   (old folder set)  -> 166 case lines
$ npx playwright test --list e2e/d1 e2e/d2 e2e/d4 --grep-invert @release-history                              -> Total: 119 tests in 35 files
$ npx playwright test --list e2e/d5 e2e/d5r e2e/d6 e2e/d7p e2e/d7 --grep-invert @release-history              -> Total: 47 tests in 24 files
$ sort(old) vs sort(half 1 + half 2): cmp -> identical; sort -u of the union: 166 lines (no duplicate, none missing)
```

### (c) Scratch clone: `--choose-tier` and `browser-auto` (npm and npx stubbed on PATH; the real suite was not run)

Commit 1 changed only `src/ui/calculation-words.test.ts`; commit 2 added `src/ui/AppShell.tsx`; commit 3 (from commit 2) changed only `e2e/d1/identity.spec.ts`.

```
# test file only
$ full-suite.sh --choose-tier <base>
task
$ full-suite.sh evidence/D07 lab1 browser-auto <base>
browser tier: task (no changed path since <base> is on the full-tier list)
== browser-task: `npm run build:faults && npm run build:releases && npx playwright test e2e/d1 e2e/d2 e2e/d4 e2e/d5 e2e/d5r e2e/d6 e2e/d7p e2e/d7 --grep @every-task` exit 0 -> evidence/D07/suite-runs/lab1-browser.txt
== browser-task: no e2e/d7 folder, only the @every-task call ran
  9 passed
files written: lab1-browser.txt
# plus a UI file
full: src/ui/AppShell.tsx
browser tier: full (first matching path since <base>: src/ui/AppShell.tsx)
next: run stages browser-1 and browser-2, one after the other (nothing ran here)      (no lab2 file written)
# e2e spec only
full: e2e/d1/identity.spec.ts
browser tier: full (first matching path since <base2>: e2e/d1/identity.spec.ts)
next: run stages browser-1 and browser-2, one after the other (nothing ran here)
# the old stage
$ full-suite.sh evidence/D07 lab4 browser
the stage browser no longer exists (decision 98, revision 65): run the full browser tier as two calls, browser-1 and then browser-2     exit 2
# the two stages (stubbed)
== browser-1: `npm run test:e2e:1` exit 0 -> evidence/D07/suite-runs/lab5-browser-1.txt
== browser-2: `npm run test:e2e:2` exit 0 -> evidence/D07/suite-runs/lab5-browser-2.txt
```

### (d) `run-complete.sh`

```
five finished files (unit, integration, browser-1, browser-2, checks)  -> all "finished", "run complete", exit 0
browser-2 file with no EXIT line                                       -> "browser-2: still running or cut off (0 of 1 commands finished)", "run INCOMPLETE", exit 1
browser-1 and browser-2 present, checks missing                        -> "checks: missing (...)", "run INCOMPLETE", exit 1
only browser-1 present (browser-2 absent)                              -> "browser-2: missing (...)", "run INCOMPLETE", exit 1
task tier, four files (unit, integration, browser, checks)             -> "run complete", exit 0
$ .claude/scripts/run-complete.sh evidence/D07 t7-10-trade-record      (existing four-file label, read-only)
unit: finished (EXIT 0 )
integration: finished (EXIT 0 )
browser: finished (EXIT 0 )
checks: finished (EXIT 0 ... 13 EXIT lines, one EXIT 1 )
run complete
exit 0
```

#### T7.29-B12 result (commit e91a9732)

- **The helper.** `openOptionTradesOf({ partial, counts })` in `src/app/bench.ts` returns 0 for a partial dataset. For a full dataset it returns the count, or throws "… regenerate the profile" when the count is missing or not a non-negative integer.
- **Red and green.** The red failed with a TypeError inside the `toThrow` assertion. The green passed 15 of 15 in `compare.test.ts`.

#### ocr review of `e91a9732` (T7.29-B12)

Model gpt-6.1-sol. In place: 1 comment (`ocr/T7.29-B12-e91a9732.json`). Relocated: 1 comment (`ocr/T7.29-B12-e91a9732-relocated.json`).

| Severity | Location | Claim | Outcome |
|---|---|---|---|
| medium | `src/app/bench.ts:32` | A full dataset with no `counts` object, or a null one, throws a raw TypeError rather than the "regenerate the profile" error. | Doubtful: the generator always writes `counts`, and the stamp check runs first. B12 was the third round on the benchmark chain, so this goes to the user (the third-round stop rule). |
| high (relocated) | `compare-test.ts:2` | `openOptionTradesOf` isn't exported. | Dismissed: an artifact of the relocation (the parent's `bench.ts`). |

The user's choice (2026-11-08): the medium finding on B12, a missing `counts` object, is noted for the final report and not fixed. The benchmark bug chain is closed.

### Cumulative run `t7-29-split` (commit e91a9732 plus evidence edits; the checks ran at 34e9ce4b, a docs(plan) commit)

| Suite | Result | Output |
|---|---|---|
| Unit | 121 files, 1426 passed, exit 0 | `suite-runs/t7-29-split-unit.txt` |
| Node integration | 94 files, 191 passed, exit 0 | `suite-runs/t7-29-split-integration.txt` |
| Browser (Chromium), full tier, `browser-1` | 119 passed (4.9 min), exit 0 | `suite-runs/t7-29-split-browser-1.txt` |
| Browser (Chromium), full tier, `browser-2` | 47 passed (3.2 min), exit 0 | `suite-runs/t7-29-split-browser-2.txt` |
| Static and verification checks | 13 of 13 exit 0 | `suite-runs/t7-29-split-checks.txt` |

- **Tier.** Full; printed reason "first matching path since a3c036d2: package.json".
- **Run of record.** This is the first run with decision 98's two foreground browser stages (revision 65). The 166 browser cases match the old full tier.
- **Checks.** `run-complete.sh`: "run complete", checked again by the main session. Ports were free before and after.
- **Superseded run.** `t7-29-final` was stopped at the user's request and is not a run of record.

T7.29 is complete. Decision 99 (revision 67) settles the Review deviation: no stored read for settlement items.

## T7.31 Browser integration suite

### T7.31-F1 Confirming an option Plan leaves a blank page (found by part 1's B7.1)

- **Found.** On `dist-faults` with O-C's terms, Confirm Plan navigates to `/trades/<id>`, but `#root` renders empty, with "TypeError: t.compare is not a function" in the payoff view's segment map. A reload shows the Detail correctly (1R $400.00, "Breakeven 57.00").
- **Cause (the agent's reading).** `PlanForm` passes the confirmed Detail, including `postCommit.payoff` with its `Rational` values, through the router's history `state`. The browser structured-clones history state, which strips the class instances. Unit tests use an in-memory router that doesn't clone.
- **Impact.** Every option Plan confirmation in B7.1–B7.6.
- `it should` render the confirmed option Plan's Detail, with its Planned payoff ("Breakeven 57.00") and 1R, straight after Confirm Plan in the built app, with no page error.
- `it should` keep no class instance in history state, so a structured clone of the navigation state still renders, if the fix keeps state at all.

#### T7.31-F1 result (commit 52ff9dcf)

- **The cause, confirmed.** react-router v7 reads `location.state` back from `window.history.state`, so even a PUSH is structured-cloned.
- **The fix.** The confirmed Plan's Detail is handed to Trade Detail in memory (`confirmed-handoff.ts`: `handOffConfirmed`, `handedOverConfirmed`, `clearHandedOver`). It is taken once, and the navigation carries no state. The just-confirmed view still makes no read. A reload, back/forward and later visits read as before, and T7.22-B3's reload test still passes. `PlanForm.tsx` was the only `navigate(…, { state })` under `src/ui/`, and stock confirmation shares it (`e2e/d1/plan.spec.ts` passes 2 of 2).
- **Reds.**
  - Playwright: the Detail heading was missing on the rebuilt `dist-faults`.
  - Unit: the `structuredClone` of the navigation state wasn't strictly equal.
  - Unit: a Detail read was made where none was expected.
- **Greens.** All pass. 112 tests pass in the two screens' files.
- **Found along the way.** `e2e/d7/support.ts` re-exported d6's `test`, whose fixture serves `dist-releases/d6`, so a d7 spec that doesn't call `server.use('dist-faults')` would test the old release. Part 1 is told to make `dist-faults` the d7 default.

#### ocr review of `52ff9dcf` (T7.31-F1)

Model gpt-6.1-sol. In place: 1 comment (`ocr/T7.31-F1-52ff9dcf.json`). Relocated: 3 comments (`ocr/T7.31-F1-52ff9dcf-relocated.json`).

| Severity | Location | Claim | Outcome |
|---|---|---|---|
| medium | `e2e/d7/support.ts:10` | The re-exported `test` serves `dist-releases/d6`, not the faults build, so the comment is wrong. | Valid. Already in part 1's brief: make `dist-faults` the d7 default and fix the comment. Checked when part 1 commits. |
| medium | `PlanForm.test.tsx:698` | `structuredClone(state)` strictly equal to the state passes for any plain state; asserting no state is stricter. | Valid. Becomes T7.31-F1-B1. |
| high (relocated) | `confirm-option-plan.ts:5` | The spec isn't discovered. | Dismissed: an artifact of the relocation (the real file is `e2e/d7/*.spec.ts`). |
| medium (relocated) | `support.ts:5` | `../d6/support.ts` doesn't resolve. | Dismissed: an artifact of the relocation (the d5r chain wasn't copied). |

The reviewer's notes, not ocr findings: a hand-off left behind when navigation is blocked; the hand-off is taken only at mount.

#### T7.31-F1-B1 The Plan confirmation navigates with no history state

- `it should` assert that the confirmation's captured navigation state is absent (null or undefined, captured for certain), not just that it survives a clone.

### T7.31 part 1 (commit d03a6425): B7.1 to B7.6

- **The cases.** All six pass on `dist-faults`, each run alone. B7.1 genuinely failed before F1 (the blank page). After F1 all six are first-run passes, each mutation-checked with one UI word mutation, and each failure named its own case's text. `git diff -- src` is empty afterwards.
- **The fixes asked for.**
  - `e2e/d7/support.ts` now makes `dist-faults` the default for every d7 test, through an automatic fixture `d7Faults` (ocr's F1 finding 1).
  - `e2e/d7` is added to `test:e2e:release-history`.
- **Run.** All of `e2e/d7`: 11 passed. The `e2e/d7` argument is a regex, so the count includes the `d7p` layout specs.
- **B7.3's fixture.** It uses T-1 to T-3 only; T-4 and T-5 add nothing to the case.
- **Defect found.** The Review card's summary for an option Trade reads "Long 1 shares @ $1.90" and "Long −2 shares @ $1.25". This is T7.31-F2.

#### T7.31-F2 The Review card names an option Trade in share terms

- **Defect.** `tradeSummary` (`src/ui/format.ts:60`) words an Option summary by its contracts, expiration, strike and right (T7.23, row 23.x). The Review card receives a Stock-kind summary for option Trades, so it shows "shares @ price", against C2.
- `it should` give an option Trade's Review card, its name in sentences ("XYZ (…) review" and the hold message), and any other place the card's summary is shown, the same Option summary text as the Open list, for example O-C after PC2 and O-S after S1.

#### T7.31-F2 result (commit 025e457f)

- **The fix.** One builder, `openTradeSummary` in `src/domain/trade-summary.ts`, now serves both Trade Views and Daily Review. Daily Review uses it in three places: the walked item, the card detail's `summary`, and the owed-reflection card's `position`.
- **Red and green.** The red failed with "expected { kind: 'Stock', … } to deeply equal { kind: 'Option', … }" for T-1 (O-C) and T-3 (O-S); the green passed.
- **Other runs.** 829 tests pass across daily-review, trade-views, `src/ui` and the d7 and d5r integration tests.

#### ocr review of `025e457f` (T7.31-F2)

No findings, in place and relocated (`ocr/T7.31-F2-025e457f*.json`). The reviewer's notes, not ocr findings: only the walked item's summary is tested, while the card detail's `summary` and the owed card's `position` changed with it; a spread shows only its first leg's contract (D10).

#### T7.31-F1-B1 result (commit d22974e7)

- **The assertion.** The stand-in records `{ tradeId, state }`. The test asserts the capture ran (`tradeId` 'trade-7') and that the state is null.
- **First-run pass.** The mutation `{ state: { x: 1 } }` in `navigate` failed with "expected { x: 1 } to be null". The source was reverted.

#### ocr review of `d22974e7` (T7.31-F1-B1, relocated)

No findings (`ocr/T7.31-F1-B1-d22974e7-relocated.json`). F1's chain is closed.

### T7.31 part 2 (commit 1d317fd8): B7.8 to B7.13

- **The cases.** Kill after commit; offline cold restart; Recovery Only; a mid-session failure; nothing saved without Save; and responsive and accessible (two tests, with axe on every listed view at 1280 and 390 px, and an Expiration recorded by keyboard). All are first-run passes, each mutation-checked with a UI mutation on a rebuilt `dist-faults`, then restored. `git diff -- src` is empty.
- **Run.** All of `e2e/d7`: 18 passed, including the `d7p` layout specs. No product defects.
- **B7.10.** Recovery Only removes the New Plan route and link, so the case asserts that no New Plan link and no Confirm Plan button exist ("no Plan confirmation").
- **B7.9.** It onboards online. The Plan, the entry and the Expiration then run in one offline launch pinned at Friday 17:00, with the Plan and Economic Times given explicitly.

#### ocr review of T7.31's specs (`d03a6425` and `1d317fd8`, relocated)

Model gpt-6.1-sol: 12 files, 5 comments (`ocr/T7.31-d03a6425-1d317fd8-relocated.json`). The in-place review of `package.json` and `support.ts` made 0 comments (`ocr/T7.31-d03a6425-package.json`). None of the comments are artifacts of the relocation.

| Severity | Location | Claim | Outcome |
|---|---|---|---|
| medium | `responsive-a11y.spec.ts:49` | After the resize, `toHaveValue(/./)` would pass if the Strategy were reset to Long Call. | Valid. Becomes T7.31-B1. |
| medium | `marks-zero.spec.ts:38` | The zero-Mark note isn't asserted for KLM stock. | Valid. Becomes T7.31-B2. |
| medium | `short-put.spec.ts:33` | A page-wide `.first()` can match the error summary instead of the row error. | Valid. Becomes T7.31-B3. |
| medium | `responsive-a11y.spec.ts:151` | The Closed option Detail gets axe at the default width only. | Doubtful. Becomes T7.31-B4. |
| medium | `responsive-a11y.spec.ts:17-18` | At 390 px only axe runs, so a payoff table hidden at narrow width would pass. | Doubtful. Becomes T7.31-B5. |

#### T7.31-B1 to B5 (each one `it should`, test only)

- **B1:** `it should` keep the option Plan form's selected Strategy, Long Put, by its checked label after resizing to 390 px and back.
- **B2:** `it should` show the zero-Mark note for KLM stock before its 0 is saved, as for the MNO put (B7.6).
- **B3:** `it should` find B7.2's rejection beside Execution row 1, not just anywhere on the page.
- **B4:** `it should` run axe on the Closed option Detail at both 1280 and 390 px.
- **B5:** `it should` show every payoff chart's table equivalent at 390 px as well.

These wait for the cumulative run `t7-31-browser-suite`, which holds port 5175.

### Cumulative run `t7-31-browser-suite` (commit 1d317fd8 plus evidence edits)

| Suite | Result | Output |
|---|---|---|
| Unit | 121 files, 1428 passed, exit 0 | `suite-runs/t7-31-browser-suite-unit.txt` |
| Node integration | 94 files, 191 passed, exit 0 | `suite-runs/t7-31-browser-suite-integration.txt` |
| Browser (Chromium), full tier, `browser-1` | 119 passed (4.7 min), exit 0 | `suite-runs/t7-31-browser-suite-browser-1.txt` |
| Browser (Chromium), full tier, `browser-2` | 61 passed (3.9 min), exit 0 | `suite-runs/t7-31-browser-suite-browser-2.txt` |
| Checks | 12 of 13; `verify:fixtures` exit 1 | `suite-runs/t7-31-browser-suite-checks.txt` |

- **Browser.** Every case in sections 6.2 of D1, D2, D4, D5, D6 and D7 passes, 180 in all.
- **The failure.** "FAIL workspace-v6: views differ from expected-views.json at review.families[2].trades[0].summary.kind/quantity/price, reviewTrades[0].attention.summary.…, reviewTrades[0].summary.…". This is T7.31-F2's fix showing up: T7.27 froze the v6 snapshot with the Review's wrong Stock-shaped summary for an option Trade.

#### T7.31-F3 The schema-v6 snapshot records the Review's option summary

- **The fix.** Re-render only `tests/fixtures/workspace-v6/expected-views.json` for the fields F2 corrected. Every `dump.json` stays byte-identical, and the v1–v5 snapshots are unchanged.
- **The proof.** `verify:fixtures` passes, and `git diff 1d317fd8 -- tests/fixtures` touches only that file, at the summary fields named above. List the old and new values in the evidence.

#### T7.31-F3 result

`fixtures:freeze` refuses an existing fixture directory, so the snapshot was not refrozen with it. A scratch script outside the repository (the same `launchOn`, `loadDump` and `viewsOf` calls as `verify-fixtures.ts`) rendered the views from the unchanged `workspace-v6/dump.json`. Three `summary` blocks in `expected-views.json` were edited with the Edit tool to match; the file is then byte-identical (`cmp`) to the render. `dump.json` was never written.

- `npm run verify:fixtures`: exit 0. "verify:fixtures OK: workspace-v1, workspace-v2, workspace-v3, workspace-v4, workspace-v5, workspace-v6 open Ready at schema 6 with views equal to their snapshots".
- `git diff --stat 1d317fd8 -- tests/fixtures`: `tests/fixtures/workspace-v6/expected-views.json | 24 +++++++++++++++---------`, 1 file changed, 15 insertions(+), 9 deletions(-). `--name-only` lists only that file, so every `dump.json` is unchanged.
- Changed values, three places (`review.families[2].trades[0]`, `reviewTrades[0].attention`, and `reviewTrades[0]`, all the same option Trade, a long Call with strike 55 expiring 2026-11-20), each the same change:

| Field | Old (Stock shape) | New (Option shape) |
|---|---|---|
| `summary.kind` | `Stock` | `Option` |
| `summary.direction` | `Long` | `Long` (unchanged) |
| `summary.quantity` | `1/1` | removed |
| `summary.price` | `19/10` | removed |
| `summary.contracts` | absent | `1/1` |
| `summary.expiration` | absent | `2026-11-20` |
| `summary.strike` | absent | `55` |
| `summary.right` | absent | `Call` |

#### ocr review of `90981401` (T7.31-F3)

ocr selected no files ("Review skipped: no items were selected"), because the fixture JSON is excluded as a test file. Not relocated: a data snapshot carries no code to review. The reviewer read the diff and confirmed the three `summary` changes match the Trade's other renderings, with no `dump.json` change. F3 is closed.

#### T7.31-B1, B4, B5 results (commits a42dbc77, bd617794, 6d449297)

All three are first-run passes, each mutation-checked:
- **B1:** the test selects Long Call after the resize; it failed on "Long Put" versus "Long Call".
- **B4:** narrow-width `h1` contrast; it failed with "Closed option Detail, narrow".
- **B5:** `.payoff-table` hidden at narrow width; it failed on a table count of 1 versus 0.

The source was restored and `dist-faults` rebuilt. All of `e2e/d7` gives 18 passed.

#### ocr review of `90981401..6d449297` (T7.31-B1, B4, B5, relocated)

No findings (`ocr/T7.31-B1-B5-6d449297-relocated.json`).

#### T7.31-B2 and B3 results (commits 58182ce6, 17affdc0)

Both are first-run passes, each mutation-checked:
- **B2:** the zero-Mark note dropped for KLM in `CardMarks.tsx`; the note was then not found.
- **B3:** the row's field error removed in `PositionChangeForm.tsx`; the error was then not found inside the "Execution 1" group.

The source was restored and `dist-faults` rebuilt. All of `e2e/d7` gives 18 passed.

#### ocr review of `6d449297..17affdc0` (T7.31-B2, B3, relocated)

No findings (`ocr/T7.31-B2-B3-17affdc0-relocated.json`). T7.31's ocr queue is empty.

### Cumulative run `t7-31-final` (commit 17affdc0 plus evidence edits)

| Suite | Result | Output |
|---|---|---|
| Unit | 121 files, 1428 passed, exit 0 | `suite-runs/t7-31-final-unit.txt` |
| Node integration | 94 files, 191 passed, exit 0 | `suite-runs/t7-31-final-integration.txt` |
| Browser (Chromium), full tier, `browser-1` | 119 passed (4.8 min), exit 0 | `suite-runs/t7-31-final-browser-1.txt` |
| Browser (Chromium), full tier, `browser-2` | 61 passed (4.0 min), exit 0 | `suite-runs/t7-31-final-browser-2.txt` |
| Checks | 13 of 13 exit 0 | `suite-runs/t7-31-final-checks.txt` |

- **Checks.** `run-complete.sh`: "run complete", checked again by the main session. Ports were free before and after.
- **T7.31's verification.** Every case in sections 6.2 of D1, D2, D4, D5, D6 and D7 passes.
- **Gate run.** This is the full-tier run before T7.32's first critic.

T7.31 is complete.

## T7.32: Independent browser-critic gate

### Critic cost

The figures come from the critic's completion notice. The brief is `.claude/docs/critic-brief.md` (v2) with the setup helpers from `e2e/d7/support.ts`.

| Critic | Commit | Brief | Tokens | Tool calls | Duration | Defects |
|---|---|---|---|---|---|---|
| 1 | `10984e07` | v2 | 189,339 | 109 | 12 min 56 s | 2 distinct: 1 moderate (Defects 1 and 2, one cause), 1 minor (Defect 3) |

- **Critic 1** (`critic-1.md`): the critic reported **PASS**, with C7.1–C7.10 all passing (C7.8 withdrawn by decision 76). Following the D5R and D6 precedent, its defects are fixed before the gate:
  - **T7.32-B1** (Defects 1 and 2): the exit receipt and the Review's owed card show an option Trade's Terminal Disposition in stock words ("Closed via sale of 2 shares"), and on the owed card the wrong mechanism, against approved words row 23.12 and A108. Its `it should` cases: the receipt of a Sell to close of 2 contracts says "Closed via sale of 2 contracts"; the owed card of a Trade closed by a sale and an expiration says "Closed via sale of 1 contract and expiration of 1 contract"; a stock Trade's receipt and owed card are unchanged.
  - **T7.32-B2** (Defect 3): payoff chart labels overprint (tick labels such as 55.00 and 57.00, and a Breakeven label over the "stays at" text) and become about 5 px at 320 px; a negative table amount breaks after its sign at 320 px, against A114's "marked and labelled". Its `it should` cases: no two chart labels overlap for the C7.1 Long Call and the MNO Cash-Secured Put at 1280, 375 and 320 px; chart text stays readable at 320 px; a negative table amount stays on one line.
  - The minor observations are recorded for the final report and don't become bug tasks.

### T7.32-B1: option Terminal Disposition on the exit receipt and owed card

- **Commit `0e11a684`.** The exit receipt and the Review's owed card now call `closedViaOption` (the function Trade Detail uses) for option Trades. The Closed `OwedTradeSummary` gains an optional `optionSide` ('Long' | 'Short'), which `owedSummary` in `daily-review.ts` fills from `plan.legs[0]` when the instrument is an option. The card had no other way to tell an option from stock, and "Cash-Secured Put" has no side prefix. Test support gains `closedLongPutTrade()`, because a UI test may not import the domain (`lint:deps`).
- **Cases:** (1) the exit receipt says "Closed via sale of 2 contracts", red then green; (2) the owed card says "Closed via sale of 1 contract and expiration of 1 contract", red then green; (3) stock wording unchanged, **first-run pass, flagged**: two existing tests already cover it. Mutation: `closedViaSale` saying "contracts" failed both with an AssertionError; restored.
- **Checks:** typecheck, tsc6, lint, lint:deps exit 0; `vitest run src/ui src/coordinators` 882 passed.
- **ocr** (`ocr/T7.32-B1-0e11a684.json`): 5 files reviewed, 0 comments. No findings.

### T7.32-B2: payoff chart labels

- **Commit `02f3e0aa`.** `PayoffView.tsx` and `app.css`: tick labels that would touch drop to a second or third row; the ray, zero-set and latest-close labels move by a `clearBaseline` collision helper (estimated widths, 7.5 px per character); chart text is fixed at 13 px (`fill: currentColor`, so it follows the dark-mode ink) inside a 640 px minimum-width chart that scrolls sideways in a new `.chart-scroll` region (`tabIndex=0`, labelled "Planned payoff chart" or "Current payoff chart"); viewBox height 320 to 344; the table's amount cells get `nowrap`. New Chromium spec `e2e/d7/payoff-chart-layout.spec.ts`, 3 cases, each red then green (logged by hand in `tdd-log.md`, since `tdd.sh` is Vitest only). No first-run passes.
- **Checks:** typecheck, tsc6, lint, lint:deps exit 0; the `PayoffView` Vitest file (6) and `e2e/d7/responsive-a11y.spec.ts` (2, with axe) pass.
- **ocr** (`ocr/T7.32-B2-02f3e0aa.json`): 2 files, 3 comments.

  | Severity | Location | ocr's claim | Assessment |
  |---|---|---|---|
  | medium | `PayoffView.tsx:37-38` | `clearBaseline` doesn't keep a label inside the SVG; a latest-close label near a rising ray's end can be pushed above the top and clipped (or past the right edge, being centred) | Valid. **T7.32-B3** |
  | medium | `PayoffView.tsx:36` | Tick labels and axis titles never enter the collision registry, and after six moves a label is accepted though it still collides | Valid (narrow in D7). **T7.32-B4** |
  | medium | `PayoffView.tsx:94` | Tick rows are unbounded while the SVG height and bottom margin are fixed, so clustered breakpoints clip or hit the axis title | Doubtful (D7 has at most rows 0–2). **T7.32-B5** |

  - Reviewer's note (not an ocr finding): the new spec covers Planned charts only, not the Current chart's "Latest close" label.
- **T7.32-B3:** `it should` keep every chart label inside the SVG's bounds, including a Current chart's "Latest close" label near a rising ray's end.
- **T7.32-B4:** `it should` keep a moved label clear of tick labels and axis titles, and never accept a colliding position when its search runs out.
- **T7.32-B5:** `it should` keep every tick row inside the SVG and clear of the axis title when breakpoints cluster beyond three rows.

### T7.32-B3: chart labels stay inside the SVG

- **Commit `971559fe`.** `clearBaseline` is replaced by `place(text, wantX, baseline, anchor, placed, step)` in `PayoffView.tsx`: it pulls x in so the label's estimated box stays within 0..640, searches baselines in the `step` direction (up to 6 moves) then the other way, accepting only a baseline in 13..344 that clears every placed box, and clamps to 13..344 if none fits. The zero-set and close labels are placed before the JSX, in B2's order.
- **Case:** "should keep every chart label inside the SVG bounds, including the Latest close label near a rising ray end" (Vitest, `PayoffView.test.tsx`), over four Current charts. Red: "Latest close 90.00 … expected 694.98 to be less than or equal to 640" (the right edge). Green. **Flagged:** the red came from the right edge only; the top-edge clip ocr described (a collision pushing the close label above the top) was not shown red by this case.
- **Checks:** `vitest run src/ui/screens` 491 passed; B2's 3 browser cases pass; typecheck, tsc6, lint, lint:deps exit 0.
- **ocr** (`ocr/T7.32-B3-971559fe.json`): 1 file reviewed, 0 comments. No findings.

### T7.32-B4: moved labels clear of tick labels and axis titles

- **Commit `6949ac19`.** In `PayoffView.tsx`, the `placed` registry now starts with the tick label boxes (at their final rows), the "<symbol> at expiration" title and the rotated "Payoff" title; `Box` is `{left, right, top, bottom}` (baseline ∓ 8). Fallback: after the 13 stepped baselines, every baseline 13..344 nearest first, then every x in 4 px steps; only a completely full chart takes the wanted spot, clamped. Every label still renders.
- **Case:** "should keep a moved label clear of every tick label and axis title and never render two overlapping labels when the search runs out", over a hand-built Planned view with 6 breakpoints (9 and 21 zero labels). Red: "'Breakeven at 0.00, touched without crossing' overlaps 'Breakeven from 0.00 to 55.00'". Green. The 9-label sub-case passes on the old code; the 21-label one carries the red. Mutation: dropping the tick boxes from the registry fails it ("30.00 overlaps Breakeven from 30.00 to 40.00").
- **Checks:** `PayoffView.test.tsx` 8 passed, `src/ui/screens` 492 passed; typecheck, tsc6, lint, lint:deps exit 0. B2's Chromium spec not rerun (the gate run covers it).
- **ocr** (`ocr/T7.32-B4-6949ac19.json`): 1 file reviewed, 0 comments. No findings.

### T7.32-B5: tick rows inside the SVG

- **Commit `a907f190`.** In `PayoffView.tsx`'s `Chart`, `height = HEIGHT + max(0, rows - 3) * LINE`; the y scale keeps the constant 344 − 80, and the viewBox, the axis title (y = height − 6), the rotated Payoff title's centre and the collision registry use `height`. Charts with three rows or fewer stay at 344. `place()` gains a trailing `height` parameter.
- **Case:** "should keep every tick row inside the SVG and clear of the axis title when breakpoints cluster beyond three rows" (breakpoints 0 and 50 to 55). Red: "53.00 clear of the axis title: expected -3 to be greater than or equal to 4". Green. No first-run passes.
- **Checks:** `PayoffView.test.tsx` 9 passed; `src/ui/screens` 493 passed; `e2e/d7/payoff-chart-layout.spec.ts` 3 passed (Chromium); typecheck, tsc6, lint, lint:deps exit 0.
- **ocr** (`ocr/T7.32-B5-a907f190.json`): 1 file reviewed, 0 comments. No findings. The B2 chain is closed (one round of bug tasks, B3 to B5).

### Gate run `t7-32-b5-gate`

At HEAD `27cbebec` for unit and integration, `f336866f` for the later stages (the commits between changed only evidence and the handoff); full tier. `run-complete.sh`: run complete.

| Stage | Result | Output |
|---|---|---|
| Unit | 1,433 passed (121 files) | `suite-runs/t7-32-b5-gate-unit.txt` |
| Node integration | 191 passed (94 files) | `suite-runs/t7-32-b5-gate-integration.txt` |
| Browser 1 (Chromium) | 119 passed (4.8 min) | `suite-runs/t7-32-b5-gate-browser-1.txt` |
| Browser 2 (Chromium) | 64 passed (4.1 min) | `suite-runs/t7-32-b5-gate-browser-2.txt` |
| Checks | 13 of 13 | `suite-runs/t7-32-b5-gate-checks.txt` |

No release-history run (decision 76). Ports 5175, 9341, 9342 free before and after.

| Critic | Commit | Brief | Tokens | Tool calls | Duration | Defects |
|---|---|---|---|---|---|---|
| 2 | `97f16cbd` | v2 | 232,137 | 90 | 14 min 9 s | 1 minor (fixed as T7.32-B6) |

- **Critic 2** (`critic-2.md`): **PASS**, C7.1–C7.10 all passing (C7.8 withdrawn). One minor defect, fixed before the gate:
  - **T7.32-B6:** after the expiration date, an option Trade's Detail opens its Valuation section with "Mark missing for XYZ 20 Nov 2026 55 Call on Mon Nov 23", though P25 and A110 require no Mark after expiration, A115 refuses such a Mark, and the Review card says none is needed. Its `it should` cases: after the expiration date, the Detail with Settlement Due shows no Mark-missing note for the expired contract; on the expiration date itself, a missing contract Mark is still reported.
  - The minor observations are recorded for the final report (the user's choice, 2026-11-08, to leave critics' minor notes as notes).

### T7.32-B6: no Mark requested on Detail after the expiration date

- **Commit `caa825dd`.** The missing-Mark note comes from the Trade Views coordinator: `trade-views.ts` adds `afterExpiration(analysis, date)` (an option whose frame date is after its expiration) and leaves `markResolution` out at Trade Detail assembly only; `expectedMarkDate` is unchanged. The UI and the Review are untouched. The Open list row (`openItem`) passes `markResolution` through as well, but only `TradeDetail.tsx` renders it, so the list shows nothing wrong (checked by grep).
- **Cases:** (1) after the expiration date, no Mark resolution for the expired contract, red then green; (2) on the expiration date a missing contract Mark is still reported, **first-run pass, flagged**; mutation `>=` for `>` failed it with an AssertionError; restored.
- **Checks:** `src/coordinators/trade-views` and `TradeDetail` 158 passed; typecheck, tsc6, lint, lint:deps exit 0.
- **ocr** (`ocr/T7.32-B6-caa825dd.json`): 1 file reviewed, 0 comments. No findings. Reviewer's note (not an ocr finding): the Open-list path still passes `markResolution` through, as recorded above.

### Gate run `t7-32-b6-gate`

At HEAD `526edb78`; full tier. `run-complete.sh`: run complete.

| Stage | Result | Output |
|---|---|---|
| Unit | 1,435 passed (121 files) | `suite-runs/t7-32-b6-gate-unit.txt` |
| Node integration | 191 passed (94 files) | `suite-runs/t7-32-b6-gate-integration.txt` |
| Browser 1 (Chromium) | 119 passed (4.8 min) | `suite-runs/t7-32-b6-gate-browser-1.txt` |
| Browser 2 (Chromium) | 64 passed (4.0 min) | `suite-runs/t7-32-b6-gate-browser-2.txt` |
| Checks | 13 of 13 | `suite-runs/t7-32-b6-gate-checks.txt` |

No release-history run (decision 76). Ports free before and after.
