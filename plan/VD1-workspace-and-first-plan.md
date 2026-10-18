# VD1 — Workspace & first Plan (Long Stock only)

Working file for VD1 of `plan/implementation-plan.md` @ `477c8cd` (branch `zcode-glm-5.3`). The plan owns scope, sequence, and acceptance markings; this file owns the detailed task breakdown and the living progress record. Sequencing decisions 1–13 are settled — nothing here re-litigates them.

**Environment facts (all VDs):** dev server on `127.0.0.1:5176` via gitignored `.env.local` (`DEV_PORT=5176`; Vite `strictPort`, host `127.0.0.1` — never 5173, that is the main checkout's port); Playwright `baseURL`/`webServer.url` read the same `DEV_PORT`; Vitest runs with `globals: true`; Node-side tests use `fake-indexeddb` in place of a browser-owned IndexedDB (disclosed test infrastructure); bind dev/preview to `127.0.0.1` (`localhost` resolves to IPv6 `::1` only on this host); no glob-like class patterns inside CSS comments; `vite-preview` `Vary: Origin` ⇒ `ignoreVary` on digest-verified SW caches; an installing SW's `clients.matchAll()` is empty ⇒ update notices are page-side; `context.route` intercepts SW-initiated fetches but not the SW script fetch itself.

## Scope recap (authoritative source: plan §VD1)

- **User-visible outcome:** first run to a confirmed Plan — installable app shell, Runtime Readiness gate with all outcome views, workspace initialization with time-zone selection, onboarding (create Institution + Account), plan composition (Long Stock only), Plan Reflection with required Thesis/Invalidation, frozen Plan Baseline and 1R at confirmation, planned-trade browsing and plan detail.
- **Operations exercised:** `Workspace.initialize/getStatus/saveSettings/requestDurability`; `ReferenceCatalog.seedDefaults/save(create Institution, Account)/query/resolve`; `Journal.seedDefaults/getDefinitions/prepareEffects/applyPreparedEffects`; `TradeWorkflows.confirmPlan`; `TradeRecord.prepareChange/applyPreparedChange/getRecord/queryRecords`; `TradeAnalysis.assessPlan`; plus the minimal `TradeViewsAndReporting` browse/detail variants the capability set requires (see Flag F1).
- **Mechanisms:** Web App Manifest identity; versioned service worker with complete digest-verified Offline Release Inventory; the four readiness checks (isolated diagnostic transaction, capacity headroom, SW control, inventory) and persistence-level `RuntimeNotWritable` write gate; semantic transactions, optimistic revisions, immutable fact versions; canonical decimal money; advisory storage-protection warning + durability request; schema-version/migration framework; Installed Capability Manifest.
- **Seeds (atomic at initialization):** 7 Entry Types with initial definitions, 7 Sources, 11 Strategies, 5 Close Reasons, 5 Abandonment Reasons, 1 empty IdeaSource Tag Type. The plan form's strategy selector offers **Long Stock only** (single-leg options VD4; two-leg VD9; IC/PMCC VD10).
- **Durable representation:** schema v1 for Workspace metadata/settings, Journal, Reference Catalog, Trade Record (plans, facts, versions, lifecycle index), and an empty Market Data section; capability manifest; SW release inventory.
- **Acceptance (plan markings):** Full: AC-PLAN-001, AC-PLAN-002, AC-DEL-001, AC-DEL-003, AC-DEL-004, AC-REF-001, AC-JOUR-007, AC-UI-001. Partial owned: AC-UI-002 (grows every VD), AC-RESP-001 (creation operations), AC-DEL-005 (Unsupported + Integrity Blocked halves), AC-DEL-006 (launch/update boundaries), AC-DEL-002 (deferral machinery).

## Interface-freeze gate and parallel split

- **T2 pins the shared command/result types** for every operation VD1 exercises (Workspace, Reference Catalog, Journal, Trade Record, Trade Workflows, Trade Analysis, Trade Views) exactly as the module contracts define them. After T2 the deliverable splits:
  - **Track D (domain/persistence):** T3–T13.
  - **Track U (UI/shell):** T14–T18, built against the frozen interfaces and wired to real modules as Track D lands.
- Both tracks serialize at the VD1 gates: cumulative mock-free integration suite (T19) and fresh browser-critic run (T20).

## Tasks

### T1 — Project scaffold and build/test environment
**Type:** structural. **Depends:** —.

Vite 8.3.4 + TypeScript 7.0.2 + React 19.3.1 (with `@types/react`/`@types/react-dom` 19.3.0) + React Router 8.4.0 + Tailwind 4.3.3 + Zustand 5.0.15 project; Vitest 5.0.5 (`globals: true`) with `fake-indexeddb` 6.2.6; Playwright 1.64.1 wired to `DEV_PORT`; decimal.js 10.6.0 and Luxon 3.7.2 installed; scripts `dev`/`build`/`preview`/`test`/`typecheck`.

**Verification:** `npm run dev` serves only at `http://127.0.0.1:5176` (strictPort rejects a second instance); `npm run test` passes a placeholder unit test; `npm run typecheck` exits 0 (TS 7.0.2; sanctioned fallback 6.0.3 only for an evidenced toolchain gap, per the plan's stack note); `npm run build && npm run preview` serves the production build on the same port/host. Re-verify against Vite 8 the two Vite-7-era host quirks (preview sending `Vary: Origin`; strictPort/`127.0.0.1` binding behavior) rather than assuming they carry over. VD1's every runnable behavior depends on this.

### T2 — Shared domain value types (interface freeze)
**Type:** behavior-bearing. **Depends:** T1.

Canonical `Money`/`Price`/`Quantity` wrappers over decimal.js (USD, no float leakage); `CalculationResult<T>` = `Value | Unbounded | Unavailable | NotApplicable`; `EconomicTime` + `RecordedSequence` (`FactOrder`); opaque revision/snapshot binding types; the cross-cutting `RuntimeNotWritable` result shape; typed expected-failure unions; the TypeScript signatures of every VD1 operation per its module contract.

**Seam:** pure value-type module.

```
describe("canonical decimal money arithmetic")
- it should compute 0.1 + 0.2 as exactly 0.3 with no binary-float residue, since every dollar figure flows through this type
- it should reject construction from a non-finite or non-numeric value with a typed error rather than coercing
- it should preserve full precision through multiplication (e.g. 100 shares × 50.005 → 5000.50) without intermediate rounding

describe("CalculationResult availability union")
- it should keep Value, Unbounded, Unavailable, and NotApplicable distinguishable at runtime so no surface can conflate a number with a reason
- it should carry the stable reason code and structured details on Unavailable and NotApplicable variants

describe("FactOrder tie-break")
- it should order two facts sharing an EconomicTime by RecordedSequence, never by array order or lexical identity
```

### T3 — Persistence/transaction core on IndexedDB
**Type:** behavior-bearing. **Depends:** T2.

Custom promise wrapper over IndexedDB; schema v1 stores for Workspace metadata/settings, Journal, Reference Catalog, Trade Record (facts, versions, lifecycle index), and an empty Market Data section; versioned migration framework (version registry, isolated candidate application, atomic activation); semantic transactions spanning multiple stores with commit/rollback; optimistic revision recheck on apply; snapshot-consistent multi-store reads; the persistence-level write gate that rejects every write with `RuntimeNotWritable` when the current session is not `Writable`.

**Seam:** persistence module public API over `fake-indexeddb`.

```
describe("semantic transaction atomicity across stores")
- it should commit staged effects in every participating store together when all participants succeed
- it should leave every store byte-identical to its pre-transaction state when any participant rejects mid-transaction
- it should recover to the committed before-or-after state (never a cross-store mixture) when the process is interrupted before commit

describe("optimistic revision recheck")
- it should reject an apply whose expected base revision no longer matches the stored revision, with a typed conflict and no write
- it should return a new revision bound to the exact committed snapshot after a successful apply

describe("schema v1 and the migration framework")
- it should initialize an empty store at schema v1 with all five sections present and the version recorded
- it should apply a registered v1→v2 test migration through an isolated candidate and atomically activate it, with a failed migration leaving v1 data intact and readable
- it should reject data at an unknown newer version with a typed result and no mutation

describe("persistence-level RuntimeNotWritable write gate")
- it should reject an authoritative write with the RuntimeNotWritable branch, carrying the readiness outcome and failed checks, whenever the session is not Writable
- it should admit the same write after the session re-establishes Writable, proving the gate is state-driven and not a permanent lockout
```

### T4 — Runtime Readiness checks and outcomes
**Type:** behavior-bearing. **Depends:** T3.

The four checks with per-check evidence: (1) isolated diagnostic transaction on the authoritative store leaving no authoritative fact; (2) capacity headroom against the plan-derived minimum (mature 25,000-Trade/200,000-fact workspace plus migration and backup headroom — the derived number is disclosed in tests); (3) intended versioned service-worker control; (4) complete, digest-valid Offline Release Inventory. Outcome mapping: all-pass ⇒ `Writable`; any fail with no readable existing root ⇒ `Unsupported`; readable existing root ⇒ `Recovery Only`; unreadable/ambiguous known-or-possible root ⇒ `Unsupported` + Integrity Blocked status (never treated as empty). All failed checks reported together, never first-fail-only.

**Seam:** readiness module public API (check inputs injectable for controlled pass/fail; the checks themselves are the real implementations over the real store).

```
describe("readiness outcome mapping")
- it should return Writable with per-check evidence when all four checks pass
- it should return Unsupported naming only the failed checks when the diagnostic transaction, capacity, SW control, or inventory check fails and no existing root is readable
- it should report every failed check, not just the first, when two or more checks fail simultaneously
- it should return Recovery Only (with readable workspace status) instead of Unsupported when an existing Workspace remains readable through a readiness failure

describe("isolated diagnostic transaction")
- it should leave zero authoritative facts in the store after the check runs, provable by an unchanged fact-store snapshot before/after

describe("capacity headroom derivation")
- it should derive and disclose the minimum from the mature-scale plan inputs plus migration/backup headroom, and fail the check when the host reports less
- it should pass when reported capacity meets the derived minimum with the derivation retained as evidence

describe("integrity-blocked root handling")
- it should return Unsupported with Integrity Blocked workspace status and safe actions when a known-or-possible existing root cannot be read, and never an empty-store result
```

### T5 — PWA identity, service worker, and Offline Release Inventory
**Type:** structural (identity/registration) + behavior-bearing (inventory verification, update deferral). **Depends:** T1.

Web App Manifest (stable identity, name, icons, launch URL, scope, standalone request); build-time Offline Release Inventory with a digest per asset; SW precache install with digest verification; `ignoreVary` on digest-verified caches for preview builds; update flow: new SW may advertise only after its inventory is complete and digest-valid, activation deferred to a safe reload, page-side update notice watching `registration.installing`.

**Structural verification:** `curl http://127.0.0.1:5176/manifest.webmanifest` returns the manifest with all required fields; the built release contains the inventory listing every hashed asset with its digest.

```
describe("Offline Release Inventory verification")  — seam: inventory verifier module
- it should accept an inventory whose every listed asset is present with a matching digest
- it should reject the inventory as incomplete when any listed asset is absent
- it should reject the inventory as digest-invalid when any listed asset's content differs from its recorded digest

describe("update deferral")  — seam: update controller state machine (registration states supplied as input)
- it should surface the update-available notice only after the incoming release's inventory verifies complete and digest-valid
- it should keep the active release in control (no activation) until an explicit safe reload is signaled
- it should report a staging failure as a diagnostic without activating anything and without touching the installed release
```

### T6 — Workspace.initialize / getStatus / saveSettings / requestDurability
**Type:** behavior-bearing. **Depends:** T3, T4 (T7/T8 consumed once landed).

Status assembly: full-content `WorkspaceSnapshotBinding`, time-zone setting/revision, Installed Capability Manifest, onboarding state (Ready for Trade Planning | Needs Institution and Account), current readiness with per-check evidence, protection state, schema versions, latest receipts. `initialize` paths: Opened / Time Zone Selection Required / Migration Blocked / Integrity Blocked / `RuntimeNotWritable`; atomic Journal+Catalog seeding; onboarding derived from resulting Catalog state in the same operation. `saveSettings` (time zone): Saved/Unchanged/Conflict/Rejected; changing time zone affects future View Moments / Review selection / Report Period boundaries only — never stored instants or history. `requestDurability`: Improved / AlreadyProtected / NotImproved, advisory only, never mutates data.

**Seam:** `Workspace` operations over the real store (readiness inputs injectable for failure paths).

```
describe("Workspace.getStatus before initialization")
- it should return Initialization Required with Writable readiness when the store opened successfully and provably contains no Workspace
- it should never present an unreadable existing root as Initialization Required (Integrity Blocked instead)

describe("Workspace.initialize")
- it should return Opened with a Needs-Institution-and-Account onboarding state after atomically creating metadata and seeding Journal and Catalog defaults, with the receipt naming readiness evidence and seed versions
- it should create no metadata, defaults, or imported facts when readiness fails, returning the RuntimeNotWritable branch with failed checks and safe actions
- it should return Time Zone Selection Required when the opening request supplies no time zone and none is stored, writing nothing
- it should seed idempotently on re-initialization of an existing compatible Workspace without rewriting trader revisions

describe("Workspace.saveSettings")
- it should return Saved with the complete resulting settings and a new settings/Workspace binding on a time-zone change
- it should return Unchanged (no new revision) when the submitted settings equal the current ones
- it should return Conflict with current settings when the expected settings revision is stale, writing nothing
- it should preserve stored instants and history verbatim across a time-zone change (only future resolution boundaries shift)

describe("Workspace.requestDurability")
- it should return Improved with Protected protection when the host grants persistence
- it should return NotImproved with the BestEffort/Unavailable reason and leave all data intact when the host refuses, and never treat the refusal as a data event
```

### T7 — Reference Catalog: seeds and onboarding writes
**Type:** behavior-bearing. **Depends:** T3.

`seedDefaults` (Workspace-only, versioned manifest, stable product keys, atomic, idempotent, `SeedConflict` on incompatible keys); `save` typed creation of Institution and Account (Account's Institution parent immutable; label distinguishability in namespace); `query` selectable-only lists; `resolve` `NewSelection` validation under one catalog snapshot with snapshot-conflict on change.

**Seam:** `ReferenceCatalog` operations over the real store.

```
describe("Catalog.seedDefaults")
- it should create exactly the eleven seeded Strategies with their immutable typed shapes (Long Stock one long Stock role … Iron Condor four roles in ascending-strike order), five Close Reasons (Rolled present), five Abandonment Reasons, and one IdeaSource Tag Type with zero Values — and no Account, Institution, Custom, Other, or settlement-as-reason seed
- it should be idempotent: repeating the seed creates nothing new and preserves any trader revisions
- it should return SeedConflict with no writes when a known stable key exists with an incompatible meaning

describe("Catalog.save create Institution/Account")
- it should create an Institution with a stable identity and one appended history head, returning the complete current record and new catalog snapshot without a follow-up query
- it should create an Account only under a selectable Institution, with the immutable parent link, and reject creation under an archived one
- it should reject a second Account with an identical label within the same Institution as a typed validation result

describe("Catalog.resolve NewSelection")
- it should validate Account and Strategy as active selections and bind them to the catalog snapshot revision
- it should return a snapshot conflict (no write) when the catalog advanced between resolve and the committed use
```

### T8 — Journal: seeds, definitions, prepared effects
**Type:** behavior-bearing. **Depends:** T3.

`seedDefaults` (seven fixed Entry Types with the exact initial definitions from the Journal contract — prompts, options, order, requiredness, `RequireWhenOption`/`AllOrNone` rules, scale bounds, workflow-critical roles — plus seven initial Sources; idempotent); `getDefinitions` (latest revision); `prepareEffects`/`applyPreparedEffects` for a completed Plan Reflection (completion-now only; Thesis/Invalidation by stable semantic role; candidate anchors bound without reserving identities; apply only inside a shared semantic transaction, staged all-or-none).

**Seam:** `Journal` operations over the real store.

```
describe("Journal.seedDefaults and getDefinitions")
- it should create the seven fixed Entry Types and seven Sources under stable product identities matching the Journal contract exactly (every prompt, option set, order, requiredness, conditional rule, scale bound, and semantic role)
- it should return the latest definitions for all types from getDefinitions
- it should be idempotent on repeat seeding, creating nothing and rewriting no trader revision

describe("prepared Plan Reflection effects")
- it should prepare a completed Plan Reflection from the exact rendered definition revision, extracting Thesis and Invalidation by stable semantic role
- it should reject a prepared effect whose required Thesis or Invalidation answer is blank, as a typed no-write result
- it should stage the completed Entry on apply (inside a coordinator transaction) and return the assigned identity and staged outcome projection without a Journal query
- it should leave nothing staged when the surrounding transaction rolls back
```

### T9 — TradeAnalysis.assessPlan (Long Stock)
**Type:** behavior-bearing. **Depends:** T2.

Pure plan assessment for the one selectable strategy: leg coherence (one long Stock role, underlying + positive quantity), management coverage, calculable baseline. Baseline = Original Planned Risk (intended entry → original effective Stop boundary, per-share × quantity), Original Planned Reward, planned reward/risk ratio, per-condition basis; Original Planned Risk positive and exactly 1R. **Assumption A1 (confirm at review):** a Long Stock plan without a Target yields `Unbounded` Original Planned Reward (ratio Unbounded) and is still acceptable; a Stop is required for positive 1R.

**Seam:** `TradeAnalysis.assessPlan` (pure).

```
describe("assessPlan acceptance for Long Stock")
- it should accept AAPL 100 shares, intended entry 50.00, stop 45.00, target 60.00 and return normalized semantics with 1R = $500.00, Original Planned Reward = $1,000.00, and ratio 2.0
- it should return Unbounded Original Planned Reward (and Unbounded ratio) when no target is set, while still accepting the plan with positive 1R   [A1]
- it should reject with a typed result naming every missing field when underlying, quantity, intended entry, or stop is absent

describe("assessPlan baseline correctness")
- it should reject a stop at or above intended entry for a long position because Original Planned Risk is not positive, identifying the field and the nonpositive value
- it should compute the baseline from intended entry and original management only — no actual-fill concept exists in the input
- it should return per-condition basis for the stop and target independently of the headline values
```

### T10 — TradeRecord: confirm-plan change protocol and reads
**Type:** behavior-bearing. **Depends:** T3, T2.

`prepareChange(ConfirmPlan)`: no write, no reserved durable identity; candidate + before `AnalysisInput` + canonical digest. `applyPreparedChange`: coordinator-transaction only; rechecks revisions/digest; requires Trade Analysis acceptance (valid `DerivedTradeReconciliation` for the candidate); assigns durable identities; appends immutable version-1 facts; stages stored lifecycle `Planned` + index membership together. `getRecord` (projection + FactRevision | NotFound | integrity failure). `queryRecords`: bounded filters (lifecycle, Account, Strategy, Underlying), fixed sorts (Plan Time desc / Last Activity desc / Terminal Time desc), Summary and AnalysisInput projections, opaque pagination bound to normalized query + snapshot.

**Seam:** `TradeRecord` operations over the real store.

```
describe("confirm-plan prepare/apply")
- it should build a candidate Trade at expected Planned state without writing, reserving no identity
- it should commit plan facts, immutable versions, stored Planned lifecycle, and current-state index membership together on apply, returning durable identities and the staged Trade projection at its new FactRevision
- it should reject apply with no write when the required analysis reconciliation is absent or bound to a different candidate digest

describe("getRecord and queryRecords")
- it should return the requested projection with its FactRevision, or NotFound for an unknown identity
- it should return Planned trades in Plan-Time-descending order with Summary fields and bound pagination
- it should return pagination that cannot be reused after the snapshot or normalized query changes
- it should return AnalysisInput as one complete bounded batch (no per-child follow-up loads implied by the shape)
```

### T11 — TradeWorkflows.confirmPlan (end-to-end semantic command)
**Type:** behavior-bearing. **Depends:** T7, T8, T9, T10.

Resolves Account/Strategy via Catalog, validates the Plan Reflection form via Journal prepare, requires assessPlan acceptance with positive 1R, prepares the Trade Record change, commits Trade + Journal effects in one transaction. Result carries `TradeMutationSuccess`: receipt (TradeId, new FactRevision, fact identities, lifecycle transition, Entry identity) + postCommit projections (committed Trade projection, completed Entry projection) — sufficient to render success with no read-back (AC-RESP-001 creation aspect). Failure before commit creates neither Trade nor Journal outcome (AC-PLAN-002).

**Seam:** `TradeWorkflows.confirmPlan` over the real store and real participant modules.

```
describe("confirmPlan happy path")
- it should atomically create one Trade at Planned with frozen Plan, Planned Legs, frozen original management, positive 1R, and one completed immutable Plan Reflection whose Thesis/Invalidation values supply the Plan semantics — and return post-commit Trade and Entry projections bound to the committed revisions

describe("confirmPlan typed rejections write nothing")
- it should return typed rejections naming every issue when the baseline is nonnumeric/nonpositive, the strategy shape is incoherent, leg evidence is missing, or a required reflection answer is blank — with Trade Record, Journal, and Catalog revisions unchanged and no candidate identity, Entry, Debt, or index membership existing
- it should reject with a typed conflict (no write) when the Account or Strategy became inactive between resolution and commit
- it should return the RuntimeNotWritable branch when the session is not Writable, writing nothing

describe("confirmPlan durability")
- it should leave the confirmed Trade and Entry queryable with identical identities and revisions after a simulated restart (fresh store connection)
```

### T12 — Trade Views and Reporting: minimal browse + plan detail
**Type:** behavior-bearing. **Depends:** T10. *(See Flag F1.)*

Read-coordinator assembly the VD1 capability set requires: trade list (planned trades at VD1: lifecycle, account/strategy/underlying labels via Catalog, plan summary) and Trade Detail for a planned trade (frozen plan, legs, management, lifecycle, Plan Reflection narrative via Journal anchor resolution). Loading/Ready/Empty/Error observable.

**Seam:** `TradeViewsAndReporting` browse/detail over the real store.

```
describe("planned-trade browse and detail")
- it should return a Ready list of planned Trades with reference labels resolved from the Catalog snapshot and an honest Empty state when none exist
- it should return one coherent plan detail including the frozen plan facts, baseline/1R, and the Trade-anchored Plan Reflection narrative in a single snapshot-bound result
- it should return an Error state, not a false Empty, when the underlying read cannot be assembled
```

### T13 — Installed Capability Manifest v1
**Type:** structural. **Depends:** T6.

Manifest listing exactly VD1's complete operations/variants (Workspace 4 ops + export-adjacent none yet, Catalog subset, Journal subset, TradeWorkflows.confirmPlan, TradeRecord subset, TradeAnalysis.assessPlan, Trade Views browse/detail) with dependency closure; navigation gated by the manifest.

**Verification:** manifest fixture diff against the expected capability list; a UI smoke test asserting navigation exposes only manifest-declared surfaces. AC-CAP-001's honest-delta rule depends on it.

### T14 — UI: app shell, navigation, live resize
**Type:** behavior-bearing. **Depends:** T1 (wired to T13 gating).

Narrow single-column + bottom navigation; wide left sidebar + centered content; live viewport-width switching without reload preserving route, selection, filters, and unsaved form values; canonical labels; WCAG AA contrast; visible keyboard focus.

**Seam:** rendered app (Vitest + Testing Library for component behavior; Playwright for resize evidence).

```
describe("viewport-driven live adaptation")  — seam: app shell rendered in the browser
- it should switch between bottom-nav and sidebar layouts at the disclosed breakpoint on live resize without reload
- it should preserve an active route, a selected record, and entered-but-unsaved form values across the switch
- it should expose equivalent information, fields, actions, and Save/Cancel outcomes at both widths
```

### T15 — UI: readiness and storage-protection surfaces
**Type:** behavior-bearing. **Depends:** T4, T6, T14.

Pending startup verification (never a fake empty Workspace nor enabled mutating action); `Writable` shell; `Recovery Only` restricted read/history navigation with mutations disabled and the cross-browser storage explanation; `Unsupported` naming each failed check with safe retry and another-browser recommendation; Integrity Blocked pairing with no initialization/overwrite affordances; not-protected warning always visible (never disabling a control) with the one `requestDurability` action where supported.

**Seam:** rendered app driven through injected readiness states (component tests) + real-browser failure inductions (Playwright: unregister SW, corrupt a precached asset).

```
describe("readiness outcome views")  — seam: app entry surface
- it should show startup-verification UI with every mutating control disabled while readiness is pending
- it should enable the full shell only on Writable
- it should render the Recovery Only view with reads/history reachable, every mutation disabled with one clear reason, and no readiness masquerade as an empty Workspace
- it should render Unsupported naming every failed check (multi-failure case) with retry and another-browser guidance
- it should pair Unsupported with Integrity Blocked presentation — no initialize/import/overwrite affordance — when the existing root is unreadable
- it should keep the not-protected storage warning visible and non-disabling, with the durability request action offered where the host supports it
```

### T16 — UI: onboarding and settings
**Type:** behavior-bearing. **Depends:** T6, T7, T15.

First-run flow: time-zone selection → `initialize`; create Institution → create Account (validated forms, post-commit confirmation from returned results, no follow-up read); settings surface for time-zone change with the future-effect explanation before Save; conflict handling preserves input.

**Seam:** rendered onboarding/settings forms against real modules.

```
describe("onboarding flow")  — seam: onboarding surface
- it should take a fresh Writable environment from time-zone selection through initialize to the Needs-Institution-and-Account state, seeding visible selectable defaults (none fictional)
- it should create an Institution and then an Account under it from validated forms, confirming each save from the returned post-commit result
- it should surface typed validation (duplicate label, blank name) inline without any save
- it should complete onboarding to Ready for Trade Planning once a selectable Account exists

describe("time-zone settings")  — seam: settings surface
- it should explain, before Save, that changing time zone shifts future View Moments/Review/Report boundaries but never stored history
- it should preserve the form's entered values and explain the conflict when the expected settings revision is stale
```

### T17 — UI: plan composition and confirmation
**Type:** behavior-bearing. **Depends:** T11, T14, T15.

Plan form driven by the rendered Entry Definition (stable prompt/option identities; exact revision; chips as radio groups under labelled fieldsets); strategy selector offering **Long Stock only**; planned leg (underlying + quantity), intended entry, original stop, target; Thesis/Invalidation required; confirm → success view with frozen Plan Baseline and 1R rendered from the post-commit result; typed rejections listed inline; abandon/navigation records nothing; unsaved values preserved on conflict/resize.

**Seam:** plan composition surface against real modules.

```
describe("plan composition and confirm")  — seam: plan form + confirm action
- it should offer exactly one selectable strategy (Long Stock) in the strategy selector
- it should render the Plan Reflection prompts from the loaded definition revision and submit stable prompt identities
- it should reject confirmation with every typed issue listed inline and nothing saved when Thesis/Invalidation is blank or the baseline is nonpositive
- it should confirm a valid plan and immediately present the frozen baseline and 1R from the returned post-commit result, with no visible refetch
- it should record nothing when the form is abandoned or navigated away from unsaved
```

### T18 — UI: planned-trade list and plan detail views
**Type:** behavior-bearing. **Depends:** T12, T14.

List + detail surfaces with distinguishable Loading/Ready/Empty/Error states; baseline/1R display with unrounded read-model values and presentation-only rounding.

**Seam:** rendered browse/detail surfaces.

```
describe("planned-trade list and detail view states")  — seam: trade list/detail surfaces
- it should show Loading (never a false Empty or stale-as-current) while the read is in flight, Ready with content, Empty with explanation and next action, and Error with recoverable context
- it should render the plan detail's baseline and 1R from exact read-model values with rounding applied only at presentation
```

### T19 — VD1 integration suite additions + cumulative gate
**Type:** structural (suite assembly; the cases are specified in the Integration section below). **Depends:** all above.

**Verification:** `npm run test -- --run integration` green for the cumulative suite including every INT-VD1 case, on `fake-indexeddb`, with disclosed host shims only.

### T20 — Fresh browser-critic gate
**Type:** structural gate. **Depends:** T19.

Fresh critic agent runs every CRIT-VD1 flow against `http://127.0.0.1:5176`. Mandatory test-first repair loop per planning protocol on any finding.

### T21 — Cloudflare Pages deployment evidence
**Type:** structural. **Depends:** T5, T19.

Deploy the release to Cloudflare Pages; capture HTTPS-origin manifest/inventory/readiness provenance for AC-DEL-003.

**Verification:** `curl https://<pages-host>/manifest.webmanifest` over HTTPS returns the manifest; recorded browser/OS versions for the evidence set; loopback evidence (127.0.0.1 secure context) recorded as automation supplement, not replacement.

## Progress table

| Task | Status | Evidence (red/green commands + outcomes, or structural verification) |
|---|---|---|
| T1 scaffold | planned | |
| T2 shared value types | planned | |
| T3 persistence core | planned | |
| T4 runtime readiness | planned | |
| T5 PWA/SW/inventory | planned | |
| T6 Workspace ops | planned | |
| T7 Reference Catalog | planned | |
| T8 Journal | planned | |
| T9 assessPlan | planned | |
| T10 TradeRecord | planned | |
| T11 confirmPlan | planned | |
| T12 Trade Views minimal | planned | |
| T13 capability manifest | planned | |
| T14 app shell | planned | |
| T15 readiness UI | planned | |
| T16 onboarding/settings UI | planned | |
| T17 plan UI | planned | |
| T18 browse/detail UI | planned | |
| T19 integration gate | planned | |
| T20 critic gate | planned | |
| T21 deployment evidence | planned | |

## Mock-free real-stack integration cases (join the cumulative suite)

Disclosed test infrastructure: `fake-indexeddb` in place of a browser-owned IndexedDB; Node-side shims for browser-host delivery capabilities only (storage estimate, SW controller state, inventory fetch) where a real browser is absent — never for an application module.

| ID | Case | Real-stack path and durable-state proof |
|---|---|---|
| INT-VD1-01 | Fresh initialize with exact seeds and onboarding | Real readiness → `initialize` → verify all 7 Entry Types/7 Sources/11 Strategies/5+5 reasons/1 IdeaSource type exist under stable identities with zero trader revisions; onboarding Needs Institution and Account; durable via fresh store connection (AC-JOUR-007, AC-REF-001 aspect) |
| INT-VD1-02 | Repeat seeding is idempotent | Re-run `seedDefaults` through `initialize` on the populated workspace; identical revisions, no additions, no rewrites (AC-JOUR-007/AC-REF-001 idempotence) |
| INT-VD1-03 | Readiness failure matrix | Drive each check to fail alone and two together via host shims; assert Unsupported vs Recovery Only mapping, all-checks-reported, unchanged store bytes, and no initialized data (AC-DEL-004) |
| INT-VD1-04 | RuntimeNotWritable from both boundaries | Force non-Writable session; attempt `initialize` and `confirmPlan`; assert the RuntimeNotWritable branch with failed checks at the application result and the persistence seam, and zero durable effects (AC-DEL-004 write-gate aspect) |
| INT-VD1-05 | confirmPlan atomic success | Full real-stack confirm; assert one Trade at Planned, frozen plan/legs/management, positive 1R, completed Plan Reflection sharing Thesis/Invalidation with the Plan, lifecycle index membership in the same commit, and post-restart query equivalence (AC-PLAN-001) |
| INT-VD1-06 | confirmPlan rejection writes nothing | Each AC-PLAN-002 failure class; assert Trade Record/Journal/Catalog revisions unchanged and no candidate/Entry/Debt/index residue |
| INT-VD1-07 | Stale-binding conflict | Retire... (no retire until VD14 — instead: advance catalog/settings revision between resolve and commit via a concurrent save); assert typed conflict, no write (AC-REF-002-conflict mechanics aspect) |
| INT-VD1-08 | saveSettings + durability | Time-zone Saved/Unchanged/Conflict paths and `requestDurability` NotImproved refusal leaving data intact; stored instants unchanged across time-zone change |
| INT-VD1-09 | Transaction rollback across participants | Inject a Journal-prepare rejection after Trade staging; assert every store unchanged (semantic atomicity, ADR-0002 aspect) |

## Browser-critic flows (fresh critic; app at http://127.0.0.1:5176)

| ID | Flow | Pass condition |
|---|---|---|
| CRIT-VD1-01 | First launch → readiness pending → Writable shell | Startup verification visible; mutating actions disabled until Writable; then full shell |
| CRIT-VD1-02 | PWA identity inspection | Manifest fetch shows stable identity fields; install affordance/instructions present where the host exposes installation; browser-tab use remains complete |
| CRIT-VD1-03 | Initialize with time zone → onboarding → create Institution + Account | Seeded defaults visible (no fictional brokerage records); flow reaches Ready for Trade Planning |
| CRIT-VD1-04 | Compose and confirm a Long Stock plan (AAPL 100 @ 50, stop 45, target 60, Thesis/Invalidation filled) | Success shows frozen baseline $500 1R / $1,000 reward from post-commit result; plan appears in list and detail |
| CRIT-VD1-05 | Incomplete plan submission | Typed rejections listed; nothing persisted; unsaved values retained for correction |
| CRIT-VD1-06 | Live resize on the plan form (wide→narrow→wide) | Layout switches live; route/unsaved values intact; equivalent actions (AC-UI-001) |
| CRIT-VD1-07 | Storage-protection surface | Not-protected warning visible and non-disabling; durability request action offered; accepted write still works |
| CRIT-VD1-08 | Offline stopped-app restart (AC-DEL-001) | After one Writable load: stop browser, go offline (Playwright `setOffline`), reopen → Writable re-established with no network, initial screen interactive, manual workflows (confirm a plan) work |
| CRIT-VD1-09 | Update deferral machinery (AC-DEL-002 partial) | Serve a controlled second release; update notice appears page-side only after its inventory verifies; active session (open form with values) unaffected; activation only at reload |
| CRIT-VD1-10 | Recovery Only induction | Corrupt/remove a precached asset (or unregister SW) with an existing workspace → Recovery Only view: reads/history available, mutations disabled with RuntimeNotWritable surfaced, cross-browser storage explanation shown (AC-DEL-005 Unsupported/Integrity aspect via CRIT-VD1-11) |
| CRIT-VD1-11 | Integrity Blocked induction | Existing store made unreadable in a controlled profile → Unsupported + Integrity Blocked: no initialize/overwrite affordance, safe actions only |
| CRIT-VD1-12 | Keyboard-only + zoom pass over VD1 surfaces | All VD1 workflows completable keyboard-only; visible focus; no color-only meaning (AC-UI-002 VD1 slice) |

## Acceptance-scenario coverage

| Scenario | Plan marking @VD1 | VD1 owns | Tasks | Integration | Critic |
|---|---|---|---|---|---|
| AC-PLAN-001 | Full | entire scenario | T9, T10, T11 | INT-VD1-05 | CRIT-VD1-04 |
| AC-PLAN-002 | Full | entire scenario | T9, T11 | INT-VD1-06 | CRIT-VD1-05 |
| AC-DEL-001 | Full | entire scenario | T5 | (Playwright offline) | CRIT-VD1-08 |
| AC-DEL-003 | Full | entire scenario | T5, T21 | — | CRIT-VD1-02 + HTTPS provenance |
| AC-DEL-004 | Full | entire scenario incl. simultaneous failures + both-boundary RuntimeNotWritable + capacity derivation disclosure | T3, T4, T15 | INT-VD1-03, INT-VD1-04 | CRIT-VD1-01/10/11 |
| AC-REF-001 | Full | entire scenario | T7 | INT-VD1-01/02 | CRIT-VD1-03 |
| AC-JOUR-007 | Full | entire scenario | T8 | INT-VD1-01/02 | CRIT-VD1-03 |
| AC-UI-001 | Full | entire scenario | T14 | — | CRIT-VD1-06 |
| AC-UI-002 | Partial (grows every VD) | VD1 surfaces' Loading/Ready/Empty/Error + keyboard/zoom slice | T15, T18 | — | CRIT-VD1-12 |
| AC-RESP-001 | Partial (creation operations) | confirmPlan as creation; post-commit result discipline | T11 | INT-VD1-05 | CRIT-VD1-04 |
| AC-DEL-005 | Partial (Unsupported + Integrity Blocked halves) | Unsupported/Integrity-Blocked outcomes and no-write behavior; Recovery-Only export half completes VD5→VD6 era (per plan, Recovery-Only export at VD6; note: plan's declared scope names VD5 for the Recovery-Only export half — the export operation itself lands with VD6 backup; flagged as F4) | T4, T15 | INT-VD1-03/04 | CRIT-VD1-10/11 |
| AC-DEL-006 | Partial (launch/update boundaries) | every-launch gate + post-update re-gate; post-Restore boundary completes VD18 | T4, T5 | INT-VD1-03 | CRIT-VD1-09 |
| AC-DEL-002 | Partial (deferral machinery) | inventory-gated update notice + deferred activation; evidence accrues per release, completes VD18 | T5 | — | CRIT-VD1-09 |

## Flagged for review (cited passages; no silent choice made)

- **F1 — Trade Views omitted from VD1's operations list.** Plan §VD1 capability set requires "planned-trade browsing and plan detail," but the §VD1 operations list names no `TradeViewsAndReporting` operation, and the dependency table (`specs/design/overview.md` "Who may call whom") forbids Presentation → Trade Record reads. T12 therefore includes the minimal browse/detail read-coordinator variants. Same pattern in VD2 ("open-trade browsing and detail" with no listed Trade Views op).
- **F2 — Assumption A1 (target-optional Long Stock plan).** `specs/design/trade-analysis.md` §assessPlan requires positive Original Planned Risk (= 1R) but does not state that a Target is mandatory; T9 assumes a target-less plan yields `Unbounded` Original Planned Reward and is acceptable. Confirm or correct.
- **F3 — Production HTTPS evidence cadence.** AC-DEL-003 needs production-origin provenance. T21 deploys to Cloudflare Pages at VD1 and the expectation is each later release re-deploys; confirm that cadence (vs. accumulating to a single later evidence pass).
- **F4 — AC-DEL-005 "Recovery-Only export completes at VD5" vs backup landing at VD6.** Plan §VD1 partial line says the Recovery-Only export half of AC-DEL-005 completes at VD5, but `exportBackup` is a VD6 operation (plan §VD6; decision 13 moved backup to VD6). Proposed reading: the Recovery-Only *restricted view with backup navigation* is VD1 (T15) and the export behavior completes at VD6; confirm.
