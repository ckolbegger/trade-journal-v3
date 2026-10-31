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

Commit: this commit.
