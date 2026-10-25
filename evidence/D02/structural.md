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

Reading: no measurable saving from brief v2 in this sample. critic-3 sits between critic-1 and critic-2 on tokens and above both on tool calls and time; it also did more beyond the flows (axe at 1280 and 320, a B2.10 mid-form fault, narrow checks of six screens). With one sample per brief and a 14% spread between the two v1 runs, the difference is within noise.

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

**ocr review of T2.28** (`ocr-review` step): commit `d623a46`, session `014024a0-94e2-4f0d-af23-43c35d5415f9`, model `gpt-6.1-sol`, 0 of 1 files reviewed, no comments: the provider refused the call with `subscription_sharing_usage_limit_exceeded`. **Pending:** at the user's direction (2026-10-24), T2.29 proceeds, and T2.28 and T2.29 are both reviewed once the usage limit resets (9:55 pm).

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

**ocr review of T2.29:** pending with T2.28's, until the ocr provider's usage limit resets (user's direction 2026-10-24).

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
