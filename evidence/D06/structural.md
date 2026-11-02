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

Commit `9d6d4e51` (T6.6). It has 5 cases, each red then green, with no first-run pass. Two first reds were void fixture errors: the seeded Trades lacked private keys, and an `applyPreparedChange` fixture was wrong. Both cases were fixed and rerun to genuine reds, with notes in `tdd-log.md`.

What the commit adds:
- **Close Reason on the request:** `PositionChangeChange.closeReasonId?`, the Catalog identity. Trade Record stores it and never requires it. `CloseReasonRequired` is T6.10's.
- **Close Reason fact:** stored in `closeReasonFacts`, single version `{closeReasonId, terminalPositionChangeId}`, sequenced after the members (A85).
- **Terminal fields:** `terminalTime` and `terminalDesc` are set only when the reconciliation expects Closed. They are computed as `rebuild.ts` computes them, and are stripped from candidates and the digest.
- **Closed list:** reads `byLifecycleTerminal` with one `getAll`, in pages of 50.
- **Cutoff query (A88):** `StateAtEconomicCutoff(Open, cutoff)` adds one `getAll` on `byLifecycleTerminal` for terminal times after the cutoff. The Closed rows are merged into the Open page by (`activityDesc`, `tradeId`).

Existing test pins updated for the extra `getAll`:
- `position-change.test.ts`, one case.
- The Review-open read lists in the D4, D5 and D5R `query-count` integration tests.

T6.25 owns the D6 count proof. `TradeAnalysisRecord` gains optional `closeReason` and `terminalTime`; `derive` ignores both. Neither `src/modules/` nor `tests/integration/` is on P55's full-tier list, so `browser-auto` should choose the task tier.

### ocr review of `9d6d4e51`

Session `33ae9998-d426-4526-8b90-15216a46c358`, 4 files reviewed (6 test and evidence files excluded), 2 comments. Raw output: [ocr/T6.6-9d6d4e51.json](ocr/T6.6-9d6d4e51.json). The reviewer also answered three questions it was asked directly.

| # | Severity | Location | Finding | Outcome |
|---|---|---|---|---|
| 1 | medium | `trade-record.ts:428` | Closed queries do not clamp `pageSize` to 50 as Open does, so a caller passing a larger size gets a larger Closed page. | **Doubtful → bug task T6.6-B1.** No caller passes a page size for Closed today. A95 says pages of 50. |
| 2 | low | `trade-record.ts:426` | The `keyedIndex` selection is a nested ternary, which the coding standard prohibits. | **Valid → T6.6-B1**, as a refactor. |
| 3 | medium (reviewer's own) | `trade-record.ts` `applyPreparedChange` | It now accepts `Open` or `Closed` for an existing Trade. Nothing stops an `Open` expectation from storing a Close Reason fact. | **Partly valid → T6.6-B1.** The old check also only compared the expectation against a fixed set, because Trade Analysis decides the lifecycle and the digest binds its reconciliation to the candidate. So re-deriving the position in Trade Record is not added. An `Open` expectation whose candidate adds a Close Reason fact contradicts A85 under every lifecycle rule, so it returns `ReconciliationMismatch`. `Closed` without a Close Reason stays allowed, because non-agency closes (A77, D7) have none. |

The other two direct questions found no defect. A88's merged page holds each Trade once: Closed Trades are not in `byLifecycleActivity`, the Closed set is filtered to keys after the cursor, and any Trade commit expires the cursor. The commit and rebuild values of `terminalTime` and `terminalDesc` agree, and both fields are cleared for a Trade that is not Closed.

### T6.6-B1 Trade Record's Closed paths hardened

From ocr findings 1–3. Commit `23041481`, 2 cases plus a refactor, no first-run pass:
- "should read at most 50 Closed Trades per page even when a larger page size is requested". Red: 55 returned instead of 50. Green: 50 items and a next cursor. The fix adds `CLOSED_PAGE_SIZE = 50` beside `OPEN_PAGE_SIZE`; Planned is unchanged.
- "should return ReconciliationMismatch when the reconciliation expects Open but the candidate adds a Close Reason fact". Red: `Staged`. Green: `ReconciliationMismatch` with nothing staged.
- Refactor: the `keyedIndex` and page-size ternary chains became if / else-if blocks. The module's 39 tests passed before and after.

ocr review of `23041481`: session `3200601f-4c5b-4507-8566-7f2d5eb6e7f5`, 1 file reviewed, **no findings**. Raw output: [ocr/T6.6-B1-23041481.json](ocr/T6.6-B1-23041481.json).

### Cumulative run after T6.6

Label `t6.6-trade-record-close`, at `23041481` plus uncommitted evidence (2026-11-01 20:03 EST). Outputs in `suite-runs/t6.6-trade-record-close-*.txt`.

| Suite | Result |
|---|---|
| Unit | 85 files, 1079 tests passed |
| Node integration | 60 files, 117 tests passed |
| Browser (Chromium) | **task tier**, printed reason "no changed path since 5867480c is on the full-tier list". There is no `e2e/d6` yet, so only `@every-task` ran: 5 passed (11.5 s) |
| Static and verify checks | 11 of 12 exit 0. `verify:capacity` failed, expected until T6.22 |

Ports 5175, 9341 and 9342 free before and after.

## T6.7 Reference Catalog: Close Reasons

Base commit (for `browser-auto`): `23041481`.

Commit `803381da` (T6.7). Both cases went red, then green, with no first-run pass. Before the first red, the `D6_CATALOG_MANIFEST` constant and the optional `closeReasons` manifest type were added, so the red came from the missing behavior rather than an undefined import.

- **Close Reason family.** `CatalogKind` gains `CloseReason`. `CloseReasonRecord` carries `productKey`, `policy: 'SeededValuesRemainSelectable'`, an optional `role` (absent in D6) and `seedOrder`. Manifest v2 adds four product keys:
  - `close-reason.target-reached`
  - `close-reason.stop-triggered`
  - `close-reason.thesis-invalidated`
  - `close-reason.time-based-exit`
- **Query order (plan and spec disagree).** The plan's case lists the selectable Close Reasons "in seed order". `specs/design/reference-catalog.md` says `query` returns "deterministic label/identity order". The implementation follows the plan: Close Reasons sort by `seedOrder`, then label, then identity, and the other families are unchanged. This is not a plan deviation, since the plan is met as written. The disagreement is listed for the final report.
- **Test support edit.** `tests/support/plan-form-facade.ts` needed `CloseReason: []`, because widening `CatalogKind` broke an exhaustive record.
- **For T6.15.** `workspace.ts` and `migration.ts` still seed and validate against `D1_CATALOG_MANIFEST`.
- **For T6.9.** `section.ts` ignores `CloseReason` records.

### ocr review of `803381da`

Session `48b6a882-c615-4eae-a121-222072d0c156`, 5 files reviewed (the test file and `tdd-log.md` excluded), **no findings**. Raw output: [ocr/T6.7-803381da.json](ocr/T6.7-803381da.json).

### Cumulative run after T6.7

Label `t6.7-close-reasons`, at `803381da` plus uncommitted evidence (2026-11-01 20:09 EST). Outputs in `suite-runs/t6.7-close-reasons-*.txt`.

| Suite | Result |
|---|---|
| Unit | 86 files, 1081 tests passed |
| Node integration | 60 files, 117 tests passed |
| Browser (Chromium) | **Task tier.** Printed reason: "no changed path since 23041481 is on the full-tier list". 5 passed (9.9 s). |
| Static and verify checks | 11 of 12 exit 0. `verify:capacity` failed, as expected until T6.22. |

Ports 5175, 9341 and 9342 free before and after.

## T6.8 Journal: Close Review

Base commit (for `browser-auto`): `803381da`.

Commit `78e5b177` (T6.8, 6 cases red then green). Two cases first ran against code written ahead of their red:
- **Contract case.** The prompts were already written. They were emptied to get a genuine red, then restored.
- **Outstanding Debt case.** Defer was already generalized, so the first run passed. Defer was reverted to Position Change Reflection only, giving a genuine red, then restored.

So no first-run pass stands.

What the commit adds:
- **Manifest.** `D5_JOURNAL_MANIFEST` is manifest version 5. It adds Entry Type `entry-type.close-review` and Source `source.trade-close`.
- **Prompts.** `prompt.close-review.take-again`, `.what-worked` and `.key-lesson`. Option ids are `option.close-review.take-again.{yes-as-planned|yes-with-changes|no|unsure}`.
- **Request type.** `CloseReviewRequest` takes a Trade anchor, the terminal Position Change as origin, and `momentTime`. The obligation key is stored as `CloseReview:<tradeId>`, in the existing string key style.
- **Shared paths.** Decline, Defer (`OneSessionGrace`, due anchor = moment time) and the resolution core now accept both obligation kinds. The resolution key is chosen from the Debt's Entry Type.
- **Resolution decline.** It is generalized too, but no planned case covers it.

The `prepareEffects` overload for `CloseReviewRequest` must come before the Position Change Reflection one. Two existing tests read `Parameters<Journal['prepareEffects']>[0]`, which resolves to the last overload.

### ocr review of `78e5b177`

Session `ec0ce8ae-f20a-4c67-836d-ff420b6a45f6`, 4 files reviewed (test file and `tdd-log.md` excluded), **no findings**. Raw output: [ocr/T6.8-78e5b177.json](ocr/T6.8-78e5b177.json). The reviewer was asked two questions directly, and both answers found no defect:
- Every Position Change Reflection path is unchanged.
- A Close Review Debt resolves under `CloseReview:<tradeId>`, the key taken from `debt.anchor.tradeId`, and against its snapshotted `definitionId`.

The reviewer also noted, without calling it a defect, that `ResolveDebt` picks the key with one `entryTypeKey` equality. A future Entry Type that carries a Debt would therefore fall through to the Position Change Reflection key.

### Cumulative run after T6.8

Label `t6.8-close-review`, at `78e5b177` plus uncommitted evidence (2026-11-01 20:18 EST). Outputs in `suite-runs/t6.8-close-review-*.txt`.

| Suite | Result |
|---|---|
| Unit | 87 files, 1087 tests passed |
| Node integration | 60 files, 117 tests passed |
| Browser (Chromium) | **task tier**, printed reason "no changed path since 803381da is on the full-tier list": 5 passed (10.0 s) |
| Static and verify checks | 11 of 12 exit 0; `verify:capacity` failed, expected until T6.22 |

Ports 5175, 9341 and 9342 free before and after.

## T6.9 Section validators: Trade Record and Catalog

Base commit (for `browser-auto`): `78e5b177`.

Commit `433acc1c` (T6.9, 2 cases red then green, no first-run pass).
- **Trade Record validator.** It now reports four issues: `CloseReasonOnNonTerminalChange`, `MultipleCloseReasons`, `MissingCloseReason` and `UnknownCloseReason`.
  - The terminal change comes from the validator's existing self-derivation: the last fact's Position Change, when `expectedLifecycle` is Closed. A Trade with `IncoherentFacts` skips these checks.
  - `TradeSectionReferences` gains `closeReasonIds`.
- **Catalog validator.**
  - It reports `SeededRecordInactive` and `LabelNotDistinguishable` for Close Reasons. The Catalog validator did not have these checks before, even for Strategies; they are new and apply to Close Reasons only.
  - It reports `UnknownSeedKey` for an unseeded Close Reason key. That assertion goes beyond the plan's wording and has its own red.
- **Catalog case's first red.** It was a `TypeError` (`closeReasonIds is not iterable`), a runtime failure caused by the missing reference set.
- **Edits outside the validators.**
  - `migration.ts` forwards the new reference set. T6.15 still owns the switch to D6's manifest.
  - `src/ui/readiness-copy.ts` gains six plain strings, because its exhaustive `Record<MigrationIssue['code'], string>` would otherwise fail `typecheck`. T5.5 and T5.5-B2 made the same kind of edit.
- **Browser tier.** The commit touches `src/ui/`, so P55 puts this run on the full tier.

### ocr review of `433acc1c`

Session `5a82717a-85d7-4ffe-9d9f-ac8755d1f32e`, 4 files reviewed, 2 comments. Raw output: [ocr/T6.9-433acc1c.json](ocr/T6.9-433acc1c.json).

| # | Severity | Location | Finding | Outcome |
|---|---|---|---|---|
| 1 | medium | `trade-record/section.ts:85` (loop 56–59) | Close Reason fact identities are left out of the shared `DuplicateFactIdentity` check, which visits only `document.facts`. | **Valid → bug task T6.9-B1.** A85 makes the Close Reason a Trade fact identity. |
| 2 | medium | `reference-catalog/section.ts:26` | `knownKeys` merges Strategy and Close Reason product keys, so a key from the wrong family passes `UnknownSeedKey`. | **Valid → T6.9-B1.** Keep one key set per kind. |

The reviewer was also asked three direct questions. All three answers found no defect:
- A coherent Closed Trade with one Close Reason on its terminal change is not reported.
- An Open Trade reports nothing spurious.
- `terminalTime` is never reported.

### T6.9-B1 Close Reason identities and per-kind product keys

This bug task comes from ocr findings 1 and 2. It is commit `f7d911b0`, with 2 cases, each run red then green.

- "should report DuplicateFactIdentity when a Close Reason fact reuses another fact identity"
  - Red: `[]` was returned instead of the two issues. The first logged red row is void: it ran before the edit applied, so it ran nothing. A note in the refactor row records this.
  - The fix iterates `[...document.facts, ...(document.closeReasonFacts ?? [])]`.
- "should report UnknownSeedKey for a Close Reason carrying a Strategy product key and a Strategy carrying a Close Reason product key"
  - Red: `[]` was returned instead of two issues.
  - The fix keeps one product-key set per kind.

ocr review of `f7d911b0`: session `0ada0049-927d-4bc7-a0b0-0469f174ee48`, 2 files reviewed, **no findings**. Raw output: [ocr/T6.9-B1-f7d911b0.json](ocr/T6.9-B1-f7d911b0.json).

### Cumulative run after T6.9

Label `t6.9-section-validators`, at `f7d911b0` plus uncommitted evidence (2026-11-01 20:29 EST). Outputs in `suite-runs/t6.9-section-validators-*.txt`.

| Suite | Result |
|---|---|
| Unit | 87 files, 1091 tests passed |
| Node integration | 60 files, 117 tests passed |
| Browser (Chromium) | **full tier**, printed reason "first matching path since 78e5b177: src/ui/readiness-copy.ts": 147 passed (6.6 m) |
| Static and verify checks | 11 of 12 exit 0; `verify:capacity` failed, as expected until T6.22 |

Ports 5175, 9341 and 9342 free before and after.

## T6.10 Trade Workflows: `recordPositionChange` (reduce and close)

Base commit (for `browser-auto`): `f7d911b0`.

Commit `ceb38daf` (T6.10): 8 planned cases plus one extra (6b, which checks that a recorded Sell left short is named by `factId` and `available`). Every case went red then green, with no first-run pass.

**Command.** `PositionChangeCommand` gains `closeReasonId?` and `closeReview?` (a `ReflectionDisposition`).

**Rejections.** All issues come back as `Rejected` with `issues`, and nothing is written:
- `CloseReasonRequired` and `CloseReviewDispositionRequired` for `TerminalWithAgency`, and the two `NotApplicable` issues for `NotTerminal`.
- Catalog `UnknownReference` and `WrongKind`.
- P22's `ExceedsOpenQuantity` and `FlatBeforeLaterFacts`, from Trade Analysis.
- `TradeClosed`, checked on the stored lifecycle right after `prepareChange`.

**Issue gating.** When there are member-field issues, analysis is skipped, so the analysis issues are not reported. Journal issues do not stop analysis.

**Receipt.** It gains `closeReview?`, `lotMatchChanges` (Created, Revised and Superseded, with quantity before and after) and `realizedToDate {before, after}`.

**Variant.** `UninstalledVariant` replaces `'Sell'` with `'MixedActions'`. A76 says a Buy mixed with a Sell returns `VariantNotInstalled`. Three tests that sent a lone Sell now send a mix: two in `record-position-change.test.ts` and `tests/integration/d2/rejections.test.ts:55`.

**Journal.** The two obligations are prepared with two `prepareEffects` calls and applied with two `applyPreparedEffects` calls in one transaction. ocr was asked about counter collisions.

**Other files.** `src/app/types.ts` re-exports `LotMatchChange`. This is on P55's full-tier list (`src/app/`), so this task's run is full tier. The test helper `exitReference()` seeds Catalog v2 and Journal v5 itself until T6.15.

### ocr review of `ceb38daf`

Session `e0cb1f19-1467-4c90-9b41-746b6a154cca`, 4 files reviewed (2 test files and `tdd-log.md` excluded), 2 comments. Raw output: [ocr/T6.10-ceb38daf.json](ocr/T6.10-ceb38daf.json).

| # | Severity | Location | Finding | Outcome |
|---|---|---|---|---|
| 1 | medium | `record-position-change.ts:336` | `TradeClosed` reads the stored lifecycle, so a stale stored `Closed` over Open facts is rejected rather than repaired (P7). | **Wrong, dismissed.** T6.10's planned case says to reject "any Position Change on a Trade whose stored lifecycle is Closed with TradeClosed and write nothing", and P22 agrees. A96 discusses only the reverse disagreement, stored Open over flat facts. Repairing here would contradict the planned case. Listed for the final report as an edge the plan does not discuss: stored Closed over Open facts, reachable only by corruption or import. |
| 2 | medium | `record-position-change.ts:366–368` | When the stored before-state is already path-incoherent and the candidate is coherent, `derive` returns the before-state's findings (`derive.ts` around line 877). The workflow then reports them as P22 issues in `Rejected`, where it used to return `IntegrityDisagreement`. | **Doubtful → bug task T6.10-B1.** It is reachable only through corruption or import. Before T6.10 this state gave `IntegrityDisagreement`, and that is still the truthful answer for a stored book the trader cannot fix through a Position Change. |

The reviewer was asked three questions directly:
- **Two `applyPreparedEffects` calls.** No defect. Ids come from the shared `deps.ids.next()` and the obligation keys differ. Both calls stage the same `journal@n` check and the same `n+1` put, so the counter advances once, and a concurrent move makes the result a counter-only `Conflict`. `retryCounterConflict` re-prepares both.
- **Issue gating.** Nothing is committed with issues. When there are member-field issues, the close-requirement, Catalog and Close Review form issues are not reported alongside them. That cannot be avoided, because whether the change is terminal needs `derive`, and `derive` cannot run on unparsable values. Listed for the final report.
- **`TradeClosed`.** It is checked before analysis or any write, for Buys and Sells alike. A `VariantNotInstalled` or a stale-revision `Conflict` returns first.

### T6.10-B1 An already-incoherent stored book returns IntegrityDisagreement

This is ocr finding 2, fixed in commit `85885d28` with 1 case, run red then green.

- **Case:** "should return IntegrityDisagreement, not P22 issues, when the stored Trade is already path-incoherent". The stored X1 Sell is rewritten to 150 against 100 open, and then a sound Sell of 10 is recorded.
  - Red: `Rejected`.
  - Green: `IntegrityDisagreement`, with the stored Sell's `ExceedsOpenQuantity` (available 100) and no writes.
- **Why a second derive.** `derive` alone cannot tell inherited incoherence from candidate-introduced incoherence. So when the candidate is `IncoherentFacts`, the workflow also derives the before-state alone, which costs one extra `derive` on that path only.
- **Behavior now.** P22 issues are still returned when the before-state is coherent, which covers case 6b. `src/domain/trade-analysis/` is unchanged.

ocr review of `85885d28`: session `dba8e357-f948-4208-a517-b220b9c64c40`, 1 file reviewed, **no findings**. Raw output: [ocr/T6.10-B1-85885d28.json](ocr/T6.10-B1-85885d28.json).
- A candidate-introduced P22 issue is still reported as `Rejected`; a coherent before-state sends it through `positionPathIssues`.
- The extra `derive` runs only on the incoherent path.
- The reviewer noted one pre-existing ordering, not as a defect: a command with Journal issues over an already-incoherent stored Trade returns `Rejected` rather than `IntegrityDisagreement`. Nothing is written either way.

### Cumulative run after T6.10

Label `t6.10-record-exit`, at `85885d28` plus uncommitted evidence (2026-11-01 20:57–21:04 EST). Outputs in `suite-runs/t6.10-record-exit-*.txt`.

| Suite | Result |
|---|---|
| Unit | 87 files, 1101 tests passed |
| Node integration | 60 files, 117 tests passed |
| Browser (Chromium) | **full tier**, printed reason "first matching path since f7d911b0: src/app/types.ts": 147 passed (6.6 m) |
| Static and verify checks | 11 of 12 exit 0; `verify:capacity` failed, expected until T6.22 |

Ports 5175, 9341 and 9342 free before and after.

## T6.11 Daily Review: `open`

Base commit (for `browser-auto`): `85885d28`.

Commit `bb02208d` (T6.11). It covers 3 planned cases, plus 3 domain cases under "owed-group order (A89)" in `classify-due.test.ts`.

**First-run pass, flagged for the user: case 1** ("should walk T-N in the Tuesday Review although it is now Closed").
- T6.6's A88 extension and the existing derive-at-cutoff filter already built this behavior.
- Mutation check: `eligibleTrades` was changed to drop stored-Closed Trades. The case then failed with `AssertionError: expected undefined to be defined`. The mutation was reverted, and `git diff -- src` came back empty.

**Domain cases, flagged for the user.** `compareOwed` and `owedStandingOf` were written for case 2's green, and their tests were added afterwards. Two mutation checks were run on them:
- Dropping the due-first rule failed the tests.
- Comparing anchors as text failed the tests.

The first version of the tests survived the due-first mutation, so a hand-built standing case was added.

**Cases 2 and 3.** Both had genuine reds. Case 2's green kept a one-line stub of the old early `Empty` return, so that case 3 could still go red; case 3's green removed it.

**Shape of the owed group.**
- `owed: OwedReflectionsTrade[]` is a top-level field on `Ready` and `Empty`. It is not a `ReviewFamily`.
- Each entry is `{ tradeId, underlying, lifecycle, owed: OwedReflectionItem[], progress }`.
- `OwedReflectionItem` is `{ debtId, entryTypeKey, dueAnchor, classification }`.
- Each owed Trade costs one `getRecord` Summary.

**When `open` returns `Empty`.**
- `Empty` now carries a binding and settles through `coherently`.
- `Empty` is returned only when nothing is walked and nothing is due.
- A due owed reflection with an empty walk returns `Ready`, `Incomplete` with `ReflectionDue`.

**Order.** `compareOwed` sorts due first, then by the oldest owed anchor as an instant, then by Trade identity.

**Other changes.**
- `tests/support/closed-trade-review-fixture.ts` is the fixture builder, which T6.12 and T6.13 reuse. Its Monday state exists only at clock Monday 17:00, before Tuesday's facts are recorded.
- UI test files gained `owed: []` lines because the field is required. No UI source changed.
- `src/app/types.ts` re-exports the new types. That puts the run on the full tier under P55.

### ocr review of `bb02208d`

Session `8d72b4e4-425f-4092-b605-69efd920b3aa`, 8 files reviewed (9 excluded), 2 comments. Raw output: [ocr/T6.11-bb02208d.json](ocr/T6.11-bb02208d.json).

| # | Severity | Location | Finding | Outcome |
|---|---|---|---|---|
| 1 | medium | `daily-review.ts:422` (`nextTaskOf`, line 169) | `nextTaskOf` ignores the owed group, so saving the last walked Action can return `Incomplete` with `nextStep: Done` while an owed reflection outside the walk is still due. | **Covered by planned scope, not a bug task.** T6.13's planned case expects T-M's card as the next step after the last walked Action (plan, near line 374). T6.13's brief names this finding. Listed for the final report. |
| 2 | low | `journal-debt/index.ts:33` | `compareOwed` ends in a nested ternary, which the coding standard prohibits. | **Valid → bug task T6.11-B1.** |

The reviewer was asked four questions directly. It found no defect in any of them:
- **Walked and owed Trades are disjoint by construction.**
- **A not-yet-due reflection never blocks Complete.**
- **Every owed Trade's `factRevision` and Debts are in the binding**, and `coherently` compares `contentRevision` around the whole assembly. The group reads are separate `getRecord` calls guarded by that retry, the same way the rest of `assemble` already works.
- **Per-Trade work is bounded** to one `getRecord` per owed Trade.

The reviewer also raised a minor point: the comment on `OwedReflectionsTrade.owed` says "in due-anchor order", but the items keep the Journal query's order. T6.11-B1 checks this.

### T6.11-B1 `compareOwed` refactor and owed-item order

From ocr finding 2 and the reviewer's minor note. Commit `8f8840a2`.

**Refactor.** `compareOwed` no longer ends in a nested ternary. The domain tests passed before and after: 7 and 7.

**Owed-item order.** The comment said the items were in due-anchor order, and that was not guaranteed.
- Journal's `byOutstandingDue` index orders due anchors as text. `recordPositionChange` checks `economicTime` with `Date.parse` only, so a sub-second or offset anchor sorts wrongly as text.
- The new case is "should list the reflections one Trade owes in due-anchor order as instants, a later anchor whose text sorts first coming last".
  - First attempt: it read `Ready` where the result is `Empty`. That was a fixture error and does not count as a red.
  - Genuine red: text order.
  - Green.
- `owedGroup` now sorts each Trade's items with the new `compareDueAnchors`, which compares instants.

**Pre-existing exposure, not fixed, listed for the final report.**
- The Walked card path in `daily-review.ts` (around line 456) takes the Journal query's text order too.
- Any other consumer of `byOutstandingDue` that needs instant order has the same exposure, because `economicTime` is not normalized to one UTC form when recorded.

ocr review of `8f8840a2`: session `901078de-b9f6-4955-8297-ba5aa8680304`, 2 files reviewed, **no findings**. Raw output: [ocr/T6.11-B1-8f8840a2.json](ocr/T6.11-B1-8f8840a2.json).

### Cumulative run after T6.11

Label `t6.11-review-open`, at `8f8840a2` plus uncommitted evidence (2026-11-01 21:25 EST). Outputs in `suite-runs/t6.11-review-open-*.txt`.

| Suite | Result |
|---|---|
| Unit | 88 files, 1108 tests passed |
| Node integration | 60 files, 117 tests passed |
| Browser (Chromium) | **full tier**. Printed reason: "first matching path since 85885d28: src/app/types.ts". 147 passed (6.6 m) |
| Static and verify checks | 11 of 12 exit 0. `verify:capacity` failed, which is expected until T6.22 |

Ports 5175, 9341 and 9342 free before and after.

## T6.12 Daily Review: `getTrade` card kinds

Base commit (for `browser-auto`): `8f8840a2`.

Commit `b8108e30` (T6.12): 2 planned cases plus 2 extra cases for due-anchor order (owed card and Walked card), each red then green, no first-run pass. Two pieces of code were written before their red and removed to get a genuine red, then restored, with a note row in `tdd-log.md`:
- the Walked card's `lifecycle` and `exitRoute`;
- the `toSorted` in `reflectionsOf`.

Changes:
- `getTrade` returns a new kind, `{ kind: 'ReflectionsOwed', reviewDate, cutoff, card: OwedReflectionsCard }`, for a non-eligible Trade with Outstanding Debts in the binding. It reads the Trade twice with `getRecord` (Summary and AnalysisInput). `OwedTradeSummary` is either Closed (realized P&L, Realized R, Terminal Disposition, Close Reason id and label, terminal time) or Open (position, Entry Resolution).
- Walked cards gain `lifecycle` (stored) and `exitRoute?: { remainingQuantity }`, which is present only while the Trade is currently Open. T-N, sold after the close, has none.
- Both kinds sort reflections with `compareDueAnchors`. The Walked card previously used Journal's text order.
- Four UI test builders gained `lifecycle: 'Open'`, because the new field is required. `src/app/types.ts` re-exports the new types, which puts this task on the full tier.

**Gap found in the main session's reading:** A90 lists "Close Review outcome" in a `ReflectionsOwed` card's Closed summary, and T6.12 left it out because its planned case does not name it. A90 is part of the plan, so it is fixed in a bug task, not deferred.

### ocr review of `b8108e30`

Session `e87a3383-8f4c-4dbc-b446-792945f5e424`, 4 files reviewed, **no ocr comments**. Raw output: [ocr/T6.12-b8108e30.json](ocr/T6.12-b8108e30.json). The reviewer also answered three questions directly:

| # | Question or point | Outcome |
|---|---|---|
| 1 | Is the owed card bound the way the walked card is? | **Yes.** FactRevision, the Market Data snapshot and the Debt list are each compared, and the whole pass runs inside `coherently`. No test has an owed card return `ReviewChanged`. **That test goes into T6.12-B1.** |
| 2 | Do the Closed summary's realized P&L and Realized R equal `derive`'s values? | **Yes.** The branch follows the stored lifecycle, and the type allows that. |
| 3 | `labelsOf` resolves account, Strategy and Close Reason in one Catalog call, so one unknown reference blanks all three labels. `closeReason` is also omitted when it fails to resolve, which makes a failed lookup look the same as "closed without one". | **Doubtful → T6.12-B1.** The Close Reason is to be resolved on its own, keeping the id when the label is missing. |

T6.12-B1 also carries the A90 gap recorded above: the Close Review outcome is missing from the Closed summary.

### T6.12-B1 Owed card: Close Review outcome, Close Reason resolution, binding test

Commit `0f0f4769`, three cases. It covers the A90 gap and ocr points 1 and 3.

1. **"should carry the Close Review outcome in the Closed summary of an owed card".**
   - Red: `undefined`. Green afterwards.
   - It covers T-M's Debt and an inline Closed Trade whose Close Review is completed, which gives an Entry.
   - The outcome is read with Journal's `TradeNarrative` query and picked by the Entry Type label `'Close Review'`. ocr was asked whether this label matching is a defect.
2. **"should keep an owed card Close Reason identity and the account and strategy labels when the Close Reason cannot be resolved".**
   - Red: all labels blank. Green afterwards.
3. **"should return ReviewChanged for an owed card when its Trade facts or Outstanding Debts change after open".**
   - **First-run pass, flagged for the user.** T6.12 had already built the behavior.
   - Mutation check: the owed card's FactRevision comparison was removed, and the case failed with `expected { kind: 'ReflectionsOwed', … } to deeply equal { kind: 'ReviewChanged' }`. The comparison was then restored.

ocr review of `0f0f4769`: session `a2f0f43c-6dc4-4709-bcbd-e63a9735e346`, 2 files reviewed, 1 comment. Raw output: [ocr/T6.12-B1-0f0f4769.json](ocr/T6.12-B1-0f0f4769.json).

| # | Severity | Location | Finding | Outcome |
|---|---|---|---|---|
| 1 | medium | `daily-review.ts:493` | The Close Review narrative item is found by its display label `'Close Review'`, not a stable Entry Type identity. If the label drifts, `closeReviewOutcome` is dropped silently. | **Valid → bug task T6.12-B2** (second round on T6.12). `TradeNarrativeItem` exposes only the label. |

The reviewer was also asked two questions:
- **A89 per-history work:** no violation. There is one bounded query per owed Closed card fetched, made in `getTrade` only.
- **Decline outcome:** cannot be misreported.

### T6.12-B2 The owed card finds its Close Review outcome by Entry Type key

This fixes T6.12-B1's ocr finding. Commit `dde2eb54` has 2 cases, each red then green, with no first-run pass.

1. **Journal:** "should carry the stable Entry Type key on every item of the Trade narrative: an Entry, a decline, and a Debt". The red was `entryTypeKey` `undefined` on all three items.
2. **Daily Review:** "should find the Close Review outcome by its Entry Type key when the Entry Type label differs". The stored Entry Type was relabelled "Closing Reflection". The red was a missing `closeReviewOutcome`.

`entryTypeKey` is now required on Journal's narrative items. `closeReviewOutcomeOf` matches on `'entry-type.close-review'`, and the label constant is gone.

Because the field is required, several places needed one-line additions:
- `src/ui/screens/confirmed-detail.ts`, which builds a Plan Reflection narrative item. That puts this task's run on the full tier.
- The narrative-item fixtures in `TradeDetail.test.tsx`, `ReviewCard.test.tsx`, `tests/support/open-detail-fixtures.ts` and `views-fixtures.ts`.
- Exact-item expectations in three Journal tests and a key-list check in `trade-views/open-views.test.ts`.

ocr review of `dde2eb54`: session `7d494652-bc90-43be-9a39-474b9caa409b`, 6 files reviewed, **no findings**. Raw output: [ocr/T6.12-B2-dde2eb54.json](ocr/T6.12-B2-dde2eb54.json).

The two checks asked of the reviewer both found no defect:
- Every Journal path that builds a narrative item fills `entryTypeKey` from the stored key.
- `'entry-type.plan-reflection'` matches `manifest.ts` line 20.

### Cumulative run after T6.12

Label `t6.12-card-kinds`, at `dde2eb54` plus uncommitted evidence (2026-11-01 22:04 EST). Outputs in `suite-runs/t6.12-card-kinds-*.txt`.

| Suite | Result |
|---|---|
| Unit | 89 files, 1117 tests passed |
| Node integration | 60 files, 117 tests passed |
| Browser (Chromium) | **full tier**, printed reason "first matching path since 8f8840a2: src/app/types.ts": 147 passed (6.8 m) |
| Static and verify checks | 11 of 12 exit 0; `verify:capacity` failed, expected until T6.22 |

Ports 5175, 9341 and 9342 free before and after.

## T6.13 Daily Review: `save` across the walk and the group

Base commit (for `browser-auto`): `dde2eb54`.

Commit `759e171a` (T6.13). The one planned case has two clauses, split into tests in `owed-save.test.ts`, plus two added cases.

| Test | Result |
|---|---|
| Answer-and-Complete clause | **First-run pass, flagged for the user.** D5's `ResolveReviewDebt`, T6.8's resolution and T6.11's owed-group reasons had already built it. Mutation check: the owed-group `ReflectionDue` filter in `assemble` was inverted, and the case failed with `expected { kind: 'Incomplete', … } to deeply equal { kind: 'Complete' }`. The filter was then restored. |
| Next-step clause | This is T6.11's ocr finding 1. Red: `{ kind: 'Done' }` instead of T-M's card. Then green. |
| Added: a resolved Debt returns its owed Trade's progress in `cards` | Red, then green. |
| Added regression: a Marks save with the walk done returns T-M's card | Red: `ChangedDuringAssembly`. Then green. |

Changes:
- `ReviewNextStep` and `MarksNextStep` gain `{ kind: 'OwedTrade', card }`.
- `nextTaskOf` takes the owed group.
- `PostSaveReview.cards` may hold an owed Trade's progress. That includes a synthetic done progress for a Trade that has just left the group.
- `src/ui/screens/held-review.ts` gains a minimal `NextCard` variant, without which typecheck fails. T6.20 renders it. This change puts the task on the full tier.

The implementer raised an open question, and it was put to ocr. With no walk, resolving the last due reflection makes the post-save pass `Empty`, and `readAfterSave` maps that to `ChangedDuringAssembly` although the save committed.

### ocr review of `759e171a`

Session `f3cf3c26-8425-4250-b0dd-2ab815d87176`, 3 files reviewed, 1 comment. Raw output: [ocr/T6.13-759e171a.json](ocr/T6.13-759e171a.json).

| # | Severity | Location | Finding | Outcome |
|---|---|---|---|---|
| 1 | medium | `daily-review.ts:775` (`assemble` ~408, `readAfterSave` ~749) | **Empty Review after the last due reflection.** With no walk, resolving the last due reflection makes the post-save pass `Empty`. `readAfterSave` maps that to `ChangedDuringAssembly`, so a committed save is reported as an unstable read, with no `Done` step and no card progress. This breaks A90 and AC-RESP-001. | **Valid → bug task T6.13-B1.** This was the implementer's open question. `ChangedDuringAssembly` means the retries were exhausted by concurrent writes (A46). `Empty` is a settled state. |

Direct questions:
- **Next-step order:** no defect. The owed next step comes only after every walked card is done. Not-yet-due Trades (T-L, T-Q) are never chosen.
- **Synthetic done progress:** correct in every reachable case.
- **Post-save reads:** no per-history reads beyond the one next-step card.

### T6.13-B1 An Empty post-save pass settles as Ready

From ocr finding 1. Commit `14a17f7a`, 1 case run red then green:
- **Case:** "should return a settled Complete review with next step Done when resolving the last due reflection leaves a Review with no walk Empty".
- **Red:** `ChangedDuringAssembly`.
- **Green:** `Complete`, `Done`, zero progress, T-M's done card, and a binding equal to the binding of a reopened `Empty` Review.
- **Fix:** `readAfterSave` settles an `Empty` pass into the existing Ready read, so no new result kind is needed.
- **Left as is:** a Marks save with no walk still gives `ChangedDuringAssembly`. There are no Marks to save, so that path cannot be reached.

ocr review of `14a17f7a`: session `167a91be-420b-405e-9e81-2f0e11fe50f5`, 1 file reviewed, **no findings**. Raw output: [ocr/T6.13-B1-14a17f7a.json](ocr/T6.13-B1-14a17f7a.json).
- A torn read still retries under `coherently`, so it can never settle as `Ready`.
- The binding is built the way `open`'s `Empty` builds it.
- Observation: the doc comment above `readAfterSave` still says a non-Ready Review is "for the trader to open afresh", which is now stale for `Empty`. Recorded only; it was not changed.

### Cumulative run after T6.13

Label `t6.13-review-save`, at `14a17f7a` plus uncommitted evidence (2026-11-01 22:17 EST). Outputs in `suite-runs/t6.13-review-save-*.txt`.

| Suite | Result |
|---|---|
| Unit | 90 files, 1122 tests passed |
| Node integration | 60 files, 117 tests passed |
| Browser (Chromium) | **full tier**, printed reason "first matching path since dde2eb54: src/ui/screens/held-review.ts": 147 passed (6.6 m) |
| Static and verify checks | 11 of 12 exit 0; `verify:capacity` failed, expected until T6.22 |

Ports 5175, 9341 and 9342 free before and after.

## T6.14 Trade Views: Closed list and Detail; Open Detail with Lot Matches

Base commit (for `browser-auto`): `14a17f7a`.

Commit `83e5f441` (T6.14): 3 planned cases plus 2 extra cases.

**Cases.**
- **Planned cases.** Red, then green.
  - Closed list: the Closed lifecycle fell through to the Planned builder.
  - Closed Detail: first red was a Market Data read in the Closed form. After the redesign, the second red was a missing `realizedToDate`.
  - Open after X1: `lotMatches` was missing.
- **Extra: Closed row whose facts cannot be replayed.** Red, then green.
- **Extra: "should still show the other labels when the Close Reason is unknown to the Catalog".** **First-run pass, flagged for the user.** The planned Closed Detail case had already built a separate Close Reason resolve.
  - Mutation check: the Close Reason was folded into the Account and Strategy resolve. The case failed with `expected { strategy: '', account: '', … }`, and the code was restored.

**Closed list.**
- `browseTrades<'Closed'>` returns `ClosedTradeItem`: `underlying`, labels, `netRealizedPnl`, `realizedR`, `terminalDisposition`, `closeReason?`, `terminalTime`, `deviationCount`, `reflectionOwed` and `integrity`. There is also an `IncoherentClosedTradeItem` variant.
- No Market Data is read.
- Each distinct Close Reason is resolved in its own call.

**Detail.**
- `OpenTradeDetail` gains `lotMatches`, `realizedToDate` and `feeReconciliation` (`incurred`, `incurredOpening`, `incurredDisposal`, `allocatedOpening`, `allocatedDisposal`, `unconsumedOpening`).
- `ClosedTradeDetail extends OpenTradeDetail` and adds `terminalDisposition`, `closeReason?`, `terminalTime` and `realizedR`. For a Closed Trade, `realizedToDate` is the net realized P&L.
- The Closed form takes the Open assembly path, so it still calls Market Data `ResolveFrames`, with evaluation `NotApplicable(NoRemainingPosition)` and no Mark required. ocr was asked whether that frames read can block a Closed Detail.

**Supporting changes.** `trade-summary.test.ts` and `tests/support/open-detail-fixtures.ts` gained the new required fields. `src/ui/` and `src/app/` are untouched, so this run is on the task tier.

**ocr review of `83e5f441`** (`evidence/D06/ocr/T6.14-83e5f441.json`; 3 files, 1 comment, plus one extra finding from the reviewer's own check):

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| high | `trade-views.ts:702-719` | Closed Detail resolves the current frames and builds the Open evaluation before taking the Closed branch. A Market Data result that is neither `Frames` nor a `SessionPolicyCoverage` rejection throws, and a saved Mark is copied into `current.mark`. | Valid. A92 says a Closed Trade "requires no Mark" and has no current figures. | Bug task T6.14-B1 |
| low | `trade-views.ts:451-455` | A stored-Closed Trade whose facts replay as Open or Planned takes the Closed form. `terminalTimeOf` throws when there is no terminal key. | Doubtful. This is the A96 disagreement in reverse, which reads should surface rather than throw on. | Bug task T6.14-B2 |

**Reviewer's answers to the three checks:**
- **Uncovered calendar date:** handled by the coverage fallback.
- **Missing Mark:** does not change the result.
- **Fee reconciliation:** exact in BigInt rationals for coherent facts.
  - **Disposal fees:** a Sell larger than the open quantity would leave fee unallocated. Not a finding: such facts are incoherent (`ExceedsOpenQuantity`, T6.2), are rejected by P22 at write, and are reported as incoherent rather than reconciled.
- **Closed list:** order and pages of 50 are correct.
- **`reflectionOwed`:** read in one Journal query per page.

### T6.14-B1 Closed Detail reads no Market Data and requires no Mark

Commit `e7b8494b`. Three red tests were added to `closed-views.test.ts`. None passed on first run.
1. **"should return the Closed Detail with its Closed fields when Market Data rejects the frames for a reason other than coverage"**
   - Red: `Error: Market Data returned Rejected for the current frames`.
2. **"should show no saved Mark, no Expected Mark Date, and no Market Data snapshot in the Closed Detail"**
   - Red: `expected { … } to not have property "mark"`.
3. **"should classify the Outstanding Debt of a Closed Trade when Market Data answers and leave it without a due status when it does not"**
   - Red: the same frames error as test 1.

**Fix.**
- **Branching.** A stored-Closed Trade branches to the Closed form before `currentFrames`.
- **What it no longer carries.** No Mark, Expected Mark Date, mark resolution, dated line, or `marketDataSnapshotId` binding.
- **Evaluation.** `evaluateCurrent` on a `{ date }` frame, dated at the Trade's terminal time, gives `NotApplicable(NoRemainingPosition)`. Its coverage reads `NotCovered`, which means nothing for a Closed Trade. T6.19 must render the Closed fields, not a valuation from `current`.
- **Type.** `ClosedTradeDetail.current` is the new exported `ClosedCurrentEvaluation`. It has `{ coverage, evaluation }`, and its Mark fields are typed `?: never`. It still extends `OpenTradeDetail`, because `TradeDetail.tsx` passes the Closed form to `OpenSections`.
- **Open path.** Refactored only: `openDetail` became `detailWithoutValuation`, and `withDueStatus` now takes `SessionCloses | undefined`.

**Recorded for the final report, not a deviation.**
- A Closed Detail whose narrative has an Outstanding Debt still asks Market Data, through `sessionCloses(symbol)`. It reads only the two session closes, for the Debt's due status (A86, decision 56, C5R2.1), and never the Mark.
- An answer other than `Frames` leaves the Debt with no due status.
- This meets the plan's "no Mark requirement" and A92. A95's "reading no Market Data" applies to the Closed list, which still reads none.

**ocr review of `e7b8494b`** (`evidence/D06/ocr/T6.14-B1-e7b8494b.json`; 2 files, 1 comment):

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium | `trade-views.ts:626` | `sessionCloses` does not catch a thrown `marketData.query`, so a Closed Trade with a Debt fails on an infrastructure fault. | Wrong as a defect. Every port read in `trade-views.ts` lets a thrown error propagate as an infrastructure fault: the Trade Analysis, Journal and Catalog reads, and Market Data on the Open path. None of them catches. The B1 defect was a *returned* rejection, which is now handled. Catching only this read would break that consistency. | Dismissed |

**The reviewer's answers:**
- **Open Detail:** unchanged by the refactor.
- **Closed Detail and the Mark:** a Closed Detail cannot show a Mark. It makes no Market Data query when the Trade has no Debt.
- **Closed `current`:** internally consistent.

**Minor observations, recorded only:**
- The Debt's due-status read is not part of the binding.
- The Closed evaluation's `valuationDate` is the UTC date slice of `terminalTime`, which can differ by a day from the exchange date for an after-hours exit. No figure depends on it. Noted for T6.19, which must not render it.

### T6.14-B2 A stored-Closed Trade whose facts replay as Open surfaces LifecycleDisagreement

Commit `35173c17`.

**Test.** "should return Ready with the LifecycleDisagreement and the integrity finding, without throwing, and leave the content revision unchanged".
- The fixture uses `tradeA()` with only its Buys, then `rawEditTrade` stores Closed with no terminal key.
- Red: `Error: Closed Trade id-0013 has no terminal time`.
- After the fixture changed, the subagent reverted the fix to confirm the test still fails.
- No first-run pass.

**Fix.** The Closed form now requires both a stored Closed lifecycle and an expected Closed lifecycle. A disagreeing Trade falls through to the Open form, which already carries `lifecycle.agreement` and `findings`.
- This follows the existing rule: Planned only when both are Planned, otherwise the Open form. The reverse case, stored Open with expected Closed, already took the Open form.

**List.** No change needed.
- A stored-Closed record with no `terminalDesc` is not in the sparse `byLifecycleTerminal` index, so the Closed list omits it without error.
- With the key present, the record is listed with `integrity: 'Disagrees'`.
- **Recorded for the final report:** a stored-Closed record with no terminal key appears in no list until a migration or Restore. This matches A96.

**ocr review of `35173c17`** (`evidence/D06/ocr/T6.14-B2-35173c17.json`): 1 file, 0 comments, no findings.

The reviewer's own reading:
- **Disagreement directions.** Stored Closed with expected Planned, and stored Open with expected Closed, both take the Open form. Neither is covered by a test.
- **Incoherent facts.** These return the incoherent form before the Closed branch is reached.
- **Closed list.** It can throw only for a record that has `terminalDesc` but no `terminalTime`. Only hand-tampered data can produce that, because the writer and `rebuild.ts` always set both together.

**Cumulative run `t6.14-trade-views`**, at HEAD `35173c17`, on 2026-11-01. Browser tier: task, because no path changed since `14a17f7a` is on the full-tier list.

| Stage | Result | Output |
|---|---|---|
| Unit | 91 files, 1131 tests passed | `suite-runs/t6.14-trade-views-unit.txt` |
| Node integration | 60 files, 117 tests passed | `suite-runs/t6.14-trade-views-integration.txt` |
| Browser (Chromium, `@every-task`) | 5 passed (12.2s) | `suite-runs/t6.14-trade-views-browser.txt` |
| Static and verification (12 commands) | 11 of 12 pass. `verify:capacity` fails as expected until T6.22 (schema version 4 basis, current is 5). | `suite-runs/t6.14-trade-views-checks.txt` |

No reruns were needed, and neither known flake failed.

## T6.15 Workspace: migration to schema 5

Base commit (for `browser-auto`): `35173c17`.

Commit `bcdbb0f1` (T6.15): one planned case, no first-run pass.

**Red.** Expected `{ kind: 'Opened', … }` to deeply equal `{ kind: 'Opened', … }`: the receipt carried Catalog manifest 1 with no additions, and Journal manifest 4.
- One green attempt failed because the test counted 7 `meta` records for v4 where the real count is 5. It was a test fixture error. No production change came from it.

**What the case checks.**
- v1, v2, v3 and v4 each migrate to Ready at schema 5.
- **The receipt** names from and to, per-store counts, and the additions:
  - Catalog `{ manifestVersion: 2, additions: [the four close-reason keys] }`.
  - Journal `{ manifestVersion: 5, … }`. From v4 its additions are exactly `['entry-type.close-review', 'source.trade-close']`.
- **The stored data** holds the four Close Reasons in seed order, the Close Review type with its revision-1 definition, and `source.trade-close`.
- **A second `initialize`** adds nothing and leaves the dump unchanged.

**What changed.**
- `migration.ts` and `workspace.ts` now seed and validate with `D6_CATALOG_MANIFEST` and `D5_JOURNAL_MANIFEST`.
- No type changed. The failure and Retry machinery (AC-REST-004) is unchanged except for the manifests it validates against.

**Pins updated.** Earlier deliverables' tests pinned the old manifest versions, type and definition counts, or addition lists. They were updated to the new manifests:
- `workspace.test.ts`
- `tests/integration/d1/initialize.test.ts`
- `tests/integration/d2/{migration,seed}.test.ts`
- `tests/integration/d4/{migration,seed}.test.ts`
- `tests/integration/d5/{migration,seed}.test.ts`

**Checks.** No `e2e` file pins a manifest. The unit suite passed (92 files, 1133 tests) and the integration suite passed (60 files, 117 tests).

**Receipt and definitions.** The receipt lists product keys only, so the Close Review definition, which has no product key, is not named in it. ocr was asked to check that against the plan's wording, "the Close Review type, definition, and Trade Close Source".

**Tier.** No `src/ui`, `src/app` or `src/persistence` path changed, so the run is on the task tier.

**ocr review of `bcdbb0f1`** (`evidence/D06/ocr/T6.15-bcdbb0f1.json`): 2 files, 0 comments, no findings.

**The reviewer's answers to the three checks:**
1. **Receipt and definitions.** The receipt follows D5's precedent. T5.12 (`b27f1e19`) named `entry-type.daily-trade-review` and `source.trade-detail` by product key and wrote the definition silently.
   - The plan's "type, definition, and Trade Close Source" is met by the type's key, plus the test's assertion that one revision-1 Close Review definition is stored.
2. **Failure path (AC-REST-004).** No defect.
   - Seeds are written to the candidate before validation, so sources from v1 to v4 validate against `D6_CATALOG_MANIFEST`.
   - The existing block, Retry and Activate-abort tests pass at schema 5.
3. **Second launch.** It adds nothing, whether the Workspace was migrated or fresh.

**Cumulative run `t6.15-migration-v5`**: HEAD `bcdbb0f1`, 2026-11-01. The browser stage ran on the task tier, because no path changed since `35173c17` is on the full-tier list.

| Stage | Result | Output |
|---|---|---|
| Unit | 91 files, 1132 tests passed | `suite-runs/t6.15-migration-v5-unit.txt` |
| Node integration | 60 files, 117 tests passed | `suite-runs/t6.15-migration-v5-integration.txt` |
| Browser (Chromium, `@every-task`) | 5 passed (10.0s) | `suite-runs/t6.15-migration-v5-browser.txt` |
| Static and verification (12) | 11 of 12 passed. `verify:capacity` failed, as expected until T6.22. `verify:fixtures` and `verify:releases` passed with the new manifests. | `suite-runs/t6.15-migration-v5-checks.txt` |

No reruns were needed.

## T6.16 Installed Capability Manifest and composition root for D6

Base commit (for `browser-auto`): `bcdbb0f1`.

Commit `859efda8` (T6.16). Output of `verify:capabilities`: `OK: 19 operations, 10 variant-qualified, 8 routes, 4 Entry Types, schema 5`. The operation count stays at 19 because D6 adds variants only, no new facade operation.

**Manifest.**
- `recordPositionChange`: adds `Reduce`, `Close`, `Sell`, `CloseReason`, `CloseReviewComplete`, `CloseReviewDecline` and `CloseReviewDefer`.
- `browseTrades` and `getTradeDetail`: add `Closed`.
- `ReferenceCatalog.query` and `resolve`: add `CloseReason`.
- `DailyReview.open`: adds `OwedReflectionGroup`.
- `DailyReview.getTrade`: adds `ReflectionsOwed`.
- `entryTypes`: adds `entry-type.close-review`.
- `DailyReview.getDebt` stays absent (P20).

The plan names no variant strings, so the subagent took them from the plan's wording.

**Not in the manifest, recorded for the final report.** No deviation: D5 followed the same precedent. Its T5.13 row named the Trade Detail Source and the Market Data frames, and neither is a manifest field.
- `queryRecords` is a Trade Record module operation, not a facade one.
- The Trade Close Source has no manifest field, because the manifest has no Sources list.

**Routes.** These make the new variants reachable.
- `trades`: `Closed`.
- `trade-detail`: `Closed`.
- `record-entry`: the seven `recordPositionChange` variants. It also now requires Catalog `query` and `resolve`.
- `review`: `OwedReflectionGroup` and `ReflectionsOwed`.

There is no new route. The exit form uses `record-entry`; if T6.17 gives it its own route, the variants must move there with it.

**Gap.** `verify:capabilities` checks variants only for operations whose route declares variants. Catalog `CloseReason` is therefore not machine-checked, so T6.17 must call `ReferenceCatalog.query({ family: 'CloseReason' })`.

**Facade and types.**
- `browseTrades` is generic over Planned, Open and Closed. There are no casts.
- `TradeLifecycle` includes Closed.
- `src/app/types.ts` re-exports `ClosedTradeItem`, `IncoherentClosedTradeItem`, `ClosedTradeDetail`, `ClosedCurrentEvaluation`, `LotMatchView`, `FeeReconciliation`, `CloseReasonLabel`, `TradeSummary`, `LotMatch`, `DispositionMechanism`, `TerminalDisposition` and `CloseReasonRecord`.

**Trade Summary (decision 48).** It went red, then green, in two cases:
- "should give a Closed item the entered quantity at its average entry price as its Trade Summary". Red: the item had no `summary`.
- "should give a Closed Detail the same Trade Summary, although it holds no Open Lot". Red: `expected undefined to deeply equal { kind: 'Stock', … }`.

`closedLongStockSummary` in `src/domain/trade-summary.ts` sums every Buy. For T-A that is 100 @ 50.18. `ClosedTradeItem.summary?` is absent on incoherent items. There was no first-run pass.

**Checks and tier.** typecheck, tsc6, lint and lint:deps pass. 664 unit tests pass in the affected folders, and integration passes at 117. `src/app/` changed, so the browser stage runs at full tier (P55).

**ocr review of `859efda8`** (`evidence/D06/ocr/T6.16-859efda8.json`): 7 files, 0 comments. There are no findings.

The reviewer also checked the following:
- **Manifest scope:** nothing beyond D6, and `getDebt` stays absent.
- **Trade Summary:** exact `Rational` arithmetic, with fees excluded as in `openLongStockSummary`.
- **Facade:** forwards everything with no loss.
- **Planned and Open:** unchanged.

**Note:** `OwedReflectionGroup`, like D5's `GapTrades`, is a manifest label with no code path of that name.

**Cumulative run `t6.16-manifest-composition`**, HEAD `859efda8`, 2026-11-01. The browser tier was **full**, set by the first full-tier path changed since `bcdbb0f1`, `src/app/compose.ts`.

| Stage | Result | Output |
|---|---|---|
| Unit | 91 files, 1134 tests passed | `suite-runs/t6.16-manifest-composition-unit.txt` |
| Node integration | 60 files, 117 tests passed | `suite-runs/t6.16-manifest-composition-integration.txt` |
| Browser (Chromium, full) | **1 failed**, 146 passed (6.6 min) | `suite-runs/t6.16-manifest-composition-browser.txt` |
| Static and verification (12) | 11 of 12. `verify:capacity` failed, as expected until T6.22. | `suite-runs/t6.16-manifest-composition-checks.txt` |

**Failure: B2.6**, `e2e/d2/migration.spec.ts:170`, "should complete the migration on relaunch without faults, with the pre-update data and no candidate database".
- **Where:** the assertion at line 210 fails.
- **Why:** the migrated Workspace now holds the four seeded Close Reasons. The test's `expected` adds only `closeReasonFacts: []` to each Trade.
- **Cause:** T6.15 made the migration to schema 5 seed the D6 Catalog manifest. T6.15's own run was task tier, which does not include B2.6, so this first showed in this full-tier run.
- **Classification:** deterministic, not a flake, so it was not rerun alone.
- **Outcome:** bug task **T6.15-B1**.

### T6.15-B1 B2.6 expects the Close Reasons the schema-5 migration seeds

Commit `1cc9ee0b` changes `e2e/d2/migration.spec.ts` only, which is test-only.

**Red, then green.** Before the change, `npx playwright test e2e/d2/migration.spec.ts` gave 1 failed and 3 passed. The diff was `Received + 48`, which is the four Close Reason records. After the change it gave 4 passed (16.5s).

**Fix.**
- **What the check compares.** `authoritative` compares only `catalog`, `trades` and `journalEntries`, which is why D5's Journal seeds never broke it.
- **New expectation.** It splits off the migrated `CloseReason` records and checks each one against `D6_CATALOG_MANIFEST.closeReasons`: product key, label, origin `Seeded`, policy, revision 1, `seedOrder` equal to the manifest index, and any id. It then compares the remaining records to the D1 data.
- **Migration output.** The four seeds, once each, with no extras.

**Other specs checked.** B2.5 migrates to schema 2. B2.3 and B2.4 compare only store and index shapes. The D4 and D5 update specs assert through the UI. None needed a change.

**ocr review of `1cc9ee0b`** (`evidence/D06/ocr/T6.15-B1-1cc9ee0b.json`; relocated, because the commit is test-only: the spec was moved to `src/itg/d06/` in a scratch clone): 1 file, 0 comments, no findings.

The reviewer's reading:
- **Catches a wrong migration:** a duplicate, a missing reason, a wrong `seedOrder`, an altered D1 record, or an extra record.
- **Manifest dependence:** the expected product keys and labels come from the same manifest the migration seeds from, so this test cannot catch an edit to the manifest itself. It does not need to: `close-reasons.test.ts` pins the literal keys and labels in seed order.
- **Gap (minor):** `expect.any(String)` does not require the ids to be unique. The old assertion did not check that either.

**Cumulative run `t6.15-b1-b26-seeds`** at HEAD `1cc9ee0b`, 2026-11-01. This run closes T6.16 and T6.15-B1.
- **Browser tier:** full. The first full-tier path changed since `bcdbb0f1` was `e2e/d2/migration.spec.ts`.
- **Ports:** 5175, 9341 and 9342 were free before and after the run.

| Stage | Result | Output |
|---|---|---|
| Unit | 91 files, 1134 tests passed | `suite-runs/t6.15-b1-b26-seeds-unit.txt` |
| Node integration | 60 files, 117 tests passed | `suite-runs/t6.15-b1-b26-seeds-integration.txt` |
| Browser (Chromium, full) | 147 passed in 6.5 min | `suite-runs/t6.15-b1-b26-seeds-browser.txt` |
| Static and verification (12) | 11 of 12 passed. `verify:capacity` failed, as expected until T6.22. | `suite-runs/t6.15-b1-b26-seeds-checks.txt` |

No reruns were needed.

## T6.17 UI: exit form

Base commit (for `browser-auto`): `1cc9ee0b`.

Commit `dd46c15c` (T6.17). The four planned cases ran red then green; the submission case was split into 3a and 3b. Three extra cases were added: position-path issues, which B6.4 needs; a hand-opened exit with no open Position; and a partial exit shown as Open.

**First-run pass, flagged for the user:** the partial-exit receipt case (case 7). The mutation check pinned the Result label to `'Realized P&L'`, and the case then failed with `received "Realized P&L": "+$55.90"`. The label was restored afterwards.

**Files.**
- New: `ClosingTheTrade.tsx`, `ExitReceipt.tsx`, `reflection-choice.tsx` (shared `ChoiceGroup`), `PositionChangeFormExit.test.tsx` and `tests/support/exit-result-fixtures.ts` (built with the real `derive`).
- Changed: `PositionChangeForm.tsx`, `position-change-issues.ts` and `tests/support/position-change-form-facade.ts`.

**Route.** No new route. The exit form opens at `/trades/:tradeId/record-entry?action=Sell`, with `EXIT_ACTION` exported. In exit mode it reads:
- Detail;
- both reflection definitions;
- `ReferenceCatalog.query({ family: 'CloseReason', pageSize: 500 })`.

**When "Closing the Trade" shows.** When the entered quantities exactly equal the open quantity, or after `CloseReasonRequired` or `CloseReviewDispositionRequired`.

**Judgement calls, recorded for the final report.**
- **Close Reason label.** The saved exit shows the Close Reason label by looking up `postCommit.trade.closeReason.closeReasonId` in the Close Reason rows the form already loaded. If the id is not found, it shows the id. Nothing is read again.
- **Placeholder copy.** Every string is placeholder copy except "Reflection on this exit", "Closing the Trade" and "Closed via sale of 100 shares". That covers the headings, the issue messages, the receipt labels, "Exit recorded", and "This Trade has no open Position to exit." The subagent's report lists them all.
- **Not rendered.** The receipt does not show the earlier-dated exit disclosure: `lotMatchChanges` and `realizedToDate` before and after (P23). The critic's C6.6 requires it ("The receipt lists the changed matches and realized P&L before and after"), and no UI case plans it. It goes to a bug task.

**Notes for T6.27.**
- `RecordEntryUnavailable` still says "Record entry isn't available" for a direct `?action=Sell` link.
- `IssueSummary` takes focus on rejection.
- The Reflect now, Reflect later and Decline labels appear twice on a closing exit, so tests need to scope them by group.

**Checks.** typecheck, tsc6, lint, lint:deps and `verify:capabilities` pass, and `src/ui` passes 435 tests. Because `src/ui` changed, the run is at the full tier.

**ocr review of `dd46c15c`** (`evidence/D06/ocr/T6.17-dd46c15c.json`): ocr reviewed 8 files and made 0 comments. The reviewer's own reading of the five checks found the following.

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| low | `PositionChangeForm.tsx:106,287,363-364` | After `CloseReasonRequired`, `closingRequired` stays set when the quantities no longer equal the open quantity. The section stays shown, and the next save sends the close fields on a non-terminal exit. | Doubtful. The behaviour is deliberate, and the workflow's `NotApplicable` answer hides the section again. The cost is one rejected save and a stale issue. | T6.17-B1 |
| low | `ClosingTheTrade.tsx:46-47`, `reflection-choice.tsx:33-35`, `PositionChangeForm.tsx:377-394` | The `closeReview` issue is not tied to its group by `aria-describedby`, and `corrected()` never clears it. | Valid, minor | T6.17-B1 |

**The reviewer's answers to the checks:**
- **Submission.** The close fields are sent only while the section is shown.
- **Close Reason label.** Looking it up in the loaded rows is acceptable: the workflow result carries only the id, and the other read models resolve labels the same way.
- **Entry mode.** No regression.
- **Headings.** In order.

**T6.17-B1** therefore also takes the known gap: the earlier-dated exit disclosure, which covers P23 and C6.6.

### T6.17-B1 Exit receipt discloses changed Lot Matches; Closing section follows the quantities; Close Review issue tied to its group

Commit `7882d60f`.

**1. Earlier-dated disclosure (P23, C6.6).**
- Red: "should disclose the Lot Matches an earlier-dated exit changed, with the realized P&L before and after". It failed because no `region` "Changed Lot Matches" existed.
- The new fixture `earlierDatedExitResult()` uses I6.8's 60-share case.
  - The Lot Matches and realized figures come from `derive`: +$55.90 before, +$131.85 after.
  - The `lotMatchChanges` are written by hand, because `lotMatchChangesOf` is internal.
- **Rule** (subagent's choice): disclose when some change is not a Created match of the saved change's own Sell. Then list every change, as I6.8 does, followed by "Realized to date before" and "Realized to date after".
- **First-run pass, flagged for the user.** The guard case "should not disclose changed Lot Matches for an exit that only created its own" passed first time.
  - Mutation check: inverting `ownExecutions.has`. It then failed with `expected <section …> to be null`.

**2. Stale Closing section.**
- Red: "should hide a section the workflow required once the quantities no longer total the open quantity, submit nothing for it, and keep its values". It failed with `expected <section …> to be null`.
- Fix: `closingRequired` became `closingRequiredAt: Rational | undefined`, the entered total at which the workflow required the section.
- The section now shows only at that total or at the open quantity. Its values stay in state.

**3. Close Review issue association.**
- Red: "should tie the Close Review issue to its group and clear it once the disposition changes". It failed on `aria-invalid`.
- Fix: `ChoiceGroup` takes an optional `describedBy`. `corrected()` clears the `closeReview` issue once the choice changes.
- Entry mode is unchanged, and the new test asserts that.

**New placeholder copy.**
- Heading "Changed Lot Matches", plus an intro sentence.
- Columns "Change", "Quantity before" and "Quantity after".
- Change kinds "Created", "Revised" and "Superseded".
- "Realized to date before" and "Realized to date after".

**Checks.** typecheck, tsc6, lint and lint:deps pass. `src/ui` has 439 tests passing.

**ocr review of `7882d60f`** (`evidence/D06/ocr/T6.17-B1-7882d60f.json`): 5 files, 0 comments, no findings.

The reviewer's reading:
- **The disclosure rule is sound.** `lotMatchChangesOf` keys matches by opening and disposing identity. As a result:
  - An earlier exit's change always shows as Revised, as Superseded, or as Created with a foreign disposing Execution.
  - A first exit and a plain later exit stay quiet.
  - The 60-share and 40-share cases of I6.8 both disclose.
- **`closingRequiredAt` compares with exact `Rational.equals`.** The section shows only at a total the workflow judged, or at the open quantity.
- **Entry mode is untouched.**

**Cumulative run `t6.17-exit-form`**, at HEAD `7882d60f`, on 2026-11-01. Browser tier: **full**. The first full-tier path that changed since `1cc9ee0b` is `src/ui/screens/ClosingTheTrade.tsx`.

| Stage | Result | Output |
|---|---|---|
| Unit | 92 files, 1146 tests passed | `suite-runs/t6.17-exit-form-unit.txt` |
| Node integration | 60 files, 117 tests passed | `suite-runs/t6.17-exit-form-integration.txt` |
| Browser (Chromium, full) | 147 passed (6.7 min) | `suite-runs/t6.17-exit-form-browser.txt` |
| Static and verification (12) | 11 of 12 passed. `verify:capacity` failed, as expected until T6.22. | `suite-runs/t6.17-exit-form-checks.txt` |

No reruns were needed. Ports 5175, 9341 and 9342 were free before and after the run.

## T6.18 UI: Closed tab and list

Base commit (for `browser-auto`): `7882d60f`.

Commit `585c4351` (T6.18). Files: `TradeList.tsx` and `TradeList.test.tsx`.

**Cases.**
1. **Tabs.** The existing test now expects Open, Planned and Closed, with tab stops `[0,-1,-1]` and arrow-key wrap.
   - Red: `expected ['Open','Planned'] to deeply equal ['Open','Planned','Closed']`.
2. **Closed list (A95).** Covers the four states and the rows.
   - Red: `expected 'Loading planned trades…' to match /loading closed trades/i`.
   - The first green run failed on the test's own hyphen. The formats use U+2212.
3. **Two extra cases.** These are not first-run passes.
   - **Cases:** an incoherent Closed row, and a Workspace zone the runtime does not know.
   - **What happened:** both passed on the first run because their code had been written ahead in case 2.
   - **How it was fixed:** the code was reverted, both cases were taken to genuine reds (`TypeError … 'compare'`, and `Temporal error: Time zone must be string…`), and the code was restored. The invalid red rows are noted in `tdd-log.md`.

**Columns.** No A95 field was dropped. The table follows revision 8's rule.
- **Wide:** Underlying, Trade, Realized P&L, Realized R, Disposition ("Closed via sale"), Close Reason, Close date, Account.
- **Trade cell:** the summary, plus badges for "Records disagree", "Reflection owed" and "N Deviation(s)". The Deviation badge shows only when the count is above 0. **Flagged for the user.**
- **Narrow:** a second line "Realized P&L … · Realized R …" replaces the two P&L columns.

**Close date.** Shown in the Workspace zone from `useRuntime().timeZone`, as `localTime(terminalTime, tz).slice(0,10)`.

**Paging.** Only the first page is rendered, because the Open and Planned lists have no paging UI and the subagent was told not to invent one. `nextCursor` is ignored, so Closed Trades past the 50th cannot be reached.
- A95 says "pages of 50", and `trade-views-and-reporting.md` has "bounded pagination". Read together, the trader must be able to reach later pages.
- This goes to a bug task, **flagged for the user**.

**Copy.** All strings are placeholders and are listed in the subagent report:
- "Loading closed trades…"
- the Error state, with Retry
- "No closed trades yet. A Trade appears here once its exit is recorded."
- the column headers and badges
- "Not available" and "Not recorded"

**Checks.** typecheck, tsc6, lint, lint:deps and `verify:capabilities` pass, and the `src/ui` suite passes 442 tests. `src/ui` changed, so the run is full tier.

**ocr review of `585c4351`** (`evidence/D06/ocr/T6.18-585c4351.json`): 1 file, 1 comment.

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium | `TradeList.tsx:292` | Closed Trades past the first 50 are unreachable because `nextCursor` is dropped. | Valid. It was already known (see the paging note above). | T6.18-B1 |

**The reviewer's own answers to the other checks:**
- **Close date:** correct across midnight and DST, through Temporal.
- **Sign and R text:** correct.
- **Narrow/wide duplication:** correct. One copy is in the accessibility tree at each width.
- **Tabs:** correct. Open and Planned are unchanged.

**Minor observations, recorded only:**
- The close date prints as ISO (`2026-11-01`), while other lists use `shortDate`.
- Disposition shows "Closed via sale" for any `Value` mechanism.

### T6.18-B1 Closed list reaches later pages of 50

Commit `60cc115f` (`TradeList.tsx`, `TradeList.test.tsx`). New describe "Closed list paging (T6.18-B1)" with four cases: append in order, `CursorExpired`, next-page failure, and a late page after a tab switch. Each failed first with `Unable to find … button "Show more closed trades"`, and none passed on its first run.

**Test fixes, noted in the log:**
- **Formatting:** a stray `prettier --write` was reverted, and the reds were rerun.
- **Fixture:** a missing fourth mock in the `CursorExpired` case.
- **Stale guard:** the case first passed even with the key check removed, because it asserted before React rendered. It now resolves the late page inside `act`. With the check removed it fails; with the check restored it passes.

**Behaviour:**
- **State:** `nextCursor` and `paging` (Loading, Failed, Refreshed, Appended) live in the Closed Ready state only.
- **Next page:** the button uses `aria-busy`/`aria-disabled` and ignores a second press. Rows already shown stay.
- **`CursorExpired`:** reloads page one and shows "The list was refreshed because your journal changed. Showing from the first page."
- **Failure:** the rows stay, "We couldn’t load more closed trades. Nothing was changed." appears beside Retry, and Retry resends the same cursor.
- **Stale guard:** a page applies only if the settled key is unchanged.
- **Focus:** stays on the button. After the last page it moves to the first new row's Underlying link.
- **Announcement:** a `role="status"` line reads "N more closed trades shown."

**Copy:** placeholders, as quoted above, plus "Show more closed trades" and "Loading more closed trades…". The `paging` class has no CSS rule yet.

**Checks:** typecheck, tsc6, lint and lint:deps pass. `src/ui`: 446 tests.

**ocr review of `60cc115f`** (`evidence/D06/ocr/T6.18-B1-60cc115f.json`): 1 file, 3 comments.

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium | `TradeList.tsx:331` | Focus recovery runs only for Appended results. A `CursorExpired` reload to a first page with no `nextCursor`, or an empty list, removes the focused button, and focus falls to the body. | Valid, narrow. | T6.18-B2 |
| medium | `TradeList.tsx:331` | On the final page, focus moves to the first new row even if the trader moved focus away while the request was pending. | Valid, minor. | T6.18-B2 |
| low | `TradeList.tsx:354-361` | Nested ternaries should become a helper. | Wrong as a defect. The user declined a `no-nested-ternary` rule (`plan/D05R-card-identity-handoff.md:72`); this is style only. | Dismissed |

**Reviewer's answers to the other checks:**
- **Ordering:** no duplicates or gaps.
- **Stale guard:** sound for a tab switch, a navigation, a full Retry and unmount.
- **`aria-disabled`:** enforced.
- **Status line:** announces once per change.
- **Open and Planned:** behaviour unchanged.

**Cumulative run `t6.18-closed-list`**, HEAD `60cc115f`, 2026-11-02. Browser tier: full (`src/ui/` changed since `7882d60f`).

The runner's final report never reached the main session, so these results were read from the output files.

| Stage | Result | Output |
|---|---|---|
| Unit | 92 files, 1153 tests passed | `suite-runs/t6.18-closed-list-unit.txt` |
| Node integration | 60 files, 117 tests passed | `suite-runs/t6.18-closed-list-integration.txt` |
| Browser (Chromium, full) | 147 passed (6.6 min) | `suite-runs/t6.18-closed-list-browser.txt` |
| Static and verification (12) | 11 of 12 passed. `verify:capacity` failed, as expected until T6.22. | `suite-runs/t6.18-closed-list-checks.txt` |

T6.18-B2 follows this run, and a further cumulative run follows B2.

### T6.18-B2 Closed paging keeps focus after a refresh and never steals it after a late page

Commit `cad1ed7c` (`TradeList.tsx`, `TradeList.test.tsx`). This is the second round of bug tasks on T6.18.

**Tests.** Three new cases. Each was red on its first run, so none is a first-run pass.
1. "should move focus to the refreshed status line when a cursor-expired reload leaves no Show more button, instead of dropping it to the page"
   - red: `expected <body>… to be <p role="status">`
2. "should move focus to the empty message when a cursor-expired reload finds no closed trades"
   - red: `expected <body>… to be <p>`
3. "should leave focus where the trader moved it when the final page arrives late"
   - red: focus was stolen onto `<a href="/trades/ccc">`

**Fix.** The focus effect returns early unless both of these hold: the button is gone, and `document.activeElement` is `body`. When it does act, it moves focus as follows:
- **Appended:** to the first new row.
- **Refreshed, no cursor:** to the paging status line (`tabIndex={-1}`, the `StorageProtectionCard` pattern).
- **Refreshed, empty list:** to the empty message (`tabIndex={-1}`).

**Limitation, recorded only.** A click on blank space also leaves focus on `body`, so the effect cannot tell that apart from a removed control.

**Checks.** typecheck, tsc6, lint and lint:deps pass. `src/ui` runs 449 tests.

**ocr review of `cad1ed7c`** (`evidence/D06/ocr/T6.18-B2-cad1ed7c.json`): 1 file, 1 comment.

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| medium | `TradeList.tsx:335` | `activeElement === body` does not show that the removed button had focus. A trader who clicks blank space while the page loads still has `body` focus, so the final page takes it. | Valid, narrow. B2 named this limitation. Tracking whether the button held focus when it was removed would close it. | T6.18-B3 (third round on T6.18) |

**The reviewer's own reading:**
- **Paths:** Appended, Refreshed, Failed then Retry, and a tab switch are otherwise sound. A tab switch unmounts the list and the key guard drops the late page.
- **Timing:** the effect runs after commit, with dependencies `[appendedFrom, refreshed, buttonGone]`, so an unrelated re-render does not trigger it.
- **Screen readers (minor, unverified):** focusing the status line may read it twice.
- **Pre-existing edge:** an empty final Appended page would leave focus on `body`. The read model does not return one.

**Cumulative run `t6.18-b2-paging-focus`**: HEAD `cad1ed7c`, 2026-11-02. The browser tier was full, because `src/ui/` changed since `7882d60f`.

| Stage | Result | Output |
|---|---|---|
| Unit | 92 files, 1156 tests passed | `suite-runs/t6.18-b2-paging-focus-unit.txt` |
| Node integration | 60 files, 117 tests passed | `suite-runs/t6.18-b2-paging-focus-integration.txt` |
| Browser (Chromium, full) | 147 passed (6.6 min) | `suite-runs/t6.18-b2-paging-focus-browser.txt` |
| Static and verification (12) | 11 of 12 passed. `verify:capacity` failed, as expected until T6.22. | `suite-runs/t6.18-b2-paging-focus-checks.txt` |

Ports 5175, 9341 and 9342 were free before and after the run.

### T6.18-B3 Closed paging moves focus only when the Show more button held it

Commit `9ce6b75d` (`TradeList.tsx`, `TradeList.test.tsx`). This is the third and final round of bug tasks on T6.18.

**Test.** Red: "should leave focus on the page when the trader clicked blank space while the final page loaded, since the Show more button no longer held it". It failed with `expected <a href="/trades/ccc"> to be <body>`. It was not a first-run pass.

**Existing test changed.** B1's append case now calls `button.focus()` before it clicks. It had passed only because focus sat on `body`, which is the behaviour this fix removes.

**Mechanism.**
- The `Appended` and `Refreshed` paging states carry `focused: boolean`.
- The settle path captures `moreButton.current === document.activeElement` once, before the state update that removes the button.
- The effect acts only when the button is gone and `focused` is true. The `body` check is removed.

**Browser note, recorded for the final report.** On Safari and macOS Firefox a mouse click does not focus a button, so focus stays where it was. Keyboard activation still moves focus to the new row.

**Checks.** `src/ui` passes 450 tests. typecheck, tsc6, lint and lint:deps all pass.

**ocr review of `9ce6b75d`** (`evidence/D06/ocr/T6.18-B3-9ce6b75d.json`): 1 file, 0 comments, no findings.

**The reviewer's answers:**
- `holdsFocus` is read once, after the last `await` and before `change(...)`, on both the Appended and Refreshed paths.
- `focused` does not carry over: each press resets `paging`, and Failed replaces it.
- Nothing outside `ClosedList` is affected.

**Dismissed (Wrong, cannot occur).** The reviewer noted, and rated Doubtful, a pre-existing edge: a final Appended page with zero rows would leave focus on `body`. That page cannot exist:
- **A cursor needs a further record.** The Closed query reads `pageSize + 1` and issues a `nextCursor` only when that extra record exists (T6.14's review).
- **A commit expires the cursor.** Cursors are bound to the snapshot (`trade-record.md`), so a commit between pages returns `CursorExpired` and the list reloads from the start.
- **Trades are never deleted.**

So a page fetched with a cursor always has rows. **T6.18 is closed after three rounds, with no finding left.**

**Cumulative run `t6.18-b3-focus-ownership`**, at HEAD `9ce6b75d`, on 2026-11-02. This run closes T6.18. The browser stage ran the full tier, 147 tests, because `src/ui/` changed since `7882d60f`. The runner's final report was not delivered, so these figures were read from the output files.

| Stage | Result | Output |
|---|---|---|
| Unit | 92 files, 1157 tests passed | `suite-runs/t6.18-b3-focus-ownership-unit.txt` |
| Node integration | 60 files, 117 tests passed | `suite-runs/t6.18-b3-focus-ownership-integration.txt` |
| Browser (Chromium, full) | 147 passed (6.7 min) | `suite-runs/t6.18-b3-focus-ownership-browser.txt` |
| Static and verification (12) | 11 of 12 passed; `verify:capacity` failed, as expected until T6.22 | `suite-runs/t6.18-b3-focus-ownership-checks.txt` |

After the run, nothing was listening on ports 5175, 9341 or 9342.

## T6.19 UI: Trade Detail closing additions

Base commit (for `browser-auto`): `9ce6b75d`.

Commit `c0e5b597` (T6.19).

**Cases.** Both cases went red and then green.
- **Closed Trade Detail.** Red: `Unable to find … region "Result"`.
- **Open after a partial exit.** Red: `Unable to find … region "Lot Matches"`. The Open additions had been written early. They were removed to get the red and then put back.

**Assertions that passed before their case, mutation-checked and flagged.**
- **Close Review in the narrative.** The existing `JournalSection` already rendered it. Omitting the section failed with `Unable to find … "Journal (1)"`.
- **Open "Realized to date".** D4's Valuation section already showed it. Renaming the term failed.

**What changed.**
- **New shared table.** `LotMatchesTable.tsx` is used by both `TradeDetail` and `ExitReceipt`. `figures.ts` gains `closedViaSale(mechanisms)`.
- **`EXIT_ACTION`.** It moved to `TradeDetail.tsx` to avoid an import cycle, and `PositionChangeForm` re-exports it.
- **Closed form.**
  - It adds a "Result" section (Realized P&L, Realized R, Terminal Disposition, Close Reason), "Lot Matches" with the rounding note, and "Fee reconciliation" (six terms from the read model, formatted with `money()` only).
  - It omits Valuation, the dated line, At entry, Risk and reward, the Open Lots, Record entry and Record exit. It never reads `current`.
- **Record exit.** A pill link to `/trades/:id/record-entry?action=Sell`. It appears only while Writable, on an Open form.

**Flagged for the user.**
- **Fee reconciliation on Open.** It also shows on an Open Detail that has Lot Matches. The plan lists it for Closed only.
- **Close Review debt label (gap).** A Close Review Debt on Detail is labelled by `OwedDebtItem` as "Reflection owed / Position Change at …", not as a Close Review.
- **Placeholders left untouched.** The T6.2 and T6.3-B2 placeholders stay as they were. `RecordEntryUnavailable` wording is left for T6.27.

**Copy.** All strings are placeholders except "Closed via sale of N shares". The subagent's report lists each one.

**Checks.** typecheck, tsc6, lint, lint:deps and `verify:capabilities` pass, and `src/ui` passes 452 tests. `src/ui` changed, so the run is full tier.

**ocr review of `c0e5b597`** (`evidence/D06/ocr/T6.19-c0e5b597.json`): 7 files, 0 ocr comments. The reviewer added one finding of their own after checking the code.

| Severity | Location | Claim | Assessment | Outcome |
|---|---|---|---|---|
| low | `OwedDebtItem.tsx:~104-110` | `OwedDebtItem` always shows "Reflection owed" and "Position Change at …". It ignores `NarrativeDebt.entryType` and `entryTypeKey`, so a Close Review Debt looks the same as a Position Change Reflection Debt. When both are deferred, the Closed Detail shows two identical items. | Valid. The label predates T6.19, but T6.19 is the first screen to render a Close Review Debt. | T6.19-B1 |
| (note) | `TradeDetail.tsx` Lot Matches | The rounding note is not tied to the table with `aria-describedby`. | Doubtful: a small gap, not against the plan. It is cheap to fix and on the critic's accessibility path. | T6.19-B1 |

**Reviewer's answers to the six checks:**
- **Closed form:** it never reads `current`.
- **Record exit:** visible only while Writable, on an Open form.
- **Record entry:** hidden on Closed.
- **Fees:** each comes from the read model through `money()`.
- **Headings and numerals:** both correct.
- **Regressions:** none unintended. The `ExitReceipt` Quantity and Realized headers are now right-aligned, which looks deliberate.

### T6.19-B1 Owed Debts name their Entry Type; Lot Matches table described by its rounding note

Commit `52b9e40e`, touching `OwedDebtItem.tsx`, `LotMatchesTable.tsx`, `TradeDetail.tsx` and `TradeDetail.test.tsx`.

**1. Owed items name their Entry Type.**
- Red test: "should tell a deferred Close Review from a deferred Position Change Reflection by naming each Entry Type on its owed item". It failed with `Unable to find … text: Position Change Reflection … '.badge'`.
- Fix: `OwedDebtItem` now renders `<Badge tone="neutral">{debt.entryType}</Badge>` before the owed or settled Badge, the same badge resolved items use. "Reflection owed" and "Position Change at …" are kept; no copy for them is fixed in the spec.
- Scope: `TradeDetail`'s `JournalSection` is the only caller, and the Review does not use this component. No caller tests changed.

**2. Rounding note.**
- Red test: "should describe the Lot Matches table by the note that amounts are rounded for display". It failed because no table had that accessible description.
- Fix: the note has `id="lot-matches-note"`, and `LotMatchesTable` takes an optional `describedBy` and renders it as `aria-describedby`.

**Result.** No first-run pass and no new copy strings. `src/ui`: 454 tests pass.

**ocr review of `52b9e40e`** (`evidence/D06/ocr/T6.19-B1-52b9e40e.json`): 3 files, 0 comments, no findings.

**The reviewer's own reading:**
- **Heading order.** The heading reads the Entry Type, then the owed or settled label. That matches the resolved-entry heading.
- **`entryType`.** It is a required string, and it falls back to the raw key.
- **`lot-matches-note`.** It is unique.
- **No regressions.** Open and Planned are unchanged.

**Minor observations, recorded only:**
- **Duplicate headings.** Two owed Position Change Reflections still share a heading name. This was already true before the change, and only the "Position Change at …" line tells them apart.
- **Shared heading id.** `ExitReceipt` and Trade Detail both use `id="lot-matches-heading"`, but the two are never mounted together.

**Cumulative run `t6.19-trade-detail`** at HEAD `52b9e40e`, on 2026-11-02. Browser tier: full. The first full-tier path that changed since `9ce6b75d` is `src/ui/figures.ts`.

| Stage | Result | Output |
|---|---|---|
| Unit | 92 files, 1161 tests passed | `suite-runs/t6.19-trade-detail-unit.txt` |
| Node integration | 60 files, 117 tests passed | `suite-runs/t6.19-trade-detail-integration.txt` |
| Browser (Chromium, full) | 147 passed (6.6 min) | `suite-runs/t6.19-trade-detail-browser.txt` |
| Static and verification (12) | 11 of 12 passed. `verify:capacity` failed, as expected until T6.22. | `suite-runs/t6.19-trade-detail-checks.txt` |

Ports 5175, 9341 and 9342 were free before and after the run.

## T6.20 UI: Review owed-reflection cards, Exit link

Base commit (for `browser-auto`): `52b9e40e`.
