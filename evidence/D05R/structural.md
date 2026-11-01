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

Done in commit `ad1036e` (T5R.10-B1): red, the Action panel's `aria-expanded` was `'false'`; then green; no first-run passes. `resolvedOne` now moves focus to the next unresolved Due reflection and reports the panel finished when none is Due; later reflections stay listed and answerable. One T5R.10 test changed with it: the reflections case had asserted focus moving to Monday's reflection (due in the next Review) after Friday's resolved, which was the defect. It now asserts the Action panel opens, then reopens Reflections and finds Monday's "Reflect on" button. The plan's case text (grouping, labels, resolving with DebtForm) is unaffected. `npx vitest run src/ui` 359 passed; typecheck, `tsc6`, lint and `lint:deps` exit 0.

ocr review of `ad1036e`: one file reviewed (test excluded), no findings. Raw output: [ocr/T5R.10-B1-ad1036e.json](ocr/T5R.10-B1-ad1036e.json).

Done in commit `5d51db5` (T5R.10-B2): red `expected [ 'Action' ] to deeply equal [ 'Reflections' ]`, then green; no first-run passes. The test holds the save open, presses Save Marks, opens Reflections, then releases MarksSaved, and waits for the Marks badge to read Saved before checking the open panel. **The fix:** one handled counter per source and a `moveOn(from)` that computes `nextAfter(from)` and moves only when the open panel is the one that finished or is itself done; a panel the trader opened that still has work stays open. Save Marks calls `moveOn('Marks')`, the last Due reflection `moveOn('Reflections')`, keeping B1. typecheck, `tsc6`, lint and `lint:deps` exit 0. **Unidentified failure:** `npx vitest run src/ui` passed 360 of 360 on four of five runs; the first run after the fix had 1 failed, 359 passed, and the failing case wasn't identified (filtered output). Carried into B3's brief: repeat the UI run and name any failing case.

ocr review of `5d51db5`: one file reviewed (test excluded), no findings. Raw output: [ocr/T5R.10-B2-5d51db5.json](ocr/T5R.10-B2-5d51db5.json).

Done in commit `1210133` (T5R.10-B3, structural): `marksStatus` and `reflectionsStatus` with early returns replace the nested ternaries, producing the same strings in the same situations. `npx vitest run src/ui` 23 files, 360 passed, the same count, no test file changed; typecheck, `tsc6`, lint and `lint:deps` exit 0.

**The flaky unit case, named.** Ten `npx vitest run src/ui` runs before the refactor: one failed (run 5), nine passed 360 of 360. The failure: `ReviewCard.test.tsx` › "reflections in the Trade card (A71) › should open DebtForm for a reflection and, after Save, render it resolved from the result and move focus to the next reflection in the card, or to the Action form when none remains": `AssertionError: expected <body>… to be <button type="button" …>` (focus on `body`, not the expected button). Two of the runs may have overlapped. Bug task **T5R.10-B4**.

#### T5R.10-B4 Focus after a resolved reflection lands every time

Defect: focus sometimes stays on `body` after a reflection is saved, instead of moving to the next reflection or the Action form. Find whether the app moves focus before its target is shown (a real race, fixed in the component) or the test checks too early (fixed in the test), and prove it stable over repeated runs.

ocr review of `1210133`: one file reviewed, no findings; the reviewing agent also compared the helpers with the parent commit's ternaries by hand (same condition order, strings and inputs). Raw output: [ocr/T5R.10-B3-1210133.json](ocr/T5R.10-B3-1210133.json).

Done in commit `2cd48ab` (T5R.10-B4, test only): a test race, not an app bug. The case failed alone in 2 of 40 single runs. `findByText('Complete')` can resolve one render before the focus chain (`onResolved` → `resolvedOne` → `onNoneRemaining` → `moveOn('Reflections')` → focus effect) finishes; the clicked button has unmounted, so focus is briefly on `body`. The Action panel opens in the same render that focuses its header, so the target is visible when `focus()` runs. Both focus assertions now wait with `vi.waitFor`. No red test: the race is timing-only, so the repeat counts are the proof: 0 of 80 single runs failed after the fix; `npx vitest run src/ui` three times, 360 passed each; typecheck, `tsc6`, lint and `lint:deps` exit 0.

ocr review of `2cd48ab`: ocr selected nothing (test file and tdd log excluded). The reviewing agent read the test diff instead: each `vi.waitFor` wraps real `expect`s with the default 1000 ms timeout, neither condition holds before the focus chain finishes, and no assertion was weakened. No findings. Raw output: [ocr/T5R.10-B4-2cd48ab.json](ocr/T5R.10-B4-2cd48ab.json).

Every ocr finding on T5R.10 is worked (B1–B4). T5R.10 closes after T5R.10-H1 to H3 and a cumulative run (decision 65).

## T5R.10-H1 Browser card helpers (decision 65)

Commit `cd4b963`. `tdd.sh` runs Vitest only, so the Playwright rows were logged by hand. Naive stubs of the new exports (no clicking) came first, so each red is an assertion or timeout, not an import error:

| Case | Red |
|---|---|
| open ABC's collapsed card on Marks, Monday row Missing | `toContainText` "Missing": element not found |
| XYZ's Action form reached again, typed Intent unchanged | timeout (the stub's form hidden behind Marks) |
| refusal names XYZ's and ABC's cards, XYZ keeps its draft | Playwright's `toHaveAttribute` timeout text, not matching /XYZ/ |
| previous release's Marks family row (dist-releases/d4) | `toBeVisible` timeout on "Review XYZ" |

No first-run passes. `npx playwright test e2e/d4/card-helpers.spec.ts` 4 passed. `npm run test:e2e`: 148 passed, 11 failed (before: 136 and 19). All 11 are among the 19 known panel failures (acknowledge:6, correct-mark:6, gaps:9, d4 no-save:38, responsive-a11y:121 and :256, runtime-failure:11, due-timing:7, kill-offline:9, review-debt:35 and :78); nothing that passed before fails. typecheck, `tsc6`, lint, `lint:deps`, `build:faults` and `build:releases` exit 0.

Notes for H2 and H3:
- **Rule 2's signal** exists in the app: the open card's status "Save or discard what you entered for XYZ to leave it." (A156). `reachCard` presses the header, waits for opened or that message, and throws naming both cards. No app change.
- **Rule 5:** without cards, `reachCard` goes through Continue to Trades and "Review SYM"; `reachPanel('Marks')` returns the Marks family, the other panels the Trade card.
- **The carried ocr finding** is fixed: `enterMark` and `acknowledgeMark` reach the Marks panel through `markRow`.
- **Transitional shapes.** D5's synchronous `reflectionsOf` stays and shadows D4's async one for the D5 specs (about 20 synchronous call sites); H3 moves them and deletes it. `saveAction`, `answerDebt` and `declineDebt` take an optional trailing symbol; H2 and H3 pass it, then make it required. `tradeCard` moved to D4's support. The old private panel locator is now `anyPanelHeader`, still used by `openPanel` and `showPanel`.
- **Not mutation-checked:** case 2's `aria-expanded` idempotency check and its "no Save or discard message" assertion (each case had a genuine red against the stubs).

### ocr review of `cd4b963`

Two files reviewed, one finding; the reviewing agent also read the diff against section 6.4's five rules (1, 3, 4 and 5 hold; one Doubtful point under rule 2). Raw output: [ocr/T5R.10-H1-cd4b963.json](ocr/T5R.10-H1-cd4b963.json).

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| medium | `e2e/d4/support.ts:210` | `cardHeader` puts the symbol into a regex unescaped, and `\b` lets `BRK` match `BRK.B`, so reaching one of two such Trades hits a strict-mode error. | Valid if a symbol can hold a dot; nothing fails today. Bug task **T5R.10-H1-B1** (first check whether the app accepts such symbols). |
| (rule 2) | `reachCard` | The A156 hold message is matched by text only; a stale message left on the page could make a later slow open report a refusal early. | Doubtful: whether the app clears the message wasn't checked. Bug task **T5R.10-H1-B2**. |

#### T5R.10-H1-B1 A symbol is matched exactly

Case: it should reach BRK's card, not BRK.B's, when both Trades are listed. If the app's symbol rules can't produce such a pair, record that the defect is unreachable and leave the helper as it is.

#### T5R.10-H1-B2 A refusal is reported only for this press

Case: it should reach ABC's card after an earlier refusal once XYZ's draft is discarded, though the earlier hold message was shown.

Done in commit `24bbc5d` (T5R.10-H1-B1): the app accepts a dot in a symbol (`src/domain/trade-analysis/plan.ts:77`, `/^[A-Z][A-Z0-9.]{0,9}$/`; the same pattern in `form-issues.tsx:71` and `market-data.ts:316`); no other regex special is accepted. The case creates BRK.B and BRK, reaches BRK, and checks BRK expanded and BRK.B collapsed. Red: `strict mode violation: getByRole('button', { name: /^Review BRK\b/ }) resolved to 2 elements`. `cardHeader` now escapes the symbol and anchors on whitespace or the end; green, card-helpers 5 of 5. typecheck, `tsc6`, lint and `lint:deps` exit 0. The old `openCard` (`support.ts:183`) has the same pattern; it's among the exports H2 and H3 retire, so no separate task. **Process note:** one empty `python3 -` here-doc (no-op).

ocr review of `24bbc5d`: one file reviewed (spec and log excluded), no findings. The reviewing agent checked the escape covers every regex special outside a class, and that the anchor matches the real header ("Review", the underlying, then a space, per `ReviewCard.tsx`). It noted a similar unescaped header pattern in the unit test `ReviewCard.test.tsx:128`, whose symbols hold no dot; not a defect today. Raw output: [ocr/T5R.10-H1-B1-24bbc5d.json](ocr/T5R.10-H1-B1-24bbc5d.json).

Done in commit `230dbe7` (T5R.10-H1-B2, test only): the finding can't occur through the app. The case passed on its first run (flagged): `onEntryDirty` in `src/ui/screens/ReviewView.tsx:302` calls `setRefused(false)` once no entry is held, so a discard clears the hold message. Mutation: a helper that reports any earlier refusal ahead of the opened check fails the case (`1 failed`); a variant checked after the opened check still passes, because the header does open. So the case guards against a helper reporting a stale refusal, not the stale-message-plus-slow-open race, which the app can't set up. `reachCard` is unchanged. The spec passed 6 of 6, five times over; typecheck, `tsc6`, lint and `lint:deps` exit 0.

ocr review of `230dbe7`: ocr selected nothing (spec and log excluded). The reviewing agent read the test: the refusal really happens first (the reach rejects naming XYZ, and the hold status shows), and ABC really opens after the draft is cleared (`aria-expanded="true"`). No findings. Raw output: [ocr/T5R.10-H1-B2-230dbe7.json](ocr/T5R.10-H1-B2-230dbe7.json). The working tree held a leftover from the agent's mutation restore (one lost line break in `support.ts`, behavior unchanged); the main session discarded it with `git restore`.

T5R.10-H1's ocr findings are worked (H1-B1, H1-B2). T5R.10-H2 is next.

## T5R.10-H2 D4 browser specs on the card helpers

Commit `59f037b`: the 11 D4 specs moved onto the helpers. `build:faults` and `build:releases` exit 0; `npx playwright test e2e/d4 --project=chromium` 24 passed (the first run had 2 failures, fixed below); typecheck, `tsc6`, lint and `lint:deps` exit 0. **Expect-diff** (`git diff -U0` of `e2e/d4/*.spec.ts`): every changed `expect` keeps its matcher and expected value; only locators changed. One `expect` was added, not changed (below).

Beyond renames (reach calls added, within the migration rule):
- `runtime-failure.spec.ts`, B4.10: `reachPanel(…, 'Action')` before the "Saved Action" and "No Action saved." checks, which sit in the Action panel.
- `responsive-a11y.spec.ts`, the keyboard-only case: after Save Marks the card moves on to the Action panel (A157), so the later "Manual" row check read a hidden panel. Added: a raw `expect(panelHeader(page,'XYZ','Action')).toHaveAttribute('aria-expanded','true')`, a navigation assertion, then `reachPanel(…, 'Marks')` before the "Manual" check and `reachPanel(…, 'Action')` after it. Those two reaches press panel headers with the mouse inside a keyboard-only case, which section 6.4's rule 4 says keeps explicit steps. Bug task **T5R.10-H2-B1**.
- B4.12 switches between the Marks and Action panels through `markRow` and `actionFormOf`; the typed correction survives; expectations unchanged.

Retire list (section 6.4) against what H2 still needs:
- `review.spec.ts` keeps `marksFamily` for B4.1's "first card open on its Marks", a navigation assertion made before any reach (rule 4).
- `update.spec.ts` keeps `tradesFamily` for its read of the old release's Trades section (rule 5).
Section 6.4 lists both as retired. The session asks the user before H3 retires the rest.

Other: `offline.spec.ts`'s local `markFor` is replaced by `markRow`. The old exports stay for D5 until H3. **Process note:** one no-op `python3 -` here-doc.

#### T5R.10-H2-B1 The keyboard-only case reaches panels with the keyboard

In `responsive-a11y.spec.ts`'s keyboard-only case, replace the two mouse reaches with the keyboard on the raw panel headers (focus the header, press Enter, check `aria-expanded`), keeping every expectation.

### ocr review of `59f037b`

ocr selected nothing (all 12 files excluded). The reviewing agent read the diff: every `expect` keeps its matcher and value; no navigation or focus check is made trivial by a reach; absent checks run with the right panel open; B4.12 still types its correction and Action and never saves. Raw output: [ocr/T5R.10-H2-59f037b.json](ocr/T5R.10-H2-59f037b.json).

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| medium | `responsive-a11y.spec.ts`, keyboard-only case | Mouse reaches in a keyboard-only case. | Known: bug task T5R.10-H2-B1, running. |
| low | same case | An added `aria-expanded` assertion breaks "mechanical only". | Dismissed: already recorded above; a navigation check rule 4 allows, weakening nothing. |
| low | `review.spec.ts` (relaunch loop), `kill.spec.ts` (resume) | "Saved Action" is read after `reachCard` only, so it relies on the card opening on its Action panel. | Doubtful: true, and that is navigation the helper should own (section 6.4); `runtime-failure.spec.ts` reaches the Action panel first. Bug task **T5R.10-H2-B2**. |
| low | `no-save.spec.ts` | Nothing in the diff shows typed values survive the panel switch. | Dismissed: B4.12 passed in H2's run, and its existing expectations read the typed values back after the switch. |
| trivial | `responsive-a11y.spec.ts` import line | A missing space after a comma. | Valid; folded into H2-B1 (same file). |

#### T5R.10-H2-B2 "Saved Action" is read through the Action panel

In `review.spec.ts`'s relaunch loop and `kill.spec.ts`'s resume step, reach XYZ's Action panel (`reachPanel(…, 'Action')`) before reading the "Saved Action" region, keeping every expectation.

Done in commit `4f27dcb` (T5R.10-H2-B1, structural): the keyboard-only case reaches the Marks panel with its existing `shiftTabTo` (which also checks the focus ring) and Enter, and the Action panel with `tabTo` and Enter, each followed by an `aria-expanded` check; the "Manual" check is unchanged, and the import spacing is fixed. The keyboard opens both panel headers, so there's no app accessibility defect. `responsive-a11y.spec.ts` passed 5 of 5, four times; typecheck, `tsc6`, lint and `lint:deps` exit 0.

ocr review of `4f27dcb`: ocr selected nothing (spec excluded). The reviewing agent read the whole case: no clicks or reaches remain between entering the Review and the completion check; every `expect` keeps its matcher and value; the focus walk (tab to Save, Shift+Tab back to the card header with a focus ring at each stop) covers the same stretch. No findings. (`reachPanel` stays imported for another case in the file, at line 139; lint passes.) Raw output: [ocr/T5R.10-H2-B1-4f27dcb.json](ocr/T5R.10-H2-B1-4f27dcb.json).

Done in commit `2cbe809` (T5R.10-H2-B2, structural): `review.spec.ts`'s relaunch loop and `kill.spec.ts`'s resume step reach the Action panel before reading "Saved Action". The sweep found one more: `gaps.spec.ts` checked the earlier-sessions group's count 0 after `reachCard` only, which would pass with the Marks panel closed; it now reaches the Marks panel first. Every `expect` unchanged. The sweep left `gaps.spec.ts`'s first earlier-sessions read (about line 19) alone: it's page-level with no reach before it, relying on the only card opening on its Marks panel. `npx playwright test e2e/d4` 24 passed; typecheck, `tsc6`, lint and `lint:deps` exit 0.

ocr review of `2cbe809`: ocr selected nothing (three specs excluded). The reviewing agent read the diff: every `expect` unchanged, each read now has its panel open. Raw output: [ocr/T5R.10-H2-B2-2cbe809.json](ocr/T5R.10-H2-B2-2cbe809.json).

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| low | `gaps.spec.ts:19-22` | The first earlier-sessions read has no reach before it; it passes only because MNO's card opens on its Marks panel (A151), and its `not.toContainText` checks would pass with the panel closed. | Valid: a content read inside the Marks panel (`CardMarks.tsx:410`), not a rule 4 navigation check. Bug task **T5R.10-H2-B3**. |

#### T5R.10-H2-B3 The first earlier-sessions read reaches the Marks panel

In `gaps.spec.ts`, reach MNO's Marks panel before the first earlier-sessions read (lines 19–22), keeping every expectation.

Done in commit `cf007eb` (T5R.10-H2-B3, structural): `reachPanel(page, 'MNO', 'Marks')` right after `openReview`, before the first earlier-sessions reads; every `expect` unchanged. `gaps.spec.ts` passed; typecheck, `tsc6`, lint and `lint:deps` exit 0.

ocr review of `cf007eb`: ocr selected nothing (spec excluded). The reviewing agent read the diff: one added reach before all three reads; every `expect` unchanged. One nit: a stray dropped space (`const earlier =page…`), no behavior change; folded into T5R.10-H3's brief. Raw output: [ocr/T5R.10-H2-B3-cf007eb.json](ocr/T5R.10-H2-B3-cf007eb.json).

T5R.10-H2's ocr findings are worked (H2-B1 to B3). T5R.10-H3 is next.

## T5R.10-H3 D5 browser specs on the card helpers

Commit `0a21dc4`: the eight D5 specs moved onto the helpers, and the transitional shapes removed. `build:faults` and `build:releases` exit 0; `npx playwright test e2e/d4` 24 passed; `e2e/d5` 12 passed, 1 failed; `npm run test:e2e` 160 passed, 1 failed. The failure is B5.7 (`kill-offline.spec.ts`), blocked rather than shown broken: two headless Chrome processes left from earlier B5.7 runs in this worktree (pids 35798 and 68015, started 16:01 and 17:48, profiles under `test-results/d5-kill-offline-B5-7-…`) still listen on B5.7's fixed ports 9341 and 9342 (confirmed by `lsof`). One run failed with `net::ERR_ABORTED` on the first `goto`; the next timed out in the kill step after `answerDebt` had passed. The task agent's `pkill` was refused by the permission classifier; the main session didn't work around it and asked the user. typecheck, `tsc6`, lint and `lint:deps` exit 0.

**Expect-diff** of `e2e/d5/*.spec.ts`: every changed `expect` keeps its matcher and value; none added.

**Support changes:** removed `continueToTrades`, `openCard`, `markEntry`, `actionForm`, `markAndOpenCard`, the click-rewriting proxy and D5's synchronous `reflectionsOf`; `tradesFamily` is a plain raw locator (decision 66); `reachOldCard` presses Continue to Trades only when the Trades list isn't shown; `saveAction` requires the symbol; the `gaps.spec.ts` space is restored. Left in place, unused: `openPanel`, `showPanel`, `anyPanelHeader`.

Decisions for review:
- `answerDebt(page, symbol | undefined)` and `declineDebt(page, reason, symbol | undefined)` take `undefined` for the three cases that answer on Trade Detail, which has no card (detail-debt, B5.8, responsive); `debtForm(page)` and `fillDebtAnswers` stay for those steps.
- `answerDebt` and `declineDebt` now wait for the form to hide, then reach the Reflections panel again before reading "Saved reflection", because the save moves the card on to its Action panel (A157). A helper change, not a spec change; without it B5.1 and B5.7 failed.

### ocr review of `0a21dc4`

ocr reviewed the two support files (ten specs excluded) and raised nothing. The reviewing agent read the whole diff: no `expect` changed; every content read and absent check goes through a helper that opens its panel; `tradesFamily` is a plain raw locator; no mouse reach in a keyboard step; removed exports have no callers; `answerDebt`/`declineDebt` can't hide a failed save (a refused save leaves the form visible, so `toBeHidden` fails). Raw output: [ocr/T5R.10-H3-0a21dc4.json](ocr/T5R.10-H3-0a21dc4.json).

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| low | `e2e/d5/faults.spec.ts:39-40` | `actionFormOf` opens the Action panel, so the page-wide "no Save" check on line 40 may run with Reflections collapsed. | Doubtful: Answer and Decline are still checked with Reflections open. Bug task **T5R.10-H3-B1**. |

#### T5R.10-H3-B1 The read-only absent checks cover both panels

In `faults.spec.ts`, order the read-only checks so the page-wide "no Save" check runs once with the Action panel open and once with the Reflections panel open (reorder or repeat the existing `expect`, matcher and value unchanged).

Done in commit `a0e8b63` (T5R.10-H3-B1, structural): one identical "no Save" `expect` added right after the Answer and Decline absent checks, with the Reflections panel open; the original stays after `actionFormOf`, with the Action panel open. No other `expect` touched. `faults.spec.ts` 2 passed; typecheck, `tsc6`, lint and `lint:deps` exit 0. Not shown failing against a present Save button.

ocr review of `a0e8b63`: ocr selected nothing (spec excluded). The reviewing agent read the diff: one line added, each "no Save" check now runs with its panel open, nothing else changed. No findings. Note: the Reflection form has no "Save" button (its controls are Answer, Decline and Cancel, `DebtForm.tsx:209-223`), so the added check is a page-wide backstop against a stray "Save"; the form's own submit is covered by the existing "no Answer" check. Raw output: [ocr/T5R.10-H3-B1-a0e8b63.json](ocr/T5R.10-H3-B1-a0e8b63.json).

T5R.10-H3's ocr findings are worked (H3-B1).

### Cumulative suite at `29174a9` (T5R.10 closed)

| Suite | Result |
|---|---|
| Unit | 74 files, 956 passed |
| Integration | 53 files, 105 passed |
| Browser | 161 passed (5.9 min) |
| Checks | 12 of 12 exit 0 |

Outputs: `suite-runs/t5r.10-panels-*.txt`. Ports 5175, 9341 and 9342 had no listeners before or after the run. `29174a9` holds every T5R.10 code change (H3-B1, `a0e8b63`, is its parent's code); later commits are evidence only.

## T5R.11 UI: open-card figures

Commit `b2b5d04`: a `CardFigures` component, rendered from the `getTrade` result after the attention reasons and before the panels.

| Case | Red |
|---|---|
| T-A at XYZ 52.00: the four figures in dollars and R, Reward : risk now 0.89 and planned 2.4, then At entry | the stub rendered nothing ("Current Marked Trade P&L" not found) |
| non-Values in words, never 0 (T-C "Mark missing: DEF, Mon Oct 12"; T-B Reward : risk "Not applicable") | first-run pass, mutation-checked: rendering "0" for a non-Value fails `expected '0' to be 'Mark missing: DEF, Mon Oct 12'` |
| the dated last-close group beside the figures when the Mark is missing | first-run pass (existing D4 code moved into `CardFigures`), mutation-checked: forcing the group off fails on the "Fri Oct 9 close" group |

Notes:
- **Labels** keep the app's existing terms ("Current Marked Trade P&L", "Ongoing Risk to Stop", "Worst-Case Ongoing Risk", "Incremental Reward to Target"), which existing tests read; the plan's names are shorthand. New terms: "Reward : risk now" and "Reward : risk planned".
- **Order** now follows A158: figures, Reward : risk, At entry, then the dated last close (before, the dated group came before At entry); no test depended on it.
- **Fixtures:** the evaluation builders in `ReviewCard.test.tsx`, `ReviewCards.test.tsx` and `CardMarks.test.tsx` lacked `rewardRiskNow` and `planBaseline`, which the real `getTrade` always returns; 61 unit tests failed until both were added. Fixture-only; no expectation changed.

Checks: typecheck, `tsc6`, lint and `lint:deps` exit 0; `npx vitest run src/ui` 24 files, 363 passed; `build:faults` and `build:releases` exit 0; `npm run test:e2e` 161 passed; ports 5175, 9341 and 9342 clear before and after. No e2e spec changed.

ocr review of `b2b5d04`: two files reviewed (`CardFigures.tsx`, `ReviewCard.tsx`; five test and log files excluded), no findings. Raw output: [ocr/T5R.11-b2b5d04.json](ocr/T5R.11-b2b5d04.json).

### Cumulative suite at `ce741bc` (T5R.11 closed)

| Suite | Result |
|---|---|
| Unit | 75 files, 959 passed |
| Integration | 53 files, 105 passed |
| Browser | 161 passed (5.8 min) |
| Checks | 12 of 12 exit 0 |

Outputs: `suite-runs/t5r.11-figures-*.txt`. Ports 5175, 9341 and 9342 clear before and after.

## T5R.12 UI: links, blockers, and next step

Commit `676775c`. All in `ReviewCards.test.tsx`:

| Case | Red |
|---|---|
| `?instrument=XYZ` opens the first card holding XYZ (T-F) on Marks, focus in XYZ's row | no "XYZ review" region |
| `?trade=t-e` opens T-E's card on its first panel not done (Action) | no "JKL review" region |
| header: blockers Missing Marks first, each opening its card and panel | blocker order wrong, with `marksFirst` made the identity |
| extra (carried item 1): an Action save while the card holds a Mark draft stays on the card | no `role="status"`, with the hold check forced off |

**Process note: code ahead of red.** After case 1's green, the code for the other three was already written; each was broken in place for a genuine red, then restored (flagged). A first header red also exposed a wrong fixture string, fixed before the red was repeated. A further mutation (a blocker link opening the card with no panel or Instrument) fails the header case. No first-run passes.

Carried items:
1. **An Action save while the card holds other entered values** stays on the card, applies the returned completion and binding, re-reads the card so the Action shows saved, and says "The Action is saved. Save or discard what you entered for XYZ to go on." (A156), for every next-step kind.
2. **`?instrument=` and `?trade=`** take effect once, on load (`useSearchParams`).
3. **MarksSaved `nextStep`** stays unused: under A157 the open card stays open and moves to its next panel; P36's "Missing Marks first" is served by the blockers list.

Notes: blocker links are real anchors (`/review?trade=…`) with the click intercepted; Mark blockers open the card on Marks with focus on the row, Action and Reflection blockers their panels; integrity and replay blockers stay plain text. A link switches panels on the open card even while it holds drafts; opening another card is still refused (A156). `ReviewCardProps` gains a required `go`; `Status` takes `openCard`; `ReviewView` needs a router context (every test already wraps it in `MemoryRouter`).

Checks: typecheck, `tsc6`, lint and `lint:deps` exit 0; `npx vitest run src/ui` 24 files, 367 passed; `build:faults` and `build:releases` exit 0; `npm run test:e2e` 161 passed; ports clear before and after. No browser spec changed.

**Open for the user:** an Action save whose next step is a Mark (`kind: 'Mark'`) still collapses the card and says "A Mark is needed before the next Trade. It is listed in its card." — D4-era behavior that `ReviewCard.test.tsx` asserts.

**The user's decision (2026-10-31):** an Action save whose next step is a Mark collapses this card and opens the card holding that Mark on its Marks panel, focus in the row, as a Mark blocker link does (P36; T5R.10's case "after an Action save open the card the result names as the next step"). The `ReviewCard.test.tsx` expectation of the D4 message changes to match. Bug task T5R.12-B3.

ocr review of `676775c`: two files reviewed. Raw output: [ocr/T5R.12-676775c.json](ocr/T5R.12-676775c.json).

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| medium | `ReviewView.tsx:40` | `CardLink` always calls `preventDefault`, blocking Ctrl/Cmd-click and middle-click new-tab opens; its `href` (`/review?trade=<id>`) drops the Instrument. | Valid: bug task T5R.12-B1. |
| medium | `ReviewView.tsx:240` | `?instrument=` and `?trade=` are read only in a `useState` initializer, so a later search-param change on the mounted screen is ignored. | Doubtful (the brief said "once on load"; links from other screens remount): bug task T5R.12-B2. |

### T5R.12-B1 Card links open in a new tab with their target

A modified click (Ctrl, Cmd, Shift, middle button) on a blocker link is left to the browser, and the `href` carries the Instrument when the link has one (`/review?trade=<id>&instrument=<key>`), so a new tab lands on the same card, panel and row.

Record. All in `ReviewCards.test.tsx`:

| Case | Red |
|---|---|
| a Mark blocker link's `href` carries the Instrument; Action and Reflection links only the Trade | `expected '/review?trade=t-c' to be '/review?trade=t-c&instrument=DEF'` |
| `?trade=t-a&instrument=XYZ` opens T-A (not T-F, the first holder), Marks panel, focus in XYZ's row | expanded flags `[…'true'…]` at T-F, not T-A |
| a click with ctrlKey is left to the browser, card unchanged | `expected false to be true` (default prevented) |
| a click with the middle button is left to the browser | `expected false to be true` |
| metaKey, shiftKey (flagged first-run passes) | mutation: dropping each from the guard fails its case with `expected false to be true` |
| a plain left click still opens the card in place (flagged first-run pass) | mutation: removing `preventDefault` fails with `expected true to be false` |

The load path now lets `?trade=` pick the card, and `?instrument=` pick the Marks row when that card holds the Instrument; `?instrument=` alone still picks the first holder. The `href` Instrument is URL-encoded.

Checks: typecheck, `tsc6`, lint and `lint:deps` exit 0; `npx vitest run src/ui` 24 files, 374 passed. No browser spec changed.

### T5R.12-B2 Search-param changes on the mounted Review

A change of `?instrument=` or `?trade=` while the Review is mounted opens the named card as on load, subject to the A156 hold.

Record. All in `ReviewCards.test.tsx`, driven by a test-only `NavigateTo` button (`useNavigate`) inside the existing `MemoryRouter` (`renderReview` takes `navigateTo`):

| Case | Red |
|---|---|
| a changed `?trade=t-e` opens JKL's card on its Action panel, as on load, when nothing is held | `Unable to find role="region" and name "JKL review"` |
| a changed param naming another card, with the open card holding an Action value, keeps it open and shows "Save or discard what you entered for ABC to leave it." | `Unable to find an element with the text: Save or discard what you entered for ABC to leave it.` |
| a changed `?trade=t-b&panel=Reflections` on the held open ABC card switches to Reflections | `expected [ 'false', 'false', 'true' ] to deeply equal [ 'false', 'true', 'false' ]` |

The load-path resolution is now `linkedCard(review, params)`, used for the initial state and for the change. An effect compares `params.toString()` with the last applied search string (a ref), so only a real change acts; it resolves against the newest Review (`latest.current`) and calls the same `openCard` a link click uses, so the A156 refusal and the panel switch on the open card are the existing paths. A change naming no card in the Review does nothing. No first-run passes.

Checks: typecheck, `tsc6`, lint and `lint:deps` exit 0; `npx vitest run src/ui` 24 files, 379 passed. No browser spec changed.

### T5R.12-B3 An Action save whose next step is a Mark opens that card on Marks

Per the user's decision above, when nothing else is held on the card (carried item 1 still governs a held card).

Record. Four new cases in `ReviewCards.test.tsx` (describe "Action save whose next step is a Mark"), one table row changed in `ReviewCard.test.tsx`:

| Case | Result |
|---|---|
| an Action save on ABC whose next step is a Missing Mark of DEF (`trades: ['t-c']`) collapses ABC, opens DEF on Marks, focus in the row, no status message | red: `Unable to find role="region" and name "DEF review"` |
| the first card in the Review's order whose Trade is in `row.trades` opens (`['t-e','t-a']` opens T-A) | first-run pass (flagged); mutation: `find` to `findLast` in the lookup fails with `Unable to find role="region" and name "XYZ review"` |
| no row Trade in the Review: the old message "A Mark is needed before the next Trade. It is listed in its card." and a collapsed card | first-run pass (flagged); mutation: the lookup matching every Trade fails with `Unable to find role="status"` |
| a card holding a Mark draft stays and says "Save or discard what you entered for DEF" when the next step is a Mark (carried item 1 had only a Trade next step) | first-run pass (flagged); mutation: the hold check skipped for a Mark next step fails with `Unable to find role="status"` |

Changed in `ReviewCard.test.tsx` ("After a save", the outcomes table): removed the row whose next step was a Mark of `t1` with the message "A Mark is needed before the next Trade…". Why: `t1` is in that Review, so the user's decision now opens its card instead (red: `expected 'Loading the Trade…' to be 'A Mark is needed…'`); the table is about the messages that follow a save with no card to go to, and the Mark landing is covered at the `ReviewView` level. The message itself is still used (and asserted in `ReviewCards.test.tsx`) as the fallback when no row Trade is in the Review, so `AFTER_SAVE.Mark` stays.

Implementation (`ReviewView.tsx`, `saved`): for a `Mark` next step, the first walked Trade (current Review order) in `row.trades` is shown on Marks with the row's Instrument, revealed, and read. The three state updates and `show` are wrapped in `flushSync` before the read: unwrapped, the read's result batched into the same render as the reveal, and the card's header focus (parent effect, after the body's) took focus from the row.

Grep `grep -rn "Mark is needed before the next Trade" e2e src`: `src/ui/screens/ReviewCards.test.tsx:781` (the fallback case) and `src/ui/screens/ReviewView.tsx:159` (`AFTER_SAVE.Mark`); nothing in `e2e`.

Checks: typecheck, `tsc6`, lint and `lint:deps` exit 0; `npx vitest run src/ui` 24 files, 383 passed. No e2e file touched, no browser run.

ocr review of `da270ff` (T5R.12-B1): one file reviewed (three excluded); one round hit a provider 504, so coverage may be thinner. Raw output: [ocr/T5R.12-B1-da270ff.json](ocr/T5R.12-B1-da270ff.json).

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| medium | `ReviewView.tsx:40` | The new-tab `href` omits the panel, so a modified click on an Action or Reflection blocker opens the card's first panel not done, not the panel a plain click opens. | Valid: bug task T5R.12-B1-B1. |

### T5R.12-B1-B1 Card links carry their panel

An Action or Reflection blocker's `href` names its panel (`&panel=<name>`), and the load path opens that panel, so a new tab matches a plain click.

Record. All in `ReviewCards.test.tsx`:

| Case | Red |
|---|---|
| Action and Reflection blocker links carry `&panel=Action` / `&panel=Reflections` (Mark links keep `&instrument=`) | `expected '/review?trade=t-b' to be '/review?trade=t-b&panel=Action'` |
| `?trade=t-e&panel=Marks` opens T-E on Marks, not its first panel not done (Action) | `expected [ 'false', 'false', 'true' ] to deeply equal [ 'true', 'false', 'false' ]` |
| an unknown `panel` value is ignored (flagged first-run pass) | mutation: the param cast to `PanelName` unchecked fails with `expected [ 'false', 'false', 'false' ] to deeply equal [ 'false', 'false', 'true' ]` |

The `?instrument=` match still wins over `panel` (Marks). Checks: typecheck, `tsc6`, lint and `lint:deps` exit 0; `npx vitest run src/ui` 24 files, 376 passed. No browser spec changed.

ocr review of `f358e11` (T5R.12-B1-B1): one file reviewed (three excluded). Raw output: [ocr/T5R.12-B1-B1-f358e11.json](ocr/T5R.12-B1-B1-f358e11.json).

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| low | `ReviewView.tsx:40` | `CardLink`'s `href` nests a ternary (instrument, then panel, then nothing) inside a template literal; compute the query before the JSX. | Valid (readability only; behavior correct): bug task T5R.12-B1-B1-B1. |

### T5R.12-B1-B1-B1 CardLink's query computed before the JSX

Structural: the `href` query is built in a plain statement before the JSX, same output. Verified by the existing `ReviewCards.test.tsx` cases staying green.

Record. `CardLink` now builds `href` with `let href = ...; if (instrument !== undefined) href += '&instrument=' + encodeURIComponent(...); else if (panel !== undefined) href += '&panel=...'` (no `URLSearchParams`, so the encoding is unchanged).

| Command | Result |
|---|---|
| `npx vitest run src/ui/screens/ReviewCards.test.tsx` (before) | exit 0, 25 passed |
| `npx vitest run src/ui/screens/ReviewCards.test.tsx` (after) | exit 0, 25 passed |
| `npx vitest run src/ui` | exit 0, 24 files, 376 passed |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | each exit 0 |

ocr review of `9f92e17` (T5R.12-B1-B1-B1): one file reviewed, no findings. Raw output: [ocr/T5R.12-B1-B1-B1-9f92e17.json](ocr/T5R.12-B1-B1-B1-9f92e17.json). T5R.12-B1's chain is closed.

ocr review of `899c795` (T5R.12-B2): one file reviewed (tests and evidence excluded), no findings. Raw output: [ocr/T5R.12-B2-899c795.json](ocr/T5R.12-B2-899c795.json).

**Process note (T5R.12-B3):** the subagent ran one no-op here-string (`cat >/dev/null <<< ""`), against the Edit-only rule; no file changed. Three of its four cases were first-run passes, each mutation-checked and flagged in its record. It wraps the Mark landing in `flushSync` so the row keeps focus over the card header's focus effect.

ocr review of `6561fe5` (T5R.12-B3): one file reviewed (four excluded), no findings. The reviewing agent read the `saved` handler: the hold returns first, `find` over `walkedTrades` gives the first card in Review order, and the `flushSync` (outside render and effects) commits the reveal before the read, so the row keeps focus. Raw output: [ocr/T5R.12-B3-6561fe5.json](ocr/T5R.12-B3-6561fe5.json). T5R.12's ocr findings are worked (B1, B1-B1, B1-B1-B1, B2, B3).

### Cumulative suite at `3f0a259` (T5R.12 closed)

| Suite | Result |
|---|---|
| Unit | 75 files, 979 passed |
| Integration | 53 files, 105 passed |
| Browser | 161 passed (5.9 min) |
| Checks | 12 of 12 exit 0 |

Outputs: `suite-runs/t5r.12-links-*.txt` (renamed from a double-hyphen prefix that my brief caused). Ports 5175, 9341 and 9342 clear before and after. `3f0a259` holds every T5R.12 code change (B3, `6561fe5`, is the last); later commits are evidence only.

## T5R.13 Query count and latency

Test: `tests/integration/d5r/query-count.test.ts` (`npm run test:integration -- d5r/query-count`; the integration project already includes `tests/integration/**`). The request counter (`tests/support/request-counter.ts`) gained an opt-in `transactions` option that also logs each transaction (its stores and mode), default off, so D1-D5 counts are unchanged; it is how a snapshot and a commit are told apart. The data is D5's stack (100 sessions, four Trades, ten settled Debts and one Outstanding Debt), with the Missing Instrument also lacking its three sessions before the Review date, so a gap group and a Placed range position are in the Review.

**Cases** (three, all first-run passes since T5R.2-T5R.6 built the behavior; each mutation-checked, rows in `tdd-log.md`):

| Case | Asserts | Mutation | First failure line |
|---|---|---|---|
| should issue D5 counts for a Review open, with the range position and the gap Trades adding no request | the same request lists as T5.22's first case (Trades getAll of 201, one observations getAll, one cursor per Missing Instrument, one getAll per Instrument, one obligations getAll, one byOutstandingDue getAll); a Placed range position and the Missing Instrument's gap group are present | an extra `eligibleRecords(cutoff)` call in `assemble` | `expected [ { on: 'index', …(4) }, …(7) ] to deeply equal [ { on: 'index', …(4) }, …(6) ]` |
| should save 1 Marks in one read-only snapshot and one read-write commit, then assemble as a Trade Action save does | one read-only transaction on observations before the commit with 1 get; the commit with 1 get (check) and 1 put; the transactions after the commit equal, request for request, a `SaveTradeAction`'s; none of them a cursor, a `byInstrumentDate` request or a write | a second `marketData.prepareEffects` in `saveReviewMarks`; and `readAfterSave` assembling with gaps | `expected [ { mode: 'readonly', …(3) }, …(1) ] to have a length of 1 but got 2`; `expected [ { on: 'index', …(3) }, …(2) ] to deeply equal []` |
| should save 3 Marks in one read-only snapshot and one read-write commit, then assemble as a Trade Action save does | as above with 3 gets, 3 gets and 3 puts | the same two mutations | the same two lines |

Each mutation was restored and `git diff -- src` was empty afterwards. How the Action comparison was made exact: the Marks save and the Action save run over the same Review state, so the data does not add a difference. The Missing Review-date Mark is filled first (otherwise the Action's next step is that Mark and nothing is read back), the Action is saved on the Trade that holds the Outstanding Debt so the next Trade it reads back has none (a Debt adds one definition read to a card, as the Marks card has none), and the Marks save follows the Action so the Review holds an Action (its Entry adds a read in both). The Marks entries are the Missing Instrument's earlier sessions, saved from its Trade's card.

**Disclosed:** a Marks save of an `AssertUnavailable` or a `WithdrawAcknowledgment` entry adds one Stale-context read to the snapshot (T5R.1's note); the cases use `RecordInitialManualMark` entries, which add none, so the n record reads are exact for them only.

**Bench** (`npm run bench:run`, alone, exit 0; full results in `evidence/D05R/bench.md`): gated cold p95 101.8 ms (D5: 104.8 ms) and warm p95 44.3 ms (D5: 43.6 ms), against 2,500 and 1,500 ms. Disclosed, not gated, on the cached mature profile (generator 3, not regenerated): open the first card median 1,854.8 ms (10 runs, 1,786.7 to 1,895.4; D5's press on Review to the Review status was 2,342 and 2,225 ms); Save Marks of one card's Marks median 79.8 ms (5 runs, 78.4 to 81.3); Trade Action save median 90.0 ms (5 runs, 86.2 to 90.5). Every Trade already holds an Action on the Review Date in that dataset, so the Action save is an edit of the saved Action (`SaveTradeAction` with its expected revision). Tech debt item 3 is measured, not fixed: the first `open` of a Review is about 1.85 s while both saves are under 100 ms, which is what P38 set out to do. The tool changes are in `tools/bench-run.ts` (the report now goes to `evidence/D05R/bench.md` and D5's `evidence/D05/bench.md` is left as it was). The first bench attempt crashed on a wrong Mark-row selector before writing anything; the second wrote the results above. One lint fix to `bench-run.ts` (an unused parameter) came after the run and changes no measured code.

Ports 5175, 5181, 9341 and 9342: no listener before the first run, none after the second (`lsof -nP -iTCP:5175 -iTCP:5181 -iTCP:9341 -iTCP:9342 -sTCP:LISTEN` exit 1 each time).

| Check | Result |
|---|---|
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | each exit 0 |
| `npm run test:integration -- d5r/query-count` | 3 passed |
| `npm run test:integration` | 54 files, 108 passed |

Process note: one no-op here-string (`cat > /dev/null <<< ""`) was run by mistake against the Edit-only rule; no file changed.

ocr review of `1515243` (T5R.13): two files reviewed (`request-counter.ts`, `bench-run.ts`; the test excluded), no findings. Raw output: [ocr/T5R.13-1515243.json](ocr/T5R.13-1515243.json). The reviewing agent didn't read the code itself, so the orchestrator checked its two questions from the diff:
- **Counter:** the `IDBDatabase.prototype.transaction` wrap logs only while a recording is open and `transactions` is set (reset in `finally`), one entry per call; the store, index and cursor wraps are unchanged, so nothing is double-counted.
- **Bench timings:** each starts at a capture-phase pointer press and ends at the first DOM mutation after which the result holds (card shown with nothing loading; no drafts counted; Action form gone), on the real clock: click to rendered result, as the plan asks.

### Cumulative suite at `3e4e68d` (T5R.13 closed)

| Suite | Result |
|---|---|
| Unit | 75 files, 979 passed |
| Integration | 54 files, 108 passed |
| Browser | 161 passed (6.0 min) |
| Checks | 12 of 12 exit 0 |

Outputs: `suite-runs/t5r.13-perf-*.txt`. Ports 5175, 5181, 9341 and 9342 clear before and after; `bench:run` not part of the run.

## T5R.14 Node integration suite

Tests in `tests/integration/d5r/` (`support.ts` builds the card fixture through facade operations only: `cardApp({ withMarks })`, T-A planned Friday with both Position Changes deferred, T-F a second XYZ Trade, the Monday Marks saved by `MarketData.save` before any Review exists). No test substitute was added (section 6.0). Six cases in nine tests, all first-run passes since T5R.1 to T5R.6 built the behavior; each mutation-checked and restored (`git diff -- src` empty), rows in `tdd-log.md`.

| Case (file) | Proves | Mutation | First failure line |
|---|---|---|---|
| I5R.1 Save Marks together (`save-marks.test.ts`) | results equal the stored records and a fresh `open` after each save; after restart the Review-date rows resolved, XYZ Friday gap gone, T-C `NotPlaced` MissingInput with the `AcknowledgedUnavailable` reason, `CompleteWithUnavailableMarks` once D-1 and five Actions are saved; the dump holds the three records the saves wrote and one acknowledgment | `resolutionRevision + 1` in `SavedMark` | `AssertionError: expected 2 to be 1` |
| I5R.2 Nothing or everything (`nothing-or-everything.test.ts`, three tests) | (a) `Rejected` with every issue at entry 1, field price, dump unchanged; (b) a second `observations` write that the store refuses aborts the transaction (`StorageFailure`), dump unchanged, retry writes four records at revision 1; (c) the second command from the same binding is `Conflict` naming all four keys, dump unchanged, one revision per key | (a) `entryIndex + 1`; (b) one transaction per entry; (c) `conflicts.slice(0, 1)` | `expected [ [ 2, 'price' ] ] to deeply equal [ [ 1, 'price' ] ]`; `expected { kind: 'MarksSaved', …(2) } to deeply equal ObjectContaining{…}`; `expected [ 'ABC' ] to deeply equal [ 'ABC', 'DEF', 'JKL', 'XYZ' ]` |
| I5R.3 Shared Mark through either card (`shared-mark.test.ts`) | a save from T-F's card returns T-A's and T-F's items placed at 9/17 and 4/7 with Reward : risk 8/9 and 3/4, both cards' frame price 52, no XYZ Mark-missing reason, a fresh `open` equal, one observation record | result lists only the saved-from Trade | `TypeError: Cannot read properties of undefined (reading 'rangePosition')` |
| I5R.4 Range position and baseline end to end (`range-and-baseline.test.ts`) | section 4's table (range positions, Reward : risk now, planned ratios for all five Trades), T-A's baseline 1R 250, planned reward 600, 12/5, after restart | swapped risk and reward in the share; `oneR` from the planned reward | `expected { kind: 'Placed', …(2) } to deeply equal { kind: 'Placed', …(2) }`; baseline assertion at line 37 |
| I5R.5 Gap Trades (`gap-trades.test.ts`) | XYZ gap group names T-F from Monday and T-A from Friday; the Review completes (`CompleteWithUnavailableMarks`) with the Friday gap still listed | every `from` set to the Review date | `expected [ { tradeId: 'id-0049', …(1) }, …(1) ] to deeply equal […]` |
| I5R.6 Write gate (`write-gate.test.ts`, two tests) | `RuntimeNotWritable` (inventory) from `SaveReviewMarks` (a Mark and an acknowledgment) and from `MarketData.save`, dump unchanged, status `RecoveryOnly`, the Review still opens | guard defeated and the commit-level return removed | `Error: unexpected commit result: RuntimeNotWritable`; `expected { kind: 'Conflict', …(3) } to deeply equal ObjectContaining{…}` |

Interpretations, disclosed:
- **I5R.1:** completion needs ABC and JKL Marks too, so they are saved by `MarketData.save` first; the "three observation records and one acknowledgment" are those the two `SaveReviewMarks` calls wrote (XYZ Monday, XYZ Friday, DEF Monday), found by excluding the two seeded keys.
- **I5R.2 (b):** the fault is the store refusing the second `observations` write (an `add` of the first write's key, a ConstraintError after the first write was accepted), which aborts the transaction and gives `StorageFailure`. A fault thrown synchronously from `put` did not abort: `Persistence.commit` lets the exception out before awaiting `tx.done`, so the first write committed on its own. That fault is not one IndexedDB raises for a plain record, so it is a note, not a defect.
- **I5R.2 (a), (c):** the four entries are on four Instruments (ABC, DEF, JKL, XYZ for Monday) saved from T-A's card; `prepareEffects` does not tie an entry to the card's Instrument.
- **I5R.6:** the mutation guard also refuses before the save. With the guard defeated alone both tests still pass, so the commit-level refusal is shown to hold through the facade; the cases fail only when it is also removed.

| Check | Result |
|---|---|
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | each exit 0 |
| `npm run test:integration` | 60 files, 117 passed (D1, D2, D4, D5 and D5R; was 54 files, 108) |

ocr review of `006f528` (T5R.14): ocr reviewed one file (tests and evidence excluded), no findings; the reviewing agent checked the cases against section 6.1 (all six present; I5R.2 read in full). Raw output: [ocr/T5R.14-006f528.json](ocr/T5R.14-006f528.json). The orchestrator also asked it to assess the task agent's I5R.2(b) note independently:

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| medium | `src/persistence/persistence.ts:386-404` | A synchronous throw from `put`/`add`/`delete` or `keyOf` after the first write leaves the transaction open; it auto-commits the earlier writes, so a partial write set commits and the content revision bump (`:402`) is never issued. | Valid (programmer error only: DataError, DataCloneError or a `keyOf` throw from a malformed record; validated input can't reach it): bug task T5R.14-B1. |

### T5R.14-B1 A synchronous throw during commit aborts the transaction

`Persistence.commit` aborts the transaction when any write (or the meta write) throws synchronously, waits for the abort, and rethrows, so no write of the set is stored.

Record (implemented):
- Test: `src/persistence/persistence.test.ts`, "should store none of the writes and leave the content revision unchanged when a later write throws synchronously". Two writes: a valid `trades` put, then a `catalog` put of `{}` (no key, so the store throws `DataError` synchronously from `put`; a real store error, no spy). Asserts the call rejects with `DataError`, the first record is absent, and the content revision is still 1.
- Contract: async request errors already surface as a rejection (except `ConstraintError`, a result value), so the synchronous path also rejects with the original error.
- Red: `AssertionError: expected { tradeId: 'trade-1', revision: 2 } to be undefined` (the earlier write had auto-committed). Green after wrapping the write loop and the meta write in try/catch that calls `tx.abort()`, awaits `tx.done` (rejection ignored), and rethrows. The async-error path is unchanged. Rows are in `tdd-log.md`.

ocr review of `cc62e88` (T5R.14-B1): one file reviewed, no ocr findings. Raw output: [ocr/T5R.14-B1-cc62e88.json](ocr/T5R.14-B1-cc62e88.json). The reviewing agent's own checks of the orchestrator's two questions:

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| low | `persistence.ts:391-399` | `keyOf` runs after the `add`/`put` request is issued and before its `.catch` is attached; if it throws, the abort rejects that request with no handler (an unhandled rejection). | Valid: bug task T5R.14-B1-B1. |
| low | `persistence.ts:406` | `tx.abort()` in the catch is unguarded and could mask the original error. | Doubtful (no `await` before the catch, so the transaction can't have finished): bug task T5R.14-B1-B2. |

No path was found where an async request error and the synchronous catch both act.

### T5R.14-B1-B1 No unhandled rejection when `keyOf` throws

`keyOf` is computed before the write is issued (or the request's handler attached at once), so a throw leaves no request without a handler.

Record (implemented):
- Test: `src/persistence/persistence.test.ts`, "should reject with the keyOf error, store nothing and leave no unhandled rejection when keyOf throws". A `put` to `trades` with `keyOf` made to throw once; asserts the call rejects with that error, the record is absent, the content revision is still 1, and a `process.on('unhandledRejection')` listener (registered for the test, removed in `finally`) saw nothing after three macrotask ticks.
- Seam: `keyOf` only reads fields (and the store must exist for `tx.objectStore`), so no real record or store makes it throw. The test uses a module-level `vi.mock('./schema.ts')` that wraps the real `keyOf` in `vi.fn` (pass-through) and `mockImplementationOnce` to throw. A spy, not a real input.
- Red: `AssertionError: expected [ Array(1) ] to deeply equal []` (one unhandled AbortError rejection). Green after moving `keyOf` (the `revisions.push`) before the `add`/`put` call. ADR 0011 checks, the async-error path, and the abort-and-rethrow are unchanged. Rows are in `tdd-log.md`.

### T5R.14-B1-B2 The abort in the catch can't mask the original error

`tx.abort()` in the synchronous catch is guarded, as at `persistence.ts:277`, so the original error is always the one rethrown.

Record (implemented):
- Test: `src/persistence/persistence.test.ts`, "should reject with the original write error when the abort in the catch also throws". `keyOf` made to throw once (pass-through mock) and `IDBTransaction.prototype.abort` from fake-indexeddb spied to throw an `InvalidStateError` DOMException, restored in `finally`. Asserts the call rejects with the original `keyOf` error and that abort was attempted. Stored state is not asserted (the faked abort leaves the transaction to auto-commit).
- Red: `AssertionError: expected DOMException{ stack: 'InvalidStateEr…' } to be Error: keyOf failed` (the abort error replaced the original). Green after wrapping `tx.abort()` in the catch in try/catch with a comment. Rows are in `tdd-log.md`.

ocr review of `3ade164` (T5R.14-B1-B1): one file reviewed (three excluded), no findings. The reviewing agent confirmed `keyOf` runs before any request exists, and that the module-level `vi.mock('./schema.ts')` passes through to the real `keyOf` (no mock-reset settings in the config; the file's 22 tests pass). Raw output: [ocr/T5R.14-B1-B1-3ade164.json](ocr/T5R.14-B1-B1-3ade164.json).

ocr review of `a3a2466` (T5R.14-B1-B2): one file reviewed (three excluded), no findings. The reviewing agent judged `await tx.done.catch(() => undefined)` unable to hang (an `abort()` that throws means the transaction already settled) and the swallowed abort error harmless. Raw output: [ocr/T5R.14-B1-B2-a3a2466.json](ocr/T5R.14-B1-B2-a3a2466.json). T5R.14's ocr findings are worked (B1, B1-B1, B1-B2).

### Cumulative suite at `35461dd` (T5R.14 closed)

| Suite | Result |
|---|---|
| Unit | 75 files, 982 passed |
| Integration | 60 files, 117 passed |
| Browser | 161 passed (5.8 min) |
| Checks | 12 of 12 exit 0 |

Outputs: `suite-runs/t5r.14-integration-*.txt`. Ports 5175, 5181, 9341 and 9342 clear before and after. `35461dd` holds every T5R.14 code change (B1-B2, `a3a2466`, is the last); later commits are evidence only.

## T5R.15 Browser suite

Files: `e2e/d5r/support.ts` (re-exports `e2e/d5/support.ts`, so D4's card helpers; adds the card fixture builder through the UI, `tagCards`, and Trade-keyed twins of the card helpers for the two XYZ cards), `review.spec.ts` (B5R.1, B5R.2), `marks.spec.ts` (B5R.3, B5R.4, B5R.5, B5R.8), `sliders.spec.ts` (B5R.6, B5R.7), `durability.spec.ts` (B5R.9, B5R.10), `responsive-a11y.spec.ts` (B5R.11); `package.json`'s `test:e2e` gained `e2e/d5r`. No app code, plan, or existing spec changed; `git diff -- src` is empty.

Decisions and readings, for the main session:
- **T-A and T-F share the Underlying XYZ**, so D4's symbol-qualified helpers (`cardHeader(page, 'XYZ')`, and every helper built on it) match two cards and fail strict mode. `tagCards` marks the two list items once, right after the Review loads, while only T-A owes a reflection (D-1); the mark stays on the item as the cards re-sort. `reachTrade`, `reachTradePanel`, `markRowOf`, `enterMarkOf`, `actionFormOfTrade`, `saveActionOf`, `reflectionsOfTrade`, `debtFormOfTrade`, and `answerDebtOf` take a fixture Trade (`T-A` to `T-F`), follow section 6.4's rules (idempotent, loud on refusal naming both cards, reads never save), and fall back to the D4 helpers for the Trades with their own symbol. Navigation assertions use raw locators (`headerOf`, `panelHeaderOf`, `cardItem`, `sliderOf`).
- **"also held by T-F"** (B5R.3): A153 says the row names the other Trades' Underlyings, so the app shows "also held by XYZ" with a link to `/trades/<T-F's id>`. The case asserts that text and the link, not "T-F".
- **B5R.4 needs a third price.** The card fixture gives T-A two Marks rows (Monday, Friday), but the case types three prices. The case builds the fixture with T-A's first Position Change on Thursday 2026-10-08 (so T-A also holds an earlier Thursday row); nothing else changes. Every other case uses the fixture as defined.
- **B5R.1:** T-B, T-C, and T-E need their own Marks before Complete, so each card's Mark is typed in its card, then its Action saved; the plan's wording names only the first card's Marks.
- **B5R.10** is two tests: Offline (the d5 production release, server closed) and Recovery Only (the faults build, `?faults=control`), since the two need different served builds.
- Kill and relaunch use CDP ports 9341 and 9342 (as D5's kill case); the app is served only on 5175.

| Case | Result | Mutation (key assertion made to fail) and its failing line |
|---|---|---|
| B5R.1 Review end to end on cards | passed | `findLast` for `find` on the card opened on load (`ReviewView.tsx`): `expect(locator).toHaveAttribute(expected) failed`, `review.spec.ts:20`, `Expected: "true"`, `Received: "false"` |
| B5R.2 Opening far down the list | **FAILED against the current app** | no mutation; genuine defect, below |
| B5R.3 Shared Mark | passed | "also held by" line suppressed (`others.length > 5`, `CardMarks.tsx`): `toContainText` failed, `marks.spec.ts:24`, `Received string: "XYZ$52.00 · ManualCorrect"` |
| B5R.4 Invalid price saves nothing | passed | focus sent to a field that does not exist after a Rejected save: `toBeFocused() failed`, `marks.spec.ts:58`, `Received: inactive` |
| B5R.5 Unsaved work holds the card | passed | hold check never true (`held && !held`, `ReviewView.tsx`): `toBeVisible() failed`, `marks.spec.ts:87`, the "Save or discard what you entered for XYZ to leave it." status not found |
| B5R.6 Missing-Mark link | passed | Open list link points at `/review`: `toHaveAttribute failed`, `sliders.spec.ts:20`, DEF's header `Expected: "true"`, `Received: "false"` |
| B5R.7 Slider states | passed | pinned class removed (`StopTargetSlider.tsx`): `toHaveClass failed`, `sliders.spec.ts:57`, `Expected pattern: /slider-pinned/`, `Received string: "slider-now"` |
| B5R.8 Changed evidence | passed | drafts cleared on Conflict (`setDrafts({})`, `CardMarks.tsx`): `toBeVisible() failed`, `marks.spec.ts:119`, the Conflict alert not found |
| B5R.9 Kill after Save Marks | passed | `applyPreparedEffects` stages no write (`market-data.ts`): `toContainText failed`, `durability.spec.ts:34` after the relaunch, `Received string: "MissingPriceCan't get a price"` |
| B5R.10 Offline | passed | same `applyPreparedEffects` mutation: `toContainText failed`, `durability.spec.ts:73`, after the second offline restart |
| B5R.10 Recovery Only | passed | draft fields offered when not writable (`(panel.writable \|\| true)`, `CardMarks.tsx`, faults build): `toHaveCount failed`, `durability.spec.ts:101`, `locator('input, textarea')` `Expected: 0`, `Received: 1` |
| B5R.11 Responsive and accessible | passed | narrow media query of `.review-card-head` changed to `max-width: 100px` (`app.css`): `toBeGreaterThanOrEqual failed`, `responsive-a11y.spec.ts:60`, `Expected: >= 1487.375`, `Received: 1429.375` |

Every mutation was restored and the builds redone; `git diff -- src` is empty. Full rows are in `tdd-log.md`.

### Genuine failure: B5R.2 Opening far down the list

Against the unmodified app, with the card fixture plus 16 routine Trades (21 cards), pressing the 18th card's header opens it, collapses T-A's card, and puts the header in the viewport, but the card's first Price input is below the fold:

`Error: expect(locator).toBeInViewport() failed`, `review.spec.ts:100`, `Locator: ...locator('li.review-card').nth(17).getByLabel('Price').first()`, `Expected: in viewport`, `Received: viewport ratio 0`.

Measured on the same page (viewport 1280 x 900): the header at y 558, the Price input at y 1209, the page scrolled 1737 px. Reading of the cause, from `ReviewCard.tsx` and `ReviewView.tsx` (not changed): the card scrolls itself to the top of the viewport when its header is pressed, at which moment its body is still "Loading the Trade…" and the previous card has just collapsed, so the page is short and the browser clamps the scroll position; the body then loads below the header. The expectation is kept as the plan states it. The remedy is app code (for example scrolling again once the body has loaded), so it is for the main session to schedule as a bug task.

### Whole-suite run

`npm run test:e2e` (all D1, D2, D4, D5, and D5R cases, after `build:faults` and `build:releases`): 172 passed, 1 failed (B5R.2, above), 6.7 min. The 161 earlier browser cases and the other 11 new cases pass. Ports 5175, 9341, and 9342 were clear before the first run and after the last.

Checks: `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, and `npm run lint:deps` exit 0.

**B5R.2 fails against the app** (`review.spec.ts:100`): after opening the 18th card, its header is in the viewport but the first Price input is not (header at y 558, input at y 1209 in 1280×900). Likely cause: the card scrolls into view at the press, while its body is still loading and the previous card has just collapsed. Bug task T5R.15-B1.

**The user's decision (2026-10-31), plan revision 26, decision 67:** "also held by" names the other Trades by their Trade-list summary line (`tradeSummary`), not their Underlying, which repeats the card's own symbol. Gap task T5R.9-B5; it changes B5R.3's "also held by XYZ" expectation and the T5R.9 unit case.

ocr review of `0af0c64` (T5R.15): ocr reviewed `e2e/d5r/support.ts` and `package.json` (specs excluded), no findings. The reviewing agent read `support.ts` against section 6.4's rules (all met; the old-release path is delegated to D4's helpers). Raw output: [ocr/T5R.15-0af0c64.json](ocr/T5R.15-0af0c64.json).

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| low | `e2e/d5r/support.ts` (`tagCards`, `cardItem`) | The `data-trade` tag could go stale or mislabel after re-sorts. | Doubtful (cards are keyed by `tradeId`, so the tag moves with its `<li>`; every remount is followed by a fresh `tagCards`). |
| low | `e2e/d5r/support.ts` (`tagCards`) | Tagging relies on exactly one XYZ card showing "reflection due" at load. | Valid but loud (throws when the precondition fails). |
| low | `e2e/d5r/support.ts` (`reachTrade`, `answerDebtOf`) | The refusal message names only "XYZ", and `answerDebtOf`'s "Saved reflection" check is page-wide, not scoped to the card. | Valid, minor. |

The three are one bug task, T5R.15-B2, since they share one helper and one fix.

### T5R.15-B1 The opened card's first input is in the viewport (B5R.2)

Opening a card far down the list leaves its header and first input in the viewport without scrolling, once its body has loaded.

Fix (`src/ui/screens/ReviewCard.tsx`): the card already scrolled to its top at the press, while its body was "Loading the Trade…" and the page short, so the browser clamped the position. A second effect now scrolls the card to the top (`block: 'start'`) once, the first time its body is shown for a given reveal count; refreshes of the same card do not scroll again, and focus handling is unchanged. Red: B5R.2 failed at `review.spec.ts:100`, `viewport ratio 0`. Green: B5R.2 passes. `e2e/d5r` and `e2e/d4/card-helpers.spec.ts`: 18 passed. `npx vitest run src/ui`: 383 passed. Typecheck, `tsc6`, lint, and `lint:deps` exit 0. No unit case: jsdom has no layout. Whole `npm run test:e2e`: 173 passed, 6.9 min (B5R.6 and the T5R.12 Mark landings pass with `block: 'start'`). Ports 5175, 9341, and 9342 were clear before and after.

### T5R.9-B5 "also held by" names the other Trades by their summary line (decision 67)

The shared Instrument's Marks row now reads "also held by" followed by each other Trade's summary line (`tradeSummary`, e.g. "Long 50 shares @ $50.00"), linked to `/trades/<id>`.

- Coordinator (`daily-review.ts`, `types.ts`): `ReviewTradeItem` gains an optional `summary?: TradeSummary`, set in `reviewItem` from `openLongStockSummary` of the cutoff derivation the Review already holds. No storage request is added (P38). A Trade whose facts cannot be replayed (incoherent) has none.
- UI: `ReviewView` builds `tradeLine(tradeId)` from the walked item's summary with `tradeSummary`; the `underlying` prop of `ReviewCard`, `CardBody`, and `CardMarks` (used only for this row) became `tradeLine`. **Fallback:** when the item has no summary, the line is the Trade's Underlying (then its id), as before.
- Summary text: `tradeSummary` prints the direction as the summary carries it, so Review rows read "Long 50 shares @ $50.00", not "Buy 100 shares" as the brief's example. Open quantity at the average open-lot price (the Trade Detail's open-position summary), not the Plan's.
- Cases: coordinator "should carry each walked Trade summary, the open quantity at its average price (decision 67)" (T-B: 100 @ 30.00); red `expected undefined to deeply equal { kind: 'Stock', …(3) }`. T5R.9 UI case updated per decision 67 (red: `Unable to find an accessible element with the role "link" and name "Long 100 shares @ $50.00"`). B5R.3 (`e2e/d5r/marks.spec.ts`) expects "also held by Long 50 shares @ $50.00" and the link; it was a first-run pass, mutation-checked and flagged in `tdd-log.md`. The "Underlying fallback" has no dedicated case.
- Fixtures: `TF` in `CardMarks.test.tsx` carries a summary (fixture-only). `summary` is optional, so no other `ReviewTradeItem` fixture changed.
- Checks: typecheck, `tsc6`, lint, `lint:deps` exit 0; `npx vitest run src` 985 passed; `npm run test:integration` 117 passed (query-count cases unchanged and green). Whole `npm run test:e2e`: 173 passed, 6.9 min (B5R.3 passes). Ports 5175, 9341, and 9342 were clear before and after.

**Process note (T5R.9-B5):** the subagent ran one stray no-op here-doc `cat >/dev/null` (no file changed), against the Edit-only rule.

### T5R.15-B2 The D5R helpers tell T-A from T-F by Trade, not by load-time state

Tag the two XYZ cards from something that identifies the Trade (e.g. the card's own link to its Trade), so tagging needs no "reflection due" precondition and survives remounts; name the fixture Trade in `reachTrade`'s refusal; scope `answerDebtOf`'s final check to the card.

**First attempt: stopped with no change.** No rendered card carries its Trade id. A collapsed card shows only the Underlying, what remains, the band and the slider, and the card's own links to its Trade appear only in an open card's Marks panel, so nothing in the list tells T-A's card from T-F's. Re-tagging from any other visible state would only move the load-time dependency. **The user's choice (2026-10-31):** put the Trade id in the HTML, as `data-trade-id` on each card's list item, because it works even when two Trades have identical summary lines. The tests take the ids from the Trade list's `/trades/<id>` links, or from the URL right after creating a Trade. **Superseded** by plan revision 27 (decision 68): the card-identity tasks T5R.15-I1 to I6 (breakdown section 6.5). I1 adds the hook. I2 and I3 retire `tagCards` and the Trade twins, absorbing all three findings: there is no tag to go stale and no "reflection due" precondition, the refusal names both cards, and the "Saved reflection" check is scoped to the panel. B2 gets no commit of its own.

ocr review of `ae7590a` (T5R.15-B1): one file reviewed. Raw output: [ocr/T5R.15-B1-ae7590a.json](ocr/T5R.15-B1-ae7590a.json).

| Severity | Location | Claim | Assessment |
|---|---|---|---|
| medium | `ReviewCard.tsx:93-94` | The new scroll to the card's top also runs for Mark-row landings (links, an Action save's Mark next step), after the body's effect has focused the row; child effects run first, so a row below the fold ends up off screen. | Valid: bug task T5R.15-B1-B1. |

The reviewing agent found the rest clean: no scroll on load (`reveal === 0`), none on a refresh or re-sort (`scrolledFor` guard), and no missed reveal.

### T5R.15-B1-B1 The card-top scroll leaves a focused Mark row in view

When the opened card's body already holds focus (a Mark-row landing), the card-top scroll is skipped (still counted for that reveal), so the focused row stays in view.

Fix (`src/ui/screens/ReviewCard.tsx`): the card-top scroll effect records `scrolledFor.current = reveal`, then returns without scrolling when `document.activeElement` is inside the card's list item but is not the header. Plain opens (focus on the header) still scroll. Two unit cases in `ReviewCards.test.tsx` (describe "card-top scroll once the body shows (T5R.15-B1-B1)"), with `scrollIntoView` spied on the prototype and restored: the `?instrument=XYZ` landing focuses the row and scrolls the card top only once (at the press); red: two scrolls, `expected [ { block: 'start' }, …(1) ] to deeply equal [ { block: 'start' } ]`. The plain header open scrolls twice (press, body shown) and was a first-run pass, mutation-checked (flagged in `tdd-log.md`). `npx vitest run src/ui`: 385 passed. Typecheck, `tsc6`, lint, and `lint:deps` exit 0. Whole `npm run test:e2e`: 173 passed, 6.9 min (B5R.2, B5R.6 and the T5R.12 landings pass). Ports 5175, 9341, and 9342 were clear before and after.

**Process note (T5R.15-B1-B1):** the subagent ran a stray no-op `sed -i` against `/dev/null` (it errored; no file changed), against the Edit-only rule. One first-run pass (the plain-open case, mutation-checked, flagged); `tdd-log.md` carries one duplicate green row from a rerun.

ocr review of `3def717` (T5R.15-B1-B1): one file reviewed, no findings. The reviewing agent confirmed a plain open leaves focus on the header (so the post-body scroll runs), only landings focus inside the body, and the press-time scroll still runs for landings. Raw output: [ocr/T5R.15-B1-B1-3def717.json](ocr/T5R.15-B1-B1-3def717.json). T5R.15-B1's chain is closed.

ocr review of `61b1828` (T5R.9-B5): five files reviewed, no findings. Raw output: [ocr/T5R.9-B5-61b1828.json](ocr/T5R.9-B5-61b1828.json). The reviewing agent only grepped, so the orchestrator checked the open questions from the code: `open` (`daily-review.ts:281`) and the post-save assembly (`:389`) both build items through `reviewItem`, which sets `summary` from `openLongStockSummary` — the same function the Trade list's line uses (`trade-views.ts:334`, `:417`); a Trade with no derivable summary falls back to its Underlying; `tradeLine` in `ReviewView.tsx` reads the newest Review the screen holds, so it stays current after a save.

### T5R.15-I1 Each card carries its Trade id and shows its summary line (decision 68)

Commit `9703fdf`. `li.review-card` carries `data-trade-id`; the header shows the Trade's summary line (`tradeSummary`) in its own `.review-card-summary` span after `.review-card-name`, which keeps the Underlying alone; a Trade with no summary shows the Underlying alone. Cases in `ReviewCards.test.tsx`: data-trade-id in attention order (red: `expected [null ×5] to deeply equal ['t-b','t-c','t-f','t-a','t-e']`); summary span (red: TypeError, no span). Planned guard on the re-sort case (`t-e, t-a, t-f, t-c, t-b`): a first-run pass, mutation-checked (ids rendered from the first Review's positions; failed as expected) and flagged. `CardMarks.test.tsx`'s three position picks of T-F's card became picks by header name (`tfHeader()`, T-F's summary escaped).

- **Plan wording correction found:** section 6.5 says `TF_PLACED` "is built from `TF`, so it keeps its summary"; it is built by `walked('t-f', …)` without one. The subagent added `summary: TF.summary` to it (fixture only, no assertion changed).
- Checks: typecheck, `tsc6`, lint, `lint:deps` exit 0; `npx vitest run src` 987 passed; after `build:faults` and `build:releases`, whole `npm run test:e2e` 173 passed (7.0 min) — the longer header names don't disturb the `^Review <symbol>` helpers. Ports 5175, 9341, 9342 clear before and after.

**Process note (T5R.15-I1):** one tdd-log note appended with a shell here-doc (content correct), against the Edit-only rule; one build's output sent to `/tmp` and deleted.

ocr review of `9703fdf` (T5R.15-I1): two files reviewed (`app.css`, `ReviewCard.tsx`; three test/evidence files excluded), no findings. Raw output: [ocr/T5R.15-I1-9703fdf.json](ocr/T5R.15-I1-9703fdf.json).

### T5R.15-I2 Browser card helpers reach a card by its Trade (decision 68)

Commit `c771591`. `TradeRef = { symbol, tradeId, label? }`, `CardRef = string | TradeRef` in `e2e/d4/support.ts`; one resolver maps a `TradeRef` to `li.review-card[data-trade-id=…]`, its header and its body region; every card helper takes a `CardRef`; `createTradeAt`/`createTrades` return ids (`currentTradeId` reads `/trades/<id>`); `createCardFixture` returns `Record<CardTrade, TradeRef>` labelled `T-A`…`T-F`. Cases in `e2e/d4/card-helpers.spec.ts`, describe "reach by Trade (decision 68)", logged by hand:
- Case 1 (second XYZ card by id): red `TypeError: symbol.replace is not a function` in `cardHeader`; green.
- Case 2 (refusal names both cards): red `toMatch` — expected "Cannot reach T-F's card: T-A's card holds unsaved work…", got "Cannot reach XYZ's card: XYZ's card…"; green. Refusal code was once written ahead of this red, reverted, and the red rerun genuinely.
- Case 3 (each XYZ card by Trade after re-sort and reload): **first-run pass, flagged**. Mutation: the resolver reused the list position recorded at a Trade's first reach; failed at `checkSavedRow` ("Save Marks (0)" expected, "(1)" on the stale-position card). Restored. The case also asserts the order changed.
- B2 findings absorbed: no tag, so no stale tag or precondition; the refusal names both cards; `answerDebt`/`declineDebt`'s final "Saved reflection" check is scoped to the reached panel — no case can make the page-wide version fail (one card open at a time), so the scope was checked by reading the diff. `checkSavedRow` and `debtForm toHaveCount(0)` kept.
- **Implementation decision (recorded):** the refusal names each card by its `TradeRef` label, else by symbol and id; labels come from a module map filled from labelled refs the helpers have seen, so the holder is named by label only if its labelled ref passed through a helper earlier in the test.
- Checks: `npx playwright test e2e/d4 e2e/d5 e2e/d5r --project=chromium` 52 passed (3.1 min); `npx vitest run src` 987 passed; typecheck, `tsc6`, lint, `lint:deps` exit 0. No `src/` change; no existing `expect` changed. Ports clear before and after.

ocr review of `c771591` (T5R.15-I2), test-only, run in a scratch clone with the four files relocated under `src/itg/d5r/`: four files reviewed, no findings. ocr warning: two of its file reads failed on paths that exist only in the original layout (relocation artifact), so its cross-checking between helper files was limited. Raw output: [ocr/T5R.15-I2-c771591.json](ocr/T5R.15-I2-c771591.json).

### T5R.15-I3 D5R, D4 and D5 browser specs on the Trade-keyed helpers (decision 68)

Parent `c7715914`. No `src/` change.

**What changed**
- `e2e/d5r/support.ts`: deleted `tagCards`, `isShared`, the two-path `cardItem`, `headerOf`, `panelHeaderOf` and the nine twins (`reachTrade`, `reachTradePanel`, `markRowOf`, `enterMarkOf`, `actionFormOfTrade`, `saveActionOf`, `reflectionsOfTrade`, `debtFormOfTrade`, `answerDebtOf`). `sliderOf`, `saveMarksOf` and `remainsOf` stay, now taking a `CardRef` and reading through D4's `cardItem`.
- Every `e2e/d5r` spec takes the `TradeRef`s `createCardFixture` returns (`const { 'T-A': tA, … } = await createCardFixture(page)`) and calls the shared helpers (`cardHeader`, `panelHeader`, `reachCard`, `reachPanel`, `markRow`, `enterMark`, `saveAction`, `reflectionsOf`, `actionFormOf`, `answerDebt`). Every `tagCards` call is gone. B5R.9 declares `let tA!: TradeRef` because the Trade's id comes from the first launch and the relaunch reaches the same card with it.
- D4 and D5 inline lookups: `cardOf` (`runtime-failure.spec.ts`) became `tradeCard`; the inline "XYZ review" regions in `d5/faults`, `d5/detail-debt`, `d5/kill-offline` and `d4/review` (about line 44) became `tradeCard`; the `hasText: 'Review XYZ'` list items in `d4/review` (two), `d4/offline`, `d4/kill` and `d5/update` became `cardHeader` (the header button holds the band and the "Action saved" text, so the `toContainText` matchers are unchanged); `row.getByRole('link').first()` in `runtime-failure.spec.ts` became the link named `ABC`.
- Kept on purpose: `d4/update.spec.ts`'s old-release reads, `d4/review.spec.ts`'s `rows.nth(n)` checks, B5R.2's `cards.nth(17)`, and the `tradeCard(page, 'XYZ')` / `'ABC'` / `'DEF'` reads of the one open card. B5R.7 keeps its `dot('T-A')` / `tick('T-A')` helpers keyed by fixture label (resolved through the fixture's refs) so the one `expect` whose matcher argument holds a helper call stays textually identical.

**Verification 1: browser suite** (`npm run build:faults`, `npm run build:releases`, `npm run test:e2e`; Chromium). Ports 5175, 9341, 9342 free before each run and after the last (`lsof` empty).
- Run 1 (about 00:54 to 01:01): `176 passed (6.9m)`, exit 0: 124 D1/D2 cases and 52 D4/D5/D5R cases. (B5R.7's spec was edited a minute into this run, so this run may have used its earlier text; run 2 covers the final text.)
- Run 2 (01:03 to 01:12, final spec text): `154 passed`, `22 failed`, all 22 in `e2e/d1` and `e2e/d2`; **zero failures in d4, d5 or d5r** (all 52 D4/D5/D5R cases passed, among them every B5R case, including B5R.1, B5R.3 and B5R.7 to B5R.10 on the shared helpers' `checkSavedRow` and `debtForm toHaveCount(0)` checks for T-A and T-F).
- The 22 are the D1/D2 cases that confirm a Plan or Entry on the real clock (e.g. `d1/plan.spec.ts:7`, `d2/responsive-a11y.spec.ts:205`); each times out waiting for the heading after Confirm Plan, and the page snapshot still shows the New Plan form with "Plan time: 2026-11-01T01:12". No spec or helper they use is in this task's diff (`grep` of `e2e/d1` and `e2e/d2` for imports from d4, d5 or d5r is empty). Rerun alone once (`npx playwright test e2e/d1 e2e/d2 --project=chromium`, 01:13): the same 22 fail, 102 pass. Rerun with `TZ=UTC` (01:19): the same 22 fail. They passed in run 1 (started about 00:54) and fail in every run from 01:03; the real clock is now inside the hour (01:00 to 02:00 on 2026-11-01) that repeats when US clocks fall back. This looks like a real-clock, daylight-saving-hour problem in D1/D2's cases (or the app's Plan-time handling), not a result of this task, but it is **not confirmed**: rerun `npm run test:e2e` once the repeated hour is over (the wall clock reads 02:00 EST, about 95 minutes after 01:25 EDT) to see the 22 pass.

**Verification 2: no D5R tag, tag helper or twin** (`e2e/d5r/support.ts` and every spec):
```text
$ grep -nE "tagCards|isShared|data-trade[^-]|headerOf|panelHeaderOf|reachTrade|reachTradePanel|markRowOf|enterMarkOf|actionFormOfTrade|saveActionOf|reflectionsOfTrade|debtFormOfTrade|answerDebtOf" e2e/d5r/support.ts
(no output; exit 1)
$ grep -rnE "tagCards|isShared|data-trade[^-]|headerOf|panelHeaderOf|reachTrade|reachTradePanel|markRowOf|enterMarkOf|actionFormOfTrade|saveActionOf|reflectionsOfTrade|debtFormOfTrade|answerDebtOf" e2e
(no output; exit 1)
```

**Verification 3: migration diff check.** `git diff -U0 HEAD -- e2e/d4 e2e/d5 e2e/d5r` (HEAD is the parent `c7715914`), every removed and added line holding `expect(` cut to its matcher onward (`sed -E 's/^[-+].*(\.to[A-Za-z]+\(.*)$/\1/'`), sorted, compared with `diff`:
- Spec files only (`'e2e/d4/*.spec.ts' 'e2e/d5/*.spec.ts' 'e2e/d5r/*.spec.ts'`): 63 removed, 63 added; `diff` reports exactly one line pair:
  ```text
  < .toHaveAttribute('data-trade', 'T-A');
  > .toHaveAttribute('data-trade-id', tA.tradeId);
  ```
  the one sanctioned change (B5R.1, T-A's card first, now read from the app's hook).
- Whole diff including the three `support.ts` files: 72 removed, 63 added. The nine extra removed lines are the nine `expect(` calls inside the deleted D5R helpers (`tagCards`, the twins; their checks live on in D4's shared helpers, which already hold them); the three `support.ts` files had 20 + 4 + 9 `expect(` before and 20 + 4 + 0 after.
- Count of `expect(` in the spec files: 593 before, 593 after (does not drop). In all of `e2e/d4`, `e2e/d5`, `e2e/d5r`: 626 before, 617 after, the difference being the nine in the deleted helpers.
- A first version of B5R.7 changed `tick('T-A')` inside a matcher argument to `tick(tA)`; the check caught it and the helpers were keyed by label instead, which removed the pair.

**Verification 4:** `npx vitest run src` 75 files, 987 tests passed; `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` all exit 0.

**Orchestrator's reading of T5R.15-I3 (commit `0a03b73`):** the migration check holds: the spec files keep 593 `expect(` and differ only in the sanctioned line. The nine `expect(` removed with the deleted D5R twins are the deletion section 6.5 asks for; their checks live on in the shared helpers, so the "count must not drop" rule is read over the spec files. **The 22 D1/D2 failures, confirmed:** at 01:26 EDT on 2026-11-01 the main session reproduced `e2e/d1/plan.spec.ts:7` alone (same timeout after Confirm Plan, Plan time "2026-11-01T01:26"). Cause, read in the code: `PlanForm` defaults Plan time to the wall time of "now", which in the repeated fall-back hour is ambiguous; `fromWorkspaceLocal` rejects it as `AmbiguousLocalTime` (D1 A8), and `PlanForm.tsx:116` (`if (!economicTime.ok) return;`) returns silently. That is a pre-existing D1 defect, not caused by I3: the trader can't confirm a Plan with its default time during that hour and gets no message. It becomes suite-failure fix **T5R.15-F1**. **Implementation decision (main session):** the untouched default submits the exact "now" instant it came from (decision 20's default, which can't be ambiguous); an edited time is resolved per A8; a rejected local time gets a visible, accessible validation message. The Position Change form gets the same treatment if it has the same defect.

ocr review of `0a03b73` (T5R.15-I3), test-only, in a scratch clone with the 14 changed e2e files relocated under `src/itg/d5r/`: 14 files reviewed, no findings. The reviewer's untraced `toBeVisible` lines in `e2e/d5` were checked by the main session: each is an inline "XYZ review" region replaced by `tradeCard(page, 'XYZ')`, with `.toBeVisible()` unchanged. Raw output: [ocr/T5R.15-I3-0a03b73.json](ocr/T5R.15-I3-0a03b73.json).

### T5R.15-F1 The Plan and Position Change forms work during a fall-back hour (suite-failure fix)

Commit `026d624`. Found by T5R.15-I3's browser runs (see the orchestrator's reading above). Fix, UI only (`PlanForm.tsx`, `PositionChangeForm.tsx`, `position-change-issues.ts`, new `local-time.ts`): an untouched default time submits the exact "now" instant it came from (floored to the minute, `minuteOf`, so it equals what the field shows); an edited time, even retyped to the same text, is resolved by `fromWorkspaceLocal` as typed (D1 A8 unchanged); a rejected local time shows a visible message tied to the field (`aria-invalid`, `aria-describedby`), with focus on the form's existing issue summary (the forms' established mechanism, so focus goes to the summary rather than the input; recorded). Messages: "The Plan time occurs twice because clocks fall back; enter an earlier or later time." / "…does not exist because clocks spring forward; …" / "…is not a valid date and time; enter one."; the Position Change form had the same silent-default defect and a generic "check the Economic Time." for these codes, now named the same way ("Execution n: the Economic Time …").

Cases (clock `2026-11-01T05:26:00Z`, America/New_York), each red first: PlanForm P1 default instant confirmed (red: `confirmPlan` called 0 times), P2 edited ambiguous time explained (red: no summary region), P3 a default in the second, EST occurrence (06:26:30Z → 06:26:00Z; red: no call), P4 nonexistent 2026-03-08T02:30, P5 cleared time, P6 retyped default text resolved as typed, P7 message clears once the time resolves; PositionChangeForm C1 each Execution's default instant (red: no call), C2 ambiguous and C3 nonexistent messages (red: generic text). Production code was once written ahead of P3–P7's reds, reverted with `git checkout`, and the five reds rerun genuinely (logged). The first greens of P1 and P3 showed exit 1 from an unhandled rejection in the facade double; the tests now return a Rejected result and were rerun green.

Checks: `npx vitest run src` 997 passed (one full run failed the known `TradeList.test.tsx` mark-count flake, which passed alone twice and in two further full runs); typecheck, `tsc6`, lint, `lint:deps` exit 0. Browser at 01:33–01:37 EDT, inside the repeated hour: `npx playwright test e2e/d1 e2e/d2 --project=chromium` 118 passed, 6 failed. **The six are environmental:** they drive `dist-releases/d1`, built from the immutable tag `claude-opus-5.5-d1` (A34), whose Plan form still has the defect, so they fail only inside the repeated fall-back hour: `e2e/d2/migration.spec.ts` lines 47, 86, 122, 170, `e2e/d2/responsive-a11y.spec.ts:90`, `e2e/d2/ui-alignment.spec.ts:411` (at `confirmD1Plan`). No change is made for them: released code is not rebuilt, and the cases pass outside that hour.

**Process notes (T5R.15-F1):** one `sed -i` on `PlanForm.test.tsx` that matched nothing, one no-op here-doc, and one blocked `pkill`, against the Edit-only rule; the agent also left four `while pgrep -f "playwright test e2e/d1"` wait loops that matched their own command lines and never ended. They were ended by stopping the agent. Future briefs say: no wait loops on `pgrep -f`.

ocr review of `026d624` (T5R.15-F1): four files reviewed (`PlanForm.tsx`, `PositionChangeForm.tsx`, `local-time.ts`, `position-change-issues.ts`; two test files and the log excluded), no findings. Raw output: [ocr/T5R.15-F1-026d624.json](ocr/T5R.15-F1-026d624.json).

### T5R.15-I4 Messages and blockers name the Trade (decision 68)

Commit `095e325`. `tradeName(trade)` in `src/ui/format.ts` ("XYZ (Long 100 shares @ $50.18)", or the Underlying alone). Cases, each red first: `tradeName` (red: `tradeName is not a function`); the four blockers name the Trade, Mark missing keeps the Instrument (red: "Action missing for XYZ"; the first green run failed on the test waiting for the wrong card, fixed and rerun green); "Trades:" under Complete with unavailable Marks (red: "Trades: DEF, XYZ, XYZ"); hold message on another header press; message after an Action save on a held card; the open card's body label "<name> review" (red: no such region). Cases 1 and 6 were renamed for `-t` filtering; their first runs matched no test (exit 0), so those rows were deleted as invalid and a note records it. No first-run passes.

- Refactor: one `tradeLabels(trades)` in `ReviewView.tsx` gives `name` and `line`; `Status` takes `name`; "also held by" keeps `line`. `CardBody` gained a `name` prop.
- `tradeCard` (`e2e/d4/support.ts`) matches `^<escaped symbol>(?: \([^)]*\))? review$`; the old-release (rule 5) cases still pass. B5R.5's hold message (the authorized change) expects "…for XYZ (Long 100 shares @ $50.18) to leave it."; D4's `hold.spec.ts` and `acknowledge.spec.ts` pass unchanged.
- Checks: typecheck, `tsc6`, lint, `lint:deps` exit 0; `npx vitest run src` 1003 passed. After `build:faults` and `build:releases`, whole `npm run test:e2e`: 170 passed, 6 failed — exactly T5R.15-F1's six D1-release cases (the clock read 01:4x EDT; every 01:xx wall time that day is ambiguous, on either pass of the hour). Ports clear before and after. The agent stopped with background work still running and was stopped by the main session.

ocr review of `095e325` (T5R.15-I4): four files reviewed (`format.ts`, `ReviewCard.tsx`, `ReviewView.tsx`, `e2e/d4/support.ts`'s `tradeCard`), no findings. Raw output: [ocr/T5R.15-I4-095e325.json](ocr/T5R.15-I4-095e325.json).

### T5R.15-I5 Missing-Mark links open the Trade's own card (decision 68)

Commit `08344e5`. The Open list's Mark missing figure (both the wide cell and the narrow line) and Trade Detail's Mark missing line link to `/review?trade=<id>&instrument=<key>`, both parts URL-encoded; `ReviewView` already acted on the pair, and a bare `?instrument=` still opens the first card holding it. Cases, each red first: the Open list link (red: `['/review?instrument=ABC', …]`), checked on a second row with its own id so both links of a row carry it; the Trade Detail link (red: `'/review?instrument=XYZ'`); B5R.12 in `e2e/d5r/sliders.spec.ts` (red: the second holder's card stayed collapsed because the link landed on the first holder). The four existing href expectations gained `trade=<id>&`, the sanctioned change. No first-run passes.

- **B5R.12's row:** with no Monday Marks, attention order puts T-A first (it also owes Friday's gap), so the "not first holder" whose link is followed is T-F's; the case expects T-F's card open on Marks with XYZ's Price focused, T-A's card collapsed, and exactly one card expanded. The plan says only "not the first card"; the brief had wrongly guessed T-A. Recorded in the log.
- **Test names rephrased** for `-t` filtering (the planned names hold an apostrophe, `<`, `>`, `=` and `?`): "should link the Open list Mark missing figure to the Review with its trade id and instrument key" and "should link Trade Detail Mark missing line to the Review with its trade id and instrument key".
- Checks: `npx vitest run src` 1005 passed; typecheck, `tsc6`, lint, `lint:deps` exit 0. Browser (D1, D2, D4, D5, D5R, Chromium) at 01:5x EDT: 171 passed, 6 failed, exactly T5R.15-F1's six environmental D1-release cases. Ports clear before and after. The agent was stopped by the main session after its report because a leftover timer was still running.
- **Slip:** the commit dropped a space in an unrelated unit title in `TradeList.test.tsx` ("AwaitingClose,with no at-entry risk"); nothing else refers to it. It is fixed as a small structural follow-up (see below).

ocr review of `08344e5` (T5R.15-I5): two files reviewed (`TradeList.tsx`, `TradeDetail.tsx`; three test files and the log excluded), no findings. The reviewer confirmed the encoding, both Open list links and `ReviewView`'s reading of the pair. Raw output: [ocr/T5R.15-I5-08344e5.json](ocr/T5R.15-I5-08344e5.json).

**T5R.15-I5-S1 (structural, test-only):** commit `da7e128` restores the space in the `TradeList.test.tsx` title ("…AwaitingClose, with no at-entry risk…"). Verified: `git diff 08344e5c~1 -- src/ui/screens/TradeList.test.tsx` no longer changes that line; `-t "AwaitingClose, with no at-entry risk"` runs exactly 1 test, passed; `npx vitest run src` 1005 passed; lint exit 0.

### T5R.15-I6 The slider leaves the header's side only when the card is too narrow (decision 68)

Commit `9b00a8b`. CSS only (`src/ui/app.css`): `.review-card` gains `container-type: inline-size`, and the single-column rule for `.review-card-head` moves from `@media (max-width: 639.98px)` to `@container (max-width: 39.99rem)`. No markup change; the card's 1rem side padding makes the container's content box the head row's width.

New B5R.11 case (`e2e/d5r/responsive-a11y.spec.ts`), measuring T-A's header: beside at 1280, 960 and 760 px (head row at least 640 px; slider's left edge at or right of the text's right edge with vertical overlap; the visible text spans' line boxes on at most two distinct tops), below at 700 and 390 px (slider's top at or below the text's bottom, width at least the head's width minus 2). Red: assertion failure at 700 px, "slider below the text at 700 px", expected ≥ 564.5, received 527.4 (1280, 960 and 760 px already passed). Green after the change and `build:releases`; B5R.11's existing case passes unchanged. **Mutation:** the viewport query restored, `dist-releases/d5` rebuilt (the release the d5r specs serve), the case failed at 700 px with the same assertion; restored and rebuilt, green. No first-run passes.

Checks: `npx vitest run src` 1005 passed; typecheck, `tsc6`, lint, `lint:deps` exit 0. After `build:faults` and `build:releases`, whole `npm run test:e2e` at 01:04–01:11 EST: 172 passed, 6 failed, exactly T5R.15-F1's six environmental D1-release cases; B4.13 and the axe runs passed. Ports clear before and after; no background work left.

ocr review of `9b00a8b` (T5R.15-I6): one file reviewed (`app.css`; the spec and the log excluded), no findings. The reviewer checked that containment can't collapse the card (a block `<li>` in a plain list), that no sticky or absolutely positioned descendant is affected, and that no other size query inside the card needs to become a container query. **Minor observation, no task:** `max-width: 39.99rem` leaves a header between 639.84 and 640 px wide beside the slider, a sub-pixel gap that `width < 40rem` would close; the previous `639.98px` media query had the same kind of gap, and no tested width lands there. Raw output: [ocr/T5R.15-I6-9b00a8b.json](ocr/T5R.15-I6-9b00a8b.json).

### T5R.15 cumulative run

At `2623dea` (code as of `da7e128`; later commits are evidence and handoff only), started 02:01 EST on 2026-11-01, after the repeated fall-back hour, by `suite-runner`, label `t5r.15-cumulative`:

| Suite | Result | Output |
|---|---|---|
| Unit (`npx vitest run src`) | 75 files, 1005 passed, exit 0 | [suite-runs/t5r.15-cumulative-unit.txt](suite-runs/t5r.15-cumulative-unit.txt) |
| Node integration (`npx vitest run tests/integration`) | 60 files, 117 passed, exit 0 | [suite-runs/t5r.15-cumulative-integration.txt](suite-runs/t5r.15-cumulative-integration.txt) |
| Browser (`npm run test:e2e`, Chromium) | 178 passed (7.0 min), exit 0 | [suite-runs/t5r.15-cumulative-browser.txt](suite-runs/t5r.15-cumulative-browser.txt) |
| Static and verify checks (typecheck, `tsc6`, lint, `lint:deps`, build, and the seven `verify:*`) | 12 of 12 exit 0 | [suite-runs/t5r.15-cumulative-checks.txt](suite-runs/t5r.15-cumulative-checks.txt) |

All green, with no reruns. T5R.15-F1's six D1-release cases pass outside the fall-back hour, as expected, and the known flakes did not fail. Ports 5175, 9341 and 9342 were free before and after the run.
