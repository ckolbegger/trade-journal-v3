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

### T7P.6-B1

Fix: `text()` in `src/ui/calculation-words.ts` now maps each part through `partText`, an exhaustive `switch` on `part.kind` with `return part satisfies never` in the default, the module's existing pattern. No behavior or text change.

Other ternary or `if` chains over a union tag, examined: `findingWords` has `if (finding.kind === 'PositionChange')` followed by a `switch (finding.reason)` with a `never` default. That `if` is a two-way split on the one variant that carries `kind`; a new variant would fail to typecheck at `finding.side`, `finding.quantity` or the `never` default, so it has no silent catch-all and was left unchanged. The `length === ...` chains in `unavailableWords`, `notApplicableWords` and `unboundedWords` select among `WordLength` values or a two-valued direction, not a `Part` or reason tag; `figure` and `sentence` reading the same text is deliberate, so they were left unchanged. No other fix was needed.

Note on the scratch edit: a new `Part` kind with no `date` field would fail the old ternary incidentally (`part.date` does not exist), which would hide the defect. The scratch kind therefore carries a `date: string`, so the old last branch accepts it.

1. Scratch edit (Edit tool, never committed): added `| { readonly kind: 'scratch'; readonly date: string }` to `Part`.
   - Before the fix: `npm run typecheck` exit 0 (the defect: the new kind is silently joined by the last ternary branch).
   - After the fix: `npm run typecheck` exit 1, `src/ui/calculation-words.ts(25,19): error TS1360: Type '{ readonly kind: "scratch"; readonly date: string; }' does not satisfy the expected type 'never'.` (also TS2322 at 25,7), on the `satisfies never` line in `partText`, reached from `text()`.
   - Scratch edit reverted with the Edit tool; `git diff` contains no `scratch` (0 matches).
2. `npx vitest run src/ui/calculation-words.test.ts`: 9 passed, test file unchanged. `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`: all exit 0.

### ocr review of `3ad6841b` (T7P.6-B1)

Session `3fa0f67d-a797-4d32-a6dc-f43a7b64c266`, model gpt-6.1-sol, 1 file reviewed in place, **no findings**. Raw output: [ocr/T7P.6-B1-3ad6841b.json](ocr/T7P.6-B1-3ad6841b.json). T7P.6 and its bug task are resolved.

### Cumulative run after T7P.6-B1 (`t7p-6-b1-exhaustive-text`, at `3ad6841b`)

Unit 97 files, 1215 passed; integration 76 files, 154 passed; browser full tier (`browser-auto aad86ca3`, "first matching path since aad86ca3: src/ui/calculation-words.ts") 163 passed (7.6 min); checks 12 of 12 exit 0. Outputs `suite-runs/t7p-6-b1-exhaustive-text-*.txt`. Ports free before and after.

## T7P.7 UI: lists, Detail and the receipt word through the module

Behavioral; commit `cc35ebb4`. 6 cases (`tdd-log.md`). `calculation()` in `figures.ts` now dispatches every non-Value result to the module at the figure length; `TradeList`, `TradeDetail` and `PositionChangeReceipt` word reasons only through it. Detail's findings table is one column of finding sentences, under "Facts can't be replayed".

**First-run passes (flagged):** case 1 (missing Mark figure and badge, built by T4.18): mutation "Mark missin" in the figure failed by `AssertionError: expected 'Mark missin: ABC, Tue Oct 13' to be 'Mark missing: ABC, Tue Oct 13'`. Case 3 ("Outside the market calendar" on Open Detail): the subagent had routed `calculation()` through the module while making case 2 green, ahead of case 3's red, a deviation from strict red-first that it reported; mutation (Unavailable worded at the label length) failed by `AssertionError: expected 'Outside calendar' to be 'Outside the market calendar: Thu Jan 2'`.

**Unit expectations changed to section 1.4's texts** (A185 does not cover text; these are the approved rewordings): `TradeList.test.tsx` ("Awaiting the next close" → "Awaiting the close after Tue Oct 13", 5 places; session-policy "Not available" → "Outside the market calendar: Wed Jan 2"; incoherent rows "Records disagree" → "Facts can't be replayed", the coherent disagreement keeps "Records disagree"); `TradeDetail.test.tsx` (panel region "Records disagree" → "Facts can't be replayed" in 4 cases; the findings table's two columns → one column of sentences; "Awaiting the close after Mon Oct 12"; Valuation note "Acknowledged unavailable for XYZ …" → "Mark acknowledged unavailable for XYZ …"); `figures.test.ts` (SessionPolicyNotCovered, AwaitingClose); `CardFigures.test.tsx` (a reason-less `NotApplicable` fixture given `EntryAtOrBeyondStop`, reading "Not applicable: entry at or beyond the Stop").

**Implementation decision (main session):** two cases that fed an invented `SomeFutureReason` and expected the catch-all "Not available" (`TradeList.test.tsx`, `figures.test.ts`) were removed by the subagent. They asserted the catch-all that P71 forbids ("every switch is exhaustive, with no catch-all"), and the breakdown's "Why" names those catch-alls as the defect. Accepted; recorded for the final report.

**Browser expectation outside section 6.2:** the Valuation note for an acknowledged Mark (`e2e/d4/responsive-a11y.spec.ts:175`). Asked the user; approved as plan revision 44, decision 79 (section 6.2 gains the row).

### ocr review of `cc35ebb4`

Session `774107fa-7e35-40dc-8fff-bf2a7f19f5b8`, model gpt-6.1-sol, 4 files reviewed in place (`figures.ts`, `PositionChangeReceipt.tsx`, `TradeDetail.tsx`, `TradeList.tsx`), **no findings**. Raw output: [ocr/T7P.7-cc35ebb4.json](ocr/T7P.7-cc35ebb4.json).

### Cumulative run after T7P.7 (`t7p-7-lists-detail`, at `cc35ebb4`)

| Suite | Result | Output |
|---|---|---|
| Unit | 97 files, 1218 passed, exit 0 | `suite-runs/t7p-7-lists-detail-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7p-7-lists-detail-integration.txt` |
| Browser (Chromium), full tier | 5 failed, 158 passed (7.9 min), exit 1 | `suite-runs/t7p-7-lists-detail-browser.txt` |
| Static and verification checks | 12 of 12 exit 0 | `suite-runs/t7p-7-lists-detail-checks.txt` |

Stage `browser-auto 6807d801`; tier full ("first matching path since 6807d801: src/ui/figures.test.ts"). Every browser failure is a planned text change that T7P.10 makes:

| Failing test | Section 6.2 row |
|---|---|
| `e2e/d2/integrity.spec.ts:57`, incoherent Planned row expects "Records disagree"; reads "Facts can't be replayed" | `integrity.spec.ts`, incoherent cases (row badge) |
| `e2e/d2/integrity.spec.ts:91`, region "Records disagree" not found on the incoherent Detail | `integrity.spec.ts`, incoherent cases (panel name) |
| `e2e/d4/breach-overrun.spec.ts:15`, expects "Awaiting the next close"; reads "Awaiting the close after Mon Oct 12" | `breach-overrun.spec.ts` |
| `e2e/d4/responsive-a11y.spec.ts:118` (assertion at line 175), Valuation note "Mark acknowledged unavailable for DEF …" | the row added by decision 79; the same test's Tuesday-noon `AwaitingClose` lines (6.2's `responsive-a11y` row) come after it and were not reached |
| `e2e/d5r/sliders.spec.ts:60`, accessible name gains ": no risk to the Stop." | `sliders.spec.ts` |

The `ui-alignment` and `narrow` cases did not fail, consistent with 6.2's "if that fixture is incoherent"; T7P.10 confirms each fixture's kind.

## T7P.8 UI: the Review words through the module

Behavioral; commit `94588b60`. 5 cases (`tdd-log.md`). `review-attention.ts`'s `reasonText` and `ReviewView`'s `blockerText` word every reason through the module at the sentence length and take the trader's time zone; the Mark-missing blocker wraps the module's Instrument part in its card link; the `FactsIncoherent` blocker links the Trade's name to Trade Detail, then the first finding's sentence and "and N more"; `ReviewCard`'s slider fallback is `FACTS_INCOHERENT_FIGURE` ("Not available", A184).

**First-run passes (flagged):** case 1 (slider figure text and name, built by T7P.6/T7P.7): mutation of the AwaitingClose figure failed by `AssertionError: expected 'Awaiting close after Mon Oct 12' to be 'Awaiting the close after Mon Oct 12'`. Case 3 (Mark-missing blocker link, built by D5R and T7P.6): mutation "Mark absent for" failed by `AssertionError: expected 'Mark absent for DEF on Mon Oct 12' to be 'Mark missing for DEF on Mon Oct 12'`. Case 5 (slider "Not available" for incoherent facts): mutation to the label length failed by an `AssertionError` (name read "Facts can't be replayed"). Each mutation was restored. Two earlier red rows in `tdd-log.md` had wrong failure reasons (a test-scope `ReferenceError`, and a first case-2 query that matched other paragraphs) and are superseded by later valid rows.

**Expectations changed:** `ReviewCards.test.tsx`, the decision 68 blockers case: "ABC: recorded facts cannot be replayed" → "ABC: Facts can't be replayed" (`FactsIncoherent`, sentence; its fixture has no findings, so the module's fallback). `save-marks.test.ts:113` title only. "Recorded facts disagree" (`IntegrityDisagreement`, not a section 1.4 reason) is unchanged. No `e2e/` expectation is broken by this task.

**For T7P.9:** `ReviewView.tsx`'s `blockerText` has `case 'MarkMissing':` on `IncompleteReason.code`, and `marksFirst` compares `r.code === 'MarkMissing'`; `TradeList.tsx` compares `reason === 'MarkMissing'`/`'AcknowledgedUnavailable'` for routing (T7P.7).

### ocr review of `94588b60`

Session `0a0586a3-8fc4-4be2-9300-b2406633c6d2`, model gpt-6.1-sol, 3 files reviewed in place (`ReviewCard.tsx`, `ReviewView.tsx`, `review-attention.ts`), **no findings**. Raw output: [ocr/T7P.8-94588b60.json](ocr/T7P.8-94588b60.json).

### Cumulative run after T7P.8 (`t7p-8-review-words`, at `94588b60`)

| Suite | Result | Output |
|---|---|---|
| Unit | 97 files, 1223 passed, exit 0 | `suite-runs/t7p-8-review-words-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7p-8-review-words-integration.txt` |
| Browser (Chromium), full tier | 5 failed, 158 passed (8.2 min), exit 1 | `suite-runs/t7p-8-review-words-browser.txt` |
| Static and verification checks | 12 of 12 exit 0 | `suite-runs/t7p-8-review-words-checks.txt` |

Stage `browser-auto 03273a2d`; tier full ("first matching path since 03273a2d: src/ui/screens/ReviewCard.tsx"). The 5 failures are the same 5 planned ones as after T7P.7 (`integrity.spec.ts:57` and `:91`, `breach-overrun.spec.ts:15`, `responsive-a11y.spec.ts:118` at its line 175, `sliders.spec.ts:60`), each a section 6.2 row (with decision 79's), which T7P.10 changes. The browser stage took 8.2 min, over the runner's 8-minute warning line (tech debt item 6); T7P.11 adds `e2e/d7p`, so the gate's browser stage nears the 10-minute Bash limit.

## T7P.9 verify:wording

`tools/verify-wording.ts`, wired as `npm run verify:wording`. `full-suite.sh` derives its checks from every `verify:*` script in `package.json`, so no edit to the script was needed; the suite-runner agent file does not hard-code 12.

**What it checks** (every non-test file under `src/ui/` except `src/ui/calculation-words.ts`; comments are blanked first, line numbers kept):
- Reason words, case-insensitive, straight or curly apostrophe (19 phrases from section 1.4's tables): Mark missing; Acknowledged unavailable; Mark acknowledged unavailable; Awaiting close; Awaiting the close; Awaiting the next close; Outside calendar; Outside the market calendar; is outside the market calendar; Facts can't be replayed; Not available; Not applicable; Unbounded above; Unbounded below; is more than the; leaves the Position flat; names a Planned Leg; has a quantity that isn't positive; shares its identity.
- Reason codes in a `case` or an equality comparison (17): MarkMissing, AcknowledgedUnavailable, AwaitingClose, SessionPolicyNotCovered, FactsIncoherent, NoRemainingPosition, NotClosed, EntryNotResolved, NoOngoingRisk, EntryAtOrBeyondStop, EntryAtOrBeyondTarget, NonPositiveAtEntry, UnknownPlannedLeg, NonpositiveQuantity, DuplicateFactId, FlatBeforeLaterFacts, ExceedsOpenQuantity. A comparison whose other side is a `.kind` field is Market Data's Expected-Mark Status (section 1.1) and is not matched.
- Choices: "Not available" is in the list (it is FactsIncoherent's whole figure; a screen writing it itself is the drift P74 targets, and no other screen text in `src/ui` uses it today). The not-applicable tails ("no open position", "not closed yet", ...) are left out: they appear only after "Not applicable: ", which is listed, and "no open position" alone is ordinary text ("This Trade has no open Position to exit.").
- `npm run verify:wording -- --list` prints the lists.

**Moves for the known hits** (behavior and text unchanged; new exports of `calculation-words.ts`): `isMarkMissing(reason)`, `isMarkLacking(reason)` (MarkMissing or AcknowledgedUnavailable) and `isMarkMissingBlocker(blocker)`. `TradeList.tsx` (`missingMark`, `StatusBadges`) and `ReviewView.tsx` (`blockerText`, `marksFirst`) use them. `figures.ts` already went through the module. `npx vitest run src`: 97 files, 1223 tests pass.

**Run 1, current tree:** exit 1, 5 matches, all text or codes the plan keeps outside reason wording (reported to the main session, not changed):
```
src/ui/screens/MarkEntry.tsx:160: words: Acknowledged Unavailable
src/ui/screens/position-change-issues.ts:30: code: issue.code === 'ExceedsOpenQuantity'
src/ui/screens/position-change-issues.ts:31: code: issue.code === 'FlatBeforeLaterFacts'
src/ui/screens/position-change-issues.ts:61: code: issue.code === 'ExceedsOpenQuantity'
src/ui/screens/position-change-issues.ts:61: code: issue.code === 'FlatBeforeLaterFacts'
```

**Planted run** (uncommitted Edit-tool edits: `<p>{'Mark missing'}</p>` in `AboutView.tsx`, a function with `case 'NotClosed':` in `format.ts`), exit 1, names both:
```
verify:wording failed: 7 match(es) outside src/ui/calculation-words.ts
  src/ui/format.ts:48: code: case 'NotClosed'
  src/ui/screens/AboutView.tsx:103: words: Mark missing
  (and the 5 above)
```
Both edits restored with the Edit tool; `git diff` for those two files is empty.

**Checks stage:** `.claude/scripts/full-suite.sh evidence/D07P t7p-9-checks-probe checks` reported "12 of 13 exit 0" with `npm run verify:wording` the failing one (the 5 matches above); the probe's file was deleted.

### T7P.9 second part (decision 80)

No exemption and no rule change in `tools/verify-wording.ts`; the 5 hits moved into `src/ui/calculation-words.ts` with no visible text change:
- `acknowledgedUnavailableStatusLabel()` returns "Acknowledged Unavailable" (the Mark row's own casing, section 1.1); `MarkEntry.tsx` renders it in the `<strong>`. The row's other statuses ("Missing") do not hit the check and stay as they were.
- `isExceedsOpenQuantityIssue(issue)` and `isFlatBeforeLaterFactsIssue(issue)` (take `{ code: string }`); `position-change-issues.ts` calls them at lines 30, 31 and 61.
- Unit cases in `calculation-words.test.ts`: the label, and both predicates (true for their code, false for the other). They passed on first run because the text and codes already existed in the screens (a move); mutation checks failed by assertion: label recased to "Acknowledged unavailable" (1 failed); `isFlatBeforeLaterFactsIssue` comparing `ExceedsOpenQuantity` (1 failed). Both restored (`git diff` shows only the additions).

`npm run verify:wording`: exit 0, "verify:wording: no reason words or reason-code branches outside src/ui/calculation-words.ts".
`.claude/scripts/full-suite.sh evidence/D07P t7p-9-checks-probe2 checks`: "13 of 13 exit 0"; its file deleted. `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` exit 0; `npx vitest run src`: 97 files, 1225 tests pass (MarkEntry, PositionChangeForm and PositionChangeFormExit tests unchanged).

### ocr review of `0d61ae73^..5554bfbd` (T7P.9, both parts)

Session `c844bc8d-8fd0-4bf2-a567-8da3ca5538e9`, model gpt-6.1-sol, 7 files reviewed in place (the commit changes `package.json`), 3 findings. Raw output: [ocr/T7P.9-0d61ae73-5554bfbd.json](ocr/T7P.9-0d61ae73-5554bfbd.json). One ocr `file_read` of a nonexistent path failed, without effect on the findings.

| Severity | Location | Finding | Assessment | Bug task |
|---|---|---|---|---|
| medium | `tools/verify-wording.ts:93` | The check scans one line at a time, so a `case` or comparison split across lines (`result.reason ===` then `'MarkMissing'` on the next line) is missed. | Valid | T7P.9-B1 |
| medium | `tools/verify-wording.ts:78` | The comment stripper treats `//` or `/* */` inside string literals as comments, which can hide a phrase or code later on the line. | Valid | T7P.9-B2 |
| medium | `tools/verify-wording.ts:32` | The phrase list leaves out the `NotApplicable` reasons' words ("no open position", "not closed yet", …), so a screen could hardcode one without the "Not applicable" prefix. | Doubtful (a real gap; section 1.4's table does list those words as the reasons' words) | T7P.9-B3 |

**T7P.9-B1: multi-line branches are missed.** Defect: a reason-code `case` or equality comparison whose operator and code literal are on different lines (as a formatter may wrap them) passes the check. Cases: it should fail on a comparison whose `===` and code literal are on consecutive lines, naming the file and the code literal's line; it should fail on a `case` whose code literal is on the line after `case`; it should still pass on the current tree.

**T7P.9-B2: comment markers inside strings hide later text.** Defect: a `//` or `/*` inside a string literal is treated as the start of a comment, so a phrase or code literal after it on the same line is not checked. Cases: it should fail on `const a = ' // '; const b = 'Mark missing';`; it should fail on a `case 'NotClosed':` after a string containing `/*`; it should still pass on the current tree, with real comments still ignored.

**T7P.9-B3: the `NotApplicable` reasons' words are not checked.** Defect: a screen that writes, say, "not closed yet" as its own label passes the check. Implementation decision (main session): T7P.9 left these words out because, matched as substrings, "no open position" hits ordinary text ("This Trade has no open Position to exit.", `PositionChangeForm.tsx`). So the words are matched when they make up a whole string literal or a whole JSX text node (case-insensitively, trimmed), which catches a screen writing a reason's words as its own text without flagging sentences that merely contain them. Cases: it should fail on a string literal `'not closed yet'` in a `src/ui/` file; it should fail on JSX text `No open position`; it should still pass on the current tree, including `PositionChangeForm.tsx`'s sentence.

### Cumulative run after T7P.9 (`t7p-9-verify-wording`, at `5554bfbd`, before its bug tasks)

Unit 97 files, 1225 passed; integration 76 files, 154 passed; browser full tier (`browser-auto b41e6794`, "first matching path since b41e6794: package.json") 5 failed, 158 passed (7.9 min), the same 5 planned section 6.2 failures as after T7P.7 and T7P.8; checks **13 of 13** exit 0, `verify:wording` among them. Outputs `suite-runs/t7p-9-verify-wording-*.txt`. Ports free before and after. It ran alongside the ocr review, so a cumulative run follows the bug tasks.

### T7P.9-B1 (`d8927527`) and T7P.9-B2 (`fd2d751a`)

B1: the scan moved into `tools/wording-scan.ts` (`scanSource(path, source)`, `PHRASES`, `CODES`), with tests in `tools/wording-scan.test.ts`; regexes run over the whole comment-blanked text and map offsets back to lines. Case 2's red came only after the subagent temporarily narrowed the `case` regex (the case-1 fix already covered it), then restored it; case 3 was a first-run pass, mutation-checked (the `.kind` rule renamed, `AssertionError: expected [ …(4) ] to deeply equal []`). Both flagged.

B2: `stripComments` is a small tokenizer tracking quotes and escapes; real comments are still blanked with newlines kept. Its third case ("still ignores real comments and keeps line numbers") was a first-run pass, mutation-checked (`AssertionError: expected 3 to be 1`). Flagged. Known limits left: regex literals containing quotes, and `${}` nesting in templates.

### ocr review of `d8927527` (T7P.9-B1)

Session `95d58d15-bce1-4942-9f34-ca024dbd9476`, model gpt-6.1-sol, 2 files reviewed in place, 1 finding. Raw output: [ocr/T7P.9-B1-d8927527.json](ocr/T7P.9-B1-d8927527.json).

| Severity | Location | Finding | Assessment | Bug task |
|---|---|---|---|---|
| medium | `tools/wording-scan.ts:100-101` | When a code-first comparison's right side wraps at a member access (`'AcknowledgedUnavailable' === status` then `.kind` on the next line), the captured operand stops at the line break, so the `.kind` rule misses and a valid Expected-Mark Status comparison is flagged. | Valid (a false positive) | T7P.9-B4 |

**T7P.9-B4: a wrapped `.kind` operand defeats the Expected-Mark Status rule.** Defect: a comparison on Market Data's Expected-Mark Status, written with the code literal first and its operand's `.kind` wrapped onto the next line, fails the check although it isn't a reason branch. Cases: it should pass on `'AcknowledgedUnavailable' === status` followed by `.kind` on the next line; it should pass on the same with the operand wrapped before `?.kind`; it should still fail on `'AcknowledgedUnavailable' === result` followed by `.reason` on the next line. This is the second round of bug tasks on T7P.9 (B1–B3 the first); a third round that still leaves findings stops for the user.

### ocr review of `fd2d751a` (T7P.9-B2)

Session `95b93666-f3e8-4bc7-ac96-cedda00ea27b`, model gpt-6.1-sol, 1 file reviewed in place, 3 findings. Raw output: [ocr/T7P.9-B2-fd2d751a.json](ocr/T7P.9-B2-fd2d751a.json).

| Severity | Location | Finding | Assessment | Bug task |
|---|---|---|---|---|
| medium | `tools/wording-scan.ts:75` | Template literals are copied whole, so a real comment inside `${ … }` (`${1 /* Mark missing */}`) is scanned and reported. | Valid (a false positive) | T7P.9-B5 |
| medium | `tools/wording-scan.ts:73` | An apostrophe in JSX text (`<span>Don't</span>; // Mark missing`) opens a "string" to the end of the line, so a real trailing comment on that line is reported. | Valid (a false positive) | T7P.9-B6 |
| medium | `tools/wording-scan.ts:75` | A backslash before CRLF inside a quoted string skips only the backslash and CR, so the LF ends the string early and a later `//` can hide text. | Doubtful (no file under `src/ui/` has CRLF line endings: `git ls-files --eol src/ui` lists none) | T7P.9-B7 |

**Implementation decision (main session):** B4 to B7 all come from the hand-written scanner's model of JavaScript syntax (where strings, templates, JSX text and comments begin and end, and which operand a comparison has). Each round of hand fixes has exposed another edge. So after T7P.9-B3 lands, one fresh subagent fixes B4 to B7 together by having `scanSource` use the TypeScript compiler's own parser (`typescript`, already a pinned dev dependency at 6.0.2) instead of regexes over blanked text: phrases are matched in string literal, template and JSX text nodes; codes are matched in `case` clauses and equality `BinaryExpression`s whose other operand is not a `.kind` property access; comments are never visited. Each bug task keeps its own cases, run red then green. This is the second round of bug tasks on T7P.9.

**T7P.9-B5 cases:** it should pass on `` `${1 /* Mark missing */}` ``; it should still fail on `` `Mark missing ${x}` ``.
**T7P.9-B6 cases:** it should pass on `<span>Don't</span>; // Mark missing`; it should still fail on `<span>Don't</span>{'Mark missing'}`.
**T7P.9-B7 cases:** it should fail on a code literal after a CRLF line continuation inside a string followed by `//` text, the way the finding describes; it should still pass on the current tree.

### ocr review of `93413c87` (T7P.9-B3)

Session `dc75d5b9-86ed-4a36-b0d1-5881d9fc8402`, model gpt-6.1-sol, 2 files reviewed in place, 2 findings. Raw output: [ocr/T7P.9-B3-93413c87.json](ocr/T7P.9-B3-93413c87.json). B3's own cases (third case a first-run pass, mutation-checked: JSX regex widened to substrings, `AssertionError: expected [ Array(1) ] to deeply equal []`) are unaffected.

| Severity | Location | Finding | Assessment | Bug task |
|---|---|---|---|---|
| medium | `tools/wording-scan.ts:63` | A JSX text node bounded by an expression container (`<p>{icon}No open position</p>`) is missed, since the regex needs `>` and `<` around the words. | Valid (a false negative) | T7P.9-B8 |
| medium | `tools/wording-scan.ts:61` | A longer sentence that quotes a reason (`"The label 'not closed yet' means …"`) is flagged, since the regex doesn't check that the quotes are the literal's own. | Valid (a false positive) | T7P.9-B9 |

Both come from the regexes that B4–B7's parser-based scan replaces. **T7P.9-B8 cases:** it should fail on `<p>{icon}No open position</p>` and on `<p>Not closed yet{icon}</p>`. **T7P.9-B9 case:** it should pass on `"The label 'not closed yet' means the Trade is open"`. They run after B4–B7 land, in a fresh subagent, against the parser-based scan. Still the second round of bug tasks on T7P.9.

### T7P.9-B4 to B7 (`b4056fc6`): the scan uses the TypeScript parser

`scanSource` parses each file with `ts.createSourceFile` (`ScriptKind.TSX` for `.tsx`) and visits string literals, template parts and JSX text for phrases and reason words, and `case` clauses and equality comparisons for codes (skipping a comparison whose other side is a `.kind` property access, optional chaining included); comments are never visited. The old tokenizer and regexes are removed. Hit text for a code is now the source of the `case` clause or comparison, line breaks collapsed; the prefix and line are unchanged.

**Red and first-run passes (flagged):** only B4 case 1 had a genuine red (`AssertionError: expected [ Array(1) ] to deeply equal []`), because the parser replacement, the decision these bug tasks share, landed with it. The other seven new cases (B4 cases 2–3, B5 cases 1–2, B6 cases 1–2, B7 case 1) passed on their first run, each mutation-checked by an assertion failure and restored (table in `tdd-log.md` notes). B7's CRLF premise was exercised with a `'x\` + CR LF + `y'` continuation; the parser reads it natively and the hit lands on line 3.

**Working-rule slip (recorded):** the subagent restored the pre-mutation `tools/wording-scan.ts` once with a shell `cp` from a scratchpad copy, not the Edit tool; the guard allowed it, and the file equals its pre-mutation state.

`npm run verify:wording`, `typecheck`, `tsc6 --noEmit`, `lint`, `lint:deps` and `npx vitest run tools` exit 0.

### ocr review of `b4056fc6` (T7P.9-B4 to B7)

Session `eef1a871-7955-4316-838f-222ca029c11a`, model gpt-6.1-sol, 1 file reviewed in place, 3 findings. Raw output: [ocr/T7P.9-B4-B7-b4056fc6.json](ocr/T7P.9-B4-B7-b4056fc6.json). The parser version does not show B8's or B9's gaps.

| Severity | Location | Finding | Assessment | Outcome |
|---|---|---|---|---|
| medium | `tools/wording-scan.ts:76` | A code literal wrapped in parentheses, `as const`, `satisfies` or `!` (`x === ('MarkMissing' as const)`, `case ('NotClosed'):`) is not a string-literal node, so it is not reported. | Valid (a false negative; the old regex caught these) | T7P.9-B10 |
| medium | `tools/wording-scan.ts:97-98` | Phrases are matched against the literal's source spelling (`getText`), so an escape inside a phrase (`'Mark missing'`) evades the check; the whole-literal check uses the decoded `.text`. | Valid (a false negative) | T7P.9-B11 |
| low | `tools/wording-scan.ts:100, 106` | Nested ternaries should be explicit branches. | **Dismissed**: no failure scenario. No project rule forbids nested ternaries in `tools/` (no lint rule, nothing in `CLAUDE.md` or `.claude/docs`); P71's exhaustiveness rule covers `calculation-words.ts`, and these ternaries choose between two hit kinds, with no union tag that could gain a case. | — |

**This is the third round of bug tasks on T7P.9** (round 1: B1–B3 from T7P.9's review; round 2: B4–B9 from B1–B3's reviews). If B10's and B11's reviews still leave findings, the session stops for the user (handoff, "Running a whole deliverable", condition 6).

**T7P.9-B10 cases:** it should fail on `x === ('MarkMissing' as const)`; it should fail on `case ('NotClosed'):`; it should fail on `'AwaitingClose' satisfies string` compared with `===`; it should still pass on `('AcknowledgedUnavailable' as const) === status.kind`.
**T7P.9-B11 cases:** it should fail on `'Mark missing'`; it should fail on a template literal `` `Awaiting\x20the close` ``; it should still report the hit's line as the literal's line.

### T7P.9-B8 and B9 (`156a4540`, tests only)

Both cases passed on their first run against the parser-based scan (the defects were in the regexes `b4056fc6` replaced), each flagged with a mutation check that failed by an assertion and was restored with the Edit tool: B8, JsxText excluded from the whole-reason check (`AssertionError: expected +0 to be 1`); B9, reason words matched by `includes` (`AssertionError: expected [ Array(1) ] to deeply equal []`). No production code changed.

ocr review, relocated as test-only (scratch clone, test under `src/itg/d07p/cases/`, `wording-scan.ts` copied in the parent commit): session `1064b079-2688-47d8-adbf-4b7da88aed52`, **no findings**. Raw output: [ocr/T7P.9-B8-B9-156a4540.json](ocr/T7P.9-B8-B9-156a4540.json).

### T7P.9-B10 and B11 (`57005d9e`)

A private `unwrap` strips parentheses, `as`, `satisfies`, type assertions and `!` for `isCode` and `isKindAccess`; phrases match on decoded literal text. Genuine reds: B10 cases 1 and 4, B11 case 1. First-run passes (flagged, each mutation-checked by an assertion failure and restored with Edit): B10 cases 2 (`case ('NotClosed'):`) and 3 (`satisfies`), B11 cases 2 (template) and 3 (hit line). Red-first slip (recorded): the subagent wrote the `isKindAccess` unwrap while greening case 1, then reverted it to get case 4's genuine red, and re-applied it.

### ocr review of `57005d9e` (T7P.9-B10 and B11, third round)

Session `05a16eb4-4479-4af7-9429-bc7eceabf802`, model gpt-6.1-sol, 1 file reviewed in place, 1 finding. Raw output: [ocr/T7P.9-B10-B11-57005d9e.json](ocr/T7P.9-B10-B11-57005d9e.json). The unwrap logic showed no failure scenario.

| Severity | Location | Finding | Assessment |
|---|---|---|---|
| low | `tools/wording-scan.ts:111` | A phrase's offset in the decoded text is used as a source offset, so in a multi-line literal with an escape before the phrase, the hit can be reported on the wrong line. The check still fails and names the file and phrase. | Valid (wrong line number only) |

The third round of bug tasks on T7P.9 still leaves a finding, so the session stops for the user (handoff, "Running a whole deliverable", condition 6).

**The user's decision (2026-11-05), after the third round:** fix the finding as T7P.9-B12, and then close T7P.9 whatever B12's ocr review finds; any further finding is recorded for the final report, not turned into a bug task.

**T7P.9-B12: a phrase hit after an escape in a multi-line literal names the wrong line.** Fix: report a phrase or reason-word hit at the line where its literal (or template part, or JSX text node) starts, never from an offset into the decoded text. Cases: it should report a phrase on line 2 of a multi-line template literal starting on line 1, after an escape on line 1, at line 1; it should report a single-line literal's hit at its own line, as today.

### T7P.9-B12 (`bcd1b73b`) and its ocr review; T7P.9 closes

B12: phrase hits use the literal's start line (`hit(start, …)`). The planned case's first red was invalid (the escape made the old offset drift back onto line 1 by accident), so the subagent added a no-escape variant to the same case, which gave the genuine red (hit at line 2, expected 1); the invalid rows stay in `tdd-log.md` with a note. The single-line case was a first-run pass, mutation-checked (`hit(start - 12, …)`, `AssertionError: … :1: … to match … :2: …`). The subagent's first all-checks command was killed with no output; it reran each check alone, all exit 0, `npx vitest run tools` 44 passed.

ocr review: session `fddb2656-14c2-4bfa-862c-9f1806895343`, model gpt-6.1-sol, 1 file reviewed in place, 1 finding. Raw output: [ocr/T7P.9-B12-bcd1b73b.json](ocr/T7P.9-B12-bcd1b73b.json).

| Severity | Location | Finding | Assessment | Outcome |
|---|---|---|---|---|
| medium | `tools/wording-scan.ts:112` | The reason-word branch still adds `raw.indexOf(whole)` to the literal's start, so a reason word after a newline (or an escape) in a multi-line template is reported on a later line than the literal's start. The check still fails, naming the file and the words. | Valid (wrong line number only) | **Recorded, not a bug task**, by the user's decision to close T7P.9 after B12's review. Listed for the final report. It also corrects the B12 report's statement that reason-word hits already used the literal's start. |

**T7P.9 is closed:** `0d61ae73`, `5554bfbd` and bug tasks B1–B12 (`d8927527`, `fd2d751a`, `93413c87`, `b4056fc6`, `156a4540`, `57005d9e`, `bcd1b73b`).

### Cumulative run after T7P.9 and its bug tasks (`t7p-9-final`, at `bcd1b73b`)

| Suite | Result | Output |
|---|---|---|
| Unit | 97 files, 1225 passed, exit 0 | `suite-runs/t7p-9-final-unit.txt` |
| Node integration | 76 files, 154 passed, exit 0 | `suite-runs/t7p-9-final-integration.txt` |
| Browser (Chromium), task tier | 5 passed (13.4 s), exit 0 | `suite-runs/t7p-9-final-browser.txt` |
| Static and verification checks | **13 of 13** exit 0 | `suite-runs/t7p-9-final-checks.txt` |

Stage `browser-auto b436ac7e` (the last commit covered by the full-tier run `t7p-9-verify-wording`); tier task, "no changed path since b436ac7e is on the full-tier list" (only `tools/` changed). Ports free before and after.

## T7P.10 Existing browser cases follow the approved texts

**Fixture kinds, confirmed from the spec code before any change** (`writeIntegrityFixture` edits, `e2e/d2/support.ts:271`; `StoredLifecycle` alone leaves the facts replayable, so it is coherent with findings; `UnknownPlannedLeg` makes the facts unreplayable, so it is incoherent):

| Case | Fixture edits | Kind | Decision |
|---|---|---|---|
| `integrity.spec.ts:18` (Open Trade stored as Planned) | StoredLifecycle | coherent, findings only | keeps "Records disagree" (did not fail) |
| `integrity.spec.ts:57` (Planned row) | StoredLifecycle + UnknownPlannedLeg | incoherent | row badge and Detail panel name become "Facts can't be replayed" |
| `integrity.spec.ts:91` (incoherent Detail) | UnknownPlannedLeg | incoherent | panel name becomes "Facts can't be replayed" |
| `ui-alignment.spec.ts:604` (T2.40; ABC findings, XYZ incoherent) | ABC StoredLifecycle; XYZ StoredLifecycle + UnknownPlannedLeg | mixed: XYZ incoherent | no assertion quotes the text (counts badges and measures geometry); nothing to change |
| `ui-alignment.spec.ts:1614` (T2.62 scroll region) | ABC StoredLifecycle | coherent, findings only | keeps "Records disagree"; unchanged. Section 6.2's "where their fixture is incoherent" does not apply (same for `:682`) |
| `narrow.spec.ts:~87` (Trade stored as Planned) | XYZ StoredLifecycle | coherent, findings only | unchanged (its comment quotes the old panel name only for a findings Trade, so it stays correct) |

No fixture's kind contradicts section 6.2.

**Changes** (section 6.2): breach-overrun.spec.ts (4 expectations plus title: "Awaiting the close after Mon Oct 12"); responsive-a11y.spec.ts (line 175 note "Mark acknowledged unavailable for DEF on Mon Oct 12: ...", lines 219 and 228 AwaitingClose figure); integrity.spec.ts (lines 57 title/78/84 and 91 title/110, titles follow the new text); sliders.spec.ts:80 name gains ": no risk to the Stop". The comment at responsive-a11y.spec.ts:214 still says "Awaiting the next close" and was left alone.

**Each changed case alone** (`npm run build:faults` first, exit 0; ports 5175, 9341, 9342 free before and after): integrity.spec.ts:57 passed, :91 passed, breach-overrun.spec.ts:15 passed, responsive-a11y.spec.ts:118 passed, sliders.spec.ts:60 passed.

**`npm run test:e2e` once:** 163 passed (7.7 m), 0 failed. Ports free after.

**Diff** `git diff claude-opus-5.5-pre-d7p -- e2e`: integrity.spec.ts 5 lines, breach-overrun.spec.ts 5, responsive-a11y.spec.ts 3, sliders.spec.ts 1; no other file.

### ocr review of `b80938d7` (T7P.10, test-only)

Relocated (scratch clone; the four specs under `src/itg/d07p/` as `.ts`, the `support.ts` chain copied in the parent commit): session `ac693a69-0639-4505-b76a-b0b2cf408701`, 4 files reviewed, **no findings**. Raw output: [ocr/T7P.10-b80938d7.json](ocr/T7P.10-b80938d7.json). Note from the T7P.10 report: the comment at `e2e/d4/responsive-a11y.spec.ts:214` still says "Awaiting the next close"; it is a comment, not an expectation, and 6.2 lists only expectations, so it was left.

### Cumulative run after T7P.10 (`t7p-10-browser-texts`, at `b80938d7`)

| Suite | Result | Output |
|---|---|---|
| Unit | 97 files, 1225 passed | `suite-runs/t7p-10-browser-texts-unit.txt` |
| Node integration | 76 files, 154 passed | `suite-runs/t7p-10-browser-texts-integration.txt` |
| Browser (Chromium), full tier (`npm run test:e2e`) | 1 failed, 162 passed (13.4 min), exit 1 | `suite-runs/t7p-10-browser-texts-browser.txt` |
| Static and verification checks | 13 of 13 `EXIT 0` | `suite-runs/t7p-10-browser-texts-checks.txt` |

Stage `browser-auto 2e25034d`; full tier (T7P.10 changed `e2e/`). The runner's final table did not reach the main session, so this table was read from the output files. All five section 6.2 failures of the T7P.7–T7P.9 runs now pass.

**The one failure:** `e2e/d4/card-helpers.spec.ts:111` ("reach (decision 65) › should return the Marks family's row for XYZ on a previous release's Review (dist-releases/d4)"), a 30.0 s timeout. The whole browser stage took 13.4 min against 7.6–8.2 min in every earlier full run, so the machine was under load. **Rerun alone** from the main session (`npx playwright test e2e/d4/card-helpers.spec.ts:111`, ports 5175, 9341, 9342 free before and after): **1 passed (2.8 s)**. The spec is unchanged by the prefactor and runs against the frozen D4 release build, so the failure is a load-related timeout, not a defect. Both outcomes recorded; the gate run (T7P.12) reruns the full tier.
