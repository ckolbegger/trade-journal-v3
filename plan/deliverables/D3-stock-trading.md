# D3 — Stock trading

## Outcome

The trader records each buy or sell decision as one Position Change containing one or more Executions, says which Planned Leg each Execution serves (or that it is explicitly unplanned), and either completes, declines, or defers the Position Change Reflection. The app derives the Position, FIFO Lots and Lot Matches, fee allocation, realized P&L, Entry Quality, Planned-Leg fulfillment, fact-only Deviations, lifecycle, and Terminal Disposition. Closing a Trade by a sale requires a Close Reason and records the Close Review as completed, declined, or deferred. Open and Closed Trades appear in the list and detail views. A deterministic 25,000-Trade dataset proves the startup and open-list latency targets.

**Production-UI entry points:** Trade Detail → Record Position Change (sheet on narrow, drawer on wide) and Close Position; Trades list (Open and Closed); Trade Detail sections for Position, Lots, Lot Matches, Executions, P&L, Entry Quality, fulfillment, Deviations, lifecycle, Journal narrative, and Debt indicators.

## Scope of the stock variant

- Executions are on the Trade's planned Stock Instrument. Other Instruments and exposure reversing below zero shares are rejected as unsupported in this release; they arrive with multi-leg Trades (D10). Under this restriction, management coverage is always complete (the Plan's price Stops and Targets cover every share), so no Management Debt arises yet.
- One Position Change belongs to one Trade. Cross-Trade Position Changes arrive with settlement (D9) and Rolls (D10).
- Current valuation, risk to Stop, and reward to Target need Marks and are absent until D6; this deliverable shows no placeholder for them.
- Corrections (Replace, Void, Rebuild) arrive in D5.

## Interpretations to confirm

- **Entry Quality comparison:** the spec compares "actual entry risk/reward" with the frozen Plan Baseline. This plan computes actual risk and reward at the Entry Resolution Point from the entered quantity's average opening price including allocated opening fees, using the original Stops and Targets, and classifies **Below Plan** when the actual reward/risk ratio is below the planned ratio, otherwise **Met or Exceeded**. If actual risk is not positive (average entry at or below the nearest Stop), Entry Quality is Unavailable with that reason. **Confirmed by the user 2026-10-10.**
- **Debt due time:** superseded by PD-009 (user, 2026-10-10). A deferred reflection is due at the Review cutoff of the first trading session that ends after the moment it was deferred, and the Debt records its deferral count (1 on creation, at most 3). Re-deferral happens in Daily Review (D7). The affected `it should …` cases are revised once ADR 0012 is on `main`. Computing the next session's cutoff needs the XNYS calendar (PD-006), so the calendar data file and its session lookup move forward from D6 into D3.

## Installed capabilities after D3 (in addition to D1–D2)

| Module | Operations / variants |
|---|---|
| Trade Workflows | `recordPositionChange` (stock variant above); `abandonPlan` now also rejects Trades with an effective Execution |
| Trade Record | `prepareChange` (Position Change), lot-match and Deviation records, `queryRecords` (Open and Closed, Last Activity and Terminal Time sorts) |
| Trade Analysis | `derive` (stock variant, complete) |
| Journal | `prepareEffects` and `applyPreparedEffects` for Position Change Reflection and Close Review with Complete, Decline, or Defer; Debt creation |
| Trade Views and Reporting | `browseTrades` and `getTradeDetail` for Open and Closed Trades |

## Tasks

### T3.1 Trade Analysis: stock derivation (B)

- **Depends on:** D2
- **Seam:** `src/domain/trade-analysis/index.ts` (`derive`). Worked examples use exact decimals.

```text
describe("FIFO Lots and fees")
  it should create one Open Lot per opening Execution carrying its whole fee as unconsumed opening fee
  it should match a sale against the oldest Lot first
  it should split a sale across Lots when it exceeds the oldest Lot
  it should consume an opening fee in proportion to matched quantity (100 shares, $1.00 fee, sell 40 → $0.40 consumed, $0.60 remaining)
  it should allocate a closing fee in proportion across its Lot Matches
  it should include both fee portions in realized P&L exactly once
  it should keep price and P&L off Lot Match links
  it should order same-time Executions by Recorded Sequence
describe("Lifecycle, terminal outcome, and Realized R")
  it should expect Open once effective Executions leave nonzero shares
  it should expect Closed when shares return to zero after exposure existed
  it should require one Close Reason when the closing Position Change contains a sale (trader agency)
  it should list the closing Executions and quantities as the Terminal Disposition
  it should return Realized R as final net realized P&L divided by 1R for a Closed planned Trade
  it should return incurred fees separately without subtracting them twice
describe("Entry Resolution and Entry Quality")
  it should start the entry window at the first Position Change that establishes exposure
  it should resolve the window when the planned quantity has been entered
  it should resolve the window immediately before the first exposure-reducing Position Change
  it should report Pending while the window is unresolved
  it should classify Below Plan when the actual reward/risk ratio including allocated fees is below the planned ratio
  it should classify Met or Exceeded otherwise
  it should report Unavailable with a reason when actual risk is not positive
  it should not change Entry Quality after later scale-ins
describe("Planned-Leg fulfillment and Deviations")
  it should report the leg Unfilled before any serving Execution
  it should report PartiallyFilled and then FilledAsPlanned as serving quantity accumulates
  it should record Entry Size excess at the Position Change that exceeds the planned quantity
  it should record Entry Size shortfall at Entry Resolution when entered quantity is below plan
  it should record Unplanned Exposure only for Executions with ExplicitlyUnplanned intent, with the derived quantity
  it should keep fingerprints identical when the same facts are derived again
describe("Entry/Exit Scaling")
  it should classify a Closed Trade with one opening and one closing Position Change as Single Entry / Single Exit
  it should classify more decision-level Position Changes as Scaled regardless of Execution count
describe("Agreement with recorded state")
  it should report disagreement when stored lifecycle differs from the expected one
  it should report disagreement when recorded Lot Matches differ from expected FIFO links
  it should report disagreement when recorded Deviations differ from expected occurrences
  it should never repair recorded state
describe("Stock variant limits")
  it should reject an Execution on another Instrument as unsupported
  it should reject a sale that would take shares below zero as unsupported
```

### T3.2 Schema version 3 and Trade Record section validator (B)

- **Depends on:** T3.1
- **Seam:** `src/domain/persistence/migrations.ts`, `src/domain/trade-record/validate.ts` (reused by Restore in D8)

```text
describe("Migration to schema version 3")
  it should add Position Change, Execution, Lot Match, and Deviation stores and the Last Activity and Terminal Time indexes
  it should preserve every version 2 record unchanged
  it should abort and leave version 2 intact when the Trade Record validator fails
describe("Trade Record section validator")
  it should reject duplicate fact identities or broken version chains
  it should reject an Execution owned by no Trade or by two Trades
  it should reject a Position Change with no members
  it should accept a coherent Trade whose stored lifecycle disagrees and report it as repairable
  it should reject incoherent facts such as a sale exceeding held shares
```

### T3.3 Trade Record: Position Changes (B)

- **Depends on:** T3.2
- **Seam:** `src/domain/trade-record/index.ts`

```text
describe("Prepare Position Change")
  it should build candidate Executions grouped under one Position Change without writing
  it should assign the same stable Position Change identity to every member
  it should include before and candidate AnalysisInput and a canonical digest
  it should reject a stale expected revision
describe("Apply Position Change")
  it should persist Executions, the Position Change, Lot Match links, Deviation occurrences, and the lifecycle index together
  it should move the Trade between lifecycle index memberships in the same commit
  it should update Last Activity and Terminal Time for sorting
  it should reject a reconciliation that does not match the candidate digest
describe("Open and Closed queries")
  it should select Open and Closed Trades from the lifecycle index without replaying history
  it should sort by Last Activity descending or Terminal Time descending, then Trade identity
  it should return a bounded AnalysisInput batch in one snapshot without one query per Trade
```

### T3.4 Journal: Position Change Reflection, Close Review, and Debt (B)

- **Depends on:** T3.2
- **Seam:** `src/domain/journal/index.ts`

```text
describe("Position Change Reflection outcomes")
  it should prepare a completed Entry validated against the current definition
  it should prepare an explicit Decline with an optional reason
  it should prepare Outstanding Debt with the trigger-time definition snapshot, Trade Anchor, Position Change origin, and due time
  it should never prepare a blank or placeholder Entry for Defer
  it should give the outcome Source Position Change
describe("Close Review outcomes")
  it should use an obligation key distinct from the Position Change Reflection
  it should give the outcome Source Trade Close
  it should allow Complete, Decline, or Defer
describe("Obligation uniqueness")
  it should reject a second outcome for an obligation key that already has one
  it should treat a retried identical command as a conflict rather than a duplicate
describe("Trade Debt query")
  it should return Outstanding Debt and declines for a Trade's narrative
```

### T3.5 Trade Workflows: record a Position Change (B)

- **Depends on:** T3.1, T3.3, T3.4
- **Seam:** `src/domain/trade-workflows/index.ts` (unit tests mock collaborators)

```text
describe("recordPositionChange")
  it should require Planned-Leg intent on every Execution
  it should require an explicit reflection disposition
  it should commit Executions, Lots, Lot Matches, Deviations, lifecycle, and the reflection outcome in one transaction
  it should return the post-commit Trade, derivation, and Journal outcomes without a follow-up read
  it should return CloseReasonRequired and write nothing when the change closes the Trade without a Close Reason
  it should reject a Close Reason when the change does not close the Trade
  it should reject the Rolled Close Reason outside a Roll
  it should reject an inactive Close Reason
  it should record the Close Review outcome when the change closes the Trade and never block closure on it
  it should repair and disclose a stale stored lifecycle when the facts are coherent
  it should return Conflict and write nothing for a stale expected revision
  it should return RuntimeNotWritable and write nothing when readiness is not Writable
describe("abandonPlan with Executions")
  it should reject Abandonment when an effective Execution exists
```

### T3.6 Trade Views: Open and Closed Trades (B)

- **Depends on:** T3.1, T3.3, T3.4

```text
describe("browseTrades for Open and Closed Trades")
  it should present an Open item with shares held, realized-to-date P&L, Debt count, and Deviation indicator
  it should present a Closed item with final P&L, Realized R when available, Terminal Disposition, and Close Reason
  it should derive only the returned page, never the whole population
  it should flag an item whose stored and expected lifecycle disagree
describe("getTradeDetail for Open and Closed Trades")
  it should return Position, Open Lots, Lot Matches, and Executions grouped by Position Change
  it should return incurred fees, realized P&L, Entry Quality, and Planned-Leg fulfillment
  it should return Deviations with their supporting facts
  it should return lifecycle, Terminal Disposition, and Close Reason as separate fields
  it should return the Journal narrative with reflections, Close Review, declines, and Outstanding Debt
  it should return IntegrityBlocked with the disagreement instead of a Ready view when recorded state disagrees
```

### T3.7 Services and capability manifest update (B)

- **Depends on:** T3.5, T3.6

```text
describe("Installed Capability Manifest for D3")
  it should add exactly the D3 operations and variants listed in this plan
```

### T3.8 Record Position Change screen (B)

- **Depends on:** T3.7

```text
describe("Record Position Change")
  it should open as a sheet in narrow layout and a drawer in wide layout while keeping the Trade Detail beneath
  it should add and remove Execution rows within one Position Change
  it should require side, quantity, price, fee, and Planned-Leg intent for each Execution
  it should offer "Unplanned — serves no Planned Leg" as an explicit intent choice
  it should preselect Defer for the reflection while showing Complete and Decline
  it should show the Close Reason and Close Review section when Close Position is used or when the result requires a Close Reason, keeping every entered value
  it should show the saved outcome from the result without reloading the Trade
  it should keep entered values and explain the conflict when the Trade changed
  it should call no service when the form is abandoned
describe("Close Position")
  it should prefill one sale for the shares shown in the current Trade Detail
```

### T3.9 Trade Detail and list for Open and Closed Trades (B)

- **Depends on:** T3.7

```text
describe("Trade Detail for Open and Closed Trades")
  it should show Plan, Position, Executions, and Lots as separately labelled sections
  it should use Execution, Position Change, Position, and Lot Match as headings
  it should show lifecycle, Terminal Disposition ("Closed via"), and Close Reason separately
  it should show Entry Quality as Pending, Below Plan, Met or Exceeded, or Unavailable with its reason
  it should show Deviations and Planned-Leg fulfillment
  it should show Outstanding Debt and declined reflections in the narrative
  it should show an integrity message instead of figures when the detail is IntegrityBlocked
describe("Trades list for Open and Closed Trades")
  it should show realized-to-date P&L for Open items and final P&L with Realized R for Closed items
  it should sort Open by Last Activity and Closed by Terminal Time
```

### T3.10 Mature dataset generator (S)

- **Depends on:** T3.7
- **Work:** `tools/bench/generate.ts`, run by Playwright in a temporary profile against the production build. A seeded pseudo-random generator drives the real services (`confirmPlan`, `recordPositionChange`, `abandonPlan`) with a fixed clock over five years of sessions, producing 25,000 stock Trades (about 200 Open at the end, some Abandoned), about 200,000 Executions grouped into realistic Position Changes, and Plan Reflections, Position Change Reflections, Close Reviews, declines, and Debt. The finished profile directory is cached under `.cache/bench/` (git-ignored) keyed by schema version, generator version, and seed. Later deliverables extend the generator with Marks, Daily Review Actions, and corrections.
- **Verification:** `npm run bench:generate` twice with the same seed produces identical record counts and an identical Workspace content digest; counts are printed and saved to `plan/evidence/D3-dataset.md`.

### T3.11 Startup and open-list benchmark (S)

- **Depends on:** T3.10
- **Work:** `tools/bench/latency.spec.ts`. Each cold run copies the cached profile to a fresh temporary directory, launches a new browser process with the network disabled, and measures from navigation start to the `initial-screen-interactive` performance mark (emitted when the Open list has rendered all data and accepts input): 30 runs. Warm runs navigate from another screen to the Open list and measure to `open-list-complete`: 50 runs. p95 by nearest rank over raw timings. A benchmark build flag exposes a persistence request counter; the open list must issue a constant number of store requests independent of the Open count. Correctness is asserted before and after (200 Open Trades; realized-P&L total equals the generator's expected total). Environment details (CPU, memory, OS, browser version) are recorded.
- **Verification:** `npm run bench:latency` writes raw timings and the summary to `plan/evidence/D3-latency.md`; passes when cold p95 ≤ 2,500 ms and warm p95 ≤ 1,500 ms. It runs again with fuller history in later deliverables.

### T3.12 Capacity minimum from measurement (S)

- **Depends on:** T3.10
- **Work:** measure the generated profile's `navigator.storage.estimate().usage`, extrapolate the stores not yet generated (Marks, Daily Review Actions) from per-record sizes, and replace the D1 estimate in `CAPACITY_MINIMUM_BYTES` with measured size × 2 (migration headroom), recording the arithmetic.
- **Verification:** the unit test for the constant is updated to the measured formula; `plan/evidence/D3-capacity.md` records the measurement.

## Integration tests

| ID | Scenario | Durable-state proof | Green after |
|---|---|---|---|
| I3.1 | Planned → buy (Open) → second buy (Open, scaled) → sell all (Closed) with a Close Reason. | After each step: lifecycle index membership, expected lifecycle agreement, Terminal Disposition only after closing; reopen database between steps. | T3.5 |
| I3.2 | Two buys at different prices and fees, a partial sale, and a final sale. | Lots, Lot Match links, fee allocation, and realized P&L equal the worked example; no price or P&L stored on links. | T3.5, T3.6 |
| I3.3 | One decision with three Executions. | One Position Change identity, three Execution identities, one reflection outcome. | T3.5 |
| I3.4 | Defer the reflection. | Outstanding Debt with the trigger-time snapshot exists; no Entry exists; a later Position Change still records normally. | T3.5 |
| I3.5 | Submit the same reflection outcome twice. | One outcome; the second returns Conflict. | T3.5 |
| I3.6 | Closing sale without a Close Reason. | CloseReasonRequired; store dump unchanged. | T3.5 |
| I3.7 | Abandon a Trade that has an Execution. | Rejected; store dump unchanged. | T3.5 |
| I3.8 | Disclosed raw write making stored lifecycle disagree. | Detail returns IntegrityBlocked and the stored value is unchanged by reads; the next Position Change repairs it and discloses the repair. | T3.5, T3.6 |
| I3.9 | Every D3 mutation result compared with an independent read at its revision. | AC-RESP-001 equality. | T3.5, T3.6 |

## End-to-end tests

| ID | Scenario | Acceptance | Green after |
|---|---|---|---|
| E3.1 | Enter, scale in, partially exit, and fully exit a stock Trade through the UI in wide and narrow layouts; restart between steps. | AC-LIFE-001, AC-POS-001 | T3.8, T3.9 |
| E3.2 | Close with a Close Reason; complete, decline, and defer the Close Review in three Trades; closure never waits. | AC-POS-004 | T3.8, T3.9 |
| E3.3 | Partial fill and an explicitly unplanned extra purchase; fulfillment and Deviations shown. | AC-POS-005 | T3.8, T3.9 |
| E3.4 | Defer a reflection, then record another Position Change. | AC-JOUR-003 | T3.8 |
| E3.5 | Update from the D2 release with existing Plans; migration to version 3 keeps them. | AC-REST-004 (cumulative) | T3.9 |
| E3.6 | Resize during a half-filled Position Change; axe scan of new screens; keyboard-only Position Change. | AC-UI-001, AC-UI-002 | T3.8, T3.9 |
| E3.7 | No correction, Marks, Journal, or Backup actions are offered. | AC-CAP-001 | T3.9 |

## Critic flows

| ID | Flow |
|---|---|
| C3.1 | Enter a planned stock Trade in two decisions, check Lots and Entry Quality. |
| C3.2 | Partial exit, then full exit with a Close Reason and a completed Close Review. |
| C3.3 | Full exit with a deferred Close Review; Debt shown. |
| C3.4 | One decision with several Executions. |
| C3.5 | Unplanned extra purchase and the resulting Deviation. |
| C3.6 | Close Position shortcut, and the Close Reason requirement when it is omitted. |
| C3.7 | Open and Closed lists, sorting, and Realized R. |
| C3.8 | Keyboard-only Position Change in narrow layout. |

## Acceptance mapping

| Scenario | Coverage in D3 |
|---|---|
| AC-LIFE-001 | T3.1, T3.5, I3.1, E3.1 |
| AC-LIFE-002 | Execution case: T3.5, I3.7 |
| AC-LIFE-003 | T3.1, T3.2, T3.5, T3.6, I3.8 (Restore preparation in D8) |
| AC-POS-001 | T3.1, I3.2, E3.1 |
| AC-POS-004 | Trader-agency case: T3.1, T3.5, I3.6, E3.2 (non-agency settlement in D9) |
| AC-POS-005 | Partial fill and Unplanned Exposure: T3.1, E3.3 (term mismatches and objective selectors in D10) |
| AC-JOUR-003 | T3.4, I3.4, E3.4 |
| AC-JOUR-005 | Retry uniqueness: T3.4, I3.5 (Void reopening in D4) |
| AC-PERF-001 | T3.10, T3.11 (stock-only history; rerun with fuller history later) |
| AC-RESP-001 | I3.9 (Position Change family) |
| AC-REST-004, AC-UI-001, AC-UI-002, AC-CAP-001 | E3.5, E3.6, E3.7 (cumulative) |
