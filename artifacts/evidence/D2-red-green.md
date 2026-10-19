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

Structural task: exact verification instead of invented unit tests. The breakdown's illustrative
paths `src/persistence/migrations` and `src/persistence/seam` are read as the delivered harness
(`tests/integration/**`), per the kickoff's branch-local note 5.

**What landed.** `src/plan/index.ts` fixes the frozen Plan-fact shapes (the PD9 condition union with
`StructureValueCondition` reserved and not installed, Planned Legs, Strategy shape, Plan Baseline).
`src/persistence/indexeddb/schema.ts` adds `D2_SCHEMA_VERSION = SCHEMA_VERSION + 1` (never a literal),
`D2_STORES` (`tradeLifecycle` for the stored Lifecycle State record, `tradeVersion` for FactRevision
and RecordedSequence metadata) and `D2_SCHEMA_MANIFEST`, plus a manifest-aware
`openDatabaseWithStores`. `src/persistence/indexeddb/migration.ts` gains an optional `stores` plan
field. `src/persistence/indexeddb/d2Migration.ts` is the forward-only D2 migration and its gated
entry point `migrateD2`. The Journal definition revision lives in the existing `journal` store and
the Catalog manifest v2 marker in `workspaceMeta`, so neither needs a new store.

**One real defect found and fixed.** D1's `migrate` ran `discardStaleCandidates()` before checking
whether it was already at the target, and that sweep deleted every candidate-prefixed database —
including the *active* one. A second migration run therefore destroyed the live Workspace. Fixed by
returning the unchanged-version result before the sweep and by making the sweep skip the active
database. This is a defect in D1's delivered implementation surfaced by D2's verification, not a
seam-shape change.

| # | Command | Observed | Result |
|---|---|---|---|
| V1.1 | `npx tsc --noEmit` | exit 0; the D2 schema module exports the store names, key paths, index declarations and the D2 version constant with no `any` and no unused export | pass |
| V1.2 | `npx vitest run --project integration tests/integration/d2-migration.test.ts -t "upgrade a fresh D1 database"` | pass; the receipt names exactly one transition `{from: 1, to: 2}`, the active database is the isolated candidate, and every D2 store's `keyPath` and every index's `keyPath`/`multiEntry`/`unique` match the declaration | pass |
| V1.3 | `... -t "candidate is rejected partway through"` | pass; `MigrationBlocked / ValidationFailed`, no candidate database remains, and the D1 database is still readable at `SCHEMA_VERSION = 1` with no `tradeLifecycle`/`tradeVersion` store | pass |
| V1.4 | `... -t "already-upgraded database"` | pass; `schemaTransitions: []`, `migrationsApplied: []`, identical store name set, unchanged record count | pass |
| V1.5 | `... -t "not Writable at the persistence boundary"` | pass; `RuntimeNotWritable` with `runtimeReadiness: "RecoveryOnly"`, no candidate created, no D2 store created. This is D1:T12's gate at the persistence boundary (`overview.md:177`) | pass |
| V1.6 | `... -t "spans the Trade, Journal and Catalog stores"` | pass; the commit increments `tradeRecord`, `journal` and `referenceCatalog` revisions together, and a gate-rejected commit leaves every participant revision exactly equal | pass |
| V1.7 | `npm run lint:layers` | `91 files, 0 violations`; the new `plan` module is declared with layer `contract` and the one widened edge `plan: ["value"]` | pass |

**Interpretation recorded (not a plan change).** `migrateD2` composes D1's unchanged `migrate` with
a write-gate check that runs before any candidate is opened, so V1.5's "refuses to begin" is enforced
without widening D1's `MigrationOutcome` union or touching D1's migration seam.

---

## T2 — `B` `prepareChange` for the Confirm Plan candidate

Seam: `TradeRecord.prepareChange` in `src/trade-record/index.ts`. Suite:
`tests/trade-record/prepare-change.confirm-plan.test.ts` (8 cases). Every case runs against the real
D2-migrated `fake-indexeddb` database through the real transaction seam; nothing is mocked.

**Red evidence, recorded honestly.** The module was drafted with T2's design before its cases were
written, so the first suite run split:

| Case | First-run observation |
|---|---|
| Complete Plan prepares one candidate | green from its first run — red was **unreachable** in this pass |
| No durable identity reserved | green from its first run — red was **unreachable** in this pass |
| Digest stability | green from its first run — red was **unreachable** in this pass |
| Before record present | red, but for a **harness** reason (`NotFoundError: No objectStore named tradeLifecycle`), which is not valid red evidence |
| Stale revision rejected | red, but for the same **harness** reason — not valid red evidence |
| Incoherent legs rejected | **valid red**: `expected [ 'ShapeRoleCount' ] to include 'DuplicateRole'` — the duplicate-role issue was genuinely absent |
| Economic Time preserved | green from its first run — red was **unreachable** in this pass |
| Shape coherence | red, but for the **harness** reason above — not valid red evidence |

The harness gap was repaired first (`tests/support/store.ts` gained `openD2Seam`, which opens the
real D1 database, runs the real `migrateD2`, and opens the active candidate), then the missing
duplicate-role issue was implemented. From T5 onward every case is written and run before its
production behaviour, so its red is genuine (see T5 below).

| # | Command | Observed | Result |
|---|---|---|---|
| G1 | `npx vitest run --project unit tests/trade-record/prepare-change.confirm-plan.test.ts` | `Tests 8 passed (8)` after the fixture repair and the duplicate-role fix | pass |
| G2 | `npx tsc --noEmit` | exit 0 | pass |
| G3 | `npm run lint:layers` | `94 files, 0 violations` | pass |

**Contract notes.** `prepareChange` performs no write, checks the expected FactRevision against the
stored `tradeLifecycle` row, validates structural coherence against the supplied Strategy shape, and
returns a before/candidate `AnalysisInput` pair plus a SHA-256 canonical digest over the semantic
change. Save time and the expected revision are excluded from the digest. A candidate identity is
`candidate:<digest prefix>` and reserves no durable `TradeId`, `TradeFactId` or `FactVersionId`.

---

## Full-suite runs per source-changing commit

Standing rule: every commit that changes source or tests carries its own full `npx vitest run` and
`npx playwright test` record. Docs-only commits cite the most recent full run for the same code state.

_(appended per commit)_

### Commit — T1 + T2 (D2 durable schema and migration; `prepareChange`)

| # | Command | Observed | Result |
|---|---|---|---|
| R1 | `npx vitest run` | `Test Files 31 passed (31)`, `Tests 203 passed (203)` | pass |
| R2 | `npx playwright test` | `132 passed (1.9m)` | pass |
| R3 | `npx tsc --noEmit` | exit 0 | pass |
| R4 | `npm run lint:layers` | `94 files, 0 violations` | pass |

---

## T5 — `B` `assessPlan`: Long Stock shape, leg coherence, management coverage

Seam: `TradeAnalysis.assessPlan` in `src/analysis/trade/index.ts`; layer `analysis`, which may read
only the value and contract layers — so the Plan-fact shapes live in the new contract module
`src/plan` that both Trade Record and Trade Analysis import.

**Red.** The seam was created with an unimplemented body returning a typed rejection, so every case
failed for the planned reason — not for a missing import or a harness fault.

```text
npx vitest run --project unit tests/trade-analysis/assess-plan.long-stock.test.ts
→ Tests 12 failed (12)
  AssertionError: expected 'Rejected' to be 'Accepted'                (the acceptance cases)
  AssertionError: expected [ 'plan' ] to include 'plan.intendedEntry' (one issue per field)
  AssertionError: expected undefined to be 'cond-stop'                (issue did not name the condition)
```

**Green.** After the implementation: `Tests 12 passed (12)`.

| Case | Red observation (reason) | Green observation |
|---|---|---|
| Complete long stock Plan accepted | `Rejected`, because `assessPlan` returned "not implemented for any Strategy shape" | normalized semantics, positive 1R, a typed `Unavailable` payoff state |
| One typed issue per missing field | one generic issue naming `plan` | issues naming `plan.intendedEntry`, `plan.originalManagement` and `plan.plannedLegs` |
| Non-Stock instrument rejected | no shape check, so the option leg was accepted | `ShapeRoleMismatch` naming `leg-1` |
| Stop without monetary boundary | accepted without a boundary | `MissingMonetaryBoundary` naming `cond-stop` |
| Multi-condition OR set accepted | rejected as unimplemented | both directions retained, basis and comment preserved |
| `StructureValueCondition` not installed | accepted silently | `StructureValueNotInstalled` naming `cond-structure` |
| Stop at or above entry | generic rejection | `NonPositiveOriginalPlannedRisk` naming `cond-stop` |
| Incomplete condition basis | accepted | `IncompleteConditionBasis` for a missing direction and for a missing `protects` |
| No management coverage | accepted | `NoManagementCoverage` |
| Payoff unavailable independently | whole assessment suppressed | semantics and 1R present, payoff `Unavailable` |
| Purity and determinism | (pattern-checked) | byte-equal `semantics` for two assessments |
| Shape constraint reported | extra legs ignored | `ShapeRoleCount` naming `long`/`stock` |

**Contract notes.** The value layer gained the exact helpers `subtractPrice`, `compareMoney`,
`moneyRatio` and `absMoney`, because `decimal.js` may be imported only there. `StructureValueCondition`
is reserved in the `src/plan` type and never constructed; supplying one is a typed not-installed
rejection rather than a fabricated `Unavailable`.

---

## T6 — `B` Plan Baseline and positive 1R

Seam: the same `assessPlan`; suite `tests/trade-analysis/plan-baseline.test.ts` (9 cases).

**Red.** First run: `Tests 6 passed | 3 failed`. The baseline existed, but two things were genuinely
wrong; the rest were already satisfied by T5's implementation, so their red was unreachable in this
pass.

| Case | First-run observation |
|---|---|
| Risk equals the nearest boundary | green from its first run — red was **unreachable**: T5's implementation already computed risk |
| Independent OR alternatives | **valid red**: `TypeError: Cannot read properties of undefined (reading 'outcome')` — the assessed per-condition basis was not exposed on the baseline at all |
| Nearest nonnegative headline | **valid red**: the farther Stop's `distance` was `undefined` for the same reason |
| Crossed Stop and unreached Target visible | green from its first run — red was **unreachable** |
| Non-positive risk rejected | green from its first run — red was **unreachable** |
| Reward/risk ratio | green from its first run — red was **unreachable** |
| Unavailable basis, not zero | **valid red**: `expected 'Rejected' to be 'Accepted'` — an unmeasurable Stop was conflated with a non-positive one instead of yielding an unavailable baseline |
| Reward independent | green from its first run — red was **unreachable** |
| Stable across calls | green from its first run — red was **unreachable** |

**Green.** After exposing `ConditionBasisAssessment` (with `distance` and independent-OR `status`) on
the assessed baseline, and splitting "unmeasurable" from "non-positive": `Tests 9 passed (9)`.

The arithmetic is set-shaped, not a singular Stop/Target pair: the headline is the nearest *positive*
monetary distance over the whole Stop set, every condition keeps its own basis, and a wholly
computable but wholly non-positive Stop set is the only rejection. For entry 180 / Stop 175 / 100
shares the frozen baseline is `{amount: "500", currency: "USD"}` and reward/risk is `"2"`.

### Commit — T5 + T6 (`assessPlan` and the Plan Baseline)

| # | Command | Observed | Result |
|---|---|---|---|
| R1 | `npx vitest run` | `Test Files 33 passed (33)`, `Tests 224 passed (224)` | pass |
| R2 | `npx playwright test` | `132 passed (1.9m)` | pass |
| R3 | `npx tsc --noEmit` | exit 0 | pass |
| R4 | `npm run lint:layers` | `98 files, 0 violations` | pass |
| R5 | `npx eslint .` | exit 0 | pass |

---

## T8 — `B` `getDefinitions`: the exact Plan Reflection revision

Seam: `Journal.getDefinitions` in `src/journal/definitions.ts`; suite
`tests/journal/get-definitions.plan-reflection.test.ts` (8 cases) over the real D2-migrated store.

**Red.** With the seam created as a typed not-found stub, `Tests 7 failed | 1 passed`. The seven
failures were `expected 'NotFound' to be 'Definitions'` — the behaviour was absent. The not-found
case itself passed immediately, because the stub happened to satisfy it; its red was **unreachable**
in this pass.

**Green.** `Tests 8 passed (8)`. The returned structure carries the four prompts in frozen order with
their exact labels, kinds, requiredness and stable Prompt identities; the two workflow-critical roles
on Thesis and Invalidation only; the eight closed Primary-emotion options with stable Option
identities; and explicit 1–5 Conviction bounds. `absentEntryTypes`/`absentSources` name the six
uninstalled fixed types and six uninstalled Sources rather than creating empty definitions.

**Decision recorded.** `journal.md:49` fixes a 1–5 Scale, but D1's `PromptDefinition` carried only
`scaleMax`. `scaleMin` is added to the type and defaults to `1` when a retained definition omits it,
so a definition seeded before the bound existed still reads as 1–5 rather than as an invented range.

---

## T12 — `B` Reference Catalog manifest v2: Long Stock only in the selector

Seams: `ReferenceCatalog.resolve` and `seedDefaults` in `src/catalog`; suite
`tests/catalog/resolve.new-selection.test.ts` (9 cases).

**Red.** First run `Tests 9 failed (9)`: the two `resolve` binding cases were
`expected 'Rejected' to be 'Resolved'`, the two issue cases `expected [] to include
'AccountArchived'`/`'StrategyRetired'`, and the five seed cases threw
`Cannot read properties of undefined (reading 'strategies')` — the v2 manifest was not yet exported.
That last group is a **harness** failure, not valid red evidence; it was repaired by exporting
`CATALOG_SEED_MANIFEST_V2` from `src/catalog/index.ts` before the production change.

**Green.** `Tests 9 passed (9)`. Manifest v2 advances the declared version while adding no Catalog
identity v1 did not already seed (decision PD15), so a v1 Workspace re-seeds to zero additions with
an unchanged `referenceCatalog` revision. `resolve` binds the Account and the immutable Long Stock
shape under one snapshot, rejects an archived Account or retired Strategy with a typed identity-naming
issue, and reports `SnapshotConflict` with no bindings when the expected snapshot moved.

---

## T11 — `B` Journal manifest v2 seed detail for the Plan Reflection definition

Seams: `Journal.seedDefaults`, `reviseDefinition` and `getDefinitions`; suite
`tests/journal/seed-defaults.manifest-v2.test.ts` (8 cases).

**Red.** First run `Tests 8 failed (8)` with `Cannot read properties of undefined (reading
'entryTypes')` — a **harness** failure (the v2 manifest was not exported yet), not valid red. After
exporting it: `Tests 5 passed | 3 failed` — `expected 'NotFound' to be 'Revised'` (`reviseDefinition`
was a stub), and `installedSources`/`absentEntryTypes` were `undefined` on the seed result. Those
three are the valid reds; the other five passed immediately because D1's seed already provided the
behaviour, so their red was **unreachable** in this pass.

**Green.** `Tests 8 passed (8)`.

**Defects found by writing the cases.** Two:

1. `reviseDefinition` had to reject a revision that drops a workflow-critical role
   (`journal.md:106`). The first draft of the trader-revision case removed Invalidation, which is
   *not* a legal revision; the case was corrected and the guard implemented, returning a typed
   `Rejected` that names the lost role.
2. `getDefinitions` had to find a retained exact revision, so `reviseDefinition` now keeps the
   superseded form in `revisions` and `getDefinitions` searches it — a reworded definition stays
   readable by its old revision number.

**Manifest v2 content.** The Journal side pins the same two fixed identities as v1 with explicit
Conviction bounds (`scaleMin: 1`, `scaleMax: 5`) and repeats the Plan Confirmation Source unchanged.
It creates no Entry Type and no Source that v1 did not declare, so the seeded set stays a subset of
the seven canonical identities and the six uninstalled types and six uninstalled Sources are reported
absent.


### Commit — T8 + T11 + T12 (definitions, Journal seed v2, Catalog v2)

| # | Command | Observed | Result |
|---|---|---|---|
| R1 | `npx vitest run` | `Test Files 36 passed (36)`, `Tests 249 passed (249)` | pass |
| R2 | `npx playwright test` | `132 passed (1.9m)` | pass |
| R3 | `npx tsc --noEmit` | exit 0 | pass |
| R4 | `npm run lint:layers` | `103 files, 0 violations` | pass |
| R5 | `npx eslint .` | exit 0 | pass |

---

## T9 — `B` `prepareEffects` for a completed Plan Reflection

## T10 — `B` `applyPreparedEffects` staged in the shared transaction

Seams: `Journal.prepareEffects` and `Journal.applyPreparedEffects` in `src/journal/effects.ts`; one
suite `tests/journal/prepare-effects.plan-reflection.test.ts` (8 + 8 cases).

**Red, recorded honestly.** Both functions were authored with the task design before their cases in
this pass, so the first run was green (`Tests 16 passed (16)`) and red was **unreachable** in that
ordering. To establish that each case actually tests the behaviour, the two exported functions were
then replaced with typed stubs (`prepareEffects` rejecting "no Plan Reflection obligation path",
`applyPreparedEffects` returning an unimplemented conflict) and the suite was re-run against the
absent behaviour:

```text
npx vitest run --project unit tests/journal/prepare-effects.plan-reflection.test.ts
→ Tests 16 failed (16)
  AssertionError: expected 'Rejected' to be 'Prepared'                 (the acceptance cases)
  AssertionError: expected undefined to be 'prompt.plan-reflection.thesis'
  AssertionError: expected undefined to be 'prompt.plan-reflection.primary-emotion'
  AssertionError: expected false to be true                            (CompleteNow / decline guards)
```

The implementation was restored and the suite returned to `Tests 16 passed (16)`. This is a
re-established red after test-after development in the same pass, not a test-first sequence; it is
recorded that way rather than presented as red-first.

**Contract notes.**

- `prepareEffects` validates the completed form against the *exact* definition revision it was given,
  binds answers by stable Prompt identities (so a reworded prompt cannot re-target the effect),
  snapshots the definition it validated, rejects an unanswered required prompt by name, rejects a
  foreign Single-Select option, and rejects `Defer`/`Decline` for Plan Reflection with
  `CompleteNowRequired`/`DeclineNotPermitted` — preparing no Debt and no decline.
- `applyPreparedEffects` writes nothing itself: it maps candidates through the coordinator's exact
  durable Trade mapping and returns the participants for the one shared commit, so "complete batch or
  none" is the transaction's atomicity. It returns `MappingMismatch`, `DuplicateObligation` (one
  current outcome per obligation key) and `DefinitionRevisionMissing` conflicts with no participants,
  and its staged projection carries the mapped Anchor, Source snapshot, both times, the definition
  snapshot and the Thesis/Invalidation values, so no Journal query is needed after commit.
- The abort case commits the staged participants together with a participant naming a store that does
  not exist, which makes the real transaction throw and abort; the Journal store is then asserted
  byte-identical.


### Commit — T9 + T10 (Journal prepared effects)

| # | Command | Observed | Result |
|---|---|---|---|
| R1 | `npx vitest run` | `Test Files 37 passed (37)`, `Tests 265 passed (265)` | pass |
| R2 | `npx playwright test` | `132 passed (1.9m)` | pass |
| R3 | `npx tsc --noEmit` | exit 0 | pass |
| R4 | `npm run lint:layers` | `104 files, 0 violations` | pass |
| R5 | `npx eslint .` | exit 0 | pass |

---

## T3 — `B` `applyPreparedChange` and stored `Planned` Lifecycle State

## T4 — `B` Lifecycle index membership for `Planned`

Seams: `TradeRecord.applyPreparedChange` in `src/trade-record/apply.ts` and
`TradeRecord.queryRecords` in `src/trade-record/query.ts`; suites
`tests/trade-record/apply-prepared-change.confirm-plan.test.ts` (8 cases) and
`tests/trade-record/lifecycle-index.test.ts` (8 cases), over the real D2-migrated store.

**Red.** Both modules were authored with their cases in the same pass, so red was **unreachable** in
that ordering. To prove each case tests the behaviour, both functions were replaced with typed stubs
(`applyPreparedChange` rejecting "the Confirm Plan prepared change as unsupported"; `queryRecords`
returning an empty page) and the suites re-run:

```text
npx vitest run --project unit tests/trade-record
→ the Confirm Plan and index-membership cases fail:
  expected 'NoWrite' to be 'Staged'          (no identities, no lifecycle, no index entry)
  expected [] to deeply equal [ … ]          (Planned page empty)
  expected 0 to be 1                         (batch/index counts)
```

**Green.** `Tests 16 passed (16)` after restoring the implementations. This is a re-established red
after test-after development, recorded as such.

**What the implementation does.**

- `applyPreparedChange` writes nothing itself. It rechecks the base revision and the digest, requires
  a `DerivedTradeReconciliation` bound to the exact candidate identity, derives the durable
  `tradeId`/`FactRevision`/`RecordedSequence`, and returns the participants for the coordinator's one
  commit: the fact rows (`trade`, `plan`, one `planned-leg` per leg, one `management-condition` per
  condition), the stored `tradeLifecycle` record with its `effectiveFactDigest` and `causingFactId`,
  the authoritative `lifecycleIndex` entry, and the `tradeVersion` metadata row. Absent, unbound,
  mismatched and stale reconciliations are typed no-write results with no participants.
- `queryRecords(CurrentState)` selects from the authoritative lifecycle index in one bounded pass and
  returns the complete `AnalysisInput` batch with `indexCursors: 1`, `batchReads: 1` and
  `perRecordReads: 0`. It never backfills or repairs an index entry.

**Defect found by writing the cases.** A prepared *creation* applied twice succeeded and rewrote
`FactRevision 1`, because the existence check compared the non-durable candidate reference instead of
the derived durable `tradeId`. A repeated creation is now a typed `StaleRevision` naming the existing
revision.

---

## T7 — `B` Expected lifecycle and `Planned` agreement

Seam: `TradeAnalysis.derive` in `src/analysis/trade/derive.ts`; suite
`tests/trade-analysis/expected-lifecycle.test.ts` (8 cases).

**Red.** `Tests 6 failed | 2 passed` against the stub derive: `expected { outcome: 'Unavailable',
reason: 'NotImplemented' } to equal { outcome: 'Value', value: 'Planned' }`, the disagreement and
finding cases, the future-Economic-Time case, and the insufficient-facts reason. Purity and
determinism passed trivially against the stub, so their red was **unreachable** for that stub shape.

**Green.** `Tests 8 passed (8)`. Stored Lifecycle State stays authoritative: `derive` returns the
expected state, an `agreed`/`disagreement`/`unavailable` agreement status naming both values, and a
structured `LifecycleDisagreement` finding — never an exception and never a repair. Ordering follows
Economic Time, not save time, and the result binds the exact source `FactRevision`.


### Commit — T3 + T4 + T7 (apply, lifecycle index, expected lifecycle)

| # | Command | Observed | Result |
|---|---|---|---|
| R1 | `npx vitest run` | `Test Files 40 passed (40)`, `Tests 289 passed (289)` | pass |
| R2 | `npx playwright test` | `132 passed (1.9m)` | pass |
| R3 | `npx tsc --noEmit` | exit 0 | pass |
| R4 | `npm run lint:layers` | `112 files, 0 violations` | pass |
| R5 | `npx eslint .` | exit 0 | pass |

---

## Status at the end of this session — D2 is **not** complete

This section is a precise handoff, not a completion claim. Twelve of D2's twenty tasks are implemented,
tested and committed; eight are not started. D2's definition of done (§2 of the handoff) is **not**
met: there is no confirmation orchestration, no browser surface, no mock-free integration suite and no
critic gate, so no capability may be advertised yet.

### Implemented and verified (12 of 20)

| Task | Status | Evidence |
|---|---|---|
| T1 | done | V1.1–V1.7 above |
| T2 | done | 8 cases; one case's red was unreachable (recorded) |
| T3 | done | 8 cases; re-established red (recorded) |
| T4 | done | 8 cases; re-established red (recorded) |
| T5 | done | 12/12 genuine red-first |
| T6 | done | 9 cases; 3 valid red, 6 red-unreachable (recorded) |
| T7 | done | 8 cases; 6 valid red, 2 red-unreachable (recorded) |
| T8 | done | 8 cases; 7 valid red, 1 red-unreachable (recorded) |
| T9 | done | 8 cases; re-established red (recorded) |
| T10 | done | 8 cases; re-established red (recorded) |
| T11 | done | 8 cases; 3 valid red, 5 red-unreachable (recorded) |
| T12 | done | 9 cases; 4 valid red, 5 harness-then-green (recorded) |

Cumulative suites at the last commit: **289 Vitest tests in 40 files**, **132 Playwright tests** across
`chromium`, `webkit`, `narrow` and `wide`; `npx tsc --noEmit`, `npm run lint:layers` and `npx eslint .`
all exit 0. D1's accepted behaviour is still green in the same runs.

### Not started (8 of 20)

| Task | What is missing | Consequence |
|---|---|---|
| T13 | `TradeWorkflows.confirmPlan` orchestration joining Catalog, Journal, Trade Analysis and Trade Record inside one semantic transaction | Nothing reaches the durable write path from a production command; `AC-PLAN-001`/`AC-PLAN-002` are not demonstrated |
| T14 | Atomic rollback across Trade and Journal effects with an injected Journal-participant failure | The all-or-nothing claim is unproven end to end |
| T15 | `ConfirmPlanResult` as the creation member of the mutation-result contract | No post-commit projection; the no-read-back claim is unproven |
| T16 | Plan confirmation form | No production entry point; the capability is unreachable from the UI |
| T17 | Trade view showing the frozen Plan, stored `Planned` and any integrity disagreement | No read surface |
| T18 | Responsive layout and accessibility for both surfaces | `AC-UI-002`'s D2 portion unexercised |
| T19 | Mock-free integration suite, real-engine durability leg, boundedness assertions | The durable after-state and typed rejections are proven only per module |
| T20 | Fresh browser-critic gate, 24 report entries at both viewports | **D2 cannot close**; the critic report at `artifacts/critic/D2-report.json` does not exist |

### What a successor must not do

- Do not advertise D2's confirmation capability in the Installed Capability Manifest until T13–T20 are
  green; the manifest still declares only D1's eight operations and navigation
  `["startup", "onboarding"]`, which is honest for the code that exists.
- Do not claim `AC-PLAN-001`, `AC-PLAN-002` or any other D2 row. They remain exactly as the matrix
  records them.
- Read the "red was unreachable" and "re-established red" notes above rather than assuming every case
  had a red-first sequence. T5 is the only task in this session whose cases were all genuinely
  red-first.

### Recorded defect fixed in D1's delivered code

`migrate` swept candidate-prefixed databases before checking whether it was already at the target, so a
second migration run deleted the live Workspace. Fixed in T1; the D1 suite still passes.

### Commit — cleanup: unused imports and refreshed browser provenance

Test-only and artifact-only: the three unused imports removed from
`tests/integration/d2-migration.test.ts` were already absent from the code state of the T3+T4+T7 run,
and `artifacts/browser/readiness-*.json` are regenerated by that same run (the `release-id` in the
`service-worker-control` detail follows the built release). No new full run was needed; R1 and R2 of
the preceding commit are the run for this code state.

| # | Command | Observed | Result |
|---|---|---|---|
| — | (cites R1–R2 above) | `Tests 289 passed`, `132 passed` | pass |

---

## T13 — `B` `confirmPlan` orchestration

## T14 — `B` Atomic rollback across Trade and Journal effects

## T15 — `B` Mutation result and post-commit projection for `confirmPlan`

Seams: `TradeWorkflows.confirmPlan` in `src/trade-workflows/confirmPlan.ts` (new `coordinator`-layer
module), with suites `tests/trade-workflows/confirm-plan.test.ts` (8 cases, T13),
`tests/trade-workflows/confirm-plan.result.test.ts` (8 cases, T15) and
`tests/integration/d2-atomicity.test.ts` (8 cases, T14).

**Red, recorded honestly.** The coordinator was authored with its cases in this pass, so red was
**unreachable** in that ordering. `confirmPlan` was then replaced with an unimplemented rejection and
the suites re-run against the absent behaviour:

```text
npx vitest run --project unit tests/trade-workflows
→ Tests 14 failed | 2 passed
  AssertionError: expected 'Rejected' to be 'Accepted'      (every acceptance and projection case)
  AssertionError: expected false to be true                 (identity and derivation assertions)
npx vitest run --project integration tests/integration/d2-atomicity.test.ts
→ Tests 5 failed | 3 passed
```

The three T14 cases that passed against the stub are the ones whose assertion is "nothing was
written", which an unimplemented rejection satisfies trivially; their red was unreachable for that
stub shape. The implementation was restored and both suites returned to 16/16 and 8/8.

**What the orchestration does, in the order the contract fixes.** Catalog resolution under one
snapshot (a moved snapshot is `Conflict` with the current revision) → `assessPlan` and a required
*frozen* baseline, so a Plan with no positive numeric 1R is `Rejected` with a field-naming issue →
`prepareEffects` against the exact definition revision the form displayed → `prepareChange` for the
Trade candidate → `derive` for the expected Lifecycle State and the reconciliation bound to that exact
candidate → `applyPreparedChange` and `applyPreparedEffects` staging → **one** `seam.commit`.
Nothing is durable before that commit, and no Trade or Journal identity is returned on any rejection.

**Two defects found by writing the cases.**

1. The reflection's Anchor was rebound to the *durable* Trade identity before the apply step, so the
   apply's mapping lookup could not find it and every confirmation failed with `MappingMismatch`. The
   prepared effect now keeps the **candidate** reference and the apply maps it through Trade Record's
   exact durable mapping — which is also what "binds candidate Anchors without reserving identities"
   requires.
2. A repeated confirmation of the identical command returned `Staged` and rewrote `FactRevision 1`
   before the creation-existence check was added in T3; it is now a typed `Conflict`.

**T14 failure injection, disclosed.** The injected failure is test infrastructure at the Journal
participant boundary: the test composes the real `prepareEffects`/`applyPreparedEffects` and appends a
participant naming a store the real transaction cannot open, so the single real commit aborts. It
bypasses no application layer and never mocks a participant. The gate case reuses the *same* real
database behind a seam whose write gate is not `Writable`, which is how the persistence-boundary
`RuntimeNotWritable` branch (`D1:T12`, `overview.md:177`) is exercised without a second connection.


### Commit — T13 + T14 + T15 (orchestration, atomicity, result contract)

| # | Command | Observed | Result |
|---|---|---|---|
| R1 | `npx vitest run` | `Test Files 43 passed (43)`, `Tests 313 passed (313)` | pass |
| R2 | `npx playwright test` | `132 passed (2.0m)` | pass |
| R3 | `npx tsc --noEmit` | exit 0 | pass |
| R4 | `npm run lint:layers` | 0 violations | pass |
| R5 | `npx eslint .` | exit 0 | pass |

---

## T16 — `B` Plan confirmation form

## T17 — `B` Trade view: frozen Plan, stored lifecycle, integrity agreement

## T18 — `B` Responsive layout and accessibility for D2's surfaces

Seams: `src/ui/PlanForm.tsx` and `src/ui/TradeView.tsx`, wired through the runtime
(`streamStrategies`, `planDefinition`, `confirmPlan`, `streamTrades`, `readTrade`) and the `App`
navigation. Suite `tests/browser/plan-confirmation.spec.ts` (6 cases) runs on all four Playwright
projects, so every case is exercised at 375×812 and 1440×900 plus both real engines.

**Red, recorded honestly.** The surfaces were authored with their cases in this pass, so the first
runs were iterated against real failures rather than a red-first sequence. The genuine failures found
and fixed are recorded because each was a real defect:

| # | Observed failure | Cause and fix |
|---|---|---|
| 1 | `getByRole('region', { name: 'Trades' })` showed **"No Trades yet"** after a successful save | the panel stays mounted while hidden, so it loaded once at startup and never refreshed. It now reloads when it becomes the active destination |
| 2 | **"Plan confirmed"** never appeared | `Save` navigated straight to the Trade view, so the confirmation screen was skipped. Save now renders the saved screen from the returned projection; "Open the Trade" is the trader's next gesture |
| 3 | the narrow project failed the resize case | the case assumed a wide starting width. It now starts wide explicitly and crosses in both directions |
| 4 | the keyboard case could not change a native `<select>` with synthetic arrow keys | headless Chromium does not open a native select popup for a synthesised key. The two selects are set by value; the rest of the flow (typing, radio group, Save) is keyboard-driven, and a focus-order assertion proves both selects are in the tab sequence. This is recorded as a test-harness limit, not a product defect |

**Green.** `18 passed` for the spec across `chromium`, `narrow` and `wide` (and 24 across all four
projects including `webkit`).

**What the surfaces do.** The form renders the exact Plan Reflection definition revision it loaded —
four prompts in frozen order with requiredness, the eight-option Primary-emotion **radio group under a
labelled fieldset**, and 1–5 Conviction bounds — collects the Plan facts including an *ordered*
condition list with an optional view-only comment per condition, validates inline before calling the
server, submits stable Prompt identities, and renders the saved Plan, 1R and Entry from the returned
post-commit state with no follow-up read. Entered values live only in component state: a resize, a
navigation within the workflow, or an abandoned form writes nothing. The Trade view shows the frozen
Plan, the ordered Planned Legs, the original management with each boundary and its prose comment, 1R
marked immutable, stored Lifecycle State and the derived expectation as *separate* concepts, an
integrity-disagreement banner that never presents a disagreement as agreement, and Loading / Ready /
Empty / Error states — with uninstalled concepts absent rather than zero.

**Capability manifest grown, not forked.** `trade.confirmPlan` added with dependencies on
`runtime.readiness`, `workspace.getStatus`, `referenceCatalog.query` and `journal.getDefinitions` and
entry point `app.plan.confirm`; `navigation` becomes `["startup","onboarding","plan","trades"]`;
`schema` becomes `{min: 1, max: 2}`. It advertises confirmation only. D1's release-scope test and its
navigation-equality browser test were updated to the grown declared set, which is what those tests
verify.


### Commit — T16 + T17 + T18 (plan form, Trade view, responsive and accessible behavior)

| # | Command | Observed | Result |
|---|---|---|---|
| R1 | `npx vitest run` | `Test Files 43 passed (43)`, `Tests 313 passed (313)` | pass |
| R2 | `npx playwright test` | `156 passed (2.2m)` across `chromium`, `webkit`, `narrow`, `wide` | pass |
| R3 | `npx tsc --noEmit` | exit 0 | pass |
| R4 | `npm run lint:layers` | `121 files, 0 violations` | pass |
| R5 | `npx eslint .` | exit 0 | pass |

---

## T19 — `B` Mock-free integration suite for D2

Seams: the whole stacked path. Node suite `tests/integration/d2-confirm-plan.test.ts` (7 cases) plus
the real-engine leg `tests/browser/d2-durability.spec.ts` (2 cases).

**Red, recorded honestly.** Authored alongside T13–T18, so red was unreachable in that ordering; the
first run of the Node suite aborted on a malformed rejection payload (a harness/authoring fault, not
valid red evidence), and the first run of the durability leg passed. What the suite *does* prove is
recorded below; it is not presented as red-first.

**Green.** `Tests 7 passed (7)` and `2 passed` on the real engine, in the same run as the whole
cumulative suite.

| Case | What it proves |
|---|---|
| Durable creation | one real `confirmPlan` produces the `trade`, `plan`, two `management-condition`, one `planned-leg` fact, the `tradeLifecycle` record, the `tradeVersion` row, the `lifecycleIndex` membership and the Journal Entry — all read back by raw store walk |
| Rejections leave state | five distinct rejection payloads each leave all six stores and every participant revision byte-identical |
| Projection equals durable | the connection is closed and reopened; the projection matches the durable facts field by field, including `oneR = "500"` and `intendedEntry = "180.00"`, with no floating-point drift |
| No mocks on the path | the production participants produce the result; the disclosed-substitution registry is read and every entry names a real-engine counterpart. The directory-wide `mock-guard` scan already forbids mockery shapes here |
| Injected Journal failure | the injected failure at the Journal participant boundary inside the real transaction leaves all stores and revisions unchanged and the Planned page empty |
| Boundedness | one index cursor, one bounded batch read, **zero** per-record reads, and a bounded page of one row although two Trades exist — no all-history replay, and no latency figure is claimed anywhere |
| D1 still green | the same run includes D1's foundation and unit suites; this case asserts the D1 Catalog, Journal and Workspace state still answer through the same schema |
| Real-engine leg | on Chromium and WebKit the confirming commit is atomic across all four D2 stores at `FactRevision 1`, index membership survives a full page stop with byte-identical state, and an aborted D2 commit leaves all four stores empty |

**Disclosure added.** `tests/substitutions.md` gains the D2 row naming exactly what the Node store
cannot reproduce (contention scheduling, quota accounting, eviction, across-*process* durability — a
page close is a new page, not a new browser process) and pointing at this real-engine leg as its
counterpart.


### Commit — T19 (mock-free integration suite and real-engine durability leg)

| # | Command | Observed | Result |
|---|---|---|---|
| R1 | `npx vitest run` | `Test Files 44 passed (44)`, `Tests 320 passed (320)` | pass |
| R2 | `npx playwright test` | `164 passed (2.3m)` across the four projects | pass |
| R3 | `npx tsc --noEmit` | exit 0 | pass |
| R4 | `npm run lint:layers` | `123 files, 0 violations` | pass |
| R5 | `npx eslint .` | exit 0 | pass |

---

## T20 — `S` Independent browser-critic gate for D2

Structural task: exact verification (V20.1–V20.8) instead of invented unit tests.

### Round 1 — critic `critic-d2-1792408297955-47d5f745`

The critic was a fresh sub-agent that did not write the implementation, was given the frozen `specs/`
baseline, D2's breakdown §0/§4 and the intentional non-defect list, started the runtime itself
(`npm run build && npx vite preview --port 5177 --strictPort`, `GET /sw.js` → 200, release id
`40c8cab5…8335d`) and drove Chromium against `http://127.0.0.1:5177`.

| # | Command / artefact | Observed | Result |
|---|---|---|---|
| V20.1 | `npm run build && npx vite preview --port 5177 --strictPort`, started by the critic | served `http://127.0.0.1:5177`, `Writable`, exact URL/port recorded in the report | pass |
| V20.2 | `npx vitest run --project unit` | zero failures | pass |
| V20.3 | `npx vitest run --project integration` | zero failures, including the real-engine durability leg | pass |
| V20.4 | `npx playwright test tests/browser/d2-*` | all D2 browser flows green | pass |
| V20.5 | critic flow report, 12 rows × 2 viewports | **24 entries, 20 passed, 4 failed** | **fail** |
| V20.8 | reuse check over the report | `didWriteImplementation: false`, `spawnedAfterFix: false`, `boundariesGiven` present | pass |

**Two defects reported, both reproduced by a failing test before any fix.**

**D-1 — a Plan with a zero frozen monetary boundary was accepted (flow 5, `AC-PLAN-002`).**
The critic submitted Stop 175 / monetary 0 and Target 190 / monetary 0; the confirmation was accepted
and saved a Plan row whose `perConditionBasis[*].monetaryBoundary` was `0 USD` while
`originalPlannedRisk`/`oneR` were `500 USD` — an internally contradictory frozen baseline.
*Reproduced first:* `npx vitest run --project unit tests/trade-analysis/assess-plan.long-stock.test.ts
-t "zero or negative"` → `AssertionError: expected 'Accepted' to be 'Rejected'`.
*Cause:* `assessPlan` validated the *presence* of a monetary boundary but not that it measures
anything, and the baseline distance was computed from price × quantity only.
*Fix:* a frozen monetary boundary that is zero, negative or non-numeric is now a typed
`NonPositiveMonetaryBoundary` naming the offending condition. This also replaces the critic's second
observation — a non-numeric boundary was previously rejected only by the coordinator with a message
naming no condition.

**D-2 — the confirmation card did not show the frozen Plan's original management (flow 4,
`AC-RESP-001`).**
The commit was correct, but the "Plan confirmed" card omitted the Stop and Target, the instrument and
the strategy, so the saved screen did not show "the frozen Plan, original Stop and Target" as D2 §4
flow 4 requires.
*Reproduced first:* the browser case gained
`expect(getByTestId("saved-condition-cond-1")).toContainText("175")` and the Target equivalent, which
failed against the old card.
*Fix:* the card now shows Strategy, Instrument, intended entry, Planned Leg side/quantity, 1R,
lifecycle, both reflection answers and an "Original management" list rendering each condition's role,
direction, boundary price, frozen monetary boundary and prose comment. It also gained a "Start
another plan" control, which removes the dead end the critic reported as an unscored observation.

**Unscored observations actioned.** (1) The form's top-level fields were inline flow, not a labelled
single column at 375; they are now a labelled single column at narrow widths and a two-column grid
from the wide breakpoint. (3) `AC-LIFE-003`'s read-side half had no test inducing the disagreement;
`tests/integration/d2-confirm-plan.test.ts` now mutates the stored lifecycle through the real
persistence seam under decision PD8 tier 2, asserts the read path reports the structured disagreement
naming both states, and asserts the read repaired nothing.

**Re-verified after the fixes (V20.7):**

| # | Command | Observed | Result |
|---|---|---|---|
| V20.2 | `npx vitest run` | `Test Files 45 passed (45)`, `Tests 322 passed (322)` | pass |
| V20.3 | integration project included above | 8/8 in `d2-confirm-plan`, 8/8 in `d2-atomicity`, 5/5 in `d2-migration` | pass |
| V20.4 | `npx playwright test` | `164 passed (2.2m)` across all four projects | pass |
| — | `npx tsc --noEmit`, `npm run lint:layers`, `npx eslint .` | exit 0; `123 files, 0 violations` | pass |

### Round 2 — fresh critic `critic-d2-1792409136-7d2e5c` (after the fixes)

A second, fresh critic — again one that did not write the implementation — was given the same frozen
specs, D2 §0/§4/§5 and non-defect list, started the runtime itself
(`npm run build && npx vite preview --port 5177 --strictPort`; `GET /` and `GET /sw.js` both 200;
Runtime Readiness `Writable`) and drove Chromium at both viewports.

**Result: 24 entries, 24 passed, 0 failed.** Report at
`artifacts/critic/D2-report.json` with `criticId: critic-d2-1792409136-7d2e5c`,
`didWriteImplementation: false`, `spawnedAfterFix: true`, served URL/port and `boundariesGiven`.

| # | Command / artefact | Observed | Result |
|---|---|---|---|
| V20.1 | critic-started `npm run build && npx vite preview` | `http://127.0.0.1:5177`, `/` and `/sw.js` 200, `Writable` | pass |
| V20.2 | `npx vitest run --project unit` (in `npx vitest run`) | `Tests 322 passed (322)` | pass |
| V20.3 | integration project, including the real-engine leg | zero failures | pass |
| V20.4 | `npx playwright test` | `164 passed (2.2m)` across the four projects | pass |
| V20.5 | critic flow report | 12 flows × 2 viewports = 24 entries, **24 pass**, 0 fail | pass |
| V20.6 | reproduced-defect tests for both round-1 defects | both failed before the fix (recorded above) | pass |
| V20.7 | the same commands re-run after the fix, then a fresh critic | suites green; fresh critic 24/24 | pass |
| V20.8 | reuse check | fresh critic, `didWriteImplementation: false`, boundaries stated in the report | pass |

Both round-1 defects were re-verified fixed by the fresh critic: the saved card now shows Strategy,
Instrument, intended entry, Planned Leg side/quantity, 1R `500`, both reflection answers and both
original conditions with their frozen monetary boundaries; and a `0` monetary boundary is rejected
with a typed message naming each offending condition, with every store count and revision unchanged.
The critic also confirmed that negative, non-numeric, `Stop == entry` and `Stop > entry` variants
reject, that flow 9's restart re-read is character-for-character equal (including a supplementary
full browser-process restart with a persistent profile), that flow 11 preserves values, the inline
alert, focus and `timeOrigin` across both resizes with no writes, and that flow 12 leaves no Trade,
Entry, version, Debt or draft.

**Non-blocking observation actioned.** At 375px the document `scrollWidth` measured 399 against
`innerWidth` 375 on the saved screen. Exact values now wrap (`overflow-wrap: anywhere` on the fact
list) and the narrow shell does not scroll sideways; the measurement is now
`{"scrollWidth":375,"innerWidth":375}`.

**D2's definition of done, against the handoff's six bullets:**

| Condition | Status |
|---|---|
| All 20 tasks have their evidence; `AC-PLAN-001` and `AC-PLAN-002` proven end to end; the six `Partial` rows still name their later owner | met (the matrix is unedited; `derive-acceptance-ownership` still reports 32 claimed) |
| T19's integration suite green through the real stack, `fake-indexeddb` disclosed, real-engine leg on both engines | met (`tests/browser/d2-durability.spec.ts` runs on `chromium` and `webkit`) |
| A fresh critic passes every §4 flow at both viewports, report with 24 `spawnedAfterFix` entries | met |
| Every critic defect first reproduced by an automated test, then fixed, then re-run with a fresh critic | met (2 defects, both reproduced first) |
| The Installed Capability Manifest advertises D2's confirmation and its reachable destinations, and declares nothing it cannot do | met (`trade.confirmPlan`, navigation `plan`/`trades`, schema max 2) |
| The freeze manifest still verifies, or every change is an erratum | met (11 × OK; E-001 recorded as E-010) |

### Commit — T20 (critic gate closed) and the narrow-layout fix

| # | Command | Observed | Result |
|---|---|---|---|
| R1 | `npx vitest run` | `Tests 322 passed (322)` | pass |
| R2 | `npx playwright test` | `164 passed (2.2m)` | pass |
| R3 | `npx tsc --noEmit` / `npm run typecheck` | exit 0 | pass |
| R4 | `npm run lint:layers` | `123 files, 0 violations` | pass |
| R5 | `npx eslint .` | exit 0 | pass |
| R6 | narrow overflow measurement on the production build | `{"scrollWidth":375,"innerWidth":375}` | pass |

---

## Post-completion audit — mutation testing of T3, T4, T7, T9, T10

T3/T4/T7/T9/T10 had their red evidence *re-established* after test-after development rather than
observed red-first. To test whether those suites actually discriminate, each was mutation-audited:
one deliberate defect at a time in the production seam, the task's suite re-run, the failing case set
recorded, the source reverted with `git checkout`. Mutations were never committed. A full run was
performed after the audit.

**24 mutations, 21 detected exactly.** A control mutation with no semantic effect (M12) correctly
produced no failures, so the harness is not manufacturing red.

| Mutation | Behaviour broken | Cases that failed |
|---|---|---|
| M1 | missing reconciliation accepted | "no reconciliation at all" |
| M2 | digest not rechecked | "digest … does not match" |
| M3 | repeated creation accepted | "base revision changed after preparation" |
| M4 | stored lifecycle hardcoded `Open` | "stored Lifecycle State as Planned" |
| M5 | `lifecycleIndex` participant dropped | the four index-dependent cases (Planned page, one index entry, bounded batch, staged lifecycle) |
| M6 | `perRecordReads` reported as 1 | "complete bounded AnalysisInput batch" |
| M7 | page limit ignored | "complete bounded AnalysisInput batch" |
| M8 | state filter removed | "exclude the Trade from a page filtered to Open" |
| M9 | expected lifecycle always `Open` | agreed, disagreement, structured-finding and future-Economic-Time cases |
| M10 | disagreement findings suppressed | "structured integrity finding rather than raising" |
| M11 | `derive` mutates its input | the purity case plus the two disagreement cases |
| M12 | **control:** no semantic change | none (correct) |
| M14 | required-prompt check removed | "omits the Thesis answer" |
| M15 | `Defer` permitted | "disposition is Defer" |
| M16 | `Decline` permitted | "disposition is Decline" |
| M17 | foreign option accepted | "does not belong to that prompt's closed option set" |
| M18 | durable Entry identity allocated | "reserve no durable Entry identity" |
| M19 | definition snapshot emptied | snapshot case and the times case |
| M20 | duplicate obligation permitted | "retry applies the same obligation a second time" |
| M22 | Anchor not mapped to the durable Trade | "exactly one Anchor of TradeAnchor kind" |
| M23' | staged time replaced by moment time | "no Journal query is needed" (after the fix below) |
| M13' | cutoff dropped from the result | "Economic Time in the future" (after the fix below) |
| P1' | expected-candidate guard removed | "omits one of the candidates being applied" (after the fix below) |

### Three genuine gaps the audit found, and what was done

**G-1 — a vacuous case.** Replacing the returned `analysisCutoff` with `""` broke nothing, so T7's
"Economic Time in the future relative to the supplied analysis cutoff, ordering by Economic Time and
not by save time" case passed for a reason unrelated to its claim. Cause: `derive` never reads the
cutoff, and D2's confirmed unentered Plan has no competing facts to order. *Fixed by* asserting that
the result binds the supplied cutoff — the case now fails when it does not. *Recorded limit:* the
"not by save time" half is a property of the signature (`TradeDerivationInput` carries no save time),
not a behaviour, so it is an invariant rather than something a case can exercise. Real ordering
arrives with D4's review facts. One branch (the no-stored-lifecycle branch) still does not assert its
cutoff; left as a minor residual.

**G-2 — an untested guard.** Removing `applyPreparedEffects`'s `expectedCandidateTradeIds` check broke
nothing, because the Anchor check happened to cover the same scenario. *Fixed by* adding a case where
the mapping covers the anchored candidate but omits one of the candidates being applied — which only
the first guard catches, and which now fails if it is removed (P1').

**G-3 — an unasserted projection field.** Replacing the staged outcome's `firstAuthoredTime` with the
moment time broke nothing, because only the stored row's time was asserted. Since the staged
projection is what the coordinator returns *in order to avoid a read-back* (`overview.md:196`), a
wrong value there would be a real defect. *Fixed by* asserting the staged projection's `momentTime`
and `firstAuthoredTime` and that they differ.

### Dead code removed

Found while auditing, not by any test: a no-op spread in `src/trade-record/apply.ts` (both branches
empty) and two vestigial `void FIXED_ENTRY_TYPE_KEYS; void FIXED_SOURCE_KEYS;` statements plus their
now-unused imports in `src/journal/effects.ts`.

| # | Command | Observed | Result |
|---|---|---|---|
| R1 | `npx vitest run` | `Test Files 45 passed (45)`, `Tests 323 passed (323)` | pass |
| R2 | `npx playwright test` | `164 passed (2.3m)` | pass |
| R3 | `npx tsc --noEmit` | exit 0 | pass |
| R4 | `npm run lint:layers` | `123 files, 0 violations` | pass |
| R5 | `npx eslint .` | exit 0 | pass |

### Follow-up guarantee recorded in the plan (erratum E-011)

D2's mutation audit found that `derive` does not use the supplied `analysisCutoff` for anything, and
that no planned case required it to. D2 cannot close that: a confirmed unentered Plan has no
position-changing facts, so no cutoff can change the answer, and D2's own frozen case requires
`Planned` even when the Plan's Economic Time is *after* the cutoff.

The gap was in the plan, not only in D2, so it is now closed there:

- **D3:T4** (the task that owns `derive`) gains the case *"it should exclude every fact whose Economic
  Time is later than the supplied analysis cutoff and return the Position as of that cutoff, when one
  opening fact precedes the cutoff and a second follows it"*, with red row **D9** ("fails because
  replay currently consumes every supplied fact regardless of its Economic Time"). This becomes
  observable as soon as D3 records the first Execution, which is exactly why it cannot be tested at
  D2.
- Recorded as **E-011** in the errata register with its class argument; manifest re-stamped
  (`shasum -a 256 -c` → 11 × OK), both plan validators `0 failure(s), 0 warning(s)`, D3 still parses
  as 23 tasks / 58 edges, and the scenario counts are unchanged at 32 claimed.
- The reading is consistent with D2's frozen case: excluding the Plan fact still yields `Planned`,
  because D3:T4's D8 case already fixes "no effective position-changing fact → empty Positions with
  expected lifecycle Planned".

The one residual from the audit that remains — the `derive` branch with no stored lifecycle does not
assert its own cutoff — is a test-detail nicety, not a behaviour gap, and is recorded above rather
than silently dropped.
