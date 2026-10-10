# D1 — Confirm a Stock Plan and open the Trade

Status: detailed planning draft, 2026-10-10. No implementation or tests have been run. Frozen product baseline: `specs/` at `968bc2b`; Profile A; worktree `codex-gpt-6.1-sol`.

[Planning index](../task-breakdown-d1-d3.md) · [Shared tests and evidence](test-evidence.md) · [Canonical acceptance map](../acceptance-map-d1-d3.md)

## User-visible outcome and scope

First launch → Account setup → New Stock Plan + Plan Reflection → Confirm → grouped first opening decision + reflection outcome → Trade Detail / Journal.

Single-Instrument Stock Plan; initial opening decision only, with multiple broker partial fills allowed inside that decision. Unentered abandonment and Journal-only deferred reflection resolution are included. All first-write PWA/readiness, persistence, backup/read-back, Restore, offline and safe-update work is inside this deliverable. Seed the canonical defaults even when their option/forms workflows are not yet advertised.

Full disposal, Manual Mark entry, Stock valuation/management and Daily Review arrive in D2. Single options and provider recovery arrive in D3. Independent Stock scaling is D8; Trade corrections/replay D13; general Journal amendments/custom forms D16; reports D17–D20.

## Task order and blocking edges

Dependencies are prerequisites, not suggestions. Tasks inside this table are not independent releases. Every acceptance flow below also has the shared durable/failure proof required by the evidence guide.

| Task | Work | Blocking prerequisites |
| --- | --- | --- |
| [D1-T01](#d1-t01) | Pin the build and establish test/evidence commands (structural) | Approved complete plan; pinned version/evidence record |
| [D1-T02](#d1-t02) | Provide atomic persistence, consistent snapshots, and write gating | [D1-T01](d1-stock-open.md#d1-t01) |
| [D1-T03](#d1-t03) | Establish PWA assets and functional Runtime Readiness | [D1-T01](d1-stock-open.md#d1-t01), [D1-T02](d1-stock-open.md#d1-t02) |
| [D1-T04](#d1-t04) | Retain exact values, explicit time, and session evidence | [D1-T01](d1-stock-open.md#d1-t01) |
| [D1-T05](#d1-t05) | Initialize real brokerage references and canonical defaults | [D1-T02](d1-stock-open.md#d1-t02), [D1-T03](d1-stock-open.md#d1-t03), [D1-T04](d1-stock-open.md#d1-t04) |
| [D1-T06](#d1-t06) | Capture workflow Journal outcomes and resolve Journal-only Debt | [D1-T02](d1-stock-open.md#d1-t02), [D1-T04](d1-stock-open.md#d1-t04), [D1-T05](d1-stock-open.md#d1-t05) |
| [D1-T07](#d1-t07) | Own Stock facts, candidates, identities, and bounded queries | [D1-T02](d1-stock-open.md#d1-t02), [D1-T04](d1-stock-open.md#d1-t04), [D1-T05](d1-stock-open.md#d1-t05) |
| [D1-T08](#d1-t08) | Assess the Stock Plan and derive its opening economics | [D1-T04](d1-stock-open.md#d1-t04) |
| [D1-T09](#d1-t09) | Confirm or abandon the Stock Plan atomically | [D1-T03](d1-stock-open.md#d1-t03), [D1-T05](d1-stock-open.md#d1-t05), [D1-T06](d1-stock-open.md#d1-t06), [D1-T07](d1-stock-open.md#d1-t07), [D1-T08](d1-stock-open.md#d1-t08) |
| [D1-T10](#d1-t10) | Record the first Stock opening decision and its reflection | [D1-T09](d1-stock-open.md#d1-t09) |
| [D1-T11](#d1-t11) | Assemble coherent Stock browse/detail/history views | [D1-T05](d1-stock-open.md#d1-t05), [D1-T06](d1-stock-open.md#d1-t06), [D1-T07](d1-stock-open.md#d1-t07), [D1-T08](d1-stock-open.md#d1-t08), [D1-T10](d1-stock-open.md#d1-t10) |
| [D1-T12](#d1-t12) | Deliver the actual Stock planning/opening UI | [D1-T03](d1-stock-open.md#d1-t03), [D1-T05](d1-stock-open.md#d1-t05), [D1-T06](d1-stock-open.md#d1-t06), [D1-T09](d1-stock-open.md#d1-t09), [D1-T10](d1-stock-open.md#d1-t10), [D1-T11](d1-stock-open.md#d1-t11) |
| [D1-T13](#d1-t13) | Download and read-back verify a coherent full backup | [D1-T02](d1-stock-open.md#d1-t02), [D1-T05](d1-stock-open.md#d1-t05), [D1-T06](d1-stock-open.md#d1-t06), [D1-T07](d1-stock-open.md#d1-t07), [D1-T11](d1-stock-open.md#d1-t11) |
| [D1-T14](#d1-t14) | Validate and atomically replace a D1 Workspace | [D1-T03](d1-stock-open.md#d1-t03), [D1-T08](d1-stock-open.md#d1-t08), [D1-T13](d1-stock-open.md#d1-t13) |
| [D1-T15](#d1-t15) | Safely update and reopen the installed D1 release | [D1-T03](d1-stock-open.md#d1-t03), [D1-T12](d1-stock-open.md#d1-t12), [D1-T14](d1-stock-open.md#d1-t14) |
| [D1-T16](#d1-t16) | Close D1 with integration, reconstruction, scale, and a fresh critic (structural) | [D1-T12](d1-stock-open.md#d1-t12), [D1-T13](d1-stock-open.md#d1-t13), [D1-T14](d1-stock-open.md#d1-t14), [D1-T15](d1-stock-open.md#d1-t15) |

## Detailed tasks and unit tests

Every case below follows the per-case red → minimal green → next case procedure in the shared guide. Dependencies may be isolated in unit tests; they are real in integration and acceptance. Case IDs are literal test-title selectors. Proposed unit path: `tests/unit/<Task-ID>.test.ts`.

### D1-T01

**Pin the build and establish test/evidence commands** — structural task

**Public/confirmed test seam:** Build, test configuration, and import boundaries.

**Work:** Consume the exact compatible dependency/runtime versions recorded before full-plan freeze. Add strict TypeScript, React/Vite, CSS Modules, Dexie, exact-rational and validation dependencies, custom-worker tooling, Vitest, and Playwright. Both development and built-preview servers read DEV_PORT=5174 with strictPort. Establish the planned commands in the shared guide and enforce canonical dependency directions. This enabling task is inside D1, not a release.

**Reproducible verification and expected result:** Run npm ci, npm run typecheck, npm run lint, npm run build, and a minimal real-browser integration smoke that mounts the production entry and opens an isolated actual IndexedDB database. Check dev/preview/Playwright use the same port; a occupied port fails instead of moving. Unit suite supports selecting each recorded case ID. Save exact package/runtime/browser versions and lockfile digest.

**Real-stack acceptance:** [B-08](test-evidence.md#b-08), [B-12](test-evidence.md#b-12).

### D1-T02

**Provide atomic persistence, consistent snapshots, and write gating**

**Public/confirmed test seam:** Internal Persistence/Transaction via Workspace and installed mutating module operations.

**Work:** Define versioned stores for authoritative facts, immutable histories, settings, references, Journal definitions/outcomes, Market evidence, and rebuildable private state. Use one database and one transaction for every semantic command. Recheck revisions and current Writable evidence inside the transaction; perform no network, file reading, worker round trip, or async hashing there. Success is acknowledged after commit with the bound staged results.

**Unit group:** `describe("D1-T02 Provide atomic persistence, consistent snapshots, and write gating")`

- `D1-T02-U01` — `it should reject each authoritative mutation outside Writable, leave all authoritative bindings unchanged, and permit only the isolated non-authoritative diagnostic probe`.
- `D1-T02-U02` — `it should abort every staged participant when a later Journal or Catalog participant fails, leaving no durable candidate identity or changed lifecycle membership`.
- `D1-T02-U03` — `it should return the complete committed subject projections only after commit, and recover after interruption to exactly the before or after state`.
- `D1-T02-U04` — `it should reject a stale Trade, definition, Catalog, observation, or Workspace binding without any partial write`.
- `D1-T02-U05` — `it should produce one consistent multi-module read/export snapshot while a competing writer commits wholly before or after that snapshot`.
- `D1-T02-U06` — `it should invalidate the writable session on an observed transaction/quota failure and reject the next mutation while preserving readable recovery`.

**Real-stack acceptance:** [B-01](test-evidence.md#b-01), [B-02](test-evidence.md#b-02), [B-03](test-evidence.md#b-03), [B-11](test-evidence.md#b-11).

### D1-T03

**Establish PWA assets and functional Runtime Readiness**

**Public/confirmed test seam:** Workspace.initialize/getStatus/requestDurability and browser delivery ports.

**Work:** Supply stable manifest identity, icons/scope/launch, an explicit complete versioned asset/digest inventory, and intended-worker control. Derive headroom from encoded mature-data forecasts plus measured migration/Restore/cache/export peaks, then check diagnostic transaction, headroom, worker control, and inventory independently. Report actual Protected/BestEffort/Unavailable separately. No identity allowlist decides support.

**Unit group:** `describe("D1-T03 Establish PWA assets and functional Runtime Readiness")`

- `D1-T03-U01` — `it should become Writable only when all four functional checks pass, including an all-pass case with BestEffort or Unavailable storage protection`.
- `D1-T03-U02` — `it should report each failed check and all simultaneous failures, create no fresh Workspace, and return RuntimeNotWritable from initialization`.
- `D1-T03-U03` — `it should perform an isolated real diagnostic commit/abort probe without adding a Trade, Entry, default, or authoritative revision`.
- `D1-T03-U04` — `it should fail readiness for absent worker control or any missing or digest-invalid required asset rather than trusting cache names or build revision strings`.
- `D1-T03-U05` — `it should pass at the derived headroom threshold and fail below it using the recorded capacity model rather than an arbitrary constant`.
- `D1-T03-U06` — `it should return Recovery Only for an existing readable root when readiness fails and Integrity Blocked for an unreadable or ambiguous existing root without initializing over it`.
- `D1-T03-U07` — `it should return Improved, AlreadyProtected, or NotImproved truthfully after an explicit durability gesture, without affecting the independent readiness decision`.
- `D1-T03-U08` — `it should rerun checks on every launch and invalidate stale Writable evidence after an observed running-session storage/release failure`.

**Real-stack acceptance:** [B-02](test-evidence.md#b-02), [B-03](test-evidence.md#b-03), [B-06](test-evidence.md#b-06), [B-07](test-evidence.md#b-07), [B-12](test-evidence.md#b-12).

### D1-T04

**Retain exact values, explicit time, and session evidence**

**Public/confirmed test seam:** TradeAnalysis.assessPlan/derive and MarketData.query for read-only session/absence resolution.

**Work:** Parse decimal command values as strings and retain exact BigInt rational calculations/serialization. Persist explicit Economic Time, Save Time, and stable Recorded Sequence separately. Supply explicit observation instants, Workspace zone, and a versioned session policy; pure analysis never reads a clock/calendar/storage. D1 resolves honest Missing frames but installs no Mark-save UI.

**Unit group:** `describe("D1-T04 Retain exact values, explicit time, and session evidence")`

- `D1-T04-U01` — `it should calculate a three-share planned price distance of 0.2 minus 0.1 as exactly 0.3 and retain that value through serialization`.
- `D1-T04-U02` — `it should reject nonfinite or invalid price/quantity/baseline input with all applicable issues instead of coercing blank strings to zero`.
- `D1-T04-U03` — `it should derive equal-Economic-Time facts in Recorded Sequence order regardless of array order, lexical identity, or Save Time`.
- `D1-T04-U04` — `it should return identical analysis for the same explicit facts/cutoff even when the machine clock or Workspace display zone differs`.
- `D1-T04-U05` — `it should preserve stored economic instants/dates/history when a Workspace time-zone setting changes`.
- `D1-T04-U06` — `it should resolve the versioned Stock session cutoff/Expected Mark Date from the supplied instant and distinguish an absent exact observation from a price`.

**Real-stack acceptance:** [D1-A01](d1-stock-open.md#d1-a01), [D1-A04](d1-stock-open.md#d1-a04), [B-04](test-evidence.md#b-04), [B-09](test-evidence.md#b-09).

### D1-T05

**Initialize real brokerage references and canonical defaults**

**Public/confirmed test seam:** Workspace.initialize/saveSettings; ReferenceCatalog.save/query/resolve/seedDefaults.

**Work:** Atomically initialize metadata, exactly eleven Strategy seeds, five Close Reasons, five Abandonment Reasons, empty IdeaSource type, seven Journal types/definitions/Sources, and no Institution/Account. Provide real brokerage onboarding and the reference operations consumed by Stock Plans, including typed single-Stock Strategy creation when needed; never add a fictional Short Stock or Custom seed. Keep identities, immutable parents/shapes, label lenses, and availability history.

**Unit group:** `describe("D1-T05 Initialize real brokerage references and canonical defaults")`

- `D1-T05-U01` — `it should return Needs Institution and Account after fresh initialization with exactly the canonical default manifests and no fictional brokerage records`.
- `D1-T05-U02` — `it should return Ready for Trade Planning after creating a real Institution and its Account, with generated IDs and current status available directly from the responses`.
- `D1-T05-U03` — `it should repeat seeding idempotently by stable product key without overwriting renames, legitimate retirements, or retained supported definition revisions`.
- `D1-T05-U04` — `it should reject Account creation under an archived Institution, parent/shape changes, illegal protected-taxonomy retirement, or archival of an Institution with selectable Accounts`.
- `D1-T05-U05` — `it should preserve historical references through rename/archive/retire while rejecting a new inactive selection or a concurrent-retirement binding`.
- `D1-T05-U06` — `it should derive Institution through Account and retain Tag Type/Value and IdeaSource identities rather than mutable labels`.
- `D1-T05-U07` — `it should save a new time zone under the expected revision, return Saved/Unchanged/Conflict appropriately, and leave stored facts/history unchanged`.

**Real-stack acceptance:** [D1-A01](d1-stock-open.md#d1-a01), [D1-A06](d1-stock-open.md#d1-a06), [D1-A07](d1-stock-open.md#d1-a07), [B-01](test-evidence.md#b-01), [B-02](test-evidence.md#b-02).

### D1-T06

**Capture workflow Journal outcomes and resolve Journal-only Debt**

**Public/confirmed test seam:** Journal.getDefinitions/prepareEffects/applyPreparedEffects/save(ResolveDebt)/query and seedDefaults.

**Work:** Render and validate supported definition snapshots, fixed semantic roles, all six prompt kinds, stable options, and bounded conditional rules. Plan Reflection must complete now; Position Change Reflection explicitly completes, declines, or defers. Direct save is scoped to permitted Debt resolution here; standalone writing, definition editing, and general Edit/Addendum/Void UI remain D16. Preserve immutable chains and all supported backup histories from the outset.

**Unit group:** `describe("D1-T06 Capture workflow Journal outcomes and resolve Journal-only Debt")`

- `D1-T06-U01` — `it should return all seven exact initial definitions/Sources and validate required Text, scale bounds, select identities, and semantic roles against the rendered revision`.
- `D1-T06-U02` — `it should prepare a completed Plan Reflection with Thesis/Invalidation available once to both Plan and Entry semantics without writing or reserving IDs`.
- `D1-T06-U03` — `it should complete, decline, or defer a Position Change obligation into exactly one current outcome, with Defer creating snapshotted Debt and no blank Entry`.
- `D1-T06-U04` — `it should reject duplicate or stale obligation resolution so concurrent completion/decline/deferral cannot create multiple current outcomes`.
- `D1-T06-U05` — `it should answer a Journal-only Debt against its trigger-time definition and preserve its Anchor/origin and the actual writing-path Source`.
- `D1-T06-U06` — `it should reject direct prose resolution of a workflow-routed Debt with the exact required workflow and no Entry or Debt transition`.
- `D1-T06-U07` — `it should create no evidence from opening, typing, selecting, resizing, Cancel, or navigation without Save`.
- `D1-T06-U08` — `it should preserve one Anchor per Entry, valid origin links, and exact definition/response history through export and candidate validation`.

**Real-stack acceptance:** [D1-A02](d1-stock-open.md#d1-a02), [D1-A03](d1-stock-open.md#d1-a03), [D1-A04](d1-stock-open.md#d1-a04), [B-04](test-evidence.md#b-04), [B-05](test-evidence.md#b-05).

### D1-T07

**Own Stock facts, candidates, identities, and bounded queries**

**Public/confirmed test seam:** TradeRecord.prepareChange/applyPreparedChange/getRecord/queryRecords/history/resolveAnchors.

**Work:** Provide Stock Plan/Abandonment/opening candidates, complete AnalysisInput snapshots, stable identity/version/sequence rules, stored lifecycle membership, and recorded fact-Deviation agreement. Prepared candidates are nonpersistent. Apply requires exact candidate reconciliation inside the owning transaction. Query CurrentState and retained historical identities with bounded batches, fixed sorts, and snapshot-bound pagination.

**Unit group:** `describe("D1-T07 Own Stock facts, candidates, identities, and bounded queries")`

- `D1-T07-U01` — `it should prepare a valid candidate and digest without changing authoritative revisions or reserving durable fact identities`.
- `D1-T07-U02` — `it should require an exact candidate/reconciliation/base-revision match and coordinator-owned transaction before staging any apply effects`.
- `D1-T07-U03` — `it should commit Plan/Open/Abandoned lifecycle and current membership with the causing facts, rather than exposing a lifecycle setter`.
- `D1-T07-U04` — `it should return a complete bounded AnalysisInput batch and stable normalized-query cursor without one getRecord call per list item`.
- `D1-T07-U05` — `it should reject a cursor after query/snapshot change and combine filter dimensions with AND and values within a dimension with OR`.
- `D1-T07-U06` — `it should resolve effective and retained historical Trade/Execution Anchors in batches without redirecting unknown identities`.
- `D1-T07-U07` — `it should surface lifecycle/lot/Deviation disagreement and perform no read-time repair`.

**Real-stack acceptance:** [D1-A04](d1-stock-open.md#d1-a04), [D1-A05](d1-stock-open.md#d1-a05), [D1-A06](d1-stock-open.md#d1-a06), [D1-A08](d1-stock-open.md#d1-a08), [B-09](test-evidence.md#b-09), [B-10](test-evidence.md#b-10).

### D1-T08

**Assess the Stock Plan and derive its opening economics**

**Public/confirmed test seam:** TradeAnalysis.assessPlan/derive/evaluate/expirationPayoff for Stock scope.

**Work:** Use one Stock Instrument with valid typed long/short Stock role semantics; Long Stock is the canonical fixture. Calculate frozen original risk/reward and positive 1R; aggregate broker fills inside one opening decision, open Lots/fees, fulfillment, initial-entry resolution, and fact-only Deviations. Stock-only payoff is NotApplicable; Missing Mark frames yield honest independent availability rather than fill-price valuation.

**Unit group:** `describe("D1-T08 Assess the Stock Plan and derive its opening economics")`

- `D1-T08-U01` — `it should accept F-S1 with intended risk 500 and reward 1000, and reject missing/nonpositive baseline, incoherent shape, or missing management/leg evidence`.
- `D1-T08-U02` — `it should derive F-S1 opening fills into 100 shares, purchase amount 10040, unconsumed opening fees 1, distinct Lots, Open lifecycle, and no closing matches`.
- `D1-T08-U03` — `it should keep Entry Quality pending for an incomplete initial quantity and resolve it once at the complete entry or first exposure reduction`.
- `D1-T08-U04` — `it should distinguish served-leg term mismatch, excess size, and explicitly Unplanned intent without inferring Unplanned Exposure from a mismatch`.
- `D1-T08-U05` — `it should compare exact unrounded terms/ratios and group all reproducible mismatched fields for a served leg into one occurrence`.
- `D1-T08-U06` — `it should support Stock direction/sign semantics from a valid Stock-only typed Strategy without manufacturing a new seed or relabeling the frozen Plan`.
- `D1-T08-U07` — `it should retain realized-to-date as an independent Value when marked results lack exact evidence, and return stock-only payoff as NotApplicable`.

**Real-stack acceptance:** [D1-A01](d1-stock-open.md#d1-a01), [D1-A04](d1-stock-open.md#d1-a04), [D1-A05](d1-stock-open.md#d1-a05), [D2-A10](d2-stock-review-close.md#d2-a10).

### D1-T09

**Confirm or abandon the Stock Plan atomically**

**Public/confirmed test seam:** TradeWorkflows.confirmPlan/abandonPlan.

**Work:** Resolve active Account/Strategy/tags and exact rendered definition, assess the Plan, then stage Trade and completed Reflection under one transaction. Return generated identities and bound projections after commit. Abandonment is factual and has its own active reason, not a Close Reason or Terminal Disposition.

**Unit group:** `describe("D1-T09 Confirm or abandon the Stock Plan atomically")`

- `D1-T09-U01` — `it should confirm one Trade, frozen Plan/legs/management/1R and completed Plan Reflection atomically with shared Thesis/Invalidation values`.
- `D1-T09-U02` — `it should aggregate missing Plan/reflection/selector issues and write no Trade, Entry, Debt, or lifecycle membership`.
- `D1-T09-U03` — `it should recheck Catalog/definition and transaction readiness bindings and roll back all participants on conflict/failure`.
- `D1-T09-U04` — `it should abandon an unentered Plan with an active reason while preserving Plan writing and creating neither Close Reason nor Terminal Disposition`.
- `D1-T09-U05` — `it should reject abandonment after a real opening fact, even if a later real exit eventually makes the Trade flat`.
- `D1-T09-U06` — `it should return complete post-commit Trade and Journal projections without an operation-required read-back`.

**Real-stack acceptance:** [D1-A01](d1-stock-open.md#d1-a01), [D1-A02](d1-stock-open.md#d1-a02), [D1-A05](d1-stock-open.md#d1-a05), [D1-A07](d1-stock-open.md#d1-a07), [B-01](test-evidence.md#b-01), [B-11](test-evidence.md#b-11).

### D1-T10

**Record the first Stock opening decision and its reflection**

**Public/confirmed test seam:** TradeWorkflows.recordPositionChange(Stock opening).

**Work:** Submit every broker fill of one decision with exact ownership, intent, Economic Time/order, price/quantity/actual fee, and one explicit Reflection disposition. Derive, stage, and commit facts, lifecycle/index, Lots/agreement, fact-Deviations, and Journal outcome together. Additional independent entries and exits are not advertised in D1.

**Unit group:** `describe("D1-T10 Record the first Stock opening decision and its reflection")`

- `D1-T10-U01` — `it should record F-S1's two fills under one Position Change, with distinct exclusively owned Execution identities and one originating-Trade reflection outcome`.
- `D1-T10-U02` — `it should move Planned to Open with facts and agreement records in the same commit`.
- `D1-T10-U03` — `it should allow factual capture with an explicit Defer or Decline and preserve due semantics without manufacturing an incomplete Entry`.
- `D1-T10-U04` — `it should reject incoherent ownership, unsupported instrument/decision variant, invalid exact quantities, stale revisions, or incomplete required reflection answers without writes`.
- `D1-T10-U05` — `it should retain per-fill Economic Time and stable sequence while treating broker partial fills as one decision for later scaling analysis`.
- `D1-T10-U06` — `it should return bound opening Trade, analysis, Entry/Debt/decline, and new identities directly after commit and roll them all back on a participant failure`.

**Real-stack acceptance:** [D1-A01](d1-stock-open.md#d1-a01), [D1-A03](d1-stock-open.md#d1-a03), [D1-A04](d1-stock-open.md#d1-a04), [B-01](test-evidence.md#b-01), [B-11](test-evidence.md#b-11), [B-12](test-evidence.md#b-12).

### D1-T11

**Assemble coherent Stock browse/detail/history views**

**Public/confirmed test seam:** TradeViewsAndReporting.browseTrades/getTradeDetail and Journal.query.

**Work:** Return finished Planned/Open/Abandoned views from consistent snapshots, reuse pure derivation, batch labels/Journal/evidence, deduplicate narratives, and expose saved history plus accurate Missing/NotApplicable states. UI does not calculate, join stores, or select lifecycle from P&L. D1 has no review/report/provider/correction controls.

**Unit group:** `describe("D1-T11 Assemble coherent Stock browse/detail/history views")`

- `D1-T11-U01` — `it should render the returned Plan/opening response and later independently requested detail with equivalent bound facts and Journal outcomes`.
- `D1-T11-U02` — `it should browse by authoritative lifecycle and factual sort, batch current/historical labels, and avoid derived-price cursor ordering`.
- `D1-T11-U03` — `it should show historical selected labels alongside changed current labels without changing membership or overwriting Entry snapshots`.
- `D1-T11-U04` — `it should deduplicate Trade and Execution-anchored narrative items and distinguish completed writing, decline, and Debt`.
- `D1-T11-U05` — `it should return coherent values or an explicit changed/integrity result when data changes during assembly, never a torn Ready view or false Empty`.
- `D1-T11-U06` — `it should omit uninstalled capabilities from navigation/normal requests instead of returning fabricated calculation Unavailable`.

**Real-stack acceptance:** [D1-A01](d1-stock-open.md#d1-a01), [D1-A06](d1-stock-open.md#d1-a06), [D1-A08](d1-stock-open.md#d1-a08), [B-10](test-evidence.md#b-10), [B-12](test-evidence.md#b-12).

### D1-T12

**Deliver the actual Stock planning/opening UI**

**Public/confirmed test seam:** Accessible DOM of onboarding, Stock Plan, opening, detail, and Debt forms submitting canonical operations.

**Work:** Implement the full production journey, exact decimal input/validation, contextual forms, explicit Save/Cancel, current safe input preservation on conflict, and equivalent narrow/wide controls. Render coordinator results; do not reproduce math or synthesize child writes. PWA/status/settings/recovery/file-operation screens use Workspace results.

**Unit group:** `describe("D1-T12 Deliver the actual Stock planning/opening UI")`

- `D1-T12-U01` — `it should submit one complete confirmPlan command containing the rendered definition and shared Thesis/Invalidation rather than separate Trade/Journal saves`.
- `D1-T12-U02` — `it should submit the grouped opening fills and explicit reflection disposition once and render the returned identities/state without mandatory getTradeDetail`.
- `D1-T12-U03` — `it should leave authoritative evidence unchanged after open/type/Cancel/navigation and keep active unsaved fields during live resize`.
- `D1-T12-U04` — `it should retain safe entered values and focus the issues after Rejected/Conflict instead of silently retrying a stale command`.
- `D1-T12-U05` — `it should distinguish Loading, Ready with coverage, Empty, and Error and expose semantic labels/keyboard focus/Save/Cancel at narrow and wide widths`.
- `D1-T12-U06` — `it should disable mutations while readiness is pending or non-Writable, keep protection warnings visible without disabling an otherwise Writable form`.

**Real-stack acceptance:** [D1-A01](d1-stock-open.md#d1-a01), [D1-A02](d1-stock-open.md#d1-a02), [D1-A03](d1-stock-open.md#d1-a03), [D1-A07](d1-stock-open.md#d1-a07), [B-02](test-evidence.md#b-02), [B-03](test-evidence.md#b-03), [B-08](test-evidence.md#b-08).

### D1-T13

**Download and read-back verify a coherent full backup**

**Public/confirmed test seam:** Workspace.exportBackup/confirmBackup and all four exportSnapshot participants.

**Work:** Build versioned portable exact-value JSON from one full read snapshot, with section/full digests and source binding. Export all installed authoritative sections, including the explicitly empty Market section in D1. Hand off an ordinary download; keep expected digest/source only in active view state. File selection/read/hash occur outside authoritative transactions.

**Unit group:** `describe("D1-T13 Download and read-back verify a coherent full backup")`

- `D1-T13-U01` — `it should export every installed identity/version/sequence/definition/outcome/reference/settings under one source binding while a later writer stays wholly outside the artifact`.
- `D1-T13-U02` — `it should return Downloaded without a CompletedBackupReceipt even when the download handoff succeeds`.
- `D1-T13-U03` — `it should complete verification only after a selected saved file is complete, digest-valid, and matches the exact exported source and artifact digest`.
- `D1-T13-U04` — `it should return NotCompleted/NotVerified with no receipt for source-read/handoff failure, unreadable/truncated/different file, or digest corruption`.
- `D1-T13-U05` — `it should write no authoritative state during export/verification, including in Recovery Only, and store no pending verification record`.
- `D1-T13-U06` — `it should require a new export after navigation/restart loses the expected view-state binding instead of recognizing a previously pending verification`.
- `D1-T13-U07` — `it should exclude secrets, unsaved forms, raw provider/transient diagnostics, and rebuildable private state while preserving exact economic values`.

**Real-stack acceptance:** [B-04](test-evidence.md#b-04), [B-03](test-evidence.md#b-03), [D1-A01](d1-stock-open.md#d1-a01).

### D1-T14

**Validate and atomically replace a D1 Workspace**

**Public/confirmed test seam:** Workspace.prepareRestore/applyPreparedRestore and fact-module restore participants.

**Work:** Prepare an isolated candidate: validate envelope/digests/version/capability footprint, all section histories and external references; derive lifecycle/lot/Deviation agreement; disclose coherent repairs. Recheck exact artifact/live target/release bindings and explicit safety choice, then replace all sections/settings atomically. Return landing/status and discard all old forms/views; re-establish readiness.

**Unit group:** `describe("D1-T14 Validate and atomically replace a D1 Workspace")`

- `D1-T14-U01` — `it should prepare a supported valid candidate without changing the live binding or contacting a provider`.
- `D1-T14-U02` — `it should reject malformed/digest-corrupt/newer/unsupported-scope data, broken version chains, bad references, or incoherent authoritative facts with safe aggregated issues`.
- `D1-T14-U03` — `it should disclose a repair for coherent agreement/private-state disagreement without erasing historical identities or evidence-bound occurrences`.
- `D1-T14-U04` — `it should reject apply without explicit replacement confirmation and, for user data, an exact-target completed receipt or warned explicit decline`.
- `D1-T14-U05` — `it should reject an unverified download, stale backup receipt, stale preview target, changed artifact, or non-Writable session with every section unchanged`.
- `D1-T14-U06` — `it should roll back all sections/settings on a participant failure and preserve the prior root after an interruption`.
- `D1-T14-U07` — `it should preserve stable IDs/history exactly, rebuild private state, return fresh landing/status, invalidate old views, and check readiness before further writes`.

**Real-stack acceptance:** [B-05](test-evidence.md#b-05), [B-03](test-evidence.md#b-03), [B-09](test-evidence.md#b-09), [B-11](test-evidence.md#b-11).

### D1-T15

**Safely update and reopen the installed D1 release**

**Public/confirmed test seam:** Delivery update activation plus Workspace.initialize/getStatus.

**Work:** Stage and byte-verify complete next assets before notice; retain the prior compatible cache/release. Defer activation while any active workflow is unsafe to reload. Reopen current schema coherently and reject unsupported/missing migration links. D1 has no genuine earlier released data version to migrate; supported D1→D2 and D2→D3 data transitions are tested in their consuming slices.

**Unit group:** `describe("D1-T15 Safely update and reopen the installed D1 release")`

- `D1-T15-U01` — `it should notice a new release only after its complete inventory verifies while the current worker/form stays in control`.
- `D1-T15-U02` — `it should defer activation without silently losing unsaved values or creating draft evidence, then activate at an explicitly safe reload/restart`.
- `D1-T15-U03` — `it should preserve the prior compatible release/root when asset staging, digest verification, readiness, or candidate validation fails`.
- `D1-T15-U04` — `it should re-establish readiness before writes after activation and return the current schema/seed/private-rebuild receipt without replaying every historical Trade`.
- `D1-T15-U05` — `it should reject unknown-newer or missing/lossy migration paths without treating the existing root as empty or overwriting it`.
- `D1-T15-U06` — `it should offer readable Recovery Only/history/export/verification on failure, and safely retry an unreadable root without a false backup claim`.

**Real-stack acceptance:** [B-03](test-evidence.md#b-03), [B-06](test-evidence.md#b-06), [B-07](test-evidence.md#b-07), [B-09](test-evidence.md#b-09).

### D1-T16

**Close D1 with integration, reconstruction, scale, and a fresh critic** — structural task

**Public/confirmed test seam:** Built production UI, real IndexedDB, and verification harness.

**Work:** Execute D1-A01…A08 plus every applicable shared B flow. Generate only legal D1 fixtures through public operations or supported validated Restore; compare after restart/Restore/private rebuild. Measure the installed-scope prefix and recorded conservative mature capacity model. D1 cannot certify the final 200,000-fact matured dataset because ordinary closure and later histories are not yet installed.

**Reproducible verification and expected result:** Run cumulative unit/integration/acceptance commands and architecture/build checks from the shared guide. Run D1 installed-prefix benchmark with 25,000 Planned/Abandoned/Open Trades and 200 Open; disclose actual fact counts, exact environment/raw percentiles, and bounded query traces. Spawn a fresh critic that starts the runtime and performs all D1/shared browser flows; use test-first fixes and a fresh full-flow retry until passing. Record no covered status before actual evidence exists.

**Real-stack acceptance:** [D1-A01](d1-stock-open.md#d1-a01), [D1-A02](d1-stock-open.md#d1-a02), [D1-A03](d1-stock-open.md#d1-a03), [D1-A04](d1-stock-open.md#d1-a04), [D1-A05](d1-stock-open.md#d1-a05), [D1-A06](d1-stock-open.md#d1-a06), [D1-A07](d1-stock-open.md#d1-a07), [D1-A08](d1-stock-open.md#d1-a08), [B-01](test-evidence.md#b-01), [B-02](test-evidence.md#b-02), [B-03](test-evidence.md#b-03), [B-04](test-evidence.md#b-04), [B-05](test-evidence.md#b-05), [B-06](test-evidence.md#b-06), [B-07](test-evidence.md#b-07), [B-08](test-evidence.md#b-08), [B-09](test-evidence.md#b-09), [B-10](test-evidence.md#b-10), [B-11](test-evidence.md#b-11), [B-12](test-evidence.md#b-12).

## Real-stack acceptance and fresh-critic flows

These are both automated integration/production-browser flow specifications and the fresh critic's reproducible checklist. Use the fixtures in the shared guide. Every applicable B flow is repeated at the deliverable gate, not merely tested once in D1. Failure/nonmutation proof compares authoritative data, not just an error banner. Commands and evidence paths are specified in the shared guide; their scripts are to be created during authorized implementation.

### D1-A01

**First launch, Stock Plan and opening**

**Fixture:** Fresh isolated Workspace; F-S1; actual Institution/Account onboarding.

**Given:** No authoritative Workspace exists and all four readiness checks pass.

**When:** Launch the production UI, save the real brokerage Account, enter the Stock Plan and its completed Plan Reflection, Confirm, then record the two opening fills as one decision with a completed Position Change Reflection.

**Then:** Show one frozen Plan, Planned then Open lifecycle, exactly 100 shares, cost 10040 plus opening fee 1, one opening decision, two owned Executions and one originating reflection. Accepted response state is sufficient to continue; no extra directly-changed-state query completes either command.

**Durable/failure/critic evidence:** Capture mutation receipts and authoritative identity/revision manifests; close the runtime and reopen to compare Trade, Lots, Journal definitions/answers, baseline 500, original conditions, reference labels and evidence provenance. Run B-01/B-06/B-08/B-12.

**Tasks:** [D1-T03](d1-stock-open.md#d1-t03), [D1-T05](d1-stock-open.md#d1-t05), [D1-T06](d1-stock-open.md#d1-t06), [D1-T08](d1-stock-open.md#d1-t08), [D1-T09](d1-stock-open.md#d1-t09), [D1-T10](d1-stock-open.md#d1-t10), [D1-T12](d1-stock-open.md#d1-t12).

### D1-A02

**Incomplete/stale confirmation and abandonment**

**Fixture:** Fresh incomplete Stock Plan; valid unentered Planned Trade; separately F-S1 Open Trade.

**Given:** Required Plan/Reflection values are missing, a reference/form binding becomes stale, or an unentered Trade is eligible for abandonment.

**When:** Try Confirm with each invalid condition, resolve the conflict and Confirm once, then abandon the unentered Plan with an active reason; also try abandoning F-S1 after actual entry.

**Then:** Aggregate relevant validation errors, preserve inputs/focus and write nothing on invalid/stale commands. Valid abandon produces Abandoned with reason, no Close Reason/disposition. The entered Trade remains Open; offsetting real activity would not make it unentered.

**Durable/failure/critic evidence:** Compare authoritative manifests before/after every rejection; restart after accepted abandonment; verify frozen Plan and original writing retained. D1 does not yet expose false-fact correction/Void.

**Tasks:** [D1-T05](d1-stock-open.md#d1-t05), [D1-T06](d1-stock-open.md#d1-t06), [D1-T09](d1-stock-open.md#d1-t09), [D1-T12](d1-stock-open.md#d1-t12).

### D1-A03

**Opening reflection decline, Debt and retained form**

**Fixture:** Three otherwise equivalent Stock opening decisions, one completed, one declined and one deferred.

**Given:** Each opening requires one reflection disposition.

**When:** Save each explicit disposition, restart, open due Journal Debt from its source Trade, answer it using the retained rendered form, then attempt a duplicate/stale settlement.

**Then:** A completed Entry, explicit decline outcome and separate Debt are distinguishable. Defer creates no blank Entry. Answering resolves exactly the original obligation; duplicate/stale attempts write nothing. Workflow-routed factual Debt, when present in later scope, is not treated as Journal-only.

**Durable/failure/critic evidence:** Inspect returned outcomes, stable obligation/Entry IDs, trigger-time definition/anchor/source, and current/historical Journal after restart. Run B-11 at the Journal participant boundary.

**Tasks:** [D1-T06](d1-stock-open.md#d1-t06), [D1-T10](d1-stock-open.md#d1-t10), [D1-T11](d1-stock-open.md#d1-t11), [D1-T12](d1-stock-open.md#d1-t12).

### D1-A04

**Semantic interruption and integrity detection**

**Fixture:** F-S1 and an unentered Plan; separate disposable corrupted-store specimen.

**Given:** A real IndexedDB transaction can be aborted before acknowledgment, and an existing disagreement specimen is separately prepared.

**When:** Abort Plan/opening at each participating store, interrupt immediately before/after commit acknowledgment, retry with fresh bindings; in the controlled specimen make stored lifecycle/Lot agreement disagree with facts and request ordinary detail.

**Then:** Only complete before or complete after state exists. No orphan writing, Debt, Lot, lifecycle/index, ID or partial decision survives an aborted transaction. Disagreement is visible integrity failure and is never repaired by a read or reported Ready.

**Durable/failure/critic evidence:** B-11 before/after manifest and restart checks; disclose the direct specimen corruption solely as an integrity fault, never as ordinary fixture creation. Capture diagnostics with no secret/user-writing leak.

**Tasks:** [D1-T02](d1-stock-open.md#d1-t02), [D1-T07](d1-stock-open.md#d1-t07), [D1-T09](d1-stock-open.md#d1-t09), [D1-T10](d1-stock-open.md#d1-t10), [D1-T11](d1-stock-open.md#d1-t11).

### D1-A05

**Backup download/read-back and atomic replacement**

**Fixture:** F-S1 with deferred Debt, Abandoned Plan and actual Catalog labels; second target Workspace; exported actual files.

**Given:** Source and target have different coherent histories.

**When:** Download backup, confirm the trader-selected saved file, prepare Restore on the target, choose explicit Replace with its exact-target safety receipt or explicit warned decline, then repeat with corrupt/wrong files and a failing participant.

**Then:** Download alone yields no Completed receipt. Successful matching read-back binds the exact source snapshot/digest. Preparation writes nothing; replacement is whole-Workspace and atomic; failures retain the entire prior target. Old target forms are discarded and readiness runs again.

**Durable/failure/critic evidence:** B-04/B-05 selected-file digests, all-section identity/value comparisons, participant abort/restart and receipt stale/unverified cases. Provider I/O is absent.

**Tasks:** [D1-T13](d1-stock-open.md#d1-t13), [D1-T14](d1-stock-open.md#d1-t14), [D1-T15](d1-stock-open.md#d1-t15).

### D1-A06

**Readiness, offline restart and safe update**

**Fixture:** Secure-origin installed production build; F-S1; four independent readiness faults, simultaneous faults and unreadable-store specimen.

**Given:** A complete installed release and durable data exist; separate fresh contexts have no Workspace.

**When:** Exercise B-02/B-03/B-06/B-07: install where exposed, ordinary tab launch, stop all app processes and relaunch with network disabled; test each readiness failure, runtime failure and staged release failure during an active form.

**Then:** All-pass functional checks permit mutation even with unconfirmed protection and a visible warning. Failed fresh contexts create no Workspace; readable existing data has Recovery Only; unreadable root is preserved Integrity Blocked. Manual D1 journey works offline. Active form/update failures preserve fields and prior compatible inventory/root.

**Durable/failure/critic evidence:** HTTPS and environment provenance, full asset hashes, worker control, readiness reasons/receipts, RuntimeNotWritable results at each installed mutator, offline actual UI run and unchanged facts. No imaginary prior-schema migration is claimed for the first release.

**Tasks:** [D1-T02](d1-stock-open.md#d1-t02), [D1-T03](d1-stock-open.md#d1-t03), [D1-T12](d1-stock-open.md#d1-t12), [D1-T15](d1-stock-open.md#d1-t15).

### D1-A07

**History, accessibility and private reconstruction**

**Fixture:** D1-A01/A03 records plus renamed/inactive historical reference labels.

**Given:** Saved writing, frozen Plans and private indexes exist.

**When:** Browse/filter/inspect Trade and Journal in wide/narrow layouts, resize an active Plan/opening form, use keyboard/accessible text, then delete only named private projections and rebuild.

**Then:** History labels/definitions/anchors remain truthful; new inactive-reference use is blocked. Route/filter/selected record and unsaved values survive adaptation. Rebuilt visible and durable results are observationally identical; ordinary reads do not repair authoritative disagreement.

**Durable/failure/critic evidence:** B-08/B-09 semantic tree, contrast/focus record, before/after projection comparison and stable authority digests. No option, report or independent scaling controls are advertised.

**Tasks:** [D1-T05](d1-stock-open.md#d1-t05), [D1-T07](d1-stock-open.md#d1-t07), [D1-T11](d1-stock-open.md#d1-t11), [D1-T12](d1-stock-open.md#d1-t12).

### D1-A08

**Installed-prefix scale and complete D1 release gate**

**Fixture:** 25,000 legal Planned/Abandoned/Open Trades, 200 Open, generated through installed operations; disclosed actual fact counts.

**Given:** D1 unit/integration/browser flows pass and a reproducible installed-prefix dataset exists.

**When:** Run B-10 offline cold/warm timings and bounded-query/correctness checks, then have a fresh critic start runtime and execute D1-A01…A08 and applicable B flows.

**Then:** Meet 2500 ms cold/1500 ms warm p95 for the declared prefix, with complete Open rows/calculations/coverage and no ordinary all-history replay/N+1. Record capacity forecast for mature data, while explicitly withholding full canonical mature-history certification.

**Durable/failure/critic evidence:** Dataset manifest, raw samples, percentile computation, queries, release/environment hashes, cumulative suites and every-flow fresh-critic report. Any failure requires reproducing test and another fresh full-flow critic.

**Tasks:** [D1-T16](d1-stock-open.md#d1-t16).

## Completion gate

The last task is the release gate. All 16 tasks, 93 per-case unit specifications, 8 current acceptance flows and applicable shared B flows require actual recorded passing evidence. Earlier deliverables remain protected by cumulative tests. Migration/Restore/rebuild/capacity checks cover every newly installed fact family. No flow is currently covered and no future capability is advertised by this document.
