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
