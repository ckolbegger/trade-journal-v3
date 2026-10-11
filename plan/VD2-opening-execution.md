# VD2 — Opening execution

Working file for VD2 of `plan/implementation-plan.md` @ `477c8cd` (branch `zcode-glm-5.3`). Scope, sequence, and acceptance markings are the plan's; this file owns the detailed breakdown and living progress. Environment facts: see VD1 working file (port 5176, `127.0.0.1`, fake-indexeddb, Vitest `globals: true`).

## Scope recap (authoritative source: plan §VD2)

- **User-visible outcome:** record an opening Position Change — one decision, multiple Executions serving planned legs, single Trade, single-leg stock — and see the open position, lots, and fees; complete, defer, or decline the after-trade reflection without blocking the factual record; browse open trades and detail (facts, lots, fulfillment, journal narrative); basic Debt list with resolve form.
- **Operations exercised:** `TradeWorkflows.recordPositionChange` (opening variant); `TradeAnalysis.derive` (positions, lots, entry window, fulfillment, fact-only deviations); `Journal.save` (Debt resolution); `Journal.query` (debt, narrative); `TradeRecord` AnalysisInput projection; plus the open-browse/detail Trade Views widening (Flag F1 in the VD1 file).
- **Mechanisms:** FIFO opening-lot construction; Economic Time + Recorded Sequence ordering; obligation-key uniqueness; revision-bound post-commit results.
- **Seeds:** none (selector widening only in later VDs).
- **Durable representation:** Executions, Position Changes and membership, open lots, deviation occurrences, Debt/decline records, lifecycle index entries.
- **Acceptance (plan markings):** Partial — AC-POS-001 (opening half; closing/FIFO/fee-allocation completion at VD5), AC-POS-002 (multi-fill single decision; multi-leg conformance completes VD9), AC-POS-005 (single-leg fulfillment values; Not-Entered-at-trade-end completes VD5, multi-leg VD9/VD10), AC-LIFE-001 (Planned→Open; full lifecycle completes VD5), AC-JOUR-003 (defer→Debt with no placeholder; due-Debt-blocks-Review completes VD3), AC-JOUR-005 (basic uniqueness; full retry/void-reopen completes VD13), AC-RESP-001 (multi-fact single-Trade commands; cross-Trade multi-subject completes VD16).

## Interface-freeze gate and parallel split

- **T1 pins the opening-variant command/result types** (`PositionChangeCommand` opening shape, `TradeMutationSuccess` for it, Journal Debt/decline result shapes, fulfillment/deviation value types). After T1:
  - **Track D (domain/persistence):** T2–T7.
  - **Track U (UI):** T8–T9.
- Serialize at T10 (integration gate) and T11 (critic gate).

## Tasks

### T1 — Opening-variant interface freeze
**Type:** structural. **Depends:** VD1 complete.

TS types for the opening `PositionChangeCommand` (one decision identity, member Executions with exact Instrument, buy/sell, quantity, price, Economic Time, actual fee, per-Execution intended Planned Leg or `ExplicitlyUnplanned`, one `ReflectionDisposition`), `PositionChangeResult` (`TradeMutationSuccess` shape), fulfillment enum, the three fact-only Deviation occurrence shapes, Journal Debt/decline projections.

**Verification:** `npm run typecheck` clean with the types imported by both tracks; contract-shape fixture compiles against the module-contract vocabulary.

### T2 — TradeAnalysis.derive: positions, lots, entry window (opening)
**Type:** behavior-bearing. **Depends:** T1.

FIFO opening-lot construction with lot-aware fee allocation; derived Instrument Position (signed net quantity per exact Instrument); entry-window open/close rules as far as opening facts allow; expected Lifecycle State (Planned→Open) with agreement status.

**Seam:** `TradeAnalysis.derive` (pure; AnalysisInput fixtures built through the real VD1 command path).

```
describe("opening-lot construction and fee allocation")
- it should create one Open Lot per opening Execution with basis = price × quantity and the Execution's actual fee allocated proportionally across its created lot quantity, retained unconsumed with the lot
- it should derive the Instrument Position as the net signed quantity across all effective Executions for that exact Instrument in the Trade
- it should order same-Economic-Time facts by Recorded Sequence so lot order is stable regardless of save order

describe("entry window")
- it should open the entry window at the first Position Change that establishes exposure
- it should keep the window open while entries continue without exposure reduction (the reduction cutoff rule lands with VD5 closing facts, and its constants are fixed now)

describe("expected lifecycle (opening)")
- it should derive expected Open with nonzero exposure and agree with stored Planned only before any effective exposure, surfacing a structured integrity finding on disagreement without repairing it
```

### T3 — TradeAnalysis.derive: fulfillment and fact-only Deviations
**Type:** behavior-bearing. **Depends:** T2.

Planned-Leg Fulfillment for the single-leg case; deterministic Deviation occurrences with stable fingerprints: Planned-Leg Terms (all mismatched exact fields for one served leg in one occurrence), Entry Size (excess at entry), Unplanned Exposure (explicit intent only).

**Seam:** `TradeAnalysis.derive` (pure).

```
describe("single-leg fulfillment")
- it should return Unfilled for an untouched leg of a still-Planned trade
- it should return PartiallyFilled when fill quantity is below planned quantity
- it should return FilledAsPlanned when an Execution serves the leg with matching exact terms and quantity
- it should return FilledWithDeviation when a fill names the leg but its exact instrument terms differ (fixture: plan AAPL, fill MSFT)

describe("fact-only Deviations")
- it should record one Planned-Leg Terms occurrence per served leg aggregating every mismatched field, with a stable fingerprint derived from leg identity and mismatched fields
- it should record Entry Size when effective exposure exceeds planned quantity at entry
- it should record Unplanned Exposure only for an Execution explicitly marked ExplicitlyUnplanned, and never infer it from mismatched terms
- it should record no Deviation for target touches or price moves (only the four fixed categories exist, and only these three are reachable at VD2)
```

### T4 — TradeRecord: position-change facts, lots, and lifecycle index
**Type:** behavior-bearing. **Depends:** T2, T3.

`prepareChange(PositionChange)` builds candidate Trades without writing; `applyPreparedChange` rechecks revisions/digest, requires the analysis reconciliation, assigns durable identities to the Position Change and its member Executions with shared decision identity and stable order, stores open-lot agreement records and Deviation occurrences, and transitions stored lifecycle Planned→Open with index membership in the same commit.

**Seam:** `TradeRecord` operations over the real store.

```
describe("position-change prepare/apply")
- it should stage Executions under one Position Change identity with stable member order and per-Execution owning-Trade assignment, reserving nothing on prepare
- it should commit facts, open-lot records, deviation occurrences, stored Open lifecycle, and current/open index transitions together, returning durable identities and staged Trade projections at new FactRevisions
- it should reject with no write when the trade's expected revision is stale or the analysis binding names a different candidate digest

describe("AnalysisInput projection")
- it should return the complete effective projection for the affected Trade as one bounded batch sufficient for derive/evaluate without per-child loads
```

### T5 — Journal: Debt creation, resolution, narrative query
**Type:** behavior-bearing. **Depends:** T1.

`prepareEffects/applyPreparedEffects` for the three dispositions (Complete / Decline / Defer); Defer creates Journal Debt with the trigger-time definition snapshot, Anchor, origin, due semantics, settlement route — never a blank Entry; obligation-key uniqueness (one current outcome per key; retries conflict, never duplicate). `save(ResolveDebt)` validates against the Debt's original snapshot and settles it with the created Entry. `query` for the Debt list and the Trade narrative scope (Entries anchored to the Trade and to all of its fills, each once).

**Seam:** `Journal` operations over the real store.

```
describe("Position Change Reflection dispositions")
- it should prepare and stage a completed reflection validated against the exact rendered definition revision, using Source Position Change and a Trade Anchor to the originating Trade
- it should stage an explicit Decline as a distinct JournalDecline outcome
- it should create on Defer one Outstanding Debt carrying the trigger-time prompt snapshot and no Entry, version, or placeholder of any kind

describe("obligation-key uniqueness")
- it should reject a second outcome for the same obligation key with a typed conflict and no write (retry must revise the existing identity under expected revision, not duplicate)

describe("Debt resolution via Journal.save")
- it should validate the answer against the Debt's snapshotted definition (not the current definition) and atomically create the settling Entry and settle the Debt, returning both projections without a follow-up query

describe("narrative query")
- it should return the Trade narrative as Entries anchored to the Trade and to each of its current/superseded/Voided fill Executions, each Entry exactly once
```

### T6 — TradeWorkflows.recordPositionChange (opening, end-to-end)
**Type:** behavior-bearing. **Depends:** T4, T5.

The full semantic command: resolve leg intent, prepare candidates, derive/evaluate, prepare Journal effects for the chosen disposition, commit everything atomically; result carries receipt (affected TradeId + new FactRevision, created fact identities, lifecycle transition, Entry/Debt/decline identities, deviation warnings) and postCommit projections; factual recording never blocked by deferral; typed no-write failures (unknown planned-leg reference, invalid quantities/prices/fees, incoherent member set, stale revisions); `RuntimeNotWritable` branch.

**Seam:** `TradeWorkflows.recordPositionChange` over real participants.

```
describe("opening recordPositionChange happy path (multi-fill)")
- it should record four fills of one decision as one Position Change with four Executions sharing one decision identity and stable order, each retaining its own identity and leg intent, producing correct position/lots/fees, stored Open lifecycle with index transition, and exactly one reflection outcome — all in one commit whose result renders success without read-back (AC-RESP-001 multi-fact single-Trade aspect)
- it should allow the factual commit when the reflection is deferred, the Debt existing atomically beside the facts (AC-JOUR-003 aspect)

describe("typed no-write failures")
- it should reject an Execution naming a nonexistent Planned Leg with a typed result and unchanged revisions
- it should reject nonpositive quantity/price or a malformed fee as typed validation with nothing staged
- it should reject a stale Trade revision with a typed conflict, no write
- it should return RuntimeNotWritable outside a Writable session, writing nothing

describe("atomicity across participants")
- it should roll back every staged Trade fact, lot, deviation, and index effect when the Journal participant rejects the prepared reflection (fixture: invalid completed-form answer)
```

### T7 — Trade Views: open-trade browse and detail widening
**Type:** behavior-bearing. **Depends:** VD1-T12, T4, T5.

Open-trade list (stored lifecycle Open via the authoritative index, AnalysisInput batch — no per-Trade child loads) and Trade Detail extension: facts (Position Change + Executions), derived lots and fees, per-leg fulfillment, Deviation occurrences, journal narrative tab.

**Seam:** `TradeViewsAndReporting` browse/detail over the real store.

```
describe("open-trade browse and detail")
- it should list Open trades from the lifecycle index with fulfilled/batched analysis inputs and labels in one snapshot-bound result
- it should render one Trade Detail containing facts, lots, fee treatment, fulfillment per leg, deviations with basis, and the journal narrative — distinguishable as separate concepts (Execution never conflated with Position Change)
- it should expose Loading/Ready/Empty/Error distinctly on both surfaces
```

### T8 — UI: record-opening form
**Type:** behavior-bearing. **Depends:** T1 (wired as T6 lands).

From a planned trade: compose one opening decision — fill rows (instrument inferred from the selected planned leg or explicitly unplanned, side, quantity, price, fee, Economic Time), reflection disposition (complete the rendered form / defer / decline with optional reason), submit → success from the post-commit result showing position, lots, fees, fulfillment; typed rejections inline; abandon records nothing.

**Seam:** record-opening surface against real modules.

```
describe("record-opening form")  — seam: opening-execution surface
- it should accept multiple fill rows as one decision and submit them as one Position Change command
- it should require the reflection disposition to be explicit (complete/defer/decline) while never blocking the factual submit on a deferred reflection
- it should list every typed rejection inline after a failed submit, preserving entered values
- it should present the saved outcome (position, lots, fees, fulfillment, journal outcome) directly from the returned result
```

### T9 — UI: Debt list and resolve form
**Type:** behavior-bearing. **Depends:** T5, T8.

Basic Debt list (outstanding items with due semantics and origin) and an answer form rendered from the Debt's snapshotted definition; resolve → settled confirmation; decline where permitted.

**Seam:** Debt surface against real modules.

```
describe("debt list and resolution")  — seam: debt surface
- it should list Outstanding Debt with its origin and due semantics, distinct from Entries
- it should render the answer form from the Debt's trigger-time snapshot definition, not the current definition
- it should confirm resolution from the returned Entry + settled-Debt projections without a list refetch being required for the confirmation itself
```

### T10 — VD2 integration suite additions + cumulative gate
**Type:** structural. **Depends:** T2–T9.

**Verification:** cumulative suite (VD1 + VD2 cases) green.

### T11 — Fresh browser-critic gate
**Type:** structural gate. **Depends:** T10.

## Progress table

| Task | Status | Evidence |
|---|---|---|
| T1 interface freeze | planned | |
| T2 derive lots/position/window | planned | |
| T3 derive fulfillment/deviations | planned | |
| T4 TradeRecord position-change | planned | |
| T5 Journal debt/narrative | planned | |
| T6 recordPositionChange e2e | planned | |
| T7 Trade Views widening | planned | |
| T8 record-opening UI | planned | |
| T9 debt UI | planned | |
| T10 integration gate | planned | |
| T11 critic gate | planned | |

## Mock-free real-stack integration cases (cumulative suite)

Disclosed infrastructure: `fake-indexeddb`; fixtures created exclusively through authoritative commands (VD1 confirmPlan → VD2 recordPositionChange).

| ID | Case | Real-stack path and durable-state proof |
|---|---|---|
| INT-VD2-01 | Multi-fill opening correctness | confirmPlan(AAPL 100 @ 50, stop 45, target 60) then one Position Change with fills 100 @ 50.00 fee 1.00 and 100 @ 52.00 fee 1.00 → two Open Lots with bases 5001.00 and 5201.00, position 200 shares, entry window open, stored Open lifecycle + index; fresh-connection re-query identical (AC-POS-001 opening half, AC-LIFE-001 Planned→Open) |
| INT-VD2-02 | One decision identity, one reflection | Same fixture as INT-VD2-01 with four fills: one Position Change identity + stable member order, four Execution identities, exactly one Position Change Reflection outcome under its obligation key (AC-POS-002 multi-fill aspect) |
| INT-VD2-03 | Defer creates Debt, never a placeholder | Reflection deferred → factual Position Change committed; Journal query shows one Outstanding Debt with trigger-time snapshot and zero Entry versions for that obligation (AC-JOUR-003 aspect); later `Journal.save(ResolveDebt)` settles it against the snapshot (AC-JOUR-005 basic-uniqueness aspect via a retry conflict) |
| INT-VD2-04 | Decline path | Declined reflection → distinct JournalDecline recorded atomically; obligation key single-outcome |
| INT-VD2-05 | Deviation determinism | Fixtures through real commands: mismatched-terms fill (Planned-Leg Terms, one occurrence aggregating fields), oversized entry (Entry Size), explicitly-unplanned hedge fill (Unplanned Exposure); occurrence fingerprints stable across rederivation |
| INT-VD2-06 | Participant rollback | Completed-reflection form with a blank required answer → typed rejection; every Trade/Journal store unchanged (atomicity) |
| INT-VD2-07 | Not-Verifiable fulfillment | Objective-selector planned leg (complete criteria, no observation evidence) served by a fill → Not Verifiable, no Deviation, no assumed conformance (AC-POS-005 aspect) |

## Browser-critic flows

| ID | Flow | Pass condition |
|---|---|---|
| CRIT-VD2-01 | Record a two-fill opening decision with completed reflection | Detail shows position/lots/fees, fulfillment, reflection entry; trade moves Planned→Open in list |
| CRIT-VD2-02 | Defer the reflection | Facts saved; Debt appears in the debt list; resolve it there from the snapshotted form |
| CRIT-VD2-03 | Decline the reflection | Distinct decline outcome visible; no Entry fabricated |
| CRIT-VD2-04 | Deviation surfacing | Enter a mismatched-terms fill via UI; detail shows the Planned-Leg Terms occurrence with basis |
| CRIT-VD2-05 | Validation honesty | Submit with a blank required reflection answer (completed disposition) → typed rejection, values preserved, nothing saved |
| CRIT-VD2-06 | Open-trade browse + resize + keyboard | Open list and detail correct at both widths, keyboard-completable, states distinguishable |

## Acceptance-scenario coverage

| Scenario | Plan marking @VD2 | VD2 owns | Tasks | Integration | Critic |
|---|---|---|---|---|---|
| AC-POS-001 | Partial (opening half) | positions/lots/fees correctness on opening; closing/FIFO/fee-allocation completion deferred to VD5 | T2, T4, T6 | INT-VD2-01 | CRIT-VD2-01 |
| AC-POS-002 | Partial (multi-fill single decision) | one decision identity/order, per-Execution ownership, one reflection outcome; multi-leg conformance at VD9 | T4, T6 | INT-VD2-02 | CRIT-VD2-01 |
| AC-POS-005 | Partial (single-leg fulfillment values) | PartiallyFilled / FilledWithDeviation / Unplanned Exposure / NotVerifiable distinctions; Not-Entered-at-end at VD5; multi-leg at VD9/VD10 | T3 | INT-VD2-05/07 | CRIT-VD2-04 |
| AC-LIFE-001 | Partial (Planned→Open) | transition + index change + agreement; completion at VD5 | T2, T4 | INT-VD2-01 | CRIT-VD2-01 |
| AC-JOUR-003 | Partial (defer→Debt, no placeholder) | factual record never blocked; due-blocks-Review completes VD3 | T5, T6 | INT-VD2-03 | CRIT-VD2-02/03 |
| AC-JOUR-005 | Partial (basic uniqueness) | one-outcome-per-key + retry conflict; void-reopen at VD13 | T5 | INT-VD2-03/04 | CRIT-VD2-02 |
| AC-RESP-001 | Partial (multi-fact single-Trade) | recordPositionChange result renders without read-back; cross-Trade at VD16 | T6 | INT-VD2-01 | CRIT-VD2-01 |

## Flagged for review

- **F5 — "Due Debt blocks Review" is VD3 machinery.** AC-JOUR-003's Then includes due-Debt blocking of Review; plan assigns that completion to VD3. VD2 proves only creation/snapshot/no-placeholder. Consistent with the plan; noted so the VD3 file owns the blocking test.
- None other. Selector discipline holds (no new seeds; strategy selector still Long Stock only).
