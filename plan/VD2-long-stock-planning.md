# VD2 — Long Stock planning with first execution (first mutating deliverable)

**Status:** Not started
**Depends on:** VD1
**Frozen scope:** `implementation-plan.md` §4 VD2 (carries the mandated PWA / Offline Release Inventory / Runtime Readiness / persistence write-gate foundation)

This is a living working document: progress, red/green evidence, and critic results are recorded here. Scope changes require plan-deviation approval per `KICKOFF.md`.

## Progress

| Task | Description | Status | Evidence |
|---|---|---|---|
| T2.1 | Persistence seam: transactions, revisions, write gate | ☐ pending | — |
| T2.2 | Runtime Readiness | ☐ pending | — |
| T2.3 | Service worker + Offline Release Inventory (structural+integration) | ☐ pending | — |
| T2.4 | Reference Catalog module | ☐ pending | — |
| T2.5 | Workspace lifecycle operations | ☐ pending | — |
| T2.6 | Domain values + Long Stock `assessPlan` | ☐ pending | — |
| T2.7 | Journal workflow-effect path | ☐ pending | — |
| T2.8 | Trade Record prepare/apply (confirm plan, single execution) | ☐ pending | — |
| T2.9 | Trade Workflows: `confirmPlan`, `recordPositionChange` (opening) | ☐ pending | — |
| T2.10 | UI: onboarding, readiness, Plan form, execution entry | ☐ pending | — |
| T2.11 | Integration cases | ☐ pending | — |
| Gate | Cumulative suites + browser critic | ☐ pending | — |

---

## T2.1 Persistence seam: transactions, revisions, write gate
Seam: `src/modules/persistence` (`runTxn`, `assertWritable`, record/snapshot revision bindings), tested against fake-indexeddb.

```text
describe("write gate")
  it should return RuntimeNotWritable carrying the readiness outcome, every failed check,
      workspace status, and ordered safe actions when the session is not Writable,
      before any store is touched
  it should leave every authoritative store byte-identical after a gated-off write attempt
  it should include the RuntimeNotWritable branch in every mutating facade result union
      that reaches persistence

describe("semantic atomicity")
  it should stage all cross-store effects or none when a participant fails mid-apply
      (fixture: second store write throws; first store shows no trace after)
  it should bump the Workspace content revision exactly once per committed write transaction
      and not on rollback
  it should commit durably across a simulated restart immediately after acknowledged success

describe("optimistic revisions and snapshots")
  it should reject applyPreparedChange when any expected record revision changed
      since prepare, writing nothing and returning the typed conflict
  it should return one coherent revision set across stores from a single readonly snapshot,
      refusing a read that would span two snapshots
```

## T2.2 Runtime Readiness
Seam: `src/modules/workspace/readiness.establishReadiness`, with injected check outcomes (fault-injection points) over fake-indexeddb.

```text
describe("readiness outcomes")
  it should produce Writable only when the diagnostic transaction, capacity/headroom,
      service-worker control, and complete digest-valid inventory checks all pass
  it should stay Writable with an advisory not-protected warning when storage protection
      is Best Effort or Unavailable
  it should report every failed check together when two or more fail, not stopping
      at the first
  it should classify a known-but-unreadable existing storage root as Unsupported
      with Integrity Blocked workspace status, never as an empty store
  it should leave no authoritative fact and no journal history after the isolated
      diagnostic transaction
  it should derive the capacity minimum from the plan-disclosed mature-workspace
      and headroom figures

describe("readiness boundaries")
  it should re-establish readiness after update activation and after Restore
      before any mutation is enabled
  it should invalidate Writable immediately on an injected storage failure and reject
      the next mutation at the persistence seam with RuntimeNotWritable
  it should record exact engine and platform strings as provenance only,
      with no allowlist affecting any outcome
```

## T2.3 Service worker + Offline Release Inventory *(structural + integration)*
Verification:
- `npm run build` emits `release-inventory.json` listing every built asset with a SHA-256 digest and a release identity; a deliberately corrupted digest in the manifest fails verification (unit test on the verifier function).
- SW precaches the inventory, exposes a readiness probe, and does not call `skipWaiting`; activation occurs only after user-approved reload.

Integration (Playwright): online load → stop browser → `context.setOffline(true)` → reopen: shell and stored data serve with readiness re-established; staged update with corrupt digest leaves the prior release in control and reports the failure.

## T2.4 Reference Catalog module
Seam: `src/modules/referenceCatalog` facade (`save`, `query`, `resolve`, `seedDefaults`) over fake-indexeddb.

```text
describe("seedDefaults")
  it should create exactly the eleven Strategy seeds with their immutable shapes
      (including Iron Condor role order and vertical/PMCC constraints), five Close Reasons,
      five Abandonment Reasons, and one empty IdeaSource Tag Type under stable product keys
  it should seed no Account, Institution, generic Custom, Other, Never Filled, Expired,
      Assigned, or Exercised value
  it should be idempotent, adding only genuinely missing identities and never overwriting
      a trader rename, reactivating a legitimately retired seed, or changing a shape
  it should return SeedConflict with no writes when known keys are incompatible
  it should return the resulting catalog snapshot and additions without a follow-up query

describe("identity and availability")
  it should keep an Account's Institution parent and a Tag Value's Tag Type parent
      immutable across rename and availability changes
  it should accept NewSelection only when identity and required parent are selectable
  it should accept RetainedReference for inactive identities while rejecting their
      new selection with InactiveForRequestedUse
  it should serve historical and current labels together where needed, with label text
      never acting as identity
  it should refuse archiving an Institution that still has selectable Accounts
  it should protect SeededValuesRemainSelectable taxonomy values from retirement
      while allowing rename, and keep Rolled selectable

describe("save")
  it should append exactly one administrative revision per decision with expected-revision
      conflict on stale bindings
  it should return the stable identity, complete current record, history head, and new
      catalog snapshot in one result
```

## T2.5 Workspace lifecycle operations
Seam: `src/modules/workspace` facade (`initialize`, `getStatus`, `saveSettings`, `requestDurability`) over fake-indexeddb.

```text
describe("initialize")
  it should create Workspace metadata and atomically seed Journal and Catalog defaults
      only under Writable readiness
  it should derive onboarding as Needs Institution and Account from the seeded catalog
      with no selectable Accounts and no fictional brokerage records
  it should write no Workspace, defaults, or imported facts when readiness fails
  it should return Opened with the readiness evidence, fresh/existing status, and seed
      receipt in one result

describe("getStatus")
  it should return Ready only with Writable readiness, and distinguish Initialization
      Required, Recovery Only, Unsupported, and Integrity Blocked without mutating
      or repairing anything

describe("saveSettings")
  it should save the workspace time zone under expected-revision with Saved, Unchanged,
      Conflict, and typed Rejected outcomes
  it should never rewrite stored instants, Economic Times, or history on zone change

describe("requestDurability")
  it should return exactly Improved, AlreadyProtected, or NotImproved with the honest
      current protection state and no data effect
```

## T2.6 Domain values + Long Stock `assessPlan`
Seam: `src/domain/values` and `src/domain/tradeAnalysis.assessPlan` (pure functions).

```text
describe("calculation result")
  it should represent Value, Unbounded, Unavailable, and NotApplicable as distinct typed
      results with stable reasons and structured details
  it should never substitute zero, fill cost, a stale observation, or silent omission
      for a missing value
  it should keep a valid dollar result visible when its Plan-R conversion is unavailable
  it should construct Money/Price/Quantity only from decimal strings, rejecting
      float-typed inputs

describe("fact order")
  it should order facts by Economic Time then stable Recorded Sequence, never by
      save time, identity, or arrival order

describe("long stock plan assessment")
  it should accept a complete Long Stock plan (Account, Strategy, one long Stock Planned
      Leg with exact instrument, original Stops and Targets) returning normalized
      semantics and independently available planned payoff results
  it should compute Original Planned Risk as the nearest nonnegative monetary boundary
      distance over all original Stops and Targets with per-condition basis, and set 1R
      exactly to it when positive
  it should reject a nonpositive-baseline plan with a typed enumeration of every
      missing or incoherent field
  it should reject missing exact-instrument evidence, incomplete management coverage,
      and unknown/inactive references distinctly
```

## T2.7 Journal workflow-effect path
Seam: `src/modules/journal.prepareEffects` (+ definition snapshot logic) over fake-indexeddb.

```text
describe("prepared journal effects")
  it should validate the exact Entry Definition revision rendered to the trader and
      answers keyed by stable Prompt identities
  it should snapshot the exact prompt wording, option labels, and order into the
      prepared effect
  it should extract Thesis and Invalidation answers by semantic role for Plan Reflection
  it should reject retirement or repurposing of workflow-critical roles while Plan
      confirmation is installed
  it should reserve no durable identity and leave no trace when the surrounding
      transaction never commits
  it should reject an obligation duplicate for an already-current outcome key
```

## T2.8 Trade Record prepare/apply for Confirm Plan and single-execution Position Change
Seam: `src/modules/tradeRecord` (`prepareChange`, `applyPreparedChange`, `getRecord`, `queryRecords`) over fake-indexeddb.

```text
describe("prepareChange(ConfirmPlan)")
  it should return the candidate Trade with canonical digest and expected revisions
      without writing
  it should confirm the candidate's expected lifecycle is Planned

describe("prepareChange(single stock Execution)")
  it should construct the candidate Trade with the Execution owned by exactly that Trade
      and the position change participation recorded
  it should accept the reflection disposition (Complete/Decline/Defer) as part of the
      candidate, not a separate write

describe("applyPreparedChange")
  it should recheck every base revision and digest, assign durable identities, and stage
      facts, lifecycle/index membership, and lot/deviation agreement only inside the
      coordinator-owned transaction
  it should reject with a typed no-write result on stale revision, missing allocation,
      or mismatched analysis binding
  it should return the durable-identity mapping and staged projections the coordinator
      returns after commit, requiring no getRecord call

describe("getRecord/queryRecords")
  it should return the requested projection bound to its FactRevision, NotFound,
      or a structured integrity failure
  it should filter current-lifecycle membership from the authoritative index with
      AND-across/OR-within semantics and fixed sorts
```

## T2.9 Trade Workflows: `confirmPlan` and `recordPositionChange` (opening execution)
Seam: `src/modules/tradeWorkflows` facade over the real module graph (fake-indexeddb).

```text
describe("confirmPlan")
  it should resolve active Account/Strategy/tag references and reject unknown or
      inactive ones as typed no-write results
  it should atomically commit the Trade, frozen Plan and Planned Legs, frozen original
      management, stored Planned lifecycle with index membership, and the completed
      Plan Reflection Entry
  it should share Thesis and Invalidation values between the frozen Plan and the Entry
      without a second entry or a second form
  it should return revision-bound post-commit projections of the Trade and Entry
      sufficient to render success without reading back
  it should write nothing — no Trade, candidate identity, Entry, Debt, or index member —
      when assessment or journal preparation fails

describe("recordPositionChange (single opening execution)")
  it should commit the Execution, derived Position/agreement records, Planned→Open
      lifecycle transition with index change, and the reflection outcome atomically
  it should accept Complete, Decline, and Defer dispositions, where Defer creates
      Outstanding Debt carrying the trigger-time definition snapshot and no blank Entry
  it should require the Position Change Reflection to use Source Position Change and
      a Trade Anchor to the originating Trade
  it should create no Journal evidence when the form is abandoned without Save
  it should derive the entry-window start and record an Entry Size deviation when the
      executed quantity exceeds the planned quantity
```

## T2.10 UI: onboarding, readiness presentations, Plan form, execution entry
Seam: React components via Testing Library (`src/ui/**`).

```text
describe("readiness presentations")
  it should disable every mutating control until Writable without presenting an empty
      Workspace or enabled action while pending
  it should name each failed check in the Unsupported view with safe retry actions and
      another-browser guidance
  it should keep Recovery Only navigation to reads/history/backup only, with one clear
      reason on each disabled mutation
  it should show the not-protected warning persistently without disabling any control,
      and offer the single durability action where the host supports it

describe("onboarding and settings")
  it should walk Institution → Account creation with typed validation and revision
      conflict handling surfaced readably
  it should show onboarding state Ready for Trade Planning once a selectable Account exists

describe("plan form")
  it should render the exact loaded Entry Definition revision and submit stable
      Prompt/Option identities
  it should preserve entered-but-unsaved values across live narrow↔wide resize and
      in-app navigation within the workflow
  it should surface typed rejections field-wise with accessible names and keyboard-
      reachable validation messages
  it should show the computed baseline and 1R before confirmation and block Confirm
      while nonpositive or incomplete

describe("execution entry")
  it should require Economic Time, quantity, price, and fee with decimal-string
      validation rejecting float-formatted input
  it should present the reflection disposition explicitly with Defer only preselected
      in unsaved view state
```

## T2.11 Integration cases (mock-free; fake-indexeddb full stack + Playwright browser)
1. Fresh install → readiness Writable → initialize → create Institution + Account → confirm Long Stock plan → record opening execution → clean restart → list/detail and revisions equivalent to pre-restart post-commit state.
2. Invalid plan (nonpositive baseline, missing reflection answer, inactive reference) → typed rejections and every module revision unchanged (no-write proof by snapshot comparison).
3. Non-writable sessions (each fault-injected failed check; and two simultaneously) → `RuntimeNotWritable` from every mutation and initialization, no data created.
4. Playwright offline: online load → stop → offline reopen → readiness Writable, Planned/Open trades readable and navigable.
5. Receipt sufficiency: coordinator spy asserts no `getRecord`/`queryRecords` call is issued as a consequence of successful `confirmPlan`/`recordPositionChange`.
6. Defer creates Debt with exact trigger-time snapshot; Debt is queryable after restart (resolution UI arrives with VD3).

## Deliverable gate
- [ ] Cumulative unit suite green
- [ ] Integration cases T2.11 all green (recorded per case)
- [ ] Installed Capability Manifest updated to exactly VD2's scope
- [ ] Fresh browser-critic pass (critic starts the dev server itself):
  - [ ] Flow: launch + readiness pass; install where exposed
  - [ ] Flow: initialize Workspace; create/rename Institution + Account
  - [ ] Flow: confirm a Long Stock plan (form validation → baseline/1R shown)
  - [ ] Flow: record the single opening execution; Planned→Open visible in list/detail
  - [ ] Flow: offline reopen shows the trades
  - [ ] Flow: live resize during the Plan form preserves entered values
- [ ] Results log (date, critic run, flows, verdicts):
