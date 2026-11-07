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
