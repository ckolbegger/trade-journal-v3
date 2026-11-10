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
