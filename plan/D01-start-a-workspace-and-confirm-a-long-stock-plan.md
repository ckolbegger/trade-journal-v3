# D1 — Start a Workspace and confirm a Long Stock Plan: task breakdown

Definition: [implementation plan, D1](implementation-plan.md#d1--start-a-workspace-and-confirm-a-long-stock-plan). The definition (stories, capability set, introductions, acceptance claims) stays there and is not repeated here.

Status: **draft, under review.** Decisions P1–P3 were agreed on 2026-10-11 (first section). Everything else is written against them and the working assumptions listed below.

---

## 1. Decisions and clarifications

### 1.1 Decisions agreed during this breakdown (2026-10-11)

| # | Question | Decision | Consequence |
|---|---|---|---|
| P1 | **Basis of the capacity requirement.** | **Mature projection.** Fix the mature dataset profile in 1.3 and require `quota ≥ 3 × M`, where `M` is the projected on-disk size of a mature Workspace. D1 measures real bytes per stored record for the kinds it has (Trade documents, Plan Reflection Entries) in Chromium and uses stated per-record allowances for kinds that do not exist yet. Each schema-changing deliverable replaces an allowance with a measurement. RC re-measures in Firefox and WebKit and keeps the largest engine. D8 checks the projection against the real benchmark dataset loaded through Restore. A build-time check fails if the schema version changes without a recomputed basis. Recorded as plan decision 18. | The threshold stays nearly constant from D1 onward, so an update never moves a working browser to `Recovery Only` because the formula grew. D1's number is partly estimated (disclosed) until D8 measures it. Expected magnitude: `M` about 0.6–0.8 GB, so about 2–2.5 GB of origin quota. A nearly full phone is `Unsupported`, which is the specified behavior. |
| P2 | **How readiness failures are produced in browser tests.** | **Faults build for every readiness failure; routine browser runs use Chromium only; real-state three-engine evidence moves to RC**, the approved layer-only checkpoint that is built before the first publish. Recorded as plan decision 19 and in the plan's layer-only exceptions. | D1's routine suites stay fast. D1's delivery acceptance rows cite Chromium evidence; their Firefox and WebKit evidence and their real-state readiness evidence are marked **pending RC**. Engine-specific defects in Firefox or WebKit may surface only when RC runs. |
| P3 | **Plan confirmation Economic Time.** | **The trader enters it**, defaulting to "now" in the Workspace time zone. It may not be in the future. D2 requires opening Executions at or after it. Recorded as plan decision 20. | Plans recorded after the close still precede their entries. The Plan form gains one field. |

### 1.2 Working assumptions

These are implementation-level choices that do not reopen product semantics. They stand unless you object.

| # | Assumption |
|---|---|
| A1 | **Long Stock management in D1:** exactly one underlying-price Stop (below intended entry) and one underlying-price Target (above it). Both are required and stored as condition lists, each condition with its own fact identity, so D10 and D17 can add conditions without reshaping. A Target at or below entry is rejected (`TargetNotBeyondEntry`). |
| A2 | **No live Plan Baseline preview** on the Plan form. No specified operation previews an unconfirmed Plan, and computing one in the UI would duplicate Trade Analysis. The baseline is shown from the confirmation result. |
| A3 | **Entry snapshots by immutable reference.** An Entry stores the identity of the immutable Entry Definition revision it was answered against, plus its answers. Because a revision never changes, this retains the exact Prompt wording, order, and option labels. Backups include every revision (D8). |
| A4 | **Readiness is re-run immediately before every authoritative mutation** (all four checks, about 50 ms), as well as on launch and after update activation (Restore arrives in D8). The persistence gate then checks the session state synchronously. This is how a mid-session cache or storage failure is caught at the next mutation without needing an event. |
| A5 | **Update activation is deferred while any tab holds an unsaved form.** The notice says why, and the reload action stays disabled until the form is saved or cancelled. Unsaved values are never written to any storage (AC-JOUR-001). Tabs coordinate over `BroadcastChannel`. |
| A6 | **Reference bindings are rechecked per record.** Inside the commit, confirmation rechecks the record revisions and selectability of the chosen Account, its Institution, and the Strategy, rather than requiring the whole Catalog snapshot to be unchanged. Adding an unrelated Account in another tab therefore does not invalidate an open Plan form. |
| A7 | **Responsive breakpoint:** wide layout at a viewport width of at least 960 CSS px; narrow (bottom navigation) below that. |
| A8 | **First-run time zone:** propose the browser-resolved IANA zone when Temporal accepts it; the trader confirms or picks another from `Intl.supportedValuesOf('timeZone')`. A local date-time that falls in a DST gap, or is ambiguous at a fall-back, is rejected with a typed reason. |
| A9 | **Input formats:** Stock symbol `^[A-Z][A-Z0-9.]{0,9}$` after trimming and upper-casing (for example `BRK.B`). Price and Quantity are positive finite decimals with at most 6 fractional digits, stored as normalized strings. |
| A10 | **Storage layout:** a root database `tj-root` (stores `pointer` and `diagnostics`) plus one Workspace database `tj-ws-<uuid>` (stores `meta`, `catalog`, `journalTypes`, `journalDefinitions`, `journalEntries`, `trades`). The readiness probe uses `tj-root.diagnostics`, so it works before any Workspace exists. |
| A11 | **Identities:** `crypto.randomUUID()` behind an injected generator, deterministic in tests. Identities are assigned only inside apply, never in prepare. |
| A12 | **Concurrent first-run initialization** is resolved by writing the pointer with IndexedDB `add` inside the root transaction. The loser sees the existing Workspace and opens it. Web Locks wait for D2's migration. |
| A13 | **Recovery Only copy before D8:** "Another browser has its own separate storage and would start an empty journal. Moving a journal between browsers needs a verified backup and Restore, which this release does not offer yet." |
| A14 | **UI unit tests** use Vitest with `jsdom`, `@testing-library/react`, and `@testing-library/user-event`. This is a small addition to the approved testing stack; versions are pinned at plan freeze. |
| A15 | **Release harness server:** an in-process Node static server used only by tests and the critic. It serves one of several built release folders on port 5175 with Cloudflare-Pages-like caching headers (`sw.js` and `inventory.json` are `no-cache`; hashed assets are immutable). Switching release is a function call in Playwright and a keypress for the critic. |
| A16 | **Planned list "entry readiness"** reads "Awaiting entry" in D1, because recording an entry arrives in D2. |
| A17 | **Dependency direction is enforced mechanically** with `dependency-cruiser` rules that mirror the overview's "who may call whom" table, plus purity rules (no clock, `Math.random`, storage, or `fetch` in `domain/`) and a ban on `navigator.userAgent`, `userAgentData`, `platform`, and `vendor` anywhere in `src/`. |

### 1.3 Mature dataset profile (agreed with P1)

The profile is shared by the capacity formula (D1) and the benchmark generator (D2 onward). The counts follow the delivery contract's mature workload (25,000 Trades, about 200,000 Execution or settlement facts, 200 Open); the rest are disclosed representative assumptions.

| Record kind | Count | Basis in D1 |
|---|---|---|
| Trades (24,700 Closed, 200 Open, 50 Planned, 50 Abandoned) | 25,000 | measured (Trade document with Plan facts) |
| Position Changes | 100,000 | allowance until D2 |
| Executions and settlement facts | 200,000 | allowance until D2 and D7 |
| Plan Reflection Entries | 25,000 | measured |
| Position Change Reflection outcomes (Entries, declines, Debt) | 100,000 | allowance until D2 and D5 |
| Close Review outcomes | 24,700 | allowance until D6 |
| Daily Trade Review Actions (about 100 Open × 1,260 sessions) | 126,000 | allowance until D4 |
| Review Notes and Trader Reflections | 5,000 | allowance until D13 |
| Marks / Daily Bars (about 150 Instruments × 1,260 sessions) | 190,000 each | allowance until D3 / D11 |
| Correction versions (2% of facts) | 4,000 | allowance until D15 |
| Catalog records | about 60 | measured |

Allowances are estimated from each kind's planned JSON shape multiplied by the on-disk overhead ratio D1 measures for its own records in the same engine.

---

## 2. Implementation boundaries introduced in D1

| Canonical boundary | Code location | D1 operations |
|---|---|---|
| Exact values, time | `src/domain/values/`, `src/domain/time/` | decimal parse/format, rational arithmetic, `Clock`, zone validation, local↔instant |
| Trade Analysis (pure) | `src/domain/trade-analysis/` | `assessPlan` (Long Stock), `derive` (Planned) |
| Trade Record | `src/modules/trade-record/` | `prepareChange`/`applyPreparedChange` (ConfirmPlan), `getRecord`, `queryRecords` (`CurrentState`; `Summary`, `AnalysisInput`) |
| Journal | `src/modules/journal/` | `seedDefaults`, `getDefinitions`, `prepareEffects`/`applyPreparedEffects` (Complete), `query` (Trade narrative) |
| Reference Catalog | `src/modules/reference-catalog/` | `seedDefaults`, `save` (CreateInstitution, CreateAccount), `query`, `resolve` (`NewSelection`, `DisplayOnly`) |
| Trade Workflows | `src/coordinators/trade-workflows/` | `confirmPlan` |
| Trade Views and Reporting | `src/coordinators/trade-views/` | `browseTrades` (Planned), `getTradeDetail` (Planned) |
| Workspace | `src/coordinators/workspace/` | `initialize`, `getStatus`, `requestDurability`; Installed Capability Manifest |
| Persistence/Transaction (internal) | `src/persistence/` | root inspection, Workspace creation and pointer, snapshot reads, semantic commit, write gate |
| Delivery (browser-host seams) | `src/delivery/` | readiness checks, host port, release identity, update controller, capacity basis |
| Service worker | `src/sw/` | staging, verification, offline serving, deferred activation |
| Composition root | `src/app/compose.ts` | `createApplication({ indexedDB, host, clock, ids })`: the single facade used by both the UI and the Node integration tests |
| UI | `src/ui/` | shell, readiness views, onboarding, Accounts, Plan form, Planned list, Trade Detail, About |

The UI calls only the application facade, which exposes exactly the public operations in the Installed Capability Manifest. Nothing in `src/ui/` imports from `src/modules/`, `src/persistence/`, or `src/domain/trade-analysis/` (enforced by A17).

---

## 3. Task graph

Kind: **B** = behavioral (TDD, red→green per case), **S** = structural (exact verification).

| Task | Title | Layer | Kind | Blocked by | Public seam under test |
|---|---|---|---|---|---|
| T1.1 | Toolchain and repository scaffold | infrastructure | S | — | `npm` scripts |
| T1.2 | Engine capability smoke (Chromium; Firefox and WebKit in RC) | test | S | T1.1 | Playwright probe page |
| T1.3 | Release build: Web App Manifest, Offline Release Inventory, release identity | infrastructure | S | T1.1 | build output and `verify:release` |
| T1.4 | Dependency-direction, purity, and no-identity rules | infrastructure | S | T1.1 | `lint:deps` |
| T1.5 | Exact decimal values | domain | B | T1.1 | `src/domain/values` exports |
| T1.6 | Clock and Workspace time zone | domain | B | T1.1 | `src/domain/time` exports |
| T1.7 | Persistence core: root, Workspace database, snapshot reads, semantic commit, early-auto-commit guard | persistence | B | T1.1 | internal `Persistence` interface |
| T1.8 | Service worker: staging, verification, offline serving, deferred activation | infrastructure | B | T1.3 | `src/sw` handler exports |
| T1.9 | Runtime Readiness evaluation and session state | application/infrastructure | B | T1.7 | `evaluateReadiness`, `ReadinessSession` |
| T1.10 | Persistence write gate and `RuntimeNotWritable` | persistence | B | T1.7, T1.9 | `Persistence.commit`, mutation guard |
| T1.11 | Reference Catalog (D1 subset) | domain/persistence | B | T1.7 | `ReferenceCatalog` |
| T1.12 | Journal (D1 subset) | domain/persistence | B | T1.7 | `Journal` |
| T1.13 | Trade Analysis: `assessPlan` (Long Stock), `derive` (Planned) | domain | B | T1.5 | `TradeAnalysis` |
| T1.14 | Trade Record (D1 subset) | domain/persistence | B | T1.7, T1.13 | `TradeRecord` |
| T1.15 | Workspace: `initialize`, `getStatus`, `requestDurability`, Installed Capability Manifest | application | B | T1.6, T1.9, T1.10, T1.11, T1.12 | `Workspace` |
| T1.16 | Trade Workflows: `confirmPlan` | application | B | T1.10–T1.14 | `TradeWorkflows.confirmPlan` |
| T1.17 | Trade Views: `browseTrades`, `getTradeDetail` (Planned) | application | B | T1.11–T1.14 | `TradeViewsAndReporting` |
| T1.18 | Composition root and capability registry | application | S | T1.15–T1.17 | `createApplication`, `verify:capabilities` |
| T1.19 | Capacity basis measurement and guard | test/infrastructure | S | T1.2, T1.12, T1.14, T1.18 | `measure:capacity`, `verify:capacity` |
| T1.20 | UI shell: readiness gate views, protection warning, responsive navigation | UI | B | T1.18 | React components with a facade test double |
| T1.21 | UI: update notice and deferred activation | UI | B | T1.8, T1.20 | `UpdateNotice`, `ReleaseUpdateController` |
| T1.22 | UI: first-run time zone, Institution and Account onboarding, Accounts page | UI | B | T1.20 | onboarding and Accounts components |
| T1.23 | UI: Long Stock Plan form and confirmation | UI | B | T1.20, T1.22 | `PlanForm` |
| T1.24 | UI: Planned Trade list and Trade Detail | UI | B | T1.20 | `TradeList`, `TradeDetail` |
| T1.25 | UI: About this release | UI | B | T1.20 | `AboutView` |
| T1.26 | Release harness: synthetic second release, corrupt release, harness server | test | S | T1.3, T1.8 | `build:releases`, `serve:releases` |
| T1.27 | Fault-injection build | test | S | T1.9 | `build:faults`, `verify:no-fault-hooks` |
| T1.28 | Node mock-free integration suite | test | S | T1.18 | `test:integration` |
| T1.29 | Browser integration suite (Chromium) | test | S | T1.19–T1.27 | `test:e2e` |
| T1.30 | Independent browser-critic gate | test | S | all | fresh critic report |

**Parallel tracks** (from the plan's parallelism note): once T1.7 lands and the command and result shapes are fixed in T1.18's type module, T1.11–T1.17 run in parallel with T1.20–T1.25 (against the facade test double). The delivery track (T1.3, T1.8, T1.9, T1.21, T1.26) is independent of the domain track until T1.10 joins them.

---

## 4. Behavioral tasks

Every case runs **red → green** individually, as the kickoff prompt requires. A case that passes on its first run, or fails for a syntax, configuration, fixture, or unrelated reason, is not valid red evidence. It must be fixed (for example by correcting the test so it targets the absent behavior) and rerun to a genuine red, never logged and skipped. Unit tests may use test doubles for a task's dependencies; persistence-backed unit tests use `fake-indexeddb`.

### T1.5 Exact decimal values

Seam: `parseDecimal`, `Rational` operations, and `formatDecimal` exported from `src/domain/values`.

```text
describe("parsing finite decimal input")
  it should parse "100", "50.25", and "0.000001" into exact rationals equal to 100, 5025/100, and 1/1000000
  it should normalize "50.250" and "050.25" to the stored string "50.25"
  it should reject "", "1e3", "NaN", "Infinity", "+5", "1,000", and a 7th fractional digit, each with a typed InvalidDecimal reason
  it should reject zero and negative values where the caller requests a positive decimal, with a typed NotPositive reason

describe("rational arithmetic")
  it should add 0.1 and 0.2 to exactly 0.3
  it should return exactly 1 for (1/3) × 3
  it should compare and order rationals with different denominators correctly, including equality
  it should throw a typed DivisionByZero programming error when dividing by zero

describe("presentation formatting")
  it should format 1/3 dollar as "$0.33" and 2/3 as "$0.67" (half away from zero) without changing the exact value
  it should format negative Money with a leading minus and the dollar sign ("−$12.50")
```

### T1.6 Clock and Workspace time zone

Seam: `Clock`, `validateTimeZone`, `toWorkspaceLocal`, `fromWorkspaceLocal`, exported from `src/domain/time`.

```text
describe("injected clock")
  it should return exactly the instant supplied by a fixed test clock on every call

describe("time-zone validation")
  it should accept "America/New_York" and "Europe/London" and return their canonical identifiers
  it should reject "Mars/Base" and "" with a typed InvalidTimeZone reason

describe("instant and Workspace-local conversion")
  it should render 2026-03-09T14:30:00Z as 2026-03-09 10:30 in America/New_York (after the DST change)
  it should convert local 2026-10-12 09:00 in America/New_York to 2026-10-12T13:00:00Z
  it should reject local 2026-03-08 02:30 in America/New_York with a typed NonexistentLocalTime reason
  it should reject local 2026-11-01 01:30 in America/New_York with a typed AmbiguousLocalTime reason
```

### T1.7 Persistence core

Seam: the internal `Persistence` interface (`inspectRoot`, `createWorkspace`, `readSnapshot`, `commit`), run against `fake-indexeddb`.

```text
describe("root inspection")
  it should report NoWorkspace when the root database is created fresh and holds no pointer
  it should report KnownWorkspace with database name and schema version when the pointer names a database that opens at a supported version
  it should report Unreadable(PossibleRoot) when tj-root exists at a newer version, without upgrading, deleting, or writing to it
  it should report Unreadable(KnownRoot) when the pointer names a database that does not exist, aborting the upgrade so no empty database is created
  it should report Invalid when the Workspace meta record is missing or names an unknown schema version
  it should delete an orphaned candidate database (candidate prefix, not named by the pointer) and list it in the inspection receipt

describe("workspace creation")
  it should make a new Workspace visible only through the final pointer write, so a reader sees no Workspace or the complete one
  it should report AlreadyInitialized and leave the existing pointer unchanged when a second initializer's pointer add fails with ConstraintError

describe("semantic commit")
  it should apply a write set spanning several stores in one readwrite transaction and increment the Workspace content revision exactly once
  it should write nothing and leave the content revision unchanged when a binding check fails, returning a typed Conflict that names the stale binding
  it should leave every earlier write absent when the last write in the set fails with ConstraintError
  it should open write transactions with durability "strict"
  it should reject with EarlyAutoCommitGuard and write nothing when a binding check returns a promise instead of completing synchronously
  it should return the committed content revision and the new revision of every written record

describe("snapshot reads")
  it should read several stores in one readonly transaction and report the single content revision observed, even when a commit races with the read
```

### T1.8 Service worker

Seam: `stageRelease`, `serveRequest`, `handleActivate`, and `handleMessage` exported from `src/sw/`, unit-tested with an in-memory `CacheStorage` and `fetch` double. Real-browser behavior is proven in T1.29.

```text
describe("release staging")
  it should fetch every inventory asset with cache "reload", verify each SHA-256 digest, and write the release cache only after all match
  it should fail installation and leave no release cache when any asset is missing or its digest differs
  it should fail installation when the embedded release identity does not equal the hash of the inventory's digest list

describe("offline serving")
  it should answer a navigation request with the release's cached index document without calling fetch
  it should answer an inventory asset only from its own release cache, never another release's
  it should not cache any response outside the inventory

describe("activation")
  it should not call skipWaiting at install while an earlier release cache exists
  it should claim uncontrolled clients at first activation when no earlier release cache exists
  it should call skipWaiting only after receiving an ApplyUpdate message
  it should delete earlier release caches only during its own activation
  it should reply to a ReleaseIdentity message with its release identity
```

### T1.9 Runtime Readiness evaluation and session state

Seam: `evaluateReadiness({ host, rootInspection, capacityRequirement, pageReleaseId })` and `ReadinessSession`. The host port provides the IndexedDB factory, `storage.estimate`, `storage.persisted`, the service-worker controller query, and `CacheStorage`. Unit tests use a host double; T1.29 proves the real host.

```text
describe("diagnostic transaction check")
  it should write, read back, and delete a probe in tj-root.diagnostics in one transaction and pass, leaving the store empty and no Workspace store touched
  it should fail with the failing step named when the probe write, read-back comparison, or delete fails

describe("capacity check")
  it should pass when quota ≥ the requirement and record quota, usage, available, M, and the requirement as evidence
  it should fail when quota < the requirement
  it should fail with reason EstimateUnavailable when storage.estimate is absent or rejects

describe("service-worker control check")
  it should pass when the controller reports the page's release identity
  it should fail when there is no controller after the first-claim wait, or when the controller reports a different release identity

describe("inventory check")
  it should pass when every inventory asset is cached and its recomputed digest matches
  it should fail and name each asset that is missing or whose digest differs

describe("outcome classification")
  it should return Writable when all four checks pass
  it should return Unsupported with every failed check when the root inspection reports NoWorkspace
  it should return RecoveryOnly with every failed check when a readable Workspace exists
  it should return Unsupported with Workspace status IntegrityBlocked when the root is Unreadable, whatever the other checks report
  it should report all failed checks when two or more fail at once, never only the first

describe("storage protection is advisory")
  it should report Protected, BestEffort, or Unavailable from storage.persisted and remain Writable when protection is BestEffort or Unavailable

describe("session readiness")
  it should move the session from Writable to RecoveryOnly immediately when a storage failure is reported and the Workspace is still readable
  it should replace the session state with a fresh evaluation when recheck is called
```

### T1.10 Persistence write gate and `RuntimeNotWritable`

Seam: `Persistence.commit` and the facade's mutation guard (`guardMutation`), which every authoritative mutation uses.

```text
describe("persistence-level gate")
  it should return RuntimeNotWritable before opening any write transaction when the session is RecoveryOnly, carrying readiness, every failed check, Workspace status RecoveryOnly, and safe actions
  it should return RuntimeNotWritable with Workspace status IntegrityBlocked or None when the session is Unsupported
  it should leave the content revision and every store unchanged on the RuntimeNotWritable path

describe("mutation-boundary recheck")
  it should re-run readiness before each authoritative mutation and return RuntimeNotWritable without calling the mutation when the recheck fails
  it should downgrade the session and return RuntimeNotWritable when a commit fails with a storage error and the re-evaluated readiness is no longer Writable
  it should return a typed StorageFailure, not RuntimeNotWritable, when a commit fails with a storage error but readiness still passes
  it should not apply the gate to requestDurability
```

### T1.11 Reference Catalog (D1 subset)

Seam: `ReferenceCatalog`.

```text
describe("seedDefaults")
  it should create exactly one Strategy, Long Stock, under product key strategy.long-stock with one long Stock role, origin Seeded, and return the snapshot, the additions, and a selectable-Account count of 0
  it should add nothing and keep the snapshot revision when run again with the same manifest
  it should return SeedConflict and write nothing when the manifest declares strategy.long-stock with a different shape

describe("save: create Institution")
  it should create an Institution with a stable identity and revision 1 and return the complete record and new Catalog snapshot
  it should reject a blank label with a typed LabelRequired issue
  it should reject a label that normalizes (case, surrounding and repeated spaces) to an existing Institution label with LabelNotDistinguishable

describe("save: create Account")
  it should create an Account under a selectable Institution with that immutable parent and return the record, snapshot, and selectable-Account count 1
  it should reject an unknown Institution identity with UnknownReference
  it should reject a duplicate Account label under the same Institution and accept the same label under a different Institution

describe("query")
  it should list selectable Institutions, Accounts, and Strategies ordered by normalized label then identity, in pages bound to the Catalog snapshot
  it should reject a cursor with CursorExpired after any Catalog change

describe("resolve")
  it should resolve a selectable Account and Strategy as NewSelection with record revisions and the Account's Institution
  it should return every issue at once when an identity is unknown or of the wrong kind
  it should resolve DisplayOnly to the current label without granting selection eligibility
```

### T1.12 Journal (D1 subset)

Seam: `Journal`.

```text
describe("seedDefaults")
  it should create only the Plan Reflection Entry Type, its definition revision 1, and the Plan Confirmation Source under stable product keys
  it should match the contract exactly: four prompts in order ("Why this trade, why now?" required Text, Thesis role; "What would invalidate the thesis?" required Text, Invalidation role; "Conviction" optional Scale 1–5; "Primary emotion" optional Single Select with Calm, Eager, Anxious, FOMO, Revenge, Relieved, Frustrated, Other in that order)
  it should add nothing when run again with the same manifest
  it should return SeedConflict and write nothing when the manifest declares the Plan Reflection key with an incompatible definition

describe("getDefinitions")
  it should return the latest Plan Reflection definition with stable Prompt and Option identities
  it should return an exact retained revision by identity and NotFound for an unknown revision

describe("prepareEffects: completed Plan Reflection")
  it should prepare an Entry with the definition-revision snapshot, a Trade Anchor to the candidate Trade, Source Plan Confirmation, Plan origin, moment time equal to the Plan Economic Time, and authored time from the clock
  it should return the Thesis and Invalidation answers by semantic role
  it should store an unanswered optional prompt as Unanswered, never as declined
  it should return RequiredAnswerMissing for each blank required prompt, all at once
  it should reject a Conviction outside 1–5 or non-integer with InvalidScaleValue and an unknown option with UnknownOption
  it should reject an unknown prompt with UnknownPrompt and a non-current definition revision with DefinitionRevisionMismatch
  it should reject Defer or Decline for Plan Reflection with DispositionNotAllowed
  it should write nothing (Journal revision unchanged)

describe("applyPreparedEffects")
  it should stage the Entry inside the shared transaction with candidate references mapped to Trade Record's durable identities and return the staged projection
  it should refuse to run outside a semantic transaction
  it should fail the transaction when a Plan Reflection already exists for the same obligation key

describe("query: Trade narrative")
  it should return the Trade's Entries with their snapshot labels, ordered by moment time then identity, and an empty page for a Trade with none
```

### T1.13 Trade Analysis: `assessPlan` (Long Stock) and `derive` (Planned)

Seam: `TradeAnalysis.assessPlan` and `TradeAnalysis.derive` (pure).

```text
describe("assessPlan: Long Stock")
  it should accept 100 shares at intended entry 50.00, Stop 47.50, Target 56.00 with Original Planned Risk $250, Original Planned Reward $600, ratio 12/5, 1R $250, and per-condition basis
  it should compute exactly for fractional inputs (3.5 shares, entry 10.10, Stop 9.95: risk $0.525)
  it should reject a Stop at or above intended entry with NoPositiveRisk
  it should reject a Target at or below intended entry with TargetNotBeyondEntry
  it should reject a missing Stop with MissingStop and a missing Target with MissingTarget
  it should reject zero legs, two legs, a short leg, or a non-Stock Instrument with StrategyShapeMismatch
  it should reject a leg whose symbol differs from the Plan's underlying with UnderlyingMismatch
  it should reject a leg with no Stock symbol, or one that fails the symbol format, with MissingInstrument
  it should return every issue at once rather than the first

describe("derive: Planned")
  it should derive expected lifecycle Planned, agreement Agrees with stored Planned, no Positions, and the frozen Plan Baseline and 1R for a record with no position-changing facts
  it should report a structured LifecycleDisagreement finding, without changing anything, when the supplied stored lifecycle is Open but no exposure facts exist
  it should return deep-equal results for identical inputs
```

### T1.14 Trade Record (D1 subset)

Seam: `TradeRecord`.

```text
describe("prepareChange: ConfirmPlan")
  it should build a candidate Trade with a Plan fact, one Planned Leg fact, and Stop and Target condition facts, each a candidate fact identity holding a single-version list
  it should assign Recorded Sequence in submitted order and stored lifecycle Planned, and return the candidate AnalysisInput plus a canonical digest
  it should write nothing and assign no durable identity
  it should reject a change with no Planned Leg with a typed IncoherentChange

describe("applyPreparedChange")
  it should reject a reconciliation whose candidate digest or expected lifecycle does not match the prepared change
  it should assign durable identities, stage the Trade document and its lifecycle-index membership, and return the identity mapping and staged projection
  it should refuse to run outside a semantic transaction

describe("getRecord")
  it should return Summary or AnalysisInput at its FactRevision, and NotFound for an unknown Trade

describe("queryRecords: CurrentState")
  it should select Planned Trades from the lifecycle index, ordered by Plan Time descending then Trade identity
  it should return AnalysisInput for a whole page from one read snapshot
  it should reject a cursor with CursorExpired after any Trade commit
```

### T1.15 Workspace

Seam: `Workspace`.

```text
describe("initialize")
  it should return TimeZoneSelectionRequired and write nothing when readiness is Writable, no Workspace exists, and no zone is supplied
  it should create metadata with the zone (settings revision 1), seed Catalog and Journal in the same transaction, and return Opened with onboarding NeedsInstitutionAndAccount and a receipt naming the readiness evidence, fresh status, and seed versions and additions
  it should reject an invalid zone with InvalidTimeZone and write nothing
  it should return Opened(existing) with a receipt showing no seed additions when the Workspace already exists
  it should return RuntimeNotWritable with Workspace status RecoveryOnly when a readable Workspace exists and readiness fails
  it should return RuntimeNotWritable with readiness Unsupported, Workspace status None, and every failed check when no Workspace exists and readiness fails, writing nothing
  it should return RuntimeNotWritable with Workspace status IntegrityBlocked and never initialize when the root is unreadable
  it should return IntegrityBlocked with recovery actions when readiness is Writable but stored contents fail validation

describe("getStatus")
  it should return Ready only when readiness is Writable and the Workspace is valid, with the snapshot binding, time zone, Installed Capability Manifest, onboarding, per-check evidence, protection, schema version, and latest receipt
  it should return InitializationRequired, RecoveryOnly, Unsupported, or IntegrityBlocked for the corresponding inspection and readiness combinations
  it should report onboarding NeedsInstitutionAndAccount until a selectable Account exists, then ReadyForTradePlanning
  it should leave the content revision unchanged

describe("requestDurability")
  it should return Improved when persist() succeeds after persisted() was false
  it should return AlreadyProtected when persisted() is already true
  it should return NotImproved(BestEffort) when persist() resolves false and NotImproved(Unavailable) when the API is absent
  it should never change Runtime Readiness

describe("Installed Capability Manifest")
  it should list exactly D1's public operations and variants, the Long Stock Strategy, the Plan Reflection Entry Type, no backup schema range, and no provider adapters, bound to the release identity
```

### T1.16 Trade Workflows: `confirmPlan`

Seam: `TradeWorkflows.confirmPlan`.

```text
describe("confirmPlan: accepted")
  it should commit the Trade, its facts, Planned lifecycle-index membership, and the Plan Reflection Entry in one semantic commit
  it should return TradeMutationSuccess: Trade identity and FactRevision, created fact identities, the lifecycle transition to Planned, the Entry identity, the post-commit Trade projection, its derivation with Plan Baseline and 1R, the Entry projection, and the affected Planned-list scope
  it should store Thesis and Invalidation in the Plan facts equal to the Entry's answers, entered once
  it should store the trader-supplied Economic Time on the Plan fact and as the Entry's moment time

describe("confirmPlan: rejected")
  it should aggregate Catalog, Journal, and Trade Analysis issues into one typed rejection
  it should reject a future Economic Time with EconomicTimeInFuture
  it should reject an unknown Account or Strategy with typed reference issues
  it should leave the Trade Record, Journal, Catalog, and Workspace content revisions unchanged on every rejection
  it should return Conflict and write nothing when a referenced record's revision changed after the form was loaded
  it should return RuntimeNotWritable and write nothing when the mutation-boundary readiness recheck fails
```

### T1.17 Trade Views and Reporting (Planned)

Seam: `TradeViewsAndReporting.browseTrades` and `getTradeDetail`.

```text
describe("browseTrades: Planned")
  it should return a Ready page with, per Trade, underlying, current Strategy, Account and Institution labels, Plan time, 1R, Original Planned Reward, planned ratio, and "Awaiting entry", ordered by Plan time descending
  it should return a Ready page with no items when there are no Planned Trades
  it should bind the Trade, Journal, and Catalog revisions it read from one snapshot
  it should return pages of 50 with a next cursor and accept that cursor until the next commit

describe("getTradeDetail: Planned")
  it should return the Plan (underlying, leg, quantity, intended entry, Stop, Target, Thesis, Invalidation, Plan time), stored lifecycle Planned with agreement, Plan Baseline with per-condition basis, 1R, labels, and the Plan Reflection with snapshot prompt labels
  it should return NotFound for an unknown Trade identity
  it should bind every revision it read from one snapshot even when a commit races with the read
```

### T1.20 UI shell

Seam: `AppShell` rendered with `jsdom` and a facade test double.

```text
describe("readiness gate presentation")
  it should show startup verification with no navigation and no mutating control while readiness is pending
  it should render Unsupported naming every failed check in plain language, with Retry and a recommendation to try another browser, and no initialization control
  it should render Recovery Only with one clear reason, the failed checks, read-only navigation (Trades, Accounts, About), no New Plan or Add Account control, and the separate-storage explanation (A13)
  it should render Integrity Blocked with a warning that journal data may exist, Retry as the only action, and no initialization or data navigation
  it should switch to Recovery Only when a mutation returns RuntimeNotWritable, keeping the open form's entered values on screen

describe("storage-protection warning")
  it should keep a warning that the browser may clear data visible while protection is BestEffort or Unavailable, with every control enabled
  it should offer "Ask the browser to keep data" only when the host supports storage.persist, and show the honest result after it is pressed

describe("responsive navigation")
  it should render bottom navigation below 960 px and a left sidebar at or above it
  it should switch layout on a live resize without remounting the active route or losing entered form values
  it should list only destinations whose capabilities are in the Installed Capability Manifest
```

### T1.21 UI: update notice and deferred activation

Seam: `ReleaseUpdateController` (with a service-worker registration double and a `BroadcastChannel` double) and `UpdateNotice`.

```text
describe("update availability")
  it should show no notice until a new release is waiting (installed and verified)
  it should show "An update is ready" with a Reload action when a release is waiting and no form in any tab is unsaved

describe("deferral while work is unsaved")
  it should disable Reload and explain that the update waits for the open form to be saved or cancelled when this tab has an unsaved form
  it should disable Reload and explain that another tab has unsaved work when another tab reports one
  it should enable Reload once every form is saved or cancelled

describe("activation")
  it should post ApplyUpdate to the waiting worker and reload exactly once on controllerchange
  it should reload a tab with no unsaved form on controllerchange caused by another tab
  it should keep a tab's unsaved form on screen and show "Updated in another tab: reload when ready" when controllerchange arrives while that form is unsaved
```

### T1.22 UI: onboarding and Accounts

Seam: `FirstRun`, `OnboardingAccount`, and `AccountsView` with a facade test double.

```text
describe("first-run time zone")
  it should propose the browser-resolved zone and allow choosing any supported zone before calling initialize
  it should show InvalidTimeZone as a field error and make no other call

describe("Institution and Account onboarding")
  it should require an Institution and Account when onboarding is NeedsInstitutionAndAccount and show no New Plan action
  it should create the Institution then the Account and, from the returned onboarding state alone, show the Trades empty state with a New Plan action
  it should show each typed issue (LabelRequired, LabelNotDistinguishable) next to its field and move focus to the first one

describe("Accounts page")
  it should list Institutions with their Accounts and offer Add Institution and Add Account only while Writable
```

### T1.23 UI: Long Stock Plan form

Seam: `PlanForm` with a facade test double.

```text
describe("rendering")
  it should offer only selectable Accounts and the Long Stock Strategy
  it should render Plan Reflection prompts from the loaded definition revision, with Primary emotion as a radio group inside a labelled fieldset and Conviction as a 1–5 radio group
  it should default Plan time to now in the Workspace zone

describe("submission")
  it should submit stable Prompt and Option identities, the rendered definition revision, record revisions of the chosen references, and the entered Economic Time
  it should show every rejection issue beside its field, list them in a summary, and move focus to the summary
  it should render the confirmed Plan from the returned post-commit state, without a read call, and navigate to its Trade Detail
  it should make no call when the form is cancelled or left
  it should register as unsaved while any value differs from its initial value
```

### T1.24 UI: Planned list and Trade Detail

Seam: `TradeList` and `TradeDetail` with a facade test double.

```text
describe("Planned list")
  it should render distinct Loading, Ready, Empty (with a New Plan action), and Error (with Retry) states
  it should show underlying, Strategy, Account, Plan time in the Workspace zone, 1R, Original Planned Reward, and ratio, right-aligned with tabular numerals and units

describe("Trade Detail")
  it should show the Plan, Planned Leg, Stop, Target, Plan Baseline, 1R, the "Planned" lifecycle as text (not only colour), and the Plan Reflection with its snapshot prompt labels
  it should render NotFound and Error states distinctly
```

### T1.25 UI: About this release

Seam: `AboutView` with a facade test double.

```text
describe("About this release")
  it should show the application name, Web App Manifest id, release identity, inventory asset count, per-check readiness evidence including the capacity figures, storage protection, Workspace time zone, and the Installed Capability Manifest
  it should call registration.update when "Check for updates" is pressed and report "No update" or show the update notice
```

---

## 5. Structural tasks

| Task | Verification (exact) | Expected result | Behavior that depends on it |
|---|---|---|---|
| T1.1 Toolchain | `npm ci && npm run typecheck && npm run lint && npm run test:unit && npm run build && npm run preview -- --strictPort` | All commands exit 0; `vite preview` listens on 5175 and fails rather than choosing another port if 5175 is busy. | Every later task. |
| T1.2 Engine capability smoke | `npx playwright test e2e/smoke/engine-capabilities.spec.ts --project=chromium` | On `http://localhost:5175` in Chromium: `isSecureContext`, service-worker registration and control, `CacheStorage`, IndexedDB, `storage.estimate`, `storage.persisted`, `BroadcastChannel`, `crypto.subtle`, persistent-context stop and restart, offline relaunch, and SIGKILL of the browser process are all available. Engine and OS versions are written to `evidence/D01/provenance.md`. **Any false value stops work** for a discussion before T1.8 begins. The same spec runs in Firefox and WebKit as part of RC. | All browser evidence. |
| T1.3 Release build | `npm run build && npm run verify:release` | `dist/manifest.webmanifest` has `id`, `name`, `short_name`, 192 and 512 icons, `start_url`, `scope`, and `display: "browser"`. `dist/inventory.json` lists every file in `dist/` except `sw.js` with SHA-256 digests that `verify:release` recomputes and matches. The release identity equals the hash of the sorted digest list and is embedded identically in `sw.js` and the app bundle. | T1.8, T1.9, T1.21. |
| T1.4 Dependency rules | `npm run lint:deps`, then the same command on the committed violation fixtures in `tools/dep-fixtures/` | The project passes. Each fixture (UI importing a module, a domain file using `Date.now`, a file reading `navigator.userAgent`) fails with its named rule. | Dependency direction, analysis purity, no identity allowlist (AC-DEL-003, AC-DEL-004). |
| T1.18 Composition root and capability registry | `npm run verify:capabilities` | The Installed Capability Manifest generated from the registry equals the facade's exported operations and the route map's required capabilities. No route requires an absent capability; no manifest entry lacks a reachable route or workflow. | AC-CAP-001. |
| T1.19 Capacity basis | `npm run measure:capacity` (Playwright, Chromium; RC adds Firefox and WebKit), then `npm run verify:capacity` | `measure:capacity` loads 500 deterministic Plans through the production application facade in the browser and records the `estimate().usage` delta per Trade with its Plan Reflection, the JSON-to-disk overhead ratio, and engine versions in `src/delivery/capacity-basis.json`. When several engines have been measured, the largest projection is used. `verify:capacity` checks that the embedded requirement equals `3 × M` computed from that file and the profile in 1.3, and that the file's schema version equals the current schema version (so a later schema change fails the build until the basis is recomputed). | The capacity readiness check (AC-DEL-004). |
| T1.26 Release harness | `npm run build:releases && npm run verify:releases` | Builds `dist-releases/v1`, `v2` (differs only by a build label, so its identity differs), and `v2-corrupt` (one asset altered after the build, inventory unchanged). `verify:releases` confirms that v1 and v2 each pass `verify:release` and that v2-corrupt fails on exactly the altered asset. | AC-DEL-002 browser evidence and critic flow C1.8. |
| T1.27 Fault-injection build | `npm run build:faults && npm run verify:no-fault-hooks` | `dist-faults/` fails any subset of the four readiness checks (`diagnostic`, `capacity`, `control`, `inventory`) at the host-port boundary. The subset comes from a `?faults=` list at launch, and a test-build-only `window.__tjFaults.set([...])` changes it mid-session. `verify:no-fault-hooks` confirms the production `dist/` contains neither the fault-hook marker string nor `__tjFaults`. | Every readiness failure case in the routine browser suite (AC-DEL-004, AC-DEL-005, AC-DEL-006). |
| T1.28 Node integration suite | `npm run test:integration` | Every case in section 6.1 passes. | Cumulative regression. |
| T1.29 Browser integration suite | `npm run test:e2e` (Chromium) | Every case in section 6.2 passes. | Cumulative regression. |
| T1.30 Browser critic | Fresh critic agent per section 7 | A structured report with every flow passing. | Deliverable gate. |

---

## 6. Mock-free integration tests

### 6.0 Disclosed test substitutes

| Substitute | Used in | Replaces | Why it does not weaken the contract |
|---|---|---|---|
| `fake-indexeddb` | Node suite (6.1) | browser-owned IndexedDB | Implements the IndexedDB API and transaction semantics. Every case also runs against real IndexedDB in 6.2. |
| `NodeTestHost` | Node suite (6.1) | service-worker controller, `CacheStorage`, `storage.estimate`, `storage.persisted` | Node has none of these. It is an in-memory implementation that reports readiness inputs and can be told to fail a check. The real browser host is exercised in 6.2 (Chromium) and, with real failure states, in RC. |
| Fixed clock and seeded identity generator | Node suite; Playwright `page.clock` in the browser suite | system clock, `crypto.randomUUID` | In Node they are injected through the same composition root as production. In the browser the production build runs unchanged under Playwright's clock control. |
| Release harness server (A15) | 6.2 update cases and critic C1.8 | Cloudflare Pages static hosting | Serves the unmodified built folders with production-equivalent caching headers. |
| Fault-injection build (P2) | 6.2 cases marked *faults build* | real failure of each of the four readiness checks | Faults act only at the host-port boundary. Everything above it (readiness classification, gate, views, mutation results) is production code, and the production bundle provably contains no hooks. RC proves the same cases with real browser state in all three engines. |
| Chromium as the only routine engine (P2) | all of 6.2 | Firefox and WebKit | Readiness uses only functional checks, so the decision logic is engine-independent. Engine-specific host behavior is proven by RC before the first publish. |
| Read-only IndexedDB probe | 6.2 durable-state assertions | — | Test code reads raw stores through `page.evaluate` to prove durable state. It never writes authoritative data. |

### 6.1 Node application-stack suite (`tests/integration/d1/`)

Each case builds the application with `createApplication({ indexedDB: fakeIndexedDB, host: NodeTestHost, clock, ids })` and calls only facade operations. "Restart" means closing every connection and building a new application on the same `fake-indexeddb` factory. "Unchanged" means a full dump of every store in `tj-root` and the Workspace database compared before and after.

| Case | Given / When | Then (visible result and durable-state proof) |
|---|---|---|
| I1.1 Fresh initialization | Writable host, empty factory. `getStatus`, `initialize(zone)`, restart, `getStatus`. | InitializationRequired, then Opened with NeedsInstitutionAndAccount. After restart: Ready, same zone, Long Stock and Plan Reflection seeded once; seed receipt shows no additions on the second launch. |
| I1.2 Onboarding | After I1.1: create Institution, create Account, restart. | Each response's record equals the record read by `query` after restart at the returned revision; onboarding is ReadyForTradePlanning. |
| I1.3 Confirm a Plan | After I1.2: `confirmPlan` with a complete Long Stock Plan, restart, `getTradeDetail`, `browseTrades`. | The response's Trade, derivation, and Entry equal the post-restart Detail (AC-RESP-001). The store dump shows one Trade document with fact identities each holding one version, Planned in the lifecycle index, one Entry referencing definition revision 1, and the Workspace content revision incremented once. |
| I1.4 Rejection writes nothing | Confirm with Stop above entry, blank Thesis, and a two-leg shape. | One rejection listing all three issues; store dumps unchanged. |
| I1.5 Atomic commit | A write set spanning `trades`, `journalEntries`, and `meta` whose last write fails with a real `ConstraintError`. Separately, assert that `confirmPlan`'s commit receipt names all three stores in one transaction. | No store changes in the failing case. |
| I1.6 Write gate at both boundaries | Host told to fail the inventory check. Call `initialize`, both Catalog creates, and `confirmPlan` through the facade, then `Persistence.commit` directly. | Each returns `RuntimeNotWritable` (RecoveryOnly, failed check named, safe actions); store dumps unchanged. |
| I1.7 Readiness failures before a Workspace exists | Empty factory; each check failed singly, then two together. | `getStatus` is Unsupported listing exactly the failed checks; `initialize` returns `RuntimeNotWritable`; the Workspace database does not exist and the diagnostics store is empty. |
| I1.8 Integrity Blocked | (a) `tj-root` created at version 99 by the test; (b) pointer naming a missing database; (c) meta record with an unknown schema version. | (a) and (b): `getStatus` IntegrityBlocked with readiness Unsupported; `initialize` never creates a Workspace; the root's version and contents are unchanged. (c): readiness Writable, `initialize` returns IntegrityBlocked with recovery actions. |
| I1.9 Concurrent first run | Two applications on one factory call `initialize` at once. | Exactly one Workspace database and one pointer; both end Opened on the same Workspace. |
| I1.10 Mid-session failure | Writable application; host flips the inventory check to failing; then `confirmPlan`. | `RuntimeNotWritable`; `getStatus` now RecoveryOnly; store dumps unchanged; `browseTrades` and `getTradeDetail` still return Ready. |
| I1.11 Rebuild equivalence | Three confirmed Plans; capture `browseTrades` and each `getTradeDetail`; run `rebuildPrivateState` (drops and recreates every IndexedDB index through the migration path); capture again. | Normalized views are equal; only opaque revision tokens may differ (AC-REBUILD-001). |

### 6.2 Browser suite (`e2e/d1/`, Playwright against the built app on `localhost:5175`)

All cases run in Chromium (P2). Every readiness failure is produced by the faults build (T1.27); Integrity Blocked uses storage fixtures, because an unreadable root is a stored-data condition, not a readiness check. Durable state is proven by reload or full browser restart plus the read-only probe. Engine and OS versions are recorded for every run. RC repeats B1.1, B1.3–B1.6, B1.8, B1.9, and B1.10–B1.13 in all three engines using real browser state instead of the faults build.

| Case | Procedure | Expected observable result and durable-state proof |
|---|---|---|
| B1.1 Identity and Writable tab | Fresh persistent context; open `/`; fetch `/manifest.webmanifest` and `/inventory.json`; repeat with the user agent overridden to an unknown string. | Manifest fields as in T1.3; every inventory digest matches the served bytes; About shows the same release identity; readiness Writable with all four checks passing in both runs (AC-DEL-003). |
| B1.2 Onboarding and first Plan | Complete first run, Institution, Account, and one Plan through the UI. Close the context and relaunch. | Planned list and Detail show the Plan, 1R, and reflection after relaunch; the probe shows one Trade, one Entry, Planned in the index. |
| B1.3 Kill after commit | After the confirmation result renders, SIGKILL the browser process; relaunch. | The Plan is present and complete (no partial Trade without its Entry). |
| B1.4 Offline cold restart | After B1.2, close the context, relaunch with the network disabled. Confirm a second Plan and add an Account. | Writable without network; both workflows succeed and survive another offline restart (AC-DEL-001). |
| B1.5 Unsupported matrix (fresh profile, *faults build*) | Launch with `?faults=` set to each of `diagnostic`, `capacity`, `control`, `inventory` in turn, then `diagnostic,capacity` and `control,inventory`. | Each shows Unsupported naming exactly the failed checks (both in the two-fault cases), Retry, and the another-browser recommendation. No Workspace database exists afterwards and the diagnostics store is empty (probe). |
| B1.6 Recovery Only matrix (existing Workspace, *faults build*) | Starting from a profile where B1.2's flow ran in the faults build with no faults, relaunch with each fault set in B1.5. | Recovery Only with the failed checks; Planned list and Detail readable; no New Plan or Add Account; the probe shows unchanged stores (AC-DEL-005 partial). |
| B1.7 Protection is advisory | Fresh profile; read `navigator.storage.persisted()`. | If false: Writable, the warning visible, the durability action offered where `persist` exists, and a Plan can still be confirmed. The result after pressing the action matches `persisted()` afterwards. |
| B1.8 Integrity Blocked | (a) Before launch, the test creates `tj-root` at version 99; (b) the test deletes the Workspace database while leaving the pointer. | Integrity Blocked with Unsupported readiness; no initialization control; the probe shows the version-99 root and the pointer unchanged and no new Workspace. |
| B1.9 Mid-session failure (*faults build*) | With a Plan form filled in a Writable session, call `window.__tjFaults.set(["inventory"])`, then press Confirm. Repeat with `["diagnostic"]`. | `RuntimeNotWritable` explanation shown, form values kept, shell switches to Recovery Only; the probe shows no new Trade (AC-DEL-006). |
| B1.10 Update with unsaved work | Serve v1; fill a Plan form; switch the harness to v2; trigger an update check. Then cancel the form and press Reload. | The notice appears only after v2 is installed and waiting; v1 still controls the page; Reload is disabled with the reason while the form is unsaved; after cancel and Reload, About shows v2, readiness reruns to Writable, and the probe shows the Workspace unchanged (AC-DEL-002). |
| B1.11 Corrupt update | Serve v1; switch to v2-corrupt; trigger an update check. | No notice; v1 keeps control; no v2 cache exists. |
| B1.12 Offline keeps the installed release | Serve v1; go offline; trigger an update check. | No notice; v1 runs and stays Writable. |
| B1.13 Two tabs, one unsaved | v1 in two tabs, one with an unsaved form; switch to v2. | The clean tab's notice explains that another tab has unsaved work; Reload stays disabled until that form is cancelled. |
| B1.14 Nothing is saved without Save | Open the Plan form, type and select every field, resize, navigate away, restart. | No Entry, Trade, or draft in IndexedDB; `localStorage` and `sessionStorage` contain no entered value (AC-JOUR-001 partial). |
| B1.15 Responsive and accessible | At 1280 px fill half the Plan form; resize to 390 px and back; then run axe on every D1 view state and complete onboarding and a Plan with the keyboard only. | Layout switches at 960 px with route and values intact; axe reports no WCAG 2.1 AA violations; keyboard-only flow completes with visible focus (AC-UI-001, AC-UI-002). |

---

## 7. Browser-critic flows

The critic receives the frozen `specs/`, the plan index, this file, and the list of future capabilities that must not be treated as defects (everything after D1). It runs `npm run build && npm run preview` (port 5175) itself and, for C1.8–C1.10, the release harness (`npm run serve:releases`) and the faults build (`npm run preview:faults`). It uses a fresh browser profile per flow unless the flow continues another. It does not edit code.

| Flow | Actions | Pass condition |
|---|---|---|
| C1.1 First launch | Open `/` in a fresh profile. | Startup verification shows first, without an empty Workspace or controls; then the time-zone step proposes a zone. |
| C1.2 Onboarding | Accept the zone; try a blank Institution; then create an Institution and an Account. | The blank label shows an understandable error; afterwards the Trades empty state offers New Plan. |
| C1.3 Storage protection | Inspect the shell and About. | Protection is reported honestly; if not Protected, the warning is visible, the durability action is offered where supported, and writing still works. |
| C1.4 Confirm a Plan | New Plan with 100 shares, entry 50, Stop 47.50, Target 56, Thesis, Invalidation, Conviction 4, Primary emotion Calm. | Detail shows 1R $250.00, reward $600.00, ratio 2.4, lifecycle "Planned", and the reflection with its prompts; the Planned list shows the row. |
| C1.5 Validation | New Plan with Stop 51 and blank Thesis. | Both issues are shown together, focus moves to them, and nothing appears in the list after a reload. |
| C1.6 Leave without saving | Fill a Plan form, navigate away, reload. | Nothing was saved. |
| C1.7 Offline restart | After C1.4, stop the preview server and reload. | The app opens Writable, the Plan is there, and a second Plan can be confirmed. |
| C1.8 Update | With the harness serving v1, open a Plan form and type; switch the harness to v2; press "Check for updates" in About. | The notice explains the update waits for the form; after cancelling, Reload activates v2 (About shows the new identity) and data is unchanged. |
| C1.9 Recovery Only | In the faults build with no faults, confirm a Plan; then relaunch with `?faults=inventory`. | Recovery Only names the inventory check; the Plan is readable; no New Plan; the separate-storage explanation is present. |
| C1.10 Unsupported and Integrity Blocked | (a) Faults build with `?faults=diagnostic,capacity` in a fresh profile; (b) in a fresh profile, create `tj-root` at version 99 from the console, then reload. | (a) Unsupported naming both checks; (b) Integrity Blocked warning that data may exist, Retry only. |
| C1.11 Responsive, keyboard, About | Resize across 960 px with a half-filled form; complete a Plan by keyboard only; open About. | Values survive resizing; keyboard flow works with visible focus; About lists the release identity and only D1 capabilities, and navigation offers nothing beyond them. |

---

## 8. Acceptance matrix rows

Status values: `planned`, `covered`, `intentionally not advertised`. All D1 rows are `planned` until implementation evidence exists. Every AC-DEL row's browser evidence comes from Chromium and the faults build at the D1 gate (P2). Its Firefox and WebKit evidence, and its real-state readiness evidence, are **pending RC** and are added to the row when RC first runs.

| Scenario | Deliverable | Tasks | TDD / structural | Integration case and fixture | Critic flow | Command or procedure | Expected result and durable-state proof | Failure / nonmutation / restart evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| AC-PLAN-001 (partial: Long Stock) | D1 | T1.12, T1.13, T1.14, T1.16, T1.23 | T1.13 accept cases; T1.16 accepted group | I1.3; B1.2 (Long Stock 100 @ 50 / 47.50 / 56) | C1.4 | `npm run test:integration -- d1/confirm-plan`; `npx playwright test e2e/d1/plan.spec.ts` | One Trade, Plan, Planned Leg, Stop and Target facts, Planned lifecycle, 1R $250 = Original Planned Risk, one Entry referencing definition revision 1 with Thesis and Invalidation shared with the Plan | Restart in I1.3 and B1.2; kill-after-commit B1.3 | planned |
| AC-PLAN-002 (partial: no baseline, D1 shape, missing leg evidence, missing reflection) | D1 | T1.12, T1.13, T1.16, T1.23 | T1.13 reject cases; T1.16 rejected group | I1.4 | C1.5 | `npm run test:integration -- d1/confirm-plan-rejected` | All issues returned together, typed | Full store dumps equal before and after; no identity, Entry, or index entry | planned |
| AC-LIFE-001 (partial: Planned) | D1 | T1.13, T1.14, T1.16 | T1.13 derive group; T1.14 queryRecords | I1.3 | C1.4 | as AC-PLAN-001 | Stored Planned, derived Planned, agreement Agrees, index membership written in the confirmation commit | Restart | planned |
| AC-JOUR-001 (partial: Plan form) | D1 | T1.23 | "make no call when cancelled or left" | B1.14 | C1.6 | `npx playwright test e2e/d1/no-save.spec.ts` | No Entry, version, or draft; no form values in Web Storage | Restart | planned |
| AC-JOUR-007 (partial: Plan Reflection and its Source) | D1 | T1.12, T1.15 | T1.12 seed group | I1.1 | — | `npm run test:integration -- d1/initialize` | Normalized definition manifest equals the contract text exactly | Second launch adds nothing | planned |
| AC-REF-001 (partial: Long Stock only) | D1 | T1.11, T1.15 | T1.11 seed group | I1.1 | — | as above | Exactly one Strategy; no Institution, Account, Custom, or Other seed | Second launch adds nothing | planned |
| AC-DEL-002 (full) | D1 | T1.8, T1.21, T1.26 | T1.8 staging and activation; T1.21 | B1.10–B1.13 (harness v1, v2, v2-corrupt) | C1.8 | `npx playwright test e2e/d1/update.spec.ts` | Notice only after v2 is complete and verified; v1 stays in control; activation only after the form is saved or cancelled; v2 identity after reload; readiness rerun | Corrupt staging leaves v1; offline keeps v1; Workspace store dump unchanged across update | planned |
| AC-DEL-005 (partial: reads and unreadable store; backup in D8) | D1 | T1.9, T1.10, T1.20 | T1.9 classification; T1.20 Recovery Only view | I1.6, I1.8, I1.10; B1.6, B1.8 | C1.9, C1.10 | `npx playwright test e2e/d1/recovery-only.spec.ts e2e/d1/integrity-blocked.spec.ts` | Each failed check → Recovery Only with reads; unreadable root → Integrity Blocked + Unsupported | Mutations return `RuntimeNotWritable`; store dumps unchanged; root bytes preserved | planned |
| AC-DEL-003 (partial: identity, inventory, tab launch, loopback) | D1 | T1.3, T1.4, T1.8, T1.9 | `verify:release`; `lint:deps` no-identity rule | B1.1 | C1.1, C1.11 | `npm run verify:release`; `npx playwright test e2e/d1/identity.spec.ts` | Manifest fields; digests match; Writable in Chromium, including with an unknown user agent | — | planned; Firefox and WebKit **pending RC**; production HTTPS **pending** (decision 4); installation in D28 |
| AC-DEL-004 (cumulative; D1 establishes it) | D1 | T1.9, T1.10, T1.15, T1.19, T1.27 | T1.9 all groups; T1.10 | I1.6, I1.7; B1.5, B1.7 | C1.3, C1.10 | `npx playwright test e2e/d1/readiness.spec.ts` | Per-check pass/fail matrix including simultaneous failures; Writable with unconfirmed protection plus a visible warning; capacity derivation in `capacity-basis.json` | No Workspace database after failure; diagnostics store empty | planned |
| AC-DEL-006 (cumulative) | D1 | T1.9, T1.10, T1.21 | T1.9 session group; T1.10 recheck group | I1.10; B1.9, B1.10 | C1.8 | `npx playwright test e2e/d1/runtime-failure.spec.ts` | Readiness on every launch and after update activation; mid-session failure → Recovery Only | Next mutation rejected; store dump unchanged | planned (after-Restore boundary in D8) |
| AC-DEL-001 (cumulative) | D1 | T1.8, T1.9 | T1.8 serving group | B1.4 | C1.7 | `npx playwright test e2e/d1/offline.spec.ts` | Writable offline after full stop; Plan and Account workflows work | Second offline restart retains both | planned |
| AC-RESP-001 (cumulative) | D1 | T1.11, T1.15, T1.16, T1.22, T1.23 | "return the complete record"; "render … without a read call" | I1.2, I1.3 | C1.4 | `npm run test:integration -- d1/responses` | Responses for initialize, both Catalog creates, and confirmPlan equal durable state at the returned revisions | — | planned |
| AC-CAP-001 (cumulative) | D1 | T1.15, T1.18, T1.20 | `verify:capabilities`; navigation case in T1.20 | B1.1 | C1.11 | `npm run verify:capabilities` | Manifest equals the reachable operations; nothing later is reachable | — | planned |
| AC-UI-001, AC-UI-002 (cumulative) | D1 | T1.20, T1.22–T1.25 | responsive and view-state groups | B1.15 | C1.11 | `npx playwright test e2e/d1/responsive-a11y.spec.ts` | Live switch at 960 px with state kept; distinct states; axe clean; keyboard flow | — | planned |
| AC-REBUILD-001 (cumulative) | D1 | T1.7, T1.17 | — (structural rebuild path) | I1.11 | — | `npm run test:integration -- d1/rebuild` | Equal normalized views after rebuild | — | planned |
| AC-PERF-001 (cumulative) | D1 | — | — | — | — | — | Not applicable in D1; the harness starts in D2 | — | intentionally not advertised in D1 |

---

## 9. Clause-level acceptance check

Each clause of each scenario D1 claims was checked against the tasks and tests above.

| Scenario | Clause | Covered by | Finding |
|---|---|---|---|
| AC-PLAN-001 | selectable Account and Strategy | T1.11 resolve; T1.16 | covered |
| | complete Planned Legs (exact contracts or objective criteria) | T1.13 | Long Stock has an exact Instrument; options in D7, objective criteria in D10 |
| | original Stop/Target management | T1.13, A1 | covered |
| | completed Plan Reflection with required Thesis and Invalidation | T1.12 | covered |
| | calculable positive numeric Plan Baseline | T1.13 | covered |
| | one Trade, frozen Plan, frozen Planned Legs, frozen management, stored Planned, 1R = baseline, one immutable Entry, atomically | T1.16, I1.3, I1.5 | covered. "Frozen" is shown by single-version facts and the absence of any mutation path in D1 |
| | Entry snapshots the exact definition shown and shares Thesis/Invalidation without a second entry | T1.12, T1.16, T1.23, A3 | covered |
| | evidence: receipt, identities, snapshots, lifecycle binding, post-restart query | I1.3, B1.2 | covered |
| AC-PLAN-002 | no numeric baseline | T1.13 NoPositiveRisk | covered |
| | incoherent Strategy shape | T1.13 StrategyShapeMismatch | D1 shape only; multi-leg in D10 |
| | missing exact or objective leg evidence | T1.13 MissingInstrument | exact Stock Instrument covered; objective evidence in D10 |
| | missing required reflection answer | T1.12 | covered |
| | all issues typed, no Trade, candidate identity, Entry, Debt, or index membership | T1.16, I1.4, A11 | covered |
| | unchanged Trade Record, Journal, and Catalog revisions | I1.4 | covered |
| AC-LIFE-001 | Planned, stored and expected agree, index changes in the same commit | T1.13, T1.14, I1.3 | Planned only; Open in D2, Closed in D6 |
| AC-JOUR-001 | open, type, select, resize, navigate, leave → nothing stored, including drafts and keystrokes | T1.23, B1.14, A5 | covered for the Plan form. The update-deferral design (A5) is what guarantees no draft is ever persisted |
| AC-JOUR-007 | seven Entry Types and seven Sources | — | Plan Reflection and Plan Confirmation only (declared partial) |
| | every initial Prompt, option, order, requiredness, scale, and role matches | T1.12 seed group | covered for Plan Reflection |
| | repeat seeding idempotent and does not overwrite revisions | T1.12, I1.1 | idempotence covered; "over trader revisions" in D26 |
| AC-REF-001 | exactly eleven Strategies, five and five reasons, empty IdeaSource | — | Long Stock only (declared partial) |
| | no Account, Institution, Custom, Other, or settlement-as-reason seed | T1.11, I1.1 | covered |
| AC-DEL-002 | new inventory complete and digest-valid before notice | T1.8, B1.10 | covered |
| | current version safe and in control | B1.10 | covered |
| | trader notified | T1.21, B1.10 | covered |
| | activation waits for safe reload/restart | T1.8, T1.21, B1.10, B1.13 | covered, including other tabs |
| | entered state not silently lost | T1.21, B1.10 | covered |
| | update creates no data synchronization | B1.10 store dump | covered |
| | failed staging leaves the prior version | B1.11 | covered |
| | failed **readiness** leaves the prior compatible version available | B1.6 (failure after activation → Recovery Only, data intact) | **Interpretation recorded.** A failed post-activation readiness cannot hand control back to the old service worker. D1 reads this clause together with the delivery contract's "leaves the prior compatible installed release and Workspace uncorrupted and does not report the new release Ready": data stays intact and the app reports Recovery Only, never Ready. Flagged for you to confirm or correct. |
| | offline device retains its version | B1.12 | covered |
| AC-DEL-005 | each readable case → Recovery Only with reads and history | B1.6 | covered (history UI arrives with D15; D1 has no history to show) |
| | backup export and verification available | — | D8 (decision 2) |
| | every mutation and Restore application → `RuntimeNotWritable`, unchanged revisions | I1.6, B1.6 | mutations covered; Restore in D8 |
| | unreadable store → Unsupported + Integrity Blocked, no reads, init, overwrite, mutation, Restore, or backup claim | I1.8, B1.8 | covered |
| | failed export, unverified download, failed verification → no receipt | — | D8 |
| | UI explains another browser has independent storage | T1.20, A13 | covered with D1-honest wording |
| AC-DEL-003 | manifest identity, name, icons, launch URL, scope | T1.3, B1.1 | covered |
| | standalone request; installation; installed launch | — | D28 (decision 9) |
| | service worker binds the complete inventory | T1.8, B1.1 | covered |
| | a browser tab may become Writable; only functional checks | B1.1, T1.4 | covered |
| | production HTTPS evidence | — | pending (decision 4) |

**Handoff open items for D1, and where they are resolved:**

- *Capacity formula with a measured basis, recomputed when the schema grows:* P1, profile in 1.3, T1.19 and its `verify:capacity` guard.
- *Update notice proven with a synthetic second release:* T1.26, B1.10–B1.13, C1.8.
- *Simultaneous readiness failures:* T1.9 "report all failed checks"; the two-fault cases in B1.5 and B1.6; I1.7; real-state equivalents in RC.
- *Unreadable-store Integrity Blocked:* T1.7 root inspection; I1.8; B1.8; C1.10.
- *Early-auto-commit guard:* T1.7 "EarlyAutoCommitGuard" case; all writes go through the single synchronous staging step of the semantic commit.

---

## 10. Evidence recording

- Red and green commands and outcomes for every `it should` case are appended to `evidence/D01/tdd-log.md` (case, red command, red failure excerpt, green command, pass).
- Structural verifications append their command and output to `evidence/D01/structural.md`.
- Browser runs record engine and OS versions in `evidence/D01/provenance.md`. Versions are provenance, never an allowlist.
- Critic reports are saved as `evidence/D01/critic-<n>.md`. For each defect found, the reproducing test is added and shown red before the fix, as the planning protocol requires.
