# D2 — recorded evidence

This file is the retained execution record for D2's task-level evidence, in the format required by
`plan/deliverable-breakdowns/D2-confirm-first-plan.md` §6 and
`plan/kickoff-prompt-d2-2026-10-19.md` §7. It is append-only. D1's evidence file is untouched.

## Provenance

| | |
|---|---|
| Branch | `deepseek-v41-flash` |
| Worktree | `/Users/ckolbegger/src/trade-journal-v3/worktrees/deepseek-v41-flash` |
| Node | `v26.12.0` (`process.versions.node` = `26.12.0`, inside `^26.12.0`) |
| npm | `11.20.0`, npx `11.20.0` (both from the Homebrew Node keg) |
| OS | macOS 26.6.2, build 25G83, arm64 |
| Browsers | Chromium 156.0.8078.4 / Playwright build 1248; WebKit 27.2 / Playwright build 2370 |
| Loopback origin | `http://127.0.0.1:5177` from `DEV_PORT` in `.env.local` |
| Tip at confirmation | `0777ac3` (= `origin/deepseek-v41-flash`) |
| D1 milestone tags | `deepseek-v41-flash-D1` → `ea4fd85`; `deepseek-v41-flash-D1-refactor` → `fdc5d9c` |

Both D1 tags are **annotated**, so `git rev-parse --short <tag>` prints the tag object SHA
(`24155ae`, `49986bb`), not the commit. Dereferenced with `<tag>^{commit}` they are exactly the
commits the handoff names. That is a reading of the handoff's shorthand command, not a moved tag.

`DEV_PORT` provenance: the npm cache lives outside the worktree
(`npm_config_cache=/tmp/tj-npm-cache`) because the harness sandbox does not permit writes to `~/.npm`.
That is an execution-environment accommodation only; no recorded command depends on it.

---

## Wave-2 confirmation (before T1)

Freeze record §12 requires the fifteen §7 seams to be compared against what they actually export,
erratum E-001 to be applied, and the result recorded here.

### 1. The fifteen §7 seams, checked by export at `0777ac3`

| D1 task | Seam | Exported shape observed | Result |
|---|---|---|---|
| T1 | Toolchain and shell | `package.json` declares `typecheck`, `lint`, `lint:layers`, `test:unit`, `test:integration`, `test:browser`, `build`, `dev`, `preview`; `@typescript/native` → `typescript@7.0.2` and `typescript` → `@typescript/typescript6@6.0.2`; `playwright.config.ts` reads `DEV_PORT` from `.env.local` | match |
| T3 | Test harness | `vitest.config.ts` projects `unit` + `integration`; `playwright.config.ts` projects `chromium`, `webkit`, `narrow` (375×812), `wide` (1440×900); `tests/substitutions.md` registers every substitution | match |
| T5 | Session calendar | `src/calendar/index.ts` exports `resolveSessionDate`, `TradingDate`, `SessionDateResult`, `CalendarOutOfRange` over the injected `Clock` | match |
| T6 | Money/Price/Quantity | `src/values/index.ts` exports `money`, `price`, `quantity`, `addMoney`, `subtractMoney`, `positionValue` over `decimal.js`; no fee-apportionment helper | match |
| T7 | Browser-host port | `src/platform/host/index.ts` exports `HostPort`, `createBrowserHostPort`, and typed absence (`StorageProtection`, `CapacityEstimate`, `DurabilityRequest`, `SelectedFile`) | match |
| T9 | Schema baseline | `src/persistence/indexeddb/schema.ts` exports `SCHEMA_VERSION = 1`, `SCHEMA_MANIFEST`, `OpenDatabase`, `INDEX` declarations, `FactRevision`-shaped `LifecycleEntry` | match |
| T10 | Migration runner | `src/persistence/indexeddb/migration.ts` exports `migrate`, `MigrationPlan`, `MigrationOutcome`, `CANDIDATE_DATABASE_PREFIX`, isolated candidate + `writePointer` flip | match |
| T11 | Transaction seam | `src/persistence/indexeddb/transaction.ts` exports `createTransactionSeam`, `TransactionSeam.commit/snapshot/counters`, `ParticipantEffect`, commit and abort | match |
| T12 | Persistence-level rejection | `src/persistence/indexeddb/writeGate.ts` exports `createWriteGate`, `rejectionFor` → `RuntimeNotWritable`, `commitThroughGate` | match |
| T14 | Snapshot read | `src/persistence/indexeddb/snapshotRead.ts` exports `assembleRead`, `ReadSource`, `AssembledRead`, `ChangedDuringAssembly` | match |
| T15 | Lifecycle index | `src/persistence/indexeddb/lifecycleIndex.ts` exports `LifecycleEntry` (`tradeId`, `state`, `factRevision`), `commitLifecycleChange`, `checkLifecycleAgreement`; `lifecycleQuery.ts` exports `queryOpenLifecycle` with bounded cursor + counts | match |
| T22 | Journal seed | `src/journal/index.ts` exports `seedDefaults`, `planJournalSeed`; `seedManifest.ts` exports `SEED_MANIFEST_V1` carrying the Plan Reflection Entry Type and Plan Confirmation Source | match |
| T25 | Workspace initialize | `src/workspace/index.ts` exports `initialize`, `WorkspacePorts`, `OnboardingState` | match |
| T26 | Status vocabulary | `src/workspace/status.ts` exports `getStatus`, `WorkspaceStatus` including `RecoveryOnly` and `IntegrityBlocked` | match |
| T28 | Installed Capability Manifest | `src/capability/manifest.ts` exports `installedCapabilities`, `selfCheck`, `closureProblems`, `assertManifestRelease`; eight operations and navigation `["startup", "onboarding"]` | match |

**No seam moved.** Baseline suites at that commit: 190 Vitest tests in 29 files, 132 Playwright tests
across the four projects.

### 2. Erratum E-001 applied as E-010

`D1:T12` added where D2, D3, D6 and D7 describe the persistence-boundary rejection: D2's T1 V1.5 row
and T14 prose, D3's §0 write-gate row, D6's §0 atomic-commit row and atomic-commit task prose, D7's
§1 decision 5 and `Recovery Only` export task prose. No blocking edge, task count, graph edge or
scenario status changed.

| # | Command | Observed | Result |
|---|---|---|---|
| C1 | `node scripts/check-deliverable-breakdown.mjs plan/deliverable-breakdowns/*.md` | `0 failure(s), 0 warning(s) across 7 file(s)` | pass |
| C2 | `node scripts/audit-breakdown-coverage.mjs` | `0 failure(s), 0 warning(s)` | pass |
| C3 | `node scripts/derive-acceptance-ownership.mjs` | `67 scenarios: 32 claimed by D1–D7, 35 unclaimed, 2 with no owning deliverable.` | pass |
| C4 | `shasum -a 256 -c plan/freeze-manifest-2026-10-17.sha256` | 11 × `OK` after re-stamp | pass |
| C5 | `node --version && npm --version` | `v26.12.0`, `11.20.0` | pass |
| C6 | `shasum -a 256 -c plan/freeze-manifest-2026-10-17.sha256` (before E-001) | 11 × `OK` at the frozen digest set | pass |

### 3. Baseline suites at `0777ac3` (before any D2 change)

| # | Command | Observed | Result |
|---|---|---|---|
| B1 | `npx vitest run` | `Test Files 29 passed (29)`, `Tests 190 passed (190)` | pass |
| B2 | `npx playwright test` | `132 passed (1.9m)` | pass |

**Wave-2 confirmation recorded: all fifteen D1 seams match what D2–D7 assume; E-001 applied; the
frozen revision verifies. D2 may start.**

---

## T1 — `S` D2 durable schema and migration

Structural task: exact verification instead of invented unit tests.

_(recorded below as the task is executed)_

---

## Full-suite runs per source-changing commit

Standing rule: every commit that changes source or tests carries its own full `npx vitest run` and
`npx playwright test` record. Docs-only commits cite the most recent full run for the same code state.

_(appended per commit)_
