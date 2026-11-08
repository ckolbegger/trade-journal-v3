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
