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

### Cumulative suite at `78b22e3` (T5R.7 closed)

2026-10-31, by `suite-runner`, label `t5r.7-slider`. All passed.

| Suite | Result | Output |
|---|---|---|
| Unit | 72 files, 925 tests passed; exit 0 | [unit](suite-runs/t5r.7-slider-unit.txt) |
| Node integration | 53 files, 105 tests passed; exit 0 | [integration](suite-runs/t5r.7-slider-integration.txt) |
| Browser (Chromium) | 155 passed (5.6 min); exit 0 | [browser](suite-runs/t5r.7-slider-browser.txt) |
| Static and verify checks (the same 12) | 12 of 12 exit 0 | [checks](suite-runs/t5r.7-slider-checks.txt) |

## T5R.3-B3 Each walked Trade carries its slider's figures (gap found before T5R.8)

The gap: P39 requires each collapsed card's slider description to give Risk to stop, P&L and Reward : risk (T5R.7, A150). The overview's `WalkedTrade` carries the range position, but not those three figures. P39 rejected the alternative, a `getTrade` per collapsed card (its option b).

`open` already evaluates every walked Trade (`daily-review.ts:168`), so the figures can come from that evaluation with no new request. A163 allows this: the overview's new fields "are computed from data `open` already reads". The main session judged this implementation-level, not a plan deviation, because it completes P39's own requirement within A163.

Cases:
- it should return each walked Trade's Ongoing Risk to Stop, current P&L, and Reward : risk now, from the Review-date evaluation: T-A at XYZ 52.00 with Reward : risk now 8/9, T-B with Reward : risk NotApplicable, and T-C Unavailable with the missing Mark;
- the same figures after `SaveReviewMarks`, in `PostMarksReview`'s walked Trades.

Done in commit `ed3cf69`. Both cases went red (`expected undefined to deeply equal { kind: 'Value', … }`) and then green, with no first-run passes.
- **The field.** `WalkedTrade` gains an optional `figures: SliderFigures` (`riskToStop`, `pnl` = `currentMarkedPnl`, `rewardRiskNow`, each an unformatted `CalculationResult`). It is taken from the evaluation `reviewItem` already carries, so there's no new request. It is absent when the facts are incoherent and there's no evaluation.
- **Agreement with the card.** The figures equal `getTrade`'s for T-A, T-B and T-C, and after `SaveReviewMarks` too.
- **One existing test changed.** "should return the same attention reasons as the overview…" also strips `figures` before comparing.
- **Checks.** typecheck, `tsc6`, lint and `lint:deps` exit 0; 92 daily-review tests pass.
- **Process slip.** The agent used `sed -i` once (the `index.ts` export line), against the Edit-only rule. The result is correct.
- **Note for T5R.8.** The coordinator's `SliderFigures` (calculation results) and T5R.7's `SliderFigures` props (formatted strings) share a name. T5R.8 maps one to the other.

ocr review of `ed3cf69`: three files reviewed, no findings. Raw output: [ocr/T5R.3-B3-ed3cf69.json](ocr/T5R.3-B3-ed3cf69.json).

### Cumulative suite at `2cb6202` (T5R.3-B3 closed)

2026-10-31, by `suite-runner`, label `t5r.3-b3-slider-figures`. All passed.

| Suite | Result | Output |
|---|---|---|
| Unit | 72 files, 927 tests passed; exit 0 | [unit](suite-runs/t5r.3-b3-slider-figures-unit.txt) |
| Node integration | 53 files, 105 tests passed; exit 0 | [integration](suite-runs/t5r.3-b3-slider-figures-integration.txt) |
| Browser (Chromium) | 155 passed (5.6 min); exit 0 | [browser](suite-runs/t5r.3-b3-slider-figures-browser.txt) |
| Static and verify checks (the same 12) | 12 of 12 exit 0 | [checks](suite-runs/t5r.3-b3-slider-figures-checks.txt) |

## T5R.8 UI: position cards, opened in place

Commit `5ab6a29` holds the unit side: the 7 planned cases plus 3 extras, each red then green. The read-only case was a first-run pass, mutation-checked (DebtForm's `writable` guard removed: `AssertionError: expected <button type="submit" …> to be null`). It also moves the D4 browser helpers onto cards (`e2e/d4/support.ts`, `review.spec.ts`, `responsive-a11y.spec.ts`). The task agent's report lists every unit case it deleted, moved or changed. `npx vitest run src/ui`: 22 files, 333 tests pass. Typecheck, `tsc6`, lint and `lint:deps` exit 0.

The browser suite at `5ab6a29`: 151 passed, 4 failed. Each failure was rerun alone and failed the same way, so they're deterministic: B4.3 (`acknowledge.spec.ts:6`), B4.6 (`gaps.spec.ts:9`), B4.10 (`runtime-failure.spec.ts:7`) and B4.12 (`no-save.spec.ts:38`). Each one looks up a Mark row inline while that Instrument's card isn't open (A151). Fixing them needs edits to spec files beyond section 6.3's list, so the session stopped and walked the user through each case.

### The four D4 cases (user's decisions, 2026-10-31)

These extend breakdown section 6.3's file list to the four specs below. The edits are layout-only, and no expectation about saved data, completion or durable state changes, except B4.12's narrowing, which the user decided.
- **B4.3** (still valid): open DEF's card before line 25, inside the reload loop, and before the Withdraw at line 29. No assertion changes.
- **B4.6** (still valid): open MNO's card before line 35, and before lines 41–42, so the "count 0" checks are made with the card open and mean something. No assertion changes.
- **B4.10** (still valid): restructure lines 16 and 29–42 into per-card blocks, so each "absent" check runs while the card it concerns is open:
  - ABC: row Missing, no Enter, no "Can't get a price";
  - XYZ: row Manual, no Correct, Saved Action Hold, no Change;
  - ABC again: "No Action saved.", no Action form, no Save, no Save Mark.

  Line 16's setup check opens ABC's card first. Every assertion is kept.
- **B4.12** (narrowed by the user): several dirty cards at once is no longer possible (A156), so every part relying on more than one edited card is dropped. It becomes a single XYZ-card test:
  - type a correction of XYZ's Mark with its reason, plus the full Action form (Exit, Intent, Conviction, considered text, Note), pressing no save;
  - resize and back, and check the values survived and storage is unchanged;
  - navigate away, restart, and check that XYZ is still 52.00 at revision 1 and ABC untouched, with no Entry and no marker trace in IndexedDB or Web Storage.

  The DEF initial-price part is dropped: B5R.5 and T5R.9 re-prove unsaved drafts on cards.

### T5R.8-B1 the four D4 cases on cards

Edits to `e2e/d4/acknowledge.spec.ts`, `gaps.spec.ts`, `runtime-failure.spec.ts` (first test only) and `no-save.spec.ts`, as decided above. No app code or `support.ts` change. B4.10's absent checks are scoped to the open card's region ("ABC review", "XYZ review"). B4.12 is the single XYZ-card test: DEF and the 43.71 marker are removed, and after the restart it opens XYZ's card and reads `$52.00`.

| Command (each alone) | Result |
|---|---|
| `npm run build:faults` | exit 0 |
| `npm run build:releases` | exit 0 |
| `npx playwright test e2e/d4/acknowledge.spec.ts --project=chromium` | 1 passed |
| `npx playwright test e2e/d4/gaps.spec.ts --project=chromium` | 1 passed |
| `npx playwright test e2e/d4/runtime-failure.spec.ts --project=chromium` | 2 passed (B4.10 and B4.11) |
| `npx playwright test e2e/d4/no-save.spec.ts --project=chromium` | 1 passed |
| `npm run test:e2e` | 155 passed (5.5 min); exit 0 |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |

ocr review of `32b180e`: not run, at the user's direction (test-only commit, as for B4.13-F1).

### ocr review of `5ab6a29`

Eight files reviewed (test files excluded), six findings. Raw output: [ocr/T5R.8-5ab6a29.json](ocr/T5R.8-5ab6a29.json).

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| high | `ReviewView.tsx:269` | `markSaved` takes the open card from its render, while `refreshTrade` takes `selection.current` when it runs. A Mark save that finishes after another card opened re-reads the old card and shows it in place of the new one, dropping its drafts. | Valid. The `selection.current !== request` guard compares against a request taken after the switch, so it doesn't catch this. `markSaved` and `refreshTrade` stay in `ReviewView` after T5R.9, so it isn't owned by the temporary rows. Bug task **T5R.8-B3**. |
| high | `ReviewView.tsx:233` | An Action save advances or collapses the card while other forms hold values. | Dismissed: the next step after a save is T5R.12's ("links, blockers, and next step"). Carried into T5R.12's brief. |
| medium | `ReviewView.tsx:200` | `apply(() => next)` replaces the whole Review, so a refresh after a Mark can reorder cards within one view. | Valid against A150 ("attention order, which is stable within a Review view"; a Done card "keeps its place"). Bug task **T5R.8-B2**. |
| medium | `ReviewView.tsx:203` | Two Mark-triggered refreshes overlap: the second `reopen()` returns nothing while the first is in flight, so the "couldn't refresh" banner shows. | Dismissed: it needs two per-row saves in quick succession, which only the temporary `CardMarks` rows allow. T5R.9's single Save Marks replaces them. Carried into T5R.9's brief. |
| medium | `CardMarks.tsx:128` | The `earlier` snapshot keeps its first resolutions, so paging away and back after a save shows stale rows. | Dismissed: `CardMarks.tsx` is temporary and T5R.9 replaces it. Carried into T5R.9's brief. |
| medium | `ReviewView.tsx:149` | The first card ignores `?instrument=`, while the Open list and Detail still link with it. | Dismissed: links are T5R.12's (A161). |

#### T5R.8-B2 Card order stays fixed within a Review view

Defect: a refresh after a save rebuilds the card list from the new overview, so cards can change places within one view. Case:
- it should keep each card in its place within the view when a refreshed Review returns the Trades in a different order.

#### T5R.8-B3 A late Mark save never replaces the card opened since

Defect: a Mark save that finishes after another card opened re-reads and shows the card it was entered on. Case:
- it should keep the newly opened card shown, with its values, when a Mark saved on the previous card finishes after the switch.

Done in commit `5a2a27e`:
- **The case.** Red: `expected ['JKL','XYZ','XYZ','DEF','ABC'] to equal ['ABC','DEF','XYZ','XYZ','JKL']`, after a Mark save on DEF's card with `open` returning the Trades reversed. Then green. No first-run passes.
- **The fix.** `ReadyReview` holds the Trade ids in the order first shown (`order`, kept as state because lint rejects reading a ref during render). A refreshed Review adds a Trade new to it at the end, and a Trade it no longer holds gets no card. That choice isn't pinned by its own test. Each card's content still comes from the newest Review.
- **Checks.** typecheck, `tsc6`, lint and `lint:deps` exit 0; `npx vitest run src/ui` 334 passed.

ocr review of `5a2a27e`: one file reviewed (two excluded), no findings. Raw output: [ocr/T5R.8-B2-5a2a27e.json](ocr/T5R.8-B2-5a2a27e.json).

Done in commit `4fdaa50` (T5R.8-B3):
- **The case.** Red: `Unable to find an accessible element with the role "region" and name "JKL review"`, because DEF's card was shown in place of JKL's. Then green. No first-run passes. The first red attempt was a transform error (a duplicate `const facade`), logged but not counted as the red.
- **The setup.** Holding open an Enter or Correct save doesn't work, because the typed price keeps the card dirty and the A156 hold refuses the switch. The test therefore uses the one per-row save that leaves nothing typed: Withdraw on DEF's acknowledged Mark. It holds `MarketData.save` open, opens JKL, types into JKL's first textbox, then resolves the save. A 50 ms `act` wait follows, because the late refresh now ends with no further call to wait on.
- **The fix.** `refreshTrade(tradeId, request = selection.current)`. `markSaved` passes `shown.opening`, so the refresh belongs to the opening the Mark was saved under. The Review itself still refreshes; only the shown card is protected.
- **Checks.** typecheck, `tsc6`, lint and `lint:deps` exit 0; `npx vitest run src/ui` 22 files, 335 passed.

ocr review of `4fdaa50`: one file reviewed (test excluded), no findings. Raw output: [ocr/T5R.8-B3-4fdaa50.json](ocr/T5R.8-B3-4fdaa50.json).

### Cumulative suite at `206679d` (not green)

| Suite | Result |
|---|---|
| Unit | 73 files, 931 passed |
| Integration | 53 files, 105 passed |
| Browser | 154 passed, 1 failed (5.6 min) |
| Checks | 12 of 12 exit 0 |

Outputs: `suite-runs/t5r.8-cards-*.txt`. The failure is B4.1 (`e2e/d4/review.spec.ts:30`): `expect(rows.nth(0)).toContainText('ABC')`, received "Review XYZ Action Quantified pressure". The test enters all four Marks in the view it opened, then expects the attention order those Marks produce (ABC first, "Boundary reached"). Since T5R.8-B2 the cards keep the order the view first showed, before any Mark, as A150 requires ("stable within a Review view"). Under D4, Continue to Trades refreshed the order; on cards it is a no-op. The test and A150 disagree, so the session stopped for the user's decision.

### The user's decision on B4.1: amend A150 (decision 64, revision 23)

The user's direction: "Since we are entering marks on cards, we should resort when that changes the attention order. Let's amend A150." A150 now has the cards follow the newest Review the screen holds, with the open card staying open, its values kept, as it moves. B4.1 stands as written.

#### T5R.8-B4 The cards re-sort when a save returns a refreshed Review

Defect (against amended A150): since B2, the cards keep the order the screen first showed, so a saved Mark that moves a Trade into another band leaves it out of attention order. Cases:
- B2's case changes: it should re-sort the cards when a refreshed Review returns the Trades in a different order;
- it should keep the open card open, with its entered values, when a refreshed Review moves it.

Done in commit `d9e81b0`:
- **Re-sort (B2's case, rewritten).** Red: `expected ['ABC','DEF','XYZ','XYZ','JKL'] to deeply equal ['JKL','XYZ','XYZ','DEF','ABC']`. Then green.
- **Open card moves with its values.** The test types "kept" into DEF's Action form, saves DEF's Mark, and `open` returns the Trades reversed. It checks DEF's header is fourth, still expanded, and still holds "kept". Red: `expected 1 to be 3` (the card didn't move). Then green. The red is on the position: the open and values assertions held before and after, and weren't mutation-checked on their own.
- **The fix.** B2's `order` state and its merge in `apply` are removed; cards are `walkedTrades(review)` of the newest Review. B3's fix is untouched.
- **Checks.** typecheck, `tsc6`, lint and `lint:deps` exit 0; `npx vitest run src/ui` 22 files, 336 passed; after `npm run build:releases`, B4.1 alone passed.

ocr review of `d9e81b0`: one file reviewed (test excluded), no findings. Raw output: [ocr/T5R.8-B4-d9e81b0.json](ocr/T5R.8-B4-d9e81b0.json).

### Cumulative suite at `fdee705` (T5R.8 closed)

| Suite | Result |
|---|---|
| Unit | 73 files, 932 passed |
| Integration | 53 files, 105 passed |
| Browser | 155 passed (5.6 min) |
| Checks | 12 of 12 exit 0 |

Outputs: `suite-runs/t5r.8-resort-*.txt`. The suite-runner ended its turn while the run was still going; the main session read the finished browser and checks files directly.

## T5R.9 UI: Marks panel and Save Marks

Commit `f5ed966`: the card's Marks panel replaces T5R.8's temporary per-row rows. All 9 planned cases are in `CardMarks.test.tsx`; 7 went red then green, and "rows with a Mark" was a first-run pass (D4's per-row Correct and Withdraw kept), mutation-checked (`withdraw={false}`: no "Withdraw" button).

| Case | Red |
|---|---|
| rows | no "also held by" text |
| drafts | no Price field |
| Save Marks sends one command | `save` not called |
| renders from MarksSaved | `$52.00` not found |
| Rejected | no issue text beside the row |
| Conflict | current `$51.50` not shown |
| ChangedDuringAssembly | no "figures are out of date" notice |
| keyboard | focus not on the next price |
| rows with a Mark | first-run pass, mutation-checked |

Extras beyond the plan's cases:
- **The two ocr findings carried from `5ab6a29`.** Two quick per-row saves now share one in-flight `reopen` and show no "couldn't refresh" banner. A saved earlier session stays saved after paging, through a per-key overlay that wins when its revision is at least the Review's. Both were first-run passes and mutation-checked (the old guard: `called 2 times`, not 3; `>=` flipped: `$9.00` not found). **Process note:** the `reopen` fix was written before its test, against "never code ahead of red". The overlay's mutation fails before the paging step, so it guards the overlay but not the paging half on its own.
- **Not-written results.** ReviewChanged shows a notice with Refresh; StorageFailure or a thrown error shows "could not be saved". Drafts are kept.
- **Moved unit tests.** 3 in `ReviewCards.test.tsx` and 10 in `ReviewView.test.tsx` move from Enter/Save Mark to drafts and Save Marks.

Implementation decisions and notes for later tasks:
- **The next panel (A157)** is a focus move until T5R.10 builds the panels: to the first due reflection, else to the Action. It's triggered by an `advance` count on `ReviewCard`. The result's `nextStep` is unused; the hand-off between cards is T5R.12's.
- **"Grouped by date".** D4's grouping is kept (one list per Instrument, sessions newest first), so D4's paging cases move over unchanged. With one Instrument per card (Long Stock) the two read the same; D7's multi-Instrument cards must revisit it.
- **After MarksSaved**, `ReviewView` merges the saved Marks into the Marks family, so other cards holding the same key show them saved, and takes the result's Trades, so cards re-sort (amended A150).
- **Browser helpers.** `enterMark` and `acknowledgeMark` in `e2e/d4/support.ts` draft in the open card and press Save Marks; the old flow is kept for the update cases that run a previous release. `runtime-failure.spec.ts`'s read-only absent checks name the new controls (no Price field, no Save Marks). `responsive-a11y.spec.ts` types a price then Discards for axe, and its keyboard test ends Enter → Save Marks → Enter. No D4 or D5 expectation changed; `e2e/d5/support.ts` needed nothing.
- **Types and props.** Type re-exports in `src/coordinators/daily-review/index.ts` and `src/app/types.ts`; `MarkEntry` gains `offerEntry?`, `children?` and a saved-result argument to `onSaved`; `ReviewCard` gains `advance`, `onSaveMarks`, `outOfDate`.

Checks: typecheck, `tsc6`, lint and `lint:deps` exit 0; `npx vitest run src/ui` 23 files, 348 passed; `build:faults` and `build:releases` exit 0; `npm run test:e2e` 155 passed.

### ocr review of `f5ed966`

Eight files reviewed, four findings (one internal ocr read past the end of `types.ts` failed, without effect on the findings). Raw output: [ocr/T5R.9-f5ed966.json](ocr/T5R.9-f5ed966.json).

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| high | `CardMarks.tsx:342` | On MarksSaved, `setDrafts({})` wipes every draft, including edits typed while the save was pending. | Valid: only Save is disabled while saving; inputs and Discard stay enabled, and nothing compares the drafts with what was sent. Bug task **T5R.9-B1**. |
| medium | `ReviewView.tsx:338` | A later Ready Save Marks never clears `stale`, so the "figures out of date" notice stays. | Valid: only the refresh path clears it. Bug task **T5R.9-B2**. |
| medium | `CardMarks.tsx:149` | After RuntimeNotWritable, drafts, Save and Discard disappear while the card stays dirty, so it can't be closed. | Valid against A156 and A162 (read only). Bug task **T5R.9-B3**. |
| medium | `CardMarks.tsx:306` | Earlier-session drafts are sent with the `earlier` snapshot's resolution and revision, even after a Refresh brings newer data. | Doubtful: the overlay takes the newer of the two, but whether Refresh re-passes `earlier` wasn't checked. Bug task **T5R.9-B4** (a test decides). |

#### T5R.9-B1 A save keeps drafts typed while it was pending

Case: it should keep a draft typed or changed while Save Marks was pending, and clear only the drafts that were sent unchanged, when the result is MarksSaved.

#### T5R.9-B2 A later saved result clears the out-of-date notice

Case: it should clear the "figures are out of date" notice and its Refresh when a later Save Marks returns a Ready Review.

#### T5R.9-B3 Not writable mid-session leaves the card closable

Case: it should let the card close, with nothing left dirty, after Save Marks returns RuntimeNotWritable and the card turns read only, its drafts unsaved.

#### T5R.9-B4 Earlier-session drafts carry the newest resolution and revision

Case: it should send an earlier-session draft with the resolution and revision of the newest Review after Refresh, not those of the first snapshot.

Done in commit `6c7c0ff` (T5R.9-B1):
- **The case.** The test holds the save open, appends "1" to the sent Friday price, then resolves: Monday (sent unchanged) shows its saved Mark, and Friday stays Unsaved at 51.001. Red: no "Save Marks (1)" button (every draft cleared). Then green.
- **An extra case**, for a key not sent (Monday sent, Friday typed while pending), was written after the fix: a flagged first-run pass, mutation-checked (the clearing filter always true: no "Save Marks (1)").
- **The fix.** The inputs stay enabled; on MarksSaved a draft is cleared only when its key was sent and its price, unavailable flag and reason all equal what was sent.
- **Checks.** typecheck, `tsc6`, lint and `lint:deps` exit 0; `npx vitest run src/ui` 23 files, 350 passed.
- **Process note:** the agent ran two no-op here-doc and python commands that changed nothing, against the Edit-only rule.

ocr review of `6c7c0ff`: one file reviewed, no findings. Raw output: [ocr/T5R.9-B1-6c7c0ff.json](ocr/T5R.9-B1-6c7c0ff.json).

Done in commit `eec558b` (T5R.9-B2): the first save returns ChangedDuringAssembly, the second a Ready Review. Red: `expected <strong></strong> to be null` (the notice stayed). Then green; no first-run passes. The fix is one `setStale(undefined)` on `marksSaved`'s Ready path, unconditional, since a Ready Review makes the figures current and `stale` holds one id. `npx vitest run src/ui` 23 files, 351 passed; typecheck, `tsc6`, lint and `lint:deps` exit 0. (The task agent's own note, placed above B1's record, was moved here.)

ocr review of `eec558b`: one file reviewed, no findings. Raw output: [ocr/T5R.9-B2-eec558b.json](ocr/T5R.9-B2-eec558b.json).

Done in commit `68eca9f` (T5R.9-B3): red `expected last "vi.fn()" call to have been called with [ false ]` (the Marks entry stayed dirty), then green; no first-run passes. The test's shell turns read only on RuntimeNotWritable, then checks the dirty flag ends false, Save Marks is gone, the header closes the card, and no "Save or discard what you entered" appears. **The fix:** `held = writable && count > 0` drives the dirty flag, so a read-only card holds nothing; the drafts stay in state, unsaved and unshown. **Against D4's B4.11:** the Action form keeps its values visible but disabled, while read-only Marks drafts aren't shown. A162 has a read-only card show "no inputs or Save buttons", so this is consistent with A162; showing the drafts disabled would be a UI addition no case asks for. Whether the Action form's dirty flag releases when read only wasn't checked; T5R.10 owns that panel. `npx vitest run src/ui` 23 files, 352 passed; typecheck, `tsc6`, lint and `lint:deps` exit 0. **Process note:** one empty python here-doc (no-op) against the Edit-only rule.

ocr review of `68eca9f`: one file reviewed (test and log excluded), no findings. Raw output: [ocr/T5R.9-B3-68eca9f.json](ocr/T5R.9-B3-68eca9f.json).

Done in commit `093a1a6` (T5R.9-B4): the finding was valid. The test drafts Friday's earlier-session row and Saves Marks, which answers ReviewChanged; `open` then returns Friday acknowledged at revision 4, and after Refresh a second Save Marks must send `expectedRevision: 4` with the row shown as Acknowledged Unavailable. A first red failed on a wrong matcher (the row never shows the reason), a test error, not counted; the genuine red: `Unable to find an element with the text: Acknowledged Unavailable` (the row stayed at the first snapshot). Then green; no first-run passes. **Cause:** `CardMarks` froze `marks.earlier` in `useState`. **Fix:** `withNewest(opened, newest)` keeps the opened snapshot's list of sessions but reads each date's membership, revision and acknowledgment from the current Review when it still lists the date. A session the newest Review no longer lists keeps its snapshot, so a saved Mark stays visible until the card closes. `npx vitest run src/ui` 23 files, 353 passed; typecheck, `tsc6`, lint and `lint:deps` exit 0.

ocr review of `093a1a6`: one file reviewed (two excluded), no findings. Raw output: [ocr/T5R.9-B4-093a1a6.json](ocr/T5R.9-B4-093a1a6.json).

### Cumulative suite at `4ccd98d` (T5R.9 closed)

| Suite | Result |
|---|---|
| Unit | 74 files, 949 passed |
| Integration | 53 files, 105 passed |
| Browser | 155 passed (5.4 min) |
| Checks | 12 of 12 exit 0 |

Outputs: `suite-runs/t5r.9-save-marks-*.txt`. HEAD moved to `1ee55fb` during the run, by evidence-only commits; the suite ran against `4ccd98d`, which holds every T5R.9 code change.

## T5R.10 UI: Reflections and Action panels

Commit `41b33a1`: Marks, Reflections and Action panels on the open card, one open at a time (A152). `npx vitest run src/ui` 23 files, 358 passed; typecheck, `tsc6`, lint and `lint:deps` exit 0; `build:faults` and `build:releases` exit 0.

| Case | Red |
|---|---|
| panels | no button named `/^Marks\b/` |
| reflections | no group "Fri Oct 9 · Due" (a first green then failed on a test bug, nested list items counted twice, fixed) |
| Action (A159) | first-run pass (D4 built it), mutation-checked: ActionForm always sending `intent` fails the call assertion |
| moving on | the move-on code was written with case 1, ahead of this case (code ahead of red, flagged); disabling it gave `expected [ 'Marks' ] to deeply equal [ 'Reflections' ]`, then restored and green. The Action-save half (open the card the result names) is T5R.8's behavior and held throughout. |

- **Carried-in check:** ActionForm and DebtForm already report `dirty && writable`, so a read-only card isn't held. An extra test for the reflection draft was a first-run pass, mutation-checked (DebtForm reporting `dirty` alone fails).
- **Left for T5R.12:** an Action save collapsing the card while other forms hold values (A156).
- **Design choices:** panels stay mounted and only the open one shows, so drafts survive switching; after Save Marks the next panel not done opens and its header takes focus (replacing T5R.9's `advance` focus move); group labels are text ("Fri Oct 9 · Due"), grouped by session date in the runtime time zone; statuses are text ("N needed", "Saved", "Optional", "None"; "N due", "Resolved", "Not due", "None"; "Needed", "Saved").
- **Process notes:** one no-op `cat >> /dev/null` and one `printf >>` to `tdd-log.md` (content fine), against the Edit-only rule.

**Browser suite: not green.** 126 passed, 29 failed after the panels; 136 passed, 19 failed after `e2e/d4/support.ts`'s `enterMark` and `acknowledgeMark` reopen the Marks panel to check the saved row. The Due label then moved into its own span without a full rerun. The 19 fail because one panel is open at a time: specs read Mark rows while the card is open on the Action (`acknowledge.spec.ts:26`, `gaps.spec.ts:36`, `runtime-failure.spec.ts:44` and 49–52, `responsive-a11y.spec.ts:274`), read D5's Reflections while that panel is closed (`due-timing.spec.ts:16`, `review-debt.spec.ts:36` and `:79`, `update.spec.ts:60`), or time out, probably for the same reason (`correct-mark`, both `no-save`, `responsive-a11y.spec.ts:121`, `detail-debt`, `due-timing.spec.ts:31`, both `faults`, `kill-offline`, both `d5/responsive`, `review-debt`). Fixing them needs steps in the spec bodies that open a panel before reading it, beyond section 6.3's helper-only file list. No expectation is reported to need changing. `support.ts` gains `openPanel` and `showPanel`. The session stopped for the user's decision.

### ocr review of `41b33a1`

Four files reviewed, four findings. Raw output: [ocr/T5R.10-41b33a1.json](ocr/T5R.10-41b33a1.json).

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| medium | `ReviewReflections.tsx:~75-95`, wired at `ReviewCard.tsx:271` | The Reflections panel advances only when every owed reflection is resolved, including those due in the next Review, so a card with one Due and one future reflection stays on Reflections after the Due one is saved. | Valid: the header counts the panel done at `due === 0`, but `onNoneRemaining` fires only when none remain. Bug task **T5R.10-B1**. |
| medium | `ReviewCard.tsx:217` | Advancing is computed from the panel open now (`nextAfter(open)`), not the one that finished, so opening Reflections during a pending Save Marks can advance to the Action while reflections are due. | Valid, a narrow race. Bug task **T5R.10-B2**. |
| medium | `e2e/d4/support.ts` (`enterMark`, `acknowledgeMark`) | In card mode the helpers never open the Marks panel before filling, so a second entry on the same card hits hidden controls. | Valid, and part of the 19 browser failures. Dismissed here: the card helpers (decision 65, T5R.10-H1's `reachPanel`) replace this path; carried into H1's brief. |
| low | `ReviewCard.tsx:178` | Nested ternaries in the Marks and Reflections status expressions. | Valid, cosmetic; the values are correct. Bug task **T5R.10-B3** (refactor, structural: unit tests unchanged and green). |

#### T5R.10-B1 Reflections advance when nothing is due

Case: it should open the next panel that is not done when the card's last Due reflection is resolved, though a reflection due in the next Review remains.

#### T5R.10-B2 Advancing starts from the panel that finished

Case: it should advance from the Marks panel when Save Marks finishes after the trader opened the Reflections panel, leaving Reflections open while a reflection is due.

#### T5R.10-B3 Panel statuses without nested ternaries (refactor)

Verification: `npx vitest run src/ui` unchanged and green; lint, typecheck exit 0.
