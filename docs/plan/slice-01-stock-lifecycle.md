# Slice 1 — Stock trade lifecycle

The trader can plan a stock Trade, journal the plan (or defer it as Journal Debt), record fills, watch position and P&L with all four risk/reward numbers, close with a Close Reason, and run a Daily Review: collect Marks, walk open Trades in insertion order, record an Action per Trade, settle Journal Debt.

**Out of scope (own slices):** Deviations (9/10), Plan Revisions (11), Corrections (12), attention ranking (8 — walk is insertion-ordered), journal timeline/standalone entries (2), Entry Type management (13), Account Snapshots (14), export/import (6), options (3), automated pricing (4).

**Scaling note:** This slice's lifecycle is single fill open → single fill close. Valuation computes basis as the sum of opening Executions and realizes P&L on the full close — no Lot tracking. FIFO Lots (ADR 0015), partial closes, and repeat fills all arrive in Slice 5, refactoring valuation internals behind the tests written here.

Design references: [tradebook.md](../design/tradebook.md), [trademath.md](../design/trademath.md), [journal.md](../design/journal.md), [pricebook.md](../design/pricebook.md), [review.md](../design/review.md), [trade-detail-sequence.md](../design/trade-detail-sequence.md), ADRs 0002–0008, 0010, 0014.

**Worked example used throughout (all money in cents in code; dollars here):**
Plan: Long Stock, buy 100 AAPL, stop $140, target $170. Fill: buy 100 @ $150.00, fees $1.00. Mark today: $160.00.
- currentValue $16,000 · unrealizedPnL $1,000 · fees $1 · totalPnL $999
- plannedRisk $2,000 (160→140 — giveback counts, ADR 0010) · worstCaseRisk $16,000 (stock to zero)
- plannedReward $1,000 (160→170) · maxReward `'unlimited'`
- original: risk $1,000 (150→140), reward $2,000 (150→170)
- Close later: sell 100 @ $168.00, fees $1.00 → realizedPnL $1,798, Trade flat.

---

## ☑ Story S1.1 — Plan & confirm a stock Trade

> As a trader, I want to capture my thesis, intended structure, and exit levels as an immutable Plan before I enter, so that my original intent can never be quietly rewritten after the market moves.

**Deep interfaces**: `TradeBook.confirmPlan / get / query`, `TradeBook.registries.strategies / ideaSources`, `TradeMath.statusOf`, `Workspace.ensureSeeded` (first subset: Strategy seed). Types: `PlanDraft`, `PlannedLeg`, `ExitLevel`, `TradeRecord` per [trademath.md](../design/trademath.md).

**Prototype:** [new plan step 1](../design/prototype/proto-new-plan-step1.png) ([desktop](../design/prototype/proto-new-plan-step1-desktop.png)), [step 2](../design/prototype/proto-new-plan-step2.png) ([desktop](../design/prototype/proto-new-plan-step2-desktop.png)), [trade list](../design/prototype/proto-home.png) ([desktop](../design/prototype/proto-home-desktop.png)), [trade detail](../design/prototype/proto-position-detail-stock.png) ([desktop](../design/prototype/proto-position-detail-stock-desktop.png)), [planned before any fill](../design/prototype/proto-position-detail-planned.png) ([desktop](../design/prototype/proto-position-detail-planned-desktop.png)) — two steps: ticker + strategy, then thesis and risk parameters. The planned state shows `LEGS & FILLS (0)` / "25 planned" / "No fills yet", which is this story's end state before S1.3. Note what the prototype makes **required**: not the thesis but *"What invalidates it?"*, with a nudge ("writing your invalidation before entry makes it 3x more likely you'll honor the stop"). It also captures an emotional state at plan time and expresses entry as a **low/high range** plus an "exit in (days)" horizon.

### Tasks

- [x] **S1.1.T1 — Domain types.** `src/domain/trademath/types.ts`: `TradeRecord`, `PlanFacts`, `PlannedLeg`, `ExitLevel` (`underlyingPrice` stop/target only — the other kinds arrive with the slices that first offer them), `LegFacts`, `ExecutionFacts`, `Instrument` (stock only; options are Slice 3), `InstrumentKey` helpers (build/parse canonical string).

  ```
  describe "InstrumentKey"
  - it renders a stock instrument as its ticker ("AAPL")
  - it parses "AAPL" back to a stock instrument
  ```

- [x] **S1.1.T2 — TradeMath.statusOf.**

  ```
  describe "TradeMath.statusOf"
  - it returns 'planned' for a Trade with no Executions and no Close Reason
  - it returns 'closed' for a Trade with no Executions but a Close Reason (abandoned plan)
  - it returns 'open' when any Leg has nonzero net quantity
  - it returns 'closed' when Executions exist and every Leg nets to zero
  ```

- [x] **S1.1.T3 — TradeBook.confirmPlan / get / query.** Creates the Trade with an immutable Plan; no operation on TradeBook can modify `plan` afterward. `query` supports `{ status }` filtering (status computed via `TradeMath.statusOf` at read time — never stored, ADR 0005) and returns insertion order.

  ```
  describe "TradeBook.confirmPlan"
  - it creates a Trade bound to an existing Account and returns its id
  - it rejects a draft whose accountId does not exist
  - it rejects a draft with an empty thesis
  - it rejects a draft with no Planned Legs
  - it stores plannedAt, Idea Source, Strategy id, and optional chart link
  - it exposes no operation that mutates plan after confirmation

  describe "TradeBook.query"
  - it returns Trades in insertion order
  - it filters by derived status 'planned'
  - it filters by accountId
  ```

- [x] **S1.1.T4 — Seeding (Workspace.ensureSeeded, first subset).** Idempotent, apply-iff-absent by id ([workspace.md](../design/workspace.md)); this story seeds Strategy **Long Stock** (planned leg: buy stock, qty asked at plan time; asks for `underlyingPrice` stop + target). Runs at every startup from the composition root.

  ```
  describe "Workspace.ensureSeeded"
  - it seeds the Long Stock strategy into an empty registry
  - it does not duplicate on a second run
  - it does not overwrite a seeded item the trader edited
  - it does not resurrect a seeded item the trader archived
  ```

- [x] **S1.1.T5 — Plan form UI.** "New Trade" from the Trades page: pick Account, pick Strategy (template pre-fills the planned stock leg and asks for stop/target), thesis (required), Idea Source (pick or add inline — trader-managed list, `registries.ideaSources`), qty, optional chart link. Confirm → Trade appears in the list. Dexie schema adds `trades` (+ `ideaSources`, `strategies`) stores.

  ```
  describe "PlanForm"
  - it pre-fills a buy-stock Planned Leg from the Long Stock strategy
  - it blocks confirm until account, thesis, ticker, qty, stop, and target are set
  - it adds a new Idea Source inline and selects it
  - it calls TradeBook.confirmPlan with a well-formed PlanDraft
  describe "TradeList"
  - it shows the new Trade with a 'planned' badge, newest last (insertion order)
  ```

- [x] **S1.1.T6 — Trade detail page (facts only).** Route per Trade showing Plan facts: thesis, Strategy, Idea Source, Planned Legs, Exit Levels, chart link, status badge. (Valuation numbers arrive in S1.5; this story renders facts.)
- [x] **S1.1.T7 — Integration tests** (`tests/integration/plan-confirm.test.ts`): over Dexie + fake-indexeddb — seed → confirm plan → reopen DB → `get` returns identical record; `query({status:'planned'})` finds it; plan immutability holds across reopen.
- [x] **S1.1.T8 — Playwright e2e** (`e2e/s1-1-plan.spec.ts`): onboard → New Trade → fill worked-example plan → confirm → list shows AAPL planned → detail shows thesis, stop 140, target 170.
- [x] **S1.1.T9 — Browser verification.** Run the app; create the worked-example Plan. Expected: Trade listed as `planned`; detail page shows all Plan facts; reload persists everything; no way exists in the UI to edit the confirmed Plan. All suites green.

---

## ☑ Story S1.2 — Journal at plan time

> As a trader, I want to answer the Plan journal prompts when I confirm a Trade — or skip and owe it — so that my reasoning is captured at the moment it exists, without journaling ever blocking a trade.

**Deep interfaces**: `Journal.write / entriesFor / countFor`, `Journal.entryTypes` registry, `Anchor` `{kind:'plan', tradeId}`, placeholder mechanics (ADR 0006/0007); seed: Entry Type **Plan**.

**Prototype:** [entry composer](../design/prototype/proto-entry-composer.png) ([desktop](../design/prototype/proto-entry-composer-desktop.png)) — free-text prompt plus an option-chip prompt ("Feeling").

**Seed content — Entry Type "Plan"** (`designatedFor: 'plan'`): Why this trade, why now? (text) · What invalidates the thesis? (text) · Conviction (scale 1–5) · Emotional state (select: calm / eager / anxious / FOMO / revenge).

### Tasks

- [x] **S1.2.T1 — Journal core.** `Journal.write` snapshots the Entry Type's prompts into the entry (ADR 0007); placeholder writes carry the snapshot with no answers. `entriesFor({trade})` returns entries anchored anywhere inside the Trade; `countFor` counts them. Dexie adds `entries`, `entryTypes` stores (entry index on `anchor.tradeId`).

  ```
  describe "Journal.write"
  - it stores an entry with answers snapshotting the prompts as asked
  - it stores a placeholder with prompts snapshotted and placeholder=true
  - it rejects an answer to a prompt id not in the Entry Type
  - it rejects a select answer not among the prompt's options
  - it rejects a scale answer outside the prompt's min..max
  - it records 'at' as the lifecycle moment's timestamp
  describe "Journal.entriesFor / countFor"
  - it returns entries anchored {kind:'plan'} for the Trade
  - it returns entries in 'at' order
  - it counts a Trade's entries
  - it returns nothing for a Trade with no entries
  describe "entry immutability"
  - it exposes no operation that edits a written entry's answers
  ```

- [x] **S1.2.T2 — Seeding extension.** `ensureSeeded` also seeds the Plan Entry Type (same iff-absent tests as S1.1.T4, extended to entry types).
- [x] **S1.2.T3 — Entry form at confirm.** After `confirmPlan` succeeds, the Plan entry form renders the seeded prompts (text / select / scale widgets). **Write now** → `Journal.write` full entry. **Skip** → placeholder written silently (this IS Journal Debt — no nag, ADR 0006). Trade detail shows the plan entry (or a "journal owed" marker) and an entry-count badge via `countFor`.

  ```
  describe "PlanEntryForm"
  - it renders all four seeded prompts with the right widget kinds
  - it writes a full entry anchored {kind:'plan', tradeId}
  - it writes a placeholder when skipped
  - it never blocks navigation away (skip is one click)
  describe "TradeDetail journal section"
  - it shows the plan entry's prompts and answers
  - it shows an owed marker for a placeholder
  ```

- [x] **S1.2.T4 — Integration tests**: confirm plan → write entry → reopen DB → `entriesFor({trade})` returns it with snapshot intact; skip path round-trips `placeholder=true`.
- [x] **S1.2.T5 — Playwright e2e** (`e2e/s1-2-plan-journal.spec.ts`): confirm a plan → answer prompts (conviction 4, calm) → detail shows the entry; second trade → skip → detail shows owed marker.
- [x] **S1.2.T6 — Browser verification.** Both paths in a real browser: written entry displays prompts-as-answered; skipped entry shows debt marker; reload persists both; confirm remains one uninterrupted flow (skip never modal-blocks). All suites green.

---

## ☑ Story S1.3 — Record Executions, see Position

> As a trader, I want to record my fills against a planned Trade, so that the app shows exactly what I hold and my Trade goes open the moment the first fill lands.

**Deep interfaces**: `TradeBook.recordExecution` (`ExecutionTarget` existing-leg | new-leg; **no new-Trade target exists** — plan-first is structural, ADR 0003), `ExecutionOutcome` (`nowFlat` consumed in S1.4), `TradeMath.positionOf`, `Valuations.position` (first Valuations operation; composition root wires it).

**Prototype:** [record fill](../design/prototype/proto-add-fill.png) ([desktop](../design/prototype/proto-add-fill-desktop.png)), [position & history](../design/prototype/proto-position-detail-stock.png) ([desktop](../design/prototype/proto-position-detail-stock-desktop.png)) — fill form is Buy/Sell, qty, price, instrument.

### Tasks

- [x] **S1.3.T1 — TradeMath.positionOf.** Net open quantity per Leg from Executions. (Short positions arrive with short option legs in Slice 3; Lots in Slice 5.)

  ```
  describe "TradeMath.positionOf"
  - it returns empty holdings for a planned Trade
  - it returns +100 AAPL after buying 100
  - it returns zero holdings after buying 100 and selling 100
  - it reports per-Leg quantity and side
  - it honors asOf: executions after the date are excluded
  ```

- [x] **S1.3.T2 — TradeBook.recordExecution.** Persists the Execution (side, qty, price, fees, timestamp) against an existing Leg or a new Leg in an existing Trade; returns `ExecutionOutcome` (`record`, `nowFlat`; `newDeviations` always `[]` until Slice 9).

  ```
  describe "TradeBook.recordExecution"
  - it appends an Execution to a new Leg on first fill
  - it appends the closing fill to the existing Leg of the same instrument
  - it rejects a target Trade that does not exist
  - it rejects zero or negative qty and negative price or fees
  - it returns nowFlat=false while quantity remains
  - it returns nowFlat=true when the Execution nets the Trade to zero
  - it derives status open after the first fill (statusOf, never stored)
  ```

- [x] **S1.3.T3 — Valuations.position.** `TradeBook.get` → `TradeMath.positionOf`; no Marks fetched ([overview.md](../design/overview.md) walkthrough).

  ```
  describe "Valuations.position"
  - it returns the Position for a Trade id
  - it touches PriceBook not at all (no marks needed)
  ```

- [x] **S1.3.T4 — Record-fill UI + detail sections.** "Record fill" on the Trade detail page: pre-selects the planned instrument (existing/new Leg resolved automatically), side, qty, price, fees, date. Detail gains **Position** ("100 AAPL long") and **Execution history** (each fill: date, side, qty, price, fees). Trade list badge flips to `open`.

  ```
  describe "RecordFillForm"
  - it pre-fills instrument and side from the Planned Leg
  - it submits a well-formed ExecutionDraft to TradeBook
  - it shows validation errors inline (qty, price)
  describe "TradeDetail position & history"
  - it shows holdings from Valuations.position
  - it lists executions oldest-first with fees
  ```

- [x] **S1.3.T5 — Integration tests**: plan → fill → reopen DB → position +100, status open, execution history intact.
- [x] **S1.3.T6 — Playwright e2e** (`e2e/s1-3-executions.spec.ts`): worked example — confirm plan, record buy 100 @ 150 fees 1 → badge open, position "100 AAPL", history row correct.
- [x] **S1.3.T7 — Browser verification.** Record the worked-example fill in a real browser: status flips planned→open with no manual status control anywhere; position and history correct; reload persists. All suites green.

---

## ☑ Story S1.4 — Close & abandon

> As a trader, I want the app to notice when a fill flattens my Trade and ask me why it ended — and let me abandon a planned Trade whose thesis died — so that every ended Trade carries a queryable Close Reason.

**Deep interfaces**: `ExecutionOutcome.nowFlat`, `TradeBook.setCloseReason`, `registries.closeReasons` (seeded), `Journal.write` with `{kind:'close', tradeId}`; seed: Close Reasons + Entry Type **Close**.

**Seed content — Close Reasons**: Hit Target · Hit Stop · Thesis Invalidated · Timed Out · Never Filled. ("Rolled" is seeded by Slice 16 with the roll gesture — no Slice 1 test could select it.) **Entry Type "Close"** (`designatedFor: 'close'`): What worked / what didn't? (text) · Would you take this trade again? (select: yes / yes-smaller / no) · Lesson (text).

**Prototype:** none — and the absence is the finding. The prototype's "Close position" is a stub: it toasts "Position closed", returns Home, and leaves the position open (verified with and without fills). It has no Close Reason, no close entry, and no abandon path. Everything this story specifies about *why a Trade ended* is absent there, so the prototype offers no guidance on this screen — see [the planned-trade state](../design/prototype/proto-position-detail-planned.png) ([desktop](../design/prototype/proto-position-detail-planned-desktop.png)) for the only related surface it does render.

### Tasks

- [x] **S1.4.T1 — setCloseReason + seeds.**

  ```
  describe "TradeBook.setCloseReason"
  - it attaches a reason from the closeReasons registry to a flat Trade
  - it attaches a reason to a planned Trade (abandonment) making statusOf 'closed'
  - it rejects a reason id not in the registry
  - it rejects when the Trade is open (holding quantity)
  describe "seeding (extension)"
  - it seeds the five Close Reasons and the Close Entry Type iff absent
  ```

- [x] **S1.4.T2 — Close flow UI.** When `recordExecution` returns `nowFlat: true`, prompt for Close Reason (from registry) + the Close entry form (write or skip → placeholder — same mechanics as S1.2). Trade badge shows `closed`; detail shows reason + close entry. Trades page splits or filters by status (Open / Planned / Closed).

  ```
  describe "CloseFlow"
  - it prompts for a Close Reason when a fill flattens the Trade
  - it records the reason via setCloseReason
  - it writes the close entry, or a placeholder on skip
  - it can be dismissed and completed later from the detail page (non-blocking)
  describe "AbandonFlow"
  - it offers 'abandon' on a planned Trade and requires a reason (e.g. Never Filled)
  ```

- [x] **S1.4.T3 — Integration tests**: open → flattening sell → reason Hit Target + entry → reopen DB → status closed, reason and entry persisted; abandoned planned Trade round-trips as closed with Never Filled.
- [x] **S1.4.T4 — Playwright e2e** (`e2e/s1-4-close.spec.ts`): worked example — sell 100 @ 168 fees 1 → close prompt → Hit Target → answer close prompts → badge closed; second planned trade → abandon Never Filled.
- [x] **S1.4.T5 — Browser verification.** Drive both endings in a real browser: flattening fill triggers the prompt at the natural moment; dismissing it leaves a completable owed state (never a blocking modal); abandoned plan reads closed/Never Filled; reload persists. All suites green.

---

## ☑ Story S1.5 — Manual Marks & valuation

> As a trader, I want to enter today's price and see my P&L and all four risk/reward numbers, so that I judge staying in by what I'm risking from *today's* value, not by a stale plan.

**Deep interfaces**: `PriceBook.record / markSet / series` (`RecordResult.overwrote` + `TradeBook.tradesHolding` compose the shared-Mark edit warning), `TradeMath.instrumentsOf / valuation / riskReward`, `Valuations.value / detail` ([trade-detail-sequence.md](../design/trade-detail-sequence.md): one record+series snapshot feeds every number).

**Prototype:** [dashboard](../design/prototype/proto-position-detail-stock.png) ([desktop](../design/prototype/proto-position-detail-stock-desktop.png)), [R/R panel at plan time](../design/prototype/proto-new-plan-step2-filled.png) ([desktop](../design/prototype/proto-new-plan-step2-filled-desktop.png)) — note the prototype frames exits as "$95.90 away" / "$19.10 cushion" rather than the four R/R numbers this story specifies, and computes its ratio in the *plan form* rather than on the dashboard. Its numbers are wrong (position risk is 100× too large on stock) — take the framing, not the arithmetic.

### Tasks

- [x] **S1.5.T1 — PriceBook core.** One Mark per (instrument, date); origin `'manual'` this slice; Dexie adds `marks` store keyed `(instrument, date)` with instrument index (lazy-loading guardrail, ADR 0011).

  ```
  describe "PriceBook.record / markSet / series"
  - it stores a manual Mark keyed (instrument, date)
  - it returns overwrote with the prior Mark when re-recording the same key
  - it markSet() returns exactly the requested instruments for a date
  - it markSet() omits instruments with no Mark that date (absence, not zero)
  - it series() returns date-ordered Marks per instrument
  - it series() respects a date range; gaps simply have no entry
  ```

- [x] **S1.5.T2 — TradeMath.instrumentsOf + valuation.** Worked example is the spec.

  ```
  describe "TradeMath.instrumentsOf"
  - it returns the stock instrument for a one-leg stock Trade
  describe "TradeMath.valuation"
  - it values the worked example at mark 160: currentValue 16000.00, unrealized 1000.00, fees 1.00, total 999.00
  - it computes realized 1798.00 after the closing sell at 168 (net of both executions' fees)
  - it reports per-Leg basis, realized, and unrealized
  - it returns zero unrealized when the Mark equals basis price
  - it throws a typed error when a held instrument's Mark is absent from the MarkSet
  ```

- [x] **S1.5.T3 — TradeMath.riskReward.** All four numbers mark-to-market (ADR 0010) + `original` from entry basis (see index: decided-in-plan semantics).

  ```
  describe "TradeMath.riskReward"
  - it computes the worked example at 160: plannedRisk 2000.00, worstCaseRisk 16000.00, plannedReward 1000.00, maxReward 'unlimited'
  - it reports original risk 1000.00 and reward 2000.00 from entry basis 150
  - it counts giveback: after a rise to 165 plannedRisk grows to 2500.00
  - it returns plannedRisk 'undefined' when the Plan has no stop
  - it returns plannedReward 'undefined' when the Plan has no target
  - it returns original risk/reward 'undefined' before any Execution
  ```

- [x] **S1.5.T4 — Valuations.value + detail.** `detail` assembles the page bundle from ONE TradeRecord + series snapshot: facts, Position, Valuation, RiskReward (Deviations join in Slice 9). `value` is the lighter pair for list rows.

  ```
  describe "Valuations.detail"
  - it fetches the record once and the series once (one snapshot feeds every number)
  - it returns facts, Position, Valuation, and RiskReward that agree on the same executions
  - it uses the latest date in the series as the valuation MarkSet
  - it returns a marks-missing signal (instrument list) instead of numbers when no Mark exists yet
  ```

- [x] **S1.5.T5 — Mark entry + dashboard UI.** Trade detail: enter/edit today's Mark inline; shows P&L block and the four R/R numbers with the original Plan pair alongside for contrast (ADR 0010). Editing an existing Mark warns first when other Trades hold the instrument (peek `markSet` → `tradesHolding` → confirm → `record`, [pricebook.md](../design/pricebook.md) correction sequence). Trades list shows P&L for marked Trades.

  ```
  describe "MarkEntry"
  - it records a manual Mark for the Trade's instrument today
  - it warns before overwriting a Mark other Trades consumed, naming the count
  - it skips the warning when only this Trade holds the instrument
  describe "TradeDashboard"
  - it renders P&L and all four R/R numbers from Valuations.detail
  - it renders 'unlimited' and 'undefined' anchors as words, not numbers
  - it shows the original plan risk/reward alongside ongoing
  - it prompts for a Mark when none exists instead of showing numbers
  ```

- [x] **S1.5.T6 — Integration tests**: plan → fill → record mark 160 → reopen DB → `detail` reproduces every worked-example number; re-record 161 → `overwrote` reports 160; two Trades holding AAPL see the same Mark (stored once).
- [x] **S1.5.T7 — Playwright e2e** (`e2e/s1-5-valuation.spec.ts`): worked example end-to-end — enter mark 160 → assert all six displayed numbers; edit mark with a second AAPL Trade open → warning names 2 Trades.
- [x] **S1.5.T8 — Browser verification.** Verify every worked-example number on screen against the table above, the unlimited/undefined renderings, the shared-Mark warning, and persistence across reload. All suites green.

---

## ☑ Story S1.6 — Daily Review: agenda & Mark collection

> As a trader, I want the app to tell me which prices are missing since my last review — including days I skipped — and what journal I owe, so that a session starts with everything it must cover and a missed Tuesday can't silently corrupt my history.

**Deep interfaces**: `Review.agenda`, `Valuations.marksNeeded` (`TradeBook.query(open)` → `TradeMath.instrumentsOf` → `PriceBook.lastMarked`), `PriceBook.missingMarks / fetch` (fetch is the no-adapter no-op path — the UI always calls it, [review.md](../design/review.md)), `Journal.outstandingDebt`.

### Tasks

- [x] **S1.6.T1 — PriceBook.lastMarked + missingMarks.**

  ```
  describe "PriceBook.lastMarked"
  - it returns the latest Mark date per instrument
  - it returns undefined for a never-marked instrument
  describe "PriceBook.missingMarks"
  - it lists (instrument, date) pairs in the range with no Mark
  - it returns nothing when the range is fully marked
  - it treats every calendar date in range as needed (no trading calendar — the trader's review defines the dates)
  ```

- [x] **S1.6.T2 — PriceBook.fetch (no-adapter path).** Registered-adapter orchestration is Slice 4; this slice implements the seam: no sources → instant `FetchReport` with everything `unsupported`, nothing stored.

  ```
  describe "PriceBook.fetch (no adapters)"
  - it returns immediately with all requested instruments unsupported
  - it stores nothing
  ```

- [x] **S1.6.T3 — Valuations.marksNeeded.** Per open Trade: instruments + range (day after `lastMarked` → asOf; never-marked instruments start at the Trade's first Execution date). Overall `fetchRange` = earliest gap → asOf.

  ```
  describe "Valuations.marksNeeded"
  - it lists each open Trade's instruments and gap range
  - it starts a never-marked instrument at its Trade's first Execution date
  - it starts a marked instrument the day after its last Mark
  - it includes skipped days (Monday-marked instrument on Wednesday needs Tue+Wed)
  - it excludes closed and planned Trades
  - it returns an empty list when everything is marked through asOf
  ```

- [x] **S1.6.T4 — Review.agenda.** Composition only, stores nothing: marksNeeded + fetchRange + journalDebt (`Journal.outstandingDebt` = unsettled placeholders). (`expiredLegs` joins in Slice 3, `accountsForSnapshot` in Slice 14.)

  ```
  describe "Journal.outstandingDebt"
  - it returns unsettled placeholders only
  - it excludes settled placeholders and full entries
  describe "Review.agenda"
  - it bundles marks needed per Trade, the fetch range, and journal debt
  - it is empty-agenda when no open Trades and no debt exist
  ```

- [x] **S1.6.T5 — Review start page UI.** `/review`: start session → agenda renders — open Trades with missing Mark rows (including gap days), owed journal count, then a "begin walk" action. UI calls `fetch` unconditionally before showing the remainder (one collection path in every slice).

  ```
  describe "ReviewAgendaPage"
  - it lists each open Trade with its missing (instrument, date) rows
  - it shows Tuesday's row after a skipped day (gap recovery visible)
  - it shows the outstanding journal debt count
  - it always calls PriceBook.fetch before presenting the remainder
  - it shows an all-caught-up state when the agenda is empty
  ```

- [x] **S1.6.T6 — Integration tests**: two open Trades, one marked Monday, review Wednesday → agenda over Dexie shows Tue+Wed rows for one and first-execution-date range for the never-marked one; debt count matches placeholders.
- [x] **S1.6.T7 — Playwright e2e** (`e2e/s1-6-agenda.spec.ts`): seeded scenario → open Review → agenda shows the gap rows and debt count.
- [x] **S1.6.T8 — Browser verification.** With one Trade marked yesterday and one never marked plus one skipped plan-entry: agenda lists correct gap rows per Trade and the owed entry; marking everything and reopening Review shows all-caught-up. All suites green.

---

## ☑ Story S1.7 — Daily Review: the walk

> As a trader, I want to walk my open Trades one by one — fill in missing prices, see fresh P&L and risk/reward, and record what I'll do about each — so that every day in a trade is a conscious decision, recorded in one tap.

**Deep interfaces**: `Review.walk` (insertion order this slice — `WalkItem` gains its `attentionScore` field in Slice 8; `reviewedToday` derives from a review-anchored entry for asOf), `PriceBook.missingMarks / record` inline, `Valuations.detail`, `Journal.write` `{kind:'review', date, tradeId}` + `Journal.settle`; seed: Entry Type **Trade Review**.

**Seed content — Entry Type "Trade Review"** (`designatedFor: 'review'`): **Action** (select: Hold / Exit Soon / Adjust / Watch Closely) · Conviction (scale 1–5) · Note (text). The Action select's options ARE the Action list — recording it is what marks the Trade reviewed.

### Tasks

- [x] **S1.7.T1 — Journal.settle.** Completing a placeholder answers its *snapshot* — completion, not editing; both timestamps kept (late journaling visible).

  ```
  describe "Journal.settle"
  - it stores answers against the placeholder's snapshotted prompts
  - it keeps both at and settledAt
  - it rejects settling a non-placeholder entry
  - it rejects settling twice
  - it makes the entry disappear from outstandingDebt()
  - it outstandingDebt() excludes settled placeholders (absorbed from S1.6.T4 — unwritable before settle existed)
  ```

- [x] **S1.7.T2 — Review.walk.** Open Trades in insertion order; per item `reviewedToday` (a `{kind:'review'}` entry for asOf+tradeId exists) and `outstandingDebt` count. Order snapshotted at session start — no mid-walk reshuffling.

  ```
  describe "Review.walk"
  - it lists open Trades in insertion order
  - it flags reviewedToday when a review entry exists for that date
  - it leaves reviewedToday false for entries from other dates
  - it carries each Trade's unsettled-placeholder count
  - it excludes planned and closed Trades
  ```

- [x] **S1.7.T3 — Walk UI.** From the agenda, "begin walk" steps through Trades. Per checkpoint: missing-Mark rows for THIS Trade filled inline (shared instruments prompt only at first encounter — already-marked rows don't reappear); a gap row may be skipped, accepting the blind spot; then the dashboard (S1.5's `detail` view) with fresh numbers; then the **Action** prompt (seeded Trade Review type); then that Trade's debt offered for settlement (or deferred again). Skipping a whole Trade is allowed and visible — it stays unreviewed, never nagged.

  ```
  describe "WalkCheckpoint"
  - it prompts only this Trade's missing (instrument, date) rows
  - it records typed prices via PriceBook.record as manual Marks
  - it allows skipping a gap row and proceeds
  - it shows the refreshed dashboard after marks land
  - it writes the Action as a review-anchored entry (that IS reviewing)
  - it marks the checkpoint done only after the Action is recorded
  - it offers this Trade's placeholders for settlement
  - it allows deferring settlement without blocking the walk
  describe "WalkSession"
  - it shows progress (reviewed / total) and a completion state
  - it does not reshuffle order as marks land mid-session
  - it leaves a skipped Trade visibly unreviewed
  ```

- [x] **S1.7.T4 — Integration tests**: full session over Dexie — two open Trades, one with debt; walk → record marks, Actions on both, settle the placeholder → reopen DB → review entries anchored `{kind:'review'}` with date+tradeId, `reviewedToday` true, `outstandingDebt` empty; re-running `agenda` shows all-caught-up.
- [x] **S1.7.T5 — Playwright e2e** (`e2e/s1-7-walk.spec.ts`): seeded two-trade scenario → full walk: type marks, pick "Hold" + conviction, settle owed plan entry → completion state; reopen Review → both flagged reviewed, no debt.
- [x] **S1.7.T6 — Browser verification.** Run a complete Daily Review in a real browser end-to-end (agenda → walk → Actions → settlement → done), confirming: inline marks refresh the numbers live, the Action recording flips the reviewed flag, a skipped Trade stays visibly unreviewed, and next-day agenda reflects today's marks as `lastMarked`. All suites green.

---

## ☑ Story S1.8 — Mark entry doesn't pre-fill an existing Mark *(added 2026-08-14 — slice re-opened after live use surfaced a bug; the `slice-1-complete` tag remains the historical rollback point for S1.1–S1.7)*

> As a trader, I want the "Today's mark" field to already show today's price when one is on file, so that I'm editing a known value instead of re-typing it from memory or overwriting it blind.

**Why (observed in live use, 2026-08-14):** `TradeDashboard` renders `MarkEntry` at two sites (the `marksMissing` prompt and the steady-state valuation view) and neither passes `currentPrice` — the field opens blank even when a Mark for that instrument/date already exists (confirmed: a fetched AAPL Mark for the trading date was present in PriceBook while the Daily Review walk's checkpoint dashboard still showed an empty box captioned "Today's mark"). `MarkEntry` (`src/ui/pages/MarkEntry.tsx:24-26`) already supports pre-fill via its `currentPrice` prop — it's simply never wired. Bug reachable from both the Trade detail page directly and from inside the Daily Review walk (`WalkCheckpoint` renders `TradeDashboard`), so it doubles as a silent-overwrite risk during the walk: saving the blank field re-records today's Mark at whatever the trader retypes, even if it matches what's already stored.

**Decided in this story:** `TradeDetailView` (`src/coordinators/valuations.ts`) gains a way to surface each held instrument's own current Mark price (not just the derived Valuation) so `TradeDashboard` can pass `currentPrice` at both `MarkEntry` call sites (`src/ui/pages/TradeDashboard.tsx:111` and `:206`).

**Deep interfaces**: `Valuations.detail`'s return shape (`TradeDetailView`) — the minimal addition is the per-instrument price `latestMarks` already fetches internally but doesn't expose.

### Tasks

- [x] **S1.8.T1 — Surface the current Mark price and wire pre-fill.**

  ```
  describe "Valuations.detail"
  - it exposes each held instrument's current Mark price alongside the Valuation
  describe "MarkEntry (via TradeDashboard)"
  - it pre-fills the field with the existing Mark's price when one exists
  - it still opens blank when no Mark exists yet for the instrument
  ```

- [x] **S1.8.T2 — Integration test**: plan → fill → record a Mark → reopen DB → Trade detail's `TradeDashboard` shows the field pre-filled with the stored price, not blank.
- [x] **S1.8.T3 — Playwright e2e**: extend or add to an existing S1.5/S1.7 spec — record a Mark, reload, confirm the field shows the stored value; confirm the same inside a Daily Review walk checkpoint.
- [x] **S1.8.T4 — Browser verification.** Real browser: a Trade with today's Mark already on file shows it pre-filled on the detail page AND inside the walk checkpoint; a Trade with no Mark yet still opens blank. All suites green.

---

## ☐ Story S1.9 — Recording the negative: declined prompts and considered-but-not-taken actions *(added 2026-08-23 — slice re-opened to close a capture gap named in [ADR 0016](../adr/0016-automated-coaching-deferred.md); the `slice-1-complete` tag remains the historical rollback point for S1.1–S1.7)*

> As a trader, I want one tap to say "nothing to note today", and one place each session to record what I considered doing and decided against, so that my restraint and my silence both survive in the record instead of reading as gaps.

**Why (ADR 0016):** deferring the coach is safe; deferring the questions it would ask is not. Two facts are unrecoverable after the fact and neither is captured today:

- An urge acted on becomes an Execution. An urge resisted — the add not made, the stop not moved, the revenge trade not opened — leaves no trace anywhere in the model. "You wanted to and didn't" is the best material a coach has, and it is currently unrecordable.
- A prompt left blank is indistinguishable from a prompt deliberately answered "nothing". `Entry.answered[]` already allows an absent `answer`, but absence means both "skipped" and "declined". The blanks will cluster on exactly the tilted, losing days that matter most, and no later analysis can separate the two.

**Decided in this story:**

- **Declination is per Prompt, not per Entry.** `Entry.answered[]`'s element gains `declined`. A declined prompt is *answered* — the trader said "nothing" — so it is never Journal Debt and never nagged. This generalises to every prompt, including the emotional ones, without another record shape later.
- **Writing is never gated.** The checkpoint stays immediately writable; declining is an explicit action beside save. **Rejected:** gating the entry behind a "make an entry / no entry today" mode that disables the other fields — whichever branch costs zero taps becomes the default, and making silence free reintroduces precisely the goes-thin-where-discipline-failed failure ADR 0006 was written to prevent. Friction belongs on the skip, not on the write.
- **A declined review entry still marks the Trade reviewed.** No special-casing is needed: a review Anchor's existence for `(date, tradeId)` *is* the reviewed-today flag (`src/books/journal/types.ts` — "nothing about 'reviewed' is stored anywhere else"). Writing the entry is what counts, not what it says.
- **The considered-but-not-taken question is asked once per session, not per Trade.** With several open Trades, per-Trade repetition drives the honest answer to blank, and the most dangerous urges — opening a revenge trade, breaching a position limit — have no Trade to hang off. It writes a `standalone` entry at the walk's completion step. A trader who wants it per-Trade can add it to Trade Review once S13 ships.
- **It rides a new Entry Type, which is what makes it reachable.** `ensureSeeded` adds a seeded type only when its **id is absent** (`src/workspace/workspace.ts:489`), so adding a prompt to the existing Trade Review type would never reach a database that already has it — including the live one. A *new* type is absent everywhere, so the existing additive-iff-absent logic delivers it to old databases for free, with no migration and no risk of resurrecting something a trader later deletes.

**Deep interfaces**: `Journal.write` / `entriesFor` / `outstandingDebt` (the `answered[]` element gains `declined`), `Workspace.ensureSeeded` (one new seeded Entry Type), `Review.walk`'s completion step. Seed: Entry Type **Session Reflection**.

**Seed content — Entry Type "Session Reflection"** (undesignated, written standalone by the walk's completion step): **Considered** (text: "Anything you considered doing today and decided against?") · Note (text). Undesignated because no lifecycle moment *requires* it — the walk offers it, and skipping it is ordinary.

### Tasks

- [ ] **S1.9.T1 — Declination as a fact.** `answered[]`'s element gains `declined?: true`; `write` accepts a declined prompt, `entriesFor` reads it back distinctly, `outstandingDebt` treats it as settled.

  ```
  describe "Journal.write — declined prompts"
  - it records a prompt as declined, carrying no value
  - it round-trips declined distinctly from an absent answer
  - it allows an entry mixing answered, declined and absent prompts
  describe "Journal.outstandingDebt"
  - it does not report an entry whose prompts were all declined
  - it still reports a placeholder whose prompts are merely unanswered
  ```

- [ ] **S1.9.T2 — Seed the Session Reflection type.**

  ```
  describe "Workspace.ensureSeeded — Session Reflection"
  - it seeds the type on a fresh database
  - it adds the type to a database seeded before this story existed
  - it does not re-add the type when already present
  - it does not modify the Trade Review type's prompts
  ```

- [ ] **S1.9.T3 — UI: decline at the checkpoint, ask once at the end.** The walk checkpoint's Action prompt keeps its current behaviour; a **"Nothing to note today"** action beside save writes the review entry with its text prompts declined (the Action select still records — it is the Trade's disposition, not a reflection). The walk's completion step offers the Session Reflection question once, skippable, writing a `standalone` entry. No mode switch and no disabled fields anywhere in the checkpoint.

  ```
  describe "WalkCheckpoint — nothing to note"
  - it writes a review entry with the text prompts declined
  - it marks the Trade reviewed, same as a written entry
  - it creates no Journal Debt
  - it leaves every field editable before and after the action
  describe "WalkSession — session reflection"
  - it offers the considered-actions question once at completion, not per Trade
  - it writes a standalone entry when answered
  - it writes nothing when skipped, and creates no debt
  ```

- [ ] **S1.9.T4 — Integration tests**: full session over Dexie — two open Trades, decline one checkpoint and write the other, answer the session question → reopen DB → both Trades reviewed, the declined prompts read back as declined (not blank), `outstandingDebt` empty, the standalone entry present and unanchored to either Trade.
- [ ] **S1.9.T5 — Playwright e2e** (`e2e/s1-9-declining.spec.ts`): walk two Trades — "Nothing to note today" on the first, a written note on the second, answer the session question at the end → reopen Review: both flagged reviewed, no debt, timeline shows the standalone entry.
- [ ] **S1.9.T6 — Browser verification.** Real browser: run a full review declining one Trade and writing another; confirm the checkpoint is writable at every moment (no disabled inputs), that declining marks the Trade reviewed and produces no nag next day, and that the session question appears exactly once regardless of how many Trades were walked. Confirm on a database seeded before this story that the Session Reflection type appears without any migration step. All suites green.

---

## Slice complete when

- [ ] Every story above is checked.
- [x] The full lifecycle runs in one browser session: onboard → plan → journal → fill → mark → review walk with Action → flattening fill → Close Reason + close entry — with the app reloaded at least once mid-lifecycle and nothing lost.
- [x] Playwright suite (7 story specs + shell) green in CI-mode (`npm run test:e2e`).
