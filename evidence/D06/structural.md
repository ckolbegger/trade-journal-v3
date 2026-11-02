# D6 structural verifications

Each entry records a structural task's exact verification (D6 breakdown, section 5), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Since decision 71 (P55) the browser stage after a task is `browser-auto <base>`, and each run records the tier it chose and why. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`.

## Start of D6

Location checks (D6 handoff, section 1) on 2026-11-01:
- worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`: matched.
- `git status -sb`: `## claude-opus-5.5...origin/claude-opus-5.5`, clean except the untracked `.claude/settings.json`. It shows no `[ahead N]` because the user has pushed since the handoff was written: `HEAD` and `origin/claude-opus-5.5` are both `1fb692dfd422242dda0184e36335e070607e0da9` (the retrospective's last commit, `docs(plan): D6 handoff after the prefactor retrospective`). The handoff allows this ("if the user has pushed since, N counts from that push").
- `git log --oneline claude-opus-5.5-pre-d6d..HEAD`: the seven prefactor-retrospective commits only, ending with `docs(plan): D6 handoff after the prefactor retrospective`. `git diff --stat claude-opus-5.5-pre-d6d HEAD -- src e2e package.json`: empty.
- tags `claude-opus-5.5-plan-r31`, `claude-opus-5.5-d5`, `claude-opus-5.5-d5r`, `claude-opus-5.5-d5r2`, `claude-opus-5.5-pre-d6d`: present. `git diff claude-opus-5.5-d5r2 claude-opus-5.5-pre-d6d -- src`: empty.
- `claude-opus-5.5-d5r2` is `765ac1ea59f36e7d9923362f655c94bbef90e404`, `claude-opus-5.5-d5r` is `72c742c1b6f393d432e533a7d65b84c45df933ff`, `claude-opus-5.5-d5` is `fbe3bb71dcc7114e7f0568272be48f0412cfeab8`.
- `DEV_PORT=5175`; Node v26.12.0.
- `npm ci`: exit 0. `npx vitest run src`: `Test Files 80 passed (80)`, `Tests 1051 passed (1051)`. `npx vitest run tests/integration`: `Test Files 60 passed (60)`, `Tests 117 passed (117)`.

Spec reading: `plan/spec-reading/D06.md`, as the handoff directs. No other spec section has been needed yet.

## T6.1 Trade Analysis: Sell replay, FIFO Lot Matches, fees, realized P&L

Base commit (for `browser-auto`): `1fb692dfd422242dda0184e36335e070607e0da9`.

Commit `30b20eb5` (T6.1, 5 cases red then green, no first-run pass).

### ocr review of `30b20eb5`

Session `a975500f-5c88-4ae8-8907-590deca5f919`, 3 files reviewed (`sell.test.ts` and `tdd-log.md` excluded), 3 comments. Raw output: [ocr/T6.1-30b20eb5.json](ocr/T6.1-30b20eb5.json).

| # | Severity | Location | Finding | Outcome |
|---|---|---|---|---|
| 1 | high | `derive.ts` `deviationsOf`, `legFulfillmentOf`, `entryWindowOf` | Every Execution's quantity counts as entered, so T-A after X1 counts 130 against 100 and expects a false Entry Size Excess of 30. | **Valid → bug task T6.1-B2.** No later planned case covers it (T6.3 owns only the window cut and the shortfall). |
| 2 | high | `derive.ts` 390–396, 689 | A Position of 0 still derives expected lifecycle Open. | **Covered by planned scope, not a bug task:** T6.2's first case ("expect Closed with terminal time Tuesday 14:00 … after X2") is this behavior's red. Listed for the final report. |
| 3 | medium | `derive.ts` 363 | A Sell beyond the open quantity drops its remainder silently and under-allocates its fee. | **Covered by planned scope, not a bug task:** T6.2's position-path cases (`ExceedsOpenQuantity`, `FlatBeforeLaterFacts`, P22) make such candidates typed rejections. T6.2's brief names the remainder. Listed for the final report. |

### T6.1-B1 Lot Match figures as Calculation Results

Found in T6.1's summary: `LotMatchResult`'s allocated opening fee, allocated disposal fee and realized amount were bare `Rational`s, where A78 says they are separate Calculation Results keyed to the match (and `specs/design/trade-analysis.md`, "Shared values"). Case: "should return each Lot Match's allocated opening fee, allocated disposal fee, and realized amount as Value calculation results, PC1 to X1 holding 1/2, 3/5 and 559/10 after X1". Commit `d78a0f02`: one invalid red (missing test helper, fixed and rerun), then a valid red and green. `realizedToDate` stays a `Rational` (T6.4 wraps realized-to-date in `evaluate`).

ocr review of `d78a0f02`: session `ae8a6afc-1d8a-431f-8b2c-78d29d48f96f`, 1 file reviewed, **no findings**. Raw output: [ocr/T6.1-B1-d78a0f02.json](ocr/T6.1-B1-d78a0f02.json).

### T6.1-B2 Sells are not entered quantity

From ocr finding 1. Case: "should count only Buy Executions as entered, so T-A after X1 and after X2 expects no Entry Size occurrence and Fulfillment FilledAsPlanned, with Entry Quality still resolved at PC2". Commit `3ccd80ce`: red (the false Excess occurrence), then green; no first-run pass. The fix filters `e.action === 'Buy'` in the three entered-quantity sums. Only `deviationsOf`'s filter is proven by this red: on T-A, fulfillment reaches plan at 100 or 130 alike, and the window resolves at PC2 before any Sell. T6.3's window-cut cases exercise `entryWindowOf`'s.

ocr review of `3ccd80ce`: session `1aa3a62f-6f24-4bd9-b838-f2997304a018`, 1 file reviewed, **no findings**. Raw output: [ocr/T6.1-B2-3ccd80ce.json](ocr/T6.1-B2-3ccd80ce.json). The reviewer noted that `entryWindowOf` still places a Sell inside the window (Buy 60, Sell 30, Buy 40 resolves at the third change); that is T6.3's planned cut (A82), not a defect here.

### Cumulative run after T6.1

Label `t6.1-fifo-lot-matches`, at `3ccd80ce` plus uncommitted evidence (2026-11-01 18:36 EST). Outputs in `suite-runs/t6.1-fifo-lot-matches-*.txt`.

| Suite | Result |
|---|---|
| Unit | 81 files, 1058 tests passed |
| Node integration | 60 files, 117 tests passed |
| Browser (Chromium) | **task tier**, printed reason "no changed path since 1fb692dfd422242dda0184e36335e070607e0da9 is on the full-tier list"; no `e2e/d6` yet, so only `@every-task`: 5 passed (9.9 s) |
| Static and verify checks | 12 of 12 exit 0 |

Ports 5175, 9341 and 9342 free before and after.

## T6.2 Trade Analysis: Closed lifecycle, Terminal Disposition, Realized R, close requirement, position paths

Base commit (for `browser-auto`): `3ccd80ce`.

Commit `9e1d243c` (T6.2, 5 cases red then green, no first-run pass). The reds for ocr findings 2 and 3 of T6.1 are this task's lifecycle red (`expected 'Open' to be 'Closed'`) and `ExceedsOpenQuantity` red (`expected IncoherentFacts, got Derived`). The commit also touches `src/ui/screens/TradeDetail.tsx`, adding one copy line for each new `IncoherentFact` reason so that the exhaustive `UNREPLAYABLE` record still typechecks. This is not a plan deviation. T6.14 or T6.19 may reword the lines. Because the commit touches a path under `src/ui/`, P55 puts this task's cumulative run on the full tier.

### ocr review of `9e1d243c`

Session `351aac07-0c5f-4307-9a1c-11d9eba1897d`, 3 files reviewed (`closed.test.ts` and `tdd-log.md` excluded), **no findings**. Raw output: [ocr/T6.2-9e1d243c.json](ocr/T6.2-9e1d243c.json).

Notes for later tasks, from the T6.2 summary:
- The P22 checks run in `derive`'s existing `IncoherentFacts` path, on the facts at the cutoff. An excess Sell does not reduce the checked open quantity, so it does not cascade into further findings.
- `closeRequirement` exists only on `reconciliation`, so only when a candidate binding is supplied. It is computed from the candidate's newest Position Change, the one with the highest `recordedSequence`.
- `terminalTime` is the terminal Position Change's `economicTime`; for X2 that is `2026-10-13T18:00:00Z`.
- The `lots.length > 0` guard in `replayOf` can no longer be reached. It was left in place.

### Cumulative run after T6.2

Label `t6.2-closed-lifecycle`, at `9e1d243c` plus uncommitted evidence (2026-11-01 18:42–18:49 EST). Outputs in `suite-runs/t6.2-closed-lifecycle-*.txt`.

| Suite | Result |
|---|---|
| Unit | 82 files, 1063 tests passed |
| Node integration | 60 files, 117 tests passed |
| Browser (Chromium) | **full tier**, printed reason "first matching path since 3ccd80ce: src/ui/screens/TradeDetail.tsx": 147 passed (6.6 m) |
| Static and verify checks | 12 of 12 exit 0 |

Ports 5175, 9341 and 9342 free before and after.

## T6.3 Trade Analysis: Entry window cutoff and Entry Size shortfall

Base commit (for `browser-auto`): `9e1d243c`.

Commit `3642300c` (T6.3, 2 cases red then green, no first-run pass). It reds the ocr reviewer's T6.1-B2 note: a Sell inside the Entry window left T-S `Unresolved`. Widening `ExpectedDeviation`, `DeviationFingerprint` and `RecordedDeviationVersion` to add the Shortfall variant forced minimal compile-driven edits in `src/modules/trade-record/trade-record.ts` (fingerprint names check; the version builder), `src/coordinators/trade-workflows/record-position-change.ts` (created-occurrence lookup without a Position Change), and `src/ui/screens/TradeDetail.tsx` with its test. These are not plan deviations: T6.6 owns Shortfall persistence and validators, and T6.14 or T6.19 own its copy. The Shortfall fingerprint is `{tradeId, plannedLegId, form: 'Shortfall'}`, the plan's (Trade, leg, Shortfall), with its quantity in `quantityBelowPlan`. The cut is per Position Change: the first change holding a Sell is excluded whole. P55 puts this task's run on the full tier (`src/ui/`).

### ocr review of `3642300c`

Session `6c1fdd26-e3de-40b1-8d13-f64bd45d63ec`, 5 files reviewed (test files and `tdd-log.md` excluded), 2 comments. Raw output: [ocr/T6.3-3642300c.json](ocr/T6.3-3642300c.json).

| # | Severity | Location | Finding | Outcome |
|---|---|---|---|---|
| 1 | medium | `derive.ts` `deviationActions` (768), `deviationFindings` | A Shortfall is Retained by quantity alone. An earlier-dated Sell that moves the cutoff without changing the entered quantity (T-S plus a Sell dated Monday 10:30) leaves the stored occurrence naming XS and its Economic Time, and a read does not flag the mismatch. | **Valid → bug task T6.3-B1.** Not a deviation: A83 says the occurrence holds the cutting Sell's Position Change and its Economic Time, and A26's version already holds both fields. A26 appends a version "when the quantity changes" because an Excess occurrence's cause is part of its fingerprint and cannot change. A Shortfall's cause is not in its fingerprint, so a changed cause or Economic Time also appends a new version. Listed for the final report. |
| 2 | high | `TradeDetail.tsx` 240, 629 | A Shortfall finding has no `positionChangeId`, so `timeOf('')` reaches `Temporal.Instant.from('')` and the Trade Detail render throws. An unexpected Shortfall also shows a blank quantity, because `recorded()` reads only `quantityAbovePlan`. | **Valid → bug task T6.3-B2.** It cannot be reached in the shipped build yet, because Trade Workflows still reject a Sell. Copy wording stays with T6.14 and T6.19. |

### T6.3-B1 A Shortfall whose cause moves appends a new version

From ocr finding 1. Commit `45fece7a`, 2 cases:
- "should append a new Shortfall version naming the earlier-dated Sell and its Economic Time when the cutoff moves without changing the entered quantity". Red: Retain. Green: NewVersion, Shortfall 40, cause `pc-xe`, at `2026-10-12T14:30:00Z`.
- "should report the stored Shortfall as disagreeing when its cause and Economic Time are stale although its quantity matches". Its first red was void: the fixture stored lifecycle Open for a Closed Trade, so an unrelated finding broke the assertion. The fixture was fixed and the case rerun to a genuine red.

A private helper, `holdsExpected`, compares quantity and, for a Shortfall only, the cause and Economic Time. Excess is unchanged. The read side reuses `DeviationQuantityDisagreement` with equal recorded and expected quantities, as the brief directed, so the finding does not say which field moved. Listed for the final report.

ocr review of `45fece7a`: session `86f24054-bf1f-4694-9043-56e72ec64f40`, 1 file reviewed, **no findings**. Raw output: [ocr/T6.3-B1-45fece7a.json](ocr/T6.3-B1-45fece7a.json).

### T6.3-B2 Trade Detail renders a Shortfall integrity finding

From ocr finding 2. Commit `45ef7c32`, 1 case: "should render a Shortfall integrity finding with its quantity below plan and its causing change time without throwing".
- Red: `RangeError: Temporal error: Parsing ended abruptly` from `Temporal.Instant.from('')`.
- Green: the case renders Missing, Quantity Disagreement and Unexpected rows for a Shortfall. Each row's time comes from the occurrence's causing Position Change, or from its `economicTime` when that change is absent.
- Quantity: `quantityAbovePlan ?? quantityBelowPlan`, shown with a placeholder " below plan" suffix that T6.14 and T6.19 may reword. Excess rows are unchanged.

ocr review of `45ef7c32`: session `356a5ff1-ba9c-4d02-b142-c6b7bcf71a0d`, 1 file reviewed, **no findings**. Raw output: [ocr/T6.3-B2-45ef7c32.json](ocr/T6.3-B2-45ef7c32.json).

### Cumulative run after T6.3

Label `t6.3-entry-cutoff-shortfall`, at `45ef7c32` plus uncommitted evidence (2026-11-01 19:04–19:11 EST). Outputs in `suite-runs/t6.3-entry-cutoff-shortfall-*.txt`.

| Suite | Result |
|---|---|
| Unit | 83 files, 1068 tests passed |
| Node integration | 60 files, 117 tests passed |
| Browser (Chromium) | **full tier**, printed reason "first matching path since 9e1d243c: src/ui/screens/TradeDetail.test.tsx": 147 passed (6.6 m) |
| Static and verify checks | 12 of 12 exit 0 |

Ports 5175, 9341 and 9342 free before and after.

## T6.4 Trade Analysis: `evaluate` with realized-to-date

Base commit (for `browser-auto`): `45ef7c32`.

Commit `31bac344` (T6.4, 1 case red then green, no first-run pass).
- Red: `expected '0/1' to be '559/10'`, because realized-to-date was hard-coded to 0.
- The fix is two lines in `evaluate.ts`: `state.realizedToDate`, and `state.fees.incurred` in place of `fees.incurredOpening`.
- Marked P&L, risk, reward, worst case and Overrun already used `openLots`.
- `AwaitingClose` already filters remaining Lots by their opening Execution's time and never counts Sells (A92 with A54). No change was needed. Only a deleted scratch check covered it, so I6.10 is the first test that proves it.
- Realized-to-date does not depend on the Mark: its only condition is "no remaining Lots". For a Closed Trade it gives `NotApplicable(NoRemainingPosition)`, as A92 says. A consumer wanting a Closed Trade's realized figure reads `derive`'s `realizedToDate` or `realizedR`.
- No production path under the full-tier list changed, so P55 puts this run on the task tier.

### ocr review of `31bac344`

Session `b179f9e8-4f74-4066-a8a4-af0b16737f52`, 1 file reviewed (`evaluate.test.ts` and `tdd-log.md` excluded), **no findings**. ocr warned that the background file was over its recommended 2,000 characters (2,252); the run continued. Raw output: [ocr/T6.4-31bac344.json](ocr/T6.4-31bac344.json).

### Cumulative run after T6.4

Label `t6.4-evaluate-realized`, at `31bac344` plus uncommitted evidence (2026-11-01 19:15 EST). Outputs in `suite-runs/t6.4-evaluate-realized-*.txt`.

| Suite | Result |
|---|---|
| Unit | 83 files, 1069 tests passed |
| Node integration | 60 files, 117 tests passed |
| Browser (Chromium) | **task tier**, printed reason "no changed path since 45ef7c32 is on the full-tier list"; no `e2e/d6` yet, so only `@every-task`: 5 passed (12.2 s) |
| Static and verify checks | 12 of 12 exit 0 |

Ports 5175, 9341 and 9342 free before and after.

## T6.5 Persistence: schema v5 and the `v4→v5` transform

Base commit (for `browser-auto`): `31bac344`.

Commit `830cfc28` (T6.5, 3 cases red then green, no first-run pass).
- **Changes:** `SCHEMA_VERSION` is now 5. A sparse `byLifecycleTerminal` index on `['lifecycle', 'terminalDesc', 'tradeId']` was added. `v4ToV5` strips private fields and adds `closeReasonFacts: []`. `terminalTime` and `terminalDesc` are private fields. The rebuild recomputes both for a Closed Trade from its latest Position Change Economic Time; `terminalDesc` uses `activityDesc`'s nine's-complement encoding.
- **Version pins:** raising the shared constant meant bumping the version pins in existing persistence, Workspace and d2/d4/d5 integration tests. It changed tests only, as D5's T5.1 and T5.1-S1 (`fc2dfd78`) did. One describe was renamed: "migration to the current schema, from v1 through v3". No Workspace production code changed, which leaves T6.15 with only its planned migration case.
- **Close Reason field:** the implementer asked whether Close Reason facts belong in the Trade's single `facts` array. T6.5's planned case says each Trade document gets "an empty Close Reason fact list", so the separate `closeReasonFacts` list follows the plan as written. A85's "next Recorded Sequence" is shared with the members, whichever list holds the fact. T6.6 builds on `closeReasonFacts`.
- **Browser tier:** the commit touches `src/persistence/`, so P55 puts this task's run on the full tier.

### ocr review of `830cfc28`

Session `f05f1aa0-b3d5-49cf-8ceb-ad474a26dead`, 5 files reviewed (14 test and evidence files excluded), **no findings**. Raw output: [ocr/T6.5-830cfc28.json](ocr/T6.5-830cfc28.json).

### Cumulative run after T6.5 (first)

Label `t6.5-schema-v5`, at `830cfc28` plus uncommitted evidence (2026-11-01 19:25 EST). Outputs in `suite-runs/t6.5-schema-v5-*.txt`.

| Suite | Result |
|---|---|
| Unit | 84 files: 1071 passed, **1 failed** |
| Node integration | 60 files, 117 tests passed |
| Browser (Chromium) | **full tier**, printed reason "first matching path since 31bac344: src/persistence/candidate.test.ts": 145 passed, **2 failed** (6.8 m) |
| Static and verify checks | 11 of 12 exit 0; `verify:capacity` failed |

Failures:
- **`src/ui/screens/TradeList.test.tsx:133`** (`expect(marks('tj:open-list-ready')).toBe(2)` got 1). This is the load-dependent flake carried from D5, and the handoff says to rerun it once alone. Rerun alone in the main session (`npx vitest run src/ui/screens/TradeList.test.tsx -t "should render distinct Loading"`), it passed (2 passed, 21 skipped). Recorded as a recurrence, not a defect.
- **`e2e/d2/migration.spec.ts:170`** (B2.6) expected the pre-update Trades without the v5 transform's `closeReasonFacts: []`. **`e2e/d5/update.spec.ts:62`** (B5.6) expected About's Schema version "4" and found "5". Both are browser pins that T6.5's version bump missed, so they go to bug task T6.5-B1. Neither needs a production change.
- **`verify:capacity`**: `FAIL basis measured at schema version 4, current is 5: run measure:capacity`. **Expected until T6.22**, which recomputes the capacity basis for schema 5. D5 carried the same failure from T5.1 until T5.19.

### T6.5-B1 Browser cases pinned to schema 4

Commit `5867480c`, test-only. Each case was run alone after `npm run build:faults && npm run build:releases`, red and then green.
- **B2.6** builds its expectation live through `authoritative(...)` from the D1 records. The case now adds `closeReasonFacts: []` to each Trade after that call. The shared helper is unchanged, because B2.5 migrates only to the d2 release.
- **B5.6** reads its About pin from `SCHEMA_VERSION` (`src/persistence/schema.ts`). The case is renamed "show the current schema in About".
- **Other pins:** a grep of `e2e/` found none that the version bump breaks. `e2e/d4/update.spec.ts:40` pins "3" against d4 and B2.3 pins "2" against d2, so neither is affected.

ocr review of `5867480c`, using the relocated procedure for test-only commits: the scratch clone's commit `d96623aa` puts the specs under `src/itg/d06/`. Session `24abbb7b-3533-44d2-a1fa-c087ef9fbdd3`, 2 files reviewed, **no findings**. Raw output: [ocr/T6.5-B1-5867480c.json](ocr/T6.5-B1-5867480c.json).

### Cumulative run after T6.5-B1

Label `t6.5-b1-schema-pins`, at `5867480c` plus uncommitted evidence (2026-11-01 19:37 EST). Outputs in `suite-runs/t6.5-b1-schema-pins-*.txt`.

| Suite | Result |
|---|---|
| Unit | 84 files: 1071 passed, **1 failed** (flake, see below) |
| Node integration | 60 files, 117 tests passed |
| Browser (Chromium) | **full tier**, printed reason "first matching path since 31bac344: e2e/d2/migration.spec.ts": 147 passed (6.6 m) |
| Static and verify checks | 11 of 12 exit 0; `verify:capacity` failed, expected until T6.22 |

Failures:
- **`src/ui/screens/PositionChangeForm.test.tsx`**, "focus after navigation > should move focus to the Record entry heading when the form finishes loading": focus was on `<body>` instead of the `<h1>`. This is new, not carried from D5. Rerun in the main session, it passed alone (`-t "should move focus to the Record entry heading when the form finishes loading"`: 1 passed, 50 skipped) and with its whole file (51 passed). T6.5 and T6.5-B1 changed no UI code, so it is recorded as a load-dependent flake and flagged for the final report. If it fails a later run, it gets a bug task.
- **`verify:capacity`**: `FAIL basis measured at schema version 4, current is 5: run measure:capacity`, expected until T6.22.

T6.5's two browser failures from the first run now pass, and the TradeList flake did not recur.

## T6.6 Trade Record: close facts, Closed index, queries

Base commit (for `browser-auto`): `5867480c`.
