# Design overview — deep interfaces and how they interact

The app is partitioned into a small number of deep modules (Ousterhout sense): a lot of behavior behind small interfaces. Two rules govern every interaction:

1. **Books store facts; TradeMath derives; coordinators join; the UI sees finished items.** No derivation is ever stored (net position is the same species as status — ADR 0005). No caller outside TradeBook, Valuations, and Analytics ever handles raw event records.
2. **Storage is an internal seam.** Each Book is a single implementation of domain behavior over an injected StorageBinding — in-memory (unit tests), Dexie on fake-indexeddb (integration), Dexie on IndexedDB (production). Business logic exists exactly once.

## Modules

| Interface | Abstracts | Ops (est.) |
|---|---|---|
| **TradeBook** | System of record for Trades: plan → confirm → execute → close lifecycle; Plan Revisions; Transfers, Rolls, lineage links; Deviation recording; Accounts/Institutions/Snapshots; trader-managed Plan lists (Strategies, Idea Sources). Hides attachment bookkeeping and transactional writes. Stores facts; never does arithmetic on them. | 14–18 |
| **Journal** | Trader writing: entries anchored to Trade moments or standalone; Entry Types with Prompt schema evolution; Journal Debt derivation; seeded defaults. | 8–10 |
| **PriceBook** | Price observations: Marks (one per instrument-date, shared, edit-impact warnings); future Daily Bars; missing-Mark queries; lazy per-instrument history; fetch orchestration via PricingSource adapters. | 7–9 |
| **PricingSource** *(adapter)* | One external market-data provider; N adapters over time (ADR 0008). Manual entry is the absence of one. | 2–3 |
| **TradeMath** *(pure)* | Every per-Trade computation: `positionOf`, `instrumentsOf`, `statusOf`, `valuation`, `riskReward`, `replay`, `detectDeviations`, `attentionScore`, `impliedVol`. See [trademath.md](./trademath.md). | 9 |
| **Valuations** *(coordinator)* | The only place the Trade↔Marks join happens: takes a tradeId, pulls facts from TradeBook, asks TradeMath what instruments matter, pulls series from PriceBook, runs the math, returns finished items. | 5–6 |
| **Analytics** | Cross-Trade questions: filter/group by declared dimensions (Strategy, Tag, Idea Source, Account, Institution, underlying) and derived ones (credit/debit…); performance tables; adherence stats; equity & P&L curves. | 3–5 |
| **Review** | Daily Review as a domain object: agenda assembly (Marks needed, attention-ranked Trades, Journal Debt, snapshot prompt), session completion. | 4–6 |
| **Workspace** | Durability & lifecycle: export/import, storage-persistence health, first-run seeding, app settings (e.g., risk-free rate for IV display). | 3–4 |
| *(internal)* **StorageBinding** | Narrow keyed-record primitives under each Book; the injection point of the testing strategy. Internal seam. | 4–6 each |

## Valuations (coordinator) sketch

```typescript
interface Valuations {
  position(tradeId): Promise<Position>            // TradeBook → TradeMath.positionOf; no Marks fetched
  value(tradeId, asOf?): Promise<{ valuation: Valuation; riskReward: RiskReward }>
  detail(tradeId): Promise<TradeDetail>           // page-shaped bundle from ONE record+series snapshot:
                                                  // facts, Position, Valuation, RiskReward, Deviations;
                                                  // records newly surfaced discipline Deviations (ADR 0012)
  replay(tradeId): Promise<ReplayPoint[]>
  disciplineCheck(tradeId | 'allOpen', asOf): Promise<DetectedDeviation[]>
  attentionBoard(asOf): Promise<RankedTrade[]>    // open Trades, scored and sorted
}
```

See [trade-detail-sequence.md](./trade-detail-sequence.md) for the full interaction sequences behind the Trade detail page (load, replay, journal timeline).

## Who calls whom

| Module | May call |
|---|---|
| TradeMath | nothing (pure) |
| TradeBook | its StorageBinding; TradeMath (`detectDeviations` at Execution save, to record structural/sizing Deviations) |
| Journal | its StorageBinding |
| PriceBook | its StorageBinding; PricingSource adapters |
| Valuations | TradeBook, PriceBook, TradeMath |
| Review | Valuations, Journal, PriceBook, TradeBook |
| Analytics | TradeBook, Journal, Valuations (bulk), TradeMath |
| Workspace | StorageBindings (export/import), Books (seeding) |
| UI | Books for writes (record Execution, write entry, enter Mark) and pure fact reads (journal timeline); Valuations / Review / Analytics for anything computed. Facts arriving inside coordinator bundles are display-only — the UI never derives from them. Never TradeMath or StorageBindings directly. |

## Interaction walkthroughs

**Display current holdings** — `UI → Valuations.position(id)` → TradeBook serves the TradeRecord → `TradeMath.positionOf(record)` → `Position`. No Marks involved.

**Trade dashboard (P&L + four R/R numbers)** — `UI → Valuations.value(id)` → TradeBook record → `TradeMath.instrumentsOf(record)` → `PriceBook.series(instruments)` → `TradeMath.valuation + riskReward` → finished items.

**Record an Execution** — `UI → TradeBook.recordExecution(...)` → TradeBook persists the fact, calls `TradeMath.detectDeviations(record)`, records any structural/sizing Deviations (ADR 0012), returns the updated record and new Deviations for the UI to surface.

**Daily Review** — `UI → Review.agenda(date)` → open-Trade instruments (TradeBook + TradeMath) → `PriceBook.missingMarks(date)` → trader enters/fetches Marks → `Valuations.attentionBoard(date)` ranks the walk → `Valuations.disciplineCheck('allOpen')` detects stop/target crossings, which TradeBook records → `Journal.outstandingDebt()` lists entries to settle.

**Analytics query** — `UI → Analytics.run(spec)` → TradeBook lists matching records → per-Trade math (via Valuations for marked valuations, TradeMath for closed-Trade P&L) → group by declared + derived dimensions → result table.

## Slice 1 note

Slice 1 implements a subset of operations on these same interfaces (stock instruments, manual Marks, no rolls/replay/analytics) — the shapes above are full-roadmap so later slices add operations, not reshape seams.
