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

Commit: the `feat(trade-analysis): T5R.2` commit on this branch (see `git log`).

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
