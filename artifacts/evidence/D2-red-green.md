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
