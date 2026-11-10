# D7S prefactor structural verifications

Each entry records a structural task's exact verification (D7S prefactor breakdown, section 4), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`.

## Start of the D7S prefactor

Location checks (D7SP handoff, section 1) on 2026-11-10:
- worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`: matched.
- `git status -sb`: `## claude-opus-5.5...origin/claude-opus-5.5 [ahead 2]`, clean.
- `git log --oneline claude-opus-5.5-pre-d7sp..HEAD`: empty. `HEAD` is `9e66d72b`.
- tags `claude-opus-5.5-plan-r72` (`576aaa8677ac7acc42087d40c0e6ba3e68f40cb0`), `claude-opus-5.5-d7` (`7e50d82e4434e18ae48a140d251061e44b25a95b`) and `claude-opus-5.5-pre-d7sp`: present.
- `git diff --stat claude-opus-5.5-d7 claude-opus-5.5-pre-d7sp -- src e2e tests`: empty.
- `git diff --name-status claude-opus-5.5-d7 claude-opus-5.5-pre-d7sp -- tools package.json 'eslint*'`: `M package.json`, `A tools/install-hooks.sh`, `A tools/verify-hooks.sh` (the retro's hook work only).
- `git rev-parse --git-path hooks`: `.githooks`.
- `ocr llm test`: `✓ Connection test successful`.
- `DEV_PORT=5175`; Node v26.12.0.
- `npm ci`: exit 0. `npx vitest run src`: `Test Files 121 passed (121)`, `Tests 1438 passed (1438)`. `npx vitest run tests/integration`: `Test Files 94 passed (94)`, `Tests 191 passed (191)`.

Spec reading (decision 45, A189): the ranges listed in the D7SP handoff, section 2 (no generated reading list). No other spec section has been needed yet.

## T7SP.1 Domain: the expiration rules

Behavioral (2 cases, red then green, in `tdd-log.md`). Commit `0cc181aa`. `expiredOn(contract: OptionInstrument, date)` is `date > contract.expiration`; `settlementDueOn` is `date >= contract.expiration` (P82), in `src/domain/instrument/index.ts`. No caller changed (T7SP.2 switches them). The subagent added one assertion beyond the planned wording: case 1 also pins `instrumentKey(contract)` to `XYZ261120C00055000`. Verification: `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` exit 0; `npx vitest run src/domain/instrument` 11 of 11.

**ocr review** (`ocr/T7SP.1-0cc181aa.json`): No findings.

**Cumulative run `t7sp-1`** (2026-11-10, on `0cc181aa`), outputs in `suite-runs/t7sp-1-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 121 files, 1440 tests passed |
| Node integration | 94 files, 191 tests passed |
| Browser (Chromium), task tier | 5 passed (11.5 s); no `e2e/d7sp` folder yet |
| Checks | 14 of 14 exit 0 |

Browser tier printed by `browser-auto 9e66d72b`: `browser tier: task (no changed path since 9e66d72b is on the full-tier list)`. Ports 5175, 9341, 9342 free before and after.

## T7SP.2 The entry checks call the rules

Six raw expiration comparisons now call `expiredOn` (P82); each is behaviour-identical (`expiredOn(c, d)` is `d > c.expiration`).

| Site | Old expression | New expression |
|---|---|---|
| `src/domain/trade-analysis/derive.ts:438` (AfterExpiration) | `day > e.instrument.expiration` | `expiredOn(e.instrument, day)` |
| `src/domain/trade-analysis/derive.ts:455` (SettlementTimeInvalid) | `day > s.instrument.expiration \|\| beforeExecution` | `expiredOn(s.instrument, day) \|\| beforeExecution` |
| `src/domain/trade-analysis/plan.ts:187` (ContractAlreadyExpired) | `leg.instrument.expiration < planDate` | `expiredOn(leg.instrument, planDate)` |
| `src/modules/market-data/market-data.ts:408` (Mark save, AfterExpiration) | `command.tradingDate > instrument.expiration` | `expiredOn(instrument, command.tradingDate)` |
| `src/modules/market-data/section.ts:50` (Restore section, AfterExpiration) | `tradingDate > instrument.expiration` | `expiredOn(instrument, tradingDate)` |
| `src/app/bench-generator.ts:662` (contract marked at or before expiration) | `session.date <= expiration` | `!expiredOn(contract, session.date)` |

For `bench-generator.ts`, the `held` map now stores the Option Instrument (`contract`) instead of its expiration string, so the rule gets a real contract. `BENCH_GENERATOR_VERSION` is not bumped (behaviour-identical).

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npx tsc6 --noEmit` | exit 0 |
| `npx vitest run src/domain src/modules/market-data` | 28 files, 299 tests passed |
| `npm run test:integration -- d7` | 18 files, 37 tests passed |
| `npm run lint` | exit 0 |
| `npm run lint:deps` | exit 0 |

**ocr review** (`ocr/T7SP.2-e6ac2f5f.json`): No findings. The reviewer's own reading (not an ocr finding) confirmed each of the six switches is the same test, and that the generator's `held` map now stores the same contract object whose `.expiration` it used to copy.

**Cumulative run `t7sp-2`** (2026-11-10, on `e6ac2f5f`), outputs in `suite-runs/t7sp-2-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 121 files, 1440 tests passed |
| Node integration | 94 files, 191 tests passed |
| Browser (Chromium), full tier, `browser-1` | 119 passed (4.8 min) |
| Browser (Chromium), full tier, `browser-2` | 64 passed (4.0 min) |
| Checks | 14 of 14 exit 0 |

Browser tier printed by `browser-auto 0cc181aa`: `browser tier: full (first matching path since 0cc181aa: src/app/bench-generator.ts)`. Ports 5175, 9341, 9342 free before and after.

## T7SP.3 Trade Analysis: contract status in `derive`

Behavioral (6 cases, in `tdd-log.md`). Commit `e14f0cc8`, new test file `src/domain/trade-analysis/contract-status.test.ts`. Test names drop apostrophes only ("O-C contract position", "contract Mark and XYZ Mark", "O-S short contract").

Public types, in `src/domain/trade-analysis/derive.ts` (not yet re-exported from `trade-analysis/index.ts`):
- `type ContractStatus = 'Live' | 'DueToday' | 'PastExpiration'`;
- `interface ContractStatusEntry { instrument: OptionInstrument; status: ContractStatus }`;
- `DerivedTradeState.contractStatuses: readonly ContractStatusEntry[]`, one entry per open option position, empty without a valuation date or for stock and closed contracts;
- `DerivedTradeState.valuationDate?: string`, present only when `derive` got a date (A192).

Observation requirements now follow the status (the raw comparison at `derive.ts:660` is gone), computed from the same `contractStatuses`, with `expiredOn`/`settlementDueOn`.

**First-run passes** (each mutation failed the case by assertion, then was restored):
- "O-S short contract, same three statuses": the status code is not sign-specific, so cases 1–3 built it. Mutation: short positions always `Live`; failure `expected [ 'Live' ] to deeply equal [ 'DueToday' ]`.
- "no status to a stock position, or to a contract once its quantity is closed": mutation dropped the zero-quantity guard; failure `expected [ { instrument … } ] to deeply equal []`.
- "no status and no requirements when derive has no valuation date": mutation computed statuses with a fallback date 2026-11-20; failure `expected [ {…} ] to deeply equal []`.

**The planned requirement-half mutation.** The breakdown expected the requirement halves of cases 2 and 3 to pass today, with the mutation "requirements computed from `Live` alone" recorded for the third. Both cases went red first on their status assertions, and the requirement switch landed in case 3's green. The planned mutation (drop `DueToday` from the requirement rule) fails case 2, not case 3, since `Live`-only already gives no requirements on Mon 11-23. For case 3 the subagent also ran the inverse (requirements ignoring status), which fails case 3. Recorded as an open question for the final report.

Verification: `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` exit 0; `npx vitest run src/domain` 216 passed; `npm run test:integration -- d7` 37 passed. No existing assertion changed.

**ocr review** (`ocr/T7SP.3-e14f0cc8.json`): one finding, dismissed.

| Severity | Location | Claim | Reviewer | Outcome |
|---|---|---|---|---|
| low (style) | `src/domain/trade-analysis/derive.ts:666-670` | The nested ternary assigning `ContractStatus` breaks a "no nested ternary" rule; use an `if`/`else if` chain with `expiredOn` first. | Doubtful: logic correct and equivalent; no such rule in `CLAUDE.md`, `.claude` or the ESLint config; D7 dismissed the same style finding three times (`derive.ts:634-638`, `payoff.ts:148`, `position-change-issues.ts:31`). | **Dismissed: no failure scenario.** The finding names no input that gives a wrong result; it is a readability preference with no behaviour change, and the repo has no such rule (handoff, section 5: a finding with no failure scenario is dismissed). Checked against the cited lines: `expiredOn` is tested before `settlementDueOn`, so `PastExpiration` wins after expiration as P81 requires. |

**Cumulative run `t7sp-3`** (2026-11-10, on `e14f0cc8`), outputs in `suite-runs/t7sp-3-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 122 files, 1446 tests passed |
| Node integration | 94 files, 191 tests passed |
| Browser (Chromium), task tier | 5 passed (11.5 s); no `e2e/d7sp` folder yet |
| Checks | 14 of 14 exit 0 |

Browser tier printed by `browser-auto e6ac2f5f`: `browser tier: task (no changed path since e6ac2f5f is on the full-tier list)`. Ports 5175, 9341, 9342 free before and after.

## T7SP.4 Trade Analysis: `evaluate` reads the status

Behavioral (3 cases, in `tdd-log.md`). Commit `07449b9d`, new test file `src/domain/trade-analysis/evaluate-status.test.ts` (O-S, `osRecord([OS_S1])`, derived at 2026-11-20 and 2026-11-23). The first case's name drops apostrophes.

What changed in `evaluate.ts`: a local `contractStatusOf(instrument)` lookup by `instrumentKey`; `pastExpiration` is `option !== undefined && lots.length > 0 && contractStatusOf(option) === 'PastExpiration'`; the settlement item is `NotYetDue` for `Live`, otherwise `Due`; `evaluate` throws an `Error` when `state.valuationDate` is defined and differs from the frame's trading date. `evaluate.ts` no longer compares a date with `.expiration`; it still reads `option.expiration` as data for the `SettlementDue` result and the item. `derive.ts` now exports `contractStatusesOf(positions, valuationDate)` (not re-exported from `trade-analysis/index.ts`).

**Temporary fallback (main session's decision, recorded in the brief):** a state without `valuationDate` skips the date check, and `evaluate` computes statuses at the frame's trading date with `contractStatusesOf`, the function `derive` uses, never a raw comparison. Needed because Trade Views derives without a date until T7SP.7, and `closedCurrent` evaluates at the terminal date. The code comment names T7SP.8 as the task that removes it (A192: after T7SP.7 and T7SP.8, `evaluate` is never called on a dateless state).

**First-run passes** (expected by the breakdown; each mutation failed the case by assertion, then was restored):
- "should return the Mark-dependent figures Unavailable(SettlementDue) for a PastExpiration contract and a settlement item Due": mutation returned `PastExpiration` as `Live` in `contractStatusesOf`; failure `expected [ 'NotYetDue' ] to deeply equal [ 'Due' ]`.
- "should return a settlement item Due for a DueToday contract with its Mark-dependent figures valued from its Mark": mutation returned `DueToday` as `Live`; failure `expected [ 'NotYetDue' ] to deeply equal [ 'Due' ]`.

Verification: `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` exit 0; `npx vitest run src/domain src/coordinators` 529 passed; `npm run test:integration` 191 passed. No existing case broke or changed.

**ocr review** (`ocr/T7SP.4-07449b9d.json`): No findings.

**Cumulative run `t7sp-4`** (2026-11-10, on `07449b9d`), outputs in `suite-runs/t7sp-4-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 123 files, 1449 tests passed |
| Node integration | 94 files, 191 tests passed |
| Browser (Chromium), task tier | 5 passed (10.2 s); no `e2e/d7sp` folder yet |
| Checks | 14 of 14 exit 0 |

Browser tier printed by `browser-auto e14f0cc8`: `browser tier: task (no changed path since e14f0cc8 is on the full-tier list)`. Ports 5175, 9341, 9342 free before and after.

## T7SP.5 Market Data: the read session

Behavioral (10 cases, in `tdd-log.md`). Commit `5438bfb7`, files `src/modules/market-data/market-data.ts`, `index.ts`, new `read-session.test.ts`. Every case compares the session's answers with `ResolveFrames`, `ResolveSession` or `recover` in the same test (A193). Case 1 went red on `openReadSession is not a function`; each later case went red on behaviour the earlier ones lacked (details in `tdd-log.md`, which also holds one harmless duplicate green row for case 5).

Public names (implementation-level decisions, P79's names were indicative), exported from `src/modules/market-data/index.ts`:
- `MarketData.openReadSession(context: FrameContext): Promise<MarketDataReadSession>`;
- `MarketDataReadSession { tradingDate; closeInstant?; covered; frames(instruments); historicalFrames(date, instruments); gaps(instruments with earliestExposure); settlementTime(contract: OptionInstrument); binding(): { evidenceBinding; snapshotIds } }`, `snapshotIds` keyed by trading date;
- `MarketDataSettlementTime` (`CalculationResult<Instant, Unavailable(SessionPolicyNotCovered), never>`), a copy of the coordinators' `SettlementTime` shape, since Market Data cannot import from `coordinators`; T7SP.6 can unify them.

Choices recorded from the subagent's summary:
- Outside coverage: `covered: false`, no `closeInstant`, `frames` returns `[]` (where `ResolveFrames` rejects with `SessionPolicyCoverage`), no request at open.
- A context rejected for another reason (`InvalidInstant`, `NotASession`, `SessionNotCompleted`, `InvalidDate`) rejects the promise; `historicalFrames` likewise for such a date. Callers resolve the Review date with `ResolveSession` first, as Daily Review does today.
- `settlementTime` is more lenient than `settlementTimeOf`: an uncompleted expiration session gives its close, and a non-session date with no covered earlier session gives `Unavailable(SessionPolicyNotCovered)`, where `settlementTimeOf` throws. Otherwise equal. `settlementTimeOf` is not moved (T7SP.6).
- Frames are returned in the order asked, duplicates kept (`ResolveFrames` sorts and dedupes); each frame equals `ResolveFrames`' frame for that Instrument alone. `historicalFrames` on the session's own date delegates to `frames`.
- `binding()` is synchronous and covers resolved reads only; it excludes gap scans, as `ResolveFrames` does; an uncovered session returns an empty binding.
- Each date read and each Stale lookup is its own read snapshot (section 1.4), and each snapshot adds a `meta.get`. `frameEvidence` was split into `observationsOn`, `instrumentEvidence`, `recordOf` and `evidenceOf`, which `ResolveFrames` uses unchanged.

**First-run pass:** case 10, "should read a Mark saved after the session closed only in a new session" (cases 4 and 5 built the caches). Mutation: removed `observations.set(date, read)` and `evidence.set(id, read)`; failure `AssertionError: expected { instrumentKey: 'AAA', …(4) } to deeply equal { instrumentKey: 'AAA', …(4) }`; restored, green rerun.

Verification: `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` exit 0; `npx vitest run src/modules/market-data` 99 passed; `npm run test:integration` 94 files, 191 tests passed (every existing query-count proof unchanged).

**ocr review** (`ocr/T7SP.5-5438bfb7.json`): four findings; three become bug tasks, one is dismissed. Each was checked against the cited lines.

| # | Severity | Location | Claim | Reviewer | Outcome |
|---|---|---|---|---|---|
| 1 | medium (bug) | `market-data.ts:815` | `scanOf` rescans when a later `gaps` call asks for an earlier exposure than the cached scan, so an Instrument can be scanned twice per session. | Valid: reuse only when the cached exposure is at or before the requested one; Oct 9 then Oct 7 scans twice. | **T7SP.5-B1** |
| 2 | medium (bug) | `market-data.ts:871` | `historicalFrames` accepts a date later than the session's trading date (`resolveDay` checks the wall clock, not `day.date`). | Doubtful: no guard is stated; `ResolveFrames` Historical doesn't reject later dates either. | **T7SP.5-B2**: Doubtful with a failure scenario. The spec answers only "at the session's date or an earlier date" (`market-data.md`, Query contract), and a later frame would value a Trade with evidence after the operation's date. |
| 3 | medium (bug) | `market-data.ts:837` | `binding()` omits the keys `gaps()` reads. | Doubtful: a known choice; `HistoricalGaps` carries per-date `revisions`, and `daily-review.ts:399` binds `g.revisions` from `recover` today. | **T7SP.5-B3**: Doubtful with a failure scenario. The spec says the session "gives the caller the binding of everything it read", and P79/Q6 say the session hands the binding over; a save relying on `binding()` alone would not recheck a gap key that moved. |
| 4 | low (style) | `market-data.ts:768` | A nested ternary picks the outside-coverage date. | Wrong: no such rule in the repo; D7 dismissed it five times. | **Dismissed: Wrong, no failure scenario.** |

### Bug tasks

- **T7SP.5-B1** (finding 1). Defect: a session scans an Instrument's gaps more than once when a later `gaps` call names an earlier `earliestExposure`. Case: `it should scan an Instrument's gaps once when a later call asks from an earlier exposure, answering each call as recover does`.
- **T7SP.5-B2** (finding 2). Defect: `historicalFrames` returns frames for a date after the session's trading date. Case: `it should reject historicalFrames for a date after the session's trading date`.
- **T7SP.5-B3** (finding 3). Defect: `binding()` does not cover the keys the session's `gaps` scans read. Case: `it should include every key its gaps scans read in the binding, as recover's result binds them`.

#### T7SP.5-B1, commit `40442940`

Case "should scan an Instrument's gaps once when a later call asks from an earlier exposure, answering each call as recover does": red (`expected ... length 1`, got 2 scans), then green. Fix: the session's first scan of an Instrument runs from the session policy's coverage start (`coverage.first`), cached as one promise per Instrument; each call's answer is narrowed to its own exposure. A call whose exposure has no relevant session returns empty gaps with no read, as `recover` does, through `relevantSessions(earliestExposure, lastHistorical)`, extracted from `historicalGaps` with no behaviour change. Request lists unchanged (d4–d7 proofs pass); the cost is more records read per scan (every stored observation of the Instrument since coverage start). Noted in the handoff for T7SP.8 and T7SP.14. Verification: market-data 100 passed, integration 191 passed, typecheck, `tsc6`, lint, lint:deps exit 0.

**ocr review** (`ocr/T7SP.5-B1-40442940.json`): one finding, dismissed.

| Severity | Location | Claim | Reviewer | Outcome |
|---|---|---|---|---|
| medium (bug) | `market-data.ts:863` | The `none ? {...} : await scanOf(...)` conditional infers `closes` as `{}`, so `gaps.closes[date]` fails strict typechecking (TS7053). | Wrong: `npm run typecheck` (strict, `noUncheckedIndexedAccess`) exits 0 on this commit. | **Dismissed: Wrong.** The repo's typecheck passes, as the B1 subagent and the cumulative checks also show; no failure. |

#### T7SP.5-B2, commit `f0316f62`

Case "should reject historicalFrames for a date after the session's trading date": a Review session on 2026-10-09 asks `historicalFrames('2026-10-12', ['AAA'])` with a Mark saved on 2026-10-12. Red: `AssertionError: expected 'resolved' to be 'rejected'` (frames were returned); green after a two-line fix: after `resolveDay`, a day later than the session's `day.date` rejects the promise, with no stored read (request counter). The session's own date and earlier dates are unchanged; a session outside coverage still returns `[]` for any date. Verification: typecheck, `tsc6`, lint, lint:deps exit 0; market-data 101 passed; integration 191 passed.

**ocr review** (`ocr/T7SP.5-B2-f0316f62.json`): one finding, a bug task.

| Severity | Location | Claim | Reviewer | Outcome |
|---|---|---|---|---|
| medium (bug) | `market-data.ts:883` | The later-date guard fires only when `resolveDay` returns a `Day`; for a covered session, a later date beyond policy coverage resolves `Rejected(SessionPolicyCoverage)` and the call returns `[]` instead of rejecting. | Valid (small impact: `[]` reads no evidence), inconsistent with B2's rule. | **T7SP.5-B4.** Defect: a covered session's `historicalFrames` for a later date past coverage resolves `[]` instead of rejecting. Case: `it should reject historicalFrames for a later date beyond the market calendar's coverage`. |

#### T7SP.5-B3, commit `5921ea19`

Case "should include every key its gaps scans read in the binding, as the result of recover binds them" (apostrophe dropped for `-t`): red (`expected [] to have a length of 2 but got +0`), then green. Oracle: `recover` for the same Instruments in the same test; one `{instrumentKey, tradingDate, resolutionRevision}` per date in each gap's `revisions`, after `session.gaps([mno])` and `session.gaps([mno, xyz])`. Fix: a per-session map keyed by Instrument and date holds the keys of each `gaps()` answer (not the whole coverage-start scan), deduplicated, appended after the frame keys in `evidenceBinding`. No conversion existed to reuse: Daily Review only forwards each gap's `revisions` to the later Mark save, and its `bindEvidence` call carries frame keys only, so today's Review save does not recheck gap keys. Frame keys and snapshot ids unchanged; no request list changed. Verification: typecheck, `tsc6`, lint, lint:deps exit 0; market-data 102 passed; integration 191 passed. A note for T7SP.8 is in the handoff (tech debt item 1's trigger).

**ocr review** (`ocr/T7SP.5-B3-5921ea19.json`): No findings. Reviewer's note (not an ocr finding): two `gaps()` calls listing the same Instrument and date with different revisions would overwrite. Not reachable: since B1 every call narrows one cached scan per Instrument, so a key's revision is the same in every answer within a session.

#### T7SP.5-B4, commit `3998e749`

Case "should reject historicalFrames for a later date beyond the market calendar's coverage": clock 2029-02-01, a Historical session on 2026-10-09 asks for 2029-01-05. Red: `expected { frames: [] } to be 'rejected'`; green after the fix: a plain ISO-string comparison `date > day.date` before `resolveDay` rejects at once (B2's two-line guard is subsumed). The session's own date, earlier dates, an earlier uncovered date (still `[]`) and sessions opened outside coverage take the same paths. Verification: typecheck, `tsc6`, lint, lint:deps exit 0; market-data 103 passed; integration 191 passed.

**ocr review** (`ocr/T7SP.5-B4-3998e749.json`): No findings. (The reviewer's note described the test's session as opened outside coverage; checked at `read-session.test.ts:141-147`: the session is `Historical` 2026-10-09, covered, with the clock at 2029-02-01, so the case exercises the defect.)

T7SP.5 and its bug tasks B1–B4 now have ocr reviews with no findings or only dismissed ones.

**Cumulative run `t7sp-5`** (2026-11-10, on `3998e749`, after B1–B4), outputs in `suite-runs/t7sp-5-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 124 files, 1463 tests passed |
| Node integration | 94 files, 191 tests passed |
| Browser (Chromium), task tier | 5 passed (12.1 s); no `e2e/d7sp` folder yet |
| Checks | 14 of 14 exit 0 |

Browser tier printed by `browser-auto 07449b9d`: `browser tier: task (no changed path since 07449b9d is on the full-tier list)`. Ports 5175, 9341, 9342 free before and after.

## T7SP.6 Mark-to-Market Valuation

Behavioral (11 planned cases plus one extra, in `tdd-log.md`). Commit `23edc84b`. New: `src/coordinators/valuation/index.ts`, `value-trade.ts`, `value-trade.test.ts`, `settlement.ts`; `src/coordinators/valuation.ts` moved unchanged to `valuation/dated-line.ts` (`git mv`). `src/coordinators/settlement.ts` keeps only `payoffOf` (ADR 0007). Imports updated, with no behaviour change, in `daily-review/types.ts`, `daily-review/daily-review.ts`, `trade-views/trade-views.ts` and `tests/support/open-detail-fixtures.ts`; no thin re-export. Each test comment cites the existing Trade Views or Daily Review case its expected values come from.

Public API (implementation-level names, P77's were indicative), `src/coordinators/valuation/index.ts`:
- `valueTrade(session: MarketDataReadSession, analysis: TradeAnalysisRecord, options?: { factsAtClose?: boolean; withGaps?: boolean }): Promise<TradeValuation>`;
- `TradeValuation = { kind: 'Valued'; state; evaluation; settlement: SettlementItem[]; gaps: HistoricalGaps[]; frame?; underlyingFrame?; datedLine? } | { kind: 'Unavailable'; reason: 'FactsIncoherent'; findings }`;
- moved and re-exported: `datedCloseOf`, `datedLineOf`, `observationFrame`, `DatedLine`, `settlementTimeOf`, `SettlementItem`, `SettlementTime` (now an alias of Market Data's `MarketDataSettlementTime`, unifying the two copies).

Implementation decisions (accepted by the main session, recorded here and in the handoff):
- **`factsAtClose`:** a Review derives with the cutoff at `session.closeInstant`; a Current read derives with every effective fact, as Trade Views does today. The session doesn't expose its context kind, so the caller passes `{ factsAtClose: true }` for a Review. The caller still never passes a date or an instant (P78). The alternative, always deriving at the close, would change Trade Views' at-entry lines for Lots opened after the last close.
- **`withGaps`:** "when the session recovers" is an option; by default `gaps: []`; when set, the call asks `session.gaps` for derive's requirements with `earliestRelevance` as the exposure.
- **Closed Trades:** detected by stored and expected lifecycle `Closed`, re-derived at `terminalTime.slice(0, 10)` (the UTC date of the terminal instant), as Trade Views does today; no session read, `settlement: []`.
- **Instruments:** from `observationRequirements`; for a `PastExpiration` contract from `contractStatuses`; for a Trade with no Position from `state.positions[0]`, falling back to `plan.underlying` only for an empty Trade, never a Planned Leg.
- **After expiration:** the session's date and close with a `Missing` resolution stand in for the frames, as Daily Review does; Trade Views today still reads those frames and drops that read in T7SP.7.
- **Dated line:** a stock's from `datedLineOf`; an option's reads `session.historicalFrames(date, [Underlying])`; absent when that returns `[]` (outside coverage).
- **Incoherent facts:** the module checks the cutoff derivation only; Daily Review's integrity derivation without a cutoff stays with the caller (A192, T7SP.8).
- The status types are not re-exported from `trade-analysis/index.ts`; no caller outside the module needs them.

Seam: the Application facade exposes no read session or Trade Record, so the test builds `createMarketData` and `createTradeRecord` over `app.persistence`, with fixtures from `tests/integration/d7/support.ts`; it types the facade as `Awaited<ReturnType<typeof onboardedAt>>['app']`, because `lint:deps` forbids `src/coordinators` importing `src/app`.

Case 1's red came from a throwing stub of `valueTrade` (`Error: not implemented`), a runtime failure; the missing import alone would have been an invalid red. Extra case beyond the plan: "should value a Planned Trade holding no Position with no read" (red `TypeError ... reading 'kind'`, green after a guard).

**First-run passes:**
- Case 2, "should value DEF with its Mark missing as Unavailable(MarkMissing, DEF, Mon Oct 12), with realized-to-date still a Value" (built by case 1). Mutation: evaluate with an uncovered observation instead of the session frame; failure `AssertionError: expected { kind: 'Evaluated', …(29) } to deeply equal ObjectContaining{…}`.
- Case 5, "should value O-C at Fri 11-20 from its contract's Mark, with a Due settlement item" (built by cases 3 and 4). Mutation: treat `DueToday` like `PastExpiration`; failure `AssertionError: expected undefined to deeply equal { kind: 'Available', mark: ObjectContaining{…} }`.

Verification: `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` exit 0; `npx vitest run src/coordinators src/domain src/modules/market-data` 58 files, 644 tests; `npm run test:integration` 94 files, 191 tests (every query-count proof unchanged).

**ocr review** (`ocr/T7SP.6-23edc84b.json`): one finding, a bug task.

| Severity | Location | Claim | Reviewer | Outcome |
|---|---|---|---|---|
| medium (bug) | `src/coordinators/valuation/value-trade.ts:75` | With `factsAtClose` on a session outside coverage, `closeInstant` is undefined, so the cutoff is silently dropped and `derive` takes every effective fact, including later ones. | Valid, narrow: Daily Review's `ResolveSession` rejects an uncovered date first, so it can't reach this today; the risk is the module's contract once T7SP.8 routes through it. | **T7SP.6-B1.** Defect: `valueTrade(session, analysis, { factsAtClose: true })` on a session with no close instant values the Trade with facts after the Review date. Fix (main session's recommendation): reject the call, as the session rejects other caller errors, never derive without the cutoff. Case: `it should reject a valuation at the session's close when the session has no close`. |

#### T7SP.6-B1, commit `b5398b91`

Case "should reject a valuation at the session's close when the session has no close": case 6's session (Current, as-of 2029-01-03, outside coverage) with an XYZ stock Trade, `valueTrade(session, analysis, { factsAtClose: true })`. Red: the promise resolved `{ kind: 'Valued', …(4) }`; green after the fix: `valueTrade` throws `valueTrade: factsAtClose needs a session with a close` when `factsAtClose` is set and `session.closeInstant` is undefined, and the cutoff spread is `...(options.factsAtClose && { cutoff: session.closeInstant })`, never dropped silently. Verification: typecheck, `tsc6`, lint, lint:deps exit 0; `npx vitest run src/coordinators` and `npm run test:integration` pass; no existing case changed.

**ocr review** (`ocr/T7SP.6-B1-b5398b91.json`): No findings.

**Cumulative run `t7sp-6`** (2026-11-10, on `b5398b91`, after B1), outputs in `suite-runs/t7sp-6-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 125 files, 1476 tests passed |
| Node integration | 94 files, 191 tests passed |
| Browser (Chromium), task tier | 5 passed (11.1 s); no `e2e/d7sp` folder yet |
| Checks | 14 of 14 exit 0 |

Browser tier printed by `browser-auto 3998e749`: `browser tier: task (no changed path since 3998e749 is on the full-tier list)`. Ports 5175, 9341, 9342 free before and after.
