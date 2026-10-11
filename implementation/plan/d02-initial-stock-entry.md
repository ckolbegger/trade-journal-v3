# D2 — Initial Stock entry: detailed task breakdown

Status: planning draft; no implementation authorization or completed evidence.
Authority: [D2 in the delivery plan](../delivery-plan.md#2-record-opening-fills-and-the-entry-decision), [approved stack](../technology-stack.md), and frozen [contracts](../../specs/README.md). Depends on the accepted D1 release, including its readiness, transaction, numeric and evidence rules in [D1](d01-long-stock-plan.md). These task seams are proposed for review, not tests already written.

## Outcome, stories and boundaries

Production flow: Planned list → Trade Detail → Record initial Position Change → enter all broker Executions for one complete decision → choose Complete/Defer/Decline → Save → inspect returned Open Trade, fulfillment, fees and reflection outcome. The global Debt queue is reachable from navigation and Trade Detail; answer or decline Journal-only Debt explicitly.

- As a trader, I would like to record my opening fills against the planned leg, so that I can see the actual position and how my entry compares with the plan.
- As a trader, I would like to complete, defer, or decline the entry reflection explicitly, so that I can capture the facts even when reflection must wait.

One Long Stock Trade, one complete initial decision, one or several buy Executions. Total submitted quantity must equal the frozen planned quantity; incomplete initial entry or subsequent adds wait for D10. The installed capture path uses the exact planned Stock Instrument and original management coverage. Analysis retains deterministic served-leg mismatch semantics, but this release rejects candidate exposure on another Stock Instrument when its management would be incomplete; it cannot invent management or relabel a mismatch Explicitly Unplanned. Selective/unplanned legging waits for D12. No sells, valuation, management revision, corrections, Journal Edit/Addendum/Void or report selectors. Completing or deferring reflection never changes economics. Due-Debt Review blocking arrives in D4. No backup before D6, no Restore before D17, per the accepted exception.

## Representation, bindings and command effects

Extend the D1 logical schema to version D2 inside a staged generation, preserving every D1 identity and snapshot. Add Position Change membership/origin, immutable Execution versions (Stock Instrument, buy action, exact quantity/price/fee, economic instant, observation/selection evidence, planned-leg intent), Recorded Sequence, Entry Resolution evidence, authoritative reconciliation records and Journal obligation transitions. Opening Lots and weighted average are derived; a private projection may cache them with Trade FactRevision and analysis-policy version. Do not store competing P&L or basis on links.

Add only exact Position Change Reflection prompts/options/rules and Source Position Change from the Journal contract. Stable obligation key identifies the decision and type. Defer stores one Debt and trigger-time form, never an Entry. Due time is the originating Position Change Economic Time; Review selects it when due-through cutoff reaches that instant. Complete creates one Trade-anchored Entry with decision origin; Decline a distinct outcome. ResolveDebt answers the original snapshot, never the current definition. Do not seed unused Entry Types.

`recordPositionChange` binds Trade FactRevision, Account/Strategy retained references, exact served planned-leg identity, definition revision, obligation absence/current revision, active generation, readiness epoch and Workspace content revision. Preparation is inert. The transaction includes Trade facts/heads, lifecycle and current-state index, recorded deterministic deviations and lot agreement, Journal outcomes/history, private invalidation, sequences and Workspace revision. Recheck all participant revisions before applying. Return new durable identities, Open projection, required derivation/Entry Quality and exact Journal outcome only after commit. A failed or stale save leaves no membership, sequence reservation, Debt or Open index entry.

The trader accepted lossless quotient values on 2026-10-11: decimal.js remains the financial engine; derived nonterminating allocations/averages/ratios use numerator/denominator decimal strings. Exact addition/comparison cross-multiplies at sufficient precision; no rounded quotient is fed back. Allocate fee `f × matched quantity / opening quantity`, and disposal fee over its matched quantity. Sum portions exactly to original fee; no per-lot cent rounding or tolerance test. Durable fees remain original decimal strings; links retain quantity only. D5 consumes these Lots, D11 adds partial realization. Display cents/price/ratio rounding is presentation only.

## Explicit task completion edges

These are blocking edges for task completion. UI work may start after the contract-fixing task, as described under parallelism, but cannot finish before its real domain/persistence prerequisites. Review/freeze prerequisites remain external to this implementation graph.

| Task | Required predecessor tasks |
|---|---|
| D2-T01 | D1-T10 |
| D2-T02 | D2-T01 |
| D2-T03 | D2-T01 |
| D2-T04 | D2-T02, D2-T03 |
| D2-T05 | D2-T04 |
| D2-T06 | D2-T04, D2-T05 |
| D2-T07 | D2-T01, D2-T02, D2-T03, D2-T04, D2-T05, D2-T06 |

## Ordered tasks and evidence cases

All behavior-bearing cases follow D1's one-case Red → minimal Green → next-case procedure and record seam, exact fixture, command/outcome and revisions. Structural checks record reproducible procedures. No task is a separate release.

### D2-T01 — Fix opening contracts and stage the D1→D2 representation (structural)

Blocked by D1-T10. Single schema/transaction owner; seam is Workspace initialization and Trade Workflows request/result types. Specify installed opening-only variant, exact union failures and post-commit payload, stable obligation keys and store/index participant set before parallel work. Extend the lossless migration candidate validator and private reconstruction for installed facts only.

Verification: strict typecheck/build of the eventual code; open a command-created D1 database under D2, compare normalized Catalog, Plan and Journal histories before/after, inspect migration/seed receipt, then run D2-I03 below. Expected: unchanged D1 facts, new supported representation/defaults, no false Open state. Physical key/index changes require an explicit Dexie version upgrade with abort/blocked-tab handling; do not rely on in-place schema edits.

### D2-T02 — Derive the complete opening decision

Blocked by D2-T01. Owner: Trade Analysis; public seams `derive` and opening `assessChange`. Observable: coherent Lots, fulfillment, resolved Entry Quality, baseline and deterministic terms findings from explicit inputs.

`describe("complete Stock entry derivation")`

- it should derive 100 shares from buys 40 at 49 with fee 1 and 60 at 51 with fee 2 in one decision, with gross basis 5,020, opening fees 3 and no realized result; frozen 1R remains 500 for the D1 fixture.
- it should resolve weighted entry 50.2 and actual risk 523 to Stop 45 and reward 977 to Target 60, including opening fees exactly once, and label Entry Quality below the frozen 2:1 plan ratio.
- it should keep both Lot identities/order for equal economic instants using explicit Recorded Sequence, independent of array order.
- it should report a supplied served-leg candidate with a different Stock Instrument as Filled With Deviation and one Planned-Leg Terms occurrence listing mismatches, without inventing Unplanned Exposure; assessChange also reports missing management coverage, so this opening-only command cannot accept that candidate.
- it should reject a zero/negative quantity, negative fee, nonfinite decimal, or sum different from planned quantity for this installed complete-entry variant, with all issues and no accepted reconciliation.
- it should preserve lossless average/fee shares for buys of 1 and 2 shares whose fee division repeats, and prove exact conservation and exact comparisons without cent rounding.

### D2-T03 — Prepare reflection outcomes and Journal-only Debt resolution

Blocked by D2-T01. Owner: Journal; seams `getDefinitions/prepareEffects/applyPreparedEffects/save/query` for installed outcomes. Observable: one explicit outcome per obligation with immutable prompt snapshots.

`describe("Position Change reflection outcomes")`

- it should validate all required Decision Mode, Emotion and Confidence responses on Complete and reject missing/invalid stable options or scale outside 1–5.
- it should prepare Defer without reserving identities, then commit exactly one Outstanding Debt using the trigger-time definition and no blank Entry.
- it should record Decline distinctly from Unanswered optional Note or Debt.
- it should answer stored Debt with its exact original form, create the Entry and settle the Debt in one commit, returning both projections; an allowed decline instead records a decline and resolves the obligation.
- it should reject stale Debt revision or a competing completion without duplicating current outcomes.
- it should return NeedsTradeWorkflow with the exact route when handed workflow-routed Debt; do not implement management capture or fabricate such Debt through ordinary D2 UI.

### D2-T04 — Commit facts, lifecycle and reflection as one command

Blocked by D2-T02 and D2-T03. Owner: Trade Workflows/Transaction, never React. Seam `recordPositionChange` → `PositionChangeResult`.

`describe("atomic complete initial Stock entry")`

- it should commit the 40/60 fixture as two owned Executions inside one Position Change, transition Planned→Open, return resolved derivation and exactly one reflection outcome, and make them retrievable after reopening storage.
- it should reject a second initial-entry submission after the first succeeds, a stale Plan revision or a different Stock Instrument lacking complete management, without another fill, outcome or lifecycle change.
- it should commit valid facts with Defer or Decline regardless of outstanding reflection Debt from other decisions, while leaving that Debt unchanged.
- it should roll back Trade facts, lifecycle/index, deviations, Journal, sequence and Workspace binding when an induced Journal apply/storage abort occurs.
- it should return RuntimeNotWritable with all current failed checks when readiness fails before apply, with no staged authoritative effects.

### D2-T05 — Extend coherent reads and integrity evidence

Blocked by D2-T04. Owner: Trade Views and Reporting/Trade Record. Seams `browseTrades/getTradeDetail/history/resolveAnchors` and Journal query. Observable: Open holdings, frozen Plan, Lots, opening fee, fulfillment and Debt/history from one read binding.

`describe("Open Stock detail and factual agreement")`

- it should expose the 40/60 Lots and resolved Entry Quality while keeping current valuation uninstalled and absent.
- it should list the Trade only in the authoritative Open membership and resolve each Execution Anchor to that Trade.
- it should surface lifecycle, recorded lot-agreement or deviation mismatch from a controlled integrity fixture and never repair it on read.
- it should return ChangedDuringAssembly instead of a mixed Trade/Journal view when a concurrent Debt answer prevents a coherent snapshot.

### D2-T06 — Deliver opening, reflection and Debt UI

Blocked by D2-T01 for fixed types; integration blocked by D2-T04/D2-T05. Owner: UI under the single shell owner. Use semantic forms, per-row Execution IDs in view state, explicit decision-level heading and definition-bound reflection choices.

`describe("initial entry and Debt production UI")`

- it should retain several entered Executions and reflection selection while resizing or displaying a conflict, but Cancel/navigation without Save writes nothing.
- it should render the returned Open Trade and Entry/Debt/Decline directly from successful Save without an operation-required read.
- it should show missing required reflection answers and quantity-sum failures accessibly, focus the error summary/field, and preserve input for repair.
- it should open the exact owed form from the Debt queue, then display the returned settlement outcome without a read-back; no scale-in, exit or Edit control appears.

### D2-T07 — Cumulative integration, browser and release gate (structural)

Blocked by D2-T01–D2-T06. Publish the complete opening/Journal-resolution variants only after evidence passes. Single release manifest owner adds all newly required assets to the digest-valid inventory. Apply the D1 gate and fresh-critic repair loop to all D2 flows below; no implementation agents or critics are launched during planning.

## Mock-free integration and restart/failure proofs

Fixtures use real Workspace/Catalog/confirmPlan commands. Fast Vitest integration may replace only IndexedDB infrastructure with disclosed fake-indexeddb, plus explicit clock/identity inputs; no Trade Analysis, Journal, coordinator, readiness result or application response mocks. Actual readiness is separately proved in browser-owned IndexedDB; fast infrastructure runs cannot certify Writable.

| Case | Procedure and observable/durable proof |
|---|---|
| D2-I01 | Create D1 Plan; submit complete 40/60 opening with Complete, then repeat in isolated databases with Defer and Decline. Reopen database, query Trade/Journal histories and current Open membership; compare every returned identity/revision/value to durable state. Exactly one decision/outcome. |
| D2-I02 | Race two complete-entry commands from the same revision in separate browser contexts on the same origin. One commits; the other conflicts. Force transaction abort after Trade staging and before Journal completion, then restart; normalized authoritative histories are wholly before, never mixed. |
| D2-I03 | Migrate populated D1 to D2 candidate; inject validation failure, crash before pointer activation and stale-tab apply. Old active facts stay usable; successful retry activates one candidate with nonoverwriting seeds. Delete only documented private projections in a reconstruction fixture; rebuild equivalent lists/detail/fulfillment/fees/Debt. |
| D2-I04 | Answer and decline due Debt through Journal.save, repeat with stale revision. After restart one current outcome persists, exact trigger form/source/origin and economic/authored times retained; no fabricated Entry for defer/decline. |

## Planned independent browser flows

- **D2-B01:** From retained Planned Trade, record two broker Executions in one decision, Complete reflection, inspect returned Open position and Lots; stop browser, disconnect network, reopen and inspect facts/history.
- **D2-B02:** Repeat with Defer and Decline; answer/decline Debt from global queue; verify factual capture and the separate writing obligation. Cancel a filled form, restart, confirm no captured evidence.
- **D2-B03:** Competing tab save and blocked readiness; demonstrate preserved input, typed conflict/no-write and readable recovery. Inspect one-call success trace.
- **D2-B04:** Run B01/B02 keyboard-only at 390 and 1440 px, resize through 767/768 px without reload, 200% zoom/reflow, radio-group roles, field labels, focus and AA contrast. Distinguish Loading/Empty/Error from Open Ready. Scan with axe and manually verify semantics.

A fresh critic starts its own built production runtime on worktree DEV_PORT=5174 with strictPort after cumulative suites pass, exercises B01–B04 and reports actions/results/evidence without editing. For each defect, first add one reproducing failing test, minimally fix, rerun cumulative suites, then use a new critic for all D2 flows. Specification ambiguity pauses for human resolution. Missing critic/browser/runtime is a blocker, never a self-certified pass.

## Acceptance-to-task/evidence matrix

All rows are **planned**. Full is a complete scenario assignment, not a claimed pass. D1's shared evidence procedures and environment/provenance requirements apply to each row.

| Scenario | Scope now / later completion | Tasks; test/evidence and browser proof |
|---|---|---|
| AC-LIFE-003 | Full: all installed lifecycle/lot/deviation agreement, no read repair | T02/T04/T05; I01/I03; B01/B03 |
| AC-LIFE-001, AC-POS-001 | Partial: Planned→Open, grouped broker fills, opening fee/Lot order. Full scaling/FIFO fixture D11 | T02/T04; I01/I02; B01; D5 adds whole disposal |
| AC-POS-005 | Partial: exact Stock served-leg fulfillment/terms. Multi-leg D8; unplanned/selective D12–D13; full objective fixture D26 | T02/T04; I01; B01 |
| AC-CALC-001 | Partial: frozen baseline and resolved complete-entry comparison. D10 staged entry, D11 reductions, D16 management/full | T02/T05; I01/I03; B01 |
| AC-JOUR-003 | Partial: defer is Debt, capture unblocked. Full due-Debt Review block D4 | T03/T04/T06; I01/I04; B02 |
| AC-JOUR-005 | Partial: one unique Complete/Defer/Decline/answer outcome. Sole-answer Void/reopen completes D19 | T03/T04; I02/I04; B02/B03 |
| AC-JOUR-007 | Partial: exact added reflection/defaults. Fixed identities complete D15, runtime-customization/reseed full D23 | T01/T03; I03/I04; B02 |
| AC-RESP-001 | Partial globally; complete for every installed D2 mutation. Bounded multi-Trade fixture D15 | T03/T04/T06; I01/I04 response equivalence; B01–B03 traces |
| AC-REST-004 | Partial: actual D1→D2 migration failure/retry; Restore/artifact paths D17 | T01/T07; I03; B03 |
| AC-DEL-001–004, AC-CAP-001, AC-UI-001 | Full for installed release under accepted backup/Restore timing exception | T01/T04/T06/T07; D1 readiness/update matrix repeated with opening and Debt; I01–I04; B01–B04 |
| AC-DEL-005–006 | Partial: readable recovery, unreadable-store protection, every mutator gated; D6 export, full Restore boundary D17 | T04/T07; I02/I03; B03 |
| AC-UI-002 | Partial globally; complete installed screens; replay D14, full destructive Restore fixture D17 | T06/T07; B04 |
| AC-REBUILD-001, AC-PERF-001 | Partial: D2 representations rebuilt equivalently; target-sized stock workload, indexed/batched open path and required latency. Full mixed workload D28 | T01/T05/T07; I03; D1 benchmark procedure extended, B01 |

Other canonical scenarios remain intentionally unadvertised per the complete disposition ledger in D1; no deferred feature is implemented to satisfy a future fixture.

## Ownership and safe parallel work

After T01 fixes interfaces, Analysis T02 and Journal T03 can proceed independently; UI T06 can prepare against agreed types without canned integration results. T04 waits for both, T05 waits for real commits, T07 integrates all tracks. One owner controls schema/generation migration, sequence/Workspace bindings and transaction membership; one controls Journal keys/seeds; one controls shared analysis/numeric policy; one controls shell/release inventory. No blanket cross-deliverable parallel execution.
