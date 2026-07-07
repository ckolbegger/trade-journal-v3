# Slice 15 — Replay + Analytics

The reflective payoff of all the accumulated facts: replay a Trade's actual history on a time slider (ADR 0009 — no prediction, ever), tag Trades for arbitrary groupings, ask cross-Trade performance questions, and see the equity and P&L curves. The deferred `TradeFilter` and `TimelineFilter` shapes are settled here, in their main consumer's slice.

**Out of scope (JIT):** what-if simulation (rejected for v1, ADR 0009), review-streak/habit analytics ([review.md](../design/review.md) open item — derivable later from review entries; no story asks for it yet), candlesticks (Slice 17).

**Cross-slice note:** the adherence measures in S15.3 require Slices 9–10 (recorded Deviations); if they haven't landed, those `it`s move with them. S15.4's equity curve requires Slice 14.

Design references: ADR 0009, [trademath.md](../design/trademath.md) (`replay`), [overview.md](../design/overview.md) (Analytics), ADR 0012 (declared + derived dimensions), ADR 0013 (curves).

---

## ☐ Story S15.1 — Replay

> As a trader, I want to slide through a Trade's life and watch its P&L and risk/reward evolve as it actually happened, so that I build intuition from reality instead of from a payoff diagram.

**Deep interfaces**: `TradeMath.replay(trade, series)` → `ReplayPoint[]` (each point computed with knowledge as of its date — Exit Levels from Plan + Revisions up to that date, trailing high-water up to that date), `Valuations.replay(tradeId)` ([trade-detail-sequence.md](../design/trade-detail-sequence.md) replay sequence).

### Tasks

- [ ] **S15.1.T1 — TradeMath.replay.**

  ```
  describe "TradeMath.replay"
  - it returns one ReplayPoint per marked date the Trade held quantity
  - it computes each point's Valuation and RiskReward from that date's Marks
  - it anchors planned R/R on the levels effective that date (a revision shifts anchors mid-replay)
  - it resolves trailing from high-water up to that date only (no future knowledge)
  - it reflects executions as of each date (a partial close changes later points' basis)
  - it renders no point for gap dates (a gap is a gap, never a flat line)
  - it replays a closed Trade start to finish
  ```

- [ ] **S15.1.T2 — Time-slider UI.** "Replay" on Trade detail: a chart of total P&L (and planned-risk band) over the Trade's life with a slider; the selected date shows that day's full dashboard numbers; gaps visibly broken. Nothing on this surface projects forward.

  ```
  describe "ReplayView"
  - it renders the series with visible gaps
  - it shows the selected date's Valuation and four R/R numbers
  - it marks execution dates on the timeline
  - it contains no forward-looking element
  ```

- [ ] **S15.1.T3 — Integration tests**: a Trade with a revision and a partial close over Dexie → replay points hand-verified at three dates (before revision, after revision, after partial).
- [ ] **S15.1.T4 — Playwright e2e** (`e2e/s15-1-replay.spec.ts`): open replay on a seeded lifecycle → slide to a known date → numbers match hand-computed values.
- [ ] **S15.1.T5 — Browser verification.** Real browser: replay a Trade lived through earlier slices; verify a known day's numbers, the anchor shift at its revision date, and gap rendering across a skipped day. All suites green.

---

## ☐ Story S15.2 — Tags

> As a trader, I want to label Trades with my own words — "earnings play", "FOMC week" — so that I can later ask questions along groupings nobody designed in advance.

**Deep interfaces**: `TradeBook.setTags(tradeId, tags)` (free-form strings on the TradeRecord, editable any time — tags are labels, not history).

### Tasks

- [ ] **S15.2.T1 — Tags.**

  ```
  describe "TradeBook.setTags"
  - it stores free-form tags on the Trade
  - it replaces the set wholesale on edit (labels, not events)
  - it normalizes duplicates within one Trade
  - it tags open and closed Trades alike
  ```

- [ ] **S15.2.T2 — UI.** A tag editor on Trade detail (add/remove chips, suggestions from existing tags); tags render on the Trade list rows.
- [ ] **S15.2.T3 — Integration + e2e** (`e2e/s15-2-tags.spec.ts`): tag two Trades "earnings play" over Dexie → both filterable in S15.3's screen (or, if built first, both show the chip after reopen).
- [ ] **S15.2.T4 — Browser verification.** Tag real Trades in a real browser; suggestion list offers the existing tag; chips persist. All suites green.

---

## ☐ Story S15.3 — Performance questions

> As a trader, I want to group my results by strategy, idea source, account, tag, or underlying — and by facts like credit vs debit — so that "does this newsletter make me money?" is a query, not a feeling.

**Deep interfaces**: `Analytics.run(spec)` (TradeBook for records, TradeMath for closed P&L, Valuations bulk for open marked values); **`TradeFilter` settled here**: status, account, institution, strategy, ideaSource, tag, underlying, closed-date range — all optional, AND-combined. **`TimelineFilter` settled here**: entry type, anchor kind, tradeId — the journal timeline gains it (deferred from Slice 2).

### Tasks

- [ ] **S15.3.T1 — Analytics.run.**

  ```
  describe "Analytics.run"
  - it filters by each TradeFilter field and their conjunction
  - it groups by a declared dimension (strategy, tag, ideaSource, account, institution, underlying)
  - it groups by the derived credit/debit dimension (net opening cash flow — no label needed)
  - it reports per group: trade count, win rate, realized P&L, average P&L, total fees
  - it counts only closed Trades in win rate and realized columns
  - it reports open Trades' marked P&L in a separate column (via Valuations)
  - it places a Trade in multiple groups when grouping by tag (one per tag)
  - it reports per group: Deviation count and acknowledged share   [requires Slices 9–10]
  describe "TradeBook.query (TradeFilter)"
  - it serves each filter field from its index or scan
  describe "Journal.timeline (TimelineFilter)"
  - it filters by entry type and anchor kind
  ```

- [ ] **S15.3.T2 — Analytics UI.** An Analytics page: filter controls, group-by picker, the results table; a row click lists the group's Trades. The journal timeline gains its filter controls.

  ```
  describe "AnalyticsPage"
  - it runs the worked query: group closed Trades by ideaSource, showing P&L per source
  - it re-groups by credit/debit without any Trade having been labeled
  - it drills into a group's Trade list
  ```

- [ ] **S15.3.T3 — Integration tests**: a seeded book of ~8 closed + 2 open Trades across strategies/sources/tags over Dexie → hand-computed table for two groupings; timeline filter returns only review entries when asked.
- [ ] **S15.3.T4 — Playwright e2e** (`e2e/s15-3-analytics.spec.ts`): the ideaSource grouping renders the hand-computed numbers.
- [ ] **S15.3.T5 — Browser verification.** Real browser over accumulated data: run three groupings, spot-check one group's P&L against its Trades' dashboards; filter the timeline to standalone entries. All suites green.

---

## ☐ Story S15.4 — Curves

> As a trader, I want my equity curve and cumulative P&L over time, so that the long arc of my trading is visible, not just trade-by-trade snapshots.

**Deep interfaces**: Account Snapshot series (Slice 14) for the equity curve; Executions (+ Marks for the open remainder) for the cumulative realized P&L curve, per Account and overall. Snapshots cannot separate performance from contributions — accepted and labeled (ADR 0013).

### Tasks

- [ ] **S15.4.T1 — Curve data + rendering.**

  ```
  describe "equity curve"
  - it plots the snapshot series with gaps rendered as gaps (sparse is honest)
  - it scopes per account and overall (sum on dates where all accounts have points; else gap)
  describe "cumulative P&L curve"
  - it accumulates realized P&L by close date from Executions alone
  - it reproduces identical values after export/reimport (derived, never stored)
  describe "curve view"
  - it labels the equity curve as including deposits/withdrawals (ADR 0013 honesty)
  ```

- [ ] **S15.4.T2 — Integration + e2e** (`e2e/s15-4-curves.spec.ts`): seeded snapshots + closed Trades → both curves match hand-computed points.
- [ ] **S15.4.T3 — Browser verification.** Real browser: both curves over real accumulated data; verify a known month's cumulative P&L against Analytics' total for that range; verify the sparse-snapshot account draws gaps, not interpolation. All suites green.
