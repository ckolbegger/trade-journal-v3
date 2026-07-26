# Journal Entries attach at three levels; Market entries are linkable

## Context
A trader's reflection happens at different scopes: about a whole Trade, about
a specific Fill, or about a market-wide event that affects many Trades at
once ("25% tariff on EU goods announced"). The natural assumption is that a
journal entry attaches to a Trade; that fails for market-wide observations
and over-couples reflection to fills.

## Decision
A Journal Entry attaches at exactly one of three levels:
- **Trade-level** — about the Trade as a whole.
- **Fill-level** — tied to a specific Fill.
- **Market-level** — a macro observation with no parent Trade, which may be
  **linked** to the Trades it affects so it surfaces when those Trades are
  reviewed.

Additionally, entries are **decoupled from fills** — the trader is never
forced to write while trading; a placeholder is created that the trader
completes later.

There is **no Session entity**. "Market session" is only a time-based filter
on entries and fills.

## Rationale
- Three attachment levels match how reflection actually occurs (per-trade,
  per-fill, per-market) without forcing every note onto a Trade.
- Market-level entries with optional linking gives macro notes a home without
  a many-to-many mandate (the trader links only when meaningful).
- Decoupling from fills keeps the trader's focus on execution during the
  trading day; reflection is deferred by design.
- We rejected a **Session entity** (a named, first-class market-day record to
  write notes against) as unnecessary — a time range filter serves the same
  viewing need without an extra entity to maintain.

## Consequences
- Entry storage has a discriminated attachment (tradeId | fillId | none) plus
  an optional many-to-many link table for market-entry ↔ affected-trade.
- The Daily Review assembles its view by time range across all three levels,
  interleaved.
- "No Session entity" is a deliberate scope decision; do not add one without
  revisiting this ADR.
