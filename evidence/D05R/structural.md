# D5R structural verifications

Each entry records a structural task's exact verification (D5R breakdown, section 5), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`.

## Start of D5R

Location checks (D5R handoff, section 1) all matched on 2026-10-31: worktree and branch `claude-opus-5.5`, `ahead 11`, clean; `git log claude-opus-5.5-pre-d5r..HEAD` empty; tags `claude-opus-5.5-plan-r20`, `claude-opus-5.5-d5` and `claude-opus-5.5-pre-d5r` present; `claude-opus-5.5-d5` is `fbe3bb71dcc7114e7f0568272be48f0412cfeab8`; `DEV_PORT=5175`; Node v26.12.0. `npm ci` exit 0. `npx vitest run src`: `Test Files 69 passed (69)`, `Tests 893 passed (893)`. `npx vitest run tests/integration`: `Test Files 53 passed (53)`, `Tests 105 passed (105)`.

Spec reading: `plan/spec-reading/D05.md` in full, plus AC-MARK-004 (`specs/acceptance/acceptance-contract.md` lines 289–295, spec map S047), as the handoff directs. No other spec section has been needed yet.

## Setup: tdd.sh accepts T5R task IDs

Change in `.claude/scripts/tdd.sh`: the task-ID pattern is now `^T([0-9]+)(R?)\.` and the log path is `evidence/D%02d%s/tdd-log.md` from the number and the optional `R`, so `T5R.1` logs to `evidence/D05R/tdd-log.md` and every `T<n>.<m>` ID maps as before. The usage comment and the rejection message mention `T<n>R.<m>`. Each command was run from the repository root, while `evidence/D05R/tdd-log.md` did not exist, so nothing was appended anywhere.

1. `.claude/scripts/tdd.sh red T5R.1 x y`
   - Output: `no log at evidence/D05R/tdd-log.md: create it with its header note first`
   - Exit code: 2
2. `.claude/scripts/tdd.sh red T99.1 x y`
   - Output: `no log at evidence/D99/tdd-log.md: create it with its header note first`
   - Exit code: 2
3. `.claude/scripts/tdd.sh red T5X.1 x y` (malformed ID, still rejected)
   - Output: `task must look like T<n>.<m> or T<n>R.<m>, got: T5X.1`
   - Exit code: 2

### ocr review of `df352a7`

The first attempt (2026-10-31) did not run, because ocr's sign-in had expired (`ChatGPT OAuth request failed: status=400 code=invalid_grant`). After the user ran `ocr auth login`, the rerun reviewed `.claude/scripts/tdd.sh` and found nothing. Raw output: [ocr/setup-df352a7.json](ocr/setup-df352a7.json).

## T5R.1 Market Data: `prepareEffects` and `applyPreparedEffects`

Implementation commit `a101f74`. All 8 cases red then green in `src/modules/market-data/prepare.test.ts` (new); D4's 28 `market-data.test.ts` cases pass unchanged. `typecheck`, `tsc6 --noEmit`, `lint` and `lint:deps` exit 0.

- **First-run pass, flagged:** "should fail the commit of the caller … when one key's resolution revision moved after preparation" passed first, because the previous case had built the per-key check in apply. Mutation: the `tx.require(keyUnchanged(…))` in `applyPreparedEffects` became `void keyUnchanged(…)`; the case then failed with `expected { kind: 'Committed', … } to deeply equal { kind: 'Conflict', … }`.
- **Planned regression guard, flagged as the breakdown says:** the `save` case records the calls `save` makes to `prepareEffects` and `applyPreparedEffects`. It was red against the old `save` (`expected [] to deeply equal [ [ 'InitialManual' ], … ]`), and the bypass mutation (staging the checks and writes directly in `save`) turned it red again.

Implementation-level decisions:
- **Entry intention** is a discriminated object covering all four D4 intentions (`RecordInitialManualMark`, `CorrectMark`, `AssertUnavailable`, `WithdrawAcknowledgment`), so `save` has one path and keeps its command and result types. `OverrideManualValuation` still returns `VariantNotInstalled` before prepare.
- **`save`'s mapping of the prepare result:** `Rejected` becomes `Rejected`. A `MarkExists` conflict becomes `Rejected [{ field: 'key', code: 'MarkExists' }]`, as D4 returned it. Other conflicts become D4's `Conflict`. An initial Mark over an existing exact Mark is a `StaleRevision` conflict, as in D4.
- **`NothingToCorrect`, `CorrectionUnchanged` and `NothingToWithdraw`** are `prepareEffects` issues with an entry index, checked after the conflict check, so a conflict wins, as in D4.
- **Request count for T5R.13:** an `AssertUnavailable` or `WithdrawAcknowledgment` entry adds one reverse-cursor read for its Stale context, inside the same read-only snapshot. This is because the spec's `AcknowledgedUnavailable` resolution carries optional Stale context, and D4's save result returns it. A Marks-only `SaveReviewMarks` therefore issues exactly n record reads, as T5R.13 states. T5R.13 will measure the Marks-only command against that wording and disclose the extra read per acknowledgment entry. This adds a request only when a trader acknowledges a missing price. It does not change the bound, which still depends on entry count, not history.

### ocr review of `a101f74`

Run after the user's `ocr auth login`. It reviewed `market-data.ts` and `index.ts` and made three comments. Raw output: [ocr/T5R.1-a101f74.json](ocr/T5R.1-a101f74.json).

| # | Claim | Verdict | Outcome |
|---|---|---|---|
| 1 | An acknowledgment's Stale context ignores a Mark prepared earlier in the same batch for the same instrument, so the prepared resolution differs from what `query` reports after commit (A154). | Valid | Bug task T5R.1-B1, `733332e`. ocr review of `733332e`: no findings ([ocr/T5R.1-B1-733332e.json](ocr/T5R.1-B1-733332e.json)). |
| 2 | An empty `entries` array returns `Prepared` and commits nothing, although A154 says 1–100 entries. | Valid, low impact | **Dismissed by the user's decision (2026-10-31): a caller precondition.** A154 has no code for an empty batch, and an empty batch stages and writes nothing. `SaveReviewMarks` is sent only when the card has drafts. No code change. |
| 3 | A nested ternary combines the rule checks, so their order is hard to check. | Valid (readability) | Bug task T5R.1-B3, `9e462e4`. ocr review of `9e462e4`: no findings ([ocr/T5R.1-B3-9e462e4.json](ocr/T5R.1-B3-9e462e4.json)). |

The bug tasks left no ocr findings after one round.

## T5R.1-B1 Stale context from the same batch

Case: "should disclose a Mark prepared earlier in the same batch as the Stale context of a later acknowledgment for the same instrument" (one batch: initial Manual Mark for XYZ on 2026-10-09, `AssertUnavailable` for XYZ on 2026-10-12; after commit, `query` must report the prepared resolution). Red: `AssertionError: expected { …(2) } to match object { …(2) }` (the prepared resolution had no `stale`).

Fix: `prepareEffects` now overlays the batch's own prepared Marks (initial or correction) for the same instrument on earlier trading dates onto the stored Stale context of each acknowledgment entry, using the same latest-earlier-Mark rule as `staleContextOf` (a batch Mark on the stored context's date replaces it, so a `CorrectMark` price wins). No new request is made: the one read-only snapshot is unchanged.

## T5R.1-B3 Entry rejection rules without a nested ternary

Change: the `rejections` block of `prepareEffects` now calls a named `rejectionOf(intention, record)` that uses plain `if` statements in the same order and with the same codes (`NothingToCorrect`, `CorrectionUnchanged`, `NothingToWithdraw`); no behaviour change, no new test.

- `npx vitest run src/modules/market-data src/coordinators`: exit 0, 259 passed
- `npm run typecheck`: exit 0
- `npx tsc6 --noEmit`: exit 0
- `npm run lint`: exit 0
- `npm run lint:deps`: exit 0

## Cumulative suite after T5R.1

At `9e462e4` (T5R.1 with B1 and B3), 2026-10-31, by `suite-runner`, label `t5r.1-market-data-prepare`. All passed.

| Suite | Result | Output |
|---|---|---|
| Unit, `npx vitest run src` | 70 files, 902 tests passed; exit 0 | [unit](suite-runs/t5r.1-market-data-prepare-unit.txt) |
| Node integration, `npx vitest run tests/integration` | 53 files, 105 tests passed; exit 0 | [integration](suite-runs/t5r.1-market-data-prepare-integration.txt) |
| Browser (Chromium), `npm run test:e2e` | 155 passed (5.5 min); exit 0 | [browser](suite-runs/t5r.1-market-data-prepare-browser.txt) |
| Static and verify checks: `typecheck`, `tsc6 --noEmit`, `lint`, `lint:deps`, `build`, `verify:release`, `verify:capabilities`, `verify:releases`, `verify:no-fault-hooks`, `verify:capacity`, `verify:fixtures`, `verify:session-policy` | 12 of 12 exit 0 | [checks](suite-runs/t5r.1-market-data-prepare-checks.txt) |

The D4 and D5 browser cases have not moved onto cards yet (section 6.3 of the breakdown): that move comes with the UI tasks, so this run is the unchanged D5 browser suite.

## T5R.2 Trade Analysis: Reward : risk now

Commit: `cfc1bad`.

Cases (all red then green in `tdd-log.md`; no first-run passes):
- T-A 8/9 at XYZ 52.00 and T-E 9/2 at JKL 21.00, as exact Values.
- T-B (ABC 27.50, past its Stop): `NotApplicable` with reason `NoOngoingRisk`.
- T-C (DEF, Mark Missing on 2026-10-12): `Unavailable` `MarkMissing` naming DEF and 2026-10-12.

Flags: none. `ongoingRiskToStop` and `incrementalRewardToTarget` carry no fees, so T-A is exactly 8/9 and T-E exactly 9/2. T-B's Ongoing Risk to Stop past its Stop is exactly 0 (clamped by `atLeastZero`), not negative, and its reward is 850.

Decisions:
- Field: `TradeEvaluation.rewardRiskNow: CalculationResult<Rational>`. A non-Value input is returned as it is (risk first, then reward), so reasons such as `MarkMissing`, `AwaitingClose` and `NoRemainingPosition` carry through unchanged. Risk of zero gives `{ kind: 'NotApplicable', reason: 'NoOngoingRisk' }`.
- Fixture route: derived states built in `evaluate.test.ts` in the style of `reference-trade.ts` (`cardTrade`, T-A, T-B, T-C, T-E with the card fixture's plans, fills and Marks; T-A's PC1 on Friday 2026-10-09 10:00), so the tests need no stack. The shared `cardFixture` is left to T5R.3.
- No change to Daily Review or anywhere outside `src/domain/trade-analysis/evaluate.ts` and its test.

Checks: `npx vitest run src/domain src/coordinators` (306 passed), `typecheck`, `tsc6 --noEmit`, `lint`, `lint:deps` all exit 0.

Evidence notes (main session):
- The red row for "should return NotApplicable when Ongoing Risk to Stop is zero" has no failure excerpt. According to the task agent, it failed on the division by zero, because the zero branch did not exist yet. That is a genuine red for the planned behaviour, but the excerpt was not captured.
- The first green of case 1 briefly held the zero and pass-through branches ahead of their cases. They were cut back before cases 2 and 3 ran, so both had reds from absent behaviour (refactor row in `tdd-log.md`).

### ocr review of `cfc1bad`

It reviewed `evaluate.ts` and found nothing. ocr warned that the background note (2,515 characters) was over its recommended 2,000. Raw output: [ocr/T5R.2-cfc1bad.json](ocr/T5R.2-cfc1bad.json).

### Cumulative suite after T5R.2

At `cfc1bad`, 2026-10-31, by `suite-runner`, label `t5r.2-reward-risk-now`. All passed.

| Suite | Result | Output |
|---|---|---|
| Unit | 70 files, 905 tests passed; exit 0 | [unit](suite-runs/t5r.2-reward-risk-now-unit.txt) |
| Node integration | 53 files, 105 tests passed; exit 0 | [integration](suite-runs/t5r.2-reward-risk-now-integration.txt) |
| Browser (Chromium) | 155 passed (5.4 min); exit 0 | [browser](suite-runs/t5r.2-reward-risk-now-browser.txt) |
| Static and verify checks (the same 12 as after T5R.1) | 12 of 12 exit 0 | [checks](suite-runs/t5r.2-reward-risk-now-checks.txt) |

## T5R.3 Daily Review: range positions and gap Trades

Commit: see the task's commit on branch `claude-opus-5.5` (message `feat(daily-review): T5R.3 range positions and gap Trades in open`).

**Cases (3 of the 4 planned, plus 1 added).**
- Range position per walked Trade: T-A 9/17 and 134/425, T-E 2/11 and 1/11, T-F 4/7 and 2/7; walk order T-B, T-C, T-F, T-A, T-E confirmed.
- T-B: now 0 with the StopBreached reason, `pinned: 'Stop'`, at entry 1/4; T-C `NotPlaced` `MissingInput` DEF 2026-10-12. The T-C half was a first-run pass (flagged in `tdd-log.md` with its mutation).
- Added: share 1 pinned at the Target when the Mark is past the Target (the pin rule names it; no planned case did).
- Gap Trades: XYZ's group lists `[T-F from 2026-10-12, T-A from 2026-10-09]`, in the walk's order (T-F ranks before T-A).
- **Dropped:** the Worst-Case case. In `evaluate`, Ongoing Risk to Stop and Worst-Case Ongoing Risk are both `marked(...)`, so they are Unavailable together; no Long Stock Trade has the first not a Value and the second a Value, and `pressureOf` never reads Worst-Case. Basis selection is proven by the existing pressure tests in `daily-review.test.ts`: "should give T-A pressure 91/291 and T-E pressure 1/10 as winning shares...", "should give equal pressure 3/4 to a Trade marked 48.50 and one marked 53.00...", "should place T-E in quantified pressure, and a Trade marked at its average open cost in routine with pressure 0", and the "pressure that cannot be compared" cases.
- D4's risk past the Stop is exactly 0 (as T5R.2 found); the share code treats risk at or below 0 as pinned at 0 and reward at or below 0 as 1.

**Fixture.** `cardFixture(stack, { withoutMarks? })` in `tests/support/review-fixture.ts`, built through the real module APIs; returns `{ a, b, c, e, f }`. T-A is planned Friday 09:00 (its PC1 is Friday 10:00 at 60 @ 50.10, so the plan precedes it), both its Position Changes are recorded with Defer, T-F is XYZ 50 shares (plan 50.00 / 48.00 / 55.00, filled 50 @ 50.00 at Monday 10:30). Monday Marks XYZ 52.00, ABC 27.50, JKL 21.00 unless `withoutMarks`; DEF never has one. `FRIDAY_DATE` is exported.

**Names.** `RangePosition` (in `types.ts`, exported through the module): `{ kind: 'Placed'; now; atEntry; pinned?: 'Stop' | 'Target' }` or `{ kind: 'NotPlaced'; reason: 'MissingInput'; instrumentKey; date }`, `{ reason: 'AwaitingClose'; after }`, `{ reason: 'FactsIncoherent' }`. `ReviewTradeItem.rangePosition` (so walked Trades, `getTrade`'s `attention`, and the post-save assembly all carry it). `HistoricalGapGroup.trades: readonly { tradeId; from }[]`, in the walk's order. `attention.ts`: `pressureOf` now takes the shared `riskRewardOf` figures.

**Flags.** (1) `from` is the exchange (New York) date of the Trade's first exposure to the Instrument, not the first session whose close is at or after it: Daily Review does not see the session policy (D4 A39), so an exposure after a session's close keeps that date. T5R.5 or a later task can tighten it if needed. (2) The post-save assembly (`withGaps = false`) carries range positions but empty gap groups, as before. (3) No request was added: `open` reads the same data; `tests/integration` (53 files, 105 tests) passes. (4) UI and `attention.test.ts` test builders gained `rangePosition` and `trades: []` so they type-check.

**Checks (each alone).** `npx vitest run src/coordinators src/domain` exit 0 (310 tests); `npx vitest run tests/integration` exit 0; `npm run typecheck` 0; `npx tsc6 --noEmit` 0; `npm run lint` 0; `npm run lint:deps` 0; `npx vitest run src/ui` 0.

**Main-session review of flag (1).** The calendar-date `from` is wrong for an exposure after a session's close (a Friday 17:00 fill would count from Friday, not Monday), and it hard-codes the exchange time zone in Daily Review, against D4 A39. The user approved decision 62 (plan revision 21, `1085746`, tagged `claude-opus-5.5-plan-r21`): Market Data's computed `HistoricalGaps` returns each listed session's close, and Daily Review compares it with each Trade's earliest exposure. Bug task T5R.3-B1.

Commit: `d72476f`.

### ocr review of `d72476f`

It reviewed `attention.ts`, `daily-review.ts`, `types.ts` and `tests/support/review-fixture.ts`, and found nothing. Raw output: [ocr/T5R.3-d72476f.json](ocr/T5R.3-d72476f.json).

### Cumulative suite at `d72476f`

2026-10-31, by `suite-runner`, label `t5r.3-range-positions`. All passed.

| Suite | Result | Output |
|---|---|---|
| Unit | 70 files, 909 tests passed; exit 0 | [unit](suite-runs/t5r.3-range-positions-unit.txt) |
| Node integration | 53 files, 105 tests passed; exit 0 | [integration](suite-runs/t5r.3-range-positions-integration.txt) |
| Browser (Chromium) | 155 passed (5.6 min); exit 0 | [browser](suite-runs/t5r.3-range-positions-browser.txt) |
| Static and verify checks (the same 12) | 12 of 12 exit 0 | [checks](suite-runs/t5r.3-range-positions-checks.txt) |

## T5R.3-B1 Gap Trades from session closes (decision 62)

Defect (T5R.3 flag 1): a gap group's `trades[].from` was the New York calendar date of the Trade's earliest exposure, by a hard-coded `America/New_York` in Daily Review (against D4 A39). A Trade filled Friday 17:00 was listed from Friday, so Friday's gap showed on its card.

Cases (commands logged in `tdd-log.md` under T5R.3-B1):
1. Market Data `recover` test "should return the session close of each listed historical gap date". Red: `AssertionError: expected undefined to deeply equal { …(2) }` (`closes` absent). Green after the fix.
2. Daily Review "should list a Trade filled after a session close from the next session, so that session gap is not on its card". Setup chosen: Monday Review, so Friday 2026-10-09 is the only listed date, and a second XYZ Trade filled Friday 21:00Z (17:00 New York, after the 20:00Z close) has no relevant listed date and must be absent. A "from 2026-10-12" setup would need a Tuesday Review with a Monday gap, so the absent case was taken as the unambiguous one. Red (assertion, against the old code): `AssertionError: expected [ 'id-0008', 'id-0049', 'id-0058' ] to deeply equal [ 'id-0008', 'id-0049' ]` (the new Trade listed). Green after the fix.

Fix:
- `HistoricalGaps.closes: Readonly<Record<string, string>>` in `src/modules/market-data/market-data.ts`: the session close (instant string) of each listed date, Missing or acknowledged, filled from the `relevant` sessions the scan already has. No new request, nothing stored.
- Daily Review: `exchangeDateOf` and its hard-coded zone removed (the `Temporal` import stays; it is used for Debt comparison). New `firstRelevantGapDate(closes, exposure)` returns the first listed date (sorted) whose close is at or after the Trade's `earliestRelevance`; a Trade with none is left out of the group.
- Choice: `HistoricalGapGroup` does not pass `closes` through. `assemble` now names the five fields instead of spreading `g`; the group's shape is unchanged.

Deviation flagged: the existing T5R.3 gap case expected T-F from 2026-10-12, but in a Monday Review the only listed date is Friday, and T-F's first fill (Monday 10:30) is after Friday's close, so under decision 62 T-F has no relevant listed date and is left out. That case's name and assertion were changed to T-A only (from 2026-10-09). The brief said it must stay green; it cannot, since decision 62 contradicts it.

Checks (each alone, exit 0): `npx vitest run src/modules/market-data src/coordinators src/domain` (392 passed), `src/ui` (327), `tests/integration` (105), `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`.

The flagged deviation conflicts with T5R.3's planned case and is put to the user (see the handoff's open questions). Commit: `fd1415d`.

### ocr review of `fd1415d`

It reviewed `daily-review.ts` and `market-data.ts` and found nothing. Raw output: [ocr/T5R.3-B1-fd1415d.json](ocr/T5R.3-B1-fd1415d.json).

### Cumulative suite at `fd1415d`

2026-10-31, at `589b1ed` (with the B1 fix `fd1415d`), by `suite-runner`, label `t5r.3-b1-gap-closes`. All passed.

| Suite | Result | Output |
|---|---|---|
| Unit | 70 files, 911 tests passed; exit 0 | [unit](suite-runs/t5r.3-b1-gap-closes-unit.txt) |
| Node integration | 53 files, 105 tests passed; exit 0 | [integration](suite-runs/t5r.3-b1-gap-closes-integration.txt) |
| Browser (Chromium) | 155 passed (5.7 min); exit 0 | [browser](suite-runs/t5r.3-b1-gap-closes-browser.txt) |
| Static and verify checks (the same 12) | 12 of 12 exit 0 | [checks](suite-runs/t5r.3-b1-gap-closes-checks.txt) |

## T5R.3-B2 Every holding Trade listed, from the Review date when no gap applies (decision 63)

Defect: under decision 62 a Trade with no listed date at or after its earliest exposure was left out of the gap group, so a holder of the Instrument had no gap listing at all. Decision 63 lists every eligible holding Trade; `from` is the first listed date whose close is at or after the exposure, else the Review date.

Cases (commands logged in `tdd-log.md` under T5R.3-B2):
1. T5R.3's planned case, restored to its planned name and assertion (as at `d72476f`): "should list with XYZ gap group each eligible Trade that holds XYZ and the first session it is relevant from: T-A from Friday 2026-10-09, T-F from Monday 2026-10-12, so Friday gap belongs to T-A card only", expecting `[{ f, '2026-10-12' }, { a, '2026-10-09' }]`. Red (assertion): `AssertionError: expected [ { tradeId: 'id-0008', …(1) } ] to deeply equal [ { tradeId: 'id-0049', …(1) }, …(1) ]` (T-F absent). Green after the fix.
2. B1's case "should list a Trade filled after a session close from the next session, so that session gap is not on its card", now expecting the Friday 21:00Z Trade listed with `from: '2026-10-12'` (the Review date) and T-A still from 2026-10-09. Red (assertion): `AssertionError: expected undefined to deeply equal { tradeId: 'id-0058', …(1) }` (Trade absent). Green after the fix.

Fix: in `assemble` (`src/coordinators/daily-review/daily-review.ts`) the gap group's `trades` use `.map` with `firstRelevantGapDate(g.closes, r.earliestRelevance) ?? reviewDate` instead of dropping a Trade with no date. Nothing in Market Data, storage or schema changed.

Checks (each alone, exit 0): `npx vitest run src/modules/market-data src/coordinators src/domain` (392 passed), `src/ui` (327), `tests/integration` (105), `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`.

Commit: `2a683c7`. With it, T5R.3's planned gap case stands as written (decision 63, plan revision 22, `df6b1c5`, tagged `claude-opus-5.5-plan-r22`).

### ocr review of `2a683c7`

It reviewed `daily-review.ts` and found nothing. Raw output: [ocr/T5R.3-B2-2a683c7.json](ocr/T5R.3-B2-2a683c7.json).

### Cumulative suite at `2a683c7` (T5R.3 closed)

2026-10-31, by `suite-runner`, label `t5r.3-b2-gap-trades`. All passed.

| Suite | Result | Output |
|---|---|---|
| Unit | 70 files, 911 tests passed; exit 0 | [unit](suite-runs/t5r.3-b2-gap-trades-unit.txt) |
| Node integration | 53 files, 105 tests passed; exit 0 | [integration](suite-runs/t5r.3-b2-gap-trades-integration.txt) |
| Browser (Chromium) | 155 passed (5.5 min); exit 0 | [browser](suite-runs/t5r.3-b2-gap-trades-browser.txt) |
| Static and verify checks (the same 12) | 12 of 12 exit 0 | [checks](suite-runs/t5r.3-b2-gap-trades-checks.txt) |

The bug tasks of T5R.3 (B1 by the main session's review, B2 by the user's decision 63) left no ocr findings.

## T5R.4 Daily Review: Plan baseline in getTrade

Case (P40, A158), test `describe("Plan baseline (P40)")` in `src/coordinators/daily-review/daily-review.test.ts`: T-A at Monday 17:00 with Monday Marks returns 1R $250.00, original planned reward $600.00, planned Reward : risk 12/5, and Reward : risk now 8/9. All four figures came out exactly as planned.

Flag, first-run pass: the case passed on its first run. T5R.2 built the behavior and `getTrade` already returns `trade.evaluation` (a `TradeEvaluation`). Mutation: `getTrade` set `evaluation: undefined`; the case failed with `AssertionError: expected undefined to deeply equal { kind: "Value", ... }`; restored (`git diff -- src` empty). Logged as a note row in `tdd-log.md`. The first logged green row for this task ran no test (parentheses broke -t filtering); the real green is the following row.

Shape (no production change): `GetDailyTradeReviewResult` Ready `trade.evaluation.planBaseline: CalculationResult<PlanBaseline>` (`oneR`, `originalPlannedRisk`, `originalPlannedReward`, `rewardRiskRatio`, bases), plus `evaluation.oneR` and `evaluation.rewardRiskNow`. T5R.11 reads planned from `planBaseline.value.rewardRiskRatio`.

Checks (each alone, exit 0): vitest src/coordinators src/domain src/modules (512 passed), src/ui, tests/integration, typecheck, tsc6, lint, lint:deps.

Commit: `c9d7ec9` (test only).

Process note (main session): the task agent appended the first-run note row to `tdd-log.md` with a here-doc, which the working rules forbid (Edit tool only). The row's content is correct and was left as it is.

### ocr review of `c9d7ec9`

The commit is test-only, so the case was recreated in a scratch clone (at `c9d7ec9^`) as `src/itg/d5r/plan-baseline.ts`, with the "Plan baseline (P40)" block verbatim and its two local helpers (`open`, `ready`) and imports added, and ocr was run on that clone commit. No findings. The clone was deleted. Raw output: [ocr/T5R.4-c9d7ec9.json](ocr/T5R.4-c9d7ec9.json).

### Cumulative suite after T5R.4

At `c9d7ec9`, 2026-10-31, by `suite-runner`, label `t5r.4-plan-baseline`. A first run was cut off when the Claude Code process exited, and this rerun overwrote its partial outputs. All passed.

| Suite | Result | Output |
|---|---|---|
| Unit | 70 files, 912 tests passed; exit 0 | [unit](suite-runs/t5r.4-plan-baseline-unit.txt) |
| Node integration | 53 files, 105 tests passed; exit 0 | [integration](suite-runs/t5r.4-plan-baseline-integration.txt) |
| Browser (Chromium) | 155 passed (5.7 min); exit 0 | [browser](suite-runs/t5r.4-plan-baseline-browser.txt) |
| Static and verify checks (the same 12) | 12 of 12 exit 0 | [checks](suite-runs/t5r.4-plan-baseline-checks.txt) |

Note on this run (added after the fact): two orchestrating sessions ran D5R in this worktree at once from 10:53 to about 11:03. One recorded this run. The other dispatched T5R.5 at about 10:58, before this run was recorded. The unit, integration and browser suites ran on the tree at `c9d7ec9`. The checks finished at 11:00:12, while T5R.5's uncommitted edits were in the tree (committed as `f53ccb4` at 11:01), so they prove T5R.4's code only together with those edits. T5R.4 is test-only, and T5R.5's cumulative run covers the 12 checks again. The user chose one session to continue, and the other stood down. Commit `55b4d9a` also swept in T5R.5's in-progress tdd-log rows.

## T5R.5 Daily Review: `save` (`SaveReviewMarks`)

Commit `f53ccb4`: `daily-review.ts`, `types.ts`, and the new `save-marks.test.ts`. Its tdd-log rows were committed in `55b4d9a` (see the note above). Six cases, each with red and green rows or a flagged first-run note:
1. XYZ saved for Monday and Friday from T-A's card in one commit, resolutions equal to the stored records. Red: `expected MarksSaved, got Rejected`.
2. The revised completion, progress and binding, T-A's card (range position 9/17, Reward : risk now 8/9) and T-F's item (4/7) in the same result. Red: `expected a Ready review, got ChangedDuringAssembly`.
3. Next step T-C for DEF. Red: `expected 'id-0008' to be 'id-0031'`.
4. Rejected and Conflict passed back unchanged, nothing written. **First-run pass**, built by case 1. Mutation: Conflict returned with `keys: []`. Failure: `AssertionError: expected { kind: 'Conflict', keys: [] } to deeply equal …`.
5. Saved Marks reported with the Review part as `ChangedDuringAssembly`. **First-run pass**, built by case 2. Mutation: report only the first saved Mark. Failure: `expected … to have a length of 2 but got 1`.
6. Write gate. **First-run pass**, built by the existing `guard.run('DailyReview.save', …)`. Mutation: bypass the guard for `SaveReviewMarks`. Failure: `expected { kind: 'MarksSaved', … } to deeply equal ObjectContaining{…}`.

Refactor: `readAfterSave` was extracted (the Review-date-only coherent assembly, which now also returns the walked Trades). `postSaveReview` and the new `postMarksReview` use it. Checks (each alone, exit 0): typecheck, `tsc6`, lint, `lint:deps`; the 87 `src/coordinators/daily-review` tests pass.

Public types: `SaveReviewMarksRequest` `{ kind, reviewDate, tradeId, binding, entries: MarketDataPrepareEntry[] }`; `SavedMark` `{ key, resolution, resolutionRevision, classification }`; `MarksNextStep` (`Mark` with `row` and `trade`, the first walked card in attention order holding the row's Instrument; `Trade`; `Done`), kept separate from `ReviewNextStep` so the Action save's results are unchanged; `PostMarksReview` (`Ready` with progress, completion, binding, `trades: WalkedTrade[]`, `trade`, `nextStep`; or `ChangedDuringAssembly`); `SaveDailyReviewResult` gains `MarksSaved`, `Conflict.keys?` and `MarketDataPrepareIssue` in `Rejected`.

Agent's notes:
- **The commit-level write gate isn't covered by T5R.5's test.** The guard stops the save before the commit. With the guard bypassed and the coordinator's post-commit `RuntimeNotWritable` line also removed, that unit setup committed and returned `MarksSaved`. The line was kept. Persistence's own gate for this path is for I5R.6 (T5R.14) to prove through the facade; that brief names this.
- **A commit Conflict reruns `prepareEffects` to name the moved keys.** If the rerun returns Prepared, the result is `Conflict` with `keys: []`. A Conflict is never retried.

### ocr review of `f53ccb4`

Two files reviewed (test file excluded), two findings. Raw output: [ocr/T5R.5-f53ccb4.json](ocr/T5R.5-f53ccb4.json).

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| high | `daily-review.ts:658` | `saveReviewMarks` never checks `request.binding`, including its Workspace `databaseName`, so a request left over from another Workspace could write Marks into the active one. | Doubtful, with a failure scenario. The Action save checks `databaseName` (`checkBinding`). Bug task **T5R.5-B1**. |
| medium | `daily-review.ts:612-613` | `postMarksReview` reads the overview, then calls `getTrade`, whose `settle` compares only `databaseName`. A write landing in between pairs a newer card with an older overview. | Valid. `postSaveReview` has the same pre-existing pattern. Bug task **T5R.5-B2**. |

**Interpretation for B1 (implementation-level, not a plan deviation).** A155 says `SaveReviewMarks` "adds no other check", and gives the reason: "Market Data accepts any well-formed key on a completed session (D4 P10), and the screen offers only the Review's keys". That rules out checking the keys against the Review. It doesn't rule out checking that the command's `binding` names the Workspace being written, which every binding exists to guarantee (D4 A46). The command carries `binding` for that reason.

#### T5R.5-B1 The binding's Workspace is checked before Marks are written

Defect: a `SaveReviewMarks` whose binding names another Workspace database writes into the active one. Case:
- it should return ReviewChanged and write nothing when the binding's Workspace database is not the active one.

Done in commit `a2494cb`.
- **The case.** Red: `expected { kind: 'MarksSaved', … } to deeply equal { kind: 'ReviewChanged' }`. Then green.
- **The fix.** `saveReviewMarks` reads `currentBinding()` before preparing, and returns `{ kind: 'ReviewChanged' }` when the database name differs. Nothing is added inside the commit, and no key or revision is compared.
- **The types.** `ReviewChanged`'s `evidence` stays required for the Action save, so its call sites are unchanged. To get there, `DailyReview.save` gained two overloads: Action and Debt requests return `SaveDailyReviewResult`, and the union returns the new `SaveReviewMarksResult` (`SaveDailyReviewResult | { kind: 'ReviewChanged'; evidence?: undefined }`). That needed a cast in `daily-review.ts` and in `compose.ts`'s forwarder.
- **Checks.** typecheck, `tsc6`, lint and `lint:deps` exit 0; 89 tests in the daily-review directory and D4's changed-evidence integration pass.
- **Note for the final report.** The overloads and casts are heavier than the defect needed. T5R.6 (the manifest and facade) is the natural place to check they're still worth it.

ocr review of `a2494cb`: four files reviewed, no findings. Raw output: [ocr/T5R.5-B1-a2494cb.json](ocr/T5R.5-B1-a2494cb.json).

#### T5R.5-B2 The post-save card and next step come from the overview's content revision

Defect: after a commit, the overview (`readAfterSave`) and the cards (`getTrade`) are read in separate coherent passes. A write landing between them yields a result that mixes two revisions. Cases:
- it should not return a MarksSaved card read at a later Workspace revision than its overview: when a write lands between the two reads, the post-save assembly is read again or reported as ChangedDuringAssembly;
- it should do the same for the Action save's post-save next step (the same pattern in `postSaveReview`, from D4 and D5).

Done in commit `ec56fae`. Both cases went red, then green, with no first-run passes:
- Marks save. Red: `AssertionError: expected 15 to be 16` (Ready, with a binding older than the card's revision).
- Action save. Red: `expected 21 to be 20`.

In each test, one write lands on the second post-commit `ResolveSession`, between the overview read and the first card read. The Marks test writes an unrelated instrument (`ZZZ`), because an ABC Mark changes the card's snapshot and was already caught as `ReviewChanged`.

The fix:
- `getTrade` is a thin wrapper over an internal `readTrade(request, atRevision?)`. The post-save paths pass the overview's content revision, and a card that settles at another revision is reported internally as `Moved`.
- A bounded `atOneRevision` re-reads the whole post-save assembly up to `ASSEMBLY_ATTEMPTS` times, then returns `ChangedDuringAssembly`. `postMarksReview` and `postSaveReview` both use it, so it covers the Action save and Debt resolution too.
- Public `getTrade` semantics are unchanged, and the normal path adds no request.

The tests depend on the post-save request order (`ResolveSession`, then `ResolveFrames`). Checks: typecheck, `tsc6`, lint and `lint:deps` exit 0; the daily-review unit tests and integration pass (59 files, 195 tests).

### ocr review of `ec56fae`

One file reviewed, two findings. Raw output: [ocr/T5R.5-B2-ec56fae.json](ocr/T5R.5-B2-ec56fae.json).

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| medium | `daily-review.ts:637` | A write between the overview and card reads that changes a fact revision, frame snapshot or Debt makes the card read return `ReviewChanged`. That skips the `Moved` re-read, so one transient write can force Refresh instead of a retry (same in `postSaveReview`). | **Dismissed (Wrong as a defect).** The result is still coherent, because the pair is never mixed. `ChangedDuringAssembly`, with Refresh, is the outcome A155 and A157 name, and B2's case wording allows it. A retry on this path would be a refinement, not a fix. Listed for the final report. |
| low | `daily-review.ts:458` | `getTrade`'s `settle` nests a ternary (database mismatch, then `Moved`, then `Ready`). | Valid. As with T5R.1-B3, this is a refactor bug task, **T5R.5-B3**. |

#### T5R.5-B3 `readTrade`'s settle without a nested ternary

Change: rewrite the `settle` callback at `daily-review.ts` lines 456–460 with plain `if` statements in the same order, with no behaviour change and no new test. Verification: the daily-review unit tests, typecheck, `tsc6`, lint, `lint:deps`.

Done: `settle` is now a block body with two plain `if` statements (database mismatch gives `ReviewChanged`, then revision mismatch gives `Moved`) and a final `return` of `Ready`, in the same order and with the same values; no behaviour change, no new test.

- `npx vitest run src/coordinators tests/integration`: exit 0, 299 passed (69 files)
- `npm run typecheck`: exit 0
- `npx tsc6 --noEmit`: exit 0
- `npm run lint`: exit 0
- `npm run lint:deps`: exit 0

Commit `3573bdc`. ocr review: one file reviewed, no findings. Raw output: [ocr/T5R.5-B3-3573bdc.json](ocr/T5R.5-B3-3573bdc.json).

### Cumulative suite at `1378fc0` (T5R.5 closed)

2026-10-31, by `suite-runner`, label `t5r.5-save-marks`.

| Suite | Result | Output |
|---|---|---|
| Unit | 71 files, 921 tests passed; exit 0 | [unit](suite-runs/t5r.5-save-marks-unit.txt) |
| Node integration | 53 files, 105 tests passed; exit 0 | [integration](suite-runs/t5r.5-save-marks-integration.txt) |
| Browser (Chromium) | 154 passed, 1 failed (5.7 min); exit 1 | [browser](suite-runs/t5r.5-save-marks-browser.txt) |
| Static and verify checks (the same 12) | 12 of 12 exit 0 | [checks](suite-runs/t5r.5-save-marks-checks.txt) |

The one failure is B4.13, "should lay the Action choices out as compact chips, each radio inside its label, at 375 and 320 px" (`e2e/d4/responsive-a11y.spec.ts:68`), at line 84: `Error: Hold radio inside its chip at 375` (expected true, received false). This is the flaky case carried over from D5. Following the rule (rerun once alone before treating it as real), `npx playwright test e2e/d4/responsive-a11y.spec.ts:68 --project=chromium` passed (1 passed, 4.6 s). It has now failed under load twice and passed alone both times. T5R.8 and T5R.15 rework this check when it moves onto cards.

Process note: the suite-runner left several `sleep` waiter shells running, against its brief. The main session stopped the agent and killed them.

## B4.13-F1 B4.13 stable under load (user's direction)

Test-only fix to `e2e/d4/responsive-a11y.spec.ts:68`. The suite serves `dist-releases/d5` (set in `e2e/d4/support.ts`) at the fixed `http://localhost:5175` (`e2e/d1/support.ts`), so no build was needed for the baseline.

| Command | Result |
|---|---|
| `npx playwright test e2e/d4/responsive-a11y.spec.ts:68 --project=chromium --repeat-each=50 --workers=8` | exit 1; 49 of 50 failed with `listen EADDRINUSE: address already in use 127.0.0.1:5175`. The fixed port cannot be shared, so parallel workers are impossible and this run says nothing about the hypothesis. Port 5175 only, as directed, so no other port was tried. |
| Baseline: `npx playwright test e2e/d4/responsive-a11y.spec.ts:68 --project=chromium --repeat-each=50 --workers=1` | exit 1; **5 failed, 45 passed**; all 5: `Error: Hold radio inside its chip at 375`. Reproduced with no CPU throttle. |
| Fix: wrap each choice's measurement and five assertions in `await expect(async () => {...}).toPass({ timeout: 5000 })` (assertions, messages and thresholds unchanged) | edit to the spec only |
| After: the same `--repeat-each=50 --workers=1` command | exit 0; **50 passed, 0 failed** |
| Plain rerun: `npx playwright test e2e/d4/responsive-a11y.spec.ts:68 --project=chromium` (no throttle was ever used) | exit 0; 1 passed |
| Mutation: in `src/ui/app.css`, `label.chip input` `top: 50%` changed to `top: 500px` (radio outside its chip); `TJ_BUILD_LABEL=d5 npx vite build --outDir dist-releases/d5 --emptyOutDir` (exit 0); the single case | exit 1; 1 failed; `Error: Hold radio inside its chip at 375`, `Timeout 5000ms exceeded while waiting on the predicate` |
| Restore: `top: 50%` put back, `git diff -- src` empty, rebuilt d5 with the same command (exit 0), single case | exit 0; 1 passed |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npx playwright test e2e/d4/responsive-a11y.spec.ts --project=chromium` | exit 0; 5 passed |

Failures before and after: 5 of 50 before, 0 of 50 after. Throttle: none. dist-faults was not rebuilt (this case does not use it).

ocr review of `5aa2141`: not run, at the user's direction (test-only commit; the user accepted the stress and mutation checks above).

## T5R.6 Capability manifest and composition

Changes: `src/coordinators/workspace/capabilities.ts` (manifest), `src/app/routes.ts` (Review, Trades and Trade Detail present the new variants), `src/app/compose.ts` and `src/coordinators/daily-review/daily-review.ts` (typing), `tools/verify-capabilities.ts`, and the exact-manifest expectation in `src/coordinators/workspace/workspace.test.ts`.

- Manifest additions, as variants of existing operations: `DailyReview.save` gains `SaveReviewMarks`; `DailyReview.open` gains `RangePosition` and `GapTrades`; `DailyReview.getTrade` gains `PlanBaseline`; `TradeViewsAndReporting.browseTrades` and `getTradeDetail` gain `RewardRiskNow` (the evaluation both carry). No new operation names, so the counts equal D5's.
- Market Data `prepareEffects` and `applyPreparedEffects` are not on the facade or in the manifest. `verify-capabilities.ts` now fails if either name appears in either list (the only change to the script).
- Typing: the two casts are gone. `DailyReview.save` is now a property of overloaded call signatures (a method triggered `@typescript-eslint/unbound-method` when forwarded), implemented by a local overloaded function, and the facade forwards `dailyReview.save` directly. Behaviour unchanged; `ReviewChanged.evidence` stays required for the Action and Debt saves.

| Command | Result |
|---|---|
| `npm run verify:capabilities` | exit 0; `19 operations, 10 variant-qualified, 8 routes, 3 Entry Types, schema 4` (D5: 19 / 10 / 8 / 3 / 4) |
| `npx vitest run src tests/integration` | exit 0; 124 files, 1026 tests passed (one earlier run before the manifest test was updated failed; two later runs passed) |
| `npm run typecheck` | exit 0 |
| `npx tsc6 --noEmit` | exit 0 |
| `npm run lint` | exit 0 (first attempt failed unbound-method on the facade; fixed by the property typing above) |
| `npm run lint:deps` | exit 0 |

Process note (main session): the task agent appended this section with a `cat >>` here-doc, which the Edit-only rule forbids. The content is correct, so it was left as it is.

### ocr review of `4ff8eea`

Five files reviewed, no findings. Raw output: [ocr/T5R.6-4ff8eea.json](ocr/T5R.6-4ff8eea.json).

### Main-session review: `RewardRiskNow` advertised where it isn't shown

The commit added a `RewardRiskNow` variant to `TradeViewsAndReporting.browseTrades` and `getTradeDetail`, in the manifest and on the Trades and Trade Detail routes. No UI renders `rewardRiskNow` (a search of `src/ui` finds nothing). In D5R only the Review's open card shows it (P40, A158, T5R.11). P40 says Trade Detail "can use it later", not now. The variant therefore advertises behaviour those routes don't present, against "Capability honesty" (implementation plan, "Rules every deliverable follows") and T5R.6's "nothing beyond D5R is" reachable. This is bug task **T5R.6-B1**.

#### T5R.6-B1 Reward : risk now advertised only where the Review presents it

Change: remove `RewardRiskNow` from `browseTrades` and `getTradeDetail`, in the manifest and on the routes. Add it as a variant of `DailyReview.getTrade`, presented by the Review route, whose card shows it from T5R.11. Update the exact-manifest test. Verification: `npm run verify:capabilities` (19 / 10 / 8 / 3 / schema 4), the workspace manifest test, typecheck, `tsc6`, lint, `lint:deps`.

Done: `capabilities.ts` and `routes.ts` restore the D5 lists of `browseTrades` (`Planned`, `Open`, `CurrentEvaluation`) and `getTradeDetail` (adds `Debt`), and add `RewardRiskNow` to `DailyReview.getTrade` beside `PlanBaseline`. The manifest comment now says only the Review presents it (P40, A158). The exact-manifest expectation in `workspace.test.ts` follows. `tools/verify-capabilities.ts` names none of these variants, so it is unchanged.

| Command | Result |
|---|---|
| `npm run verify:capabilities` | exit 0; `19 operations, 10 variant-qualified, 8 routes, 3 Entry Types, schema 4` |
| `npx vitest run src/coordinators/workspace src/app` | exit 0; 2 files, 40 tests passed |
| `npm run typecheck` | exit 0 |
| `npx tsc6 --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run lint:deps` | exit 0 |

ocr review of `881d40c`: two files reviewed, no findings. Raw output: [ocr/T5R.6-B1-881d40c.json](ocr/T5R.6-B1-881d40c.json).

### Cumulative suite at `902fdb2` (T5R.6 closed)

2026-10-31, by `suite-runner`, label `t5r.6-manifest`. All passed.

| Suite | Result | Output |
|---|---|---|
| Unit | 71 files, 921 tests passed; exit 0 | [unit](suite-runs/t5r.6-manifest-unit.txt) |
| Node integration | 53 files, 105 tests passed; exit 0 | [integration](suite-runs/t5r.6-manifest-integration.txt) |
| Browser (Chromium) | 155 passed (5.7 min); exit 0 | [browser](suite-runs/t5r.6-manifest-browser.txt) |
| Static and verify checks (the same 12) | 12 of 12 exit 0 | [checks](suite-runs/t5r.6-manifest-checks.txt) |

The run included B4.13 with the B4.13-F1 retry, which passed.

## T5R.7 UI: Stop-to-Target slider

Commit `a17ab50`:
- new: `src/ui/screens/StopTargetSlider.tsx` and its test;
- slider CSS in `src/ui/app.css`;
- `RangePosition` re-exported through `src/app/types.ts` and the coordinator index, since `lint:deps` forbids UI imports from coordinators.

Four cases, each red then green, with no first-run passes:
- placement: red `TypeError`, the dot element was null;
- description: red, `aria-label` was null;
- pinned: red, the pinned class was absent;
- not placed: red, `expected null not to be null`.

Checks: typecheck, `tsc6`, lint and `lint:deps` all exit 0.

Props: `{ position: RangePosition, figures: { riskToStop, pnl, rewardToRisk } }`, where the figures are formatted strings and a `NotPlaced` position ignores them. Rendering: `<span class="slider" role="img" aria-label=…>`, with no visible text. Percentages come from the exact rationals, rounded half up.

Implementation decisions, made by the main session:
- **Date wording.** The not-placed description reads "Mark missing: DEF, Mon Oct 12", where the breakdown has "Oct 12". It reuses `shortDate`, as `src/ui/figures.ts` does, so the slider says it the same way as every other Mark-missing figure in the app. The case's wording is treated as an example of the form, not a literal string.
- **Pinned side.** The component takes the pinned side from `RangePosition.pinned`, not from the attention reasons.

Not covered by a planned case: `AwaitingClose` reads "Awaiting the next close" and `FactsIncoherent` reads "Not available".

ocr review of `a17ab50`: four files reviewed (test excluded), no findings. Raw output: [ocr/T5R.7-a17ab50.json](ocr/T5R.7-a17ab50.json).
