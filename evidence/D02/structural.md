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

## Cumulative run after T2.13

Run 2026-10-21 14:04 EDT on commit `19eaaf8`, Node v26.12.0. Unit `Test Files 37 passed (37)`, `Tests 326 passed (326)`; Node integration `Test Files 6 passed (6)`, `Tests 19 passed (19)`; static and verification checks 11 of 11 exit 0. **Browser (Chromium) `npm run test:e2e`: 20 failed, 7 passed (2.1m), exit 1** (`suite-runs/t2.13-browser.txt`). Every failure timed out waiting for `No planned trades yet` at `/`, because T2.13 made the Open tab the default (A32); reproduced in the main session with `npx playwright test e2e/d1/plan.spec.ts -g "B1.2"` (1 failed). The fix was delegated to a fresh subagent (`171441b`, heading "Fix after T2.13" above), with no production change.

## Cumulative run after T2.13-RERUN

Run 2026-10-21 14:09 EDT on commit `171441b` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 326 passed (326)`, exit 0 | `suite-runs/t2.13-rerun-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.13-rerun-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (41.1s)`, exit 0 | `suite-runs/t2.13-rerun-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.13-rerun-checks.txt` |

Failures: none.

## Cumulative run after T2.14

Run 2026-10-21 14:18 EDT on commit `054f58a` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 332 passed (332)`, exit 0 | `suite-runs/t2.14-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.14-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (41.5s)`, exit 0 | `suite-runs/t2.14-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.14-checks.txt` |

Failures: none.

## Cumulative run after T2.15

Run 2026-10-21 14:24 EDT on commit `1330a4e` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 337 passed (337)`, exit 0 | `suite-runs/t2.15-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.15-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (41.6s)`, exit 0 | `suite-runs/t2.15-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.15-checks.txt` |

Failures: none.

## T2.16 Fault build: migration stages

`src/delivery/faults.ts` (faults build only) adds `migrationFaults()`, passed by `src/main.tsx` as `ApplicationDeps.migrationHooks` (carried by `compose.ts` into Workspace; production passes none). Faults act only at the migration stage boundaries; copying, validation, activation and every view stay production code.

- `migration:validate`: the `validated` hook adds one issue (`UnknownAccount`, Trade and Account `fault-injected`) to the real validators' issues, so the migration returns `MigrationBlocked` at stage `Validate`.
- `migration:activate`: the `activating` hook throws inside the real root flip transaction, after its writes; `inRoot` now aborts the transaction on any error from its work, so nothing commits. `activateCandidate` returns `Aborted`, and the migration discards the candidate and returns `MigrationBlocked` at stage `Activate` with issue `ActivationFailed`.
- `migration:hold`: `beforeActivate` waits until `window.__tjFaults.release()`.
- `window.__tjFaults.set([...])` now accepts readiness checks and migration fault names; `release()` frees a held migrator (and arms a fresh hold for any later attempt).
- `verify:no-fault-hooks` also searches the production `dist/` for each migration fault name.

| Command | Result |
|---|---|
| `npm run build:faults && npm run verify:no-fault-hooks` | exit 0: `dist-faults/assets/faults-BkuDJYOz.js 1.47 kB`; `verify:no-fault-hooks OK: …/dist has no fault hooks` |
| `npm run build && npm run verify:release` | exit 0: `OK …/dist: release 864961122ffa3153bb2e6b78121ab29d9cafb6e8271feb015b541d5c95dc7966, 6 assets` |
| `npm run verify:no-fault-hooks -- dist-faults` (negative control) | exit 1: `FAIL fault hook in production build: assets/faults-BkuDJYOz.js:` for `tj-fault-hooks-v1`, `__tjFaults`, `migration:validate`, `migration:activate`, `migration:hold` |

Hook behaviour against a real v1 migration (a throwaway Node test, not committed: the v1 fixture on `fake-indexeddb`, `window` stubbed with `?faults=migration:validate`, hooks from `migrationFaults()`):

```text
?faults=migration:validate -> {"kind":"MigrationBlocked","stage":"Validate","issues":[{"code":"UnknownAccount","tradeId":"fault-injected","accountId":"fault-injected"}]}
__tjFaults.set(['migration:activate']) -> {"kind":"MigrationBlocked","stage":"Activate","issues":[{"code":"ActivationFailed"}]} ; databases: tj-root,tj-ws-fx-0003
__tjFaults.set(['migration:hold']) -> settled after 200 ms: false
__tjFaults.release() -> Opened
```

The browser cases that use these faults (B2.4, B2.6) belong to T2.23.

## Cumulative run after T2.16

Run 2026-10-21 14:31 EDT on commit `4bbf4ff` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 340 passed (340)`, exit 0 | `suite-runs/t2.16-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.16-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (40.7s)`, exit 0 | `suite-runs/t2.16-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.16-checks.txt` |

Failures: none.

## T2.17 Previous-release harness

`npm run build:releases && npm run verify:releases` (2026-10-21, Node v26.12.0), second run (the d1 build reused from its cache):

```
build:releases: d1 reused from /var/folders/ks/n63g0mm937v5rdb147g4txg40000gn/T/tj-release-d1-402b94835793 (claude-opus-5.5-d1 at 402b94835793587df2d10de1f3564e276843618b)
build:releases OK: v1, v2, v2-corrupt, d1, d2 in /Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/dist-releases; v2-corrupt alters /assets/index-B21LeF9u.css
verify:releases OK: v1 583ce8d6b026c6d87383e9862719e6551fa90c2ffbce4310b5615f1474fed50d, v2 ac9db116ce5388a52c97bb7432ee578c1da43ec128faf6fdeb2aba91f7ace407, v2-corrupt fails only on /assets/index-B21LeF9u.css, d1 9c8b5b3dac0bff4a2ddda1888ee01c8532b419da03ba1a9f080e4f0fc77dee78 schema 1, d2 ab964e0bee2261f09c0ccd8ca000520c41b548bee559c70f7d3a790c8bd613bb schema 2
```

The first (cold) run printed `build:releases: d1 built in …` instead, with the same identities, and took about 5 seconds in all (npm ci from the local cache).

How `d1` is built (A34): `tools/build-releases.ts` resolves the tag `claude-opus-5.5-d1` to its commit, runs `git archive` into `<os tmpdir>/tj-release-d1-<commit12>` (no checkout, no worktree), runs `npm ci` there from D1's own lockfile, then D1's own `npm run build` with `TJ_BUILD_LABEL=d1` (the v1/v2 label mechanism, which D1's `release-plugin.ts` already reads) and `DEV_PORT=5175` (D1's vite config demands it; it is in the uncommitted `.env.local`). A marker file holding the commit makes repeat runs copy the cached `dist`. `NODE_ENV` is removed from the child's environment, because Vite's in-process builds set it to `production` and `npm ci` would then skip the dev dependencies. `d2` is the current source built with label `d2`. Both are plain root-scoped builds, so they share the harness origin `localhost:5175` and service-worker scope with v1, v2 and the faults build.

`verify:releases` now also runs `verify:release` on d1 and d2, requires v1, v2, d1 and d2 to have four distinct identities, and reads each release's schema version from what its bundle writes to the Workspace schema meta record (`` key:`schema`,schemaVersion:N ``, exactly one per bundle): d1 1, d2 2. Negative control: replacing `dist-releases/d1` with a copy of d2 made it fail with `FAIL releases share an identity …` and `FAIL d1: reports schema 2, expected 1`.

Switching: in Playwright, `startReleaseServer({ root: process.cwd(), release: 'dist-releases/d1' })`, then `server.use('dist-releases/d2')` or `server.use('dist-faults')`. For the critic, `npm run serve:releases -- d1` starts on d1 (default v1) with the project folder as root; keys 1 v1, 2 v2, 3 v2-corrupt, 4 d1, 5 d2, f dist-faults (needs `npm run build:faults` first), q quit. Smoke-checked: the server returned d1's, d2's and the faults build's identities in turn on one origin, and the keypresses 4, 5, f switched the served folder.

## Cumulative run after T2.17

Run 2026-10-21 14:36 EDT on commit `a154d80` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 340 passed (340)`, exit 0 | `suite-runs/t2.17-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.17-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (43.9s)`, exit 0 | `suite-runs/t2.17-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.17-checks.txt` |

Failures: none.

## T2.18 Capacity basis recomputed for schema 2

The in-browser measurement (`tools/capacity/measure-page.ts`, Chromium through Playwright, production application facade only) now has a second phase. After the 500 Plans it opens the first 200 of them through `TradeWorkflows.recordPositionChange`, reading each Trade's FactRevision and Planned Leg through `getTradeDetail`. The Trades get 1, 2, 3, 2, … Position Changes, which comes to 400, and the Position Changes get 1, 2, 3, 2, … Executions, which comes to 800. Every fifth reflection is a decline (80 declines, 320 Entries; half the declines give a reason and half the Entries have a note). This follows the D2 plan's section 1.3.

The method is D1's overhead-ratio method, applied to the phase. The phase's overhead ratio is its `estimate().usage` delta divided by the JSON bytes it added: Trade documents plus `journalEntries`, `journalDeclines`, and `journalObligations`. Each kind's on-disk bytes are its own JSON bytes times that ratio:
- **Execution:** the Execution facts inside the Trade documents.
- **Position Change:** the Trade document's growth beyond its Executions. This covers the Position Change fact, Last Activity, the counters, and any recorded Deviations.
- **Position Change Reflection outcome:** the growth of the three Journal stores.

`tools/capacity/profile.ts` moves these three kinds from `ALLOWANCES` to `MEASURED`, at mature counts of 100,000, 200,000, and 100,000. `project` adds `count × measured bytes` for each of them. `verify:capacity` was not changed.

One method change on the Plan phase: its JSON now also counts the Plan Reflection's obligation record, since T2.5 gives Plan Reflections obligation records too. Without that, the obligation bytes T2.4 and T2.5 added after T2.8 counted as overhead. They inflated the ratio to 1.565 (two trial runs: 1.5688 and 1.5653) and scaled every remaining allowance with it. With the obligation records counted, the ratio is 1.4704. The remaining gap above T2.8's 1.2403 is not attributed record by record. The likely cause is the per-commit rewrite of the `meta {key:'tradeRecord'}` record that T2.4 added, which is real on-disk usage, so it stays in the ratio.

```text
$ npm run measure:capacity
chromium 153.0.8010.12: {"plans":500,"usageBefore":147456,"usageAfter":1986560,"bytesPerTradeWithReflection":3678.208,"jsonBytesPerTradeWithReflection":2501.43,"overheadRatio":1.4704421071147304,"jsonBytesPerCatalogRecord":237.33333333333334,"openTrades":200,"positionChanges":400,"executions":800,"reflectionEntries":320,"reflectionDeclines":80,"usageAfterOpen":2985984,"positionChangeOverheadRatio":1.0319106098182997,"jsonBytesPerPositionChange":449.255,"jsonBytesPerExecution":366.95,"jsonBytesPerPositionChangeReflection":1238.14,"bytesPerPositionChange":463.5910010139202,"bytesPerExecution":378.65959827282506,"bytesPerPositionChangeReflection":1277.6498024404298}
measure:capacity OK: M 577161694 bytes, required quota 1731485082 bytes

$ npm run verify:capacity
verify:capacity OK: required quota 1731485082 = 3 × 577161694, schema 2
```

To check the guard, the basis was temporarily edited to `"schemaVersion": 1` and then restored byte for byte:

```text
$ npm run verify:capacity
FAIL basis measured at schema version 1, current is 2: run measure:capacity
(exit 1)
```

| Figure | Before (T2.8 basis) | After (T2.18) | Basis after T2.18 |
|---|---|---|---|
| Engine | Chromium 153.0.8010.12 | Chromium 153.0.8010.12 | |
| Trade with Plan Reflection, bytes (× 25,000) | 2,908.16 → 72,704,000 | 3,678.208 → 91,955,200 | measured |
| Plan-phase overhead ratio | 1.2403 | 1.4704 | measured |
| Position Change, bytes (× 100,000) | 700 JSON × 1.2403 = 868.24 → 86,824,298 | 449.255 JSON × 1.0319 = 463.59 → 46,359,100 | **measured** (was allowance) |
| Execution, bytes (× 200,000) | 450 JSON × 1.2403 = 558.16 → 111,631,240 | 366.95 JSON × 1.0319 = 378.66 → 75,731,920 | **measured** (was allowance) |
| Position Change Reflection outcome, bytes (× 100,000) | 600 JSON × 1.2403 = 744.21 → 74,420,826 | 1,238.14 JSON × 1.0319 = 1,277.65 → 127,764,980 | **measured** (was allowance) |
| Catalog records (× 60) | 17,663 | 20,939 | measured JSON × plan-phase ratio |
| Remaining allowances (Close Review, Daily Trade Review Actions, Review Notes, Marks, Daily Bars, Correction versions) | 198,505,151 | 235,329,555 | allowance JSON × plan-phase ratio |
| Projected Workspace M | 544,103,178 bytes | 577,161,694 bytes | |
| Required quota (3 × M) | 1,632,309,534 bytes | 1,731,485,082 bytes (+6.1%) | |

`src/delivery/capacity-basis.json` names `schemaVersion: 2` and holds these figures. The required quota rose by about 99 MB, to 1.73 GB. Chromium on the dev machine reports a quota of 10,737,418,240 bytes (Playwright Chromium 153.0.8010.12, `navigator.storage.estimate()` on a localhost page, 708 GB free disk), which is well above 1.73 GB, so readiness stays Writable in the browser suites.

Disclosed limits:
- Measured Executions stand in for the whole mature count of 200,000 "Executions and settlement facts" until D7 measures settlement facts.
- Measured Entries and declines stand in for the whole 100,000 Position Change Reflection outcomes until D5 adds Debt.
- The six kinds listed above remain allowances.

## Cumulative run after T2.18

Run 2026-10-21 14:45 EDT on commit `bae4262` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 340 passed (340)`, exit 0 | `suite-runs/t2.18-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.18-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (42.9s)`, exit 0 | `suite-runs/t2.18-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.18-checks.txt` |

Failures: none.

## T2.19 Schema-v2 Workspace fixture; v1 fixture migrated

Built: `tools/fixtures-freeze.ts` builds D1's content through the facade (initialize, Fidelity and Charles Schwab, three Accounts, five confirmed Plans) and then three Open Trades, each the reference Trade (100 shares, entry 50.00, Stop 47.50, Target 56.00, confirmed 2026-10-12 09:00 America/New_York) with a prefix of PC1–PC3 recorded through `TradeWorkflows.recordPositionChange`:

| Trade | Account | Position Changes and reflections | Result |
|---|---|---|---|
| CSCO | Roth IRA | PC1 Complete, PC2 Complete, PC3 Decline with reason | Resolved, 120 open, Filled With Deviation, the fixture's one Entry Size (Excess) occurrence of 20 shares caused by PC3 |
| KO | Individual | PC1 Complete, PC2 Decline without reason | Resolved, 100 open, Filled As Planned |
| PFE | Brokerage | PC1 Decline with reason | Entering, 60 of 100, Partially Filled |

`viewsOf(app, schemaVersion)` (in `tools/fixtures/workspace-fixture.ts`) returns, for schema 1, the Planned list and its Details exactly as before; from schema 2 it adds the Open list and the Open Trades' Details. `tools/verify-fixtures.ts` now requires a fixture older than the current schema to open with a migration receipt from its schema to the current one, and a fixture at the current schema to open without one; both must then be Ready with views equal to their snapshot. The T2.10 migration test passes the v1 schema version to `viewsOf`.

| Command | Result |
|---|---|
| `npm run fixtures:freeze -- --schema 2` | `fixtures:freeze OK: tests/fixtures/workspace-v2 (schema 2, 5 Planned and 3 Open Trades, 3 Accounts)`, exit 0. The dump holds `tj-root` (pointer to `tj-ws-fx-0004`) and `tj-ws-fx-0004` (meta schema 2; 8 trades, 11 journal entries, 3 declines, 14 obligation records). |
| `npm run verify:fixtures` | `workspace-v1: schema 1, migrated to 2 into tj-ws-verify-0001, views equal`; `workspace-v2: schema 2, opened without migration, views equal`; `verify:fixtures OK: workspace-v1, workspace-v2 open Ready at schema 2 with views equal to their snapshots`, exit 0 |
| `verify:fixtures` with CSCO's `"deviationCount": 1` changed to `0` in a copy of the v2 snapshot | `FAIL workspace-v2: views differ from expected-views.json`, exit 1; snapshot restored (`cmp` equal) and rerun OK |
| `npm run fixtures:freeze -- --schema 2` again | `fixtures:freeze: tests/fixtures/workspace-v2 exists; committed fixtures are never regenerated`, exit 1 |
| `git diff --stat -- tests/fixtures/workspace-v1` | empty: the v1 fixture is unchanged |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |

## Cumulative run after T2.19

Run 2026-10-21 14:49 EDT on commit `068e249` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 340 passed (340)`, exit 0 | `suite-runs/t2.19-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.19-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (43.1s)`, exit 0 | `suite-runs/t2.19-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.19-checks.txt` |

Failures: none.

## T2.20 Deterministic benchmark generator and bench build

**Bench build.** `npm run build:bench` is `vite build --mode bench --outDir dist-bench`. Only in that mode does `src/main.tsx` import `src/app/bench-generator.ts`, which installs `window.__tjBench.generate()` (the generator entry point; marker `tj-bench-generator-v1`). The generator creates its own application through `createApplication` (the production facade) on the real browser host, release identity, capacity requirement and Web Locks, with seeded identities (mulberry32, seed 20211011, version-4-shaped) and a clock that starts at 2021-10-11T13:00:00Z and moves forward with the generated Economic Times (five minutes after each). It passes the new optional `ApplicationDeps.skipMutationRecheck`, which returns true only while the generator runs; `createMutationGuard` then uses the session's current readiness instead of rerunning readiness (D1 A4). Production passes nothing, so the guard always rechecks there (an inert optional parameter, like T2.16's `migrationHooks`).

**Dataset (plan section 1.3).** 1,260 weekday sessions from 2021-10-11 (to 2026-08); about 20 Plans per session from 13:45Z at 15-minute steps. Every 125th Trade from the 62nd is opened (200, spread over five years), with 1–3 Position Changes (pattern 1, 2, 3, 2) on the following sessions at 19:30Z, each with 1–3 Executions (same pattern), totalling to 10/10, 6/10, 10/10, 12/10 or 10/10 of the planned quantity (40 Entering, 40 with an Entry Size Excess). Every fifth Position Change Reflection is a Decline. 3 Institutions with 2 Accounts each; Long Stock.

**Generator run.** `npm run bench:generate` (`tools/bench-generate.ts`) reuses the cached profile when its stamp (`.cache/bench/profile/tj-bench.json`, written last) matches the generator version (`BENCH_GENERATOR_VERSION` in `src/app/bench.ts`) and `SCHEMA_VERSION`; otherwise it deletes the profile, serves `dist-bench/` with the release harness server on `http://localhost:5181`, waits for the service worker to control the page, runs the generator in Chromium (Playwright persistent context), reloads and reads the rendered "Open Trades" table, unregisters every service worker and deletes every cache, then reopens the profile on a blank page of the same origin to confirm none remain.

Outputs:
- Cached profile: `.cache/bench/profile` (about 47 MB; git-ignored through `.cache/`). `dist-bench/` is git-ignored too.
- `bench/dataset.json` (committed, provenance): generator and schema versions, seed, clock start, time zone, origin, bench release identity, counts, generation time, engine, host.
- `bench/expected-open-rows.json` (committed, for T2.21): the "Open Trades" table headers and 200 rows of cell text in display order, plus the 200 `browseTrades({ lifecycle: 'Open' })` items (bigints written as decimal strings), with the generator and schema versions.

| Command | Result |
|---|---|
| `npm run build:bench && npm run bench:generate` (first, no profile) | `bench:generate: no cached profile; generating for generator 1, schema 2`; `bench:generate: profile has 0 service-worker registrations, 0 caches, databases tj-root, tj-ws-1d1eee39-d350-4dfa-bdcd-46aa5ed8a778`; `bench:generate OK: {"trades":25000,"openTrades":200,"plannedTrades":24800,"positionChanges":400,"executions":800,"planReflectionEntries":25000,"positionChangeReflectionEntries":320,"positionChangeReflectionDeclines":80,"institutions":3,"accounts":6,"strategies":1} in 34701 ms`, exit 0 (whole command 35.6 s) |
| `npm run build:bench && npm run bench:generate` (second) | `bench:generate OK: reusing the cached profile …/.cache/bench/profile (generator 1, schema 2)`, exit 0 |
| stamp changed to generator 0, then `npm run bench:generate` | `cached profile is generator 0, schema 2; regenerating for generator 1, schema 2`; same counts in 34271 ms; `cmp` of `bench/expected-open-rows.json` with the first run's copy: identical (same Workspace database name, so identities are deterministic too) |
| stamp changed to schema 1, then `npm run bench:generate` | `cached profile is generator 1, schema 1; regenerating for generator 1, schema 2`; same counts in 34707 ms; expected rows identical |
| `npm run bench:generate` again | reusing the cached profile, exit 0 |
| `npm run build && npm run verify:no-fault-hooks` | `verify:no-fault-hooks OK: …/dist has no fault or bench hooks` (the check now also searches for `tj-bench-generator-v1` and `__tjBench`) |
| `npm run verify:no-fault-hooks -- dist-bench` | exit 1: `assets/bench-generator-DR5l-QSb.js: tj-bench-generator-v1`, `… __tjBench`, so the search finds the generator where it exists |
| file lists of `dist/` and `dist-bench/` compared | dist-bench adds only `assets/bench-generator-*.js`; the main chunk differs by the bench branch (449.00 kB versus 449.20 kB); every other file name is the same |
| `npx vitest run src/coordinators/mutation-guard.test.ts` | 4 passed |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |

Generation rate: 25,000 Plans and 400 Position Changes in about 34.5 s on an Apple M4 Max (Chromium 153.0.8010.12), about 1.4 ms per mutation.

## Cumulative run after T2.20

Run 2026-10-21 18:21 EDT on commit `9821261` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 340 passed (340)`, exit 0 | `suite-runs/t2.20-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.20-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (40.9s)`, exit 0 | `suite-runs/t2.20-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.20-checks.txt` |

Failures: none.

## T2.21 Latency harness and query count

**Harness.** `npm run bench:run` is `node tools/bench-run.ts`. It checks the cached profile's stamp against `BENCH_GENERATOR_VERSION` and `SCHEMA_VERSION` (running `build:bench` and `bench:generate` when missing or stale), runs `npm run build`, copies `.cache/bench/profile` to a temporary directory, and serves production `dist/` with `startReleaseServer({ root: process.cwd(), release: 'dist', port: BENCH_PORT })` on `http://localhost:5181`. One online warm-up launch waits for the service worker to control the page and for `tj:interactive`, compares the Open list with `bench/expected-open-rows.json`, and is excluded. The server is then closed and every later launch is offline (Playwright `offline: true`). 30 cold starts each launch Chromium on the copied profile, navigate to the origin, take the `tj:interactive` mark's `startTime` (navigation start to mark), check the Open table has 200 rows, and close the process; the process-launch-to-mark time is recorded beside it for disclosure and not gated. 30 warm switches in one page: click Planned, wait for the "Planned Trades" table, clear `tj:open-list-ready`, click Open, and time from the pointer press (capture-phase `pointerdown` listener) to the next `tj:open-list-ready`. After the runs the Open list is compared again. p95 is nearest-rank (`ceil(0.95 × 30)` = 29th sorted value). The report goes to `evidence/D02/bench.md`; exit 1 when cold p95 > 2,500 ms or warm p95 > 1,500 ms.

**Query count.** `tests/support/request-counter.ts` is the disclosed request counter (plan section 6.0): it wraps fake-indexeddb's `IDBObjectStore`, `IDBIndex` and `IDBCursor` request methods with a logger that, only inside `countRequests(work)`, records `{on, store, index?, method, count?}` and then calls the original with the same receiver and arguments. `tests/integration/d2/query-count.test.ts` builds the data through the facade on the D1 Node application stack (`tests/integration/d1/support.ts`: `device`, `onboarded`, `planCommand`): 3 Trades opened with `recordPositionChange`, then 1,000 Planned Trades; it counts the requests of `TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' })`, adds 1,000 more Planned Trades, and counts again. `test:integration` already accepts the path filter (vitest project `integration`), so the script is unchanged.

| Command | Result |
|---|---|
| `npm run bench:run` | exit 0. `Open list before the runs: 200 rows, equal to the expected rows`; `Open list after the runs: 200 rows, equal to the expected rows`; `cold p95 88.8 ms (budget 2500), warm p95 43.5 ms (budget 1500); wrote evidence/D02/bench.md`; `bench:run OK`. Process launch to mark (not gated) p95 159.8 ms. Apple M4 Max, 16 cores, 64 GiB, Darwin 25.6.0, Chromium 153.0.8010.12 headless via Playwright 1.63.0, Node v26.12.0 |
| `npm run test:integration -- d2/query-count` | 1 passed (2.9 s). With 1,000 and with 2,000 Planned Trades the Open page issues the same 9 requests: `meta.get` ×2, `trades` index `byLifecycleActivity` `getAll` count 201 (the only request on `trades`), `meta.get` ×2, `catalog.getAll`, `meta.get` ×3; 3 items returned |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |

**Cold p95: 88.8 ms (budget 2,500 ms). Warm p95: 43.5 ms (budget 1,500 ms).** Earlier development runs of the same harness gave cold 86.9 / 87.9 ms and warm 42.9 / 44.5 ms.

## Cumulative run after T2.21

Run 2026-10-21 18:28 EDT on commit `c0a7ff8` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 340 passed (340)`, exit 0 | `suite-runs/t2.21-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 7 passed (7)`, `Tests 20 passed (20)`, exit 0 | `suite-runs/t2.21-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (40.2s)`, exit 0 | `suite-runs/t2.21-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.21-checks.txt` |

Failures: none.

## T2.22 Node mock-free integration suite

**Suite.** `tests/integration/d2/` follows D1's conventions (plan section 6.1): `createApplication({ indexedDB, host: NodeTestHost, clock, ids, locks: createInProcessLifecycleLock() })`, facade operations only, "restart" is a new application on the same factory, "unchanged" is `dumpAll` of every store. `support.ts` holds the device (factory, host, fixed clock at 2026-10-12 17:00 New York, sequential identities, one in-process lock), the reference Trade (Plan 09:00, PC1 10:00 60 @ 50.10, PC2 11:00 40 @ 50.30, PC3 14:00 20 @ 51.00, fees 1.00) built through `confirmPlan` and `recordPositionChange`, the T2.2 Entry Quality figures, the v1 fixture loader (`loadDump`, identities prefixed `mig`), and the raw writer used only while no application is open. Files are named for the acceptance-matrix filters where one file can serve: `migration` (I2.1–I2.4), `open-position` (I2.5), `scale-in` (I2.6), `entry-quality` (I2.6 for AC-CALC-001: the reference Trade and a 200-share Plan, 1R $500), `rejections` (I2.7), `integrity` (I2.8 a, b), `integrity-incoherent` (I2.8 c), `earlier-dated` (I2.9), `write-gate` (I2.10), `rebuild` (I2.11), `seed` (I2.12). `query-count.test.ts` (T2.21) is unchanged and still imports the D1 support module.

**Interruption points (I2.3).** The stopped application gets a factory wrapper whose named call throws, as if the process ended there; every step before it is production code, and the restart uses the plain factory. (a) The copy is one transaction, so the two states an interruption can leave are both run: the candidate's second open (listed and created, before the copy commits) and its third open (listed and copied, before seeding and validation). (b) The `deleteDatabase` of the old database after the root flip.

**Readings.** Obligation and Entry counts in I2.5 and I2.6 count Position Change Reflection records only (Plan Reflections have their own since T2.5). I2.7's Sell is a separate command returning `VariantNotInstalled{variants:['Sell']}` (T2.6 and A18 return it before any other check), while the other four invalid inputs are one command whose six issues come back together.

| Case | File | Result |
|---|---|---|
| I2.1 Migrate the v1 fixture | `migration.test.ts` | pass |
| I2.2 Migration failure and retry | `migration.test.ts` | pass |
| I2.3 Interrupted migration (a, two stop points; b) | `migration.test.ts` | pass (3 tests) |
| I2.4 Concurrent migration | `migration.test.ts` | pass |
| I2.5 Open a position | `open-position.test.ts` | pass |
| I2.6 Scale-in, Entry Quality, Entry Size | `scale-in.test.ts`, `entry-quality.test.ts` | pass (3 tests) |
| I2.7 Rejections write nothing | `rejections.test.ts` | pass |
| I2.8 Integrity disagreement (a), (b) | `integrity.test.ts` | pass (2 tests) |
| I2.8 Integrity disagreement (c) | `integrity-incoherent.test.ts` | **fails, not committed**: `Error: incoherent` thrown by `getTradeDetail` (`src/coordinators/trade-views/trade-views.ts:284`); handed to a fix task, which commits the test with the fix |
| I2.9 Earlier-dated entry | `earlier-dated.test.ts` | pass |
| I2.10 Write gate | `write-gate.test.ts` | pass |
| I2.11 Rebuild equivalence | `rebuild.test.ts` | pass |
| I2.12 Fresh initialization at schema 2 | `seed.test.ts` | pass |

| Command | Result |
|---|---|
| `npm run test:integration` (with the uncommitted I2.8 c file present) | `Test Files 1 failed | 17 passed (18)`, `Tests 1 failed | 37 passed (38)`; the one failure is I2.8 (c), `Error: incoherent` at `trade-views.ts:284:47` |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |

D1's section 6.1 cases (I1.1–I1.11) all pass in the same run.

## I2.8 (c) fix

Suite failure: when `derive` returned `IncoherentFacts`, `getTradeDetail` and the Open `browseTrades` threw, so one incoherent Trade broke its Detail and the whole Open page. AC-LIFE-003 says normal reads "surface or block"; the plan's I2.8 row requires Ready with the findings, so reads now surface.

Decision:

- **Detail.** `TradeDetailView` gains a third form, `IncoherentTradeDetail`: the stored Plan, stored lifecycle (`lifecycle: { stored }`, no agreement), labels, `recordedPositionChanges` (as stored; with no replay there is no Fact Order), recorded `deviations`, `findings: IncoherentFactFinding[]` (exactly Trade Analysis's `{ factId, reason }`, the same findings `recordPositionChange` returns in `IntegrityDisagreement`), and the whole narrative. It has no Baseline, Position, fees, entry status, Entry Resolution, Entry Quality or fulfillment, because each needs a replay and a number must never be invented (trade-analysis spec, "A caller must not convert either class into a plausible number"). The brief suggested widening `OpenTradeDetail.findings`; a separate form was chosen instead so the coherent Open and Planned shapes (and so `verify:fixtures` and the bench expected rows) stay byte-for-byte unchanged. The field is named `recordedPositionChanges`, not `positionChanges`, so the existing `'positionChanges' in view` checks still select only the derived Open form.
- **List.** The Open item union adds `IncoherentOpenTradeItem`: `OpenTradeItem` without `openQuantity`, `averageOpenCost`, `incurredFees` and `entryStatus`, with `integrity: 'Disagrees'`. Planned quantity, Deviation count (recorded) and last activity stay, as they come from stored records.
- **UI.** Trade Detail shows the "Records disagree" region with a table "Facts that cannot be replayed" (Record, Problem; for example "Execution at 2026-10-12 11:00", "Names a Planned Leg that is not in the Plan"), the sentence that the Position, entry and fulfillment figures are unavailable, then the Plan, Position Changes and Journal; the Plan Baseline region shows only when the view has a Baseline. The Open list shows "Unavailable" in the Quantity, Average cost, Fees and Entry cells and "Records disagree" in Integrity.
- **Not changed.** A Planned-list item still needs a replayed Baseline, so `browseTrades({ lifecycle: 'Planned' })` still throws for a Trade stored as Planned whose facts are incoherent (not in I2.8's cases; an incoherent Trade with Position Changes is stored Open by every write path). The incoherent Detail still offers "Record entry" while Writable; saving returns `IntegrityDisagreement`.

Verification: `npm run test:integration` 38 passed; `npx vitest run src/coordinators/trade-views src/ui/screens` passed; `npm run verify:fixtures` views equal; `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` exit 0.

## Cumulative run after T2.22

Run 2026-10-21 11:55 EDT on commit `31a0578` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 342 passed (342)`, exit 0 | `suite-runs/t2.22-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 18 passed (18)`, `Tests 38 passed (38)`, exit 0 | `suite-runs/t2.22-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (44.0s)`, exit 0 | `suite-runs/t2.22-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.22-checks.txt` |

Failures: none.

After the I2.8 (c) fix (31a0578); T2.22 suite commit 69f4c77.

## I2.7 reading (settled with the user 2026-10-24)

I2.7's "all issues together for the first five in one command" is read together with A18: a Sell returns `VariantNotInstalled` before any other check (as T2.6's case requires), so the Sell is sent as its own command, and the other four invalid inputs (before the Plan time, future time, quantity 0, blank required answers) are sent in one command that returns all six issues together. The user confirmed this reading.

## T2.23 Browser integration suite (Chromium)

**Suite.** `e2e/d2/` runs against the built app on `localhost:5175` through D1's fixtures (`e2e/d1/support.ts`: the release harness server serving `dist-faults` by default, persistent Chromium profiles, the read-only probe). `e2e/d2/support.ts` adds the reference Plan with a fixed Plan time (2026-10-12 09:30 New York), the entry-form steps (row groups "Execution N", the Position Change Reflection's required answers, Decline with a reason), the D1-release onboarding and update steps (`checkForUpdate`, Reload from the notice), killable spawned Chromium processes, the integrity fixture writer, and the axe and keyboard helpers of D1's B1.15. `npm run test:e2e` now runs `e2e/d1 e2e/d2`.

**Techniques, each changing no application behaviour.**

- *Migration message (B2.3).* The message can show for a few milliseconds, so an init script's `MutationObserver` records whether its text was ever rendered; it only reads the DOM.
- *Old tab during migration (B2.5).* With tab A's form unsaved, D1 disables Reload in every tab, so the race the D1 amendment closes (the update activating while tab A still holds unsaved values) is produced by tab B posting `{ type: 'ApplyUpdate' }` to the waiting worker: the message its Reload button sends. Tab B then reloads through its own `controllerchange` handler and migrates.
- *Kills (B2.6, B2.7).* Chromium processes spawned with default features and killed with SIGKILL, relaunched the same way (D1's B1.3 lesson). Before each relaunch the browser's own saved session (`Default/Sessions`) is removed and its last exit marked clean in `Default/Preferences`: otherwise Chromium restored the killed tab, so B2.6's relaunch also reopened `/?faults=migration:hold` beside the case's page. Only browser profile files change, never the app's storage.
- *Stored write stamps.* Comparisons of migrated records with the pre-update records leave out the persistence write stamp `revision`, which every database write assigns and the migration's copy therefore renumbers.
- *Integrity fixture writer (B2.13 and B2.12's Error state).* Launches the profile with service workers blocked on a blank page of the app's origin, edits the current Workspace's raw `trades` record, and closes the browser before the case launches the app: never during a run (D2 section 6.0).
- *Open list Loading (B2.12).* The page holds the Workspace's `trades` store behind a read-write transaction that only reads (`count()` repeated), so the Open read waits and "Loading open trades…" stays on screen for axe; releasing it renders the list. Nothing is written.
- *Open list Error (B2.12).* The fixture writer adds a member identity with no Execution to the Trade's Position Change, so `browseTrades` rejects and the list shows its Error state. This relies on the known T2.9 gap (a Position Change naming a missing Execution makes `derive` throw rather than return `IncoherentFacts`); if a later fix surfaces that Trade as incoherent instead, this state needs another trigger.

| Case | File | Result |
|---|---|---|
| B2.1 Open a position | `open-position.spec.ts` | pass |
| B2.2 Scale-in and decline (Entry Quality: $50.18, $270.00 (1.08R), $580.00, 2.15 (planned 2.4), $18.00) | `open-position.spec.ts` | pass |
| B2.3 Update from D1 with data | `update.spec.ts` | pass |
| B2.4 Migration Blocked (faults build) | `update.spec.ts` | pass |
| B2.5 Old tab during migration | `update.spec.ts` | pass |
| B2.6 Kill during migration (faults build) | `update.spec.ts` | pass |
| B2.7 Kill after commit | `durability.spec.ts` | pass |
| B2.8 Offline cold restart | `durability.spec.ts` | pass |
| B2.9 Recovery Only (faults build) | `durability.spec.ts` | pass |
| B2.10 Mid-session failure (faults build) | `durability.spec.ts` | pass |
| B2.11 Nothing saved without Save | `no-save.spec.ts` | pass |
| B2.12 Responsive and accessible (resize, axe on the entry form with and without issues, receipt, Open list Empty, Loading, Ready, Error, Open Detail entering and resolved, migration views awaiting migration, Migration Blocked, migrating; keyboard-only entry) | `responsive-a11y.spec.ts` | pass (3 tests) |
| B2.13 Integrity surfaced | `integrity.spec.ts` | **fails, not committed**: the Trade stored as Planned is listed under Planned, whose rows have no integrity badge (received row text `XYZLong StockFidelity — Roth IRA2026-10-12 09:30$250.00$600.002.4Awaiting entry`); the Detail panel and the unchanged probe pass. Production defect handed back to the main session. |

| Command | Result |
|---|---|
| `npm run test:e2e` (with the uncommitted B2.13 file present) | `1 failed`, `41 passed (1.5m)`; the one failure is B2.13, `expect(locator).toContainText(expected) failed … Expected substring: "Records disagree"` |
| `npx playwright test e2e/d2`, run twice more | `1 failed`, `14 passed` each time (B2.13 only) |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |

Every D1 section 6.2 case passes in the same run. Engines: Playwright 1.63.0, Chromium 153.0.8010.12, macOS 26.6.2.

## B2.13 fix

B2.13 failed because an Open Trade stored as Planned is listed under Planned (the lifecycle index keys on the stored lifecycle; I2.8 (a) asserts that placement and stays), and the Planned list item carried no integrity indicator. AC-LIFE-003 ("normal reads surface or block on the structured disagreement") requires every normal read to surface it, so the Planned item now does, as the Open item already did (T2.7).

- `PlannedTradeItem` gains an optional `integrity?: 'Disagrees'`, set by `plannedItem()` only when `derived.findings` is non-empty. An agreeing item keeps D1's shape exactly, so the committed v1 and v2 fixture snapshots still compare equal (`npm run verify:fixtures`: views equal for both).
- `PlannedList` shows the Open list's "Records disagree" badge (`badge warning`) inside the existing Entry cell, after "Awaiting entry". No column is added, so the D1 Planned table and its browser specs are unchanged for agreeing Trades.
- `entryReadiness` stays "Awaiting entry". It describes the stored Planned lifecycle the list is filed under, and the badge beside it tells the trader that the records disagree; Detail's "Records disagree" panel shows stored Planned against expected Open.
- Not covered: a Planned Trade whose facts are incoherent (not replayable) still throws in `browseTrades({lifecycle:'Planned'})`; that is a separate case left open.

Verification: `npx playwright test e2e/d2/integrity.spec.ts -g "B2.13"` 1 passed (after `npm run build:faults`); `npm run test:e2e` 42 passed; `npx vitest run src/coordinators/trade-views src/ui` 88 passed; `npm run test:integration` 38 passed; typecheck, `tsc6`, lint and `lint:deps` exit 0.

## Cumulative run after T2.23

Run 2026-10-21 12:20 EDT on commit `839fb0b` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 344 passed (344)`, exit 0 | `suite-runs/t2.23-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 18 passed (18)`, `Tests 38 passed (38)`, exit 0 | `suite-runs/t2.23-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `42 passed (1.4m)`, exit 0 | `suite-runs/t2.23-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.23-checks.txt` |

Failures: none.

After the B2.13 fix (839fb0b); T2.23 suite commit 9cac498.

## critic-1 defect 1 fix

At 375 and 320 px the Open list (`scrollWidth` 890) and the Open Trade Detail (596) scrolled the whole page sideways. Two causes, both CSS: the shell's grid items kept their content's minimum width, so a wide table widened `main` past the viewport even inside its `.table-scroll` region; and the description lists' `max-content` term column took the width of the longest term (a Prompt) on the Detail. Fix in `src/ui/app.css`: `.shell > * { min-width: 0; }`, and `dl` columns `fit-content(50%) minmax(0, 1fr)`. The two Records disagree tables ("Stored versus expected", "Facts that cannot be replayed") gained the same named, focusable `.table-scroll` region the other tables use; no existing name or region changed. New browser cases in `e2e/d2/narrow.spec.ts` (T2.24 rows in `tdd-log.md`) check `scrollWidth <= innerWidth` at both widths and that every table sits in a scroll container within the viewport. `npm run test:e2e` 44 passed; `src/ui` unit tests 72 passed; typecheck, `tsc6`, lint and `lint:deps` exit 0.

## Cumulative run after T2.24-CRITIC1-FIX

Run 2026-10-21 12:38 EDT on commit `e8735b0` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 344 passed (344)`, exit 0 | `suite-runs/t2.24-critic1-fix-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 18 passed (18)`, `Tests 38 passed (38)`, exit 0 | `suite-runs/t2.24-critic1-fix-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `44 passed (1.5m)`, exit 0 | `suite-runs/t2.24-critic1-fix-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.24-critic1-fix-checks.txt` |

Failures: none.

After the critic-1 defect 1 fix (e8735b0).

## critic-2 defects fix

Defect 1: at 375 and 320 px the Planned list scrolled the page sideways (`scrollWidth` 677). Since the critic-1 fix let the shell's grid items shrink (`.shell > * { min-width: 0 }`), only tables inside a `.table-scroll` region stay within the viewport, and the Planned table had none. Fix in `src/ui/screens/TradeList.tsx`: the Planned table now sits in the same named, focusable region the Open table uses (`role="region"`, `tabIndex={0}`, `aria-label="Planned Trades"`, equal to the caption); no D1 spec relied on the old structure, and the table's accessible name is unchanged. Defect 2: About was 386 px wide because "TradeViewsAndReporting.getTradeDetail (Planned, Open)" and "America/New_York" could not break. Fix in `src/ui/app.css`: `.about dd, .about li { overflow-wrap: anywhere; }`, so the values wrap in full and are never truncated. New browser cases in `e2e/d2/narrow.spec.ts` (T2.24 rows in `tdd-log.md`) for both defects, plus a guard case (it passed on its first run) that measures first run, onboarding, Accounts, the New Plan form and the Planned Detail at both widths; none of those overflowed. `npm run test:e2e` 47 passed; `src/ui` unit tests 72 passed; typecheck, `tsc6`, lint and `lint:deps` exit 0.

## Critic cost (measurement agreed with the user 2026-10-24)

Figures from each critic's completion notice (the harness's own token count; comparable across critics, not a billing figure). Brief v1 = the critic writes all Playwright plumbing itself; brief v2 = `.claude/docs/critic-brief.md`, setup helpers from `e2e/d2/support.ts`. The after sample is critic-3 on the same flows (an extra measurement run if critic-2 passes; otherwise the next gate critic).

| Critic | Commit | Brief | Tokens | Tool calls | Duration | Defects |
|---|---|---|---|---|---|---|
| critic-1 | `2440e0f` | v1 | 141,559 | 44 | 9 min 18 s | 1 |
| critic-2 | `40581f7` | v1 | 121,270 | 32 | 7 min 19 s | 2 |
| critic-3 | `19971ed` | v2 | 136,644 | 50 | 9 min 45 s | 0 |
| critic-4 | `4b109b7` | v2 | 112,888 | 43 | 7 min 1 s | 0 |
| critic-5 (T2.55) | `b3392bb` | v2 | 191,688 (resumed segment only) | 21 (resumed segment) | 4 min 50 s (resumed segment) | 5 |
| critic-6 (T2.55) | `7f2a1fd` | v2 | stopped by the user, no report | — | — | — |
| critic-7 (T2.55) | `9dc8068` | v2 | 180,493 | 69 | 13 min 58 s | 0 |

Reading: no measurable saving from brief v2 in this sample. critic-3 sits between critic-1 and critic-2 on tokens and above both on tool calls and time; it also did more beyond the flows (axe at 1280 and 320, a B2.10 mid-form fault, narrow checks of six screens). With one sample per brief and a 14% spread between the two v1 runs, the difference is within noise. critic-4 (after the follow-up batch) ran five of the eleven flows plus a wider narrow check, so it is not directly comparable.

## Cumulative run after T2.24-CRITIC2-FIX

Run 2026-10-21 12:53 EDT on commit `a7872a7` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 344 passed (344)`, exit 0 | `suite-runs/t2.24-critic2-fix-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 18 passed (18)`, `Tests 38 passed (38)`, exit 0 | `suite-runs/t2.24-critic2-fix-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `47 passed (1.6m)`, exit 0 | `suite-runs/t2.24-critic2-fix-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.24-critic2-fix-checks.txt` |

Failures: none.

After the critic-2 defects fix (a7872a7).

## Reload after save treated as a defect (user direction 2026-10-24)

critic-2's minor observation "reloading the receipt at `/trades/<id>/record-entry` shows a blank Record entry form, which could invite a duplicate entry" is treated as a defect at the user's direction. Intended behavior: the receipt still replaces the form in place (T2.12), and the entry-form history entry is replaced once the save succeeds, so reload, or Back then Forward, lands on the Trade Detail, never on a blank form.

## Reload after save fix

Mechanism: on a `Recorded` result, `PositionChangeForm` sets the receipt in its own state (so the receipt still replaces the form in place, as T2.12 designed) and then calls `window.history.replaceState(window.history.state, '', '/trades/<id>')`. React Router's `BrowserRouter` listens only to `popstate` and its own navigations, so it does not re-render the Trade Detail over the receipt; the router's state object (its `idx` and key) is passed through unchanged, so its history index stays consistent. A reload then loads `/trades/<id>` (the Trade Detail), Back then Forward returns to that same Trade Detail entry, and "Back to the Trade" stays an ordinary router link that pushes the Trade Detail. Rejected, Conflict and refusal results never reach the replace, so the form, its values and its URL stay as they were. The dirty-form guard does not fire: the form reports `onDirtyChange(false)` as soon as the receipt is set (dirty is false once recorded), and no router navigation or unmount happens on save, so D1's update-waits-for-unsaved-form behavior is released exactly as before. The router-replace alternative (`navigate(..., { replace: true, state })`) was not used because it renders the Trade Detail route at once, which would have required the Detail to carry the receipt and changed T2.12's design.

Cases: `e2e/d2/after-save.spec.ts` (browser: URL after save, reload, Back then Forward, one stored Position Change) and the `PositionChangeForm.test.tsx` case "should replace the entry form history entry with the Trade Detail URL once saved, …" (unit, under `BrowserRouter` in jsdom). Checks: `npx vitest run src/ui` 73 passed; `npm run test:e2e` 48 passed; typecheck, `tsc6`, lint and `lint:deps` exit 0.

## Cumulative run after T2.24-RELOAD-FIX

Run 2026-10-21 13:01 EDT on commit `968938c` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 345 passed (345)`, exit 0 | `suite-runs/t2.24-reload-fix-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 18 passed (18)`, `Tests 38 passed (38)`, exit 0 | `suite-runs/t2.24-reload-fix-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `48 passed (1.6m)`, exit 0 | `suite-runs/t2.24-reload-fix-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.24-reload-fix-checks.txt` |

Failures: none.

After the critic-2 fixes (a7872a7) and the reload-after-save fix (968938c).

## Acceptance-matrix commands

User direction 2026-10-24: every command in the section 8 table of the D2 breakdown must run as written. This was a test-file reorganization only, with no changes to `src/`, `specs/` or `plan/`. Test bodies were moved verbatim and case names kept.

- `e2e/d2/update.spec.ts` was renamed to `e2e/d2/migration.spec.ts` with `git mv` (B2.3 to B2.6).
- B2.8 moved from `e2e/d2/durability.spec.ts` to `e2e/d2/offline.spec.ts`. B2.9 and B2.10 moved to `e2e/d2/runtime-failure.spec.ts`. B2.7 stays in `durability.spec.ts`. Each file imports only what it uses.
- I2.5's AC-RESP-001 checks (the `recordPositionChange` response equals the Detail read after restart) moved out of `tests/integration/d2/open-position.test.ts` into a new test in `tests/integration/d2/responses.test.ts`, "should return the Trade, derivation, and Entry equal to the Detail read after restart". It repeats I2.5's setup up to the restart. `open-position` keeps the receipt's lifecycle transition, the Open and Planned lists, and the store-dump and index checks. The split adds one integration test, so the total goes from 38 to 39.

Run 2026-10-24, after `npm run build:faults`. Every command selected at least one test and exited 0.

| Row | Command | Result |
|---|---|---|
| AC-POS-001, AC-LIFE-001 | `npm run test:integration -- d2/open-position` | Test Files 1 passed (1), Tests 1 passed (1) |
| AC-POS-005 | `npm run test:integration -- d2/scale-in` | Test Files 1 passed (1), Tests 1 passed (1) |
| AC-CALC-001 | `npm run test:integration -- d2/entry-quality` | Test Files 1 passed (1), Tests 2 passed (2) |
| AC-LIFE-003 | `npm run test:integration -- d2/integrity` | Test Files 2 passed (2), Tests 3 passed (3) |
| AC-REST-004 | `npm run test:integration -- d2/migration` | Test Files 1 passed (1), Tests 6 passed (6) |
| AC-REST-004 | `npx playwright test e2e/d2/migration.spec.ts` | 4 passed (17.5s) |
| AC-JOUR-001 | `npx playwright test e2e/d2/no-save.spec.ts` | 1 passed (2.1s) |
| AC-JOUR-007 | `npm run test:integration -- d2/seed` | Test Files 1 passed (1), Tests 1 passed (1) |
| AC-JOUR-005 | `npm run test:integration -- d2/rejections` | Test Files 1 passed (1), Tests 1 passed (1) |
| AC-RESP-001 | `npm run test:integration -- d2/responses` | Test Files 1 passed (1), Tests 1 passed (1) |
| AC-CAP-001 | `npm run verify:capabilities` | `verify:capabilities OK: 12 operations, 3 variant-qualified, 7 routes, 2 Entry Types, schema 2` |
| AC-DEL-001 | `npx playwright test e2e/d2/offline.spec.ts` | 1 passed (3.1s) |
| AC-DEL-004, AC-DEL-006 | `npx playwright test e2e/d2/runtime-failure.spec.ts` | 2 passed (3.4s) |
| AC-DEL-003 | `npx playwright test -g "B2.3"` | 1 passed (4.5s) |
| AC-UI-001, AC-UI-002 | `npx playwright test e2e/d2/responsive-a11y.spec.ts` | 3 passed (12.3s) |
| AC-REBUILD-001 | `npm run test:integration -- d2/rebuild` | Test Files 1 passed (1), Tests 1 passed (1) |
| AC-PERF-001 | `npm run bench:run` | `cold p95 96.5 ms (budget 2500), warm p95 43.2 ms (budget 1500)`, Open list 200 rows equal to expected, `bench:run OK` |

The `bench:run` rerun rewrote `evidence/D02/bench.md`. That file was restored, so the recorded gate run stays in place. This rerun's summary is the row above.

| Totals | Command | Result |
|---|---|---|
| Integration | `npm run test:integration` | Test Files 19 passed (19), Tests 39 passed (39): 38 before, plus the AC-RESP-001 split |
| Browser | `npm run test:e2e` | 48 passed (1.6m), unchanged |
| Static | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |

## Cumulative run after MATRIX-UPDATE

Run 2026-10-21 13:26 EDT on commit `8443101` (the only uncommitted files were this run's own outputs and the untracked older handoff note), Node v26.12.0.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 345 passed (345)`, exit 0 | `suite-runs/matrix-update-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 19 passed (19)`, `Tests 39 passed (39)`, exit 0 | `suite-runs/matrix-update-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `48 passed (1.6m)`, exit 0 | `suite-runs/matrix-update-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/matrix-update-checks.txt` |

Failures: none.

After the test-file renames that make every section 8 command run as written (8443101); integration 39 (AC-RESP-001 split into d2/responses).

## Cumulative run after T2.25

Run 2026-10-24 17:14 EDT on commit `0c9d17f` (T2.25, F1: an incoherent Planned Trade is listed as disagreeing instead of breaking the Planned page), Node v26.12.0. Run label `t2.25`.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 346 passed (346)`, exit 0 | `suite-runs/t2.25-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 19 passed (19)`, `Tests 42 passed (42)`, exit 0 | `suite-runs/t2.25-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `49 passed (1.6m)`, exit 0 | `suite-runs/t2.25-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.25-checks.txt` |

Failures: none. Integration rose from 39 to 42 (T2.25's three `browseTrades` cases); browser from 48 to 49 (the Planned-row case in `e2e/d2/integrity.spec.ts`).

**T2.25 decision (implementation level, for the final report):** the incoherent Planned item (`IncoherentPlannedTradeItem`) omits `entryReadiness` as well as 1R, Original Planned Reward and Reward : risk, as the Open list's incoherent item omits `entryStatus`, because "Awaiting entry" would be false for a Trade with recorded Executions. The Entry cell therefore reads "Not available" beside the "Records disagree" badge.

**ocr review of T2.25** (`ocr-review` step, user's direction 2026-10-24): commit `0c9d17f`, session `dca176fe-4f45-4b2e-a358-8788daa718d7`, model `gpt-6.1-sol`, 5 files reviewed (5 excluded: 4 test files by ocr's default path rule, and `tdd-log.md` as an unsupported type), 0 comments. No findings. ocr warned that the background file was 2,002 characters, over its recommended 2,000; the `ocr-review` agent now trims the background below that.

## T2.26

**ocr review of T2.26** (`ocr-review` step): commit `b3ffd8d`, session `2f5f880a-2ae5-40bb-83c9-8e1ef986e917`, model `gpt-6.1-sol`, 2 files reviewed (4 excluded), 0 comments. No findings. Raw output: `ocr/t2.26-b3ffd8d.json`. (T2.25's raw output is kept beside it as `ocr/t2.25-0c9d17f.json`.)

**Cumulative run after T2.26:** run 2026-10-24 17:29 EDT on commit `b3ffd8d` (T2.26, F2: no Record entry on an incoherent Trade; explanation beside the "Records disagree" panel and on the entry route), Node v26.12.0. Run label `t2.26`.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 349 passed (349)`, exit 0 | `suite-runs/t2.26-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 19 passed (19)`, `Tests 42 passed (42)`, exit 0 | `suite-runs/t2.26-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `50 passed (1.7m)`, exit 0 | `suite-runs/t2.26-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.26-checks.txt` |

Failures: none. Unit rose from 346 to 349 (T2.26's three UI cases); browser from 49 to 50 (the incoherent-Detail case in `e2e/d2/integrity.spec.ts`).

**T2.26 reading (implementation level):** "beside the Records disagree panel" is built as a paragraph inside that region, with the shared text `INCOHERENT_ENTRY_NOTE` ("New entries cannot be recorded for this Trade until its records agree."). The entry route checks the loaded Detail before loading the reflection definition and shows h1 "Record entry", that sentence, and "Back to the Trade"; it shows whether or not the session is Writable. No first-run passes.

## T2.27

**Structural check (axe on the entry form's Not Found and Error states).** The plan says "axe on the Not Found and Error states in the unit environment (as the D1 view-state tests do)". The D1 view-state axe checks run in the browser through `@axe-core/playwright`, and there is no unit-tier axe, so, as decided with the user on 2026-10-24, the check is one Chromium case in `e2e/d2/responsive-a11y.spec.ts`: "should report no WCAG 2.1 AA violations on the entry form Not Found and Error states". It uses the shared `expectAccessible` call (tags wcag2a, wcag2aa, wcag21a, wcag21aa).
- Not Found: `/trades/no-such-trade/record-entry` on a healthy onboarded profile; asserts h1 "Trade not found" and the "Back to Trades" link, then zero violations.
- Error: the B2.12 Open-list trigger (`writeIntegrityFixture` with `MissingMember`, a Position Change naming a missing Execution, so the Detail cannot be assembled) on the Reference Trade after one recorded entry; asserts "We couldn’t load this entry form. Nothing was changed." and the Retry button, then zero violations. No production fault hook was added. When F12's gap is fixed in D8, this case needs another trigger, as B2.12's does.

| Command | Result |
|---|---|
| `npm run build:faults` | exit 0 |
| `npx playwright test e2e/d2/responsive-a11y.spec.ts -g "Not Found and Error states"` | `1 passed`, exit 0 |
| `npx playwright test e2e/d2/responsive-a11y.spec.ts` | `4 passed`, exit 0 |

**ocr review of T2.27** (`ocr-review` step): commit `266d0c5`, session `d4537fc9-d2bb-4f23-a314-fa9222960126`, model `gpt-6.1-sol`, 1 file reviewed (4 excluded: the e2e spec, the unit test and two evidence docs), 2 comments. Raw output: `ocr/t2.27-266d0c5.json`. The user decides what happens to each finding; none is fixed or dismissed yet.

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `src/ui/screens/PositionChangeForm.tsx:91` | Results from a superseded load attempt aren't ignored. A late rejection of the first definition request can replace a working, retried form with Error. | Valid: the load effect has no cleanup or generation guard, so any callback from an earlier attempt still calls `setFailure` or `setView`. The `current ?? 'Error'` guard doesn't stop it, because `failure` is `undefined` again after Retry. The race needs a slow first request that fails after a successful Retry, so it is narrow. |
| medium | bug | `src/ui/screens/PositionChangeForm.tsx:124` | Retry keeps the old `view` and `definition`. The form can render from the first attempt's Trade before the retried Trade load finishes. `failure` is also not reset when `tradeId` or `facade` changes. | Doubtful: the retained `view` is real, because Retry only clears `failure`. After a definition-only failure the form shows the earlier Trade, which was a successful load. The save carries `view.factRevision`, so a stale revision ends in the existing Conflict path rather than a wrong write. The `tradeId` reset is unlikely to matter if the route remounts the form, but I did not confirm that. Resetting `view` and `definition` on Retry would be a cheap hardening. |

**Cumulative run after T2.27:** run 2026-10-24 17:39 EDT on commit `266d0c5` (T2.27, F3: entry form Not Found and Error-with-Retry states), Node v26.12.0. Run label `t2.27`.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 353 passed (353)`, exit 0 | `suite-runs/t2.27-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 19 passed (19)`, `Tests 42 passed (42)`, exit 0 | `suite-runs/t2.27-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `51 passed (1.7m)`, exit 0 | `suite-runs/t2.27-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.27-checks.txt` |

Failures: none. Unit rose from 349 to 353 (T2.27's four cases); browser from 50 to 51 (the axe case on the entry form's Not Found and Error states).

### Bug tasks from T2.27's ocr findings (user's direction 2026-10-24)

The user directed both findings to be written up as bug tasks and fixed. Each goes to its own fresh `tdd-task` subagent, failing test first, through the `PositionChangeForm` seam (`src/ui/screens/PositionChangeForm.test.tsx`, test facade `tests/support/position-change-form-facade.ts`). Red and green rows go in `tdd-log.md` under the task IDs below. Neither changes a schema, fixture, view shape or public type.

**T2.27-B1 Superseded load attempts are ignored** (finding 1, `PositionChangeForm.tsx:91`). The load effect has no cleanup or generation guard, so a callback from an earlier attempt still calls `setFailure` or `setView` after Retry.

```text
describe("Record entry load attempts")
  it should keep the form loaded by Retry when the first attempt's definition load fails afterwards
  it should ignore a late successful result from a superseded attempt, so the form shows the Retry attempt's Trade and definition
```

**T2.27-B2 Retry starts from a clean load** (finding 2, `PositionChangeForm.tsx:124`). Retry clears only `failure`, so the earlier attempt's `view` and `definition` stay and the form can render before the retried loads finish; `failure` is not reset when the Trade changes.

```text
describe("Record entry Retry")
  it should show Loading, not the earlier attempt's Trade, after Retry until both retried loads finish
  it should start from Loading with no carried-over failure when the route moves to another Trade
```

The second B2 case depends on whether the route remounts the form per Trade. If it already passes, it gets the mutation check and is flagged as a first-run pass.

**ocr review of T2.27-B1** (`ocr-review` step): commit `9b62f83`, session `03d32f5a-6845-4206-816e-fe0992e14765`, model `gpt-6.1-sol`, 1 file reviewed (2 excluded: the test file and `tdd-log.md`), 0 comments. No findings. Raw output: `ocr/t2.27-b1-9b62f83.json`.

**ocr review of T2.27-B2** (`ocr-review` step): commit `c96fbc8`, session `3247df0b-913f-411e-a783-7154edff2d65`, model `gpt-6.1-sol`, 1 file reviewed (the test file and `tdd-log.md` excluded), 0 comments. No findings. Raw output: `ocr/t2.27-b2-c96fbc8.json`.

**T2.27-B2 notes (implementation level):** the route renders one element per route id with no key per Trade (`src/main.tsx`), so moving to another Trade keeps the form mounted; that is why case 2 had a genuine red. A change of `facade` or `tradeId` is caught during render through internal `loadingFor` state and clears `view`, `definition` and `failure`. Not reset on a Trade change: the entered rows, answers, the decline choice and reason, issues, and the conflict and recorded states.

**Cumulative run after T2.27-B1 and T2.27-B2:** run 2026-10-24 17:49 EDT on commit `c96fbc8` (working tree carried only uncommitted evidence edits), Node v26.12.0. Run label `t2.27-b2`.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 357 passed (357)`, exit 0 | `suite-runs/t2.27-b2-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 19 passed (19)`, `Tests 42 passed (42)`, exit 0 | `suite-runs/t2.27-b2-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `51 passed (1.7m)`, exit 0 | `suite-runs/t2.27-b2-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.27-b2-checks.txt` |

Failures: none. Unit rose from 353 to 357 (two cases each for T2.27-B1 and T2.27-B2).

**T2.27-B3 Entered values reset on a Trade change** (user's direction 2026-10-24, from the T2.27-B2 notes). The route keeps `PositionChangeForm` mounted across Trades, and since T2.27-B2 a Trade change reloads the Trade but keeps the first Trade's entered rows, reflection answers, decline choice and reason, issues, and conflict and recorded states. A save could then send values entered for one Trade against another. Fresh `tdd-task` subagent, failing test first, through the `PositionChangeForm` seam.

```text
describe("Record entry on another Trade")
  it should start the other Trade's form from its initial values: one Execution row with Economic Time now, no reflection answers, no decline or reason
  it should show no issues, conflict, or receipt carried over from the previous Trade
  it should report the form as not unsaved once it moves to the other Trade
```

**ocr review of T2.27-B3** (`ocr-review` step): commit `834189f`, session `dd2caa85-4498-469b-8fe3-9f2f23c83c09`, model `gpt-6.1-sol`, 1 file reviewed (2 excluded: the test file and `tdd-log.md`), 0 comments. No findings. Raw output: `ocr/t2.27-b3-834189f.json`.

**T2.27-B3 notes (implementation level):** the entered values are reset in place, in B2's render-time `loadingFor` check, rather than by keying the form per Trade (`main.tsx` unchanged). On a `tradeId` change the rows become one blank row with Economic Time read from `now()` at that moment (also the new initial row), and answers, decline choice and reason, issues, conflict and receipt are cleared. Retry keeps entered values. A `facade`-only change still clears only the load, as in B2; the facade is composed once per application, so this is recorded rather than asked. First-run pass, flagged: case 3, "report the form as not unsaved once it moves to the other Trade", was already satisfied by case 1's reset through the existing `onDirtyChange` effect; mutation removing only `setDeclined(false)` from the reset gave `AssertionError: expected last "vi.fn()" call to have been called with [ false ]` (`tdd-log.md`).

**Cumulative run after T2.27-B3:** run 2026-10-24 17:57 EDT on commit `834189f` (working tree carried only uncommitted evidence edits), Node v26.12.0. Run label `t2.27-b3`.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 360 passed (360)`, exit 0 | `suite-runs/t2.27-b3-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 19 passed (19)`, `Tests 42 passed (42)`, exit 0 | `suite-runs/t2.27-b3-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `51 passed (1.7m)`, exit 0 | `suite-runs/t2.27-b3-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.27-b3-checks.txt` |

Failures: none. Unit rose from 357 to 360 (T2.27-B3's three cases).

#### T2.28

Browser case (`e2e/d2/no-save.spec.ts`, "F4 saving again after a Conflict"): two pages on one profile. Page B records an entry (PC2, 40 shares) while page A has the entry form open with PC3 (20 shares) entered. Page A saves, sees Conflict, chooses "Load the latest Trade", sees "Latest Trade" with "40 shares of XYZ" and its entered row unchanged, saves again; the probe shows two Position Changes, Execution quantities 20 and 40, and two reflection Entries.

| Command | Result |
|---|---|
| `npm run build:faults` | built |
| `npx playwright test e2e/d2/no-save.spec.ts` | 2 passed |

Decisions (for the final report):
- "Load the latest Trade" reloads only the Trade Detail through `getTradeDetail`; the definition stays. The form never shows Loading, the entered values are untouched.
- On success the Conflict message is replaced by a "Latest Trade" region above the Entry card: "The latest Trade is loaded. Your values are kept below; review them against it before saving again." with a Position line ("40 shares of XYZ" for an Open Trade, "No Position yet" for a Planned one). The next save uses the reloaded FactRevision. The region clears on the next save result.
- On failure (rejection or a non-Ready result) the Conflict message, button and values stay, with an alert "We couldn’t load the latest Trade. Your values are kept; try again."
- A reload started before a Trade, facade or Retry change is ignored through an epoch counter bumped in the load effect cleanup. If the reloaded Trade is incoherent, the existing incoherent branch replaces the form.

**ocr review of T2.28** (`ocr-review` step): commit `d623a46`. A first attempt (session `014024a0-94e2-4f0d-af23-43c35d5415f9`) was refused with `subscription_sharing_usage_limit_exceeded`; at the user's direction (2026-10-24) T2.29 went ahead and both were reviewed after the 9:55 pm reset. The review: session `dc74218f-0f4a-4e82-817d-182f83fd10b8`, model `gpt-6.1-sol`, 1 file reviewed (4 not selected), 1 comment. Raw output: `ocr/t2.28-d623a46.json`.

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `src/ui/screens/PositionChangeForm.tsx:107` | `reloadTrade` guards late answers only with `loadEpoch`, which changes only when the load effect restarts, so an overlapping reload or a save returning a new Conflict can be overwritten by a late reload answer | Doubtful: the race is real (the button is never disabled and a save does not invalidate a pending reload), but nothing is saved against a stale revision; the trader can see a stale Position or lose the newer Conflict message. Turned into bug task T2.28-B1. |

**Cumulative run after T2.28:** run 2026-10-24 18:26 EDT on commit `d623a46`, Node v26.12.0. Run label `t2.28`.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 364 passed (364)`, exit 0 | `suite-runs/t2.28-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 19 passed (19)`, `Tests 42 passed (42)`, exit 0 | `suite-runs/t2.28-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `52 passed (1.7m)`, exit 0 | `suite-runs/t2.28-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.28-checks.txt` |

Failures: none. Unit rose from 360 to 364 (T2.28's four cases); browser from 51 to 52 (the two-page Conflict case in `no-save.spec.ts`).

#### T2.29

Browser case: the existing keyboard-only case in `e2e/d2/responsive-a11y.spec.ts` ("should complete an entry with the keyboard only, with visible focus throughout") now asserts `document.activeElement` is the h1 "Record entry" after Enter on the "Record entry" link, and the h1 "Entry recorded" after Enter on "Save entry".

| Command | Result |
|---|---|
| `npm run build:faults` | built |
| `npx playwright test e2e/d2/responsive-a11y.spec.ts e2e/d1/responsive-a11y.spec.ts` | 7 passed (D1 focus checks still green) |

Decisions (for the final report):
- Headings take `tabIndex={-1}` and focus through a ref; the visible focus style is the existing `:focus-visible` rule.
- The form focuses its h1 "Record entry" each time a load ends with the Trade and definition both present: first load, Retry, and a Trade change (all pass through Loading). The incoherent-Trade branch uses the same heading ref. T2.28's in-place reload keeps both present, so it never refocuses; the Conflict message keeps its own focus. Error and Not Found states do not take focus.
- The receipt focuses its h1 "Entry recorded" on mount.
- Unit-test refactor: the receipt case's Recorded result moved into a shared `recordedResult()` helper so the receipt focus case reuses it.

**ocr review of T2.29** (`ocr-review` step): commit `c1c16c0`, session `75b0defb-a239-4019-aafc-499a0d1bdf23`, model `gpt-6.1-sol`, 2 files reviewed (4 excluded), 1 comment. Raw output: `ocr/t2.29-c1c16c0.json`.

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `src/ui/screens/PositionChangeForm.tsx:130` | `shown` requires the definition too, so the incoherent-Trade heading, which renders as soon as the view arrives, is not focused when the definition load fails, and is focused late when it is slow | Valid: the incoherent branch renders before the failure and definition checks. Turned into bug task T2.29-B1. |

**Cumulative run after T2.29:** run 2026-10-24 20:22 EDT on commit `c1c16c0`, Node v26.12.0. Run label `t2.29`.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 37 passed (37)`, `Tests 367 passed (367)`, exit 0 | `suite-runs/t2.29-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 19 passed (19)`, `Tests 42 passed (42)`, exit 0 | `suite-runs/t2.29-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `52 passed (1.7m)`, exit 0 | `suite-runs/t2.29-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.29-checks.txt` |

Failures: none. Unit rose from 364 to 367 (T2.29's three cases); the browser case extends the existing keyboard-only case, so the browser count is unchanged.

#### T2.29-B1

Bug from the ocr review of T2.29: the incoherent-Trade heading took focus only once the definition had loaded, so a failed or pending definition load left it unfocused.

| Command | Result |
|---|---|
| red: `npx vitest run src/ui/screens/PositionChangeForm.test.tsx -t "Record entry heading of the incoherent note when the definition load fails"` | failed: expected body to be the h1 (assertion) |
| green: same command | 1 passed |
| `npx vitest run src/ui/screens/PositionChangeForm.test.tsx` | 29 passed |
| `npx playwright test e2e/d2/no-save.spec.ts e2e/d2/responsive-a11y.spec.ts` | 6 passed |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |

Change: the `shown` condition in `PositionChangeForm.tsx` is now true for an incoherent Trade view alone, or for a view with the definition. The form heading rule and the Conflict in-place reload are unchanged.

#### T2.28-B1

Bug from the ocr review of T2.28: `reloadTrade` guarded late answers only with `loadEpoch`, which changed only when the load effect restarted. An earlier reload answering after a later one overwrote the newer view, and a reload answering after a save that returned a new Conflict cleared that Conflict.

| Command | Result |
|---|---|
| red: `npx vitest run src/ui/screens/PositionChangeForm.test.tsx -t "should ignore an earlier reload that answers after a later one"` | failed: Latest Trade no longer showed "60 shares of XYZ" after the earlier reload answered (assertion) |
| red: same file, `-t "should ignore a reload that answers after a save"` | failed: the Conflict message region was gone (assertion) |
| green: both commands | 1 passed each |
| `npx vitest run src/ui/screens/PositionChangeForm.test.tsx` | 31 passed |
| `npx playwright test e2e/d2/no-save.spec.ts e2e/d2/responsive-a11y.spec.ts` | 6 passed |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |

Change: `loadEpoch` is also bumped by each reload and each save, so only the latest request may change the form; a superseded reload settles unseen.

**ocr review of T2.29-B1** (`ocr-review` step): commit `9bb096f`, session `f9e9f9d8-f6f7-4081-a64b-a778ffd524f3`, model `gpt-6.1-sol`, 1 file reviewed (3 excluded: the test file, `structural.md` and `tdd-log.md`), 0 comments. No findings. Raw output: `ocr/t2.29-b1-9bb096f.json`.

**ocr review of T2.28-B1** (`ocr-review` step): commit `feb3c1a`, session `ccfde2e9-23e2-4c9a-a034-0f22716ba412`, model `gpt-6.1-sol`, 1 file reviewed (test and evidence files excluded), 0 comments. No findings. Raw output: `ocr/t2.28-b1-feb3c1a.json`.

**Complete cumulative run after T2.29-B1 and T2.28-B1** (`suite-runner`, 2026-10-24 22:01 EDT, on `feb3c1a` plus the uncommitted ocr evidence): Unit 37 files / 370 tests passed; Node integration 19 files / 42 tests passed; Browser (Chromium) 52 passed (1.7m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.28-b1-*.txt`.

#### T2.30

Browser case: `e2e/d2/runtime-failure.spec.ts` "should explain Record entry isn't available on a direct link while Recovery Only, with a link back to the Trade": a seeded Trade, then `page.goto('/trades/<id>/record-entry?faults=inventory')`.

| Command | Result |
|---|---|
| `npm run build:faults` | built |
| `npx playwright test e2e/d2/runtime-failure.spec.ts` | 3 passed |
| `npx vitest run src/ui/AppShell.test.tsx` | 20 passed |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |

Decisions (for the final report):
- Heading h1 "Record entry isn't available"; sentence "This browser can't save right now, so an entry can't be recorded."; link "Back to the Trade" to `/trades/<id>` (same link text as the incoherent note). No focus behaviour added.
- Case 2 resolution: the launch rule says an open form keeps its values after a refusal (B2.10), so the view replaces the form only when the entry route is reached after the refusal, not where the refusal arrived. AppShell remembers the first path a refusal came from (`refusedAt`); `record-entry` shows the unavailable view whenever not Writable and the current path differs from it.
- Known edge (fixed by T2.30-B1): after a refusal arriving on a record-entry path, leaving and returning to that same path showed the (disabled) form again.

**ocr review of T2.30** (`ocr-review` step): commit `0c06ab5`, session `4acf20ac-ab10-42c7-b637-c58a811c4414`, model `gpt-6.1-sol`, 1 file reviewed, 2 comments. Raw output: `ocr/t2.30-0c06ab5.json`.

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `src/ui/AppShell.tsx:296` | `refusedAt` is never cleared, so after leaving and returning to the entry path where the refusal arrived, a fresh form mounts instead of the unavailable view | Valid: contradicts T2.30 case 2 once the original form is unmounted. Turned into bug task T2.30-B1. |
| low | maintainability | `src/ui/AppShell.tsx:46` | `RECORD_ENTRY_PATH` repeats the record-entry path defined in `ROUTES` | Doubtful: a tidy-up, not a defect. Turned into bug task T2.30-B2. |

**Complete cumulative run after T2.30** (`suite-runner`, 2026-10-24 22:07 EDT, on `0c06ab5`): Unit 37 files / 372 tests passed; Node integration 19 / 42 passed; Browser (Chromium) 53 passed (1.7m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.30-*.txt`.

#### T2.30-B1

Bug from the ocr review of T2.30: `refusedAt` was never cleared, so returning to the record-entry path where the refusal arrived mounted a fresh empty form. Fix: AppShell resets `refusedAt` as soon as `pathname` differs from it (state adjusted during render, since the lint rule forbids setState in an effect), so the exemption lasts only while the trader stays on that path.

| Command | Result |
|---|---|
| `.claude/scripts/tdd.sh red T2.30-B1 src/ui/AppShell.test.tsx "should show Record entry isn't available on returning to the entry form after leaving the page where the refusal arrived"` | red: Unable to find role="heading" and name "Record entry isn't available" |
| same, `green` | Tests 1 passed |
| `npx vitest run src/ui/AppShell.test.tsx` | 21 passed (B2.10-style keeps-values case included) |
| `npm run build:faults`, `npx playwright test e2e/d2/runtime-failure.spec.ts` | 3 passed |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |

#### T2.30-B2

Maintainability tidy-up from the ocr review of T2.30 (Doubtful): `RECORD_ENTRY_PATH` in `src/ui/AppShell.tsx` repeated the record-entry path literal. It is now `ROUTES.find((route) => route.id === 'record-entry')!.path`, since the route filter drops the write route when not Writable. No behaviour change.

| Command | Result |
|---|---|
| `npx vitest run src/ui/AppShell.test.tsx` before the change | 21 passed |
| `npx vitest run src/ui/AppShell.test.tsx` after the change | 21 passed |
| `npm run build:faults`, `npx playwright test e2e/d2/runtime-failure.spec.ts` | 3 passed |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |
| `grep -rn "record-entry" src \| grep -v "\.test\."` | the path literal `/trades/:tradeId/record-entry` appears only in `src/app/routes.ts:41`; other hits are the route id (`main.tsx`, `AppShell.tsx`) and a concrete link template `/trades/${id}/record-entry` in `TradeDetail.tsx:104` (a different string, out of scope) |

**ocr review of T2.30-B1** (`ocr-review` step): commit `e65cbb6`, session `f27c4896-e762-43d4-af77-791923383f30`, model `gpt-6.1-sol`, 1 file reviewed, 1 comment. Raw output: `ocr/t2.30-b1-e65cbb6.json`.

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| low | maintainability | `src/ui/AppShell.tsx:111` | `setRefusedAt` during render is a render-phase side effect; move it into a `useEffect` | Wrong, dismissed: the guarded reset during render is React's documented pattern for state derived from other values and settles after one extra render; an effect would render the stale form once on return, and the repo's `react-hooks/set-state-in-effect` lint rule rejects it. |

**ocr review of T2.30-B2** (`ocr-review` step): commit `aacd703`, session `b0e4f3b9-bbec-4964-af81-aa7d4156b680`, model `gpt-6.1-sol`, 1 file reviewed, 0 comments. No findings. Raw output: `ocr/t2.30-b2-aacd703.json`.

**Complete cumulative run after T2.30-B1 and T2.30-B2** (`suite-runner`, 2026-10-24 22:13 EDT, on `aacd703` plus the uncommitted evidence): Unit 37 files / 373 tests passed; Node integration 19 / 42 passed; Browser (Chromium) 53 passed (1.7m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.30-b2-*.txt`.

#### T2.31

Receipt discloses changed Deviations (F7). `PositionChangeReceipt` now prints a line for each NewVersion and Supersede action in `receipt.deviationReconciliation`, and nothing for Retain. No result-shape change: the "was" quantity is the occurrence's previous version in `postCommit.trade.recordedDeviations`.

| Command | Result |
|---|---|
| `tdd.sh red` NewVersion and Supersede cases (`src/ui/screens/PositionChangeForm.test.tsx`) | red: Unable to find an element with the expected text (both) |
| `tdd.sh red` Retain case | passed on first run (flagged; mutation widening the filter to non-Create actions failed with `expected <p></p> to be null`) |
| `tdd.sh green` all three | Tests 1 passed each |
| `npx playwright test e2e/d2/open-position.spec.ts` before `npm run build:faults` (new C2.6 case) | 1 failed (stale build, no Deviation line), 2 passed |
| `npm run build:faults`, `npx playwright test e2e/d2/open-position.spec.ts` | 3 passed |
| `npx vitest run src/ui/screens/PositionChangeForm.test.tsx` | 34 passed |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |

Copy decisions:
- NewVersion: `Entry Size Deviation changed: now 60 shares above plan (was 20), caused by the Position Change at 2026-10-12 11:00.` Same time format as the Create line (the plan's bare "11:00" is shorthand). "this Position Change" replaces the clause when the saved change is the cause. The `(was N)` part is dropped if the previous version is absent.
- Supersede: `Entry Size Deviation no longer applies.`
- Retain: no text.
- The browser check is a new case, "C2.6 earlier-dated entry (P5)", in `e2e/d2/open-position.spec.ts`: no earlier-dated case existed there. It uses PC1 (60), a 60-share fill at 11:00, then 40 at 10:30.

**ocr review of T2.31** (`ocr-review` step): commit `0c6e140`, session `93233ed1-eb18-4b65-8fdb-f018d0cbb9ee`, model `gpt-6.1-sol`, 1 file reviewed (`PositionChangeReceipt.tsx`), 0 comments. No findings. Raw output: `ocr/t2.31-0c6e140.json`.

**Complete cumulative run after T2.31** (`suite-runner`, 2026-10-24 22:18 EDT, on `0c6e140`): Unit 37 files / 376 tests passed; Node integration 19 / 42 passed; Browser (Chromium) 54 passed (1.7m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.31-*.txt`.

#### T2.34 R-multiple decimals (F10)

- Spec: `specs/design/ui-contract.md`, section "Numbers, availability, and graphs": "Exact values in read models remain unrounded; presentation rounding must not change classification or calculation." No file in `specs/` fixes a precision for R multiples, so the plan's two decimals apply. Rounding is `formatDecimal` (half away from zero, `src/domain/values/format.ts`), the same routine as `formatMoney`.
- Seam: new `rMultiple(value)` in `src/ui/format.ts` (exactly two decimals plus "R"); used in `PositionChangeReceipt.tsx` and `TradeDetail.tsx` (Entry Quality). `ratio` is unchanged and still serves Reward : risk, planned Reward : risk, size ratio and the Planned list.
- Red then green: case 1 red (TypeError: rMultiple is not a function), then green. Cases 2 and 3 were first-run passes with mutation checks, flagged in `tdd-log.md`.
- Test impact: none. Every existing R multiple in tests is "1.08R" (TradeDetail.test.tsx, PositionChangeForm.test.tsx, e2e open-position and offline), which already has two decimals, so no expectation gained or lost a trailing zero. No test file was edited other than the new `src/ui/format.test.ts`.
- Runs: `npx vitest run src/ui` 107 passed; `npm run build:faults` then `npx playwright test e2e/d2/open-position.spec.ts e2e/d2/offline.spec.ts` 4 passed; typecheck, tsc6, lint, lint:deps all exit 0.

**ocr review of T2.34** (`ocr-review` step): commit `88bcd26`, session `e44fd381-3ef1-434a-9196-a0da9d93d854`, model `gpt-6.1-sol`, 3 files reviewed (3 excluded), 0 comments. No findings. Raw output: `ocr/t2.34-88bcd26.json`.

**Complete cumulative run after T2.34** (`suite-runner`, 2026-10-24 22:22 EDT, on `88bcd26`): Unit 38 files / 379 tests passed; Node integration 19 / 42 passed; Browser (Chromium) 54 passed (1.7m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.34-*.txt`.

#### T2.35 I2.5 test name (F11)

- Old case name: `should return the Trade, derivation, and Entry equal to the Detail read after restart, with the facts, Open index entry, Entry, and obligation durable, and the Trade absent from Planned`. Old header comment ended: `The AC-RESP-001 checks are in responses.test.ts.`
- New case name: `should open the Trade with PC1 so that its Position, Open Lot, and lifecycle persist across restart, with the facts, Open index entry, Entry, and obligation stored, and the Trade absent from Planned`. New header: `I2.5: opening a position with PC1 of the reference Trade (AC-POS-001, AC-LIFE-001): the Position, Open Lot, and lifecycle read back after restart, and the stored facts, Open index entry, Entry, and obligation.` No assertion changed.

| Command | Result |
|---|---|
| `npm run test:integration` (before the change) | 19 files / 42 tests passed |
| `npm run test:integration -- d2/open-position` | 1 file, 1 test passed |
| `npm run test:integration -- d2/responses` | 1 file, 1 test passed |
| `npm run test:integration` (after) | 19 files / 42 tests passed, unchanged |
| `grep -n "AC-RESP-001" tests/integration/d2/open-position.test.ts` | no output (exit 1) |
| `npm run lint` | exit 0 |

The plan's integration total of 39 is a stale figure (later tasks added tests); the before and after totals match at 42.

**ocr review of T2.35** (`ocr-review` step): commit `6392b41`, session `85d75e47-36f1-407f-bb98-de04848e9100`, model `gpt-6.1-sol`, 0 files reviewed (2 excluded: the test file by ocr's default path rule, `structural.md` by type); status "skipped" ("no items were selected"), and no flag includes an excluded test file. Raw output: `ocr/t2.35-6392b41.json`. The `ocr-review` agent checked the rename by hand instead:

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| low | naming/accuracy | `tests/integration/d2/open-position.test.ts:1`, `:8` | The title and comment say the Position, Open Lot and lifecycle persist, but no assertion reads a Position or Open Lot | Valid: the wording came from the plan's T2.35 parenthetical; the plan's intent is "what they check". Turned into bug task T2.35-B1. |

**Complete cumulative run after T2.35** (`suite-runner`, 2026-10-24 22:25 EDT, on `6392b41`): Unit 38 files / 379 tests passed; Node integration 19 / 42 passed; Browser (Chromium) 54 passed (1.7m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.35-*.txt`.

#### T2.35-B1 I2.5 case name claimed more than it asserts

- Finding (Valid, minor; from a manual check because ocr excludes test files): the T2.35 title and header comment of `tests/integration/d2/open-position.test.ts` said the Position, Open Lot, and lifecycle persist or are read back after restart, but no assertion reads a Position or Open Lot. The case checks the Planned to Open transition on the receipt, `browseTrades` Open and Planned after restart, the stored Position Change and Execution facts, the Open index entry, the Entry, and the obligation. The plan's T2.35 parenthetical wording overstated the checks; the plan's instruction to name the case "to what they check" governs.
- Old case name: `should open the Trade with PC1 so that its Position, Open Lot, and lifecycle persist across restart, with the facts, Open index entry, Entry, and obligation stored, and the Trade absent from Planned`
- New case name: `should open the Trade with PC1, listing it as Open and not Planned after restart, with its Position Change and Execution facts, Open index entry, Entry, and obligation stored`
- Header comment now: `...the Planned to Open transition on the receipt, the Trade listed as Open and not Planned after restart, and the stored Position Change and Execution facts, Open index entry, Entry, and obligation.` No assertion changed.

| Command | Result |
|---|---|
| `npm run test:integration -- d2/open-position` | 1 file, 1 test passed |
| `npm run test:integration -- d2/responses` | 1 file, 1 test passed |
| `npm run test:integration` | 19 files / 42 tests passed |
| `grep -n "AC-RESP-001" tests/integration/d2/open-position.test.ts` | no output (exit 1) |
| `grep -n "Open Lot" tests/integration/d2/open-position.test.ts` | no output (exit 1) |
| `npm run lint` | exit 0 |

**Review of T2.35-B1:** commit `e7249bf` changes only the test file, which ocr never selects (as for T2.35), so no ocr run. The main session checked the new title and comment against the assertions (lines 18–41: the receipt's Planned to Open transition, Open and not Planned after restart, the PositionChange and Execution facts, the Open index entry, the Entry, the obligation): every clause matches an assertion.

**Complete cumulative run after T2.35-B1** (`suite-runner`, 2026-10-24 22:28 EDT, on `e7249bf` plus the uncommitted evidence): Unit 38 files / 379 tests passed; Node integration 19 / 42 passed; Browser (Chromium) 54 passed (1.7m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.35-b1-*.txt`. This ends the T2.25–T2.35 follow-up batch.

#### T2.36 Primary navigation: current page, wordmark, icons

- Red then green for all four cases in `src/ui/AppShell.test.tsx` (describe "primary navigation"); no first-run passes.
- Decisions: `aria-current` is computed from `matchPath` over `ROUTES` in `navigationOwner` (Trade Detail and Record entry map to Trades), on plain `Link`s rather than `NavLink`, because `NavLink` can't mark Trades current on a child path. The wordmark is a `span.wordmark` rendered as the first child of the nav, only when wide, so it sits outside the links and absent in the bottom bar. Icons live in `src/ui/icons.tsx` (shared `Icon` wrapper with `aria-hidden`, 1.5 stroke; later tasks add the back arrow and chevron there). Minimal CSS in `app.css` for icon/label alignment and the wordmark; pill and bottom-bar styling is left to T2.37.

| Command | Result |
|---|---|
| `npx vitest run src/ui/AppShell.test.tsx` | 25 passed |
| `npm run build:faults` | exit 0 |
| `npx playwright test e2e/d1/responsive-a11y.spec.ts e2e/d2/responsive-a11y.spec.ts e2e/d2/narrow.spec.ts e2e/d2/runtime-failure.spec.ts` | 15 passed |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |

**ocr review of T2.36** (`ocr-review` step): commit `e7c3747`, session `8bf6055b-5691-4b9e-a584-3935f03860e6`, model `gpt-6.1-sol`, 3 files reviewed, 1 comment. Raw output: `ocr/t2.36-e7c3747.json`.

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `src/ui/app.css:361-365` | The four-link bottom bar is a single non-wrapping row; the 20 px icon and gap per link may push links past a 390 px viewport | Valid (estimated about 420 px needed against about 374 px); `narrow.spec.ts` checks only document width. Turned into bug task T2.36-B1, which reproduced it (About's right edge at 425.3 px at 390). |

**Complete cumulative run after T2.36** (`suite-runner`, 2026-10-24 22:42 EDT, on `e7c3747`): Unit 38 files / 383 tests passed; Node integration 19 / 42 passed; Browser (Chromium) 54 passed (1.7m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.36-*.txt`.

#### T2.36-B1 Bottom navigation bar fit on narrow screens

- Finding (ocr, Valid): after T2.36 added a 20 px icon and gap beside each label, the single non-wrapping bottom-bar row was wider than a phone viewport; `narrow.spec.ts` only checks the document scroll width, which the fixed bar does not affect.
- Red: new `e2e/d2/ui-alignment.spec.ts` case (390x844 and 320 wide, on Trades: every Primary link inside the viewport, bar scrollWidth within clientWidth). Measured before: the About link's right edge was 425.3 px at a 390 px viewport. Failure: `About right at 390 ... Expected: <= 390, Received: 425.328125`. (`tdd.sh` runs vitest only, so the red and green rows were written by hand.)
- Green: CSS only in `src/ui/app.css`, narrow layout only: each bottom-bar link is a column (icon over label), `flex: 1 1 0` so the four share the width equally, compact padding, 0.8rem label. The current-item styling and the banner are left to T2.37. The case passes at 390 and 320.

| Command | Result |
|---|---|
| `npm run build:faults` | exit 0 |
| `npx playwright test e2e/d2/ui-alignment.spec.ts e2e/d2/narrow.spec.ts e2e/d1/responsive-a11y.spec.ts e2e/d2/responsive-a11y.spec.ts` | 13 passed |
| `npx vitest run src/ui/AppShell.test.tsx` | 25 passed |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |

**ocr review of T2.36-B1** (`ocr-review` step): commit `2f0bc81`, session `af25d147-7b63-4e20-8e2b-c61f31c8b7a5`, model `gpt-6.1-sol`, 1 file reviewed (`app.css`), 0 comments. No findings. Raw output: `ocr/t2.36-b1-2f0bc81.json`.

**Complete cumulative run after T2.36-B1** (`suite-runner`, 2026-10-24 22:48 EDT, on `2f0bc81` plus the uncommitted evidence): Unit 38 files / 383 tests passed; Node integration 19 / 42 passed; Browser (Chromium) 55 passed (1.7m; `npm run test:e2e` picks up `e2e/d2/ui-alignment.spec.ts`); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.36-b1-*.txt`.

#### T2.37

Navigation and durability-banner styling. Measurements added to `e2e/d2/ui-alignment.spec.ts` (describe "T2.37 navigation and durability banner"), run against `dist-faults`.

Commands:

- Before: `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts -g T2.37` (current build, measurements only) gave 3 failed, 1 passed.
- After: `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts` gave 5 passed.
- Also green after: `e2e/d1/responsive-a11y.spec.ts`, `e2e/d2/responsive-a11y.spec.ts`, `e2e/d2/narrow.spec.ts`, `e2e/d1/readiness.spec.ts`, `e2e/d1/recovery-only.spec.ts`, `e2e/d1/runtime-failure.spec.ts`, `e2e/d2/durability.spec.ts` (27 + 1 passed; D1 has no durability spec of that name, the D1 banner cases are in readiness, recovery-only and runtime-failure); `npx vitest run src/ui` 111 passed; typecheck, `tsc6`, lint, lint:deps exit 0.

| Measurement | Before | After |
| --- | --- | --- |
| Current sidebar link background / text (1280) | transparent `rgba(0, 0, 0, 0)` (fail) | `--ink` rgb(28, 27, 25), text white (pass) |
| Bottom bar icon box above label box (390) | already passed (from T2.36-B1) | passes |
| Banner background vs `--warning-ground` | rgb(255, 255, 255) vs rgb(255, 244, 221) at 390 and 1280 (fail) | equal at both widths |
| Banner height at 390 (limit 120) | 189.9 px (the failing assertion came first; value read separately) | 93.4 px |
| Button vertical centre vs text block at 1280 | centre 115.4, text 49 to 72.2 (outside) | centre 60.2, text 37 to 83.4 (inside) |
| axe on Trades at 390 and 1280 | not reached before the failing assertion | clean at both |

Markup change: the unprotected-storage banner is now `banner warning durability` (was `banner notice`; accessible name "Storage protection", text and button name unchanged) with its paragraphs wrapped in a `banner-text` div. The "will now keep your data" status line stays `banner notice`. Current item: ink pill in the sidebar, bold ink in the bottom bar.

**ocr review of T2.37** (`ocr-review` step): commit `23fc26c`, session `eafe94ac-76e0-4d24-b57f-4cabc8530953`, model `gpt-6.1-sol`, 2 files reviewed (2 excluded), 1 comment. Raw output: `ocr/t2.37-23fc26c.json`.

| Severity | Category | Location | Claim | Assessment |
|---|---|---|---|---|
| medium | bug | `src/ui/app.css:430` | The compact banner rules match only inside `.shell:not([data-layout='wide'])`, but the banner also renders before the shell on first run and onboarding, where it is not compact at 390 px | Valid: `protectionWarning` renders bare before `FirstRun` and `OnboardingAccount`. Turned into bug task T2.37-B1, which measured 567.3 px there. |

**Complete cumulative run after T2.37** (`suite-runner`, 2026-10-24 22:53 EDT, on `23fc26c`): Unit 38 files / 383 tests passed; Node integration 19 / 42 passed; Browser (Chromium) 59 passed (1.8m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.37-*.txt`.

#### T2.37-B1

Finding (ocr review of 23fc26c, Valid): the compact banner rules were keyed to `.shell:not([data-layout='wide'])`, but AppShell renders the storage banner outside any `.shell` on first run and account onboarding, so it got the flex row without the compact padding, font and button cap.

Fix: the compact rules are now in `@media (max-width: 959.98px)` (the 960 px layout switch, `WIDE_LAYOUT_MIN_WIDTH`), so they apply wherever the banner renders. Wide layout and Trades are unchanged.

Commands: `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts` (new describe "T2.37-B1 durability banner before the shell renders").

| Measurement | Before | After |
| --- | --- | --- |
| Banner height at 390, first run (limit 120) | 567.3 px | passes (<= 120) |
| Banner height at 390, account onboarding (limit 120) | 567.3 px | passes (<= 120) |
| Banner background vs `--warning-ground` | equal | equal |

Also green after: `e2e/d1` first-run/onboarding/responsive specs, `e2e/d2/narrow.spec.ts`, `e2e/d2/responsive-a11y.spec.ts`, lint, lint:deps.

**ocr review of T2.37-B1** (`ocr-review` step): commit `439a863`, session `2aa2d15b-5020-416e-b95a-059325a895e5`, model `gpt-6.1-sol`, 1 file reviewed (`app.css`), 0 comments. No findings. Raw output: `ocr/t2.37-b1-439a863.json`.

**Complete cumulative run after T2.37-B1** (`suite-runner`, 2026-10-24 22:58 EDT, on `439a863` plus the uncommitted evidence): Unit 38 files / 383 tests passed; Node integration 19 / 42 passed; Browser (Chromium) 61 passed (1.9m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.37-b1-*.txt`.

#### T2.38

One content column and side gutters (absorbs F8). Measurements added to `e2e/d2/ui-alignment.spec.ts` (describe "T2.38 one content column and side gutters"), run against `dist-faults`. Migration Blocked is reached as `e2e/d2/migration.spec.ts` does (D1 release with two Plans, `?faults=migration:validate`, faults build, Reload). "Card" is `.card`, the standalone `.first-run`, `.onboarding`, `.gate`, and the Trades `.table-scroll` region (Trades has no `.card` while it lists rows). The Trades `h1` arrives with T2.39, so the 1280 check measures the `h1` where one exists (Open Detail).

Commands:

- Before: `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts -g T2.38` on the unchanged CSS gave 4 failed, 2 passed.
- After: `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts` gave 13 passed.
- Also green after: `e2e/d2/narrow.spec.ts`, `e2e/d2/migration.spec.ts`, `e2e/d1/responsive-a11y.spec.ts`, `e2e/d2/responsive-a11y.spec.ts`, `e2e/d1/readiness.spec.ts`, `e2e/d1/recovery-only.spec.ts` (37 passed with ui-alignment); `npx vitest run src/ui` 111 passed; typecheck, `tsc6`, lint, lint:deps exit 0.

| Measurement | Before | After |
| --- | --- | --- |
| Open Detail at 1280, left x of banner / `h1` / first card | 236 / 286 / 302 (fail) | equal within 1 px |
| Trades at 1280, left x of banner / tablist / first card | 236 / 286 / 286 (banner 50 px off; fail) | equal within 1 px |
| First run at 390 and 320, card left | 0 (fail; needs >= 16) | >= 16, right <= width - 16 |
| Onboarding at 390 and 320 | not reached (first run failed first) | passes |
| Migration Blocked at 390 (320 not reached), `.gate` left | 0 (fail) | passes at 390 and 320 |
| Trades and Open Detail at 390 and 320 | already passed | passes |
| Page overflow (all views) | none | none |

Change: CSS only, `src/ui/app.css`. `.banner` takes `calc(min(100%, 960px) - 2rem)` and centres, so it shares the content box's inner left edge; blocks inside `.content` (`.card`, `.banner`) lose their own side margin and take the gutter from the content padding, which removes the extra 16 px that put cards right of the heading and tabs. The standalone `.startup`, `.gate`, `.first-run` and `.onboarding` cards use `width: calc(100% - 2rem)` with the 640 px cap, so they keep a 16 px gutter on narrow. The compact narrow banner margin is now `0.5rem auto` in effect (`margin-block` only). No markup or view-model change.

This closes F8 (Migration Blocked card edge to edge at 320 px): it now has the 16 px gutter at 390 and 320.

**ocr review of T2.38** (`ocr-review` step): commit `8641704`, session `74e56af7-2d66-456c-a1a6-1c260e702107`, model `gpt-6.1-sol`, 1 file reviewed (`app.css`; the spec and `structural.md` excluded), 0 comments. No findings. Raw output: `ocr/t2.38-8641704.json`.

**Complete cumulative run after T2.38** (`suite-runner`, 2026-10-24 23:04 EDT, on `8641704`): Unit 38 files / 383 tests passed; Node integration 19 / 42 passed; Browser (Chromium) 67 passed (2.0m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.38-*.txt`.

#### T2.39

Trades page heading: `TradeList` renders one `<h1>Trades</h1>` above the tablist, outside the state-specific panels, so it shows in Loading, Ready, Empty, and Error on both tabs. No CSS change was needed; no page-level New Plan button (U7). Heading focus (T2.29) untouched.

Test impact (grep of every heading lookup in `src`, `e2e`, `tests`): the only partial match on "Trades" was `e2e/d1/update.spec.ts` (B1.13), `getByRole('heading', { name: /Trades|Planned/ }).or(getByText('No planned trades yet'))`, which now matches both the h1 and the Empty text (strict-mode violation); changed to `.or(...).first()`. "Trade not found" lookups do not match "Trades". `e2e/d2/ui-alignment.spec.ts`: the Trades 1280 expectation now requires `h1` among the keys with banner, tablist and card (and removed the "arrives with T2.39" comment).

Commands: `npm run build:faults` then `npx playwright test e2e/d2/ui-alignment.spec.ts e2e/d2/narrow.spec.ts e2e/d1 e2e/d2/responsive-a11y.spec.ts` gave 49 passed (Trades h1 within 1 px of banner at 1280). `npx vitest run src/ui` 112 passed.

**ocr review of T2.39** (`ocr-review` step): commit `1a64e6f`, session `7462965e-34c6-4bb2-aaf3-b7215a7d2931`, model `gpt-6.1-sol`, 1 file reviewed (`TradeList.tsx`), 0 comments. No findings. Raw output: `ocr/t2.39-1a64e6f.json`.

**Complete cumulative run after T2.39** (`suite-runner`, 2026-10-24 23:11 EDT, on `1a64e6f`): Unit 38 files / 384 tests passed; Node integration 19 / 42 passed; Browser (Chromium) 67 passed (2.1m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.39-*.txt`.

#### T2.56

`verify:fixtures` compares each committed snapshot with the current views field by field over the fields the snapshot holds (D4 A51 brought forward; revision 8). New exported `compareSnapshot(views, snapshot)` in `tools/fixtures/snapshot-compare.ts` returns the path of each difference (for example `open[2].averageOpenCost.value`; an array length mismatch reads `open (length 3, snapshot 2)`); `tools/verify-fixtures.ts` uses it and its messages and flow are otherwise unchanged. D4's T4.29 reuses it.

Test location: the unit project collects `src/**` only, so tools tests are not in `npx vitest run src`. The test is `tests/integration/d2/snapshot-compare.test.ts` (5 cases), collected by the Node integration project the cumulative run includes. Red and green rows are in `tdd-log.md`.

Commands: `npm run verify:fixtures` printed `workspace-v1: schema 1, migrated to 2 ..., views equal`, `workspace-v2: schema 2, opened without migration, views equal`, and `verify:fixtures OK` (exit 0). `npx vitest run tests/integration/d2/snapshot-compare.test.ts` 5 passed.

**ocr review of T2.56** (`ocr-review` step): commit `fee10d5`, session `ceae310c-a56d-4417-a9ec-80abadf16c4d`, model `gpt-6.1-sol`, 1 file reviewed (`verify-fixtures.ts`), 0 comments. No findings. ocr did not select `tools/fixtures/snapshot-compare.ts`; checked by hand by the main session: no defect (a top-level type mismatch reports an empty path, which the committed snapshot cannot produce). Raw output: `ocr/t2.56-fee10d5.json`.

**Complete cumulative run after T2.56** (`suite-runner`, 2026-10-25 00:27 EDT, on `fee10d5`): Unit 38 files / 384 tests passed; Node integration 20 / 47 passed; Browser (Chromium) 67 passed (2.1m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.56-*.txt`.

#### T2.57

Net cost from `derive`: `DerivedTradeState.netCost: CalculationResult<Rational, 'NoOpenQuantity'>`, the exact sum over Open Lots of quantity × price plus the unconsumed opening fee; `NotApplicable(NoOpenQuantity)` with no Lots. Test `src/domain/trade-analysis/net-cost.test.ts` (3007, 5020, Planned). The plan's case 2 figure was corrected from 5034.00 to 5020.00 (`c61cc2a`). Cases 2 and 3 were shown red by mutation only (flagged in the handoff).

**ocr review of T2.57** (`ocr-review` step): commit `bd34653`, session `67f7659b-adff-4571-83fa-88ff46ea04ca`, model `gpt-6.1-sol`, 1 file reviewed (`derive.ts`), 0 comments. No findings. Raw output: `ocr/t2.57-bd34653.json`.

**Complete cumulative run after T2.57** (`suite-runner`, 2026-10-25 00:33 EDT, on `bd34653`): Unit 39 files / 387 tests passed; Node integration 20 / 47 passed; Browser (Chromium) 67 passed (2.1m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.57-*.txt`.

#### T2.58

Trade Summary and Net cost on list items and Details: view type `TradeSummary = { kind: 'Stock'; direction: 'Long'; quantity; price }` (exported from trade-views; the stored-record summary import is aliased `RecordSummary`). Planned items and Details carry `summary` (planned quantity, first leg's intended entry); Open items and Details carry `summary` (open quantity, fee-excluded weighted Lot price; omitted with no open quantity, unreachable in D2) and `netCost` from derive; incoherent items and Details carry neither. Tests: `src/coordinators/trade-views/trade-summary.test.ts` (4 cases; cases 3 and 4 first-run passes, mutation-checked), `tests/integration/d2/trade-summary.test.ts` (2 cases on `workspace-v2`, first-run passes, mutation-checked: Open price from the first Lot). Existing tests updated for the added fields; three v1 snapshot comparisons in the migration tests now use `compareSnapshot` (T2.56's field rule).

Integration arithmetic (`workspace-v2`, all Buys, fee 1.00 each): CSCO 60 @ 50.10 + 40 @ 50.30 + 20 @ 51.00 = 120 shares, average 3019/60, Net cost 6038 + 3 = 6041; KO 100 shares, average 2509/50, Net cost 5020; PFE 60 @ 50.10, Net cost 3007. Planned: AAPL 50 @ 228.4, MSFT 30 @ 415.1, NVDA 120 @ 131.25, COST 10 @ 905, BRK.B 25 @ 462.75; no `netCost` on Planned.

Bench: `bench:generate` reuses its cached profile when the stamp matches, so the agent ran `build:bench`, removed the gitignored `.cache/bench/profile/tj-bench.json`, and regenerated. `generatorVersion` 1, `schemaVersion` 2; `headers` and `rows` identical (200 rows); every `items` entry gained `summary` and `netCost`, no existing key changed. `bench/dataset.json` changed only in provenance (`benchRelease`, `generationMs`, `generatedAt`); dataset content unchanged.

**ocr review of T2.58** (`ocr-review` step): commit `10861b6`, session `c564c338-9f1e-466d-9f52-ccb607082d4e`, model `gpt-6.1-sol`, 4 files reviewed (`trade-views.ts`, both bench files, `open-detail-fixtures.ts`), 1 comment. Raw output: `ocr/t2.58-10861b6.json`.

| Severity | Location | Claim | Verdict |
| --- | --- | --- | --- |
| low | `trade-views.ts:227` | `openSummary` repeats `openItem`'s Lot flattening, quantity sum and weighted price; the two could drift | Valid; bug task T2.58-B1 |

**Complete cumulative run after T2.58** (`suite-runner`, 2026-10-25 00:42 EDT, on `10861b6`): Unit 40 files / 391 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 67 passed (2.0m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.58-*.txt`.

#### T2.58-B1


Refactor, no behavior change: `openItem` calls `openSummary(derived)` once and derives `openQuantity`, `averageOpenCost` and `summary` from it.

- `npx vitest run src/coordinators tests/integration/d2/trade-summary.test.ts` before: 9 files, 76 tests passed. After: 9 files, 76 tests passed.
- `npm run verify:fixtures` after: OK (workspace-v1, workspace-v2).
- `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`: exit 0.

**ocr review of T2.58-B1** (`ocr-review` step): commit `29a439c`, session `0659d4b4-e4e5-4fae-925e-86af2a5416ec`, 1 file reviewed (`trade-views.ts`), 0 comments. No findings. Raw output: `ocr/t2.58-B1-29a439c.json`.

**Complete cumulative run after T2.58-B1** (`suite-runner`, 2026-10-25 00:45 EDT, on `29a439c` plus uncommitted evidence edits): Unit 40 files / 391 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 67 passed (2.0m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.58-B1-*.txt`.

#### T2.59

`tradeSummary(summary)` ("Long 60 shares @ $50.10") and `netCost(value)` ("$3,007.00"; a negative value as "$212.00 credit") in `src/ui/format.ts`; three cases in `format.test.ts` (the fractional-quantity case a first-run pass, mutation-checked with `formatDecimal(quantity, 0)`). `money` has no thousands separator, so `netCost` groups the whole part itself; other Money figures stay ungrouped (noted for the final report).

**ocr review of T2.59** (`ocr-review` step): commit `b8c2826`, session `e90e79c9-b706-41c6-a82b-059d27b525c8`, model `gpt-6.1-sol`, 1 file reviewed (`format.ts`), 0 comments. No findings. Raw output: `ocr/t2.59-b8c2826.json`.

**Complete cumulative run after T2.59** (`suite-runner`, 2026-10-25 00:49 EDT, on `b8c2826`): Unit 40 files / 394 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 67 passed (2.1m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.59-*.txt`.

#### T2.40

Trades tables, structural part (revision 8; implements F9). Measurements added first to `e2e/d2/ui-alignment.spec.ts` (describe "T2.40 Trades tables"), run against `dist-faults` at 390, 320 and 1280 for both "Open Trades" and "Planned Trades", then the CSS written. Two Open and two Planned Trades are seeded; a second case stores two Open Trades as Planned (one with its facts replayable, one not) so both "Records disagree" badges sit in the Planned table at 390 and 320. The "accessibility tree" check counts a figure in `locator.ariaSnapshot()` of the first body row, ignoring the row's own line, whose name repeats the row's text.

Commands:

- Before: markup and view-model in place, CSS not yet: `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts -g T2.40` gave 3 failed (390, 320, 1280), 2 passed (the badge cases, flagged in `tdd-log.md` with a mutation).
- After: `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts -g T2.40` gave 5 passed. The whole of `e2e/d1` and `e2e/d2` gave 72 passed in the first full run, plus the `e2e/d1/plan.spec.ts` fix listed below (rerun with `narrow.spec.ts`: 7 passed).
- Static: `npx vitest run src` 394 passed, `npx vitest run tests/integration` 49 passed, `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run verify:capacity` exit 0.

| Measurement | Before (no CSS) | After |
| --- | --- | --- |
| Open at 390 and 320, "Net cost" header and cells | `display: table-cell` (fail; expected `none`) | `none`; the second line is `display: block` |
| Planned at 390 and 320, "1R" and "Reward : risk" headers and cells | not reached (Open failed first) | `none`; second line `block` |
| Open and Planned at 1280, second line | `inline` (fail; expected `none`) | `none`; the moved columns are `table-cell` |
| Underlying and Trade cells, with the second line and badge, inside the viewport before scrolling at 390 and 320 | not reached | pass (Underlying 5rem + Trade min-width 12.5rem = 280 px fits the 288 px region at 320) |
| Underlying left edge after scrolling fully right | not reached | unchanged on every row; the last cell has moved left |
| Underlying cell | not pinned | `position: sticky`, own card background, 1 px right hairline; region background carries the scroll shadows (`radial-gradient`) |
| Each figure in the accessibility tree, Open and Planned, at 390, 320 and 1280 | not reached | exactly once |
| Focused Underlying link, full outline | not reached | style not `none`; at least 5 px room left, top and bottom inside the region |
| Page overflow at 390, 320 and 1280 | none | none |
| axe (WCAG 2.1 A and AA) on both tables at 390, 320 and 1280, and with badges at 390 and 320 | not reached | clean |
| `e2e/d2/narrow.spec.ts` | green | green, unchanged |

Change: `src/ui/app.css` and `src/ui/screens/TradeList.tsx`. The table stays a native table (no grid or `order`): markup order is visual order. `.wide-only` (Net cost, 1R, Reward : risk header and cells) is `display: none` below 960 px; `.trade-line` (the second line) is `display: none` from 960 px. Columns after the Trade column are `white-space: nowrap` on narrow so the region scrolls.

**Test impact** (every lookup of a removed column or of cell text changed in this commit):

- `src/ui/screens/TradeList.test.tsx`: the Open "quantity as 60 of 100, average cost, fees ..." case, the incoherent Open row case, the Planned columns case, the Planned "badge in the Entry cell" case and the incoherent Planned row case are replaced by the five "Trades table columns" cases; the `timeZone` prop is gone from the renders. The other cases (tabs, heading, states) are unchanged.
- `tests/support/views-fixtures.ts`: `plannedItem` gains `summary`, `openItem` gains `summary` and `netCost` (the T2.58 fields the cell reads). `TradeDetail.test.tsx` and `open-detail-fixtures.ts` also import these fixtures and needed no change.
- `src/ui/screens/TradeList.tsx` and `src/main.tsx`: `TradeList` no longer takes `timeZone` (no time is listed any more).
- `e2e/d2/integrity.spec.ts` ("Planned list row for an incoherent Trade"): the cell list is now `XYZ`, `Not available` plus `Records disagree` in the Trade cell, three `Not available` cells, and the Account.
- `e2e/d1/plan.spec.ts` (B1.2): after clicking the row's link it now waits for the Detail heading before `getByText('$250.00')`. The earlier wait on the text "Planned" was satisfied by the list's own Planned tab, and the list row now carries "$250.00" twice (second line and 1R cell), so the strict lookup raced the navigation.
- `e2e/d2/runtime-failure.spec.ts` (row `toContainText('60 of 100')`) and `e2e/d2/open-position.spec.ts` (Detail text "60 of 100 entered") needed no change: the Entry cell reads "Entering · 60 of 100", which still contains the text, and the Detail is untouched. `narrow.spec.ts` needed no change: it names no removed column. `tools/bench-generate.ts` reads headers and cells generically.
- Grep for the removed column names and for "Records agree", "Average cost", "Last activity", "Planned reward" and "Plan time" in `src`, `e2e` and `tests` found no other list lookup (the Detail's "Plan time" term and the New Plan form's "Plan time" label are unrelated).

**Bench**: `npm run build:bench`, removed the git-ignored `.cache/bench/profile/tj-bench.json`, then `npm run bench:generate` (25,000 Trades, 39.8 s). `bench/expected-open-rows.json`: `headers` are now `Underlying, Trade, Net cost, Entry, Account` (were ten columns); the 200 `rows` have five cells each, for example `["HD", "Long 120 shares @ $300.97Net cost $36,118.83", "$36,118.83", "Resolved · 120 of 120", "Fidelity — Roth IRA"]` (the Trade cell's textContent joins the summary and the second line); `items` equal the committed ones (T2.58 had already regenerated them), `generatorVersion` is still 1 and `schemaVersion` 2. `bench/dataset.json`: only `benchRelease` (the new build hash), `generationMs` and `generatedAt` changed; counts and content are the same.

**ocr review of T2.40** (`ocr-review` step): commit `43b3b8a`, session `6fd6381b-a8cb-4aaa-a9f0-ce598bac3ee4`, model `gpt-6.1-sol`, 6 files reviewed (`TradeList.tsx`, `app.css`, `main.tsx`, `views-fixtures.ts`, both bench files), 0 comments. Raw output: `ocr/t2.40-43b3b8a.json`. The main session also asked the reviewer to judge one point from the code:

| Severity | Location | Claim | Verdict |
| --- | --- | --- | --- |
| low | `TradeList.tsx:184-192`, `app.css` | The Trade cell's summary, inline-block badge and second line are sibling spans with no whitespace, so the cell's text and accessible name run together ("…@ $50.10Records disagree") | Valid for the badge, Doubtful for the block second line; bug task T2.40-B1 |

**Complete cumulative run after T2.40** (`suite-runner`, 2026-10-25 01:04 EDT, on `43b3b8a` plus an uncommitted handoff edit): Unit 40 files / 394 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 72 passed (2.3m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.40-*.txt`.

#### T2.40-B1

Bug from the ocr review of 43b3b8a: the Trade cell's summary, badge and second line ran together ("...$50.10Records disagree").

- Test: TradeList.test.tsx, "Trades table columns", "should separate the Trade cell's summary, badge and second line with a space" (exact cell textContent for an agreeing and a disagreeing coherent row). Red then green in tdd-log.md. Existing T2.40 assertions updated to the spaced text.
- Fix: a space before the badge and before the second line in TradeCell; badge margin-left 0.5rem to 0.25rem.
- Bench: `npm run build:bench`, removed `.cache/bench/profile/tj-bench.json`, `npm run bench:generate`. bench/expected-open-rows.json: 200 rows, only the Trade cell text changed (space before "Net cost"); bench/dataset.json: only benchRelease, generationMs, generatedAt changed; generatorVersion stays 1.
- Checks: `npx vitest run src` 395 passed; typecheck, `npx tsc6 --noEmit`, lint, lint:deps, verify:capacity all exit 0; `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts e2e/d2/narrow.spec.ts e2e/d2/integrity.spec.ts e2e/d2/open-position.spec.ts` 29 passed. Grep of e2e and tests found no exact joined text.

**ocr review of T2.40-B1** (`ocr-review` step): commit `6409358`, session `d03a528b-d7a0-4b01-8247-f71433bacace`, model `gpt-6.1-sol`, 4 files reviewed (`TradeList.tsx`, `app.css`, both bench files), 0 comments. No findings. Raw output: `ocr/t2.40-B1-6409358.json`.

**Complete cumulative run after T2.40-B1** (`suite-runner`, 2026-10-25 01:10 EDT, on `6409358` plus uncommitted evidence and handoff edits): Unit 40 files / 395 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 72 passed (2.3m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.40-B1-*.txt`.

#### T2.41

Wide Trades table styling. Measurements added first to `e2e/d2/ui-alignment.spec.ts` (describe "T2.41 wide Trades table styling"), run against `dist-faults` at 1280, then the CSS written (`src/ui/app.css` only; no markup change).

Commands:

- Before (CSS unchanged): `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts -g T2.41` gave 2 failed (headers: Underlying wrapped to two lines; badge white-space `normal`). To list every failing measurement the assertions were made `expect.soft` for one run, then restored.
- After: same command, 2 passed. With `e2e/d2/narrow.spec.ts`, `e2e/d2/responsive-a11y.spec.ts`, `e2e/d1/responsive-a11y.spec.ts`: 32 passed.
- Static: `npx vitest run src/ui` 116 passed, `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` exit 0.

"One line high" is measured as the th's content height (height minus padding and rule) over its computed line-height, at most 1.6: the plan's raw th height over line-height cannot pass with the 0.6rem cell padding (a one-line header is already about 2.0 times the line-height), so the padding is excluded.

| Measurement at 1280 (Open and Planned) | Before | After |
| --- | --- | --- |
| Every `th` one line (content height / line-height <= 1.6) | fail, all 11 headers 1.98 (Underlying wraps in the 5rem pinned cell, stretching the row) | pass |
| Every `th` uppercase | fail (`none`), 11 of 11 | `uppercase` |
| `th` font size | 16px | 12.8px, weight 600, muted |
| Symbol link font-weight | 400 | 700 |
| Badge white-space | `normal` | `nowrap` (one line high) |
| Badge one line high | pass (first-run pass, mutation-checked) | pass |
| Figure cells (Net cost, 1R, Reward : risk, header and cells) `text-align: right` | pass (existing `.number`; first-run pass, mutation-checked) | pass |
| Figure cells `tabular-nums` | pass (existing `.number`) | pass |

Change: headers get 0.8rem, 600, uppercase, 0.04em tracking, muted, left (right for `th.number`); the symbol link is 700; the badge is `nowrap`. At 960 px and wider only: `--pin` is 7rem so "UNDERLYING" fits on one line, and headers and the columns after the Trade column are `white-space: nowrap` (dates and Entry text do not wrap). Below 960 px the pin stays 5rem, so the T2.40 fit at 320 is unchanged.

**ocr review of T2.41** (`ocr-review` step): commit `8e58d1f`, session `adb63d82-ecbc-4dc0-9ec3-6c4afb13c7ae`, model `gpt-6.1-sol`, 1 file reviewed (`app.css`), 0 comments. No findings. Raw output: `ocr/t2.41-8e58d1f.json`.

**Complete cumulative run after T2.41** (`suite-runner`, 2026-10-25 01:16 EDT, on `8e58d1f`): Unit 40 files / 395 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 74 passed (2.4m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.41-*.txt`.

## T2.42 Semantic badge tones

Tones (CSS `.badge[data-tone=...]` in `src/ui/app.css`, set by `src/ui/Badge.tsx`): neutral (ink on #ece7da), info (#163b75 on #e4edfa, border #1f5fbf), warning (ink on #fff4dd, border #b26b00). None uses the green or red tokens (`--error` and hue checks on text, ground and border).

Contrast measured: neutral 13.94:1, info 9.28:1, warning 15.77:1 (all at least 4.5:1).

Commands:
- `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts -g T2.42` (red before CSS: neutral contrast 1.22; green after).
- `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts e2e/d2/narrow.spec.ts e2e/d2/integrity.spec.ts e2e/d2/responsive-a11y.spec.ts`: 33 passed.
- `npx vitest run src`: 399 passed; typecheck, tsc6, lint, lint:deps clean.

**ocr review of T2.42** (`ocr-review` step): commit `b89dac5`, session `674bb7bc-125a-4fe9-bdbb-46d26be290f4`, model `gpt-6.1-sol`, 4 files reviewed, 0 comments. No findings. Raw output: `ocr/t2.42-b89dac5.json`.

**Complete cumulative run after T2.42** (`suite-runner`, 2026-10-25 01:23 EDT, on `b89dac5`): Unit 41 files / 399 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 75 passed (2.4m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.42-*.txt`.

## T2.43 Prompt chip groups

Measurements added first to `e2e/d2/ui-alignment.spec.ts` (describe "T2.43 prompt chip groups"), run against `dist-faults` on both New Plan (Plan Reflection) and Record entry (Position Change Reflection), then the CSS written (`src/ui/app.css` only; no markup change).

Commands:
- Before: `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts -g T2.43` gave 1 failed. To list every failing measurement the assertions were made `expect.soft` for one run, then restored.
- After: same command, 1 passed. With `e2e/d2/ui-alignment.spec.ts e2e/d1 e2e/d2/responsive-a11y.spec.ts e2e/d2/open-position.spec.ts`: 56 passed.
- Static: `npx vitest run src/ui` 120 passed; typecheck, tsc6, lint, lint:deps exit 0.

| Measurement (both forms) | Before | After |
| --- | --- | --- |
| Checked chip background is ink (rgb 28, 27, 25) | fail (transparent) | pass |
| Checked chip text is white | fail (ink) | pass |
| Fieldset border-style | fail (`solid`) | `none` |
| Radio clipped | fail (13 x 13 px, static) | pass (1 x 1 px, opacity 0, centred in the chip; still focusable) |
| Focused chip outline | fail (`none` on the label) | 3px solid `--focus`, offset 2px, via `:focus-within`; contrast with the ground at least 3:1 |
| `tabTo` reaches the radio with a focus ring; axe | pass | pass |

Change: `fieldset.choices` is borderless; its legend is a small-caps, muted label (0.8rem, 600, 0.04em). `label.chip:has(input:checked)` is ink with white text; the radio is 1 px, transparent and centred in the chip (a `clip-path` radio made Playwright's `check()` fail with "label intercepts pointer events", and existing specs check Reflection radios by label); `label.chip:focus-within` draws the ring. Labels, names and roles are unchanged.

**ocr review of T2.43** (`ocr-review` step): commit `114462a`, session `55ff525a-92a1-4e54-9f23-c650b9acf555`, model `gpt-6.1-sol`, 1 file reviewed (`app.css`), 1 comment. Raw output: `ocr/t2.43-114462a.json`.

| Severity | Location | Claim | Verdict |
| --- | --- | --- | --- |
| medium | `app.css:332-336` | In forced-colors mode the checked and unchecked chips look identical: the checked state is background and text colour only, and the native radio is `opacity: 0` | Valid (no `forced-colors` rule exists); bug task T2.43-B1, run after T2.44 because both touch `app.css` and `ui-alignment.spec.ts` |

**Complete cumulative run after T2.43** (`suite-runner`, 2026-10-25 01:33 EDT, on `114462a`): Unit 41 files / 399 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 76 passed (2.5m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.43-*.txt`.

## T2.44 Execution rows as panels

Measurements added first to `e2e/d2/ui-alignment.spec.ts` (describe "T2.44 execution rows as panels"), run against `dist-faults` on the Record entry form with two Executions, then the CSS written (`src/ui/app.css` only; no markup change, since `.field:nth-of-type(4)` spans the Economic Time row).

Commands:
- Before: `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts -g T2.44` gave 1 failed. A soft-assertion run listed every failing measurement, then the assertions were restored.
- After: same command, 1 passed. `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts e2e/d2 e2e/d1/responsive-a11y.spec.ts`: 53 passed.
- Static: `npx vitest run src/ui` 120 passed; typecheck, tsc6, lint, lint:deps exit 0.

| Measurement | Before | After |
| --- | --- | --- |
| Fieldset border-style | fail (`groove`) | `none` |
| Fieldset border-radius | fail (0 px) | 14 px (`--radius`) |
| 1280: Quantity, Price, Fee share a top y | fail (412.4 / 495.6 / 578.8) | pass (three columns) |
| 390: Quantity and Price share a top y | fail (401.4 / 484.6) | pass (two columns) |
| 390: Economic Time below Price, Fee below Quantity | pass | pass (full-width row) |
| Names and roles (`fillRows`, whole d2 and responsive suites) | pass | pass |

Change: `fieldset.execution-row` is a borderless tinted panel (`--neutral-ground`) and a grid, two columns, three from 640 px; its legend is the small-caps muted label used by T2.43; the fourth field and the Remove button span the row. "Remove Execution N" is a text-style button (no border, transparent, underlined, error colour). "Add Execution" keeps `pill secondary`, which is already the outlined pill. T2.43's `fieldset.choices` and `label.chip` rules are unchanged.

**ocr review of T2.44** (`ocr-review` step): commit `e0ca94b`, session `a6c27e09-4955-4e69-93cc-15dcc5a90e92`, model `gpt-6.1-sol`, 1 file reviewed (`app.css`), 0 comments. Raw output: `ocr/t2.44-e0ca94b.json`. The main session asked the reviewer to judge two points from the code:

| Severity | Location | Claim | Verdict |
| --- | --- | --- | --- |
| low | `app.css:331-339` | The Remove button's error-red text extends red beyond the ui-contract's reserved uses (signed results, Stop/Target, `ui-contract.md:20`) | Doubtful; bug task T2.44-B1 (ink or muted text) |
| low | `app.css:325` | `.field:nth-of-type(4)` places Economic Time by `div` position and breaks silently if a `div` child is added or reordered | Doubtful; bug task T2.44-B1 (a class on the Economic Time field) |

**Complete cumulative run after T2.44** (`suite-runner`, 2026-10-25 07:12 EDT, on `e0ca94b`; the first attempt stopped at the usage limit and was rerun from the start): Unit 41 files / 399 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 77 passed (2.4m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.44-*.txt`.

## T2.43-B1 Checked chip in forced colors

Bug from the ocr finding on `114462a` (checked chip shown only by background and text colour). Measurement added first to `e2e/d2/ui-alignment.spec.ts` (describe "T2.43-B1 prompt chips in forced colors"), with `page.emulateMedia({ forcedColors: 'active' })` on New Plan, against `dist-faults`.

Commands:
- Before: `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts -g T2.43-B1` gave 1 failed. A first version that compared raw computed background-color passed before the fix and was replaced (see tdd-log).
- After: same command, 1 passed. `npx playwright test e2e/d2/ui-alignment.spec.ts e2e/d1 e2e/d2/responsive-a11y.spec.ts`: 55 passed. `npx vitest run src/ui` 120 passed; typecheck, tsc6, lint, lint:deps exit 0.

| Measurement (forced colors active) | Before | After |
| --- | --- | --- |
| Checked vs unchecked chip: shown background, border, outline | fail (identical: white, 1px black, no outline) | pass (checked chip is Highlight) |
| Focused chip outline | pass (3px solid) | pass (3px solid CanvasText) |

Change: `@media (forced-colors: active)` in `src/ui/app.css`: `label.chip:has(input:checked)` uses `Highlight` background and border with `HighlightText` text and `forced-color-adjust: none`; `label.chip:focus-within` keeps its 3px outline in `CanvasText`.

**ocr review of T2.43-B1** (`ocr-review` step): commit `c0df19d`, session `2b7820ab-fb58-4435-a973-6a9e76c98a20`, model `gpt-6.1-sol`, 1 file reviewed (`app.css`), 0 comments. No findings. Raw output: `ocr/t2.43-B1-c0df19d.json`. The focus-outline assertion was a first-run pass; its mutation check (`outline: none` in the forced-colors block: "focus outline style in forced colors") is in `065e34d`.

**Complete cumulative run after T2.43-B1** (`suite-runner`, 2026-10-25 07:19 EDT, on `065e34d`): Unit 41 files / 399 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 78 passed (2.4m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.43-B1-*.txt`.

## T2.44-B1 Ink Remove button and a class for Economic Time

Bug from two Doubtful ocr points on `e0ca94b`. Measurement added first to the T2.44 describe in `e2e/d2/ui-alignment.spec.ts` (Remove Execution 2: computed colour is not the `--error` colour, contrast against the panel background at least 4.5, still underlined), against `dist-faults`. For point (b), the existing layout assertions (Economic Time below at 390, three shared tops at 1280) are the guard; it is a refactor, so they pass before and after, which is expected and is not a first-run pass.

Commands:
- Before: `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts -g T2.44` gave 1 failed (Remove button colour is not the error red).
- After: same command, 1 passed. `npx playwright test e2e/d2/ui-alignment.spec.ts e2e/d2 e2e/d1/responsive-a11y.spec.ts`: 54 passed. `npx vitest run src/ui` 120 passed; typecheck, tsc6, lint, lint:deps exit 0.

| Measurement | Before | After |
| --- | --- | --- |
| Remove button colour is not `--error` | fail (`--error`, #a3261b) | pass (`--muted`, #55524b) |
| Remove button contrast on `--neutral-ground` >= 4.5 | pass (error red) | pass (muted on #ece7da, about 6.7) |
| Remove button stays underlined | pass | pass |
| Economic Time below Price at 390; three shared tops at 1280 | pass | pass (selected by `.field-wide`) |

Change: `.execution-row > button.pill` uses `var(--muted)`; the Economic Time field wrapper in `PositionChangeForm.tsx` gets `field field-wide` and the CSS selects `fieldset.execution-row > .field-wide` instead of `.field:nth-of-type(4)`. Labels, names and roles are unchanged.

**ocr review of T2.44-B1** (`ocr-review` step): commit `fd6b68b`, session `08cd7762-6d79-4652-8667-8287b3a83485`, model `gpt-6.1-sol`, 2 files reviewed (`app.css`, `PositionChangeForm.tsx`), 0 comments. Raw output: `ocr/t2.44-B1-fd6b68b.json`. The main session asked the reviewer to judge one point:

| Severity | Location | Claim | Verdict |
| --- | --- | --- | --- |
| low | `PositionChangeForm.tsx:311` | `input()` adds `field-wide` whenever a `type` is passed, so a later typed field would silently become full-width | Valid (minor); bug task T2.44-B2 (an explicit option) |

**Complete cumulative run after T2.44-B1** (`suite-runner`, 2026-10-25 07:25 EDT, on `fd6b68b`): Unit 41 files / 399 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 78 passed (2.4m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.44-B1-*.txt`.

## T2.44-B2

Refactor, no behaviour change: `input()` in `src/ui/screens/PositionChangeForm.tsx` takes an explicit trailing `wide = false` argument; only the Economic Time call passes `true`. Rendered markup unchanged.

| Check | Before | After |
|---|---|---|
| `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts -g T2.44` | 1 passed | 1 passed |
| `npx vitest run src/ui` | 13 files, 120 tests passed | 13 files, 120 tests passed |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | n/a | all exit 0 |

**ocr review of T2.44-B2** (`ocr-review` step): commit `76724a3`, session `59f1aee8-fe94-402c-82a9-0ad2df5dd08b`, model `gpt-6.1-sol`, 1 file reviewed (`PositionChangeForm.tsx`), 0 comments. No findings. Raw output: `ocr/t2.44-B2-76724a3.json`.

**Complete cumulative run after T2.44-B2** (`suite-runner`, 2026-10-25 07:29 EDT, on `76724a3`): Unit 41 files / 399 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 78 passed (2.5m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.44-B2-*.txt`.

## T2.45 New Plan grouped into cards

Measurements added first to `e2e/d2/ui-alignment.spec.ts` (describe "T2.45 New Plan grouped into cards"), run against `dist-faults`, then `PlanForm` markup and one CSS rule.

Commands:
- Before: `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts -g T2.45` gave 1 failed (timeout waiting for the region named Trade).
- After: same command, 1 passed. `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts e2e/d1 e2e/d2/responsive-a11y.spec.ts e2e/d2/narrow.spec.ts`: 61 passed.
- Static: `npx vitest run src/ui` 120 passed; typecheck, tsc6, lint, lint:deps exit 0.

| Measurement | Before | After |
| --- | --- | --- |
| Region Trade holds Account, Strategy, Symbol, Plan time | fail (no region) | pass |
| Region Risk holds Quantity, Intended entry, Stop, Target | fail (no region) | pass |
| Region Plan Reflection holds both text prompts and the chips | fail (no region) | pass |
| 1280: Quantity and Intended entry share a top y; Stop and Target share a top y, below | not reached | pass |
| 390: same, two inputs per row | not reached | pass |
| `fillPlan`, `confirmPlan`, D1 Plan specs, narrow and responsive-a11y | pass | pass |

Change: `PlanForm` wraps its controls in three `section.card` elements, each `aria-labelledby` an `h2` (Trade, Risk, Plan Reflection; the existing small-caps `h2` style). Risk inputs sit in `div.risk-grid` (two columns at any width). Labels, names, roles and entry order are unchanged. No existing heading lookup became ambiguous, so none was changed.

**ocr review of T2.45** (`ocr-review` step): commit `23a10eb`, session `71f413e8-9ddb-4ddd-a517-b1701a9bfe86`, model `gpt-6.1-sol`, 2 files reviewed (`app.css`, `PlanForm.tsx`), 0 comments. Raw output: `ocr/t2.45-23a10eb.json`. The main session asked the reviewer to judge one point:

| Severity | Location | Claim | Verdict |
| --- | --- | --- | --- |
| n/a | `app.css:347`, `PlanForm.tsx:147` | A field error under one Risk input could misalign the two-column rows | Wrong (dismissed): each error sits inside its own `div.field`, the grid uses `align-items: start` and `minmax(0, 1fr)`, so a taller cell only makes its row taller and paired inputs keep a shared top y |

**Complete cumulative run after T2.45** (`suite-runner`, 2026-10-25 07:37 EDT, on `23a10eb`): Unit 41 files / 399 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 79 passed (2.5m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.45-*.txt`.

#### T2.47

Clear corrected issues (U4) on New Plan and Record entry: `IssueSummary` takes the submitted issues and a render-time `corrected` predicate, hides corrected lines, hides itself when none remain, and moves focus only when a new submit result arrives. The forms judge each client-judgeable issue against a snapshot of the submitted values; server-only issues stay until the next submit. Tests: five cases in `PlanForm.test.tsx` and `PositionChangeForm.test.tsx` (cases 2 and 3 first-run passes, mutation-checked; flagged in the handoff). Checks: `npx vitest run src` 404 passed; `build:faults` + `e2e/d1 e2e/d2` 79 passed.

**ocr review of T2.47** (`ocr-review` step): commit `9c00b37`, session `a831fa68-dbfb-408d-b102-bd6e8e907b04`, model `gpt-6.1-sol`, 5 files reviewed, 5 comments, plus three main-session questions. Raw output: `ocr/t2.47-9c00b37.json`.

| Severity | Location | Claim | Verdict |
| --- | --- | --- | --- |
| medium | `PlanForm.tsx:162` | `InvalidPrice` mapped to entry only; the domain raises it for entry, Stop or Target | Valid; T2.47-B1 |
| medium | `PlanForm.tsx:158` | `MissingInstrument` clears on any non-empty symbol; the domain also rejects malformed symbols | Valid; T2.47-B1 |
| medium | `form-issues.tsx:64` | A whitespace-only Text answer clears a required-prompt issue; the domain trims | Valid; T2.47-B1 |
| medium | `PositionChangeForm.tsx:276` | `NonexistentLocalTime` and `AmbiguousLocalTime` never clear | Valid; T2.47-B1 |
| low | `PlanForm.tsx:165` | Stop/Target compared with `Number`, the domain with exact `Rational` | Doubtful; T2.47-B1 (reuse `parseDecimal` and `Rational`) |
| (question a) | `form-issues.tsx` | Client decimal checks restate the domain rule | Matches in effect; `domain/values` is importable from `src/ui`, so T2.47-B1 replaces the duplicated regex |
| (question b) | `PositionChangeForm.tsx:268-282` | A removed Execution row's issue line can never clear (no dangling link) | Valid (minor); T2.47-B1 |
| (question c) | both forms | Snapshot gating | Holds apart from the rows above |

**Complete cumulative run after T2.47** (`suite-runner`, 2026-10-25 07:46 EDT, on `9c00b37`): Unit 41 files / 404 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 79 passed (2.5m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.47-*.txt`.

#### T2.47-B1

Issue clearing judged by the domain's rules: `InvalidPrice` clears only when entry, Stop and Target are all valid (the server issue names no field); `MissingInstrument` only for a symbol matching the domain rule; a whitespace-only Text answer stays unanswered; all three local-time codes clear once `fromWorkspaceLocal` succeeds; decimals parsed with `parseDecimal` and compared with `Rational.compare` (the client regex is gone); an issue whose Execution row was removed counts as corrected. Six cases, each red first (`tdd-log.md`); no first-run passes. Checks: `npx vitest run src` 410 passed; `build:faults` + `e2e/d1 e2e/d2` 79 passed.

**ocr review of T2.47-B1** (`ocr-review` step): commit `6b1a875`, session `d60aa360-8407-43ff-ab7b-fbd8a1641351`, model `gpt-6.1-sol`, 3 files reviewed, 0 comments. No findings. Raw output: `ocr/t2.47-B1-6b1a875.json`.

**Complete cumulative run after T2.47-B1** (`suite-runner`, 2026-10-25 07:56 EDT, on `6b1a875`): Unit 41 files / 410 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 79 passed (2.4m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.47-B1-*.txt`.

## T2.48 Detail back link

- Case 1: "Back to Trades" link (router Link, arrow icon from icons.tsx) sits before the h1; Open goes to `/`, Planned to `/?lifecycle=Planned`.
- Case 2: the link also shows in Loading, Not Found and Error states. Lifecycle is unknown there and no origin tab is carried in router state, so the target is `/` (the Open tab).
- T2.29 heading focus: TradeDetail has no heading-focus code; nothing there moves focus, and all src tests stay green (412 passed).
- Test impact: all e2e lookups of the "Trades" link (e2e/d1 no-save, responsive-a11y; e2e/d2 ui-alignment) are scoped to the Primary navigation; no edit needed. e2e/d1 and e2e/d2: 79 passed.

**ocr review of T2.48** (`ocr-review` step): commit `7e09465`, session `859519a9-7216-4d82-876d-8c3fa6f5e888`, model `gpt-6.1-sol`, 3 files reviewed, 0 comments. No findings. The reviewer also confirmed from the code that `BackIcon` renders through the shared `Icon` (`aria-hidden="true"`, `focusable="false"`, no `<title>`), so the link's name is exactly "Back to Trades". Raw output: `ocr/t2.48-7e09465.json`.

**Complete cumulative run after T2.48** (`suite-runner`, 2026-10-25 08:03 EDT, on `7e09465`): Unit 41 files / 412 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 79 passed (2.5m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.48-*.txt`.

## T2.49 Detail summary card

Cases (all in `src/ui/screens/TradeDetail.test.tsx`, describe "summary card"), each red then green in `tdd-log.md`: Trade Summary text and Net cost; Planned Intended entry, Stop, Target, 1R, Reward : risk; Open quantity against plan ("120 of 100 shares"), Entry, Opening fees, Stop, Target; Average entry and Actual initial risk once resolved, "Entry not yet resolved" before; "Deviation active" warning badge; no card on an incoherent Detail (first-run pass, mutation recorded in the log).

Choices:
- `SummaryCard` is a `section.card.summary-card` named "Summary" (aria-label), after the h1 and back link and before every other region; the incoherent Detail has none, so the Records disagree panel is first.
- Uses only Detail view values (`summary`, `netCost`, plan legs/stops/targets, baseline, positions, fees, entryStatus, entryQuality, deviations). Stop and Target values use new `--stop` / `--target` tokens and always carry the text labels. Figures use the `number` class (tabular numerals). The deviation badge uses `<Badge tone="warning">`.
- Fixtures: `plannedDetail` gained `summary`; `openDetailOf` builds `summary` as Trade Views does (open quantity at weighted Open Lot price).

Test-impact list (lookups the card made ambiguous):
- `e2e/d1/plan.spec.ts` (line 24): `getByText('$250.00')` now matches the Summary 1R and Plan Baseline 1R; scoped to the Plan Baseline region.
- `e2e/d1/responsive-a11y.spec.ts` (line 179): same lookup, same fix.
- `src` unit tests and `tests`: no lookup became ambiguous (they are already region-scoped); all 467 pass. `e2e/d2` unaffected.

Checks: `npx vitest run src tests` 467 passed; typecheck, `tsc6 --noEmit`, lint, lint:deps exit 0; `npm run build:faults && npx playwright test e2e/d1 e2e/d2` 77 passed, then the 2 failures above fixed and rerun green.

**ocr review of T2.49** (`ocr-review` step): commit `d96f781`, session `977813ec-b042-422a-8053-ac303957c5fe`, model `gpt-6.1-sol`, 4 files reviewed, 0 comments. No findings. The reviewer also checked from the code: Stop and Target each carry a text label (colour only reinforces), and their contrast on the white card is 7.37:1 (`#a3261b`) and 6.55:1 (`#1d6b34`). Raw output: `ocr/t2.49-d96f781.json`.

**Complete cumulative run after T2.49** (`suite-runner`, 2026-10-25 08:13 EDT, on `d96f781`; this also covers the full browser set the subagent did not rerun after scoping the two `$250.00` lookups): Unit 41 files / 418 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 79 passed (2.5m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.49-*.txt`.

## T2.50 Executions as expandable rows (U3)

Commits: view amendment (reflection items carry their Position Change), then the UI.

**View amendment.** The Journal's narrative projection now adds `positionChangeId` (from the stored `origin.factId`, where the origin is a Position Change) to reflection Entry and Decline items; Plan Reflection items carry none. No storage or schema change; `npm run verify:fixtures` stays green with no snapshot regenerated. Case: `open-views.test.ts`, "should carry the positionChangeId of its Position Change on a reflection Entry and a Decline, and none on other items". The existing exact-shape assertions in `position-change-reflection.test.ts` gained the new field.

**Cases (TradeDetail.test.tsx, describe Executions), each red then green in tdd-log.md:** region and count; collapsed row without fee; disclosure button; expanded details; reflection answers; declined or none; group marking; Enter and Space (first-run pass, flagged, mutation recorded in tdd-log.md).

**Measurement** (`e2e/d2/ui-alignment.spec.ts`, T2.50, against dist-faults; red then green logged by hand):

| Check | 320 px | 1280 px |
| --- | --- | --- |
| Expanded label vs value | label top above value top | label top equals value top (side by side) |
| Row time span | one client rect, height within 1.6 x line-height | same |
| Row clipping (scrollWidth vs clientWidth), right edge, page width | none | none |
| Open Lots headers scrollWidth within clientWidth; Opened cell on one line (was 3 lines at 70.55 px, limit 37.12) | pass after unpinning the first column | not measured |

**Test impact, every changed lookup:**
- `TradeDetail.test.tsx`: Open Detail case, Position Changes heading list and Executions tables replaced by the Executions region and its button names; incoherent Detail case, Executions tables replaced the same way. Journal-region lookups of "Position Change at ..." unchanged (T2.51 owns them). Entry Quality and Deviation text unchanged.
- `e2e/d2/open-position.spec.ts`: Position Changes heading and Executions table rows replaced by region "Executions (2)", two buttons, and the expanded "2026-10-12 10:00 · 2 Executions".
- `e2e/d2/durability.spec.ts`: Executions table row count replaced by two row buttons in "Executions (2)".
- `e2e/d2/offline.spec.ts`: two Position Change headings replaced by three row buttons and the expanded "· 1 Execution" of the 11:00 row.
- `e2e/d2/after-save.spec.ts`: region "Position Changes" replaced by "Executions (2)".
- `e2e/d2/narrow.spec.ts` unchanged and green; Open Lots remains a table.
- `tests/support/open-detail-fixtures.ts`: pc1Reflection and pc2Decline gained `positionChangeId`.

**Checks:** `npx vitest run src` 427 passed; `tests/integration` 49 passed; typecheck, `tsc6`, lint, lint:deps, verify:fixtures all exit 0; `npm run build:faults && npx playwright test e2e/d1 e2e/d2` 80 passed.

**ocr review of T2.50** (`ocr-review` step): range `ce50e09^..60d8b8f`, session `1ab24a47-a5b4-4bc3-8870-326199d8630d`, model `gpt-6.1-sol`, 6 files reviewed, 2 comments, plus two main-session questions. Raw output: `ocr/t2.50-ce50e09-60d8b8f.json`.

| Severity | Location | Claim | Verdict |
| --- | --- | --- | --- |
| medium (cosmetic) | `app.css:801` | `.table-scroll.lots-scroll { --pin: 0px }` never matches: the Open Lots wrapper lacks `lots-scroll`, so the left scroll shadow sits 5–7rem inside the table | Valid; T2.50-B1 |
| low | `TradeDetail.tsx:370` | Nested ternary in `ExecutionRow`'s reflection rendering | Valid (style); T2.50-B1 |
| (question a) | `TradeDetail.tsx:326` | The row button's `aria-label` "Details for Buy 30 XYZ at 10:00" does not contain the visible text (WCAG 2.5.3 Label in Name) | Valid; the plan's example name was wrong and was corrected in `171796b`; T2.50-B1 |
| (question b) | `journal.ts:178, 317`; `TradeDetail.tsx:407` | `positionChangeId` only on Position Change reflections; a Plan Reflection never matches an Execution | Holds (match by key) |

**Complete cumulative run after T2.50** (`suite-runner`, 2026-10-25 08:50 EDT, on `60d8b8f`): Unit 41 files / 427 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 80 passed (2.5m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.50-*.txt`.

## T2.50-B1 (fix for review of ce50e09..60d8b8f)

- Label in Name: execution row button uses `aria-labelledby` (visible summary + visually hidden "details"); `aria-label` removed. Lookups updated: TradeDetail.test.tsx (several), e2e/d2/open-position.spec.ts, e2e/d2/offline.spec.ts, e2e/d2/ui-alignment.spec.ts.
- Open Lots wrapper gained `lots-scroll`; Playwright T2.50 asserts `--pin` is 0px at 320 (red: Received "5rem"; green after the class).
- Reflection branches moved to `ExecutionReflection`.
- `npx vitest run src`: 41 files, 427 passed. typecheck, `npx tsc6 --noEmit`, lint, lint:deps: exit 0.
- `npm run build:faults && npx playwright test e2e/d1 e2e/d2`: 80 passed.

**ocr review of T2.50-B1** (`ocr-review` step): commit `090eb06`, session `4952443b-bb68-4f72-a61f-d450c7c14f4b`, model `gpt-6.1-sol`, 2 files reviewed, 0 comments, plus three main-session questions. Raw output: `ocr/t2.50-b1-090eb06.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| (question a) | `TradeDetail.tsx:360-370` | The `aria-labelledby` name begins with the visible summary; the IDs are keyed on the Execution's `factId`, so they are unique when two Executions share a Position Change | Holds |
| (question b) | `app.css:813-823` | `.visually-hidden` is the standard clip pattern; no horizontal overflow at 320 px | Holds (the nit, `position: relative` on the toggle, is not needed; dismissed) |
| (question c) | `TradeDetail.tsx:310-335` | `ExecutionReflection` renders the same output as the old ternary in every branch | Holds |

**Complete cumulative run after T2.50-B1** (`suite-runner`, 2026-10-25 09:07 EDT, on `090eb06`): Unit 41 files / 427 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 80 passed (2.4m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.50-b1-*.txt`.

**ocr review of T2.51** (`ocr-review` step): commit `8e0253f`, session `ee1ee150-2221-4f21-83d1-8e190f89ab96`, model `gpt-6.1-sol`, 1 file reviewed (4 excluded), 0 comments, plus four main-session questions. Raw output: `ocr/t2.51-8e0253f.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| (question a) | `TradeDetail.tsx:588` | Authored shows when `authoredTime !== momentTime`, a raw string compare. Instants seconds apart, or one instant written two ways, give an Authored row that reads the same as Moment | Doubtful; T2.51-B1 (show Authored only when its displayed time differs from the displayed Moment) |
| (question b) | `TradeDetail.tsx:574` | "Journal (n)" counts the same array that is rendered, declines included | Holds |
| (question c) | `TradeDetail.tsx:577-579` | The Badge is a plain span, so the heading's name is the Entry Type text | Holds (code reading; axe coverage of a Detail with Journal items to be confirmed at T2.53/T2.55) |
| (question d) | `TradeDetail.tsx:169, 304` | `view.plan.underlying` is required on every Detail branch, incoherent included | Holds |

**Complete cumulative run after T2.51** (`suite-runner`, 2026-10-25 09:16 EDT, on `8e0253f`): Unit 41 files / 431 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 80 passed (2.4m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.51-*.txt`.

**ocr review of T2.52** (`ocr-review` step): commit `659a2b2`, session `bc555914-a623-472f-b5d5-40e5f9dd8310`, model `gpt-6.1-sol`, 1 file reviewed, 0 comments, plus four main-session questions. Raw output: `ocr/t2.52-659a2b2.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| (question a) | `PositionChangeForm.tsx:303-304` | The entered quantity sums the view's net `positions[].quantity` with `Rational`; `legFulfillment` was suggested as a more direct source | Holds: `LegFulfillment` carries only a status, no quantity, and the Detail sums `positions` the same way (`TradeDetail.tsx:209, 636`) |
| (question b) | `PositionChangeForm.tsx:303-306` | "Not entered yet" exactly on a Planned view; an Open view always has positions | Holds |
| (question c) | `PositionChangeForm.tsx:294-297, 138-142` | The link before the h1 takes no initial focus (focus goes to the h1); heading order unchanged | Holds |
| (question d) | `PositionChangeForm.tsx:298` | "Trade" is the only region with that name on the page | Holds (naming nit dismissed; it matches the New Plan "Trade" card of T2.45) |

**Complete cumulative run after T2.52** (`suite-runner`, 2026-10-25 09:23 EDT, on `659a2b2`): Unit 41 files / 433 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 80 passed (2.4m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.52-*.txt`.

#### T2.53

Detail, receipt and Accounts styling. Measurements added first to `e2e/d2/ui-alignment.spec.ts` (describe "T2.53 Detail, receipt and Accounts styling", eight cases), run against `dist-faults`. The Detail is an Open Trade with three Executions (PC1 and PC2) and Journal items including a decline. Colours are read through `getComputedStyle`; `--tint` was added as `#f3efe6` (it did not exist before; Execution fieldsets in the form keep `--neutral-ground`). Changes: summary `dd` at 1.125rem, 700, tabular; Plan Baseline and Entry Quality as `dl.figure-grid` of row wrappers (a `Figure` component), two columns of at most 480 px from 960 px; Plan Reflection answers as `dl.answers` (prompt above answer, hairline between); Detail Execution rows on `--tint` with the price in a right-aligned `.execution-money` span and the time on its own line; the receipt rows reuse that style (`ul.executions`, `li.execution-line`); "Back to the Trade" is `pill primary` (still a link); Accounts lists as `ul.rows`.

Commands:

- Before: `npm run build:faults && npx playwright test e2e/d2/ui-alignment.spec.ts -g T2.53` gave 7 failed, 1 passed (Stop and Target, flagged in `tdd-log.md` with a mutation); the overflow and axe case had no valid red (flagged, two mutations).
- After: the same command gave 8 passed. `npx playwright test e2e/d1 e2e/d2` gave 88 passed.
- Static: `npx vitest run src` 434 passed; `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` exit 0.
- Lookups: none needed changing. The Execution row's accessible name is unchanged; the receipt row's text is unchanged.

**ocr review of T2.51-B1** (`ocr-review` step): commit `489ad59`, session `43d23968-313c-4aab-9c85-ea48c036b2df`, model `gpt-6.1-sol`, 1 file reviewed, 0 comments, plus two main-session questions. Raw output: `ocr/t2.51-b1-489ad59.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| (question a) | `TradeDetail.tsx:576-621` | Output unchanged apart from the Authored condition (keys, decline branch, Moment row) | Holds |
| (question b) | `format.ts:25`, `domain/time/local.ts:7-12` | `localTime` is locale-independent and takes the time zone explicitly, so equal instants format identically | Holds |
| (reviewer note) | `TradeDetail.tsx` Journal | At a DST fall-back, an Authored an hour after Moment reads the same and is hidden | Dismissed for this task: shown, it would read the same as Moment. The missing offset is app-wide; listed for the final report |

**Complete cumulative run after T2.51-B1** (`suite-runner`, 2026-10-25 09:29 EDT, on `489ad59`): Unit 41 files / 434 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 80 passed (2.5m); static and verify checks 11 of 11 exit 0. Failures: none. Outputs: `suite-runs/t2.51-b1-*.txt`.

#### T2.54

Reference-pair screenshots. `npm run ui:screenshots` (`tools/ui-screenshots.ts`) builds `dist-faults`, serves it with the release harness server as the e2e specs do, drives one fresh profile through the `e2e/d2/support.ts` steps (America/New_York, Playwright clock and native `Temporal.Now` fixed at 2026-10-12 16:00 -04:00), and captures 17 screens at 390x844 and 1280x900 into `evidence/D02/ui-alignment/`, with a generated README pairing each with its reference. Page captures are full page; 11-reflection and 15-journal are element captures. The comparison report names the screens only as 01-first-launch through 17-about, so the 17 were chosen from its per-screen sections (list in the README). No helper was added to `support.ts`.

- Command: `npm run ui:screenshots`; exit code 0 (run four times); output `wrote 34 PNGs and the README to evidence/D02/ui-alignment`; 34 PNGs plus `README.md`, 3.2 MB.
- Determinism: two consecutive runs gave byte-identical files except three 1280 px captures (04, 06, 09), which differ by pixel noise only. Authored times in the Journal read 2026-10-12 on every run.
- Static: `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` exit 0; `npx vitest run src` 434 passed.

## T2.53-B1 money flush right, name equals visible text

Defect 1 (cumulative run on f021f3a, `ui-alignment.spec.ts:1042`, `money flush right at 390`, 15.03): reproduced in isolation with `--repeat-each=10` (5 of 10 failed, always the 390 pass, the first resize from the default 1280 viewport). Cause: test timing. The case measured immediately after `setViewportSize`, before the shell's `data-layout` had switched to narrow; the CSS is right. Fix: the test now waits for `.shell` `data-layout` to equal wide or narrow for the width, as the overflow case does (no timeout or retry). After the fix: `--repeat-each=10` 10 passed, twice, and the full `npm run test:e2e` 88 passed.

Defect 2 (WCAG 2.5.3 Label in Name): removed the visually hidden dot between price and time in the Execution summary, so the button's accessible name is the visible text plus " details" ("Buy 60 XYZ @ $50.10 2026-10-12 10:00 details"). Red/green in `tdd-log.md`. Screenshots regenerated: the Detail PNGs are unchanged (nothing visible changed); the script also re-rendered three unrelated PNGs (09 record-entry 1280, 17 about 1280 and 390), which were reverted as noise.

## T2.53-B2 wait for the layout before measuring

Every T2.53 case in `e2e/d2/ui-alignment.spec.ts` that resizes the page now waits for `.shell` `data-layout` before measuring: added to the summary figures, Plan Baseline and Entry Quality (both resizes), Plan Reflection, receipt, and Accounts cases (the Execution row and overflow cases already had it). One helper, `expectLayout(page, width)`, replaces the four inline waits; it uses a local `WIDE_LAYOUT_MIN_WIDTH = 960` (the AppShell value; importing AppShell.tsx would load React into the e2e runner) instead of the wrong cutoff of 640. The `width < 640` at the T2.50 label-above-value check is left: it mirrors the CSS `@media (max-width: 639.98px)` at app.css:818, a viewport rule independent of the shell layout. The receipt case's tolerance went from 20 px to 1 px, measured to the row's content edge, because the row has 12 px of padding the 20 px hid. The receipt case could not be made flaky without the wait (40 of 40 passed): its measure is layout independent. Result: `--repeat-each=10` over the T2.53 and T2.50 cases, 90 passed. Static: typecheck, `npx tsc6 --noEmit`, lint, lint:deps exit 0.

## T2.54-B1 release every resource on failure

Review finding (valid, minor): in `tools/ui-screenshots.ts`, `profileAt(dir).launch()` ran before the `try`, and `context.close()` ran first in the `finally`, so a failed launch or a rejecting close skipped `server.close()` and the temp-dir removal. `main` now acquires each resource inside the `try` of the one before it, with nested `finally`s (server, then temp dir, then context); the page-driving body moved unchanged into `drive(context)`. Each release runs even if an inner release throws.

- `npm run ui:screenshots`: wrote 34 PNGs and the README, exit 0. Six 1280 and 390 PNGs re-rendered as pixel noise (04, 06, 09, 14, 17 at 1280; 17 at 390) and were reverted; no PNG is committed.
- Forced failure (temporary `throw new Error('forced launch failure')` just before `launch()`, with a probe printing the temp dir and whether the server answered): the probe printed `FORCED port open: true`, the run exited with `Error: forced launch failure`, afterwards no `ui-screenshots-*` directory remained in the temp dir and `http://127.0.0.1:5175/` no longer answered (server closed). The throw and probe were removed. Note: the script deletes `evidence/D02/ui-alignment` on start, so the forced run emptied it; restored with `git checkout`.
- Static: typecheck, `npx tsc6 --noEmit`, lint, lint:deps exit 0. Full `npm run test:e2e`: 88 passed.

**ocr review of T2.53** (`ocr-review` step): commit `f021f3a`, session `941b239d-8541-4826-a03f-28d5870571cf`, model `gpt-6.1-sol`, 4 files reviewed, 0 comments, plus four main-session questions. Raw output: `ocr/t2.53-f021f3a.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| (question a) | `TradeDetail.tsx:371-376`, `app.css:920` | A visually hidden "·" between price and time means the name no longer contains the visible text as one run (WCAG 2.5.3, strict reading) | Valid; T2.53-B1 |
| (question b) | `PositionChangeReceipt.tsx:69-74, 127`, `app.css:36-43` | Receipt text unchanged; "Back to the Trade" still a link with the global focus outline | Holds |
| (question c) | `TradeDetail.tsx:155-158, 186-194` | `Figure` gives valid dl > div > dt + dd | Holds |
| (question d) | `app.css:702-896` | No new rule leaks to other screens | Holds |

**Complete cumulative run after T2.53** (`suite-runner`, 2026-10-25 09:45 EDT, on `d82cce4`, the evidence commit on `f021f3a`): Unit 434 passed; Node integration 49 passed; Browser 1 failed, 87 passed — `ui-alignment.spec.ts:1042` "money flush right at 390", expected <= 1, received 15.03; checks 11 of 11 exit 0. Outputs: `suite-runs/t2.53-*.txt`. The failure went to T2.53-B1 (test measured before the narrow layout settled).

**ocr review of T2.54** (`ocr-review` step): commit `662b1d2`, session `da71857a-5e7d-4114-921b-657075a55a3e`, 2 files reviewed (PNGs excluded), 1 comment. Raw output: `ocr/t2.54-662b1d2.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| ocr comment / (question b) | `tools/ui-screenshots.ts:122, 203-205` | `launch()` outside the `try`, and a throwing `context.close()`, skip the server and temp-dir cleanup | Valid (minor; the port is freed with the process, a temp dir can leak); T2.54-B1 |
| (question a) | `src/app/system.ts:6` | The `Temporal.Now` override covers the only member the app uses (`instant`) | Holds |
| (question c) | README vs `specs/reference/ui-screenshots/index.md` | Each screen maps to the reference index.md describes | Holds (05 and 10/11 pairings loose but defensible) |
| (question d) | `tools/ui-screenshots.ts:6-33` | Erasable TypeScript, `.ts` imports, no `src` internals | Holds |

**ocr review of T2.53-B1** (`ocr-review` step): commit `31e1cde`, session `ebc069d2-674a-4992-9f7e-53c1494a8961`, 1 file reviewed, 0 comments, plus two main-session questions. Raw output: `ocr/t2.53-b1-31e1cde.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| (question a) | `ui-alignment.spec.ts:809, 858, 1050, 1153` | The layout waits use a 640 px cutoff; the shell switches at `WIDE_LAYOUT_MIN_WIDTH = 960` | Doubtful (no effect at the widths measured); fixed in T2.53-B2 |
| (question b) | `TradeDetail.tsx:372-376` | `{' '}` keeps word boundaries between action, price and time in text and name | Holds |

**ocr review of T2.53-B2 and T2.54-B1** (`ocr-review` step): range `3fcb7e1^..0cd36c2`, session `aa0d16b6-9d4a-4bc9-a1a9-a22e2e683e4a`, 1 file reviewed, 0 comments, plus three main-session questions. Raw output: `ocr/t2.53-b2-t2.54-b1-3fcb7e1-0cd36c2.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| (question a) | `ui-alignment.spec.ts:1105` | The content-edge measurement subtracts the computed `padding-right`; a padding change cannot make it vacuous | Holds |
| (question b) | `tools/ui-screenshots.ts:116-222` | Every resource released exactly once on every path; drive body unchanged | Holds |
| (question c) | `tools/ui-screenshots.ts:199-200` | The script deletes the committed `evidence/D02/ui-alignment` before capturing, so a failed run leaves it deleted or partial | Valid; T2.54-B2 |

**Complete cumulative run after T2.54-B1** (`suite-runner`, 2026-10-25 10:14 EDT, on `0cd36c2`, covering T2.53, T2.53-B1, T2.53-B2, T2.54 and T2.54-B1): Unit 41 files / 435 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 88 passed (2.6m); static and verify checks 11 of 11 exit 0; then `npm run ui:screenshots` exit 0, 34 PNGs plus the README (re-renders reverted). Failures: none. Outputs: `suite-runs/t2.54-b1-*.txt`.

**T2.54-B2** (`a7e3488`, `tools/ui-screenshots.ts`): captures into a temporary sibling directory and replaces `evidence/D02/ui-alignment` only after the 34-PNG and README checks pass. Forced failure after the 5th capture: exit 1, `git status --short evidence/D02/ui-alignment` empty, no capture directory left, port 5175 free.

**ocr review of T2.54-B2** (`ocr-review` step): commit `a7e3488`, session `a3121cbf-7b18-4110-95b0-450804a81e5b`, 1 file reviewed, 0 comments, plus three main-session questions. Raw output: `ocr/t2.54-b2-a7e3488.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| (question a) | `tools/ui-screenshots.ts:225-230` | `rmSync(OUT)` before `renameSync`: a rename failure loses both copies | Valid; T2.54-B3 |
| (question b) | `tools/ui-screenshots.ts:204-219` | Release order context, profile directory, server kept | Holds |
| (question c) | `.gitignore`, `tools/ui-screenshots.ts:202` | After a hard kill the capture directory sits untracked and unignored in `evidence/D02` | Valid; T2.54-B3 (capture under the ignored `test-results/`) |

**Complete cumulative run after T2.54-B2** (`suite-runner`, 2026-10-25 10:19 EDT, on `a7e3488`): Unit 41 files / 435 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 88 passed (2.6m); static and verify checks 11 of 11 exit 0; `npm run ui:screenshots` exit 0, 34 PNGs plus the README (re-renders reverted, no capture directory left). Failures: none. Outputs: `suite-runs/t2.54-b2-*.txt`.

**T2.54-B3** (`9976d88`, `tools/ui-screenshots.ts`): the capture directory moves to the git-ignored `test-results/`, and `swapIn()` renames OUT to a backup, the capture to OUT, then removes the backup, restoring the backup if the second rename fails. Forced drive failure and forced swap failure both left `git status --short evidence/D02/ui-alignment` empty and port 5175 free.

**ocr review of T2.54-B3** (`ocr-review` step): commit `9976d88`, session `3ac59c86-1b4a-4eb0-996b-3a65d206fe6d`, 1 file reviewed, 0 comments, plus three main-session questions. Raw output: `ocr/t2.54-b3-9976d88.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| (question b) | `tools/ui-screenshots.ts:239-241` | A stale same-pid backup makes step 1 fail | Valid (nothing lost); T2.54-B4 |
| (question a) | `tools/ui-screenshots.ts:246-247` | A failed restore prints no path | Valid (nothing lost; OUT is in git); T2.54-B4 |
| (question a) | `tools/ui-screenshots.ts:250` | A failed step 3 prints no backup path | Valid, minor; T2.54-B4 |
| (question c) | `tools/ui-screenshots.ts:205-221` | Release order kept | Holds |

Main-session decision: the third round of swap hardening showed the backup itself was the source of the edge cases. T2.54-B4 removes it: copy the checked capture in, with git as the backup and the recovery command printed on failure. Further hardening of this tool stops there, since any remaining failure is recoverable from git.

**Complete cumulative run after T2.54-B3** (`suite-runner`, 2026-10-25 10:24 EDT, on `9976d88`): Unit 41 files / 435 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 88 passed (2.6m); static and verify checks 11 of 11 exit 0; `npm run ui:screenshots` exit 0, 34 PNGs plus the README (re-renders reverted, no capture directory left). Failures: none. Outputs: `suite-runs/t2.54-b3-*.txt`.

**T2.54-B4** (`98471b1`, `tools/ui-screenshots.ts`, 15 insertions, 16 deletions): `swapIn()` and its backup are replaced by `copyIn()`: copy the checked capture over `evidence/D02/ui-alignment`, sweep stale files, remove the capture; on a copy failure, print the capture path and `git checkout evidence/D02/ui-alignment`, keep the capture, rethrow. Forced drive failure: exit 1, status clean, no capture left, port free. Forced copy failure after 5 files: exit 1, the message printed, capture kept (the 5 copied files happened to equal the committed ones, so this run did not exercise a dirty restore).

**ocr review of T2.54-B4** (`ocr-review` step): commit `98471b1`, session `1753e2a0-e78b-40c6-a4f1-6c4c69cb1b3b`, 1 file reviewed, 0 comments, plus three main-session questions, all holding: no committed file is deleted before its replacement is in place (only the post-copy sweep at line 243 deletes in OUT); the sweep reads only OUT's direct entries; release order kept. Raw output: `ocr/t2.54-b4-98471b1.json`.

**Complete cumulative run after T2.54-B4** (`suite-runner`, 2026-10-25 10:29 EDT, on `98471b1`): Unit 41 files / 435 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 88 passed (2.7m); static and verify checks 11 of 11 exit 0; `npm run ui:screenshots` exit 0, 34 PNGs plus the README (re-renders reverted, no capture directory left). Failures: none. Outputs: `suite-runs/t2.54-b4-*.txt`.


**critic-5 cost note:** critic-5 stopped at the session usage limit during C2.10 and was resumed with SendMessage. The failed segment's notice carried no usage figures, so the row holds only the resumed segment's figures; the whole run cost more.

### T2.55-B1 Planned Detail Trade Summary (critic-5 D1)

- **Cause:** `getTradeDetail` already attaches `summary` to a Planned Detail. The Detail the user lands on after "Confirm Plan" is not read back: `confirmedDetail()` (`src/ui/screens/confirmed-detail.ts`) builds the `PlannedTradeDetail` from the command's post-commit result and never set `summary`. T2.49's unit fixture (`plannedDetail`) carried `summary`, so it passed; the browser run reached the Detail through the confirm path and saw none. A reload reads the real view and does show it.
- **Fix:** `confirmedDetail` sets `summary` the way `plannedSummary` does (Stock, Long, total planned quantity, first leg's intended entry), using `parseDecimal` and `Rational` from `domain/values`. No view type changed (`PlannedTradeDetail.summary` already optional).
- **Tests:** `confirmed-detail.test.ts` (unit, at the level that failed) and a browser case in `e2e/d2/ui-alignment.spec.ts` (confirm, then check the card leads with the text; reload, same).

### T2.55-B2 capped Detail label/value rows (critic-5 D2)

- **Cause:** T2.53 capped only Plan Baseline and Entry Quality (`dl.figure-grid`). The summary, Plan and Position cards, the Fulfillment list, the expanded Execution rows and the Journal item lists were plain `dl` grids, whose rows span the card (886 px at 1280). The summary's Entry value (`dd` without `.number`) was left-aligned in the wide value column while the `.number` values were right-aligned.
- **Fix:** `TradeDetail.tsx` renders the summary, Plan and Position cards through the existing `Figure` component in `dl.figure-grid` (Figure gained an optional `tone` for the Stop and Target classes); `app.css` makes the summary card a single 480 px column at every width so its values share a right edge, and caps the remaining plain `dl` in `.trade-detail` at 480 px (grid unchanged, so the narrow stacking of expanded Execution rows is as before). Prose answers (`dl.answers`) are not label/value rows and keep their width. At narrow widths the summary, Plan and Position rows now wrap into flex rows like Plan Baseline's.
- **Test:** `T2.55-B2` in `e2e/d2/ui-alignment.spec.ts` measures every `dl` row in Planned and Open Details (also with an Execution expanded) at 1280.

### T2.55-B3 Last activity on the Open Detail (critic-5 D3)

- **Cause:** T2.40 removed the Last activity column from the Open list on the promise that "the Detail shows it" (section 2a), but `OpenTradeDetail` never carried the value and no component rendered it.
- **Fix:** public view type `OpenTradeDetail` gains `readonly lastActivity: string`, set in `getTradeDetail` from the Trade Record summary exactly as Open list items set it (`lastActivity ?? planTime`). The Position card shows it as a labelled "Last activity" row formatted with `localTime`. Not added to the Planned or incoherent Detail.
- **Tests:** `open-views.test.ts` (Detail equals the list item), `TradeDetail.test.tsx` (labelled local time), a browser case in `ui-alignment.spec.ts`.

### T2.55-B4 narrow Net cost on an incoherent Open row (critic-5 D4)

- **Cause:** `TradeList` built the Trade cell's second line only for a row with a Net cost value (`derived && netCost.kind === 'Value'`). An incoherent row has no `netCost`, so at narrow, where the Net cost column is hidden, the figure's "Not available" appeared nowhere.
- **Fix:** the Open row's second line is always `Net cost <figure or Not available>`; wide still hides the line and shows the cell. This also gives a coherent row with no open quantity the same line. The Planned table has the same shape for 1R and Reward : risk on an incoherent Planned row (not in this defect; not changed).
- **Tests:** a `TradeList` unit case; `T2.55-B4` at 1280, 390 and 320 in `ui-alignment.spec.ts` (fixture `UnknownPlannedLeg` on an Open Trade): the narrow tree has "Net cost Not available" exactly once. The existing disagreeing-row unit assertion now expects the added line.

### T2.55-B5 price issues on the field that fails (critic-5 D5)

- **Cause:** the domain's `assessPlan` returns `InvalidPrice` once, as `{ code }` with no field (the workflow adds only `source`), and the UI's `ANALYSIS` table mapped it to `entry` always. The domain still has no per-field path; it was not changed (the brief said to stop before changing domain types, and the UI already holds the submitted prices and the domain's rule via `positiveDecimal`).
- **Fix:** `describeIssues` takes the submitted prices and expands `InvalidPrice` into one issue per price that fails `positiveDecimal` (entry, Stop, Target; the entry when none fails locally), each with its own message ("Enter a Stop price greater than zero, with at most 6 decimal places."). `PlanForm.corrected` clears each as its own field becomes valid (the special all-three rule is gone), so U4 and the summary are kept. Public view and domain types are unchanged.
- **Tests:** three `PlanForm` unit cases (blank Stop, blank Target, several failing with per-field clearing) and `T2.55-B5` in `ui-alignment.spec.ts`.

**Screenshots after T2.55-B1 to B5** (`npm run ui:screenshots`, after the e2e run): committed with B5: 05-new-plan-errors (390, 1280: the empty submission now marks Stop and Target and Intended entry each with its own message), 07-detail-planned (390, 1280: summary text, capped rows), 14-detail-open (390, 1280: capped rows, Last activity), 15-journal (390, 1280: label/value lists capped at 480 px). Reverted as pixel noise: 04-new-plan-1280, 17-about-390 and 17-about-1280 (the release hash differs only).

**ocr review of T2.55-B1 to B5** (`ocr-review` step): range `ffd6249^..1e1e793`, session `27c4a78c-e0a6-49e5-801b-173c99e9e7e8`, 8 files reviewed (PNGs excluded), 0 comments, plus five main-session questions. Raw output: `ocr/t2.55-b1-b5-ffd6249-1e1e793.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| (question a) | `confirmed-detail.ts:5-9, 33-39` vs `trade-views.ts:219-226, 256-260` | `confirmedDetail` repeats `plannedSummary`'s derivation and the `decimal()` helper | Valid as duplication (no disagreement today: same `parseDecimal`, exact `Rational`). Deferred to the user in the final report: a single source means either `confirmPlan`'s result carrying the summary (facade change) or a shared pure helper, a design choice |
| (question b) | `PlanForm.tsx:140`, `form-issues.tsx:61-64` vs `plan.ts:66-69, 140` | The UI's failing-price check can disagree with the domain's | Holds (same `parseDecimal(…, {positive: true})` on trimmed text) |
| (question c) | `app.css:846-848`, `TradeDetail.tsx:567, 582` | The 480 px cap misaligns Journal columns | Dismissed: the meta and answers lists never shared a left edge (pre-existing); the cap is what T2.53 requires and changes nothing below 480 px |
| (question d) | `TradeList.tsx:166, 169`, `app.css:511-532` | Narrow Net cost once in the accessibility tree per width, hidden at wide | Holds |
| (question e) | `trade-views.ts:288, 430`, `trade-record.ts:305-308` | `lastActivity` on the Detail matches the list; only Position Changes move it | Holds |

**Complete cumulative run after T2.55-B5** (`suite-runner`, 2026-10-25 22:04 EDT, on `1e1e793`): Unit 42 files / 441 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 96 passed (2.8m); static and verify checks 11 of 11 exit 0; `npm run ui:screenshots` exit 0, 34 PNGs (6 pixel-noise re-renders reverted). Failures: none. Outputs: `suite-runs/t2.55-b5-*.txt`.

## T2.55-B6 narrow 1R and Reward : risk on incoherent Planned rows

Critic-5 D4's class, for Planned rows: `TradeList.tsx` PlannedList's Trade cell second line was skipped when the row had no derived values. It is now always `1R <value or Not available> · Reward : risk <value or Not available>`, matching the wide cells (both read Not available) and B4's phrasing.

| Command | Result |
| --- | --- |
| `.claude/scripts/tdd.sh red/green T2.55-B6 src/ui/screens/TradeList.test.tsx "should carry 1R and Reward : risk of an incoherent Planned row, Not available, in the second line of its Trade cell"` | red then green |
| `npx playwright test e2e/d2/ui-alignment.spec.ts -g "T2.55-B6"` (fixture: StoredLifecycle Planned plus UnknownPlannedLeg on an entered Trade, since the fixture tool needs an Execution) | before the fix 390 and 320 failed, 1280 passed; after, 3 passed. Each figure once in the accessibility tree at 390 and 320; no second line at 1280 |
| `npx vitest run src` | 42 files, 442 tests passed |
| `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps` | all exit 0 |
| `npm run build:faults && npx playwright test e2e/d1 e2e/d2` | 99 passed (3.0m) |

**ocr review of T2.55-B6** (`ocr-review` step): commit `3f17a56`, session `66d82041-5d7d-450a-8063-b79d959c4a66`, 1 file reviewed, 0 comments, plus three main-session questions, all holding: each figure once in the accessibility tree per width, the line hidden at wide (`app.css:509-531`); 1R and Reward : risk are all-or-nothing in the view, so no mixed line occurs; the fixture is the one `integrity.spec.ts:66-67` uses. Raw output: `ocr/t2.55-b6-3f17a56.json`.

**Complete cumulative run after T2.55-B6** (`suite-runner`, 2026-10-25 22:18 EDT, on `3f17a56`): Unit 42 files / 442 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 99 passed (3.0m); static and verify checks 11 of 11 exit 0; `npm run ui:screenshots` exit 0, 34 PNGs (re-renders reverted). Failures: none. Outputs: `suite-runs/t2.55-b6-*.txt`.

## T2.60 storage warning as an icon that opens About (U8)

The full storage card moved to About (`src/ui/StorageProtectionCard.tsx`, used by `AboutView`). Every other screen with a shell shows one `WarningIcon` link to About, named "Storage not protected: see About", at the top right of the content column (`.storage-flag`, 44 px target, `--warning-line`). It disappears when protection is Protected or when the request on About succeeds (`RuntimeState.onStorageKept`).

**First run and onboarding decision:** About is not reachable there (`AppShell` renders them with no `Routes`, and no Workspace exists), so they keep the full card and show no icon. That card keeps its compact text; the extra backup sentence appears on About only, because the T2.37 height limit (120 px at 390) would fail with it.

**Test impact, with reasons:**
- `e2e/d2/ui-alignment.spec.ts`: the T2.37 shell-banner measurements (warning ground, height at most 120 at 390, button centre at 1280) were replaced by a T2.60 case at 320, 390 and 1280, because that banner no longer exists outside About (U8). The T2.37-B1 first-run and onboarding measurements stay, since the card is still there.
- `e2e/d1/readiness.spec.ts` (B1.7): finds the icon on Trades, goes to About for the warning and the "Ask the browser to keep data" button, and returns to About for the request. `e2e/d1/onboarding.spec.ts` is unchanged (card kept on those screens).
- `src/ui/AppShell.test.tsx`: the "storage-protection warning" describe became "storage warning" with the four planned cases plus the first-run and onboarding case.

| Command | Result |
| --- | --- |
| `.claude/scripts/tdd.sh red/green T2.60 src/ui/AppShell.test.tsx ...` | cases 1 to 3 red then green; case 4 first-run pass with mutation (see tdd-log) |
| `npx playwright test e2e/d1/readiness.spec.ts e2e/d1/onboarding.spec.ts e2e/d2/ui-alignment.spec.ts -g "B1.7\|critic-2\|T2.37\|T2.60"` | 8 passed (icon visible, link to /about, name, 44 px target, full focus outline room, no card outside About, axe clean at 320, 390, 1280) |

**ocr review of T2.60** (`ocr-review` step): commit `05e1e8b`, session `24b40c49-9ed6-47fc-a9b6-fe0d2eb10066`, 6 files reviewed (PNGs and tests excluded), 3 comments, plus four main-session questions. Raw output: `ocr/t2.60-05e1e8b.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| ocr comment | `StorageProtectionCard.tsx:20` | The request outcome lives in the card; after a declined request, leaving About and returning drops the notice and offers the button again | Valid; T2.60-B1 |
| ocr comment | `AppShell.tsx:287, 291, 318` | A successful request during first run or onboarding is not passed to the shell, so the icon shows after onboarding | Valid; T2.60-B1 |
| ocr comment | `AboutView.tsx:32, 52` | After success, About's own `status` row still reads Best effort in the same visit | Valid (cosmetic); T2.60-B1 |
| (question a) | `AppShell.tsx:118, 331` | A success survives navigation; the icon never reappears | Holds |
| (question b) | `AppShell.tsx:316-318`, `routes.ts:72-79` | Icon and card conditions per launch state, Recovery Only included | Holds, except the onboarding case above |
| (question c) | `AboutView.tsx:52`, `AppShell.tsx:274, 287` | Backup recommendation on About only; first run and onboarding lack it | Confirmed; the gap predates the commit (narrowed by it); raised with the user |
| (question d) | `icons.tsx:5-21`, `app.css` | Exact name, `aria-hidden` SVG, 44 px target, distinct glyph | Holds (code reading) |

**Complete cumulative run after T2.60** (`suite-runner`, 2026-10-25 22:56 EDT, on `05e1e8b`): Unit 42 files / 444 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 100 passed (3.1m); static and verify checks 11 of 11 exit 0; `npm run ui:screenshots` exit 0, 34 PNGs (re-renders reverted). Failures: none. Outputs: `suite-runs/t2.60-*.txt`.

### T2.60-B1 Keep the storage request outcome in the shell

Fixes the three Valid ocr findings on 05e1e8b. The outcome of `Workspace.requestDurability` is held once in `AppShell` and exposed as `RuntimeState.durability` and `RuntimeState.requestDurability`; every `StorageProtectionCard` reads it and requests through that function. The icon and About's Storage protection row derive from it. `onStorageKept` and `onKept` are removed.

- `src/ui/AppShell.test.tsx`: three cases added to "storage warning" (decline survives leaving About; no icon after a first-run success; the About row reads Protected after success).
- Also, on the coordinator's instruction citing decision 2 of `plan/implementation-plan.md` (the warning offers the durability request but does not recommend a backup until D8): removed "Back up your journal as soon as this release offers backup" and the `recommendBackup` prop; new case "should not recommend a backup in the storage card on About" (red then green); the T2.60 About-card case no longer asserts the sentence.

**ocr review of T2.60-B1** (`ocr-review` step): commit `43f7359`, session `34e1d2d7-f2e7-491a-a054-c61b8abc11e9`, 4 files reviewed, 0 comments, plus four main-session questions. Raw output: `ocr/t2.60-b1-43f7359.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| (question a) | `AppShell.tsx:121-123`, `StorageProtectionCard.tsx:36-43` | No in-flight guard: a double click, or first run then About, runs two requests and the later result overwrites the earlier | Valid (minor); T2.60-B2 |
| (question b) | `AppShell.tsx:121, 277-297, 328`, `AboutView.tsx:29-69` | Icon, cards and About's row all derive from the one shell outcome | Holds |
| (question c) | `src/ui` outside tests | No backup recommendation left; the Recovery Only text only explains backup is not offered yet | Holds |
| (question d) | `AppShell.tsx:121, 301-303` | The outcome survives onboarding → shell | Holds |

**Complete cumulative run after T2.60-B1** (`suite-runner`, 2026-10-25 23:15 EDT, on `43f7359`): Unit 42 files / 448 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 100 passed (3.1m); static and verify checks 11 of 11 exit 0; `npm run ui:screenshots` exit 0, 34 PNGs (re-renders reverted). Failures: none. Outputs: `suite-runs/t2.60-b1-*.txt`.

**T2.60-B2** (bug fix for the T2.60-B1 review finding, no in-flight guard): `AppShell` runs at most one `Workspace.requestDurability` at a time (a ref guard plus a `requesting` state); `RuntimeState.requestingDurability` and the card's `requesting` prop disable the "Ask the browser to keep data" button (the `disabled` attribute) while it is pending. Three cases added to "storage warning" in `src/ui/AppShell.test.tsx` (one facade call for two clicks; button disabled while pending; a second call in the same tick is ignored so a later NotImproved cannot replace a granted result). No first-run passes.

**ocr review of T2.60-B2** (`ocr-review` step): commit `7bc2dd3`, session `5e38f85b-583d-4051-930b-4c72e983fff2`, 4 files reviewed, 0 comments, plus three main-session questions. Raw output: `ocr/t2.60-b2-7bc2dd3.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| (question a) | `AppShell.tsx:126-138` | On rejection the guard clears, but `.finally` re-propagates and nothing catches: an unhandled rejection | Valid; T2.60-B3 |
| (question b) | `AppShell.tsx:123-125, 291-359`, `AboutView.tsx:29, 54` | One ref, state and callback shared by first run, onboarding and About | Holds |
| (question c) | `StorageProtectionCard.tsx:42` | Native `disabled` is exposed to assistive technology | Holds |
| (question c) | `StorageProtectionCard.tsx:31-47` | A focused button that becomes disabled, then unmounts, drops keyboard focus to the body; the pending period is silent | Doubtful, taken as a defect (focus loss); T2.60-B3 |

**Complete cumulative run after T2.60-B2** (`suite-runner`, 2026-10-25 23:28 EDT, on `7bc2dd3`): Unit 42 files / 451 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 100 passed (3.0m); static and verify checks 11 of 11 exit 0; `npm run ui:screenshots` exit 0, 34 PNGs (4 re-renders reverted). Failures: none. Outputs: `suite-runs/t2.60-b2-*.txt`.

**T2.60-B3** (bug fix for the T2.60-B2 review findings: unhandled rejection, focus loss): `AppShell` catches a rejected `Workspace.requestDurability` (a `requestFailed` state, cleared on the next request) and the card shows the status "The browser didn't answer. You can try again." with the button usable again. The pending button uses `aria-disabled="true"` instead of `disabled`, so it keeps focus (the ref guard still ignores repeat presses); when the result arrives the card moves focus to its result status (`role="status"`, `tabIndex={-1}`). Three cases added to "storage warning" in `src/ui/AppShell.test.tsx` (rejection; focus kept while pending with one facade call; focus on the result status) and the B2 "disabled while pending" assertion changed to `aria-disabled`. No first-run passes.

**ocr review of T2.60-B3: not completed.** Commit `baa0419`. Three ocr runs (sessions `5b43ff94-2cf5-4bf8-82c3-e498cf74be8e`, `46c3b795-75ac-41c0-b255-bfa199555039`, `3ce42c32-537c-42d6-b668-b3351d0488b3`) failed on every file with the provider error `subscription_sharing_usage_limit_exceeded` (the ChatGPT account's usage limit). `ocr/t2.60-b3-baa0419.json` holds the first failed run (`comments: null`). In its place the `ocr-review` agent read the diff against three main-session questions, all holding: the rejection is caught and a successful retry clears the failure line (`AppShell.tsx:126-139`, `StorageProtectionCard.tsx:47`); Enter or Space while `aria-disabled` stops at the ref guard and keeps focus; the focus move fires only when `durability` changes after mount, never on remount or on another screen (`StorageProtectionCard.tsx:21-25`). Two Doubtful polish notes, not taken: a focus move if a request pending across first run → onboarding resolves while typing; the failure line takes no focus (focus stays on the retry button). On 2026-10-26 the user accepted this hand review in place of the ocr run; the ocr step for `baa0419` is recorded as skipped.

**Complete cumulative run after T2.60-B3** (`suite-runner`, 2026-10-25 23:37 EDT, on `baa0419`): Unit 42 files / 454 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 100 passed (2.9m); static and verify checks 11 of 11 exit 0; `npm run ui:screenshots` exit 0, 34 PNGs (re-renders reverted). Failures: none. Outputs: `suite-runs/t2.60-b3-*.txt`.

**T2.60-B4** (storage icon at the far right of the page title): the icon moved from a row of its own in `AppShell` onto each page title's row. A new `src/ui/PageTitle.tsx` wraps the page `h1` in a `.title-row` flex row and renders the icon link after it; the shell keeps the only copy of the conditions and passes the link target to it as `RuntimeState.storageIconTo` (present only while the icon shows). Every screen h1 (Trades, Detail and its not-found, New Plan, Record entry and its states, the receipt, Accounts, About, Record entry unavailable) uses `PageTitle`; first run and onboarding keep their card and plain `h1`. The icon stays a 44 px target, with negative block margins so the row keeps the `h1`'s height and the title never moves when the icon shows or hides; the `h1` has `min-width: 0` and `overflow-wrap: anywhere`, so a long title wraps instead of running under the icon. The back link stays above the row. Measurements: `e2e/d2/ui-alignment.spec.ts` "T2.60-B4 storage icon on the page title row" (Trades, Detail, New Plan, About at 320, 390, 1280; Protected simulated by an init script setting `navigator.storage.persisted` true), red on the old build (3 failed), green after (see `tdd-log.md`). Checks: `npx vitest run src` 454 passed; typecheck, `npx tsc6 --noEmit`, lint, lint:deps exit 0; `npm run build:faults && npx playwright test e2e/d1 e2e/d2` 103 passed; `npm run ui:screenshots` 28 of 34 PNGs re-rendered with the title moved up (every shell screen).

**ocr review of T2.60-B4** (`ocr-review` step): commit `d6b570d`, session `ba7fb4a8-0091-4b02-8a81-410740ce3ae9`, 0 comments, plus three main-session questions. Raw output: `ocr/t2.60-b4-d6b570d.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| (question a) | `PageTitle.tsx`, `PositionChangeForm.tsx`, `PositionChangeReceipt.tsx` | No `ref`, `tabIndex` or `id` lost in the h1 swap (Record entry keeps `ref={headingRef} tabIndex={-1}`; the receipt keeps `id="receipt-heading"`) | Holds |
| (question b) | `src/ui` outside tests | The only raw `h1`s left are first run, onboarding, the pre-shell blocked and conversion screens, and `PageTitle` itself | Holds |
| (question c) | `AppShell.tsx:349, 367` | The icon condition lives only in the shell | Holds |

**Complete cumulative run after T2.60-B4** (`suite-runner`, 2026-10-26 02:53 EDT, on `d6b570d`): Unit 42 files / 454 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 103 passed (3.2m); static and verify checks 11 of 11 exit 0; `npm run ui:screenshots` exit 0, 34 PNGs (re-renders reverted). Failures: none. Outputs: `suite-runs/t2.60-b4-*.txt`.

### T2.61 Thousands separators on every money amount (U9a)

**T2.61** (`c7e2520`): `money` in `src/ui/format.ts` groups thousands with commas on the decimal string (no float), keeping "−$" for negatives; `decimalMoney`, `tradeSummary` and `netCost` all go through it, and `netCost` keeps its "<magnitude> credit" rule without its own grouping code. Five cases in `src/ui/format.test.ts`; case 1 red then green; **cases 2–5 first-run passes** (built by case 1's change), each confirmed by a mutation check (assertion failures recorded as `note` rows in `tdd-log.md`). Case 5 was renamed to avoid "$" in the `-t` filter and tests the formatters behind the Trade text, Executions and receipt rather than rendering them. No existing assertion needed updating. One PNG changed (`14-detail-open-1280.png`).

**ocr review of T2.61** (`ocr-review` step): commit `c7e2520`, session `0bef4d71-8def-4d37-8b94-34a9c4f1c676`, 1 file reviewed, 0 comments, plus three main-session questions. Raw output: `ocr/t2.61-c7e2520.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| (question a) | `src/ui` outside tests | Every money amount goes through `money`; no other currency formatting (the only `toFixed` is About's GB sizes) | Holds |
| (question b) | `format.ts` | Grouping works on the decimal string; correct for 4+ digits, millions, zero, sub-dollar, negatives, and a round-up to $1,000.00 | Holds |
| (question c) | `format.ts` `netCost` | The credit rule is unchanged | Holds |

**Complete cumulative run after T2.61** (`suite-runner`, 2026-10-26 04:26 EDT, on `c7e2520`): Unit 42 files / 459 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 103 passed (3.1m); static and verify checks 11 of 11 exit 0; `npm run ui:screenshots` wrote 34 PNGs (re-renders reverted). Failures: none. Outputs: `suite-runs/t2.61-*.txt`.

### T2.62 Narrow line breaks (U9b–d)

**T2.62** (`4b2b448`): the narrow Underlying header no longer breaks inside the word (`word-break: keep-all`, `--pin` 5rem → 6.5rem at narrow); a private `TradeText` keeps "@ price" together in a `nowrap` span; Execution rows on the Detail and the receipt read as one phrase (`.execution-what` then `.execution-price` "@ $50.00", and on the receipt ", fee $0.50" kept together). Measurements in `e2e/d2/ui-alignment.spec.ts` "T2.62 line breaks" (5 tests), red then green. **First-run passes, flagged:** the 1280 header variant (mutation: header `white-space: normal` plus `word-break: break-all` at wide, failed); the Trade-cell "@" check at 320 and 390 was masked by the header assertion failing first (mutation: drop the nowrap span, failed). The receipt red's failure text was not captured. U9(d) replaced T2.53's right-aligned Execution money: the Detail case keeps only the tint assertion, and the receipt case drops its right-alignment assertions. One unit assertion in `TradeList.test.tsx` now checks the `nowrap` span; textContent assertions are unchanged. Six PNGs re-rendered.

**ocr review of T2.62** (`ocr-review` step): commit `4b2b448`, session `70d1c309-bcc6-47c6-aa37-61f6f22b2cdc`, 4 files reviewed, 1 comment, plus three main-session questions. Raw output: `ocr/t2.62-4b2b448.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| ocr 1 (medium) | `src/ui/app.css:422, 482` | `--pin` 6.5rem plus the Trade column's `min-width: 12.5rem` is 304 px, wider than the 288 px scroll region at 320, so the Trade cell's right edge (or a badge) is clipped by about 6 px before scrolling; the T2.40 checks compare against the window, not the region, so they miss it | Valid; T2.62-B1 |
| (question a) | `TradeDetail.tsx`, `PositionChangeReceipt.tsx`, `TradeList.tsx` | Accessible names and text unchanged, no lost or doubled spaces | Holds |
| (question b) | `app.css` `th:first-child` | With `keep-all`, "UNDERLYING" (about 90 px) may be wider than the cell's about 85 px text area and spill into the Trade column; the height check cannot see it | Doubtful, taken as a defect; T2.62-B1 |
| (question c) | `e2e/d2/ui-alignment.spec.ts`, `TradeList.test.tsx` | Only the intended T2.53 right-alignment assertions were dropped; the unit change is covered by textContent | Holds |

**T2.62-B1** (bug fix for the T2.62 review findings): at 320 and 390, on "Open Trades" and "Planned Trades", before scrolling:
- it should keep the Underlying and Trade cells, including the second line and any badge, inside the scroll region's client box (not just the window);
- it should keep the "UNDERLYING" header inside its own cell (`scrollWidth ≤ clientWidth`, and its right edge ≤ the Trade header's left edge), on one line.

**T2.62-B1** (`1172327`, bug fix for the T2.62 review findings): the narrow Trade column's `min-width` goes from 12.5rem to 11.5rem, so the 6.5rem pin plus the Trade column is 288 px, the scroll region's width at 320. Six measurements added to "T2.62 line breaks" at 320 and 390: Underlying and Trade cells (second line included) inside the scroll region's client box, red at 320 (`Expected <= 304.5, Received 320`), green after; a "Records disagree" badge (Planned ABC fixture) inside the region, red at 320, green after; the "UNDERLYING" header inside its own cell on one line, **a first-run pass, flagged** (mutation: `letter-spacing: 0.3em; font-size: 1.3rem` on the header, failed with `scrollWidth Expected <= 104, Received 201`). So the T2.62 question (b) concern did not hold: the header already fit. The 390 variants pass on the old build as well (room to spare). Two PNGs re-rendered (`08-trades-planned-390`, `13-trades-open-390`).

**ocr review of T2.62-B1** (`ocr-review` step): commit `1172327`, session `7ba1469a-e775-41af-8a32-e1a620ddf219`, 1 file reviewed, 0 comments, plus two main-session questions. Raw output: `ocr/t2.62-b1-1172327.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| (question a) | `app.css` | At 320 the Trade cell's content (wrapping text, nowrap "@ $1,234.56", "$1,234,567.00", the "Records disagree" badge at about 145 px of about 165 px) fits its cell | Holds |
| (question b) | `e2e/d2/ui-alignment.spec.ts` | The tests measure the scroll region's client box and fail at 320 if the pin or Trade min-width grows | Holds |

**Complete cumulative run after T2.62-B1** (`suite-runner`, 2026-10-26 04:50 EDT, on `1172327`): Unit 42 files / 459 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 114 passed (3.4m); static and verify checks 11 of 11 exit 0; `npm run ui:screenshots` wrote 34 PNGs (re-renders reverted). Failures: none. Outputs: `suite-runs/t2.62-b1-*.txt`.

### T2.63 Record entry context and R lines (U9e–f)

**T2.63** (`2a7a6de`): Record entry's context card no longer renders "Not entered yet" (the paragraph is absent until something is entered; "60 of 100 shares entered" unchanged). A new `WithSecondLine({ amount, second })` (`src/ui/SecondLine.tsx`, `.second-line { display: block; color: var(--muted) }`) puts the R multiple and the planned comparison on their own line below the amount, without brackets, on the receipt and in the Detail's Entry Quality (Actual initial risk, Reward : risk). Unit cases in `PositionChangeForm.test.tsx` and `TradeDetail.test.tsx`; e2e "T2.63 R lines" at 320 and 1280. Updated assertions: the receipt and Detail Entry Quality values, the Not applicable case, and `offline.spec.ts` / `open-position.spec.ts` (`$270.00 1.08R`, `2.15 planned 2.4`). **Flagged:** the "60 of 100 shares entered" case was a first-run pass (built by T2.52; mutation "shares entered!" failed); **code ahead of red:** the shared R-line code was written right after the first red, and the later R-line reds (and the e2e red) were obtained by temporarily reverting to the bracketed text or mutating CSS, as logged in `tdd-log.md`. Six PNGs re-rendered; `07-detail-planned-1280.png`, committed by the task, differed only in capture height and was restored to its previous version by the main session.

**ocr review of T2.63** (`ocr-review` step): commit `2a7a6de`, session `572478d9-28a3-4f32-867c-ccf95b7e8c80`, 5 files reviewed, 0 comments, plus four main-session questions. Raw output: `ocr/t2.63-2a7a6de.json`.

| Item | Location | Claim checked | Verdict |
| --- | --- | --- | --- |
| (question a) | `src/ui` outside tests | Every bracketed R multiple or planned comparison now goes through `WithSecondLine`; none left | Holds |
| (question b) | `SecondLine.tsx`, `TradeDetail.tsx` | Accessible text reads amount, one space, second line; the Not applicable path is correct (a planned ratio that is itself Not applicable would read "planned Not applicable…", wording only) | Holds |
| (question c) | `PositionChangeForm.tsx` | No empty element or gap when nothing is entered | Holds |
| (question d) | `app.css` | The second line stays right-aligned under the amount; rows stay within 480 px | Holds |

**Complete cumulative run after T2.63** (`suite-runner`, 2026-10-26 05:03 EDT, on `2a7a6de`): Unit 42 files / 466 tests passed; Node integration 21 / 49 passed; Browser (Chromium) 115 passed (3.5m); static and verify checks 11 of 11 exit 0; `npm run ui:screenshots` wrote 34 PNGs (re-renders reverted). Failures: none. Outputs: `suite-runs/t2.63-*.txt`.
