# D7 prefactor structural verifications

Each entry records a structural task's exact verification (D7 prefactor breakdown, section 4), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`.

## Start of the D7 prefactor

Location checks (prefactor handoff, section 1) on 2026-11-04:
- worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`: matched.
- `git status -sb`: `## claude-opus-5.5...origin/claude-opus-5.5 [ahead 2]`, clean except the untracked `.claude/settings.json`.
- `git log --oneline claude-opus-5.5-pre-d7p..HEAD`: empty. `HEAD` is `89e545b`.
- tags `claude-opus-5.5-plan-r42`, `claude-opus-5.5-d6`, `claude-opus-5.5-pre-d7p`: present. `claude-opus-5.5-d6` is `e10d55a225d19d70c5cb5923d6f45e0cb93b5a1b`.
- `git diff claude-opus-5.5-d6 -- src e2e tests tools`: empty.
- `DEV_PORT=5175`; Node v26.12.0.
- `npm ci`: exit 0. `npx vitest run src`: `Test Files 94 passed (94)`, `Tests 1188 passed (1188)`. `npx vitest run tests/integration`: `Test Files 76 passed (76)`, `Tests 154 passed (154)`.

Spec reading (decision 45, A181, scoped): `specs/glossary.md` "Market observations and valuation" (S251); ADR 0007 (S085); `specs/design/trade-analysis.md` "Shared values", `derive`, `evaluate` (S164, S166, S167); `specs/design/daily-review.md` "Date, eligibility, and ordering", `open`, "Completion and resumption" (S090, S091, S096); `specs/design/trade-views-and-reporting.md` `browseTrades`, `getTradeDetail` (S188, S189); `specs/design/ui-contract.md` "Trade and Journal presentation", "Numbers, availability, and graphs" (S211, S212); `specs/design/overview.md` "Calculation availability" (S137); acceptance rows AC-CALC-002, AC-LIFE-003, AC-REV-002, AC-REV-006, AC-UI-001, AC-UI-002, AC-RESP-001 (S051, S016, S039, S043, S074, S075, S011). No other spec section has been needed yet.

## T7P.1 The Calculation Result module and the reason unions

- `npm run typecheck`: exit 0. `npx tsc6 --noEmit`: exit 0. `npm run lint`: exit 0. `npm run lint:deps`: exit 0 (no dependency violations, 276 modules). `npx vitest run src/domain`: exit 0, 14 files, 151 tests.
- `npm run verify:fixtures`: exit 0 (workspace-v1 to v5, views equal). `npx vitest run src tests/integration`: exit 0, 170 files, 1342 tests.
- `git diff claude-opus-5.5-pre-d7p -- src/persistence`: empty. Fixture diff: `tests/fixtures/workspace-v5/expected-views.json` only.
- Snapshot shapes changed (decision 78), `workspace-v5/expected-views.json`, two `netCost` entries (next to `lastActivity` 2026-10-20T15:00:00Z and 2026-10-19T15:00:00Z): `"reason": "NoOpenQuantity"` to `"reason": "NoRemainingPosition"`.
- Case changed: `src/domain/trade-analysis/net-cost.test.ts`, name and expectation `reason: 'NoOpenQuantity'` to `reason: 'NoRemainingPosition'`.
- Temporary Unavailable form: `src/domain/calculation-result/index.ts` keeps `{ kind: 'Unavailable', reason, detail: UnavailableDetail }`; `UnavailableReason` lists today's five codes as reason-only cases. T7P.4 adds each case's fields, removes `detail` and `UnavailableDetail`.
- `NotApplicable` is flat: `{ kind: 'NotApplicable' } & NotApplicableReason` case.

### Cumulative run after T7P.1 (`t7p-1-calculation-result`, at `536616d6`)

Run by `suite-runner` on 2026-11-04, browser stage `browser-auto 6b39c035` (the commit T7P.1 started from; the handoff's section 7 named the setup commit `72ad430a`, and the commits between are plan-only, so the tier is the same).

| Suite | Result | Output |
|---|---|---|
| Unit | 94 files, 1188 passed, exit 0 | `suite-runs/t7p-1-calculation-result-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7p-1-calculation-result-integration.txt` |
| Browser (Chromium), task tier | 5 passed (10.9 s), exit 0 | `suite-runs/t7p-1-calculation-result-browser.txt` |
| Static and verification checks | 12 of 12 exit 0 | `suite-runs/t7p-1-calculation-result-checks.txt` |

Tier: task, printed reason "browser tier: task (no changed path since 6b39c035 is on the full-tier list)". The breakdown's section 2 expected the full tier for T7P.1; the commit touched no P55 path (no `src/ui/` file needed a change, since nothing there branched on `NoOpenQuantity`), so `browser-auto` chose the task tier, as decision 71 prescribes. No `e2e/d7p` folder exists yet, so only the `@every-task` call ran. Ports 5175, 9341, 9342 free before and after.

### ocr review of `536616d6`

Not yet run: the first attempt failed before reviewing, with `ChatGPT OAuth request failed: status=400 code=invalid_grant` (expired `ocr` sign-in). Waiting for the user to sign in again (`ocr auth login`).

Rerun on 2026-11-05 after the user signed in again: session `43bb23fe-33e5-4e50-aef7-020599e47c86`, model gpt-6.1-sol, 6 files reviewed in place (test files excluded), **no findings**. Raw output: [ocr/T7P.1-536616d6.json](ocr/T7P.1-536616d6.json). T7P.1 is complete.

## T7P.2 Domain: the Instrument module

Behavioral; commit `c240a6db`. 2 cases red then green (`tdd-log.md`); no first-run pass. `src/domain/instrument/` exports `Instrument` (Stock only), `instrumentKey` and `instrumentOf`. `calculation-result` now imports `Instrument` type-only for its temporary `UnavailableDetail`; `lint:deps` needed no new rule.

### ocr review of `c240a6db`

Session `c4a65bc5-501c-4e84-ab75-17945007526d`, model gpt-6.1-sol, 2 files reviewed in place (the test file excluded), **no findings**. Raw output: [ocr/T7P.2-c240a6db.json](ocr/T7P.2-c240a6db.json).

### Cumulative run after T7P.2 (`t7p-2-instrument`, at `882ff8ae`)

| Suite | Result | Output |
|---|---|---|
| Unit | 95 files, 1190 passed, exit 0 | `suite-runs/t7p-2-instrument-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7p-2-instrument-integration.txt` |
| Browser (Chromium), task tier | 5 passed (11.3 s), exit 0 | `suite-runs/t7p-2-instrument-browser.txt` |
| Static and verification checks | 12 of 12 exit 0 | `suite-runs/t7p-2-instrument-checks.txt` |

Stage `browser-auto 7e13d28b`; tier: task, printed reason "browser tier: task (no changed path since 7e13d28b is on the full-tier list)". Ports free before and after.

## T7P.3 Domain: self-describing findings

Behavioral; commit `763e5353`. 4 cases red then green (`tdd-log.md`, new `src/domain/trade-analysis/findings.test.ts`); no first-run pass. `IncoherentFact` stays in `derive.ts` (re-exported from `trade-analysis`): an Execution finding carries `factId`, `kind: 'Execution'`, `instrument` (`ExecutionFact['instrument']`, structurally `Instrument`), `economicTime` (Instant), `side`, `quantity` (the recorded decimal string, since a nonpositive quantity may not parse as a positive Rational) and `reason`; `ExceedsOpenQuantity` keeps `available` (Rational); a Position Change duplicate is `{ factId, kind: 'PositionChange', economicTime, reason: 'DuplicateFactId' }`.

Existing cases changed by added fields only, no value changes (A185): `closed.test.ts`, `replay.test.ts`, `record-position-change.test.ts` (lines 340, 849), `src/modules/trade-record/section.test.ts`, `tests/integration/d2/integrity-incoherent.test.ts` (line 62); type-only literals in `closed-views.test.ts`, `PositionChangeForm.test.tsx` and `TradeDetail.test.tsx`. No `expected-views.json` changed (added fields pass the snapshot rule).

### ocr review of `763e5353`

Session `1a867925-2eae-4eb8-ab10-befaef5a465a`, model gpt-6.1-sol, 1 file reviewed in place (`derive.ts`; 10 test and evidence files excluded), **no findings**. Raw output: [ocr/T7P.3-763e5353.json](ocr/T7P.3-763e5353.json).

### Cumulative run after T7P.3 (`t7p-3-findings`, at `763e5353`)

| Suite | Result | Output |
|---|---|---|
| Unit | 96 files, 1194 passed, exit 0 | `suite-runs/t7p-3-findings-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7p-3-findings-integration.txt` |
| Browser (Chromium), full tier | 163 passed (7.7 min), exit 0 | `suite-runs/t7p-3-findings-browser.txt` |
| Static and verification checks | 12 of 12 exit 0 | `suite-runs/t7p-3-findings-checks.txt` |

Stage `browser-auto a50ae8d8`; tier: full, printed reason "first matching path since a50ae8d8: src/ui/screens/PositionChangeForm.test.tsx". Ports free before and after.

## T7P.4 Trade Analysis and Trade Views return the typed reasons

Structural. `UnavailableReason` in `src/domain/calculation-result/index.ts` is now section 1.3's union, carried flat (`{ kind: 'Unavailable' } & U`): `MarkMissing`, `AcknowledgedUnavailable`, `SessionPolicyNotCovered` with `instrument: Instrument` and `date`; `AwaitingClose` with `after`; `FactsIncoherent` with `findings: readonly IncoherentFact[]`. `UnavailableDetail` is deleted. `IncoherentFact` and `ExecutionDescription` moved into `calculation-result` (a type import from `trade-analysis` would be a cycle) and `trade-analysis` re-exports them; a finding's instrument is `Instrument`. `evaluate` returns `{ reason, instrument, date }` and `{ reason: 'AwaitingClose', after }`. Trade Views' `IncoherentFactFinding` is removed; `IncoherentTradeDetail.findings` is `readonly IncoherentFact[]`.

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npx tsc6 --noEmit` | exit 0 |
| `npx vitest run src/domain src/coordinators/trade-views` | 22 files, 202 passed, exit 0 |
| `npm run test:integration` | 76 files, 154 passed, exit 0 |
| `npx vitest run src` | 96 files, 1194 passed, exit 0 |
| `npm run verify:fixtures` | exit 0, views equal for v1 to v5 |
| `npm run lint` / `npm run lint:deps` | exit 0 / exit 0 |
| `git diff claude-opus-5.5-pre-d7p -- src/persistence` | empty; no `dump.json` changed |

Snapshot shapes changed (A185, decision 78), values kept: `workspace-v4/expected-views.json` 23 Unavailable results (`"reason": "AwaitingClose", "detail": { "after": "2026-10-19" }` becomes `"reason": "AwaitingClose", "after": "2026-10-19"`); `workspace-v5/expected-views.json` 200 (`"reason": "MarkMissing", "detail": { "instrument": { "kind": "Stock", "symbol": "CSCO" }, "date": "2026-10-20" }` becomes `"reason": "MarkMissing", "instrument": { ... }, "date": "2026-10-20"`).

Test files changed, old to new: `detail: { instrument, date }` / `detail: { after }` beside `reason` becomes the fields beside `reason`, in `src/domain/trade-analysis/evaluate.test.ts` (6), `src/coordinators/trade-views/current-evaluation.test.ts` (3), `src/coordinators/daily-review/daily-review.test.ts` (2, embedded `marketValue`), `src/coordinators/workspace/migration.test.ts`, `src/ui/figures.test.ts` (2), `src/ui/screens/TradeList.test.tsx` (5), `ReviewCard.test.tsx` (2), `CardFigures.test.tsx`, `tests/integration/d4/intraday.test.ts` (2), `d4/expected-mark.test.ts`, `d6/missing-mark.test.ts`, `tests/support/views-fixtures.ts` (2); `tests/support/open-detail-fixtures.ts` renames the findings type only.

### ocr review of `0fb6f453`

Session `245d2a35-ff2f-4512-aeec-23f329c4cc74`, model gpt-6.1-sol, 13 files reviewed in place (14 test, fixture and evidence files excluded), **no findings**. Raw output: [ocr/T7P.4-0fb6f453.json](ocr/T7P.4-0fb6f453.json).

### Cumulative run after T7P.4 (`t7p-4-typed-reasons`, at `0fb6f453`)

| Suite | Result | Output |
|---|---|---|
| Unit | 96 files, 1194 passed, exit 0 | `suite-runs/t7p-4-typed-reasons-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7p-4-typed-reasons-integration.txt` |
| Browser (Chromium), full tier | 163 passed (7.7 min), exit 0 | `suite-runs/t7p-4-typed-reasons-browser.txt` |
| Static and verification checks | 12 of 12 exit 0 | `suite-runs/t7p-4-typed-reasons-checks.txt` |

Stage `browser-auto e90e267e`; tier: full, printed reason "first matching path since e90e267e: src/app/types.ts". Ports free before and after.

Notes carried to later tasks (from the T7P.4 report): `attention.ts` has a temporary private `awaitingAfter(u)` helper that T7P.5 removes when it reshapes the Review; `figures.ts` still words `SessionPolicyNotCovered` and `FactsIncoherent` as "Not available" until T7P.6/T7P.7; `TradeDetail.tsx` still looks facts up by id for its findings table, which T7P.7 can drop now that findings describe themselves.

## T7P.5 Daily Review: Calculation Results

### Probe (P73): does SessionPolicyNotCovered reach a walked Trade's pressure, range position or attention reason?

**No. The defect was latent.** The probe opens the Review with an as-of instant outside session-policy coverage (coverage is 2024-01-01 to 2028-12-31) and expects what `open` returns today. Command: `.claude/scripts/tdd.sh green T7P.5 src/coordinators/daily-review/daily-review.test.ts "should open the Review with its as-of instant outside session-policy coverage and return what it returns today"`.

- As-of 2029-01-03T22:00Z with the card fixture's Trades open: `open` returns `{ kind: 'Rejected', issues: [{ field: 'asOf', code: 'SessionPolicyCoverage', date: '2029-01-03', coverage: { first: '2024-01-01', last: '2028-12-31' } }] }`. No Trade is walked.
- As-of 2024-01-02T14:00Z (the latest completed session would be before coverage starts, Review date 2023-12-31) with one Trade open since 2023-12-28: the same `Rejected` with `date: '2023-12-31'`.

So the Review rejects an as-of instant (or Review date) outside coverage before it builds any item. The later `attentionOf` session-policy case ("should give SessionPolicyNotCovered as SessionPolicyNotCovered, never as AcknowledgedUnavailable, in attentionOf") is the regression test of a latent defect: it went red on today's `AcknowledgedUnavailable` mapping, which no `open` call can reach. A second finding of the same kind: `AwaitingClose` is also unreachable through `open` (the Review's cutoff is its Review date's close, so no Lot opens after the frame's close), so its pressure and range position case runs through `attentionOf` with a constructed evaluation.

### Shape changes (old to new)

- `ReviewTradeItem.basis`: `PressureBasis` (`Comparable { side, share, atEntry, now }` / `Comparable { side: 'None', share }` / `NotComparable { reason: 'MissingInput' | 'AwaitingClose' | 'FactsIncoherent' | 'NonPositiveAtEntry', ... }`) to `CalculationResult<Pressure, UnavailableReason, Extract<NotApplicableReason, { reason: 'NonPositiveAtEntry' }>>` (`Value { value: Pressure }`, `Unavailable`, `NotApplicable { reason: 'NonPositiveAtEntry', side }`).
- `ReviewTradeItem.rangePosition`: `RangePosition` (`Placed { now, atEntry, pinned? }` / `NotPlaced { reason, instrumentKey, date }`) to `CalculationResult<RangePlacement, UnavailableReason, never>`.
- `AttentionReason`: `{ code: 'MarkMissing' | 'AcknowledgedUnavailable', instrumentKey, date }`, `{ code: 'AwaitingClose', after }`, `{ code: 'IncoherentFacts', findings }` to `{ code: 'Unavailable' } & UnavailableReason`.
- `IncompleteReason` `MarkMissing`: `instrumentKey: string` to `instrument: Instrument`. `ReviewCompletion` `CompleteWithUnavailableMarks.instruments`: `string[]` to `Instrument[]` (P68's Unavailable Marks family). `IncompleteReason` `IncoherentFacts` is unchanged.
- `attention.ts`: `riskRewardOf` returns the evaluation's own Unavailable, passed through; `Missing`, `MissingInput` conversion and `awaitingAfter` are gone.

### Existing cases changed (shape only, values kept)

- `src/coordinators/daily-review/daily-review.test.ts`: attention order (basis, reasons: Comparable/NotComparable/MarkMissing to Value/Unavailable), T-B boundary basis, T-A/T-E pressure x2, equal-pressure ordering map, routine pressure 0, Not Comparable NonPositiveAtEntry (NotComparable to NotApplicable), two incoherent blocker cases (reason shape), Incomplete MarkMissing reason, CompleteWithUnavailableMarks instruments, unreplayable card attention reason, three range-position cases, T-B/T-C range position, Target pin.
- `src/coordinators/daily-review/save-marks.test.ts`: two Placed to Value, `r.instrumentKey` to `r.instrument.symbol`, acknowledged NotPlaced to Unavailable.
- `src/coordinators/daily-review/save.test.ts`: MarkMissing reason `instrumentKey: 'DEF'` to `instrument`.
- `src/coordinators/daily-review/attention.test.ts`: the ordering helper's basis and range position (Comparable/Placed to Value).
- `tests/integration`: `d4/eligibility.test.ts`, `d4/review.test.ts`, `d5r/range-and-baseline.test.ts`, `d5r/save-marks.test.ts`, `d5r/shared-mark.test.ts`, `d5r/gap-trades.test.ts`, `d5r/query-count.test.ts`.
- UI tests, constructed inputs only (expected text unchanged): `CardMarks.test.tsx`, `ReviewCard.test.tsx`, `ReviewCards.test.tsx`, `ReviewOwed.test.tsx`, `ReviewView.test.tsx`, `held-review.test.ts`, `StopTargetSlider.test.tsx` (type name and shapes).

### Snapshots (`expected-views.json`; every `dump.json` unchanged)

- `workspace-v3`: 6 `basis` entries (3 in `review`, 3 in `reviewTrades[].attention`): `{ kind: 'Comparable', side, share, atEntry, now }` to `{ kind: 'Value', value: { side, share, atEntry, now } }`.
- `workspace-v4`: the same, 6 entries.
- `workspace-v5`: 10 `reasons[0]` (`{ code: 'MarkMissing', instrumentKey, date }` to `{ code: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol }, date }`), 10 `basis` (`NotComparable`/`MissingInput` to `Unavailable`/`MarkMissing`), 10 `rangePosition` (`NotPlaced`/`MissingInput` to `Unavailable`/`MarkMissing`), and 5 `completion.reasons` `MarkMissing` (`instrumentKey` to `instrument`). The `instrumentKey` fields of Marks rows (v4 9, v5 50 minus the 5 above) belong to rows this task does not change and stay.
- `npm run verify:fixtures` passes (v1 to v5). `git diff --name-only | grep dump` is empty.

### ocr review of `45190a2e`

Session `45908ed6-788a-4e18-93f0-45ff13800d92`, model gpt-6.1-sol, 8 files reviewed in place (23 test, fixture and evidence files excluded), **no findings**. Raw output: [ocr/T7P.5-45190a2e.json](ocr/T7P.5-45190a2e.json).

### Cumulative run after T7P.5 (`t7p-5-daily-review`, at `45190a2e`)

| Suite | Result | Output |
|---|---|---|
| Unit | 96 files, 1206 passed | `suite-runs/t7p-5-daily-review-unit.txt` |
| Node integration | 76 files, 154 passed | `suite-runs/t7p-5-daily-review-integration.txt` |
| Browser (Chromium), full tier (`npm run test:e2e`) | 163 passed (7.6 min) | `suite-runs/t7p-5-daily-review-browser.txt` |
| Static and verification checks | 12 of 12 `EXIT 0` | `suite-runs/t7p-5-daily-review-checks.txt` |

Stage `browser-auto a39d0b3f`; the full tier ran (T7P.5 changed `src/ui/screens/` and `src/app/types.ts`). The runner's final table did not reach the main session (only an interim "still running" message did), so this table was read from the four output files; ports 5175, 9341 and 9342 were free afterwards (checked from the main session).

Notes (from the T7P.5 report): `AwaitingClose` cannot reach a Review walked through `open` (the Review's cutoff is its date's close, so no Lot opens after the frame's close), so its pressure and range position case runs through `attentionOf`, as the breakdown allows for reasons `open` can't reach; the snapshot of workspace-v3 also needed its 6 `basis` entries reshaped (decision 78 covers `workspace-v*`). `save-marks.test.ts:113`'s title still says "kept MissingInput"; T7P.8 renames it.

## T7P.6 UI: the wording module

Compile-time check (scratch commit adding `{ reason: 'DummyScratch' }` to `UnavailableReason`, then `npm run typecheck`). The harness refuses `git reset` in the worktree, so the scratch commit was undone by a following commit that restores the file byte for byte (`git diff ce13811e -- src` is empty).

```
src/ui/calculation-words.ts(48,7): error TS2322: Type '{ readonly reason: "DummyScratch"; }' is not assignable to type 'Parts'.
src/ui/calculation-words.ts(48,21): error TS1360: Type '{ readonly reason: "DummyScratch"; }' does not satisfy the expected type 'never'.
src/coordinators/daily-review/attention.ts(92,114): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.
src/ui/screens/review-attention.ts(20,57): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.
```

The module fails at its `never` default in `unavailableWords` (line 48) and at no catch-all. Two switches outside the module also fail (not fixed): `attention.ts` line 92 and `review-attention.ts` line 20, which have no default.

### T7P.6 notes from the main session

- **Scratch commit kept in history:** `guard-shell-writes.sh` refuses `git reset` in the worktree, so the compile-time check's scratch commit `87891c13` (adds `DummyScratch`) could not be dropped. The subagent undid it with `48f682f7`, which restores the file byte for byte (`git diff ce13811e -- src` empty after it). History is not rewritten. Flagged for the final report.
- **First-run passes (flagged):** case 8 ("return the words in parts") and case 9 (`instrumentLabel`) passed on their first run, because cases 1 to 7 had built them. Each was checked by a mutation that failed by an assertion: case 8, the MarkMissing figure emitting its date as a text part (`AssertionError: expected [ { kind: 'text', …(1) }, …(3) ] to deeply equal [ … ]`); case 9, the label lower-cased (`AssertionError: expected 'xyz' to be 'XYZ'`). Both mutations were restored (`tdd-log.md`).
- **Compile-time check:** the dummy case also failed to compile at two exhaustive switches outside the module that have no default (`attention.ts(92)`, `review-attention.ts(20)`), which is the intended effect; no catch-all absorbed it.

### ocr review of `ce13811e`

Session `9c600fd4-ce50-409e-8f07-f43617f63bdb`, model gpt-6.1-sol, 1 file reviewed in place. Raw output: [ocr/T7P.6-ce13811e.json](ocr/T7P.6-ce13811e.json).

| Severity | Location | Finding | Assessment |
|---|---|---|---|
| low | `src/ui/calculation-words.ts:16` | `text()` uses a nested ternary over `part.kind`; it should be a `switch`. | **Valid**, becomes T7P.6-B1. |

**T7P.6-B1: `text()` has an implicit catch-all.** The nested ternary's last branch takes every `Part` kind not named before it, so a new `Part` kind (for example one D7 might add) would be joined as that branch's text instead of failing the build. P71 requires every switch in the module to be exhaustive, with `never` in the default and no catch-all. Fix: an exhaustive `switch` on `part.kind` with a `never` default. The defect is compile-time only, so its verification is structural: `npm run typecheck` fails at `text()` when a `Part` kind is added (an uncommitted scratch edit, restored with the Edit tool), and every existing `calculation-words` case still passes.

### Cumulative run after T7P.6 (`t7p-6-wording-module`, at `48f682f7`, before T7P.6-B1)

Unit 97 files, 1215 passed; integration 76 files, 154 passed; browser full tier (`browser-auto cbbaa791`, "first matching path since cbbaa791: src/ui/calculation-words.test.ts") 163 passed (7.7 min); checks 12 of 12 exit 0. Outputs `suite-runs/t7p-6-wording-module-*.txt`. Ports free before and after. It ran alongside the ocr review, so a cumulative run follows T7P.6-B1.
