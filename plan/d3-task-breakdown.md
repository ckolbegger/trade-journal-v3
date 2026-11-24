# Deliverable 3 — task breakdown

Scope: Open a Long Stock position. Builds on D2. Frozen baseline `plan/freeze.md` rev `c5d28a8a`; DEV-001 applies. Declared scope: no valuation or Mark until D4; no disposal or closing Lot Matches until D6. No Execution as a separate operation, no Mark, no Review, no Report, no Backup/Restore, and no close control is advertised. `TradeAnalysis.derive` and the lifecycle index update are owned here and reused unchanged by later deliverables.

## Structural tasks

### D3-S1 — Capability manifest update
Add to the D3 Installed Capability Manifest, on top of D1/D2: `TradeWorkflows.recordPositionChange` (opening), `TradeAnalysis.derive`, `TradeRecord.prepareChange`/`applyPreparedChange`/`getRecord`/`queryRecords`/`history`, `TradeViewsAndReporting.browseTrades(Open)`/`getTradeDetail(Open)`, `Journal.prepareEffects(PositionChangeReflection)`/`applyPreparedEffects`/`query`. Navigation keeps D1/D2 entries; "Add Execution" is reachable only as an action from a Planned Trade detail, never as a top-level operation or separate nav item. No Execution-operation nav, close control, Mark, Review, Report, Backup or Restore appears; no fake `Unavailable` placeholder for an undelivered capability.
**Verification:** `npx vitest run tests/structural/d3-capability-manifest.test.ts` asserts the exact added set, that D1/D2 capabilities remain, and that Execution-as-operation / close / Mark / Review / Report / Backup / Restore are absent.

### D3-S2 — Durable representation
Within the existing schema v2 `trade` and `journal` stores, persist: one Position Change with a shared decision identity and stable member order; Execution facts carrying exact Instrument, buy/sell, quantity, price, fee, Economic Time and Recorded Sequence, each with one owning Trade and one named Planned-Leg intent (or ExplicitlyUnplanned); open Lot records with basis and unconsumed opening fee; lifecycle index membership `Open` bound to a FactRevision; and the one Reflection outcome — completed Entry, explicit decline, or Outstanding Debt — with the trigger-time Entry Definition snapshot and a stable `JournalObligationKey`. No closing Lot Match, disposal fact, Mark or Valuation record is created.
**Verification:** `npx vitest run tests/structural/schema-v2.test.ts tests/structural/d3-durable-representation.test.ts` asserts the record shapes and that a v1→v2 migration still preserves D1 data.

### D3-S3 — Fixed command/result contract
Fix the public seam before parallel UI work: `recordPositionChange(command) -> PositionChangeResult` with a revision-bound `receipt` and `postCommit` trade projections sufficient to render the successful command without a read-back; `derive(input) -> DerivationResult` with expected lifecycle, Positions, Lots, allocated fees, realized-to-date, and agreement status. Inputs carry expected Trade revision, explicit Economic Time, and exact decimal strings for quantity/price/fee.
**Verification:** `npm run typecheck` and `npx vitest run tests/structural/d3-contracts.test.ts` assert the exported types and that no public lifecycle setter, `recordExecution`, `closeTrade` or formula toolkit exists.

### D3-S4 — Deterministic clock and U.S. trading calendar (reuse)
Reuse D2's injected clock and explicit calendar to resolve the session for the supplied Economic Time; no system clock in pure analysis; tie-break by Recorded Sequence, never wall-clock arrival or lexical identity.
**Verification:** `npx vitest run tests/structural/clock-calendar.test.ts` (existing) plus a D3 case asserting equal-Economic-Time Executions order by Recorded Sequence.

## Behaviour-bearing tasks

Each implemented test-first; RED confirmed before GREEN, earlier tests kept green.

### D3-T1 — `TradeAnalysis.derive` (opening subset)
**Seam:** `derive(input: TradeDerivationInput) -> DerivationResult`.
- `describe("derive — opening Long Stock")`
  - `it should derive one Instrument Position with exact signed net quantity from effective opening Executions ordered by Economic Time then Recorded Sequence`
  - `it should create open Lots with exact basis and allocate each opening fee proportionally across its Lot quantities exactly once`
  - `it should report realized-to-date as zero with no disposal and no closing Lot Matches in D3 scope`
  - `it should derive expected Lifecycle State Open when effective opening exposure exists and agree with a stored Open binding`
  - `it should report a structured lifecycle/lot disagreement without repairing it on read`
  - `it should keep exact decimal values so presentation rounding never changes basis or allocated fees`
- **Red/green:** `npx vitest run tests/unit/derive.test.ts -t "<case>"`.
- **Integration:** `tests/integration/derive.test.ts` with real persisted Trade/Journal reads; verifies exact basis/fee reconciliation against the stored facts.
- **Critic flow:** an Open detail shows Position, open Lots, allocated opening fees, realized-to-date and lifecycle Open; `B(open-derivation)`.

### D3-T2 — Position Change Reflection preparation and obligation keys
**Seam:** `preparePositionChangeReflection(form, definition, disposition, obligationKey)` and `positionChangeObligationKey(positionChangeId)`.
- `describe("Position Change Reflection")`
  - `it should return the exact initial Position Change Reflection definition with its four prompts and requiredness`
  - `it should snapshot the exact definition revision shown for a completed Entry`
  - `it should prepare an explicit decline with reason and no Entry`
  - `it should prepare a Defer as one Outstanding Debt with the trigger-time definition snapshot and no blank Entry`
  - `it should keep exactly one current outcome for an obligation key under repeated complete/decline/defer attempts`
  - `it should reject a missing required answer for a completed form with typed issues and no prepared effect`
- **Red/green:** `npx vitest run tests/unit/position-change-reflection.test.ts -t "<case>"`.
- **Integration:** `tests/integration/position-change-reflection.test.ts` uses the real journal store; verifies no placeholder Entry, retry conflicts and unchanged revisions on no-write.
- **Critic flow:** the reflection form offers Complete, Decline and Defer; deferring still records the fact and creates no blank Entry; retrying Save conflicts; `B(reflection)`.

### D3-T3 — `TradeWorkflows.recordPositionChange` (opening subset, atomic)
**Seam:** `recordPositionChange(command) -> PositionChangeResult`.
- `describe("recordPositionChange — opening")`
  - `it should atomically store several opening Executions as one Position Change with one shared decision identity and stable order, each bound to its Planned Leg`
  - `it should derive and store Positions, open Lots, allocated opening fees, realized-to-date and lifecycle Open in the same commit`
  - `it should return a revision-bound post-commit result sufficient to render success without a read-back`
  - `it should complete, decline or defer the single Position Change Reflection in the same transaction without blocking factual recording`
  - `it should reject a stale Trade revision, an unconfirmed Plan, or incoherent economics with typed issues and write nothing`
  - `it should expose no valuation, Mark, disposal or close control`
- **Red/green:** `npx vitest run tests/unit/record-position-change.test.ts -t "<case>"`.
- **Integration:** `tests/integration/record-position-change.test.ts` uses real persistence; verifies the atomic write set, restart/read-back, no-write on failure, and that `postCommit` equals durable state at the returned revisions.
- **Critic flow:** record a grouped opening decision from a Planned detail; the Open state appears without refresh or a follow-up read; `B(record-open)`.

### D3-T4 — Trade Record operations and Open reads
**Seam:** `prepareChange`/`applyPreparedChange`/`getRecord`/`queryRecords`/`history` for Open trades, and `browseTrades`/`getTradeDetail` Open presentation.
- `describe("Open trade reads")`
  - `it should return one AnalysisInput projection at a single FactRevision for an Open Trade with its Executions and Lots`
  - `it should list Open Trades from the lifecycle index with Position and allocated fees`
  - `it should return complete history with Execution Economic Time and Recorded Sequence`
  - `it should return NotFound for an unknown Trade and never repair a disagreement as a side effect of reading`
- **Red/green:** `npx vitest run tests/unit/open-views.test.ts -t "<case>"`.
- **Integration:** `tests/integration/open-views.test.ts` reads the committed Open Trade through the real read stack after restart.
- **Critic flow:** the Trades list shows an Open row; detail shows Executions, Lots, fees and history with no valuation/Mark/close; `B(open-views)`.

### D3-T5 — Production UI: Add Execution form and reflection
**Seam:** the production React UI, driven through `playwright-cli` and `@playwright/test`.
- `describe("Open position UI")`
  - `it should let the trader enter several Executions with exact instrument, quantity, price, fee and Economic Time as one grouped decision`
  - `it should present Complete, Decline and Defer, and still record the fact when reflection is deferred`
  - `it should show Open lifecycle, Position, Lots, allocated fees and realized-to-date with no valuation, Mark or close control`
  - `it should preserve entered-but-unsaved form values across a live wide/narrow resize`
- **Red/green:** `npx playwright test -g "<case>"`.
- **Integration:** covered by `tests/integration/record-position-change.test.ts` and `tests/integration/open-views.test.ts` (real stack, no mocks); `fake-indexeddb` is the disclosed browser-owned IndexedDB substitute.
- **Critic flow:** all four cases above against `http://localhost:5182`; `B(open-ui-*)`.

## Evidence to capture for D3
- Per-case RED (behaviour absent, not syntax/fixture error) and GREEN outputs; structural verification outputs; cumulative suite outputs; fresh-critic structured report per `B(...)` flow.
- Acceptance map: AC-JOUR-003 **full** (Defer → one Outstanding Debt with trigger-time snapshot, no blank Entry, factual recording succeeds), AC-RESP-001 **full** for `recordPositionChange` (revision-bound post-commit result, no required follow-up read), AC-LIFE-001 **partial** Planned→Open only (stored and derived agreement, index membership in same commit), AC-POS-002 **partial** one decision group (shared identity, per-Execution ownership, one reflection key), AC-JOUR-005 **partial** (one current outcome under retries; Void-settlement reopen is D5 full).
- Exact Economic Time, Recorded Sequence, decimal quantity/price/fee and commitment revision retained in records; post-restart read-back; no-write comparisons for every typed failure.

## Parallelism and ownership
S1–S4 are fixed before UI work. T1 and T2 are parallel once the derive/reflection contracts are fixed; T3 depends on T1/T2; T4 depends on T3; T5 depends on T3/T4. Single-owner resources: capability manifest (S1), schema/durable representation (S2), `TradeAnalysis.derive` and the lifecycle index (D3 owns; later steps reuse unchanged), and the one Position Change obligation key (D3 owns).
