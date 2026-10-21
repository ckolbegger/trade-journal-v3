# D2 structural verifications

Each entry records a structural task's exact verification (D2 breakdown, section 5), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Versions are in [provenance.md](provenance.md).

## Cumulative run after T2.1

Run 2026-10-19 15:18 EDT on commit `335e62d` (the only uncommitted files were this run's own outputs).

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 25 passed (25)`, `Tests 218 passed (218)`, exit 0 | `suite-runs/t2.1-replay-positions-lots-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.1-replay-positions-lots-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (41.5s)`, exit 0 | `suite-runs/t2.1-replay-positions-lots-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.1-replay-positions-lots-checks.txt` |

Failures: none.

## Cumulative run after T2.2

Run 2026-10-20 20:56 EDT on commit `c8c798b` (the only uncommitted files were this run's own outputs), Node v26.12.0. The runner first wrote its outputs to a doubled `suite-runs/suite-runs/` path; they were moved to `suite-runs/` unchanged.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 26 passed (26)`, `Tests 230 passed (230)`, exit 0 | `suite-runs/t2.2-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.2-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `1 failed`, `26 passed (43.0s)`, exit 1 | `suite-runs/t2.2-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.2-checks.txt` |

Failures: one, a flaky D1 test unrelated to T2.2 (a pure domain change). `e2e/d1/no-save.spec.ts:46` (B1.14) checks that the raw IndexedDB and Web Storage dump contains no typed value by substring, and the typed quantity `317` occurred inside a random identity (`bad21aeb-76ec-477b-9964-4d53171e3bd6`, the Plan Reflection definition). `journalEntries` and `trades` were empty, so nothing was saved. Reproduced in the main session: `npx playwright test e2e/d1/no-save.spec.ts --project=chromium` gave `1 passed`. The assertion itself is left unchanged pending the user's decision.

## Cumulative rerun after T2.2

Run 2026-10-20 21:09 EDT on commit `ecc2294` at the user's request (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 26 passed (26)`, `Tests 230 passed (230)`, exit 0 | `suite-runs/t2.2-rerun-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.2-rerun-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (40.8s)`, exit 0 | `suite-runs/t2.2-rerun-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.2-rerun-checks.txt` |

Failures: none. B1.14 passed this time, consistent with the earlier failure being the identity-substring flake.

## Cumulative run after the B1.14 flake fix

Run 2026-10-20 21:16 EDT on commit `50b68e3` (the fix itself is `98e730b`, recorded in `evidence/D01/structural.md`; the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 26 passed (26)`, `Tests 230 passed (230)`, exit 0 | `suite-runs/b1.14-fix-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/b1.14-fix-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (40.9s)`, exit 0 | `suite-runs/b1.14-fix-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/b1.14-fix-checks.txt` |

Failures: none.

## Cumulative run after T2.3

Run 2026-10-20 22:42 EDT on commit `237c869` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 27 passed (27)`, `Tests 241 passed (241)`, exit 0 | `suite-runs/t2.3-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.3-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (43.1s)`, exit 0 | `suite-runs/t2.3-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.3-checks.txt` |

Failures: none.

## T2.8 capacity re-measure at schema 2 (interim; T2.18 replaces allowances)

Agreed added step of T2.8: `SCHEMA_VERSION` is now 2, so the capacity basis measured at schema 1 no longer verifies. Re-measured in Chromium through the application stack at schema 2 with the record kinds that exist now (Trades with their Plan Reflection Entries, Catalog records). The Position Change, Execution, and Position Change Reflection outcome allowances in `tools/capacity/profile.ts` are kept unchanged; T2.18 replaces them with measured bytes. The tool's checks were not changed.

Before the re-measure:

```text
$ npm run verify:capacity
FAIL basis measured at schema version 1, current is 2: run measure:capacity
```

Re-measure:

```text
$ npm run measure:capacity
chromium 153.0.8010.12: {"plans":500,"usageBefore":147456,"usageAfter":1601536,"bytesPerTradeWithReflection":2908.16,"jsonBytesPerTradeWithReflection":2344.634,"overheadRatio":1.2403471074803145,"jsonBytesPerCatalogRecord":237.33333333333334}
measure:capacity OK: M 544103178 bytes, required quota 1632309534 bytes

$ npm run verify:capacity
verify:capacity OK: required quota 1632309534 = 3 × 544103178, schema 2
```

| Figure | Schema 1 basis (2026-10-19) | Schema 2 basis (this run) |
|---|---|---|
| Engine | Chromium 153.0.8010.12 | Chromium 153.0.8010.12 |
| Bytes per Trade with Plan Reflection | 2,932.736 | 2,908.16 |
| Overhead ratio | 1.2508 | 1.2403 |
| Projected Workspace M | 548,701,233 bytes | 544,103,178 bytes |
| Required quota (3 × M) | 1,646,103,699 bytes | 1,632,309,534 bytes |

`src/delivery/capacity-basis.json` now names `schemaVersion: 2`. The small drop is measurement variance in Chromium's `estimate()` usage, not a schema effect: the measured record shapes are unchanged at schema 2 (the new index stays empty for Planned Trades without `activityDesc`, and the new stores hold nothing yet).

## Cumulative run after T2.8

Run 2026-10-20 23:20 EDT on commit `7b16aaa` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 28 passed (28)`, `Tests 251 passed (251)`, exit 0 | `suite-runs/t2.8-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.8-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (42.4s)`, exit 0 | `suite-runs/t2.8-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 10 of 11 exit 0 | `suite-runs/t2.8-checks.txt` |

Failures: one, **expected and agreed with the user on 2026-10-20**. `npm run verify:fixtures` exits 1 with `FAIL workspace-v1: getStatus is IntegrityBlocked, not Ready`: T2.8 set `SCHEMA_VERSION` to 2, and this release cannot open the frozen v1 fixture until T2.10 adds migration. The fixture and the tool are unchanged. T2.10 owns the fix; nothing is pushed until it passes. Any other failure is a real one.

## Cumulative run after T2.4

Run 2026-10-21 12:37 EDT on commit `a76d16b` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 29 passed (29)`, `Tests 264 passed (264)`, exit 0 | `suite-runs/t2.4-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.4-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (43.2s)`, exit 0 | `suite-runs/t2.4-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 10 of 11 exit 0 | `suite-runs/t2.4-checks.txt` |

Failures: one, the expected `verify:fixtures` failure (`FAIL workspace-v1: getStatus is IntegrityBlocked, not Ready`) that T2.10 clears. No other failure.

## Cumulative run after T2.5

Run 2026-10-21 12:49 EDT on commit `b7f3583` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 30 passed (30)`, `Tests 276 passed (276)`, exit 0 | `suite-runs/t2.5-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.5-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (42.5s)`, exit 0 | `suite-runs/t2.5-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 10 of 11 exit 0 | `suite-runs/t2.5-checks.txt` |

Failures: one, the expected `verify:fixtures` failure (`FAIL workspace-v1: getStatus is IntegrityBlocked, not Ready`) that T2.10 clears. No other failure.

## Cumulative run after T2.9

Run 2026-10-21 12:58 EDT on commit `0733f71` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 33 passed (33)`, `Tests 284 passed (284)`, exit 0 | `suite-runs/t2.9-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.9-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (44.0s)`, exit 0 | `suite-runs/t2.9-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 10 of 11 exit 0 | `suite-runs/t2.9-checks.txt` |

Failures: one, the expected `verify:fixtures` failure (`FAIL workspace-v1: getStatus is IntegrityBlocked, not Ready`) that T2.10 clears. No other failure.

## T2.10 `verify:fixtures` opens older fixtures through `initialize`

D1's T1.31 row says `verify:fixtures` checks that migration succeeds after a later schema change. Two minimal changes to `tools/verify-fixtures.ts`, and none to `tests/fixtures/workspace-v1/`:

- It calls `Workspace.initialize({})` before `getStatus`, failing the fixture unless the result is `Opened`, so an older dump migrates first.
- It launches with `sequentialIds('verify')` instead of `launchOn`'s default `fx` prefix, because the migration mints new identities (the Position Change Reflection definition, the candidate database name) and the fixture's own identities use the `fx-` prefix; a repeated identity overwrote the fixture's Plan Reflection definition.

`tools/fixtures/workspace-fixture.ts` also passes the in-process lifecycle lock to `createApplication`, and `viewsOf` accepts any object with `TradeViewsAndReporting` (type-only), so the Workspace migration test reuses it.

| Command | Result |
|---|---|
| `npm run verify:fixtures` | exit 0: `verify:fixtures OK: workspace-v1 open (migrating where older) Ready at schema 2 with views equal to their snapshots` |

## Cumulative run after T2.10

Run 2026-10-21 13:13 EDT on commit `101bf8c` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 34 passed (34)`, `Tests 292 passed (292)`, exit 0 | `suite-runs/t2.10-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.10-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (43.3s)`, exit 0 | `suite-runs/t2.10-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.10-checks.txt` |

Failures: none. `verify:fixtures` passes again: the v1 fixture migrates to schema 2 (T2.10), which clears the expected failure carried since T2.8.

**Implementation decision (T2.10, recorded 2026-10-21).** A30 says retired and abandoned candidate databases are deleted "after the flip and on every later root inspection". While the pointer still names an older schema, an unlocked launch inspection could delete a candidate another tab is copying into, so in that state abandoned candidates are deleted only under the `tj-lifecycle` lock, by `persistence.discardAbandoned()` just before a migration creates its candidate. Once the pointer names the current schema, every inspection cleans them, as T2.8 built. This is a reading of A30's "later" (after the flip), not a deviation.

## Cumulative run after T2.6

Run 2026-10-21 13:26 EDT on commit `cbe9b54` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 35 passed (35)`, `Tests 306 passed (306)`, exit 0 | `suite-runs/t2.6-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.6-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (45.7s)`, exit 0 | `suite-runs/t2.6-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.6-checks.txt` |

Failures: none.

**Implementation decisions (T2.6, recorded 2026-10-21).** A command Execution naming a Planned Leg the Plan does not have is rejected as `VariantNotInstalled(OtherInstrument)` before analysis (serving another leg's terms is D10's Planned-Leg Terms); `IntegrityDisagreement` stays for stored incoherent facts (I2.8 c). An unknown Trade surfaces as `StorageFailure`, because D2 cannot delete a Trade. An extra case rejects an empty Position Change with `NoExecutions`.

## Cumulative run after T2.7

Run 2026-10-21 13:39 EDT on commit `a1a9ad0` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 36 passed (36)`, `Tests 314 passed (314)`, exit 0 | `suite-runs/t2.7-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.7-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (40.7s)`, exit 0 | `suite-runs/t2.7-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.7-checks.txt` |

Failures: none.

**Implementation decisions (T2.7, recorded 2026-10-21).** The Planned form of Detail is returned only when both stored and expected lifecycle are Planned; any other Trade gets the Open form (so a stored-Planned Trade with opening facts shows its disagreement). Deviation count counts recorded occurrences whose latest version is Active. Average open cost is the quantity-weighted Open Lot price, excluding fees. Three type-only edits outside T2.7's scope (`src/app/types.ts`, `TradeDetail.tsx`, a D1 integration test) keep typecheck at 0 until T2.11 and T2.14 replace them.

## T2.11 Installed Capability Manifest and composition root

Command: `npm run verify:capabilities`

```text
> trade-journal-v3@0.0.0 verify:capabilities
> node tools/verify-capabilities.ts

verify:capabilities OK: 12 operations, 3 variant-qualified, 7 routes, 2 Entry Types, schema 2, release 853915999821e451dab53a036014cc8b75c550437222e52b40765fad954a9b29
```

Result: exit 0. The manifest adds `TradeWorkflows.recordPositionChange` (variants `Opening`, `Increase`, `Stock`, `SingleTrade`, `Complete`, `Decline`), the `Open` variant of `TradeViewsAndReporting.browseTrades` and `TradeViewsAndReporting.getTradeDetail`, the Entry Type `entry-type.position-change-reflection`, and `schemaVersion: 2`. The facade exposes `TradeWorkflows.recordPositionChange`; the route map gains `record-entry` (`/trades/:tradeId/record-entry`), and the `trades` and `trade-detail` routes now name the lifecycle variants they present (Open and Planned).

The verifier was extended for D2: a route may name the variants it presents, and the check fails when a route presents an absent variant, when an installed variant of a variant-qualified operation is presented by no route, when the manifest's schema version differs from the one this release writes, or when a declared Entry Type has no seeded definition in a fresh Workspace. Each new rule was confirmed to fail by a temporary edit, then restored:

```text
FAIL route trades presents absent variant TradeViewsAndReporting.browseTrades (Closed)
FAIL installed variant TradeViewsAndReporting.browseTrades (Open) is not presented by any route
FAIL manifest names schema version 1, but this release writes 2
FAIL declared Entry Type entry-type.daily-review has no seeded definition
```

Interim screen: until T2.12 builds the Position Change form, `record-entry` renders the existing Trade Detail screen (`src/main.tsx`), so the app still runs. The Trades list and Detail routes keep D1's screens until T2.13 and T2.14.

## Cumulative run after T2.11

Run 2026-10-21 13:45 EDT on commit `1a40034` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 36 passed (36)`, `Tests 314 passed (314)`, exit 0 | `suite-runs/t2.11-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.11-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (41.5s)`, exit 0 | `suite-runs/t2.11-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.11-checks.txt` |

Failures: none.

## Cumulative run after T2.12

Run 2026-10-21 13:56 EDT on commit `534c0f0` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 322 passed (322)`, exit 0 | `suite-runs/t2.12-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.12-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (41.2s)`, exit 0 | `suite-runs/t2.12-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.12-checks.txt` |

Failures: none.

## Fix after T2.13: D1 browser specs open the Planned tab

T2.13 (`19eaaf8`, A32) made Open the default Trades tab at `/`, so D1 browser steps that expected the Planned list there timed out. The fix changes only the D1 browser specs; no production code changes.

- `e2e/d1/support.ts`: adds `PLANNED` (`/?lifecycle=Planned`), `openPlanned` (clicks the "Planned" tab in the "Trades by lifecycle" tablist and checks it is selected), and `expectNoTradesYet` (asserts the Open tab's Empty state, "No open trades. Recording an entry on a Planned Trade opens it.", then opens Planned and asserts "No planned trades yet"). `onboard` now ends with `expectNoTradesYet`, so it still finishes on the empty Planned list.
- Direct navigations that expect Planned rows or the Planned Empty state go to `PLANNED`: B1.2 and B1.3 relaunch, B1.4 both offline reopenings, B1.13 clean tab, B1.14 restart, and B1.6 (`/?lifecycle=Planned&faults=…`).
- Steps that reach the Trades view through the Primary navigation click the Planned tab before their Planned assertion: B1.14 after leaving the form, B1.15 axe "Planned list".
- The critic-2 onboarding case uses `expectNoTradesYet`; the B1.15 keyboard-only case, which only checks the screen after onboarding, asserts the Open tab's Empty state instead.

No D1 assertion was removed or weakened.

| Run | Command | Result |
|---|---|---|
| Reproduction before the change | `npx playwright test e2e/d1/plan.spec.ts -g "B1.2"` | 1 failed (timeout in `onboard` at `support.ts:120` waiting for "No planned trades yet") |
| Before (T2.13 cumulative run) | `npm run test:e2e` | 20 failed, 7 passed (`suite-runs/t2.13-browser.txt`) |
| After | `npm run test:e2e` | `27 passed (42.5s)`, exit 0 |
| Checks | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | 4 of 4 exit 0 |
