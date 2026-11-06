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
