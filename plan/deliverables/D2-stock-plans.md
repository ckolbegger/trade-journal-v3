# D2 — Stock Plans

## Outcome

The trader plans a Long Stock trade before entering it: Underlying, Account, planned quantity, intended entry price (with an optional acceptable range), one or more Stops and Targets, Trade tags, Idea Source, and the Plan Reflection. Confirming freezes the Plan and shows Original Planned Risk (1R), Original Planned Reward, and the planned reward/risk ratio. Planned Trades appear in the Trades list and Trade Detail, and a Plan can be abandoned with a reason. Existing D1 data migrates safely when the D2 release activates.

**Production-UI entry points:** New Plan (two steps); Trades list; Trade Detail; Abandon Plan dialog; Migration Blocked screen.

**Plan preview:** PD-008 adds a non-mutating Trade Workflows `previewPlan` operation (ADR 0011, a `main` spec change), so the New Plan form shows 1R and planned reward/risk live from Trade Analysis `assessPlan`; the UI never computes them. It is added here as task T2.12, detailed once the spec change is on `main` and before D2 starts. Until then, the tasks below describe the confirmation-result display, which remains correct after a successful confirmation.

## Installed capabilities after D2 (in addition to D1)

| Module | Operations / variants |
|---|---|
| Trade Workflows | `confirmPlan` (Long Stock), `abandonPlan` |
| Trade Record | `prepareChange` (Confirm Plan, Abandon Plan), `applyPreparedChange`, `getRecord` (`Summary`, `AnalysisInput`), `queryRecords` (`CurrentState`, Plan Time sort) |
| Trade Analysis | `assessPlan` (Long Stock), `derive` (Trades without Position Changes) |
| Journal | `prepareEffects` and `applyPreparedEffects` (Plan Reflection, complete now), `query` (Trade narrative projection) |
| Trade Views and Reporting | `browseTrades` and `getTradeDetail` (Planned and Abandoned Trades) |

Only Long Stock is offered in New Plan; other seeded Strategies remain visible in Reference screens but have no planning capability yet.

## Plan facts for Long Stock

Following the spec and the consolidation handoff's type sketches:

- Strategy, Account, Trade tags (Tag Values), optional Idea Source (an IdeaSource Tag Value).
- One Planned Leg: role Long Stock, exact Stock Instrument (ticker), positive quantity (fractional shares allowed).
- Intended entry price (the single baseline reference) and an optional acceptable entry range that never replaces it.
- One or more Stops, each an underlying-price trigger *at or below* a price, and one or more Targets, each *at or above* a price. Trade Analysis derives each condition's monetary boundary per share so it rescales with the remaining position later.
- Thesis and Invalidation from the Plan Reflection's semantic roles, entered once.
- Confirmation Economic Time, defaulting to now in the Workspace time zone.

## Tasks

### T2.1 Exact decimal values and Stock instruments (B)

- **Depends on:** D1
- **Seam:** `src/shared/index.ts` (`Money`, `Price`, `Quantity`, `StockInstrument`, `FactOrder`)

```text
describe("Decimal values")
  it should parse "48.35" exactly and print it in canonical form
  it should reject non-string input at the parsing boundary
  it should reject malformed text such as "1,000", "1e3", and ""
  it should add, subtract, and multiply exactly, so 100 × (50.10 − 48.35) equals 175
  it should divide with 34 significant digits and half-even rounding
  it should compare equal values equal regardless of trailing zeros
  it should serialize to the canonical string used in storage and parse it back unchanged
describe("Stock instrument")
  it should normalize a ticker to upper case and accept a class suffix such as BRK.B
  it should reject an empty or malformed ticker
describe("Fact order")
  it should order facts by Economic Time and then Recorded Sequence
```

### T2.2 Schema version 2 and migration (B)

- **Depends on:** D1
- **Seam:** `src/domain/persistence/migrations.ts` and the section validators in `src/domain/reference-catalog/validate.ts` and `src/domain/journal/validate.ts` (reused by Restore in D8).

```text
describe("Migration to schema version 2")
  it should add the Trade Record stores, lifecycle index, and Journal entry and obligation stores
  it should preserve every version 1 record unchanged
  it should run the Catalog and Journal section validators inside the upgrade transaction
  it should abort the upgrade and leave version 1 intact when a validator fails
  it should report Migration Blocked with the validator's findings
  it should succeed on retry once the cause is removed and record a migration receipt
  it should ask the trader to close other open tabs when an older tab blocks the upgrade
describe("Catalog section validator")
  it should reject duplicate stable identities
  it should reject a broken label or availability history
  it should reject an Account whose Institution changed between revisions
  it should reject two records holding the same unique role or seed key
  it should reject indistinguishable current labels within one namespace
describe("Journal section validator")
  it should reject a missing fixed Entry Type or Source
  it should reject a definition revision chain with a gap
```

### T2.3 Trade Analysis: Long Stock plan assessment and Plan-only derivation (B)

- **Depends on:** T2.1
- **Seam:** `src/domain/trade-analysis/index.ts` (`assessPlan`, `derive`)

```text
describe("Long Stock plan assessment")
  it should accept a complete plan and return 1R equal to (intended entry − nearest Stop) × planned quantity
  it should return Original Planned Reward as (nearest Target − intended entry) × planned quantity
  it should return the planned reward/risk ratio
  it should use the highest Stop below entry and the lowest Target above entry when several exist
  it should keep every Stop and Target condition with its own boundary detail
  it should reject a Stop at or above the intended entry price
  it should reject a Target at or below the intended entry price
  it should reject a plan with no Stop or no Target as incomplete management
  it should reject legs that do not match the Long Stock shape
  it should reject a non-positive quantity
  it should reject an acceptable entry range whose low exceeds its high
  it should report every issue together
  it should return Planned Expiration Payoff as Not Applicable for a stock-only plan
  it should record the exact Instrument as the leg's conformance evidence
  it should keep exact decimal results, for example 100 shares from 50.10 with a 48.35 Stop gives 1R of 175
describe("Plan-only derivation")
  it should expect lifecycle Planned for a confirmed Plan with no Position Change
  it should expect lifecycle Abandoned when an effective Abandonment fact exists
  it should report disagreement when the stored lifecycle differs from the expected one, without repairing it
  it should derive the same Plan Baseline from frozen facts as the assessment returned at confirmation
```

### T2.4 Trade Record: Plan facts, lifecycle, and queries (B)

- **Depends on:** T2.2, T2.3
- **Seam:** `src/domain/trade-record/index.ts`

```text
describe("Prepare change")
  it should build a candidate Trade for Confirm Plan without writing or reserving identities
  it should return before and candidate AnalysisInput records with a canonical digest
  it should reject Abandon Plan for a stale expected revision
describe("Apply prepared change")
  it should assign durable Trade and fact identities and return the candidate-to-durable mapping
  it should store lifecycle Planned with its causing fact and FactRevision binding
  it should store lifecycle Abandoned with the Abandonment fact
  it should give same-time facts deterministic Recorded Sequences
  it should reject a reconciliation whose digest does not match the candidate
  it should refuse to run outside a coordinator-owned transaction
describe("Record reads")
  it should return the Summary or AnalysisInput projection with its FactRevision
  it should return NotFound for an unknown Trade
describe("Record queries")
  it should select current lifecycle membership from the lifecycle index
  it should combine Account, Strategy, Underlying, Tag, and Idea Source filters with AND across dimensions and OR within one
  it should sort by Plan Time descending and then Trade identity
  it should page with a cursor bound to the normalized query and snapshot
  it should reject a cursor after the snapshot changes
  it should return AnalysisInput pages as one batch from one snapshot
```

### T2.5 Journal: Plan Reflection effects and Trade narrative (B)

- **Depends on:** T2.2
- **Seam:** `src/domain/journal/index.ts` (`prepareEffects`, `applyPreparedEffects`, `query`)

```text
describe("Prepare Plan Reflection")
  it should accept a complete form for the current definition revision and snapshot its prompt wording and option labels
  it should reject a form for a definition revision that is not current
  it should report every missing required answer
  it should reject an option that does not belong to its prompt
  it should reject a Scale answer outside 1–5
  it should store an unanswered optional prompt as Unanswered, never as declined
  it should return the Thesis and Invalidation answers by semantic role
  it should reject Defer or Decline for Plan Reflection
  it should bind a candidate Trade Anchor without reserving an identity
describe("Apply prepared Journal effects")
  it should map candidate Anchors to durable Trade identities from Trade Record's mapping
  it should reject a second outcome for the same obligation key
  it should refuse to run outside a shared semantic transaction
  it should return the staged Entry projection with Source Plan Confirmation and Plan origin
describe("Trade narrative query")
  it should return Entries anchored to the Trade with their snapshots, Source, and origin
  it should bind the result to the Journal revision it read
```

### T2.6 Trade Workflows: confirm and abandon (B)

- **Depends on:** T2.3, T2.4, T2.5
- **Seam:** `src/domain/trade-workflows/index.ts` (unit tests mock collaborators)

```text
describe("confirmPlan")
  it should resolve Account, Strategy, Trade tags, and Idea Source as NewSelection under one Catalog snapshot
  it should take Thesis and Invalidation from the Plan Reflection's semantic roles into the Plan facts
  it should return every reference, form, and Plan issue together and write nothing when any exists
  it should commit the Trade, frozen Plan, Planned lifecycle, and completed Plan Reflection in one transaction
  it should recheck the Catalog snapshot inside the transaction and return Conflict without writing when a reference changed
  it should return the committed Trade projection, Plan Baseline with 1R, and the saved Entry bound to the new revisions
  it should give the Entry Source Plan Confirmation, a Trade Anchor, and Plan origin
  it should return RuntimeNotWritable and write nothing when readiness is not Writable
describe("abandonPlan")
  it should require one active Abandonment Reason
  it should store lifecycle Abandoned with the reason and Economic Time in one transaction
  it should record neither a Close Reason nor a Terminal Disposition
  it should reject a Trade that is not Planned
  it should return Conflict for a stale expected revision
  it should return the post-commit Trade projection
```

### T2.7 Trade Views: browse and detail for Planned and Abandoned Trades (B)

- **Depends on:** T2.4, T2.5
- **Seam:** `src/domain/trade-views/index.ts`

```text
describe("browseTrades")
  it should expand an Institution filter to its Accounts under one Catalog snapshot
  it should pass AND-across and OR-within filters to Trade Record
  it should present a Planned item with 1R, Original Planned Reward, ratio, and entry readiness
  it should present an Abandoned item with its Abandonment Reason and Plan context
  it should use current labels and show inactive status in list items
  it should keep cursor order independent of calculated values
  it should return ChangedDuringAssembly when snapshots still diverge after its bounded retry
describe("getTradeDetail")
  it should return the frozen Plan, original Stops and Targets, Plan Baseline, and lifecycle for a Planned Trade
  it should include the Plan Reflection from the Trade narrative
  it should show the label in effect when the reference was selected and the current label when they differ
  it should show the Abandonment Reason and no Terminal Disposition for an Abandoned Trade
  it should return NotFound for an unknown Trade
```

### T2.8 Services and capability manifest update (B)

- **Depends on:** T2.6, T2.7

```text
describe("Installed Capability Manifest for D2")
  it should add exactly the D2 operations and variants listed in this plan
  it should list Long Stock as the only Strategy with planning capability
```

### T2.9 New Plan screens (B)

- **Depends on:** T2.8

```text
describe("New Plan step 1")
  it should offer only Strategies with installed planning capability
  it should normalize the ticker as typed and show validation next to the field
describe("New Plan step 2")
  it should render the Plan Reflection prompts from the exact definition loaded for the form
  it should render single-choice prompts as a labelled radio group
  it should require at least one Stop and one Target and allow adding more of each
  it should accept prices and quantities as decimal text only
  it should default the confirmation time to now in the Workspace time zone and allow changing it
  it should show each rejection issue next to its field and keep every entered value
  it should show 1R, Original Planned Risk, Original Planned Reward, and the ratio from the confirmation result without another request
  it should call no service when the form is abandoned
  it should explain a Catalog conflict and keep the input
describe("Money and price display")
  it should show Money with a dollar sign, two decimals, and an explicit minus sign when negative
  it should right-align numbers with tabular figures
```

### T2.10 Trades list and Trade Detail screens (B)

- **Depends on:** T2.8

```text
describe("Trades list")
  it should filter by lifecycle using toggle chips with filter semantics
  it should filter by Account, Institution, Strategy, Underlying, Tag, and Idea Source
  it should load more results from the returned cursor
  it should explain an empty result and offer New Plan
  it should show 1R and ratio for Planned items and the reason for Abandoned items
describe("Trade Detail for Planned and Abandoned Trades")
  it should show the Plan, Stops, Targets, Plan Baseline, and Plan Reflection
  it should show lifecycle and Abandonment Reason as separate facts
  it should show historical and current labels when a reference was renamed
describe("Abandon Plan dialog")
  it should require an active Abandonment Reason
  it should show the abandoned Trade from the result without reloading
```

### T2.11 Migration Blocked screen (B)

- **Depends on:** T2.2, T2.8

```text
describe("Migration Blocked screen")
  it should state that existing data is unchanged and show the findings
  it should offer retry
  it should ask the trader to close other tabs when the upgrade is blocked by one
```

## Integration tests

| ID | Scenario | Durable-state proof | Green after |
|---|---|---|---|
| I2.1 | `confirmPlan` commits Trade, Plan facts, lifecycle index, and Plan Reflection together. | Reopen the database; Trade Detail equals the confirmation result (AC-RESP-001). | T2.6 |
| I2.2 | Rejections: Stop above entry (no numeric baseline), two legs (incoherent shape), missing Thesis (missing reflection answer), inactive Account. | Typed issues returned; full store dump unchanged. | T2.6 |
| I2.3 | Strategy retired between form load and confirmation. | Conflict; store dump unchanged. | T2.6 |
| I2.4 | `abandonPlan` on a Planned Trade. | Lifecycle Abandoned in index; no Close Reason or Terminal Disposition. | T2.6 |
| I2.5 | Account renamed after confirmation. | Detail shows historical and current labels; Plan facts unchanged. | T2.7 |
| I2.6 | Version 1 database with D1 data migrates to version 2. | Every version 1 record unchanged. A disclosed raw write that makes the Catalog invalid yields Migration Blocked with version 1 intact; retry succeeds once removed. | T2.2 |
| I2.7 | `confirmPlan` while readiness is Recovery Only. | RuntimeNotWritable; store dump unchanged. | T2.6 |
| I2.8 | 60 Plans across Accounts, Strategies, and Tags. | Filter results follow AND/OR rules; a cursor is rejected after a new Plan is confirmed. | T2.7 |

## End-to-end tests

| ID | Scenario | Acceptance | Green after |
|---|---|---|---|
| E2.1 | Plan a Long Stock trade in wide and narrow layouts, keyboard only; detail shows 1R; restart the browser and it persists. | AC-PLAN-001, AC-UI-002 | T2.9, T2.10 |
| E2.2 | Submit an invalid Plan; errors appear next to fields; after reload nothing was saved. | AC-PLAN-002 | T2.9 |
| E2.3 | Abandon a Plan with a reason. | AC-LIFE-002 | T2.10 |
| E2.4 | Update from the D1 release to the D2 release with existing data: migration succeeds with data intact. Second run with a disclosed corrupting raw write: Migration Blocked screen, retry after removal succeeds. Third run with an old-release tab open: close-other-tabs message. | AC-REST-004 | T2.11 |
| E2.5 | Resize during a half-filled Plan form. | AC-UI-001 | T2.9 |
| E2.6 | Axe scan of every new screen. | AC-UI-002 | T2.9, T2.10, T2.11 |
| E2.7 | No Position Change, Journal, or Backup actions are offered. | AC-CAP-001 | T2.10 |

## Critic flows

| ID | Flow |
|---|---|
| C2.1 | Plan a Long Stock trade in a wide window and read 1R and ratio. |
| C2.2 | The same in a narrow window. |
| C2.3 | Invalid Plans: Stop above entry, missing Thesis, no Target. |
| C2.4 | Several Stops and Targets: the nearest boundaries drive 1R and reward, and every condition stays visible. |
| C2.5 | Abandon a Plan. |
| C2.6 | Trades list filters and paging. |
| C2.7 | Rename an Account and check historical and current labels on an existing Plan. |
| C2.8 | Keyboard-only Plan creation. |

## Acceptance mapping

| Scenario | Coverage in D2 |
|---|---|
| AC-PLAN-001 | T2.3, T2.6, I2.1, E2.1 |
| AC-PLAN-002 | T2.3, T2.5, T2.6, I2.2, E2.2 |
| AC-LIFE-002 | No-execution case: T2.6, I2.4, E2.3 (execution case in D3) |
| AC-REF-002 | Trade case: I2.3, I2.5 (Journal case in D4) |
| AC-REST-004 | T2.2, I2.6, E2.4 (export route re-verified in D8) |
| AC-RESP-001 | I2.1 (Plan family) |
| AC-UI-001, AC-UI-002, AC-CAP-001 | E2.5, E2.6, E2.1, E2.7 (cumulative) |
